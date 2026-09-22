import React, { useEffect, useMemo, useState } from 'react';
import { Handshake, Loader2, Check, X, MessageSquare, AlertTriangle } from 'lucide-react';
import { RetreatHouse, HouseAgreementRequest } from '../types';
import { loadAgreementRequests, reviewAgreementRequest } from '../lib/db';
import { arabicNumber } from '../lib/arabic';

interface Props {
  houses: RetreatHouse[];
  /** Bumping this re-fetches — lets the parent refresh after its own writes. */
  refreshKey?: number;
  onChanged?: () => void;
}

const pct = (v?: number) => (v == null ? '—' : `${arabicNumber(Math.round(v * 1000) / 10)}٪`);

/**
 * Every pending commercial request, across every house.
 *
 * The per-house panel in the house editor is where an admin *negotiates*; this
 * is where they find out there is anything to negotiate. Without it a request
 * reaches nobody — an owner submits, and the only way to discover it is to
 * open each house in turn. That is the same reason pending house edits get a
 * counted list rather than living only inside the house they belong to.
 *
 * Terms can be adjusted here before approving, because approving on the
 * owner's exact numbers and approving on renegotiated ones are the same act
 * with a different figure, and making the admin leave the queue to change a
 * percentage would just mean the queue gets bypassed.
 */
export default function AdminAgreementRequests({ houses, refreshKey = 0, onChanged }: Props) {
  const [requests, setRequests] = useState<HouseAgreementRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [rate, setRate] = useState('');

  const houseName = useMemo(() => {
    const m = new Map(houses.map((h) => [h.id, h.name]));
    return (id: string) => m.get(id) ?? id;
  }, [houses]);

  const refresh = async () => {
    setLoading(true);
    const all = await loadAgreementRequests();
    setRequests(all.filter((r) => r.status === 'PENDING'));
    setLoading(false);
  };

  useEffect(() => { void refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [refreshKey]);

  const decide = async (
    req: HouseAgreementRequest,
    decision: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES',
  ) => {
    setBusy(req.id); setError(null);
    // An empty box means "on the terms they asked for"; a number means
    // "on these instead". Either way the model is unchanged, so no
    // model-switch note is required.
    const typed = rate.trim() === '' ? null : Number(rate.trim().replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))));
    const overridden = typed != null && Number.isFinite(typed) ? typed / 100 : null;
    const res = await reviewAgreementRequest({
      requestId: req.id,
      decision,
      adminNotes: note.trim() || null,
      markupPct: req.modelType === 'MARKUP' ? overridden : null,
      commissionRate: req.modelType === 'COMMISSION' ? overridden : null,
    });
    setBusy(null);
    if (!res.ok) { setError(res.error ?? 'تعذّر تنفيذ الطلب.'); return; }
    setOpenId(null); setNote(''); setRate('');
    await refresh();
    onChanged?.();
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[11px] text-[var(--ds-text-2)]">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> جاري تحميل طلبات التعاقد…
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface)] p-4 text-[11px] text-[var(--ds-text-2)]">
        مفيش طلبات تعاقد تجارى تحت المراجعة.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Handshake className="w-3.5 h-3.5 text-[var(--ds-accent)]" />
        <span className="text-[12px] font-black text-[var(--ds-brand)]">
          طلبات التعاقد التجارى ({arabicNumber(requests.length)})
        </span>
      </div>

      {requests.map((req) => {
        const isOpen = openId === req.id;
        return (
          <div key={req.id}
            className="rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface)] p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] font-black text-[var(--ds-text)] truncate">{houseName(req.houseId)}</p>
                <p className="text-[10px] text-[var(--ds-text-2)] leading-relaxed">
                  {req.modelType === 'MARKUP'
                    ? `هامش ${pct(req.markupPct)} فوق السعر المعلن`
                    : `عمولة ${pct(req.commissionRate)}`}
                  {' · '}
                  {new Date(req.submittedAt).toLocaleDateString('ar-EG')}
                </p>
                {req.ownerNote && (
                  <p className="text-[10px] text-[var(--ds-text-2)] mt-1 leading-relaxed">
                    «{req.ownerNote}»
                  </p>
                )}
              </div>
              <button type="button"
                onClick={() => { setOpenId(isOpen ? null : req.id); setNote(''); setRate(''); setError(null); }}
                className="shrink-0 text-[11px] font-bold rounded-xl border border-[var(--ds-border)] px-3 min-h-11 pima-press">
                {isOpen ? 'إغلاق' : 'مراجعة'}
              </button>
            </div>

            {isOpen && (
              <div className="space-y-2 pt-1 border-t border-[var(--ds-border)]">
                <label className="space-y-1 block">
                  <span className="text-[10px] font-bold block text-[var(--ds-text-2)]">
                    {req.modelType === 'MARKUP' ? 'الهامش النهائى (٪)' : 'العمولة النهائية (٪)'}
                    {' — سيبها فاضية للموافقة على المطلوب'}
                  </span>
                  <input value={rate} onChange={(e) => setRate(e.target.value)} inputMode="decimal"
                    placeholder={req.modelType === 'MARKUP'
                      ? String(Math.round((req.markupPct ?? 0) * 1000) / 10)
                      : String(Math.round((req.commissionRate ?? 0) * 1000) / 10)}
                    className="w-full bg-[var(--ds-surface)] border border-[var(--ds-border)] text-[11px] px-2 min-h-11 rounded-xl text-[var(--ds-text)]" />
                </label>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
                  placeholder="سبب القرار — بيظهر لصاحب البيت"
                  className="w-full bg-[var(--ds-surface)] border border-[var(--ds-border)] text-[11px] px-2 py-2 rounded-xl text-[var(--ds-text)] resize-none" />
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={busy === req.id} onClick={() => void decide(req, 'APPROVE')}
                    className="flex items-center gap-1.5 bg-[var(--ds-primary)] text-[var(--ds-on-primary)] text-[11px] font-black rounded-xl px-3 min-h-11 pima-press disabled:opacity-50">
                    {busy === req.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    موافقة وتفعيل
                  </button>
                  <button type="button" disabled={busy === req.id} onClick={() => void decide(req, 'REQUEST_CHANGES')}
                    className="flex items-center gap-1.5 border border-[var(--ds-border)] text-[11px] font-bold rounded-xl px-3 min-h-11 pima-press disabled:opacity-50">
                    <MessageSquare className="w-3.5 h-3.5" /> طلب تعديل
                  </button>
                  <button type="button" disabled={busy === req.id} onClick={() => void decide(req, 'REJECT')}
                    className="flex items-center gap-1.5 border border-[var(--ds-border)] text-[11px] font-bold rounded-xl px-3 min-h-11 pima-press disabled:opacity-50">
                    <X className="w-3.5 h-3.5" /> رفض
                  </button>
                </div>
                <p className="text-[10px] text-[var(--ds-text-2)] leading-relaxed flex items-start gap-1">
                  <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                  الموافقة بتقفل الاتفاق الحالى وتفتح اتفاق جديد من النهاردة. لو الاتفاق الحالى بدأ النهاردة، أقرب تاريخ هو بكرة.
                </p>
              </div>
            )}
          </div>
        );
      })}

      {error && <p className="text-[11px] font-bold text-[var(--ds-danger,#dc2626)]">{error}</p>}
    </div>
  );
}
