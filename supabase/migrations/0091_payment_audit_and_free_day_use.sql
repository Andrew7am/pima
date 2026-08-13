-- ============================================================
-- Two money defects the write-side migration (090) did not cover.
--
-- 1. There is no record of who approved a payment, or when.
--
--    updatePaymentStatus writes payment_status and nothing else, and the
--    audit_log triggers (032, rewritten in 033) cover booking status, house
--    status and user status — not payments. So if a guest and an owner
--    disagree about whether money arrived, the data says only that the row
--    is currently 'approved'. It does not say who decided that, when, or
--    what the previous state was. For the one table in this schema that
--    represents money, that is the wrong place to have no history.
--
-- 2. A same-day booking is free on every house that has not set a day rate.
--
--    089's price branch reads `expected := COALESCE(h_day, 0) * guests`,
--    so with h_day NULL the expected price is 0, min_allowed becomes -1, and
--    any total_price passes. 089's header explains this was deliberate —
--    "no existing booking becomes invalid ... this is not the place to start
--    refusing rows that used to be accepted" — and that reasoning is sound
--    for UPDATEs.
--
--    It is not sound for INSERTs. Nothing legitimate creates a new day
--    booking on a house that offers no day rate (pricing.ts:49 refuses to
--    price one), so the only thing the permissive branch protects there is a
--    modified client posting a free booking that still consumes beds — 089's
--    own capacity fix made sure it does. This migration therefore narrows
--    the rule rather than reversing it: refuse on INSERT, keep accepting on
--    UPDATE so no existing row becomes uneditable.
-- ============================================================


-- ── 1. Payment review trail ─────────────────────────────────────────────

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS reviewed_by     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS previous_status TEXT;

CREATE INDEX IF NOT EXISTS idx_payments_reviewed_by ON public.payments (reviewed_by);

-- Stamped by the database, not by the client, so it cannot be forged or
-- forgotten. Invoker rights: auth.uid() must resolve to the caller.
CREATE OR REPLACE FUNCTION public.stamp_payment_review()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
    NEW.previous_status := OLD.payment_status;
    NEW.reviewed_at     := NOW();
    NEW.reviewed_by     := auth.uid();   -- NULL for service-role / SQL editor
  END IF;
  RETURN NEW;
END;
$$;

-- Named to sort AFTER pay_protect_write (090): BEFORE triggers fire in
-- alphabetical order, and this must see the status that guard leaves behind,
-- not the one the client asked for.
DROP TRIGGER IF EXISTS pay_stamp_review ON public.payments;
CREATE TRIGGER pay_stamp_review
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.stamp_payment_review();


-- ── 2. No free day-use bookings on houses that do not sell them ─────────

-- Identical to the 089 version except for the four added lines in the
-- same-day branch.
CREATE OR REPLACE FUNCTION public.validate_booking_price()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  h_type     TEXT;
  h_night    NUMERIC;
  h_month    NUMERIC;
  h_day      NUMERIC;
  h_seasonal JSONB;
  unit     NUMERIC;
  qty      INTEGER;
  expected NUMERIC;
  min_allowed NUMERIC;
  v_deposit    NUMERIC;
  v_max_redeem NUMERIC;
BEGIN
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
         day_use_price_per_person, COALESCE(seasonal_rates, '[]'::jsonb)
    INTO h_type, h_night, h_month, h_day, h_seasonal
    FROM public.houses WHERE id = NEW.house_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF h_type IN ('student', 'staff') THEN
    qty  := GREATEST(1, ROUND((NEW.check_out - NEW.check_in)::numeric / 30))::int;
    unit := COALESCE(h_month, 1500);
    expected := unit * NEW.guests_count * qty;

  ELSIF NEW.check_out = NEW.check_in THEN
    -- A day with no night, priced at the house's own day rate.
    --
    -- 089 let a NULL rate mean 0 so that existing rows stayed valid. That
    -- still holds on UPDATE. On INSERT it is only a hole: the client will
    -- not price a day booking for a house with no day rate, so the only
    -- caller that can get here is one that bypassed the client, and the row
    -- it creates is free while still consuming beds.
    IF TG_OP = 'INSERT' AND h_day IS NULL THEN
      RAISE EXCEPTION 'DAY_USE_NOT_OFFERED: house % has no day rate', NEW.house_id;
    END IF;
    expected := COALESCE(h_day, 0) * NEW.guests_count;

  ELSE
    -- Night-by-night: each night takes the first (array-order) seasonal
    -- entry covering it, else the base rate. Malformed entries (bad
    -- dates / non-numeric price) are skipped, never fatal.
    SELECT COALESCE(SUM(COALESCE(sr.rate, COALESCE(h_night, 0))), 0) * NEW.guests_count
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

  min_allowed := FLOOR(expected * (1 - v_max_redeem)) - 1;

  IF NEW.total_price < min_allowed THEN
    RAISE EXCEPTION 'PRICE_TOO_LOW: expected at least %, got % (house rate math for % guests)',
      min_allowed, NEW.total_price, NEW.guests_count;
  END IF;

  NEW.deposit_amount := ROUND(NEW.total_price * v_deposit);
  RETURN NEW;
END;
$$;
