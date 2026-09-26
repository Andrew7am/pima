-- Phase 6 test fixture — production schema as it stood BEFORE 0172.
--
-- Extracted read-only from production (PostgreSQL 17.6) on 2026-09-25 with
-- pg_get_functiondef / pg_get_constraintdef / pg_get_triggerdef. It exists so
-- 0172 and 0173 can be executed — not read — against the real invariants
-- without any write to production.
--
-- FIDELITY: every public.* function below is the exact production definition.
-- src/lib/phase6Ledger.test.ts asserts md5 of each function body (line endings
-- normalised) against the value production reported, so a transcription error
-- here fails the suite rather than silently weakening it.
--
-- The eleven money tables are exact: columns, generated expressions, defaults,
-- constraints, triggers, RLS policies and grants.
--
-- STAND-INS (not exact, and not what is under test): users, houses, bookings,
-- house_agreements, notifications, audit_log carry only the columns the code
-- under test touches. bookings has RLS disabled and only its privileged-column
-- trigger; its other twenty production triggers (points, notifications,
-- capacity, audit) are not reproduced. payments keeps its two money triggers;
-- its notification, audit and banned-user triggers are not reproduced.

-- ── roles and auth ─────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END $$;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

CREATE SCHEMA IF NOT EXISTS auth;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION auth.uid()
 RETURNS uuid
 LANGUAGE sql
 STABLE
AS $function$
  select
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$function$;

-- ── stand-ins ──────────────────────────────────────────────────────────────
CREATE TABLE public.users (
  id        uuid PRIMARY KEY,
  name      text,
  role      text NOT NULL DEFAULT 'user',
  is_banned boolean NOT NULL DEFAULT false,
  points    integer NOT NULL DEFAULT 0
);
CREATE TABLE public.houses (
  id       text PRIMARY KEY,
  owner_id uuid REFERENCES public.users(id),
  name     text
);
CREATE TABLE public.house_agreements (id uuid PRIMARY KEY);
CREATE TABLE public.bookings (
  id                        text PRIMARY KEY,
  house_id                  text REFERENCES public.houses(id),
  house_name                text,
  user_id                   uuid REFERENCES public.users(id),
  user_name                 text,
  status                    text NOT NULL DEFAULT 'pending',
  payment_status            text NOT NULL DEFAULT 'unpaid',
  check_in                  date NOT NULL,
  check_out                 date NOT NULL,
  deposit_paid              boolean DEFAULT false,
  deposit_amount            numeric DEFAULT 0,
  total_price               numeric DEFAULT 0,
  checked_in_at             timestamptz,
  checked_out_at            timestamptz,
  points_awarded_for_amount numeric DEFAULT 0,
  discount_pct_applied      numeric,
  price_before_discount     numeric,
  owner_settled_at          timestamptz,
  source                    text,
  created_by                uuid,
  updated_at                timestamptz DEFAULT now(),
  CONSTRAINT bookings_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'completed'::text, 'cancelled'::text]))),
  CONSTRAINT bookings_payment_status_check CHECK ((payment_status = ANY (ARRAY['unpaid'::text, 'pending_verification'::text, 'paid_deposit'::text, 'paid_full'::text])))
);
CREATE TABLE public.notifications (
  id text PRIMARY KEY, user_id uuid, booking_id text, title text, message text, type text,
  is_read boolean DEFAULT false, created_at timestamptz DEFAULT now()
);
CREATE TABLE public.audit_log (
  id bigserial PRIMARY KEY, actor_id uuid, actor_name text, actor_role text, action text,
  target_type text, target_id text, details text, created_at timestamptz DEFAULT now()
);
CREATE FUNCTION public.ar_audit_status(p_kind text, p_status text)
 RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT p_status $$;

GRANT SELECT ON public.users, public.houses TO authenticated;
GRANT SELECT, UPDATE ON public.bookings TO authenticated;

-- ── exact production functions ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin(uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = uid AND role = 'admin');
$function$;

