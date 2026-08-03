/**
 * Dates as an Arabic reader expects them, and the length of a stay in words.
 *
 * The owner's detail panel printed `2026-08-15` — Latin digits, ISO order —
 * in a right-to-left panel whose next cell was already Arabic, and left the
 * subtraction to the reader. The list card had the formatting but kept it
 * inside a render callback, so nothing else could reach it.
 */

/** «١٥ أغسطس» — day and month, no year. For dates in the near future. */
export const arabicDay = (iso: string): string =>
  new Date(iso).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' });

/** «١٥ أغسطس ٢٠٢٦» — for anything where the year is load-bearing. */
export const arabicDayYear = (iso: string): string =>
  new Date(iso).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' });

export function nightsBetween(checkIn: string, checkOut: string): number {
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  if (Number.isNaN(ms)) return 0;
  return Math.max(0, Math.round(ms / 86_400_000));
}

/**
 * Arabic counts one, two and few differently, and a stay of zero nights is a
 * day-use booking rather than a stay of no length — «٠ ليلة» would be wrong
 * about what the guest bought.
 */
export function nightsLabel(nights: number): string {
  if (nights <= 0) return 'يوم واحد';
  if (nights === 1) return 'ليلة واحدة';
  if (nights === 2) return 'ليلتان';
  if (nights <= 10) return `${nights} ليالٍ`;
  return `${nights} ليلة`;
}

/** The whole span in one string: «١٥ أغسطس ← ١٨ أغسطس · ٣ ليالٍ». */
export const stayLabel = (checkIn: string, checkOut: string): string =>
  `${arabicDay(checkIn)} ← ${arabicDay(checkOut)} · ${nightsLabel(nightsBetween(checkIn, checkOut))}`;
