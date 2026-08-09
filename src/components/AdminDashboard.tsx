import React, { useState, useEffect } from 'react';
import { arabicNumber, arabicPlural, arabicDate, arabicDateTime, arabicDateRange, arabicBadge, arabicDecimal, ROLE_LABELS, GUEST_FORMS, REVIEW_FORMS, HOUSE_FORMS, MEMBER_FORMS, POINT_FORMS, BOOKING_FORMS, USER_FORMS, PAYMENT_FORMS } from '../lib/arabic';
import { byAgeBand, byGovernorate, coverage, medianAge } from '../lib/demographics';
import { topHousesByBookings } from '../lib/topHouses';
import { summarizeFinances, accountBalances, refundsDue } from '../lib/adminFinance';
import { commissionTotal, ownerShareOf, rateOf, unclaimedOwedBookings } from '../lib/paymentLedger';
import { findFinanceExceptions } from '../lib/adminExceptions';
import { pendingRenewals, emptyBedNightsAhead, returnCohorts } from '../lib/seasonPlanning';
import { loadHouseImages, saveHouseImages, loadHouseViewCounts } from '../lib/db';
import { inlineImageStats, migrateImages } from '../lib/migrateImagesToStorage';
// Arabic agreement keys on n % 100: 1 = one, 2 = dual, 3-10 = few, 11-99 back
// to the singular. The counted nouns live in lib/arabic alongside the rule
// itself, so the owner screens and this one cannot drift into two different
// spellings of the same plural.
import { RetreatHouse, User, Booking, Payment, Review, PlatformSettings, DEFAULT_PLATFORM_SETTINGS, AuditLogEntry, Payout, OwnerPaymentMethod, PromoBanner, PromoBannerLink, PromoLinkPlatform } from '../types';

// Payment-method type options for the platform collection accounts editor.
const PLATFORM_PM_TYPES: { value: OwnerPaymentMethod['type']; label: string }[] = [
  { value: 'instapay', label: 'إنستاباي' },
  { value: 'vodafone_cash', label: 'فودافون كاش' },
  { value: 'etisalat_cash', label: 'اتصالات كاش' },
  { value: 'orange_cash', label: 'أورنج كاش' },
  { value: 'we_cash', label: 'وي كاش' },
  { value: 'bank_transfer', label: 'تحويل بنكي' },
];
import { Check, X, Shield, Users, BarChart3, Building, Clock, Star, TrendingUp, DollarSign, CreditCard, Smartphone, CheckSquare, AlertTriangle, CheckCircle2, Coins, MessageCircle, Calendar, IdCard, Megaphone, Ban, Power, Trash2, Home, Eye, Pencil, Wallet, Search, Download, MessageSquareDashed, ChevronUp, ChevronDown, Wand2, Copy, Settings, ChevronLeft, ChevronRight, XCircle, MoreHorizontal, MapPin, CalendarDays, Image as ImageIcon, Loader2 } from 'lucide-react';
import { timeAgo } from '../lib/timeAgo';
import PhotoPickerButtons from './PhotoPickerButtons';
import { SummerOfferCarousel, CountdownOfferBanner, PROMO_PLATFORMS } from './PromoBanners';
import BannerStudio from './banner/BannerStudio';
import BannerCanvas from './banner/BannerCanvas';
import BannerAnalytics from './banner/BannerAnalytics';
import { bannerStateLabel } from '../lib/bannerVisibility';
import { GOVERNORATES } from '../mockData';
import HouseDetail from './HouseDetail';
import { AMENITIES_LIST } from '../mockData';
import { loadBookingMessages } from '../lib/bookingMessages';
import { BookingMessage } from '../types';

