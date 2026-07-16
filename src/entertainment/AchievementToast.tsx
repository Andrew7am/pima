import React, { useEffect, useState } from 'react';
import { Zap, Coins } from 'lucide-react';
import { getAchievementDef } from './achievements';

interface AchievementToastProps {
  // Queue of newly-unlocked achievement ids, oldest first. The toast
  // shows one at a time and calls onShown to pop it off the queue —
  // App.tsx owns the queue so unlocks survive screen navigation.
  queue: string[];
  onShown: () => void;
}

// Fixed-position celebration banner. Lives at the App.tsx root (outside
// the screen switch) so an achievement unlocked mid-game keeps showing
// even if the player immediately navigates away from that game screen.
export default function AchievementToast({ queue, onShown }: AchievementToastProps) {
  const [visible, setVisible] = useState(false);
  const currentId = queue[0];
  const def = currentId ? getAchievementDef(currentId) : undefined;

  useEffect(() => {
    if (!def) return;
    setVisible(true);
    const showTimer = setTimeout(() => setVisible(false), 3600);
    const popTimer = setTimeout(() => onShown(), 4000);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(popTimer);
    };
  }, [currentId, def, onShown]);

  if (!def) return null;

  return (
    <div
      className={`fixed top-4 inset-x-0 z-[100] flex justify-center px-4 pointer-events-none transition-all duration-500 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
      }`}
    >
      <div
        dir="rtl"
        className="pointer-events-auto max-w-sm w-full bg-gradient-to-br from-[#1E3A20] via-[#173318] to-[#0F2410] border border-emerald-500/40 rounded-3xl p-4 shadow-2xl flex items-center gap-3"
      >
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-3xl shrink-0 shadow-lg">
          {def.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[9px] font-black text-emerald-300 uppercase tracking-wider">إنجاز جديد!</p>
          <h4 className="text-sm font-black text-white truncate">{def.title}</h4>
          <div className="flex items-center gap-3 mt-1">
            <span className="flex items-center gap-1 text-[9px] font-black text-emerald-300">
              <Zap className="w-3 h-3" />
              +{def.xpReward}
            </span>
            <span className="flex items-center gap-1 text-[9px] font-black text-amber-300">
              <Coins className="w-3 h-3" />
              +{def.coinsReward}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
