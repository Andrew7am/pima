import { describe, it, expect } from 'vitest';
import { buildRandomMatchQuestions } from './matchQuestions';
import {
  GOLDEN_ROUND,
  QUESTIONS_PER_ROUND,
  ROUNDS_PER_MATCH,
  roundById,
  roundOfQuestion,
  startsRound,
  totalRounds,
} from './rounds';

/**
 * A malformed random match is worse than a broken solo game: it wedges two
 * people at once, and the server will not settle it. finalize_match requires
 * both players to have answered every question (migration 036), the
 * room-creating RPCs reject anything under three, and submit_answer scores by
 * comparing the submitted index against the stored `correctIdx` — so a short
 * round, a missing option or an out-of-range answer index all end the same
 * way: a match nobody can finish and no rating for either side.
 *
 * The rounds are drawn at random now, so these run over many matches rather
 * than one lucky one.
 */
const MATCHES = 40;
const MATCH_LENGTH = ROUNDS_PER_MATCH * QUESTIONS_PER_ROUND;
const matches = Array.from({ length: MATCHES }, () => buildRandomMatchQuestions());

describe('a random match', () => {
  it('is always exactly the advertised length', () => {
    expect(matches.map((m) => m.length)).toEqual(Array(MATCHES).fill(MATCH_LENGTH));
  });

  it('never comes back under the three the RPCs require', () => {
    // The real floor. Length above is the intent; this is the hard limit that
    // decides whether a room can be created at all.
    expect(matches.every((m) => m.length >= 3)).toBe(true);
  });

  it('tags every question with a round', () => {
    expect(matches.flat().filter((q) => !q.stage)).toEqual([]);
  });

  it('only ever uses rounds that exist', () => {
    const unknown = matches.flat().filter((q) => roundById(q.stage) === null);
    expect(unknown.map((q) => q.stage)).toEqual([]);
  });

  it('keeps each round contiguous', () => {
    for (const m of matches) {
      const runs = m.map((q) => q.stage).filter((s, i, a) => s !== a[i - 1]);
      // A round appearing twice in the run list would mean its questions were
      // split apart by another round.
      expect(new Set(runs).size).toBe(runs.length);
    }
  });

  it('deals every round its full share of questions', () => {
    for (const m of matches) {
      const counts = new Map<string, number>();
      for (const q of m) counts.set(q.stage!, (counts.get(q.stage!) ?? 0) + 1);
      for (const [, n] of counts) expect(n).toBe(QUESTIONS_PER_ROUND);
    }
  });

  it('runs exactly the promised number of rounds', () => {
    expect(matches.every((m) => totalRounds(m) === ROUNDS_PER_MATCH)).toBe(true);
  });

  it('always finishes on the Golden Round', () => {
    expect(matches.every((m) => m[m.length - 1].stage === GOLDEN_ROUND.id)).toBe(true);
  });

  it('does not look the same twice', () => {
    // The whole reason the round system exists.
    const signatures = new Set(
      matches.map((m) => m.map((q) => q.stage).filter((s, i, a) => s !== a[i - 1]).join('>')),
    );
    expect(signatures.size).toBeGreaterThan(3);
  });

  it('points correctIdx at a real option', () => {
    const bad = matches.flat().filter((q) => q.correctIdx < 0 || q.correctIdx >= q.options.length);
    expect(bad.map((q) => q.question)).toEqual([]);
  });

  it('never repeats an option inside one question', () => {
    // A duplicated distractor would make a wrong answer correct, and the
    // server would mark the player wrong for picking an identical string.
    const bad = matches.flat().filter((q) => new Set(q.options).size !== q.options.length);
    expect(bad.map((q) => q.question)).toEqual([]);
  });

  it('always offers something to choose between', () => {
    expect(matches.flat().every((q) => q.options.length >= 2)).toBe(true);
  });

  it('asks a real question with real options', () => {
    const m = matches[0];
    expect(m.every((q) => typeof q.question === 'string' && q.question.trim().length > 0)).toBe(true);
    expect(m.every((q) => q.options.every((o) => typeof o === 'string' && o.trim().length > 0))).toBe(true);
  });

  it('does not repeat a question within one match', () => {
    for (const m of matches) {
      const asked = m.map((q) => q.question);
      expect(new Set(asked).size).toBe(asked.length);
    }
  });
});

describe('the round helpers the match screen reads', () => {
  const m = matches[0];

  it('resolves the round of every index', () => {
    for (let i = 0; i < m.length; i++) {
      expect(roundOfQuestion(m, i)?.id).toBe(m[i].stage);
    }
  });

  it('marks a boundary exactly once per round', () => {
    const boundaries = m.map((_, i) => startsRound(m, i)).filter(Boolean);
    expect(boundaries).toHaveLength(ROUNDS_PER_MATCH);
  });

  it('marks the first question as a boundary', () => {
    expect(startsRound(m, 0)).toBe(true);
  });
});
