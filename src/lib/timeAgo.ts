import { arabicPlural } from './arabic';

/**
 * Compact Arabic relative time — "منذ ٣ دقائق" style.
 *
 * Agreement and numerals both come from lib/arabic, so a duration here reads
 * the same way a count does anywhere else in the app. It used to build the
 * string with a template literal, which printed Latin digits ("منذ 3 دقائق")
 * next to Arabic-Indic ones elsewhere on the same screen.
 */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';

  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return 'الآن';

  const mins = Math.floor(secs / 60);
  if (mins < 60) return `منذ ${arabicPlural(mins, { one: 'دقيقة', two: 'دقيقتين', few: 'دقائق', many: 'دقيقة' })}`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `منذ ${arabicPlural(hours, { one: 'ساعة', two: 'ساعتين', few: 'ساعات', many: 'ساعة' })}`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `منذ ${arabicPlural(days, { one: 'يوم', two: 'يومين', few: 'أيام', many: 'يوم' })}`;

  const months = Math.floor(days / 30);
  if (months < 12) return `منذ ${arabicPlural(months, { one: 'شهر', two: 'شهرين', few: 'أشهر', many: 'شهر' })}`;

  const years = Math.floor(months / 12);
  return `منذ ${arabicPlural(years, { one: 'سنة', two: 'سنتين', few: 'سنوات', many: 'سنة' })}`;
}
