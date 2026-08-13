-- ============================================================
-- Promo banners: a CTA destination + a set of small icon links.
--
-- link_url  -> where the banner's call-to-action button goes. NULL keeps the
--              existing behaviour (the CTA just scrolls to the listings).
-- links     -> JSON array of icon links rendered inside the banner, e.g. the
--              platform's social accounts, so one banner can point at several
--              destinations:
--                [{"id":"l1","platform":"instagram","url":"https://..."}, ...]
--              platform is one of: instagram | facebook | youtube | whatsapp
--              | telegram | tiktok | x | website | phone | email
--
-- Additive only — existing rows keep working (link_url NULL, links []).
-- Writes stay admin-only via the promo_banners_admin_write policy (076).
-- ============================================================

ALTER TABLE public.promo_banners
  ADD COLUMN IF NOT EXISTS link_url TEXT;

ALTER TABLE public.promo_banners
  ADD COLUMN IF NOT EXISTS links JSONB NOT NULL DEFAULT '[]'::jsonb;
