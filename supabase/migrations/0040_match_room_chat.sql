-- ============================================================
-- In-match chat, scoped to a single game_rooms row — not the same
-- thing as the friends-only direct_messages (038). Two 1v1 opponents
-- (especially matched via find_or_create_random_room) are frequently
-- strangers, not friends, so direct_messages/send_message (which
-- hard-requires an accepted friend_requests row) can't be pointed at
-- them. Same trust model as everywhere else: no client
-- INSERT/UPDATE/DELETE policy, every write goes through the
-- SECURITY DEFINER RPC below.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.game_room_messages (
  id          BIGSERIAL PRIMARY KEY,
  room_id     TEXT NOT NULL REFERENCES public.game_rooms(id) ON DELETE CASCADE,
  sender_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  content     TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_game_room_messages_room ON public.game_room_messages(room_id, created_at);

ALTER TABLE public.game_room_messages ENABLE ROW LEVEL SECURITY;

-- Realtime broadcast: subscribers see INSERT events on rows they can SELECT
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_room_messages;

DROP POLICY IF EXISTS "game_room_messages_select_participant" ON public.game_room_messages;
CREATE POLICY "game_room_messages_select_participant" ON public.game_room_messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.game_rooms gr
     WHERE gr.id = room_id
       AND (auth.uid() = gr.host_user_id OR auth.uid() = gr.guest_user_id OR public.is_admin(auth.uid()))
  )
);

-- ============================================================
-- send_room_message — only a participant (host or guest) of the room
-- may post. No status restriction: lets the host greet an arriving
-- guest, or both banter after the match finishes.
-- ============================================================
CREATE OR REPLACE FUNCTION public.send_room_message(p_room_id TEXT, p_content TEXT)
RETURNS public.game_room_messages
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  uid UUID := auth.uid();
  my_name TEXT;
  is_participant BOOLEAN;
  result public.game_room_messages%ROWTYPE;
  trimmed TEXT := trim(p_content);
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF trimmed IS NULL OR length(trimmed) < 1 OR length(trimmed) > 500 THEN RAISE EXCEPTION 'INVALID_CONTENT'; END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.game_rooms
     WHERE id = p_room_id AND (host_user_id = uid OR guest_user_id = uid)
  ) INTO is_participant;
  IF NOT is_participant THEN RAISE EXCEPTION 'NOT_A_PARTICIPANT'; END IF;

  SELECT name INTO my_name FROM public.users WHERE id = uid;

  INSERT INTO public.game_room_messages (room_id, sender_id, sender_name, content)
    VALUES (p_room_id, uid, my_name, trimmed)
    RETURNING * INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_room_message(TEXT, TEXT) TO authenticated;
