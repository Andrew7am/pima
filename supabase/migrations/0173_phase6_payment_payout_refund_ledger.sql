-- 0173_phase6_payment_payout_refund_ledger.sql
--
-- PHASE 6, STEP 2B. EVERY MOVEMENT OF A CUSTOMER'S DEPOSIT, POSTED.
--
-- WHAT THIS DOES
-- --------------
-- Until now the ledger (0141) held exactly one kind of entry: the points
-- accrual. Customer deposits, owner payouts, transfer fees and refunds were all
-- real money movements with no double-entry record. This migration adds the
-- server-side primitives that post each of them, and closes the client paths
-- that could move money without the ledger seeing it.
--
--   customer pays deposit  ─► payments row approved ─► fin_post_payment_received
--                                                      (trigger on approval)
--   PIMA pays owner        ─► fin_create_owner_payout / fin_complete_payout_request
--                             ─► owner_payouts ─► payout_bookings ─► ledger
--   customer cancels       ─► booking_cancellations (the customer, and only them)
--   PIMA refunds customer  ─► fin_post_refund ─► refund_events ─► ledger
--                             ─► OWNER_RECEIVABLE when the owner was already paid
--   owner repays PIMA      ─► fin_recover_owner_receivable
--
-- THE LOCKED BUSINESS RULES THIS IMPLEMENTS
-- -----------------------------------------
--   D = booking_financials.deposit_amount           (the 30% deposit, PIMA cash)
--   H = settlement_holds.hold_amount                (owner's share of D)
--       = GREATEST(0, owner_entitlement - (final_price - deposit_amount))
--   PIMA's share of D = D - H
--   The 70% arrival balance never enters PIMA_CASH.
--
--   PAYMENT (cumulative, so a fully paid deposit lands exactly on H):
--     owner_part(C) = ROUND(H * C / D, 2)          C = cumulative cash received
--     promo and points consideration: the same proportional rule
--     PIMA_REVENUE  = the plug (the chart designates it the rounding plug)
--
--   REFUND (cumulative, one side computed, the other the remainder):
--     Hc              = H - cash_shortfall          the owner's share of the
--                                                   CUSTOMER deposit (= LEAST(H, D))
--     owner_refund(R) = ROUND(R * Hc / D, 2)       R = cumulative refund
--     pima_refund     = R - owner_refund(R)        never negative
--   On an ordinary booking Hc = H and this is exactly the locked rule. On a
--   cash-shortfall booking the excess H - D is PIMA working capital: no
--   customer paid it, so no customer refund reverses it and the owner is never
--   charged for it.
--
--   OWNER ADVANCE: allowed as soon as customer cash is received. Before
--   hold_until it is capped at the owner's cash-backed share; from hold_until
--   on the existing hold-based behaviour applies unchanged.
--
--   CANCELLATION: only the customer. Refund percentage comes from the
--   booking's own policy snapshot, measured from the moment the customer
--   cancelled.
--
-- THE ONE PROTECTED OBJECT THAT CHANGES
-- -------------------------------------
-- payout_bookings_validate (0144). Its PD-13a date gate refused every owner
-- payment before hold_until. The approved change replaces THAT BLOCK ONLY with
-- a cash-backed ceiling. The FOR UPDATE lock, the owner/house/currency
-- identity rules, the cancelled-hold refusal, the payout-must-be-completed rule
-- and the hold_amount over-application ceiling are carried over verbatim, and
-- section 12 proves each is still present.
--
-- WHAT IS DELIBERATELY NOT CHANGED
-- --------------------------------
--   * No pricing function, no booking_financials row or column, no agreement,
--     no deposit rate, no transfer-fee formula. Section 12 hashes the Financial
--     Core function bodies before and after.
--   * settlement_holds, owner_receivables and owner_receivable_recoveries keep
--     every trigger and constraint they had.
--   * No existing row is written. No historical payment is posted: a payment is
--     posted when it is APPROVED, and this migration approves nothing.
--   * No ledger account is added. The chart of 0141 is used as it stands.
--
-- CASES THAT ARE REFUSED RATHER THAN GUESSED
-- ------------------------------------------
--   * A cash-at-house deposit (payment_method = 'cash', written by
--     record_cash_deposit) is money the OWNER received. It never enters
--     PIMA_CASH and is not posted. Nor can PIMA refund it.
--   * A booking with no booking_financials snapshot (the three bookings that
--     predate the Financial Core) cannot be posted: there are no terms to post
--     against. Approval of such a payment still succeeds; the posting reports
--     NO_FINANCIAL_SNAPSHOT.
--
-- Depends on 0172 (owner_payouts evidence columns, admin INSERT policy
-- dropped). Idempotent: CREATE ... IF NOT EXISTS, CREATE OR REPLACE,
-- DROP ... IF EXISTS before CREATE, and REVOKE/GRANT.

-- ===========================================================================
-- 1. PRECONDITIONS AND BASELINE
-- ===========================================================================

DO $pre$
DECLARE
  v_missing TEXT := '';
  v_src     TEXT;
BEGIN
  -- 0172 must already be in place.
  IF (SELECT count(*) FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'owner_payouts'
         AND column_name IN ('paid_from_account', 'transaction_reference', 'completed_by')) <> 3 THEN
    v_missing := v_missing || E'\n  - 0172 has not been applied: owner_payouts lacks its evidence columns';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
              AND tablename = 'owner_payouts' AND policyname = 'owner_payouts_insert_admin') THEN
    v_missing := v_missing || E'\n  - 0172 has not been applied: owner_payouts_insert_admin still exists';
  END IF;

  IF to_regclass('public.fin_transactions') IS NULL
     OR to_regclass('public.fin_transaction_legs') IS NULL
     OR to_regclass('public.booking_financials') IS NULL
     OR to_regclass('public.settlement_holds') IS NULL
     OR to_regclass('public.payout_bookings') IS NULL
     OR to_regclass('public.owner_receivables') IS NULL
     OR to_regclass('public.owner_receivable_recoveries') IS NULL
     OR to_regclass('public.payments') IS NULL
     OR to_regclass('public.bookings') IS NULL
     OR to_regclass('public.financial_settings') IS NULL THEN
    v_missing := v_missing || E'\n  - a Financial Core table is missing';
  END IF;

  IF to_regprocedure('public.fin_transfer_fee(numeric)') IS NULL
     OR to_regprocedure('public.is_admin(uuid)') IS NULL
     OR to_regprocedure('public.payout_bookings_validate()') IS NULL
     OR to_regprocedure('public.record_refund(text,numeric,text,text)') IS NULL THEN
    v_missing := v_missing || E'\n  - a function this migration builds on is missing';
  END IF;

  -- Every account the journals below use must exist.
  IF (SELECT count(*) FROM public.fin_accounts
       WHERE code IN ('PIMA_CASH', 'OWNER_PAYABLE', 'OWNER_RECEIVABLE', 'CUSTOMER_REFUND_PAYABLE',
                      'PIMA_REVENUE', 'PIMA_TRANSFER_FEE_EXPENSE', 'PIMA_PROMO_EXPENSE',
                      'POINTS_APPLIED') AND active) <> 8 THEN
    v_missing := v_missing || E'\n  - a ledger account used by the journals is missing or inactive';
  END IF;

  -- The function being amended must be the one this file was written against:
  -- either the 0144 original, or this migration's own version on a re-run.
  SELECT p.prosrc INTO v_src FROM pg_proc p
   WHERE p.oid = to_regprocedure('public.payout_bookings_validate()');
  IF v_src NOT LIKE '%PAYOUT_HOLD_NOT_RELEASABLE%' AND v_src NOT LIKE '%PAYOUT_EXCEEDS_RECEIVED%' THEN
    v_missing := v_missing || E'\n  - payout_bookings_validate is neither the 0144 version nor the 0173 version';
  END IF;

  IF v_missing <> '' THEN
    RAISE EXCEPTION '0173 PRECONDITIONS NOT MET:%', v_missing;
  END IF;
END;
$pre$;

CREATE TEMP TABLE _0173_baseline AS
SELECT
  (SELECT md5(string_agg(p.proname || ':' || p.prosrc, '|' ORDER BY p.proname, p.oid))
     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('fin_price_booking', 'fin_quote_booking', 'fin_listed_price',
                        'create_booking_with_financials',
                        'create_booking_on_behalf_with_financials',
                        'fin_house_customer_rates', 'fin_client_settings', 'fin_transfer_fee',
                        'settlement_holds_populate', 'settlement_holds_guard',
                        'owner_receivables_validate', 'owner_receivables_guard',
                        'owner_receivable_recoveries_validate', 'owner_receivables_restate',
                        'fin_assert_balanced', 'fin_append_only', 'fin_assert_reversal_scope',
                        'protect_payment_write', 'stamp_payment_review',
                        'protect_booking_privileged_columns')) AS core_sig,
  (SELECT count(*) FROM public.fin_transactions)      AS n_txns,
  (SELECT count(*) FROM public.fin_transaction_legs)  AS n_legs,
  (SELECT count(*) FROM public.payments)              AS n_payments,
  (SELECT count(*) FROM public.owner_payouts)         AS n_payouts,
  (SELECT count(*) FROM public.booking_financials)    AS n_financials,
  (SELECT count(*) FROM public.settlement_holds)      AS n_holds;

-- ===========================================================================
-- 2. NEW APPEND-ONLY RECORDS
-- ===========================================================================
--
-- booking_cancellations: WHEN and BY WHOM a booking was cancelled. bookings has
-- no cancellation timestamp, and a refund percentage depends on how many days
-- before check-in the customer cancelled — not on when an admin later got
-- round to refunding. Written by trigger, for Financial Core bookings only
-- (those are already undeletable through booking_financials' RESTRICT, so the
-- new RESTRICT below takes nothing away from anyone).

