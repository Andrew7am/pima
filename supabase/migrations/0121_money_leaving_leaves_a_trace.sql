-- ============================================================
-- Money leaving the company should leave as much evidence as money
-- arriving. Right now it leaves almost none.
--
-- An accountant's audit of these screens found three faults that share
-- one cause: the inflow side was built carefully and the outflow side
-- was built as a button.
--
-- On the way IN, Pima captures the sender's handle, a transaction
-- reference, and a zoomable photograph of the receipt. On the way OUT,
-- «حوّل ✓» is a bare confirm() that records a click and a timestamp
-- the app generated itself. Six months later a monastery bookkeeper
-- says he was underpaid: his side of that conversation is a real
-- InstaPay transfer with a real reference, and Pima's side is a
-- checkbox.
-- ============================================================


-- ============================================================
-- 1. Which account the money left from, and its reference.
--
-- owner_payouts (059) carries neither. So «الخزنة» can count what
-- arrived in each of Pima's wallets and what was refunded, but never
-- what was paid out of them — which is why that card reports money
-- RECEIVED and cannot report money HELD. One column fixes the
-- arithmetic; the reference fixes the argument.
-- ============================================================

ALTER TABLE public.owner_payouts ADD COLUMN IF NOT EXISTS paid_from_account      TEXT;
ALTER TABLE public.owner_payouts ADD COLUMN IF NOT EXISTS transaction_reference  TEXT;
ALTER TABLE public.owner_payouts ADD COLUMN IF NOT EXISTS completed_by           UUID REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.owner_payouts.transaction_reference IS
  'The bank or wallet reference for the transfer. This is what an owner disputing a payment six months later can be answered with.';


-- ============================================================
-- 2. The primary outflow route wrote NO audit line at all.
--
-- Migration 104 audits owner_payouts on UPDATE. settleBookingsPayout
-- (db.ts) INSERTs the row already at status='completed', so no UPDATE
-- ever happens and the trigger never fires. The owner-REQUESTED route
-- does update, and is audited.
--
-- That makes the log selectively empty, which is worse than empty: an
-- absence reads as «التحويل ده محصلش» rather than «الطريق ده مش
-- متغطّى». An auditor reading it would draw the wrong conclusion, and
-- so would you.
-- ============================================================

CREATE OR REPLACE FUNCTION public.audit_payout_created()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  h_name TEXT;
BEGIN
  SELECT name INTO h_name FROM public.houses WHERE id = NEW.house_id;

  INSERT INTO public.audit_log (actor_id, actor_name, actor_role, action, target_type, target_id, details)
  SELECT
    auth.uid(),
    COALESCE(u.name, 'النظام'),
    COALESCE(u.role, 'system'),
    CASE WHEN NEW.status = 'completed' THEN 'payout_paid' ELSE 'payout_requested' END,
    'payout',
    NEW.id,
    format('%s ج.م لصاحب بيت %s%s%s',
           NEW.amount,
           COALESCE(h_name, NEW.house_id),
           COALESCE(' — من ' || NEW.paid_from_account, ''),
           COALESCE(' — مرجع ' || NEW.transaction_reference, ''))
  FROM (SELECT 1) AS _
  LEFT JOIN public.users u ON u.id = auth.uid();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_payout_created ON public.owner_payouts;
CREATE TRIGGER trg_audit_payout_created
  AFTER INSERT ON public.owner_payouts
  FOR EACH ROW EXECUTE FUNCTION public.audit_payout_created();


-- ============================================================
-- 3. Refunds recorded no audit line either, and a second partial
--    refund silently erased the first one's evidence.
--
-- record_refund (108) SETs refunded_amount rather than accumulating,
-- and overwrites refunded_at, refund_method and refund_note — which is
-- where a transfer reference would live. And because it never changes
-- payment_status, 104's payment trigger (which fires only on a status
-- change) recorded nothing.
--
-- Now it accumulates, refuses to exceed the payment, and writes its
-- own audit row — it is SECURITY DEFINER and already knows who is
-- calling, how much, and why.
-- ============================================================

CREATE OR REPLACE FUNCTION public.record_refund(
  p_payment_id TEXT,
  p_amount     NUMERIC,
  p_method     TEXT DEFAULT NULL,
  p_note       TEXT DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_amount   NUMERIC;
  v_status   TEXT;
  v_already  NUMERIC;
  v_booking  TEXT;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'NOT_ALLOWED';
  END IF;

  SELECT amount, payment_status, COALESCE(refunded_amount, 0), booking_id
    INTO v_amount, v_status, v_already, v_booking
    FROM public.payments WHERE id = p_payment_id;
  IF v_amount IS NULL THEN RAISE EXCEPTION 'PAYMENT_NOT_FOUND'; END IF;
  IF v_status <> 'approved' THEN RAISE EXCEPTION 'PAYMENT_NOT_APPROVED'; END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'REFUND_AMOUNT_OUT_OF_RANGE'; END IF;
  -- Accumulates. A second partial refund used to overwrite the first,
  -- taking its date, method and note — the evidence — with it.
  IF v_already + p_amount > v_amount THEN RAISE EXCEPTION 'REFUND_EXCEEDS_PAYMENT'; END IF;

  UPDATE public.payments
     SET refunded_amount = v_already + p_amount,
         refunded_at     = NOW(),
         refunded_by     = auth.uid(),
         refund_method   = COALESCE(p_method, refund_method),
         refund_note     = CASE
                             WHEN p_note IS NULL THEN refund_note
                             WHEN refund_note IS NULL THEN p_note
                             ELSE refund_note || ' | ' || p_note
                           END
   WHERE id = p_payment_id;

  INSERT INTO public.audit_log (actor_id, actor_name, actor_role, action, target_type, target_id, details)
  SELECT auth.uid(), COALESCE(u.name, 'النظام'), COALESCE(u.role, 'system'),
         'refund_recorded', 'payment', p_payment_id,
         format('%s ج.م على حجز %s%s', p_amount, COALESCE(v_booking, '—'),
                COALESCE(' — ' || p_note, ''))
  FROM (SELECT 1) AS _
  LEFT JOIN public.users u ON u.id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_refund(TEXT, NUMERIC, TEXT, TEXT) TO authenticated;


-- ============================================================
-- 4. The date the money was ACCEPTED, not the date a phone claimed.
--
-- payments.payment_date is written by the guest's browser at upload
-- time, and every finance figure is scoped on it. So the month a
-- payment falls into is decided by a device Pima does not control, and
-- a wrong clock puts revenue in the wrong period.
--
-- The real approval moment is already recorded — 091 stamps
-- reviewed_at on every status change — and nothing reads it. This adds
-- no new capture: it exposes what is already there, so the finance
-- screens can scope on «when we accepted it» when that matters.
-- ============================================================

CREATE OR REPLACE VIEW public.payments_accounting AS
  SELECT p.*,
         COALESCE(p.reviewed_at, p.payment_date) AS accounted_at
    FROM public.payments p;

GRANT SELECT ON public.payments_accounting TO authenticated;

COMMENT ON VIEW public.payments_accounting IS
  'payments with accounted_at — the moment an admin accepted the money, falling back to the guest-supplied date for rows predating migration 091. Use this for period reporting; payment_date is what the guest said, not what Pima observed.';
