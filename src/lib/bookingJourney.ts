import type { Booking, Payment } from '../types';

/**
 * The five stages a booking passes through, as the guest sees them.
 *
 * Kept as a pure function so the sequencing is testable on its own: the UI only
 * paints what this returns. Every date here comes from a real column — nothing
 * is inferred or filled in. A stage whose timestamp is unknown (for example a
 * booking confirmed before migration 087 added `approved_at`) simply carries no
 * date, which is honest; the alternative would be inventing one.
 */
export type JourneyStepKey = 'submitted' | 'review' | 'confirmed' | 'deposit' | 'completed';
export type JourneyStepState = 'done' | 'current' | 'upcoming';

export interface JourneyStep {
  key: JourneyStepKey;
  label: string;
  state: JourneyStepState;
  /** A real timestamp, when one exists. */
  at?: string;
  /** One short line under the label, shown for the active stage. */
  note?: string;
}

export interface BookingJourney {
  steps: JourneyStep[];
  /** Plain-language explanation of where the booking stands right now. */
  message: string;
  /** True once nothing is left for anyone to do. */
  finished: boolean;
}

const LABELS: Record<JourneyStepKey, string> = {
  submitted: 'تم إرسال الطلب',
  review: 'جاري مراجعة الحجز',
  confirmed: 'تم تأكيد الحجز',
  deposit: 'دفع العربون',
  completed: 'اكتمل الحجز',
};

/** A booking counts as deposit-paid once the platform has approved the payment. */
export function approvedDepositPayment(bookingId: string, payments: Payment[] = []): Payment | undefined {
  return payments
    .filter((p) => p.bookingId === bookingId && p.paymentStatus === 'approved')
    .sort((a, b) => +new Date(a.paymentDate) - +new Date(b.paymentDate))[0];
}

export function buildBookingJourney(booking: Booking, payments: Payment[] = []): BookingJourney {
  const deposit = approvedDepositPayment(booking.id, payments);
  const depositDone =
    booking.depositPaid ||
    booking.paymentStatus === 'paid_deposit' ||
    booking.paymentStatus === 'paid_full' ||
    !!deposit;

  const confirmed = booking.status === 'approved' || booking.status === 'completed';
  const finished = booking.status === 'completed' || !!booking.checkedOutAt;

  // Each stage's completion is derived independently, then the first unfinished
  // one becomes "current" — so a booking that skipped ahead (an owner recording
  // an already-paid walk-in) still renders a coherent line.
  const done: Record<JourneyStepKey, boolean> = {
    submitted: true,
    review: confirmed || finished,
    confirmed,
    deposit: depositDone,
    completed: finished,
  };

  const at: Partial<Record<JourneyStepKey, string | undefined>> = {
    submitted: booking.createdAt,
    confirmed: booking.approvedAt,
    deposit: deposit?.paymentDate,
    completed: booking.checkedOutAt,
  };

  const order: JourneyStepKey[] = ['submitted', 'review', 'confirmed', 'deposit', 'completed'];
  const currentKey = order.find((k) => !done[k]);

  const steps: JourneyStep[] = order.map((key) => ({
    key,
    label: LABELS[key],
    state: done[key] ? 'done' : key === currentKey ? 'current' : 'upcoming',
    at: at[key],
    note: key === currentKey ? noteFor(key) : undefined,
  }));

  return { steps, message: messageFor(currentKey, booking), finished: !currentKey };
}

function noteFor(key: JourneyStepKey): string | undefined {
  switch (key) {
    case 'review': return 'فريق بيما بيتابع طلبك';
    case 'deposit': return 'مطلوب منك الآن';
    case 'completed': return 'في انتظار وصولك';
    default: return undefined;
  }
}

function messageFor(key: JourneyStepKey | undefined, booking: Booking): string {
  switch (key) {
    case 'review':
      return 'فريق بيما بيراجع طلبك مع بيت المؤتمرات دلوقتي. هنخطرك فور تأكيد الحجز.';
    case 'confirmed':
      return 'طلبك اتراجع، وفي انتظار تأكيد بيت المؤتمرات.';
    case 'deposit':
      return 'حجزك اتأكد. ادفع العربون علشان يتثبّت نهائيًا.';
    case 'completed':
      return `حجزك مؤكد والعربون اتدفع. مستنينك في ${booking.houseName}.`;
    default:
      return 'اكتمل حجزك. شكرًا لاختيارك بيما 🌿';
  }
}
