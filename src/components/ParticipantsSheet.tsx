import { useMemo, useState } from 'react';
import type { Attendee } from '../types';
import BottomSheet from './BottomSheet';
import { arabicNumber } from '../lib/arabic';

/**
 * The participants list, and the card that opens it.
 *
 * Seventy-six rows inside the booking page pushed «توزيع الغرف» and «برنامج
 * الخلوة» so far down that nobody scrolled to them. The card keeps the counts
 * where the servant can see them at a glance; the list moves into a sheet.
 *
 * Counting lives here, once, and both the card and the sheet read it — a
 * second tally somewhere else is a second thing to keep true.
 */

const NAVY = '#0A2342';
const GOLD = '#C5A059';
const MUTED = '#8A8A70';
const LINE = '#E7E2D5';

const GROUP_LABEL: Record<Attendee['groupType'], string> = {
  youth: 'شباب', family: 'عائلة', child: 'أطفال', other: 'أخرى',
};
const ARRIVAL_LABEL: Record<NonNullable<Attendee['arrivalMethod']>, string> = {
  with_trip: 'مع الرحلة', own_car: 'بسيارتي', independent: 'سأصل بشكل مستقل',
};

/** Rows written before migration 119 have no status; 080's sharePaid is the
 *  only signal they carry, so it stands in rather than defaulting to unpaid
 *  and telling a servant someone owes money they already handed over. */
export function statusOf(a: Attendee): 'unpaid' | 'pending' | 'paid' {
  if (a.paymentStatus) return a.paymentStatus;
  return a.sharePaid ? 'paid' : 'unpaid';
}

const STATUS_STYLE = {
  paid: { label: 'تم الدفع', fg: '#047857', bg: '#ECFDF5', bd: '#A7F3D0' },
  pending: { label: 'قيد المراجعة', fg: '#92400E', bg: '#FFFBEB', bd: '#FDE68A' },
  unpaid: { label: 'لم يدفع', fg: '#B91C1C', bg: '#FEF2F2', bd: '#FECACA' },
} as const;

export interface ParticipantTally {
  paid: number; pending: number; unpaid: number; registered: number; seats: number;
}

export function tally(attendees: Attendee[], seats: number): ParticipantTally {
  let paid = 0, pending = 0, unpaid = 0;
  for (const a of attendees) {
    const s = statusOf(a);
    if (s === 'paid') paid++; else if (s === 'pending') pending++; else unpaid++;
  }
  return { paid, pending, unpaid, registered: attendees.length, seats };
}

/* ── stat row ─────────────────────────────────────────────────────────────── */

function Stat({ n, label, fg }: { n: number; label: string; fg: string }) {
  return (
    <div className="flex-1 rounded-xl border bg-white px-2 py-2 text-center" style={{ borderColor: LINE }}>
      <div className="text-[16px] font-black leading-none" style={{ color: fg }}>{arabicNumber(n)}</div>
      <div className="text-[9.5px] font-bold mt-1" style={{ color: MUTED }}>{label}</div>
    </div>
  );
}

function StatRow({ t }: { t: ParticipantTally }) {
  return (
    <div className="flex gap-1.5">
      <Stat n={t.paid} label="تم الدفع" fg="#047857" />
      <Stat n={t.pending} label="قيد المراجعة" fg="#92400E" />
      <Stat n={t.unpaid} label="لم يدفعوا" fg="#B91C1C" />
      <Stat n={t.seats} label="إجمالي" fg={NAVY} />
    </div>
  );
}

/* ── summary card, for the booking page ───────────────────────────────────── */

