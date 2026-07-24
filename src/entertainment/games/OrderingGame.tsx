import React, { useMemo, useState } from 'react';
import confetti from 'canvas-confetti';
import { ArrowUp, ArrowDown, Check, RefreshCw, Trophy, X } from 'lucide-react';
import { User } from '../../types';
import { awardGameReward, checkAchievements } from '../../lib/db';

interface OrderableItem { id: string; name: string; order: number; }

interface Props {
  currentUser: User;
  onBack: () => void;
  onUserUpdated: (patch: Partial<User>) => void;
  onAchievementsUnlocked?: (ids: string[]) => void;
  title: string;
  subtitle: string;
  sets: OrderableItem[][];
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Reorder-to-correct-sequence game. Shared by the "events" and "bible_order"
// solo games — the mechanic is identical, only the data differs.
export default function OrderingGame({ currentUser, onBack, onUserUpdated, onAchievementsUnlocked, title, subtitle, sets }: Props) {
  const [setIdx, setSetIdx] = useState(0);
  const source = sets[setIdx % sets.length];
  const [items, setItems] = useState<OrderableItem[]>(() => shuffle(source));
  const [checked, setChecked] = useState(false);
  const [awarding, setAwarding] = useState(false);

  const correct = useMemo(() => items.every((it, i) => it.order === i + 1), [items]);

  const move = (index: number, dir: -1 | 1) => {
    if (checked) return;
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const copy = items.slice();
    [copy[index], copy[target]] = [copy[target], copy[index]];
    setItems(copy);
  };

  const check = async () => {
    setChecked(true);
    if (correct) {
      confetti({ particleCount: 130, spread: 80, origin: { y: 0.6 } });
      setAwarding(true);
      const result = await awardGameReward(50, 25, items.length, `${title} — رتّبت الأحداث بشكل صحيح`);
      if (result) onUserUpdated({ xp: result.xp, level: result.level, gameCoins: result.gameCoins });
      const unlocked = await checkAchievements();
      if (unlocked.length > 0) onAchievementsUnlocked?.(unlocked);
      setAwarding(false);
    }
  };

  const next = () => {
    const ni = (setIdx + 1) % sets.length;
    setSetIdx(ni);
    setItems(shuffle(sets[ni]));
    setChecked(false);
  };

  const retry = () => {
    setItems(shuffle(source));
    setChecked(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0A1428] via-[#0E1A33] to-[#08101F] text-slate-100 -mx-4 -my-6 sm:mx-0 sm:my-0 sm:rounded-3xl overflow-hidden" dir="rtl">
      <div className="max-w-lg mx-auto px-4 pt-5 pb-10">
        <button type="button" onClick={onBack} className="flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-slate-200 transition-colors mb-4">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>
          <span>رجوع</span>
        </button>

        <div className="text-center mb-5">
          <h2 className="text-lg font-black text-white">{title}</h2>
          <p className="text-[11px] text-slate-400">{subtitle}</p>
        </div>

        <div className="space-y-2.5">
          {items.map((it, i) => {
            const rightSpot = checked && it.order === i + 1;
            const wrongSpot = checked && it.order !== i + 1;
            return (
              <div
                key={it.id}
                className={`flex items-center gap-3 rounded-2xl p-3 border transition-all ${
                  rightSpot ? 'bg-emerald-500/15 border-emerald-400/50' : wrongSpot ? 'bg-red-500/10 border-red-400/40' : 'bg-gradient-to-br from-[#152A55] to-[#0D1B3B] border-white/10'
                }`}
              >
                <span className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center text-[11px] font-black text-slate-300 shrink-0">{i + 1}</span>
                <p className="flex-1 text-[12.5px] font-bold text-slate-100 leading-snug">{it.name}</p>
                {checked ? (
                  rightSpot ? <Check className="w-4 h-4 text-emerald-400 shrink-0" /> : <X className="w-4 h-4 text-red-400 shrink-0" />
                ) : (
                  <div className="flex flex-col gap-1 shrink-0">
                    <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="w-6 h-6 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 flex items-center justify-center"><ArrowUp className="w-3.5 h-3.5" /></button>
                    <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} className="w-6 h-6 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 flex items-center justify-center"><ArrowDown className="w-3.5 h-3.5" /></button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-6">
          {!checked ? (
            <button type="button" onClick={check} className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white text-[13px] font-black rounded-2xl">تحقق من الترتيب</button>
          ) : correct ? (
            <div className="text-center space-y-3">
              <div className="flex items-center justify-center gap-2 text-emerald-300 font-black"><Trophy className="w-5 h-5" /> ترتيب صحيح! {awarding ? '(جارٍ احتساب المكافأة…)' : '+نقاط خبرة'}</div>
              <button type="button" onClick={next} className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white text-[13px] font-black rounded-2xl flex items-center justify-center gap-1"><RefreshCw className="w-4 h-4" /> مجموعة أخرى</button>
            </div>
          ) : (
            <div className="text-center space-y-3">
              <p className="text-red-300 font-black text-[13px]">ترتيب غير صحيح — حاول مرة أخرى.</p>
              <button type="button" onClick={retry} className="w-full py-3 bg-white/10 hover:bg-white/15 text-white text-[13px] font-black rounded-2xl">إعادة المحاولة</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
