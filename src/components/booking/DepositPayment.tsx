import React, { useEffect, useRef, useState } from 'react';
import { arabicNumber, arabicDateRange, arabicDecimal } from '../../lib/arabic';
import { Booking, RetreatHouse, Payment, User } from '../../types';
import {
  ChevronRight, ChevronLeft, X, ShieldCheck, Copy, Check, UploadCloud, Trash2,
  FileText, Users, CalendarDays, Landmark, Wallet, Home, Clock, Lock, RotateCw, Gem,
} from 'lucide-react';
import { tapFeedback } from '../../lib/haptics';

export type PayMethod = 'instapay' | 'vodafone' | 'bank';

export interface DepositSubmission {
  method: PayMethod;
  proofImage: string;
  reference: string;
}

interface DepositPaymentProps {
  open: boolean;
  booking: Booking;
  house?: RetreatHouse;
  currentUser: User;
  /** What the guest owes now. */
  amount: number;
  /** Where the money goes, per method. Absent = that method is unavailable. */
  payees: Partial<Record<PayMethod, { label: string; value: string }>>;
  onClose: () => void;
  onSubmit: (submission: DepositSubmission) => void;
  /** Leaves the payment and goes home. */
  onGoHome?: () => void;
}

const CARD = 'rounded-[28px] border border-[#EDE7DA] bg-white shadow-[0_8px_24px_rgba(45,45,36,0.06),0_2px_6px_rgba(45,45,36,0.03)]';

const METHODS: { key: PayMethod; label: string; hint: string; glyph: React.ReactNode }[] = [
  {
    key: 'instapay', label: 'InstaPay', hint: 'الأسرع والأكثر استخدامًا',
    glyph: (
      <svg viewBox="0 0 32 32" className="w-6 h-6" aria-hidden="true">
        <rect x="2" y="6" width="28" height="20" rx="5" fill="#6C2BD9" />
        <path d="M12 12h4l-2 8h-4l2-8Z" fill="#FFFFFF" />
        <path d="M19 12h5l-3 4h3l-6 5 2-4h-3l2-5Z" fill="#F5A623" />
      </svg>
    ),
  },
  {
    key: 'vodafone', label: 'Vodafone Cash', hint: 'تحويل مباشر من محفظتك',
    glyph: (
      <svg viewBox="0 0 32 32" className="w-6 h-6" aria-hidden="true">
        <circle cx="16" cy="16" r="13" fill="#E60000" />
        <path d="M20.5 9.5c-4.7.6-8 4-8 7.9 0 2.6 1.6 4.6 4 4.6 3.2 0 5.8-2.9 5.8-6.2 0-2.4-1.3-4-3.2-4.6 0-.6.6-1.3 1.4-1.7Z" fill="#FFFFFF" />
      </svg>
    ),
  },
  {
    key: 'bank', label: 'تحويل بنكي', hint: 'تحويل إلى الحساب البنكي',
    glyph: <Landmark className="w-6 h-6 text-[#B8944E]" />,
  },
];

/**
 * The deposit, as its own screen rather than a form inside the booking sheet.
 *
 * Two steps and a confirmation, because there are only two decisions to make —
 * how to pay, and proving you did. Splitting those further would add ceremony
 * without adding clarity.
 *
 * Nothing here moves money: the guest transfers outside the app and files the
 * proof, which a person then checks. Every word on this screen says so, because
 * a payment screen that implies otherwise is the worst kind of lie.
 */
