-- ============================================================
-- Real date-availability search. Guests (and regular users) can't read
-- other people's bookings under RLS — correctly — so the explore screen
-- had no way to answer "is this house actually free on my dates?".
-- This SECURITY DEFINER function exposes ONLY the aggregate free-bed
-- count per approved house for a date range: no booking rows, no names,
-- no dates of other groups leak.
--
-- The overlap math intentionally mirrors check_booking_capacity()
-- (migration 003) — sum of guests across active bookings whose range
-- overlaps — so search results never promise capacity that the booking
-- trigger would then reject.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_houses_availability(p_check_in DATE, p_check_out DATE)
RETURNS TABLE(house_id TEXT, free_beds INTEGER)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    h.id,
    CASE
      -- Owner-blocked dates inside the range → not bookable at all
      WHEN EXISTS (
        SELECT 1 FROM unnest(COALESCE(h.blocked_dates, '{}')) AS d
        WHERE d ~ '^\d{4}-\d{2}-\d{2}$'
          AND d::date >= p_check_in AND d::date < p_check_out
      ) THEN 0
      ELSE GREATEST(0, h.beds_count - COALESCE((
        SELECT SUM(b.guests_count)::int
        FROM public.bookings b
        WHERE b.house_id = h.id
          AND b.status IN ('pending', 'approved')
          AND daterange(b.check_in, b.check_out, '[)') && daterange(p_check_in, p_check_out, '[)')
      ), 0))
    END AS free_beds
  FROM public.houses h
  WHERE h.status = 'approved';
$$;

GRANT EXECUTE ON FUNCTION public.get_houses_availability(DATE, DATE) TO anon, authenticated;
