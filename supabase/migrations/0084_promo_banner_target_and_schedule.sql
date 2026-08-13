-- ============================================================
-- Promo banners: an in-app destination + real publish scheduling.
--
-- linked_house_id -> the banner's CTA opens that house INSIDE the app instead
--                    of leaving for an external URL. This is what makes a
--                    banner a selling surface (and later gives click →
--                    booking attribution something to join on).
--
-- status / starts_at -> replaces "flip is_active by hand":
--   draft      never shows
--   published  shows now
--   scheduled  shows between starts_at and ends_at (ends_at already exists)
--
-- Backward compatible: existing rows default to 'published', and is_active
-- stays the manual off switch, so nothing changes for banners already live.
-- ============================================================

ALTER TABLE public.promo_banners
  ADD COLUMN IF NOT EXISTS linked_house_id TEXT REFERENCES public.houses(id) ON DELETE SET NULL;

ALTER TABLE public.promo_banners
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'published'
    CHECK (status IN ('draft', 'published', 'scheduled'));

ALTER TABLE public.promo_banners
  ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ;
