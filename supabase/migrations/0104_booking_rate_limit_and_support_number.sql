-- A daily booking ceiling, and the support number moved out of the code.
--
-- ── Why the limit exists ────────────────────────────────────────────
--
-- Nothing stopped one account from inserting bookings in a loop. Each row
-- notifies the owner, occupies capacity against every availability check, and
-- pushes a Realtime broadcast — so a few thousand rows is not just clutter, it
-- makes a house look fully booked and buries the owner's real requests.
--
-- ── Who it applies to ───────────────────────────────────────────────
--
-- Not simply "20 per user". The owner's manual-booking form writes rows with
-- user_id = the owner's own id (they are entering bookings taken by phone), and
-- a busy house can legitimately take more than twenty in a sitting. Filtering
-- on source = 'platform' would not work either: the INSERT policy is only
-- `auth.uid() = user_id AND is_active(auth.uid())`, so anyone can set
-- source = 'manual' on their own row and walk straight past the check.
--
-- The rule that actually matches the intent is about the *house*: whoever owns
-- the house a booking is for may add as many as they like to it. Everyone else
-- is a guest booking someone else's property, and gets the ceiling. Admins are
-- exempt for the same reason they are everywhere else.
--
-- The window is a rolling 24 hours rather than a calendar day, so the quota
-- cannot be doubled by starting at 23:59. Cancelled rows still count: the
-- point is to bound how fast rows can be created, and letting a cancel refill
-- the quota instantly would hand the loop straight back.
--
-- ── The number ──────────────────────────────────────────────────────
--
-- SUPPORT_WHATSAPP was a placeholder hardcoded in lib/support.ts, reachable
-- from six screens including the ones shown to a banned user and to an owner
-- waiting for approval — the two people with no other way to reach anyone. It
-- lives in platform_settings now so it can be changed from the admin panel
-- without a deploy.

-- ── Settings ────────────────────────────────────────────────────────

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS support_whatsapp TEXT NOT NULL DEFAULT '201096126259';

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS max_bookings_per_day INTEGER NOT NULL DEFAULT 20;

-- Digits only, with the country code and no '+' — wa.me rejects anything else,
-- and a link that silently 404s is worse than no link.
ALTER TABLE public.platform_settings DROP CONSTRAINT IF EXISTS platform_settings_support_whatsapp_format;
ALTER TABLE public.platform_settings
  ADD CONSTRAINT platform_settings_support_whatsapp_format
  CHECK (support_whatsapp ~ '^[0-9]{8,15}$');

-- Zero would lock the platform out of taking bookings at all; the upper bound
-- keeps a typo from turning the limit off by accident.
ALTER TABLE public.platform_settings DROP CONSTRAINT IF EXISTS platform_settings_max_bookings_range;
ALTER TABLE public.platform_settings
  ADD CONSTRAINT platform_settings_max_bookings_range
  CHECK (max_bookings_per_day BETWEEN 1 AND 500);

UPDATE public.platform_settings
   SET support_whatsapp = '201096126259'
 WHERE id = 1 AND (support_whatsapp IS NULL OR support_whatsapp = '');

-- ── The limit ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.enforce_booking_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  limit_per_day INTEGER;
  recent        INTEGER;
  house_owner   UUID;
BEGIN
  -- A server-side job or an admin script runs without a JWT. Those are not
  -- the thing being rate limited.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT owner_id INTO house_owner FROM public.houses WHERE id = NEW.house_id;
  IF house_owner IS NOT NULL AND house_owner = auth.uid() THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin') THEN
    RETURN NEW;
  END IF;

  SELECT max_bookings_per_day INTO limit_per_day FROM public.platform_settings WHERE id = 1;
  limit_per_day := COALESCE(limit_per_day, 20);

  SELECT count(*) INTO recent
  FROM public.bookings
  WHERE user_id = auth.uid()
    AND created_at >= now() - INTERVAL '24 hours';

  IF recent >= limit_per_day THEN
    -- ar_number comes from migration 101: the guest reads this message, so the
    -- count in it is Arabic-Indic like every other number on the screen.
    RAISE EXCEPTION 'booking_rate_limit: وصلت للحد الأقصى من الحجوزات خلال ٢٤ ساعة (%). حاول بعد شوية أو كلّم الدعم.',
      public.ar_number(limit_per_day)
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_booking_rate_limit() IS
  'Caps how many bookings one account can create in a rolling 24 hours. Owners of the house and admins are exempt.';

-- Named so it sorts after the existing BEFORE INSERT triggers: those normalise
-- and validate the row, and there is no point rate-limiting a row that is
-- about to be rejected anyway.
DROP TRIGGER IF EXISTS zz_enforce_booking_rate_limit ON public.bookings;
CREATE TRIGGER zz_enforce_booking_rate_limit
  BEFORE INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.enforce_booking_rate_limit();

-- ── Verification ────────────────────────────────────────────────────

DO $$
DECLARE
  n INTEGER;
  s TEXT;
BEGIN
  SELECT support_whatsapp, max_bookings_per_day INTO s, n
  FROM public.platform_settings WHERE id = 1;

  IF s IS NULL OR s !~ '^[0-9]{8,15}$' THEN
    RAISE EXCEPTION 'support_whatsapp is not a bare wa.me number: %', s;
  END IF;
  IF n IS NULL OR n < 1 THEN
    RAISE EXCEPTION 'max_bookings_per_day is not set: %', n;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'zz_enforce_booking_rate_limit' AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'the rate-limit trigger was not created';
  END IF;

  RAISE NOTICE 'OK — support number %, ceiling % bookings per rolling 24h', s, n;
END $$;
