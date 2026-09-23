import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Booking } from '../types';
import {
  depositPercentOf, customerDeposit, mapCustomerFinancials,
} from './bookingFinancials';
import { freshBookingId, newIdempotencyKey } from './idempotency';
import { buildPriestQuote } from './priestQuote';
import type { PlatformSettings, RetreatHouse, User } from '../types';

/**
 * POST-CUTOVER P2 HARDENING.
 *
 * Four defects of the same family as the pre-cutover set: a number that
 * contradicts the number printed beside it, a figure invented for a document
 * a priest signs, a refusal that could only ever repeat itself, and a legacy
 * rate still reachable after a payment is confirmed.
 */

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8');

function booking(over: Partial<Booking> = {}): Booking {
  return {
    id: 'bk1', houseId: 'h1', userId: 'u1', userName: 'ضيف', houseName: 'بيت',
    totalPrice: 560, depositAmount: 0, depositPaid: true, status: 'approved',
    paymentStatus: 'paid_deposit', checkIn: '2026-12-01', checkOut: '2026-12-02',
    guestsCount: 2, ...over,
  } as unknown as Booking;
}

// ── P2-1 The percentage describes the booking, not the settings ───────────
describe('the deposit percentage cannot contradict the amount beside it', () => {
  it('derives 30% from a 30% booking', () => {
    expect(depositPercentOf(168, 560)).toBe(30);
  });

  it('reports the margin-floor share honestly rather than the headline rate', () => {
    // PD-16 lifted this deposit to the margin floor: 50 on a 150 stay. The
    // old label read settings.depositRate and said 30% beside an amount that
    // is not 30% of anything.
    expect(depositPercentOf(50, 150)).toBe(33);
    expect(depositPercentOf(50, 150)).not.toBe(30);
  });

  it('gives no percentage when the financial snapshot is missing', () => {
    // customerDeposit returns unknown, the screen turns that into 0, and 0 is
    // not a deposit — so there is nothing honest to take a percentage of.
    expect(depositPercentOf(0, 560)).toBeNull();
    expect(depositPercentOf(null, 560)).toBeNull();
    expect(depositPercentOf(168, null)).toBeNull();
    expect(depositPercentOf(168, 0)).toBeNull();
  });

  it('gives no percentage for a deposit larger than the total', () => {
    expect(depositPercentOf(600, 560)).toBeNull();
  });

  it('is what the screen calls, and the legacy rate is gone from all three sites', () => {
    const ub = read('src', 'components', 'UserBookings.tsx');
    expect(ub).toContain('depositPercentOf(depositDueFor(b) || null, totalFor(b) || null)');
    expect(ub).not.toContain('arabicPercent(Math.round(settings.depositRate * 100))');
  });

  it('leaves the AMOUNT logic untouched — it still comes from the snapshot', () => {
    const fin = mapCustomerFinancials({
      booking_id: 'bk1', house_id: 'h1', final_price: '150.00',
      deposit_amount: '50.00', arrival_balance_external: '100.00',
    });
    expect(customerDeposit(booking(), fin, null).value).toBe(50);
    // and an unknown rate still yields an unknown deposit, not 15%
    expect(customerDeposit(booking(), undefined, null)).toEqual({ value: null, source: 'unknown' });
  });
});

// ── P2-2 The printed sheet invents nothing ────────────────────────────────
describe('the priest sheet prints an unknown deposit as unknown', () => {
  const SETTINGS = {
    depositRate: 0.15, freeCancelDays: 14, partialRefundDays: 7, partialRefundPct: 0.5,
  } as PlatformSettings;
  const base = {
    house: {
      id: 'h1', name: 'بيت النور', governorate: 'الإسكندرية',
      pricePerNightPerPerson: 100, seasonalRates: [],
    } as unknown as RetreatHouse,
    checkIn: '2026-09-10', checkOut: '2026-09-13', guestsCount: 40,
    withMeals: false, settings: SETTINGS,
    servant: { name: 'مينا' } as User,
  };

  it('returns null rather than total x depositRate', () => {
    const q = buildPriestQuote(base);
    expect(q.depositDue).toBeNull();
    expect(q.balanceAtArrival).toBeNull();
    // The figure it used to print, and would have been wrong twice over.
    expect(Math.round(q.total * SETTINGS.depositRate)).toBe(1800);
  });

  it('still prices the stay itself — only the deposit is withheld', () => {
    const q = buildPriestQuote(base);
    expect(q.total).toBe(12000);
    expect(q.perHead).toBe(300);
  });

  it('uses the server pair when it has one', () => {
    const q = buildPriestQuote({ ...base, authoritative: { total: 12000, deposit: 3600 } });
    expect(q.depositDue).toBe(3600);
    expect(q.balanceAtArrival).toBe(8400);
    expect(q.cancellation[0].refund).toBe(3600);
    expect(q.cancellation[1].refund).toBe(1800);
  });
});

