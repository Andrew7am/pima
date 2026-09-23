-- 0171_lock_direct_booking_insert.sql
--
-- THE LAST WAY INTO public.bookings THAT THE FINANCIAL CORE DOES NOT GUARD.
--
-- WHY
-- ---
-- 0153 through 0157 moved every booking onto one pricing path. A guest books
-- through create_booking_with_financials; an owner records a walk-in through
-- create_booking_on_behalf_with_financials. Both derive the price from
-- fin_price_booking, both write a booking_financials snapshot and a
-- settlement_holds row, and neither accepts a price from the client.
--
-- None of that is enforced by the database. It is enforced by the client
-- choosing to call those functions. public.bookings still carries a plain
-- INSERT grant to anon and authenticated, and an RLS policy that admits it:
--
--   bookings_insert_user  WITH CHECK (auth.uid() = user_id AND is_active(auth.uid()))
--
-- So any authenticated account can still POST a row to /rest/v1/bookings with
-- a total_price, a deposit_amount and a commission_rate of its own choosing.
-- Such a row is not merely unpriced — it is invisible to the financial core:
-- no agreement is resolved, no owner_entitlement exists, no settlement hold is
-- created, and the booking can therefore never be settled. That is exactly the
-- class of row this release was written to abolish, and it would keep arriving.
--
-- A second, quieter consequence. 0156 added bookings_backfill_identity, which
-- fills blank contact columns from public.users keyed on NEW.user_id. 0157
-- added a guard so an owner's walk-in does not inherit the owner's phone,
-- email and role — but that guard keys on NEW.created_by, which only the RPC
-- populates inside its own INSERT. BEFORE ROW triggers fire in alphabetical
-- order, so on a DIRECT insert bookings_backfill_identity_trg runs before
-- bookings_stamp_created_by_trg, NEW.created_by is still NULL, the guard does
-- not fire, and the owner's details are copied onto the guest. Proven by
-- execution against this schema:
--
--     direct INSERT, source='manual', blank email
--       -> user_email = the owner's address
--       -> user_role  = 'owner'
--
-- Removing the direct INSERT closes both at once, and closes the second one
-- without touching trigger order, trigger names or the guard itself.
--
-- WHY A REVOKE AND NOT A POLICY OR A TRIGGER
--
-- The RLS policy is left exactly as it is. A policy cannot distinguish "this
-- INSERT came from the RPC" from "this INSERT came from the client", because
-- the RPC's insert is not subject to the policy at all: both RPCs are
-- SECURITY DEFINER owned by postgres, which owns public.bookings, and the
-- table is not FORCE ROW LEVEL SECURITY. They therefore run with the owner's
-- privileges and bypass RLS. Revoking the table privilege from the two client
-- roles removes the client's door and leaves the RPC's untouched. It is the
-- smallest change that has the effect, and it is reversible with one GRANT.
--
-- WHAT THIS DELIBERATELY DOES NOT DO
--
--   * It does not revoke SELECT, UPDATE or DELETE. Those still have live
--     callers: the app reads bookings, updates status and owner_settled_at,
--     and admins and owners delete. Only INSERT has no remaining caller.
--   * It does not alter any RLS policy, trigger, column, constraint or index.
--   * It does not alter either RPC's own EXECUTE grants.
--   * It does not change table ownership.
--
-- BACKWARD COMPATIBILITY
--
-- createBooking(), the client helper that performed this insert, was deleted
-- in c073d64 and its absence is verified in the compiled bundle. The Android
-- application has not been published, so no installed client depends on the
-- direct path. There is no caller left to break.
--
-- A NOTE ON FUTURE TABLES
--
-- The default privileges on schema public still grant INSERT to anon and
-- authenticated on newly created tables. This migration is deliberately
-- scoped to public.bookings and does not touch ALTER DEFAULT PRIVILEGES;
-- changing those would affect every table this project will ever create and
-- is a separate decision.
--
-- APPLIES AFTER: 0170_booking_on_behalf.sql
-- TOUCHES: one table privilege, on one table, for two roles.
-- DOES NOT TOUCH: any row, column, policy, trigger, function or ownership.

-- ===========================================================================
-- 1. PRECONDITIONS
-- ===========================================================================
--
-- Revoking the direct path before the replacement path exists would leave an
-- owner with no way at all to record a walk-in. Both RPCs must be present,
-- must be SECURITY DEFINER, and their owner must itself hold INSERT on
-- public.bookings — otherwise this migration does not merely close the client
-- door, it closes every door.

