-- ============================================================
-- 101: a player who is still waiting is not a stale room
--
-- 099 added a sweep so abandoned rooms stop being handed to the next
-- searcher. It keys on updated_at — but nothing bumps updated_at
-- while a room WAITS. Every bump in 036 happens on join, on answer,
-- or on finalize.
--
-- So a host who waits longer than the cutoff has their own room
-- cancelled out from under them by the next person to search, and
-- that person then finds nothing and opens a room of their own. Two
-- people both searching, in a two-person queue, who can never meet.
-- Exactly the failure this was meant to prevent, caused by the fix
-- for it.
--
-- The missing piece is a signal that someone is still there.
-- touch_waiting_room is that signal: the waiting screen calls it on a
-- timer, so updated_at means "last seen" rather than "created", which
-- is what the sweep and the freshness filter both already assume.
-- ============================================================

CREATE OR REPLACE FUNCTION public.touch_waiting_room(p_room_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  uid UUID := auth.uid();
  updated INT;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;

  -- Host only, and only while still waiting. Once a guest has joined the
  -- room is alive by definition and answers keep updated_at moving; letting
  -- a heartbeat touch an active room would also push back the abandonment
  -- cutoff and make claim_abandoned_match unreachable.
  UPDATE public.game_rooms
     SET updated_at = NOW()
   WHERE id = p_room_id
     AND host_user_id = uid
     AND status = 'waiting';

  GET DIAGNOSTICS updated = ROW_COUNT;
  RETURN updated > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.touch_waiting_room(TEXT) TO authenticated;
