-- 0169_booking_identity_backfill.sql
--
-- What create_booking_with_financials does not carry, and how the cutover
-- keeps it without a second booking path.
--
-- WHY
-- ---
-- create_booking_with_financials inserts fourteen columns. The legacy client
-- insert wrote twenty-three. The nine it does not carry are:
--
--   user_phone, user_email, user_role, organization_name   identity/contact
--   is_large_conference_quote, conference_details          per-booking intent
--   source, created_at                                     have correct defaults
--   owner_notes                                            owner-written, later
--
-- Every one of them has a safe default, so the insert succeeds — which is the
-- danger. `user_phone` and `user_email` default to the empty string, so a
-- booking created through the financial core would reach the owner with no way
-- to contact the guest, silently. The privacy policy promises the guest's phone
-- becomes visible to the owner once the booking is approved; an empty string
-- keeps that promise in form and breaks it in substance.
--
-- Its signature is fixed for this phase, so the fields cannot simply be added
-- as parameters. They are recovered two different ways, because they are two
-- different kinds of data.
--
-- 1. IDENTITY AND CONTACT — derivable, therefore a trigger.
--    name, phone, email, role and organisation all already exist on
--    public.users. A BEFORE INSERT trigger copies them across whenever the
--    inserted row leaves them blank. It runs inside the RPC's own transaction,
--    so the booking and its contact details are one atomic act, and it needs no
--    change to the RPC and no second call from the client. It also repairs the
--    legacy insert path for free.
--
-- 2. CONFERENCE INTENT — not derivable, therefore an explicit call.
--    is_large_conference_quote and conference_details are choices the guest
--    made on the form; nothing in the database can infer them. They are set by
--    attach_booking_details() immediately after the booking RPC
--    returns.
--
--    This is deliberately NOT a client UPDATE on public.bookings. The guest has
--    an UPDATE policy on their own booking, but an UPDATE issued as the
--    `authenticated` role re-fires bk_validate_price, whose 0148 guard only
--    steps aside for non-authenticated roles — so validate_booking_price would
--    run and stamp deposit_amount = ROUND(total_price * 0.15) back onto a row
--    the financial core deliberately left at 0. A SECURITY DEFINER function
--    runs as its owner, the guard steps aside, and only the two intended
--    columns move.
--
--    It is idempotent and safe to repeat, so a retry of the booking attempt can
--    repeat it without consequence. If it fails the booking still exists and is
--    correct; only the conference metadata is missing, which an admin can see
--    and fix. That is the one non-atomic seam in the cutover and it is confined
--    to metadata that carries no money.
--
-- APPLIES AFTER: 0168_markup_from_listed_price.sql
-- TOUCHES: adds a BEFORE INSERT trigger on public.bookings, adds one RPC.
-- DOES NOT TOUCH: any financial column, formula, RLS policy or existing row.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. PRECONDITIONS
-- ═══════════════════════════════════════════════════════════════════════════

DO $pre$
DECLARE v_missing TEXT := '';
BEGIN
  IF to_regprocedure('public.create_booking_with_financials(text,text,date,date,integer,text,integer[],uuid,integer,text)') IS NULL THEN
    v_missing := v_missing || E'\n  - create_booking_with_financials is absent (apply 0153 first)';
  END IF;
  IF to_regclass('public.users') IS NULL THEN
    v_missing := v_missing || E'\n  - public.users is absent';
  END IF;
  IF v_missing <> '' THEN
    RAISE EXCEPTION 'PRECONDITIONS FAILED for 0156:%', v_missing;
  END IF;
  RAISE NOTICE '0156 preconditions: OK';
END;
$pre$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. IDENTITY AND CONTACT BACKFILL
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.bookings_backfill_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE u RECORD;
BEGIN
  -- Only ever fills a gap. A caller that supplied a value keeps it, so the
  -- legacy insert path behaves exactly as it always has.
  IF COALESCE(NULLIF(btrim(NEW.user_name),  ''), NULL) IS NOT NULL
 AND COALESCE(NULLIF(btrim(NEW.user_phone), ''), NULL) IS NOT NULL
 AND COALESCE(NULLIF(btrim(NEW.user_email), ''), NULL) IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT name, phone, email, role, organization_name
    INTO u FROM public.users WHERE id = NEW.user_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  NEW.user_name  := COALESCE(NULLIF(btrim(NEW.user_name),  ''), COALESCE(u.name,  ''));
  NEW.user_phone := COALESCE(NULLIF(btrim(NEW.user_phone), ''), COALESCE(u.phone, ''));
  NEW.user_email := COALESCE(NULLIF(btrim(NEW.user_email), ''), COALESCE(u.email, ''));

  -- user_role is NOT NULL DEFAULT 'individual', so "blank" here means the
  -- default rather than a deliberate choice.
  IF NEW.user_role IS NULL OR NEW.user_role = 'individual' THEN
    NEW.user_role := COALESCE(u.role, NEW.user_role);
  END IF;

  IF NEW.organization_name IS NULL THEN
    NEW.organization_name := u.organization_name;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.bookings_backfill_identity() IS
  'Fills a booking''s contact/identity columns from public.users when the inserting caller left them blank. Exists because create_booking_with_financials does not carry them and they default to empty strings, which would hand the owner a booking with no way to reach the guest.';

