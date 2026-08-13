-- ============================================================
-- Image / file attachments for the booking chat. Adds attachment
-- columns to booking_messages and widens send_booking_message to accept
-- an optional attachment (stored as a data URL, like the rest of the
-- app's images). A message must still carry SOMETHING — either text or
-- an attachment — so content may now be empty only when a file rides
-- along. Realtime/RLS are unchanged (new columns travel on the same row).
-- ============================================================

ALTER TABLE public.booking_messages
  ADD COLUMN IF NOT EXISTS attachment_url  TEXT,
  ADD COLUMN IF NOT EXISTS attachment_type TEXT,
  ADD COLUMN IF NOT EXISTS attachment_name TEXT;

-- Allow empty text (attachment-only messages); keep the 2000-char ceiling.
ALTER TABLE public.booking_messages ALTER COLUMN content SET DEFAULT '';
ALTER TABLE public.booking_messages DROP CONSTRAINT IF EXISTS booking_messages_content_check;
ALTER TABLE public.booking_messages ADD CONSTRAINT booking_messages_content_check
  CHECK (char_length(content) <= 2000);
ALTER TABLE public.booking_messages DROP CONSTRAINT IF EXISTS booking_messages_attachment_type_check;
ALTER TABLE public.booking_messages ADD CONSTRAINT booking_messages_attachment_type_check
  CHECK (attachment_type IS NULL OR attachment_type IN ('image', 'file'));

-- Replace the sender RPC with a version that also takes an attachment.
-- (Signature changes, so drop the old 2-arg function first.)
DROP FUNCTION IF EXISTS public.send_booking_message(TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.send_booking_message(
  p_booking_id       TEXT,
  p_content          TEXT,
  p_attachment_url   TEXT DEFAULT NULL,
  p_attachment_type  TEXT DEFAULT NULL,
  p_attachment_name  TEXT DEFAULT NULL
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
  -- A message needs either text or an attachment.
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

  SELECT name INTO my_name FROM public.users WHERE id = uid;

  INSERT INTO public.booking_messages (booking_id, sender_id, sender_name, content, attachment_url, attachment_type, attachment_name)
    VALUES (p_booking_id, uid, my_name, trimmed, p_attachment_url, p_attachment_type, p_attachment_name)
    RETURNING * INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_booking_message(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
