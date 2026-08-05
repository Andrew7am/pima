import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { practiceDriver, BOT_NAME, PRACTICE_ROOM_ID } from './matchDriver';
import type { User } from '../../types';
import type { RoomQuestion } from '../multiplayer';

/**
 * The practice driver is a small state machine standing in for the server, so
 * the guarantees worth asserting are the ones that keep it honest: it must
 * never pay out, and it must never look like a person.
 */
const me = {
  id: 'me', name: 'أنا', email: '', role: 'individual', phone: '', createdAt: '',
  rating: 640, xp: 120, level: 4, gameCoins: 55,
} as User;

const q = (correctIdx: number, multiplier = 1): RoomQuestion => ({
  question: 'q', options: ['a', 'b', 'c', 'd'], correctIdx, explanation: '', multiplier,
});

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('the practice opponent', () => {
  it('is named as a bot, not as a person', () => {
    // The whole reason the previous scripted opponents were removed is that
    // they were named like people and never announced themselves.
    expect(BOT_NAME).toContain('بوت');
    expect(BOT_NAME).toContain('🤖');
  });

  it('says it is practice', async () => {
    expect(practiceDriver(me).isPractice).toBe(true);
  });

  it('opens an active room with the bot already in it', async () => {
    const room = await practiceDriver(me, [q(0), q(1)]).loadRoom();
    expect(room?.status).toBe('active');
    expect(room?.guest_name).toBe(BOT_NAME);
    expect(room?.id).toBe(PRACTICE_ROOM_ID);
  });
});

describe('playing a practice match', () => {
  it('scores my answer immediately', async () => {
    const d = practiceDriver(me, [q(2), q(0)]);
    await d.loadRoom();
    const res = await d.submitAnswer(0, 2);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.hostScore).toBe(1);
  });

  it('applies the round multiplier, clamped like the server does', async () => {
    // 99 is what a forged questions array would carry; migration 104 clamps
    // it to 3 and this must agree or practice would score differently.
    const d = practiceDriver(me, [q(0, 99)]);
    await d.loadRoom();
    const res = await d.submitAnswer(0, 0);
    if (res.ok) expect(res.hostScore).toBe(3);
  });

  it('scores nothing for a wrong answer', async () => {
    const d = practiceDriver(me, [q(0)]);
    await d.loadRoom();
    const res = await d.submitAnswer(0, 3);
    if (res.ok) expect(res.hostScore).toBe(0);
  });

  it('refuses the same question twice', async () => {
    const d = practiceDriver(me, [q(0)]);
    await d.loadRoom();
    await d.submitAnswer(0, 0);
    const again = await d.submitAnswer(0, 1);
    expect(again.ok).toBe(false);
  });

  it('lets the bot answer on its own clock, and then advances', async () => {
    const d = practiceDriver(me, [q(0), q(1)]);
    const seen: number[] = [];
    d.subscribe((r) => seen.push(r.current_question), () => {});
    await d.loadRoom();
    await d.submitAnswer(0, 0);
    // The bot has not answered yet, so the match has not moved on.
    expect(seen[seen.length - 1]).toBe(0);
    await vi.advanceTimersByTimeAsync(6000);
    expect(seen[seen.length - 1]).toBe(1);
  });

  it('will not finalise a match that is not finished', async () => {
    const d = practiceDriver(me, [q(0), q(1)]);
    await d.loadRoom();
    await d.submitAnswer(0, 0);
    expect(await d.finalize()).toBeNull();
  });
});

describe('a finished practice match', () => {
  const playThrough = async () => {
    const d = practiceDriver(me, [q(0), q(1)]);
    await d.loadRoom();
    await d.submitAnswer(0, 0);
    await vi.advanceTimersByTimeAsync(6000);
    await d.submitAnswer(1, 1);
    await vi.advanceTimersByTimeAsync(6000);
    return d.finalize();
  };

  it('pays absolutely nothing', async () => {
    const out = await playThrough();
    expect(out).not.toBeNull();
    expect(out).toMatchObject({
      hostRatingChange: 0, guestRatingChange: 0,
      hostXpGain: 0, guestXpGain: 0,
      hostCoinsGain: 0, guestCoinsGain: 0,
    });
  });

  it('hands back the player untouched, not zeroed', async () => {
    // The screen writes these straight onto the user. Returning 0 here would
    // wipe a real rating to nothing on the way out of a practice match.
    const out = await playThrough();
    expect(out).toMatchObject({
      hostNewRating: 640, hostNewXp: 120, hostNewLevel: 4, hostNewCoins: 55,
    });
  });
});

describe('cleanup', () => {
  it('stops the bot when the screen unmounts', async () => {
    const d = practiceDriver(me, [q(0), q(1)]);
    const seen: number[] = [];
    const unsub = d.subscribe((r) => seen.push(r.current_question), () => {});
    await d.loadRoom();
    await d.submitAnswer(0, 0);
    unsub();
    const before = seen.length;
    await vi.advanceTimersByTimeAsync(10000);
    // No further emissions: a timer still firing into an unmounted screen is
    // the leak this guards against.
    expect(seen.length).toBe(before);
  });
});
