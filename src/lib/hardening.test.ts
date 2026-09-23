import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Booking, Payment, Payout } from '../types';
import { DEFAULT_PLATFORM_SETTINGS } from '../types';
import {
  customerDeposit, quotableDepositRate, transferableOf,
  indexByBooking, mapAdminFinancials, mapCustomerFinancials,
} from './bookingFinancials';
import { summarizeFinances } from './adminFinance';
import { buildPriestQuote } from './priestQuote';

/**
 * Final pre-cutover hardening.
 *
 * Four defects, each found by executing something rather than reading it, and
 * each of a kind that no type checker or constraint would have caught: a
 * silently wrong number, a silently skipped guard, an inert control, and a
 * transfer larger than the money behind it.
 */

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8');

function booking(over: Partial<Booking> = {}): Booking {
  return {
    id: 'bk1', houseId: 'h1', userId: 'u1', userName: 'ضيف', houseName: 'بيت',
    totalPrice: 180, depositAmount: 0, depositPaid: true, status: 'approved',
    paymentStatus: 'paid_deposit', checkIn: '2026-12-01', checkOut: '2026-12-02',
    guestsCount: 1, ...over,
  } as unknown as Booking;
}

// ── §3 The 15% failure mode ───────────────────────────────────────────────
describe('the deposit rate is never guessed', () => {
  it('treats the local default as NOT authoritative', () => {
    // platform_settings still holds 0.15 and it is what loadPlatformSettings
    // starts from. Nothing may quote from it.
    expect(DEFAULT_PLATFORM_SETTINGS.depositRate).toBe(0.15);
    expect(DEFAULT_PLATFORM_SETTINGS.depositRateIsAuthoritative).toBe(false);
    expect(quotableDepositRate(DEFAULT_PLATFORM_SETTINGS)).toBeNull();
  });

  it('offers the rate only once the financial core has confirmed it', () => {
    expect(quotableDepositRate({ depositRate: 0.30, depositRateIsAuthoritative: true })).toBe(0.30);
  });

  it('reports an unknown deposit rather than 15% of the stay', () => {
    const b = booking({ totalPrice: 1000, depositAmount: 0 });
    expect(customerDeposit(b, undefined, null)).toEqual({ value: null, source: 'unknown' });
    // The number this replaces:
    expect(Math.round(1000 * 0.15)).toBe(150);
  });

  it('still answers from the stored figure, whatever the rate is doing', () => {
    // A pre-core booking carries its own deposit. That number came from
    // somewhere real and is unaffected by a settings outage.
    const legacyRow = booking({ totalPrice: 1000, depositAmount: 150 });
    expect(customerDeposit(legacyRow, undefined, null)).toEqual({ value: 150, source: 'legacy' });
  });

  it('prefers the snapshot over any rate at all', () => {
    const fin = mapCustomerFinancials({
      booking_id: 'bk1', house_id: 'h1', final_price: '150.00',
      deposit_amount: '50.00', arrival_balance_external: '100.00',
    });
    expect(customerDeposit(booking(), fin, null).value).toBe(50);
    expect(customerDeposit(booking(), fin, 0.30).value).toBe(50);
  });

  it('loadPlatformSettings sets the flag from the overlay, not from the table', () => {
    const db = read('src', 'lib', 'db.ts');
    expect(db).toContain('depositRateIsAuthoritative: fin.depositRate != null');
    // The mapper alone can never establish it.
    expect(db).toMatch(/depositRateIsAuthoritative: false,[\s\S]{0,200}deposit_rate/);
  });

  it('leaves no screen quoting an unguarded rate', () => {
    expect(read('src', 'components', 'HouseDetail.tsx')).toContain('quotableRate === null ? null');
    expect(read('src', 'components', 'UserBookings.tsx')).toContain('quotableDepositRate(settings)');
  });
});

// ── §1 The 0156 x 0157 interaction ────────────────────────────────────────
describe('0157 guards 0156 backfill against borrowing the owner identity', () => {
  const m = read('supabase', 'migrations', '0157_booking_on_behalf.sql');

  it('keys the guard on source AND self-authorship, not on created_by alone', () => {
    // created_by <> user_id is the obvious test and it is WRONG: on a walk-in
    // both are the owner, so it never fires.
    expect(m).toContain("NEW.source IN ('manual', 'temporary')");
    expect(m).toContain('NEW.created_by IS NOT DISTINCT FROM NEW.user_id');
  });

  it('does not disable the backfill for guest or registered-guest bookings', () => {
    // Both extra clauses must be present, or the guard is too broad.
    const guard = m.slice(m.indexOf('ADDED BY 0157'), m.indexOf('Only ever fills a gap'));
    expect(guard).toContain('NEW.source IN');
    expect(guard).toContain('NEW.created_by IS NOT NULL');
    expect(guard).toContain('IS NOT DISTINCT FROM');
  });

  it('replaces the function only after the column it depends on exists', () => {
    expect(m.indexOf('ADD COLUMN IF NOT EXISTS created_by'))
      .toBeLessThan(m.indexOf('CREATE OR REPLACE FUNCTION public.bookings_backfill_identity'));
  });
});

