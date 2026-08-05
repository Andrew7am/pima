import { describe, it, expect } from 'vitest';
import { initializeQuestionPool } from './questionPoolEngine';

/**
 * The pool feeds nearly everything — the solo games, the interactive room and
 * the random match's third stage — so a malformed question here is not one
 * broken screen, it is one broken question wherever it happens to be drawn.
 *
 * The failure that prompted these: the verse generator built its distractors
 * by mapping over RAW_VERSES instead of over the distinct words, and 105
 * verses hold only 102 distinct words. So a question could offer the same
 * option twice, and because submit_answer scores by comparing the INDEX and
 * not the string, a player who read the correct answer off the button could
 * be marked wrong for tapping the wrong copy of it.
 *
 * The pool is rebuilt with fresh randomness on each call, so these run over
 * several builds rather than trusting one.
 */
const BUILDS = 12;
const pools = Array.from({ length: BUILDS }, () => initializeQuestionPool());

describe('the question pool', () => {
  it('is not empty', () => {
    expect(pools[0].length).toBeGreaterThan(100);
  });

  it('never offers the same option twice in one question', () => {
    const offenders = pools
      .flat()
      .filter((q) => new Set(q.options).size !== q.options.length)
      .map((q) => ({ question: q.question, options: q.options }));
    expect(offenders).toEqual([]);
  });

  it('always points correctIdx at a real option', () => {
    const offenders = pools
      .flat()
      .filter((q) => q.correctIdx < 0 || q.correctIdx >= q.options.length || !q.options[q.correctIdx])
      .map((q) => q.question);
    expect(offenders).toEqual([]);
  });

  it('gives every question something to choose between', () => {
    expect(pools[0].every((q) => q.options.length >= 2)).toBe(true);
  });

  it('asks a real question with real options', () => {
    const pool = pools[0];
    expect(pool.every((q) => typeof q.question === 'string' && q.question.trim().length > 0)).toBe(true);
    expect(pool.every((q) => q.options.every((o) => typeof o === 'string' && o.trim().length > 0))).toBe(true);
  });

  it('gives every question a stable id', () => {
    const ids = pools[0].map((q) => q.id);
    expect(ids.every((id) => id !== undefined && id !== null && String(id).length > 0)).toBe(true);
    // Ids are how repeat-avoidance and the room's played-list identify a
    // question; two questions sharing one would hide the second forever.
    expect(new Set(ids).size).toBe(ids.length);
  });
});
