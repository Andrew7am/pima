-- ============================================================
-- Entertainment: achievements + badges.
--
-- Tracks the cumulative stats achievements are computed from
-- (total_correct_answers, total_games_played, total_matches_won),
-- plus unlocked_achievements — a permanent record of which
-- achievement ids a user has already claimed, so check_achievements()
-- never re-awards the same one twice even if the underlying stat
-- later changes (e.g. game_coins gets spent below a threshold).
--
-- The achievement CATALOG (thresholds + rewards) lives server-side in
-- check_achievements() below, not on the client — same trust model as
-- everything else in this module: the client can ask "did I unlock
-- anything?" but can't claim a specific one or fake its progress.
-- ============================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS total_correct_answers INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_games_played     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_matches_won      INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unlocked_achievements  TEXT[]  NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION public.protect_user_privileged_columns()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF current_user = 'authenticated' AND NOT public.is_admin(auth.uid()) THEN
    NEW.points                  := OLD.points;
    NEW.xp                      := OLD.xp;
    NEW.level                   := OLD.level;
    NEW.game_coins              := OLD.game_coins;
    NEW.rating                  := OLD.rating;
    NEW.total_correct_answers   := OLD.total_correct_answers;
    NEW.total_games_played      := OLD.total_games_played;
    NEW.total_matches_won       := OLD.total_matches_won;
    NEW.unlocked_achievements   := OLD.unlocked_achievements;
    NEW.approval_status         := OLD.approval_status;
    NEW.referral_code           := OLD.referral_code;
    NEW.referred_by             := OLD.referred_by;
    NEW.referral_bonus_awarded  := OLD.referral_bonus_awarded;
    IF NEW.is_banned IS DISTINCT FROM OLD.is_banned THEN
      NEW.is_banned := OLD.is_banned;
    END IF;
    IF NEW.role = 'admin' AND OLD.role <> 'admin' THEN
      NEW.role := OLD.role;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================
-- award_game_reward gains a p_correct param so solo games can feed
-- total_correct_answers/total_games_played. Signature changed, so
-- drop the old 3-arg version first to avoid an ambiguous overload.
-- ============================================================
DROP FUNCTION IF EXISTS public.award_game_reward(INT, INT, TEXT);

