/**
 * Who the booking is for.
 *
 * A house cannot answer a request without this. Forty ثانوي and forty خدام
 * arriving on the same weekend are not the same booking: they need different
 * rooms, different supervision and a different answer about the church hall —
 * and until now the owner had to guess it from the group's name.
 *
 * «مؤتمر كبير» belongs in the same list because that is where a guest looks
 * for it, but it is not stored here: it is already `isLargeConferenceQuote` on
 * the booking, and a fact written in two places is a fact that will disagree
 * with itself. Read a booking's type through `bookingTypeLabel`, which knows
 * about both.
 */
import { Booking } from '../types';

export type BookingGroupKey =
  | 'standard' | 'primary' | 'preparatory' | 'secondary'
  | 'youth' | 'servants' | 'families' | 'retreat' | 'conference';

export interface BookingGroup {
  key: BookingGroupKey;
  label: string;
  /** One clause under the label — only where the choice does something. */
  hint?: string;
}

export const BOOKING_GROUPS: BookingGroup[] = [
  { key: 'standard', label: 'حجز عادي', hint: 'مجموعة بدون تصنيف خاص' },
  { key: 'primary', label: 'خدمة ابتدائي', hint: 'أطفال مدارس الأحد' },
  { key: 'preparatory', label: 'خدمة إعدادي' },
  { key: 'secondary', label: 'خدمة ثانوي' },
  { key: 'youth', label: 'خدمة شباب', hint: 'جامعيون وخريجون' },
  { key: 'servants', label: 'خدام وخدامات', hint: 'اجتماع أو خلوة خدام' },
  { key: 'families', label: 'أسر وعائلات' },
  { key: 'retreat', label: 'خلوة روحية' },
  { key: 'conference', label: 'مؤتمر كبير', hint: 'يُرسل كطلب عرض سعر بدل السعر الثابت' },
];

const BY_KEY = new Map(BOOKING_GROUPS.map((g) => [g.key as string, g]));

/** The two keys the booking record already expresses on its own. */
export const isStoredGroup = (key: BookingGroupKey) => key !== 'standard' && key !== 'conference';

/**
 * What to call a booking's type, wherever it is shown. Falls back to the raw
 * stored value so a record written by an older build still reads as something
 * rather than vanishing.
 */
export function bookingTypeLabel(
  booking: Partial<Pick<Booking, 'isLargeConferenceQuote' | 'conferenceDetails'>>
): string {
  if (booking.isLargeConferenceQuote) return 'مؤتمر كبير';
  const stored = booking.conferenceDetails?.bookingType;
  if (!stored) return 'حجز عادي';
  return BY_KEY.get(stored)?.label ?? stored;
}
