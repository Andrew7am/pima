/**
 * Priority 7 — owner safety net.
 *
 * OwnerDashboardShell is 2731 lines and had no component tests at all, despite
 * being the screen that owns house scope, booking visibility, money and the
 * hard-delete controls. This file does NOT try to cover the screen; it pins the
 * handful of contracts where a regression would leak another owner's data or
 * destroy a real guest booking.
 *
 * The scope chain under test lives at OwnerDashboardShell.tsx:268-270 —
 *   ownerHouses   = houses.filter(h => h.ownerId === owner.id)
 *   ownerHouseIds = ownerHouses.map(h => h.id)
 *   ownerBookings = bookings.filter(b => ownerHouseIds.includes(b.houseId))
 * — and every list, KPI and money figure derives from those. The component is
 * fed hostile props here: houses and bookings belonging to somebody else,
 * exactly as an over-broad fetch would deliver them.
 *
 * Two things this file is careful about, learned the hard way:
 *   - The foreign house is placed FIRST in `houses`. Much of the screen reads
 *     ownerHouses[0], so a foreign house in second place stays invisible even
 *     with the filter removed, and the assertion passes for the wrong reason.
 *   - Bookings only render on the «الحجوزات» tab (default is 'stats'), so the
 *     booking assertions navigate there first. Asserting absence on a screen
 *     that renders no bookings at all proves nothing.
 * Every negative assertion below is paired with a positive control, and the
 * whole file was re-run against a deliberately broken guard to confirm it fails.
 *
 * Deliberately NOT retested here — already covered under src/lib:
 *   pricing / occupancy / commission / payment-ledger maths, booking ordering
 *   and categorisation. Those are pure functions with their own suites; the
 *   component's own contract is scope and guards.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import OwnerDashboardShell from './OwnerDashboardShell';
import type { RetreatHouse, Booking, User } from '../../types';

// The only three Supabase calls this component makes: a realtime channel for
// unread counts (mounted in an effect) and the password change in Settings.
vi.mock('../../lib/supabase', () => {
  const channel = {
    on: vi.fn(function (this: unknown) { return channel; }),
    subscribe: vi.fn(function (this: unknown) { return channel; }),
  };
  return {
    supabase: {
      channel: vi.fn(() => channel),
      removeChannel: vi.fn(),
      auth: { updateUser: vi.fn(async () => ({ error: null })) },
    },
  };
});

vi.mock('../../lib/bookingMessages', () => ({
  loadUnreadCountsPerBooking: vi.fn(async () => ({})),
  loadBookingMessages: vi.fn(async () => []),
  sendBookingMessage: vi.fn(),
  markBookingMessagesRead: vi.fn(),
  subscribeToBookingMessages: vi.fn(() => () => {}),
  subscribeToTypingPresence: vi.fn(() => ({ setTyping: vi.fn(), unsubscribe: vi.fn() })),
}));

const OWNER_ID = 'owner_me';
const owner = { id: OWNER_ID, name: 'أبونا مرقس', role: 'owner', email: 'me@pima.eg', phone: '01000000001' } as unknown as User;

const house = (over: Partial<RetreatHouse> = {}): RetreatHouse => ({
  id: 'h_mine', name: 'بيت النور', ownerId: OWNER_ID, ownerName: 'أبونا مرقس',
  description: '', governorate: 'الإسكندرية', address: '', images: [],
  pricePerNight: 100, capacity: 50, bedsCount: 50, amenities: [], status: 'approved',
  ...over,
} as unknown as RetreatHouse);

const theirHouse = (over: Partial<RetreatHouse> = {}) =>
  house({ id: 'h_theirs', name: 'بيت الغريب', ownerId: 'owner_other', ownerName: 'غريب', ...over });

const booking = (over: Partial<Booking> = {}): Booking => ({
  id: 'b1', houseId: 'h_mine', houseName: 'بيت النور', userId: 'guest1', userName: 'ضيف بيتي',
  userPhone: '01000000002', checkIn: '2026-09-01', checkOut: '2026-09-03',
  guestsCount: 10, totalPrice: 2000, status: 'pending', source: 'platform',
  createdAt: '2026-08-01T10:00:00Z',
  ...over,
} as unknown as Booking);

const theirBooking = (over: Partial<Booking> = {}) =>
  booking({ id: 'b_theirs', houseId: 'h_theirs', houseName: 'بيت الغريب', userName: 'ضيف الغريب', userPhone: '01099998888', ...over });

const mount = (over: Record<string, unknown> = {}) => {
  const props = {
    owner, houses: [house()], bookings: [], attendees: [], allocations: [],
    onAddHouse: vi.fn(), onApproveBooking: vi.fn(), onRejectBooking: vi.fn(),
    onUpdateAttendees: vi.fn(), onUpdateAllocations: vi.fn(),
    onDeleteHouse: vi.fn(), onDeleteBooking: vi.fn(), onLogout: vi.fn(),
    ...over,
  };
  const view = render(<OwnerDashboardShell {...(props as unknown as React.ComponentProps<typeof OwnerDashboardShell>)} />);
  return { ...view, props };
};

/**
 * Bookings render only on the «الحجوزات» tab; 'stats' is the default.
 * Two controls carry that label — `owner-sidebar-group-bookings` merely expands
 * the sidebar submenu, and only `owner-primary-tab-bookings` navigates. Keyed
 * on the stable DOM id rather than label order, which silently picked the wrong
 * one and made every absence assertion below pass against an empty screen.
 */
