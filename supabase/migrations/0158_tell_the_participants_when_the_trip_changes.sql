-- ============================================================
-- Tell the forty people when the trip changes
--
-- 0156 let a participant see the trip; 0157 let them answer «جاي ولا لأ». Both
-- are pull: they find out by opening the app. So a trip whose dates move, or
-- that is cancelled the night before, reaches them only if they happen to look
-- — and the servant is back to forty messages, which is the thing this set of
-- changes exists to stop.
--
-- Three events are worth a notification and no others:
--   * cancelled or rejected — they must not travel.
--   * the dates moved — they must travel on a different day.
--   * approved — the trip they were added to is now real.
--
-- Not sent for: a price change (they never see the price), a roster edit, or a
-- payment recorded against someone. A notification that does not change what
-- the reader does is how people learn to ignore the bell.
--
-- The organiser is skipped: they are the one making the change, and 047
-- already notifies the booker on their own booking. Being told about your own
-- action reads as the app not knowing who you are.
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_participants_of_booking_change()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_title  TEXT;
  v_body   TEXT;
  v_type   TEXT;
  v_house  TEXT := COALESCE(NULLIF(NEW.house_name, ''), 'الرحلة');
  v_moved  BOOLEAN := (NEW.check_in IS DISTINCT FROM OLD.check_in)
                   OR (NEW.check_out IS DISTINCT FROM OLD.check_out);
BEGIN
  IF NEW.status IN ('cancelled', 'rejected') AND OLD.status <> NEW.status THEN
    v_title := 'اتلغت: ' || v_house;
    v_body  := 'الرحلة اللي كنت مشارك فيها اتلغت. كلّم مسؤول الرحلة لو محتاج تفاصيل.';
    v_type  := 'danger';

  ELSIF NEW.status = 'approved' AND OLD.status <> 'approved' THEN
    v_title := 'اتأكدت: ' || v_house;
    v_body  := 'رحلتك اتأكدت من ' || to_char(NEW.check_in, 'DD/MM')
               || ' لـ ' || to_char(NEW.check_out, 'DD/MM') || '.';
    v_type  := 'success';

  ELSIF v_moved AND NEW.status = 'approved' THEN
    -- Dates only matter once the trip is real; a pending booking being edited
    -- is the servant still arranging it.
    v_title := 'اتغيرت مواعيد ' || v_house;
    v_body  := 'المواعيد الجديدة: من ' || to_char(NEW.check_in, 'DD/MM')
               || ' لـ ' || to_char(NEW.check_out, 'DD/MM') || '.';
    v_type  := 'info';

  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (id, user_id, booking_id, title, message, type, is_read)
  SELECT
    'ntf_' || substr(md5(random()::text || clock_timestamp()::text || a.user_id::text), 1, 16),
    a.user_id, NEW.id, v_title, v_body, v_type, FALSE
    FROM public.attendees a
   WHERE a.booking_id = NEW.id
     AND a.user_id IS NOT NULL
     -- The organiser is making the change; 047 already tells them.
     AND a.user_id <> NEW.user_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_participants ON public.bookings;
CREATE TRIGGER trg_notify_participants
  AFTER UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_participants_of_booking_change();

COMMENT ON FUNCTION public.notify_participants_of_booking_change() IS
  'Cancelled, approved, or the dates moved — the three changes that alter what '
  'a participant does. Deliberately not fired for price or roster edits: a '
  'notification that changes nothing is how people learn to ignore the bell.';
