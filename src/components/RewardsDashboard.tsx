import React, { useMemo, useState } from 'react';
import { User, Booking, PointsTransaction } from '../types';
import {
  Gift, History, Sparkles, ChevronRight, ChevronLeft, Coins, Users, Star, Copy, Check,
  CalendarCheck, Wallet, Share2,
} from 'lucide-react';
import { arabicNumber, arabicDate } from '../lib/arabic';
import { tapFeedback } from '../lib/haptics';

interface RewardsDashboardProps {
  currentUser: User;
  onBack: () => void;
  /** Lets the review CTA appear only when there is actually a stay to review. */
  bookings?: Booking[];
  onNavigateBookings?: () => void;
}

// Tier thresholds — calibrated for the 1 point = 1 EGP paid earning rate
// (100 points = 1 EGP at redemption), roughly tracking 5,000 / 15,000 /
// 40,000 EGP of cumulative paid bookings. Mirrored in ProfileScreen.tierFor.
const TIERS = [
  { at: 40000, name: 'البلاتيني', emoji: '💎', multiplier: 1.5,  badge: 'bg-indigo-100 text-indigo-900 border-indigo-300' },
  { at: 15000, name: 'الذهبي',   emoji: '🥇', multiplier: 1.25, badge: 'bg-yellow-100 text-yellow-950 border-yellow-300' },
  { at: 5000,  name: 'الفضي',    emoji: '🥈', multiplier: 1.1,  badge: 'bg-slate-200 text-slate-800 border-slate-300' },
  { at: 0,     name: 'البرونزي', emoji: '🥉', multiplier: 1.0,  badge: 'bg-amber-100 text-amber-800 border-amber-300' },
] as const;

// July and August are peak season; everything else earns double per EGP.
const isQuietSeason = () => { const m = new Date().getMonth(); return m !== 6 && m !== 7; };

// Icon per transaction, guessed from the free-text description the server
// writes. A wrong guess degrades to the coin icon — cosmetic only, redemption
// math never touches this.
function txIcon(tx: PointsTransaction) {
  if (tx.type === 'redeemed') return <Wallet className="w-3.5 h-3.5" />;
  if (/تقييم/.test(tx.description)) return <Star className="w-3.5 h-3.5" />;
  if (/دعوة|صديق|إحالة/.test(tx.description)) return <Users className="w-3.5 h-3.5" />;
  return <Coins className="w-3.5 h-3.5" />;
}

