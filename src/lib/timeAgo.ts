/**
 * Compact Arabic relative time — "منذ ٣ دقائق" style.
 *
 * Arabic pluralises on 1 / 2 / 3-10 / 11+, so a naive `منذ ${n} دقيقة` reads
 * wrong for most values. This covers the four cases per unit.
 */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';

  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return 'الآن';

  const plural = (n: number, one: string, two: string, few: string, many: string) => {
    if (n === 1) return one;
    if (n === 2) return two;
    if (n <= 10) return `${n} ${few}`;
    return `${n} ${many}`;
  };

  const mins = Math.floor(secs / 60);
  if (mins < 60) return `منذ ${plural(mins, 'دقيقة', 'دقيقتين', 'دقائق', 'دقيقة')}`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `منذ ${plural(hours, 'ساعة', 'ساعتين', 'ساعات', 'ساعة')}`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `منذ ${plural(days, 'يوم', 'يومين', 'أيام', 'يوم')}`;

  const months = Math.floor(days / 30);
  if (months < 12) return `منذ ${plural(months, 'شهر', 'شهرين', 'أشهر', 'شهر')}`;

  const years = Math.floor(months / 12);
  return `منذ ${plural(years, 'سنة', 'سنتين', 'سنوات', 'سنة')}`;
}
