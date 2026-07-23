import React, { useMemo, useRef, useState } from 'react';
import { Room, RoomType, RoomFacility, Booking, RoomAllocation } from '../../types';
import {
  BedDouble, Snowflake, Crown, Users, Bath, Tv, Wifi, Box, Trees,
  Search, Filter, Plus, MoreVertical, Trash2, Pencil, CheckCircle2, Clock,
  Wrench, Sparkles, Calendar, LogOut, Layers, Tag, DollarSign, ArrowRightLeft,
  ChevronLeft, X, Check,
} from 'lucide-react';
import BottomSheet from './BottomSheet';

interface OwnerRoomsManagerProps {
  houseId?: string;
  houseName?: string;
  rooms: Room[];
  bookings: Booking[];
  allocations: RoomAllocation[];
  roomTypes: RoomType[];
  todayStr: string;
  onAddRoom?: (room: Room) => void;
  onUpdateRoom?: (room: Room) => void;
  onDeleteRoom?: (roomId: string) => void;
  onAddRoomType?: (t: RoomType) => void;
  onUpdateRoomType?: (t: RoomType) => void;
  onDeleteRoomType?: (id: string) => void;
  onCheckOutBooking?: (bookingId: string) => void;
  onViewBooking?: (bookingId: string) => void;
  onExtendBooking?: (bookingId: string, checkOut: string) => void;
  onBookRoom?: () => void;
}

type EffStatus = 'available' | 'occupied' | 'cleaning' | 'maintenance' | 'upcoming';

const STATUS_META: Record<EffStatus, { label: string; card: string; dot: string; text: string }> = {
  available:   { label: 'متاحة',   card: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500', text: 'text-emerald-700' },
  occupied:    { label: 'مشغولة',  card: 'bg-rose-50 border-rose-200',       dot: 'bg-rose-500',    text: 'text-rose-700' },
  cleaning:    { label: 'تنظيف',   card: 'bg-orange-50 border-orange-200',   dot: 'bg-orange-500',  text: 'text-orange-700' },
  maintenance: { label: 'صيانة',   card: 'bg-slate-100 border-slate-200',    dot: 'bg-slate-400',   text: 'text-slate-600' },
  upcoming:    { label: 'حجز قادم', card: 'bg-sky-50 border-sky-200',        dot: 'bg-sky-500',     text: 'text-sky-700' },
};

const TYPE_ICON: Record<string, React.ElementType> = { ac: Snowflake, standard: BedDouble, vip: Crown, family: Users };
const TYPE_ICON_OPTIONS: { key: string; label: string }[] = [
  { key: 'ac', label: 'مكيفة' }, { key: 'standard', label: 'عادية' }, { key: 'vip', label: 'VIP' }, { key: 'family', label: 'عائلية' },
];

const FACILITIES: { key: RoomFacility; label: string; icon: React.ElementType }[] = [
  { key: 'ac', label: 'تكييف', icon: Snowflake },
  { key: 'bathroom', label: 'حمام خاص', icon: Bath },
  { key: 'tv', label: 'تلفزيون', icon: Tv },
  { key: 'wifi', label: 'واي فاي', icon: Wifi },
  { key: 'fridge', label: 'تلاجة', icon: Box },
  { key: 'balcony', label: 'شرفة', icon: Trees },
];

const FILTERS: { key: 'all' | EffStatus; label: string }[] = [
  { key: 'all', label: 'الكل' },
  { key: 'available', label: 'متاحة' },
  { key: 'occupied', label: 'مشغولة' },
  { key: 'cleaning', label: 'تنظيف' },
  { key: 'maintenance', label: 'صيانة' },
  { key: 'upcoming', label: 'حجز قادم' },
];

function nightsBetween(checkIn: string, checkOut: string): number {
  return Math.max(0, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000));
}
function floorLabel(floor: number): string {
  if (floor === 0) return 'الأرضي';
  const names = ['', 'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس'];
  return names[floor] ?? `الدور ${floor}`;
}

