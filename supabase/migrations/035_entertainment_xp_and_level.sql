-- ============================================================
-- Entertainment module (phase 1): XP + Level + a SEPARATE game
-- currency on public.users.
--
-- Adds:
--   xp INTEGER          — running experience for the current level.
--   level INTEGER       — starts at 1. Threshold N -> N+1 costs N * 200 XP.
--   game_coins INTEGER  — earned from gameplay. Deliberately SEPARATE
--                         from `points` (which is the loyalty currency
--                         earned from paying for bookings and redeemable
--                         at 100 points = 1 EGP off a booking). Game
--                         coins will only spend on entertainment-only
--                         perks (frames, boosts, etc.), never on
--                         booking discounts — so grinding solo trivia
--                         can't turn into free stays.
--
-- All three are added to the migration-017 privileged-column guard so
-- the client can't self-award them from the browser console; the only
-- supported write path is the new award_game_reward() SECURITY DEFINER
-- RPC below.
-- ============================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS xp         INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS level      INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS game_coins INTEGER NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.protect_user_privileged_columns()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF current_user = 'authenticated' AND NOT public.is_admin(auth.uid()) THEN
    NEW.points                  := OLD.points;
    NEW.xp                      := OLD.xp;
    NEW.level                   := OLD.level;
    NEW.game_coins              := OLD.game_coins;
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
-- Award game rewards (XP + game_coins) atomically, computing level-up
-- server-side so the client can't lie about it. Returns the new
-- (xp, level, game_coins) triple so the caller can update its cached
-- copy without an extra round-trip.
--
-- Cap per call so a compromised client can't request 999,999 at once.
-- ============================================================
CREATE OR REPLACE FUNCTION public.award_game_reward(
  p_xp          INT,
  p_coins       INT,
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
         game_coins = game_coins + p_coins
   WHERE id = uid;

  RETURN QUERY SELECT next_xp, next_level, cur_coins + p_coins;
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_game_reward(INT, INT, TEXT) TO authenticated;