const goToBookings = (container: HTMLElement) => {
  const tab = container.querySelector<HTMLButtonElement>('#owner-primary-tab-bookings');
  if (!tab) throw new Error('owner-primary-tab-bookings is gone — navigation contract changed');
  fireEvent.click(tab);
};

beforeEach(() => {
  // jsdom's confirm() is unimplemented and throws; every destructive control on
  // this screen is gated behind it, so tests must drive it explicitly.
  window.confirm = vi.fn(() => true);
});

describe('OwnerDashboardShell — house ownership scope', () => {
  it('shows a house the owner owns', () => {
    mount({ houses: [house()] });
    expect(screen.getAllByText(/بيت النور/).length).toBeGreaterThan(0);
  });

  it('never renders a house belonging to another owner', () => {
    // Foreign house FIRST: much of the screen reads ownerHouses[0], so this is
    // the ordering that actually exercises the filter.
    const { container } = mount({ houses: [theirHouse(), house()] });
    expect(container.textContent).not.toContain('بيت الغريب');
    expect(container.textContent).toContain('بيت النور');   // positive control
  });

  it('treats an owner with no houses as empty rather than showing everyone else’s', () => {
    const { container } = mount({ houses: [theirHouse()] });
    expect(container.textContent).not.toContain('بيت الغريب');
  });
});

describe('OwnerDashboardShell — booking visibility scope', () => {
  it('shows the owner’s own booking on the bookings tab', () => {
    // Positive control for every absence assertion below: without this, those
    // could pass simply because no booking renders at all.
    const { container } = mount({ houses: [house()], bookings: [booking()] });
    goToBookings(container);
    expect(screen.getAllByText(/ضيف بيتي/).length).toBeGreaterThan(0);
  });

  it('never renders a booking made against another owner’s house', () => {
    const { container } = mount({
      houses: [theirHouse(), house()],
      bookings: [theirBooking(), booking()],
    });
    goToBookings(container);
    expect(container.textContent).not.toContain('ضيف الغريب');
    expect(container.textContent).toContain('ضيف بيتي');
  });

  it('does not leak a foreign guest’s phone number', () => {
    const { container } = mount({
      houses: [theirHouse(), house()],
      bookings: [theirBooking(), booking()],
    });
    goToBookings(container);
    expect(container.textContent).not.toContain('01099998888');
  });

  it('keeps a foreign booking out even when its house is absent from `houses`', () => {
    // Guards the second half of the chain: ownerHouseIds.includes(b.houseId).
    const { container } = mount({ houses: [house()], bookings: [theirBooking(), booking()] });
    goToBookings(container);
    expect(container.textContent).not.toContain('ضيف الغريب');
  });
});

