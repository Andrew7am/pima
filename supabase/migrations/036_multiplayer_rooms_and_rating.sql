-- ============================================================
-- Entertainment phase 3: online 1v1 matches — private rooms and
-- ranked random matchmaking — with a per-user rating.
--
-- Rating math (matches the earlier prototype and stays simple to
-- explain in Arabic UI): win = +25, loss = -15, draw = 0. Everyone
-- starts at 100. Leagues (client-side): 0-199 مبتدئ, 200-499 دارس,
-- 500-999 تلميذ, 1000-1999 معلم, 2000+ حكيم.
--
-- Security model — same trusted-server pattern used elsewhere in
-- this project. The client never writes to game_rooms directly:
-- every state change (create / join / answer / finalize) goes
-- through a SECURITY DEFINER RPC that reads auth.uid() and
-- enforces the rules server-side. The user's rating is added to
-- the protected columns list on public.users so it can't be self-
-- awarded from the browser.
--
-- Real-time: the client subscribes to a single row via
-- supabase.channel('game_rooms:id=eq.xxx') to watch the opponent's
-- moves. RLS lets the two participants (host + guest) and admins
-- SELECT the row; no one else, so the subscription is scoped
-- correctly out of the box.
-- ============================================================

-- 1) rating column + protect it
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS rating INTEGER NOT NULL DEFAULT 100;

CREATE OR REPLACE FUNCTION public.protect_user_privileged_columns()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF current_user = 'authenticated' AND NOT public.is_admin(auth.uid()) THEN
    NEW.points                  := OLD.points;
    NEW.xp                      := OLD.xp;
    NEW.level                   := OLD.level;
    NEW.game_coins              := OLD.game_coins;
    NEW.rating                  := OLD.rating;
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

-- 2) game_rooms table
CREATE TABLE IF NOT EXISTS public.game_rooms (
  id                TEXT PRIMARY KEY,                 -- 'rm_<uuid>' for randoms, 6-char code for privates
  is_private        BOOLEAN NOT NULL DEFAULT FALSE,
  game_mode         TEXT NOT NULL CHECK (game_mode IN ('trivia', 'hymns', 'fillverse', 'whoami')),
  host_user_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  host_name         TEXT NOT NULL,
  host_rating       INTEGER NOT NULL,
  guest_user_id     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  guest_name        TEXT,
  guest_rating      INTEGER,
  status            TEXT NOT NULL DEFAULT 'waiting'
                     CHECK (status IN ('waiting', 'active', 'finished', 'cancelled')),
  questions         JSONB NOT NULL DEFAULT '[]'::jsonb,
  host_score        INTEGER NOT NULL DEFAULT 0,
  guest_score       INTEGER NOT NULL DEFAULT 0,
  host_answers      JSONB NOT NULL DEFAULT '{}'::jsonb,     -- {"0": 2, "1": 1, ...}
  guest_answers     JSONB NOT NULL DEFAULT '{}'::jsonb,
  current_question  INTEGER NOT NULL DEFAULT 0,
  winner_user_id    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  host_rating_change INTEGER,
  guest_rating_change INTEGER,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_game_rooms_status ON public.game_rooms(status, is_private, game_mode);
CREATE INDEX IF NOT EXISTS idx_game_rooms_host ON public.game_rooms(host_user_id);
CREATE INDEX IF NOT EXISTS idx_game_rooms_guest ON public.game_rooms(guest_user_id);

ALTER TABLE public.game_rooms ENABLE ROW LEVEL SECURITY;

-- Realtime broadcast: subscribers see UPDATE events on rows they can SELECT
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_rooms;

-- Only participants (host or guest) or an admin can SELECT the row
DROP POLICY IF EXISTS "game_rooms_select_participant" ON public.game_rooms;
CREATE POLICY "game_rooms_select_participant" ON public.game_rooms FOR SELECT USING (
  auth.uid() = host_user_id OR auth.uid() = guest_user_id OR public.is_admin(auth.uid())
);

-- No INSERT/UPDATE/DELETE policies at all — the RPCs below (SECURITY
-- DEFINER, run as postgres) bypass RLS, so nothing else can touch the
-- rows. That's the whole security model.

-- ============================================================
-- 3) RPC: create_private_room
-- Generates a 6-char code, seeds the questions payload the client
-- passes in (later — for MVP the client supplies its own question
-- pool sample), returns the code.
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_private_room(
  p_game_mode TEXT,
  p_questions JSONB
) RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  uid   UUID := auth.uid();
  uname TEXT;
  urat  INTEGER;
  code  TEXT;
  tries INT := 0;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF p_game_mode NOT IN ('trivia', 'hymns', 'fillverse', 'whoami') THEN
    RAISE EXCEPTION 'INVALID_MODE';
  END IF;
  IF p_questions IS NULL OR jsonb_array_length(p_questions) < 3 THEN
    RAISE EXCEPTION 'INVALID_QUESTIONS';
  END IF;

  SELECT name, rating INTO uname, urat FROM public.users WHERE id = uid;

  -- Retry up to a few times on the unthinkable case of a 6-char collision
  LOOP
    code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    BEGIN
      INSERT INTO public.game_rooms (
        id, is_private, game_mode, host_user_id, host_name, host_rating, questions
      ) VALUES (
        code, TRUE, p_game_mode, uid, uname, urat, p_questions
      );
      RETURN code;
    EXCEPTION WHEN unique_violation THEN
      tries := tries + 1;
      IF tries > 5 THEN RAISE; END IF;
    END;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_private_room(TEXT, JSONB) TO authenticated;

