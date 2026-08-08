import { describe, it, expect } from 'vitest';
import { buildPriestQuote } from './priestQuote';
import type { RetreatHouse, PlatformSettings, User } from '../types';

const SETTINGS = {
  depositRate: 0.15,
  freeCancelDays: 14,
  partialRefundDays: 7,
  partialRefundPct: 0.5,
} as PlatformSettings;

const SERVANT = { name: 'مينا', priestName: 'أبونا بيشوي', churchName: 'كنيسة مار مرقس' } as User;

const house = (over: Partial<RetreatHouse> = {}): RetreatHouse => ({
  id: 'h1', name: 'بيت النور', governorate: 'الإسكندرية',
  pricePerNightPerPerson: 100, seasonalRates: [],
  ...over,
} as RetreatHouse);

const build = (over: Partial<Parameters<typeof buildPriestQuote>[0]> = {}) =>
  buildPriestQuote({
    house: house(), checkIn: '2026-09-10', checkOut: '2026-09-13',
    guestsCount: 40, withMeals: false, settings: SETTINGS, servant: SERVANT,
    ...over,
  });

describe('buildPriestQuote', () => {
  it('prices the stay the way the booking does', () => {
    // 3 nights x 40 guests x 100 = 12,000
    const q = build();
    expect(q.nights).toBe(3);
    expect(q.total).toBe(12000);
    expect(q.perHead).toBe(300);
  });

  it('is addressed to the priest from the servant profile, so he types nothing', () => {
    const q = build();
    expect(q.priestName).toBe('أبونا بيشوي');
    expect(q.churchName).toBe('كنيسة مار مرقس');
  });

  it('shows the discount as its own line rather than a quietly smaller number', () => {
    // A priest comparing this against last year must see WHY it is cheaper.
    const q = build({ house: house({ discountPct: 0.25 }) });
    expect(q.discountPct).toBe(0.25);
    expect(q.lines[0]).toMatchObject({ label: 'الإقامة قبل الخصم', amount: 12000 });
    expect(q.lines[1]).toMatchObject({ label: 'خصم ٢٥٪'.replace('٢٥', '25'), amount: -3000 });
    expect(q.total).toBe(9000);
  });

  it('does not discount the meals, because the server does not either', () => {
    // validate_booking_price applies the discount to accommodation only. A
    // sheet that discounted meals would quote a price the database refuses.
    const withFood = house({
      discountPct: 0.5,
      menu: { isIncluded: false, extraMealPrice: 50, allowsSpecialRequests: false },
    } as Partial<RetreatHouse>);
    const q = build({ house: withFood, withMeals: true });
    const mealsLine = q.lines.find((l) => l.label === 'الوجبات');
    if (mealsLine) {
      // whatever the meal plan came to, it was not halved
      expect(mealsLine.amount).toBeGreaterThan(0);
    }
    const accommodation = q.lines[0].amount;
    expect(accommodation).toBe(12000);
  });

  it('adds the hall fee on top', () => {
    expect(build({ hallFee: 2000 }).total).toBe(14000);
  });

  it('splits the money into what is due now and what is due on arrival', () => {
    const q = build();
    expect(q.depositDue).toBe(1800);          // 15% of 12,000
    expect(q.balanceAtArrival).toBe(10200);
    expect(q.depositDue + q.balanceAtArrival).toBe(q.total);
  });

  it('writes the cancellation terms as dates and pounds, not percentages', () => {
    // The whole point: a priest should not have to count backwards from a
    // percentage in a meeting.
    const q = build();
    expect(q.cancellation).toHaveLength(3);
    expect(q.cancellation[0]).toMatchObject({ when: '2026-08-27', edge: 'until', refund: 1800 });
    expect(q.cancellation[1]).toMatchObject({ when: '2026-09-03', edge: 'until', refund: 900 });
    expect(q.cancellation[2]).toMatchObject({ when: '2026-09-03', edge: 'after', refund: 0 });
  });

  it('prices the weeks either side, which is what the priest always asks', () => {
    // Cheaper the week before, dearer the week after.
    const seasonal = house({
      seasonalRates: [
        { id: 's1', label: 'ذروة', startDate: '2026-09-08', endDate: '2026-09-30', pricePerNight: 100 },
        { id: 's2', label: 'هدوء', startDate: '2026-09-01', endDate: '2026-09-07', pricePerNight: 60 },
      ],
    });
    const q = build({ house: seasonal });
    const earlier = q.alternatives.find((a) => a.checkIn === '2026-09-03');
    expect(earlier).toBeDefined();
    expect(earlier!.delta).toBeLessThan(0);   // moving a week earlier is cheaper
  });

  it('hides an alternative week that costs exactly the same', () => {
    // A week that changes nothing is noise on a page meant to be scanned.
    const q = build();                        // flat rate, no seasons
    expect(q.alternatives).toEqual([]);
  });

  it('does not divide by zero on a quote with no guests yet', () => {
    expect(build({ guestsCount: 0 }).perHead).toBe(0);
  });
});

