// TEMPORARY design-review page — mounts the REAL AdminDashboard with
// fabricated rows so all fourteen tabs can be measured at 375px without
// Supabase or an admin login. Mounting the real component (rather than a copy
// of its markup) is the point: a copy would verify the copy.
// Delete this file and preview-admin.html once the panel is signed off.
import { createRoot } from 'react-dom/client';
import AdminDashboard from './components/AdminDashboard';
import { INITIAL_HOUSES } from './mockData';
import { DEFAULT_PLATFORM_SETTINGS } from './types';
import type {
  User, Booking, Review, Payment, Payout, PromoBanner, AuditLogEntry, RetreatHouse,
} from './types';
import './index.css';

const day = (from: number) => {
  const d = new Date();
  d.setDate(d.getDate() + from);
  return d.toISOString().slice(0, 10);
};
const iso = (from: number, hour = 9) => {
  const d = new Date();
  d.setDate(d.getDate() + from);
  d.setHours(hour, 30, 0, 0);
  return d.toISOString();
};

const admin = {
  id: 'user_admin', name: 'إدارة بيما', email: 'admin@pima.eg', phone: '01096126259',
  role: 'admin', points: 0, favorites: [], createdAt: '2025-01-01T00:00:00.000Z',
} as unknown as User;

// Every role and both review states, so the filters and queues have rows.
const users: User[] = [
  admin,
  { id: 'u_own1', name: 'أ. مينا صبحي', email: 'mina@x.eg', phone: '01001234567', role: 'owner',
    approvalStatus: 'pending', governorate: 'الإسكندرية', birthDate: '1985-03-04', createdAt: iso(-3) },
  { id: 'u_own2', name: 'أ. سامح فؤاد', email: 'sameh@x.eg', phone: '01002224444', role: 'owner',
    approvalStatus: 'approved', governorate: 'القاهرة', birthDate: '1978-11-20', createdAt: iso(-40) },
  { id: 'u_serv', name: 'خادم كنيسة مارجرجس', email: 'serv@x.eg', phone: '01115556677', role: 'servant',
    approvalStatus: 'pending', governorate: 'القليوبية', birthDate: '1992-06-15', createdAt: iso(-1) },
  { id: 'u_ind', name: 'بيشوي رمزي', email: 'b@x.eg', phone: '01066667777', role: 'individual',
    governorate: 'الجيزة', birthDate: '2000-01-09', createdAt: iso(-12) },
  { id: 'u_ban', name: 'حساب موقوف', email: 'x@x.eg', phone: '01099998888', role: 'individual',
    isBanned: true, governorate: 'أسيوط', birthDate: '1995-08-08', createdAt: iso(-90) },
].map((u) => ({ points: 0, favorites: [], ...u })) as unknown as User[];

// A pending house and a pending EDIT are different queues — both must render.
const houses: RetreatHouse[] = INITIAL_HOUSES.slice(0, 4).map((h, i) => ({
  ...h,
  status: i === 0 ? 'pending' : 'approved',
  pendingEdits: i === 1 ? { name: `${h.name} (اسم جديد)`, pricePerNight: 320 } : undefined,
})) as RetreatHouse[];

let n = 0;
const mk = (over: Partial<Booking>): Booking => ({
  id: `booking_1784292488${(n += 3).toString().padStart(3, '0')}`,
  houseId: houses[1].id, houseName: houses[1].name,
  userId: 'u_ind', userName: 'ضيف', userPhone: '01012345678', userEmail: 'g@x.eg',
  userRole: 'user' as Booking['userRole'],
  checkIn: day(10), checkOut: day(13), guestsCount: 20,
  totalPrice: 8000, depositPaid: false, depositAmount: 1200,
  status: 'pending', isLargeConferenceQuote: false, paymentStatus: 'unpaid',
  createdAt: iso(0, 11), ...over,
});

const bookings: Booking[] = [
  mk({ userName: 'أسرة القديس مرقس', organizationName: 'كنيسة العذراء - المعادي', status: 'pending' }),
  mk({ userName: 'خدام مارجرجس', organizationName: 'كنيسة مارجرجس - شبرا', status: 'approved',
       paymentStatus: 'pending_verification', totalPrice: 12400, depositAmount: 1860, createdAt: iso(-2, 15) }),
  mk({ userName: 'شباب الأنبا بيشوي', status: 'approved', depositPaid: true, paymentStatus: 'paid_full',
       totalPrice: 4800, depositAmount: 720, checkIn: day(2), checkOut: day(4), createdAt: iso(-9, 12) }),
  mk({ userName: 'مؤتمر الخدمة السنوي', status: 'completed', depositPaid: true, paymentStatus: 'paid_full',
       totalPrice: 21000, depositAmount: 3150, checkIn: day(-20), checkOut: day(-17), createdAt: iso(-60, 8) }),
  mk({ userName: 'مجموعة ثانوي طنطا', status: 'cancelled', totalPrice: 6000, depositAmount: 900,
       checkIn: day(-8), checkOut: day(-6), createdAt: iso(-30, 14) }),
];

