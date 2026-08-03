-- ============================================================
-- Waitlist "a spot opened" notification. When a booking is cancelled and
-- capacity frees up, the owner notifies a waiting guest. emit_notification
-- (021) only allows owner->guest when they share a booking — a waitlisted
-- guest has none — so this dedicated RPC authorizes the notify against the
-- waitlist row instead: the caller must own the house of that entry. It
-- pushes the notification to the waiting guest and marks the entry
-- 'notified'.
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_waitlist(p_waitlist_id TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  caller UUID := auth.uid();
  w RECORD;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;

  SELECT wl.*, h.owner_id AS owner_id, h.name AS h_name
    INTO w
    FROM public.waitlist wl
    JOIN public.houses h ON h.id = wl.house_id
   WHERE wl.id = p_waitlist_id;

  IF w IS NULL THEN RAISE EXCEPTION 'WAITLIST_NOT_FOUND'; END IF;
  IF w.owner_id <> caller AND NOT public.is_admin(caller) THEN RAISE EXCEPTION 'NOT_ALLOWED_TO_NOTIFY'; END IF;

  INSERT INTO public.notifications (id, user_id, booking_id, title, message, type, is_read)
  VALUES (
    'notif_wl_' || p_waitlist_id || '_' || extract(epoch FROM clock_timestamp())::bigint,
    w.user_id, NULL,
    'تفضّل مكان في ' || COALESCE(w.h_name, 'بيت المؤتمرات') || ' 🎉',
    'تحرّر مكان للفترة من ' || w.check_in || ' إلى ' || w.check_out ||
      '. سارع بتأكيد حجزك قبل أن يحجزه غيرك.',
    'success', FALSE
  );

  UPDATE public.waitlist SET status = 'notified' WHERE id = p_waitlist_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_waitlist(TEXT) TO authenticated;