CREATE TABLE IF NOT EXISTS public.booking_cancellations (
  booking_id      TEXT        PRIMARY KEY REFERENCES public.bookings(id) ON DELETE RESTRICT,
  cancelled_by    UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  previous_status TEXT        NOT NULL,
  cancelled_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- refund_events: one row per refund DECISION. The recognition is posted to the
-- ledger with it; the cash leaving PIMA is a separate event (below), because a
-- refund can be decided before it is paid, and the ledger must never claim the
-- customer was paid when they were not.
CREATE TABLE IF NOT EXISTS public.refund_events (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key      TEXT          NOT NULL UNIQUE,
  booking_id           TEXT          NOT NULL REFERENCES public.settlement_holds(booking_id) ON DELETE RESTRICT,
  payment_id           TEXT          NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT,
  amount               NUMERIC(12,2) NOT NULL,
  owner_share          NUMERIC(12,2) NOT NULL,
  pima_share           NUMERIC(12,2) NOT NULL,
  cumulative_refund    NUMERIC(12,2) NOT NULL,
  refundable_at_event  NUMERIC(12,2) NOT NULL,
  refund_pct           NUMERIC(6,4)  NOT NULL,
  days_before_check_in INTEGER       NOT NULL,
  cancelled_at         TIMESTAMPTZ   NOT NULL,
  recognised_txn_id    UUID          NOT NULL UNIQUE REFERENCES public.fin_transactions(id) ON DELETE RESTRICT,
  receivable_id        UUID          REFERENCES public.owner_receivables(id) ON DELETE RESTRICT,
  note                 TEXT,
  created_by           UUID          REFERENCES public.users(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT re_amount_positive    CHECK (amount > 0),
  CONSTRAINT re_shares_non_negative CHECK (owner_share >= 0 AND pima_share >= 0),
  CONSTRAINT re_shares_sum         CHECK (owner_share + pima_share = amount),
  CONSTRAINT re_within_refundable  CHECK (cumulative_refund <= refundable_at_event),
  CONSTRAINT re_pct_range          CHECK (refund_pct >= 0 AND refund_pct <= 1)
);
CREATE INDEX IF NOT EXISTS refund_events_booking_idx ON public.refund_events (booking_id);
CREATE INDEX IF NOT EXISTS refund_events_payment_idx ON public.refund_events (payment_id);

-- refund_event_payments: the refund actually leaving PIMA. At most one per
-- decision, for the decision's full amount.
CREATE TABLE IF NOT EXISTS public.refund_event_payments (
  refund_event_id UUID        PRIMARY KEY REFERENCES public.refund_events(id) ON DELETE RESTRICT,
  txn_id          UUID        NOT NULL UNIQUE REFERENCES public.fin_transactions(id) ON DELETE RESTRICT,
  method          TEXT,
  reference       TEXT,
  paid_by         UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  paid_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.fin_records_append_only()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  RAISE EXCEPTION
    'FIN_RECORD_APPEND_ONLY: % on %.% is refused — a recorded financial event is never edited or removed',
    TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME;
END;
$$;

DROP TRIGGER IF EXISTS booking_cancellations_append_only ON public.booking_cancellations;
CREATE TRIGGER booking_cancellations_append_only
  BEFORE UPDATE OR DELETE ON public.booking_cancellations
  FOR EACH ROW EXECUTE FUNCTION public.fin_records_append_only();

DROP TRIGGER IF EXISTS refund_events_append_only ON public.refund_events;
CREATE TRIGGER refund_events_append_only
  BEFORE UPDATE OR DELETE ON public.refund_events
  FOR EACH ROW EXECUTE FUNCTION public.fin_records_append_only();

DROP TRIGGER IF EXISTS refund_event_payments_append_only ON public.refund_event_payments;
CREATE TRIGGER refund_event_payments_append_only
  BEFORE UPDATE OR DELETE ON public.refund_event_payments
  FOR EACH ROW EXECUTE FUNCTION public.fin_records_append_only();

ALTER TABLE public.booking_cancellations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refund_events          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refund_event_payments  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS booking_cancellations_read ON public.booking_cancellations;
CREATE POLICY booking_cancellations_read ON public.booking_cancellations
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR cancelled_by = auth.uid());

DROP POLICY IF EXISTS refund_events_admin_read ON public.refund_events;
CREATE POLICY refund_events_admin_read ON public.refund_events
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS refund_event_payments_admin_read ON public.refund_event_payments;
CREATE POLICY refund_event_payments_admin_read ON public.refund_event_payments
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- Read-only to signed-in users (through the policies above), nothing to anon.
-- Every write goes through a SECURITY DEFINER function or trigger.
REVOKE ALL ON TABLE public.booking_cancellations, public.refund_events, public.refund_event_payments
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.booking_cancellations, public.refund_events, public.refund_event_payments
  TO authenticated;

-- ===========================================================================
-- 3. WHAT THE LEDGER SAYS ABOUT ONE BOOKING
-- ===========================================================================
--
-- Everything below derives the owner's and PIMA's position from the ledger, not
-- from a client figure. A reversal counts as the type of the entry it reverses.

CREATE OR REPLACE FUNCTION public.fin_booking_position(p_booking_id TEXT)
RETURNS TABLE (
  cash_received         NUMERIC,   -- PIMA_CASH debited by customer payments
  refunds_recognised    NUMERIC,   -- refunds decided (CUSTOMER_REFUND_PAYABLE credited)
  owner_allocated       NUMERIC,   -- OWNER_PAYABLE credited by customer payments
  owner_refund_charged  NUMERIC,   -- OWNER_PAYABLE debited by refunds
  owner_payable_balance NUMERIC,   -- what PIMA owes the owner on this booking right now
  payouts_applied       NUMERIC    -- SUM(payout_bookings.amount_applied)
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH tx AS (
    SELECT t.id,
           CASE WHEN t.txn_type = 'reversal' THEN o.txn_type      ELSE t.txn_type      END AS eff_type,
           CASE WHEN t.txn_type = 'reversal' THEN o.reference_type ELSE t.reference_type END AS eff_ref
      FROM public.fin_transactions t
      LEFT JOIN public.fin_transactions o ON o.id = t.reverses_txn_id
     WHERE t.booking_id = p_booking_id
  ), l AS (
    SELECT tx.eff_type, tx.eff_ref, g.account, g.amount
      FROM tx JOIN public.fin_transaction_legs g ON g.txn_id = tx.id
  )
  SELECT
    COALESCE( SUM(l.amount) FILTER (WHERE l.account = 'PIMA_CASH' AND l.eff_type = 'customer_payment'), 0),
    COALESCE(-SUM(l.amount) FILTER (WHERE l.account = 'CUSTOMER_REFUND_PAYABLE'
                                      AND l.eff_type = 'refund' AND l.eff_ref = 'refund_event'), 0),
    COALESCE(-SUM(l.amount) FILTER (WHERE l.account = 'OWNER_PAYABLE' AND l.eff_type = 'customer_payment'), 0),
    COALESCE( SUM(l.amount) FILTER (WHERE l.account = 'OWNER_PAYABLE' AND l.eff_type = 'refund'), 0),
    COALESCE(-SUM(l.amount) FILTER (WHERE l.account = 'OWNER_PAYABLE'), 0),
    (SELECT COALESCE(SUM(pb.amount_applied), 0)
       FROM public.payout_bookings pb WHERE pb.booking_id = p_booking_id)
  FROM l;
$$;

-- The owner's share that actual customer money backs: what customer payments
-- allocated to the owner, less the owner's refund contributions — and never
-- more than the customer cash PIMA still holds for the booking. The second
-- bound only bites on a cash-shortfall booking, where the owner's share
-- exceeds the deposit and the difference is PIMA working capital, released
-- from hold_until as before (BLOCKED-1).
CREATE OR REPLACE FUNCTION public.fin_owner_cash_backed(p_booking_id TEXT)
RETURNS NUMERIC
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT GREATEST(0, LEAST(p.owner_allocated - p.owner_refund_charged,
                           p.cash_received   - p.refunds_recognised))
    FROM public.fin_booking_position(p_booking_id) p;
$$;

-- What may be paid to the owner on this booking NOW. The same rule the
-- amended payout_bookings_validate enforces, plus the ledger balance, so the
-- RPC never pays more than the ledger recognises as owed.
CREATE OR REPLACE FUNCTION public.fin_owner_available(p_booking_id TEXT)
RETURNS NUMERIC
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_hold RECORD;
  v_pos  RECORD;
  v_cap  NUMERIC;
BEGIN
  SELECT hold_amount, hold_until, status INTO v_hold
    FROM public.settlement_holds WHERE booking_id = p_booking_id;
  IF NOT FOUND OR v_hold.status = 'CANCELLED' THEN
    RETURN 0;
  END IF;
  SELECT * INTO v_pos FROM public.fin_booking_position(p_booking_id);
  IF v_hold.hold_until > CURRENT_DATE THEN
    v_cap := public.fin_owner_cash_backed(p_booking_id) - v_pos.payouts_applied;
  ELSE
    v_cap := v_hold.hold_amount - v_pos.payouts_applied;
  END IF;
  RETURN GREATEST(0, LEAST(v_pos.owner_payable_balance, v_cap));
END;
$$;

-- Guards run as the calling role (so they can tell a client from a definer
-- function), which means they cannot read the ledger themselves. These two
-- answer the only questions they need, and reveal nothing but a boolean.
CREATE OR REPLACE FUNCTION public.fin_payment_is_posted(p_payment_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.fin_transactions
                  WHERE idempotency_key = 'pay:recv:' || p_payment_id);
$$;

CREATE OR REPLACE FUNCTION public.fin_booking_has_customer_money(p_booking_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.payments
                  WHERE booking_id = p_booking_id AND payment_status <> 'rejected')
      OR EXISTS (SELECT 1 FROM public.fin_transactions
                  WHERE booking_id = p_booking_id AND txn_type = 'customer_payment');
$$;

-- ===========================================================================
-- 4. THE SETTLEMENT GATE — THE ONE APPROVED CHANGE TO PROTECTED LOGIC
-- ===========================================================================
--
-- Carried over verbatim from 0144 except the block marked 0173. Before, a
-- payout before hold_until was refused outright (PD-13a). Now it is allowed
-- up to the owner's cash-backed share. From hold_until on, nothing changes.

CREATE OR REPLACE FUNCTION public.payout_bookings_validate()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  h         RECORD;
  p         RECORD;
  v_applied NUMERIC;
  v_backed  NUMERIC;
BEGIN
  -- FOR UPDATE is the whole concurrency story: it serialises every application
  -- against this booking, so two payouts cannot both read «60 applied of 100»
  -- and both write 50.
  SELECT owner_id, house_id, currency, hold_amount, hold_until, status
    INTO h
    FROM public.settlement_holds
   WHERE booking_id = NEW.booking_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'PAYOUT_NO_HOLD: booking % has no settlement hold — there is no recognised obligation to settle',
      NEW.booking_id;
  END IF;

  SELECT owner_id, house_id, status INTO p
    FROM public.owner_payouts WHERE id = NEW.payout_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYOUT_NOT_FOUND: payout % does not exist', NEW.payout_id;
  END IF;

  -- A row here asserts money was applied, so only a completed payout may carry one.
  IF p.status <> 'completed' THEN
    RAISE EXCEPTION
      'PAYOUT_NOT_COMPLETED: payout % is %, and linkage records money that has actually moved',
      NEW.payout_id, p.status;
  END IF;

  IF p.owner_id IS DISTINCT FROM h.owner_id THEN
    RAISE EXCEPTION
      'PAYOUT_OWNER_MISMATCH: payout belongs to % but booking % is owed to %',
      p.owner_id, NEW.booking_id, h.owner_id;
  END IF;

  IF p.house_id IS DISTINCT FROM h.house_id THEN
    RAISE EXCEPTION
      'PAYOUT_HOUSE_MISMATCH: payout is for house % but booking % belongs to house %',
      p.house_id, NEW.booking_id, h.house_id;
  END IF;

  IF h.status = 'CANCELLED' THEN
    RAISE EXCEPTION
      'PAYOUT_HOLD_CANCELLED: the hold on booking % was cancelled — there is nothing to settle', NEW.booking_id;
  END IF;

  -- 0173 (Phase 6). The owner is advanced their share as soon as customer cash
  -- arrives. Before hold_until the advance is capped at what that cash backs,
  -- net of refunds; a refund after an advance becomes an OWNER_RECEIVABLE.
  -- From hold_until onward the hold ceiling below applies exactly as before.
  IF h.hold_until > CURRENT_DATE THEN
    SELECT COALESCE(SUM(amount_applied), 0) INTO v_applied
      FROM public.payout_bookings WHERE booking_id = NEW.booking_id;
    v_backed := public.fin_owner_cash_backed(NEW.booking_id);
    IF v_applied + NEW.amount_applied > v_backed THEN
      RAISE EXCEPTION
        'PAYOUT_EXCEEDS_RECEIVED: booking % is held until %; customer cash backs % for the owner, % already applied, attempted %',
        NEW.booking_id, h.hold_until, v_backed, v_applied, NEW.amount_applied;
    END IF;
  END IF;

  -- Identity is read, not accepted.
  NEW.owner_id := h.owner_id;
  NEW.house_id := h.house_id;
  NEW.currency := h.currency;

  SELECT COALESCE(SUM(amount_applied), 0) INTO v_applied
    FROM public.payout_bookings WHERE booking_id = NEW.booking_id;

  IF v_applied + NEW.amount_applied > h.hold_amount THEN
    RAISE EXCEPTION
      'PAYOUT_EXCEEDS_HOLD: booking % holds %, % already applied, attempted % — the same entitlement cannot be settled twice',
      NEW.booking_id, h.hold_amount, v_applied, NEW.amount_applied;
  END IF;

  RETURN NEW;
END;
$function$;

-- ===========================================================================
-- 5. CUSTOMER PAYMENT → LEDGER
-- ===========================================================================
--
-- One approved payment, one customer_payment transaction, keyed
-- 'pay:recv:<payment id>' on the existing UNIQUE idempotency_key.
--
--   Dr PIMA_CASH           P                     (the cash actually received)
--   Dr PIMA_PROMO_EXPENSE  promo  x share        (PIMA-funded promotion, consumed)
--   Dr POINTS_APPLIED      points x share        (points consideration applied;
--                                                  credited at booking by the
--                                                  0166/0170 redemption entry)
--      Cr OWNER_PAYABLE       H x share          [party = owner]
--      Cr PIMA_REVENUE        the plug
--
-- "share" is cumulative: each leg is round(X * C_after / D) - round(X * C_before / D),
-- so however the deposit is split, the fully paid deposit lands exactly on H,
-- the promotion and the points, and only PIMA_REVENUE absorbs rounding — the
-- role the chart gives it. It balances by the Financial Core identity
-- D + promo + points = gross margin + H.

CREATE OR REPLACE FUNCTION public.fin_post_payment_internal(p_payment_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_key       TEXT := 'pay:recv:' || p_payment_id;
  v_pay       RECORD;
  v_bf        RECORD;
  v_hold      RECORD;
  v_booking   RECORD;
  v_existing  UUID;
  v_before    NUMERIC;
  v_after     NUMERIC;
  v_owner     NUMERIC;
  v_promo     NUMERIC;
  v_points    NUMERIC;
  v_revenue   NUMERIC;
  v_pts_party UUID;
  v_txn       UUID;
BEGIN
  -- Lock order everywhere in this migration: payments, then settlement_holds,
  -- then owner_receivables. Never the reverse.
  SELECT * INTO v_pay FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYMENT_NOT_FOUND: %', p_payment_id;
  END IF;

  SELECT id INTO v_existing FROM public.fin_transactions WHERE idempotency_key = v_key;
  IF FOUND THEN
    RETURN jsonb_build_object('status', 'ALREADY_POSTED', 'payment_id', p_payment_id, 'txn_id', v_existing);
  END IF;

  IF v_pay.payment_status <> 'approved' THEN
    RAISE EXCEPTION 'PAYMENT_NOT_APPROVED: payment % is %', p_payment_id, v_pay.payment_status;
  END IF;

  -- A cash-at-house deposit went to the owner, not to PIMA.
  IF v_pay.payment_method = 'cash' THEN
    RETURN jsonb_build_object('status', 'NOT_PIMA_CASH', 'payment_id', p_payment_id);
  END IF;

  SELECT * INTO v_bf FROM public.booking_financials WHERE booking_id = v_pay.booking_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'NO_FINANCIAL_SNAPSHOT', 'payment_id', p_payment_id,
                              'booking_id', v_pay.booking_id);
  END IF;

  SELECT status, user_id INTO v_booking FROM public.bookings WHERE id = v_pay.booking_id;
  IF v_booking.status NOT IN ('pending', 'approved', 'completed') THEN
    RAISE EXCEPTION 'PAYMENT_BOOKING_NOT_ACTIVE: booking % is % — money for it cannot be accepted as a deposit',
      v_pay.booking_id, v_booking.status;
  END IF;
  IF v_pay.user_id IS DISTINCT FROM v_booking.user_id THEN
    RAISE EXCEPTION 'PAYMENT_USER_MISMATCH: payment % was filed by %, booking % belongs to %',
      p_payment_id, v_pay.user_id, v_pay.booking_id, v_booking.user_id;
  END IF;
  IF v_pay.amount IS NULL OR v_pay.amount <= 0 THEN
    RAISE EXCEPTION 'PAYMENT_AMOUNT_INVALID: payment % has amount %', p_payment_id, v_pay.amount;
  END IF;
  IF v_bf.deposit_amount <= 0 THEN
    RAISE EXCEPTION 'DEPOSIT_NOT_POSITIVE: booking % has deposit %', v_pay.booking_id, v_bf.deposit_amount;
  END IF;

  -- Serialise every posting against this booking on its hold row.
  SELECT hold_amount INTO v_hold FROM public.settlement_holds
   WHERE booking_id = v_pay.booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYMENT_NO_HOLD: booking % has a snapshot but no settlement hold', v_pay.booking_id;
  END IF;

  SELECT cash_received INTO v_before FROM public.fin_booking_position(v_pay.booking_id);
  v_after := v_before + v_pay.amount;

  -- The 70% is paid to the owner at the door and never enters PIMA_CASH.
  IF v_after > v_bf.deposit_amount THEN
    RAISE EXCEPTION
      'PAYMENT_EXCEEDS_DEPOSIT: booking % deposit is %, % already received, this payment is % — only the deposit is paid to PIMA',
      v_pay.booking_id, v_bf.deposit_amount, v_before, v_pay.amount;
  END IF;

  v_owner  := ROUND(v_hold.hold_amount    * v_after / v_bf.deposit_amount, 2)
            - ROUND(v_hold.hold_amount    * v_before / v_bf.deposit_amount, 2);
  v_promo  := ROUND(v_bf.promo_discount  * v_after / v_bf.deposit_amount, 2)
            - ROUND(v_bf.promo_discount  * v_before / v_bf.deposit_amount, 2);
  v_points := ROUND(v_bf.points_discount * v_after / v_bf.deposit_amount, 2)
            - ROUND(v_bf.points_discount * v_before / v_bf.deposit_amount, 2);
  v_revenue := v_pay.amount + v_promo + v_points - v_owner;   -- credit when positive

  -- POINTS_APPLIED was credited, party = the booking's customer, by the
  -- booking RPC's redemption entry. The application must debit the same party,
  -- and must refuse if that entry is absent rather than open a debit balance.
  IF v_points <> 0 THEN
    SELECT g.party_id INTO v_pts_party
      FROM public.fin_transactions t
      JOIN public.fin_transaction_legs g ON g.txn_id = t.id
     WHERE t.idempotency_key = 'pts:redeem:' || v_pay.booking_id
       AND g.account = 'POINTS_APPLIED';
    IF NOT FOUND THEN
      RAISE EXCEPTION
        'POINTS_REDEMPTION_NOT_POSTED: booking % redeemed points but has no pts:redeem entry to apply against',
        v_pay.booking_id;
    END IF;
  END IF;

  v_txn := gen_random_uuid();
  INSERT INTO public.fin_transactions
    (id, txn_type, booking_id, house_id, owner_id, actor_id, currency,
     reference_type, reference_id, idempotency_key, memo)
  VALUES
    (v_txn, 'customer_payment', v_pay.booking_id, v_bf.house_id, v_bf.owner_id, auth.uid(), v_bf.currency,
     'payment', p_payment_id, v_key, 'customer deposit received');

  INSERT INTO public.fin_transaction_legs (txn_id, account, amount, party_id)
  SELECT v_txn, x.account, x.amount, x.party_id
    FROM (VALUES
      ('PIMA_CASH',           v_pay.amount, NULL::uuid),
      ('PIMA_PROMO_EXPENSE',  v_promo,      NULL::uuid),
      ('POINTS_APPLIED',      v_points,     v_pts_party),
      ('OWNER_PAYABLE',      -v_owner,      v_bf.owner_id),
      ('PIMA_REVENUE',       -v_revenue,    NULL::uuid)
    ) AS x(account, amount, party_id)
   WHERE x.amount <> 0;

  RETURN jsonb_build_object(
    'status', 'POSTED', 'payment_id', p_payment_id, 'txn_id', v_txn, 'booking_id', v_pay.booking_id,
    'cash', v_pay.amount, 'owner_payable', v_owner, 'pima_revenue', v_revenue,
    'promo_expense', v_promo, 'points_applied', v_points,
    'cumulative_cash', v_after, 'deposit', v_bf.deposit_amount);
END;
$$;

-- Admin entry point, for re-running a posting that a trigger reported. The
-- trigger below is the normal path.
CREATE OR REPLACE FUNCTION public.fin_post_payment_received(p_payment_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'NOT_ALLOWED';
  END IF;
  RETURN public.fin_post_payment_internal(p_payment_id);
END;
$$;

-- Approval IS the posting. The live admin screen approves by updating
-- payments.payment_status; this makes that single action ledger-backed with no
-- client change. If posting fails, the approval fails with it.
CREATE OR REPLACE FUNCTION public.payments_post_on_approval()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.payment_status = 'approved'
     AND (TG_OP = 'INSERT' OR OLD.payment_status IS DISTINCT FROM 'approved') THEN
    PERFORM public.fin_post_payment_internal(NEW.id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS payments_post_on_approval_trg ON public.payments;
CREATE TRIGGER payments_post_on_approval_trg
  AFTER INSERT OR UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.payments_post_on_approval();

-- ===========================================================================
-- 6. A POSTED PAYMENT CANNOT MOVE BEHIND THE LEDGER
-- ===========================================================================
--
-- Runs as the caller. Client roles (authenticated, anon) are held to it;
-- SECURITY DEFINER functions (current_user = owner) are not, because they are
-- the authoritative path.
--
--   * refunded_* columns: server-only, always. The refund flow maintains them.
--   * once posted: amount, booking_id, user_id and payment_method are fixed,
--     and the payment cannot leave 'approved'. The approved -> pending/rejected
--     action the admin screen offers is refused, not silently reversed.

CREATE OR REPLACE FUNCTION public.payments_ledger_guard()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF NEW.refunded_amount IS DISTINCT FROM OLD.refunded_amount
     OR NEW.refunded_at   IS DISTINCT FROM OLD.refunded_at
     OR NEW.refunded_by   IS DISTINCT FROM OLD.refunded_by
     OR NEW.refund_method IS DISTINCT FROM OLD.refund_method
     OR NEW.refund_note   IS DISTINCT FROM OLD.refund_note THEN
    RAISE EXCEPTION
      'REFUND_COLUMNS_SERVER_ONLY: payment % — refunds are recorded through fin_post_refund / record_refund', OLD.id;
  END IF;

  IF public.fin_payment_is_posted(OLD.id) THEN
    IF NEW.amount         IS DISTINCT FROM OLD.amount
       OR NEW.booking_id     IS DISTINCT FROM OLD.booking_id
       OR NEW.user_id        IS DISTINCT FROM OLD.user_id
       OR NEW.payment_method IS DISTINCT FROM OLD.payment_method THEN
      RAISE EXCEPTION
        'PAYMENT_POSTED_IMMUTABLE: payment % is in the ledger; its amount, booking, payer and method are fixed', OLD.id;
    END IF;
    IF NEW.payment_status IS DISTINCT FROM 'approved' THEN
      RAISE EXCEPTION
        'PAYMENT_POSTED_CANNOT_UNAPPROVE: payment % is in the ledger and cannot be moved back to %', OLD.id, NEW.payment_status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pay_ledger_guard ON public.payments;
CREATE TRIGGER pay_ledger_guard
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.payments_ledger_guard();

-- ===========================================================================
-- 7. CANCELLATION: THE CUSTOMER, AND ONLY THE CUSTOMER
-- ===========================================================================
--
-- For client roles:
--   * -> 'cancelled' only by the booking's own customer (auth.uid() = user_id).
--     An owner who recorded a walk-in under their own account is its customer
--     of record and may cancel it; nobody else's booking.
--   * -> 'rejected' only from 'pending', and only while no customer money
--     exists for the booking (no non-rejected payment, no posted receipt). An
--     owner declining an unpaid REQUEST is not a cancellation; rejecting a
--     booking the customer has paid for would be one.
--   * leaving 'cancelled' is refused: a refund may already rest on it.
-- The existing guest guard (protect_booking_privileged_columns) is unchanged
-- and runs first.

CREATE OR REPLACE FUNCTION public.bookings_cancellation_guard()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'cancelled' THEN
    RAISE EXCEPTION 'BOOKING_CANCELLATION_FINAL: booking % was cancelled by its customer and cannot be reopened', OLD.id;
  END IF;

  IF NEW.status = 'cancelled' THEN
    IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION
        'BOOKING_CANCEL_CUSTOMER_ONLY: only the customer can cancel booking % — the owner or PIMA may ask them to', OLD.id;
    END IF;
  ELSIF NEW.status = 'rejected' THEN
    IF OLD.status <> 'pending' THEN
      RAISE EXCEPTION
        'BOOKING_REJECT_ONLY_PENDING: booking % is %; only a pending request can be declined', OLD.id, OLD.status;
    END IF;
    IF public.fin_booking_has_customer_money(OLD.id) THEN
      RAISE EXCEPTION
        'BOOKING_REJECT_AFTER_PAYMENT: booking % already has customer money against it; only the customer can cancel it', OLD.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bookings_cancellation_guard_trg ON public.bookings;
CREATE TRIGGER bookings_cancellation_guard_trg
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.bookings_cancellation_guard();

CREATE OR REPLACE FUNCTION public.bookings_record_cancellation()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled'
     AND EXISTS (SELECT 1 FROM public.booking_financials WHERE booking_id = NEW.id) THEN
    INSERT INTO public.booking_cancellations (booking_id, cancelled_by, previous_status)
    VALUES (NEW.id, auth.uid(), OLD.status)
    ON CONFLICT (booking_id) DO NOTHING;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS bookings_record_cancellation_trg ON public.bookings;
CREATE TRIGGER bookings_record_cancellation_trg
  AFTER UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.bookings_record_cancellation();

-- ===========================================================================
-- 8. OWNER RECEIVABLE: CREATION AND RECOVERY
-- ===========================================================================
--
-- A refund charges the owner's contribution to OWNER_PAYABLE. If the owner had
-- already been paid, that leaves the booking's OWNER_PAYABLE in DEBIT: the owner
-- holds money that is now PIMA's. That debit, and only that, is reclassified:
--
--   Dr OWNER_RECEIVABLE  x  [party = owner]
--      Cr OWNER_PAYABLE    x  [party = owner]      (txn_type owner_receivable)
--
-- It is never PIMA's own refund share (that went to PIMA_REVENUE) and never a
-- cash shortfall (a shortfall is a CREDIT balance PIMA owes, not a debit). The
-- existing owner_receivables_validate still caps the receivable at what was
-- actually paid out on the booking.

CREATE OR REPLACE FUNCTION public.fin_create_owner_receivable_internal(
  p_booking_id TEXT, p_reason TEXT, p_idempotency_key TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_hold     RECORD;
  v_existing UUID;
  v_balance  NUMERIC;
  v_amount   NUMERIC;
  v_txn      UUID;
  v_id       UUID;
  v_thresh   NUMERIC;
BEGIN
  SELECT r.id INTO v_existing
    FROM public.owner_receivables r
    JOIN public.fin_transactions t ON t.id = r.created_txn_id
   WHERE t.idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN v_existing;
  END IF;

  SELECT owner_id, house_id, currency INTO v_hold
    FROM public.settlement_holds WHERE booking_id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'RECEIVABLE_NO_HOLD: booking % has no settlement hold', p_booking_id;
  END IF;

  SELECT owner_payable_balance INTO v_balance FROM public.fin_booking_position(p_booking_id);
  IF v_balance >= 0 THEN
    RETURN NULL;   -- the owner holds nothing that is PIMA's
  END IF;
  v_amount := -v_balance;

  SELECT receivable_threshold INTO v_thresh FROM public.financial_settings
   WHERE effective_to IS NULL ORDER BY effective_from DESC LIMIT 1;

  v_txn := gen_random_uuid();
  v_id  := gen_random_uuid();
  INSERT INTO public.fin_transactions
    (id, txn_type, booking_id, house_id, owner_id, actor_id, currency,
     reference_type, reference_id, idempotency_key, memo)
  VALUES
    (v_txn, 'owner_receivable', p_booking_id, v_hold.house_id, v_hold.owner_id, auth.uid(), v_hold.currency,
     'owner_receivable', v_id::text, p_idempotency_key, 'owner already paid; refund contribution owed back');
  INSERT INTO public.fin_transaction_legs (txn_id, account, amount, party_id) VALUES
    (v_txn, 'OWNER_RECEIVABLE',  v_amount, v_hold.owner_id),
    (v_txn, 'OWNER_PAYABLE',    -v_amount, v_hold.owner_id);

  -- owner, house and currency are overwritten from the hold by
  -- owner_receivables_validate; they are passed only to satisfy NOT NULL.
  INSERT INTO public.owner_receivables
    (id, booking_id, owner_id, house_id, currency, amount, reason,
     created_txn_id, threshold_at_creation, created_by)
  VALUES
    (v_id, p_booking_id, v_hold.owner_id, v_hold.house_id, v_hold.currency, v_amount,
     COALESCE(NULLIF(btrim(p_reason), ''), 'refund after owner payout'),
     v_txn, COALESCE(v_thresh, 0), auth.uid());

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.fin_create_owner_receivable(
  p_booking_id TEXT, p_idempotency_key TEXT, p_reason TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_id UUID;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'NOT_ALLOWED';
  END IF;
  IF p_idempotency_key IS NULL OR btrim(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'IDEMPOTENCY_KEY_REQUIRED';
  END IF;
  v_id := public.fin_create_owner_receivable_internal(p_booking_id, p_reason, 'recv:' || p_idempotency_key);
  RETURN jsonb_build_object('booking_id', p_booking_id, 'receivable_id', v_id);
END;
$$;

-- Recovery journal, both methods:
--   Dr PIMA_CASH         z
--      Cr OWNER_RECEIVABLE  z   [party = owner]      (txn_type owner_receivable)
-- EXPLICIT_REPAYMENT: the owner paid PIMA z.
-- SETTLEMENT_DEDUCTION: z was withheld from a payout being made in the SAME
--   transaction — that payout's owner_payout legs credit PIMA_CASH gross, this
--   debits back z, and the net is exactly the cash that left. It is therefore
--   only created from inside fin_create_owner_payout.
CREATE OR REPLACE FUNCTION public.fin_recover_owner_receivable_internal(
  p_receivable_id UUID, p_amount NUMERIC, p_method TEXT, p_payout_id TEXT, p_idempotency_key TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_existing UUID;
  v_recv     RECORD;
  v_payout   RECORD;
  v_txn      UUID;
  v_id       UUID;
BEGIN
  SELECT rr.id INTO v_existing
    FROM public.owner_receivable_recoveries rr
    JOIN public.fin_transactions t ON t.id = rr.txn_id
   WHERE t.idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN v_existing;
  END IF;

  IF p_method NOT IN ('SETTLEMENT_DEDUCTION', 'EXPLICIT_REPAYMENT') THEN
    RAISE EXCEPTION 'RECOVERY_METHOD_INVALID: %', p_method;
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'RECOVERY_AMOUNT_INVALID: %', p_amount;
  END IF;

  SELECT * INTO v_recv FROM public.owner_receivables WHERE id = p_receivable_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'RECOVERY_NO_RECEIVABLE: receivable % does not exist', p_receivable_id;
  END IF;

  IF p_method = 'SETTLEMENT_DEDUCTION' THEN
    SELECT owner_id, status INTO v_payout FROM public.owner_payouts WHERE id = p_payout_id;
    IF NOT FOUND OR v_payout.status <> 'completed' OR v_payout.owner_id IS DISTINCT FROM v_recv.owner_id THEN
      RAISE EXCEPTION 'RECOVERY_PAYOUT_INVALID: payout % is not a completed payout to this owner', p_payout_id;
    END IF;
  END IF;

  v_txn := gen_random_uuid();
  v_id  := gen_random_uuid();
  INSERT INTO public.fin_transactions
    (id, txn_type, booking_id, house_id, owner_id, actor_id, currency,
     reference_type, reference_id, idempotency_key, memo)
  VALUES
    (v_txn, 'owner_receivable', v_recv.booking_id, v_recv.house_id, v_recv.owner_id, auth.uid(), v_recv.currency,
     'owner_receivable_recovery', v_id::text, p_idempotency_key, lower(p_method));
  INSERT INTO public.fin_transaction_legs (txn_id, account, amount, party_id) VALUES
    (v_txn, 'PIMA_CASH',         p_amount, NULL),
    (v_txn, 'OWNER_RECEIVABLE', -p_amount, v_recv.owner_id);

  -- owner_receivable_recoveries_validate caps it at what is outstanding, with
  -- the receivable locked; owner_receivables_restate moves the status.
  INSERT INTO public.owner_receivable_recoveries
    (id, receivable_id, amount, currency, method, payout_id, txn_id, created_by)
  VALUES
    (v_id, p_receivable_id, p_amount, v_recv.currency, p_method,
     CASE WHEN p_method = 'SETTLEMENT_DEDUCTION' THEN p_payout_id END, v_txn, auth.uid());

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.fin_recover_owner_receivable(
  p_receivable_id UUID, p_amount NUMERIC, p_method TEXT, p_idempotency_key TEXT,
  p_payout_id TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_id UUID;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'NOT_ALLOWED';
  END IF;
  IF p_idempotency_key IS NULL OR btrim(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'IDEMPOTENCY_KEY_REQUIRED';
  END IF;
  IF p_method = 'SETTLEMENT_DEDUCTION' THEN
    RAISE EXCEPTION
      'RECOVERY_DEDUCTION_ONLY_WITHIN_PAYOUT: a settlement deduction is taken while a payout is made — use fin_create_owner_payout(..., p_deduct_receivables => true)';
  END IF;
  v_id := public.fin_recover_owner_receivable_internal(
            p_receivable_id, p_amount, p_method, NULL, 'recover:' || p_idempotency_key);
  RETURN jsonb_build_object('receivable_id', p_receivable_id, 'recovery_id', v_id,
    'status', (SELECT status FROM public.owner_receivables WHERE id = p_receivable_id));
END;
$$;

-- ===========================================================================
-- 9. OWNER PAYOUT
-- ===========================================================================
--
-- Per booking, one owner_payout transaction (the ledger's booking scope is one
-- booking per transaction):
--   Dr OWNER_PAYABLE  a_b  [party = owner]
--      Cr PIMA_CASH      a_b
-- Per transfer, one transfer_fee transaction on the ACTUAL amount sent:
--   Dr PIMA_TRANSFER_FEE_EXPENSE  fin_transfer_fee(net)
--      Cr PIMA_CASH                 fin_transfer_fee(net)
-- The configured cap is a booking-time projection and is not consulted here.

CREATE OR REPLACE FUNCTION public.fin_payout_post(
  p_payout_id TEXT, p_owner UUID, p_house TEXT, p_currency CHAR(3),
  p_alloc JSONB, p_net NUMERIC)
RETURNS NUMERIC
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_row  JSONB;
  v_txn  UUID;
  v_fee  NUMERIC;
  v_bid  TEXT;
  v_amt  NUMERIC;
BEGIN
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_alloc) LOOP
    v_bid := v_row->>'booking_id';
    v_amt := (v_row->>'amount')::numeric;

    -- payout_bookings_validate re-checks every rule with the hold locked.
    INSERT INTO public.payout_bookings
      (payout_id, booking_id, amount_applied, owner_id, house_id, currency, created_by)
    VALUES (p_payout_id, v_bid, v_amt, p_owner, p_house, p_currency, auth.uid());

    v_txn := gen_random_uuid();
    INSERT INTO public.fin_transactions
      (id, txn_type, booking_id, house_id, owner_id, actor_id, currency,
       reference_type, reference_id, idempotency_key, memo)
    VALUES
      (v_txn, 'owner_payout', v_bid, p_house, p_owner, auth.uid(), p_currency,
       'owner_payout', p_payout_id, 'payout:' || p_payout_id || ':' || v_bid, 'owner advance');
    INSERT INTO public.fin_transaction_legs (txn_id, account, amount, party_id) VALUES
      (v_txn, 'OWNER_PAYABLE',  v_amt, p_owner),
      (v_txn, 'PIMA_CASH',     -v_amt, NULL);
  END LOOP;

  v_fee := public.fin_transfer_fee(p_net);
  IF v_fee > 0 THEN
    v_txn := gen_random_uuid();
    INSERT INTO public.fin_transactions
      (id, txn_type, booking_id, house_id, owner_id, actor_id, currency,
       reference_type, reference_id, idempotency_key, memo)
    VALUES
      (v_txn, 'transfer_fee', NULL, p_house, p_owner, auth.uid(), p_currency,
       'owner_payout', p_payout_id, 'payout:' || p_payout_id || ':fee', 'actual transfer cost');
    INSERT INTO public.fin_transaction_legs (txn_id, account, amount, party_id) VALUES
      (v_txn, 'PIMA_TRANSFER_FEE_EXPENSE',  v_fee, NULL),
      (v_txn, 'PIMA_CASH',                 -v_fee, NULL);
  END IF;
  RETURN v_fee;
END;
$$;

CREATE OR REPLACE FUNCTION public.fin_payout_result(p_payout_id TEXT, p_replayed BOOLEAN)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT jsonb_build_object(
    'payout_id',    o.id,
    'replayed',     p_replayed,
    'owner_id',     o.owner_id,
    'house_id',     o.house_id,
    'net',          o.amount,
    'completed_at', o.completed_at,
    'gross',        (SELECT COALESCE(SUM(pb.amount_applied), 0) FROM public.payout_bookings pb WHERE pb.payout_id = o.id),
    'deducted',     (SELECT COALESCE(SUM(rr.amount), 0) FROM public.owner_receivable_recoveries rr WHERE rr.payout_id = o.id),
    'fee',          (SELECT COALESCE(SUM(g.amount), 0)
                       FROM public.fin_transactions t JOIN public.fin_transaction_legs g ON g.txn_id = t.id
                      WHERE t.idempotency_key = 'payout:' || o.id || ':fee'
                        AND g.account = 'PIMA_TRANSFER_FEE_EXPENSE'),
    'bookings',     (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                        'booking_id',    pb.booking_id,
                        'amount',        pb.amount_applied,
                        'fully_settled', (SELECT COALESCE(SUM(x.amount_applied), 0) FROM public.payout_bookings x
                                           WHERE x.booking_id = pb.booking_id) >= h.hold_amount)
                        ORDER BY pb.booking_id), '[]'::jsonb)
                       FROM public.payout_bookings pb
                       JOIN public.settlement_holds h ON h.booking_id = pb.booking_id
                      WHERE pb.payout_id = o.id))
  FROM public.owner_payouts o WHERE o.id = p_payout_id;
$$;

-- Pay the named bookings everything currently payable on each. The client
-- states the amount it is about to record as sent; the server computes its own
-- and refuses a mismatch, so the ledger can never record a transfer of a
-- different size from the one the admin actually made.
CREATE OR REPLACE FUNCTION public.fin_create_owner_payout(
  p_booking_ids           TEXT[],
  p_expected_amount       NUMERIC,
  p_transaction_reference TEXT,
  p_paid_from_account     TEXT,
  p_idempotency_key       TEXT,
  p_note                  TEXT    DEFAULT NULL,
  p_deduct_receivables    BOOLEAN DEFAULT FALSE)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor     UUID := auth.uid();
  v_payout_id TEXT;
  v_ids       TEXT[];
  v_hold      RECORD;
  v_owner     UUID;
  v_house     TEXT;
  v_currency  CHAR(3);
  v_n         INTEGER := 0;
  v_avail     NUMERIC;
  v_gross     NUMERIC := 0;
  v_alloc     JSONB := '[]'::jsonb;
  v_recv      RECORD;
  v_out       NUMERIC;
  v_take      NUMERIC;
  v_deduct    NUMERIC := 0;
  v_deducts   JSONB := '[]'::jsonb;
  v_net       NUMERIC;
  v_row       JSONB;
  v_bid       TEXT;
BEGIN
  IF NOT public.is_admin(v_actor) THEN
    RAISE EXCEPTION 'NOT_ALLOWED';
  END IF;
  IF p_idempotency_key IS NULL OR btrim(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'IDEMPOTENCY_KEY_REQUIRED';
  END IF;
  IF p_transaction_reference IS NULL OR btrim(p_transaction_reference) = '' THEN
    RAISE EXCEPTION 'TRANSACTION_REFERENCE_REQUIRED: an outgoing transfer without a reference cannot be evidenced';
  END IF;

  v_payout_id := 'payout_' || substr(md5(p_idempotency_key), 1, 24);
  IF EXISTS (SELECT 1 FROM public.owner_payouts WHERE id = v_payout_id) THEN
    RETURN public.fin_payout_result(v_payout_id, TRUE);
  END IF;

  SELECT array_agg(DISTINCT x ORDER BY x) INTO v_ids FROM unnest(p_booking_ids) x WHERE x IS NOT NULL;
  IF v_ids IS NULL OR cardinality(v_ids) = 0 THEN
    RAISE EXCEPTION 'PAYOUT_NO_BOOKINGS';
  END IF;
  IF cardinality(v_ids) <> cardinality(p_booking_ids) THEN
    RAISE EXCEPTION 'PAYOUT_DUPLICATE_BOOKINGS';
  END IF;

  -- Lock every hold, in booking order, before reading any balance.
  FOR v_hold IN
    SELECT booking_id, owner_id, house_id, currency, status
      FROM public.settlement_holds WHERE booking_id = ANY (v_ids)
     ORDER BY booking_id FOR UPDATE
  LOOP
    v_n := v_n + 1;
    IF v_owner IS NULL THEN
      v_owner := v_hold.owner_id; v_house := v_hold.house_id; v_currency := v_hold.currency;
    ELSIF v_hold.owner_id IS DISTINCT FROM v_owner THEN
      RAISE EXCEPTION 'PAYOUT_MIXED_OWNERS: one transfer pays one owner';
    ELSIF v_hold.house_id IS DISTINCT FROM v_house THEN
      RAISE EXCEPTION 'PAYOUT_MIXED_HOUSES: one transfer settles one house';
    ELSIF v_hold.currency IS DISTINCT FROM v_currency THEN
      RAISE EXCEPTION 'PAYOUT_MIXED_CURRENCIES: % and % cannot be combined', v_currency, v_hold.currency;
    END IF;
    IF v_hold.status = 'CANCELLED' THEN
      RAISE EXCEPTION 'PAYOUT_HOLD_CANCELLED: the hold on booking % was cancelled', v_hold.booking_id;
    END IF;
  END LOOP;
  IF v_n <> cardinality(v_ids) THEN
    RAISE EXCEPTION 'PAYOUT_BOOKING_NOT_SETTLEABLE: % of % bookings have a settlement hold', v_n, cardinality(v_ids);
  END IF;

  -- A concurrent call with the same key may have finished while we waited.
  IF EXISTS (SELECT 1 FROM public.owner_payouts WHERE id = v_payout_id) THEN
    RETURN public.fin_payout_result(v_payout_id, TRUE);
  END IF;

  FOREACH v_bid IN ARRAY v_ids LOOP
    v_avail := public.fin_owner_available(v_bid);
    IF v_avail <= 0 THEN
      RAISE EXCEPTION 'PAYOUT_NOTHING_PAYABLE: booking % has nothing payable to the owner now', v_bid;
    END IF;
    v_gross := v_gross + v_avail;
    v_alloc := v_alloc || jsonb_build_object('booking_id', v_bid, 'amount', v_avail);
  END LOOP;

  IF p_deduct_receivables THEN
    FOR v_recv IN
      SELECT r.id, r.amount FROM public.owner_receivables r
       WHERE r.owner_id = v_owner AND r.currency = v_currency AND r.status <> 'RECOVERED'
       ORDER BY r.created_at, r.id FOR UPDATE
    LOOP
      SELECT v_recv.amount - COALESCE(SUM(rr.amount), 0) INTO v_out
        FROM public.owner_receivable_recoveries rr WHERE rr.receivable_id = v_recv.id;
      v_take := LEAST(v_out, v_gross - v_deduct);
      IF v_take > 0 THEN
        v_deduct  := v_deduct + v_take;
        v_deducts := v_deducts || jsonb_build_object('receivable_id', v_recv.id, 'amount', v_take);
      END IF;
    END LOOP;
  END IF;

  v_net := v_gross - v_deduct;
  IF v_net <= 0 THEN
    RAISE EXCEPTION 'PAYOUT_FULLY_DEDUCTED: outstanding receivables absorb the whole % — nothing would be transferred', v_gross;
  END IF;
  IF p_expected_amount IS NULL OR ROUND(p_expected_amount, 2) <> v_net THEN
    RAISE EXCEPTION
      'PAYOUT_AMOUNT_MISMATCH: the server computes % to transfer (gross %, deducted %); the request states %',
      v_net, v_gross, v_deduct, p_expected_amount;
  END IF;

  INSERT INTO public.owner_payouts
    (id, house_id, owner_id, amount, status, note, requested_at, completed_at, booking_ids,
     transaction_reference, paid_from_account, completed_by)
  VALUES
    (v_payout_id, v_house, v_owner, v_net, 'completed', p_note, now(), now(), v_ids,
     btrim(p_transaction_reference), NULLIF(btrim(COALESCE(p_paid_from_account, '')), ''), v_actor);

  PERFORM public.fin_payout_post(v_payout_id, v_owner, v_house, v_currency, v_alloc, v_net);

  FOR v_row IN SELECT * FROM jsonb_array_elements(v_deducts) LOOP
    PERFORM public.fin_recover_owner_receivable_internal(
      (v_row->>'receivable_id')::uuid, (v_row->>'amount')::numeric, 'SETTLEMENT_DEDUCTION',
      v_payout_id, 'payout:' || v_payout_id || ':recover:' || (v_row->>'receivable_id'));
  END LOOP;

  RETURN public.fin_payout_result(v_payout_id, FALSE);
END;
$$;

-- Complete an owner's own transfer REQUEST. The request names a house and an
-- amount, never a booking, so the amount is applied to that owner's bookings
-- in that house oldest check-in first — the order the admin screen already
-- uses to net requests off (paymentLedger.unclaimedOwedBookings). The request
-- row itself becomes the completed payout; its id is the idempotency key.
CREATE OR REPLACE FUNCTION public.fin_complete_payout_request(
  p_payout_id             TEXT,
  p_transaction_reference TEXT,
  p_paid_from_account     TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor    UUID := auth.uid();
  v_req      RECORD;
  v_hold     RECORD;
  v_currency CHAR(3);
  v_left     NUMERIC;
  v_avail    NUMERIC;
  v_take     NUMERIC;
  v_alloc    JSONB := '[]'::jsonb;
  v_ids      TEXT[] := '{}';
  v_total    NUMERIC := 0;
BEGIN
  IF NOT public.is_admin(v_actor) THEN
    RAISE EXCEPTION 'NOT_ALLOWED';
  END IF;
  IF p_transaction_reference IS NULL OR btrim(p_transaction_reference) = '' THEN
    RAISE EXCEPTION 'TRANSACTION_REFERENCE_REQUIRED: an outgoing transfer without a reference cannot be evidenced';
  END IF;

  SELECT * INTO v_req FROM public.owner_payouts WHERE id = p_payout_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYOUT_NOT_FOUND: %', p_payout_id;
  END IF;
  IF v_req.status = 'completed' THEN
    RETURN public.fin_payout_result(p_payout_id, TRUE);
  END IF;
  IF v_req.status NOT IN ('pending', 'processing') THEN
    RAISE EXCEPTION 'PAYOUT_REQUEST_NOT_OPEN: request % is %', p_payout_id, v_req.status;
  END IF;

  -- Lock every candidate hold in booking order, then allocate by check-in.
  PERFORM 1 FROM public.settlement_holds
    WHERE owner_id = v_req.owner_id AND house_id = v_req.house_id
    ORDER BY booking_id FOR UPDATE;

  v_left := v_req.amount;
  FOR v_hold IN
    SELECT sh.booking_id, sh.currency
      FROM public.settlement_holds sh
      JOIN public.bookings b ON b.id = sh.booking_id
     WHERE sh.owner_id = v_req.owner_id AND sh.house_id = v_req.house_id
       AND sh.status <> 'CANCELLED'
     ORDER BY b.check_in, sh.booking_id
  LOOP
    EXIT WHEN v_left <= 0;
    v_avail := public.fin_owner_available(v_hold.booking_id);
    CONTINUE WHEN v_avail <= 0;
    IF v_currency IS NULL THEN
      v_currency := v_hold.currency;
    ELSIF v_hold.currency IS DISTINCT FROM v_currency THEN
      CONTINUE;   -- a request is in one currency; never combine
    END IF;
    v_take  := LEAST(v_avail, v_left);
    v_left  := v_left - v_take;
    v_total := v_total + v_take;
    v_ids   := v_ids || v_hold.booking_id;
    v_alloc := v_alloc || jsonb_build_object('booking_id', v_hold.booking_id, 'amount', v_take);
  END LOOP;

  IF v_left > 0 THEN
    RAISE EXCEPTION
      'PAYOUT_REQUEST_EXCEEDS_PAYABLE: request % asks for %, only % is payable to this owner for this house now',
      p_payout_id, v_req.amount, v_total;
  END IF;

  UPDATE public.owner_payouts
     SET status = 'completed', completed_at = now(), completed_by = v_actor,
         transaction_reference = btrim(p_transaction_reference),
         paid_from_account = NULLIF(btrim(COALESCE(p_paid_from_account, '')), ''),
         booking_ids = v_ids
   WHERE id = p_payout_id;

  PERFORM public.fin_payout_post(p_payout_id, v_req.owner_id, v_req.house_id, v_currency, v_alloc, v_req.amount);
  RETURN public.fin_payout_result(p_payout_id, FALSE);
END;
$$;

-- The payout row is server-controlled from here on. Client roles may still
-- file a REQUEST (status 'pending', no evidence, no bookings) and move an open
-- request to processing or rejected. Nothing else.
CREATE OR REPLACE FUNCTION public.owner_payouts_client_guard()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'pending'
       OR NEW.completed_at IS NOT NULL
       OR NEW.transaction_reference IS NOT NULL
       OR NEW.paid_from_account IS NOT NULL
       OR NEW.completed_by IS NOT NULL
       OR COALESCE(cardinality(NEW.booking_ids), 0) > 0 THEN
      RAISE EXCEPTION 'PAYOUT_CLIENT_REQUEST_ONLY: a client may only file a pending payout request';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status IN ('completed', 'rejected') THEN
    RAISE EXCEPTION 'PAYOUT_TERMINAL: payout % is % and cannot change', OLD.id, OLD.status;
  END IF;
  IF NEW.status = 'completed' THEN
    RAISE EXCEPTION
      'PAYOUT_COMPLETION_SERVER_ONLY: a payout is completed by fin_complete_payout_request or fin_create_owner_payout';
  END IF;
  IF NEW.amount                IS DISTINCT FROM OLD.amount
     OR NEW.house_id              IS DISTINCT FROM OLD.house_id
     OR NEW.owner_id              IS DISTINCT FROM OLD.owner_id
     OR NEW.booking_ids           IS DISTINCT FROM OLD.booking_ids
     OR NEW.transaction_reference IS DISTINCT FROM OLD.transaction_reference
     OR NEW.paid_from_account     IS DISTINCT FROM OLD.paid_from_account
     OR NEW.completed_by          IS DISTINCT FROM OLD.completed_by
     OR NEW.requested_at          IS DISTINCT FROM OLD.requested_at
     OR NEW.completed_at          IS NOT NULL THEN
    RAISE EXCEPTION 'PAYOUT_FIELDS_SERVER_ONLY: only the status of an open request may change';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS owner_payouts_client_guard_trg ON public.owner_payouts;
CREATE TRIGGER owner_payouts_client_guard_trg
  BEFORE INSERT OR UPDATE ON public.owner_payouts
  FOR EACH ROW EXECUTE FUNCTION public.owner_payouts_client_guard();

-- ===========================================================================
-- 10. REFUNDS
-- ===========================================================================
--
-- Recognition (txn_type refund, reference_type refund_event):
--   Dr PIMA_REVENUE             PIMA's contribution
--   Dr OWNER_PAYABLE            owner's contribution   [party = owner]
--      Cr CUSTOMER_REFUND_PAYABLE  the refund
-- Then, if that leaves OWNER_PAYABLE in debit (the owner was already paid),
-- the receivable reclassification of section 8.
--
-- Payment (txn_type refund, reference_type refund_payment), only when the
-- money has actually gone:
--   Dr CUSTOMER_REFUND_PAYABLE  the refund
--      Cr PIMA_CASH                the refund
--
-- Refundable = ROUND(cash received for the booking x pct, 2), where pct comes
-- from the booking's policy snapshot and the number of days between the
-- customer's cancellation (Africa/Cairo calendar date) and check-in:
--   days >= policy_free_cancel_days    -> 1
--   days >= policy_partial_refund_days -> policy_partial_refund_pct
--   otherwise                          -> 0

CREATE OR REPLACE FUNCTION public.fin_pay_refund_internal(
  p_refund_event_id UUID, p_idempotency_key TEXT, p_method TEXT, p_reference TEXT, p_note TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_ev   RECORD;
  v_txn  UUID;
  v_paid NUMERIC;
BEGIN
  SELECT txn_id INTO v_txn FROM public.refund_event_payments WHERE refund_event_id = p_refund_event_id;
  IF FOUND THEN
    RETURN v_txn;
  END IF;

  SELECT e.*, h.owner_id, h.house_id, h.currency INTO v_ev
    FROM public.refund_events e
    JOIN public.settlement_holds h ON h.booking_id = e.booking_id
   WHERE e.id = p_refund_event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REFUND_EVENT_NOT_FOUND: %', p_refund_event_id;
  END IF;

  v_txn := gen_random_uuid();
  INSERT INTO public.fin_transactions
    (id, txn_type, booking_id, house_id, owner_id, actor_id, currency,
     reference_type, reference_id, idempotency_key, memo)
  VALUES
    (v_txn, 'refund', v_ev.booking_id, v_ev.house_id, v_ev.owner_id, auth.uid(), v_ev.currency,
     'refund_payment', p_refund_event_id::text, p_idempotency_key, 'refund paid to customer');
  INSERT INTO public.fin_transaction_legs (txn_id, account, amount, party_id) VALUES
    (v_txn, 'CUSTOMER_REFUND_PAYABLE',  v_ev.amount, NULL),
    (v_txn, 'PIMA_CASH',               -v_ev.amount, NULL);

  INSERT INTO public.refund_event_payments (refund_event_id, txn_id, method, reference, paid_by)
  VALUES (p_refund_event_id, v_txn, NULLIF(btrim(COALESCE(p_method, '')), ''),
          NULLIF(btrim(COALESCE(p_reference, '')), ''), auth.uid());

  -- The payment row's refunded_* columns are what the live screens read. They
  -- now MIRROR the paid refund events and are written nowhere else.
  SELECT COALESCE(SUM(e.amount), 0) INTO v_paid
    FROM public.refund_events e
    JOIN public.refund_event_payments rp ON rp.refund_event_id = e.id
   WHERE e.payment_id = v_ev.payment_id;
  UPDATE public.payments
     SET refunded_amount = v_paid,
         refunded_at     = now(),
         refunded_by     = auth.uid(),
         refund_method   = COALESCE(NULLIF(btrim(COALESCE(p_method, '')), ''), refund_method),
         refund_note     = COALESCE(NULLIF(btrim(COALESCE(p_note, '')), ''), refund_note)
   WHERE id = v_ev.payment_id;

  RETURN v_txn;
END;
$$;

CREATE OR REPLACE FUNCTION public.fin_post_refund(
  p_payment_id      TEXT,
  p_amount          NUMERIC,
  p_idempotency_key TEXT,
  p_paid            BOOLEAN DEFAULT TRUE,
  p_method          TEXT    DEFAULT NULL,
  p_reference       TEXT    DEFAULT NULL,
  p_note            TEXT    DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor      UUID := auth.uid();
  v_ev         RECORD;
  v_pay        RECORD;
  v_bf         RECORD;
  v_hold       RECORD;
  v_booking    RECORD;
  v_cancel     RECORD;
  v_days       INTEGER;
  v_pct        NUMERIC;
  v_cash       NUMERIC;
  v_refundable NUMERIC;
  v_before     NUMERIC;
  v_after      NUMERIC;
  v_amount     NUMERIC;
  v_on_payment NUMERIC;
  v_owner      NUMERIC;
  v_pima       NUMERIC;
  v_event      UUID;
  v_txn        UUID;
  v_recv       UUID;
  v_balance    NUMERIC;
  v_paid_txn   UUID;
  v_owner_basis NUMERIC;
  v_pos        RECORD;
  v_pima_before NUMERIC;
BEGIN
  IF NOT public.is_admin(v_actor) THEN
    RAISE EXCEPTION 'NOT_ALLOWED';
  END IF;
  IF p_idempotency_key IS NULL OR btrim(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'IDEMPOTENCY_KEY_REQUIRED';
  END IF;

  SELECT * INTO v_ev FROM public.refund_events WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN jsonb_build_object('refund_event_id', v_ev.id, 'replayed', TRUE, 'amount', v_ev.amount,
      'owner_share', v_ev.owner_share, 'pima_share', v_ev.pima_share,
      'cumulative_refund', v_ev.cumulative_refund, 'receivable_id', v_ev.receivable_id);
  END IF;

  SELECT booking_id INTO v_pay FROM public.payments WHERE id = p_payment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYMENT_NOT_FOUND: %', p_payment_id;
  END IF;
  -- Lock every payment of the booking (payments before the hold, as everywhere).
  PERFORM 1 FROM public.payments WHERE booking_id = v_pay.booking_id ORDER BY id FOR UPDATE;
  SELECT * INTO v_pay FROM public.payments WHERE id = p_payment_id;

  -- A concurrent call with the same key may have finished while we waited.
  SELECT * INTO v_ev FROM public.refund_events WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN jsonb_build_object('refund_event_id', v_ev.id, 'replayed', TRUE, 'amount', v_ev.amount,
      'owner_share', v_ev.owner_share, 'pima_share', v_ev.pima_share,
      'cumulative_refund', v_ev.cumulative_refund, 'receivable_id', v_ev.receivable_id);
  END IF;

  IF v_pay.payment_status <> 'approved' THEN
    RAISE EXCEPTION 'PAYMENT_NOT_APPROVED: refunding money that was never accepted would invent an outflow';
  END IF;
  IF v_pay.payment_method = 'cash' THEN
    RAISE EXCEPTION 'REFUND_NOT_PIMA_CASH: payment % was received by the owner at the house; PIMA holds none of it', p_payment_id;
  END IF;
  IF NOT public.fin_payment_is_posted(p_payment_id) THEN
    RAISE EXCEPTION 'REFUND_PAYMENT_NOT_POSTED: payment % is not in the ledger, so there is nothing to refund from', p_payment_id;
  END IF;

  SELECT * INTO v_bf FROM public.booking_financials WHERE booking_id = v_pay.booking_id;
  SELECT hold_amount, owner_id, house_id, currency INTO v_hold
    FROM public.settlement_holds WHERE booking_id = v_pay.booking_id FOR UPDATE;
  SELECT status, check_in INTO v_booking FROM public.bookings WHERE id = v_pay.booking_id;

  IF v_booking.status <> 'cancelled' THEN
    RAISE EXCEPTION 'REFUND_REQUIRES_CUSTOMER_CANCELLATION: booking % is %', v_pay.booking_id, v_booking.status;
  END IF;
  SELECT * INTO v_cancel FROM public.booking_cancellations WHERE booking_id = v_pay.booking_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REFUND_NO_CANCELLATION_RECORD: booking % has no recorded customer cancellation', v_pay.booking_id;
  END IF;

  -- What a customer refund can be charged against is the CUSTOMER'S money
  -- only. The owner's share of the customer deposit is the hold less the
  -- snapshot's own cash_shortfall: on an ordinary booking that is the hold
  -- itself (H <= D); on a cash-shortfall booking it is the whole deposit, and
  -- the excess H - D (= cash_shortfall) is PIMA working capital that no
  -- customer paid, so no customer refund reverses it and the owner is never
  -- charged for it. PIMA's share of the deposit is the rest, never negative.
  v_owner_basis := v_hold.hold_amount - v_bf.cash_shortfall;
  IF v_owner_basis < 0 OR v_owner_basis > v_bf.deposit_amount THEN
    RAISE EXCEPTION
      'REFUND_SNAPSHOT_INCONSISTENT: booking % hold %, shortfall %, deposit % — the owner''s deposit share falls outside the deposit',
      v_pay.booking_id, v_hold.hold_amount, v_bf.cash_shortfall, v_bf.deposit_amount;
  END IF;

  v_days := v_booking.check_in - (v_cancel.cancelled_at AT TIME ZONE 'Africa/Cairo')::date;
  v_pct := CASE
             WHEN v_days >= v_bf.policy_free_cancel_days    THEN 1
             WHEN v_days >= v_bf.policy_partial_refund_days THEN v_bf.policy_partial_refund_pct
             ELSE 0
           END;

  SELECT cash_received INTO v_cash FROM public.fin_booking_position(v_pay.booking_id);
  v_refundable := ROUND(v_cash * v_pct, 2);
  SELECT COALESCE(SUM(amount), 0) INTO v_before FROM public.refund_events WHERE booking_id = v_pay.booking_id;

  v_amount := COALESCE(p_amount, v_refundable - v_before);
  IF v_amount IS NULL OR v_amount <= 0 THEN
    RAISE EXCEPTION 'REFUND_NOTHING_REFUNDABLE: booking % refundable %, already refunded %', v_pay.booking_id, v_refundable, v_before;
  END IF;
  IF v_amount <> ROUND(v_amount, 2) THEN
    RAISE EXCEPTION 'REFUND_AMOUNT_PRECISION: % has more than two decimals', v_amount;
  END IF;
  v_after := v_before + v_amount;
  IF v_after > v_refundable THEN
    RAISE EXCEPTION
      'REFUND_EXCEEDS_REFUNDABLE: booking % cancelled % days before check-in, policy pays %, % received so % refundable; % already refunded, % requested',
      v_pay.booking_id, v_days, v_pct, v_cash, v_refundable, v_before, v_amount;
  END IF;
  SELECT COALESCE(SUM(amount), 0) INTO v_on_payment FROM public.refund_events WHERE payment_id = p_payment_id;
  IF v_on_payment + v_amount > v_pay.amount THEN
    RAISE EXCEPTION 'REFUND_EXCEEDS_PAYMENT: payment % is %, % already refunded against it, % requested',
      p_payment_id, v_pay.amount, v_on_payment, v_amount;
  END IF;

  -- The locked split, cumulative: one side rounded, the other the remainder.
  v_owner := ROUND(v_after  * v_owner_basis / v_bf.deposit_amount, 2)
           - ROUND(v_before * v_owner_basis / v_bf.deposit_amount, 2);
  v_pima  := v_amount - v_owner;

  -- A refund reverses only what customer payments actually recognised. With
  -- the same ratio on both sides and the refund bounded by cash received this
  -- holds by construction; it is asserted anyway, because a refund that
  -- reversed more than was recognised would invent a balance.
  SELECT * INTO v_pos FROM public.fin_booking_position(v_pay.booking_id);
  SELECT COALESCE(SUM(pima_share), 0) INTO v_pima_before
    FROM public.refund_events WHERE booking_id = v_pay.booking_id;
  IF v_pos.owner_refund_charged + v_owner > v_pos.owner_allocated THEN
    RAISE EXCEPTION
      'REFUND_EXCEEDS_RECOGNISED_OWNER: booking % recognised % for the owner, % already reversed, % more requested',
      v_pay.booking_id, v_pos.owner_allocated, v_pos.owner_refund_charged, v_owner;
  END IF;
  IF v_pima_before + v_pima > GREATEST(0, v_pos.cash_received - v_pos.owner_allocated) THEN
    RAISE EXCEPTION
      'REFUND_EXCEEDS_RECOGNISED_PIMA: booking % recognised % of customer cash for PIMA, % already reversed, % more requested',
      v_pay.booking_id, GREATEST(0, v_pos.cash_received - v_pos.owner_allocated), v_pima_before, v_pima;
  END IF;

  v_event := gen_random_uuid();
  v_txn   := gen_random_uuid();
  INSERT INTO public.fin_transactions
    (id, txn_type, booking_id, house_id, owner_id, actor_id, currency,
     reference_type, reference_id, idempotency_key, memo)
  VALUES
    (v_txn, 'refund', v_pay.booking_id, v_hold.house_id, v_hold.owner_id, v_actor, v_hold.currency,
     'refund_event', v_event::text, 'refund:rec:' || p_idempotency_key, 'refund owed to customer');
  INSERT INTO public.fin_transaction_legs (txn_id, account, amount, party_id)
  SELECT v_txn, x.account, x.amount, x.party_id
    FROM (VALUES
      ('PIMA_REVENUE',             v_pima,   NULL::uuid),
      ('OWNER_PAYABLE',            v_owner,  v_hold.owner_id),
      ('CUSTOMER_REFUND_PAYABLE', -v_amount, NULL::uuid)
    ) AS x(account, amount, party_id)
   WHERE x.amount <> 0;

  -- If the owner had already been paid more than they are now owed, that
  -- excess is theirs to return.
  SELECT owner_payable_balance INTO v_balance FROM public.fin_booking_position(v_pay.booking_id);
  IF v_balance < 0 THEN
    v_recv := public.fin_create_owner_receivable_internal(
                v_pay.booking_id, 'refund ' || v_event::text, 'recv:refund:' || v_event::text);
  END IF;

  INSERT INTO public.refund_events
    (id, idempotency_key, booking_id, payment_id, amount, owner_share, pima_share,
     cumulative_refund, refundable_at_event, refund_pct, days_before_check_in, cancelled_at,
     recognised_txn_id, receivable_id, note, created_by)
  VALUES
    (v_event, p_idempotency_key, v_pay.booking_id, p_payment_id, v_amount, v_owner, v_pima,
     v_after, v_refundable, v_pct, v_days, v_cancel.cancelled_at,
     v_txn, v_recv, NULLIF(btrim(COALESCE(p_note, '')), ''), v_actor);

  IF p_paid THEN
    v_paid_txn := public.fin_pay_refund_internal(v_event, 'refund:pay:' || p_idempotency_key,
                                                 p_method, p_reference, p_note);
  END IF;

  RETURN jsonb_build_object(
    'refund_event_id', v_event, 'replayed', FALSE, 'booking_id', v_pay.booking_id,
    'amount', v_amount, 'owner_share', v_owner, 'pima_share', v_pima,
    'cumulative_refund', v_after, 'refundable', v_refundable, 'refund_pct', v_pct,
    'days_before_check_in', v_days, 'receivable_id', v_recv, 'paid', p_paid,
    'payment_txn_id', v_paid_txn);
END;
$$;

CREATE OR REPLACE FUNCTION public.fin_pay_refund(
  p_refund_event_id UUID, p_idempotency_key TEXT,
  p_method TEXT DEFAULT NULL, p_reference TEXT DEFAULT NULL, p_note TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_booking TEXT;
  v_txn     UUID;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'NOT_ALLOWED';
  END IF;
  IF p_idempotency_key IS NULL OR btrim(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'IDEMPOTENCY_KEY_REQUIRED';
  END IF;
  SELECT booking_id INTO v_booking FROM public.refund_events WHERE id = p_refund_event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REFUND_EVENT_NOT_FOUND: %', p_refund_event_id;
  END IF;
  PERFORM 1 FROM public.payments WHERE booking_id = v_booking ORDER BY id FOR UPDATE;
  v_txn := public.fin_pay_refund_internal(p_refund_event_id, 'refund:pay:' || p_idempotency_key,
                                          p_method, p_reference, p_note);
  RETURN jsonb_build_object('refund_event_id', p_refund_event_id, 'payment_txn_id', v_txn);
END;
$$;

-- record_refund keeps its signature so the live admin screen keeps working,
-- but it is no longer a bypass: it now goes through fin_post_refund. Its
-- 0114 meaning is preserved — p_amount is the TOTAL refunded against this
-- payment (0114 overwrote refunded_amount with it) — and only the increase is
-- posted, as one more append-only event. A repeat of the same total is a no-op.
CREATE OR REPLACE FUNCTION public.record_refund(
  p_payment_id TEXT, p_amount NUMERIC, p_method TEXT DEFAULT NULL, p_note TEXT DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_booking TEXT;
  v_done    NUMERIC;
  v_delta   NUMERIC;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'NOT_ALLOWED';
  END IF;
  SELECT booking_id INTO v_booking FROM public.payments WHERE id = p_payment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYMENT_NOT_FOUND';
  END IF;
  PERFORM 1 FROM public.payments WHERE booking_id = v_booking ORDER BY id FOR UPDATE;

  SELECT COALESCE(SUM(amount), 0) INTO v_done FROM public.refund_events WHERE payment_id = p_payment_id;
  v_delta := p_amount - v_done;
  IF v_delta = 0 THEN
    RETURN;
  END IF;
  IF v_delta < 0 THEN
    RAISE EXCEPTION 'REFUND_CANNOT_DECREASE: % is already refunded against payment %; a refund cannot be taken back', v_done, p_payment_id;
  END IF;
  PERFORM public.fin_post_refund(p_payment_id, v_delta, 'legacy:' || p_payment_id || ':' || p_amount::text,
                                 TRUE, p_method, NULL, p_note);
END;
$$;

-- ===========================================================================
-- 11. EXECUTE PRIVILEGES
-- ===========================================================================
--
-- CREATE FUNCTION grants EXECUTE to PUBLIC, and Supabase's default privileges
-- grant it to anon and authenticated as well. Every function above is first
-- stripped of all of that, then re-granted only where a client needs it.

REVOKE ALL ON FUNCTION
  public.fin_booking_position(text), public.fin_owner_cash_backed(text), public.fin_owner_available(text),
  public.fin_payment_is_posted(text), public.fin_booking_has_customer_money(text),
  public.fin_post_payment_internal(text), public.fin_post_payment_received(text),
  public.payments_post_on_approval(), public.payments_ledger_guard(),
  public.bookings_cancellation_guard(), public.bookings_record_cancellation(),
  public.fin_create_owner_receivable_internal(text, text, text), public.fin_create_owner_receivable(text, text, text),
  public.fin_recover_owner_receivable_internal(uuid, numeric, text, text, text),
  public.fin_recover_owner_receivable(uuid, numeric, text, text, text),
  public.fin_payout_post(text, uuid, text, character, jsonb, numeric), public.fin_payout_result(text, boolean),
  public.fin_create_owner_payout(text[], numeric, text, text, text, text, boolean),
  public.fin_complete_payout_request(text, text, text), public.owner_payouts_client_guard(),
  public.fin_pay_refund_internal(uuid, text, text, text, text),
  public.fin_post_refund(text, numeric, text, boolean, text, text, text),
  public.fin_pay_refund(uuid, text, text, text, text),
  public.record_refund(text, numeric, text, text),
  public.fin_records_append_only()
FROM PUBLIC, anon, authenticated;

-- Admin RPCs. Each checks is_admin(auth.uid()) before doing anything.
GRANT EXECUTE ON FUNCTION
  public.fin_post_payment_received(text),
  public.fin_create_owner_payout(text[], numeric, text, text, text, text, boolean),
  public.fin_complete_payout_request(text, text, text),
  public.fin_post_refund(text, numeric, text, boolean, text, text, text),
  public.fin_pay_refund(uuid, text, text, text, text),
  public.fin_create_owner_receivable(text, text, text),
  public.fin_recover_owner_receivable(uuid, numeric, text, text, text),
  public.record_refund(text, numeric, text, text)
TO authenticated;

-- Called from triggers that run as the client role; each returns a boolean.
GRANT EXECUTE ON FUNCTION
  public.fin_payment_is_posted(text), public.fin_booking_has_customer_money(text)
TO authenticated;

-- ===========================================================================
-- 12. VERIFICATION
-- ===========================================================================

DO $verify$
DECLARE
  v_fail TEXT := '';
  v_pass INTEGER := 0;
  v_t    TEXT;
  v_src  TEXT;
  n      INTEGER;
  b      _0173_baseline%ROWTYPE;
BEGIN
  SELECT * INTO b FROM _0173_baseline;

  -- == new tables ==========================================================
  FOREACH v_t IN ARRAY ARRAY['booking_cancellations', 'refund_events', 'refund_event_payments'] LOOP
    IF to_regclass('public.' || v_t) IS NULL
       OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid = ('public.' || v_t)::regclass) THEN
      v_fail := v_fail || E'\n  - ' || v_t || ' is missing or has no row-level security';
    ELSE v_pass := v_pass + 1; END IF;

    SELECT count(*) INTO n FROM pg_class c, aclexplode(c.relacl) g
     WHERE c.oid = ('public.' || v_t)::regclass
       AND (g.grantee IN (0, 'anon'::regrole)
            OR (g.grantee = 'authenticated'::regrole AND g.privilege_type <> 'SELECT'));
    IF n <> 0 THEN
      v_fail := v_fail || E'\n  - ' || v_t || ' grants a client more than SELECT';
    ELSE v_pass := v_pass + 1; END IF;

    SELECT count(*) INTO n FROM pg_trigger t
     WHERE t.tgrelid = ('public.' || v_t)::regclass AND NOT t.tgisinternal
       AND t.tgfoid = 'public.fin_records_append_only()'::regprocedure;
    IF n <> 1 THEN
      v_fail := v_fail || E'\n  - ' || v_t || ' is not append-only';
    ELSE v_pass := v_pass + 1; END IF;
  END LOOP;

  -- == the settlement gate: only the date block changed =====================
  SELECT prosrc INTO v_src FROM pg_proc WHERE oid = 'public.payout_bookings_validate()'::regprocedure;
  FOREACH v_t IN ARRAY ARRAY['FOR UPDATE', 'PAYOUT_NO_HOLD', 'PAYOUT_NOT_FOUND', 'PAYOUT_NOT_COMPLETED',
                             'PAYOUT_OWNER_MISMATCH', 'PAYOUT_HOUSE_MISMATCH', 'PAYOUT_HOLD_CANCELLED',
                             'PAYOUT_EXCEEDS_HOLD', 'NEW.owner_id := h.owner_id',
                             'NEW.house_id := h.house_id', 'NEW.currency := h.currency',
                             'PAYOUT_EXCEEDS_RECEIVED'] LOOP
    IF position(v_t IN v_src) = 0 THEN
      v_fail := v_fail || E'\n  - payout_bookings_validate lost: ' || v_t;
    ELSE v_pass := v_pass + 1; END IF;
  END LOOP;
  IF position('PAYOUT_HOLD_NOT_RELEASABLE' IN v_src) > 0 THEN
    v_fail := v_fail || E'\n  - payout_bookings_validate still refuses every payout before hold_until';
  ELSE v_pass := v_pass + 1; END IF;

  -- == RPCs exist, are SECURITY DEFINER, and reach only authenticated =======
  FOREACH v_t IN ARRAY ARRAY[
      'public.fin_post_payment_received(text)',
      'public.fin_create_owner_payout(text[],numeric,text,text,text,text,boolean)',
      'public.fin_complete_payout_request(text,text,text)',
      'public.fin_post_refund(text,numeric,text,boolean,text,text,text)',
      'public.fin_pay_refund(uuid,text,text,text,text)',
      'public.fin_create_owner_receivable(text,text,text)',
      'public.fin_recover_owner_receivable(uuid,numeric,text,text,text)',
      'public.record_refund(text,numeric,text,text)'] LOOP
    IF to_regprocedure(v_t) IS NULL
       OR NOT (SELECT prosecdef FROM pg_proc WHERE oid = to_regprocedure(v_t))
       OR NOT has_function_privilege('authenticated', to_regprocedure(v_t), 'EXECUTE')
       OR has_function_privilege('anon', to_regprocedure(v_t), 'EXECUTE') THEN
      v_fail := v_fail || E'\n  - ' || v_t || ' is missing, not SECURITY DEFINER, or wrongly granted';
    ELSE v_pass := v_pass + 1; END IF;
  END LOOP;

  -- Internal functions reach no client at all.
  FOREACH v_t IN ARRAY ARRAY[
      'public.fin_post_payment_internal(text)',
      'public.fin_create_owner_receivable_internal(text,text,text)',
      'public.fin_recover_owner_receivable_internal(uuid,numeric,text,text,text)',
      'public.fin_payout_post(text,uuid,text,character,jsonb,numeric)',
      'public.fin_pay_refund_internal(uuid,text,text,text,text)',
      'public.fin_booking_position(text)', 'public.fin_owner_available(text)'] LOOP
    IF has_function_privilege('authenticated', to_regprocedure(v_t), 'EXECUTE')
       OR has_function_privilege('anon', to_regprocedure(v_t), 'EXECUTE') THEN
      v_fail := v_fail || E'\n  - ' || v_t || ' is executable by a client role';
    ELSE v_pass := v_pass + 1; END IF;
  END LOOP;

  -- record_refund no longer writes refunded_amount itself.
  SELECT prosrc INTO v_src FROM pg_proc WHERE oid = 'public.record_refund(text,numeric,text,text)'::regprocedure;
  IF position('fin_post_refund' IN v_src) = 0 OR position('refunded_amount = p_amount' IN v_src) > 0 THEN
    v_fail := v_fail || E'\n  - record_refund is still a ledger bypass';
  ELSE v_pass := v_pass + 1; END IF;

  -- == triggers ==============================================================
  FOREACH v_t IN ARRAY ARRAY['payments:pay_ledger_guard', 'payments:payments_post_on_approval_trg',
                             'owner_payouts:owner_payouts_client_guard_trg',
                             'bookings:bookings_cancellation_guard_trg',
                             'bookings:bookings_record_cancellation_trg'] LOOP
    SELECT count(*) INTO n FROM pg_trigger t
     WHERE t.tgrelid = ('public.' || split_part(v_t, ':', 1))::regclass
       AND t.tgname = split_part(v_t, ':', 2) AND NOT t.tgisinternal AND t.tgenabled = 'O';
    IF n <> 1 THEN
      v_fail := v_fail || E'\n  - trigger missing or disabled: ' || v_t;
    ELSE v_pass := v_pass + 1; END IF;
  END LOOP;

  -- == what must not have moved ============================================
  IF b.core_sig IS DISTINCT FROM (
       SELECT md5(string_agg(p.proname || ':' || p.prosrc, '|' ORDER BY p.proname, p.oid))
         FROM pg_proc p JOIN pg_namespace n2 ON n2.oid = p.pronamespace
        WHERE n2.nspname = 'public'
          AND p.proname IN ('fin_price_booking', 'fin_quote_booking', 'fin_listed_price',
                            'create_booking_with_financials',
                            'create_booking_on_behalf_with_financials',
                            'fin_house_customer_rates', 'fin_client_settings', 'fin_transfer_fee',
                            'settlement_holds_populate', 'settlement_holds_guard',
                            'owner_receivables_validate', 'owner_receivables_guard',
                            'owner_receivable_recoveries_validate', 'owner_receivables_restate',
                            'fin_assert_balanced', 'fin_append_only', 'fin_assert_reversal_scope',
                            'protect_payment_write', 'stamp_payment_review',
                            'protect_booking_privileged_columns')) THEN
    v_fail := v_fail || E'\n  - a Financial Core function body changed';
  ELSE v_pass := v_pass + 1; END IF;

  IF b.n_txns <> (SELECT count(*) FROM public.fin_transactions)
     OR b.n_legs <> (SELECT count(*) FROM public.fin_transaction_legs)
     OR b.n_payments <> (SELECT count(*) FROM public.payments)
     OR b.n_payouts <> (SELECT count(*) FROM public.owner_payouts)
     OR b.n_financials <> (SELECT count(*) FROM public.booking_financials)
     OR b.n_holds <> (SELECT count(*) FROM public.settlement_holds) THEN
    v_fail := v_fail || E'\n  - an existing row was written';
  ELSE v_pass := v_pass + 1; END IF;

  -- No ledger or settlement table gained a client write privilege.
  SELECT count(*) INTO n FROM pg_class c, aclexplode(c.relacl) g
   WHERE c.oid IN ('public.fin_transactions'::regclass, 'public.fin_transaction_legs'::regclass,
                   'public.payout_bookings'::regclass, 'public.settlement_holds'::regclass,
                   'public.owner_receivables'::regclass, 'public.owner_receivable_recoveries'::regclass)
     AND g.grantee IN (0, 'anon'::regrole, 'authenticated'::regrole)
     AND g.privilege_type IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE');
  IF n <> 0 THEN
    v_fail := v_fail || E'\n  - a client role can write a ledger or settlement table';
  ELSE v_pass := v_pass + 1; END IF;

  IF v_fail <> '' THEN
    RAISE EXCEPTION '0173 VERIFICATION FAILED (% of 46 passed):%', v_pass, v_fail;
  END IF;
  IF v_pass <> 46 THEN
    RAISE EXCEPTION '0173 VERIFICATION INCOMPLETE: % assertions passed but 46 were expected', v_pass;
  END IF;
  RAISE NOTICE '0173 verification: 46 / 46 checks PASSED';
END;
$verify$;

DROP TABLE _0173_baseline;
