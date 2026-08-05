-- ============================================================
-- 100: tell the player what they won, and make answers arrive in order
--
-- 1) finalize_match already awards XP and coins — 100/20 to the
--    winner, 40/10 each on a draw, 20/5 to the loser — and sweeps
--    level-ups. None of it was in the function's return, so the
--    client only ever learned the rating change. The player finished
--    a match, was paid, and was told nothing; the hub kept showing
--    pre-match numbers until a reload.
--
--    The amounts are recomputed rather than stored, because they are
--    a pure function of the two scores. That keeps the idempotent
--    'finished' branch honest with no new columns.
--
-- 2) submit_answer accepted any in-range question index, so a client
--    could fire all of a match's answers in one burst without ever
--    waiting for the opponent — or for the question to be on screen.
--    Answering AHEAD of current_question is now refused. Answering AT
--    it stays legal, and answering behind it is already impossible:
--    the index only advances once both players have answered, and a
--    second answer to the same question raises ALREADY_ANSWERED.
--
--    Deliberately `>` and not `<>`: the match screen intentionally
--    lags its display behind the server to hold a reveal, and a lagging
--    display must never be told its answer is invalid.
-- ============================================================

-- The return type changes, so the old signature has to go first.
DROP FUNCTION IF EXISTS public.finalize_match(TEXT);

