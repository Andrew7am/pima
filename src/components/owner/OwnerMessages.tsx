import React, { useEffect, useState } from 'react';
import { Booking, User, BookingMessage } from '../../types';
import { ChevronRight, Search, MessageCircle, Check, CheckCheck } from 'lucide-react';
import BookingChatPanel from '../BookingChatPanel';
import { loadLatestMessagePerBooking, loadUnreadCountsPerBooking } from '../../lib/bookingMessages';

interface OwnerMessagesProps {
  owner: User;
  ownerBookings: Booking[];
  users: User[];
}

function Avatar({ name, avatarUrl, size = 'w-12 h-12' }: { name: string; avatarUrl?: string; size?: string }) {
  return (
    <div className={`${size} rounded-full bg-[var(--color-owner-primary)] flex items-center justify-center text-sm font-black text-[var(--color-owner-accent)] shrink-0 overflow-hidden`}>
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

export default function OwnerMessages({ owner, ownerBookings, users }: OwnerMessagesProps) {
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [search, setSearch] = useState('');
  const [previews, setPreviews] = useState<Record<string, BookingMessage>>({});
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const avatarFor = (userId: string) => users.find((u) => u.id === userId)?.avatarUrl;

  const activeBookings = ownerBookings.filter((b) => b.status !== 'rejected' && b.status !== 'cancelled');

  // Load latest message + unread counts once when the conversation list opens.
  // The two calls run in parallel; a refresh happens when we return from a
  // detail view (that view has its own realtime subscription so the unread
  // count should be zero on return).
  useEffect(() => {
    let cancelled = false;
    const ids = activeBookings.map((b) => b.id);
    setLoading(true);
    Promise.all([
      loadLatestMessagePerBooking(ids),
      loadUnreadCountsPerBooking(ids, owner.id),
    ]).then(([latest, counts]) => {
      if (cancelled) return;
      setPreviews(latest);
      setUnread(counts);
      setLoading(false);
    });
    return () => { cancelled = true; };
    // Refresh when the conversation-list view opens again (detail closed).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBooking === null, ownerBookings.length, owner.id]);

  const matching = activeBookings.filter((b) => b.userName.toLowerCase().includes(search.trim().toLowerCase()));
  const lastActivity = (b: Booking) => new Date(previews[b.id]?.createdAt ?? b.createdAt).getTime();

  // One conversation row per guest ACCOUNT, not per booking — a guest with
  // several bookings used to show up as duplicate chats. The representative
  // booking is the one with the most recent activity; its thread is what
  // opens, and unread is summed across all of that guest's bookings.
  const repByUser = new Map<string, Booking>();
  for (const b of matching) {
    const cur = repByUser.get(b.userId);
    if (!cur || lastActivity(b) > lastActivity(cur)) repByUser.set(b.userId, b);
  }
  const conversations = [...repByUser.values()].sort((a, b) => lastActivity(b) - lastActivity(a));

  const unreadForUser = (userId: string) =>
    activeBookings.filter((b) => b.userId === userId).reduce((s, b) => s + (unread[b.id] || 0), 0);

  const totalUnread = Object.values(unread).reduce((s, n) => s + n, 0);

  if (selectedBooking) {
    // Unify every booking this guest has into one thread (most-recent first).
    const guestBookings = activeBookings
      .filter((b) => b.userId === selectedBooking.userId)
      .sort((a, b) => lastActivity(b) - lastActivity(a));
    const guestBookingIds = guestBookings.map((b) => b.id);
    return (
      <BookingChatPanel
        bookingId={selectedBooking.id}
        bookingIds={guestBookingIds}
        currentUserId={owner.id}
        title={selectedBooking.userName}
        subtitle={guestBookings.length > 1 ? `${guestBookings.length} حجوزات` : selectedBooking.houseName}
        onBack={() => setSelectedBooking(null)}
        variant="owner"
        heightClass="h-[calc(100dvh-180px)]"
      />
    );
  }

  return (
    <div className="space-y-3">
      {/* Header — WhatsApp-style: title + unread hint */}
      <div className="flex items-baseline justify-between px-1">
        <h2 className="text-base font-black text-[var(--color-owner-text)] flex items-center gap-1.5">
          <MessageCircle className="w-4 h-4 text-[var(--color-owner-primary)]" />
          المحادثات
        </h2>
        {totalUnread > 0 && (
          <span className="text-[10px] font-extrabold text-emerald-700">{totalUnread} رسالة جديدة</span>
        )}
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-[var(--color-owner-secondary)] absolute right-3 top-1/2 -translate-y-1/2" />
        <input
          id="owner-messages-search"
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث باسم الحاجز أو المحادثة..."
          className="w-full bg-[var(--color-owner-surface)] border border-[var(--color-owner-border)] rounded-2xl pr-9 pl-3 py-2.5 text-xs text-[var(--color-owner-text)] outline-none focus:border-[var(--color-owner-primary)]"
        />
      </div>

      {loading ? (
        <div className="bg-[var(--color-owner-surface)] rounded-3xl border border-[var(--color-owner-border)] p-8 text-center text-xs text-[var(--color-owner-secondary)]">
          جارٍ تحميل المحادثات...
        </div>
      ) : conversations.length === 0 ? (
        <div className="bg-[var(--color-owner-surface)] rounded-3xl border border-[var(--color-owner-border)] p-8 text-center space-y-2">
          <MessageCircle className="w-8 h-8 text-[var(--color-owner-secondary)]/50 mx-auto" />
          <p className="text-xs text-[var(--color-owner-secondary)]">لا توجد محادثات بعد</p>
          <p className="text-[10px] text-[var(--color-owner-secondary)]/70">ستظهر هنا محادثاتك مع كل ضيف فور استلام طلبات الحجز.</p>
        </div>
      ) : (
        <div className="bg-[var(--color-owner-surface)] rounded-3xl border border-[var(--color-owner-border)] overflow-hidden">
          {conversations.map((b, idx) => {
            const preview = previews[b.id];
            const unreadCount = unreadForUser(b.userId);
            const isMine = preview && preview.senderId === owner.id;
            const previewText = preview
              ? (preview.content || (preview.attachmentType === 'image' ? '📷 صورة' : preview.attachmentType === 'file' ? '📎 ملف' : ''))
              : 'اضغط لبدء المحادثة مع الحاجز';
            const timeText = preview ? formatChatTime(preview.createdAt) : formatChatTime(b.createdAt);
            const isLast = idx === conversations.length - 1;
            return (
              <button
                key={b.id}
                id={`owner-conversation-${b.id}`}
                type="button"
                onClick={() => setSelectedBooking(b)}
                className={`w-full flex items-start gap-3 hover:bg-[var(--color-owner-hover)]/60 p-3.5 text-right transition-colors cursor-pointer ${
                  isLast ? '' : 'border-b border-[var(--color-owner-border)]'
                }`}
              >
                <Avatar name={b.userName} avatarUrl={avatarFor(b.userId)} />
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[13px] truncate ${unreadCount > 0 ? 'font-black text-[var(--color-owner-text)]' : 'font-bold text-[var(--color-owner-text)]'}`}>{b.userName}</span>
                    <span className={`text-[9.5px] shrink-0 ${unreadCount > 0 ? 'text-emerald-700 font-black' : 'text-[var(--color-owner-secondary)] font-bold'}`}>{timeText}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[11px] truncate flex items-center gap-1 ${unreadCount > 0 && !isMine ? 'text-[var(--color-owner-text)] font-bold' : 'text-[var(--color-owner-secondary)] font-medium'}`}>
                      {isMine && preview && (
                        preview.readAt
                          ? <CheckCheck className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                          : <Check className="w-3.5 h-3.5 text-[var(--color-owner-secondary)] shrink-0" />
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
                <ChevronRight className="w-4 h-4 text-[var(--color-owner-secondary)]/60 rotate-180 shrink-0 mt-3" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
