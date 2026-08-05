import type { User } from '../../types';
import {
  cancelRoom, claimAbandonedMatch, finalizeMatch, loadRoom, submitAnswer,
  subscribeToRoom, touchWaitingRoom,
  type FinalizeResult, type GameRoom, type RoomQuestion, type SubmitAnswerResult,
} from '../multiplayer';
import { buildRandomMatchQuestions } from './matchQuestions';

/**
 * Where a match's state comes from.
 *
 * The live match screen used to call seven Supabase functions directly, which
 * meant it could only ever run against a real room and a real opponent. This
 * is the seam: the real driver forwards to those seven, and the practice
 * driver keeps the same room shape in memory and plays the other side itself.
 *
 * The screen does not know which it has, so practice exercises the real
 * component — the rounds, the transitions, the reveal hold, the clock, the
 * stats, the summary — rather than a copy of it that could drift.
 */
export interface MatchDriver {
  /** True when the opponent is a bot and nothing is at stake. */
  readonly isPractice: boolean;
  loadRoom(): Promise<GameRoom | null>;
  subscribe(onChange: (room: GameRoom) => void, onStatus: (status: string) => void): () => void;
  submitAnswer(qIdx: number, optIdx: number): Promise<SubmitAnswerResult>;
  finalize(): Promise<FinalizeResult | null>;
  cancel(): Promise<boolean>;
  claimAbandoned(): Promise<{ ok: true; result: FinalizeResult } | { ok: false; error: string }>;
  touchWaiting(): Promise<boolean>;
}

export function supabaseDriver(roomId: string): MatchDriver {
  return {
    isPractice: false,
    loadRoom: () => loadRoom(roomId),
    subscribe: (onChange, onStatus) => subscribeToRoom(roomId, onChange, onStatus),
    submitAnswer: (qIdx, optIdx) => submitAnswer(roomId, qIdx, optIdx),
    finalize: () => finalizeMatch(roomId),
    cancel: () => cancelRoom(roomId),
    claimAbandoned: () => claimAbandonedMatch(roomId),
    touchWaiting: () => touchWaitingRoom(roomId),
  };
}

/** The bot's name, everywhere it appears. Never a person's name. */
export const BOT_NAME = 'بوت التدريب 🤖';
export const PRACTICE_ROOM_ID = 'practice';

/** How often the bot is right. Beatable, not a pushover. */
const BOT_ACCURACY = 0.6;
/** How long it "thinks", in ms. Long enough to watch, short enough to play. */
const BOT_MIN_MS = 1800;
const BOT_MAX_MS = 5200;

/**
 * A match against a bot, entirely in memory.
 *
 * NOTHING IS AT STAKE AND THAT IS DELIBERATE. finalize returns the player's
 * CURRENT rating, xp, coins and level unchanged, with every gain at zero — so
 * the summary screen tells the truth, and a practice match cannot be farmed
 * for anything. It never creates a room, never enters matchmaking, and never
 * touches the leaderboard.
 *
 * This is not the scripted opponent that used to live in RandomMatchGame.
 * That one dealt seven invented PEOPLE, with names and ratings, through the
 * same button as real matchmaking, and never said it was doing so. This
 * announces itself as a bot in its name, on the entry point and on the
 * summary, and lives behind a button that says تدريب.
 */
