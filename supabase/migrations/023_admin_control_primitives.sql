-- ============================================================
-- Admin control powers (phase 1): suspend houses, ban users,
-- delete reviews. Cancelling a booking reuses the existing admin
-- UPDATE policy (status -> 'rejected'), so no schema change for that.
-- ============================================================

-- 1. A 'suspended' house status: an approved house the admin has taken
--    down. Distinct from 'rejected' (a never-approved submission) so the
--    owner sees an accurate label. Suspended houses are hidden from the
--    public exactly like non-approved ones (houses_select_approved only
--    exposes status = 'approved').
DO $$
DECLARE cname TEXT;
BEGIN
  SELECT conname INTO cname FROM pg_constraint
  WHERE conrelid = 'public.houses'::regclass AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%status%';
  IF cname IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.houses DROP CONSTRAINT ' || quote_ident(cname);
  END IF;
END $$;

ALTER TABLE public.houses
  ADD CONSTRAINT houses_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'suspended'));

-- 2. Ban flag on users. Blocks the account from using the app (enforced
--    in the client), for ANY role — approval_status only ever gated
--    servant/owner. Must be admin-only: fold it into the privileged-column
--    protection trigger so a banned user can't clear their own ban via the
--    API. (Recreates the migration-017 function with is_banned added.)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE FUNCTION public.protect_user_privileged_columns()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF current_user = 'authenticated' AND NOT public.is_admin(auth.uid()) THEN
    NEW.points                  := OLD.points;
    NEW.approval_status         := OLD.approval_status;
    NEW.referral_code           := OLD.referral_code;
    NEW.referred_by             := OLD.referred_by;
    NEW.referral_bonus_awarded  := OLD.referral_bonus_awarded;
    NEW.is_banned               := OLD.is_banned;
    IF NEW.role = 'admin' AND OLD.role <> 'admin' THEN
      NEW.role := OLD.role;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Let admins delete reviews (spam / abuse moderation). The
--    recompute_house_rating trigger (020) already fires on DELETE, so the
--    house rating self-corrects afterwards.
DROP POLICY IF EXISTS "reviews_delete_admin" ON public.reviews;
CREATE POLICY "reviews_delete_admin" ON public.reviews
  FOR DELETE USING (public.is_admin(auth.uid()));
