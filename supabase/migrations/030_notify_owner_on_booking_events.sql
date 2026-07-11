-- ============================================================
-- Owners were never notified about their own bookings.
--
-- emit_notification() (021) only authorizes owner->guest, admin->anyone,
-- guest->admin, and self — there's no guest->owner path, so even if the
-- client tried to notify the owner on a new booking or a self-cancel, the
-- RPC would reject it with NOT_ALLOWED_TO_NOTIFY. And the client never
-- even attempted it — handleBookHouse/handleCancelBooking in App.tsx push
-- no notification at all today.
--
-- Fix with server-side triggers (same trusted pattern as
-- notify_on_payment_insert, 021) instead of widening emit_notification's
-- authorization: the owner gets pinged automatically on booking creation
-- and on a guest's self-cancel, with no client involvement.
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_owner_on_booking_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  h_owner UUID;
BEGIN
  SELECT owner_id INTO h_owner FROM public.houses WHERE id = NEW.house_id;
  IF h_owner IS NOT NULL THEN
    INSERT INTO public.notifications (id, user_id, booking_id, title, message, type, is_read)
    VALUES (
      'notif_newbk_' || NEW.id, h_owner, NEW.id,
      'طلب حجز جديد 🔔',
      'وصلك طلب حجز جديد من "' || COALESCE(NEW.user_name, '') || '" في "' || COALESCE(NEW.house_name, '') ||
        '" للفترة من ' || NEW.check_in || ' إلى ' || NEW.check_out || '. يرجى مراجعته والرد عليه.',
      'info', FALSE
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_owner_on_booking_insert ON public.bookings;
CREATE TRIGGER trg_notify_owner_on_booking_insert
  AFTER INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.notify_owner_on_booking_insert();

CREATE OR REPLACE FUNCTION public.notify_owner_on_booking_cancel()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  h_owner UUID;
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status = 'pending' THEN
    SELECT owner_id INTO h_owner FROM public.houses WHERE id = NEW.house_id;
    IF h_owner IS NOT NULL THEN
      INSERT INTO public.notifications (id, user_id, booking_id, title, message, type, is_read)
      VALUES (
        'notif_cancelbk_' || NEW.id || '_' || extract(epoch FROM clock_timestamp())::bigint, h_owner, NEW.id,
        'تم إلغاء طلب حجز ✕',
        'قام "' || COALESCE(NEW.user_name, '') || '" بإلغاء طلب حجزه في "' || COALESCE(NEW.house_name, '') ||
          '" للفترة من ' || NEW.check_in || ' إلى ' || NEW.check_out || '.',
        'danger', FALSE
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_owner_on_booking_cancel ON public.bookings;
CREATE TRIGGER trg_notify_owner_on_booking_cancel
  AFTER UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.notify_owner_on_booking_cancel();