DROP TRIGGER IF EXISTS bookings_backfill_identity_trg ON public.bookings;
CREATE TRIGGER bookings_backfill_identity_trg
  BEFORE INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.bookings_backfill_identity();

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. CONFERENCE INTENT
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.attach_booking_details(
  p_booking_id        TEXT,
  p_user_name         TEXT    DEFAULT NULL,
  p_user_phone        TEXT    DEFAULT NULL,
  p_user_email        TEXT    DEFAULT NULL,
  p_organization_name TEXT    DEFAULT NULL,
  p_is_quote          BOOLEAN DEFAULT FALSE,
  p_details           JSONB   DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_b   RECORD;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;

  SELECT * INTO v_b FROM public.bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'BOOKING_NOT_FOUND: %', p_booking_id; END IF;

  -- The guest who made it, the owner of the house, or an admin. Anyone else is
  -- reaching for a booking that is not theirs.
  IF NOT (
    v_b.user_id = v_uid
    OR public.is_admin(v_uid)
    OR EXISTS (SELECT 1 FROM public.houses h WHERE h.id = v_b.house_id AND h.owner_id = v_uid)
  ) THEN
    RAISE EXCEPTION 'NOT_YOUR_BOOKING: %', p_booking_id;
  END IF;

  -- Metadata only. No financial column is reachable from here, and running as
  -- the definer keeps bk_validate_price from re-stamping a legacy deposit onto
  -- a row the financial core owns.
  UPDATE public.bookings
     SET user_name                 = COALESCE(NULLIF(btrim(p_user_name), ''),  user_name),
         user_phone                = COALESCE(NULLIF(btrim(p_user_phone), ''), user_phone),
         user_email                = COALESCE(NULLIF(btrim(p_user_email), ''), user_email),
         organization_name         = COALESCE(NULLIF(btrim(p_organization_name), ''), organization_name),
         is_large_conference_quote = COALESCE(p_is_quote, FALSE),
         conference_details        = p_details
   WHERE id = p_booking_id;

  RETURN (SELECT to_jsonb(b) FROM public.bookings b WHERE b.id = p_booking_id);
END;
$$;

COMMENT ON FUNCTION public.attach_booking_details(TEXT,TEXT,TEXT,TEXT,TEXT,BOOLEAN,JSONB) IS
  'Sets the two per-booking fields create_booking_with_financials cannot derive. Idempotent, metadata only, and runs as definer so the legacy price trigger does not re-stamp a 15% deposit.';

REVOKE ALL ON FUNCTION public.attach_booking_details(TEXT,TEXT,TEXT,TEXT,TEXT,BOOLEAN,JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.attach_booking_details(TEXT,TEXT,TEXT,TEXT,TEXT,BOOLEAN,JSONB) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3b. THE CLIENT-SAFE SLICE OF financial_settings
--
--     The guest-facing deposit is 30% and lives in financial_settings, which
--     is admin-read-only — so the browser currently cannot see it and falls
--     back to platform_settings.deposit_rate, which is still 0.15. That is the
--     whole reason every checkout screen quotes the wrong deposit.
--
--     This exposes only what a guest legitimately needs in order to be quoted
--     correctly: the deposit rate, the points conversion and cap, the currency,
--     and the platform's default cancellation window. It deliberately withholds
--     min_margin_rate, default_commission_rate, transfer_fee_min/rate/cap and
--     receivable_threshold — PIMA's own economics, which no customer screen has
--     any reason to read.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fin_client_settings()
RETURNS TABLE (
  deposit_rate        NUMERIC,
  points_per_egp      INTEGER,
  max_redemption_pct  NUMERIC,
  currency            CHAR(3),
  free_cancel_days    INTEGER,
  partial_refund_days INTEGER,
  partial_refund_pct  NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT fs.deposit_rate, fs.points_per_egp, fs.max_redemption_pct, fs.currency,
         fs.free_cancel_days, fs.partial_refund_days, fs.partial_refund_pct
    FROM public.financial_settings fs
   WHERE fs.effective_to IS NULL
   ORDER BY fs.effective_from DESC
   LIMIT 1;
$$;

COMMENT ON FUNCTION public.fin_client_settings() IS
  'The guest-visible slice of financial_settings: deposit rate, points conversion and cap, currency, default cancellation window. Withholds every margin, commission and transfer-fee field.';

REVOKE ALL ON FUNCTION public.fin_client_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fin_client_settings() TO anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. VERIFICATION
-- ═══════════════════════════════════════════════════════════════════════════

DO $verify$
DECLARE
  v_fail TEXT := '';
  v_pass INTEGER := 0;
  v_t    TEXT;
  v_b    BOOLEAN;
  fn     CONSTANT TEXT := 'public.attach_booking_details(text,text,text,text,text,boolean,jsonb)';
  trg    CONSTANT TEXT := 'public.bookings_backfill_identity()';
BEGIN
  IF to_regprocedure(trg) IS NULL THEN
    v_fail := v_fail || E'\n  - bookings_backfill_identity is missing';
  ELSE v_pass := v_pass + 1; END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger
                  WHERE tgrelid='public.bookings'::regclass
                    AND tgname='bookings_backfill_identity_trg' AND NOT tgisinternal) THEN
    v_fail := v_fail || E'\n  - the backfill trigger is not attached to public.bookings';
  ELSE v_pass := v_pass + 1; END IF;

  IF to_regprocedure(fn) IS NULL THEN
    v_fail := v_fail || E'\n  - attach_booking_details is missing';
  ELSE v_pass := v_pass + 1; END IF;

  -- both must be definer with a pinned search_path
  FOR v_t IN SELECT unnest(ARRAY[fn, trg]) LOOP
    SELECT p.prosecdef INTO v_b FROM pg_proc p WHERE p.oid = to_regprocedure(v_t);
    IF NOT COALESCE(v_b,FALSE) THEN
      v_fail := v_fail || E'\n  - ' || v_t || ' is not SECURITY DEFINER';
    ELSE v_pass := v_pass + 1; END IF;
    SELECT (p.proconfig::text LIKE '%search_path=public, pg_temp%') INTO v_b
      FROM pg_proc p WHERE p.oid = to_regprocedure(v_t);
    IF NOT COALESCE(v_b,FALSE) THEN
      v_fail := v_fail || E'\n  - ' || v_t || ' does not pin search_path';
    ELSE v_pass := v_pass + 1; END IF;
  END LOOP;

  IF has_function_privilege('anon', to_regprocedure(fn), 'EXECUTE') THEN
    v_fail := v_fail || E'\n  - anon can execute attach_booking_details';
  ELSE v_pass := v_pass + 1; END IF;
  IF NOT has_function_privilege('authenticated', to_regprocedure(fn), 'EXECUTE') THEN
    v_fail := v_fail || E'\n  - authenticated cannot execute attach_booking_details';
  ELSE v_pass := v_pass + 1; END IF;

  -- it must not be able to touch money
  SELECT regexp_replace(p.prosrc, '--[^\n]*', '', 'g') INTO v_t
    FROM pg_proc p WHERE p.oid = to_regprocedure(fn);
  IF v_t ~* '(total_price|deposit_amount|commission_rate|payment_status|status\s*=)' THEN
    v_fail := v_fail || E'\n  - attach_booking_details touches a financial or state column';
  ELSE v_pass := v_pass + 1; END IF;

  -- the client-safe settings reader exists, is callable, and leaks no margin
  IF to_regprocedure('public.fin_client_settings()') IS NULL THEN
    v_fail := v_fail || E'
  - fin_client_settings is missing';
  ELSE
    v_pass := v_pass + 1;
    IF NOT has_function_privilege('authenticated', to_regprocedure('public.fin_client_settings()'), 'EXECUTE') THEN
      v_fail := v_fail || E'
  - authenticated cannot read the client settings';
    ELSE v_pass := v_pass + 1; END IF;
    SELECT string_agg(a.attname, ',' ORDER BY a.attnum) INTO v_t
      FROM pg_proc p JOIN unnest(p.proallargtypes, p.proargmodes, p.proargnames)
             WITH ORDINALITY AS a(atttypid, attmode, attname, attnum) ON TRUE
     WHERE p.oid = to_regprocedure('public.fin_client_settings()') AND a.attmode = 't';
    IF v_t ~ '(min_margin|commission|transfer_fee|receivable)' THEN
      v_fail := v_fail || E'
  - fin_client_settings exposes a privileged field: ' || v_t;
    ELSE v_pass := v_pass + 1; END IF;
  END IF;

  -- the financial core is untouched
  IF to_regprocedure('public.create_booking_with_financials(text,text,date,date,integer,text,integer[],uuid,integer,text)') IS NULL
     OR to_regprocedure('public.fin_quote_booking(text,date,date,integer,integer[],uuid,integer)') IS NULL THEN
    v_fail := v_fail || E'\n  - a financial-core signature changed';
  ELSE v_pass := v_pass + 1; END IF;

  IF v_fail <> '' THEN
    RAISE EXCEPTION '0156 VERIFICATION FAILED (% of 14 passed):%', v_pass, v_fail;
  END IF;
  IF v_pass <> 14 THEN
    RAISE EXCEPTION
      '0156 VERIFICATION INCOMPLETE: % assertions passed but 14 were expected — a check did not run',
      v_pass;
  END IF;
  RAISE NOTICE '0156 verification: 14 / 14 checks PASSED';
END;
$verify$;
