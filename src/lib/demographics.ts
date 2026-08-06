import type { User } from '../types';

/**
 * Who the platform's users are, by governorate and by age.
 *
 * Both come from fields the signup screen already requires, so this reports
 * what people actually entered rather than estimating anything. There is
 * deliberately no gender breakdown here: `gender` exists on Attendee — the
 * people a group leader registers onto a booking — and not on User at all.
 * Counting attendees and calling it users would be describing a different
 * population, which is the kind of quiet wrongness this codebase has already
 * been burned by.
 *
 * THE ONE RULE THAT MATTERS: a user missing a field is counted as «غير محدد»,
 * never dropped. Dropping them would silently shrink the denominator and
 * inflate every percentage — the report would look more confident the less
 * data it actually had.
 */

export const UNKNOWN = 'غير محدد';

export interface Slice {
  label: string;
  count: number;
  /** Share of ALL users, including those with nothing recorded. */
  pct: number;
}

/**
 * Whole years, from a date of birth, as of `now`.
 *
 * Returns null for anything unusable rather than a plausible-looking number:
 * an absent value, an unparseable one, a date in the future, or an age beyond
 * what a living person reaches. A typo'd birth year is common in forms and
 * would otherwise land in a band and be read as fact.
 */
export function ageFrom(dateOfBirth: string | undefined, now: Date = new Date()): number | null {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  if (dob.getTime() > now.getTime()) return null;

  let age = now.getFullYear() - dob.getFullYear();
  // Not had this year's birthday yet.
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;

  if (age < 0 || age > 120) return null;
  return age;
}

export interface AgeBand { label: string; min: number; max: number }

/** Bands chosen to match how a retreat is actually organised. */
export const AGE_BANDS: AgeBand[] = [
  { label: 'أقل من ١٨', min: 0, max: 17 },
  { label: '١٨ – ٢٤', min: 18, max: 24 },
  { label: '٢٥ – ٣٤', min: 25, max: 34 },
  { label: '٣٥ – ٤٤', min: 35, max: 44 },
  { label: '٤٥ – ٥٩', min: 45, max: 59 },
  { label: '٦٠ فأكثر', min: 60, max: 200 },
];

export function bandFor(age: number): AgeBand | null {
  return AGE_BANDS.find((b) => age >= b.min && age <= b.max) ?? null;
}

/**
 * Users per governorate, largest first, with the unrecorded ones last.
 *
 * «غير محدد» is always last regardless of size — it is not a place, and
 * sorting it into the middle of a ranking reads as though it were one.
 */
export function byGovernorate(users: User[]): Slice[] {
  const counts = new Map<string, number>();
  for (const u of users) {
    const key = u.governorate?.trim() || UNKNOWN;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return toSlices(counts, users.length).sort(sortNamedFirst);
}

/** Users per age band, in band order — age is ordinal, so ranking it hides the shape. */
export function byAgeBand(users: User[], now: Date = new Date()): Slice[] {
  const counts = new Map<string, number>();
  for (const b of AGE_BANDS) counts.set(b.label, 0);
  for (const u of users) {
    const age = ageFrom(u.dateOfBirth, now);
    const band = age === null ? null : bandFor(age);
    const key = band ? band.label : UNKNOWN;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const order = [...AGE_BANDS.map((b) => b.label), UNKNOWN];
  return toSlices(counts, users.length)
    .sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label));
}

/** Median age of the users who have a usable date of birth. */
export function medianAge(users: User[], now: Date = new Date()): number | null {
  const ages = users
    .map((u) => ageFrom(u.dateOfBirth, now))
    .filter((a): a is number => a !== null)
    .sort((a, b) => a - b);
  if (ages.length === 0) return null;
  const mid = Math.floor(ages.length / 2);
  return ages.length % 2 === 0 ? Math.round((ages[mid - 1] + ages[mid]) / 2) : ages[mid];
}

/** How many users the figures above could actually say something about. */
export function coverage(users: User[], now: Date = new Date()): { governorate: number; age: number; total: number } {
  return {
    total: users.length,
    governorate: users.filter((u) => (u.governorate ?? '').trim().length > 0).length,
    age: users.filter((u) => ageFrom(u.dateOfBirth, now) !== null).length,
  };
}

function toSlices(counts: Map<string, number>, total: number): Slice[] {
  return [...counts.entries()].map(([label, count]) => ({
    label,
    count,
    // Denominator is EVERY user, so the shares add to 100 and «غير محدد»
    // is visible as a real share rather than hidden by excluding it.
    pct: total === 0 ? 0 : Math.round((count / total) * 100),
  }));
}

function sortNamedFirst(a: Slice, b: Slice): number {
  if (a.label === UNKNOWN) return 1;
  if (b.label === UNKNOWN) return -1;
  return b.count - a.count || a.label.localeCompare(b.label, 'ar');
}
