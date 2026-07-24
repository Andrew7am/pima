-- 076_wheel_of_fortune.sql
-- Entertainment "wheel of fortune": awards redeemable discount points, but
-- because `points` is a locked column (see 017_lock_privileged_user_columns)
-- and the reward is redeemable on real bookings, the spin MUST be server-side
-- and rate-limited so it can't be farmed. One spin per 24h per user; the reward
-- is chosen on the server.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_wheel_spin_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.spin_wheel()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid       UUID := auth.uid();
  last_spin TIMESTAMPTZ;
  rewards   INT[] := ARRAY[10, 20, 30, 50, 75, 100];
  chosen    INT;
  new_pts   INT;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  SELECT last_wheel_spin_at INTO last_spin FROM public.users WHERE id = uid;

  IF last_spin IS NOT NULL AND last_spin > now() - interval '24 hours' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'ALREADY_SPUN',
      'next_at', last_spin + interval '24 hours'
    );
  END IF;

  -- Server-chosen reward (arrays are 1-indexed in Postgres).
  chosen := rewards[1 + floor(random() * array_length(rewards, 1))::int];

  UPDATE public.users
     SET points = COALESCE(points, 0) + chosen,
         last_wheel_spin_at = now()
   WHERE id = uid
   RETURNING points INTO new_pts;

  RETURN jsonb_build_object('ok', true, 'points_awarded', chosen, 'new_points', new_pts);
END;
$$;

GRANT EXECUTE ON FUNCTION public.spin_wheel() TO authenticated;
