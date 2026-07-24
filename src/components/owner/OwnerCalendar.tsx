import React, { useMemo, useState } from 'react';
import { RetreatHouse, Booking } from '../../types';
import { ChevronLeft, ChevronRight, Lock, Unlock, CalendarDays, Users, Ban } from 'lucide-react';
import BottomSheet from './BottomSheet';

interface OwnerCalendarProps {
  house: RetreatHouse;
  bookings: Booking[];
  onUpdateHouse?: (house: RetreatHouse) => void;
}

const WEEKDAYS = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'];
const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const todayStr = new Date().toISOString().split('T')[0];

export default function OwnerCalendar({ house, bookings, onUpdateHouse }: OwnerCalendarProps) {
  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 }); // month 1-12
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [blockSheet, setBlockSheet] = useState(false);
  const [blkFrom, setBlkFrom] = useState('');
  const [blkTo, setBlkTo] = useState('');

  const blocked = useMemo(() => new Set(house.blockedDates || []), [house.blockedDates]);
  const active = useMemo(() => bookings.filter((b) => b.houseId === house.id && (b.status === 'approved' || b.status === 'completed')), [bookings, house.id]);

  const bookingsOn = (dateStr: string) => active.filter((b) => dateStr >= b.checkIn && dateStr < b.checkOut);

  const { year, month } = cursor;
  const daysCount = new Date(year, month, 0).getDate();
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });

  // Month stats
  let bookedDays = 0, blockedDays = 0;
  for (let d = 1; d <= daysCount; d++) {
    const ds = iso(year, month, d);
    if (blocked.has(ds)) blockedDays++;
    else if (bookingsOn(ds).length > 0) bookedDays++;
  }
  const occupancyPct = daysCount > 0 ? Math.round((bookedDays / daysCount) * 100) : 0;

  const shift = (delta: number) => {
    let m = month + delta, y = year;
    if (m < 1) { m = 12; y--; } else if (m > 12) { m = 1; y++; }
    setCursor({ year: y, month: m });
  };

  const setBlocked = (dates: string[]) => onUpdateHouse?.({ ...house, blockedDates: dates });
  const toggleBlockDay = (ds: string) => {
    const cur = house.blockedDates || [];
    setBlocked(blocked.has(ds) ? cur.filter((d) => d !== ds) : [...cur, ds]);
  };
  const blockRange = () => {
    if (!blkFrom) return;
    const end = blkTo && blkTo >= blkFrom ? blkTo : blkFrom;
    const cur = house.blockedDates || [];
    const set = new Set(cur);
    const c = new Date(blkFrom), last = new Date(end);
    while (c <= last) { set.add(c.toISOString().split('T')[0]); c.setDate(c.getDate() + 1); }
    setBlocked([...set]);
    setBlockSheet(false); setBlkFrom(''); setBlkTo('');
  };

  const openBookings = openDay ? bookingsOn(openDay) : [];
  const openIsBlocked = openDay ? blocked.has(openDay) : false;

  return (
    <div className="space-y-3" dir="rtl">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-black text-[var(--color-owner-text)] flex items-center gap-1.5">
            <CalendarDays className="w-4.5 h-4.5 text-[var(--color-owner-primary)]" /> تقويم الإشغال
          </h2>
          <p className="text-[11px] text-[var(--color-owner-secondary)] mt-0.5">{house.name} — تابع الحجوزات واحظر أيام الصيانة</p>
        </div>
        <button type="button" onClick={() => setBlockSheet(true)}
          className="flex items-center gap-1 text-[10px] font-black text-[var(--color-owner-primary)] bg-[var(--color-owner-surface)] border border-[var(--color-owner-border)] rounded-xl px-2.5 py-2">
          <Ban className="w-3.5 h-3.5" /> حظر فترة
        </button>
      </div>

      {/* Month stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'إشغال الشهر', value: `${occupancyPct}%`, color: 'text-[var(--color-owner-primary)]' },
          { label: 'أيام محجوزة', value: bookedDays, color: 'text-amber-600' },
          { label: 'أيام مغلقة', value: blockedDays, color: 'text-rose-600' },
        ].map((s) => (
          <div key={s.label} className="bg-[var(--color-owner-surface)] rounded-2xl border border-[var(--color-owner-border)] p-2.5 text-center">
            <div className={`text-lg font-black ${s.color}`}>{s.value}</div>
            <div className="text-[9px] font-bold text-[var(--color-owner-secondary)]">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Calendar */}
      <div className="bg-[var(--color-owner-surface)] rounded-[24px] border border-[var(--color-owner-border)] p-4 space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => shift(-1)} className="p-1.5 rounded-lg hover:bg-[var(--color-owner-hover)] text-[var(--color-owner-secondary)]"><ChevronRight className="w-4 h-4" /></button>
          <div className="text-sm font-black text-[var(--color-owner-text)]">{monthLabel}</div>
          <button type="button" onClick={() => shift(1)} className="p-1.5 rounded-lg hover:bg-[var(--color-owner-hover)] text-[var(--color-owner-secondary)]"><ChevronLeft className="w-4 h-4" /></button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-[9px] font-black text-[var(--color-owner-secondary)] text-center">
          {WEEKDAYS.map((w) => <div key={w}>{w}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstWeekday }).map((_, i) => <div key={`pad-${i}`} />)}
          {Array.from({ length: daysCount }, (_, i) => i + 1).map((day) => {
            const ds = iso(year, month, day);
            const isBlocked = blocked.has(ds);
            const bks = isBlocked ? [] : bookingsOn(ds);
            const isBooked = bks.length > 0;
            const isToday = ds === todayStr;
            const isPast = ds < todayStr;
            const cls = isBlocked
              ? 'bg-rose-500 text-white'
              : isBooked
                ? 'bg-amber-100 text-amber-900 border border-amber-200'
                : 'bg-[var(--color-owner-bg)] text-[var(--color-owner-text)] border border-[var(--color-owner-border)]';
            return (
              <button key={ds} type="button" onClick={() => setOpenDay(ds)}
                className={`relative aspect-square rounded-xl flex flex-col items-center justify-center text-[11px] font-black transition-all active:scale-95 ${cls} ${isPast ? 'opacity-45' : ''} ${isToday ? 'ring-2 ring-[var(--color-owner-primary)]' : ''}`}>
                {day}
                {isBooked && <span className="absolute bottom-1 w-1 h-1 rounded-full bg-amber-500" />}
              </button>
            );
          })}
        </div>

        <div className="flex justify-center gap-3 text-[9px] font-bold text-[var(--color-owner-secondary)] flex-wrap pt-1">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-amber-100 border border-amber-200" /> محجوز</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-rose-500" /> مغلق</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-[var(--color-owner-bg)] border border-[var(--color-owner-border)]" /> متاح</span>
        </div>
      </div>

      {/* Day detail sheet */}
      <BottomSheet open={!!openDay} onClose={() => setOpenDay(null)} title={openDay ? new Date(openDay).toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''}>
        {openDay && (
          <div className="space-y-3">
            {openIsBlocked ? (
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 text-[11px] font-bold text-rose-800 flex items-center gap-2">
                <Lock className="w-4 h-4" /> هذا اليوم مغلق يدويًا (صيانة/خدمة).
              </div>
            ) : openBookings.length > 0 ? (
              <div className="space-y-2">
                <div className="text-[11px] font-black text-[var(--color-owner-text)]">{openBookings.length} حجز في هذا اليوم</div>
                {openBookings.map((b) => (
                  <div key={b.id} className="bg-[var(--color-owner-bg)] rounded-2xl p-3 space-y-1">
                    <div className="text-[11.5px] font-black text-[var(--color-owner-text)]">{b.organizationName || b.userName}</div>
                    <div className="text-[9.5px] font-bold text-[var(--color-owner-secondary)] flex items-center gap-2 flex-wrap">
                      <span>{b.checkIn} ← {b.checkOut}</span>
                      <span className="flex items-center gap-0.5"><Users className="w-3 h-3" /> {b.guestsCount}</span>
                      <span>{b.totalPrice.toLocaleString()} ج.م</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-[11px] font-bold text-emerald-800">هذا اليوم متاح وشاغر.</div>
            )}

            {openBookings.length === 0 && (
              <button type="button" onClick={() => { toggleBlockDay(openDay); setOpenDay(null); }}
                className={`w-full flex items-center justify-center gap-1.5 text-[11px] font-black py-3 rounded-2xl ${openIsBlocked ? 'bg-emerald-600 text-white' : 'bg-rose-500 text-white'}`}>
                {openIsBlocked ? <><Unlock className="w-4 h-4" /> إلغاء الحظر (إتاحة اليوم)</> : <><Lock className="w-4 h-4" /> حظر هذا اليوم (صيانة)</>}
              </button>
            )}
          </div>
        )}
      </BottomSheet>

      {/* Block range sheet */}
      <BottomSheet open={blockSheet} onClose={() => setBlockSheet(false)} title="حظر فترة">
        <div className="space-y-3">
          <p className="text-[10.5px] font-bold text-[var(--color-owner-secondary)] leading-relaxed">الأيام المحظورة تظهر فورًا كغير متاحة للحجز للجميع.</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[9.5px] font-black text-[var(--color-owner-secondary)] mb-1">من تاريخ</label>
              <input type="date" value={blkFrom} onChange={(e) => setBlkFrom(e.target.value)}
                className="w-full bg-[var(--color-owner-bg)] border border-[var(--color-owner-border)] text-[11px] px-2.5 py-2 rounded-xl text-[var(--color-owner-text)] outline-none text-left" />
            </div>
            <div>
              <label className="block text-[9.5px] font-black text-[var(--color-owner-secondary)] mb-1">إلى تاريخ (اختياري)</label>
              <input type="date" min={blkFrom || undefined} value={blkTo} onChange={(e) => setBlkTo(e.target.value)}
                className="w-full bg-[var(--color-owner-bg)] border border-[var(--color-owner-border)] text-[11px] px-2.5 py-2 rounded-xl text-[var(--color-owner-text)] outline-none text-left" />
            </div>
          </div>
          <button type="button" onClick={blockRange} disabled={!blkFrom}
            className="w-full flex items-center justify-center gap-1.5 bg-rose-500 disabled:opacity-40 text-white text-[11px] font-black py-3 rounded-2xl">
            <Lock className="w-4 h-4" /> حظر الفترة
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
