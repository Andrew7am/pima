import React, { useState } from 'react';
import { ShieldCheck, Loader2, Check } from 'lucide-react';
import { RetreatHouse, PlatformSettings } from '../../types';
import { resolvePolicy } from '../../lib/bookingPolicy';
import { updateHousePolicy } from '../../lib/db';
import { arabicNumber } from '../../lib/arabic';

interface Props {
  house: RetreatHouse;
  settings: PlatformSettings;
  /** Local-state merge after a successful save. The write already happened here. */
  onSaved?: (houseId: string, patch: Partial<RetreatHouse>) => void;
  /** Which token set to wear. The logic is identical; only the skin differs, so
   *  the admin gets the same editor rather than a second implementation. */
  variant?: 'owner' | 'admin';
}

const SKIN = {
  owner: {
    field: 'w-full bg-[var(--color-owner-surface)] border border-[var(--color-owner-border)] text-[11px] px-2 min-h-11.5 rounded-xl text-[var(--color-owner-text)] focus:outline-none focus:border-[var(--color-owner-primary)] transition-colors',
    rule: 'border-[var(--color-owner-border)]', icon: 'text-[var(--color-owner-primary)]',
    title: 'text-[var(--color-owner-text)]', muted: 'text-[var(--color-owner-secondary)]',
    panel: 'bg-[var(--color-owner-hover)] border-[var(--color-owner-border)] text-[var(--color-owner-text)]',
    btn: 'bg-[var(--color-owner-primary)] hover:bg-[var(--color-owner-primary-hover)] text-[var(--color-owner-on-primary)]',
  },
  admin: {
    field: 'w-full bg-[var(--ds-surface)] border border-[var(--ds-border)] text-[11px] px-2 min-h-11 rounded-xl text-[var(--ds-text)] focus:outline-none focus:border-[var(--ds-primary)] transition-colors',
    rule: 'border-[var(--ds-border)]', icon: 'text-[var(--ds-accent)]',
    title: 'text-[var(--ds-brand)]', muted: 'text-[var(--ds-text-2)]',
    panel: 'bg-[var(--ds-raised)] border-[var(--ds-border)] text-[var(--ds-text)]',
    btn: 'bg-[var(--ds-primary)] hover:bg-[var(--ds-primary)] text-[var(--ds-on-primary)]',
  },
} as const;

/** Empty means "inherit the platform value" — not zero. */
const toNum = (s: string): number | null => {
  const t = s.trim();
  if (t === '') return null;
  const n = Number(t.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))));
  return Number.isFinite(n) ? n : null;
};
const fromNum = (n: number | undefined) => (n === undefined || n === null ? '' : String(n));

/**
 * The owner's own booking terms (migration 0128).
 *
 * Every field may be left blank, and blank is a real answer: it means this
 * house follows the platform's default, and the placeholder shows what that
 * default currently is. That is why the inputs are not pre-filled with the
 * platform numbers — typing nothing and inheriting 7 days is a different fact
 * from choosing 7 days, and only the first keeps following the platform when
 * the platform changes.
 *
 * Saves directly, not through the pending-edit review queue: these are the
 * owner's own commercial terms and carry no listing claim for an admin to
 * check. The database agrees — protect_house_owner_updates lets an owner write
 * exactly these five columns and nothing else.
 */
