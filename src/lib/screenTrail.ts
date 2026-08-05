/**
 * The trail of screens behind the one on display, so "back" returns where the
 * user actually came from.
 *
 * Every game screen used to exit with a hardcoded jump to the entertainment
 * hub, so opening a game from the games catalogue and leaving it put you on
 * the hub instead of back in the catalogue — and opening the rewards screen
 * from inside a match did the same. These two functions are the whole rule,
 * kept pure so the awkward cases below are tested rather than assumed.
 */

/** Longer than any real path through the app; keeps a session from growing memory. */
export const TRAIL_LIMIT = 20;

/**
 * Record the screen being left. Re-entering the screen you are already on is
 * not a move and is not recorded, or back would appear to do nothing.
 */
export function pushTrail<T>(trail: T[], leaving: T, arriving: T, limit = TRAIL_LIMIT): T[] {
  if (leaving === arriving) return trail;
  const next = [...trail, leaving];
  return next.length > limit ? next.slice(next.length - limit) : next;
}

/**
 * Walk back one step.
 *
 * Entries matching the current screen are discarded rather than returned —
 * they would be a no-op press. `fallback` covers an empty trail, which is the
 * normal case after a deep link or a reload, not an error.
 */
export function popTrail<T>(trail: T[], current: T, fallback: T): { next: T; trail: T[] } {
  const remaining = [...trail];
  while (remaining.length) {
    const candidate = remaining.pop()!;
    if (candidate !== current) return { next: candidate, trail: remaining };
  }
  return { next: fallback, trail: remaining };
}
