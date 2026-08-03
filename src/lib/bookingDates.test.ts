import { describe, it, expect } from 'vitest';
import { arabicDay, arabicDayYear, nightsBetween, nightsLabel, stayLabel } from './bookingDates';

describe('nightsBetween', () => {
  it('counts the nights slept, not the days touched', () => {
    expect(nightsBetween('2026-08-15', '2026-08-18')).toBe(3);
    expect(nightsBetween('2026-08-15', '2026-08-16')).toBe(1);
  });

  it('is zero for a same-day booking', () => {
    // Day use — «يوم روحي». A real product, not a broken range.
    expect(nightsBetween('2026-08-15', '2026-08-15')).toBe(0);
  });

  it('never goes negative on a reversed range', () => {
    expect(nightsBetween('2026-08-18', '2026-08-15')).toBe(0);
  });

  it('survives an unparseable date instead of returning NaN', () => {
    expect(nightsBetween('not a date', '2026-08-15')).toBe(0);
  });

  it('is not thrown off by a daylight-saving shift', () => {
    // Egypt moves the clocks; a 23- or 25-hour day must still count as one
    // night, which is why this rounds rather than floors.
    expect(nightsBetween('2026-04-23', '2026-04-25')).toBe(2);
    expect(nightsBetween('2026-10-29', '2026-10-31')).toBe(2);
  });
});

describe('nightsLabel', () => {
  it('uses the dual and the plural Arabic actually uses', () => {
    expect(nightsLabel(1)).toBe('ليلة واحدة');
    expect(nightsLabel(2)).toBe('ليلتان');
    expect(nightsLabel(3)).toBe('3 ليالٍ');
    expect(nightsLabel(10)).toBe('10 ليالٍ');
  });

  it('switches back to the singular noun above ten', () => {
    // Arabic counts 11+ with the singular: «١١ ليلة», not «١١ ليالٍ».
    expect(nightsLabel(11)).toBe('11 ليلة');
    expect(nightsLabel(30)).toBe('30 ليلة');
  });

  it('calls a zero-night booking a day, because that is what it is', () => {
    expect(nightsLabel(0)).toBe('يوم واحد');
    expect(nightsLabel(-1)).toBe('يوم واحد');
  });
});

describe('arabicDay', () => {
  it('renders in Arabic rather than ISO', () => {
    const out = arabicDay('2026-08-15');
    expect(out).not.toMatch(/2026-08-15/);
    expect(out).toMatch(/أغسطس|آب/);
  });

  it('adds the year only in the year-bearing variant', () => {
    expect(arabicDay('2026-08-15')).not.toMatch(/٢٠٢٦|2026/);
    expect(arabicDayYear('2026-08-15')).toMatch(/٢٠٢٦|2026/);
  });
});

describe('stayLabel', () => {
  it('reads as one span rather than two dates', () => {
    const out = stayLabel('2026-08-15', '2026-08-18');
    expect(out).toContain('←');
    expect(out).toContain('3 ليالٍ');
  });

  it('describes a same-day booking as a day', () => {
    expect(stayLabel('2026-08-15', '2026-08-15')).toContain('يوم واحد');
  });
});
