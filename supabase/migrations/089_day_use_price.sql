-- ============================================================
-- A price for a day that is not a night.
--
-- «يوم روحي» is one of the commonest things these houses host: a group
-- arrives in the morning, uses the hall and the church, eats, and leaves the
-- same evening. Nobody sleeps. Until now Pima had no way to price that.
--
-- The calendar already let a guest tap the same day twice, and the client
-- priced the result at zero — computeStayPrice() returns 0 when
-- checkIn >= checkOut. The server agreed, for a different reason:
-- generate_series(check_in, check_out - 1) over a same-day range is EMPTY, so
-- expected = 0, min_allowed = FLOOR(0 * 0.9) - 1 = -1, and any total at all
-- passed validation. A booking could be taken for nothing, and no trigger
-- would object.
--
-- houses.day_use_price_per_person: per person, for a stay with no night in
-- it. NULL means the house does not offer day bookings — which is the state
-- every existing house is in, so nothing changes for them until an owner
-- sets a price.
--
-- Owner-direct? No. Deliberately not added to the protect_house_owner_updates
-- exemption list (migration 055): this is a listing rate, same family as
-- price_per_night_per_person, so it flows through pending_edit and admin
-- approval. The migration-019 trigger reverts every column not explicitly
-- re-allowed, so a new column is protected by default — nothing to add there.
-- ============================================================

ALTER TABLE public.houses
  ADD COLUMN IF NOT EXISTS day_use_price_per_person NUMERIC;

-- NOT VALID for the same reason every other houses constraint is: it never
-- rescans live rows, and every live row is NULL anyway.
DO $$
BEGIN
  ALTER TABLE public.houses ADD CONSTRAINT houses_day_use_price_nonneg
    CHECK (day_use_price_per_person IS NULL OR day_use_price_per_person >= 0) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- REQUIRED after any ADD COLUMN on houses. Migration 080 dropped the
-- table-level SELECT grant and handed back a fixed column list, so a new
-- column is unreadable to anon/authenticated until the list is rebuilt.
-- Skipping this does not fail loudly: the browse screen still renders and the
-- new price is simply never there. See docs/OPERATIONS.md on migration 080.
DO $$
DECLARE cols TEXT;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'houses'
    AND column_name <> 'payment_methods';

  IF cols IS NULL THEN
    RAISE EXCEPTION 'public.houses not found — refusing to change grants';
  END IF;

  EXECUTE 'REVOKE SELECT ON public.houses FROM anon, authenticated';
  EXECUTE format('GRANT SELECT (%s) ON public.houses TO anon, authenticated', cols);
END $$;

-- ── Price validation, now with a branch for a stay containing no night ──
-- Supersedes the 055 version. The monthly and night-by-night branches are
-- unchanged, character for character; the only new thing is the same-day
-- case ahead of them.
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
    -- A day with no night. Priced at the house's own day rate; where a house
    -- has not set one it stays 0, exactly as before this migration, so no
    -- existing booking becomes invalid. The client does not offer day
    -- bookings for such a house, and this is not the place to start refusing
    -- rows that used to be accepted.
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

-- ============================================================
-- The part that matters more than the price.
--
-- Postgres canonicalises daterange(d, d, '[)') to EMPTY, and an empty range
-- overlaps NOTHING. Every occupancy check in this schema is built on that
-- operator, so a booking with check_in = check_out is invisible to all of
-- them:
--
--   • check_booking_capacity (003) sums the guests of overlapping bookings.
--     For a same-day booking that sum is always 0, so it is only ever
--     checked against the empty house — and it is equally invisible to every
--     overnight booking that looks at it. Ten day groups of a hundred each
--     would all be accepted onto a hundred-bed house, on the same date.
--   • get_houses_availability (053) reports free_beds for search. A same-day
--     search returns every approved house completely free, however booked.
--   • The blocked-dates guard in the same function uses
--     d >= p_check_in AND d < p_check_out, an empty window for a single day,
--     so a house is offered on dates its owner has explicitly closed.
--
-- A day is a day: it occupies the date it falls on. GREATEST(end, start + 1)
-- gives a same-day booking a one-day range and leaves every multi-night
-- range exactly as it was. This treats a day group as consuming beds it does
-- not sleep in, which is conservative — and overselling a house is a worse
-- failure than turning away one booking that might have fitted.
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_booking_capacity()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  house_beds INTEGER;
  used_beds  INTEGER;
BEGIN
  IF NEW.status NOT IN ('pending', 'approved') THEN
    RETURN NEW;
  END IF;

  SELECT beds_count INTO house_beds
  FROM public.houses
  WHERE id = NEW.house_id;

  IF house_beds IS NULL THEN
    RAISE EXCEPTION 'HOUSE_NOT_FOUND: House % does not exist', NEW.house_id;
  END IF;

  SELECT COALESCE(SUM(guests_count), 0) INTO used_beds
  FROM public.bookings
  WHERE house_id = NEW.house_id
    AND status IN ('pending', 'approved')
    AND id <> NEW.id
    AND daterange(check_in, GREATEST(check_out, check_in + 1), '[)')
     && daterange(NEW.check_in, GREATEST(NEW.check_out, NEW.check_in + 1), '[)');

  IF used_beds + NEW.guests_count > house_beds THEN
    RAISE EXCEPTION 'INSUFFICIENT_CAPACITY: Only % beds available for these dates (house has %, % already reserved)',
      (house_beds - used_beds), house_beds, used_beds;
  END IF;

  RETURN NEW;
END;
$$;

-- Search must keep mirroring the trigger exactly, or it promises capacity the
-- booking would then be refused for — the reason 053 says so in its header.
CREATE OR REPLACE FUNCTION public.get_houses_availability(p_check_in DATE, p_check_out DATE)
RETURNS TABLE(house_id TEXT, free_beds INTEGER)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    h.id,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM unnest(COALESCE(h.blocked_dates, '{}')) AS d
        WHERE d ~ '^\d{4}-\d{2}-\d{2}$'
          AND d::date >= p_check_in
          AND d::date <  GREATEST(p_check_out, p_check_in + 1)
      ) THEN 0
      ELSE GREATEST(0, h.beds_count - COALESCE((
        SELECT SUM(b.guests_count)::int
        FROM public.bookings b
        WHERE b.house_id = h.id
          AND b.status IN ('pending', 'approved')
          AND daterange(b.check_in, GREATEST(b.check_out, b.check_in + 1), '[)')
           && daterange(p_check_in, GREATEST(p_check_out, p_check_in + 1), '[)')
      ), 0))
    END AS free_beds
  FROM public.houses h
  WHERE h.status = 'approved';
$$;

GRANT EXECUTE ON FUNCTION public.get_houses_availability(DATE, DATE) TO anon, authenticated;
