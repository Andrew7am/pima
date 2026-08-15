import { supabase } from './supabase';
import type { ConferenceRoom } from '../types';

/**
 * Reading and writing a conference (migration 121).
 *
 * The hub used to hold its whole state in App.tsx and nothing else, so a
 * servant's schedule, announcements and checklist vanished with the tab and
 * the group who booked never saw any of it.
 *
 * One row per booking. RLS decides who may read: the servant who booked, the
 * owner of the house, and admins — so these functions never filter by user
 * themselves, and a caller who is not entitled simply gets nothing back.
 */

type Row = {
  id: string;
  booking_id: string;
  house_id: string | null;
  house_name: string;
  title: string;
  organization_name: string;
  conference_code: string;
  qr_code_url: string | null;
  joining_requirements: 'open' | 'approval_needed';
  is_disabled: boolean;
  host_user_id: string;
  schedule: unknown;
  events: unknown;
  announcements: unknown;
  checklist: unknown;
  starts_at: string | null;
  ends_at: string | null;
  guests_count: number | null;
  house_governorate: string | null;
  house_address: string | null;
  house_lat: number | null;
  house_lng: number | null;
  host_phone: string | null;
  live_mode: unknown;
  joined_user_ids: unknown;
  notifications_log: unknown;
};

const toRoom = (r: Row): ConferenceRoom => ({
  id: r.id,
  bookingId: r.booking_id,
  houseId: r.house_id ?? undefined,
  houseName: r.house_name,
  title: r.title,
  organizationName: r.organization_name,
  startsAt: r.starts_at ?? undefined,
  endsAt: r.ends_at ?? undefined,
  guestsCount: r.guests_count ?? undefined,
  // Stamped server-side by create_conference_for_booking. Deliberately absent
  // from toRow below: the client saves the conference on every edit, and the
  // venue is not the client's to rewrite.
  houseGovernorate: r.house_governorate ?? undefined,
  houseAddress: r.house_address ?? undefined,
  houseLat: r.house_lat ?? undefined,
  houseLng: r.house_lng ?? undefined,
  hostPhone: r.host_phone ?? undefined,
  conferenceCode: r.conference_code,
  qrCodeUrl: r.qr_code_url ?? '',
  joiningRequirements: r.joining_requirements,
  isDisabled: r.is_disabled,
  hostUserId: r.host_user_id,
  // The columns default to '[]' and '{}', but a row written before a column
  // existed can still surface null — so every list is guarded rather than
  // trusted, and the hub never has to think about it.
  schedule: (r.schedule as ConferenceRoom['schedule']) ?? [],
  events: (r.events as ConferenceRoom['events']) ?? [],
  announcements: (r.announcements as ConferenceRoom['announcements']) ?? [],
  checklist: (r.checklist as ConferenceRoom['checklist']) ?? [],
  liveMode: (r.live_mode as ConferenceRoom['liveMode']) ?? ({} as ConferenceRoom['liveMode']),
  joinedUserIds: (r.joined_user_ids as ConferenceRoom['joinedUserIds']) ?? [],
  notificationsLog: (r.notifications_log as ConferenceRoom['notificationsLog']) ?? [],
});

const toRow = (c: ConferenceRoom) => ({
  id: c.id,
  booking_id: c.bookingId,
  house_id: c.houseId ?? null,
  house_name: c.houseName ?? '',
  title: c.title ?? '',
  organization_name: c.organizationName ?? '',
  starts_at: c.startsAt ?? null,
  ends_at: c.endsAt ?? null,
  guests_count: c.guestsCount ?? null,
  conference_code: c.conferenceCode,
  qr_code_url: c.qrCodeUrl ?? null,
  joining_requirements: c.joiningRequirements ?? 'open',
  is_disabled: c.isDisabled ?? false,
  host_user_id: c.hostUserId,
  schedule: c.schedule ?? [],
  events: c.events ?? [],
  announcements: c.announcements ?? [],
  checklist: c.checklist ?? [],
  live_mode: c.liveMode ?? {},
  joined_user_ids: c.joinedUserIds ?? [],
  notifications_log: c.notificationsLog ?? [],
});

