import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { User } from '../../types';
import { ChevronRight, Check, X as XIcon, Trophy, Users as UsersIcon, Loader2, Home, RotateCcw, Copy, Lightbulb, UserPlus, Zap, Coins } from 'lucide-react';
import { type GameRoom, type FinalizeResult } from '../multiplayer';
import { practiceDriver, supabaseDriver, type MatchDriver } from './matchDriver';
import { getLeague, leagueProgress } from '../leagues';
import { checkAchievements } from '../../lib/db';
import RoomChat from './RoomChat';
import AssistBar, { AssistId } from './AssistBar';
import { type MatchRound, roundOfQuestion, startsRound, roundNumber, totalRounds } from './rounds';
import { markSeen } from '../questionHistory';
import { formatSeconds, statsForMatch, statsForRound, type AnswerRecord } from './matchStats';
import { sendFriendRequest } from '../social';

interface LiveMatchGameProps {
  currentUser: User;
  roomId: string;
  /** Play a bot locally instead of a real room. Nothing is at stake. */
  practice?: boolean;
  onBack: () => void;
  onUserUpdated: (patch: Partial<User>) => void;
  onAchievementsUnlocked?: (ids: string[]) => void;
}

/** Fallback clock. Each round carries its own — see rounds.ts — so Lightning
 *  is genuinely seven seconds and Golden gets time to think. This is only
 *  used before the room has loaded, and by rooms made before rounds existed. */
const QUESTION_SECONDS = 20;
/** How long a stage banner holds the screen, with the clock frozen. */
const STAGE_INTRO_MS = 2000;
/** finalizeMatch returns null on any failure; stop rather than spin. */
const MAX_FINALIZE_ATTEMPTS = 3;
const FINALIZE_BACKOFF_MS = 1500;
/** Mirrors _abandon_cutoff() in migration 099 — the server is authoritative. */
const ABANDON_SECONDS = 45;
/** How often to re-read the room while the realtime channel is down. */
const RECONNECT_POLL_MS = 5000;
/** Well inside 099's two-minute stale cutoff, so a beat can be missed. */
const WAITING_HEARTBEAT_MS = 30000;
/** How long the answered question stays up so the reveal can be read. */
const REVEAL_MS = 2500;

// Written out rather than interpolated — Tailwind only ships classes it can
// see as literals, so `bg-${accent}-500/15` would compile to nothing.
const STAGE_CHIP: Record<MatchRound['accent'], string> = {
  amber: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  emerald: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  sky: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  violet: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  rose: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  gold: 'bg-yellow-400/20 text-yellow-200 border-yellow-400/50',
};
const STAGE_PANEL: Record<MatchRound['accent'], string> = {
  amber: 'from-amber-500/20 to-amber-700/5 border-amber-500/40',
  emerald: 'from-emerald-500/20 to-emerald-700/5 border-emerald-500/40',
  sky: 'from-sky-500/20 to-sky-700/5 border-sky-500/40',
  violet: 'from-violet-500/20 to-violet-700/5 border-violet-500/40',
  rose: 'from-rose-500/20 to-rose-700/5 border-rose-500/40',
  gold: 'from-yellow-400/25 to-amber-600/10 border-yellow-400/60',
};

/** One number with its name under it, as used by the round summary. */
function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-black/20 rounded-xl py-2 px-1 text-center">
      <p className="text-sm font-black text-white tabular-nums leading-none">{value}</p>
      <p className="text-[8.5px] font-bold text-slate-400 mt-1">{label}</p>
    </div>
  );
}

// Web Vibration API only — no sound. See the port plan: the original
// prototype's sound effects were unlicensed third-party demo URLs, not
// real bundled assets, so only haptic + confetti were ported.
function triggerHaptic(type: 'light' | 'medium' | 'success' | 'error' | 'warning') {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  const patterns: Record<string, number | number[]> = {
    light: 12,
    medium: 25,
    success: [15, 60, 20],
    error: [40, 60, 40],
    warning: [30, 40, 30],
  };
  try { navigator.vibrate(patterns[type]); } catch { /* sandboxed iframe, ignore */ }
}

