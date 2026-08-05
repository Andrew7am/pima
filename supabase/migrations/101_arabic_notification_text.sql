-- Arabic numerals and dates inside the notification text the DB writes.
--
-- The client renders everything through lib/arabic (Arabic-Indic digits, named
-- months), but five trigger functions build their message bodies in SQL and
-- concatenated the raw columns:
--
--   'للفترة من ' || NEW.check_in || ' إلى ' || NEW.check_out
--   → "للفترة من 2026-08-25 إلى 2026-08-28"
--
-- so every booking notification landed in the bell with an ISO date and Latin
-- digits in the middle of an Arabic sentence. The deposit notice had the same
-- problem with to_char(deposit_amount, 'FM999999990') → "1350 ج.م".
--
-- Formatting has to happen where the text is built, so this adds three small
-- immutable helpers and re-declares the five functions using them. Nothing
-- else about the functions changes — same triggers, same conditions, same
-- SECURITY DEFINER, same ids.
--
-- The month names are spelled out here rather than left to to_char() because
-- Postgres month names follow lc_time, which is 'C' on a stock Supabase
-- instance — to_char would emit "August", not "أغسطس".
--
-- Rows already in `notifications` keep the text they were written with; these
-- are messages that were already delivered, and rewriting history would change
-- what a user was told after the fact.

