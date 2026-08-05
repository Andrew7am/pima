import { describe, it, expect } from 'vitest';
import {
  formatSeconds,
  longestCombo,
  statsForMatch,
  statsForRound,
  trailingCombo,
  type AnswerRecord,
} from './matchStats';

/**
 * These numbers are shown to the player as fact, so they are worth asserting
 * rather than eyeballing. A stats panel that miscounts is the same class of
 * problem as the fabricated win counts removed from the leaderboard — it just
 * arrives there by accident instead of on purpose.
 */
const rec = (
  qIdx: number,
  round: AnswerRecord['round'],
  correct: boolean,
  ms = 5000,
  timedOut = false,
): AnswerRecord => ({ qIdx, round, correct, ms, timedOut });

describe('a round summary', () => {
  const records: AnswerRecord[] = [
    rec(0, 'bible', true, 3400),
    rec(1, 'bible', false, 8000),
    rec(2, 'golden', true, 6000),
    rec(3, 'golden', true, 2100),
  ];

  it('counts only the round asked for', () => {
    expect(statsForRound(records, 'bible')).toMatchObject({ correct: 1, total: 2, accuracyPct: 50 });
    expect(statsForRound(records, 'golden')).toMatchObject({ correct: 2, total: 2, accuracyPct: 100 });
  });

  it('reports the fastest CORRECT answer, not the fastest answer', () => {
    // The wrong one at 8000ms is slower here, but a fast wrong answer must
    // never be presented as a good time.
    expect(statsForRound(records, 'bible').bestMs).toBe(3400);
    expect(statsForRound(records, 'golden').bestMs).toBe(2100);
  });

  it('has no best time when nothing was right', () => {
    const wrongOnly = [rec(0, 'speed', false, 1200)];
    expect(statsForRound(wrongOnly, 'speed').bestMs).toBeNull();
  });

  it('is zero, not NaN, for a round with no answers', () => {
    // 0/0 would render as «NaN%» with exactly as much confidence as a real
    // number.
    const empty = statsForRound([], 'bible');
    expect(empty).toMatchObject({ correct: 0, total: 0, accuracyPct: 0, bestMs: null });
    expect(Number.isNaN(empty.accuracyPct)).toBe(false);
  });

  it('counts answers the clock submitted', () => {
    const withTimeout = [rec(0, 'lightning', false, 7000, true), rec(1, 'lightning', true, 2000)];
    expect(statsForRound(withTimeout, 'lightning').timedOut).toBe(1);
  });

  it('rounds accuracy to something a person reads', () => {
    const thirds = [rec(0, 'bible', true), rec(1, 'bible', false), rec(2, 'bible', false)];
    expect(statsForRound(thirds, 'bible').accuracyPct).toBe(33);
  });
});

describe('combo', () => {
  it('counts the run ending at the latest answer', () => {
    expect(trailingCombo([rec(0, 'bible', true), rec(1, 'bible', true)])).toBe(2);
  });

  it('is zero the moment the latest answer is wrong', () => {
    // The whole reason it is worth showing: it has to be losable.
    expect(trailingCombo([rec(0, 'bible', true), rec(1, 'bible', true), rec(2, 'bible', false)])).toBe(0);
  });

  it('does not count a run that was already broken', () => {
    const records = [rec(0, 'bible', true), rec(1, 'bible', false), rec(2, 'bible', true)];
    expect(trailingCombo(records)).toBe(1);
  });

  it('remembers the best run of the match', () => {
    const records = [
      rec(0, 'bible', true), rec(1, 'bible', true), rec(2, 'bible', true),
      rec(3, 'bible', false),
      rec(4, 'bible', true),
    ];
    expect(longestCombo(records)).toBe(3);
    expect(trailingCombo(records)).toBe(1);
  });

  it('is zero on an empty match', () => {
    expect(trailingCombo([])).toBe(0);
    expect(longestCombo([])).toBe(0);
  });

  it('is zero when nothing was ever right', () => {
    expect(longestCombo([rec(0, 'bible', false), rec(1, 'bible', false)])).toBe(0);
  });
});

describe('the match summary', () => {
  it('adds up every round together', () => {
    const records = [rec(0, 'bible', true), rec(1, 'golden', true), rec(2, 'speed', false)];
    expect(statsForMatch(records)).toMatchObject({
      correct: 2, total: 3, accuracyPct: 67, combo: 0, bestCombo: 2,
    });
  });
});

describe('formatSeconds', () => {
  it('reads as seconds with one decimal', () => {
    expect(formatSeconds(3400)).toBe('3.4 ث');
    expect(formatSeconds(0)).toBe('0.0 ث');
  });

  it('shows a dash rather than a made-up number when there is no time', () => {
    expect(formatSeconds(null)).toBe('—');
  });
});