// Runs a 1v1 realtime match. Subscribes to the room row via
// Supabase Realtime; every state change (opponent joining, opponent
// answering, both answered → advance) flows through as an UPDATE.
export default function LiveMatchGame({ currentUser, roomId, practice = false, onBack, onUserUpdated, onAchievementsUnlocked }: LiveMatchGameProps) {
  // Memoised because the practice driver HOLDS the match — rebuilding it
  // mid-game would reset the board and the bot's timers.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const driver: MatchDriver = React.useMemo(
    () => (practice ? practiceDriver(currentUser) : supabaseDriver(roomId)),
    [practice, roomId],
  );
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [answerError, setAnswerError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<FinalizeResult | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [finalizeFailed, setFinalizeFailed] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  /** Realtime channel health — false means we are flying on polling alone. */
  const [live, setLive] = useState(true);

  // Assists — ported from the original prototype's SmartAssistBar. Pure
  // client-side state (the original never persisted assist usage to its
  // backend either): usedAssists is spent-per-MATCH, the rest reset
  // per-question below.
  const [usedAssists, setUsedAssists] = useState<AssistId[]>([]);
  const [removedOptions, setRemovedOptions] = useState<number[]>([]);
  const [hintRevealed, setHintRevealed] = useState(false);
  const [retryArmed, setRetryArmed] = useState(false);
  const [retryFlash, setRetryFlash] = useState(false);
  const [playTimer, setPlayTimer] = useState(QUESTION_SECONDS);
  const [showVsIntro, setShowVsIntro] = useState(false);
  const [stageIntro, setStageIntro] = useState<MatchRound | null>(null);

  // A SET of active freezes, not a boolean. Two things can hold the clock
  // at once — the stage banner and the extra_time assist — and with a
  // boolean whichever timeout fired first released it for both, so the
  // 20s clock ran underneath a banner that had removed the question, the
  // options and the assist bar from the screen. Each holder keeps its own
  // token and only ever releases that.
  const freezesRef = useRef<Set<number>>(new Set());
  const freezeSeqRef = useRef(0);
  const freezeClock = () => { const id = ++freezeSeqRef.current; freezesRef.current.add(id); return id; };
  const releaseClock = (id: number) => { freezesRef.current.delete(id); };
  const prevStatusRef = useRef<string | null>(null);
  const confettiFiredRef = useRef(false);
  const finalizeAttemptsRef = useRef(0);
  /** Every answer this player gave, for the between-round summary. */
  const answersRef = useRef<AnswerRecord[]>([]);
  /** When the displayed question appeared, so an answer can be timed. */
  const questionShownAtRef = useRef<number | null>(null);
  const handleSelectRef = useRef<(i: number) => void>(() => {});

  const isHost = room ? currentUser.id === room.host_user_id : false;
  const meName = room ? (isHost ? room.host_name : room.guest_name) : null;
  const oppName = room ? (isHost ? room.guest_name : room.host_name) : null;
  const meRating = room ? (isHost ? room.host_rating : room.guest_rating) : null;
  const oppRating = room ? (isHost ? room.guest_rating : room.host_rating) : null;
  const meScore = room ? (isHost ? room.host_score : room.guest_score) : 0;
  const oppScore = room ? (isHost ? room.guest_score : room.host_score) : 0;
  const myAnswers = room ? (isHost ? room.host_answers : room.guest_answers) : {};
  const oppAnswers = room ? (isHost ? room.guest_answers : room.host_answers) : {};
  // What the SERVER is on, versus what the player is looking at.
  //
  // submit_answer advances current_question inside the same call that records
  // the second player's answer, and this screen used to render straight off
  // that column — so the green tick, the red cross, the opponent's pick and
  // the «تفسير» panel were all built, all correct, and all on screen for a
  // few milliseconds before being replaced. In a scripture quiz that is the
  // entire point of the exercise, never once seen.
  //
  // The display now lags the server by a deliberate beat. It can only ever
  // trail, never lead, so a player still cannot see or answer a question the
  // server has not reached.
  const serverIdx = room?.current_question ?? 0;
  const [displayIdx, setDisplayIdx] = useState(0);
  const lastQuestionIdx = room ? Math.max(0, room.questions.length - 1) : 0;
  const qIdx = Math.min(displayIdx, lastQuestionIdx);
  const q = room?.questions?.[qIdx];
  const myAnswer: number | undefined = myAnswers[String(qIdx)];
  const oppAnswer: number | undefined = oppAnswers[String(qIdx)];
  const iAnswered = myAnswer !== undefined;
  const bothAnswered = iAnswered && oppAnswer !== undefined;
  const showFeedback = bothAnswered;

  // The round the DISPLAYED question belongs to, and therefore the clock,
  // the colour and the stakes. Read off the questions both players already
  // hold, so neither client has to be told and neither can disagree.
  const currentRound = room ? roundOfQuestion(room.questions, qIdx) : null;
  const questionSeconds = currentRound?.seconds ?? QUESTION_SECONDS;

  // The round that just ended, summarised for the transition banner. The
  // banner names the round ABOUT to start, so the stats have to come from
  // the question before the boundary, not from the current one.
  const lastRoundStats = React.useMemo(() => {
    if (!stageIntro || !room || qIdx === 0) return null;
    return statsForRound(answersRef.current, room.questions[qIdx - 1]?.stage);
  }, [stageIntro, room, qIdx]);
  const matchCombo = stageIntro ? statsForMatch(answersRef.current).combo : 0;

  const copyRoomCode = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 1500);
    } catch {
      /* clipboard unavailable — the code is already shown on screen */
    }
  };

  const handleSelect = async (i: number) => {
    if (!room || iAnswered || submitting) return;
    const isWrongPick = i !== -1 && q && i !== q.correctIdx;

    // Retry assist: catch one wrong pick per match locally, without
    // committing it to the server, so the player can try the same
    // question again with a fresh timer.
    if (isWrongPick && retryArmed) {
      setRetryArmed(false);
      if (i !== -1) setRemovedOptions((prev) => [...prev, i]);
      setPlayTimer(questionSeconds);
      setRetryFlash(true);
      triggerHaptic('warning');
      setTimeout(() => setRetryFlash(false), 2000);
      return;
    }

    setSubmitting(true);
    setAnswerError(null);
    const result = await driver.submitAnswer(qIdx, i);
    setSubmitting(false);
    if (result.ok === false) {
      const map: Record<string, string> = {
        ROOM_NOT_ACTIVE: 'الغرفة مش نشطة دلوقتي — جرّب تحدّث الصفحة.',
        ALREADY_ANSWERED: 'أنت جاوبت على السؤال ده بالفعل.',
        NOT_A_PARTICIPANT: 'مش عضو في الغرفة دي.',
        ROOM_NOT_FOUND: 'الغرفة مش موجودة.',
      };
      const readable = Object.entries(map).find(([k]) => result.error.includes(k))?.[1];
      setAnswerError(readable ?? `تعذر إرسال إجابتك: ${result.error}`);
      return;
    }
    // Record what happened, for the between-round summary. Correctness is
    // known here without asking anyone — correctIdx is in the questions array
    // this client already holds — and the time is measured from the question
    // appearing. i === -1 is the sentinel the countdown submits on timeout.
    const shownAt = questionShownAtRef.current;
    answersRef.current = [
      ...answersRef.current.filter((a) => a.qIdx !== qIdx),
      {
        qIdx,
        round: q?.stage,
        correct: !!q && i === q.correctIdx,
        ms: shownAt ? Math.max(0, Date.now() - shownAt) : 0,
        timedOut: i === -1,
      },
    ];

    triggerHaptic(q && i === q.correctIdx ? 'success' : 'error');
    // Reflect our own answer immediately instead of waiting on the
    // realtime round-trip — the opponent's side still updates via
    // subscribeToRoom, but a delayed/dropped realtime event shouldn't
    // make our own click look like it did nothing.
    //
    // The advance is applied locally too, and that is load-bearing.
    // submit_answer writes the answer and bumps current_question in two
    // SEPARATE statements (036), so they arrive as two realtime frames. If the
    // second one is lost — a silently dead socket, which is the normal result
    // of backgrounding on Android — the player who answered SECOND had
    // bothAnswered flip true locally, which is precisely the state where
    // nothing rescues them: the countdown is off because they answered, the
    // claim button is hidden because the opponent answered, the poll is
    // disarmed because it only runs while waiting on the opponent, and the
    // "connection lost" banner never shows because the channel never reported
    // dying. A frozen reveal panel with no sign anything is wrong. The RPC
    // already tells us both have answered; using it removes the dependency on
    // that second frame entirely.
    setRoom((prev) => {
      if (!prev) return prev;
      const key = String(qIdx);
      const advanced = result.bothAnswered
        ? Math.max(prev.current_question, qIdx + 1)
        : prev.current_question;
      return isHost
        ? { ...prev, host_answers: { ...prev.host_answers, [key]: i }, host_score: result.hostScore, current_question: advanced }
        : { ...prev, guest_answers: { ...prev.guest_answers, [key]: i }, guest_score: result.guestScore, current_question: advanced };
    });
  };

  useEffect(() => { handleSelectRef.current = handleSelect; });

  const handleUseAssist = (id: AssistId) => {
    if (usedAssists.includes(id) || !q) return;
    setUsedAssists((prev) => [...prev, id]);
    triggerHaptic('light');
    if (id === '5050') {
      const wrongIdx = q.options.map((_, i) => i).filter((i) => i !== q.correctIdx && !removedOptions.includes(i));
      const shuffled = [...wrongIdx].sort(() => Math.random() - 0.5);
      setRemovedOptions((prev) => [...prev, ...shuffled.slice(0, 2)]);
    } else if (id === 'extra_time') {
      const timeFreeze = freezeClock();
      setTimeout(() => releaseClock(timeFreeze), 10000);
    } else if (id === 'hint') {
      setHintRevealed(true);
    } else if (id === 'retry') {
      setRetryArmed(true);
    }
  };

  // Initial fetch + realtime subscription
  // The cleanup used to run while the load was still in flight and find
  // `unsub` still null, so leaving the screen during that window subscribed a
  // channel nobody would ever close: it kept pushing setState into an
  // unmounted tree, and re-entering the room opened another on the same
  // topic. `cancelled` closes the window.
  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | null = null;
    (async () => {
      const r = await driver.loadRoom();
      if (cancelled) return;
      if (r) setRoom(r);
      setLoading(false);
      const handle = driver.subscribe(
        (updated) => { setRoom(updated); },
        (status) => { setLive(status === 'SUBSCRIBED'); },
      );
      if (cancelled) { handle(); return; }
      unsub = handle;
    })();
    return () => { cancelled = true; if (unsub) unsub(); };
  }, [driver]);

  // Jump straight to wherever the server is the first time the room lands —
  // rejoining a match in progress must not replay every reveal since question
  // one. Only movement after that is paced.
  const displayInitRef = useRef(false);
  useEffect(() => {
    if (!room || displayInitRef.current) return;
    displayInitRef.current = true;
    setDisplayIdx(Math.min(room.current_question, Math.max(0, room.questions.length - 1)));
  }, [room]);

  // Hold on the answered question, then move on.
  //
  // Keyed on bothAnswered — which is local and true the moment our own
  // optimistic write lands — and NOT on the server index moving. Keying it on
  // the server index meant the reveal was skipped in exactly the cases it was
  // added for. Whoever answers SECOND completes both answer maps locally
  // while current_question is still on this question, so there was no
  // "advance" to react to and the hold never started; on the last question
  // the server never advances past it at all, so the final explanation — the
  // one most worth reading — was the one guaranteed to be cut. And because
  // holdingReveal was state rather than derived, the finalize effect in the
  // same flush still saw its old `false` and fired regardless.
  //
  // `revealedIdx` is the highest question whose reveal has finished playing.
  const [revealedIdx, setRevealedIdx] = useState(-1);
  const holdingReveal = bothAnswered && revealedIdx < qIdx;

  useEffect(() => {
    if (!displayInitRef.current) return;
    if (!bothAnswered || revealedIdx >= qIdx) return;
    const t = setTimeout(() => setRevealedIdx(qIdx), REVEAL_MS);
    return () => clearTimeout(t);
  }, [bothAnswered, qIdx, revealedIdx]);

  // Catch up to the server once nothing is being revealed. Gated on
  // holdingReveal rather than on revealedIdx, so a player rejoining a match
  // mid-flight — who has revealed nothing yet — is not frozen out of ever
  // advancing.
  useEffect(() => {
    if (!displayInitRef.current || !room) return;
    if (holdingReveal) return;
    if (serverIdx <= displayIdx) return;
    setDisplayIdx(Math.min(serverIdx, Math.max(0, room.questions.length - 1)));
  }, [holdingReveal, serverIdx, displayIdx, room?.questions.length]);

  /**
   * Pull the room straight from the table, bypassing the socket.
   *
   * Answers are merged rather than replaced. handleSelect writes our own
   * answer locally the moment the RPC returns, so a refetch already in flight
   * when we submitted can come back without it and land afterwards — which
   * would flip the question back to unanswered, restart nothing, and invite a
   * second tap that the server rejects with ALREADY_ANSWERED. A union is
   * always correct here because answer maps are append-only: submit_answer
   * only ever adds a key, and nothing removes one.
   */
  const refreshRoom = useCallback(async () => {
    const r = await driver.loadRoom();
    if (!r) return;
    setRoom((prev) => {
      if (!prev) return r;
      // Every field that can move forward locally is merged forward, not
      // overwritten. Spreading the fetched row wholesale rolled back the
      // score the RPC had just returned, un-finished a room settled by a
      // claim, and regressed updated_at — which inflates the stall countdown
      // and offers the claim button before the server's cutoff, so the tap
      // comes back OPPONENT_STILL_ACTIVE.
      const settled = prev.status === 'finished' || r.status === 'finished';
      return {
        ...r,
        host_answers: { ...r.host_answers, ...prev.host_answers },
        guest_answers: { ...r.guest_answers, ...prev.guest_answers },
        current_question: Math.max(r.current_question, prev.current_question),
        host_score: Math.max(r.host_score, prev.host_score),
        guest_score: Math.max(r.guest_score, prev.guest_score),
        status: settled ? 'finished' : r.status,
        updated_at:
          new Date(r.updated_at).getTime() >= new Date(prev.updated_at).getTime()
            ? r.updated_at
            : prev.updated_at,
      };
    });
  }, [driver]);

  // Coming back to the app.
  //
  // Liveness rested entirely on one socket opened once at mount, with nothing
  // watching it and nothing polling. This ships as an Android app, where
  // backgrounding reliably kills that socket — so answering a phone call
  // meant returning to a screen frozen on whatever it last saw, with no path
  // back to the truth. That matters more now that a match can END while you
  // are away: the opponent may have claimed it, and this client would never
  // have found out.
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') void refreshRoom(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onVisible);
    };
  }, [refreshRoom]);

  // Belt and braces for a socket that dies without ever saying so — the
  // status callback is not guaranteed to fire on an abrupt drop. Only while
  // there is something left to learn, and only while the channel is down, so
  // a healthy match still costs exactly one socket and no polling.
  //
  // Also polls while waiting on the opponent even when the channel *claims*
  // to be up: a socket can die without the status callback ever firing, and
  // that is exactly the moment it costs the most. The player has answered,
  // the opponent may well have answered too, and the only thing standing
  // between them and the rest of the match is an UPDATE that is never coming.
  // Also polls while the room is still WAITING, channel up or not. That
  // moment depends on a single UPDATE — the one that says a guest arrived —
  // and if it is missed the host sits on «في انتظار الخصم» while their
  // opponent is already playing. Which is precisely the symptom that was
  // reported.
  useEffect(() => {
    if (!room || room.status === 'finished' || room.status === 'cancelled') return;
    const waitingOnOpponent = iAnswered && !bothAnswered;
    const waitingToStart = room.status === 'waiting';
    if (live && !waitingOnOpponent && !waitingToStart) return;
    const t = setInterval(() => { void refreshRoom(); }, RECONNECT_POLL_MS);
    return () => clearInterval(t);
  }, [live, room?.status, iAnswered, bothAnswered, refreshRoom]);

  // Tell the server the host is still here (migration 101).
  //
  // 099's sweep decides a room is abandoned from updated_at, and nothing
  // bumps that while a room waits — so a host patient enough to sit past the
  // cutoff had their own room cancelled by the next person to search, who
  // then found nothing and opened a room of their own. Two people searching,
  // in a two-person queue, who could never meet.
  useEffect(() => {
    if (!room || room.status !== 'waiting' || !isHost) return;
    void driver.touchWaiting();
    const t = setInterval(() => { void driver.touchWaiting(); }, WAITING_HEARTBEAT_MS);
    return () => clearInterval(t);
  }, [room?.status, isHost, roomId]);

  // When the displayed question actually became answerable, which is what an
  // answer time should be measured from. Not when the index changed: a round
  // banner can be covering the screen at that point, and counting the banner
  // against the player would make every first-question-of-a-round look slow.
  useEffect(() => {
    if (stageIntro || iAnswered) return;
    questionShownAtRef.current = Date.now();
  }, [qIdx, stageIntro, iAnswered]);

  // Per-question resets — clears the previous question's transient UI
  // state whenever current_question moves.
  useEffect(() => {
    setAnswerError(null);
    setRemovedOptions([]);
    setHintRevealed(false);
    setRetryFlash(false);
  }, [qIdx]);

  // 20s countdown per question — the original prototype's whole pacing
  // mechanic (and the reason `extra_time` as an assist exists at all).
  // Auto-submits opt_idx=-1 (a sentinel that never matches any
  // correctIdx — submit_answer doesn't range-validate it) on timeout.
  useEffect(() => {
    if (!room || room.status !== 'active' || iAnswered) return;
    setPlayTimer(questionSeconds);
    freezesRef.current.clear();
    const interval = setInterval(() => {
      if (freezesRef.current.size > 0) return;
      setPlayTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleSelectRef.current(-1);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qIdx, room?.status, iAnswered]);

  // Brief "VS" beat the instant a room flips waiting → active, mirroring
  // the original's fixed opponent-found screen before gameplay starts.
  useEffect(() => {
    if (!room) return;
    const prevStatus = prevStatusRef.current;
    prevStatusRef.current = room.status;
    if (prevStatus === 'waiting' && room.status === 'active') {
      setShowVsIntro(true);
      triggerHaptic('medium');
      // Hold the clock. The countdown effect above starts the moment status
      // flips to 'active', and this splash covers the screen for 2.5s — but
      // only for the host, who is the one who sat on 'waiting'. The guest
      // arrives with the room already 'active', so prevStatusRef is still
      // null for them and they never see it. The host was quietly losing
      // 2.5 seconds of question one, every single match.
      const vsFreeze = freezeClock();
      const t = setTimeout(() => {
        setShowVsIntro(false);
        releaseClock(vsFreeze);
      }, 2500);
      return () => clearTimeout(t);
    }
  }, [room?.status]);

  // A stage begins. Both clients read the same questions array off the room,
  // so the boundary lands on the same index for both without any syncing.
  //
  // Declared after the countdown effect on purpose: that one resets
  // clears every freeze token whenever the displayed question changes, which
  // is the same render this fires on. Running second is what makes it stick.
  useEffect(() => {
    if (!room || room.status !== 'active') return;
    // Index 0 is not announced — the VS splash already opens the match, and
    // the stage is named in the header chip from the first frame.
    if (qIdx === 0 || !startsRound(room.questions, qIdx)) return;
    const stage = roundOfQuestion(room.questions, qIdx);
    if (!stage) return;
    setStageIntro(stage);
    triggerHaptic('light');
    const stageFreeze = freezeClock();
    const t = setTimeout(() => {
      setStageIntro(null);
      releaseClock(stageFreeze);
    }, STAGE_INTRO_MS);
    return () => clearTimeout(t);
  }, [qIdx, room?.status]);

  // Trigger finalize automatically when both players finished all questions.
  //
  // Every exit from this has to either set `outcome` or stop trying.
  // finalizeMatch swallows its errors and returns null (multiplayer.ts), and
  // `finalizing` is a dependency here — so the old version's
  // `setFinalizing(false)` on a null result cleared both guards and re-ran
  // the effect on the very next render, with nothing in between. One dropped
  // connection at the end of a match turned into an unthrottled loop firing
  // the RPC as fast as the network would allow, for as long as the player
  // stayed on the screen.
  useEffect(() => {
    if (!room || outcome || finalizing || finalizeFailed) return;
    // Let the last question's reveal finish before the summary replaces it.
    if (holdingReveal) return;

    const total = room.questions.length;
    const bothDone =
      Object.keys(room.host_answers).length >= total &&
      Object.keys(room.guest_answers).length >= total;
    // 'finished' is the idempotent case: finalize returns the settled result.
    const shouldFinalize =
      (bothDone && room.status === 'active') || room.status === 'finished';
    if (!shouldFinalize) return;

    let cancelled = false;
    setFinalizing(true);
    driver.finalize().then(async (result) => {
      if (cancelled) return;
      if (result) {
        finalizeAttemptsRef.current = 0;
        setOutcome(result);
        setFinalizing(false);
        // Push the fresh rating to the parent so the hub reflects it without
        // a reload.
        // Rating AND the rest. Only the rating used to be pushed, so the hub
        // showed pre-match XP, coins and level until a reload — the awards
        // were real, the screen just never heard about them.
        const finishedHost = currentUser.id === room.host_user_id;
        const newLevel = finishedHost ? result.hostNewLevel : result.guestNewLevel;
        onUserUpdated({
          rating: finishedHost ? result.hostNewRating : result.guestNewRating,
          // Taken from the row, not added to what we hold — the level-up sweep
          // resets xp to the overflow, so the arithmetic would drift.
          xp: finishedHost ? result.hostNewXp : result.guestNewXp,
          gameCoins: finishedHost ? result.hostNewCoins : result.guestNewCoins,
          ...(newLevel > 0 ? { level: newLevel } : {}),
        });
        // Not in practice: nothing was earned, so nothing can be unlocked,
        // and asking the server would be a claim that a bot match counted.
        if (!driver.isPractice) {
          const newlyUnlocked = await checkAchievements();
          if (newlyUnlocked.length > 0) onAchievementsUnlocked?.(newlyUnlocked);
        }
        return;
      }
      // Failed. Back off, and give up rather than spin — the player gets a
      // retry button and an exit instead of a spinner that never resolves.
      finalizeAttemptsRef.current += 1;
      if (finalizeAttemptsRef.current >= MAX_FINALIZE_ATTEMPTS) {
        setFinalizeFailed(true);
        setFinalizing(false);
        return;
      }
      const wait = FINALIZE_BACKOFF_MS * finalizeAttemptsRef.current;
      setTimeout(() => { if (!cancelled) setFinalizing(false); }, wait);
    });
    return () => { cancelled = true; };
  }, [room, outcome, finalizing, finalizeFailed, holdingReveal, roomId, currentUser.id, onUserUpdated, onAchievementsUnlocked]);

  // Friending the opponent. The RPC (migration 038) already resolves every
  // case itself — a request each way becomes an instant friendship, a
  // re-send after a decline reopens the same row — so this needs no
  // relationship lookup first, only a readable name for what it reports back.
  const opponentId = room ? (isHost ? room.guest_user_id : room.host_user_id) : null;
  const [friendState, setFriendState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [friendMessage, setFriendMessage] = useState('');

  const sendFriendReq = async () => {
    if (!opponentId) return;
    setFriendState('sending');
    const res = await sendFriendRequest(opponentId);
    if (res.ok === false) {
      // ALREADY_FRIENDS and REQUEST_ALREADY_SENT come back as errors from the
      // RPC, but from the player's side they are the thing they wanted and it
      // is already true — so they read as settled, not as a failure. Only
      // something they cannot get past is shown in red.
      const known: Array<{ code: string; text: string; settled: boolean }> = [
        { code: 'ALREADY_FRIENDS', text: 'انتوا أصحاب بالفعل 🤝', settled: true },
        { code: 'REQUEST_ALREADY_SENT', text: 'الطلب مبعوت خلاص — مستني رده.', settled: true },
        { code: 'USER_NOT_FOUND', text: 'مش هينفع تضيف الحساب ده.', settled: false },
        { code: 'CANNOT_FRIEND_SELF', text: 'مش هينفع تضيف نفسك.', settled: false },
      ];
      const hit = known.find((k) => res.error.includes(k.code));
      setFriendMessage(hit ? hit.text : 'تعذّر إرسال الطلب. جرّب تاني.');
      setFriendState(hit?.settled ? 'done' : 'error');
      return;
    }
    setFriendState('done');
    setFriendMessage(res.status === 'accepted' ? 'بقيتوا أصحاب 🎉' : 'اتبعت طلب الصداقة ✓');
  };

  /** Manual retry from the failure screen. */
  const retryFinalize = () => {
    finalizeAttemptsRef.current = 0;
    setFinalizeFailed(false);
  };

  // Remember what this player was asked, so their next matches draw around
  // it. Recorded once the room is live rather than when the questions are
  // built, because the HOST builds them for both sides — recording here is
  // what gives the guest a history too. Keyed on the question text, which is
  // the only identity that survives the round trip through the room's JSONB.
  const markedSeenRef = useRef(false);
  useEffect(() => {
    if (!room || markedSeenRef.current) return;
    if (room.status !== 'active' && room.status !== 'finished') return;
    markedSeenRef.current = true;
    markSeen(room.questions.map((question) => question.question));
  }, [room?.status, room?.questions]);

  // A ticking "now" so the stall countdown moves without waiting on a
  // realtime event — which, when the opponent has gone, is precisely what
  // will never arrive.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Counted from when WE started waiting, not from room.updated_at.
  //
  // updated_at is a server timestamp that our own optimistic write does not
  // touch, so after answering it still held the moment BEFORE our answer:
  // the countdown ran fast, offered the claim early — the tap then coming
  // back OPPONENT_STILL_ACTIVE from a server measuring the real thing — and
  // visibly jumped backwards the moment a realtime frame or a poll landed
  // with the true value. The server remains the authority on whether a claim
  // is allowed; this only decides when to show the button.
  const waitingSinceRef = useRef<number | null>(null);
  useEffect(() => {
    if (iAnswered && !bothAnswered) {
      if (waitingSinceRef.current === null) waitingSinceRef.current = Date.now();
    } else {
      waitingSinceRef.current = null;
    }
  }, [iAnswered, bothAnswered, qIdx]);

  const stalledFor = waitingSinceRef.current
    ? Math.max(0, Math.floor((now - waitingSinceRef.current) / 1000))
    : 0;
  // The server enforces the real cutoff; this only decides when to offer the
  // button, so client clock skew costs a few seconds either way at worst.
  const canClaim = iAnswered && !bothAnswered && stalledFor >= ABANDON_SECONDS;

  const handleClaim = async () => {
    setClaiming(true);
    setClaimError(null);
    const res = await driver.claimAbandoned();
    setClaiming(false);
    // `=== false`, matching submitAnswer's call site above: this project does
    // not set `strict`, and without it truthiness alone does not narrow the
    // union reliably.
    if (res.ok === false) {
      setClaimError(
        res.error.includes('OPPONENT_STILL_ACTIVE')
          ? 'الخصم لسه موجود — استنى شوية كمان.'
          : res.error.includes('NOT_WAITING_ON_OPPONENT')
            ? 'مش ممكن تنهي المباراة دلوقتي.'
            : 'تعذّر إنهاء المباراة. جرّب تاني.',
      );
      return;
    }
    // Mark the room finished locally as well as taking the outcome. The
    // summary branch needs BOTH, and the row that says so would otherwise
    // have to arrive over the realtime channel — the same channel whose
    // failure is the reason this button exists. Without it the winner gets
    // confetti over a still-live question board, and if loadRoom keeps
    // failing, never sees the summary at all.
    setRoom((prev) => (prev ? { ...prev, status: 'finished' } : prev));
    setOutcome(res.result);
    onUserUpdated({ rating: isHost ? res.result.hostNewRating : res.result.guestNewRating });
  };

  // Cancelling has to survive every way off this screen — the exit button,
  // the hardware back button, the bottom nav. So it hangs off unmount rather
  // than off any one control. Only the host of a room that never filled: once
  // a guest has joined there is someone else with a stake in it, and leaving
  // is an abandonment for them to claim, not a cancellation.
  const roomStatusRef = useRef<string | null>(null);
  const isHostRef = useRef(false);
  useEffect(() => { roomStatusRef.current = room?.status ?? null; }, [room?.status]);
  useEffect(() => { isHostRef.current = isHost; }, [isHost]);
  useEffect(() => () => {
    if (roomStatusRef.current === 'waiting' && isHostRef.current) void driver.cancel();
  }, [driver]);

  // Confetti fires once, only for the winner, the moment the outcome lands.
  useEffect(() => {
    if (outcome && outcome.winnerUserId === currentUser.id && !confettiFiredRef.current) {
      confettiFiredRef.current = true;
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
      triggerHaptic('success');
    }
  }, [outcome, currentUser.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[var(--color-play-bg)] via-[var(--color-play-page-mid)] to-[var(--color-play-page-deep)] text-slate-100 flex items-center justify-center -mx-4 -my-6 sm:mx-0 sm:my-0 sm:rounded-3xl">
        {/* Same fault as the «جارٍ حساب النتيجة» spinner below: a load that
            does not come back — a dropped connection on the way in — left the
            player on a spinner with nothing to press. */}
        <div className="flex flex-col items-center gap-5">
          <div className="flex items-center gap-3 text-slate-300">
            <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
            <span className="text-sm font-bold">جارٍ تحميل الغرفة...</span>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="flex items-center justify-center gap-2 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 text-xs font-bold py-2.5 px-6 rounded-2xl transition-colors"
          >
            <Home className="w-4 h-4" />
            خروج
          </button>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[var(--color-play-bg)] via-[var(--color-play-page-mid)] to-[var(--color-play-page-deep)] text-slate-100 flex items-center justify-center -mx-4 -my-6 sm:mx-0 sm:my-0 sm:rounded-3xl">
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

  // ── "VS" INTRO (brief beat right after a guest joins) ──────────
  if (showVsIntro) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[var(--color-play-bg)] via-[var(--color-play-page-mid)] to-[var(--color-play-page-deep)] text-slate-100 flex items-center justify-center -mx-4 -my-6 sm:mx-0 sm:my-0 sm:rounded-3xl overflow-hidden">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', damping: 16 }}
          className="max-w-md mx-auto px-6 py-10 text-center" dir="rtl"
        >
          <div className="flex items-center justify-center gap-6">
            <div className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-2xl font-black text-white shadow-xl">
                {meName?.charAt(0) ?? '?'}
              </div>
              <span className="text-xs font-black text-white truncate max-w-[100px]">{meName}</span>
            </div>
            <span className="text-2xl font-black text-slate-500">VS</span>
            <div className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-rose-500 to-rose-700 flex items-center justify-center text-2xl font-black text-white shadow-xl">
                {oppName?.charAt(0) ?? '?'}
              </div>
              <span className="text-xs font-black text-white truncate max-w-[100px]">{oppName}</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-6 font-bold">استعد... المباراة بتبدأ!</p>
        </motion.div>
      </div>
    );
  }

  // ── WAITING (room still not full) ─────────────────────────────
  if (room.status === 'waiting') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[var(--color-play-bg)] via-[var(--color-play-page-mid)] to-[var(--color-play-page-deep)] text-slate-100 -mx-4 -my-6 sm:mx-0 sm:my-0 sm:rounded-3xl overflow-hidden">
        <div className="max-w-md mx-auto px-6 py-10 space-y-5 text-center" dir="rtl">
          <div className="mx-auto w-20 h-20 rounded-full bg-white/5 border-2 border-dashed border-amber-500/50 flex items-center justify-center">
            <UsersIcon className="w-10 h-10 text-amber-400" />
          </div>
          <h2 className="text-xl font-black text-white">في انتظار الخصم</h2>
          {room.is_private && (
            <button
              type="button"
              onClick={copyRoomCode}
              className="w-full bg-white/5 border border-white/10 hover:border-amber-500/40 rounded-2xl py-4 transition-colors cursor-pointer"
            >
              <p className="text-[10px] text-slate-400 mb-1">كود الغرفة</p>
              <p className="text-3xl font-black text-amber-300 tracking-[0.4em] font-mono">{roomId}</p>
              <p className="text-[10px] text-slate-400 font-bold mt-1 flex items-center justify-center gap-1">
                {codeCopied
                  ? <><Check className="w-3 h-3 text-emerald-400" /> تم النسخ</>
                  : <><Copy className="w-3 h-3" /> اضغط للنسخ</>}
              </p>
            </button>
          )}
          <p className="text-[11px] text-slate-400 leading-relaxed">
            هيبدأ اللعب تلقائياً بمجرد ما لاعب تاني يدخل.
          </p>
          <div className="flex justify-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" style={{ animationDelay: '300ms' }} />
          </div>
          {/* Was an 11px grey underline under three pulsing dots — the only
              way off a screen that can wait indefinitely, and easy to miss
              entirely. It also said «إلغاء الغرفة والخروج» while its whole
              handler is onBack: nothing is cancelled, the room stays
              `waiting` in the database, and the next player to search gets
              matched into it. Renamed to what it actually does until
              cancel_room exists. */}
          <button
            type="button"
            onClick={onBack}
            className="w-full flex items-center justify-center gap-2 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-200 text-xs font-bold py-3 rounded-2xl transition-colors"
          >
            <Home className="w-4 h-4" />
            خروج
          </button>
        </div>
        <RoomChat currentUser={currentUser} roomId={roomId} opponentName={oppName} />
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
    const myXpGain = isHost ? outcome.hostXpGain : outcome.guestXpGain;
    const myCoinsGain = isHost ? outcome.hostCoinsGain : outcome.guestCoinsGain;
    const myNewLevel = isHost ? outcome.hostNewLevel : outcome.guestNewLevel;
    // The level BEFORE the match is the one this screen was mounted with —
    // onUserUpdated has not been applied to the prop yet at this point.
    const leveledUp = myNewLevel > 0 && myNewLevel > (currentUser.level ?? 1);
    const progress = leagueProgress(myNew);

    return (
      <div className="min-h-screen bg-gradient-to-b from-[var(--color-play-bg)] via-[var(--color-play-page-mid)] to-[var(--color-play-page-deep)] text-slate-100 -mx-4 -my-6 sm:mx-0 sm:my-0 sm:rounded-3xl overflow-hidden">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-lg mx-auto px-4 sm:px-6 py-8 space-y-5 text-center" dir="rtl"
        >
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

          {/* A practice match pays nothing, and says so.
              Without this the summary would show a rating that did not move
              and no reward tiles, which reads as a bug rather than as the
              rule. Saying it plainly is also what keeps the bot honest. */}
          {driver.isPractice && (
            <div className="bg-white/5 border border-white/15 rounded-2xl p-3 text-center">
              <p className="text-[11px] font-black text-slate-300">🤖 تدريب مع بوت</p>
              <p className="text-[10px] text-slate-500 mt-0.5">مفيش تقييم ولا خبرة ولا عملات — دي للتجربة بس.</p>
            </div>
          )}

          {/* What the match actually paid.
              finalize_match has always awarded XP and coins and swept
              level-ups — 100/20 to the winner, 40/10 on a draw, 20/5 to the
              loser — and none of it was in the RPC's return, so the player
              was paid and told nothing while the hub kept showing pre-match
              numbers until a reload. Migration 100 returns it. */}
          {(myXpGain > 0 || myCoinsGain > 0) && (
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="bg-white/5 border border-emerald-500/30 rounded-2xl p-4 flex flex-col items-center gap-1">
                <Zap className="w-6 h-6 text-emerald-400" />
                <span className="text-[10px] text-slate-400 font-bold">خبرة مكتسبة</span>
                <span className="text-xl font-black text-white">+{myXpGain}</span>
              </div>
              <div className="bg-white/5 border border-amber-500/30 rounded-2xl p-4 flex flex-col items-center gap-1">
                <Coins className="w-6 h-6 text-amber-400" />
                <span className="text-[10px] text-slate-400 font-bold">عملات لعب</span>
                <span className="text-xl font-black text-white">+{myCoinsGain}</span>
              </div>
            </div>
          )}

          {leveledUp && (
            <div className="bg-gradient-to-l from-purple-500/20 to-indigo-500/10 border border-purple-500/40 rounded-2xl p-3 text-center">
              <p className="text-[11px] font-black text-purple-200">
                🎉 وصلت للمستوى {myNewLevel}
              </p>
            </div>
          )}

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
              {/* Evidence the rating moved. A +25 win inside a 200-point band
                  produced a summary identical to the last one: the number
                  changed, the badge did not, nothing showed progress. */}
              {progress.next && (
                <div className="w-full pt-1 space-y-1">
                  <div className="h-1.5 w-full bg-black/25 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progress.pct}%` }}
                      transition={{ duration: 0.9, ease: 'easeOut' }}
                      className="h-full bg-white/80 rounded-full"
                    />
                  </div>
                  <p className="text-[8.5px] text-white/70 font-bold text-center">
                    فاضل {progress.toNext} لـ{progress.next.name}
                  </p>
                </div>
              )}
              <span className="text-sm font-black text-white">{league.name}</span>
            </div>
          </div>

          {/* One button, because there was only ever one action. «مباراة جديدة»
              and «العودة لمركز الترفيه» sat on top of each other both calling
              onBack: this screen is handed a roomId and no way to matchmake, so
              no replay exists to wire the first one to. Back lands on the lobby
              or the random-match home — which is where a new match is started. */}
          {/* Add the person you just played.
              This existed before only on the scripted results screen, where
              the «opponent» was one of seven names written into the source —
              so the one place it was offered was the one place it could not
              mean anything. Here the opponent is a real account. */}
          {opponentId && (
            <div className="pt-4">
              {friendState === 'idle' || friendState === 'sending' ? (
                <button
                  type="button"
                  onClick={sendFriendReq}
                  disabled={friendState === 'sending'}
                  className="w-full flex items-center justify-center gap-2 bg-white/5 border border-white/15 hover:bg-white/10 disabled:opacity-60 text-slate-200 text-xs font-black py-3 rounded-2xl transition-colors"
                >
                  <UserPlus className="w-4 h-4" />
                  {friendState === 'sending' ? 'جارٍ الإرسال...' : `إضافة ${oppName ?? 'الخصم'} صاحب`}
                </button>
              ) : (
                <p
                  className={`text-center text-[11.5px] font-black py-3 rounded-2xl border ${
                    friendState === 'error'
                      ? 'text-rose-300 bg-rose-500/10 border-rose-500/30'
                      : 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30'
                  }`}
                >
                  {friendMessage}
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2 pt-4">
            <button
              type="button"
              onClick={onBack}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-l from-amber-500 to-amber-700 hover:from-amber-400 hover:to-amber-600 text-white text-sm font-black py-3 rounded-2xl shadow-lg"
            >
              <RotateCcw className="w-4 h-4" />
              رجوع — العب مباراة تانية
            </button>
          </div>
        </motion.div>
        <RoomChat currentUser={currentUser} roomId={roomId} opponentName={oppName} />
      </div>
    );
  }

  // Covers both "finalize is in flight" AND the brief gap right after a
  // finished room loads/arrives via realtime, before the effect above has
  // had a chance to flip `finalizing` on — without this, that gap fell
  // through to ACTIVE GAMEPLAY below and rendered clickable answer
  // buttons for a room submit_answer would reject with ROOM_NOT_ACTIVE.
  if (room.status === 'finished' && !outcome) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[var(--color-play-bg)] via-[var(--color-play-page-mid)] to-[var(--color-play-page-deep)] text-slate-100 flex items-center justify-center -mx-4 -my-6 sm:mx-0 sm:my-0 sm:rounded-3xl">
        {/* The spinner needs a way out. finalizeMatch() has no catch, so a
            failed finalize leaves `outcome` null forever and this branch keeps
            rendering — and with nothing to tap, the player was stuck on a
            spinner with no exit at all. */}
        <div className="flex flex-col items-center gap-5">
          <div className="flex items-center gap-3 text-slate-300">
            <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
            <span className="text-sm font-bold">جارٍ حساب النتيجة...</span>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="flex items-center justify-center gap-2 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 text-xs font-bold py-2.5 px-6 rounded-2xl transition-colors"
          >
            <Home className="w-4 h-4" />
            خروج
          </button>
        </div>
      </div>
    );
  }

  // ── CANCELLED ─────────────────────────────────────────────────
  // 'cancelled' has been a legal status since 036 and nothing rendered it, so
  // it fell through to ACTIVE GAMEPLAY and showed a live-looking board for a
  // room that no longer exists. Reachable since 099 started actually setting
  // it — by the other player leaving a room that never filled, or by the
  // stale sweep.
  if (room.status === 'cancelled' && !outcome) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[var(--color-play-bg)] via-[var(--color-play-page-mid)] to-[var(--color-play-page-deep)] text-slate-100 flex items-center justify-center -mx-4 -my-6 sm:mx-0 sm:my-0 sm:rounded-3xl">
        <div className="max-w-sm mx-auto px-6 text-center space-y-4" dir="rtl">
          <div className="mx-auto w-16 h-16 rounded-full bg-slate-500/10 border border-slate-500/30 flex items-center justify-center">
            <UsersIcon className="w-7 h-7 text-slate-400" />
          </div>
          <h2 className="text-lg font-black text-white">الغرفة اتقفلت</h2>
          <p className="text-[11.5px] text-slate-400 leading-relaxed">
            المباراة دي مبقتش متاحة. ارجع ودوّر على خصم تاني.
          </p>
          <button
            type="button"
            onClick={onBack}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-l from-amber-500 to-amber-700 hover:from-amber-400 hover:to-amber-600 text-white text-sm font-black py-3 rounded-2xl shadow-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            رجوع — دوّر من جديد
          </button>
        </div>
      </div>
    );
  }

  // ── FINALIZE GAVE UP ──────────────────────────────────────────
  // Without this the fall-through was ugly: status is still 'active' while
  // every question has been answered, so ACTIVE GAMEPLAY below rendered with
  // qIdx === questions.length and q === undefined — an empty question card,
  // no options, and a countdown auto-submitting an out-of-range index.
  if (finalizeFailed && !outcome) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[var(--color-play-bg)] via-[var(--color-play-page-mid)] to-[var(--color-play-page-deep)] text-slate-100 flex items-center justify-center -mx-4 -my-6 sm:mx-0 sm:my-0 sm:rounded-3xl">
        <div className="max-w-sm mx-auto px-6 text-center space-y-4" dir="rtl">
          <div className="mx-auto w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
            <XIcon className="w-7 h-7 text-amber-400" />
          </div>
          <h2 className="text-lg font-black text-white">تعذّر حساب النتيجة</h2>
          <p className="text-[11.5px] text-slate-400 leading-relaxed">
            المباراة خلصت بس النتيجة مقدرتش توصل للسيرفر. تقدر تجرّب تاني —
            إجاباتك محفوظة، ومش هتضيع.
          </p>
          <div className="flex flex-col gap-2 pt-1">
            <button
              type="button"
              onClick={retryFinalize}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-l from-amber-500 to-amber-700 hover:from-amber-400 hover:to-amber-600 text-white text-sm font-black py-3 rounded-2xl shadow-lg transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              حاول تاني
            </button>
            <button
              type="button"
              onClick={onBack}
              className="w-full flex items-center justify-center gap-2 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-200 text-xs font-bold py-2.5 rounded-2xl transition-colors"
            >
              <Home className="w-4 h-4" />
              خروج
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── ACTIVE GAMEPLAY ───────────────────────────────────────────
  const timerPct = (playTimer / questionSeconds) * 100;
  const timerLow = playTimer <= 5;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[var(--color-play-bg)] via-[var(--color-play-page-mid)] to-[var(--color-play-page-deep)] text-slate-100 -mx-4 -my-6 sm:mx-0 sm:my-0 sm:rounded-3xl overflow-hidden">
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
          <div className="flex items-center gap-2">
            {/* Names the subject from the first frame, so stage one needs no
                banner of its own on top of the VS splash. Absent on themed
                lobby matches and on rooms made before stages existed. */}
            {currentRound && (
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${STAGE_CHIP[currentRound.accent]}`}>
                {currentRound.label}
              </span>
            )}
            {!iAnswered && (
              <span className={`text-[11px] font-black tabular-nums px-2 py-0.5 rounded-full ${timerLow ? 'bg-rose-500/20 text-rose-300 animate-pulse' : 'bg-white/5 text-slate-400'}`}>
                {playTimer}s
              </span>
            )}
            <span className="text-[11px] font-black text-slate-400 tabular-nums">
              {qIdx + 1}<span className="text-slate-600"> / </span>{room.questions.length}
            </span>
          </div>
        </div>

        {/* Say so when the channel is down, rather than showing a stale board
            as though it were current. The poll above is already refetching. */}
        {!live && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl px-3 py-2 text-[10.5px] font-bold text-amber-200 text-center flex items-center justify-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
            الاتصال ضعيف — بنحدّث النتيجة كل شوية
          </div>
        )}

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

        {!iAnswered && (
          <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 linear ${timerLow ? 'bg-rose-500' : 'bg-emerald-500'}`}
              style={{ width: `${timerPct}%` }}
            />
          </div>
        )}

        {/* A stage begins. This takes the question card's place rather than
            covering the screen, so the exit, the scores and the counter all
            stay put — and the clock is frozen underneath it (see the effect
            that sets stageIntro), so the banner costs nobody any time. */}
        {stageIntro && (
          <motion.div
            key={`stage-${stageIntro.id}`}
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', damping: 18 }}
            className={`bg-gradient-to-br border rounded-3xl p-6 text-center space-y-2 shadow-xl min-h-[110px] flex flex-col items-center justify-center ${STAGE_PANEL[stageIntro.accent]}`}
          >
            <p className="text-[10px] font-black text-slate-400 tracking-widest">
              الجولة {roundNumber(room.questions, qIdx)} من {totalRounds(room.questions)}
            </p>
            <h3 className="text-xl font-black text-white">{stageIntro.label}</h3>
            <p className="text-[11px] text-slate-300 leading-relaxed">{stageIntro.tagline}</p>

            {/* How the round that just ended went.
                The banner is where this belongs: it is already a pause with
                the clock frozen, so the summary costs the player nothing and
                does not need a screen of its own. Only shown when there IS a
                previous round — the opening banner has nothing to report. */}
            {lastRoundStats && lastRoundStats.total > 0 && (
              <div className="w-full pt-3 mt-1 border-t border-white/10">
                <p className="text-[9px] font-black text-slate-400 mb-2">الجولة اللي فاتت</p>
                <div className="grid grid-cols-3 gap-2">
                  <Stat value={`${lastRoundStats.correct}/${lastRoundStats.total}`} label="صح" />
                  <Stat value={`${lastRoundStats.accuracyPct}%`} label="دقة" />
                  <Stat value={formatSeconds(lastRoundStats.bestMs)} label="أسرع إجابة" />
                </div>
                {matchCombo >= 2 && (
                  <p className="text-[10px] font-black text-amber-300 pt-2">
                    🔥 {matchCombo} إجابات صح ورا بعض
                  </p>
                )}
              </div>
            )}
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {!stageIntro && <motion.div
            key={qIdx}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.25 }}
            className="space-y-4"
          >
            <div className="bg-gradient-to-br from-[#132247] to-[#0A1732] border border-white/10 rounded-3xl p-5 shadow-xl min-h-[110px] flex items-center">
              <p className="text-sm sm:text-base font-black text-white leading-relaxed">{q?.question}</p>
            </div>

            {hintRevealed && !showFeedback && q && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3.5 text-[11.5px] text-amber-200 leading-relaxed flex items-start gap-2">
                <Lightbulb className="w-4 h-4 shrink-0 mt-0.5" />
                <span><span className="font-black">تلميح: </span>{q.explanation}</span>
              </div>
            )}

            <div className="space-y-2.5">
              {q?.options.map((opt, i) => {
                const isCorrect = i === q.correctIdx;
                const isPicked = i === myAnswer;
                const isOppPicked = i === oppAnswer;
                const isRemoved = removedOptions.includes(i);
                let style = 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 text-slate-100';
                if (isRemoved && !showFeedback) {
                  style = 'bg-white/[0.02] border-white/5 text-slate-600 line-through opacity-50';
                } else if (iAnswered && !showFeedback) {
                  // I've answered but opponent hasn't yet — highlight only my pick
                  if (isPicked) style = 'bg-amber-500/10 border-amber-500/40 text-amber-200';
                  else style = 'bg-white/[0.03] border-white/5 text-slate-500';
                } else if (showFeedback) {
                  if (isCorrect) style = 'bg-emerald-500/15 border-emerald-500/50 text-emerald-200';
                  else if (isPicked) style = 'bg-rose-500/15 border-rose-500/50 text-rose-200';
                  else style = 'bg-white/[0.03] border-white/5 text-slate-500';
                }
                const clickable = !iAnswered && !submitting && !isRemoved;
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
          </motion.div>}
        </AnimatePresence>

        {/* Not during a stage banner — there is no question on screen to
            spend a 50/50 or a hint on, and spending one would be wasted. */}
        {!showFeedback && !stageIntro && (
          <AssistBar usedAssists={usedAssists} onUseAssist={handleUseAssist} userLevel={currentUser.level ?? 1} />
        )}

        <AnimatePresence>
          {retryFlash && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="bg-rose-500/15 border border-rose-500/40 text-rose-200 text-[11px] font-black rounded-2xl px-3 py-2.5 text-center"
            >
              لديك فرصة إضافية! ❤️ جرّب تاني
            </motion.div>
          )}
        </AnimatePresence>

        {answerError && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-200 text-[11px] font-bold rounded-2xl px-3 py-2.5 text-center flex items-center justify-center gap-2">
            <XIcon className="w-3.5 h-3.5" />
            {answerError}
          </div>
        )}

        {/* Waiting on the opponent — with a way out of it.
            current_question only advances when both have answered, so an
            opponent who closed their tab used to leave this spinner up
            forever and neither side ever got rating, XP or coins. After the
            cutoff the player can settle it themselves (migration 099): a
            reduced win for them, and nothing taken from the absent player. */}
        {iAnswered && !bothAnswered && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3 space-y-2.5">
            <div className="text-[11px] font-bold text-slate-400 text-center flex items-center justify-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
              في انتظار إجابة الخصم...
            </div>
            {canClaim ? (
              <>
                <p className="text-[10.5px] text-slate-400 text-center leading-relaxed">
                  الخصم مردش من {stalledFor} ثانية. تقدر تنهي المباراة وتاخد
                  الفوز — وهو مش هيخسر تقييم.
                </p>
                <button
                  type="button"
                  onClick={handleClaim}
                  disabled={claiming}
                  className="w-full bg-amber-500/15 border border-amber-500/40 hover:bg-amber-500/25 disabled:opacity-60 text-amber-200 text-[11px] font-black py-2.5 rounded-xl transition-colors"
                >
                  {claiming ? 'جارٍ الإنهاء...' : 'أنهِ المباراة واحسب النتيجة'}
                </button>
              </>
            ) : (
              <p className="text-[10px] text-slate-500 text-center">
                لو الخصم مردش خلال {Math.max(0, ABANDON_SECONDS - stalledFor)} ثانية هتقدر تنهي المباراة.
              </p>
            )}
            {claimError && (
              <p className="text-[10.5px] text-rose-300 text-center">{claimError}</p>
            )}
          </div>
        )}

        {showFeedback && q && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 text-[11.5px] text-slate-300 leading-relaxed space-y-2">
            <div>
              <span className="font-black text-amber-400">تفسير: </span>
              {q.explanation}
            </div>
            {/* Says the pause is on purpose. Without it a deliberate beat and
                a stalled connection look exactly the same. */}
            {holdingReveal && (
              <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 pt-0.5">
                <span className="h-1 flex-1 bg-white/10 rounded-full overflow-hidden">
                  <span
                    className="block h-full bg-amber-400/70 rounded-full"
                    style={{ animation: `pimaRevealBar ${REVEAL_MS}ms linear forwards` }}
                  />
                </span>
                <span>{qIdx >= lastQuestionIdx ? 'النتيجة...' : 'السؤال اللي بعده...'}</span>
              </div>
            )}
          </div>
        )}
        <style>{'@keyframes pimaRevealBar { from { width: 100%; } to { width: 0%; } }'}</style>

      </div>
      <RoomChat currentUser={currentUser} roomId={roomId} opponentName={oppName} />
    </div>
  );
}
