-- ─────────────────────────────────────────────────────────────────────────────
-- 0142 — BOOKING FINANCIAL SNAPSHOT (immutable)
--
-- What was AGREED when the booking was taken. Not what has happened since —
-- that is the ledger's job, and the boundary between the two is the whole point
-- of this table.
--
--     SNAPSHOT  =  the terms          written once, never changed
--     LEDGER    =  the money          appended forever, never edited
--
-- Every figure here is a fact about the agreement: the rate, the quantity, the
-- entitlement, the deposit, the policy. Nothing here is a balance. There is
-- deliberately no «paid so far», no «owner cash transferred», no «receivable»,
-- no «refunded to date» — those are sums over fin_transaction_legs, and storing
-- them here would recreate the exact problem this rebuild exists to fix: two
-- places holding the same number, free to disagree.
--
-- ── WHY SO MUCH OF IT IS GENERATED ──────────────────────────────────────────
--
-- The derived figures are GENERATED ALWAYS ... STORED, not supplied. A snapshot
-- whose gross margin could be written independently of its retail price and
-- entitlement is a snapshot that can lie about its own arithmetic. Generating
-- them makes that impossible rather than merely unlikely, and it means the
-- locked economics of PD-01, PD-03, PD-06, PD-14 and PD-16 live in the schema
-- instead of in whichever function happened to write the row.
--
-- PostgreSQL forbids a generated column referencing another generated column,
-- so the expressions below repeat their inputs verbatim. That is deliberate
-- verbosity, not duplication of logic: there is still exactly one definition of
-- each figure, and it is here.
--
-- ── OWNER ENTITLEMENT IS NEVER REDUCED BY A DISCOUNT (PD-06) ────────────────
--
-- owner_entitlement is checked against the AGREEMENT, never against
-- final_price. A promotion or a points redemption moves final_price and leaves
-- entitlement untouched — which is the entire content of PD-06, expressed as a
-- constraint the database will not let a caller violate:
--
--     retail 1000 · net 800 · promo 50  →  final 950 · entitlement STILL 800
--
-- ── PRICING BASIS COMES FROM THE EXISTING ENGINE ────────────────────────────
--
-- Read off validate_booking_price (0128) and lib/pricing.ts, which agree. There
-- are exactly three, and no others were invented:
--
--   MONTHLY              student/staff.     qty = chargeable × GREATEST(1, ROUND(nights/30))
--   DAY_USE_PER_PERSON   check_out = check_in.  qty = chargeable
--   PER_NIGHT_PER_PERSON everything else.   qty = chargeable × nights
--
-- «chargeable» is guests_count minus children free under the booking's own
-- stamped policy — the same figure validate_booking_price computes. The
-- agreement rate is flat, so the entitlement is rate × quantity even where
-- retail varies night to night under seasonal rates.
--
-- ── WHAT IS NOT HERE ────────────────────────────────────────────────────────
--
-- No pricing engine. This migration stores a resolved snapshot and enforces its
-- internal consistency; computing the numbers is 0147's job. And no ledger rows
-- of any kind: 0142 writes nothing to fin_transactions.
-- ─────────────────────────────────────────────────────────────────────────────


