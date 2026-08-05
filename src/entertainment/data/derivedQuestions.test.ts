import { describe, it, expect } from 'vitest';
import { buildDerivedQuestions } from './derivedQuestions';
import { HYMN_SEASONS, MIDNIGHT_PRAISE_HOSES, LITURGICAL_BOOKS } from './hymnsData';
import { CROSSWORD_CLUES } from './orderingCrosswordData';

/**
 * These questions are about the faith, so the thing worth testing is not that
 * they exist but that none of them can be wrong. Each is generated from a
 * pair the project curated; the ways that could still go bad are a distractor
 * that happens to be the right answer too, an answer index pointing at
 * nothing, or a source growing a duplicate value later on.
 */
describe('buildDerivedQuestions', () => {
  const questions = buildDerivedQuestions();

  it('produces questions', () => {
    expect(questions.length).toBeGreaterThan(30);
  });

  it('never offers the same option twice', () => {
    // The failure this guards: wrong answers are drawn from the same column
    // of other rows, so a repeated value would make a distractor correct.
    const offenders = questions.filter((q) => new Set(q.options).size !== q.options.length);
    expect(offenders.map((q) => q.question)).toEqual([]);
  });

  it('always points correctIdx at a real option', () => {
    const offenders = questions.filter(
      (q) => q.correctIdx < 0 || q.correctIdx >= q.options.length || !q.options[q.correctIdx],
    );
    expect(offenders.map((q) => q.question)).toEqual([]);
  });

  it('gives at least one wrong answer to choose between', () => {
    expect(questions.every((q) => q.options.length >= 2)).toBe(true);
  });

  it('asks something and answers it', () => {
    expect(questions.every((q) => q.question.trim().length > 0)).toBe(true);
    expect(questions.every((q) => q.options.every((o) => typeof o === 'string' && o.trim().length > 0))).toBe(true);
  });

  describe('the sources they are drawn from', () => {
    // If any of these ever gains a duplicate, the generator above can pick a
    // distractor that is also correct — so the sources are asserted, not the
    // output alone.
    it('keeps hymn seasons distinct', () => {
      const seasons = HYMN_SEASONS.map((h) => h.season);
      expect(new Set(seasons).size).toBe(seasons.length);
    });

    it('keeps the hoses of the midnight praise distinct', () => {
      const topics = MIDNIGHT_PRAISE_HOSES.map((h) => h.topic);
      expect(new Set(topics).size).toBe(topics.length);
    });

    it('keeps liturgical book purposes distinct', () => {
      const purposes = LITURGICAL_BOOKS.map((b) => b.purpose);
      expect(new Set(purposes).size).toBe(purposes.length);
    });

    it('keeps crossword answers distinct', () => {
      const answers = CROSSWORD_CLUES.map((c) => c.answer);
      expect(new Set(answers).size).toBe(answers.length);
    });
  });

  it('takes the answer from the same row as the question', () => {
    // Spot-check the shape of the claim: the hymn named in the question must
    // be answered with the season stored beside it, not another one.
    const sample = HYMN_SEASONS[0];
    const q = questions.find((x) => x.question.includes(sample.hymn));
    expect(q).toBeDefined();
    expect(q!.options[q!.correctIdx]).toBe(sample.season);
  });

  it('orders the bible events by the order recorded in the data', () => {
    const ordering = questions.filter((q) => q.question.includes('أي الحدثين'));
    expect(ordering.length).toBeGreaterThan(0);
    // Every one names its earlier event first in the explanation.
    expect(ordering.every((q) => q.explanation.startsWith(q.options[q.correctIdx]))).toBe(true);
  });
});
