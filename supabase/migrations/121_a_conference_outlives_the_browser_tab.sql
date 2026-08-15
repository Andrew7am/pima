-- ============================================================
-- A conference that survives closing the tab
--
-- ConferenceHub is a full companion app — schedule, announcements, a
-- checklist, live mode, a joining code and a QR. All of it currently lives in
-- one line of App.tsx:
--
--   if (!conference) setConference(createEmptyConference(currentUser));
--
-- React state, and nothing else. A servant builds their conference, closes the
-- tab, and it is gone. Nobody else can see it either: the people who booked
-- with them have no way to reach the room, because there is nothing to reach.
--
-- The model was designed for this — ConferenceRoom already carries bookingId
-- and houseId. They were simply never filled in and never stored.
--
-- One conference per booking. The booking is what a servant and their group
-- already share, so it is the natural key: everyone on it belongs in the room,
-- and nobody else does.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.conferences (
  id                    TEXT PRIMARY KEY,
  booking_id            TEXT NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,
  house_id              TEXT REFERENCES public.houses(id) ON DELETE SET NULL,
  house_name            TEXT NOT NULL DEFAULT '',
  title                 TEXT NOT NULL DEFAULT '',
  organization_name     TEXT NOT NULL DEFAULT '',
  -- What a servant reads out so the group can join. Unique so two conferences
  -- can never answer to the same code.
  conference_code       TEXT NOT NULL UNIQUE,
  qr_code_url           TEXT,
  joining_requirements  TEXT NOT NULL DEFAULT 'open'
                          CHECK (joining_requirements IN ('open', 'approval_needed')),
  is_disabled           BOOLEAN NOT NULL DEFAULT FALSE,
  host_user_id          UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Lists and the live panel, stored whole. They are read and written as
  -- units by the hub and never queried field by field; splitting them into
  -- tables would buy nothing and cost four joins on every open.
  schedule              JSONB NOT NULL DEFAULT '[]'::JSONB,
  events                JSONB NOT NULL DEFAULT '[]'::JSONB,
  announcements         JSONB NOT NULL DEFAULT '[]'::JSONB,
  checklist             JSONB NOT NULL DEFAULT '[]'::JSONB,
  live_mode             JSONB NOT NULL DEFAULT '{}'::JSONB,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conferences_booking ON public.conferences(booking_id);
CREATE INDEX IF NOT EXISTS idx_conferences_host    ON public.conferences(host_user_id);

CREATE OR REPLACE FUNCTION public.touch_conference()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := NOW(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trg_touch_conference ON public.conferences;
CREATE TRIGGER trg_touch_conference BEFORE UPDATE ON public.conferences
  FOR EACH ROW EXECUTE FUNCTION public.touch_conference();

ALTER TABLE public.conferences ENABLE ROW LEVEL SECURITY;

-- Read: whoever the conference is for. The servant who booked, the owner of
-- the house hosting it, and admins. Deliberately NOT everyone with the code —
-- a code shared in a group chat should not open a stranger's schedule.
DROP POLICY IF EXISTS conferences_read ON public.conferences;
CREATE POLICY conferences_read ON public.conferences FOR SELECT
USING (
  host_user_id = auth.uid()
  OR public.is_admin(auth.uid())
  OR EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.houses h WHERE h.id = house_id AND h.owner_id = auth.uid())
);

-- Write: only the host, and only onto a booking that is actually theirs. The
-- second half matters — without it a servant could create a conference against
-- somebody else's booking and name themselves its host.
DROP POLICY IF EXISTS conferences_write ON public.conferences;
CREATE POLICY conferences_write ON public.conferences FOR ALL
USING (host_user_id = auth.uid() OR public.is_admin(auth.uid()))
WITH CHECK (
  (host_user_id = auth.uid()
   AND EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.user_id = auth.uid()))
  OR public.is_admin(auth.uid())
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conferences TO authenticated;

COMMENT ON TABLE public.conferences IS
  'One conference per booking. Until this table existed the whole hub lived in '
  'React state and vanished with the tab, and the group who booked could not '
  'see it at all.';
