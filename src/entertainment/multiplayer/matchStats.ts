import type { MatchStageId } from '../multiplayer';

/**
 * What the player did, so a round can be summarised back to them.
 *
 * Entirely client-side and entirely derived: correctness is known the moment
 * an answer is picked, because `correctIdx` is already in the questions array
 * both players hold, and the time is measured between the question appearing
 * and the tap. Nothing here is asked of the server and nothing is invented —
 * an unanswered question is simply absent rather than counted as anything.
 *
 * Kept as plain functions over a list so the numbers can be tested directly.
 * A stats panel that quietly miscounts is worse than no stats panel: it is
 * the same class of thing as the fabricated win counts removed from the
 * leaderboard, just arrived at by accident instead of on purpose.
 */
export interface AnswerRecord {
  qIdx: number;
  round: MatchStageId | undefined;
  correct: boolean;
  /** Milliseconds from the question appearing to the answer being sent. */
  ms: number;
  /** True when the clock ran out and the answer was auto-submitted. */
  timedOut: boolean;
}

export interface RoundStats {
  correct: number;
  total: number;
  accuracyPct: number;
  /** Fastest correct answer in the round. Null when none were correct. */
  bestMs: number | null;
  timedOut: number;
}

export interface MatchStats extends RoundStats {
  /** Correct answers in a row, counting back from the latest. */
  combo: number;
  /** The longest such run in the match. */
  bestCombo: number;
}

export function statsForRound(records: AnswerRecord[], round: MatchStageId | undefined): RoundStats {
  return summarise(records.filter((r) => r.round === round));
}

export function statsForMatch(records: AnswerRecord[]): MatchStats {
  const base = summarise(records);
  return { ...base, combo: trailingCombo(records), bestCombo: longestCombo(records) };
}

/**
 * The run of correct answers ending at the most recent one. Zero the moment
 * the player gets one wrong, which is what makes it worth showing.
 */
export function trailingCombo(records: AnswerRecord[]): number {
  let n = 0;
  for (let i = records.length - 1; i >= 0; i--) {
    if (!records[i].correct) break;
    n++;
  }
  return n;
}

export function longestCombo(records: AnswerRecord[]): number {
  let best = 0;
  let run = 0;
  for (const r of records) {
    run = r.correct ? run + 1 : 0;
    if (run > best) best = run;
  }
  return best;
}

function summarise(records: AnswerRecord[]): RoundStats {
  const total = records.length;
  const correct = records.filter((r) => r.correct).length;
  // A round nobody answered is 0%, not NaN — which is what `0/0` would put on
  // screen, and it would be shown as confidently as any real number.
  const accuracyPct = total === 0 ? 0 : Math.round((correct / total) * 100);
  const correctTimes = records.filter((r) => r.correct).map((r) => r.ms);
  return {
    correct,
    total,
    accuracyPct,
    bestMs: correctTimes.length > 0 ? Math.min(...correctTimes) : null,
    timedOut: records.filter((r) => r.timedOut).length,
  };
}

/** «٣.٤ ث» — one decimal is as much precision as a person reads at a glance. */
export function formatSeconds(ms: number | null): string {
  if (ms === null) return '—';
  return `${(ms / 1000).toFixed(1)} ث`;
}
