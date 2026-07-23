-- ============================================================
-- Voice messages: allow an 'audio' attachment type (recorded in the
-- browser, stored as a data URL like the other attachments). Only the
-- attachment_type whitelist and the sender RPC's validation change.
-- ============================================================

ALTER TABLE public.booking_messages DROP CONSTRAINT IF EXISTS booking_messages_attachment_type_check;
ALTER TABLE public.booking_messages ADD CONSTRAINT booking_messages_attachment_type_check
  CHECK (attachment_type IS NULL OR attachment_type IN ('image', 'file', 'audio'));

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
  IF p_attachment_url IS NOT NULL AND p_attachment_type NOT IN ('image', 'file', 'audio') THEN RAISE EXCEPTION 'INVALID_ATTACHMENT'; END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.bookings b
    JOIN public.houses h ON h.id = b.house_id
     WHERE b.id = p_booking_id
       AND (b.user_id = uid OR h.owner_id = uid)
  ) INTO is_participant;
  IF NOT is_participant AND NOT public.is_admin(uid) THEN RAISE EXCEPTION 'NOT_A_PARTICIPANT'; END IF;

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