export default function OwnerRoomsManager({
  houseId, houseName, rooms, bookings, allocations, roomTypes, todayStr,
  onAddRoom, onUpdateRoom, onDeleteRoom, onAddRoomType, onUpdateRoomType, onDeleteRoomType,
  onCheckOutBooking, onViewBooking, onExtendBooking, onBookRoom,
}: OwnerRoomsManagerProps) {
  const [view, setView] = useState<'rooms' | 'types'>('rooms');
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | EffStatus>('all');
  const [floorFilter, setFloorFilter] = useState<'all' | number>('all');
  const [openRoomId, setOpenRoomId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editRoom, setEditRoom] = useState<Room | null>(null);
  const [extendFor, setExtendFor] = useState<string | null>(null);

  // Multi-select (long-press) + bulk-action sheets.
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkSheet, setBulkSheet] = useState<null | 'status' | 'type' | 'price' | 'floor'>(null);
  const longPress = useRef<ReturnType<typeof setTimeout> | null>(null);

  const typeById = useMemo(() => new Map(roomTypes.map((t) => [t.id, t])), [roomTypes]);

  // ── Occupancy derived from real bookings/allocations ──
  const activeBookings = useMemo(() => bookings.filter((b) => b.status === 'pending' || b.status === 'approved'), [bookings]);
  const roomBookings = (roomId: string): Booking[] => {
    const ids = new Set(allocations.filter((a) => a.roomId === roomId).map((a) => a.bookingId));
    return activeBookings.filter((b) => ids.has(b.id));
  };
  const currentBooking = (roomId: string): Booking | null =>
    roomBookings(roomId).find((b) => b.checkIn <= todayStr && todayStr < b.checkOut) ?? null;
  const upcomingBooking = (roomId: string): Booking | null =>
    roomBookings(roomId).filter((b) => b.checkIn > todayStr).sort((a, b) => a.checkIn.localeCompare(b.checkIn))[0] ?? null;

  const effStatus = (room: Room): EffStatus => {
    if (room.status === 'cleaning') return 'cleaning';
    if (room.status === 'maintenance') return 'maintenance';
    if (currentBooking(room.id)) return 'occupied';
    if (upcomingBooking(room.id)) return 'upcoming';
    return 'available';
  };

  // ── Live statistics ──
  const stats = useMemo(() => {
    const s = { total: rooms.length, available: 0, occupied: 0, cleaning: 0, maintenance: 0 };
    rooms.forEach((r) => {
      const st = effStatus(r);
      if (st === 'available' || st === 'upcoming') s.available++;
      else if (st === 'occupied') s.occupied++;
      else if (st === 'cleaning') s.cleaning++;
      else if (st === 'maintenance') s.maintenance++;
    });
    return s;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rooms, bookings, allocations, todayStr]);
  const pctOf = (n: number) => (stats.total > 0 ? ((n / stats.total) * 100).toFixed(1).replace(/\.0$/, '') : '0');

  const floors = useMemo(() => [...new Set(rooms.map((r) => r.floor ?? 1))].sort((a, b) => a - b), [rooms]);

  const filteredRooms = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rooms.filter((r) => {
      if (floorFilter !== 'all' && (r.floor ?? 1) !== floorFilter) return false;
      const st = effStatus(r);
      if (statusFilter !== 'all' && st !== statusFilter) return false;
      if (q) {
        const type = r.typeId ? typeById.get(r.typeId) : undefined;
        const guest = currentBooking(r.id);
        const hay = [r.name, type?.name ?? '', guest ? (guest.organizationName || guest.userName) : ''].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rooms, search, statusFilter, floorFilter, bookings, allocations, roomTypes, todayStr]);

  const openRoom = rooms.find((r) => r.id === openRoomId) ?? null;

  // ── Long-press handlers ──
  const startPress = (roomId: string) => {
    longPress.current = setTimeout(() => {
      setSelectMode(true);
      setSelected(new Set([roomId]));
      longPress.current = null;
    }, 450);
  };
  const cancelPress = () => { if (longPress.current) { clearTimeout(longPress.current); longPress.current = null; } };
  const handleRoomClick = (roomId: string) => {
    if (selectMode) {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(roomId)) next.delete(roomId); else next.add(roomId);
        if (next.size === 0) setSelectMode(false);
        return next;
      });
    } else {
      setOpenRoomId(roomId);
    }
  };
  const exitSelect = () => { setSelectMode(false); setSelected(new Set()); };

  const bulkApply = (fn: (r: Room) => void) => {
    rooms.filter((r) => selected.has(r.id)).forEach(fn);
    setBulkSheet(null);
    exitSelect();
  };

  // ── Room types page ──
  if (view === 'types') {
    return (
      <RoomTypesPage
        houseId={houseId} roomTypes={roomTypes} rooms={rooms}
        onBack={() => setView('rooms')}
        onAddRoomType={onAddRoomType} onUpdateRoomType={onUpdateRoomType} onDeleteRoomType={onDeleteRoomType}
      />
    );
  }

  return (
    <div className="space-y-3 pb-24" dir="rtl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-black text-[var(--color-owner-text)] flex items-center gap-1.5">
            <BedDouble className="w-4.5 h-4.5 text-[var(--color-owner-primary)]" /> الغرف ({rooms.length})
          </h2>
          <p className="text-[11px] text-[var(--color-owner-secondary)] mt-0.5">إدارة غرف {houseName || 'بيت المؤتمرات'}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => setView('types')}
            className="flex items-center gap-1 text-[10px] font-black text-[var(--color-owner-primary)] bg-[var(--color-owner-surface)] border border-[var(--color-owner-border)] rounded-xl px-2.5 py-2">
            <Layers className="w-3.5 h-3.5" /> أنواع الغرف
          </button>
          <button type="button" onClick={() => { if (selectMode) exitSelect(); else setSelectMode(true); }}
            className={`flex items-center gap-1 text-[10px] font-black rounded-xl px-2.5 py-2 border ${selectMode ? 'bg-[var(--color-owner-primary)] text-white border-[var(--color-owner-primary)]' : 'bg-[var(--color-owner-surface)] text-[var(--color-owner-primary)] border-[var(--color-owner-border)]'}`}>
            <CheckCircle2 className="w-3.5 h-3.5" /> تحديد
          </button>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-5 gap-1.5">
        {[
          { label: 'إجمالي الغرف', value: stats.total, sub: '', icon: BedDouble, chip: 'bg-[var(--color-owner-hover)] text-[var(--color-owner-primary)]' },
          { label: 'متاحة', value: stats.available, sub: `${pctOf(stats.available)}%`, icon: CheckCircle2, chip: 'bg-emerald-50 text-emerald-600' },
          { label: 'مشغولة', value: stats.occupied, sub: `${pctOf(stats.occupied)}%`, icon: Users, chip: 'bg-rose-50 text-rose-600' },
          { label: 'تنظيف', value: stats.cleaning, sub: `${pctOf(stats.cleaning)}%`, icon: Sparkles, chip: 'bg-orange-50 text-orange-600' },
          { label: 'صيانة', value: stats.maintenance, sub: `${pctOf(stats.maintenance)}%`, icon: Wrench, chip: 'bg-slate-100 text-slate-500' },
        ].map((s) => (
          <div key={s.label} className="bg-[var(--color-owner-surface)] rounded-2xl border border-[var(--color-owner-border)] p-2 flex flex-col items-center gap-1 text-center">
            <span className={`w-7 h-7 rounded-xl flex items-center justify-center ${s.chip}`}><s.icon className="w-3.5 h-3.5" /></span>
            <span className="text-base font-black text-[var(--color-owner-text)] leading-none">{s.value}</span>
            <span className="text-[8px] font-bold text-[var(--color-owner-secondary)] leading-tight">{s.label}</span>
            {s.sub && <span className="text-[8px] font-bold text-[var(--color-owner-secondary)]">{s.sub}</span>}
          </div>
        ))}
      </div>

      {/* Search + filter toggle */}
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setShowFilters((v) => !v)}
          className={`flex items-center gap-1 text-[10.5px] font-black rounded-2xl px-3 py-2.5 border shrink-0 ${showFilters ? 'bg-[var(--color-owner-primary)] text-white border-[var(--color-owner-primary)]' : 'bg-[var(--color-owner-surface)] text-[var(--color-owner-secondary)] border-[var(--color-owner-border)]'}`}>
          <Filter className="w-3.5 h-3.5" /> فلتر
        </button>
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-[var(--color-owner-secondary)] absolute right-3 top-1/2 -translate-y-1/2" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث برقم الغرفة…"
            className="w-full bg-[var(--color-owner-surface)] border border-[var(--color-owner-border)] rounded-2xl pr-9 pl-3 py-2.5 text-[11px] text-[var(--color-owner-text)] outline-none focus:border-[var(--color-owner-primary)]" />
        </div>
      </div>

      {/* Status filter pills */}
      {showFilters && (
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-0.5 px-0.5">
          {FILTERS.map((f) => {
            const active = statusFilter === f.key;
            const dot = f.key !== 'all' ? STATUS_META[f.key as EffStatus].dot : '';
            return (
              <button key={f.key} type="button" onClick={() => setStatusFilter(f.key)}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10.5px] font-black border transition-colors ${active ? 'bg-[var(--color-owner-primary)] text-white border-[var(--color-owner-primary)]' : 'bg-[var(--color-owner-surface)] text-[var(--color-owner-secondary)] border-[var(--color-owner-border)]'}`}>
                {dot && <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />}
                {f.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Floor tabs */}
      {floors.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <span className="text-[10px] font-black text-[var(--color-owner-text)] shrink-0">الدور</span>
          <button type="button" onClick={() => setFloorFilter('all')}
            className={`shrink-0 px-3 py-1.5 rounded-xl text-[10.5px] font-black border ${floorFilter === 'all' ? 'bg-[var(--color-owner-primary)] text-white border-[var(--color-owner-primary)]' : 'bg-[var(--color-owner-surface)] text-[var(--color-owner-secondary)] border-[var(--color-owner-border)]'}`}>الكل</button>
          {floors.map((f) => (
            <button key={f} type="button" onClick={() => setFloorFilter(f)}
              className={`shrink-0 px-3 py-1.5 rounded-xl text-[10.5px] font-black border ${floorFilter === f ? 'bg-[var(--color-owner-primary)] text-white border-[var(--color-owner-primary)]' : 'bg-[var(--color-owner-surface)] text-[var(--color-owner-secondary)] border-[var(--color-owner-border)]'}`}>{f === 0 ? 'أرضي' : f}</button>
          ))}
        </div>
      )}

      {/* Room grid */}
      {rooms.length === 0 ? (
        <div className="bg-[var(--color-owner-surface)] rounded-2xl border border-[var(--color-owner-border)] p-8 text-center text-[11px] text-[var(--color-owner-secondary)] font-bold">لا توجد غرف مضافة بعد. أضف أول غرفة من زر +.</div>
      ) : filteredRooms.length === 0 ? (
        <div className="bg-[var(--color-owner-surface)] rounded-2xl border border-[var(--color-owner-border)] p-8 text-center text-[11px] text-[var(--color-owner-secondary)] font-bold">لا توجد غرف مطابقة.</div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {filteredRooms.map((room) => {
            const st = effStatus(room);
            const meta = STATUS_META[st];
            const type = room.typeId ? typeById.get(room.typeId) : undefined;
            const TypeIcon = type?.icon ? (TYPE_ICON[type.icon] ?? BedDouble) : BedDouble;
            const isSel = selected.has(room.id);
            return (
              <div key={room.id}
                onPointerDown={() => startPress(room.id)} onPointerUp={cancelPress} onPointerLeave={cancelPress} onPointerCancel={cancelPress}
                onClick={() => handleRoomClick(room.id)}
                className={`relative rounded-2xl border p-3 cursor-pointer transition-all select-none ${meta.card} ${isSel ? 'ring-2 ring-[var(--color-owner-primary)]' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <span className="text-base font-black text-[var(--color-owner-text)]">{room.name}</span>
                  {selectMode ? (
                    <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSel ? 'bg-[var(--color-owner-primary)] border-[var(--color-owner-primary)]' : 'border-[var(--color-owner-border)] bg-white/60'}`}>
                      {isSel && <Check className="w-3 h-3 text-white" />}
                    </span>
                  ) : (
                    <button type="button" onClick={(e) => { e.stopPropagation(); setOpenRoomId(room.id); }} className="text-[var(--color-owner-secondary)] p-0.5">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="mt-2 inline-flex items-center gap-1 bg-white/70 rounded-lg px-1.5 py-0.5">
                  <TypeIcon className="w-3 h-3 text-[var(--color-owner-primary)]" />
                  <span className="text-[9px] font-black text-[var(--color-owner-text)]">{type?.name ?? `${room.bedsCount} سرير`}</span>
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                  <span className={`text-[9.5px] font-black ${meta.text}`}>{meta.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FAB */}
      {!selectMode && (
        <button type="button" onClick={() => setShowAdd(true)}
          className="fixed bottom-24 left-4 z-30 w-12 h-12 rounded-full bg-[var(--color-owner-primary)] text-white flex items-center justify-center shadow-lg shadow-black/25 active:scale-95 transition-transform">
          <Plus className="w-5 h-5" />
        </button>
      )}

      {/* Bulk action bar */}
      {selectMode && selected.size > 0 && (
        <div className="fixed bottom-20 inset-x-3 z-40 bg-[var(--color-owner-primary)] rounded-2xl p-2 flex items-center gap-1 shadow-xl">
          <span className="text-[10px] font-black text-white px-2 shrink-0">{selected.size} محددة</span>
          <div className="flex-1 flex items-center gap-1 overflow-x-auto">
            <BulkBtn icon={Tag} label="النوع" onClick={() => setBulkSheet('type')} />
            <BulkBtn icon={CheckCircle2} label="الحالة" onClick={() => setBulkSheet('status')} />
            <BulkBtn icon={DollarSign} label="السعر" onClick={() => setBulkSheet('price')} />
            <BulkBtn icon={ArrowRightLeft} label="الدور" onClick={() => setBulkSheet('floor')} />
            <BulkBtn icon={Trash2} label="حذف" danger onClick={() => { if (confirm(`حذف ${selected.size} غرفة؟`)) bulkApply((r) => onDeleteRoom?.(r.id)); }} />
          </div>
          <button type="button" onClick={exitSelect} className="text-white p-1.5 shrink-0"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* ── Room detail bottom sheet ── */}
      <BottomSheet open={!!openRoom} onClose={() => setOpenRoomId(null)} title={openRoom ? `غرفة ${openRoom.name}` : ''}>
        {openRoom && (() => {
          const st = effStatus(openRoom);
          const meta = STATUS_META[st];
          const type = openRoom.typeId ? typeById.get(openRoom.typeId) : undefined;
          const price = openRoom.pricePerNight ?? type?.price;
          const booking = currentBooking(openRoom.id) ?? upcomingBooking(openRoom.id);
          const occupied = st === 'occupied';
          return (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 rounded-full ${meta.card} ${meta.text} border`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} /> {meta.label}
                </span>
                {type && <span className="text-[10px] font-black text-[var(--color-owner-secondary)]">{type.name}</span>}
                {price !== undefined && <span className="text-[10px] font-black text-[var(--color-owner-primary)] mr-auto">{price.toLocaleString()} ج.م / الليلة</span>}
              </div>

              {occupied && booking ? (
                <>
                  <div className="bg-[var(--color-owner-bg)] rounded-2xl p-3.5 space-y-2 text-[11px]">
                    <Row label="الضيف" value={booking.organizationName || booking.userName} />
                    <Row label="من" value={booking.checkIn} />
                    <Row label="إلى" value={booking.checkOut} />
                    <Row label="مدة الإقامة" value={`${nightsBetween(booking.checkIn, booking.checkOut)} ليالٍ`} />
                    <Row label="الإجمالي" value={`${booking.totalPrice.toLocaleString()} ج.م`} bold />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <SheetAction icon={Calendar} label="عرض الحجز" onClick={() => { setOpenRoomId(null); onViewBooking?.(booking.id); }} />
                    <SheetAction icon={Clock} label="تمديد" tone="emerald" onClick={() => setExtendFor(booking.id)} />
                    <SheetAction icon={LogOut} label="تسجيل خروج" tone="rose" onClick={() => { onCheckOutBooking?.(booking.id); setOpenRoomId(null); }} />
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-[var(--color-owner-bg)] rounded-2xl p-3.5 space-y-2 text-[11px]">
                    <Row label="عدد الأسرة" value={`${openRoom.bedsCount}`} />
                    <Row label="الدور" value={floorLabel(openRoom.floor ?? 1)} />
                    {type && type.facilities.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {type.facilities.map((f) => {
                          const meta2 = FACILITIES.find((x) => x.key === f);
                          if (!meta2) return null;
                          return <span key={f} className="inline-flex items-center gap-1 text-[9px] font-bold text-[var(--color-owner-secondary)] bg-white border border-[var(--color-owner-border)] rounded-lg px-1.5 py-0.5"><meta2.icon className="w-3 h-3" /> {meta2.label}</span>;
                        })}
                      </div>
                    )}
                    {upcomingBooking(openRoom.id) && <Row label="حجز قادم" value={upcomingBooking(openRoom.id)!.checkIn} />}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <SheetAction icon={Pencil} label="تعديل" onClick={() => { setEditRoom(openRoom); setOpenRoomId(null); }} />
                    <SheetAction icon={Calendar} label="حجز" tone="emerald" onClick={() => { setOpenRoomId(null); onBookRoom?.(); }} />
                    {openRoom.status === 'cleaning'
                      ? <SheetAction icon={CheckCircle2} label="إنهاء التنظيف" onClick={() => { onUpdateRoom?.({ ...openRoom, status: 'available' }); setOpenRoomId(null); }} />
                      : <SheetAction icon={Sparkles} label="تنظيف" tone="orange" onClick={() => { onUpdateRoom?.({ ...openRoom, status: 'cleaning' }); setOpenRoomId(null); }} />}
                    {openRoom.status === 'maintenance'
                      ? <SheetAction icon={CheckCircle2} label="إنهاء الصيانة" onClick={() => { onUpdateRoom?.({ ...openRoom, status: 'available' }); setOpenRoomId(null); }} />
                      : <SheetAction icon={Wrench} label="صيانة" tone="slate" onClick={() => { onUpdateRoom?.({ ...openRoom, status: 'maintenance' }); setOpenRoomId(null); }} />}
                    <SheetAction icon={Trash2} label="حذف" tone="rose" onClick={() => { if (confirm('حذف هذه الغرفة؟')) { onDeleteRoom?.(openRoom.id); setOpenRoomId(null); } }} />
                  </div>
                </>
              )}
            </div>
          );
        })()}
      </BottomSheet>

      {/* Extend stay sheet */}
      <BottomSheet open={!!extendFor} onClose={() => setExtendFor(null)} title="تمديد الإقامة">
        {extendFor && (() => {
          const b = bookings.find((x) => x.id === extendFor);
          if (!b) return null;
          return <ExtendForm booking={b} onSubmit={(date) => { onExtendBooking?.(b.id, date); setExtendFor(null); setOpenRoomId(null); }} />;
        })()}
      </BottomSheet>

      {/* Add / edit room sheets */}
      <BottomSheet open={showAdd} onClose={() => setShowAdd(false)} title="إضافة غرفة جديدة">
        <RoomForm mode="add" houseId={houseId} roomTypes={roomTypes}
          onSubmit={(r) => { onAddRoom?.(r); setShowAdd(false); }} />
      </BottomSheet>
      <BottomSheet open={!!editRoom} onClose={() => setEditRoom(null)} title="تعديل الغرفة">
        {editRoom && <RoomForm mode="edit" houseId={houseId} roomTypes={roomTypes} initial={editRoom}
          onSubmit={(r) => { onUpdateRoom?.(r); setEditRoom(null); }} />}
      </BottomSheet>

      {/* Bulk sheets */}
      <BottomSheet open={bulkSheet === 'status'} onClose={() => setBulkSheet(null)} title="تغيير الحالة">
        <div className="grid grid-cols-3 gap-2">
          {([['available', 'متاحة'], ['cleaning', 'تنظيف'], ['maintenance', 'صيانة']] as const).map(([val, label]) => (
            <button key={val} type="button" onClick={() => bulkApply((r) => onUpdateRoom?.({ ...r, status: val }))}
              className="bg-[var(--color-owner-bg)] border border-[var(--color-owner-border)] rounded-xl py-3 text-[11px] font-black text-[var(--color-owner-text)]">{label}</button>
          ))}
        </div>
      </BottomSheet>
      <BottomSheet open={bulkSheet === 'type'} onClose={() => setBulkSheet(null)} title="تغيير النوع">
        {roomTypes.length === 0 ? (
          <p className="text-[11px] text-[var(--color-owner-secondary)] font-bold text-center py-4">أضف أنواع الغرف أولاً من "أنواع الغرف".</p>
        ) : (
          <div className="space-y-1.5">
            {roomTypes.map((t) => (
              <button key={t.id} type="button" onClick={() => bulkApply((r) => onUpdateRoom?.({ ...r, typeId: t.id, bedsCount: t.bedsCount, pricePerNight: t.price }))}
                className="w-full flex items-center justify-between bg-[var(--color-owner-bg)] border border-[var(--color-owner-border)] rounded-xl px-3 py-2.5 text-[11px] font-black text-[var(--color-owner-text)]">
                <span>{t.name}</span><span className="text-[var(--color-owner-secondary)]">{t.price.toLocaleString()} ج.م</span>
              </button>
            ))}
          </div>
        )}
      </BottomSheet>
      <BottomSheet open={bulkSheet === 'price'} onClose={() => setBulkSheet(null)} title="تغيير السعر">
        <BulkPriceForm onSubmit={(price) => bulkApply((r) => onUpdateRoom?.({ ...r, pricePerNight: price }))} />
      </BottomSheet>
      <BottomSheet open={bulkSheet === 'floor'} onClose={() => setBulkSheet(null)} title="نقل لدور آخر">
        <BulkFloorForm onSubmit={(floor) => bulkApply((r) => onUpdateRoom?.({ ...r, floor }))} />
      </BottomSheet>
    </div>
  );
}

