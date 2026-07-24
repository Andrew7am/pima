import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, Send, X, Smile, MessageCircle, Volume2 } from 'lucide-react';
import { db, auth } from './rmatchFirebase';
import { doc, updateDoc, arrayUnion } from './rmatchFirebase';

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}

interface FriendChatProps {
  roomCode: string;
  currentUser: { id: string; name: string };
  liveRoom: any;
}

const QUICK_PHRASES = [
  "لعبة رائعة! 🎮",
  "أحسنت! 👏",
  "سؤال صعب جداً! 🤯",
  "أنا متأكد من هذه الإجابة! 😎",
  "يا إلهي، أخطأت! 🤦‍♂️",
  "حظاً موفقاً! ✨",
  "تحدي حماسي! 🔥",
  "انتظرني، قادم! 🏃‍♂️",
];

const QUICK_EMOJIS = ["👍", "🔥", "😂", "👏", "🤯", "🎉", "😎", "🤦‍♂️", "⚔️"];

export const FriendChat: React.FC<FriendChatProps> = ({
  roomCode,
  currentUser,
  liveRoom,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastMessageCount, setLastMessageCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const messages: Message[] = liveRoom?.messages || [];
  const myId = auth.currentUser?.uid || currentUser.id;

  // Track unread messages
  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
      setLastMessageCount(messages.length);
    } else {
      if (messages.length > lastMessageCount) {
        setUnreadCount(prev => prev + (messages.length - lastMessageCount));
        setLastMessageCount(messages.length);
        
        // Play subtle sound or haptic simulation
        try {
          if ('vibrate' in navigator) {
            navigator.vibrate(50);
          }
        } catch (e) {}
      }
    }
  }, [messages.length, isOpen]);

  // Scroll to bottom when chat opens or new messages arrive
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [isOpen, messages.length]);

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim()) return;

    try {
      const roomRef = doc(db, 'private_rooms', roomCode);
      const newMessage: Message = {
        id: 'msg-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        senderId: myId,
        senderName: currentUser.name,
        text: textToSend.trim(),
        timestamp: Date.now(),
      };

      await updateDoc(roomRef, {
        messages: arrayUnion(newMessage),
        updatedAt: Date.now(),
      });

      setMessageText('');
    } catch (err) {
      console.error('Error sending message to Firestore:', err);
    }
  };

  return (
    <div className="fixed bottom-4 left-4 z-50 flex flex-col items-start font-sans" dir="rtl">
      {/* Floating Action Button */}
      <motion.button
        whileHover={{ scale: 1.1, y: -2 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(!isOpen)}
        className="relative bg-gradient-to-r from-yellow-500 via-amber-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-slate-950 p-4 rounded-full shadow-[0_0_20px_rgba(245,197,66,0.4)] flex items-center justify-center cursor-pointer border-2 border-[#F5C542]"
      >
        <MessageCircle className="w-5.5 h-5.5 fill-current" />
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-[#081326] animate-pulse"
            >
              {unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Chat window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="absolute bottom-18 left-0 w-80 max-w-[calc(100vw-2rem)] h-96 bg-[#0b1b36]/95 backdrop-blur-md border-2 border-blue-500/20 rounded-3xl shadow-2xl flex flex-col overflow-hidden relative"
          >
            {/* Glowing background */}
            <div className="absolute top-0 left-0 w-full h-1/2 bg-blue-500/5 blur-2xl pointer-events-none" />

            {/* Header */}
            <div className="bg-[#122244]/80 p-4 flex items-center justify-between border-b border-blue-500/10 relative z-10">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
                <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                  <span className="text-[#F5C542]">دردشة التحدي ⚔️</span>
                </h4>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Messages body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#081326]/40 relative z-10">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-4 space-y-2 text-slate-400">
                  <Smile className="w-8 h-8 text-slate-500 animate-bounce" />
                  <p className="text-[11px] font-black text-slate-300">لا توجد رسائل بعد</p>
                  <p className="text-[9.5px] text-slate-400 font-bold">أرسل عبارة أو رمزاً تعبيرياً لتشجيع صديقك!</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.senderId === myId;
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMe ? 'items-start' : 'items-end'}`}
                    >
                      <span className="text-[9px] text-slate-400 font-bold mb-0.5 px-1.5">
                        {isMe ? 'أنت' : msg.senderName}
                      </span>
                      <div
                        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs font-black leading-relaxed shadow-md border ${
                          isMe
                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-400/20 rounded-tr-none'
                            : 'bg-[#122244] border-blue-500/10 text-slate-100 rounded-tl-none'
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Actions Panel */}
            <div className="bg-[#122244]/90 border-t border-blue-500/10 p-2 space-y-2 relative z-10">
              {/* Emojis row */}
              <div className="flex gap-1 overflow-x-auto py-1 no-scrollbar justify-start">
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleSendMessage(emoji)}
                    className="text-sm p-1.5 hover:bg-blue-500/20 rounded-lg active:scale-90 transition-transform cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              {/* Phrases list */}
              <div className="flex gap-1 overflow-x-auto py-1 no-scrollbar justify-start border-t border-blue-500/10">
                {QUICK_PHRASES.map((phrase) => (
                  <button
                    key={phrase}
                    onClick={() => handleSendMessage(phrase)}
                    className="whitespace-nowrap text-[9px] font-black bg-[#081326]/80 hover:bg-[#F5C542] hover:text-slate-950 text-slate-300 px-3 py-1.5 rounded-full transition-all active:scale-95 cursor-pointer border border-blue-500/10"
                  >
                    {phrase}
                  </button>
                ))}
              </div>
            </div>

            {/* Input Footer */}
            <div className="border-t border-blue-500/10 p-3 bg-[#0b1b36] flex items-center gap-2 relative z-10">
              <input
                type="text"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSendMessage(messageText);
                  }
                }}
                placeholder="اكتب رسالتك هنا..."
                className="flex-1 bg-[#081326] border border-blue-500/10 rounded-xl px-3.5 py-2 text-xs font-bold outline-hidden focus:border-blue-400 text-white text-right placeholder-slate-500"
              />
              <button
                onClick={() => handleSendMessage(messageText)}
                className="bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-slate-950 p-2 rounded-xl active:scale-95 transition-transform cursor-pointer border border-[#F5C542]/30"
              >
                <Send className="w-4 h-4 rotate-180 fill-current" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
