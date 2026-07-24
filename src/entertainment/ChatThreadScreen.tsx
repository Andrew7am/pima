import React, { useEffect, useRef, useState } from 'react';
import { User } from '../types';
import { ChevronRight, Send, Loader2, MessageCircle } from 'lucide-react';
import { DirectMessage, loadMessages, sendMessage, markMessagesRead, subscribeToIncomingMessages, loadPublicAvatars } from './social';

interface ChatThreadScreenProps {
  currentUser: User;
  friendId: string;
  friendName: string;
  onBack: () => void;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
}

// Realtime 1:1 chat thread with a single friend. Loads history, marks
// incoming messages read on open, and subscribes to new incoming
// messages for the lifetime of the screen (see social.ts).
export default function ChatThreadScreen({ currentUser, friendId, friendName, onBack }: ChatThreadScreenProps) {
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [friendAvatar, setFriendAvatar] = useState<string | undefined>(undefined);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    setFriendAvatar(undefined);
    loadPublicAvatars([friendId]).then((m) => { if (alive) setFriendAvatar(m[friendId]); });
    return () => { alive = false; };
  }, [friendId]);

  useEffect(() => {
    let cancelled = false;
    // Clear the previous friend's thread before loading the new one so
    // messages never carry over between conversations.
    setLoading(true);
    setMessages([]);
    (async () => {
      const history = await loadMessages(currentUser.id, friendId);
      if (cancelled) return;
      setMessages(history);
      setLoading(false);
      markMessagesRead(friendId);
    })();

    const unsubscribe = subscribeToIncomingMessages(currentUser.id, (msg) => {
      if (msg.senderId !== friendId) return;
      setMessages((prev) => [...prev, msg]);
      markMessagesRead(friendId);
    });

    return () => { cancelled = true; unsubscribe(); };
  }, [currentUser.id, friendId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    setInput('');
    const sent = await sendMessage(friendId, content);
    setSending(false);
    if (sent) {
      setMessages((prev) => [...prev, sent]);
    } else {
      setInput(content);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0A1428] via-[#0E1A33] to-[#08101F] text-slate-100 -mx-4 -my-6 sm:mx-0 sm:my-0 sm:rounded-3xl overflow-hidden flex flex-col">
      <div className="max-w-2xl w-full mx-auto px-4 sm:px-6 py-4 flex flex-col flex-1 min-h-screen" dir="rtl">

        <div className="flex items-center justify-between shrink-0 pb-3 border-b border-white/10">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
            <span>رجوع</span>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-xs font-black text-white overflow-hidden shrink-0">
              {friendAvatar
                ? <img src={friendAvatar} alt={friendName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                : friendName.charAt(0)}
            </div>
            <span className="text-xs font-black text-slate-200">{friendName}</span>
          </div>
          <div className="w-14" aria-hidden />
        </div>

        {/* Message list */}
        <div className="flex-1 overflow-y-auto py-4 space-y-2.5">
          {loading ? (
            <div className="flex items-center justify-center gap-2 text-slate-400 py-8">
              <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
              <span className="text-xs font-bold">جارٍ تحميل المحادثة...</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-10">
              <MessageCircle className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-500 font-bold">ابدأ المحادثة مع {friendName}</p>
            </div>
          ) : (
            messages.map((m) => {
              const isMine = m.senderId === currentUser.id;
              return (
                <div key={m.id} className={`max-w-[75%] ${isMine ? 'ml-auto' : 'mr-auto'}`}>
                  <div
                    dir="rtl"
                    className={`rounded-2xl px-3.5 py-2.5 text-sm font-medium leading-relaxed shadow-md ${
                      isMine
                        ? 'bg-gradient-to-br from-amber-500 to-amber-700 text-white'
                        : 'bg-white/10 border border-white/10 text-slate-100'
                    }`}
                  >
                    {m.content}
                  </div>
                  <p className={`text-[9px] text-slate-500 font-bold mt-1 px-1 ${isMine ? 'text-left' : 'text-right'}`}>
                    {formatTime(m.createdAt)}
                  </p>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Composer */}
        <div className="shrink-0 flex items-center gap-2 pt-3 border-t border-white/10">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
            placeholder="اكتب رسالة..."
            maxLength={2000}
            className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-amber-500/40 transition-colors min-w-0"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || !input.trim()}
            className="flex items-center justify-center bg-gradient-to-l from-amber-500 to-amber-700 hover:from-amber-400 hover:to-amber-600 disabled:opacity-50 text-white p-3 rounded-2xl shadow-lg transition-colors shrink-0"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>

      </div>
    </div>
  );
}