/** The conference attached to one booking, or null if none has been made. */
export async function loadConference(bookingId: string): Promise<ConferenceRoom | null> {
  const { data, error } = await supabase
    .from('conferences').select('*').eq('booking_id', bookingId).maybeSingle();
  if (error) { console.error('loadConference:', error); return null; }
  return data ? toRoom(data as Row) : null;
}

/** Every conference this user can see — theirs to host, or theirs to attend. */
/**
 * The conferences you are actually in — hosting, or joined.
 *
 * The query is RLS-scoped, but RLS is wider than «mine» on purpose: migration
 * 124 also lets a house's owner and an admin read a conference, so they can
 * support it. Without the filter below, the caller's `[0]` was «the newest room
 * this account may read» — which for an owner is a guest church's room at their
 * house, and for an admin is any room on the platform. Both were then opened
 * automatically, with nobody having chosen anything.
 *
 * Pass the viewer's id. Omitting it returns the raw RLS view, which is what the
 * admin tooling wants and what nothing else should.
 */
export async function loadMyConferences(userId?: string): Promise<ConferenceRoom[]> {
  const { data, error } = await supabase
    .from('conferences').select('*').order('created_at', { ascending: false });
  if (error) { console.error('loadMyConferences:', error); return []; }
  const all = (data as Row[] ?? []).map(toRoom);
  if (!userId) return all;
  return all.filter(
    (c) => c.hostUserId === userId || (c.joinedUserIds ?? []).includes(userId)
  );
}

/**
 * Writes the whole conference. Upsert on booking_id, not id: a servant who
 * opens the hub twice must land on the same conference rather than raise a
 * second one against the same booking.
 */
export async function saveConference(c: ConferenceRoom): Promise<{ ok: boolean; error?: string }> {
  if (!c.bookingId) return { ok: false, error: 'المؤتمر لازم يكون مربوط بحجز.' };
  const { error } = await supabase
    .from('conferences').upsert(toRow(c), { onConflict: 'booking_id' });
  if (error) {
    console.error('saveConference:', error);
    // 42501 is RLS refusing the write — almost always a booking that is not
    // the caller's. Say that rather than «something went wrong».
    return { ok: false, error: error.code === '42501' ? 'الحجز ده مش بتاعك.' : error.message };
  }
  return { ok: true };
}

/**
 * Join by the code a servant read out. The code lets you ask; the row records
 * that you are in. Knowing a code is not itself authorisation — RLS grants
 * reading to joined_user_ids, not to whoever can type six characters.
 */
export async function joinConferenceByCode(code: string): Promise<
  { ok: true; conferenceId: string; title: string; alreadyJoined: boolean; needsApproval: boolean }
  | { ok: false; error: string }
> {
  const { data, error } = await supabase.rpc('join_conference_by_code', { code });
  if (error) {
    console.error('joinConferenceByCode:', error);
    // The RPC raises Arabic for the cases a guest can actually hit — a wrong
    // code, a closed conference — so those reach the screen verbatim.
    return { ok: false, error: error.message };
  }
  const d = data as { conferenceId: string; title: string; alreadyJoined: boolean; needsApproval: boolean };
  return { ok: true, ...d };
}

/** Leave, or — for the host — remove somebody. */
export async function leaveConference(conferenceId: string, userId?: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc('leave_conference', { conf_id: conferenceId, target: userId ?? null });
  if (error) { console.error('leaveConference:', error); return { ok: false, error: error.message }; }
  return { ok: true };
}

/**
 * Open the conference for a booking. Approval permits it; the servant decides.
 *
 * Most bookings never want a room — a family taking a weekend does not need a
 * join code and a QR — so this is a deliberate act rather than something that
 * happens to every approved booking.
 */
export async function createConferenceForBooking(bookingId: string): Promise<
  { ok: true; conferenceId: string; code: string; alreadyOpen: boolean }
  | { ok: false; error: string }
> {
  const { data, error } = await supabase.rpc('create_conference_for_booking', { p_booking_id: bookingId });
  if (error) {
    console.error('createConferenceForBooking:', error);
    // The RPC raises Arabic for the two an organiser can hit — a booking that
    // is not theirs, and one the owner has not approved yet.
    return { ok: false, error: error.message };
  }
  const d = data as { conferenceId: string; code: string; alreadyOpen: boolean };
  return { ok: true, ...d };
}
