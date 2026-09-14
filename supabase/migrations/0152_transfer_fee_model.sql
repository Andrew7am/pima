-- ============================================================
-- 0152 — TRANSFER FEE MODEL
--
-- THE DEFECT
--   0148 projected the booking-time margin by subtracting the flat
--   financial_settings.transfer_fee_cap (20.00). That is not the fee. The real
--   policy is GREATEST(0.50, amount * 0.001), and the amount is the settlement
--   HOLD -- what PIMA actually wires -- not retail and not the owner
--   entitlement, because the customer pays the arrival balance direct to the
--   house (PD-04).
--
--   The consequence was concrete: a 480 EGP booking at 5% commission yields a
--   24.00 gross margin, and subtracting a 20.00 assumption left 4.00 against a
--   9.60 floor -- OVERRIDE_REQUIRED on an ordinary booking. Under the real
--   policy the fee is 0.50, the net margin is 23.50, and it passes. The old
--   assumption forced an override on every booking below ~667 EGP.
--
-- WHY THE CAP SURVIVES
--   transfer_fee_cap is NOT a maximum fee and is deliberately left in place at
--   20.00. The Phase 2 design review records "transfer fee exceeds cap ->
--   admin exception, actual fee recorded" -- a rule that is only meaningful if
--   the actual cost can exceed it. The cap is a payout-time budget alert
--   threshold. It is not used to compute a fee anywhere, and this migration
--   does not apply LEAST(cap, ...) to the projection.
--
-- WHAT THIS MIGRATION DOES NOT TOUCH
--   booking_financials is untouched: no DDL, no constraint change, and none of
--   its generated columns are dropped or rebuilt. projected_net_margin,
--   margin_warning, override_required, required_min_margin, cash_shortfall and
--   bf_override_when_required all read assumed_transfer_fee as a stored value,
--   so writing the computed fee into that column corrects every one of them
--   automatically. This matters on PostgreSQL 17.6, which has no
--   ALTER COLUMN ... SET EXPRESSION -- altering a generated column there would
--   mean DROP/ADD, cascading into the 0149 views and reordering the table.
--   None of that is necessary.
--
--   No actual fee is posted to the ledger here. PIMA_TRANSFER_FEE_EXPENSE and
--   fin_transactions.kind = 'transfer_fee' already exist and stay untouched;
--   posting the real bank cost belongs to the settlement RPC, which does not
--   exist yet (Phase 6). The booking-time number is an assumption and must
--   never be reused as the actual.
--
--   No data is written or backfilled. No existing financial_settings value is
--   modified -- the two new columns arrive with defaults, which is DDL and does
--   not fire the append-only guard (that trigger is BEFORE UPDATE OR DELETE on
--   rows).
-- ============================================================

-- ── 1. The fee parameters ────────────────────────────────────────────────────
ALTER TABLE public.financial_settings
  ADD COLUMN IF NOT EXISTS transfer_fee_min  NUMERIC(12,2) NOT NULL DEFAULT 0.50,
  ADD COLUMN IF NOT EXISTS transfer_fee_rate NUMERIC(6,4)  NOT NULL DEFAULT 0.0010;

-- ADD CONSTRAINT has no IF NOT EXISTS; drop-then-add is the idempotent form.
ALTER TABLE public.financial_settings DROP CONSTRAINT IF EXISTS fs_transfer_min_positive;
ALTER TABLE public.financial_settings
  ADD CONSTRAINT fs_transfer_min_positive CHECK (transfer_fee_min >= 0);

ALTER TABLE public.financial_settings DROP CONSTRAINT IF EXISTS fs_transfer_rate_range;
ALTER TABLE public.financial_settings
  ADD CONSTRAINT fs_transfer_rate_range CHECK (transfer_fee_rate >= 0 AND transfer_fee_rate <= 1);

