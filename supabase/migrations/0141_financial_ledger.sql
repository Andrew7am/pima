-- ─────────────────────────────────────────────────────────────────────────────
-- 0141 — THE FINANCIAL LEDGER (append-only, double-entry)
--
-- Every figure the system has ever shown about money has been DERIVED: summed
-- from payment rows, inferred from a booking's status, recomputed on each render
-- by whichever screen happened to be open. Two screens one tap apart could and
-- did disagree, because nothing recorded what actually happened — only what
-- could be reconstructed from the current state of other tables.
--
-- This is that record. Not a cache of derived values, and not a log: the
-- authoritative statement of every movement of money, written once and never
-- altered.
--
-- ── WHY LEGS, AND NOT AN `amount` COLUMN ────────────────────────────────────
--
-- A single signed amount on a transaction can answer «how much», but not «whose,
-- from where, to where» — and it can never be proven consistent. These are the
-- questions the business actually asks, and none of them survive a one-column
-- design:
--
--   how much has PIMA received · what does it owe an owner · what has it already
--   paid · what does an owner owe back · what is owed to customers in refunds ·
--   what has been spent on promotions · what loyalty liability is outstanding ·
--   what is gross margin · what is net margin · does it all reconcile
--
-- So a transaction is a HEADER carrying business meaning, and its LEGS carry the
-- accounting. Every leg names an account and a signed amount, and the legs of a
-- transaction must sum to exactly zero. That invariant is enforced by a deferred
-- constraint trigger, which makes reconciliation PROVABLE rather than asserted:
-- an unbalanced entry cannot be committed by any path.
--
--     amount > 0  is a DEBIT      amount < 0  is a CREDIT
--
-- ── APPEND-ONLY IS ENFORCED, NOT PROMISED ───────────────────────────────────
--
-- No UPDATE, no DELETE, on either table — by absent policy, by revoked
-- privilege, AND by trigger. A mistake is corrected the way accountants correct
-- mistakes: with a reversing entry that points at what it reverses, leaving both
-- visible forever. Migration 0112 already established this principle for this
-- codebase when it stopped three delete buttons from destroying money records;
-- this applies it to the ledger itself.
--
-- Consequence worth stating plainly: the 0150 test-data reset must explicitly
-- DISABLE these triggers to clear the ledger, and must delete ledger rows BEFORE
-- bookings, because the ON DELETE RESTRICT below will otherwise refuse. A
-- destructive step should have to say out loud that it is destroying financial
-- history.
--
-- ── FK BEHAVIOUR FOLLOWS 0112 ───────────────────────────────────────────────
--
-- RESTRICT on booking, house and owner: a record with financial history is not
-- deletable. SET NULL on actor: who pressed the button is provenance, and losing
-- it should never block an account deletion.
--
-- ── TAX-READINESS (BLOCKED-7) ───────────────────────────────────────────────
--
-- Accounts live in a REFERENCE TABLE, not a CHECK enum. If PIMA's tax status is
-- ever established, tax accounts are added with an INSERT and no existing
-- structure changes. No tax rate, no tax column, and no assumed VAT anywhere.
--
-- ── WHAT IS NOT HERE ────────────────────────────────────────────────────────
--
-- No posting logic. Nothing writes to this ledger yet: the RPCs that post
-- customer payments, payouts, refunds and points arrive in 0147–0148, and the
-- booking snapshot they post against arrives in 0142. This migration builds the
-- book and rules the lines; it does not make an entry.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── Chart of accounts ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.fin_accounts (
  code       TEXT PRIMARY KEY,
  nature     TEXT NOT NULL,
  label_ar   TEXT NOT NULL,
  description TEXT,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fa_nature_valid CHECK (nature IN ('ASSET', 'LIABILITY', 'INCOME', 'EXPENSE')),
  CONSTRAINT fa_code_format  CHECK (code ~ '^[A-Z][A-Z0-9_]{2,49}$')
);