// ── P2-3 A collision is not retried with the id that collided ─────────────
describe('BOOKING_ID_TAKEN is recognised and the stale id discarded', () => {
  const db = read('src', 'lib', 'db.ts');
  const hd = read('src', 'components', 'HouseDetail.tsx');

  it('is mapped to its own code instead of the generic failure', () => {
    expect(db).toContain("pick('BOOKING_ID_TAKEN'");
  });

  it('travels to the screen as a code, not merely as false', () => {
    expect(read('src', 'App.tsx')).toContain('return { ok: false, code: res.code };');
  });

  it('mints a fresh booking id and KEEPS the idempotency key', () => {
    // Keeping the key is what preserves the server contract: if the first
    // attempt did commit, the retry returns THAT booking rather than making a
    // second one. A new key would make the retry a new booking.
    expect(hd).toContain("code === 'BOOKING_ID_TAKEN'");
    expect(hd).toContain('bookingId: freshBookingId(attemptRef.current.bookingId)');
    expect(hd).toContain('idempotencyKey: attemptRef.current.idempotencyKey');
  });

  it('never hands back the id it was just told was taken', () => {
    // Same millisecond: a plain `book_${Date.now()}` would return the very id
    // the server refused, and the retry would fail identically for ever.
    const taken = 'book_' + Date.now();
    for (let i = 0; i < 50; i += 1) expect(freshBookingId(taken)).not.toBe(taken);
  });

  it('keeps the ordinary id shape when there is no collision to dodge', () => {
    expect(freshBookingId('book_1')).toMatch(/^book_\d+$/);
  });

  it('regenerates on that code alone, so other refusals stay retries', () => {
    // A capacity refusal must keep BOTH the id and the key, or the next press
    // becomes a second booking instead of a retry.
    const from = hd.indexOf('const detail =');
    const to = hd.indexOf('setSubmitting(false)', from);
    const guard = hd.slice(from, to);
    expect(guard).toContain('if (outcome) attemptRef.current = null;');
    expect(guard.match(/attemptRef\.current = \{/g) || []).toHaveLength(1);
  });

  it('does not weaken the key itself', () => {
    const a = newIdempotencyKey();
    const b = newIdempotencyKey();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(15);
  });
});

// ── P2-4 No legacy rate after a cash deposit is confirmed ─────────────────
describe('the post-payment deposit is never derived from the legacy rate', () => {
  const app = read('src', 'App.tsx');

  it('drops the rate fallback entirely', () => {
    expect(app).not.toContain('Math.round(target.totalPrice * settings.depositRate)');
  });

  it('prefers the snapshot, then a stored figure, then nothing', () => {
    expect(app).toContain('const depositAmount: number | null = finForDeposit');
    expect(app).toContain('target && target.depositAmount > 0 ? target.depositAmount : null');
  });

  it('does not overwrite a stored deposit with an unknown one', () => {
    expect(app).toContain('...(depositAmount === null ? {} : { depositAmount })');
  });
});

// ── P3-4 Owner-path refusals reach the owner in words ─────────────────────
describe('owner-path RPC refusals are surfaced, not swallowed', () => {
  const db = read('src', 'lib', 'db.ts');
  const owner = db.slice(db.indexOf('function ownerBookingRpcError'));

  it.each([
    ['POINTS_REQUIRE_REGISTERED_GUEST', 'النقاط تتخصم بس لضيف عنده حساب على بيما.'],
    ['IDEMPOTENCY_CONFLICT', 'الطلب ده اتبعت قبل كده ببيانات مختلفة.'],
    ['BOOKING_ID_TAKEN', 'رقم الحجز ده مستعمل.'],
    ['NOT_AUTHORIZED_FOR_HOUSE', 'مش مسموح لك تسجّل حجز على البيت ده.'],
    ['NO_AGREEMENT', 'اطلب الاتفاق الأول'],
    ['OVERRIDE_REQUIRED', 'محتاج موافقة الإدارة.'],
  ])('%s reaches the owner in words', (code, arabic) => {
    expect(owner).toContain(code);
    expect(owner).toContain(arabic);
  });

  it('returns ok:false on any RPC error rather than a quiet success', () => {
    const fn = db.slice(db.indexOf('export async function createBookingOnBehalf'),
      db.indexOf('function ownerBookingRpcError'));
    expect(fn).toContain('return { ok: false, error: ownerBookingRpcError(');
  });
});

// ── P3-4 The quote both screens show is the one the booking is priced at ──
describe('fin_quote_booking wiring', () => {
  const db = read('src', 'lib', 'db.ts');
  const hd = read('src', 'components', 'HouseDetail.tsx');
  const owner = read('src', 'components', 'owner', 'OwnerDashboardShell.tsx');

  it('is fetched through the RPC, not computed locally', () => {
    expect(db).toContain("supabase.rpc('fin_quote_booking'");
  });

  it('is what the guest screen displays when it has one', () => {
    expect(hd).toContain('const totalPrice = quote ? quote.finalPrice : localTotalPrice;');
    expect(hd).toContain('? quote.depositAmount');
  });

  it('is what the owner form displays, and it refuses to guess without one', () => {
    expect(owner).toContain('await loadBookingQuote({');
    expect(owner).toContain('اتأكد إن البيت عنده اتفاق تجاري ساري');
  });

  it('is handed to the printed sheet as a PAIR, so the sheet adds up', () => {
    expect(hd).toContain('authoritative: quote ? { total: quote.finalPrice, deposit: quote.depositAmount } : undefined');
  });

  it('carries no price into the booking call — the server prices it', () => {
    const start = db.indexOf("supabase.rpc('create_booking_with_financials'");
    const call = db.slice(start, db.indexOf('if (error) {', start));
    for (const forbidden of ['p_price', 'p_total', 'p_deposit', 'p_commission', 'p_markup']) {
      expect(call).not.toContain(forbidden);
    }
  });

  it('carries no price into the on-behalf call either', () => {
    const start = db.indexOf("supabase.rpc('create_booking_on_behalf_with_financials'");
    const call = db.slice(start, db.indexOf('if (error) {', start));
    for (const forbidden of ['p_price', 'p_total', 'p_deposit', 'p_commission', 'p_markup', 'p_net_rate']) {
      expect(call).not.toContain(forbidden);
    }
  });
});
