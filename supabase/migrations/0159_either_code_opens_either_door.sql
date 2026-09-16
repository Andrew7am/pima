-- ============================================================
-- One group, two codes — make either one work in either box
--
-- A group now carries two: PB…, the booking code a participant types to follow
-- the trip (0156), and PM…, the conference code that opens the hub (0134). A
-- servant sending «الكود» to forty people has to know which of the two they
-- mean and which box the person will type it into, and they will not. The
-- person on the other end gets «الكود غلط» from a code that is perfectly
-- valid, two rooms away.
--
-- Unifying them properly means deciding which one a group *has*, and that is
-- the owner's call, not a migration's. So this does the part that needs no
-- decision: each door accepts the other's key.
--
-- A PM code typed into the trip box resolves to that conference's booking; a
-- PB code typed into the conference box resolves to that booking's conference
-- when one has been opened. Nothing changes about what is displayed, what is
-- generated, or what either RPC does once it has resolved — only that a wrong
-- box is no longer a dead end.
-- ============================================================

-- ---------- The trip box also takes a conference code ----------
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

  -- Not a booking code. Before refusing, try it as a conference code: the
  -- servant may well have sent the one the hub prints.
  IF b.id IS NULL THEN
    SELECT bk.* INTO b
      FROM public.conferences c
      JOIN public.bookings bk ON bk.id = c.booking_id
     WHERE UPPER(c.conference_code) = code;
  END IF;

  IF b.id IS NULL THEN
    RAISE EXCEPTION 'الكود غلط. راجعه مع مسؤول الرحلة.' USING ERRCODE = 'no_data_found';
  END IF;
  IF b.status <> 'approved' THEN
    RAISE EXCEPTION 'الرحلة دي لسه ما اتوافقش عليها.' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO target FROM public.attendees
   WHERE booking_id = b.id AND user_id = me;
  IF target.id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', TRUE, 'bookingId', b.id, 'alreadyJoined', TRUE);
  END IF;

  SELECT name, public.phone_key(phone) INTO my_name, my_key
    FROM public.users WHERE id = me;

  -- Still prefers the row the servant already wrote: it carries the payment
  -- recorded against them, and a duplicate strands that money on one of two
  -- rows showing the same person.
  SELECT * INTO target FROM public.attendees
   WHERE booking_id = b.id AND user_id IS NULL
     AND my_key IS NOT NULL AND public.phone_key(phone) = my_key
   LIMIT 1;

  IF target.id IS NOT NULL THEN
    UPDATE public.attendees SET user_id = me WHERE id = target.id;
    RETURN jsonb_build_object('ok', TRUE, 'bookingId', b.id,
                              'alreadyJoined', FALSE, 'matchedExisting', TRUE);
  END IF;

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

REVOKE ALL ON FUNCTION public.join_booking_by_code(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_booking_by_code(TEXT) TO authenticated;

-- ---------- Resolving the other way ----------
-- The conference box is 0134's join_conference_by_code, which matches on
-- conferences.conference_code. Rather than rewrite that function — it is the
-- one that also handles joining requirements and the joined_user_ids array —
-- this gives it the same courtesy through a lookup it can use: a PB code
-- resolves to the conference opened against that booking, when one has been.
CREATE OR REPLACE FUNCTION public.conference_code_for_any_code(p_code TEXT)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
  SELECT c.conference_code
    FROM public.conferences c
   WHERE UPPER(c.conference_code) = UPPER(TRIM(COALESCE(p_code, '')))
      OR public.booking_join_code(c.booking_id) = UPPER(TRIM(COALESCE(p_code, '')))
   LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.conference_code_for_any_code(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.conference_code_for_any_code(TEXT) TO authenticated;

COMMENT ON FUNCTION public.conference_code_for_any_code(TEXT) IS
  'Takes either code a group carries and returns the conference code, so the '
  'conference box accepts a booking code. Which code a group should have is a '
  'product decision; this only stops the wrong box being a dead end.';