// ── Small presentational helpers ───────────────────────────────────

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${bold ? 'pt-1.5 border-t border-[var(--color-owner-border)]' : ''}`}>
      <span className="text-[var(--color-owner-secondary)] font-bold">{label}</span>
      <span className={bold ? 'text-[var(--color-owner-text)] font-black text-sm' : 'text-[var(--color-owner-text)] font-bold'}>{value}</span>
    </div>
  );
}

const TONE: Record<string, string> = {
  primary: 'bg-[var(--color-owner-hover)] text-[var(--color-owner-primary)] border-[var(--color-owner-border)]',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rose: 'bg-rose-50 text-rose-700 border-rose-200',
  orange: 'bg-orange-50 text-orange-700 border-orange-200',
  slate: 'bg-slate-100 text-slate-600 border-slate-200',
};
function SheetAction({ icon: Icon, label, onClick, tone = 'primary' }: { icon: React.ElementType; label: string; onClick: () => void; tone?: keyof typeof TONE }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 rounded-2xl border py-2.5 px-1 text-center ${TONE[tone]}`}>
      <Icon className="w-4 h-4" />
      <span className="text-[9.5px] font-black leading-tight">{label}</span>
    </button>
  );
}

function BulkBtn({ icon: Icon, label, onClick, danger }: { icon: React.ElementType; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick}
      className={`shrink-0 flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-xl ${danger ? 'text-rose-200' : 'text-white'}`}>
      <Icon className="w-4 h-4" />
      <span className="text-[8.5px] font-black">{label}</span>
    </button>
  );
}

