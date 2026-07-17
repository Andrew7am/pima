import React, { useEffect, useRef, useState } from 'react';
import { Booking, User, BookingMessage } from '../../types';
import { ChevronRight, Send, Loader2, MessageCircle, Search } from 'lucide-react';
import { loadBookingMessages, sendBookingMessage, markBookingMessagesRead, subscribeToBookingMessages } from '../../lib/bookingMessages';

interface OwnerMessagesProps {
  owner: User;
  ownerBookings: Booking[];
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
}

function ConversationThread({ owner, booking, onBack }: { owner: User; booking: Booking; onBack: () => void }) {
  const [messages, setMessages] = useState<BookingMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const history = await loadBookingMessages(booking.id);
      if (cancelled) return;
      setMessages(history);
      setLoading(false);
      markBookingMessagesRead(booking.id);
    })();

    const unsubscribe = subscribeToBookingMessages(booking.id, (msg) => {
      setMessages((prev) => [...prev, msg]);
      if (msg.senderId !== owner.id) markBookingMessagesRead(booking.id);
    });

    return () => { cancelled = true; unsubscribe(); };
  }, [booking.id, owner.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    setInput('');
    const sent = await sendBookingMessage(booking.id, content);
    setSending(false);
    if (sent) {
      setMessages((prev) => [...prev, sent]);
    } else {
      setInput(content);
    }
  };

  return (
    <div className="bg-[var(--color-owner-surface)] rounded-3xl border border-[var(--color-owner-border)] flex flex-col h-[70vh] overflow-hidden">
      <div className="flex items-center justify-between shrink-0 px-4 py-3 border-b border-[var(--color-owner-border)] bg-[var(--color-owner-primary)] text-white">
        <button type="button" onClick={onBack} className="flex items-center gap-1 text-[11px] font-bold text-white/80 hover:text-white transition-colors cursor-pointer">
          <ChevronRight className="w-4 h-4" />
          <span>رجوع</span>
        </button>
        <div className="text-right">
          <div className="text-xs font-black">{booking.userName}</div>
          <div className="text-[9.5px] text-[var(--color-owner-accent)] font-bold">{booking.houseName}</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-[var(--color-owner-bg)]">
        {loading ? (
          <div className="flex items-center justify-center gap-2 text-[var(--color-owner-secondary)] py-8">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-xs font-bold">جارٍ تحميل المحادثة...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-10">
            <MessageCircle className="w-8 h-8 text-[var(--color-owner-border)] mx-auto mb-2" />
            <p className="text-xs text-[var(--color-owner-secondary)] font-bold">ابدأ المحادثة مع {booking.userName}</p>
          </div>
        ) : (
          messages.map((m) => {
            const isMine = m.senderId === owner.id;
            return (
              <div key={m.id} className={`max-w-[75%] ${isMine ? 'ml-auto' : 'mr-auto'}`}>
                <div
                  dir="rtl"
                  className={`rounded-2xl px-3.5 py-2.5 text-xs font-medium leading-relaxed shadow-sm ${
                    isMine
                      ? 'bg-[var(--color-owner-primary)] text-white'
                      : 'bg-white border border-[var(--color-owner-border)] text-[var(--color-owner-text)]'
                  }`}
                >
                  {m.content}
                </div>
                <p className={`text-[9px] text-[var(--color-owner-secondary)] font-bold mt-1 px-1 ${isMine ? 'text-left' : 'text-right'}`}>
                  {formatTime(m.createdAt)}
                </p>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="shrink-0 flex items-center gap-2 p-3 border-t border-[var(--color-owner-border)] bg-[var(--color-owner-surface)]">
        <input
          id="owner-message-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
          placeholder="اكتب رسالة..."
          maxLength={2000}
          className="flex-1 bg-[var(--color-owner-bg)] border border-[var(--color-owner-border)] rounded-2xl px-4 py-2.5 text-xs text-[var(--color-owner-text)] outline-none focus:border-[var(--color-owner-primary)] transition-colors min-w-0"
        />
        <button
          id="owner-message-send-btn"
          type="button"
          onClick={handleSend}
          disabled={sending || !input.trim()}
          className="flex items-center justify-center bg-[var(--color-owner-primary)] hover:bg-[var(--color-owner-primary-hover)] disabled:opacity-50 text-white p-2.5 rounded-2xl shadow-sm transition-colors shrink-0 cursor-pointer"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

export default function OwnerMessages({ owner, ownerBookings }: OwnerMessagesProps) {
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [search, setSearch] = useState('');

  const conversations = ownerBookings
    .filter((b) => b.status !== 'rejected' && b.status !== 'cancelled')
    .filter((b) => b.userName.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (selectedBooking) {
    return <ConversationThread owner={owner} booking={selectedBooking} onBack={() => setSelectedBooking(null)} />;
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="w-4 h-4 text-[var(--color-owner-secondary)] absolute right-3 top-1/2 -translate-y-1/2" />
        <input
          id="owner-messages-search"
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث باسم الحاجز..."
          className="w-full bg-[var(--color-owner-surface)] border border-[var(--color-owner-border)] rounded-2xl pr-9 pl-3 py-2.5 text-xs text-[var(--color-owner-text)] outline-none focus:border-[var(--color-owner-primary)]"
        />
      </div>

      {conversations.length === 0 ? (
        <div className="bg-[var(--color-owner-surface)] rounded-3xl border border-[var(--color-owner-border)] p-8 text-center text-xs text-[var(--color-owner-secondary)]">
          لا توجد محادثات متاحة بعد — ستظهر هنا محادثاتك مع الحاجزين فور استلام طلبات حجز.
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map((b) => (
            <button
              key={b.id}
              id={`owner-conversation-${b.id}`}
              type="button"
              onClick={() => setSelectedBooking(b)}
              className="w-full flex items-center justify-between gap-3 bg-[var(--color-owner-surface)] hover:bg-[var(--color-owner-hover)] rounded-2xl border border-[var(--color-owner-border)] p-3.5 text-right transition-colors cursor-pointer"
            >
              <div className="w-9 h-9 rounded-full bg-[var(--color-owner-primary)] flex items-center justify-center text-xs font-black text-[var(--color-owner-accent)] shrink-0">
                {b.userName.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-[var(--color-owner-text)] truncate">{b.userName}</div>
                <div className="text-[10px] text-[var(--color-owner-secondary)] truncate">{b.houseName} · {b.checkIn}</div>
              </div>
              <ChevronRight className="w-4 h-4 text-[var(--color-owner-secondary)] rotate-180 shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
