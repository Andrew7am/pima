import React from 'react';
import { User } from '../types';
import { ChevronRight, BookOpen, Zap, Coins, Trophy, Sparkles } from 'lucide-react';
import { xpToNext, xpProgressPct } from './progress';

interface EntertainmentHomeProps {
  currentUser: User;
  onBack: () => void;
  onOpenTrivia: () => void;
}

// Phase 1 entertainment hub — deliberately dark-themed so gameplay
// feels like a distinct immersive space, separate from the cream/gold
// booking-app shell. Shows the player their XP progress toward the
// next level, their loyalty-point balance, and a single card that
// launches the solo Trivia game. More game cards (Who Am I, Hymns,
// Fill Verse, Word Search, and online rooms) get added below this
// one in later phases.
export default function EntertainmentHome({ currentUser, onBack, onOpenTrivia }: EntertainmentHomeProps) {
  const level = currentUser.level ?? 1;
  const xp = currentUser.xp ?? 0;
  const coins = currentUser.gameCoins ?? 0;
  const needed = xpToNext(level);
  const pct = xpProgressPct(xp, level);

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
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-black tracking-wider text-slate-200">مركز الترفيه</span>
          </div>
          <div className="w-14" aria-hidden />
        </div>

        <div className="bg-gradient-to-br from-[#132247] to-[#0A1732] border border-white/10 rounded-3xl p-5 shadow-xl">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="min-w-0">
              <p className="text-[10px] text-slate-400 font-bold">مستواك الحالي</p>
              <h2 className="text-xl font-black text-white leading-tight truncate">{currentUser.name}</h2>
            </div>
            <div className="flex flex-col items-center bg-gradient-to-br from-amber-500 to-amber-700 text-white rounded-2xl px-4 py-2 shadow-lg shrink-0">
              <span className="text-[8px] font-black uppercase tracking-widest opacity-80">Level</span>
              <span className="text-2xl font-black leading-none">{level}</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mb-1.5">
              <span>{xp} / {needed} XP</span>
              <span>للوصول للمستوى {level + 1}</span>
            </div>
            <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
              <div
                className="h-full bg-gradient-to-l from-amber-400 to-amber-600 rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 mt-4">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-bold text-slate-400">إجمالي الخبرة</p>
                <p className="text-sm font-black text-white truncate">{xp} XP</p>
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-amber-500/15 border border-amber-400/30 flex items-center justify-center shrink-0">
                <Coins className="w-4 h-4 text-amber-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-bold text-slate-400">عملات اللعب</p>
                <p className="text-sm font-black text-white truncate">{coins.toLocaleString('ar-EG')}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Trophy className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-black text-slate-200">الألعاب المتاحة</h3>
          </div>

          <button
            type="button"
            onClick={onOpenTrivia}
            className="w-full text-right bg-gradient-to-br from-[#152A55] to-[#0D1B3B] border border-white/10 hover:border-amber-500/40 rounded-3xl p-4 flex items-center gap-4 shadow-lg transition-all group cursor-pointer"
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-md shrink-0 group-hover:scale-105 transition-transform">
              <BookOpen className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h4 className="text-sm font-black text-white">أسئلة كتابية</h4>
                <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  فردي
                </span>
              </div>
              <p className="text-[10.5px] text-slate-400 leading-relaxed">
                ٥ أسئلة سريعة من الكتاب المقدس والتراث الكنسي. اربح خبرة وعملات عن كل إجابة صحيحة.
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition-colors rotate-180 shrink-0" />
          </button>

          {/* Placeholders for the games we'll add in later phases */}
          <div className="bg-white/[0.02] border border-white/5 border-dashed rounded-3xl p-4 flex items-center gap-3 opacity-60">
            <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-slate-500" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400">ألعاب أخرى قريباً</p>
              <p className="text-[10px] text-slate-500">
                من أنا؟ • ألحان قبطية • أكمل الآية • مباريات مباشرة
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
