-- ─────────────────────────────────────────────────────────────────────────────
-- 0130 — drop the orphaned base64 keys out of houses.image_descriptions
--
-- image_descriptions is a JSONB map from an image to the owner's label for it
-- («🛌 غرف», «⛪ مباني»). The feature is LIVE and this migration does not touch
-- it: the owner still tags photos, and their gallery still captions them. The
-- column stays, and it stays in the public projection and in houses_list,
-- because the owner's gallery reads it from there.
--
-- What is wrong is only the DATA. The map was keyed by the image itself, and at
-- the time an image WAS a base64 data URI. Photos have since moved to Supabase
-- Storage, so houses.images now holds URLs — but the description map kept its
-- old base64 keys. Measured on production before writing this:
--
--     3 description keys · 0 match a current image URL · 452.1 KB
--     current images: ALL storage URLs · description keys: ALL orphaned base64
--
-- So every anonymous visitor browsing the site downloads 452 KB of image bytes
-- that cannot label anything — one key alone is 180 KB. The labels they carry
-- are six bytes each and are already unreachable: the gallery looks a caption up
-- by the image's URL, misses, and falls back to «صورة إضافية». Removing them
-- changes nothing anyone can see, and takes ~99% of the browse payload with it.
--
-- ── WHY THIS IS SAFE ────────────────────────────────────────────────────────
-- The statement does not decide what is orphaned from the outside. It keeps
-- exactly the keys that appear in that same row's own images array, and drops
-- the rest. A correctly-keyed description is therefore preserved BY
-- CONSTRUCTION — there is no input for which this deletes a label the gallery
-- could still display, including in rows that were not inspected.
--
-- The WHERE clause means a row with nothing orphaned is not written at all:
-- no dead UPDATE, no row version bump, and nothing for a trigger to react to.
-- Running it twice is a no-op.
--
-- New data cannot come back wrong: the owner's upload path already keys new
-- labels by the Storage URL it just uploaded to.
--
-- ── TRIGGERS ────────────────────────────────────────────────────────────────
-- Three triggers sit on public.houses and all three are inert here, verified
-- rather than assumed:
--
--   trg_protect_house_owner_updates  acts only when current_user =
--                                    'authenticated'. A migration is not.
--   trg_audit_house_status           doubly guarded — it needs status to change
--                                    AND an authenticated admin. Neither holds,
--                                    so this writes no audit rows.
--   trg_touch_house_policy (0128)    compares the five policy columns, finds
--                                    them unchanged, and hands back
--                                    OLD.policy_updated_at. The stamp survives.
--
-- No RLS change, no policy, no grant, no SECURITY DEFINER, no DDL. One UPDATE.
--
-- ORDER: after 0128 (whose trigger must exist for the behaviour above to be the
-- one that was tested) and after 0129. Nothing here depends on the 0129 view.
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE public.houses h
   SET image_descriptions = COALESCE((
         SELECT jsonb_object_agg(e.key, e.value)
           FROM jsonb_each(h.image_descriptions) AS e
          WHERE e.key = ANY (COALESCE(h.images, ARRAY[]::text[]))
       ), '{}'::jsonb)
 WHERE h.image_descriptions IS NOT NULL
   AND h.image_descriptions <> '{}'::jsonb
   AND EXISTS (
         SELECT 1 FROM jsonb_each(h.image_descriptions) AS e
          WHERE NOT (e.key = ANY (COALESCE(h.images, ARRAY[]::text[])))
       );

COMMENT ON COLUMN public.houses.image_descriptions IS
  'Owner-written label per photo, keyed by the image URL it describes. Read by '
  'the owner gallery (OwnerDashboardShell) — NOT dead, and deliberately still '
  'in HOUSE_PUBLIC_COLUMNS and houses_list, which is where that screen reads it '
  'from. Migration 0130 removed historical base64-keyed entries left behind when '
  'photos moved to Storage; keys must be Storage URLs, never data: URIs.';
