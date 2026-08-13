-- ============================================================
-- Sign-up asks six questions and stores none of the answers
--
-- handle_new_user() copies the sign-up metadata into public.users. Migration
-- 092 rewrote it to add the referral columns and, in doing so, wrote a shorter
-- INSERT than the one it replaced:
--
--   012 and 041:  ... date_of_birth, address, governorate, church_name, priest_name
--   092:          id, email, name, role, phone, organization_name,
--                 referral_code, referred_by, referral_bonus_awarded
--
-- Nothing errored. auth.signUp() still sends all of it in raw_user_meta_data,
-- the form still asks for all of it, and the trigger has been dropping five
-- fields on the floor ever since. Every account created after 092 has a null
-- birth date, no governorate, no address, and — for servants and individuals —
-- no church and no priest.
--
-- The data is not lost: raw_user_meta_data on auth.users still holds every
-- answer. The backfill at the end reads it back.
--
-- diocese joins them. It is new (117) and was never in any version of this
-- function, so the two-step servant form has been writing an answer the
-- database had nowhere to put.
-- ============================================================

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

  INSERT INTO public.users (
    id, email, name, role, phone, organization_name,
    date_of_birth, address, governorate, church_name, priest_name, diocese,
    referral_code, referred_by, referral_bonus_awarded
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'individual'),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    NEW.raw_user_meta_data->>'organization_name',
    -- A blank string is not a date. NULLIF keeps an empty answer from
    -- aborting the whole sign-up on a cast error.
    NULLIF(NEW.raw_user_meta_data->>'date_of_birth', '')::DATE,
    NULLIF(NEW.raw_user_meta_data->>'address', ''),
    NULLIF(NEW.raw_user_meta_data->>'governorate', ''),
    NULLIF(NEW.raw_user_meta_data->>'church_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'priest_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'diocese', ''),
    substr(md5(NEW.id::text || clock_timestamp()::text), 1, 8),
    ref_id,
    FALSE   -- nothing is owed until this address is confirmed
  );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
  'Copies sign-up metadata into public.users. Every field the form asks for '
  'must appear here — 092 dropped five of them silently and nobody noticed '
  'until a report over governorate came back empty.';

-- ── Backfill ────────────────────────────────────────────────────────────────
-- Read the answers back out of auth.users for every account the short INSERT
-- ran on. COALESCE, not overwrite: anything a user has since corrected in
-- their profile wins over what they typed at sign-up.
UPDATE public.users u
   SET date_of_birth = COALESCE(u.date_of_birth, NULLIF(a.raw_user_meta_data->>'date_of_birth', '')::DATE),
       address       = COALESCE(u.address,       NULLIF(a.raw_user_meta_data->>'address', '')),
       governorate   = COALESCE(u.governorate,   NULLIF(a.raw_user_meta_data->>'governorate', '')),
       church_name   = COALESCE(u.church_name,   NULLIF(a.raw_user_meta_data->>'church_name', '')),
       priest_name   = COALESCE(u.priest_name,   NULLIF(a.raw_user_meta_data->>'priest_name', '')),
       diocese       = COALESCE(u.diocese,       NULLIF(a.raw_user_meta_data->>'diocese', ''))
  FROM auth.users a
 WHERE a.id = u.id
   AND a.raw_user_meta_data IS NOT NULL
   AND (u.date_of_birth IS NULL OR u.governorate IS NULL OR u.address IS NULL
        OR u.church_name IS NULL OR u.priest_name IS NULL OR u.diocese IS NULL);
