-- ============================================================
-- HIGH security fix: server-side booking price validation.
--
-- total_price and deposit_amount are computed in the browser
-- (HouseDetail.tsx) and inserted as-is. The capacity trigger (003)
-- checks beds but NOT money, so any user could open the console and
--   supabase.from('bookings').insert({ ..., total_price: 1 })
-- to book for ~nothing. bookings_update_user also lets them patch
-- total_price down after the fact.
--
-- Fix: a BEFORE INSERT OR UPDATE trigger that recomputes the expected
-- price from the house's own rate × guests × nights (or × months for
-- monthly student/staff housing) and rejects anything below it. A 10%
-- floor allowance covers the points-redemption discount (capped at 10%
-- of the booking, per the rewards policy) plus a 1 EGP rounding margin.
-- Only a LOWER bound is enforced — overpaying only hurts the payer and
-- points are awarded on admin-confirmed amounts, so there's no upside to
-- inflating it. deposit_amount is normalized to 15% of the final total
-- so it can't be forged independently.
--
-- Mirrors the client formulas exactly:
--   nights  = GREATEST(1, check_out - check_in)
--   months  = GREATEST(1, ROUND((check_out - check_in) / 30))
--   regular = price_per_night_per_person × guests × nights
--   monthly = COALESCE(monthly_rent, 1500) × guests × months
-- ============================================================

CREATE OR REPLACE FUNCTION public.validate_booking_price()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  h_type   TEXT;
  h_night  NUMERIC;
  h_month  NUMERIC;
  qty      INTEGER;
  unit     NUMERIC;
  expected NUMERIC;
  min_allowed NUMERIC;
BEGIN
  -- Only validate on creation or when a price-relevant field actually
  -- changed. Plain status/check-in/payment updates (and old bookings whose
  -- stored price predates this rule) pass through untouched, so this can't
  -- break existing operations — it only guards new or re-priced bookings.
  IF TG_OP = 'UPDATE'
     AND NEW.total_price  = OLD.total_price
     AND NEW.guests_count = OLD.guests_count
     AND NEW.check_in     = OLD.check_in
     AND NEW.check_out    = OLD.check_out THEN
    RETURN NEW;
  END IF;

  SELECT property_type, price_per_night_per_person, monthly_rent
    INTO h_type, h_night, h_month
    FROM public.houses WHERE id = NEW.house_id;

  -- House missing is handled by the capacity trigger; don't double-fault here.
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF h_type IN ('student', 'staff') THEN
    qty  := GREATEST(1, ROUND((NEW.check_out - NEW.check_in)::numeric / 30))::int;
    unit := COALESCE(h_month, 1500);
  ELSE
    qty  := GREATEST(1, (NEW.check_out - NEW.check_in));
    unit := COALESCE(h_night, 0);
  END IF;

  expected    := unit * NEW.guests_count * qty;
  -- allow up to 10% off (points redemption) + 1 EGP rounding tolerance
  min_allowed := FLOOR(expected * 0.9) - 1;

  IF NEW.total_price < min_allowed THEN
    RAISE EXCEPTION 'PRICE_TOO_LOW: expected at least %, got % (house rate % x % guests x % units)',
      min_allowed, NEW.total_price, unit, NEW.guests_count, qty;
  END IF;

  -- Keep the deposit consistent with the (possibly points-discounted) total.
  NEW.deposit_amount := ROUND(NEW.total_price * 0.15);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bk_validate_price ON public.bookings;
-- Name sorts before enforce_booking_capacity (003) and trg_award_booking_points
-- (005) so the price is validated and the deposit normalized before those run.
CREATE TRIGGER bk_validate_price
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.validate_booking_price();