CREATE OR REPLACE FUNCTION public.is_active(uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT COALESCE(NOT u.is_banned, FALSE) FROM public.users u WHERE u.id = uid;
$function$;

CREATE OR REPLACE FUNCTION public.fin_append_only()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RAISE EXCEPTION
    'FIN_LEDGER_APPEND_ONLY: % on %.% is refused — correct with a reversal or adjustment entry, never by editing history',
    TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fin_assert_balanced()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.fin_assert_reversal_scope()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.fin_transfer_fee(p_amount numeric)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE f RECORD;
BEGIN
  -- A NULL or negative transfer amount is a caller bug, not a zero-fee transfer.
  -- Coalescing it away would return the floor and let a broken projection look
  -- like a cheap one; refuse it instead.
  IF p_amount IS NULL OR p_amount < 0 THEN
    RAISE EXCEPTION 'INVALID_TRANSFER_AMOUNT: %', COALESCE(p_amount::text, 'NULL');
  END IF;

  SELECT * INTO f FROM public.financial_settings
   WHERE effective_to IS NULL ORDER BY effective_from DESC LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NO_FINANCIAL_SETTINGS: no open financial_settings version';
  END IF;

  RETURN GREATEST(f.transfer_fee_min, ROUND(p_amount * f.transfer_fee_rate, 2));
END;
$function$;

CREATE OR REPLACE FUNCTION public.booking_financials_immutable()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RAISE EXCEPTION
    'BOOKING_FINANCIALS_IMMUTABLE: % is refused — a booking''s agreed terms are never rewritten; correct the money in the ledger instead',
    TG_OP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.settlement_holds_populate()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.settlement_holds_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.payout_bookings_append_only()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RAISE EXCEPTION
    'PAYOUT_LINKAGE_APPEND_ONLY: % is refused — reverse the ledger entry and issue a further payout instead of rewriting what was settled',
    TG_OP;
END;
$function$;

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
$function$;

CREATE OR REPLACE FUNCTION public.owner_receivables_validate()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.owner_receivables_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.owner_receivable_recoveries_validate()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.owner_receivable_recoveries_append_only()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RAISE EXCEPTION
    'RECOVERY_APPEND_ONLY: % is refused — a recovery that happened stays recorded; correct it with a ledger reversal',
    TG_OP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.owner_receivables_restate()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.protect_payment_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF current_user <> 'authenticated' THEN
    RETURN NEW;
  END IF;
  IF public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Only a human reviewer moves a payment out of 'pending'.
    NEW.payment_status := 'pending';

    -- The RLS policy only checked user_id, so booking_id was free. Filing a
    -- payment against someone else's booking corrupted their balance and
    -- sent them a notification about money they never transferred.
    IF NOT EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = NEW.booking_id AND b.user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'PAYMENT_BOOKING_NOT_OWNED';
    END IF;

    RETURN NEW;
  END IF;

  -- UPDATE. Today no RLS policy lets a non-admin update payments at all
  -- (016 grants UPDATE to admins only), so this is defence in depth: if a
  -- policy is ever widened, the money columns still cannot move.
  NEW.amount         := OLD.amount;
  NEW.booking_id     := OLD.booking_id;
  NEW.user_id        := OLD.user_id;
  NEW.payment_status := OLD.payment_status;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.stamp_payment_review()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
    NEW.previous_status := OLD.payment_status;
    NEW.reviewed_at     := NOW();
    NEW.reviewed_by     := auth.uid();   -- NULL for service-role / SQL editor
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_refund(p_payment_id text, p_amount numeric, p_method text DEFAULT NULL::text, p_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_amount NUMERIC;
  v_status TEXT;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'NOT_ALLOWED';
  END IF;

  SELECT amount, payment_status INTO v_amount, v_status
    FROM public.payments WHERE id = p_payment_id;
  IF v_amount IS NULL THEN
    RAISE EXCEPTION 'PAYMENT_NOT_FOUND';
  END IF;
  -- Refunding money that was never accepted would invent an outflow.
  IF v_status <> 'approved' THEN
    RAISE EXCEPTION 'PAYMENT_NOT_APPROVED';
  END IF;
  IF p_amount <= 0 OR p_amount > v_amount THEN
    RAISE EXCEPTION 'REFUND_AMOUNT_OUT_OF_RANGE';
  END IF;

  UPDATE public.payments
     SET refunded_amount = p_amount,
         refunded_at     = NOW(),
         refunded_by     = auth.uid(),
         refund_method   = p_method,
         refund_note     = p_note
   WHERE id = p_payment_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.protect_booking_privileged_columns()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  is_house_owner BOOLEAN;
BEGIN
  IF current_user <> 'authenticated' THEN
    RETURN NEW;
  END IF;

  is_house_owner := EXISTS (
    SELECT 1 FROM public.houses h WHERE h.id = NEW.house_id AND h.owner_id = auth.uid()
  );
  IF public.is_admin(auth.uid()) OR is_house_owner THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.status                   := 'pending';
    NEW.payment_status           := 'unpaid';
    NEW.deposit_paid             := FALSE;
    NEW.checked_in_at            := NULL;
    NEW.checked_out_at           := NULL;
    NEW.points_awarded_for_amount := 0;
    RETURN NEW;
  END IF;

  -- UPDATE by the guest: revert privileged columns, EXCEPT allow
  -- self-cancel from 'pending' or 'approved' (cancellation policy).
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'cancelled' AND OLD.status IN ('pending', 'approved') THEN
      NULL;
    ELSE
      NEW.status := OLD.status;
    END IF;
  END IF;

  NEW.deposit_paid              := OLD.deposit_paid;
  NEW.checked_in_at             := OLD.checked_in_at;
  NEW.checked_out_at            := OLD.checked_out_at;
  NEW.points_awarded_for_amount := OLD.points_awarded_for_amount;

  IF NEW.payment_status IS DISTINCT FROM OLD.payment_status
     AND NEW.payment_status <> 'pending_verification' THEN
    NEW.payment_status := OLD.payment_status;
  END IF;

  NEW.deposit_amount := OLD.deposit_amount;

  NEW.house_id   := OLD.house_id;
  NEW.house_name := OLD.house_name;

  -- The discount that was agreed when the booking was made. Neither is
  -- ever a guest's to change.
  NEW.discount_pct_applied  := OLD.discount_pct_applied;
  NEW.price_before_discount := OLD.price_before_discount;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.audit_payout_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  a_name TEXT;
  a_role TEXT;
  o_name TEXT;
  h_name TEXT;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT name, role INTO a_name, a_role FROM public.users WHERE id = auth.uid();
    SELECT name INTO o_name FROM public.users  WHERE id = NEW.owner_id;
    SELECT name INTO h_name FROM public.houses WHERE id = NEW.house_id;
    INSERT INTO public.audit_log (actor_id, actor_name, actor_role, action, target_type, target_id, details)
    VALUES (
      auth.uid(), COALESCE(a_name, 'غير معروف'), a_role, 'payout_status_changed', 'payout', NEW.id,
      'حالة التحويل: ' || public.ar_audit_status('payout', OLD.status) ||
        ' ← ' || public.ar_audit_status('payout', NEW.status) ||
        ' | المبلغ: ' || COALESCE(NEW.amount::TEXT, '0') || ' ج.م' ||
        ' | المالك: ' || COALESCE(o_name, '') ||
        ' | البيت: "' || COALESCE(h_name, '') || '"'
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_owner_on_payout_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  amt TEXT := round(NEW.amount)::text;
  nid TEXT := 'notif_payout_' || NEW.id || '_' || NEW.status || '_' || extract(epoch FROM clock_timestamp())::bigint;
BEGIN
  -- On UPDATE, only fire when the status actually changed.
  IF TG_OP = 'UPDATE' AND NEW.status = OLD.status THEN RETURN NEW; END IF;

  IF NEW.status = 'completed' THEN
    INSERT INTO public.notifications (id, user_id, booking_id, title, message, type, is_read)
    VALUES (nid, NEW.owner_id, NULL,
      'تم تحويل مستحقاتك ✓',
      'تم تحويل ' || amt || ' ج.م من مستحقاتك بنجاح. يرجى التحقق من محفظتك.',
      'success', FALSE);
  ELSIF NEW.status = 'processing' THEN
    INSERT INTO public.notifications (id, user_id, booking_id, title, message, type, is_read)
    VALUES (nid, NEW.owner_id, NULL,
      'جارٍ تحويل مستحقاتك',
      'بدأت الإدارة في تحويل ' || amt || ' ج.م من مستحقاتك.',
      'info', FALSE);
  ELSIF NEW.status = 'rejected' THEN
    INSERT INTO public.notifications (id, user_id, booking_id, title, message, type, is_read)
    VALUES (nid, NEW.owner_id, NULL,
      'تعذّر تحويل مستحقاتك',
      'تم رفض طلب تحويل ' || amt || ' ج.م. يرجى مراجعة الإدارة.',
      'danger', FALSE);
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_cash_deposit(p_booking_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  b RECORD;
  v_owner UUID;
BEGIN
  SELECT id, house_id, user_id, user_name, deposit_amount, total_price, status
    INTO b FROM public.bookings WHERE id = p_booking_id;
  IF b.id IS NULL THEN RAISE EXCEPTION 'BOOKING_NOT_FOUND'; END IF;

  SELECT owner_id INTO v_owner FROM public.houses WHERE id = b.house_id;
  IF v_owner IS DISTINCT FROM auth.uid() AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'NOT_THE_OWNER';
  END IF;
  IF b.status IN ('cancelled', 'rejected') THEN
    RAISE EXCEPTION 'BOOKING_NOT_LIVE';
  END IF;

  -- Idempotent: confirming twice must not file the deposit twice, and the
  -- owner tapping again after a dropped connection is the normal case.
  IF EXISTS (
    SELECT 1 FROM public.payments
     WHERE booking_id = b.id AND payment_method = 'cash' AND payment_status = 'approved'
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.payments (
    id, booking_id, user_id, user_name, amount,
    payment_method, payment_status, payment_date, admin_notes
  ) VALUES (
    'pay_cash_' || b.id, b.id, b.user_id, COALESCE(b.user_name, 'ضيف'),
    COALESCE(b.deposit_amount, 0),
    'cash', 'approved', NOW(),
    'عربون استلمه صاحب البيت نقداً — سجّله بنفسه'
  );

  UPDATE public.bookings
     SET deposit_paid = TRUE, payment_status = 'paid_deposit'
   WHERE id = b.id;
END;
$function$;

-- ── exact production tables ────────────────────────────────────────────────
CREATE SEQUENCE public.fin_transaction_legs_id_seq;
CREATE SEQUENCE public.financial_settings_id_seq;

CREATE TABLE public.fin_accounts (
  code text NOT NULL,
  nature text NOT NULL,
  label_ar text NOT NULL,
  description text,
  active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public.fin_accounts ADD CONSTRAINT fin_accounts_pkey PRIMARY KEY (code);
ALTER TABLE public.fin_accounts ADD CONSTRAINT fa_code_format CHECK ((code ~ '^[A-Z][A-Z0-9_]{2,49}$'::text));
ALTER TABLE public.fin_accounts ADD CONSTRAINT fa_nature_valid CHECK ((nature = ANY (ARRAY['ASSET'::text, 'LIABILITY'::text, 'INCOME'::text, 'EXPENSE'::text])));

CREATE TABLE public.fin_transactions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  txn_type text NOT NULL,
  booking_id text,
  house_id text,
  owner_id uuid,
  actor_id uuid,
  currency character(3) DEFAULT 'EGP'::bpchar NOT NULL,
  reference_type text,
  reference_id text,
  reverses_txn_id uuid,
  idempotency_key text,
  memo text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public.fin_transactions ADD CONSTRAINT fin_transactions_idempotency_key_key UNIQUE (idempotency_key);
ALTER TABLE public.fin_transactions ADD CONSTRAINT fin_transactions_pkey PRIMARY KEY (id);
ALTER TABLE public.fin_transactions ADD CONSTRAINT fin_transactions_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.fin_transactions ADD CONSTRAINT fin_transactions_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE RESTRICT;
ALTER TABLE public.fin_transactions ADD CONSTRAINT fin_transactions_house_id_fkey FOREIGN KEY (house_id) REFERENCES houses(id) ON DELETE RESTRICT;
ALTER TABLE public.fin_transactions ADD CONSTRAINT fin_transactions_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.fin_transactions ADD CONSTRAINT fin_transactions_reverses_txn_id_fkey FOREIGN KEY (reverses_txn_id) REFERENCES fin_transactions(id) ON DELETE RESTRICT;
ALTER TABLE public.fin_transactions ADD CONSTRAINT ft_currency_format CHECK ((currency ~ '^[A-Z]{3}$'::text));
ALTER TABLE public.fin_transactions ADD CONSTRAINT ft_reversal_shape CHECK (((reverses_txn_id IS NULL) OR ((txn_type = 'reversal'::text) AND (reverses_txn_id <> id))));
ALTER TABLE public.fin_transactions ADD CONSTRAINT ft_type_valid CHECK ((txn_type = ANY (ARRAY['customer_payment'::text, 'pima_gross_margin'::text, 'pima_promotion_cost'::text, 'points_liability'::text, 'points_redemption_cost'::text, 'owner_entitlement'::text, 'owner_payout'::text, 'owner_receivable'::text, 'refund'::text, 'transfer_fee'::text, 'cancellation_forfeit'::text, 'adjustment'::text, 'reversal'::text])));

CREATE TABLE public.fin_transaction_legs (
  id bigint DEFAULT nextval('fin_transaction_legs_id_seq'::regclass) NOT NULL,
  txn_id uuid NOT NULL,
  account text NOT NULL,
  amount numeric(12,2) NOT NULL,
  party_id uuid
);
ALTER TABLE public.fin_transaction_legs ADD CONSTRAINT fin_transaction_legs_pkey PRIMARY KEY (id);
ALTER TABLE public.fin_transaction_legs ADD CONSTRAINT fin_transaction_legs_account_fkey FOREIGN KEY (account) REFERENCES fin_accounts(code) ON DELETE RESTRICT;
ALTER TABLE public.fin_transaction_legs ADD CONSTRAINT fin_transaction_legs_party_id_fkey FOREIGN KEY (party_id) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.fin_transaction_legs ADD CONSTRAINT fin_transaction_legs_txn_id_fkey FOREIGN KEY (txn_id) REFERENCES fin_transactions(id) ON DELETE RESTRICT;
ALTER TABLE public.fin_transaction_legs ADD CONSTRAINT ftl_amount_nonzero CHECK ((amount <> (0)::numeric));

CREATE TABLE public.financial_settings (
  id bigint DEFAULT nextval('financial_settings_id_seq'::regclass) NOT NULL,
  min_margin_rate numeric(6,4) DEFAULT 0.0200 NOT NULL,
  default_commission_rate numeric(6,4) DEFAULT 0.0500 NOT NULL,
  deposit_rate numeric(6,4) DEFAULT 0.3000 NOT NULL,
  transfer_fee_cap numeric(12,2) DEFAULT 20.00 NOT NULL,
  receivable_threshold numeric(12,2) DEFAULT 100.00 NOT NULL,
  points_per_egp integer DEFAULT 100 NOT NULL,
  max_redemption_pct numeric(6,4) DEFAULT 0.1000 NOT NULL,
  free_cancel_days integer DEFAULT 21 NOT NULL,
  partial_refund_days integer DEFAULT 7 NOT NULL,
  partial_refund_pct numeric(6,4) DEFAULT 0.5000 NOT NULL,
  currency character(3) DEFAULT 'EGP'::bpchar NOT NULL,
  effective_from timestamp with time zone DEFAULT now() NOT NULL,
  effective_to timestamp with time zone,
  updated_by uuid,
  note text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  transfer_fee_min numeric(12,2) DEFAULT 0.50 NOT NULL,
  transfer_fee_rate numeric(6,4) DEFAULT 0.0010 NOT NULL
);
ALTER TABLE public.financial_settings ADD CONSTRAINT financial_settings_pkey PRIMARY KEY (id);

CREATE TABLE public.booking_financials (
  booking_id text NOT NULL,
  house_id text NOT NULL,
  owner_id uuid NOT NULL,
  agreement_id uuid NOT NULL,
  model_type text NOT NULL,
  currency character(3) DEFAULT 'EGP'::bpchar NOT NULL,
  pricing_basis text NOT NULL,
  pricing_quantity integer NOT NULL,
  resolved_rate numeric(12,2),
  base_rate numeric(12,2),
  markup_pct numeric(6,4),
  commission_rate numeric(6,4),
  retail_price numeric(12,2) NOT NULL,
  promo_discount numeric(12,2) DEFAULT 0 NOT NULL,
  points_discount numeric(12,2) DEFAULT 0 NOT NULL,
  points_redeemed integer DEFAULT 0 NOT NULL,
  owner_entitlement numeric(12,2) NOT NULL,
  deposit_rate numeric(6,4) NOT NULL,
  min_margin_rate numeric(6,4) NOT NULL,
  assumed_transfer_fee numeric(12,2) NOT NULL,
  policy_free_cancel_days integer NOT NULL,
  policy_partial_refund_days integer NOT NULL,
  policy_partial_refund_pct numeric(6,4) NOT NULL,
  policy_source text NOT NULL,
  owner_cash_release_date date NOT NULL,
  override_by uuid,
  override_reason text,
  override_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  final_price numeric(12,2) GENERATED ALWAYS AS (((retail_price - promo_discount) - points_discount)) STORED,
  pima_gross_margin numeric(12,2) GENERATED ALWAYS AS ((retail_price - owner_entitlement)) STORED,
  deposit_standard numeric(12,2) GENERATED ALWAYS AS (round((deposit_rate * ((retail_price - promo_discount) - points_discount)))) STORED,
  deposit_amount numeric(12,2) GENERATED ALWAYS AS (GREATEST(round((deposit_rate * ((retail_price - promo_discount) - points_discount))), (retail_price - owner_entitlement))) STORED,
  deposit_basis text GENERATED ALWAYS AS (
CASE
    WHEN ((retail_price - owner_entitlement) > round((deposit_rate * ((retail_price - promo_discount) - points_discount)))) THEN 'MARGIN_FLOOR'::text
    ELSE 'STANDARD'::text
END) STORED,
  required_min_margin numeric(12,2) GENERATED ALWAYS AS (round((((retail_price - promo_discount) - points_discount) * min_margin_rate), 2)) STORED,
  projected_net_margin numeric(12,2) GENERATED ALWAYS AS (((((retail_price - owner_entitlement) - promo_discount) - points_discount) - assumed_transfer_fee)) STORED,
  cash_shortfall numeric(12,2) GENERATED ALWAYS AS (GREATEST((0)::numeric, (owner_entitlement - ((retail_price - promo_discount) - points_discount)))) STORED,
  margin_warning boolean GENERATED ALWAYS AS ((((((retail_price - owner_entitlement) - promo_discount) - points_discount) - assumed_transfer_fee) < round((((retail_price - promo_discount) - points_discount) * min_margin_rate), 2))) STORED,
  override_required boolean GENERATED ALWAYS AS (((((((retail_price - owner_entitlement) - promo_discount) - points_discount) - assumed_transfer_fee) < round((((retail_price - promo_discount) - points_discount) * min_margin_rate), 2)) OR ((owner_entitlement - ((retail_price - promo_discount) - points_discount)) > (0)::numeric))) STORED
);
ALTER TABLE public.booking_financials ADD CONSTRAINT booking_financials_pkey PRIMARY KEY (booking_id);
ALTER TABLE public.booking_financials ADD CONSTRAINT booking_financials_agreement_id_fkey FOREIGN KEY (agreement_id) REFERENCES house_agreements(id) ON DELETE RESTRICT;
ALTER TABLE public.booking_financials ADD CONSTRAINT booking_financials_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE RESTRICT;
ALTER TABLE public.booking_financials ADD CONSTRAINT booking_financials_house_id_fkey FOREIGN KEY (house_id) REFERENCES houses(id) ON DELETE RESTRICT;
ALTER TABLE public.booking_financials ADD CONSTRAINT booking_financials_override_by_fkey FOREIGN KEY (override_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.booking_financials ADD CONSTRAINT booking_financials_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.booking_financials ADD CONSTRAINT bf_basis_valid CHECK ((pricing_basis = ANY (ARRAY['PER_NIGHT_PER_PERSON'::text, 'MONTHLY'::text, 'DAY_USE_PER_PERSON'::text])));
ALTER TABLE public.booking_financials ADD CONSTRAINT bf_currency_format CHECK ((currency ~ '^[A-Z]{3}$'::text));
ALTER TABLE public.booking_financials ADD CONSTRAINT bf_deposit_rate_range CHECK (((deposit_rate > (0)::numeric) AND (deposit_rate <= (1)::numeric)));
ALTER TABLE public.booking_financials ADD CONSTRAINT bf_discounts_within_retail CHECK (((promo_discount + points_discount) <= retail_price));
ALTER TABLE public.booking_financials ADD CONSTRAINT bf_entitlement_matches_model CHECK ((((model_type = 'NET_RATE'::text) AND (owner_entitlement = round((resolved_rate * (pricing_quantity)::numeric), 2))) OR ((model_type = 'MARKUP'::text) AND (retail_price = round((owner_entitlement * ((1)::numeric + markup_pct)), 2))) OR ((model_type = 'COMMISSION'::text) AND (owner_entitlement = round((retail_price * ((1)::numeric - commission_rate)), 2)))));
ALTER TABLE public.booking_financials ADD CONSTRAINT bf_entitlement_non_negative CHECK ((owner_entitlement >= (0)::numeric));
ALTER TABLE public.booking_financials ADD CONSTRAINT bf_min_margin_range CHECK (((min_margin_rate >= 0.0200) AND (min_margin_rate <= 0.0250)));
ALTER TABLE public.booking_financials ADD CONSTRAINT bf_model_columns CHECK ((((model_type = 'NET_RATE'::text) AND (resolved_rate IS NOT NULL) AND (base_rate IS NULL) AND (markup_pct IS NULL) AND (commission_rate IS NULL)) OR ((model_type = 'MARKUP'::text) AND (markup_pct IS NOT NULL) AND (base_rate IS NULL) AND (resolved_rate IS NULL) AND (commission_rate IS NULL)) OR ((model_type = 'COMMISSION'::text) AND (commission_rate IS NOT NULL) AND (resolved_rate IS NULL) AND (base_rate IS NULL) AND (markup_pct IS NULL))));
ALTER TABLE public.booking_financials ADD CONSTRAINT bf_model_valid CHECK ((model_type = ANY (ARRAY['NET_RATE'::text, 'MARKUP'::text, 'COMMISSION'::text])));
ALTER TABLE public.booking_financials ADD CONSTRAINT bf_override_complete CHECK ((((override_by IS NULL) AND (override_reason IS NULL) AND (override_at IS NULL)) OR ((override_by IS NOT NULL) AND (override_reason IS NOT NULL) AND (override_at IS NOT NULL))));
ALTER TABLE public.booking_financials ADD CONSTRAINT bf_override_when_required CHECK (((NOT ((((((retail_price - owner_entitlement) - promo_discount) - points_discount) - assumed_transfer_fee) < round((((retail_price - promo_discount) - points_discount) * min_margin_rate), 2)) OR ((owner_entitlement - ((retail_price - promo_discount) - points_discount)) > (0)::numeric))) OR ((override_by IS NOT NULL) AND (override_reason IS NOT NULL) AND (override_at IS NOT NULL))));
ALTER TABLE public.booking_financials ADD CONSTRAINT bf_partial_pct_range CHECK (((policy_partial_refund_pct >= (0)::numeric) AND (policy_partial_refund_pct <= (1)::numeric)));
ALTER TABLE public.booking_financials ADD CONSTRAINT bf_points_coherent CHECK ((((points_discount = (0)::numeric) AND (points_redeemed = 0)) OR ((points_discount > (0)::numeric) AND (points_redeemed > 0))));
ALTER TABLE public.booking_financials ADD CONSTRAINT bf_points_non_negative CHECK ((points_discount >= (0)::numeric));
ALTER TABLE public.booking_financials ADD CONSTRAINT bf_points_redeemed_non_negative CHECK ((points_redeemed >= 0));
ALTER TABLE public.booking_financials ADD CONSTRAINT bf_policy_source_valid CHECK ((policy_source = ANY (ARRAY['property'::text, 'platform'::text])));
ALTER TABLE public.booking_financials ADD CONSTRAINT bf_promo_non_negative CHECK ((promo_discount >= (0)::numeric));
ALTER TABLE public.booking_financials ADD CONSTRAINT bf_quantity_positive CHECK ((pricing_quantity > 0));
ALTER TABLE public.booking_financials ADD CONSTRAINT bf_retail_non_negative CHECK ((retail_price >= (0)::numeric));
ALTER TABLE public.booking_financials ADD CONSTRAINT bf_tier_order CHECK ((policy_free_cancel_days >= policy_partial_refund_days));
ALTER TABLE public.booking_financials ADD CONSTRAINT bf_transfer_fee_non_negative CHECK ((assumed_transfer_fee >= (0)::numeric));

CREATE TABLE public.settlement_holds (
  booking_id text NOT NULL,
  owner_id uuid NOT NULL,
  house_id text NOT NULL,
  currency character(3) NOT NULL,
  hold_amount numeric(12,2) NOT NULL,
  hold_until date NOT NULL,
  status text DEFAULT 'HELD'::text NOT NULL,
  released_at timestamp with time zone,
  release_txn_id uuid,
  cancelled_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public.settlement_holds ADD CONSTRAINT settlement_holds_pkey PRIMARY KEY (booking_id);
ALTER TABLE public.settlement_holds ADD CONSTRAINT settlement_holds_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES booking_financials(booking_id) ON DELETE RESTRICT;
ALTER TABLE public.settlement_holds ADD CONSTRAINT settlement_holds_house_id_fkey FOREIGN KEY (house_id) REFERENCES houses(id) ON DELETE RESTRICT;
ALTER TABLE public.settlement_holds ADD CONSTRAINT settlement_holds_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.settlement_holds ADD CONSTRAINT settlement_holds_release_txn_id_fkey FOREIGN KEY (release_txn_id) REFERENCES fin_transactions(id) ON DELETE RESTRICT;
ALTER TABLE public.settlement_holds ADD CONSTRAINT sh_amount_non_negative CHECK ((hold_amount >= (0)::numeric));
ALTER TABLE public.settlement_holds ADD CONSTRAINT sh_cancel_complete CHECK ((((status = 'CANCELLED'::text) AND (cancelled_at IS NOT NULL)) OR ((status <> 'CANCELLED'::text) AND (cancelled_at IS NULL))));
ALTER TABLE public.settlement_holds ADD CONSTRAINT sh_currency_format CHECK ((currency ~ '^[A-Z]{3}$'::text));
ALTER TABLE public.settlement_holds ADD CONSTRAINT sh_release_complete CHECK ((((status = 'RELEASED'::text) AND (released_at IS NOT NULL) AND (release_txn_id IS NOT NULL)) OR ((status <> 'RELEASED'::text) AND (released_at IS NULL) AND (release_txn_id IS NULL))));
ALTER TABLE public.settlement_holds ADD CONSTRAINT sh_status_valid CHECK ((status = ANY (ARRAY['HELD'::text, 'RELEASED'::text, 'CANCELLED'::text])));

CREATE TABLE public.owner_payouts (
  id text NOT NULL,
  house_id text NOT NULL,
  owner_id uuid NOT NULL,
  amount numeric NOT NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  method text,
  note text,
  requested_at timestamp with time zone DEFAULT now() NOT NULL,
  completed_at timestamp with time zone,
  booking_ids text[] DEFAULT '{}'::text[] NOT NULL
);
ALTER TABLE public.owner_payouts ADD CONSTRAINT owner_payouts_pkey PRIMARY KEY (id);
ALTER TABLE public.owner_payouts ADD CONSTRAINT owner_payouts_house_id_fkey FOREIGN KEY (house_id) REFERENCES houses(id) ON DELETE RESTRICT;
ALTER TABLE public.owner_payouts ADD CONSTRAINT owner_payouts_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE public.owner_payouts ADD CONSTRAINT owner_payouts_amount_check CHECK ((amount > (0)::numeric));
ALTER TABLE public.owner_payouts ADD CONSTRAINT owner_payouts_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'rejected'::text])));

CREATE TABLE public.payout_bookings (
  payout_id text NOT NULL,
  booking_id text NOT NULL,
  amount_applied numeric(12,2) NOT NULL,
  owner_id uuid NOT NULL,
  house_id text NOT NULL,
  currency character(3) NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public.payout_bookings ADD CONSTRAINT payout_bookings_pkey PRIMARY KEY (payout_id, booking_id);
ALTER TABLE public.payout_bookings ADD CONSTRAINT payout_bookings_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES settlement_holds(booking_id) ON DELETE RESTRICT;
ALTER TABLE public.payout_bookings ADD CONSTRAINT payout_bookings_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.payout_bookings ADD CONSTRAINT payout_bookings_house_id_fkey FOREIGN KEY (house_id) REFERENCES houses(id) ON DELETE RESTRICT;
ALTER TABLE public.payout_bookings ADD CONSTRAINT payout_bookings_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.payout_bookings ADD CONSTRAINT payout_bookings_payout_id_fkey FOREIGN KEY (payout_id) REFERENCES owner_payouts(id) ON DELETE RESTRICT;
ALTER TABLE public.payout_bookings ADD CONSTRAINT pb_amount_positive CHECK ((amount_applied > (0)::numeric));
ALTER TABLE public.payout_bookings ADD CONSTRAINT pb_currency_format CHECK ((currency ~ '^[A-Z]{3}$'::text));

CREATE TABLE public.owner_receivables (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  booking_id text NOT NULL,
  owner_id uuid NOT NULL,
  house_id text NOT NULL,
  currency character(3) NOT NULL,
  amount numeric(12,2) NOT NULL,
  reason text NOT NULL,
  created_txn_id uuid NOT NULL,
  threshold_at_creation numeric(12,2) NOT NULL,
  status text DEFAULT 'OUTSTANDING'::text NOT NULL,
  escalated_at timestamp with time zone,
  escalated_by uuid,
  escalation_reason text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public.owner_receivables ADD CONSTRAINT owner_receivables_pkey PRIMARY KEY (id);
ALTER TABLE public.owner_receivables ADD CONSTRAINT owner_receivables_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES settlement_holds(booking_id) ON DELETE RESTRICT;
ALTER TABLE public.owner_receivables ADD CONSTRAINT owner_receivables_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.owner_receivables ADD CONSTRAINT owner_receivables_created_txn_id_fkey FOREIGN KEY (created_txn_id) REFERENCES fin_transactions(id) ON DELETE RESTRICT;
ALTER TABLE public.owner_receivables ADD CONSTRAINT owner_receivables_escalated_by_fkey FOREIGN KEY (escalated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.owner_receivables ADD CONSTRAINT owner_receivables_house_id_fkey FOREIGN KEY (house_id) REFERENCES houses(id) ON DELETE RESTRICT;
ALTER TABLE public.owner_receivables ADD CONSTRAINT owner_receivables_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.owner_receivables ADD CONSTRAINT or_amount_positive CHECK ((amount > (0)::numeric));
ALTER TABLE public.owner_receivables ADD CONSTRAINT or_currency_format CHECK ((currency ~ '^[A-Z]{3}$'::text));
ALTER TABLE public.owner_receivables ADD CONSTRAINT or_escalation_complete CHECK ((((escalated_at IS NULL) AND (escalated_by IS NULL)) OR ((escalated_at IS NOT NULL) AND (escalated_by IS NOT NULL) AND (escalation_reason IS NOT NULL))));
ALTER TABLE public.owner_receivables ADD CONSTRAINT or_reason_present CHECK ((length(btrim(reason)) > 0));
ALTER TABLE public.owner_receivables ADD CONSTRAINT or_status_valid CHECK ((status = ANY (ARRAY['OUTSTANDING'::text, 'PARTIALLY_RECOVERED'::text, 'RECOVERED'::text, 'EXPLICIT_REPAYMENT_REQUIRED'::text])));
ALTER TABLE public.owner_receivables ADD CONSTRAINT or_threshold_non_negative CHECK ((threshold_at_creation >= (0)::numeric));

CREATE TABLE public.owner_receivable_recoveries (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  receivable_id uuid NOT NULL,
  amount numeric(12,2) NOT NULL,
  currency character(3) NOT NULL,
  method text NOT NULL,
  payout_id text,
  txn_id uuid NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public.owner_receivable_recoveries ADD CONSTRAINT owner_receivable_recoveries_pkey PRIMARY KEY (id);
ALTER TABLE public.owner_receivable_recoveries ADD CONSTRAINT owner_receivable_recoveries_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.owner_receivable_recoveries ADD CONSTRAINT owner_receivable_recoveries_payout_id_fkey FOREIGN KEY (payout_id) REFERENCES owner_payouts(id) ON DELETE RESTRICT;
ALTER TABLE public.owner_receivable_recoveries ADD CONSTRAINT owner_receivable_recoveries_receivable_id_fkey FOREIGN KEY (receivable_id) REFERENCES owner_receivables(id) ON DELETE RESTRICT;
ALTER TABLE public.owner_receivable_recoveries ADD CONSTRAINT owner_receivable_recoveries_txn_id_fkey FOREIGN KEY (txn_id) REFERENCES fin_transactions(id) ON DELETE RESTRICT;
ALTER TABLE public.owner_receivable_recoveries ADD CONSTRAINT orr_amount_positive CHECK ((amount > (0)::numeric));
ALTER TABLE public.owner_receivable_recoveries ADD CONSTRAINT orr_currency_format CHECK ((currency ~ '^[A-Z]{3}$'::text));
ALTER TABLE public.owner_receivable_recoveries ADD CONSTRAINT orr_method_valid CHECK ((method = ANY (ARRAY['SETTLEMENT_DEDUCTION'::text, 'EXPLICIT_REPAYMENT'::text])));
ALTER TABLE public.owner_receivable_recoveries ADD CONSTRAINT orr_payout_matches_method CHECK ((((method = 'SETTLEMENT_DEDUCTION'::text) AND (payout_id IS NOT NULL)) OR ((method = 'EXPLICIT_REPAYMENT'::text) AND (payout_id IS NULL))));

CREATE TABLE public.payments (
  id text NOT NULL,
  booking_id text NOT NULL,
  user_id uuid NOT NULL,
  user_name text DEFAULT ''::text NOT NULL,
  amount numeric(10,2) DEFAULT 0 NOT NULL,
  payment_method text NOT NULL,
  payment_status text DEFAULT 'pending'::text NOT NULL,
  payment_date timestamp with time zone DEFAULT now() NOT NULL,
  proof_image text,
  transaction_reference text,
  admin_notes text,
  details jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  previous_status text,
  refunded_amount numeric DEFAULT 0 NOT NULL,
  refunded_at timestamp with time zone,
  refunded_by uuid,
  refund_method text,
  refund_note text,
  received_account text
);
ALTER TABLE public.payments ADD CONSTRAINT payments_pkey PRIMARY KEY (id);
ALTER TABLE public.payments ADD CONSTRAINT payments_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE;
ALTER TABLE public.payments ADD CONSTRAINT payments_refunded_by_fkey FOREIGN KEY (refunded_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.payments ADD CONSTRAINT payments_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.payments ADD CONSTRAINT payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE public.payments ADD CONSTRAINT payments_payment_method_check CHECK ((payment_method = ANY (ARRAY['bank'::text, 'instapay'::text, 'vodafone'::text, 'cash'::text, 'online'::text])));
ALTER TABLE public.payments ADD CONSTRAINT payments_payment_status_check CHECK ((payment_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])));
ALTER TABLE public.payments ADD CONSTRAINT payments_refund_within_amount CHECK (((refunded_amount >= (0)::numeric) AND (refunded_amount <= amount)));

-- ── triggers (production definitions) ──────────────────────────────────────
CREATE TRIGGER fin_transactions_append_only BEFORE DELETE OR UPDATE ON public.fin_transactions FOR EACH ROW EXECUTE FUNCTION fin_append_only();
CREATE CONSTRAINT TRIGGER fin_txn_balanced AFTER INSERT ON public.fin_transactions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fin_assert_balanced();
CREATE TRIGGER fin_txn_reversal_scope BEFORE INSERT ON public.fin_transactions FOR EACH ROW EXECUTE FUNCTION fin_assert_reversal_scope();
CREATE TRIGGER fin_legs_append_only BEFORE DELETE OR UPDATE ON public.fin_transaction_legs FOR EACH ROW EXECUTE FUNCTION fin_append_only();
CREATE CONSTRAINT TRIGGER fin_legs_balanced AFTER INSERT ON public.fin_transaction_legs DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fin_assert_balanced();
CREATE TRIGGER booking_financials_no_change BEFORE DELETE OR UPDATE ON public.booking_financials FOR EACH ROW EXECUTE FUNCTION booking_financials_immutable();
CREATE TRIGGER settlement_holds_guard_trg BEFORE DELETE OR UPDATE ON public.settlement_holds FOR EACH ROW EXECUTE FUNCTION settlement_holds_guard();
CREATE TRIGGER settlement_holds_populate_trg BEFORE INSERT ON public.settlement_holds FOR EACH ROW EXECUTE FUNCTION settlement_holds_populate();
CREATE TRIGGER trg_audit_payout_status AFTER UPDATE ON public.owner_payouts FOR EACH ROW EXECUTE FUNCTION audit_payout_status_change();
CREATE TRIGGER trg_notify_owner_on_payout_insert AFTER INSERT ON public.owner_payouts FOR EACH ROW EXECUTE FUNCTION notify_owner_on_payout_update();
CREATE TRIGGER trg_notify_owner_on_payout_update AFTER UPDATE ON public.owner_payouts FOR EACH ROW EXECUTE FUNCTION notify_owner_on_payout_update();
CREATE TRIGGER payout_bookings_append_only_trg BEFORE DELETE OR UPDATE ON public.payout_bookings FOR EACH ROW EXECUTE FUNCTION payout_bookings_append_only();
CREATE TRIGGER payout_bookings_validate_trg BEFORE INSERT ON public.payout_bookings FOR EACH ROW EXECUTE FUNCTION payout_bookings_validate();
CREATE TRIGGER owner_receivables_guard_trg BEFORE DELETE OR UPDATE ON public.owner_receivables FOR EACH ROW EXECUTE FUNCTION owner_receivables_guard();
CREATE TRIGGER owner_receivables_validate_trg BEFORE INSERT ON public.owner_receivables FOR EACH ROW EXECUTE FUNCTION owner_receivables_validate();
CREATE TRIGGER owner_receivable_recoveries_append_only_trg BEFORE DELETE OR UPDATE ON public.owner_receivable_recoveries FOR EACH ROW EXECUTE FUNCTION owner_receivable_recoveries_append_only();
CREATE TRIGGER owner_receivable_recoveries_validate_trg BEFORE INSERT ON public.owner_receivable_recoveries FOR EACH ROW EXECUTE FUNCTION owner_receivable_recoveries_validate();
CREATE TRIGGER owner_receivables_restate_trg AFTER INSERT ON public.owner_receivable_recoveries FOR EACH ROW EXECUTE FUNCTION owner_receivables_restate();
CREATE TRIGGER pay_protect_write BEFORE INSERT OR UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION protect_payment_write();
CREATE TRIGGER pay_stamp_review BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION stamp_payment_review();
CREATE TRIGGER bk_protect_columns BEFORE INSERT OR UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION protect_booking_privileged_columns();

-- ── row-level security and policies (production definitions) ───────────────
ALTER TABLE public.fin_accounts               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_transactions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_transaction_legs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_settings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_financials         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlement_holds           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_payouts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_bookings            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_receivables          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_receivable_recoveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments                   ENABLE ROW LEVEL SECURITY;

CREATE POLICY fin_accounts_admin_write ON public.fin_accounts AS PERMISSIVE FOR INSERT TO public WITH CHECK (is_admin(auth.uid()));
CREATE POLICY fin_accounts_read ON public.fin_accounts AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() IS NOT NULL));
CREATE POLICY fin_transactions_owner_admin_read ON public.fin_transactions AS PERMISSIVE FOR SELECT TO public USING ((is_admin(auth.uid()) OR (owner_id = auth.uid())));
CREATE POLICY fin_legs_owner_admin_read ON public.fin_transaction_legs AS PERMISSIVE FOR SELECT TO public USING ((is_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM fin_transactions t
  WHERE ((t.id = fin_transaction_legs.txn_id) AND (t.owner_id = auth.uid()))))));
CREATE POLICY financial_settings_admin_close ON public.financial_settings AS PERMISSIVE FOR UPDATE TO public USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY financial_settings_admin_insert ON public.financial_settings AS PERMISSIVE FOR INSERT TO public WITH CHECK (is_admin(auth.uid()));
CREATE POLICY financial_settings_admin_read ON public.financial_settings AS PERMISSIVE FOR SELECT TO public USING (is_admin(auth.uid()));
CREATE POLICY booking_financials_admin_read ON public.booking_financials AS PERMISSIVE FOR SELECT TO public USING (is_admin(auth.uid()));
CREATE POLICY settlement_holds_owner_admin_read ON public.settlement_holds AS PERMISSIVE FOR SELECT TO public USING ((is_admin(auth.uid()) OR (owner_id = auth.uid())));
CREATE POLICY owner_payouts_insert_admin ON public.owner_payouts AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY owner_payouts_insert_owner ON public.owner_payouts AS PERMISSIVE FOR INSERT TO public WITH CHECK (((owner_id = auth.uid()) AND (status = 'pending'::text) AND (EXISTS ( SELECT 1
   FROM houses h
  WHERE ((h.id = owner_payouts.house_id) AND (h.owner_id = auth.uid()))))));
CREATE POLICY owner_payouts_select_owner_admin ON public.owner_payouts AS PERMISSIVE FOR SELECT TO public USING (((owner_id = auth.uid()) OR is_admin(auth.uid())));
CREATE POLICY owner_payouts_update_admin ON public.owner_payouts AS PERMISSIVE FOR UPDATE TO public USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY payout_bookings_owner_admin_read ON public.payout_bookings AS PERMISSIVE FOR SELECT TO public USING ((is_admin(auth.uid()) OR (owner_id = auth.uid())));
CREATE POLICY owner_receivables_owner_admin_read ON public.owner_receivables AS PERMISSIVE FOR SELECT TO public USING ((is_admin(auth.uid()) OR (owner_id = auth.uid())));
CREATE POLICY owner_receivable_recoveries_owner_admin_read ON public.owner_receivable_recoveries AS PERMISSIVE FOR SELECT TO public USING ((is_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM owner_receivables r
  WHERE ((r.id = owner_receivable_recoveries.receivable_id) AND (r.owner_id = auth.uid()))))));
CREATE POLICY payments_insert_user ON public.payments AS PERMISSIVE FOR INSERT TO public WITH CHECK (((auth.uid() = user_id) AND is_active(auth.uid())));
CREATE POLICY payments_select_admin ON public.payments AS PERMISSIVE FOR SELECT TO public USING (is_admin(auth.uid()));
CREATE POLICY payments_select_owner ON public.payments AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM (bookings b
     JOIN houses h ON ((h.id = b.house_id)))
  WHERE ((b.id = payments.booking_id) AND (h.owner_id = auth.uid())))));
