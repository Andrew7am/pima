import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { Check, Trophy, RefreshCw } from 'lucide-react';
import { User } from '../../types';
import { awardGameReward, checkAchievements } from '../../lib/db';
import { CROSSWORD_CLUES } from '../data/orderingCrosswordData';

interface Props {
  currentUser: User;
  onBack: () => void;
  onUserUpdated: (patch: Partial<User>) => void;
  onAchievementsUnlocked?: (ids: string[]) => void;
}

// Light Arabic normalization so answers match despite spaces/tatweel/hamza forms.
function norm(s: string): string {
  return s.replace(/ـ/g, '').replace(/[إأآا]/g, 'ا').replace(/ة/g, 'ه').replace(/\s+/g, '').trim();
}

export default function CrosswordGame({ currentUser, onBack, onUserUpdated, onAchievementsUnlocked }: Props) {
  const [answers, setAnswers] = useState<string[]>(CROSSWORD_CLUES.map(() => ''));
  const [checked, setChecked] = useState(false);
  const [awarding, setAwarding] = useState(false);

  const results = CROSSWORD_CLUES.map((c, i) => norm(answers[i]) === norm(c.answer));
  const allCorrect = results.every(Boolean);

  const check = async () => {
    setChecked(true);
    if (results.every(Boolean)) {
      confetti({ particleCount: 130, spread: 80, origin: { y: 0.6 } });
      setAwarding(true);
      const result = await awardGameReward(60, 30, CROSSWORD_CLUES.length, 'الكلمات المتقاطعة الكنسية — حللت كل الألغاز');
      if (result) onUserUpdated({ xp: result.xp, level: result.level, gameCoins: result.gameCoins });
      const unlocked = await checkAchievements();
      if (unlocked.length > 0) onAchievementsUnlocked?.(unlocked);
      setAwarding(false);
    }
  };

  const reset = () => {
    setAnswers(CROSSWORD_CLUES.map(() => ''));
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
          <h2 className="text-lg font-black text-white">الكلمات المتقاطعة الكنسية 🧩</h2>
          <p className="text-[11px] text-slate-400">اقرأ كل تلميح واكتب الإجابة الصحيحة.</p>
        </div>

        <div className="space-y-3">
          {CROSSWORD_CLUES.map((c, i) => {
            const ok = checked && results[i];
            const bad = checked && !results[i];
            return (
              <div key={i} className={`rounded-2xl p-3.5 border ${ok ? 'bg-emerald-500/15 border-emerald-400/50' : bad ? 'bg-red-500/10 border-red-400/40' : 'bg-gradient-to-br from-[#152A55] to-[#0D1B3B] border-white/10'}`}>
                <p className="text-[12px] font-bold text-slate-200 mb-2 leading-snug">{i + 1}. {c.clue}</p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={answers[i]}
                    onChange={(e) => { const a = answers.slice(); a[i] = e.target.value; setAnswers(a); }}
                    disabled={checked && results[i]}
                    placeholder="اكتب الإجابة…"
                    className="flex-1 bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-[13px] font-black text-white placeholder-slate-500 outline-none focus:border-amber-400/60"
                    dir="rtl"
                  />
                  {ok && <Check className="w-5 h-5 text-emerald-400 shrink-0" />}
                  {bad && <span className="text-[11px] font-black text-emerald-300 shrink-0">{c.answer}</span>}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6">
          {!allCorrect ? (
            <button type="button" onClick={check} className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white text-[13px] font-black rounded-2xl">تحقق من الإجابات</button>
          ) : (
            <div className="text-center space-y-3">
              <div className="flex items-center justify-center gap-2 text-emerald-300 font-black"><Trophy className="w-5 h-5" /> أحسنت! حللت كل الألغاز {awarding ? '(جارٍ احتساب المكافأة…)' : ''}</div>
              <button type="button" onClick={reset} className="w-full py-3 bg-white/10 hover:bg-white/15 text-white text-[13px] font-black rounded-2xl flex items-center justify-center gap-1"><RefreshCw className="w-4 h-4" /> من جديد</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
