-- ============================================================
-- Discounts on a house, for a date range.
--
-- The admin puts a percentage on a house at the OWNER's request, and
-- the owner carries the cost: the commission is a percentage of the
-- discounted price, so on a 20,000 booking at 25% off the total falls
-- to 15,000, Pima's commission falls from 1,000 to 750, and the owner
-- receives 14,250 instead of 19,000.
--
-- THE CRUX IS THE SERVER, NOT THE UI. validate_booking_price recomputes
-- the expected price from the house's own rates and refuses anything
-- below FLOOR(expected * (1 - max_redemption)) - 1. A discount the
-- server does not know about is therefore not merely undisplayed — the
-- database REJECTS the booking with PRICE_TOO_LOW.
--
-- So the discount is applied to the server's OWN expected figure, never
-- taken from the client. A caller sending an arbitrary low price still
-- meets a floor; the floor simply moves down by exactly the discount
-- the house actually carries. Points redemption keeps its band on top,
-- so a guest can still spend points against a discounted stay.
--
-- The window is judged on CHECK-IN, not on when the booking was made:
-- consistent with seasonal_rates, and it is what an owner actually
-- wants — his house is empty on particular dates and he is trying to
-- fill those dates.
--
-- WHAT IS RECORDED VERSUS LOOKED UP. discount_pct_applied is stamped
-- onto the booking at INSERT and never recomputed. This codebase has
-- the opposite pattern in commission_rate, which is read live, so every
-- historical figure silently reprices the moment it is edited. A
-- discount read live would do the same in reverse: end the offer and
-- every booking taken under it would jump back to full price in the
-- ledger, contradicting what the guest actually paid.
--
-- Owners cannot set their own discount. protect_house_owner_updates
-- (migration 019) reverts every column for a non-admin caller except
-- pending_edit, blocked_dates and menu — so these new columns are
-- already admin-only without a line of extra guarding.
-- ============================================================

ALTER TABLE public.houses ADD COLUMN IF NOT EXISTS discount_pct        NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.houses ADD COLUMN IF NOT EXISTS discount_starts_at  DATE;
ALTER TABLE public.houses ADD COLUMN IF NOT EXISTS discount_ends_at    DATE;
-- Who asked for it and when. The owner pays for this discount, so if he
-- later says he never asked, there has to be a line that says otherwise.
ALTER TABLE public.houses ADD COLUMN IF NOT EXISTS discount_note       TEXT;
ALTER TABLE public.houses ADD COLUMN IF NOT EXISTS discount_set_by     UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.houses ADD COLUMN IF NOT EXISTS discount_set_at     TIMESTAMPTZ;

DO $$
BEGIN
  ALTER TABLE public.houses DROP CONSTRAINT IF EXISTS houses_discount_pct_range;
  -- Above 60% is almost certainly a typo — 25 typed into a field that
  -- wanted 0.25. Refusing it here is cheaper than refunding it later.
  ALTER TABLE public.houses ADD CONSTRAINT houses_discount_pct_range
    CHECK (discount_pct >= 0 AND discount_pct <= 0.6);
  ALTER TABLE public.houses DROP CONSTRAINT IF EXISTS houses_discount_window;
  ALTER TABLE public.houses ADD CONSTRAINT houses_discount_window
    CHECK (discount_starts_at IS NULL OR discount_ends_at IS NULL OR discount_ends_at >= discount_starts_at);
END $$;

-- Frozen on the booking at the moment it is made.
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS discount_pct_applied  NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS price_before_discount NUMERIC;


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
         day_use_price_per_person, COALESCE(seasonal_rates, '[]'::jsonb),
         COALESCE(discount_pct, 0), discount_starts_at, discount_ends_at
    INTO h_type, h_night, h_month, h_day, h_seasonal,
         h_disc, h_disc_from, h_disc_to
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

  -- The discount, decided here rather than accepted from the caller.
  --
  -- On INSERT it is read from the house and stamped onto the booking, so
  -- the deal is fixed at the moment it is struck. On UPDATE the stamped
  -- value is kept: changing the dates of an existing booking must not
  -- silently reprice it because an offer has since started or ended.
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
    RAISE EXCEPTION 'PRICE_TOO_LOW: expected at least %, got % (house rate math for % guests)',
      min_allowed, NEW.total_price, NEW.guests_count;
  END IF;

  NEW.deposit_amount := ROUND(NEW.total_price * v_deposit);
  RETURN NEW;
