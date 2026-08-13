import React, { useMemo, useRef, useState } from 'react';
import { User, Booking, Review, PointsTransaction } from '../types';
import {
  Gift, History, ChevronRight, ChevronLeft, Coins, Users, Star, Wallet,
  Sparkles, Trophy, Church, PlayCircle, BarChart3, Check,
} from 'lucide-react';
import { arabicNumber } from '../lib/arabic';
import { tapFeedback } from '../lib/haptics';
import { useCountUp, useGrowOnMount } from '../lib/useCountUp';
import { claimDailyAdPoints } from '../lib/db';
import AdGateModal from '../entertainment/AdGateModal';
import PassportScreen, { PassportStamp } from './PassportScreen';
import {
  TierMedal, GiftBox, CoinStack, PassportBook, Rosette,
  DeedHouse, DeedStar, DeedFriends, DeedPlay,
} from './rewards/RewardIcons';
import { RetreatHouse } from '../types';

interface RewardsDashboardProps {
  currentUser: User;
  onBack: () => void;
  bookings?: Booking[];
  reviews?: Review[];
  /** Coordinates + governorates for the passport's discovery panel. */
  houses?: RetreatHouse[];
  onNavigateBookings?: () => void;
}

// Tier ladder per the approved design: فضي ٥٬٠٠٠ / ذهبي ١٠٬٠٠٠ / ماسي ٢٠٬٠٠٠+.
// Safe to change freely — the server's earn triggers (005) know nothing about
// tiers; the only real multiplier is the seasonal ×2. Mirrored in
// ProfileScreen.tierFor.
const TIERS = [
  { at: 0,     name: 'البرونزي', short: 'برونزي', metal: 'bronze'  },
  { at: 5000,  name: 'الفضي',    short: 'فضي',    metal: 'silver'  },
  { at: 10000, name: 'الذهبي',   short: 'ذهبي',   metal: 'gold'    },
  { at: 20000, name: 'الماسي',   short: 'ماسي',   metal: 'diamond' },
] as const;

// Redemption milestones, shown as rewards — the rate itself is never rendered.
const REWARDS = [
  { points: 2500,  label: 'خصم ٢٥ جنيه' },
  { points: 5000,  label: 'خصم ٥٠ جنيه' },
  { points: 10000, label: 'خصم ١٠٠ جنيه' },
] as const;

const PASSPORT_TARGET = 15;
const CARD = 'bg-[var(--ds-surface)] rounded-3xl border border-[var(--ds-border)] shadow-[0_8px_24px_rgba(0,0,0,0.08),0_2px_6px_rgba(0,0,0,0.03)]';

function txIcon(tx: PointsTransaction) {
  if (tx.type === 'redeemed') return <Wallet className="w-3.5 h-3.5" />;
  if (/إعلان/.test(tx.description)) return <PlayCircle className="w-3.5 h-3.5" />;
  if (/تقييم/.test(tx.description)) return <Star className="w-3.5 h-3.5" />;
  if (/دعوة|صديق|إحالة/.test(tx.description)) return <Users className="w-3.5 h-3.5" />;
  return <Coins className="w-3.5 h-3.5" />;
}

const isToday = (iso: string) => {
  const d = new Date(iso); const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
};

