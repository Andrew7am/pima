import React, { useState, useMemo } from 'react';
import { User } from '../../types';
import { ChevronRight, Check, X as XIcon, Zap, Coins, RotateCcw, Home } from 'lucide-react';
import { awardGameReward, checkAchievements } from '../../lib/db';

export interface MCQQuestion {
  question: string;
  options: string[];
  correctIdx: number;
  explanation: string;
}

interface MCQGameProps {
  currentUser: User;
  onBack: () => void;
  onUserUpdated: (patch: Partial<User>) => void;
  onAchievementsUnlocked?: (ids: string[]) => void;
  title: string;
  icon: React.ReactNode;
  pool: MCQQuestion[];
  questionsPerRound?: number;
  rewardDescription: (score: number, total: number) => string;
  // Reward tuning — same defaults as trivia, but games can override
  xpPerCorrect?: number;
  coinsPerCorrect?: number;
  xpPerWrong?: number;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Generic single-choice-question game shell. Shared by Trivia, Hymns
// and Fill Verse — same UX, different data source and title. Handles
// question flow, per-question feedback, and the summary/reward call
// through the shared awardGameReward RPC.
export default function MCQGame({
  currentUser,
  onBack,
  onUserUpdated,
  onAchievementsUnlocked,
  title,
  icon,
  pool,
  questionsPerRound = 5,
  rewardDescription,
  xpPerCorrect = 10,
  coinsPerCorrect = 3,
  xpPerWrong = 2,
}: MCQGameProps) {
  const questions = useMemo(() => shuffle(pool).slice(0, questionsPerRound), [pool, questionsPerRound]);

  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [awarding, setAwarding] = useState(false);
  const [rewardApplied, setRewardApplied] = useState(false);

  const q = questions[idx];
  const answered = selected !== null;

  const handleAnswer = (optIdx: number) => {
    if (answered) return;
    setSelected(optIdx);
    if (optIdx === q.correctIdx) setScore((s) => s + 1);
  };

  const handleNext = async () => {
    if (idx < questions.length - 1) {
      setIdx(idx + 1);
      setSelected(null);
      return;
    }
    if (!rewardApplied) {
      setAwarding(true);
      const wrong = questions.length - score;
      const totalXp = score * xpPerCorrect + wrong * xpPerWrong;
      const totalCoins = score * coinsPerCorrect;
      const result = await awardGameReward(totalXp, totalCoins, score, rewardDescription(score, questions.length));
      if (result) {
        onUserUpdated({ xp: result.xp, level: result.level, gameCoins: result.gameCoins });
      }
      const newlyUnlocked = await checkAchievements();
      if (newlyUnlocked.length > 0) onAchievementsUnlocked?.(newlyUnlocked);
      setAwarding(false);
      setRewardApplied(true);
    }
    setFinished(true);
  };

  // ── SUMMARY SCREEN ────────────────────────────────────────────
  if (finished) {
    const wrong = questions.length - score;
    const totalXp = score * xpPerCorrect + wrong * xpPerWrong;
    const totalCoins = score * coinsPerCorrect;
    const pct = Math.round((score / questions.length) * 100);
    const message =
      pct === 100 ? 'ممتاز! إجابات صحيحة كاملة 🌟' :
      pct >= 60 ? 'أداء رائع! استمر 💪' :
      pct >= 40 ? 'محاولة جيدة، تمرن أكتر 📖' :
      'لا بأس، جرب مرة أخرى 🙏';

    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0A1428] via-[#0E1A33] to-[#08101F] text-slate-100 -mx-4 -my-6 sm:mx-0 sm:my-0 sm:rounded-3xl overflow-hidden">
        <div className="max-w-lg mx-auto px-4 sm:px-6 py-8 space-y-5 text-center" dir="rtl">
          <div className="mx-auto w-24 h-24 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-2xl mb-2">
            <span className="text-4xl font-black text-white">{score}/{questions.length}</span>
          </div>
          <h2 className="text-2xl font-black text-white">{message}</h2>
          <p className="text-xs text-slate-400">أنهيت الجولة!</p>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="bg-white/5 border border-emerald-500/30 rounded-2xl p-4 flex flex-col items-center gap-1">
              <Zap className="w-6 h-6 text-emerald-400" />
              <span className="text-[10px] text-slate-400 font-bold">خبرة مكتسبة</span>
              <span className="text-xl font-black text-white">+{totalXp}</span>
            </div>
            <div className="bg-white/5 border border-amber-500/30 rounded-2xl p-4 flex flex-col items-center gap-1">
              <Coins className="w-6 h-6 text-amber-400" />
              <span className="text-[10px] text-slate-400 font-bold">عملات لعب</span>
              <span className="text-xl font-black text-white">+{totalCoins}</span>
            </div>
          </div>

          {awarding && (
            <p className="text-[11px] text-amber-300 pt-2">جارٍ حفظ التقدم...</p>
          )}

          <div className="flex flex-col gap-2 pt-4">
            <button
              type="button"
              onClick={onBack}
              disabled={awarding}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-l from-amber-500 to-amber-700 hover:from-amber-400 hover:to-amber-600 disabled:opacity-60 text-white text-sm font-black py-3 rounded-2xl shadow-lg transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              جولة جديدة
            </button>
            <button
              type="button"
              onClick={onBack}
              disabled={awarding}
              className="w-full flex items-center justify-center gap-2 bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-60 text-slate-200 text-xs font-bold py-2.5 rounded-2xl transition-colors"
            >
              <Home className="w-4 h-4" />
              العودة لمركز الترفيه
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── QUESTION SCREEN ───────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0A1428] via-[#0E1A33] to-[#08101F] text-slate-100 -mx-4 -my-6 sm:mx-0 sm:my-0 sm:rounded-3xl overflow-hidden">
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-5 space-y-4" dir="rtl">

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
            <span>خروج</span>
          </button>
          <div className="flex items-center gap-1.5">
            <span className="text-amber-400">{icon}</span>
            <span className="text-xs font-black text-slate-200">{title}</span>
          </div>
          <span className="text-[11px] font-black text-slate-400 tabular-nums">
            {idx + 1}<span className="text-slate-600"> / </span>{questions.length}
          </span>
        </div>

        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-l from-amber-400 to-amber-600 rounded-full transition-all duration-300"
            style={{ width: `${((idx + (answered ? 1 : 0)) / questions.length) * 100}%` }}
          />
        </div>

        <div className="bg-gradient-to-br from-[#132247] to-[#0A1732] border border-white/10 rounded-3xl p-5 shadow-xl min-h-[110px] flex items-center">
          <p className="text-sm sm:text-base font-black text-white leading-relaxed">{q.question}</p>
        </div>

        <div className="space-y-2.5">
          {q.options.map((opt, i) => {
            const isCorrect = i === q.correctIdx;
            const isPicked = i === selected;
            let style = 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 text-slate-100';
            if (answered) {
              if (isCorrect) style = 'bg-emerald-500/15 border-emerald-500/50 text-emerald-200';
              else if (isPicked) style = 'bg-rose-500/15 border-rose-500/50 text-rose-200';
              else style = 'bg-white/[0.03] border-white/5 text-slate-500';
            }
            return (
              <button
                key={i}
                type="button"
                disabled={answered}
                onClick={() => handleAnswer(i)}
                className={`w-full text-right text-sm font-bold px-4 py-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${style} ${!answered ? 'cursor-pointer' : ''}`}
              >
                <span className="flex-1 leading-relaxed">{opt}</span>
                {answered && isCorrect && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                {answered && isPicked && !isCorrect && <XIcon className="w-4 h-4 text-rose-400 shrink-0" />}
              </button>
            );
          })}
        </div>

        {answered && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 text-[11.5px] text-slate-300 leading-relaxed">
            <span className="font-black text-amber-400">تفسير: </span>
            {q.explanation}
          </div>
        )}

        {answered && (
          <button
            type="button"
            onClick={handleNext}
            disabled={awarding}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-l from-amber-500 to-amber-700 hover:from-amber-400 hover:to-amber-600 disabled:opacity-60 text-white text-sm font-black py-3 rounded-2xl shadow-lg transition-colors"
          >
            {idx < questions.length - 1 ? 'السؤال التالي' : (awarding ? 'جارٍ الحفظ...' : 'إنهاء الجولة')}
          </button>
        )}

      </div>
    </div>
  );
}
