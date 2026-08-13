-- ─────────────────────────────────────────────────────────────────────────────
-- 107 — Releasing an account, and making a ban mean something
--
-- TWO problems, both about accounts the admin wants gone.
--
-- 1. There was no way to remove an account at all — only to ban it. And a ban
--    holds the person's email forever, so somebody who wants to start again
--    cannot: the address is taken by the account they are trying to leave.
--
--    A real DELETE is not the answer. public.users cascades to twenty-two
--    tables, including houses, bookings, payments and owner_payouts. Deleting
--    a house owner would take their houses, EVERY OTHER GUEST'S bookings on
--    those houses, and the money trail with them. That is not account removal,
--    it is destroying other people's records.
--
--    So the account is RELEASED instead: the email is handed back immediately
--    so the person can register again, the profile becomes «مستخدم محذوف», and
--    every booking, payment and review stays exactly where it is.
--
-- 2. is_banned was a column the client read. Nothing in the database enforced
--    it. A banned account with an open tab, or anyone willing to call the API
--    directly, could still create bookings, send messages and post reviews —
--    the ban was a screen, not a rule.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ;

COMMENT ON COLUMN public.users.released_at IS
  'When an admin released this account: email handed back, profile anonymised, '
  'records kept. NULL for a live account.';

-- ── 1. A ban that the database itself enforces ───────────────────────────────

CREATE OR REPLACE FUNCTION public.actor_is_banned()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
  -- The ACTOR, not the row's owner: an admin must still be able to act on a
  -- banned person's booking, and an owner on a booking a banned guest made.
  SELECT COALESCE((SELECT is_banned FROM public.users WHERE id = auth.uid()), FALSE);
$$;

CREATE OR REPLACE FUNCTION public.reject_if_banned()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF public.actor_is_banned() THEN
    RAISE EXCEPTION 'حسابك موقوف من الإدارة ولا يمكنه تنفيذ هذا الإجراء.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

-- A trigger rather than rewriting each table's RLS: additive, so none of the
-- existing policies — which took several migrations to get right — are touched.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['bookings', 'reviews', 'booking_messages', 'payments', 'waitlist']
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_reject_if_banned ON public.%I', t);
      EXECUTE format(
        'CREATE TRIGGER trg_reject_if_banned BEFORE INSERT OR UPDATE ON public.%I '
        'FOR EACH ROW EXECUTE FUNCTION public.reject_if_banned()', t);
    END IF;
  END LOOP;
END $$;

-- ── 2. Releasing an account ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_release_user(target UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth, pg_temp AS $$
DECLARE
  actor_role  TEXT;
  actor_name  TEXT;
  t_role      TEXT;
  t_name      TEXT;
  t_email     TEXT;
  freed_email TEXT;
BEGIN
  SELECT role, name INTO actor_role, actor_name FROM public.users WHERE id = auth.uid();
  IF actor_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'هذا الإجراء متاح للإدارة فقط.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF target = auth.uid() THEN
    RAISE EXCEPTION 'لا يمكنك حذف حسابك أنت.' USING ERRCODE = 'check_violation';
  END IF;

  SELECT role, name INTO t_role, t_name FROM public.users WHERE id = target;
  IF t_name IS NULL THEN
    RAISE EXCEPTION 'الحساب غير موجود.' USING ERRCODE = 'no_data_found';
  END IF;
  -- An admin locking out another admin is how a platform loses its last key.
  IF t_role = 'admin' THEN
    RAISE EXCEPTION 'لا يمكن حذف حساب إدارة. غيّر دوره أولاً.' USING ERRCODE = 'check_violation';
  END IF;

  SELECT email INTO t_email FROM auth.users WHERE id = target;
  freed_email := 'released-' || target::TEXT || '@pima.invalid';

  -- Hand the address back. Rewriting auth.users alone is not enough: the
  -- identity row carries its own copy, and a fresh signup checks both.
  UPDATE auth.users
     SET email = freed_email,
         email_change = '',
         raw_user_meta_data = '{}'::JSONB
   WHERE id = target;

  UPDATE auth.identities
     SET identity_data = jsonb_set(
           jsonb_set(identity_data, '{email}', to_jsonb(freed_email)),
           '{email_verified}', 'false'::JSONB)
   WHERE user_id = target AND provider = 'email';

  -- End every live session, so an app already open stops working now rather
  -- than whenever its token happens to expire.
  DELETE FROM auth.sessions       WHERE user_id = target;
  DELETE FROM auth.refresh_tokens WHERE user_id = target;

  -- The profile keeps its id — that is what holds the bookings, payments and
  -- reviews in place — but stops carrying anyone's personal details.
  UPDATE public.users
     SET name              = 'مستخدم محذوف',
         email             = freed_email,
         phone             = '',
         address           = NULL,
         avatar_url        = NULL,
         organization_name = NULL,
         church_name       = NULL,
         priest_name       = NULL,
         date_of_birth     = NULL,
         is_banned         = TRUE,
         released_at       = NOW()
   WHERE id = target;

  INSERT INTO public.audit_log (actor_id, actor_name, actor_role, action, target_type, target_id, details)
  VALUES (
    auth.uid(), COALESCE(actor_name, 'غير معروف'), actor_role, 'user_released', 'user', target::TEXT,
    'تحرير حساب: ' || COALESCE(t_name, '') ||
      ' | الإيميل المُحرَّر: ' || COALESCE(t_email, '') ||
      ' | السجلات (حجوزات/دفعات/تقييمات) محفوظة'
  );

  RETURN jsonb_build_object('released', TRUE, 'freed_email', t_email);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_release_user(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_release_user(UUID) TO authenticated;

COMMENT ON FUNCTION public.admin_release_user(UUID) IS
  'Admin-only. Hands the email back so the person can register again, '
  'anonymises the profile, ends their sessions, and keeps every record. '
  'Deliberately not a DELETE: public.users cascades to bookings and payments.';
