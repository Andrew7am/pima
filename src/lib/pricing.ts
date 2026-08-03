// Night-by-night stay pricing with seasonal rates — MUST mirror the
// validate_booking_price() trigger math (migration 055) exactly, or the
// server will reject totals the client quoted. First matching seasonal
// entry (array order) wins for a night; unmatched nights use the base
// rate; malformed entries are skipped, same as the trigger.
import { RetreatHouse, SeasonalRate } from '../types';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidRate(r: SeasonalRate): boolean {
  return DATE_RE.test(r.startDate) && DATE_RE.test(r.endDate) && Number.isFinite(r.pricePerNight) && r.pricePerNight >= 0;
}

export function nightlyRateFor(house: RetreatHouse, dateStr: string): { rate: number; label: string | null } {
  for (const r of house.seasonalRates ?? []) {
    if (isValidRate(r) && dateStr >= r.startDate && dateStr <= r.endDate) {
      return { rate: r.pricePerNight, label: r.label };
    }
  }
  return { rate: house.pricePerNightPerPerson, label: null };
}

export interface StayPriceBreakdownRow {
  label: string | null; // null = base rate
  nights: number;
  rate: number;
}

/** Does this house take «يوم روحي» bookings — a day with no night in it? */
export const offersDayUse = (house: RetreatHouse) =>
  house.propertyType !== 'student' && house.propertyType !== 'staff'
  && typeof house.dayUsePricePerPerson === 'number' && house.dayUsePricePerPerson > 0;

/** checkIn === checkOut: arrive and leave the same day. */
export const isDayUse = (checkIn: string, checkOut: string) =>
  Boolean(checkIn) && checkIn === checkOut;

// Total for [checkIn, checkOut) — checkOut night not included, same as
// the trigger's generate_series(check_in, check_out - 1). The one exception
// is a stay with no night at all, which that series cannot express: see
// migration 089, whose same-day branch this mirrors.
export function computeStayPrice(house: RetreatHouse, checkIn: string, checkOut: string, guestsCount: number): { total: number; breakdown: StayPriceBreakdownRow[] } {
  if (guestsCount <= 0) return { total: 0, breakdown: [] };

  // A day is not a short night: it has its own rate, no seasonal table, and
  // one row in the breakdown. `nights: 0` is what tells every reader of this
  // breakdown that there is no night to count.
  if (isDayUse(checkIn, checkOut)) {
    if (!offersDayUse(house)) return { total: 0, breakdown: [] };
    const rate = house.dayUsePricePerPerson as number;
    return { total: rate * guestsCount, breakdown: [{ label: 'يوم واحد بدون مبيت', nights: 0, rate }] };
  }

  if (!checkIn || !checkOut || checkIn >= checkOut) return { total: 0, breakdown: [] };

  const rows = new Map<string, StayPriceBreakdownRow>();
  let perPerson = 0;
  const cursor = new Date(`${checkIn}T00:00:00`);
  const end = new Date(`${checkOut}T00:00:00`);
  while (cursor < end) {
    const dateStr = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
    const { rate, label } = nightlyRateFor(house, dateStr);
    perPerson += rate;
    const key = `${label ?? ''}|${rate}`;
    const row = rows.get(key);
    if (row) row.nights += 1;
    else rows.set(key, { label, nights: 1, rate });
    cursor.setDate(cursor.getDate() + 1);
  }

  return { total: perPerson * guestsCount, breakdown: [...rows.values()] };
}