/** One labelled row with a proportional bar — used by the audience panel. */
function DemoBar({ label, count, pct, tint }: { label: string; count: number; pct: number; tint: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold text-[#4A4A3A] truncate">{label}</span>
        <span className="text-[11px] font-bold text-[#8A8A70] shrink-0 tabular-nums">
          {arabicNumber(count)} · {arabicNumber(pct)}٪
        </span>
      </div>
      <div className="h-1.5 w-full bg-[#EBEBE0] rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${tint}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

interface AdminDashboardProps {
  currentUser: User;
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
  /** Set at the OWNER's request — he carries the cost, since the commission is
   *  a percentage of the discounted price. pct is a fraction (0.25 = 25%). */
  onSetHouseDiscount?: (args: { houseId: string; pct: number; startsAt: string | null; endsAt: string | null; note: string | null }) => void;
  onBanUser?: (userId: string, banned: boolean) => void;
  /** Frees the email and anonymises the profile, keeping every record. */
  onReleaseUser?: (userId: string) => Promise<boolean>;
  onCancelBooking?: (bookingId: string) => void;
  onDeleteReview?: (reviewId: string) => void;
  allocationsCount?: number;
  payments?: Payment[];
  // 'pending' puts a decided payment back in the queue. Without it a mis-tap
  // on «اعتماد الدفعة» was permanent: the buttons stopped rendering and there
  // was no other route to the payment from anywhere in the panel.
  onVerifyPayment?: (paymentId: string, status: 'approved' | 'rejected' | 'pending', adminNotes?: string) => void;
  // Support calls land on Pima's own number, so the admin is the one who hears
  // «we need to shift a day» — and had no control for it. The owner's handler
  // already does the capacity check and the room re-allocation.
  onUpdateBookingDetails?: (bookingId: string, fields: { checkIn?: string; checkOut?: string; guestsCount?: number }) => Promise<boolean>;
  onRecordRefund?: (paymentId: string, amount: number, note?: string) => Promise<boolean>;
  onSetPaymentAccount?: (paymentId: string, account: string) => void;
  onSetUserApproval?: (userId: string, status: 'approved' | 'rejected') => void;
  promoBanners?: PromoBanner[];
  onAddPromoBanner?: (b: PromoBanner) => void;
  onUpdatePromoBanner?: (b: PromoBanner) => void;
  onTogglePromoBanner?: (id: string, isActive: boolean) => void;
  onDeletePromoBanner?: (id: string) => void;
  settings?: PlatformSettings;
  onUpdateSettings?: (s: PlatformSettings) => void;
  auditLog?: AuditLogEntry[];
  onLoadProofImage?: (paymentId: string) => Promise<string | null>;
  // Real curation powers, not just approve/reject — reuses the same
  // generic handlers OwnerDashboard already writes through.
  onUpdateHouse?: (house: RetreatHouse) => void;
  onDeleteHouse?: (houseId: string) => void;
  payouts?: Payout[];
  onUpdatePayoutStatus?: (id: string, status: Payout['status']) => void;
  // Settle one booking's owner share (bookingIds length 1) or several at once.
  onSettleBookings?: (args: { houseId: string; ownerId: string; amount: number; bookingIds: string[]; note?: string; transactionReference?: string; paidFromAccount?: string }) => void;
}

// Module scope on purpose: declared inside a render body, this would be a new
// component type on every render and React would remount the card instead of
// updating it.
function KpiCard({ title, value, delta, suffix }: {
  title: string;
  /** null = last week was zero, so there is no percentage to state. */
  delta: string | null;
  value: number | string;
  suffix?: string;
}) {
  const isUp = !!delta && delta.startsWith('+') && !delta.startsWith('+٠');
  const isDown = !!delta && delta.startsWith('−');
  return (
    <div className="bg-white rounded-3xl border border-[#D6D6C2] p-4 shadow-sm space-y-1">
      <div className="text-[12px] text-[#8A8A70] font-bold">{title}</div>
      <div className="text-xl font-black text-[#4A4A3A]">
        {typeof value === 'number' ? value.toLocaleString('ar-EG') : value}
        {/* An explicit space: the currency was rendering flush against the
            number (٠ج.م) because a margin utility alone does not separate
            two inline runs reliably in RTL. */}
        {suffix && <span className="text-[12px] text-[#8A8A70] font-bold">{' '}{suffix}</span>}
      </div>
      <div className={`text-[12px] font-extrabold ${isUp ? 'text-emerald-700' : isDown ? 'text-rose-700' : 'text-[#8A8A70]'}`}>
        {delta === null
          ? <span className="text-[#8A8A70] font-medium">لا يوجد أسبوع سابق للمقارنة</span>
          : <>{isUp ? '↗' : isDown ? '↘' : '→'} {delta}{' '}
              <span className="text-[#8A8A70] font-medium">عن الأسبوع السابق</span></>}
      </div>
    </div>
  );
}

export default function AdminDashboard({
  currentUser,
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
  onSetHouseDiscount,
  onBanUser, onReleaseUser,
  onCancelBooking,
  onDeleteReview,
  allocationsCount = 0,
  payments = [],
  onVerifyPayment,
  onUpdateBookingDetails,
  onRecordRefund,
  onSetPaymentAccount,
  onSetUserApproval,
  promoBanners = [],
  onAddPromoBanner,
  onUpdatePromoBanner,
  onTogglePromoBanner,
  onDeletePromoBanner,
  settings = DEFAULT_PLATFORM_SETTINGS,
  onUpdateSettings,
  auditLog = [],
  onLoadProofImage,
  onUpdateHouse,
  onDeleteHouse,
  payouts = [],
  onUpdatePayoutStatus,
  onSettleBookings,
}: AdminDashboardProps) {
  // Tabs within Admin — "growth" is default: the admin's morning check
  // (what's happening + what needs attention). Older tabs still exist.
  const [activeTab, setActiveTab] = useState<'growth' | 'moderation' | 'accounts' | 'houses' | 'reviews' | 'announcements' | 'users' | 'finance' | 'audience' | 'season' | 'exceptions' | 'payments' | 'payouts' | 'bookings' | 'settings' | 'audit' | 'messages'>('growth');
  // Draft copy of settings for the settings form
  const [settingsDraft, setSettingsDraft] = useState(settings);
  const [settingsSaved, setSettingsSaved] = useState(false);
  React.useEffect(() => { setSettingsDraft(settings); }, [settings]);
  const [notesInputs, setNotesInputs] = useState<Record<string, string>>({});
  const [selectedProofImage, setSelectedProofImage] = useState<string | null>(null);

  // Full house preview (reuses the guest-facing HouseDetail in read-only
  // mode) — replaces the old 3-stat summary card so admin can actually
  // see photos/services/halls/rooms before approving. Also a light quick-
  // edit form for the fields most likely to need a correction, using the
  // same generic onUpdateHouse the owner dashboard already writes through
  // (admin already has free UPDATE rights on houses at the DB layer).
  const [previewHouseId, setPreviewHouseId] = useState<string | null>(null);
  const [editingHouseId, setEditingHouseId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<RetreatHouse>>({});
  const previewHouse = houses.find((h) => h.id === previewHouseId) ?? null;

  const startEdit = (house: RetreatHouse) => {
    setEditingHouseId(house.id);
    // Seeded, not left blank: an unseeded field shows empty on a house that
    // has one, and an admin who reads that as «not set» and types a value has
    // been misled by the form rather than by the data.
    setEditDraft({
      name: house.name, description: house.description,
      pricePerNightPerPerson: house.pricePerNightPerPerson,
      dayUsePricePerPerson: house.dayUsePricePerPerson,
      services: house.services,
    });
  };
  const saveEdit = (house: RetreatHouse) => {
    onUpdateHouse?.({ ...house, ...editDraft });
    setEditingHouseId(null);
  };

  // Proof-of-payment screenshots are excluded from the general payments
  // load (they're the single biggest per-row payload, often hundreds of KB
  // of base64) and fetched on demand instead, only for payments actually
  // visible once the admin opens this tab. null = fetched and empty;
  // undefined/missing key = not fetched yet.
  const [proofImages, setProofImages] = useState<Record<string, string | null>>({});
  useEffect(() => {
    if (activeTab !== 'payments' || !onLoadProofImage) return;
    const missing = payments.filter((p) => !(p.id in proofImages));
    if (missing.length === 0) return;
    Promise.all(missing.map((p) => onLoadProofImage(p.id).then((img) => [p.id, img] as const))).then((results) => {
      setProofImages((prev) => {
        const next = { ...prev };
        results.forEach(([id, img]) => { next[id] = img; });
        return next;
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, payments.length]);

  // Financial dashboard period filter (mirrors the owner dashboard's)
  const [finPeriod, setFinPeriod] = useState<'today' | '7d' | '30d' | 'month' | 'all' | 'custom'>('all');
  const [finFrom, setFinFrom] = useState('');
  const [finTo, setFinTo] = useState('');

  // Platform announcement form state

  // Promo banner form state (migration 076)
  const [pbPlacement, setPbPlacement] = useState<'carousel' | 'countdown'>('carousel');
  const [pbBadge, setPbBadge] = useState('');
  const [pbTitle, setPbTitle] = useState('');
  const [pbSubtitle, setPbSubtitle] = useState('');
  const [pbCta, setPbCta] = useState('');
  const [pbImage, setPbImage] = useState('');
  const [pbEndsAt, setPbEndsAt] = useState('');
  const [pbLinkUrl, setPbLinkUrl] = useState('');
  const [pbLinks, setPbLinks] = useState<PromoBannerLink[]>([]);
  const [pbHouseId, setPbHouseId] = useState('');
  const [pbRoles, setPbRoles] = useState<User['role'][]>([]);
  const [pbBooked, setPbBooked] = useState<'any' | 'yes' | 'no'>('any');
  const [pbGovs, setPbGovs] = useState<string[]>([]);
  const [pbExperiment, setPbExperiment] = useState('');
  const [pbVariant, setPbVariant] = useState('');
  const [pbStatus, setPbStatus] = useState<'draft' | 'published' | 'scheduled'>('published');
  const [pbStartsAt, setPbStartsAt] = useState('');
  // Non-null while editing an existing banner — the same form doubles as the
  // editor, so "add" and "save changes" share one set of fields.
  const [pbEditingId, setPbEditingId] = useState<string | null>(null);
  // Banner whose visual layout is open in the designer.
  const [pbDesigningId, setPbDesigningId] = useState<string | null>(null);
  // Sub-view inside the الإعلانات tab — list / create-or-edit form / analytics.
  const [pbView, setPbView] = useState<'list' | 'form' | 'stats'>('list');

  const pbResetForm = () => {
    setPbEditingId(null);
    setPbBadge(''); setPbTitle(''); setPbSubtitle(''); setPbCta(''); setPbImage(''); setPbEndsAt('');
    setPbLinkUrl(''); setPbLinks([]);
    setPbHouseId(''); setPbStatus('published'); setPbStartsAt('');
    setPbRoles([]); setPbBooked('any'); setPbGovs([]); setPbExperiment(''); setPbVariant('');
  };

  const pbStartEdit = (b: PromoBanner) => {
    setPbEditingId(b.id);
    setPbPlacement(b.placement);
    setPbBadge(b.badge ?? '');
    setPbTitle(b.title ?? '');
    setPbSubtitle(b.subtitle ?? '');
    setPbCta(b.ctaText ?? '');
    setPbImage(b.imageUrl ?? '');
    // <input type="datetime-local"> wants a local "YYYY-MM-DDTHH:mm" value.
    setPbEndsAt(b.endsAt ? new Date(b.endsAt).toISOString().slice(0, 16) : '');
    setPbLinkUrl(b.linkUrl ?? '');
    setPbLinks(b.links ? b.links.map((l) => ({ ...l })) : []);
    setPbHouseId(b.linkedHouseId ?? '');
    setPbStatus(b.status ?? 'published');
    setPbStartsAt(b.startsAt ? new Date(b.startsAt).toISOString().slice(0, 16) : '');
    setPbRoles(b.audience?.roles ?? []);
    setPbBooked(b.audience?.booked ?? 'any');
    setPbGovs(b.audience?.governorates ?? []);
    setPbExperiment(b.experiment ?? '');
    setPbVariant(b.variant ?? '');
  };

  // Swap a banner's sort with its neighbour inside the same placement group.
  const pbMove = (b: PromoBanner, dir: -1 | 1) => {
    const group = promoBanners
      .filter((x) => x.placement === b.placement)
      .slice()
      .sort((x, y) => x.sort - y.sort || x.createdAt.localeCompare(y.createdAt));
    const i = group.findIndex((x) => x.id === b.id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= group.length) return;
    // Rewrite both rows with normalised indexes so equal/duplicate sort
    // values (possible in older rows) can't make the swap a no-op.
    onUpdatePromoBanner?.({ ...group[i], sort: j });
    onUpdatePromoBanner?.({ ...group[j], sort: i });
  };

  const pendingAccounts = users.filter(u => (u.role === 'servant' || u.role === 'owner') && u.approvalStatus === 'pending');

  // Bookings search & filter states
  const [bookingSearch, setBookingSearch] = useState('');
  const [bookingFilter, setBookingFilter] = useState<'all' | 'soon' | 'pending' | 'unpaid' | 'temporary' | 'completed'>('all');
  const [editBookingId, setEditBookingId] = useState<string | null>(null);
  const [bookingEdit, setBookingEdit] = useState({ checkIn: '', checkOut: '', guestsCount: '' });
  const [editSaving, setEditSaving] = useState(false);

  // Users search & filter
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'individual' | 'servant' | 'owner' | 'admin' | 'banned'>('all');

  // User detail view
  const [detailUserId, setDetailUserId] = useState<string | null>(null);
  const [releasingUserId, setReleasingUserId] = useState<string | null>(null);
  // One-off maintenance: moving pre-Storage photos out of the database.
  const [imgMigrationBusy, setImgMigrationBusy] = useState(false);
  const [imgMigrationLog, setImgMigrationLog] = useState<string[]>([]);

  // Audit search & filter. The log is the only forensic tool in the panel and
  // it grew to hundreds of rows with no way to ask it anything — "who released
  // that transfer" meant scrolling.
  const [auditSearch, setAuditSearch] = useState('');
  const [auditKind, setAuditKind] = useState<'all' | 'money' | 'content' | 'people'>('all');

  // Chat viewer — admin reads booking messages for dispute resolution
  const [chatBookingId, setChatBookingId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<BookingMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  // Nav section collapse (grouped navigation)
  const [navSection, setNavSection] = useState<'home' | 'content' | 'people' | 'money' | 'system'>('home');

  const getWhatsAppLink = (phone: string, text: string) => {
    let cleanPhone = phone.replace(/\D/g, ''); // Remove all non-digits
    if (cleanPhone.startsWith('01')) {
      cleanPhone = '2' + cleanPhone; // e.g., 010... -> 2010...
    } else if (cleanPhone.startsWith('1')) {
      cleanPhone = '20' + cleanPhone; // e.g., 10... -> 2010...
    }
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
  };

  // A booking that is cancelled or rejected is not work. Cancelling only flips
  // the status — totalPrice stays, nothing is ever paid against it, so
  // `remaining > 0` held forever and every dead booking sat in the follow-up
  // count permanently. The badge climbed on its own until the admin stopped
  // believing it.
  const isLiveBooking = (b: Booking) => b.status !== 'cancelled' && b.status !== 'rejected';
  const pendingOrUnpaidBookingsCount = bookings.filter((b) => {
    if (!isLiveBooking(b)) return false;
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
      return isLiveBooking(b) && remaining > 0;
    }
    if (bookingFilter === 'completed') {
      return b.status === 'completed' || (b.status === 'approved' && remaining <= 0);
    }
    // The Tuesday-morning question: who arrives soon and still owes money. It
    // could not be asked before — the list had no date-aware filter and no
    // sort, and arrived newest-typed-first from the server.
    if (bookingFilter === 'soon') {
      if (!isLiveBooking(b)) return false;
      const days = (new Date(b.checkIn).getTime() - Date.now()) / 86400000;
      return days >= -1 && days <= 14;
    }
    // A hold blocks real beds and nothing anywhere expires it, so it needs to
    // be findable.
    if (bookingFilter === 'temporary') {
      return b.source === 'temporary' && isLiveBooking(b);
    }
    return true; // 'all'
  });

  // Soonest arrival first for the date-driven views; everything else keeps the
  // server's newest-first order.
  const sortedBookings = (bookingFilter === 'soon' || bookingFilter === 'temporary')
    ? [...filteredBookings].sort((a, b) => new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime())
    : filteredBookings;

  // Holds older than this have almost certainly been forgotten. Two weeks is
  // long enough for a group to decide and short enough that the beds come back
  // in the same season.
  const STALE_HOLD_DAYS = 14;
  const staleHolds = bookings.filter((b) => {
    if (b.source !== 'temporary' || !isLiveBooking(b)) return false;
    const created = b.createdAt ? new Date(b.createdAt).getTime() : NaN;
    if (Number.isNaN(created)) return false;
    return (Date.now() - created) / 86400000 > STALE_HOLD_DAYS;
  });


  // Filter pending houses
  const pendingHouses = houses.filter((h) => h.status === 'pending');
  // Already-approved houses with an owner-submitted edit awaiting review
  const pendingHouseEdits = houses.filter((h) => h.pendingEdit);

  // Only the fields that actually changed vs. the live house, for a clean diff
  // view. A field missing from this list is a field an admin approves without
  // ever seeing it — the edit still applies in full, so the omission reads to
  // them as «لا توجد تغييرات» on a change that is really there.
  const HOUSE_EDIT_DIFF_FIELDS: {
    key: keyof RetreatHouse;
    label: string;
    suffix?: string;
    /** Override equality where two different values mean the same thing. */
    same?: (a: unknown, b: unknown) => boolean;
    /** Override rendering where the raw number is not the meaning. */
    format?: (v: unknown) => string;
  }[] = [
    { key: 'name', label: 'الاسم' },
    { key: 'pricePerNightPerPerson', label: 'سعر الفرد/ليلة', suffix: ' ج.م' },
    {
      key: 'dayUsePricePerPerson',
      label: 'سعر اليوم بدون مبيت',
      // Undefined and 0 both mean «the house does not sell a day», and the
      // owner form sends 0 to withdraw one — without this, every edit to any
      // other field would report a day-price change that never happened.
      same: (a, b) => (Number(a) || 0) === (Number(b) || 0),
      format: (v) => (Number(v) ? `${Number(v)} ج.م` : 'غير متاح'),
    },
    { key: 'monthlyRent', label: 'الإيجار الشهري', suffix: ' ج.م' },
    { key: 'roomsCount', label: 'عدد الغرف' },
    { key: 'bedsCount', label: 'عدد الأسرة' },
    { key: 'governorate', label: 'المحافظة' },
    { key: 'address', label: 'العنوان' },
    { key: 'nearbyLandmark', label: 'أقرب معلم' },
    { key: 'description', label: 'الوصف' },
    { key: 'roomsDescription', label: 'وصف الغرف' },
  ];
  const getHouseEditDiff = (house: RetreatHouse) => {
    const pending = house.pendingEdit || {};
    const rows = HOUSE_EDIT_DIFF_FIELDS.filter((f) => {
      if (pending[f.key] === undefined) return false;
      const same = f.same ?? ((a: unknown, b: unknown) => a === b);
      return !same(pending[f.key], house[f.key]);
    });
    const arrayFieldsChanged: string[] = [];
    const changed = (a: unknown, b: unknown) => JSON.stringify(a) !== JSON.stringify(b);
    if (pending.services && changed(pending.services, house.services)) arrayFieldsChanged.push('الخدمات والمرافق');
    if (pending.suitability && changed(pending.suitability, house.suitability)) arrayFieldsChanged.push('الفئات المناسبة');
    if (pending.activities && changed(pending.activities, house.activities)) arrayFieldsChanged.push('الأنشطة');
    if (pending.images && changed(pending.images, house.images)) arrayFieldsChanged.push('صور البيت');
    if (pending.conferenceHalls && changed(pending.conferenceHalls, house.conferenceHalls)) arrayFieldsChanged.push('قاعات المؤتمرات (شاملة الأسعار)');
    if (pending.paymentMethods && changed(pending.paymentMethods, house.paymentMethods)) arrayFieldsChanged.push('وسائل استلام الدفع');
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
    // The end date has to cover its whole day. new Date('2026-08-31') is
    // midnight, so a payment timestamped that afternoon fell outside a range
    // whose own label said it was included.
    if (finPeriod === 'custom' && finFrom && finTo) {
      return { start: new Date(`${finFrom}T00:00:00`), end: new Date(`${finTo}T23:59:59.999`) };
    }
    return null; // all
  })();
  const bookingInPeriod = (b: Booking) => {
    if (!finBounds) return true;
    const d = new Date(b.checkIn);
    return d >= finBounds.start && d <= finBounds.end;
  };

  // Bookings whose TRIP falls in the window. Used only for context counts —
  // the money figures below are scoped by when the money moved, which is a
  // different axis and the right one for a cash page.
  const periodBookings = bookings.filter(bookingInPeriod);
  const periodConfirmed = periodBookings.filter((b) => b.status === 'approved' || b.status === 'completed');

  // Pima only holds money if it has somewhere to receive it. With no
  // collection accounts configured the guest pays the owner directly and
  // there is nothing to report as held or transferable. The payouts tab gates
  // on exactly this, and the finance page used to ignore it — reporting owner
  // dues on money Pima had never touched.
  const platformCollects = (settings.paymentMethods ?? []).length > 0;

  // Every figure on the finance page, from one tested module.
  //
  // This replaced ~45 lines of inline arithmetic that disagreed with the
  // payout engine next door: it took the commission out of the DEPOSIT
  // instead of out of the booking value, counted payments on cancelled
  // bookings as owner dues, and never subtracted a transfer once it had been
  // made. See src/lib/adminFinance.ts for what each figure means and why.
  // The books' own invariants. Dismissals live in localStorage rather than a
  // table: some rows stay true for weeks by design — a guest who genuinely
  // overpaid is owed a refund and the row is correct until it is paid — and a
  // screen that can never be emptied is a screen nobody opens twice.
  const financeExceptions = React.useMemo(
    () => findFinanceExceptions({ bookings, payments, payouts, houses, commissionRate: settings.commissionRate }),
    [bookings, payments, payouts, houses, settings.commissionRate],
  );
  const [dismissedExceptions, setDismissedExceptions] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('pima_admin_dismissed_exceptions') || '[]')); }
    catch { return new Set(); }
  });
  const dismissException = (id: string) => {
    setDismissedExceptions((prev) => {
      const next = new Set(prev); next.add(id);
      try { localStorage.setItem('pima_admin_dismissed_exceptions', JSON.stringify([...next])); } catch { /* private mode */ }
      return next;
    });
  };
  const openExceptions = financeExceptions.filter((e) => !dismissedExceptions.has(e.id));

  // Guests' money still in Pima's hands, and what is in each collection
  // account. Both were unrepresentable before migration 108.
  const refundQueue = React.useMemo(() => refundsDue({ bookings, payments }), [bookings, payments]);
  const [refundingId, setRefundingId] = useState<string | null>(null);
  const [discountHouseId, setDiscountHouseId] = useState<string | null>(null);
  const [discountDraft, setDiscountDraft] = useState({ pct: '', from: '', to: '', note: '' });

  // The season, which for Pima is the business.
  const renewals = React.useMemo(() => pendingRenewals({ bookings }), [bookings]);
  const cohorts = React.useMemo(() => returnCohorts({ bookings }), [bookings]);
  const occupancy = React.useMemo(
    () => emptyBedNightsAhead({ houses, bookings, weeks: 8 }),
    [houses, bookings],
  );

  const treasury = React.useMemo(() => accountBalances({ payments, payouts, window: finBounds }), [payments, finBounds]);

  const fin = summarizeFinances({
    bookings,
    payments,
    payouts,
    houses,
    users,
    commissionRate: PLATFORM_COMMISSION,
    window: finBounds,
    platformCollects,
  });

  // Load chat messages when admin opens a booking chat
  useEffect(() => {
    if (!chatBookingId) { setChatMessages([]); return; }
    setChatLoading(true);
    loadBookingMessages(chatBookingId).then((msgs) => { setChatMessages(msgs); setChatLoading(false); });
  }, [chatBookingId]);

  // CSV export helper
  const downloadCsv = (filename: string, headers: string[], rows: string[][]) => {
    const bom = '﻿';
    const csv = bom + [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const exportUsers = () => {
    downloadCsv('users.csv',
      ['الاسم', 'الإيميل', 'الهاتف', 'الدور', 'الكنيسة', 'التسجيل'],
      users.map((u) => [u.name, u.email, u.phone, u.role, u.organizationName || '', u.createdAt])
    );
  };
  const exportBookings = () => {
    downloadCsv('bookings.csv',
      ['رقم الحجز', 'الاسم', 'البيت', 'الدخول', 'الخروج', 'الأفراد', 'الإجمالي', 'الحالة', 'المصدر'],
      bookings.map((b) => [b.id, b.userName, b.houseName, b.checkIn, b.checkOut, String(b.guestsCount), String(b.totalPrice), b.status, b.source || 'platform'])
    );
  };
  // The period goes in the filename. A file called financials.csv says nothing
  // about which months it covers, and two of them in a downloads folder are
  // indistinguishable.
  const finPeriodLabel = (): string => {
    if (finPeriod === 'custom' && finFrom && finTo) return `${finFrom}_${finTo}`;
    return finPeriod;
  };
  const exportFinancials = () => {
    downloadCsv(`financials_${finPeriodLabel()}.csv`,
      ['المالك', 'المحصّل', 'عمولة بيما', 'لسه عنده', 'اتحوّل'],
      [
        ...fin.perOwner.map((o) => [o.name, String(o.collected), String(o.commission), String(o.owed), String(o.paid)]),
        // A totals row, so the file reconciles against the screen instead of
        // leaving whoever opens it to re-add the column and wonder.
        ['الإجمالي', String(fin.collectedByPima), String(fin.platformCommission), String(fin.ownersOwed), String(fin.ownersPaid)],
      ]
    );
  };

  // Which family an audit action belongs to. Money is its own group because
  // that is what an audit gets opened for; keeping it a derived predicate
  // rather than a column means a new action type is classified in one place.
  const AUDIT_KINDS: Record<'money' | 'content' | 'people', string[]> = {
    money: ['payment_status_changed', 'payout_status_changed', 'settings_changed'],
    content: ['house_status_changed', 'booking_status_changed'],
    people: ['user_approval_changed', 'user_ban_changed'],
  };
  const AUDIT_ACTION_LABELS: Record<string, string> = {
    booking_status_changed: 'تغيير حالة حجز',
    house_status_changed: 'تغيير حالة بيت',
    user_approval_changed: 'تغيير اعتماد حساب',
    user_ban_changed: 'تغيير حالة حظر',
    payment_status_changed: 'تحقق من دفعة',
    payout_status_changed: 'تحويل لصاحب بيت',
    settings_changed: 'تغيير إعدادات المنصة',
  };

  const filteredAudit = React.useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    return auditLog.filter((e) => {
      if (auditKind !== 'all' && !AUDIT_KINDS[auditKind].includes(e.action)) return false;
      if (!q) return true;
      // Searches what is on screen — the Arabic label and details — as well as
      // the actor. Searching the raw action key too, since an admin reading a
      // migration may well paste one in.
      return [
        AUDIT_ACTION_LABELS[e.action] ?? '', e.action,
        e.details ?? '', e.actorName ?? '', ROLE_LABELS[e.actorRole ?? ''] ?? '',
      ].some((f) => f.toLowerCase().includes(q));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auditLog, auditSearch, auditKind]);

  const exportAudit = () => {
    downloadCsv('audit-log.csv',
      ['الإجراء', 'التفاصيل', 'بواسطة', 'الدور', 'التاريخ'],
      // Exports what is FILTERED, not everything: an export that ignores the
      // filter above it is a different answer from the one on screen.
      filteredAudit.map((e) => [
        AUDIT_ACTION_LABELS[e.action] ?? e.action,
        e.details ?? '',
        e.actorName ?? 'غير معروف',
        ROLE_LABELS[e.actorRole ?? ''] ?? 'غير معروف',
        arabicDateTime(e.createdAt),
      ])
    );
  };

  // Filtered users for the users tab
  const filteredUsers = users.filter((u) => {
    const matchesSearch = !userSearch || u.name.toLowerCase().includes(userSearch.toLowerCase()) || u.email.toLowerCase().includes(userSearch.toLowerCase()) || u.phone.includes(userSearch) || (u.organizationName || '').toLowerCase().includes(userSearch.toLowerCase());
    if (!matchesSearch) return false;
    if (userRoleFilter === 'banned') return !!u.isBanned;
    if (userRoleFilter === 'all') return true;
    return u.role === userRoleFilter;
  });

  // Detail user for user detail view
  const detailUser = detailUserId ? users.find((u) => u.id === detailUserId) : null;
  const detailUserBookings = detailUser ? bookings.filter((b) => b.userId === detailUser.id) : [];
  const detailUserPayments = detailUser ? payments.filter((p) => p.userId === detailUser.id) : [];
  const detailUserReviews = detailUser ? reviews.filter((r) => r.userId === detailUser.id) : [];

  // Review statistics
  const avgRating = reviews.length > 0 ? (reviews.reduce((s, r) => s + (r.overall_rating ?? r.rating), 0) / reviews.length) : 0;
  const starDist = [5, 4, 3, 2, 1].map((star) => ({ star, count: reviews.filter((r) => Math.round(r.overall_rating ?? r.rating) === star).length }));

  const pendingPaymentsCount = payments.filter((p) => p.paymentStatus === 'pending').length;
  const pendingPayoutsCount = payouts.filter((p) => p.status === 'pending').length;
  const pendingHousesCount = pendingHouses.length + pendingHouseEdits.length;

  // Grouped by WHAT the admin is doing, not by which screen was built when.
  // Review queues sit with the thing they review (houses with content, accounts
  // with people) instead of being stranded in "overview".
  const NAV_GROUPS: {
    key: typeof navSection; label: string; icon: React.ElementType;
    tabs: { key: typeof activeTab; label: string; badge?: number; pulse?: boolean }[];
  }[] = [
    // Order is the MIRROR of how it reads on screen. The page is RTL, so the
    // first child renders rightmost — money, content, home, people, system
    // lands as النظام · المستخدمين · الرئيسية · المحتوى · الحجوزات from the
    // left, with الرئيسية dead centre and two items either side of it.
    { key: 'money', label: 'الحجوزات', icon: Coins, tabs: [
      { key: 'bookings', label: 'الحجوزات', badge: pendingOrUnpaidBookingsCount },
      { key: 'payments', label: 'الدفعيات', badge: pendingPaymentsCount },
      { key: 'payouts', label: 'طلبات التحويل', badge: pendingPayoutsCount },
      { key: 'exceptions', label: 'التدقيق', badge: financeExceptions.filter((e) => !dismissedExceptions.has(e.id)).length, pulse: true },
    ]},
    { key: 'content', label: 'المحتوى', icon: Building, tabs: [
      { key: 'houses', label: 'البيوت' },
      { key: 'moderation', label: 'مراجعة البيوت', badge: pendingHousesCount, pulse: true },
      { key: 'announcements', label: 'البانرات' },
      { key: 'reviews', label: 'التقييمات' },
    ]},
    { key: 'home', label: 'الرئيسية', icon: BarChart3, tabs: [
      { key: 'growth', label: 'النمو' },
      // Money and audience were one «التقارير» page. They answer different
      // questions, so splitting them is what makes either one readable.
      { key: 'finance', label: 'الماليات' },
      // «الجمهور», not «المستخدمين» — the bottom bar already has a
      // «المستخدمين» section, and it goes somewhere else entirely (managing
      // accounts, not counting them). Both were on screen at the same time
      // reading identically. The page heading still says «إحصائيات
      // المستخدمين», so the full name is where it explains itself.
      { key: 'audience', label: 'الجمهور' },
      { key: 'season', label: 'الموسم' },
    ]},
    { key: 'people', label: 'المستخدمين', icon: Users, tabs: [
      { key: 'users', label: 'المستخدمين' },
      { key: 'accounts', label: 'مراجعة الحسابات', badge: pendingAccounts.length, pulse: true },
      { key: 'messages', label: 'المحادثات' },
    ]},
    { key: 'system', label: 'النظام', icon: Settings, tabs: [
      { key: 'settings', label: 'الإعدادات' },
      { key: 'audit', label: 'سجل التدقيق' },
    ]},
  ];

  // Everything waiting on the admin, in one list. These used to be scattered
  // across three different sections, so nothing told you what needed doing.
  const actionQueue = [
    { key: 'moderation' as const, section: 'content' as const, label: 'بيوت بانتظار المراجعة', count: pendingHousesCount, Icon: Building },
    { key: 'accounts' as const, section: 'people' as const, label: 'حسابات بانتظار الموافقة', count: pendingAccounts.length, Icon: IdCard },
    { key: 'payments' as const, section: 'money' as const, label: 'دفعات بانتظار التحقق', count: pendingPaymentsCount, Icon: CreditCard },
    { key: 'payouts' as const, section: 'money' as const, label: 'طلبات تحويل معلّقة', count: pendingPayoutsCount, Icon: Wallet },
    { key: 'bookings' as const, section: 'money' as const, label: 'حجوزات محتاجة متابعة', count: pendingOrUnpaidBookingsCount, Icon: Calendar },
    // Nothing expires a hold, so the only thing that will ever clear one is an
    // admin noticing it. That has to start here.
    { key: 'bookings' as const, section: 'money' as const, label: `حجوزات مؤقتة قديمة (+${arabicNumber(STALE_HOLD_DAYS)} يوم)`, count: staleHolds.length, Icon: Clock },
  ].filter((a) => a.count > 0);

  const totalPending = actionQueue.reduce((s, a) => s + a.count, 0);

  // Recomputed only when the user list changes — the period filter above
  // deliberately does not apply: this is who the audience IS, not what
  // they did in a window.
  const demo = React.useMemo(() => ({
    govs: byGovernorate(users),
    ages: byAgeBand(users),
    median: medianAge(users),
    coverage: coverage(users),
  }), [users]);

  // ── Properties management: search, filter, sort, paging ──────────────
  const [houseQuery, setHouseQuery] = useState('');
  const [houseStatusFilter, setHouseStatusFilter] = useState<'all' | 'approved' | 'pending' | 'suspended'>('all');
  const [houseSort, setHouseSort] = useState<'name' | 'rating' | 'bookings'>('name');
  const [housePage, setHousePage] = useState(1);
  const [housePerPage, setHousePerPage] = useState(10);
  const [openHouseMenu, setOpenHouseMenu] = useState<string | null>(null);

  // Real view counts (migration 106). Fetched only when the properties
  // screen is open — it is one extra round trip and no other tab reads it.
  const [houseViews, setHouseViews] = React.useState<Record<string, { total: number; last30: number }> | null>(null);
  React.useEffect(() => {
    if (activeTab !== 'houses' || houseViews !== null) return;
    let cancelled = false;
    void loadHouseViewCounts().then((v) => { if (!cancelled && v) setHouseViews(v); });
    return () => { cancelled = true; };
  }, [activeTab, houseViews]);

  const houseStats = React.useMemo(() => ({
    total: houses.length,
    active: houses.filter((h) => h.status === 'approved').length,
    pending: houses.filter((h) => h.status === 'pending').length,
    suspended: houses.filter((h) => h.status === 'suspended').length,
  }), [houses]);

  /** Real bookings per house. There is no view counter anywhere in the app,
   *  so the card shows what can actually be counted rather than inventing a
   *  «مشاهدات» figure to fill the row. */
  const bookingsPerHouse = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const b of bookings) m.set(b.houseId, (m.get(b.houseId) ?? 0) + 1);
    return m;
  }, [bookings]);

  const filteredHouses = React.useMemo(() => {
    const q = houseQuery.trim().toLowerCase();
    const rows = houses.filter((h) => {
      if (houseStatusFilter !== 'all' && h.status !== houseStatusFilter) return false;
      if (!q) return true;
      return [h.name, h.governorate, h.ownerName].some((v) => (v ?? '').toLowerCase().includes(q));
    });
    const sorted = [...rows];
    if (houseSort === 'rating') sorted.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    else if (houseSort === 'bookings') sorted.sort((a, b) => (bookingsPerHouse.get(b.id) ?? 0) - (bookingsPerHouse.get(a.id) ?? 0));
    else sorted.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    return sorted;
  }, [houses, houseQuery, houseStatusFilter, houseSort, bookingsPerHouse]);

  const housePageCount = Math.max(1, Math.ceil(filteredHouses.length / housePerPage));
  // Clamped, so narrowing the filter while on page 9 does not strand the
  // admin on an empty page with no way back.
  const houseSafePage = Math.min(housePage, housePageCount);
  const pagedHouses = filteredHouses.slice((houseSafePage - 1) * housePerPage, houseSafePage * housePerPage);

  const goTo = (section: typeof navSection, tab: typeof activeTab) => {
    setNavSection(section);
    setActiveTab(tab);
  };

  return (
    <div className="space-y-4 text-right text-[#4A4A3A]">
      
      {/* Admin header — says at a glance whether anything needs the admin */}
      <div className="bg-gradient-to-r from-[#0A2342] to-[#123E75] text-white rounded-3xl p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-10 h-10 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5 text-[#C5A059]" />
          </span>
          <div className="min-w-0">
            <span className="text-[11px] text-[#C5A059] font-black block">لوحة الإدارة</span>
            <h2 className="text-sm font-extrabold truncate">{currentUser.name}</h2>
          </div>
        </div>
        <button
          type="button"
          onClick={() => goTo('home', 'growth')}
          className={`text-right shrink-0 rounded-2xl px-3 min-h-11 border transition-all cursor-pointer ${
            totalPending > 0 ? 'bg-rose-500/20 border-rose-300/40 hover:bg-rose-500/30' : 'bg-white/10 border-white/20'
          }`}
        >
          <span className="text-lg font-black leading-none block">{totalPending.toLocaleString('ar-EG')}</span>
          <span className="text-[11px] font-bold text-white/80">{totalPending > 0 ? 'محتاج إجراء' : 'كله تمام ✓'}</span>
        </button>
      </div>

      {/* Grouped navigation. Picking a section also jumps to its first tab —
          before, the sub-tabs changed while the content stayed behind. */}
      {/* The five sections moved to a floating bar pinned at the bottom of the
          screen — see the end of this component. Sub-tabs stay here, beside
          the content they filter. */}
      <div className="bg-white border border-[#D6D6C2] rounded-2xl overflow-hidden">
        {/* Sub-tabs: natural width and scrollable, so labels aren't squeezed */}
        <div className="flex gap-1.5 p-1.5 overflow-x-auto">
          {NAV_GROUPS.find((g) => g.key === navSection)!.tabs.map((t) => (
            <button key={t.key} id={`admin-tab-${t.key}`} onClick={() => setActiveTab(t.key)}
              className={`shrink-0 flex items-center gap-1.5 min-h-11 px-3 rounded-xl text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === t.key ? 'bg-[#5A5A40] text-white shadow-sm' : 'text-[#5A5A40] bg-[#FAF8F5] hover:bg-[#EBEBE0]/60'
              }`}>
              {t.label}
              {(t.badge ?? 0) > 0 && (
                <span className={`min-w-[16px] h-[16px] px-1 rounded-full text-[11px] font-black flex items-center justify-center ${
                  activeTab === t.key ? 'bg-white/25 text-white' : 'bg-rose-500 text-white'
                }`}>{arabicBadge(t.badge ?? 0)}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Needs-action inbox — every pending item in the system, one tap away */}
      {navSection === 'home' && actionQueue.length > 0 && (
        <div className="bg-white border border-[#D6D6C2] rounded-2xl overflow-hidden">
          <div className="px-3.5 py-2.5 border-b border-[#D6D6C2]/60 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            <span className="text-[11px] font-black text-[#0A2342]">محتاج إجراء منك</span>
            <span className="text-[11px] font-bold text-[#8A8A70]">({totalPending.toLocaleString('ar-EG')})</span>
          </div>
          <div className="divide-y divide-[#D6D6C2]/50">
            {actionQueue.map((a) => (
              <button key={a.key} type="button" onClick={() => goTo(a.section, a.key)}
                className="w-full flex items-center gap-2.5 px-3.5 min-h-11.5 hover:bg-[#FAF8F5] transition-colors cursor-pointer text-right">
                <span className="w-8 h-8 rounded-xl bg-rose-50 flex items-center justify-center shrink-0">
                  <a.Icon className="w-4 h-4 text-rose-600" />
                </span>
                <span className="flex-1 text-[12px] font-bold text-[#2E2E24] truncate">{a.label}</span>
                <span className="text-[11px] font-black text-rose-600 shrink-0">{a.count.toLocaleString('ar-EG')}</span>
                <ChevronLeft className="w-4 h-4 text-[#B8B8A0] shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Growth Dashboard — the admin's morning brief.
          Everything computed client-side from already-loaded data.
          What the project owner needs to see FIRST every day: are we
          growing this week, where's the funnel dropping, what's hot. */}
      {activeTab === 'growth' && (() => {
        const now = new Date();
        const dayMs = 86_400_000;
        const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        const todayMs = startOfDay(now);
        const weekAgoMs = todayMs - 7 * dayMs;
        const twoWeeksAgoMs = todayMs - 14 * dayMs;
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();

        const bookingTs = (b: Booking) => new Date(b.createdAt).getTime();
        const userTs = (u: User) => new Date(u.createdAt).getTime();

        const usersThisWeek = users.filter((u) => userTs(u) >= weekAgoMs).length;
        const usersLastWeek = users.filter((u) => userTs(u) >= twoWeeksAgoMs && userTs(u) < weekAgoMs).length;
        const bookingsThisWeek = bookings.filter((b) => bookingTs(b) >= weekAgoMs).length;
        const bookingsLastWeek = bookings.filter((b) => bookingTs(b) >= twoWeeksAgoMs && bookingTs(b) < weekAgoMs).length;

        const revThisMonth = bookings
          .filter((b) => (b.status === 'approved' || b.status === 'completed') && bookingTs(b) >= monthStart)
          .reduce((s, b) => s + b.totalPrice, 0);
        const revLastMonth = bookings
          .filter((b) => (b.status === 'approved' || b.status === 'completed') && bookingTs(b) >= lastMonthStart && bookingTs(b) < monthStart)
          .reduce((s, b) => s + b.totalPrice, 0);

        // null means "there is nothing to compare against" — last week was
        // zero, so the change is undefined, not infinite. It used to render
        // '+∞', which looks like a number and tells you nothing.
        const pctChange = (curr: number, prev: number): string | null => {
          if (prev === 0) return null;
          const pct = Math.round(((curr - prev) / prev) * 100);
          return `${pct >= 0 ? '+' : '−'}${arabicNumber(Math.abs(pct))}٪`;
        };

        // Funnel: total non-owner/admin users → those with any booking → those with any paid booking
        const guestUsers = users.filter((u) => u.role === 'individual' || u.role === 'servant');
        const usersWithBooking = new Set(bookings.map((b) => b.userId));
        const usersWithPaidBooking = new Set(
          bookings.filter((b) => b.paymentStatus === 'paid_deposit' || b.paymentStatus === 'paid_full').map((b) => b.userId)
        );
        const funnelSignups = guestUsers.length;
        const funnelBooked = guestUsers.filter((u) => usersWithBooking.has(u.id)).length;
        const funnelPaid = guestUsers.filter((u) => usersWithPaidBooking.has(u.id)).length;
        const pct = (n: number, d: number) => d === 0 ? 0 : Math.round((n / d) * 100);

        // 14-day bookings sparkline
        const days: { ts: number; count: number }[] = [];
        for (let i = 13; i >= 0; i--) {
          const startTs = todayMs - i * dayMs;
          const endTs = startTs + dayMs;
          days.push({ ts: startTs, count: bookings.filter((b) => bookingTs(b) >= startTs && bookingTs(b) < endTs).length });
        }
        const maxDay = Math.max(1, ...days.map((d) => d.count));

        // Busiest houses this month — ranked on bookings taken, which is a
        // different list from التقارير's highest-collecting houses and is now
        // labelled as such on screen.
        const busiestHouses = topHousesByBookings(bookings, houses, monthStart);

        // Recent activity feed: mix new signups + new bookings, last 7 days, sorted
        const activity: { ts: number; icon: string; text: string }[] = [];
        users.filter((u) => userTs(u) >= weekAgoMs).forEach((u) => {
          activity.push({ ts: userTs(u), icon: '👤', text: `${u.name} أنشأ حساب جديد (${ROLE_LABELS[u.role] ?? 'فرد'})` });
        });
        bookings.filter((b) => bookingTs(b) >= weekAgoMs).forEach((b) => {
          activity.push({ ts: bookingTs(b), icon: '📅', text: `حجز جديد: ${b.organizationName || b.userName} → ${b.houseName}` });
        });
        activity.sort((a, b) => b.ts - a.ts);
        const recentActivity = activity.slice(0, 8);

        return (
          <div className="space-y-4">
            {/* KPI row — the four numbers to check every morning */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <KpiCard title="مستخدمين جدد (٧ أيام)" value={usersThisWeek} delta={pctChange(usersThisWeek, usersLastWeek)} />
              <KpiCard title="حجوزات جديدة (٧ أيام)" value={bookingsThisWeek} delta={pctChange(bookingsThisWeek, bookingsLastWeek)} />
              <KpiCard title="إيرادات هذا الشهر" value={revThisMonth} suffix="ج.م" delta={pctChange(revThisMonth, revLastMonth)} />
              <KpiCard title="بيوت نشطة" value={houses.filter((h) => h.status === 'approved').length} delta={null} />
            </div>

            {/* 14-day bookings sparkline */}
            <div className="bg-white rounded-3xl border border-[#D6D6C2] p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-[#4A4A3A]">الحجوزات آخر ١٤ يوم</span>
                <span className="text-[12px] font-bold text-[#8A8A70]">{arabicPlural(days.reduce((s, d) => s + d.count, 0), BOOKING_FORMS)}</span>
              </div>
              <div className="flex items-end gap-1 h-24" dir="ltr">
                {days.map((d) => (
                  <div key={d.ts} className="flex-1 flex flex-col items-center gap-1 group">
                    <div className="flex-1 w-full flex items-end">
                      <div className="w-full bg-[#5A5A40] rounded-t-md group-hover:bg-[#4A4A3A] transition-colors" style={{ height: `${(d.count / maxDay) * 100}%`, minHeight: d.count > 0 ? '4px' : '0' }} title={`${new Date(d.ts).toLocaleDateString('ar-EG')} · ${arabicPlural(d.count, BOOKING_FORMS)}`} />
                    </div>
                    <span className="text-[11px] font-bold text-[#8A8A70]">{arabicNumber(new Date(d.ts).getDate())}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Conversion funnel */}
            <div className="bg-white rounded-3xl border border-[#D6D6C2] p-4 shadow-sm space-y-3">
              <span className="text-xs font-black text-[#4A4A3A]">مسار التحويل (كل الوقت)</span>
              <div className="space-y-2">
                {([
                  { label: 'التسجيلات (أفراد وخدام)', value: funnelSignups, pct: 100 },
                  { label: 'اللي بدأوا حجز', value: funnelBooked, pct: pct(funnelBooked, funnelSignups) },
                  { label: 'اللي دفعوا فعلاً', value: funnelPaid, pct: pct(funnelPaid, funnelSignups) },
                ]).map((step) => (
                  <div key={step.label} className="space-y-0.5">
                    <div className="flex justify-between items-center text-[12px] font-bold text-[#4A4A3A]">
                      <span>{step.label}</span>
                      <span>{step.value.toLocaleString('ar-EG')} <span className="text-[#8A8A70] font-medium">({arabicNumber(step.pct)}٪)</span></span>
                    </div>
                    <div className="h-2 bg-[#EBEBE0]/50 rounded-full overflow-hidden">
                      <div className="h-full bg-[#5A5A40] rounded-full transition-all" style={{ width: `${step.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              {funnelSignups > 0 && (
                <p className="text-[11px] text-[#8A8A70] font-medium">
                  💡 {pct(funnelBooked, funnelSignups) < 20 ? 'أقل من ٢٠٪ من المسجّلين بيبدأوا حجز — فرصة تحسين في التصفح وسهولة الحجز.' : 'التحويل من التسجيل للحجز في نطاق صحي.'}
                </p>
              )}
            </div>

            {/* Top houses this month */}
            <div className="bg-white rounded-3xl border border-[#D6D6C2] p-4 shadow-sm space-y-2">
              <span className="text-xs font-black text-[#4A4A3A]">أكتر ٥ بيوت حجزاً هذا الشهر</span>
              {busiestHouses.length === 0 ? (
                <p className="text-[12px] text-[#8A8A70] text-center py-3">لا يوجد حجوزات مؤكدة هذا الشهر بعد.</p>
              ) : (
                <div className="space-y-1.5">
                  {busiestHouses.map((row, i) => (
                    <div key={row.house!.id} className="flex items-center gap-2 bg-[#FAF8F5] border border-[#D6D6C2] rounded-2xl p-2.5">
                      <span className="w-6 h-6 rounded-full bg-[#5A5A40] text-white text-[12px] font-black flex items-center justify-center shrink-0">{arabicNumber(i + 1)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-bold text-[#4A4A3A] truncate">{row.house!.name}</div>
                        <div className="text-[11px] text-[#8A8A70]">{row.house!.governorate}</div>
                      </div>
                      <div className="text-left shrink-0">
                        <div className="text-[11px] font-black text-[#4A4A3A]">{arabicPlural(row.count, BOOKING_FORMS)}</div>
                        {/* Booked, not collected — التقارير is where money in
                            hand is reported, and it ranks a different list. */}
                        <div className="text-[11px] text-[#8A8A70]">{arabicNumber(row.bookedValue)} ج.م محجوزة</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent activity feed */}
            <div className="bg-white rounded-3xl border border-[#D6D6C2] p-4 shadow-sm space-y-2">
              <span className="text-xs font-black text-[#4A4A3A]">آخر نشاط (٧ أيام)</span>
              {recentActivity.length === 0 ? (
                <p className="text-[12px] text-[#8A8A70] text-center py-3">لا يوجد نشاط في آخر أسبوع.</p>
              ) : (
                <div className="space-y-1">
                  {recentActivity.map((a, i) => {
                    return (
                      <div key={i} className="flex items-center gap-2 text-[12px] text-[#4A4A3A] py-1 border-b border-[#EBEBE0]/60 last:border-0">
                        <span className="text-sm">{a.icon}</span>
                        <span className="flex-1 min-w-0 truncate">{a.text}</span>
                        {/* lib/timeAgo already does this, with Arabic-Indic digits
                            and real plural agreement. This built its own with a
                            template literal and printed "منذ 21 د". */}
                        <span className="text-[11px] text-[#8A8A70] font-bold shrink-0">{timeAgo(new Date(a.ts).toISOString())}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Moderation Panel */}
      {activeTab === 'moderation' && (
        <div className="space-y-4">
          {/* What this screen is allowed to decide. It used to sit at the
              bottom of the reports page, which is the one screen where it
              had nothing to do with anything above it. It belongs here,
              where someone is about to approve or reject a house. */}
          <div className="bg-[#5A5A40] text-white rounded-2xl p-3 flex gap-2.5 items-start leading-relaxed">
            <Shield className="w-5 h-5 text-amber-200 shrink-0 mt-0.5" />
            <div>
              <span className="text-[12px] font-bold text-amber-200 block">رقابة المحتوى والبيوت القبطية:</span>
              <span className="text-[11px] text-white/80">يقتصر دور الإدارة ومسؤول الخدمة على التحقق من هوية ملاك البيوت وضمان مطابقة البيوت للشروط الروحية واللياقة الكاملة للخدمة المسيحية لضمان سلامة خلوات الكنائس والأسر.</span>
            </div>
          </div>

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
                        {house.images[0] && <img referrerPolicy="no-referrer" src={house.images[0]} alt={house.name} className="w-full h-full object-cover" />}
                        <span className="absolute top-2 right-2 bg-[#5A5A40]/90 backdrop-blur-sm text-white px-2 py-0.5 rounded text-[11px] font-bold">
                          {house.governorate}
                        </span>
                      </div>

                      <div className="p-4 space-y-2.5">
                        <div>
                          <h3 className="text-xs font-bold text-[#4A4A3A]">{house.name}</h3>
                          <p className="text-[12px] text-[#8A8A70] mt-0.5">صاحب البيت: {house.ownerName}</p>
                        </div>

                        <p className="text-[11px] text-[#4A4A3A] leading-relaxed line-clamp-2">{house.description}</p>

                        <div className="bg-[#EBEBE0]/30 rounded-2xl p-2.5 grid grid-cols-3 gap-1.5 text-center text-[12px] text-[#4A4A3A] font-bold border border-[#D6D6C2]">
                          <div>الغرف: {house.roomsCount}</div>
                          <div>الأسرة: {house.bedsCount}</div>
                          <div>سعر الفرد: {house.pricePerNightPerPerson} ج.م</div>
                        </div>

                        {/* Moderation buttons */}
                        <div className="flex gap-2 justify-end pt-2">
                          <button
                            id={`preview-house-${house.id}`}
                            onClick={() => setPreviewHouseId(house.id)}
                            className="flex items-center gap-1 bg-white border border-[#D6D6C2] hover:bg-[#F0EDE6] text-[#4A4A3A] px-3 min-h-11.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>معاينة كاملة</span>
                          </button>
                          <button
                            id={`reject-house-${house.id}`}
                            onClick={() => {
                              onRejectHouse(house.id);
                              alert('تم رفض البيت وسيظل غير مرئي للمستخدمين.');
                            }}
                            className="flex items-center gap-1 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-800 px-3 min-h-11.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
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
                            className="flex items-center gap-1 bg-emerald-700 hover:bg-emerald-800 text-white px-4 min-h-11.5 rounded-xl text-xs font-extrabold shadow-sm transition-all cursor-pointer"
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
                          <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full shrink-0">
                            تعديل قيد المراجعة
                          </span>
                        </div>
                        <p className="text-[12px] text-[#8A8A70]">صاحب البيت: {house.ownerName}</p>

                        {rows.length === 0 && arrayFieldsChanged.length === 0 ? (
                          <p className="text-[12px] text-[#8A8A70]">لا توجد تغييرات ظاهرة في الحقول الأساسية.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {rows.map((f) => (
                              <div key={f.key as string} className="bg-[#EBEBE0]/30 rounded-xl p-2 text-[12px] border border-[#D6D6C2]">
                                <span className="font-bold text-[#4A4A3A] block mb-0.5">{f.label}:</span>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-rose-600 line-through">
                                    {f.format ? f.format(house[f.key]) : `${String(house[f.key] ?? '-')}${f.suffix || ''}`}
                                  </span>
                                  <span className="text-[#8A8A70]">←</span>
                                  <span className="text-emerald-700 font-bold">
                                    {f.format ? f.format(house.pendingEdit?.[f.key]) : `${String(house.pendingEdit?.[f.key] ?? '-')}${f.suffix || ''}`}
                                  </span>
                                </div>
                              </div>
                            ))}
                            {arrayFieldsChanged.length > 0 && (
                              <div className="bg-[#EBEBE0]/30 rounded-xl p-2 text-[12px] border border-[#D6D6C2]">
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
                            className="flex items-center gap-1 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-800 px-3 min-h-11.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
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
                            className="flex items-center gap-1 bg-emerald-700 hover:bg-emerald-800 text-white px-4 min-h-11.5 rounded-xl text-xs font-extrabold shadow-sm transition-all cursor-pointer"
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
                    <p className="text-[12px] text-[#8A8A70] mt-0.5">
                      {ROLE_LABELS[acc.role] ?? 'خادم'} · {acc.email} · {acc.phone}
                    </p>
                    {acc.organizationName && (
                      <p className="text-[12px] text-[#8A8A70] mt-0.5">الجهة: {acc.organizationName}</p>
                    )}
                    {acc.churchName && (
                      <p className="text-[12px] text-[#8A8A70] mt-0.5">الكنيسة: {acc.churchName} — الأب الكاهن: {acc.priestName}</p>
                    )}
                  </div>

                  {/* ID verification happens out-of-band on WhatsApp, not in-app */}
                  <a
                    href={`https://wa.me/2${acc.phone.replace(/^0/, '')}?text=${encodeURIComponent('سلام ونعمة، برجاء إرسال صورة بطاقتك الشخصية (وش وضهر) لاستكمال مراجعة حسابك على بيما.')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-1.5 rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-[12px] font-bold min-h-11 hover:bg-emerald-100 transition-colors"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>تواصل واتساب لمراجعة البطاقة الشخصية</span>
                  </a>

                  <div className="flex gap-2 justify-end pt-1">
                    <button
                      id={`reject-account-${acc.id}`}
                      onClick={() => onSetUserApproval && onSetUserApproval(acc.id, 'rejected')}
                      className="flex items-center gap-1 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-800 px-3 min-h-11.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>رفض الحساب</span>
                    </button>
                    <button
                      id={`approve-account-${acc.id}`}
                      onClick={() => onSetUserApproval && onSetUserApproval(acc.id, 'approved')}
                      className="flex items-center gap-1 bg-emerald-700 hover:bg-emerald-800 text-white px-4 min-h-11.5 rounded-xl text-xs font-extrabold shadow-sm transition-all cursor-pointer"
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
              { key: 'freeCancelDays', label: 'إلغاء مجاني قبل الوصول بـ', suffix: 'يوم', factor: 1, hint: 'الإلغاء قبل الوصول بهذه المدة أو أكثر = استرداد كامل.' },
              { key: 'partialRefundDays', label: 'استرداد جزئي قبل الوصول بـ', suffix: 'يوم', factor: 1, hint: 'الإلغاء قبل الوصول بهذه المدة أو أكثر = استرداد جزئي. أقل منها = لا استرداد.' },
              { key: 'partialRefundPct', label: 'نسبة الاسترداد الجزئي', suffix: '%', factor: 100, hint: 'النسبة المستردة من المبلغ المدفوع في نافذة الاسترداد الجزئي.' },
              { key: 'maxBookingsPerDay', label: 'أقصى عدد حجوزات للحساب الواحد', suffix: 'حجز / ٢٤ ساعة', factor: 1, hint: 'يمنع حساب واحد من إغراق البيوت بحجوزات وهمية. صاحب البيت والأدمن مستثنيين، فالمالك يقدر يسجّل حجوزات التليفون براحته.' },
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
                    className="w-28 bg-white border border-[#D6D6C2] text-xs px-3 min-h-11 rounded-xl text-[#4A4A3A] focus:outline-none focus:border-[#5A5A40]"
                  />
                  <span className="text-[12px] text-[#8A8A70] font-bold">{f.suffix}</span>
                </div>
                <p className="text-[11px] text-[#8A8A70]">{f.hint}</p>
              </div>
            ))}

            {/* Support line (migration 103). Six screens link to this, two of
                them shown to people locked out of everything else — a banned
                user and an owner waiting for approval. It used to be a
                hardcoded placeholder that nobody answered. */}
            <div className="border-t border-[#EBEBE0] pt-3 space-y-1">
              <label className="block text-[11px] font-black text-[#4A4A3A]" htmlFor="setting-supportWhatsApp">
                رقم واتساب الدعم
              </label>
              <input
                id="setting-supportWhatsApp"
                type="text"
                inputMode="numeric"
                dir="ltr"
                value={settingsDraft.supportWhatsApp}
                onChange={(e) => setSettingsDraft((prev) => ({ ...prev, supportWhatsApp: e.target.value.replace(/\D/g, '') }))}
                placeholder="201096126259"
                className="w-48 bg-white border border-[#D6D6C2] text-xs px-3 min-h-11 rounded-xl text-[#4A4A3A] focus:outline-none focus:border-[#5A5A40] font-mono"
              />
              <p className="text-[11px] text-[#8A8A70]">
                بكود الدولة وبدون + أو مسافات — كده بالظبط زي ما واتساب عايزه. مثال: 201096126259
              </p>
              {!/^\d{8,15}$/.test(settingsDraft.supportWhatsApp) && (
                <p role="alert" className="text-[11px] font-bold text-rose-600">
                  الرقم لازم يكون من ٨ لـ ١٥ رقم بكود الدولة، وإلا مش هيتحفظ.
                </p>
              )}
            </div>

            {/* Platform collection accounts — where guests send the deposit (migration 069) */}
            <div className="border-t border-[#EBEBE0] pt-3 space-y-2">
              <div>
                <div className="text-[11px] font-black text-[#4A4A3A]">أرقام تحصيل المنصة (يدفع عليها العميل العربون):</div>
                <p className="text-[11px] text-[#8A8A70]">دي أرقامك إنت (بيما). لو سيبتها فاضية، العميل هيدفع لصاحب البيت مباشرة زي النظام القديم.</p>
              </div>
              {(settingsDraft.paymentMethods ?? []).map((m, i) => (
                <div key={m.id} className="flex flex-wrap items-center gap-1.5 bg-[#FBFBFA] border border-[#EBEBE0] rounded-xl p-2">
                  <select value={m.type}
                    onChange={(e) => setSettingsDraft((prev) => ({ ...prev, paymentMethods: prev.paymentMethods.map((x, j) => (j === i ? { ...x, type: e.target.value as OwnerPaymentMethod['type'] } : x)) }))}
                    className="bg-white border border-[#D6D6C2] text-[12px] px-2 min-h-11 rounded-lg text-[#4A4A3A]">
                    {PLATFORM_PM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <input placeholder="الاسم (مثلاً: إنستاباي بيما)" value={m.label}
                    onChange={(e) => setSettingsDraft((prev) => ({ ...prev, paymentMethods: prev.paymentMethods.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) }))}
                    className="flex-1 min-w-[110px] bg-white border border-[#D6D6C2] text-[12px] px-2 min-h-11 rounded-lg text-[#4A4A3A]" />
                  <input placeholder="الرقم / الحساب" dir="ltr" value={m.value}
                    onChange={(e) => setSettingsDraft((prev) => ({ ...prev, paymentMethods: prev.paymentMethods.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) }))}
                    className="flex-1 min-w-[110px] bg-white border border-[#D6D6C2] text-[12px] px-2 min-h-11 rounded-lg text-[#4A4A3A] font-mono" />
                  <button type="button" onClick={() => setSettingsDraft((prev) => ({ ...prev, paymentMethods: prev.paymentMethods.filter((_, j) => j !== i) }))}
                    className="text-rose-600 text-[12px] font-bold px-2 min-h-11.5 cursor-pointer">حذف</button>
                </div>
              ))}
              <button type="button"
                onClick={() => setSettingsDraft((prev) => ({ ...prev, paymentMethods: [...(prev.paymentMethods ?? []), { id: `ppm_${Date.now()}`, type: 'instapay', label: '', value: '' }] }))}
                className="text-[12px] font-bold bg-[#EBEBE0] hover:bg-[#DDD] text-[#4A4A3A] px-3 min-h-11 rounded-lg cursor-pointer transition-colors">+ إضافة رقم تحصيل</button>
            </div>

            {settingsSaved && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-[12px] font-bold rounded-xl px-3 py-2 text-center">
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
                className="flex-1 bg-[#0A2342] hover:bg-[#071930] text-white text-xs font-bold min-h-11.5 rounded-xl transition-colors cursor-pointer"
              >
                💾 حفظ وتطبيق
              </button>
              <button
                onClick={() => setSettingsDraft(settings)}
                className="bg-[#EBEBE0] text-[#4A4A3A] text-xs font-bold min-h-11.5 px-4 rounded-xl cursor-pointer"
              >
                تراجع
              </button>
            </div>
          </div>
          <div className="bg-amber-50/60 border border-amber-200/60 rounded-2xl p-3 text-[11px] text-amber-900 leading-relaxed">
            ⚠️ التغييرات بتأثر على الحجوزات الجديدة والدفعات الجاية. نسبة العمولة والعربون والنقاط بتتطبّق على السيرفر كمان مش بس في العرض.
          </div>

          {/* ── Maintenance: move the pre-Storage photos out of the database ──
              One-off, resumable, and safe to run again: each house is saved as
              soon as it finishes, and anything already on Storage is skipped. */}
          <div className="bg-white rounded-3xl border border-[#D6D6C2] p-4 space-y-3">
            <div className="flex items-center gap-1.5 pb-2 border-b border-[#EBEBE0]">
              <ImageIcon className="w-4 h-4 text-[#5A5A40]" />
              <h3 className="text-xs font-black text-[#0A2342]">نقل صور البيوت القديمة للتخزين</h3>
            </div>
            <p className="text-[11px] text-[#8A8A70] leading-relaxed">
              الصور القديمة متخزنة جوه الداتابيز نفسها، وده اللي بيستهلك الـEgress.
              الزرار ده بيرفعها على Supabase Storage مضغوطة ويسيب رابط بدلها.
              الصور اللي اترفعت بعد التحديث بتتخطى. تقدر توقف وتكمّل بعدين —
              كل بيت بيتحفظ أول ما يخلص.
            </p>
            {imgMigrationLog.length > 0 && (
              <div className="bg-[#FAF8F5] border border-[#E7E5DB] rounded-2xl p-2.5 space-y-1 max-h-40 overflow-y-auto">
                {imgMigrationLog.map((line, i) => (
                  <div key={i} className="text-[11px] font-bold text-[#4A4A3A]">{line}</div>
                ))}
              </div>
            )}
            <button
              type="button"
              disabled={imgMigrationBusy}
              onClick={async () => {
                if (!confirm(
                  `نقل صور ${arabicNumber(houses.length)} بيت للتخزين؟\n\n`
                  + '• الصور اللي على Storage خلاص هتتخطى\n'
                  + '• أي صورة تفشل هتفضل مكانها ومش هتضيع\n'
                  + '• ممكن ياخد وقت — سيب الصفحة مفتوحة',
                )) return;
                setImgMigrationBusy(true);
                setImgMigrationLog(['بدأنا…']);
                let totalMoved = 0, totalFailed = 0, skipped = 0;
                for (const [i, h] of houses.entries()) {
                  const full = await loadHouseImages(h.id);
                  if (!full) {
                    setImgMigrationLog((l) => [...l, `⚠️ ${h.name}: تعذّر قراءة الصور`]);
                    continue;
                  }
                  const { inline } = inlineImageStats(full);
                  if (inline === 0) {
                    skipped++;
                    setImgMigrationLog((l) => [...l, `✓ ${h.name}: مفيش صور محتاجة نقل`]);
                    continue;
                  }
                  setImgMigrationLog((l) => [...l,
                    `⏳ ${h.name} (${arabicNumber(i + 1)} من ${arabicNumber(houses.length)}): ${arabicNumber(inline)} صورة…`]);
                  const res = await migrateImages(full, { folder: 'listings' });
                  totalMoved += res.moved; totalFailed += res.failed;
                  // Only write when something actually moved — a house whose
                  // uploads all failed is left exactly as it was.
                  if (res.changed) await saveHouseImages(h.id, res.images);
                  setImgMigrationLog((l) => [...l,
                    `${res.failed ? '⚠️' : '✓'} ${h.name}: اتنقل ${arabicNumber(res.moved)}`
                    + (res.failed ? ` · فشل ${arabicNumber(res.failed)}` : '')]);
                }
                setImgMigrationLog((l) => [...l,
                  `— خلصنا. اتنقل ${arabicNumber(totalMoved)} صورة`
                  + (totalFailed ? ` · فشل ${arabicNumber(totalFailed)}` : '')
                  + ` · ${arabicNumber(skipped)} بيت مكانش محتاج`]);
                setImgMigrationBusy(false);
              }}
              className="w-full flex items-center justify-center gap-1.5 bg-[#5A5A40] hover:bg-[#4A4A35] text-white text-[12px] font-bold min-h-11 rounded-xl cursor-pointer disabled:opacity-60"
            >
              {imgMigrationBusy
                ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري النقل…</>
                : <><ImageIcon className="w-4 h-4" /> ابدأ نقل الصور</>}
            </button>
          </div>
        </div>
      )}

      {/* Audit log — who approved/rejected/banned what, and when (migration 032) */}
      {activeTab === 'audit' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 px-1">
            <div className="text-xs font-bold text-[#8A8A70]">
              سجل قرارات الإدارة (آخر {arabicNumber(auditLog.length)} إجراء) — مين وافق أو رفض أو حظر إيه وإمتى:
            </div>
            {auditLog.length > 0 && (
              <button type="button" onClick={exportAudit}
                className="shrink-0 flex items-center gap-1 text-[11px] font-black text-[#0A2342] bg-white border border-[#D6D6C2] rounded-xl px-2.5 min-h-11 cursor-pointer hover:bg-[#F0EDE6]">
                <Download className="w-3.5 h-3.5" /> تصدير CSV
              </button>
            )}
          </div>

          {auditLog.length > 0 && (
            <div className="space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 text-[#8A8A70] absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  id="admin-audit-search"
                  type="text"
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  placeholder="ابحث بالإجراء أو التفاصيل أو مين عمله..."
                  className="w-full bg-white border border-[#D6D6C2] rounded-xl pr-9 pl-3 min-h-11 text-[12px] text-[#2D2D24] outline-none focus:border-[#5A5A40] text-right"
                />
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                {([
                  { key: 'all' as const, label: 'الكل', n: auditLog.length },
                  { key: 'money' as const, label: 'فلوس', n: auditLog.filter((e) => AUDIT_KINDS.money.includes(e.action)).length },
                  { key: 'content' as const, label: 'بيوت وحجوزات', n: auditLog.filter((e) => AUDIT_KINDS.content.includes(e.action)).length },
                  { key: 'people' as const, label: 'حسابات', n: auditLog.filter((e) => AUDIT_KINDS.people.includes(e.action)).length },
                ]).map((f) => (
                  <button key={f.key} type="button" onClick={() => setAuditKind(f.key)}
                    className={`shrink-0 flex items-center gap-1 text-[11px] font-black px-3 min-h-11 rounded-xl border transition-colors cursor-pointer ${
                      auditKind === f.key ? 'bg-[#5A5A40] text-white border-[#5A5A40]' : 'bg-white text-[#4A4A3A] border-[#D6D6C2] hover:bg-[#F0EDE6]'
                    }`}>
                    {f.label}
                    <span className={`text-[11px] font-black ${auditKind === f.key ? 'text-white/80' : 'text-[#8A8A70]'}`}>{arabicNumber(f.n)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {auditLog.length === 0 ? (
            <div className="bg-white rounded-3xl border border-[#D6D6C2] p-6 text-center text-xs text-[#8A8A70]">
              لا توجد إجراءات إدارية مسجلة بعد.
            </div>
          ) : filteredAudit.length === 0 ? (
            // "Nothing matched" and "nothing happened" are different answers,
            // and only one of them is the admin's own filter talking.
            <div className="bg-white rounded-3xl border border-[#D6D6C2] p-6 text-center text-xs text-[#8A8A70] space-y-2">
              <div>مفيش إجراءات مطابقة للبحث.</div>
              <button type="button" onClick={() => { setAuditSearch(''); setAuditKind('all'); }}
                className="inline-flex items-center min-h-11 px-3 text-[11px] font-black text-[#0A2342] underline cursor-pointer">
                امسح البحث والفلترة
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredAudit.map((entry) => {
                const actionLabels = AUDIT_ACTION_LABELS;
                // The money rows are the ones an audit is read for, so they
                // are marked rather than left to look like any other line.
                const isMoney = entry.action === 'payment_status_changed'
                  || entry.action === 'payout_status_changed'
                  || entry.action === 'settings_changed';
                return (
                  <div key={entry.id} className={`bg-white rounded-2xl border p-3 text-[12px] space-y-1 ${isMoney ? 'border-[#D4AF37]' : 'border-[#D6D6C2]'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-[#0A2342] flex items-center gap-1.5">
                        {isMoney && <Wallet className="w-3.5 h-3.5 text-[#B8912B] shrink-0" />}
                        {actionLabels[entry.action] || entry.action}
                      </span>
                      <span className="text-[#8A8A70] shrink-0">{arabicDateTime(entry.createdAt)}</span>
                    </div>
                    <div className="text-[#4A4A3A]">{entry.details}</div>
                    <div className="text-[#8A8A70]">
                      {/* A role with no Arabic name printed its English key mid-sentence. */}
                      بواسطة: {entry.actorName || 'غير معروف'} ({ROLE_LABELS[entry.actorRole ?? ''] ?? 'غير معروف'})
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Houses control — suspend / reactivate any house */}
      {activeTab === 'houses' && (
        <div className="space-y-4">

          {/* Title and what this screen is for. */}
          <div className="px-1">
            <h3 className="text-[16px] font-black text-[#4A4A3A]">إدارة البيوت</h3>
            <p className="text-[12px] text-[#8A8A70] mt-0.5">عرض وإدارة كل بيوت المؤتمرات المسجّلة على بيما.</p>
          </div>

          {/* Four figures, each counted from the houses themselves. */}
          <div className="grid grid-cols-2 gap-2.5">
            {([
              { label: 'إجمالي البيوت', value: houseStats.total, Icon: Home, tint: 'text-[#0A2342]' },
              { label: 'نشطة', value: houseStats.active, Icon: CheckCircle2, tint: 'text-emerald-700' },
              { label: 'قيد المراجعة', value: houseStats.pending, Icon: Clock, tint: 'text-amber-700' },
              { label: 'موقوفة', value: houseStats.suspended, Icon: XCircle, tint: 'text-rose-700' },
            ] as const).map((k) => (
              <div key={k.label} className="bg-white border border-[#EBEBE0] rounded-[20px] p-3.5">
                <k.Icon className={`w-4 h-4 ${k.tint}`} />
                <div className="text-[22px] font-black text-[#4A4A3A] leading-tight mt-1.5 tabular-nums">
                  {arabicNumber(k.value)}
                </div>
                <div className="text-[11px] font-bold text-[#8A8A70]">{k.label}</div>
              </div>
            ))}
          </div>

          {/* Search takes the width; sort and export stay quiet beside it. */}
          <div className="flex items-stretch gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-[#BCBC9D] absolute top-1/2 -translate-y-1/2 right-3 pointer-events-none" />
              <input
                id="admin-house-search"
                value={houseQuery}
                onChange={(e) => { setHouseQuery(e.target.value); setHousePage(1); }}
                placeholder="ابحث باسم البيت أو المحافظة أو المالك…"
                aria-label="ابحث في البيوت"
                className="w-full bg-white border border-[#EBEBE0] rounded-[20px] text-[12px] min-h-11 pr-9 pl-3 text-[#4A4A3A] placeholder-[#BCBC9D] focus:outline-none focus:border-[#756B42] transition-colors"
              />
            </div>
            <select
              value={houseSort}
              onChange={(e) => setHouseSort(e.target.value as typeof houseSort)}
              aria-label="ترتيب البيوت"
              className="shrink-0 bg-white border border-[#EBEBE0] rounded-[20px] text-[12px] font-bold min-h-11 px-3 text-[#4A4A3A] focus:outline-none focus:border-[#756B42] cursor-pointer"
            >
              <option value="name">الاسم</option>
              <option value="rating">التقييم</option>
              <option value="bookings">الحجوزات</option>
            </select>
            <button
              type="button"
              onClick={() => downloadCsv('houses.csv',
                              ['الاسم', 'المحافظة', 'النوع', 'الحالة', 'التقييم', 'عدد التقييمات', 'الحجوزات', 'المشاهدات', 'المالك'],
                              filteredHouses.map((h) => [
                                h.name, h.governorate,
                                h.propertyType === 'student' ? 'سكن طلابي' : h.propertyType === 'staff' ? 'سكن عاملين' : 'بيت مؤتمرات',
                                h.status === 'approved' ? 'نشط' : h.status === 'pending' ? 'قيد المراجعة' : h.status === 'suspended' ? 'موقوف' : 'مرفوض',
                                String(h.rating ?? 0), String(h.reviewsCount ?? 0),
                                String(bookingsPerHouse.get(h.id) ?? 0),
                  houseViews ? String(houseViews[h.id]?.total ?? 0) : '',
                  h.ownerName ?? '',
                              ]),
                            )}
              aria-label="تصدير البيوت"
              className="shrink-0 flex items-center gap-1.5 bg-white border border-[#EBEBE0] rounded-[20px] text-[12px] font-bold min-h-11 px-3 text-[#4A4A3A] hover:bg-[#FAF8F5] transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              تصدير
            </button>
          </div>

          {/* Status filter — the counts double as the reason to tap. */}
          <div className="flex gap-1.5 overflow-x-auto">
            {([
              { key: 'all', label: 'الكل', n: houseStats.total },
              { key: 'approved', label: 'نشطة', n: houseStats.active },
              { key: 'pending', label: 'قيد المراجعة', n: houseStats.pending },
              { key: 'suspended', label: 'موقوفة', n: houseStats.suspended },
            ] as const).map((f) => {
              const on = houseStatusFilter === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => { setHouseStatusFilter(f.key); setHousePage(1); }}
                  className={`shrink-0 flex items-center gap-1.5 min-h-11 px-3.5 rounded-full text-[12px] font-bold border transition-all duration-200 cursor-pointer ${
                    on
                      ? 'bg-[#756B42] border-[#756B42] text-white'
                      : 'bg-white border-[#EBEBE0] text-[#8A8A70] hover:border-[#D6D6C2]'
                  }`}
                >
                  {f.label}
                  <span className={`text-[11px] font-black tabular-nums ${on ? 'text-white/70' : 'text-[#BCBC9D]'}`}>
                    {arabicNumber(f.n)}
                  </span>
                </button>
              );
            })}
          </div>

          {filteredHouses.length === 0 ? (
            <div className="bg-white rounded-[24px] p-10 border border-[#EBEBE0] text-center">
              <Home className="w-8 h-8 text-[#BCBC9D] mx-auto mb-2" />
              <p className="text-[12px] font-bold text-[#4A4A3A]">
                {houses.length === 0 ? 'لا توجد بيوت مسجلة بعد' : 'مفيش بيوت مطابقة للبحث'}
              </p>
              {houses.length > 0 && (
                <button
                  type="button"
                  onClick={() => { setHouseQuery(''); setHouseStatusFilter('all'); }}
                  className="mt-3 text-[12px] font-bold text-[#756B42] underline cursor-pointer"
                >
                  امسح البحث والفلتر
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
              {pagedHouses.map((house) => {
                const statusLabel = house.status === 'approved' ? 'نشط'
                  : house.status === 'pending' ? 'قيد المراجعة'
                    : house.status === 'suspended' ? 'موقوف' : 'مرفوض';
                const statusClass = house.status === 'approved' ? 'bg-emerald-50 text-emerald-800'
                  : house.status === 'pending' ? 'bg-amber-50 text-amber-800'
                    : 'bg-rose-50 text-rose-800';
                const dotClass = house.status === 'approved' ? 'bg-emerald-600'
                  : house.status === 'pending' ? 'bg-amber-500' : 'bg-rose-600';
                const typeLabel = house.propertyType === 'student' ? 'سكن طلابي'
                  : house.propertyType === 'staff' ? 'سكن عاملين' : 'بيت مؤتمرات';
                const bookingCount = bookingsPerHouse.get(house.id) ?? 0;
                const menuOpen = openHouseMenu === house.id;

                return (
                  <div key={house.id} className="bg-white rounded-[24px] border border-[#EBEBE0] p-3 shadow-[0_1px_3px_rgba(16,43,92,0.04)]">
                    <div className="flex items-start gap-3">

                      {/* Actions first in the DOM, which in RTL puts them on
                          the right — where the eye lands last, after the
                          house has been identified. */}
                      <div className="shrink-0 flex flex-col gap-1.5 w-[86px]">
                        <span className={`flex items-center justify-center gap-1.5 text-[11px] font-bold py-1.5 rounded-full ${statusClass}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
                          {statusLabel}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPreviewHouseId(house.id)}
                          className="flex items-center justify-center gap-1.5 min-h-11 rounded-[14px] border border-[#EBEBE0] text-[12px] font-bold text-[#4A4A3A] hover:bg-[#FAF8F5] transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          عرض
                        </button>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setOpenHouseMenu(menuOpen ? null : house.id)}
                            aria-expanded={menuOpen}
                            aria-label={`إجراءات ${house.name}`}
                            className="w-full flex items-center justify-center gap-1.5 min-h-11 rounded-[14px] border border-[#EBEBE0] text-[12px] font-bold text-[#4A4A3A] hover:bg-[#FAF8F5] transition-colors cursor-pointer"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                            المزيد
                          </button>
                          {menuOpen && (
                            <>
                              {/* Tapping anywhere else closes it. Without this
                                  the only way out was to find «المزيد» again. */}
                              <button
                                type="button"
                                aria-label="إغلاق القائمة"
                                onClick={() => setOpenHouseMenu(null)}
                                className="fixed inset-0 z-30 cursor-default"
                              />
                              {/* right-0, not left-0.
                                  The actions column is the rightmost thing on
                                  screen and this menu is 160px wide, so
                                  anchoring its LEFT edge to an 86px column ran
                                  it ~49px past the right edge of a 375px
                                  phone — which is why it looked cut in half.
                                  Anchored right, it opens inwards and fits.

                                  z-40 clears the sticky section bar at the
                                  bottom, which is z-20 and comes later in the
                                  DOM, so at equal z it painted over the menu. */}
                              <div className="absolute right-0 top-full mt-1 z-40 w-40 bg-white border border-[#EBEBE0] rounded-[16px] shadow-[0_8px_24px_rgba(16,43,92,0.12)] overflow-hidden">
                              {(house.status === 'approved' || house.status === 'suspended') && onSuspendHouse && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const suspend = house.status === 'approved';
                                    if (!suspend || confirm(`إيقاف بيت "${house.name}"؟ هيختفي من المنصة فوراً لحد ما تعيد تفعيله.`)) {
                                      onSuspendHouse(house.id, suspend);
                                    }
                                    setOpenHouseMenu(null);
                                  }}
                                  className="w-full text-right px-3 min-h-11 text-[12px] font-bold text-[#4A4A3A] hover:bg-[#FAF8F5] transition-colors cursor-pointer"
                                >
                                  {house.status === 'approved' ? 'إيقاف البيت' : 'إعادة التفعيل'}
                                </button>
                              )}
                              {onDeleteHouse && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (confirm(`أرشفة بيت "${house.name}"؟

هيختفي من المنصة ومن نتايج البحث، بس حجوزاته ودفعاته هتفضل محفوظة — دي فلوس ناس عدّت من عندنا ومينفعش تتمسح.`)) {
                                      onDeleteHouse(house.id);
                                    }
                                    setOpenHouseMenu(null);
                                  }}
                                  className="w-full text-right px-3 min-h-11 text-[12px] font-bold text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer border-t border-[#EBEBE0]"
                                >
                                  أرشفة البيت
                                </button>
                              )}
                              {/* Its own gate — pricing an offer and archiving
                                  a house are different permissions to hand a
                                  preview or a future limited role. */}
                              {onSetHouseDiscount && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDiscountHouseId(house.id);
                                    setDiscountDraft({
                                      pct: house.discountPct ? String(Math.round(house.discountPct * 100)) : '',
                                      from: house.discountStartsAt ?? '',
                                      to: house.discountEndsAt ?? '',
                                      note: house.discountNote ?? '',
                                    });
                                    setOpenHouseMenu(null);
                                  }}
                                  className="w-full text-right px-3 min-h-11 text-[12px] font-bold text-[#B8944E] hover:bg-[#FAF6EC] transition-colors cursor-pointer border-t border-[#EBEBE0]"
                                >
                                  {house.discountPct ? 'تعديل الخصم' : 'حط خصم'}
                                </button>
                              )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Name, where it is, what it is, and the three numbers
                          the platform can actually count. */}
                      <div className="flex-1 min-w-0 py-0.5">
                        <div className="text-[13px] font-black text-[#4A4A3A] truncate">{house.name}</div>
                        <div className="text-[11px] text-[#8A8A70] mt-1 flex items-center gap-1.5 flex-wrap">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 shrink-0" />
                            {house.governorate}
                          </span>
                          <span className="text-[#D6D6C2]">·</span>
                          <span>{typeLabel}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-2.5">
                          <span className="flex items-center gap-1 text-[11px] font-bold text-[#4A4A3A]">
                            <Star className="w-3.5 h-3.5 text-[#C5A059]" />
                            <span className="tabular-nums">{house.rating ? house.rating.toFixed(1) : '—'}</span>
                            <span className="text-[#BCBC9D] font-normal">({arabicNumber(house.reviewsCount ?? 0)})</span>
                          </span>
                          <span className="flex items-center gap-1 text-[11px] font-bold text-[#4A4A3A]">
                            <CalendarDays className="w-3.5 h-3.5 text-[#8A8A70]" />
                            <span className="tabular-nums">{arabicNumber(bookingCount)}</span>
                            <span className="text-[#BCBC9D] font-normal">حجز</span>
                          </span>
                          {/* Only once the counts have actually loaded. A zero
                              drawn while the request is still in flight reads
                              as «nobody looked at this house», which is a
                              different claim from «we do not know yet». */}
                          {houseViews && (() => {
                            const seen = houseViews[house.id]?.total ?? 0;
                            // Arabic-Indic zero is U+0660 — a DOT, and 4.6px
                            // wide beside an eye icon at this size. Printed
                            // bare it reads as a missing number rather than as
                            // «none yet», which is exactly how it was reported:
                            // «the eye shows without the count».
                            return (
                              <span className="flex items-center gap-1 text-[11px] font-bold text-[#4A4A3A]">
                                <Eye className="w-3.5 h-3.5 text-[#8A8A70]" />
                                {seen === 0 ? (
                                  <span className="text-[#BCBC9D] font-normal">لسه مفيش مشاهدات</span>
                                ) : (
                                  <>
                                    <span className="tabular-nums">{arabicNumber(seen)}</span>
                                    <span className="text-[#BCBC9D] font-normal">مشاهدة</span>
                                  </>
                                )}
                              </span>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Image last in the DOM, so RTL places it on the left. */}
                      {house.images[0] ? (
                        <img
                          referrerPolicy="no-referrer"
                          src={house.images[0]}
                          alt={house.name}
                          className="w-[88px] h-[88px] rounded-[18px] object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-[88px] h-[88px] rounded-[18px] bg-[#F4F2EC] shrink-0 flex items-center justify-center">
                          <Home className="w-6 h-6 text-[#D6D6C2]" />
                        </div>
                      )}
                    </div>

                    {/* A live discount is money leaving the owner's pocket on
                        every booking, so it is stated on the card, not hidden
                        behind the menu that set it. */}
                    {(house.discountPct ?? 0) > 0 && (
                      <div className="mt-2 flex items-center justify-between gap-2 bg-[#FAF6EC] border border-[#E8DCC0] rounded-xl px-3 py-2">
                        <span className="text-[11px] font-black text-[#B8944E]">
                          خصم {arabicNumber(Math.round((house.discountPct ?? 0) * 100))}٪
                          {house.discountStartsAt && house.discountEndsAt &&
                            ` · ${arabicDateRange(house.discountStartsAt, house.discountEndsAt)}`}
                        </span>
                        {house.discountNote && (
                          <span className="text-[11px] text-[#8A8A70] truncate">{house.discountNote}</span>
                        )}
                      </div>
                    )}

                    {/* The discount editor, inline under its card. */}
                    {discountHouseId === house.id && onSetHouseDiscount && (
                      <div className="mt-2 bg-[#FAF8F5] border border-[#E7E5DB] rounded-2xl p-3 space-y-2">
                        <label className="space-y-1 block">
                          <span className="text-[11px] font-bold text-[#8A8A70]">نسبة الخصم ٪ (من ١ لـ٦٠)</span>
                          <input type="number" min={0} max={60} value={discountDraft.pct}
                            onChange={(e) => setDiscountDraft((d) => ({ ...d, pct: e.target.value }))}
                            className="w-full bg-white border border-[#D6D6C2] text-[12px] px-2 min-h-11 rounded-lg focus:outline-none" />
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="space-y-1">
                            <span className="text-[11px] font-bold text-[#8A8A70]">من (تاريخ الدخول)</span>
                            <input type="date" value={discountDraft.from}
                              onChange={(e) => setDiscountDraft((d) => ({ ...d, from: e.target.value }))}
                              className="w-full bg-white border border-[#D6D6C2] text-[12px] px-2 min-h-11 rounded-lg focus:outline-none" />
                          </label>
                          <label className="space-y-1">
                            <span className="text-[11px] font-bold text-[#8A8A70]">إلى</span>
                            <input type="date" value={discountDraft.to}
                              onChange={(e) => setDiscountDraft((d) => ({ ...d, to: e.target.value }))}
                              className="w-full bg-white border border-[#D6D6C2] text-[12px] px-2 min-h-11 rounded-lg focus:outline-none" />
                          </label>
                        </div>
                        <label className="space-y-1 block">
                          <span className="text-[11px] font-bold text-[#8A8A70]">مين طلبه؟ (المالك بيتحمّل تمنه — سجّل طلبه)</span>
                          <input type="text" value={discountDraft.note} placeholder="مثلاً: طلب أ. مينا تليفونياً ٨/٨"
                            onChange={(e) => setDiscountDraft((d) => ({ ...d, note: e.target.value }))}
                            className="w-full bg-white border border-[#D6D6C2] text-[12px] px-2 min-h-11 rounded-lg focus:outline-none" />
                        </label>
                        {/* What it does to the money, before it is saved. */}
                        {(() => {
                          const pct = parseInt(discountDraft.pct, 10);
                          if (!Number.isFinite(pct) || pct <= 0) return null;
                          const nightly = house.pricePerNightPerPerson || 0;
                          const after = Math.round(nightly * (1 - pct / 100));
                          return (
                            <p className="text-[11px] text-[#8A8A70] leading-relaxed">
                              الليلة هتبقى {arabicNumber(after)} بدل {arabicNumber(nightly)} ج.م.
                              المالك بيتحمّل الفرق، وعمولتك بتتحسب على السعر بعد الخصم.
                            </p>
                          );
                        })()}
                        <div className="flex gap-2">
                          <button type="button"
                            onClick={() => {
                              const pct = discountDraft.pct.trim() === '' ? 0 : parseInt(discountDraft.pct, 10);
                              if (!Number.isFinite(pct) || pct < 0 || pct > 60) { alert('النسبة من ٠ لـ٦٠.'); return; }
                              if (pct > 0 && discountDraft.from && discountDraft.to && discountDraft.to < discountDraft.from) { alert('تاريخ النهاية قبل البداية.'); return; }
                              if (pct > 0 && !discountDraft.note.trim()) { alert('اكتب مين طلب الخصم — المالك بيتحمّل تمنه ولازم يبقى فيه سجل.'); return; }
                              onSetHouseDiscount({
                                houseId: house.id,
                                pct: pct / 100,
                                startsAt: discountDraft.from || null,
                                endsAt: discountDraft.to || null,
                                note: discountDraft.note.trim() || null,
                              });
                              setDiscountHouseId(null);
                            }}
                            className="flex-1 bg-[#B8944E] hover:bg-[#A5843F] text-white text-[12px] font-bold min-h-11 rounded-xl cursor-pointer">
                            {parseInt(discountDraft.pct, 10) > 0 ? 'فعّل الخصم' : 'شيل الخصم'}
                          </button>
                          <button type="button" onClick={() => setDiscountHouseId(null)}
                            className="bg-[#EBEBE0] hover:bg-[#DEDECB] text-[#4A4A3A] text-[12px] font-bold min-h-11 px-4 rounded-xl cursor-pointer">
                            إلغاء
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Paging. Rows-per-page sits opposite the numbers. */}
          {filteredHouses.length > 0 && (
            <div className="flex items-center justify-between gap-3 pt-1">
              <select
                value={housePerPage}
                onChange={(e) => { setHousePerPage(Number(e.target.value)); setHousePage(1); }}
                aria-label="عدد البيوت في الصفحة"
                className="bg-white border border-[#EBEBE0] rounded-[16px] text-[12px] font-bold min-h-11 px-2.5 text-[#4A4A3A] focus:outline-none focus:border-[#756B42] cursor-pointer"
              >
                {[10, 25, 50].map((n) => (
                  <option key={n} value={n}>{arabicNumber(n)} لكل صفحة</option>
                ))}
              </select>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setHousePage((p) => Math.max(1, p - 1))}
                  disabled={houseSafePage === 1}
                  aria-label="الصفحة السابقة"
                  className="w-11 h-11 flex items-center justify-center rounded-[14px] border border-[#EBEBE0] text-[#4A4A3A] disabled:opacity-30 hover:bg-[#FAF8F5] transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <span className="text-[12px] font-bold text-[#8A8A70] px-2 tabular-nums">
                  {arabicNumber(houseSafePage)} / {arabicNumber(housePageCount)}
                </span>
                <button
                  type="button"
                  onClick={() => setHousePage((p) => Math.min(housePageCount, p + 1))}
                  disabled={houseSafePage === housePageCount}
                  aria-label="الصفحة التالية"
                  className="w-11 h-11 flex items-center justify-center rounded-[14px] border border-[#EBEBE0] text-[#4A4A3A] disabled:opacity-30 hover:bg-[#FAF8F5] transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Reviews moderation — delete spam / abusive reviews */}
      {activeTab === 'reviews' && (
        <div className="space-y-3">
          {/* Review statistics */}
          {reviews.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-3xl border border-[#D6D6C2] p-4 space-y-2">
                <div className="text-[12px] text-[#8A8A70] font-bold">متوسط تقييم المنصة</div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black text-[#4A4A3A]">{arabicDecimal(avgRating)}</span>
                  <div className="flex gap-0.5">
                    {[1,2,3,4,5].map((s) => (
                      <Star key={s} className={`w-4 h-4 ${s <= Math.round(avgRating) ? 'fill-amber-500 text-amber-500' : 'text-[#D6D6C2]'}`} />
                    ))}
                  </div>
                </div>
                <div className="text-[11px] text-[#8A8A70]">{arabicPlural(reviews.length, REVIEW_FORMS)}</div>
              </div>
              <div className="bg-white rounded-3xl border border-[#D6D6C2] p-4 space-y-1.5">
                <div className="text-[12px] text-[#8A8A70] font-bold">توزيع النجوم</div>
                {starDist.map((s) => (
                  <div key={s.star} className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-[#4A4A3A] w-3">{s.star}</span>
                    <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                    <div className="flex-1 h-2 bg-[#EBEBE0]/50 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full" style={{ width: `${reviews.length > 0 ? (s.count / reviews.length) * 100 : 0}%` }} />
                    </div>
                    <span className="text-[11px] text-[#8A8A70] w-6 text-left">{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

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
                        <div className="text-[11px] text-[#8A8A70]">في: {house?.name || rev.houseName || rev.houseId}</div>
                      </div>
                      <span className="flex items-center gap-0.5 text-[12px] font-bold text-amber-600 shrink-0">
                        <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                        {arabicDecimal(rev.overall_rating ?? rev.rating)}
                      </span>
                    </div>
                    {rev.comment && <p className="text-[12px] text-[#4A4A3A] leading-relaxed bg-[#FAF8F5] rounded-xl p-2 border border-[#E7E5DB]">{rev.comment}</p>}
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-[#BCBC9D]">{new Date(rev.createdAt).toLocaleDateString('ar-EG')}</span>
                      <button
                        id={`delete-review-${rev.id}`}
                        onClick={() => { if (confirm('حذف هذه المراجعة نهائياً؟ سيُعاد حساب تقييم البيت تلقائياً.')) onDeleteReview && onDeleteReview(rev.id); }}
                        className="flex items-center gap-1 text-[12px] font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 px-2.5 min-h-11.5 rounded-xl transition-colors cursor-pointer"
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

      {/* Promo banners management (migration 076) — sub-views: list / form / stats */}
      {activeTab === 'announcements' && (
        <div className="space-y-3 mt-4">
          {/* Section header + sub-navigation */}
          <div className="bg-white p-4 rounded-2xl border border-[#D6D6C2] space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-9 h-9 rounded-2xl bg-[#C5A059]/15 flex items-center justify-center shrink-0">
                  <Megaphone className="w-4.5 h-4.5 text-[#C5A059]" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-[13px] font-black text-[#0A2342]">إدارة البانرات</h3>
                  <p className="text-[11px] font-bold text-[#8A8A70]">البنرات الرسمية الظاهرة داخل تطبيق بيما</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { pbResetForm(); setPbView('form'); }}
                className="flex items-center gap-1.5 bg-[#0A2342] hover:bg-[#123E75] text-white text-[12px] font-black px-3.5 min-h-11 rounded-xl shadow-sm transition-all cursor-pointer shrink-0"
              >
                + إنشاء بانر جديد
              </button>
            </div>

            <div className="flex gap-1.5 border-t border-[#EFEBE0] pt-3">
              {([
                ['list', `البانرات (${arabicNumber(promoBanners.length)})`],
                ['form', pbEditingId ? 'تعديل البانر' : 'إنشاء بانر'],
                ['stats', 'الإحصائيات'],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPbView(key)}
                  className={`px-3.5 min-h-11 rounded-xl text-[12px] font-black border transition-all cursor-pointer ${
                    pbView === key
                      ? 'bg-[#5A5A40] text-white border-[#5A5A40] shadow-sm'
                      : 'bg-[#FAF8F5] text-[#5A5A40] border-[#E7E5DB] hover:bg-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {pbView === 'form' && (
          <div className="bg-white p-4 rounded-2xl border border-[#D6D6C2] space-y-2.5">
            <div className="flex items-center justify-between gap-2 text-[#4A4A3A]">
              <h3 className="text-xs font-black">{pbEditingId ? 'تعديل البانر' : 'بانر جديد'}</h3>
              <button type="button" onClick={() => { pbResetForm(); setPbView('list'); }} className="text-[11px] font-bold text-[#8A8A70] hover:text-[#4A4A3A] cursor-pointer shrink-0">
                إلغاء ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <select value={pbPlacement} onChange={(e) => setPbPlacement(e.target.value as 'carousel' | 'countdown')} disabled={!!pbEditingId} className="col-span-2 bg-[#FAF8F5] border border-[#E7E5DB] rounded-xl text-[11px] px-3 min-h-11 text-[#2D2D24] focus:outline-none text-right disabled:opacity-60">
                <option value="carousel">شريحة في الكاروسيل العلوي 🖼️</option>
                <option value="countdown">بانر العدّاد السفلي ⏳</option>
              </select>
              <input value={pbBadge} onChange={(e) => setPbBadge(e.target.value)} placeholder="الشارة (مثال: عرض خاص)" className="bg-[#FAF8F5] border border-[#E7E5DB] rounded-xl text-[11px] px-3 min-h-11 text-right" />
              <input value={pbCta} onChange={(e) => setPbCta(e.target.value)} placeholder="نص الزر (مثال: احجز الآن)" className="bg-[#FAF8F5] border border-[#E7E5DB] rounded-xl text-[11px] px-3 min-h-11 text-right" />
              <input value={pbTitle} onChange={(e) => setPbTitle(e.target.value)} placeholder={pbPlacement === 'countdown' ? 'نص الخصم (مثال: خصم ٢٠٪)' : 'العنوان (مثال: عرض الصيف)'} className="col-span-2 bg-[#FAF8F5] border border-[#E7E5DB] rounded-xl text-[11px] px-3 min-h-11 text-right" />
              {pbPlacement === 'carousel' && (
                <input value={pbSubtitle} onChange={(e) => setPbSubtitle(e.target.value)} placeholder="الوصف (مثال: خصومات تصل ٣٠٪ على الساحل)" className="col-span-2 bg-[#FAF8F5] border border-[#E7E5DB] rounded-xl text-[11px] px-3 min-h-11 text-right" />
              )}
              <div className="col-span-2 space-y-1.5">
                <input value={pbImage} onChange={(e) => setPbImage(e.target.value)} placeholder="رابط الصورة (https://...)" className="w-full bg-[#FAF8F5] border border-[#E7E5DB] rounded-xl text-[11px] px-3 min-h-11 text-right" dir="ltr" />
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-[#8A8A70] shrink-0">أو ارفع صورة:</span>
                  <PhotoPickerButtons idPrefix="promo-banner" folder="banners" onSelect={(url) => setPbImage(url)} className="flex-1" />
                </div>
              </div>
              {pbPlacement === 'countdown' && (
                <label className="col-span-2 text-[12px] font-bold text-[#8A8A70]">ينتهي العرض في:
                  <input type="datetime-local" value={pbEndsAt} onChange={(e) => setPbEndsAt(e.target.value)} className="w-full mt-1 bg-[#FAF8F5] border border-[#E7E5DB] rounded-xl text-[11px] px-3 min-h-11 text-right" />
                </label>
              )}

              {/* Destination: a house inside the app beats any external link */}
              <div className="col-span-2 space-y-1.5 border-t border-[#E7E5DB] pt-2.5">
                <span className="text-[12px] font-black text-[#4A4A3A]">وجهة الزر</span>
                <select value={pbHouseId} onChange={(e) => setPbHouseId(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#E7E5DB] rounded-xl text-[11px] px-3 min-h-11 text-right cursor-pointer">
                  <option value="">بدون — استخدم رابط خارجي</option>
                  {houses.filter((h) => h.status === 'approved').map((h) => (
                    <option key={h.id} value={h.id}>🏠 {h.name}</option>
                  ))}
                </select>
                {pbHouseId ? (
                  <p className="text-[11px] font-bold text-emerald-700">الضغط على الزر هيفتح صفحة البيت جوّه التطبيق.</p>
                ) : (
                  <input value={pbLinkUrl} onChange={(e) => setPbLinkUrl(e.target.value)} placeholder="رابط خارجي (اختياري — مثال: instagram.com/pima_app)" className="w-full bg-[#FAF8F5] border border-[#E7E5DB] rounded-xl text-[11px] px-3 min-h-11 text-right" dir="ltr" />
                )}
              </div>

              {/* Publish state */}
              <div className="col-span-2 space-y-1.5 border-t border-[#E7E5DB] pt-2.5">
                <span className="text-[12px] font-black text-[#4A4A3A]">النشر</span>
                <div className="flex gap-1.5">
                  {([['draft', 'مسودة'], ['published', 'نشر الآن'], ['scheduled', 'جدولة']] as const).map(([v, label]) => (
                    <button key={v} type="button" onClick={() => setPbStatus(v)}
                      className={`flex-1 min-h-11 rounded-xl text-[12px] font-black border transition-all cursor-pointer ${
                        pbStatus === v ? 'bg-[#5A5A40] text-white border-[#5A5A40]' : 'bg-white text-[#5A5A40] border-[#D6D6C2]'
                      }`}>{label}</button>
                  ))}
                </div>
                {pbStatus === 'scheduled' && (
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[11px] font-bold text-[#8A8A70]">يبدأ في:
                      <input type="datetime-local" value={pbStartsAt} onChange={(e) => setPbStartsAt(e.target.value)}
                        className="w-full mt-1 bg-[#FAF8F5] border border-[#E7E5DB] rounded-xl text-[11px] px-2 min-h-11 text-right" />
                    </label>
                    <label className="text-[11px] font-bold text-[#8A8A70]">ينتهي في:
                      <input type="datetime-local" value={pbEndsAt} onChange={(e) => setPbEndsAt(e.target.value)}
                        className="w-full mt-1 bg-[#FAF8F5] border border-[#E7E5DB] rounded-xl text-[11px] px-2 min-h-11 text-right" />
                    </label>
                  </div>
                )}
              </div>

              {/* Audience — empty means everyone, which is what every old banner is */}
              <div className="col-span-2 space-y-2 border-t border-[#E7E5DB] pt-2.5">
                <span className="text-[12px] font-black text-[#4A4A3A]">
                  الجمهور {pbRoles.length + pbGovs.length === 0 && pbBooked === 'any' ? '— الكل' : '— مُستهدف 🎯'}
                </span>
                <div className="flex gap-1.5 flex-wrap">
                  {([['individual', 'أفراد'], ['servant', 'خدام'], ['owner', 'أصحاب بيوت']] as const).map(([r, label]) => (
                    <button key={r} type="button"
                      onClick={() => setPbRoles((p) => p.includes(r) ? p.filter((x) => x !== r) : [...p, r])}
                      className={`px-2.5 min-h-11.5 rounded-xl text-[12px] font-bold border cursor-pointer transition-all ${
                        pbRoles.includes(r) ? 'bg-[#0A2342] text-white border-[#0A2342]' : 'bg-white text-[#5A5A40] border-[#D6D6C2]'
                      }`}>{label}</button>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  {([['any', 'حجز أو لا'], ['yes', 'حجز قبل كده'], ['no', 'لسه ما حجزش']] as const).map(([v, label]) => (
                    <button key={v} type="button" onClick={() => setPbBooked(v)}
                      className={`flex-1 min-h-11.5 rounded-xl text-[11px] font-bold border cursor-pointer transition-all ${
                        pbBooked === v ? 'bg-[#5A5A40] text-white border-[#5A5A40]' : 'bg-white text-[#5A5A40] border-[#D6D6C2]'
                      }`}>{label}</button>
                  ))}
                </div>
                <select value="" onChange={(e) => { if (e.target.value) setPbGovs((p) => p.includes(e.target.value) ? p : [...p, e.target.value]); }}
                  className="w-full bg-[#FAF8F5] border border-[#E7E5DB] rounded-xl text-[12px] px-3 min-h-11 text-right cursor-pointer">
                  <option value="">+ أضف محافظة (اختياري)</option>
                  {GOVERNORATES.filter((g) => !pbGovs.includes(g)).map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
                {pbGovs.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {pbGovs.map((g) => (
                      <button key={g} type="button" onClick={() => setPbGovs((p) => p.filter((x) => x !== g))}
                        className="text-[11px] font-bold bg-[#EBEBE0] text-[#4A4A3A] px-2 min-h-11 rounded-lg cursor-pointer">{g} ✕</button>
                    ))}
                  </div>
                )}
                {(pbRoles.length > 0 || pbGovs.length > 0 || pbBooked !== 'any') && (
                  <p className="text-[11px] font-bold text-amber-700">الزائر غير المسجّل مش هيشوف البانر المُستهدف.</p>
                )}
              </div>

              {/* Split test */}
              <div className="col-span-2 space-y-1.5 border-t border-[#E7E5DB] pt-2.5">
                <span className="text-[12px] font-black text-[#4A4A3A]">تجربة A/B (اختياري)</span>
                <p className="text-[11px] font-bold text-[#8A8A70]">اكتب نفس اسم التجربة في بانرين، والنظام يوزّعهم على الزوار ويقارن نتايجهم.</p>
                <div className="grid grid-cols-3 gap-2">
                  <input value={pbExperiment} onChange={(e) => setPbExperiment(e.target.value)} placeholder="اسم التجربة" className="col-span-2 bg-[#FAF8F5] border border-[#E7E5DB] rounded-xl text-[11px] px-3 min-h-11 text-right" />
                  <input value={pbVariant} onChange={(e) => setPbVariant(e.target.value)} placeholder="أ / ب" className="bg-[#FAF8F5] border border-[#E7E5DB] rounded-xl text-[11px] px-3 min-h-11 text-center" />
                </div>
              </div>

              {/* Icon links shown inside the banner (social accounts, site, phone…) */}
              <div className="col-span-2 space-y-1.5 pt-1 border-t border-[#E7E5DB]">
                <div className="flex items-center justify-between gap-2 pt-1.5">
                  <span className="text-[12px] font-black text-[#4A4A3A]">أيقونات داخل البانر ({arabicNumber(pbLinks.length)})</span>
                  <button
                    type="button"
                    onClick={() => setPbLinks((p) => [...p, { id: `pl_${Date.now()}`, platform: 'instagram', url: '' }])}
                    className="text-[11px] font-bold text-[#5A5A40] border border-[#D6D6C2] hover:bg-[#FAF8F5] px-2 min-h-11 rounded-lg cursor-pointer shrink-0"
                  >
                    + إضافة أيقونة
                  </button>
                </div>
                {pbLinks.length === 0 ? (
                  <p className="text-[11px] text-[#8A8A70] font-bold">مثال: أضف إنستجرام وفيسبوك وواتساب في نفس البانر — كل أيقونة بلينكها.</p>
                ) : (
                  pbLinks.map((l, i) => (
                    <div key={l.id} className="flex items-center gap-1.5">
                      <select
                        value={l.platform}
                        onChange={(e) => setPbLinks((p) => p.map((x, j) => (j === i ? { ...x, platform: e.target.value as PromoLinkPlatform } : x)))}
                        className="bg-[#FAF8F5] border border-[#E7E5DB] rounded-xl text-[12px] px-2 min-h-11 text-[#2D2D24] focus:outline-none shrink-0"
                      >
                        {PROMO_PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                      </select>
                      <input
                        value={l.url}
                        onChange={(e) => setPbLinks((p) => p.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
                        placeholder="الرابط (أو الرقم لواتساب/الاتصال)"
                        className="flex-1 min-w-0 bg-[#FAF8F5] border border-[#E7E5DB] rounded-xl text-[12px] px-2 min-h-11 text-right"
                        dir="ltr"
                      />
                      <button
                        type="button"
                        onClick={() => setPbLinks((p) => p.filter((_, j) => j !== i))}
                        title="حذف الأيقونة"
                        className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Live preview — the very same components the visitors see */}
            {(pbTitle || pbBadge || pbImage || pbLinks.length > 0) && (() => {
              const draft: PromoBanner = {
                id: pbEditingId ?? 'preview',
                placement: pbPlacement,
                isActive: true,
                sort: 0,
                badge: pbBadge || undefined,
                title: pbTitle || undefined,
                subtitle: pbSubtitle || undefined,
                ctaText: pbCta || undefined,
                imageUrl: pbImage || undefined,
                endsAt: pbPlacement === 'countdown' && pbEndsAt ? new Date(pbEndsAt).toISOString() : null,
                createdAt: new Date().toISOString(),
                linkUrl: pbLinkUrl || undefined,
                links: pbLinks.filter((l) => l.url.trim()),
              };
              return (
                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] font-black text-[#8A8A70] flex items-center gap-1"><Eye className="w-3 h-3" /> معاينة (زي ما الزائر هيشوفها)</span>
                  <div className="bg-[#FAF8F5] border border-dashed border-[#D6D6C2] rounded-2xl p-2" dir="rtl">
                    {pbPlacement === 'carousel'
                      ? <SummerOfferCarousel slides={[draft]} />
                      : <CountdownOfferBanner banner={draft} />}
                  </div>
                </div>
              );
            })()}

            <button
              type="button"
              onClick={() => {
                if (!pbTitle && !pbBadge) return;
                if (pbEditingId) {
                  const existing = promoBanners.find((b) => b.id === pbEditingId);
                  if (!existing || !onUpdatePromoBanner) return;
                  onUpdatePromoBanner({
                    ...existing,
                    badge: pbBadge || undefined,
                    title: pbTitle || undefined,
                    subtitle: pbSubtitle || undefined,
                    ctaText: pbCta || undefined,
                    imageUrl: pbImage || undefined,
                    endsAt: existing.placement === 'countdown' && pbEndsAt ? new Date(pbEndsAt).toISOString() : null,
                    linkUrl: pbHouseId ? undefined : (pbLinkUrl || undefined),
                    links: pbLinks.filter((l) => l.url.trim()),
                    linkedHouseId: pbHouseId || null,
                    status: pbStatus,
                    startsAt: pbStatus === 'scheduled' && pbStartsAt ? new Date(pbStartsAt).toISOString() : null,
                    audience: { roles: pbRoles, governorates: pbGovs, booked: pbBooked },
                    experiment: pbExperiment.trim() || null,
                    variant: pbVariant.trim() || null,
                  });
                  pbResetForm();
                  setPbView('list');
                  return;
                }
                if (!onAddPromoBanner) return;
                onAddPromoBanner({
                  id: `pb_${Date.now()}`,
                  placement: pbPlacement,
                  isActive: true,
                  sort: promoBanners.filter((b) => b.placement === pbPlacement).length,
                  badge: pbBadge || undefined,
                  title: pbTitle || undefined,
                  subtitle: pbSubtitle || undefined,
                  ctaText: pbCta || undefined,
                  imageUrl: pbImage || undefined,
                  endsAt: pbPlacement === 'countdown' && pbEndsAt ? new Date(pbEndsAt).toISOString() : null,
                  createdAt: new Date().toISOString(),
                  linkUrl: pbHouseId ? undefined : (pbLinkUrl || undefined),
                  links: pbLinks.filter((l) => l.url.trim()),
                  linkedHouseId: pbHouseId || null,
                  status: pbStatus,
                  startsAt: pbStatus === 'scheduled' && pbStartsAt ? new Date(pbStartsAt).toISOString() : null,
                  audience: { roles: pbRoles, governorates: pbGovs, booked: pbBooked },
                  experiment: pbExperiment.trim() || null,
                  variant: pbVariant.trim() || null,
                });
                pbResetForm();
                setPbView('list');
              }}
              className="w-full bg-[#5A5A40] hover:bg-[#4A4A3A] text-white text-[11px] font-black min-h-11 rounded-xl transition-all cursor-pointer"
            >
              {pbEditingId ? 'حفظ التعديل' : 'إضافة البانر'}
            </button>
          </div>
          )}

          {pbView === 'stats' && <BannerAnalytics banners={promoBanners} />}

          {/* Full-screen banner studio for the selected banner */}
          {(() => {
            const target = promoBanners.find((b) => b.id === pbDesigningId);
            if (!target) return null;
            return (
              <BannerStudio
                banner={target}
                onClose={() => setPbDesigningId(null)}
                onSave={(next) => { onUpdatePromoBanner?.(next); setPbDesigningId(null); }}
              />
            );
          })()}

          {/* Existing banners */}
          {pbView === 'list' && (
          <div className="space-y-2">
            {promoBanners.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-[#D6D6C2] p-8 text-center space-y-2">
                <Megaphone className="w-7 h-7 text-[#C9C5B4] mx-auto" />
                <p className="text-[11px] text-[#8A8A70] font-bold">لا توجد بانرات بعد — سيظهر التصميم الافتراضي للزوار.</p>
                <button type="button" onClick={() => { pbResetForm(); setPbView('form'); }}
                  className="text-[12px] font-black text-[#0A2342] underline cursor-pointer">أنشئ أول بانر</button>
              </div>
            ) : (
              // Sorted by the same key the reorder arrows write, so a move is
              // reflected immediately instead of only after a reload.
              promoBanners
                .slice()
                .sort((x, y) => x.placement.localeCompare(y.placement) || x.sort - y.sort || x.createdAt.localeCompare(y.createdAt))
                .map((b) => {
                const group = promoBanners.filter((x) => x.placement === b.placement);
                const isFirst = group.every((x) => x.id === b.id || x.sort >= b.sort);
                const isLast = group.every((x) => x.id === b.id || x.sort <= b.sort);
                const expired = !!b.endsAt && new Date(b.endsAt).getTime() < Date.now();
                return (
                <div key={b.id} className={`bg-white p-3 rounded-2xl border flex items-center gap-2.5 ${pbEditingId === b.id ? 'border-[#5A5A40] ring-1 ring-[#5A5A40]/30' : 'border-[#D6D6C2]'}`}>
                  {/* Reorder (carousel order matters; harmless for countdown) */}
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button type="button" disabled={isFirst} onClick={() => pbMove(b, -1)} title="لأعلى"
                      className="grid place-items-center w-11 h-11 shrink-0 rounded border border-[#E7E5DB] text-[#5A5A40] hover:bg-[#FAF8F5] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">
                      <ChevronUp className="w-3 h-3" />
                    </button>
                    <button type="button" disabled={isLast} onClick={() => pbMove(b, 1)} title="لأسفل"
                      className="grid place-items-center w-11 h-11 shrink-0 rounded border border-[#E7E5DB] text-[#5A5A40] hover:bg-[#FAF8F5] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Live mini-preview — the designed banner, not just its raw photo */}
                  <div className="w-[104px] h-[52px] rounded-xl overflow-hidden border border-[#E7E5DB] shrink-0 bg-slate-900">
                    {b.layout ? (
                      <BannerCanvas banner={b} layout={b.layout} />
                    ) : b.imageUrl ? (
                      <img src={b.imageUrl} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-[#EBEBE0]/60 flex items-center justify-center">
                        <Megaphone className="w-4 h-4 text-[#BCBC9D]" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[11px] font-black px-2 py-0.5 rounded-full shrink-0 ${b.placement === 'carousel' ? 'bg-sky-100 text-sky-700' : 'bg-amber-100 text-amber-700'}`}>{b.placement === 'carousel' ? 'كاروسيل' : 'عدّاد'}</span>
                      {(() => {
                        const s = bannerStateLabel(b);
                        const tone = s.tone === 'live' ? 'bg-emerald-100 text-emerald-700'
                          : s.tone === 'warn' ? 'bg-amber-100 text-amber-800' : 'bg-[#EBEBE0] text-[#8A8A70]';
                        return <span className={`text-[11px] font-black px-2 py-0.5 rounded-full shrink-0 ${tone}`}>{s.label}</span>;
                      })()}
                      {b.linkedHouseId && <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-[#0A2342]/10 text-[#0A2342] shrink-0">🏠 مرتبط ببيت</span>}
                    </div>
                    <p className="text-[11px] font-black text-[#4A4A3A] truncate mt-0.5">{b.title || b.badge || '—'}</p>
                    {b.subtitle && <p className="text-[11px] text-[#8A8A70] truncate">{b.subtitle}</p>}
                    {b.endsAt && (
                      <p className="text-[11px] font-bold text-[#8A8A70] mt-0.5">
                        ينتهي: {new Date(b.endsAt).toLocaleString('ar-EG', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-stretch gap-1 shrink-0">
                    <button type="button" onClick={() => { pbStartEdit(b); setPbView('form'); }} className="flex items-center justify-center gap-1 text-[11px] font-bold text-[#5A5A40] border border-[#D6D6C2] hover:bg-[#FAF8F5] px-2 min-h-11 rounded-lg cursor-pointer">
                      <Pencil className="w-3 h-3" /> تعديل
                    </button>
                    <button type="button" onClick={() => setPbDesigningId(pbDesigningId === b.id ? null : b.id)}
                      className={`flex items-center justify-center gap-1 text-[11px] font-bold px-2 min-h-11 rounded-lg cursor-pointer border ${
                        pbDesigningId === b.id ? 'bg-[#0A2342] text-white border-[#0A2342]' : 'text-[#0A2342] border-[#0A2342]/30 hover:bg-[#FAF8F5]'
                      }`}>
                      <Wand2 className="w-3 h-3" /> تصميم
                    </button>
                    <button type="button" onClick={() => onTogglePromoBanner?.(b.id, !b.isActive)} className={`text-[11px] font-bold px-2 min-h-11 rounded-lg cursor-pointer ${b.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-[#EBEBE0] text-[#8A8A70]'}`}>{b.isActive ? 'مفعّل' : 'متوقف'}</button>
                    <button type="button"
                      onClick={() => onAddPromoBanner?.({
                        ...b,
                        id: `pb_${Date.now()}`,
                        title: b.title ? `${b.title} (نسخة)` : b.title,
                        // A copy starts as a draft so it can never go live by accident.
                        status: 'draft',
                        sort: promoBanners.filter((x) => x.placement === b.placement).length,
                        createdAt: new Date().toISOString(),
                      })}
                      className="flex items-center justify-center gap-1 text-[11px] font-bold text-[#5A5A40] border border-[#D6D6C2] hover:bg-[#FAF8F5] px-2 min-h-11 rounded-lg cursor-pointer">
                      <Copy className="w-3 h-3" /> نسخة
                    </button>
                    <button type="button" onClick={() => { if (confirm('حذف هذا البانر نهائياً؟')) { if (pbEditingId === b.id) pbResetForm(); onDeletePromoBanner?.(b.id); } }} className="text-[11px] font-bold text-rose-600 hover:bg-rose-50 px-2 min-h-11 rounded-lg cursor-pointer">حذف</button>
                  </div>
                </div>
                );
              })
            )}
          </div>
          )}
        </div>
      )}

      {/* Users Management */}
      {activeTab === 'users' && (
        <div className="space-y-3">
          {/* Search + filter + export */}
          <div className="bg-white p-3 rounded-2xl border border-[#D6D6C2] space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8A8A70]" />
                <input type="text" placeholder="ابحث بالاسم أو الإيميل أو الهاتف أو الكنيسة..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#E7E5DB] rounded-xl text-xs min-h-11 pr-9 pl-3 py-2 text-[#2D2D24] focus:outline-none focus:border-[#464E3D] text-right" />
              </div>
              <button onClick={exportUsers} className="flex items-center gap-1 bg-[#EBEBE0] hover:bg-[#DEDECB] text-[#4A4A3A] text-[12px] font-bold px-3 min-h-11 rounded-xl cursor-pointer shrink-0">
                <Download className="w-3.5 h-3.5" /> تصدير CSV
              </button>
            </div>
            <div className="flex gap-1 overflow-x-auto">
              {([
                { key: 'all' as const, label: `الكل (${arabicNumber(users.length)})` },
                { key: 'individual' as const, label: 'أفراد' },
                { key: 'servant' as const, label: 'خدام' },
                { key: 'owner' as const, label: 'ملّاك' },
                { key: 'admin' as const, label: 'إدارة' },
                { key: 'banned' as const, label: 'محظورين' },
              ]).map((f) => (
                <button key={f.key} onClick={() => setUserRoleFilter(f.key)}
                  className={`text-[12px] font-bold px-2.5 min-h-11 rounded-lg transition-all cursor-pointer whitespace-nowrap ${userRoleFilter === f.key ? 'bg-[#5A5A40] text-white shadow-sm' : 'bg-[#FAF8F5] text-[#8A8A70] border border-[#E7E5DB] hover:bg-[#EBEBE0]/50'}`}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="text-[12px] text-[#8A8A70] px-1 font-bold">{arabicPlural(filteredUsers.length, USER_FORMS)}</div>

          <div className="space-y-2">
            {filteredUsers.map((usr) => (
              <div key={usr.id} className={`bg-white p-3.5 rounded-2xl border text-right ${usr.isBanned ? 'border-rose-200 ring-1 ring-rose-50' : 'border-[#D6D6C2]'}`}>
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[#4A4A3A] flex items-center gap-1.5">
                      {usr.name}
                      {usr.isBanned && <span className="text-[11px] font-black bg-rose-600 text-white px-1.5 py-0.5 rounded">محظور</span>}
                    </div>
                    <div className="text-[12px] text-[#8A8A70] mt-0.5">{usr.email} · {usr.phone}</div>
                    {usr.organizationName && <div className="text-[11px] text-[#5A5A40] font-black mt-0.5">{usr.organizationName}</div>}
                    <div className="text-[11px] text-[#BCBC9D] mt-0.5">
                      تسجيل: {new Date(usr.createdAt).toLocaleDateString('ar-EG')}
                      {usr.points ? ` · ${arabicPlural(usr.points, POINT_FORMS)}` : ''}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${
                      usr.role === 'admin' ? 'bg-red-50 text-red-800 border-red-200' : usr.role === 'owner' ? 'bg-[#EBEBE0] text-[#5A5A40] border-[#BCBC9D]' : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    }`}>
                      {ROLE_LABELS[usr.role] ?? 'فرد'}
                    </span>
                    <button onClick={() => setDetailUserId(usr.id)}
                      className="flex items-center gap-1 min-h-11 px-2 text-[11px] font-bold text-[#5A5A40] hover:bg-[#EBEBE0]/50 px-2 py-1 rounded-lg cursor-pointer border border-[#D6D6C2]">
                      <Eye className="w-3 h-3" /> تفاصيل
                    </button>
                    {usr.role !== 'admin' && (
                      <select value={usr.role} onChange={(e) => onToggleUserRole(usr.id, e.target.value as User['role'])}
                        className="text-[11px] bg-white border border-[#D6D6C2] rounded px-1.5 min-h-11 text-[#4A4A3A] outline-none focus:border-[#5A5A40]">
                        <option value="individual">فرد</option>
                        <option value="servant">خادم كنسي</option>
                        <option value="owner">صاحب بيت</option>
                      </select>
                    )}
                    {usr.role !== 'admin' && (
                      <button onClick={() => { if (usr.isBanned || confirm(`حظر "${usr.name}"؟`)) onBanUser?.(usr.id, !usr.isBanned); }}
                        className={`flex items-center gap-1 min-h-11 text-[11px] font-bold px-2 rounded-lg border cursor-pointer ${usr.isBanned ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
                        <Ban className="w-3 h-3" /> {usr.isBanned ? 'رفع الحظر' : 'حظر'}
                      </button>
                    )}
                    {/* Release, not delete. public.users cascades to bookings
                        and payments, so a real delete would take other guests'
                        records with it — see migration 107. */}
                    {usr.role !== 'admin' && !usr.releasedAt && onReleaseUser && (
                      <button
                        onClick={async () => {
                          if (!confirm(
                            `حذف حساب "${usr.name}" نهائياً؟\n\n`
                            + `• الإيميل (${usr.email}) هيتحرر فوراً ويقدر يسجّل حساب جديد بيه\n`
                            + '• حجوزاته ودفعاته وتقييماته هتفضل زي ما هي باسم «مستخدم محذوف»\n'
                            + '• أي جلسة مفتوحة ليه هتتقفل حالاً\n\n'
                            + 'مش هينفع ترجع في القرار ده.',
                          )) return;
                          setReleasingUserId(usr.id);
                          const ok = await onReleaseUser(usr.id);
                          setReleasingUserId(null);
                          if (ok) alert(`تم حذف الحساب. الإيميل ${usr.email} بقى متاح للتسجيل من جديد.`);
                        }}
                        disabled={releasingUserId === usr.id}
                        className="flex items-center gap-1 min-h-11 text-[11px] font-bold px-2 rounded-lg border border-rose-300 bg-white text-rose-700 hover:bg-rose-50 cursor-pointer disabled:opacity-50">
                        <Trash2 className="w-3 h-3" /> {releasingUserId === usr.id ? 'جاري الحذف…' : 'حذف الحساب'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Booking Reports */}
      {/* ── الماليات ──────────────────────────────────────────────────────
          Money only. This and the audience panel used to be one «التقارير»
          scroll, so a question about revenue and a question about who signs
          up were answered by the same long page and neither was easy to read.

          Every figure comes from src/lib/adminFinance.ts. It used to be
          computed inline here and disagreed with the payout engine next door
          about the same booking — see that file's header for the arithmetic
          and what it was getting wrong. */}
      {activeTab === 'finance' && (
        <div className="space-y-4">

          <div className="px-1">
            <h3 className="text-[16px] font-black text-[#4A4A3A]">الماليات</h3>
            <p className="text-[12px] text-[#8A8A70] mt-0.5">فلوس بيما — اللي حصّلته، اللي ليك منه، واللي لسه لازم يتبعت للملّاك.</p>
          </div>

          {/* Without collection accounts Pima is not in the money path at all,
              and every figure below is legitimately zero. Saying so beats a
              page of zeroes that reads like a bug. */}
          {!platformCollects && (
            <div className="bg-amber-50 border border-amber-200 rounded-[20px] p-3.5 flex gap-2.5 items-start">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <div className="text-[12px] font-black text-amber-900">بيما لسه مالهاش حسابات تحصيل</div>
                <p className="text-[11px] text-amber-800/80 leading-relaxed mt-0.5">
                  الضيف بيدفع لصاحب البيت على طول، فبيما مش ماسكة فلوس ومفيش حاجة تتحوّل. ضيف أرقام إنستاباي وفودافون كاش بتوع بيما من «الإعدادات» علشان التحصيل يشتغل.
                </p>
              </div>
            </div>
          )}

          {/* The period control, and what it selected. Scoped by the date the
              MONEY moved, not by the trip's check-in — a deposit banked today
              for a trip next month is cash in hand today. Dating it to the trip
              and then ending every window at «now» meant it showed up in no
              period at all except «كل الوقت». */}
          <div className="bg-white p-3.5 rounded-[20px] border border-[#EBEBE0] space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-bold text-[#8A8A70]">الفترة (حسب تاريخ الدفع)</span>
              <span className="text-[11px] font-black text-[#0A2342] bg-[#EBEBE0]/60 px-2 py-1 rounded-lg shrink-0">
                {arabicPlural(fin.bookingCount, BOOKING_FORMS)}
              </span>
            </div>
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
                  className={`text-[11px] font-bold px-3 min-h-11 rounded-xl transition-all cursor-pointer ${
                    finPeriod === p.key ? 'bg-[#5A5A40] text-white' : 'bg-[#EBEBE0]/50 text-[#4A4A3A] hover:bg-[#DEDECB]'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {finPeriod === 'custom' && (
              <div className="flex items-center gap-1.5 pt-1">
                <input type="date" value={finFrom} onChange={(e) => setFinFrom(e.target.value)} className="flex-1 bg-white border border-[#D6D6C2] text-[12px] px-2 min-h-11 rounded-lg focus:outline-none" />
                <span className="text-[11px] text-[#8A8A70] shrink-0">إلى</span>
                <input type="date" value={finTo} onChange={(e) => setFinTo(e.target.value)} className="flex-1 bg-white border border-[#D6D6C2] text-[12px] px-2 min-h-11 rounded-lg focus:outline-none" />
              </div>
            )}
          </div>

          {/* ── فلوس بيما ──
              The cash position, in the order the admin cares about it: what
              came in, what is mine, what I still owe, what I have sent. */}
          <div className="px-1 pt-1">
            <span className="text-[11px] font-black text-[#8A8A70]">فلوس بيما</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {([
              { label: 'حصّلته بيما', hint: 'عرابين وصلت لحسابات بيما', value: fin.collectedByPima, Icon: CheckCircle2, tint: 'text-emerald-700', num: 'text-emerald-800' },
              { label: 'عمولة بيما', hint: `${arabicNumber(Math.round(PLATFORM_COMMISSION * 100))}٪ من قيمة الحجز`, value: fin.platformCommission, Icon: Coins, tint: 'text-[#C5A059]', num: 'text-[#0A2342]' },
              { label: 'لسه عندك للملّاك', hint: 'رصيد مستحق — مش رقم الفترة', value: fin.ownersOwed, Icon: Wallet, tint: 'text-amber-600', num: 'text-amber-700' },
              { label: 'حوّلته للملّاك', hint: 'خرج فعلاً من حساباتك', value: fin.ownersPaid, Icon: DollarSign, tint: 'text-[#5A5A40]', num: 'text-[#4A4A3A]' },
            ] as const).map((k) => (
              <div key={k.label} className="bg-white border border-[#EBEBE0] rounded-[20px] p-3.5">
                <k.Icon className={`w-4 h-4 ${k.tint}`} />
                <div className={`text-[20px] font-black leading-tight mt-1.5 tabular-nums ${k.num}`}>
                  {arabicNumber(k.value)}
                  <span className="text-[12px] font-bold text-[#8A8A70]"> ج.م</span>
                </div>
                <div className="text-[11px] font-bold text-[#4A4A3A]">{k.label}</div>
                <div className="text-[11px] text-[#8A8A70] leading-snug">{k.hint}</div>
              </div>
            ))}
          </div>

          {/* Everything that is real money but is NOT Pima's to hold. This used
              to be one card labelled «متبقٍ لم يُحصّل» under a warning triangle
              — a permanent alarm over ~85% of the business, which is by design
              paid in cash at the door and never enters Pima's accounts. */}
          <div className="bg-white rounded-[20px] border border-[#EBEBE0] p-4 space-y-1">
            {([
              { label: 'باقي عند الضيف', hint: 'كاش لصاحب البيت عند الوصول — مش بيعدّي على بيما', value: fin.cashAtDoor, tint: 'text-[#4A4A3A]' },
              ...(fin.collectedByOwnerDirect > 0 ? [{ label: 'اتدفع للمالك مباشرة', hint: 'عربون كاش استلمه صاحب البيت بنفسه', value: fin.collectedByOwnerDirect, tint: 'text-[#4A4A3A]' }] : []),
              ...(fin.collectedOnCancelled > 0 ? [{ label: 'محصّل على حجوزات ملغية', hint: 'فلوس فعلية مستنية قرار استرجاع', value: fin.collectedOnCancelled, tint: 'text-rose-700' }] : []),
              { label: 'قيمة الحجوزات', hint: 'إجمالي سعر الحجوزات اللي اتدفع فيها', value: fin.bookingValue, tint: 'text-[#4A4A3A]' },
            ] as const).map((r) => (
              <div key={r.label} className="flex justify-between items-start gap-3 text-[12px] py-2 border-b border-[#EBEBE0]/60 last:border-0">
                <div className="min-w-0">
                  <div className="font-bold text-[#4A4A3A]">{r.label}</div>
                  <div className="text-[11px] text-[#8A8A70] leading-snug">{r.hint}</div>
                </div>
                <span className={`font-black shrink-0 tabular-nums ${r.tint}`}>{arabicNumber(r.value)} ج.م</span>
              </div>
            ))}
          </div>

          {/* ── الخزنة ──
              payment_method records the KIND of transfer — instapay, vodafone,
              bank — not WHICH account, and Pima has several. Without this
              there is no way to tally the app against each real balance at the
              end of a week, which is the only way to notice a transfer that
              never actually arrived. */}
          {treasury.accounts.length > 0 && (
            <>
              <div className="px-1 pt-1">
                <span className="text-[11px] font-black text-[#8A8A70]">الخزنة</span>
              </div>
              <div className="bg-white rounded-[20px] border border-[#EBEBE0] p-4 space-y-1">
                {treasury.accounts.map((a) => (
                  <div key={a.account} className="flex justify-between items-start gap-3 text-[12px] py-2 border-b border-[#EBEBE0]/60 last:border-0">
                    <div className="min-w-0">
                      <div className="font-bold text-[#4A4A3A] truncate">{a.account}</div>
                      <div className="text-[11px] text-[#8A8A70]">
                        {arabicPlural(a.count, PAYMENT_FORMS)}
                        {a.refunded > 0 && ` · اترجّع ${arabicNumber(a.refunded)}`}
                        {a.paidOut > 0 && ` · خرج للملّاك ${arabicNumber(a.paidOut)}`}
                      </div>
                    </div>
                    <span className="font-black text-[#0A2342] shrink-0 tabular-nums">{arabicNumber(a.net)} ج.م</span>
                  </div>
                ))}
                {treasury.unassignedCount > 0 && (
                  <p className="text-[11px] text-[#8A8A70] leading-relaxed pt-1">
                    {arabicNumber(treasury.unassignedCount)} دفعة مش متسجّل وصلت على أنهي حساب. حدّدها من صفحة الدفعيات علشان المطابقة تظبط.
                  </p>
                )}
              </div>
            </>
          )}

          {/* ── التفاصيل ── */}
          <div className="px-1 pt-1">
            <span className="text-[11px] font-black text-[#8A8A70]">التفاصيل</span>
          </div>

          {/* One row per owner, sorted by who is owed the most so the payment
              backlog is the first thing read. The old table was a 4-column
              grid that gave an Arabic name 75px and cut most real ones in
              half; the name now owns its own line. */}
          <div className="bg-white rounded-[20px] p-4 border border-[#EBEBE0] space-y-1">
            <h3 className="text-[12px] font-black text-[#0A2342] border-b border-[#EBEBE0] pb-2">مستحقات كل صاحب بيت</h3>
            {fin.perOwner.length === 0 ? (
              <p className="text-[12px] text-[#8A8A70] text-center py-3">مفيش فلوس اتحركت في الفترة دي.</p>
            ) : (
              fin.perOwner.map((o) => (
                <div key={o.id} className="py-2.5 border-b border-[#EBEBE0]/60 last:border-0 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] font-black text-[#4A4A3A] truncate">{o.name}</span>
                    {o.owed > 0 ? (
                      <span className="text-[11px] font-black text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg shrink-0 tabular-nums">
                        لسه {arabicNumber(o.owed)} ج.م
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg shrink-0">
                        متسدّد
                      </span>
                    )}
                  </div>
                  <div className="flex gap-3 text-[11px] text-[#8A8A70]">
                    <span>حصّلت <span className="font-bold text-[#4A4A3A] tabular-nums">{arabicNumber(o.collected)}</span></span>
                    <span>عمولتك <span className="font-bold text-[#C5A059] tabular-nums">{arabicNumber(o.commission)}</span></span>
                    <span>حوّلت <span className="font-bold text-[#5A5A40] tabular-nums">{arabicNumber(o.paid)}</span></span>
                  </div>
                </div>
              ))
            )}
          </div>

          {fin.perHouse.length > 0 && (
            <div className="bg-white rounded-[20px] p-4 border border-[#EBEBE0] space-y-2">
              <h3 className="text-[12px] font-black text-[#0A2342] border-b border-[#EBEBE0] pb-2">أكثر البيوت تحصيلاً</h3>
              {fin.perHouse.slice(0, 5).map((h, i) => (
                <div key={h.id} className="flex items-center justify-between gap-2 text-[12px] py-1.5 border-b border-[#EBEBE0]/50 last:border-0">
                  <span className="font-bold text-[#4A4A3A] truncate flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-[#EBEBE0] text-[#5A5A40] text-[11px] font-black flex items-center justify-center shrink-0">{arabicNumber(i + 1)}</span>
                    {h.name}
                  </span>
                  <span className="font-black text-emerald-800 shrink-0 tabular-nums">{arabicNumber(h.amount)} ج.م</span>
                </div>
              ))}
              {fin.perHouse.length > 5 && (
                <p className="text-[11px] text-[#8A8A70]">و{arabicNumber(fin.perHouse.length - 5)} بيت آخر.</p>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={exportFinancials} className="flex-1 flex items-center justify-center gap-1.5 bg-[#EBEBE0] hover:bg-[#DEDECB] text-[#4A4A3A] text-[12px] font-bold min-h-11 rounded-xl cursor-pointer">
              <Download className="w-3.5 h-3.5" /> تصدير المالية CSV
            </button>
            <button onClick={exportBookings} className="flex-1 flex items-center justify-center gap-1.5 bg-[#EBEBE0] hover:bg-[#DEDECB] text-[#4A4A3A] text-[12px] font-bold min-h-11 rounded-xl cursor-pointer">
              <Download className="w-3.5 h-3.5" /> تصدير الحجوزات CSV
            </button>
          </div>
        </div>
      )}

      {/* ── إحصائيات المستخدمين ────────────────────────────────────────────
          Who signs up, and from where.

          Governorate and date of birth are both required at signup, so this
          reports what people entered rather than estimating. There is no
          gender breakdown because gender is not collected for users at all —
          it exists only on Attendee, the people a group leader registers
          onto a booking, which is a different population. Every unrecorded
          value is counted as «غير محدد» rather than dropped: dropping them
          would shrink the denominator and make every share look larger than
          it is. */}
      {activeTab === 'audience' && (
        <div className="space-y-4">

          <div className="px-1">
            <h3 className="text-[16px] font-black text-[#4A4A3A]">إحصائيات المستخدمين</h3>
            <p className="text-[12px] text-[#8A8A70] mt-0.5">مين بيستخدم بيما — أعمارهم ومحافظاتهم، من بيانات التسجيل نفسها.</p>
          </div>

          {(() => {
            // Only a named governorate counts as «the top one». byGovernorate
            // sorts «غير محدد» last, so the first named entry is the answer —
            // and when there is none, saying «—» is honest where reading out
            // «١٠٠٪ من المستخدمين» under a dash would not be.
            const top = demo.govs.find((g) => g.label !== 'غير محدد');
            const named = demo.govs.filter((g) => g.label !== 'غير محدد').length;
            return (
              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-white border border-[#EBEBE0] rounded-[20px] p-3.5">
                  <Users className="w-4 h-4 text-[#0A2342]" />
                  <div className="text-[22px] font-black text-[#4A4A3A] leading-tight mt-1.5 tabular-nums">{arabicNumber(demo.coverage.total)}</div>
                  <div className="text-[11px] font-bold text-[#8A8A70]">إجمالي المستخدمين</div>
                </div>
                <div className="bg-white border border-[#EBEBE0] rounded-[20px] p-3.5">
                  <CalendarDays className="w-4 h-4 text-[#5A5A40]" />
                  <div className="text-[22px] font-black text-[#4A4A3A] leading-tight mt-1.5 tabular-nums">
                    {demo.median === null ? '—' : arabicNumber(demo.median)}
                  </div>
                  <div className="text-[11px] font-bold text-[#8A8A70]">متوسط السن</div>
                  <div className="text-[11px] text-[#8A8A70] leading-snug">من {arabicNumber(demo.coverage.age)} مسجّل تاريخ ميلاده</div>
                </div>
                <div className="bg-white border border-[#EBEBE0] rounded-[20px] p-3.5">
                  <MapPin className="w-4 h-4 text-[#C5A059]" />
                  <div className="text-[16px] font-black text-[#4A4A3A] leading-tight mt-1.5 truncate">{top ? top.label : '—'}</div>
                  <div className="text-[11px] font-bold text-[#8A8A70]">أكتر محافظة</div>
                  <div className="text-[11px] text-[#8A8A70] leading-snug">
                    {top ? `${arabicNumber(top.pct)}٪ من المستخدمين` : 'مفيش محافظات مسجّلة'}
                  </div>
                </div>
                <div className="bg-white border border-[#EBEBE0] rounded-[20px] p-3.5">
                  <Building className="w-4 h-4 text-[#5A5A40]" />
                  <div className="text-[22px] font-black text-[#4A4A3A] leading-tight mt-1.5 tabular-nums">{arabicNumber(named)}</div>
                  <div className="text-[11px] font-bold text-[#8A8A70]">محافظة وصلتها بيما</div>
                </div>
              </div>
            );
          })()}

          <div className="bg-white rounded-[20px] border border-[#EBEBE0] p-4 space-y-2.5">
            <h3 className="text-[12px] font-black text-[#0A2342] border-b border-[#EBEBE0] pb-2">الفئات العمرية</h3>
            {demo.ages.map((s) => (
              <DemoBar key={s.label} label={s.label} count={s.count} pct={s.pct} tint="bg-[#5A5A40]" />
            ))}
          </div>

          <div className="bg-white rounded-[20px] border border-[#EBEBE0] p-4 space-y-2.5">
            <h3 className="text-[12px] font-black text-[#0A2342] border-b border-[#EBEBE0] pb-2">المحافظات</h3>
            {demo.govs.slice(0, 8).map((s) => (
              <DemoBar key={s.label} label={s.label} count={s.count} pct={s.pct} tint="bg-[#0A2342]" />
            ))}
            {demo.govs.length > 8 && (
              <p className="text-[11px] text-[#8A8A70]">و{arabicNumber(demo.govs.length - 8)} محافظة أخرى.</p>
            )}
          </div>

          <div className="bg-white rounded-[20px] p-4 border border-[#EBEBE0] space-y-2.5">
            <h3 className="text-[12px] font-black text-[#0A2342] border-b border-[#EBEBE0] pb-2">أرقام المنصة العامة</h3>
            <div className="space-y-1">
              {([
                { label: 'إجمالي الحسابات المسجلة', value: arabicPlural(totalRegisteredUsers, MEMBER_FORMS), tint: 'text-[#4A4A3A]' },
                { label: 'البيوت المؤكدة والنشطة للجمهور', value: arabicPlural(totalHousesApproved, HOUSE_FORMS), tint: 'text-[#4A4A3A]' },
                { label: 'إجمالي الزوار المسكّنين تلقائياً', value: arabicPlural(allocationsCount, GUEST_FORMS), tint: 'text-[#5A5A40]' },
                { label: 'متوسط الحضور بالرحلة', value: arabicPlural(averageBookingSize, GUEST_FORMS), tint: 'text-[#4A4A3A]' },
                { label: 'الطلبات قيد المراجعة حاليًا', value: `${arabicPlural(pendingHouses.length, HOUSE_FORMS)} معلق`, tint: 'text-amber-700' },
              ] as const).map((r) => (
                <div key={r.label} className="flex justify-between items-center gap-2 text-[12px] py-1.5 border-b border-[#EBEBE0]/60 last:border-0">
                  <span className="text-[#8A8A70]">{r.label}</span>
                  <span className={`font-bold shrink-0 ${r.tint}`}>{r.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── التدقيق ────────────────────────────────────────────────────────
          Empty when the books agree. That is the whole design: the weekly
          question is not «how much did I make» — الماليات answers that — it is
          «is anything wrong, and what». Until now the only way to ask was to
          scroll the payments list newest-first and hope something looked odd.

          Every rule is an invariant of Pima's own model. A generic
          reconciliation report would flag every booking as underpaid, because
          ~85% of every booking value is SUPPOSED to be missing from Pima's
          accounts — it is cash the guest hands the owner at the door. */}
      {activeTab === 'exceptions' && (
        <div className="space-y-4">

          <div className="px-1">
            <h3 className="text-[16px] font-black text-[#4A4A3A]">التدقيق</h3>
            <p className="text-[12px] text-[#8A8A70] mt-0.5">الحاجات اللي المفروض ما تحصلش في فلوس بيما. الصفحة فاضية يبقى كله مظبوط.</p>
          </div>

          {/* Money that belongs to a guest and is still in Pima's hands —
              either the trip was cancelled after the deposit arrived, or the
              guest simply sent more than the booking costs. Both were
              invisible: payment_status has no refunded state, so the money
              stayed counted as collected indefinitely and nothing said it was
              owed back. cancellationPolicy computes what a guest is due, but
              only to render a sentence; nothing persisted it. */}
          {refundQueue.length > 0 && (
            <div className="bg-white rounded-[20px] border border-rose-200 p-4 space-y-2">
              <div className="flex items-center justify-between gap-2 border-b border-[#EBEBE0] pb-2">
                <h3 className="text-[12px] font-black text-rose-800">فلوس محتاجة ترجع للضيوف</h3>
                <span className="text-[11px] font-black text-rose-700 shrink-0 tabular-nums">
                  {arabicNumber(refundQueue.reduce((s, r) => s + r.outstanding, 0))} ج.م
                </span>
              </div>
              {refundQueue.map((r) => (
                <div key={r.paymentId} className="py-2.5 border-b border-[#EBEBE0]/60 last:border-0 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[12px] font-black text-[#4A4A3A] truncate">{r.who}</div>
                      <div className="text-[11px] text-[#8A8A70] truncate">
                        {r.houseName} · {r.reason === 'cancelled' ? 'الحجز اتلغى' : 'دفع زيادة'}
                      </div>
                    </div>
                    <span className="text-[12px] font-black text-rose-700 shrink-0 tabular-nums">
                      {arabicNumber(r.outstanding)} ج.م
                    </span>
                  </div>
                  {r.alreadyRefunded > 0 && (
                    <div className="text-[11px] text-[#8A8A70]">اترجّع منها {arabicNumber(r.alreadyRefunded)} قبل كده.</div>
                  )}
                  {onRecordRefund && (
                    <button
                      type="button"
                      disabled={refundingId === r.paymentId}
                      onClick={async () => {
                        const raw = prompt(`هترجّع كام لـ${r.who}؟\n\nالمستحق ${r.outstanding} ج.م.`, String(r.outstanding));
                        if (raw === null) return;
                        const amount = Number(raw);
                        if (!Number.isFinite(amount) || amount <= 0 || amount > r.outstanding) {
                          alert(`اكتب مبلغ بين ١ و${r.outstanding}.`); return;
                        }
                        const note = prompt('ملاحظة (اختياري) — رقم التحويل مثلاً:') || undefined;
                        setRefundingId(r.paymentId);
                        const ok = await onRecordRefund(r.paymentId, amount + r.alreadyRefunded, note);
                        setRefundingId(null);
                        if (ok) alert('اتسجّل الاسترجاع.');
                      }}
                      className="w-full bg-rose-50 border border-rose-200 hover:bg-rose-100 disabled:opacity-60 text-rose-800 text-[12px] font-bold min-h-11 rounded-xl cursor-pointer"
                    >
                      {refundingId === r.paymentId ? 'بيتسجّل…' : 'سجّل استرجاع'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {openExceptions.length === 0 ? (
            <div className="bg-white rounded-[20px] p-8 border border-[#EBEBE0] text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
              <p className="text-[12px] font-black text-[#4A4A3A]">كل حاجة مظبوطة</p>
              <p className="text-[11px] text-[#8A8A70]">
                اتفحص {arabicPlural(bookings.length, BOOKING_FORMS)} ومفيش ولا حاجة خارجة عن المتوقع.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-white border border-[#EBEBE0] rounded-[20px] p-3.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <div className="text-[22px] font-black text-rose-700 leading-tight mt-1.5 tabular-nums">
                    {arabicNumber(openExceptions.filter((e) => e.severity === 'high').length)}
                  </div>
                  <div className="text-[11px] font-bold text-[#8A8A70]">محتاج تصرّف دلوقتي</div>
                </div>
                <div className="bg-white border border-[#EBEBE0] rounded-[20px] p-3.5">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <div className="text-[22px] font-black text-amber-700 leading-tight mt-1.5 tabular-nums">
                    {arabicNumber(openExceptions.filter((e) => e.severity === 'medium').length)}
                  </div>
                  <div className="text-[11px] font-bold text-[#8A8A70]">محتاج مراجعة</div>
                </div>
              </div>

              <div className="space-y-2.5">
                {openExceptions.map((e) => (
                  <div
                    key={e.id}
                    className={`bg-white rounded-[20px] p-4 border space-y-2 ${
                      e.severity === 'high' ? 'border-rose-200' : 'border-[#EBEBE0]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[12px] font-black text-[#4A4A3A] truncate">{e.who}</div>
                        <div className="text-[11px] text-[#8A8A70] truncate">{e.houseName}</div>
                      </div>
                      <span className={`text-[12px] font-black shrink-0 tabular-nums ${
                        e.severity === 'high' ? 'text-rose-700' : 'text-amber-700'
                      }`}>
                        {arabicNumber(e.amount)} ج.م
                      </span>
                    </div>

                    <p className="text-[12px] text-[#4A4A3A] leading-relaxed">{e.detail}</p>

                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <span className="text-[11px] font-bold text-[#5A5A40]">← {e.action}</span>
                      <div className="flex gap-1.5 shrink-0">
                        {e.bookingId && (
                          <button
                            type="button"
                            onClick={() => { setBookingSearch(e.bookingId!); setBookingFilter('all'); goTo('money', 'bookings'); }}
                            className="text-[11px] font-bold bg-[#EBEBE0] hover:bg-[#DEDECB] text-[#4A4A3A] min-h-11 px-3 rounded-xl cursor-pointer"
                          >
                            افتح الحجز
                          </button>
                        )}
                        {/* Some rows stay true for weeks by design — an
                            overpaid guest is owed a refund and the row is
                            correct until it is paid. Without this the screen
                            could never return to empty, and an alert that is
                            always on is an alert nobody reads. */}
                        <button
                          type="button"
                          onClick={() => dismissException(e.id)}
                          className="text-[11px] font-bold bg-white border border-[#D6D6C2] hover:bg-[#FAF8F5] text-[#8A8A70] min-h-11 px-3 rounded-xl cursor-pointer"
                        >
                          شفته
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {dismissedExceptions.size > 0 && (
            <button
              type="button"
              onClick={() => {
                setDismissedExceptions(new Set());
                try { localStorage.removeItem('pima_admin_dismissed_exceptions'); } catch { /* private mode */ }
              }}
              className="w-full text-[11px] font-bold text-[#8A8A70] hover:text-[#4A4A3A] min-h-11 cursor-pointer"
            >
              رجّع {arabicNumber(dismissedExceptions.size)} حاجة كنت اتجاهلتها
            </button>
          )}
        </div>
      )}

      {/* ── الموسم ─────────────────────────────────────────────────────────
          Pima's whole year is a few weeks of summer, and nothing in the panel
          acted on that. Two things a seasonal business should be doing in
          February: seeing which weeks ahead are still empty, and calling the
          churches that came last year and have not come back. */}
      {activeTab === 'season' && (
        <div className="space-y-4">

          <div className="px-1">
            <h3 className="text-[16px] font-black text-[#4A4A3A]">الموسم</h3>
            <p className="text-[12px] text-[#8A8A70] mt-0.5">الأسابيع اللي لسه فاضية قدّامنا، والكنايس اللي جت السنة اللي فاتت ولسه مرجعتش.</p>
          </div>

          {/* A bed empty on a Friday in August is not deferred to September —
              it is gone. Pricing it is what turns occupancy into a decision. */}
          <div className="bg-[#0A2342] text-white rounded-[20px] p-4 space-y-1">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-[#C5A059]" />
              <span className="text-[11px] font-black text-[#C5A059]">أسرّة فاضية في الـ٨ أسابيع الجاية</span>
            </div>
            <div className="text-[22px] font-black tabular-nums">
              {arabicNumber(occupancy.totalEmptyValue)}<span className="text-[12px] font-bold text-white/70"> ج.م</span>
            </div>
            <div className="text-[11px] text-white/60">
              {arabicNumber(occupancy.totalEmptyBeds)} ليلة سرير مش مباعة — دي فلوس بتتفقد كل أسبوع بيعدّي.
            </div>
          </div>

          <div className="bg-white rounded-[20px] border border-[#EBEBE0] p-4 space-y-2.5">
            <h3 className="text-[12px] font-black text-[#0A2342] border-b border-[#EBEBE0] pb-2">الإشغال أسبوع بأسبوع</h3>
            {occupancy.weeks.map((w) => (
              <div key={w.startISO} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="font-bold text-[#4A4A3A]">{arabicDateRange(w.startISO, w.endISO)}</span>
                  <span className="text-[#8A8A70] tabular-nums shrink-0">
                    {arabicNumber(w.occupancyPct)}٪ · {arabicNumber(w.emptyValue)} ج.م فاضي
                  </span>
                </div>
                <div className="h-2 bg-[#EBEBE0] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${w.occupancyPct >= 70 ? 'bg-emerald-600' : w.occupancyPct >= 35 ? 'bg-[#C5A059]' : 'bg-rose-400'}`}
                    style={{ width: `${Math.min(100, w.occupancyPct)}%` }}
                  />
                </div>
              </div>
            ))}
            {occupancy.weeks.every((w) => w.capacity === 0) && (
              <p className="text-[11px] text-[#8A8A70]">مفيش بيوت معتمدة لسه، فمفيش سعة تتحسب.</p>
            )}
          </div>

          {/* Whether anyone comes back — which nothing in this app measured.
              Every growth figure is arrival-side (new users, new bookings, a
              signup funnel), so «are we keeping churches» had no answer in
              either direction. The renewals list below answers the neighbouring
              question — who is due back — but it windows to ±45 days around one
              anniversary and drops everyone outside it, which is exactly the
              group that vanished. */}
          {cohorts.length > 0 && (
            <div className="bg-white rounded-[20px] border border-[#EBEBE0] p-4 space-y-2.5">
              <h3 className="text-[12px] font-black text-[#0A2342] border-b border-[#EBEBE0] pb-2">
                نسبة الكنايس اللي رجعت السنة اللي بعدها
              </h3>
              {cohorts.map((c) => (
                <div key={c.year} className="flex items-center justify-between gap-2 text-[12px] py-1.5 border-b border-[#EBEBE0]/50 last:border-0">
                  <span className="font-bold text-[#4A4A3A]">
                    جم في {arabicNumber(c.year)}
                    <span className="text-[11px] font-normal text-[#8A8A70]"> · {arabicNumber(c.groups)} مجموعة</span>
                  </span>
                  <span className={`font-black tabular-nums shrink-0 ${c.ratePct >= 50 ? 'text-emerald-800' : c.ratePct >= 25 ? 'text-[#C5A059]' : 'text-rose-700'}`}>
                    {arabicNumber(c.ratePct)}٪ رجعوا
                  </span>
                </div>
              ))}
              <p className="text-[11px] text-[#8A8A70] leading-relaxed">
                الكنيسة بتتحسب بالاسم بعد توحيد طريقة كتابته — «كنيسة مار جرجس» و«مارجرجس» واحدة، وإلا كان أي اختلاف في الكتابة هيتحسب هروب.
              </p>
            </div>
          )}

          {/* The church is the customer, not whichever servant held the phone
              that year — so these are grouped by organisation. */}
          <div className="bg-white rounded-[20px] border border-[#EBEBE0] p-4 space-y-2">
            <div className="flex items-center justify-between gap-2 border-b border-[#EBEBE0] pb-2">
              <h3 className="text-[12px] font-black text-[#0A2342]">جم السنة اللي فاتت ولسه مرجعوش</h3>
              <span className="text-[11px] font-bold text-[#8A8A70] shrink-0">{arabicNumber(renewals.length)}</span>
            </div>
            {renewals.length === 0 ? (
              <p className="text-[12px] text-[#8A8A70] text-center py-3">مفيش حد في نفس التوقيت من السنة اللي فاتت.</p>
            ) : (
              renewals.slice(0, 20).map((r) => {
                const msg = `سلام ونعمة${r.name ? ` يا ${r.name}` : ''}، معاكم بيما. زي ما حجزتوا معانا في "${r.lastHouseName}" السنة اللي فاتت، حابين نطمّنكم إن الحجز للموسم الجديد فتح — والأماكن بتخلص بدري. تحبوا نحجزلكم؟`;
                return (
                  <div key={r.key} className="py-2.5 border-b border-[#EBEBE0]/60 last:border-0 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[12px] font-black text-[#4A4A3A] truncate">{r.name}</div>
                        <div className="text-[11px] text-[#8A8A70] truncate">
                          {r.lastHouseName} · {arabicDate(r.lastCheckIn)}
                        </div>
                      </div>
                      <span className="text-[11px] font-black text-[#0A2342] shrink-0 tabular-nums">
                        {arabicNumber(r.lastTotal)} ج.م
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-[#8A8A70]">{arabicPlural(r.lastGuests, GUEST_FORMS)}</span>
                      {r.phone && (
                        <a
                          href={getWhatsAppLink(r.phone, msg)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold min-h-11 px-3 rounded-xl shrink-0"
                        >
                          <MessageCircle className="w-3.5 h-3.5" /> كلّمهم
                        </a>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            {renewals.length > 20 && (
              <p className="text-[11px] text-[#8A8A70]">و{arabicNumber(renewals.length - 20)} مجموعة تانية.</p>
            )}
          </div>
        </div>
      )}

      {/* Payments Verification Tab */}
      {activeTab === 'payments' && (
        <div className="space-y-4 text-right">
          <div className="flex items-center justify-between border-b border-[#D6D6C2] pb-2">
            <h3 className="text-xs font-bold text-[#4A4A3A]">قائمة الحوالات والدفعيات لإثباتات الحجز:</h3>
            <div className="text-[12px] text-[#8A8A70]">
              بانتظار التحقق: <strong className="text-amber-800">{arabicNumber(payments.filter(p => p.paymentStatus === 'pending').length)}</strong> / إجمالي المعاملات بالمنصة: {arabicNumber(payments.length)}
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
                const proofFetched = pay.id in proofImages;
                const proofImg = proofImages[pay.id];

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
                        <span className="text-[11px] text-[#8A8A70] font-bold">معرف الدفع: #{pay.id.toUpperCase()}</span>
                        <h4 className="text-xs font-extrabold text-[#4A4A3A]">{pay.userName}</h4>
                        {b && <p className="text-[12px] text-[#8A8A70]">لحجز بيت: <strong>{b.houseName}</strong> (حساب #{b.id.toUpperCase()})</p>}
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Status badges */}
                        {pay.paymentStatus === 'approved' && (
                          <span className="text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-full">
                            مقبول ومعتمد ✅
                          </span>
                        )}
                        {pay.paymentStatus === 'rejected' && (
                          <span className="text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200 px-2.5 py-1 rounded-full">
                            مرفوض ومرفوع للمراجعة ❌
                          </span>
                        )}
                        {pay.paymentStatus === 'pending' && (
                          <span className="text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-full animate-pulse">
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
                          <span className="text-[12px] text-[#867E65] font-bold">المبلغ المحول:</span>
                          <span className="text-sm font-black text-emerald-800">{arabicNumber(pay.amount)} ج.م</span>
                        </div>

                        {/* Method with custom local Egyptian descriptors */}
                        <div className="flex items-center justify-between py-1 border-b border-dashed border-[#E7E5DB]">
                          <span className="text-[12px] text-[#867E65] font-bold">وسيلة الدفع المستخدمة:</span>
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
                          <div className="font-extrabold text-[#464E3D] text-[12px] mb-1">بيانات وتفاصيل المعاملة المصرحة:</div>
                          
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
                          {/* Was printing the raw column — "2026-08-05T18:06:42.612+00:00"
                              — on the screen where money gets approved. */}
                          <div className="text-[12px] text-[#867E65] pt-1">تاريخ تقديم الإيصال: {arabicDateTime(pay.paymentDate)}</div>
                        </div>

                        {/* Admin Notes form */}
                        <div className="space-y-1">
                          <label className="block text-[12px] font-bold text-[#867E65]">ملاحظات مراجعة الإدارة والرد على الحجز:</label>
                          <input
                            id={`admin-payment-notes-input-${pay.id}`}
                            type="text"
                            placeholder="اكتب ردك هنا (مثال: تم مطابقة إيصال فودافون كاش مع المحفظة)"
                            value={notesInputs[pay.id] || pay.adminNotes || ''}
                            onChange={(e) => setNotesInputs({ ...notesInputs, [pay.id]: e.target.value })}
                            className="w-full bg-[#FAF8F5] border border-[#E7E5DB] rounded-xl text-xs px-3 min-h-11 text-[#2D2D24] focus:outline-none focus:border-[#464E3D]"
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
                              className="flex-1 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-800 text-xs font-bold min-h-11 px-3 rounded-xl transition-colors cursor-pointer text-center"
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
                              className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-extrabold min-h-11 px-3 rounded-xl transition-all cursor-pointer text-center shadow-sm"
                            >
                              اعتماد الدفعة والموافقة تلقائياً ✓
                            </button>
                          </div>
                        )}

                        {/* A decided payment had no controls at all, so a
                            mis-tap on «اعتماد» was permanent from the panel.
                            The commonest real case is not a slip but the bank:
                            the proof is approved and the transfer never lands.
                            The only recovery available was cancelling the whole
                            booking — which destroys a trip that may be perfectly
                            good and still leaves the payment marked approved.

                            This returns the payment to the queue. It does NOT
                            touch the booking's own status: undoing a payment
                            decision is not the same as cancelling the trip. The
                            database has been ready for this all along — migration
                            091 stamps previous_status, reviewed_at and reviewed_by
                            on every status change, so the reversal is recorded. */}
                        {/* Which of Pima's accounts this landed in.
                            The whole chain for this shipped earlier today —
                            the column, the RPC, the handler, the prop — and
                            the control itself was never built, so every
                            payment stayed «غير محدد» and الخزنة could only
                            ever show one meaningless row. Worse, the treasury
                            card tells the admin to come and tag payments
                            here, which was a dead end every week. */}
                        {pay.paymentStatus === 'approved' && onSetPaymentAccount && (settings.paymentMethods ?? []).length > 0 && (
                          <div className="pt-2">
                            <label className="block text-[11px] font-bold text-[#8A8A70] mb-1">وصلت على أنهي حساب؟</label>
                            <select
                              value={pay.receivedAccount ?? ''}
                              onChange={(e) => onSetPaymentAccount(pay.id, e.target.value)}
                              className={`w-full bg-white border text-[12px] px-2 min-h-11 rounded-xl focus:outline-none cursor-pointer ${
                                pay.receivedAccount ? 'border-[#D6D6C2] text-[#4A4A3A]' : 'border-amber-300 text-amber-800 bg-amber-50'
                              }`}
                            >
                              <option value="">— لسه محدّدش —</option>
                              {(settings.paymentMethods ?? []).map((pm) => (
                                <option key={pm.id} value={`${pm.label} · ${pm.value}`}>{pm.label} · {pm.value}</option>
                              ))}
                            </select>
                          </div>
                        )}

                        {!isPending && onVerifyPayment && (
                          <div className="pt-2">
                            <button
                              id={`admin-payment-reopen-btn-${pay.id}`}
                              type="button"
                              onClick={() => {
                                if (!confirm('هترجّع الإيصال ده لقائمة المراجعة تاني.\n\nالفلوس مش هتتحسب محصّلة لحد ما تراجعه، والحجز هيفضل زي ما هو. تمام؟')) return;
                                onVerifyPayment(pay.id, 'pending', notesInputs[pay.id]);
                              }}
                              className="w-full bg-[#EBEBE0] hover:bg-[#DEDECB] text-[#4A4A3A] text-[12px] font-bold min-h-11 px-3 rounded-xl transition-colors cursor-pointer text-center"
                            >
                              تراجع — رجّع الإيصال للمراجعة
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Right side: Proof Image display */}
                      <div className="flex flex-col items-center justify-center p-3 bg-[#FAF8F5] border border-[#E7E5DB] rounded-2xl relative">
                        <span className="text-[12px] font-bold text-[#867E65] mb-2">إثبات التحويل المرفق:</span>
                        {proofImg ? (
                          <div className="space-y-2 text-center">
                            <img
                              src={proofImg}
                              alt="إثبات الدفع"
                              referrerPolicy="no-referrer"
                              onClick={() => setSelectedProofImage(proofImg)}
                              className="max-h-44 max-w-full rounded-lg border border-[#E7E5DB] object-contain shadow-sm cursor-zoom-in hover:brightness-95 transition-all"
                            />
                            <button
                              id={`admin-zoom-btn-${pay.id}`}
                              type="button"
                              onClick={() => setSelectedProofImage(proofImg)}
                              className="text-[11px] text-[#464E3D] hover:underline font-bold"
                            >
                              🔍 اضغط لتكبير الصورة لرؤية التفاصيل بدقة
                            </button>
                          </div>
                        ) : !proofFetched ? (
                          <div className="text-center p-6 text-[#867E65]">
                            <Clock className="w-6 h-6 text-[#BCBC9D] mx-auto mb-1 animate-pulse" />
                            <p className="text-[12px] font-bold">جارٍ تحميل الصورة...</p>
                          </div>
                        ) : (
                          <div className="text-center p-6 text-[#867E65]">
                            <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-1" />
                            <p className="text-[12px] font-bold">لا يوجد لقطة شاشة مرفقة</p>
                            <p className="text-[11px] mt-0.5">الدفع تم نقداً أو بطرق لا تستدعي صورة، أو تم الدفع المباشر بالكامل.</p>
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

      {/* Owner payout requests */}
      {activeTab === 'payouts' && (() => {
        const PAYOUT_META: Record<Payout['status'], { label: string; cls: string }> = {
          pending: { label: 'قيد المراجعة', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
          processing: { label: 'جارٍ التحويل', cls: 'bg-sky-50 text-sky-800 border-sky-200' },
          completed: { label: 'تم التحويل', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
          rejected: { label: 'مرفوض', cls: 'bg-rose-50 text-rose-800 border-rose-200' },
        };
        const pendingTotal = payouts.filter((p) => p.status === 'pending' || p.status === 'processing').reduce((s, p) => s + p.amount, 0);
        // Per-booking owner shares that Pima holds and hasn't transferred yet
        // (deposit received, not cancelled/rejected, not already settled).
        // Grouped by house so the admin can transfer each booking separately
        // or all of a house's bookings in one payment.
        const ownerShare = (b: Booking) => ownerShareOf(b, settings.commissionRate);
        // Only transfer money the PLATFORM actually holds. In owner-direct mode
        // (no platform payment numbers) the platform never received the deposit;
        // and a cash-at-house deposit was handed to the owner. Prompting a payout
        // for either would pay the owner money Pima never collected.
        const platformCollects = (settings.paymentMethods ?? []).length > 0;
        const owedBookings = bookings.filter((b) => {
          if (!platformCollects) return false;
          const approvedPay = payments.find((p) => p.bookingId === b.id && p.paymentStatus === 'approved');
          if (approvedPay && approvedPay.paymentMethod === 'cash') return false;
          return (b.paymentStatus === 'paid_deposit' || b.paymentStatus === 'paid_full' || b.depositPaid) &&
            b.status !== 'cancelled' && b.status !== 'rejected' && !b.ownerSettledAt && ownerShare(b) > 0;
        });
        // An owner's own payout REQUEST names a house and an amount, never a
        // booking — so completing one settled nothing, the bookings that funded
        // it stayed here looking unpaid, and the admin could send the same
        // money a second time. Net them off before listing.
        const { remaining: unclaimedOwed, coveredAmount: alreadyClaimed } = unclaimedOwedBookings({
          owed: owedBookings, allBookings: bookings, payouts, commissionRate: settings.commissionRate,
        });
        const owedByHouse = unclaimedOwed.reduce<Record<string, Booking[]>>((acc, b) => {
          (acc[b.houseId] ??= []).push(b); return acc;
        }, {});
        const owedHouseIds = Object.keys(owedByHouse);

        // «تم التحويل» was a bare confirm(): it recorded a click and a
        // timestamp the app generated itself. Pima captures a sender handle, a
        // reference and a photographed receipt on every payment IN, and
        // captured nothing at all on the way OUT — so six months later an
        // owner disputing a payment has a real transfer with a real reference,
        // and Pima has a checkbox.
        const askTransfer = (what: string, amount: number): { reference: string; account: string } | null => {
          const reference = prompt(`${what}\n\nالمبلغ: ${arabicNumber(amount)} ج.م.\n\nاكتب رقم عملية التحويل — ده اللي هيرد على صاحب البيت لو سأل بعدين:`);
          if (reference === null) return null;
          if (!reference.trim()) { alert('لازم رقم العملية. من غيره التحويل مالوش أثر.'); return null; }
          const accounts = settings.paymentMethods ?? [];
          if (accounts.length === 0) return { reference: reference.trim(), account: '' };
          if (accounts.length === 1) return { reference: reference.trim(), account: `${accounts[0].label} · ${accounts[0].value}` };
          const pickedRaw = prompt(`اتحوّل من أنهي حساب؟\n\n${accounts.map((a, i) => `${i + 1}. ${a.label} · ${a.value}`).join('\n')}\n\nاكتب الرقم:`) || '';
          const picked = accounts[Number(pickedRaw) - 1];
          return { reference: reference.trim(), account: picked ? `${picked.label} · ${picked.value}` : '' };
        };

        return (
          <div className="space-y-4 text-right">
            {onSettleBookings && (
              <div className="space-y-2">
                <div className="flex items-center justify-between border-b border-[#D6D6C2] pb-2">
                  <h3 className="text-xs font-bold text-[#4A4A3A]">مستحقات جاهزة للتحويل (لكل حجز):</h3>
                  <div className="text-[12px] text-[#8A8A70]">{arabicPlural(unclaimedOwed.length, BOOKING_FORMS)}</div>
                </div>
                {/* Say what was netted off, rather than silently showing a
                    shorter list than the money would suggest. */}
                {alreadyClaimed > 0 && (
                  <p className="text-[11px] text-[#8A8A70] leading-relaxed">
                    اتخصم {arabicNumber(alreadyClaimed)} ج.م اتحوّلت خلاص عن طريق طلبات التحويل تحت، علشان الحجوزات دي متتدفعش مرتين.
                  </p>
                )}
                {owedHouseIds.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-[#D6D6C2] p-6 text-center text-xs text-[#8A8A70]">لا توجد مستحقات غير محوّلة حالياً.</div>
                ) : owedHouseIds.map((hid) => {
                  const house = houses.find((h) => h.id === hid);
                  const list = owedByHouse[hid];
                  const ownerId = house?.ownerId || '';
                  const ownerName = users.find((u) => u.id === ownerId)?.name || '—';
                  const total = list.reduce((s, b) => s + ownerShare(b), 0);
                  const methods = house?.paymentMethods ?? [];
                  return (
                    <div key={hid} className="bg-white rounded-2xl border border-[#D6D6C2] p-3.5 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-xs font-black text-[#4A4A3A] min-w-0">{ownerName} · <span className="font-bold text-[#8A8A70]">{house?.name || '—'}</span></div>
                        <div className="text-xs font-black text-[#5A5A40] shrink-0">{arabicNumber(total)} ج.م</div>
                      </div>
                      {methods.length > 0 ? (
                        <div className="bg-[#FBFBFA] border border-[#EBEBE0] rounded-xl p-2 space-y-1">
                          <div className="text-[11px] font-black text-[#8A8A70]">حوّل إلى:</div>
                          {methods.map((m) => (
                            <div key={m.id} className="flex items-center justify-between gap-2 text-[12px]">
                              <span className="font-bold text-[#4A4A3A] shrink-0">{m.label}</span>
                              <span dir="ltr" className="font-mono font-black text-[#5A5A40] select-all break-all">{m.value}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-[11px] text-rose-600 font-bold">⚠️ لا توجد وسيلة تحويل مسجّلة لهذا البيت.</div>
                      )}
                      <div className="space-y-1.5">
                        {list.map((b) => (
                          <div key={b.id} className="flex items-center justify-between gap-2 bg-[#FBFBFA] rounded-xl px-2.5 py-1.5">
                            <div className="min-w-0">
                              <div className="text-[11px] font-bold text-[#4A4A3A] truncate">{b.userName}</div>
                              <div className="text-[11px] text-[#8A8A70] font-bold">{arabicDateRange(b.checkIn, b.checkOut)}</div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[11px] font-black text-[#5A5A40]">{arabicNumber(ownerShare(b))} ج.م</span>
                              <button type="button"
                                onClick={() => { const t = askTransfer(`تحويل لـ${ownerName} عن حجز ${b.userName}`, ownerShare(b)); if (t) onSettleBookings({ houseId: hid, ownerId, amount: ownerShare(b), bookingIds: [b.id], note: `حجز ${b.userName}`, transactionReference: t.reference, paidFromAccount: t.account }); }}
                                className="text-[12px] font-bold bg-emerald-600 text-white px-2.5 min-h-11.5 rounded-lg cursor-pointer">حوّل ✓</button>
                            </div>
                          </div>
                        ))}
                      </div>
                      {list.length > 1 && (
                        <button type="button"
                          onClick={() => { const t = askTransfer(`تحويل لـ${ownerName} — ${arabicPlural(list.length, BOOKING_FORMS)} دفعة واحدة`, total); if (t) onSettleBookings({ houseId: hid, ownerId, amount: total, bookingIds: list.map((b) => b.id), note: `${arabicPlural(list.length, BOOKING_FORMS)} دفعة واحدة`, transactionReference: t.reference, paidFromAccount: t.account }); }}
                          className="w-full text-[11px] font-black bg-[#3A6B4C] hover:bg-[#2D5A3F] text-white min-h-11 rounded-xl cursor-pointer transition-colors">حوّل الكل دفعة واحدة ({arabicNumber(total)} ج.م) ✓</button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex items-center justify-between border-b border-[#D6D6C2] pb-2">
              <h3 className="text-xs font-bold text-[#4A4A3A]">طلبات تحويل أصحاب البيوت + السجل:</h3>
              <div className="text-[12px] text-[#8A8A70]">قيد التنفيذ: <strong className="text-amber-800">{arabicNumber(pendingTotal)} ج.م</strong></div>
            </div>
            {payouts.length === 0 ? (
              <div className="bg-white rounded-2xl border border-[#D6D6C2] p-8 text-center text-xs text-[#8A8A70]">لا توجد طلبات تحويل بعد.</div>
            ) : (
              <div className="space-y-2">
                {payouts.map((p) => {
                  const meta = PAYOUT_META[p.status];
                  const ownerName = users.find((u) => u.id === p.ownerId)?.name || '—';
                  const houseName = houses.find((h) => h.id === p.houseId)?.name || '—';
                  const open = p.status === 'pending' || p.status === 'processing';
                  return (
                    <div key={p.id} className="bg-white rounded-2xl border border-[#D6D6C2] p-3.5 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-black text-[#4A4A3A]">{ownerName} · <span className="font-bold text-[#8A8A70]">{houseName}</span></div>
                          <div className="text-[11px] text-[#8A8A70] font-bold">{(p.completedAt ?? p.requestedAt).split('T')[0]}{p.note ? ` · ${p.note}` : ''}</div>
                        </div>
                        <span className={`shrink-0 text-[11px] font-black px-2 py-1 rounded-full border ${meta.cls}`}>{meta.label}</span>
                      </div>
                      {open && (() => {
                        const methods = houses.find((h) => h.id === p.houseId)?.paymentMethods ?? [];
                        return methods.length > 0 ? (
                          <div className="bg-[#FBFBFA] border border-[#EBEBE0] rounded-xl p-2 space-y-1">
                            <div className="text-[11px] font-black text-[#8A8A70]">حوّل إلى:</div>
                            {methods.map((m) => (
                              <div key={m.id} className="flex items-center justify-between gap-2 text-[12px]">
                                <span className="font-bold text-[#4A4A3A] shrink-0">{m.label}</span>
                                <span dir="ltr" className="font-mono font-black text-[#5A5A40] select-all break-all">{m.value}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-[11px] text-rose-600 font-bold">⚠️ لا توجد وسيلة تحويل مسجّلة لهذا البيت — راسِل صاحبه.</div>
                        );
                      })()}
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-base font-black text-[#5A5A40]">{arabicNumber(p.amount)} ج.م</div>
                        {open && onUpdatePayoutStatus && (
                          <div className="flex gap-1.5">
                            {p.status === 'pending' && (
                              <button type="button" onClick={() => onUpdatePayoutStatus(p.id, 'processing')}
                                className="text-[12px] font-bold bg-sky-50 text-sky-800 border border-sky-200 px-2.5 min-h-11.5 rounded-lg cursor-pointer">بدء التحويل</button>
                            )}
                            <button type="button" onClick={() => { if (confirm(`تأكيد تحويل ${arabicNumber(p.amount)} ج.م لـ${ownerName}؟`)) onUpdatePayoutStatus(p.id, 'completed'); }}
                              className="text-[12px] font-bold bg-emerald-600 text-white px-2.5 min-h-11.5 rounded-lg cursor-pointer">تم التحويل ✓</button>
                            <button type="button" onClick={() => { if (confirm('رفض طلب التحويل؟')) onUpdatePayoutStatus(p.id, 'rejected'); }}
                              className="text-[12px] font-bold bg-white text-rose-700 border border-rose-200 px-2.5 min-h-11.5 rounded-lg cursor-pointer">رفض</button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* Bookings Management Tab */}
      {activeTab === 'bookings' && (
        <div className="space-y-4 text-right">
          <div className="flex items-center justify-between border-b border-[#D6D6C2] pb-2">
            <h3 className="text-xs font-bold text-[#4A4A3A]">إدارة حجوزات المنصة والتحصيل:</h3>
            <div className="text-[12px] text-[#8A8A70]">
              المعلقة أو غير مكتملة السداد: <strong className="text-amber-800">{arabicNumber(pendingOrUnpaidBookingsCount)}</strong> / إجمالي الحجوزات: {arabicNumber(bookings.length)}
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-2 bg-white p-3 rounded-2xl border border-[#D6D6C2] shadow-sm text-right">
            <input
              type="text"
              placeholder="ابحث باسم المستخدم، اسم البيت، أو رقم الحجز..."
              value={bookingSearch}
              onChange={(e) => setBookingSearch(e.target.value)}
              className="flex-1 bg-[#FAF8F5] border border-[#E7E5DB] rounded-xl text-xs px-3 min-h-11 text-[#2D2D24] focus:outline-none focus:border-[#464E3D] text-right"
            />
            <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0">
              {(['all', 'soon', 'pending', 'unpaid', 'temporary', 'completed'] as const).map((filterOpt) => (
                <button
                  key={filterOpt}
                  type="button"
                  onClick={() => setBookingFilter(filterOpt)}
                  className={`text-[12px] font-bold px-2.5 min-h-11 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    bookingFilter === filterOpt
                      ? 'bg-[#5A5A40] text-white shadow-sm'
                      : 'bg-[#FAF8F5] text-[#8A8A70] border border-[#E7E5DB] hover:bg-[#EBEBE0]/50'
                  }`}
                >
                  {filterOpt === 'all' && 'الكل'}
                  {filterOpt === 'pending' && 'بانتظار الموافقة'}
                  {filterOpt === 'unpaid' && 'متبقي مستحقات'}
                  {filterOpt === 'soon' && 'وصول قريب'}
                  {filterOpt === 'temporary' && 'حجوزات مؤقتة'}
                  {filterOpt === 'completed' && 'مدفوع بالكامل'}
                </button>
              ))}
            </div>
          </div>

          {/* Bookings list */}
          {sortedBookings.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 border border-[#D6D6C2] text-center space-y-2">
              <Clock className="w-8 h-8 text-[#BCBC9D] mx-auto animate-pulse" />
              <p className="text-sm font-bold text-[#4A4A3A]">لا توجد حجوزات مطابقة للبحث أو التصفية</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedBookings.map((booking) => {
                const bPayments = payments.filter((p) => p.bookingId === booking.id && p.paymentStatus === 'approved');
                const totalPaid = bPayments.reduce((sum, p) => sum + p.amount, 0);
                const remaining = booking.totalPrice - totalPaid;

                const msgText = `سلام ونعمة يا أستاذ/أستاذة ${booking.userName}، نود تذكيركم بحجزكم في بيت "${booking.houseName}" المقرّر بدئه يوم ${arabicDate(booking.checkIn)} (عدد ${arabicPlural(booking.guestsCount, GUEST_FORMS)}).
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
                        <span className="text-[11px] text-[#8A8A70] font-bold">رقم الحجز: #{booking.id.toUpperCase()}</span>
                        <h4 className="text-xs font-extrabold text-[#4A4A3A] flex items-center gap-1.5 flex-wrap">
                          {booking.userName}
                          {/* A hold blocks real beds. Nothing anywhere expires
                              one, and the panel never showed which bookings
                              were holds or how old any booking was — so a
                              forgotten hold killed inventory in silence. */}
                          {booking.source === 'temporary' && (
                            <span className="text-[11px] font-bold text-sky-800 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded-md">
                              مؤقت ⏳ {booking.createdAt ? `· ${timeAgo(booking.createdAt)}` : ''}
                            </span>
                          )}
                          {booking.source === 'manual' && (
                            <span className="text-[11px] font-bold text-[#5A5A40] bg-[#EBEBE0]/70 border border-[#D6D6C2] px-1.5 py-0.5 rounded-md">
                              سجّله المالك
                            </span>
                          )}
                        </h4>
                        <p className="text-[12px] text-[#8A8A70]">الهاتف: <strong className="font-mono text-[11px] text-[#4A4A3A]">{booking.userPhone}</strong></p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {booking.status === 'pending' && (
                          <span className="text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-full animate-pulse">
                            قيد الموافقة ⏳
                          </span>
                        )}
                        {booking.status === 'approved' && (
                          <span className="text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-full">
                            مقبول ومعتمد ✓
                          </span>
                        )}
                        {booking.status === 'rejected' && (
                          <span className="text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200 px-2.5 py-1 rounded-full">
                            مرفوض ✕
                          </span>
                        )}
                        {booking.status === 'cancelled' && (
                          <span className="text-[11px] font-bold bg-slate-50 text-slate-600 border border-slate-200 px-2.5 py-1 rounded-full">
                            ملغى من المستخدم
                          </span>
                        )}

                        {remaining > 0 ? (
                          <span className="text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200 px-2.5 py-1 rounded-full">
                            متبقي: {remaining.toLocaleString('ar-EG')} ج.م ⚠️
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-full">
                            مدفوع بالكامل ✅
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-3 text-right">
                        <div className="space-y-1">
                          <div className="text-[12px] text-[#8A8A70] font-bold">بيت الخلوة:</div>
                          <div className="text-xs font-black text-[#4A4A3A]">{booking.houseName}</div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-[12px] text-[#8A8A70] font-bold">تاريخ الدخول والمدة:</div>
                          <div className="text-xs font-black text-[#4A4A3A] flex items-center gap-1 justify-end">
                            <Calendar className="w-3.5 h-3.5 text-[#8A8A70]" />
                            <span>{arabicDateRange(booking.checkIn, booking.checkOut)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-[#FAF8F5] p-3 rounded-2xl border border-[#E7E5DB] text-[11px] grid grid-cols-3 gap-2 text-center text-[#4A4A3A] font-bold">
                        <div>
                          <div className="text-[11px] text-[#8A8A70] mb-0.5">القيمة الإجمالية</div>
                          <div className="text-emerald-800">{booking.totalPrice.toLocaleString('ar-EG')} ج.م</div>
                        </div>
                        <div>
                          <div className="text-[11px] text-[#8A8A70] mb-0.5">المسدد المقرّ</div>
                          <div className="text-blue-800">{totalPaid.toLocaleString('ar-EG')} ج.م</div>
                        </div>
                        <div>
                          <div className="text-[11px] text-[#8A8A70] mb-0.5">المتبقي المستحق</div>
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
                          <span>واتساب</span>
                        </a>
                        <button onClick={() => { setChatBookingId(booking.id); goTo('people', 'messages'); }}
                          className="flex items-center gap-1 bg-[#EBEBE0] hover:bg-[#DEDECB] text-[#4A4A3A] text-xs font-bold min-h-11 px-3 rounded-xl transition-all cursor-pointer">
                          <MessageSquareDashed className="w-3.5 h-3.5" /> الشات
                        </button>
                        {booking.status !== 'rejected' && booking.status !== 'completed' && booking.status !== 'cancelled' && (
                          <button
                            id={`admin-cancel-booking-${booking.id}`}
                            onClick={() => { if (confirm(`إلغاء حجز "${booking.userName}" في "${booking.houseName}" نهائياً؟`)) onCancelBooking && onCancelBooking(booking.id); }}
                            className="shrink-0 flex items-center gap-1 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-800 text-xs font-bold min-h-11 px-3 rounded-xl transition-all cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>إلغاء الحجز</span>
                          </button>
                        )}
                      </div>

                      {/* Shifting a date or adding five people was owner-only,
                          while the «تواصل معنا» number the group calls is
                          Pima's. So the admin took the call and then had to ask
                          the owner to make the change. The handler behind this
                          is the owner's own — it checks capacity and re-runs
                          the room allocation, so an edit here cannot overbook. */}
                      {onUpdateBookingDetails && booking.status !== 'cancelled' && booking.status !== 'rejected' && (
                        editBookingId === booking.id ? (
                          <div className="bg-[#FAF8F5] border border-[#E7E5DB] rounded-2xl p-3 space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <label className="space-y-1">
                                <span className="text-[11px] font-bold text-[#8A8A70]">الدخول</span>
                                <input type="date" value={bookingEdit.checkIn} onChange={(e) => setBookingEdit((d) => ({ ...d, checkIn: e.target.value }))}
                                  className="w-full bg-white border border-[#D6D6C2] text-[12px] px-2 min-h-11 rounded-lg focus:outline-none" />
                              </label>
                              <label className="space-y-1">
                                <span className="text-[11px] font-bold text-[#8A8A70]">الخروج</span>
                                <input type="date" value={bookingEdit.checkOut} onChange={(e) => setBookingEdit((d) => ({ ...d, checkOut: e.target.value }))}
                                  className="w-full bg-white border border-[#D6D6C2] text-[12px] px-2 min-h-11 rounded-lg focus:outline-none" />
                              </label>
                            </div>
                            <label className="space-y-1 block">
                              <span className="text-[11px] font-bold text-[#8A8A70]">عدد الأفراد</span>
                              <input type="number" min={1} value={bookingEdit.guestsCount} onChange={(e) => setBookingEdit((d) => ({ ...d, guestsCount: e.target.value }))}
                                className="w-full bg-white border border-[#D6D6C2] text-[12px] px-2 min-h-11 rounded-lg focus:outline-none" />
                            </label>
                            <div className="flex gap-2">
                              <button type="button" disabled={editSaving}
                                onClick={async () => {
                                  const guests = parseInt(bookingEdit.guestsCount, 10);
                                  if (!bookingEdit.checkIn || !bookingEdit.checkOut || !Number.isFinite(guests) || guests < 1) { alert('اكتب تواريخ صحيحة وعدد أفراد أكبر من صفر.'); return; }
                                  if (new Date(bookingEdit.checkOut) <= new Date(bookingEdit.checkIn)) { alert('تاريخ الخروج لازم يكون بعد تاريخ الدخول.'); return; }
                                  setEditSaving(true);
                                  const ok = await onUpdateBookingDetails(booking.id, { checkIn: bookingEdit.checkIn, checkOut: bookingEdit.checkOut, guestsCount: guests });
                                  setEditSaving(false);
                                  if (ok) setEditBookingId(null);
                                }}
                                className="flex-1 bg-[#5A5A40] hover:bg-[#4A4A3A] disabled:opacity-60 text-white text-[12px] font-bold min-h-11 rounded-xl cursor-pointer">
                                {editSaving ? 'بيتحفظ…' : 'احفظ التعديل'}
                              </button>
                              <button type="button" onClick={() => setEditBookingId(null)}
                                className="bg-[#EBEBE0] hover:bg-[#DEDECB] text-[#4A4A3A] text-[12px] font-bold min-h-11 px-4 rounded-xl cursor-pointer">
                                إلغاء
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button type="button"
                            onClick={() => {
                              setEditBookingId(booking.id);
                              setBookingEdit({ checkIn: booking.checkIn?.slice(0, 10) || '', checkOut: booking.checkOut?.slice(0, 10) || '', guestsCount: String(booking.guestsCount) });
                            }}
                            className="w-full flex items-center justify-center gap-1.5 bg-[#EBEBE0] hover:bg-[#DEDECB] text-[#4A4A3A] text-[12px] font-bold min-h-11 rounded-xl cursor-pointer">
                            <Pencil className="w-3.5 h-3.5" /> تعديل التواريخ والعدد
                          </button>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Messages tab — admin reads booking chats for dispute resolution */}
      {activeTab === 'messages' && (
        <div className="space-y-3">
          <div className="text-xs font-bold text-[#8A8A70] px-1">مراجعة محادثات الحجوزات — اختر حجز لعرض المحادثة:</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {bookings.filter((b) => b.status !== 'rejected').slice(0, 50).map((b) => {
              const isOpen = chatBookingId === b.id;
              return (
                <button key={b.id} onClick={() => setChatBookingId(isOpen ? null : b.id)}
                  className={`text-right p-3 rounded-2xl border transition-all cursor-pointer ${isOpen ? 'bg-[#5A5A40] text-white border-[#5A5A40]' : 'bg-white border-[#D6D6C2] hover:bg-[#FAF8F5]'}`}>
                  <div className="text-[11px] font-bold truncate">{b.userName}</div>
                  <div className={`text-[11px] truncate ${isOpen ? 'text-white/70' : 'text-[#8A8A70]'}`}>{b.houseName} · {arabicDate(b.checkIn)}</div>
                </button>
              );
            })}
          </div>
          {chatBookingId && (
            <div className="bg-white rounded-3xl border border-[#D6D6C2] overflow-hidden">
              <div className="bg-[#FAF8F5] border-b border-[#D6D6C2] px-4 py-3 flex items-center justify-between">
                <div className="text-xs font-bold text-[#4A4A3A] flex items-center gap-1.5">
                  <MessageSquareDashed className="w-4 h-4 text-[#5A5A40]" />
                  محادثة الحجز #{chatBookingId.slice(0, 8)}
                </div>
                <button onClick={() => setChatBookingId(null)} className="text-[12px] font-bold text-[#8A8A70] hover:text-[#4A4A3A] cursor-pointer">إغلاق</button>
              </div>
              <div className="p-4 max-h-80 overflow-y-auto space-y-2">
                {chatLoading ? (
                  <div className="text-center py-6 text-[12px] text-[#8A8A70] animate-pulse">جاري تحميل المحادثة...</div>
                ) : chatMessages.length === 0 ? (
                  <div className="text-center py-6 text-[12px] text-[#8A8A70]">لا توجد رسائل في هذا الحجز بعد.</div>
                ) : (
                  chatMessages.map((msg) => {
                    const booking = bookings.find((b) => b.id === chatBookingId);
                    const isGuest = booking && msg.senderId === booking.userId;
                    return (
                      <div key={msg.id} className={`flex ${isGuest ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] rounded-2xl px-3 py-2 space-y-0.5 ${isGuest ? 'bg-emerald-50 border border-emerald-200' : 'bg-[#FAF8F5] border border-[#E7E5DB]'}`}>
                          <div className="text-[11px] font-bold text-[#8A8A70]">{msg.senderName}</div>
                          <div className="text-[11px] text-[#4A4A3A]">{msg.content}</div>
                          <div className="text-[11px] text-[#BCBC9D]">{new Date(msg.createdAt).toLocaleString('ar-EG')}</div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* User detail modal */}
      {detailUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setDetailUserId(null)} />
          <div className="bg-[#FAF8F5] max-w-lg w-full max-h-[90vh] overflow-y-auto rounded-3xl relative z-10 text-right">
            <div className="sticky top-0 bg-[#FAF8F5] border-b border-[#D6D6C2] px-5 py-3.5 flex items-center justify-between z-10">
              <h4 className="text-sm font-black text-[#2D2D24]">{detailUser.name}</h4>
              <button onClick={() => setDetailUserId(null)} className="bg-white border border-[#D6D6C2] text-[#2D2D24] text-xs font-bold px-3 min-h-11.5 rounded-xl cursor-pointer">إغلاق ✕</button>
            </div>
            <div className="p-5 space-y-4">
              {/* User info */}
              <div className="bg-white rounded-2xl border border-[#D6D6C2] p-4 space-y-2 text-[11px]">
                <div className="flex justify-between"><span className="text-[#8A8A70]">الإيميل:</span><span className="font-bold">{detailUser.email}</span></div>
                <div className="flex justify-between"><span className="text-[#8A8A70]">الهاتف:</span><span className="font-bold font-mono">{detailUser.phone}</span></div>
                <div className="flex justify-between"><span className="text-[#8A8A70]">الدور:</span><span className="font-bold">{ROLE_LABELS[detailUser.role] ?? 'فرد'}</span></div>
                {detailUser.organizationName && <div className="flex justify-between"><span className="text-[#8A8A70]">الكنيسة/المنظمة:</span><span className="font-bold">{detailUser.organizationName}</span></div>}
                {detailUser.governorate && <div className="flex justify-between"><span className="text-[#8A8A70]">المحافظة:</span><span className="font-bold">{detailUser.governorate}</span></div>}
                <div className="flex justify-between"><span className="text-[#8A8A70]">تاريخ التسجيل:</span><span className="font-bold">{new Date(detailUser.createdAt).toLocaleDateString('ar-EG')}</span></div>
                <div className="flex justify-between"><span className="text-[#8A8A70]">النقاط:</span><span className="font-bold">{detailUser.points ?? 0}</span></div>
              </div>

              {/* User bookings */}
              <div className="space-y-1.5">
                <h5 className="text-[11px] font-black text-[#4A4A3A]">الحجوزات ({detailUserBookings.length})</h5>
                {detailUserBookings.length === 0 ? (
                  <div className="text-[12px] text-[#8A8A70] bg-white rounded-xl border border-[#D6D6C2] p-3 text-center">لا توجد حجوزات</div>
                ) : detailUserBookings.map((b) => (
                  <div key={b.id} className="bg-white rounded-xl border border-[#D6D6C2] p-3 text-[12px] space-y-0.5">
                    <div className="flex justify-between font-bold"><span>{b.houseName}</span><span className={b.status === 'approved' || b.status === 'completed' ? 'text-emerald-700' : b.status === 'pending' ? 'text-amber-700' : 'text-rose-700'}>{b.status === 'approved' ? 'مقبول' : b.status === 'completed' ? 'مكتمل' : b.status === 'pending' ? 'معلّق' : b.status === 'cancelled' ? 'ملغى' : 'مرفوض'}</span></div>
                    <div className="text-[#8A8A70]">{arabicDateRange(b.checkIn, b.checkOut)} · {arabicPlural(b.guestsCount, GUEST_FORMS)} · {arabicNumber(b.totalPrice)} ج.م</div>
                  </div>
                ))}
              </div>

              {/* User payments */}
              <div className="space-y-1.5">
                <h5 className="text-[11px] font-black text-[#4A4A3A]">المدفوعات ({detailUserPayments.length})</h5>
                {detailUserPayments.length === 0 ? (
                  <div className="text-[12px] text-[#8A8A70] bg-white rounded-xl border border-[#D6D6C2] p-3 text-center">لا توجد مدفوعات</div>
                ) : detailUserPayments.map((p) => (
                  <div key={p.id} className="bg-white rounded-xl border border-[#D6D6C2] p-3 text-[12px] flex justify-between items-center">
                    <div><span className="font-bold">{arabicNumber(p.amount)} ج.م</span> <span className="text-[#8A8A70]">({p.paymentMethod})</span></div>
                    <span className={`font-bold ${p.paymentStatus === 'approved' ? 'text-emerald-700' : p.paymentStatus === 'pending' ? 'text-amber-700' : 'text-rose-700'}`}>
                      {p.paymentStatus === 'approved' ? 'معتمد' : p.paymentStatus === 'pending' ? 'معلّق' : 'مرفوض'}
                    </span>
                  </div>
                ))}
              </div>

              {/* User reviews */}
              <div className="space-y-1.5">
                <h5 className="text-[11px] font-black text-[#4A4A3A]">التقييمات ({detailUserReviews.length})</h5>
                {detailUserReviews.length === 0 ? (
                  <div className="text-[12px] text-[#8A8A70] bg-white rounded-xl border border-[#D6D6C2] p-3 text-center">لا توجد تقييمات</div>
                ) : detailUserReviews.map((r) => (
                  <div key={r.id} className="bg-white rounded-xl border border-[#D6D6C2] p-3 text-[12px] space-y-0.5">
                    <div className="flex justify-between items-center">
                      <span className="font-bold">{houses.find((h) => h.id === r.houseId)?.name || r.houseId}</span>
                      <span className="flex items-center gap-0.5 text-amber-600 font-bold"><Star className="w-3 h-3 fill-amber-500 text-amber-500" />{arabicDecimal(r.overall_rating ?? r.rating)}</span>
                    </div>
                    {r.comment && <div className="text-[#8A8A70] truncate">{r.comment}</div>}
                  </div>
                ))}
              </div>
            </div>
          </div>
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
                className="bg-white hover:bg-[#FAF8F5] border border-[#E7E5DB] text-[#2D2D24] text-xs font-bold px-3 min-h-11.5 rounded-xl cursor-pointer"
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

      {/* Full house preview — replaces the old 3-stat summary card. Shows
          exactly what a guest sees (HouseDetail in previewMode: forms
          render but submitting is a no-op) plus an admin-only payment-
          methods panel and a light quick-edit for the fields most likely
          to need a correction before approving. */}
      {previewHouse && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={() => { setPreviewHouseId(null); setEditingHouseId(null); }} />
          <div className="bg-[#FAF8F5] max-w-2xl w-full max-h-[92vh] overflow-y-auto rounded-3xl relative z-10 text-right">
            <div className="sticky top-0 bg-[#FAF8F5] border-b border-[#D6D6C2] flex items-center justify-between px-5 py-3.5 z-10">
              <h4 className="text-sm font-black text-[#2D2D24]">معاينة: {previewHouse.name}</h4>
              <div className="flex items-center gap-2">
                {onUpdateHouse && editingHouseId !== previewHouse.id && (
                  <button
                    onClick={() => startEdit(previewHouse)}
                    className="flex items-center gap-1 bg-white border border-[#D6D6C2] hover:bg-[#F0EDE6] text-[#4A4A3A] text-[11px] font-bold px-3 min-h-11.5 rounded-xl"
                  >
                    <Pencil className="w-3.5 h-3.5" /> تعديل
                  </button>
                )}
                <button
                  onClick={() => { setPreviewHouseId(null); setEditingHouseId(null); }}
                  className="bg-white hover:bg-[#F0EDE6] border border-[#D6D6C2] text-[#2D2D24] text-xs font-bold px-3 min-h-11.5 rounded-xl"
                >
                  إغلاق ✕
                </button>
              </div>
            </div>

            {editingHouseId === previewHouse.id ? (
              <div className="p-5 space-y-3">
                <input type="text" value={editDraft.name ?? ''} onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                  placeholder="اسم البيت" className="w-full bg-white border border-[#D6D6C2] text-xs px-3 min-h-11 rounded-xl" />
                <textarea value={editDraft.description ?? ''} onChange={(e) => setEditDraft((d) => ({ ...d, description: e.target.value }))}
                  placeholder="الوصف" rows={3} className="w-full bg-white border border-[#D6D6C2] text-xs px-3 min-h-11 rounded-xl resize-none" />
                <input type="number" value={editDraft.pricePerNightPerPerson ?? 0} onChange={(e) => setEditDraft((d) => ({ ...d, pricePerNightPerPerson: Number(e.target.value) }))}
                  placeholder="السعر لليلة للفرد" className="w-full bg-white border border-[#D6D6C2] text-xs px-3 min-h-11 rounded-xl" />
                {/* Blank, not 0, when the house does not sell a day — so an
                    admin opening this form cannot set a price by saving it. */}
                <input type="number" min={0} value={editDraft.dayUsePricePerPerson ?? ''}
                  onChange={(e) => setEditDraft((d) => ({ ...d, dayUsePricePerPerson: e.target.value === '' ? undefined : Number(e.target.value) }))}
                  placeholder="سعر اليوم بدون مبيت للفرد (اتركه فارغاً لو غير متاح)"
                  className="w-full bg-white border border-[#D6D6C2] text-xs px-3 min-h-11 rounded-xl" />
                <div>
                  <p className="text-[11px] font-bold text-[#8A8A70] mb-1.5">الخدمات:</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {AMENITIES_LIST.map((s) => {
                      const list = editDraft.services ?? [];
                      const active = list.includes(s);
                      return (
                        <button key={s} type="button"
                          onClick={() => setEditDraft((d) => ({ ...d, services: active ? list.filter((x) => x !== s) : [...list, s] }))}
                          className={`text-[12px] font-bold min-h-11.5 px-2 rounded-lg border ${active ? 'bg-[#5A5A40] text-white border-[#5A5A40]' : 'bg-white border-[#D6D6C2] text-[#4A4A3A]'}`}>
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex gap-2 justify-end pt-1">
                  <button onClick={() => setEditingHouseId(null)} className="text-xs font-bold text-[#8A8A70] px-3 min-h-11">إلغاء</button>
                  <button onClick={() => saveEdit(previewHouse)} className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-4 min-h-11 rounded-xl">
                    حفظ التعديلات
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="px-5 pt-4">
                  <div className="bg-white border border-[#D6D6C2] rounded-2xl p-3.5 flex items-start gap-2">
                    <Wallet className="w-4 h-4 text-[#5A5A40] shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-[11px] font-black text-[#2D2D24] mb-1">وسائل استلام الدفع من صاحب البيت</p>
                      {previewHouse.paymentMethods.length === 0 ? (
                        <p className="text-[11px] text-rose-600 font-bold">لم يضف صاحب البيت أي وسيلة دفع بعد.</p>
                      ) : (
                        <div className="space-y-1">
                          {previewHouse.paymentMethods.map((p) => (
                            <p key={p.id} className="text-[11px] text-[#4A4A3A]"><span className="font-bold">{p.label}:</span> {p.value}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="p-1">
                  <HouseDetail
                    house={previewHouse}
                    currentUser={currentUser}
                    bookings={bookings}
                    reviews={reviews.filter((r) => r.houseId === previewHouse.id)}
                    onBack={() => setPreviewHouseId(null)}
                    onBook={() => {}}
                    onSubmitReview={() => {}}
                    isFavorited={false}
                    onToggleFavorite={() => {}}
                    previewMode
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── The bottom navigation ──────────────────────────────────────────
          Five sections, الرئيسية in the middle as the primary action.

          Sticky rather than fixed, so it rides inside the app shell's own
          scroll container instead of floating over the whole viewport — the
          shell clips overflow, and a `fixed` bar would sit outside it and
          collide with the layout on desktop.

          The raised disc stays INSIDE the bar's box. The same constraint is
          documented on the app's own bottom bar in WebLayout: the shell
          clips, so a button breaking the top edge is simply cut off. The bar
          is tall enough to hold the circle instead.

          The safe-area inset keeps the tap targets clear of the Android
          gesture bar, matching the treatment the other two bars already have. */}
      <div className="sticky bottom-0 z-20 pt-2 pb-[env(safe-area-inset-bottom)]">
        <nav
          aria-label="أقسام لوحة الإدارة"
          className="bg-white rounded-[28px] shadow-[0_8px_28px_rgba(10,35,66,0.14),0_2px_8px_rgba(10,35,66,0.06)] border border-[#EBEBE0] px-2 py-2 flex items-stretch"
        >
          {NAV_GROUPS.map((g) => {
            const Icon = g.icon;
            const isOn = navSection === g.key;
            const isPrimary = g.key === 'home';

            if (isPrimary) {
              return (
                <button
                  key={g.key}
                  onClick={() => goTo(g.key, g.tabs[0].key)}
                  aria-current={isOn ? 'page' : undefined}
                  className="flex-1 flex flex-col items-center justify-center gap-1 min-h-14 cursor-pointer group"
                >
                  <span
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-[250ms] ${
                      isOn
                        ? 'bg-[#0A2342] shadow-[0_6px_16px_rgba(10,35,66,0.35)] scale-100'
                        : 'bg-[#0A2342]/90 shadow-[0_3px_10px_rgba(10,35,66,0.2)] scale-95 group-hover:scale-100'
                    }`}
                  >
                    <Icon className="w-6 h-6 text-[#C5A059]" />
                  </span>
                  <span className={`text-[11px] font-black transition-colors duration-[250ms] ${isOn ? 'text-[#C5A059]' : 'text-[#8A8A70]'}`}>
                    {g.label}
                  </span>
                </button>
              );
            }

            return (
              <button
                key={g.key}
                onClick={() => goTo(g.key, g.tabs[0].key)}
                aria-current={isOn ? 'page' : undefined}
                className="flex-1 flex flex-col items-center justify-center gap-1.5 min-h-14 cursor-pointer"
              >
                <Icon
                  className={`w-5 h-5 transition-all duration-[250ms] ${
                    isOn ? 'text-[#C5A059] scale-110' : 'text-[#8A8A70] scale-100'
                  }`}
                />
                <span className={`text-[11px] font-bold transition-colors duration-[250ms] ${isOn ? 'text-[#C5A059]' : 'text-[#8A8A70]'}`}>
                  {g.label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

    </div>
  );
}
