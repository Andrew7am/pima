import React, { useEffect, useRef, useState } from 'react';
import { ChevronRight, Send, Loader2, MessageCircle, Paperclip, X, FileText, Download, Reply, Trash2 } from 'lucide-react';
import { BookingMessage } from '../types';
import { loadBookingMessages, sendBookingMessage, deleteBookingMessage, markBookingMessagesRead, subscribeToBookingMessages, subscribeToTypingPresence, OutgoingAttachment } from '../lib/bookingMessages';
import { fileToAttachment } from '../lib/attachments';

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
  const [attachments, setAttachments] = useState<OutgoingAttachment[]>([]);
  const [attaching, setAttaching] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<BookingMessage | null>(null);
  const [menuFor, setMenuFor] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
      // INSERT echoes the sender's own row back (handleSend already appended
      // optimistically) and UPDATE carries soft-deletes — upsert by id so a
      // sent message never doubles and a delete flips in place.
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev.map((m) => (m.id === msg.id ? msg : m)) : [...prev, msg]));
      if (msg.senderId !== currentUserId && !msg.deletedAt) markBookingMessagesRead(bookingId);
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

  const handleFilePick = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setAttaching(true);
    try {
      const prepared = await Promise.all(Array.from(files).map((f) => fileToAttachment(f)));
      setAttachments((prev) => [...prev, ...prepared]);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'تعذّر إرفاق الملف.');
    } finally {
      setAttaching(false);
    }
  };

  const appendMessage = (m: typeof messages[number]) =>
    setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));

  const handleSend = async () => {
    const content = input.trim();
    if ((!content && attachments.length === 0) || sending) return;
    setSending(true);
    setInput('');
    const pending = attachments;
    const replyId = replyTo?.id;
    setAttachments([]);
    setReplyTo(null);
    typingRef.current?.setTyping(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    if (pending.length === 0) {
      const sent = await sendBookingMessage(bookingId, content, undefined, replyId);
      setSending(false);
      if (sent) appendMessage(sent); else setInput(content);
      return;
    }

    // Each attachment is its own message; the typed text + reply ride on the first.
    const failed: OutgoingAttachment[] = [];
    for (let i = 0; i < pending.length; i++) {
      const sent = await sendBookingMessage(bookingId, i === 0 ? content : '', pending[i], i === 0 ? replyId : undefined);
      if (sent) appendMessage(sent); else failed.push(pending[i]);
    }
    setSending(false);
    if (failed.length > 0) setAttachments(failed);
  };

  const handleDelete = async (id: number) => {
    setMenuFor(null);
    const ok = await deleteBookingMessage(id);
    if (ok) setMessages((prev) => prev.map((m) => (m.id === id
      ? { ...m, deletedAt: new Date().toISOString(), content: '', attachmentUrl: undefined, attachmentType: undefined, attachmentName: undefined }
      : m)));
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
            const repliedTo = m.replyToId ? messages.find((x) => x.id === m.replyToId) : undefined;
            if (m.deletedAt) {
              return (
                <div key={m.id} className={`max-w-[75%] ${isMine ? 'ml-auto' : 'mr-auto'}`}>
                  <div dir="rtl" className={`rounded-2xl px-3.5 py-2.5 text-[11px] italic ${t.secondary} bg-white/50 border ${t.border} flex items-center gap-1.5`}>
                    <Trash2 className="w-3 h-3" /> تم حذف هذه الرسالة
                  </div>
                </div>
              );
            }
            const repliedPreview = repliedTo
              ? (repliedTo.deletedAt ? 'رسالة محذوفة' : (repliedTo.content || (repliedTo.attachmentType === 'image' ? '📷 صورة' : repliedTo.attachmentType === 'file' ? '📎 ملف' : '')))
              : '';
            return (
              <div key={m.id} className={`max-w-[75%] ${isMine ? 'ml-auto' : 'mr-auto'} space-y-1 group`}>
                {/* Quoted message */}
                {repliedTo && (
                  <div dir="rtl" className={`rounded-xl px-2.5 py-1.5 border-r-2 ${t.bg} border ${t.border} text-[10px]`}>
                    <div className={`font-black ${t.accent === 'text-amber-300' ? 'text-[#8A8A70]' : t.secondary}`}>{repliedTo.senderId === currentUserId ? 'أنت' : repliedTo.senderName}</div>
                    <div className={`${t.secondary} truncate`}>{repliedPreview}</div>
                  </div>
                )}
                {m.attachmentUrl && m.attachmentType === 'image' && (
                  <button type="button" onClick={() => setLightbox(m.attachmentUrl!)} className="block">
                    <img src={m.attachmentUrl} alt={m.attachmentName || 'صورة'} className="rounded-2xl max-w-full max-h-56 object-cover border border-black/5 shadow-sm cursor-zoom-in" />
                  </button>
                )}
                {m.attachmentUrl && m.attachmentType === 'file' && (
                  <a href={m.attachmentUrl} download={m.attachmentName || 'ملف'}
                    className={`flex items-center gap-2 rounded-2xl px-3 py-2.5 shadow-sm ${isMine ? `${t.primary} text-white` : `bg-white border ${t.border} ${t.text}`}`}>
                    <FileText className="w-5 h-5 shrink-0 opacity-80" />
                    <span dir="rtl" className="text-[11px] font-bold truncate flex-1">{m.attachmentName || 'ملف مرفق'}</span>
                    <Download className="w-4 h-4 shrink-0 opacity-70" />
                  </a>
                )}
                {m.content && (
                  <button type="button" onClick={() => setMenuFor(menuFor === m.id ? null : m.id)}
                    dir="rtl" className={`block text-right rounded-2xl px-3.5 py-2.5 text-xs font-medium leading-relaxed shadow-sm w-full ${
                    isMine ? `${t.primary} text-white` : `bg-white border ${t.border} ${t.text}`
                  }`}>
                    {m.content}
                  </button>
                )}
                {/* Action row (reply / delete) */}
                {menuFor === m.id && (
                  <div className={`flex items-center gap-1 ${isMine ? 'justify-start' : 'justify-end'}`}>
                    <button type="button" onClick={() => { setReplyTo(m); setMenuFor(null); }}
                      className={`flex items-center gap-1 text-[9.5px] font-bold ${t.secondary} bg-white border ${t.border} rounded-lg px-2 py-1`}>
                      <Reply className="w-3 h-3" /> رد
                    </button>
                    {isMine && (
                      <button type="button" onClick={() => handleDelete(m.id)}
                        className="flex items-center gap-1 text-[9.5px] font-bold text-rose-600 bg-white border border-rose-200 rounded-lg px-2 py-1">
                        <Trash2 className="w-3 h-3" /> حذف
                      </button>
                    )}
                  </div>
                )}
                <div className={`flex items-center gap-1.5 px-1 ${isMine ? 'justify-start' : 'justify-end'}`}>
                  {!m.content && (
                    <button type="button" onClick={() => setMenuFor(menuFor === m.id ? null : m.id)} className={`${t.secondary} opacity-60`}>
                      <Reply className="w-3 h-3" />
                    </button>
                  )}
                  <p className={`text-[9px] ${t.secondary} font-bold`}>{formatTime(m.createdAt)}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Replying-to preview */}
      {replyTo && (
        <div className={`shrink-0 flex items-center gap-2 px-3 pt-2 ${t.surface}`}>
          <div className={`flex-1 min-w-0 border-r-2 ${t.bg} border ${t.border} rounded-xl px-2.5 py-1.5`}>
            <div className={`text-[10px] font-black ${t.secondary}`}>رد على {replyTo.senderId === currentUserId ? 'رسالتك' : replyTo.senderName}</div>
            <div className={`text-[10px] ${t.secondary} truncate`}>
              {replyTo.deletedAt ? 'رسالة محذوفة' : (replyTo.content || (replyTo.attachmentType === 'image' ? '📷 صورة' : replyTo.attachmentType === 'file' ? '📎 ملف' : ''))}
            </div>
          </div>
          <button type="button" onClick={() => setReplyTo(null)} className={`${t.secondary} p-1 shrink-0`}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Pending attachments preview */}
      {(attachments.length > 0 || attaching) && (
        <div className={`shrink-0 flex items-center gap-2 px-3 pt-2 overflow-x-auto ${t.surface}`}>
          {attachments.map((att, i) => (
            <div key={i} className={`flex items-center gap-2 ${t.bg} border ${t.border} rounded-2xl p-1.5 pr-2 shrink-0`}>
              {att.type === 'image'
                ? <img src={att.url} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                : <div className={`w-10 h-10 rounded-lg ${t.primary} flex items-center justify-center shrink-0`}><FileText className="w-5 h-5 text-white" /></div>}
              <span className={`text-[10.5px] font-bold ${t.text} truncate max-w-[100px]`}>{att.name || (att.type === 'image' ? 'صورة' : 'ملف')}</span>
              <button type="button" onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))} className={`${t.secondary} p-1 shrink-0`}><X className="w-3.5 h-3.5" /></button>
            </div>
          ))}
          {attaching && (
            <div className={`flex items-center gap-2 ${t.secondary} text-[11px] font-bold shrink-0`}>
              <Loader2 className="w-4 h-4 animate-spin" /> جارٍ التجهيز...
            </div>
          )}
        </div>
      )}

      <div className={`shrink-0 flex items-center gap-2 p-3 border-t ${t.border} ${t.surface}`}>
        <input ref={fileInputRef} type="file" accept="image/*,application/pdf" multiple className="hidden"
          onChange={(e) => { handleFilePick(e.target.files); e.target.value = ''; }} />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={attaching || sending}
          title="إرفاق صورة أو ملف"
          className={`flex items-center justify-center ${t.bg} border ${t.border} ${t.secondary} disabled:opacity-50 p-2.5 rounded-2xl transition-colors shrink-0 cursor-pointer`}
        >
          <Paperclip className="w-4 h-4" />
        </button>
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
          disabled={sending || (!input.trim() && attachments.length === 0)}
          className={`flex items-center justify-center ${t.primary} ${t.primaryHover} disabled:opacity-50 text-white p-2.5 rounded-2xl shadow-sm transition-colors shrink-0 cursor-pointer`}
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>

      {/* Fullscreen image lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <button type="button" onClick={() => setLightbox(null)} className="absolute top-4 left-4 text-white/90 p-2"><X className="w-6 h-6" /></button>
          <img src={lightbox} alt="" className="max-w-full max-h-full rounded-lg object-contain" />
        </div>
      )}
    </div>
  );
}