export default function OwnerBookingPolicy({ house, settings, onSaved, variant = 'owner' }: Props) {
  const S = SKIN[variant];
  const FIELD = S.field;
  const [free, setFree] = useState(() => fromNum(house.freeCancelDays));
  const [partial, setPartial] = useState(() => fromNum(house.partialRefundDays));
  const [pct, setPct] = useState(() => fromNum(house.partialRefundPct != null ? Math.round(house.partialRefundPct * 100) : undefined));
  const [childAge, setChildAge] = useState(() => fromNum(house.childFreeUnderAge));
  const [notes, setNotes] = useState(house.bookingPolicyNotes ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // What a guest will actually be shown, given what is typed right now.
  const preview = resolvePolicy({
    freeCancelDays: toNum(free) ?? undefined,
    partialRefundDays: toNum(partial) ?? undefined,
    partialRefundPct: toNum(pct) != null ? (toNum(pct) as number) / 100 : undefined,
    childFreeUnderAge: toNum(childAge) ?? undefined,
    bookingPolicyNotes: notes,
  } as RetreatHouse, settings);

  const save = async () => {
    setSaving(true); setError(null); setSaved(false);
    const rawPct = toNum(pct);
    const patch = {
      freeCancelDays: toNum(free),
      partialRefundDays: toNum(partial),
      partialRefundPct: rawPct == null ? null : rawPct / 100,
      childFreeUnderAge: toNum(childAge),
      bookingPolicyNotes: notes.trim() || null,
    };
    const res = await updateHousePolicy(house.id, patch);
    setSaving(false);
    if (!res.ok) {
      setError(
        res.error === 'INVALID_POLICY_WINDOW'
          ? 'مدة الاسترداد الجزئي لازم تكون أقل من أو تساوي مدة الاسترداد الكامل.'
          : res.error === 'INVALID_REFUND_PCT' ? 'نسبة الاسترداد لازم تكون بين ٠٪ و ١٠٠٪.'
          : res.error === 'INVALID_CHILD_AGE' ? 'سن الطفل لازم يكون بين ٠ و ١٧ سنة.'
          : 'تعذّر الحفظ. حاول مرة أخرى.'
      );
      return;
    }
    setSaved(true);
    onSaved?.(house.id, {
      freeCancelDays: patch.freeCancelDays ?? undefined,
      partialRefundDays: patch.partialRefundDays ?? undefined,
      partialRefundPct: patch.partialRefundPct ?? undefined,
      childFreeUnderAge: patch.childFreeUnderAge ?? undefined,
      bookingPolicyNotes: patch.bookingPolicyNotes ?? undefined,
    });
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className={`space-y-2 pt-3 border-t ${S.rule}`}>
      <div className="flex items-center gap-1.5">
        <ShieldCheck className={`w-3.5 h-3.5 ${S.icon}`} />
        <span className={`text-[12px] font-black ${S.title}`}>سياسات الحجز</span>
      </div>
      <p className={`text-[11px] leading-relaxed ${S.muted}`}>
        سيب أي خانة فاضية عشان تمشي على السياسة الافتراضية للمنصة. اللي تكتبه هنا بيظهر للضيف قبل ما يحجز،
        والحجوزات القديمة بتفضل على سياستها وقت الحجز.
      </p>

      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1">
          <span className={`block text-[11px] font-bold ${S.muted}`}>استرداد كامل قبل (يوم)</span>
          <input type="text" inputMode="numeric" value={free} onChange={(e) => setFree(e.target.value)}
            placeholder={`الافتراضي ${settings.freeCancelDays}`} className={FIELD} />
        </label>
        <label className="space-y-1">
          <span className={`block text-[11px] font-bold ${S.muted}`}>استرداد جزئي قبل (يوم)</span>
          <input type="text" inputMode="numeric" value={partial} onChange={(e) => setPartial(e.target.value)}
            placeholder={`الافتراضي ${settings.partialRefundDays}`} className={FIELD} />
        </label>
        <label className="space-y-1">
          <span className={`block text-[11px] font-bold ${S.muted}`}>نسبة الاسترداد (٪)</span>
          <input type="text" inputMode="numeric" value={pct} onChange={(e) => setPct(e.target.value)}
            placeholder={`الافتراضي ${Math.round(settings.partialRefundPct * 100)}`} className={FIELD} />
        </label>
        <label className="space-y-1">
          <span className={`block text-[11px] font-bold ${S.muted}`}>الأطفال تحت (سنة) مجانًا</span>
          <input type="text" inputMode="numeric" value={childAge} onChange={(e) => setChildAge(e.target.value)}
            placeholder="بدون" className={FIELD} />
        </label>
      </div>

      <label className="block space-y-1">
        <span className={`block text-[11px] font-bold ${S.muted}`}>ملاحظات إضافية على الحجز</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={2000}
          placeholder="مثال: مواعيد الوصول، أو شروط خاصة بالمجموعات الكبيرة."
          className={`${FIELD} py-2 resize-y min-h-[72px]`} />
      </label>

      {/* What the guest will read, from the same resolver the guest page uses —
          so the owner is never guessing how a blank field will be filled in. */}
      <div className={`rounded-2xl border p-3 space-y-1 text-[11px] ${S.panel}`}>
        <p className="font-black">اللي الضيف هيشوفه:</p>
        <p>• إلغاء قبل {arabicNumber(preview.freeCancelDays)} يوم أو أكثر: استرداد كامل{preview.source.freeCancelDays === 'platform' ? ' (سياسة المنصة)' : ''}.</p>
        <p>• قبل {arabicNumber(preview.partialRefundDays)} يوم أو أكثر: استرداد {arabicNumber(Math.round(preview.partialRefundPct * 100))}٪{preview.source.partialRefundDays === 'platform' ? ' (سياسة المنصة)' : ''}.</p>
        <p>• أقل من كده: لا يوجد استرداد.</p>
        <p>• {preview.childFreeUnderAge != null
          ? `الأطفال تحت ${arabicNumber(preview.childFreeUnderAge)} سنوات مجانًا.`
          : 'مفيش سياسة أطفال — كل الأفراد بيتحاسبوا.'}</p>
      </div>

      {error && <p role="alert" className="text-[11px] font-bold text-[var(--color-owner-danger,#C0392B)]">{error}</p>}

      <button type="button" onClick={save} disabled={saving}
        className={`w-full ${S.btn} text-[11px] font-bold min-h-11.5 rounded-xl cursor-pointer disabled:opacity-60 flex items-center justify-center gap-1.5 transition-colors`}>
        {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> جارٍ الحفظ…</>
          : saved ? <><Check className="w-3.5 h-3.5" /> تم الحفظ</>
          : 'حفظ سياسات الحجز'}
      </button>
    </div>
  );
}
