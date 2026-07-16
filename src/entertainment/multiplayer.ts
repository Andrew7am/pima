// Multiplayer helpers — thin wrappers around the migration-036 RPCs
// plus a small subscribeToRoom() that opens a Supabase Realtime channel
// scoped to a single game_rooms row. RLS already restricts SELECT on
// that row to the two participants (+ admin), so the channel's payload
// is naturally scoped correctly.

import { supabase } from '../lib/supabase';

export type GameMode = 'trivia' | 'hymns' | 'fillverse' | 'whoami';

export interface RoomQuestion {
  question: string;
  options: string[];
  correctIdx: number;
  explanation: string;
}

// Shape matches the migration-036 columns; snake_case straight from the row.
export interface GameRoom {
  id: string;
  is_private: boolean;
  game_mode: GameMode;
  host_user_id: string;
  host_name: string;
  host_rating: number;
  guest_user_id: string | null;
  guest_name: string | null;
  guest_rating: number | null;
  status: 'waiting' | 'active' | 'finished' | 'cancelled';
  questions: RoomQuestion[];
  host_score: number;
  guest_score: number;
  host_answers: Record<string, number>;
  guest_answers: Record<string, number>;
  current_question: number;
  winner_user_id: string | null;
  host_rating_change: number | null;
  guest_rating_change: number | null;
  created_at: string;
  finished_at: string | null;
}

export async function createPrivateRoom(mode: GameMode, questions: RoomQuestion[]): Promise<string | null> {
  const { data, error } = await supabase.rpc('create_private_room', { p_game_mode: mode, p_questions: questions });
  if (error) { console.error('createPrivateRoom:', error); return null; }
  return data as string;
}

export async function findOrCreateRandomRoom(
  mode: GameMode,
  questions: RoomQuestion[],
): Promise<{ roomId: string; wasCreated: boolean } | null> {
  const { data, error } = await supabase.rpc('find_or_create_random_room', {
    p_game_mode: mode, p_questions: questions,
  });
  if (error) { console.error('findOrCreateRandomRoom:', error); return null; }
  const row = data?.[0];
  if (!row) return null;
  return { roomId: row.room_id, wasCreated: row.was_created };
}

export async function joinRoomByCode(code: string): Promise<{ ok: boolean; roomId?: string; error?: string }> {
  const { data, error } = await supabase.rpc('join_room_by_code', { p_code: code });
  if (error) return { ok: false, error: error.message };
  return { ok: true, roomId: data as string };
}

export async function submitAnswer(
  roomId: string, qIdx: number, optIdx: number,
): Promise<{ hostScore: number; guestScore: number; bothAnswered: boolean } | null> {
  const { data, error } = await supabase.rpc('submit_answer', {
    p_room_id: roomId, p_q_idx: qIdx, p_opt_idx: optIdx,
  });
  if (error) { console.error('submitAnswer:', error); return null; }
  const row = data?.[0];
  if (!row) return null;
  return { hostScore: row.host_score, guestScore: row.guest_score, bothAnswered: row.both_answered };
}

export interface FinalizeResult {
  hostRatingChange: number;
  guestRatingChange: number;
  hostNewRating: number;
  guestNewRating: number;
  winnerUserId: string | null;
}

export async function finalizeMatch(roomId: string): Promise<FinalizeResult | null> {
  const { data, error } = await supabase.rpc('finalize_match', { p_room_id: roomId });
  if (error) { console.error('finalizeMatch:', error); return null; }
  const row = data?.[0];
  if (!row) return null;
  return {
    hostRatingChange: row.host_rating_change,
    guestRatingChange: row.guest_rating_change,
    hostNewRating: row.host_new_rating,
    guestNewRating: row.guest_new_rating,
    winnerUserId: row.winner_user_id,
  };
}

export async function loadRoom(roomId: string): Promise<GameRoom | null> {
  const { data, error } = await supabase.from('game_rooms').select('*').eq('id', roomId).maybeSingle();
  if (error) { console.error('loadRoom:', error); return null; }
  return data as GameRoom | null;
}

// Opens a Realtime channel and calls `onChange` whenever the row updates.
// Returns an unsubscribe function — caller MUST call it on unmount.
export function subscribeToRoom(roomId: string, onChange: (room: GameRoom) => void): () => void {
  const channel = supabase
    .channel(`game_room:${roomId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'game_rooms', filter: `id=eq.${roomId}` },
      (payload) => { onChange(payload.new as GameRoom); },
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
