/* ═══════════════════════════════════════════════════════════════════════════
   PIMA — BEFORE / AFTER VISUAL REVIEW (development only)

   NOT PART OF THE APPLICATION. Not on any route, not reachable from
   index.html, and not an input to `vite build`, which has a single entry.

   The BEFORE panes are the REAL production files, pulled out of git at the
   checkpoint immediately before each migration and left otherwise untouched —
   only their relative import paths were rewritten for this folder's depth.
   Nothing here is drawn from memory.

       ProfileScreen  ← ds-phase4-pre-migration
       UserBookings   ← ds-phase5-pre-migration  (37ab688)
       UserDashboard  ← ds-phase6a-safety        (7f0bcd0)

   TO DELETE once the review is done:
       rm -rf src/showcase compare.html
   ═══════════════════════════════════════════════════════════════════════════ */

import React, { useState } from 'react';
import ProfileAfter from '../components/ProfileScreen';
import BookingsAfter from '../components/UserBookings';
import BrowseAfter from '../components/UserDashboard';
import ProfileBefore from './before/ProfileScreen.before';
import BookingsBefore from './before/UserBookings.before';
import BrowseBefore from './before/UserDashboard.before';
import { DEFAULT_PLATFORM_SETTINGS } from '../types';
import type { Booking, RetreatHouse, User, PlatformSettings, Payment } from '../types';

/* ── Representative data, shared by both panes so any difference is the
      migration and not the fixture ─────────────────────────────────────── */

const me = {
  id: 'u1', name: 'أندرو أشرف', role: 'individual', email: 'andrew@example.com',
  phone: '01003334444', createdAt: '2026-01-01T00:00:00Z', points: 12480,
  referralCode: 'PIMA-4821', dateOfBirth: '1996-04-12', governorate: 'القاهرة',
  address: 'مدينة نصر، شارع عباس العقاد، عمارة ١٢، الدور الثالث',
  churchName: 'كنيسة الشهيد مار جرجس', priestName: 'أبونا بيشوي',
  favorites: ['sea'],
} as unknown as User;

const mkHouse = (o: Partial<RetreatHouse>): RetreatHouse => ({
  id: 'h', name: 'بيت', description: 'وصف البيت', address: 'العنوان',
  governorate: 'الإسكندرية', status: 'approved', propertyType: 'conference',
  bedsCount: 40, pricePerNightPerPerson: 150, rating: 4.5, suitability: ['youth'],
  services: ['واي فاي', 'تكييف'], roomsDescription: 'غرف مشتركة', seaProximity: 'near',
  images: [], ownerId: 'o1', ownerName: 'المالك', roomsCount: 10, roomCapacity: 4,
  paymentMethods: [],
  ...o,
} as unknown as RetreatHouse);

// Dense: long names, long landmarks, every badge, the full price range.
const houses: RetreatHouse[] = [
  mkHouse({ id: 'long', rating: 4.9, discountPct: 0.25, pricePerNightPerPerson: 385,
    name: 'بيت مؤتمرات وخلوات دير الشهيد العظيم مار جرجس الروماني بالعجمي البيطاش الإسكندرية',
    address: 'طريق الإسكندرية مطروح الصحراوي، كيلو ٢١، العجمي البيطاش، الإسكندرية',
    nearbyLandmark: 'بجوار محطة ترام البيطاش الرئيسية ومركز خدمات المواطنين',
    bedsCount: 400, roomsCount: 120 }),
  mkHouse({ id: 'sea', name: 'بيت الملاك ميخائيل على البحر', seaProximity: 'beach',
    pricePerNightPerPerson: 260, rating: 4.7, bedsCount: 90 }),
  mkHouse({ id: 'girls', propertyType: 'student', studentHousingGender: 'girls',
    name: 'سكن طالبات جامعة الإسكندرية', pricePerNightPerPerson: 90, monthlyRent: 4500 }),
  mkHouse({ id: 'boys', propertyType: 'student', studentHousingGender: 'boys',
    name: 'سكن طلاب المنيا', pricePerNightPerPerson: 80 }),
  mkHouse({ id: 'staff', propertyType: 'staff', name: 'سكن موظفين ومغتربين',
    pricePerNightPerPerson: 120 }),
  mkHouse({ id: 'cheap', name: 'بيت خلوة اقتصادي', pricePerNightPerPerson: 45, rating: 3.2 }),
];

const mkBooking = (o: Partial<Booking>): Booking => ({
  id: 'b', houseId: 'sea', houseName: 'بيت الملاك ميخائيل على البحر', userId: 'u1',
  userName: 'أندرو أشرف', userPhone: '0100', userEmail: 'a@b.c', userRole: 'individual',
  checkIn: '2026-09-01', checkOut: '2026-09-04', guestsCount: 42,
  totalPrice: 58045, depositPaid: false, depositAmount: 8706,
  status: 'pending', isLargeConferenceQuote: false, createdAt: '2026-08-20T10:00:00Z',
  ...o,
} as unknown as Booking);

