-- ============================================================
-- Entertainment phase 4: friends + 1:1 chat.
--
-- Same trust model as the rest of this module: users_select_own (001)
-- only lets a client SELECT their own row, so there is no way to look
-- up another user's name/id from the browser. Every RPC below that
-- needs another user's display name reads it server-side (SECURITY
-- DEFINER bypasses RLS) and denormalizes it onto the row being
-- written — the same trick game_rooms already uses for host_name/
-- guest_name (036) — so the client never needs a wider SELECT policy
-- on public.users to render a friends list or a chat thread.
--
-- No client INSERT/UPDATE/DELETE policies on either table below —
-- every write (send a request, respond to one, send a message, mark
-- read) goes through a SECURITY DEFINER RPC that enforces the rules
-- (can't friend yourself, must be friends to message, etc.) the same
-- way award_game_reward/finalize_match/check_achievements do.
-- ============================================================

-- ============================================================
-- 1) friend_requests
-- ============================================================
CREATE TABLE IF NOT EXISTS public.friend_requests (
  id             BIGSERIAL PRIMARY KEY,
  requester_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  requester_name TEXT NOT NULL,
  addressee_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  addressee_name TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at   TIMESTAMPTZ,
  CONSTRAINT no_self_friend_request CHECK (requester_id <> addressee_id),
  CONSTRAINT one_request_per_pair UNIQUE (requester_id, addressee_id)
);

CREATE INDEX IF NOT EXISTS idx_friend_requests_addressee ON public.friend_requests(addressee_id, status);
CREATE INDEX IF NOT EXISTS idx_friend_requests_requester ON public.friend_requests(requester_id, status);

ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "friend_requests_select_participant" ON public.friend_requests;
CREATE POLICY "friend_requests_select_participant" ON public.friend_requests FOR SELECT USING (
  auth.uid() = requester_id OR auth.uid() = addressee_id OR public.is_admin(auth.uid())
);

-- ============================================================
-- 2) direct_messages
-- ============================================================
CREATE TABLE IF NOT EXISTS public.direct_messages (
  id            BIGSERIAL PRIMARY KEY,
  sender_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  sender_name   TEXT NOT NULL,
  receiver_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  receiver_name TEXT NOT NULL,
  content       TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at       TIMESTAMPTZ,
  CONSTRAINT no_self_message CHECK (sender_id <> receiver_id)
);

CREATE INDEX IF NOT EXISTS idx_direct_messages_conversation_a ON public.direct_messages(sender_id, receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_direct_messages_conversation_b ON public.direct_messages(receiver_id, sender_id, created_at DESC);

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- Realtime broadcast: subscribers see INSERT events on rows they can SELECT
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;

DROP POLICY IF EXISTS "direct_messages_select_participant" ON public.direct_messages;
CREATE POLICY "direct_messages_select_participant" ON public.direct_messages FOR SELECT USING (
  auth.uid() = sender_id OR auth.uid() = receiver_id OR public.is_admin(auth.uid())
);

-- ============================================================
-- 3) search_users — narrow lookup for "add a friend". Only id+name,
-- only regular app users (not owners/admins), excludes self and
-- banned accounts, requires >=2 chars to avoid a full table scan on
-- an empty/near-empty query.
-- ============================================================
CREATE OR REPLACE FUNCTION public.search_users(p_query TEXT)
RETURNS TABLE(id UUID, name TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF p_query IS NULL OR length(trim(p_query)) < 2 THEN RETURN; END IF;

  RETURN QUERY
    SELECT u.id, u.name
    FROM public.users u
    WHERE u.id <> uid
      AND u.role IN ('individual', 'servant')
      AND u.is_banned = FALSE
      AND u.name ILIKE '%' || trim(p_query) || '%'
    ORDER BY u.name
    LIMIT 20;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_users(TEXT) TO authenticated;

-- ============================================================
-- 4) send_friend_request — creates a pending request. If the other
-- user already sent one to us, auto-accepts instead of creating a
-- duplicate (mutual "add friend" both ways just becomes an instant
-- friendship, matching how most apps behave). Re-sending after a
-- decline reopens the same row as pending rather than erroring.
-- ============================================================
CREATE OR REPLACE FUNCTION public.send_friend_request(p_addressee_id UUID)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  uid UUID := auth.uid();
  my_name TEXT;
  their_name TEXT;
  their_role TEXT;
  their_banned BOOLEAN;
  existing public.friend_requests%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF p_addressee_id IS NULL OR p_addressee_id = uid THEN RAISE EXCEPTION 'CANNOT_FRIEND_SELF'; END IF;

  SELECT name INTO my_name FROM public.users WHERE id = uid;
  SELECT name, role, is_banned INTO their_name, their_role, their_banned
    FROM public.users WHERE id = p_addressee_id;
  IF their_name IS NULL THEN RAISE EXCEPTION 'USER_NOT_FOUND'; END IF;
  IF their_role NOT IN ('individual', 'servant') OR their_banned THEN RAISE EXCEPTION 'USER_NOT_FOUND'; END IF;

  SELECT * INTO existing FROM public.friend_requests
    WHERE (requester_id = uid AND addressee_id = p_addressee_id)
       OR (requester_id = p_addressee_id AND addressee_id = uid);

  IF FOUND THEN
    IF existing.status = 'accepted' THEN
      RAISE EXCEPTION 'ALREADY_FRIENDS';
    ELSIF existing.status = 'pending' AND existing.requester_id = uid THEN
      RAISE EXCEPTION 'REQUEST_ALREADY_SENT';
    ELSIF existing.status = 'pending' AND existing.requester_id = p_addressee_id THEN
      UPDATE public.friend_requests SET status = 'accepted', responded_at = NOW() WHERE id = existing.id;
      RETURN 'accepted';
    ELSE -- declined — reopen as a fresh request from this caller
      UPDATE public.friend_requests
         SET requester_id = uid, requester_name = my_name,
             addressee_id = p_addressee_id, addressee_name = their_name,
             status = 'pending', created_at = NOW(), responded_at = NULL
       WHERE id = existing.id;
      RETURN 'pending';
    END IF;
  END IF;

  INSERT INTO public.friend_requests (requester_id, requester_name, addressee_id, addressee_name)
    VALUES (uid, my_name, p_addressee_id, their_name);
  RETURN 'pending';
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_friend_request(UUID) TO authenticated;

