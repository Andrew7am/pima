-- Add check-in and check-out timestamps to bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS checked_in_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS checked_out_at TIMESTAMPTZ;
