// Supabase-backed spiritual journal (ported from the source's Firestore layer).
// Private per-user entries; same public surface as the original so the
// SpiritualJournal component stays unchanged. See migration 074_conference_hub.sql.
import { supabase } from './supabase';
import { SpiritualJournalEntry } from '../types';

const TABLE = 'spiritual_journals';

type Row = {
  id: string;
  user_id: string;
  title: string;
  content: string;
  favorite_verses: string[] | null;
  decisions: string[] | null;
  created_at: string;
  updated_at: string;
};

function rowToEntry(r: Row): SpiritualJournalEntry {
  return {
    id: r.id,
    userId: r.user_id,
    title: r.title,
    content: r.content,
    favoriteVerses: r.favorite_verses || [],
    decisions: r.decisions || [],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function getUserSpiritualJournalEntries(userId: string): Promise<SpiritualJournalEntry[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) { console.warn('getUserSpiritualJournalEntries:', error.message); return []; }
  return ((data ?? []) as Row[]).map(rowToEntry);
}

export function listenToUserSpiritualJournalEntries(
  userId: string,
  onUpdate: (entries: SpiritualJournalEntry[]) => void,
  onError?: (err: unknown) => void
): () => void {
  getUserSpiritualJournalEntries(userId).then(onUpdate).catch((e) => onError?.(e));
  const channel = supabase
    .channel(`spiritual_journals_${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: TABLE, filter: `user_id=eq.${userId}` }, async () => {
      onUpdate(await getUserSpiritualJournalEntries(userId));
    })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

export async function createSpiritualJournalEntry(
  entry: Omit<SpiritualJournalEntry, 'createdAt' | 'updatedAt'>
): Promise<SpiritualJournalEntry> {
  const now = new Date().toISOString();
  const newEntry: SpiritualJournalEntry = { ...entry, createdAt: now, updatedAt: now };
  const { error } = await supabase.from(TABLE).insert({
    id: newEntry.id,
    user_id: newEntry.userId,
    title: newEntry.title,
    content: newEntry.content,
    favorite_verses: newEntry.favoriteVerses,
    decisions: newEntry.decisions,
    created_at: newEntry.createdAt,
    updated_at: newEntry.updatedAt,
  });
  if (error) console.warn('createSpiritualJournalEntry:', error.message);
  return newEntry;
}

export async function updateSpiritualJournalEntry(
  id: string,
  updates: Partial<Omit<SpiritualJournalEntry, 'id' | 'userId' | 'createdAt'>>
): Promise<void> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.content !== undefined) payload.content = updates.content;
  if (updates.favoriteVerses !== undefined) payload.favorite_verses = updates.favoriteVerses;
  if (updates.decisions !== undefined) payload.decisions = updates.decisions;
  const { error } = await supabase.from(TABLE).update(payload).eq('id', id);
  if (error) console.warn('updateSpiritualJournalEntry:', error.message);
}

export async function deleteSpiritualJournalEntry(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) console.warn('deleteSpiritualJournalEntry:', error.message);
}