CREATE POLICY payments_select_user ON public.payments AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
CREATE POLICY payments_update_admin ON public.payments AS PERMISSIVE FOR UPDATE TO public USING (is_admin(auth.uid()));

-- ── grants (production ACLs) ───────────────────────────────────────────────
GRANT ALL ON public.fin_accounts, public.fin_transactions, public.fin_transaction_legs,
             public.financial_settings, public.booking_financials, public.settlement_holds,
             public.owner_payouts, public.payout_bookings, public.owner_receivables,
             public.owner_receivable_recoveries, public.payments TO service_role;
GRANT SELECT ON public.fin_accounts, public.fin_transactions, public.fin_transaction_legs,
                public.booking_financials, public.settlement_holds, public.payout_bookings,
                public.owner_receivables, public.owner_receivable_recoveries TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.financial_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, MAINTAIN ON public.owner_payouts, public.payments TO anon, authenticated;

-- ── reference data (production values) ─────────────────────────────────────
INSERT INTO public.fin_accounts (code, nature, label_ar, description) VALUES
('CUSTOMER_REFUND_PAYABLE','LIABILITY','مبالغ مستردة مستحقة للعملاء','A refund decided and not yet paid. Separating this from PIMA_CASH is what makes «what do we owe customers right now» answerable.'),
('OWNER_PAYABLE','LIABILITY','مستحقات أصحاب البيوت','Owner entitlement recognised and not yet transferred. party_id is the owner.'),
('OWNER_RECEIVABLE','ASSET','مديونية أصحاب البيوت','Owed BY an owner to PIMA, from a refund that followed a settlement (PD-13b). Never used for the PD-1 cash shortfall, which is PIMA-funded.'),
('PIMA_CASH','ASSET','نقدية بيما','Money PIMA actually holds. The arrival balance the guest pays the house directly is NOT here and never will be (PD-04).'),
('PIMA_LOYALTY_EXPENSE','EXPENSE','تكلفة برنامج الولاء','Points expense at EARNING, at programme level. NEVER included in any booking margin — that exclusion is what makes PD-17 true.'),
('PIMA_POINTS_EXPENSE','EXPENSE','تكلفة استبدال النقاط','Points cost attributed to the booking that redeemed them (PD-17).'),
('PIMA_PROMO_EXPENSE','EXPENSE','تكلفة العروض الترويجية','PIMA-funded promotion. Expensed on consumption — a promotion has no prior accrual.'),
('PIMA_REVENUE','INCOME','إيراد بيما','Gross margin. Also the designated rounding plug on partial payments, so PIMA absorbs rounding and never the owner or the customer.'),
('PIMA_TRANSFER_FEE_EXPENSE','EXPENSE','رسوم التحويل','ACTUAL transfer cost, posted at payout. The configured cap is a booking-time projection only and is never posted (PD-09).'),
('POINTS_APPLIED','LIABILITY','نقاط مستخدمة تحت التسوية','Consideration tendered in points, awaiting application to a settlement. Nets to zero once a booking is fully paid or fully cancelled.'),
('POINTS_LIABILITY','LIABILITY','التزام نقاط الولاء','Outstanding loyalty points at EGP value. Credited when points are earned, debited when they are redeemed, re-credited pro-rata when a cancellation restores them (PD-18). Reconciles to SUM(users.points) / points_per_egp.');

INSERT INTO public.financial_settings
  (min_margin_rate, default_commission_rate, deposit_rate, transfer_fee_cap, receivable_threshold,
   points_per_egp, max_redemption_pct, free_cancel_days, partial_refund_days, partial_refund_pct,
   currency, note, transfer_fee_min, transfer_fee_rate)
VALUES (0.0200, 0.0500, 0.3000, 20.00, 100.00, 100, 0.1000, 21, 7, 0.5000, 'EGP',
        'Initial version. Approved PD-01..PD-18 defaults, seeded by migration 0139.', 0.50, 0.0010);