export default function RewardsDashboard({ currentUser, onBack, bookings = [], reviews = [], houses = [], onNavigateBookings }: RewardsDashboardProps) {
  const history = currentUser.pointsHistory || [];
  // Optimistic +25 after a successful ad claim — the server wrote it; the prop
  // simply has not refetched yet. Reload converges on the real value.
  const [adBonus, setAdBonus] = useState(0);
  const [adOpen, setAdOpen] = useState(false);
  const [adClaimedNow, setAdClaimedNow] = useState(false);
  const [showPassport, setShowPassport] = useState(false);
  const [showAllActivity, setShowAllActivity] = useState(false);
  const activityRef = useRef<HTMLDivElement>(null);

  const points = (currentUser.points || 0) + adBonus;
  const adClaimedToday = adClaimedNow || history.some((tx) => tx.id.startsWith('pt_ad_') && isToday(tx.date));

  const tierIndex = TIERS.reduce((acc, t, i) => (points >= t.at ? i : acc), 0);
  const tier = TIERS[tierIndex];
  const nextTier = TIERS[tierIndex + 1] as (typeof TIERS)[number] | undefined;
  const tierProgress = nextTier ? ((points - tier.at) / (nextTier.at - tier.at)) * 100 : 100;

  const nextReward = REWARDS.find((r) => r.points > points);
  const rewardPct = nextReward ? Math.min(100, Math.round((points / nextReward.points) * 100)) : 100;

  const myBookings = useMemo(() => bookings.filter((b) => b.userId === currentUser.id), [bookings, currentUser.id]);
  const myReviews = useMemo(() => reviews.filter((r) => r.userId === currentUser.id), [reviews, currentUser.id]);
  const completedStays = useMemo(
    () => myBookings.filter((b) => b.status === 'completed' || !!b.checkedOutAt || !!b.checkedInAt),
    [myBookings],
  );
  // A stamp is a distinct house actually stayed at — not a booking row. The
  // date on the stamp is the FIRST stay, which is when it was earned.
  const stamps = useMemo<PassportStamp[]>(() => {
    const seen = new Map<string, PassportStamp>();
    const ordered = [...completedStays].sort((a, b) =>
      new Date(a.checkedInAt ?? a.checkIn).getTime() - new Date(b.checkedInAt ?? b.checkIn).getTime());
    for (const b of ordered) {
      if (!seen.has(b.houseId)) seen.set(b.houseId, { houseId: b.houseId, houseName: b.houseName, date: b.checkedInAt ?? b.checkIn });
    }
    return [...seen.values()];
  }, [completedStays]);

  const invited = history.some((tx) => /دعوة|صديق|إحالة/.test(tx.description));
  const paidBookings = myBookings.filter((b) => b.depositPaid || b.paymentStatus === 'paid_deposit' || b.paymentStatus === 'paid_full');

  const achievements = [
    { label: 'أول حجز',       done: myBookings.length > 0,    progress: `${arabicNumber(Math.min(myBookings.length, 1))}/${arabicNumber(1)}` },
    { label: 'أول تقييم',     done: myReviews.length > 0,     progress: `${arabicNumber(Math.min(myReviews.length, 1))}/${arabicNumber(1)}` },
    { label: 'أول دعوة صديق', done: invited,                  progress: `${arabicNumber(invited ? 1 : 0)}/${arabicNumber(1)}` },
    { label: '٥ حجوزات',      done: paidBookings.length >= 5, progress: `${arabicNumber(Math.min(paidBookings.length, 5))}/${arabicNumber(5)}` },
    { label: 'عميل مميز',     done: tierIndex >= 1,           progress: tierIndex >= 1 ? `${arabicNumber(1)}/${arabicNumber(1)}` : `${arabicNumber(Math.min(points, 5000))}/${arabicNumber(5000)}` },
  ];

  const handleShareReferral = () => {
    if (!currentUser.referralCode) return;
    tapFeedback();
    const text = `احجز خلوتك أو مؤتمرك على بيما، واستخدم كودي ${currentUser.referralCode} عند التسجيل: https://pimastay.com`;
    if (navigator.share) navigator.share({ text }).catch(() => undefined);
    else navigator.clipboard?.writeText(text);
  };

  const handleAdReward = async () => {
    setAdOpen(false);
    const granted = await claimDailyAdPoints();
    if (granted) { setAdBonus((b) => b + 25); setAdClaimedNow(true); }
    else setAdClaimedNow(true); // already claimed today — reflect the truth
  };

  const shownActivity = showAllActivity ? history.slice().reverse() : history.slice().reverse().slice(0, 3);

  // Motion values. Every one of these degrades to its true value instantly
  // under prefers-reduced-motion — see useCountUp's fail-visible note.
  const shownPoints = useCountUp(points, 1100);
  const tierBarWidth = useGrowOnMount(tierProgress, 120);
  const rewardBarWidth = useGrowOnMount(rewardPct, 220);
  const stampBarWidth = useGrowOnMount((stamps.length / PASSPORT_TARGET) * 100, 300);
  const RING_C = 100.5; // 2πr for r=16, the ring's circumference

  // The passport is its own page, reached from «افتح الجواز» — not an expander.
  if (showPassport) {
    return (
      <PassportScreen
        stamps={stamps}
        target={PASSPORT_TARGET}
        tierName={tier.name}
        completedBookings={completedStays.length}
        houses={houses}
        onBack={() => setShowPassport(false)}
      />
    );
  }

  return (
    <div className="space-y-4 text-right animate-in fade-in duration-200">

      {/* Header */}
      <div className="flex items-center gap-2 pb-1 border-b border-[var(--ds-border)]">
        <button onClick={onBack} aria-label="رجوع"
          className="w-10 h-10 rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface)] hover:bg-[#F1ECE0] text-[var(--ds-text)] transition-colors flex items-center justify-center cursor-pointer pima-press">
          <ChevronRight className="w-4 h-4" />
        </button>
        <h2 className="text-sm font-black text-[var(--ds-brand)]">المكافآت</h2>
      </div>

      {/* ── Hero: tier right, balance left, gap line, bar, journey ── */}
      <div className={`${CARD} p-4 space-y-4 relative overflow-hidden pima-rise`}>
        {/* Warm light pooling behind the badge — depth without a gradient wash. */}
        <span aria-hidden="true" className="absolute -top-14 right-2 w-40 h-40 rounded-full bg-[var(--ds-accent)]/[0.09] blur-2xl pointer-events-none" />
        <Sparkles aria-hidden="true" className="absolute top-4 left-14 w-3 h-3 text-[var(--ds-accent-soft)] pima-twinkle" />
        <Sparkles aria-hidden="true" className="absolute top-16 left-6 w-2.5 h-2.5 text-[var(--ds-accent-soft)] pima-twinkle" style={{ animationDelay: '1.3s' }} />

        <div className="relative flex justify-between items-start gap-3">
          <div className="flex flex-col items-center gap-1.5 shrink-0">
            <span className="relative w-16 h-16 rounded-full flex items-center justify-center pima-halo">
              <TierMedal metal={tier.metal} size={62} />
            </span>
            <div className="text-center leading-tight">
              <span className="text-[8.5px] font-bold text-[var(--ds-text-2)] block">مستواك الحالي</span>
              <span className="text-[13px] font-black text-[var(--ds-accent-deep)]">{tier.name}</span>
            </div>
          </div>

          <div className="text-left space-y-1.5">
            <span className="text-[9.5px] text-[var(--ds-text-2)] font-bold block text-left">رصيدك الحالي</span>
            {/* tabular-nums keeps the digits from jittering while they count. */}
            <div className="flex items-baseline gap-1.5 justify-end" dir="ltr">
              <span className="text-[32px] leading-none font-black text-[var(--ds-brand)] [font-variant-numeric:tabular-nums]">
                {arabicNumber(shownPoints)}
              </span>
            </div>
            <span className="text-[10px] text-[var(--ds-text-2)] font-bold block text-left">نقطة</span>
            <button
              type="button"
              onClick={() => { tapFeedback(); activityRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--ds-border)] bg-[var(--ds-surface)] px-3 h-8 text-[9.5px] font-black text-[var(--ds-text)] hover:bg-[#F1ECE0] hover:border-[var(--ds-accent-soft)] transition-colors cursor-pointer pima-press"
            >
              <BarChart3 className="w-3 h-3 text-[var(--ds-accent-deep)]" />
              سجل النقاط
            </button>
          </div>
        </div>

        {nextTier ? (
          <>
            <p className="text-[12px] font-bold text-[var(--ds-text)] text-center leading-relaxed">
              تبقى لك <span className="text-[var(--ds-accent-deep)] font-black">{arabicNumber(nextTier.at - points)} نقطة</span>
              <br />للوصول إلى المستوى {nextTier.name}
            </p>
            <div className="space-y-1">
              <div className="w-full bg-[#F1ECE0] rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-l from-[#C9A96A] to-[var(--ds-accent-deep)] h-full rounded-full pima-foil"
                  style={{ width: `${tierBarWidth}%`, transition: 'width 1100ms var(--motion-ease)' }}
                />
              </div>
              <div className="flex justify-between text-[8.5px] font-bold text-[var(--ds-text-faint)]">
                <span>{arabicNumber(nextTier.at)} نقطة</span>
                <span>{arabicNumber(tier.at)} نقطة</span>
              </div>
            </div>
          </>
        ) : (
          <p className="text-[12px] font-black text-[#5B7BD5] text-center">وصلت للماسي — أعلى مستوى في بيما 💎</p>
        )}

        {/* Journey — the connector is dotted ahead of you and solid gold behind,
            so the row reads as a path already walked, not four equal icons. */}
        <div className="relative grid grid-cols-4 gap-1 pt-1">
          <span aria-hidden="true" className="absolute top-6 inset-x-10 border-t-2 border-dotted border-[#E3DCCB]" />
          <span
            aria-hidden="true"
            className="absolute top-6 right-10 border-t-2 border-[#C9A96A]"
            style={{
              // Each step spans 1/3 of the track between first and last badge.
              width: `calc((100% - 5rem) * ${tierIndex / (TIERS.length - 1)})`,
              transition: 'width 1200ms var(--motion-ease)',
            }}
          />
          {TIERS.map((t, i) => {
            const reached = i <= tierIndex;
            const isCurrent = i === tierIndex;
            return (
              <div key={t.name} className="relative flex flex-col items-center gap-1">
                <span
                  className={`w-12 h-12 rounded-full flex items-center justify-center border-2 bg-[var(--ds-surface)] transition-colors pima-medal-in ${
                    isCurrent ? 'border-[var(--ds-accent)] shadow-[0_0_0_4px_rgba(197,160,89,0.15)] pima-halo' : reached ? 'border-[var(--ds-accent-soft)]' : 'border-[var(--ds-border)]'
                  }`}
                  style={{ animationDelay: `${140 + i * 90}ms` }}
                >
                  {/* Ahead of you the medal is there but drained of colour —
                      the shape is a promise, the metal is the reward. */}
                  <TierMedal metal={t.metal} size={42} className={reached ? '' : 'opacity-40 saturate-0'} />
                </span>
                <span className={`text-[9px] font-black ${isCurrent ? 'text-[var(--ds-accent-deep)]' : 'text-[var(--ds-text)]'}`}>{t.short}</span>
                <span className="text-[8px] font-bold text-[var(--ds-text-faint)] leading-none">
                  {isCurrent ? 'الحالي' : i === TIERS.length - 1 ? `${arabicNumber(t.at)}+ نقطة` : i === 0 ? '' : `${arabicNumber(t.at)} نقطة`}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Passport (right) + next reward (left) ── */}
      <div className="grid grid-cols-2 gap-3 pima-rise pima-rise-1">
        {/* Pima Passport — navy card */}
        <div className="rounded-3xl bg-gradient-to-b from-[#132A52] to-[var(--ds-brand)] text-white p-3.5 space-y-2.5 shadow-[0_8px_24px_rgba(10,35,66,0.35)]">
          <div className="flex items-center gap-1.5">
            <PassportBook size={22} className="shrink-0" />
            <span className="text-[12.5px] font-black">جواز بيما</span>
          </div>
          <p className="text-[8.5px] font-bold text-slate-300 leading-relaxed">اكتشف أماكن جديدة واجمع الأختام</p>

          <div>
            <span className="text-[17px] font-black block" dir="ltr">{arabicNumber(stamps.length)} / {arabicNumber(PASSPORT_TARGET)}</span>
            <span className="text-[8.5px] font-bold text-slate-300">أختام جمعتها</span>
          </div>

          <div className="w-full bg-[var(--ds-surface)]/15 rounded-full h-1.5 overflow-hidden">
            <div className="bg-gradient-to-l from-[#C9A96A] to-[var(--ds-accent)] h-full rounded-full pima-foil"
              style={{ width: `${stampBarWidth}%`, transition: 'width 1100ms var(--motion-ease)' }} />
          </div>

          {/* Five stamp slots — filled ones carry the church mark. */}
          <div className="flex items-center justify-between gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <span key={i} className={`w-8 h-8 rounded-full flex items-center justify-center border ${
                i < Math.min(stamps.length, 5) ? 'border-[var(--ds-accent)] bg-[color-mix(in_srgb,var(--ds-accent)_15%,transparent)]' : 'border-dashed border-white/30'
              }`}>
                {i < Math.min(stamps.length, 5) && <Church className="w-3.5 h-3.5 text-[var(--ds-accent-soft)]" />}
              </span>
            ))}
          </div>

          <button
            type="button"
            onClick={() => { tapFeedback(); setShowPassport(true); }}
            className="w-full flex items-center justify-center gap-1 bg-gradient-to-b from-[#C9A96A] to-[var(--ds-accent-deep)] text-white rounded-xl h-9 text-[10.5px] font-black shadow-[0_2px_8px_rgba(0,0,0,0.25)] cursor-pointer pima-press"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            افتح الجواز
          </button>
          <p className="text-[8px] font-bold text-slate-300 text-center">اجمع {arabicNumber(PASSPORT_TARGET)} ختم لتحصل على مكافأة خاصة 🎁</p>
        </div>

        {/* Next reward — gift + ring */}
        <div className={`${CARD} p-3.5 flex flex-col items-center text-center gap-2`}>
          <div className="flex items-center gap-1.5 self-end">
            <Gift className="w-4 h-4 text-[var(--ds-accent-deep)]" />
            <span className="text-[12.5px] font-black text-[var(--ds-brand)]">المكافأة القادمة</span>
          </div>

          <GiftBox size={58} />

          {nextReward ? (
            <>
              <p className="text-[10px] font-bold text-[var(--ds-text)] leading-relaxed">
                تبقى لك <span className="text-[var(--ds-accent-deep)] font-black">{arabicNumber(nextReward.points - points)} نقطة</span>
                <br />للحصول على {nextReward.label}
              </p>
              <div className="w-full bg-[#F1ECE0] rounded-full h-1.5 overflow-hidden">
                <div className="bg-gradient-to-l from-[#C9A96A] to-[var(--ds-accent-deep)] h-full rounded-full pima-foil"
                  style={{ width: `${rewardBarWidth}%`, transition: 'width 1100ms var(--motion-ease)' }} />
              </div>
              <span className="text-[8px] font-bold text-[var(--ds-text-faint)]" dir="ltr">{arabicNumber(points)} / {arabicNumber(nextReward.points)} نقطة</span>

              {/* Percent ring — the arc draws itself by transitioning the dash
                  offset, so it sweeps round rather than appearing complete. */}
              <span className="relative w-14 h-14">
                <svg viewBox="0 0 40 40" className="w-14 h-14 -rotate-90">
                  <circle cx="20" cy="20" r="16" fill="none" stroke="#F1ECE0" strokeWidth="4" />
                  <circle
                    cx="20" cy="20" r="16" fill="none" stroke="#C5A059" strokeWidth="4" strokeLinecap="round"
                    strokeDasharray={RING_C}
                    strokeDashoffset={RING_C - (rewardBarWidth / 100) * RING_C}
                    style={{ transition: 'stroke-dashoffset 1200ms var(--motion-ease)' }}
                  />
                </svg>
                <span className="absolute inset-0 flex flex-col items-center justify-center leading-none">
                  <span className="text-[11px] font-black text-[var(--ds-accent-deep)] [font-variant-numeric:tabular-nums]">٪{arabicNumber(Math.round(rewardBarWidth))}</span>
                </span>
              </span>
              {rewardPct >= 50 && (
                <span className="text-[9px] font-black text-[var(--ds-accent-deep)] inline-flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5 pima-twinkle" />
                  اقتربت!
                </span>
              )}
            </>
          ) : (
            <p className="text-[10px] font-bold text-[var(--ds-text)] leading-relaxed">
              رصيدك يغطي أكبر خصم — {REWARDS[REWARDS.length - 1].label}
              <br /><span className="text-emerald-700 font-black">يُطبق تلقائيًا عند حجزك القادم</span>
            </p>
          )}
        </div>
      </div>

      {/* ── Ways to earn ── */}
      <div className="space-y-2 overflow-x-clip pima-rise pima-rise-2">
        <h3 className="text-[11.5px] font-black text-[var(--ds-brand)] px-1 flex items-center gap-1.5">
          <CoinStack size={18} />
          طرق جمع النقاط
        </h3>
        <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {[
            { Art: DeedHouse,   label: 'احجز إقامة', pts: 'نقطة لكل جنيه', onClick: undefined as (() => void) | undefined },
            { Art: DeedStar,    label: 'قيّم المكان', pts: `+${arabicNumber(500)} نقطة`, onClick: onNavigateBookings },
            { Art: DeedFriends, label: 'ادعُ صديقًا', pts: `+${arabicNumber(2000)} نقطة`, onClick: currentUser.referralCode ? handleShareReferral : undefined },
            { Art: DeedPlay,    label: 'شاهد إعلان', pts: `+${arabicNumber(25)} نقطة`, badge: 'جديد', onClick: adClaimedToday ? undefined : () => { tapFeedback(); setAdOpen(true); } },
          ].map((c) => (
            <button
              key={c.label}
              type="button"
              disabled={!c.onClick}
              onClick={c.onClick}
              className={`${CARD} relative shrink-0 w-[104px] p-3 flex flex-col items-center gap-1.5 text-center transition-[transform,border-color,box-shadow] duration-[250ms] ease-[cubic-bezier(0.33,1,0.68,1)] ${
                c.onClick ? 'cursor-pointer pima-press hover:-translate-y-1 hover:border-[var(--ds-accent-soft)] hover:shadow-[0_12px_28px_rgba(184,148,78,0.18)]' : 'cursor-default opacity-90'
              }`}
            >
              {'badge' in c && c.badge && (
                <span className="absolute -top-1.5 left-2 text-[7.5px] font-black text-white bg-rose-500 rounded-full px-1.5 py-0.5">{c.badge}</span>
              )}
              <span className="w-11 h-11 rounded-xl bg-[#FBF9F4] border border-[var(--ds-border)] flex items-center justify-center">
                <c.Art size={30} />
              </span>
              <span className="text-[9.5px] font-black text-[var(--ds-brand)] leading-tight">{c.label}</span>
              <span className="text-[8.5px] font-black text-[var(--ds-accent-deep)]">{c.pts}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Achievements + daily ad, side by side like the mock ── */}
      <div className="grid grid-cols-5 gap-3 pima-rise pima-rise-3">
        <div className={`${CARD} col-span-3 p-3 space-y-2`}>
          <h3 className="text-[11px] font-black text-[var(--ds-brand)] flex items-center gap-1">
            <Trophy className="w-3.5 h-3.5 text-[var(--ds-accent)]" />
            إنجازاتك
          </h3>
          <div className="grid grid-cols-3 gap-1.5">
            {achievements.slice(0, 5).map((a, i) => (
              <div key={a.label} className="flex flex-col items-center gap-1 text-center">
                {/* Earned badges land like medals, in sequence; locked ones just
                    sit there — the contrast is what makes the row motivating. */}
                <span
                  className={`flex items-center justify-center ${a.done ? 'pima-medal-in' : ''}`}
                  style={a.done ? { animationDelay: `${260 + i * 80}ms` } : undefined}
                >
                  <Rosette size={38} locked={!a.done} />
                </span>
                <span className={`text-[8px] font-black leading-tight ${a.done ? 'text-[var(--ds-brand)]' : 'text-[var(--ds-text-2)]'}`}>{a.label}</span>
                <span className={`text-[7.5px] font-bold ${a.done ? 'text-emerald-700' : 'text-[var(--ds-text-faint)]'}`}>{a.done ? '✓ تم الإنجاز' : a.progress}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Daily ad card — the +25 is granted by the server, once a day. */}
        <div className="col-span-2 rounded-3xl bg-gradient-to-b from-[#6D5BAE] to-[#584397] text-white p-3 flex flex-col items-center text-center gap-1.5 shadow-[0_8px_24px_rgba(88,67,151,0.35)]">
          <span className="text-[11px] font-black">شاهد إعلان اليوم</span>
          <span className="text-[8.5px] font-bold text-white/80 leading-relaxed">احصل على نقاط إضافية — يتجدد الإعلان يوميًا</span>
          <span className="text-[20px] font-black text-[#F3E4BE] leading-none">+{arabicNumber(25)}</span>
          <span className="text-[8px] font-bold text-white/80">نقطة</span>
          {adClaimedToday ? (
            <span className="mt-1 inline-flex items-center gap-1 text-[9px] font-black text-emerald-200">
              <Check className="w-3 h-3" /> تم المشاهدة اليوم
            </span>
          ) : (
            <button
              type="button"
              onClick={() => { tapFeedback(); setAdOpen(true); }}
              className="mt-1 w-full flex items-center justify-center gap-1 bg-[var(--ds-surface)]/15 hover:bg-[var(--ds-surface)]/25 border border-white/25 rounded-xl h-9 text-[10px] font-black transition-colors cursor-pointer pima-press"
            >
              <PlayCircle className="w-3.5 h-3.5" />
              شاهد الآن
            </button>
          )}
        </div>
      </div>

      {/* ── Recent activity ── */}
      <div ref={activityRef} className={`${CARD} p-4 space-y-3 scroll-mt-4`}>
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black text-[var(--ds-brand)] flex items-center gap-1.5">
            <History className="w-4 h-4 text-[var(--ds-accent)]" />
            آخر النشاط
          </h3>
          {history.length > 3 && (
            <button
              type="button"
              onClick={() => { tapFeedback(); setShowAllActivity((v) => !v); }}
              className="text-[9.5px] font-black text-[var(--ds-accent-deep)] hover:underline cursor-pointer"
            >
              {showAllActivity ? 'أقل' : 'عرض الكل'}
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <div className="text-center py-6 space-y-2">
            <span className="inline-flex w-12 h-12 rounded-full bg-[color-mix(in_srgb,var(--ds-accent)_12%,var(--ds-surface))] items-center justify-center">
              <Coins className="w-5 h-5 text-[var(--ds-accent)]" />
            </span>
            <p className="text-[11px] font-bold text-[var(--ds-text)]">لا توجد حركات مسجلة بعد</p>
            <p className="text-[9.5px] text-[var(--ds-text-2)]">أول حجز مدفوع يبدأ رصيدك.</p>
          </div>
        ) : (
          <div className="divide-y divide-[color-mix(in_srgb,var(--ds-border)_60%,transparent)]">
            {shownActivity.map((tx) => {
              const isEarned = tx.type === 'earned';
              return (
                <div key={tx.id} className="py-2.5 flex justify-between items-center gap-2 text-xs">
                  <div className="flex items-start gap-2 min-w-0">
                    <span className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center ${
                      isEarned ? 'bg-[color-mix(in_srgb,var(--ds-accent)_12%,var(--ds-surface))] text-[var(--ds-accent-deep)]' : 'bg-rose-50 text-rose-600'
                    }`}>
                      {txIcon(tx)}
                    </span>
                    <div className="space-y-0.5 text-right min-w-0">
                      <span className="font-bold text-[var(--ds-text)] block truncate">{tx.description}</span>
                      <span className="text-[9px] text-[var(--ds-text-2)] font-medium">
                        {new Date(tx.date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' })}
                        {' · '}
                        {new Date(tx.date).toLocaleTimeString('ar-EG', { hour: 'numeric', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                  <span className={`font-black text-xs shrink-0 ${isEarned ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {isEarned ? '+' : '−'}{arabicNumber(tx.amount)} نقطة
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AdGateModal
        open={adOpen}
        title="شاهد إعلان اليوم"
        rewardLabel={`استلم +${arabicNumber(25)} نقطة`}
        seconds={5}
        onReward={handleAdReward}
        onClose={() => setAdOpen(false)}
      />
    </div>
  );
}
