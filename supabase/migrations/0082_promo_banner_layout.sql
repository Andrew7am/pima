-- ============================================================
-- Promo banners: structured visual layout for the banner designer.
--
-- The banner is NEVER stored as a flattened image. `layout` holds the design
-- as editable JSON so every property can be changed again later:
--
--   {
--     "version": 1,
--     "image":   {"fit":"cover","scale":1.2,"x":-30,"y":18,"opacity":1},
--     "overlay": {"enabled":true,"opacity":0.45},
--     "elements":[
--       {"id":"title","type":"title","visible":true,"locked":false,
--        "x":6,"y":34,"width":70,"fontSize":18,"color":"#FFFFFF","align":"start"},
--       {"id":"cta","type":"button","visible":true,"locked":false,
--        "x":6,"y":70,"bg":"#5A5A40","color":"#FFFFFF","radius":12}
--     ]
--   }
--
-- Geometry is in PERCENT of the banner box (font sizes relative to a 360px
-- design width), so one layout stays correct at every screen size and the
-- mobile app's existing banner dimensions are preserved exactly.
--
-- Additive and nullable: rows without a layout keep rendering the original
-- fixed design. Writes remain admin-only under the policy from 076.
-- ============================================================

ALTER TABLE public.promo_banners
  ADD COLUMN IF NOT EXISTS layout JSONB;
