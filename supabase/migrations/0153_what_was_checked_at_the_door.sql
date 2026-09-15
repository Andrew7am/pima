-- ============================================================
-- What was actually checked at the door
--
-- Arrival and departure are each one tap. The booking gets a timestamp and
-- nothing else, so «سجّل الوصول» records that somebody pressed a button — not
-- that the deposit was collected, the rooms were handed over, or the keys came
-- back. At check-out that gap is money: when a group leaves and a mattress is
-- torn, there is no record of anyone having looked at the room, and the
-- argument is one person's memory against another's.
--
-- Two JSONB lists, one per end of the stay. The item labels live in the client
-- so they can be revised without a migration; what is stored is what was
-- ticked, by whom, and when — which is the part that has to survive.
--
-- Advisory, not a gate. An owner standing at the door with a bus unloading
-- should not be blocked from recording an arrival because a box is unticked.
-- ============================================================

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS checkin_checklist  JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS checkout_checklist JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.bookings.checkin_checklist IS
  'Ticked items at arrival: [{key, done, at, by}]. Labels live in the client. '
  'Advisory — never blocks check-in.';
COMMENT ON COLUMN public.bookings.checkout_checklist IS
  'Ticked items at departure. The one that matters in a dispute: somebody '
  'looked at the room, and this says who and when.';

-- A tick with no shape is not a record. Reject a malformed list outright
-- rather than let it rot into something nobody can read back.
ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_checklists_are_arrays;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_checklists_are_arrays
  CHECK (jsonb_typeof(checkin_checklist) = 'array'
     AND jsonb_typeof(checkout_checklist) = 'array');
