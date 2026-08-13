-- ============================================================
-- Servant -> owner "distribution done" notification. emit_notification
-- (021) has no guest->owner path, so this dedicated RPC lets the booking's
-- guest tell the house owner that they've finished placing their group in
-- the assigned rooms (so the owner can view / print the rooming list).
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_owner_distribution_done(p_booking_id TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  caller UUID := auth.uid();
  b RECORD;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;

  SELECT bk.user_id AS guest_id, bk.house_name, bk.organization_name, bk.user_name, h.owner_id
    INTO b
    FROM public.bookings bk
    JOIN public.houses h ON h.id = bk.house_id
   WHERE bk.id = p_booking_id;

  IF b IS NULL THEN RAISE EXCEPTION 'BOOKING_NOT_FOUND'; END IF;
  IF b.guest_id <> caller THEN RAISE EXCEPTION 'NOT_THE_BOOKER'; END IF;

  INSERT INTO public.notifications (id, user_id, booking_id, title, message, type, is_read)
  VALUES (
    'notif_dist_' || p_booking_id || '_' || extract(epoch FROM clock_timestamp())::bigint,
    b.owner_id, p_booking_id,
    'تم توزيع الغرف ✓',
    'قام "' || COALESCE(b.organization_name, b.user_name, 'الحاجز') || '" بتوزيع مجموعته على الغرف المخصّصة في "' ||
      COALESCE(b.house_name, '') || '". يمكنك عرض أو طباعة كشف الغرف.',
    'info', FALSE
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_owner_distribution_done(TEXT) TO authenticated;
