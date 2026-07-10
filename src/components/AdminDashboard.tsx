import React, { useState } from 'react';
import { RetreatHouse, User, Booking, Payment, PlatformAnnouncement, Review, PlatformSettings, DEFAULT_PLATFORM_SETTINGS } from '../types';
import { Check, X, Shield, Users, BarChart3, Building, Clock, Star, TrendingUp, DollarSign, CreditCard, Smartphone, CheckSquare, AlertTriangle, CheckCircle2, Coins, MessageCircle, Calendar, IdCard, Megaphone, Ban, Power, Trash2, Home } from 'lucide-react';
import PhotoPickerButtons from './PhotoPickerButtons';

interface AdminDashboardProps {
  houses: RetreatHouse[];
  users: User[];
  bookings: Booking[];
  reviews?: Review[];
  onApproveHouse: (houseId: string) => void;
  onRejectHouse: (houseId: string) => void;
  onApproveHouseEdit?: (houseId: string) => void;
  onRejectHouseEdit?: (houseId: string) => void;
  onToggleUserRole: (userId: string, newRole: User['role']) => void;
  onSuspendHouse?: (houseId: string, suspend: boolean) => void;
  onBanUser?: (userId: string, banned: boolean) => void;
  onCancelBooking?: (bookingId: string) => void;
  onDeleteReview?: (reviewId: string) => void;
  allocationsCount?: number;
  payments?: Payment[];
  onVerifyPayment?: (paymentId: string, status: 'approved' | 'rejected', adminNotes?: string) => void;
  onSetUserApproval?: (userId: string, status: 'approved' | 'rejected') => void;
  platformAnnouncements?: PlatformAnnouncement[];
  onAddPlatformAnnouncement?: (a: PlatformAnnouncement) => void;
  onTogglePlatformAnnouncement?: (id: string, isActive: boolean) => void;
  onDeletePlatformAnnouncement?: (id: string) => void;
  settings?: PlatformSettings;
  onUpdateSettings?: (s: PlatformSettings) => void;
}

