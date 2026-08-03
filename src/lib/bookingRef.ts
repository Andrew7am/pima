/**
 * The number a guest and an owner say to each other.
 *
 * It existed already — the booking flow prints `PM-xxxxx` on the confirmation
 * screen — but it was built inline and thrown away, so the owner's screens had
 * no way to show the same string. A reference only one side can see is not a
 * reference.
 *
 * Derived from the row id rather than counted: Pima has no sequential booking
 * number, and inventing one that looked sequential would promise an ordering
 * the data cannot keep.
 */
export const bookingRef = (bookingId: string): string =>
  `PM-${bookingId.slice(-5).toUpperCase()}`;

/**
 * Does a code someone typed identify this booking?
 *
 * The check-in scanner had its own, third derivation — the last six characters
 * with the `booking_` prefix stripped — and matched only that. So the moment
 * the printed sheet showed the same PM- number as the guest's phone, typing it
 * in by hand would have failed. Both forms are accepted: the legacy one keeps
 * sheets already printed and sitting in a folder working.
 */
export function matchesBookingCode(bookingId: string, code: string): boolean {
  const typed = code.trim().toLowerCase().replace(/\s/g, '');
  if (!typed) return false;
  const bare = (s: string) => s.replace(/^pm-/, '');
  const id = bookingId.toLowerCase();
  const legacy = bookingId.replace(/^booking_/, '').slice(-6).toLowerCase();
  return id === typed
    || bare(bookingRef(bookingId).toLowerCase()) === bare(typed)
    || legacy === typed;
}

/**
 * «منذ ساعتين», «أمس ٦:٣٠ م», «١٨ يوليو ٢٠٢٦».
 *
 * How long someone has been waiting is the thing an owner reads first on a new
 * request, and a raw timestamp makes them do the subtraction. Recent times stay
 * relative; anything older than a couple of days is a date, because «منذ ١٩
 * يوماً» is harder to place than the date itself.
 */
export function bookingAge(createdAt: string, now: Date = new Date()): string {
  const then = new Date(createdAt);
  if (Number.isNaN(then.getTime())) return '';
  const mins = Math.floor((now.getTime() - then.getTime()) / 60000);

  if (mins < 1) return 'الآن';
  if (mins < 60) return `منذ ${mins} دقيقة`;

  const time = then.toLocaleTimeString('ar-EG', { hour: 'numeric', minute: '2-digit' });
  const sameDay = then.toDateString() === now.toDateString();
  if (sameDay) return `منذ ${time}`;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (then.toDateString() === yesterday.toDateString()) return `أمس ${time}`;

  return then.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * How much of the booking has actually been collected, 0–100.
 *
 * Clamped at both ends: an over-payment should not draw a bar past its track,
 * and a zero-priced booking must not divide by nothing.
 */
export function paidPercent(totalPrice: number, paid: number): number {
  if (!(totalPrice > 0)) return 0;
  return Math.max(0, Math.min(100, Math.round((paid / totalPrice) * 100)));
}
