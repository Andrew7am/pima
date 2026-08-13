-- ============================================================
-- Smart Room Management System (phase 1): room occupancy is now derived
-- client-side from room_allocations + bookings instead of the manually-set
-- rooms.status column (status now only carries the cleaning/maintenance
-- manual overrides — no constraint change needed, 'available'/'booked'
-- keep their existing CHECK values, 'booked' is just no longer written by
-- the client). This adds the indexes that derivation needs, since it will
-- query these FK columns far more often than the old on-demand-only
-- per-modal load did. Purely additive — no behavior change.
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_room_allocations_room_id ON public.room_allocations(room_id);
CREATE INDEX IF NOT EXISTS idx_room_allocations_booking_id ON public.room_allocations(booking_id);
CREATE INDEX IF NOT EXISTS idx_attendees_booking_id ON public.attendees(booking_id);
CREATE INDEX IF NOT EXISTS idx_bookings_house_dates ON public.bookings(house_id, status, check_in, check_out);
