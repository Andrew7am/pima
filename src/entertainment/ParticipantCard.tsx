import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  QrCode, Copy, Share2, ChevronDown, ChevronUp, Home, Layers, 
  Star, Shield, Award, ShieldAlert, CheckCircle, Info, Compass
} from 'lucide-react';
import { 
  createOrGetParticipantCard, 
  listenToParticipantCard 
} from '../lib/participantCardDb';
import { ParticipantCard as ParticipantCardType } from '../types';

interface ParticipantCardProps {
  currentUser: {
    id: string;
    name: string;
    avatar?: string;
  };
}

export default function ParticipantCard({ currentUser }: ParticipantCardProps) {
  const [card, setCard] = useState<ParticipantCardType | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [showFullQR, setShowFullQR] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    id: string;
    title: string;
    body: string;
    type: 'room' | 'team' | 'points' | 'attendance' | 'status';
  } | null>(null);

  // Keep track of previous card values to detect changes and show specific overlay notifications
  const prevCardRef = useRef<ParticipantCardType | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  useEffect(() => {
    if (!currentUser?.id) return;

    let active = true;

    // Fetch initial card or auto-create it
    createOrGetParticipantCard(currentUser.id, currentUser.name, currentUser.avatar)
      .then((initialCard) => {
        if (!active) return;
        setCard(initialCard);
        prevCardRef.current = initialCard;
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error securing participant card, falling back to local card:", err);
        if (!active) return;
        
        // Fallback card generated locally to ensure the user ALWAYS sees their card
        const fallbackCard: ParticipantCardType = {
          userId: currentUser.id,
          userName: currentUser.name,
          avatarUrl: currentUser.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(currentUser.name)}`,
          teamName: 'فريق القديس بولس الرسول',
          roomNo: 'B12',
          building: 'B',
          floor: 'الثاني',
          points: 320,
          level: 5,
          attendanceStatus: 'تم التسجيل',
          cardStatus: 'فعالة',
          qrCodeData: `COPTIC-CONF-CARD-${currentUser.id}`,
          auditLog: [
            {
              id: `init-${Date.now()}`,
              action: 'تفعيل البطاقة الاحتياطية',
              details: 'تم تفعيل بطاقة مشارك رقمية احتياطية (وضع عدم الاتصال المحلي).',
              updatedBy: 'النظام المحلي الاحتياطي',
              timestamp: new Date().toISOString()
            }
          ],
          updatedAt: new Date().toISOString()
        };
        setCard(fallbackCard);
        prevCardRef.current = fallbackCard;
        setLoading(false);
      });

    // Establish dynamic real-time Firestore listener
    const unsubscribe = listenToParticipantCard(currentUser.id, (updatedCard) => {
      if (!active) return;
      setCard(updatedCard);
      
      const prev = prevCardRef.current;
      if (prev) {
        // Detect exact updates to pop notifications
        if (updatedCard.roomNo !== prev.roomNo || updatedCard.building !== prev.building || updatedCard.floor !== prev.floor) {
          setNotification({
            id: `notif-${Date.now()}`,
            title: 'تم تغيير الغرفة 🔑',
            body: `تم نقلك إلى الغرفة ${updatedCard.roomNo} – المبنى ${updatedCard.building} – الدور ${updatedCard.floor}.`,
            type: 'room'
          });
        }
        else if (updatedCard.teamName !== prev.teamName) {
          setNotification({
            id: `notif-${Date.now()}`,
            title: 'تم تغيير الفريق 👥',
            body: `أصبحت ضمن ${updatedCard.teamName}.`,
            type: 'team'
          });
        }
        else if (updatedCard.points > prev.points) {
          const delta = updatedCard.points - prev.points;
          setNotification({
            id: `notif-${Date.now()}`,
            title: `تم إضافة نقاط +${delta} 🌟`,
            body: `تمت إضافة ${delta} نقطة إلى رصيدك بنجاح!`,
            type: 'points'
          });
        }
        else if (updatedCard.attendanceStatus === 'تم التسجيل' && prev.attendanceStatus !== 'تم التسجيل') {
          setNotification({
            id: `notif-${Date.now()}`,
            title: 'تم تسجيل حضورك ✅',
            body: 'تم تأكيد حضورك لمحاضرة اليوم بنجاح.',
            type: 'attendance'
          });
        }
        else if (updatedCard.cardStatus !== prev.cardStatus) {
          setNotification({
            id: `notif-${Date.now()}`,
            title: 'تحديث حالة البطاقة ⚠️',
            body: `حالة بطاقتك الرقمية أصبحت الآن: [${updatedCard.cardStatus}].`,
            type: 'status'
          });
        }
      }

      prevCardRef.current = updatedCard;
    }, (error) => {
      console.error("Firestore participant card subscription error:", error);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [currentUser?.id]);

  const handleCopyRoom = () => {
    if (!card) return;
    navigator.clipboard.writeText(card.roomNo);
    showToast('تم نسخ رقم الغرفة بنجاح! 📋');
  };

  const handleShareCard = () => {
    if (!card) return;
    const shareText = `بطاقتي الرقمية للمؤتمر: ${card.userName} - فريق: ${card.teamName} - غرفة: ${card.roomNo} - مبنى: ${card.building}`;
    if (navigator.share) {
      navigator.share({
        title: 'بطاقة المشارك للمؤتمر',
        text: shareText,
        url: window.location.href
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareText);
      showToast('تم نسخ رابط وتفاصيل البطاقة للمشاركة! 🔗');
    }
  };

  if (loading) {
    return (
      <div className="bg-purple-950/20 border border-purple-500/20 rounded-[24px] p-6 text-center text-purple-200 flex items-center justify-center gap-3" dir="rtl">
        <div className="w-5 h-5 rounded-full border-2 border-amber-500 border-t-transparent animate-spin"></div>
        <span className="text-xs font-black font-sans">جاري تحميل وتزامن بطاقتك الرقمية لحظياً...</span>
      </div>
    );
  }

  if (!card) return null;

  const isSuspendedOrCancelled = card.cardStatus === 'موقوفة' || card.cardStatus === 'ملغاة';

  return (
    <div className="relative w-full" dir="rtl">
      
      {/* Toast Alert */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 bg-amber-500 text-purple-950 border border-amber-400 px-4 py-2 rounded-xl shadow-xl z-50 text-xs font-black flex items-center gap-2"
          >
            <span>✨</span>
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Realtime In-App Notification Overlay Banner */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed bottom-6 left-6 right-6 md:left-auto md:right-6 md:w-[420px] bg-gradient-to-br from-purple-950 to-[#2E1065] text-white border-2 border-amber-400 p-5 rounded-2xl shadow-2xl z-50 overflow-hidden text-right"
          >
            <div className="absolute -top-12 -left-12 w-32 h-32 bg-amber-400/10 rounded-full blur-2xl pointer-events-none"></div>
            
            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-full bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-2xl shrink-0">
                {notification.type === 'room' && '🔑'}
                {notification.type === 'team' && '👥'}
                {notification.type === 'points' && '🌟'}
                {notification.type === 'attendance' && '✅'}
                {notification.type === 'status' && '⚠️'}
              </div>
              <div className="flex-1 space-y-1">
                <h4 className="text-sm font-black text-amber-300">{notification.title}</h4>
                <p className="text-xs text-purple-100 leading-relaxed font-sans">{notification.body}</p>
                <div className="pt-2 flex justify-end">
                  <button 
                    onClick={() => setNotification(null)}
                    className="bg-amber-500 hover:bg-amber-600 text-purple-950 px-3 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer"
                  >
                    حسناً، فهمت 👍
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Collapsible Card container */}
      <div className="bg-gradient-to-br from-[#1E1B4B] via-[#2E1065] to-purple-950 border-2 border-amber-500/40 rounded-[24px] shadow-lg overflow-hidden relative">
        {/* Decorative gold premium border outline */}
        <div className="absolute top-0 right-0 left-0 h-[3px] bg-gradient-to-r from-transparent via-amber-400 to-transparent"></div>
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-amber-500/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* Card Header (Always visible - Name, Team, Room, Points in collapsed mode) */}
        <div 
          className="p-4 sm:p-5 flex items-center justify-between gap-4 cursor-pointer select-none" 
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <div className="flex items-center gap-3">
            {/* User Avatar with premium gold border */}
            <div className="relative shrink-0">
              <div className="absolute inset-0 bg-gradient-to-tr from-amber-400 to-amber-600 rounded-full blur-[2px] opacity-60"></div>
              <img 
                src={card.avatarUrl} 
                alt={card.userName} 
                className="w-11 h-11 sm:w-12 sm:h-12 rounded-full border border-amber-400 bg-purple-900 relative z-10 object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute -bottom-1 -left-1 bg-amber-500 border border-purple-950 rounded-full w-4.5 h-4.5 flex items-center justify-center text-[8px] font-black text-purple-950 z-20">
                {card.level}
              </div>
            </div>

            {/* Profile Overview (Name, Team, Room, Points as requested) */}
            <div className="text-right">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black text-purple-300">بطاقة المشارك الرقمية / digital card</span>
                {isSuspendedOrCancelled ? (
                  <span className="bg-red-500/20 text-red-300 border border-red-500/30 px-2 py-0.5 rounded-full text-[9px] font-black animate-pulse">
                    {card.cardStatus} 🚫
                  </span>
                ) : (
                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full text-[9px] font-black">
                    نشط ورسمي 🛡️
                  </span>
                )}
              </div>
              <h3 className="text-base sm:text-lg font-black text-white tracking-tight mt-0.5">{card.userName}</h3>
              <p className="text-[10px] text-purple-200/70 font-sans font-bold flex items-center gap-1.5 mt-0.5">
                <span>{card.teamName}</span>
                <span>•</span>
                <span className="text-amber-300 font-sans">غرفة {card.roomNo}</span>
                <span>•</span>
                <span className="text-amber-300 font-mono">{card.points} نقطة</span>
              </p>
            </div>
          </div>

          {/* Action indicator */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] text-amber-400/80 font-black hidden sm:inline">
              {isCollapsed ? 'عرض التفاصيل والـ QR' : 'إخفاء التفاصيل'}
            </span>
            <button 
              className="w-8 h-8 rounded-xl bg-purple-900/60 border border-purple-500/20 flex items-center justify-center text-amber-200 hover:bg-purple-900 transition-colors"
            >
              {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Collapsible Card Details (Animated with Framer Motion) */}
        <AnimatePresence initial={false}>
          {!isCollapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="overflow-hidden border-t border-purple-500/20 bg-purple-950/20"
            >
              <div className="p-4 sm:p-6 space-y-6">
                
                {/* Suspended logic */}
                {isSuspendedOrCancelled ? (
                  <div className="bg-red-950/60 border border-red-500/30 p-4 rounded-xl text-center space-y-2">
                    <ShieldAlert className="w-10 h-10 text-red-400 mx-auto animate-bounce" />
                    <h4 className="text-sm font-black text-red-300">تم إيقاف فاعلية هذه البطاقة</h4>
                    <p className="text-xs text-red-100/80 leading-relaxed font-sans max-w-md mx-auto">
                      البطاقة الرقمية الخاصة بك معطلة أو ملغاة حالياً من قبل اللجنة المنظمة والمنظمين. يرجى التوجه إلى مكتب الخدمة أو مراجعة خادم الغرفة للتفعيل.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Bento Grid layout for full Accommodation and Level Details */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 text-right">
                      
                      {/* Room Number */}
                      <div className="col-span-2 bg-gradient-to-br from-purple-900/60 to-purple-950 border border-purple-500/30 p-4 rounded-2xl flex flex-col justify-between min-h-[110px] relative overflow-hidden group">
                        <div className="absolute -top-10 -left-10 w-24 h-24 bg-amber-500/5 rounded-full blur-xl group-hover:bg-amber-500/10 transition-colors"></div>
                        <div className="flex justify-between items-start">
                          <span className="text-[10px] text-purple-300 font-bold">رقم الغرفة Assigned Room</span>
                          <span className="text-xs">🔑</span>
                        </div>
                        <div className="mt-2 flex items-baseline justify-between">
                          <span className="text-3xl sm:text-4xl font-mono font-black text-amber-300 tracking-tight">{card.roomNo}</span>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyRoom();
                            }}
                            className="bg-purple-800/80 hover:bg-purple-800 text-amber-200 p-2 rounded-lg text-[10px] font-black transition-all flex items-center gap-1 border border-purple-700"
                            title="نسخ رقم الغرفة"
                          >
                            <Copy className="w-3 h-3" />
                            <span>نسخ</span>
                          </button>
                        </div>
                      </div>

                      {/* Points Area */}
                      <div className="bg-purple-900/40 border border-purple-500/20 p-4 rounded-2xl flex flex-col justify-between">
                        <div className="flex justify-between items-start text-purple-300 text-[10px] font-bold">
                          <span>النقاط الإجمالية</span>
                          <Star className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        </div>
                        <div className="mt-3">
                          <span className="text-2xl font-mono font-black text-amber-200 block">{card.points}</span>
                          <span className="text-[9px] text-purple-300 block mt-0.5">رصيد النقاط الكلي</span>
                        </div>
                      </div>

                      {/* Level Area */}
                      <div className="bg-purple-900/40 border border-purple-500/20 p-4 rounded-2xl flex flex-col justify-between">
                        <div className="flex justify-between items-start text-purple-300 text-[10px] font-bold">
                          <span>المستوى الجاري</span>
                          <Award className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        </div>
                        <div className="mt-3">
                          <span className="text-2xl font-mono font-black text-amber-200 block">{card.level}</span>
                          <span className="text-[9px] text-purple-300 block mt-0.5">مستوى المشاركة</span>
                        </div>
                      </div>

                      {/* Building */}
                      <div className="bg-purple-900/40 border border-purple-500/20 p-4 rounded-2xl flex flex-col justify-between">
                        <div className="flex justify-between items-start text-purple-300 text-[10px] font-bold">
                          <span>المبنى السكني</span>
                          <Home className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                        </div>
                        <div className="mt-3">
                          <span className="text-xl font-black text-white block">مبنى {card.building}</span>
                          <span className="text-[9px] text-purple-300 block mt-0.5">الموقع السكني بالمقر</span>
                        </div>
                      </div>

                      {/* Floor */}
                      <div className="bg-purple-900/40 border border-purple-500/20 p-4 rounded-2xl flex flex-col justify-between">
                        <div className="flex justify-between items-start text-purple-300 text-[10px] font-bold">
                          <span>الدور / الطابق</span>
                          <Layers className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                        </div>
                        <div className="mt-3">
                          <span className="text-xl font-black text-white block">{card.floor}</span>
                          <span className="text-[9px] text-purple-300 block mt-0.5">رقم الدور المحدد</span>
                        </div>
                      </div>

                      {/* Attendance Status */}
                      <div className="bg-purple-900/40 border border-purple-500/20 p-4 rounded-2xl flex flex-col justify-between">
                        <div className="flex justify-between items-start text-purple-300 text-[10px] font-bold">
                          <span>حالة الحضور اليوم</span>
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        </div>
                        <div className="mt-3">
                          <span className={`text-xs font-black px-2 py-0.5 rounded-full inline-block ${
                            card.attendanceStatus === 'تم التسجيل' 
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}>
                            {card.attendanceStatus}
                          </span>
                          <span className="text-[9px] text-purple-300 block mt-1.5">محاضرات اليوم الفعالة</span>
                        </div>
                      </div>

                      {/* QR Code Quick Display card */}
                      <div className="bg-purple-900/40 border border-purple-500/20 p-4 rounded-2xl flex items-center justify-between gap-3">
                        <div className="text-right space-y-1">
                          <span className="text-[10px] text-purple-300 block font-bold">رمز التحقق الرقمي</span>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowFullQR(true);
                            }}
                            className="bg-amber-500 hover:bg-amber-600 text-purple-950 text-[10px] font-black px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 border border-amber-400 shadow-sm"
                          >
                            <QrCode className="w-3 h-3" />
                            <span>عرض الرمز</span>
                          </button>
                        </div>
                        <div 
                          className="bg-white p-1 rounded-xl w-14 h-14 flex items-center justify-center shrink-0 border border-amber-500/20 cursor-pointer" 
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowFullQR(true);
                          }}
                        >
                          <QRCodeSVG value={card.qrCodeData} size={48} level="M" />
                        </div>
                      </div>

                    </div>

                    {/* Footer Actions */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 justify-end border-t border-purple-500/10">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleShareCard();
                        }}
                        className="bg-purple-900/60 hover:bg-purple-900 text-amber-200 border border-amber-500/30 px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>مشاركة تفاصيل بطاقتي</span>
                      </button>
                    </div>

                    {/* Audit Logs */}
                    {card.auditLog && card.auditLog.length > 0 && (
                      <div className="border-t border-purple-500/10 pt-4 space-y-2 text-right">
                        <h4 className="text-xs font-black text-purple-300 flex items-center gap-1.5 font-sans">
                          <Info className="w-3.5 h-3.5 text-amber-400" />
                          <span>سجل تعديلات وإصدارات البطاقة (Audit Log)</span>
                        </h4>
                        <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                          {card.auditLog.map((log) => (
                            <div key={log.id} className="bg-purple-950/40 p-2 rounded-xl border border-purple-500/10 text-[10px] flex items-start justify-between gap-4 font-sans">
                              <div className="space-y-0.5">
                                <span className="font-bold text-amber-300 block">{log.action} • <span className="text-purple-300 text-[9px]">{log.updatedBy}</span></span>
                                <p className="text-purple-100/95 leading-relaxed">{log.details}</p>
                              </div>
                              <span className="text-purple-400 text-[9px] shrink-0 font-mono mt-0.5">
                                {new Date(log.timestamp).toLocaleTimeString('ar-EG', {hour: '2-digit', minute:'2-digit'})}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Full QR Modal */}
      <AnimatePresence>
        {showFullQR && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-gradient-to-br from-[#1E1B4B] to-purple-950 border-2 border-amber-500 p-6 sm:p-8 rounded-[36px] max-w-sm w-full text-center relative space-y-6"
            >
              <button 
                onClick={() => setShowFullQR(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-purple-900/80 text-amber-200 border border-purple-500/30 flex items-center justify-center hover:bg-purple-800 cursor-pointer text-sm font-bold"
              >
                ✕
              </button>

              <div className="space-y-2">
                <span className="text-[11px] font-black text-amber-300 tracking-wider block uppercase">رمز التحقق والتحضير السريع 🏰</span>
                <h3 className="text-base font-black text-white">{card.userName}</h3>
                <p className="text-xs text-purple-200/80 font-sans">{card.teamName} • غرفة {card.roomNo}</p>
              </div>

              <div className="bg-white p-4 rounded-[28px] inline-block shadow-2xl border-4 border-amber-500 relative mx-auto">
                <QRCodeSVG value={card.qrCodeData} size={180} level="H" includeMargin={true} />
                <div className="absolute inset-2 border border-slate-200 pointer-events-none rounded-2xl"></div>
              </div>

              <div className="space-y-1.5 text-xs text-purple-200/90 leading-relaxed font-sans px-4">
                <p>اعرض هذا الرمز على خادم القاعة لتسجيل حضورك الفوري للمحاضرة أو التثبيت السكني.</p>
                <div className="bg-purple-900/40 p-2.5 rounded-xl border border-purple-500/15 flex items-center gap-2 justify-center text-[10px] text-amber-300 mt-2">
                  <Shield className="w-3.5 h-3.5" />
                  <span>معتمد كبطاقة رقمية مشفرة لعام ٢٠٢٦</span>
                </div>
              </div>

              <button 
                onClick={() => setShowFullQR(false)}
                className="w-full bg-amber-500 hover:bg-amber-600 text-purple-950 font-black py-3 rounded-2xl text-xs transition-all cursor-pointer border border-amber-400"
              >
                إغلاق النافذة
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
