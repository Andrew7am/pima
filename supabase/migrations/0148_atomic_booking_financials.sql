-- ─────────────────────────────────────────────────────────────────────────────
-- 0148 — ATOMIC BOOKING CREATION (the authoritative boundary)
--
-- Everything before this migration built structure. This is the door money
-- actually walks through, and the whole point is that it is ONE door and ONE
-- transaction.
--
-- The flow it replaces did this:
--
--     insert booking (client-priced)  →  separately call redeem_points()
--                                     →  swallow the error
--
-- which is how a booking could exist at a discounted price with the points
-- never deducted (FIN-023). Here the booking, its financial snapshot, its
-- promotion, the points deduction, the points history row, the ledger entry and
-- the settlement hold are one atomic act. Any failure and none of it happened.
--
-- ── THE CLIENT NAMES NOTHING ────────────────────────────────────────────────
--
-- Not the price, not the owner, not the entitlement, not the deposit, not the
-- discount, not the margin. It names a house, some dates, a party, optionally
-- one promotion and some points. Every figure is derived here from the
-- agreement, the pricing engine and the settings in force.
--
-- ── PD-19: AT MOST ONE PROMOTION ────────────────────────────────────────────
--
-- The parameter is a single UUID, not an array. Promotion + points remains
-- allowed — points are not a promotion — but promotion + promotion cannot be
-- expressed, which is the locked rule made structural rather than checked.
--
-- ── WHY THE LEGACY TRIGGERS ARE GUARDED ─────────────────────────────────────
--
-- validate_booking_price would overwrite deposit_amount with 15% of total and
-- reject any price below 90% of the house's listed rate; stamp_booking_commission
-- would stamp 5% onto NET_RATE and MARKUP bookings that have no commission at
-- all. Both were proven against live Postgres before this migration was written.
--
-- Each now begins with the guard protect_booking_privileged_columns has used
-- since 0116: `IF current_user <> 'authenticated' THEN RETURN NEW; END IF;`.
-- The definer path — this RPC, which has already done the authoritative work —
-- passes through. The direct authenticated client path is byte-for-byte
-- unchanged; the guarded bodies below were extracted from 0128 and 0113
-- mechanically, not retyped.
--
-- The guard is not the safety story. The RPC validates and persists every
-- authoritative value itself; the guard only stops old arithmetic overwriting
-- new arithmetic.
--
-- ── WHAT IS DELIBERATELY NOT POSTED ─────────────────────────────────────────
--
-- No customer_payment entry. Creating a booking establishes an amount DUE, not
-- money received; cash arrives through the payment flow. The only ledger entry
-- this RPC makes is the points redemption, and only when points are spent.
-- Promotion expense posts with the payment, per the approved posting rules.
-- ─────────────────────────────────────────────────────────────────────────────


-- ═══ 1. LEGACY GUARDS ═══════════════════════════════════════════════════════
-- Bodies below are the live 0128 / 0113 definitions with only the guard added.

CREATE OR REPLACE FUNCTION public.validate_booking_price()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  h_type     TEXT;
  h_night    NUMERIC;
  h_month    NUMERIC;
  h_day      NUMERIC;
  h_seasonal JSONB;
  h_disc     NUMERIC;
  h_disc_from DATE;
  h_disc_to   DATE;
  unit     NUMERIC;
  qty      INTEGER;
  expected NUMERIC;
  min_allowed NUMERIC;
  v_deposit    NUMERIC;
  v_max_redeem NUMERIC;
  v_applied    NUMERIC;
  v_free_kids  INTEGER;
  v_chargeable INTEGER;
