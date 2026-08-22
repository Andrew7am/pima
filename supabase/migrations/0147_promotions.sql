-- ─────────────────────────────────────────────────────────────────────────────
-- 0147 — PROMOTIONS (PIMA-funded, authoritative)
--
-- The missing half of PD-06. booking_financials.promo_discount has existed since
-- 0142 with nowhere to get its value from, which meant the only way to apply a
-- promotion was to let the client name the amount — and a client-named discount
-- is not a promotion, it is a hole.
--
-- ── WHAT ALREADY EXISTED, AND WHY NEITHER FITS ──────────────────────────────
--
-- promo_banners (0076, 0081–0085): placement, badge, title, subtitle, cta_text,
-- image_url, audience, experiment, layout, links. Not one monetary column. It is
-- marketing creative — what a promotion LOOKS like, never what it is worth.
--
-- house_discounts (0116): a percentage on a house for a date window, and its own
-- migration says the owner carries the cost. That is an owner-funded rate
-- reduction, the opposite of a PIMA-funded promotion, and it already flows
-- through validate_booking_price into the expected price. It stays exactly where
-- it is and must never post to PIMA_PROMO_EXPENSE.
--
-- So this is new, and it is not a second source of truth for anything.
--
-- ── PIMA FUNDS IT, ALWAYS ───────────────────────────────────────────────────
--
--     retail_price − promo_discount − points_discount = final_customer_price
--
-- and owner_entitlement is untouched, because it comes from the agreement and
-- nothing here can reach it. 0142's bf_entitlement_matches_model already makes
-- that structurally true; this migration simply never offers a way to try.
--
-- ── THE CLIENT NEVER NAMES THE AMOUNT ───────────────────────────────────────
--
-- fin_resolve_promotion() is the authoritative source: given a promotion, a
-- house, a moment and a retail price, it returns the discount or refuses. Every
-- eligibility rule — window, scope, currency, minimum value, usage caps — is
-- checked against database state. 0148 calls it and takes what it is given.
--
-- ── WHAT 0147 DOES NOT DO ───────────────────────────────────────────────────
--
-- No booking, no financial snapshot, no settlement hold, no points, no ledger
-- entry, no payment, no payout, no receivable. This migration creates a
-- catalogue and a way to read it correctly. Consumption belongs to 0148.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── The catalogue ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.promotions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Nullable: an automatic campaign has no code to type.
  code          TEXT UNIQUE,
  title         TEXT NOT NULL,

  kind          TEXT NOT NULL,
  -- PERCENT is a fraction (0.10 = 10%), matching commission_rate and markup_pct
  -- everywhere else in this schema. FIXED_AMOUNT is money in `currency`.
  value         NUMERIC(12,4) NOT NULL,
  currency      CHAR(3) NOT NULL DEFAULT 'EGP',

  -- NULL = platform-wide. Otherwise the promotion applies to this house only,
  -- and the resolver enforces it rather than trusting the caller.
  house_id      TEXT REFERENCES public.houses(id) ON DELETE RESTRICT,

  starts_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at       TIMESTAMPTZ,

  -- NULL means unlimited in each case.
  max_uses          INTEGER,
  per_user_limit    INTEGER,
  min_booking_value NUMERIC(12,2),

  active        BOOLEAN NOT NULL DEFAULT TRUE,

  note          TEXT,
  created_by    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at    TIMESTAMPTZ,

  CONSTRAINT promo_kind_valid  CHECK (kind IN ('FIXED_AMOUNT', 'PERCENT')),
  CONSTRAINT promo_value_positive CHECK (value > 0),
  -- A percentage over 100% would hand money back rather than discount anything.
  CONSTRAINT promo_percent_range CHECK (kind <> 'PERCENT' OR value <= 1),
  CONSTRAINT promo_currency_format CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT promo_window CHECK (ends_at IS NULL OR ends_at > starts_at),
  CONSTRAINT promo_max_uses_positive CHECK (max_uses IS NULL OR max_uses > 0),
  CONSTRAINT promo_per_user_positive CHECK (per_user_limit IS NULL OR per_user_limit > 0),
  CONSTRAINT promo_min_value_non_negative CHECK (min_booking_value IS NULL OR min_booking_value >= 0),
  CONSTRAINT promo_title_present CHECK (length(btrim(title)) > 0)
);