END;
$$;


-- ============================================================
-- Pin the two new booking columns against a guest UPDATE.
--
-- validate_booking_price stamps them, which covers INSERT — but it
-- EARLY-EXITS on UPDATE when total_price, guests_count, check_in and
-- check_out are all unchanged (091:85-91). So an UPDATE touching only
-- discount_pct_applied or price_before_discount skips the stamping
-- entirely and lands unvalidated.
--
-- 090's own comment names this hazard for house_id: "with
-- validate_booking_price early-exiting when the four price inputs are
-- unchanged". The same applies here. price_before_discount is what the
-- guest-facing «كان كذا» line reads, so leaving it writable would let
-- anyone forge a struck-through price on their own booking.
--
-- Identical to 090 except for the two added pins.
-- ============================================================

CREATE OR REPLACE FUNCTION public.protect_booking_privileged_columns()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  is_house_owner BOOLEAN;
BEGIN
  IF current_user <> 'authenticated' THEN
    RETURN NEW;
  END IF;

  is_house_owner := EXISTS (
    SELECT 1 FROM public.houses h WHERE h.id = NEW.house_id AND h.owner_id = auth.uid()
  );
  IF public.is_admin(auth.uid()) OR is_house_owner THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.status                   := 'pending';
    NEW.payment_status           := 'unpaid';
    NEW.deposit_paid             := FALSE;
    NEW.checked_in_at            := NULL;
    NEW.checked_out_at           := NULL;
    NEW.points_awarded_for_amount := 0;
    RETURN NEW;
  END IF;

  -- UPDATE by the guest: revert privileged columns, EXCEPT allow
  -- self-cancel from 'pending' or 'approved' (cancellation policy).
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'cancelled' AND OLD.status IN ('pending', 'approved') THEN
      NULL;
    ELSE
      NEW.status := OLD.status;
    END IF;
  END IF;

  NEW.deposit_paid              := OLD.deposit_paid;
  NEW.checked_in_at             := OLD.checked_in_at;
  NEW.checked_out_at            := OLD.checked_out_at;
  NEW.points_awarded_for_amount := OLD.points_awarded_for_amount;

  IF NEW.payment_status IS DISTINCT FROM OLD.payment_status
     AND NEW.payment_status <> 'pending_verification' THEN
    NEW.payment_status := OLD.payment_status;
  END IF;

  NEW.deposit_amount := OLD.deposit_amount;

  NEW.house_id   := OLD.house_id;
  NEW.house_name := OLD.house_name;

  -- The discount that was agreed when the booking was made. Neither is
  -- ever a guest's to change.
  NEW.discount_pct_applied  := OLD.discount_pct_applied;
  NEW.price_before_discount := OLD.price_before_discount;

  RETURN NEW;
END;
$$;


-- ============================================================
-- Re-grant, for the reason 109 exists.
--
-- 096/097 replaced table-level SELECT on houses with a snapshot of
-- column-level grants, so any column added later is granted to nobody
-- and reads back as «permission denied for table houses». The three
-- discount columns above would land exactly there. Same enumeration,
-- same payment_methods exclusion.
-- ============================================================

DO $$
DECLARE cols TEXT;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'houses'
    AND column_name <> 'payment_methods';

  IF cols IS NULL THEN
    RAISE EXCEPTION 'public.houses not found — refusing to change grants';
  END IF;

  EXECUTE 'REVOKE SELECT ON public.houses FROM anon, authenticated';
  EXECUTE format('GRANT SELECT (%s) ON public.houses TO anon, authenticated', cols);
END $$;

REVOKE SELECT (payment_methods) ON public.houses FROM anon, authenticated;