export default function DepositPayment({
  open, booking, house, currentUser, amount, payees, onClose, onSubmit, onGoHome,
}: DepositPaymentProps) {
  const available = METHODS.filter((m) => payees[m.key]);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [method, setMethod] = useState<PayMethod | null>(available[0]?.key ?? null);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [proof, setProof] = useState('');
  const [proofName, setProofName] = useState('');
  const [proofSize, setProofSize] = useState(0);
  const [reference, setReference] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Escape closes, and the page behind must not scroll while this is up.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  // A fresh open starts at the beginning; a half-filled form from last time
  // would be worse than an empty one.
  useEffect(() => {
    if (open) { setStep(1); setCopied(false); setCopyFailed(false); setProof(''); setProofName(''); setProofSize(0); setReference(''); }
  }, [open]);

  if (!open) return null;

  const payee = method ? payees[method] : undefined;

  const takeFile = (file?: File | null) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert('الحد الأقصى لحجم الملف ١٠ ميجابايت.'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      setProof(String(reader.result || ''));
      setProofName(file.name);
      setProofSize(file.size);
    };
    reader.readAsDataURL(file);
  };

  // The clipboard API rejects in plenty of real situations — an unfocused
  // document, a webview without permission, http on a LAN address. This is a
  // payment address: a button that silently does nothing would have the guest
  // transfer to whatever they half-remember. So fall back to the old
  // selection-and-copy path, and only claim success when something worked.
  const copyPayee = async () => {
    if (!payee) return;
    tapFeedback();
    let ok = false;
    try {
      await navigator.clipboard.writeText(payee.value);
      ok = true;
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = payee.value;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;top:0;left:-9999px';
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand('copy');
        ta.remove();
      } catch { ok = false; }
    }
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      setCopyFailed(true);
      setTimeout(() => setCopyFailed(false), 4000);
    }
  };

  const submit = () => {
    if (!method || !proof) return;
    tapFeedback();
    onSubmit({ method, proofImage: proof, reference: reference.trim() });
    setStep(3);
  };

  // A render function, deliberately NOT a component. Declaring a component
  // inside the render body makes React see a brand-new type on every render and
  // remount the whole header — so the close button becomes a fresh DOM node
  // mid-interaction and a click already in flight lands on the detached one.
  const renderHeader = (showStep?: boolean) => (
    <div className="shrink-0 px-4 pt-4 pb-3 flex items-center gap-2">
      {step === 1 ? (
        <button type="button" onClick={() => { tapFeedback(); onClose(); }} aria-label="رجوع"
          className="w-9 h-9 rounded-xl border border-[#EDE7DA] bg-white flex items-center justify-center text-[#4A4A3A] hover:bg-[#F1ECE0] transition-colors cursor-pointer pima-press">
          <ChevronRight className="w-4 h-4" />
        </button>
      ) : step === 2 ? (
        <button type="button" onClick={() => { tapFeedback(); setStep(1); }} aria-label="رجوع"
          className="w-9 h-9 rounded-xl border border-[#EDE7DA] bg-white flex items-center justify-center text-[#4A4A3A] hover:bg-[#F1ECE0] transition-colors cursor-pointer pima-press">
          <ChevronRight className="w-4 h-4" />
        </button>
      ) : <span className="w-9" />}

      <div className="flex-1 text-center">
        <h2 className="text-[14px] font-black text-[#0A2342]">دفع العربون</h2>
        {showStep && (
          <span className="inline-block mt-1 text-[9.5px] font-black text-[#B8944E] bg-[#FDF9EF] border border-[#EBD9B4] rounded-full px-2.5 py-0.5">
            {arabicNumber(step)} من {arabicNumber(2)}
          </span>
        )}
      </div>

      <button type="button" onClick={() => { tapFeedback(); onClose(); }} aria-label="إغلاق"
        className="w-9 h-9 rounded-xl border border-[#EDE7DA] bg-white flex items-center justify-center text-[#4A4A3A] hover:bg-[#F1ECE0] transition-colors cursor-pointer pima-press">
        {step === 3 ? <X className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4 text-[#C9A24A]" />}
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center" role="dialog" aria-modal="true" aria-label="دفع العربون">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[3px] animate-in fade-in duration-200" onClick={onClose} />

      <div className="relative w-full sm:max-w-md h-[96dvh] sm:h-auto sm:max-h-[94dvh] bg-[#FBF9F4] rounded-t-[28px] sm:rounded-[28px] sm:mb-6 flex flex-col shadow-[0_-8px_40px_rgba(0,0,0,0.2)] animate-in slide-in-from-bottom duration-300 ease-[cubic-bezier(0.33,1,0.68,1)]">
        <span aria-hidden="true" className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-[#DED6C4]" />
        {renderHeader(step !== 3)}

        {/* ── Step one: what is owed, and how it will be paid ── */}
        {step === 1 && (
          <>
            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
              <div className={`${CARD} p-3 pima-rise`}>
                <div className="flex items-center gap-3">
                  {house?.images?.[0] && (
                    <img src={house.images[0]} alt="" referrerPolicy="no-referrer" className="w-[72px] h-[72px] rounded-2xl object-cover shrink-0" />
                  )}
                  <div className="min-w-0 flex-1 leading-tight space-y-1">
                    <span className="block text-[12.5px] font-black text-[#0A2342] truncate">{booking.houseName}</span>
                    <span className="block text-[9px] font-bold text-[#8A8A70]" dir="ltr">#{booking.id.toUpperCase()}</span>
                    <span className="flex items-center gap-1 text-[9.5px] font-bold text-[#4A4A3A]">
                      <CalendarDays className="w-3 h-3 text-[#C9A24A] shrink-0" />
                      {arabicDateRange(booking.checkIn, booking.checkOut)}
                    </span>
                    <span className="flex items-center gap-1 text-[9.5px] font-bold text-[#4A4A3A]">
                      <Users className="w-3 h-3 text-[#C9A24A] shrink-0" />
                      {arabicNumber(booking.guestsCount)} أفراد
                    </span>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-[#EDE7DA] flex items-center justify-between">
                  <span className="text-[10px] font-bold text-[#8A8A70]">مبلغ العربون</span>
                  <span className="text-[20px] font-black text-[#0A2342]">{arabicNumber(amount)} <span className="text-[12px]">ج.م</span></span>
                </div>
              </div>

              {/* Points are shown, not spent. Redeeming against a deposit needs
                  a server-side hold this screen does not have, and a control
                  that appears to discount money without doing so is worse than
                  no control. */}
              {(currentUser.points ?? 0) > 0 && (
                <div className="rounded-[28px] border border-[#EBD9B4] bg-[#FDF9EF] p-3 flex items-center gap-3 pima-rise pima-rise-1">
                  <span className="w-10 h-10 rounded-full bg-white border border-[#EBD9B4] flex items-center justify-center shrink-0">
                    <Gem className="w-[18px] h-[18px] text-[#C9A24A]" />
                  </span>
                  <div className="min-w-0 flex-1 leading-tight">
                    <span className="block text-[11px] font-black text-[#2D2D24]">
                      رصيدك: {arabicNumber(currentUser.points ?? 0)} نقطة بيما
                    </span>
                    <span className="block text-[9.5px] font-medium text-[#8A8A70] mt-0.5">
                      تُخصم النقاط عند إنشاء الحجز، وليست متاحة على العربون.
                    </span>
                  </div>
                </div>
              )}

              <div className="space-y-2 pima-rise pima-rise-2">
                <span className="block text-[11px] font-black text-[#0A2342] px-1">اختر وسيلة الدفع</span>
                {available.length === 0 && (
                  <p className="text-[10.5px] font-medium text-[#8A8A70] bg-white border border-[#EDE7DA] rounded-2xl p-3">
                    لم يحدّد المكان وسيلة استلام بعد. تواصل مع فريق بيما لإتمام الدفع.
                  </p>
                )}
                {available.map((m) => {
                  const on = method === m.key;
                  return (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => { tapFeedback(); setMethod(m.key); }}
                      aria-pressed={on}
                      className={`w-full flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-right transition-[background-color,border-color,transform] duration-200 cursor-pointer pima-press ${
                        on ? 'bg-[#FDF9EF] border-[#C9A24A]' : 'bg-white border-[#EDE7DA] hover:border-[#E3CD9F]'
                      }`}
                    >
                      <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${on ? 'border-[#C9A24A]' : 'border-[#D9D2C2]'}`}>
                        {on && <span className="w-2 h-2 rounded-full bg-[#C9A24A]" />}
                      </span>
                      <span className="flex-1 min-w-0 leading-tight">
                        <span className="block text-[12px] font-black text-[#0A2342]">{m.label}</span>
                        <span className="block text-[9.5px] font-medium text-[#8A8A70] mt-0.5">{m.hint}</span>
                      </span>
                      <span className="shrink-0">{m.glyph}</span>
                    </button>
                  );
                })}
                <p className="flex items-center justify-center gap-1.5 text-[9.5px] font-bold text-[#8A8A70] pt-1">
                  <Lock className="w-3 h-3 text-[#C9A24A]" />
                  بياناتك آمنة ومشفّرة
                </p>
              </div>
            </div>

            <div className="shrink-0 px-4 pb-4 pt-2 bg-[#FBF9F4] border-t border-[#EDE7DA]">
              <button
                type="button"
                disabled={!method}
                onClick={() => { tapFeedback(); setStep(2); }}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-b from-[#C9A96A] to-[#B8944E] disabled:from-[#D9D3C4] disabled:to-[#D9D3C4] text-white font-black text-[13px] py-3.5 rounded-2xl shadow-[0_4px_14px_rgba(184,148,78,0.35)] disabled:shadow-none transition-all cursor-pointer disabled:cursor-not-allowed pima-press"
              >
                متابعة
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </>
        )}

        {/* ── Step two: where to send it, and the proof ── */}
        {step === 2 && payee && (
          <>
            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
              <div className={`${CARD} p-3 flex items-center justify-between gap-2 pima-rise`}>
                <button type="button" onClick={() => { tapFeedback(); setStep(1); }}
                  className="text-[10px] font-black text-[#B8944E] border border-[#EBD9B4] rounded-full px-3 py-1 hover:bg-[#FDF9EF] transition-colors cursor-pointer pima-press">
                  تغيير
                </button>
                <span className="flex items-center gap-2">
                  <span className="text-[12px] font-black text-[#0A2342]">{METHODS.find((m) => m.key === method)?.label}</span>
                  {METHODS.find((m) => m.key === method)?.glyph}
                </span>
              </div>

              <div className="space-y-2 pima-rise pima-rise-1">
                <span className="block text-[11px] font-black text-[#0A2342] px-1">بيانات التحويل</span>
                <div className={`${CARD} p-3.5 space-y-2.5`}>
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={copyPayee}
                      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-black transition-colors cursor-pointer pima-press ${
                        copied ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-[#FDF9EF] border-[#EBD9B4] text-[#B8944E]'
                      }`}
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? 'تم النسخ' : 'نسخ'}
                    </button>
                    <span className="text-[10.5px] font-bold text-[#8A8A70]">قم بتحويل مبلغ العربون إلى</span>
                  </div>
                  {/* Selectable, so a guest whose clipboard is blocked can still
                      take the address by hand. */}
                  <span className="block text-[15px] font-black text-[#0A2342] text-right select-all" dir="ltr">{payee.value}</span>
                  {copyFailed && (
                    <span className="block text-[9.5px] font-bold text-rose-600">
                      تعذّر النسخ التلقائي — اضغط مطوّلًا على العنوان لنسخه يدويًا.
                    </span>
                  )}
                  <p className="flex items-start gap-1.5 text-[9.5px] font-medium text-[#8A8A70] leading-relaxed pt-1 border-t border-[#EDE7DA]">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#C9A24A] shrink-0 mt-0.5" />
                    افتح تطبيق {payee.label} واختر تحويل أموال وأدخل عنوان الدفع أعلاه، ثم أرفق صورة الإيصال هنا.
                  </p>
                </div>
              </div>

              <div className="space-y-2 pima-rise pima-rise-2">
                <span className="block text-[11px] font-black text-[#0A2342] px-1">إرفاق إثبات التحويل</span>

                {!proof ? (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(e) => { e.preventDefault(); setDragging(false); takeFile(e.dataTransfer.files?.[0]); }}
                    className={`w-full rounded-[28px] border-2 border-dashed p-6 flex flex-col items-center gap-2 transition-colors cursor-pointer ${
                      dragging ? 'border-[#C9A24A] bg-[#FDF9EF]' : 'border-[#E3DCCB] bg-white hover:border-[#E3CD9F]'
                    }`}
                  >
                    <UploadCloud className="w-8 h-8 text-[#C9A24A]" />
                    <span className="text-[11px] font-black text-[#2D2D24]">اسحب وأفلت الصورة هنا</span>
                    <span className="text-[10px] font-medium text-[#8A8A70]">أو اختر من جهازك</span>
                    <span className="text-[8.5px] font-medium text-[#B5AF98]">JPG, PNG, PDF · الحد الأقصى ١٠ ميجابايت</span>
                  </button>
                ) : (
                  <div className={`${CARD} p-3 flex items-center gap-3 animate-in fade-in duration-200`}>
                    <span className="w-14 h-14 rounded-xl overflow-hidden bg-[#F1ECE0] shrink-0 flex items-center justify-center">
                      {proof.startsWith('data:image')
                        ? <img src={proof} alt="" className="w-full h-full object-cover" />
                        : <FileText className="w-6 h-6 text-[#B5AF98]" />}
                    </span>
                    <div className="min-w-0 flex-1 leading-tight">
                      <span className="block text-[11px] font-black text-[#0A2342] truncate">{proofName}</span>
                      <span className="block text-[9.5px] font-medium text-[#8A8A70] mt-0.5">
                        {arabicDecimal(proofSize / (1024 * 1024))} ميجابايت
                      </span>
                    </div>
                    <Check className="w-5 h-5 text-emerald-600 shrink-0" />
                    <button type="button" onClick={() => { tapFeedback(); setProof(''); setProofName(''); setProofSize(0); }}
                      aria-label="إزالة الملف" className="text-rose-500 hover:text-rose-700 transition-colors cursor-pointer shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden"
                  onChange={(e) => takeFile(e.target.files?.[0])} />
              </div>

              <div className="space-y-2 pima-rise pima-rise-3">
                <span className="block text-[11px] font-black text-[#0A2342] px-1">رقم المرجع (اختياري)</span>
                <div className={`${CARD} flex items-center gap-2 px-3`}>
                  <FileText className="w-4 h-4 text-[#C9A24A] shrink-0" />
                  <input
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="أدخل رقم المرجع إن وجد"
                    className="flex-1 bg-transparent py-3 text-[11.5px] font-bold text-[#2D2D24] placeholder:text-[#B5AF98] placeholder:font-medium focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="shrink-0 px-4 pb-4 pt-2 bg-[#FBF9F4] border-t border-[#EDE7DA] space-y-2">
              <button
                type="button"
                disabled={!proof}
                onClick={submit}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-b from-[#C9A96A] to-[#B8944E] disabled:from-[#D9D3C4] disabled:to-[#D9D3C4] text-white font-black text-[13px] py-3.5 rounded-2xl shadow-[0_4px_14px_rgba(184,148,78,0.35)] disabled:shadow-none transition-all cursor-pointer disabled:cursor-not-allowed pima-press"
              >
                <Lock className="w-4 h-4" />
                تأكيد إرسال إثبات الدفع
              </button>
              <p className="flex items-center justify-center gap-1.5 text-[9.5px] font-medium text-[#8A8A70]">
                <ShieldCheck className="w-3.5 h-3.5 text-[#C9A24A]" />
                سيتم مراجعة الإثبات والتأكيد خلال ساعات قليلة
              </p>
            </div>
          </>
        )}

        {/* ── Confirmation ── */}
        {step === 3 && (
          <div className="flex-1 overflow-y-auto px-5 pb-5 text-center space-y-5">
            <span className="relative inline-block w-[118px] h-[118px] mt-2">
              {[
                { top: '2%', right: '16%', size: 'w-4 h-4', delay: 640 },
                { top: '14%', left: '10%', size: 'w-3 h-3', delay: 760 },
                { top: '52%', right: '2%', size: 'w-3.5 h-3.5', delay: 880 },
                { top: '64%', left: '4%', size: 'w-3 h-3', delay: 1000 },
              ].map((s, i) => (
                <span key={i} aria-hidden="true" className={`pima-spark absolute ${s.size} rounded-full bg-[#E0A82E]`}
                  style={{ top: s.top, right: s.right, left: s.left, animationDelay: `${s.delay}ms` }} />
              ))}
              <span className="pima-success-glow absolute inset-3 rounded-full bg-[#C9A24A]" />
              <svg viewBox="0 0 100 100" className="relative w-full h-full -rotate-90" aria-hidden="true">
                <circle cx="50" cy="50" r="40" fill="#C9A24A" />
                <path d="M33 51 L45 63 L68 39" fill="none" stroke="#FFFFFF" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" className="pima-check-draw" transform="rotate(90 50 50)" />
              </svg>
            </span>

            <div className="space-y-2">
              <h3 className="text-[18px] font-black text-[#0A2342]">تم إرسال إثبات الدفع بنجاح</h3>
              <p className="text-[11px] font-medium text-[#8A8A70] leading-relaxed">
                تم استلام إثبات الدفع الخاص بك. سيتم مراجعته من قبل فريق بيت المؤتمرات
                وستوافيك بالنتيجة في أقرب وقت.
              </p>
            </div>

            <div className={`${CARD} p-4 text-right space-y-2.5`}>
              <span className="flex items-center gap-1.5 text-[11.5px] font-black text-[#0A2342]">
                <Clock className="w-4 h-4 text-[#C9A24A]" />
                ماذا يحدث الآن
              </span>
              {[
                { label: 'تم استلام إثبات الدفع', icon: Check, done: true },
                { label: 'جارٍ مراجعة إثبات الدفع', icon: RotateCw, done: false },
                { label: 'تأكيد الدفع وتأكيد الحجز', icon: Lock, done: false },
              ].map((s) => (
                <div key={s.label} className="flex items-center justify-between gap-2">
                  <s.icon className={`w-4 h-4 shrink-0 ${s.done ? 'text-emerald-600' : 'text-[#B5AF98]'}`} />
                  <span className={`flex-1 text-[10.5px] font-bold ${s.done ? 'text-[#2D2D24]' : 'text-[#8A8A70]'}`}>{s.label}</span>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => { tapFeedback(); onClose(); }}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-b from-[#C9A96A] to-[#B8944E] text-white font-black text-[13px] py-3.5 rounded-2xl shadow-[0_4px_14px_rgba(184,148,78,0.35)] transition-transform cursor-pointer pima-press"
              >
                <CalendarDays className="w-4 h-4" />
                العودة لتفاصيل الحجز
              </button>
              {onGoHome && (
                <button
                  type="button"
                  onClick={() => { tapFeedback(); onGoHome(); }}
                  className="w-full flex items-center justify-center gap-2 bg-white border border-[#EDE7DA] hover:border-[#E3CD9F] text-[#4A4A3A] font-black text-[12.5px] py-3.5 rounded-2xl transition-colors cursor-pointer pima-press"
                >
                  <Home className="w-4 h-4 text-[#C9A24A]" />
                  العودة للرئيسية
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