CREATE OR REPLACE FUNCTION public.finalize_match(p_room_id TEXT)
RETURNS TABLE(
  host_rating_change INTEGER,
  guest_rating_change INTEGER,
  host_new_rating INTEGER,
  guest_new_rating INTEGER,
  winner_user_id UUID,
  host_xp_gain INTEGER,
  guest_xp_gain INTEGER,
  host_coins_gain INTEGER,
  guest_coins_gain INTEGER,
  host_new_level INTEGER,
  guest_new_level INTEGER,
  -- Post-sweep balances. The client cannot add the gain to what it holds:
  -- _sweep_level_ups resets xp to the overflow on a level-up, so client-side
  -- arithmetic would drift from the row the moment anyone leveled.
  host_new_xp INTEGER,
  guest_new_xp INTEGER,
  host_new_coins INTEGER,
  guest_new_coins INTEGER
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  uid UUID := auth.uid();
  r public.game_rooms%ROWTYPE;
  qcount INT;
  h_change INT; g_change INT;
  h_new INT; g_new INT;
  h_lvl INT; g_lvl INT;
  h_xp_now INT; g_xp_now INT; h_coins_now INT; g_coins_now INT;
  win_uid UUID;
  h_xp INT; h_coins INT; g_xp INT; g_coins INT;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  SELECT * INTO r FROM public.game_rooms WHERE id = p_room_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ROOM_NOT_FOUND'; END IF;
  IF uid <> r.host_user_id AND uid IS DISTINCT FROM r.guest_user_id THEN
    RAISE EXCEPTION 'NOT_A_PARTICIPANT';
  END IF;

  -- Same split the awarding branch below uses. Kept in one place so the
  -- idempotent path cannot drift from the path that actually paid out.
  IF r.host_score > r.guest_score THEN
    h_xp := 100; h_coins := 20; g_xp := 20; g_coins := 5;
  ELSIF r.guest_score > r.host_score THEN
    h_xp := 20; h_coins := 5; g_xp := 100; g_coins := 20;
  ELSE
    h_xp := 40; h_coins := 10; g_xp := 40; g_coins := 10;
  END IF;

  -- Idempotent: already settled, so report what was recorded.
  IF r.status = 'finished' THEN
    SELECT rating, level, xp, game_coins INTO h_new, h_lvl, h_xp_now, h_coins_now
      FROM public.users WHERE id = r.host_user_id;
    SELECT rating, level, xp, game_coins INTO g_new, g_lvl, g_xp_now, g_coins_now
      FROM public.users WHERE id = r.guest_user_id;
    -- A room settled by claim_abandoned_match paid a different, reduced
    -- amount; reporting the full match split there would be a lie, and its
    -- signature is a rating change of exactly 12 to one side and 0 to the
    -- other with no draw.
    IF (r.host_rating_change = 12 AND COALESCE(r.guest_rating_change, 0) = 0)
       OR (r.guest_rating_change = 12 AND COALESCE(r.host_rating_change, 0) = 0) THEN
      h_xp := CASE WHEN r.host_rating_change = 12 THEN 50 ELSE 0 END;
      h_coins := CASE WHEN r.host_rating_change = 12 THEN 10 ELSE 0 END;
      g_xp := CASE WHEN r.guest_rating_change = 12 THEN 50 ELSE 0 END;
      g_coins := CASE WHEN r.guest_rating_change = 12 THEN 10 ELSE 0 END;
    END IF;
    RETURN QUERY SELECT r.host_rating_change, r.guest_rating_change, h_new, g_new,
                        r.winner_user_id, h_xp, g_xp, h_coins, g_coins, h_lvl, g_lvl,
                        h_xp_now, g_xp_now, h_coins_now, g_coins_now;
    RETURN;
  END IF;

  IF r.status <> 'active' THEN RAISE EXCEPTION 'ROOM_NOT_ACTIVE'; END IF;

  qcount := jsonb_array_length(r.questions);
  IF public.jsonb_object_keys_count(r.host_answers) < qcount
     OR public.jsonb_object_keys_count(r.guest_answers) < qcount THEN
    RAISE EXCEPTION 'MATCH_INCOMPLETE';
  END IF;

  IF r.host_score > r.guest_score THEN
    h_change := 25; g_change := -15; win_uid := r.host_user_id;
  ELSIF r.guest_score > r.host_score THEN
    h_change := -15; g_change := 25; win_uid := r.guest_user_id;
  ELSE
    h_change := 0; g_change := 0; win_uid := NULL;
  END IF;

  UPDATE public.users
     SET rating = GREATEST(0, rating + h_change),
         xp = xp + h_xp,
         game_coins = game_coins + h_coins
   WHERE id = r.host_user_id
   RETURNING rating INTO h_new;

  UPDATE public.users
     SET rating = GREATEST(0, rating + g_change),
         xp = xp + g_xp,
         game_coins = game_coins + g_coins
   WHERE id = r.guest_user_id
   RETURNING rating INTO g_new;

  PERFORM public._sweep_level_ups(r.host_user_id);
  PERFORM public._sweep_level_ups(r.guest_user_id);

  -- Read the level AFTER the sweep, so a level-up can actually be announced.
  SELECT level, xp, game_coins INTO h_lvl, h_xp_now, h_coins_now
    FROM public.users WHERE id = r.host_user_id;
  SELECT level, xp, game_coins INTO g_lvl, g_xp_now, g_coins_now
    FROM public.users WHERE id = r.guest_user_id;

  UPDATE public.game_rooms
     SET status = 'finished',
         winner_user_id = win_uid,
         host_rating_change = h_change,
         guest_rating_change = g_change,
         finished_at = NOW(),
         updated_at = NOW()
   WHERE id = p_room_id;

  RETURN QUERY SELECT h_change, g_change, h_new, g_new, win_uid,
                      h_xp, g_xp, h_coins, g_coins, h_lvl, g_lvl,
                      h_xp_now, g_xp_now, h_coins_now, g_coins_now;
END;
$$;

GRANT EXECUTE ON FUNCTION public.finalize_match(TEXT) TO authenticated;


-- ============================================================
-- submit_answer — refuse answers for questions the match has not
-- reached. Everything else about it is unchanged.
-- ============================================================
CREATE OR REPLACE FUNCTION public.submit_answer(
  p_room_id TEXT,
  p_q_idx INT,
  p_opt_idx INT
) RETURNS TABLE(host_score INT, guest_score INT, both_answered BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  uid UUID := auth.uid();
  r public.game_rooms%ROWTYPE;
  is_host BOOLEAN;
  correct_idx INT;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  SELECT * INTO r FROM public.game_rooms WHERE id = p_room_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ROOM_NOT_FOUND'; END IF;
  IF r.status <> 'active' THEN RAISE EXCEPTION 'ROOM_NOT_ACTIVE'; END IF;
  IF uid <> r.host_user_id AND uid IS DISTINCT FROM r.guest_user_id THEN
    RAISE EXCEPTION 'NOT_A_PARTICIPANT';
  END IF;
  IF p_q_idx < 0 OR p_q_idx >= jsonb_array_length(r.questions) THEN
    RAISE EXCEPTION 'INVALID_QUESTION_INDEX';
  END IF;
  -- New: no answering ahead of the match.
  IF p_q_idx > r.current_question THEN
    RAISE EXCEPTION 'QUESTION_NOT_ACTIVE';
  END IF;

  is_host := (uid = r.host_user_id);
  IF is_host AND r.host_answers ? p_q_idx::text THEN
    RAISE EXCEPTION 'ALREADY_ANSWERED';
  END IF;
  IF NOT is_host AND r.guest_answers ? p_q_idx::text THEN
    RAISE EXCEPTION 'ALREADY_ANSWERED';
  END IF;

  correct_idx := (r.questions -> p_q_idx ->> 'correctIdx')::INT;

  IF is_host THEN
    UPDATE public.game_rooms
       SET host_answers = host_answers || jsonb_build_object(p_q_idx::text, p_opt_idx),
           host_score = host_score + CASE WHEN p_opt_idx = correct_idx THEN 1 ELSE 0 END,
           updated_at = NOW()
     WHERE id = p_room_id;
  ELSE
    UPDATE public.game_rooms
       SET guest_answers = guest_answers || jsonb_build_object(p_q_idx::text, p_opt_idx),
           guest_score = guest_score + CASE WHEN p_opt_idx = correct_idx THEN 1 ELSE 0 END,
           updated_at = NOW()
     WHERE id = p_room_id;
  END IF;

  SELECT * INTO r FROM public.game_rooms WHERE id = p_room_id;
  IF r.host_answers ? p_q_idx::text AND r.guest_answers ? p_q_idx::text THEN
    UPDATE public.game_rooms
       SET current_question = GREATEST(current_question, p_q_idx + 1),
           updated_at = NOW()
     WHERE id = p_room_id;
    SELECT * INTO r FROM public.game_rooms WHERE id = p_room_id;
  END IF;

  RETURN QUERY SELECT r.host_score, r.guest_score,
    (r.host_answers ? p_q_idx::text AND r.guest_answers ? p_q_idx::text);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_answer(TEXT, INT, INT) TO authenticated;


-- ============================================================
-- claim_abandoned_match — same widened return as finalize_match.
--
-- The match screen renders whichever of the two settled the room and
-- cannot tell them apart, so a claim returning the narrow shape made
-- the summary read «+0 خبرة» over a win that really did pay 50 XP
-- and 10 coins. Logic is unchanged from 099; only the return grows.
-- ============================================================
DROP FUNCTION IF EXISTS public.claim_abandoned_match(TEXT);

CREATE OR REPLACE FUNCTION public.claim_abandoned_match(p_room_id TEXT)
RETURNS TABLE(
  host_rating_change INTEGER,
  guest_rating_change INTEGER,
  host_new_rating INTEGER,
  guest_new_rating INTEGER,
  winner_user_id UUID,
  host_xp_gain INTEGER,
  guest_xp_gain INTEGER,
  host_coins_gain INTEGER,
  guest_coins_gain INTEGER,
  host_new_level INTEGER,
  guest_new_level INTEGER,
  host_new_xp INTEGER,
  guest_new_xp INTEGER,
  host_new_coins INTEGER,
  guest_new_coins INTEGER
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  uid UUID := auth.uid();
  r public.game_rooms%ROWTYPE;
  mine INT; theirs INT;
  h_change INT := 0; g_change INT := 0;
  h_new INT; g_new INT;
  h_lvl INT; g_lvl INT;
  h_xp_now INT; g_xp_now INT; h_coins_now INT; g_coins_now INT;
  h_xp INT := 0; g_xp INT := 0; h_coins INT := 0; g_coins INT := 0;
  claimer_is_host BOOLEAN;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;

  SELECT * INTO r FROM public.game_rooms WHERE id = p_room_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ROOM_NOT_FOUND'; END IF;
  IF uid <> r.host_user_id AND uid IS DISTINCT FROM r.guest_user_id THEN
    RAISE EXCEPTION 'NOT_A_PARTICIPANT';
  END IF;

  IF r.status = 'finished' THEN
    SELECT rating, level, xp, game_coins INTO h_new, h_lvl, h_xp_now, h_coins_now
      FROM public.users WHERE id = r.host_user_id;
    SELECT rating, level, xp, game_coins INTO g_new, g_lvl, g_xp_now, g_coins_now
      FROM public.users WHERE id = r.guest_user_id;
    h_xp := CASE WHEN r.host_rating_change = 12 THEN 50 ELSE 0 END;
    h_coins := CASE WHEN r.host_rating_change = 12 THEN 10 ELSE 0 END;
    g_xp := CASE WHEN r.guest_rating_change = 12 THEN 50 ELSE 0 END;
    g_coins := CASE WHEN r.guest_rating_change = 12 THEN 10 ELSE 0 END;
    RETURN QUERY SELECT r.host_rating_change, r.guest_rating_change, h_new, g_new,
                        r.winner_user_id, h_xp, g_xp, h_coins, g_coins, h_lvl, g_lvl,
                        h_xp_now, g_xp_now, h_coins_now, g_coins_now;
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
  IF claimer_is_host THEN
    h_change := 12; h_xp := 50; h_coins := 10;
  ELSE
    g_change := 12; g_xp := 50; g_coins := 10;
  END IF;

  UPDATE public.users
     SET rating = GREATEST(0, rating + h_change), xp = xp + h_xp, game_coins = game_coins + h_coins
   WHERE id = r.host_user_id
   RETURNING rating INTO h_new;

  UPDATE public.users
     SET rating = GREATEST(0, rating + g_change), xp = xp + g_xp, game_coins = game_coins + g_coins
   WHERE id = r.guest_user_id
   RETURNING rating INTO g_new;

  PERFORM public._sweep_level_ups(r.host_user_id);
  PERFORM public._sweep_level_ups(r.guest_user_id);

  SELECT level, xp, game_coins INTO h_lvl, h_xp_now, h_coins_now
    FROM public.users WHERE id = r.host_user_id;
  SELECT level, xp, game_coins INTO g_lvl, g_xp_now, g_coins_now
    FROM public.users WHERE id = r.guest_user_id;

  UPDATE public.game_rooms
     SET status = 'finished',
         winner_user_id = uid,
         host_rating_change = h_change,
         guest_rating_change = g_change,
         finished_at = NOW(),
         updated_at = NOW()
   WHERE id = p_room_id;

  RETURN QUERY SELECT h_change, g_change, h_new, g_new, uid,
                      h_xp, g_xp, h_coins, g_coins, h_lvl, g_lvl,
                      h_xp_now, g_xp_now, h_coins_now, g_coins_now;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_abandoned_match(TEXT) TO authenticated;
