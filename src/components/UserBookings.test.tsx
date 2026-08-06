import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
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

const approved = (over: Partial<Booking> = {}) => booking({ status: 'approved', ...over });

describe('the deposit screen opens only where a deposit is actually owed', () => {
  it('opens for an approved booking that still owes its deposit', async () => {
    renderBookings({ bookings: [approved()], autoPayBookingId: 'b1' });
    expect(await screen.findByRole('dialog', { name: 'دفع العربون' })).toBeInTheDocument();
  });

  it('shows the platform as the payee, never the owner', async () => {
    renderBookings({ bookings: [approved()], autoPayBookingId: 'b1' });
    const dialog = await screen.findByRole('dialog', { name: 'دفع العربون' });
    await userEvent.click(within(dialog).getByText('متابعة'));
    expect(await within(dialog).findByText('01096126259')).toBeInTheDocument();
  });

  it('shows the deposit at the configured rate', async () => {
    renderBookings({ bookings: [approved()], autoPayBookingId: 'b1' });
    const dialog = await screen.findByRole('dialog', { name: 'دفع العربون' });
    // 15% of 10,000 = 1,500
    expect(within(dialog).getByText(/١٬٥٠٠/)).toBeInTheDocument();
  });

  // The promise the booking flow makes, guarded at the last door: even a
  // direct hand-off must not open payment on a request the house has not
  // answered.
  it('refuses to open on a booking still under review', async () => {
    renderBookings({ bookings: [booking({ status: 'pending' })], autoPayBookingId: 'b1' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'دفع العربون' })).not.toBeInTheDocument();
    });
  });

  // Regression guard: the hand-off must be consumed, or any later re-render
  // would reopen the screen after the guest deliberately closed it.
  it('clears the hand-off so a closed screen stays closed', async () => {
    const { onAutoPayConsumed } = renderBookings({ bookings: [approved()], autoPayBookingId: 'b1' });
    const dialog = await screen.findByRole('dialog', { name: 'دفع العربون' });
    await waitFor(() => expect(onAutoPayConsumed).toHaveBeenCalled());

    await userEvent.click(within(dialog).getByLabelText('إغلاق'));
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'دفع العربون' })).not.toBeInTheDocument();
    });
  });

  it('does not reopen for a deposit already paid', async () => {
    renderBookings({ bookings: [approved({ depositPaid: true })], autoPayBookingId: 'b1' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'دفع العربون' })).not.toBeInTheDocument();
    });
  });

  it('leaves the card closed when no booking was just placed', async () => {
    renderBookings({ bookings: [approved()] });
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'دفع العربون' })).not.toBeInTheDocument();
    });
  });
});

// Verification used to be a wall on the way in: a registered servant awaiting
// review saw no houses and no prices, while a logged-out visitor saw both.
// It now guards the one thing it actually protects — money leaving the guest.
describe('an account still being verified', () => {
  // The pay CTA lives inside an expanded card. Asserting on a collapsed one
  // passes for the wrong reason: it finds nothing because nothing rendered.
  const openCard = async () => {
    const card = screen.getAllByText(/بيت تجريبي/)[0];
    await userEvent.click(card);
  };

  it('cannot reach the deposit payment', async () => {
    renderBookings({ bookings: [approved()], awaitingVerification: true });
    await openCard();
    expect(screen.queryByRole('button', { name: /ادفع العربون/ })).not.toBeInTheDocument();
  });

  it('is told why, and that the booking is still held', async () => {
    renderBookings({ bookings: [approved()], awaitingVerification: true });
    await openCard();
    expect(screen.getByText(/الدفع مقفول لحد ما نوثّق حسابك/)).toBeInTheDocument();
    expect(screen.getByText(/حجزك محفوظ/)).toBeInTheDocument();
  });

  // The whole point of the change: everything short of paying still works.
  it('still sees its bookings rather than a dead end', async () => {
    renderBookings({ bookings: [approved()], awaitingVerification: true });
    expect(screen.getAllByText(/بيت تجريبي/).length).toBeGreaterThan(0);
  });

  it('gets the pay button back once verified', async () => {
    renderBookings({ bookings: [approved()], awaitingVerification: false });
    await openCard();
    // Two doors lead to the same payment — the inline CTA and the sticky bar.
    expect(screen.getAllByRole('button', { name: /ادفع العربون/ }).length).toBeGreaterThan(0);
  });

  it('never shows the block to a verified account', async () => {
    renderBookings({ bookings: [approved()] });
    await openCard();
    expect(screen.queryByText(/الدفع مقفول/)).not.toBeInTheDocument();
  });
});

// The manual-collection model only works if the guest pays PIMA. The code
// used to fall back to the owner's own numbers whenever the platform had
// none configured — silently, so a cleared settings row (or a settings load
// falling back to DEFAULT_PLATFORM_SETTINGS, which ships with an empty list)
// would route every deposit straight to owners, commission-free.
describe('the deposit always goes to Pima', () => {
  const openCard = async () => {
    await userEvent.click(screen.getAllByText(/بيت تجريبي/)[0]);
  };

  const noPlatformAccounts = { ...settings, paymentMethods: [] } as PlatformSettings;

  it('never offers the owner as the payee', async () => {
    renderBookings({ bookings: [approved()], settings: noPlatformAccounts });
    await openCard();
    expect(screen.queryByText(/حوّل العربون الآن إلى صاحب البيت/)).not.toBeInTheDocument();
  });

  it('stops instead, and says so', async () => {
    renderBookings({ bookings: [approved()], settings: noPlatformAccounts });
    await openCard();
    expect(screen.getByText(/الدفع مش متاح دلوقتي/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ادفع العربون/ })).not.toBeInTheDocument();
  });

  // The owner's own account is for receiving their payout from Pima. A guest
  // must never see it — that is the whole anti-disintermediation position, and
  // it has to hold even when the house has numbers of its own on file.
  it(`never shows the owner's account, even when the house has one`, async () => {
    const houseWithNumbers = {
      ...house,
      paymentMethods: [{ id: 'opm1', type: 'instapay', label: 'إنستاباي المالك', value: '01111111111' }],
    } as unknown as RetreatHouse;
    renderBookings({ bookings: [approved()], houses: [houseWithNumbers], autoPayBookingId: 'b1' });
    const dialog = await screen.findByRole('dialog', { name: 'دفع العربون' });
    await userEvent.click(within(dialog).getByText('متابعة'));
    expect(await within(dialog).findByText('01096126259')).toBeInTheDocument();
    expect(within(dialog).queryByText('01111111111')).not.toBeInTheDocument();
  });
});
