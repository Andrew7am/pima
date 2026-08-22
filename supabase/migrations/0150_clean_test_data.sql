-- ============================================================
-- 0150 — CLEAN TEST-DATA RESET
--
-- Empties the legacy/test booking and financial state so the new financial
-- core (0139..0149) starts from a provable zero, while preserving every
-- commercial term, every account, every house, every user identity, and the
-- entire audit trail.
--
-- This file is INERT by default. Applying it does nothing destructive unless
-- it is explicitly armed (see ARMING GATE below), so a migration runner that
-- replays the folder aborts here rather than silently wiping data.
--
-- Everything destructive runs inside ONE DO block. A DO block is a single
-- statement, so it is a single transaction: it either completes whole or
-- leaves the database exactly as it was, regardless of how the file is
-- applied (CLI, SQL editor, psql).
--
-- APPROVED SCOPE
--   users          points -> 0 and referral_bonus_awarded -> FALSE for ALL
--                  users. No user row is deleted; identity is preserved.
--   notifications  rows with booking_id IS NOT NULL are deleted — which is
--                  also what removes the invalid legacy empty-string rows.
--                  Rows with booking_id IS NULL are preserved, including
--                  notif_review_% (approved: left untouched).
--   bookings       DELETE WHERE id <> ''. Migration 068's payout trigger
--                  writes booking_id = '' into notifications, which the FK
--                  notifications_booking_id_fkey only permits if a booking
--                  with that id exists. No migration creates one; if one was
--                  ever hand-inserted it is infrastructure, not test data,
--                  and deleting it would break owner payout notifications.
--                  On a database with no such row the predicate matches
--                  every booking, so this is identical to an unqualified
--                  delete — safe either way, with no guess required.
--   preserved      financial_settings, house_agreements, promotions,
--                  fin_accounts, houses, users, audit_log.
--
-- WHY THIS ORDER
--   Every FK introduced by 0141..0148 is ON DELETE RESTRICT, so children must
--   go before parents. notifications is emptied FIRST, before bookings:
--   notifications.booking_id is ON DELETE SET NULL, so deleting bookings
--   first would erase the very link the WHERE clause depends on.
--
-- CASCADE CHILDREN
--   Deleting bookings also empties payments, attendees, room_allocations,
--   booking_messages, attendee_links, stay_pulse and conferences — every one
--   of them declares booking_id ... ON DELETE CASCADE, and not one has a
--   DELETE trigger, so it happens silently. They are named in the preflight
--   and re-checked afterwards rather than left to be discovered. Of the 14
--   FKs pointing at bookings(id), 7 are CASCADE, 3 are SET NULL and 4 are
--   RESTRICT; none is left to the blocking NO ACTION default, and all four
--   RESTRICT parents are emptied earlier in the sequence.
--
-- TRIGGERS
--   Only the eight append-only / immutability guards are disabled, and only
--   because each is BEFORE UPDATE OR DELETE and would abort its own delete.
--   Nothing else is touched: public.bookings has 17 triggers and not one
--   fires on DELETE; the fin_txn_balanced / fin_legs_balanced constraint
--   triggers are AFTER INSERT only; the owner_payouts audit triggers are
--   AFTER INSERT and AFTER UPDATE. Original enabled-state is captured from
--   pg_trigger, restored exactly, and verified before the block ends.
--
-- KNOWN, INTENDED SIDE EFFECT
--   Deleting reviews fires trg_recompute_house_rating (AFTER INSERT OR UPDATE
--   OR DELETE, SECURITY DEFINER), so houses.rating -> 0 and
--   houses.reviews_count -> 0. This is correct: those figures were derived
--   from test reviews. It is left enabled deliberately.
-- ============================================================

-- ============================================================
-- ARMING GATE
-- Change 'NO' to 'RESET' below to arm this migration.
-- Left as 'NO' it prints a full preflight of what WOULD be affected and what
-- must remain, then aborts without modifying a single row.
-- ============================================================
SELECT set_config('pima.reset_armed', 'NO', false);

