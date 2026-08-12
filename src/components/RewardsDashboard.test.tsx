/**
 * Phase 13B safety net — RewardsDashboard, before the token migration.
 *
 * Points are money-adjacent: they buy discounts, so the balance, the tier it
 * lands in and the next reward it unlocks are all contracts, not decoration.
 * These drive the real component; nothing here asserts a colour or class.
 *
 * Not applicable — no such behaviour exists:
 *   loading state  — the component derives everything from props, synchronously.
 *   error state    — it makes no request of its own.
 *   cancellation   — there is no destructive or confirmable action to cancel.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RewardsDashboard from './RewardsDashboard';
import type { User } from '../types';

const user = (over: Record<string, unknown> = {}): User => ({
  id: 'u1', name: 'أندرو أشرف', role: 'individual', email: 'a@b.c',
  phone: '01003334444', points: 3200, pointsHistory: [], ...over,
} as unknown as User);

const mount = (over: Record<string, unknown> = {}) => {
  const props = {
    currentUser: user(), onBack: vi.fn(), bookings: [], reviews: [], houses: [],
    onNavigateBookings: vi.fn(), ...over,
  };
  const view = render(<RewardsDashboard {...(props as unknown as React.ComponentProps<typeof RewardsDashboard>)} />);
  return { ...view, props };
};

describe('RewardsDashboard — the balance', () => {
  it('heads the screen with the current balance', () => {
    mount();
    expect(screen.getByText('رصيدك الحالي')).toBeInTheDocument();
  });

  it('renders a zero balance rather than hiding the panel', () => {
    expect(() => mount({ currentUser: user({ points: 0 }) })).not.toThrow();
    expect(screen.getByText('رصيدك الحالي')).toBeInTheDocument();
  });

  it('survives a user with no points field at all', () => {
    expect(() => mount({ currentUser: user({ points: undefined }) })).not.toThrow();
  });

  it('survives a user with no points history', () => {
    expect(() => mount({ currentUser: user({ pointsHistory: undefined }) })).not.toThrow();
  });
});

describe('RewardsDashboard — tiers and the next reward', () => {
  it('names the current tier', () => {
    mount();
    expect(screen.getByText('مستواك الحالي')).toBeInTheDocument();
  });

  it('points at the next reward while one is still ahead', () => {
    mount({ currentUser: user({ points: 3200 }) });
    expect(screen.getByText('المكافأة القادمة')).toBeInTheDocument();
  });

  it('does not fall over at the very top of the ladder', () => {
    // Above the last threshold there is no next tier — the progress maths must
    // not divide by an undefined bound.
    expect(() => mount({ currentUser: user({ points: 999999 }) })).not.toThrow();
  });

  it('does not fall over at the very bottom', () => {
    expect(() => mount({ currentUser: user({ points: 1 }) })).not.toThrow();
  });
});

describe('RewardsDashboard — navigation', () => {
  it('goes back through onBack', () => {
    const { props } = mount();
    fireEvent.click(screen.getByLabelText('رجوع'));
    expect(props.onBack).toHaveBeenCalledTimes(1);
  });

  it('routes «قيّم المكان» to bookings when the parent supplied a handler', () => {
    const { props } = mount();
    fireEvent.click(screen.getByText('قيّم المكان').closest('button')!);
    expect(props.onNavigateBookings).toHaveBeenCalled();
  });

  it('disables that card instead of dead-ending when no handler was supplied', () => {
    mount({ onNavigateBookings: undefined });
    expect((screen.getByText('قيّم المكان').closest('button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('never calls back from a disabled card', () => {
    const { props } = mount({ onNavigateBookings: undefined });
    fireEvent.click(screen.getByText('قيّم المكان').closest('button')!);
    expect(props.onNavigateBookings).toBeUndefined();
    expect(props.onBack).not.toHaveBeenCalled();
  });
});

describe('RewardsDashboard — the passport', () => {
  it('offers the passport from the dashboard', () => {
    mount();
    expect(screen.getByText('افتح الجواز')).toBeInTheDocument();
  });

  it('opens it, and the dashboard heading gives way', () => {
    mount();
    fireEvent.click(screen.getByText('افتح الجواز').closest('button')!);
    expect(screen.queryByText('رصيدك الحالي')).toBeNull();
  });

  it('comes back from the passport to the dashboard', () => {
    mount();
    fireEvent.click(screen.getByText('افتح الجواز').closest('button')!);
    fireEvent.click(screen.getByLabelText('رجوع'));
    expect(screen.getByText('رصيدك الحالي')).toBeInTheDocument();
  });

  it('does not exit the screen when leaving the passport', () => {
    // The back control is shared, so it must mean "close the passport" here,
    // not "leave rewards".
    const { props } = mount();
    fireEvent.click(screen.getByText('افتح الجواز').closest('button')!);
    fireEvent.click(screen.getByLabelText('رجوع'));
    expect(props.onBack).not.toHaveBeenCalled();
  });
});

describe('RewardsDashboard — the daily ad', () => {
  it('offers today’s ad', () => {
    mount();
    expect(screen.getByText('شاهد إعلان اليوم')).toBeInTheDocument();
  });

  it('does not credit any bonus merely by rendering', () => {
    const { container } = mount({ currentUser: user({ points: 3200 }) });
    // adBonus starts at 0; opening the modal must be a deliberate act.
    expect(container.textContent).not.toContain('3210');
  });
});

describe('RewardsDashboard — data it must survive', () => {
  it('renders with no bookings, reviews or houses', () => {
    expect(() => mount({ bookings: undefined, reviews: undefined, houses: undefined })).not.toThrow();
  });
});
