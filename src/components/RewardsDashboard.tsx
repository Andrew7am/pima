import React, { useState } from 'react';
import { User } from '../types';
import { Award, Gift, History, Sparkles, TrendingUp, ChevronRight, Coins, ShieldAlert, Users, Star, Copy, Check } from 'lucide-react';

interface RewardsDashboardProps {
  currentUser: User;
  onBack: () => void;
}

export default function RewardsDashboard({ currentUser, onBack }: RewardsDashboardProps) {
  const points = currentUser.points || 0;
  const history = currentUser.pointsHistory || [];
  const [copied, setCopied] = useState(false);

  const handleCopyReferralCode = () => {
    if (!currentUser.referralCode) return;
    navigator.clipboard?.writeText(currentUser.referralCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Determine Customer Level / Tier — thresholds are calibrated for the
  // 1 point = 1 EGP paid earning rate (100 points = 1 EGP at redemption),
  // roughly tracking 5,000 / 15,000 / 40,000 EGP of cumulative paid bookings.
  let levelName = 'المستوى البرونزي 🥉';
  let levelBadgeColor = 'bg-amber-100 text-amber-800 border-amber-300';
  let levelMultiplier = '1.0x';
  let nextLevelPoints = 5000;
  let progressToNextLevel = (points / 5000) * 100;

  if (points >= 40000) {
    levelName = 'المستوى البلاتيني 💎';
    levelBadgeColor = 'bg-indigo-100 text-indigo-900 border-indigo-300';
    levelMultiplier = '1.5x';
    nextLevelPoints = 40000;
    progressToNextLevel = 100;
  } else if (points >= 15000) {
    levelName = 'المستوى الذهبي 🥇';
    levelBadgeColor = 'bg-yellow-100 text-yellow-950 border-yellow-300';
    levelMultiplier = '1.25x';
    nextLevelPoints = 40000;
    progressToNextLevel = ((points - 15000) / 25000) * 100;
  } else if (points >= 5000) {
    levelName = 'المستوى الفضي 🥈';
    levelBadgeColor = 'bg-slate-200 text-slate-800 border-slate-300';
    levelMultiplier = '1.1x';
    nextLevelPoints = 15000;
    progressToNextLevel = ((points - 5000) / 10000) * 100;
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
        {points < 40000 && (
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
          <span>100 نقطة = 1 ج.م خصم تلقائي</span>
        </div>
      </div>

      {/* How to earn points */}
      <div className="bg-white rounded-3xl p-4 border border-[#D6D6C2] shadow-sm space-y-3">
        <h3 className="text-xs font-black text-[#0A2342] flex items-center gap-1.5">
          <Gift className="w-4 h-4 text-[#C5A059]" />
          <span>طرق كسب النقاط</span>
        </h3>

        <div className="grid grid-cols-1 gap-2.5 text-[10px]">
          <div className="flex items-start gap-2 bg-[#FDFBF7] p-2.5 rounded-2xl border border-[#D6D6C2]/40">
            <Coins className="w-4 h-4 text-[#C5A059] shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold text-[#4A4A3A]">1 نقطة لكل جنيه تدفعه فعلياً (100 نقطة = 1 ج.م)</span>
              <p className="text-[#8A8A70] leading-relaxed">تُضاف النقاط فور تأكيد استلام العربون أو باقي المبلغ لحجزك — وليس عند إنشاء الحجز فقط.</p>
            </div>
          </div>

          <div className="flex items-start gap-2 bg-[#FDFBF7] p-2.5 rounded-2xl border border-[#D6D6C2]/40">
            <Sparkles className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold text-[#4A4A3A]">نقطتان لكل جنيه في مواسم الهدوء</span>
              <p className="text-[#8A8A70] leading-relaxed">احجز خارج شهور الذروة (يوليو وأغسطس) واكسب ضعف النقاط على نفس المبلغ المدفوع.</p>
            </div>
          </div>

          <div className="flex items-start gap-2 bg-[#FDFBF7] p-2.5 rounded-2xl border border-[#D6D6C2]/40">
            <Star className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold text-[#4A4A3A]">500 نقطة عند تقييم أي بيت</span>
              <p className="text-[#8A8A70] leading-relaxed">شارك تجربتك بعد الإقامة واكسب نقاطاً فورية عن كل تقييم ترسله.</p>
            </div>
          </div>

          <div className="flex items-start gap-2 bg-[#FDFBF7] p-2.5 rounded-2xl border border-[#D6D6C2]/40">
            <Users className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold text-[#4A4A3A]">20,000 نقطة عند دعوة صديق</span>
              <p className="text-[#8A8A70] leading-relaxed">شارك كودك مع صديق، وستحصل على 20,000 نقطة (200 ج.م) بمجرد إتمامه أول حجز مدفوع عبر المنصة.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Referral Code */}
      {currentUser.referralCode && (
        <div className="bg-gradient-to-br from-emerald-50 to-white rounded-3xl p-4 border border-emerald-200 shadow-sm space-y-2.5">
          <h3 className="text-xs font-black text-[#0A2342] flex items-center gap-1.5">
            <Users className="w-4 h-4 text-emerald-600" />
            <span>كود دعوة أصدقائك</span>
          </h3>
          <p className="text-[10px] text-[#8A8A70] leading-relaxed">
            شارك الكود التالي مع أصدقائك ليدخلوه عند إنشاء حسابهم، واحصل على 20,000 نقطة (200 ج.م) بمجرد أول حجز مدفوع لهم.
          </p>
          <div className="flex items-center gap-2">
            <span className="flex-1 bg-white border border-emerald-300 rounded-xl px-3 py-2 text-sm font-black text-emerald-800 tracking-widest text-center" dir="ltr">
              {currentUser.referralCode}
            </span>
            <button
              onClick={handleCopyReferralCode}
              className="shrink-0 p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer"
              title="نسخ الكود"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}

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
