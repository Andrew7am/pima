-- ============================================================
-- Does the write-side actually bite? (migrations 090 / 091 / 092)
--
-- Run against the LOCAL stack only:
--   docker exec -i supabase_db_pima psql -U postgres -d postgres -f - < supabase/tests/guards.sql
--
-- No passwords and no HTTP: each case impersonates a signed-in user the same
-- way PostgREST does — SET ROLE authenticated plus a request.jwt.claims sub —
-- so both the RLS policies and the BEFORE triggers see exactly what they
-- would in production. The guards key off current_user = 'authenticated' and
-- auth.uid(), and both are real here.
--
-- Every case prints PASS or FAIL. Any FAIL means a guard that was written but
-- does not hold.
-- ============================================================

\set ON_ERROR_STOP off
\timing off

BEGIN;

-- ── Fixtures ────────────────────────────────────────────────────────────
-- Two guests and one owner, created directly so this file is self-contained
-- and leaves nothing behind (the whole thing rolls back at the end).

CREATE TEMP TABLE t AS
SELECT
  '00000000-0000-0000-0000-0000000000a1'::uuid AS guest_a,
  '00000000-0000-0000-0000-0000000000a2'::uuid AS guest_b,
  '00000000-0000-0000-0000-0000000000b1'::uuid AS owner_1;

INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
SELECT u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       u.email, '', NOW(), NOW(), NOW()
FROM (VALUES
  ('00000000-0000-0000-0000-0000000000a1'::uuid, 'guard.a@pima.test'),
  ('00000000-0000-0000-0000-0000000000a2'::uuid, 'guard.b@pima.test'),
  ('00000000-0000-0000-0000-0000000000b1'::uuid, 'guard.owner@pima.test')
) AS u(id, email);

UPDATE public.users SET role = 'owner' WHERE id = (SELECT owner_1 FROM t);

INSERT INTO public.houses (id, owner_id, owner_name, name, description, governorate, address,
                           price_per_night_per_person, beds_count, rooms_count, status)
SELECT 'guard_house', owner_1, 'مالك', 'بيت الاختبار', 'وصف', 'الإسكندرية', 'عنوان', 100, 50, 10, 'approved'
FROM t;

INSERT INTO public.bookings (id, user_id, user_name, user_email, user_phone, house_id, house_name,
                             check_in, check_out, guests_count, total_price, deposit_amount, status)
SELECT 'guard_bk_a', guest_a, 'ضيف أ', 'guard.a@pima.test', '01000000001', 'guard_house', 'بيت الاختبار',
       CURRENT_DATE + 30, CURRENT_DATE + 33, 10, 3000, 450, 'approved' FROM t;

INSERT INTO public.bookings (id, user_id, user_name, user_email, user_phone, house_id, house_name,
                             check_in, check_out, guests_count, total_price, deposit_amount, status)
SELECT 'guard_bk_b', guest_b, 'ضيف ب', 'guard.b@pima.test', '01000000002', 'guard_house', 'بيت الاختبار',
       CURRENT_DATE + 40, CURRENT_DATE + 43, 10, 3000, 450, 'approved' FROM t;


