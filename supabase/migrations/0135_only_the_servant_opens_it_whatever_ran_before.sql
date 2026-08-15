-- ============================================================
-- Settle the trigger and the RPC, whatever order the earlier files ran in
--
-- 126 stopped approval from creating a conference and moved creation into an
-- RPC. 127 then re-created that RPC to stamp the venue onto the row — but it
-- did not touch the trigger. That leaves two ways to end up somewhere wrong,
-- and both are silent:
--
--   * 126 never applied → the trigger from 123/125 is still live, and every
--     approved booking opens a conference by itself. A family taking a weekend
--     gets a room, a join code and a QR nobody asked for.
--   * 126 applied AFTER 127 → the RPC is back to its pre-venue body, so every
--     conference opened from then on has NULL governorate, address and phone,
--     and the venue card goes quiet again with nothing to say.
--
-- This file asserts both ends at once and is safe to run repeatedly. It is
-- deliberately a copy rather than a delta: after this, the last migration to
-- touch either function is the one that says what both should be.
-- ============================================================

-- ---------- 1. The trigger permits; it never creates ----------
CREATE OR REPLACE FUNCTION public.open_conference_for_booking()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
  -- Left approved: close the room, keep everything in it.
  IF OLD.status = 'approved' AND NEW.status IS DISTINCT FROM 'approved' THEN
    UPDATE public.conferences SET is_disabled = TRUE WHERE booking_id = NEW.id;
    RETURN NEW;
  END IF;

  -- Back to approved: reopen the one that exists and re-stamp its dates, in
  -- case the booking moved while it was closed. Still never creates one.
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    UPDATE public.conferences
       SET is_disabled  = FALSE,
           starts_at    = NEW.check_in,
           ends_at      = NEW.check_out,
           guests_count = NEW.guests_count
     WHERE booking_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- ---------- 2. The RPC the servant calls, venue included ----------
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

-- ---------- 3. Repair whatever the auto-trigger left behind ----------
-- Conferences the trigger opened on its own carry no venue, because 123/125
-- never stamped one. Fill them from the house rather than leave the card blank.
UPDATE public.conferences c
   SET house_governorate = COALESCE(c.house_governorate, h.governorate),
       house_address     = COALESCE(c.house_address,     h.address),
       house_lat         = COALESCE(c.house_lat,         h.lat),
       house_lng         = COALESCE(c.house_lng,         h.lng)
  FROM public.houses h
 WHERE h.id = c.house_id
   AND (c.house_governorate IS NULL OR c.house_address IS NULL
        OR c.house_lat IS NULL OR c.house_lng IS NULL);

UPDATE public.conferences c
   SET host_phone = u.phone
  FROM public.users u
 WHERE u.id = c.host_user_id
   AND c.host_phone IS NULL;

-- Say out loud how many rooms nobody asked for are sitting there. They are not
-- deleted: one of them may have people in it, and a servant losing a roster to
-- a migration is worse than an empty room in a list.
DO $$
DECLARE
  n_empty INTEGER;
BEGIN
  SELECT COUNT(*) INTO n_empty
    FROM public.conferences
   WHERE COALESCE(jsonb_array_length(joined_user_ids), 0) = 0
     AND COALESCE(jsonb_array_length(schedule), 0) = 0
     AND COALESCE(jsonb_array_length(announcements), 0) = 0;
  IF n_empty > 0 THEN
    RAISE NOTICE 'Conferences with nobody joined and nothing in them: %. Likely opened by the pre-126 trigger. Left in place — check before removing.', n_empty;
  END IF;
END $$;

COMMENT ON FUNCTION public.open_conference_for_booking() IS
  'Approval permits a conference and closes one whose booking is withdrawn. It '
  'never creates: most bookings are families who do not want a room. Creation '
  'is create_conference_for_booking(), which the servant calls.';