// ── §2 Preconditions ──────────────────────────────────────────────────────
describe('0157 refuses to install against an incomplete database', () => {
  const m = read('supabase', 'migrations', '0157_booking_on_behalf.sql');

  it.each(['fin_price_booking', 'booking_idempotency', 'settlement_holds',
           'booking_financials', 'is_admin', 'bookings_backfill_identity'])(
    'checks for %s', (obj) => {
      const pre = m.slice(m.indexOf('DO $pre$'), m.indexOf('$pre$;') + 6);
      expect(pre).toContain(obj);
    });

  it('names the migration to apply first and aborts before any DDL', () => {
    const pre = m.slice(0, m.indexOf('$pre$;'));
    expect(pre).toContain('apply 0153 first');
    expect(pre).toContain('apply 0156 first');
    expect(pre).toContain('PRECONDITIONS FAILED for 0157');
    // Nothing may be created above the precondition block.
    expect(pre).not.toMatch(/^ALTER TABLE|^CREATE (TABLE|INDEX|TRIGGER)/m);
  });
});

// ── §6 No payout may exceed the cash behind it ────────────────────────────
describe('transferableOf caps a payout at cash actually banked', () => {
  const fin = indexByBooking([mapAdminFinancials({
    booking_id: 'bk1', house_id: 'h1', owner_id: 'o1', model_type: 'MARKUP',
    retail_price: '180.00', final_price: '180.00', deposit_amount: '54.00',
    arrival_balance_external: '126.00', owner_entitlement: '150.00',
    owner_cash_held: '24.00', owner_cash_payable: '24.00', pima_gross_margin: '30.00',
  })]);

  it('offers the full hold when the deposit arrived in full', () => {
    expect(transferableOf(booking(), fin.bk1, 0.05, 54).value).toBe(24);
  });

  it('offers only what arrived when the deposit was underpaid', () => {
    // The booking reads deposit-paid on a 10 EGP payment, and the contractual
    // payable is 24. Transferring 24 would send money Pima never received.
    expect(transferableOf(booking(), fin.bk1, 0.05, 10).value).toBe(10);
  });

  it('offers nothing when no money arrived at all', () => {
    expect(transferableOf(booking(), fin.bk1, 0.05, 0).value).toBe(0);
  });

  it('never goes negative', () => {
    expect(transferableOf(booking({ depositPaid: false }), fin.bk1, 0.05, 0).value).toBe(0);
  });

  it('caps the admin liability figure too, so the page and the button agree', () => {
    const payments = [{
      id: 'p1', bookingId: 'bk1', amount: 10, paymentStatus: 'approved',
      paymentMethod: 'instapay', paymentDate: '2026-09-01T10:00:00Z',
    }] as unknown as Payment[];
    const s = summarizeFinances({
      bookings: [booking()], payments, payouts: [] as Payout[],
      houses: [{ id: 'h1', name: 'بيت', ownerId: 'o1' }],
      users: [{ id: 'o1', name: 'مالك' }],
      commissionRate: 0.05, financials: fin, window: null, platformCollects: true,
    });
    expect(s.ownersOwed).toBe(10);
    expect(s.ownersOwed).not.toBe(24);
    expect(s.perOwner[0].owed).toBe(s.ownersOwed);
  });

  it('is what the admin settle list actually calls', () => {
    const ad = read('src', 'components', 'AdminDashboard.tsx');
    expect(ad).toContain('transferableOf(b, financials[b.id], settings.commissionRate, approvedTotalFor(b.id, payments))');
  });
});

