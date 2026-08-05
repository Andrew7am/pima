/**
 * What this player has already been asked.
 *
 * A random match drew `shuffle(pool).slice(0, n)` with no memory at all, and
 * two of the three stages come from pools of about 105 — so after ten matches
 * a player has seen twenty of them, and roughly one match in three repeats
 * something. That is what makes it feel stale long before the content
 * actually runs out.
 *
 * Recorded when a match is PLAYED rather than when it is built, which matters
 * because the host builds the questions for both sides. Recording at play time
 * means a player's history covers every question they have actually seen,
 * whichever role they were in, and every match they go on to host avoids all
 * of it. Players alternate roles, so this converges.
 *
 * The honest limit: when you are the guest you get the host's questions, and
 * the host cannot know your history. Removing repeats for BOTH players needs
 * the server to choose the questions — which is also what would stop the
 * answer key being handed to the client before the first question. That is a
 * bigger change and this is not a substitute for it.
 *
 * Deliberately NOT the `player_question_history` key InteractiveRoom uses.
 * That one is mirrored in React state and written back wholesale from a
 * snapshot taken at mount, so anything written underneath it during the same
 * session is clobbered on its next write. This module owns its own key and
 * does read-modify-write straight against storage, so concurrent writers do
 * not lose entries.
 */

const KEY = 'pima_seen_questions';

/**
 * Oldest first. Bounded only to keep the entry from growing without limit —
 * recycling is handled by preferring the least-recently-seen when a pool runs
 * short, not by this cap.
 */
const CAP = 500;

function read(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return []; // storage unavailable or corrupt — a player with no history
  }
}

/**
 * Append, oldest first, without losing what another writer added since we
 * last read. Re-seeing a question moves it to the newest end, so it is the
 * last thing to come back round.
 */
export function markSeen(keys: string[]): void {
  if (keys.length === 0) return;
  try {
    const fresh = new Set(keys);
    const kept = read().filter((k) => !fresh.has(k));
    localStorage.setItem(KEY, JSON.stringify([...kept, ...keys].slice(-CAP)));
  } catch {
    /* storage unavailable — repeat-avoidance is a nicety, never a blocker */
  }
}

/** Exposed for the tests and for callers that want to inspect the state. */
export function seenKeys(): string[] {
  return read();
}

export function clearSeen(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

/**
 * Draw `need` items, preferring ones this player has not been asked before.
 *
 * Never returns fewer than `Math.min(need, items.length)`: a stage that has
 * run out of unseen questions falls back to the ones seen LONGEST ago rather
 * than to nothing, because a short round cannot be finalised — both players
 * must answer every question before finalize_match will settle, and the
 * room RPCs reject anything under three.
 */
export function pickUnseen<T>(items: T[], keyOf: (item: T) => string, need: number): T[] {
  if (need <= 0 || items.length === 0) return [];

  const history = read();
  const rank = new Map(history.map((k, i) => [k, i])); // lower = seen longer ago
  const shuffled = shuffle(items);

  const unseen: T[] = [];
  const seen: T[] = [];
  for (const item of shuffled) {
    (rank.has(keyOf(item)) ? seen : unseen).push(item);
  }

  if (unseen.length >= need) return unseen.slice(0, need);

  // Top up with the least recently seen, so what does come back is what the
  // player is least likely to still remember.
  seen.sort((a, b) => (rank.get(keyOf(a)) ?? 0) - (rank.get(keyOf(b)) ?? 0));
  return [...unseen, ...seen.slice(0, need - unseen.length)];
}

function shuffle<T>(arr: T[]): T[] {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
