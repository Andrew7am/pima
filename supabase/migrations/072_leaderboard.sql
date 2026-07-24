-- ============================================================
-- Entertainment leaderboard. Regular users can't read other users' rows under
-- RLS, so the "top players" board needs SECURITY DEFINER RPCs that expose only
-- safe public fields (FIRST name + avatar + xp score). Ranked by entertainment
-- XP. Callable by logged-in users only.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_leaderboard(p_limit INT DEFAULT 10)
RETURNS TABLE(id UUID, name TEXT, avatar_url TEXT, points INT)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT u.id, split_part(u.name, ' ', 1) AS name, u.avatar_url, COALESCE(u.xp, 0)::int AS points
  FROM public.users u
  WHERE COALESCE(u.xp, 0) > 0 AND COALESCE(u.is_banned, false) = false
  ORDER BY u.xp DESC NULLS LAST
  LIMIT GREATEST(1, LEAST(p_limit, 100));
$$;

GRANT EXECUTE ON FUNCTION public.get_leaderboard(INT) TO authenticated;

-- The caller's own rank + the total active-player count.
CREATE OR REPLACE FUNCTION public.get_my_rank()
RETURNS TABLE(total_players INT, my_rank INT)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    (SELECT COUNT(*)::int FROM public.users WHERE COALESCE(xp, 0) > 0),
    (SELECT COUNT(*)::int + 1 FROM public.users
      WHERE COALESCE(xp, 0) > COALESCE((SELECT xp FROM public.users WHERE id = auth.uid()), 0));
$$;

GRANT EXECUTE ON FUNCTION public.get_my_rank() TO authenticated;