describe('OwnerDashboardShell — hard delete is refused for live guest bookings', () => {
  // OwnerDashboardShell.tsx:1116 —
  //   canDelete = source === 'manual' || source === 'temporary'
  //            || status === 'cancelled' || status === 'rejected'
  // with the stated intent "active guest bookings stay soft-cancel". A platform
  // booking that is still pending or approved represents a real guest holding a
  // real reservation; hard-deleting it also destroys attendees and allocations.
  const openBooking = (over: Record<string, unknown>) => {
    const view = mount({ houses: [house()], bookings: [booking(over)] });
    goToBookings(view.container);
    fireEvent.click(screen.getAllByText('ضيف بيتي')[0].closest('button, div[role="button"], li, article') ?? screen.getAllByText('ضيف بيتي')[0]);
    return view;
  };

  const deleteButton = () => screen.queryByText('حذف نهائيًا');

  it('offers no hard-delete for a pending platform booking', () => {
    openBooking({ status: 'pending', source: 'platform' });
    expect(deleteButton()).toBeNull();
  });

  it('offers no hard-delete for an approved platform booking', () => {
    openBooking({ status: 'approved', source: 'platform' });
    expect(deleteButton()).toBeNull();
  });

  it('offers no hard-delete for a completed platform booking', () => {
    openBooking({ status: 'completed', source: 'platform' });
    expect(deleteButton()).toBeNull();
  });

  it('does allow it for an owner-created manual booking', () => {
    // Positive control — proves the three assertions above are not simply
    // failing to reach the detail view.
    openBooking({ status: 'pending', source: 'manual' });
    expect(deleteButton()).not.toBeNull();
  });

  it('does allow it once a platform booking is already cancelled', () => {
    openBooking({ status: 'cancelled', source: 'platform' });
    expect(deleteButton()).not.toBeNull();
  });

  it('asks for confirmation before deleting, and does not call back when refused', () => {
    window.confirm = vi.fn(() => false);
    const { props } = openBooking({ status: 'pending', source: 'manual' });
    fireEvent.click(deleteButton()!.closest('button')!);
    expect(window.confirm).toHaveBeenCalled();
    expect(props.onDeleteBooking).not.toHaveBeenCalled();
  });

  it('deletes only after the owner confirms', () => {
    const { props } = openBooking({ status: 'pending', source: 'manual' });
    fireEvent.click(deleteButton()!.closest('button')!);
    expect(props.onDeleteBooking).toHaveBeenCalledWith('b1');
  });
});

describe('OwnerDashboardShell — financial boundaries', () => {
  it('does not count a foreign booking’s money in the owner’s totals', () => {
    // Searching for the raw digits would be vacuous: every figure on this screen
    // goes through arabicNumber(), which renders Arabic-Indic glyphs with
    // separators, so "987654" never appears literally no matter what is counted.
    // Instead: render the dashboard twice, differing only by the presence of a
    // large foreign booking, and require the visible text to be identical. That
    // is formatting-independent and catches any KPI, revenue, commission or
    // occupancy figure that let the foreign row through.
    const own = [booking({ status: 'approved', totalPrice: 2000 })];
    const clean = mount({ houses: [house()], bookings: own });
    const cleanText = clean.container.textContent;
    clean.unmount();

    const dirty = mount({
      houses: [theirHouse(), house()],
      bookings: [...own, theirBooking({ status: 'approved', totalPrice: 987654, guestsCount: 40 })],
    });
    expect(dirty.container.textContent).toBe(cleanText);
  });
});

describe('OwnerDashboardShell — creating a house cannot be done on another owner’s behalf', () => {
  it('stamps the signed-in owner onto any house it creates', () => {
    // OwnerDashboardShell.tsx:473 hardcodes ownerId: owner.id. A source-level
    // assertion because the create path is behind a long multi-step form; the
    // contract worth protecting is that no other value can reach that field.
    const src = require('node:fs').readFileSync(
      require('node:path').join(process.cwd(), 'src/components/owner/OwnerDashboardShell.tsx'), 'utf8');
    expect(src).toMatch(/ownerId:\s*owner\.id/);
  });
});