DO $pre$
DECLARE
  v_missing TEXT := '';
  v_guest   CONSTANT TEXT := 'public.create_booking_with_financials(text,text,date,date,integer,text,integer[],uuid,integer,text)';
  v_behalf  CONSTANT TEXT := 'public.create_booking_on_behalf_with_financials(text,text,date,date,integer,text,text,text,text,text,uuid,text,text,integer[],uuid,integer,text)';
  v_owner   TEXT;
BEGIN
  IF to_regclass('public.bookings') IS NULL THEN
    RAISE EXCEPTION 'PRECONDITIONS FAILED for 0158: public.bookings is absent';
  END IF;

  IF to_regprocedure(v_guest) IS NULL THEN
    v_missing := v_missing || E'\n  - create_booking_with_financials is absent (apply 0153 first)';
  END IF;

  IF to_regprocedure(v_behalf) IS NULL THEN
    v_missing := v_missing || E'\n  - create_booking_on_behalf_with_financials is absent (apply 0157 first)';
  END IF;

  IF v_missing = '' THEN
    -- Both exist. They must be able to insert without the caller's privilege.
    IF NOT (SELECT p.prosecdef FROM pg_proc p WHERE p.oid = to_regprocedure(v_guest)) THEN
      v_missing := v_missing || E'\n  - create_booking_with_financials is not SECURITY DEFINER';
    END IF;
    IF NOT (SELECT p.prosecdef FROM pg_proc p WHERE p.oid = to_regprocedure(v_behalf)) THEN
      v_missing := v_missing || E'\n  - create_booking_on_behalf_with_financials is not SECURITY DEFINER';
    END IF;

    SELECT pg_get_userbyid(p.proowner) INTO v_owner FROM pg_proc p WHERE p.oid = to_regprocedure(v_guest);
    IF NOT has_table_privilege(v_owner, 'public.bookings', 'INSERT') THEN
      v_missing := v_missing || E'\n  - the definer owner ' || v_owner || ' cannot INSERT into public.bookings';
    END IF;

    SELECT pg_get_userbyid(p.proowner) INTO v_owner FROM pg_proc p WHERE p.oid = to_regprocedure(v_behalf);
    IF NOT has_table_privilege(v_owner, 'public.bookings', 'INSERT') THEN
      v_missing := v_missing || E'\n  - the definer owner ' || v_owner || ' cannot INSERT into public.bookings';
    END IF;

    -- FORCE ROW LEVEL SECURITY would subject the definer to the very policies
    -- this migration relies on it bypassing.
    IF (SELECT c.relforcerowsecurity FROM pg_class c WHERE c.oid = 'public.bookings'::regclass) THEN
      v_missing := v_missing || E'\n  - public.bookings is FORCE ROW LEVEL SECURITY; the definer RPCs would be subject to RLS';
    END IF;
  END IF;

  IF v_missing <> '' THEN
    RAISE EXCEPTION 'PRECONDITIONS FAILED for 0158:%', v_missing;
  END IF;
  RAISE NOTICE '0158 preconditions: OK';
END;
$pre$;

-- Baseline, so the verification below can prove that nothing OTHER than the
-- two INSERT privileges moved, rather than asserting hard-coded counts that
-- would rot the first time a policy is added.
CREATE TEMP TABLE _0158_baseline AS
SELECT
  (SELECT c.relacl::text FROM pg_class c WHERE c.oid = 'public.bookings'::regclass)        AS relacl,
  (SELECT string_agg(p.policyname || ':' || p.cmd, ',' ORDER BY p.policyname)
     FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = 'bookings')        AS policy_sig,
  (SELECT count(*) FROM pg_trigger t
    WHERE t.tgrelid = 'public.bookings'::regclass AND NOT t.tgisinternal)                  AS n_triggers,
  (SELECT count(*) FROM pg_attribute a
    WHERE a.attrelid = 'public.bookings'::regclass AND a.attnum > 0 AND NOT a.attisdropped) AS n_columns;

-- ===========================================================================
-- 2. THE REVOKE
-- ===========================================================================
--
-- REVOKE of a privilege that is not held is a no-op rather than an error, so
-- both statements are idempotent and the migration is safe to re-run.
--
-- PUBLIC holds nothing on this table today; the statement is there so the
-- privilege cannot re-enter through the one grantee that would apply to every
-- role at once.

REVOKE INSERT ON TABLE public.bookings FROM anon, authenticated;
REVOKE INSERT ON TABLE public.bookings FROM PUBLIC;

-- ===========================================================================
-- 3. VERIFICATION
-- ===========================================================================

