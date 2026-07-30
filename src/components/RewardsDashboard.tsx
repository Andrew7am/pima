import React, { useMemo, useState } from 'react';
import { User, Booking, Review, PointsTransaction } from '../types';
import {
  Gift, History, ChevronRight, ChevronLeft, Coins, Users, Star, Copy, Check,
  Wallet, Share2, Sparkles, Medal, Gem, Trophy, Stamp, MapPin, BadgeCheck, Lock,
} from 'lucide-react';
import { arabicNumber } from '../lib/arabic';
import { tapFeedback } from '../lib/haptics';

interface RewardsDashboardProps {
  currentUser: User;
  onBack: () => void;
  bookings?: Booking[];
  reviews?: Review[];
  onNavigateBookings?: () => void;
}

// Tier ladder — thresholds and multipliers are the platform's real ones
// (mirrored in ProfileScreen.tierFor); only the presentation is new. The
// conversion rate is deliberately never rendered anywhere on this page.
const TIERS = [
  { at: 0,     name: 'البرونزي', short: 'برونزي',  icon: Medal,  tint: '#B08D57', badge: 'bg-amber-100 text-amber-800 border-amber-300' },
  { at: 5000,  name: 'الفضي',    short: 'فضي',     icon: Medal,  tint: '#8E9AAB', badge: 'bg-slate-200 text-slate-800 border-slate-300' },
  { at: 15000, name: 'الذهبي',   short: 'ذهبي',    icon: Trophy, tint: '#C5A059', badge: 'bg-yellow-100 text-yellow-950 border-yellow-300' },
  { at: 40000, name: 'البلاتيني', short: 'بلاتيني', icon: Gem,    tint: '#7C86C7', badge: 'bg-indigo-100 text-indigo-900 border-indigo-300' },
] as const;

// Redemption milestones, framed as rewards ("X نقطة → خصم Y جنيه") rather than
// as an exchange rate. The discount applies automatically at booking payment —
// there is no separate redeem flow to invent.
const REWARDS = [
  { points: 2500,  label: 'خصم ٢٥ جنيه' },
  { points: 5000,  label: 'خصم ٥٠ جنيه' },
  { points: 10000, label: 'خصم ١٠٠ جنيه' },
] as const;

const PASSPORT_TARGET = 15;

function txIcon(tx: PointsTransaction) {
  if (tx.type === 'redeemed') return <Wallet className="w-3.5 h-3.5" />;
  if (/تقييم/.test(tx.description)) return <Star className="w-3.5 h-3.5" />;
  if (/دعوة|صديق|إحالة/.test(tx.description)) return <Users className="w-3.5 h-3.5" />;
  return <Coins className="w-3.5 h-3.5" />;
}

const CARD = 'bg-white rounded-3xl border border-[#EDE7DA] shadow-[0_8px_24px_rgba(0,0,0,0.08),0_2px_6px_rgba(0,0,0,0.03)]';

