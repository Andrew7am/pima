// Which Coptic Orthodox season is it right now?
//
// Used to let a banner follow the church calendar on its own. The moving fasts
// hang off Orthodox Easter, which is computed with the Julian (Meeus) rule and
// then shifted to the Gregorian calendar — the +13 day offset that holds for
// 1900–2099. Fixed-date seasons are declared directly.

export type CopticSeason =
  | 'nativity_fast' | 'nativity' | 'great_lent' | 'holy_week' | 'resurrection'
  | 'apostles_fast' | 'assumption_fast' | 'ordinary';

export interface SeasonInfo {
  season: CopticSeason;
  label: string;
  /** A ready greeting a banner can show without anyone writing it. */
  greeting: string;
}

const MS_DAY = 86_400_000;
const utc = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d);
const addDays = (t: number, n: number) => t + n * MS_DAY;

// Orthodox Easter (Gregorian date) for a given year — Meeus's Julian algorithm.
export function orthodoxEaster(year: number): number {
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31); // 3 = March, 4 = April
  const day = ((d + e + 114) % 31) + 1;
  // That is a Julian date; the Gregorian equivalent is 13 days later this century.
  return addDays(utc(year, month, day), 13);
}

const INFO: Record<CopticSeason, { label: string; greeting: string }> = {
  nativity_fast: { label: 'صوم الميلاد', greeting: 'صوم مقبول 🙏 استعد لخلوة الميلاد' },
  nativity: { label: 'عيد الميلاد', greeting: 'كل سنة وأنتم طيبين 🎄 ميلاد مجيد' },
  great_lent: { label: 'الصوم الكبير', greeting: 'صوم مقبول 🕊️ احجز خلوة الصوم' },
  holy_week: { label: 'أسبوع الآلام', greeting: 'أسبوع مبارك ✝️' },
  resurrection: { label: 'عيد القيامة', greeting: 'المسيح قام! بالحقيقة قام ✨' },
  apostles_fast: { label: 'صوم الرسل', greeting: 'صوم مقبول 🙏 خلوات صوم الرسل' },
  assumption_fast: { label: 'صوم السيدة العذراء', greeting: 'صوم مبارك 🌿 خلوات صوم العذراء' },
  ordinary: { label: '', greeting: '' },
};

export function copticSeason(now: Date = new Date()): SeasonInfo {
  const y = now.getUTCFullYear();
  const t = utc(y, now.getUTCMonth() + 1, now.getUTCDate());
  const easter = orthodoxEaster(y);

  // Moving seasons, checked from the most specific outwards.
  if (t >= easter && t <= addDays(easter, 6)) return { season: 'resurrection', ...INFO.resurrection };
  if (t >= addDays(easter, -7) && t < easter) return { season: 'holy_week', ...INFO.holy_week };
  // Great Lent: 55 days of fasting ending at Holy Week.
  if (t >= addDays(easter, -62) && t < addDays(easter, -7)) return { season: 'great_lent', ...INFO.great_lent };
  // Apostles' fast: the day after Pentecost (Easter + 50) until 11 July.
  if (t > addDays(easter, 50) && t <= utc(y, 7, 11)) return { season: 'apostles_fast', ...INFO.apostles_fast };

  // Fixed seasons.
  if (t >= utc(y, 8, 7) && t <= utc(y, 8, 21)) return { season: 'assumption_fast', ...INFO.assumption_fast };
  if (t >= utc(y, 1, 7) && t <= utc(y, 1, 9)) return { season: 'nativity', ...INFO.nativity };
  if (t >= utc(y, 11, 25) || t <= utc(y, 1, 6)) return { season: 'nativity_fast', ...INFO.nativity_fast };

  return { season: 'ordinary', ...INFO.ordinary };
}
