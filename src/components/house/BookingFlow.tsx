import React, { useEffect, useState } from 'react';
import { RetreatHouse, User } from '../../types';
import {
  ChevronLeft, ChevronRight, Check, ShieldCheck, CalendarDays, Users, Wallet,
  Star, Send, Clock, FileText, Pencil, Minus, Plus, Building2, Phone, User as UserIcon,
  Mail, MessageSquare, Church, Info, Loader2, Receipt, CreditCard,
  Sparkles, BedDouble, Copy, Home, Bell,
  Backpack, BookOpen, GraduationCap, Flame, HeartHandshake, Sun, Utensils,
} from 'lucide-react';
import { tapFeedback } from '../../lib/haptics';
import PimaSheet from '../PimaSheet';
import { useCountUp } from '../../lib/useCountUp';
import { arabicNumber } from '../../lib/arabic';
import { BOOKING_GROUPS, BookingGroupKey, isStoredGroup } from '../../lib/bookingGroups';
import type { MealPlan } from '../../lib/pricing';

export interface ApplicantDetails {
  fullName: string;
  phone: string;
  organization: string;
  diocese: string;
  email: string;
  notes: string;
  /** Empty for «حجز عادي» and for «مؤتمر كبير», which the booking already
   *  records as isLargeConferenceQuote. See lib/bookingGroups. */
  bookingType: string;
}

// Icons live here rather than in lib/bookingGroups: the labels are data the
// owner's screens share, the glyphs are this screen's dressing.
const GROUP_ICON: Record<BookingGroupKey, React.ComponentType<{ className?: string }>> = {
  standard: FileText,
  primary: Backpack,
  preparatory: BookOpen,
  secondary: GraduationCap,
  youth: Flame,
  servants: HeartHandshake,
  families: Home,
  retreat: Church,
  conference: Building2,
};

interface BookingFlowProps {
  house: RetreatHouse;
  currentUser: User | null;
  checkIn: string;
  checkOut: string;
  nights: number;
  guestsCount: number;
  setGuestsCount: (n: number) => void;
  isQuoteMode: boolean;
  setIsQuoteMode: (v: boolean) => void;
  isMonthlyHousing: boolean;
  /** Before any points are redeemed. */
  originalTotalPrice: number;
  totalPrice: number;
  depositAmount: number;
  /** Rate bands from lib/pricing — one row per distinct nightly rate. */
  breakdown: { label: string | null; nights: number; rate: number }[];
  /** The calendar, handed in so this file does not own date logic. */
  datePicker: React.ReactNode;
  /** Increments when the calendar confirms a range — closes the date sheet. */
  datesConfirmed?: number;
  /** What the house says about feeding them — see lib/pricing.computeMealPlan. */
  mealPlan?: MealPlan;
  /** Whether they have asked for board. Only meaningful when it is priced. */
  withMeals?: boolean;
  onSetWithMeals?: (v: boolean) => void;
  /** The house sells a «يوم روحي», so the guest gets the choice at all. */
  dayUseAvailable?: boolean;
  /** Per person, shown on the day option so the choice is priced, not blind. */
  dayUsePrice?: number;
  /** Collapses the stay onto one day, or reopens it by a night. */
  onSetStayMode?: (mode: 'night' | 'day') => void;
  /** Rendered on step 1 — capacity warnings, waitlist, points redemption. */
  notices?: React.ReactNode;
  submitting?: boolean;
  /** Resolves to the booking id on success, or null if it was rejected. */
  onSubmit: (applicant: ApplicantDetails) => Promise<string | null>;
  onRequireLogin?: () => void;
  /** Leaves the flow and returns to the place. */
  onExit: () => void;
  /** «متابعة الطلب» — opens حجوزاتي. Falls back to onExit when absent. */
  onTrackBooking?: () => void;
  /** «العودة للرئيسية». Falls back to onExit when absent. */
  onGoHome?: () => void;
}

const CARD = 'bg-white rounded-[28px] border border-[#EDE7DA] shadow-[0_8px_24px_rgba(0,0,0,0.06),0_2px_6px_rgba(0,0,0,0.03)]';
const STEPS = ['مراجعة الحجز', 'بياناتك', 'تأكيد الطلب'];

const egp = arabicNumber;

const shortDate = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
const weekday = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString('ar-EG', { weekday: 'long' }) : '';

const nightsWord = (n: number) => (n === 1 ? 'ليلة' : n === 2 ? 'ليلتان' : n <= 10 ? 'ليالٍ' : 'ليلة');

/** Field with the label above it and generous room around it. */
function Field({ icon, label, hint, children }: { icon: React.ReactNode; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="flex items-center gap-1.5 text-[11.5px] font-black text-[#2D2D24] mb-1.5">
        <span className="text-[#C9A24A]">{icon}</span>
        {label}
      </span>
      {children}
      {hint && <span className="block text-[9px] font-medium text-[#8A8A70] mt-1">{hint}</span>}
    </label>
  );
}

const INPUT = 'w-full bg-white border border-[#EDE7DA] rounded-2xl px-3.5 py-3 text-[12px] font-bold text-[#2D2D24] placeholder:text-[#B5AF98] placeholder:font-medium focus:outline-none focus:border-[#C9A24A] transition-colors';

/**
 * The reservation request, as three screens.
 *
 * This is not a checkout: nothing is charged here. The request goes to the
 * house for review, and only an approval asks for a deposit — which is why the
 * flow says so on every screen rather than burying it in terms.
 *
 * All pricing, capacity and date logic stays in HouseDetail; this owns the
 * journey, the applicant's details and the copy.
 */