// ── Forms ──────────────────────────────────────────────────────────

function RoomForm({ mode, houseId, roomTypes, initial, onSubmit }: {
  mode: 'add' | 'edit'; houseId?: string; roomTypes: RoomType[]; initial?: Room; onSubmit: (r: Room) => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [typeId, setTypeId] = useState(initial?.typeId ?? '');
  const [beds, setBeds] = useState(initial?.bedsCount ?? 2);
  const [floor, setFloor] = useState(initial?.floor ?? 1);
  const [price, setPrice] = useState(initial?.pricePerNight?.toString() ?? '');

  const applyType = (id: string) => {
    setTypeId(id);
    const t = roomTypes.find((x) => x.id === id);
    if (t) { setBeds(t.bedsCount); setPrice(String(t.price)); }
  };

  const submit = () => {
    if (!name.trim() || !houseId) return;
    if (mode === 'edit' && initial) {
      onSubmit({ ...initial, name: name.trim(), typeId: typeId || undefined, bedsCount: beds, floor, pricePerNight: price ? Number(price) : undefined });
    } else {
      onSubmit({ id: `room_${Date.now()}`, houseId, name: name.trim(), typeId: typeId || undefined, bedsCount: beds, floor, pricePerNight: price ? Number(price) : undefined, images: [], status: 'available', createdAt: new Date().toISOString() });
    }
  };

  return (
    <div className="space-y-2.5">
      <Field label="رقم/اسم الغرفة"><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: 201" className={INPUT} /></Field>
      {roomTypes.length > 0 && (
        <Field label="نوع الغرفة">
          <select value={typeId} onChange={(e) => applyType(e.target.value)} className={INPUT}>
            <option value="">بدون نوع</option>
            {roomTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>
      )}
      <div className="grid grid-cols-3 gap-2">
        <Field label="الأسرة"><input type="number" min={1} value={beds} onChange={(e) => setBeds(Number(e.target.value) || 1)} className={INPUT} /></Field>
        <Field label="الدور"><input type="number" min={0} value={floor} onChange={(e) => setFloor(Number(e.target.value) || 0)} className={INPUT} /></Field>
        <Field label="السعر (اختياري)"><input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} className={INPUT} /></Field>
      </div>
      <button type="button" onClick={submit} className="w-full bg-[var(--color-owner-primary)] text-white text-[11px] font-black py-3 rounded-2xl">{mode === 'edit' ? 'حفظ التغييرات' : 'إضافة الغرفة'}</button>
    </div>
  );
}

function ExtendForm({ booking, onSubmit }: { booking: Booking; onSubmit: (date: string) => void }) {
  const [date, setDate] = useState(booking.checkOut);
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-bold text-[var(--color-owner-secondary)]">المغادرة الحالية: {booking.checkOut}</p>
      <Field label="تاريخ المغادرة الجديد"><input type="date" min={booking.checkOut} value={date} onChange={(e) => setDate(e.target.value)} className={INPUT} /></Field>
      <button type="button" onClick={() => onSubmit(date)} disabled={date <= booking.checkOut}
        className="w-full bg-[var(--color-owner-primary)] disabled:opacity-40 text-white text-[11px] font-black py-3 rounded-2xl">تأكيد التمديد</button>
    </div>
  );
}

