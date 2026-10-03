-- ============================================================
-- Three SECURITY DEFINER functions let an anonymous caller straight
-- past their ownership check.
--
-- Each one guarded with `<owner> <> auth.uid()` next to
-- `NOT public.is_admin(auth.uid())`. For a request carrying only the
-- anon key, auth.uid() is NULL, so the comparison is NULL, the whole
-- condition is NULL, and `IF NULL THEN` neither raises nor returns.
-- Anyone holding the public anon key could therefore:
--   archive_house          archive any house
--   get_house_neighbours   list the groups staying alongside any booking
--   house_stay_pulse       read any house's stay-pulse aggregates
--
-- Fixed by making that one comparison NULL-safe (IS DISTINCT FROM) and
-- by taking EXECUTE away from anon. PUBLIC is revoked too: it holds
-- EXECUTE by default and anon inherits it from there, so revoking anon
-- alone changes nothing. authenticated and service_role keep EXECUTE.
-- Nothing else in the three functions changes: each is re-created from
-- its own stored definition with only the guard replaced, so owner,
-- SECURITY DEFINER, search_path, signature, return type, volatility and
-- the rest of the body are carried over as they are.
--
-- Production already has this (applied by hand on 2026-10-03); this
-- file records it. Running it against a database that already has it
-- changes nothing.
-- ============================================================

-- ── 1. Precondition + guard swap ───────────────────────────────────────
-- Each body must be the audited one or already the fixed one; anything
-- else is drift, and the migration stops before touching a thing.
-- Hashes are md5(prosrc) with CRLF folded to LF: production holds these
-- bodies with CRLF (applied from a Windows checkout), a Linux checkout
-- would hold LF, and the two are the same function. Production's own
-- unfolded hashes, for the record:
--   archive_house         80ab6dfc4471e77c0f6c43090e64e2c8 -> 2b6e53de0c8c75934b17882a4259c951
--   get_house_neighbours  ffc634d51c60d9898ad1e0d3a15b5345 -> c8c2e7534f3d298af52060ebbdc1cc8a
--   house_stay_pulse      174b5e764e3e62cda12e97ccf33844ad -> c8edc286cc1dd805428c009256499897
DO $$
DECLARE
  r     RECORD;
  v_oid REGPROCEDURE;
  v_src TEXT;
  v_def TEXT;
BEGIN
  FOR r IN SELECT * FROM (VALUES
      ('archive_house',        'public.archive_house(text)',        'v_owner <> auth.uid()', 'v_owner IS DISTINCT FROM auth.uid()',
       'a6aec2e7e12f98b3949add1cdc7d21f4', 'b425dd57f9658082f795c3a3d47d9da9'),
      ('get_house_neighbours', 'public.get_house_neighbours(text)', 'v_user <> auth.uid()',  'v_user IS DISTINCT FROM auth.uid()',
       '6c02ac10f605e87342319a70261faf43', 'b8882637562ae2e155dc69679acafb68'),
      ('house_stay_pulse',     'public.house_stay_pulse(text)',     'v_owner <> auth.uid()', 'v_owner IS DISTINCT FROM auth.uid()',
       '340180de9e28662dc65aa8741255dd0d', 'b508abb301ae29dcd6930db8778fbbe9')
    ) AS t(fn, sig, old_guard, new_guard, old_md5, new_md5)
  LOOP
    v_oid := to_regprocedure(r.sig);
    IF v_oid IS NULL THEN
      RAISE EXCEPTION '0175_PRECONDITION: % does not exist', r.sig;
    END IF;
    IF (SELECT count(*) FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = r.fn) <> 1 THEN
      RAISE EXCEPTION '0175_PRECONDITION: expected exactly one public.% overload', r.fn;
    END IF;

    v_src := replace((SELECT prosrc FROM pg_proc WHERE oid = v_oid), E'\r\n', E'\n');
    IF md5(v_src) = r.new_md5 THEN
      CONTINUE;  -- already fixed
    END IF;
    IF md5(v_src) <> r.old_md5 THEN
      RAISE EXCEPTION '0175_PRECONDITION: % body md5 % is neither the audited % nor the fixed %',
        r.sig, md5(v_src), r.old_md5, r.new_md5;
    END IF;

    v_def := pg_get_functiondef(v_oid);
    IF (length(v_def) - length(replace(v_def, r.old_guard, ''))) / length(r.old_guard) <> 1 THEN
      RAISE EXCEPTION '0175_PRECONDITION: "%" must occur exactly once in %', r.old_guard, r.sig;
    END IF;
    EXECUTE replace(v_def, r.old_guard, r.new_guard);
  END LOOP;
