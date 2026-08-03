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
