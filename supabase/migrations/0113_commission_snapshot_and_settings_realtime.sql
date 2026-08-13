-- ─────────────────────────────────────────────────────────────────────────────
-- 108 — Freeze the commission onto the booking, tell the owners, go realtime
--
-- THREE problems, one cause: the commission rate was a live global number that
-- nothing recorded and nothing announced.
--
-- 1. NO SNAPSHOT. deposit_rate is read by validate_booking_price and written
--    into bookings.deposit_amount, so every booking keeps the deposit it was
--    agreed at. commission_rate was never stored anywhere — every screen
--    multiplied by whatever the rate is RIGHT NOW. Raising it from 5% to 7%
--    silently recomputed the commission on bookings from a year ago, cutting
--    what owners are owed on deals they had already closed, and in some cases
--    on money already transferred.
--
-- 2. NO ANNOUNCEMENT. The rate is the core commercial term between Pima and
--    every house owner. It could change without a single person being told.
--
-- 3. NO PROPAGATION. platform_settings is fetched once at login and is not in
--    the realtime publication, so an owner with the app open kept computing at
--    the old rate indefinitely — and after this migration would keep quoting a
--    stale rate to new bookings too.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 0. A capacity check that only checks when capacity changed ───────────────
--
-- Found by this migration failing to apply: backfilling a new column fired
-- check_booking_capacity on every historical row, and a house with real
-- overlapping bookings (100 beds, 143 reserved) aborted the whole script.
--
-- The backfill is the messenger, not the problem. validate_booking_price has
-- returned early on an UPDATE that leaves price, guests and dates alone since
-- migration 024; check_booking_capacity never got the same guard, so it
-- re-validates on EVERY update to a booking. On an over-committed house that
-- means the owner cannot mark a deposit paid, approve, or even cancel — each
-- of those is an UPDATE, and each one re-runs a check that already fails.
-- Cancelling is the worst of it: the one action that would relieve the
-- overbooking is blocked by the overbooking.
--
-- Same guard, same reasoning: capacity is re-checked when something that
-- affects capacity moves.
CREATE OR REPLACE FUNCTION public.check_booking_capacity()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  house_beds INTEGER;
  used_beds  INTEGER;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.guests_count = OLD.guests_count
     AND NEW.check_in     = OLD.check_in
     AND NEW.check_out    = OLD.check_out
     AND NEW.house_id     = OLD.house_id
     AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status NOT IN ('pending', 'approved') THEN
    RETURN NEW;
  END IF;

  SELECT beds_count INTO house_beds
  FROM public.houses
  WHERE id = NEW.house_id;

  IF house_beds IS NULL THEN
    RAISE EXCEPTION 'HOUSE_NOT_FOUND: House % does not exist', NEW.house_id;
  END IF;

  SELECT COALESCE(SUM(guests_count), 0) INTO used_beds
  FROM public.bookings
  WHERE house_id = NEW.house_id
    AND status IN ('pending', 'approved')
    AND id <> NEW.id
    AND daterange(check_in, GREATEST(check_out, check_in + 1), '[)')
     && daterange(NEW.check_in, GREATEST(NEW.check_out, NEW.check_in + 1), '[)');

  IF used_beds + NEW.guests_count > house_beds THEN
    RAISE EXCEPTION 'INSUFFICIENT_CAPACITY: Only % beds available for these dates (house has %, % already reserved)',
      (house_beds - used_beds), house_beds, used_beds;
  END IF;

  RETURN NEW;
END;
$$;

-- ── 1. The snapshot ──────────────────────────────────────────────────────────

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS commission_rate NUMERIC;

COMMENT ON COLUMN public.bookings.commission_rate IS
  'The platform commission agreed WHEN THIS BOOKING WAS MADE. Set once by '
  'stamp_booking_commission and never updated. Screens must use this, not the '
  'current platform_settings value, or a rate change rewrites history.';

-- Existing rows predate the column. They were made under the rate in force
-- now, so that is the honest value to record — guessing anything else would
-- invent history rather than preserve it.
UPDATE public.bookings b
   SET commission_rate = COALESCE(
         (SELECT commission_rate FROM public.platform_settings WHERE id = 1), 0.05)
 WHERE b.commission_rate IS NULL;

CREATE OR REPLACE FUNCTION public.stamp_booking_commission()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public, pg_temp AS $$
BEGIN
  -- INSERT: stamp the rate in force today.
  IF TG_OP = 'INSERT' THEN
    NEW.commission_rate := COALESCE(
      NEW.commission_rate,
      (SELECT commission_rate FROM public.platform_settings WHERE id = 1),
      0.05);
    RETURN NEW;
  END IF;
  -- UPDATE: the agreed rate is not negotiable after the fact. Anyone editing
  -- a booking — owner, admin, a future migration — gets the original back.
  NEW.commission_rate := OLD.commission_rate;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_booking_commission ON public.bookings;
CREATE TRIGGER trg_stamp_booking_commission
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.stamp_booking_commission();

-- ── 2. Telling the owners ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_owners_commission_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  old_pct TEXT;
  new_pct TEXT;
  going_up BOOLEAN;
BEGIN
  IF NEW.commission_rate IS NOT DISTINCT FROM OLD.commission_rate THEN
    RETURN NEW;
  END IF;

  old_pct  := public.ar_digits(ROUND(COALESCE(OLD.commission_rate, 0) * 100)::TEXT);
  new_pct  := public.ar_digits(ROUND(NEW.commission_rate * 100)::TEXT);
  going_up := NEW.commission_rate > COALESCE(OLD.commission_rate, 0);

  -- Every owner, not only the ones with live bookings: the rate is the term
  -- they signed up under, and someone between stays still needs to know.
  INSERT INTO public.notifications (id, user_id, title, message, type)
  SELECT
    'notif_comm_' || u.id || '_' || EXTRACT(EPOCH FROM NOW())::BIGINT,
    u.id,
    CASE WHEN going_up THEN 'تغيير في نسبة عمولة بيما' ELSE 'خبر كويس: نسبة العمولة قلّت' END,
    'نسبة عمولة المنصة هتبقى ' || new_pct || '٪ بدل ' || old_pct || '٪. '
      || 'حجوزاتك القديمة هتفضل بنسبتها الأصلية زي ما هي — التغيير على الحجوزات الجديدة بس.',
    CASE WHEN going_up THEN 'info' ELSE 'success' END
  FROM public.users u
  WHERE u.role = 'owner'
    AND COALESCE(u.is_banned, FALSE) = FALSE
    AND u.released_at IS NULL;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_owners_commission ON public.platform_settings;
CREATE TRIGGER trg_notify_owners_commission
  AFTER UPDATE ON public.platform_settings
  FOR EACH ROW EXECUTE FUNCTION public.notify_owners_commission_change();

-- ── 3. Realtime ──────────────────────────────────────────────────────────────
-- Without this the app reads settings once at login. An owner who never closes
-- the tab quotes yesterday's rate forever.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
      AND tablename = 'platform_settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.platform_settings;
  END IF;
END $$;
