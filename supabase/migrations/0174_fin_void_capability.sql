-- ════════════════════════════════════════════════════════════════════════════
-- PROPOSAL — Phase 7 Step 6 (revision of Step 5). NOT a repository migration.
-- NOT for production. Applied only to the disposable local PostgreSQL reproduction.
-- Re-runnable: every statement is idempotent (IF [NOT] EXISTS / CREATE OR REPLACE).
-- Never re-run 0173 after this file: 0173 would restore the old payout deduction filter.
--
-- Financial void capability: correct a ledger event that was recorded but never
-- happened, WITHOUT editing history. Every correction is a mirror journal
-- (txn_type 'reversal', reverses_txn_id -> the original), which is the meaning
-- the Financial Core already gives a reversal:
--   * ft_reversal_shape            reverses_txn_id only on txn_type 'reversal'
--   * fin_assert_reversal_scope    same booking, house and owner as the original
--   * fin_booking_position         a reversal counts as its original's type
--   * fin_append_only / payout_bookings_append_only / recoveries append-only:
--       "correct with a reversal ... never by editing history"
--
-- Three operations, all admin-only, idempotent, audited, scope-limited:
--   fin_void_owner_payout       a completed payout that never executed
--                               (its advance journals AND its fee journal)
--   fin_void_owner_receivable   a receivable whose cause (the payout) was voided
--   fin_cancel_settlement_hold  HELD -> CANCELLED on a cancelled, fully closed booking
--
-- Deliberately NOT provided: reversing customer payments or refunds, writing off
-- a real debt (no bad-debt account exists), adjustments, voiding a payout whose
-- transfer was returned (its fee was real). Each would need its own rules.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 0. Precondition: replace only what production is known to contain ────────
-- Each object 0174 overwrites must be byte-identical to production (2026-10-02,
-- md5 of prosrc / pg_get_viewdef) or already be 0174's own version (re-run).
-- Anything else means production drifted: stop before touching a thing.
DO $$
DECLARE
  r RECORD;
  v_fail TEXT := '';
BEGIN
  FOR r IN SELECT * FROM (VALUES
      ('fin_create_owner_payout',              'd178d237ee6dae03fbf0126f80abb72c', 'db0389c73d71f313ca71bbf9c5eccb82'),
      ('fin_payout_result',                    '67a92679b073cabe7fa55412e82e0ab8', '892727cf0b36e34f5ebf62200731ad0b'),
      ('owner_receivable_recoveries_validate', 'bcfe412c8b0c55fa0997eea34f46e2ae', '44f0d023652f79e6eb3789dc739efbef'),
      ('owner_receivables_guard',              '179104e643bad1bd647d0087fc77fa98', '1c1cb08bf819421d86280ebf5c78b6a3')) AS x(fn, prod_md5, new_md5)
  LOOP
    IF (SELECT count(*) FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = r.fn) <> 1 THEN
      v_fail := v_fail || format(' %s: expected exactly one definition;', r.fn);
    ELSIF (SELECT md5(replace(prosrc, E'\r', '')) FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = r.fn)
          NOT IN (r.prod_md5, r.new_md5) THEN
      v_fail := v_fail || format(' %s: body is neither production nor 0174;', r.fn);
    END IF;
  END LOOP;
  IF to_regclass('public.fin_booking_summary') IS NULL THEN
    v_fail := v_fail || ' fin_booking_summary missing;';
  ELSIF md5(pg_get_viewdef('public.fin_booking_summary'::regclass, true)) NOT IN
        ('b7b4bc264c2fda97d9e4cda00d9483ee', '523a312b219f52a0aa6e9464666e0eff') THEN
    v_fail := v_fail || ' fin_booking_summary is neither production nor 0174;';
  END IF;
  IF EXISTS (SELECT 1 FROM public.owner_payouts WHERE status NOT IN ('pending', 'processing', 'completed', 'rejected', 'voided'))
     OR EXISTS (SELECT 1 FROM public.owner_receivables WHERE status NOT IN ('OUTSTANDING', 'PARTIALLY_RECOVERED', 'RECOVERED', 'EXPLICIT_REPAYMENT_REQUIRED', 'VOIDED')) THEN
    v_fail := v_fail || ' an existing row would violate the widened status checks;';
  END IF;
  IF v_fail <> '' THEN RAISE EXCEPTION '0174 PRECONDITION FAILED:%', v_fail; END IF;
END $$;

-- ── 1. Status vocabulary ─────────────────────────────────────────────────────
-- Widening only: every existing row still satisfies the new check.
ALTER TABLE public.owner_payouts DROP CONSTRAINT IF EXISTS owner_payouts_status_check;
ALTER TABLE public.owner_payouts ADD CONSTRAINT owner_payouts_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'rejected'::text, 'voided'::text]));

