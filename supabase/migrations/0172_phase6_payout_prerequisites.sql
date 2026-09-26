-- 0172_phase6_payout_prerequisites.sql
--
-- THE SCHEMA A SERVER-SIDE PAYOUT NEEDS, AND THE DOOR THAT HAS TO CLOSE
-- IN THE SAME MIGRATION THAT OPENS IT.
--
-- WHY
-- ---
-- Phase 6 moves owner settlement onto a server-side path:
--
--     CLIENT -> SECURITY DEFINER RPC -> owner_payouts -> payout_bookings
--                                                     -> fin_transactions / legs
--
-- Before any of that can be written, public.owner_payouts is missing three
-- columns that the payout RPC is specified to populate: the account the money
-- left from, the bank/wallet reference that answers an owner disputing a
-- transfer six months later, and the admin who completed it.
--
-- Those three columns were written once already, in
-- 0121_money_leaving_leaves_a_trace.sql. The forensic audit of 0121 established
-- that NONE of that migration was ever applied to production: the columns are
-- absent, audit_payout_created() does not exist, trg_audit_payout_created does
-- not exist, payments_accounting does not exist, and record_refund in
-- production is still 0114's body (normalised md5 dc75fa11211f43af4ece1c189c80922d).
--
-- 0121 is NOT replayed here. It carries eight further objects, two of which are
-- unrelated to payouts and one of which is actively unwanted:
--
--   * record_refund(TEXT,NUMERIC,TEXT,TEXT) - 0121 silently changes it from
--     overwrite to accumulate and changes its error code. Refunds get an
--     explicit, auditable event model later in Phase 6 instead.
--   * payments_accounting - a plain view over public.payments granted to
--     authenticated. A plain view runs with its owner's rights and does not
--     inherit the RLS of public.payments, so that grant would expose every
--     payment row to every signed-in account. It has zero consumers in src/.
--     It is not created here and should not be created.
--   * audit_payout_created() + trg_audit_payout_created - writes audit_log
--     actions ('payout_paid', 'payout_requested') that the admin UI has no
--     Arabic label for and excludes from its money filter. Deferred until the
--     payout RPC exists and the labels are added with it.
--
-- THE DOOR
-- --------
-- Adding the three columns on its own would be a net LOSS of accounting
-- integrity, and that is why the policy change below ships in the same file.
--
-- src/lib/db.ts settleBookingsPayout() INSERTs a completed owner_payouts row
-- directly from the browser, carrying transaction_reference and
-- paid_from_account. Because those columns do not exist, that INSERT currently
-- fails in production with 42703 - the admin "settle bookings" path is dead
-- today. Adding the columns would revive it, and what it revives is a payout
-- that writes NO payout_bookings linkage and NO ledger transaction, sized by a
-- client-side control:
--
--     src/components/owner/OwnerFinancialCenter.tsx:283
--       Math.min(payableTotals.total, depositReceived) - claimedByPayouts
--
-- That is precisely the arrangement Phase 6 exists to replace. So the RLS
-- policy that admits that INSERT is dropped here:
--
--     owner_payouts_insert_admin  FOR INSERT TO authenticated
--                                 WITH CHECK (is_admin(auth.uid()))
--
-- Dropping it regresses nothing, because the only code path that used it is
-- already failing. After this migration a completed payout can be written only
-- by the table owner - which is what a SECURITY DEFINER RPC runs as.
-- public.owner_payouts is owned by postgres and does NOT have FORCE ROW LEVEL
-- SECURITY, so the Phase 6 RPC bypasses these policies by construction.
--
-- WHAT IS DELIBERATELY LEFT OPEN
-- ------------------------------
-- Two client write paths survive this migration, both live in production:
--
--   1. owner_payouts_insert_owner - an owner requesting a transfer
--      (App.tsx:1224 -> db.ts createPayout). status is forced to 'pending' by
--      the policy. A request is not a money movement and not an accounting
--      event, so it is not a trusted accounting path to begin with.
--
--   2. owner_payouts_update_admin - an admin advancing a request
--      (App.tsx:925 -> db.ts updatePayoutStatus, which writes status and
--      completed_at). Moving a row to 'completed' IS a money movement, so this
--      policy must eventually go. It is NOT closed here: doing so would break a
--      working admin screen with no server-side replacement yet, and the brief
--      for this phase is explicit that the existing production frontend must
--      keep working. It closes in the same migration that introduces
--      fin_create_owner_payout, alongside the frontend change.
--
-- Anonymous access is removed outright. public.owner_payouts still carries
-- INSERT, SELECT, UPDATE, DELETE and MAINTAIN for anon. No policy on the table
-- can be satisfied by anon - every one of them tests auth.uid() or
-- is_admin(auth.uid()), both NULL/false for an unauthenticated request - so the
-- revoke is provably behaviour-preserving and removes an anonymous write grant
-- on a financial table. DELETE is revoked from authenticated on the same
-- footing: the table has no DELETE policy at all, so the grant has never been
-- usable.
--
-- NOT CHANGED BY THIS MIGRATION
-- -----------------------------
--   * No pricing, no agreement resolution, no booking_financials snapshot.
--   * No fin_* function, no hold formula, no transfer fee, no deposit rate.
--   * No existing row is read, written, repriced or deleted.
--   * No trigger on owner_payouts is added, dropped or altered.
--   * No ledger posting. This migration posts nothing and creates no RPC.
--
-- IDEMPOTENT. Every statement is ADD COLUMN IF NOT EXISTS, COMMENT ON, REVOKE
-- (a no-op when the privilege is not held) or DROP POLICY IF EXISTS. The
-- verification block below is written to pass on a re-run as well as a first
-- run.

