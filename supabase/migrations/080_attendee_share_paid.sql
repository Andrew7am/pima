-- ============================================================
-- Participant payment tracking: the group leader marks which attendees
-- have paid their share of the trip cost. One boolean per attendee —
-- the share amount itself is derived client-side (total / guests), so
-- nothing else needs storing.
--
-- RLS: already covered. attendees_update (migration 026) lets the booking
-- owner update rows, and the house owner has her own update policy; the
-- client only ever toggles this flag through those existing paths.
-- ============================================================

ALTER TABLE public.attendees
  ADD COLUMN IF NOT EXISTS share_paid BOOLEAN NOT NULL DEFAULT FALSE;
