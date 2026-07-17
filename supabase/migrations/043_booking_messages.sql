-- ============================================================
-- Booking-scoped owner<->guest chat. Neither existing chat table fits:
-- direct_messages (038) requires an accepted friend_requests row and
-- owners are excluded from search_users/send_friend_request entirely;
-- game_room_messages (040) is scoped to game_rooms. This one is scoped
-- to a single bookings row, participants are exactly that booking's
-- guest (bookings.user_id) and that booking's house owner
-- (houses.owner_id via bookings.house_id), plus admin.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.booking_messages (
  id          BIGSERIAL PRIMARY KEY,
  booking_id  TEXT NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  sender_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  content     TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_booking_messages_booking ON public.booking_messages(booking_id, created_at);

ALTER TABLE public.booking_messages ENABLE ROW LEVEL SECURITY;

-- Realtime broadcast: subscribers see INSERT events on rows they can SELECT
ALTER PUBLICATION supabase_realtime ADD TABLE public.booking_messages;

DROP POLICY IF EXISTS "booking_messages_select_participant" ON public.booking_messages;
CREATE POLICY "booking_messages_select_participant" ON public.booking_messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.bookings b
    JOIN public.houses h ON h.id = b.house_id
     WHERE b.id = booking_id
       AND (auth.uid() = b.user_id OR auth.uid() = h.owner_id OR public.is_admin(auth.uid()))
  )
);

-- No client INSERT/UPDATE/DELETE policy — every write goes through
-- send_booking_message / mark_booking_messages_read below.

-- ============================================================
-- send_booking_message — only the booking's guest or that booking's
-- house owner may post (or admin). Denormalizes sender_name so the
-- client never needs a wider SELECT on public.users.
-- ============================================================
CREATE OR REPLACE FUNCTION public.send_booking_message(p_booking_id TEXT, p_content TEXT)
RETURNS public.booking_messages
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  uid UUID := auth.uid();
  my_name TEXT;
  is_participant BOOLEAN;
  result public.booking_messages%ROWTYPE;
  trimmed TEXT := trim(p_content);
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF trimmed IS NULL OR length(trimmed) < 1 OR length(trimmed) > 2000 THEN RAISE EXCEPTION 'INVALID_CONTENT'; END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.bookings b
    JOIN public.houses h ON h.id = b.house_id
     WHERE b.id = p_booking_id
       AND (b.user_id = uid OR h.owner_id = uid)
  ) INTO is_participant;
  IF NOT is_participant AND NOT public.is_admin(uid) THEN RAISE EXCEPTION 'NOT_A_PARTICIPANT'; END IF;

  SELECT name INTO my_name FROM public.users WHERE id = uid;

  INSERT INTO public.booking_messages (booking_id, sender_id, sender_name, content)
    VALUES (p_booking_id, uid, my_name, trimmed)
    RETURNING * INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_booking_message(TEXT, TEXT) TO authenticated;

-- ============================================================
-- mark_booking_messages_read — marks all incoming (not-mine) messages
-- on a booking thread as read, called when either side opens it.
-- ============================================================
CREATE OR REPLACE FUNCTION public.mark_booking_messages_read(p_booking_id TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  UPDATE public.booking_messages
     SET read_at = NOW()
   WHERE booking_id = p_booking_id AND sender_id <> uid AND read_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_booking_messages_read(TEXT) TO authenticated;
