import { supabase } from './supabase';

// Supabase Storage for listing/profile images. Replaces the old base64-in-Postgres
// approach: uploads return a public https URL that is stored in the row instead of
// a multi-megabyte data URI. Smaller DB, faster loads, and — because the URL is
// publicly fetchable — real per-house preview images in WhatsApp/Facebook shares
// and the prerendered SEO pages (see vite.config.ts houseHead()).
export const IMAGES_BUCKET = 'listing-images';

const MAX_DIM = 1600;
const QUALITY = 0.8;

// Downscale + JPEG-compress in the browser before upload so we never push a
// full-resolution phone photo (5–10 MB) to storage.
function compressToBlob(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > height && width > MAX_DIM) { height = Math.round((height * MAX_DIM) / width); width = MAX_DIM; }
      else if (height >= width && height > MAX_DIM) { width = Math.round((width * MAX_DIM) / height); height = MAX_DIM; }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('no-canvas')); return; }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('compress-failed'))), 'image/jpeg', QUALITY);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image-load-failed')); };
    img.src = url;
  });
}

// Uploads one image and returns its public URL. Throws if the bucket is missing
// or the write is rejected — the caller (PhotoPickerButtons) falls back to a
// base64 data URL so image picking never hard-breaks during rollout.
export async function uploadImage(file: File, folder = 'listings'): Promise<string> {
  const blob = await compressToBlob(file);
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
