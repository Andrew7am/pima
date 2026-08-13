import React, { useEffect, useState } from 'react';
import {
  X, ChevronLeft, ChevronRight, MapPin, Users, CalendarDays, Tag, Star, Waves,
  Search, Check, RotateCcw, Sun,
} from 'lucide-react';
import { GOVERNORATES, AMENITIES_LIST } from '../mockData';
import { useDialogFocus } from '../lib/useDialogFocus';
import { tapFeedback } from '../lib/haptics';

export type SeaProximity = 'all' | 'near' | 'view' | 'beach' | 'far';

// Everything the sheet can change. The parent owns the committed values; the
// sheet edits a private copy and only hands it back on "عرض النتائج", so
// backing out of the wizard cannot half-apply a search.
export interface FilterDraft {
  governorate: string;
  guestCount: number | '';
  checkIn: string;
  checkOut: string;
  maxPrice: number;
  amenities: string[];
  seaProximity: SeaProximity;
  /** Only houses that host a «يوم روحي» — arrive and leave the same day. */
  dayUseOnly: boolean;
}

interface FilterSheetProps {
  open: boolean;
  value: FilterDraft;
  /** How many houses the draft currently matches — drives the CTA's count. */
  matchCount: number;
  /** Called as the draft changes so the parent can recount live. */
  onPreview: (draft: FilterDraft) => void;
  onApply: (draft: FilterDraft) => void;
  onClose: () => void;
}

type Step = 'menu' | 'place' | 'guests' | 'dates' | 'budget' | 'amenities' | 'done';

// Wizard order, used for the "خطوة N من ٦" counter and the progress bar.
const WIZARD: Exclude<Step, 'menu' | 'done'>[] = ['place', 'guests', 'dates', 'budget', 'amenities'];

const SEA_OPTIONS: { key: SeaProximity; label: string }[] = [
  { key: 'all', label: 'الكل' },
  { key: 'beach', label: 'مباشر على البحر' },
  { key: 'view', label: 'إطلالة على البحر' },
  { key: 'near', label: 'قريب من البحر' },
  { key: 'far', label: 'بعيد عن البحر' },
];