-- ===========================================================================
-- 1. PRECONDITIONS AND BASELINE
-- ===========================================================================
--
-- Anything this migration must not change is measured here, before it changes
-- anything, and compared against in section 5. Nothing is hardcoded: the
-- Financial Core signature is a hash of the live function bodies at the moment
-- this file starts, so section 5 proves THIS migration altered none of them.

DO $pre$
DECLARE
  v_missing TEXT := '';
BEGIN
  IF to_regclass('public.owner_payouts') IS NULL THEN
    v_missing := v_missing || E'\n  - public.owner_payouts does not exist';
  END IF;
  IF to_regclass('public.users') IS NULL THEN
    v_missing := v_missing || E'\n  - public.users does not exist (completed_by references it)';
  END IF;
  IF to_regprocedure('public.is_admin(uuid)') IS NULL THEN
    v_missing := v_missing || E'\n  - public.is_admin(uuid) does not exist';
  END IF;
  IF (SELECT c.relrowsecurity FROM pg_class c
       WHERE c.oid = 'public.owner_payouts'::regclass) IS NOT TRUE THEN
    v_missing := v_missing || E'\n  - row-level security is not enabled on public.owner_payouts';
  END IF;
  IF (SELECT pg_get_userbyid(c.relowner) FROM pg_class c
       WHERE c.oid = 'public.owner_payouts'::regclass)
     <> (SELECT pg_get_userbyid(c.relowner) FROM pg_class c
          WHERE c.oid = 'public.bookings'::regclass) THEN
    v_missing := v_missing || E'\n  - public.owner_payouts and public.bookings have different owners';
  END IF;
  IF v_missing <> '' THEN
    RAISE EXCEPTION '0172 PRECONDITIONS NOT MET:%', v_missing;
  END IF;
END;
$pre$;