export default function BookingFlow({
  house, currentUser, checkIn, checkOut, nights, guestsCount, setGuestsCount,
  isQuoteMode, setIsQuoteMode, isMonthlyHousing, originalTotalPrice, totalPrice,
  depositAmount, breakdown, datePicker, datesConfirmed, dayUseAvailable, dayUsePrice, onSetStayMode,
  mealPlan, withMeals, onSetWithMeals,
  notices, submitting, onSubmit, onRequireLogin, onExit,
  onTrackBooking, onGoHome,
}: BookingFlowProps) {
  const [step, setStep] = useState(0);
  const [costOpen, setCostOpen] = useState(false);
  const [datesOpen, setDatesOpen] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  // null = not being typed in; the committed count is the source of truth.
  const [guestsDraft, setGuestsDraft] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  const [applicant, setApplicant] = useState<ApplicantDetails>({
    fullName: '', phone: '', organization: '', diocese: '', email: '', notes: '', bookingType: '',
  });

  // The chosen kind of group. `isQuoteMode` is derived from it rather than set
  // beside it — «مؤتمر كبير» is the same choice under another name, and two
  // controls for one decision is how they end up contradicting each other.
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupKey, setGroupKey] = useState<BookingGroupKey>(isQuoteMode ? 'conference' : 'standard');
  const group = BOOKING_GROUPS.find((g) => g.key === groupKey) ?? BOOKING_GROUPS[0];
  const GroupIcon = GROUP_ICON[groupKey];

  const chooseGroup = (key: BookingGroupKey) => {
    tapFeedback();
    setGroupKey(key);
    setIsQuoteMode(key === 'conference');
    setApplicant((a) => ({ ...a, bookingType: isStoredGroup(key) ? key : '' }));
    setGroupOpen(false);
  };

  // The calendar reports it is finished by bumping this counter; the sheet
  // holding it closes on the change, rather than the calendar reaching up to
  // close a container it knows nothing about.
  useEffect(() => { if (datesConfirmed) setDatesOpen(false); }, [datesConfirmed]);

  // Prefill from the account the moment it is known — a servant who has booked
  // before should not retype what Pima already holds.
  useEffect(() => {
    if (!currentUser) return;
    setApplicant((a) => ({
      ...a,
      fullName: a.fullName || currentUser.name || '',
      phone: a.phone || currentUser.phone || '',
      organization: a.organization || currentUser.organizationName || currentUser.churchName || '',
      email: a.email || currentUser.email || '',
    }));
  }, [currentUser]);

  // A «يوم روحي»: arrive and leave the same day, so there is no night to
  // count and every place that would have printed «٠ ليلة» says so instead.
  const dayUse = !isMonthlyHousing && Boolean(checkIn) && checkIn === checkOut;
  const stayLabel = dayUse ? 'يوم واحد بدون مبيت' : `${egp(nights)} ${nightsWord(nights)}`;
  const perPerson = guestsCount > 0 && (dayUse || nights > 0)
    ? Math.round(originalTotalPrice / (dayUse ? 1 : nights) / guestsCount)
    : 0;
  const maxGuests = house.bedsCount || 100;
  // Earning mirrors migration 005: a point per EGP paid, doubled outside the
  // July–August peak. An estimate, and labelled as one.
  const seasonMultiplier = checkIn && [6, 7].includes(new Date(checkIn).getMonth()) ? 1 : 2;
  const pointsToEarn = Math.round(totalPrice * seasonMultiplier);
  const shownPoints = useCountUp(pointsToEarn, 900);
  const shownTotal = useCountUp(totalPrice, 700);

  const canContinue = !!checkIn && !!checkOut && guestsCount > 0 && totalPrice > 0;
  const detailsValid = applicant.fullName.trim().length > 1 && applicant.phone.trim().length >= 8 && applicant.organization.trim().length > 1;

  const go = (next: number) => {
    tapFeedback();
    setStep(next);
    // A step change is a screen change: start it at the top, never halfway
    // down the page the reader was already on.
    document.getElementById('pima-booking-flow')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSubmit = async () => {
    if (!currentUser) { onRequireLogin?.(); return; }
    tapFeedback();
    const id = await onSubmit(applicant);
    if (id) { setRequestId(id); go(3); }
  };

  /* ── Success ─────────────────────────────────────────────────────────────
     Not the booking record — a confirmation that the request left. The guest
     has just handed over their trip and paid nothing; what they need is that
     it arrived, what happens next, and a way onward. ── */
  if (step === 3 && requestId) {
    const nextSteps = [
      { icon: ShieldCheck, label: 'قبول الطلب' },
      { icon: FileText, label: 'طلب بيانات إضافية' },
      { icon: CreditCard, label: 'تأكيد دفع العربون' },
    ];
    // Five sparkles, placed by hand around the ring rather than scattered.
    const sparks = [
      { top: '4%',  right: '14%', size: 'w-4 h-4',   delay: 780 },
      { top: '16%', left: '10%',  size: 'w-3 h-3',   delay: 900 },
      { top: '52%', right: '4%',  size: 'w-3.5 h-3.5', delay: 1020 },
      { top: '62%', left: '6%',   size: 'w-3 h-3',   delay: 1140 },
      { top: '86%', right: '22%', size: 'w-2.5 h-2.5', delay: 1260 },
    ];

    return (
      <div id="pima-booking-flow" className="space-y-4 text-right">
        {/* Hero */}
        <div className="pima-rise text-center pt-2">
          <span className="relative inline-block w-[132px] h-[132px]">
            {sparks.map((s, i) => (
              <Sparkles
                key={i}
                aria-hidden="true"
                className={`pima-spark absolute ${s.size} text-[#E0A82E]`}
                style={{ top: s.top, right: s.right, left: s.left, animationDelay: `${s.delay}ms` }}
              />
            ))}
            <span className="pima-success-glow absolute inset-3 rounded-full bg-white" />
            {/* The ring and the tick are one drawing, written on arrival. */}
            <svg viewBox="0 0 100 100" className="relative w-full h-full -rotate-90" aria-hidden="true">
              <circle cx="50" cy="50" r="40" fill="none" stroke="#F2EBDC" strokeWidth="4" />
              <circle cx="50" cy="50" r="40" fill="none" stroke="#C9A24A" strokeWidth="4" strokeLinecap="round" className="pima-ring-draw" />
              <path d="M33 51 L45 63 L68 39" fill="none" stroke="#B8944E" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" className="pima-check-draw" transform="rotate(90 50 50)" />
            </svg>
          </span>

          <h3 className="text-[19px] font-black text-[#0A2342] mt-4 pima-rise pima-rise-1">تم إرسال طلب الحجز بنجاح</h3>
          <p className="text-[11px] font-medium text-[#8A8A70] leading-relaxed mt-2 pima-rise pima-rise-2">
            تم استلام طلبك وسيتم مراجعته من قبل بيت المؤتمرات.
            <br />سيصلك إشعار فور وجود أي تحديث.
          </p>
        </div>

        {/* What happens next — three steps, arriving one after another. */}
        <div className={`${CARD} p-3 grid grid-cols-3`}>
          {nextSteps.map((s, i) => (
            <div
              key={s.label}
              className={`pima-rise flex flex-col items-center text-center gap-2 px-1 ${i > 0 ? 'border-l border-[#EDE7DA]' : ''}`}
              style={{ animationDelay: `${1000 + i * 80}ms` }}
            >
              <span className="w-10 h-10 rounded-full bg-[#F6F0E2] flex items-center justify-center">
                <s.icon className="w-[18px] h-[18px] text-[#C9A24A]" />
              </span>
              <span className="text-[9.5px] font-black text-[#2D2D24] leading-tight">{s.label}</span>
            </div>
          ))}
        </div>

        {/* The reservation itself */}
        <div className={`${CARD} p-3 pima-rise pima-rise-3`}>
          <div className="flex items-center gap-3">
            {house.images?.[0] && (
              <img src={house.images[0]} alt="" referrerPolicy="no-referrer" className="w-[86px] h-[86px] rounded-2xl object-cover shrink-0" />
            )}
            <div className="min-w-0 flex-1 space-y-1.5">
              <span className="flex items-center gap-1.5 text-[12.5px] font-black text-[#0A2342]">
                <Building2 className="w-3.5 h-3.5 text-[#C9A24A] shrink-0" />
                <span className="truncate">{house.name}</span>
              </span>
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-[#4A4A3A]">
                <CalendarDays className="w-3.5 h-3.5 text-[#C9A24A] shrink-0" />
                {shortDate(checkIn)} — {shortDate(checkOut)}
              </span>
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-[#4A4A3A]">
                <Users className="w-3.5 h-3.5 text-[#C9A24A] shrink-0" />
                {egp(guestsCount)} فرد
              </span>
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-[#4A4A3A]">
                <BedDouble className="w-3.5 h-3.5 text-[#C9A24A] shrink-0" />
                {egp(house.roomsCount)} غرفة
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-[#EDE7DA]">
            <span className="text-[9.5px] font-bold text-[#8A8A70]">رقم الطلب</span>
            <button
              type="button"
              onClick={() => { tapFeedback(); navigator.clipboard?.writeText(requestId).then(() => setCopiedId(true)); }}
              className="flex items-center gap-1.5 text-[11px] font-black text-[#0A2342] cursor-pointer hover:text-[#B8944E] transition-colors"
            >
              <span dir="ltr">#{requestId}</span>
              {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-[#B5AF98]" />}
            </button>
          </div>
        </div>

        {/* Where it stands, and how long the wait usually is */}
        <div className={`${CARD} p-3 flex items-stretch gap-3 pima-rise pima-rise-3`}>
          <div className="flex-1 text-center">
            <span className="block text-[9.5px] font-bold text-[#8A8A70] mb-1.5">متوسط وقت الرد</span>
            <span className="flex items-center justify-center gap-1.5 text-[12.5px] font-black text-[#0A2342]">
              <Clock className="w-3.5 h-3.5 text-[#C9A24A]" />
              من يوم إلى {egp(3)} أيام
            </span>
          </div>
          <span aria-hidden="true" className="w-px bg-[#EDE7DA]" />
          <div className="flex-1 text-center">
            <span className="block text-[9.5px] font-bold text-[#8A8A70] mb-1.5">الحالة الحالية</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#EBD9B4] bg-[#FDF9EF] px-3 py-1.5 text-[11px] font-black text-[#B8944E]">
              <span aria-hidden="true" className="pima-status-dot w-1.5 h-1.5 rounded-full bg-[#C9A24A]" />
              قيد المراجعة
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => { tapFeedback(); (onTrackBooking ?? onExit)(); }}
          className="pima-pop-once w-full flex items-center justify-center gap-2 bg-gradient-to-b from-[#C9A96A] to-[#B8944E] text-white font-black text-[13px] py-3.5 rounded-2xl shadow-[0_4px_14px_rgba(184,148,78,0.35)] transition-transform cursor-pointer pima-press"
        >
          <ChevronLeft className="w-4 h-4" />
          متابعة الطلب
        </button>

        <button
          type="button"
          onClick={() => { tapFeedback(); (onGoHome ?? onExit)(); }}
          className="w-full flex items-center justify-center gap-2 bg-white border border-[#EDE7DA] hover:border-[#E3CD9F] text-[#4A4A3A] font-black text-[12.5px] py-3.5 rounded-2xl transition-colors cursor-pointer pima-press"
        >
          <Home className="w-4 h-4 text-[#C9A24A]" />
          العودة للرئيسية
        </button>

        <div className="pima-rise pima-rise-3 flex items-center gap-3 rounded-[28px] border border-[#EBD9B4] bg-[#FDF9EF] p-3.5">
          <span className="w-10 h-10 rounded-full bg-white border border-[#EBD9B4] flex items-center justify-center shrink-0">
            <Bell className="w-[18px] h-[18px] text-[#C9A24A]" />
          </span>
          <p className="text-[10.5px] font-medium text-[#4A4A3A] leading-relaxed">
            يمكنك متابعة حالة طلبك من قائمة «حجوزاتي» في أي وقت.
          </p>
        </div>
      </div>
    );
  }

  /* ── Shared: the stay summary used on steps 2 and 3 ───────────────────── */
  const summaryRows = [
    { icon: <Building2 className="w-4 h-4" />, label: 'المكان', value: house.name, sub: house.governorate },
    { icon: <CalendarDays className="w-4 h-4" />, label: 'التاريخ', value: dayUse ? shortDate(checkIn) : `${shortDate(checkIn)} — ${shortDate(checkOut)}`, sub: stayLabel },
    { icon: <Users className="w-4 h-4" />, label: 'عدد الحضور', value: `${egp(guestsCount)} فرد`, sub: '' },
    { icon: <GroupIcon className="w-4 h-4" />, label: 'نوع الحجز', value: group.label, sub: '' },
  ];

  return (
    <div id="pima-booking-flow" className="space-y-4 scroll-mt-4">
      {/* This is a screen of its own, not a panel on the place page, so it
          carries its own way back. */}
      <div className="flex items-center gap-2 pb-2 border-b border-[#EDE7DA]">
        <button
          type="button"
          onClick={() => { tapFeedback(); onExit(); }}
          aria-label="رجوع"
          className="w-9 h-9 rounded-xl border border-[#EDE7DA] bg-white hover:bg-[#F1ECE0] text-[#4A4A3A] flex items-center justify-center transition-colors cursor-pointer pima-press"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <div className="min-w-0 leading-tight">
          <h2 className="text-[13px] font-black text-[#0A2342]">طلب حجز جديد</h2>
          <p className="text-[10px] text-[#8A8A70] truncate">{house.name}</p>
        </div>
      </div>

      {/* ── Step rail ── */}
      <div className={`${CARD} px-4 py-3`}>
        <div className="flex items-center">
          {STEPS.map((label, i) => {
            const done = i < step;
            const current = i === step;
            return (
              <React.Fragment key={label}>
                {i > 0 && (
                  <span className="flex-1 h-0.5 mx-1 rounded-full overflow-hidden bg-[#EDE7DA]">
                    <span
                      className="block h-full bg-[#C9A24A]"
                      style={{ width: i <= step ? '100%' : '0%', transition: 'width 400ms var(--motion-ease)' }}
                    />
                  </span>
                )}
                <span className="flex flex-col items-center gap-0.5 shrink-0">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black transition-colors duration-[250ms] ${
                    done ? 'bg-[#C9A24A] text-white'
                      : current ? 'bg-[#C9A24A] text-white ring-[3px] ring-[#C9A24A]/15'
                      : 'bg-[#F4EFE3] text-[#B5AF98]'
                  }`}>
                    {done ? <Check className="w-3 h-3" strokeWidth={3} /> : egp(i + 1)}
                  </span>
                  <span className={`text-[8.5px] font-black leading-none ${current ? 'text-[#B8944E]' : 'text-[#B5AF98]'}`}>{label}</span>
                </span>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* ══ STEP 1 — review the stay ══ */}
      {step === 0 && (
        <div className="space-y-4 pima-rise">
          <div className="px-1 leading-tight">
            <h3 className="text-[14px] font-black text-[#0A2342]">مراجعة تفاصيل الحجز</h3>
            <p className="text-[10px] font-medium text-[#8A8A70]">راجع التفاصيل قبل إدخال بياناتك</p>
          </div>

          {/* House — the badge sits with the name rather than a line below it. */}
          <div className={`${CARD} p-3 flex items-center gap-3`}>
            {house.images?.[0] && (
              <img src={house.images[0]} alt="" referrerPolicy="no-referrer" className="w-14 h-14 rounded-2xl object-cover shrink-0" />
            )}
            <div className="min-w-0 flex-1 leading-tight">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[13px] font-black text-[#0A2342]">{house.name}</span>
                <span className="inline-flex items-center gap-1 text-[9px] font-black text-[#B8944E] bg-[#FDF9EF] border border-[#EBD9B4] rounded-full px-1.5 py-0.5">
                  <ShieldCheck className="w-2.5 h-2.5" />
                  حجز آمن
                </span>
              </div>
              <span className="block text-[10px] font-medium text-[#8A8A70] mt-1">{house.governorate}</span>
            </div>
          </div>

          {/* Dates — one row: arrival, the nights between them, departure. */}
          <div className={`${CARD} p-3 space-y-2`}>
            {/* The kind of stay comes before its dates, because it decides what
                the dates even mean. Only where the house sells a day: offering
                a choice one of whose halves does not exist is worse than not
                offering it. Each side carries its own rate, so this is a
                priced decision rather than a blind one. */}
            {dayUseAvailable && !isMonthlyHousing && (
              <div role="radiogroup" aria-label="نوع الإقامة" className="grid grid-cols-2 gap-2 pb-1">
                {([
                  { mode: 'night' as const, on: !dayUse, Icon: BedDouble, label: 'إقامة بمبيت', rate: house.pricePerNightPerPerson, unit: 'لليلة' },
                  { mode: 'day' as const, on: dayUse, Icon: Sun, label: 'يوم بدون مبيت', rate: dayUsePrice, unit: 'لليوم' },
                ]).map((o) => (
                  <button
                    key={o.mode}
                    type="button"
                    role="radio"
                    aria-checked={o.on}
                    onClick={() => onSetStayMode?.(o.mode)}
                    className={`rounded-2xl border px-2.5 py-2 text-right transition-colors duration-200 cursor-pointer pima-press ${
                      o.on ? 'bg-[#FDF9EF] border-[#C9A24A]' : 'bg-white border-[#EDE7DA] hover:border-[#E3CD9F]'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <o.Icon className={`w-3.5 h-3.5 shrink-0 ${o.on ? 'text-[#B8944E]' : 'text-[#8A8A70]'}`} />
                      <span className={`text-[10.5px] font-black truncate ${o.on ? 'text-[#B8944E]' : 'text-[#2D2D24]'}`}>{o.label}</span>
                    </span>
                    <span className="block text-[9px] font-bold text-[#8A8A70] mt-1">
                      {egp(o.rate ?? 0)} ج.م {o.unit} للفرد
                    </span>
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[11px] font-black text-[#2D2D24]">
                <CalendarDays className="w-4 h-4 text-[#C9A24A]" />
                {dayUse ? 'تاريخ اليوم' : 'تاريخ الإقامة'}
              </span>
              <button
                type="button"
                onClick={() => { tapFeedback(); setDatesOpen(true); }}
                className="text-[10px] font-black text-[#B8944E] border border-[#EBD9B4] rounded-full px-3 py-0.5 hover:bg-[#FDF9EF] transition-colors cursor-pointer pima-press"
              >
                تغيير
              </button>
            </div>
            {/* A day has one date. Printing «من ٢٢ يوليو إلى ٢٢ يوليو» is
                arithmetically true and reads as a bug. */}
            {dayUse ? (
              <div className="flex items-center gap-2 rounded-2xl bg-[#FBF9F4] border border-[#EDE7DA] px-3 py-2">
                <span className="w-8 h-8 rounded-full bg-[#F6F0E2] border border-[#EBD9B4] flex items-center justify-center shrink-0">
                  <Sun className="w-4 h-4 text-[#C9A24A]" />
                </span>
                <div className="flex-1 min-w-0 leading-tight">
                  <span className="block text-[11px] font-black text-[#0A2342] truncate">{shortDate(checkIn)}</span>
                  <span className="block text-[8.5px] font-bold text-[#8A8A70] mt-0.5">{weekday(checkIn)} · وصول ومغادرة في نفس اليوم</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-2xl bg-[#FBF9F4] border border-[#EDE7DA] px-3 py-2">
                <div className="flex-1 min-w-0 leading-tight">
                  <span className="block text-[8.5px] font-bold text-[#8A8A70]">من</span>
                  <span className="block text-[11px] font-black text-[#0A2342] truncate">{shortDate(checkIn)}</span>
                </div>
                <div className="shrink-0 text-center px-2 border-x border-[#EDE7DA] leading-tight">
                  <span className="block text-[13px] font-black text-[#B8944E]">{egp(nights)}</span>
                  <span className="block text-[8px] font-bold text-[#8A8A70]">{nightsWord(nights)}</span>
                </div>
                <div className="flex-1 min-w-0 leading-tight text-left">
                  <span className="block text-[8.5px] font-bold text-[#8A8A70]">إلى</span>
                  <span className="block text-[11px] font-black text-[#0A2342] truncate">{shortDate(checkOut)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Guests — label and counter share a row; the cap sits under it. */}
          <div className={`${CARD} p-3`}>
            <div className="flex items-center justify-between gap-3">
              <span className="leading-tight">
                <span className="flex items-center gap-1.5 text-[11px] font-black text-[#2D2D24]">
                  <Users className="w-4 h-4 text-[#C9A24A]" />
                  عدد الأفراد
                </span>
                <span className="block text-[9px] font-medium text-[#8A8A70] mt-0.5">الحد الأقصى {egp(maxGuests)} فرد</span>
              </span>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => { tapFeedback(); setGuestsCount(Math.max(1, guestsCount - 1)); }}
                  disabled={guestsCount <= 1}
                  aria-label="إنقاص"
                  className="w-9 h-9 rounded-xl border border-[#EDE7DA] bg-white text-[#4A4A3A] flex items-center justify-center disabled:opacity-40 hover:bg-[#F1ECE0] transition-colors cursor-pointer pima-press"
                >
                  <Minus className="w-4 h-4" />
                </button>
                {/* Typeable, not only steppable: a servant booking forty
                    people should not tap plus thirty-nine times. Held as text
                    while editing so the field can legitimately be empty
                    mid-keystroke, and clamped to the house's capacity on blur
                    rather than fighting the caret on every character. */}
                <input
                  type="text"
                  inputMode="numeric"
                  aria-label="عدد الأفراد"
                  value={guestsDraft ?? egp(guestsCount)}
                  onChange={(e) => {
                    // Accept Arabic-Indic as readily as Latin — the field
                    // displays Arabic digits, so people type them back.
                    const digits = e.target.value.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[^\d]/g, '');
                    setGuestsDraft(digits);
                    const n = parseInt(digits, 10);
                    if (Number.isFinite(n) && n >= 1 && n <= maxGuests) setGuestsCount(n);
                  }}
                  onBlur={() => {
                    const n = parseInt(guestsDraft ?? '', 10);
                    if (Number.isFinite(n)) setGuestsCount(Math.min(maxGuests, Math.max(1, n)));
                    setGuestsDraft(null);
                  }}
                  onFocus={(e) => e.currentTarget.select()}
                  className="w-[56px] bg-transparent text-[22px] font-black text-[#0A2342] text-center [font-variant-numeric:tabular-nums] border-b-2 border-transparent focus:border-[#C9A24A] focus:outline-none transition-colors rounded-none"
                />
                <button
                  type="button"
                  onClick={() => { tapFeedback(); setGuestsCount(Math.min(maxGuests, guestsCount + 1)); }}
                  disabled={guestsCount >= maxGuests}
                  aria-label="زيادة"
                  className="w-9 h-9 rounded-xl border border-[#EDE7DA] bg-white text-[#4A4A3A] flex items-center justify-center disabled:opacity-40 hover:bg-[#F1ECE0] transition-colors cursor-pointer pima-press"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Type — a row that opens the list, not the list itself. Nine kinds
              of group laid out on the review screen would outweigh the dates
              and the price it sits between. */}
          <button
            type="button"
            onClick={() => { tapFeedback(); setGroupOpen(true); }}
            className={`${CARD} w-full p-3 flex items-center gap-3 text-right cursor-pointer hover:border-[#E3CD9F] transition-colors pima-press`}
          >
            <span className="w-9 h-9 rounded-full bg-[#F6F0E2] border border-[#EBD9B4] flex items-center justify-center shrink-0">
              <GroupIcon className="w-4 h-4 text-[#C9A24A]" />
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block text-[10.5px] font-bold text-[#8A8A70]">نوع الحجز</span>
              <span className="block text-[12.5px] font-black text-[#0A2342] mt-0.5">{group.label}</span>
            </span>
            <span className="flex items-center gap-1 text-[10px] font-black text-[#B8944E] shrink-0">
              تغيير
              <ChevronLeft className="w-3.5 h-3.5" />
            </span>
          </button>

          {/* Meals. Four data states, four different things to say — the one
              thing none of them does is invent a number. */}
          {mealPlan && mealPlan.state !== 'none' && !isMonthlyHousing && (
            <div className={`${CARD} p-3`}>
              {mealPlan.state === 'included' ? (
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                    <Utensils className="w-4 h-4 text-emerald-700" />
                  </span>
                  <span className="min-w-0 leading-tight">
                    <span className="block text-[11.5px] font-black text-[#2D2D24]">الوجبات مشمولة في السعر</span>
                    <span className="block text-[9.5px] font-medium text-[#8A8A70] mt-0.5">
                      ٣ وجبات يوميًا داخل قيمة الإقامة — لا يُضاف شيء على الإجمالي.
                    </span>
                  </span>
                </div>
              ) : mealPlan.state === 'perMealOnly' ? (
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-full bg-[#F6F0E2] border border-[#EBD9B4] flex items-center justify-center shrink-0">
                    <Utensils className="w-4 h-4 text-[#C9A24A]" />
                  </span>
                  <span className="min-w-0 leading-tight">
                    <span className="block text-[11.5px] font-black text-[#2D2D24]">الوجبات غير مشمولة</span>
                    {/* Reported, not multiplied: how many meals a group eats in
                        a day is theirs to say, not ours to assume. */}
                    <span className="block text-[9.5px] font-medium text-[#8A8A70] mt-0.5">
                      سعر الوجبة {egp(mealPlan.perMealPrice ?? 0)} ج.م للفرد — تُتفق تفاصيلها مع إدارة المكان.
                    </span>
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  role="switch"
                  aria-checked={Boolean(withMeals)}
                  onClick={() => onSetWithMeals?.(!withMeals)}
                  className={`w-full flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-right transition-colors duration-200 cursor-pointer pima-press ${
                    withMeals ? 'bg-[#FDF9EF] border-[#C9A24A]' : 'bg-white border-[#EDE7DA] hover:border-[#E3CD9F]'
                  }`}
                >
                  <span className={`w-9 h-9 rounded-full border flex items-center justify-center shrink-0 ${
                    withMeals ? 'bg-white border-[#EBD9B4]' : 'bg-[#F6F0E2] border-[#EDE7DA]'
                  }`}>
                    <Utensils className={`w-4 h-4 ${withMeals ? 'text-[#B8944E]' : 'text-[#8A8A70]'}`} />
                  </span>
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className={`block text-[11.5px] font-black ${withMeals ? 'text-[#B8944E]' : 'text-[#2D2D24]'}`}>
                      أضف الإعاشة الكاملة
                    </span>
                    <span className="block text-[9.5px] font-medium text-[#8A8A70] mt-0.5">
                      ٣ وجبات يوميًا · {egp(mealPlan.total)} ج.م لكل المجموعة
                    </span>
                  </span>
                  <span className={`w-5 h-5 rounded-full border-[1.5px] flex items-center justify-center shrink-0 ${
                    withMeals ? 'bg-[#C9A24A] border-[#C9A24A]' : 'border-[#DED6C4]'
                  }`}>
                    {withMeals && <Check className="w-3 h-3 text-white" strokeWidth={3.5} />}
                  </span>
                </button>
              )}
            </div>
          )}

          {/* Cost */}
          <div className={`${CARD} p-3`}>
            <div className="flex items-start justify-between">
              <div className="leading-tight">
                <span className="flex items-center gap-1.5 text-[10.5px] font-bold text-[#8A8A70]">
                  <Wallet className="w-4 h-4 text-[#C9A24A]" />
                  التكلفة التقديرية
                </span>
                <span className="block text-[22px] font-black text-[#0A2342] mt-0.5 [font-variant-numeric:tabular-nums]">
                  {egp(shownTotal)} <span className="text-[12px]">ج.م</span>
                </span>
                {!isMonthlyHousing && perPerson > 0 && (
                  <span className="block text-[9.5px] font-medium text-[#8A8A70]">
                    {stayLabel} · {egp(guestsCount)} فرد × {egp(perPerson)} ج.م
                  </span>
                )}
              </div>
              {breakdown.length > 0 && (
                <button
                  type="button"
                  onClick={() => { tapFeedback(); setCostOpen(true); }}
                  className="flex items-center gap-1 text-[10px] font-black text-[#B8944E] hover:underline cursor-pointer shrink-0"
                >
                  عرض التفاصيل
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Reward */}
          {pointsToEarn > 0 && (
            <div className="rounded-[28px] border border-[#EBD9B4] bg-[#FDF9EF] p-3 flex items-center gap-3">
              <span className="w-9 h-9 rounded-full bg-white border border-[#EBD9B4] flex items-center justify-center shrink-0">
                <Star className="w-4 h-4 fill-[#E0A82E] text-[#E0A82E] pima-pulse-slow" />
              </span>
              <div className="min-w-0 flex-1 leading-tight">
                <span className="block text-[11px] font-black text-[#2D2D24]">
                  ستحصل على <span className="text-[#B8944E]">{egp(shownPoints)} نقطة</span> بيما
                </span>
                <span className="block text-[9.5px] font-medium text-[#8A8A70] mt-0.5">تُضاف لحسابك بعد إتمام الإقامة</span>
              </div>
            </div>
          )}

          {notices}

          {/* Trust — two columns, so five short promises cost one block of
              height instead of five rows of it. */}
          <div className={`${CARD} p-3 space-y-2`}>
            <span className="flex items-center gap-1.5 text-[11px] font-black text-[#0A2342]">
              <ShieldCheck className="w-4 h-4 text-[#C9A24A]" />
              لماذا تحجز عبر بيما؟
            </span>
            <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              {[
                'لا يوجد أي دفع الآن',
                'مراجعة الطلب يدويًا',
                'العربون بعد الموافقة',
                'حماية كاملة لبياناتك',
                'دعم بيما طوال رحلة الحجز',
              ].map((line) => (
                <li key={line} className="flex items-start gap-1.5 text-[9.5px] font-medium text-[#4A4A3A] leading-snug">
                  <Check className="w-3 h-3 text-emerald-600 shrink-0 mt-0.5" strokeWidth={3} />
                  {line}
                </li>
              ))}
            </ul>
          </div>

          <button
            type="button"
            disabled={!canContinue}
            onClick={() => (currentUser ? go(1) : onRequireLogin?.())}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-b from-[#C9A96A] to-[#B8944E] disabled:from-[#D9D3C4] disabled:to-[#D9D3C4] text-white font-black text-[13px] py-3.5 rounded-2xl shadow-[0_4px_14px_rgba(184,148,78,0.35)] disabled:shadow-none transition-all cursor-pointer disabled:cursor-not-allowed pima-press"
          >
            متابعة
            <ChevronLeft className="w-4 h-4" />
          </button>
          {!canContinue && (
            <p className="text-[10px] font-medium text-[#8A8A70] text-center -mt-2">اختر التواريخ وعدد الأفراد أولًا.</p>
          )}
        </div>
      )}

      {/* ══ STEP 2 — who is asking ══ */}
      {step === 1 && (
        <div className="space-y-4 pima-rise">
          <div className="px-1">
            <h3 className="text-[15px] font-black text-[#0A2342]">بيانات مقدم الطلب</h3>
            <p className="text-[10.5px] font-medium text-[#8A8A70] mt-0.5">يرجى إدخال بياناتك للتواصل معك بخصوص الطلب</p>
          </div>

          {/* Pinned summary */}
          <div className={`${CARD} p-3 flex items-center gap-3`}>
            {house.images?.[0] && (
              <img src={house.images[0]} alt="" referrerPolicy="no-referrer" className="w-14 h-14 rounded-2xl object-cover shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <span className="block text-[12px] font-black text-[#0A2342] truncate">{house.name}</span>
              <span className="block text-[9.5px] font-medium text-[#8A8A70] mt-0.5">
                {shortDate(checkIn)} — {shortDate(checkOut)} · {egp(guestsCount)} فرد
              </span>
              <span className="block text-[11.5px] font-black text-[#B8944E] mt-0.5">{egp(totalPrice)} ج.م</span>
            </div>
            <button
              type="button"
              onClick={() => go(0)}
              className="flex items-center gap-1 text-[10px] font-black text-[#B8944E] border border-[#EBD9B4] rounded-full px-3 py-1.5 hover:bg-[#FDF9EF] transition-colors cursor-pointer shrink-0 pima-press"
            >
              <Pencil className="w-3 h-3" />
              تعديل
            </button>
          </div>

          <div className={`${CARD} p-4 space-y-4`}>
            <Field icon={<UserIcon className="w-3.5 h-3.5" />} label="الاسم الكامل" hint="اكتب اسمك كما يظهر في بطاقة الرقم القومي">
              <input className={INPUT} value={applicant.fullName} onChange={(e) => setApplicant({ ...applicant, fullName: e.target.value })} placeholder="الاسم الثلاثي" />
            </Field>
            <Field icon={<Phone className="w-3.5 h-3.5" />} label="رقم الهاتف">
              <input className={INPUT} value={applicant.phone} onChange={(e) => setApplicant({ ...applicant, phone: e.target.value })} placeholder="01xxxxxxxxx" inputMode="tel" dir="ltr" />
            </Field>
            <Field icon={<Church className="w-3.5 h-3.5" />} label="الكنيسة / الجهة">
              <input className={INPUT} value={applicant.organization} onChange={(e) => setApplicant({ ...applicant, organization: e.target.value })} placeholder="اكتب اسم الكنيسة أو الجهة" />
            </Field>
            <Field icon={<Building2 className="w-3.5 h-3.5" />} label="الإيبارشية (اختياري)">
              <input className={INPUT} value={applicant.diocese} onChange={(e) => setApplicant({ ...applicant, diocese: e.target.value })} placeholder="اختر الإيبارشية" />
            </Field>
            <Field icon={<Mail className="w-3.5 h-3.5" />} label="البريد الإلكتروني (اختياري)">
              <input className={INPUT} value={applicant.email} onChange={(e) => setApplicant({ ...applicant, email: e.target.value })} placeholder="example@email.com" inputMode="email" dir="ltr" />
            </Field>
            <Field icon={<MessageSquare className="w-3.5 h-3.5" />} label="ملاحظات إضافية (اختياري)">
              <textarea rows={3} className={`${INPUT} resize-none leading-relaxed`} value={applicant.notes} onChange={(e) => setApplicant({ ...applicant, notes: e.target.value })} placeholder="أي ملاحظات تساعد إدارة المكان على تلبية طلبك..." />
            </Field>
          </div>

          <button
            type="button"
            disabled={!detailsValid}
            onClick={() => go(2)}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-b from-[#C9A96A] to-[#B8944E] disabled:from-[#D9D3C4] disabled:to-[#D9D3C4] text-white font-black text-[13px] py-4 rounded-2xl shadow-[0_4px_14px_rgba(184,148,78,0.35)] disabled:shadow-none transition-all cursor-pointer disabled:cursor-not-allowed pima-press"
          >
            مراجعة الطلب
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => go(0)} className="w-full flex items-center justify-center gap-1 text-[11px] font-bold text-[#8A8A70] hover:text-[#4A4A3A] transition-colors cursor-pointer">
            <ChevronRight className="w-3.5 h-3.5" />
            رجوع
          </button>
        </div>
      )}

      {/* ══ STEP 3 — confirm ══ */}
      {step === 2 && (
        <div className="space-y-4 pima-rise">
          <div className="px-1">
            <h3 className="text-[15px] font-black text-[#0A2342]">مراجعة وتأكيد الطلب</h3>
            <p className="text-[10.5px] font-medium text-[#8A8A70] mt-0.5">يرجى مراجعة طلبك قبل الإرسال</p>
          </div>

          <div className={`${CARD} divide-y divide-[#EDE7DA]`}>
            {summaryRows.map((r) => (
              <div key={r.label} className="flex items-center gap-3 p-3.5">
                <span className="w-9 h-9 rounded-full bg-[#F6F0E2] text-[#C9A24A] flex items-center justify-center shrink-0">{r.icon}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[9.5px] font-bold text-[#8A8A70]">{r.label}</span>
                  <span className="block text-[11.5px] font-black text-[#0A2342] mt-0.5">{r.value}</span>
                  {r.sub && <span className="block text-[9px] font-medium text-[#B5AF98]">{r.sub}</span>}
                </span>
              </div>
            ))}
            <div className="flex items-center gap-3 p-3.5">
              <span className="w-9 h-9 rounded-full bg-[#F6F0E2] text-[#C9A24A] flex items-center justify-center shrink-0"><Receipt className="w-4 h-4" /></span>
              <span className="flex-1 min-w-0">
                <span className="block text-[9.5px] font-bold text-[#8A8A70]">التكلفة التقديرية</span>
                <span className="block text-[13px] font-black text-[#B8944E] mt-0.5">{egp(totalPrice)} ج.م</span>
              </span>
            </div>
            {pointsToEarn > 0 && (
              <div className="flex items-center gap-3 p-3.5">
                <span className="w-9 h-9 rounded-full bg-[#F6F0E2] flex items-center justify-center shrink-0"><Star className="w-4 h-4 fill-[#E0A82E] text-[#E0A82E]" /></span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[9.5px] font-bold text-[#8A8A70]">النقاط التي ستحصل عليها</span>
                  <span className="block text-[11.5px] font-black text-[#0A2342] mt-0.5">{egp(pointsToEarn)} نقطة بيما</span>
                  <span className="block text-[9px] font-medium text-[#B5AF98]">تُضاف بعد إتمام الإقامة</span>
                </span>
              </div>
            )}
          </div>

          <div className="rounded-[28px] border border-[#EBD9B4] bg-[#FDF9EF] p-4 flex items-start gap-3">
            <Info className="w-4 h-4 text-[#C9A24A] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="block text-[12px] font-black text-[#B8944E]">لن يتم خصم أي مبلغ الآن</span>
              <p className="text-[10px] font-medium text-[#4A4A3A] leading-relaxed">
                سيتم مراجعة طلبك أولًا من قبل إدارة المكان. بعد الموافقة ستتلقى إشعارًا لدفع العربون
                {depositAmount > 0 && <> ({egp(depositAmount)} ج.م)</>}، ويُدفع باقي المبلغ وفقًا للاتفاق مع إدارة المكان.
              </p>
            </div>
          </div>

          <div className={`${CARD} p-3.5 flex items-center gap-3`}>
            <span className="w-9 h-9 rounded-full bg-[#F1F5FB] text-[#4A6FA5] flex items-center justify-center shrink-0"><Clock className="w-4 h-4" /></span>
            <span className="flex-1">
              <span className="block text-[9.5px] font-bold text-[#8A8A70]">متوسط وقت الرد</span>
              <span className="block text-[11.5px] font-black text-[#0A2342] mt-0.5">خلال ٦ ساعات</span>
            </span>
            <span className="text-[9px] font-medium text-[#B5AF98]">آخر ٣٠ يوم</span>
          </div>

          <label className="flex items-start gap-2.5 px-1 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-[#C9A24A] shrink-0 cursor-pointer"
            />
            <span className="text-[10.5px] font-medium text-[#4A4A3A] leading-relaxed">
              أوافق على سياسة الحجز والإلغاء والشروط والأحكام
            </span>
          </label>

          <button
            type="button"
            disabled={!agreed || submitting}
            onClick={handleSubmit}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-b from-[#C9A96A] to-[#B8944E] disabled:from-[#D9D3C4] disabled:to-[#D9D3C4] text-white font-black text-[13px] py-4 rounded-2xl shadow-[0_4px_14px_rgba(184,148,78,0.35)] disabled:shadow-none transition-all cursor-pointer disabled:cursor-not-allowed pima-press"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {submitting ? 'جارٍ الإرسال...' : 'إرسال طلب الحجز'}
          </button>
          <p className="flex items-center justify-center gap-1.5 text-[10px] font-medium text-[#8A8A70] -mt-2">
            <CreditCard className="w-3.5 h-3.5" />
            لن يتم تحصيل أي مبلغ الآن
          </p>
          <button type="button" onClick={() => go(1)} className="w-full flex items-center justify-center gap-1 text-[11px] font-bold text-[#8A8A70] hover:text-[#4A4A3A] transition-colors cursor-pointer">
            <ChevronRight className="w-3.5 h-3.5" />
            رجوع
          </button>
        </div>
      )}

      {/* ── Sheets ── */}
      <PimaSheet
        open={groupOpen}
        onClose={() => setGroupOpen(false)}
        title="نوع الحجز"
        subtitle="يساعد البيت يجهّز الغرف والقاعات المناسبة لمجموعتك"
        icon={<FileText className="w-4 h-4 text-[#C9A24A]" />}
      >
        {/* A radio group, not a row of buttons: one of these is true at a
            time, and a screen reader should hear it that way. */}
        <div role="radiogroup" aria-label="نوع الحجز" className="space-y-1">
          {BOOKING_GROUPS.map((g) => {
            const Glyph = GROUP_ICON[g.key];
            const on = groupKey === g.key;
            return (
              <button
                key={g.key}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => chooseGroup(g.key)}
                className={`w-full flex items-center gap-2.5 rounded-2xl border px-3 py-2 text-right transition-colors duration-200 cursor-pointer pima-press ${
                  on ? 'bg-[#FDF9EF] border-[#C9A24A]' : 'bg-white border-[#EDE7DA] hover:border-[#E3CD9F]'
                }`}
              >
                <span className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 ${
                  on ? 'bg-white border-[#EBD9B4]' : 'bg-[#F6F0E2] border-[#EDE7DA]'
                }`}>
                  <Glyph className={`w-3.5 h-3.5 ${on ? 'text-[#B8944E]' : 'text-[#8A8A70]'}`} />
                </span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className={`block text-[11.5px] font-black ${on ? 'text-[#B8944E]' : 'text-[#2D2D24]'}`}>{g.label}</span>
                  {g.hint && <span className="block text-[9px] font-medium text-[#8A8A70] mt-0.5">{g.hint}</span>}
                </span>
                <span className={`w-4.5 h-4.5 rounded-full border-[1.5px] flex items-center justify-center shrink-0 ${
                  on ? 'bg-[#C9A24A] border-[#C9A24A]' : 'border-[#DED6C4]'
                }`}>
                  {on && <Check className="w-2.5 h-2.5 text-white" strokeWidth={4} />}
                </span>
              </button>
            );
          })}
        </div>
      </PimaSheet>

      <PimaSheet open={datesOpen} onClose={() => setDatesOpen(false)} title="اختر تاريخ الإقامة" icon={<CalendarDays className="w-4 h-4 text-[#C9A24A]" />}>
        {datePicker}
      </PimaSheet>

      <PimaSheet
        open={costOpen}
        onClose={() => setCostOpen(false)}
        title="تفاصيل التكلفة"
        subtitle={`${stayLabel} · ${egp(guestsCount)} فرد`}
        icon={<Wallet className="w-4 h-4 text-[#C9A24A]" />}
      >
        <div className="space-y-1.5">
          {breakdown.map((row, i) => (
            <div key={`${row.label ?? 'base'}-${i}`} className="flex items-center justify-between bg-white border border-[#EDE7DA] rounded-xl px-3 py-2.5">
              <span className="text-[10.5px] font-bold text-[#4A4A3A]">
                {row.label ?? 'السعر الأساسي'}
                <span className="text-[9px] font-medium text-[#8A8A70] mr-1.5">
                  {row.nights === 0 ? 'يوم واحد' : `${egp(row.nights)} ${nightsWord(row.nights)}`} × {egp(guestsCount)} فرد × {egp(row.rate)} ج.م
                </span>
              </span>
              <span className="text-[10.5px] font-black text-[#0A2342] shrink-0">{egp(row.rate * row.nights * guestsCount)} ج.م</span>
            </div>
          ))}
          <div className="flex items-center justify-between pt-2 mt-1 border-t border-[#EDE7DA]">
            <span className="text-[11.5px] font-black text-[#2D2D24]">الإجمالي التقديري</span>
            <span className="text-[14px] font-black text-[#B8944E]">{egp(totalPrice)} ج.م</span>
          </div>
          {totalPrice !== originalTotalPrice && (
            <p className="text-[9.5px] font-medium text-emerald-700 text-left">
              بعد خصم {egp(originalTotalPrice - totalPrice)} ج.م من نقاطك
            </p>
          )}
        </div>
      </PimaSheet>
    </div>
  );
}
