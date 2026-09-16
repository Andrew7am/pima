import { useEffect, useState } from 'react';
import { CalendarDays, MapPin, Phone, Ticket, Loader2, Map } from 'lucide-react';
import { loadMyParticipations, joinBookingByCode } from '../lib/db';
import type { Participation } from '../lib/db';

/**
 * Trips you are on but did not book.
 *
 * A servant types forty names and phones into a roster; every one of those
 * people is going, and until now none of them could see anything about it in
 * the app. They asked the servant — where is it, when do we leave, is it
 * confirmed — forty times.
 *
 * What is shown here is the whole of what a participant may see, and that is
 * decided in the database (0156.my_participations), not here. There is no
 * price, no roster and nobody else's phone to leave out, because none of it
 * arrives.
 */

const STATUS: Record<string, { label: string; cls: string }> = {
  approved:  { label: 'مؤكدة', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  completed: { label: 'انتهت', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  cancelled: { label: 'اتلغت', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  rejected:  { label: 'اترفضت', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
};

const PAY: Record<Participation['myPayment'], { label: string; cls: string }> = {
  paid:    { label: 'انت دفعت', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  pending: { label: 'دفعك تحت المراجعة', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  unpaid:  { label: 'لسه ما دفعتش', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
};

const fmt = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' });
};

export default function MyTrips() {
  const [trips, setTrips] = useState<Participation[] | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  const reload = () => { void loadMyParticipations().then(setTrips); };
  useEffect(reload, []);

  const join = async () => {
    const c = code.trim();
    if (!c) return;
    setBusy(true); setError(''); setNote('');
    const r = await joinBookingByCode(c);
    setBusy(false);
    // The RPC's refusals are Arabic and are the useful part — «الكود غلط»,
    // «الرحلة دي لسه ما اتوافقش عليها». Shown as they come.
    // `=== false`, the convention in this project: it does not set `strict`,
    // and truthiness alone does not narrow the union reliably.
    if (r.ok === false) { setError(r.error); return; }
    setCode('');
    setNote(r.alreadyJoined ? 'انت مضاف في الرحلة دي بالفعل.' : 'تمام — الرحلة ظهرت تحت.');
    reload();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-[28px] border border-[var(--ds-border)] bg-[var(--ds-surface)] p-4 space-y-2.5">
        <div className="flex items-center gap-1.5">
          <Ticket className="w-4 h-4 text-[var(--ds-accent)]" />
          <h2 className="text-[12.5px] font-black text-[var(--ds-brand)]">انضم لرحلة بالكود</h2>
        </div>
        <p className="text-[11px] text-[var(--ds-text-2)] leading-relaxed">
          لو مسؤول الرحلة بعتلك كود، اكتبه هنا. ولو هو كاتب رقم تليفونك في القائمة،
          الرحلة بتظهرلك لوحدها من غير كود.
        </p>
        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void join(); }}
            placeholder="PB4A2B7"
            dir="ltr"
            className="flex-1 min-w-0 bg-[var(--ds-bg)] border border-[var(--ds-border)] rounded-2xl px-3 py-2.5 text-[12px] font-black text-center tracking-widest focus:outline-none focus:border-[var(--ds-accent)]"
          />
          <button
            type="button"
            onClick={() => void join()}
            disabled={busy || !code.trim()}
            className="shrink-0 bg-[var(--ds-accent)] disabled:opacity-50 text-white px-5 rounded-2xl text-[12px] font-black cursor-pointer min-h-11"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'انضم'}
          </button>
        </div>
        {error && <p className="text-[11px] font-bold text-rose-600">{error}</p>}
        {note && <p className="text-[11px] font-bold text-emerald-700">{note}</p>}
      </div>

      {trips === null && (
        <div className="flex items-center justify-center gap-2 py-8 text-[11px] text-[var(--ds-text-2)]">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>بنحمّل رحلاتك…</span>
        </div>
      )}

      {trips?.length === 0 && (
        <p className="text-[11px] text-[var(--ds-text-2)] text-center leading-relaxed py-6">
          انت مش مضاف في أي رحلة دلوقتي.
        </p>
      )}

      {trips?.map((t) => {
        const st = STATUS[t.status] ?? { label: t.status, cls: 'bg-slate-100 text-slate-600 border-slate-200' };
        const pay = PAY[t.myPayment];
        const where = [t.address, t.governorate].filter(Boolean).join('، ');
        return (
          <div key={t.bookingId} className="rounded-[28px] border border-[var(--ds-border)] bg-[var(--ds-surface)] p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-[13.5px] font-black text-[var(--ds-brand)] min-w-0">{t.houseName}</h3>
              <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-black border ${st.cls}`}>
                {st.label}
              </span>
            </div>

            <div className="space-y-1.5 text-[11.5px] font-medium text-[var(--ds-text)]">
              <div className="flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-[var(--ds-accent)] shrink-0" />
                <span>{fmt(t.checkIn)} ← {fmt(t.checkOut)}</span>
              </div>
              {where && (
                <div className="flex items-start gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[var(--ds-accent)] shrink-0 mt-0.5" />
                  <span>{where}</span>
                </div>
              )}
            </div>

            <span className={`inline-block px-2.5 py-1 rounded-full text-[10.5px] font-black border ${pay.cls}`}>
              {pay.label}
            </span>

            <div className="flex gap-2">
              {/* Coordinates when the house has them, otherwise its name — and
                  no button at all when there is neither, because a map button
                  that lands nowhere is worse than none. */}
              {(t.lat != null && t.lng != null) || t.houseName ? (
                <button
                  type="button"
                  onClick={() => {
                    const q = t.lat != null && t.lng != null
                      ? `${t.lat},${t.lng}`
                      : [t.houseName, t.address, t.governorate].filter(Boolean).join(' ');
                    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`, '_blank');
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-[var(--ds-bg)] border border-[var(--ds-border)] rounded-2xl min-h-11 text-[11.5px] font-black text-[var(--ds-brand)] cursor-pointer"
                >
                  <Map className="w-3.5 h-3.5" />
                  <span>الموقع</span>
                </button>
              ) : null}

              {/* The servant who booked, not the house: a participant with a
                  problem needs the person who brought them. */}
              {t.organizerPhone && (
                <a
                  href={`tel:${t.organizerPhone}`}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-[var(--ds-bg)] border border-[var(--ds-border)] rounded-2xl min-h-11 text-[11.5px] font-black text-[var(--ds-brand)] cursor-pointer"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>{t.organizerName || 'المسؤول'}</span>
                </a>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