CREATE TEMP TABLE _0172_baseline AS
SELECT
  (SELECT c.relacl::text FROM pg_class c
    WHERE c.oid = 'public.owner_payouts'::regclass)                                    AS relacl,
  -- Captured with the one policy this migration drops already excluded, so
  -- section 5 can compare the surviving set literally. A policy expression may
  -- itself contain newlines (owner_payouts_insert_owner does), so the signature
  -- must never be reassembled by splitting it.
  (SELECT string_agg(p.policyname || ':' || p.cmd || ':' ||
                     COALESCE(p.qual, '-') || ':' || COALESCE(p.with_check, '-'),
                     E'\n' ORDER BY p.policyname)
     FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = 'owner_payouts'
      AND p.policyname <> 'owner_payouts_insert_admin')                                AS policy_sig_keep,
  (SELECT string_agg(t.tgname, ',' ORDER BY t.tgname)
     FROM pg_trigger t
    WHERE t.tgrelid = 'public.owner_payouts'::regclass AND NOT t.tgisinternal)         AS trigger_sig,
  (SELECT count(*) FROM pg_attribute a
    WHERE a.attrelid = 'public.owner_payouts'::regclass
      AND a.attnum > 0 AND NOT a.attisdropped)                                         AS n_columns,
  (SELECT count(*) FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'owner_payouts'
      AND column_name IN ('paid_from_account', 'transaction_reference', 'completed_by')) AS n_target_cols,
  (SELECT count(*) FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'owner_payouts'
      AND column_name = 'completed_by')                                                AS had_completed_by,
  (SELECT count(*) FROM public.owner_payouts)                                          AS n_rows,
  (SELECT count(*) FROM pg_constraint
    WHERE conrelid = 'public.owner_payouts'::regclass AND contype = 'f')               AS n_fkeys,
  (SELECT md5(string_agg(p.prosrc, '|' ORDER BY p.oid))
     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('fin_price_booking', 'fin_quote_booking',
                        'create_booking_with_financials',
                        'create_booking_on_behalf_with_financials',
                        'payout_bookings_validate', 'fin_house_customer_rates',
                        'fin_client_settings'))                                        AS core_sig,
  (SELECT count(*) FROM pg_class c, aclexplode(c.relacl) g
    WHERE c.oid = 'public.owner_payouts'::regclass
      AND g.grantee = 'authenticated'::regrole AND g.privilege_type = 'DELETE')        AS auth_had_delete;

-- ===========================================================================
-- 2. THE THREE COLUMNS
-- ===========================================================================
--
-- Identical in name, type and nullability to 0121 section 1, so that a database
-- which somehow received 0121 and a database which receives 0172 end up with
-- the same shape. All three are nullable with no default: every existing row
-- predates the data they hold, and inventing a value for a historical transfer
-- would be a fabricated financial record.

ALTER TABLE public.owner_payouts ADD COLUMN IF NOT EXISTS paid_from_account      TEXT;
ALTER TABLE public.owner_payouts ADD COLUMN IF NOT EXISTS transaction_reference  TEXT;
ALTER TABLE public.owner_payouts ADD COLUMN IF NOT EXISTS completed_by           UUID
  REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.owner_payouts.paid_from_account IS
  'Which PIMA account the transfer left from. Set by the Phase 6 payout RPC; NULL on every payout recorded before it existed.';
COMMENT ON COLUMN public.owner_payouts.transaction_reference IS
  'The bank or wallet reference for the outgoing transfer - the evidence that answers an owner disputing a payment months later. Set by the Phase 6 payout RPC; NULL on every payout recorded before it existed.';
COMMENT ON COLUMN public.owner_payouts.completed_by IS
  'The admin who completed the transfer. ON DELETE SET NULL: removing a staff account must never remove the payout record.';

-- ===========================================================================
-- 3. GRANTS
-- ===========================================================================
--
-- REVOKE of a privilege that is not held is a no-op rather than an error, so
-- all three statements are idempotent.
--
-- anon: every policy on this table tests auth.uid() or is_admin(auth.uid()),
-- so an unauthenticated request satisfies none of them and holds no reachable
-- capability today. The grants are removed so a future policy cannot
-- accidentally hand an unauthenticated caller a financial write.
--
-- authenticated: DELETE only. There is no DELETE policy on this table, so the
-- privilege has never been usable. SELECT, INSERT and UPDATE are deliberately
-- retained - see the header.
--
-- PUBLIC holds nothing here; the statement is there so a privilege cannot
-- re-enter through the one grantee that applies to every role at once.

REVOKE ALL    ON TABLE public.owner_payouts FROM anon;
REVOKE DELETE ON TABLE public.owner_payouts FROM authenticated;
REVOKE ALL    ON TABLE public.owner_payouts FROM PUBLIC;

-- ===========================================================================
-- 4. THE ADMIN INSERT POLICY
-- ===========================================================================
--
-- Dropped, not narrowed: there is no remaining client that should INSERT a
-- payout row as an admin. Recorded verbatim so it is restorable:
--
--     CREATE POLICY owner_payouts_insert_admin ON public.owner_payouts
--       FOR INSERT TO authenticated
--       WITH CHECK (is_admin(auth.uid()));
--
-- introduced by 0068_per_booking_payouts.sql. After this statement the only INSERT
-- admitted from a client is owner_payouts_insert_owner, which forces
-- status = 'pending' and the owner's own house, and the only INSERT admitted at
-- all for a completed payout is one made by the table owner - i.e. a SECURITY
-- DEFINER RPC.

