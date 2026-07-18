import React from 'react';
import { RefreshCw, X } from 'lucide-react';

interface UpdateBannerProps {
  onReload: () => void;
  onDismiss: () => void;
}

// Non-intrusive — a small dismissible bar, never a blocking alert() and
// never an automatic reload (which could wipe an in-progress form).
export default function UpdateBanner({ onReload, onDismiss }: UpdateBannerProps) {
  return (
    <div className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:left-4 sm:right-auto sm:max-w-sm z-[100] bg-[#2D2D24] text-white rounded-2xl shadow-xl p-3.5 flex items-center gap-3 animate-in slide-in-from-bottom-2 duration-300" dir="rtl">
      <RefreshCw className="w-4 h-4 text-amber-300 shrink-0" />
      <div className="flex-1 min-w-0 text-right">
        <div className="text-xs font-bold">في تحديث جديد للموقع</div>
        <div className="text-[10px] text-white/70 mt-0.5">حدّث الصفحة للحصول على آخر التحسينات.</div>
      </div>
      <button
        id="update-banner-reload-btn"
        type="button"
        onClick={onReload}
        className="bg-white text-[#2D2D24] text-[10px] font-bold px-3 py-1.5 rounded-xl shrink-0 cursor-pointer hover:bg-white/90"
      >
        تحديث الآن
      </button>
      <button
        id="update-banner-dismiss-btn"
        type="button"
        onClick={onDismiss}
        aria-label="إغلاق"
        className="text-white/50 hover:text-white shrink-0 cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