export default function AdminDashboard({
  houses,
  users,
  bookings,
  reviews = [],
  onApproveHouse,
  onRejectHouse,
  onApproveHouseEdit,
  onRejectHouseEdit,
  onToggleUserRole,
  onSuspendHouse,
  onBanUser,
  onCancelBooking,
  onDeleteReview,
  allocationsCount = 0,
  payments = [],
  onVerifyPayment,
  onSetUserApproval,
  platformAnnouncements = [],
  onAddPlatformAnnouncement,
  onTogglePlatformAnnouncement,
  onDeletePlatformAnnouncement,
  settings = DEFAULT_PLATFORM_SETTINGS,
  onUpdateSettings,
}: AdminDashboardProps) {
  // Tabs within Admin
  const [activeTab, setActiveTab] = useState<'moderation' | 'accounts' | 'houses' | 'reviews' | 'announcements' | 'users' | 'reports' | 'payments' | 'bookings' | 'settings'>('moderation');
  // Draft copy of settings for the settings form
  const [settingsDraft, setSettingsDraft] = useState(settings);
  const [settingsSaved, setSettingsSaved] = useState(false);
  React.useEffect(() => { setSettingsDraft(settings); }, [settings]);
  const [notesInputs, setNotesInputs] = useState<Record<string, string>>({});
  const [selectedProofImage, setSelectedProofImage] = useState<string | null>(null);

  // Financial dashboard period filter (mirrors the owner dashboard's)
  const [finPeriod, setFinPeriod] = useState<'today' | '7d' | '30d' | 'month' | 'all' | 'custom'>('all');
  const [finFrom, setFinFrom] = useState('');
  const [finTo, setFinTo] = useState('');

  // Platform announcement form state
  const [annMessage, setAnnMessage] = useState('');
  const [annImageUrl, setAnnImageUrl] = useState('');
  const [annHouseId, setAnnHouseId] = useState('');

  const pendingAccounts = users.filter(u => (u.role === 'servant' || u.role === 'owner') && u.approvalStatus === 'pending');

  // Bookings search & filter states
  const [bookingSearch, setBookingSearch] = useState('');
  const [bookingFilter, setBookingFilter] = useState<'all' | 'pending' | 'unpaid' | 'completed'>('all');

  const getWhatsAppLink = (phone: string, text: string) => {
    let cleanPhone = phone.replace(/\D/g, ''); // Remove all non-digits
    if (cleanPhone.startsWith('01')) {
      cleanPhone = '2' + cleanPhone; // e.g., 010... -> 2010...
    } else if (cleanPhone.startsWith('1')) {
      cleanPhone = '20' + cleanPhone; // e.g., 10... -> 2010...
    }
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
  };

  const pendingOrUnpaidBookingsCount = bookings.filter((b) => {
    const bPayments = payments.filter((p) => p.bookingId === b.id && p.paymentStatus === 'approved');
    const totalPaid = bPayments.reduce((sum, p) => sum + p.amount, 0);
    const remaining = b.totalPrice - totalPaid;
    return b.status === 'pending' || remaining > 0;
  }).length;

  // Filter and search bookings
  const filteredBookings = bookings.filter((b) => {
    const matchesSearch =
      b.userName.toLowerCase().includes(bookingSearch.toLowerCase()) ||
      b.houseName.toLowerCase().includes(bookingSearch.toLowerCase()) ||
      b.id.toLowerCase().includes(bookingSearch.toLowerCase()) ||
      b.userPhone.includes(bookingSearch);

    if (!matchesSearch) return false;

    const bPayments = payments.filter((p) => p.bookingId === b.id && p.paymentStatus === 'approved');
    const totalPaid = bPayments.reduce((sum, p) => sum + p.amount, 0);
    const remaining = b.totalPrice - totalPaid;

    if (bookingFilter === 'pending') {
      return b.status === 'pending';
    }
    if (bookingFilter === 'unpaid') {
      return remaining > 0;
    }
    if (bookingFilter === 'completed') {
      return b.status === 'completed' || (b.status === 'approved' && remaining <= 0);
    }
    return true; // 'all'
  });


  // Filter pending houses
  const pendingHouses = houses.filter((h) => h.status === 'pending');
  // Already-approved houses with an owner-submitted edit awaiting review
  const pendingHouseEdits = houses.filter((h) => h.pendingEdit);

  // Only the fields that actually changed vs. the live house, for a clean diff view
  const HOUSE_EDIT_DIFF_FIELDS: { key: keyof RetreatHouse; label: string; suffix?: string }[] = [
    { key: 'name', label: 'الاسم' },
    { key: 'pricePerNightPerPerson', label: 'سعر الفرد/ليلة', suffix: ' ج.م' },
    { key: 'monthlyRent', label: 'الإيجار الشهري', suffix: ' ج.م' },
    { key: 'roomsCount', label: 'عدد الغرف' },
    { key: 'bedsCount', label: 'عدد الأسرة' },
    { key: 'governorate', label: 'المحافظة' },
    { key: 'address', label: 'العنوان' },
    { key: 'description', label: 'الوصف' },
    { key: 'roomsDescription', label: 'وصف الغرف' },
  ];
  const getHouseEditDiff = (house: RetreatHouse) => {
    const pending = house.pendingEdit || {};
    const rows = HOUSE_EDIT_DIFF_FIELDS.filter(
      (f) => pending[f.key] !== undefined && pending[f.key] !== house[f.key]
    );
    const arrayFieldsChanged: string[] = [];
    const changed = (a: unknown, b: unknown) => JSON.stringify(a) !== JSON.stringify(b);
    if (pending.services && changed(pending.services, house.services)) arrayFieldsChanged.push('الخدمات والمرافق');
    if (pending.suitability && changed(pending.suitability, house.suitability)) arrayFieldsChanged.push('الفئات المناسبة');
    if (pending.activities && changed(pending.activities, house.activities)) arrayFieldsChanged.push('الأنشطة');
    if (pending.images && changed(pending.images, house.images)) arrayFieldsChanged.push('صور البيت');
    if (pending.conferenceHalls && changed(pending.conferenceHalls, house.conferenceHalls)) arrayFieldsChanged.push('قاعات المؤتمرات');
    return { rows, arrayFieldsChanged };
  };

  // Booking Report calculations
  const totalApprovedBookingsCount = bookings.filter((b) => b.status === 'approved' || b.status === 'completed').length;
  const totalBookingsValue = bookings
    .filter((b) => b.status === 'approved' || b.status === 'completed')
    .reduce((sum, b) => sum + b.totalPrice, 0);

  const averageBookingSize = totalApprovedBookingsCount > 0 
    ? Math.round(bookings.filter(b => b.status === 'approved' || b.status === 'completed').reduce((sum, b) => sum + b.guestsCount, 0) / totalApprovedBookingsCount)
    : 0;

  const totalRegisteredUsers = users.length;
  const totalHousesApproved = houses.filter(h => h.status === 'approved').length;

  // ─── Financial dashboard ────────────────────────────────────────────
  // Commission rate is admin-configurable (migration 024).
  const PLATFORM_COMMISSION = settings.commissionRate;

  // Period bounds — everything is scoped by the booking's check-in date so
  // "collected" and "expected" line up on the same time axis.
  const finBounds = (() => {
    const end = new Date();
    if (finPeriod === 'today') { const s = new Date(); s.setHours(0, 0, 0, 0); return { start: s, end }; }
    if (finPeriod === '7d') { const s = new Date(); s.setDate(s.getDate() - 7); return { start: s, end }; }
    if (finPeriod === '30d') { const s = new Date(); s.setDate(s.getDate() - 30); return { start: s, end }; }
    if (finPeriod === 'month') { return { start: new Date(end.getFullYear(), end.getMonth(), 1), end }; }
    if (finPeriod === 'custom' && finFrom && finTo) { return { start: new Date(finFrom), end: new Date(finTo) }; }
    return null; // all
  })();
  const bookingInPeriod = (b: Booking) => {
    if (!finBounds) return true;
    const d = new Date(b.checkIn);
    return d >= finBounds.start && d <= finBounds.end;
  };

  const periodBookings = bookings.filter(bookingInPeriod);
  const periodConfirmed = periodBookings.filter((b) => b.status === 'approved' || b.status === 'completed');

  // Expected = confirmed bookings' total price. Collected = admin-approved
  // payments whose booking falls in the period.
  const expectedRevenue = periodConfirmed.reduce((sum, b) => sum + b.totalPrice, 0);
  const periodBookingIds = new Set(periodBookings.map((b) => b.id));
  const collectedRevenue = payments
    .filter((p) => p.paymentStatus === 'approved' && periodBookingIds.has(p.bookingId))
    .reduce((sum, p) => sum + p.amount, 0);

  const expectedCommission = Math.round(expectedRevenue * PLATFORM_COMMISSION);
  const collectedCommission = Math.round(collectedRevenue * PLATFORM_COMMISSION);
  const ownersNetFromCollected = collectedRevenue - collectedCommission;
  const outstanding = Math.max(0, expectedRevenue - collectedRevenue);

  // Per-owner breakdown from collected payments (who to pay out, and how much)
  const houseOwnerId: Record<string, string> = {};
  houses.forEach((h) => { houseOwnerId[h.id] = h.ownerId; });
  const bookingHouseId: Record<string, string> = {};
  bookings.forEach((b) => { bookingHouseId[b.id] = b.houseId; });

  const ownerAgg: Record<string, { name: string; collected: number; expected: number }> = {};
  periodConfirmed.forEach((b) => {
    const oid = houseOwnerId[b.houseId];
    if (!oid) return;
    if (!ownerAgg[oid]) ownerAgg[oid] = { name: users.find((u) => u.id === oid)?.name || 'مالك', collected: 0, expected: 0 };
    ownerAgg[oid].expected += b.totalPrice;
  });
  payments.filter((p) => p.paymentStatus === 'approved' && periodBookingIds.has(p.bookingId)).forEach((p) => {
    const hid = bookingHouseId[p.bookingId];
    const oid = hid ? houseOwnerId[hid] : undefined;
    if (!oid) return;
    if (!ownerAgg[oid]) ownerAgg[oid] = { name: users.find((u) => u.id === oid)?.name || 'مالك', collected: 0, expected: 0 };
    ownerAgg[oid].collected += p.amount;
  });
  const ownerRows = Object.entries(ownerAgg)
    .map(([id, v]) => ({ id, ...v, net: Math.round(v.collected * (1 - PLATFORM_COMMISSION)) }))
    .sort((a, b) => b.collected - a.collected);

  // Top houses by collected revenue
  const houseCollected: Record<string, number> = {};
  payments.filter((p) => p.paymentStatus === 'approved' && periodBookingIds.has(p.bookingId)).forEach((p) => {
    const hid = bookingHouseId[p.bookingId];
    if (hid) houseCollected[hid] = (houseCollected[hid] || 0) + p.amount;
  });
  const topHouses = Object.entries(houseCollected)
    .map(([id, amount]) => ({ id, name: houses.find((h) => h.id === id)?.name || id, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  return (
    <div className="space-y-4 text-right text-[#4A4A3A]">
      
      {/* Admin header */}
      <div className="bg-gradient-to-r from-[#4A4A3A] to-[#5A5A40] text-white rounded-3xl p-4 flex items-center justify-between">
        <div>
          <span className="text-[10px] text-amber-300 font-bold">لوحة الإدارة والمراجعة الشاملة</span>
          <h2 className="text-sm font-extrabold">قدس الأب / أبونا ميخائيل</h2>
        </div>
        <div className="p-1.5 bg-white/20 border border-white/30 text-white rounded-xl">
          <Shield className="w-5 h-5 text-white" />
        </div>
      </div>

      {/* Internal Navigation */}
      <div className="flex border border-[#D6D6C2] bg-white p-1 rounded-2xl gap-1 overflow-x-auto">
        <button
          id="admin-tab-moderation"
          onClick={() => setActiveTab('moderation')}
          className={`flex-1 text-center py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap relative ${
            activeTab === 'moderation' ? 'bg-[#5A5A40] text-white shadow-sm' : 'text-[#8A8A70] hover:bg-[#EBEBE0]/40'
          }`}
        >
          مراجعة البيوت ({pendingHouses.length + pendingHouseEdits.length})
          {(pendingHouses.length + pendingHouseEdits.length) > 0 && (
            <span className="absolute top-1.5 left-2 w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
          )}
        </button>
        <button
          id="admin-tab-accounts"
          onClick={() => setActiveTab('accounts')}
          className={`flex-1 text-center py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap relative ${
            activeTab === 'accounts' ? 'bg-[#5A5A40] text-white shadow-sm' : 'text-[#8A8A70] hover:bg-[#EBEBE0]/40'
          }`}
        >
          مراجعة الحسابات ({pendingAccounts.length})
          {pendingAccounts.length > 0 && (
            <span className="absolute top-1.5 left-2 w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
          )}
        </button>
        <button
          id="admin-tab-houses"
          onClick={() => setActiveTab('houses')}
          className={`flex-1 text-center py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'houses' ? 'bg-[#5A5A40] text-white shadow-sm' : 'text-[#8A8A70] hover:bg-[#EBEBE0]/40'
          }`}
        >
          إدارة البيوت ({houses.length})
        </button>
        <button
          id="admin-tab-reviews"
          onClick={() => setActiveTab('reviews')}
          className={`flex-1 text-center py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'reviews' ? 'bg-[#5A5A40] text-white shadow-sm' : 'text-[#8A8A70] hover:bg-[#EBEBE0]/40'
          }`}
        >
          المراجعات ({reviews.length})
        </button>
        <button
          id="admin-tab-announcements"
          onClick={() => setActiveTab('announcements')}
          className={`flex-1 text-center py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'announcements' ? 'bg-[#5A5A40] text-white shadow-sm' : 'text-[#8A8A70] hover:bg-[#EBEBE0]/40'
          }`}
        >
          الإعلانات ({platformAnnouncements.length})
        </button>
        <button
          id="admin-tab-payments"
          onClick={() => setActiveTab('payments')}
          className={`flex-1 text-center py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap relative ${
            activeTab === 'payments' ? 'bg-[#5A5A40] text-white shadow-sm' : 'text-[#8A8A70] hover:bg-[#EBEBE0]/40'
          }`}
        >
          مراجعة الدفعيات ({payments.filter(p => p.paymentStatus === 'pending').length})
          {payments.filter(p => p.paymentStatus === 'pending').length > 0 && (
            <span className="absolute top-1.5 left-2 w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
          )}
        </button>
        <button
          id="admin-tab-bookings"
          onClick={() => setActiveTab('bookings')}
          className={`flex-1 text-center py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap relative ${
            activeTab === 'bookings' ? 'bg-[#5A5A40] text-white shadow-sm' : 'text-[#8A8A70] hover:bg-[#EBEBE0]/40'
          }`}
        >
          إدارة الحجوزات ({pendingOrUnpaidBookingsCount})
          {pendingOrUnpaidBookingsCount > 0 && (
            <span className="absolute top-1.5 left-2 w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
          )}
        </button>
        <button
          id="admin-tab-users"
          onClick={() => setActiveTab('users')}
          className={`flex-1 text-center py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'users' ? 'bg-[#5A5A40] text-white shadow-sm' : 'text-[#8A8A70] hover:bg-[#EBEBE0]/40'
          }`}
        >
          إدارة المستخدمين ({users.length})
        </button>
        <button
          id="admin-tab-reports"
          onClick={() => setActiveTab('reports')}
          className={`flex-1 text-center py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'reports' ? 'bg-[#5A5A40] text-white shadow-sm' : 'text-[#8A8A70] hover:bg-[#EBEBE0]/40'
          }`}
        >
          💰 المالية والتقارير
        </button>
        <button
          id="admin-tab-settings"
          onClick={() => setActiveTab('settings')}
          className={`flex-1 text-center py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'settings' ? 'bg-[#5A5A40] text-white shadow-sm' : 'text-[#8A8A70] hover:bg-[#EBEBE0]/40'
          }`}
        >
          ⚙️ إعدادات المنصة
        </button>
      </div>

      {/* Moderation Panel */}
      {activeTab === 'moderation' && (
        <div className="space-y-4">
          <div className="text-xs font-bold text-[#8A8A70] px-1">البيوت الجديدة المرسلة بانتظار الاعتماد للظهور:</div>

          {pendingHouses.length === 0 && pendingHouseEdits.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 border border-[#D6D6C2] text-center space-y-2">
              <Building className="w-8 h-8 text-[#BCBC9D] mx-auto" />
              <p className="text-sm font-bold text-[#4A4A3A]">لا توجد أي بيوت أو تعديلات معلقة حالياً</p>
              <p className="text-[11px] text-[#8A8A70]">كافة بيوت المؤتمرات والفنادق مراجعة ومقرة بنجاح.</p>
            </div>
          ) : (
            <>
              {pendingHouses.length > 0 && (
                <div className="space-y-3">
                  {pendingHouses.map((house) => (
                    <div key={house.id} className="bg-white rounded-3xl border border-[#D6D6C2] shadow-sm overflow-hidden text-right">
                      <div className="h-24 bg-[#EBEBE0] relative">
                        <img referrerPolicy="no-referrer" src={house.images[0]} alt={house.name} className="w-full h-full object-cover" />
                        <span className="absolute top-2 right-2 bg-[#5A5A40]/90 backdrop-blur-sm text-white px-2 py-0.5 rounded text-[9px] font-bold">
                          {house.governorate}
                        </span>
                      </div>

                      <div className="p-4 space-y-2.5">
                        <div>
                          <h3 className="text-xs font-bold text-[#4A4A3A]">{house.name}</h3>
                          <p className="text-[10px] text-[#8A8A70] mt-0.5">صاحب البيت: {house.ownerName}</p>
                        </div>

                        <p className="text-[11px] text-[#4A4A3A] leading-relaxed line-clamp-2">{house.description}</p>

                        <div className="bg-[#EBEBE0]/30 rounded-2xl p-2.5 grid grid-cols-3 gap-1.5 text-center text-[10px] text-[#4A4A3A] font-bold border border-[#D6D6C2]">
                          <div>الغرف: {house.roomsCount}</div>
                          <div>الأسرة: {house.bedsCount}</div>
                          <div>سعر الفرد: {house.pricePerNightPerPerson} ج.م</div>
                        </div>

                        {/* Moderation buttons */}
                        <div className="flex gap-2 justify-end pt-2">
                          <button
                            id={`reject-house-${house.id}`}
                            onClick={() => {
                              onRejectHouse(house.id);
                              alert('تم رفض البيت وسيظل غير مرئي للمستخدمين.');
                            }}
                            className="flex items-center gap-1 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-800 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>رفض البيت</span>
                          </button>
                          <button
                            id={`approve-house-${house.id}`}
                            onClick={() => {
                              onApproveHouse(house.id);
                              alert('تم اعتماد البيت ونشره بنجاح للجمهور ببيوت المؤتمرات!');
                            }}
                            className="flex items-center gap-1 bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-1.5 rounded-xl text-xs font-extrabold shadow-sm transition-all cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>اعتماد وموافقة للظهور</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {pendingHouseEdits.length > 0 && (
                <div className="space-y-3">
                  <div className="text-xs font-bold text-[#8A8A70] px-1 border-t border-[#D6D6C2] pt-3">
                    طلبات تعديل بيانات بيوت قائمة (بانتظار الموافقة):
                  </div>
                  {pendingHouseEdits.map((house) => {
                    const { rows, arrayFieldsChanged } = getHouseEditDiff(house);
                    return (
                      <div key={house.id} className="bg-white rounded-3xl border border-amber-200 shadow-sm p-4 space-y-2.5 text-right">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-bold text-[#4A4A3A]">{house.name}</h3>
                          <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full shrink-0">
                            تعديل قيد المراجعة
                          </span>
                        </div>
                        <p className="text-[10px] text-[#8A8A70]">صاحب البيت: {house.ownerName}</p>

                        {rows.length === 0 && arrayFieldsChanged.length === 0 ? (
                          <p className="text-[10px] text-[#8A8A70]">لا توجد تغييرات ظاهرة في الحقول الأساسية.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {rows.map((f) => (
                              <div key={f.key as string} className="bg-[#EBEBE0]/30 rounded-xl p-2 text-[10px] border border-[#D6D6C2]">
                                <span className="font-bold text-[#4A4A3A] block mb-0.5">{f.label}:</span>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-rose-600 line-through">{String(house[f.key] ?? '-')}{f.suffix || ''}</span>
                                  <span className="text-[#8A8A70]">←</span>
                                  <span className="text-emerald-700 font-bold">{String(house.pendingEdit?.[f.key] ?? '-')}{f.suffix || ''}</span>
                                </div>
                              </div>
                            ))}
                            {arrayFieldsChanged.length > 0 && (
                              <div className="bg-[#EBEBE0]/30 rounded-xl p-2 text-[10px] border border-[#D6D6C2]">
                                <span className="font-bold text-[#4A4A3A]">تم أيضاً تعديل: </span>
                                <span className="text-[#5A5A40]">{arrayFieldsChanged.join('، ')}</span>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="flex gap-2 justify-end pt-1.5">
                          <button
                            id={`reject-house-edit-${house.id}`}
                            onClick={() => {
                              onRejectHouseEdit && onRejectHouseEdit(house.id);
                              alert('تم رفض طلب التعديل، ستبقى بيانات البيت كما كانت.');
                            }}
                            className="flex items-center gap-1 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-800 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>رفض التعديل</span>
                          </button>
                          <button
                            id={`approve-house-edit-${house.id}`}
                            onClick={() => {
                              onApproveHouseEdit && onApproveHouseEdit(house.id);
                              alert('تم اعتماد التعديل وتطبيقه على بيانات البيت.');
                            }}
                            className="flex items-center gap-1 bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-1.5 rounded-xl text-xs font-extrabold shadow-sm transition-all cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>اعتماد التعديل</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Pending servant/owner account approvals */}
      {activeTab === 'accounts' && (
        <div className="space-y-3">
          <div className="text-xs font-bold text-[#8A8A70] px-1">حسابات الخدام وأصحاب البيوت بانتظار المراجعة والاعتماد:</div>

          {pendingAccounts.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 border border-[#D6D6C2] text-center space-y-2">
              <IdCard className="w-8 h-8 text-[#BCBC9D] mx-auto" />
              <p className="text-sm font-bold text-[#4A4A3A]">لا توجد حسابات معلقة حالياً</p>
              <p className="text-[11px] text-[#8A8A70]">كافة حسابات الخدام وأصحاب البيوت تمت مراجعتها.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingAccounts.map((acc) => (
                <div key={acc.id} className="bg-white rounded-3xl border border-[#D6D6C2] shadow-sm overflow-hidden text-right p-4 space-y-2.5">
                  <div>
                    <h3 className="text-xs font-bold text-[#4A4A3A]">{acc.name}</h3>
                    <p className="text-[10px] text-[#8A8A70] mt-0.5">
                      {acc.role === 'owner' ? 'صاحب بيت' : 'خادم'} · {acc.email} · {acc.phone}
                    </p>
                    {acc.organizationName && (
                      <p className="text-[10px] text-[#8A8A70] mt-0.5">الجهة: {acc.organizationName}</p>
                    )}
                    {acc.churchName && (
                      <p className="text-[10px] text-[#8A8A70] mt-0.5">الكنيسة: {acc.churchName} — الأب الكاهن: {acc.priestName}</p>
                    )}
                  </div>

                  {/* ID verification happens out-of-band on WhatsApp, not in-app */}
                  <a
                    href={`https://wa.me/2${acc.phone.replace(/^0/, '')}?text=${encodeURIComponent('سلام ونعمة، برجاء إرسال صورة بطاقتك الشخصية (وش وضهر) لاستكمال مراجعة حسابك على بيما.')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-1.5 rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-[10.5px] font-bold py-2.5 hover:bg-emerald-100 transition-colors"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>تواصل واتساب لمراجعة البطاقة الشخصية</span>
                  </a>

                  <div className="flex gap-2 justify-end pt-1">
                    <button
                      id={`reject-account-${acc.id}`}
                      onClick={() => onSetUserApproval && onSetUserApproval(acc.id, 'rejected')}
                      className="flex items-center gap-1 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-800 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>رفض الحساب</span>
                    </button>
                    <button
                      id={`approve-account-${acc.id}`}
                      onClick={() => onSetUserApproval && onSetUserApproval(acc.id, 'approved')}
                      className="flex items-center gap-1 bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-1.5 rounded-xl text-xs font-extrabold shadow-sm transition-all cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>اعتماد الحساب</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Platform economics settings (admin-configurable, migration 024) */}
      {activeTab === 'settings' && (
        <div className="space-y-3">
          <div className="text-xs font-bold text-[#8A8A70] px-1">التحكم في اقتصاد المنصة — يُطبَّق فوراً على الحسابات والأسعار:</div>
          <div className="bg-white rounded-3xl border border-[#D6D6C2] p-4 space-y-4">
            {([
              { key: 'commissionRate', label: 'نسبة عمولة المنصة', suffix: '%', factor: 100, hint: 'حصتك من كل حجز (على المستحقات والتقارير).' },
              { key: 'depositRate', label: 'نسبة العربون المقدّم', suffix: '%', factor: 100, hint: 'النسبة اللي يدفعها العميل مقدماً لتأكيد الحجز.' },
              { key: 'maxRedemptionPct', label: 'أقصى خصم بالنقاط من الحجز', suffix: '%', factor: 100, hint: 'أقصى نسبة من قيمة الحجز ممكن تتدفع بالنقاط.' },
              { key: 'pointsPerEgp', label: 'نقاط مقابل الجنيه (الاستبدال)', suffix: 'نقطة = ١ ج.م', factor: 1, hint: 'كل كام نقطة تساوي جنيه عند الخصم.' },
              { key: 'referralBonusPoints', label: 'مكافأة دعوة صديق', suffix: 'نقطة', factor: 1, hint: 'نقاط تُمنح للمُحيل عند أول حجز مدفوع لصديقه.' },
            ] as const).map((f) => (
              <div key={f.key} className="space-y-1">
                <label className="block text-[11px] font-bold text-[#4A4A3A]">{f.label}</label>
                <div className="flex items-center gap-2">
                  <input
                    id={`setting-${f.key}`}
                    type="number"
                    min={0}
                    step={f.factor === 100 ? 0.5 : 1}
                    value={f.factor === 100 ? +(settingsDraft[f.key] * 100).toFixed(2) : settingsDraft[f.key]}
                    onChange={(e) => {
                      const raw = parseFloat(e.target.value) || 0;
                      setSettingsDraft((prev) => ({ ...prev, [f.key]: f.factor === 100 ? raw / 100 : Math.round(raw) }));
                    }}
                    className="w-28 bg-white border border-[#D6D6C2] text-xs px-3 py-2 rounded-xl text-[#4A4A3A] focus:outline-none focus:border-[#5A5A40]"
                  />
                  <span className="text-[10px] text-[#8A8A70] font-bold">{f.suffix}</span>
                </div>
                <p className="text-[9px] text-[#8A8A70]">{f.hint}</p>
              </div>
            ))}

            {settingsSaved && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10.5px] font-bold rounded-xl px-3 py-2 text-center">
                ✅ تم حفظ الإعدادات وتطبيقها.
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                id="save-settings-btn"
                onClick={() => {
                  onUpdateSettings && onUpdateSettings(settingsDraft);
                  setSettingsSaved(true);
                  setTimeout(() => setSettingsSaved(false), 3000);
                }}
                className="flex-1 bg-[#0A2342] hover:bg-[#071930] text-white text-xs font-bold py-2.5 rounded-xl transition-colors cursor-pointer"
              >
                💾 حفظ وتطبيق
              </button>
              <button
                onClick={() => setSettingsDraft(settings)}
                className="bg-[#EBEBE0] text-[#4A4A3A] text-xs font-bold py-2.5 px-4 rounded-xl cursor-pointer"
              >
                تراجع
              </button>
            </div>
          </div>
          <div className="bg-amber-50/60 border border-amber-200/60 rounded-2xl p-3 text-[9.5px] text-amber-900 leading-relaxed">
            ⚠️ التغييرات بتأثر على الحجوزات الجديدة والدفعات الجاية. نسبة العمولة والعربون والنقاط بتتطبّق على السيرفر كمان مش بس في العرض.
          </div>
        </div>
      )}

      {/* Houses control — suspend / reactivate any house */}
      {activeTab === 'houses' && (
        <div className="space-y-3">
          <div className="text-xs font-bold text-[#8A8A70] px-1">التحكم في كل بيوت المنصة (إيقاف / إعادة تفعيل):</div>
          {houses.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 border border-[#D6D6C2] text-center">
              <Home className="w-8 h-8 text-[#BCBC9D] mx-auto mb-2" />
              <p className="text-sm font-bold text-[#4A4A3A]">لا توجد بيوت مسجلة بعد</p>
            </div>
          ) : (
            <div className="space-y-2">
              {houses.map((house) => {
                const statusLabel = house.status === 'approved' ? 'نشط' : house.status === 'pending' ? 'قيد المراجعة' : house.status === 'suspended' ? 'موقوف من الإدارة' : 'مرفوض';
                const statusClass = house.status === 'approved' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : house.status === 'pending' ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-rose-50 text-rose-800 border-rose-200';
                const owner = users.find((u) => u.id === house.ownerId);
                return (
                  <div key={house.id} className="bg-white p-3 rounded-2xl border border-[#D6D6C2] flex items-center gap-3 text-right">
                    <img referrerPolicy="no-referrer" src={house.images[0]} alt={house.name} className="w-14 h-14 rounded-xl object-cover shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-[#4A4A3A] truncate">{house.name}</div>
                      <div className="text-[9.5px] text-[#8A8A70] mt-0.5">{house.governorate} · {owner?.name || house.ownerName}</div>
                      <span className={`inline-block mt-1 text-[8.5px] font-bold px-2 py-0.5 rounded border ${statusClass}`}>{statusLabel}</span>
                    </div>
                    {(house.status === 'approved' || house.status === 'suspended') && (
                      <button
                        id={`toggle-house-suspend-${house.id}`}
                        onClick={() => {
                          const suspend = house.status === 'approved';
                          if (!suspend || confirm(`إيقاف بيت "${house.name}"؟ هيختفي من المنصة فوراً لحد ما تعيد تفعيله.`)) {
                            onSuspendHouse && onSuspendHouse(house.id, suspend);
                          }
                        }}
                        className={`shrink-0 flex items-center gap-1 text-[10px] font-bold px-3 py-2 rounded-xl border transition-all cursor-pointer ${
                          house.status === 'approved'
                            ? 'bg-rose-50 border-rose-200 text-rose-800 hover:bg-rose-100'
                            : 'bg-emerald-700 border-emerald-700 text-white hover:bg-emerald-800'
                        }`}
                      >
                        <Power className="w-3.5 h-3.5" />
                        <span>{house.status === 'approved' ? 'إيقاف' : 'إعادة تفعيل'}</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Reviews moderation — delete spam / abusive reviews */}
      {activeTab === 'reviews' && (
        <div className="space-y-3">
          <div className="text-xs font-bold text-[#8A8A70] px-1">مراجعة وحذف التقييمات المسيئة أو الوهمية:</div>
          {reviews.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 border border-[#D6D6C2] text-center">
              <Star className="w-8 h-8 text-[#BCBC9D] mx-auto mb-2" />
              <p className="text-sm font-bold text-[#4A4A3A]">لا توجد مراجعات بعد</p>
            </div>
          ) : (
            <div className="space-y-2">
              {[...reviews].sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1)).map((rev) => {
                const house = houses.find((h) => h.id === rev.houseId);
                return (
                  <div key={rev.id} className="bg-white p-3 rounded-2xl border border-[#D6D6C2] text-right space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold text-[#4A4A3A]">{rev.userName}</div>
                        <div className="text-[9px] text-[#8A8A70]">في: {house?.name || rev.houseName || rev.houseId}</div>
                      </div>
                      <span className="flex items-center gap-0.5 text-[10px] font-bold text-amber-600 shrink-0">
                        <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                        {(rev.overall_rating ?? rev.rating).toFixed(1)}
                      </span>
                    </div>
                    {rev.comment && <p className="text-[10.5px] text-[#4A4A3A] leading-relaxed bg-[#FAF8F5] rounded-xl p-2 border border-[#E7E5DB]">{rev.comment}</p>}
                    <div className="flex items-center justify-between">
                      <span className="text-[8.5px] text-[#BCBC9D]">{new Date(rev.createdAt).toLocaleDateString('ar-EG')}</span>
                      <button
                        id={`delete-review-${rev.id}`}
                        onClick={() => { if (confirm('حذف هذه المراجعة نهائياً؟ سيُعاد حساب تقييم البيت تلقائياً.')) onDeleteReview && onDeleteReview(rev.id); }}
                        className="flex items-center gap-1 text-[10px] font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>حذف</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Platform-wide announcement carousel (admin-only) */}
      {activeTab === 'announcements' && (
        <div className="space-y-3">
          <div className="bg-white rounded-2xl border border-[#D6D6C2] p-4 space-y-3">
            <div className="text-xs font-bold text-[#4A4A3A] flex items-center gap-1.5">
              <Megaphone className="w-4 h-4 text-[#5A5A40]" />
              إعلان جديد يظهر لجميع المستخدمين
            </div>
            <p className="text-[9.5px] text-[#8A8A70]">
              يظهر ضمن شريط دوّار أعلى شاشة الاستكشاف كل بضع ثوانٍ. يمكن ربطه ببيت معيّن ليفتح صفحته عند الضغط عليه.
            </p>
            <textarea
              id="platform-announcement-message"
              rows={2}
              placeholder="نص الإعلان..."
              value={annMessage}
              onChange={(e) => setAnnMessage(e.target.value)}
              className="w-full bg-white border border-[#D6D6C2] text-[11px] px-3 py-2 rounded-xl focus:outline-none"
            />
            <div>
              <label className="block text-[9px] font-bold text-[#8A8A70] mb-0.5">صورة الإعلان (اختياري):</label>
              <PhotoPickerButtons idPrefix="platform-announcement-image" onSelect={setAnnImageUrl} />
              {annImageUrl && (
                <img src={annImageUrl} alt="معاينة" className="mt-1.5 w-full h-20 object-cover rounded-lg border border-[#D6D6C2]" />
              )}
            </div>
            <div>
              <label className="block text-[9px] font-bold text-[#8A8A70] mb-0.5">ربط ببيت معيّن (اختياري):</label>
              <select
                id="platform-announcement-house"
                value={annHouseId}
                onChange={(e) => setAnnHouseId(e.target.value)}
                className="w-full bg-white border border-[#D6D6C2] text-[10px] px-2.5 py-1.5 rounded-lg focus:outline-none"
              >
                <option value="">بدون ربط</option>
                {houses.filter((h) => h.status === 'approved').map((h) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </div>
            <button
              id="platform-announcement-submit-btn"
              type="button"
              onClick={() => {
                if (!annMessage.trim()) { alert('يرجى كتابة نص الإعلان.'); return; }
                if (onAddPlatformAnnouncement) {
                  onAddPlatformAnnouncement({
                    id: `pann_${Date.now()}`,
                    message: annMessage.trim(),
                    imageUrl: annImageUrl.trim() || undefined,
                    linkedHouseId: annHouseId || undefined,
                    isActive: true,
                    createdAt: new Date().toISOString(),
                  });
                }
                setAnnMessage(''); setAnnImageUrl(''); setAnnHouseId('');
              }}
              className="bg-[#5A5A40] hover:bg-[#4A4A3A] text-white text-[10px] font-bold px-4 py-2 rounded-xl cursor-pointer"
            >
              نشر الإعلان
            </button>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-bold text-[#8A8A70] px-1">الإعلانات المنشورة ({platformAnnouncements.length}):</div>
            {platformAnnouncements.length === 0 ? (
              <div className="bg-white rounded-2xl border border-[#D6D6C2] p-4 text-center text-[10px] text-[#8A8A70]">
                لا توجد إعلانات منشورة بعد.
              </div>
            ) : (
              platformAnnouncements.map((a) => {
                const linkedHouse = a.linkedHouseId ? houses.find((h) => h.id === a.linkedHouseId) : undefined;
                return (
                  <div key={a.id} className="bg-white rounded-2xl border border-[#D6D6C2] p-3 flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className={`text-[11px] font-bold ${a.isActive ? 'text-[#4A4A3A]' : 'text-[#BCBC9D] line-through'}`}>{a.message}</p>
                      <span className="text-[8.5px] text-[#8A8A70]">
                        {new Date(a.createdAt).toLocaleDateString('ar-EG')}
                        {linkedHouse && ` · مرتبط بـ${linkedHouse.name}`}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onTogglePlatformAnnouncement && onTogglePlatformAnnouncement(a.id, !a.isActive)}
                      className={`text-[9.5px] font-bold px-2.5 py-1 rounded-lg shrink-0 cursor-pointer ${
                        a.isActive ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-[#EBEBE0] text-[#8A8A70]'
                      }`}
                    >
                      {a.isActive ? 'نشط — إخفاء' : 'إظهار'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { if (confirm('حذف هذا الإعلان نهائياً؟') && onDeletePlatformAnnouncement) onDeletePlatformAnnouncement(a.id); }}
                      className="text-[9.5px] font-bold text-rose-600 hover:underline cursor-pointer shrink-0"
                    >
                      حذف
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Users Management */}
      {activeTab === 'users' && (
        <div className="space-y-2">
          <div className="text-xs font-bold text-[#8A8A70] px-1">إدارة حسابات المسجلين والصلاحيات:</div>

          <div className="space-y-2">
            {users.map((usr) => (
              <div key={usr.id} className={`bg-white p-3.5 rounded-2xl border flex items-center justify-between text-right ${usr.isBanned ? 'border-rose-200 ring-1 ring-rose-50' : 'border-[#D6D6C2]'}`}>
                <div>
                  <div className="text-xs font-bold text-[#4A4A3A] flex items-center gap-1.5">
                    {usr.name}
                    {usr.isBanned && <span className="text-[8px] font-black bg-rose-600 text-white px-1.5 py-0.5 rounded">محظور</span>}
                  </div>
                  <div className="text-[10px] text-[#8A8A70] mt-0.5">{usr.email}</div>
                  {usr.organizationName && (
                    <div className="text-[9px] text-[#5A5A40] font-black mt-0.5">{usr.organizationName}</div>
                  )}
                </div>

                <div className="flex flex-col items-end gap-1.5">
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${
                    usr.role === 'admin'
                      ? 'bg-red-50 text-red-800 border-red-200'
                      : usr.role === 'owner'
                      ? 'bg-[#EBEBE0] text-[#5A5A40] border-[#BCBC9D]'
                      : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  }`}>
                    {usr.role === 'admin' ? 'إدارة' : usr.role === 'owner' ? 'صاحب بيت' : 'مستخدم'}
                  </span>

                  {/* Option to toggle roles for simulator */}
                  {usr.role !== 'admin' && (
                    <select
                      id={`user-role-select-${usr.id}`}
                      value={usr.role}
                      onChange={(e) => onToggleUserRole(usr.id, e.target.value as User['role'])}
                      className="text-[9px] bg-white border border-[#D6D6C2] rounded px-1.5 py-0.5 text-[#4A4A3A] outline-none focus:border-[#5A5A40]"
                    >
                      <option value="individual">ترقية لفرد</option>
                      <option value="servant">ترقية لخادم كنسي</option>
                      <option value="owner">ترقية لصاحب بيت</option>
                    </select>
                  )}

                  {/* Ban / unban — admin can't ban other admins */}
                  {usr.role !== 'admin' && (
                    <button
                      id={`toggle-ban-${usr.id}`}
                      onClick={() => {
                        if (usr.isBanned || confirm(`حظر المستخدم "${usr.name}"؟ لن يتمكن من استخدام المنصة نهائياً حتى ترفع الحظر.`)) {
                          onBanUser && onBanUser(usr.id, !usr.isBanned);
                        }
                      }}
                      className={`flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded-lg border transition-colors cursor-pointer ${
                        usr.isBanned
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                          : 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
                      }`}
                    >
                      <Ban className="w-3 h-3" />
                      <span>{usr.isBanned ? 'رفع الحظر' : 'حظر'}</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Booking Reports */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          {/* Period filter */}
          <div className="bg-white p-3 rounded-2xl border border-[#D6D6C2] space-y-2">
            <span className="text-[10px] font-bold text-[#8A8A70]">عرض الأرقام المالية عن فترة (حسب تاريخ الدخول):</span>
            <div className="flex flex-wrap gap-1.5">
              {([
                { key: 'today', label: 'اليوم' },
                { key: '7d', label: 'آخر ٧ أيام' },
                { key: '30d', label: 'آخر ٣٠ يوم' },
                { key: 'month', label: 'هذا الشهر' },
                { key: 'all', label: 'كل الوقت' },
                { key: 'custom', label: 'مدة مخصصة' },
              ] as const).map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setFinPeriod(p.key)}
                  className={`text-[9.5px] font-bold px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                    finPeriod === p.key ? 'bg-[#5A5A40] text-white' : 'bg-[#EBEBE0]/50 text-[#4A4A3A] hover:bg-[#DEDECB]'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {finPeriod === 'custom' && (
              <div className="flex items-center gap-1.5 pt-1">
                <input type="date" value={finFrom} onChange={(e) => setFinFrom(e.target.value)} className="flex-1 bg-white border border-[#D6D6C2] text-[10px] px-2 py-1.5 rounded-lg focus:outline-none" />
                <span className="text-[9px] text-[#8A8A70] shrink-0">إلى</span>
                <input type="date" value={finTo} onChange={(e) => setFinTo(e.target.value)} className="flex-1 bg-white border border-[#D6D6C2] text-[10px] px-2 py-1.5 rounded-lg focus:outline-none" />
              </div>
            )}
          </div>

          {/* Collected vs Expected — side by side */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gradient-to-br from-emerald-50 to-white p-4 rounded-3xl border border-emerald-200 space-y-1">
              <CheckCircle2 className="w-5 h-5 text-emerald-700" />
              <div className="text-[10px] text-emerald-900 font-bold">المحصّل فعلاً</div>
              <div className="text-lg font-black text-emerald-900">{collectedRevenue.toLocaleString()} ج.م</div>
              <div className="text-[9px] text-emerald-800/70">من دفعات معتمدة</div>
            </div>
            <div className="bg-gradient-to-br from-[#EBEBE0]/40 to-white p-4 rounded-3xl border border-[#D6D6C2] space-y-1">
              <TrendingUp className="w-5 h-5 text-[#5A5A40]" />
              <div className="text-[10px] text-[#8A8A70] font-bold">المتوقع الكلي</div>
              <div className="text-lg font-black text-[#4A4A3A]">{expectedRevenue.toLocaleString()} ج.م</div>
              <div className="text-[9px] text-[#8A8A70]">قيمة الحجوزات المؤكدة</div>
            </div>
          </div>

          {/* Commission — the business's cut */}
          <div className="bg-[#0A2342] text-white rounded-3xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-[#C5A059]" />
              <span className="text-[11px] font-black text-[#C5A059]">عمولة المنصة ({(PLATFORM_COMMISSION * 100).toFixed(0)}%)</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[9px] text-white/60 font-bold">من المحصّل فعلاً</div>
                <div className="text-xl font-black text-white">{collectedCommission.toLocaleString()} ج.م</div>
              </div>
              <div>
                <div className="text-[9px] text-white/60 font-bold">المتوقعة (كل الحجوزات)</div>
                <div className="text-xl font-black text-white/80">{expectedCommission.toLocaleString()} ج.م</div>
              </div>
            </div>
          </div>

          {/* Owner payouts + outstanding */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white p-4 rounded-3xl border border-[#D6D6C2] space-y-1">
              <DollarSign className="w-5 h-5 text-emerald-700" />
              <div className="text-[10px] text-[#8A8A70] font-bold">مستحقات الملّاك (صافي المحصّل)</div>
              <div className="text-lg font-black text-emerald-800">{ownersNetFromCollected.toLocaleString()} ج.م</div>
              <div className="text-[9px] text-[#8A8A70]">بعد خصم عمولتك</div>
            </div>
            <div className="bg-white p-4 rounded-3xl border border-[#D6D6C2] space-y-1">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <div className="text-[10px] text-[#8A8A70] font-bold">متبقٍ لم يُحصّل بعد</div>
              <div className="text-lg font-black text-amber-700">{outstanding.toLocaleString()} ج.م</div>
              <div className="text-[9px] text-[#8A8A70]">المتوقع − المحصّل</div>
            </div>
          </div>

          {/* Per-owner breakdown */}
          <div className="bg-white rounded-3xl p-4 border border-[#D6D6C2] space-y-2">
            <h3 className="text-xs font-black text-[#0A2342] border-b border-[#EBEBE0] pb-2">مستحقات كل صاحب بيت</h3>
            {ownerRows.length === 0 ? (
              <p className="text-[10px] text-[#8A8A70] text-center py-3">لا توجد حجوزات في هذه الفترة.</p>
            ) : (
              <>
                <div className="grid grid-cols-4 gap-1 text-[8.5px] font-bold text-[#8A8A70] pb-1 border-b border-[#EBEBE0]">
                  <span>المالك</span>
                  <span className="text-center">المحصّل</span>
                  <span className="text-center">عمولتك</span>
                  <span className="text-center">صافي مستحقاته</span>
                </div>
                {ownerRows.map((o) => (
                  <div key={o.id} className="grid grid-cols-4 gap-1 text-[10px] py-1.5 border-b border-[#EBEBE0]/50 last:border-0 items-center">
                    <span className="font-bold text-[#4A4A3A] truncate">{o.name}</span>
                    <span className="text-center text-emerald-800 font-bold">{o.collected.toLocaleString()}</span>
                    <span className="text-center text-[#C5A059] font-bold">{Math.round(o.collected * PLATFORM_COMMISSION).toLocaleString()}</span>
                    <span className="text-center text-[#0A2342] font-black">{o.net.toLocaleString()}</span>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Top houses by revenue */}
          {topHouses.length > 0 && (
            <div className="bg-white rounded-3xl p-4 border border-[#D6D6C2] space-y-2">
              <h3 className="text-xs font-black text-[#0A2342] border-b border-[#EBEBE0] pb-2">أكثر البيوت دخلاً</h3>
              {topHouses.map((h, i) => (
                <div key={h.id} className="flex items-center justify-between text-[10.5px] py-1.5 border-b border-[#EBEBE0]/50 last:border-0">
                  <span className="font-bold text-[#4A4A3A] truncate flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-[#EBEBE0] text-[#5A5A40] text-[8px] font-black flex items-center justify-center shrink-0">{i + 1}</span>
                    {h.name}
                  </span>
                  <span className="font-black text-emerald-800 shrink-0">{h.amount.toLocaleString()} ج.م</span>
                </div>
              ))}
            </div>
          )}

          {/* Booking-level context stats */}
          <div className="grid grid-cols-2 gap-3 text-right">
            <div className="bg-white p-4 rounded-3xl border border-[#D6D6C2] space-y-1">
              <BarChart3 className="w-5 h-5 text-[#5A5A40]" />
              <div className="text-[10px] text-[#8A8A70] font-bold">حجوزات مؤكدة (الفترة):</div>
              <div className="text-lg font-black text-[#4A4A3A]">{periodConfirmed.length}</div>
            </div>
            <div className="bg-white p-4 rounded-3xl border border-[#D6D6C2] space-y-1">
              <Users className="w-5 h-5 text-[#8A8A70]" />
              <div className="text-[10px] text-[#8A8A70] font-bold">متوسط الحضور بالرحلة:</div>
              <div className="text-lg font-black text-[#4A4A3A]">{averageBookingSize} فرد</div>
            </div>
          </div>

          {/* Quick general platform stats */}
          <div className="bg-white rounded-3xl p-4 border border-[#D6D6C2] space-y-3 text-right">
            <h3 className="text-xs font-bold text-[#4A4A3A]">إحصائيات المنصة العامة:</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center py-1.5 border-b border-[#D6D6C2]/60">
                <span className="text-[#8A8A70]">إجمالي الحسابات المسجلة بالمنصة:</span>
                <span className="font-bold text-[#4A4A3A]">{totalRegisteredUsers} عضو</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-[#D6D6C2]/60">
                <span className="text-[#8A8A70]">البيوت المؤكدة والنشطة للجمهور:</span>
                <span className="font-bold text-[#4A4A3A]">{totalHousesApproved} بيت مؤتمرات</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-[#D6D6C2]/60">
                <span className="text-[#8A8A70]">إجمالي الزوار المسكنين تلقائياً بالمنصة:</span>
                <span className="font-bold text-[#5A5A40]">{allocationsCount} فرد</span>
              </div>
              <div className="flex justify-between items-center py-1.5">
                <span className="text-[#8A8A70]">الطلبات قيد المراجعة حاليًا:</span>
                <span className="font-bold text-amber-700">{pendingHouses.length} بيت معلق</span>
              </div>
            </div>
          </div>

          <div className="bg-[#5A5A40] text-white rounded-2xl p-3 flex gap-2.5 items-start text-xs leading-relaxed">
            <Shield className="w-5 h-5 text-amber-200 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-amber-200 block">رقابة المحتوى والبيوت القبطية:</span>
              <span className="text-[11px] text-white/80">يقتصر دور الإدارة ومسؤول الخدمة على التحقق من هوية ملاك البيوت وضمان مطابقة البيوت للشروط الروحية واللياقة الكاملة للخدمة المسيحية لضمان سلامة خلوات الكنائس والأسر.</span>
            </div>
          </div>
        </div>
      )}

      {/* Payments Verification Tab */}
      {activeTab === 'payments' && (
        <div className="space-y-4 text-right">
          <div className="flex items-center justify-between border-b border-[#D6D6C2] pb-2">
            <h3 className="text-xs font-bold text-[#4A4A3A]">قائمة الحوالات والدفعيات لإثباتات الحجز:</h3>
            <div className="text-[10px] text-[#8A8A70]">
              بانتظار التحقق: <strong className="text-amber-800">{payments.filter(p => p.paymentStatus === 'pending').length}</strong> / إجمالي المعاملات بالمنصة: {payments.length}
            </div>
          </div>

          {payments.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 border border-[#D6D6C2] text-center space-y-2">
              <Clock className="w-8 h-8 text-[#BCBC9D] mx-auto animate-pulse" />
              <p className="text-sm font-bold text-[#4A4A3A]">لا توجد أي سحوبات أو إثباتات سداد بعد</p>
              <p className="text-[11px] text-[#8A8A70]">سيقوم المستخدمون برفع إيصالات الدفع هنا فور قيامهم بالتحويل البنكي أو InstaPay.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {[...payments].reverse().map((pay) => {
                const b = bookings.find((bk) => bk.id === pay.bookingId);
                const isPending = pay.paymentStatus === 'pending';

                return (
                  <div
                    id={`admin-payment-card-${pay.id}`}
                    key={pay.id}
                    className={`bg-white rounded-3xl border shadow-sm overflow-hidden text-right transition-all ${
                      isPending ? 'border-amber-300 ring-1 ring-amber-100' : 'border-[#D6D6C2]'
                    }`}
                  >
                    {/* Header info */}
                    <div className="p-3.5 bg-slate-50 border-b border-[#D6D6C2]/60 flex flex-wrap items-center justify-between gap-2">
                      <div className="space-y-0.5">
                        <span className="text-[9px] text-[#8A8A70] font-bold">معرف الدفع: #{pay.id.toUpperCase()}</span>
                        <h4 className="text-xs font-extrabold text-[#4A4A3A]">{pay.userName}</h4>
                        {b && <p className="text-[10px] text-[#8A8A70]">لحجز بيت: <strong>{b.houseName}</strong> (حساب #{b.id.toUpperCase()})</p>}
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Status badges */}
                        {pay.paymentStatus === 'approved' && (
                          <span className="text-[9px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-full">
                            مقبول ومعتمد ✅
                          </span>
                        )}
                        {pay.paymentStatus === 'rejected' && (
                          <span className="text-[9px] font-bold bg-rose-50 text-rose-800 border border-rose-200 px-2.5 py-1 rounded-full">
                            مرفوض ومرفوع للمراجعة ❌
                          </span>
                        )}
                        {pay.paymentStatus === 'pending' && (
                          <span className="text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-full animate-pulse">
                            قيد المراجعة والتحقق ⏳
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Details content */}
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        {/* Amount */}
                        <div className="flex items-center justify-between py-1 border-b border-dashed border-[#E7E5DB]">
                          <span className="text-[10px] text-[#867E65] font-bold">المبلغ المحول:</span>
                          <span className="text-sm font-black text-emerald-800">{pay.amount.toLocaleString()} ج.م</span>
                        </div>

                        {/* Method with custom local Egyptian descriptors */}
                        <div className="flex items-center justify-between py-1 border-b border-dashed border-[#E7E5DB]">
                          <span className="text-[10px] text-[#867E65] font-bold">وسيلة الدفع المستخدمة:</span>
                          <span className="text-xs font-extrabold text-[#464E3D] flex items-center gap-1">
                            {pay.paymentMethod === 'instapay' && (
                              <>
                                <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                                <span>إنستا باي (InstaPay)</span>
                              </>
                            )}
                            {pay.paymentMethod === 'vodafone' && (
                              <>
                                <Smartphone className="w-3.5 h-3.5 text-rose-600" />
                                <span>فودافون كاش محفظة ذكية</span>
                              </>
                            )}
                            {pay.paymentMethod === 'bank' && (
                              <>
                                <Building className="w-3.5 h-3.5 text-indigo-600" />
                                <span>تحويل بنكي تقليدي</span>
                              </>
                            )}
                            {pay.paymentMethod === 'cash' && (
                              <>
                                <Coins className="w-3.5 h-3.5 text-amber-600" />
                                <span>نقدي بالبيت (مستلم ورقي)</span>
                              </>
                            )}
                            {pay.paymentMethod === 'online' && (
                              <>
                                <CreditCard className="w-3.5 h-3.5 text-teal-600" />
                                <span>بطاقة ائتمان أونلاين</span>
                              </>
                            )}
                          </span>
                        </div>

                        {/* Render customized transaction parameters based on type */}
                        <div className="bg-[#FAF8F5] p-3 rounded-2xl border border-[#E7E5DB] text-[11px] space-y-1 text-[#2D2D24]">
                          <div className="font-extrabold text-[#464E3D] text-[10px] mb-1">بيانات وتفاصيل المعاملة المصرحة:</div>
                          
                          {pay.paymentMethod === 'instapay' && pay.details && (
                            <>
                              <div>اسم الحساب / الـ IPA: <strong className="font-mono">{pay.details.senderNumberOrAddress || 'غير محدد'}</strong></div>
                              <div>الرقم المرجعي (Ref ID): <strong className="font-mono">{pay.transactionReference || 'لا يوجد'}</strong></div>
                            </>
                          )}
                          {pay.paymentMethod === 'vodafone' && pay.details && (
                            <>
                              <div>رقم المحفظة المحول منها: <strong className="font-mono">{pay.details.senderNumberOrAddress || 'غير محدد'}</strong></div>
                              <div>معرف المعاملة (TxID): <strong className="font-mono">{pay.transactionReference || 'لا يوجد'}</strong></div>
                            </>
                          )}
                          {pay.paymentMethod === 'bank' && pay.details && (
                            <>
                              <div>اسم البنك المرسل: <strong>{pay.details.bankName || 'غير محدد'}</strong></div>
                              <div>رقم الحوالة البنكية: <strong className="font-mono">{pay.transactionReference || 'لا يوجد'}</strong></div>
                            </>
                          )}
                          {pay.paymentMethod === 'cash' && pay.details && (
                            <>
                              <div>المستلم بالبيت: <strong>{pay.details.receiverName || 'غير محدد'}</strong></div>
                              <div>رقم الإيصال الورقي: <strong className="font-mono">{pay.details.receiptNumber || 'لا يوجد'}</strong></div>
                            </>
                          )}
                          {pay.paymentMethod === 'online' && (
                            <>
                              <div>الاسم على البطاقة: <strong>{pay.details?.receiverName || 'Mina George'}</strong></div>
                              <div>رقم البطاقة (مقنع): <strong className="font-mono">**** **** **** 9012</strong></div>
                            </>
                          )}
                          <div className="text-[10px] text-[#867E65] pt-1">تاريخ تقديم الإيصال: {pay.paymentDate}</div>
                        </div>

                        {/* Admin Notes form */}
                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold text-[#867E65]">ملاحظات مراجعة الإدارة والرد على الحجز:</label>
                          <input
                            id={`admin-payment-notes-input-${pay.id}`}
                            type="text"
                            placeholder="اكتب ردك هنا (مثال: تم مطابقة إيصال فودافون كاش مع المحفظة)"
                            value={notesInputs[pay.id] || pay.adminNotes || ''}
                            onChange={(e) => setNotesInputs({ ...notesInputs, [pay.id]: e.target.value })}
                            className="w-full bg-[#FAF8F5] border border-[#E7E5DB] rounded-xl text-xs px-3 py-2 text-[#2D2D24] focus:outline-none focus:border-[#464E3D]"
                          />
                        </div>

                        {/* Actions buttons */}
                        {isPending && (
                          <div className="flex gap-2 pt-2">
                            <button
                              id={`admin-payment-reject-btn-${pay.id}`}
                              type="button"
                              onClick={() => {
                                if (onVerifyPayment) {
                                  onVerifyPayment(pay.id, 'rejected', notesInputs[pay.id]);
                                  alert('تم رفض الإيصال وتنبيه المستخدم لتعديل التفاصيل.');
                                }
                              }}
                              className="flex-1 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-800 text-xs font-bold py-2 px-3 rounded-xl transition-colors cursor-pointer text-center"
                            >
                              رفض وإعادة الحجز لـ "غير مدفوع" ✕
                            </button>
                            <button
                              id={`admin-payment-approve-btn-${pay.id}`}
                              type="button"
                              onClick={() => {
                                if (onVerifyPayment) {
                                  onVerifyPayment(pay.id, 'approved', notesInputs[pay.id]);
                                  alert('تمت الموافقة على الدفعة وبدء تأكيد الغرف!');
                                }
                              }}
                              className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-extrabold py-2 px-3 rounded-xl transition-all cursor-pointer text-center shadow-sm"
                            >
                              اعتماد الدفعة والموافقة تلقائياً ✓
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Right side: Proof Image display */}
                      <div className="flex flex-col items-center justify-center p-3 bg-[#FAF8F5] border border-[#E7E5DB] rounded-2xl relative">
                        <span className="text-[10px] font-bold text-[#867E65] mb-2">إثبات التحويل المرفق:</span>
                        {pay.proofImage ? (
                          <div className="space-y-2 text-center">
                            <img
                              src={pay.proofImage}
                              alt="إثبات الدفع"
                              referrerPolicy="no-referrer"
                              onClick={() => setSelectedProofImage(pay.proofImage || null)}
                              className="max-h-44 max-w-full rounded-lg border border-[#E7E5DB] object-contain shadow-sm cursor-zoom-in hover:brightness-95 transition-all"
                            />
                            <button
                              id={`admin-zoom-btn-${pay.id}`}
                              type="button"
                              onClick={() => setSelectedProofImage(pay.proofImage || null)}
                              className="text-[9px] text-[#464E3D] hover:underline font-bold"
                            >
                              🔍 اضغط لتكبير الصورة لرؤية التفاصيل بدقة
                            </button>
                          </div>
                        ) : (
                          <div className="text-center p-6 text-[#867E65]">
                            <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-1" />
                            <p className="text-[10px] font-bold">لا يوجد لقطة شاشة مرفقة</p>
                            <p className="text-[9px] mt-0.5">الدفع تم نقداً أو بطرق لا تستدعي صورة، أو تم الدفع المباشر بالكامل.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Bookings Management Tab */}
      {activeTab === 'bookings' && (
        <div className="space-y-4 text-right">
          <div className="flex items-center justify-between border-b border-[#D6D6C2] pb-2">
            <h3 className="text-xs font-bold text-[#4A4A3A]">إدارة حجوزات المنصة والتحصيل:</h3>
            <div className="text-[10px] text-[#8A8A70]">
              المعلقة أو غير مكتملة السداد: <strong className="text-amber-800">{pendingOrUnpaidBookingsCount}</strong> / إجمالي الحجوزات: {bookings.length}
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-2 bg-white p-3 rounded-2xl border border-[#D6D6C2] shadow-sm text-right">
            <input
              type="text"
              placeholder="ابحث باسم المستخدم، اسم البيت، أو رقم الحجز..."
              value={bookingSearch}
              onChange={(e) => setBookingSearch(e.target.value)}
              className="flex-1 bg-[#FAF8F5] border border-[#E7E5DB] rounded-xl text-xs px-3 py-2 text-[#2D2D24] focus:outline-none focus:border-[#464E3D] text-right"
            />
            <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0">
              {(['all', 'pending', 'unpaid', 'completed'] as const).map((filterOpt) => (
                <button
                  key={filterOpt}
                  type="button"
                  onClick={() => setBookingFilter(filterOpt)}
                  className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    bookingFilter === filterOpt
                      ? 'bg-[#5A5A40] text-white shadow-sm'
                      : 'bg-[#FAF8F5] text-[#8A8A70] border border-[#E7E5DB] hover:bg-[#EBEBE0]/50'
                  }`}
                >
                  {filterOpt === 'all' && 'الكل'}
                  {filterOpt === 'pending' && 'بانتظار الموافقة'}
                  {filterOpt === 'unpaid' && 'متبقي مستحقات'}
                  {filterOpt === 'completed' && 'مدفوع بالكامل'}
                </button>
              ))}
            </div>
          </div>

          {/* Bookings list */}
          {filteredBookings.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 border border-[#D6D6C2] text-center space-y-2">
              <Clock className="w-8 h-8 text-[#BCBC9D] mx-auto animate-pulse" />
              <p className="text-sm font-bold text-[#4A4A3A]">لا توجد حجوزات مطابقة للبحث أو التصفية</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredBookings.map((booking) => {
                const bPayments = payments.filter((p) => p.bookingId === booking.id && p.paymentStatus === 'approved');
                const totalPaid = bPayments.reduce((sum, p) => sum + p.amount, 0);
                const remaining = booking.totalPrice - totalPaid;

                const msgText = `سلام ونعمة يا أستاذ/أستاذة ${booking.userName}، نود تذكيركم بحجزكم في بيت "${booking.houseName}" المقرّر بدئه يوم ${booking.checkIn} (عدد ${booking.guestsCount} أفراد).
إجمالي تكلفة الحجز: ${booking.totalPrice.toLocaleString('ar-EG')} ج.م.
المسدد حتى الآن: ${totalPaid.toLocaleString('ar-EG')} ج.م.
المتبقي المستحق: ${remaining.toLocaleString('ar-EG')} ج.م.

يرجى التكرم بسداد المبلغ المتبقي وإكمال توزيع الغرف وبيانات المرافقين بالمنصة لتأكيد حجز الخلوة بشكل نهائي. دمتم في رعاية المسيح.
- إدارة منصة خلوات الكنائس`;

                const waLink = getWhatsAppLink(booking.userPhone, msgText);

                return (
                  <div
                    key={booking.id}
                    className={`bg-white rounded-3xl border shadow-sm overflow-hidden text-right transition-all ${
                      booking.status === 'pending' || remaining > 0 ? 'border-amber-200 ring-1 ring-amber-50' : 'border-[#D6D6C2]'
                    }`}
                  >
                    <div className="p-3.5 bg-slate-50 border-b border-[#D6D6C2]/60 flex flex-wrap items-center justify-between gap-2">
                      <div className="space-y-0.5">
                        <span className="text-[9px] text-[#8A8A70] font-bold">رقم الحجز: #{booking.id.toUpperCase()}</span>
                        <h4 className="text-xs font-extrabold text-[#4A4A3A]">{booking.userName}</h4>
                        <p className="text-[10px] text-[#8A8A70]">الهاتف: <strong className="font-mono text-[11px] text-[#4A4A3A]">{booking.userPhone}</strong></p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {booking.status === 'pending' && (
                          <span className="text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-full animate-pulse">
                            قيد الموافقة ⏳
                          </span>
                        )}
                        {booking.status === 'approved' && (
                          <span className="text-[9px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-full">
                            مقبول ومعتمد ✓
                          </span>
                        )}
                        {booking.status === 'rejected' && (
                          <span className="text-[9px] font-bold bg-rose-50 text-rose-800 border border-rose-200 px-2.5 py-1 rounded-full">
                            مرفوض ✕
                          </span>
                        )}

                        {remaining > 0 ? (
                          <span className="text-[9px] font-bold bg-rose-50 text-rose-800 border border-rose-200 px-2.5 py-1 rounded-full">
                            متبقي: {remaining.toLocaleString('ar-EG')} ج.م ⚠️
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-full">
                            مدفوع بالكامل ✅
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-3 text-right">
                        <div className="space-y-1">
                          <div className="text-[10px] text-[#8A8A70] font-bold">بيت الخلوة:</div>
                          <div className="text-xs font-black text-[#4A4A3A]">{booking.houseName}</div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-[10px] text-[#8A8A70] font-bold">تاريخ الدخول والمدة:</div>
                          <div className="text-xs font-black text-[#4A4A3A] flex items-center gap-1 justify-end">
                            <Calendar className="w-3.5 h-3.5 text-[#8A8A70]" />
                            <span>{booking.checkIn} إلى {booking.checkOut}</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-[#FAF8F5] p-3 rounded-2xl border border-[#E7E5DB] text-[11px] grid grid-cols-3 gap-2 text-center text-[#4A4A3A] font-bold">
                        <div>
                          <div className="text-[9px] text-[#8A8A70] mb-0.5">القيمة الإجمالية</div>
                          <div className="text-emerald-800">{booking.totalPrice.toLocaleString('ar-EG')} ج.م</div>
                        </div>
                        <div>
                          <div className="text-[9px] text-[#8A8A70] mb-0.5">المسدد المقرّ</div>
                          <div className="text-blue-800">{totalPaid.toLocaleString('ar-EG')} ج.م</div>
                        </div>
                        <div>
                          <div className="text-[9px] text-[#8A8A70] mb-0.5">المتبقي المستحق</div>
                          <div className={`text-rose-800 ${remaining > 0 ? 'underline' : ''}`}>{remaining.toLocaleString('ar-EG')} ج.م</div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <a
                          href={waLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-extrabold py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm text-center"
                        >
                          <MessageCircle className="w-4 h-4 text-white shrink-0" />
                          <span>إرسال تذكير عبر واتساب 💬</span>
                        </a>
                        {booking.status !== 'rejected' && booking.status !== 'completed' && (
                          <button
                            id={`admin-cancel-booking-${booking.id}`}
                            onClick={() => { if (confirm(`إلغاء حجز "${booking.userName}" في "${booking.houseName}" نهائياً؟`)) onCancelBooking && onCancelBooking(booking.id); }}
                            className="shrink-0 flex items-center gap-1 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-800 text-xs font-bold py-2 px-3 rounded-xl transition-all cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>إلغاء الحجز</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Admin Proof image Lightbox Modal */}
      {selectedProofImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedProofImage(null)} />
          <div className="bg-[#F3F0E8] border border-[#C5BCA0] max-w-xl w-full rounded-3xl overflow-hidden relative z-10 p-5 text-right">
            <div className="flex items-center justify-between pb-2 border-b border-[#E7E5DB] mb-4">
              <h4 className="text-xs font-bold text-[#2D2D24]">تكبير لقطة شاشة إثبات الدفع المعتمدة:</h4>
              <button
                id="lightbox-close-btn"
                onClick={() => setSelectedProofImage(null)}
                className="bg-white hover:bg-[#FAF8F5] border border-[#E7E5DB] text-[#2D2D24] text-xs font-bold px-3 py-1.5 rounded-xl cursor-pointer"
              >
                إغلاق ✕
              </button>
            </div>
            <div className="flex justify-center bg-white p-3 rounded-2xl border border-[#E7E5DB]">
              <img
                src={selectedProofImage}
                alt="إثبات الدفع مكبر"
                referrerPolicy="no-referrer"
                className="max-h-[70vh] max-w-full object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
