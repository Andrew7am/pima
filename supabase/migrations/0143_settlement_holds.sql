-- ─────────────────────────────────────────────────────────────────────────────
-- 0143 — SETTLEMENT HOLDS (owner entitlement vs owner cash)
--
-- PD-13a's whole content is that these are two different things:
--
--     ENTITLEMENT   what the owner is contractually owed   — recorded at once
--     CASH          when PIMA may actually transfer it     — held while exposed
--
-- The deposit is the only money PIMA holds, and while the booking sits inside a
-- refundable window that same deposit may have to go back to the guest. Paying
-- the owner out of it first is how a platform ends up funding a cancellation
-- from its own pocket. So the obligation is recognised immediately and the cash
-- waits until PIMA's refund exposure is mathematically zero.
--
-- ── THE RELEASE DATE IS THE BOOKING'S OWN, NOT TODAY'S POLICY ───────────────
--
-- hold_until is copied from booking_financials.owner_cash_release_date, which
-- 0142 froze as check_in − that booking's snapshotted partial_refund_days.
-- Changing the platform policy later cannot move an existing hold, which is the
-- same guarantee 0128 gave cancellation terms and 0113 gave commission.
--
-- A consequence worth naming: the release date is exactly the day the 0% refund
-- tier begins, so the only cancellations that can happen after release are total
-- forfeits — and the owner's PD-15 share of a forfeit always exceeds what was
-- released. Post-release cancellations are self-funding; an uncovered receivable
-- can only come from an out-of-policy admin refund.
--
-- ── WHAT IS DERIVED, AND WHY IT IS STILL STORED ─────────────────────────────
--
-- hold_amount = owner_entitlement − (final_price − deposit_amount)
--
-- i.e. what the owner is owed, less what the guest hands them at the door. Every
-- term comes from the immutable snapshot, so the figure can never drift — but it
-- is stored rather than joined for two reasons that matter: the payout query
-- ranges over it by date, and RLS needs owner_id locally, because
-- booking_financials is admin-only and a policy subquery against it would return
-- nothing for the very owners this table exists to serve.
--
-- To keep that from becoming a second source of truth, THE CALLER DOES NOT
-- SUPPLY THESE COLUMNS. A trigger reads them from booking_financials and
-- overwrites whatever was sent. There is one writer and one definition.
--
-- ── NO released_amount ──────────────────────────────────────────────────────
--
-- The approved plan listed one. It is deliberately absent: 0144's
-- payout_bookings.amount_applied is the authoritative record of how much of a
-- hold has been settled, and a second copy here is exactly the duplication this
-- rebuild exists to remove. This table records THAT the hold ended and which
-- ledger entry ended it; how much money moved is the ledger's answer.
--
-- ── WHAT IS NOT HERE ────────────────────────────────────────────────────────
--
-- No payout linkage (0144), no balance function (0149), and no ledger entries:
-- 0143 writes nothing to fin_transactions. Creating and releasing holds is the
-- job of the RPCs in 0147–0148.
-- ─────────────────────────────────────────────────────────────────────────────


