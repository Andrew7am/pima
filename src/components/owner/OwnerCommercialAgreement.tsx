import React, { useEffect, useMemo, useState } from 'react';
import { Handshake, Loader2, Check, Clock, X, AlertTriangle, Lock } from 'lucide-react';
import { RetreatHouse, HouseAgreement, HouseAgreementRequest, OwnerAgreementModel } from '../../types';
import {
  loadHouseAgreements, loadAgreementRequests, requestHouseAgreement,
  cancelAgreementRequest, reviewAgreementRequest, adminSetHouseAgreement,
} from '../../lib/db';
import { arabicNumber } from '../../lib/arabic';

interface Props {
  house: RetreatHouse;
  /** Which token set to wear. The owner and the admin get the same component;
   *  the admin variant additionally unlocks the negotiated rate. */
  variant?: 'owner' | 'admin';
  onChanged?: () => void;
}

const SKIN = {
  owner: {
    field: 'w-full bg-[var(--color-owner-surface)] border border-[var(--color-owner-border)] text-[11px] px-2 min-h-11.5 rounded-xl text-[var(--color-owner-text)] focus:outline-none focus:border-[var(--color-owner-primary)] transition-colors',
    rule: 'border-[var(--color-owner-border)]', icon: 'text-[var(--color-owner-primary)]',
    title: 'text-[var(--color-owner-text)]', muted: 'text-[var(--color-owner-secondary)]',
    panel: 'bg-[var(--color-owner-hover)] border-[var(--color-owner-border)] text-[var(--color-owner-text)]',
    btn: 'bg-[var(--color-owner-primary)] hover:bg-[var(--color-owner-primary-hover)] text-[var(--color-owner-on-primary)]',
    pick: 'border-[var(--color-owner-border)] bg-[var(--color-owner-surface)]',
    pickOn: 'border-[var(--color-owner-primary)] bg-[var(--color-owner-hover)]',
  },
  admin: {
    field: 'w-full bg-[var(--ds-surface)] border border-[var(--ds-border)] text-[11px] px-2 min-h-11 rounded-xl text-[var(--ds-text)] focus:outline-none focus:border-[var(--ds-primary)] transition-colors',
    rule: 'border-[var(--ds-border)]', icon: 'text-[var(--ds-accent)]',
    title: 'text-[var(--ds-brand)]', muted: 'text-[var(--ds-text-2)]',
    panel: 'bg-[var(--ds-raised)] border-[var(--ds-border)] text-[var(--ds-text)]',
    btn: 'bg-[var(--ds-primary)] hover:bg-[var(--ds-primary)] text-[var(--ds-on-primary)]',
    pick: 'border-[var(--ds-border)] bg-[var(--ds-surface)]',
    pickOn: 'border-[var(--ds-primary)] bg-[var(--ds-raised)]',
  },
} as const;

/** Accepts Arabic-Indic digits, because the keyboard on an Egyptian phone types them. */
const toNum = (s: string): number | null => {
  const t = s.trim();
  if (t === '') return null;
  const n = Number(t.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))));
  return Number.isFinite(n) ? n : null;
};

const STATUS_AR: Record<HouseAgreementRequest['status'], string> = {
  PENDING: 'تحت مراجعة الإدارة',
  APPROVED: 'تمت الموافقة',
  REJECTED: 'مرفوض',
  CHANGES_REQUESTED: 'مطلوب تعديل',
  CANCELLED: 'تم السحب',
};

const pct = (v?: number) => (v == null ? '—' : `${arabicNumber(Math.round(v * 1000) / 10)}٪`);
const egp = (v?: number) => (v == null ? '—' : `${arabicNumber(v)} ج.م`);

/** What the owner is told the agreement means. Terms only — never PIMA's margin. */
function describe(a: HouseAgreement): string {
  if (a.modelType === 'MARKUP') {
    return `سعرك المعلن هو الأساس، وبيما بتضيف ${pct(a.markupPct)} فوقه على سعر العميل — ومستحقك يفضل سعرك المعلن كامل.`;
  }
  if (a.modelType === 'COMMISSION') {
    return `سعرك المعلن هو سعر العميل، وبيما بتاخد عمولة ${pct(a.commissionRate)} من قيمة الحجز.`;
  }
  return `اتفاق خاص متفق عليه مع الإدارة: مستحقك ${egp(a.netRate)} صافي لكل وحدة محاسبية.`;
}

