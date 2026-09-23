import { describe, it, expect } from 'vitest';
import type { Booking, Payment, Payout } from '../types';
import { summarizeFinances } from './adminFinance';
import { findFinanceExceptions } from './adminExceptions';
import { indexByBooking, mapAdminFinancials } from './bookingFinancials';

/**
 * The admin screens, read from the financial core.
 *
 * These are the same figures adminFinance.test.ts already covers, with one
 * thing changed: the bookings carry a booking_financials snapshot. Every
 * expectation below would be wrong under the old `total x rate` arithmetic,
 * which is the point — a MARKUP booking has no rate to apply.
 */

const HOUSE = { id: 'h1', name: 'بيت النور', ownerId: 'o1' };
const USERS = [{ id: 'o1', name: 'صاحب البيت' }];

/** A MARKUP booking: guest pays 180, house is entitled to 150, deposit 54. */
function markupBooking(over: Partial<Booking> = {}): Booking {
  return {
    id: 'bk1', houseId: 'h1', userName: 'ضيف', houseName: HOUSE.name,
    // What the financial core writes onto the booking row itself.
    totalPrice: 180, depositAmount: 0, commissionRate: null,
    depositPaid: true, paymentStatus: 'paid_deposit', status: 'approved',
    checkIn: '2026-10-01', checkOut: '2026-10-02', guestsCount: 2,
    ...over,
  } as unknown as Booking;
}

function markupSnapshot(over: Record<string, unknown> = {}) {
  return indexByBooking([mapAdminFinancials({
    booking_id: 'bk1', house_id: 'h1', owner_id: 'o1', currency: 'EGP',
    model_type: 'MARKUP', retail_price: '180.00', final_price: '180.00',
    deposit_amount: '54.00', arrival_balance_external: '126.00',
    owner_entitlement: '150.00', owner_cash_held: '24.00',
    owner_settled_amount: '0', owner_cash_payable: '24.00',
    pima_gross_margin: '30.00', settlement_hold_status: 'HELD',
    ...over,
  })]);
}

function payment(over: Partial<Payment> = {}): Payment {
  return {
    id: 'p1', bookingId: 'bk1', amount: 54, paymentStatus: 'approved',
    paymentMethod: 'instapay', paymentDate: '2026-09-01T10:00:00Z',
    ...over,
  } as unknown as Payment;
}

const BASE = {
  houses: [HOUSE], users: USERS, payouts: [] as Payout[],
  commissionRate: 0.05, window: null, platformCollects: true,
};

describe('summarizeFinances on a MARKUP booking', () => {
  const bookings = [markupBooking()];
  const payments = [payment()];

  it('owes the owner 24 — the settlement hold, not the entitlement', () => {
    const s = summarizeFinances({ ...BASE, bookings, payments, financials: markupSnapshot() });
    expect(s.ownersOwed).toBe(24);
    // The three wrong answers this replaces.
    expect(s.ownersOwed).not.toBe(150);
    expect(s.ownersOwed).not.toBe(180);
    expect(s.ownersOwed).not.toBe(0);
  });

  it("keeps Pima's 30 as a residual, not 5% of anything", () => {
    const s = summarizeFinances({ ...BASE, bookings, payments, financials: markupSnapshot() });
    expect(s.platformCommission).toBe(30);
    expect(s.platformCommission).not.toBe(Math.round(180 * 0.05));
  });

  it('sends the guest to the door with 126, not the full 180', () => {
    const s = summarizeFinances({ ...BASE, bookings, payments, financials: markupSnapshot() });
    expect(s.cashAtDoor).toBe(126);
  });

  it('adds up: collected 54 = commission 30 + owed to owner 24', () => {
    const s = summarizeFinances({ ...BASE, bookings, payments, financials: markupSnapshot() });
    expect(s.collectedByPima).toBe(54);
    expect(s.platformCommission + s.ownersOwed).toBe(s.collectedByPima);
  });

  it('puts the same figures on the owner row as on the page total', () => {
    const s = summarizeFinances({ ...BASE, bookings, payments, financials: markupSnapshot() });
    expect(s.perOwner).toHaveLength(1);
    expect(s.perOwner[0].owed).toBe(s.ownersOwed);
    expect(s.perOwner[0].commission).toBe(s.platformCommission);
  });

  // Without the snapshot the old arithmetic reads deposit_amount = 0 and
  // reports the owner is owed nothing at all.
  it('reports 0 owed without the snapshot — the defect this phase fixes', () => {
    const s = summarizeFinances({ ...BASE, bookings, payments });
    expect(s.ownersOwed).toBe(0);
  });
});