BEGIN
  -- ── ADDED BY 0148 ────────────────────────────────────────────────────────
  -- The authoritative RPC has already resolved the agreement, priced the stay,
  -- applied PIMA-funded discounts and written booking_financials. Re-deriving
  -- any of that here would overwrite it with the legacy 15% deposit and the
  -- legacy floor computed from the house's listed price. Same precedent as
  -- protect_booking_privileged_columns (0116): trust the definer path.
  -- The direct authenticated client path below is unchanged.
  IF current_user <> 'authenticated' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.total_price  = OLD.total_price
     AND NEW.guests_count = OLD.guests_count
     AND NEW.check_in     = OLD.check_in
     AND NEW.check_out    = OLD.check_out THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(deposit_rate, 0.15), COALESCE(max_redemption_pct, 0.10)
    INTO v_deposit, v_max_redeem
    FROM public.platform_settings WHERE id = 1;
  v_deposit    := COALESCE(v_deposit, 0.15);
  v_max_redeem := COALESCE(v_max_redeem, 0.10);

  SELECT property_type, price_per_night_per_person, monthly_rent,
         day_use_price_per_person, COALESCE(seasonal_rates, '[]'::jsonb),
         COALESCE(discount_pct, 0), discount_starts_at, discount_ends_at
    INTO h_type, h_night, h_month, h_day, h_seasonal,
         h_disc, h_disc_from, h_disc_to
    FROM public.houses WHERE id = NEW.house_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- How many of the party actually pay. Read from the booking's OWN stamped
  -- rule, not from the house — bk_stamp_policy has already run, and going back
  -- to the house here would let an owner who changed the rule mid-flight
  -- invalidate a price that was correct when it was quoted. NULL rule, or a
  -- party that was never broken down, yields zero free children and therefore
  -- precisely the arithmetic this function did before migration 0128.
  v_free_kids := 0;
  IF NEW.policy_child_free_under_age IS NOT NULL AND NEW.child_ages IS NOT NULL THEN
    SELECT COUNT(*) INTO v_free_kids
      FROM unnest(NEW.child_ages) AS c(age)
     WHERE c.age < NEW.policy_child_free_under_age;
  END IF;
  -- Cannot fall below one: stamp_booking_policy has already rejected any party
  -- without an adult, and adults are never free.
  v_chargeable := NEW.guests_count - v_free_kids;

  IF h_type IN ('student', 'staff') THEN
    qty  := GREATEST(1, ROUND((NEW.check_out - NEW.check_in)::numeric / 30))::int;
    unit := COALESCE(h_month, 1500);
    expected := unit * v_chargeable * qty;

  ELSIF NEW.check_out = NEW.check_in THEN
    IF TG_OP = 'INSERT' AND h_day IS NULL THEN
      RAISE EXCEPTION 'DAY_USE_NOT_OFFERED: house % has no day rate', NEW.house_id;
    END IF;
    expected := COALESCE(h_day, 0) * v_chargeable;

  ELSE
    SELECT COALESCE(SUM(COALESCE(sr.rate, COALESCE(h_night, 0))), 0) * v_chargeable
      INTO expected
      FROM generate_series(NEW.check_in, NEW.check_out - 1, '1 day'::interval) AS g(day)
      LEFT JOIN LATERAL (
        SELECT (r.elem->>'pricePerNight')::numeric AS rate
        FROM jsonb_array_elements(h_seasonal) WITH ORDINALITY AS r(elem, ord)
        WHERE (r.elem->>'startDate') ~ '^\d{4}-\d{2}-\d{2}$'
          AND (r.elem->>'endDate')   ~ '^\d{4}-\d{2}-\d{2}$'
          AND (r.elem->>'pricePerNight') ~ '^\d+(\.\d+)?$'
          AND g.day::date >= (r.elem->>'startDate')::date
          AND g.day::date <= (r.elem->>'endDate')::date
        ORDER BY r.ord
        LIMIT 1
      ) sr ON TRUE;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF h_disc > 0
       AND (h_disc_from IS NULL OR NEW.check_in >= h_disc_from)
       AND (h_disc_to   IS NULL OR NEW.check_in <= h_disc_to) THEN
      NEW.discount_pct_applied := h_disc;
    ELSE
      NEW.discount_pct_applied := 0;
    END IF;
  ELSE
    NEW.discount_pct_applied := COALESCE(OLD.discount_pct_applied, 0);
  END IF;

  v_applied := COALESCE(NEW.discount_pct_applied, 0);
  IF v_applied > 0 THEN
    NEW.price_before_discount := expected;
    expected := ROUND(expected * (1 - v_applied));
  ELSE
    NEW.price_before_discount := NULL;
  END IF;

  min_allowed := FLOOR(expected * (1 - v_max_redeem)) - 1;

  IF NEW.total_price < min_allowed THEN
    RAISE EXCEPTION 'PRICE_TOO_LOW: expected at least %, got % (house rate math for % chargeable of % guests)',
      min_allowed, NEW.total_price, v_chargeable, NEW.guests_count;
  END IF;

  NEW.deposit_amount := ROUND(NEW.total_price * v_deposit);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.stamp_booking_commission()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public, pg_temp AS $$