ALTER TABLE public.owner_receivables DROP CONSTRAINT IF EXISTS or_status_valid;
ALTER TABLE public.owner_receivables ADD CONSTRAINT or_status_valid
  CHECK (status = ANY (ARRAY['OUTSTANDING'::text, 'PARTIALLY_RECOVERED'::text, 'RECOVERED'::text,
                             'EXPLICIT_REPAYMENT_REQUIRED'::text, 'VOIDED'::text]));

-- ── 2. One reversal per original, enforced by the database ───────────────────
-- (The reversal's idempotency key 'reversal:' || original key is also UNIQUE.)
CREATE UNIQUE INDEX IF NOT EXISTS fin_txn_one_reversal_per_original
  ON public.fin_transactions (reverses_txn_id) WHERE reverses_txn_id IS NOT NULL;

-- ── 3. The record of every void: who, why, which reversals ───────────────────
CREATE TABLE IF NOT EXISTS public.fin_void_events (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  kind             text        NOT NULL,
  target_id        text        NOT NULL,
  booking_id       text        REFERENCES public.settlement_holds(booking_id) ON DELETE RESTRICT,
  reason           text        NOT NULL,
  idempotency_key  text        NOT NULL,
  reversal_txn_ids uuid[]      NOT NULL DEFAULT '{}',
  created_by       uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fve_kind_valid      CHECK (kind = ANY (ARRAY['PAYOUT_VOID'::text, 'RECEIVABLE_VOID'::text, 'HOLD_CANCEL'::text])),
  CONSTRAINT fve_reason_present  CHECK (length(btrim(reason)) > 0),
  CONSTRAINT fve_key_present     CHECK (length(btrim(idempotency_key)) > 0),
  CONSTRAINT fve_idempotency_key UNIQUE (idempotency_key),
  CONSTRAINT fve_one_per_target  UNIQUE (kind, target_id)
);
DROP TRIGGER IF EXISTS fin_void_events_append_only ON public.fin_void_events;
CREATE TRIGGER fin_void_events_append_only BEFORE DELETE OR UPDATE ON public.fin_void_events
  FOR EACH ROW EXECUTE FUNCTION public.fin_records_append_only();
ALTER TABLE public.fin_void_events ENABLE ROW LEVEL SECURITY;
-- Supabase default privileges hand anon/authenticated INSERT/UPDATE/DELETE on new
-- tables; take them back. Same shape as every other financial table.
REVOKE ALL ON public.fin_void_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.fin_void_events TO authenticated;
GRANT ALL ON public.fin_void_events TO service_role;
DROP POLICY IF EXISTS fin_void_events_admin_read ON public.fin_void_events;
CREATE POLICY fin_void_events_admin_read ON public.fin_void_events
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- ── 4. A voided receivable is terminal, like a recovered one ─────────────────
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

  -- 0174: a voided debt never existed; nothing may revive it.
  IF OLD.status = 'VOIDED' AND NEW.status <> 'VOIDED' THEN
    RAISE EXCEPTION
      'OWNER_RECEIVABLE_VOIDED: receivable % was voided and cannot be reopened', OLD.id;
  END IF;

  RETURN NEW;
END;
$function$;

-- ── 5. Nothing can be recovered against a voided receivable ──────────────────
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
  SELECT amount, currency, owner_id, status INTO r
    FROM public.owner_receivables
   WHERE id = NEW.receivable_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'RECOVERY_NO_RECEIVABLE: receivable % does not exist', NEW.receivable_id;
  END IF;

  -- 0174: a voided debt was never owed, so nothing can be recovered against it.
  IF r.status = 'VOIDED' THEN
    RAISE EXCEPTION 'RECOVERY_RECEIVABLE_VOIDED: receivable % was voided — there is nothing to recover', NEW.receivable_id;
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

-- ── 6. fin_create_owner_payout: verbatim 0173 body, one filter changed ───────
-- A voided receivable must never be deducted from a later payout.
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
       WHERE r.owner_id = v_owner AND r.currency = v_currency AND r.status NOT IN ('RECOVERED', 'VOIDED')
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

-- ── 7. The one primitive: mirror a single journal ────────────────────────────
-- Internal only. Callers have already authorised, locked and scoped the work.
CREATE OR REPLACE FUNCTION public.fin_reverse_txn_internal(p_txn_id uuid, p_memo text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  o     RECORD;
  v_txn UUID := gen_random_uuid();
  v_n   INTEGER;
BEGIN
  SELECT * INTO o FROM public.fin_transactions WHERE id = p_txn_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REVERSAL_TXN_NOT_FOUND: %', p_txn_id;
  END IF;
  IF o.txn_type = 'reversal' THEN
    RAISE EXCEPTION 'REVERSAL_OF_REVERSAL: % is itself a reversal — re-instating an event is not supported', p_txn_id;
  END IF;
  IF EXISTS (SELECT 1 FROM public.fin_transactions WHERE reverses_txn_id = p_txn_id) THEN
    RAISE EXCEPTION 'REVERSAL_ALREADY_EXISTS: % has already been reversed', p_txn_id;
  END IF;

  INSERT INTO public.fin_transactions
    (id, txn_type, booking_id, house_id, owner_id, actor_id, currency,
     reference_type, reference_id, reverses_txn_id, idempotency_key, memo)
  VALUES
    (v_txn, 'reversal', o.booking_id, o.house_id, o.owner_id, auth.uid(), o.currency,
     'reversal', o.id::text, o.id, 'reversal:' || o.idempotency_key, p_memo);

  -- Every leg, same account, same party, opposite sign. Nothing chosen, nothing netted.
  INSERT INTO public.fin_transaction_legs (txn_id, account, amount, party_id)
  SELECT v_txn, l.account, -l.amount, l.party_id
    FROM public.fin_transaction_legs l WHERE l.txn_id = o.id ORDER BY l.id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN
    RAISE EXCEPTION 'REVERSAL_ORIGINAL_HAS_NO_LEGS: %', p_txn_id;
  END IF;

  RETURN v_txn;
END;
$$;
REVOKE ALL ON FUNCTION public.fin_reverse_txn_internal(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fin_reverse_txn_internal(uuid, text) TO service_role;

-- ── 8. Shared result + audit helpers (internal) ──────────────────────────────
CREATE OR REPLACE FUNCTION public.fin_void_result(p_event_id uuid, p_replayed boolean)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'void_event_id', e.id, 'kind', e.kind, 'target_id', e.target_id, 'booking_id', e.booking_id,
    'reversal_txn_ids', to_jsonb(e.reversal_txn_ids), 'replayed', p_replayed, 'created_at', e.created_at)
    FROM public.fin_void_events e WHERE e.id = p_event_id;
$$;
REVOKE ALL ON FUNCTION public.fin_void_result(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fin_void_result(uuid, boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.fin_void_audit(p_action text, p_target_type text, p_target_id text, p_details text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  INSERT INTO public.audit_log (actor_id, actor_name, actor_role, action, target_type, target_id, details)
  SELECT auth.uid(), COALESCE((SELECT name FROM public.users WHERE id = auth.uid()), 'unknown'),
         (SELECT role FROM public.users WHERE id = auth.uid()), p_action, p_target_type, p_target_id, p_details;
$$;
REVOKE ALL ON FUNCTION public.fin_void_audit(text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fin_void_audit(text, text, text, text) TO service_role;

-- ── 9. Void a payout that was recorded but never executed ────────────────────
CREATE OR REPLACE FUNCTION public.fin_void_owner_payout(p_payout_id text, p_reason text, p_idempotency_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_ev   RECORD;
  v_p    RECORD;
  v_t    RECORD;
  v_rev  UUID[] := '{}';
  v_id   UUID := gen_random_uuid();
  v_adv  INTEGER;
  v_lnk  INTEGER;
BEGIN
  IF v_uid IS NULL OR NOT public.is_admin(v_uid) THEN RAISE EXCEPTION 'NOT_ALLOWED'; END IF;
  IF p_idempotency_key IS NULL OR btrim(p_idempotency_key) = '' THEN RAISE EXCEPTION 'IDEMPOTENCY_KEY_REQUIRED'; END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN RAISE EXCEPTION 'VOID_REASON_REQUIRED'; END IF;

  SELECT * INTO v_ev FROM public.fin_void_events WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_ev.kind <> 'PAYOUT_VOID' OR v_ev.target_id IS DISTINCT FROM p_payout_id THEN
      RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT: key % was used for % %', p_idempotency_key, v_ev.kind, v_ev.target_id;
    END IF;
    RETURN public.fin_void_result(v_ev.id, TRUE);
  END IF;

  -- Lock order shared by every money path: settlement_holds (booking_id order),
  -- then the payout, then receivables, then journals.
  PERFORM 1 FROM public.settlement_holds h
   WHERE h.booking_id IN (SELECT pb.booking_id FROM public.payout_bookings pb WHERE pb.payout_id = p_payout_id)
   ORDER BY h.booking_id FOR UPDATE;
  SELECT * INTO v_p FROM public.owner_payouts WHERE id = p_payout_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PAYOUT_NOT_FOUND: %', p_payout_id; END IF;

  -- A same-key caller may have finished while we waited.
  SELECT * INTO v_ev FROM public.fin_void_events WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_ev.kind <> 'PAYOUT_VOID' OR v_ev.target_id IS DISTINCT FROM p_payout_id THEN
      RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT: key % was used for % %', p_idempotency_key, v_ev.kind, v_ev.target_id;
    END IF;
    RETURN public.fin_void_result(v_ev.id, TRUE);
  END IF;

  IF v_p.status = 'voided' THEN
    RAISE EXCEPTION 'PAYOUT_ALREADY_VOIDED: payout % was voided under a different key', p_payout_id;
  END IF;
  IF v_p.status <> 'completed' THEN
    RAISE EXCEPTION 'PAYOUT_NOT_VOIDABLE: payout % is % — only a completed payout carries journals to void', p_payout_id, v_p.status;
  END IF;
  SELECT count(*) INTO v_lnk FROM public.payout_bookings WHERE payout_id = p_payout_id;
  IF v_lnk = 0 THEN
    RAISE EXCEPTION 'PAYOUT_NOT_LEDGER_BACKED: payout % predates the Financial Core and has no journals', p_payout_id;
  END IF;
  -- Scope: only money for trips that no longer exist.
  IF EXISTS (SELECT 1 FROM public.payout_bookings pb JOIN public.bookings b ON b.id = pb.booking_id
              WHERE pb.payout_id = p_payout_id AND b.status <> 'cancelled') THEN
    RAISE EXCEPTION 'VOID_PAYOUT_BOOKING_ACTIVE: payout % settles a booking that is not cancelled', p_payout_id;
  END IF;
  -- A deduction recovered a real debt inside this transfer; voiding would erase it.
  IF EXISTS (SELECT 1 FROM public.owner_receivable_recoveries WHERE payout_id = p_payout_id) THEN
    RAISE EXCEPTION 'VOID_PAYOUT_HAS_DEDUCTIONS: payout % recovered receivables — void is not supported for it', p_payout_id;
  END IF;
  SELECT count(*) INTO v_adv FROM public.fin_transactions
   WHERE reference_type = 'owner_payout' AND reference_id = p_payout_id AND txn_type = 'owner_payout';
  IF v_adv <> v_lnk THEN
    RAISE EXCEPTION 'VOID_PAYOUT_LEDGER_MISMATCH: payout % has % linkage rows but % advance journals', p_payout_id, v_lnk, v_adv;
  END IF;

  -- Every journal this payout posted: one advance per booking, and its fee.
  FOR v_t IN
    SELECT id FROM public.fin_transactions
     WHERE reference_type = 'owner_payout' AND reference_id = p_payout_id
       AND txn_type IN ('owner_payout', 'transfer_fee')
     ORDER BY created_at, id
  LOOP
    v_rev := v_rev || public.fin_reverse_txn_internal(v_t.id, 'void payout ' || p_payout_id || ': ' || btrim(p_reason));
  END LOOP;

  UPDATE public.owner_payouts SET status = 'voided' WHERE id = p_payout_id;

  INSERT INTO public.fin_void_events (id, kind, target_id, booking_id, reason, idempotency_key, reversal_txn_ids, created_by)
  VALUES (v_id, 'PAYOUT_VOID', p_payout_id, NULL, btrim(p_reason), p_idempotency_key, v_rev, v_uid);

  PERFORM public.fin_void_audit('payout_voided', 'payout', p_payout_id,
    format('reason: %s | reversal journals: %s', btrim(p_reason), array_to_string(v_rev, ',')));

  RETURN public.fin_void_result(v_id, FALSE);
END;
$$;
REVOKE ALL ON FUNCTION public.fin_void_owner_payout(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fin_void_owner_payout(text, text, text) TO authenticated, service_role;

-- ── 10. Void a receivable whose cause no longer exists ───────────────────────
CREATE OR REPLACE FUNCTION public.fin_void_owner_receivable(p_receivable_id uuid, p_reason text, p_idempotency_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_ev    RECORD;
  v_r     RECORD;
  v_bid   TEXT;
  v_op    NUMERIC;
  v_delta NUMERIC;
  v_rev   UUID;
  v_id    UUID := gen_random_uuid();
BEGIN
  IF v_uid IS NULL OR NOT public.is_admin(v_uid) THEN RAISE EXCEPTION 'NOT_ALLOWED'; END IF;
  IF p_idempotency_key IS NULL OR btrim(p_idempotency_key) = '' THEN RAISE EXCEPTION 'IDEMPOTENCY_KEY_REQUIRED'; END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN RAISE EXCEPTION 'VOID_REASON_REQUIRED'; END IF;

  SELECT * INTO v_ev FROM public.fin_void_events WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_ev.kind <> 'RECEIVABLE_VOID' OR v_ev.target_id IS DISTINCT FROM p_receivable_id::text THEN
      RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT: key % was used for % %', p_idempotency_key, v_ev.kind, v_ev.target_id;
    END IF;
    RETURN public.fin_void_result(v_ev.id, TRUE);
  END IF;

  SELECT booking_id INTO v_bid FROM public.owner_receivables WHERE id = p_receivable_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'RECEIVABLE_NOT_FOUND: %', p_receivable_id; END IF;

  PERFORM 1 FROM public.settlement_holds WHERE booking_id = v_bid FOR UPDATE;
  SELECT * INTO v_r FROM public.owner_receivables WHERE id = p_receivable_id FOR UPDATE;

  SELECT * INTO v_ev FROM public.fin_void_events WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_ev.kind <> 'RECEIVABLE_VOID' OR v_ev.target_id IS DISTINCT FROM p_receivable_id::text THEN
      RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT: key % was used for % %', p_idempotency_key, v_ev.kind, v_ev.target_id;
    END IF;
    RETURN public.fin_void_result(v_ev.id, TRUE);
  END IF;

  IF v_r.status = 'VOIDED' THEN
    RAISE EXCEPTION 'RECEIVABLE_ALREADY_VOIDED: receivable % was voided under a different key', p_receivable_id;
  END IF;
  IF v_r.status NOT IN ('OUTSTANDING', 'EXPLICIT_REPAYMENT_REQUIRED') THEN
    RAISE EXCEPTION 'RECEIVABLE_NOT_VOIDABLE: receivable % is %', p_receivable_id, v_r.status;
  END IF;
  IF EXISTS (SELECT 1 FROM public.owner_receivable_recoveries WHERE receivable_id = p_receivable_id) THEN
    RAISE EXCEPTION 'RECEIVABLE_HAS_RECOVERIES: receivable % has recoveries — real money moved against it', p_receivable_id;
  END IF;

  -- The receivable exists because OWNER_PAYABLE on this booking went into debit
  -- (the owner held money a refund charged back). Reversing its creation entry
  -- is only truthful if that debit is gone — i.e. the payout that caused it was
  -- itself voided. Otherwise the owner would owe PIMA with no record of the debt.
  SELECT COALESCE(SUM(l.amount), 0) INTO v_op
    FROM public.fin_transaction_legs l JOIN public.fin_transactions t ON t.id = l.txn_id
   WHERE t.booking_id = v_bid AND l.account = 'OWNER_PAYABLE';
  SELECT COALESCE(SUM(-l.amount), 0) INTO v_delta
    FROM public.fin_transaction_legs l
   WHERE l.txn_id = v_r.created_txn_id AND l.account = 'OWNER_PAYABLE';
  IF v_op + v_delta > 0 THEN
    RAISE EXCEPTION 'RECEIVABLE_CAUSE_PRESENT: booking % would leave the owner owing % with no receivable — void the payout that caused it first',
      v_bid, v_op + v_delta;
  END IF;

  v_rev := public.fin_reverse_txn_internal(v_r.created_txn_id, 'void receivable ' || p_receivable_id || ': ' || btrim(p_reason));

  UPDATE public.owner_receivables SET status = 'VOIDED' WHERE id = p_receivable_id;

  INSERT INTO public.fin_void_events (id, kind, target_id, booking_id, reason, idempotency_key, reversal_txn_ids, created_by)
  VALUES (v_id, 'RECEIVABLE_VOID', p_receivable_id::text, v_bid, btrim(p_reason), p_idempotency_key, ARRAY[v_rev], v_uid);

  PERFORM public.fin_void_audit('receivable_voided', 'owner_receivable', p_receivable_id::text,
    format('reason: %s | booking: %s | reversal journal: %s', btrim(p_reason), v_bid, v_rev));

  RETURN public.fin_void_result(v_id, FALSE);
END;
$$;
REVOKE ALL ON FUNCTION public.fin_void_owner_receivable(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fin_void_owner_receivable(uuid, text, text) TO authenticated, service_role;

-- ── 11. HELD -> CANCELLED on a booking with nothing left to settle ───────────
CREATE OR REPLACE FUNCTION public.fin_cancel_settlement_hold(p_booking_id text, p_reason text, p_idempotency_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_ev   RECORD;
  v_h    RECORD;
  v_st   TEXT;
  v_op   NUMERIC;
  v_crp  NUMERIC;
  v_paid NUMERIC;
  v_id   UUID := gen_random_uuid();
BEGIN
  IF v_uid IS NULL OR NOT public.is_admin(v_uid) THEN RAISE EXCEPTION 'NOT_ALLOWED'; END IF;
  IF p_idempotency_key IS NULL OR btrim(p_idempotency_key) = '' THEN RAISE EXCEPTION 'IDEMPOTENCY_KEY_REQUIRED'; END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN RAISE EXCEPTION 'VOID_REASON_REQUIRED'; END IF;

  SELECT * INTO v_ev FROM public.fin_void_events WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_ev.kind <> 'HOLD_CANCEL' OR v_ev.target_id IS DISTINCT FROM p_booking_id THEN
      RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT: key % was used for % %', p_idempotency_key, v_ev.kind, v_ev.target_id;
    END IF;
    RETURN public.fin_void_result(v_ev.id, TRUE);
  END IF;

  SELECT * INTO v_h FROM public.settlement_holds WHERE booking_id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'HOLD_NOT_FOUND: %', p_booking_id; END IF;

  SELECT * INTO v_ev FROM public.fin_void_events WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_ev.kind <> 'HOLD_CANCEL' OR v_ev.target_id IS DISTINCT FROM p_booking_id THEN
      RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT: key % was used for % %', p_idempotency_key, v_ev.kind, v_ev.target_id;
    END IF;
    RETURN public.fin_void_result(v_ev.id, TRUE);
  END IF;

  IF v_h.status = 'CANCELLED' THEN
    RAISE EXCEPTION 'HOLD_ALREADY_CANCELLED: hold on booking % is already cancelled', p_booking_id;
  END IF;
  IF v_h.status <> 'HELD' THEN
    RAISE EXCEPTION 'HOLD_TERMINAL: hold on booking % is %', p_booking_id, v_h.status;
  END IF;

  SELECT status INTO v_st FROM public.bookings WHERE id = p_booking_id;
  IF v_st IS DISTINCT FROM 'cancelled' THEN
    RAISE EXCEPTION 'HOLD_BOOKING_NOT_CANCELLED: booking % is %', p_booking_id, COALESCE(v_st, 'missing');
  END IF;

  SELECT COALESCE(SUM(l.amount) FILTER (WHERE l.account = 'OWNER_PAYABLE'), 0),
         COALESCE(SUM(l.amount) FILTER (WHERE l.account = 'CUSTOMER_REFUND_PAYABLE'), 0)
    INTO v_op, v_crp
    FROM public.fin_transaction_legs l JOIN public.fin_transactions t ON t.id = l.txn_id
   WHERE t.booking_id = p_booking_id;
  IF v_op <> 0 THEN
    RAISE EXCEPTION 'HOLD_OWNER_BALANCE_OPEN: booking % still carries % on OWNER_PAYABLE — release the hold, do not cancel it', p_booking_id, v_op;
  END IF;
  IF v_crp <> 0 THEN
    RAISE EXCEPTION 'HOLD_REFUND_UNPAID: booking % still owes the customer %', p_booking_id, -v_crp;
  END IF;
  IF EXISTS (SELECT 1 FROM public.owner_receivables
              WHERE booking_id = p_booking_id AND status NOT IN ('RECOVERED', 'VOIDED')) THEN
    RAISE EXCEPTION 'HOLD_RECEIVABLE_OPEN: booking % has an open owner receivable', p_booking_id;
  END IF;
  SELECT COALESCE(SUM(pb.amount_applied), 0) INTO v_paid
    FROM public.payout_bookings pb JOIN public.owner_payouts o ON o.id = pb.payout_id
   WHERE pb.booking_id = p_booking_id AND o.status <> 'voided';
  IF v_paid > 0 THEN
    RAISE EXCEPTION 'HOLD_SETTLED: % was actually paid to the owner against booking %', v_paid, p_booking_id;
  END IF;

  UPDATE public.settlement_holds SET status = 'CANCELLED', cancelled_at = now() WHERE booking_id = p_booking_id;

  INSERT INTO public.fin_void_events (id, kind, target_id, booking_id, reason, idempotency_key, reversal_txn_ids, created_by)
  VALUES (v_id, 'HOLD_CANCEL', p_booking_id, p_booking_id, btrim(p_reason), p_idempotency_key, '{}', v_uid);

  PERFORM public.fin_void_audit('settlement_hold_cancelled', 'booking', p_booking_id,
    format('reason: %s | hold %s %s', btrim(p_reason), v_h.hold_amount, v_h.currency));

  RETURN public.fin_void_result(v_id, FALSE);
END;
$$;
REVOKE ALL ON FUNCTION public.fin_cancel_settlement_hold(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fin_cancel_settlement_hold(text, text, text) TO authenticated, service_role;

-- ── 13. Reporting: a voided payout settles nothing ───────────────────────────
-- Read-side only. Guards that cap money (fin_booking_position.payouts_applied,
-- payout_bookings_validate, owner_receivables_validate) deliberately keep counting
-- every linkage row: between a payout void and the hold cancel they must stay
-- conservative, and changing them would let a voided booking be paid again.

-- 13a. fin_payout_result: verbatim 0173 body + 'status' + void-aware fully_settled.
CREATE OR REPLACE FUNCTION public.fin_payout_result(p_payout_id TEXT, p_replayed BOOLEAN)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT jsonb_build_object(
    'payout_id',    o.id,
    'replayed',     p_replayed,
    'status',       o.status,
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
                                            JOIN public.owner_payouts xo ON xo.id = x.payout_id
                                           WHERE x.booking_id = pb.booking_id AND xo.status <> 'voided') >= h.hold_amount)
                        ORDER BY pb.booking_id), '[]'::jsonb)
                       FROM public.payout_bookings pb
                       JOIN public.settlement_holds h ON h.booking_id = pb.booking_id
                      WHERE pb.payout_id = o.id))
  FROM public.owner_payouts o WHERE o.id = p_payout_id;
$$;

-- 13b. fin_booking_summary: exactly three expressions change.
--   owner_settled_amount          ignores linkage rows of voided payouts
--   owner_cash_payable            0 once the hold is CANCELLED (nothing is owed)
--   owner_receivable_outstanding  ignores VOIDED receivables (statuses still list them)
-- Same columns, names, types and order, so the three role views that select from
-- it (admin / owner / customer) keep working unchanged and keep their own filters.
DO $$
DECLARE v_def TEXT := pg_get_viewdef('public.fin_booking_summary'::regclass, true);
BEGIN
  IF md5(v_def) <> 'b7b4bc264c2fda97d9e4cda00d9483ee' AND position('voided' IN v_def) = 0 THEN
    RAISE EXCEPTION '0174 PRECONDITION: fin_booking_summary is not the production definition (md5 %) — refusing to replace it', md5(v_def);
  END IF;
END $$;

CREATE OR REPLACE VIEW public.fin_booking_summary AS
 SELECT bf.booking_id,
    bf.house_id,
    bf.owner_id,
    b.user_id AS guest_user_id,
    bf.currency,
    b.check_in,
    b.check_out,
    b.status AS booking_status,
    b.guests_count,
    bf.model_type,
    bf.retail_price,
    bf.promo_discount,
    bf.points_discount,
    bf.points_redeemed,
    bf.final_price,
    bf.deposit_rate,
    bf.deposit_standard,
    bf.deposit_amount,
    bf.deposit_basis,
    bf.final_price - bf.deposit_amount AS arrival_balance_external,
    COALESCE(led.pima_cash, 0::numeric) AS pima_cash_received,
    GREATEST(0::numeric, bf.deposit_amount - COALESCE(led.pima_cash, 0::numeric)) AS deposit_remaining,
    COALESCE(led.refund_payable, 0::numeric) AS refund_payable,
    bf.owner_entitlement,
    COALESCE(sh.hold_amount, 0::numeric) AS owner_cash_held,
    COALESCE(pb.settled, 0::numeric) AS owner_settled_amount,
    CASE WHEN sh.status = 'CANCELLED'::text THEN 0::numeric
         ELSE GREATEST(0::numeric, COALESCE(sh.hold_amount, 0::numeric) - COALESCE(pb.settled, 0::numeric))
    END AS owner_cash_payable,
    sh.status AS settlement_hold_status,
    sh.hold_until AS settlement_hold_until,
    sh.released_at AS settlement_released_at,
    bf.owner_cash_release_date,
    COALESCE(rcv.outstanding, 0::numeric) AS owner_receivable_outstanding,
    rcv.statuses AS owner_receivable_statuses,
    bf.pima_gross_margin,
    bf.required_min_margin,
    bf.min_margin_rate,
    bf.projected_net_margin,
    bf.assumed_transfer_fee,
    COALESCE(led.transfer_fee, 0::numeric) AS transfer_fee_actual,
    COALESCE(led.promo_expense, 0::numeric) AS promo_cost_recognised,
    COALESCE(led.points_expense, 0::numeric) AS points_cost_recognised,
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
    bf.policy_free_cancel_days,
    bf.policy_partial_refund_days,
    bf.policy_partial_refund_pct,
    bf.policy_source,
    bf.created_at AS financials_created_at
   FROM booking_financials bf
     JOIN bookings b ON b.id = bf.booking_id
     LEFT JOIN settlement_holds sh ON sh.booking_id = bf.booking_id
     LEFT JOIN LATERAL ( SELECT sum(l.amount) FILTER (WHERE l.account = 'PIMA_CASH'::text) AS pima_cash,
            sum(l.amount) FILTER (WHERE l.account = 'PIMA_POINTS_EXPENSE'::text) AS points_expense,
            sum(l.amount) FILTER (WHERE l.account = 'PIMA_PROMO_EXPENSE'::text) AS promo_expense,
            sum(l.amount) FILTER (WHERE l.account = 'PIMA_TRANSFER_FEE_EXPENSE'::text) AS transfer_fee,
            - sum(l.amount) FILTER (WHERE l.account = 'CUSTOMER_REFUND_PAYABLE'::text) AS refund_payable
           FROM fin_transactions t
             JOIN fin_transaction_legs l ON l.txn_id = t.id
          WHERE t.booking_id = bf.booking_id) led ON true
     LEFT JOIN LATERAL ( SELECT sum(x.amount_applied) AS settled
           FROM payout_bookings x
             JOIN owner_payouts xo ON xo.id = x.payout_id
          WHERE x.booking_id = bf.booking_id AND xo.status <> 'voided'::text) pb ON true
     LEFT JOIN LATERAL ( SELECT sum(r.amount - COALESCE(rec.recovered, 0::numeric)) FILTER (WHERE r.status <> 'VOIDED'::text) AS outstanding,
            string_agg(DISTINCT r.status, ','::text) AS statuses
           FROM owner_receivables r
             LEFT JOIN LATERAL ( SELECT sum(rr.amount) AS recovered
                   FROM owner_receivable_recoveries rr
                  WHERE rr.receivable_id = r.id) rec ON true
          WHERE r.booking_id = bf.booking_id) rcv ON true;

DO $$
DECLARE
  v_cols TEXT;
  v_fail TEXT := '';
BEGIN
  SELECT string_agg(a.attname || ':' || format_type(a.atttypid, a.atttypmod), ',' ORDER BY a.attnum) INTO v_cols
    FROM pg_attribute a WHERE a.attrelid = 'public.fin_booking_summary'::regclass AND a.attnum > 0;
  IF md5(v_cols) <> md5('booking_id:text,house_id:text,owner_id:uuid,guest_user_id:uuid,currency:character(3),check_in:date,check_out:date,booking_status:text,guests_count:integer,model_type:text,retail_price:numeric(12,2),promo_discount:numeric(12,2),points_discount:numeric(12,2),points_redeemed:integer,final_price:numeric(12,2),deposit_rate:numeric(6,4),deposit_standard:numeric(12,2),deposit_amount:numeric(12,2),deposit_basis:text,arrival_balance_external:numeric,pima_cash_received:numeric,deposit_remaining:numeric,refund_payable:numeric,owner_entitlement:numeric(12,2),owner_cash_held:numeric,owner_settled_amount:numeric,owner_cash_payable:numeric,settlement_hold_status:text,settlement_hold_until:date,settlement_released_at:timestamp with time zone,owner_cash_release_date:date,owner_receivable_outstanding:numeric,owner_receivable_statuses:text,pima_gross_margin:numeric(12,2),required_min_margin:numeric(12,2),min_margin_rate:numeric(6,4),projected_net_margin:numeric(12,2),assumed_transfer_fee:numeric(12,2),transfer_fee_actual:numeric,promo_cost_recognised:numeric,points_cost_recognised:numeric,cash_shortfall:numeric(12,2),margin_warning:boolean,override_required:boolean,override_by:uuid,override_reason:text,override_at:timestamp with time zone,agreement_id:uuid,commission_rate:numeric(6,4),pricing_basis:text,pricing_quantity:integer,policy_free_cancel_days:integer,policy_partial_refund_days:integer,policy_partial_refund_pct:numeric(6,4),policy_source:text,financials_created_at:timestamp with time zone') THEN
    v_fail := v_fail || ' fin_booking_summary columns changed;';
  END IF;
  IF md5(pg_get_viewdef('public.fin_booking_summary_admin'::regclass, true)) <> '8810baf21a127f36cb3353b80ed9f24d' THEN v_fail := v_fail || ' admin view changed;'; END IF;
  IF md5(pg_get_viewdef('public.fin_booking_summary_customer'::regclass, true)) <> '5a6d0b23057c1580d25d25e34a7cce3f' THEN v_fail := v_fail || ' customer view changed;'; END IF;
  IF md5(pg_get_viewdef('public.fin_booking_summary_owner'::regclass, true)) <> '1fa9ef07b9395d84c3329486cca4aa46' THEN v_fail := v_fail || ' owner view changed;'; END IF;
  IF has_table_privilege('authenticated', 'public.fin_booking_summary', 'SELECT') OR has_table_privilege('anon', 'public.fin_booking_summary', 'SELECT') THEN
    v_fail := v_fail || ' base summary became client-readable;'; END IF;
  IF v_fail <> '' THEN RAISE EXCEPTION '0174 REPORTING POSTCONDITION FAILED:%', v_fail; END IF;
END $$;

-- ── 12. Built-in verification (raises on any failure) ────────────────────────
DO $$
DECLARE v_fail TEXT := '';
BEGIN
  IF to_regclass('public.fin_void_events') IS NULL THEN v_fail := v_fail || ' fin_void_events missing;'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'fin_txn_one_reversal_per_original') THEN v_fail := v_fail || ' reversal index missing;'; END IF;
  IF has_function_privilege('authenticated', 'public.fin_reverse_txn_internal(uuid,text)', 'EXECUTE') THEN v_fail := v_fail || ' internal reversal is client-callable;'; END IF;
  IF has_function_privilege('anon', 'public.fin_void_owner_payout(text,text,text)', 'EXECUTE') THEN v_fail := v_fail || ' anon can void payouts;'; END IF;
  IF has_table_privilege('authenticated', 'public.fin_void_events', 'INSERT') OR has_table_privilege('authenticated', 'public.fin_void_events', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.fin_void_events', 'DELETE') THEN v_fail := v_fail || ' clients can write void events;'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'fin_create_owner_payout' AND prosrc LIKE '%NOT IN (''RECOVERED'', ''VOIDED'')%') THEN
    v_fail := v_fail || ' payout deduction filter not updated;'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'fin_payout_result' AND prosrc LIKE '%''status'',       o.status%') THEN
    v_fail := v_fail || ' payout result lacks status;'; END IF;
  IF position('voided' IN pg_get_viewdef('public.fin_booking_summary'::regclass, true)) = 0 THEN
    v_fail := v_fail || ' booking summary not void-aware;'; END IF;
  IF has_function_privilege('authenticated', 'public.fin_void_result(uuid,boolean)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.fin_void_audit(text,text,text,text)', 'EXECUTE') THEN
    v_fail := v_fail || ' internal helper is client-callable;'; END IF;
  IF has_function_privilege('anon', 'public.fin_cancel_settlement_hold(text,text,text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.fin_void_owner_receivable(uuid,text,text)', 'EXECUTE') THEN
    v_fail := v_fail || ' anon can call a void RPC;'; END IF;
  IF v_fail <> '' THEN RAISE EXCEPTION '0174 VERIFICATION FAILED:%', v_fail; END IF;
  RAISE NOTICE '0174 verification passed';
END $$;