INSERT INTO public.fin_accounts (code, nature, label_ar, description) VALUES
  ('PIMA_CASH',                 'ASSET',     'نقدية بيما',
   'Money PIMA actually holds. The arrival balance the guest pays the house directly is NOT here and never will be (PD-04).'),
  ('OWNER_PAYABLE',             'LIABILITY', 'مستحقات أصحاب البيوت',
   'Owner entitlement recognised and not yet transferred. party_id is the owner.'),
  ('OWNER_RECEIVABLE',          'ASSET',     'مديونية أصحاب البيوت',
   'Owed BY an owner to PIMA, from a refund that followed a settlement (PD-13b). Never used for the PD-1 cash shortfall, which is PIMA-funded.'),
  ('CUSTOMER_REFUND_PAYABLE',   'LIABILITY', 'مبالغ مستردة مستحقة للعملاء',
   'A refund decided and not yet paid. Separating this from PIMA_CASH is what makes «what do we owe customers right now» answerable.'),
  ('PIMA_REVENUE',              'INCOME',    'إيراد بيما',
   'Gross margin. Also the designated rounding plug on partial payments, so PIMA absorbs rounding and never the owner or the customer.'),
  ('PIMA_PROMO_EXPENSE',        'EXPENSE',   'تكلفة العروض الترويجية',
   'PIMA-funded promotion. Expensed on consumption — a promotion has no prior accrual.'),
  ('PIMA_POINTS_EXPENSE',       'EXPENSE',   'تكلفة استبدال النقاط',
   'Points cost attributed to the booking that redeemed them (PD-17).'),
  ('PIMA_LOYALTY_EXPENSE',      'EXPENSE',   'تكلفة برنامج الولاء',
   'Points expense at EARNING, at programme level. NEVER included in any booking margin — that exclusion is what makes PD-17 true.'),
  ('POINTS_LIABILITY',          'LIABILITY', 'التزام نقاط الولاء',
   'Outstanding loyalty points at EGP value. Credited when points are earned, debited when they are redeemed, re-credited pro-rata when a cancellation restores them (PD-18). Reconciles to SUM(users.points) / points_per_egp.'),
  ('POINTS_APPLIED',            'LIABILITY', 'نقاط مستخدمة تحت التسوية',
   'Consideration tendered in points, awaiting application to a settlement. Nets to zero once a booking is fully paid or fully cancelled.'),
  ('PIMA_TRANSFER_FEE_EXPENSE', 'EXPENSE',   'رسوم التحويل',
   'ACTUAL transfer cost, posted at payout. The configured cap is a booking-time projection only and is never posted (PD-09).')
ON CONFLICT (code) DO NOTHING;


-- ── Transactions (the header: what happened, and why) ────────────────────────

CREATE TABLE IF NOT EXISTS public.fin_transactions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  txn_type         TEXT NOT NULL,

  -- RESTRICT, per 0112: a record carrying financial history is not deletable.
  booking_id       TEXT REFERENCES public.bookings(id) ON DELETE RESTRICT,
  house_id         TEXT REFERENCES public.houses(id)   ON DELETE RESTRICT,
  owner_id         UUID REFERENCES public.users(id)    ON DELETE RESTRICT,
  -- Provenance only. Losing who pressed the button must not block a deletion.
  actor_id         UUID REFERENCES public.users(id)    ON DELETE SET NULL,

  currency         CHAR(3) NOT NULL DEFAULT 'EGP',

  reference_type   TEXT,
  reference_id     TEXT,

  -- A correction points at what it corrects. Both rows survive.
  reverses_txn_id  UUID REFERENCES public.fin_transactions(id) ON DELETE RESTRICT,

  -- The backstop against creating money twice. A replayed request cannot post a
  -- second entry even if an application-level check is missed.
  idempotency_key  TEXT UNIQUE,

  memo             TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT ft_type_valid CHECK (txn_type IN (
    'customer_payment',
    'pima_gross_margin',
    'pima_promotion_cost',
    'points_liability',
    'points_redemption_cost',
    'owner_entitlement',
    'owner_payout',
    'owner_receivable',
    'refund',
    'transfer_fee',
    'cancellation_forfeit',
    'adjustment',
    'reversal'
  )),
  CONSTRAINT ft_currency_format CHECK (currency ~ '^[A-Z]{3}$'),
  -- Only a reversal reverses something, and nothing reverses itself.
  CONSTRAINT ft_reversal_shape CHECK (
    (reverses_txn_id IS NULL) OR (txn_type = 'reversal' AND reverses_txn_id <> id)
  )
);


-- ── Legs (the accounting: whose money moved, and in which direction) ─────────

CREATE TABLE IF NOT EXISTS public.fin_transaction_legs (
  id       BIGSERIAL PRIMARY KEY,
  txn_id   UUID NOT NULL REFERENCES public.fin_transactions(id) ON DELETE RESTRICT,
  account  TEXT NOT NULL REFERENCES public.fin_accounts(code)   ON DELETE RESTRICT,

  -- Positive is a debit, negative a credit. A zero leg records nothing and is
  -- refused rather than stored as noise.
  amount   NUMERIC(12,2) NOT NULL,

  -- The owner or guest this leg belongs to, where the account is party-scoped
  -- (OWNER_PAYABLE, OWNER_RECEIVABLE, POINTS_APPLIED).
  party_id UUID REFERENCES public.users(id) ON DELETE RESTRICT,

  CONSTRAINT ftl_amount_nonzero CHECK (amount <> 0)
);


