import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UserBookings from './UserBookings';
import type { Booking, RetreatHouse, User, PlatformSettings } from '../types';
import { DEFAULT_PLATFORM_SETTINGS } from '../types';

// Heavy children that reach for the network are irrelevant to the payment
// hand-off being tested here.
vi.mock('./RoomDistribution', () => ({ default: () => null }));
vi.mock('./BookingChatPanel', () => ({ default: () => null }));
vi.mock('./ReviewWizard', () => ({ default: () => null }));
vi.mock('../lib/db', () => ({ setAttendeeSharePaid: vi.fn() }));
vi.mock('../lib/ics', () => ({ downloadBookingIcs: vi.fn() }));

const me = { id: 'u1', name: 'أندرو', role: 'individual', email: 'a@b.c' } as User;

const house = {
  id: 'h1', name: 'بيت تجريبي', ownerId: 'owner1', ownerName: 'المالك',
  images: [], paymentMethods: [], bedsCount: 20,
} as unknown as RetreatHouse;

function booking(over: Partial<Booking> = {}): Booking {
  return {
    id: 'b1', houseId: 'h1', houseName: 'بيت تجريبي', userId: 'u1',
    userName: 'أندرو', userPhone: '0100', userEmail: 'a@b.c', userRole: 'individual',
    checkIn: '2026-08-01', checkOut: '2026-08-03', guestsCount: 10,
    totalPrice: 10000, depositPaid: false, depositAmount: 1500,
    status: 'pending', isLargeConferenceQuote: false, createdAt: '2026-07-25T10:00:00Z',
    ...over,
  } as Booking;
}

// The platform publishes its own collection numbers, so guests transfer to
// Pima — owner numbers are hidden server-side (migration 080).
const settings: PlatformSettings = {
  ...DEFAULT_PLATFORM_SETTINGS,
  depositRate: 0.15,
  paymentMethods: [{ id: 'ppm1', type: 'instapay', label: 'بيما', value: '01096126259' }],
} as PlatformSettings;

function renderBookings(props: Partial<React.ComponentProps<typeof UserBookings>> = {}) {
  const onAutoPayConsumed = vi.fn();
  render(
    <UserBookings
      bookings={[booking()]}
      houses={[house]}
      currentUser={me}
      attendees={[]}
      allocations={[]}
      payments={[]}
      onUpdateAttendees={vi.fn()}
      onUpdateAllocations={vi.fn()}
      onSubmitPayment={vi.fn()}
      settings={settings}
      onAutoPayConsumed={onAutoPayConsumed}
      {...props}
    />,
  );
  return { onAutoPayConsumed };
}

describe('the transfer card can be opened for one booking on arrival', () => {
  // Nothing hands this over at request time any more — no deposit is due until
  // the house approves — but the mechanism is what the approval path will use,
  // so it stays covered.
  it('opens the transfer card for the booking it is given', async () => {
    renderBookings({ autoPayBookingId: 'b1' });
    expect(await screen.findByText(/إرسال وتأكيد السداد/)).toBeInTheDocument();
  });

  it('prefills the deposit at the configured rate', async () => {
    renderBookings({ autoPayBookingId: 'b1' });
    await screen.findByText(/إرسال وتأكيد السداد/);
    // 15% of 10,000 = 1,500
    expect(screen.getByDisplayValue('1500')).toBeInTheDocument();
  });

  it('shows the platform as the payee, never the owner', async () => {
    renderBookings({ autoPayBookingId: 'b1' });
    await screen.findByText(/إرسال وتأكيد السداد/);
    expect(screen.getAllByText(/منصة بيما/).length).toBeGreaterThan(0);
  });

  // Regression guard: the hand-off must be consumed, or any later re-render
  // would reopen the card after the guest deliberately closed it.
  it('clears the hand-off so a closed card stays closed', async () => {
    const { onAutoPayConsumed } = renderBookings({ autoPayBookingId: 'b1' });
    await screen.findByText(/إرسال وتأكيد السداد/);
    await waitFor(() => expect(onAutoPayConsumed).toHaveBeenCalled());

    await userEvent.click(screen.getByText('تراجع وإلغاء'));
    await waitFor(() => {
      expect(screen.queryByText(/إرسال وتأكيد السداد/)).not.toBeInTheDocument();
    });
  });

  it('does not reopen the card for a deposit already paid', async () => {
    renderBookings({ bookings: [booking({ depositPaid: true })], autoPayBookingId: 'b1' });
    await waitFor(() => {
      expect(screen.queryByText(/إرسال وتأكيد السداد/)).not.toBeInTheDocument();
    });
  });

  it('leaves the card closed when no booking was just placed', async () => {
    renderBookings();
    await waitFor(() => {
      expect(screen.queryByText(/إرسال وتأكيد السداد/)).not.toBeInTheDocument();
    });
  });
});