export default function RewardsDashboard({ currentUser, onBack, bookings = [], reviews = [], onNavigateBookings }: RewardsDashboardProps) {
  const points = currentUser.points || 0;
  const history = currentUser.pointsHistory || [];
  const [copied, setCopied] = useState(false);
  const [passportOpen, setPassportOpen] = useState(false);

  const tierIndex = TIERS.reduce((acc, t, i) => (points >= t.at ? i : acc), 0);
  const tier = TIERS[tierIndex];
  const nextTier = TIERS[tierIndex + 1] as (typeof TIERS)[number] | undefined;
  const progress = nextTier ? ((points - tier.at) / (nextTier.at - tier.at)) * 100 : 100;

  const nextReward = REWARDS.find((r) => r.points > points);

  // ── Real facts the page derives its sections from ────────────────────────
  const myBookings = useMemo(() => bookings.filter((b) => b.userId === currentUser.id), [bookings, currentUser.id]);
  const myReviews = useMemo(() => reviews.filter((r) => r.userId === currentUser.id), [reviews, currentUser.id]);
  const completedStays = useMemo(
    () => myBookings.filter((b) => b.status === 'completed' || !!b.checkedOutAt || !!b.checkedInAt),
    [myBookings],
  );
  // Passport stamps: DISTINCT houses actually stayed at — a stamp is a visit,
  // not a booking row, so three stays in one house are still one stamp.
  const stamps = useMemo(() => {
    const seen = new Map<string, string>();
    for (const b of completedStays) if (!seen.has(b.houseId)) seen.set(b.houseId, b.houseName);
    return [...seen.values()];
  }, [completedStays]);

  const invited = history.some((tx) => /دعوة|صديق|إحالة/.test(tx.description));
  const paidBookings = myBookings.filter((b) => b.depositPaid || b.paymentStatus === 'paid_deposit' || b.paymentStatus === 'paid_full');

  // Achievements — each one unlocked by a fact, with honest progress under the
  // locked ones. No achievement is granted by the client; this only displays.
  const achievements = [
    { label: 'أول حجز',        done: myBookings.length > 0,   progress: `${arabicNumber(Math.min(myBookings.length, 1))}/${arabicNumber(1)}` },
    { label: 'أول تقييم',      done: myReviews.length > 0,    progress: `${arabicNumber(Math.min(myReviews.length, 1))}/${arabicNumber(1)}` },
    { label: 'أول دعوة صديق',  done: invited,                 progress: `${arabicNumber(invited ? 1 : 0)}/${arabicNumber(1)}` },
    { label: '٥ حجوزات',       done: paidBookings.length >= 5, progress: `${arabicNumber(Math.min(paidBookings.length, 5))}/${arabicNumber(5)}` },
    { label: 'عميل مميز',      done: tierIndex >= 1,          progress: tierIndex >= 1 ? `${arabicNumber(1)}/${arabicNumber(1)}` : `${arabicNumber(points)}/${arabicNumber(5000)}` },
  ];

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

      {/* Header */}
      <div className="flex items-center gap-2 pb-1 border-b border-[#EDE7DA]">
        <button
          onClick={onBack}
          aria-label="رجوع"
          className="w-10 h-10 rounded-xl border border-[#EDE7DA] bg-white hover:bg-[#F1ECE0] text-[#4A4A3A] transition-colors flex items-center justify-center cursor-pointer pima-press"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-sm font-black text-[#0A2342]">المكافآت</h2>
          <p className="text-[10px] text-[#8A8A70]">برنامج الولاء الخاص بكنيستنا</p>
        </div>
      </div>

      {/* ── 1. Hero: balance, tier, and the journey ── */}
      <div className={`${CARD} p-4 space-y-4 relative overflow-hidden`}>
        <span aria-hidden="true" className="absolute -top-8 -left-8 w-24 h-24 bg-[#C5A059]/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex justify-between items-start gap-3">
          <div className="space-y-1">
            <span className="text-[9.5px] text-[#8A8A70] font-bold block">رصيدك الحالي</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[30px] leading-none font-black text-[#0A2342]">{arabicNumber(points)}</span>
              <span className="text-[10px] text-[#8A8A70] font-bold">نقطة</span>
            </div>
          </div>

          {/* Current tier badge, with one slow sparkle — noticeable, not busy. */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            <span className="relative w-14 h-14 rounded-2xl bg-[#FBF6EA] border border-[#EBD9B4] flex items-center justify-center">
              <tier.icon className="w-7 h-7" style={{ color: tier.tint }} />
              <Sparkles aria-hidden="true" className="absolute -top-1.5 -right-1.5 w-4 h-4 text-[#C5A059] pima-pulse-slow" />
            </span>
            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${tier.badge}`}>المستوى {tier.name}</span>
          </div>
        </div>

        {nextTier ? (
          <div className="space-y-1.5">
            <p className="text-[11.5px] font-bold text-[#4A4A3A] leading-relaxed">
              تبقى لك <span className="text-[#B8944E] font-black">{arabicNumber(nextTier.at - points)} نقطة</span> للوصول إلى المستوى {nextTier.name}
            </p>
            <div className="w-full bg-[#F1ECE0] rounded-full h-2 overflow-hidden">
              <div className="bg-gradient-to-l from-[#C9A96A] to-[#B8944E] h-full rounded-full transition-all duration-700"
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
            </div>
            <div className="flex justify-between text-[8.5px] font-bold text-[#B5AF98]">
              <span>{arabicNumber(tier.at)} نقطة</span>
              <span>{arabicNumber(nextTier.at)} نقطة</span>
            </div>
          </div>
        ) : (
          <p className="text-[11.5px] font-black text-[#B8944E]">وصلت لأعلى مستوى — أهلاً بك في البلاتيني 💎</p>
        )}

        {/* Journey: the four tiers in a row, current lit, rest waiting. */}
        <div className="grid grid-cols-4 gap-1 pt-1">
          {TIERS.map((t, i) => {
            const reached = i <= tierIndex;
            const isCurrent = i === tierIndex;
            return (
              <div key={t.name} className="flex flex-col items-center gap-1">
                <span className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                  isCurrent ? 'border-[#C5A059] bg-[#FBF6EA]' : reached ? 'border-[#EBD9B4] bg-[#FBF6EA]' : 'border-[#EDE7DA] bg-[#FBF9F4]'
                }`}>
                  <t.icon className="w-5 h-5" style={{ color: reached ? t.tint : '#D2C9B8' }} />
                </span>
                <span className={`text-[8.5px] font-black ${isCurrent ? 'text-[#B8944E]' : reached ? 'text-[#4A4A3A]' : 'text-[#B5AF98]'}`}>
                  {t.short}{isCurrent && ' — الحالي'}
                </span>
                <span className="text-[7.5px] font-bold text-[#B5AF98]">{i === 0 ? '' : `${arabicNumber(t.at)} نقطة`}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 2. Next reward ── */}
      <div className={`${CARD} p-4 flex items-center gap-3`}>
        <span className="w-14 h-14 rounded-2xl bg-gradient-to-b from-[#FBF6EA] to-[#F6EBD4] border border-[#EBD9B4] flex items-center justify-center shrink-0">
          <Gift className="w-7 h-7 text-[#B8944E] pima-pulse-slow" />
        </span>
        <div className="flex-1 min-w-0 space-y-1.5">
          <span className="text-[11px] font-black text-[#0A2342] block">المكافأة القادمة</span>
          {nextReward ? (
            <>
              <p className="text-[11px] font-bold text-[#4A4A3A] leading-snug">
                تبقى لك <span className="text-[#B8944E] font-black">{arabicNumber(nextReward.points - points)} نقطة</span> للحصول على {nextReward.label}
              </p>
              <div className="w-full bg-[#F1ECE0] rounded-full h-1.5 overflow-hidden">
                <div className="bg-gradient-to-l from-[#C9A96A] to-[#B8944E] h-full rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(100, (points / nextReward.points) * 100)}%` }} />
              </div>
              <span className="text-[8.5px] font-bold text-[#B5AF98] block">{arabicNumber(points)} / {arabicNumber(nextReward.points)} نقطة</span>
            </>
          ) : (
            <p className="text-[11px] font-bold text-[#4A4A3A]">رصيدك يغطي أكبر خصم متاح — {REWARDS[REWARDS.length - 1].label} يُطبق تلقائيًا عند حجزك القادم.</p>
          )}
        </div>
      </div>

      {/* ── 3. Pima Passport ── */}
      <div className={`${CARD} p-4 space-y-3`}>
        <div className="flex items-center gap-3">
          <span className="w-14 h-14 rounded-2xl bg-[#0A2342] flex items-center justify-center shrink-0 shadow-[0_4px_12px_rgba(10,35,66,0.35)]">
            <Stamp className="w-6 h-6 text-[#C5A059]" />
          </span>
          <div className="flex-1 min-w-0">
            <span className="text-[12px] font-black text-[#0A2342] block">جواز بيما</span>
            <span className="text-[10px] font-bold text-[#8A8A70] block">اكتشف أماكن جديدة واجمع الأختام</span>
          </div>
          <button
            type="button"
            onClick={() => { tapFeedback(); setPassportOpen((v) => !v); }}
            aria-expanded={passportOpen}
            className="shrink-0 rounded-full border border-[#C9A96A] text-[#B8944E] px-3.5 h-9 text-[10.5px] font-black hover:bg-[#FBF6EA] transition-colors cursor-pointer pima-press"
          >
            عرض الجواز
          </button>
        </div>

        <div className="flex items-center gap-3 text-center">
          <div className="flex-1">
            <span className="text-[15px] font-black text-[#0A2342] block">{arabicNumber(stamps.length)} / {arabicNumber(PASSPORT_TARGET)}</span>
            <span className="text-[8.5px] font-bold text-[#8A8A70]">أختام جمعتها</span>
          </div>
          <span aria-hidden="true" className="w-px h-8 bg-[#EDE7DA]" />
          <div className="flex-1">
            <span className="text-[15px] font-black text-[#0A2342] block">{arabicNumber(stamps.length)}</span>
            <span className="text-[8.5px] font-bold text-[#8A8A70]">أماكن اكتشفتها</span>
          </div>
        </div>

        <div className="w-full bg-[#F1ECE0] rounded-full h-1.5 overflow-hidden">
          <div className="bg-gradient-to-l from-[#C9A96A] to-[#B8944E] h-full rounded-full transition-all duration-700"
            style={{ width: `${Math.min(100, (stamps.length / PASSPORT_TARGET) * 100)}%` }} />
        </div>
        <p className="text-[9.5px] font-bold text-[#8A8A70] text-center">
          اجمع {arabicNumber(PASSPORT_TARGET)} ختمًا واستلم مكافأة خاصة من فريق بيما 🎁
        </p>

        {passportOpen && (
          <div className="pt-1 space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
            {stamps.length === 0 ? (
              <p className="text-[10px] font-bold text-[#8A8A70] text-center py-2">أول إقامة تكتمل تدق أول ختم في جوازك.</p>
            ) : stamps.map((name) => (
              <div key={name} className="flex items-center gap-2 bg-[#FBF9F4] border border-[#EDE7DA] rounded-xl px-3 py-2">
                <MapPin className="w-3.5 h-3.5 text-[#B8944E] shrink-0" />
                <span className="text-[10.5px] font-bold text-[#4A4A3A] truncate">{name}</span>
                <BadgeCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0 mr-auto" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 4. Rewards you can reach ── */}
      <div className="space-y-2">
        <h3 className="text-[11px] font-black text-[#8A8A70] px-1">استبدل نقاطك</h3>
        <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {REWARDS.map((r) => {
            const unlocked = points >= r.points;
            return (
              <div key={r.points} className={`${CARD} shrink-0 w-[136px] p-3 flex flex-col items-center gap-1.5 text-center ${unlocked ? '' : 'opacity-80'}`}>
                <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${unlocked ? 'bg-gradient-to-b from-[#FBF6EA] to-[#F6EBD4] border border-[#EBD9B4]' : 'bg-[#FBF9F4] border border-[#EDE7DA]'}`}>
                  <Wallet className={`w-5 h-5 ${unlocked ? 'text-[#B8944E]' : 'text-[#D2C9B8]'}`} />
                </span>
                <span className="text-[11.5px] font-black text-[#0A2342]">{r.label}</span>
                <span className="text-[9px] font-bold text-[#8A8A70]">{arabicNumber(r.points)} نقطة</span>
                {unlocked ? (
                  <span className="text-[8.5px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">يُطبق تلقائيًا عند الحجز</span>
                ) : (
                  <span className="text-[8.5px] font-bold text-[#B5AF98]">تبقى {arabicNumber(r.points - points)} نقطة</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 5. Achievements ── */}
      <div className="space-y-2">
        <h3 className="text-[11px] font-black text-[#8A8A70] px-1">إنجازاتك</h3>
        <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {achievements.map((a) => (
            <div key={a.label} className={`${CARD} shrink-0 w-[104px] p-3 flex flex-col items-center gap-1.5 text-center`}>
              <span className={`w-11 h-11 rounded-full flex items-center justify-center border-2 ${
                a.done ? 'bg-gradient-to-b from-[#FBF6EA] to-[#F6EBD4] border-[#C9A96A]' : 'bg-[#FBF9F4] border-[#EDE7DA]'
              }`}>
                {a.done ? <Trophy className="w-5 h-5 text-[#B8944E]" /> : <Lock className="w-4 h-4 text-[#C9C2B0]" />}
              </span>
              <span className={`text-[9.5px] font-black leading-tight ${a.done ? 'text-[#0A2342]' : 'text-[#8A8A70]'}`}>{a.label}</span>
              <span className={`text-[8.5px] font-bold ${a.done ? 'text-emerald-700' : 'text-[#B5AF98]'}`}>
                {a.done ? 'تم الإنجاز' : a.progress}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── 6. Ways to earn — each card is an action, not a poster ── */}
      <div className={`${CARD} p-4 space-y-2.5`}>
        <h3 className="text-xs font-black text-[#0A2342] flex items-center gap-1.5">
          <Gift className="w-4 h-4 text-[#C5A059]" />
          <span>اكسب نقاطًا الآن</span>
        </h3>

        <div className="flex items-start gap-2 bg-[#FBF9F4] p-2.5 rounded-2xl border border-[#EDE7DA]">
          <Coins className="w-4 h-4 text-[#C5A059] shrink-0 mt-0.5" />
          <div className="space-y-0.5 text-[10px]">
            <span className="font-bold text-[#4A4A3A]">إتمام حجز مدفوع</span>
            <p className="text-[#8A8A70] leading-relaxed">تُضاف نقاطك فور تأكيد استلام العربون أو باقي المبلغ — وتتضاعف في مواسم الهدوء ومع ارتفاع مستواك.</p>
          </div>
        </div>

        {completedStays.length > myReviews.length && onNavigateBookings ? (
          <button
            type="button"
            onClick={() => { tapFeedback(); onNavigateBookings(); }}
            className="w-full flex items-center gap-2 bg-[#FBF9F4] hover:bg-[#F6F0E2] p-2.5 rounded-2xl border border-[#EBD9B4] text-right transition-colors cursor-pointer pima-press"
          >
            <Star className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="flex-1 min-w-0 space-y-0.5 text-[10px]">
              <span className="font-bold text-[#4A4A3A] block">+{arabicNumber(500)} نقطة — عندك إقامة بانتظار تقييمك</span>
              <span className="text-[#8A8A70] block">افتح حجوزاتك وقيّمها في دقيقة.</span>
            </span>
            <ChevronLeft className="w-4 h-4 text-[#B5AF98] shrink-0" />
          </button>
        ) : (
          <div className="flex items-start gap-2 bg-[#FBF9F4] p-2.5 rounded-2xl border border-[#EDE7DA]">
            <Star className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-0.5 text-[10px]">
              <span className="font-bold text-[#4A4A3A]">+{arabicNumber(500)} نقطة عند تقييم أي بيت</span>
              <p className="text-[#8A8A70] leading-relaxed">بعد انتهاء إقامتك سيظهر هنا زر يودّيك للتقييم مباشرة.</p>
            </div>
          </div>
        )}

        {currentUser.referralCode && (
          <div className="bg-[#FBF9F4] p-2.5 rounded-2xl border border-[#EDE7DA] space-y-2">
            <div className="flex items-start gap-2 text-[10px]">
              <Users className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-bold text-[#4A4A3A]">+{arabicNumber(2000)} نقطة عن كل صديق يُتمّ أول حجز مدفوع</span>
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

      {/* ── 7. Recent activity ── */}
      <div className={`${CARD} p-4 space-y-3`}>
        <h3 className="text-xs font-black text-[#0A2342] flex items-center gap-1.5">
          <History className="w-4 h-4 text-[#C5A059]" />
          <span>آخر النشاط ({arabicNumber(history.length)})</span>
        </h3>

        {history.length === 0 ? (
          <div className="text-center py-6 space-y-2">
            <span className="inline-flex w-12 h-12 rounded-full bg-[#F6F0E2] items-center justify-center">
              <Coins className="w-5 h-5 text-[#C5A059]" />
            </span>
            <p className="text-[11px] font-bold text-[#4A4A3A]">لا توجد حركات مسجلة بعد</p>
            <p className="text-[9.5px] text-[#8A8A70]">أول حجز مدفوع يبدأ رصيدك.</p>
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
                      <span className="text-[9px] text-[#8A8A70] font-medium">
                        {new Date(tx.date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                  <span className={`font-black text-xs shrink-0 ${isEarned ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {isEarned ? '+' : '−'}{arabicNumber(tx.amount)}
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
