// League tiers based on the user's rating column. Matches the earlier
// prototype 1:1 so any UI copy that mentioned مبتدئ/دارس/etc. still
// lines up. Kept as plain data so the UI can pick colors/badges out
// of the returned League object directly.

export interface League {
  id: 'beginner' | 'student' | 'disciple' | 'teacher' | 'master';
  min: number;
  max: number;
  name: string;
  badge: string;
  // Tailwind-friendly gradient stops for the badge chip (dark theme)
  gradient: string;
  glow: string;
}

export const LEAGUES: League[] = [
  { id: 'beginner', min: 0,    max: 199,      name: 'مبتدئ',       badge: '🥉', gradient: 'from-amber-700 to-amber-900', glow: 'shadow-amber-500/20' },
  { id: 'student',  min: 200,  max: 499,      name: 'دارس',        badge: '🥈', gradient: 'from-slate-400 to-slate-600', glow: 'shadow-slate-400/20' },
  { id: 'disciple', min: 500,  max: 999,      name: 'تلميذ',       badge: '🥇', gradient: 'from-yellow-400 to-amber-600', glow: 'shadow-yellow-500/20' },
  { id: 'teacher',  min: 1000, max: 1999,     name: 'معلم',        badge: '💎', gradient: 'from-cyan-400 to-blue-600',    glow: 'shadow-cyan-500/20' },
  { id: 'master',   min: 2000, max: Infinity, name: 'حكيم الكتاب', badge: '👑', gradient: 'from-purple-600 to-indigo-900', glow: 'shadow-purple-500/20' },
];

export function getLeague(rating: number): League {
  return LEAGUES.find((l) => rating >= l.min && rating <= l.max) ?? LEAGUES[0];
}
