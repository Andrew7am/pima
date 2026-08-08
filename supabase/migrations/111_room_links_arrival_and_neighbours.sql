-- ============================================================
-- Three things a church servant needs, and one silence that is a bug.
--
-- Everything here concerns bookings that carry MINORS, so each
-- section states what it refuses as carefully as what it adds.
-- ============================================================


-- ============================================================
-- 0. THE BUG FIRST: cancelling a confirmed booking told nobody.
--
-- notify_owner_on_booking_cancel (migration 101, line 113) fires on
--   IF NEW.status = 'cancelled' AND OLD.status = 'pending'
-- so it only ever announced the cancellation of a request that had
-- not been accepted yet. Cancelling an APPROVED booking — the one
-- that strands forty teenagers, and the only one with money against
-- it — notified no one, in either direction.
--
-- This is not a feature. It is the single status change the platform
-- most needed to announce and the one it was silent about.
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_owner_on_booking_cancel()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  h_owner UUID;
  h_name  TEXT;
BEGIN
  -- Any live booking becoming cancelled, not just a pending one.
  IF NEW.status = 'cancelled' AND OLD.status IN ('pending', 'approved') THEN
    SELECT owner_id, name INTO h_owner, h_name FROM public.houses WHERE id = NEW.house_id;

    IF h_owner IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, booking_id, title, body)
      VALUES (
        h_owner, NEW.id,
        'حجز اتلغى',
        format('%s ألغى حجزه في %s يوم %s.',
               COALESCE(NEW.user_name, 'ضيف'), COALESCE(h_name, 'البيت'), NEW.check_in)
      );
    END IF;

    -- And the guest, who until now was told nothing at all — there was
    -- no cancelled branch on their side of the notification triggers.
    INSERT INTO public.notifications (user_id, booking_id, title, body)
    VALUES (
      NEW.user_id, NEW.id,
      'اتلغى حجزك',
      format('حجزك في %s يوم %s اتلغى. لو فيه عربون مدفوع هنراجعه معاك.',
             COALESCE(h_name, 'البيت'), NEW.check_in)
    );
  END IF;
  RETURN NEW;
END;
$$;


-- ============================================================
-- 1. «مين مع مين» — the constraints the allocator cannot know.
--
-- autoAllocate splits on gender and group type, which is everything
-- the database knows and none of what the servant knows: these two
-- are brothers; this boy will not sleep away from an adult; those two
-- in one room means nobody in the house sleeps. So he lets it run and
-- then redoes it by hand.
--
-- SAFEGUARDING. An «بعيد عن» pair is a sensitive claim about two
-- named children. There is deliberately NO reason column and no free
-- text: nowhere to record why, because a reason typed about a minor
-- is a disclosure with no safe reader. The rows are the booker's
-- alone — never the house owner, never other attendees, never the
-- anonymous self-registration page, and they are not printed on the
-- rooming list handed to the house, which shows rooms and not
-- relationships.
--
-- The supervisor flag is the upside: «خادم مسؤول في كل أوضة» stops
-- being something the servant hopes he remembered and becomes
-- something the allocator enforces and the printout proves.
-- ============================================================

ALTER TABLE public.attendees ADD COLUMN IF NOT EXISTS is_supervisor BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS public.attendee_links (
  id          BIGSERIAL PRIMARY KEY,
  booking_id  TEXT NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  attendee_a  TEXT NOT NULL,
  attendee_b  TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('together', 'apart')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (attendee_a <> attendee_b)
);

CREATE INDEX IF NOT EXISTS attendee_links_booking_idx ON public.attendee_links(booking_id);
-- One statement per pair, whichever way round it was entered.
CREATE UNIQUE INDEX IF NOT EXISTS attendee_links_pair_idx
  ON public.attendee_links(booking_id, LEAST(attendee_a, attendee_b), GREATEST(attendee_a, attendee_b));

ALTER TABLE public.attendee_links ENABLE ROW LEVEL SECURITY;

-- The booker only. Not the owner: he receives a rooming list, and the
-- reason two children are kept apart is not his to read.
DROP POLICY IF EXISTS "attendee_links_booker" ON public.attendee_links;
CREATE POLICY "attendee_links_booker" ON public.attendee_links
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.user_id = auth.uid())
    OR public.is_admin(auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.user_id = auth.uid())
    OR public.is_admin(auth.uid())
  );


