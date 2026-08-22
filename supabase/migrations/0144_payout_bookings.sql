-- ─────────────────────────────────────────────────────────────────────────────
-- 0144 — PAYOUT ↔ BOOKING LINKAGE
--
-- Which bookings did this payout actually settle? Until now the answer lived in
-- two places that could not be trusted and could not agree:
--
--   owner_payouts.booking_ids TEXT[]   an array with no foreign key, so it could
--                                      name bookings that never existed
--   bookings.owner_settled_at          a timestamp, maintained separately, from
--                                      which the payout had to be GUESSED
--
-- and the guessing was real: paymentLedger.unclaimedOwedBookings() matched them
-- on the string `${houseId}|${completedAt}`. Two payouts completed in the same
-- second for the same house were indistinguishable. That is not a linkage, it is
-- a coincidence being asked to carry money.
--
-- This table is the linkage: one row per (payout, booking), with real foreign
-- keys, a positive amount, and the invariant that matters —
--
--     SUM(amount_applied) per booking  <=  settlement_holds.hold_amount
--
-- enforced in the database with the hold row locked, so two concurrent payouts
-- cannot both pass the check and jointly overpay.
--
-- ── THE AUTHORITATIVE CHAIN ─────────────────────────────────────────────────
--
--   booking_financials → settlement_holds → payout_bookings → owner_payouts → ledger
--
-- Each link adds exactly one fact and duplicates none. amount_applied is the
-- amount of THIS hold applied by THIS payout — nothing else. There is no
-- cumulative column, no released_amount, no re-statement of entitlement: those
-- are all sums over these rows.
--
-- ── LINKAGE ONLY ON A COMPLETED PAYOUT ──────────────────────────────────────
--
-- A row here asserts that money was applied. A 'pending' payout is a request and
-- a 'rejected' one never moved anything, so linking either would record a
-- settlement that did not happen — and because these rows are append-only, a
-- payout rejected after linkage would leave a lie that could not be withdrawn.
-- Requiring 'completed' removes that state entirely: 0148 writes the linkage in
-- the same transaction that completes the payout and posts the ledger entry.
--
-- ── IDENTITY IS DERIVED, NEVER ACCEPTED ─────────────────────────────────────
--
-- owner_id, house_id and currency are read from the settlement hold by trigger
-- and overwrite whatever the caller sent, the same discipline 0143 uses. A
-- payout therefore cannot apply money to another owner's booking or another
-- house's booking, because the identity it would need to forge is not an input.
--
-- ── LEGACY, DEPRECATED HERE, REMOVED LATER ──────────────────────────────────
--
-- owner_payouts.booking_ids[] and bookings.owner_settled_at are left in place and
-- marked deprecated by COMMENT. Nothing is dropped: the legacy TypeScript still
-- reads them and will keep working until the frontend migration retires it. From
-- this migration onward they are NOT authoritative, and no new financial logic
-- may read them. Removal is step 6–7 of the deprecation order, after the
-- parallel-run diff proves the new linkage agrees.
-- ─────────────────────────────────────────────────────────────────────────────