/**
 * The commercial partnership between a house and PIMA.
 *
 * An owner may ask for MARKUP or COMMISSION and nothing else. That is not a
 * property of this file — OwnerAgreementModel excludes NET_RATE at the type
 * level, request_house_agreement() raises on it, and the request table has a
 * CHECK that makes a NET_RATE row unstorable. Removing the radio button here
 * would change nothing about who can do what; it is the last and least of four
 * layers, and it exists so the owner is not offered something he cannot have.
 *
 * A request is a proposal. Approving one is a separate, admin-only act that
 * writes house_agreements — the only table the pricing engine reads.
 */
export default function OwnerCommercialAgreement({ house, variant = 'owner', onChanged }: Props) {
  const S = SKIN[variant];
  const isAdmin = variant === 'admin';

  const [agreements, setAgreements] = useState<HouseAgreement[]>([]);
  const [requests, setRequests] = useState<HouseAgreementRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  // Owner-side form
  const [model, setModel] = useState<OwnerAgreementModel>('COMMISSION');
  const [markup, setMarkup] = useState('');
  const [commission, setCommission] = useState('');
  const [ownerNote, setOwnerNote] = useState('');

  // Admin-side review / direct creation
  const [adminNote, setAdminNote] = useState('');
  const [negNetRate, setNegNetRate] = useState('');
  const [negFrom, setNegFrom] = useState('');

  const refresh = async () => {
    setLoading(true);
    const [a, r] = await Promise.all([
      loadHouseAgreements(house.id),
      loadAgreementRequests(house.id),
    ]);
    setAgreements(a); setRequests(r); setLoading(false);
  };

  useEffect(() => { void refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [house.id]);

  const active = useMemo(() => agreements.find((a) => !a.effectiveTo), [agreements]);
  const pending = useMemo(() => requests.find((r) => r.status === 'PENDING'), [requests]);
  const lastDecided = useMemo(
    () => requests.find((r) => r.status === 'REJECTED' || r.status === 'CHANGES_REQUESTED'),
    [requests],
  );

  const after = (msg: string) => { setDone(msg); setError(null); void refresh(); onChanged?.(); setTimeout(() => setDone(null), 3000); };

  const submit = async () => {
    setBusy(true); setError(null);
    const res = await requestHouseAgreement({
      houseId: house.id,
      modelType: model,
      markupPct: model === 'MARKUP' ? (toNum(markup) != null ? (toNum(markup) as number) / 100 : null) : null,
      commissionRate: model === 'COMMISSION' ? (toNum(commission) != null ? (toNum(commission) as number) / 100 : null) : null,
      ownerNote: ownerNote.trim() || null,
    });
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    setOwnerNote(''); after('تم إرسال الطلب للإدارة.');
  };

  const withdraw = async (id: string) => {
    setBusy(true); setError(null);
    const res = await cancelAgreementRequest(id);
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    after('تم سحب الطلب.');
  };

  const decide = async (decision: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES') => {
    if (!pending) return;
    setBusy(true); setError(null);
    const res = await reviewAgreementRequest({
      requestId: pending.id,
      decision,
      adminNotes: adminNote.trim() || null,
    });
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    setAdminNote('');
    after(decision === 'APPROVE' ? 'تمت الموافقة وتفعيل الاتفاق.'
      : decision === 'REJECT' ? 'تم رفض الطلب.' : 'تم طلب تعديل من صاحب البيت.');
  };

  const createNegotiated = async () => {
    setBusy(true); setError(null);
    // This block exists only for the negotiated rate; the standard models come
    // through the request/review path so they keep their paper trail.
    const res = await adminSetHouseAgreement({
      houseId: house.id,
      modelType: 'NET_RATE',
      netRate: toNum(negNetRate),
      effectiveFrom: negFrom || null,
      note: adminNote.trim() || null,
    });
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    setAdminNote(''); setNegNetRate(''); after('تم تسجيل الاتفاق.');
  };

  if (loading) {
    return (
      <div className={`flex items-center gap-2 pt-3 border-t ${S.rule}`}>
        <Loader2 className={`w-3.5 h-3.5 animate-spin ${S.icon}`} />
        <span className={`text-[11px] ${S.muted}`}>جاري تحميل بيانات التعاقد…</span>
      </div>
    );
  }

  return (
    <div className={`space-y-3 pt-3 border-t ${S.rule}`}>
      <div className="flex items-center gap-1.5">
        <Handshake className={`w-3.5 h-3.5 ${S.icon}`} />
        <span className={`text-[12px] font-black ${S.title}`}>الشراكة التجارية</span>
      </div>

      {/* ── What is in force right now ───────────────────────────────────── */}
      {active ? (
        <div className={`rounded-2xl border p-3 space-y-1 ${S.panel}`}>
          <div className="flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-[var(--ds-success,#16a34a)]" />
            <span className="text-[11px] font-black">الاتفاق السارى</span>
          </div>
          <p className="text-[11px] leading-relaxed">{describe(active)}</p>
          <p className={`text-[10px] ${S.muted}`}>
            سارٍ من {active.effectiveFrom}
            {active.note ? ` — ${active.note}` : ''}
          </p>
        </div>
      ) : (
        <div className={`rounded-2xl border p-3 flex items-start gap-2 ${S.panel}`}>
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[var(--ds-warning-deep,#b45309)]" />
          <p className="text-[11px] leading-relaxed">
            <strong>مفيش اتفاق تجارى سارٍ على البيت ده.</strong> الحجز الجديد مش هيقدر يتسعّر لحد ما يتحدد نظام التعاقد.
          </p>
        </div>
      )}

      {/* ── The owner's open request, or the admin's review of it ────────── */}
      {pending && (
        <div className={`rounded-2xl border p-3 space-y-2 ${S.panel}`}>
          <div className="flex items-center gap-1.5">
            <Clock className={`w-3.5 h-3.5 ${S.icon}`} />
            <span className="text-[11px] font-black">{STATUS_AR[pending.status]}</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            النظام المطلوب: <strong>{pending.modelType === 'MARKUP' ? 'هامش' : 'عمولة'}</strong>
            {pending.modelType === 'MARKUP'
              ? ` — هامش ${pct(pending.markupPct)} فوق سعرك المعلن`
              : ` — ${pct(pending.commissionRate)}`}
          </p>
          {pending.ownerNote && <p className={`text-[10px] ${S.muted}`}>ملاحظة صاحب البيت: {pending.ownerNote}</p>}

          {isAdmin ? (
            <div className="space-y-2 pt-1">
              <textarea
                value={adminNote} onChange={(e) => setAdminNote(e.target.value)} rows={2}
                placeholder="سبب القرار — بيظهر لصاحب البيت"
                className={`${S.field} py-2 resize-none`}
              />
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={busy} onClick={() => void decide('APPROVE')}
                  className={`${S.btn} text-[11px] font-black rounded-xl px-3 min-h-11 pima-press disabled:opacity-50`}>
                  موافقة وتفعيل
                </button>
                <button type="button" disabled={busy} onClick={() => void decide('REQUEST_CHANGES')}
                  className={`border ${S.rule} text-[11px] font-bold rounded-xl px-3 min-h-11 pima-press disabled:opacity-50`}>
                  طلب تعديل
                </button>
                <button type="button" disabled={busy} onClick={() => void decide('REJECT')}
                  className={`border ${S.rule} text-[11px] font-bold rounded-xl px-3 min-h-11 pima-press disabled:opacity-50`}>
                  رفض
                </button>
              </div>
            </div>
          ) : (
            <button type="button" disabled={busy} onClick={() => void withdraw(pending.id)}
              className={`border ${S.rule} text-[11px] font-bold rounded-xl px-3 min-h-11 pima-press disabled:opacity-50`}>
              سحب الطلب
            </button>
          )}
        </div>
      )}

      {/* ── The admin's last word, so the owner knows what to change ─────── */}
      {!pending && lastDecided && (
        <div className={`rounded-2xl border p-3 space-y-1 ${S.panel}`}>
          <div className="flex items-center gap-1.5">
            <X className="w-3.5 h-3.5 text-[var(--ds-warning-deep,#b45309)]" />
            <span className="text-[11px] font-black">{STATUS_AR[lastDecided.status]}</span>
          </div>
          {lastDecided.adminNotes && <p className="text-[11px] leading-relaxed">{lastDecided.adminNotes}</p>}
        </div>
      )}

      {/* ── Choose a model. MARKUP and COMMISSION only. ──────────────────── */}
      {!pending && (
        <div className="space-y-2">
          <p className={`text-[11px] font-bold ${S.title}`}>اختار نظام التعاقد اللى يناسبك:</p>

          <button type="button" onClick={() => setModel('MARKUP')}
            className={`w-full text-right rounded-2xl border p-3 transition-colors ${model === 'MARKUP' ? S.pickOn : S.pick}`}>
            <span className={`text-[11px] font-black block ${S.title}`}>هامش</span>
            <span className={`text-[10px] leading-relaxed block ${S.muted}`}>
              سعرك المعلن هو الأساس، وبيما بتضيف نسبة متفق عليها فوقه على سعر العميل — ومستحقك يفضل سعرك المعلن كامل.
            </span>
          </button>

          <button type="button" onClick={() => setModel('COMMISSION')}
            className={`w-full text-right rounded-2xl border p-3 transition-colors ${model === 'COMMISSION' ? S.pickOn : S.pick}`}>
            <span className={`text-[11px] font-black block ${S.title}`}>عمولة</span>
            <span className={`text-[10px] leading-relaxed block ${S.muted}`}>
              سعرك المعلن يفضل هو سعر العميل، وبيما بتاخد عمولة متفق عليها من الحجز.
            </span>
          </button>

          {model === 'MARKUP' ? (
            <label className="space-y-1 block">
              <span className={`text-[10px] font-bold block ${S.muted}`}>الهامش المطلوب فوق سعرك المعلن (٪)</span>
              <input value={markup} onChange={(e) => setMarkup(e.target.value)} inputMode="decimal" className={S.field} />
            </label>
          ) : (
            <label className="space-y-1 block">
              <span className={`text-[10px] font-bold block ${S.muted}`}>العمولة المقترحة (٪)</span>
              <input value={commission} onChange={(e) => setCommission(e.target.value)} inputMode="decimal" className={S.field} />
            </label>
          )}

          <textarea value={ownerNote} onChange={(e) => setOwnerNote(e.target.value)} rows={2}
            placeholder="ملاحظة للإدارة (اختيارى)" className={`${S.field} py-2 resize-none`} />

          <button type="button" disabled={busy} onClick={() => void submit()}
            className={`${S.btn} w-full text-[11px] font-black rounded-2xl min-h-11 pima-press disabled:opacity-50 flex items-center justify-center gap-1.5`}>
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            إرسال الطلب للإدارة
          </button>
        </div>
      )}

      {/* ── Admin only: the negotiated rate ──────────────────────────────── */}
      {isAdmin && (
        <div className={`rounded-2xl border p-3 space-y-2 ${S.panel}`}>
          <div className="flex items-center gap-1.5">
            <Lock className={`w-3.5 h-3.5 ${S.icon}`} />
            <span className="text-[11px] font-black">اتفاق تفاوضى (إدارة فقط)</span>
          </div>
          <p className={`text-[10px] leading-relaxed ${S.muted}`}>
            سعر صافى متفق عليه مع البيت. مش خيار متاح لصاحب البيت، وبيتسجل معاه سبب التفاوض.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className={`text-[10px] font-bold block ${S.muted}`}>الصافى للوحدة (ج.م)</span>
              <input value={negNetRate} onChange={(e) => setNegNetRate(e.target.value)} inputMode="decimal" className={S.field} />
            </label>
            <label className="space-y-1">
              <span className={`text-[10px] font-bold block ${S.muted}`}>يبدأ من</span>
              <input value={negFrom} onChange={(e) => setNegFrom(e.target.value)} type="date" className={S.field} />
            </label>
          </div>
          <textarea value={adminNote} onChange={(e) => setAdminNote(e.target.value)} rows={2}
            placeholder="سبب التفاوض — إلزامى" className={`${S.field} py-2 resize-none`} />
          <button type="button" disabled={busy}
            onClick={() => void createNegotiated()}
            className={`${S.btn} w-full text-[11px] font-black rounded-2xl min-h-11 pima-press disabled:opacity-50`}>
            تسجيل الاتفاق التفاوضى
          </button>
        </div>
      )}

      {/* ── History ──────────────────────────────────────────────────────── */}
      {isAdmin && agreements.length > 0 && (
        <details className={`rounded-2xl border p-3 ${S.panel}`}>
          <summary className="text-[11px] font-black cursor-pointer">سجل الاتفاقات ({arabicNumber(agreements.length)})</summary>
          <ul className="mt-2 space-y-1">
            {agreements.map((a) => (
              <li key={a.id} className={`text-[10px] leading-relaxed ${a.effectiveTo ? S.muted : ''}`}>
                <strong>{a.modelType}</strong>
                {a.modelType === 'COMMISSION' ? ` ${pct(a.commissionRate)}`
                  : a.modelType === 'MARKUP' ? ` +${pct(a.markupPct)} فوق السعر المعلن`
                  : ` ${egp(a.netRate)} صافى`}
                {' · '}{a.effectiveFrom} → {a.effectiveTo ?? 'سارٍ'}
                {a.note ? ` · ${a.note}` : ''}
              </li>
            ))}
          </ul>
        </details>
      )}

      {error && <p className="text-[11px] font-bold text-[var(--ds-danger,#dc2626)]">{error}</p>}
      {done && <p className="text-[11px] font-bold text-[var(--ds-success,#16a34a)]">{done}</p>}
    </div>
  );
}
