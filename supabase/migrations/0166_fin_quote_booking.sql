-- 0166_fin_quote_booking.sql
--
-- The authoritative pre-booking quote, and the end of the second pricing engine.
--
-- WHY
-- ---
-- The Phase 5A frontend audit closed with READY FOR CUTOVER = NO. The decisive
-- blocker was not a missing screen: it was that the browser had no authorised
-- way to learn the price it was about to commit to. fin_listed_price,
-- fin_effective_policy, fin_points_to_egp and fin_resolve_promotion are all
-- REVOKEd from `authenticated`, so the only way a guest could see a number
-- before pressing "احجز" was for the client to compute one itself — which is
-- exactly what src/components/HouseDetail.tsx has always done, and exactly why
-- the quoted figure and the charged figure were free to diverge.
--
-- This migration adds ONE controlled endpoint, fin_quote_booking(), and makes it
-- impossible for it to disagree with create_booking_with_financials().
--
-- HOW — the architectural point
-- -----------------------------
-- The obvious implementation (copy the pricing block out of
-- create_booking_with_financials into a second function) would create the very
-- thing this whole phase exists to remove: two pricing engines, free to drift.
--
-- create_booking_with_financials already decomposes cleanly into two halves:
--
--   PHASE 1  settings -> house -> agreement -> policy -> chargeable party ->
--            listed price -> retail/entitlement per model -> promotion ->
--            points -> final -> margin/deposit/hold/fee -> override decision
--            ... every step a pure read.
--
--   PHASE 2  INSERT bookings, booking_financials, booking_promotions,
--            points deduction + history + four-leg ledger, settlement_holds,
--            booking_idempotency.
--
-- So PHASE 1 is lifted verbatim into public.fin_price_booking(), and BOTH
-- callers use it. The quote and the booking do not merely agree; they execute
-- the same instructions. quote(input) == booking_financial_snapshot(input) holds
-- by construction rather than by discipline.
--
-- create_booking_with_financials keeps its exact public signature, its exact
-- error vocabulary, and its exact order of raised exceptions (see THE LOCK,
-- below, for the single non-observable difference).
--
-- THE DERIVED COLUMNS
-- -------------------
-- Ten columns on booking_financials are GENERATED ALWAYS, and every one of them
-- is a pure function of exactly seven stored values: retail_price,
-- promo_discount, points_discount, owner_entitlement, deposit_rate,
-- min_margin_rate, assumed_transfer_fee. A quote has no stored row, so it cannot
-- read them — it has to compute them.
--
-- create_booking_with_financials already faced this (it needs the deposit to
-- derive the hold, to derive the fee, to decide the override) and solved it by
-- copying the generation expressions into PL/pgSQL verbatim. That copy now lives
-- in fin_price_booking, in one place, feeding both callers — and the
-- ASSERTION BLOCK below turns the copy from an unchecked comment into a
-- precondition: if anyone ever alters a generation expression without updating
-- this function, applying this migration fails loudly instead of quietly
-- producing two different answers.
--
-- THE LOCK
-- --------
-- The one line of PHASE 1 that is not a pure read is the points balance lock:
--   SELECT id, points INTO u FROM public.users WHERE id = v_uid FOR UPDATE;
-- A quote must not take a row lock, and a booking must. So the lock stays in
-- create_booking_with_financials, taken immediately before the helper is called
-- and only when p_points > 0; the helper then does the plain read underneath it.
-- In READ COMMITTED the statement following the lock sees the latest committed
-- row, so the balance the helper validates is the balance the lock protects —
-- the concurrency guarantee of 0148 is unchanged.
--
-- The lock is deliberately taken WITHOUT its own NOT FOUND check, so that
-- USER_NOT_FOUND is still raised by the same read, at the same point in the
-- sequence, as before. The only thing that moved is the lock acquisition itself,
-- which is not observable through the function's behaviour.
--
-- WHAT THE QUOTE DOES NOT DO
-- --------------------------
-- No INSERT of any kind: not bookings, booking_financials, settlement_holds,
-- booking_idempotency, booking_promotions, notifications, fin_transactions or
-- fin_transaction_legs. No points redeemed, no promotion counter touched, no
-- users/houses/agreements/settings modified. fin_price_booking is declared
-- STABLE, which makes that a guarantee the database enforces rather than a
-- promise this comment makes: PostgreSQL refuses to execute a data-modifying
-- statement inside it. fin_resolve_promotion, which the quote calls, is itself
-- STABLE for the same reason.
--
-- THE MARGIN BLOCK IS ROLE-GATED  —  CONFIRMED PRODUCT DECISION
-- -------------------------------------------------------------
-- A customer never sees PIMA's margin or the house's commercial terms. This was
-- raised as an open question during Phase 5B and answered: CONFIRMED — CUSTOMER
-- MARGIN VISIBILITY. It is a product decision, not an implementation detail, and
-- it is not to be widened without the same decision being taken again.
--
-- Restricted to admins and the house's own owner — ten fields, exactly:
--
--     commission_rate        owner_entitlement      pima_gross_margin
--     assumed_transfer_fee   projected_net_margin   required_min_margin
--     cash_shortfall         deposit_standard       hold_amount
--     min_margin_rate
--
-- Every other authenticated caller receives the customer-safe payload only.
--
-- The reason, for whoever reads this next: a quote needs no existing booking, so
-- an open margin block would turn this endpoint into a price-probe of the entire
-- supplier book — anyone who can create an account could enumerate the net rate
-- of every house on the platform and PIMA's margin on every booking.
-- fin_booking_summary_customer already excludes all ten for the same reason;
-- this endpoint matches that view rather than contradicting it.
--
-- margin_warning and override_required ARE returned to the customer flow. They
-- are booleans that say "this booking will need an administrator's approval",
-- which the guest flow needs in order to set expectations, and they disclose no
-- commercial number.
--
-- Section 6 enforces all of the above statically: it fails the migration if any
-- restricted field escapes the privileged branch, or if either boolean stops
-- being returned unconditionally.
--
-- APPLIES AFTER: 0152_transfer_fee_model.sql
-- TOUCHES:       adds public.fin_price_booking, adds public.fin_quote_booking,
--                CREATE OR REPLACEs public.create_booking_with_financials.
-- DOES NOT TOUCH: any table, any view, any other function, any existing row.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. PRECONDITIONS
-- ═══════════════════════════════════════════════════════════════════════════

