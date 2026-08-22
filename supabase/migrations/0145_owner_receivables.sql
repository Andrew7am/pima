-- ─────────────────────────────────────────────────────────────────────────────
-- 0145 — OWNER RECEIVABLES (PD-13b)
--
-- Money owed BY an owner TO PIMA. It exists for exactly one reason: PIMA
-- released the owner's cash, and afterwards a refund became due on that same
-- booking. The money is already gone, so the obligation has to be recorded
-- somewhere it can be recovered from — not quietly absorbed, and not left as a
-- negative number in a balance nobody owns.
--
-- ── WHAT THIS IS NOT ────────────────────────────────────────────────────────
--
-- Not entitlement, not a payout, not a hold, not commission, not the customer's
-- refund. Those already exist and none of them is a debt. In particular it is
-- NOT the BLOCKED-1 cash shortfall: that is PIMA discounting below the owner's
-- entitlement and funding the gap itself, and nobody owes it back.
--
-- ── ENTITLEMENT DOES NOT MOVE ───────────────────────────────────────────────
--
-- Recovering a receivable never touches owner_entitlement. The booking's terms
-- are an immutable fact of 0142 and stay 800 forever. What changes is what PIMA
-- PAYS on the next settlement:
--
--     entitlement 800 · outstanding receivable 100  →  owner payable 700
--
-- and the 100 is a separately identifiable, separately audited recovery event —
-- not a silent subtraction that leaves the reader unable to explain the number.
--
-- ── RECOVERY IS EVENTS, NOT A DECREMENTED BALANCE ───────────────────────────
--
-- There is deliberately no `amount_recovered` column to overwrite. Each recovery
-- is an append-only row in owner_receivable_recoveries carrying its own amount,
-- method, ledger entry and — when it was netted off a settlement — the payout it
-- came out of. Outstanding is `amount - SUM(recoveries)`, so the history can
-- always answer WHY the balance is what it is.
--
-- ── EVERY MOVEMENT HAS A LEDGER ENTRY ───────────────────────────────────────
--
-- created_txn_id and recovery txn_id are both NOT NULL. A receivable cannot
-- exist without the balanced double-entry transaction that created it, and a
-- recovery cannot exist without the one that effected it. 0141 remains the
-- authoritative record of money; these tables are the operational lifecycle
-- around it.
--
-- ── THE CEILING ─────────────────────────────────────────────────────────────
--
-- A receivable can never exceed what was actually paid to the owner for that
-- booking — SUM(payout_bookings.amount_applied). PIMA cannot claim back money it
-- never released. Enforced with the row locked, so concurrent refunds cannot
-- both pass the check.
--
-- ── WHAT IS NOT HERE ────────────────────────────────────────────────────────
--
-- No creation logic and no auto-deduction logic: 0148's refund and payout RPCs
-- do both, inside the transaction that posts the ledger entry. 0145 builds the
-- structure and the invariants that make those RPCs unable to get it wrong.
-- ─────────────────────────────────────────────────────────────────────────────


CREATE TABLE IF NOT EXISTS public.owner_receivables (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- To the HOLD, so a receivable can only arise on a booking whose obligation
  -- was actually recognised and settled.
  booking_id    TEXT NOT NULL REFERENCES public.settlement_holds(booking_id) ON DELETE RESTRICT,

  -- Derived from the booking snapshot by trigger. Never caller-supplied, so a
  -- receivable cannot be pointed at another owner or another house.
  owner_id      UUID    NOT NULL REFERENCES public.users(id)  ON DELETE RESTRICT,
  house_id      TEXT    NOT NULL REFERENCES public.houses(id) ON DELETE RESTRICT,
  currency      CHAR(3) NOT NULL,

  amount        NUMERIC(12,2) NOT NULL,
  reason        TEXT NOT NULL,

  -- The balanced ledger entry that created this obligation. Not optional.
  created_txn_id UUID NOT NULL REFERENCES public.fin_transactions(id) ON DELETE RESTRICT,

  -- PD-13b: the threshold IN FORCE WHEN THE RECEIVABLE AROSE. A later settings
  -- change must not retroactively decide that an old debt should have been
  -- escalated, or that an escalated one should not have been.
  threshold_at_creation NUMERIC(12,2) NOT NULL,

  -- Maintained by trigger from the recovery events; see the precedence below.
  status        TEXT NOT NULL DEFAULT 'OUTSTANDING',

  -- PD-13b escalation. An operational decision, not a derivable one: it depends
  -- on whether the owner has upcoming bookings, which changes over time.
  escalated_at     TIMESTAMPTZ,
  escalated_by     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  escalation_reason TEXT,

  created_by    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT or_amount_positive CHECK (amount > 0),
  CONSTRAINT or_currency_format CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT or_threshold_non_negative CHECK (threshold_at_creation >= 0),
  CONSTRAINT or_reason_present CHECK (length(btrim(reason)) > 0),

  -- Exactly the four states PD-13b names. No write-off and no cancellation:
  -- neither is an approved decision, and inventing one would be inventing a way
  -- to make a debt disappear.
  CONSTRAINT or_status_valid CHECK (status IN
    ('OUTSTANDING', 'PARTIALLY_RECOVERED', 'RECOVERED', 'EXPLICIT_REPAYMENT_REQUIRED')),

  CONSTRAINT or_escalation_complete CHECK (
    (escalated_at IS NULL AND escalated_by IS NULL)
    OR (escalated_at IS NOT NULL AND escalated_by IS NOT NULL AND escalation_reason IS NOT NULL)
  )
);


