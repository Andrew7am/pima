import { supabase } from './supabase';

export interface BookingInviteInfo {
  houseName: string;
  checkIn: string;
  checkOut: string;
  guestsCount: number;
  registeredCount: number;
  status: string;
  /** Set only while the trip is running and only if the servant left it on.
   *  Group-level, both of them — no individual is named, counted out or
   *  located, and there is no reply path. See migration 111. */
  arrivedAt?: string;
  departedAt?: string;
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
    arrivedAt: row.arrived_at ?? undefined,
    departedAt: row.departed_at ?? undefined,
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

export interface HouseNeighbour {
  bookingType: string;
  sizeBand: string;
  checkIn: string;
  checkOut: string;
}

/**
 * Who else is in the building those nights.
 *
 * A servant bringing forty teenage girls has a right to know, before he
 * leaves Cairo, that a boys' secondary group shares the house — today the
 * only person holding that fact is the owner, who has no reason to volunteer
 * it. It reads like a privacy leak until you invert it: it is a safeguarding
 * fact, and withholding it protects nobody.
 *
 * Aggregate only, and the server enforces that: the kind of group and a SIZE
 * BAND, never an exact count, never the church, the servant, a name or a
 * phone, and no channel between the two groups. get_house_neighbours also
 * verifies the caller owns an approved booking there rather than trusting
 * this call.
 */
export async function getHouseNeighbours(bookingId: string): Promise<HouseNeighbour[]> {
  const { data, error } = await supabase.rpc('get_house_neighbours', { p_booking_id: bookingId });
  if (error) { console.error('getHouseNeighbours:', error); return []; }
  return (data ?? []).map((r: Record<string, string>) => ({
    bookingType: r.booking_type,
    sizeBand: r.size_band,
    checkIn: r.check_in,
    checkOut: r.check_out,
  }));
}
