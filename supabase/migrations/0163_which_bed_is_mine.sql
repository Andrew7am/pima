-- ============================================================
-- «أنا في أنهي غرفة؟» — answered on the card you are already looking at
--
-- 0157 gave a participant their room, through my_participations. That reads
-- attendees rows carrying the viewer's user_id, which is right for the forty
-- people a servant typed in — and wrong for the servant.
--
-- The person who books is usually not in their own roster with their own
-- account attached, so my_participations returns them nothing. And their
-- booking card in حجوزاتي has never shown a room at all: it has a button that
-- opens the distribution screen, which is a tool for assigning other people.
-- So the one person who arranged the whole trip had no way to find out which
-- bed was theirs.
--
-- This is deliberately not another copy of my_participations. It answers one
-- question — which room, for the account asking, on each of their bookings —
-- and it answers it for whoever is on the roster, booker or not. The booking
-- card already knows everything else about the booking; it only needed this.
--
-- Loaded as its own small query rather than folded into the roster, because
-- attendees and allocations are fetched lazily (only when the distribution
-- screen opens) and pulling the whole roster of every booking to show one line
-- per card would undo that on purpose.
-- ============================================================

CREATE OR REPLACE FUNCTION public.my_room_assignments()
RETURNS TABLE (
  booking_id  TEXT,
  room_name   TEXT,
  bed_number  INTEGER
)
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp AS $$
  SELECT a.booking_id, r.name, ra.bed_number
    FROM public.attendees a
    JOIN public.room_allocations ra ON ra.attendee_id = a.id
    LEFT JOIN public.rooms r ON r.id = ra.room_id
   WHERE a.user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.my_room_assignments() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_room_assignments() TO authenticated;

COMMENT ON FUNCTION public.my_room_assignments() IS
  'Which bed belongs to the caller, per booking. Works for the booker too, '
  'who is usually absent from my_participations because they are not in their '
  'own roster under their own account.';
