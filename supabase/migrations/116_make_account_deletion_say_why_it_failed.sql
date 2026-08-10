-- ============================================================
-- Account deletion fails with an error nobody can act on.
--
-- admin_release_user() rewrites four tables in the auth schema — users,
-- identities, sessions, refresh_tokens — because freeing the address is the
-- whole point: an owner who leaves has to be able to come back on the same
-- email. Those tables belong to supabase_auth_admin, not to the role this
-- SECURITY DEFINER function runs as, and a hosted project can have either
-- arrangement depending on when it was created.
--
-- When the grant is missing, Postgres raises "permission denied for table
-- users". That reaches the admin as a bare English string against an Arabic
-- screen, naming a table called `users` that is not the users table they are
-- looking at. There is nothing in it to act on.
--
-- Two changes, in this order:
--
--   1. Ask for the privileges. If they are already there, or if this role may
--      not grant them, nothing happens and nothing breaks.
--   2. Wrap each auth-schema write so the failure names the table it hit, in
--      Arabic, and says what to do about it.
--
-- The order matters: every auth write happens BEFORE public.users is touched.
-- A function that freed the profile but not the address would leave an
-- account that shows as deleted and still owns its email — the one state
-- worse than failing.
-- ============================================================

DO $$
BEGIN
  GRANT SELECT, UPDATE ON auth.users      TO postgres;
  GRANT SELECT, UPDATE ON auth.identities TO postgres;
  GRANT SELECT, DELETE ON auth.sessions   TO postgres;
  GRANT SELECT, DELETE ON auth.refresh_tokens TO postgres;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'auth grants not applied (%) — the function will now report which table it cannot reach.', SQLERRM;
END $$;

DROP FUNCTION IF EXISTS public.admin_release_user(UUID);

CREATE FUNCTION public.admin_release_user(target UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp AS $$
DECLARE
  actor_role  TEXT;
  actor_name  TEXT;
  t_role      TEXT;
  t_name      TEXT;
  t_email     TEXT;
  freed_email TEXT;
  -- Named so the error text can say which write failed without repeating it
  -- at four call sites.
  stage       TEXT;
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
  IF t_role = 'admin' THEN
    RAISE EXCEPTION 'لا يمكن حذف حساب إدارة. غيّر دوره أولاً.' USING ERRCODE = 'check_violation';
  END IF;

  SELECT email INTO t_email FROM auth.users WHERE id = target;
  freed_email := 'released-' || target::TEXT || '@pima.invalid';

  -- ---- auth schema first: if the address cannot be freed, nothing else runs.
  BEGIN
    stage := 'auth.users';
    UPDATE auth.users
       SET email = freed_email, email_change = '', raw_user_meta_data = '{}'::JSONB
     WHERE id = target;

    stage := 'auth.identities';
    UPDATE auth.identities
       SET identity_data = jsonb_set(
             jsonb_set(identity_data, '{email}', to_jsonb(freed_email)),
             '{email_verified}', 'false'::JSONB)
     WHERE user_id = target AND provider = 'email';

    stage := 'auth.sessions';
    DELETE FROM auth.sessions WHERE user_id = target;

    -- THE BUG. auth.refresh_tokens.user_id is character varying, not uuid —
    -- GoTrue has always declared it that way, alone among the auth tables.
    -- Comparing it to a uuid parameter raises
    --   operator does not exist: character varying = uuid
    -- and since the whole function is one transaction, every write above it
    -- rolled back too. Account deletion has never once worked.
    stage := 'auth.refresh_tokens';
    DELETE FROM auth.refresh_tokens WHERE user_id = target::TEXT;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE EXCEPTION
        'الحذف فشل عند جدول الدخول (%). المنصة مش مدّية الصلاحية دي للدالة. الحل: شغّل GRANT على الجدول ده، أو كلّم دعم Supabase. النص الأصلي: %',
        stage, SQLERRM
        USING ERRCODE = 'insufficient_privilege';
    WHEN undefined_table THEN
      RAISE EXCEPTION
        'الحذف فشل: جدول % مش موجود في المشروع ده. النص الأصلي: %',
        stage, SQLERRM
        USING ERRCODE = 'undefined_table';
    WHEN OTHERS THEN
      RAISE EXCEPTION
        'الحذف فشل عند % — %: %', stage, SQLSTATE, SQLERRM
        USING ERRCODE = 'internal_error';
  END;

  -- ---- only now does the profile stop carrying anyone's details
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
  'Frees a departing account''s email and strips its profile. Every auth-schema '
  'write happens before the profile is touched, so a permission failure leaves '
  'the account whole instead of half-deleted, and names the table it hit.';
