-- ============================================================
-- The venue section stops describing somebody else's house
--
-- «تفاصيل بيت الخلوة ومقر المؤتمر» named a house in وادي النطرون, gave an
-- emergency number of 0123456789, announced a gathering at «الجمعة 06:00 مساءً»,
-- and offered a map button that opened the Google Maps home page. None of it
-- came from the booking. A servant who read that card to their group would be
-- reading them an invented address and a phone number that rings nobody.
--
-- The house row already holds all of it. Four columns carry it onto the
-- conference, copied at creation for the same reason the dates were: this is
-- the venue as it stood when the conference was opened, and a printed card
-- should not silently change under the people holding it.
-- ============================================================

ALTER TABLE public.conferences
  ADD COLUMN IF NOT EXISTS house_governorate TEXT,
  ADD COLUMN IF NOT EXISTS house_address     TEXT,
  ADD COLUMN IF NOT EXISTS house_lat         DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS house_lng         DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS host_phone        TEXT;

-- Conferences opened before these columns existed.
UPDATE public.conferences c
   SET house_governorate = COALESCE(c.house_governorate, h.governorate),
       house_address     = COALESCE(c.house_address,     h.address),
       house_lat         = COALESCE(c.house_lat,         h.lat),
       house_lng         = COALESCE(c.house_lng,         h.lng)
  FROM public.houses h
 WHERE h.id = c.house_id
   AND (c.house_governorate IS NULL OR c.house_address IS NULL);

-- The emergency contact is the servant who booked, not the house: a group with
-- a problem at 2am needs the person who brought them, and that number is
-- already on their account.
UPDATE public.conferences c
   SET host_phone = u.phone
  FROM public.users u
 WHERE u.id = c.host_user_id
   AND c.host_phone IS NULL;

CREATE OR REPLACE FUNCTION public.create_conference_for_booking(p_booking_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  b        public.bookings%ROWTYPE;
  me       UUID := auth.uid();
  h        public.houses%ROWTYPE;
  v_org    TEXT;
  v_phone  TEXT;
  v_code   TEXT;
  existing public.conferences%ROWTYPE;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'لازم تسجّل دخولك الأول.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO b FROM public.bookings WHERE id = p_booking_id;
  IF b.id IS NULL THEN
    RAISE EXCEPTION 'الحجز غير موجود.' USING ERRCODE = 'no_data_found';
  END IF;

  -- Yours, and approved. Both checked here because a button cannot enforce
  -- either: the RPC is reachable without one.
  IF b.user_id <> me AND NOT public.is_admin(me) THEN
    RAISE EXCEPTION 'الحجز ده مش بتاعك.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF b.status <> 'approved' THEN
    RAISE EXCEPTION 'لازم صاحب البيت يوافق على الحجز الأول.' USING ERRCODE = 'check_violation';
  END IF;

  -- Opening twice is not an error; it is the same room.
  SELECT * INTO existing FROM public.conferences WHERE booking_id = b.id;
  IF existing.id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', TRUE, 'conferenceId', existing.id,
                              'code', existing.conference_code, 'alreadyOpen', TRUE);
  END IF;

  SELECT * INTO h FROM public.houses WHERE id = b.house_id;
  SELECT COALESCE(u.organization_name, u.church_name, ''), u.phone
    INTO v_org, v_phone
    FROM public.users u WHERE u.id = b.user_id;

  v_code := 'PM' || UPPER(RIGHT(regexp_replace(b.user_id::TEXT, '[^a-zA-Z0-9]', '', 'g'), 3))
                 || UPPER(RIGHT(regexp_replace(b.id,            '[^a-zA-Z0-9]', '', 'g'), 4));

  INSERT INTO public.conferences (
    id, booking_id, house_id, house_name, title, organization_name,
    conference_code, qr_code_url, joining_requirements, host_user_id,
    starts_at, ends_at, guests_count,
    house_governorate, house_address, house_lat, house_lng, host_phone
  ) VALUES (
    'conf_' || b.id, b.id, b.house_id, COALESCE(h.name, ''),
    'مؤتمر ' || COALESCE(h.name, ''), COALESCE(v_org, ''),
    v_code, v_code, 'open', b.user_id,
    b.check_in, b.check_out, b.guests_count,
    h.governorate, h.address, h.lat, h.lng, v_phone
  )
  -- The UNIQUE on booking_id still does the real work: two taps, or two
  -- devices, can only ever leave one room.
  ON CONFLICT (booking_id) DO NOTHING;

  SELECT * INTO existing FROM public.conferences WHERE booking_id = b.id;
  RETURN jsonb_build_object('ok', TRUE, 'conferenceId', existing.id,
                            'code', existing.conference_code, 'alreadyOpen', FALSE);
END;
$$;

REVOKE ALL ON FUNCTION public.create_conference_for_booking(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_conference_for_booking(TEXT) TO authenticated;

COMMENT ON COLUMN public.conferences.host_phone IS
  'The servant who booked, not the house. A group with a problem at 2am needs '
  'the person who brought them.';