CREATE TABLE IF NOT EXISTS public.booking_financials (
  -- Exactly one snapshot per booking, by primary key. RESTRICT everywhere that
  -- matters: financial history must not vanish because a parent row was deleted
  -- (the principle migration 0112 established, and 0141 applied to the ledger).
  booking_id    TEXT PRIMARY KEY REFERENCES public.bookings(id)         ON DELETE RESTRICT,
  house_id      TEXT NOT NULL    REFERENCES public.houses(id)           ON DELETE RESTRICT,
  owner_id      UUID NOT NULL    REFERENCES public.users(id)            ON DELETE RESTRICT,
  agreement_id  UUID NOT NULL    REFERENCES public.house_agreements(id) ON DELETE RESTRICT,

  -- ── The agreement, as applied ─────────────────────────────────────────────
  model_type       TEXT    NOT NULL,
  currency         CHAR(3) NOT NULL DEFAULT 'EGP',

  pricing_basis    TEXT    NOT NULL,
  -- The multiplier the flat agreement rate is applied to. See the header for
  -- how each basis derives it.
  pricing_quantity INTEGER NOT NULL,

  resolved_rate    NUMERIC(12,2),  -- NET_RATE
  base_rate        NUMERIC(12,2),  -- MARKUP
  markup_pct       NUMERIC(6,4),   -- MARKUP
  commission_rate  NUMERIC(6,4),   -- COMMISSION

  -- ── Price, and who funded each reduction ──────────────────────────────────
  retail_price     NUMERIC(12,2) NOT NULL,
  promo_discount   NUMERIC(12,2) NOT NULL DEFAULT 0,   -- PIMA-funded (PD-06)
  points_discount  NUMERIC(12,2) NOT NULL DEFAULT 0,   -- PIMA-funded (PD-06)
  points_redeemed  INTEGER       NOT NULL DEFAULT 0,   -- the points themselves, for the ledger to reconcile against

  -- From the AGREEMENT, never from final_price. This is PD-06 in one column.
  owner_entitlement NUMERIC(12,2) NOT NULL,

  -- ── Configuration frozen at booking time ──────────────────────────────────
  deposit_rate         NUMERIC(6,4)  NOT NULL,   -- PD-03
  min_margin_rate      NUMERIC(6,4)  NOT NULL,   -- PD-01
  -- PD-09 / BLOCKED-3: the CAP, used only to project the warning. The actual
  -- fee is a ledger entry at payout and is never assumed here.
  assumed_transfer_fee NUMERIC(12,2) NOT NULL,

  -- ── Cancellation policy snapshot (PD-10), mirroring 0128's pattern ────────
  policy_free_cancel_days    INTEGER      NOT NULL,
  policy_partial_refund_days INTEGER      NOT NULL,
  policy_partial_refund_pct  NUMERIC(6,4) NOT NULL,
  policy_source              TEXT         NOT NULL,

  -- PD-13a. check_in − policy_partial_refund_days, computed from THIS row's
  -- snapshot. A later policy change cannot move an existing booking's release.
  owner_cash_release_date    DATE         NOT NULL,

  -- ── Audited override (PD-01, BLOCKED-1) ───────────────────────────────────
  override_by     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  override_reason TEXT,
  override_at     TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),


  -- ══ DERIVED FIGURES ══════════════════════════════════════════════════════
  -- Generated, so they cannot contradict the facts above. Expressions repeat
  -- their inputs because PostgreSQL forbids referencing another generated
  -- column; the definition of each figure still exists exactly once.

  -- PD-14. What the customer actually pays.
  final_price NUMERIC(12,2)
    GENERATED ALWAYS AS (retail_price - promo_discount - points_discount) STORED,

  -- Before PIMA's own funded costs. retail − entitlement, by definition.
  pima_gross_margin NUMERIC(12,2)
    GENERATED ALWAYS AS (retail_price - owner_entitlement) STORED,

  -- PD-03: the ordinary deposit, rounded to whole EGP as validate_booking_price
  -- has always done.
  deposit_standard NUMERIC(12,2)
    GENERATED ALWAYS AS (
      ROUND(deposit_rate * (retail_price - promo_discount - points_discount))
    ) STORED,

  -- PD-16. Raising the deposit to PIMA's gross margin is a no-op on an ordinary
  -- booking and self-corrects the high-margin Model A/B case, where the door
  -- payment would otherwise exceed what the owner is owed.
  deposit_amount NUMERIC(12,2)
    GENERATED ALWAYS AS (
      GREATEST(
        ROUND(deposit_rate * (retail_price - promo_discount - points_discount)),
        retail_price - owner_entitlement
      )
    ) STORED,

  deposit_basis TEXT
    GENERATED ALWAYS AS (
      CASE WHEN (retail_price - owner_entitlement)
                > ROUND(deposit_rate * (retail_price - promo_discount - points_discount))
           THEN 'MARGIN_FLOOR' ELSE 'STANDARD' END
    ) STORED,

  -- PD-01 / BLOCKED-2. The denominator is the FINAL customer price — not
  -- retail, not gross margin.
  required_min_margin NUMERIC(12,2)
    GENERATED ALWAYS AS (
      ROUND((retail_price - promo_discount - points_discount) * min_margin_rate, 2)
    ) STORED,

  -- Gross margin less everything PIMA funds, with the transfer fee at its cap.
  projected_net_margin NUMERIC(12,2)
    GENERATED ALWAYS AS (
      (retail_price - owner_entitlement) - promo_discount - points_discount - assumed_transfer_fee
    ) STORED,

  -- BLOCKED-1. PIMA discounted below what the owner is owed, so it must fund
  -- the gap from working capital. NOT an owner receivable — nobody owes it back.
  cash_shortfall NUMERIC(12,2)
    GENERATED ALWAYS AS (
      GREATEST(0, owner_entitlement - (retail_price - promo_discount - points_discount))
    ) STORED,

  margin_warning BOOLEAN
    GENERATED ALWAYS AS (
      ((retail_price - owner_entitlement) - promo_discount - points_discount - assumed_transfer_fee)
      < ROUND((retail_price - promo_discount - points_discount) * min_margin_rate, 2)
    ) STORED,

  override_required BOOLEAN
    GENERATED ALWAYS AS (
      (((retail_price - owner_entitlement) - promo_discount - points_discount - assumed_transfer_fee)
        < ROUND((retail_price - promo_discount - points_discount) * min_margin_rate, 2))
      OR (owner_entitlement - (retail_price - promo_discount - points_discount)) > 0
    ) STORED,


  -- ══ CONSTRAINTS ══════════════════════════════════════════════════════════

  CONSTRAINT bf_model_valid CHECK (model_type IN ('NET_RATE', 'MARKUP', 'COMMISSION')),
  CONSTRAINT bf_basis_valid CHECK (pricing_basis IN
    ('PER_NIGHT_PER_PERSON', 'MONTHLY', 'DAY_USE_PER_PERSON')),
  CONSTRAINT bf_policy_source_valid CHECK (policy_source IN ('property', 'platform')),
  CONSTRAINT bf_currency_format CHECK (currency ~ '^[A-Z]{3}$'),

  CONSTRAINT bf_quantity_positive   CHECK (pricing_quantity > 0),
  CONSTRAINT bf_retail_non_negative CHECK (retail_price      >= 0),
  CONSTRAINT bf_promo_non_negative  CHECK (promo_discount    >= 0),
  CONSTRAINT bf_points_non_negative CHECK (points_discount   >= 0),
  CONSTRAINT bf_points_redeemed_non_negative CHECK (points_redeemed >= 0),
  CONSTRAINT bf_entitlement_non_negative     CHECK (owner_entitlement >= 0),
  CONSTRAINT bf_transfer_fee_non_negative    CHECK (assumed_transfer_fee >= 0),

  -- The discounts cannot exceed the price they reduce.
  CONSTRAINT bf_discounts_within_retail
    CHECK (promo_discount + points_discount <= retail_price),

  -- A points discount and the points spent must both be present or both absent.
  CONSTRAINT bf_points_coherent
    CHECK ((points_discount = 0 AND points_redeemed = 0)
        OR (points_discount > 0 AND points_redeemed > 0)),

  CONSTRAINT bf_deposit_rate_range CHECK (deposit_rate > 0 AND deposit_rate <= 1),
  CONSTRAINT bf_min_margin_range   CHECK (min_margin_rate >= 0.0200 AND min_margin_rate <= 0.0250),
  CONSTRAINT bf_tier_order         CHECK (policy_free_cancel_days >= policy_partial_refund_days),
  CONSTRAINT bf_partial_pct_range  CHECK (policy_partial_refund_pct >= 0 AND policy_partial_refund_pct <= 1),

  -- Exactly one model's columns are populated, as in house_agreements.
  CONSTRAINT bf_model_columns CHECK (
       (model_type = 'NET_RATE'
          AND resolved_rate IS NOT NULL AND base_rate IS NULL
          AND markup_pct IS NULL AND commission_rate IS NULL)
    OR (model_type = 'MARKUP'
          AND base_rate IS NOT NULL AND markup_pct IS NOT NULL
          AND resolved_rate IS NULL AND commission_rate IS NULL)
    OR (model_type = 'COMMISSION'
          AND commission_rate IS NOT NULL AND resolved_rate IS NULL
          AND base_rate IS NULL AND markup_pct IS NULL)
  ),

  -- ── The locked model economics, as a constraint ───────────────────────────
  -- Entitlement is derived from the AGREEMENT and the pricing quantity — never
  -- from final_price. This is what makes it impossible for a promotion or a
  -- points redemption to reduce what the owner is owed (PD-06).
  CONSTRAINT bf_entitlement_matches_model CHECK (
       (model_type = 'NET_RATE'
          AND owner_entitlement = ROUND(resolved_rate * pricing_quantity, 2))
    OR (model_type = 'MARKUP'
          AND owner_entitlement = ROUND(base_rate * pricing_quantity, 2))
    OR (model_type = 'COMMISSION'
          AND owner_entitlement = ROUND(retail_price * (1 - commission_rate), 2))
  ),

  -- PD-01 / BLOCKED-1: no silent erosion. A booking that trips the margin
  -- warning or needs PIMA working capital cannot EXIST without a recorded,
  -- attributed, reasoned override.
  CONSTRAINT bf_override_when_required CHECK (
    NOT (
      (((retail_price - owner_entitlement) - promo_discount - points_discount - assumed_transfer_fee)
        < ROUND((retail_price - promo_discount - points_discount) * min_margin_rate, 2))
      OR (owner_entitlement - (retail_price - promo_discount - points_discount)) > 0
    )
    OR (override_by IS NOT NULL AND override_reason IS NOT NULL AND override_at IS NOT NULL)
  ),

  -- An override recorded at all must be recorded completely.
  CONSTRAINT bf_override_complete CHECK (
    (override_by IS NULL AND override_reason IS NULL AND override_at IS NULL)
    OR (override_by IS NOT NULL AND override_reason IS NOT NULL AND override_at IS NOT NULL)
  )
);


