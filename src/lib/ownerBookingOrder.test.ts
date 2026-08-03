import { describe, it, expect } from 'vitest';
import { categorizeBooking, sortForOwner } from './ownerBookingOrder';
import type { Booking } from '../types';

const TODAY = '2026-07-20';

let n = 0;
function b(over: Partial<Booking>): Booking {
  n += 1;
  return {
    id: `b${n}`, houseId: 'h1', houseName: 'بيت', userId: 'u1', userName: 'ضيف',
    userPhone: '0100', userEmail: 'a@b.c', userRole: 'individual',
    checkIn: '2026-08-01', checkOut: '2026-08-03', guestsCount: 10,
    totalPrice: 1000, depositPaid: true, depositAmount: 150,
    status: 'approved', isLargeConferenceQuote: false, createdAt: '2026-07-01T00:00:00Z',
    ...over,
  } as Booking;
}

describe('categorizeBooking', () => {
  it('reads a request waiting on an answer as new', () => {
    expect(categorizeBooking(b({ status: 'pending' }), TODAY)).toBe('new');
  });

  it('puts today ahead of the money, and the money ahead of confirmed', () => {
    expect(categorizeBooking(b({ checkIn: TODAY, depositPaid: false }), TODAY)).toBe('arrivals_today');
    expect(categorizeBooking(b({ depositPaid: false }), TODAY)).toBe('pending_payment');
    expect(categorizeBooking(b({ depositPaid: true }), TODAY)).toBe('confirmed');
  });

  it('treats rejected and cancelled the same way', () => {
    expect(categorizeBooking(b({ status: 'rejected' }), TODAY)).toBe('cancelled');
    expect(categorizeBooking(b({ status: 'cancelled' }), TODAY)).toBe('cancelled');
  });
});

describe('sortForOwner', () => {
  it('puts whoever is waiting on the owner at the top', () => {
    // The failure this replaces: the list had no sort, so this input order
    // was the output order and the pending request was last.
    const cancelled = b({ status: 'cancelled' });
    const confirmed = b({ depositPaid: true });
    const unpaid = b({ depositPaid: false });
    const arriving = b({ checkIn: TODAY });
    const pending = b({ status: 'pending' });
    const out = sortForOwner([cancelled, confirmed, unpaid, arriving, pending], TODAY);
    expect(out.map((x) => categorizeBooking(x, TODAY)))
      .toEqual(['new', 'arrivals_today', 'pending_payment', 'confirmed', 'cancelled']);
  });

  it('orders a live group by who arrives soonest', () => {
    const late = b({ status: 'pending', checkIn: '2026-09-01' });
    const soon = b({ status: 'pending', checkIn: '2026-07-25' });
    const middle = b({ status: 'pending', checkIn: '2026-08-10' });
    expect(sortForOwner([late, soon, middle], TODAY).map((x) => x.checkIn))
      .toEqual(['2026-07-25', '2026-08-10', '2026-09-01']);
  });

  it('orders finished and cancelled ones newest first', () => {
    // Nobody scrolls a history to reach the oldest cancellation.
    const old = b({ status: 'cancelled', checkIn: '2026-01-01' });
    const recent = b({ status: 'cancelled', checkIn: '2026-06-01' });
    expect(sortForOwner([old, recent], TODAY).map((x) => x.checkIn))
      .toEqual(['2026-06-01', '2026-01-01']);
  });

  it('does not mutate the list it was given', () => {
    const list = [b({ status: 'cancelled' }), b({ status: 'pending' })];
    const before = list.map((x) => x.id);
    sortForOwner(list, TODAY);
    expect(list.map((x) => x.id)).toEqual(before);
  });
});
