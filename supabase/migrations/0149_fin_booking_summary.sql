-- ─────────────────────────────────────────────────────────────────────────────
-- 0149 — THE CANONICAL FINANCIAL READ MODEL
--
-- One place every screen reads money from. The audit that started this rebuild
-- found two rival answers to «how much has PIMA received» sitting one tap apart
-- in the same owner dashboard — OwnerDashboardShell asking bookingMoney(),
-- OwnerFinancialCenter asking the payment rows. This is the end of that.
--
-- ── IT DERIVES, IT DOES NOT STORE ───────────────────────────────────────────
--
-- Nothing here is a table. Every figure is read from whichever table already
-- owns it:
--
--   agreed terms      → booking_financials      (immutable snapshot)
--   money that moved  → fin_transaction_legs    (append-only ledger)
--   owner settlement  → payout_bookings         (explicit linkage)
--   cash release      → settlement_holds
--   owner debt        → owner_receivables + recoveries
--   promotion         → booking_financials, and booking_promotions for detail
--
-- No running balance is cached, so nothing here can drift out of step with the
-- thing it reports.
--
-- ── THREE PROJECTIONS, NOT ONE OPEN VIEW ────────────────────────────────────
--
-- fin_booking_summary carries PIMA's margin, its projected net position, the
-- cash shortfall and the override. An owner has a right to their entitlement and
-- their settlement; they have no right to PIMA's margin, and a guest has no
-- right to either. PostgreSQL cannot hide COLUMNS per role, so the base view is
-- revoked from everyone and three role-scoped views are granted instead.
--
-- The base view is unfiltered by design. That is safe precisely because nobody
-- can select it: view-on-view runs with the view owner's privileges, so the
-- three projections read it while `authenticated` cannot. 0142's admin-only RLS
-- on booking_financials is untouched — no owner was granted SELECT on it to
-- make this work.
--
-- ── ENTITLEMENT IS NOT PAYABLE (PD-04) ──────────────────────────────────────
--
-- The one distinction this model exists to make. On a 1000 booking with an
-- 800 net rate and a 300 deposit:
--
--   owner_entitlement        800   what the owner is owed in total
--   arrival_balance_external 700   the guest hands this to the house directly
--   owner_cash_payable       100   what PIMA actually transfers
--
-- The 700 is NOT PIMA cash, receivable, revenue or collection. It appears here
-- so the UI can label it as the external amount it is, and it is never summed
-- into any PIMA total.
--
-- Consequently owner_cash_payable derives from the settlement HOLD, not from
-- entitlement: `hold_amount − settled`. Using `entitlement − settled` would
-- claim PIMA owes the 700 it never touches.
--
-- ── MONEY STAYS NUMERIC ─────────────────────────────────────────────────────
--
-- 0148 noted that NUMERIC through JSONB loses trailing zeros. The frontend
-- contract was inspected before deciding: types.ts declares totalPrice,
-- depositAmount and commissionRate as `number`; db.ts coerces with Number();
-- formatting is presentation-only via toLocaleString('ar-EG'), and invoice.ts
-- even rounds. Nothing depends on exact decimal serialisation. So money stays
-- numeric — the least disruptive choice, and the one the existing contract
-- already assumes.
-- ─────────────────────────────────────────────────────────────────────────────