const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const WEEKDAYS = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const nights = (a: string, b: string) =>
  a && b && a < b ? Math.round((new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / 86400000) : 0;
const prettyDate = (s: string) => {
  if (!s) return '';
  const d = new Date(`${s}T00:00:00`);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

export default function FilterSheet({ open, value, matchCount, onPreview, onApply, onClose }: FilterSheetProps) {
  const panelRef = useDialogFocus<HTMLDivElement>(open, onClose);
  const [step, setStep] = useState<Step>('menu');
  const [draft, setDraft] = useState<FilterDraft>(value);
  const [month, setMonth] = useState(() => new Date());
  const [amenityQuery, setAmenityQuery] = useState('');

  // Re-seed from the committed values every time the sheet opens, so a sheet
  // that was closed without applying does not resurrect its abandoned draft.
  useEffect(() => {
    if (open) { setDraft(value); setStep('menu'); setAmenityQuery(''); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Escape closes, and the page behind must not scroll while the sheet is up.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  if (!open) return null;

  const patch = (p: Partial<FilterDraft>) => {
    const next = { ...draft, ...p };
    setDraft(next);
    onPreview(next); // keeps the CTA's count honest as the draft changes
  };

  const go = (s: Step) => { tapFeedback(); setStep(s); };
  const stepIndex = WIZARD.indexOf(step as never);
  const isWizard = stepIndex >= 0;

  const reset = () => {
    tapFeedback();
    const cleared: FilterDraft = {
      governorate: '', guestCount: '', checkIn: '', checkOut: '',
      maxPrice: 400, amenities: [], seaProximity: 'all', dayUseOnly: false,
    };
    setDraft(cleared);
    onPreview(cleared);
  };

  // ── Summary chips ───────────────────────────────────────────────────────
  // Only what the guest actually set: an unset filter is not a chip reading
  // "الكل", it is simply absent.
  const chips: { icon: React.ReactNode; label: string }[] = [];
  if (draft.governorate) chips.push({ icon: <MapPin className="w-3 h-3" />, label: draft.governorate });
  if (draft.guestCount) chips.push({ icon: <Users className="w-3 h-3" />, label: `${draft.guestCount} فرد` });
  const n = nights(draft.checkIn, draft.checkOut);
  if (n) chips.push({ icon: <CalendarDays className="w-3 h-3" />, label: `${n} ${n === 1 ? 'ليلة' : n === 2 ? 'ليلتين' : 'ليالٍ'}` });
  if (draft.maxPrice !== 400) chips.push({ icon: <Tag className="w-3 h-3" />, label: `حتى ${draft.maxPrice} ج.م` });
  if (draft.amenities.length) chips.push({ icon: <Star className="w-3 h-3" />, label: `${draft.amenities.length} خدمات` });
  if (draft.dayUseOnly) chips.push({ icon: <Sun className="w-3 h-3" />, label: 'يوم روحي' });
  if (draft.seaProximity !== 'all') {
    chips.push({ icon: <Waves className="w-3 h-3" />, label: SEA_OPTIONS.find((o) => o.key === draft.seaProximity)!.label });
  }

  const rows = [
    { step: 'place' as Step, icon: <MapPin className="w-4 h-4" />, title: 'المكان',
      sub: draft.governorate ? `${draft.governorate}${draft.seaProximity !== 'all' ? ` · ${SEA_OPTIONS.find((o) => o.key === draft.seaProximity)!.label}` : ''}` : 'اختر المحافظة والموقع' },
    { step: 'guests' as Step, icon: <Users className="w-4 h-4" />, title: 'عدد الأفراد',
      sub: draft.guestCount ? `${draft.guestCount} فرد` : 'كم فرد في مجموعتك؟' },
    { step: 'dates' as Step, icon: <CalendarDays className="w-4 h-4" />, title: 'التواريخ',
      sub: n ? `${prettyDate(draft.checkIn)} - ${prettyDate(draft.checkOut)} (${n} ${n === 1 ? 'ليلة' : n === 2 ? 'ليلتين' : 'ليالٍ'})` : 'اختر تاريخ الوصول والمغادرة' },
    { step: 'budget' as Step, icon: <Tag className="w-4 h-4" />, title: 'الميزانية',
      sub: draft.dayUseOnly
        ? (draft.maxPrice !== 400 ? `حتى ${draft.maxPrice} ج.م · يوم روحي` : 'يوم روحي بدون مبيت')
        : (draft.maxPrice !== 400 ? `حتى ${draft.maxPrice} ج.م لليلة` : 'أقصى سعر لليلة للفرد') },
    { step: 'amenities' as Step, icon: <Star className="w-4 h-4" />, title: 'الخدمات والمرافق',
      sub: draft.amenities.length ? `${draft.amenities.length} خدمات محددة` : 'واي فاي، مسبح، جراج...' },
  ];

  const goldCta = 'w-full flex items-center justify-center gap-2 bg-gradient-to-b from-[#C9A96A] to-[#B8944E] text-white font-black rounded-2xl py-3.5 text-[13px] shadow-[0_8px_24px_rgba(0,0,0,0.08),0_2px_6px_rgba(0,0,0,0.03)] pima-press';

  // ── Calendar ────────────────────────────────────────────────────────────
  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const lead = monthStart.getDay();
  const today = iso(new Date());

  const pickDay = (day: number) => {
    const picked = iso(new Date(month.getFullYear(), month.getMonth(), day));
    tapFeedback();
    // First tap sets arrival; a later date completes the range; anything else
    // starts a new range rather than silently doing nothing.
    if (!draft.checkIn || (draft.checkIn && draft.checkOut)) patch({ checkIn: picked, checkOut: '' });
    else if (picked > draft.checkIn) patch({ checkOut: picked });
    else patch({ checkIn: picked, checkOut: '' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label="فلتر البحث">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px] animate-in fade-in duration-200" onClick={onClose} />

      <div ref={panelRef} className="relative w-full sm:max-w-md bg-[#FBF9F4] rounded-t-[28px] sm:rounded-[28px] sm:mb-6 max-h-[92dvh] flex flex-col shadow-[0_-8px_40px_rgba(0,0,0,0.18)] outline-none animate-in slide-in-from-bottom duration-300 ease-[cubic-bezier(0.33,1,0.68,1)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>

        {/* Grab handle + header */}
        <div className="shrink-0 pt-2.5">
          <div aria-hidden="true" className="w-10 h-1 rounded-full bg-[#D9D2C2] mx-auto" />
          <div className="flex items-center justify-between px-5 pt-3 pb-2">
            {isWizard || step === 'done' ? (
              <button onClick={() => go(step === 'done' ? 'menu' : 'menu')} aria-label="رجوع" className="p-1.5 -mr-1.5 rounded-full hover:bg-[#F1ECE0] pima-press">
                <ChevronRight className="w-5 h-5 text-[#4A4A3A]" />
              </button>
            ) : <span className="w-8" />}
            <h2 className="text-[15px] font-black text-[#2D2D24]">
              {step === 'menu' ? 'فلتر البحث'
                : step === 'place' ? 'المكان'
                : step === 'guests' ? 'عدد الأفراد'
                : step === 'dates' ? 'التواريخ'
                : step === 'budget' ? 'الميزانية'
                : step === 'amenities' ? 'الخدمات والمرافق'
                : 'تم ضبط الفلتر'}
            </h2>
            <button onClick={onClose} aria-label="إغلاق" className="p-1.5 -ml-1.5 rounded-full hover:bg-[#F1ECE0] pima-press">
              <X className="w-5 h-5 text-[#4A4A3A]" />
            </button>
          </div>

          {isWizard && (
            <div className="px-5 pb-3">
              <div className="flex items-center justify-between text-[9.5px] font-bold text-[#8A8A70] mb-1.5">
                <span>خطوة {stepIndex + 1} من {WIZARD.length}</span>
              </div>
              <div className="h-1 rounded-full bg-[#EDE7DA] overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-l from-[#C9A96A] to-[#B8944E] transition-[width] duration-[250ms] ease-[cubic-bezier(0.33,1,0.68,1)]"
                  style={{ width: `${((stepIndex + 1) / WIZARD.length) * 100}%` }} />
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-5 space-y-3">
          <h3 className="text-[13px] font-black text-[#4A4A3A] pt-2">المكان</h3>
          {(
            <>
              <div>
                <span className="block text-[11.5px] font-black text-[#2D2D24] mb-2">المحافظة</span>
                {/* A closed select, not twenty-seven chips. As its own wizard
                    step the grid filled the screen and read fine; stacked with
                    four other sections it is a wall of buttons that pushes
                    everything else past the fold before any filtering starts. */}
                <select
                  value={draft.governorate}
                  onChange={(e) => { tapFeedback(); patch({ governorate: e.target.value }); }}
                  className="w-full bg-white border border-[#EDE7DA] rounded-xl px-3 py-3 text-[12.5px] font-bold text-[#4A4A3A] min-h-11 focus:outline-none focus:border-[#C9A96A]">
                  <option value="">كل المحافظات</option>
                  {GOVERNORATES.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <span className="block text-[11.5px] font-black text-[#2D2D24] mb-2 mt-1">الموقع بالنسبة للبحر</span>
                <div className="bg-white border border-[#EDE7DA] rounded-2xl divide-y divide-[#EDE7DA] overflow-hidden">
                  {SEA_OPTIONS.map((o) => (
                    <button key={o.key} onClick={() => { tapFeedback(); patch({ seaProximity: o.key }); }}
                      className="w-full flex items-center justify-between px-3.5 py-2.5 text-[11px] font-bold text-[#4A4A3A] pima-press">
                      <span>{o.label}</span>
                      <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors duration-[250ms] ${
                        draft.seaProximity === o.key ? 'border-[#B8944E]' : 'border-[#D9D2C2]'}`}>
                        {draft.seaProximity === o.key && <span className="w-2 h-2 rounded-full bg-[#B8944E]" />}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <h3 className="text-[13px] font-black text-[#4A4A3A] pt-2">عدد الأفراد</h3>
          {(
            <div className="bg-white border border-[#EDE7DA] rounded-2xl p-5 text-center shadow-[0_8px_24px_rgba(0,0,0,0.08),0_2px_6px_rgba(0,0,0,0.03)]">
              <span className="block text-[11px] font-bold text-[#8A8A70] mb-3">كم فرد في مجموعتك؟</span>
              <div className="flex items-center justify-center gap-5">
                <button aria-label="أقل" onClick={() => { tapFeedback(); patch({ guestCount: Math.max(0, (Number(draft.guestCount) || 0) - 5) || '' }); }}
                  className="w-11 h-11 rounded-full bg-[#F6F0E2] text-[#B8944E] text-xl font-black pima-press">−</button>
                {/* Typeable. The steppers move in fives, so a group of 76 was
                    sixteen taps away and a group of 3 was unreachable. */}
                <input
                  type="number" inputMode="numeric" min={0} max={999}
                  aria-label="عدد الأفراد"
                  value={draft.guestCount === '' ? '' : draft.guestCount}
                  placeholder="—"
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^\d]/g, '');
                    patch({ guestCount: v === '' ? '' : Math.min(999, parseInt(v, 10)) });
                  }}
                  className="w-[4ch] bg-transparent text-center text-[34px] font-black text-[#2D2D24] leading-none border-0 border-b border-transparent focus:border-[#C9A96A] focus:outline-none p-0" />
                <button aria-label="أكثر" onClick={() => { tapFeedback(); patch({ guestCount: (Number(draft.guestCount) || 0) + 5 }); }}
                  className="w-11 h-11 rounded-full bg-[#F6F0E2] text-[#B8944E] text-xl font-black pima-press">+</button>
              </div>
              <span className="block text-[10px] font-bold text-[#8A8A70] mt-3">فرد</span>
              <div className="flex flex-wrap justify-center gap-1.5 mt-4">
                {[5, 10, 25, 50, 100].map((v) => (
                  <button key={v} onClick={() => { tapFeedback(); patch({ guestCount: v }); }}
                    className={`rounded-full border px-3 py-1 text-[10px] font-bold transition-all duration-[250ms] pima-press ${
                      draft.guestCount === v ? 'bg-[#F6F0E2] border-[#C9A96A] text-[#2D2D24]' : 'bg-white border-[#EDE7DA] text-[#4A4A3A]'}`}>{v}</button>
                ))}
              </div>
            </div>
          )}

          <h3 className="text-[13px] font-black text-[#4A4A3A] pt-2">التواريخ</h3>
          {(
            <div className="bg-white border border-[#EDE7DA] rounded-2xl p-3.5 shadow-[0_8px_24px_rgba(0,0,0,0.08),0_2px_6px_rgba(0,0,0,0.03)]">
              <div className="grid grid-cols-2 gap-2 mb-3">
                {[{ l: 'تاريخ الوصول', v: draft.checkIn }, { l: 'تاريخ المغادرة', v: draft.checkOut }].map((f) => (
                  <div key={f.l} className={`rounded-xl border px-3 py-2 text-center ${f.v ? 'bg-[#F6F0E2] border-[#C9A96A]' : 'bg-[#FBF9F4] border-[#EDE7DA]'}`}>
                    <span className="block text-[9px] font-bold text-[#8A8A70]">{f.l}</span>
                    <span className="block text-[15px] font-black text-[#2D2D24] leading-tight mt-0.5">{f.v ? new Date(`${f.v}T00:00:00`).getDate() : '—'}</span>
                    <span className="block text-[9px] font-bold text-[#8A8A70]">{f.v ? `${MONTHS[new Date(`${f.v}T00:00:00`).getMonth()]} ${new Date(`${f.v}T00:00:00`).getFullYear()}` : ''}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between mb-2">
                <button aria-label="الشهر السابق" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="p-1 rounded-full hover:bg-[#F1ECE0] pima-press"><ChevronRight className="w-4 h-4 text-[#4A4A3A]" /></button>
                <span className="text-[11.5px] font-black text-[#2D2D24]">{MONTHS[month.getMonth()]} {month.getFullYear()}</span>
                <button aria-label="الشهر التالي" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="p-1 rounded-full hover:bg-[#F1ECE0] pima-press"><ChevronLeft className="w-4 h-4 text-[#4A4A3A]" /></button>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center">
                {WEEKDAYS.map((d) => <span key={d} className="text-[8.5px] font-bold text-[#B5AF98] py-1">{d.charAt(0)}</span>)}
                {Array.from({ length: lead }).map((_, i) => <span key={`lead-${i}`} />)}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const d = iso(new Date(month.getFullYear(), month.getMonth(), day));
                  const past = d < today;
                  const isStart = d === draft.checkIn;
                  const isEnd = d === draft.checkOut;
                  const inRange = draft.checkIn && draft.checkOut && d > draft.checkIn && d < draft.checkOut;
                  return (
                    <button key={day} disabled={past} onClick={() => pickDay(day)}
                      className={`h-8 rounded-lg text-[11px] font-bold transition-colors duration-[250ms] ${
                        past ? 'text-[#D9D2C2] cursor-not-allowed'
                          : isStart || isEnd ? 'bg-gradient-to-b from-[#C9A96A] to-[#B8944E] text-white'
                          : inRange ? 'bg-[#F6F0E2] text-[#2D2D24]'
                          : 'text-[#4A4A3A] hover:bg-[#F1ECE0]'}`}>{day}</button>
                  );
                })}
              </div>

              {n > 0 && (
                <p className="mt-3 text-center text-[10px] font-bold text-[#8A8A70] bg-[#FBF9F4] border border-[#EDE7DA] rounded-xl py-2">
                  المدة: {n} {n === 1 ? 'ليلة' : n === 2 ? 'ليلتين' : 'ليالٍ'}
                </p>
              )}
            </div>
          )}

          <h3 className="text-[13px] font-black text-[#4A4A3A] pt-2">الميزانية</h3>
          {(
            <div className="bg-white border border-[#EDE7DA] rounded-2xl p-5 text-center shadow-[0_8px_24px_rgba(0,0,0,0.08),0_2px_6px_rgba(0,0,0,0.03)]">
              <span className="block text-[11px] font-bold text-[#8A8A70]">اختر الحد الأقصى للسعر لليلة الواحدة</span>
              {/* Typeable too. Dragging a slider to an exact budget is fiddly,
                  and 700 is its ceiling — a house above that was unaskable. */}
              <span className="flex items-baseline justify-center gap-1 mt-2">
                <input
                  type="number" inputMode="numeric" min={100} max={5000} step={10}
                  aria-label="أقصى سعر لليلة للفرد"
                  value={draft.maxPrice}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^\d]/g, '');
                    patch({ maxPrice: v === '' ? 100 : Math.min(5000, Math.max(0, parseInt(v, 10))) });
                  }}
                  className="w-[5ch] bg-transparent text-center text-[32px] font-black text-[#2D2D24] leading-none border-0 border-b border-transparent focus:border-[#C9A96A] focus:outline-none p-0" />
                <span className="text-[13px] font-bold text-[#8A8A70]">ج.م</span>
              </span>
              <input type="range" min={100} max={700} step={10} value={draft.maxPrice}
                onChange={(e) => patch({ maxPrice: parseInt(e.target.value) })}
                className="w-full mt-5 accent-[#B8944E] cursor-pointer" />
              <div className="flex justify-between text-[8.5px] font-bold text-[#B5AF98] mt-1">
                {[100, 200, 300, 400, 500, 600, '+700'].map((t) => <span key={String(t)}>{t}</span>)}
              </div>

              {/* Sits with the budget because it is a question about what the
                  stay costs: a day retreat is priced apart from the night. */}
              <button type="button" onClick={() => { tapFeedback(); patch({ dayUseOnly: !draft.dayUseOnly }); }}
                aria-pressed={draft.dayUseOnly}
                className={`w-full mt-5 flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-right transition-colors duration-200 pima-press ${
                  draft.dayUseOnly ? 'bg-[#FDF9EF] border-[#C9A24A]' : 'bg-white border-[#EDE7DA]'}`}>
                <span className={`w-9 h-9 rounded-full border flex items-center justify-center shrink-0 ${
                  draft.dayUseOnly ? 'bg-white border-[#EBD9B4]' : 'bg-[#F6F0E2] border-[#EDE7DA]'}`}>
                  <Sun className={`w-4 h-4 ${draft.dayUseOnly ? 'text-[#B8944E]' : 'text-[#8A8A70]'}`} />
                </span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className={`block text-[11.5px] font-black ${draft.dayUseOnly ? 'text-[#B8944E]' : 'text-[#2D2D24]'}`}>يوم روحي بدون مبيت</span>
                  <span className="block text-[9.5px] font-medium text-[#8A8A70] mt-0.5">البيوت التي تستقبل مجموعات ليوم واحد</span>
                </span>
                <span className={`w-5 h-5 rounded-full border-[1.5px] flex items-center justify-center shrink-0 ${
                  draft.dayUseOnly ? 'bg-[#C9A24A] border-[#C9A24A]' : 'border-[#DED6C4]'}`}>
                  {draft.dayUseOnly && <Check className="w-3 h-3 text-white" strokeWidth={3.5} />}
                </span>
              </button>
            </div>
          )}

          <h3 className="text-[13px] font-black text-[#4A4A3A] pt-2">الخدمات والمرافق</h3>
          {(
            <>
              <div className="relative">
                <Search className="absolute top-1/2 -translate-y-1/2 right-3 w-4 h-4 text-[#B5AF98] pointer-events-none" />
                <input value={amenityQuery} onChange={(e) => setAmenityQuery(e.target.value)} placeholder="ابحث عن خدمة"
                  className="w-full bg-white border border-[#EDE7DA] rounded-2xl py-2.5 pr-9 pl-3 text-[11px] text-[#2D2D24] placeholder:text-[#B5AF98] focus:outline-none" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {AMENITIES_LIST.filter((a) => a.includes(amenityQuery.trim())).map((a) => {
                  const on = draft.amenities.includes(a);
                  return (
                    <button key={a} onClick={() => { tapFeedback(); patch({ amenities: on ? draft.amenities.filter((x) => x !== a) : [...draft.amenities, a] }); }}
                      className={`relative rounded-2xl border px-2 py-3 text-[9.5px] font-bold leading-tight transition-all duration-[250ms] ease-[cubic-bezier(0.33,1,0.68,1)] pima-press ${
                        on ? 'bg-[#F6F0E2] border-[#C9A96A] text-[#2D2D24]' : 'bg-white border-[#EDE7DA] text-[#4A4A3A]'}`}>
                      {on && <Check aria-hidden="true" className="absolute top-1.5 left-1.5 w-3.5 h-3.5 text-[#0A2342] bg-[#B8944E] rounded-full p-0.5" />}
                      {a}
                    </button>
                  );
                })}
              </div>
              {draft.amenities.length > 0 && (
                <div className="flex items-center justify-between bg-white border border-[#EDE7DA] rounded-2xl px-3.5 py-2.5">
                  <button onClick={() => { tapFeedback(); patch({ amenities: [] }); }} className="text-[10px] font-black text-rose-600 pima-press">مسح الكل</button>
                  <span className="text-[10px] font-bold text-[#8A8A70]">{draft.amenities.length} خدمات محددة</span>
                </div>
              )}
            </>
          )}

          {step === 'done' && (
            <div className="text-center py-6">
              <span className="inline-flex w-14 h-14 rounded-full bg-emerald-50 items-center justify-center mb-3">
                <Check className="w-7 h-7 text-emerald-600" />
              </span>
              <p className="text-[14px] font-black text-[#2D2D24]">تم ضبط الفلتر</p>
              <p className="text-[11px] font-bold text-[#8A8A70] mt-1">
                وجدنا <span className="text-[#C5A059] font-black">{matchCount}</span> بيتًا يناسب بحثك
              </p>
              {chips.length > 0 && (
                <div className="flex flex-wrap justify-center gap-1.5 mt-4">
                  {chips.map((c, i) => (
                    <span key={i} className="flex items-center gap-1 bg-white border border-[#EDE7DA] rounded-full px-2.5 py-1 text-[10px] font-bold text-[#4A4A3A]">
                      <span className="text-[#C5A059]">{c.icon}</span>{c.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 px-5 pb-4 pt-1 bg-gradient-to-t from-[#FBF9F4] via-[#FBF9F4] to-transparent">
          {step === 'menu' || step === 'done' ? (
            <button onClick={() => { tapFeedback(); onApply(draft); }} className={goldCta} disabled={matchCount === 0}
              style={matchCount === 0 ? { opacity: 0.55 } : undefined}>
              <Search className="w-4 h-4" />
              {/* Arabic counts do not read "0 بيتًا" — and offering to show a
                  result set the sheet already knows is empty is a dead end. */}
              <span>{matchCount === 0 ? 'لا يوجد بيت بهذه الفلاتر' : `عرض ${matchCount} بيتًا`}</span>
            </button>
          ) : (
            <button
              onClick={() => {
                tapFeedback();
                // Last wizard step lands on the confirmation rather than
                // dropping back to the menu with no sense of having finished.
                setStep(stepIndex === WIZARD.length - 1 ? 'done' : WIZARD[stepIndex + 1]);
              }}
              className={goldCta}
            >
              التالي
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
