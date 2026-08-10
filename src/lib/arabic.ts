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

/**
 * A number with a fraction: "٤٫٥".
 *
 * `toFixed` always answers in Latin ("4.5") — it has no locale. Ratings are
 * the place this shows most: a gold ★ next to a Latin 4.5 on a screen whose
 * every other number is Arabic-Indic. The separator here is ٫ (U+066B ARABIC
 * DECIMAL SEPARATOR), which is what ar-EG uses, not a full stop.
 */
export function arabicDecimal(n: number, fractionDigits = 1): string {
  return n.toLocaleString('ar-EG', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

/**
 * A percentage in Arabic: "٦٪".
 *
 * Note the sign — U+066A ARABIC PERCENT SIGN, not the Latin `%`. Mixing an
 * Arabic-Indic numeral with a Latin percent sign is the same half-converted
 * look the numerals themselves had.
 */
export function arabicPercent(n: number): string {
  return `${arabicNumber(n)}٪`;
}

/**
 * A notification badge: "٣", or "٩+" once it stops being worth counting.
 *
 * The four badges in the app each wrote `n > 9 ? '9+' : n` inline, which put a
 * Latin 9 and a Latin count on an otherwise Arabic screen. The cap belongs
 * with the formatting, not copy-pasted next to every bell icon.
 */
export function arabicBadge(n: number): string {
  return n > 9 ? `${arabicNumber(9)}+` : arabicNumber(n);
}

/**
 * The nouns the dashboards count over and over.
 *
 * They live here rather than next to each screen because the same noun shows
 * up in the owner shell, the finance centre and the admin panel — three copies
 * of "غرفة/غرفتان/غرف" drift apart the moment one of them is edited.
 */
export const BOOKING_FORMS: ArabicPluralForms = { one: 'حجز واحد', two: 'حجزان', few: 'حجوزات', many: 'حجز', zero: 'لا حجوزات' };
export const USER_FORMS: ArabicPluralForms = { one: 'مستخدم واحد', two: 'مستخدمان', few: 'مستخدمين', many: 'مستخدم', zero: 'لا مستخدمين' };
export const GUEST_FORMS: ArabicPluralForms = { one: 'فرد واحد', two: 'فردان', few: 'أفراد', many: 'فرد' };
export const PAYMENT_FORMS: ArabicPluralForms = { one: 'دفعة واحدة', two: 'دفعتان', few: 'دفعات', many: 'دفعة', zero: 'لا دفعات' };
export const ROOM_FORMS: ArabicPluralForms = { one: 'غرفة واحدة', two: 'غرفتان', few: 'غرف', many: 'غرفة' };
export const BED_FORMS: ArabicPluralForms = { one: 'سرير واحد', two: 'سريران', few: 'أسرّة', many: 'سرير' };
export const REVIEW_FORMS: ArabicPluralForms = { one: 'تقييم واحد', two: 'تقييمان', few: 'تقييمات', many: 'تقييم' };
export const HOUSE_FORMS: ArabicPluralForms = { one: 'بيت واحد', two: 'بيتان', few: 'بيوت', many: 'بيت' };
export const EXPENSE_FORMS: ArabicPluralForms = { one: 'مصروف واحد', two: 'مصروفان', few: 'مصروفات', many: 'مصروف' };
export const TASK_FORMS: ArabicPluralForms = { one: 'مهمة واحدة', two: 'مهمتان', few: 'مهام', many: 'مهمة' };
export const AMENITY_FORMS: ArabicPluralForms = { one: 'مرفق واحد', two: 'مرفقان', few: 'مرافق', many: 'مرفق' };
export const NIGHT_FORMS: ArabicPluralForms = { one: 'ليلة واحدة', two: 'ليلتان', few: 'ليالٍ', many: 'ليلة' };
export const MEMBER_FORMS: ArabicPluralForms = { one: 'عضو واحد', two: 'عضوان', few: 'أعضاء', many: 'عضو' };
export const POINT_FORMS: ArabicPluralForms = { one: 'نقطة واحدة', two: 'نقطتان', few: 'نقاط', many: 'نقطة' };
export const PHOTO_FORMS: ArabicPluralForms = { one: 'صورة واحدة', two: 'صورتان', few: 'صور', many: 'صورة' };
export const DAY_FORMS: ArabicPluralForms = { one: 'يوم واحد', two: 'يومان', few: 'أيام', many: 'يوم' };

/**
 * Just the noun, for layouts that print the numeral themselves.
 *
 * A KPI tile shows the count big and the unit small underneath, so
 * `arabicPlural` cannot be used — it would put a second numeral inside the
 * unit line ("١٢" over "١٢ غرفة"). This returns the form that pairs with a
 * numeral already on screen: the plural of paucity for 3–10 (٣ over غرف), the
 * singular otherwise (١٢ over غرفة).
 */
export function arabicUnit(n: number, forms: ArabicPluralForms): string {
  const mod = Math.abs(n) % 100;
  return mod >= 3 && mod <= 10 ? forms.few : forms.many;
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

/**
 * The four account roles, named once.
 *
 * The admin panel spelled these inline in four places and did not agree with
 * itself: an owner was «مالك» on the activity feed, «صاحب بيت» on the users
 * list and account queue, and an admin was «إدارة» in two places. The audit
 * log had a third problem — any role it had no Arabic branch for printed its
 * raw English key mid-sentence.
 *
 * Keyed loosely so an unexpected value returns undefined and the caller can
 * say «غير معروف» rather than leak a database string to the screen.
 */
export const ROLE_LABELS: Record<string, string> = {
  individual: 'فرد',
  servant: 'خادم',
  owner: 'صاحب بيت',
  admin: 'إدارة',
};

/** «٦:٤٠ م» — the hour a group arrived, for the parents' page. */
export function arabicTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('ar-EG', { hour: 'numeric', minute: '2-digit' });
}
