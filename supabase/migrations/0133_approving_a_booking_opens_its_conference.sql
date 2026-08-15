-- ============================================================
-- The conference opens when the owner approves, and closes when they don't
--
-- Approval reaches the database as a plain UPDATE on bookings — there is no
-- approve RPC — so this has to be a trigger. Anything in the client would be
-- skipped by an approval made from anywhere else.
--
-- Three decisions were left to me. Each is recorded here because the code is
-- where they will be questioned.
--
-- 1. REJECTED vs CANCELLED. An admin cancelling writes 'rejected', exactly as
--    an owner rejecting does, so the stored data cannot tell them apart. Rather
--    than guess at a distinction that is not there, the rule keys on the only
--    thing that is reliable: a conference belongs to an APPROVED booking. Leave
--    that state for any reason and the room is disabled, not deleted — the
--    schedule, announcements and who joined all survive, because a booking that
--    comes back should not come back empty. Return to approved and it reopens.
--
-- 2. ROOMS. room_allocations already maps one attendee to one room and one bed
--    within a booking. That is the room system; a second one would be a second
--    truth. It has two real holes, fixed below: room_id carries no foreign key,
--    and nothing stops two people being put in the same bed.
--
-- 3. PARTICIPANTS. «Those with accounts who booked» needs a link that does not
--    exist — attendees have never had a user_id. Added here, nullable, because
--    most attendees are names on a list and always will be: a servant writes
--    down forty people, and a few of them also happen to have signed in.
-- ============================================================

-- ── 3. An attendee may be a user ────────────────────────────────────────────
ALTER TABLE public.attendees
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- One account cannot be two attendees on the same booking. Partial, so the
-- many attendees with no account are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS uq_attendee_user_per_booking
  ON public.attendees(booking_id, user_id) WHERE user_id IS NOT NULL;

COMMENT ON COLUMN public.attendees.user_id IS
  'The Pima account behind this attendee, when there is one. Nullable on '
  'purpose — most attendees are names a servant wrote down, not sign-ins.';

-- ── 2. Close the two holes in the room system ───────────────────────────────
-- room_id was a bare TEXT while booking_id and attendee_id beside it both had
-- keys, so an allocation could point at a room that does not exist.
DO $$
BEGIN
  DELETE FROM public.room_allocations ra
   WHERE NOT EXISTS (SELECT 1 FROM public.rooms r WHERE r.id = ra.room_id);
  ALTER TABLE public.room_allocations
    ADD CONSTRAINT room_allocations_room_fk
    FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;   -- already added
  WHEN others THEN RAISE NOTICE 'room_id FK not added: %', SQLERRM;
END $$;

-- Two people in one bed was possible, and it had already happened: the first
-- attempt at this index failed on (room_1784307270301_0, bed 4). So the
-- duplicates have to be resolved before the rule can be enforced.
--
-- The earliest allocation for a bed keeps it. The later one is deleted rather
-- than moved: the attendee had no real bed — two people cannot share one — and
-- an unallocated attendee is visible to the servant doing the rooming, where a
-- silently reassigned one is not.
DO $$
DECLARE removed INTEGER;
BEGIN
  WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (
             PARTITION BY room_id, bed_number ORDER BY id
           ) AS rn
      FROM public.room_allocations
  )
  DELETE FROM public.room_allocations ra
   USING ranked r
   WHERE ra.id = r.id AND r.rn > 1;
  GET DIAGNOSTICS removed = ROW_COUNT;
  IF removed > 0 THEN
    RAISE NOTICE 'freed % duplicate bed allocation(s) — those attendees now have no bed and need re-rooming', removed;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_allocation_bed
  ON public.room_allocations(room_id, bed_number);

-- ── 1. Open the conference on approval ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.open_conference_for_booking()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_house_name TEXT;
  v_org        TEXT;
  v_code       TEXT;
BEGIN
  -- Left approved: close the room, keep everything in it.
  IF OLD.status = 'approved' AND NEW.status IS DISTINCT FROM 'approved' THEN
    UPDATE public.conferences SET is_disabled = TRUE WHERE booking_id = NEW.id;
    RETURN NEW;
  END IF;

  IF NEW.status <> 'approved' OR OLD.status = 'approved' THEN
    RETURN NEW;
  END IF;

  -- Reopening one that already exists, rather than raising a second.
  IF EXISTS (SELECT 1 FROM public.conferences WHERE booking_id = NEW.id) THEN
    UPDATE public.conferences SET is_disabled = FALSE WHERE booking_id = NEW.id;
    RETURN NEW;
  END IF;

  SELECT h.name INTO v_house_name FROM public.houses h WHERE h.id = NEW.house_id;
  SELECT COALESCE(u.organization_name, u.church_name, '') INTO v_org
    FROM public.users u WHERE u.id = NEW.user_id;

  -- Short enough to read down a phone, and carries the booking so one servant
  -- running two conferences does not collide with themselves.
  v_code := 'PM' || UPPER(RIGHT(regexp_replace(NEW.user_id::TEXT, '[^a-zA-Z0-9]', '', 'g'), 3))
                 || UPPER(RIGHT(regexp_replace(NEW.id,            '[^a-zA-Z0-9]', '', 'g'), 4));

  INSERT INTO public.conferences (
    id, booking_id, house_id, house_name, title, organization_name,
    conference_code, qr_code_url, joining_requirements, host_user_id
  ) VALUES (
    'conf_' || NEW.id, NEW.id, NEW.house_id, COALESCE(v_house_name, ''),
    'مؤتمر ' || COALESCE(v_house_name, ''), COALESCE(v_org, ''),
    v_code, v_code, 'open', NEW.user_id
  )
  -- The UNIQUE on booking_id is the real guard; approving twice, or two
  -- approvals racing, can only ever leave one room.
  ON CONFLICT (booking_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_open_conference ON public.bookings;
CREATE TRIGGER trg_open_conference
  AFTER UPDATE OF status ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.open_conference_for_booking();

COMMENT ON FUNCTION public.open_conference_for_booking() IS
  'A conference belongs to an approved booking. Created on the transition into '
  'approved, disabled — never deleted — on the way out, reopened on the way '
  'back. Rejection and cancellation are deliberately treated alike: the stored '
  'status cannot distinguish an owner rejecting from an admin cancelling.';
