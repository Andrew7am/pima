-- ============================================================
-- Two ways to mint loyalty points out of nothing. Points redeem against real
-- bookings (100 points = 1 EGP, up to 10% of a booking), so both of these
-- are a direct liability, not a cosmetic score.
--
-- 1. Referral bonuses were paid at signup, before email confirmation.
--
--    on_auth_user_created is AFTER INSERT ON auth.users, so handle_new_user
--    fired the moment signUp() wrote the row — and signUp() requires
--    confirmation, so that row may never become a real account. There was no
--    cap either. Signing up me+1@gmail.com, me+2@gmail.com … each carrying
--    your own referral code paid 2,000 points a time, redeemable against real
--    inventory, for as long as you cared to keep typing.
--
--    Confirmation-gating alone would not fix it — Gmail plus-aliases all
--    deliver to the same inbox, so a farmer can confirm every one. It raises
--    the cost from seconds to minutes per account, and the cap below bounds
--    what that buys.
--
-- 2. Owners earned points on their own houses.
--
--    award_booking_points credits NEW.user_id whenever payment_status reaches
--    paid_deposit or paid_full, and the column guard trusts a house owner to
--    set any field on a booking for their own house. So an owner could book
--    their own listing, flip it to paid_full, and collect total_price × 2 in
--    points, repeatably.
--
--    This is not only an attack. The owner's "add booking" form records
--    walk-in guests under the OWNER's user id
--    (OwnerDashboardShell.tsx:504 — userId: owner.id), so every manual
--    booking an owner has ever recorded has been quietly paying them loyalty
--    points for someone else's stay. One condition fixes both, and it is the
--    honest rule either way: nobody earns points for a stay at their own
--    property.
--
--    Note this is deliberately fixed at the award, not at the column guard.
--    Blocking the owner from setting fields on bookings where user_id =
--    their own id would break that same manual-booking form, which is a
--    legitimate feature.
-- ============================================================


-- ── 1. Referral bonus: on confirmation, capped ──────────────────────────

-- Same as migration 050 minus the payout, which moves to the confirmation
-- trigger below. The row still records who referred whom.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  ref_id UUID;
BEGIN
  IF NEW.raw_user_meta_data->>'referral_code' IS NOT NULL THEN
    SELECT id INTO ref_id FROM public.users
    WHERE referral_code = NEW.raw_user_meta_data->>'referral_code' LIMIT 1;
  END IF;

  INSERT INTO public.users (id, email, name, role, phone, organization_name, referral_code, referred_by, referral_bonus_awarded)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'individual'),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    NEW.raw_user_meta_data->>'organization_name',
    substr(md5(NEW.id::text || clock_timestamp()::text), 1, 8),
    ref_id,
    FALSE   -- nothing is owed until this address is confirmed
  );

  RETURN NEW;
END;
$$;

-- How many referral bonuses one account can earn in a rolling 30 days.
-- Ten is far beyond any genuine user and bounds a farm at ~200 EGP of
-- redeemable value per month per account. Move it to platform_settings if it
-- ever needs to be tuned without a migration.
CREATE OR REPLACE FUNCTION public.award_referral_on_confirm()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  MONTHLY_CAP CONSTANT INTEGER := 10;
  ref_id        UUID;
  already       BOOLEAN;
  referred_name TEXT;
  v_referral    INTEGER;
  recent        INTEGER;
BEGIN
  SELECT referred_by, referral_bonus_awarded, name
    INTO ref_id, already, referred_name
    FROM public.users WHERE id = NEW.id;

  IF ref_id IS NULL OR COALESCE(already, FALSE) THEN
    RETURN NEW;
  END IF;

  -- Mark it settled either way, so a later confirmation event cannot retry.
  UPDATE public.users SET referral_bonus_awarded = TRUE WHERE id = NEW.id;

  SELECT count(*) INTO recent
    FROM public.points_history
    WHERE user_id = ref_id
      AND id LIKE 'pt_ref_%'
      AND created_at > now() - interval '30 days';

  IF recent >= MONTHLY_CAP THEN
    RETURN NEW;   -- over the cap: the account is created, the bonus is not paid
  END IF;

  SELECT COALESCE(referral_bonus_points, 2000) INTO v_referral
    FROM public.platform_settings WHERE id = 1;
  v_referral := COALESCE(v_referral, 2000);

  UPDATE public.users SET points = points + v_referral WHERE id = ref_id;

  -- Keyed on the referred user, so it can only ever be inserted once.
  INSERT INTO public.points_history (id, user_id, amount, description, type)
  VALUES (
    'pt_ref_' || NEW.id, ref_id, v_referral,
    'مكافأة إحالة صديق: ' || COALESCE(referred_name, 'صديق') || ' فعّل حسابه',
    'earned'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_confirmed
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.award_referral_on_confirm();


-- ── 2. No points for staying at your own house ──────────────────────────

-- Identical to the migration 024 version except for the ownership check at
-- the top. Everything below it — the multiplier, the delta accounting, the
-- reversal branch, and the first-paid-booking referral fallback — is
-- unchanged, character for character.
--
-- That referral block stays deliberately. Migration 050 made it a no-op by
-- paying at signup and stamping referral_bonus_awarded immediately; this
-- migration sets that flag FALSE again, so the block becomes reachable — as a
-- fallback for any account whose confirmation event never fired (an
-- admin-created user arrives with email_confirmed_at already set, so the
-- UPDATE trigger above never sees a transition). It cannot be farmed: paying
-- for a real booking costs far more than the bonus is worth.
CREATE OR REPLACE FUNCTION public.award_booking_points()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
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

  -- The booker owns the house. Either they are self-dealing, or this is a
  -- walk-in the owner recorded under their own account — neither earns
  -- loyalty points. Still stamp points_awarded_for_amount so the reversal
  -- branch stays consistent if the booking is later unpaid.
  IF EXISTS (
    SELECT 1 FROM public.houses h
    WHERE h.id = NEW.house_id AND h.owner_id = NEW.user_id
  ) THEN
    NEW.points_awarded_for_amount := CASE
      WHEN NEW.payment_status = 'paid_full'    THEN NEW.total_price
      WHEN NEW.payment_status = 'paid_deposit' THEN COALESCE(NEW.deposit_amount, 0)
      ELSE 0
    END;
    RETURN NEW;
  END IF;

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
