import React, { useEffect, useState, useCallback } from 'react';
import { User } from '../types';
import {
  ChevronRight, Users, Search, UserPlus, Check, X as XIcon, Loader2,
  MessageCircle, Clock, UserMinus,
} from 'lucide-react';
import {
  FriendRequestRow, ConversationSummary, searchUsers, sendFriendRequest,
  respondFriendRequest, cancelFriendRequest, removeFriend, loadFriendRequests,
  getConversations,
} from './social';

interface FriendsScreenProps {
  currentUser: User;
  onBack: () => void;
  onOpenChat: (friendId: string, friendName: string) => void;
}

const ERROR_MESSAGES: Record<string, string> = {
  ALREADY_FRIENDS: 'أنتم أصدقاء بالفعل.',
  REQUEST_ALREADY_SENT: 'الطلب مُرسل بالفعل، في انتظار الرد.',
  CANNOT_FRIEND_SELF: 'لا يمكنك إضافة نفسك.',
  USER_NOT_FOUND: 'المستخدم غير موجود.',
};

export default function FriendsScreen({ currentUser, onBack, onOpenChat }: FriendsScreenProps) {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<{ id: string; name: string }[]>([]);
  const [searchNote, setSearchNote] = useState<string | null>(null);

  const [requests, setRequests] = useState<FriendRequestRow[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | number | null>(null);

  const refresh = useCallback(async () => {
    const [reqs, convos] = await Promise.all([loadFriendRequests(), getConversations()]);
    setRequests(reqs);
    setConversations(convos);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleSearch = async () => {
    if (query.trim().length < 2) { setSearchNote('اكتب حرفين على الأقل.'); return; }
    setSearching(true);
    setSearchNote(null);
    const results = await searchUsers(query.trim());
    setSearchResults(results);
    setSearching(false);
    if (results.length === 0) setSearchNote('لا يوجد نتائج.');
  };

  const handleSendRequest = async (id: string) => {
    setBusyId(id);
    const result = await sendFriendRequest(id);
    setBusyId(null);
    if (result.ok === false) {
      setSearchNote(ERROR_MESSAGES[result.error] ?? 'حدث خطأ، حاول مرة أخرى.');
      return;
    }
    setSearchResults((prev) => prev.filter((u) => u.id !== id));
    setSearchNote(result.status === 'accepted' ? 'أصبحتما أصدقاء! 🎉' : 'تم إرسال طلب الصداقة.');
    refresh();
  };

  const handleRespond = async (requestId: number, accept: boolean) => {
    setBusyId(requestId);
    await respondFriendRequest(requestId, accept);
    setBusyId(null);
    refresh();
  };

  const handleCancel = async (requestId: number) => {
    setBusyId(requestId);
    await cancelFriendRequest(requestId);
    setBusyId(null);
    refresh();
  };

  const handleRemoveFriend = async (id: string) => {
    setBusyId(id);
    await removeFriend(id);
    setBusyId(null);
    refresh();
  };

  const incoming = requests.filter((r) => r.addresseeId === currentUser.id && r.status === 'pending');
  const outgoing = requests.filter((r) => r.requesterId === currentUser.id && r.status === 'pending');
  const friends = requests
    .filter((r) => r.status === 'accepted')
    .map((r) => (r.requesterId === currentUser.id
      ? { id: r.addresseeId, name: r.addresseeName }
      : { id: r.requesterId, name: r.requesterName }));

  const convoByUser = new Map(conversations.map((c) => [c.otherUserId, c]));

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0A1428] via-[#0E1A33] to-[#08101F] text-slate-100 -mx-4 -my-6 sm:mx-0 sm:my-0 sm:rounded-3xl overflow-hidden">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-5 space-y-5" dir="rtl">

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
            <span>رجوع</span>
          </button>
          <div className="flex items-center gap-1.5">
            <Users className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-black tracking-wider text-slate-200">الأصدقاء</span>
          </div>
          <div className="w-14" aria-hidden />
        </div>

        {/* Search / add friend */}
        <div className="bg-gradient-to-br from-[#132247] to-[#0A1732] border border-white/10 rounded-3xl p-4 shadow-xl space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl px-3 py-2.5">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
                placeholder="ابحث بالاسم..."
                className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 outline-none min-w-0"
              />
            </div>
            <button
              type="button"
              onClick={handleSearch}
              disabled={searching}
              className="flex items-center justify-center gap-1.5 bg-gradient-to-l from-amber-500 to-amber-700 hover:from-amber-400 hover:to-amber-600 disabled:opacity-60 text-white text-xs font-black px-4 py-2.5 rounded-2xl shadow-lg transition-colors shrink-0"
            >
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'بحث'}
            </button>
          </div>

          {searchNote && <p className="text-[11px] text-amber-300 font-bold px-1">{searchNote}</p>}

          {searchResults.length > 0 && (
            <div className="space-y-2 pt-1">
              {searchResults.map((u) => (
                <div key={u.id} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl p-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center shrink-0 text-sm font-black text-white">
                    {u.name.charAt(0)}
                  </div>
                  <span className="flex-1 min-w-0 text-sm font-bold text-white truncate">{u.name}</span>
                  <button
                    type="button"
                    onClick={() => handleSendRequest(u.id)}
                    disabled={busyId === u.id}
                    className="flex items-center gap-1 text-[10px] font-black text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1.5 rounded-xl hover:bg-emerald-500/25 disabled:opacity-60 transition-colors shrink-0"
                  >
                    {busyId === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />}
                    إضافة
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 text-slate-400 py-8">
            <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
            <span className="text-xs font-bold">جارٍ التحميل...</span>
          </div>
        ) : (
          <>
            {/* Incoming requests */}
            {incoming.length > 0 && (
              <div className="space-y-2.5">
                <h3 className="text-xs font-black text-slate-300 px-1">طلبات صداقة واردة ({incoming.length})</h3>
                {incoming.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 bg-gradient-to-br from-[#152A55] to-[#0D1B3B] border border-amber-500/30 rounded-2xl p-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shrink-0 text-sm font-black text-white">
                      {r.requesterName.charAt(0)}
                    </div>
                    <span className="flex-1 min-w-0 text-sm font-bold text-white truncate">{r.requesterName}</span>
                    <button
                      type="button"
                      onClick={() => handleRespond(r.id, true)}
                      disabled={busyId === r.id}
                      className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-60 transition-colors"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRespond(r.id, false)}
                      disabled={busyId === r.id}
                      className="p-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 hover:bg-rose-500/25 disabled:opacity-60 transition-colors"
                    >
                      <XIcon className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Outgoing requests */}
            {outgoing.length > 0 && (
              <div className="space-y-2.5">
                <h3 className="text-xs font-black text-slate-300 px-1">طلبات مرسلة ({outgoing.length})</h3>
                {outgoing.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl p-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center shrink-0 text-sm font-black text-white">
                      {r.addresseeName.charAt(0)}
                    </div>
                    <span className="flex-1 min-w-0 text-sm font-bold text-white truncate">{r.addresseeName}</span>
                    <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                      <Clock className="w-3 h-3" />
                      في الانتظار
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCancel(r.id)}
                      disabled={busyId === r.id}
                      className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-rose-300 hover:border-rose-500/30 disabled:opacity-60 transition-colors"
                    >
                      <XIcon className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Friends list */}
            <div className="space-y-2.5">
              <h3 className="text-xs font-black text-slate-300 px-1">أصدقاؤك ({friends.length})</h3>
              {friends.length === 0 ? (
                <div className="text-center py-8 bg-white/[0.03] border border-white/5 rounded-2xl">
                  <Users className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-500 font-bold">لسه معندكش أصدقاء. ابحث بالاسم وابعت طلب!</p>
                </div>
              ) : (
                friends.map((f) => {
                  const convo = convoByUser.get(f.id);
                  return (
                    <button
                      type="button"
                      key={f.id}
                      onClick={() => onOpenChat(f.id, f.name)}
                      className="w-full text-right flex items-center gap-3 bg-gradient-to-br from-[#152A55] to-[#0D1B3B] border border-white/10 hover:border-amber-500/30 rounded-2xl p-3 transition-all group"
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shrink-0 text-sm font-black text-white">
                        {f.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white truncate">{f.name}</p>
                        <p className="text-[10.5px] text-slate-400 truncate">
                          {convo ? convo.lastMessage : 'ابدأ محادثة'}
                        </p>
                      </div>
                      {convo && convo.unreadCount > 0 && (
                        <span className="w-5 h-5 rounded-full bg-emerald-500 text-white text-[9px] font-black flex items-center justify-center shrink-0">
                          {convo.unreadCount > 9 ? '9+' : convo.unreadCount}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleRemoveFriend(f.id); }}
                        disabled={busyId === f.id}
                        className="p-1.5 rounded-lg text-slate-600 hover:text-rose-300 hover:bg-rose-500/10 disabled:opacity-60 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                        title="إزالة الصديق"
                      >
                        <UserMinus className="w-3.5 h-3.5" />
                      </button>
                      <MessageCircle className="w-4 h-4 text-slate-600 group-hover:text-amber-400 transition-colors shrink-0" />
                    </button>
                  );
                })
              )}
            </div>
          </>
        )}

      </div>
    </div>
  );
}
