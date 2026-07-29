-- Booking lifecycle timestamps for the "رحلة حجزك مع Pima" journey.
--
-- The guest-facing booking detail shows a five-step journey. Four of the steps
-- could already be dated from existing data (created_at, the deposit payment
-- row, checked_out_at) but two could not:
--
--   * when the owner actually confirmed the booking  -> approved_at
--   * when anything about the booking last changed   -> updated_at
--
-- Without these the UI would either show no date or an invented one, so they
-- are recorded here rather than guessed in the client.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ NOT NULL DEFAULT now();

-- Backfill: existing rows have no history to recover, so updated_at starts at
-- created_at. approved_at stays NULL for bookings confirmed before this
-- migration — the journey renders that step without a date, which is honest.
UPDATE public.bookings
   SET updated_at = created_at
 WHERE updated_at IS NULL OR updated_at < created_at;

-- Stamp updated_at on every write, and approved_at the first time a booking
-- becomes 'approved'. Kept in the database so a write from any client — the
-- app, the owner panel, the admin dashboard or SQL — is recorded the same way.
CREATE OR REPLACE FUNCTION public.touch_booking_timestamps()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();

  -- Only on the transition into 'approved', and never overwritten afterwards,
  -- so re-approving or a later edit cannot move the confirmation date.
  IF NEW.status = 'approved'
     AND (OLD.status IS DISTINCT FROM 'approved')
     AND NEW.approved_at IS NULL THEN
    NEW.approved_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_booking_timestamps ON public.bookings;
CREATE TRIGGER trg_touch_booking_timestamps
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_booking_timestamps();

-- A booking created already approved (the owner recording a walk-in) still
-- needs its confirmation date.
CREATE OR REPLACE FUNCTION public.set_booking_approved_at_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'approved' AND NEW.approved_at IS NULL THEN
    NEW.approved_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_booking_approved_at_on_insert ON public.bookings;
CREATE TRIGGER trg_set_booking_approved_at_on_insert
  BEFORE INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_booking_approved_at_on_insert();
