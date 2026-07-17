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
  };
}

export async function sendBookingMessage(bookingId: string, content: string): Promise<BookingMessage | null> {
  const { data, error } = await supabase.rpc('send_booking_message', { p_booking_id: bookingId, p_content: content });
  if (error) { console.error('sendBookingMessage:', error); return null; }
  return data ? mapBookingMessage(data as Record<string, unknown>) : null;
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

// Returns an unsubscribe function — caller MUST call it on unmount.
export function subscribeToBookingMessages(bookingId: string, onMessage: (msg: BookingMessage) => void): () => void {
  const channel = supabase
    .channel(`booking_messages:${bookingId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'booking_messages', filter: `booking_id=eq.${bookingId}` },
      (payload) => { onMessage(mapBookingMessage(payload.new as Record<string, unknown>)); },
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