-- ── Indexes ──────────────────────────────────────────────────────────────────
-- booking_id is the primary key, so «one snapshot per booking» needs no
-- separate unique index.
CREATE INDEX IF NOT EXISTS bf_owner_idx     ON public.booking_financials (owner_id);
CREATE INDEX IF NOT EXISTS bf_house_idx     ON public.booking_financials (house_id);
CREATE INDEX IF NOT EXISTS bf_agreement_idx ON public.booking_financials (agreement_id);
-- Finding bookings whose owner cash is now releasable (PD-13a).
CREATE INDEX IF NOT EXISTS bf_release_idx   ON public.booking_financials (owner_cash_release_date);
-- Surfacing overridden bookings for the admin financial review.
CREATE INDEX IF NOT EXISTS bf_override_idx  ON public.booking_financials (override_at)
  WHERE override_by IS NOT NULL;


-- ── Immutability ─────────────────────────────────────────────────────────────
-- A snapshot records what was agreed. Editing it would rewrite the past, which
-- is precisely what this table exists to prevent. Corrections belong in the
-- ledger, as reversals and adjustments.
CREATE OR REPLACE FUNCTION public.booking_financials_immutable()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public, pg_temp AS $$
BEGIN
  RAISE EXCEPTION
    'BOOKING_FINANCIALS_IMMUTABLE: % is refused — a booking''s agreed terms are never rewritten; correct the money in the ledger instead',
    TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS booking_financials_no_change ON public.booking_financials;
