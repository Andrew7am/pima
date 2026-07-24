// Supabase-backed socialService for the ported 1v1 random-match screen.
// Same surface the source expected, but wired to the app's REAL friend system
// (public.friend_requests + send/respond RPCs, migration 038) so a friendship
// made from a match shows up everywhere else (FriendsScreen, chat).
import { supabase } from '../lib/supabase';

export interface FriendRequest {
  id: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string | number | null;
}

type FRRow = {
  id: number;
  requester_id: string;
  requester_name: string;
  addressee_id: string;
  addressee_name: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
};

async function myId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

async function loadRows(): Promise<FRRow[]> {
  // RLS returns only rows where the caller is requester or addressee.
  const { data } = await supabase.from('friend_requests').select('*');
  return (data ?? []) as FRRow[];
}

export const socialService = {
  async sendFriendRequest(receiverId: string, _senderName: string) {
    const { error } = await supabase.rpc('send_friend_request', { p_addressee_id: receiverId });
    if (error) throw new Error(error.message);
  },

  async getFriendRequestStatus(receiverId: string): Promise<'none' | 'pending' | 'accepted' | 'rejected'> {
    const me = await myId();
    if (!me) return 'none';
    const rows = await loadRows();
    const row = rows.find(
      (r) =>
        (r.requester_id === me && r.addressee_id === receiverId) ||
        (r.requester_id === receiverId && r.addressee_id === me)
    );
    if (!row) return 'none';
    return row.status === 'declined' ? 'rejected' : row.status;
  },

  async acceptFriendRequest(requestId: string, _senderId: string, _senderName: string, _receiverName: string) {
    const { error } = await supabase.rpc('respond_friend_request', { p_request_id: Number(requestId), p_accept: true });
    if (error) throw new Error(error.message);
  },

  async rejectFriendRequest(requestId: string) {
    const { error } = await supabase.rpc('respond_friend_request', { p_request_id: Number(requestId), p_accept: false });
    if (error) throw new Error(error.message);
  },

  async updatePresence(_userId: string) {
    /* presence is not tracked in this build — no-op */
  },

  subscribeToFriends(userId: string, callback: (friends: unknown[]) => void) {
    const load = async () => {
      const rows = (await loadRows()).filter((r) => r.status === 'accepted');
      const friends = rows.map((r) => {
        const iAmRequester = r.requester_id === userId;
        const uid = iAmRequester ? r.addressee_id : r.requester_id;
        const displayName = iAmRequester ? r.addressee_name : r.requester_name;
        return { id: uid, uid, displayName, isOnline: false, lastActive: null };
      });
      callback(friends);
    };
    load();
    const channel = supabase
      .channel(`rm_friends_${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_requests' }, () => { load(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  },

  subscribeToIncomingRequests(userId: string, callback: (requests: FriendRequest[]) => void) {
    const load = async () => {
      const rows = (await loadRows()).filter((r) => r.addressee_id === userId && r.status === 'pending');
      callback(
        rows.map((r) => ({
          id: String(r.id),
          senderId: r.requester_id,
          senderName: r.requester_name,
          receiverId: r.addressee_id,
          status: 'pending' as const,
          createdAt: r.created_at,
        }))
      );
    };
    load();
    const channel = supabase
      .channel(`rm_incoming_${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_requests' }, () => { load(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  },
};
