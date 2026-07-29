import React, { useEffect, useRef, useState } from 'react';
import { ChevronRight, Send, Loader2, MessageCircle, Paperclip, X, FileText, Download, Reply, Trash2, Mic, Square, CalendarDays, Users, MapPin, Check, CheckCheck } from 'lucide-react';
import { BookingMessage, Booking, RetreatHouse } from '../types';
import { loadBookingMessages, sendBookingMessage, deleteBookingMessage, markBookingMessagesRead, subscribeToBookingMessages, subscribeToTypingPresence, OutgoingAttachment } from '../lib/bookingMessages';
import { fileToAttachment } from '../lib/attachments';
import { tapFeedback } from '../lib/haptics';
import { PimaAvatar, PimaStatusBadge, PimaTimeline, PimaDateCapsule, PimaTypingDots, PimaQuickReplyChip } from './chat/primitives';

interface BookingChatPanelProps {
  bookingId: string;
  // When set, the thread unifies messages across all of these bookings (one
  // chat per guest, not per booking). New messages are sent on the first id.
  bookingIds?: string[];
  /** Drives the booking card and its timeline. Optional: the owner panel opens
   *  threads without it and simply gets no card. */
  booking?: Booking;
  house?: RetreatHouse;
  /** Header cover art — the house photo the list already resolved. */
  coverUrl?: string;
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

// Short Arabic date for the timeline and the booking card.
const shortDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' }) : '';

// Day label above a group of messages. "اليوم" and "أمس" carry more than a
// date does; anything older gets the weekday, which is how people actually
// refer to recent conversations.
const dayLabel = (iso: string): string => {
  const d = new Date(iso); const now = new Date();
  const midnight = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((midnight(now) - midnight(d)) / 86400000);
  if (diff === 0) return 'اليوم';
  if (diff === 1) return 'أمس';
  if (diff < 7) return d.toLocaleDateString('ar-EG', { weekday: 'long' });
  return d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' });
};

const QUICK_REPLIES = ['شكرًا', 'تمام', 'أرسل الموقع', 'ساعات الوصول'];

export default function BookingChatPanel({ bookingId, bookingIds, booking, house, coverUrl, currentUserId, title, subtitle, onBack, variant = 'guest', heightClass = 'h-[60vh]' }: BookingChatPanelProps) {
  const t = THEME[variant];
  // One or many threads (unified per-guest view uses many). Sending / typing
  // always target the first (most-recent) booking.
  const ids = bookingIds && bookingIds.length > 0 ? bookingIds : [bookingId];
  const idsKey = ids.join(',');
  const primaryId = ids[0];
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
  const [recording, setRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  // The booking card collapses once the reader moves into the conversation:
  // expanded it takes ~230px, which on a 812px phone left the thread almost no
  // room. Defaults open so the context is the first thing seen, and a tap
  // toggles it — so it still works where scroll events never arrive.
  const [cardOpen, setCardOpen] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recCancelRef = useRef(false);
  const typingRef = useRef<{ setTyping: (v: boolean) => void; unsubscribe: () => void } | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Switching to a different conversation MUST NOT show the previous one's
    // messages: clear the thread (and any half-composed reply/attachment/menu
    // state) before loading the new history, so chats never bleed into each
    // other while the new history is in flight.
    setLoading(true);
    setMessages([]);
    setReplyTo(null);
    setMenuFor(null);
    setAttachments([]);
    (async () => {
      // Merge history from every thread, oldest-first across all bookings.
      const histories = await Promise.all(ids.map((id) => loadBookingMessages(id)));
      if (cancelled) return;
      const merged = histories.flat().sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      setMessages(merged);
      setLoading(false);
      ids.forEach((id) => markBookingMessagesRead(id));
    })();

    const unsubscribers = ids.map((id) => subscribeToBookingMessages(id, (msg) => {
      // INSERT echoes the sender's own row back (handleSend already appended
      // optimistically) and UPDATE carries soft-deletes — upsert by id so a
      // sent message never doubles and a delete flips in place.
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev.map((m) => (m.id === msg.id ? msg : m)) : [...prev, msg]));
      if (msg.senderId !== currentUserId && !msg.deletedAt) markBookingMessagesRead(msg.bookingId);
    }));

    const typing = subscribeToTypingPresence(primaryId, currentUserId, (typingUserIds) => {
      setOtherTyping(typingUserIds.length > 0);
    });
    typingRef.current = typing;