-- ============================================================
-- 2. «وصلنا» — one sentence for forty parents.
--
-- Migration 079 already publishes an anonymous page per booking —
-- house name, dates, counts — reached by the link the servant shares
-- in the church group so members add their own names. Between
-- check-in and check-out that page gains ONE LINE: the group arrived,
-- and later, it left.
--
-- DEFINED BY WHAT IT REFUSES. No individual is named, counted out,
-- photographed or located. There is no way to ask about a specific
-- child, no reply field, and therefore no route from a stranger to a
-- minor. It adds two GROUP-LEVEL timestamps to a page that is already
-- public to whoever holds the link, and nothing else. The servant can
-- switch it off.
-- ============================================================

ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS show_arrival_to_parents BOOLEAN NOT NULL DEFAULT TRUE;

CREATE OR REPLACE FUNCTION public.get_booking_invite_info(p_booking_id TEXT)
RETURNS TABLE (
  house_name       TEXT,
  check_in         TEXT,
  check_out        TEXT,
  guests_count     INTEGER,
  registered_count BIGINT,
  status           TEXT,
  arrived_at       TIMESTAMPTZ,
  departed_at      TIMESTAMPTZ
)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT
    b.house_name,
    b.check_in::TEXT,
    b.check_out::TEXT,
    b.guests_count,
    (SELECT COUNT(*) FROM public.attendees a WHERE a.booking_id = b.id),
    b.status::TEXT,
    -- Only while the trip is actually running, and only if the servant
    -- left it on. Afterwards the page returns to what it always was.
    CASE WHEN b.show_arrival_to_parents THEN b.checked_in_at END,
    CASE WHEN b.show_arrival_to_parents THEN b.checked_out_at END
  FROM public.bookings b
  WHERE b.id = p_booking_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_booking_invite_info(TEXT) TO anon, authenticated;


-- ============================================================
-- 3. «مين معانا في البيت» — who shares the building.
--
-- A servant bringing forty teenage girls has a right to know, before
-- he leaves Cairo, that a boys' secondary group is in the same house
-- those nights. Today the only person holding that fact is the owner,
-- who has no reason to volunteer it.
--
-- It reads like a privacy leak until you invert it: this is a
-- safeguarding fact, and withholding it protects nobody.
--
-- SO IT IS AGGREGATE ONLY. The group's KIND (from conference_details
-- bookingType) and a SIZE BAND — never an exact count, never the
-- church, never the servant, never a name, never a phone, and no
-- channel between the two groups. The caller must already hold an
-- approved booking at that house overlapping those nights, which the
-- function verifies itself rather than trusting the client.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_house_neighbours(p_booking_id TEXT)
RETURNS TABLE (
  booking_type TEXT,
  size_band    TEXT,
  check_in     TEXT,
  check_out    TEXT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  b RECORD;
BEGIN
  SELECT id, house_id, check_in, check_out, user_id, status
    INTO b FROM public.bookings WHERE id = p_booking_id;

  IF b.id IS NULL THEN RETURN; END IF;
  -- Only the group's own booker, and only once the stay is real.
  IF b.user_id <> auth.uid() AND NOT public.is_admin(auth.uid()) THEN RETURN; END IF;
  IF b.status <> 'approved' THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    COALESCE(o.conference_details->>'bookingType', 'standard')::TEXT,
    CASE
      WHEN o.guests_count <= 10 THEN 'أقل من ١٠'
      WHEN o.guests_count <= 25 THEN 'حوالي ١٠–٢٥'
      WHEN o.guests_count <= 50 THEN 'حوالي ٢٥–٥٠'
      ELSE 'أكتر من ٥٠'
    END::TEXT,
    o.check_in::TEXT,
    o.check_out::TEXT
  FROM public.bookings o
  WHERE o.house_id = b.house_id
    AND o.id <> b.id
    AND o.status = 'approved'
    -- Overlapping nights: check-out day is not a night, so a group
    -- leaving the morning another arrives is not a neighbour.
    AND o.check_in < b.check_out
    AND o.check_out > b.check_in;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_house_neighbours(TEXT) TO authenticated;
