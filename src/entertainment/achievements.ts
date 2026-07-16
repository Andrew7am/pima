import { User } from '../types';

// Display metadata for the achievement catalog. The actual unlock
// thresholds and rewards are enforced server-side in check_achievements()
// (migration 037) — this file mirrors them ONLY for showing progress
// bars and reward previews; it never grants anything itself.
export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  icon: string;
  target: number;
  xpReward: number;
  coinsReward: number;
  // Reads the current progress value for this achievement off a user.
  getProgress: (u: User) => number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first_game',
    title: 'أول خطوة',
    description: 'العب أول لعبة في مركز الترفيه.',
    icon: '🎮',
    target: 1,
    xpReward: 30,
    coinsReward: 10,
    getProgress: (u) => u.totalGamesPlayed ?? 0,
  },
  {
    id: 'active_player',
    title: 'لاعب نشيط',
    description: 'العب 20 لعبة (فردية أو مباشرة).',
    icon: '🔥',
    target: 20,
    xpReward: 80,
    coinsReward: 30,
    getProgress: (u) => u.totalGamesPlayed ?? 0,
  },
  {
    id: 'bible_expert',
    title: 'خبير الإنجيل',
    description: 'أجب بشكل صحيح على 100 سؤال.',
    icon: '📖',
    target: 100,
    xpReward: 150,
    coinsReward: 60,
    getProgress: (u) => u.totalCorrectAnswers ?? 0,
  },
  {
    id: 'level_5',
    title: 'المستوى الخامس',
    description: 'اصعد للمستوى 5.',
    icon: '⭐',
    target: 5,
    xpReward: 100,
    coinsReward: 40,
    getProgress: (u) => u.level ?? 1,
  },
  {
    id: 'level_10',
    title: 'المستوى العاشر',
    description: 'اصعد للمستوى 10.',
    icon: '🌟',
    target: 10,
    xpReward: 250,
    coinsReward: 100,
    getProgress: (u) => u.level ?? 1,
  },
  {
    id: 'first_win',
    title: 'أول انتصار',
    description: 'اربح أول مباراة مباشرة.',
    icon: '🏆',
    target: 1,
    xpReward: 60,
    coinsReward: 25,
    getProgress: (u) => u.totalMatchesWon ?? 0,
  },
  {
    id: 'match_champion',
    title: 'بطل المباريات',
    description: 'اربح 10 مباريات مباشرة.',
    icon: '👑',
    target: 10,
    xpReward: 200,
    coinsReward: 80,
    getProgress: (u) => u.totalMatchesWon ?? 0,
  },
  {
    id: 'disciple_league',
    title: 'دورية التلاميذ',
    description: 'وصّل تقييمك التنافسي لـ 500.',
    icon: '🥇',
    target: 500,
    xpReward: 120,
    coinsReward: 50,
    getProgress: (u) => u.rating ?? 100,
  },
  {
    id: 'master_league',
    title: 'حكيم الكتاب',
    description: 'وصّل تقييمك التنافسي لـ 2000.',
    icon: '👑',
    target: 2000,
    xpReward: 400,
    coinsReward: 150,
    getProgress: (u) => u.rating ?? 100,
  },
];

export function getAchievementDef(id: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}
