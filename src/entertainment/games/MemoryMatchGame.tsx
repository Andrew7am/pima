import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { RefreshCw, Trophy } from 'lucide-react';
import { User } from '../../types';
import { awardGameReward, checkAchievements } from '../../lib/db';

interface Props {
  currentUser: User;
  onBack: () => void;
  onUserUpdated: (patch: Partial<User>) => void;
  onAchievementsUnlocked?: (ids: string[]) => void;
}

// Coptic/biblical symbol pairs (ported from the source memory game).
const SYMBOLS = [
  { char: '🕊️', name: 'حمامة الروح القدس' },
  { char: '🕯️', name: 'شمعة الصلاة والخدمة' },
  { char: '⛪', name: 'بيت الله المقدس الكنيسة' },
  { char: '📜', name: 'الأسفار الإلهية والنبوات' },
  { char: '🙏', name: 'التضرع والصلوات المرفوعة' },
  { char: '👑', name: 'إكليل الفضيلة والمجد' },
  { char: '📖', name: 'الكتاب المقدس كلمة الحياة' },
  { char: '🍞', name: 'القربان وخبز البركة' },
];

interface Card {
  id: number;
  symbol: string;
  label: string;
  isFlipped: boolean;
  isMatched: boolean;
}

function buildDeck(): Card[] {
  const deck: Card[] = [];
  SYMBOLS.forEach((sym, idx) => {
    deck.push({ id: idx * 2, symbol: sym.char, label: sym.name, isFlipped: false, isMatched: false });
    deck.push({ id: idx * 2 + 1, symbol: sym.char, label: sym.name, isFlipped: false, isMatched: false });
  });
  return deck.sort(() => Math.random() - 0.5);
}

export default function MemoryMatchGame({ currentUser, onBack, onUserUpdated, onAchievementsUnlocked }: Props) {
  const [cards, setCards] = useState<Card[]>(buildDeck);
  const [selected, setSelected] = useState<number[]>([]);
  const [locked, setLocked] = useState(false);
  const [moves, setMoves] = useState(0);
  const [done, setDone] = useState(false);
  const [awarding, setAwarding] = useState(false);
  const [rewardApplied, setRewardApplied] = useState(false);

  const reset = () => {
    setCards(buildDeck());
    setSelected([]);
    setLocked(false);
    setMoves(0);
    setDone(false);
    setRewardApplied(false);
  };

  const handleClick = (id: number) => {
    if (locked || done) return;
    const card = cards.find((c) => c.id === id);
    if (!card || card.isFlipped || card.isMatched) return;

    const flipped = cards.map((c) => (c.id === id ? { ...c, isFlipped: true } : c));
    setCards(flipped);
    const nextSelected = [...selected, id];
    setSelected(nextSelected);

    if (nextSelected.length === 2) {
      setLocked(true);
      setMoves((m) => m + 1);
      const [a, b] = nextSelected;
      const ca = flipped.find((c) => c.id === a)!;
      const cb = flipped.find((c) => c.id === b)!;
      if (ca.symbol === cb.symbol) {
        setTimeout(() => {
          setCards((prev) => prev.map((c) => (c.id === a || c.id === b ? { ...c, isMatched: true } : c)));
          setSelected([]);
          setLocked(false);
        }, 350);
      } else {
        setTimeout(() => {
          setCards((prev) => prev.map((c) => (c.id === a || c.id === b ? { ...c, isFlipped: false } : c)));
          setSelected([]);
          setLocked(false);
        }, 800);
      }
    }
  };

  // Win detection + reward.
  useEffect(() => {
    if (done || cards.length === 0) return;
    if (cards.every((c) => c.isMatched)) {
      setDone(true);
      confetti({ particleCount: 140, spread: 80, origin: { y: 0.6 } });
      if (!rewardApplied) {
        setRewardApplied(true);
        setAwarding(true);
        (async () => {
          const result = await awardGameReward(80, 40, SYMBOLS.length, `تطابق الصور — أُنجزت في ${moves} محاولة`);
          if (result) onUserUpdated({ xp: result.xp, level: result.level, gameCoins: result.gameCoins });
          const unlocked = await checkAchievements();
          if (unlocked.length > 0) onAchievementsUnlocked?.(unlocked);
          setAwarding(false);
        })();
      }
    }
  }, [cards, done, rewardApplied, moves, onUserUpdated, onAchievementsUnlocked]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0A1428] via-[#0E1A33] to-[#08101F] text-slate-100 -mx-4 -my-6 sm:mx-0 sm:my-0 sm:rounded-3xl overflow-hidden" dir="rtl">
      <div className="max-w-lg mx-auto px-4 pt-5 pb-10">
        <div className="flex items-center justify-between mb-4">
          <button type="button" onClick={onBack} className="flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-slate-200 transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>
            <span>رجوع</span>
          </button>
          <span className="text-[11px] font-black text-slate-400">المحاولات: {moves}</span>
        </div>

        <div className="text-center mb-5">
          <h2 className="text-lg font-black text-white">تطابق الصور والرموز 🧠</h2>
          <p className="text-[11px] text-slate-400">اقلب البطاقات وطابق كل رمز مع قرينه.</p>
        </div>

        {done ? (
          <div className="text-center bg-gradient-to-br from-[#152A55] to-[#0D1B3B] border border-emerald-500/30 rounded-3xl p-8 space-y-3">
            <Trophy className="w-12 h-12 text-amber-400 mx-auto" />
            <h3 className="text-lg font-black text-white">أحسنت! أكملت التطابق 🎉</h3>
            <p className="text-[12px] text-slate-300">{awarding ? 'جارٍ احتساب المكافأة…' : 'تم إضافة نقاط الخبرة إلى حسابك.'}</p>
            <div className="flex gap-2 justify-center pt-2">
              <button type="button" onClick={reset} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-[12px] font-black rounded-xl flex items-center gap-1">
                <RefreshCw className="w-4 h-4" /> مرة أخرى
              </button>
              <button type="button" onClick={onBack} className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white text-[12px] font-black rounded-xl">رجوع</button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2.5">
            {cards.map((card) => {
              const revealed = card.isFlipped || card.isMatched;
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => handleClick(card.id)}
                  title={card.isMatched ? card.label : undefined}
                  className={`aspect-square rounded-2xl flex items-center justify-center text-2xl font-black transition-all ${
                    revealed
                      ? card.isMatched
                        ? 'bg-emerald-500/20 border border-emerald-400/50'
                        : 'bg-[#1B356A] border border-sky-400/40'
                      : 'bg-gradient-to-br from-[#152A55] to-[#0D1B3B] border border-white/10 hover:border-white/25'
                  }`}
                >
                  {revealed ? card.symbol : '✦'}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
