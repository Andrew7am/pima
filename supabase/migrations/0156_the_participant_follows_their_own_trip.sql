-- ============================================================
-- The participant follows the trip they are on
--
-- A servant types forty names and phones into the roster. Every one of those
-- people is going on the trip, and none of them can see anything about it in
-- the app — where the house is, when they are due, whether it was approved.
-- They ask the servant, forty times.
--
-- attendees.user_id has existed since 0133, nullable, with a unique index on
-- (booking_id, user_id). Nothing has ever written it and nothing has ever read
-- it. This fills it, two ways, and gives the people it links a narrow window
-- onto the booking.
--
-- WHAT A PARTICIPANT MAY SEE is enforced here, not in the UI: where they are
-- going, when, and whether it is confirmed. Not the price, not the roster, not
-- anyone else's phone or payment. That is why this is an RPC with a fixed
-- projection rather than an RLS policy on bookings — a policy grants the whole
-- row, and every column added to bookings later would silently join it.
-- ============================================================

-- ---------- Phone matching ----------
-- Egyptian mobiles get written +201012345678, 00201012345678, 01012345678 and
-- 1012345678 by the same person on the same day. Compared on the last nine
-- digits, which is the part that identifies the line.
CREATE OR REPLACE FUNCTION public.phone_key(p TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT NULLIF(RIGHT(regexp_replace(COALESCE(p, ''), '\D', '', 'g'), 9), '');
$$;

CREATE INDEX IF NOT EXISTS attendees_phone_key_idx
  ON public.attendees (public.phone_key(phone)) WHERE user_id IS NULL;

-- ---------- 1. Link by phone ----------
-- Called after sign-in. Claims every unclaimed attendee row carrying the
-- caller's number, and returns how many it took.
--
-- Two guards, both about never showing someone a stranger's trip:
--   * only rows with user_id IS NULL — a row already claimed is never moved.
--   * only when exactly ONE unclaimed row on that booking carries the number.
--     A servant who typed the same phone twice, or left one number on several
--     rows as a placeholder, must not hand one person somebody else's seat.
CREATE OR REPLACE FUNCTION public.link_my_attendee_rows()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  me     UUID := auth.uid();
  my_key TEXT;
  n      INTEGER := 0;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;

  SELECT public.phone_key(u.phone) INTO my_key FROM public.users u WHERE u.id = me;
  IF my_key IS NULL THEN RETURN 0; END IF;

  WITH unambiguous AS (
    SELECT a.id
      FROM public.attendees a
     WHERE a.user_id IS NULL
       AND public.phone_key(a.phone) = my_key
       -- Nobody on this booking is already me.
       AND NOT EXISTS (
         SELECT 1 FROM public.attendees b
          WHERE b.booking_id = a.booking_id AND b.user_id = me)
       -- And this number appears exactly once, unclaimed, on this booking.
       AND (SELECT COUNT(*) FROM public.attendees c
             WHERE c.booking_id = a.booking_id
               AND c.user_id IS NULL
               AND public.phone_key(c.phone) = my_key) = 1
  )
  UPDATE public.attendees a
     SET user_id = me
    FROM unambiguous x
   WHERE a.id = x.id;

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

-- ---------- 2. Link by code ----------
-- The phone route fails quietly and often: a typo, a second number, a landline,
-- an account opened with a different SIM. The code is the way back in, and the
-- servant already has one — booking ids are long and random, so a short derived
-- code is what can actually be read out over a phone.
CREATE OR REPLACE FUNCTION public.booking_join_code(p_booking_id TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT 'PB' || UPPER(RIGHT(regexp_replace(p_booking_id, '[^a-zA-Z0-9]', '', 'g'), 5));
$$;

CREATE OR REPLACE FUNCTION public.join_booking_by_code(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  me      UUID := auth.uid();
  code    TEXT := UPPER(TRIM(COALESCE(p_code, '')));
  b       public.bookings%ROWTYPE;
  my_name TEXT;
  my_key  TEXT;
  target  public.attendees%ROWTYPE;
  taken   INTEGER;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'لازم تسجّل دخولك الأول.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO b FROM public.bookings
   WHERE public.booking_join_code(id) = code;
  IF b.id IS NULL THEN
    RAISE EXCEPTION 'الكود غلط. راجعه مع مسؤول الرحلة.' USING ERRCODE = 'no_data_found';
  END IF;
  IF b.status <> 'approved' THEN
    RAISE EXCEPTION 'الرحلة دي لسه ما اتوافقش عليها.' USING ERRCODE = 'check_violation';
  END IF;

  -- Already in. Not an error: people tap twice.
  SELECT * INTO target FROM public.attendees
   WHERE booking_id = b.id AND user_id = me;
  IF target.id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', TRUE, 'bookingId', b.id, 'alreadyJoined', TRUE);
  END IF;

  SELECT name, public.phone_key(phone) INTO my_name, my_key
    FROM public.users WHERE id = me;

  -- Prefer the row the servant already wrote for this person. It carries the
  -- payment they have recorded against them, and adding a second row beside it
  -- would show the servant the same person twice and strand the money on one.
  SELECT * INTO target FROM public.attendees
   WHERE booking_id = b.id AND user_id IS NULL
     AND my_key IS NOT NULL AND public.phone_key(phone) = my_key
   LIMIT 1;

  IF target.id IS NOT NULL THEN
    UPDATE public.attendees SET user_id = me WHERE id = target.id;
    RETURN jsonb_build_object('ok', TRUE, 'bookingId', b.id,
                              'alreadyJoined', FALSE, 'matchedExisting', TRUE);
  END IF;

  -- No row for them at all. Add one, but never past the seats the booking paid
  -- for — the same ceiling 0079 puts on the self-registration link.
  SELECT COUNT(*) INTO taken FROM public.attendees WHERE booking_id = b.id;
  IF taken >= b.guests_count THEN
    RAISE EXCEPTION 'الرحلة اكتملت. كلّم مسؤول الرحلة.' USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.attendees
    (id, booking_id, name, gender, group_type, user_id, payment_status, registered_at)
  VALUES
    ('att_' || substr(md5(random()::text || clock_timestamp()::text), 1, 12),
     b.id, COALESCE(my_name, 'مشارك'), 'male', 'other', me, 'unpaid', NOW());

  RETURN jsonb_build_object('ok', TRUE, 'bookingId', b.id,
                            'alreadyJoined', FALSE, 'matchedExisting', FALSE);
END;
$$;

-- ---------- 3. What they may see ----------
-- The narrow window. Every column here is a deliberate choice, and the absent
-- ones are too: no total_price, no deposit, no roster, no other participant's
-- phone or payment. Their own payment status is included because it is theirs —
-- «انت دفعت» discloses nothing about anybody else.
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
  join_code       TEXT
)
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp AS $$
  SELECT
    b.id, b.house_id, b.house_name,
    h.governorate, h.address, h.lat, h.lng,
    b.check_in::TEXT, b.check_out::TEXT, b.status,
    -- The servant who booked, so a participant with a problem at the gate has
    -- someone to call who is not the house switchboard.
    u.name, u.phone,
    COALESCE(a.payment_status, CASE WHEN a.share_paid THEN 'paid' ELSE 'unpaid' END),
    public.booking_join_code(b.id)
  FROM public.attendees a
  JOIN public.bookings b ON b.id = a.booking_id
  LEFT JOIN public.houses h ON h.id = b.house_id
  LEFT JOIN public.users  u ON u.id = b.user_id
 WHERE a.user_id = auth.uid()
   -- A cancelled or rejected trip still matters to whoever was going on it.
   AND b.status IN ('approved', 'completed', 'cancelled', 'rejected')
 ORDER BY b.check_in DESC;
$$;

REVOKE ALL ON FUNCTION public.link_my_attendee_rows()      FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.join_booking_by_code(TEXT)   FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_participations()          FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.link_my_attendee_rows()    TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_booking_by_code(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_participations()        TO authenticated;
GRANT EXECUTE ON FUNCTION public.booking_join_code(TEXT)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.phone_key(TEXT)            TO authenticated;

COMMENT ON FUNCTION public.my_participations() IS
  'The narrow window a participant gets onto a trip they are on: where, when, '
  'is it confirmed, who organised it, and their own payment. No price, no '
  'roster, no other participant. A fixed projection rather than an RLS policy '
  'on bookings, so a column added to bookings later cannot silently join it.';
