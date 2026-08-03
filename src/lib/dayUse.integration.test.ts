import { describe, it, expect } from 'vitest';
import { computeStayPrice, offersDayUse } from './pricing';
import { getCapacityStatus, occupiedEnd } from './roomOccupancy';
import { INITIAL_HOUSES } from '../mockData';

describe('day use, end to end through the seeded data', () => {
  const h = INITIAL_HOUSES[0];
  it('the seeded house sells a day and prices it', () => {
    expect(offersDayUse(h)).toBe(true);
    expect(computeStayPrice(h, '2026-07-15', '2026-07-15', 40).total).toBe(4800);
  });
  it('a day still consumes capacity', () => {
    const used = () => h.bedsCount; // house already full that day
    expect(getCapacityStatus({
      bedsCount: h.bedsCount, guestsCount: 1, checkIn: '2026-07-15', checkOut: '2026-07-15',
      usedBedsOnDate: used, isMonthly: false,
    })).toBe('full_on_dates');
  });
  it('occupiedEnd gives a day its own date', () => {
    expect(occupiedEnd('2026-07-15', '2026-07-15')).toBe('2026-07-16');
    expect(occupiedEnd('2026-07-15', '2026-07-18')).toBe('2026-07-18');
  });
});

describe('the browse filter', () => {
  // The matcher UserDashboard applies, in the same order and with the same
  // rule, so a filter that silently matches everything cannot pass here.
  const matches = (h: typeof INITIAL_HOUSES[number], dayUseOnly: boolean) =>
    dayUseOnly ? offersDayUse(h) : true;

  it('narrows to houses that actually sell a day', () => {
    const all = INITIAL_HOUSES.filter((h) => matches(h, false));
    const onlyDay = INITIAL_HOUSES.filter((h) => matches(h, true));
    expect(all.length).toBe(INITIAL_HOUSES.length);
    expect(onlyDay.length).toBeGreaterThan(0);
    expect(onlyDay.length).toBeLessThan(all.length);
    for (const h of onlyDay) expect(typeof h.dayUsePricePerPerson).toBe('number');
  });

  it('drops a house whose owner withdrew the offer by zeroing it', () => {
    // 0 is how the owner form clears the field — undefined would vanish from
    // pending_edit's JSON and the price could never be taken back.
    const withdrawn = { ...INITIAL_HOUSES[0], dayUsePricePerPerson: 0 };
    expect(offersDayUse(INITIAL_HOUSES[0])).toBe(true);
    expect(offersDayUse(withdrawn)).toBe(false);
  });
});

describe("the admin's pending-edit diff", () => {
  // The exact rule AdminDashboard applies for the day price. A field with no
  // entry in HOUSE_EDIT_DIFF_FIELDS is approved without ever being shown, and
  // an edit that touches only that field reports «لا توجد تغييرات» — which is
  // what an owner sees as «the admin never got it».
  const same = (a: unknown, b: unknown) => (Number(a) || 0) === (Number(b) || 0);
  const shows = (pending: unknown, live: unknown) => pending !== undefined && !same(pending, live);

  it('shows a day price being set for the first time', () => {
    expect(shows(120, undefined)).toBe(true);
  });

  it('shows a day price being changed', () => {
    expect(shows(150, 120)).toBe(true);
  });

  it('shows a day price being withdrawn', () => {
    expect(shows(0, 120)).toBe(true);
  });

  it('does NOT invent a change on a house that never had one', () => {
    // The owner form sends 0 for «not offered», so without the normalisation
    // every edit to any other field would claim the day price changed.
    expect(shows(0, undefined)).toBe(false);
    expect(shows(0, 0)).toBe(false);
    expect(shows(120, 120)).toBe(false);
  });
});