DO $reset$
DECLARE
  -- The eight append-only / immutability guards, by name. Their tables are
  -- resolved from pg_trigger rather than hard-coded, so the mapping cannot
  -- drift from the catalogue.
  v_guards CONSTANT TEXT[] := ARRAY[
    'fin_transactions_append_only',
    'fin_legs_append_only',
    'owner_receivables_guard_trg',
    'owner_receivable_recoveries_append_only_trg',
    'booking_promotions_append_only_trg',
    'payout_bookings_append_only_trg',
    'settlement_holds_guard_trg',
    'booking_financials_no_change'
  ];

  -- Emptied IMPLICITLY when bookings are deleted: each of these declares
  -- booking_id ... REFERENCES bookings(id) ON DELETE CASCADE. None of them has
  -- a DELETE trigger, so the cascade is completely silent — which is exactly
  -- why the preflight names them and the verification re-checks them. They are
  -- not listed separately in the delete sequence because Postgres removes them
  -- as part of the booking delete itself.
  v_cascade CONSTANT TEXT[] := ARRAY[
    'payments','attendees','room_allocations','booking_messages',
    'attendee_links','stay_pulse','conferences'
  ];

  -- Every table the reset reads, writes, or must not touch.
  v_required CONSTANT TEXT[] := ARRAY[
    'users','houses','bookings','notifications','reviews','owner_payouts',
    'points_history','audit_log','financial_settings','house_agreements',
    'promotions','fin_accounts','fin_transactions','fin_transaction_legs',
    'booking_financials','settlement_holds','payout_bookings',
    'owner_receivables','owner_receivable_recoveries','booking_promotions',
    'booking_idempotency'
  ];

  r              RECORD;
  v_tbl          TEXT;
  v_missing      TEXT[] := '{}';
  v_fail         TEXT[] := '{}';
  v_trg_before   JSONB;
  v_trg_after    JSONB;
  v_keep_before  JSONB;
  v_keep_after   JSONB;
  v_found        INT;
  v_n            BIGINT;
  v_sentinel     BOOLEAN;
  v_audit_before BIGINT;
  v_audit_after  BIGINT;
