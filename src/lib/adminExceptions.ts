import type { Booking, Payment, Payout } from '../types';
import { approvedTotalFor, ownerShareOf } from './paymentLedger';
import { arabicNumber } from './arabic';

/**
 * The things that should never be true about Pima's money, and are.
 *
 * The finance page answers "how much". This answers "is anything wrong" —
 * which is the actual weekly question, and until now the only way to ask it
 * was to scroll the payments list newest-first and hope something looked odd.
 *
 * Every rule here is an invariant of Pima's own model, not a generic
 * accounting check. A generic one would flag every single booking as underpaid,
 * because ~85% of every booking value is SUPPOSED to be missing from Pima's
 * accounts — it is cash the guest hands the owner at the door.
 *
 * The first rule is not hypothetical. paymentLedger's cashDueAtArrival carries
 * a comment recording that a booking whose deposit never arrived told the
 * owner to collect only the remaining 85%, "and the shortfall was never
 * recovered".
 *
 * DELIBERATELY NOT INCLUDED: "approved by nobody" — payments whose reviewed_by
 * is null. Migration 091 began stamping it, so every payment decided before
 * that migration has null, as does anything done through the SQL editor. The
 * client cannot tell those from a real gap, so the rule would bury the other
 * eight under legacy noise on the first day. A screen that is never empty is a
 * screen nobody reads.
 */

export type ExceptionKind =
  | 'deposit_paid_but_nothing_received'
  | 'underpaid_deposit'
  | 'overpaid_booking'
  | 'marked_paid_full_but_short'
  | 'held_against_unconfirmed_booking'
  | 'collected_on_cancelled'
  | 'settled_without_payout'
  | 'paid_owner_more_than_held';

export interface FinanceException {
  /** Stable across reloads, so dismissing one keeps it dismissed. */
  id: string;
  kind: ExceptionKind;
  severity: 'high' | 'medium';
  bookingId?: string;
  houseId?: string;
  who: string;
  houseName: string;
  amount: number;
  /** One Egyptian-Arabic sentence naming what is wrong. */
  detail: string;
  /** What closes it. */
  action: string;
}

const isLive = (b: Booking) => b.status !== 'cancelled' && b.status !== 'rejected';
const DAY = 86400000;

/** How long a deposit may sit against a booking nobody has confirmed. */
const UNCONFIRMED_GRACE_DAYS = 7;

