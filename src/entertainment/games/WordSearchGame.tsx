import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { RefreshCw, Trophy, Check } from 'lucide-react';
import { User } from '../../types';
import { awardGameReward, checkAchievements } from '../../lib/db';
import { WORD_SEARCH_GRID, WORD_SEARCH_ANSWERS } from '../entertainmentData';

interface Props {
  currentUser: User;
  onBack: () => void;
  onUserUpdated: (patch: Partial<User>) => void;
  onAchievementsUnlocked?: (ids: string[]) => void;
}

type Cell = { r: number; c: number };

export default function WordSearchGame({ currentUser, onBack, onUserUpdated, onAchievementsUnlocked }: Props) {
  const [selected, setSelected] = useState<Cell[]>([]);
  const [found, setFound] = useState<string[]>([]);
  const [msg, setMsg] = useState('');
  const [done, setDone] = useState(false);
  const [awarding, setAwarding] = useState(false);
  const [rewardApplied, setRewardApplied] = useState(false);

  const reset = () => {
    setSelected([]);
    setFound([]);
    setMsg('');
    setDone(false);
    setRewardApplied(false);
  };

  const handleCell = (r: number, c: number) => {
    if (done) return;
    const isSel = selected.some((s) => s.r === r && s.c === c);
    const next = isSel ? selected.filter((s) => !(s.r === r && s.c === c)) : [...selected, { r, c }];
    setSelected(next);

    const letters = next.map((s) => WORD_SEARCH_GRID[s.r][s.c]).join('');
    const reversed = letters.split('').reverse().join('');
    const match = WORD_SEARCH_ANSWERS.find((a) => (a.word === letters || a.word === reversed) && !found.includes(a.word));
    if (match) {
      const updated = [...found, match.word];
      setFound(updated);
      setSelected([]);
      setMsg(`🎉 ممتاز! وجدت كلمة "${match.word}"`);
      setTimeout(() => setMsg(''), 1800);
      if (updated.length === WORD_SEARCH_ANSWERS.length) setDone(true);
    }
  };

  useEffect(() => {
    if (!done || rewardApplied) return;
    setRewardApplied(true);
    confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
    setAwarding(true);
    (async () => {
      const result = await awardGameReward(60, 30, WORD_SEARCH_ANSWERS.length, 'البحث عن الكلمات الكنسية — وجدت كل الكلمات');
      if (result) onUserUpdated({ xp: result.xp, level: result.level, gameCoins: result.gameCoins });
      const unlocked = await checkAchievements();
      if (unlocked.length > 0) onAchievementsUnlocked?.(unlocked);
      setAwarding(false);
    })();
  }, [done, rewardApplied, onUserUpdated, onAchievementsUnlocked]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0A1428] via-[#0E1A33] to-[#08101F] text-slate-100 -mx-4 -my-6 sm:mx-0 sm:my-0 sm:rounded-3xl overflow-hidden" dir="rtl">
      <div className="max-w-lg mx-auto px-4 pt-5 pb-10">
        <div className="flex items-center justify-between mb-4">
          <button type="button" onClick={onBack} className="flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-slate-200 transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>
            <span>رجوع</span>
          </button>
          <span className="text-[11px] font-black text-slate-400">{found.length}/{WORD_SEARCH_ANSWERS.length} كلمات</span>
        </div>

        <div className="text-center mb-4">
          <h2 className="text-lg font-black text-white">لغز البحث عن الكلمة الكنسية 🔍</h2>
          <p className="text-[11px] text-slate-400">اضغط على الحروف بالترتيب لتكوين اسم كتابي.</p>
        </div>

        {msg && <div className="text-center text-[12px] font-black text-emerald-300 mb-2">{msg}</div>}

        {done ? (
          <div className="text-center bg-gradient-to-br from-[#152A55] to-[#0D1B3B] border border-emerald-500/30 rounded-3xl p-8 space-y-3">
            <Trophy className="w-12 h-12 text-amber-400 mx-auto" />
            <h3 className="text-lg font-black text-white">رائع! وجدت كل الكلمات 🎉</h3>
            <p className="text-[12px] text-slate-300">{awarding ? 'جارٍ احتساب المكافأة…' : 'تم إضافة نقاط الخبرة إلى حسابك.'}</p>
            <div className="flex gap-2 justify-center pt-2">
              <button type="button" onClick={reset} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-[12px] font-black rounded-xl flex items-center gap-1">
                <RefreshCw className="w-4 h-4" /> مرة أخرى
              </button>
              <button type="button" onClick={onBack} className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white text-[12px] font-black rounded-xl">رجوع</button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-6 gap-1.5 mb-4">
              {WORD_SEARCH_GRID.map((row, r) =>
                row.map((letter, c) => {
                  const isSel = selected.some((s) => s.r === r && s.c === c);
                  return (
                    <button
                      key={`${r}-${c}`}
                      type="button"
                      onClick={() => handleCell(r, c)}
                      className={`aspect-square rounded-xl flex items-center justify-center text-lg font-black transition-all ${
                        isSel
                          ? 'bg-amber-500 text-white border border-amber-300'
                          : 'bg-gradient-to-br from-[#152A55] to-[#0D1B3B] border border-white/10 hover:border-white/25 text-slate-200'
                      }`}
                    >
                      {letter}
                    </button>
                  );
                })
              )}
            </div>

            <div className="flex flex-wrap gap-2 justify-center">
              {WORD_SEARCH_ANSWERS.map((a) => {
                const isFound = found.includes(a.word);
                return (
                  <span
                    key={a.word}
                    className={`text-[11px] font-black px-3 py-1 rounded-full border flex items-center gap-1 ${
                      isFound ? `bg-gradient-to-r ${a.color} text-white border-transparent` : 'bg-white/5 text-slate-400 border-white/10'
                    }`}
                  >
                    {isFound && <Check className="w-3 h-3" />}
                    {a.word}
                  </span>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
