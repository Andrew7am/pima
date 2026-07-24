import React, { useEffect, useState } from 'react';
import { Booking, RetreatHouse, User, BookingMessage } from '../types';
import { ChevronRight, Search, MessageCircle, Check, CheckCheck, Loader2 } from 'lucide-react';
import BookingChatPanel from './BookingChatPanel';
import { loadLatestMessagePerBooking, loadUnreadCountsPerBooking } from '../lib/bookingMessages';

interface UserMessagesProps {
  currentUser: User;
  bookings: Booking[];
  houses: RetreatHouse[];
  users: User[];
}

function Avatar({ name, avatarUrl }: { name: string; avatarUrl?: string }) {
  return (
    <div className="w-12 h-12 rounded-full bg-[var(--color-natural-primary)] flex items-center justify-center text-sm font-black text-amber-200 shrink-0 overflow-hidden">
      {avatarUrl ? <img src={avatarUrl} alt={name} className="w-full h-full object-cover" /> : name.charAt(0)}
    </div>
  );
}

// Compact "منذ" formatter — hh:mm for today, weekday for this week, dd/mm otherwise.
function formatChatTime(iso: string): string {
  const then = new Date(iso);
  const now = new Date();
  const sameDay = then.toDateString() === now.toDateString();
  if (sameDay) return then.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  const diffDays = Math.floor((now.getTime() - then.getTime()) / 86_400_000);
  if (diffDays === 1) return 'أمس';
  if (diffDays < 7) return then.toLocaleDateString('ar-EG', { weekday: 'long' });
  return then.toLocaleDateString('ar-EG', { day: '2-digit', month: '2-digit' });
}

// Guest-facing conversations list — one thread per HOUSE (i.e. per owner the
// guest has booked with). A guest with several bookings at the same house sees
// one conversation; opening it unifies those bookings into a single thread.
export default function UserMessages({ currentUser, bookings, houses, users }: UserMessagesProps) {
  const [selectedHouseId, setSelectedHouseId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [previews, setPreviews] = useState<Record<string, BookingMessage>>({});
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const myBookings = bookings.filter(
    (b) => b.userId === currentUser.id && b.status !== 'rejected' && b.status !== 'cancelled',
  );

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
  let conversations = [...repByHouse.values()];
  const q = search.trim().toLowerCase();
  if (q) conversations = conversations.filter((b) => (b.houseName + ' ' + ownerName(b)).toLowerCase().includes(q));
  conversations.sort((a, b) => lastActivity(b) - lastActivity(a));

  const unreadForHouse = (houseId: string) =>
    myBookings.filter((b) => b.houseId === houseId).reduce((s, b) => s + (unread[b.id] || 0), 0);

  const totalUnread = Object.values(unread).reduce((s, n) => s + n, 0);

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
        currentUserId={currentUser.id}
        title={ownerName(rep)}
        subtitle={rep.houseName}
        onBack={() => setSelectedHouseId(null)}
        variant="guest"
        heightClass="h-[calc(100dvh-180px)]"
      />
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-3">
      {/* Header — WhatsApp-style: title + unread hint */}
      <div className="flex items-baseline justify-between px-1">
        <h2 className="text-base font-black text-[var(--color-natural-text)] flex items-center gap-1.5">
          <MessageCircle className="w-4 h-4 text-[var(--color-natural-primary)]" />
          المحادثات
        </h2>
        {totalUnread > 0 && (
          <span className="text-[10px] font-extrabold text-emerald-700">{totalUnread} رسالة جديدة</span>
        )}
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-[var(--color-natural-secondary)] absolute right-3 top-1/2 -translate-y-1/2" />
        <input
          id="user-messages-search"
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث باسم البيت أو صاحب البيت..."
          className="w-full bg-white border border-[var(--color-natural-border)] rounded-2xl pr-9 pl-3 py-2.5 text-xs text-[var(--color-natural-text)] outline-none focus:border-[var(--color-natural-primary)]"
        />
      </div>

      {loading ? (
        <div className="py-14 flex flex-col items-center gap-2 text-[var(--color-natural-secondary)]">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="text-xs">جارٍ تحميل المحادثات…</span>
        </div>
      ) : conversations.length === 0 ? (
        <div className="bg-white rounded-3xl border border-[var(--color-natural-border)] p-8 text-center space-y-2">
          <MessageCircle className="w-8 h-8 text-[var(--color-natural-secondary)]/50 mx-auto" />
          <p className="text-xs text-[var(--color-natural-secondary)]">لا توجد محادثات بعد</p>
          <p className="text-[10px] text-[var(--color-natural-secondary)]/70">ستظهر هنا محادثاتك مع أصحاب البيوت بعد أول حجز.</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-[var(--color-natural-border)] overflow-hidden">
          {conversations.map((b, idx) => {
            const preview = previews[b.id];
            const unreadCount = unreadForHouse(b.houseId);
            const isMine = preview && preview.senderId === currentUser.id;
            const previewText = preview
              ? (preview.content || (preview.attachmentType === 'image' ? '📷 صورة' : preview.attachmentType === 'file' ? '📎 ملف' : ''))
              : 'اضغط لبدء المحادثة مع صاحب البيت';
            const timeText = preview ? formatChatTime(preview.createdAt) : formatChatTime(b.createdAt);
            const isLast = idx === conversations.length - 1;
            return (
              <button
                key={b.houseId}
                id={`user-conversation-${b.houseId}`}
                type="button"
                onClick={() => setSelectedHouseId(b.houseId)}
                className={`w-full flex items-start gap-3 hover:bg-[var(--color-natural-hover)]/60 p-3.5 text-right transition-colors cursor-pointer ${
                  isLast ? '' : 'border-b border-[var(--color-natural-border)]'
                }`}
              >
                <Avatar name={ownerName(b)} avatarUrl={ownerAvatar(b)} />
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[13px] truncate ${unreadCount > 0 ? 'font-black' : 'font-bold'} text-[var(--color-natural-text)]`}>{b.houseName}</span>
                    <span className={`text-[9.5px] shrink-0 ${unreadCount > 0 ? 'text-emerald-700 font-black' : 'text-[var(--color-natural-secondary)] font-bold'}`}>{timeText}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[11px] truncate flex items-center gap-1 ${unreadCount > 0 && !isMine ? 'text-[var(--color-natural-text)] font-bold' : 'text-[var(--color-natural-secondary)] font-medium'}`}>
                      {isMine && preview && (
                        preview.readAt
                          ? <CheckCheck className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                          : <Check className="w-3.5 h-3.5 text-[var(--color-natural-secondary)] shrink-0" />
                      )}
                      <span className="truncate">{previewText}</span>
                    </span>
                    {unreadCount > 0 && !isMine && (
                      <span className="min-w-[18px] h-[18px] px-1.5 bg-emerald-500 text-white text-[9.5px] font-black rounded-full flex items-center justify-center shrink-0">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[var(--color-natural-secondary)]/60 rotate-180 shrink-0 mt-3" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