const reviews: Review[] = [
  { id: 'rv1', houseId: houses[1].id, userId: 'u_ind', userName: 'بيشوي رمزي', rating: 5, overall_rating: 5,
    comment: 'مكان هادي ونضيف جداً، والخدمة ممتازة.', createdAt: iso(-4) },
  { id: 'rv2', houseId: houses[1].id, userId: 'u_serv', userName: 'خادم كنيسة مارجرجس', rating: 3, overall_rating: 3,
    comment: 'المكان كويس بس المية سخنة كانت مقطوعة يوم.', createdAt: iso(-11) },
  { id: 'rv3', houseId: houses[2].id, userId: 'u_ind', userName: 'ضيف', rating: 4, overall_rating: 4,
    comment: 'تجربة حلوة عموماً.', createdAt: iso(-25) },
] as unknown as Review[];

const payments: Payment[] = [
  { id: 'pay1', bookingId: bookings[1].id, userId: 'u_ind', amount: 1860, paymentStatus: 'pending',
    method: 'instapay', createdAt: iso(-1, 20) },
  { id: 'pay2', bookingId: bookings[2].id, userId: 'u_ind', amount: 720, paymentStatus: 'approved',
    method: 'vodafone_cash', createdAt: iso(-9, 13) },
] as unknown as Payment[];

const payouts: Payout[] = [
  { id: 'po1', houseId: houses[1].id, ownerId: 'u_own2', amount: 5423, status: 'pending',
    requestedAt: iso(-1, 10), note: 'تحويل شهر أغسطس' },
  { id: 'po2', houseId: houses[2].id, ownerId: 'u_own2', amount: 2100, status: 'completed',
    requestedAt: iso(-30, 10) },
] as unknown as Payout[];

const promoBanners: PromoBanner[] = [
  { id: 'pb1', title: 'خصم الصيف', subtitle: 'خصم ١٥٪ على خلوات أغسطس', placement: 'carousel',
    status: 'published', isActive: true, createdAt: iso(-6) },
] as unknown as PromoBanner[];

// The action names AND the Arabic details the DB triggers actually write
// (032/033 + 104, all speaking Arabic since 105). Inventing plausible-looking
// values here would have the
// harness render the raw-key fallback and report a bug the app does not have.
const auditLog: AuditLogEntry[] = [
  { id: 'a1', actorId: 'user_admin', actorName: 'إدارة بيما', actorRole: 'admin',
    action: 'payout_status_changed', targetType: 'payout', targetId: 'po2',
    details: 'حالة التحويل: جارٍ التحويل ← تم التحويل | المبلغ: 2100 ج.م | المالك: أ. سامح فؤاد',
    createdAt: iso(0, 11) },
  { id: 'a2', actorId: 'user_admin', actorName: 'إدارة بيما', actorRole: 'admin',
    action: 'settings_changed', targetType: 'settings', targetId: '1',
    details: 'نسبة عمولة المنصة: 0.05 ← 0.07', createdAt: iso(-1, 16) },
  { id: 'a3', actorId: 'user_admin', actorName: 'إدارة بيما', actorRole: 'admin',
    action: 'payment_status_changed', targetType: 'payment', targetId: 'pay2',
    details: 'حالة الدفعة: معلّق ← معتمد | المبلغ: 720 ج.م', createdAt: iso(-9, 14) },
  { id: 'a4', actorId: 'u_own2', actorName: 'أ. سامح فؤاد', actorRole: 'owner',
    action: 'booking_status_changed', targetType: 'booking', targetId: bookings[2].id,
    details: 'الحالة: بانتظار الرد ← مؤكد', createdAt: iso(-9, 12) },
  { id: 'a5', actorId: 'user_admin', actorName: 'إدارة بيما', actorRole: 'admin',
    action: 'house_status_changed', targetType: 'house', targetId: houses[1].id,
    details: 'الحالة: قيد المراجعة ← نشط | البيت: "بيت الشماسة فيبي"', createdAt: iso(-30, 9) },
] as unknown as AuditLogEntry[];

const noop = () => undefined;

createRoot(document.getElementById('root')!).render(
  <div className="bg-[#F5F3EE] min-h-screen p-3">
    <AdminDashboard
      currentUser={admin}
      houses={houses}
      users={users}
      bookings={bookings}
      reviews={reviews}
      payments={payments}
      payouts={payouts}
      promoBanners={promoBanners}
      auditLog={auditLog}
      settings={DEFAULT_PLATFORM_SETTINGS}
      allocationsCount={12}
      onApproveHouse={noop}
      onRejectHouse={noop}
      onApproveHouseEdit={noop}
      onRejectHouseEdit={noop}
      onToggleUserRole={noop}
      onSuspendHouse={noop}
      onBanUser={noop}
      onCancelBooking={noop}
      onDeleteReview={noop}
      onVerifyPayment={noop}
      onSetUserApproval={noop}
      onAddPromoBanner={noop}
      onUpdatePromoBanner={noop}
      onTogglePromoBanner={noop}
      onDeletePromoBanner={noop}
      onUpdateSettings={noop}
      onLoadProofImage={async () => null}
      onUpdateHouse={noop}
      onDeleteHouse={noop}
      onUpdatePayoutStatus={noop}
      onSettleBookings={noop}
    />
  </div>,
);
