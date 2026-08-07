import React, { useState } from 'react';
import { Image as ImageIcon, Camera, Loader2, AlertTriangle } from 'lucide-react';
import { uploadImage, uploadImages } from '../lib/storage';
import { arabicNumber } from '../lib/arabic';

interface PhotoPickerButtonsProps {
  idPrefix: string;
  onSelect: (url: string) => void;
  /** Bulk sibling of onSelect, used only when `multiple` is on. Callers that
   *  attach one caption or category to a whole batch need the URLs together;
   *  callers that just append (the onboarding wizard) can leave this out and
   *  onSelect is called once per photo instead. */
  onSelectMany?: (urls: string[]) => void;
  /** Off by default so the avatar, promo banner and house cover — all of which
   *  are a single image by definition — keep behaving exactly as before. */
  multiple?: boolean;
  className?: string;
  folder?: string; // storage sub-folder, e.g. 'houses' | 'avatars'
}

// Reads a file as a base64 data URL — the fallback used only when the Storage
// upload fails (e.g. the bucket isn't created yet), so image picking never
// hard-breaks during the base64 → Storage rollout.
function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// Two explicit actions instead of a URL-paste field: pick an existing photo,
// or open the camera directly (via the `capture` attribute on the file input).
// Uploads to Supabase Storage and hands the caller a public https URL.
export default function PhotoPickerButtons({
  idPrefix, onSelect, onSelectMany, multiple = false, className = '', folder = 'listings',
}: PhotoPickerButtonsProps) {
  const [uploading, setUploading] = useState(false);
  // Progress is the whole point of the bulk path: a house owner uploading
  // eighty photos over mobile data stares at this for minutes, and a spinner
  // with no number is indistinguishable from a hang.
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [failedCount, setFailedCount] = useState(0);

  const handleFile = async (file: File) => {
    setUploading(true);
    setFailedCount(0);
    try {
      const url = await uploadImage(file, folder);
      onSelect(url);
    } catch (err) {
      // Bucket missing or upload rejected — keep the old behaviour so the
      // owner can still add photos, just stored inline until Storage is set up.
      console.warn('[storage] upload failed, falling back to inline image:', err);
      try { onSelect(await readAsDataUrl(file)); } catch { /* give up silently */ }
    } finally {
      setUploading(false);
    }
  };

  const handleFiles = async (files: File[]) => {
    setUploading(true);
    setFailedCount(0);
    setProgress({ done: 0, total: files.length });
    try {
      const { urls, failed } = await uploadImages(files, folder, (done, total) => setProgress({ done, total }));
      if (urls.length) {
        if (onSelectMany) onSelectMany(urls);
        else urls.forEach(onSelect);
      }
      setFailedCount(failed.length);
    } finally {
      setUploading(false);
      setProgress(null);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length) {
      if (multiple && files.length > 1) handleFiles(files);
      else handleFile(files[0]);
    }
    // Reset so picking the same file twice in a row still fires a change event.
    e.target.value = '';
  };

  const busyLabel = progress
    ? `جارٍ الرفع… ${arabicNumber(progress.done)} من ${arabicNumber(progress.total)}`
    : 'جارٍ الرفع…';
  const pickLabel = multiple ? 'اختر صور' : 'اختر صورة';
  const btn = (busy: boolean) =>
    `flex-1 flex items-center justify-center gap-1.5 bg-white border border-[#D6D6C2] hover:bg-[#EBEBE0]/50 text-[#4A4A3A] text-[11px] font-bold min-h-11 rounded-xl transition-colors ${busy ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`;

  return (
    <div className={className}>
      <div className="flex gap-2">
        <label htmlFor={`${idPrefix}-gallery`} className={btn(uploading)}>
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
          <span>{uploading ? busyLabel : pickLabel}</span>
          <input
            id={`${idPrefix}-gallery`}
            type="file"
            accept="image/*"
            multiple={multiple}
            className="hidden"
            disabled={uploading}
            onChange={handleChange}
          />
        </label>
        {/* The camera always takes one shot — `capture` and `multiple` do not
            combine into a burst, so this button stays single in both modes. */}
        <label htmlFor={`${idPrefix}-camera`} className={btn(uploading)}>
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
          <span>التقط بالكاميرا</span>
          <input id={`${idPrefix}-camera`} type="file" accept="image/*" capture="environment" className="hidden" disabled={uploading} onChange={handleChange} />
        </label>
      </div>

      {multiple && !uploading && failedCount > 0 && (
        // Named rather than swallowed: the owner needs to know some photos are
        // missing, or they will publish a listing they think is complete.
        <p className="flex items-center gap-1.5 mt-1.5 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-2 py-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          {arabicNumber(failedCount)} من الصور مرفعتش — جرّب ترفعها تاني.
        </p>
      )}
    </div>
  );
}
