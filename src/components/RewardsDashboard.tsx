import React from 'react';
import { User } from '../types';
import { Award, Gift, History, Sparkles, TrendingUp, ChevronRight, Coins, ShieldAlert } from 'lucide-react';

interface RewardsDashboardProps {
  currentUser: User;
  onBack: () => void;
}

export default function RewardsDashboard({ currentUser, onBack }: RewardsDashboardProps) {
  const points = currentUser.points || 0;
  const history = currentUser.pointsHistory || [];

  // Determine Customer Level / Tier
  let levelName = 'المستوى البرونزي 🥉';
  let levelBadgeColor = 'bg-amber-100 text-amber-800 border-amber-300';
  let levelMultiplier = '1.0x';
  let nextLevelPoints = 500;
  let progressToNextLevel = (points / 500) * 100;

  if (points >= 2000) {
    levelName = 'المستوى البلاتيني 💎';
    levelBadgeColor = 'bg-indigo-100 text-indigo-900 border-indigo-300';
    levelMultiplier = '1.5x';
    nextLevelPoints = 2000;
    progressToNextLevel = 100;
  } else if (points >= 1000) {
    levelName = 'المستوى الذهبي 🥇';
    levelBadgeColor = 'bg-yellow-100 text-yellow-950 border-yellow-300';
    levelMultiplier = '1.25x';
    nextLevelPoints = 2000;
    progressToNextLevel = ((points - 1000) / 1000) * 100;
  } else if (points >= 500) {
    levelName = 'المستوى الفضي 🥈';
    levelBadgeColor = 'bg-slate-200 text-slate-800 border-slate-300';
    levelMultiplier = '1.1x';
    nextLevelPoints = 1000;
    progressToNextLevel = ((points - 500) / 500) * 100;
  }

  // Format Date to legible Arabic format
  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-4 text-right animate-in fade-in duration-200">
      
      {/* Top Header */}
      <div className="flex items-center gap-2 pb-1 border-b border-[#D6D6C2]">
        <button
          onClick={onBack}
          className="p-1.5 rounded-xl border border-[#D6D6C2] bg-white hover:bg-[#EBEBE0]/50 text-[#4A4A3A] transition-all cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-sm font-black text-[#0A2342]">المكافآت والنقاط</h2>
          <p className="text-[10px] text-[#8A8A70]">برنامج الولاء والخصومات الخاص بكنيستنا</p>
        </div>
      </div>

      {/* Main Loyalty Card */}
      <div className="bg-gradient-to-br from-[#0A2342] to-[#123E75] text-white p-3.5 rounded-2xl shadow-md relative overflow-hidden space-y-2.5">
        {/* Decorative elements */}
        <div className="absolute -top-10 -left-10 w-28 h-28 bg-white/5 rounded-full blur-xl pointer-events-none" />
        <div className="absolute -bottom-10 -right-10 w-24 h-24 bg-[#C5A059]/10 rounded-full blur-lg pointer-events-none" />

        <div className="flex justify-between items-start">
          <div className="space-y-0.5">
            <span className="text-[9px] text-slate-300 font-bold block">رصيد النقاط الحالي</span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-[#C5A059]">{points.toLocaleString('ar-EG')}</span>
              <span className="text-[10px] text-slate-200 font-semibold">نقطة</span>
            </div>
          </div>
          
          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border shadow-xs ${levelBadgeColor}`}>
            {levelName}
          </span>
        </div>

        {/* Next level progress bar */}
        {points < 2000 && (
          <div className="space-y-1 pt-1">
            <div className="flex justify-between text-[8px] text-slate-300 font-semibold">
              <span>التقدم للمستوى التالي: {points} / {nextLevelPoints}</span>
              <span>{Math.round(progressToNextLevel)}%</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-1 overflow-hidden">
              <div 
                className="bg-[#C5A059] h-full rounded-full transition-all duration-500" 
                style={{ width: `${Math.min(100, Math.max(0, progressToNextLevel))}%` }}
              />
            </div>
          </div>
        )}

        <div className="border-t border-white/10 pt-2 flex justify-between items-center text-[9px] text-slate-300 font-bold">
          <div className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-[#C5A059]" />
            <span>مضاعف النقاط: {levelMultiplier}</span>
          </div>
          <span>1 نقطة = 1 ج.م خصم تلقائي</span>
        </div>
      </div>

      {/* Rewards System rules and benefits */}
      <div className="bg-white rounded-3xl p-4 border border-[#D6D6C2] shadow-sm space-y-3">
        <h3 className="text-xs font-black text-[#0A2342] flex items-center gap-1.5">
          <Gift className="w-4 h-4 text-[#C5A059]" />
          <span>مزايا وعروض مستوى الخدمة</span>
        </h3>

        <div className="grid grid-cols-1 gap-2.5 text-[10px]">
          <div className="flex items-start gap-2 bg-[#FDFBF7] p-2.5 rounded-2xl border border-[#D6D6C2]/40">
            <Coins className="w-4 h-4 text-[#C5A059] shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold text-[#4A4A3A]">خصومات فورية عند الدفع</span>
              <p className="text-[#8A8A70] leading-relaxed">استبدل نقاطك أثناء حجز أي خلوة أو مؤتمر للحصول على خصم مباشر بقيمة 1 ج.م لكل نقطة.</p>
            </div>
          </div>

          <div className="flex items-start gap-2 bg-[#FDFBF7] p-2.5 rounded-2xl border border-[#D6D6C2]/40">
            <Sparkles className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold text-[#4A4A3A]">رحلة مجانية كاملة</span>
              <p className="text-[#8A8A70] leading-relaxed">عند تجميعك ٢,٠٠٠ نقطة، يمكنك تحويلها بالكامل لتأمين خلوة فردية مجانية بالكامل في أي بيت من الفئة الاقتصادية.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Points Transactions History */}
      <div className="bg-white rounded-3xl p-4 border border-[#D6D6C2] shadow-sm space-y-3">
        <h3 className="text-xs font-black text-[#0A2342] flex items-center gap-1.5">
          <History className="w-4 h-4 text-[#C5A059]" />
          <span>سجل العمليات والنشاط ({history.length})</span>
        </h3>

        {history.length === 0 ? (
          <div className="text-center py-6 text-slate-400 space-y-1">
            <p className="text-[11px] font-bold">لا يوجد حركات مسجلة حالياً للنقاط.</p>
            <p className="text-[9px]">ابدأ حجز خلواتك لتكتسب نقاطك الأولى!</p>
          </div>
        ) : (
          <div className="divide-y divide-[#D6D6C2]/30 max-h-80 overflow-y-auto pr-1">
            {history.slice().reverse().map((tx) => {
              const isEarned = tx.type === 'earned';
              return (
                <div key={tx.id} className="py-3 flex justify-between items-center text-xs">
                  <div className="space-y-0.5 text-right">
                    <span className="font-bold text-[#4A4A3A] block">{tx.description}</span>
                    <span className="text-[9px] text-[#8A8A70] font-medium">{formatDate(tx.date)}</span>
                  </div>
                  
                  <span className={`font-black text-xs shrink-0 px-2 py-1 rounded-xl ${
                    isEarned 
                      ? 'bg-emerald-50 text-emerald-700 font-mono' 
                      : 'bg-rose-50 text-rose-700 font-mono'
                  }`}>
                    {isEarned ? '+' : '-'}{tx.amount}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
