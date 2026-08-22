-- ─────────────────────────────────────────────────────────────────────────────
-- 0140 — HOUSE AGREEMENTS (per house, effective-dated, non-overlapping)
--
-- The commercial contract between PIMA and a property, as data. Until now there
-- was no such thing: a single global commission_rate in platform_settings stood
-- in for every agreement with every owner, which is why the system could express
-- only one of the three commercial models the business actually runs.
--
-- This table stores the AGREEMENT. It does not compute anything. Owner
-- entitlement, PIMA margin, deposit and the minimum-margin warning are all
-- resolved per booking and frozen into booking_financials in 0142 — they are
-- deliberately absent here, because an agreement that carried computed figures
-- would become a second, drifting truth the moment a booking was taken under it.
--
-- ── THE THREE MODELS (PD-02) ────────────────────────────────────────────────
--
--   NET_RATE    (preferred)  the owner names a net rate; PIMA sets retail freely.
--                            owner entitlement = net_rate
--                            PIMA margin       = retail − net_rate
--
--   MARKUP      (fallback)   the owner names a base rate; retail is that plus a
--                            markup PIMA controls. PD-08: no maximum markup.
--                            owner entitlement = base_rate
--                            PIMA margin       = retail − base_rate
--
--   COMMISSION  (last)       the house sets retail; PIMA takes a percentage.
--                            owner entitlement = retail × (1 − commission_rate)
--                            PIMA margin       = retail × commission_rate
--
-- Exactly one model per agreement, and the columns for the other two must be
-- NULL — enforced by ha_model_columns rather than left to the application.
--
-- ── EFFECTIVE INTERVAL: HALF-OPEN [effective_from, effective_to) ─────────────
--
-- An agreement applies on date d when:
--
--     effective_from <= d  AND  (effective_to IS NULL OR d < effective_to)
--
-- effective_to is therefore the first day the agreement NO LONGER applies, not
-- the last day it does. This is the one convention used everywhere in this
-- migration and it is what makes succession exact: an agreement ending
-- 2026-06-01 and its successor starting 2026-06-01 leave neither a gap nor an
-- overlap. A closed interval would force the successor to 2026-06-02 and make
-- the boundary day ambiguous.
--
-- NULL effective_to means open-ended.
--
-- ── NON-OVERLAP IS A DATABASE GUARANTEE ─────────────────────────────────────
--
-- ha_no_overlap is a GiST exclusion constraint, so two agreements covering the
-- same day for the same house cannot be written by any path — RPC, admin screen,
-- direct SQL or a future migration. Resolution is therefore always a lookup with
-- exactly one answer; there is no ordering rule to get wrong and no tie to break.
--
-- ── WHICH DATE RESOLVES (BLOCKED-6) ─────────────────────────────────────────
--
-- The BOOKING CREATION date, not check-in. The commercial agreement is the one
-- in force when PIMA accepted the booking. Seasonal and day-use PRICING keep
-- their existing check-in semantics; the two concepts are separate and stay so.
--
-- ── WHAT IS NOT HERE ────────────────────────────────────────────────────────
--
-- No seed. Agreements are commercial terms negotiated per owner; inventing one
-- for every existing house would fabricate a contract nobody agreed to. Houses
-- must be given agreements before 0147 can create a booking against them — a
-- deliberate, separate step.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── The table ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.house_agreements (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  house_id         TEXT          NOT NULL REFERENCES public.houses(id) ON DELETE CASCADE,

  model_type       TEXT          NOT NULL,

  -- NET_RATE only. The owner's entitlement rate, expressed in THE SAME UNIT as
  -- the house's own listed price for its property_type — per night per person
  -- for 'conference', monthly for 'student' and 'staff'. Reading the unit off
  -- property_type is exactly what validate_booking_price already does, so the
  -- agreement needs no unit column of its own and cannot disagree with pricing.
  net_rate         NUMERIC(12,2),

  -- MARKUP only. base_rate is the owner's entitlement rate, in the same unit as
  -- net_rate above. markup_pct is PIMA's uplift: retail = base × (1 + markup).
  base_rate        NUMERIC(12,2),
  markup_pct       NUMERIC(6,4),

  -- COMMISSION only. Defaults come from financial_settings at creation time;
  -- once written here the rate belongs to this agreement and never re-reads.
  commission_rate  NUMERIC(6,4),

  currency         CHAR(3)       NOT NULL DEFAULT 'EGP',

  -- ── Effective interval, half-open [effective_from, effective_to) ──────────
  effective_from   DATE          NOT NULL DEFAULT CURRENT_DATE,
  effective_to     DATE,

  -- ── Provenance ────────────────────────────────────────────────────────────
  created_by       UUID          REFERENCES public.users(id) ON DELETE SET NULL,
  closed_by        UUID          REFERENCES public.users(id) ON DELETE SET NULL,
  note             TEXT,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  -- ── Constraints ───────────────────────────────────────────────────────────
  CONSTRAINT ha_model_type_valid CHECK (model_type IN ('NET_RATE', 'MARKUP', 'COMMISSION')),

  -- One model, and the other two models' columns empty. Without this a row could
  -- carry a net rate AND a commission, and nothing downstream could say which
  -- the owner actually agreed to.
  CONSTRAINT ha_model_columns CHECK (
       (model_type = 'NET_RATE'
          AND net_rate        IS NOT NULL
          AND base_rate       IS NULL
          AND markup_pct      IS NULL
          AND commission_rate IS NULL)
    OR (model_type = 'MARKUP'
          AND base_rate       IS NOT NULL
          AND markup_pct      IS NOT NULL
          AND net_rate        IS NULL
          AND commission_rate IS NULL)
    OR (model_type = 'COMMISSION'
          AND commission_rate IS NOT NULL
          AND net_rate        IS NULL
          AND base_rate       IS NULL
          AND markup_pct      IS NULL)
  ),

  CONSTRAINT ha_net_rate_positive  CHECK (net_rate  IS NULL OR net_rate  > 0),
  CONSTRAINT ha_base_rate_positive CHECK (base_rate IS NULL OR base_rate > 0),

  -- PD-08: markup has NO fixed maximum. Only negativity is refused — selling
  -- below the owner's own base rate is not a markup, and the minimum-margin
  -- warning in the booking engine is where thin margins are surfaced.
  CONSTRAINT ha_markup_non_negative CHECK (markup_pct IS NULL OR markup_pct >= 0),

  CONSTRAINT ha_commission_range CHECK (
    commission_rate IS NULL OR (commission_rate >= 0 AND commission_rate <= 1)
  ),

  CONSTRAINT ha_effective_window CHECK (effective_to IS NULL OR effective_to > effective_from),
  CONSTRAINT ha_currency_format  CHECK (currency ~ '^[A-Z]{3}$'),

  -- Two agreements may not cover the same day for the same house. Half-open
  -- ranges make adjacency exact: [Jan, Jun) and [Jun, NULL) do not overlap.
  CONSTRAINT ha_no_overlap EXCLUDE USING gist (
    house_id WITH =,
    daterange(effective_from, effective_to, '[)') WITH &&
  )
);


