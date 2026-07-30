import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import ProfileScreen from './ProfileScreen';
import type { User } from '../types';

// The home screen's «برنامج الولاء والنقاط» card used to drop the guest on the
// account hub and leave them to find rewards themselves. It now deep-links —
// and the property worth protecting is that it links ONCE. If the entry point
// were not consumed, every later tap on حسابي would also open rewards, and the
// account screen would become unreachable.

vi.mock('./RewardsDashboard', () => ({
  default: ({ onBack }: { onBack: () => void }) => (
    <div data-testid="rewards"><button onClick={onBack}>رجوع من المكافآت</button></div>
  ),
}));
vi.mock('./PhotoPickerButtons', () => ({ default: () => null }));
vi.mock('../lib/db', () => ({ setEmailOptOut: vi.fn().mockResolvedValue(true) }));

const me = {
  id: 'u1', name: 'أندرو', role: 'individual', email: 'a@b.c', phone: '0100',
  createdAt: '2026-01-01T00:00:00Z', points: 1613,
} as User;

const renderProfile = (over: Partial<React.ComponentProps<typeof ProfileScreen>> = {}) =>
  render(
    <ProfileScreen
      currentUser={me}
      onLogout={vi.fn()}
      onBack={vi.fn()}
      onNavigateSupport={vi.fn()}
      onNavigatePrivacy={vi.fn()}
      onDeleteAccount={vi.fn().mockResolvedValue({ ok: true })}
      onUpdateAvatar={vi.fn()}
      {...over}
    />,
  );

describe('the loyalty card deep-links into rewards', () => {
  beforeEach(() => vi.clearAllMocks());

  it('opens the rewards programme when asked for it', () => {
    renderProfile({ initialView: 'rewards' });
    expect(screen.getByTestId('rewards')).toBeTruthy();
  });

  it('opens the account hub by default', () => {
    renderProfile();
    expect(screen.queryByTestId('rewards')).toBeNull();
  });

  it('tells the caller the deep link has been used, so it fires once', () => {
    const onInitialViewConsumed = vi.fn();
    renderProfile({ initialView: 'rewards', onInitialViewConsumed });
    expect(onInitialViewConsumed).toHaveBeenCalledTimes(1);
  });

  it('does not report consumption for an ordinary visit', () => {
    const onInitialViewConsumed = vi.fn();
    renderProfile({ initialView: 'hub', onInitialViewConsumed });
    expect(onInitialViewConsumed).not.toHaveBeenCalled();
  });

  it('lands on the hub the next time, once the entry point has been cleared', () => {
    const { unmount } = renderProfile({ initialView: 'rewards' });
    expect(screen.getByTestId('rewards')).toBeTruthy();
    unmount();

    // What App does after onInitialViewConsumed: back to 'hub'.
    renderProfile({ initialView: 'hub' });
    expect(screen.queryByTestId('rewards')).toBeNull();
  });
});
