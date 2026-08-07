-- ============================================================
-- 106: count how many times each house has been looked at
--
-- The admin's properties screen wants a «مشاهدات» figure and the
-- app has never had one — no column, no event, nothing. This adds
-- the real thing rather than a number that looks plausible.
--
-- A row per view, not a counter on houses, for three reasons:
--   * houses is guarded by the owner-edit triggers (019/055) and
--     a counter living there would have to be threaded through
--     every one of them;
--   * a timestamp means «آخر ٣٠ يوم» is a query rather than a
--     second column that has to be maintained;
--   * a view is a fact that happened, and facts keep better than
--     totals.
--
-- WHAT THIS NUMBER IS, so nobody reads more into it than it holds:
-- a house detail page being opened. Signed-in viewers are
-- deduplicated server-side to one view per house per hour, so
-- refreshing does not inflate anything. Anonymous visitors — the
-- app lets people browse without an account — cannot be identified
-- server-side at all, so their repeat views are suppressed on the
-- client only, and that is best-effort. It is an interest signal,
-- not an audited figure, and nothing is awarded on the strength of
-- it.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.house_views (
  id         BIGSERIAL PRIMARY KEY,
  house_id   TEXT NOT NULL REFERENCES public.houses(id) ON DELETE CASCADE,
  -- NULL for a visitor who is not signed in. They are still real
  -- interest and still counted; they just cannot be deduplicated.
  viewer_id  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  viewed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The two shapes this table is ever read in: totals per house, and
-- recent activity for one house.
CREATE INDEX IF NOT EXISTS house_views_house_idx ON public.house_views (house_id);
CREATE INDEX IF NOT EXISTS house_views_recent_idx ON public.house_views (house_id, viewed_at DESC);
-- Backs the dedup lookup below.
CREATE INDEX IF NOT EXISTS house_views_dedup_idx ON public.house_views (viewer_id, house_id, viewed_at DESC)
  WHERE viewer_id IS NOT NULL;

ALTER TABLE public.house_views ENABLE ROW LEVEL SECURITY;

-- No policies at all, deliberately — same model as game_rooms. Every
-- read and write goes through the SECURITY DEFINER functions below,
-- so a client cannot insert a thousand rows directly or read another
-- owner's numbers.


-- ============================================================
-- record_house_view — called when a house page opens.
--
-- Silent about everything. It is fire-and-forget telemetry on a
-- screen the visitor came to read, so a failure here must never
-- surface to them or block the page: an unknown house, an
-- unapproved one, or a duplicate all simply return false.
-- ============================================================
CREATE OR REPLACE FUNCTION public.record_house_view(p_house_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  uid UUID := auth.uid();
  exists_house BOOLEAN;
BEGIN
  SELECT TRUE INTO exists_house FROM public.houses WHERE id = p_house_id;
  IF exists_house IS NOT TRUE THEN RETURN FALSE; END IF;

  -- One view per signed-in person per house per hour. Without this a
  -- refresh, a back-and-forward, or a photo carousel remount would
  -- each count, and the busiest house would be whichever one someone
  -- had trouble loading.
  IF uid IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.house_views
     WHERE viewer_id = uid AND house_id = p_house_id
       AND viewed_at > NOW() - INTERVAL '1 hour'
  ) THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.house_views (house_id, viewer_id) VALUES (p_house_id, uid);
  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_house_view(TEXT) TO anon, authenticated;


-- ============================================================
-- house_view_counts — totals for the admin, and for an owner about
-- their own houses. Nobody else sees another owner's numbers.
-- ============================================================
CREATE OR REPLACE FUNCTION public.house_view_counts()
RETURNS TABLE(house_id TEXT, views_total BIGINT, views_30d BIGINT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  uid UUID := auth.uid();
  admin BOOLEAN;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  admin := public.is_admin(uid);

  RETURN QUERY
  SELECT v.house_id,
         COUNT(*)::BIGINT,
         COUNT(*) FILTER (WHERE v.viewed_at > NOW() - INTERVAL '30 days')::BIGINT
    FROM public.house_views v
    JOIN public.houses h ON h.id = v.house_id
   WHERE admin OR h.owner_id = uid
   GROUP BY v.house_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.house_view_counts() TO authenticated;
