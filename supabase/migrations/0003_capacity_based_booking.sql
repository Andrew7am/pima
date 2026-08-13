-- ============================================================
-- Replace strict no-overlap constraint with capacity-based check
-- A house can accept multiple bookings for the same dates as long
-- as the total guests do not exceed beds_count.
-- ============================================================

-- 1. Drop the old exclusion constraint that blocked ANY overlap
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS no_overlapping_bookings;

-- 2. Add trigger function that checks bed capacity for the target dates
CREATE OR REPLACE FUNCTION public.check_booking_capacity()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  house_beds INTEGER;
  used_beds  INTEGER;
BEGIN
  -- Only enforce for active bookings (pending or approved)
  IF NEW.status NOT IN ('pending', 'approved') THEN
    RETURN NEW;
  END IF;

  -- Total beds for this house
  SELECT beds_count INTO house_beds
  FROM public.houses
  WHERE id = NEW.house_id;

  IF house_beds IS NULL THEN
    RAISE EXCEPTION 'HOUSE_NOT_FOUND: House % does not exist', NEW.house_id;
  END IF;

  -- Sum guests of other overlapping active bookings for this house
  SELECT COALESCE(SUM(guests_count), 0) INTO used_beds
  FROM public.bookings
  WHERE house_id = NEW.house_id
    AND status IN ('pending', 'approved')
    AND id <> NEW.id
    AND daterange(check_in, check_out, '[)') && daterange(NEW.check_in, NEW.check_out, '[)');

  IF used_beds + NEW.guests_count > house_beds THEN
    RAISE EXCEPTION 'INSUFFICIENT_CAPACITY: Only % beds available for these dates (house has %, % already reserved)',
      (house_beds - used_beds), house_beds, used_beds;
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Attach trigger for INSERT and status/guest/date updates
DROP TRIGGER IF EXISTS enforce_booking_capacity ON public.bookings;
CREATE TRIGGER enforce_booking_capacity
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.check_booking_capacity();
