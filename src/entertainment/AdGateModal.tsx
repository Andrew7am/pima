import React, { useEffect, useState } from 'react';
import { X, Play } from 'lucide-react';

interface Props {
  open: boolean;
  title?: string;
  rewardLabel?: string;
  seconds?: number;
  onReward: () => void;
  onClose: () => void;
}

// Rewarded-ad gate: the user watches a short ad before the reward unlocks.
//
// IMPORTANT: this intentionally does NOT render a Google AdSense unit. AdSense
// strictly forbids incentivized/"watch-to-earn" ad views — doing so risks a
// permanent account ban. Rewarded ads are only allowed via AdMob (the native
// Android app) or AdSense-for-H5-Games. So on the website this shows a neutral
// sponsor placeholder + countdown; the real rewarded ad is wired through AdMob
// in the Capacitor build later. (Plain AdSense display ads live on the public
// content pages instead, which is policy-compliant.)
export default function AdGateModal({ open, title = 'شاهد الإعلان', rewardLabel = 'افتح المكافأة', seconds = 5, onReward, onClose }: Props) {
  const [left, setLeft] = useState(seconds);

  useEffect(() => {
    if (!open) return;
    setLeft(seconds);
    const t = setInterval(() => setLeft((v) => (v > 0 ? v - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [open, seconds]);

  if (!open) return null;
  const done = left <= 0;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4" dir="rtl">
      <div className="w-full max-w-sm bg-gradient-to-br from-[#152A55] to-[#0D1B3B] border border-white/10 rounded-3xl p-5 shadow-2xl text-slate-100">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-black text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full">إعلان برعاية</span>
          <button type="button" onClick={onClose} className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center" title="إغلاق">
            <X className="w-4 h-4" />
          </button>
        </div>

        <h3 className="text-sm font-black text-white text-center mb-3">{title}</h3>

        {/* Neutral sponsor placeholder — NOT AdSense (see note above). The real
            rewarded ad is served by AdMob inside the native app. */}
        <div className="rounded-2xl border border-white/10 bg-[#0A1428] overflow-hidden mb-4 min-h-[160px] flex items-center justify-center">
          <div className="text-center py-8 px-4">
            <Play className="w-10 h-10 text-slate-500 mx-auto mb-2" />
            <p className="text-[11px] text-slate-400 font-bold">مساحة إعلانية</p>
            <p className="text-[10px] text-slate-500 mt-1">شكراً لدعمك المنصة عبر مشاهدة الإعلان 🙏</p>
          </div>
        </div>

        <button
          type="button"
          disabled={!done}
          onClick={() => { onReward(); }}
          className={`w-full py-3 rounded-2xl text-[13px] font-black transition-all ${done ? 'bg-gradient-to-r from-amber-500 to-yellow-600 text-white hover:scale-[1.02]' : 'bg-slate-600 text-slate-300 cursor-not-allowed'}`}
        >
          {done ? `${rewardLabel} 🎁` : `انتظر ${left} ثانية…`}
        </button>
      </div>
    </div>
  );
}
