import { Booking } from '../types';
import { categorizeBooking } from './ownerBookingOrder';

/**
 * The one-word answer to «الحجز ده واقف فين؟», in the owner's language.
 *
 * The list card computed this inline and the detail panel it opens did not
 * render status at all — so a booking the guest had cancelled opened showing
 * their name, dates and price with nothing to say it was dead. Shared, because
 * a drill-down that disagrees with the row you tapped is worse than either.
 *
 * Colour comes from theme tokens rather than a palette shade: the owner
 * dashboard has a night mode, and a fixed emerald-50 fill does not have one.
 */
export interface OwnerBookingBadge {
  label: string;
  /** Tailwind classes — token-based, so both themes are covered. */
  cls: string;
}

export function ownerBookingBadge(booking: Booking, todayStr: string): OwnerBookingBadge {
  const tinted = (token: string) =>
    `bg-[var(--color-owner-${token})]/10 text-[var(--color-owner-${token}-ink)] border-[var(--color-owner-${token})]/30`;
  const neutral = 'bg-[var(--color-owner-hover)] text-[var(--color-owner-secondary)] border-[var(--color-owner-border)]';

  if (booking.status === 'rejected') return { label: 'مرفوض', cls: tinted('danger') };
  if (booking.status === 'cancelled') return { label: 'ملغى من المستخدم', cls: neutral };
  if (booking.status === 'completed') return { label: 'مكتمل', cls: neutral };
  if (booking.status === 'pending') return { label: 'جديد ⚠️', cls: tinted('warning') };

  const category = categorizeBooking(booking, todayStr);
  if (category === 'arrivals_today') return { label: 'وصول اليوم', cls: tinted('info') };
  if (category === 'departures_today') return { label: 'مغادرة اليوم', cls: neutral };
  if (category === 'pending_payment') return { label: 'بانتظار الدفع', cls: tinted('info') };
  return { label: 'مؤكد', cls: tinted('success') };
}