-- ── Recovery events (append-only) ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.owner_receivable_recoveries (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receivable_id  UUID NOT NULL REFERENCES public.owner_receivables(id) ON DELETE RESTRICT,

  amount         NUMERIC(12,2) NOT NULL,
  currency       CHAR(3) NOT NULL,

  -- How the money came back. PD-13b's two paths and nothing else.
  method         TEXT NOT NULL,

  -- Set when the recovery was netted off a settlement, so the deduction is
  -- traceable to the exact payout it came out of.
  payout_id      TEXT REFERENCES public.owner_payouts(id) ON DELETE RESTRICT,

  -- The balanced ledger entry that effected the recovery. Not optional.
  txn_id         UUID NOT NULL REFERENCES public.fin_transactions(id) ON DELETE RESTRICT,

  created_by     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT orr_amount_positive CHECK (amount > 0),
  CONSTRAINT orr_currency_format CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT orr_method_valid CHECK (method IN ('SETTLEMENT_DEDUCTION', 'EXPLICIT_REPAYMENT')),
  -- A settlement deduction names the settlement; an explicit repayment does not
  -- come out of one.
  CONSTRAINT orr_payout_matches_method CHECK (
    (method = 'SETTLEMENT_DEDUCTION' AND payout_id IS NOT NULL)
    OR (method = 'EXPLICIT_REPAYMENT' AND payout_id IS NULL)
  )
);


-- ── Indexes ──────────────────────────────────────────────────────────────────
-- The settlement question: what does this owner still owe?
CREATE INDEX IF NOT EXISTS or_owner_status_idx ON public.owner_receivables (owner_id, status);
CREATE INDEX IF NOT EXISTS or_outstanding_idx  ON public.owner_receivables (owner_id, currency)
  WHERE status <> 'RECOVERED';
CREATE INDEX IF NOT EXISTS or_booking_idx      ON public.owner_receivables (booking_id);
CREATE INDEX IF NOT EXISTS orr_receivable_idx  ON public.owner_receivable_recoveries (receivable_id);
CREATE INDEX IF NOT EXISTS orr_payout_idx      ON public.owner_receivable_recoveries (payout_id);


-- ── Identity is read from the booking, and the ceiling is enforced ───────────
CREATE OR REPLACE FUNCTION public.owner_receivables_validate()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  h        RECORD;
  v_paid   NUMERIC;
  v_claimed NUMERIC;
BEGIN
  -- Locked so two concurrent refunds on the same booking cannot both pass the
  -- ceiling check below.
  SELECT owner_id, house_id, currency
    INTO h
    FROM public.settlement_holds
   WHERE booking_id = NEW.booking_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'RECEIVABLE_NO_HOLD: booking % has no settlement hold — nothing was ever owed, so nothing can be owed back',
      NEW.booking_id;
  END IF;

  NEW.owner_id := h.owner_id;
  NEW.house_id := h.house_id;
  NEW.currency := h.currency;

  -- PIMA cannot claim back money it never released.
  SELECT COALESCE(SUM(amount_applied), 0) INTO v_paid
    FROM public.payout_bookings WHERE booking_id = NEW.booking_id;

  IF v_paid = 0 THEN
    RAISE EXCEPTION
      'RECEIVABLE_NOTHING_SETTLED: booking % has had no owner cash released — a post-settlement receivable cannot precede the settlement',
      NEW.booking_id;
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_claimed
    FROM public.owner_receivables WHERE booking_id = NEW.booking_id;

  IF v_claimed + NEW.amount > v_paid THEN
    RAISE EXCEPTION
      'RECEIVABLE_EXCEEDS_SETTLED: booking % released % to the owner, % already claimed back, attempted % — PIMA cannot recover more than it paid',
      NEW.booking_id, v_paid, v_claimed, NEW.amount;
  END IF;

  -- A fresh receivable always starts outstanding and unescalated.
  NEW.status := 'OUTSTANDING';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS owner_receivables_validate_trg ON public.owner_receivables;
