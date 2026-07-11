-- ============================================================
-- Self-service account deletion.
--
-- public.users.id -> auth.users(id) ON DELETE CASCADE, and every
-- user-owned table (bookings, reviews, payments, notifications,
-- points_history, houses.owner_id, ...) cascades from there. So
-- deleting the auth.users row cleanly removes everything the user
-- owns directly.
--
-- BUT houses.owner_id also cascades — if an OWNER deletes their
-- account, every house they own is deleted too, which cascades
-- further into OTHER users' bookings/reviews/payments for those
-- houses. That's too destructive for instant self-service, so
-- delete_own_account() only allows individual/servant roles to
-- self-delete; owners/admins are told to contact support instead.
--
-- users.referred_by has no ON DELETE action (defaults to RESTRICT),
-- so deleting a user who referred others would fail with a FK
-- violation. Switch it to SET NULL — the referral bonus was already
-- paid out at the time, this is just a now-stale back-reference.
-- ============================================================

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_referred_by_fkey;
ALTER TABLE public.users ADD CONSTRAINT users_referred_by_fkey
  FOREIGN KEY (referred_by) REFERENCES public.users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  my_role TEXT;
BEGIN
  SELECT role INTO my_role FROM public.users WHERE id = auth.uid();
  IF my_role IS NULL THEN
    RAISE EXCEPTION 'USER_NOT_FOUND';
  END IF;
  IF my_role NOT IN ('individual', 'servant') THEN
    RAISE EXCEPTION 'ACCOUNT_TYPE_NOT_SELF_DELETABLE';
  END IF;

  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;
