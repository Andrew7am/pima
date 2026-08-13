-- ============================================================
-- Attendee self-registration via a shared link.
--
-- A group leader (servant) shares a link to their approved booking; each
-- member opens it WITHOUT logging in and adds their own name. Two anon-callable
-- SECURITY DEFINER RPCs back this: one reads minimal invite context to render
-- the page, the other appends the member as an attendee.
--
-- Abuse guard: registration is allowed only while the booking is 'approved',
-- and never past the booking's own guests_count (so the link can't be used to
-- flood the attendee list). Booking ids are long random strings, which is the
-- practical secret here — the same trust model as an unlisted share link.
-- ============================================================

-- Minimal, non-sensitive context for the join page (no user_id / phone / price).
CREATE OR REPLACE FUNCTION public.get_booking_invite_info(p_booking_id TEXT)
RETURNS TABLE (
  house_name       TEXT,
  check_in         TEXT,
  check_out        TEXT,
  guests_count     INTEGER,
  registered_count BIGINT,
  status           TEXT
)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT
    b.house_name,
    b.check_in::text,
    b.check_out::text,
    b.guests_count,
    (SELECT count(*) FROM public.attendees a WHERE a.booking_id = b.id),
    b.status
  FROM public.bookings b
  WHERE b.id = p_booking_id;
$$;

-- Append one self-registered attendee to an approved booking.
CREATE OR REPLACE FUNCTION public.self_register_attendee(
  p_booking_id  TEXT,
  p_name        TEXT,
  p_gender      TEXT,
  p_group_type  TEXT DEFAULT 'other'
)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  b               public.bookings%ROWTYPE;
  current_count   INTEGER;
  new_id          TEXT;
  trimmed         TEXT := coalesce(trim(p_name), '');
BEGIN
  IF length(trimmed) = 0 OR length(trimmed) > 60 THEN RAISE EXCEPTION 'INVALID_NAME'; END IF;
  IF p_gender NOT IN ('male', 'female') THEN RAISE EXCEPTION 'INVALID_GENDER'; END IF;
  IF coalesce(p_group_type, 'other') NOT IN ('youth', 'family', 'child', 'other') THEN RAISE EXCEPTION 'INVALID_GROUP'; END IF;

  SELECT * INTO b FROM public.bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'BOOKING_NOT_FOUND'; END IF;
  IF b.status <> 'approved' THEN RAISE EXCEPTION 'BOOKING_NOT_OPEN'; END IF;

  SELECT count(*) INTO current_count FROM public.attendees WHERE booking_id = p_booking_id;
  IF current_count >= b.guests_count THEN RAISE EXCEPTION 'CAPACITY_FULL'; END IF;

  new_id := 'att_' || replace(gen_random_uuid()::text, '-', '');
  INSERT INTO public.attendees (id, booking_id, name, gender, group_type)
    VALUES (new_id, p_booking_id, trimmed, p_gender, coalesce(p_group_type, 'other'));

  RETURN new_id;
END;
$$;

-- Both are safe for anonymous visitors (the join link isn't behind auth).
GRANT EXECUTE ON FUNCTION public.get_booking_invite_info(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.self_register_attendee(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