-- ============================================================
-- 4) RPC: find_or_create_random_room
-- If a waiting random room in the same mode with a rating within
-- ±band exists (widened to ±500 to keep MVP simple; a real matcher
-- would expand it over time), join it. Otherwise create a fresh
-- random room and wait.
-- Returns (room_id, was_created).
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

  -- Try to find an existing waiting room by another player, closest rating first
  SELECT id INTO found_id FROM public.game_rooms
   WHERE status = 'waiting'
     AND is_private = FALSE
     AND game_mode = p_game_mode
     AND host_user_id <> uid
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

  -- Otherwise create a new waiting room and hand back its id
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

-- ============================================================
-- 5) RPC: join_room_by_code (private rooms only)
-- ============================================================
CREATE OR REPLACE FUNCTION public.join_room_by_code(p_code TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  uid   UUID := auth.uid();
  uname TEXT;
  urat  INTEGER;
  target public.game_rooms%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF p_code IS NULL OR length(p_code) <> 6 THEN RAISE EXCEPTION 'INVALID_CODE'; END IF;

  SELECT * INTO target FROM public.game_rooms WHERE id = upper(p_code);
  IF NOT FOUND THEN RAISE EXCEPTION 'ROOM_NOT_FOUND'; END IF;
  IF target.status <> 'waiting' THEN RAISE EXCEPTION 'ROOM_UNAVAILABLE'; END IF;
  IF target.host_user_id = uid THEN RAISE EXCEPTION 'CANNOT_JOIN_OWN_ROOM'; END IF;
  IF target.guest_user_id IS NOT NULL THEN RAISE EXCEPTION 'ROOM_FULL'; END IF;

  SELECT name, rating INTO uname, urat FROM public.users WHERE id = uid;
  UPDATE public.game_rooms
     SET guest_user_id = uid,
         guest_name = uname,
         guest_rating = urat,
         status = 'active',
         updated_at = NOW()
   WHERE id = target.id;

  RETURN target.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_room_by_code(TEXT) TO authenticated;

-- ============================================================
-- 6) RPC: submit_answer
-- The caller records their answer for a question index; the RPC
-- checks against the stored `questions` (which include correctIdx)
-- and increments their score if right. Prevents replay (can't
-- change an already-submitted answer).
-- ============================================================
CREATE OR REPLACE FUNCTION public.submit_answer(
  p_room_id TEXT,
  p_q_idx   INT,
  p_opt_idx INT
) RETURNS TABLE(host_score INT, guest_score INT, both_answered BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  uid UUID := auth.uid();
  r public.game_rooms%ROWTYPE;
  correct_idx INT;
  is_host BOOLEAN;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  SELECT * INTO r FROM public.game_rooms WHERE id = p_room_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ROOM_NOT_FOUND'; END IF;
  IF r.status <> 'active' THEN RAISE EXCEPTION 'ROOM_NOT_ACTIVE'; END IF;
  IF uid <> r.host_user_id AND uid <> r.guest_user_id THEN
    RAISE EXCEPTION 'NOT_A_PARTICIPANT';
  END IF;
  IF p_q_idx < 0 OR p_q_idx >= jsonb_array_length(r.questions) THEN
    RAISE EXCEPTION 'INVALID_QUESTION_INDEX';
  END IF;

  is_host := uid = r.host_user_id;

  -- No overwriting an already-submitted answer
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

  -- Advance current_question when both have answered this one
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

-- Helpers that finalize_match uses — defined FIRST so plpgsql can
-- resolve them at CREATE-time.
CREATE OR REPLACE FUNCTION public.jsonb_object_keys_count(j JSONB)
RETURNS INT LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE((SELECT COUNT(*)::INT FROM jsonb_object_keys(j)), 0);
$$;

CREATE OR REPLACE FUNCTION public._sweep_level_ups(target_uid UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  cur_xp INT;
  cur_level INT;
  needed INT;
BEGIN
  SELECT xp, level INTO cur_xp, cur_level FROM public.users WHERE id = target_uid;
  needed := cur_level * 200;
  WHILE cur_xp >= needed LOOP
    cur_xp := cur_xp - needed;
    cur_level := cur_level + 1;
    needed := cur_level * 200;
  END LOOP;
  UPDATE public.users SET xp = cur_xp, level = cur_level WHERE id = target_uid;
END;
$$;

-- ============================================================
-- 7) RPC: finalize_match
-- Called by either participant once all questions are answered.
-- Computes rating changes (+25 / -15 / 0), awards XP+coins to
-- both players, marks the room finished. Idempotent: if already
-- finished, returns the existing outcome without re-awarding.
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

  -- Idempotent
  IF r.status = 'finished' THEN
    SELECT rating INTO h_new FROM public.users WHERE id = r.host_user_id;
    SELECT rating INTO g_new FROM public.users WHERE id = r.guest_user_id;
    RETURN QUERY SELECT r.host_rating_change, r.guest_rating_change, h_new, g_new, r.winner_user_id;
    RETURN;
  END IF;

  IF r.status <> 'active' THEN RAISE EXCEPTION 'ROOM_NOT_ACTIVE'; END IF;

  qcount := jsonb_array_length(r.questions);
  IF jsonb_object_keys_count(r.host_answers) < qcount
     OR jsonb_object_keys_count(r.guest_answers) < qcount THEN
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
         game_coins = game_coins + h_coins
   WHERE id = r.host_user_id
   RETURNING rating INTO h_new;

  UPDATE public.users
     SET rating = GREATEST(0, rating + g_change),
         xp = xp + g_xp,
         game_coins = game_coins + g_coins
   WHERE id = r.guest_user_id
   RETURNING rating INTO g_new;

  -- Very simple level-up sweep (matches award_game_reward)
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