DO $pre$
DECLARE
  v_missing TEXT := '';
  v_expr    TEXT;
BEGIN
  -- 0152 must be in place: the helper calls fin_transfer_fee.
  IF to_regprocedure('public.fin_transfer_fee(numeric)') IS NULL THEN
    v_missing := v_missing || E'\n  - public.fin_transfer_fee(numeric) is absent (apply 0152 first)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='financial_settings'
                    AND column_name='transfer_fee_min') THEN
    v_missing := v_missing || E'\n  - financial_settings.transfer_fee_min is absent (apply 0152 first)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='financial_settings'
                    AND column_name='transfer_fee_rate') THEN
    v_missing := v_missing || E'\n  - financial_settings.transfer_fee_rate is absent (apply 0152 first)';
  END IF;

  IF to_regprocedure('public.create_booking_with_financials(text,text,date,date,integer,text,integer[],uuid,integer,text)') IS NULL THEN
    v_missing := v_missing || E'\n  - create_booking_with_financials is absent (apply 0148 first)';
  END IF;

  IF to_regprocedure('public.fin_listed_price(text,date,date,integer)') IS NULL THEN
    v_missing := v_missing || E'\n  - public.fin_listed_price is absent';
  END IF;

  IF to_regprocedure('public.fin_effective_policy(text)') IS NULL THEN
    v_missing := v_missing || E'\n  - public.fin_effective_policy is absent';
  END IF;

  IF to_regprocedure('public.fin_resolve_promotion(uuid,text,numeric,bpchar,uuid,timestamptz)') IS NULL THEN
    v_missing := v_missing || E'\n  - public.fin_resolve_promotion is absent';
  END IF;

  IF to_regprocedure('public.is_admin(uuid)') IS NULL THEN
    v_missing := v_missing || E'\n  - public.is_admin(uuid) is absent';
  END IF;

  -- fin_resolve_promotion is called from a STABLE function and must therefore
  -- be non-volatile itself. It is also the promise that a quote cannot burn a
  -- promotion's usage counter.
  SELECT p.provolatile::text INTO v_expr
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname='public' AND p.proname='fin_resolve_promotion';
  IF v_expr IS NOT NULL AND v_expr = 'v' THEN
    v_missing := v_missing || E'\n  - fin_resolve_promotion is VOLATILE; a quote could then mutate promotion state';
  END IF;

  IF v_missing <> '' THEN
    RAISE EXCEPTION 'PRECONDITIONS FAILED for 0153:%', v_missing;
  END IF;

  RAISE NOTICE '0153 preconditions: OK';
END;
$pre$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. GENERATED-EXPRESSION FIDELITY ASSERTIONS
--
--    fin_price_booking reproduces these ten expressions in PL/pgSQL. If the
--    table's definition ever moves, the reproduction is wrong, and the quote
--    would disagree with the stored snapshot. Fail the migration rather than
--    ship that.
-- ═══════════════════════════════════════════════════════════════════════════

DO $assert$
DECLARE
  v_fail TEXT := '';
  v_n    INTEGER := 0;


  EXPECTED CONSTANT TEXT[][] := ARRAY[
    ['final_price',
     '((retail_price - promo_discount) - points_discount)'],
    ['pima_gross_margin',
     '(retail_price - owner_entitlement)'],
    ['deposit_standard',
     'round((deposit_rate * ((retail_price - promo_discount) - points_discount)))'],
    ['deposit_amount',
     'GREATEST(round((deposit_rate * ((retail_price - promo_discount) - points_discount))), (retail_price - owner_entitlement))'],
    ['required_min_margin',
     'round((((retail_price - promo_discount) - points_discount) * min_margin_rate), 2)'],
    ['projected_net_margin',
     '((((retail_price - owner_entitlement) - promo_discount) - points_discount) - assumed_transfer_fee)'],
    ['cash_shortfall',
     'GREATEST((0)::numeric, (owner_entitlement - ((retail_price - promo_discount) - points_discount)))'],
    ['margin_warning',
     '(((((retail_price - owner_entitlement) - promo_discount) - points_discount) - assumed_transfer_fee) < round((((retail_price - promo_discount) - points_discount) * min_margin_rate), 2))'],
    ['override_required',
     '((((((retail_price - owner_entitlement) - promo_discount) - points_discount) - assumed_transfer_fee) < round((((retail_price - promo_discount) - points_discount) * min_margin_rate), 2)) OR ((owner_entitlement - ((retail_price - promo_discount) - points_discount)) > (0)::numeric))']
  ];

  v_col  TEXT;
  v_want TEXT;
  v_got  TEXT;
  i      INTEGER;
