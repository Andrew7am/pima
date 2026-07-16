// Friends + 1:1 chat helpers — thin wrappers around the migration-038
// RPCs, plus a subscribeToIncomingMessages() Realtime channel. Same
// trust model as multiplayer.ts: the client never writes to
// friend_requests/direct_messages directly, only through RPCs that
// read auth.uid() server-side.

import { supabase } from '../lib/supabase';

export interface FriendRequestRow {
  id: number;
  requesterId: string;
  requesterName: string;
  addresseeId: string;
  addresseeName: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
  respondedAt: string | null;
}

export interface Friend {
  userId: string;
  name: string;
  since: string;
}

export interface ConversationSummary {
  otherUserId: string;
  otherUserName: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

export interface DirectMessage {
  id: number;
  senderId: string;
  senderName: string;
  receiverId: string;
  receiverName: string;
  content: string;
  createdAt: string;
  readAt: string | null;
}

function mapRequest(r: Record<string, unknown>): FriendRequestRow {
  return {
    id: r.id as number,
    requesterId: r.requester_id as string,
    requesterName: r.requester_name as string,
    addresseeId: r.addressee_id as string,
    addresseeName: r.addressee_name as string,
    status: r.status as FriendRequestRow['status'],
    createdAt: r.created_at as string,
    respondedAt: (r.responded_at as string) ?? null,
  };
}

function mapMessage(r: Record<string, unknown>): DirectMessage {
  return {
    id: r.id as number,
    senderId: r.sender_id as string,
    senderName: r.sender_name as string,
    receiverId: r.receiver_id as string,
    receiverName: r.receiver_name as string,
    content: r.content as string,
    createdAt: r.created_at as string,
    readAt: (r.read_at as string) ?? null,
  };
}

export async function searchUsers(query: string): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase.rpc('search_users', { p_query: query });
  if (error) { console.error('searchUsers:', error); return []; }
  return (data as { id: string; name: string }[]) ?? [];
}

// Returns the new status ('pending' | 'accepted') on success, or an
// error code string from the RPC (ALREADY_FRIENDS, REQUEST_ALREADY_SENT, ...).
export async function sendFriendRequest(addresseeId: string): Promise<{ ok: true; status: string } | { ok: false; error: string }> {
  const { data, error } = await supabase.rpc('send_friend_request', { p_addressee_id: addresseeId });
  if (error) return { ok: false, error: error.message };
  return { ok: true, status: data as string };
}

export async function respondFriendRequest(requestId: number, accept: boolean): Promise<boolean> {
  const { error } = await supabase.rpc('respond_friend_request', { p_request_id: requestId, p_accept: accept });
  if (error) { console.error('respondFriendRequest:', error); return false; }
  return true;
}

export async function cancelFriendRequest(requestId: number): Promise<boolean> {
  const { error } = await supabase.rpc('cancel_friend_request', { p_request_id: requestId });
  if (error) { console.error('cancelFriendRequest:', error); return false; }
  return true;
}

export async function removeFriend(otherUserId: string): Promise<boolean> {
  const { error } = await supabase.rpc('remove_friend', { p_other_user_id: otherUserId });
  if (error) { console.error('removeFriend:', error); return false; }
  return true;
}

// Loads every friend_requests row the current user participates in —
// RLS already scopes this to just their own rows. Caller splits it
// into incoming/outgoing/friends by comparing against their own id.
export async function loadFriendRequests(): Promise<FriendRequestRow[]> {
  const { data, error } = await supabase
    .from('friend_requests')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error('loadFriendRequests:', error); return []; }
  return (data ?? []).map(mapRequest);
}

export async function getConversations(): Promise<ConversationSummary[]> {
  const { data, error } = await supabase.rpc('get_conversations');
  if (error) { console.error('getConversations:', error); return []; }
  return ((data as Record<string, unknown>[]) ?? []).map((r) => ({
    otherUserId: r.other_user_id as string,
    otherUserName: r.other_user_name as string,
    lastMessage: r.last_message as string,
    lastMessageAt: r.last_message_at as string,
    unreadCount: r.unread_count as number,
  }));
}

export async function loadMessages(myId: string, otherId: string): Promise<DirectMessage[]> {
  const { data, error } = await supabase
    .from('direct_messages')
    .select('*')
    .or(`and(sender_id.eq.${myId},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${myId})`)
    .order('created_at', { ascending: true });
  if (error) { console.error('loadMessages:', error); return []; }
  return (data ?? []).map(mapMessage);
}

export async function sendMessage(receiverId: string, content: string): Promise<DirectMessage | null> {
  const { data, error } = await supabase.rpc('send_message', { p_receiver_id: receiverId, p_content: content });
  if (error) { console.error('sendMessage:', error); return null; }
  return data ? mapMessage(data as Record<string, unknown>) : null;
}

export async function markMessagesRead(otherUserId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_messages_read', { p_other_user_id: otherUserId });
  if (error) console.error('markMessagesRead:', error);
}

// Opens a Realtime channel for messages arriving TO myId. Used both
// inside an open chat thread (filtered further client-side to the
// current partner) and, later, for a global unread badge. Returns an
// unsubscribe function — caller MUST call it on unmount.
export function subscribeToIncomingMessages(myId: string, onMessage: (msg: DirectMessage) => void): () => void {
  const channel = supabase
    .channel(`direct_messages:${myId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `receiver_id=eq.${myId}` },
      (payload) => { onMessage(mapMessage(payload.new as Record<string, unknown>)); },
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
