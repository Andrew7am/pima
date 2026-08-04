// TEMPORARY design-review page — mounts the REAL OwnerDashboardShell on the
// bookings tab with fabricated rows, so the list can be checked without
// Supabase credentials or an owner login. Mounting the real component (rather
// than a copy of its markup) is the point: a copy would verify the copy.
// Delete this file and preview-owner-bookings.html once the page is signed off.
import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import OwnerDashboardShell from './components/owner/OwnerDashboardShell';
import { INITIAL_HOUSES } from './mockData';
import { DEFAULT_PLATFORM_SETTINGS } from './types';
import type { Booking, User, WaitlistEntry } from './types';
import './index.css';

const owner = {
  id: 'user_owner',
  name: 'أ. مينا صبحي',
  email: 'owner@example.com',
  phone: '01001234567',
  role: 'house_owner',
  points: 0,
  favorites: [],
  createdAt: '2025-01-01T00:00:00.000Z',
} as unknown as User;

const houses = INITIAL_HOUSES.filter((h) => h.ownerId === 'user_owner');
const houseName = houses[0]?.name ?? 'بيت المؤتمرات';
const houseId = houses[0]?.id ?? 'house_1';

const iso = (daysFromNow: number, hour = 9) => {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, 45, 0, 0);
  return d.toISOString();
};
const day = (daysFromNow: number) => {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
};

let n = 0;
const mk = (over: Partial<Booking>): Booking => ({
  id: `booking_17842924885${(n += 7).toString().padStart(2, '0')}`,
  houseId,
  houseName,
  userId: `user_${n}`,
  userName: 'ضيف',
  userPhone: '01012345678',
  userEmail: 'g@example.com',
  userRole: 'user' as Booking['userRole'],
  checkIn: day(12),
  checkOut: day(15),
  guestsCount: 18,
  totalPrice: 7560,
  depositPaid: false,
  depositAmount: 1134,
  status: 'pending',
  isLargeConferenceQuote: false,
  paymentStatus: 'unpaid',
  createdAt: iso(0, 10),
  ...over,
});

// Every payment state in the mockup — 15%, 100%, 48%, 0% — plus each age
// bucket, so the relative-time wording is exercised rather than assumed.
const bookings: Booking[] = [
  mk({ userName: 'أسرة القديس مرقس', organizationName: 'كنيسة العذراء - المعادي', userPhone: '01001234567',
       status: 'pending', createdAt: iso(0, 10), totalPrice: 7560, depositAmount: 1134, guestsCount: 18,
       checkIn: day(12), checkOut: day(15) }),
  mk({ userName: 'خدام وخدامات مارجرجس', organizationName: 'كنيسة مارجرجس - شبرا', userPhone: '01115556677',
       status: 'pending', createdAt: iso(-1, 18), totalPrice: 12400, depositAmount: 1860, guestsCount: 32,
       checkIn: day(20), checkOut: day(23) }),
  // A receipt under review. Only reachable on an APPROVED booking — the guest
  // cannot send proof before the house has said yes — so pairing it with
  // status 'pending' would be testing a state the app cannot produce.
  mk({ userName: 'أسرة الشهيد مارمينا', organizationName: 'كنيسة مارمينا - فلمنج', userPhone: '01188889999',
       status: 'approved', paymentStatus: 'pending_verification', totalPrice: 8200, depositAmount: 1230,
       guestsCount: 20, checkIn: day(9), checkOut: day(11), createdAt: iso(-4, 16) }),
  mk({ userName: 'مجموعة شباب الأنبا بيشوي', organizationName: 'إيبارشية دمياط', userPhone: '01223334444',
       status: 'approved', depositPaid: true, paymentStatus: 'paid_full', totalPrice: 4800, depositAmount: 720,
       guestsCount: 12, checkIn: day(3), checkOut: day(5), createdAt: iso(-14, 12) }),
  mk({ userName: 'خلوة إعدادي - كنيسة الملاك', organizationName: 'كنيسة الملاك ميخائيل', userPhone: '01277778888',
       status: 'approved', depositPaid: true, paymentStatus: 'paid_deposit', totalPrice: 9600, depositAmount: 4608,
       guestsCount: 24, checkIn: day(0), checkOut: day(2), createdAt: iso(-30, 9) }),
  mk({ userName: 'الأستاذ بيشوي رمزي', userPhone: '01066667777', source: 'manual',
       status: 'approved', totalPrice: 2200, depositAmount: 330, guestsCount: 6,
       checkIn: day(1), checkOut: day(1), createdAt: iso(-2, 15) }),
  mk({ userName: 'أسرة نهضة الكنيسة', organizationName: 'كنيسة الأنبا أنطونيوس', userPhone: '01099998888',
       source: 'temporary', status: 'approved', totalPrice: 15300, depositAmount: 2295, guestsCount: 40,
       checkIn: day(35), checkOut: day(39), createdAt: iso(-5, 11) }),
  mk({ userName: 'مؤتمر الخدمة السنوي', organizationName: 'إيبارشية شبرا الخيمة', userPhone: '01555554444',
       status: 'completed', depositPaid: true, paymentStatus: 'paid_full', totalPrice: 21000, depositAmount: 3150,
       guestsCount: 55, checkIn: day(-20), checkOut: day(-17), createdAt: iso(-60, 8) }),
  mk({ userName: 'مجموعة ثانوي - طنطا', userPhone: '01444443333', status: 'cancelled',
       totalPrice: 6000, depositAmount: 900, guestsCount: 15, checkIn: day(-8), checkOut: day(-6),
       createdAt: iso(-40, 14) }),
];

const waitlist: WaitlistEntry[] = [
  { id: 'wl_1', houseId, userId: 'u_w', userName: 'كنيسة الشهيد أبانوب', userPhone: '01033332222',
    checkIn: day(18), checkOut: day(21), guestsCount: 26, status: 'waiting',
    createdAt: iso(-3, 13) } as unknown as WaitlistEntry,
];

function Preview() {
  // The shell opens on its overview tab and shows a first-run tour. Skip
  // both, then optionally drill into one booking: ?detail=3 opens the
  // fourth card, so the detail panel can be reviewed without hand-clicking.
  useEffect(() => {
    const t = setTimeout(() => {
      const skip = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'تخطي الجولة');
      skip?.click();
      document.getElementById('owner-primary-tab-bookings')?.click();
      const detail = new URLSearchParams(location.search).get('detail');
      if (detail !== null) {
        setTimeout(() => {
          const cards = document.querySelectorAll<HTMLElement>('[id^="owner-booking-booking_"]');
          cards[Number(detail) || 0]?.click();
        }, 120);
      }
    }, 400);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="bg-[var(--color-owner-bg)] min-h-screen p-3">
      <OwnerDashboardShell
        owner={owner}
        houses={houses}
        bookings={bookings}
        settings={DEFAULT_PLATFORM_SETTINGS}
        waitlist={waitlist}
        attendees={[]}
        allocations={[]}
        onAddHouse={() => undefined}
        onApproveBooking={() => undefined}
        onRejectBooking={() => undefined}
        onUpdateAttendees={() => undefined}
        onUpdateAllocations={() => undefined}
        // The approved-booking action row is gated on these optional
        // callbacks; without them the row renders empty and the layout under
        // review is not the one the owner sees.
        onConfirmDeposit={() => undefined}
        onCheckInBooking={() => undefined}
        onCheckOutBooking={() => undefined}
        onAssignRooms={() => undefined}
        onOpenRoomDistribution={() => undefined}
        onDeleteBooking={() => undefined}
        onUpdateBookingDetails={async () => true}
      />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Preview />);
