import { describe, it, expect } from 'vitest';
import { getCapacityStatus } from './roomOccupancy';

const empty = () => 0;

function status(over: Partial<Parameters<typeof getCapacityStatus>[0]> = {}) {
  return getCapacityStatus({
    bedsCount: 20,
    guestsCount: 10,
    checkIn: '2026-08-01',
    checkOut: '2026-08-03',
    usedBedsOnDate: empty,
    ...over,
  });
}

describe('getCapacityStatus', () => {
  it('allows a booking that fits an empty house', () => {
    expect(status()).toBe('ok');
  });

  it('allows a group that exactly fills the house', () => {
    expect(status({ guestsCount: 20 })).toBe('ok');
  });

  // THE regression: the form opened with a 30-person default on a 20-bed
  // house, so an empty house rendered "join the waitlist" before the visitor
  // touched anything — and blamed the dates rather than the group size.
  it('flags a group larger than the house as exceeding it, not as fully booked', () => {
    expect(status({ guestsCount: 30, bedsCount: 20 })).toBe('exceeds_house');
  });

  it('reports dates as full only when existing bookings are what block it', () => {
    // 15 beds already taken, 10 more requested, 20 total.
    expect(status({ guestsCount: 10, usedBedsOnDate: () => 15 })).toBe('full_on_dates');
  });

  it('prefers "exceeds house" over "full on dates" when both are true', () => {
    // A waitlist can never help here, so the message must not offer one.
    expect(status({ guestsCount: 50, usedBedsOnDate: () => 15 })).toBe('exceeds_house');
  });

  it('only blocks when a night inside the stay is actually full', () => {
    // Busy the night before check-in and the check-out night — neither counts.
    const used = (d: string) => (d === '2026-07-31' || d === '2026-08-03' ? 20 : 0);
    expect(status({ usedBedsOnDate: used })).toBe('ok');
  });

  it('blocks when any single night in the middle of the stay is full', () => {
    const used = (d: string) => (d === '2026-08-02' ? 20 : 0);
    expect(status({ checkIn: '2026-08-01', checkOut: '2026-08-04', usedBedsOnDate: used })).toBe('full_on_dates');
  });

  it('treats monthly student/staff housing as always bookable', () => {
    // Contracted per person, not against a nightly bed count.
    expect(status({ guestsCount: 999, isMonthly: true })).toBe('ok');
  });

  it('does not block when dates are missing or reversed', () => {
    expect(status({ checkIn: '', checkOut: '' })).toBe('ok');
    expect(status({ checkIn: '2026-08-05', checkOut: '2026-08-01' })).toBe('ok');
  });

  // A house with no declared capacity must not silently reject everyone.
  it('does not flag anything when the house has no bed count', () => {
    expect(status({ bedsCount: 0, guestsCount: 30 })).toBe('ok');
  });
});