CREATE TABLE IF NOT EXISTS public.settlement_holds (
  -- One hold per booking, by primary key. RESTRICT throughout, per 0112/0141:
  -- a record with financial meaning is not deletable out from under itself.
  booking_id   TEXT PRIMARY KEY REFERENCES public.booking_financials(booking_id) ON DELETE RESTRICT,

  -- ── Populated by trigger from booking_financials. Never caller-supplied. ──
  owner_id     UUID          NOT NULL REFERENCES public.users(id)  ON DELETE RESTRICT,
  house_id     TEXT          NOT NULL REFERENCES public.houses(id) ON DELETE RESTRICT,
  currency     CHAR(3)       NOT NULL,
  hold_amount  NUMERIC(12,2) NOT NULL,
  hold_until   DATE          NOT NULL,

  -- ── State ─────────────────────────────────────────────────────────────────
  status         TEXT NOT NULL DEFAULT 'HELD',

  released_at    TIMESTAMPTZ,
  release_txn_id UUID REFERENCES public.fin_transactions(id) ON DELETE RESTRICT,
  cancelled_at   TIMESTAMPTZ,

  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT sh_status_valid CHECK (status IN ('HELD', 'RELEASED', 'CANCELLED')),
  CONSTRAINT sh_currency_format CHECK (currency ~ '^[A-Z]{3}$'),

  -- Zero is legitimate: on a high-margin Model A/B booking the door payment
  -- covers the owner's entitlement exactly and PIMA transfers nothing.
  CONSTRAINT sh_amount_non_negative CHECK (hold_amount >= 0),

  -- A released hold names when and by which ledger entry; nothing else does.
  CONSTRAINT sh_release_complete CHECK (
    (status = 'RELEASED' AND released_at IS NOT NULL AND release_txn_id IS NOT NULL)
    OR (status <> 'RELEASED' AND released_at IS NULL AND release_txn_id IS NULL)
  ),
  CONSTRAINT sh_cancel_complete CHECK (
    (status = 'CANCELLED' AND cancelled_at IS NOT NULL)
    OR (status <> 'CANCELLED' AND cancelled_at IS NULL)
  )
);


-- ── Indexes ──────────────────────────────────────────────────────────────────
-- The payout query: which of this owner's holds are now releasable.
CREATE INDEX IF NOT EXISTS sh_owner_status_idx ON public.settlement_holds (owner_id, status);
CREATE INDEX IF NOT EXISTS sh_releasable_idx   ON public.settlement_holds (hold_until)
  WHERE status = 'HELD';
CREATE INDEX IF NOT EXISTS sh_house_idx        ON public.settlement_holds (house_id);


-- ── Derived columns are read, never accepted ─────────────────────────────────
-- SECURITY DEFINER so the read of booking_financials succeeds regardless of who
-- the caller is; that table is admin-only by policy and this trigger must work
-- for any authorised writer. It takes nothing from the caller but booking_id.
CREATE OR REPLACE FUNCTION public.settlement_holds_populate()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  bf RECORD;
BEGIN
  SELECT owner_id, house_id, currency, owner_entitlement, final_price,
         deposit_amount, owner_cash_release_date
    INTO bf
    FROM public.booking_financials
   WHERE booking_id = NEW.booking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'SETTLEMENT_HOLD_NO_SNAPSHOT: booking % has no financial snapshot — a hold cannot precede the terms it holds against',
      NEW.booking_id;
  END IF;

  -- What the owner is owed, less what the guest hands them at the door.
  NEW.owner_id    := bf.owner_id;
  NEW.house_id    := bf.house_id;
  NEW.currency    := bf.currency;
  NEW.hold_amount := GREATEST(0, bf.owner_entitlement - (bf.final_price - bf.deposit_amount));
  NEW.hold_until  := bf.owner_cash_release_date;

  -- A hold always begins held. Nobody creates one already settled.
  NEW.status         := 'HELD';
  NEW.released_at    := NULL;
  NEW.release_txn_id := NULL;
  NEW.cancelled_at   := NULL;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS settlement_holds_populate_trg ON public.settlement_holds;
CREATE TRIGGER settlement_holds_populate_trg
  BEFORE INSERT ON public.settlement_holds
  FOR EACH ROW EXECUTE FUNCTION public.settlement_holds_populate();