-- ── Formatting helpers ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.ar_digits(txt TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
AS $$
  -- ٬ is U+066C ARABIC THOUSANDS SEPARATOR, which is what ar-EG grouping uses
  -- on the client (toLocaleString('ar-EG') → ٢٬٠٢٥).
  SELECT translate(txt, '0123456789,', '٠١٢٣٤٥٦٧٨٩٬')
$$;

COMMENT ON FUNCTION public.ar_digits(TEXT) IS
  'Latin digits and grouping commas → Arabic-Indic digits and ٬.';

CREATE OR REPLACE FUNCTION public.ar_date(d DATE)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE WHEN d IS NULL THEN '' ELSE
    public.ar_digits(EXTRACT(DAY FROM d)::int::text)
    || ' '
    || (ARRAY['يناير','فبراير','مارس','أبريل','مايو','يونيو',
              'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'])[EXTRACT(MONTH FROM d)::int]
    || ' '
    || public.ar_digits(EXTRACT(YEAR FROM d)::int::text)
  END
$$;

COMMENT ON FUNCTION public.ar_date(DATE) IS
  'A date as Arabic prose: 2026-08-25 → ٢٥ أغسطس ٢٠٢٦.';

CREATE OR REPLACE FUNCTION public.ar_number(n NUMERIC)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE WHEN n IS NULL THEN ''
              ELSE public.ar_digits(to_char(ROUND(n), 'FM999,999,999,990'))
  END
$$;

COMMENT ON FUNCTION public.ar_number(NUMERIC) IS
  'A whole number in Arabic-Indic digits with ٬ grouping: 2025 → ٢٬٠٢٥.';

-- ── The five message builders, unchanged except for the formatting ──

CREATE OR REPLACE FUNCTION public.notify_owner_on_booking_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  h_owner UUID;
BEGIN
  SELECT owner_id INTO h_owner FROM public.houses WHERE id = NEW.house_id;
  IF h_owner IS NOT NULL AND h_owner <> NEW.user_id THEN
    INSERT INTO public.notifications (id, user_id, booking_id, title, message, type, is_read)
    VALUES (
      'notif_newbk_' || NEW.id, h_owner, NEW.id,
      'طلب حجز جديد 🔔',
      'وصلك طلب حجز جديد من "' || COALESCE(NEW.user_name, '') || '" في "' || COALESCE(NEW.house_name, '') ||
        '" للفترة من ' || public.ar_date(NEW.check_in) || ' إلى ' || public.ar_date(NEW.check_out) ||
        '. يرجى مراجعته والرد عليه.',
      'info', FALSE
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_owner_on_booking_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  h_owner UUID;
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status = 'pending' THEN
    SELECT owner_id INTO h_owner FROM public.houses WHERE id = NEW.house_id;
    IF h_owner IS NOT NULL THEN
      INSERT INTO public.notifications (id, user_id, booking_id, title, message, type, is_read)
      VALUES (
        'notif_cancelbk_' || NEW.id || '_' || extract(epoch FROM clock_timestamp())::bigint, h_owner, NEW.id,
        'تم إلغاء طلب حجز ✕',
        'قام "' || COALESCE(NEW.user_name, '') || '" بإلغاء طلب حجزه في "' || COALESCE(NEW.house_name, '') ||
          '" للفترة من ' || public.ar_date(NEW.check_in) || ' إلى ' || public.ar_date(NEW.check_out) || '.',
        'danger', FALSE
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_guest_on_booking_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
    INSERT INTO public.notifications (id, user_id, booking_id, title, message, type, is_read)
    VALUES ('notif_appr_' || NEW.id, NEW.user_id, NEW.id,
      'تم قبول وتأكيد الحجز 🎉',
      'تهانينا! تم قبول وتأكيد حجزك في "' || COALESCE(NEW.house_name, '') ||
        '" للفترة من ' || public.ar_date(NEW.check_in) || ' إلى ' || public.ar_date(NEW.check_out) || '.',
      'success', FALSE);
  END IF;

  IF NEW.status = 'rejected' AND OLD.status = 'pending' THEN
    INSERT INTO public.notifications (id, user_id, booking_id, title, message, type, is_read)
    VALUES ('notif_rej_' || NEW.id, NEW.user_id, NEW.id,
      'تم رفض طلب الحجز ⚠️',
      'نأسف لإبلاغك بأنه قد تم رفض طلب حجزك في "' || COALESCE(NEW.house_name, '') ||
        '" للفترة من ' || public.ar_date(NEW.check_in) || ' إلى ' || public.ar_date(NEW.check_out) || '.',
      'danger', FALSE);
  END IF;

  IF NEW.deposit_paid = TRUE AND (OLD.deposit_paid IS DISTINCT FROM TRUE) THEN
    INSERT INTO public.notifications (id, user_id, booking_id, title, message, type, is_read)
    VALUES ('notif_dep_' || NEW.id || '_' || extract(epoch FROM clock_timestamp())::bigint, NEW.user_id, NEW.id,
      'تم استلام العربون بنجاح ✓',
      'أكد "' || COALESCE(NEW.house_name, '') || '" استلام العربون بمبلغ ' ||
        public.ar_number(COALESCE(NEW.deposit_amount, 0)) || ' ج.م. الحجز مؤمن الآن.',
      'success', FALSE);
  END IF;

  IF NEW.checked_in_at IS NOT NULL AND OLD.checked_in_at IS NULL THEN
    INSERT INTO public.notifications (id, user_id, booking_id, title, message, type, is_read)
    VALUES ('notif_ckin_' || NEW.id, NEW.user_id, NEW.id,
      'تم تسجيل وصولك 🏠',
      'تم تسجيل وصولك بنجاح لبيت "' || COALESCE(NEW.house_name, '') || '". نتمنى لك إقامة مباركة وممتعة!',
      'info', FALSE);
  END IF;

  IF NEW.status = 'completed' AND OLD.status <> 'completed' THEN
    INSERT INTO public.notifications (id, user_id, booking_id, title, message, type, is_read)
    VALUES ('notif_ckout_' || NEW.id, NEW.user_id, NEW.id,
      'شكراً لإقامتك 💚',
      'تمت مغادرتك من "' || COALESCE(NEW.house_name, '') || '". يسعدنا مشاركتك تقييمك للبيت لتساعد الآخرين.',
      'success', FALSE);
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_waitlist_on_rejection()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  house_beds  INTEGER;
  used_beds   INTEGER;
  free_beds   INTEGER;
  w           RECORD;
BEGIN
  IF NEW.status <> 'rejected' OR OLD.status = 'rejected' THEN
    RETURN NEW;
  END IF;

  SELECT beds_count INTO house_beds FROM public.houses WHERE id = NEW.house_id;

  SELECT COALESCE(SUM(guests_count), 0) INTO used_beds
  FROM public.bookings
  WHERE house_id = NEW.house_id
    AND status IN ('pending', 'approved')
    AND daterange(check_in, check_out, '[)') && daterange(NEW.check_in, NEW.check_out, '[)');

  free_beds := house_beds - used_beds;

  FOR w IN
    SELECT * FROM public.waitlist
    WHERE house_id = NEW.house_id
      AND status = 'waiting'
      AND daterange(check_in, check_out, '[)') && daterange(NEW.check_in, NEW.check_out, '[)')
      AND guests_count <= free_beds
    ORDER BY created_at ASC
    LIMIT 1
  LOOP
    UPDATE public.waitlist SET status = 'notified' WHERE id = w.id;
    INSERT INTO public.notifications (id, user_id, booking_id, title, message, type, is_read, created_at)
    VALUES (
      'notif_wl_' || w.id, w.user_id, NULL,
      'توفر مكان في قائمة الانتظار 🎉',
      'تم توفر مكان في "' || w.house_name || '" للفترة من ' || public.ar_date(w.check_in) ||
        ' إلى ' || public.ar_date(w.check_out) || '. سارع بإكمال الحجز قبل أن يشغله غيرك.',
      'success', FALSE, NOW()
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- ── Verification ────────────────────────────────────────────────────
-- Fails the migration rather than reporting a green run over a broken helper.

DO $$
DECLARE
  d TEXT;
  n TEXT;
  leftovers INT;
BEGIN
  d := public.ar_date(DATE '2026-08-25');
  IF d <> '٢٥ أغسطس ٢٠٢٦' THEN
    RAISE EXCEPTION 'ar_date is wrong: got %', d;
  END IF;

  n := public.ar_number(2025);
  IF n <> '٢٬٠٢٥' THEN
    RAISE EXCEPTION 'ar_number is wrong: got %', n;
  END IF;

  IF public.ar_date(NULL) <> '' THEN
    RAISE EXCEPTION 'ar_date(NULL) should be empty';
  END IF;

  -- No live notification builder may still concatenate a raw date column.
  SELECT count(*) INTO leftovers
  FROM pg_proc p
  JOIN pg_namespace ns ON ns.oid = p.pronamespace
  WHERE ns.nspname = 'public'
    AND p.prorettype = 'trigger'::regtype
    AND pg_get_functiondef(p.oid) LIKE '%للفترة من%'
    AND pg_get_functiondef(p.oid) LIKE '%|| NEW.check_in ||%';

  IF leftovers > 0 THEN
    RAISE EXCEPTION '% notification function(s) still print a raw ISO date', leftovers;
  END IF;

  RAISE NOTICE 'OK — ar_date/ar_number correct, no raw ISO dates left in notification text';
END $$;
