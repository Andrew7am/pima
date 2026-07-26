-- ============================================================
-- Banners: who sees them, and split-testing.
--
-- audience   -> which visitors a banner is for. Empty object = everyone, so
--               every existing banner keeps showing to all users.
--                 {"roles":["servant"],"governorates":["أسيوط"],"booked":"yes"}
--               booked: 'any' (default) | 'yes' (has a booking) | 'no'
--
-- experiment -> banners sharing this key are variants of one test. Exactly one
--               variant is shown per visitor, chosen deterministically from
--               their session id, so the split is stable for that person and
--               the click-through numbers are comparable.
-- variant    -> the label shown in the analytics comparison ('أ', 'ب', …).
--
-- Additive and nullable; writes stay admin-only under the policy from 076.
-- ============================================================

ALTER TABLE public.promo_banners
  ADD COLUMN IF NOT EXISTS audience JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.promo_banners
  ADD COLUMN IF NOT EXISTS experiment TEXT;

ALTER TABLE public.promo_banners
  ADD COLUMN IF NOT EXISTS variant TEXT;
