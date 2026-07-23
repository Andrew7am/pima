import { supabase } from './supabase';
import { BookingMessage } from '../types';

function mapBookingMessage(r: Record<string, unknown>): BookingMessage {
  return {
    id: r.id as number,
    bookingId: r.booking_id as string,
    senderId: r.sender_id as string,
    senderName: r.sender_name as string,
    content: r.content as string,
    createdAt: r.created_at as string,
    readAt: r.read_at as string ?? undefined,
    attachmentUrl: (r.attachment_url as string) ?? undefined,
    attachmentType: (r.attachment_type as BookingMessage['attachmentType']) ?? undefined,
    attachmentName: (r.attachment_name as string) ?? undefined,
    replyToId: (r.reply_to_id as number) ?? undefined,
    deletedAt: (r.deleted_at as string) ?? undefined,
  };
}

export interface OutgoingAttachment {
  url: string; // data URL
  type: 'image' | 'file';
  name?: string;
}

export async function sendBookingMessage(bookingId: string, content: string, attachment?: OutgoingAttachment, replyToId?: number): Promise<BookingMessage | null> {
  const { data, error } = await supabase.rpc('send_booking_message', {
    p_booking_id: bookingId,
    p_content: content,
    p_attachment_url: attachment?.url ?? null,
    p_attachment_type: attachment?.type ?? null,
    p_attachment_name: attachment?.name ?? null,
    p_reply_to: replyToId ?? null,
  });
  if (error) { console.error('sendBookingMessage:', error); return null; }
  return data ? mapBookingMessage(data as Record<string, unknown>) : null;
}

export async function deleteBookingMessage(id: number): Promise<boolean> {
  const { error } = await supabase.rpc('delete_booking_message', { p_id: id });
  if (error) { console.error('deleteBookingMessage:', error); return false; }
  return true;
}

export async function loadBookingMessages(bookingId: string): Promise<BookingMessage[]> {
  const { data, error } = await supabase
    .from('booking_messages')
    .select('*')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: true });
  if (error) { console.error('loadBookingMessages:', error); return []; }
  return (data ?? []).map(mapBookingMessage);
}

export async function markBookingMessagesRead(bookingId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_booking_messages_read', { p_booking_id: bookingId });
  if (error) console.error('markBookingMessagesRead:', error);
}

// Chat-list previews: latest message per booking (single query, RLS
// naturally scopes to bookings the caller participates in). One row per
// booking — used to render the WhatsApp-style conversation list.
export async function loadLatestMessagePerBooking(bookingIds: string[]): Promise<Record<string, BookingMessage>> {
  if (bookingIds.length === 0) return {};
  const { data, error } = await supabase
    .from('booking_messages')
    .select('*')
    .in('booking_id', bookingIds)
    .order('booking_id', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) { console.error('loadLatestMessagePerBooking:', error); return {}; }
  const latest: Record<string, BookingMessage> = {};
  for (const row of data ?? []) {
    const msg = mapBookingMessage(row as Record<string, unknown>);
    // Take the first row per booking_id (ordered desc by created_at).
    if (!latest[msg.bookingId]) latest[msg.bookingId] = msg;
  }
  return latest;
}

// Unread count per booking for the current viewer — inbound messages
// (someone else sent) with no read_at yet. Used for the badge next to
// each conversation row.
export async function loadUnreadCountsPerBooking(bookingIds: string[], currentUserId: string): Promise<Record<string, number>> {
  if (bookingIds.length === 0) return {};
  const { data, error } = await supabase
    .from('booking_messages')
    .select('booking_id')
    .in('booking_id', bookingIds)
    .neq('sender_id', currentUserId)
    .is('read_at', null);
  if (error) { console.error('loadUnreadCountsPerBooking:', error); return {}; }
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const bid = row.booking_id as string;
    counts[bid] = (counts[bid] || 0) + 1;
  }
  return counts;
}

// Returns an unsubscribe function — caller MUST call it on unmount.
export function subscribeToBookingMessages(bookingId: string, onMessage: (msg: BookingMessage) => void): () => void {
  const channel = supabase
    .channel(`booking_messages:${bookingId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'booking_messages', filter: `booking_id=eq.${bookingId}` },
      (payload) => { onMessage(mapBookingMessage(payload.new as Record<string, unknown>)); },
    )
    // Deletes are soft (deleted_at) — they arrive as UPDATE; the caller
    // upserts so the message flips to its "deleted" placeholder live.
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'booking_messages', filter: `booking_id=eq.${bookingId}` },
      (payload) => { onMessage(mapBookingMessage(payload.new as Record<string, unknown>)); },
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

// "Someone is typing" — a separate Presence channel (not the message-insert
// one above) so typing state never touches the DB. Caller gets back
// `setTyping` (call on every keystroke, debounced by the caller) and
// `unsubscribe` (call on unmount) sharing one channel instance.
export function subscribeToTypingPresence(
  bookingId: string,
  currentUserId: string,
  onTypingChange: (typingUserIds: string[]) => void,
): { setTyping: (isTyping: boolean) => void; unsubscribe: () => void } {
  const channel = supabase.channel(`booking_typing:${bookingId}`, { config: { presence: { key: currentUserId } } });

  const emitState = () => {
    const state = channel.presenceState() as Record<string, { typing?: boolean }[]>;
    const typingUserIds = Object.entries(state)
      .filter(([userId, presences]) => userId !== currentUserId && presences.some((p) => p.typing))
      .map(([userId]) => userId);
    onTypingChange(typingUserIds);
  };

  channel.on('presence', { event: 'sync' }, emitState);
  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') channel.track({ typing: false });
  });

  return {
    setTyping: (isTyping: boolean) => { channel.track({ typing: isTyping }); },
    unsubscribe: () => { supabase.removeChannel(channel); },
  };
}
