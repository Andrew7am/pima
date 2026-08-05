import { describe, it, expect, beforeEach } from 'vitest';
import { markSeen, seenKeys, clearSeen, pickUnseen } from './questionHistory';
import { buildRandomMatchQuestions } from './multiplayer/matchQuestions';
import { QUESTIONS_PER_ROUND, ROUNDS_PER_MATCH } from './multiplayer/rounds';

const id = (s: string) => s;

beforeEach(() => clearSeen());

describe('the seen-question history', () => {
  it('starts empty', () => {
    expect(seenKeys()).toEqual([]);
  });

  it('remembers what it was told', () => {
    markSeen(['a', 'b']);
    expect(seenKeys()).toEqual(['a', 'b']);
  });

  it('does not lose entries written by someone else since it last read', () => {
    // The fault this guards against is the reason this does not share
    // InteractiveRoom's key: that one writes back a snapshot held in React
    // state, so a concurrent writer's entries vanish on its next write.
    markSeen(['a']);
    markSeen(['b']);
    expect(seenKeys()).toEqual(['a', 'b']);
  });

  it('moves a re-seen question to the newest end', () => {
    markSeen(['a', 'b', 'c']);
    markSeen(['a']);
    // 'a' is now the most recent, so it is the last to come back round.
    expect(seenKeys()).toEqual(['b', 'c', 'a']);
  });

  it('never records the same question twice', () => {
    markSeen(['a', 'b']);
    markSeen(['b', 'c']);
    expect(seenKeys()).toEqual(['a', 'b', 'c']);
  });

  it('ignores an empty batch', () => {
    markSeen(['a']);
    markSeen([]);
    expect(seenKeys()).toEqual(['a']);
  });

  it('survives corrupt storage rather than throwing', () => {
    localStorage.setItem('pima_seen_questions', '{not json');
    expect(seenKeys()).toEqual([]);
    expect(() => markSeen(['a'])).not.toThrow();
  });
});

describe('pickUnseen', () => {
  const pool = ['a', 'b', 'c', 'd', 'e'];

  it('prefers questions never asked', () => {
    markSeen(['a', 'b', 'c']);
    expect(pickUnseen(pool, id, 2).sort()).toEqual(['d', 'e']);
  });

  it('returns what was asked for even when everything has been seen', () => {
    // A short round cannot be finalised — both players must answer every
    // question — so running dry has to fall back, never truncate.
    markSeen(pool);
    expect(pickUnseen(pool, id, 3)).toHaveLength(3);
  });

  it('falls back to the questions seen longest ago', () => {
    markSeen(['a', 'b', 'c', 'd', 'e']); // 'a' is oldest
    // Only two unseen exist (none), so all three come from the oldest end.
    expect(pickUnseen(pool, id, 3).sort()).toEqual(['a', 'b', 'c']);
  });

  it('fills the remainder with the oldest when unseen runs short', () => {
    markSeen(['a', 'b', 'c', 'd']); // 'e' never seen; 'a' oldest
    const got = pickUnseen(pool, id, 3);
    expect(got).toHaveLength(3);
    expect(got).toContain('e');
    expect(got).toContain('a'); // oldest seen comes back first
    expect(got).not.toContain('d'); // most recently seen is last to return
  });

  it('never returns more than the pool holds', () => {
    expect(pickUnseen(['a'], id, 5)).toEqual(['a']);
  });

  it('handles the degenerate asks', () => {
    expect(pickUnseen(pool, id, 0)).toEqual([]);
    expect(pickUnseen([], id, 3)).toEqual([]);
  });

  it('never returns the same item twice in one draw', () => {
    markSeen(['a', 'b']);
    const got = pickUnseen(pool, id, 5);
    expect(new Set(got).size).toBe(got.length);
  });
});

describe('consecutive random matches', () => {
  it('do not repeat a question while fresh ones remain', () => {
    // The actual complaint: «الأسئلة بتتكرر كتير في كل ماتش». Ten matches is
    // 60 questions against pools of 105/105/449, so with history there is no
    // reason for any of them to come round twice.
    const asked: string[] = [];
    for (let i = 0; i < 10; i++) {
      const round = buildRandomMatchQuestions();
      expect(round).toHaveLength(ROUNDS_PER_MATCH * QUESTIONS_PER_ROUND);
      const texts = round.map((q) => q.question);
      asked.push(...texts);
      markSeen(texts); // what LiveMatchGame does once the room goes live
    }
    expect(new Set(asked).size).toBe(asked.length);
  });

  it('still builds a full match long after the pools are exhausted', () => {
    // 60 matches is 120 draws from each 105-item pool, so both small stages
    // run dry. A match must still be exactly the advertised length.
    for (let i = 0; i < 60; i++) {
      const round = buildRandomMatchQuestions();
      expect(round).toHaveLength(ROUNDS_PER_MATCH * QUESTIONS_PER_ROUND);
      markSeen(round.map((q) => q.question));
    }
  });

  it('never repeats within a single match, even when everything is seen', () => {
    for (let i = 0; i < 40; i++) markSeen(buildRandomMatchQuestions().map((q) => q.question));
    const round = buildRandomMatchQuestions();
    const texts = round.map((q) => q.question);
    expect(new Set(texts).size).toBe(texts.length);
  });
});
