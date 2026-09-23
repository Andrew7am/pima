import { describe, it, expect } from 'vitest';
import type { Booking } from '../types';
import {
  ownerArrivalBalance, ownerEntitlement, ownerHold, ownerPayable, ownerReceivable,
  depositToPima, entitlementOf, payableOf, legacyOwnerEntitlement,
  customerDeposit, customerFinalPrice, customerArrivalBalance,
  depositSnapshot, holdState, sumMoney, indexByBooking,
  mapOwnerFinancials, mapCustomerFinancials, mapAdminFinancials,
  type OwnerFinancials, type CustomerFinancials,
} from './bookingFinancials';

/**
 * The three agreement models, priced end to end.
 *
 * Every case here is a booking Pima could take tomorrow, and the assertion
 * that matters is the same in all three: what the OWNER is paid must come
 * from the owner's own fields, never from the customer's price. Under MARKUP
 * those two differ by 30 on a 180 booking, and the old formula could not tell
 * them apart.
 */

function booking(): Booking {
  return {
    id: 'bk1', totalPrice: 180, depositAmount: 0, depositPaid: true,
    status: 'approved', checkIn: '2026-10-01', checkOut: '2026-10-02',
  } as Booking;
}
function withOver(over: Partial<Booking>): Booking {
  return { ...booking(), ...over } as Booking;
}

/** Build an owner snapshot the way the database would, from the same identity. */
function ownerFin(over: Partial<OwnerFinancials> & { finalPrice: number; ownerEntitlement: number; depositAmount: number }): OwnerFinancials {
  const arrival = over.finalPrice - over.depositAmount;
  const held = Math.max(0, over.ownerEntitlement - arrival);
  const row: OwnerFinancials = {
    bookingId: 'bk1', houseId: 'h1', currency: 'EGP',
    finalPrice: over.finalPrice,
    ownerEntitlement: over.ownerEntitlement,
    ownerCashHeld: held,
    ownerSettledAmount: 0,
    ownerCashPayable: held,
    ownerReceivableOutstanding: Math.max(0, arrival - over.ownerEntitlement),
    ownerReceivableStatuses: null,
    settlementHoldStatus: 'HELD',
    settlementHoldUntil: null,
    settlementReleasedAt: null,
    ownerCashReleaseDate: null,
    arrivalBalanceExternal: arrival,
    policyFreeCancelDays: 7, policyPartialRefundDays: 3, policyPartialRefundPct: 0.5,
    ...over,
  };
  // The owner view genuinely has no deposit_amount column, so the fixture
  // must not have one either — otherwise depositSnapshot takes the direct
  // branch in tests and its derivation is never exercised.
  delete (row as Partial<OwnerFinancials> & { depositAmount?: number }).depositAmount;
  return row;
}

// ── MARKUP: listed 150, markup 20% ─────────────────────────────────────────
describe('MARKUP — listed 150, markup 20%, retail 180, entitlement 150', () => {
  const fin = ownerFin({ finalPrice: 180, ownerEntitlement: 150, depositAmount: 54 });
  const b = booking();

  it('tells the guest to pay 126 at the door, not 180', () => {
    expect(ownerArrivalBalance(b, fin)).toEqual({ value: 126, source: 'core' });
  });

  it('entitles the house to 150', () => {
    expect(ownerEntitlement(fin)).toEqual({ value: 150, source: 'core' });
  });

  it('holds 24 for settlement — the entitlement Pima has not already handed over', () => {
    expect(ownerHold(fin)).toEqual({ value: 24, source: 'core' });
    expect(ownerPayable(fin)).toEqual({ value: 24, source: 'core' });
  });

  it('records the 54 the guest owes Pima', () => {
    expect(depositToPima(fin)).toEqual({ value: 54, source: 'core' });
  });

  // The whole point of this phase. 180 is the customer's price and 126 is the
  // guest's remaining balance; neither is money owed to the house by Pima.
  it('NEVER pays the owner the retail price, and never the arrival balance', () => {
    const payable = payableOf(b, fin, 0.05).value;
    expect(payable).not.toBe(180);
    expect(payable).not.toBe(126);
    expect(payable).toBe(24);
  });

  it('leaves Pima exactly its margin: deposit 54 less the 24 it must forward', () => {
    expect(54 - (ownerPayable(fin).value ?? 0)).toBe(180 - 150);
  });
});