-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS fin_legs_txn_idx     ON public.fin_transaction_legs (txn_id);
CREATE INDEX IF NOT EXISTS fin_legs_acct_idx    ON public.fin_transaction_legs (account, party_id);
CREATE INDEX IF NOT EXISTS fin_txn_booking_idx  ON public.fin_transactions (booking_id);
CREATE INDEX IF NOT EXISTS fin_txn_owner_idx    ON public.fin_transactions (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS fin_txn_type_idx     ON public.fin_transactions (txn_type, created_at DESC);


-- ── The balance invariant ────────────────────────────────────────────────────
-- Deferred to commit, so a transaction may be written header-first and its legs
-- added afterwards within the same transaction. Checked from BOTH directions: a
-- header with no legs is as wrong as legs that do not sum to zero, and checking
-- only the legs would never catch the former.
CREATE OR REPLACE FUNCTION public.fin_assert_balanced()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public, pg_temp AS $$
DECLARE
  v_txn   UUID;
  v_count INTEGER;
  v_sum   NUMERIC;
BEGIN
  -- IF/ELSE, not a CASE expression: PL/pgSQL resolves every arm of a CASE as
  -- part of one SQL expression, so NEW.txn_id would be looked up even when NEW
  -- is a fin_transactions record that has no such field.
  IF TG_TABLE_NAME = 'fin_transactions' THEN
    v_txn := NEW.id;
  ELSE
    v_txn := NEW.txn_id;
  END IF;

  SELECT COUNT(*), COALESCE(SUM(amount), 0)
    INTO v_count, v_sum
    FROM public.fin_transaction_legs
   WHERE txn_id = v_txn;

  IF v_count = 0 THEN
    RAISE EXCEPTION
      'FIN_TXN_EMPTY: transaction % has no legs — a financial event with no movement is not an event', v_txn;
  END IF;

  IF v_sum <> 0 THEN
    RAISE EXCEPTION
      'FIN_TXN_UNBALANCED: transaction % legs sum to %, must be exactly 0', v_txn, v_sum;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS fin_txn_balanced ON public.fin_transactions;
CREATE CONSTRAINT TRIGGER fin_txn_balanced
  AFTER INSERT ON public.fin_transactions
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.fin_assert_balanced();

DROP TRIGGER IF EXISTS fin_legs_balanced ON public.fin_transaction_legs;
CREATE CONSTRAINT TRIGGER fin_legs_balanced
  AFTER INSERT ON public.fin_transaction_legs
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.fin_assert_balanced();


-- ── A reversal must match what it reverses ───────────────────────────────────
-- Its own function, on fin_transactions only, rather than a branch inside the
-- shared balance check: PL/pgSQL resolves a record field as part of whichever
-- expression mentions it, so `NEW.reverses_txn_id` in a function that also fires
-- for leg rows fails on the field that record does not have.
--
-- Why the rule matters: a reversal carrying a different scope corrects balances
-- it does not appear to belong to — and the read policies below would show an
-- owner the original entry while hiding its reversal, leaving them looking at a
-- balance the ledger has already corrected.
CREATE OR REPLACE FUNCTION public.fin_assert_reversal_scope()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public, pg_temp AS $$
DECLARE
  v_b TEXT;
  v_h TEXT;
  v_o UUID;
BEGIN
  IF NEW.reverses_txn_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- A non-reversal carrying a pointer is ft_reversal_shape's business, and its
  -- message says so far more clearly. BEFORE triggers run ahead of CHECK
  -- constraints, so stand aside and let the constraint speak.
  IF NEW.txn_type <> 'reversal' THEN
    RETURN NEW;
  END IF;

  SELECT booking_id, house_id, owner_id INTO v_b, v_h, v_o
    FROM public.fin_transactions WHERE id = NEW.reverses_txn_id;

  IF NEW.booking_id IS DISTINCT FROM v_b
     OR NEW.house_id IS DISTINCT FROM v_h
     OR NEW.owner_id IS DISTINCT FROM v_o THEN
    RAISE EXCEPTION
      'FIN_REVERSAL_SCOPE_MISMATCH: reversal must carry the same booking, house and owner as the transaction it reverses (%)',
      NEW.reverses_txn_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS fin_txn_reversal_scope ON public.fin_transactions;
CREATE TRIGGER fin_txn_reversal_scope
  BEFORE INSERT ON public.fin_transactions
  FOR EACH ROW EXECUTE FUNCTION public.fin_assert_reversal_scope();


-- ── Append-only ──────────────────────────────────────────────────────────────
-- Belt and braces over the absent policies and revoked privileges below: even a
-- SECURITY DEFINER function running as the table owner cannot rewrite history.
CREATE OR REPLACE FUNCTION public.fin_append_only()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public, pg_temp AS $$
BEGIN
  RAISE EXCEPTION
    'FIN_LEDGER_APPEND_ONLY: % on %.% is refused — correct with a reversal or adjustment entry, never by editing history',
    TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME;
END;
$$;

DROP TRIGGER IF EXISTS fin_transactions_append_only ON public.fin_transactions;
CREATE TRIGGER fin_transactions_append_only
  BEFORE UPDATE OR DELETE ON public.fin_transactions
  FOR EACH ROW EXECUTE FUNCTION public.fin_append_only();

DROP TRIGGER IF EXISTS fin_legs_append_only ON public.fin_transaction_legs;
CREATE TRIGGER fin_legs_append_only
  BEFORE UPDATE OR DELETE ON public.fin_transaction_legs
  FOR EACH ROW EXECUTE FUNCTION public.fin_append_only();


-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Read-only for everyone who can see anything at all. There is no INSERT policy
-- on either ledger table, deliberately: entries are posted exclusively by the
-- SECURITY DEFINER RPCs in 0147–0148, which run as the table owner and are the
-- only place the posting rules exist.
--
-- The customer is absent on purpose. A guest's money reaches them through
-- fin_booking_summary in 0149 — a narrow projection — not through raw ledger rows.
ALTER TABLE public.fin_accounts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_transactions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_transaction_legs  ENABLE ROW LEVEL SECURITY;

-- The chart of accounts is reference data: any signed-in user rendering a ledger
-- view needs the labels.
DROP POLICY IF EXISTS "fin_accounts_read" ON public.fin_accounts;
CREATE POLICY "fin_accounts_read" ON public.fin_accounts
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "fin_accounts_admin_write" ON public.fin_accounts;
CREATE POLICY "fin_accounts_admin_write" ON public.fin_accounts
  FOR INSERT WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "fin_transactions_owner_admin_read" ON public.fin_transactions;
CREATE POLICY "fin_transactions_owner_admin_read" ON public.fin_transactions
  FOR SELECT USING (
    public.is_admin(auth.uid())
    OR owner_id = auth.uid()
  );

DROP POLICY IF EXISTS "fin_legs_owner_admin_read" ON public.fin_transaction_legs;
CREATE POLICY "fin_legs_owner_admin_read" ON public.fin_transaction_legs
  FOR SELECT USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.fin_transactions t
      WHERE t.id = fin_transaction_legs.txn_id
        AND t.owner_id = auth.uid()
    )
  );