BEGIN
  -- ── ADDED BY 0148 ────────────────────────────────────────────────────────
  -- booking_financials.commission_rate carries the agreement's rate, which is
  -- NULL for NET_RATE and MARKUP. Left unguarded this would COALESCE 5% onto
  -- them, inventing a commission those models do not have.
  IF current_user <> 'authenticated' THEN
    RETURN NEW;
  END IF;

  -- INSERT: stamp the rate in force today.
  IF TG_OP = 'INSERT' THEN
    NEW.commission_rate := COALESCE(
      NEW.commission_rate,
      (SELECT commission_rate FROM public.platform_settings WHERE id = 1),
      0.05);
    RETURN NEW;
  END IF;
  -- UPDATE: the agreed rate is not negotiable after the fact. Anyone editing
  -- a booking — owner, admin, a future migration — gets the original back.
  NEW.commission_rate := OLD.commission_rate;
  RETURN NEW;
END;
$$;


-- ═══ 2. IDEMPOTENCY ═════════════════════════════════════════════════════════
-- A booking with no points and no promotion posts no ledger entry, so
-- fin_transactions.idempotency_key cannot carry this on its own. The
-- fingerprint is what makes a replay safe: same key and same inputs returns the
-- original booking; same key and DIFFERENT inputs is refused rather than
-- quietly answered with someone else's booking.
CREATE TABLE IF NOT EXISTS public.booking_idempotency (
  idempotency_key TEXT PRIMARY KEY,
  booking_id      TEXT NOT NULL REFERENCES public.bookings(id) ON DELETE RESTRICT,
  fingerprint     TEXT NOT NULL,
  created_by      UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.booking_idempotency ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "booking_idempotency_admin_read" ON public.booking_idempotency;
CREATE POLICY "booking_idempotency_admin_read" ON public.booking_idempotency
  FOR SELECT USING (public.is_admin(auth.uid()));

REVOKE ALL ON TABLE public.booking_idempotency FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.booking_idempotency TO authenticated;


-- ═══ 3. PRICING HELPERS ═════════════════════════════════════════════════════

-- The policy in force for a house: its own value where set, the platform's
-- otherwise. Mirrors lib/bookingPolicy.resolvePolicy, but reads the cancellation
-- terms from financial_settings (PD-10: 21 / 7 / 50%) rather than the legacy
-- platform_settings row.
CREATE OR REPLACE FUNCTION public.fin_effective_policy(p_house_id TEXT)
RETURNS TABLE (
  free_cancel_days      INTEGER,
  partial_refund_days   INTEGER,
  partial_refund_pct    NUMERIC,
  child_free_under_age  INTEGER,
  source                TEXT
) LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE h RECORD; f RECORD;
BEGIN
  SELECT * INTO f FROM public.financial_settings
   WHERE effective_to IS NULL ORDER BY effective_from DESC LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NO_FINANCIAL_SETTINGS: no open financial_settings version';
  END IF;

  SELECT hs.free_cancel_days, hs.partial_refund_days, hs.partial_refund_pct, hs.child_free_under_age
    INTO h FROM public.houses hs WHERE hs.id = p_house_id;

  RETURN QUERY SELECT
    COALESCE(h.free_cancel_days,    f.free_cancel_days),
    COALESCE(h.partial_refund_days, f.partial_refund_days),
    COALESCE(h.partial_refund_pct,  f.partial_refund_pct),
    h.child_free_under_age,
    CASE WHEN h.free_cancel_days IS NOT NULL THEN 'property' ELSE 'platform' END;
END;
$$;

-- What the house lists this stay at, for `chargeable` paying guests. The same
-- three bases validate_booking_price and lib/pricing.ts already agree on, and no
-- fourth was invented. Returns the price and the basis/quantity that produced it.
--
-- This duplicates the legacy trigger's arithmetic for as long as both paths
-- exist. That is transitional and ends when the legacy path is retired; until
-- then the two are kept identical deliberately.
CREATE OR REPLACE FUNCTION public.fin_listed_price(
  p_house_id   TEXT,
  p_check_in   DATE,
  p_check_out  DATE,
  p_chargeable INTEGER
) RETURNS TABLE (price NUMERIC, basis TEXT, quantity INTEGER)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  h        RECORD;
  v_qty    INTEGER;
  v_price  NUMERIC;
BEGIN
  SELECT property_type, price_per_night_per_person, monthly_rent,
         day_use_price_per_person, COALESCE(seasonal_rates, '[]'::jsonb) AS seasonal
    INTO h FROM public.houses WHERE id = p_house_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'HOUSE_NOT_FOUND: %', p_house_id;
  END IF;

  IF h.property_type IN ('student', 'staff') THEN
    v_qty   := p_chargeable * GREATEST(1, ROUND((p_check_out - p_check_in)::numeric / 30))::int;
    v_price := COALESCE(h.monthly_rent, 1500) * v_qty;
    RETURN QUERY SELECT ROUND(v_price, 2), 'MONTHLY'::TEXT, v_qty;

  ELSIF p_check_out = p_check_in THEN
    IF h.day_use_price_per_person IS NULL THEN
      RAISE EXCEPTION 'DAY_USE_NOT_OFFERED: house % has no day rate', p_house_id;
    END IF;
    v_qty   := p_chargeable;
    v_price := h.day_use_price_per_person * v_qty;
    RETURN QUERY SELECT ROUND(v_price, 2), 'DAY_USE_PER_PERSON'::TEXT, v_qty;

  ELSE
    -- Per night, seasonal rate where one covers the night, base rate otherwise.
    SELECT COALESCE(SUM(COALESCE(sr.rate, COALESCE(h.price_per_night_per_person, 0))), 0) * p_chargeable
      INTO v_price
      FROM generate_series(p_check_in, p_check_out - 1, '1 day'::interval) AS g(day)
      LEFT JOIN LATERAL (
        SELECT (r.elem->>'pricePerNight')::numeric AS rate
        FROM jsonb_array_elements(h.seasonal) WITH ORDINALITY AS r(elem, ord)
        WHERE (r.elem->>'startDate') ~ '^\d{4}-\d{2}-\d{2}$'
          AND (r.elem->>'endDate')   ~ '^\d{4}-\d{2}-\d{2}$'
          AND (r.elem->>'pricePerNight') ~ '^\d+(\.\d+)?$'
          AND g.day::date >= (r.elem->>'startDate')::date
          AND g.day::date <= (r.elem->>'endDate')::date
        ORDER BY r.ord LIMIT 1
      ) sr ON TRUE;
    v_qty := p_chargeable * (p_check_out - p_check_in);
    RETURN QUERY SELECT ROUND(v_price, 2), 'PER_NIGHT_PER_PERSON'::TEXT, v_qty;
  END IF;
END;
$$;


-- ═══ 4. THE ATOMIC RPC ══════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.create_booking_with_financials(
  p_booking_id      TEXT,
  p_house_id        TEXT,
  p_check_in        DATE,
  p_check_out       DATE,
  p_guests_count    INTEGER,
  p_idempotency_key TEXT,
  p_child_ages      INTEGER[] DEFAULT NULL,
  p_promotion_id    UUID      DEFAULT NULL,   -- PD-19: exactly one, never an array
  p_points          INTEGER   DEFAULT 0,
  p_override_reason TEXT      DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_uid        UUID := auth.uid();
  v_admin      BOOLEAN;
  v_fp         TEXT;
  v_prior      RECORD;
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
  v_release    DATE;
  v_txn        UUID;
  v_rows       INTEGER;
  v_override   UUID := NULL;
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

  -- ── Settings, house, agreement ────────────────────────────────────────────
  SELECT * INTO fs FROM public.financial_settings
   WHERE effective_to IS NULL ORDER BY effective_from DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'NO_FINANCIAL_SETTINGS'; END IF;

  SELECT owner_id INTO h_owner FROM public.houses WHERE id = p_house_id;
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

  -- ── Party and pricing ─────────────────────────────────────────────────────
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

  -- ── The single promotion (PD-19) ──────────────────────────────────────────
  IF p_promotion_id IS NOT NULL THEN
    v_promo := public.fin_resolve_promotion(
      p_promotion_id, p_house_id, v_retail, fs.currency, v_uid, NOW());
  END IF;

  -- ── Points ────────────────────────────────────────────────────────────────
  IF p_points > 0 THEN
    -- The lock is the concurrency story: two bookings cannot both read the same
    -- balance and both spend it.
    SELECT id, points INTO u FROM public.users WHERE id = v_uid FOR UPDATE;
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

  -- ── Margin, shortfall, override ───────────────────────────────────────────
  v_gross     := v_retail - v_entitle;
  v_req_min   := ROUND(v_final * fs.min_margin_rate, 2);
  v_proj_net  := v_gross - v_promo - v_pts_egp - fs.transfer_fee_cap;
  v_shortfall := GREATEST(0, v_entitle - v_final);
  v_warn      := v_proj_net < v_req_min;

  IF v_warn OR v_shortfall > 0 THEN
    IF NOT v_admin THEN
      RAISE EXCEPTION
        'OVERRIDE_REQUIRED: projected net margin % against a required minimum of %, cash shortfall % — an authorised administrator must approve this booking',
        v_proj_net, v_req_min, v_shortfall;
    END IF;
    IF p_override_reason IS NULL OR length(btrim(p_override_reason)) = 0 THEN
      RAISE EXCEPTION 'OVERRIDE_REASON_REQUIRED';
    END IF;
    v_override := v_uid;
  END IF;

  v_release := p_check_in - pol.partial_refund_days;

  -- ── Booking ───────────────────────────────────────────────────────────────
  -- Non-financial triggers still run: capacity, past dates, the child-policy
  -- stamp and the rate limit (which reads auth.uid(), not the database role, so
  -- it remains effective here).
  INSERT INTO public.bookings
    (id, house_id, house_name, user_id, user_name, check_in, check_out, guests_count,
     child_ages, total_price, deposit_amount, status, payment_status, deposit_paid)
  SELECT p_booking_id, p_house_id, h.name, v_uid, COALESCE(us.name, ''),
         p_check_in, p_check_out, p_guests_count, p_child_ages,
         v_final, 0, 'pending', 'unpaid', FALSE
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
    (p_booking_id, p_house_id, h_owner, ag.id, ag.model_type, fs.currency,
     lp.basis, lp.quantity,
     CASE WHEN ag.model_type = 'NET_RATE'   THEN ag.net_rate        END,
     CASE WHEN ag.model_type = 'MARKUP'     THEN ag.base_rate       END,
     CASE WHEN ag.model_type = 'MARKUP'     THEN ag.markup_pct      END,
     CASE WHEN ag.model_type = 'COMMISSION' THEN ag.commission_rate END,
     v_retail, v_promo, v_pts_egp, COALESCE(p_points, 0), v_entitle,
     fs.deposit_rate, fs.min_margin_rate, fs.transfer_fee_cap,
     pol.free_cancel_days, pol.partial_refund_days, pol.partial_refund_pct,
     pol.source, v_release,
     v_override, CASE WHEN v_override IS NOT NULL THEN p_override_reason END,
     CASE WHEN v_override IS NOT NULL THEN NOW() END);
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN RAISE EXCEPTION 'SNAPSHOT_INSERT_FAILED: % rows', v_rows; END IF;

  -- ── Promotion linkage ─────────────────────────────────────────────────────
  IF p_promotion_id IS NOT NULL THEN
    INSERT INTO public.booking_promotions
      (booking_id, promotion_id, discount_amount, currency, applied_by)
    VALUES (p_booking_id, p_promotion_id, v_promo, fs.currency, v_uid);
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN RAISE EXCEPTION 'PROMOTION_LINK_FAILED: % rows', v_rows; END IF;
  END IF;

  -- ── Points: deduct, record, post ──────────────────────────────────────────
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
    VALUES (v_txn, 'points_redemption_cost', p_booking_id, p_house_id, h_owner, v_uid,
            fs.currency, 'booking', p_booking_id,
            'pts:redeem:' || p_booking_id, 'points redeemed against booking');
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN RAISE EXCEPTION 'LEDGER_HEADER_FAILED: % rows', v_rows; END IF;

    INSERT INTO public.fin_transaction_legs (txn_id, account, amount, party_id) VALUES
      (v_txn, 'POINTS_LIABILITY',      v_pts_egp, v_uid),
      (v_txn, 'PIMA_POINTS_EXPENSE',   v_pts_egp, NULL),
      (v_txn, 'PIMA_LOYALTY_EXPENSE', -v_pts_egp, NULL),
      (v_txn, 'POINTS_APPLIED',       -v_pts_egp, v_uid);
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


-- ═══ 5. PRIVILEGES ══════════════════════════════════════════════════════════
-- Migration 0097 grants EXECUTE on ALL FUNCTIONS to anon and authenticated, so
-- every function here arrives publicly callable unless taken back.
REVOKE ALL ON FUNCTION public.fin_effective_policy(TEXT)                    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fin_listed_price(TEXT, DATE, DATE, INTEGER)   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_booking_with_financials(
  TEXT, TEXT, DATE, DATE, INTEGER, TEXT, INTEGER[], UUID, INTEGER, TEXT)    FROM PUBLIC, anon, authenticated;

-- A signed-in guest books; anonymous does not. The RPC authorises internally and
-- takes the acting user from auth.uid(), never from a parameter.
GRANT EXECUTE ON FUNCTION public.create_booking_with_financials(
  TEXT, TEXT, DATE, DATE, INTEGER, TEXT, INTEGER[], UUID, INTEGER, TEXT) TO authenticated;


COMMENT ON FUNCTION public.create_booking_with_financials(
  TEXT, TEXT, DATE, DATE, INTEGER, TEXT, INTEGER[], UUID, INTEGER, TEXT) IS
  'The authoritative booking boundary. Derives agreement, retail, entitlement, promotion, points, deposit, margin and shortfall server-side, then writes booking, booking_financials, at most one booking_promotion (PD-19), the points deduction, points_history, the four-leg redemption entry and the settlement hold — in one transaction. Creates no customer_payment: a booking establishes an amount due, not money received.';

COMMENT ON TABLE public.booking_idempotency IS
  'Replay protection for create_booking_with_financials. Same key and same fingerprint returns the original booking; same key with different financial inputs is refused rather than answered with the wrong booking.';
