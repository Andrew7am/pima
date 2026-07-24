import React, { useState } from 'react';
import { ChevronRight, ScrollText, Eye, Map, Shield, Search, Flame, BookOpen, Gamepad2, Brain, Grid3x3, Clock, ListOrdered, Puzzle } from 'lucide-react';
import { User } from '../types';
import MCQGame, { MCQQuestion } from './games/MCQGame';
import MemoryMatchGame from './games/MemoryMatchGame';
import WordSearchGame from './games/WordSearchGame';
import OrderingGame from './games/OrderingGame';
import CrosswordGame from './games/CrosswordGame';
import { BIBLICAL_EVENTS_SETS } from './entertainmentData';
import { BIBLE_ORDER_SETS } from './data/orderingCrosswordData';

type GameComp = React.ComponentType<{
  currentUser: User;
  onBack: () => void;
  onUserUpdated: (patch: Partial<User>) => void;
  onAchievementsUnlocked?: (ids: string[]) => void;
}>;

// Ordering games share one engine; thin wrappers plug in their data.
const EventsGame: GameComp = (p) => (
  <OrderingGame {...p} title="ترتيب الأحداث زمنياً" subtitle="رتّب الأحداث الكتابية من الأقدم للأحدث." sets={BIBLICAL_EVENTS_SETS} />
);
const BibleOrderGame: GameComp = (p) => (
  <OrderingGame {...p} title="ترتيب أحداث الكتاب المقدس" subtitle="رتّب أحداث الكتاب المقدس بالتسلسل الصحيح." sets={BIBLE_ORDER_SETS} />
);
import {
  PROVERBS_QUESTIONS,
  REVELATION_QUESTIONS,
  STPAUL_QUESTIONS,
  PROPHETS_QUESTIONS,
} from './entertainmentData';
import {
  CHAR_GUESS_QUESTIONS,
  VERSE_TEST_QUESTIONS,
  INTERPRET_CHALLENGE_QUESTIONS,
} from './data/themedQuestions';

interface GamesCatalogProps {
  currentUser: User;
  onBack: () => void;
  onUserUpdated: (patch: Partial<User>) => void;
  onAchievementsUnlocked?: (ids: string[]) => void;
}

interface CatalogGame {
  id: string;
  title: string;
  badge: string;
  desc: string;
  icon: React.ReactNode;
  gradient: string;      // full static classes (Tailwind can't see dynamic names)
  borderHover: string;
  badgeCls: string;
  chevronHover: string;
  pool?: MCQQuestion[];  // set for MCQ games
  Comp?: GameComp;       // set for special-mechanic games (memory, word search)
}

