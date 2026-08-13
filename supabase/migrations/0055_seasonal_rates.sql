-- ============================================================
-- Seasonal pricing & offers. A single flat nightly rate doesn't fit a
-- seasonal market — owners need صيف/مواسم rates and time-boxed offers.
--
-- houses.seasonal_rates: JSONB array of
--   { "id": "...", "label": "موسم الصيف", "startDate": "2026-06-15",
--     "endDate": "2026-09-15", "pricePerNight": 180 }
-- First matching entry (array order) wins for a given night; nights with
-- no match use the base price_per_night_per_person.
--
-- (1) Owner-direct editable (added to the protect_house_owner_updates
--     exemption list like payment_methods/menu): offers need agility,
--     and the base listing/rate stays admin-moderated as before.
-- (2) validate_booking_price now prices night-by-night with the same
--     first-match rule, so the server accepts exactly what the client
--     quotes — malformed entries are ignored defensively rather than
--     breaking bookings.
-- ============================================================

ALTER TABLE public.houses
  ADD COLUMN IF NOT EXISTS seasonal_rates JSONB NOT NULL DEFAULT '[]';

-- ── (1) Same function as migration 042, plus seasonal_rates exempted ──
CREATE OR REPLACE FUNCTION public.protect_house_owner_updates()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  keep_pending  JSONB;
  keep_blocked  TEXT[];
  keep_menu     JSONB;
  keep_payment  JSONB;
  keep_seasonal JSONB;
BEGIN
  IF current_user = 'authenticated' AND NOT public.is_admin(auth.uid()) THEN
    keep_pending  := NEW.pending_edit;
    keep_blocked  := NEW.blocked_dates;
    keep_menu     := NEW.menu;
    keep_payment  := NEW.payment_methods;
    keep_seasonal := NEW.seasonal_rates;
    NEW := OLD;                           -- revert every column to its old value
    NEW.pending_edit   := keep_pending;   -- then re-allow just these five
    NEW.blocked_dates  := keep_blocked;
    NEW.menu           := keep_menu;
    NEW.payment_methods := keep_payment;
    NEW.seasonal_rates := keep_seasonal;
  END IF;
  RETURN NEW;
END;
$$;

-- ── (2) Seasonal-aware price validation (supersedes the 024 version) ──
CREATE OR REPLACE FUNCTION public.validate_booking_price()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  h_type     TEXT;
  h_night    NUMERIC;
  h_month    NUMERIC;
  h_seasonal JSONB;
  qty      INTEGER;
  unit     NUMERIC;
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

  SELECT property_type, price_per_night_per_person, monthly_rent, COALESCE(seasonal_rates, '[]'::jsonb)
    INTO h_type, h_night, h_month, h_seasonal
    FROM public.houses WHERE id = NEW.house_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF h_type IN ('student', 'staff') THEN
    qty  := GREATEST(1, ROUND((NEW.check_out - NEW.check_in)::numeric / 30))::int;
    unit := COALESCE(h_month, 1500);
    expected := unit * NEW.guests_count * qty;
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
