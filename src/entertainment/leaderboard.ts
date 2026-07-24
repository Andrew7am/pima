import { supabase } from '../lib/supabase';

// A leaderboard row — `points` is the ranking score (entertainment XP), aliased
// so the ported TopLeaders UI reads it unchanged.
export interface LeaderRow {
  id: string;
  name: string;
  avatar_url: string | null;
  points: number;
}

// Top players by XP via the SECURITY DEFINER RPC (migration 072) — needed
// because RLS otherwise hands a regular user only their own row.
export async function loadLeaderboard(limit = 10): Promise<LeaderRow[]> {
  const { data, error } = await supabase.rpc('get_leaderboard', { p_limit: limit });
  if (error) { console.warn('loadLeaderboard:', error); return []; }
  return (data ?? []) as LeaderRow[];
}

export async function loadMyRank(): Promise<{ total_players: number; my_rank: number } | null> {
  const { data, error } = await supabase.rpc('get_my_rank');
  if (error) { console.warn('loadMyRank:', error); return null; }
  const row = (data ?? [])[0] as { total_players: number; my_rank: number } | undefined;
  return row ?? null;
}
