-- ============================================================
-- Realtime notification to the house owner when the admin moves their
-- payout forward — "بدء التحويل" (processing) and especially "تم التحويل"
-- (completed). Same trusted server-side trigger pattern as the booking
-- notifications (migration 030): a SECURITY DEFINER trigger inserts the
-- notification row directly, so it's atomic with the status change and the
-- owner sees it live via their notifications realtime subscription — no
-- client involvement, can't be forged. Unique id per event (timestamp
-- suffix) so re-processing never collides.
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_owner_on_payout_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  amt TEXT := round(NEW.amount)::text;
  nid TEXT := 'notif_payout_' || NEW.id || '_' || NEW.status || '_' || extract(epoch FROM clock_timestamp())::bigint;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;

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

DROP TRIGGER IF EXISTS trg_notify_owner_on_payout_update ON public.owner_payouts;
CREATE TRIGGER trg_notify_owner_on_payout_update
  AFTER UPDATE ON public.owner_payouts
  FOR EACH ROW EXECUTE FUNCTION public.notify_owner_on_payout_update();
