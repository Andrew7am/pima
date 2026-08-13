-- 078_public_avatars.sql
-- Profile pictures need to show for OTHER users across the app (entertainment
-- friends list, 1:1 chat header, booking chat parties). RLS restricts a regular
-- user to reading only their own public.users row, so a small SECURITY DEFINER
-- lookup is the safe way to resolve avatars for a known set of user ids.
-- Only the avatar image + display name are exposed (both already public via
-- reviews / conversations), and banned accounts are excluded.

CREATE OR REPLACE FUNCTION public.get_public_avatars(p_ids UUID[])
RETURNS TABLE(id UUID, name TEXT, avatar_url TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL THEN RETURN; END IF;

  RETURN QUERY
    SELECT u.id, u.name, u.avatar_url
    FROM public.users u
    WHERE u.id = ANY(p_ids)
      AND u.is_banned = FALSE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_avatars(UUID[]) TO authenticated;
