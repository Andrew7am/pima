-- 076_promo_banners.sql
-- Admin-managed promotional banners shown on the public browse page:
--   placement 'carousel'  -> top auto-rotating hero slides (one row per slide)
--   placement 'countdown' -> bottom limited-time offer (with an optional ends_at)
-- Mirrors platform_announcements: everyone reads (banners are public), only
-- admins write. Reuses is_admin().

CREATE TABLE IF NOT EXISTS public.promo_banners (
  id          TEXT PRIMARY KEY,
  placement   TEXT NOT NULL CHECK (placement IN ('carousel', 'countdown')),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  sort        INT NOT NULL DEFAULT 0,
  badge       TEXT,
  title       TEXT,
  subtitle    TEXT,
  cta_text    TEXT,
  image_url   TEXT,
  ends_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.promo_banners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "promo_banners_select_all" ON public.promo_banners;
CREATE POLICY "promo_banners_select_all" ON public.promo_banners
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "promo_banners_admin_write" ON public.promo_banners;
CREATE POLICY "promo_banners_admin_write" ON public.promo_banners
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