BEGIN
  FOR i IN 1 .. array_length(EXPECTED, 1) LOOP
    v_col  := EXPECTED[i][1];
    v_want := EXPECTED[i][2];

    SELECT pg_get_expr(d.adbin, d.adrelid) INTO v_got
      FROM pg_attribute a
      JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
     WHERE a.attrelid = 'public.booking_financials'::regclass
       AND a.attgenerated = 's'
       AND a.attname = v_col;

    IF v_got IS NULL THEN
      v_fail := v_fail || E'\n  - booking_financials.' || v_col || ' is not a stored generated column';
    ELSIF regexp_replace(v_got, '\s+', ' ', 'g') <> regexp_replace(v_want, '\s+', ' ', 'g') THEN
      v_fail := v_fail || E'\n  - booking_financials.' || v_col || ' generation expression has changed'
                       || E'\n      expected: ' || regexp_replace(v_want, '\s+', ' ', 'g')
                       || E'\n      actual:   ' || regexp_replace(v_got,  '\s+', ' ', 'g');
    ELSE
      v_n := v_n + 1;
    END IF;
  END LOOP;

  -- deposit_basis is a CASE, compared on its semantic content rather than its
  -- pretty-printed whitespace and line breaks.
  SELECT regexp_replace(pg_get_expr(d.adbin, d.adrelid), '\s+', ' ', 'g') INTO v_got
    FROM pg_attribute a
    JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
   WHERE a.attrelid = 'public.booking_financials'::regclass
     AND a.attgenerated = 's' AND a.attname = 'deposit_basis';

  IF v_got IS NULL THEN
    v_fail := v_fail || E'\n  - booking_financials.deposit_basis is not a stored generated column';
  ELSIF btrim(v_got) <> btrim(regexp_replace(
          'CASE WHEN ((retail_price - owner_entitlement) > round((deposit_rate * ((retail_price - promo_discount) - points_discount)))) THEN ''MARGIN_FLOOR''::text ELSE ''STANDARD''::text END',
          '\s+', ' ', 'g')) THEN
    v_fail := v_fail || E'\n  - booking_financials.deposit_basis generation expression has changed'
                     || E'\n      actual: ' || v_got;
  ELSE
    v_n := v_n + 1;
  END IF;

  -- settlement_holds.hold_amount is written by a trigger, not generated. The
  -- helper reproduces it to feed fin_transfer_fee, so it is checked too.
  SELECT p.prosrc INTO v_got
    FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
   WHERE t.tgrelid = 'public.settlement_holds'::regclass
     AND NOT t.tgisinternal AND p.proname = 'settlement_holds_populate';

  IF v_got IS NULL THEN
    v_fail := v_fail || E'\n  - settlement_holds_populate trigger function not found';
  ELSIF position('GREATEST(0, bf.owner_entitlement - (bf.final_price - bf.deposit_amount))' in v_got) = 0 THEN
    v_fail := v_fail || E'\n  - settlement_holds_populate no longer computes hold_amount as'
                     || E'\n      GREATEST(0, owner_entitlement - (final_price - deposit_amount))';
  ELSE
    v_n := v_n + 1;
  END IF;

  IF v_fail <> '' THEN
    RAISE EXCEPTION
      'DERIVED-EXPRESSION FIDELITY FAILED — fin_price_booking would disagree with the stored snapshot:%',
      v_fail;
  END IF;

  IF v_n <> 11 THEN
    RAISE EXCEPTION 'ASSERTION COUNT WRONG: % of 11 derived expressions were checked', v_n;
  END IF;
  RAISE NOTICE '0153 derived-expression fidelity: 11 / 11 expressions match';
