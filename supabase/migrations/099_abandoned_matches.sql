-- ============================================================
-- 099: a match that starts can end
--
-- Three faults, one cause: nothing ever cleaned up a room nobody
-- was in.
--
-- 1. «إلغاء الغرفة والخروج» never cancelled anything — its whole
--    handler was a client-side navigation. The 'cancelled' status
--    has been legal since 036's CHECK constraint and no code in
--    any migration ever set it. Rooms sat in 'waiting' forever.
--
-- 2. find_or_create_random_room tie-breaks `created_at ASC`, so it
--    deliberately hands out the OLDEST waiting room — which is the
--    one most likely to have been abandoned. The next real player
--    to search got matched into a corpse.
--
-- 3. Once in, they were stuck: current_question only advances when
--    BOTH players answer (036), the 20s timer only auto-submits for
--    the player who is present, and finalize_match raises
--    MATCH_INCOMPLETE unless both answer sets are full. So the
--    present player sat on «في انتظار إجابة الخصم» indefinitely and
--    neither side got rating, XP or coins.
--
-- After this: cancelling is real, stale rooms are never handed out
-- and get swept, a player cannot hold two open rooms at once, and a
-- player stranded by a disconnect can settle the match themselves.
-- ============================================================

-- How long a waiting room may sit untouched before the matcher stops
-- offering it and sweeps it. Generous: a host on a slow connection is
-- still a real opponent.
CREATE OR REPLACE FUNCTION public._stale_room_cutoff() RETURNS INTERVAL
LANGUAGE sql IMMUTABLE AS $$ SELECT INTERVAL '2 minutes' $$;

-- How long the opponent must be silent before the present player may
-- claim the match. Long enough to survive a tunnel or a phone call
-- being answered, short enough not to feel like a punishment.
CREATE OR REPLACE FUNCTION public._abandon_cutoff() RETURNS INTERVAL
LANGUAGE sql IMMUTABLE AS $$ SELECT INTERVAL '45 seconds' $$;