BEGIN
  -- ----------------------------------------------------------
  -- 0. Schema preconditions
  -- ----------------------------------------------------------
  FOREACH v_tbl IN ARRAY (v_required || v_cascade) LOOP
    IF to_regclass('public.' || quote_ident(v_tbl)) IS NULL THEN
      v_missing := v_missing || v_tbl;
    END IF;
  END LOOP;

  IF array_length(v_missing, 1) > 0 THEN
    RAISE EXCEPTION
      E'0150 cannot run: missing table(s): %.\nApply migrations 0139..0149 first.',
      array_to_string(v_missing, ', ');
  END IF;

  -- ----------------------------------------------------------
  -- 1. PREFLIGHT — runs armed or not, so an unarmed apply is a dry run.
  --    NOTICEs are delivered even when the transaction later rolls back.
  -- ----------------------------------------------------------
  SELECT EXISTS (SELECT 1 FROM public.bookings WHERE id = '') INTO v_sentinel;
  SELECT count(*) FROM public.audit_log INTO v_audit_before;

  RAISE NOTICE '============================================================';
  RAISE NOTICE '0150 PREFLIGHT — armed = %', COALESCE(current_setting('pima.reset_armed', true), '<unset>');
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'WILL BE EMPTIED / RESET';

  SELECT count(*) FROM public.notifications WHERE booking_id IS NOT NULL INTO v_n;
  RAISE NOTICE '  notifications (booking_id IS NOT NULL) : %', v_n;
  SELECT count(*) FROM public.notifications WHERE booking_id = '' INTO v_n;
  RAISE NOTICE '    of which legacy empty-string rows    : %', v_n;
  SELECT count(*) FROM public.booking_idempotency         INTO v_n; RAISE NOTICE '  booking_idempotency                    : %', v_n;
  SELECT count(*) FROM public.booking_promotions          INTO v_n; RAISE NOTICE '  booking_promotions                     : %', v_n;
  SELECT count(*) FROM public.owner_receivable_recoveries INTO v_n; RAISE NOTICE '  owner_receivable_recoveries            : %', v_n;
  SELECT count(*) FROM public.owner_receivables           INTO v_n; RAISE NOTICE '  owner_receivables                      : %', v_n;
  SELECT count(*) FROM public.payout_bookings             INTO v_n; RAISE NOTICE '  payout_bookings                        : %', v_n;
  SELECT count(*) FROM public.settlement_holds            INTO v_n; RAISE NOTICE '  settlement_holds                       : %', v_n;
  SELECT count(*) FROM public.booking_financials          INTO v_n; RAISE NOTICE '  booking_financials                     : %', v_n;
  SELECT count(*) FROM public.fin_transaction_legs        INTO v_n; RAISE NOTICE '  fin_transaction_legs                   : %', v_n;
  SELECT count(*) FROM public.fin_transactions            INTO v_n; RAISE NOTICE '  fin_transactions                       : %', v_n;
  SELECT count(*) FROM public.points_history              INTO v_n; RAISE NOTICE '  points_history                         : %', v_n;
  SELECT count(*) FROM public.reviews                     INTO v_n; RAISE NOTICE '  reviews                                : %', v_n;
  SELECT count(*) FROM public.owner_payouts               INTO v_n; RAISE NOTICE '  owner_payouts                          : %', v_n;
  SELECT count(*) FROM public.bookings WHERE id <> ''     INTO v_n; RAISE NOTICE '  bookings (excluding the sentinel)      : %', v_n;
  RAISE NOTICE '  empty-string sentinel booking present  : %  (preserved)', v_sentinel;
  SELECT count(*) FROM public.users                       INTO v_n; RAISE NOTICE '  users to have loyalty state zeroed     : %  (NOT deleted)', v_n;
  SELECT COALESCE(SUM(points), 0) FROM public.users       INTO v_n; RAISE NOTICE '    total points to be written off       : %', v_n;

  RAISE NOTICE '------------------------------------------------------------';
  RAISE NOTICE 'EMPTIED IMPLICITLY BY THE BOOKING CASCADE (no DELETE trigger fires)';
  FOREACH v_tbl IN ARRAY v_cascade LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', v_tbl) INTO v_n;
    RAISE NOTICE '  % : %', rpad(v_tbl, 36), v_n;
  END LOOP;

  RAISE NOTICE '------------------------------------------------------------';
  RAISE NOTICE 'MUST REMAIN UNTOUCHED (counts re-checked after the reset)';
  SELECT jsonb_build_object(
    'financial_settings', (SELECT count(*) FROM public.financial_settings),
    'house_agreements',   (SELECT count(*) FROM public.house_agreements),
    'promotions',         (SELECT count(*) FROM public.promotions),
    'fin_accounts',       (SELECT count(*) FROM public.fin_accounts),
    'houses',             (SELECT count(*) FROM public.houses),
    'users',              (SELECT count(*) FROM public.users)
  ) INTO v_keep_before;

  FOREACH v_tbl IN ARRAY ARRAY['financial_settings','house_agreements','promotions',
                               'fin_accounts','houses','users'] LOOP
    RAISE NOTICE '  % : %', rpad(v_tbl, 36), (v_keep_before ->> v_tbl);
  END LOOP;
  RAISE NOTICE '  % : %', rpad('audit_log', 36), v_audit_before;
  SELECT count(*) FROM public.notifications WHERE booking_id IS NULL INTO v_n;
  RAISE NOTICE '  notifications (booking_id IS NULL)     : %', v_n;
  RAISE NOTICE '============================================================';

  -- ----------------------------------------------------------
  -- 2. ARMING GATE — nothing below this line runs unless armed.
  -- ----------------------------------------------------------
  IF current_setting('pima.reset_armed', true) IS DISTINCT FROM 'RESET' THEN
    RAISE EXCEPTION
      E'0150 is NOT ARMED — no data was modified.\nThe preflight above shows what a run would affect.\nTo arm: change set_config(''pima.reset_armed'', ''NO'', false) to ''RESET'' in this file.\nOnly ever arm it against a database you have confirmed is disposable.';
  END IF;

  RAISE NOTICE 'ARMED — executing reset.';

  -- ----------------------------------------------------------
  -- 3. Capture and disable the eight append-only guards.
  -- ----------------------------------------------------------
  SELECT jsonb_object_agg(c.relname || '.' || t.tgname, t.tgenabled), count(*)
    INTO v_trg_before, v_found
    FROM pg_trigger t
    JOIN pg_class     c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND NOT t.tgisinternal AND t.tgname = ANY(v_guards);

  IF v_found <> array_length(v_guards, 1) THEN
    RAISE EXCEPTION '0150 expected % append-only guards, found % — refusing to proceed.',
      array_length(v_guards, 1), v_found;
  END IF;

  FOR r IN
    SELECT c.relname AS tbl, t.tgname AS trg
      FROM pg_trigger t
      JOIN pg_class     c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND NOT t.tgisinternal AND t.tgname = ANY(v_guards)
  LOOP
    EXECUTE format('ALTER TABLE public.%I DISABLE TRIGGER %I', r.tbl, r.trg);
  END LOOP;
  RAISE NOTICE 'Disabled % append-only guard(s).', v_found;

  -- ----------------------------------------------------------
  -- 4. Notifications FIRST — before bookings, while the link still exists.
  --    booking_id = '' is NOT NULL, so the legacy payout rows are included.
  -- ----------------------------------------------------------
  DELETE FROM public.notifications WHERE booking_id IS NOT NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT; RAISE NOTICE 'notifications               deleted: %', v_n;

  -- ----------------------------------------------------------
  -- 5. Financial state, children before parents (all FKs are RESTRICT).
  -- ----------------------------------------------------------
  DELETE FROM public.booking_idempotency;
  GET DIAGNOSTICS v_n = ROW_COUNT; RAISE NOTICE 'booking_idempotency         deleted: %', v_n;
  DELETE FROM public.booking_promotions;
  GET DIAGNOSTICS v_n = ROW_COUNT; RAISE NOTICE 'booking_promotions          deleted: %', v_n;
  DELETE FROM public.owner_receivable_recoveries;
  GET DIAGNOSTICS v_n = ROW_COUNT; RAISE NOTICE 'owner_receivable_recoveries deleted: %', v_n;
  DELETE FROM public.owner_receivables;
  GET DIAGNOSTICS v_n = ROW_COUNT; RAISE NOTICE 'owner_receivables           deleted: %', v_n;
  DELETE FROM public.payout_bookings;
  GET DIAGNOSTICS v_n = ROW_COUNT; RAISE NOTICE 'payout_bookings             deleted: %', v_n;
  DELETE FROM public.settlement_holds;
  GET DIAGNOSTICS v_n = ROW_COUNT; RAISE NOTICE 'settlement_holds            deleted: %', v_n;
  DELETE FROM public.booking_financials;
  GET DIAGNOSTICS v_n = ROW_COUNT; RAISE NOTICE 'booking_financials          deleted: %', v_n;
  DELETE FROM public.fin_transaction_legs;
  GET DIAGNOSTICS v_n = ROW_COUNT; RAISE NOTICE 'fin_transaction_legs        deleted: %', v_n;
  DELETE FROM public.fin_transactions;
  GET DIAGNOSTICS v_n = ROW_COUNT; RAISE NOTICE 'fin_transactions            deleted: %', v_n;

  -- ----------------------------------------------------------
  -- 6. Legacy booking state.
  -- ----------------------------------------------------------
  DELETE FROM public.points_history;
  GET DIAGNOSTICS v_n = ROW_COUNT; RAISE NOTICE 'points_history              deleted: %', v_n;
  DELETE FROM public.reviews;
  GET DIAGNOSTICS v_n = ROW_COUNT; RAISE NOTICE 'reviews                     deleted: %  (house ratings recomputed to 0)', v_n;
  DELETE FROM public.owner_payouts;
  GET DIAGNOSTICS v_n = ROW_COUNT; RAISE NOTICE 'owner_payouts               deleted: %', v_n;
  DELETE FROM public.bookings WHERE id <> '';
  GET DIAGNOSTICS v_n = ROW_COUNT; RAISE NOTICE 'bookings                    deleted: %  (sentinel preserved: %)', v_n, v_sentinel;

  -- ----------------------------------------------------------
  -- 7. Loyalty state for ALL users. No user row is deleted.
  --    protect_user_privileged_columns (0017) reverts points only when
  --    current_user = 'authenticated'; a migration runs as the table owner,
  --    so this write lands. Verified in section 9 rather than assumed.
  -- ----------------------------------------------------------
  UPDATE public.users SET points = 0, referral_bonus_awarded = FALSE;
  GET DIAGNOSTICS v_n = ROW_COUNT; RAISE NOTICE 'users loyalty state reset  : % row(s)', v_n;

  -- ----------------------------------------------------------
  -- 8. Restore every guard to its ORIGINAL state, then verify.
  -- ----------------------------------------------------------
  FOR r IN
    SELECT c.relname AS tbl, t.tgname AS trg,
           (v_trg_before ->> (c.relname || '.' || t.tgname)) AS orig
      FROM pg_trigger t
      JOIN pg_class     c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND NOT t.tgisinternal AND t.tgname = ANY(v_guards)
  LOOP
    IF    r.orig = 'O' THEN EXECUTE format('ALTER TABLE public.%I ENABLE TRIGGER %I', r.tbl, r.trg);
    ELSIF r.orig = 'A' THEN EXECUTE format('ALTER TABLE public.%I ENABLE ALWAYS TRIGGER %I', r.tbl, r.trg);
    ELSIF r.orig = 'R' THEN EXECUTE format('ALTER TABLE public.%I ENABLE REPLICA TRIGGER %I', r.tbl, r.trg);
    -- 'D' was already disabled before this migration; leave it disabled.
    END IF;
  END LOOP;

  SELECT jsonb_object_agg(c.relname || '.' || t.tgname, t.tgenabled)
    INTO v_trg_after
    FROM pg_trigger t
    JOIN pg_class     c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND NOT t.tgisinternal AND t.tgname = ANY(v_guards);

  IF v_trg_after IS DISTINCT FROM v_trg_before THEN
    v_fail := v_fail || format('trigger state not restored: before=%s after=%s', v_trg_before, v_trg_after);
  ELSE
    RAISE NOTICE 'All % guard(s) restored to their original state.', v_found;
  END IF;

  -- ----------------------------------------------------------
  -- 9. POST-RESET VERIFICATION. Every invariant is checked; all failures are
  --    collected and reported together rather than stopping at the first.
  -- ----------------------------------------------------------
  IF (SELECT COALESCE(SUM(points), 0) FROM public.users) <> 0 THEN
    v_fail := v_fail || 'SUM(users.points) <> 0'; END IF;
  IF EXISTS (SELECT 1 FROM public.users WHERE referral_bonus_awarded IS DISTINCT FROM FALSE) THEN
    v_fail := v_fail || 'users.referral_bonus_awarded is not FALSE for every user'; END IF;

  IF (SELECT count(*) FROM public.points_history)              <> 0 THEN v_fail := v_fail || 'points_history not empty'; END IF;
  IF (SELECT count(*) FROM public.fin_transactions)            <> 0 THEN v_fail := v_fail || 'fin_transactions not empty'; END IF;
  IF (SELECT count(*) FROM public.fin_transaction_legs)        <> 0 THEN v_fail := v_fail || 'fin_transaction_legs not empty'; END IF;
  IF (SELECT count(*) FROM public.booking_financials)          <> 0 THEN v_fail := v_fail || 'booking_financials not empty'; END IF;
  IF (SELECT count(*) FROM public.settlement_holds)            <> 0 THEN v_fail := v_fail || 'settlement_holds not empty'; END IF;
  IF (SELECT count(*) FROM public.payout_bookings)             <> 0 THEN v_fail := v_fail || 'payout_bookings not empty'; END IF;
  IF (SELECT count(*) FROM public.owner_receivables)           <> 0 THEN v_fail := v_fail || 'owner_receivables not empty'; END IF;
  IF (SELECT count(*) FROM public.owner_receivable_recoveries) <> 0 THEN v_fail := v_fail || 'owner_receivable_recoveries not empty'; END IF;
  IF (SELECT count(*) FROM public.booking_promotions)          <> 0 THEN v_fail := v_fail || 'booking_promotions not empty'; END IF;
  IF (SELECT count(*) FROM public.booking_idempotency)         <> 0 THEN v_fail := v_fail || 'booking_idempotency not empty'; END IF;
  IF (SELECT count(*) FROM public.reviews)                     <> 0 THEN v_fail := v_fail || 'reviews not empty'; END IF;
  IF (SELECT count(*) FROM public.owner_payouts)               <> 0 THEN v_fail := v_fail || 'owner_payouts not empty'; END IF;
  IF (SELECT count(*) FROM public.bookings WHERE id <> '')     <> 0 THEN v_fail := v_fail || 'bookings other than the sentinel remain'; END IF;

  IF (SELECT count(*) FROM public.notifications WHERE booking_id IS NOT NULL) <> 0 THEN
    v_fail := v_fail || 'notifications with a non-null booking_id remain'; END IF;

  -- The cascade children must be gone too. Anything left can only belong to
  -- the preserved empty-string booking, so that is the one id excluded.
  FOREACH v_tbl IN ARRAY v_cascade LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE booking_id <> %L', v_tbl, '') INTO v_n;
    IF v_n <> 0 THEN
      v_fail := v_fail || format('%s still holds %s row(s) after the booking cascade', v_tbl, v_n);
    END IF;
  END LOOP;

  -- The sentinel, if it was there before, must still be there.
  IF v_sentinel AND NOT EXISTS (SELECT 1 FROM public.bookings WHERE id = '') THEN
    v_fail := v_fail || 'the empty-string sentinel booking was deleted'; END IF;

  -- Preserved tables must come out of this EXACTLY as they went in. Comparing
  -- against the preflight snapshot is the real invariant, and it is strictly
  -- stronger than a "> 0" test: it also catches a partial deletion, and it
  -- cannot raise a false failure on a table that is legitimately empty.
  -- house_agreements and promotions ARE legitimately empty on a fresh install:
  -- 0140 and 0147 create those tables but seed no rows, because agreements and
  -- promotions are commercial records an admin enters later.
  SELECT jsonb_build_object(
    'financial_settings', (SELECT count(*) FROM public.financial_settings),
    'house_agreements',   (SELECT count(*) FROM public.house_agreements),
    'promotions',         (SELECT count(*) FROM public.promotions),
    'fin_accounts',       (SELECT count(*) FROM public.fin_accounts),
    'houses',             (SELECT count(*) FROM public.houses),
    'users',              (SELECT count(*) FROM public.users)
  ) INTO v_keep_after;

  FOREACH v_tbl IN ARRAY ARRAY['financial_settings','house_agreements','promotions',
                               'fin_accounts','houses','users'] LOOP
    IF (v_keep_after ->> v_tbl) IS DISTINCT FROM (v_keep_before ->> v_tbl) THEN
      v_fail := v_fail || format('%s changed from %s to %s row(s) — it must be preserved',
        v_tbl, v_keep_before ->> v_tbl, v_keep_after ->> v_tbl);
    END IF;
  END LOOP;

  -- These two are seeded by their own migrations (0139, 0141), so an empty
  -- table here means the migration chain itself is broken, not that the reset
  -- misbehaved.
  IF (v_keep_after ->> 'financial_settings')::BIGINT = 0 THEN
    v_fail := v_fail || 'financial_settings is empty — 0139 did not seed'; END IF;
  IF (v_keep_after ->> 'fin_accounts')::BIGINT = 0 THEN
    v_fail := v_fail || 'fin_accounts is empty — 0141 did not seed'; END IF;

  -- Audit history may only ever grow. Losing a row is the failure to catch.
  SELECT count(*) FROM public.audit_log INTO v_audit_after;
  IF v_audit_after < v_audit_before THEN
    v_fail := v_fail || format('audit_log lost rows: %s -> %s', v_audit_before, v_audit_after); END IF;

  -- Ledger invariants. Both tables are empty, so both must be exactly zero.
  IF (SELECT COALESCE(SUM(amount), 0) FROM public.fin_transaction_legs
       WHERE account = 'POINTS_LIABILITY') <> 0 THEN
    v_fail := v_fail || 'SUM(POINTS_LIABILITY) <> 0'; END IF;
  IF (SELECT COALESCE(SUM(amount), 0) FROM public.fin_transaction_legs) <> 0 THEN
    v_fail := v_fail || 'ledger is not globally balanced'; END IF;

  -- The invariant this whole rebuild rests on, now trivially satisfiable.
  IF (SELECT COALESCE(SUM(points), 0) FROM public.users) <> 0
     OR (SELECT COALESCE(SUM(amount), 0) FROM public.fin_transaction_legs
          WHERE account = 'POINTS_LIABILITY') <> 0 THEN
    v_fail := v_fail || 'points invariant does not start clean'; END IF;

  IF array_length(v_fail, 1) > 0 THEN
    RAISE EXCEPTION E'0150 POST-RESET VERIFICATION FAILED (rolled back):\n  - %',
      array_to_string(v_fail, E'\n  - ');
  END IF;

  RAISE NOTICE '============================================================';
  RAISE NOTICE '0150 COMPLETE — every post-reset invariant passed.';
  RAISE NOTICE '  audit_log preserved: % row(s)', v_audit_after;
  RAISE NOTICE '  sentinel booking preserved: %', v_sentinel;
  RAISE NOTICE '============================================================';
END
$reset$;