-- ── Consumption (append-only) ────────────────────────────────────────────────
-- discount_amount is what THIS promotion actually took off THIS booking,
-- resolved and frozen at the moment of consumption. Editing the promotion later
-- cannot reach it — which is what makes a completed booking's economics stable.
CREATE TABLE IF NOT EXISTS public.booking_promotions (
  booking_id      TEXT NOT NULL REFERENCES public.bookings(id)   ON DELETE RESTRICT,
  promotion_id    UUID NOT NULL REFERENCES public.promotions(id) ON DELETE RESTRICT,

  discount_amount NUMERIC(12,2) NOT NULL,
  currency        CHAR(3) NOT NULL,

  applied_by      UUID REFERENCES public.users(id) ON DELETE SET NULL,
  applied_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- The same promotion cannot be applied to the same booking twice.
  CONSTRAINT booking_promotions_pkey PRIMARY KEY (booking_id, promotion_id),
  CONSTRAINT bp_amount_positive  CHECK (discount_amount > 0),
  CONSTRAINT bp_currency_format  CHECK (currency ~ '^[A-Z]{3}$')
);


-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS promotions_live_idx ON public.promotions (starts_at, ends_at)
  WHERE active;
CREATE INDEX IF NOT EXISTS promotions_house_idx ON public.promotions (house_id)
  WHERE house_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS bp_promotion_idx ON public.booking_promotions (promotion_id);


-- ── The authoritative resolver ───────────────────────────────────────────────
-- Returns what this promotion is worth on this booking, or refuses with a reason.
-- Every rule is checked against database state; nothing is taken on trust.
CREATE OR REPLACE FUNCTION public.fin_resolve_promotion(
  p_promotion_id UUID,
  p_house_id     TEXT,
  p_retail       NUMERIC,
  p_currency     CHAR(3),
  p_user_id      UUID,
  p_at           TIMESTAMPTZ DEFAULT NOW()
) RETURNS NUMERIC LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  pr      RECORD;
  v_uses  INTEGER;
  v_mine  INTEGER;
  v_amount NUMERIC;
