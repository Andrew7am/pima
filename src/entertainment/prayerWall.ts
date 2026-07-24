import { supabase } from '../lib/supabase';

// A community prayer request as the UI consumes it. `isPraying` reflects whether
// the current user has tapped "أصلي" for it (derived from prayer_reactions).
export interface PrayerRequestRow {
  id: string;
  userId: string;
  authorName: string;
  church: string;
  text: string;
  prayersCount: number;
  createdAt: string;
  isPraying: boolean;
  isMine: boolean;
}

function mapRow(r: Record<string, unknown>, myId: string, prayingIds: Set<string>): PrayerRequestRow {
  const id = r.id as string;
  return {
    id,
    userId: r.user_id as string,
    authorName: (r.author_name as string) ?? 'خادم',
    church: (r.church as string) ?? '',
    text: (r.text as string) ?? '',
    prayersCount: (r.prayers_count as number) ?? 0,
    createdAt: r.created_at as string,
    isPraying: prayingIds.has(id),
    isMine: (r.user_id as string) === myId,
  };
}

// Loads the wall newest-first plus the caller's own reactions (RLS lets a user
// read only their own reaction rows). Degrades to [] if migration 077 is not
// applied yet, so the section renders empty rather than crashing.
export async function loadPrayerRequests(myId: string, limit = 60): Promise<PrayerRequestRow[]> {
  const { data, error } = await supabase
    .from('prayer_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) { console.warn('loadPrayerRequests:', error.message); return []; }

  const { data: reactions } = await supabase
    .from('prayer_reactions')
    .select('prayer_id');
  const prayingIds = new Set<string>((reactions ?? []).map((x: Record<string, unknown>) => x.prayer_id as string));

  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>, myId, prayingIds));
}

// Posts a new request authored by the current user. Returns the created row.
export async function createPrayerRequest(input: {
  userId: string; authorName: string; church: string; text: string;
}): Promise<PrayerRequestRow | null> {
  const id = `pr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const { data, error } = await supabase
    .from('prayer_requests')
    .insert({
      id,
      user_id: input.userId,
      author_name: input.authorName,
      church: input.church,
      text: input.text,
    })
    .select('*')
    .single();
  if (error || !data) { console.error('createPrayerRequest:', error); return null; }
  return mapRow(data as Record<string, unknown>, input.userId, new Set());
}

// Toggles the caller's "أصلي" on a request; returns the fresh {praying,count}.
export async function togglePrayer(prayerId: string): Promise<{ praying: boolean; count: number } | null> {
  const { data, error } = await supabase.rpc('toggle_prayer', { p_prayer_id: prayerId });
  if (error) { console.error('togglePrayer:', error); return null; }
  const res = data as { ok?: boolean; praying?: boolean; count?: number } | null;
  if (!res || !res.ok) return null;
  return { praying: !!res.praying, count: res.count ?? 0 };
}

// Deletes the caller's own request (or admin). Returns success.
export async function deletePrayerRequest(prayerId: string): Promise<boolean> {
  const { error } = await supabase.from('prayer_requests').delete().eq('id', prayerId);
  if (error) { console.error('deletePrayerRequest:', error); return false; }
  return true;
}
