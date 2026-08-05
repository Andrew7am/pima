import { describe, it, expect } from 'vitest';
import {
  buildRandomMatchQuestions,
  MATCH_STAGES,
  QUESTIONS_PER_STAGE,
  RANDOM_MATCH_LENGTH,
  stageOf,
  startsStage,
} from './matchQuestions';

/**
 * A malformed random match is worse than a broken solo game: it wedges two
 * people at once, and the server will not settle it. finalize_match requires
 * both players to have answered every question (migration 036), the
 * room-creating RPCs reject anything under three, and submit_answer scores by
 * comparing the submitted index against the stored `correctIdx` — so a short
 * round, a missing option or an out-of-range answer index all end the same
 * way: a match nobody can finish and no rating for either side.
 *
 * These are built fresh and shuffled on every call, so each assertion runs
 * over several draws rather than trusting one lucky one.
 */
const DRAWS = 25;
const rounds = Array.from({ length: DRAWS }, () => buildRandomMatchQuestions());

describe('a random match', () => {
  it('is always exactly the advertised length', () => {
    expect(rounds.map((r) => r.length)).toEqual(Array(DRAWS).fill(RANDOM_MATCH_LENGTH));
  });

  it('never comes back under the three the RPCs require', () => {
    // The real floor. Length above is the intent; this is the hard limit that
    // decides whether a room can be created at all.
    expect(rounds.every((r) => r.length >= 3)).toBe(true);
  });

  it('tags every question with a stage', () => {
    const untagged = rounds.flat().filter((q) => !q.stage);
    expect(untagged).toEqual([]);
  });

  it('keeps each stage contiguous, in the declared order', () => {
    for (const round of rounds) {
      // Collapse runs of the same stage, then compare to the declaration.
      const runs = round.map((q) => q.stage).filter((s, i, a) => s !== a[i - 1]);
      expect(runs).toEqual(MATCH_STAGES.map((s) => s.id));
    }
  });

  it('gives every stage its full share of questions', () => {
    for (const round of rounds) {
      for (const stage of MATCH_STAGES) {
        expect(round.filter((q) => q.stage === stage.id)).toHaveLength(QUESTIONS_PER_STAGE);
      }
    }
  });

  it('points correctIdx at a real option', () => {
    const bad = rounds.flat().filter((q) => q.correctIdx < 0 || q.correctIdx >= q.options.length);
    expect(bad.map((q) => q.question)).toEqual([]);
  });

  it('never repeats an option inside one question', () => {
    // A duplicated distractor would make a wrong answer correct, and the
    // server would mark the player wrong for picking an identical string.
    const bad = rounds.flat().filter((q) => new Set(q.options).size !== q.options.length);
    expect(bad.map((q) => q.question)).toEqual([]);
  });

  it('always offers something to choose between', () => {
    expect(rounds.flat().every((q) => q.options.length >= 2)).toBe(true);
  });

  it('asks a real question with real options', () => {
    const round = rounds[0];
    expect(round.every((q) => typeof q.question === 'string' && q.question.trim().length > 0)).toBe(true);
    expect(
      round.every((q) => q.options.every((o) => typeof o === 'string' && o.trim().length > 0)),
    ).toBe(true);
  });

  it('does not repeat a question within one match', () => {
    for (const round of rounds) {
      const asked = round.map((q) => q.question);
      expect(new Set(asked).size).toBe(asked.length);
    }
  });
});

describe('the stage helpers the match screen reads', () => {
  const round = rounds[0];

  it('resolves the stage of every index', () => {
    for (let i = 0; i < round.length; i++) {
      expect(stageOf(round, i)?.id).toBe(round[i].stage);
    }
  });

  it('marks a boundary exactly once per stage', () => {
    const boundaries = round.map((_, i) => startsStage(round, i)).filter(Boolean);
    expect(boundaries).toHaveLength(MATCH_STAGES.length);
  });

  it('marks the first question as a boundary', () => {
    expect(startsStage(round, 0)).toBe(true);
  });

  it('reports no stage for a room created before stages existed', () => {
    // Old rooms are plain JSONB without the field; the screen must not crash
    // or claim a stage for them.
    const legacy = [{ question: 'q', options: ['a', 'b'], correctIdx: 0, explanation: '' }];
    expect(stageOf(legacy, 0)).toBeNull();
    expect(startsStage(legacy, 0)).toBe(false);
  });

  it('is safe past the end of the round', () => {
    expect(stageOf(round, 999)).toBeNull();
    expect(startsStage(round, 999)).toBe(false);
  });
});
