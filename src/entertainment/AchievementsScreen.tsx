import React from 'react';
import { User } from '../types';
import { ChevronRight, Award, Zap, Coins, Check } from 'lucide-react';
import { ACHIEVEMENTS } from './achievements';

interface AchievementsScreenProps {
  currentUser: User;
  onBack: () => void;
}

// Read-only progress view over the achievement catalog. Unlock state
// comes straight from currentUser.unlockedAchievements (server-authoritative,
// written only by check_achievements() — see migration 037). This screen
// never grants anything, it just renders what the server already decided.
export default function AchievementsScreen({ currentUser, onBack }: AchievementsScreenProps) {
  const unlocked = new Set(currentUser.unlockedAchievements ?? []);
  const unlockedCount = ACHIEVEMENTS.filter((a) => unlocked.has(a.id)).length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0A1428] via-[#0E1A33] to-[#08101F] text-slate-100 -mx-4 -my-6 sm:mx-0 sm:my-0 sm:rounded-3xl overflow-hidden">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-5 space-y-5" dir="rtl">

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
            <span>رجوع</span>
          </button>
          <div className="flex items-center gap-1.5">
            <Award className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-black tracking-wider text-slate-200">الإنجازات والشارات</span>
          </div>
          <div className="w-14" aria-hidden />
        </div>

        <div className="bg-gradient-to-br from-[#132247] to-[#0A1732] border border-white/10 rounded-3xl p-5 shadow-xl flex items-center justify-between">
          <div>
            <p className="text-[10px] text-slate-400 font-bold mb-1">إنجازاتك المكتملة</p>
            <p className="text-2xl font-black text-white">
              {unlockedCount}<span className="text-slate-500 text-base"> / {ACHIEVEMENTS.length}</span>
            </p>
          </div>
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-lg text-3xl">
            🏅
          </div>
        </div>

        <div className="space-y-2.5">
          {ACHIEVEMENTS.map((a) => {
            const isUnlocked = unlocked.has(a.id);
            const progress = Math.min(a.getProgress(currentUser), a.target);
            const pct = Math.round((progress / a.target) * 100);

            return (
              <div
                key={a.id}
                className={`rounded-3xl p-4 flex items-center gap-4 border shadow-lg transition-all ${
                  isUnlocked
                    ? 'bg-gradient-to-br from-[#1E3A20] to-[#0F2410] border-emerald-500/40'
                    : 'bg-gradient-to-br from-[#152A55] to-[#0D1B3B] border-white/10'
                }`}
              >
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 text-2xl shadow-md ${
                    isUnlocked ? 'bg-gradient-to-br from-emerald-500 to-emerald-700' : 'bg-white/5 grayscale opacity-50'
                  }`}
                >
                  {a.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h4 className={`text-sm font-black ${isUnlocked ? 'text-white' : 'text-slate-300'}`}>{a.title}</h4>
                    {isUnlocked && (
                      <span className="flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        <Check className="w-2.5 h-2.5" />
                        مكتمل
                      </span>
                    )}
                  </div>
                  <p className="text-[10.5px] text-slate-400 leading-relaxed mb-2">{a.description}</p>

                  {!isUnlocked && (
                    <div className="space-y-1">
                      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                        <div
                          className="h-full bg-gradient-to-l from-amber-400 to-amber-600 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="text-[9px] text-slate-500 font-bold tabular-nums">{progress} / {a.target}</p>
                    </div>
                  )}

                  <div className="flex items-center gap-3 mt-2">
                    <span className="flex items-center gap-1 text-[9px] font-black text-emerald-400">
                      <Zap className="w-3 h-3" />
                      +{a.xpReward}
                    </span>
                    <span className="flex items-center gap-1 text-[9px] font-black text-amber-400">
                      <Coins className="w-3 h-3" />
                      +{a.coinsReward}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