export function ParticipantsCard({ t, onOpen }: { t: ParticipantTally; onOpen: () => void }) {
  const pct = t.seats > 0 ? Math.min(100, Math.round((t.registered / t.seats) * 100)) : 0;
  return (
    <section className="rounded-2xl border bg-[#FDFBF7] p-4 flex flex-col gap-3" style={{ borderColor: '#EFE3CC' }}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-[14px] font-black" style={{ color: NAVY }}>المشاركون</h3>
          <p className="text-[11.5px] font-bold mt-0.5" style={{ color: MUTED }}>
            {arabicNumber(t.registered)} مسجل من {arabicNumber(t.seats)}
          </p>
        </div>
        {/* Ring, not a bar: the number belongs in the middle of it. */}
        <div className="relative w-[4.2rem] h-[4.2rem] shrink-0 grid place-items-center">
          <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" aria-hidden="true">
            <circle cx="18" cy="18" r="15.5" fill="none" stroke={LINE} strokeWidth="4" />
            <circle cx="18" cy="18" r="15.5" fill="none" stroke={GOLD} strokeWidth="4" strokeLinecap="round"
              strokeDasharray={`${(pct / 100) * 97.4} 97.4`} />
          </svg>
          <div className="text-center">
            <div className="text-[15px] font-black leading-none" style={{ color: NAVY }}>{arabicNumber(t.seats)}</div>
            <div className="text-[8px] font-bold" style={{ color: MUTED }}>إجمالي</div>
          </div>
        </div>
      </div>

      <StatRow t={t} />

      <button type="button" onClick={onOpen}
        className="w-full flex items-center justify-between rounded-xl bg-white border px-3 py-2.5 min-h-11 cursor-pointer"
        style={{ borderColor: LINE }}>
        <span className="text-[12.5px] font-black" style={{ color: NAVY }}>عرض قائمة المشاركين</span>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ color: GOLD }}>
          <path d="M14.5 5 8 12l6.5 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </section>
  );
}

/* ── the sheet ────────────────────────────────────────────────────────────── */

type StatusFilter = 'all' | 'paid' | 'pending' | 'unpaid';
type GroupFilter = 'all' | Attendee['groupType'];

interface SheetProps {
  open: boolean;
  onClose: () => void;
  houseName: string;
  attendees: Attendee[];
  seats: number;
  onSelect?: (a: Attendee) => void;
  onAdd?: () => void;
  onShareLink?: () => void;
  onExport?: () => void;
}