CREATE TRIGGER booking_financials_no_change
  BEFORE UPDATE OR DELETE ON public.booking_financials
  FOR EACH ROW EXECUTE FUNCTION public.booking_financials_immutable();


-- ── RLS ──────────────────────────────────────────────────────────────────────
-- ADMIN ONLY on the raw table, deliberately.
--
-- This row carries PIMA's own position on the booking — gross margin, projected
-- net margin, the cash shortfall, the override. An owner has a legitimate claim
-- to their entitlement and their policy; they have no claim to PIMA's margin,
-- and a guest has no claim to any of it. Postgres has no row-level way to hide
-- some COLUMNS from one role and not another, so the honest answer is to keep
-- the raw table closed and let the canonical read layer in 0149 project the
-- role-appropriate subset for owners and guests.
--
-- Nothing reads this table yet, so closing it now costs nothing and avoids the
-- far harder job of narrowing an already-open surface later.
ALTER TABLE public.booking_financials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "booking_financials_admin_read" ON public.booking_financials;
CREATE POLICY "booking_financials_admin_read" ON public.booking_financials
  FOR SELECT USING (public.is_admin(auth.uid()));

-- No INSERT policy: snapshots are written solely by create_booking_with_financials
-- in 0147, a SECURITY DEFINER function running as the table owner.
-- No UPDATE policy, no DELETE policy — see the trigger above.