CREATE OR REPLACE FUNCTION public.award_game_reward(
  p_xp          INT,
  p_coins       INT,
  p_correct     INT,
  p_description TEXT
) RETURNS TABLE(new_xp INT, new_level INT, new_coins INT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  uid UUID := auth.uid();
  cur_xp    INT;
  cur_level INT;
  cur_coins INT;
  next_xp   INT;
  next_level INT;
  needed INT;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF p_xp IS NULL OR p_xp < 0 OR p_xp > 500 THEN RAISE EXCEPTION 'INVALID_XP'; END IF;
  IF p_coins IS NULL OR p_coins < 0 OR p_coins > 500 THEN RAISE EXCEPTION 'INVALID_COINS'; END IF;
  IF p_correct IS NULL OR p_correct < 0 OR p_correct > 50 THEN RAISE EXCEPTION 'INVALID_CORRECT'; END IF;

  SELECT xp, level, game_coins INTO cur_xp, cur_level, cur_coins
    FROM public.users WHERE id = uid;

  next_xp    := cur_xp + p_xp;
  next_level := cur_level;
  needed     := next_level * 200;
  WHILE next_xp >= needed LOOP
    next_xp    := next_xp - needed;
    next_level := next_level + 1;
    needed     := next_level * 200;
  END LOOP;

  UPDATE public.users
     SET xp = next_xp,
         level = next_level,
         game_coins = game_coins + p_coins,
         total_correct_answers = total_correct_answers + p_correct,
         total_games_played = total_games_played + 1
   WHERE id = uid;

  RETURN QUERY SELECT next_xp, next_level, cur_coins + p_coins;
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_game_reward(INT, INT, INT, TEXT) TO authenticated;

-- ============================================================
-- finalize_match now also bumps total_games_played (+1 each
-- participant) and total_matches_won (+1 for the winner only).
-- Same idempotency guarantee as before.
-- ============================================================
CREATE OR REPLACE FUNCTION public.finalize_match(p_room_id TEXT)
RETURNS TABLE(
  host_rating_change INT, guest_rating_change INT,
  host_new_rating INT, guest_new_rating INT,
  winner_user_id UUID
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  uid UUID := auth.uid();
  r public.game_rooms%ROWTYPE;
  qcount INT;
  h_change INT;
  g_change INT;
  h_new INT;
  g_new INT;
  win_uid UUID;
  h_xp INT; h_coins INT; g_xp INT; g_coins INT;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  SELECT * INTO r FROM public.game_rooms WHERE id = p_room_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ROOM_NOT_FOUND'; END IF;
  IF uid <> r.host_user_id AND uid <> r.guest_user_id THEN
    RAISE EXCEPTION 'NOT_A_PARTICIPANT';
  END IF;

  IF r.status = 'finished' THEN
    SELECT rating INTO h_new FROM public.users WHERE id = r.host_user_id;
    SELECT rating INTO g_new FROM public.users WHERE id = r.guest_user_id;
    RETURN QUERY SELECT r.host_rating_change, r.guest_rating_change, h_new, g_new, r.winner_user_id;
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
    h_xp := 100; h_coins := 20; g_xp := 20; g_coins := 5;
  ELSIF r.guest_score > r.host_score THEN
    h_change := -15; g_change := 25; win_uid := r.guest_user_id;
    h_xp := 20; h_coins := 5; g_xp := 100; g_coins := 20;
  ELSE
    h_change := 0; g_change := 0; win_uid := NULL;
    h_xp := 40; h_coins := 10; g_xp := 40; g_coins := 10;
  END IF;

  UPDATE public.users
     SET rating = GREATEST(0, rating + h_change),
         xp = xp + h_xp,
         game_coins = game_coins + h_coins,
         total_games_played = total_games_played + 1,
         total_matches_won = total_matches_won + CASE WHEN win_uid = r.host_user_id THEN 1 ELSE 0 END
   WHERE id = r.host_user_id
   RETURNING rating INTO h_new;

  UPDATE public.users
     SET rating = GREATEST(0, rating + g_change),
         xp = xp + g_xp,
         game_coins = game_coins + g_coins,
         total_games_played = total_games_played + 1,
         total_matches_won = total_matches_won + CASE WHEN win_uid = r.guest_user_id THEN 1 ELSE 0 END
   WHERE id = r.guest_user_id
   RETURNING rating INTO g_new;

  PERFORM public._sweep_level_ups(r.host_user_id);
  PERFORM public._sweep_level_ups(r.guest_user_id);

  UPDATE public.game_rooms
     SET status = 'finished',
         winner_user_id = win_uid,
         host_rating_change = h_change,
         guest_rating_change = g_change,
         finished_at = NOW(),
         updated_at = NOW()
   WHERE id = p_room_id;

  RETURN QUERY SELECT h_change, g_change, h_new, g_new, win_uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.finalize_match(TEXT) TO authenticated;

-- ============================================================
-- check_achievements() — the achievement catalog. Called by the
-- client after any game/match completes (and harmlessly on the
-- Achievements screen load). Compares current stats against each
-- threshold; for any not yet in unlocked_achievements, awards the
-- XP/coin bonus, adds the id to the array, and returns the list of
-- newly-unlocked ids so the client can show a celebration.
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_achievements()
RETURNS TEXT[] LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  uid UUID := auth.uid();
  u public.users%ROWTYPE;
  newly TEXT[] := '{}';
  cand RECORD;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  SELECT * INTO u FROM public.users WHERE id = uid;

  -- (id, met?, xp_reward, coins_reward)
  FOR cand IN
    SELECT * FROM (VALUES
      ('first_game',       u.total_games_played >= 1,   30,  10),
      ('active_player',    u.total_games_played >= 20,  80,  30),
      ('bible_expert',     u.total_correct_answers >= 100, 150, 60),
      ('level_5',          u.level >= 5,                100, 40),
      ('level_10',         u.level >= 10,               250, 100),
      ('first_win',        u.total_matches_won >= 1,    60,  25),
      ('match_champion',   u.total_matches_won >= 10,   200, 80),
      ('disciple_league',  u.rating >= 500,              120, 50),
      ('master_league',    u.rating >= 2000,             400, 150)
    ) AS t(id, met, xp_reward, coins_reward)
  LOOP
    IF cand.met AND NOT (cand.id = ANY(u.unlocked_achievements)) THEN
      UPDATE public.users
         SET xp = xp + cand.xp_reward,
             game_coins = game_coins + cand.coins_reward,
             unlocked_achievements = array_append(unlocked_achievements, cand.id)
       WHERE id = uid;
      newly := array_append(newly, cand.id);
    END IF;
  END LOOP;

  IF array_length(newly, 1) > 0 THEN
    PERFORM public._sweep_level_ups(uid);
  END IF;

  RETURN newly;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_achievements() TO authenticated;