BEGIN
  SELECT * INTO pr FROM public.promotions WHERE id = p_promotion_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROMOTION_NOT_FOUND: %', p_promotion_id;
  END IF;

  IF NOT pr.active THEN
    RAISE EXCEPTION 'PROMOTION_INACTIVE: promotion % is not active', pr.id;
  END IF;

  IF p_at < pr.starts_at THEN
    RAISE EXCEPTION 'PROMOTION_NOT_STARTED: promotion % starts at %', pr.id, pr.starts_at;
  END IF;

  IF pr.ends_at IS NOT NULL AND p_at >= pr.ends_at THEN
    RAISE EXCEPTION 'PROMOTION_EXPIRED: promotion % ended at %', pr.id, pr.ends_at;
  END IF;

  -- House scope is enforced here, not asserted by the caller.
  IF pr.house_id IS NOT NULL AND pr.house_id IS DISTINCT FROM p_house_id THEN
    RAISE EXCEPTION
      'PROMOTION_WRONG_HOUSE: promotion % applies to house %, not %', pr.id, pr.house_id, p_house_id;
  END IF;

  -- EGP and USD are not interchangeable and this system has no FX.
  IF pr.currency IS DISTINCT FROM p_currency THEN
    RAISE EXCEPTION
      'PROMOTION_CURRENCY_MISMATCH: promotion is in %, booking in %', pr.currency, p_currency;
  END IF;

  IF pr.min_booking_value IS NOT NULL AND p_retail < pr.min_booking_value THEN
    RAISE EXCEPTION
      'PROMOTION_BELOW_MINIMUM: promotion % requires a booking of at least %, got %',
      pr.id, pr.min_booking_value, p_retail;
  END IF;

  IF pr.max_uses IS NOT NULL THEN
    SELECT COUNT(*) INTO v_uses FROM public.booking_promotions WHERE promotion_id = pr.id;
    IF v_uses >= pr.max_uses THEN
      RAISE EXCEPTION 'PROMOTION_EXHAUSTED: promotion % has used all % of its uses', pr.id, pr.max_uses;
    END IF;
  END IF;

  IF pr.per_user_limit IS NOT NULL AND p_user_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_mine
      FROM public.booking_promotions bp
      JOIN public.bookings b ON b.id = bp.booking_id
     WHERE bp.promotion_id = pr.id AND b.user_id = p_user_id;
    IF v_mine >= pr.per_user_limit THEN
      RAISE EXCEPTION
        'PROMOTION_USER_LIMIT: this guest has already used promotion % the permitted % time(s)',
        pr.id, pr.per_user_limit;
    END IF;
  END IF;

  v_amount := CASE pr.kind
                WHEN 'PERCENT'      THEN ROUND(p_retail * pr.value, 2)
                WHEN 'FIXED_AMOUNT' THEN ROUND(pr.value, 2)
              END;

  -- A discount larger than the price is not a discount. The caller decides what
  -- to do about the shortfall this may still create against owner entitlement;
  -- PD-06 keeps that entitlement whole either way.
  IF v_amount > p_retail THEN
    -- ROUND, not a bare assignment: this function returns money at two decimal
    -- places on every path, so a caller can compare its result without first
    -- having to normalise whatever scale the retail price happened to carry.
    v_amount := ROUND(p_retail, 2);
  END IF;

  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'PROMOTION_ZERO_VALUE: promotion % resolves to no discount on this booking', pr.id;
  END IF;

  RETURN v_amount;
END;
$$;


-- ── A consumed promotion's terms stop moving ─────────────────────────────────
-- booking_promotions already freezes the amount, so an edit cannot change an
-- existing booking's economics. This closes the same door at the source: once a
-- promotion has been used, its kind, value and currency are fixed, so the
-- catalogue keeps saying what those bookings were actually given.
CREATE OR REPLACE FUNCTION public.promotions_guard()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM public.booking_promotions WHERE promotion_id = OLD.id) THEN
      RAISE EXCEPTION
        'PROMOTION_CONSUMED: promotion % has been applied to bookings and cannot be deleted — deactivate it instead',
        OLD.id;
    END IF;
    RETURN OLD;
  END IF;

  IF (NEW.kind, NEW.value, NEW.currency) IS DISTINCT FROM (OLD.kind, OLD.value, OLD.currency)
     AND EXISTS (SELECT 1 FROM public.booking_promotions WHERE promotion_id = OLD.id) THEN
    RAISE EXCEPTION
      'PROMOTION_TERMS_LOCKED: promotion % has already been applied to bookings; its kind, value and currency can no longer change — create a new promotion',
      OLD.id;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS promotions_guard_trg ON public.promotions;
CREATE TRIGGER promotions_guard_trg
  BEFORE UPDATE OR DELETE ON public.promotions
  FOR EACH ROW EXECUTE FUNCTION public.promotions_guard();

CREATE OR REPLACE FUNCTION public.booking_promotions_append_only()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public, pg_temp AS $$
BEGIN
  RAISE EXCEPTION
    'BOOKING_PROMOTION_APPEND_ONLY: % is refused — a promotion that was applied stays applied; reverse it in the ledger instead',
    TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS booking_promotions_append_only_trg ON public.booking_promotions;
