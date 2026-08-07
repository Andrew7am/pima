// TEMPORARY design-review page — mounts the REAL guest screens with houses
// from mockData, because the dev database has none and a card that never
// renders cannot be measured. `?screen=cards` shows the explore list,
// `?screen=detail` the house page. Delete with preview-guest.html once both
// are signed off.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import UserDashboard from './components/UserDashboard';
import HouseDetail from './components/HouseDetail';
import UserBookings from './components/UserBookings';
import { INITIAL_HOUSES } from './mockData';
import { DEFAULT_PLATFORM_SETTINGS } from './types';
import type { Attendee, Booking, Review, Room, User } from './types';
import './index.css';

const day = (from: number) => {
  const d = new Date();
  d.setDate(d.getDate() + from);
  return d.toISOString().slice(0, 10);
};

// A logged-in servant — the person these two screens are actually for.
const servant = {
  id: 'u_serv', name: 'خادم كنيسة مارجرجس', email: 'serv@x.eg', phone: '01115556677',
  role: 'servant', approvalStatus: 'approved', organizationName: 'كنيسة مارجرجس - شبرا',
  points: 3200, favorites: [], createdAt: '2025-01-01T00:00:00.000Z',
} as unknown as User;

const houses = INITIAL_HOUSES.slice(0, 6).map((h) => ({ ...h, status: 'approved' as const }));
const house = houses[0];

const reviews: Review[] = [
  { id: 'rv1', houseId: house.id, userId: 'u1', userName: 'بيشوي رمزي', rating: 5, overall_rating: 5,
    comment: 'مكان هادي ونضيف جداً، والخدمة ممتازة. الأكل كان كويس والغرف واسعة.',
    createdAt: '2026-07-20T10:00:00Z' },
  { id: 'rv2', houseId: house.id, userId: 'u2', userName: 'خادم مارجرجس', rating: 4, overall_rating: 4,
    comment: 'التجربة حلوة بس المية السخنة كانت مقطوعة يوم.', createdAt: '2026-06-11T10:00:00Z' },
] as unknown as Review[];

const rooms: Room[] = Array.from({ length: 8 }, (_, i) => ({
  id: `r${i}`, houseId: house.id, name: `${201 + i}`, bedsCount: i % 3 === 0 ? 6 : 4,
  status: 'available', floor: i < 4 ? 'الأول' : 'الثاني',
})) as unknown as Room[];

const bookings: Booking[] = [
  { id: 'b1', houseId: house.id, houseName: house.name, userId: 'u9', userName: 'ضيف',
    userPhone: '0100', userEmail: 'a@b.c', userRole: 'individual',
    checkIn: day(20), checkOut: day(23), guestsCount: 30, totalPrice: 9000,
    depositPaid: true, depositAmount: 1350, status: 'approved',
    isLargeConferenceQuote: false, createdAt: '2026-08-01T00:00:00Z' },
] as unknown as Booking[];

// The servant's own bookings, in the three states that change what the screen
// offers: awaiting a reply, approved-and-unpaid (the transfer card), and paid
// with a group to house (attendees + room distribution).
const myBookings: Booking[] = [
  { id: 'mb1', houseId: house.id, houseName: house.name, userId: servant.id,
    userName: servant.name, userPhone: servant.phone, userEmail: servant.email,
    userRole: 'servant', organizationName: 'كنيسة مارجرجس - شبرا',
    checkIn: day(30), checkOut: day(33), guestsCount: 55, totalPrice: 16500,
    depositPaid: false, depositAmount: 2475, status: 'pending',
    isLargeConferenceQuote: false, paymentStatus: 'unpaid', createdAt: '2026-08-05T09:00:00Z' },
  { id: 'mb2', houseId: house.id, houseName: house.name, userId: servant.id,
    userName: servant.name, userPhone: servant.phone, userEmail: servant.email,
    userRole: 'servant', organizationName: 'كنيسة مارجرجس - شبرا',
    checkIn: day(12), checkOut: day(15), guestsCount: 40, totalPrice: 12000,
    depositPaid: false, depositAmount: 1800, status: 'approved',
    isLargeConferenceQuote: false, paymentStatus: 'unpaid', createdAt: '2026-07-28T09:00:00Z' },
  { id: 'mb3', houseId: house.id, houseName: house.name, userId: servant.id,
    userName: servant.name, userPhone: servant.phone, userEmail: servant.email,
    userRole: 'servant', organizationName: 'كنيسة مارجرجس - شبرا',
    checkIn: day(4), checkOut: day(7), guestsCount: 24, totalPrice: 7200,
    depositPaid: true, depositAmount: 1080, status: 'approved',
    isLargeConferenceQuote: false, paymentStatus: 'paid_deposit', createdAt: '2026-07-10T09:00:00Z' },
] as unknown as Booking[];

// A real group: some with their share paid, some not — that split is what the
// per-person money column exists to show.
const attendees: Attendee[] = Array.from({ length: 24 }, (_, i) => ({
  id: `at${i}`, bookingId: 'mb3', name: `مشارك رقم ${i + 1}`,
  gender: i % 2 === 0 ? 'male' : 'female', age: 18 + (i % 12),
  sharePaid: i % 3 !== 0,
})) as unknown as Attendee[];

const noop = () => undefined;

function Preview() {
  const screen = new URLSearchParams(location.search).get('screen') ?? 'cards';
  const [favorites, setFavorites] = useState<string[]>([]);

  if (screen === 'bookings') {
    return (
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <UserBookings
          bookings={myBookings}
          houses={houses}
          currentUser={servant}
          attendees={attendees}
          allocations={[]}
          rooms={rooms}
          payments={[]}
          settings={DEFAULT_PLATFORM_SETTINGS}
          reviews={reviews}
          onCancelBooking={noop}
          onUpdateAttendees={noop}
          onUpdateAllocations={noop}
          onSubmitPayment={noop}
        />
      </main>
    );
  }

  if (screen === 'detail') {
    return (
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
      <HouseDetail
        house={house}
        currentUser={servant}
        bookings={bookings}
        reviews={reviews}
        rooms={rooms}
        settings={DEFAULT_PLATFORM_SETTINGS}
        onBack={noop}
        onBook={() => true}
        onSubmitReview={noop}
        isFavorited={favorites.includes(house.id)}
        onToggleFavorite={(id) => setFavorites((f) => (f.includes(id) ? [] : [id]))}
      />
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto p-4 sm:p-6">
    <UserDashboard
      houses={houses}
      currentUser={servant}
      bookings={bookings}
      reviews={reviews}
      onSelectHouse={noop}
      onToggleFavorite={(id) => setFavorites((f) => (f.includes(id) ? [] : [id]))}
      onOpenMap={noop}
      onSelectRewards={noop}
    />
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<Preview />);
