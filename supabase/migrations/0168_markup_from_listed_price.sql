-- 0168_markup_from_listed_price.sql
--
-- MARKUP means "the house's own price, plus an agreed percentage".
-- It did not, and this migration makes it so.
--
-- WHAT WAS WRONG
-- --------------
-- 0140/0148 implemented MARKUP as:
--
--     retail      = base_rate * quantity * (1 + markup_pct)
--     entitlement = base_rate * quantity
--
-- where base_rate is a number stored on the agreement, unrelated to anything
-- the house actually charges. fin_listed_price was called, its `quantity` was
-- used, and its `price` — the house's real listed price — was thrown away.
--
-- The consequence is not theoretical. On house_1789564533273 (150/night, 2
-- guests x 2 nights, listed 600):
--
--   base_rate 100, +25%  ->  retail 500   (BELOW the listed price)
--   base_rate 150, +25%  ->  retail 750   (browse shows 600, checkout 750)
--   base_rate 150, +25%, house re-priced to 999/night  ->  retail still 750
--
-- That last line is the proof: the listed price had no effect at all. An owner
-- raising their rate changed nothing, and the price a guest browsed was never
-- the price they would be charged.
--
-- WHAT IT IS NOW
-- --------------
--     listed      = fin_listed_price(...).price        -- the authoritative price
--     entitlement = listed
--     retail      = ROUND(listed * (1 + markup_pct), 2)
--     gross       = retail - entitlement               -- = listed * markup_pct
--
-- 150/night x 2 guests x 2 nights = 600 listed, +20% -> retail 720,
-- entitlement 600, PIMA gross 120. Per unit: 150 -> 180, house keeps 150,
-- PIMA 30, exactly as specified.
--
-- Because the base is now fin_listed_price itself, MARKUP inherits every
-- pricing rule for free and cannot drift from them: seasonal rates, day-use,
-- monthly student/staff pricing, chargeable-guest counts and night counts all
-- flow through unchanged. There is nothing left to keep in sync.
--
-- base_rate
-- ---------
-- It is no longer read by anything. Rather than leave a column that looks
-- authoritative but is ignored — the exact trap this migration exists to
-- remove — ha_model_columns is tightened so a MARKUP agreement must leave it
-- NULL. The column is retained but made unusable, which is the cheap half of
-- the cleanup; dropping it outright would change fin_price_booking's return
-- type and cascade into booking_financials and fin_booking_summary_admin for
-- no behavioural gain. See §5 for the check that it stays dead.
--
-- Safe to apply: there are zero MARKUP agreements and zero booking_financials
-- rows in production, so no stored economics change. Every live agreement is
-- COMMISSION, whose formula this migration does not touch.
--
-- DISPLAY CONSISTENCY
-- -------------------
-- MARKUP moves the customer price away from the number the house publishes, so
-- §4 adds fin_house_customer_rates() — the authoritative customer-facing rate
-- for browse and detail screens, computed server-side from the same agreement
-- the pricing engine uses. It returns prices only: no markup, no entitlement,
-- no margin. COMMISSION and NET_RATE houses come back unchanged, so wiring it
-- up is a no-op until a MARKUP agreement exists.
--
-- APPLIES AFTER: 0167_agreement_requests.sql
-- TOUCHES: ha_model_columns (CHECK), fin_price_booking (MARKUP branch only),
--          adds fin_house_customer_rates.
-- DOES NOT TOUCH: deposit, transfer fee, margin floor, settlement, promotions,
--          points, RPC signatures, RLS, or any stored row.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. PRECONDITIONS
-- ═══════════════════════════════════════════════════════════════════════════