CREATE TRIGGER owner_receivables_validate_trg
  BEFORE INSERT ON public.owner_receivables
  FOR EACH ROW EXECUTE FUNCTION public.owner_receivables_validate();


-- ── Recoveries: currency must match, and may not over-recover ────────────────
CREATE OR REPLACE FUNCTION public.owner_receivable_recoveries_validate()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  r           RECORD;
  v_recovered NUMERIC;
BEGIN
  SELECT amount, currency, owner_id INTO r
    FROM public.owner_receivables
   WHERE id = NEW.receivable_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'RECOVERY_NO_RECEIVABLE: receivable % does not exist', NEW.receivable_id;
  END IF;

  -- EGP 100 and USD 100 are not the same debt, and this codebase has no FX.
  IF NEW.currency IS DISTINCT FROM r.currency THEN
    RAISE EXCEPTION
      'RECOVERY_CURRENCY_MISMATCH: receivable is in %, recovery offered in % — currencies are never combined',
      r.currency, NEW.currency;
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_recovered
    FROM public.owner_receivable_recoveries WHERE receivable_id = NEW.receivable_id;

  IF v_recovered + NEW.amount > r.amount THEN
    RAISE EXCEPTION
      'RECOVERY_EXCEEDS_OUTSTANDING: receivable is %, % already recovered, attempted % — a debt cannot be over-recovered',
      r.amount, v_recovered, NEW.amount;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS owner_receivable_recoveries_validate_trg ON public.owner_receivable_recoveries;
CREATE TRIGGER owner_receivable_recoveries_validate_trg
  BEFORE INSERT ON public.owner_receivable_recoveries
  FOR EACH ROW EXECUTE FUNCTION public.owner_receivable_recoveries_validate();


-- ── Status follows the events ────────────────────────────────────────────────
-- Precedence, and the order matters: a fully recovered debt is settled whether
-- or not it was ever escalated, so RECOVERED wins over EXPLICIT_REPAYMENT_REQUIRED.
--
--   recovered >= amount        → RECOVERED
--   escalated                  → EXPLICIT_REPAYMENT_REQUIRED
--   recovered > 0              → PARTIALLY_RECOVERED
--   otherwise                  → OUTSTANDING
CREATE OR REPLACE FUNCTION public.owner_receivables_restate()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  r           RECORD;
  v_recovered NUMERIC;
  v_status    TEXT;
BEGIN
  SELECT amount, escalated_at INTO r FROM public.owner_receivables WHERE id = NEW.receivable_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_recovered
    FROM public.owner_receivable_recoveries WHERE receivable_id = NEW.receivable_id;

  IF v_recovered >= r.amount THEN      v_status := 'RECOVERED';
  ELSIF r.escalated_at IS NOT NULL THEN v_status := 'EXPLICIT_REPAYMENT_REQUIRED';
  ELSIF v_recovered > 0 THEN            v_status := 'PARTIALLY_RECOVERED';
  ELSE                                  v_status := 'OUTSTANDING';
  END IF;

  UPDATE public.owner_receivables SET status = v_status WHERE id = NEW.receivable_id;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS owner_receivables_restate_trg ON public.owner_receivable_recoveries;
CREATE TRIGGER owner_receivables_restate_trg
  AFTER INSERT ON public.owner_receivable_recoveries
  FOR EACH ROW EXECUTE FUNCTION public.owner_receivables_restate();


-- ── Immutability ─────────────────────────────────────────────────────────────
-- The debt itself never changes: not the amount, not the owner, not the booking,
-- not the threshold it was judged against. Only its lifecycle moves — status,
-- maintained by the trigger above, and the escalation fields an admin sets.
CREATE OR REPLACE FUNCTION public.owner_receivables_guard()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION
      'OWNER_RECEIVABLE_IMMUTABLE: a debt is never deleted — recover it, or record why it was not';
  END IF;

  IF (to_jsonb(NEW) - 'status' - 'escalated_at' - 'escalated_by' - 'escalation_reason')
     IS DISTINCT FROM
     (to_jsonb(OLD) - 'status' - 'escalated_at' - 'escalated_by' - 'escalation_reason') THEN
    RAISE EXCEPTION
      'OWNER_RECEIVABLE_IMMUTABLE: amount, owner, house, booking, currency and threshold are fixed when the receivable is created — record a recovery instead';
  END IF;

  IF OLD.status = 'RECOVERED' AND NEW.status <> 'RECOVERED' THEN
    RAISE EXCEPTION
      'OWNER_RECEIVABLE_SETTLED: receivable % is fully recovered and cannot be reopened', OLD.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS owner_receivables_guard_trg ON public.owner_receivables;
