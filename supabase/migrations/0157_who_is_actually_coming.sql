-- ============================================================
-- «جاي ولا لأ» — asked once, in the app, instead of forty times on WhatsApp
--
-- A servant with forty people on a trip currently establishes who is actually
-- coming by messaging each of them and counting on paper. The count is stale
-- the moment it is written, and the people who never reply are indistinguish-
-- able from the people who said no.
--
-- One nullable column carries it. NULL is not «no» — it is «has not answered»,
-- and those are the two things the servant most needs to tell apart. A CHECK
-- rather than an enum so a third answer can be added without a type migration.
--
-- Only the participant sets it, and only for themselves: this is the one fact
-- on the roster that is genuinely theirs. The servant can see it and act on it;
-- they cannot answer on someone's behalf, because a confirmed headcount that
-- somebody else filled in is worth nothing.
-- ============================================================

ALTER TABLE public.attendees
  ADD COLUMN IF NOT EXISTS attendance TEXT
    CHECK (attendance IS NULL OR attendance IN ('coming', 'apology')),
  ADD COLUMN IF NOT EXISTS attendance_at TIMESTAMPTZ;

COMMENT ON COLUMN public.attendees.attendance IS
  'The participant''s own answer. NULL means unanswered, which is deliberately '
  'distinct from ''apology'' — a servant chases the first and re-plans for the '
  'second.';

-- ---------- The participant answers ----------
CREATE OR REPLACE FUNCTION public.set_my_attendance(
  p_booking_id TEXT,
  p_attendance TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  me UUID := auth.uid();
  n  INTEGER;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'لازم تسجّل دخولك الأول.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_attendance IS NOT NULL AND p_attendance NOT IN ('coming', 'apology') THEN
    RAISE EXCEPTION 'INVALID_ATTENDANCE';
  END IF;

  -- Scoped to their own row by user_id, not by an id the client passes. There
  -- is no argument here that could be pointed at somebody else.
  UPDATE public.attendees
     SET attendance = p_attendance,
         attendance_at = CASE WHEN p_attendance IS NULL THEN NULL ELSE NOW() END
   WHERE booking_id = p_booking_id
     AND user_id = me;

  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN
    RAISE EXCEPTION 'انت مش مضاف في الرحلة دي.' USING ERRCODE = 'no_data_found';
  END IF;

  RETURN jsonb_build_object('ok', TRUE, 'attendance', p_attendance);
END;
$$;

-- ---------- The participant sees their own answer ----------
-- Same narrow projection as 0156, one column wider. Still no price, no roster,
-- nobody else's anything.
-- DROP first, and this is not optional. 0156 created my_participations with
-- fourteen output columns; this widens it to seventeen, and Postgres refuses to
-- change a function's OUT row type through CREATE OR REPLACE:
--
--   42P13: cannot change return type of existing function
--   HINT: Use DROP FUNCTION my_participations() first.
--
-- The whole migration aborts on that line, so the columns above it never
-- landed either — and from the app it looked like nothing had been applied at
-- all. The GRANT is re-issued below, because dropping takes it with it.
DROP FUNCTION IF EXISTS public.my_participations();

CREATE OR REPLACE FUNCTION public.my_participations()
RETURNS TABLE (
  booking_id      TEXT,
  house_id        TEXT,
  house_name      TEXT,
  governorate     TEXT,
  address         TEXT,
  lat             DOUBLE PRECISION,
  lng             DOUBLE PRECISION,
  check_in        TEXT,
  check_out       TEXT,
  status          TEXT,
  organizer_name  TEXT,
  organizer_phone TEXT,
  my_payment      TEXT,
  my_attendance   TEXT,
  my_room         TEXT,
  my_bed          INTEGER,
  join_code       TEXT
)
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp AS $$
  SELECT
    b.id, b.house_id, b.house_name,
    h.governorate, h.address, h.lat, h.lng,
    b.check_in::TEXT, b.check_out::TEXT, b.status,
    u.name, u.phone,
    COALESCE(a.payment_status, CASE WHEN a.share_paid THEN 'paid' ELSE 'unpaid' END),
    a.attendance,
    -- Their own bed. room_allocations has held this since 0001 and the person
    -- sleeping in it has never been shown it — so «انت في أنهي غرفة» is a
    -- question asked at the door, forty times, on arrival night. The room's
    -- name only; who else is in it is not theirs to read.
    r.name,
    ra.bed_number,
    public.booking_join_code(b.id)
  FROM public.attendees a
  JOIN public.bookings b ON b.id = a.booking_id
  LEFT JOIN public.houses h ON h.id = b.house_id
  LEFT JOIN public.users  u ON u.id = b.user_id
  LEFT JOIN public.room_allocations ra ON ra.attendee_id = a.id
  LEFT JOIN public.rooms r ON r.id = ra.room_id
 WHERE a.user_id = auth.uid()
   AND b.status IN ('approved', 'completed', 'cancelled', 'rejected')
 ORDER BY b.check_in DESC;
$$;

REVOKE ALL ON FUNCTION public.set_my_attendance(TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_participations()           FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_my_attendance(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_participations()           TO authenticated;

COMMENT ON FUNCTION public.set_my_attendance(TEXT, TEXT) IS
  'The participant answers «جاي ولا لأ» for themselves. Scoped by user_id '
  'rather than an attendee id from the client: a headcount somebody else '
  'filled in is worth nothing.';
