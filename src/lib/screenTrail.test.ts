import { describe, it, expect } from 'vitest';
import { pushTrail, popTrail, TRAIL_LIMIT } from './screenTrail';

describe('pushTrail', () => {
  it('records the screen being left', () => {
    expect(pushTrail<string>([], 'entertainment', 'trivia')).toEqual(['entertainment']);
  });

  it('builds up in order', () => {
    let t: string[] = [];
    t = pushTrail(t, 'explore', 'entertainment');
    t = pushTrail(t, 'entertainment', 'games_catalog');
    t = pushTrail(t, 'games_catalog', 'trivia');
    expect(t).toEqual(['explore', 'entertainment', 'games_catalog']);
  });

  it('ignores a move to the screen already showing', () => {
    // Otherwise a redundant setActiveScreen would stack a no-op entry and the
    // next back press would look broken.
    expect(pushTrail(['explore'], 'trivia', 'trivia')).toEqual(['explore']);
  });

  it('drops the oldest entry past the limit rather than growing forever', () => {
    let t: string[] = [];
    for (let i = 0; i < TRAIL_LIMIT + 5; i++) t = pushTrail(t, `s${i}`, `s${i + 1}`);
    expect(t.length).toBe(TRAIL_LIMIT);
    expect(t[t.length - 1]).toBe(`s${TRAIL_LIMIT + 4}`);
    expect(t[0]).toBe('s5');
  });

  it('does not mutate the trail it was given', () => {
    const original = ['explore'];
    pushTrail(original, 'entertainment', 'trivia');
    expect(original).toEqual(['explore']);
  });
});

describe('popTrail', () => {
  it('returns the previous screen', () => {
    expect(popTrail(['explore', 'games_catalog'], 'trivia', 'entertainment')).toEqual({
      next: 'games_catalog',
      trail: ['explore'],
    });
  });

  it('returns to the catalogue, not the hub — the bug this exists for', () => {
    // entertainment -> games_catalog -> trivia, then back.
    const trail = ['explore', 'entertainment', 'games_catalog'];
    expect(popTrail(trail, 'trivia', 'entertainment').next).toBe('games_catalog');
  });

  it('still reaches the hub when that is genuinely where you came from', () => {
    expect(popTrail(['explore', 'entertainment'], 'trivia', 'entertainment').next).toBe('entertainment');
  });

  it('uses the fallback when there is no trail', () => {
    // Deep link or reload straight into a game.
    expect(popTrail<string>([], 'trivia', 'entertainment')).toEqual({ next: 'entertainment', trail: [] });
  });

  it('skips entries equal to the current screen', () => {
    expect(popTrail(['entertainment', 'trivia'], 'trivia', 'explore').next).toBe('entertainment');
  });

  it('falls back when the trail holds nothing but the current screen', () => {
    expect(popTrail(['trivia', 'trivia'], 'trivia', 'entertainment')).toEqual({
      next: 'entertainment',
      trail: [],
    });
  });

  it('walks all the way out step by step', () => {
    let trail = ['explore', 'entertainment', 'games_catalog'];
    let current = 'trivia';
    ({ next: current, trail } = popTrail(trail, current, 'entertainment'));
    expect(current).toBe('games_catalog');
    ({ next: current, trail } = popTrail(trail, current, 'entertainment'));
    expect(current).toBe('entertainment');
    ({ next: current, trail } = popTrail(trail, current, 'entertainment'));
    expect(current).toBe('explore');
    expect(trail).toEqual([]);
  });

  it('does not mutate the trail it was given', () => {
    const original = ['explore', 'entertainment'];
    popTrail(original, 'trivia', 'entertainment');
    expect(original).toEqual(['explore', 'entertainment']);
  });
});