CREATE TABLE IF NOT EXISTS public.payout_bookings (
  -- RESTRICT on both sides: a settled booking and the payout that settled it are
  -- financial history (0112's principle, applied by 0141 and 0143 before this).
  payout_id      TEXT NOT NULL REFERENCES public.owner_payouts(id)             ON DELETE RESTRICT,
  -- To the HOLD, not the booking: money can only be applied against an
  -- obligation that was actually recognised.
  booking_id     TEXT NOT NULL REFERENCES public.settlement_holds(booking_id)  ON DELETE RESTRICT,

  amount_applied NUMERIC(12,2) NOT NULL,

  -- Derived from the hold by trigger. Never caller-supplied.
  owner_id       UUID    NOT NULL REFERENCES public.users(id)  ON DELETE RESTRICT,
  house_id       TEXT    NOT NULL REFERENCES public.houses(id) ON DELETE RESTRICT,
  currency       CHAR(3) NOT NULL,

  created_by     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One row per payout/booking pair: the same booking cannot be linked to the
  -- same payout twice.
  CONSTRAINT payout_bookings_pkey PRIMARY KEY (payout_id, booking_id),

  CONSTRAINT pb_amount_positive  CHECK (amount_applied > 0),
  CONSTRAINT pb_currency_format  CHECK (currency ~ '^[A-Z]{3}$')
);


-- ── Indexes ──────────────────────────────────────────────────────────────────
-- The primary key already serves lookups by payout. These serve the other two
-- questions: how much has been applied to this booking, and what has this owner
-- been paid.
CREATE INDEX IF NOT EXISTS pb_booking_idx ON public.payout_bookings (booking_id);
CREATE INDEX IF NOT EXISTS pb_owner_idx   ON public.payout_bookings (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS pb_house_idx   ON public.payout_bookings (house_id);


-- ── Validation: identity, releasability, and the cap ─────────────────────────
-- SECURITY DEFINER so the reads of settlement_holds and owner_payouts succeed
-- for any authorised writer regardless of their own row visibility.
CREATE OR REPLACE FUNCTION public.payout_bookings_validate()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  h         RECORD;
  p         RECORD;
  v_applied NUMERIC;
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

  -- PD-13a. Paying before the refund window closes is the exact failure the
  -- hold exists to prevent, and it must be impossible here too, not only in 0143.
  IF h.hold_until > CURRENT_DATE THEN
    RAISE EXCEPTION
      'PAYOUT_HOLD_NOT_RELEASABLE: booking % is held until %, refund exposure has not expired',
      NEW.booking_id, h.hold_until;
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
$$;

DROP TRIGGER IF EXISTS payout_bookings_validate_trg ON public.payout_bookings;
CREATE TRIGGER payout_bookings_validate_trg
  BEFORE INSERT ON public.payout_bookings
  FOR EACH ROW EXECUTE FUNCTION public.payout_bookings_validate();


-- ── Append-only ──────────────────────────────────────────────────────────────
-- A settlement that happened stays recorded. An error is corrected by reversing
-- the ledger entry and issuing a further payout, never by editing the history of
-- what was paid.
CREATE OR REPLACE FUNCTION public.payout_bookings_append_only()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public, pg_temp AS $$
BEGIN
  RAISE EXCEPTION
    'PAYOUT_LINKAGE_APPEND_ONLY: % is refused — reverse the ledger entry and issue a further payout instead of rewriting what was settled',
    TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS payout_bookings_append_only_trg ON public.payout_bookings;
CREATE TRIGGER payout_bookings_append_only_trg
  BEFORE UPDATE OR DELETE ON public.payout_bookings
  FOR EACH ROW EXECUTE FUNCTION public.payout_bookings_append_only();


-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Owner-readable: this is the record of what they were paid and for which
-- bookings, which is precisely the thing the old array made impossible to answer
-- for them. No guest access — a payout is between PIMA and the house. No
-- anonymous access.
--
-- The existing owner_payouts policies are NOT touched by this migration: owner
-- may request for their own house in 'pending' only, admin inserts and updates,
-- and there is still no DELETE policy.
ALTER TABLE public.payout_bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payout_bookings_owner_admin_read" ON public.payout_bookings;
CREATE POLICY "payout_bookings_owner_admin_read" ON public.payout_bookings
  FOR SELECT USING (
    public.is_admin(auth.uid())
    OR owner_id = auth.uid()
  );

-- No INSERT, UPDATE or DELETE policy. Linkage is written solely by the
-- SECURITY DEFINER payout RPC in 0148, in the same transaction that completes
-- the payout and posts its ledger entry.


-- ── Privileges ───────────────────────────────────────────────────────────────
-- Migration 0097 grants full DML on ALL TABLES and EXECUTE on ALL FUNCTIONS to
-- anon and authenticated, with default privileges repeating it for anything
-- created afterwards. Taking it back is mandatory.
REVOKE ALL ON TABLE public.payout_bookings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.payout_bookings TO authenticated;
-- RLS then narrows to owner-or-admin. No write privilege to anyone.

REVOKE ALL ON FUNCTION public.payout_bookings_validate()    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.payout_bookings_append_only() FROM PUBLIC, anon, authenticated;


-- ── Legacy, deprecated from here ─────────────────────────────────────────────
-- Neither column is dropped. The legacy TypeScript still reads them and keeps
-- working; they are simply no longer the truth. Removal happens in the
-- deprecation phase, after a parallel-run diff shows the new linkage agrees.
COMMENT ON COLUMN public.owner_payouts.booking_ids IS
  'DEPRECATED as of migration 0144. Not authoritative: no foreign key, no uniqueness, and no per-booking amount. public.payout_bookings is the authoritative payout-to-booking linkage. Retained only so legacy readers keep working; no new financial logic may read it. Scheduled for removal once frontend consumers are migrated.';

COMMENT ON COLUMN public.bookings.owner_settled_at IS
  'DEPRECATED as of migration 0144. Not authoritative: it records THAT a booking was settled but not by which payout or for how much, and paymentLedger.unclaimedOwedBookings() had to guess the pairing from a house-id/timestamp string. Settlement is now answered by public.payout_bookings. Retained only for legacy readers; scheduled for removal.';


-- ── Documentation ────────────────────────────────────────────────────────────
COMMENT ON TABLE public.payout_bookings IS
  'Authoritative payout-to-booking linkage, replacing owner_payouts.booking_ids[] and the house-id/timestamp heuristic. One row per (payout, booking); amount_applied is what THIS payout applied to THIS hold. Append-only. SUM(amount_applied) per booking may never exceed settlement_holds.hold_amount, enforced with the hold row locked so concurrent payouts cannot jointly overpay.';

COMMENT ON COLUMN public.payout_bookings.amount_applied IS
  'The amount of this booking''s settlement hold applied by this payout. Partial application is permitted and repeatable; the cumulative total is capped at hold_amount. There is deliberately no cumulative or remaining column — both are sums over these rows.';
