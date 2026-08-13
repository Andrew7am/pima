-- ============================================================
-- Per-booking owner settlement. The admin can now transfer each booking's
-- owner share individually (3 servants on one house => 3 separate transfers)
-- or settle several at once. We track settlement on the booking itself and
-- record every transfer as a completed owner_payouts row (the ledger the
-- owner's Financial Center and history already read).
-- ============================================================

-- 1) Mark on the booking when its owner share has been paid out. NULL = still
--    owed. Set = transferred (a completed owner_payouts row references it).
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS owner_settled_at TIMESTAMPTZ;

-- 2) The admin creates completed payout rows directly (owner-initiated
--    requests stay 'pending' via the existing policy). Both policies are
--    OR'd, so this only widens who can insert.
DROP POLICY IF EXISTS "owner_payouts_insert_admin" ON public.owner_payouts;
CREATE POLICY "owner_payouts_insert_admin" ON public.owner_payouts
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

-- 3) Notify the owner on an admin-created completed payout too, not just on
--    an UPDATE of an existing request. Rewrites the function from 067 to also
--    handle INSERT (OLD is NULL there), then adds the INSERT trigger.
CREATE OR REPLACE FUNCTION public.notify_owner_on_payout_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  amt TEXT := round(NEW.amount)::text;
  nid TEXT := 'notif_payout_' || NEW.id || '_' || NEW.status || '_' || extract(epoch FROM clock_timestamp())::bigint;
BEGIN
  -- On UPDATE, only fire when the status actually changed.
  IF TG_OP = 'UPDATE' AND NEW.status = OLD.status THEN RETURN NEW; END IF;

  IF NEW.status = 'completed' THEN
    INSERT INTO public.notifications (id, user_id, booking_id, title, message, type, is_read)
    VALUES (nid, NEW.owner_id, '',
      'تم تحويل مستحقاتك ✓',
      'تم تحويل ' || amt || ' ج.م من مستحقاتك بنجاح. يرجى التحقق من محفظتك.',
      'success', FALSE);
  ELSIF NEW.status = 'processing' THEN
    INSERT INTO public.notifications (id, user_id, booking_id, title, message, type, is_read)
    VALUES (nid, NEW.owner_id, '',
      'جارٍ تحويل مستحقاتك',
      'بدأت الإدارة في تحويل ' || amt || ' ج.م من مستحقاتك.',
      'info', FALSE);
  ELSIF NEW.status = 'rejected' THEN
    INSERT INTO public.notifications (id, user_id, booking_id, title, message, type, is_read)
    VALUES (nid, NEW.owner_id, '',
      'تعذّر تحويل مستحقاتك',
      'تم رفض طلب تحويل ' || amt || ' ج.م. يرجى مراجعة الإدارة.',
      'danger', FALSE);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_owner_on_payout_insert ON public.owner_payouts;
CREATE TRIGGER trg_notify_owner_on_payout_insert
  AFTER INSERT ON public.owner_payouts
  FOR EACH ROW EXECUTE FUNCTION public.notify_owner_on_payout_update();
