import { describe, it, expect } from 'vitest';
import { computeStayPrice, nightlyRateFor, offersDayUse, isDayUse } from './pricing';
import type { RetreatHouse, SeasonalRate } from '../types';

// Only the fields pricing actually reads — the rest of RetreatHouse is
// irrelevant here and would just make these tests brittle.
function house(pricePerNightPerPerson: number, seasonalRates: SeasonalRate[] = []): RetreatHouse {
  return { pricePerNightPerPerson, seasonalRates } as unknown as RetreatHouse;
}

let seasonId = 0;
function season(startDate: string, endDate: string, pricePerNight: number, label: string): SeasonalRate {
  seasonId += 1;
  return { id: `s${seasonId}`, startDate, endDate, pricePerNight, label };
}

describe('nightlyRateFor', () => {
  it('falls back to the base rate when no season matches', () => {
    const h = house(100, [season('2026-08-01', '2026-08-31', 250, 'صيف')]);
    expect(nightlyRateFor(h, '2026-07-15')).toEqual({ rate: 100, label: null });
  });

  it('applies a seasonal rate inclusively on both boundary dates', () => {
    const h = house(100, [season('2026-08-01', '2026-08-31', 250, 'صيف')]);
    expect(nightlyRateFor(h, '2026-08-01').rate).toBe(250);
    expect(nightlyRateFor(h, '2026-08-31').rate).toBe(250);
    expect(nightlyRateFor(h, '2026-09-01').rate).toBe(100);
  });

  // Must match the server trigger: first entry in array order wins.
  it('lets the first matching season win when ranges overlap', () => {
    const h = house(100, [
      season('2026-08-01', '2026-08-31', 250, 'أول'),
      season('2026-08-10', '2026-08-20', 400, 'تاني'),
    ]);
    expect(nightlyRateFor(h, '2026-08-15')).toEqual({ rate: 250, label: 'أول' });
  });

  it('skips malformed seasonal entries instead of trusting them', () => {
    const h = house(100, [
      season('not-a-date', '2026-08-31', 999, 'تالف'),
      season('2026-08-01', '2026-08-31', -5, 'سالب'),
    ]);
    expect(nightlyRateFor(h, '2026-08-15')).toEqual({ rate: 100, label: null });
  });
});

describe('computeStayPrice', () => {
  it('excludes the check-out night (half-open range, like the trigger)', () => {
    // 2026-07-10 -> 2026-07-13 is 3 nights, not 4.
    const { total } = computeStayPrice(house(100), '2026-07-10', '2026-07-13', 1);
    expect(total).toBe(300);
  });

  it('multiplies by the guest count', () => {
    const { total } = computeStayPrice(house(100), '2026-07-10', '2026-07-13', 4);
    expect(total).toBe(1200);
  });

  it('prices a stay that straddles a season change night by night', () => {
    const h = house(100, [season('2026-08-01', '2026-08-31', 250, 'صيف')]);
    // 30, 31 July at 100 + 1, 2 Aug at 250 = 700 per person.
    const { total, breakdown } = computeStayPrice(h, '2026-07-30', '2026-08-03', 2);
    expect(total).toBe(1400);
    expect(breakdown).toEqual([
      { label: null, nights: 2, rate: 100 },
      { label: 'صيف', nights: 2, rate: 250 },
    ]);
  });

  it('returns zero for invalid ranges and guest counts', () => {
    expect(computeStayPrice(house(100), '2026-07-13', '2026-07-10', 2).total).toBe(0); // reversed
    expect(computeStayPrice(house(100), '2026-07-10', '2026-07-10', 2).total).toBe(0); // same day
    expect(computeStayPrice(house(100), '2026-07-10', '2026-07-13', 0).total).toBe(0); // no guests
    expect(computeStayPrice(house(100), '', '2026-07-13', 2).total).toBe(0);           // missing date
  });

  // Guards against a UTC-vs-local off-by-one: a DST-style shift used to make
  // the loop emit the wrong date string and silently mis-price a night.
  it('counts the right number of nights across a month boundary', () => {
    const { total } = computeStayPrice(house(50), '2026-01-30', '2026-02-02', 1);
    expect(total).toBe(150); // 30, 31 Jan + 1 Feb
  });
});

// A house that takes «يوم روحي» bookings. Same factory shape as above, plus
// the one field day pricing reads.
function dayHouse(nightly: number, dayRate: number, propertyType?: RetreatHouse['propertyType']): RetreatHouse {
  return { pricePerNightPerPerson: nightly, dayUsePricePerPerson: dayRate, seasonalRates: [], propertyType } as unknown as RetreatHouse;
}

describe('day use — a stay with no night in it', () => {
  it('prices the day at the house day rate rather than at nothing', () => {
    // The whole gap: the calendar has always let a guest tap one day twice,
    // and this returned 0 — a booking taken for free.
    const { total, breakdown } = computeStayPrice(dayHouse(200, 120), '2026-07-15', '2026-07-15', 40);
    expect(total).toBe(4800);
    expect(breakdown).toEqual([{ label: 'يوم واحد بدون مبيت', nights: 0, rate: 120 }]);
  });

  it('stays at zero where the house has set no day price', () => {
    // Mirrors migration 089: with no day rate the server's expected is 0 too,
    // so the two agree rather than the client quoting a total the trigger
    // would not recognise.
    expect(computeStayPrice(house(200), '2026-07-15', '2026-07-15', 40).total).toBe(0);
    expect(offersDayUse(house(200))).toBe(false);
    expect(offersDayUse(dayHouse(200, 120))).toBe(true);
  });

  it('offers nothing for a zero or negative day rate', () => {
    expect(offersDayUse(dayHouse(200, 0))).toBe(false);
    expect(computeStayPrice(dayHouse(200, 0), '2026-07-15', '2026-07-15', 10).total).toBe(0);
  });

  it('does not offer a day in monthly housing', () => {
    // Student and staff housing is rented by the month; a day in one is not
    // a thing that can be booked, whatever price sits on the row.
    expect(offersDayUse(dayHouse(200, 120, 'student'))).toBe(false);
    expect(offersDayUse(dayHouse(200, 120, 'staff'))).toBe(false);
    expect(computeStayPrice(dayHouse(200, 120, 'student'), '2026-07-15', '2026-07-15', 3).total).toBe(0);
  });

  it('ignores the seasonal table — a day has one price', () => {
    const h = { ...dayHouse(200, 120), seasonalRates: [season('2026-07-01', '2026-08-31', 999, 'صيف')] } as RetreatHouse;
    expect(computeStayPrice(h, '2026-07-15', '2026-07-15', 2).total).toBe(240);
  });

  it('still prices one night as a night', () => {
    // The boundary that matters: the 15th to the 16th is a NIGHT, and must
    // not fall into the day branch just because a day price exists.
    const { total, breakdown } = computeStayPrice(dayHouse(200, 120), '2026-07-15', '2026-07-16', 2);
    expect(breakdown[0].nights).toBe(1);
    expect(total).toBe(400);
  });

  it('needs both dates present and equal', () => {
    expect(isDayUse('2026-07-15', '2026-07-15')).toBe(true);
    expect(isDayUse('2026-07-15', '2026-07-16')).toBe(false);
    expect(isDayUse('', '')).toBe(false);
  });
});
