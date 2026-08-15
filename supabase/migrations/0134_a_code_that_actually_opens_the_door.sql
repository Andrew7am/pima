-- ============================================================
-- The join code opens a door instead of decorating one
--
-- The hub shows a code and a QR, and «نظام الانضمام» offers a choice between
-- open and approval_needed. Nothing reads any of it. RLS grants SELECT to four
-- people — the host, an admin, the booking's owner, the house owner — so a
-- servant reads the code out to forty people and none of them can get in.
--
-- Two rules, and the second is the point:
--
--   the code lets you ASK to be let in
--   being in is a recorded fact, not a consequence of knowing the code
--
-- Knowing the code cannot be the authorisation, because a code read out in a
-- hall is known by everyone who overheard it and by whoever they forward it
-- to. So joining writes the user into joined_user_ids, and reading is granted
-- to people in that list. That also gives the host something to act on: a name
-- they can see, and later remove.
-- ============================================================

-- ── Reading, once you are in ────────────────────────────────────────────────
DROP POLICY IF EXISTS conferences_read ON public.conferences;
CREATE POLICY conferences_read ON public.conferences FOR SELECT
USING (
  host_user_id = auth.uid()
  OR public.is_admin(auth.uid())
  OR EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.houses h WHERE h.id = house_id AND h.owner_id = auth.uid())
  -- Joined, and only joined. Holding the code grants nothing on its own.
  OR joined_user_ids @> to_jsonb(ARRAY[auth.uid()::TEXT])
);

-- ── Joining ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.join_conference_by_code(code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  c        public.conferences%ROWTYPE;
  me       UUID := auth.uid();
  already  BOOLEAN;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'لازم تسجّل دخولك الأول.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO c FROM public.conferences
   WHERE UPPER(conference_code) = UPPER(TRIM(code));

  -- Same message whether the code is wrong or the conference is disabled would
  -- be tidier, but a servant who disabled their own room needs to know that is
  -- why their group is bouncing, so the two are told apart.
  IF c.id IS NULL THEN
    RAISE EXCEPTION 'الكود ده مش موجود. اتأكد منه مع مسؤول المؤتمر.' USING ERRCODE = 'no_data_found';
  END IF;
  IF c.is_disabled THEN
    RAISE EXCEPTION 'المؤتمر ده مقفول حالياً.' USING ERRCODE = 'check_violation';
  END IF;

  already := c.joined_user_ids @> to_jsonb(ARRAY[me::TEXT]);

  -- Idempotent: scanning the QR twice, or rejoining after a reinstall, must
  -- not add a second copy or read as a failure.
  IF NOT already THEN
    UPDATE public.conferences
       SET joined_user_ids = joined_user_ids || to_jsonb(ARRAY[me::TEXT])
     WHERE id = c.id;
  END IF;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'conferenceId', c.id,
    'title', c.title,
    'alreadyJoined', already,
    -- approval_needed is honoured by the hub, not here: the row records who
    -- asked. Refusing entry at this point would leave the host with no name to
    -- approve, which is the opposite of what the setting is for.
    'needsApproval', c.joining_requirements = 'approval_needed'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.join_conference_by_code(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_conference_by_code(TEXT) TO authenticated;

-- ── Leaving, and being removed ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.leave_conference(conf_id TEXT, target UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  c    public.conferences%ROWTYPE;
  me   UUID := auth.uid();
  who  UUID;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'لازم تسجّل دخولك الأول.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO c FROM public.conferences WHERE id = conf_id;
  IF c.id IS NULL THEN
    RAISE EXCEPTION 'المؤتمر غير موجود.' USING ERRCODE = 'no_data_found';
  END IF;

  who := COALESCE(target, me);
  -- You may remove yourself. Removing somebody else is the host's or an
  -- admin's alone — otherwise any participant could empty the room.
  IF who <> me AND c.host_user_id <> me AND NOT public.is_admin(me) THEN
    RAISE EXCEPTION 'مسؤول المؤتمر بس اللي يقدر يشيل حد.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE public.conferences
     SET joined_user_ids = (
           SELECT COALESCE(jsonb_agg(v), '[]'::JSONB)
             FROM jsonb_array_elements(joined_user_ids) AS v
            WHERE v <> to_jsonb(who::TEXT))
   WHERE id = c.id;

  RETURN jsonb_build_object('ok', TRUE);
END;
$$;

REVOKE ALL ON FUNCTION public.leave_conference(TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leave_conference(TEXT, UUID) TO authenticated;

COMMENT ON FUNCTION public.join_conference_by_code(TEXT) IS
  'The code lets you ask to come in; being in is joined_user_ids. Knowing a '
  'code overheard in a hall is not authorisation, and the recorded list is '
  'what lets a host see and remove people.';
