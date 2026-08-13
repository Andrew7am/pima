-- ============================================================
-- Platform settings (phase 3): make the economic levers editable by
-- admins instead of hard-coded. A single-row table the whole app can
-- read but only admins can update. The two money/points triggers that
-- previously hard-coded these numbers now read them from here, so a
-- change in the admin panel is enforced server-side too.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.platform_settings (
  id                    INT PRIMARY KEY DEFAULT 1,
  commission_rate       NUMERIC NOT NULL DEFAULT 0.05,   -- platform cut (display/payout math)
  deposit_rate          NUMERIC NOT NULL DEFAULT 0.15,   -- upfront deposit fraction
  points_per_egp        INT     NOT NULL DEFAULT 100,    -- redemption: 100 pts = 1 EGP
  max_redemption_pct    NUMERIC NOT NULL DEFAULT 0.10,   -- max share of a booking payable by points
  referral_bonus_points INT     NOT NULL DEFAULT 2000,   -- awarded to referrer on first paid booking
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT platform_settings_single_row CHECK (id = 1)
);

INSERT INTO public.platform_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "platform_settings_select_all" ON public.platform_settings;
DROP POLICY IF EXISTS "platform_settings_update_admin" ON public.platform_settings;
CREATE POLICY "platform_settings_select_all" ON public.platform_settings FOR SELECT USING (TRUE);
CREATE POLICY "platform_settings_update_admin" ON public.platform_settings FOR UPDATE
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ── Rewrite validate_booking_price (018) to read deposit_rate and the
--    redemption cap from settings. Logic is otherwise identical.
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

  SELECT property_type, price_per_night_per_person, monthly_rent
    INTO h_type, h_night, h_month
    FROM public.houses WHERE id = NEW.house_id;

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
  min_allowed := FLOOR(expected * (1 - v_max_redeem)) - 1;

  IF NEW.total_price < min_allowed THEN
    RAISE EXCEPTION 'PRICE_TOO_LOW: expected at least %, got % (house rate % x % guests x % units)',
      min_allowed, NEW.total_price, unit, NEW.guests_count, qty;
  END IF;

  NEW.deposit_amount := ROUND(NEW.total_price * v_deposit);
  RETURN NEW;
END;
$$;

-- ── Rewrite award_booking_points (005) to read the referral bonus from
--    settings. Only the hard-coded 2000 changes; everything else is
--    identical to migration 005.
CREATE OR REPLACE FUNCTION public.award_booking_points()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  new_paid    NUMERIC;
  delta       NUMERIC;
  multiplier  INTEGER;
  pts         INTEGER;
  checkin_month INTEGER;
  referrer      UUID;
  referred_awarded BOOLEAN;
  referred_name    TEXT;
  v_referral    INTEGER;
BEGIN
  SELECT COALESCE(referral_bonus_points, 2000) INTO v_referral
    FROM public.platform_settings WHERE id = 1;
  v_referral := COALESCE(v_referral, 2000);

  new_paid := CASE
    WHEN NEW.payment_status = 'paid_full'    THEN NEW.total_price
    WHEN NEW.payment_status = 'paid_deposit' THEN COALESCE(NEW.deposit_amount, 0)
    ELSE 0
  END;

  delta := new_paid - COALESCE(NEW.points_awarded_for_amount, 0);

  IF delta <> 0 THEN
    checkin_month := EXTRACT(MONTH FROM NEW.check_in);
    multiplier := CASE WHEN checkin_month IN (7, 8) THEN 1 ELSE 2 END;
    pts := ROUND(delta * multiplier);

    IF pts > 0 THEN
      UPDATE public.users SET points = points + pts WHERE id = NEW.user_id;
      INSERT INTO public.points_history (id, user_id, amount, description, type)
      VALUES (
        'pt_earn_' || NEW.id || '_' || extract(epoch FROM clock_timestamp())::bigint,
        NEW.user_id, pts,
        'نقاط مكتسبة من دفع حجز "' || NEW.house_name || '"' ||
          CASE WHEN multiplier = 2 THEN ' (×2 موسم غير ذروة)' ELSE '' END,
        'earned'
      );
    ELSIF pts < 0 THEN
      UPDATE public.users SET points = GREATEST(0, points + pts) WHERE id = NEW.user_id;
      INSERT INTO public.points_history (id, user_id, amount, description, type)
      VALUES (
        'pt_revert_' || NEW.id || '_' || extract(epoch FROM clock_timestamp())::bigint,
        NEW.user_id, -pts,
        'استرجاع نقاط بسبب إلغاء/رفض دفع حجز "' || NEW.house_name || '"',
        'redeemed'
      );
    END IF;

    NEW.points_awarded_for_amount := new_paid;

    IF pts > 0 THEN
      SELECT referred_by, referral_bonus_awarded, name INTO referrer, referred_awarded, referred_name
      FROM public.users WHERE id = NEW.user_id;

      IF referrer IS NOT NULL AND NOT referred_awarded THEN
        UPDATE public.users SET points = points + v_referral WHERE id = referrer;
        INSERT INTO public.points_history (id, user_id, amount, description, type)
        VALUES (
          'pt_ref_' || NEW.id || '_' || extract(epoch FROM clock_timestamp())::bigint,
          referrer, v_referral,
          'مكافأة إحالة صديق: ' || COALESCE(referred_name, 'صديق') || ' أكمل أول حجز مدفوع',
          'earned'
        );
        UPDATE public.users SET referral_bonus_awarded = TRUE WHERE id = NEW.user_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
