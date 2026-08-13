-- ============================================================
-- Extra signup fields: age, location, and home-church details
-- ============================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS age INTEGER,
  ADD COLUMN IF NOT EXISTS village TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS governorate TEXT,
  ADD COLUMN IF NOT EXISTS church_name TEXT,
  ADD COLUMN IF NOT EXISTS priest_name TEXT;

-- Copy the new fields from signup metadata, same as migration 005 did for
-- referral_code/referred_by. CREATE OR REPLACE keeps everything else the
-- same; the on_auth_user_created trigger already points at this function.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  ref_id UUID;
BEGIN
  IF NEW.raw_user_meta_data->>'referral_code' IS NOT NULL THEN
    SELECT id INTO ref_id FROM public.users
    WHERE referral_code = NEW.raw_user_meta_data->>'referral_code' LIMIT 1;
  END IF;

  INSERT INTO public.users (
    id, email, name, role, phone, referral_code, referred_by,
    age, village, city, governorate, church_name, priest_name
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'individual'),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    substr(md5(NEW.id::text || clock_timestamp()::text), 1, 8),
    ref_id,
    (NEW.raw_user_meta_data->>'age')::INTEGER,
    NEW.raw_user_meta_data->>'village',
    NEW.raw_user_meta_data->>'city',
    NEW.raw_user_meta_data->>'governorate',
    NEW.raw_user_meta_data->>'church_name',
    NEW.raw_user_meta_data->>'priest_name'
  );
  RETURN NEW;
END;
$$;
