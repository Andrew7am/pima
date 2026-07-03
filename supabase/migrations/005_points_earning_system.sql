-- ============================================================
-- Points earning system, server-side (SECURITY DEFINER triggers)
-- Points must be granted in the DB, not the client: RLS only lets a
-- user update their OWN row, but deposit confirmation is often done
-- by the owner/admin on behalf of the client, and referral bonuses
-- go to a different user entirely. Both need to bypass RLS safely.
-- ============================================================

-- 1. Referral columns
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS referral_bonus_awarded BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE public.users SET referral_code = substr(md5(id::text || clock_timestamp()::text), 1, 8)
WHERE referral_code IS NULL;

-- 2. Track how much of a booking's price has already earned points,
--    so re-triggering on unrelated updates (check-in, etc.) is a no-op
--    and partial refunds/rejections can claw back correctly.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS points_awarded_for_amount NUMERIC NOT NULL DEFAULT 0;

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS points_awarded BOOLEAN NOT NULL DEFAULT FALSE;

-- ============================================================
-- Resolve referral code -> referred_by on signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  ref_id UUID;
BEGIN
  IF NEW.raw_user_meta_data->>'referral_code' IS NOT NULL THEN
    SELECT id INTO ref_id FROM public.users
    WHERE referral_code = NEW.raw_user_meta_data->>'referral_code' LIMIT 1;
  END IF;

  INSERT INTO public.users (id, email, name, role, phone, referral_code, referred_by)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'individual'),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    substr(md5(NEW.id::text || clock_timestamp()::text), 1, 8),
    ref_id
  );
  RETURN NEW;
END;
$$;

-- ============================================================
-- Award points when money is actually confirmed paid on a booking.
-- Earn rate: 1 point per 1 EGP paid (2 points off-season). Redemption is
-- 100 points = 1 EGP (see the client's HouseDetail redemption calc), so
-- the real payout is still 1% of price / 2% off-season = 20% / 40% of the
-- 5% platform commission -- loyalty spend never exceeds the platform's
-- own margin, it's just expressed in bigger, friendlier point numbers.
-- Also pays the referrer 20,000 points (= 200 EGP) on the referred user's
-- first points-earning payment.
-- ============================================================
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
BEGIN
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
        UPDATE public.users SET points = points + 20000 WHERE id = referrer;
        INSERT INTO public.points_history (id, user_id, amount, description, type)
        VALUES (
          'pt_ref_' || NEW.id || '_' || extract(epoch FROM clock_timestamp())::bigint,
          referrer, 20000,
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

DROP TRIGGER IF EXISTS trg_award_booking_points ON public.bookings;
CREATE TRIGGER trg_award_booking_points
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.award_booking_points();

-- ============================================================
-- Award 500 points (= 5 EGP at redemption) for submitting a review
-- ============================================================
CREATE OR REPLACE FUNCTION public.award_review_points()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT COALESCE(NEW.points_awarded, FALSE) THEN
    UPDATE public.users SET points = points + 500 WHERE id = NEW.user_id;
    INSERT INTO public.points_history (id, user_id, amount, description, type)
    VALUES (
      'pt_review_' || NEW.id, NEW.user_id, 500,
      'نقاط مكتسبة من تقييم بيت "' || COALESCE(NEW.house_name, '') || '"',
      'earned'
    );
    NEW.points_awarded := TRUE;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_award_review_points ON public.reviews;
CREATE TRIGGER trg_award_review_points
  BEFORE INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.award_review_points();
