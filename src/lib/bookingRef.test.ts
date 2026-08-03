import { describe, it, expect } from 'vitest';
import { bookingRef, bookingAge, paidPercent, matchesBookingCode } from './bookingRef';

describe('matchesBookingCode', () => {
  const id = 'booking_1784292488580';

  it('accepts the reference printed on the sheet and read down the phone', () => {
    expect(matchesBookingCode(id, bookingRef(id))).toBe(true);
    expect(matchesBookingCode(id, 'pm-88580')).toBe(true);
    expect(matchesBookingCode(id, '88580')).toBe(true);
  });

  it('still accepts the six-character code older sheets carry', () => {
    // The scanner was the only reader of this form. Sheets already printed
    // and sitting in a folder have to keep working.
    expect(matchesBookingCode(id, '488580')).toBe(true);
  });

  it('accepts the full row id, which is what the QR actually encodes', () => {
    expect(matchesBookingCode(id, id)).toBe(true);
  });

  it('ignores case and stray spaces from a phone keyboard', () => {
    expect(matchesBookingCode(id, ' PM-88580 ')).toBe(true);
  });

  it('refuses a code belonging to a different booking', () => {
    expect(matchesBookingCode(id, 'PM-11111')).toBe(false);
    expect(matchesBookingCode(id, '999999')).toBe(false);
  });

  it('refuses an empty code rather than matching the first booking', () => {
    expect(matchesBookingCode(id, '')).toBe(false);
    expect(matchesBookingCode(id, '   ')).toBe(false);
  });
});

describe('bookingRef', () => {
  it('matches what the guest was shown on their confirmation', () => {
    // BookingFlow printed `PM-${id.slice(-5)}` inline. If these ever differ,
    // a guest reads one number down the phone and the owner searches another.
    const id = 'book_1784292488580';
    expect(bookingRef(id)).toBe(`PM-${id.slice(-5).toUpperCase()}`);
  });

  it('is stable for the same booking', () => {
    expect(bookingRef('book_1784292488580')).toBe(bookingRef('book_1784292488580'));
  });

  it('survives a short id without throwing', () => {
    expect(bookingRef('b1')).toBe('PM-B1');
  });
});

describe('bookingAge', () => {
  const now = new Date('2026-07-20T14:00:00');
  const at = (iso: string) => bookingAge(iso, now);

  it('counts minutes while the request is fresh', () => {
    expect(at('2026-07-20T13:59:30')).toBe('الآن');
    expect(at('2026-07-20T13:30:00')).toBe('منذ 30 دقيقة');
  });

  it('switches to a clock time later the same day', () => {
    expect(at('2026-07-20T10:45:00')).toMatch(/^منذ /);
    expect(at('2026-07-20T10:45:00')).not.toMatch(/دقيقة/);
  });

  it('names yesterday', () => {
    expect(at('2026-07-19T18:30:00')).toMatch(/^أمس /);
  });

  it('gives a plain date once it is older than that', () => {
    // «منذ ١٩ يوماً» is harder to place than the date itself.
    const out = at('2026-07-01T09:00:00');
    expect(out).not.toMatch(/منذ|أمس/);
    expect(out).toMatch(/٢٠٢٦|2026/);
  });

  it('returns nothing for an unparseable timestamp rather than «Invalid Date»', () => {
    expect(bookingAge('not a date', now)).toBe('');
  });
});

describe('paidPercent', () => {
  it('reports the share collected', () => {
    expect(paidPercent(7560, 1134)).toBe(15);
    expect(paidPercent(4800, 2300)).toBe(48);
    expect(paidPercent(1000, 1000)).toBe(100);
    expect(paidPercent(1000, 0)).toBe(0);
  });

  it('clamps rather than drawing a bar past its track', () => {
    expect(paidPercent(1000, 1500)).toBe(100);
    expect(paidPercent(1000, -50)).toBe(0);
  });

  it('does not divide by a zero total', () => {
    expect(paidPercent(0, 0)).toBe(0);
    expect(paidPercent(0, 500)).toBe(0);
  });
});
