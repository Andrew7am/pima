import { describe, it, expect } from 'vitest';
import { WORD_SEARCH_GRID, WORD_SEARCH_ANSWERS } from './entertainmentData';

/**
 * The word search is only finishable if every answer can actually be spelled
 * from the letters on the board — the game has no give-up and no partial
 * credit, so one unformable word means the reward is unreachable and the
 * counter sticks one short forever.
 *
 * That is exactly what shipped: «إيليا» was listed while the grid holds no
 * hamza-under-alef at all. This asserts the property rather than that one
 * word, so a future edit to either the grid or the list cannot quietly break
 * the game again.
 */
describe('the word search board', () => {
  const gridLetters = WORD_SEARCH_GRID.flat();

  it('contains enough of every letter to spell each answer', () => {
    const unformable = WORD_SEARCH_ANSWERS.filter(({ word }) => {
      const available = [...gridLetters];
      return [...word].some((ch) => {
        const at = available.indexOf(ch);
        if (at === -1) return true;      // letter missing entirely
        available.splice(at, 1);         // consumed — a cell cannot be reused
        return false;
      });
    });
    expect(unformable.map((w) => w.word)).toEqual([]);
  });

  it('has no duplicate answers, which would make one unreachable', () => {
    const words = WORD_SEARCH_ANSWERS.map((a) => a.word);
    expect(new Set(words).size).toBe(words.length);
  });

  it('starts with every word unfound', () => {
    expect(WORD_SEARCH_ANSWERS.every((a) => a.found === false)).toBe(true);
  });

  it('is a rectangular grid', () => {
    const width = WORD_SEARCH_GRID[0].length;
    expect(WORD_SEARCH_GRID.every((row) => row.length === width)).toBe(true);
  });
});
