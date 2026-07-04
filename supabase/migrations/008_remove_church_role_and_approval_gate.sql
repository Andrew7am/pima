-- ============================================================
-- Remove the 'church' account role, and require admin approval
-- (plus a mandatory ID card front/back upload) for servant/owner
-- accounts before they can use the app.
-- ============================================================

-- 1. Reassign any existing 'church' accounts before the CHECK constraint
--    stops allowing that value. Data preserved, just no longer a distinct
--    account type — nothing is deleted.
UPDATE public.users SET role = 'individual' WHERE role = 'church';

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK (role IN ('individual', 'servant', 'owner', 'admin'));

-- 2. Approval workflow + ID card columns. approval_status replaces the
--    old is_approved boolean (which existed but was never actually wired
--    up to anything) with a proper pending/approved/rejected status,
--    matching the pattern already used for bookings/houses.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS id_card_front TEXT,
  ADD COLUMN IF NOT EXISTS id_card_back TEXT;

-- Grandfather every account that already exists (including current
-- servant/owner demo accounts) so this new gate doesn't lock out anyone
-- already using the app. Only NEW servant/owner signups from this point
-- on start as 'pending'.
UPDATE public.users SET approval_status = 'approved';

-- 3. New signups: servant/owner start pending, everyone else auto-approved.
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
    age, village, city, governorate, church_name, priest_name,
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
    (NEW.raw_user_meta_data->>'age')::INTEGER,
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

-- 4. Admins need to read and update EVERY user's row (to review pending
--    accounts and approve/reject them) — the existing policies only ever
--    allowed a user to see/edit their OWN row.
CREATE POLICY "users_select_admin" ON public.users FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
);
CREATE POLICY "users_update_admin" ON public.users FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
);
