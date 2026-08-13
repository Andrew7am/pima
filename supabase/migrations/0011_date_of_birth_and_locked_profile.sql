-- ============================================================
-- Replace numeric age with a real date of birth (age is derived,
-- calculated client-side wherever it's shown). Profile fields become
-- read-only after signup — enforced in the app UI, this migration
-- just swaps the storage shape.
-- ============================================================

ALTER TABLE public.users
  DROP COLUMN IF EXISTS age,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  ref_id UUID;
  signup_role TEXT;
BEGIN
  signup_role := COALESCE(NEW.raw_user_meta_data->>'role', 'individual');

  IF NEW.raw_user_meta_data->>'referral_code' IS NOT NULL THEN
    SELECT id INTO ref_id FROM public.users
    WHERE referral_code = NEW.raw_user_meta_data->>'referral_code' LIMIT 1;
  END IF;

  INSERT INTO public.users (
    id, email, name, role, phone, referral_code, referred_by,
    date_of_birth, village, city, governorate, church_name, priest_name,
    approval_status
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    signup_role,
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    substr(md5(NEW.id::text || clock_timestamp()::text), 1, 8),
    ref_id,
    (NEW.raw_user_meta_data->>'date_of_birth')::DATE,
    NEW.raw_user_meta_data->>'village',
    NEW.raw_user_meta_data->>'city',
    NEW.raw_user_meta_data->>'governorate',
    NEW.raw_user_meta_data->>'church_name',
    NEW.raw_user_meta_data->>'priest_name',
    CASE WHEN signup_role IN ('servant', 'owner') THEN 'pending' ELSE 'approved' END
  );
  RETURN NEW;
END;
$$;
