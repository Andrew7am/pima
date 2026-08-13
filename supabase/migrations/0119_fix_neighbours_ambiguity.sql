-- ============================================================
-- get_house_neighbours raised «column reference "check_in" is
-- ambiguous» on every call, so the feature never returned anything.
--
-- My fault, and a PL/pgSQL trap worth naming: the function's OUT
-- parameters are called check_in and check_out, and the body also held
-- the caller's booking in a RECORD variable `b`. Inside the query,
-- `b.check_out` could mean the record's field or a column of a table
-- aliased b, and the OUT parameter of the same name is a third
-- candidate — so the planner refused rather than guessed.
--
-- Fixed by holding the booking's own dates in plainly-named scalars
-- instead of a record. Nothing about the behaviour or the safeguarding
-- changes: still aggregate only, still gated on the caller holding an
-- approved booking at that house.
--
-- Found by calling it against production after 111 landed rather than
-- by reading it — it typechecks fine and fails only at run time.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_house_neighbours(p_booking_id TEXT)
RETURNS TABLE (
  booking_type TEXT,
  size_band    TEXT,
  check_in     TEXT,
  check_out    TEXT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_house  TEXT;
  v_in     DATE;
  v_out    DATE;
  v_user   UUID;
  v_status TEXT;
BEGIN
  SELECT bk.house_id, bk.check_in, bk.check_out, bk.user_id, bk.status
    INTO v_house, v_in, v_out, v_user, v_status
    FROM public.bookings bk WHERE bk.id = p_booking_id;

  IF v_house IS NULL THEN RETURN; END IF;
  -- Only the group's own booker, and only once the stay is real.
  IF v_user <> auth.uid() AND NOT public.is_admin(auth.uid()) THEN RETURN; END IF;
  IF v_status <> 'approved' THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    COALESCE(o.conference_details->>'bookingType', 'standard')::TEXT,
    CASE
      WHEN o.guests_count <= 10 THEN 'أقل من ١٠'
      WHEN o.guests_count <= 25 THEN 'حوالي ١٠–٢٥'
      WHEN o.guests_count <= 50 THEN 'حوالي ٢٥–٥٠'
      ELSE 'أكتر من ٥٠'
    END::TEXT,
    o.check_in::TEXT,
    o.check_out::TEXT
  FROM public.bookings o
  WHERE o.house_id = v_house
    AND o.id <> p_booking_id
    AND o.status = 'approved'
    -- Overlapping nights: check-out day is not a night, so a group
    -- leaving the morning another arrives is not a neighbour.
    AND o.check_in < v_out
    AND o.check_out > v_in;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_house_neighbours(TEXT) TO authenticated;


-- ============================================================
-- And the grants, for the reason 109 exists.
--
-- 096/097 replaced table-level SELECT on houses with a snapshot of
-- column-level grants, so every column added since is readable by
-- nobody — latest_arrival_time (112) is currently returning 42501.
-- Same enumeration, same payment_methods exclusion. Safe to re-run.
-- ============================================================

DO $$
DECLARE cols TEXT;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'houses'
    AND column_name <> 'payment_methods';

  IF cols IS NULL THEN
    RAISE EXCEPTION 'public.houses not found — refusing to change grants';
  END IF;

  EXECUTE 'REVOKE SELECT ON public.houses FROM anon, authenticated';
  EXECUTE format('GRANT SELECT (%s) ON public.houses TO anon, authenticated', cols);
END $$;

REVOKE SELECT (payment_methods) ON public.houses FROM anon, authenticated;