const bookings: Booking[] = [
  mkBooking({ id: 'b1', status: 'pending' }),
  mkBooking({ id: 'b2', status: 'approved', depositPaid: false }),
  mkBooking({ id: 'b3', status: 'approved', depositPaid: true }),
  mkBooking({ id: 'b4', status: 'completed', depositPaid: true }),
  mkBooking({ id: 'b5', status: 'rejected' }),
  mkBooking({ id: 'b6', status: 'cancelled' }),
];
const payments: Payment[] = [
  { id: 'p1', bookingId: 'b3', amount: 8706, paymentStatus: 'approved' } as Payment,
];
const settings = {
  ...DEFAULT_PLATFORM_SETTINGS, depositRate: 0.15,
  paymentMethods: [{ id: 'ppm1', type: 'instapay', label: 'بيما', value: '01096126259' }],
} as PlatformSettings;

const noop = () => {};

/* ── The three pairs ─────────────────────────────────────────────────────── */

const SCREENS = {
  profile: {
    label: 'الحساب',
    Before: () => (
      <ProfileBefore currentUser={me} onLogout={noop} onBack={noop} onNavigateSupport={noop}
        onNavigatePrivacy={noop} onDeleteAccount={async () => ({ ok: true })}
        onUpdateAvatar={noop} onNavigateBookings={noop} bookings={bookings} />
    ),
    After: () => (
      <ProfileAfter currentUser={me} onLogout={noop} onBack={noop} onNavigateSupport={noop}
        onNavigatePrivacy={noop} onDeleteAccount={async () => ({ ok: true })}
        onUpdateAvatar={noop} onNavigateBookings={noop} bookings={bookings} />
    ),
  },
  bookings: {
    label: 'الحجوزات',
    Before: () => (
      <BookingsBefore bookings={bookings} houses={houses} currentUser={me} attendees={[]}
        allocations={[]} payments={payments} onUpdateAttendees={noop} onUpdateAllocations={noop}
        onSubmitPayment={noop} settings={settings} onCancelBooking={noop} onAutoPayConsumed={noop} />
    ),
    After: () => (
      <BookingsAfter bookings={bookings} houses={houses} currentUser={me} attendees={[]}
        allocations={[]} payments={payments} onUpdateAttendees={noop} onUpdateAllocations={noop}
        onSubmitPayment={noop} settings={settings} onCancelBooking={noop} onAutoPayConsumed={noop} />
    ),
  },
  browse: {
    label: 'التصفح',
    Before: () => (
      <BrowseBefore houses={houses} currentUser={me} onSelectHouse={noop} onSelectRewards={noop}
        onToggleFavorite={noop} onOpenMap={noop} promoBanners={[]} bookings={bookings} />
    ),
    After: () => (
      <BrowseAfter houses={houses} currentUser={me} onSelectHouse={noop} onSelectRewards={noop}
        onToggleFavorite={noop} onOpenMap={noop} promoBanners={[]} bookings={bookings} />
    ),
  },
} as const;

type ScreenId = keyof typeof SCREENS;

export default function Compare() {
  const [screen, setScreen] = useState<ScreenId>('browse');
  const [version, setVersion] = useState<'before' | 'after'>('after');
  const [dir, setDir] = useState<'rtl' | 'ltr'>('rtl');
  const S = SCREENS[screen];
  const Body = version === 'before' ? S.Before : S.After;

  return (
    <div>
      {/* Chrome for reviewing — deliberately outside the reviewed area and
          styled with literals, so it can never be mistaken for the product. */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 999, display: 'flex', gap: 6, flexWrap: 'wrap',
        alignItems: 'center', padding: '6px 8px', background: '#15130F', color: '#EDE7DA',
        fontSize: 11, fontFamily: 'system-ui',
      }} dir="rtl">
        {(Object.keys(SCREENS) as ScreenId[]).map((id) => (
          <button key={id} id={`sc-${id}`} onClick={() => setScreen(id)}
            style={{ padding: '4px 8px', borderRadius: 6, cursor: 'pointer',
              background: screen === id ? '#C5A059' : '#2A2620',
              color: screen === id ? '#1A1A14' : '#EDE7DA', border: 0, fontWeight: 700 }}>
            {SCREENS[id].label}
          </button>
        ))}
        <span style={{ opacity: 0.4 }}>|</span>
        {(['before', 'after'] as const).map((v) => (
          <button key={v} id={`v-${v}`} onClick={() => setVersion(v)}
            style={{ padding: '4px 8px', borderRadius: 6, cursor: 'pointer',
              background: version === v ? '#C5A059' : '#2A2620',
              color: version === v ? '#1A1A14' : '#EDE7DA', border: 0, fontWeight: 700 }}>
            {v === 'before' ? 'قبل' : 'بعد'}
          </button>
        ))}
        <span style={{ opacity: 0.4 }}>|</span>
        <button id="flip" onClick={() => setDir((d) => (d === 'rtl' ? 'ltr' : 'rtl'))}
          style={{ padding: '4px 8px', borderRadius: 6, cursor: 'pointer',
            background: '#2A2620', color: '#EDE7DA', border: 0, fontWeight: 700 }}>
          {dir}
        </button>
        <span style={{ marginInlineStart: 'auto', opacity: 0.6 }}>
          {S.label} — {version === 'before' ? 'قبل الترحيل' : 'بعد الترحيل'}
        </span>
      </div>

      {/* The reviewed area. `key` forces a clean remount on every switch so no
          state leaks between the two implementations. */}
      <div id="stage" dir={dir} key={`${screen}-${version}-${dir}`}
        style={{ background: 'var(--ds-bg)', minHeight: '100vh' }}>
        <div className="px-4 py-6">
          <Body />
        </div>
      </div>
    </div>
  );
}