function BulkPriceForm({ onSubmit }: { onSubmit: (price: number) => void }) {
  const [price, setPrice] = useState('');
  return (
    <div className="space-y-3">
      <Field label="السعر الجديد لليلة (ج.م)"><input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} className={INPUT} /></Field>
      <button type="button" onClick={() => price && onSubmit(Number(price))} disabled={!price}
        className="w-full bg-[var(--color-owner-primary)] disabled:opacity-40 text-white text-[11px] font-black py-3 rounded-2xl">تطبيق على المحدد</button>
    </div>
  );
}

function BulkFloorForm({ onSubmit }: { onSubmit: (floor: number) => void }) {
  const [floor, setFloor] = useState('1');
  return (
    <div className="space-y-3">
      <Field label="الدور الجديد"><input type="number" min={0} value={floor} onChange={(e) => setFloor(e.target.value)} className={INPUT} /></Field>
      <button type="button" onClick={() => onSubmit(Number(floor) || 0)}
        className="w-full bg-[var(--color-owner-primary)] text-white text-[11px] font-black py-3 rounded-2xl">تطبيق على المحدد</button>
    </div>
  );
}

// ── Room Types page ────────────────────────────────────────────────

function RoomTypesPage({ houseId, roomTypes, rooms, onBack, onAddRoomType, onUpdateRoomType, onDeleteRoomType }: {
  houseId?: string; roomTypes: RoomType[]; rooms: Room[]; onBack: () => void;
  onAddRoomType?: (t: RoomType) => void; onUpdateRoomType?: (t: RoomType) => void; onDeleteRoomType?: (id: string) => void;
}) {
  const [editing, setEditing] = useState<RoomType | null>(null);
  const [adding, setAdding] = useState(false);
  const countByType = (id: string) => rooms.filter((r) => r.typeId === id).length;

  return (
    <div className="space-y-3 pb-24" dir="rtl">
      <div className="flex items-center justify-between">
        <button type="button" onClick={onBack} className="flex items-center gap-1 text-[11px] font-bold text-[var(--color-owner-secondary)]">
          <ChevronLeft className="w-4 h-4 rotate-180" /> رجوع للغرف
        </button>
        <button type="button" onClick={() => setAdding(true)} className="flex items-center gap-1 bg-[var(--color-owner-primary)] text-white text-[10.5px] font-black px-3 py-2 rounded-xl">
          <Plus className="w-3.5 h-3.5" /> إضافة نوع غرفة
        </button>
      </div>
      <h2 className="text-base font-black text-[var(--color-owner-text)] flex items-center gap-1.5"><Layers className="w-4 h-4 text-[var(--color-owner-primary)]" /> إدارة أنواع الغرف</h2>

      {roomTypes.length === 0 ? (
        <div className="bg-[var(--color-owner-surface)] rounded-2xl border border-[var(--color-owner-border)] p-8 text-center text-[11px] text-[var(--color-owner-secondary)] font-bold">لا توجد أنواع غرف بعد.</div>
      ) : (
        <div className="space-y-2">
          {roomTypes.map((t) => {
            const TypeIcon = t.icon ? (TYPE_ICON[t.icon] ?? BedDouble) : BedDouble;
            return (
              <button key={t.id} type="button" onClick={() => setEditing(t)}
                className="w-full flex items-center gap-3 bg-[var(--color-owner-surface)] rounded-2xl border border-[var(--color-owner-border)] p-3.5 text-right">
                <span className="w-10 h-10 rounded-2xl bg-[var(--color-owner-hover)] flex items-center justify-center shrink-0"><TypeIcon className="w-5 h-5 text-[var(--color-owner-primary)]" /></span>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-black text-[var(--color-owner-text)]">{t.name}</div>
                  <div className="text-[9.5px] font-bold text-[var(--color-owner-secondary)]">{countByType(t.id)} غرفة · {t.bedsCount} سرير · {t.facilities.length} مرافق</div>
                </div>
                <div className="text-[12px] font-black text-[var(--color-owner-primary)] shrink-0">{t.price.toLocaleString()} ج.م</div>
              </button>
            );
          })}
        </div>
      )}

      <BottomSheet open={adding} onClose={() => setAdding(false)} title="إضافة نوع غرفة">
        <RoomTypeForm houseId={houseId} onSubmit={(t) => { onAddRoomType?.(t); setAdding(false); }} />
      </BottomSheet>
      <BottomSheet open={!!editing} onClose={() => setEditing(null)} title="تعديل نوع الغرفة">
        {editing && <RoomTypeForm houseId={houseId} initial={editing}
          onSubmit={(t) => { onUpdateRoomType?.(t); setEditing(null); }}
          onDelete={() => { if (confirm('حذف هذا النوع؟')) { onDeleteRoomType?.(editing.id); setEditing(null); } }} />}
      </BottomSheet>
    </div>
  );
}