-- ═══ THE CANONICAL DERIVATION ═══════════════════════════════════════════════
-- Revoked from everyone. Read only through the three projections below.
CREATE OR REPLACE VIEW public.fin_booking_summary AS
SELECT
  bf.booking_id,
  bf.house_id,
  bf.owner_id,
  b.user_id                                   AS guest_user_id,
  bf.currency,
  b.check_in,
  b.check_out,
  b.status                                    AS booking_status,
  b.guests_count,

  -- ── Price, and who funded each reduction (snapshot) ──────────────────────
  bf.model_type,
  bf.retail_price,
  bf.promo_discount,
  bf.points_discount,
  bf.points_redeemed,
  bf.final_price,

  -- ── Deposit (snapshot) ───────────────────────────────────────────────────
  bf.deposit_rate,
  bf.deposit_standard,
  bf.deposit_amount,
  bf.deposit_basis,

  -- PD-04. Paid by the guest DIRECTLY to the house. Never PIMA money.
  (bf.final_price - bf.deposit_amount)        AS arrival_balance_external,

  -- ── Cash PIMA actually holds, from the ledger and nowhere else ───────────
  COALESCE(led.pima_cash, 0)                  AS pima_cash_received,
  GREATEST(0, bf.deposit_amount - COALESCE(led.pima_cash, 0)) AS deposit_remaining,
  COALESCE(led.refund_payable, 0)             AS refund_payable,

  -- ── Owner side ───────────────────────────────────────────────────────────
  bf.owner_entitlement,
  COALESCE(sh.hold_amount, 0)                 AS owner_cash_held,
  COALESCE(pb.settled, 0)                     AS owner_settled_amount,
  GREATEST(0, COALESCE(sh.hold_amount, 0) - COALESCE(pb.settled, 0)) AS owner_cash_payable,
  sh.status                                   AS settlement_hold_status,
  sh.hold_until                               AS settlement_hold_until,
  sh.released_at                              AS settlement_released_at,
  bf.owner_cash_release_date,
  COALESCE(rcv.outstanding, 0)                AS owner_receivable_outstanding,
  rcv.statuses                                AS owner_receivable_statuses,

  -- ── PIMA economics (ADMIN ONLY — never projected to owner or guest) ─────
  bf.pima_gross_margin,
  bf.required_min_margin,
  bf.min_margin_rate,
  bf.projected_net_margin,
  bf.assumed_transfer_fee,
  COALESCE(led.transfer_fee, 0)               AS transfer_fee_actual,
  -- What was GRANTED (snapshot) versus what has been RECOGNISED (ledger).
  -- Promotion expense posts with the customer payment, not at booking creation,
  -- so these legitimately differ until the deposit is approved.
  COALESCE(led.promo_expense, 0)              AS promo_cost_recognised,
  COALESCE(led.points_expense, 0)             AS points_cost_recognised,
  bf.cash_shortfall,
  bf.margin_warning,
  bf.override_required,
  bf.override_by,
  bf.override_reason,
  bf.override_at,
  bf.agreement_id,
  bf.commission_rate,
  bf.pricing_basis,
  bf.pricing_quantity,

  -- ── Cancellation terms as agreed for THIS booking ───────────────────────
  bf.policy_free_cancel_days,
  bf.policy_partial_refund_days,
  bf.policy_partial_refund_pct,
  bf.policy_source,
  bf.created_at                               AS financials_created_at

FROM public.booking_financials bf
JOIN public.bookings b ON b.id = bf.booking_id
LEFT JOIN public.settlement_holds sh ON sh.booking_id = bf.booking_id

-- Ledger aggregate, by ACCOUNT. PIMA_LOYALTY_EXPENSE is deliberately absent:
-- it is programme-level (PD-17) and counting it here would charge the redeeming
-- booking twice for the same points.
LEFT JOIN LATERAL (
  SELECT
    SUM(l.amount) FILTER (WHERE l.account = 'PIMA_CASH')                  AS pima_cash,
    SUM(l.amount) FILTER (WHERE l.account = 'PIMA_POINTS_EXPENSE')        AS points_expense,
    SUM(l.amount) FILTER (WHERE l.account = 'PIMA_PROMO_EXPENSE')         AS promo_expense,
    SUM(l.amount) FILTER (WHERE l.account = 'PIMA_TRANSFER_FEE_EXPENSE')  AS transfer_fee,
    -SUM(l.amount) FILTER (WHERE l.account = 'CUSTOMER_REFUND_PAYABLE')   AS refund_payable
  FROM public.fin_transactions t
  JOIN public.fin_transaction_legs l ON l.txn_id = t.id
  WHERE t.booking_id = bf.booking_id
) led ON TRUE

-- Settled from the explicit linkage. NOT from bookings.owner_settled_at and NOT
-- from owner_payouts.booking_ids[] — both deprecated by 0144.
LEFT JOIN LATERAL (
  SELECT SUM(x.amount_applied) AS settled
  FROM public.payout_bookings x WHERE x.booking_id = bf.booking_id
) pb ON TRUE

-- Outstanding is amount less its recovery EVENTS. There is no stored balance.
LEFT JOIN LATERAL (
  SELECT SUM(r.amount - COALESCE(rec.recovered, 0)) AS outstanding,
         string_agg(DISTINCT r.status, ',')         AS statuses
  FROM public.owner_receivables r
  LEFT JOIN LATERAL (
    SELECT SUM(rr.amount) AS recovered
    FROM public.owner_receivable_recoveries rr WHERE rr.receivable_id = r.id
  ) rec ON TRUE
  WHERE r.booking_id = bf.booking_id
) rcv ON TRUE;


-- ═══ ROLE PROJECTIONS ═══════════════════════════════════════════════════════

