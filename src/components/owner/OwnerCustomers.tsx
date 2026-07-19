import React, { useState } from 'react';
import { Booking } from '../../types';
import { Search, Users, Phone } from 'lucide-react';

interface OwnerCustomersProps {
  bookings: Booking[];
}

interface CustomerRow {
  userId: string;
  name: string;
  phone: string;
  totalBookings: number;
  totalSpent: number;
  lastStay: string;
}

export default function OwnerCustomers({ bookings }: OwnerCustomersProps) {
  const [search, setSearch] = useState('');

  const customers: CustomerRow[] = Object.values(
    bookings.reduce((acc, b) => {
      if (!acc[b.userId]) {
        acc[b.userId] = { userId: b.userId, name: b.userName, phone: b.userPhone, totalBookings: 0, totalSpent: 0, lastStay: '' };
      }
      const c = acc[b.userId];
      c.totalBookings += 1;
      if (b.status !== 'cancelled' && b.status !== 'rejected') c.totalSpent += b.totalPrice;
      if (b.checkOut > c.lastStay) c.lastStay = b.checkOut;
      return acc;
    }, {} as Record<string, CustomerRow>)
  ).sort((a, b) => b.totalSpent - a.totalSpent);

  const q = search.trim().toLowerCase();
  const filtered = q ? customers.filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q)) : customers;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="w-4 h-4 text-[var(--color-owner-secondary)] absolute right-3 top-1/2 -translate-y-1/2" />
        <input
          id="owner-customers-search"
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث بالاسم أو رقم الهاتف..."
          className="w-full bg-[var(--color-owner-surface)] border border-[var(--color-owner-border)] rounded-2xl pr-9 pl-3 py-2.5 text-xs text-[var(--color-owner-text)] outline-none focus:border-[var(--color-owner-primary)]"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-[var(--color-owner-surface)] rounded-3xl border border-[var(--color-owner-border)] p-8 text-center">
          <Users className="w-8 h-8 text-[var(--color-owner-secondary)] mx-auto mb-2" />
          <p className="text-xs text-[var(--color-owner-secondary)]">{customers.length === 0 ? 'لا يوجد عملاء بعد.' : 'لا توجد نتائج مطابقة.'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => (
            <div key={c.userId} className="bg-[var(--color-owner-surface)] rounded-2xl border border-[var(--color-owner-border)] p-3.5 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs font-black text-[var(--color-owner-text)] truncate">{c.name}</div>
                <div className="text-[10px] text-[var(--color-owner-secondary)] flex items-center gap-1 mt-0.5">
                  <Phone className="w-3 h-3" /><span>{c.phone}</span>
                </div>
              </div>
              <div className="text-left shrink-0 space-y-0.5">
                <div className="text-[10px] font-bold text-[var(--color-owner-text)]">{c.totalBookings} حجز</div>
                <div className="text-[10px] font-extrabold text-[var(--color-owner-primary)]">{c.totalSpent.toLocaleString()} ج.م</div>
                <div className="text-[9px] text-[var(--color-owner-secondary)]">آخر إقامة: {c.lastStay || '—'}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