// ── COMMISSION: listed 150, 5% ─────────────────────────────────────────────
describe('COMMISSION — listed 150, commission 5%, retail 150, entitlement 142.50', () => {
  const fin = ownerFin({ finalPrice: 150, ownerEntitlement: 142.5, depositAmount: 45 });

  it('charges the guest the listed price', () => {
    expect(fin.finalPrice).toBe(150);
  });

  it('entitles the house to 142.50', () => {
    expect(ownerEntitlement(fin)).toEqual({ value: 142.5, source: 'core' });
  });

  it('pays from the hold, not from a rate on the booking value', () => {
    // arrival 105, so Pima must still forward 142.50 - 105 = 37.50
    expect(ownerPayable(fin)).toEqual({ value: 37.5, source: 'core' });
    expect(45 - 37.5).toBeCloseTo(150 * 0.05, 10);
  });
});

// ── NET_RATE: listed 150, net rate 100 ─────────────────────────────────────
describe('NET_RATE — listed 150, net 100, entitlement 100', () => {
  // PD-16: deposit = GREATEST(round(0.30 x 150), 150 - 100) = 50, the margin floor.
  const fin = ownerFin({ finalPrice: 150, ownerEntitlement: 100, depositAmount: 50 });

  it('entitles the house to the net rate, not the listed price', () => {
    expect(ownerEntitlement(fin)).toEqual({ value: 100, source: 'core' });
    expect(ownerEntitlement(fin).value).not.toBe(150);
  });

  it('holds nothing: the house already collects its whole entitlement at the door', () => {
    expect(ownerArrivalBalance(booking(), fin)).toEqual({ value: 100, source: 'core' });
    expect(ownerHold(fin)).toEqual({ value: 0, source: 'core' });
    expect(payableOf(booking(), fin, 0.05).value).toBe(0);
  });

  it('never pays the owner the retail price', () => {
    expect(payableOf(booking(), fin, 0.05).value).not.toBe(150);
  });

  // Without the margin floor the deposit would be 45, the house would collect
  // 105 at the door against a 100 entitlement, and owe Pima the 5 back.
  it('turns an over-collection at the door into a receivable, not a payout', () => {
    const thin = ownerFin({ finalPrice: 150, ownerEntitlement: 100, depositAmount: 45 });
    expect(ownerHold(thin).value).toBe(0);
    expect(ownerReceivable(thin)).toEqual({ value: 5, source: 'core' });
  });
});

// ── The guard that survives from the legacy code ───────────────────────────
describe('arrival balance when the deposit never arrived', () => {
  const fin = ownerFin({ finalPrice: 180, ownerEntitlement: 150, depositAmount: 54 });

  it('asks for the whole price at the door', () => {
    const unpaid = withOver({ depositPaid: false });
    expect(ownerArrivalBalance(unpaid, fin)).toEqual({ value: 180, source: 'core' });
  });

  it('offers nothing transferable until the guest has actually paid', () => {
    expect(payableOf(withOver({ depositPaid: false }), fin, 0.05).value).toBe(0);
  });
});

// ── No snapshot: the pre-core era ──────────────────────────────────────────
describe('a booking with no financial snapshot', () => {
  const b = withOver({ totalPrice: 1000, depositAmount: 150, commissionRate: 0.05 });

  it('reports the entitlement as unknown rather than guessing', () => {
    expect(ownerEntitlement(undefined)).toEqual({ value: null, source: 'unknown' });
    expect(ownerHold(undefined).value).toBeNull();
    expect(ownerPayable(undefined).value).toBeNull();
  });

  it('falls back to the commission-era formula, and labels it legacy', () => {
    expect(entitlementOf(b, undefined, 0.07)).toEqual({ value: 950, source: 'legacy' });
    expect(payableOf(b, undefined, 0.07)).toEqual({ value: 100, source: 'legacy' });
  });

  it('honours the rate stamped on the booking, not the current platform rate', () => {
    expect(legacyOwnerEntitlement(b, 0.20).value).toBe(950);
  });
});

// ── Unknowns must not become zeros ─────────────────────────────────────────
describe('sumMoney', () => {
  it('adds what it can and counts what it cannot', () => {
    const got = sumMoney([
      { value: 24, source: 'core' },
      { value: null, source: 'unknown' },
      { value: 100, source: 'legacy' },
    ]);
    expect(got).toEqual({ total: 124, unknown: 1, legacy: 1 });
  });

  it('does not silently report a total of 0 for an all-unknown set', () => {
    expect(sumMoney([{ value: null, source: 'unknown' }])).toEqual({ total: 0, unknown: 1, legacy: 0 });
  });
});