    return () => {
      cancelled = true;
      unsubscribers.forEach((u) => u());
      typing.unsubscribe();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (recTimerRef.current) clearInterval(recTimerRef.current);
      if (recorderRef.current && recorderRef.current.state !== 'inactive') { recCancelRef.current = true; recorderRef.current.stop(); }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, currentUserId]);

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
      const sent = await sendBookingMessage(primaryId, content, undefined, replyId);
      setSending(false);
      if (sent) appendMessage(sent); else setInput(content);
      return;
    }

    // Each attachment is its own message; the typed text + reply ride on the first.
    const failed: OutgoingAttachment[] = [];
    for (let i = 0; i < pending.length; i++) {
      const sent = await sendBookingMessage(primaryId, i === 0 ? content : '', pending[i], i === 0 ? replyId : undefined);
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

  const stopTracks = (stream: MediaStream) => stream.getTracks().forEach((tr) => tr.stop());

  const startRecording = async () => {
    if (recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      recCancelRef.current = false;
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        stopTracks(stream);
        if (recTimerRef.current) { clearInterval(recTimerRef.current); recTimerRef.current = null; }
        setRecording(false); setRecordSecs(0);
        if (recCancelRef.current || chunksRef.current.length === 0) return;
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
        const reader = new FileReader();
        // Stopping = send the voice note immediately (WhatsApp-style), not stage it.
        reader.onloadend = async () => {
          setSending(true);
          const sent = await sendBookingMessage(primaryId, '', { url: reader.result as string, type: 'audio', name: 'رسالة صوتية' });
          setSending(false);
          if (sent) appendMessage(sent);
          else alert('تعذّر إرسال الرسالة الصوتية. لو المشكلة مستمرة تأكد من تطبيق آخر تحديثات قاعدة البيانات (migration 065).');
        };
        reader.readAsDataURL(blob);
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true); setRecordSecs(0);
      recTimerRef.current = setInterval(() => setRecordSecs((s) => s + 1), 1000);
    } catch {
      alert('تعذّر الوصول للميكروفون. تأكد من السماح باستخدامه.');
    }
  };

  const stopRecording = (cancel: boolean) => {
    recCancelRef.current = cancel;
    recorderRef.current?.stop();
  };

  const nights = booking && booking.checkIn && booking.checkOut
    ? Math.max(0, Math.round((new Date(booking.checkOut).getTime() - new Date(booking.checkIn).getTime()) / 86400000))
    : 0;

  // The booking's life so far, read from fields that actually exist on the
  // record. A step is done when the fact behind it is true, never on a guess:
  // an unpaid booking shows no paid mark, and arrival is only ticked once the
  // guest has really checked in — a date that has passed is not an arrival.
  const confirmed = booking?.status === 'approved' || booking?.status === 'completed';
  const paid = !!booking && (booking.depositPaid || booking.paymentStatus === 'paid_deposit' || booking.paymentStatus === 'paid_full');
  const timeline = booking ? [
    { label: 'الإنشاء', date: shortDate(booking.createdAt), done: true },
    { label: 'مؤكد', date: confirmed ? '' : undefined, done: confirmed },
    { label: 'تم الدفع', date: paid ? '' : undefined, done: paid },
    { label: 'الوصول', date: shortDate(booking.checkIn), done: !!booking.checkedInAt },
  ] : [];

  return (
    <div className={`rounded-3xl border ${t.border} flex flex-col ${heightClass} overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.08),0_2px_6px_rgba(0,0,0,0.03)]`}>
      {/* Header — the house photo behind a dark wash, so the thread opens on
          the place being discussed rather than a coloured bar. */}
      <div className="relative shrink-0 text-white">
        {coverUrl && (
          <>
            <img src={coverUrl} alt="" referrerPolicy="no-referrer" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/55 to-black/70 backdrop-blur-[1px]" />
          </>
        )}
        {!coverUrl && <div className={`absolute inset-0 ${t.headerBg}`} />}

        <div className="relative flex items-center gap-2.5 px-3.5 py-3">
          {onBack && (
            <button type="button" onClick={() => { tapFeedback(); onBack(); }} aria-label="رجوع"
              className="w-10 h-10 -mr-1.5 rounded-full flex items-center justify-center hover:bg-white/15 transition-colors pima-press">
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
          <PimaAvatar name={title} src={coverUrl} size={40} online ring />
          <div className="min-w-0 flex-1 text-right">
            <div className="text-[13px] font-black truncate">{title}</div>
            <div className="text-[9.5px] font-bold text-white/75 flex items-center gap-1.5 justify-start">
              {otherTyping ? <><PimaTypingDots /><span>يكتب الآن</span></> : <span>{subtitle}</span>}
            </div>
          </div>
        </div>

        {/* Booking card, inside the header so the context never scrolls away.
            Collapsed it stays one readable line rather than disappearing —
            the dates are the thing people re-check mid-conversation. */}
        {booking && (
          <div className="relative px-3 pb-3">
            <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-white/70 shadow-[0_8px_24px_rgba(0,0,0,0.08),0_2px_6px_rgba(0,0,0,0.03)] overflow-hidden">
              <button
                type="button"
                onClick={() => { tapFeedback(); setCardOpen((v) => !v); }}
                aria-expanded={cardOpen}
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-right pima-press"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className="text-[11.5px] font-black text-[#2D2D24] shrink-0">حجزك القادم</span>
                  {!cardOpen && (
                    <span className="text-[10px] font-bold text-[#8A8A70] truncate">
                      {shortDate(booking.checkIn)} · {booking.guestsCount} فرد · {nights} {nights === 1 ? 'ليلة' : nights === 2 ? 'ليلتين' : 'ليالٍ'}
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-1.5 shrink-0">
                  <PimaStatusBadge status={booking.status} />
                  <ChevronRight aria-hidden="true" className={`w-4 h-4 text-[#B5AF98] transition-transform duration-[250ms] ease-[cubic-bezier(0.33,1,0.68,1)] ${cardOpen ? '-rotate-90' : 'rotate-90'}`} />
                </span>
              </button>

              {/* Height, not display: the collapse interpolates instead of
                  snapping, and an aria-hidden pane keeps it out of the reading
                  order when shut. */}
              <div
                aria-hidden={!cardOpen}
                className={`grid transition-[grid-template-rows,opacity] duration-[300ms] ease-[cubic-bezier(0.33,1,0.68,1)] ${
                  cardOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                }`}
              >
                <div className="overflow-hidden">
                  <div className="px-3 pb-3">
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {[
                        { icon: <CalendarDays className="w-3.5 h-3.5" />, top: shortDate(booking.checkIn), bottom: 'الوصول' },
                        { icon: <Users className="w-3.5 h-3.5" />, top: `${booking.guestsCount} فرد`, bottom: 'عدد الأفراد' },
                        { icon: <MapPin className="w-3.5 h-3.5" />, top: `${nights} ${nights === 1 ? 'ليلة' : nights === 2 ? 'ليلتين' : 'ليالٍ'}`, bottom: 'المدة' },
                      ].map((c) => (
                        <div key={c.bottom} className="flex flex-col items-center gap-0.5 bg-[#FBF9F4] rounded-xl py-2">
                          <span className="text-[#C5A059]">{c.icon}</span>
                          <span className="text-[10.5px] font-black text-[#2D2D24] leading-none">{c.top}</span>
                          <span className="text-[8.5px] font-bold text-[#8A8A70]">{c.bottom}</span>
                        </div>
                      ))}
                    </div>
                    <PimaTimeline steps={timeline} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div
        // Moving into the conversation folds the card away; returning to the
        // top brings it back. Passive listener, class flip only — no state
        // churn per scroll frame beyond the one boolean.
        onScroll={(e) => {
          const top = (e.target as HTMLElement).scrollTop;
          setCardOpen((open) => (open && top > 24 ? false : open));
        }}
        className="flex-1 overflow-y-auto p-4 space-y-2.5 pima-chat-bg"
      >
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
          messages.map((m, mi) => {
            const isMine = m.senderId === currentUserId;
            const repliedTo = m.replyToId ? messages.find((x) => x.id === m.replyToId) : undefined;
            // A capsule appears whenever the calendar day changes, so the
            // reader always knows when a stretch of conversation happened.
            const prev = mi > 0 ? messages[mi - 1] : undefined;
            const showDay = !prev || dayLabel(prev.createdAt) !== dayLabel(m.createdAt);
            const capsule = showDay ? <PimaDateCapsule key={`d-${m.id}`} label={dayLabel(m.createdAt)} /> : null;
            if (m.deletedAt) {
              return (
                <React.Fragment key={m.id}>
                  {capsule}
                  <div className={`max-w-[75%] ${isMine ? 'ml-auto' : 'mr-auto'}`}>
                    <div dir="rtl" className="rounded-2xl px-3.5 py-2.5 text-[11px] italic text-[#8A8A70] bg-white/60 border border-[#EDE7DA] flex items-center gap-1.5">
                      <Trash2 className="w-3 h-3" /> تم حذف هذه الرسالة
                    </div>
                  </div>
                </React.Fragment>
              );
            }
            const repliedPreview = repliedTo
              ? (repliedTo.deletedAt ? 'رسالة محذوفة' : (repliedTo.content || (repliedTo.attachmentType === 'image' ? '📷 صورة' : repliedTo.attachmentType === 'file' ? '📎 ملف' : '')))
              : '';
            return (
              <React.Fragment key={m.id}>
              {capsule}
              <div className={`max-w-[78%] ${isMine ? 'ml-auto' : 'mr-auto'} space-y-1 group pima-bubble-in`}>
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
                {m.attachmentUrl && m.attachmentType === 'audio' && (
                  <div className={`rounded-2xl px-2 py-1.5 shadow-sm ${isMine ? `${t.primary}` : `bg-white border ${t.border}`}`}>
                    <audio controls src={m.attachmentUrl} className="h-9 w-[210px] max-w-full" />
                  </div>
                )}
                {m.content && (
                  <button type="button" onClick={() => setMenuFor(menuFor === m.id ? null : m.id)}
                    dir="rtl"
                    // Asymmetric corner on the side the message comes from —
                    // the tail, without drawing one. Outgoing is a soft gold
                    // wash rather than a solid fill so the thread stays calm.
                    // Width follows the text. w-full made every bubble the same
                    // 78% slab, so a two-word reply read as a paragraph.
                    className={`inline-block text-right px-3.5 py-2.5 text-[12px] font-medium leading-relaxed max-w-full rounded-[22px] ${
                      isMine
                        ? 'rounded-bl-md bg-gradient-to-b from-[#F7EEDB] to-[#F2E4C9] text-[#3A3524] border border-[#E9D9B4] shadow-[0_2px_8px_rgba(184,148,78,0.12)]'
                        : 'rounded-br-md bg-white text-[#2D2D24] border border-[#EDE7DA] shadow-[0_2px_8px_rgba(45,45,36,0.05)]'
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
                    <button type="button" onClick={() => setMenuFor(menuFor === m.id ? null : m.id)} aria-label="رد" className="text-[#B5AF98]">
                      <Reply className="w-3 h-3" />
                    </button>
                  )}
                  <p className="text-[9px] text-[#B5AF98] font-bold">{formatTime(m.createdAt)}</p>
                  {/* Receipts only make sense on messages you sent. */}
                  {isMine && (m.readAt
                    ? <CheckCheck className="w-3.5 h-3.5 text-sky-500" aria-label="تمت القراءة" />
                    : <Check className="w-3.5 h-3.5 text-[#B5AF98]" aria-label="تم الإرسال" />)}
                </div>
              </div>
              </React.Fragment>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick replies — the four things people actually type, one tap each.
          Hidden once there is something in the box, where they would compete
          with what the guest is already writing. */}
      {!loading && !input.trim() && (
        <div className="shrink-0 flex items-center gap-1.5 px-3 py-2 overflow-x-auto bg-white border-t border-[#EDE7DA] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {QUICK_REPLIES.map((q) => (
            <PimaQuickReplyChip key={q} label={q} onClick={() => { tapFeedback(); setInput(q); }} />
          ))}
        </div>
      )}

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
                : <div className={`w-10 h-10 rounded-lg ${t.primary} flex items-center justify-center shrink-0`}>{att.type === 'audio' ? <Mic className="w-5 h-5 text-white" /> : <FileText className="w-5 h-5 text-white" />}</div>}
              <span className={`text-[10.5px] font-bold ${t.text} truncate max-w-[100px]`}>{att.name || (att.type === 'image' ? 'صورة' : att.type === 'audio' ? 'رسالة صوتية' : 'ملف')}</span>
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

      {recording ? (
        <div className={`shrink-0 flex items-center gap-3 p-3 border-t ${t.border} ${t.surface}`}>
          <button type="button" onClick={() => stopRecording(true)} title="إلغاء"
            className="flex items-center justify-center text-rose-600 p-2.5 rounded-2xl shrink-0 cursor-pointer"><Trash2 className="w-5 h-5" /></button>
          <div className={`flex-1 flex items-center gap-2 ${t.text} text-xs font-bold`}>
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
            جارٍ التسجيل... {Math.floor(recordSecs / 60)}:{String(recordSecs % 60).padStart(2, '0')}
          </div>
          <button type="button" onClick={() => stopRecording(false)} title="إيقاف وإرفاق"
            className={`flex items-center justify-center ${t.primary} ${t.primaryHover} text-white p-2.5 rounded-2xl shadow-sm shrink-0 cursor-pointer`}><Square className="w-4 h-4" /></button>
        </div>
      ) : (
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
          {input.trim() || attachments.length > 0 ? (
            <button
              id="booking-chat-send-btn"
              type="button"
              onClick={handleSend}
              disabled={sending}
              className={`flex items-center justify-center ${t.primary} ${t.primaryHover} disabled:opacity-50 text-white p-2.5 rounded-2xl shadow-sm transition-colors shrink-0 cursor-pointer`}
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              title="تسجيل رسالة صوتية"
              className={`flex items-center justify-center ${t.primary} ${t.primaryHover} text-white p-2.5 rounded-2xl shadow-sm transition-colors shrink-0 cursor-pointer`}
            >
              <Mic className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

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
