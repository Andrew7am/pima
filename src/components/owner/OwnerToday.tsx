import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { RetreatHouse, Booking, Room } from '../../types';
import { Sun, LogIn, LogOut, Sparkles, Banknote, Users, TrendingUp, TrendingDown, CheckCircle2, Wrench, ScanLine } from 'lucide-react';
import OwnerScanner from './OwnerScanner';

interface OwnerTodayProps {
  house?: RetreatHouse;
  bookings: Booking[];
  rooms: Room[];
  todayStr: string;
  onCheckInBooking?: (bookingId: string) => void;
  onCheckOutBooking?: (bookingId: string) => void;
  onUpdateRoom?: (room: Room) => void;
  onViewBooking?: (bookingId: string) => void;
}

const guestName = (b: Booking) => b.organizationName || b.userName;

export default function OwnerToday({ house, bookings, rooms, todayStr, onCheckInBooking, onCheckOutBooking, onUpdateRoom, onViewBooking }: OwnerTodayProps) {
  const [scannerOpen, setScannerOpen] = useState(false);
  const confirmed = useMemo(() => bookings.filter((b) => b.status === 'approved' || b.status === 'completed'), [bookings]);
  const arrivals = confirmed.filter((b) => b.checkIn === todayStr);
  const departures = confirmed.filter((b) => b.checkOut === todayStr);
  const cleaningRooms = rooms.filter((r) => r.status === 'cleaning');
  const maintenanceRooms = rooms.filter((r) => r.status === 'maintenance');

  const guestsToday = arrivals.reduce((s, b) => s + b.guestsCount, 0);
  const cashExpected = arrivals.reduce((s, b) => s + Math.max(0, b.totalPrice - b.depositAmount), 0);

  // Current-month occupancy → a simple pricing nudge.
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const mStart = new Date(y, m, 1), mEnd = new Date(y, m + 1, 0);
  const occupiedDays = (() => {
    const set = new Set<string>();
    confirmed.forEach((b) => {
      const s = new Date(b.checkIn) > mStart ? new Date(b.checkIn) : mStart;
      const e = new Date(b.checkOut) < mEnd ? new Date(b.checkOut) : mEnd;
      for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) set.add(d.toISOString().split('T')[0]);
    });
    return set.size;
  })();
  const occupancy = daysInMonth > 0 ? Math.round((occupiedDays / daysInMonth) * 100) : 0;
  const monthLabel = now.toLocaleDateString('ar-EG', { month: 'long' });
  const pricing = occupancy >= 70
    ? { up: true, text: `إشغالك مرتفع هذا الشهر (${occupancy}%). فكّر في رفع السعر 10–15% لزيادة الأرباح.` }
    : occupancy <= 30
      ? { up: false, text: `إشغال ${monthLabel} منخفض (${occupancy}%). عرض أو خصم بسيط قد يملأ الغرف الفاضية.` }
      : null;

  const dateLabel = new Date(todayStr).toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' });

  const Section = ({ title, icon: Icon, count, children }: { title: string; icon: React.ElementType; count: number; children: React.ReactNode }) => (
    <div className="bg-[var(--color-owner-surface)] rounded-[24px] border border-[var(--color-owner-border)] p-4 space-y-2.5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-black text-[var(--color-owner-text)] flex items-center gap-1.5"><Icon className="w-4 h-4 text-[var(--color-owner-primary)]" /> {title}</span>
        <span className="text-[10px] font-black text-[var(--color-owner-secondary)] bg-[var(--color-owner-bg)] rounded-full px-2 py-0.5">{count}</span>
      </div>
      {children}
    </div>
  );

  return (
    <div className="space-y-3" dir="rtl">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-black text-[var(--color-owner-text)] flex items-center gap-1.5">
            <Sun className="w-4.5 h-4.5 text-[#D4AF37]" /> لوحة اليوم
          </h2>
          <p className="text-[11px] text-[var(--color-owner-secondary)] mt-0.5">{dateLabel} — {house?.name || 'بيتك'}</p>
        </div>
        {onCheckInBooking && (
          <button type="button" onClick={() => setScannerOpen(true)}
            className="flex items-center gap-1 text-[10px] font-black text-white bg-[var(--color-owner-primary)] rounded-xl px-2.5 py-2 active:scale-95 transition-transform">
            <ScanLine className="w-3.5 h-3.5" /> مسح وصول
          </button>
        )}
      </div>

      <OwnerScanner open={scannerOpen} onClose={() => setScannerOpen(false)} bookings={confirmed}
        onCheckIn={(b) => onCheckInBooking?.(b.id)} />


      {/* Hero */}
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { icon: LogIn, label: 'وصول اليوم', value: arrivals.length, color: 'text-[var(--color-owner-primary)]' },
          { icon: Users, label: 'ضيوف متوقعون', value: guestsToday, color: 'text-emerald-600' },
          { icon: Banknote, label: 'كاش متوقع', value: cashExpected.toLocaleString(), color: 'text-amber-600', small: true },
        ].map((s) => (
          <div key={s.label} className="bg-[var(--color-owner-surface)] rounded-2xl border border-[var(--color-owner-border)] p-3 flex flex-col items-center gap-1 text-center">
            <s.icon className="w-4 h-4 text-[var(--color-owner-primary)]" />
            <span className={`${s.small ? 'text-sm' : 'text-xl'} font-black text-[var(--color-owner-text)] leading-none`}>{s.value}</span>
            <span className="text-[8.5px] font-bold text-[var(--color-owner-secondary)]">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Pricing nudge */}
      {pricing && (
        <div className="flex items-center gap-2.5 bg-[#D4AF37]/10 border border-[#D4AF37]/25 rounded-2xl p-3">
          <div className="w-8 h-8 rounded-xl bg-[#D4AF37]/20 flex items-center justify-center shrink-0">
            {pricing.up ? <TrendingUp className="w-4 h-4 text-[#B8901F]" /> : <TrendingDown className="w-4 h-4 text-[#B8901F]" />}
          </div>
          <p className="text-[10.5px] font-bold text-[var(--color-owner-text)] leading-relaxed">{pricing.text}</p>
        </div>
      )}

      {/* Arrivals */}
      <Section title="الوصول اليوم" icon={LogIn} count={arrivals.length}>
        {arrivals.length === 0 ? (
          <p className="text-[10.5px] text-[var(--color-owner-secondary)] font-bold text-center py-2">لا يوجد وصول اليوم.</p>
        ) : arrivals.map((b) => (
          <motion.div key={b.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between gap-2 bg-[var(--color-owner-bg)] rounded-2xl p-2.5">
            <button type="button" onClick={() => onViewBooking?.(b.id)} className="min-w-0 text-right">
              <div className="text-[11px] font-black text-[var(--color-owner-text)] truncate">{guestName(b)}</div>
              <div className="text-[9px] font-bold text-[var(--color-owner-secondary)]">{b.guestsCount} فرد · متبقٍ {Math.max(0, b.totalPrice - b.depositAmount).toLocaleString()} ج.م</div>
            </button>
            {b.checkedInAt ? (
              <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-1 shrink-0">وصل ✓</span>
            ) : onCheckInBooking && (
              <button type="button" onClick={() => onCheckInBooking(b.id)}
                className="flex items-center gap-1 bg-[var(--color-owner-primary)] text-white text-[10px] font-black px-3 py-1.5 rounded-xl shrink-0 active:scale-95 transition-transform">
                <LogIn className="w-3.5 h-3.5" /> تسجيل وصول
              </button>
            )}
          </motion.div>
        ))}
      </Section>

      {/* Departures */}
      <Section title="المغادرة اليوم" icon={LogOut} count={departures.length}>
        {departures.length === 0 ? (
          <p className="text-[10.5px] text-[var(--color-owner-secondary)] font-bold text-center py-2">لا يوجد مغادرة اليوم.</p>
        ) : departures.map((b) => (
          <div key={b.id} className="flex items-center justify-between gap-2 bg-[var(--color-owner-bg)] rounded-2xl p-2.5">
            <button type="button" onClick={() => onViewBooking?.(b.id)} className="min-w-0 text-right">
              <div className="text-[11px] font-black text-[var(--color-owner-text)] truncate">{guestName(b)}</div>
              <div className="text-[9px] font-bold text-[var(--color-owner-secondary)]">{b.guestsCount} فرد</div>
            </button>
            {b.checkedOutAt ? (
              <span className="text-[9px] font-black text-[var(--color-owner-secondary)] bg-[var(--color-owner-surface)] border border-[var(--color-owner-border)] rounded-full px-2 py-1 shrink-0">غادر ✓</span>
            ) : onCheckOutBooking && (
              <button type="button" onClick={() => onCheckOutBooking(b.id)}
                className="flex items-center gap-1 bg-slate-600 text-white text-[10px] font-black px-3 py-1.5 rounded-xl shrink-0 active:scale-95 transition-transform">
                <LogOut className="w-3.5 h-3.5" /> تسجيل خروج
              </button>
            )}
          </div>
        ))}
      </Section>

      {/* Housekeeping */}
      <Section title="النظافة والصيانة" icon={Sparkles} count={cleaningRooms.length + maintenanceRooms.length}>
        {cleaningRooms.length + maintenanceRooms.length === 0 ? (
          <p className="text-[10.5px] text-emerald-700 font-bold text-center py-2">كل الغرف جاهزة ✨</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {[...cleaningRooms, ...maintenanceRooms].map((r) => {
              const isClean = r.status === 'cleaning';
              return (
                <div key={r.id} className={`flex items-center justify-between gap-1 rounded-2xl p-2.5 border ${isClean ? 'bg-orange-50 border-orange-200' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="min-w-0">
                    <div className="text-[11px] font-black text-[var(--color-owner-text)]">{r.name}</div>
                    <div className={`text-[8.5px] font-black flex items-center gap-0.5 ${isClean ? 'text-orange-600' : 'text-slate-500'}`}>
                      {isClean ? <><Sparkles className="w-2.5 h-2.5" /> تنظيف</> : <><Wrench className="w-2.5 h-2.5" /> صيانة</>}
                    </div>
                  </div>
                  {onUpdateRoom && (
                    <button type="button" onClick={() => onUpdateRoom({ ...r, status: 'available' })}
                      className="flex items-center gap-0.5 bg-emerald-600 text-white text-[9px] font-black px-2 py-1 rounded-lg shrink-0 active:scale-95 transition-transform">
                      <CheckCircle2 className="w-3 h-3" /> خلصت
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
}
