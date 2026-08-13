-- ============================================================
-- Referral bonus used to only pay out once the REFERRED friend made a
-- paid booking (award_booking_points, migration 005) — in practice that
-- meant most referrers never got their 2,000 points, since most invited
-- friends never went on to book. Move the payout to signup itself: the
-- referrer earns their bonus the moment their invited friend registers,
-- no booking required.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  ref_id UUID;
  v_referral INTEGER;
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
    ref_id IS NOT NULL  -- paid out right here at signup — the booking-time path is now a no-op for this user
  );

  IF ref_id IS NOT NULL THEN
    -- referral_bonus_points is admin-editable (platform_settings, migration 024) — read it live, never hard-code
    SELECT COALESCE(referral_bonus_points, 2000) INTO v_referral FROM public.platform_settings WHERE id = 1;
    v_referral := COALESCE(v_referral, 2000);

    UPDATE public.users SET points = points + v_referral WHERE id = ref_id;
    INSERT INTO public.points_history (id, user_id, amount, description, type)
    VALUES (
      'pt_ref_' || NEW.id, ref_id, v_referral,
      'مكافأة إحالة صديق: ' || COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)) || ' سجّل حساب جديد',
      'earned'
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Backfill: users who were already referred before this migration but
-- hadn't made a paid booking yet (so their referrer never got paid under
-- the old rule) — pay their referrer now, since under the new rule
-- signup alone qualifies.
DO $$
DECLARE
  r RECORD;
  v_referral INTEGER;
BEGIN
  SELECT COALESCE(referral_bonus_points, 2000) INTO v_referral FROM public.platform_settings WHERE id = 1;
  v_referral := COALESCE(v_referral, 2000);

  FOR r IN
    SELECT id, referred_by, name FROM public.users
    WHERE referred_by IS NOT NULL AND referral_bonus_awarded = FALSE
  LOOP
    UPDATE public.users SET points = points + v_referral WHERE id = r.referred_by;
    INSERT INTO public.points_history (id, user_id, amount, description, type)
    VALUES (
      'pt_ref_backfill_' || r.id, r.referred_by, v_referral,
      'مكافأة إحالة صديق: ' || COALESCE(r.name, 'صديق') || ' سجّل حساب جديد',
      'earned'
    );
    UPDATE public.users SET referral_bonus_awarded = TRUE WHERE id = r.id;
  END LOOP;
END $$;