-- ── Indexes ──────────────────────────────────────────────────────────────────
-- ha_no_overlap already creates a GiST index covering (house_id, range), which
-- serves overlap detection. This btree serves the ordinary reads: an owner's
-- agreement history, and the point-in-time resolution in 0147.
CREATE INDEX IF NOT EXISTS house_agreements_house_effective_idx
  ON public.house_agreements (house_id, effective_from DESC);

-- Partial index for the common case: the agreement in force right now.
CREATE INDEX IF NOT EXISTS house_agreements_open_idx
  ON public.house_agreements (house_id)
  WHERE effective_to IS NULL;


-- ── Append-only guard ────────────────────────────────────────────────────────
-- Historical commercial terms are not editable. The only permitted UPDATE closes
-- an open agreement and records who closed it; every other change, and every
-- DELETE, is refused. Superseding means inserting the next agreement, which the
-- exclusion constraint then validates against everything already on file.
CREATE OR REPLACE FUNCTION public.house_agreements_guard()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION
      'HOUSE_AGREEMENT_IMMUTABLE: a commercial agreement is never deleted — close it with effective_to';
  END IF;

  IF OLD.effective_to IS NOT NULL THEN
    RAISE EXCEPTION
      'HOUSE_AGREEMENT_CLOSED: agreement % is already closed and cannot be changed', OLD.id;
  END IF;

  IF NEW.effective_to IS NULL THEN
    RAISE EXCEPTION
      'HOUSE_AGREEMENT_IMMUTABLE: the only permitted update is closing the agreement with effective_to';
  END IF;

  -- Closing must not smuggle a rate, model, house or currency change alongside.
  IF (to_jsonb(NEW) - 'effective_to' - 'closed_by')
     IS DISTINCT FROM
     (to_jsonb(OLD) - 'effective_to' - 'closed_by') THEN
    RAISE EXCEPTION
      'HOUSE_AGREEMENT_IMMUTABLE: supersede by inserting a new agreement, never by editing one';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS house_agreements_append_only ON public.house_agreements;
