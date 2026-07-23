-- Owner-private notes on bookings. Only the house owner and admin can
-- read/write this column; guests never see it.  Simple ALTER — no new
-- table, no new RLS policies needed (existing bookings RLS already
-- scopes SELECT/UPDATE by role; the column inherits those row-level
-- policies, and the column is simply omitted from guest-facing queries
-- on the client side).

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS owner_notes TEXT;