-- No INSERT, UPDATE or DELETE policy on either ledger table. Deliberate.


-- ── Privileges ───────────────────────────────────────────────────────────────
-- Migration 0097 grants full DML on ALL TABLES and EXECUTE on ALL FUNCTIONS to
-- anon and authenticated, with default privileges repeating it for anything
-- created afterwards. Every object here therefore arrives publicly writable
-- unless this migration takes it back explicitly.
REVOKE ALL ON TABLE public.fin_accounts         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.fin_transactions     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.fin_transaction_legs FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.fin_accounts         TO authenticated;
GRANT SELECT ON TABLE public.fin_transactions     TO authenticated;
GRANT SELECT ON TABLE public.fin_transaction_legs TO authenticated;
-- No INSERT/UPDATE/DELETE to anyone. Posting is the definer RPCs' job alone.

REVOKE ALL ON SEQUENCE public.fin_transaction_legs_id_seq FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.fin_assert_balanced()        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fin_assert_reversal_scope() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fin_append_only()     FROM PUBLIC, anon, authenticated;


-- ── Documentation ────────────────────────────────────────────────────────────
COMMENT ON TABLE public.fin_accounts IS
  'Chart of accounts. A reference table rather than a CHECK enum so future tax accounts can be added by INSERT without altering any existing structure (BLOCKED-7 tax-readiness). No tax accounts exist today.';

COMMENT ON TABLE public.fin_transactions IS
  'Append-only financial event header. One row per thing that happened; the accounting lives in fin_transaction_legs, whose amounts must sum to zero. Corrections are reversal entries pointing at reverses_txn_id — history is never edited. Posted exclusively by SECURITY DEFINER RPCs.';

COMMENT ON TABLE public.fin_transaction_legs IS
  'Double-entry legs. amount > 0 is a debit, amount < 0 is a credit; the legs of a transaction sum to exactly zero, enforced by the deferred fin_legs_balanced constraint trigger. This is what makes every balance in the system provable rather than asserted.';

COMMENT ON COLUMN public.fin_transactions.idempotency_key IS
  'UNIQUE. The backstop against creating money twice: a replayed request cannot post a second entry even if an application-level check is missed.';
COMMENT ON COLUMN public.fin_transaction_legs.party_id IS
  'The owner or guest a party-scoped account balance belongs to (OWNER_PAYABLE, OWNER_RECEIVABLE, POINTS_APPLIED). NULL for platform-level accounts.';
