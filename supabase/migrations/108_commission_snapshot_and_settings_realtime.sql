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