-- ============================================================
-- 5) respond_friend_request — only the addressee may accept/decline
-- their own pending request.
-- ============================================================
CREATE OR REPLACE FUNCTION public.respond_friend_request(p_request_id BIGINT, p_accept BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  uid UUID := auth.uid();
  req public.friend_requests%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  SELECT * INTO req FROM public.friend_requests WHERE id = p_request_id;
  IF NOT FOUND OR req.addressee_id <> uid OR req.status <> 'pending' THEN
    RAISE EXCEPTION 'INVALID_REQUEST';
  END IF;

  UPDATE public.friend_requests
     SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END,
         responded_at = NOW()
   WHERE id = p_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.respond_friend_request(BIGINT, BOOLEAN) TO authenticated;

-- ============================================================
-- 6) cancel_friend_request — the requester withdraws their own
-- still-pending outgoing request.
-- ============================================================
CREATE OR REPLACE FUNCTION public.cancel_friend_request(p_request_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  DELETE FROM public.friend_requests
   WHERE id = p_request_id AND requester_id = uid AND status = 'pending';
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_friend_request(BIGINT) TO authenticated;

-- ============================================================
-- 7) remove_friend — unfriend; deletes the accepted request row
-- between the two users in either direction.
-- ============================================================
CREATE OR REPLACE FUNCTION public.remove_friend(p_other_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  DELETE FROM public.friend_requests
   WHERE status = 'accepted'
     AND ((requester_id = uid AND addressee_id = p_other_user_id)
       OR (requester_id = p_other_user_id AND addressee_id = uid));
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_friend(UUID) TO authenticated;

-- ============================================================
-- 8) send_message — only between accepted friends. Denormalizes
-- both display names onto the row so the client never needs to read
-- public.users for either party.
-- ============================================================
CREATE OR REPLACE FUNCTION public.send_message(p_receiver_id UUID, p_content TEXT)
RETURNS public.direct_messages
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  uid UUID := auth.uid();
  my_name TEXT;
  their_name TEXT;
  are_friends BOOLEAN;
  result public.direct_messages%ROWTYPE;
  trimmed TEXT := trim(p_content);
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF p_receiver_id IS NULL OR p_receiver_id = uid THEN RAISE EXCEPTION 'INVALID_RECEIVER'; END IF;
  IF trimmed IS NULL OR length(trimmed) < 1 OR length(trimmed) > 2000 THEN RAISE EXCEPTION 'INVALID_CONTENT'; END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.friend_requests
     WHERE status = 'accepted'
       AND ((requester_id = uid AND addressee_id = p_receiver_id)
         OR (requester_id = p_receiver_id AND addressee_id = uid))
  ) INTO are_friends;
  IF NOT are_friends THEN RAISE EXCEPTION 'NOT_FRIENDS'; END IF;

  SELECT name INTO my_name FROM public.users WHERE id = uid;
  SELECT name INTO their_name FROM public.users WHERE id = p_receiver_id;

  INSERT INTO public.direct_messages (sender_id, sender_name, receiver_id, receiver_name, content)
    VALUES (uid, my_name, p_receiver_id, their_name, trimmed)
    RETURNING * INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_message(UUID, TEXT) TO authenticated;

-- ============================================================
-- 9) mark_messages_read — bulk-marks one conversation's incoming
-- messages as read (called when the thread screen opens).
-- ============================================================
CREATE OR REPLACE FUNCTION public.mark_messages_read(p_other_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  UPDATE public.direct_messages
     SET read_at = NOW()
   WHERE receiver_id = uid AND sender_id = p_other_user_id AND read_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_messages_read(UUID) TO authenticated;

-- ============================================================
-- 10) get_conversations — one row per friend you've exchanged
-- messages with, latest message + unread count, for a chat list
-- screen. Friends with no messages yet don't appear here — the
-- friends list screen handles those.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_conversations()
RETURNS TABLE(
  other_user_id UUID, other_user_name TEXT,
  last_message TEXT, last_message_at TIMESTAMPTZ, unread_count INT
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;

  RETURN QUERY
  WITH my_msgs AS (
    SELECT
      CASE WHEN sender_id = uid THEN receiver_id ELSE sender_id END AS oid,
      CASE WHEN sender_id = uid THEN receiver_name ELSE sender_name END AS oname,
      content, created_at,
      (receiver_id = uid AND read_at IS NULL) AS is_unread
    FROM public.direct_messages
    WHERE sender_id = uid OR receiver_id = uid
  ),
  latest AS (
    SELECT DISTINCT ON (oid) oid, oname, content, created_at
    FROM my_msgs
    ORDER BY oid, created_at DESC
  ),
  unread_counts AS (
    SELECT oid, COUNT(*) AS cnt FROM my_msgs WHERE is_unread GROUP BY oid
  )
  SELECT l.oid, l.oname, l.content, l.created_at, COALESCE(u.cnt, 0)::INT
  FROM latest l
  LEFT JOIN unread_counts u ON u.oid = l.oid
  ORDER BY l.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_conversations() TO authenticated;
