import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User } from '../../types';
import { MessageCircle, X as XIcon, Send, Smile } from 'lucide-react';
import { RoomMessage, loadRoomMessages, sendRoomMessage, subscribeToRoomMessages } from '../multiplayer';

interface RoomChatProps {
  currentUser: User;
  roomId: string;
  opponentName: string | null;
}

const QUICK_EMOJIS = ['👍', '🔥', '😂', '👏', '🤯', '🎉', '😎'];
const QUICK_PHRASES = ['بالتوفيق! 🙏', 'لعبة رائعة! 🎮', 'إجابة قوية! 👏', 'قريب أوي! 😅', 'الرب معاك ✝️', 'شد حيلك! 💪', 'مبروك! 🎉'];

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
}

// Chat scoped to a single game_rooms row (migration 040) — ported from
// the original prototype's ChatComponent, but room-scoped instead of a
// shared global string key, since two real opponents are frequently
// strangers rather than friends (see social.ts's friend-only chat).
export default function RoomChat({ currentUser, roomId, opponentName }: RoomChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showQuick, setShowQuick] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setMessages([]);
    setUnreadCount(0);
    (async () => {
      const history = await loadRoomMessages(roomId);
      if (!cancelled) setMessages(history);
    })();

    const unsubscribe = subscribeToRoomMessages(roomId, (msg) => {
      setMessages((prev) => [...prev, msg]);
      if (msg.senderId !== currentUser.id) {
        setUnreadCount((prev) => prev + 1);
        if (typeof navigator.vibrate === 'function') {
          try { navigator.vibrate(50); } catch { /* no-op */ }
        }
      }
    });

    return () => { cancelled = true; unsubscribe(); };
  }, [roomId, currentUser.id]);

  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, messages]);

  const handleSend = async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setInput('');
    setShowQuick(false);
    const sent = await sendRoomMessage(roomId, trimmed);
    setSending(false);
    if (sent) setMessages((prev) => [...prev, sent]);
    else setInput(trimmed);
  };

  return (
    <div className="fixed bottom-20 left-4 z-40" dir="rtl">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            transition={{ type: 'spring', damping: 22, stiffness: 300 }}
            className="absolute bottom-14 left-0 w-72 sm:w-80 h-96 bg-gradient-to-br from-[#132247] to-[#0A1732] border border-white/10 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
              <span className="text-xs font-black text-slate-200">
                دردشة المباراة{opponentName ? ` — ${opponentName}` : ''}
              </span>
              <button type="button" onClick={() => setIsOpen(false)} className="p-1 rounded-lg hover:bg-white/10 text-slate-400">
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-500">
                  <Smile className="w-6 h-6" />
                  <p className="text-[10.5px] font-bold">لا توجد رسائل بعد</p>
                </div>
              ) : (
                messages.map((m) => {
                  const isMine = m.senderId === currentUser.id;
                  return (
                    <div key={m.id} className={`max-w-[80%] ${isMine ? 'ml-auto' : 'mr-auto'}`}>
                      <div
                        className={`rounded-2xl px-3 py-1.5 text-xs font-medium leading-relaxed ${
                          isMine ? 'bg-gradient-to-br from-amber-500 to-amber-700 text-white' : 'bg-white/10 border border-white/10 text-slate-100'
                        }`}
                      >
                        {m.content}
                      </div>
                      <p className={`text-[8.5px] text-slate-500 font-bold mt-0.5 px-1 ${isMine ? 'text-left' : 'text-right'}`}>
                        {formatTime(m.createdAt)}
                      </p>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            {showQuick && (
              <div className="px-3 pb-2 space-y-1.5 shrink-0">
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_EMOJIS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => handleSend(e)}
                      className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-base"
                    >
                      {e}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_PHRASES.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handleSend(p)}
                      className="text-[9.5px] font-bold px-2 py-1 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-1.5 px-3 py-2.5 border-t border-white/10 shrink-0">
              <button
                type="button"
                onClick={() => setShowQuick((v) => !v)}
                className={`p-2 rounded-xl shrink-0 transition-colors ${showQuick ? 'bg-amber-500/20 text-amber-300' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
              >
                <Smile className="w-4 h-4" />
              </button>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSend(input); }}
                placeholder="اكتب رسالة..."
                maxLength={500}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 outline-none focus:border-amber-500/40 min-w-0"
              />
              <button
                type="button"
                onClick={() => handleSend(input)}
                disabled={sending || !input.trim()}
                className="p-2 rounded-xl bg-gradient-to-l from-amber-500 to-amber-700 disabled:opacity-50 text-white shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="relative w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 shadow-2xl flex items-center justify-center text-white"
      >
        {isOpen ? <XIcon className="w-5 h-5" /> : <MessageCircle className="w-5 h-5" />}
        {!isOpen && unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ repeat: Infinity, duration: 1.4 }}
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center border-2 border-[#0A1428]"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </motion.span>
        )}
      </button>
    </div>
  );
}
