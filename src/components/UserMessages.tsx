import React, { useEffect, useMemo, useState } from 'react';
import { Booking, RetreatHouse, User, BookingMessage } from '../types';
import { ChevronLeft, Headphones, Image as ImageIcon, Paperclip, Mic } from 'lucide-react';
import BookingChatPanel from './BookingChatPanel';
import { loadLatestMessagePerBooking, loadUnreadCountsPerBooking } from '../lib/bookingMessages';
import { formatChatTime } from '../lib/chatTime';
import { tapFeedback } from '../lib/haptics';
import {
  PimaAvatar, PimaReceipt, PimaLoadingRow, PimaEmptyState, PimaFilterChip,
  PimaSearchBar, PimaSectionTitle,
} from './chat/primitives';

interface UserMessagesProps {
  currentUser: User;
  bookings: Booking[];
  houses: RetreatHouse[];
  users: User[];
}

type Filter = 'all' | 'unread' | 'owners' | 'support';

// Guest-facing conversations list — one thread per HOUSE (i.e. per owner the
// guest has booked with). A guest with several bookings at the same house sees
// one conversation; opening it unifies those bookings into a single thread.
export default function UserMessages({ currentUser, bookings, houses, users }: UserMessagesProps) {
  const [selectedHouseId, setSelectedHouseId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [previews, setPreviews] = useState<Record<string, BookingMessage>>({});
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const myBookings = useMemo(() => bookings.filter(
    (b) => b.userId === currentUser.id && b.status !== 'rejected' && b.status !== 'cancelled',
  ), [bookings, currentUser.id]);

  const houseById = (id: string) => houses.find((h) => h.id === id);
  const ownerName = (b: Booking) => houseById(b.houseId)?.ownerName || 'صاحب البيت';
  // From the guest's side the conversation represents the house, and RLS hides
  // the owner's personal avatar anyway — so use one of the house's own photos.
  const ownerAvatar = (b: Booking) => {
    const h = houseById(b.houseId);
    return h?.images?.[0] ?? (h?.ownerId ? users.find((u) => u.id === h.ownerId)?.avatarUrl : undefined);
  };

  // Load latest message + unread counts when the list opens (and again on
  // return from a thread — that view marks messages read via its own realtime).
  useEffect(() => {
    let cancelled = false;
    const ids = myBookings.map((b) => b.id);
    setLoading(true);
    Promise.all([
      loadLatestMessagePerBooking(ids),
      loadUnreadCountsPerBooking(ids, currentUser.id),
    ]).then(([latest, counts]) => {
      if (cancelled) return;
      setPreviews(latest);
      setUnread(counts);
      setLoading(false);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedHouseId === null, myBookings.length, currentUser.id]);

  const lastActivity = (b: Booking) => new Date(previews[b.id]?.createdAt ?? b.createdAt).getTime();

  // One row per house — the representative booking is the most recently active.
  const repByHouse = new Map<string, Booking>();
  for (const b of myBookings) {
    const cur = repByHouse.get(b.houseId);
    if (!cur || lastActivity(b) > lastActivity(cur)) repByHouse.set(b.houseId, b);
  }
  const allConversations = [...repByHouse.values()].sort((a, b) => lastActivity(b) - lastActivity(a));

  const unreadForHouse = (houseId: string) =>
    myBookings.filter((b) => b.houseId === houseId).reduce((s, b) => s + (unread[b.id] || 0), 0);

  const q = search.trim().toLowerCase();
  const conversations = allConversations.filter((b) => {
    if (q && !(b.houseName + ' ' + ownerName(b)).toLowerCase().includes(q)) return false;
    if (filter === 'unread') return unreadForHouse(b.houseId) > 0;
    // Every booking thread is a conversation with an owner; "الدعم" is the
    // platform's own thread, which does not exist as a booking — so the filter
    // is honest about returning nothing rather than showing owners under it.
    if (filter === 'support') return false;
    return true;
  });

  const totalUnread = Object.values(unread).reduce((s, n) => s + n, 0);
  // The strip along the top: the houses talked to most recently, as faces.
  const recent = allConversations.slice(0, 6);

  if (selectedHouseId) {
    const houseBookings = myBookings
      .filter((b) => b.houseId === selectedHouseId)
      .sort((a, b) => lastActivity(b) - lastActivity(a));
    const rep = houseBookings[0];
    return (
      <BookingChatPanel
        key={selectedHouseId}
        bookingId={rep.id}
        bookingIds={houseBookings.map((b) => b.id)}
        booking={rep}
        house={houseById(rep.houseId)}
        currentUserId={currentUser.id}
        title={rep.houseName}
        subtitle={ownerName(rep)}
        coverUrl={ownerAvatar(rep)}
        onBack={() => setSelectedHouseId(null)}
        variant="guest"
        heightClass="h-[calc(100dvh-180px)]"
      />
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4 -mt-1">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="text-[17px] font-black text-[#2D2D24]">المحادثات</h2>
        {totalUnread > 0 && (
          <span className="text-[10px] font-black text-[#B8944E]">{totalUnread} غير مقروءة</span>
        )}
      </div>

      <PimaSearchBar id="user-messages-search" value={search} onChange={setSearch} placeholder="ابحث في المحادثات..." />

      {/* Filters. Counts sit on the chip so the guest can see there is
          something unread without opening the filter to find out. */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {([
          { key: 'all' as Filter, label: 'الكل' },
          { key: 'unread' as Filter, label: 'غير مقروءة', count: totalUnread || undefined },
          { key: 'owners' as Filter, label: 'الملاك' },
          { key: 'support' as Filter, label: 'الدعم' },
        ]).map((f) => (
          <PimaFilterChip key={f.key} label={f.label} count={f.count} active={filter === f.key}
            onClick={() => { tapFeedback(); setFilter(f.key); }} />
        ))}
      </div>

      {/* Recent houses as faces — a shortcut back into a live conversation
          without reading down the list. Hidden while searching or filtering,
          where a fixed "recent" strip would contradict the results below. */}
      {!loading && recent.length > 1 && filter === 'all' && !q && (
        <div className="space-y-2">
          <PimaSectionTitle>المفضلة</PimaSectionTitle>
          <div className="flex items-start gap-2.5 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {recent.map((b) => (
              <button key={b.houseId} onClick={() => { tapFeedback(); setSelectedHouseId(b.houseId); }}
                className="shrink-0 w-[78px] bg-white border border-[#EDE7DA] rounded-2xl p-2 flex flex-col items-center gap-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.08),0_2px_6px_rgba(0,0,0,0.03)] pima-press">
                <PimaAvatar name={b.houseName} src={ownerAvatar(b)} size={44} online />
                <span className="text-[8.5px] font-black text-[#2D2D24] leading-tight text-center line-clamp-2">{b.houseName}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-3xl border border-[#EDE7DA] divide-y divide-[#EDE7DA] overflow-hidden">
          {[0, 1, 2, 3].map((i) => <PimaLoadingRow key={i} />)}
        </div>
      ) : conversations.length === 0 ? (
        <PimaEmptyState
          title={filter === 'support' ? 'الدعم غير متاح من هنا بعد' : q ? 'لا توجد نتيجة' : 'لا توجد محادثات بعد'}
          body={filter === 'support'
            ? 'تواصل مع الدعم من صفحة حسابي — سنضيفه هنا قريبًا.'
            : q ? 'جرّب اسم بيت أو صاحب بيت مختلف.'
            : 'ابدأ محادثة جديدة مع الملاك بعد أول حجز، وستظهر هنا.'}
          action={q || filter !== 'all' ? { label: 'عرض كل المحادثات', onClick: () => { setSearch(''); setFilter('all'); } } : undefined}
        />
      ) : (
        <div className="bg-white rounded-3xl border border-[#EDE7DA] overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.08),0_2px_6px_rgba(0,0,0,0.03)]">
          {conversations.map((b, idx) => {
            const preview = previews[b.id];
            const unreadCount = unreadForHouse(b.houseId);
            const isMine = preview && preview.senderId === currentUser.id;
            const attachmentIcon = preview?.attachmentType === 'image' ? <ImageIcon className="w-3 h-3 shrink-0" />
              : preview?.attachmentType === 'audio' ? <Mic className="w-3 h-3 shrink-0" />
              : preview?.attachmentType === 'file' ? <Paperclip className="w-3 h-3 shrink-0" /> : null;
            const previewText = preview
              ? (preview.content || (preview.attachmentType === 'image' ? 'صورة' : preview.attachmentType === 'audio' ? 'رسالة صوتية' : preview.attachmentType === 'file' ? 'ملف' : ''))
              : 'اضغط لبدء المحادثة مع صاحب البيت';
            const timeText = preview ? formatChatTime(preview.createdAt) : formatChatTime(b.createdAt);
            const isLast = idx === conversations.length - 1;
            return (
              <button
                key={b.houseId}
                id={`user-conversation-${b.houseId}`}
                type="button"
                onClick={() => { tapFeedback(); setSelectedHouseId(b.houseId); }}
                className={`w-full flex items-center gap-3 hover:bg-[#FBF9F4] p-3.5 min-h-[72px] text-right transition-colors duration-[250ms] cursor-pointer pima-press ${
                  isLast ? '' : 'border-b border-[#EDE7DA]'
                } ${unreadCount > 0 ? 'bg-[#FDFBF6]' : ''}`}
              >
                <PimaAvatar name={b.houseName} src={ownerAvatar(b)} size={48} online={unreadCount > 0} />
                <span className="flex-1 min-w-0 space-y-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className={`text-[12.5px] truncate text-[#2D2D24] ${unreadCount > 0 ? 'font-black' : 'font-bold'}`}>{b.houseName}</span>
                    <span className={`text-[9.5px] shrink-0 font-bold ${unreadCount > 0 ? 'text-[#B8944E]' : 'text-[#B5AF98]'}`}>{timeText}</span>
                  </span>
                  <span className="flex items-center justify-between gap-2">
                    <span className={`text-[10.5px] truncate flex items-center gap-1 ${
                      unreadCount > 0 && !isMine ? 'text-[#2D2D24] font-bold' : 'text-[#8A8A70] font-medium'}`}>
                      {isMine && preview && <PimaReceipt read={!!preview.readAt} />}
                      {attachmentIcon}
                      <span className="truncate">{previewText}</span>
                    </span>
                    {unreadCount > 0 && !isMine && (
                      <span className="min-w-[19px] h-[19px] px-1.5 bg-gradient-to-b from-[#C9A96A] to-[#B8944E] text-white text-[9.5px] font-black rounded-full flex items-center justify-center shrink-0 pima-badge-pop">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </span>
                </span>
                <ChevronLeft className="w-4 h-4 text-[#D2C9B8] shrink-0" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      )}

      {/* Support entry — a real destination rather than a dead filter. */}
      {!loading && filter !== 'support' && (
        <a href="https://wa.me/201234567890" target="_blank" rel="noreferrer"
          className="flex items-center gap-3 bg-white border border-[#EDE7DA] rounded-2xl p-3.5 min-h-[64px] shadow-[0_8px_24px_rgba(0,0,0,0.08),0_2px_6px_rgba(0,0,0,0.03)] pima-press">
          <span className="w-11 h-11 rounded-full bg-[#F6F0E2] flex items-center justify-center shrink-0">
            <Headphones className="w-5 h-5 text-[#C5A059]" />
          </span>
          <span className="flex-1 min-w-0 text-right">
            <span className="block text-[12.5px] font-black text-[#2D2D24]">دعم بيما</span>
            <span className="block text-[10.5px] font-medium text-[#8A8A70] truncate">مرحبًا، كيف يمكننا مساعدتك؟</span>
          </span>
          <ChevronLeft className="w-4 h-4 text-[#D2C9B8] shrink-0" aria-hidden="true" />
        </a>
      )}
    </div>
  );
}