// The extra biblical MCQ games. Data comes from the ported question sets;
// each launches the shared MCQGame engine.
const GAMES: CatalogGame[] = [
  {
    id: 'proverbs',
    title: 'أمثال وحكم سليمان',
    badge: '📜 حكمة',
    desc: 'أسئلة من سفر الأمثال وحكم سليمان الحكيم.',
    icon: <ScrollText className="w-7 h-7 text-white" />,
    gradient: 'from-amber-500 to-orange-600',
    borderHover: 'hover:border-amber-500/40',
    badgeCls: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    chevronHover: 'group-hover:text-amber-400',
    pool: PROVERBS_QUESTIONS,
  },
  {
    id: 'revelation',
    title: 'سفر الرؤيا والرموز',
    badge: '👁️ نبوة',
    desc: 'تحدي سفر الرؤيا ورموزه النبوية العميقة.',
    icon: <Eye className="w-7 h-7 text-white" />,
    gradient: 'from-violet-500 to-purple-700',
    borderHover: 'hover:border-violet-500/40',
    badgeCls: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
    chevronHover: 'group-hover:text-violet-400',
    pool: REVELATION_QUESTIONS,
  },
  {
    id: 'stpaul',
    title: 'رحلات بولس الرسول',
    badge: '🗺️ رحلات',
    desc: 'مسابقة عن رحلات ورسائل معلّم المسكونة.',
    icon: <Map className="w-7 h-7 text-white" />,
    gradient: 'from-sky-500 to-blue-700',
    borderHover: 'hover:border-sky-500/40',
    badgeCls: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    chevronHover: 'group-hover:text-sky-400',
    pool: STPAUL_QUESTIONS,
  },
  {
    id: 'prophets',
    title: 'قصص ومعجزات الأنبياء',
    badge: '🛡️ أنبياء',
    desc: 'تحدي قصص الأنبياء ومعجزاتهم في العهد القديم.',
    icon: <Shield className="w-7 h-7 text-white" />,
    gradient: 'from-emerald-500 to-teal-700',
    borderHover: 'hover:border-emerald-500/40',
    badgeCls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    chevronHover: 'group-hover:text-emerald-400',
    pool: PROPHETS_QUESTIONS,
  },
  {
    id: 'char_guess',
    title: 'خمّن الشخصية الكتابية',
    badge: '🔍 تخمين',
    desc: 'قرائن تكشف شخصية مقدسة — خمّنها من ثلاث إشارات.',
    icon: <Search className="w-7 h-7 text-white" />,
    gradient: 'from-rose-500 to-red-600',
    borderHover: 'hover:border-rose-500/40',
    badgeCls: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    chevronHover: 'group-hover:text-rose-400',
    pool: CHAR_GUESS_QUESTIONS,
  },
  {
    id: 'verse_test',
    title: 'اختبار الآيات المقدسة',
    badge: '🕯️ آيات',
    desc: 'أكمل الكلمة المفقودة من الآيات الشهيرة.',
    icon: <Flame className="w-7 h-7 text-white" />,
    gradient: 'from-amber-400 to-yellow-600',
    borderHover: 'hover:border-yellow-500/40',
    badgeCls: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
    chevronHover: 'group-hover:text-yellow-400',
    pool: VERSE_TEST_QUESTIONS,
  },
  {
    id: 'interpret_challenge',
    title: 'تحدي التفسير واللاهوت',
    badge: '📖 تفسير',
    desc: 'أسئلة أعمق في التفسير الروحي واللاهوت.',
    icon: <BookOpen className="w-7 h-7 text-white" />,
    gradient: 'from-indigo-500 to-blue-800',
    borderHover: 'hover:border-indigo-500/40',
    badgeCls: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
    chevronHover: 'group-hover:text-indigo-400',
    pool: INTERPRET_CHALLENGE_QUESTIONS,
  },
  {
    id: 'memory_match',
    title: 'تطابق الصور والرموز',
    badge: '🧠 ذاكرة',
    desc: 'اقلب البطاقات وطابق كل رمز كنسي مع قرينه.',
    icon: <Brain className="w-7 h-7 text-white" />,
    gradient: 'from-fuchsia-500 to-pink-600',
    borderHover: 'hover:border-fuchsia-500/40',
    badgeCls: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30',
    chevronHover: 'group-hover:text-fuchsia-400',
    Comp: MemoryMatchGame,
  },
  {
    id: 'wordsearch',
    title: 'البحث عن الكلمة الكنسية',
    badge: '🔍 لغز',
    desc: 'ابحث عن الأسماء الكتابية المخفية داخل الشبكة.',
    icon: <Grid3x3 className="w-7 h-7 text-white" />,
    gradient: 'from-lime-500 to-green-600',
    borderHover: 'hover:border-lime-500/40',
    badgeCls: 'bg-lime-500/15 text-lime-300 border-lime-500/30',
    chevronHover: 'group-hover:text-lime-400',
    Comp: WordSearchGame,
  },
  {
    id: 'events',
    title: 'ترتيب الأحداث زمنياً',
    badge: '⏳ ترتيب',
    desc: 'رتّب الأحداث الكتابية الكبرى من الأقدم للأحدث.',
    icon: <Clock className="w-7 h-7 text-white" />,
    gradient: 'from-cyan-500 to-blue-600',
    borderHover: 'hover:border-cyan-500/40',
    badgeCls: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    chevronHover: 'group-hover:text-cyan-400',
    Comp: EventsGame,
  },
  {
    id: 'bible_order',
    title: 'ترتيب أحداث الكتاب المقدس',
    badge: '📖 تسلسل',
    desc: 'رتّب أحداث الكتاب المقدس بالتسلسل الصحيح.',
    icon: <ListOrdered className="w-7 h-7 text-white" />,
    gradient: 'from-orange-500 to-amber-600',
    borderHover: 'hover:border-orange-500/40',
    badgeCls: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
    chevronHover: 'group-hover:text-orange-400',
    Comp: BibleOrderGame,
  },
  {
    id: 'crossword',
    title: 'الكلمات المتقاطعة الكنسية',
    badge: '🧩 ألغاز',
    desc: 'حل التلميحات الكتابية واكتب الإجابات الصحيحة.',
    icon: <Puzzle className="w-7 h-7 text-white" />,
    gradient: 'from-purple-500 to-fuchsia-700',
    borderHover: 'hover:border-purple-500/40',
    badgeCls: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    chevronHover: 'group-hover:text-purple-400',
    Comp: CrosswordGame,
  },
];

export default function GamesCatalog({ currentUser, onBack, onUserUpdated, onAchievementsUnlocked }: GamesCatalogProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = GAMES.find((g) => g.id === activeId) || null;

  if (active) {
    if (active.Comp) {
      const Comp = active.Comp;
      return (
        <Comp
          currentUser={currentUser}
          onBack={() => setActiveId(null)}
          onUserUpdated={onUserUpdated}
          onAchievementsUnlocked={onAchievementsUnlocked}
        />
      );
    }
    return (
      <MCQGame
        currentUser={currentUser}
        onBack={() => setActiveId(null)}
        onUserUpdated={onUserUpdated}
        onAchievementsUnlocked={onAchievementsUnlocked}
        title={active.title}
        icon={active.icon}
        pool={active.pool || []}
        rewardDescription={(s, t) => `${active.title} — ${s}/${t} إجابات صحيحة`}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0A1428] via-[#0E1A33] to-[#08101F] text-slate-100 -mx-4 -my-6 sm:mx-0 sm:my-0 sm:rounded-3xl overflow-hidden" dir="rtl">
      <div className="max-w-4xl mx-auto px-4 pt-5 pb-10">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-slate-200 transition-colors mb-4"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>
          <span>رجوع</span>
        </button>

        <div className="flex items-center gap-3 mb-1">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md shrink-0">
            <Gamepad2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-black text-white">مركز الألعاب الكتابية</h2>
            <p className="text-[11px] text-slate-400">تحديات كتابية متنوعة — اختبر معلوماتك واكسب نقاط الخبرة.</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 mt-5">
          {GAMES.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setActiveId(g.id)}
              className={`w-full text-right bg-gradient-to-br from-[#152A55] to-[#0D1B3B] border border-white/10 ${g.borderHover} rounded-3xl p-4 flex items-center gap-4 shadow-lg transition-all group cursor-pointer`}
            >
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${g.gradient} flex items-center justify-center shadow-md shrink-0 group-hover:scale-105 transition-transform`}>
                {g.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h4 className="text-sm font-black text-white">{g.title}</h4>
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${g.badgeCls}`}>{g.badge}</span>
                </div>
                <p className="text-[10.5px] text-slate-400 leading-relaxed">{g.desc}</p>
              </div>
              <ChevronRight className={`w-4 h-4 text-slate-500 ${g.chevronHover} transition-colors rotate-180 shrink-0`} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
