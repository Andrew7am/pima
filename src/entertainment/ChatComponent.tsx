import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, MessageSquare, X, Smile } from 'lucide-react';
import { db, auth } from './rmatchFirebase';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from './rmatchFirebase';

interface ChatComponentProps {
  roomId: string;
  senderName: string;
}

const QUICK_PHRASES = [
  "لعبة رائعة! 🎮",
  "أحسنت! 👏",
  "سؤال صعب جداً! 🤯",
  "أنا متأكد من هذه الإجابة! 😎",
  "يا إلهي، أخطأت! 🤦‍♂️",
  "حظاً موفقاً! ✨",
  "تحدي حماسي! 🔥",
];

const QUICK_EMOJIS = ["👍", "🔥", "😂", "👏", "🤯", "🎉", "😎"];

export const ChatComponent: React.FC<ChatComponentProps> = ({ roomId, senderName }) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    console.log("ChatComponent: roomId", roomId);
    if (!auth.currentUser) {
        console.warn("ChatComponent: Not authenticated");
        return;
    }
    
    console.log("ChatComponent: Querying collection", 'game_rooms', roomId, 'messages');
    const q = query(
      collection(db, 'game_rooms', roomId, 'messages'),
      orderBy('createdAt', 'asc')
    );
    
    let unsubscribeSnapshot: any;
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
        if (unsubscribeSnapshot) unsubscribeSnapshot();
        if (!user) {
            console.warn("ChatComponent: Not authenticated");
            return;
        }
        
        console.log("ChatComponent: Subscribing to snapshot");
        unsubscribeSnapshot = onSnapshot(q, 
          (snapshot) => {
            console.log("ChatComponent: Snapshot received, docs count:", snapshot.docs.length);
            setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
          },
          (error) => {
            console.error("ChatComponent: Snapshot error", error);
          }
        );
    });
    
    return () => {
        unsubscribeAuth();
        if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, [roomId]);

  useEffect(() => {
    if (isOpen) {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    if (!auth.currentUser) {
        console.warn("User not authenticated, skipping message send");
        return;
    }
    await addDoc(collection(db, 'game_rooms', roomId, 'messages'), {
      senderId: auth.currentUser.uid,
      senderName: senderName,
      text: text,
      createdAt: serverTimestamp()
    });
    if (text === newMessage) setNewMessage('');
  };

  return (
    <div className="fixed bottom-4 left-4 z-50 font-sans" dir="rtl">
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(!isOpen)}
        className="bg-gradient-to-r from-yellow-500 to-amber-600 text-slate-950 p-4 rounded-full shadow-[0_0_20px_rgba(245,197,66,0.4)] border-2 border-[#F5C542]"
      >
        <MessageSquare className="w-6 h-6 fill-current" />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="absolute bottom-18 left-0 w-80 max-w-[calc(100vw-2rem)] h-96 bg-[#0b1b36]/95 backdrop-blur-md border-2 border-blue-500/20 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
          >
            <div className="bg-[#122244]/80 p-4 flex items-center justify-between border-b border-blue-500/10">
              <h4 className="text-xs font-black text-[#F5C542]">دردشة اللعب العشوائي ⚔️</h4>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#081326]/40">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <Smile className="w-8 h-8 mb-2" />
                  <p className="text-xs font-bold">لا توجد رسائل بعد</p>
                </div>
              ) : (
                messages.map(msg => (
                  <div key={msg.id} className={`flex flex-col ${msg.senderId === auth.currentUser?.uid ? 'items-start' : 'items-end'}`}>
                    <span className="text-[9px] text-slate-400 font-bold mb-0.5">{msg.senderId === auth.currentUser?.uid ? 'أنت' : msg.senderName}</span>
                    <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs font-black ${msg.senderId === auth.currentUser?.uid ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-[#122244] text-slate-100 rounded-tl-none'}`}>
                      {msg.text}
                    </div>
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="bg-[#122244]/90 border-t border-blue-500/10 p-2 space-y-2">
              <div className="flex gap-1 overflow-x-auto no-scrollbar">
                {QUICK_EMOJIS.map(emoji => (
                  <button key={emoji} onClick={() => sendMessage(emoji)} className="text-sm p-1.5 hover:bg-blue-500/20 rounded-lg">{emoji}</button>
                ))}
              </div>
              <div className="flex gap-1 overflow-x-auto no-scrollbar">
                {QUICK_PHRASES.map(phrase => (
                  <button key={phrase} onClick={() => sendMessage(phrase)} className="whitespace-nowrap text-[9px] font-black bg-[#081326]/80 hover:bg-[#F5C542] hover:text-slate-950 text-slate-300 px-3 py-1.5 rounded-full">{phrase}</button>
                ))}
              </div>
            </div>

            <div className="border-t border-blue-500/10 p-3 bg-[#0b1b36] flex items-center gap-2">
              <input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage(newMessage)}
                className="flex-1 bg-[#081326] border border-blue-500/10 rounded-xl px-3.5 py-2 text-xs font-bold text-white placeholder-slate-500"
                placeholder="اكتب رسالة..."
              />
              <button onClick={() => sendMessage(newMessage)} className="bg-amber-500 text-slate-950 p-2 rounded-xl">
                <Send className="w-4 h-4 rotate-180" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