CREATE TRIGGER booking_promotions_append_only_trg
  BEFORE UPDATE OR DELETE ON public.booking_promotions
  FOR EACH ROW EXECUTE FUNCTION public.booking_promotions_append_only();


-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Admin-only on both raw tables, deliberately.
--
-- A promotion row carries PIMA's commercial hand: usage caps, per-user limits,
-- minimum booking values, which houses are being pushed. None of that is a
-- visitor's business, and a guest never needs to READ the table — they submit a
-- code and 0148 resolves it server-side through fin_resolve_promotion(), which
-- is the only way an authoritative amount can be produced anyway.
--
-- Whatever the customer should see about a promotion applied to their own
-- booking is projected by the canonical read layer in 0149, as with
-- booking_financials.
ALTER TABLE public.promotions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_promotions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "promotions_admin_read" ON public.promotions;
CREATE POLICY "promotions_admin_read" ON public.promotions
  FOR SELECT USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "promotions_admin_insert" ON public.promotions;
CREATE POLICY "promotions_admin_insert" ON public.promotions
  FOR INSERT WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "promotions_admin_update" ON public.promotions;
CREATE POLICY "promotions_admin_update" ON public.promotions
  FOR UPDATE USING (public.is_admin(auth.uid()))
           WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "booking_promotions_admin_read" ON public.booking_promotions;
CREATE POLICY "booking_promotions_admin_read" ON public.booking_promotions
  FOR SELECT USING (public.is_admin(auth.uid()));

-- No DELETE policy on promotions; no write policy at all on booking_promotions,
-- which 0148 populates as a SECURITY DEFINER.


-- ── Privileges ───────────────────────────────────────────────────────────────
-- Migration 0097 grants full DML on ALL TABLES and EXECUTE on ALL FUNCTIONS to
-- anon and authenticated, with default privileges repeating it for anything
-- created afterwards. Taking it back is mandatory.
REVOKE ALL ON TABLE public.promotions         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.booking_promotions FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.promotions TO authenticated;  -- RLS narrows to admin
GRANT SELECT ON TABLE public.booking_promotions TO authenticated;          -- RLS narrows to admin

-- The resolver is internal: 0148 calls it as the definer. A client that could
-- call it directly could enumerate the catalogue by probing error messages.
REVOKE ALL ON FUNCTION public.fin_resolve_promotion(UUID, TEXT, NUMERIC, CHAR, UUID, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.promotions_guard()               FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.booking_promotions_append_only() FROM PUBLIC, anon, authenticated;


-- ── Documentation ────────────────────────────────────────────────────────────
COMMENT ON TABLE public.promotions IS
  'PIMA-funded promotions (PD-06). Distinct from promo_banners, which is marketing creative and carries no money, and from house_discounts (0116), which is an OWNER-funded rate reduction. A promotion only ever reduces the customer''s final price; owner entitlement comes from the agreement and is unreachable from here.';

COMMENT ON TABLE public.booking_promotions IS
  'Which promotion was applied to which booking, and what it was actually worth. Append-only, and the amount is frozen at consumption, so editing or ending a promotion later cannot change a completed booking''s economics.';

COMMENT ON COLUMN public.promotions.value IS
  'PERCENT: a fraction, 0.10 = 10%, matching commission_rate and markup_pct elsewhere in this schema. FIXED_AMOUNT: money in `currency`.';
COMMENT ON COLUMN public.promotions.house_id IS
  'NULL means platform-wide. Otherwise the promotion applies to this house only, enforced by fin_resolve_promotion rather than trusted from the caller.';
COMMENT ON FUNCTION public.fin_resolve_promotion(UUID, TEXT, NUMERIC, CHAR, UUID, TIMESTAMPTZ) IS
  'The authoritative promotion amount. Checks active state, window, house scope, currency, minimum booking value and both usage caps against database state, then returns the discount or raises. 0148 calls this instead of accepting a client-supplied figure.';