function RoomTypeForm({ houseId, initial, onSubmit, onDelete }: {
  houseId?: string; initial?: RoomType; onSubmit: (t: RoomType) => void; onDelete?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [icon, setIcon] = useState(initial?.icon ?? 'standard');
  const [price, setPrice] = useState(initial?.price?.toString() ?? '');
  const [beds, setBeds] = useState(initial?.bedsCount ?? 2);
  const [facilities, setFacilities] = useState<RoomFacility[]>(initial?.facilities ?? []);
  const [desc, setDesc] = useState(initial?.description ?? '');

  const toggle = (f: RoomFacility) => setFacilities((prev) => prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]);
  const submit = () => {
    if (!name.trim() || !houseId) return;
    onSubmit({
      id: initial?.id ?? `rtype_${Date.now()}`, houseId, name: name.trim(), icon,
      price: price ? Number(price) : 0, bedsCount: beds, facilities, description: desc.trim() || undefined,
      createdAt: initial?.createdAt ?? new Date().toISOString(),
    });
  };

  return (
    <div className="space-y-2.5">
      <Field label="اسم النوع"><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: مكيفة" className={INPUT} /></Field>
      <Field label="الأيقونة">
        <div className="flex gap-1.5">
          {TYPE_ICON_OPTIONS.map((o) => {
            const Icon = TYPE_ICON[o.key];
            const active = icon === o.key;
            return (
              <button key={o.key} type="button" onClick={() => setIcon(o.key)}
                className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl border ${active ? 'bg-[var(--color-owner-primary)] text-white border-[var(--color-owner-primary)]' : 'bg-[var(--color-owner-bg)] text-[var(--color-owner-secondary)] border-[var(--color-owner-border)]'}`}>
                <Icon className="w-4 h-4" /><span className="text-[8.5px] font-black">{o.label}</span>
              </button>
            );
          })}
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="السعر الافتراضي (ج.م)"><input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} className={INPUT} /></Field>
        <Field label="عدد الأسرة"><input type="number" min={1} value={beds} onChange={(e) => setBeds(Number(e.target.value) || 1)} className={INPUT} /></Field>
      </div>
      <Field label="المرافق">
        <div className="grid grid-cols-3 gap-1.5">
          {FACILITIES.map((f) => {
            const active = facilities.includes(f.key);
            return (
              <button key={f.key} type="button" onClick={() => toggle(f.key)}
                className={`flex items-center gap-1 justify-center py-2 rounded-xl border text-[9.5px] font-bold ${active ? 'bg-[var(--color-owner-primary)] text-white border-[var(--color-owner-primary)]' : 'bg-[var(--color-owner-bg)] text-[var(--color-owner-secondary)] border-[var(--color-owner-border)]'}`}>
                <f.icon className="w-3 h-3" /> {f.label}
              </button>
            );
          })}
        </div>
      </Field>
      <Field label="الوصف (اختياري)"><textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} className={`${INPUT} resize-none`} /></Field>
      <button type="button" onClick={submit} className="w-full bg-[var(--color-owner-primary)] text-white text-[11px] font-black py-3 rounded-2xl">{initial ? 'حفظ التغييرات' : 'إضافة نوع غرفة'}</button>
      {onDelete && <button type="button" onClick={onDelete} className="w-full text-rose-600 text-[10.5px] font-black py-2">حذف النوع</button>}
    </div>
  );
}

const INPUT = 'w-full bg-[var(--color-owner-bg)] border border-[var(--color-owner-border)] text-[11px] px-3 py-2.5 rounded-xl text-[var(--color-owner-text)] outline-none focus:border-[var(--color-owner-primary)]';
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[9.5px] font-black text-[var(--color-owner-secondary)] mb-1">{label}</label>
      {children}
    </div>
  );
}
