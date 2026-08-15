-- ============================================================
-- The servant opens the conference; approval only makes it possible
--
-- 123 opened a conference automatically on approval. That is wrong for most
-- bookings: a family taking a weekend does not want a room, a join code and a
-- QR, and every one of those rooms would sit empty carrying a code nobody
-- reads. It also decides for the servant something the servant should decide.
--
-- So approval stops creating and starts permitting. The trigger keeps the half
-- that was right — a conference whose booking leaves 'approved' is disabled,
-- never deleted — and creation moves to an RPC the servant calls.
--
-- The RPC checks two things the client cannot be trusted with: the booking is
-- yours, and it is approved. Neither is a UI concern.
-- ============================================================

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

CREATE OR REPLACE FUNCTION public.create_conference_for_booking(p_booking_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  b            public.bookings%ROWTYPE;
  me           UUID := auth.uid();
  v_house_name TEXT;
  v_org        TEXT;
  v_code       TEXT;
  existing     public.conferences%ROWTYPE;
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

  SELECT h.name INTO v_house_name FROM public.houses h WHERE h.id = b.house_id;
  SELECT COALESCE(u.organization_name, u.church_name, '') INTO v_org
    FROM public.users u WHERE u.id = b.user_id;

  v_code := 'PM' || UPPER(RIGHT(regexp_replace(b.user_id::TEXT, '[^a-zA-Z0-9]', '', 'g'), 3))
                 || UPPER(RIGHT(regexp_replace(b.id,            '[^a-zA-Z0-9]', '', 'g'), 4));

  INSERT INTO public.conferences (
    id, booking_id, house_id, house_name, title, organization_name,
    conference_code, qr_code_url, joining_requirements, host_user_id,
    starts_at, ends_at, guests_count
  ) VALUES (
    'conf_' || b.id, b.id, b.house_id, COALESCE(v_house_name, ''),
    'مؤتمر ' || COALESCE(v_house_name, ''), COALESCE(v_org, ''),
    v_code, v_code, 'open', b.user_id,
    b.check_in, b.check_out, b.guests_count
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

COMMENT ON FUNCTION public.create_conference_for_booking(TEXT) IS
  'The servant opens their own conference once the booking is approved. '
  'Approval permits; it no longer creates — most bookings never want a room.';