CREATE TRIGGER owner_receivables_guard_trg
  BEFORE UPDATE OR DELETE ON public.owner_receivables
  FOR EACH ROW EXECUTE FUNCTION public.owner_receivables_guard();

CREATE OR REPLACE FUNCTION public.owner_receivable_recoveries_append_only()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public, pg_temp AS $$
BEGIN
  RAISE EXCEPTION
    'RECOVERY_APPEND_ONLY: % is refused — a recovery that happened stays recorded; correct it with a ledger reversal',
    TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS owner_receivable_recoveries_append_only_trg ON public.owner_receivable_recoveries;
CREATE TRIGGER owner_receivable_recoveries_append_only_trg
  BEFORE UPDATE OR DELETE ON public.owner_receivable_recoveries
  FOR EACH ROW EXECUTE FUNCTION public.owner_receivable_recoveries_append_only();


-- ── RLS ──────────────────────────────────────────────────────────────────────
-- An owner may READ what they owe and how it has been recovered — being unable
-- to see a debt that will be netted off your next payment is not acceptable.
-- They may do nothing else: not create one, not alter one, not mark it
-- recovered, not move it to another owner. Every write is a definer RPC.
--
-- No guest access. No anonymous access.
ALTER TABLE public.owner_receivables            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_receivable_recoveries  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_receivables_owner_admin_read" ON public.owner_receivables;
CREATE POLICY "owner_receivables_owner_admin_read" ON public.owner_receivables
  FOR SELECT USING (
    public.is_admin(auth.uid())
    OR owner_id = auth.uid()
  );

DROP POLICY IF EXISTS "owner_receivable_recoveries_owner_admin_read" ON public.owner_receivable_recoveries;
CREATE POLICY "owner_receivable_recoveries_owner_admin_read" ON public.owner_receivable_recoveries
  FOR SELECT USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.owner_receivables r
      WHERE r.id = owner_receivable_recoveries.receivable_id
        AND r.owner_id = auth.uid()
    )
  );

-- No INSERT, UPDATE or DELETE policy on either table.


-- ── Privileges ───────────────────────────────────────────────────────────────
-- Migration 0097 grants full DML on ALL TABLES and EXECUTE on ALL FUNCTIONS to
-- anon and authenticated, with default privileges repeating it for anything
-- created afterwards. Taking it back is mandatory.
REVOKE ALL ON TABLE public.owner_receivables           FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.owner_receivable_recoveries FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.owner_receivables           TO authenticated;
GRANT SELECT ON TABLE public.owner_receivable_recoveries TO authenticated;

REVOKE ALL ON FUNCTION public.owner_receivables_validate()                FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.owner_receivable_recoveries_validate()      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.owner_receivables_restate()                 FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.owner_receivables_guard()                   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.owner_receivable_recoveries_append_only()   FROM PUBLIC, anon, authenticated;


-- ── Documentation ────────────────────────────────────────────────────────────
COMMENT ON TABLE public.owner_receivables IS
  'PD-13b. Money owed BY an owner TO PIMA after a refund followed a settlement. Never used for the BLOCKED-1 cash shortfall, which PIMA funds itself. Amount, owner, house, booking, currency and threshold are fixed at creation; only status and escalation move. Outstanding is amount minus SUM(owner_receivable_recoveries), never a stored decrement.';

COMMENT ON TABLE public.owner_receivable_recoveries IS
  'Append-only recovery events. Each carries its own amount, method, ledger entry and — for a settlement deduction — the payout it was netted off. This is what makes a reduced owner payment explainable rather than merely smaller.';

COMMENT ON COLUMN public.owner_receivables.threshold_at_creation IS
  'PD-13b: financial_settings.receivable_threshold as it stood when the receivable arose. Snapshotted so a later settings change cannot retroactively decide that an old debt should have been escalated.';
COMMENT ON COLUMN public.owner_receivables.status IS
  'Maintained by trigger from the recovery events. Precedence: RECOVERED (fully repaid, wins over escalation) > EXPLICIT_REPAYMENT_REQUIRED (escalated per PD-13b) > PARTIALLY_RECOVERED > OUTSTANDING.';
COMMENT ON COLUMN public.owner_receivables.created_txn_id IS
  'The balanced ledger entry that created this obligation. NOT NULL: a debt cannot exist without the double-entry transaction that recorded it.';
