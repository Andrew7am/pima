import React, { useState, useEffect } from 'react';
import { Search, Edit2, Check, X, Shield, Plus, Minus, Users, Star, Award, Home, Layers, CheckCircle } from 'lucide-react';
import { 
  listenToAllParticipantCards, 
  updateParticipantCard 
} from '../lib/participantCardDb';
import { ParticipantCard } from '../types';

interface ParticipantCardEditorProps {
  currentUser: {
    id: string;
    name: string;
  };
}

export default function ParticipantCardEditor({ currentUser }: ParticipantCardEditorProps) {
  const [cards, setCards] = useState<ParticipantCard[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingCard, setEditingCard] = useState<ParticipantCard | null>(null);
  
  // Form states
  const [roomNo, setRoomNo] = useState('');
  const [building, setBuilding] = useState('');
  const [floor, setFloor] = useState('');
  const [teamName, setTeamName] = useState('');
  const [points, setPoints] = useState(0);
  const [level, setLevel] = useState(1);
  const [attendanceStatus, setAttendanceStatus] = useState<'تم التسجيل' | 'لم يسجل'>('لم يسجل');
  const [cardStatus, setCardStatus] = useState<'فعالة' | 'موقوفة' | 'ملغاة'>('فعالة');
  
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    // Listen to all participant cards in real-time
    const unsubscribe = listenToAllParticipantCards((updatedCards) => {
      setCards(updatedCards);
    });
    return () => unsubscribe();
  }, []);

  const handleStartEdit = (card: ParticipantCard) => {
    setEditingCard(card);
    setRoomNo(card.roomNo);
    setBuilding(card.building);
    setFloor(card.floor);
    setTeamName(card.teamName);
    setPoints(card.points);
    setLevel(card.level);
    setAttendanceStatus(card.attendanceStatus);
    setCardStatus(card.cardStatus);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCard) return;

    // Detect what changed to build appropriate Audit Log actions and details
    let logAction = 'تعديل بيانات البطاقة';
    let logDetails = 'تم تحديث تفاصيل بطاقتك الرقمية من قبل خادم المشرف.';

    if (roomNo !== editingCard.roomNo || building !== editingCard.building || floor !== editingCard.floor) {
      logAction = 'تغيير الغرفة';
      logDetails = `تم نقلك إلى الغرفة ${roomNo} – المبنى ${building} – الدور ${floor}.`;
    } else if (teamName !== editingCard.teamName) {
      logAction = 'تغيير الفريق';
      logDetails = `أصبحت ضمن ${teamName}.`;
    } else if (points > editingCard.points) {
      const delta = points - editingCard.points;
      logAction = 'تم إضافة نقاط';
      logDetails = `+${delta} تمت إضافة ${delta} نقطة إلى رصيدك.`;
    } else if (attendanceStatus === 'تم التسجيل' && editingCard.attendanceStatus !== 'تم التسجيل') {
      logAction = 'تم تسجيل حضورك';
      logDetails = `تم تأكيد حضورك لمحاضرة اليوم بنجاح.`;
    } else if (cardStatus !== editingCard.cardStatus) {
      logAction = 'تغيير حالة البطاقة';
      logDetails = `حالة بطاقتك الرقمية أصبحت الآن: [${cardStatus}].`;
    }

    const updates: Partial<ParticipantCard> = {
      roomNo,
      building,
      floor,
      teamName,
      points,
      level,
      attendanceStatus,
      cardStatus
    };

    try {
      await updateParticipantCard(
        currentUser.id,
        currentUser.name,
        editingCard.userId,
        updates,
        logAction,
        logDetails
      );
      
      setSuccessMsg(`تم تحديث بطاقة المشترك "${editingCard.userName}" وإرسال الإشعار اللحظي بنجاح! ✨`);
      setEditingCard(null);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      console.error("Failed to update participant card:", err);
    }
  };

  const filteredCards = cards.filter(card => 
    card.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    card.roomNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
    card.teamName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="bg-slate-900/40 p-5 sm:p-6 rounded-[28px] border border-purple-500/20 shadow-md space-y-6 text-right" dir="rtl">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-purple-500/15 pb-4">
        <div>
          <h3 className="text-base font-black text-amber-300 flex items-center gap-2 justify-end">
            <span>لوحة التحكم وتعديل بطاقات المشاركين 👑</span>
            <Shield className="w-5 h-5 text-amber-500 shrink-0" />
          </h3>
          <p className="text-[10px] text-purple-200 mt-1">تعديل الغرف، الفرق، النقاط، حالة الحضور للبطاقات لحظياً مع إرسال إشعارات فورية.</p>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute right-3 top-2.5 w-4 h-4 text-purple-300" />
          <input 
            type="text" 
            placeholder="ابحث بالاسم، الغرفة أو الفريق..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-purple-950/40 border border-purple-500/30 rounded-xl py-1.5 pr-9 pl-3 text-xs text-white placeholder-purple-300 focus:outline-hidden focus:border-amber-400 font-sans"
          />
        </div>
      </div>

      {successMsg && (
        <div className="bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 px-4 py-3 rounded-xl text-xs font-black">
          {successMsg}
        </div>
      )}

      {/* Editor Modal/Form overlay */}
      {editingCard && (
        <div className="bg-slate-950/80 p-5 rounded-2xl border-2 border-amber-500/50 space-y-4">
          <div className="flex justify-between items-center border-b border-purple-500/10 pb-2">
            <button 
              onClick={() => setEditingCard(null)}
              className="text-purple-300 hover:text-white font-black text-sm"
            >
              ✕ إلغاء
            </button>
            <h4 className="text-xs font-black text-amber-300">تعديل بطاقة: {editingCard.userName} ✏️</h4>
          </div>

          <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans">
            
            {/* Team */}
            <div className="space-y-1">
              <label className="text-purple-300 block font-bold">اسم الفريق</label>
              <select 
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="w-full bg-purple-900/60 border border-purple-500/20 rounded-xl p-2.5 text-white text-xs"
              >
                <option value="فريق القديس بولس الرسول">فريق القديس بولس الرسول</option>
                <option value="فريق القديس بطرس الرسول">فريق القديس بطرس الرسول</option>
                <option value="فريق القديس يوحنا الحبيب">فريق القديس يوحنا الحبيب</option>
                <option value="فريق القديسة مريم العذراء">فريق القديسة مريم العذراء</option>
                <option value="فريق مارمرقس الرسول">فريق مارمرقس الرسول</option>
              </select>
            </div>

            {/* Room No */}
            <div className="space-y-1">
              <label className="text-purple-300 block font-bold">رقم الغرفة</label>
              <input 
                type="text"
                value={roomNo}
                onChange={(e) => setRoomNo(e.target.value)}
                className="w-full bg-purple-900/60 border border-purple-500/20 rounded-xl p-2.5 text-white text-xs font-mono"
              />
            </div>

            {/* Building */}
            <div className="space-y-1">
              <label className="text-purple-300 block font-bold">المبنى</label>
              <input 
                type="text"
                value={building}
                onChange={(e) => setBuilding(e.target.value)}
                className="w-full bg-purple-900/60 border border-purple-500/20 rounded-xl p-2.5 text-white text-xs"
              />
            </div>

            {/* Floor */}
            <div className="space-y-1">
              <label className="text-purple-300 block font-bold">الدور</label>
              <input 
                type="text"
                value={floor}
                onChange={(e) => setFloor(e.target.value)}
                className="w-full bg-purple-900/60 border border-purple-500/20 rounded-xl p-2.5 text-white text-xs"
              />
            </div>

            {/* Points and Quick Buttons */}
            <div className="space-y-1">
              <label className="text-purple-300 block font-bold">النقاط الحالية</label>
              <div className="flex items-center gap-2">
                <button 
                  type="button"
                  onClick={() => setPoints(p => Math.max(0, p - 50))}
                  className="bg-purple-900 hover:bg-purple-800 text-amber-200 w-8 h-8 rounded-lg flex items-center justify-center font-bold border border-purple-700 cursor-pointer"
                >
                  -٥٠
                </button>
                <input 
                  type="number"
                  value={points}
                  onChange={(e) => setPoints(parseInt(e.target.value) || 0)}
                  className="flex-1 bg-purple-900/60 border border-purple-500/20 rounded-xl p-2 text-white text-xs text-center font-mono"
                />
                <button 
                  type="button"
                  onClick={() => setPoints(p => p + 50)}
                  className="bg-purple-900 hover:bg-purple-800 text-amber-200 w-8 h-8 rounded-lg flex items-center justify-center font-bold border border-purple-700 cursor-pointer"
                >
                  +٥٠
                </button>
              </div>
            </div>

            {/* Level */}
            <div className="space-y-1">
              <label className="text-purple-300 block font-bold">المستوى</label>
              <input 
                type="number"
                value={level}
                onChange={(e) => setLevel(parseInt(e.target.value) || 1)}
                className="w-full bg-purple-900/60 border border-purple-500/20 rounded-xl p-2.5 text-white text-xs text-center font-mono"
              />
            </div>

            {/* Attendance */}
            <div className="space-y-1">
              <label className="text-purple-300 block font-bold">حالة الحضور</label>
              <select 
                value={attendanceStatus}
                onChange={(e) => setAttendanceStatus(e.target.value as any)}
                className="w-full bg-purple-900/60 border border-purple-500/20 rounded-xl p-2.5 text-white text-xs"
              >
                <option value="تم التسجيل">تم التسجيل ✅</option>
                <option value="لم يسجل">لم يسجل ❌</option>
              </select>
            </div>

            {/* Card Status */}
            <div className="space-y-1">
              <label className="text-purple-300 block font-bold">حالة البطاقة</label>
              <select 
                value={cardStatus}
                onChange={(e) => setCardStatus(e.target.value as any)}
                className="w-full bg-purple-900/60 border border-purple-500/20 rounded-xl p-2.5 text-white text-xs"
              >
                <option value="فعالة">فعالة 🟢</option>
                <option value="موقوفة">موقوفة ⚠️</option>
                <option value="ملغاة">ملغاة 🚫</option>
              </select>
            </div>

            <div className="md:col-span-2 pt-2 flex justify-end gap-2">
              <button 
                type="button" 
                onClick={() => setEditingCard(null)}
                className="bg-purple-900/40 hover:bg-purple-900 text-purple-200 px-4 py-2.5 rounded-xl font-bold transition-all cursor-pointer"
              >
                إلغاء
              </button>
              <button 
                type="submit" 
                className="bg-amber-500 hover:bg-amber-600 text-purple-950 px-5 py-2.5 rounded-xl font-black transition-all cursor-pointer border border-amber-400"
              >
                حفظ التعديلات والاشعار فورا 💾
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List of cards */}
      <div className="space-y-2.5">
        <h4 className="text-xs font-black text-purple-300">قائمة المشتركين ومزامنة بطاقاتهم الرقمية ({filteredCards.length})</h4>
        {filteredCards.length === 0 ? (
          <p className="text-xs text-purple-200/60 text-center py-6">لم يتم العثور على بطاقات مشاركين مطابقة.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[350px] overflow-y-auto pr-1">
            {filteredCards.map((c) => (
              <div 
                key={c.userId} 
                className="bg-purple-950/30 hover:bg-purple-950/50 border border-purple-500/15 p-3 rounded-xl flex items-center justify-between gap-3 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <img 
                    src={c.avatarUrl} 
                    alt={c.userName} 
                    className="w-9 h-9 rounded-full bg-purple-900 border border-amber-500/20 object-cover" 
                    referrerPolicy="no-referrer"
                  />
                  <div className="text-right">
                    <span className="text-xs font-black text-white block">{c.userName}</span>
                    <span className="text-[10px] text-purple-300 block font-sans">
                      {c.teamName} • <span className="text-amber-300">غرفة {c.roomNo}</span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Status pills */}
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                    c.cardStatus === 'فعالة' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'
                  }`}>
                    {c.cardStatus}
                  </span>
                  
                  <button 
                    onClick={() => handleStartEdit(c)}
                    className="bg-purple-900 hover:bg-purple-800 border border-purple-500/30 text-amber-200 px-2.5 py-1.5 rounded-lg text-[10px] font-black flex items-center gap-1 cursor-pointer transition-all"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>تعديل</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