END $$;

-- ── 2. Anonymous callers lose EXECUTE ──────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.archive_house(TEXT)        FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_house_neighbours(TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.house_stay_pulse(TEXT)     FROM PUBLIC, anon;

-- ── 3. Postconditions ──────────────────────────────────────────────────
DO $$
DECLARE
  r      RECORD;
  p      RECORD;
  v_fail TEXT := '';
BEGIN
  FOR r IN SELECT * FROM (VALUES
      ('archive_house',        'public.archive_house(text)',        'v_owner <> auth.uid()',
       'b425dd57f9658082f795c3a3d47d9da9', 'p_house_id text',
       'void'),
      ('get_house_neighbours', 'public.get_house_neighbours(text)', 'v_user <> auth.uid()',
       'b8882637562ae2e155dc69679acafb68', 'p_booking_id text',
       'TABLE(booking_type text, size_band text, check_in text, check_out text)'),
      ('house_stay_pulse',     'public.house_stay_pulse(text)',     'v_owner <> auth.uid()',
       'b508abb301ae29dcd6930db8778fbbe9', 'p_house_id text',
       'TABLE(responses bigint, avg_food numeric, avg_service numeric, avg_clean numeric, avg_organization numeric, would_return_pct numeric)')
    ) AS t(fn, sig, old_guard, new_md5, args, result)
  LOOP
    SELECT pr.oid, pr.prosrc, pr.prosecdef, pr.proconfig, l.lanname, pr.proacl
      INTO p
      FROM pg_proc pr JOIN pg_language l ON l.oid = pr.prolang
     WHERE pr.oid = to_regprocedure(r.sig);

    IF md5(replace(p.prosrc, E'\r\n', E'\n')) <> r.new_md5 THEN v_fail := v_fail || format(' %s:body', r.fn); END IF;
    IF position(r.old_guard IN p.prosrc) > 0 THEN v_fail := v_fail || format(' %s:old_guard', r.fn); END IF;
    IF NOT p.prosecdef THEN v_fail := v_fail || format(' %s:security_definer', r.fn); END IF;
    IF p.proconfig IS DISTINCT FROM ARRAY['search_path=public'] THEN v_fail := v_fail || format(' %s:search_path', r.fn); END IF;
    IF p.lanname <> 'plpgsql' THEN v_fail := v_fail || format(' %s:language', r.fn); END IF;
    IF pg_get_function_arguments(p.oid) <> r.args THEN v_fail := v_fail || format(' %s:arguments', r.fn); END IF;
    IF pg_get_function_result(p.oid) <> r.result THEN v_fail := v_fail || format(' %s:result', r.fn); END IF;
    IF (SELECT count(*) FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = r.fn) <> 1 THEN
      v_fail := v_fail || format(' %s:overloads', r.fn);
    END IF;
    IF EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0) THEN v_fail := v_fail || format(' %s:public_grant', r.fn); END IF;
    IF has_function_privilege('anon', p.oid, 'EXECUTE') THEN v_fail := v_fail || format(' %s:anon_executes', r.fn); END IF;
    IF NOT has_function_privilege('authenticated', p.oid, 'EXECUTE') THEN v_fail := v_fail || format(' %s:authenticated_lost', r.fn); END IF;
    IF NOT has_function_privilege('service_role', p.oid, 'EXECUTE') THEN v_fail := v_fail || format(' %s:service_role_lost', r.fn); END IF;
  END LOOP;

  IF v_fail <> '' THEN
    RAISE EXCEPTION '0175_POSTCONDITION_FAILED:%', v_fail;
  END IF;
END $$;
