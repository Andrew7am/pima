import { supabase } from './supabase';
import { mapWithConcurrency, isOk } from './concurrency';

// Supabase Storage for listing/profile images. Replaces the old base64-in-Postgres
// approach: uploads return a public https URL that is stored in the row instead of
// a multi-megabyte data URI. Smaller DB, faster loads, and — because the URL is
// publicly fetchable — real per-house preview images in WhatsApp/Facebook shares
// and the prerendered SEO pages (see vite.config.ts houseHead()).
export const IMAGES_BUCKET = 'listing-images';

const MAX_DIM = 1600;
const QUALITY = 0.8;
// Banners are full-bleed hero artwork that also gets zoomed and cropped inside
// the designer, so they keep more pixels and less compression than a thumbnail.
const BANNER_MAX_DIM = 2200;
const BANNER_QUALITY = 0.88;

// Downscale + JPEG-compress in the browser before upload so we never push a
// full-resolution phone photo (5–10 MB) to storage.
function compressToBlob(file: File, maxDim = MAX_DIM, quality = QUALITY): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > height && width > maxDim) { height = Math.round((height * maxDim) / width); width = maxDim; }
      else if (height >= width && height > maxDim) { width = Math.round((width * maxDim) / height); height = maxDim; }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('no-canvas')); return; }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('compress-failed'))), 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image-load-failed')); };
    img.src = url;
  });
}

// Uploads one image and returns its public URL. Throws if the bucket is missing
// or the write is rejected — the caller (PhotoPickerButtons) falls back to a
// base64 data URL so image picking never hard-breaks during rollout.
export async function uploadImage(file: File, folder = 'listings'): Promise<string> {
  const isBanner = folder === 'banners';
  const blob = await compressToBlob(
    file,
    isBanner ? BANNER_MAX_DIM : MAX_DIM,
    isBanner ? BANNER_QUALITY : QUALITY,
  );
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id ?? 'anon';
  const rand = Math.random().toString(36).slice(2, 8);
  const key = `${folder}/${uid}/${Date.now()}-${rand}.jpg`;
  const { error } = await supabase.storage.from(IMAGES_BUCKET).upload(key, blob, {
    contentType: 'image/jpeg',
    cacheControl: '31536000', // 1 year — the key is unique per upload
    upsert: false,
  });
  if (error) throw error;
  return supabase.storage.from(IMAGES_BUCKET).getPublicUrl(key).data.publicUrl;
}

// How many uploads run at once. Four saturates a typical Egyptian mobile
// uplink without starving any single request; a hundred at once makes every
// one of them slow enough to look broken.
export const UPLOAD_CONCURRENCY = 4;

export interface BulkUploadResult {
  /** Public URLs, in the order the owner picked the files — the first image
   *  is the cover, so completion order must not be allowed to reshuffle them. */
  urls: string[];
  /** Names of the files that did not make it, for a message the owner can act
   *  on. Silently dropping seven of a hundred photos is worse than saying so. */
  failed: string[];
}

/**
 * Upload many images at once, a few at a time.
 *
 * Deliberately has NO base64 fallback, unlike the single-image path. That
 * fallback exists so one picked photo still works if Storage is unreachable,
 * and it inlines the image into the row. Doing that for a hundred photos would
 * put tens of megabytes of data URIs back into Postgres and ship them to every
 * visitor — precisely the egress problem migration 106 and the photo-migration
 * tool were written to undo. If Storage is down here, the honest outcome is to
 * report the failures.
 */
export async function uploadImages(
  files: readonly File[],
  folder = 'listings',
  onProgress?: (done: number, total: number) => void,
  uploader: (file: File, folder: string) => Promise<string> = uploadImage,
): Promise<BulkUploadResult> {
  const settled = await mapWithConcurrency(
    files,
    UPLOAD_CONCURRENCY,
    (file) => uploader(file, folder),
    onProgress,
  );

  const urls: string[] = [];
  const failed: string[] = [];
  for (let i = 0; i < settled.length; i++) {
    const r = settled[i];
    if (isOk(r)) {
      urls.push(r.value);
    } else {
      failed.push(files[i].name);
      console.warn('[storage] bulk upload failed for', files[i].name, r.error);
    }
  }
  return { urls, failed };
}
