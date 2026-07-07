-- ============================================================
-- CRITICAL security fix: privileged-column protection on public.users
--
-- RLS "users_update_own" (migration 001) lets a user update their OWN
-- row — but with no column-level restriction that means ANY column,
-- including role, approval_status, points and the referral fields. So
-- any authenticated user could open the browser console and run
--   supabase.from('users').update({ role: 'admin' }).eq('id', myId)
-- to become an admin (is_admin() then returns true), self-approve a
-- pending servant/owner account, or grant themselves unlimited points.
--
-- Fix: a BEFORE UPDATE trigger that, for DIRECT client updates only,
-- forces the privileged columns back to their previous values (and
-- forbids escalating role to 'admin'). Trusted SECURITY DEFINER paths —
-- the points-award trigger (005) and the redeem_points() function below —
-- run as the table owner (current_user <> 'authenticated'), so they pass
-- through untouched. Admins (is_admin) are also allowed through, so the
-- account-approval flow keeps working.
-- ============================================================

CREATE OR REPLACE FUNCTION public.protect_user_privileged_columns()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Only guard updates coming straight from a logged-in client
  -- (PostgREST sets the role to 'authenticated'). Definer functions owned
  -- by postgres run with a different current_user and are trusted.
  IF current_user = 'authenticated' AND NOT public.is_admin(auth.uid()) THEN
    NEW.points                  := OLD.points;
    NEW.approval_status         := OLD.approval_status;
    NEW.referral_code           := OLD.referral_code;
    NEW.referred_by             := OLD.referred_by;
    NEW.referral_bonus_awarded  := OLD.referral_bonus_awarded;
    -- role may still change between non-privileged values (e.g. a Google
    -- user picking servant/owner at profile completion), but never to admin.
    IF NEW.role = 'admin' AND OLD.role <> 'admin' THEN
      NEW.role := OLD.role;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_user_columns ON public.users;
CREATE TRIGGER trg_protect_user_columns
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.protect_user_privileged_columns();

-- ============================================================
-- Points redemption must now go through a trusted function, since the
-- trigger above blocks the old client-side `update({ points })` path.
-- Validates the balance server-side (no more redeeming points you don't
-- have) and records the history row atomically.
-- ============================================================
CREATE OR REPLACE FUNCTION public.redeem_points(p_amount INT, p_description TEXT)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  cur INT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;

  SELECT points INTO cur FROM public.users WHERE id = auth.uid();
  IF cur IS NULL OR cur < p_amount THEN RAISE EXCEPTION 'INSUFFICIENT_POINTS'; END IF;

  UPDATE public.users SET points = points - p_amount WHERE id = auth.uid();
  INSERT INTO public.points_history (id, user_id, amount, description, type)
  VALUES (
    'pt_red_' || auth.uid() || '_' || extract(epoch FROM clock_timestamp())::bigint,
    auth.uid(), p_amount, COALESCE(p_description, 'استبدال نقاط'), 'redeemed'
  );
  RETURN cur - p_amount;
END;
$$;
