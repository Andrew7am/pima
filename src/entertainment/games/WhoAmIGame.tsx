import React, { useState, useMemo } from 'react';
import { ChevronRight, Check, X as XIcon, Zap, Coins, RotateCcw, Home, HelpCircle, Sparkles } from 'lucide-react';
import { User } from '../../types';
import { RAW_CHARACTERS, RawCharacter } from '../data/whoAmIData';
import { RAW_CHARACTERS_NT } from '../data/whoAmIData_NT';
import { awardGameReward, checkAchievements } from '../../lib/db';

interface WhoAmIGameProps {
  currentUser: User;
  onBack: () => void;
  onUserUpdated: (patch: Partial<User>) => void;
  onAchievementsUnlocked?: (ids: string[]) => void;
}

const ROUND_SIZE = 5;
// Reward tuning is deliberately different from MCQ games — the twist
// here is that using fewer clues earns more XP/coins, so a perfect
// one-clue guess is worth ~4x a same-round MCQ correct answer.
const XP_BY_CLUES_USED = [20, 12, 6];       // 1 clue -> 20 XP, 2 -> 12, 3 -> 6
const COINS_BY_CLUES_USED = [6, 4, 2];       // 1 clue -> 6 coins, 2 -> 4, 3 -> 2
const XP_ON_WRONG = 2;                       // consolation for playing

function shuffle<T>(arr: T[]): T[] {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

interface RoundQuestion {
  answer: string;
  clues: string[];
  explanation: string;
  options: string[];   // 4 options — correct + 3 distractors
  correctIdx: number;
}

function buildRound(): RoundQuestion[] {
  const pool: RawCharacter[] = [...RAW_CHARACTERS, ...RAW_CHARACTERS_NT];
  const allNames = pool.map((c) => c.name);
  return shuffle(pool).slice(0, ROUND_SIZE).map((c) => {
    const distractors = shuffle(allNames.filter((n) => n !== c.name)).slice(0, 3);
    const options = shuffle([c.name, ...distractors]);
    return {
      answer: c.name,
      clues: c.clues.slice(0, 3),
      explanation: c.explanation,
      options,
      correctIdx: options.indexOf(c.name),
    };
  });
}

export default function WhoAmIGame({ currentUser, onBack, onUserUpdated, onAchievementsUnlocked }: WhoAmIGameProps) {
  const round = useMemo(buildRound, []);

  const [idx, setIdx] = useState(0);
  const [cluesShown, setCluesShown] = useState(1);
  const [selected, setSelected] = useState<number | null>(null);
  // Per-question tally of XP/coins earned, so the summary shows the
  // real total (which depends on how many clues each question used).
  const [totalXp, setTotalXp] = useState(0);
  const [totalCoins, setTotalCoins] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);
  const [awarding, setAwarding] = useState(false);
  const [rewardApplied, setRewardApplied] = useState(false);

  const q = round[idx];
  const answered = selected !== null;

  const revealNext = () => {
    if (cluesShown < q.clues.length) setCluesShown(cluesShown + 1);
  };

  const handleAnswer = (optIdx: number) => {
    if (answered) return;
    setSelected(optIdx);
    if (optIdx === q.correctIdx) {
      const cluesIdx = Math.min(cluesShown - 1, XP_BY_CLUES_USED.length - 1);
      setTotalXp((v) => v + XP_BY_CLUES_USED[cluesIdx]);
      setTotalCoins((v) => v + COINS_BY_CLUES_USED[cluesIdx]);
      setCorrectCount((v) => v + 1);
    } else {
      setTotalXp((v) => v + XP_ON_WRONG);
    }
  };

  const handleNext = async () => {
    if (idx < round.length - 1) {
      setIdx(idx + 1);
      setCluesShown(1);
      setSelected(null);
      return;
    }
    if (!rewardApplied) {
      setAwarding(true);
      const result = await awardGameReward(
        totalXp,
        totalCoins,
        correctCount,
        `من أنا؟ — ${correctCount}/${round.length} إجابات صحيحة`,
      );
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
    const pct = Math.round((correctCount / round.length) * 100);
    const message =
      pct === 100 ? 'ممتاز! خبير حقيقي 🌟' :
      pct >= 60 ? 'أداء ممتاز 💪' :
      pct >= 40 ? 'محاولة جيدة 📖' :
      'لا بأس، جرب مرة أخرى 🙏';

    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0A1428] via-[#0E1A33] to-[#08101F] text-slate-100 -mx-4 -my-6 sm:mx-0 sm:my-0 sm:rounded-3xl overflow-hidden">
        <div className="max-w-lg mx-auto px-4 sm:px-6 py-8 space-y-5 text-center" dir="rtl">
          <div className="mx-auto w-24 h-24 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-2xl mb-2">
            <span className="text-4xl font-black text-white">{correctCount}/{round.length}</span>
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
  const cluesIdx = Math.min(cluesShown - 1, XP_BY_CLUES_USED.length - 1);
  const potentialXp = XP_BY_CLUES_USED[cluesIdx];
  const potentialCoins = COINS_BY_CLUES_USED[cluesIdx];

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
            <HelpCircle className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-black text-slate-200">من أنا؟</span>
          </div>
          <span className="text-[11px] font-black text-slate-400 tabular-nums">
            {idx + 1}<span className="text-slate-600"> / </span>{round.length}
          </span>
        </div>

        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-l from-amber-400 to-amber-600 rounded-full transition-all duration-300"
            style={{ width: `${((idx + (answered ? 1 : 0)) / round.length) * 100}%` }}
          />
        </div>

        {/* Potential reward — only shows while playing */}
        {!answered && (
          <div className="flex items-center justify-center gap-2 text-[10px] text-slate-400">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>الجائزة الحالية: +{potentialXp} خبرة، +{potentialCoins} عملات</span>
          </div>
        )}

        {/* Clues */}
        <div className="space-y-2">
          {q.clues.slice(0, cluesShown).map((clue, i) => (
            <div
              key={i}
              className="bg-gradient-to-br from-[#132247] to-[#0A1732] border border-white/10 rounded-2xl p-3.5 shadow-lg text-sm text-slate-100 font-bold leading-relaxed"
            >
              <span className="text-amber-400 font-black ml-2">تلميح {i + 1}:</span>
              {clue}
            </div>
          ))}
          {!answered && cluesShown < q.clues.length && (
            <button
              type="button"
              onClick={revealNext}
              className="w-full text-center text-[11px] font-bold text-amber-300 hover:text-amber-200 py-2 border border-dashed border-amber-500/30 rounded-2xl transition-colors"
            >
              كشف تلميح إضافي (تنخفض الجائزة)
            </button>
          )}
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
                className={`w-full text-right text-sm font-bold px-4 py-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${style} ${!answered ? 'cursor-pointer' : ''}`}
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
            {idx < round.length - 1 ? 'السؤال التالي' : (awarding ? 'جارٍ الحفظ...' : 'إنهاء الجولة')}
          </button>
        )}

      </div>
    </div>
  );
}
