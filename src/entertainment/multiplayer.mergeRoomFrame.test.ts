import { describe, it, expect } from 'vitest';
import { mergeRoomFrame } from './multiplayer';
import type { GameRoom } from './multiplayer';

/**
 * «تفتح اللعبة من جانب واحد فقط».
 *
 * A player searched, an opponent was found, and the game opened for exactly one
 * of them. The guest was fine — their own RPC returned and they fetched the
 * whole row. The host was told about the join over realtime, and what arrived
 * was not the whole row: `questions` is TOASTed, and under the default replica
 * identity Postgres omits unchanged TOASTed columns from an UPDATE payload.
 * The screen replaced its room with that frame and lost the questions.
 */

const HOST_ROOM = {
  id: 'rm_abc',
  status: 'waiting',
  host_user_id: 'u_host',
  guest_user_id: null,
  questions: [{ q: 'مين اللي بنى الفلك؟' }, { q: 'كام سفر في العهد الجديد؟' }],
  host_answers: {},
  guest_answers: {},
  current_question: 0,
  host_score: 0,
  guest_score: 0,
  updated_at: '2026-09-16T10:00:00Z',
} as unknown as GameRoom;

describe('mergeRoomFrame — the frame that opens the match for the host', () => {
  it('keeps the questions when the join frame arrives without them', () => {
    // Exactly what the host received: the guest's details, no questions.
    const joinFrame = {
      id: 'rm_abc',
      status: 'active',
      guest_user_id: 'u_guest',
      guest_name: 'مينا',
      updated_at: '2026-09-16T10:00:05Z',
    } as unknown as Partial<GameRoom>;

    const next = mergeRoomFrame(HOST_ROOM, joinFrame);

    expect(next.status).toBe('active');
    expect(next.guest_user_id).toBe('u_guest');
    // The regression: this used to be undefined, and the match could not render.
    expect(next.questions).toHaveLength(2);
  });

  it('takes the questions from the frame when it does carry them', () => {
    const next = mergeRoomFrame(HOST_ROOM, {
      questions: [{ q: 'س' }],
    } as unknown as Partial<GameRoom>);
    expect(next.questions).toHaveLength(1);
  });

  it('never moves the score or the question index backwards', () => {
    const ahead = { ...HOST_ROOM, current_question: 3, host_score: 2, guest_score: 1 };
    const stale = { current_question: 1, host_score: 0, guest_score: 0 } as unknown as Partial<GameRoom>;
    const next = mergeRoomFrame(ahead, stale);
    expect(next.current_question).toBe(3);
    expect(next.host_score).toBe(2);
    expect(next.guest_score).toBe(1);
  });

  it('does not un-finish a settled match', () => {
    const done = { ...HOST_ROOM, status: 'finished' as const };
    const next = mergeRoomFrame(done, { status: 'active' } as unknown as Partial<GameRoom>);
    expect(next.status).toBe('finished');
  });

  it('keeps answers already known locally', () => {
    const withAnswer = { ...HOST_ROOM, host_answers: { 0: 1 } };
    const next = mergeRoomFrame(withAnswer, { host_answers: {} } as unknown as Partial<GameRoom>);
    expect(next.host_answers).toEqual({ 0: 1 });
  });

  it('returns the frame itself when there is nothing held yet', () => {
    const next = mergeRoomFrame(null, HOST_ROOM);
    expect(next.id).toBe('rm_abc');
  });
});