export function practiceDriver(me: User, questions?: RoomQuestion[]): MatchDriver {
  const room: GameRoom = {
    id: PRACTICE_ROOM_ID,
    is_private: true,
    game_mode: 'trivia',
    host_user_id: me.id,
    host_name: me.name,
    host_rating: me.rating ?? 100,
    guest_user_id: 'practice-bot',
    guest_name: BOT_NAME,
    guest_rating: me.rating ?? 100,
    status: 'active',
    questions: questions ?? buildRandomMatchQuestions(),
    host_score: 0,
    guest_score: 0,
    host_answers: {},
    guest_answers: {},
    current_question: 0,
    winner_user_id: null,
    host_rating_change: null,
    guest_rating_change: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    finished_at: null,
  };

  let listener: ((room: GameRoom) => void) | null = null;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let disposed = false;

  const emit = () => {
    room.updated_at = new Date().toISOString();
    listener?.({ ...room });
  };

  const multiplierAt = (idx: number) => {
    // Mirrors the clamp migration 104 applies server-side, so a practice
    // scoreboard reads exactly like a real one.
    const raw = room.questions[idx]?.multiplier ?? 1;
    return Math.min(3, Math.max(1, Math.round(raw)));
  };

  /** The bot answers on its own clock, once per question. */
  const scheduleBot = (idx: number) => {
    if (disposed || room.guest_answers[String(idx)] !== undefined) return;
    const q = room.questions[idx];
    if (!q) return;
    const wait = BOT_MIN_MS + Math.random() * (BOT_MAX_MS - BOT_MIN_MS);
    const t = setTimeout(() => {
      timers.delete(t);
      if (disposed || room.guest_answers[String(idx)] !== undefined) return;
      const right = Math.random() < BOT_ACCURACY;
      const wrongOptions = q.options.map((_, i) => i).filter((i) => i !== q.correctIdx);
      const pick = right
        ? q.correctIdx
        : wrongOptions[Math.floor(Math.random() * wrongOptions.length)] ?? q.correctIdx;
      room.guest_answers[String(idx)] = pick;
      if (pick === q.correctIdx) room.guest_score += multiplierAt(idx);
      advanceIfBothAnswered(idx);
      emit();
    }, wait);
    timers.add(t);
  };

  const advanceIfBothAnswered = (idx: number) => {
    if (room.host_answers[String(idx)] === undefined) return;
    if (room.guest_answers[String(idx)] === undefined) return;
    room.current_question = Math.max(room.current_question, idx + 1);
    if (room.current_question < room.questions.length) scheduleBot(room.current_question);
  };

  return {
    isPractice: true,

    async loadRoom() {
      scheduleBot(0);
      return { ...room };
    },

    subscribe(onChange) {
      listener = onChange;
      return () => {
        disposed = true;
        listener = null;
        for (const t of timers) clearTimeout(t);
        timers.clear();
      };
    },

    async submitAnswer(qIdx, optIdx) {
      const q = room.questions[qIdx];
      if (!q) return { ok: false, error: 'INVALID_QUESTION_INDEX' };
      if (room.host_answers[String(qIdx)] !== undefined) return { ok: false, error: 'ALREADY_ANSWERED' };
      room.host_answers[String(qIdx)] = optIdx;
      if (optIdx === q.correctIdx) room.host_score += multiplierAt(qIdx);
      advanceIfBothAnswered(qIdx);
      emit();
      return {
        ok: true,
        hostScore: room.host_score,
        guestScore: room.guest_score,
        bothAnswered: room.guest_answers[String(qIdx)] !== undefined,
      };
    },

    async finalize() {
      const total = room.questions.length;
      const done = Object.keys(room.host_answers).length >= total
        && Object.keys(room.guest_answers).length >= total;
      if (!done) return null;
      room.status = 'finished';
      room.finished_at = new Date().toISOString();
      room.winner_user_id = room.host_score > room.guest_score
        ? me.id
        : room.guest_score > room.host_score
          ? 'practice-bot'
          : null;
      room.host_rating_change = 0;
      room.guest_rating_change = 0;
      emit();
      // Everything unchanged, every gain zero. A practice match is worth
      // nothing and the summary says exactly that rather than showing a
      // rating that did not move as though it had.
      return {
        hostRatingChange: 0,
        guestRatingChange: 0,
        hostNewRating: me.rating ?? 100,
        guestNewRating: me.rating ?? 100,
        winnerUserId: room.winner_user_id,
        hostXpGain: 0,
        guestXpGain: 0,
        hostCoinsGain: 0,
        guestCoinsGain: 0,
        hostNewLevel: me.level ?? 1,
        guestNewLevel: me.level ?? 1,
        hostNewXp: me.xp ?? 0,
        guestNewXp: me.xp ?? 0,
        hostNewCoins: me.gameCoins ?? 0,
        guestNewCoins: me.gameCoins ?? 0,
      };
    },

    async cancel() { return true; },
    async claimAbandoned() { return { ok: false, error: 'OPPONENT_STILL_ACTIVE' }; },
    async touchWaiting() { return true; },
  };
}
