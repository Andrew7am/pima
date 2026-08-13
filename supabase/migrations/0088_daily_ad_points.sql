-- ============================================================
-- Daily rewarded-ad points: +25 once per Cairo calendar day.
--
-- Granted server-side like every other point source (005): the client
-- calls this RPC after the ad gate completes, and the function is the
-- only thing that writes — a user cannot self-grant more than once a
-- day no matter what the client does. Idempotent by construction: the
-- duplicate check and the insert live in the same function, and the
-- history row's id makes replays visible.
--
-- 25 points = a token thank-you (a quarter EGP at redemption), sized so
-- watching daily for a year stays under two bookings' worth of points.
-- ============================================================

CREATE OR REPLACE FUNCTION public.claim_daily_ad_points()
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  uid UUID;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN RETURN FALSE; END IF;

  -- One claim per Cairo calendar day. The id prefix scopes the check to ad
  -- claims only, so booking/review/referral rows never block it.
  IF EXISTS (
    SELECT 1 FROM public.points_history
    WHERE user_id = uid
      AND id LIKE 'pt_ad_%'
      AND (created_at AT TIME ZONE 'Africa/Cairo')::date = (now() AT TIME ZONE 'Africa/Cairo')::date
  ) THEN
    RETURN FALSE;
  END IF;

  UPDATE public.users SET points = COALESCE(points, 0) + 25 WHERE id = uid;
  INSERT INTO public.points_history (id, user_id, amount, description, type)
  VALUES (
    'pt_ad_' || uid || '_' || extract(epoch FROM clock_timestamp())::bigint,
    uid, 25, 'نقاط مشاهدة إعلان اليوم', 'earned'
  );
  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_daily_ad_points() TO authenticated;
