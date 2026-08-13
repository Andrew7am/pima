-- ============================================================
-- Owner-side booking management (desktop dashboard redesign):
--   1. bookings.source — distinguishes platform bookings (guest booked
--      through the app) from manual ones the owner records himself
--      (phone/walk-in) and temporary tentative holds. Manual/temporary
--      bookings are created by the owner with user_id = their own id,
--      which already passes the existing bookings_insert_user policy,
--      and the capacity trigger (003) applies to them unchanged.
--   2. rooms.floor — needed for the per-floor occupancy map.
--   3. notify_owner_on_booking_insert now skips bookings the owner
--      created on their own house (no point notifying yourself).
-- ============================================================

ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'platform'
  CHECK (source IN ('platform', 'manual', 'temporary'));

ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS floor INTEGER NOT NULL DEFAULT 1;

CREATE OR REPLACE FUNCTION public.notify_owner_on_booking_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  h_owner UUID;
BEGIN
  SELECT owner_id INTO h_owner FROM public.houses WHERE id = NEW.house_id;
  IF h_owner IS NOT NULL AND h_owner <> NEW.user_id THEN
    INSERT INTO public.notifications (id, user_id, booking_id, title, message, type, is_read)
    VALUES (
      'notif_newbk_' || NEW.id, h_owner, NEW.id,
      'طلب حجز جديد 🔔',
      'وصلك طلب حجز جديد من "' || COALESCE(NEW.user_name, '') || '" في "' || COALESCE(NEW.house_name, '') ||
        '" للفترة من ' || NEW.check_in || ' إلى ' || NEW.check_out || '. يرجى مراجعته والرد عليه.',
      'info', FALSE
    );
  END IF;
  RETURN NEW;
END;
$$;