// ── §4 The printed priest quote ───────────────────────────────────────────
describe('the priest quote prints the deposit that will be charged', () => {
  const base = {
    house: {
      id: 'h1', name: 'بيت', governorate: 'الإسكندرية', pricePerNightPerPerson: 150,
      propertyType: 'conference', seasonalRates: [],
    },
    checkIn: '2026-12-01', checkOut: '2026-12-02', guestsCount: 2, withMeals: false,
    settings: { ...DEFAULT_PLATFORM_SETTINGS, depositRate: 0.30 },
    servant: { name: 'خادم' },
    today: new Date(2026, 10, 1),
  } as unknown as Parameters<typeof buildPriestQuote>[0];

  it('uses the server figures when a quote was fetched', () => {
    // PD-16 lifted this deposit to the margin floor: 50, not 30% of 150.
    const q = buildPriestQuote({ ...base, authoritative: { total: 150, deposit: 50 } });
    expect(q.total).toBe(150);
    expect(q.depositDue).toBe(50);
    expect(q.balanceAtArrival).toBe(100);
    // What the sheet used to print instead:
    expect(Math.round(150 * 0.30)).toBe(45);
  });

  it('keeps the column adding up when the agreement moves the total', () => {
    const q = buildPriestQuote({ ...base, authoritative: { total: 360, deposit: 108 } });
    expect(q.total).toBe(360);
    const summed = q.lines.reduce((s, l) => s + l.amount, 0);
    expect(summed).toBe(360);
    expect(q.lines.some((l) => l.label === 'تعديل حسب الاتفاق التجاري')).toBe(true);
  });

  it('adds no adjustment line when the totals already agree', () => {
    const local = buildPriestQuote(base);
    const q = buildPriestQuote({ ...base, authoritative: { total: local.total, deposit: 90 } });
    expect(q.lines.some((l) => l.label === 'تعديل حسب الاتفاق التجاري')).toBe(false);
    expect(q.depositDue).toBe(90);
  });

  it('refuses to invent a deposit when no quote could be fetched', () => {
    // It used to print `total x settings.depositRate`. That is the legacy
    // 0.15 whenever the fin_client_settings() overlay failed, and wrong even
    // when the rate is right, because PD-16 can lift the real deposit above
    // it. This sheet gets handed to a priest, so an unknown deposit is
    // printed as unknown rather than guessed.
    const q = buildPriestQuote(base);
    expect(q.depositDue).toBeNull();
    expect(q.balanceAtArrival).toBeNull();
    // The number it would have invented, and the one the settings rate implies:
    expect(Math.round(q.total * 0.30)).toBeGreaterThan(0);
  });

  it('leaves the cancellation ladder unpriced too, but keeps its dates', () => {
    // A refund of an unknown deposit is not a number either — printing one
    // would be the same invention by another route. The DATES are still true
    // and still useful, so they stay.
    const q = buildPriestQuote(base);
    expect(q.cancellation).toHaveLength(3);
    expect(q.cancellation[0].refund).toBeNull();
    expect(q.cancellation[1].refund).toBeNull();
    // Nothing comes back at the last rung whatever the deposit turns out to
    // be, so that promise is true without knowing the figure.
    expect(q.cancellation[2].refund).toBe(0);
    expect(q.cancellation.every((c) => !!c.when)).toBe(true);
  });

  it('prints neutral wording on the sheet instead of a figure', () => {
    // The HTML is assembled inside printPriestQuote and not exported, so the
    // rendering contract is asserted on the source rather than by refactoring
    // a print path this change has no other reason to touch.
    const src = read('src', 'lib', 'priestQuote.ts');
    expect(src).toContain("const PENDING = 'يتأكد عند الحجز'");
    expect(src).toContain('q.depositDue === null ? PENDING : money(q.depositDue)');
    expect(src).toContain('q.balanceAtArrival === null ? PENDING : money(q.balanceAtArrival)');
    expect(src).toContain('c.refund === null ? PENDING : money(c.refund)');
    expect(src).toContain('السعر النهائي وقيمة العربون بيتأكدوا عند الحجز');
    // And the arithmetic that used to invent the figure is gone entirely.
    expect(src).not.toContain('total * settings.depositRate');
  });

  it('refunds the deposit that was actually quoted, not a recomputed one', () => {
    const q = buildPriestQuote({ ...base, authoritative: { total: 150, deposit: 50 } });
    expect(q.cancellation[0].refund).toBe(50);
  });
});

// ── §5 The admin economy panel ────────────────────────────────────────────
describe('the admin panel no longer offers controls that do nothing', () => {
  const ad = read('src', 'components', 'AdminDashboard.tsx');
  const panel = ad.slice(ad.indexOf('سياسات المنصة الافتراضية'), ad.indexOf('setting-'));

  it.each(['commissionRate', 'depositRate', 'maxRedemptionPct', 'pointsPerEgp'])(
    'no longer edits %s, which the financial core now owns', (key) => {
      expect(panel).not.toContain(`key: '${key}'`);
    });

  it('keeps the fields platform_settings genuinely still owns', () => {
    for (const key of ['freeCancelDays', 'partialRefundDays', 'partialRefundPct',
                       'referralBonusPoints', 'maxBookingsPerDay']) {
      expect(panel).toContain(`key: '${key}'`);
    }
  });

  it('drops the claim that edits apply immediately to prices', () => {
    expect(ad).not.toContain('التحكم في اقتصاد المنصة — يُطبَّق فوراً على الحسابات والأسعار');
  });

  it('says where those numbers come from instead of leaving a silent gap', () => {
    expect(panel).toContain('النواة المالية');
  });
});
