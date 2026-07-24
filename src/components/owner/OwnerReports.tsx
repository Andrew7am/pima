import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { Booking, Review } from '../../types';
import { BarChart3, Home, Star, Users, CalendarCheck, Sun, Phone, Globe, Clock } from 'lucide-react';

interface OwnerReportsProps {
  ownerBookings: Booking[];
  ownerReviews: Review[];
  confirmedRevenue: number;
  platformCommissionAmount: number;
  netOwnerPayout: number;
  occupancyRate: number;
  avgRating: number;
}

const SEASONS = [
  { key: 'winter', label: 'الشتاء', months: [11, 0, 1] },
  { key: 'spring', label: 'الربيع', months: [2, 3, 4] },
  { key: 'summer', label: 'الصيف', months: [5, 6, 7] },
  { key: 'autumn', label: 'الخريف', months: [8, 9, 10] },
] as const;

const SOURCE_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  platform: { label: 'عبر المنصة', icon: Globe, color: '#1F2E4E' },
  manual: { label: 'يدوي (هاتف)', icon: Phone, color: '#22C55E' },
  temporary: { label: 'مؤقت', icon: Clock, color: '#F59E0B' },
};

export default function OwnerReports({ ownerBookings, ownerReviews, occupancyRate, avgRating }: OwnerReportsProps) {
  const confirmed = useMemo(() => ownerBookings.filter((b) => b.status === 'approved' || b.status === 'completed'), [ownerBookings]);

  // Last 6 months, oldest first, by check-in month.
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return { year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleDateString('ar-EG', { month: 'short' }) };
  });
  const monthCounts = months.map((m) => confirmed.filter((b) => { const d = new Date(b.checkIn); return d.getFullYear() === m.year && d.getMonth() === m.month; }).length);
  const maxCount = Math.max(1, ...monthCounts);

  const avgGroup = confirmed.length ? Math.round(confirmed.reduce((s, b) => s + b.guestsCount, 0) / confirmed.length) : 0;

  const sourceCounts = useMemo(() => {
    const c: Record<string, number> = { platform: 0, manual: 0, temporary: 0 };
    confirmed.forEach((b) => { const s = b.source || 'platform'; c[s] = (c[s] || 0) + 1; });
    return c;
  }, [confirmed]);
  const sourceTotal = Math.max(1, Object.values(sourceCounts).reduce((s, n) => s + n, 0));

  const seasonCounts = SEASONS.map((s) => confirmed.filter((b) => (s.months as readonly number[]).includes(new Date(b.checkIn).getMonth())).length);
  const maxSeason = Math.max(1, ...seasonCounts);

  return (
    <div className="space-y-3" dir="rtl">
      <div>
        <h2 className="text-base font-black text-[var(--color-owner-text)] flex items-center gap-1.5">
          <BarChart3 className="w-4.5 h-4.5 text-[var(--color-owner-primary)]" /> التقارير والرؤى
        </h2>
        <p className="text-[11px] text-[var(--color-owner-secondary)] mt-0.5">نظرة تشغيلية على أداء بيتك</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-2.5">
        {[
          { icon: Home, label: 'نسبة الإشغال (هذا الشهر)', value: `${occupancyRate}%`, color: 'text-[var(--color-owner-primary)]' },
          { icon: Star, label: 'متوسط التقييم', value: avgRating > 0 ? `${avgRating.toFixed(1)} ★` : '—', color: 'text-amber-500' },
          { icon: CalendarCheck, label: 'حجوزات مؤكدة', value: confirmed.length, color: 'text-emerald-600' },
          { icon: Users, label: 'متوسط حجم المجموعة', value: `${avgGroup} فرد`, color: 'text-[var(--color-owner-text)]' },
        ].map((k) => (
          <div key={k.label} className="bg-[var(--color-owner-surface)] rounded-2xl border border-[var(--color-owner-border)] p-3 space-y-1">
            <k.icon className="w-4 h-4 text-[var(--color-owner-primary)]" />
            <div className={`text-lg font-black ${k.color}`}>{k.value}</div>
            <div className="text-[9px] font-bold text-[var(--color-owner-secondary)]">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Bookings — last 6 months */}
      <div className="bg-[var(--color-owner-surface)] rounded-[24px] border border-[var(--color-owner-border)] p-4 space-y-3 shadow-sm">
        <span className="text-xs font-black text-[var(--color-owner-text)]">الحجوزات خلال آخر 6 أشهر</span>
        <div className="flex items-end justify-between gap-2 h-32">
          {months.map((m, i) => (
            <div key={`${m.year}-${m.month}`} className="flex-1 flex flex-col items-center gap-1.5">
              <span className="text-[9px] font-bold text-[var(--color-owner-text)]">{monthCounts[i] || ''}</span>
              <motion.div initial={{ height: 0 }} animate={{ height: `${Math.max(4, (monthCounts[i] / maxCount) * 100)}%` }}
                transition={{ duration: 0.6, delay: i * 0.06, ease: 'easeOut' }}
                className="w-full max-w-[28px] rounded-t-lg bg-[var(--color-owner-primary)]" style={{ minHeight: 4 }} />
              <span className="text-[9px] text-[var(--color-owner-secondary)] font-bold">{m.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Booking source split */}
      <div className="bg-[var(--color-owner-surface)] rounded-[24px] border border-[var(--color-owner-border)] p-4 space-y-3 shadow-sm">
        <span className="text-xs font-black text-[var(--color-owner-text)]">مصادر الحجوزات</span>
        <div className="space-y-2">
          {Object.entries(sourceCounts).filter(([, n]) => n > 0).map(([src, n]) => {
            const meta = SOURCE_META[src];
            const pct = Math.round((n / sourceTotal) * 100);
            return (
              <div key={src} className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-[10px] font-bold text-[var(--color-owner-secondary)] w-24 shrink-0"><meta.icon className="w-3 h-3" /> {meta.label}</span>
                <span className="flex-1 h-2.5 rounded-full bg-[var(--color-owner-bg)] overflow-hidden">
                  <motion.span className="block h-full rounded-full" style={{ background: meta.color }} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6 }} />
                </span>
                <span className="text-[9px] font-black text-[var(--color-owner-secondary)] w-12 shrink-0 text-left">{pct}% ({n})</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top seasons */}
      <div className="bg-[var(--color-owner-surface)] rounded-[24px] border border-[var(--color-owner-border)] p-4 space-y-3 shadow-sm">
        <span className="text-xs font-black text-[var(--color-owner-text)] flex items-center gap-1.5"><Sun className="w-4 h-4 text-amber-500" /> أعلى المواسم حجزًا</span>
        <div className="flex items-end justify-between gap-2 h-28">
          {SEASONS.map((s, i) => (
            <div key={s.key} className="flex-1 flex flex-col items-center gap-1.5">
              <span className="text-[9px] font-bold text-[var(--color-owner-text)]">{seasonCounts[i] || ''}</span>
              <motion.div initial={{ height: 0 }} animate={{ height: `${Math.max(4, (seasonCounts[i] / maxSeason) * 100)}%` }}
                transition={{ duration: 0.6, delay: i * 0.08, ease: 'easeOut' }}
                className="w-full max-w-[36px] rounded-t-lg bg-amber-400" style={{ minHeight: 4 }} />
              <span className="text-[9px] text-[var(--color-owner-secondary)] font-bold">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {ownerReviews.length > 0 && (
        <p className="text-[9.5px] text-[var(--color-owner-secondary)] font-bold text-center">توزيع التقييمات وتفاصيلها في صفحة "التقييمات".</p>
      )}
    </div>
  );
}
