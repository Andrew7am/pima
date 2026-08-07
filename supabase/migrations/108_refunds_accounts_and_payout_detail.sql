-- ============================================================
-- Three gaps in how Pima records other people's money.
--
-- Run 107 first. This does not depend on it, but 107 stops the
-- delete buttons destroying the very rows this migration adds
-- detail to, and that is the more urgent of the two.
-- ============================================================


-- ============================================================
-- 1. Refunds exist.
--
-- payments.payment_status is pending | approved | rejected. There
-- is no way to say "this money came in and went back out". So when
-- a group cancels a paid booking, the deposit stays counted as
-- collected forever: the admin finance page reports it as held, and
-- nothing anywhere says it is owed back.
--
-- cancellationPolicy.ts computes what a guest is due — but only to
-- render a sentence. Nothing persists it, so the refund is a
-- decision with no record and no queue.
--
-- Deliberately NOT a new payment_status value. A refund is an event
-- with its own date, amount and author; collapsing it into the
-- status of the original payment would lose all three, and a
-- partial refund could not be represented at all.
-- ============================================================

ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS refunded_amount NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS refunded_at     TIMESTAMPTZ;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS refunded_by     UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS refund_method   TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS refund_note     TEXT;

-- You cannot give back more than came in.
DO $$
BEGIN
  ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_refund_within_amount;
  ALTER TABLE public.payments ADD CONSTRAINT payments_refund_within_amount
    CHECK (refunded_amount >= 0 AND refunded_amount <= amount);
END $$;

CREATE OR REPLACE FUNCTION public.record_refund(
  p_payment_id TEXT,
  p_amount     NUMERIC,
  p_method     TEXT DEFAULT NULL,
  p_note       TEXT DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
$$;

GRANT EXECUTE ON FUNCTION public.record_refund(TEXT, NUMERIC, TEXT, TEXT) TO authenticated;


-- ============================================================
-- 2. Which of Pima's own accounts did the money land in.
--
-- payments.payment_method says instapay / vodafone / bank — the
-- KIND of transfer. It does not say WHICH account, and Pima has
-- several (platform_settings.payment_methods). At the end of a week
-- there is no way to tally the app against each real balance, which
-- is the only way to notice money that never arrived.
--
-- Free text rather than a foreign key: the accounts live inside a
-- jsonb column on a single settings row, and an account the owner
-- later deletes must not orphan or erase the payments that landed
-- in it. The label is a historical fact about where the money went.
-- ============================================================

ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS received_account TEXT;

COMMENT ON COLUMN public.payments.received_account IS
  'Which of Pima''s own collection accounts received this — the label from platform_settings.payment_methods, copied at the time so deleting the account later cannot rewrite history.';


-- ============================================================
-- 3. A payout says which bookings it settled.
--
-- settleBookingsPayout writes an owner_payouts row and stamps
-- owner_settled_at on the bookings, joined only by a shared
-- timestamp. That join is exact but implicit: nothing in the row
-- says what it paid for, so an owner asking "what is this transfer?"
-- can only be answered by an admin reconstructing it by hand.
--
-- Storing the ids makes the payout self-describing, which is what
-- lets the owner read his own statement instead of phoning.
-- ============================================================

ALTER TABLE public.owner_payouts ADD COLUMN IF NOT EXISTS booking_ids TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.owner_payouts.booking_ids IS
  'The bookings this transfer settled. Empty for an owner-requested payout, which names an amount rather than specific bookings.';

-- Backfill from the timestamp pairing the app already relies on, so
-- transfers made before this migration are described too.
UPDATE public.owner_payouts p
   SET booking_ids = COALESCE((
         SELECT ARRAY_AGG(b.id)
           FROM public.bookings b
          WHERE b.house_id = p.house_id
            AND b.owner_settled_at = p.completed_at
       ), '{}')
 WHERE p.completed_at IS NOT NULL
   AND p.booking_ids = '{}';