describe('summarizeFinances on a NET_RATE booking', () => {
  // listed 150, net 100, PD-16 deposit 50, arrival 100, hold 0.
  const fin = indexByBooking([mapAdminFinancials({
    booking_id: 'bk1', house_id: 'h1', owner_id: 'o1', model_type: 'NET_RATE',
    retail_price: '150.00', final_price: '150.00', deposit_amount: '50.00',
    arrival_balance_external: '100.00', owner_entitlement: '100.00',
    owner_cash_held: '0', owner_cash_payable: '0', pima_gross_margin: '50.00',
  })]);
  const bookings = [markupBooking({ totalPrice: 150 })];
  const payments = [payment({ amount: 50 })];

  it('owes the owner nothing: the house collects its whole entitlement at the door', () => {
    const s = summarizeFinances({ ...BASE, bookings, payments, financials: fin });
    expect(s.ownersOwed).toBe(0);
    expect(s.ownersOwed).not.toBe(150);
    expect(s.platformCommission).toBe(50);
  });
});

describe('findFinanceExceptions with a financial-core booking', () => {
  const houses = [{ id: 'h1', name: HOUSE.name }];

  it('still catches a short deposit, which deposit_amount = 0 had silenced', () => {
    const bookings = [markupBooking()];
    const payments = [payment({ amount: 10 })];
    const withCore = findFinanceExceptions({
      bookings, payments, payouts: [], houses, commissionRate: 0.05, financials: markupSnapshot(),
    });
    expect(withCore.map((e) => e.kind)).toContain('underpaid_deposit');
    expect(withCore.find((e) => e.kind === 'underpaid_deposit')?.amount).toBe(44);

    // The false negative: with deposit_amount = 0 the `deposit > 0` guard
    // never fires, and a guest who paid 10 of 54 looks perfectly settled.
    const withoutCore = findFinanceExceptions({
      bookings, payments, payouts: [], houses, commissionRate: 0.05,
    });
    expect(withoutCore.map((e) => e.kind)).not.toContain('underpaid_deposit');
  });

  it('does not read deposit_amount = 0 as an overpayment on any payment', () => {
    const bookings = [markupBooking()];
    const payments = [payment({ amount: 54 })];
    const out = findFinanceExceptions({
      bookings, payments, payouts: [], houses, commissionRate: 0.05, financials: markupSnapshot(),
    });
    expect(out.map((e) => e.kind)).not.toContain('overpaid_booking');
    expect(out.map((e) => e.kind)).not.toContain('deposit_paid_but_nothing_received');
    expect(out.map((e) => e.kind)).not.toContain('underpaid_deposit');
    expect(out).toHaveLength(0);
  });

  it('flags a genuinely unpaid deposit even under the core', () => {
    const bookings = [markupBooking({ depositPaid: true })];
    const out = findFinanceExceptions({
      bookings, payments: [], payouts: [], houses, commissionRate: 0.05, financials: markupSnapshot(),
    });
    expect(out.map((e) => e.kind)).toContain('deposit_paid_but_nothing_received');
    // And it quotes the real numbers, not 180 vs 180.
    expect(out[0].detail).toContain('١٨٠');
  });

  it('measures an overpayment against the core price, not the booking row', () => {
    const bookings = [markupBooking()];
    const payments = [payment({ amount: 200 })];
    const out = findFinanceExceptions({
      bookings, payments, payouts: [], houses, commissionRate: 0.05, financials: markupSnapshot(),
    });
    const over = out.find((e) => e.kind === 'overpaid_booking');
    expect(over?.amount).toBe(20);
  });

  it('caps a house payout at the hold, so 24 sent on a 150 entitlement is fine', () => {
    const bookings = [markupBooking()];
    const payments = [payment()];
    const payouts = [{ id: 'po1', houseId: 'h1', ownerId: 'o1', amount: 24, status: 'completed' }] as unknown as Payout[];
    const out = findFinanceExceptions({
      bookings, payments, payouts, houses, commissionRate: 0.05, financials: markupSnapshot(),
    });
    expect(out.map((e) => e.kind)).not.toContain('paid_owner_more_than_held');
  });

  it('flags paying the owner the customer price instead of the hold', () => {
    const bookings = [markupBooking()];
    const payments = [payment()];
    const payouts = [{ id: 'po1', houseId: 'h1', ownerId: 'o1', amount: 180, status: 'completed' }] as unknown as Payout[];
    const out = findFinanceExceptions({
      bookings, payments, payouts, houses, commissionRate: 0.05, financials: markupSnapshot(),
    });
    const bad = out.find((e) => e.kind === 'paid_owner_more_than_held');
    expect(bad?.amount).toBe(156);
  });
});
