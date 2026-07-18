import React, { useEffect, useRef, useState } from 'react';
import { ChevronRight, Send, Loader2, MessageCircle } from 'lucide-react';
import { BookingMessage } from '../types';
import { loadBookingMessages, sendBookingMessage, markBookingMessagesRead, subscribeToBookingMessages, subscribeToTypingPresence } from '../lib/bookingMessages';

interface BookingChatPanelProps {
  bookingId: string;
  currentUserId: string;
  title: string;
  subtitle?: string;
  onBack?: () => void;
  variant?: 'owner' | 'guest';
  heightClass?: string;
}

// Two color token sets — owner dashboard uses the scoped --color-owner-*
// CSS variables, guest-facing screens use the app's plain cream/gold hex
// (guest screens are outside the .owner-theme wrapper).
const THEME = {
  owner: {
    surface: 'bg-[var(--color-owner-surface)]', border: 'border-[var(--color-owner-border)]',
    bg: 'bg-[var(--color-owner-bg)]', primary: 'bg-[var(--color-owner-primary)]', primaryHover: 'hover:bg-[var(--color-owner-primary-hover)]',
    text: 'text-[var(--color-owner-text)]', secondary: 'text-[var(--color-owner-secondary)]', accent: 'text-[var(--color-owner-accent)]',
    headerBg: 'bg-[var(--color-owner-primary)]', focusBorder: 'focus:border-[var(--color-owner-primary)]',
  },
  guest: {
    surface: 'bg-white', border: 'border-[#D6D6C2]',
    bg: 'bg-[#FAF8F5]', primary: 'bg-[#5A5A40]', primaryHover: 'hover:bg-[#4A4A3A]',
    text: 'text-[#4A4A3A]', secondary: 'text-[#8A8A70]', accent: 'text-amber-300',
    headerBg: 'bg-[#4A4A3A]', focusBorder: 'focus:border-[#5A5A40]',
  },
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
}

const TYPING_IDLE_MS = 2000;

export default function BookingChatPanel({ bookingId, currentUserId, title, subtitle, onBack, variant = 'guest', heightClass = 'h-[60vh]' }: BookingChatPanelProps) {
  const t = THEME[variant];
  const [messages, setMessages] = useState<BookingMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingRef = useRef<{ setTyping: (v: boolean) => void; unsubscribe: () => void } | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const history = await loadBookingMessages(bookingId);
      if (cancelled) return;
      setMessages(history);
      setLoading(false);
      markBookingMessagesRead(bookingId);
    })();

    const unsubscribe = subscribeToBookingMessages(bookingId, (msg) => {
      setMessages((prev) => [...prev, msg]);
      if (msg.senderId !== currentUserId) markBookingMessagesRead(bookingId);
    });

    const typing = subscribeToTypingPresence(bookingId, currentUserId, (typingUserIds) => {
      setOtherTyping(typingUserIds.length > 0);
    });
    typingRef.current = typing;

    return () => {
      cancelled = true;
      unsubscribe();
      typing.unsubscribe();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [bookingId, currentUserId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleInputChange = (value: string) => {
    setInput(value);
    typingRef.current?.setTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => typingRef.current?.setTyping(false), TYPING_IDLE_MS);
  };

  const handleSend = async () => {
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    setInput('');
    typingRef.current?.setTyping(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    const sent = await sendBookingMessage(bookingId, content);
    setSending(false);
    if (sent) setMessages((prev) => [...prev, sent]);
    else setInput(content);
  };

  return (
    <div className={`${t.surface} rounded-3xl border ${t.border} flex flex-col ${heightClass} overflow-hidden`}>
      <div className={`flex items-center justify-between shrink-0 px-4 py-3 border-b ${t.border} ${t.headerBg} text-white`}>
        {onBack ? (
          <button type="button" onClick={onBack} className="flex items-center gap-1 text-[11px] font-bold text-white/80 hover:text-white transition-colors cursor-pointer">
            <ChevronRight className="w-4 h-4" />
            <span>رجوع</span>
          </button>
        ) : <span />}
        <div className="text-right">
          <div className="text-xs font-black">{title}</div>
          <div className={`text-[9.5px] ${t.accent} font-bold`}>{otherTyping ? 'يكتب الآن...' : subtitle}</div>
        </div>
      </div>

      <div className={`flex-1 overflow-y-auto p-4 space-y-2.5 ${t.bg}`}>
        {loading ? (
          <div className={`flex items-center justify-center gap-2 ${t.secondary} py-8`}>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-xs font-bold">جارٍ تحميل المحادثة...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-10">
            <MessageCircle className={`w-8 h-8 ${t.border.replace('border-', 'text-')} mx-auto mb-2`} />
            <p className={`text-xs ${t.secondary} font-bold`}>ابدأ المحادثة مع {title}</p>
          </div>
        ) : (
          messages.map((m) => {
            const isMine = m.senderId === currentUserId;
            return (
              <div key={m.id} className={`max-w-[75%] ${isMine ? 'ml-auto' : 'mr-auto'}`}>
                <div dir="rtl" className={`rounded-2xl px-3.5 py-2.5 text-xs font-medium leading-relaxed shadow-sm ${
                  isMine ? `${t.primary} text-white` : `bg-white border ${t.border} ${t.text}`
                }`}>
                  {m.content}
                </div>
                <p className={`text-[9px] ${t.secondary} font-bold mt-1 px-1 ${isMine ? 'text-left' : 'text-right'}`}>{formatTime(m.createdAt)}</p>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className={`shrink-0 flex items-center gap-2 p-3 border-t ${t.border} ${t.surface}`}>
        <input
          id="booking-chat-input"
          type="text"
          value={input}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
          placeholder="اكتب رسالة..."
          maxLength={2000}
          className={`flex-1 ${t.bg} border ${t.border} rounded-2xl px-4 py-2.5 text-xs ${t.text} outline-none ${t.focusBorder} transition-colors min-w-0`}
        />
        <button
          id="booking-chat-send-btn"
          type="button"
          onClick={handleSend}
          disabled={sending || !input.trim()}
          className={`flex items-center justify-center ${t.primary} ${t.primaryHover} disabled:opacity-50 text-white p-2.5 rounded-2xl shadow-sm transition-colors shrink-0 cursor-pointer`}
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
