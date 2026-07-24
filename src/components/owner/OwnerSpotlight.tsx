import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Booking, Room } from '../../types';
import { Search, X, ClipboardList, BedDouble, Phone } from 'lucide-react';

interface OwnerSpotlightProps {
  open: boolean;
  onClose: () => void;
  bookings: Booking[];
  rooms: Room[];
  onOpenBooking: (id: string) => void;
  onGoRooms: () => void;
}

const guestName = (b: Booking) => b.organizationName || b.userName;
const bookingRef = (b: Booking) => `#${b.id.replace(/^booking_/, '').slice(-6)}`;

export default function OwnerSpotlight({ open, onClose, bookings, rooms, onOpenBooking, onGoRooms }: OwnerSpotlightProps) {
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) { setQ(''); setTimeout(() => inputRef.current?.focus(), 100); } }, [open]);

  const query = q.trim().toLowerCase();
  const bookingResults = useMemo(() => {
    if (!query) return [];
    return bookings.filter((b) => `${guestName(b)} ${b.userName} ${b.userPhone} ${bookingRef(b)}`.toLowerCase().includes(query)).slice(0, 8);
  }, [bookings, query]);
  const roomResults = useMemo(() => {
    if (!query) return [];
    return rooms.filter((r) => r.name.toLowerCase().includes(query)).slice(0, 8);
  }, [rooms, query]);

  const empty = query && bookingResults.length === 0 && roomResults.length === 0;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16" dir="rtl">
          <motion.div className="absolute inset-0 bg-black/40 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className="relative w-full max-w-md bg-[var(--color-owner-surface)] rounded-[24px] border border-[var(--color-owner-border)] shadow-2xl overflow-hidden z-10"
            initial={{ opacity: 0, y: -16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -16, scale: 0.98 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          >
            <div className="flex items-center gap-2 p-3 border-b border-[var(--color-owner-border)]">
              <Search className="w-4 h-4 text-[var(--color-owner-secondary)] shrink-0" />
              <input ref={inputRef} type="text" value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="ابحث عن حجز، ضيف، رقم هاتف، أو غرفة…"
                className="flex-1 bg-transparent text-[12px] text-[var(--color-owner-text)] outline-none" />
              <button type="button" onClick={onClose} className="p-1 rounded-full bg-[var(--color-owner-hover)] text-[var(--color-owner-secondary)]"><X className="w-3.5 h-3.5" /></button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-2">
              {!query ? (
                <p className="text-[11px] text-[var(--color-owner-secondary)] font-bold text-center py-8">اكتب للبحث في كل شيء دفعة واحدة.</p>
              ) : empty ? (
                <p className="text-[11px] text-[var(--color-owner-secondary)] font-bold text-center py-8">لا توجد نتائج لـ "{q}".</p>
              ) : (
                <div className="space-y-2">
                  {bookingResults.length > 0 && (
                    <div>
                      <div className="text-[9px] font-black text-[var(--color-owner-secondary)] px-2 py-1">الحجوزات</div>
                      {bookingResults.map((b) => (
                        <button key={b.id} type="button" onClick={() => { onOpenBooking(b.id); onClose(); }}
                          className="w-full flex items-center gap-2.5 p-2.5 rounded-2xl hover:bg-[var(--color-owner-hover)] text-right">
                          <span className="w-8 h-8 rounded-xl bg-[var(--color-owner-hover)] flex items-center justify-center shrink-0"><ClipboardList className="w-4 h-4 text-[var(--color-owner-primary)]" /></span>
                          <div className="flex-1 min-w-0">
                            <div className="text-[11.5px] font-black text-[var(--color-owner-text)] truncate">{guestName(b)}</div>
                            <div className="text-[9px] font-bold text-[var(--color-owner-secondary)] flex items-center gap-1.5">
                              <span className="font-mono">{bookingRef(b)}</span><span>· {b.checkIn}</span>
                              {b.userPhone && <span className="flex items-center gap-0.5"><Phone className="w-2.5 h-2.5" />{b.userPhone}</span>}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {roomResults.length > 0 && (
                    <div>
                      <div className="text-[9px] font-black text-[var(--color-owner-secondary)] px-2 py-1">الغرف</div>
                      {roomResults.map((r) => (
                        <button key={r.id} type="button" onClick={() => { onGoRooms(); onClose(); }}
                          className="w-full flex items-center gap-2.5 p-2.5 rounded-2xl hover:bg-[var(--color-owner-hover)] text-right">
                          <span className="w-8 h-8 rounded-xl bg-[var(--color-owner-hover)] flex items-center justify-center shrink-0"><BedDouble className="w-4 h-4 text-[var(--color-owner-primary)]" /></span>
                          <div className="flex-1 min-w-0">
                            <div className="text-[11.5px] font-black text-[var(--color-owner-text)]">غرفة {r.name}</div>
                            <div className="text-[9px] font-bold text-[var(--color-owner-secondary)]">{r.bedsCount} سرير</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