export default function ParticipantsSheet({
  open, onClose, houseName, attendees, seats, onSelect, onAdd, onShareLink, onExport,
}: SheetProps) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [group, setGroup] = useState<GroupFilter>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const t = useMemo(() => tally(attendees, seats), [attendees, seats]);

  const shown = useMemo(() => {
    const needle = q.trim();
    return attendees.filter((a) => {
      if (status !== 'all' && statusOf(a) !== status) return false;
      if (group !== 'all' && a.groupType !== group) return false;
      if (!needle) return true;
      return a.name.includes(needle) || (a.phone ?? '').includes(needle);
    });
  }, [attendees, q, status, group]);

  const chip = (on: boolean) =>
    `px-3 py-1.5 rounded-full text-[11px] font-bold border cursor-pointer transition-colors ${
      on ? 'text-white' : 'bg-white'}`;
  const chipStyle = (on: boolean) =>
    on ? { backgroundColor: NAVY, borderColor: NAVY } : { borderColor: LINE, color: MUTED };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={`قائمة المشاركين (${arabicNumber(t.registered)})`}
      subtitle={houseName}
      header={(
        <div className="flex flex-col gap-2.5">
          <StatRow t={t} />
          <div className="flex gap-2">
            {/* NOT ui/SearchInput, and not yet tokenised — deliberately, with
                the reason recorded so the next pass does not have to re-derive
                it. This sheet and the BottomSheet chrome around it are entirely
                pre-theme: in dark mode the panel is still #FBF7F0 and thirty-six
                surfaces inside it are still white or cream. A field that alone
                followed --ds-surface would land at 15.8:1 against the panel it
                sits on and 16.9:1 against the «تصفية» button beside it in this
                same row — a black rectangle next to a white one. The colour has
                to move when the sheet moves, and the sheet cannot move until
                BottomSheet does, which six Owner screens also render.

                What does not depend on any of that is applied here: the touch
                floor, a real search type, an accessible name, and padding and
                icon placement that follow the writing direction instead of
                assuming Arabic. */}
            <div className="relative flex-1">
              <input
                type="search"
                aria-label="ابحث في المشاركين"
                value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="ابحث باسم المشارك أو رقم الهاتف..."
                className="w-full bg-white border rounded-xl min-h-11 py-2.5 ps-9 pe-3 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-[#C5A059]/40 [&::-webkit-search-cancel-button]:appearance-none"
                style={{ borderColor: LINE, color: '#4A4A3A' }}
              />
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"
                className="absolute top-1/2 -translate-y-1/2 start-3" style={{ color: MUTED }}>
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <button type="button" onClick={() => setFiltersOpen((v) => !v)}
              aria-expanded={filtersOpen}
              className="shrink-0 flex items-center gap-1.5 rounded-xl bg-white border px-3 min-h-11 text-[12px] font-bold cursor-pointer"
              style={{ borderColor: filtersOpen ? GOLD : LINE, color: NAVY }}>
              تصفية
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Chips, not dropdowns — a native select on a phone hides the options
              behind a picker and the servant loses sight of what is filtered. */}
          {filtersOpen && (
            <div className="flex flex-col gap-2 pt-1">
              <div className="flex flex-wrap gap-1.5">
                {([['all', 'الكل'], ['paid', 'تم الدفع'], ['pending', 'قيد المراجعة'], ['unpaid', 'لم يدفع']] as const)
                  .map(([v, l]) => (
                    <button key={v} type="button" onClick={() => setStatus(v)}
                      className={chip(status === v)} style={chipStyle(status === v)}>{l}</button>
                  ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {([['all', 'كل الفئات'], ['youth', 'شباب'], ['family', 'عائلة'], ['child', 'أطفال'], ['other', 'أخرى']] as const)
                  .map(([v, l]) => (
                    <button key={v} type="button" onClick={() => setGroup(v)}
                      className={chip(group === v)} style={chipStyle(group === v)}>{l}</button>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
      footer={(
        <div className="flex gap-2">
          <button type="button" onClick={onAdd} disabled={!onAdd}
            className="flex-1 rounded-xl py-2.5 text-[12.5px] font-black text-white cursor-pointer disabled:opacity-40"
            style={{ backgroundColor: GOLD }}>
            + إضافة مشارك
          </button>
          <button type="button" onClick={onShareLink} disabled={!onShareLink}
            className="rounded-xl px-3 py-2.5 text-[12px] font-bold bg-white border cursor-pointer disabled:opacity-40"
            style={{ borderColor: LINE, color: NAVY }}>
            رابط الدعوة
          </button>
          <button type="button" onClick={onExport} disabled={!onExport}
            aria-label="تحميل القائمة"
            className="rounded-xl px-3 py-2.5 bg-white border cursor-pointer disabled:opacity-40"
            style={{ borderColor: LINE, color: NAVY }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 4v11m0 0 4-4m-4 4-4-4M5 19h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      )}
    >
      {shown.length === 0 ? (
        <p className="text-center text-[12px] py-8" style={{ color: MUTED }}>
          {attendees.length === 0 ? 'لسه محدش سجّل. شارك رابط الدعوة.' : 'مفيش مشارك مطابق للبحث.'}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((a) => {
            const s = STATUS_STYLE[statusOf(a)];
            return (
              <li key={a.id}>
                <button type="button" onClick={() => onSelect?.(a)}
                  className="w-full text-right rounded-xl bg-white border p-3 flex items-start gap-3 min-h-11 cursor-pointer"
                  style={{ borderColor: LINE }}>
                  <span className="shrink-0 w-10 h-10 rounded-full grid place-items-center text-[13px] font-black"
                    style={{ backgroundColor: '#F6EFE1', color: GOLD }} aria-hidden="true">
                    {a.name.trim().charAt(0) || '؟'}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] font-black truncate" style={{ color: NAVY }}>{a.name}</span>
                    <span className="block text-[11px] mt-0.5" style={{ color: MUTED }} dir="ltr">
                      {a.phone || '—'}
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border"
                        style={{ backgroundColor: '#FBF7F0', borderColor: LINE, color: MUTED }}>
                        {GROUP_LABEL[a.groupType]}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border"
                        style={{ backgroundColor: s.bg, borderColor: s.bd, color: s.fg }}>
                        {s.label}
                      </span>
                      {a.arrivalMethod && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border"
                          style={{ backgroundColor: '#FBF7F0', borderColor: LINE, color: MUTED }}>
                          {ARRIVAL_LABEL[a.arrivalMethod]}
                        </span>
                      )}
                    </span>
                  </span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"
                    className="shrink-0 mt-1" style={{ color: MUTED }}>
                    <path d="M14.5 5 8 12l6.5 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-center text-[10.5px] mt-3" style={{ color: MUTED }}>
        عرض {arabicNumber(shown.length)} من {arabicNumber(attendees.length)}
      </p>
    </BottomSheet>
  );
}
