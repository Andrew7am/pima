-- ============================================================
-- Banner analytics: first-party impression/click events.
--
-- The admin banner dashboard needs numbers that belong to Pima, queryable
-- from inside the app. The existing lib/analytics.ts only forwards funnel
-- events to GA4 (and ships disabled), and GA data cannot be read back into
-- an admin screen — hence this table.
--
-- Privacy: no IP, no user agent string, no personal data. Only an opaque
-- per-session id, a coarse platform label and a viewport width bucket.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.banner_events (
  id         BIGSERIAL PRIMARY KEY,
  banner_id  TEXT NOT NULL REFERENCES public.promo_banners(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL CHECK (kind IN ('impression', 'click')),
  -- Which part of the banner was clicked; NULL for impressions.
  element    TEXT CHECK (element IN ('button', 'title', 'subtitle', 'badge', 'image', 'icons', 'logo')),
  platform   TEXT CHECK (platform IN ('android', 'ios', 'web')),
  viewport   INT,      -- CSS px width, for "which screen sizes see this"
  session_id TEXT,     -- opaque; dedupes impressions, never identifies a person
  user_id    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS banner_events_banner_time_idx ON public.banner_events (banner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS banner_events_time_idx        ON public.banner_events (created_at DESC);

ALTER TABLE public.banner_events ENABLE ROW LEVEL SECURITY;

-- Visitors (including logged-out ones) generate the events, so INSERT is open;
-- the FK keeps rows tied to a real banner. Reading is admin-only — these are
-- business metrics, not public data.
DROP POLICY IF EXISTS "banner_events_insert_any" ON public.banner_events;
CREATE POLICY "banner_events_insert_any" ON public.banner_events
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "banner_events_select_admin" ON public.banner_events;
CREATE POLICY "banner_events_select_admin" ON public.banner_events
  FOR SELECT USING (public.is_admin(auth.uid()));

-- ── Aggregate for the dashboard ────────────────────────────────────────────
-- One round trip returns every panel's data, already aggregated, so the
-- browser never pulls raw event rows.
CREATE OR REPLACE FUNCTION public.banner_analytics(p_days INT DEFAULT 30)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
DECLARE
  days     INT := greatest(1, least(coalesce(p_days, 30), 365));
  since    TIMESTAMPTZ := now() - (days || ' days')::interval;
  prev     TIMESTAMPTZ := now() - (days * 2 || ' days')::interval;
  result   JSONB;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'NOT_ADMIN'; END IF;

  SELECT jsonb_build_object(
    'days', days,
    -- Current period vs the period immediately before it.
    'totals', (
      SELECT jsonb_build_object(
        'impressions', count(*) FILTER (WHERE kind = 'impression'),
        'clicks',      count(*) FILTER (WHERE kind = 'click')
      ) FROM public.banner_events WHERE created_at >= since
    ),
    'previous', (
      SELECT jsonb_build_object(
        'impressions', count(*) FILTER (WHERE kind = 'impression'),
        'clicks',      count(*) FILTER (WHERE kind = 'click')
      ) FROM public.banner_events WHERE created_at >= prev AND created_at < since
    ),
    -- Daily series for the chart.
    'series', coalesce((
      SELECT jsonb_agg(row_to_json(d) ORDER BY d.day)
      FROM (
        SELECT date_trunc('day', created_at)::date AS day,
               count(*) FILTER (WHERE kind = 'impression') AS impressions,
               count(*) FILTER (WHERE kind = 'click')      AS clicks
        FROM public.banner_events
        WHERE created_at >= since
        GROUP BY 1
      ) d
    ), '[]'::jsonb),
    -- Per-banner ranking.
    'banners', coalesce((
      SELECT jsonb_agg(row_to_json(b) ORDER BY b.impressions DESC)
      FROM (
        SELECT e.banner_id,
               coalesce(p.title, p.badge, '—') AS title,
               p.placement,
               p.image_url,
               count(*) FILTER (WHERE e.kind = 'impression') AS impressions,
               count(*) FILTER (WHERE e.kind = 'click')      AS clicks
        FROM public.banner_events e
        LEFT JOIN public.promo_banners p ON p.id = e.banner_id
        WHERE e.created_at >= since
        GROUP BY e.banner_id, p.title, p.badge, p.placement, p.image_url
      ) b
    ), '[]'::jsonb),
    -- Which part of the banner gets clicked (the "where do they tap" view).
    'elements', coalesce((
      SELECT jsonb_agg(row_to_json(x) ORDER BY x.clicks DESC)
      FROM (
        SELECT coalesce(element, 'image') AS element, count(*) AS clicks
        FROM public.banner_events
        WHERE kind = 'click' AND created_at >= since
        GROUP BY 1
      ) x
    ), '[]'::jsonb),
    -- Platform split.
    'platforms', coalesce((
      SELECT jsonb_agg(row_to_json(x) ORDER BY x.impressions DESC)
      FROM (
        SELECT coalesce(platform, 'web') AS platform,
               count(*) FILTER (WHERE kind = 'impression') AS impressions
        FROM public.banner_events
        WHERE created_at >= since
        GROUP BY 1
      ) x
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.banner_analytics(INT) TO authenticated;
