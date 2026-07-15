// XP thresholds match the server-side rule in migration 035:
// leveling from N to N+1 costs N * 200 XP. Kept in one file so the UI
// (progress bar, "XP to next level" text) always agrees with the
// server rather than duplicating the formula in several places.

export function xpToNext(level: number): number {
  return Math.max(1, level) * 200;
}

export function xpProgressPct(xp: number, level: number): number {
  const needed = xpToNext(level);
  return Math.min(100, Math.max(0, Math.round((xp / needed) * 100)));
}
