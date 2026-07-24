import React, { useMemo, useState } from 'react';
import { Booking, Review, User } from '../../types';
import { Search, Users, Phone, MessageCircle, Star, Calendar, Wallet, Crown, ChevronDown } from 'lucide-react';
import BottomSheet from './BottomSheet';

interface OwnerCustomersProps {
  bookings: Booking[];
  reviews?: Review[];
  users?: User[];
  onOpenMessages?: () => void;
}

interface CustomerRow {
  userId: string;
  name: string;
  phone: string;
  totalBookings: number;
  totalSpent: number;
  lastStay: string;
  firstStay: string;
}

type SortKey = 'spent' | 'bookings' | 'recent';

const STATUS_LABEL: Record<string, string> = {
  approved: 'مؤكد', completed: 'مكتمل', pending: 'قيد المراجعة', rejected: 'مرفوض', cancelled: 'ملغي',
};

export default function OwnerCustomers({ bookings, reviews = [], users = [], onOpenMessages }: OwnerCustomersProps) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('spent');
  const [openId, setOpenId] = useState<string | null>(null);

  const avatarFor = (userId: string) => users.find((u) => u.id === userId)?.avatarUrl;

  const customers: CustomerRow[] = useMemo(() => Object.values(
    bookings.reduce((acc, b) => {
      if (!acc[b.userId]) acc[b.userId] = { userId: b.userId, name: b.userName, phone: b.userPhone, totalBookings: 0, totalSpent: 0, lastStay: '', firstStay: b.checkIn };
      const c = acc[b.userId];
      c.totalBookings += 1;
      if (b.status !== 'cancelled' && b.status !== 'rejected') c.totalSpent += b.totalPrice;
      if (b.checkOut > c.lastStay) c.lastStay = b.checkOut;
      if (b.checkIn < c.firstStay) c.firstStay = b.checkIn;
      return acc;
    }, {} as Record<string, CustomerRow>)
  ), [bookings]);

  const sorted = useMemo(() => {
    const arr = [...customers];
    if (sort === 'spent') arr.sort((a, b) => b.totalSpent - a.totalSpent);
    else if (sort === 'bookings') arr.sort((a, b) => b.totalBookings - a.totalBookings);
    else arr.sort((a, b) => (b.lastStay || '').localeCompare(a.lastStay || ''));
    return arr;
  }, [customers, sort]);

  const q = search.trim().toLowerCase();
  const filtered = q ? sorted.filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q)) : sorted;
  const topSpenderId = customers.length ? [...customers].sort((a, b) => b.totalSpent - a.totalSpent)[0].userId : null;

  const openCustomer = customers.find((c) => c.userId === openId) || null;
  const openBookings = openId ? bookings.filter((b) => b.userId === openId).sort((a, b) => b.checkIn.localeCompare(a.checkIn)) : [];
  const openReviews = openId ? reviews.filter((r) => r.userId === openId) : [];

  return (
    <div className="space-y-3" dir="rtl">
      <div>
        <h2 className="text-base font-black text-[var(--color-owner-text)] flex items-center gap-1.5">
          <Users className="w-4.5 h-4.5 text-[var(--color-owner-primary)]" /> العملاء ({customers.length})
        </h2>
        <p className="text-[11px] text-[var(--color-owner-secondary)] mt-0.5">سجل ضيوفك وتاريخ إقامتهم — اضغط لعرض الملف الكامل.</p>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-[var(--color-owner-secondary)] absolute right-3 top-1/2 -translate-y-1/2" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث بالاسم أو رقم الهاتف…"
          className="w-full bg-[var(--color-owner-surface)] border border-[var(--color-owner-border)] rounded-2xl pr-9 pl-3 py-2.5 text-xs text-[var(--color-owner-text)] outline-none focus:border-[var(--color-owner-primary)]" />
      </div>

      <div className="flex gap-1.5">
        {([['spent', 'الأكثر إنفاقًا'], ['bookings', 'الأكثر حجزًا'], ['recent', 'الأحدث']] as [SortKey, string][]).map(([k, label]) => (
          <button key={k} type="button" onClick={() => setSort(k)}
            className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border ${sort === k ? 'bg-[var(--color-owner-hover)] text-[var(--color-owner-primary)] border-[var(--color-owner-border)]' : 'bg-[var(--color-owner-surface)] text-[var(--color-owner-secondary)] border-[var(--color-owner-border)]'}`}>{label}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-[var(--color-owner-surface)] rounded-3xl border border-[var(--color-owner-border)] p-8 text-center">
          <Users className="w-8 h-8 text-[var(--color-owner-secondary)]/40 mx-auto mb-2" />
          <p className="text-xs text-[var(--color-owner-secondary)]">{customers.length === 0 ? 'لا يوجد عملاء بعد.' : 'لا توجد نتائج مطابقة.'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => {
            const avatar = avatarFor(c.userId);
            return (
              <button key={c.userId} type="button" onClick={() => setOpenId(c.userId)}
                className="w-full bg-[var(--color-owner-surface)] rounded-2xl border border-[var(--color-owner-border)] p-3.5 flex items-center gap-3 text-right active:scale-[0.99] transition-transform">
                <div className="w-10 h-10 rounded-full bg-[var(--color-owner-primary)] text-white flex items-center justify-center text-sm font-black shrink-0 overflow-hidden">
                  {avatar ? <img src={avatar} alt={c.name} className="w-full h-full object-cover" /> : c.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-[var(--color-owner-text)] truncate">{c.name}</span>
                    {c.userId === topSpenderId && <Crown className="w-3.5 h-3.5 text-[#D4AF37] fill-[#D4AF37] shrink-0" />}
                  </div>
                  <div className="text-[9.5px] text-[var(--color-owner-secondary)] font-bold">{c.totalBookings} حجز · آخر إقامة {c.lastStay || '—'}</div>
                </div>
                <div className="text-left shrink-0">
                  <div className="text-[11px] font-black text-[var(--color-owner-primary)]">{c.totalSpent.toLocaleString()} ج.م</div>
                  <ChevronDown className="w-3.5 h-3.5 text-[var(--color-owner-secondary)] -rotate-90 mr-auto" />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Customer profile sheet */}
      <BottomSheet open={!!openCustomer} onClose={() => setOpenId(null)} title="ملف العميل">
        {openCustomer && (() => {
          const avatar = avatarFor(openCustomer.userId);
          const avg = openReviews.length ? (openReviews.reduce((s, r) => s + r.rating, 0) / openReviews.length) : 0;
          return (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-[var(--color-owner-primary)] text-white flex items-center justify-center text-lg font-black shrink-0 overflow-hidden">
                  {avatar ? <img src={avatar} alt={openCustomer.name} className="w-full h-full object-cover" /> : openCustomer.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-black text-[var(--color-owner-text)]">{openCustomer.name}</div>
                  {openCustomer.phone && <div className="text-[10px] text-[var(--color-owner-secondary)] font-bold flex items-center gap-1"><Phone className="w-3 h-3" /> {openCustomer.phone}</div>}
                </div>
              </div>

              {/* Contact actions */}
              <div className="grid grid-cols-3 gap-2">
                {openCustomer.phone && (
                  <>
                    <a href={`tel:${openCustomer.phone}`} className="flex flex-col items-center gap-1 bg-[var(--color-owner-bg)] border border-[var(--color-owner-border)] rounded-2xl py-2.5 text-[var(--color-owner-primary)]"><Phone className="w-4 h-4" /><span className="text-[9.5px] font-black">اتصال</span></a>
                    <a href={`https://wa.me/${openCustomer.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" className="flex flex-col items-center gap-1 bg-emerald-50 border border-emerald-200 rounded-2xl py-2.5 text-emerald-700"><MessageCircle className="w-4 h-4" /><span className="text-[9.5px] font-black">واتساب</span></a>
                  </>
                )}
                {onOpenMessages && (
                  <button type="button" onClick={() => { setOpenId(null); onOpenMessages(); }} className="flex flex-col items-center gap-1 bg-[var(--color-owner-bg)] border border-[var(--color-owner-border)] rounded-2xl py-2.5 text-[var(--color-owner-primary)]"><MessageCircle className="w-4 h-4" /><span className="text-[9.5px] font-black">محادثة</span></button>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-[var(--color-owner-bg)] rounded-2xl p-2.5 text-center"><Wallet className="w-4 h-4 text-[var(--color-owner-primary)] mx-auto" /><div className="text-[13px] font-black text-[var(--color-owner-text)] mt-0.5">{openCustomer.totalSpent.toLocaleString()}</div><div className="text-[8.5px] font-bold text-[var(--color-owner-secondary)]">إجمالي الإنفاق</div></div>
                <div className="bg-[var(--color-owner-bg)] rounded-2xl p-2.5 text-center"><Calendar className="w-4 h-4 text-[var(--color-owner-primary)] mx-auto" /><div className="text-[13px] font-black text-[var(--color-owner-text)] mt-0.5">{openCustomer.totalBookings}</div><div className="text-[8.5px] font-bold text-[var(--color-owner-secondary)]">عدد الحجوزات</div></div>
                <div className="bg-[var(--color-owner-bg)] rounded-2xl p-2.5 text-center"><Star className="w-4 h-4 text-amber-400 fill-amber-400 mx-auto" /><div className="text-[13px] font-black text-[var(--color-owner-text)] mt-0.5">{avg > 0 ? avg.toFixed(1) : '—'}</div><div className="text-[8.5px] font-bold text-[var(--color-owner-secondary)]">متوسط تقييمه</div></div>
              </div>

              {/* Bookings history */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-black text-[var(--color-owner-text)]">سجل الحجوزات</div>
                {openBookings.map((b) => (
                  <div key={b.id} className="flex items-center justify-between bg-[var(--color-owner-bg)] rounded-xl px-3 py-2">
                    <div className="min-w-0">
                      <div className="text-[10.5px] font-bold text-[var(--color-owner-text)]">{b.checkIn} ← {b.checkOut}</div>
                      <div className="text-[9px] font-bold text-[var(--color-owner-secondary)]">{b.guestsCount} فرد · {STATUS_LABEL[b.status] || b.status}</div>
                    </div>
                    <span className="text-[10.5px] font-black text-[var(--color-owner-primary)] shrink-0">{b.totalPrice.toLocaleString()} ج.م</span>
                  </div>
                ))}
              </div>

              {/* Their reviews */}
              {openReviews.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-black text-[var(--color-owner-text)]">تقييماته</div>
                  {openReviews.map((r) => (
                    <div key={r.id} className="bg-[var(--color-owner-bg)] rounded-xl p-2.5">
                      <div className="flex items-center gap-1 mb-1">{[1, 2, 3, 4, 5].map((n) => <Star key={n} className={`w-3 h-3 ${n <= Math.round(r.rating) ? 'text-amber-400 fill-amber-400' : 'text-[var(--color-owner-border)]'}`} />)}</div>
                      {r.comment && <p className="text-[10px] text-[var(--color-owner-secondary)] leading-relaxed">"{r.comment}"</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
      </BottomSheet>
    </div>
  );
}
