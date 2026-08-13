-- ============================================================
-- Storage bucket for listing/profile images (base64 → Storage migration).
-- Public read so image URLs work in <img>, WhatsApp/Facebook link previews,
-- and the prerendered SEO pages. Only logged-in users can upload, and each
-- user can only modify/remove their own objects. Existing base64 images keep
-- working — the client renders any string, and new uploads become https URLs.
-- Idempotent: safe to run more than once.
-- ============================================================

-- 1) The bucket (public read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('listing-images', 'listing-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2) Anyone (incl. anon) can READ objects in this bucket
DROP POLICY IF EXISTS "listing_images_public_read" ON storage.objects;
CREATE POLICY "listing_images_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'listing-images');

-- 3) Logged-in users can UPLOAD
DROP POLICY IF EXISTS "listing_images_auth_insert" ON storage.objects;
CREATE POLICY "listing_images_auth_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'listing-images');

-- 4) Users can replace / delete ONLY their own uploads
DROP POLICY IF EXISTS "listing_images_auth_update" ON storage.objects;
CREATE POLICY "listing_images_auth_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'listing-images' AND owner = auth.uid());

DROP POLICY IF EXISTS "listing_images_auth_delete" ON storage.objects;
CREATE POLICY "listing_images_auth_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'listing-images' AND owner = auth.uid());
