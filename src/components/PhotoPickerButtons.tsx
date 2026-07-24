import React, { useState } from 'react';
import { Image as ImageIcon, Camera, Loader2 } from 'lucide-react';
import { uploadImage } from '../lib/storage';

interface PhotoPickerButtonsProps {
  idPrefix: string;
  onSelect: (url: string) => void;
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
export default function PhotoPickerButtons({ idPrefix, onSelect, className = '', folder = 'listings' }: PhotoPickerButtonsProps) {
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    setUploading(true);
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  return (
    <div className={`flex gap-2 ${className}`}>
      <label
        htmlFor={`${idPrefix}-gallery`}
        className={`flex-1 flex items-center justify-center gap-1.5 bg-white border border-[#D6D6C2] hover:bg-[#EBEBE0]/50 text-[#4A4A3A] text-[10px] font-bold py-2 rounded-xl transition-colors ${uploading ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
      >
        {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
        <span>{uploading ? 'جارٍ الرفع…' : 'اختر صورة'}</span>
        <input id={`${idPrefix}-gallery`} type="file" accept="image/*" className="hidden" disabled={uploading} onChange={handleChange} />
      </label>
      <label
        htmlFor={`${idPrefix}-camera`}
        className={`flex-1 flex items-center justify-center gap-1.5 bg-white border border-[#D6D6C2] hover:bg-[#EBEBE0]/50 text-[#4A4A3A] text-[10px] font-bold py-2 rounded-xl transition-colors ${uploading ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
      >
        {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
        <span>التقط بالكاميرا</span>
        <input id={`${idPrefix}-camera`} type="file" accept="image/*" capture="environment" className="hidden" disabled={uploading} onChange={handleChange} />
      </label>
    </div>
  );
}
