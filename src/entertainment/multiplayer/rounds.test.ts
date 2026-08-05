import { describe, it, expect } from 'vitest';
import {
  drawMatchRounds,
  isPressure,
  roundById,
  roundNumber,
  roundOfQuestion,
  startsRound,
  totalRounds,
  GOLDEN_ROUND,
  ROUND_POOL,
  ROUNDS_PER_MATCH,
} from './rounds';
import type { RoomQuestion } from '../multiplayer';

/**
 * "Random but balanced" is a promise, and an unlucky draw is exactly the kind
 * of thing nobody notices until a player opens a match that is three
 * seven-second rounds in a row. The draw is run many times here, and also
 * driven deterministically, so the guarantees are checked rather than hoped
 * for.
 */
const DRAWS = 300;
const draws = Array.from({ length: DRAWS }, () => drawMatchRounds());

describe('the round draw', () => {
  it('always deals a full match', () => {
    expect(draws.every((d) => d.length === ROUNDS_PER_MATCH)).toBe(true);
  });

  it('always ends on the Golden Round', () => {
    expect(draws.every((d) => d[d.length - 1].id === GOLDEN_ROUND.id)).toBe(true);
  });

  it('never deals Golden anywhere but last', () => {
    const early = draws.filter((d) => d.slice(0, -1).some((r) => r.id === GOLDEN_ROUND.id));
    expect(early).toHaveLength(0);
  });

  it('never repeats a round inside one match', () => {
    for (const d of draws) {
      const ids = d.map((r) => r.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('never puts two pressure rounds back to back', () => {
    for (const d of draws) {
      for (let i = 1; i < d.length; i++) {
        expect(isPressure(d[i]) && isPressure(d[i - 1])).toBe(false);
      }
    }
  });

  it('never deals more than two pressure rounds before the finale', () => {
    for (const d of draws) {
      expect(d.slice(0, -1).filter(isPressure).length).toBeLessThanOrEqual(2);
    }
  });

  it('actually varies between matches', () => {
    // The whole point of the feature. If the draw were fixed, every match
    // would produce the same signature.
    const signatures = new Set(draws.map((d) => d.map((r) => r.id).join('>')));
    expect(signatures.size).toBeGreaterThan(5);
  });

  it('can deal every round in the pool eventually', () => {
    const seen = new Set(draws.flat().map((r) => r.id));
    for (const round of ROUND_POOL) expect(seen.has(round.id)).toBe(true);
  });

  it('is deterministic when the picker is', () => {
    const alwaysFirst = () => 0;
    const a = drawMatchRounds(alwaysFirst).map((r) => r.id);
    const b = drawMatchRounds(alwaysFirst).map((r) => r.id);
    expect(a).toEqual(b);
  });

  it('still deals a full match if the balance rules exclude everything', () => {
    // Forcing the picker at the pressure rounds must not produce a short
    // match — a match that is not ROUNDS_PER_MATCH long cannot be finalised,
    // because both players must answer every question.
    const pressureFirst = (n: number) => n - 1;
    const d = drawMatchRounds(pressureFirst);
    expect(d).toHaveLength(ROUNDS_PER_MATCH);
    expect(d[d.length - 1].id).toBe(GOLDEN_ROUND.id);
  });
});

describe('every round definition', () => {
  const all = [...ROUND_POOL, GOLDEN_ROUND];

  it('has a clock a person can actually read a question in', () => {
    expect(all.every((r) => r.seconds >= 5 && r.seconds <= 60)).toBe(true);
  });

  it('scores at least one point per correct answer', () => {
    expect(all.every((r) => r.multiplier >= 1)).toBe(true);
  });

  it('gives Golden the highest stakes of any round', () => {
    const others = ROUND_POOL.map((r) => r.multiplier);
    expect(GOLDEN_ROUND.multiplier).toBeGreaterThan(Math.max(...others));
  });

  it('labels and explains itself', () => {
    expect(all.every((r) => r.label.trim().length > 0 && r.tagline.trim().length > 0)).toBe(true);
  });

  it('has a unique id', () => {
    const ids = all.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('resolves by id, and refuses an unknown one', () => {
    expect(roundById('golden')?.label).toBe(GOLDEN_ROUND.label);
    expect(roundById(undefined)).toBeNull();
  });
});

describe('reading rounds off the questions', () => {
  // Two rounds of two, which is the shape buildRandomMatchQuestions produces.
  const q = (stage: RoomQuestion['stage']): RoomQuestion =>
    ({ question: 'q', options: ['a', 'b'], correctIdx: 0, explanation: '', stage });
  const questions: RoomQuestion[] = [q('whoami'), q('whoami'), q('golden'), q('golden')];

  it('finds the round for any index', () => {
    expect(roundOfQuestion(questions, 0)?.id).toBe('whoami');
    expect(roundOfQuestion(questions, 3)?.id).toBe('golden');
  });

  it('marks a boundary exactly once per round', () => {
    const marks = questions.map((_, i) => startsRound(questions, i));
    expect(marks).toEqual([true, false, true, false]);
  });

  it('numbers the rounds as a player would count them', () => {
    expect(questions.map((_, i) => roundNumber(questions, i))).toEqual([1, 1, 2, 2]);
    expect(totalRounds(questions)).toBe(2);
  });

  it('says nothing about a room made before rounds existed', () => {
    const legacy: RoomQuestion[] = [{ question: 'q', options: ['a', 'b'], correctIdx: 0, explanation: '' }];
    expect(roundOfQuestion(legacy, 0)).toBeNull();
    expect(startsRound(legacy, 0)).toBe(false);
    expect(totalRounds(legacy)).toBe(0);
  });

  it('is safe past the end', () => {
    expect(roundOfQuestion(questions, 99)).toBeNull();
    expect(startsRound(questions, 99)).toBe(false);
  });
});