DO $pre$
DECLARE v_missing TEXT := ''; v_n INTEGER;
BEGIN
  IF to_regprocedure('public.fin_price_booking(uuid,text,date,date,integer,integer[],uuid,integer)') IS NULL THEN
    v_missing := v_missing || E'\n  - fin_price_booking is absent (apply 0153 first)';
  END IF;
  IF to_regprocedure('public.fin_listed_price(text,date,date,integer)') IS NULL THEN
    v_missing := v_missing || E'\n  - fin_listed_price is absent';
  END IF;
  IF to_regclass('public.house_agreement_requests') IS NULL THEN
    v_missing := v_missing || E'\n  - house_agreement_requests is absent (apply 0154 first)';
  END IF;

  -- Retightening ha_model_columns validates every existing row. A stored
  -- MARKUP agreement would carry a base_rate and fail the new CHECK, so say
  -- that plainly here rather than letting ALTER TABLE fail obscurely.
  SELECT count(*) INTO v_n FROM public.house_agreements
   WHERE model_type = 'MARKUP' AND base_rate IS NOT NULL;
  IF v_n > 0 THEN
    v_missing := v_missing ||
      E'\n  - ' || v_n || ' MARKUP agreement(s) still carry a base_rate. Under the new'
   || E'\n    semantics their retail price would change. Close them and re-issue'
   || E'\n    with markup_pct before applying this migration.';
  END IF;

  IF v_missing <> '' THEN
    RAISE EXCEPTION 'PRECONDITIONS FAILED for 0155:%', v_missing;
  END IF;
  RAISE NOTICE '0155 preconditions: OK';
END;
$pre$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. base_rate is no longer part of MARKUP
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.house_agreements DROP CONSTRAINT IF EXISTS ha_model_columns;

ALTER TABLE public.house_agreements ADD CONSTRAINT ha_model_columns CHECK (
    (model_type = 'NET_RATE'   AND net_rate IS NOT NULL
                               AND base_rate IS NULL AND markup_pct IS NULL
                               AND commission_rate IS NULL)
 OR (model_type = 'MARKUP'     AND markup_pct IS NOT NULL
                               AND base_rate IS NULL          -- the base is the listed price
                               AND net_rate IS NULL AND commission_rate IS NULL)
 OR (model_type = 'COMMISSION' AND commission_rate IS NOT NULL
                               AND net_rate IS NULL AND base_rate IS NULL
                               AND markup_pct IS NULL)
);

COMMENT ON COLUMN public.house_agreements.base_rate IS
  'DEAD as of 0155. MARKUP derives its base from fin_listed_price; ha_model_columns forbids a value here. Retained only to avoid changing fin_price_booking''s return type.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 2b. THE SNAPSHOT'S OWN COPY OF THE SAME RULES
--
--     booking_financials carries its own model-shape and entitlement checks,
--     written in 0142 against the old MARKUP definition. Changing only the
--     agreement side leaves them contradicting the pricing path, and the
--     failure is not theoretical: with 2b absent, a MARKUP quote succeeds and
--     the booking then dies on bf_model_columns *after* the guest has been
--     quoted a price. Both are corrected here, in the same migration that
--     changes the semantics, because a snapshot rule that disagrees with the
--     engine writing it is worse than no rule.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.booking_financials DROP CONSTRAINT IF EXISTS bf_model_columns;

ALTER TABLE public.booking_financials ADD CONSTRAINT bf_model_columns CHECK (
    (model_type = 'NET_RATE'   AND resolved_rate IS NOT NULL
                               AND base_rate IS NULL AND markup_pct IS NULL
                               AND commission_rate IS NULL)
 OR (model_type = 'MARKUP'     AND markup_pct IS NOT NULL
                               AND base_rate IS NULL          -- the base is the listed price
                               AND resolved_rate IS NULL AND commission_rate IS NULL)
 OR (model_type = 'COMMISSION' AND commission_rate IS NOT NULL
                               AND resolved_rate IS NULL AND base_rate IS NULL
                               AND markup_pct IS NULL)
);