// ── Customer side ──────────────────────────────────────────────────────────
describe('customer figures', () => {
  const fin: CustomerFinancials = {
    bookingId: 'bk1', houseId: 'h1', currency: 'EGP',
    retailPrice: 180, promoDiscount: 0, pointsDiscount: 0, pointsRedeemed: 0,
    finalPrice: 180, depositAmount: 54, depositReceived: 54, depositRemaining: 0,
    arrivalBalanceExternal: 126, refundPayable: 0,
    policyFreeCancelDays: 7, policyPartialRefundDays: 3, policyPartialRefundPct: 0.5,
  };

  it('shows total 180, deposit 54, remaining 126 — all from the stored snapshot', () => {
    expect(customerFinalPrice(booking(), fin).value).toBe(180);
    expect(customerDeposit(booking(), fin, 0.30).value).toBe(54);
    expect(customerArrivalBalance(booking(), fin).value).toBe(126);
  });

  // The margin floor is exactly the case where the rate and the charge differ.
  it('shows the stored deposit even when it is not the headline rate', () => {
    const floored = { ...fin, finalPrice: 150, depositAmount: 50, arrivalBalanceExternal: 100 };
    const b = withOver({ totalPrice: 150 });
    expect(customerDeposit(b, floored, 0.30).value).toBe(50);
    // What the screen used to print instead:
    expect(Math.round(150 * 0.30)).toBe(45);
  });

  it('falls back to the rate only when there is no snapshot', () => {
    const b = withOver({ totalPrice: 1000, depositAmount: 0 });
    expect(customerDeposit(b, undefined, 0.30)).toEqual({ value: 300, source: 'legacy' });
  });

  it('never leaks an owner field into the customer shape', () => {
    expect(Object.keys(fin)).not.toContain('ownerEntitlement');
    expect(Object.keys(fin)).not.toContain('ownerCashPayable');
    expect(Object.keys(fin)).not.toContain('pimaGrossMargin');
  });
});

// ── The deposit identity the owner view relies on ──────────────────────────
describe('depositSnapshot', () => {
  it('recovers the deposit from an owner row, which does not carry one', () => {
    const fin = ownerFin({ finalPrice: 180, ownerEntitlement: 150, depositAmount: 54 });
    expect('depositAmount' in fin).toBe(false);
    expect(depositSnapshot(fin)).toEqual({ depositAmount: 54 });
  });

  it('is undefined with no snapshot, so callers fall back rather than read 0', () => {
    expect(depositSnapshot(undefined)).toBeUndefined();
  });
});

describe('holdState', () => {
  it('reads the settlement status, and says unknown without a snapshot', () => {
    expect(holdState(ownerFin({ finalPrice: 180, ownerEntitlement: 150, depositAmount: 54 }))).toBe('held');
    expect(holdState(undefined)).toBe('unknown');
  });
});

// ── Mappers ────────────────────────────────────────────────────────────────
describe('row mappers', () => {
  it('reads numerics that arrive as strings, as postgres numeric does', () => {
    const row = mapOwnerFinancials({
      booking_id: 'bk1', house_id: 'h1', currency: 'EGP',
      final_price: '180.00', owner_entitlement: '150.00', owner_cash_held: '24.00',
      owner_settled_amount: null, owner_cash_payable: '24.00',
      owner_receivable_outstanding: null, arrival_balance_external: '126.00',
      settlement_hold_status: 'HELD',
    });
    expect(row.finalPrice).toBe(180);
    expect(row.ownerEntitlement).toBe(150);
    expect(row.ownerSettledAmount).toBe(0);
    expect(row.ownerCashPayable).toBe(24);
  });

  it('keeps the admin margin fields, which the other two views never carry', () => {
    const row = mapAdminFinancials({
      booking_id: 'bk1', model_type: 'MARKUP', retail_price: '180.00',
      owner_entitlement: '150.00', pima_gross_margin: '30.00',
      assumed_transfer_fee: '0.54', projected_net_margin: '29.46',
      margin_warning: false, override_required: false, commission_rate: null,
      final_price: '180.00', arrival_balance_external: '126.00',
    });
    expect(row.modelType).toBe('MARKUP');
    expect(row.pimaGrossMargin).toBe(30);
    expect(row.projectedNetMargin).toBe(29.46);
    expect(row.commissionRate).toBeNull();
  });

  it('indexes by booking id so a missing booking reads as no snapshot', () => {
    const idx = indexByBooking([mapCustomerFinancials({ booking_id: 'bk1', house_id: 'h1' })]);
    expect(idx.bk1).toBeDefined();
    expect(idx.bk_other).toBeUndefined();
  });
});
