import React, { useEffect, useState } from 'react';
import { User } from '../../types';
import { ChevronRight, Check, X as XIcon, Trophy, Users as UsersIcon, Zap, Coins, Loader2, Home, RotateCcw } from 'lucide-react';
import {
  GameRoom, loadRoom, subscribeToRoom, submitAnswer, finalizeMatch, FinalizeResult,
} from '../multiplayer';
import { getLeague } from '../leagues';
import { checkAchievements } from '../../lib/db';

interface LiveMatchGameProps {
  currentUser: User;
  roomId: string;
  onBack: () => void;
  onUserUpdated: (patch: Partial<User>) => void;
  onAchievementsUnlocked?: (ids: string[]) => void;
}

// Runs a 1v1 realtime match. Subscribes to the room row via
// Supabase Realtime; every state change (opponent joining, opponent
// answering, both answered → advance) flows through as an UPDATE.
export default function LiveMatchGame({ currentUser, roomId, onBack, onUserUpdated, onAchievementsUnlocked }: LiveMatchGameProps) {
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedOpt, setSelectedOpt] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<FinalizeResult | null>(null);
  const [finalizing, setFinalizing] = useState(false);

  // Initial fetch + realtime subscription
  useEffect(() => {
    let unsub: (() => void) | null = null;
    (async () => {
      const r = await loadRoom(roomId);
      if (r) setRoom(r);
      setLoading(false);
      unsub = subscribeToRoom(roomId, (updated) => {
        setRoom(updated);
        // selectedOpt gets reset by the separate effect below when
        // room.current_question moves, so nothing to do here.
      });
    })();
    return () => { if (unsub) unsub(); };
  }, [roomId]);

  // Reset selection whenever the room's current_question index changes
  useEffect(() => {
    setSelectedOpt(null);
  }, [room?.current_question]);

  // Trigger finalize automatically when both players finished all questions
  useEffect(() => {
    if (!room || outcome || finalizing) return;
    const total = room.questions.length;
    const hostDone = Object.keys(room.host_answers).length >= total;
    const guestDone = Object.keys(room.guest_answers).length >= total;
    if (hostDone && guestDone && room.status === 'active') {
      setFinalizing(true);
      finalizeMatch(roomId).then(async (result) => {
        setFinalizing(false);
        if (result) {
          setOutcome(result);
          // Push the fresh rating (+ level potentially) to parent so the
          // Entertainment hub reflects it without a page reload
          const isHost = currentUser.id === room.host_user_id;
          onUserUpdated({
            rating: isHost ? result.hostNewRating : result.guestNewRating,
          });
          const newlyUnlocked = await checkAchievements();
          if (newlyUnlocked.length > 0) onAchievementsUnlocked?.(newlyUnlocked);
        }
      });
    }
    // Also handle already-finished (idempotent finalize returns existing)
    if (room.status === 'finished' && !outcome) {
      setFinalizing(true);
      finalizeMatch(roomId).then((result) => {
        setFinalizing(false);
        if (result) setOutcome(result);
      });
    }
  }, [room, outcome, finalizing, roomId, currentUser.id, onUserUpdated, onAchievementsUnlocked]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0A1428] via-[#0E1A33] to-[#08101F] text-slate-100 flex items-center justify-center -mx-4 -my-6 sm:mx-0 sm:my-0 sm:rounded-3xl">
        <div className="flex items-center gap-3 text-slate-300">
          <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
          <span className="text-sm font-bold">جارٍ تحميل الغرفة...</span>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0A1428] via-[#0E1A33] to-[#08101F] text-slate-100 flex items-center justify-center -mx-4 -my-6 sm:mx-0 sm:my-0 sm:rounded-3xl">
        <div className="max-w-md text-center space-y-4 px-6" dir="rtl">
          <XIcon className="w-12 h-12 text-rose-400 mx-auto" />
          <h3 className="text-sm font-black text-white">الغرفة غير موجودة</h3>
          <p className="text-[11px] text-slate-400">قد تكون انتهت أو تم إلغاؤها.</p>
          <button
            type="button"
            onClick={onBack}
            className="w-full bg-amber-500 hover:bg-amber-400 text-white text-sm font-black py-2.5 rounded-2xl"
          >
            العودة
          </button>
        </div>
      </div>
    );
  }

  const isHost = currentUser.id === room.host_user_id;
  const meName = isHost ? room.host_name : room.guest_name;
  const oppName = isHost ? room.guest_name : room.host_name;
  const meRating = isHost ? room.host_rating : room.guest_rating;
  const oppRating = isHost ? room.guest_rating : room.host_rating;
  const meScore = isHost ? room.host_score : room.guest_score;
  const oppScore = isHost ? room.guest_score : room.host_score;
  const myAnswers = isHost ? room.host_answers : room.guest_answers;
  const oppAnswers = isHost ? room.guest_answers : room.host_answers;

  // ── WAITING (room still not full) ─────────────────────────────
  if (room.status === 'waiting') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0A1428] via-[#0E1A33] to-[#08101F] text-slate-100 -mx-4 -my-6 sm:mx-0 sm:my-0 sm:rounded-3xl overflow-hidden">
        <div className="max-w-md mx-auto px-6 py-10 space-y-5 text-center" dir="rtl">
          <div className="mx-auto w-20 h-20 rounded-full bg-white/5 border-2 border-dashed border-amber-500/50 flex items-center justify-center">
            <UsersIcon className="w-10 h-10 text-amber-400" />
          </div>
          <h2 className="text-xl font-black text-white">في انتظار الخصم</h2>
          {room.is_private && (
            <div className="bg-white/5 border border-white/10 rounded-2xl py-4">
              <p className="text-[10px] text-slate-400 mb-1">كود الغرفة</p>
              <p className="text-3xl font-black text-amber-300 tracking-[0.4em] font-mono">{roomId}</p>
            </div>
          )}
          <p className="text-[11px] text-slate-400 leading-relaxed">
            هيبدأ اللعب تلقائياً بمجرد ما لاعب تاني يدخل.
          </p>
          <div className="flex justify-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" style={{ animationDelay: '300ms' }} />
          </div>
          <button
            type="button"
            onClick={onBack}
            className="text-[11px] text-slate-400 hover:text-slate-200 underline"
          >
            إلغاء الغرفة والخروج
          </button>
        </div>
      </div>
    );
  }

  // ── SUMMARY (finished + finalized) ────────────────────────────
  if (room.status === 'finished' && outcome) {
    const won = outcome.winnerUserId === currentUser.id;
    const draw = outcome.winnerUserId === null;
    const myChange = isHost ? outcome.hostRatingChange : outcome.guestRatingChange;
    const myNew = isHost ? outcome.hostNewRating : outcome.guestNewRating;
    const league = getLeague(myNew);

    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0A1428] via-[#0E1A33] to-[#08101F] text-slate-100 -mx-4 -my-6 sm:mx-0 sm:my-0 sm:rounded-3xl overflow-hidden">
        <div className="max-w-lg mx-auto px-4 sm:px-6 py-8 space-y-5 text-center" dir="rtl">
          <div className={`mx-auto w-24 h-24 rounded-full flex items-center justify-center shadow-2xl text-4xl ${
            won ? 'bg-gradient-to-br from-emerald-500 to-emerald-700'
                : draw ? 'bg-gradient-to-br from-slate-500 to-slate-700'
                       : 'bg-gradient-to-br from-rose-500 to-rose-700'
          }`}>
            {won ? '🏆' : draw ? '🤝' : '💔'}
          </div>
          <h2 className="text-2xl font-black text-white">
            {won ? 'مبروك، فوز 🌟' : draw ? 'تعادل!' : 'خسارة هذه المرة'}
          </h2>
          <p className="text-xs text-slate-400">
            نتيجتك: <span className="font-black text-white">{meScore}</span>
            <span className="mx-1">مقابل</span>
            <span className="font-black text-white">{oppScore}</span>
            {' — '}
            <span className="text-slate-500">{oppName}</span>
          </p>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className={`bg-white/5 border rounded-2xl p-4 flex flex-col items-center gap-1 ${
              myChange > 0 ? 'border-emerald-500/30' : myChange < 0 ? 'border-rose-500/30' : 'border-slate-500/30'
            }`}>
              <Trophy className="w-6 h-6 text-amber-400" />
              <span className="text-[10px] text-slate-400 font-bold">التقييم الجديد</span>
              <span className="text-xl font-black text-white">{myNew}</span>
              <span className={`text-[10px] font-black ${
                myChange > 0 ? 'text-emerald-400' : myChange < 0 ? 'text-rose-400' : 'text-slate-400'
              }`}>
                {myChange > 0 ? '+' : ''}{myChange}
              </span>
            </div>
            <div className={`bg-gradient-to-br ${league.gradient} rounded-2xl p-4 flex flex-col items-center gap-1`}>
              <span className="text-3xl">{league.badge}</span>
              <span className="text-[10px] text-white/80 font-bold">الدورية</span>
              <span className="text-sm font-black text-white">{league.name}</span>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-4">
            <button
              type="button"
              onClick={onBack}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-l from-amber-500 to-amber-700 hover:from-amber-400 hover:to-amber-600 text-white text-sm font-black py-3 rounded-2xl shadow-lg"
            >
              <RotateCcw className="w-4 h-4" />
              مباراة جديدة
            </button>
            <button
              type="button"
              onClick={onBack}
              className="w-full flex items-center justify-center gap-2 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-200 text-xs font-bold py-2.5 rounded-2xl"
            >
              <Home className="w-4 h-4" />
              العودة لمركز الترفيه
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (room.status === 'finished' && finalizing) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0A1428] via-[#0E1A33] to-[#08101F] text-slate-100 flex items-center justify-center -mx-4 -my-6 sm:mx-0 sm:my-0 sm:rounded-3xl">
        <div className="flex items-center gap-3 text-slate-300">
          <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
          <span className="text-sm font-bold">جارٍ حساب النتيجة...</span>
        </div>
      </div>
    );
  }

  // ── ACTIVE GAMEPLAY ───────────────────────────────────────────
  const qIdx = room.current_question;
  const q = room.questions[qIdx];
  const myAnswer: number | undefined = myAnswers[String(qIdx)];
  const oppAnswer: number | undefined = oppAnswers[String(qIdx)];
  const iAnswered = myAnswer !== undefined;
  const bothAnswered = iAnswered && oppAnswer !== undefined;
  const showFeedback = bothAnswered;

  const handleSelect = async (i: number) => {
    if (iAnswered || submitting) return;
    setSelectedOpt(i);
    setSubmitting(true);
    await submitAnswer(roomId, qIdx, i);
    setSubmitting(false);
    // Live state will flow in via the subscription
  };

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
          <span className="text-[11px] font-black text-slate-400 tabular-nums">
            {qIdx + 1}<span className="text-slate-600"> / </span>{room.questions.length}
          </span>
        </div>

        {/* Live scoreboard */}
        <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center bg-gradient-to-br from-[#132247] to-[#0A1732] border border-white/10 rounded-2xl p-3">
          <div className="text-center min-w-0">
            <p className="text-[10px] font-bold text-slate-400 truncate">{meName ?? 'أنت'}</p>
            <p className="text-2xl font-black text-emerald-400">{meScore}</p>
            <p className="text-[9px] text-slate-500">{meRating ?? 100} 🏆</p>
          </div>
          <div className="text-center">
            <p className="text-[11px] font-black text-slate-500">VS</p>
          </div>
          <div className="text-center min-w-0">
            <p className="text-[10px] font-bold text-slate-400 truncate">{oppName ?? 'الخصم'}</p>
            <p className="text-2xl font-black text-rose-400">{oppScore}</p>
            <p className="text-[9px] text-slate-500">{oppRating ?? 100} 🏆</p>
          </div>
        </div>

        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-l from-amber-400 to-amber-600 rounded-full transition-all duration-300"
            style={{ width: `${((qIdx) / room.questions.length) * 100}%` }}
          />
        </div>

        <div className="bg-gradient-to-br from-[#132247] to-[#0A1732] border border-white/10 rounded-3xl p-5 shadow-xl min-h-[110px] flex items-center">
          <p className="text-sm sm:text-base font-black text-white leading-relaxed">{q?.question}</p>
        </div>

        <div className="space-y-2.5">
          {q?.options.map((opt, i) => {
            const isCorrect = i === q.correctIdx;
            const isPicked = i === myAnswer;
            const isOppPicked = i === oppAnswer;
            let style = 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 text-slate-100';
            if (iAnswered && !showFeedback) {
              // I've answered but opponent hasn't yet — highlight only my pick
              if (isPicked) style = 'bg-amber-500/10 border-amber-500/40 text-amber-200';
              else style = 'bg-white/[0.03] border-white/5 text-slate-500';
            } else if (showFeedback) {
              if (isCorrect) style = 'bg-emerald-500/15 border-emerald-500/50 text-emerald-200';
              else if (isPicked) style = 'bg-rose-500/15 border-rose-500/50 text-rose-200';
              else style = 'bg-white/[0.03] border-white/5 text-slate-500';
            }
            const clickable = !iAnswered && !submitting;
            return (
              <button
                key={i}
                type="button"
                disabled={!clickable}
                onClick={() => handleSelect(i)}
                className={`w-full text-right text-sm font-bold px-4 py-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${style} ${clickable ? 'cursor-pointer' : ''}`}
              >
                <span className="flex-1 leading-relaxed">{opt}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {isOppPicked && showFeedback && (
                    <span className="text-[8px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/30 px-1.5 py-0.5 rounded">خصم</span>
                  )}
                  {showFeedback && isCorrect && <Check className="w-4 h-4 text-emerald-400" />}
                  {showFeedback && isPicked && !isCorrect && <XIcon className="w-4 h-4 text-rose-400" />}
                </div>
              </button>
            );
          })}
        </div>

        {iAnswered && !bothAnswered && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3 text-[11px] font-bold text-slate-400 text-center flex items-center justify-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
            في انتظار إجابة الخصم...
          </div>
        )}

        {showFeedback && q && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 text-[11.5px] text-slate-300 leading-relaxed">
            <span className="font-black text-amber-400">تفسير: </span>
            {q.explanation}
          </div>
        )}

      </div>
    </div>
  );
}
