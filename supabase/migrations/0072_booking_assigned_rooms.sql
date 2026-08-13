-- ============================================================
-- Split room distribution into two roles. The owner now just ASSIGNS a
-- set of rooms to a confirmed group (sized to the agreed head-count); the
-- servant (booking's guest) then fills attendee names inside only those
-- rooms. This column records the owner's assignment. Nullable — bookings
-- with no assignment behave exactly as before.
-- ============================================================

ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS assigned_room_ids TEXT[];