END;
$assert$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. THE SHARED PRICING PATH
--
--    Lifted verbatim from create_booking_with_financials PHASE 1. This is the
--    only place in the database where a booking's economics are decided.
--
--    STABLE, so PostgreSQL itself forbids it from writing anything.
--    Not callable by any client role — it is an implementation detail of the
--    two SECURITY DEFINER wrappers below, and it takes a caller uid as an
--    argument, which must never be attacker-controlled.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fin_price_booking(
  p_uid          UUID,
  p_house_id     TEXT,
  p_check_in     DATE,
  p_check_out    DATE,
  p_guests_count INTEGER,
  p_child_ages   INTEGER[] DEFAULT NULL,
  p_promotion_id UUID      DEFAULT NULL,
  p_points       INTEGER   DEFAULT 0
)
RETURNS TABLE (
  -- context
  owner_id                  UUID,
  agreement_id              UUID,
  model_type                TEXT,
  currency                  CHAR(3),
  -- resolved pricing inputs
  pricing_basis             TEXT,
  pricing_quantity          INTEGER,
  chargeable_guests         INTEGER,
  resolved_rate             NUMERIC,
  base_rate                 NUMERIC,
  markup_pct                NUMERIC,
  commission_rate           NUMERIC,
  -- money
  retail_price              NUMERIC,
  promo_discount            NUMERIC,
  points_discount           NUMERIC,
  points_redeemed           INTEGER,
  owner_entitlement         NUMERIC,
  final_price               NUMERIC,
  -- settings snapshot
  deposit_rate              NUMERIC,
  min_margin_rate           NUMERIC,
  -- derived, verbatim from the generated columns
  deposit_standard          NUMERIC,
  pima_gross_margin         NUMERIC,
  deposit_amount            NUMERIC,
  deposit_basis             TEXT,
  arrival_balance_external  NUMERIC,
  hold_amount               NUMERIC,
  assumed_transfer_fee      NUMERIC,
  required_min_margin       NUMERIC,
  projected_net_margin      NUMERIC,
  cash_shortfall            NUMERIC,
  margin_warning            BOOLEAN,
  override_required         BOOLEAN,
  -- policy
  policy_free_cancel_days    INTEGER,
  policy_partial_refund_days INTEGER,
  policy_partial_refund_pct  NUMERIC,
  policy_source              TEXT,
  owner_cash_release_date    DATE
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  fs           RECORD;
  ag           RECORD;
  pol          RECORD;
  lp           RECORD;
  u            RECORD;
  h_owner      UUID;
  v_free_kids  INTEGER := 0;
  v_chargeable INTEGER;
  v_retail     NUMERIC;
  v_promo      NUMERIC := 0;
  v_pts_egp    NUMERIC := 0;
  v_final      NUMERIC;
  v_entitle    NUMERIC;
  v_gross      NUMERIC;
  v_req_min    NUMERIC;
  v_proj_net   NUMERIC;
  v_shortfall  NUMERIC;
  v_warn       BOOLEAN;
  v_deposit    NUMERIC;
  v_dep_std    NUMERIC;
  v_hold       NUMERIC;
  v_fee        NUMERIC;
BEGIN
  IF p_points IS NULL OR p_points < 0 THEN
    RAISE EXCEPTION 'INVALID_POINTS: %', p_points;
  END IF;

  -- ── Settings, house, agreement ──────────────────────────────────────────
  SELECT * INTO fs FROM public.financial_settings
   WHERE effective_to IS NULL ORDER BY effective_from DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'NO_FINANCIAL_SETTINGS'; END IF;

  SELECT h.owner_id INTO h_owner FROM public.houses h WHERE h.id = p_house_id;
  IF h_owner IS NULL THEN RAISE EXCEPTION 'HOUSE_NOT_FOUND: %', p_house_id; END IF;

  -- BLOCKED-6: the commercial agreement in force on the BOOKING DATE, half-open.
  SELECT * INTO ag FROM public.house_agreements
   WHERE house_id = p_house_id
     AND effective_from <= CURRENT_DATE
     AND (effective_to IS NULL OR CURRENT_DATE < effective_to);
  IF NOT FOUND THEN
    RAISE EXCEPTION
      'NO_AGREEMENT: house % has no commercial agreement in force on % — a booking cannot be priced without one',
      p_house_id, CURRENT_DATE;
  END IF;

  -- ── Party and pricing ───────────────────────────────────────────────────
  SELECT * INTO pol FROM public.fin_effective_policy(p_house_id);

  IF pol.child_free_under_age IS NOT NULL AND p_child_ages IS NOT NULL THEN
    SELECT COUNT(*) INTO v_free_kids FROM unnest(p_child_ages) AS c(age)
     WHERE c.age < pol.child_free_under_age;
  END IF;
  v_chargeable := GREATEST(1, p_guests_count - v_free_kids);

  SELECT * INTO lp FROM public.fin_listed_price(p_house_id, p_check_in, p_check_out, v_chargeable);

  -- Retail, per the agreement semantics fixed in 0140.
  IF ag.model_type = 'MARKUP' THEN
    v_retail  := ROUND(ag.base_rate * lp.quantity * (1 + ag.markup_pct), 2);
    v_entitle := ROUND(ag.base_rate * lp.quantity, 2);
  ELSIF ag.model_type = 'NET_RATE' THEN
    v_retail  := lp.price;                                  -- PIMA's listing IS its retail
    v_entitle := ROUND(ag.net_rate * lp.quantity, 2);
  ELSE
    v_retail  := lp.price;                                  -- the house sets it
    v_entitle := ROUND(v_retail * (1 - ag.commission_rate), 2);
  END IF;

  -- ── The single promotion (PD-19) ────────────────────────────────────────
  IF p_promotion_id IS NOT NULL THEN
    v_promo := public.fin_resolve_promotion(
      p_promotion_id, p_house_id, v_retail, fs.currency, p_uid, NOW());
  END IF;

  -- ── Points ──────────────────────────────────────────────────────────────
  -- The read is plain. create_booking_with_financials takes the FOR UPDATE lock
  -- on this row immediately before calling this function, so on the booking path
  -- this read happens underneath that lock and sees the same balance the lock
  -- protects. On the quote path nothing is locked, which is the whole point.
  IF p_points > 0 THEN
    SELECT us.id, us.points INTO u FROM public.users us WHERE us.id = p_uid;
    IF NOT FOUND THEN RAISE EXCEPTION 'USER_NOT_FOUND'; END IF;
    IF u.points < p_points THEN
      RAISE EXCEPTION 'INSUFFICIENT_POINTS: have %, requested %', u.points, p_points;
    END IF;

    v_pts_egp := ROUND(p_points::numeric / fs.points_per_egp, 2);

    IF v_pts_egp > ROUND(v_retail * fs.max_redemption_pct, 2) THEN
      RAISE EXCEPTION
        'POINTS_EXCEED_CAP: % EGP of points exceeds the % share permitted on a booking of %',
        v_pts_egp, fs.max_redemption_pct, v_retail;
    END IF;
  END IF;

  v_final := v_retail - v_promo - v_pts_egp;
  IF v_final < 0 THEN
    RAISE EXCEPTION
      'DISCOUNTS_EXCEED_PRICE: retail %, promotion %, points % leaves a negative price',
      v_retail, v_promo, v_pts_egp;
  END IF;

  -- ── Margin, deposit, hold, fee, shortfall ───────────────────────────────
  -- Every expression below is the generation expression of the corresponding
  -- booking_financials column, character for character. Section 2 of this
  -- migration proves it. Note the unscaled ROUND in the deposit: that is 0142
  -- line 146, not a typo.
  v_gross     := v_retail - v_entitle;                                   -- pima_gross_margin
  v_dep_std   := ROUND(fs.deposit_rate * v_final);                       -- deposit_standard
  v_deposit   := GREATEST(v_dep_std, v_gross);                           -- deposit_amount
  v_hold      := GREATEST(0, v_entitle - (v_final - v_deposit));         -- settlement_holds.hold_amount
  v_fee       := public.fin_transfer_fee(v_hold);                        -- assumed_transfer_fee
  v_req_min   := ROUND(v_final * fs.min_margin_rate, 2);                 -- required_min_margin
  v_proj_net  := v_gross - v_promo - v_pts_egp - v_fee;                  -- projected_net_margin
  v_shortfall := GREATEST(0, v_entitle - v_final);                       -- cash_shortfall
  v_warn      := v_proj_net < v_req_min;                                 -- margin_warning

  -- The override DECISION belongs to the caller: create_booking_with_financials
  -- refuses, fin_quote_booking reports. This function only states the facts.
  RETURN QUERY SELECT
    h_owner,
    ag.id,
    ag.model_type,
    fs.currency,
    lp.basis,
    lp.quantity,
    v_chargeable,
    CASE WHEN ag.model_type = 'NET_RATE'   THEN ag.net_rate        END,
    CASE WHEN ag.model_type = 'MARKUP'     THEN ag.base_rate       END,
    CASE WHEN ag.model_type = 'MARKUP'     THEN ag.markup_pct      END,
    CASE WHEN ag.model_type = 'COMMISSION' THEN ag.commission_rate END,
    v_retail,
    v_promo,
    v_pts_egp,
    COALESCE(p_points, 0),
    v_entitle,
    v_final,
    fs.deposit_rate,
    fs.min_margin_rate,
    v_dep_std,
    v_gross,
    v_deposit,
    CASE WHEN v_gross > v_dep_std THEN 'MARGIN_FLOOR' ELSE 'STANDARD' END,
    v_final - v_deposit,                                      -- arrival_balance_external
    v_hold,
    v_fee,
    v_req_min,
    v_proj_net,
    v_shortfall,
    v_warn,
    (v_warn OR v_shortfall > 0),                              -- override_required
    pol.free_cancel_days,
    pol.partial_refund_days,
    pol.partial_refund_pct,
    pol.source,
    (p_check_in - pol.partial_refund_days)::date;
END;
$$;

COMMENT ON FUNCTION public.fin_price_booking(UUID,TEXT,DATE,DATE,INTEGER,INTEGER[],UUID,INTEGER) IS
  'The single pricing path. Called by create_booking_with_financials (which locks the points row first) and by fin_quote_booking (which does not). STABLE: cannot write. Never grant to a client role — p_uid is trusted.';

REVOKE ALL ON FUNCTION public.fin_price_booking(UUID,TEXT,DATE,DATE,INTEGER,INTEGER[],UUID,INTEGER)
  FROM PUBLIC, anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. create_booking_with_financials — PHASE 1 replaced by the call, PHASE 2
--    untouched. Signature, error vocabulary and return shape are unchanged.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.create_booking_with_financials(
  p_booking_id     TEXT,
  p_house_id       TEXT,
  p_check_in       DATE,
  p_check_out      DATE,
  p_guests_count   INTEGER,
  p_idempotency_key TEXT,
  p_child_ages     INTEGER[] DEFAULT NULL,
  p_promotion_id   UUID      DEFAULT NULL,
  p_points         INTEGER   DEFAULT 0,
  p_override_reason TEXT     DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid      UUID := auth.uid();
  v_admin    BOOLEAN;
  v_fp       TEXT;
  v_prior    RECORD;
  q          RECORD;
  v_txn      UUID;
  v_rows     INTEGER;
  v_override UUID := NULL;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;
  IF p_idempotency_key IS NULL OR length(btrim(p_idempotency_key)) = 0 THEN
    RAISE EXCEPTION 'IDEMPOTENCY_KEY_REQUIRED';
  END IF;
  IF p_points < 0 THEN
    RAISE EXCEPTION 'INVALID_POINTS: %', p_points;
  END IF;

  v_admin := public.is_admin(v_uid);

  -- Materially relevant inputs only: a replay that differs in any of these is a
  -- different booking wearing the same key.
  v_fp := md5(concat_ws('|', v_uid::text, p_house_id, p_check_in::text, p_check_out::text,
                        p_guests_count::text, COALESCE(array_to_string(p_child_ages, ','), ''),
                        COALESCE(p_promotion_id::text, ''), p_points::text));

  SELECT * INTO v_prior FROM public.booking_idempotency WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_prior.fingerprint <> v_fp THEN
      RAISE EXCEPTION
        'IDEMPOTENCY_CONFLICT: key % was used for a booking with different financial inputs',
        p_idempotency_key;
    END IF;
    RETURN (SELECT to_jsonb(bf) || jsonb_build_object('booking_id', v_prior.booking_id, 'replayed', true)
              FROM public.booking_financials bf WHERE bf.booking_id = v_prior.booking_id);
  END IF;

  -- ── The points lock ─────────────────────────────────────────────────────
  -- 0148's concurrency story: two bookings cannot both read the same balance and
  -- both spend it. The lock stays here, on the write path, because a quote must
  -- never take it. Deliberately no NOT FOUND check — fin_price_booking's own
  -- read raises USER_NOT_FOUND at the same point in the sequence as before, so
  -- the order in which this function raises exceptions is unchanged.
  IF p_points > 0 THEN
    PERFORM 1 FROM public.users WHERE id = v_uid FOR UPDATE;
  END IF;

  -- ── The pricing path, shared with fin_quote_booking ─────────────────────
  SELECT * INTO q FROM public.fin_price_booking(
    v_uid, p_house_id, p_check_in, p_check_out, p_guests_count,
    p_child_ages, p_promotion_id, p_points);

  -- ── Override gate ───────────────────────────────────────────────────────
  IF q.margin_warning OR q.cash_shortfall > 0 THEN
    IF NOT v_admin THEN
      RAISE EXCEPTION
        'OVERRIDE_REQUIRED: projected net margin % against a required minimum of %, cash shortfall % — an authorised administrator must approve this booking',
        q.projected_net_margin, q.required_min_margin, q.cash_shortfall;
    END IF;
    IF p_override_reason IS NULL OR length(btrim(p_override_reason)) = 0 THEN
      RAISE EXCEPTION 'OVERRIDE_REASON_REQUIRED';
    END IF;
    v_override := v_uid;
  END IF;

  -- ── Booking ─────────────────────────────────────────────────────────────
  -- Non-financial triggers still run: capacity, past dates, the child-policy
  -- stamp and the rate limit (which reads auth.uid(), not the database role, so
  -- it remains effective here).
  INSERT INTO public.bookings
    (id, house_id, house_name, user_id, user_name, check_in, check_out, guests_count,
     child_ages, total_price, deposit_amount, status, payment_status, deposit_paid)
  SELECT p_booking_id, p_house_id, h.name, v_uid, COALESCE(us.name, ''),
         p_check_in, p_check_out, p_guests_count, p_child_ages,
         q.final_price, 0, 'pending', 'unpaid', FALSE
    FROM public.houses h LEFT JOIN public.users us ON us.id = v_uid
   WHERE h.id = p_house_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN RAISE EXCEPTION 'BOOKING_INSERT_FAILED: % rows', v_rows; END IF;

  -- ── Snapshot. Generated columns compute themselves; none is written here. ──
  INSERT INTO public.booking_financials
    (booking_id, house_id, owner_id, agreement_id, model_type, currency,
     pricing_basis, pricing_quantity, resolved_rate, base_rate, markup_pct, commission_rate,
     retail_price, promo_discount, points_discount, points_redeemed, owner_entitlement,
     deposit_rate, min_margin_rate, assumed_transfer_fee,
     policy_free_cancel_days, policy_partial_refund_days, policy_partial_refund_pct,
     policy_source, owner_cash_release_date,
     override_by, override_reason, override_at)
  VALUES
    (p_booking_id, p_house_id, q.owner_id, q.agreement_id, q.model_type, q.currency,
     q.pricing_basis, q.pricing_quantity,
     q.resolved_rate, q.base_rate, q.markup_pct, q.commission_rate,
     q.retail_price, q.promo_discount, q.points_discount, q.points_redeemed, q.owner_entitlement,
     q.deposit_rate, q.min_margin_rate, q.assumed_transfer_fee,
     q.policy_free_cancel_days, q.policy_partial_refund_days, q.policy_partial_refund_pct,
     q.policy_source, q.owner_cash_release_date,
     v_override, CASE WHEN v_override IS NOT NULL THEN p_override_reason END,
     CASE WHEN v_override IS NOT NULL THEN NOW() END);
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN RAISE EXCEPTION 'SNAPSHOT_INSERT_FAILED: % rows', v_rows; END IF;

  -- ── Promotion linkage ───────────────────────────────────────────────────
  IF p_promotion_id IS NOT NULL THEN
    INSERT INTO public.booking_promotions
      (booking_id, promotion_id, discount_amount, currency, applied_by)
    VALUES (p_booking_id, p_promotion_id, q.promo_discount, q.currency, v_uid);
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN RAISE EXCEPTION 'PROMOTION_LINK_FAILED: % rows', v_rows; END IF;
  END IF;

  -- ── Points: deduct, record, post ────────────────────────────────────────
  IF p_points > 0 THEN
    UPDATE public.users SET points = points - p_points
     WHERE id = v_uid AND points >= p_points;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN
      RAISE EXCEPTION 'POINTS_DEDUCTION_FAILED: % rows affected — balance moved underneath us', v_rows;
    END IF;

    INSERT INTO public.points_history (id, user_id, amount, description, type, booking_id)
    VALUES ('pt_red_' || p_booking_id, v_uid, p_points,
            'خصم نقاط لحجز ' || p_booking_id, 'redeemed', p_booking_id);
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN RAISE EXCEPTION 'POINTS_HISTORY_FAILED: % rows', v_rows; END IF;

    -- The approved four-leg entry. The reclassification pair moves the cost from
    -- the programme to THIS booking; the liability discharge and the tendered
    -- consideration are the other two. Nothing is expensed twice.
    v_txn := gen_random_uuid();
    INSERT INTO public.fin_transactions
      (id, txn_type, booking_id, house_id, owner_id, actor_id, currency,
       reference_type, reference_id, idempotency_key, memo)
    VALUES (v_txn, 'points_redemption_cost', p_booking_id, p_house_id, q.owner_id, v_uid,
            q.currency, 'booking', p_booking_id,
            'pts:redeem:' || p_booking_id, 'points redeemed against booking');
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN RAISE EXCEPTION 'LEDGER_HEADER_FAILED: % rows', v_rows; END IF;

    INSERT INTO public.fin_transaction_legs (txn_id, account, amount, party_id) VALUES
      (v_txn, 'POINTS_LIABILITY',      q.points_discount, v_uid),
      (v_txn, 'PIMA_POINTS_EXPENSE',   q.points_discount, NULL),
      (v_txn, 'PIMA_LOYALTY_EXPENSE', -q.points_discount, NULL),
      (v_txn, 'POINTS_APPLIED',       -q.points_discount, v_uid);
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 4 THEN RAISE EXCEPTION 'LEDGER_LEGS_FAILED: % rows', v_rows; END IF;
  END IF;

  -- ── Settlement hold. Amount and date come from the snapshot, not from here. ─
  INSERT INTO public.settlement_holds (booking_id) VALUES (p_booking_id);
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN RAISE EXCEPTION 'HOLD_INSERT_FAILED: % rows', v_rows; END IF;

  INSERT INTO public.booking_idempotency (idempotency_key, booking_id, fingerprint, created_by)
  VALUES (p_idempotency_key, p_booking_id, v_fp, v_uid);

  RETURN (SELECT to_jsonb(bf) || jsonb_build_object('booking_id', p_booking_id, 'replayed', false)
            FROM public.booking_financials bf WHERE bf.booking_id = p_booking_id);
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. THE QUOTE
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fin_quote_booking(
  p_house_id     TEXT,
  p_check_in     DATE,
  p_check_out    DATE,
  p_guests_count INTEGER,
  p_child_ages   INTEGER[] DEFAULT NULL,
  p_promotion_id UUID      DEFAULT NULL,
  p_points       INTEGER   DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid        UUID := auth.uid();
  v_privileged BOOLEAN;
  q            RECORD;
  v_out        JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;
  IF p_points IS NULL OR p_points < 0 THEN
    RAISE EXCEPTION 'INVALID_POINTS: %', p_points;
  END IF;

  -- No further input validation here on purpose. Anything this function accepted
  -- but create_booking_with_financials rejected — or vice versa — would be a
  -- quote that lies. Dates, guest counts and house ids are therefore handed to
  -- exactly the same pricing path the booking uses, and whatever that path says
  -- is what the guest is told.
  SELECT * INTO q FROM public.fin_price_booking(
    v_uid, p_house_id, p_check_in, p_check_out, p_guests_count,
    p_child_ages, p_promotion_id, p_points);

  v_privileged := public.is_admin(v_uid) OR q.owner_id = v_uid;

  -- Guest-safe. Everything here is either the guest's own money or the terms
  -- already printed on the booking page.
  v_out := jsonb_build_object(
    'house_id',                 p_house_id,
    'check_in',                 p_check_in,
    'check_out',                p_check_out,
    'guests_count',             p_guests_count,
    'chargeable_guests',        q.chargeable_guests,
    'currency',                 q.currency,
    'pricing_basis',            q.pricing_basis,
    'pricing_quantity',         q.pricing_quantity,

    'retail_price',             q.retail_price,
    'promo_discount',           q.promo_discount,
    'points_discount',          q.points_discount,
    'points_redeemed',          q.points_redeemed,
    'final_price',              q.final_price,

    'deposit_amount',           q.deposit_amount,
    'deposit_basis',            q.deposit_basis,
    'deposit_rate',             q.deposit_rate,
    'arrival_balance_external', q.arrival_balance_external,

    'free_cancel_days',         q.policy_free_cancel_days,
    'partial_refund_days',      q.policy_partial_refund_days,
    'partial_refund_pct',       q.policy_partial_refund_pct,
    'policy_source',            q.policy_source,
    'owner_cash_release_date',  q.owner_cash_release_date,

    'agreement_id',             q.agreement_id,
    'agreement_model',          q.model_type,

    -- Booleans, not numbers: the guest flow needs to know a booking will be
    -- refused without an administrator, and that discloses nothing commercial.
    'margin_warning',           q.margin_warning,
    'override_required',        q.override_required,

    'quote_generated_at',       NOW()
  );

  -- The commercial terms. See "THE MARGIN BLOCK IS ROLE-GATED" at the head of
  -- this migration before widening this.
  IF v_privileged THEN
    v_out := v_out || jsonb_build_object(
      'commission_rate',       q.commission_rate,
      'owner_entitlement',     q.owner_entitlement,
      'pima_gross_margin',     q.pima_gross_margin,
      'assumed_transfer_fee',  q.assumed_transfer_fee,
      'projected_net_margin',  q.projected_net_margin,
      'required_min_margin',   q.required_min_margin,
      'cash_shortfall',        q.cash_shortfall,
      'deposit_standard',      q.deposit_standard,
      'hold_amount',           q.hold_amount,
      'min_margin_rate',       q.min_margin_rate
    );
  END IF;

  RETURN v_out;
END;
$$;

COMMENT ON FUNCTION public.fin_quote_booking(TEXT,DATE,DATE,INTEGER,INTEGER[],UUID,INTEGER) IS
  'Authoritative read-only booking quote. Shares fin_price_booking with create_booking_with_financials, so the quote and the booking cannot disagree. Writes nothing: STABLE. Margin block returned to admins and the house owner only.';

REVOKE ALL ON FUNCTION public.fin_quote_booking(TEXT,DATE,DATE,INTEGER,INTEGER[],UUID,INTEGER)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fin_quote_booking(TEXT,DATE,DATE,INTEGER,INTEGER[],UUID,INTEGER)
  TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. VERIFICATION
-- ═══════════════════════════════════════════════════════════════════════════

DO $verify$
DECLARE
  v_fail TEXT := '';
  v_pass INTEGER := 0;
  v_t    TEXT;
  v_b    BOOLEAN;
  v_src  TEXT;
  v_cust TEXT;
  v_priv TEXT;
  v_idx  INTEGER;


  quote_sig  CONSTANT TEXT := 'public.fin_quote_booking(text,date,date,integer,integer[],uuid,integer)';
  price_sig  CONSTANT TEXT := 'public.fin_price_booking(uuid,text,date,date,integer,integer[],uuid,integer)';
  book_sig   CONSTANT TEXT := 'public.create_booking_with_financials(text,text,date,date,integer,text,integer[],uuid,integer,text)';

BEGIN
  -- ── existence ───────────────────────────────────────────────────────────
  IF to_regprocedure(quote_sig) IS NULL THEN
    v_fail := v_fail || E'\n  - fin_quote_booking was not created';
  ELSE v_pass := v_pass + 1; END IF;

  IF to_regprocedure(price_sig) IS NULL THEN
    v_fail := v_fail || E'\n  - fin_price_booking was not created';
  ELSE v_pass := v_pass + 1; END IF;

  IF to_regprocedure(book_sig) IS NULL THEN
    v_fail := v_fail || E'\n  - create_booking_with_financials lost its signature';
  ELSE v_pass := v_pass + 1; END IF;

  -- ── the booking RPC still has exactly one overload ───────────────────────
  SELECT count(*)::text INTO v_t
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='create_booking_with_financials';
  IF v_t <> '1' THEN
    v_fail := v_fail || E'\n  - create_booking_with_financials has ' || v_t || ' overloads, expected 1';
  ELSE v_pass := v_pass + 1; END IF;

  -- ── volatility: both read-only paths must be non-volatile ────────────────
  SELECT p.provolatile::text INTO v_t FROM pg_proc p WHERE p.oid = to_regprocedure(price_sig);
  IF v_t <> 's' THEN
    v_fail := v_fail || E'\n  - fin_price_booking is not STABLE (provolatile=' || COALESCE(v_t,'?') || '); it could write';
  ELSE v_pass := v_pass + 1; END IF;

  SELECT p.provolatile::text INTO v_t FROM pg_proc p WHERE p.oid = to_regprocedure(quote_sig);
  IF v_t <> 's' THEN
    v_fail := v_fail || E'\n  - fin_quote_booking is not STABLE (provolatile=' || COALESCE(v_t,'?') || '); it could write';
  ELSE v_pass := v_pass + 1; END IF;

  -- ── the booking RPC must remain VOLATILE, it writes ──────────────────────
  SELECT p.provolatile::text INTO v_t FROM pg_proc p WHERE p.oid = to_regprocedure(book_sig);
  IF v_t <> 'v' THEN
    v_fail := v_fail || E'\n  - create_booking_with_financials is no longer VOLATILE';
  ELSE v_pass := v_pass + 1; END IF;

  -- ── security definer + search_path on all three ──────────────────────────
  FOR v_t IN SELECT unnest(ARRAY[quote_sig, price_sig, book_sig]) LOOP
    SELECT p.prosecdef INTO v_b FROM pg_proc p WHERE p.oid = to_regprocedure(v_t);
    IF NOT COALESCE(v_b, FALSE) THEN
      v_fail := v_fail || E'\n  - ' || v_t || ' is not SECURITY DEFINER';
    ELSE v_pass := v_pass + 1; END IF;

    SELECT (p.proconfig::text LIKE '%search_path=public, pg_temp%') INTO v_b
      FROM pg_proc p WHERE p.oid = to_regprocedure(v_t);
    IF NOT COALESCE(v_b, FALSE) THEN
      v_fail := v_fail || E'\n  - ' || v_t || ' does not pin search_path to public, pg_temp';
    ELSE v_pass := v_pass + 1; END IF;
  END LOOP;

  -- ── grants ──────────────────────────────────────────────────────────────
  IF NOT has_function_privilege('authenticated', to_regprocedure(quote_sig), 'EXECUTE') THEN
    v_fail := v_fail || E'\n  - authenticated cannot EXECUTE fin_quote_booking';
  ELSE v_pass := v_pass + 1; END IF;

  IF has_function_privilege('anon', to_regprocedure(quote_sig), 'EXECUTE') THEN
    v_fail := v_fail || E'\n  - anon CAN execute fin_quote_booking; it must not';
  ELSE v_pass := v_pass + 1; END IF;

  IF has_function_privilege('authenticated', to_regprocedure(price_sig), 'EXECUTE') THEN
    v_fail := v_fail || E'\n  - authenticated CAN execute fin_price_booking; the shared helper must stay private';
  ELSE v_pass := v_pass + 1; END IF;

  IF has_function_privilege('anon', to_regprocedure(price_sig), 'EXECUTE') THEN
    v_fail := v_fail || E'\n  - anon CAN execute fin_price_booking; the shared helper must stay private';
  ELSE v_pass := v_pass + 1; END IF;

  -- ── the internal pricing helpers stay revoked ────────────────────────────
  IF has_function_privilege('authenticated', 'public.fin_listed_price(text,date,date,integer)', 'EXECUTE') THEN
    v_fail := v_fail || E'\n  - fin_listed_price became executable by authenticated';
  ELSE v_pass := v_pass + 1; END IF;

  IF has_function_privilege('authenticated', 'public.fin_transfer_fee(numeric)', 'EXECUTE') THEN
    v_fail := v_fail || E'\n  - fin_transfer_fee became executable by authenticated';
  ELSE v_pass := v_pass + 1; END IF;

  -- ── source-shape checks ─────────────────────────────────────────────────
  -- These read the function source, so line comments are stripped first: this
  -- migration's own prose talks about INSERTs and FOR UPDATE, and a check that
  -- cannot tell code from commentary proves nothing.

  -- the booking RPC now delegates rather than duplicating
  SELECT regexp_replace(p.prosrc, '--[^\n]*', '', 'g') INTO v_src
    FROM pg_proc p WHERE p.oid = to_regprocedure(book_sig);
  IF v_src NOT LIKE '%fin_price_booking%' THEN
    v_fail := v_fail || E'\n  - create_booking_with_financials does not call fin_price_booking';
  ELSE v_pass := v_pass + 1; END IF;

  -- and no longer carries its own copy of the deposit expression
  IF v_src LIKE '%GREATEST(ROUND(fs.deposit_rate%' THEN
    v_fail := v_fail || E'\n  - create_booking_with_financials still contains its own deposit formula (two pricing engines)';
  ELSE v_pass := v_pass + 1; END IF;

  -- the lock did not go missing from the write path
  IF v_src NOT LIKE '%FOR UPDATE%' THEN
    v_fail := v_fail || E'\n  - create_booking_with_financials no longer locks the points row';
  ELSE v_pass := v_pass + 1; END IF;

  -- ── the quote writes nothing, and prices nothing itself ─────────────────
  SELECT regexp_replace(p.prosrc, '--[^\n]*', '', 'g') INTO v_src
    FROM pg_proc p WHERE p.oid = to_regprocedure(quote_sig);
  IF v_src ~* '\m(INSERT|UPDATE|DELETE|TRUNCATE|FOR UPDATE)\M' THEN
    v_fail := v_fail || E'\n  - fin_quote_booking contains a data-modifying statement or a row lock';
  ELSE v_pass := v_pass + 1; END IF;

  IF v_src LIKE '%deposit_rate *%' OR v_src LIKE '%GREATEST(%' THEN
    v_fail := v_fail || E'\n  - fin_quote_booking computes money itself; it must only relay fin_price_booking';
  ELSE v_pass := v_pass + 1; END IF;

  IF v_src NOT LIKE '%fin_price_booking%' THEN
    v_fail := v_fail || E'\n  - fin_quote_booking does not call fin_price_booking';
  ELSE v_pass := v_pass + 1; END IF;

  -- ── CONFIRMED PRODUCT DECISION: the margin block never reaches a customer ─
  -- The source is split at the privileged branch. Everything before it is what
  -- every authenticated caller receives; everything after it is what only an
  -- admin or the house's own owner receives. A restricted field that appears in
  -- the first half has escaped the gate, and this migration must not apply.
  v_idx := position('IF v_privileged THEN' in v_src);
  IF v_idx = 0 THEN
    v_fail := v_fail || E'\n  - fin_quote_booking has no "IF v_privileged THEN" branch; the margin gate is gone';
  ELSE
    v_pass := v_pass + 1;
    v_cust := left(v_src, v_idx - 1);
    v_priv := substr(v_src, v_idx);

    FOREACH v_t IN ARRAY ARRAY[
      'commission_rate', 'owner_entitlement', 'pima_gross_margin',
      'assumed_transfer_fee', 'projected_net_margin', 'required_min_margin',
      'cash_shortfall', 'deposit_standard', 'hold_amount', 'min_margin_rate'
    ] LOOP
      IF position('''' || v_t || '''' in v_cust) > 0 THEN
        v_fail := v_fail || E'\n  - RESTRICTED FIELD LEAKED TO CUSTOMERS: ' || v_t
                         || ' is emitted outside the privileged branch';
      ELSIF position('''' || v_t || '''' in v_priv) = 0 THEN
        v_fail := v_fail || E'\n  - ' || v_t || ' is no longer returned to admins/owners at all';
      ELSE v_pass := v_pass + 1; END IF;
    END LOOP;

    -- ...and the two booleans the customer flow depends on must stay ungated.
    FOREACH v_t IN ARRAY ARRAY['margin_warning', 'override_required'] LOOP
      IF position('''' || v_t || '''' in v_cust) = 0 THEN
        v_fail := v_fail || E'\n  - ' || v_t
                         || ' is no longer returned to customers; the guest flow needs it';
      ELSE v_pass := v_pass + 1; END IF;
    END LOOP;

    -- The gate itself: admin OR the house's own owner, nothing wider.
    IF v_src NOT LIKE '%public.is_admin(v_uid)%' OR v_src NOT LIKE '%q.owner_id = v_uid%' THEN
      v_fail := v_fail || E'\n  - the v_privileged test is no longer "is_admin(caller) OR caller owns the house"';
    ELSE v_pass := v_pass + 1; END IF;
  END IF;

  -- ── the shared helper writes nothing and locks nothing ──────────────────
  SELECT regexp_replace(p.prosrc, '--[^\n]*', '', 'g') INTO v_src
    FROM pg_proc p WHERE p.oid = to_regprocedure(price_sig);
  IF v_src ~* '\m(INSERT|UPDATE|DELETE|TRUNCATE)\M' THEN
    v_fail := v_fail || E'\n  - fin_price_booking contains a data-modifying statement';
  ELSE v_pass := v_pass + 1; END IF;

  IF v_src LIKE '%FOR UPDATE%' THEN
    v_fail := v_fail || E'\n  - fin_price_booking takes a row lock; the quote path must not';
  ELSE v_pass := v_pass + 1; END IF;

  -- ── nothing else was touched ─────────────────────────────────────────────
  SELECT count(*)::text INTO v_t
    FROM pg_attribute a
   WHERE a.attrelid = 'public.booking_financials'::regclass AND a.attgenerated = 's';
  IF v_t <> '10' THEN
    v_fail := v_fail || E'\n  - booking_financials now has ' || v_t || ' generated columns, expected 10';
  ELSE v_pass := v_pass + 1; END IF;

  SELECT count(*)::text INTO v_t
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relkind='v' AND c.relname LIKE 'fin\_%';
  IF v_t <> '4' THEN
    v_fail := v_fail || E'\n  - expected 4 fin_* views, found ' || v_t;
  ELSE v_pass := v_pass + 1; END IF;

  IF v_fail <> '' THEN
    RAISE EXCEPTION '0153 VERIFICATION FAILED (% of 43 passed):%', v_pass, v_fail;
  END IF;

  -- A check that never ran is a check that never failed. 43 is the number of
  -- assertions above; if the total moves without this constant moving with it,
  -- something was skipped rather than satisfied.
  IF v_pass <> 43 THEN
    RAISE EXCEPTION
      '0153 VERIFICATION INCOMPLETE: % assertions passed but 43 were expected — a check did not run',
      v_pass;
  END IF;

  RAISE NOTICE '0153 verification: 43 / 43 checks PASSED';
END;
$verify$;
