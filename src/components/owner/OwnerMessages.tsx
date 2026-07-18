import React, { useState } from 'react';
import { Booking, User } from '../../types';
import { ChevronRight, Search } from 'lucide-react';
import BookingChatPanel from '../BookingChatPanel';

interface OwnerMessagesProps {
  owner: User;
  ownerBookings: Booking[];
  users: User[];
}

function Avatar({ name, avatarUrl, size = 'w-9 h-9' }: { name: string; avatarUrl?: string; size?: string }) {
  return (
    <div className={`${size} rounded-full bg-[var(--color-owner-primary)] flex items-center justify-center text-xs font-black text-[var(--color-owner-accent)] shrink-0 overflow-hidden`}>
      {avatarUrl ? <img src={avatarUrl} alt={name} className="w-full h-full object-cover" /> : name.charAt(0)}
    </div>
  );
}

export default function OwnerMessages({ owner, ownerBookings, users }: OwnerMessagesProps) {
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [search, setSearch] = useState('');

  const avatarFor = (userId: string) => users.find((u) => u.id === userId)?.avatarUrl;

  const conversations = ownerBookings
    .filter((b) => b.status !== 'rejected' && b.status !== 'cancelled')
    .filter((b) => b.userName.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (selectedBooking) {
    return (
      <BookingChatPanel
        bookingId={selectedBooking.id}
        currentUserId={owner.id}
        title={selectedBooking.userName}
        subtitle={selectedBooking.houseName}
        onBack={() => setSelectedBooking(null)}
        variant="owner"
        heightClass="h-[70vh]"
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="w-4 h-4 text-[var(--color-owner-secondary)] absolute right-3 top-1/2 -translate-y-1/2" />
        <input
          id="owner-messages-search"
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث باسم الحاجز..."
          className="w-full bg-[var(--color-owner-surface)] border border-[var(--color-owner-border)] rounded-2xl pr-9 pl-3 py-2.5 text-xs text-[var(--color-owner-text)] outline-none focus:border-[var(--color-owner-primary)]"
        />
      </div>

      {conversations.length === 0 ? (
        <div className="bg-[var(--color-owner-surface)] rounded-3xl border border-[var(--color-owner-border)] p-8 text-center text-xs text-[var(--color-owner-secondary)]">
          لا توجد محادثات متاحة بعد — ستظهر هنا محادثاتك مع الحاجزين فور استلام طلبات حجز.
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map((b) => (
            <button
              key={b.id}
              id={`owner-conversation-${b.id}`}
              type="button"
              onClick={() => setSelectedBooking(b)}
              className="w-full flex items-center justify-between gap-3 bg-[var(--color-owner-surface)] hover:bg-[var(--color-owner-hover)] rounded-2xl border border-[var(--color-owner-border)] p-3.5 text-right transition-colors cursor-pointer"
            >
              <Avatar name={b.userName} avatarUrl={avatarFor(b.userId)} />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-[var(--color-owner-text)] truncate">{b.userName}</div>
                <div className="text-[10px] text-[var(--color-owner-secondary)] truncate">{b.houseName} · {b.checkIn}</div>
              </div>
              <ChevronRight className="w-4 h-4 text-[var(--color-owner-secondary)] rotate-180 shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
