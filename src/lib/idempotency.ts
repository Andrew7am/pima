/**
 * A key that makes a booking attempt repeatable.
 *
 * create_booking_with_financials fingerprints the booking's material inputs
 * against this key. Send it twice with the same inputs and the server returns
 * the booking it already made; send it with different inputs and the server
 * refuses rather than quietly pricing something else. Neither is possible
 * without a key that survives the retry, which is the whole reason this is a
 * module and not an inline `Math.random()` at the call site.
 *
 * crypto.randomUUID is the right source — it is cryptographically random, and
 * a collision would let one guest's retry return another guest's booking. The
 * fallback covers only non-secure contexts (plain http on a LAN, older
 * WebViews) where the API is absent; getRandomValues is still used there, so
 * the fallback is weaker in format, not in entropy.
 */
export function newIdempotencyKey(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  if (c && typeof c.getRandomValues === 'function') {
    const b = c.getRandomValues(new Uint8Array(16));
    return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  }
  // Last resort. Reached only where neither crypto API exists at all.
  return `k_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`;
}

/**
 * A booking id that is definitely not the one that was just refused.
 *
 * Only reached on BOOKING_ID_TAKEN. Ids are minted as book_<epoch-ms>, so
 * regenerating inside the same millisecond would hand back the very id the
 * server just rejected and the retry would fail identically. The suffix is
 * added only in that case, so the ordinary id keeps its usual shape.
 *
 * The idempotency key is deliberately NOT regenerated alongside it — see the
 * call site in HouseDetail. A new key would make the retry a new booking;
 * keeping it is what lets the server recognise a first attempt that did
 * commit and return that booking instead of making a second one.
 */
export function freshBookingId(previous: string): string {
  const candidate = 'book_' + Date.now();
  if (candidate !== previous) return candidate;
  return candidate + '_' + Math.random().toString(36).slice(2, 6);
}
