import React, { useState } from 'react';
import { Booking, Room, RoomAllocation } from '../../types';
import { BedDouble, Shuffle, RefreshCw } from 'lucide-react';
import { getRoomBedState } from '../../lib/roomOccupancy';

interface OwnerRoomDistributionProps {
  rooms: Room[];
  allocations: RoomAllocation[];
  bookings: Booking[];
  onOpenBooking: (booking: Booking) => void;
  onRecalculateAll: () => Promise<void>;
}

const STATE_LABEL: Record<string, string> = {
  available: 'متاحة', partial: 'مشغولة جزئياً', full: 'ممتلئة', cleaning: 'تنظيف', maintenance: 'صيانة',
};
const STATE_CLASS: Record<string, string> = {
  available: 'bg-emerald-50 border-emerald-300 text-emerald-900',
  partial: 'bg-amber-50 border-amber-300 text-amber-900',
  full: 'bg-rose-50 border-rose-300 text-rose-900',
  cleaning: 'bg-sky-50 border-sky-300 text-sky-900',
  maintenance: 'bg-slate-100 border-slate-300 text-slate-700',
};

export default function OwnerRoomDistribution({ rooms, allocations, bookings, onOpenBooking, onRecalculateAll }: OwnerRoomDistributionProps) {
  const [viewDate, setViewDate] = useState(new Date().toISOString().split('T')[0]);
  const [recalculating, setRecalculating] = useState(false);

  const needsAttention = bookings
    .filter((b) => (b.status === 'pending' || b.status === 'approved'))
    .map((b) => {
      const allocatedCount = allocations.filter((al) => al.bookingId === b.id).length;
      return { booking: b, allocatedCount };
    })
    .filter(({ booking, allocatedCount }) => allocatedCount < booking.guestsCount)
    .sort((a, b) => a.booking.checkIn.localeCompare(b.booking.checkIn));

  return (
    <div className="space-y-4">
      <div className="bg-[var(--color-owner-surface)] rounded-3xl border border-[var(--color-owner-border)] p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-black text-[var(--color-owner-text)]">خريطة إشغال الغرف</h3>
          <div className="flex items-center gap-2">
            <input type="date" value={viewDate} onChange={(e) => setViewDate(e.target.value)}
              className="bg-[var(--color-owner-bg)] border border-[var(--color-owner-border)] rounded-xl px-2.5 py-1.5 text-[10px] text-[var(--color-owner-text)]" />
            <button
              type="button"
              disabled={recalculating}
              onClick={async () => { setRecalculating(true); await onRecalculateAll(); setRecalculating(false); }}
              className="flex items-center gap-1.5 bg-[var(--color-owner-primary)] hover:bg-[var(--color-owner-primary-hover)] text-white text-[10px] font-extrabold px-3 py-1.5 rounded-xl cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{recalculating ? 'جارٍ إعادة التوزيع...' : 'إعادة حساب التوزيع'}</span>
            </button>
          </div>
        </div>

        {rooms.length === 0 ? (
          <div className="text-center py-6 text-[10px] text-[var(--color-owner-secondary)]">لا توجد غرف مضافة بعد. أضف غرفك من تبويب "عرض الغرف".</div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
            {rooms.map((room) => {
              const state = getRoomBedState(room, allocations, bookings, viewDate);
              const used = allocations.filter((al) => al.roomId === room.id && bookings.some((b) => b.id === al.bookingId && (b.status === 'pending' || b.status === 'approved') && viewDate >= b.checkIn && viewDate < b.checkOut)).length;
              return (
                <div key={room.id} className={`flex flex-col items-center justify-center gap-1 aspect-square rounded-2xl border-2 p-2 text-center ${STATE_CLASS[state]}`}>
                  <BedDouble className="w-4 h-4" />
                  <span className="text-[10px] font-black truncate w-full">{room.name}</span>
                  <span className="text-[8px] font-bold">{used} / {room.bedsCount} — {STATE_LABEL[state]}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-[var(--color-owner-surface)] rounded-3xl border border-[var(--color-owner-border)] p-4 space-y-2">
        <h3 className="text-sm font-black text-[var(--color-owner-text)]">حجوزات بحاجة لتوزيع</h3>
        {needsAttention.length === 0 ? (
          <div className="text-center py-4 text-[10px] text-[var(--color-owner-secondary)]">كل الحجوزات النشطة مُوزّعة على الغرف بالكامل 🎉</div>
        ) : (
          <div className="space-y-2">
            {needsAttention.map(({ booking, allocatedCount }) => (
              <div key={booking.id} className="flex items-center justify-between gap-2 bg-[var(--color-owner-bg)] border border-[var(--color-owner-border)] rounded-2xl p-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-[var(--color-owner-text)] truncate">{booking.userName}</div>
                  <div className="text-[9.5px] text-[var(--color-owner-secondary)]">{booking.checkIn} → {booking.checkOut} • مُوزَّع {allocatedCount} / {booking.guestsCount}</div>
                </div>
                <button type="button" onClick={() => onOpenBooking(booking)}
                  className="flex items-center gap-1 shrink-0 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all cursor-pointer">
                  <Shuffle className="w-3.5 h-3.5" /><span>توزيع الآن</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