-- ── Helper: become a signed-in user ─────────────────────────────────────
CREATE OR REPLACE FUNCTION pg_temp.become(uid uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
END $$;

CREATE OR REPLACE FUNCTION pg_temp.check(label text, condition boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RAISE NOTICE '%  %', CASE WHEN condition THEN 'PASS' ELSE 'FAIL' END, label;
END $$;


-- ════════════════════════════════════════════════════════════════════════
--  090 — a new house cannot arrive pre-approved
-- ════════════════════════════════════════════════════════════════════════
DO $$
DECLARE got_status TEXT; got_rating NUMERIC; got_reviews INT;
BEGIN
  PERFORM pg_temp.become('00000000-0000-0000-0000-0000000000b1');
  SET LOCAL ROLE authenticated;

  INSERT INTO public.houses (id, owner_id, owner_name, name, description, governorate, address,
                             price_per_night_per_person, beds_count, rooms_count,
                             status, rating, reviews_count)
  VALUES ('guard_forged', '00000000-0000-0000-0000-0000000000b1', 'مالك', 'بيت مزيف', 'وصف',
          'الإسكندرية', 'عنوان', 50, 200, 40, 'approved', 5, 180);

  RESET ROLE;
  SELECT status, rating, reviews_count INTO got_status, got_rating, got_reviews
    FROM public.houses WHERE id = 'guard_forged';

  PERFORM pg_temp.check('house INSERT is forced to pending  (got ' || got_status || ')', got_status = 'pending');
  PERFORM pg_temp.check('forged rating is zeroed            (got ' || got_rating || ')',  got_rating = 0);
  PERFORM pg_temp.check('forged reviews_count is zeroed     (got ' || got_reviews || ')', got_reviews = 0);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  RAISE NOTICE 'FAIL  house INSERT raised instead of clamping: %', SQLERRM;
END $$;


-- ════════════════════════════════════════════════════════════════════════
--  090 — a payment cannot arrive already approved
-- ════════════════════════════════════════════════════════════════════════
DO $$
DECLARE got TEXT;
BEGIN
  PERFORM pg_temp.become('00000000-0000-0000-0000-0000000000a1');
  SET LOCAL ROLE authenticated;

  INSERT INTO public.payments (id, booking_id, user_id, user_name, amount, payment_method, payment_status, payment_date)
  VALUES ('guard_pay_1', 'guard_bk_a', '00000000-0000-0000-0000-0000000000a1', 'ضيف أ',
          999999, 'instapay', 'approved', NOW());

  RESET ROLE;
  SELECT payment_status INTO got FROM public.payments WHERE id = 'guard_pay_1';
  PERFORM pg_temp.check('payment INSERT is forced to pending (got ' || got || ')', got = 'pending');
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  RAISE NOTICE 'FAIL  payment INSERT raised instead of clamping: %', SQLERRM;
END $$;


-- ════════════════════════════════════════════════════════════════════════
--  090 — a payment cannot be filed against someone else's booking
-- ════════════════════════════════════════════════════════════════════════
DO $$
DECLARE blocked BOOLEAN := FALSE;
BEGIN
  PERFORM pg_temp.become('00000000-0000-0000-0000-0000000000a1');
  SET LOCAL ROLE authenticated;
  BEGIN
    INSERT INTO public.payments (id, booking_id, user_id, user_name, amount, payment_method, payment_status, payment_date)
    VALUES ('guard_pay_2', 'guard_bk_b', '00000000-0000-0000-0000-0000000000a1', 'ضيف أ',
            500, 'instapay', 'pending', NOW());
  EXCEPTION WHEN OTHERS THEN blocked := TRUE;
  END;
  RESET ROLE;
  PERFORM pg_temp.check('payment against another user''s booking is refused', blocked);
END $$;


-- ════════════════════════════════════════════════════════════════════════
--  090 — a guest cannot edit deposit_amount, house_id or their own status
-- ════════════════════════════════════════════════════════════════════════
DO $$
DECLARE dep NUMERIC; hid TEXT; st TEXT;
BEGIN
  PERFORM pg_temp.become('00000000-0000-0000-0000-0000000000a1');
  SET LOCAL ROLE authenticated;
  UPDATE public.bookings
     SET deposit_amount = 999999, house_id = 'guard_house', status = 'completed'
   WHERE id = 'guard_bk_a';
  RESET ROLE;

  SELECT deposit_amount, house_id, status INTO dep, hid, st FROM public.bookings WHERE id = 'guard_bk_a';
  PERFORM pg_temp.check('deposit_amount is pinned            (got ' || dep || ')', dep = 450);
  PERFORM pg_temp.check('status cannot be self-completed     (got ' || st || ')',  st = 'approved');
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  RAISE NOTICE 'NOTE  booking UPDATE raised: %', SQLERRM;
END $$;


-- ════════════════════════════════════════════════════════════════════════
--  090 — a banned account cannot create anything
-- ════════════════════════════════════════════════════════════════════════
DO $$
DECLARE blocked BOOLEAN := FALSE;
BEGIN
  UPDATE public.users SET is_banned = TRUE WHERE id = '00000000-0000-0000-0000-0000000000a1';

  PERFORM pg_temp.become('00000000-0000-0000-0000-0000000000a1');
  SET LOCAL ROLE authenticated;
  BEGIN
    INSERT INTO public.bookings (id, user_id, user_name, user_email, user_phone, house_id, house_name,
                                 check_in, check_out, guests_count, total_price, deposit_amount)
    VALUES ('guard_bk_banned', '00000000-0000-0000-0000-0000000000a1', 'ضيف أ', 'guard.a@pima.test',
            '01000000001', 'guard_house', 'بيت الاختبار',
            CURRENT_DATE + 60, CURRENT_DATE + 63, 10, 3000, 450);
  EXCEPTION WHEN OTHERS THEN blocked := TRUE;
  END;
  RESET ROLE;
  PERFORM pg_temp.check('banned account cannot insert a booking', blocked);
  UPDATE public.users SET is_banned = FALSE WHERE id = '00000000-0000-0000-0000-0000000000a1';
END $$;


-- ════════════════════════════════════════════════════════════════════════
--  091 — a payment review leaves a trail
-- ════════════════════════════════════════════════════════════════════════
DO $$
DECLARE rb UUID; ra TIMESTAMPTZ; ps TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='payments' AND column_name='reviewed_at') THEN
    RAISE NOTICE 'SKIP  091 not applied (payments.reviewed_at absent)';
    RETURN;
  END IF;

  UPDATE public.payments SET payment_status = 'approved' WHERE id = 'guard_pay_1';
  SELECT reviewed_by, reviewed_at, previous_status INTO rb, ra, ps
    FROM public.payments WHERE id = 'guard_pay_1';

  PERFORM pg_temp.check('review stamps a timestamp', ra IS NOT NULL);
  PERFORM pg_temp.check('review records the prior status (got ' || COALESCE(ps,'NULL') || ')', ps = 'pending');
END $$;


-- ════════════════════════════════════════════════════════════════════════
--  092 — no loyalty points for a stay at your own house
-- ════════════════════════════════════════════════════════════════════════
DO $$
DECLARE before_pts INT; after_pts INT;
BEGIN
  INSERT INTO public.bookings (id, user_id, user_name, user_email, user_phone, house_id, house_name,
                               check_in, check_out, guests_count, total_price, deposit_amount, status)
  VALUES ('guard_bk_self', '00000000-0000-0000-0000-0000000000b1', 'مالك', 'guard.owner@pima.test',
          '01000000003', 'guard_house', 'بيت الاختبار',
          CURRENT_DATE + 70, CURRENT_DATE + 73, 10, 3000, 450, 'approved');

  SELECT points INTO before_pts FROM public.users WHERE id = '00000000-0000-0000-0000-0000000000b1';
  UPDATE public.bookings SET payment_status = 'paid_full' WHERE id = 'guard_bk_self';
  SELECT points INTO after_pts FROM public.users WHERE id = '00000000-0000-0000-0000-0000000000b1';

  PERFORM pg_temp.check('owner earns no points on their own house (before ' || before_pts || ', after ' || after_pts || ')',
                        after_pts = before_pts);
END $$;


-- ════════════════════════════════════════════════════════════════════════
--  098 — a booking cannot start in the past
-- ════════════════════════════════════════════════════════════════════════
DO $$
DECLARE blocked BOOLEAN := FALSE; allowed BOOLEAN := FALSE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'bk_reject_past') THEN
    RAISE NOTICE 'SKIP  098 not applied (bk_reject_past absent)';
    RETURN;
  END IF;

  PERFORM pg_temp.become('00000000-0000-0000-0000-0000000000a1');

  SET LOCAL ROLE authenticated;
  BEGIN
    INSERT INTO public.bookings (id, user_id, user_name, user_email, user_phone, house_id, house_name,
                                 check_in, check_out, guests_count, total_price, deposit_amount)
    VALUES ('guard_bk_past', '00000000-0000-0000-0000-0000000000a1', 'ضيف أ', 'guard.a@pima.test',
            '01000000001', 'guard_house', 'بيت الاختبار',
            CURRENT_DATE - 21, CURRENT_DATE - 18, 10, 3000, 450);
  EXCEPTION WHEN OTHERS THEN blocked := TRUE;
  END;
  RESET ROLE;
  PERFORM pg_temp.check('a booking three weeks in the past is refused', blocked);

  -- …and a stay already under way is still editable/creatable, which is the
  -- whole reason the rule keys on check_in and allows a day of slack.
  SET LOCAL ROLE authenticated;
  BEGIN
    INSERT INTO public.bookings (id, user_id, user_name, user_email, user_phone, house_id, house_name,
                                 check_in, check_out, guests_count, total_price, deposit_amount)
    VALUES ('guard_bk_today', '00000000-0000-0000-0000-0000000000a1', 'ضيف أ', 'guard.a@pima.test',
            '01000000001', 'guard_house', 'بيت الاختبار',
            CURRENT_DATE, CURRENT_DATE + 3, 10, 3000, 450);
    allowed := TRUE;
  EXCEPTION WHEN OTHERS THEN allowed := FALSE;
  END;
  RESET ROLE;
  PERFORM pg_temp.check('a booking starting today is still accepted', allowed);
END $$;


-- ── Leave nothing behind ────────────────────────────────────────────────
ROLLBACK;
