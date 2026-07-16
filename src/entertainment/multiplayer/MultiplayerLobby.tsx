import React, { useState, useMemo } from 'react';
import { User } from '../../types';
import { ChevronRight, Trophy, Users, Zap, Search, KeyRound, Sparkles, X as XIcon, Copy, Check } from 'lucide-react';
import { getLeague } from '../leagues';
import {
  GameMode, RoomQuestion,
  createPrivateRoom, findOrCreateRandomRoom, joinRoomByCode,
} from '../multiplayer';
import { BASE_TRIVIA_QUESTIONS } from '../data/triviaData';
import { BASE_HYMN_QUESTIONS } from '../data/hymnsData';
import { RAW_VERSES } from '../data/versesData';
import { RAW_CHARACTERS } from '../data/whoAmIData';
import { RAW_CHARACTERS_NT } from '../data/whoAmIData_NT';

interface MultiplayerLobbyProps {
  currentUser: User;
  onBack: () => void;
  onEnterMatch: (roomId: string) => void;
}

const MATCH_LENGTH = 5;

function shuffle<T>(arr: T[]): T[] {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Build the same shape of question the solo games consume, so both
// sides render the same widget. correctIdx MUST be included — the
// server checks against it in submit_answer.
function buildQuestions(mode: GameMode): RoomQuestion[] {
  if (mode === 'trivia') {
    return shuffle(BASE_TRIVIA_QUESTIONS).slice(0, MATCH_LENGTH);
  }
  if (mode === 'hymns') {
    return shuffle(BASE_HYMN_QUESTIONS).slice(0, MATCH_LENGTH);
  }
  if (mode === 'fillverse') {
    const allWords = Array.from(new Set(RAW_VERSES.map((v) => v.word)));
    return shuffle(RAW_VERSES).slice(0, MATCH_LENGTH).map((v) => {
      const distractors = shuffle(allWords.filter((w) => w !== v.word)).slice(0, 3);
      const options = shuffle([v.word, ...distractors]);
      return {
        question: v.verse, options, correctIdx: options.indexOf(v.word),
        explanation: v.explanation,
      };
    });
  }
  // whoami — reuse OT+NT characters, first clue only in multiplayer (fair)
  const pool = [...RAW_CHARACTERS, ...RAW_CHARACTERS_NT];
  const names = pool.map((c) => c.name);
  return shuffle(pool).slice(0, MATCH_LENGTH).map((c) => {
    const distractors = shuffle(names.filter((n) => n !== c.name)).slice(0, 3);
    const options = shuffle([c.name, ...distractors]);
    return {
      question: c.clues[0], options, correctIdx: options.indexOf(c.name),
      explanation: c.explanation,
    };
  });
}

const GAME_MODES: { id: GameMode; label: string }[] = [
  { id: 'trivia',    label: 'أسئلة كتابية' },
  { id: 'hymns',     label: 'ألحان قبطية' },
  { id: 'fillverse', label: 'أكمل الآية' },
  { id: 'whoami',    label: 'من أنا؟' },
];

export default function MultiplayerLobby({ currentUser, onBack, onEnterMatch }: MultiplayerLobbyProps) {
  const rating = currentUser.rating ?? 100;
  const league = useMemo(() => getLeague(rating), [rating]);

  const [mode, setMode] = useState<GameMode>('trivia');
  const [action, setAction] = useState<null | 'creating' | 'joining' | 'searching'>(null);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const handleCreatePrivate = async () => {
    setAction('creating'); setError('');
    const questions = buildQuestions(mode);
    const code = await createPrivateRoom(mode, questions);
    if (!code) { setError('تعذر إنشاء الغرفة'); setAction(null); return; }
    setCreatedCode(code);
    setAction(null);
  };

  const handleJoinByCode = async () => {
    if (joinCode.trim().length !== 6) { setError('الكود لازم 6 حروف'); return; }
    setAction('joining'); setError('');
    const result = await joinRoomByCode(joinCode.trim().toUpperCase());
    if (!result.ok) {
      const map: Record<string, string> = {
        ROOM_NOT_FOUND: 'الغرفة غير موجودة',
        ROOM_UNAVAILABLE: 'الغرفة انتهت أو ملغاة',
        CANNOT_JOIN_OWN_ROOM: 'مش هتقدر تدخل غرفتك',
        ROOM_FULL: 'الغرفة ممتلئة',
      };
      const readable = Object.entries(map).find(([k]) => result.error?.includes(k))?.[1];
      setError(readable ?? 'تعذر الانضمام للغرفة');
      setAction(null);
      return;
    }
    onEnterMatch(result.roomId!);
  };

  const handleRandomMatch = async () => {
    setAction('searching'); setError('');
    const questions = buildQuestions(mode);
    const result = await findOrCreateRandomRoom(mode, questions);
    if (!result) { setError('تعذر البحث عن خصم'); setAction(null); return; }
    onEnterMatch(result.roomId);
  };

  const copyCode = async () => {
    if (!createdCode) return;
    try {
      await navigator.clipboard.writeText(createdCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — leave visual copy prompt */
    }
  };

  // ── PRIVATE ROOM WAITING MODAL ──────────────────────────────
  if (createdCode) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0A1428] via-[#0E1A33] to-[#08101F] text-slate-100 -mx-4 -my-6 sm:mx-0 sm:my-0 sm:rounded-3xl overflow-hidden">
        <div className="max-w-lg mx-auto px-4 sm:px-6 py-8 space-y-5 text-center" dir="rtl">
          <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-2xl">
            <KeyRound className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-xl font-black text-white">غرفتك جاهزة</h2>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            شارك الكود ده مع صاحبك عشان يدخل معاك.
            <br />
            الغرفة هتبدأ تلقائياً بمجرد ما ينضم.
          </p>

          <button
            type="button"
            onClick={copyCode}
            className="w-full bg-white/5 border-2 border-dashed border-amber-500/40 hover:border-amber-500/70 rounded-3xl py-6 flex flex-col items-center gap-2 transition-colors cursor-pointer"
          >
            <span className="text-[10px] text-slate-400 font-bold">كود الدعوة</span>
            <span className="text-4xl font-black text-amber-300 tracking-[0.4em] font-mono">{createdCode}</span>
            <span className="text-[10px] text-slate-400 flex items-center gap-1">
              {copied ? <><Check className="w-3 h-3 text-emerald-400" /> تم النسخ</> : <><Copy className="w-3 h-3" /> اضغط للنسخ</>}
            </span>
          </button>

          <p className="text-[10px] text-slate-500">في انتظار انضمام لاعب...</p>

          <div className="flex justify-center gap-1.5 pt-1">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" style={{ animationDelay: '300ms' }} />
          </div>

          <button
            type="button"
            onClick={() => onEnterMatch(createdCode)}
            className="w-full bg-white/5 border border-white/10 hover:bg-white/10 rounded-2xl py-2.5 text-[11px] font-bold text-slate-200 mt-4"
          >
            الانتقال لشاشة الانتظار المباشرة
          </button>
          <button
            type="button"
            onClick={() => { setCreatedCode(null); setAction(null); }}
            className="text-[10px] text-slate-400 hover:text-slate-200 underline"
          >
            إلغاء وعمل غرفة جديدة
          </button>
        </div>
      </div>
    );
  }

  // ── LOBBY ────────────────────────────────────────────────────
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
            <Users className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-black tracking-wider text-slate-200">المباريات المباشرة</span>
          </div>
          <div className="w-14" aria-hidden />
        </div>

        {/* Rating + league card */}
        <div className={`bg-gradient-to-br ${league.gradient} rounded-3xl p-5 shadow-2xl ${league.glow} border border-white/10`}>
          <div className="flex items-center gap-4">
            <div className="text-5xl drop-shadow-lg">{league.badge}</div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-white/80 font-black tracking-wider uppercase">دوريتك الحالية</p>
              <h2 className="text-2xl font-black text-white leading-tight">{league.name}</h2>
              <div className="flex items-center gap-1.5 mt-1">
                <Trophy className="w-3.5 h-3.5 text-white/90" />
                <span className="text-sm font-black text-white font-mono">{rating}</span>
                <span className="text-[10px] text-white/70">تقييم</span>
              </div>
            </div>
          </div>
        </div>

        {/* Mode picker */}
        <div>
          <div className="text-[10px] text-slate-400 font-bold mb-2 px-1">اختر لعبة المباراة:</div>
          <div className="grid grid-cols-4 gap-1.5">
            {GAME_MODES.map((m) => {
              const active = mode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id)}
                  disabled={action !== null}
                  className={`text-[10px] font-black py-2.5 px-1 rounded-xl border transition-colors ${
                    active
                      ? 'bg-amber-500/20 border-amber-500/60 text-amber-200'
                      : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-200 text-[11px] font-bold rounded-xl px-3 py-2.5 text-center flex items-center justify-center gap-2">
            <XIcon className="w-3.5 h-3.5" />
            {error}
          </div>
        )}

        {/* Random match */}
        <button
          type="button"
          disabled={action !== null}
          onClick={handleRandomMatch}
          className="w-full bg-gradient-to-l from-amber-500 to-amber-700 hover:from-amber-400 hover:to-amber-600 disabled:opacity-60 text-white rounded-3xl p-4 shadow-lg flex items-center gap-3 transition-colors cursor-pointer"
        >
          <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <Search className="w-5 h-5" />
          </div>
          <div className="flex-1 text-right">
            <div className="text-sm font-black">مباراة تنافسية</div>
            <div className="text-[10px] text-white/80">بحث عن خصم قريب من تقييمك</div>
          </div>
          {action === 'searching' && (
            <div className="w-4 h-4 border-2 border-white/70 border-t-transparent rounded-full animate-spin" />
          )}
        </button>

        {/* Private rooms */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            disabled={action !== null}
            onClick={handleCreatePrivate}
            className="bg-gradient-to-br from-[#152A55] to-[#0D1B3B] border border-white/10 hover:border-amber-500/40 disabled:opacity-60 rounded-3xl p-4 flex items-center gap-3 transition-colors cursor-pointer"
          >
            <div className="w-11 h-11 rounded-2xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center shrink-0">
              <KeyRound className="w-5 h-5 text-purple-300" />
            </div>
            <div className="flex-1 text-right">
              <div className="text-sm font-black text-white">غرفة خاصة</div>
              <div className="text-[10px] text-slate-400">تلعب مع صاحبك بكود</div>
            </div>
          </button>

          <div className="bg-gradient-to-br from-[#152A55] to-[#0D1B3B] border border-white/10 rounded-3xl p-4 space-y-2">
            <label className="flex items-center gap-2 text-[10px] text-slate-400 font-bold">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              الانضمام بكود
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                placeholder="ABC123"
                dir="ltr"
                className="flex-1 bg-white/5 border border-white/10 focus:border-amber-500/50 outline-none rounded-xl px-3 py-2 text-sm font-black text-white text-center tracking-[0.3em] font-mono"
              />
              <button
                type="button"
                disabled={action !== null || joinCode.length !== 6}
                onClick={handleJoinByCode}
                className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-black px-4 py-2 rounded-xl transition-colors"
              >
                دخول
              </button>
            </div>
          </div>
        </div>

        <div className="pt-2 flex items-center justify-center gap-2 text-[10px] text-slate-500">
          <Zap className="w-3 h-3" />
          <span>فوز: +25 تقييم | تعادل: 0 | خسارة: -15</span>
        </div>

      </div>
    </div>
  );
}
