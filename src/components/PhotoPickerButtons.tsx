import React from 'react';
import { Image as ImageIcon, Camera } from 'lucide-react';

interface PhotoPickerButtonsProps {
  idPrefix: string;
  onSelect: (dataUrl: string) => void;
  className?: string;
}

// Two explicit actions instead of a URL-paste field: pick an existing photo,
// or open the camera directly (via the `capture` attribute on the file input).
export default function PhotoPickerButtons({ idPrefix, onSelect, className = '' }: PhotoPickerButtonsProps) {
  const readFile = (file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => onSelect(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) readFile(file);
    e.target.value = '';
  };

  return (
    <div className={`flex gap-2 ${className}`}>
      <label
        htmlFor={`${idPrefix}-gallery`}
        className="flex-1 flex items-center justify-center gap-1.5 bg-white border border-[#D6D6C2] hover:bg-[#EBEBE0]/50 text-[#4A4A3A] text-[10px] font-bold py-2 rounded-xl cursor-pointer transition-colors"
      >
        <ImageIcon className="w-3.5 h-3.5" />
        <span>اختر صورة</span>
        <input id={`${idPrefix}-gallery`} type="file" accept="image/*" className="hidden" onChange={handleChange} />
      </label>
      <label
        htmlFor={`${idPrefix}-camera`}
        className="flex-1 flex items-center justify-center gap-1.5 bg-white border border-[#D6D6C2] hover:bg-[#EBEBE0]/50 text-[#4A4A3A] text-[10px] font-bold py-2 rounded-xl cursor-pointer transition-colors"
      >
        <Camera className="w-3.5 h-3.5" />
        <span>التقط بالكاميرا</span>
        <input id={`${idPrefix}-camera`} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleChange} />
      </label>
    </div>
  );
}
