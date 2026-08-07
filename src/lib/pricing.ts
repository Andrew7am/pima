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

/**
 * What the house is willing to say about feeding a group.
 *
 * Four states, because the data really has four, and collapsing them would
 * mean inventing a number:
 *
 *  included    — the nightly rate already covers the meals. Every house in
 *                the live data is this. Charging again would be charging
 *                twice for the same thing; all this state does is say so.
 *  priced      — not included, and the owner has priced the day's three
 *                meals per person on the weekly menu. That is a total we can
 *                actually compute, day by day, the way the room is computed.
 *  perMealOnly — not included, and the only figure is a per-MEAL price. How
 *                many meals a group eats in a day is not ours to assume, so
 *                this reports the rate and refuses to multiply it.
 *  none        — the house has said nothing. Say nothing.
 */
export type MealPlanState = 'included' | 'priced' | 'perMealOnly' | 'none';

export interface MealPlan {
  state: MealPlanState;
  /** One row per distinct day-rate, same shape the stay breakdown uses. */
  rows: StayPriceBreakdownRow[];
  /** For the whole party. Zero unless `priced`. */
  total: number;
  /** Reported, never multiplied. Only for `perMealOnly`. */
  perMealPrice?: number;
}

// The weekly menu is keyed by the Arabic weekday name the owner typed, and
// «الاثنين» is also written «الإثنين». Normalise before matching rather than
// silently missing a day and charging nothing for it.
const normalizeDay = (s: string) => s.trim().replace(/[إأآ]/g, 'ا').replace(/\s+/g, ' ');

const weekdayName = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('ar-EG', { weekday: 'long' });

export function computeMealPlan(
  house: RetreatHouse, checkIn: string, checkOut: string, guestsCount: number
): MealPlan {
  const menu = house.menu;
  if (!menu) return { state: 'none', rows: [], total: 0 };
  if (menu.isIncluded) return { state: 'included', rows: [], total: 0 };

  const byDay = new Map<string, number>();
  for (const d of menu.weeklyMenu ?? []) {
    if (typeof d.price === 'number' && d.price > 0) byDay.set(normalizeDay(d.day), d.price);
  }

  const dayUse = isDayUse(checkIn, checkOut);
  const days: string[] = [];
  if (dayUse) days.push(checkIn);
  else if (checkIn && checkOut && checkIn < checkOut) {
    // One day of board per night, the same unit the room is sold in. A stay
    // is physically present on N+1 dates, but N is what the guest is paying
    // for and what «شامل الإقامة» means to a house.
    const cursor = new Date(`${checkIn}T00:00:00`);
    const end = new Date(`${checkOut}T00:00:00`);
    while (cursor < end) {
      days.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`);
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  // Every day of the stay must have a price, or the total would quietly be
  // for fewer days than the group is actually there.
  const rates = days.map((d) => byDay.get(normalizeDay(weekdayName(d))));
  if (!days.length || guestsCount <= 0 || rates.some((r) => r === undefined)) {
    return menu.extraMealPrice && menu.extraMealPrice > 0
      ? { state: 'perMealOnly', rows: [], total: 0, perMealPrice: menu.extraMealPrice }
      : { state: 'none', rows: [], total: 0 };
  }

  const rows = new Map<number, StayPriceBreakdownRow>();
  let perPerson = 0;
  for (const rate of rates as number[]) {
    perPerson += rate;
    const row = rows.get(rate);
    if (row) row.nights += 1;
    else rows.set(rate, { label: 'إعاشة كاملة (٣ وجبات)', nights: 1, rate });
  }

  return { state: 'priced', rows: [...rows.values()], total: perPerson * guestsCount };
}

/**
 * The discount in force for a stay starting on this date, or 0.
 *
 * Judged on CHECK-IN, not on when the booking is made: consistent with
 * seasonal rates, and it is what an owner actually wants — his house is empty
 * on particular dates and he is trying to fill those dates.
 *
 * This must agree EXACTLY with validate_booking_price (migration 110), which
 * applies the same percentage to the price it computes for itself. The server
 * never trusts the number the client sends; it only has to arrive at the same
 * one. If these two drift, the database refuses the booking with
 * PRICE_TOO_LOW and the guest sees a failure with no explanation.
 */
export function activeDiscountFor(house: RetreatHouse, checkIn: string): number {
  const pct = house.discountPct ?? 0;
  if (!(pct > 0)) return 0;
  if (house.discountStartsAt && checkIn < house.discountStartsAt) return 0;
  if (house.discountEndsAt && checkIn > house.discountEndsAt) return 0;
  return pct;
}

/**
 * Apply it to the accommodation only.
 *
 * Meals are not in the server's `expected` at all — they are added
 * client-side — so discounting them here would put the client below a floor
 * the server computes without them. Food is also not what the offer is
 * about: the owner is discounting his empty beds.
 */
export function applyDiscount(amount: number, pct: number): number {
  return pct > 0 ? Math.round(amount * (1 - pct)) : amount;
}

/**
 * Is a discount live TODAY — the question a badge asks.
 *
 * activeDiscountFor answers it for a specific stay date; this answers it for
 * the listing, where no dates are chosen yet. Badging a house whose offer has
 * ended, or has not begun, advertises a price the guest cannot get and they
 * only discover it on the last screen.
 */
export function hasLiveDiscount(house: RetreatHouse, today = new Date()): boolean {
  const pct = house.discountPct ?? 0;
  if (!(pct > 0)) return false;
  const p = (n: number) => String(n).padStart(2, '0');
  const iso = `${today.getFullYear()}-${p(today.getMonth() + 1)}-${p(today.getDate())}`;
  if (house.discountStartsAt && iso < house.discountStartsAt) return false;
  if (house.discountEndsAt && iso > house.discountEndsAt) return false;
  return true;
}
