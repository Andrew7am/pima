/**
 * Priority 11 — entertainment safety net.
 *
 * The interactive-room feature is ~5900 lines across InteractiveRoom (2203),
 * LiveMatchGame (1429) and RoomHostDashboard (685), and had no component tests.
 * This file targets the host-authority surface, because that is where the UI
 * genuinely owns a guard rather than mirroring one the server enforces.
 *
 * Two layers of host authority exist, and both are real:
 *
 *   1. InteractiveRoom.tsx:1503 renders RoomHostDashboard ONLY when
 *      role === 'host'. A participant never receives the control panel at all.
 *   2. RoomHostDashboard.tsx:152 — handleToggleLock re-checks `role !== "host"`
 *      and returns. Defence in depth: even handed role='participant' directly,
 *      the panel must not emit a LOCK_ROOM message.
 *
 * That second layer is what this file pins, because it is the one a refactor
 * can silently delete without anything else noticing.
 *
 * Everything here is driven through props. RoomHostDashboard takes no Supabase
 * client and opens no socket — `sendWSMessage` is injected — so there is no
 * mock beyond the spies below, and no simulated transport to keep in sync.
 *
 * NOT covered here: the room reducer's TRANSFER_HOST / RESET_POINTS cases live
 * inside InteractiveRoom's action handler and are not reachable from props;
 * they are recorded in the Priority 11 notes rather than tested speculatively.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RoomHostDashboard } from './RoomHostDashboard';

const player = (over: Record<string, unknown> = {}) => ({
  id: 'p_guest', name: 'مينا', avatar: '', score: 0,
  isHost: false, approved: true, teamId: null, ...over,
});

const host = player({ id: 'p_host', name: 'المنظم', isHost: true });

const room = (over: Record<string, unknown> = {}) => ({
  code: '458921', hostId: 'p_host', players: [host], teams: {},
  gameState: 'lobby', isLocked: false, allowedGames: ['trivia'],
  roundTimer: 30, isTimerPaused: false, ...over,
});

const mount = (over: Record<string, unknown> = {}) => {
  const props = {
    room: room(), currentUser: { id: 'p_host', name: 'المنظم' }, role: 'host',
    sendWSMessage: vi.fn(), showToast: vi.fn(),
    onStartFirstGame: vi.fn(), onAssignTeamManual: vi.fn(),
    onTriggerRandomTeams: vi.fn(), onBackToSelection: vi.fn(),
    ...over,
  };
  const view = render(<RoomHostDashboard {...(props as unknown as React.ComponentProps<typeof RoomHostDashboard>)} />);
  return { ...view, props };
};

/** The lock control renders one of two labels depending on current state. */
const lockButton = () => screen.getByText(/^قفل الغرفة وتجميد الدخول$|^فتح الغرفة$/).closest('button')!;
const sent = (props: { sendWSMessage: ReturnType<typeof vi.fn> }, type: string) =>
  props.sendWSMessage.mock.calls.map((c) => c[0]).filter((m) => m?.type === type);

beforeEach(() => { vi.clearAllMocks(); });

describe('RoomHostDashboard — only the host can lock the room', () => {
  it('locks the room for a host', () => {
    const { props } = mount({ role: 'host' });
    fireEvent.click(lockButton());
    expect(sent(props, 'LOCK_ROOM')).toEqual([
      { type: 'LOCK_ROOM', roomCode: '458921', isLocked: true },
    ]);
  });

  it('sends nothing at all when the panel is handed role="participant"', () => {
    // RoomHostDashboard.tsx:152. InteractiveRoom already withholds this panel
    // from participants, so this is the second line of defence — the one a
    // refactor can delete without any other test noticing.
    const { props } = mount({ role: 'participant' });
    fireEvent.click(lockButton());
    expect(props.sendWSMessage).not.toHaveBeenCalled();
  });

  it('toggles to the opposite of the current state, rather than always locking', () => {
    const { props } = mount({ room: room({ isLocked: true }) });
    fireEvent.click(lockButton());
    expect(sent(props, 'LOCK_ROOM')[0].isLocked).toBe(false);
  });

  it('tells the host what happened', () => {
    const { props } = mount();
    fireEvent.click(lockButton());
    expect(props.showToast).toHaveBeenCalled();
  });

  it('says nothing to a participant either', () => {
    const { props } = mount({ role: 'participant' });
    fireEvent.click(lockButton());
    expect(props.showToast).not.toHaveBeenCalled();
  });
});

describe('RoomHostDashboard — approving who is in the room', () => {
  const waiting = room({ players: [host, player({ id: 'p_waiting', name: 'بيشوي', approved: false })] });

  it('offers accept and reject for someone still waiting', () => {
    mount({ room: waiting });
    expect(screen.getByText('قبول')).toBeInTheDocument();
    expect(screen.getByText('رفض')).toBeInTheDocument();
  });

  it('does not offer them for someone already approved', () => {
    mount({ room: room({ players: [host, player({ id: 'p_in', approved: true })] }) });
    expect(screen.queryByText('قبول')).toBeNull();
  });

  it('approves exactly the player whose control was pressed', () => {
    const { props } = mount({ room: waiting });
    fireEvent.click(screen.getByText('قبول').closest('button')!);
    expect(sent(props, 'APPROVE_PLAYER')[0]).toMatchObject({ playerId: 'p_waiting', approved: true });
  });

  it('rejects with approved=false rather than silently approving', () => {
    const { props } = mount({ room: waiting });
    fireEvent.click(screen.getByText('رفض').closest('button')!);
    expect(sent(props, 'APPROVE_PLAYER')[0]).toMatchObject({ playerId: 'p_waiting', approved: false });
  });
});

describe('RoomHostDashboard — starting the contest', () => {
  it('routes the start control to the parent, which owns the game choice', () => {
    const { container, props } = mount();
    const start = container.querySelector<HTMLButtonElement>('#dashboard-start-game-btn');
    if (!start) throw new Error('#dashboard-start-game-btn is gone — the start contract changed');
    fireEvent.click(start);
    expect(props.onStartFirstGame).toHaveBeenCalledTimes(1);
  });

  it('does not start anything merely by rendering', () => {
    const { props } = mount();
    expect(props.onStartFirstGame).not.toHaveBeenCalled();
    expect(props.sendWSMessage).not.toHaveBeenCalled();
  });
});
