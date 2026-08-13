-- ============================================================
-- 105: put back the counters migration 100 dropped
--
-- Migration 037 maintained total_games_played and total_matches_won
-- INSIDE finalize_match, in the same UPDATE that awards rating and
-- XP. Migration 100 rewrote finalize_match wholesale to widen its
-- return — and rewrote those two columns out of existence.
--
-- What that costs, from the moment 100 is applied: every competitive
-- match stops counting. «أول انتصار» and «بطل المباريات» can never
-- unlock, «أول خطوة» and «لاعب نشيط» stop advancing, and the
-- «مرات الفوز» tile on the leaderboard freezes at whatever it held.
-- Nothing errors; the numbers simply stop moving, which is the
-- hardest kind of breakage to notice.
--
-- Also fixed while here: claim_abandoned_match never counted at all,
-- in any version. Winning by an opponent's disconnection is still
-- winning a match that was played — it awards rating, XP and coins,
-- so it belongs in the same counters. Without this a player whose
-- opponents keep dropping sees their rating climb while «مرات الفوز»
-- stays at zero.
--
-- total_correct_answers is deliberately NOT touched. Matches have
-- never fed it — only award_game_reward does, from the solo games —
-- and host_score stopped being a count of correct answers when 104
-- introduced the per-round multiplier, so adding it here would need
-- the raw tally recomputed rather than the score reused. That is a
-- separate change and guessing at it would be worse than leaving the
-- column honest.
-- ============================================================

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

  IF r.host_score > r.guest_score THEN
    h_xp := 100; h_coins := 20; g_xp := 20; g_coins := 5;
  ELSIF r.guest_score > r.host_score THEN
    h_xp := 20; h_coins := 5; g_xp := 100; g_coins := 20;
  ELSE
    h_xp := 40; h_coins := 10; g_xp := 40; g_coins := 10;
  END IF;

  IF r.status = 'finished' THEN
    SELECT rating, level, xp, game_coins INTO h_new, h_lvl, h_xp_now, h_coins_now
      FROM public.users WHERE id = r.host_user_id;
    SELECT rating, level, xp, game_coins INTO g_new, g_lvl, g_xp_now, g_coins_now
      FROM public.users WHERE id = r.guest_user_id;
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

  -- The two counter columns are the whole point of this migration.
  UPDATE public.users
     SET rating = GREATEST(0, rating + h_change),
         xp = xp + h_xp,
         game_coins = game_coins + h_coins,
         total_games_played = total_games_played + 1,
         total_matches_won = total_matches_won
           + CASE WHEN win_uid = r.host_user_id THEN 1 ELSE 0 END
   WHERE id = r.host_user_id
   RETURNING rating INTO h_new;

  UPDATE public.users
     SET rating = GREATEST(0, rating + g_change),
         xp = xp + g_xp,
         game_coins = game_coins + g_coins,
         total_games_played = total_games_played + 1,
         total_matches_won = total_matches_won
           + CASE WHEN win_uid = r.guest_user_id THEN 1 ELSE 0 END
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
-- claim_abandoned_match — same counters. A win by the opponent
-- vanishing is still a match played and, for the one who stayed, a
-- match won.
-- ============================================================
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

  IF claimer_is_host THEN
    h_change := 12; h_xp := 50; h_coins := 10;
  ELSE
    g_change := 12; g_xp := 50; g_coins := 10;
  END IF;

  -- Both played it; only the one who stayed won it.
  UPDATE public.users
     SET rating = GREATEST(0, rating + h_change),
         xp = xp + h_xp,
         game_coins = game_coins + h_coins,
         total_games_played = total_games_played + 1,
         total_matches_won = total_matches_won + CASE WHEN claimer_is_host THEN 1 ELSE 0 END
   WHERE id = r.host_user_id
   RETURNING rating INTO h_new;

  UPDATE public.users
     SET rating = GREATEST(0, rating + g_change),
         xp = xp + g_xp,
         game_coins = game_coins + g_coins,
         total_games_played = total_games_played + 1,
         total_matches_won = total_matches_won + CASE WHEN claimer_is_host THEN 0 ELSE 1 END
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