DROP POLICY IF EXISTS owner_payouts_insert_admin ON public.owner_payouts;

-- ===========================================================================
-- 5. VERIFICATION
-- ===========================================================================

DO $verify$
DECLARE
  v_fail TEXT := '';
  v_pass INTEGER := 0;
  v_t    TEXT;
  n      INTEGER;
  b      _0172_baseline%ROWTYPE;
BEGIN
  SELECT * INTO b FROM _0172_baseline;

  -- == the three columns ==================================================
  FOREACH v_t IN ARRAY ARRAY['paid_from_account', 'transaction_reference'] LOOP
    SELECT count(*) INTO n FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'owner_payouts'
       AND column_name = v_t AND data_type = 'text' AND is_nullable = 'YES'
       AND column_default IS NULL;
    IF n <> 1 THEN
      v_fail := v_fail || E'\n  - owner_payouts.' || v_t || ' is missing or is not a nullable TEXT with no default';
    ELSE v_pass := v_pass + 1; END IF;
  END LOOP;

  SELECT count(*) INTO n FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'owner_payouts'
     AND column_name = 'completed_by' AND data_type = 'uuid' AND is_nullable = 'YES'
     AND column_default IS NULL;
  IF n <> 1 THEN
    v_fail := v_fail || E'\n  - owner_payouts.completed_by is missing or is not a nullable UUID with no default';
  ELSE v_pass := v_pass + 1; END IF;

  -- The foreign key, including its delete action: a removed staff account must
  -- blank the stamp, never cascade away the payout.
  SELECT count(*) INTO n FROM pg_constraint
   WHERE conrelid = 'public.owner_payouts'::regclass AND contype = 'f'
     AND confrelid = 'public.users'::regclass AND confdeltype = 'n'
     AND pg_get_constraintdef(oid) LIKE '%(completed_by)%';
  IF n <> 1 THEN
    v_fail := v_fail || E'\n  - the completed_by -> users(id) ON DELETE SET NULL foreign key is missing';
  ELSE v_pass := v_pass + 1; END IF;

  SELECT count(*) INTO n FROM pg_description d
    JOIN pg_attribute a ON a.attrelid = d.objoid AND a.attnum = d.objsubid
   WHERE d.objoid = 'public.owner_payouts'::regclass
     AND a.attname IN ('paid_from_account', 'transaction_reference', 'completed_by');
  IF n <> 3 THEN
    v_fail := v_fail || E'\n  - expected 3 column comments on the new columns, found ' || n;
  ELSE v_pass := v_pass + 1; END IF;

  -- Exactly three columns were added and nothing else moved.
  IF (SELECT count(*) FROM pg_attribute a
       WHERE a.attrelid = 'public.owner_payouts'::regclass
         AND a.attnum > 0 AND NOT a.attisdropped)
     <> b.n_columns + (3 - b.n_target_cols) THEN
    v_fail := v_fail || E'\n  - the column count on public.owner_payouts did not move by exactly the columns added';
  ELSE v_pass := v_pass + 1; END IF;

  IF (SELECT count(*) FROM pg_constraint
       WHERE conrelid = 'public.owner_payouts'::regclass AND contype = 'f')
     <> b.n_fkeys + (CASE WHEN b.had_completed_by = 1 THEN 0 ELSE 1 END) THEN
    v_fail := v_fail || E'\n  - the foreign key count on public.owner_payouts moved unexpectedly';
  ELSE v_pass := v_pass + 1; END IF;

  -- == the doors that are now shut ========================================
  SELECT count(*) INTO n FROM pg_class c, aclexplode(c.relacl) g
   WHERE c.oid = 'public.owner_payouts'::regclass AND g.grantee = 'anon'::regrole;
  IF n <> 0 THEN
    v_fail := v_fail || E'\n  - anon still holds ' || n || ' privilege(s) on public.owner_payouts';
  ELSE v_pass := v_pass + 1; END IF;

  IF has_table_privilege('authenticated', 'public.owner_payouts', 'DELETE') THEN
    v_fail := v_fail || E'\n  - authenticated can still DELETE from public.owner_payouts';
  ELSE v_pass := v_pass + 1; END IF;

  SELECT count(*) INTO n FROM pg_class c, aclexplode(c.relacl) g
   WHERE c.oid = 'public.owner_payouts'::regclass AND g.grantee = 0;
  IF n <> 0 THEN
    v_fail := v_fail || E'\n  - PUBLIC still holds ' || n || ' privilege(s) on public.owner_payouts';
  ELSE v_pass := v_pass + 1; END IF;

  -- A column-level grant survives a table-level revoke and would reopen it.
  SELECT count(*) INTO n FROM pg_attribute a
   WHERE a.attrelid = 'public.owner_payouts'::regclass AND a.attacl IS NOT NULL;
  IF n <> 0 THEN
    v_fail := v_fail || E'\n  - ' || n || ' column-level ACL(s) remain on public.owner_payouts';
  ELSE v_pass := v_pass + 1; END IF;

  IF EXISTS (SELECT 1 FROM pg_policies
              WHERE schemaname = 'public' AND tablename = 'owner_payouts'
                AND policyname = 'owner_payouts_insert_admin') THEN
    v_fail := v_fail || E'\n  - owner_payouts_insert_admin still exists';
  ELSE v_pass := v_pass + 1; END IF;

  -- == the doors that must stay open ======================================
  FOREACH v_t IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE'] LOOP
    IF NOT has_table_privilege('authenticated', 'public.owner_payouts', v_t) THEN
      v_fail := v_fail || E'\n  - authenticated lost ' || v_t || ' on public.owner_payouts';
    ELSE v_pass := v_pass + 1; END IF;
  END LOOP;

  FOREACH v_t IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE'] LOOP
    IF NOT has_table_privilege('service_role', 'public.owner_payouts', v_t) THEN
      v_fail := v_fail || E'\n  - service_role lost ' || v_t || ' on public.owner_payouts';
    ELSE v_pass := v_pass + 1; END IF;
  END LOOP;

  SELECT pg_get_userbyid(c.relowner) INTO v_t FROM pg_class c
   WHERE c.oid = 'public.owner_payouts'::regclass;
  IF NOT has_table_privilege(v_t, 'public.owner_payouts', 'INSERT') THEN
    v_fail := v_fail || E'\n  - the table owner ' || v_t || ' lost INSERT: a definer RPC could not write a payout';
  ELSE v_pass := v_pass + 1; END IF;

  -- The owner's own transfer request, and the admin status update, both still
  -- live in the production frontend. Neither may have been touched.
  SELECT count(*) INTO n FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'owner_payouts'
     AND policyname IN ('owner_payouts_insert_owner', 'owner_payouts_select_owner_admin',
                        'owner_payouts_update_admin');
  IF n <> 3 THEN
    v_fail := v_fail || E'\n  - expected the 3 surviving policies on owner_payouts, found ' || n;
  ELSE v_pass := v_pass + 1; END IF;

  -- and their command, USING and WITH CHECK text are identical to the baseline.
  SELECT string_agg(p.policyname || ':' || p.cmd || ':' ||
                    COALESCE(p.qual, '-') || ':' || COALESCE(p.with_check, '-'),
                    E'\n' ORDER BY p.policyname) INTO v_t
    FROM pg_policies p
   WHERE p.schemaname = 'public' AND p.tablename = 'owner_payouts';
  IF v_t IS DISTINCT FROM b.policy_sig_keep THEN
    v_fail := v_fail || E'\n  - a surviving RLS policy on public.owner_payouts was altered';
  ELSE v_pass := v_pass + 1; END IF;

  -- == nothing else moved =================================================
  IF (SELECT c.relrowsecurity FROM pg_class c
       WHERE c.oid = 'public.owner_payouts'::regclass) IS NOT TRUE
     OR (SELECT c.relforcerowsecurity FROM pg_class c
          WHERE c.oid = 'public.owner_payouts'::regclass) IS NOT FALSE THEN
    v_fail := v_fail || E'\n  - row-level security on public.owner_payouts changed';
  ELSE v_pass := v_pass + 1; END IF;

  IF b.trigger_sig IS DISTINCT FROM (
       SELECT string_agg(t.tgname, ',' ORDER BY t.tgname) FROM pg_trigger t
        WHERE t.tgrelid = 'public.owner_payouts'::regclass AND NOT t.tgisinternal) THEN
    v_fail := v_fail || E'\n  - the trigger set on public.owner_payouts changed';
  ELSE v_pass := v_pass + 1; END IF;

  IF b.n_rows <> (SELECT count(*) FROM public.owner_payouts) THEN
    v_fail := v_fail || E'\n  - the row count of public.owner_payouts changed';
  ELSE v_pass := v_pass + 1; END IF;

  -- No Financial Core function body was touched by this migration.
  IF b.core_sig IS DISTINCT FROM (
       SELECT md5(string_agg(p.prosrc, '|' ORDER BY p.oid))
         FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname IN ('fin_price_booking', 'fin_quote_booking',
                            'create_booking_with_financials',
                            'create_booking_on_behalf_with_financials',
                            'payout_bookings_validate', 'fin_house_customer_rates',
                            'fin_client_settings')) THEN
    v_fail := v_fail || E'\n  - a Financial Core function body changed';
  ELSE v_pass := v_pass + 1; END IF;

  -- None of the objects this migration explicitly refuses to create exist.
  IF to_regclass('public.payments_accounting') IS NOT NULL THEN
    v_fail := v_fail || E'\n  - payments_accounting exists: 0121 was replayed, which this migration forbids';
  ELSE v_pass := v_pass + 1; END IF;

  IF to_regprocedure('public.audit_payout_created()') IS NOT NULL THEN
    v_fail := v_fail || E'\n  - audit_payout_created() exists: 0121 was replayed, which this migration forbids';
  ELSE v_pass := v_pass + 1; END IF;

  -- record_refund must still be the body production is running.
  IF (SELECT p.prosrc LIKE '%v_already%' FROM pg_proc p
       WHERE p.oid = to_regprocedure('public.record_refund(text,numeric,text,text)')) THEN
    v_fail := v_fail || E'\n  - record_refund was replaced with 0121''s accumulating body';
  ELSE v_pass := v_pass + 1; END IF;

  -- == the ACL moved in one direction only ================================
  SELECT count(*) INTO n FROM (
    SELECT g.grantee::regrole::text AS ro, g.privilege_type AS pr
      FROM pg_class c, aclexplode(c.relacl) g WHERE c.oid = 'public.owner_payouts'::regclass
    EXCEPT
    SELECT g.grantee::regrole::text, g.privilege_type
      FROM _0172_baseline bb, aclexplode(bb.relacl::aclitem[]) g
  ) added;
  IF n <> 0 THEN
    v_fail := v_fail || E'\n  - 0172 GRANTED ' || n || ' privilege(s) it should not have';
  ELSE v_pass := v_pass + 1; END IF;

  -- authenticated may have lost DELETE and nothing else. On a re-run it has
  -- already lost it, so an empty set is equally correct.
  SELECT string_agg(removed.pr, ',' ORDER BY removed.pr) INTO v_t FROM (
    SELECT g.privilege_type AS pr
      FROM _0172_baseline bb, aclexplode(bb.relacl::aclitem[]) g
     WHERE g.grantee = 'authenticated'::regrole
    EXCEPT
    SELECT g.privilege_type
      FROM pg_class c, aclexplode(c.relacl) g
     WHERE c.oid = 'public.owner_payouts'::regclass AND g.grantee = 'authenticated'::regrole
  ) removed;
  IF COALESCE(v_t, '') NOT IN ('DELETE', '') THEN
    v_fail := v_fail || E'\n  - 0172 removed the wrong privileges from authenticated: [' || v_t || ']';
  ELSIF COALESCE(v_t, '') = '' AND b.auth_had_delete <> 0 THEN
    v_fail := v_fail || E'\n  - authenticated held DELETE at baseline and still holds it';
  ELSE v_pass := v_pass + 1; END IF;

  IF v_fail <> '' THEN
    RAISE EXCEPTION '0172 VERIFICATION FAILED (% of 31 passed):%', v_pass, v_fail;
  END IF;
  IF v_pass <> 31 THEN
    RAISE EXCEPTION
      '0172 VERIFICATION INCOMPLETE: % assertions passed but 31 were expected - a check did not run',
      v_pass;
  END IF;
  RAISE NOTICE '0172 verification: 31 / 31 checks PASSED';
END;
$verify$;

DROP TABLE _0172_baseline;
