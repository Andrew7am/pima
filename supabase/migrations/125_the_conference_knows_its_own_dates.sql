-- ============================================================
-- The countdown counts to something
--
-- The hub shows «العد التنازلي للتجمع المبارك» starting from a hardcoded
-- 11d 5h 22m 10s and ticking down from there. It is not late or early — it is
-- counting to nothing. ConferenceRoom has no date at all, so there was nothing
-- for it to count to.
--
-- The booking has the dates. It always did. Three columns carry them onto the
-- conference so the countdown, the header and anything else that needs to know
-- when this is happening can read one row.
--
-- Copied, not joined, on purpose: these are what the conference was opened
-- against. If a booking's dates are later changed the conference should be
-- re-stamped deliberately — a retreat whose countdown silently jumps two weeks
-- because someone edited a booking is worse than one that is briefly stale and
-- can be corrected.
-- ============================================================

ALTER TABLE public.conferences
  ADD COLUMN IF NOT EXISTS starts_at    DATE,
  ADD COLUMN IF NOT EXISTS ends_at      DATE,
  ADD COLUMN IF NOT EXISTS guests_count INTEGER;

-- Conferences opened by 123 before these columns existed.
UPDATE public.conferences c
   SET starts_at    = b.check_in,
       ends_at      = b.check_out,
       guests_count = b.guests_count
  FROM public.bookings b
 WHERE b.id = c.booking_id
   AND (c.starts_at IS NULL OR c.ends_at IS NULL OR c.guests_count IS NULL);

-- Same trigger as 123, now stamping the dates it should have carried from the
-- start. Everything else about it is unchanged.
CREATE OR REPLACE FUNCTION public.open_conference_for_booking()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_house_name TEXT;
  v_org        TEXT;
  v_code       TEXT;
BEGIN
  IF OLD.status = 'approved' AND NEW.status IS DISTINCT FROM 'approved' THEN
    UPDATE public.conferences SET is_disabled = TRUE WHERE booking_id = NEW.id;
    RETURN NEW;
  END IF;

  IF NEW.status <> 'approved' OR OLD.status = 'approved' THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.conferences WHERE booking_id = NEW.id) THEN
    -- Reopening also refreshes the dates, in case the booking moved while it
    -- was closed.
    UPDATE public.conferences
       SET is_disabled  = FALSE,
           starts_at    = NEW.check_in,
           ends_at      = NEW.check_out,
           guests_count = NEW.guests_count
     WHERE booking_id = NEW.id;
    RETURN NEW;
  END IF;

  SELECT h.name INTO v_house_name FROM public.houses h WHERE h.id = NEW.house_id;
  SELECT COALESCE(u.organization_name, u.church_name, '') INTO v_org
    FROM public.users u WHERE u.id = NEW.user_id;

  v_code := 'PM' || UPPER(RIGHT(regexp_replace(NEW.user_id::TEXT, '[^a-zA-Z0-9]', '', 'g'), 3))
                 || UPPER(RIGHT(regexp_replace(NEW.id,            '[^a-zA-Z0-9]', '', 'g'), 4));

  INSERT INTO public.conferences (
    id, booking_id, house_id, house_name, title, organization_name,
    conference_code, qr_code_url, joining_requirements, host_user_id,
    starts_at, ends_at, guests_count
  ) VALUES (
    'conf_' || NEW.id, NEW.id, NEW.house_id, COALESCE(v_house_name, ''),
    'مؤتمر ' || COALESCE(v_house_name, ''), COALESCE(v_org, ''),
    v_code, v_code, 'open', NEW.user_id,
    NEW.check_in, NEW.check_out, NEW.guests_count
  )
  ON CONFLICT (booking_id) DO NOTHING;

  RETURN NEW;
END;
$$;

COMMENT ON COLUMN public.conferences.starts_at IS
  'Check-in of the booking this conference was opened against. Copied rather '
  'than joined: a countdown that silently jumps because a booking was edited '
  'is worse than one that is briefly stale.';