CREATE TRIGGER house_agreements_append_only
  BEFORE UPDATE OR DELETE ON public.house_agreements
  FOR EACH ROW EXECUTE FUNCTION public.house_agreements_guard();


-- ── RLS ──────────────────────────────────────────────────────────────────────
-- An owner may READ the terms they agreed to — they are a party to the contract.
-- Only an admin may write one, because an owner who could set their own net rate
-- could set their own entitlement. No anonymous access, and no customer access:
-- a guest has no business knowing what a house nets.
ALTER TABLE public.house_agreements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "house_agreements_owner_admin_read" ON public.house_agreements;
CREATE POLICY "house_agreements_owner_admin_read" ON public.house_agreements
  FOR SELECT USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.houses h
      WHERE h.id = house_agreements.house_id
        AND h.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "house_agreements_admin_insert" ON public.house_agreements;
CREATE POLICY "house_agreements_admin_insert" ON public.house_agreements
  FOR INSERT WITH CHECK (public.is_admin(auth.uid()));

-- UPDATE exists solely so an admin can close an agreement; the guard trigger
-- decides what a close may contain.
DROP POLICY IF EXISTS "house_agreements_admin_close" ON public.house_agreements;
CREATE POLICY "house_agreements_admin_close" ON public.house_agreements
  FOR UPDATE USING (public.is_admin(auth.uid()))
           WITH CHECK (public.is_admin(auth.uid()));

-- No DELETE policy, deliberately.


-- ── Privileges ───────────────────────────────────────────────────────────────
-- Migration 0097 grants full DML on ALL TABLES and EXECUTE on ALL FUNCTIONS to
-- anon and authenticated, with default privileges that repeat it for everything
-- created afterwards. Taking that back explicitly is mandatory, not tidiness.
REVOKE ALL ON TABLE public.house_agreements FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.house_agreements TO authenticated;
-- DELETE granted to nobody; RLS narrows the rest to owner-read / admin-write.

REVOKE ALL ON FUNCTION public.house_agreements_guard() FROM PUBLIC, anon, authenticated;


-- ── Documentation ────────────────────────────────────────────────────────────
COMMENT ON TABLE public.house_agreements IS
  'The commercial agreement between PIMA and a house: NET_RATE, MARKUP or COMMISSION, effective-dated on the half-open interval [effective_from, effective_to). Non-overlap per house is enforced by the ha_no_overlap GiST exclusion constraint, so point-in-time resolution always has exactly one answer. Append-only: an agreement is closed and superseded, never edited. Resolved by BOOKING CREATION date and frozen into booking_financials.';

COMMENT ON COLUMN public.house_agreements.effective_to IS
  'First day the agreement NO LONGER applies (half-open interval). NULL means open-ended. Setting it is the only permitted update to a row.';
COMMENT ON COLUMN public.house_agreements.net_rate IS
  'NET_RATE model. Owner entitlement rate in the same unit as the house''s own listed price for its property_type: per night per person for conference houses, monthly for student/staff.';
COMMENT ON COLUMN public.house_agreements.base_rate IS
  'MARKUP model. Owner entitlement rate, same unit convention as net_rate. Retail is this plus markup_pct.';
COMMENT ON COLUMN public.house_agreements.markup_pct IS
  'MARKUP model. PIMA''s uplift over base_rate. PD-08: no maximum. Thin margins surface through the minimum-margin warning, not through a cap here.';
COMMENT ON COLUMN public.house_agreements.commission_rate IS
  'COMMISSION model. PIMA''s share of retail. Seeded from financial_settings.default_commission_rate at creation, then owned by this agreement and never re-read.';