-- ── The state machine ────────────────────────────────────────────────────────
--
--     HELD ──▶ RELEASED     only on or after hold_until, with a ledger entry
--       └───▶ CANCELLED     booking cancelled before the cash went out
--
-- Both ends are terminal. Nothing returns to HELD, and no amount, owner, house
-- or date may change once written.
CREATE OR REPLACE FUNCTION public.settlement_holds_guard()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION
      'SETTLEMENT_HOLD_IMMUTABLE: a hold is never deleted — release it or cancel it';
  END IF;

  IF OLD.status <> 'HELD' THEN
    RAISE EXCEPTION
      'SETTLEMENT_HOLD_TERMINAL: hold on booking % is already %, and terminal',
      OLD.booking_id, OLD.status;
  END IF;

  IF NEW.status = OLD.status THEN
    RAISE EXCEPTION
      'SETTLEMENT_HOLD_IMMUTABLE: the only permitted updates move a hold to RELEASED or CANCELLED';
  END IF;

  -- PD-13a. Releasing early would hand the owner money that is still exposed to
  -- a refund, which is the exact failure this table exists to prevent.
  IF NEW.status = 'RELEASED' AND NEW.hold_until > CURRENT_DATE THEN
    RAISE EXCEPTION
      'SETTLEMENT_HOLD_NOT_YET_RELEASABLE: booking % is held until %, refund exposure has not expired',
      NEW.booking_id, NEW.hold_until;
  END IF;

  -- Nothing but the state fields may move.
  IF (to_jsonb(NEW) - 'status' - 'released_at' - 'release_txn_id' - 'cancelled_at')
     IS DISTINCT FROM
     (to_jsonb(OLD) - 'status' - 'released_at' - 'release_txn_id' - 'cancelled_at') THEN
    RAISE EXCEPTION
      'SETTLEMENT_HOLD_IMMUTABLE: amount, owner, house, currency and release date are fixed when the hold is created';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS settlement_holds_guard_trg ON public.settlement_holds;
CREATE TRIGGER settlement_holds_guard_trg
  BEFORE UPDATE OR DELETE ON public.settlement_holds
  FOR EACH ROW EXECUTE FUNCTION public.settlement_holds_guard();


-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Owner-readable, unlike booking_financials. A hold carries no PIMA margin — it
-- is the owner's own money and the date they will receive it, and an owner who
-- cannot see when they are due to be paid has a reasonable complaint.
--
-- No guest access: the arrival balance is between the guest and the house
-- (PD-04) and none of this concerns them. No anonymous access at all.
ALTER TABLE public.settlement_holds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settlement_holds_owner_admin_read" ON public.settlement_holds;
CREATE POLICY "settlement_holds_owner_admin_read" ON public.settlement_holds
  FOR SELECT USING (
    public.is_admin(auth.uid())
    OR owner_id = auth.uid()
  );

-- No INSERT, UPDATE or DELETE policy. Holds are created and settled solely by
-- the SECURITY DEFINER RPCs in 0147–0148.


-- ── Privileges ───────────────────────────────────────────────────────────────
-- Migration 0097 grants full DML on ALL TABLES and EXECUTE on ALL FUNCTIONS to
-- anon and authenticated, with default privileges repeating it for anything
-- created afterwards. Taking it back is mandatory, not housekeeping.
REVOKE ALL ON TABLE public.settlement_holds FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.settlement_holds TO authenticated;
-- RLS then narrows to owner-or-admin. No write privilege to anyone.

REVOKE ALL ON FUNCTION public.settlement_holds_populate() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.settlement_holds_guard()    FROM PUBLIC, anon, authenticated;


-- ── Documentation ────────────────────────────────────────────────────────────
COMMENT ON TABLE public.settlement_holds IS
  'PD-13a. Owner entitlement is recognised immediately; owner CASH is held while the deposit remains refundable and released on hold_until — check_in minus the booking''s own snapshotted partial_refund_days. One hold per booking. Derived columns are read from booking_financials by trigger, never accepted from the caller, so this is not a second source of truth.';

COMMENT ON COLUMN public.settlement_holds.hold_amount IS
  'owner_entitlement - (final_price - deposit_amount): what PIMA must transfer, being what the owner is owed less what the guest pays them at the door. Zero is legitimate on a high-margin Model A/B booking. Populated by trigger.';
COMMENT ON COLUMN public.settlement_holds.hold_until IS
  'Copied from booking_financials.owner_cash_release_date. A later platform policy change cannot move it. Releasing before this date is refused.';
COMMENT ON COLUMN public.settlement_holds.release_txn_id IS
  'The ledger entry that settled this hold. How MUCH was applied is answered by payout_bookings and the ledger, never stored here.';
