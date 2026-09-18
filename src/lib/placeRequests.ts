import { supabase } from './supabase';

/**
 * What people asked for and Pima did not have (migration 0165).
 *
 * The filter offers twenty-seven governorates and Pima has houses in one, so
 * almost every place someone picks ends on an empty list. That moment used to
 * be where the visit ended. Now it asks for a number, and the rows it keeps
 * are the closest thing the platform has to a map of its own demand: where to
 * go and find the next house, with names and dates attached.
 *
 * Reads are admin-only and enforced in the database, not here.
 */

export interface PlaceRequest {
  id: string;
  createdAt: string;
  userId: string | null;
  name: string;
  phone: string;
  governorate: string | null;
  checkIn: string | null;
  checkOut: string | null;
  guests: number | null;
  note: string | null;
  status: 'new' | 'contacted' | 'closed';
}

export function mapPlaceRequest(r: Record<string, unknown>): PlaceRequest {
  return {
    id: r.id as string,
    createdAt: r.created_at as string,
    userId: (r.user_id as string) ?? null,
    name: r.name as string,
    phone: r.phone as string,
    governorate: (r.governorate as string) ?? null,
    checkIn: (r.check_in as string) ?? null,
    checkOut: (r.check_out as string) ?? null,
    guests: r.guests == null ? null : Number(r.guests),
    note: (r.note as string) ?? null,
    status: (r.status as PlaceRequest['status']) ?? 'new',
  };
}

export interface PlaceRequestInput {
  name: string;
  phone: string;
  governorate?: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
  guests?: number | null;
  note?: string | null;
}

/**
 * Leave a number against a place Pima has nothing in.
 *
 * Open to a signed-out visitor on purpose — they are most of who sees the
 * empty result, and making them register first is the dead end again. The
 * validation that matters is in the RPC; what is here is only so the field
 * can say what is wrong before a round trip.
 */
export async function requestPlace(
  input: PlaceRequestInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.rpc('request_place', {
    p_name: input.name,
    p_phone: input.phone,
    p_governorate: input.governorate ?? null,
    p_check_in: input.checkIn || null,
    p_check_out: input.checkOut || null,
    p_guests: input.guests ?? null,
    p_note: input.note ?? null,
  });
  if (error) {
    console.error('requestPlace:', error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/**
 * Arabic as people actually type it.
 *
 * «الاسكندرية» and «الإسكندرية» are the same place and different strings, and
 * nobody reaching for a phone keyboard at speed puts the hamza on. Matching
 * without this means the request is filed under «من غير محافظة» and the
 * ranking — the reason the table exists — never learns the place was wanted.
 */
function normalizeArabic(s: string): string {
  return s
    .trim()
    .replace(/[\u0623\u0625\u0622]/g, '\u0627')  // أ إ آ  →  ا
    .replace(/\u0629/g, '\u0647')              // ة      →  ه
    .replace(/\u0649/g, '\u064A')              // ى      →  ي
    .replace(/[\u064B-\u0652]/g, '')          // tashkeel
    .replace(/\s+/g, ' ');
}

/**
 * Which governorate, if any, the typed text was reaching for.
 *
 * The filter has a governorate field, but almost nobody opens it: they type
 * «المنيا» into the search box, and the suggestion list cannot help because
 * it is built from governorates that HAVE houses — which is exactly the set
 * this case is not in. So the place would arrive as free text in the note and
 * nowhere else, and the demand ranking would be a single «من غير محافظة» bar.
 *
 * The list is passed in rather than imported so this file stays clear of
 * mockData, and so a test can state its own list.
 */
export function matchGovernorate(query: string, known: string[]): string | null {
  const q = normalizeArabic(query);
  if (q.length < 3) return null;   // «قنا» is the shortest real name
  const exact = known.find((g) => normalizeArabic(g) === q);
  if (exact) return exact;
  // Either direction: «منيا» is inside «المنيا», and «محافظة المنيا» contains it.
  return known.find((g) => {
    const n = normalizeArabic(g);
    return n.includes(q) || q.includes(n);
  }) ?? null;
}

/** Admin only — RLS returns nothing to anybody else. */
export async function loadPlaceRequests(): Promise<PlaceRequest[]> {
  const { data, error } = await supabase
    .from('place_requests')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error('loadPlaceRequests:', error); return []; }
  return (data ?? []).map(mapPlaceRequest);
}

export async function setPlaceRequestStatus(
  id: string,
  status: PlaceRequest['status'],
): Promise<boolean> {
  const { error } = await supabase.from('place_requests').update({ status }).eq('id', id);
  if (error) { console.error('setPlaceRequestStatus:', error); return false; }
  return true;
}

/**
 * The count per place, biggest first.
 *
 * This is the reason the table exists. A list of names answers "who is
 * waiting"; this answers "where should the next house be", which is the
 * decision somebody actually has to make.
 *
 * Closed rows still count. A request that was answered is still evidence
 * that somebody wanted that governorate.
 */
export function demandByGovernorate(
  rows: PlaceRequest[],
): { governorate: string; count: number; people: number }[] {
  const by = new Map<string, { count: number; phones: Set<string> }>();
  for (const r of rows) {
    const key = r.governorate || 'من غير محافظة';
    const slot = by.get(key) ?? { count: 0, phones: new Set<string>() };
    slot.count += 1;
    slot.phones.add(r.phone);
    by.set(key, slot);
  }
  return [...by.entries()]
    .map(([governorate, s]) => ({ governorate, count: s.count, people: s.phones.size }))
    .sort((a, b) => b.count - a.count || a.governorate.localeCompare(b.governorate, 'ar'));
}
