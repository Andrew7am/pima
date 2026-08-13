-- ============================================================
-- Browse-screen data: real popularity + a nearby landmark line.
--
-- 1) get_houses_booking_counts(): the explore screen wants to badge
--    the genuinely most-booked houses. Guests can't read other
--    people's bookings under RLS (correctly), so — same pattern as
--    get_houses_availability (migration 053) — a SECURITY DEFINER
--    function exposes ONLY an aggregate count per approved house:
--    no booking rows, no names, no dates leak. Only approved and
--    completed bookings count; pending requests and cancellations
--    are not popularity. The window is the last 365 days so the
--    badge reflects a full seasonal cycle rather than all history.
--
-- 2) houses.nearby_landmark: owner-written line like
--    «12 كم من المنتزه», shown beside the governorate on the card.
--    Same family as distance_from_university (001). Listing content,
--    so for an approved house it flows through pending_edit → admin
--    approval; the migration-019 trigger already blocks direct owner
--    writes to it (it reverts every column not explicitly re-allowed,
--    so a new column is protected by default — nothing to add there).
--    Reading it back, however, is NOT automatic — see the grants block
--    below, and docs/OPERATIONS.md on migration 080.
-- ============================================================

ALTER TABLE public.houses
  ADD COLUMN IF NOT EXISTS nearby_landmark TEXT;

-- Same free-text hardening every other listing column got in migration 058,
-- NOT VALID for the same reason (never rescans live rows). 80 is tight on
-- purpose: this renders as one pill beside the governorate on the browse
-- card, and anything longer would run under the details panel.
DO $$
BEGIN
  ALTER TABLE public.houses ADD CONSTRAINT houses_nearby_landmark_len
    CHECK (nearby_landmark IS NULL OR char_length(nearby_landmark) <= 80) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- REQUIRED after any ADD COLUMN on houses, and easy to miss: migration 080
-- dropped the table-level SELECT grant and handed back a fixed column list,
-- so a new column is unreadable to anon/authenticated until the list is
-- rebuilt. Without this the browse screen still renders (loadHouses retries
-- without the column) but nearby_landmark silently never appears, and every
-- page load logs a PostgREST error. Verified against the live project:
-- the ALTER above succeeded and the field was still invisible until this ran.
-- Same block as 080, re-derived so payment_methods stays excluded.
DO $$
DECLARE cols TEXT;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'houses'
    AND column_name <> 'payment_methods';

  IF cols IS NULL THEN
    RAISE EXCEPTION 'public.houses not found — refusing to change grants';
  END IF;

  EXECUTE 'REVOKE SELECT ON public.houses FROM anon, authenticated';
  EXECUTE format('GRANT SELECT (%s) ON public.houses TO anon, authenticated', cols);
END $$;

CREATE OR REPLACE FUNCTION public.get_houses_booking_counts()
RETURNS TABLE(house_id TEXT, bookings_count INTEGER)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    h.id,
    COALESCE((
      SELECT COUNT(*)::int
      FROM public.bookings b
      WHERE b.house_id = h.id
        AND b.status IN ('approved', 'completed')
        -- Only real guest bookings. Owners can record manual and temporary
        -- holds on their own house (migration 049) with their own user_id;
        -- counting those would let an owner award himself the badge.
        AND b.source = 'platform'
        -- Bounded on both sides: a far-future hold is not evidence of
        -- popularity, and the badge claims "the last year".
        AND b.check_in >= CURRENT_DATE - INTERVAL '365 days'
        AND b.check_in <= CURRENT_DATE
    ), 0) AS bookings_count
  FROM public.houses h
  WHERE h.status = 'approved';
$$;

GRANT EXECUTE ON FUNCTION public.get_houses_booking_counts() TO anon, authenticated;
