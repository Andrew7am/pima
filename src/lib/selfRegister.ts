import { supabase } from './supabase';

export interface BookingInviteInfo {
  houseName: string;
  checkIn: string;
  checkOut: string;
  guestsCount: number;
  registeredCount: number;
  status: string;
}

// Public (anon-callable) read of a booking's join context — see migration 079.
export async function getBookingInviteInfo(bookingId: string): Promise<BookingInviteInfo | null> {
  const { data, error } = await supabase.rpc('get_booking_invite_info', { p_booking_id: bookingId });
  if (error) { console.error('getBookingInviteInfo:', error); return null; }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    houseName: row.house_name,
    checkIn: row.check_in,
    checkOut: row.check_out,
    guestsCount: row.guests_count,
    registeredCount: Number(row.registered_count),
    status: row.status,
  };
}

// Maps the RPC's raised exceptions to friendly Arabic messages.
const ERR_AR: Record<string, string> = {
  INVALID_NAME: 'من فضلك اكتب اسمك بشكل صحيح.',
  INVALID_GENDER: 'اختر النوع.',
  BOOKING_NOT_FOUND: 'رابط غير صالح — لم يتم العثور على الحجز.',
  BOOKING_NOT_OPEN: 'التسجيل غير متاح لهذا الحجز حالياً.',
  CAPACITY_FULL: 'اكتمل العدد المسموح لهذا الحجز.',
};

export async function selfRegisterAttendee(
  bookingId: string,
  name: string,
  gender: 'male' | 'female',
  groupType: 'youth' | 'family' | 'child' | 'other' = 'other',
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc('self_register_attendee', {
    p_booking_id: bookingId,
    p_name: name,
    p_gender: gender,
    p_group_type: groupType,
  });
  if (error) {
    const key = Object.keys(ERR_AR).find((k) => error.message.includes(k));
    return { ok: false, error: key ? ERR_AR[key] : 'تعذّر التسجيل، حاول مرة أخرى.' };
  }
  return { ok: true };
}