export function findFinanceExceptions(args: {
  bookings: Booking[];
  payments: Payment[];
  payouts: Payout[];
  houses: { id: string; name: string }[];
  commissionRate: number;
  now?: number;
}): FinanceException[] {
  const { bookings, payments, payouts, houses, commissionRate } = args;
  const now = args.now ?? Date.now();
  const houseName = (id: string) => houses.find((h) => h.id === id)?.name || id;
  const out: FinanceException[] = [];

  const push = (
    kind: ExceptionKind, severity: 'high' | 'medium', b: Booking,
    amount: number, detail: string, action: string,
  ) => out.push({
    id: `${kind}:${b.id}`, kind, severity, bookingId: b.id, houseId: b.houseId,
    who: b.userName, houseName: b.houseName || houseName(b.houseId), amount, detail, action,
  });

  for (const b of bookings) {
    const received = approvedTotalFor(b.id, payments);
    const deposit = b.depositAmount || 0;

    if (!isLive(b)) {
      // Real cash Pima is still holding on a trip that is not happening.
      if (received > 0) {
        push('collected_on_cancelled', 'high', b, received,
          `الحجز ${b.status === 'cancelled' ? 'اتلغى' : 'اترفض'} وبيما لسه ماسكة ${arabicNumber(received)} ج.م من الضيف.`,
          'قرّر الاسترجاع وسجّله');
      }
      continue;
    }

    // The documented one: the owner will be told to collect only the balance,
    // and the deposit he is crediting was never actually received.
    if (b.depositPaid && received === 0) {
      push('deposit_paid_but_nothing_received', 'high', b, deposit,
        `الحجز متسجّل إن العربون اتدفع، ومفيش أي دفعة معتمدة وراه. صاحب البيت هيحصّل ${arabicNumber(Math.max(0, b.totalPrice - deposit))} بدل ${arabicNumber(b.totalPrice)}.`,
        'راجع الإيصال أو شيل علامة العربون');
    }

    if (received > 0 && deposit > 0 && received < deposit) {
      push('underpaid_deposit', 'medium', b, deposit - received,
        `وصل ${arabicNumber(received)} ج.م والعربون المطلوب ${arabicNumber(deposit)} — ناقص ${arabicNumber(deposit - received)}.`,
        'كلّم الضيف على الفرق');
    }

    if (received > b.totalPrice && b.totalPrice > 0) {
      push('overpaid_booking', 'high', b, received - b.totalPrice,
        `وصل ${arabicNumber(received)} ج.م وقيمة الحجز ${arabicNumber(b.totalPrice)} — الضيف ليه ${arabicNumber(received - b.totalPrice)} عندك.`,
        'رجّع الزيادة للضيف');
    }

    if (b.paymentStatus === 'paid_full' && received < b.totalPrice) {
      push('marked_paid_full_but_short', 'high', b, b.totalPrice - received,
        `مكتوب «مدفوع بالكامل» والمحصّل ${arabicNumber(received)} من ${arabicNumber(b.totalPrice)}.`,
        'صحّح حالة الدفع');
    }

    // Money banked against a trip nobody ever confirmed.
    if (received > 0 && b.status === 'pending') {
      const oldest = payments
        .filter((p) => p.bookingId === b.id && p.paymentStatus === 'approved')
        .map((p) => new Date(p.paymentDate).getTime())
        .filter((t) => !Number.isNaN(t))
        .sort((a, c) => a - c)[0];
      if (oldest !== undefined && now - oldest > UNCONFIRMED_GRACE_DAYS * DAY) {
        push('held_against_unconfirmed_booking', 'medium', b, received,
          `دفعة معتمدة من ${arabicNumber(Math.floor((now - oldest) / DAY))} يوم والحجز لسه «بانتظار الموافقة».`,
          'أكّد الحجز أو رجّع الفلوس');
      }
    }

    // A settlement stamps the booking AND writes a payout row under the same
    // timestamp (settleBookingsPayout). A stamp with no matching row means the
    // booking was marked paid without the transfer being recorded.
    if (b.ownerSettledAt) {
      const matched = payouts.some(
        (p) => p.status !== 'rejected' && p.houseId === b.houseId && p.completedAt === b.ownerSettledAt,
      );
      if (!matched) {
        push('settled_without_payout', 'medium', b, ownerShareOf(b, commissionRate),
          'الحجز متختوم إنه اتسوّى ومفيش تحويل مسجّل يقابله.',
          'راجع إن كان التحويل اتبعت فعلاً');
      }
    }
  }

  // Per house: has Pima sent the owner more than it ever held for him?
  const heldByHouse = new Map<string, number>();
  for (const b of bookings) {
    if (!isLive(b)) continue;
    if (approvedTotalFor(b.id, payments) <= 0) continue;
    heldByHouse.set(b.houseId, (heldByHouse.get(b.houseId) || 0) + ownerShareOf(b, commissionRate));
  }
  const sentByHouse = new Map<string, number>();
  for (const p of payouts) {
    if (p.status === 'rejected') continue;
    sentByHouse.set(p.houseId, (sentByHouse.get(p.houseId) || 0) + p.amount);
  }
  for (const [hid, sent] of sentByHouse) {
    const held = heldByHouse.get(hid) || 0;
    if (sent > held) {
      out.push({
        id: `paid_owner_more_than_held:${hid}`,
        kind: 'paid_owner_more_than_held', severity: 'high', houseId: hid,
        who: 'صاحب البيت', houseName: houseName(hid), amount: sent - held,
        detail: `اتحوّل ${arabicNumber(sent)} ج.م والمستحق من العرابين اللي بيما استلمتها ${arabicNumber(held)} — زيادة ${arabicNumber(sent - held)}.`,
        action: 'راجع التحويلات على البيت ده',
      });
    }
  }

  // Worst first, then biggest amount — the order you would work them in.
  const rank = { high: 0, medium: 1 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity] || b.amount - a.amount);
}