DO $verify$
DECLARE
  v_fail TEXT := '';
  v_pass INTEGER := 0;
  v_t    TEXT;
  n      INTEGER;
  v_guest  CONSTANT TEXT := 'public.create_booking_with_financials(text,text,date,date,integer,text,integer[],uuid,integer,text)';
  v_behalf CONSTANT TEXT := 'public.create_booking_on_behalf_with_financials(text,text,date,date,integer,text,text,text,text,text,uuid,text,text,integer[],uuid,integer,text)';
BEGIN
  -- ── the door that is now shut ──────────────────────────────────────────
  IF has_table_privilege('anon', 'public.bookings', 'INSERT') THEN
    v_fail := v_fail || E'\n  - anon can still INSERT into public.bookings';
  ELSE v_pass := v_pass + 1; END IF;

  IF has_table_privilege('authenticated', 'public.bookings', 'INSERT') THEN
    v_fail := v_fail || E'\n  - authenticated can still INSERT into public.bookings';
  ELSE v_pass := v_pass + 1; END IF;

  -- PUBLIC: grantee 0 in the ACL. 'a' is the INSERT bit.
  SELECT count(*) INTO n FROM pg_class c, aclexplode(c.relacl) g
   WHERE c.oid = 'public.bookings'::regclass AND g.grantee = 0 AND g.privilege_type = 'INSERT';
  IF n <> 0 THEN
    v_fail := v_fail || E'\n  - PUBLIC still holds INSERT on public.bookings';
  ELSE v_pass := v_pass + 1; END IF;

  -- A column-level grant would survive a table-level revoke and reopen it.
  SELECT count(*) INTO n FROM pg_attribute a
   WHERE a.attrelid = 'public.bookings'::regclass AND a.attacl IS NOT NULL;
  IF n <> 0 THEN
    v_fail := v_fail || E'\n  - ' || n || ' column-level ACL(s) remain on public.bookings and may carry INSERT';
  ELSE v_pass := v_pass + 1; END IF;

  -- ── the doors that must stay open ──────────────────────────────────────
  IF NOT has_table_privilege('service_role', 'public.bookings', 'INSERT') THEN
    v_fail := v_fail || E'\n  - service_role lost INSERT on public.bookings';
  ELSE v_pass := v_pass + 1; END IF;

  SELECT pg_get_userbyid(c.relowner) INTO v_t FROM pg_class c WHERE c.oid = 'public.bookings'::regclass;
  IF NOT has_table_privilege(v_t, 'public.bookings', 'INSERT') THEN
    v_fail := v_fail || E'\n  - the table owner ' || v_t || ' lost INSERT on public.bookings';
  ELSE v_pass := v_pass + 1; END IF;

  -- ── everything else the two client roles could do, they still can ──────
  FOREACH v_t IN ARRAY ARRAY['SELECT', 'UPDATE', 'DELETE'] LOOP
    IF NOT has_table_privilege('anon', 'public.bookings', v_t) THEN
      v_fail := v_fail || E'\n  - anon lost ' || v_t || ' on public.bookings';
    ELSE v_pass := v_pass + 1; END IF;
    IF NOT has_table_privilege('authenticated', 'public.bookings', v_t) THEN
      v_fail := v_fail || E'\n  - authenticated lost ' || v_t || ' on public.bookings';
    ELSE v_pass := v_pass + 1; END IF;
  END LOOP;

  -- ── the replacement paths ──────────────────────────────────────────────
  IF to_regprocedure(v_guest) IS NULL
     OR NOT (SELECT p.prosecdef FROM pg_proc p WHERE p.oid = to_regprocedure(v_guest)) THEN
    v_fail := v_fail || E'\n  - create_booking_with_financials is missing or is no longer SECURITY DEFINER';
  ELSE v_pass := v_pass + 1; END IF;

  IF to_regprocedure(v_behalf) IS NULL
     OR NOT (SELECT p.prosecdef FROM pg_proc p WHERE p.oid = to_regprocedure(v_behalf)) THEN
    v_fail := v_fail || E'\n  - create_booking_on_behalf_with_financials is missing or is no longer SECURITY DEFINER';
  ELSE v_pass := v_pass + 1; END IF;

  -- The definer owners must still be able to do what the client no longer can.
  SELECT count(*) INTO n
    FROM pg_proc p
   WHERE p.oid IN (to_regprocedure(v_guest), to_regprocedure(v_behalf))
     AND NOT has_table_privilege(pg_get_userbyid(p.proowner), 'public.bookings', 'INSERT');
  IF n <> 0 THEN
    v_fail := v_fail || E'\n  - a definer owner can no longer INSERT into public.bookings: the RPCs are broken';
  ELSE v_pass := v_pass + 1; END IF;

  IF NOT has_function_privilege('authenticated', to_regprocedure(v_guest), 'EXECUTE') THEN
    v_fail := v_fail || E'\n  - authenticated cannot execute create_booking_with_financials';
  ELSE v_pass := v_pass + 1; END IF;

  IF NOT has_function_privilege('authenticated', to_regprocedure(v_behalf), 'EXECUTE') THEN
    v_fail := v_fail || E'\n  - authenticated cannot execute create_booking_on_behalf_with_financials';
  ELSE v_pass := v_pass + 1; END IF;

  IF has_function_privilege('anon', to_regprocedure(v_behalf), 'EXECUTE') THEN
    v_fail := v_fail || E'\n  - anon can execute create_booking_on_behalf_with_financials';
  ELSE v_pass := v_pass + 1; END IF;

  -- ── nothing else moved ─────────────────────────────────────────────────
  IF (SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = 'public.bookings'::regclass) IS NOT TRUE
     OR (SELECT c.relforcerowsecurity FROM pg_class c WHERE c.oid = 'public.bookings'::regclass) IS NOT FALSE THEN
    v_fail := v_fail || E'\n  - row-level security on public.bookings changed';
  ELSE v_pass := v_pass + 1; END IF;

  SELECT b.policy_sig INTO v_t FROM _0158_baseline b;
  IF v_t IS DISTINCT FROM (SELECT string_agg(p.policyname || ':' || p.cmd, ',' ORDER BY p.policyname)
                             FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = 'bookings') THEN
    v_fail := v_fail || E'\n  - the RLS policy set on public.bookings changed';
  ELSE v_pass := v_pass + 1; END IF;

  IF (SELECT b.n_triggers FROM _0158_baseline b)
     <> (SELECT count(*) FROM pg_trigger t
          WHERE t.tgrelid = 'public.bookings'::regclass AND NOT t.tgisinternal) THEN
    v_fail := v_fail || E'\n  - the trigger set on public.bookings changed';
  ELSE v_pass := v_pass + 1; END IF;

  IF (SELECT b.n_columns FROM _0158_baseline b)
     <> (SELECT count(*) FROM pg_attribute a
          WHERE a.attrelid = 'public.bookings'::regclass AND a.attnum > 0 AND NOT a.attisdropped) THEN
    v_fail := v_fail || E'\n  - the column set on public.bookings changed';
  ELSE v_pass := v_pass + 1; END IF;

  -- Nothing may have been GRANTED by this migration.
  SELECT count(*) INTO n FROM (
    SELECT g.grantee::regrole::text AS ro, g.privilege_type AS pr
      FROM pg_class c, aclexplode(c.relacl) g WHERE c.oid = 'public.bookings'::regclass
    EXCEPT
    SELECT g.grantee::regrole::text, g.privilege_type
      FROM _0158_baseline b, aclexplode(b.relacl::aclitem[]) g
  ) added;
  IF n <> 0 THEN
    v_fail := v_fail || E'\n  - 0158 GRANTED ' || n || ' privilege(s) it should not have';
  ELSE v_pass := v_pass + 1; END IF;

  -- And exactly two privileges may have been removed.
  SELECT string_agg(removed.ro || ':' || removed.pr, ',' ORDER BY removed.ro, removed.pr) INTO v_t FROM (
    SELECT g.grantee::regrole::text AS ro, g.privilege_type AS pr
      FROM _0158_baseline b, aclexplode(b.relacl::aclitem[]) g
    EXCEPT
    SELECT g.grantee::regrole::text, g.privilege_type
      FROM pg_class c, aclexplode(c.relacl) g WHERE c.oid = 'public.bookings'::regclass
  ) removed;
  IF COALESCE(v_t, '') <> 'anon:INSERT,authenticated:INSERT' THEN
    v_fail := v_fail || E'\n  - 0158 removed the wrong privileges: [' || COALESCE(v_t, '<none>') || ']';
  ELSE v_pass := v_pass + 1; END IF;

  IF v_fail <> '' THEN
    RAISE EXCEPTION '0158 VERIFICATION FAILED (% of 24 passed):%', v_pass, v_fail;
  END IF;
  IF v_pass <> 24 THEN
    RAISE EXCEPTION
      '0158 VERIFICATION INCOMPLETE: % assertions passed but 24 were expected - a check did not run',
      v_pass;
  END IF;
  RAISE NOTICE '0158 verification: 24 / 24 checks PASSED';
END;
$verify$;

DROP TABLE _0158_baseline;
