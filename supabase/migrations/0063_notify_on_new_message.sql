-- ============================================================
-- Notify the OTHER chat participant when a booking message arrives.
-- To avoid flooding the bell on a fast back-and-forth, there is ONE
-- coalesced "new messages" notification per (thread, recipient): each
-- new message refreshes its preview and flips it back to unread
-- (ON CONFLICT ... DO UPDATE). Opening the thread
-- (mark_booking_messages_read) clears it. Same trusted server-side
-- trigger pattern as notify_owner_on_booking_insert (030).
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_on_booking_message_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  guest_uid UUID;
  owner_uid UUID;
  recipient UUID;
  preview TEXT;
  notif_id TEXT;
BEGIN
  SELECT b.user_id, h.owner_id INTO guest_uid, owner_uid
    FROM public.bookings b JOIN public.houses h ON h.id = b.house_id
   WHERE b.id = NEW.booking_id;

  IF NEW.sender_id = guest_uid THEN recipient := owner_uid;
  ELSIF NEW.sender_id = owner_uid THEN recipient := guest_uid;
  ELSE recipient := NULL; -- admin or other: skip
  END IF;

  IF recipient IS NULL OR recipient = NEW.sender_id THEN RETURN NEW; END IF;

  preview := CASE
    WHEN NEW.content IS NOT NULL AND length(trim(NEW.content)) > 0 THEN left(NEW.content, 80)
    WHEN NEW.attachment_type = 'image' THEN '📷 صورة'
    WHEN NEW.attachment_type = 'file'  THEN '📎 ملف'
    ELSE 'رسالة جديدة'
  END;

  notif_id := 'notif_msg_' || NEW.booking_id || '_' || recipient::text;

  INSERT INTO public.notifications (id, user_id, booking_id, title, message, type, is_read, created_at)
  VALUES (notif_id, recipient, NEW.booking_id, 'رسالة جديدة 💬',
          'رسالة من "' || COALESCE(NEW.sender_name, '') || '": ' || preview,
          'info', FALSE, NOW())
  ON CONFLICT (id) DO UPDATE
    SET message = EXCLUDED.message, title = EXCLUDED.title, is_read = FALSE, created_at = NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_booking_message_insert ON public.booking_messages;
CREATE TRIGGER trg_notify_on_booking_message_insert
  AFTER INSERT ON public.booking_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_booking_message_insert();

-- Opening a thread clears its "new messages" notification for the reader.
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
  UPDATE public.notifications
     SET is_read = TRUE
   WHERE id = 'notif_msg_' || p_booking_id || '_' || uid::text AND is_read = FALSE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_booking_messages_read(TEXT) TO authenticated;
