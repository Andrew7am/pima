/**
 * Arabic number, plural and date formatting — one place, because the app was
 * mixing two numeral systems on the same row: `toLocaleString('ar-EG')` gave
 * Arabic-Indic (١٥ فرد, ٧٬٥٦٠ ج.م) while template literals and raw ISO dates
 * gave Latin (منذ 3 ساعات, 2026-08-15).
 */

/** Arabic-Indic digits, with the thousands separator ar-EG uses. */
export function arabicNumber(n: number): string {
  return n.toLocaleString('ar-EG');
}

/**
 * A counted noun in the form Arabic actually takes.
 *
 * Arabic agreement is not "singular vs plural": 1 and 2 carry the count in the
 * noun itself (يوم / يومين — no numeral printed), 3–10 take the plural of
 * paucity (٣ أيام), and 11 and up go back to the singular (١١ يوم). Getting
 * this wrong reads as broken Arabic, not as a typo.
 *
 * Follows CLDR's `ar` rules on n % 100, so it stays correct past 100 too:
 * 103 is few (١٠٣ سنوات), 111 is many (١١١ سنة).
 */
export interface ArabicPluralForms {
  /** Optional wording for none at all; defaults to the `many` form. */
  zero?: string;
  /** n = 1 — carries no numeral: "يوم" */
  one: string;
  /** n = 2 — the dual, carries no numeral: "يومين" */
  two: string;
  /** n % 100 = 3–10 — plural of paucity: "أيام" */
  few: string;
  /** n % 100 = 11–99, and 0 — back to the singular: "يوم" */
  many: string;
}

export function arabicPlural(n: number, forms: ArabicPluralForms): string {
  if (n === 0) return forms.zero ?? `${arabicNumber(0)} ${forms.many}`;
  if (n === 1) return forms.one;
  if (n === 2) return forms.two;
  const mod = n % 100;
  const form = mod >= 3 && mod <= 10 ? forms.few : forms.many;
  return `${arabicNumber(n)} ${form}`;
}

/** "١٨ يوليو ٢٠٢٦" */
export function arabicDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * "٥ أغسطس ٢٠٢٦، ٦:٠٦ م" — a moment, not just a day.
 *
 * For the places that record when something happened rather than when a stay
 * falls: a payment filed, a proof reviewed. Those were printing the raw
 * column ("2026-08-05T18:06:42.612+00:00") straight onto the screen.
 */
export function arabicDateTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('ar-EG', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

/**
 * A stay's dates as one phrase: "١٥ – ١٨ أغسطس ٢٠٢٦".
 *
 * Replaces `{checkIn} → {checkOut}`, which printed two raw ISO dates in Latin
 * digits either side of a left-pointing arrow. Inside an RTL container that is
 * a genuine bidi hazard — the two runs can swap visually, so the guest reads
 * the departure date as the arrival. Rendering one Arabic phrase, with the
 * month named and Arabic-Indic digits, removes the ambiguity rather than
 * papering over it with an isolate.
 */
export function arabicDateRange(fromISO: string, toISO: string): string {
  const a = new Date(fromISO);
  const b = new Date(toISO);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return '';

  const day = (d: Date) => d.toLocaleDateString('ar-EG', { day: 'numeric' });
  const monthYear = (d: Date) => d.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
  const dayMonth = (d: Date) => d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' });

  // Same month: name it once. Same year: name the year once. Otherwise spell
  // both ends out — a stay spanning new year has to be unambiguous.
  if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()) {
    return `${day(a)} – ${day(b)} ${monthYear(b)}`;
  }
  if (a.getFullYear() === b.getFullYear()) {
    return `${dayMonth(a)} – ${dayMonth(b)} ${b.toLocaleDateString('ar-EG', { year: 'numeric' })}`;
  }
  return `${arabicDate(fromISO)} – ${arabicDate(toISO)}`;
}