-- ============================================================
-- cancel_room — make the exit button tell the truth.
--
-- Only from 'waiting': once a match is active there is an opponent
-- with a stake in it, and leaving is an abandonment for them to
-- claim (below), not a cancellation. Idempotent, and silent when the
-- room is already gone — this is called on the way out of a screen,
-- where an error the player cannot act on is worse than nothing.
-- ============================================================
CREATE OR REPLACE FUNCTION public.cancel_room(p_room_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  uid UUID := auth.uid();
  r   public.game_rooms%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;

  SELECT * INTO r FROM public.game_rooms WHERE id = p_room_id;
  IF NOT FOUND THEN RETURN FALSE; END IF;

  -- IS DISTINCT FROM, not <>. A waiting room has no guest yet, and
  -- `uid <> NULL` is NULL rather than true — so the plain comparison
  -- would let the whole check fall through and hand any authenticated
  -- stranger the ability to cancel someone else's room.
  IF uid <> r.host_user_id AND uid IS DISTINCT FROM r.guest_user_id THEN
    RAISE EXCEPTION 'NOT_A_PARTICIPANT';
  END IF;

  IF r.status <> 'waiting' THEN RETURN FALSE; END IF;

  UPDATE public.game_rooms
     SET status = 'cancelled', updated_at = NOW()
   WHERE id = p_room_id AND status = 'waiting';

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_room(TEXT) TO authenticated;


-- ============================================================
-- claim_abandoned_match — let a stranded player collect.
--
-- Deliberately asymmetric. The present player gets a REDUCED win,
-- because they did not beat anyone; the absent player loses NOTHING.
-- A dropped connection in a village church must not cost rating —
-- the point is to release the person who is still here, not to
-- punish the person whose signal went.
--
-- The guard that makes this unabusable: the caller must have
-- answered strictly MORE questions than the opponent. That can only
-- be true if they are the one waiting. Idling to farm a claim is not
-- possible, because idling does not advance your own answer count.
-- ============================================================
CREATE OR REPLACE FUNCTION public.claim_abandoned_match(p_room_id TEXT)
RETURNS TABLE(
  host_rating_change INTEGER,
  guest_rating_change INTEGER,
  host_new_rating INTEGER,
  guest_new_rating INTEGER,
  winner_user_id UUID
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  uid UUID := auth.uid();
  r public.game_rooms%ROWTYPE;
  mine INT;
  theirs INT;
  h_change INT := 0;
  g_change INT := 0;
  h_new INT;
  g_new INT;
  claimer_is_host BOOLEAN;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;

  SELECT * INTO r FROM public.game_rooms WHERE id = p_room_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ROOM_NOT_FOUND'; END IF;
  IF uid <> r.host_user_id AND uid <> r.guest_user_id THEN
    RAISE EXCEPTION 'NOT_A_PARTICIPANT';
  END IF;

  -- Already settled — hand back what was recorded, like finalize_match.
  IF r.status = 'finished' THEN
    SELECT rating INTO h_new FROM public.users WHERE id = r.host_user_id;
    SELECT rating INTO g_new FROM public.users WHERE id = r.guest_user_id;
    RETURN QUERY SELECT r.host_rating_change, r.guest_rating_change, h_new, g_new, r.winner_user_id;
    RETURN;
  END IF;

  IF r.status <> 'active' THEN RAISE EXCEPTION 'ROOM_NOT_ACTIVE'; END IF;
  IF r.guest_user_id IS NULL THEN RAISE EXCEPTION 'NO_OPPONENT'; END IF;

  IF NOW() - r.updated_at < public._abandon_cutoff() THEN
    RAISE EXCEPTION 'OPPONENT_STILL_ACTIVE';
  END IF;

  claimer_is_host := (uid = r.host_user_id);
  IF claimer_is_host THEN
    mine   := public.jsonb_object_keys_count(r.host_answers);
    theirs := public.jsonb_object_keys_count(r.guest_answers);
  ELSE
    mine   := public.jsonb_object_keys_count(r.guest_answers);
    theirs := public.jsonb_object_keys_count(r.host_answers);
  END IF;

  IF mine <= theirs THEN RAISE EXCEPTION 'NOT_WAITING_ON_OPPONENT'; END IF;

  -- Half a real win's rating, and nothing taken from the absent player.
  IF claimer_is_host THEN h_change := 12; ELSE g_change := 12; END IF;

  UPDATE public.users
     SET rating = GREATEST(0, rating + h_change),
         xp = xp + CASE WHEN claimer_is_host THEN 50 ELSE 0 END,
         game_coins = game_coins + CASE WHEN claimer_is_host THEN 10 ELSE 0 END
   WHERE id = r.host_user_id
   RETURNING rating INTO h_new;

  UPDATE public.users
     SET rating = GREATEST(0, rating + g_change),
         xp = xp + CASE WHEN claimer_is_host THEN 0 ELSE 50 END,
         game_coins = game_coins + CASE WHEN claimer_is_host THEN 0 ELSE 10 END
   WHERE id = r.guest_user_id
   RETURNING rating INTO g_new;

  PERFORM public._sweep_level_ups(r.host_user_id);
  PERFORM public._sweep_level_ups(r.guest_user_id);

  UPDATE public.game_rooms
     SET status = 'finished',
         winner_user_id = uid,
         host_rating_change = h_change,
         guest_rating_change = g_change,
         finished_at = NOW(),
         updated_at = NOW()
   WHERE id = p_room_id;

  RETURN QUERY SELECT h_change, g_change, h_new, g_new, uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_abandoned_match(TEXT) TO authenticated;


-- ============================================================
-- find_or_create_random_room — replaced.
--
-- Same shape and same return as 036. Three changes, all about not
-- handing out or leaving behind rooms nobody is in:
--   * sweep stale waiting rooms on the way past (there is no cron in
--     this project, so the matchmaking call is the honest hook);
--   * never offer a room that has gone quiet;
--   * cancel the caller's own open room first, so tapping search,
--     backing out and tapping again cannot leave a trail of orphans.
-- ============================================================
CREATE OR REPLACE FUNCTION public.find_or_create_random_room(
  p_game_mode TEXT,
  p_questions JSONB
) RETURNS TABLE(room_id TEXT, was_created BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  uid   UUID := auth.uid();
  uname TEXT;
  urat  INTEGER;
  found_id TEXT;
  new_id TEXT;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF p_game_mode NOT IN ('trivia', 'hymns', 'fillverse', 'whoami') THEN
    RAISE EXCEPTION 'INVALID_MODE';
  END IF;

  SELECT name, rating INTO uname, urat FROM public.users WHERE id = uid;

  -- Sweep: anything that has sat untouched past the cutoff is gone.
  UPDATE public.game_rooms
     SET status = 'cancelled', updated_at = NOW()
   WHERE status = 'waiting'
     AND is_private = FALSE
     AND updated_at < NOW() - public._stale_room_cutoff();

  -- One open room per player.
  UPDATE public.game_rooms
     SET status = 'cancelled', updated_at = NOW()
   WHERE status = 'waiting'
     AND is_private = FALSE
     AND host_user_id = uid;

  -- Closest rating first, oldest first among equals — but only among
  -- rooms that are still fresh.
  SELECT id INTO found_id FROM public.game_rooms
   WHERE status = 'waiting'
     AND is_private = FALSE
     AND game_mode = p_game_mode
     AND host_user_id <> uid
     AND updated_at >= NOW() - public._stale_room_cutoff()
     AND ABS(host_rating - urat) <= 500
   ORDER BY ABS(host_rating - urat) ASC, created_at ASC
   LIMIT 1;

  IF found_id IS NOT NULL THEN
    UPDATE public.game_rooms
       SET guest_user_id = uid,
           guest_name = uname,
           guest_rating = urat,
           status = 'active',
           updated_at = NOW()
     WHERE id = found_id AND status = 'waiting';
    RETURN QUERY SELECT found_id, FALSE;
    RETURN;
  END IF;

  IF p_questions IS NULL OR jsonb_array_length(p_questions) < 3 THEN
    RAISE EXCEPTION 'INVALID_QUESTIONS';
  END IF;
  new_id := 'rm_' || substr(md5(random()::text || clock_timestamp()::text), 1, 12);
  INSERT INTO public.game_rooms (
    id, is_private, game_mode, host_user_id, host_name, host_rating, questions
  ) VALUES (
    new_id, FALSE, p_game_mode, uid, uname, urat, p_questions
  );
  RETURN QUERY SELECT new_id, TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_or_create_random_room(TEXT, JSONB) TO authenticated;

-- The sweep and the freshness filter both scan waiting rooms by age.
CREATE INDEX IF NOT EXISTS game_rooms_waiting_updated_idx
  ON public.game_rooms (status, updated_at)
  WHERE status = 'waiting';
