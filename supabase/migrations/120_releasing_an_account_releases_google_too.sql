-- ============================================================
-- A released Google account walks straight back in
--
-- admin_release_user() frees the address by rewriting auth.users.email and
-- the identity row. 107 wrote that rewrite as:
--
--   UPDATE auth.identities SET identity_data = ... WHERE user_id = target
--     AND provider = 'email';
--
-- Two things are wrong with it for a Google account.
--
-- First, the WHERE clause skips it: provider is 'google', so nothing is
-- touched and the identity survives untouched.
--
-- Second, even without that clause the rewrite would not have worked. Supabase
-- matches a returning OAuth user on (provider, sub) — the provider's own id —
-- not on the email inside identity_data. Editing the email there changes what
-- the row says about itself and nothing about who it resolves to.
--
-- So a released owner signs in with Google, lands back on the same profile,
-- and the app greets them «أهلاً بك يا مستخدم محذوف» and asks them to complete
-- their data. There is no way out from inside the app: the release button
-- reports success every time and changes nothing that matters.
--
-- The fix is to delete the identity rows rather than edit them. Deleting all
-- of them, not just the email one — an account may carry several, and one
-- surviving provider is enough to walk back in. public.users keeps its id and
-- its bookings; only the ways of proving you are that account are removed.
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_release_user(target UUID)
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

  BEGIN
    stage := 'auth.users';
    UPDATE auth.users
       SET email = freed_email, email_change = '', raw_user_meta_data = '{}'::JSONB
     WHERE id = target;

    -- Every provider, and deleted rather than rewritten. Google resolves a
    -- returning user by (provider, sub); an edited email leaves that match
    -- intact and the account comes back on the next sign-in.
    stage := 'auth.identities';
    DELETE FROM auth.identities WHERE user_id = target;

    stage := 'auth.sessions';
    DELETE FROM auth.sessions WHERE user_id = target;

    stage := 'auth.refresh_tokens';
    -- user_id here is character varying, alone among the auth tables.
    DELETE FROM auth.refresh_tokens WHERE user_id = target::TEXT;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE EXCEPTION
        'الحذف فشل عند جدول الدخول (%). المنصة مش مدّية الصلاحية دي للدالة. النص الأصلي: %',
        stage, SQLERRM USING ERRCODE = 'insufficient_privilege';
    WHEN OTHERS THEN
      RAISE EXCEPTION 'الحذف فشل عند % — %: %', stage, SQLSTATE, SQLERRM
        USING ERRCODE = 'internal_error';
  END;

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
      ' | كل هويات الدخول اتشالت | السجلات محفوظة'
  );

  RETURN jsonb_build_object('released', TRUE, 'freed_email', t_email);
END;
$$;

-- ── Repair accounts released before this fix ────────────────────────────────
-- Their identities survived, so each is still one Google sign-in away from
-- coming back as «مستخدم محذوف».
DELETE FROM auth.identities i
USING public.users u
WHERE i.user_id = u.id AND u.released_at IS NOT NULL;

COMMENT ON FUNCTION public.admin_release_user(UUID) IS
  'Frees a departing account. Identity rows are deleted, not rewritten: OAuth '
  'resolves on (provider, sub), so an edited email leaves the account reachable.';
