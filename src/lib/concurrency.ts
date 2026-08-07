/**
 * Run an async mapper over a list, at most `limit` at a time.
 *
 * Written for bulk photo upload: an owner registering a conference house
 * selects sixty or a hundred images at once. `Promise.all` over all of them
 * opens a hundred simultaneous connections, which on a phone means every one
 * of them crawls and some time out — slower overall than doing fewer at once,
 * and the failures are indistinguishable from a broken upload.
 *
 * Two properties the callers depend on:
 *
 * - **Results keep input order**, not completion order. Photo order is
 *   meaningful — the first image is the cover — so a fast small photo must not
 *   overtake the slow large one the owner put first.
 * - **A rejected item does not sink the batch.** Every item resolves to
 *   `{ok: true, value}` or `{ok: false, error}`, so ninety-seven good uploads
 *   survive three bad ones and the caller can say which failed.
 */

export type Settled<T> =
  | { ok: true; value: T }
  | { ok: false; error: unknown };

/** This project's tsconfig leaves `strict` off, and without strictNullChecks
 *  TypeScript will not narrow a `true | false` discriminant through a plain
 *  `if (r.ok)`. An explicit predicate narrows in either mode, so callers get
 *  the union's safety without the config having to change underneath them. */
export function isOk<T>(r: Settled<T>): r is { ok: true; value: T } {
  return r.ok;
}

export async function mapWithConcurrency<In, Out>(
  items: readonly In[],
  limit: number,
  fn: (item: In, index: number) => Promise<Out>,
  onSettled?: (doneCount: number, total: number) => void,
): Promise<Settled<Out>[]> {
  const total = items.length;
  const results: Settled<Out>[] = new Array(total);
  if (total === 0) return results;

  // A limit below 1 would spawn no workers and hang forever waiting on a queue
  // nobody drains, so clamp rather than trust the caller.
  const workers = Math.max(1, Math.min(Math.floor(limit) || 1, total));

  let next = 0;
  let done = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const index = next++;
      if (index >= total) return;
      try {
        results[index] = { ok: true, value: await fn(items[index], index) };
      } catch (error) {
        results[index] = { ok: false, error };
      }
      done++;
      onSettled?.(done, total);
    }
  }

  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}
