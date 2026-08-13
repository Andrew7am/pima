-- ============================================================
-- What the participants list needs to show, and cannot
--
-- attendees has held five columns since 001: id, booking_id, name, gender,
-- group_type. The list a servant actually needs — who has paid, who is
-- getting there how, and a phone number to ring when someone does not turn
-- up at the gate — has nothing behind it.
--
-- Four columns. Each defaults to the honest unknown rather than a guess:
-- an attendee who registered before this migration has no phone and no
-- stated arrival, and the list must say so instead of implying «بسيارتي».
--
-- paid is deliberately a status, not a boolean. «لم يدفع» and «قيد المراجعة»
-- are different rows in the servant's head and different colours in the
-- design, and a boolean would force one of them to be a null the UI has to
-- guess at.
-- ============================================================

ALTER TABLE public.attendees
  ADD COLUMN IF NOT EXISTS phone          TEXT,
  ADD COLUMN IF NOT EXISTS arrival_method TEXT
    CHECK (arrival_method IS NULL OR arrival_method IN ('with_trip', 'own_car', 'independent')),
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'pending', 'paid')),
  ADD COLUMN IF NOT EXISTS registered_at  TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- The list filters and counts by these two constantly, per booking.
CREATE INDEX IF NOT EXISTS idx_attendees_booking_payment
  ON public.attendees(booking_id, payment_status);

COMMENT ON COLUMN public.attendees.payment_status IS
  'unpaid | pending | paid — three states because the servant sees three: '
  'not yet, sent and awaiting review, and settled.';
COMMENT ON COLUMN public.attendees.arrival_method IS
  'with_trip | own_car | independent. NULL means not asked or not answered — '
  'the list shows «غير محدد» rather than assuming.';
COMMENT ON COLUMN public.attendees.registered_at IS
  'Defaults to NOW() so rows created before this migration date to when the '
  'column arrived, not to a fabricated registration time.';
