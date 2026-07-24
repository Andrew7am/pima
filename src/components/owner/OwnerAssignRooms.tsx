import React, { useMemo, useState, useEffect } from 'react';
import { Booking, Room, RoomAllocation } from '../../types';
import { BedDouble, Check, Sparkles, Users, Send } from 'lucide-react';
import BottomSheet from './BottomSheet';
import { getRoomFreeBedsForRange } from '../../lib/roomOccupancy';

interface OwnerAssignRoomsProps {
  open: boolean;
  onClose: () => void;
  booking: Booking | null;
  rooms: Room[];
  allocations: RoomAllocation[];
  bookings: Booking[];
  onSave: (bookingId: string, roomIds: string[]) => void;
}

export default function OwnerAssignRooms({ open, onClose, booking, rooms, allocations, bookings, onSave }: OwnerAssignRoomsProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Rooms of this house that have at least one free bed across the stay.
  const available = useMemo(() => {
    if (!booking) return [];
    return rooms
      .filter((r) => r.houseId === booking.houseId && r.status !== 'maintenance')
      .map((r) => ({ room: r, free: getRoomFreeBedsForRange(r, allocations, bookings, booking.checkIn, booking.checkOut, booking.id) }))
      .filter((x) => x.free > 0)
      .sort((a, b) => b.free - a.free || a.room.name.localeCompare(b.room.name, 'ar'));
  }, [booking, rooms, allocations, bookings]);

  // Pre-select: the booking's existing assignment, or auto-suggest enough
  // rooms to cover the head-count.
  useEffect(() => {
    if (!open || !booking) return;
    if (booking.assignedRoomIds?.length) { setSelected(new Set(booking.assignedRoomIds)); return; }
    const pick = new Set<string>();
    let beds = 0;
    for (const { room, free } of available) {
      if (beds >= booking.guestsCount) break;
      pick.add(room.id); beds += free;
    }
    setSelected(pick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, booking?.id]);

  if (!booking) return null;

  const bedsFor = (id: string) => available.find((x) => x.room.id === id)?.free ?? 0;
  const selectedBeds = [...selected].reduce((s, id) => s + bedsFor(id), 0);
  const enough = selectedBeds >= booking.guestsCount;
  const toggle = (id: string) => setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const autoSuggest = () => {
    const pick = new Set<string>(); let beds = 0;
    for (const { room, free } of available) { if (beds >= booking.guestsCount) break; pick.add(room.id); beds += free; }
    setSelected(pick);
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="تخصيص الغرف للحاجز">
      <div className="space-y-3">
        <div className="bg-[var(--color-owner-bg)] rounded-2xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--color-owner-secondary)]">
            <Users className="w-3.5 h-3.5" /> {booking.organizationName || booking.userName} · {booking.guestsCount} فرد
          </div>
          <button type="button" onClick={autoSuggest} className="flex items-center gap-1 text-[10px] font-black text-[var(--color-owner-primary)] bg-[var(--color-owner-surface)] border border-[var(--color-owner-border)] rounded-lg px-2 py-1">
            <Sparkles className="w-3 h-3" /> اقتراح تلقائي
          </button>
        </div>

        {/* Progress toward the head-count */}
        <div className={`rounded-2xl p-3 border ${enough ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
          <div className="flex items-center justify-between text-[11px] font-black">
            <span className={enough ? 'text-emerald-800' : 'text-amber-800'}>الأسرّة المحدّدة: {selectedBeds} / {booking.guestsCount}</span>
            <span className={enough ? 'text-emerald-700' : 'text-amber-700'}>{enough ? 'كافٍ ✓' : `ناقص ${booking.guestsCount - selectedBeds}`}</span>
          </div>
        </div>

        {available.length === 0 ? (
          <p className="text-[11px] font-bold text-[var(--color-owner-secondary)] text-center py-4">لا توجد غرف متاحة في هذه الفترة. أضف غرفًا أو حرّر التواريخ.</p>
        ) : (
          <div className="space-y-1.5 max-h-[40vh] overflow-y-auto">
            {available.map(({ room, free }) => {
              const on = selected.has(room.id);
              return (
                <button key={room.id} type="button" onClick={() => toggle(room.id)}
                  className={`w-full flex items-center gap-2.5 rounded-2xl border p-3 text-right transition-all ${on ? 'bg-[var(--color-owner-primary)]/8 border-[var(--color-owner-primary)]' : 'bg-[var(--color-owner-surface)] border-[var(--color-owner-border)]'}`}>
                  <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${on ? 'bg-[var(--color-owner-primary)] border-[var(--color-owner-primary)]' : 'border-[var(--color-owner-border)]'}`}>
                    {on && <Check className="w-3 h-3 text-white" />}
                  </span>
                  <BedDouble className="w-4 h-4 text-[var(--color-owner-primary)] shrink-0" />
                  <span className="flex-1 text-[12px] font-black text-[var(--color-owner-text)]">غرفة {room.name}</span>
                  <span className="text-[10px] font-bold text-[var(--color-owner-secondary)]">{free} سرير متاح</span>
                </button>
              );
            })}
          </div>
        )}

        <button type="button" onClick={() => { onSave(booking.id, [...selected]); onClose(); }} disabled={selected.size === 0}
          className="w-full flex items-center justify-center gap-1.5 bg-[var(--color-owner-primary)] disabled:opacity-40 text-white text-[11px] font-black py-3 rounded-2xl">
          <Send className="w-4 h-4" /> إرسال {selected.size} غرفة للحاجز
        </button>
        <p className="text-[9.5px] font-bold text-[var(--color-owner-secondary)] text-center leading-relaxed">بعد الإرسال، الحاجز (الخادم) هو اللي يكتب أسماء المشاركين ويوزّعهم داخل الغرف دي.</p>
      </div>
    </BottomSheet>
  );
}
