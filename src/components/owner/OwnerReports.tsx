import React from 'react';
import { motion } from 'motion/react';
import { Booking, Review } from '../../types';
import { BarChart3, TrendingUp, Star, Home, Sun } from 'lucide-react';

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

export default function OwnerReports({ ownerBookings, ownerReviews, confirmedRevenue, platformCommissionAmount, netOwnerPayout, occupancyRate, avgRating }: OwnerReportsProps) {
  // Last 6 calendar months, oldest first, counting bookings by check-in month.
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return { year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleDateString('ar-EG', { month: 'short' }) };
  });
  const monthCounts = months.map((m) =>
    ownerBookings.filter((b) => {
      const d = new Date(b.checkIn);
      return d.getFullYear() === m.year && d.getMonth() === m.month;
    }).length
  );
  const maxCount = Math.max(1, ...monthCounts);

  const commissionPct = confirmedRevenue > 0 ? Math.round((platformCommissionAmount / confirmedRevenue) * 100) : 0;

  const ratingCounts = [5, 4, 3, 2, 1].map((star) => ownerReviews.filter((r) => Math.round(r.rating) === star).length);
  const maxRatingCount = Math.max(1, ...ratingCounts);

  const seasonCounts = SEASONS.map((s) => ownerBookings.filter((b) => (s.months as readonly number[]).includes(new Date(b.checkIn).getMonth())).length);
  const maxSeasonCount = Math.max(1, ...seasonCounts);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[var(--color-owner-surface)] rounded-2xl border border-[var(--color-owner-border)] p-3 space-y-1">
          <Home className="w-4 h-4 text-[var(--color-owner-primary)]" />
          <div className="text-[9px] text-[var(--color-owner-secondary)] font-bold">نسبة الإشغال (شهر جاري)</div>
          <div className="text-lg font-extrabold text-[var(--color-owner-text)]">{occupancyRate}%</div>
        </div>
        <div className="bg-[var(--color-owner-surface)] rounded-2xl border border-[var(--color-owner-border)] p-3 space-y-1">
          <Star className="w-4 h-4 text-[var(--color-owner-accent)]" />
          <div className="text-[9px] text-[var(--color-owner-secondary)] font-bold">متوسط التقييم</div>
          <div className="text-lg font-extrabold text-[var(--color-owner-text)]">{avgRating > 0 ? avgRating.toFixed(1) : '—'} / 5</div>
        </div>
      </div>

      <div className="bg-[var(--color-owner-surface)] rounded-3xl border border-[var(--color-owner-border)] p-4 space-y-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-[var(--color-owner-primary)]" />
          <span className="text-xs font-black text-[var(--color-owner-text)]">الحجوزات خلال آخر 6 أشهر</span>
        </div>
        <div className="flex items-end justify-between gap-2 h-32">
          {months.map((m, i) => (
            <div key={`${m.year}-${m.month}`} className="flex-1 flex flex-col items-center gap-1.5">
              <span className="text-[9px] font-bold text-[var(--color-owner-text)]">{monthCounts[i] || ''}</span>
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(4, (monthCounts[i] / maxCount) * 100)}%` }}
                transition={{ duration: 0.6, delay: i * 0.06, ease: 'easeOut' }}
                className="w-full max-w-[28px] rounded-t-lg bg-[var(--color-owner-primary)]"
                style={{ minHeight: 4 }}
              />
              <span className="text-[9px] text-[var(--color-owner-secondary)] font-bold">{m.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[var(--color-owner-surface)] rounded-3xl border border-[var(--color-owner-border)] p-4 space-y-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[var(--color-owner-primary)]" />
          <span className="text-xs font-black text-[var(--color-owner-text)]">توزيع الإيرادات المؤكدة</span>
        </div>
        <div className="h-3 w-full rounded-full bg-[var(--color-owner-bg)] overflow-hidden flex">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${100 - commissionPct}%` }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="h-full bg-[var(--color-owner-primary)]"
          />
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${commissionPct}%` }}
            transition={{ duration: 0.7, delay: 0.1, ease: 'easeOut' }}
            className="h-full bg-[var(--color-owner-accent)]"
          />
        </div>
        <div className="flex justify-between text-[10px] font-bold">
          <span className="flex items-center gap-1.5 text-[var(--color-owner-text)]">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-owner-primary)]" /> صافي مستحقاتك: {netOwnerPayout.toLocaleString()} ج.م
          </span>
          <span className="flex items-center gap-1.5 text-[var(--color-owner-secondary)]">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-owner-accent)]" /> عمولة المنصة: {platformCommissionAmount.toLocaleString()} ج.م
          </span>
        </div>
      </div>

      <div className="bg-[var(--color-owner-surface)] rounded-3xl border border-[var(--color-owner-border)] p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4 text-[var(--color-owner-accent)]" />
          <span className="text-xs font-black text-[var(--color-owner-text)]">توزيع التقييمات</span>
        </div>
        {ownerReviews.length === 0 ? (
          <p className="text-[10px] text-[var(--color-owner-secondary)]">لا توجد تقييمات مسجلة بعد.</p>
        ) : (
          <div className="space-y-1.5">
            {[5, 4, 3, 2, 1].map((star, i) => (
              <div key={star} className="flex items-center gap-2">
                <span className="text-[9px] font-bold text-[var(--color-owner-secondary)] w-8 shrink-0">{star} ★</span>
                <div className="flex-1 h-2.5 rounded-full bg-[var(--color-owner-bg)] overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(ratingCounts[i] / maxRatingCount) * 100}%` }}
                    transition={{ duration: 0.5, delay: i * 0.05, ease: 'easeOut' }}
                    className="h-full bg-[var(--color-owner-accent)]"
                  />
                </div>
                <span className="text-[9px] font-bold text-[var(--color-owner-text)] w-4 shrink-0">{ratingCounts[i]}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-[var(--color-owner-surface)] rounded-3xl border border-[var(--color-owner-border)] p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Sun className="w-4 h-4 text-[var(--color-owner-primary)]" />
          <span className="text-xs font-black text-[var(--color-owner-text)]">أعلى المواسم حجزًا</span>
        </div>
        <div className="flex items-end justify-between gap-2 h-28">
          {SEASONS.map((s, i) => (
            <div key={s.key} className="flex-1 flex flex-col items-center gap-1.5">
              <span className="text-[9px] font-bold text-[var(--color-owner-text)]">{seasonCounts[i] || ''}</span>
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(4, (seasonCounts[i] / maxSeasonCount) * 100)}%` }}
                transition={{ duration: 0.6, delay: i * 0.08, ease: 'easeOut' }}
                className="w-full max-w-[36px] rounded-t-lg bg-[var(--color-owner-accent)]"
                style={{ minHeight: 4 }}
              />
              <span className="text-[9px] text-[var(--color-owner-secondary)] font-bold">{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
