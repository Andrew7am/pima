import React, { useEffect, useState } from 'react';
import { RetreatHouse, User } from '../../types';
import {
  ChevronLeft, ChevronRight, Check, ShieldCheck, CalendarDays, Users, Wallet,
  Star, Send, Clock, FileText, Pencil, Minus, Plus, Building2, Phone, User as UserIcon,
  Mail, MessageSquare, Church, Info, Loader2, Receipt, CreditCard,
} from 'lucide-react';
import { tapFeedback } from '../../lib/haptics';
import PimaSheet from '../PimaSheet';
import { useCountUp } from '../../lib/useCountUp';
import { arabicNumber } from '../../lib/arabic';

export interface ApplicantDetails {
  fullName: string;
  phone: string;
  organization: string;
  diocese: string;
  email: string;
  notes: string;
}

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
  /** Rendered on step 1 — capacity warnings, waitlist, points redemption. */
  notices?: React.ReactNode;
  submitting?: boolean;
  /** Resolves to the booking id on success, or null if it was rejected. */
  onSubmit: (applicant: ApplicantDetails) => Promise<string | null>;
  onRequireLogin?: () => void;
  /** Leaves the flow and returns to the place. */
  onExit: () => void;
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
  depositAmount, breakdown, datePicker, notices, submitting, onSubmit, onRequireLogin, onExit,
}: BookingFlowProps) {
  const [step, setStep] = useState(0);
  const [costOpen, setCostOpen] = useState(false);
  const [datesOpen, setDatesOpen] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);

  const [applicant, setApplicant] = useState<ApplicantDetails>({
    fullName: '', phone: '', organization: '', diocese: '', email: '', notes: '',
  });

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

  const perPerson = nights > 0 && guestsCount > 0 ? Math.round(originalTotalPrice / nights / guestsCount) : 0;
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

  /* ── Success ─────────────────────────────────────────────────────────── */
  if (step === 3 && requestId) {
    const timeline = [
      { label: 'تم إرسال الطلب', done: true, body: 'استلمنا طلبك بنجاح' },
      { label: 'قيد مراجعة المكان', done: false, body: 'يتم مراجعة طلبك من قبل إدارة المكان' },
      { label: 'بانتظار الموافقة', done: false, body: 'ستصلك إشعار بالنتيجة' },
      { label: 'دفع العربون', done: false, body: 'بعد الموافقة على طلبك' },
      { label: 'تم تأكيد الحجز', done: false, body: 'استمتع بإقامتك ✨' },
    ];
    return (
      <div id="pima-booking-flow" className={`${CARD} p-6 text-center space-y-5`}>
        <span className="inline-flex w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-200 items-center justify-center pima-medal-in">
          <Check className="w-8 h-8 text-emerald-600" strokeWidth={3} />
        </span>
        <div className="space-y-1.5">
          <h3 className="text-[17px] font-black text-[#0A2342]">تم إرسال طلبك بنجاح</h3>
          <p className="text-[11px] font-medium text-[#8A8A70] leading-relaxed">
            تم استلام طلبك وسيتم مراجعته من قبل إدارة المكان.
          </p>
        </div>

        <div className="rounded-2xl border border-[#EBD9B4] bg-[#FDF9EF] px-4 py-3 flex items-center justify-between">
          <span className="text-right">
            <span className="block text-[9.5px] font-bold text-[#8A8A70]">رقم الطلب</span>
            <span className="block text-[15px] font-black text-[#B8944E] tracking-wide" dir="ltr">{requestId}</span>
          </span>
          <FileText className="w-5 h-5 text-[#C9A24A]" />
        </div>

        <div className="text-right space-y-0">
          {timeline.map((t, i) => (
            <div key={t.label} className="flex gap-3">
              <div className="flex flex-col items-center shrink-0">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center border-2 ${
                  t.done ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-[#E3DCCB]'
                }`}>
                  {t.done && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                </span>
                {i < timeline.length - 1 && <span className="w-0.5 flex-1 min-h-[26px] bg-[#EDE7DA]" />}
              </div>
              <div className="pb-3 min-w-0">
                <span className={`block text-[11.5px] font-black ${t.done ? 'text-[#0A2342]' : 'text-[#8A8A70]'}`}>{t.label}</span>
                <span className="block text-[9.5px] font-medium text-[#B5AF98] mt-0.5">{t.body}</span>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => { tapFeedback(); onExit(); }}
          className="w-full flex items-center justify-center gap-2 bg-[#0A2342] hover:bg-[#123055] text-white font-black text-[13px] py-4 rounded-2xl transition-colors cursor-pointer pima-press"
        >
          <FileText className="w-4 h-4" />
          متابعة الطلب
        </button>
        <p className="text-[10px] font-medium text-[#8A8A70]">
          تتابع حالة الطلب من صفحة «حجوزاتي».
        </p>
      </div>
    );
  }

  /* ── Shared: the stay summary used on steps 2 and 3 ───────────────────── */
  const summaryRows = [
    { icon: <Building2 className="w-4 h-4" />, label: 'المكان', value: house.name, sub: house.governorate },
    { icon: <CalendarDays className="w-4 h-4" />, label: 'التاريخ', value: `${shortDate(checkIn)} — ${shortDate(checkOut)}`, sub: `${egp(nights)} ${nightsWord(nights)}` },
    { icon: <Users className="w-4 h-4" />, label: 'عدد الحضور', value: `${egp(guestsCount)} فرد`, sub: '' },
    { icon: <FileText className="w-4 h-4" />, label: 'نوع الحجز', value: isQuoteMode ? 'مؤتمر كبير' : 'حجز عادي', sub: '' },
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
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[11px] font-black text-[#2D2D24]">
                <CalendarDays className="w-4 h-4 text-[#C9A24A]" />
                تاريخ الإقامة
              </span>
              <button
                type="button"
                onClick={() => { tapFeedback(); setDatesOpen(true); }}
                className="text-[10px] font-black text-[#B8944E] border border-[#EBD9B4] rounded-full px-3 py-0.5 hover:bg-[#FDF9EF] transition-colors cursor-pointer pima-press"
              >
                تغيير
              </button>
            </div>
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
                <span className="text-[22px] font-black text-[#0A2342] min-w-[44px] text-center [font-variant-numeric:tabular-nums]">{egp(guestsCount)}</span>
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

          {/* Type */}
          <div className={`${CARD} p-3 space-y-2`}>
            <span className="text-[11px] font-black text-[#2D2D24]">نوع الحجز</span>
            <div className="grid grid-cols-2 gap-2">
              {[{ q: false, label: 'حجز عادي' }, { q: true, label: 'مؤتمر كبير' }].map((o) => (
                <button
                  key={o.label}
                  type="button"
                  onClick={() => { tapFeedback(); setIsQuoteMode(o.q); }}
                  aria-pressed={isQuoteMode === o.q}
                  className={`rounded-xl py-1.5 text-[11px] font-black border transition-colors duration-[250ms] cursor-pointer pima-press flex items-center justify-center gap-1.5 ${
                    isQuoteMode === o.q
                      ? 'bg-[#FDF9EF] border-[#C9A24A] text-[#B8944E]'
                      : 'bg-white border-[#EDE7DA] text-[#8A8A70] hover:border-[#E3CD9F]'
                  }`}
                >
                  {isQuoteMode === o.q && <Check className="w-3 h-3" strokeWidth={3} />}
                  {o.label}
                </button>
              ))}
            </div>
          </div>

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
                    {egp(nights)} {nightsWord(nights)} · {egp(guestsCount)} فرد × {egp(perPerson)} ج.م
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
      <PimaSheet open={datesOpen} onClose={() => setDatesOpen(false)} title="اختر تاريخ الإقامة" icon={<CalendarDays className="w-4 h-4 text-[#C9A24A]" />}>
        {datePicker}
      </PimaSheet>

      <PimaSheet
        open={costOpen}
        onClose={() => setCostOpen(false)}
        title="تفاصيل التكلفة"
        subtitle={`${egp(nights)} ${nightsWord(nights)} · ${egp(guestsCount)} فرد`}
        icon={<Wallet className="w-4 h-4 text-[#C9A24A]" />}
      >
        <div className="space-y-1.5">
          {breakdown.map((row, i) => (
            <div key={`${row.label ?? 'base'}-${i}`} className="flex items-center justify-between bg-white border border-[#EDE7DA] rounded-xl px-3 py-2.5">
              <span className="text-[10.5px] font-bold text-[#4A4A3A]">
                {row.label ?? 'السعر الأساسي'}
                <span className="text-[9px] font-medium text-[#8A8A70] mr-1.5">
                  {egp(row.nights)} {nightsWord(row.nights)} × {egp(guestsCount)} فرد × {egp(row.rate)} ج.م
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