COMMENT ON COLUMN public.financial_settings.transfer_fee_min IS
  'Floor of the bank transfer fee. The real policy is GREATEST(min, amount * rate); below the crossover the floor is what is charged.';
COMMENT ON COLUMN public.financial_settings.transfer_fee_rate IS
  'Proportional part of the bank transfer fee, applied to the settlement hold. 0.0010 = 0.1%.';


-- ── 2. The fee itself ────────────────────────────────────────────────────────
-- No LEAST(transfer_fee_cap, ...): the cap is a budget alert threshold, not a
-- ceiling on what the bank charges. Applying it here would understate the fee
-- on large transfers and silently inflate the projected margin exactly where
-- the amounts are biggest.
CREATE OR REPLACE FUNCTION public.fin_transfer_fee(p_amount NUMERIC)
RETURNS NUMERIC
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE f RECORD;
BEGIN
  -- A NULL or negative transfer amount is a caller bug, not a zero-fee transfer.
  -- Coalescing it away would return the floor and let a broken projection look
  -- like a cheap one; refuse it instead.
  IF p_amount IS NULL OR p_amount < 0 THEN
    RAISE EXCEPTION 'INVALID_TRANSFER_AMOUNT: %', COALESCE(p_amount::text, 'NULL');
  END IF;

  SELECT * INTO f FROM public.financial_settings
   WHERE effective_to IS NULL ORDER BY effective_from DESC LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NO_FINANCIAL_SETTINGS: no open financial_settings version';
  END IF;

  RETURN GREATEST(f.transfer_fee_min, ROUND(p_amount * f.transfer_fee_rate, 2));
END;
$$;

-- 0097 grants EXECUTE on ALL FUNCTIONS to anon and authenticated, so every new
-- function arrives publicly callable. Take it back, as 0139..0148 each do.
REVOKE ALL ON FUNCTION public.fin_transfer_fee(NUMERIC) FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.fin_transfer_fee(NUMERIC) IS
  'PD-09. The actual bank transfer fee for a given transfer amount: GREATEST(transfer_fee_min, ROUND(amount * transfer_fee_rate, 2)). transfer_fee_cap is deliberately NOT applied -- it is a payout-time budget alert threshold, not a maximum fee.';


-- ── 3. The booking RPC, with the projection corrected ────────────────────────
-- Body below is the 0148 definition with exactly four changes: three new
-- locals, the deposit/hold/fee derivation, the projection subtracting v_fee
-- instead of the cap, and the snapshot storing v_fee instead of the cap.
-- Everything else -- authentication, idempotency, agreement resolution,
-- pricing, promotions, points, the margin guard, override authorisation,
-- booking creation, booking_financials, settlement_holds, ledger balancing --
-- is byte-identical to 0148.
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
  v_deposit    NUMERIC;
  v_hold       NUMERIC;
  v_fee        NUMERIC;
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

  -- 0152. The transfer fee is a function of the amount PIMA actually wires,
  -- which is the settlement hold -- not retail, and not the owner entitlement.
  -- The customer pays the arrival balance direct to the house (PD-04), so the
  -- wire is only what is left of the entitlement after that.
  --
  -- deposit_amount and hold_amount are generated/derived downstream, so they
  -- do not exist yet at this point. Both expressions below are copied verbatim
  -- from their definitions -- 0142 deposit_amount and 0143 hold_amount -- so a
  -- projection can never disagree with what is subsequently stored. Note the
  -- unscaled ROUND in the deposit: that is 0142 line 146, not a typo.
  v_deposit   := GREATEST(ROUND(fs.deposit_rate * v_final), v_retail - v_entitle);
  v_hold      := GREATEST(0, v_entitle - (v_final - v_deposit));
  v_fee       := public.fin_transfer_fee(v_hold);
  v_proj_net  := v_gross - v_promo - v_pts_egp - v_fee;
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
     fs.deposit_rate, fs.min_margin_rate, v_fee,
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
