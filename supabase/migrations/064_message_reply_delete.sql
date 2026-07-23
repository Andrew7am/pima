-- ============================================================
-- Reply-to and delete for booking chat messages.
--   * reply_to_id: optional pointer to the quoted message.
--   * deleted_at : soft-delete marker. The sender (or admin) may delete
--     their own message; the row stays so both sides see "message deleted"
--     live (the UPDATE broadcasts on the same realtime publication), but
--     its text/attachment are wiped.
-- ============================================================

ALTER TABLE public.booking_messages
  ADD COLUMN IF NOT EXISTS reply_to_id BIGINT REFERENCES public.booking_messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMPTZ;

-- Widen the sender RPC to carry an optional reply target.
DROP FUNCTION IF EXISTS public.send_booking_message(TEXT, TEXT, TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.send_booking_message(
  p_booking_id       TEXT,
  p_content          TEXT,
  p_attachment_url   TEXT DEFAULT NULL,
  p_attachment_type  TEXT DEFAULT NULL,
  p_attachment_name  TEXT DEFAULT NULL,
  p_reply_to         BIGINT DEFAULT NULL
)
RETURNS public.booking_messages
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  uid UUID := auth.uid();
  my_name TEXT;
  is_participant BOOLEAN;
  result public.booking_messages%ROWTYPE;
  trimmed TEXT := coalesce(trim(p_content), '');
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF length(trimmed) = 0 AND p_attachment_url IS NULL THEN RAISE EXCEPTION 'EMPTY_MESSAGE'; END IF;
  IF length(trimmed) > 2000 THEN RAISE EXCEPTION 'INVALID_CONTENT'; END IF;
  IF p_attachment_url IS NOT NULL AND p_attachment_type NOT IN ('image', 'file') THEN RAISE EXCEPTION 'INVALID_ATTACHMENT'; END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.bookings b
    JOIN public.houses h ON h.id = b.house_id
     WHERE b.id = p_booking_id
       AND (b.user_id = uid OR h.owner_id = uid)
  ) INTO is_participant;
  IF NOT is_participant AND NOT public.is_admin(uid) THEN RAISE EXCEPTION 'NOT_A_PARTICIPANT'; END IF;

  -- A reply target must belong to the same thread.
  IF p_reply_to IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.booking_messages WHERE id = p_reply_to AND booking_id = p_booking_id
  ) THEN p_reply_to := NULL; END IF;

  SELECT name INTO my_name FROM public.users WHERE id = uid;

  INSERT INTO public.booking_messages (booking_id, sender_id, sender_name, content, attachment_url, attachment_type, attachment_name, reply_to_id)
    VALUES (p_booking_id, uid, my_name, trimmed, p_attachment_url, p_attachment_type, p_attachment_name, p_reply_to)
    RETURNING * INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_booking_message(TEXT, TEXT, TEXT, TEXT, TEXT, BIGINT) TO authenticated;

-- Soft-delete: only the message's own sender (or admin) may delete it.
CREATE OR REPLACE FUNCTION public.delete_booking_message(p_id BIGINT)
RETURNS public.booking_messages
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  uid UUID := auth.uid();
  result public.booking_messages%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  UPDATE public.booking_messages
     SET deleted_at = NOW(), content = '', attachment_url = NULL, attachment_type = NULL, attachment_name = NULL
   WHERE id = p_id AND deleted_at IS NULL AND (sender_id = uid OR public.is_admin(uid))
   RETURNING * INTO result;
  IF result.id IS NULL THEN RAISE EXCEPTION 'NOT_ALLOWED'; END IF;
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_booking_message(BIGINT) TO authenticated;