describe('defects an adversarial review found after this shipped', () => {
  it('says «لغاية» not «قبل», because the boundary day is still inside the band', () => {
    // getRefundTier bands with >=, so a cancellation ON the 27th still gets a
    // full refund. «قبل ٢٧ أغسطس» excluded that day and understated every rung.
    const q = build();
    expect(q.cancellation[0].edge).toBe('until');
    expect(q.cancellation[0].when).toBe('2026-08-27');
  });

  it('marks a rung whose date has passed instead of offering it', () => {
    // Printed live, it invites a priest to approve terms that no longer exist.
    const q = build({ today: new Date(2026, 8, 1) });   // 1 Sep — free window gone
    expect(q.cancellation[0].stillAvailable).toBe(false);
    expect(q.cancellation[1].stillAvailable).toBe(true);
  });

  it('subtracts the points the servant is redeeming', () => {
    // The sheet quoted the price BEFORE redemption while the guest is charged
    // after it — a budget approved too high, and a deposit that would not
    // match what the app then asked for.
    const q = build({ pointsDiscount: 2000 });
    expect(q.total).toBe(10000);
    expect(q.depositDue).toBe(1500);
    expect(q.lines.some((l) => l.label === 'خصم النقاط' && l.amount === -2000)).toBe(true);
  });

  it('never goes negative when the points exceed the price', () => {
    expect(build({ pointsDiscount: 999999 }).total).toBe(0);
  });

  it('describes a day trip as a day, not as «٠ ليالي»', () => {
    const dayHouse = house({ dayUsePricePerPerson: 80 });
    const q = build({ house: dayHouse, checkIn: '2026-09-10', checkOut: '2026-09-10' });
    expect(q.nights).toBe(0);
    expect(q.lines[0].hint).toContain('يوم واحد بدون مبيت');
    expect(q.lines[0].hint).not.toContain('٠');
    expect(q.total).toBe(3200); // 80 x 40
  });

  it('shifts dates by the calendar, so DST cannot add or drop a night', () => {
    // Africa/Cairo ends DST on 30 October. Adding 7 x 86,400,000 ms to
    // 29 October landed on the 4th of November instead of the 5th, so the
    // "one week later" row silently became three nights and was priced as
    // 50% dearer when it costs exactly the same.
    const q = build({ checkIn: '2026-10-29', checkOut: '2026-10-31' });
    const later = q.alternatives.find((a) => a.checkIn > '2026-10-31');
    if (later) {
      expect(later.checkIn).toBe('2026-11-05');
      expect(later.checkOut).toBe('2026-11-07');
    }
    // flat rate either side, so there is nothing to report at all
    expect(q.alternatives).toEqual([]);
  });

  it('keeps the ladder on real calendar days across a spring transition', () => {
    const q = build({ checkIn: '2026-04-27', checkOut: '2026-04-29' });
    expect(q.cancellation[0].when).toBe('2026-04-13'); // 14 days, not 12
    expect(q.cancellation[1].when).toBe('2026-04-20');
  });
});