-- The entitlement check, restated for MARKUP rather than disabled.
--
-- The old MARKUP arm read `owner_entitlement = ROUND(base_rate * quantity, 2)`.
-- With base_rate NULL that comparison evaluates to NULL, and a CHECK passes on
-- NULL — so the constraint would have gone on existing while silently checking
-- nothing. Inverting it keeps a real assertion: under MARKUP the entitlement IS
-- the listed price, so retail must be exactly that grossed up by the markup.
ALTER TABLE public.booking_financials DROP CONSTRAINT IF EXISTS bf_entitlement_matches_model;

ALTER TABLE public.booking_financials ADD CONSTRAINT bf_entitlement_matches_model CHECK (
    (model_type = 'NET_RATE'   AND owner_entitlement = ROUND(resolved_rate * pricing_quantity, 2))
 OR (model_type = 'MARKUP'     AND retail_price      = ROUND(owner_entitlement * (1 + markup_pct), 2))
 OR (model_type = 'COMMISSION' AND owner_entitlement = ROUND(retail_price * (1 - commission_rate), 2))
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. THE PRICING PATH — MARKUP branch only
--
--    Same signature, same return shape, same everything else. 0153's single
--    shared path is preserved: fin_quote_booking and
--    create_booking_with_financials both continue to call this one function,
--    so the quote and the booking still cannot disagree.
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
  owner_id                  UUID,
  agreement_id              UUID,
  model_type                TEXT,
  currency                  CHAR(3),
  pricing_basis             TEXT,
  pricing_quantity          INTEGER,
  chargeable_guests         INTEGER,
  resolved_rate             NUMERIC,
  base_rate                 NUMERIC,
  markup_pct                NUMERIC,
  commission_rate           NUMERIC,
  retail_price              NUMERIC,
  promo_discount            NUMERIC,
  points_discount           NUMERIC,
  points_redeemed           INTEGER,
  owner_entitlement         NUMERIC,
  final_price               NUMERIC,
  deposit_rate              NUMERIC,
  min_margin_rate           NUMERIC,
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

  SELECT * INTO fs FROM public.financial_settings
   WHERE effective_to IS NULL ORDER BY effective_from DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'NO_FINANCIAL_SETTINGS'; END IF;

  SELECT h.owner_id INTO h_owner FROM public.houses h WHERE h.id = p_house_id;
  IF h_owner IS NULL THEN RAISE EXCEPTION 'HOUSE_NOT_FOUND: %', p_house_id; END IF;

  SELECT * INTO ag FROM public.house_agreements
   WHERE house_id = p_house_id
     AND effective_from <= CURRENT_DATE
     AND (effective_to IS NULL OR CURRENT_DATE < effective_to);
  IF NOT FOUND THEN
    RAISE EXCEPTION
      'NO_AGREEMENT: house % has no commercial agreement in force on % — a booking cannot be priced without one',
      p_house_id, CURRENT_DATE;
  END IF;

  SELECT * INTO pol FROM public.fin_effective_policy(p_house_id);

  IF pol.child_free_under_age IS NOT NULL AND p_child_ages IS NOT NULL THEN
    SELECT COUNT(*) INTO v_free_kids FROM unnest(p_child_ages) AS c(age)
     WHERE c.age < pol.child_free_under_age;
  END IF;
  v_chargeable := GREATEST(1, p_guests_count - v_free_kids);

  SELECT * INTO lp FROM public.fin_listed_price(p_house_id, p_check_in, p_check_out, v_chargeable);

  -- 0155. The listed price is the base for every model. MARKUP adds to it,
  -- COMMISSION takes a share of it, NET_RATE fixes the owner's cut of it —
  -- but all three start from the same authoritative number, so no model can
  -- quote a price unrelated to what the house publishes.
  IF ag.model_type = 'MARKUP' THEN
    v_entitle := lp.price;                                     -- the house keeps its own price
    v_retail  := ROUND(lp.price * (1 + ag.markup_pct), 2);     -- PIMA adds the agreed margin
  ELSIF ag.model_type = 'NET_RATE' THEN
    v_retail  := lp.price;
    v_entitle := ROUND(ag.net_rate * lp.quantity, 2);
  ELSE
    v_retail  := lp.price;
    v_entitle := ROUND(v_retail * (1 - ag.commission_rate), 2);
  END IF;

  IF p_promotion_id IS NOT NULL THEN
    v_promo := public.fin_resolve_promotion(
      p_promotion_id, p_house_id, v_retail, fs.currency, p_uid, NOW());
  END IF;

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

  -- Unchanged from 0153: every expression below is the generation expression
  -- of the corresponding booking_financials column, character for character.
  v_gross     := v_retail - v_entitle;
  v_dep_std   := ROUND(fs.deposit_rate * v_final);
  v_deposit   := GREATEST(v_dep_std, v_gross);
  v_hold      := GREATEST(0, v_entitle - (v_final - v_deposit));
  v_fee       := public.fin_transfer_fee(v_hold);
  v_req_min   := ROUND(v_final * fs.min_margin_rate, 2);
  v_proj_net  := v_gross - v_promo - v_pts_egp - v_fee;
  v_shortfall := GREATEST(0, v_entitle - v_final);
  v_warn      := v_proj_net < v_req_min;

  RETURN QUERY SELECT
    h_owner,
    ag.id,
    ag.model_type,
    fs.currency,
    lp.basis,
    lp.quantity,
    v_chargeable,
    CASE WHEN ag.model_type = 'NET_RATE'   THEN ag.net_rate        END,
    -- Always NULL now: ha_model_columns forbids a base_rate on MARKUP. Kept in
    -- the return shape so the signature is unchanged.
    ag.base_rate,
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
    v_final - v_deposit,
    v_hold,
    v_fee,
    v_req_min,
    v_proj_net,
    v_shortfall,
    v_warn,
    (v_warn OR v_shortfall > 0),
    pol.free_cancel_days,
    pol.partial_refund_days,
    pol.partial_refund_pct,
    pol.source,
    (p_check_in - pol.partial_refund_days)::date;
END;
$$;

REVOKE ALL ON FUNCTION public.fin_price_booking(UUID,TEXT,DATE,DATE,INTEGER,INTEGER[],UUID,INTEGER)
  FROM PUBLIC, anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. CUSTOMER-FACING DISPLAY RATES
--
--    Browse and detail screens show a price before any booking exists, so they
--    cannot use fin_quote_booking (which needs dates, guests and a signed-in
--    caller). This is the minimum surface that lets them show the true price:
--    the house's published rates with the agreement's markup already applied.
--
--    It returns PRICES ONLY. No markup_pct, no entitlement, no margin, no
--    agreement id. A COMMISSION or NET_RATE house, or a house with no
--    agreement at all, comes back with its rates untouched.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fin_house_customer_rates(p_house_ids TEXT[] DEFAULT NULL)
RETURNS TABLE (
  house_id                   TEXT,
  price_per_night_per_person NUMERIC,
  day_use_price_per_person   NUMERIC,
  monthly_rent               NUMERIC,
  seasonal_rates             JSONB
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    h.id,
    ROUND(h.price_per_night_per_person * m.mult, 2),
    ROUND(h.day_use_price_per_person   * m.mult, 2),
    ROUND(h.monthly_rent               * m.mult, 2),
    (SELECT COALESCE(jsonb_agg(
              CASE WHEN (e.elem->>'pricePerNight') ~ '^\d+(\.\d+)?$'
                   THEN jsonb_set(e.elem, '{pricePerNight}',
                          to_jsonb(ROUND((e.elem->>'pricePerNight')::numeric * m.mult, 2)))
                   ELSE e.elem END
              ORDER BY e.ord), '[]'::jsonb)
       FROM jsonb_array_elements(COALESCE(h.seasonal_rates, '[]'::jsonb))
            WITH ORDINALITY AS e(elem, ord))
  FROM public.houses h
  CROSS JOIN LATERAL (
    SELECT COALESCE((
      SELECT CASE WHEN a.model_type = 'MARKUP' THEN 1 + a.markup_pct ELSE 1 END
        FROM public.house_agreements a
       WHERE a.house_id = h.id
         AND a.effective_from <= CURRENT_DATE
         AND (a.effective_to IS NULL OR CURRENT_DATE < a.effective_to)
    ), 1) AS mult
  ) m
  WHERE h.status <> 'archived'
    AND (p_house_ids IS NULL OR h.id = ANY (p_house_ids));
$$;

COMMENT ON FUNCTION public.fin_house_customer_rates(TEXT[]) IS
  'Customer-facing display rates: the house''s published prices with any MARKUP applied. Prices only — discloses no markup, entitlement or margin. Safe for anonymous browse.';

REVOKE ALL ON FUNCTION public.fin_house_customer_rates(TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fin_house_customer_rates(TEXT[]) TO anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. VERIFICATION
-- ═══════════════════════════════════════════════════════════════════════════

DO $verify$
DECLARE
  v_fail TEXT := '';
  v_pass INTEGER := 0;
  v_t    TEXT;
  v_b    BOOLEAN;
  v_src  TEXT;
  price_sig CONSTANT TEXT := 'public.fin_price_booking(uuid,text,date,date,integer,integer[],uuid,integer)';
  rates_sig CONSTANT TEXT := 'public.fin_house_customer_rates(text[])';
BEGIN
  -- ── the constraint now forbids a MARKUP base_rate ───────────────────────
  SELECT pg_get_constraintdef(oid) INTO v_t FROM pg_constraint
   WHERE conrelid = 'public.house_agreements'::regclass AND conname = 'ha_model_columns';
  IF v_t IS NULL THEN
    v_fail := v_fail || E'\n  - ha_model_columns is missing';
  ELSIF v_t !~ 'markup_pct IS NOT NULL' OR v_t !~ 'base_rate IS NULL' THEN
    v_fail := v_fail || E'\n  - ha_model_columns does not require markup_pct and forbid base_rate';
  ELSE v_pass := v_pass + 1; END IF;

  -- ── MARKUP now prices from the listed price, and base_rate is unread ────
  SELECT regexp_replace(p.prosrc, '--[^\n]*', '', 'g') INTO v_src
    FROM pg_proc p WHERE p.oid = to_regprocedure(price_sig);
  IF v_src IS NULL THEN
    v_fail := v_fail || E'\n  - fin_price_booking not found';
  ELSE
    IF v_src !~ 'v_retail\s*:=\s*ROUND\(lp\.price \* \(1 \+ ag\.markup_pct\), 2\)' THEN
      v_fail := v_fail || E'\n  - MARKUP retail is not ROUND(lp.price * (1 + markup_pct), 2)';
    ELSE v_pass := v_pass + 1; END IF;

    IF v_src !~ 'v_entitle\s*:=\s*lp\.price;' THEN
      v_fail := v_fail || E'\n  - MARKUP entitlement is not the listed price';
    ELSE v_pass := v_pass + 1; END IF;

    IF v_src ~ 'ag\.base_rate \*' THEN
      v_fail := v_fail || E'\n  - fin_price_booking still multiplies by ag.base_rate';
    ELSE v_pass := v_pass + 1; END IF;

    -- COMMISSION and NET_RATE must be exactly as 0153 left them.
    IF v_src !~ 'v_entitle\s*:=\s*ROUND\(v_retail \* \(1 - ag\.commission_rate\), 2\)' THEN
      v_fail := v_fail || E'\n  - COMMISSION entitlement changed';
    ELSE v_pass := v_pass + 1; END IF;

    IF v_src !~ 'v_entitle\s*:=\s*ROUND\(ag\.net_rate \* lp\.quantity, 2\)' THEN
      v_fail := v_fail || E'\n  - NET_RATE entitlement changed';
    ELSE v_pass := v_pass + 1; END IF;

    -- The downstream rules must be untouched.
    IF v_src !~ 'v_deposit\s*:=\s*GREATEST\(v_dep_std, v_gross\)'
       OR v_src !~ 'v_hold\s*:=\s*GREATEST\(0, v_entitle - \(v_final - v_deposit\)\)'
       OR v_src !~ 'v_fee\s*:=\s*public\.fin_transfer_fee\(v_hold\)'
       OR v_src !~ 'v_proj_net\s*:=\s*v_gross - v_promo - v_pts_egp - v_fee' THEN
      v_fail := v_fail || E'\n  - a downstream deposit/hold/fee/margin rule changed';
    ELSE v_pass := v_pass + 1; END IF;

    IF v_src ~* '\m(INSERT|UPDATE|DELETE|TRUNCATE|FOR UPDATE)\M' THEN
      v_fail := v_fail || E'\n  - fin_price_booking gained a write or a lock';
    ELSE v_pass := v_pass + 1; END IF;
  END IF;

  -- ── security posture of the pricing path is unchanged ───────────────────
  SELECT p.provolatile::text INTO v_t FROM pg_proc p WHERE p.oid = to_regprocedure(price_sig);
  IF v_t <> 's' THEN v_fail := v_fail || E'\n  - fin_price_booking is no longer STABLE';
  ELSE v_pass := v_pass + 1; END IF;
  SELECT p.prosecdef INTO v_b FROM pg_proc p WHERE p.oid = to_regprocedure(price_sig);
  IF NOT COALESCE(v_b,FALSE) THEN v_fail := v_fail || E'\n  - fin_price_booking is not SECURITY DEFINER';
  ELSE v_pass := v_pass + 1; END IF;
  IF has_function_privilege('authenticated', to_regprocedure(price_sig), 'EXECUTE')
     OR has_function_privilege('anon', to_regprocedure(price_sig), 'EXECUTE') THEN
    v_fail := v_fail || E'\n  - fin_price_booking became client-executable';
  ELSE v_pass := v_pass + 1; END IF;

  -- ── the shared path is still shared ─────────────────────────────────────
  SELECT (p.prosrc LIKE '%fin_price_booking%') INTO v_b FROM pg_proc p
   WHERE p.oid = to_regprocedure('public.fin_quote_booking(text,date,date,integer,integer[],uuid,integer)');
  IF NOT COALESCE(v_b,FALSE) THEN v_fail := v_fail || E'\n  - fin_quote_booking no longer calls the shared path';
  ELSE v_pass := v_pass + 1; END IF;
  SELECT (p.prosrc LIKE '%fin_price_booking%') INTO v_b FROM pg_proc p
   WHERE p.oid = to_regprocedure('public.create_booking_with_financials(text,text,date,date,integer,text,integer[],uuid,integer,text)');
  IF NOT COALESCE(v_b,FALSE) THEN v_fail := v_fail || E'\n  - create_booking_with_financials no longer calls the shared path';
  ELSE v_pass := v_pass + 1; END IF;

  -- ── the display surface exists, is safe, and leaks nothing ──────────────
  IF to_regprocedure(rates_sig) IS NULL THEN
    v_fail := v_fail || E'\n  - fin_house_customer_rates was not created';
  ELSE
    v_pass := v_pass + 1;
    SELECT (p.proconfig::text LIKE '%search_path=public, pg_temp%') INTO v_b
      FROM pg_proc p WHERE p.oid = to_regprocedure(rates_sig);
    IF NOT COALESCE(v_b,FALSE) THEN v_fail := v_fail || E'\n  - fin_house_customer_rates does not pin search_path';
    ELSE v_pass := v_pass + 1; END IF;

    IF NOT has_function_privilege('anon', to_regprocedure(rates_sig), 'EXECUTE')
       OR NOT has_function_privilege('authenticated', to_regprocedure(rates_sig), 'EXECUTE') THEN
      v_fail := v_fail || E'\n  - fin_house_customer_rates is not callable by browse';
    ELSE v_pass := v_pass + 1; END IF;

    -- Its return shape must expose prices and nothing else.
    SELECT string_agg(a.attname, ',' ORDER BY a.attnum) INTO v_t
      FROM pg_proc p
      JOIN unnest(p.proallargtypes, p.proargmodes, p.proargnames)
             WITH ORDINALITY AS a(atttypid, attmode, attname, attnum) ON TRUE
     WHERE p.oid = to_regprocedure(rates_sig) AND a.attmode = 't';
    IF v_t IS DISTINCT FROM
       'house_id,price_per_night_per_person,day_use_price_per_person,monthly_rent,seasonal_rates' THEN
      v_fail := v_fail || E'\n  - fin_house_customer_rates return shape changed: ' || COALESCE(v_t,'?');
    ELSE v_pass := v_pass + 1; END IF;
  END IF;

  -- ── nothing else moved ──────────────────────────────────────────────────
  -- ── the snapshot's rules were corrected too, not just the agreement's ──
  SELECT pg_get_constraintdef(oid) INTO v_t FROM pg_constraint
   WHERE conrelid = 'public.booking_financials'::regclass AND conname = 'bf_model_columns';
  IF v_t IS NULL THEN
    v_fail := v_fail || E'
  - bf_model_columns is missing';
  ELSIF v_t ~ 'base_rate IS NOT NULL' OR v_t !~ 'markup_pct IS NOT NULL' THEN
    v_fail := v_fail || E'
  - bf_model_columns still demands a MARKUP base_rate; MARKUP bookings would fail';
  ELSE v_pass := v_pass + 1; END IF;

  SELECT pg_get_constraintdef(oid) INTO v_t FROM pg_constraint
   WHERE conrelid = 'public.booking_financials'::regclass AND conname = 'bf_entitlement_matches_model';
  IF v_t IS NULL THEN
    v_fail := v_fail || E'
  - bf_entitlement_matches_model is missing';
  ELSIF v_t ~ 'base_rate' THEN
    v_fail := v_fail || E'
  - bf_entitlement_matches_model still references base_rate; it would validate nothing for MARKUP';
  ELSIF v_t !~ 'retail_price = round' THEN
    v_fail := v_fail || E'
  - bf_entitlement_matches_model does not assert retail = entitlement * (1 + markup_pct)';
  ELSE v_pass := v_pass + 1; END IF;

  SELECT count(*)::text INTO v_t FROM pg_attribute
   WHERE attrelid = 'public.booking_financials'::regclass AND attgenerated = 's';
  IF v_t <> '10' THEN v_fail := v_fail || E'\n  - booking_financials generated columns changed (' || v_t || ')';
  ELSE v_pass := v_pass + 1; END IF;

  SELECT count(*)::text INTO v_t FROM pg_policy WHERE polrelid = 'public.house_agreements'::regclass;
  IF v_t <> '3' THEN v_fail := v_fail || E'\n  - house_agreements policies changed (' || v_t || ')';
  ELSE v_pass := v_pass + 1; END IF;

  IF v_fail <> '' THEN
    RAISE EXCEPTION '0155 VERIFICATION FAILED (% of 21 passed):%', v_pass, v_fail;
  END IF;
  IF v_pass <> 21 THEN
    RAISE EXCEPTION
      '0155 VERIFICATION INCOMPLETE: % assertions passed but 21 were expected — a check did not run',
      v_pass;
  END IF;
  RAISE NOTICE '0155 verification: 21 / 21 checks PASSED';
END;
$verify$;