-- ── Privileges ───────────────────────────────────────────────────────────────
-- Migration 0097 grants full DML on ALL TABLES to anon and authenticated and
-- installs default privileges that repeat it for anything created afterwards.
-- Without these lines this table arrives world-writable.
REVOKE ALL ON TABLE public.booking_financials FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.booking_financials TO authenticated;
-- RLS then narrows that to admins. No INSERT, UPDATE or DELETE to anyone.

REVOKE ALL ON FUNCTION public.booking_financials_immutable() FROM PUBLIC, anon, authenticated;


-- ── Documentation ────────────────────────────────────────────────────────────
COMMENT ON TABLE public.booking_financials IS
  'Immutable financial snapshot of the terms agreed when a booking was created: agreement, rates, quantity, entitlement, deposit, policy and override. One row per booking, enforced by primary key. Carries NO running balances — every «how much has actually moved» question is answered by fin_transactions/fin_transaction_legs. Derived figures are GENERATED so the row cannot contradict its own arithmetic.';

COMMENT ON COLUMN public.booking_financials.owner_entitlement IS
  'From the AGREEMENT and the pricing quantity, never from final_price. PD-06: promotions and points are PIMA-funded and must never reduce it. Enforced by bf_entitlement_matches_model.';
COMMENT ON COLUMN public.booking_financials.pricing_quantity IS
  'Multiplier for the flat agreement rate, from the existing pricing engine: chargeable x nights (PER_NIGHT_PER_PERSON), chargeable x GREATEST(1, ROUND(nights/30)) (MONTHLY), or chargeable (DAY_USE_PER_PERSON).';
COMMENT ON COLUMN public.booking_financials.deposit_amount IS
  'PD-03/PD-14/PD-16: MAX(deposit_rate x final_price, gross margin). The floor is a no-op on ordinary bookings and prevents the door payment exceeding owner entitlement on high-margin Model A/B agreements.';
COMMENT ON COLUMN public.booking_financials.assumed_transfer_fee IS
  'PD-09/BLOCKED-3: the configured CAP, used only to project the margin warning at booking time. The actual fee is posted to the ledger at payout and may be anything from zero up to it.';
COMMENT ON COLUMN public.booking_financials.cash_shortfall IS
  'BLOCKED-1: owner_entitlement - final_price when PIMA has discounted below what the owner is owed. PIMA funds it from working capital. This is NOT an owner receivable and creates no ledger account.';
COMMENT ON COLUMN public.booking_financials.owner_cash_release_date IS
  'PD-13a: check_in minus this row''s own snapshotted policy_partial_refund_days. A later policy change cannot move it.';