export default function RewardsDashboard({ currentUser, onBack, bookings = [], onNavigateBookings }: RewardsDashboardProps) {
  const points = currentUser.points || 0;
  const history = currentUser.pointsHistory || [];
  const [copied, setCopied] = useState(false);

  const tier = TIERS.find((t) => points >= t.at)!;
  const nextTier = TIERS[TIERS.indexOf(tier) - 1] as (typeof TIERS)[number] | undefined;
  const prevAt = tier.at;
  const progress = nextTier ? ((points - prevAt) / (nextTier.at - prevAt)) * 100 : 100;

  // The two numbers the page turns on: what the balance is worth in EGP, and
  // how many EGP of bookings remain to the next tier. Both derive from the
  // 100-points = 1-EGP redemption rate and the 1-point-per-EGP earn rate.
  const egpValue = Math.floor(points / 100);
  const egpToNext = nextTier ? nextTier.at - points : 0;

  // Current effective earn rate: base × season × tier, shown as one number so
  // the guest never has to reconcile the rule cards themselves.
  const quiet = isQuietSeason();
  const rate = (quiet ? 2 : 1) * tier.multiplier;

  const hasCompletedStay = useMemo(
    () => bookings.some((b) => b.userId === currentUser.id && (b.status === 'completed' || !!b.checkedOutAt)),
    [bookings, currentUser.id],
  );

  const handleCopyReferralCode = () => {
    if (!currentUser.referralCode) return;
    tapFeedback();
    navigator.clipboard?.writeText(currentUser.referralCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleShareReferral = () => {
    if (!currentUser.referralCode) return;
    tapFeedback();
    const text = `احجز خلوتك أو مؤتمرك على بيما، واستخدم كودي ${currentUser.referralCode} عند التسجيل: https://pimastay.com`;
    if (navigator.share) navigator.share({ text }).catch(() => undefined);
    else handleCopyReferralCode();
  };

  return (
    <div className="space-y-4 text-right animate-in fade-in duration-200">

      {/* Top Header */}
      <div className="flex items-center gap-2 pb-1 border-b border-[#EDE7DA]">
        <button
          onClick={onBack}
          aria-label="رجوع"
          className="w-10 h-10 rounded-xl border border-[#EDE7DA] bg-white hover:bg-[#F1ECE0] text-[#4A4A3A] transition-colors flex items-center justify-center cursor-pointer pima-press"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-sm font-black text-[#0A2342]">المكافآت والنقاط</h2>
          <p className="text-[10px] text-[#8A8A70]">برنامج الولاء والخصومات الخاص بكنيستنا</p>
        </div>
      </div>

      {/* Main Loyalty Card — leads with what the points are WORTH. Nobody
          budgets in points; the EGP line is what makes the number real. */}
      <div className="bg-gradient-to-br from-[#0A2342] to-[#123E75] text-white p-4 rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,0.08),0_2px_6px_rgba(0,0,0,0.03)] relative overflow-hidden space-y-3">
        <div className="absolute -top-10 -left-10 w-28 h-28 bg-white/5 rounded-full blur-xl pointer-events-none" />
        <div className="absolute -bottom-10 -right-10 w-24 h-24 bg-[#C5A059]/10 rounded-full blur-lg pointer-events-none" />

        <div className="relative flex justify-between items-start">
          <div className="space-y-1">
            <span className="text-[9px] text-slate-300 font-bold block">رصيد النقاط الحالي</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[26px] leading-none font-black text-[#C5A059]">{arabicNumber(points)}</span>
              <span className="text-[10px] text-slate-200 font-semibold">نقطة</span>
            </div>
            {egpValue > 0 ? (
              <p className="text-[11px] font-black text-white">
                = خصم {arabicNumber(egpValue)} ج.م على حجزك القادم
              </p>
            ) : (
              <p className="text-[10px] font-bold text-slate-300">اكسب أول {arabicNumber(100)} نقطة لتساوي أول جنيه خصم</p>
            )}
          </div>

          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border shadow-xs ${tier.badge}`}>
            المستوى {tier.name} {tier.emoji}
          </span>
        </div>

        {/* Progress to the next tier, in EGP of bookings — the unit the guest
            can actually act on — with the multiplier as the prize. */}
        {nextTier && (
          <div className="relative space-y-1.5 pt-1">
            <p className="text-[10px] font-bold text-slate-200 leading-relaxed">
              باقي <span className="text-[#C5A059] font-black">{arabicNumber(egpToNext)} ج.م</span> من الحجوزات
              وتوصل {nextTier.name} {nextTier.emoji} — ومضاعف نقاطك يبقى ×{nextTier.multiplier}
            </p>
            <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-gradient-to-l from-[#C9A96A] to-[#C5A059] h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>
          </div>
        )}

        {/* One line answers "so what do I earn right now?" — base rate × season
            × tier collapsed into a single number instead of three rule cards
            the guest has to reconcile. */}
        <div className="relative border-t border-white/10 pt-2 flex justify-between items-center text-[9px] text-slate-300 font-bold">
          <span className="flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-[#C5A059]" />
            <span>
              معدّلك الآن: <span className="text-white font-black">{rate % 1 === 0 ? arabicNumber(rate) : rate.toLocaleString('ar-EG', { maximumFractionDigits: 2 })} نقطة لكل جنيه</span>
              {quiet && ' (موسم هدوء ×٢)'}
            </span>
          </span>
          <span>{arabicNumber(100)} نقطة = {arabicNumber(1)} ج.م</span>
        </div>
      </div>

      {/* Ways to earn — each one is a DOOR, not a poster: the review card opens
          the bookings screen, the referral card shares the code. */}
      <div className="bg-white rounded-3xl p-4 border border-[#EDE7DA] shadow-[0_8px_24px_rgba(0,0,0,0.08),0_2px_6px_rgba(0,0,0,0.03)] space-y-2.5">
        <h3 className="text-xs font-black text-[#0A2342] flex items-center gap-1.5">
          <Gift className="w-4 h-4 text-[#C5A059]" />
          <span>اكسب نقاطًا الآن</span>
        </h3>

        <div className="flex items-start gap-2 bg-[#FBF9F4] p-2.5 rounded-2xl border border-[#EDE7DA]">
          <Coins className="w-4 h-4 text-[#C5A059] shrink-0 mt-0.5" />
          <div className="space-y-0.5 text-[10px]">
            <span className="font-bold text-[#4A4A3A]">نقطة لكل جنيه تدفعه فعليًا{quiet && '، ونقطتان في موسم الهدوء الحالي'}</span>
            <p className="text-[#8A8A70] leading-relaxed">تُضاف النقاط فور تأكيد استلام العربون أو باقي المبلغ — وليس عند إنشاء الحجز.</p>
          </div>
        </div>

        {/* Review: a button when there is a finished stay behind it, otherwise
            an honest explanation of when it will unlock. */}
        {hasCompletedStay && onNavigateBookings ? (
          <button
            type="button"
            onClick={() => { tapFeedback(); onNavigateBookings(); }}
            className="w-full flex items-center gap-2 bg-[#FBF9F4] hover:bg-[#F6F0E2] p-2.5 rounded-2xl border border-[#EBD9B4] text-right transition-colors cursor-pointer pima-press"
          >
            <Star className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="flex-1 min-w-0 space-y-0.5 text-[10px]">
              <span className="font-bold text-[#4A4A3A] block">{arabicNumber(500)} نقطة عن كل تقييم — عندك إقامة منتهية بانتظار تقييمك</span>
              <span className="text-[#8A8A70] block">افتح حجوزاتك وقيّم إقامتك في دقيقة.</span>
            </span>
            <ChevronLeft className="w-4 h-4 text-[#B5AF98] shrink-0" />
          </button>
        ) : (
          <div className="flex items-start gap-2 bg-[#FBF9F4] p-2.5 rounded-2xl border border-[#EDE7DA]">
            <Star className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-0.5 text-[10px]">
              <span className="font-bold text-[#4A4A3A]">{arabicNumber(500)} نقطة عند تقييم أي بيت</span>
              <p className="text-[#8A8A70] leading-relaxed">بعد انتهاء إقامتك سيظهر هنا زر يودّيك للتقييم مباشرة.</p>
            </div>
          </div>
        )}

        {/* Referral: share is the action people actually take; copy is the
            fallback where the share sheet does not exist. */}
        {currentUser.referralCode && (
          <div className="bg-[#FBF9F4] p-2.5 rounded-2xl border border-[#EDE7DA] space-y-2">
            <div className="flex items-start gap-2 text-[10px]">
              <Users className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-bold text-[#4A4A3A]">{arabicNumber(2000)} نقطة ({arabicNumber(20)} ج.م) عن كل صديق يُتمّ أول حجز مدفوع</span>
                <p className="text-[#8A8A70] leading-relaxed">كودك يدخله صديقك عند إنشاء حسابه.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex-1 bg-white border border-[#EDE7DA] rounded-xl px-3 py-2 text-[13px] font-black text-[#0A2342] tracking-widest text-center" dir="ltr">
                {currentUser.referralCode}
              </span>
              <button
                onClick={handleCopyReferralCode}
                aria-label="نسخ الكود"
                className="shrink-0 w-10 h-10 rounded-xl bg-white border border-[#EDE7DA] hover:bg-[#F1ECE0] text-[#4A4A3A] transition-colors flex items-center justify-center cursor-pointer pima-press"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
              <button
                onClick={handleShareReferral}
                className="shrink-0 flex items-center gap-1.5 h-10 px-3.5 rounded-xl bg-gradient-to-b from-[#C9A96A] to-[#B8944E] text-white text-[10.5px] font-black shadow-[0_2px_6px_rgba(184,148,78,0.35)] cursor-pointer pima-press"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>شارك</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Points Transactions History */}
      <div className="bg-white rounded-3xl p-4 border border-[#EDE7DA] shadow-[0_8px_24px_rgba(0,0,0,0.08),0_2px_6px_rgba(0,0,0,0.03)] space-y-3">
        <h3 className="text-xs font-black text-[#0A2342] flex items-center gap-1.5">
          <History className="w-4 h-4 text-[#C5A059]" />
          <span>سجل العمليات ({arabicNumber(history.length)})</span>
        </h3>

        {history.length === 0 ? (
          <div className="text-center py-6 space-y-2">
            <span className="inline-flex w-12 h-12 rounded-full bg-[#F6F0E2] items-center justify-center">
              <CalendarCheck className="w-5 h-5 text-[#C5A059]" />
            </span>
            <p className="text-[11px] font-bold text-[#4A4A3A]">لا توجد حركات مسجلة بعد</p>
            <p className="text-[9.5px] text-[#8A8A70]">أول حجز مدفوع يبدأ رصيدك — كل جنيه بنقطة.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#EDE7DA]/60 max-h-80 overflow-y-auto pr-1">
            {history.slice().reverse().map((tx) => {
              const isEarned = tx.type === 'earned';
              return (
                <div key={tx.id} className="py-3 flex justify-between items-center gap-2 text-xs">
                  <div className="flex items-start gap-2 min-w-0">
                    <span className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center ${
                      isEarned ? 'bg-[#F6F0E2] text-[#B8944E]' : 'bg-rose-50 text-rose-600'
                    }`}>
                      {txIcon(tx)}
                    </span>
                    <div className="space-y-0.5 text-right min-w-0">
                      <span className="font-bold text-[#4A4A3A] block truncate">{tx.description}</span>
                      <span className="text-[9px] text-[#8A8A70] font-medium">{arabicDate(tx.date)}</span>
                    </div>
                  </div>

                  <div className="text-left shrink-0">
                    <span className={`font-black text-xs block ${isEarned ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {isEarned ? '+' : '−'}{arabicNumber(tx.amount)}
                    </span>
                    {/* Only meaningful sums get an EGP line — "+5 = 0 EGP" is noise. */}
                    {tx.amount >= 100 && (
                      <span className="text-[8.5px] text-[#8A8A70] font-bold block">
                        {isEarned ? '' : '−'}{arabicNumber(Math.floor(tx.amount / 100))} ج.م
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