-- CUSTOMER: their own booking, and nothing about PIMA's position or the owner's.
CREATE OR REPLACE VIEW public.fin_booking_summary_customer AS
SELECT booking_id, house_id, currency, check_in, check_out, booking_status, guests_count,
       retail_price, promo_discount, points_discount, points_redeemed, final_price,
       deposit_amount, pima_cash_received AS deposit_received, deposit_remaining,
       arrival_balance_external, refund_payable,
       policy_free_cancel_days, policy_partial_refund_days, policy_partial_refund_pct
FROM public.fin_booking_summary
WHERE guest_user_id = auth.uid();

-- OWNER: their own houses. Entitlement and settlement, never PIMA's margin,
-- shortfall, override or projected net position.
CREATE OR REPLACE VIEW public.fin_booking_summary_owner AS
SELECT booking_id, house_id, currency, check_in, check_out, booking_status, guests_count,
       final_price,
       owner_entitlement, owner_cash_held, owner_settled_amount, owner_cash_payable,
       owner_receivable_outstanding, owner_receivable_statuses,
       settlement_hold_status, settlement_hold_until, settlement_released_at,
       owner_cash_release_date, arrival_balance_external,
       policy_free_cancel_days, policy_partial_refund_days, policy_partial_refund_pct
FROM public.fin_booking_summary
WHERE owner_id = auth.uid();

-- ADMIN: everything.
CREATE OR REPLACE VIEW public.fin_booking_summary_admin AS
SELECT * FROM public.fin_booking_summary
WHERE public.is_admin(auth.uid());


-- ═══ PRIVILEGES ═════════════════════════════════════════════════════════════
-- Migration 0097 grants SELECT on ALL TABLES (views included) to anon and
-- authenticated, with default privileges repeating it. The base view must be
-- taken back or it would expose PIMA's margin to every visitor.
REVOKE ALL ON public.fin_booking_summary          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.fin_booking_summary_customer FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.fin_booking_summary_owner    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.fin_booking_summary_admin    FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.fin_booking_summary_customer TO authenticated;
GRANT SELECT ON public.fin_booking_summary_owner    TO authenticated;
GRANT SELECT ON public.fin_booking_summary_admin    TO authenticated;
-- The base view is granted to nobody. Anonymous gets nothing at all.


-- ═══ DOCUMENTATION ══════════════════════════════════════════════════════════
COMMENT ON VIEW public.fin_booking_summary IS
  'Canonical financial read model. Derives every figure from booking_financials (agreed terms), fin_transaction_legs (money that moved), payout_bookings (settlement), settlement_holds and owner_receivables. Stores nothing and caches no balance. Revoked from all roles — read it through fin_booking_summary_customer / _owner / _admin, which carry the row filter and the column set each persona may see.';

COMMENT ON VIEW public.fin_booking_summary_customer IS
  'A guest''s own bookings. Price, discounts, deposit, what PIMA has received, and the arrival balance they owe the house directly. No owner or PIMA figures.';
COMMENT ON VIEW public.fin_booking_summary_owner IS
  'An owner''s own bookings. Entitlement, what PIMA holds, what has been settled and what remains payable, plus receivables and hold state. Never PIMA''s margin, shortfall, override or projected net position.';
COMMENT ON VIEW public.fin_booking_summary_admin IS
  'Every field, for administrators only.';

COMMENT ON COLUMN public.fin_booking_summary.arrival_balance_external IS
  'PD-04: final_price minus deposit_amount, paid by the guest DIRECTLY to the house. Never PIMA cash, receivable, revenue or collection, and never summed into a PIMA total.';
COMMENT ON COLUMN public.fin_booking_summary.owner_cash_payable IS
  'What PIMA still owes this owner for this booking: the settlement hold less what payout_bookings shows already applied. Derived from the HOLD, not from entitlement — entitlement includes the arrival balance PIMA never handles. Any outstanding receivable is netted at owner level, not here, or it would be deducted once per booking.';
COMMENT ON COLUMN public.fin_booking_summary.points_cost_recognised IS
  'PIMA_POINTS_EXPENSE for this booking. PIMA_LOYALTY_EXPENSE is deliberately excluded: it is the programme-level accrual at EARNING (PD-17), and including it would charge the redeeming booking twice.';
COMMENT ON COLUMN public.fin_booking_summary.promo_cost_recognised IS
  'PIMA_PROMO_EXPENSE posted to the ledger. Promotion expense is recognised with the customer payment, not at booking creation, so this is legitimately zero until the deposit is approved — promo_discount carries what was granted.';
