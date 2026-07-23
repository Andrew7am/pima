import { OutgoingAttachment } from './bookingMessages';

// Attachments are stored as data URLs in the message row (same approach the
// app already uses for house/room images), so images are downscaled + JPEG-
// compressed before encoding to keep the row — and the realtime payload —
// small. Non-image files are capped so we never push a huge blob into Postgres.
const MAX_IMAGE_DIMENSION = 1280;
const IMAGE_QUALITY = 0.72;
const MAX_FILE_BYTES = 3 * 1024 * 1024; // 3 MB for non-image files

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > height && width > MAX_IMAGE_DIMENSION) { height = Math.round((height * MAX_IMAGE_DIMENSION) / width); width = MAX_IMAGE_DIMENSION; }
      else if (height >= width && height > MAX_IMAGE_DIMENSION) { width = Math.round((width * MAX_IMAGE_DIMENSION) / height); height = MAX_IMAGE_DIMENSION; }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('no-canvas')); return; }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', IMAGE_QUALITY));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image-load-failed')); };
    img.src = url;
  });
}

// Returns a ready-to-send attachment, or throws a user-facing (Arabic) error.
export async function fileToAttachment(file: File): Promise<OutgoingAttachment> {
  if (file.type.startsWith('image/')) {
    const url = await compressImage(file);
    return { url, type: 'image', name: file.name };
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('حجم الملف كبير جدًا (الحد الأقصى 3 ميجا).');
  }
  const url = await readAsDataUrl(file);
  return { url, type: 'file', name: file.name };
}
