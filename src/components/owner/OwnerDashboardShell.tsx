import React, { useState } from 'react';
import { RetreatHouse, Booking, User, ConferenceHall, Attendee, RoomAllocation, Review, Room, WaitlistEntry, PlatformSettings, DEFAULT_PLATFORM_SETTINGS, AppNotification, Expense } from '../../types';
import { GOVERNORATES, AMENITIES_LIST, SUITABILITY_MAP } from '../../mockData';
import {
  Plus, Check, X, ShieldAlert, Coins, Home, Calendar, Users, Star, ClipboardList, Info, Trash2,
  Building, Settings, MessageSquare, Camera, BedDouble, Phone, Mail, Lock, Menu, ChevronRight,
  MessageCircle, Bell, BarChart3, Search, Utensils, MapPin, Image as ImageIcon, HelpCircle, KeyRound, Shuffle, ChevronDown,
} from 'lucide-react';
import RoomDistribution from '../RoomDistribution';
import PhotoPickerButtons from '../PhotoPickerButtons';
import OwnerMessages from './OwnerMessages';
import OwnerNotifications from './OwnerNotifications';
import OwnerReports from './OwnerReports';
import OwnerFoodMenu from './OwnerFoodMenu';
import OwnerRoomDistributionScreen from './OwnerRoomDistribution';
import OwnerCustomers from './OwnerCustomers';
import { supabase } from '../../lib/supabase';
import { getRoomBedState, getHouseRoomAvailabilityForRange } from '../../lib/roomOccupancy';
import LocationPicker from '../LocationPicker';

type PrimaryTab = 'stats' | 'bookings' | 'messages' | 'reports';
type OverflowTab = 'rooms' | 'financials' | 'reviews' | 'house' | 'occupancy' | 'notifications' | 'profile' | 'room_distribution' | 'customers';
type ActiveTab = PrimaryTab | OverflowTab;

// Relative time for the activity feed — "منذ 10 دقائق" style, like the mockup.
function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return 'الآن';
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return hours === 1 ? 'منذ ساعة' : `منذ ${hours} ساعة`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'منذ يوم' : `منذ ${days} يوم`;
}

interface OwnerDashboardShellProps {
  owner: User;
  houses: RetreatHouse[];
  bookings: Booking[];
  settings?: PlatformSettings;
  onAddHouse: (house: RetreatHouse) => void;
  onDeleteHouse?: (houseId: string) => void;
  onApproveBooking: (bookingId: string) => void;
  onRejectBooking: (bookingId: string) => void;
  onConfirmDeposit?: (bookingId: string) => void;
  onCheckInBooking?: (bookingId: string) => void;
  onCheckOutBooking?: (bookingId: string) => void;
  attendees: Attendee[];
  allocations: RoomAllocation[];
  onUpdateAttendees: (bookingId: string, attendees: Attendee[]) => void;
  onUpdateAllocations: (bookingId: string, allocations: RoomAllocation[]) => void;
  onOpenRoomDistribution?: (bookingId: string) => void;
  onUpdateHouse?: (house: RetreatHouse) => void;
  onRequestHouseEdit?: (houseId: string, changes: Partial<RetreatHouse>) => void;
  reviews?: Review[];
  onUpdateReview?: (review: Review) => void;
  rooms?: Room[];
  onAddRoom?: (room: Room) => void;
  onUpdateRoom?: (room: Room) => void;
  onDeleteRoom?: (roomId: string) => void;
  waitlist?: WaitlistEntry[];
  notifications?: AppNotification[];
  onMarkNotificationAsRead?: (id: string) => void;
  expenses?: Expense[];
  onAddExpense?: (expense: Expense) => void;
  onDeleteExpense?: (expenseId: string) => void;
  users?: User[];
  onNavigateSupport?: () => void;
  onCreateBooking?: (booking: Booking) => Promise<boolean>;
  onUpdateBookingDetails?: (bookingId: string, fields: { checkIn?: string; checkOut?: string; guestsCount?: number }) => Promise<boolean>;
  onRecalculateAllocation?: (houseId: string, bookingId?: string) => Promise<void>;
  onLogout?: () => void;
}

const OVERFLOW_ITEMS: { key: OverflowTab; label: string; icon: React.ElementType }[] = [
  { key: 'rooms', label: 'الغرف', icon: BedDouble },
  { key: 'room_distribution', label: 'توزيع الغرف', icon: Shuffle },
  { key: 'financials', label: 'الحسابات', icon: Coins },
  { key: 'customers', label: 'العملاء', icon: Users },
  { key: 'reviews', label: 'التقييمات', icon: MessageSquare },
  { key: 'house', label: 'بيانات البيت', icon: Building },
  { key: 'occupancy', label: 'التقويم', icon: Calendar },
  { key: 'notifications', label: 'الإشعارات', icon: Bell },
  { key: 'profile', label: 'الإعدادات', icon: Settings },
];

export default function OwnerDashboardShell({
  owner, houses, bookings, settings = DEFAULT_PLATFORM_SETTINGS,
  onAddHouse, onDeleteHouse, onApproveBooking, onRejectBooking, onConfirmDeposit, onCheckInBooking, onCheckOutBooking,
  attendees, allocations, onUpdateAttendees, onUpdateAllocations, onOpenRoomDistribution,
  onUpdateHouse, onRequestHouseEdit, reviews = [], onUpdateReview,
  rooms = [], onAddRoom, onUpdateRoom, onDeleteRoom, waitlist = [],
  notifications = [], onMarkNotificationAsRead,
  expenses = [], onAddExpense, onDeleteExpense, users = [], onNavigateSupport, onCreateBooking,
  onUpdateBookingDetails, onRecalculateAllocation, onLogout,
}: OwnerDashboardShellProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('stats');
  const [showOverflow, setShowOverflow] = useState(false);
  const [activeAllocationBooking, setActiveAllocationBooking] = useState<Booking | null>(null);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [bookingFilter, setBookingFilter] = useState<'all' | 'new' | 'pending_payment' | 'confirmed' | 'arrivals_today' | 'departures_today' | 'completed' | 'cancelled' | 'waitlist'>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'manual' | 'temporary'>('all');
  const [expandedGroup, setExpandedGroup] = useState<'bookings' | 'rooms' | null>(null);
  const [bookingSearch, setBookingSearch] = useState('');
  const [showAddBooking, setShowAddBooking] = useState(false);
  const [mbName, setMbName] = useState('');
  const [mbPhone, setMbPhone] = useState('');
  const [mbCheckIn, setMbCheckIn] = useState('');
  const [mbCheckOut, setMbCheckOut] = useState('');
  const [mbGuests, setMbGuests] = useState(10);
  const [mbPrice, setMbPrice] = useState('');
  const [mbType, setMbType] = useState<'manual' | 'temporary'>('manual');
  const [mbSaving, setMbSaving] = useState(false);
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null);
  const [editCheckIn, setEditCheckIn] = useState('');
  const [editCheckOut, setEditCheckOut] = useState('');
  const [editGuests, setEditGuests] = useState(1);
  const [editSaving, setEditSaving] = useState(false);
  const [recalcSaving, setRecalcSaving] = useState(false);
  const PLATFORM_COMMISSION = settings.commissionRate;

  const [statsPeriod, setStatsPeriod] = useState<'today' | '7d' | '30d' | 'month' | 'all' | 'custom'>('all');
  const [statsCustomFrom, setStatsCustomFrom] = useState('');
  const [statsCustomTo, setStatsCustomTo] = useState('');

  const [houseName, setHouseName] = useState('');
  const [houseDesc, setHouseDesc] = useState('');
  const [houseGov, setHouseGov] = useState(GOVERNORATES[0]);
  const [houseAddress, setHouseAddress] = useState('');
  const [houseLat, setHouseLat] = useState<number | null>(null);
  const [houseLng, setHouseLng] = useState<number | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [showManualMap, setShowManualMap] = useState(false);
  const [pricePerNight, setPricePerNight] = useState<number>(150);
  // Seasonal-rate editor drafts (saved owner-direct via onUpdateHouse —
  // no admin re-approval, like payment methods; migration 055)
  const [srLabel, setSrLabel] = useState('');
  const [srStart, setSrStart] = useState('');
  const [srEnd, setSrEnd] = useState('');
  const [srPrice, setSrPrice] = useState('');
  const [roomsCount, setRoomsCount] = useState<number>(10);
  const [bedsCount, setBedsCount] = useState<number>(30);
  const [roomsDesc, setRoomsDesc] = useState('');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [selectedSuitability, setSelectedSuitability] = useState<('youth' | 'children' | 'families' | 'retreat')[]>([]);
  const [imageUrl, setImageUrl] = useState('');
  const [activitiesInput, setActivitiesInput] = useState('');

  const [propertyType, setPropertyType] = useState<'conference' | 'student' | 'staff'>('conference');
  const [monthlyRent, setMonthlyRent] = useState<number>(1500);
  const [studentHousingGender, setStudentHousingGender] = useState<'boys' | 'girls'>('boys');
  const [distanceFromUniversity, setDistanceFromUniversity] = useState('');

  const [halls, setHalls] = useState<ConferenceHall[]>([]);
  const [hallName, setHallName] = useState('');
  const [hallCapacity, setHallCapacity] = useState<number>(50);
  const [hallSound, setHallSound] = useState(false);
  const [hallProjector, setHallProjector] = useState(false);

  const [expandedPhotosForHouse, setExpandedPhotosForHouse] = useState<string | null>(null);
  const [extraPhotoUrl, setExtraPhotoUrl] = useState('');
  const [extraPhotoLabel, setExtraPhotoLabel] = useState('');
  const [extraPhotoCategory, setExtraPhotoCategory] = useState<'room' | 'service' | 'other'>('room');
  const [photosSuccessMsg, setPhotosSuccessMsg] = useState('');

  const [selectedBlockDate, setSelectedBlockDate] = useState('');
  const [selectedBlockDateEnd, setSelectedBlockDateEnd] = useState('');
  const [blockReason, setBlockReason] = useState('أعمال صيانة وتجهيز');
  const [blockSuccessMsg, setBlockSuccessMsg] = useState('');

  const [reviewReplyText, setReviewReplyText] = useState('');
  const [replyingToReviewId, setReplyingToReviewId] = useState<string | null>(null);
  const [reviewsSuccessMsg, setReviewsSuccessMsg] = useState('');

  const [paymentDraftType, setPaymentDraftType] = useState<'instapay' | 'vodafone_cash' | 'etisalat_cash' | 'orange_cash' | 'we_cash' | 'bank_transfer'>('instapay');
  const [paymentDraftValue, setPaymentDraftValue] = useState('');

  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const handleChangePassword = async () => {
    if (newPassword.length < 6) { setPasswordMsg({ text: 'كلمة السر يجب أن تكون 6 أحرف على الأقل.', ok: false }); return; }
    if (newPassword !== confirmPassword) { setPasswordMsg({ text: 'كلمتا السر غير متطابقتين.', ok: false }); return; }
    setPasswordSaving(true);
    setPasswordMsg(null);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordSaving(false);
    if (error) {
      setPasswordMsg({ text: 'تعذر تغيير كلمة السر. حاول مرة أخرى.', ok: false });
    } else {
      setPasswordMsg({ text: 'تم تغيير كلمة السر بنجاح.', ok: true });
      setNewPassword(''); setConfirmPassword('');
    }
  };

  const PAYMENT_TYPE_LABELS: Record<string, string> = {
    instapay: 'إنستاباي', vodafone_cash: 'فودافون كاش', etisalat_cash: 'اتصالات كاش',
    orange_cash: 'أورنج كاش', we_cash: 'وي كاش', bank_transfer: 'تحويل بنكي',
  };

  const isDateBooked = (houseId: string, year: number, month: number, day: number) => {
    const monthStr = month < 10 ? `0${month}` : `${month}`;
    const dayStr = day < 10 ? `0${day}` : `${day}`;
    const dateStr = `${year}-${monthStr}-${dayStr}`;
    const targetHouse = houses.find(h => h.id === houseId);
    if (targetHouse && targetHouse.blockedDates && targetHouse.blockedDates.includes(dateStr)) {
      return {
        id: `blocked_${dateStr}`, houseId, houseName: targetHouse.name, userId: 'admin',
        userName: 'مغلق ومحجوز يدويًا', organizationName: 'مغلق للصيانة / أعمال الخدمة ⚠️',
        guestsCount: 0, status: 'approved', checkIn: dateStr, checkOut: dateStr,
        totalPrice: 0, depositPaid: false, depositAmount: 0, createdAt: ''
      } as Booking;
    }
    const houseBookings = bookings.filter((b) => b.houseId === houseId && (b.status === 'approved' || b.status === 'completed'));
    return houseBookings.find((b) => dateStr >= b.checkIn && dateStr <= b.checkOut) || null;
  };

  const handleBlockDateSubmit = (e: React.FormEvent, house: RetreatHouse) => {
    e.preventDefault();
    if (!selectedBlockDate) { alert('الرجاء اختيار تاريخ أولاً.'); return; }
    const endDate = selectedBlockDateEnd || selectedBlockDate;
    if (endDate < selectedBlockDate) { alert('تاريخ النهاية لازم يكون بعد تاريخ البداية.'); return; }

    // Build every date in the range [selectedBlockDate, endDate] inclusive.
    const rangeDates: string[] = [];
    const cursor = new Date(selectedBlockDate);
    const last = new Date(endDate);
    while (cursor <= last) {
      rangeDates.push(cursor.toISOString().split('T')[0]);
      cursor.setDate(cursor.getDate() + 1);
    }

    const currentBlocked = house.blockedDates || [];
    const newDates = rangeDates.filter((d) => !currentBlocked.includes(d));
    if (newDates.length === 0) { alert('كل التواريخ دي محظورة بالفعل.'); return; }
    onUpdateHouse?.({ ...house, blockedDates: [...currentBlocked, ...newDates] });
    setBlockSuccessMsg(
      newDates.length === 1
        ? `تم حظر التاريخ ${newDates[0]} بنجاح! أصبح مغلقاً للصيانة/الخدمة.`
        : `تم حظر ${newDates.length} يوم بنجاح (من ${selectedBlockDate} إلى ${endDate})! أصبحوا مغلقين للصيانة/الخدمة.`
    );
    setSelectedBlockDate('');
    setSelectedBlockDateEnd('');
    setTimeout(() => setBlockSuccessMsg(''), 4000);
  };

  const handleUnblockDate = (dateStr: string, house: RetreatHouse) => {
    onUpdateHouse?.({ ...house, blockedDates: (house.blockedDates || []).filter((d) => d !== dateStr) });
    setBlockSuccessMsg(`تم إلغاء حظر التاريخ ${dateStr} بنجاح! أصبح متاحاً للحجوزات.`);
    setTimeout(() => setBlockSuccessMsg(''), 4000);
  };

  const handleAddReplySubmit = (e: React.FormEvent, reviewId: string) => {
    e.preventDefault();
    if (!reviewReplyText.trim()) { alert('الرجاء كتابة نص الرد أولاً.'); return; }
    const targetReview = reviews.find((r) => r.id === reviewId);
    if (!targetReview) return;
    onUpdateReview?.({ ...targetReview, ownerReply: reviewReplyText.trim(), ownerReplyCreatedAt: new Date().toISOString() });
    setReviewReplyText('');
    setReplyingToReviewId(null);
    setReviewsSuccessMsg('تم إرسال الرد الرسمي بنجاح وسيظهر للجميع على صفحة البيت!');
    setTimeout(() => setReviewsSuccessMsg(''), 4000);
  };

  const handleDeleteReply = (reviewId: string) => {
    if (!confirm('هل أنت متأكد من رغبتك في حذف هذا الرد؟')) return;
    const targetReview = reviews.find((r) => r.id === reviewId);
    if (!targetReview) return;
    onUpdateReview?.({ ...targetReview, ownerReply: undefined, ownerReplyCreatedAt: undefined });
    setReviewsSuccessMsg('تم حذف الرد بنجاح.');
    setTimeout(() => setReviewsSuccessMsg(''), 4000);
  };

  const ownerHouses = houses.filter((h) => h.ownerId === owner.id);
  const ownerHouseIds = ownerHouses.map((h) => h.id);
  const ownerBookings = bookings.filter((b) => ownerHouseIds.includes(b.houseId));
  const ownerRooms = rooms.filter((r) => ownerHouseIds.includes(r.houseId));
  const ownerWaitlist = waitlist.filter((w) => ownerHouseIds.includes(w.houseId));
  const unreadNotificationsCount = notifications.filter((n) => n.userId === owner.id && !n.isRead).length;

  const [roomName, setRoomName] = useState('');
  const [roomFloor, setRoomFloor] = useState(1);
  const [roomBeds, setRoomBeds] = useState(2);
  const [roomPrice, setRoomPrice] = useState('');
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  const pendingBookings = ownerBookings.filter((b) => b.status === 'pending');
  const todayStr = new Date().toISOString().split('T')[0];
  const todayBookings = ownerBookings.filter((b) => (b.status === 'approved' || b.status === 'completed') && b.checkIn <= todayStr && b.checkOut >= todayStr);
  const confirmedBookings = ownerBookings.filter((b) => b.status === 'approved' || b.status === 'completed');
  const confirmedRevenue = confirmedBookings.reduce((sum, b) => sum + b.totalPrice, 0);
  const platformCommissionAmount = confirmedRevenue * PLATFORM_COMMISSION;
  const netOwnerPayout = confirmedRevenue - platformCommissionAmount;
  const depositReceived = confirmedBookings.filter((b) => b.depositPaid).reduce((sum, b) => sum + b.depositAmount, 0);
  const remainingBalance = confirmedRevenue - depositReceived;
  const ownerExpenses = expenses.filter((e) => ownerHouseIds.includes(e.houseId));
  const totalExpenses = ownerExpenses.reduce((sum, e) => sum + e.amount, 0);
  const netProfit = netOwnerPayout - totalExpenses;

  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth() + 1;
  const daysInMonth = new Date(curYear, curMonth, 0).getDate();
  const totalHouseDays = ownerHouses.length * daysInMonth;
  const occupiedDays = ownerBookings.reduce((sum, b) => {
    if (b.status !== 'approved' && b.status !== 'completed') return sum;
    const bStart = new Date(b.checkIn);
    const bEnd = new Date(b.checkOut);
    const monthStart = new Date(curYear, curMonth - 1, 1);
    const monthEnd = new Date(curYear, curMonth, 0);
    if (bEnd < monthStart || bStart > monthEnd) return sum;
    const overlapStart = bStart > monthStart ? bStart : monthStart;
    const overlapEnd = bEnd < monthEnd ? bEnd : monthEnd;
    const days = Math.max(0, Math.round((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    return sum + days;
  }, 0);
  const occupancyRate = totalHouseDays > 0 ? Math.round((occupiedDays / totalHouseDays) * 100) : 0;

  const ownerReviews = reviews.filter((r) => ownerHouseIds.includes(r.houseId));
  const avgRating = ownerReviews.length > 0 ? (ownerReviews.reduce((sum, r) => sum + r.rating, 0) / ownerReviews.length) : 0;

  const statsPeriodBounds = (() => {
    const end = new Date();
    if (statsPeriod === 'today') { const start = new Date(); start.setHours(0, 0, 0, 0); return { start, end }; }
    if (statsPeriod === '7d') { const start = new Date(); start.setDate(start.getDate() - 7); return { start, end }; }
    if (statsPeriod === '30d') { const start = new Date(); start.setDate(start.getDate() - 30); return { start, end }; }
    if (statsPeriod === 'month') { const start = new Date(end.getFullYear(), end.getMonth(), 1); return { start, end }; }
    if (statsPeriod === 'custom' && statsCustomFrom && statsCustomTo) { return { start: new Date(statsCustomFrom), end: new Date(statsCustomTo) }; }
    return null;
  })();
  const periodBookings = statsPeriodBounds
    ? ownerBookings.filter((b) => { const checkIn = new Date(b.checkIn); return checkIn >= statsPeriodBounds.start && checkIn <= statsPeriodBounds.end; })
    : ownerBookings;
  const periodConfirmedBookings = periodBookings.filter((b) => b.status === 'approved' || b.status === 'completed');
  const periodConfirmedRevenue = periodConfirmedBookings.reduce((sum, b) => sum + b.totalPrice, 0);
  const periodPlatformCommission = periodConfirmedRevenue * PLATFORM_COMMISSION;
  const periodNetPayout = periodConfirmedRevenue - periodPlatformCommission;

  // Categories match the refined mockup's Bookings tabs. Data-backed by existing
  // fields only — no "expenses"-style fabricated categories.
  const categorizeBooking = (b: Booking): 'new' | 'pending_payment' | 'confirmed' | 'arrivals_today' | 'departures_today' | 'completed' | 'cancelled' => {
    if (b.status === 'pending') return 'new';
    if (b.status === 'rejected' || b.status === 'cancelled') return 'cancelled';
    if (b.status === 'completed') return 'completed';
    if (b.status === 'approved' && b.checkIn === todayStr) return 'arrivals_today';
    if (b.status === 'approved' && b.checkOut === todayStr) return 'departures_today';
    if (b.status === 'approved' && !b.depositPaid) return 'pending_payment';
    return 'confirmed';
  };
  const bookingMatchesSearch = (b: Booking) => {
    const q = bookingSearch.trim().toLowerCase();
    if (!q) return true;
    return b.userName.toLowerCase().includes(q) || b.houseName.toLowerCase().includes(q) || b.userPhone.includes(q);
  };
  const filteredOwnerBookings = (bookingFilter === 'all' || bookingFilter === 'waitlist'
    ? ownerBookings
    : ownerBookings.filter((b) => categorizeBooking(b) === bookingFilter)
  ).filter(bookingMatchesSearch).filter((b) => sourceFilter === 'all' || b.source === sourceFilter);
  const bookingCountByCategory = {
    all: ownerBookings.length,
    new: ownerBookings.filter((b) => categorizeBooking(b) === 'new').length,
    pending_payment: ownerBookings.filter((b) => categorizeBooking(b) === 'pending_payment').length,
    confirmed: ownerBookings.filter((b) => categorizeBooking(b) === 'confirmed').length,
    arrivals_today: ownerBookings.filter((b) => categorizeBooking(b) === 'arrivals_today').length,
    departures_today: ownerBookings.filter((b) => categorizeBooking(b) === 'departures_today').length,
    completed: ownerBookings.filter((b) => categorizeBooking(b) === 'completed').length,
    cancelled: ownerBookings.filter((b) => categorizeBooking(b) === 'cancelled').length,
    waitlist: ownerWaitlist.length,
  };
  const selectedBooking = selectedBookingId ? ownerBookings.find((b) => b.id === selectedBookingId) ?? null : null;

  const handleServiceToggle = (srv: string) => setSelectedServices((prev) => prev.includes(srv) ? prev.filter((s) => s !== srv) : [...prev, srv]);
  const handleSuitabilityToggle = (suit: 'youth' | 'children' | 'families' | 'retreat') =>
    setSelectedSuitability((prev) => prev.includes(suit) ? prev.filter((s) => s !== suit) : [...prev, suit]);

  const handleAddHall = () => {
    if (!hallName) return;
    setHalls([...halls, { id: `hall_${Date.now()}`, name: hallName, capacity: hallCapacity, hasSoundSystem: hallSound, hasProjector: hallProjector }]);
    setHallName(''); setHallCapacity(50); setHallSound(false); setHallProjector(false);
  };
  const handleRemoveHall = (id: string) => setHalls(halls.filter((h) => h.id !== id));

  const editableHouseFields = (h: RetreatHouse): Partial<RetreatHouse> => ({
    name: h.name, description: h.description, governorate: h.governorate, address: h.address,
    lat: h.lat, lng: h.lng, roomsCount: h.roomsCount, bedsCount: h.bedsCount,
    roomsDescription: h.roomsDescription, pricePerNightPerPerson: h.pricePerNightPerPerson,
    propertyType: h.propertyType, monthlyRent: h.monthlyRent, studentHousingGender: h.studentHousingGender,
    distanceFromUniversity: h.distanceFromUniversity, services: h.services, suitability: h.suitability,
    conferenceHalls: h.conferenceHalls, activities: h.activities, images: h.images,
    imageDescriptions: h.imageDescriptions,
  });
  const getEditBase = (house: RetreatHouse): RetreatHouse => house.pendingEdit ? { ...house, ...house.pendingEdit } : house;
  const requestHouseEdit = (house: RetreatHouse, partial: Partial<RetreatHouse>) => {
    if (!onRequestHouseEdit) return;
    const base = getEditBase(house);
    onRequestHouseEdit(house.id, editableHouseFields({ ...base, ...partial }));
  };

  const populateFormFromHouse = (house: RetreatHouse) => {
    setHouseName(house.name); setHouseDesc(house.description); setHouseGov(house.governorate);
    setHouseAddress(house.address); setHouseLat(house.lat); setHouseLng(house.lng);
    setPricePerNight(house.pricePerNightPerPerson || 150); setRoomsCount(house.roomsCount); setBedsCount(house.bedsCount);
    setRoomsDesc(house.roomsDescription || ''); setSelectedServices(house.services || []); setSelectedSuitability(house.suitability || []);
    setImageUrl(house.images?.[0] || ''); setActivitiesInput((house.activities || []).join('، '));
    setPropertyType(house.propertyType || 'conference'); setMonthlyRent(house.monthlyRent || 1500);
    setStudentHousingGender(house.studentHousingGender === 'girls' ? 'girls' : 'boys');
    setDistanceFromUniversity(house.distanceFromUniversity || ''); setHalls(house.conferenceHalls || []);
  };

  const openHouseTab = () => {
    if (ownerHouses.length >= 1) populateFormFromHouse(getEditBase(ownerHouses[0]));
    setActiveTab('house');
    setShowOverflow(false);
  };

  const handleSubmitHouse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!houseName || !houseDesc || !houseAddress) { alert('يرجى ملء كافة البيانات الأساسية للبيت.'); return; }
    const isMonthly = propertyType === 'student' || propertyType === 'staff';

    if (ownerHouses.length >= 1) {
      const existing = ownerHouses[0];
      const base = getEditBase(existing);
      const updatedImages = imageUrl && imageUrl !== base.images[0] ? [imageUrl, ...base.images.slice(1)] : base.images;
      requestHouseEdit(existing, {
        name: houseName, description: houseDesc, governorate: houseGov, address: houseAddress,
        lat: houseLat ?? base.lat, lng: houseLng ?? base.lng, roomsCount, bedsCount,
        roomsDescription: roomsDesc || base.roomsDescription, pricePerNightPerPerson: isMonthly ? 0 : pricePerNight,
        propertyType, monthlyRent: isMonthly ? monthlyRent : undefined,
        studentHousingGender: propertyType === 'student' ? studentHousingGender : undefined,
        distanceFromUniversity: propertyType === 'student' ? distanceFromUniversity : undefined,
        services: selectedServices, suitability: selectedSuitability.length > 0 ? selectedSuitability : base.suitability,
        conferenceHalls: propertyType === 'conference' ? halls : [],
        activities: activitiesInput ? activitiesInput.split('،').map((a) => a.trim()) : base.activities,
        images: updatedImages,
      });
      alert('تم إرسال تعديلاتك للإدارة للمراجعة، وستُطبق بعد الموافقة عليها.');
      return;
    }

    const newHouse: RetreatHouse = {
      id: `house_${Date.now()}`, name: houseName, description: houseDesc, ownerId: owner.id, ownerName: owner.name,
      governorate: houseGov, address: houseAddress,
      lat: houseLat ?? 30.0444 + (Math.random() - 0.5) * 0.4, lng: houseLng ?? 31.2357 + (Math.random() - 0.5) * 0.4,
      roomsCount, bedsCount,
      roomsDescription: roomsDesc || (isMonthly ? 'غرف سكنية مجهزة ومريحة تناسب الدراسة والعمل الهادئ.' : 'غرف فندقية نظيفة ومريحة مجهزة بحمام وتكييف.'),
      pricePerNightPerPerson: isMonthly ? 0 : pricePerNight, propertyType, monthlyRent: isMonthly ? monthlyRent : undefined,
      studentHousingGender: propertyType === 'student' ? studentHousingGender : undefined,
      distanceFromUniversity: propertyType === 'student' ? distanceFromUniversity : undefined,
      housingRules: isMonthly ? [
        'المحافظة على الوقار والمبادئ المسيحية في التعامل والسلوك العام بالسكن.',
        'مواعيد غلق الباب الخارجي بحد أقصى الساعة ١٠:٣٠ مساءً يومياً.',
        'يمنع منعاً باتاً استقبال زوار من الجنس الآخر في غرف النوم الخاصة.',
        'المحافظة على نظافة الغرف والهدوء لتمكين الزملاء من المذاكرة والاستراحة.'
      ] : undefined,
      contractTerms: isMonthly ? 'عقد إيجار مخصص للطلبة والمغتربين المسيحيين يبدأ من شهر إلى سنة كاملة قابلة للتجديد.' : undefined,
      services: selectedServices, suitability: selectedSuitability.length > 0 ? selectedSuitability : ['youth', 'families'],
      conferenceHalls: propertyType === 'conference' ? halls : [],
      restaurants: [{ id: `rest_${Date.now()}`, name: 'المطعم الرئيسي للبيت', capacity: bedsCount, mealsServed: ['breakfast', 'lunch', 'dinner'] }],
      activities: activitiesInput ? activitiesInput.split('،').map((a) => a.trim()) : ['مسابقات وألعاب روحية', 'عروض مسرحية'],
      paymentMethods: [],
      images: [
        imageUrl || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800&auto=format&fit=crop&q=80'
      ],
      status: 'pending', rating: 5.0, reviewsCount: 0, createdAt: new Date().toISOString()
    };

    onAddHouse(newHouse);
    alert('تم إضافة العقار بنجاح! تم إرساله للمراجعة وسيظهر للجميع بمجرد تفعيله من قبل إدارة النظام.');
    setHouseName(''); setHouseDesc(''); setHouseGov(GOVERNORATES[0]); setHouseAddress(''); setPricePerNight(150);
    setRoomsCount(10); setBedsCount(30); setRoomsDesc(''); setSelectedServices([]); setSelectedSuitability([]);
    setImageUrl(''); setHalls([]); setActivitiesInput(''); setPropertyType('conference'); setMonthlyRent(1500);
    setStudentHousingGender('boys'); setDistanceFromUniversity('');
    setActiveTab('stats');
  };

  const activeHouseForPayments = ownerHouses[0];
  const handleAddPaymentMethod = () => {
    if (!activeHouseForPayments || !paymentDraftValue.trim()) return;
    const next = [
      ...(activeHouseForPayments.paymentMethods || []),
      { id: `pm_${Date.now()}`, type: paymentDraftType, label: PAYMENT_TYPE_LABELS[paymentDraftType], value: paymentDraftValue.trim() },
    ];
    onUpdateHouse?.({ ...activeHouseForPayments, paymentMethods: next });
    setPaymentDraftValue('');
  };
  const handleRemovePaymentMethod = (id: string) => {
    if (!activeHouseForPayments) return;
    onUpdateHouse?.({ ...activeHouseForPayments, paymentMethods: (activeHouseForPayments.paymentMethods || []).filter((p) => p.id !== id) });
  };

  // Owner records a phone/walk-in booking. Guest identity here is just a
  // name+phone (no account) — user_id points at the owner so the existing
  // bookings_insert_user RLS policy applies; the capacity trigger (003)
  // still enforces bed availability server-side.
  const handleCreateManualBooking = async () => {
    const house = ownerHouses[0];
    if (!house || !onCreateBooking) return;
    if (!mbName.trim() || !mbCheckIn || !mbCheckOut || mbCheckOut < mbCheckIn) {
      alert('يرجى إدخال اسم الحاجز وتواريخ صحيحة.');
      return;
    }
    const totalPrice = mbPrice ? parseFloat(mbPrice) : 0;
    setMbSaving(true);
    const ok = await onCreateBooking({
      id: `booking_${Date.now()}`,
      houseId: house.id, houseName: house.name,
      userId: owner.id, userName: mbName.trim(), userPhone: mbPhone.trim() || owner.phone, userEmail: owner.email, userRole: 'individual',
      checkIn: mbCheckIn, checkOut: mbCheckOut, guestsCount: mbGuests,
      totalPrice, depositPaid: false, depositAmount: Math.round(totalPrice * settings.depositRate),
      status: 'approved', source: mbType, isLargeConferenceQuote: false, paymentStatus: 'unpaid',
      createdAt: new Date().toISOString(),
    });
    setMbSaving(false);
    if (ok) {
      setShowAddBooking(false);
      setMbName(''); setMbPhone(''); setMbCheckIn(''); setMbCheckOut(''); setMbGuests(10); setMbPrice('');
    }
  };

  // Mobile bottom nav (mockup order, RTL right→left): الحجوزات، الغرف،
  // الرئيسية (مرتفعة في النص)، المحادثات، التقارير. "المزيد" moved to the
  // hero's menu button (toggles the same overflow panel).
  const MOBILE_TABS: { key: ActiveTab; label: string; icon: React.ElementType; center?: boolean }[] = [
    { key: 'bookings', label: 'الحجوزات', icon: ClipboardList },
    { key: 'rooms', label: 'الغرف', icon: BedDouble },
    { key: 'stats', label: 'الرئيسية', icon: Home, center: true },
    { key: 'messages', label: 'المحادثات', icon: MessageCircle },
    { key: 'reports', label: 'التقارير', icon: BarChart3 },
  ];

  // Desktop sidebar: نظام تنقل متداخل — الحجوزات والغرف مجموعتان قابلتان
  // للطي (تطابق شكل الموكاب)، والباقي عناصر مباشرة.
  const SIDEBAR_LEADING: { key: ActiveTab; label: string; icon: React.ElementType }[] = [
    { key: 'stats', label: 'لوحة التحكم', icon: Home },
  ];
  const SIDEBAR_TRAILING: { key: ActiveTab; label: string; icon: React.ElementType }[] = [
    { key: 'messages', label: 'المحادثات', icon: MessageCircle },
    { key: 'customers', label: 'العملاء', icon: Users },
    { key: 'financials', label: 'الحسابات', icon: Coins },
    { key: 'reports', label: 'التقارير', icon: BarChart3 },
    { key: 'reviews', label: 'التقييمات', icon: MessageSquare },
    { key: 'house', label: 'بيانات البيت', icon: Building },
    { key: 'notifications', label: 'الإشعارات', icon: Bell },
    { key: 'profile', label: 'الإعدادات', icon: Settings },
  ];

  const renderSidebarLeaf = (item: { key: ActiveTab; label: string; icon: React.ElementType }, indent = false) => {
    const Icon = item.icon;
    const isSel = activeTab === item.key;
    const badgeCount =
      item.key === 'notifications' ? unreadNotificationsCount : 0;
    return (
      <button
        key={item.key}
        id={`owner-sidebar-${item.key}`}
        type="button"
        onClick={() => { if (item.key === 'house') openHouseTab(); else { setActiveTab(item.key); setShowOverflow(false); } }}
        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-right transition-all cursor-pointer ${indent ? 'mr-3 py-2' : ''} ${
          isSel ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
        }`}
      >
        <Icon className="w-4 h-4 shrink-0" />
        <span className="flex-1">{item.label}</span>
        {badgeCount > 0 && <span className="text-[9px] bg-rose-500 text-white px-1.5 py-0.5 rounded-full">{badgeCount}</span>}
      </button>
    );
  };

  return (
    <div className="owner-theme text-right text-[var(--color-owner-text)] w-full max-w-full overflow-x-hidden lg:flex lg:gap-5 lg:items-start">
      {/* Desktop sidebar (right side in RTL — first in DOM) */}
      <aside className="hidden lg:flex flex-col w-60 shrink-0 sticky top-0 bg-[var(--color-owner-primary)] text-white rounded-3xl p-4 gap-1 max-h-[calc(100vh-2rem)] overflow-y-auto">
        <div className="pb-3 mb-2 border-b border-white/10">
          <span className="text-[10px] text-[var(--color-owner-accent)] font-black block">لوحة تحكم مالك البيوت</span>
          <h2 className="text-sm font-extrabold">{owner.name}</h2>
        </div>

        {SIDEBAR_LEADING.map((item) => renderSidebarLeaf(item))}

        {/* الحجوزات — group */}
        <button
          id="owner-sidebar-group-bookings"
          type="button"
          onClick={() => setExpandedGroup((g) => (g === 'bookings' ? null : 'bookings'))}
          className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-right transition-all cursor-pointer ${
            (activeTab === 'bookings' && !showOverflow) || expandedGroup === 'bookings' ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
          }`}
        >
          <ClipboardList className="w-4 h-4 shrink-0" />
          <span className="flex-1">الحجوزات</span>
          {pendingBookings.length > 0 && <span className="text-[9px] bg-rose-500 text-white px-1.5 py-0.5 rounded-full">{pendingBookings.length}</span>}
          <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${expandedGroup === 'bookings' ? 'rotate-180' : ''}`} />
        </button>
        {expandedGroup === 'bookings' && (
          <div className="flex flex-col gap-1">
            <button type="button" onClick={() => { setActiveTab('bookings'); setSourceFilter('all'); setShowOverflow(false); }}
              className={`flex items-center gap-2.5 px-3 py-2 mr-3 rounded-xl text-[11px] font-bold text-right transition-all cursor-pointer ${
                activeTab === 'bookings' && sourceFilter === 'all' ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`}>
              <span>جميع الحجوزات</span>
            </button>
            <button id="owner-sidebar-add-booking" type="button" onClick={() => { setActiveTab('bookings'); setShowOverflow(false); setShowAddBooking(true); }}
              className="flex items-center gap-2.5 px-3 py-2 mr-3 rounded-xl text-[11px] font-bold text-right text-[var(--color-owner-accent)] hover:bg-white/10 transition-all cursor-pointer">
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span>إضافة حجز جديد</span>
            </button>
            <button type="button" onClick={() => { setActiveTab('bookings'); setSourceFilter('manual'); setShowOverflow(false); }}
              className={`flex items-center gap-2.5 px-3 py-2 mr-3 rounded-xl text-[11px] font-bold text-right transition-all cursor-pointer ${
                activeTab === 'bookings' && sourceFilter === 'manual' ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`}>
              <span>الحجوزات اليدوية</span>
            </button>
            <button type="button" onClick={() => { setActiveTab('bookings'); setSourceFilter('temporary'); setShowOverflow(false); }}
              className={`flex items-center gap-2.5 px-3 py-2 mr-3 rounded-xl text-[11px] font-bold text-right transition-all cursor-pointer ${
                activeTab === 'bookings' && sourceFilter === 'temporary' ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`}>
              <span>الحجوزات المؤقتة</span>
            </button>
          </div>
        )}

        {SIDEBAR_TRAILING.slice(0, 1).map((item) => renderSidebarLeaf(item))}

        {/* الغرف — group */}
        <button
          id="owner-sidebar-group-rooms"
          type="button"
          onClick={() => setExpandedGroup((g) => (g === 'rooms' ? null : 'rooms'))}
          className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-right transition-all cursor-pointer ${
            (['rooms', 'occupancy', 'room_distribution'].includes(activeTab)) || expandedGroup === 'rooms' ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
          }`}
        >
          <BedDouble className="w-4 h-4 shrink-0" />
          <span className="flex-1">الغرف</span>
          <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${expandedGroup === 'rooms' ? 'rotate-180' : ''}`} />
        </button>
        {expandedGroup === 'rooms' && (
          <div className="flex flex-col gap-1">
            {([
              { key: 'rooms' as const, label: 'عرض الغرف' },
              { key: 'occupancy' as const, label: 'خريطة الإشغال' },
              { key: 'room_distribution' as const, label: 'توزيع الغرف' },
            ]).map((s) => (
              <button key={s.key} type="button" onClick={() => { setActiveTab(s.key); setShowOverflow(false); }}
                className={`flex items-center gap-2.5 px-3 py-2 mr-3 rounded-xl text-[11px] font-bold text-right transition-all cursor-pointer ${
                  activeTab === s.key ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}>
                <span>{s.label}</span>
              </button>
            ))}
          </div>
        )}

        {SIDEBAR_TRAILING.slice(1).map((item) => renderSidebarLeaf(item))}

        {onLogout && (
          <button
            id="owner-sidebar-logout"
            type="button"
            onClick={() => { if (confirm('هل تريد تسجيل الخروج؟')) onLogout(); }}
            className="flex items-center gap-2.5 px-3 py-2.5 mt-2 pt-3 border-t border-white/10 rounded-xl text-xs font-bold text-right text-rose-200 hover:bg-white/10 hover:text-white transition-all cursor-pointer"
          >
            <KeyRound className="w-4 h-4 shrink-0" />
            <span className="flex-1">تسجيل خروج</span>
          </button>
        )}
      </aside>

      <div className="flex-1 min-w-0 space-y-4">
      <div className="bg-[var(--color-owner-primary)] text-white rounded-3xl p-4 flex items-center justify-between lg:hidden">
        <div>
          <span className="text-[10px] text-[var(--color-owner-accent)] font-black">لوحة تحكم مالك البيوت</span>
          <h2 className="text-sm font-extrabold">{owner.name}</h2>
        </div>
        <div className="flex gap-1">
          <span className="text-[9px] bg-white/10 border border-white/20 text-white px-2 py-0.5 rounded-full">
            {ownerHouses.length} بيت مسجل
          </span>
        </div>
      </div>

      {/* Mobile bottom-style nav (mockup): floating rounded bar, center home
          elevated as a dark pill, numeric badges on bookings/messages. */}
      <div className="flex items-end border border-[var(--color-owner-border)] bg-[var(--color-owner-surface)] px-2 pb-1.5 pt-2 rounded-3xl gap-1 relative shadow-sm lg:hidden">
        {MOBILE_TABS.map((t) => {
          const Icon = t.icon;
          const isSel = activeTab === t.key && !showOverflow;
          const badgeCount = t.key === 'bookings' ? pendingBookings.length
            : t.key === 'messages' ? unreadNotificationsCount
            : 0;
          if (t.center) {
            return (
              <button
                key={t.key}
                id={`owner-primary-tab-${t.key}`}
                type="button"
                onClick={() => { setActiveTab(t.key); setShowOverflow(false); }}
                className={`flex-1 flex flex-col items-center gap-0.5 -mt-6 cursor-pointer`}
              >
                <span className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all ${
                  isSel ? 'bg-[var(--color-owner-primary)] text-white' : 'bg-[var(--color-owner-primary)]/85 text-white'
                }`}>
                  <Icon className="w-5 h-5" />
                </span>
                <span className={`text-[9.5px] font-bold ${isSel ? 'text-[var(--color-owner-primary)]' : 'text-[var(--color-owner-secondary)]'}`}>{t.label}</span>
              </button>
            );
          }
          return (
            <button
              key={t.key}
              id={`owner-primary-tab-${t.key}`}
              type="button"
              onClick={() => { setActiveTab(t.key); setShowOverflow(false); }}
              className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-xl text-[10px] font-bold transition-all cursor-pointer relative ${
                isSel ? 'text-[var(--color-owner-primary)]' : 'text-[var(--color-owner-secondary)] hover:text-[var(--color-owner-text)]'
              }`}
            >
              <Icon className="w-[18px] h-[18px]" />
              <span>{t.label}</span>
              {badgeCount > 0 && (
                <span className="absolute -top-0.5 left-1/2 -translate-x-4 min-w-[15px] h-[15px] px-0.5 bg-rose-500 text-white text-[8.5px] font-black rounded-full flex items-center justify-center">
                  {badgeCount > 9 ? '9+' : badgeCount}
                </span>
              )}
            </button>
          );
        })}

        {showOverflow && (
          <div className="absolute top-full mt-1.5 inset-x-0 bg-[var(--color-owner-surface)] border border-[var(--color-owner-border)] rounded-2xl shadow-lg p-2 grid grid-cols-2 gap-1.5 z-20">
            {OVERFLOW_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  id={`owner-overflow-${item.key}`}
                  type="button"
                  onClick={() => item.key === 'house' ? openHouseTab() : (() => { setActiveTab(item.key); setShowOverflow(false); })()}
                  className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-[10.5px] font-bold text-right transition-all cursor-pointer ${
                    activeTab === item.key ? 'bg-[var(--color-owner-primary)] text-white' : 'text-[var(--color-owner-text)] hover:bg-[var(--color-owner-hover)]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{item.label}</span>
                  {item.key === 'notifications' && unreadNotificationsCount > 0 && (
                    <span className="mr-auto text-[9px] bg-rose-500 text-white px-1.5 rounded-full">{unreadNotificationsCount}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 1. Home — overview only: welcome, house status, today's alerts, quick actions,
             pending tasks, recent notifications. No stats grid / booking list / charts here
             by design — those live on Bookings/Reports/Finance now. */}
      {activeTab === 'stats' && (() => {
        const house = ownerHouses[0];
        const arrivalsToday = ownerBookings.filter((b) => b.status === 'approved' && b.checkIn === todayStr);
        const departuresToday = ownerBookings.filter((b) => b.status === 'approved' && b.checkOut === todayStr);
        const unpaidApproved = ownerBookings.filter((b) => b.status === 'approved' && !b.depositPaid);
        const hour = now.getHours();
        const greeting = hour < 12 ? 'صباح الخير' : 'مساء الخير';
        const recentNotifications = notifications.filter((n) => n.userId === owner.id).slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 3);

        const totalRooms = ownerRooms.length;
        const totalBeds = ownerRooms.length > 0 ? ownerRooms.reduce((s, r) => s + r.bedsCount, 0) : (house?.bedsCount ?? 0);
        const occupiedBedsNow = todayBookings.reduce((s, b) => s + b.guestsCount, 0);
        const roomBedStates = ownerRooms.map((r) => getRoomBedState(r, allocations, ownerBookings, todayStr));
        const roomStatusCounts = {
          available: roomBedStates.filter((s) => s === 'available').length,
          booked: roomBedStates.filter((s) => s === 'partial' || s === 'full').length,
          cleaning: roomBedStates.filter((s) => s === 'cleaning').length,
          maintenance: roomBedStates.filter((s) => s === 'maintenance').length,
        };

        return (
          <div className="space-y-4">
            {/* ── Hero: greeting + status chip + occupancy donut over the house photo ── */}
            <div className="relative bg-[var(--color-owner-surface)] rounded-3xl border border-[var(--color-owner-border)] overflow-hidden shadow-sm">
              {house?.images?.[0] && (
                <>
                  <img src={house.images[0]} alt="" className="absolute inset-y-0 left-0 w-1/2 h-full object-cover" />
                  <div className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-l from-[var(--color-owner-surface)] via-[var(--color-owner-surface)]/60 to-transparent" />
                </>
              )}
              <div className="relative p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold text-[var(--color-owner-secondary)] truncate">{house ? house.name : 'بيما'}</div>
                    <h3 className="text-base font-black text-[var(--color-owner-text)] mt-0.5">{greeting} يا {owner.name.split(' ')[0]} 👋</h3>
                    <p className="text-[10px] font-bold text-[var(--color-owner-secondary)] mt-0.5">
                      {pendingBookings.length === 0 && unpaidApproved.length === 0 ? 'كل شيء يسير بشكل رائع اليوم 💚' : `عندك ${pendingBookings.length + unpaidApproved.length} مهمة محتاجة انتباهك اليوم ⚡`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button type="button" id="hero-notifications-btn" onClick={() => { setActiveTab('notifications'); setShowOverflow(false); }}
                      className="relative p-2 rounded-xl bg-[var(--color-owner-bg)] border border-[var(--color-owner-border)] text-[var(--color-owner-text)] cursor-pointer">
                      <Bell className="w-4 h-4" />
                      {unreadNotificationsCount > 0 && (
                        <span className="absolute -top-1 -left-1 min-w-[15px] h-[15px] px-0.5 bg-rose-500 text-white text-[8.5px] font-black rounded-full flex items-center justify-center">
                          {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                        </span>
                      )}
                    </button>
                    <button type="button" id="hero-menu-btn" onClick={() => setShowOverflow((v) => !v)}
                      className="p-2 rounded-xl bg-[var(--color-owner-bg)] border border-[var(--color-owner-border)] text-[var(--color-owner-text)] cursor-pointer lg:hidden">
                      <Menu className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {house && (
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                    house.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                    house.status === 'pending' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${house.status === 'approved' ? 'bg-emerald-500' : house.status === 'pending' ? 'bg-amber-500' : 'bg-rose-500'}`} />
                    {house.status === 'approved' ? 'نشط' : house.status === 'pending' ? 'قيد المراجعة' : 'مرفوض'}
                  </span>
                )}

                <div className="flex items-center gap-3">
                  <div className="relative w-[74px] h-[74px] shrink-0">
                    <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                      <circle cx="50" cy="50" r="40" fill="none" stroke="var(--color-owner-hover)" strokeWidth="11" />
                      <circle cx="50" cy="50" r="40" fill="none" stroke="#10b981" strokeWidth="11" strokeLinecap="round"
                        strokeDasharray={`${(occupancyRate / 100) * 251.2} 251.2`} />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-sm font-black text-[var(--color-owner-text)]">{occupancyRate}%</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-black text-[var(--color-owner-text)]">إشغال اليوم</div>
                    <div className="text-[10px] font-bold text-[var(--color-owner-secondary)]">من إجمالي الأسرّة ({occupiedBedsNow} من {totalBeds} سرير)</div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── 4 KPI cards (mockup): colored icon chips, all clickable ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {([
                { label: 'الحجوزات اليوم', value: ownerBookings.filter((b) => b.createdAt.startsWith(todayStr)).length, unit: 'جديدة', icon: ClipboardList, chip: 'bg-indigo-50 text-indigo-600', tab: 'bookings' as ActiveTab },
                { label: 'إجمالي الغرف', value: totalRooms, unit: 'غرفة', icon: BedDouble, chip: 'bg-sky-50 text-sky-600', tab: 'rooms' as ActiveTab },
                { label: 'المشغول الآن', value: roomStatusCounts.booked, unit: 'غرف', icon: Users, chip: 'bg-orange-50 text-orange-600', tab: 'rooms' as ActiveTab },
                { label: 'المتبقي', value: roomStatusCounts.available, unit: 'غرف', icon: Check, chip: 'bg-emerald-50 text-emerald-600', tab: 'rooms' as ActiveTab },
              ]).map((k) => (
                <button key={k.label} type="button" onClick={() => { setActiveTab(k.tab); setShowOverflow(false); }}
                  className="bg-[var(--color-owner-surface)] rounded-3xl border border-[var(--color-owner-border)] p-3.5 flex flex-col items-center gap-1.5 text-center shadow-sm hover:shadow transition-all cursor-pointer">
                  <span className={`w-10 h-10 rounded-2xl flex items-center justify-center ${k.chip}`}><k.icon className="w-4.5 h-4.5 w-[18px] h-[18px]" /></span>
                  <span className="text-[10px] font-bold text-[var(--color-owner-secondary)]">{k.label}</span>
                  <span className="text-xl font-black text-[var(--color-owner-text)] leading-none">{k.value}</span>
                  <span className="text-[9.5px] font-bold text-[var(--color-owner-secondary)]">{k.unit}</span>
                </button>
              ))}
            </div>

            {/* ── تحتاج انتباه (mockup): derived, each row jumps to its fix ── */}
            {(() => {
              const attentionRooms = roomStatusCounts.cleaning + roomStatusCounts.maintenance;
              const items: { key: string; title: string; sub: string; icon: React.ElementType; chip: string; go: () => void }[] = [];
              if (pendingBookings.length > 0) {
                const newest = pendingBookings.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
                items.push({ key: 'pending', title: pendingBookings.length === 1 ? 'حجز جديد بانتظار الرد' : `${pendingBookings.length} حجوزات جديدة بانتظار الرد`, sub: timeAgo(newest.createdAt), icon: ClipboardList, chip: 'bg-rose-50 text-rose-600', go: () => { setActiveTab('bookings'); setBookingFilter('new'); } });
              }
              if (unpaidApproved.length > 0) {
                items.push({ key: 'unpaid', title: unpaidApproved.length === 1 ? 'عربون متأخر الدفع' : `${unpaidApproved.length} عربون متأخر الدفع`, sub: unpaidApproved.map((b) => b.organizationName || b.userName).slice(0, 2).join('، '), icon: ShieldAlert, chip: 'bg-amber-50 text-amber-600', go: () => { setActiveTab('bookings'); setBookingFilter('pending_payment'); } });
              }
              if (attentionRooms > 0) {
                items.push({ key: 'rooms', title: attentionRooms === 1 ? 'غرفة تحتاج مراجعة' : `${attentionRooms} غرف تحتاج مراجعة`, sub: `${roomStatusCounts.cleaning} تنظيف · ${roomStatusCounts.maintenance} صيانة`, icon: BedDouble, chip: 'bg-emerald-50 text-emerald-600', go: () => setActiveTab('rooms') });
              }
              if (arrivalsToday.length > 0) {
                items.push({ key: 'arrivals', title: `${arrivalsToday.length} وصول اليوم`, sub: arrivalsToday.map((b) => b.organizationName || b.userName).slice(0, 2).join('، '), icon: Calendar, chip: 'bg-sky-50 text-sky-600', go: () => { setActiveTab('bookings'); setBookingFilter('arrivals_today'); } });
              }
              if (departuresToday.length > 0) {
                items.push({ key: 'departures', title: `${departuresToday.length} مغادرة اليوم`, sub: departuresToday.map((b) => b.organizationName || b.userName).slice(0, 2).join('، '), icon: Calendar, chip: 'bg-slate-100 text-slate-600', go: () => { setActiveTab('bookings'); setBookingFilter('departures_today'); } });
              }
              return (
                <div className="bg-[var(--color-owner-surface)] rounded-3xl border border-[var(--color-owner-border)] p-4 space-y-2.5 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-[var(--color-owner-text)]">تحتاج انتباه</span>
                    {items.length > 0 && <span className="min-w-[18px] h-[18px] px-1 bg-rose-500 text-white text-[9.5px] font-black rounded-full flex items-center justify-center">{items.length}</span>}
                  </div>
                  {items.length === 0 ? (
                    <p className="text-[10px] text-[var(--color-owner-secondary)] text-center py-3">لا توجد مهام معلّقة — كل شيء تمام 🎉</p>
                  ) : (
                    <div className="space-y-1.5">
                      {items.map((it) => (
                        <button key={it.key} type="button" onClick={() => { it.go(); setShowOverflow(false); }}
                          className="w-full flex items-center gap-3 bg-[var(--color-owner-bg)] hover:bg-[var(--color-owner-hover)] border border-[var(--color-owner-border)] rounded-2xl p-2.5 text-right transition-colors cursor-pointer">
                          <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${it.chip}`}><it.icon className="w-4 h-4" /></span>
                          <div className="flex-1 min-w-0">
                            <div className="text-[11px] font-extrabold text-[var(--color-owner-text)] truncate">{it.title}</div>
                            <div className="text-[9.5px] font-bold text-[var(--color-owner-secondary)] truncate">{it.sub}</div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-[var(--color-owner-secondary)] rotate-180 shrink-0" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── آخر نشاط (mockup): notifications as a timeline ── */}
            <div className="bg-[var(--color-owner-surface)] rounded-3xl border border-[var(--color-owner-border)] p-4 space-y-2.5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-[var(--color-owner-text)]">آخر نشاط</span>
                <button type="button" onClick={() => { setActiveTab('notifications'); setShowOverflow(false); }} className="text-[10px] font-bold text-[var(--color-owner-primary)] hover:underline cursor-pointer">عرض الكل</button>
              </div>
              {recentNotifications.length === 0 ? (
                <p className="text-[10px] text-[var(--color-owner-secondary)] text-center py-3">لا يوجد نشاط بعد.</p>
              ) : (
                <div className="space-y-0">
                  {recentNotifications.map((n, idx) => (
                    <div key={n.id} className="flex items-stretch gap-2.5">
                      <div className="flex flex-col items-center">
                        <span className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                          n.type === 'success' ? 'bg-emerald-50 text-emerald-600' : n.type === 'danger' ? 'bg-rose-50 text-rose-600' : 'bg-indigo-50 text-indigo-600'
                        }`}>
                          {n.type === 'success' ? <Check className="w-3.5 h-3.5" /> : n.type === 'danger' ? <ShieldAlert className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
                        </span>
                        {idx < recentNotifications.length - 1 && <span className="w-px flex-1 bg-[var(--color-owner-border)] my-1" />}
                      </div>
                      <div className="flex-1 min-w-0 pb-3">
                        <div className="text-[11px] font-extrabold text-[var(--color-owner-text)] truncate">{n.title}</div>
                        <div className="text-[9.5px] font-bold text-[var(--color-owner-secondary)] truncate">{n.message}</div>
                      </div>
                      <span className="text-[9px] font-bold text-[var(--color-owner-secondary)] shrink-0 mt-1">{timeAgo(n.createdAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        );
      })()}

      {/* 2/3. Bookings + drill-down detail */}
      {activeTab === 'bookings' && (
        selectedBooking ? (
          <div className="space-y-3">
            <button type="button" onClick={() => setSelectedBookingId(null)} className="flex items-center gap-1 text-[11px] font-bold text-[var(--color-owner-secondary)] hover:text-[var(--color-owner-text)] cursor-pointer">
              <ChevronRight className="w-4 h-4" /><span>رجوع لكل الحجوزات</span>
            </button>
            {(() => {
              const booking = selectedBooking;
              const isPending = booking.status === 'pending';
              const isApproved = booking.status === 'approved';
              const isCompleted = booking.status === 'completed';
              const depositAmt = booking.depositAmount || Math.round(booking.totalPrice * settings.depositRate);
              const bookingRemaining = booking.totalPrice - (booking.depositPaid ? depositAmt : 0);
              return (
                <div id={`owner-booking-detail-${booking.id}`} className="bg-[var(--color-owner-surface)] rounded-3xl border border-[var(--color-owner-border)] shadow-sm p-4 space-y-3 text-right">
                  <div>
                    <span className="text-[9px] text-[var(--color-owner-secondary)] font-bold flex items-center gap-1.5">
                      الحساب: {booking.userName}
                      {booking.source === 'manual' && <span className="text-[8px] font-bold bg-[var(--color-owner-hover)] text-[var(--color-owner-primary)] border border-[var(--color-owner-border)] px-1.5 py-0.5 rounded-full">يدوي 📞</span>}
                      {booking.source === 'temporary' && <span className="text-[8px] font-bold bg-sky-50 text-sky-800 border border-sky-200 px-1.5 py-0.5 rounded-full">مؤقت ⏳</span>}
                    </span>
                    <h4 className="text-sm font-black text-[var(--color-owner-text)] mt-0.5">{booking.houseName}</h4>
                    <div className="text-[10px] text-[var(--color-owner-secondary)] font-medium">
                      {booking.organizationName && <span>{booking.organizationName} • </span>}رقم الهاتف: {booking.userPhone}
                    </div>
                  </div>
                  <div className="bg-[var(--color-owner-hover)] rounded-2xl p-3 grid grid-cols-2 gap-2 text-[10px] text-[var(--color-owner-text)] font-medium border border-[var(--color-owner-border)]">
                    <div>تاريخ الوصول: <strong>{booking.checkIn}</strong></div>
                    <div>تاريخ المغادرة: <strong>{booking.checkOut}</strong></div>
                    <div>عدد الأفراد: <strong>{booking.guestsCount} فرد</strong></div>
                    <div>قيمة الحجز: <strong className="text-[var(--color-owner-primary)] font-extrabold">{booking.totalPrice.toLocaleString()} ج.م</strong></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className={`p-2 rounded-xl border ${booking.depositPaid ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                      <div className="font-bold text-[9px] mb-0.5" style={{ color: booking.depositPaid ? '#065f46' : '#92400e' }}>
                        {booking.depositPaid ? '✓ العربون المستلم' : 'العربون (لم يُستلم)'}
                      </div>
                      <div className="font-extrabold" style={{ color: booking.depositPaid ? '#065f46' : '#92400e' }}>{depositAmt.toLocaleString()} ج.م</div>
                    </div>
                    <div className="p-2 rounded-xl border bg-slate-50 border-slate-200">
                      <div className="text-slate-700 font-bold text-[9px] mb-0.5">المبلغ المتبقي</div>
                      <div className="text-slate-800 font-extrabold">{bookingRemaining.toLocaleString()} ج.م</div>
                    </div>
                  </div>
                  {(isPending || isApproved) && onUpdateBookingDetails && (
                    <div className="border border-[var(--color-owner-border)] rounded-2xl p-3 space-y-2">
                      {editingBookingId === booking.id ? (
                        <>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="block text-[9px] font-bold text-[var(--color-owner-secondary)] mb-0.5">الوصول</label>
                              <input type="date" value={editCheckIn} onChange={(e) => setEditCheckIn(e.target.value)} onFocus={(e) => e.target.select()}
                                className="w-full bg-[var(--color-owner-bg)] border border-[var(--color-owner-border)] rounded-lg px-2 py-1.5 text-[10px] text-[var(--color-owner-text)]" />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-[var(--color-owner-secondary)] mb-0.5">المغادرة</label>
                              <input type="date" value={editCheckOut} onChange={(e) => setEditCheckOut(e.target.value)} onFocus={(e) => e.target.select()}
                                className="w-full bg-[var(--color-owner-bg)] border border-[var(--color-owner-border)] rounded-lg px-2 py-1.5 text-[10px] text-[var(--color-owner-text)]" />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-[var(--color-owner-secondary)] mb-0.5">عدد الأفراد</label>
                              <input type="number" min={1} value={editGuests} onChange={(e) => setEditGuests(parseInt(e.target.value) || 1)} onFocus={(e) => e.target.select()}
                                className="w-full bg-[var(--color-owner-bg)] border border-[var(--color-owner-border)] rounded-lg px-2 py-1.5 text-[10px] text-[var(--color-owner-text)]" />
                            </div>
                          </div>
                          {(() => {
                            const house = ownerHouses.find((h) => h.id === booking.houseId);
                            if (!house || !editCheckIn || !editCheckOut) return null;
                            const availability = getHouseRoomAvailabilityForRange(ownerRooms, allocations, ownerBookings, house.id, editCheckIn, editCheckOut, booking.id);
                            if (availability.length === 0) return null;
                            const totalFree = availability.reduce((s, a) => s + a.freeBeds, 0);
                            return totalFree < editGuests ? (
                              <div className="bg-amber-50 border border-amber-200 rounded-xl p-2 text-[9.5px] text-amber-900 font-bold">
                                يمكن استيعاب {totalFree} من {editGuests} فرد فقط في هذه التواريخ حسب الغرف المتاحة. سيتم قبول الحجز رغم ذلك حسب سعة البيت الكلية، لكن التوزيع على الغرف سيحتاج مراجعة يدوية.
                              </div>
                            ) : null;
                          })()}
                          <div className="flex gap-2 justify-end">
                            <button type="button" onClick={() => setEditingBookingId(null)} className="text-[10px] font-bold text-[var(--color-owner-secondary)] px-3 py-1.5 cursor-pointer">إلغاء</button>
                            <button
                              type="button"
                              disabled={editSaving}
                              onClick={async () => {
                                setEditSaving(true);
                                const ok = await onUpdateBookingDetails(booking.id, { checkIn: editCheckIn, checkOut: editCheckOut, guestsCount: editGuests });
                                setEditSaving(false);
                                if (ok) setEditingBookingId(null);
                              }}
                              className="bg-[var(--color-owner-primary)] hover:bg-[var(--color-owner-primary-hover)] text-white text-[10px] font-extrabold px-3 py-1.5 rounded-xl cursor-pointer disabled:opacity-60"
                            >{editSaving ? 'جارٍ الحفظ...' : 'حفظ التعديل'}</button>
                          </div>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => { setEditingBookingId(booking.id); setEditCheckIn(booking.checkIn); setEditCheckOut(booking.checkOut); setEditGuests(booking.guestsCount); }}
                          className="text-[10px] font-bold text-[var(--color-owner-primary)] hover:underline cursor-pointer"
                        >تعديل التواريخ / عدد الأفراد</button>
                      )}
                    </div>
                  )}
                  {booking.isLargeConferenceQuote && booking.conferenceDetails && (
                    <div className="bg-amber-50/40 p-2.5 rounded-xl border border-amber-200/60 text-[10px] text-[var(--color-owner-text)] space-y-1">
                      <span className="font-bold text-amber-900 block">📝 ملاحظات وطلبات العميل:</span>
                      <p className="italic text-slate-700">{booking.conferenceDetails.extraRequests}</p>
                    </div>
                  )}
                  {isPending && (
                    <div className="flex gap-2 justify-end pt-2 flex-wrap">
                      <button onClick={() => { if (confirm('هل أنت متأكد من رفض هذا الحجز؟')) onRejectBooking(booking.id); }}
                        className="flex items-center gap-1 bg-[var(--color-owner-bg)] hover:bg-rose-50 hover:text-rose-800 text-[var(--color-owner-text)] border border-[var(--color-owner-border)] px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer">
                        <X className="w-4 h-4" /><span>رفض الطلب</span>
                      </button>
                      <button onClick={() => onApproveBooking(booking.id)}
                        className="flex items-center gap-1 bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-1.5 rounded-xl text-xs font-extrabold transition-all shadow-sm cursor-pointer">
                        <Check className="w-4 h-4" /><span>قبول وتأكيد الحجز</span>
                      </button>
                    </div>
                  )}
                  {isApproved && (
                    <div className="flex gap-2 justify-end pt-2 flex-wrap">
                      {booking.source === 'temporary' && (
                        <button onClick={() => { if (confirm('إلغاء الحجز المؤقت وتحرير السعة المحجوزة؟')) onRejectBooking(booking.id); }}
                          className="flex items-center gap-1 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer">
                          <X className="w-4 h-4" /><span>إلغاء الحجز المؤقت</span>
                        </button>
                      )}
                      {!booking.depositPaid && onConfirmDeposit && (
                        <button onClick={() => { if (confirm(`تأكيد استلام عربون بمبلغ ${depositAmt.toLocaleString()} ج.م؟`)) onConfirmDeposit(booking.id); }}
                          className="flex items-center gap-1 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer">
                          <Coins className="w-4 h-4" /><span>تأكيد استلام العربون</span>
                        </button>
                      )}
                      {!booking.checkedInAt && onCheckInBooking && (
                        <button onClick={() => onCheckInBooking(booking.id)}
                          className="flex items-center gap-1 bg-sky-600 hover:bg-sky-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer">
                          <Home className="w-4 h-4" /><span>تسجيل وصول</span>
                        </button>
                      )}
                      {booking.checkedInAt && !booking.checkedOutAt && onCheckOutBooking && (
                        <button onClick={() => { if (confirm('تسجيل مغادرة العميل وإنهاء الحجز؟')) onCheckOutBooking(booking.id); }}
                          className="flex items-center gap-1 bg-slate-600 hover:bg-slate-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer">
                          <span>🚪 تسجيل مغادرة</span>
                        </button>
                      )}
                      <button onClick={() => { setActiveAllocationBooking(booking); onOpenRoomDistribution?.(booking.id); }}
                        className="flex items-center gap-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer">
                        <Building className="w-4 h-4 text-amber-700" /><span>توزيع الغرف 🛏️</span>
                      </button>
                      {onRecalculateAllocation && (
                        <button
                          disabled={recalcSaving}
                          onClick={async () => { setRecalcSaving(true); await onRecalculateAllocation(booking.houseId, booking.id); setRecalcSaving(false); }}
                          className="flex items-center gap-1 bg-[var(--color-owner-bg)] hover:bg-[var(--color-owner-hover)] text-[var(--color-owner-text)] border border-[var(--color-owner-border)] px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-60">
                          <Shuffle className="w-4 h-4" /><span>{recalcSaving ? 'جارٍ إعادة التوزيع...' : 'إعادة حساب التوزيع'}</span>
                        </button>
                      )}
                    </div>
                  )}
                  {isCompleted && (
                    <div className="flex justify-end pt-1">
                      <button onClick={() => { setActiveAllocationBooking(booking); onOpenRoomDistribution?.(booking.id); }}
                        className="flex items-center gap-1 bg-[var(--color-owner-bg)] hover:bg-[var(--color-owner-hover)] text-[var(--color-owner-text)] border border-[var(--color-owner-border)] px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer">
                        <Building className="w-4 h-4" /><span>عرض توزيع الغرف</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[var(--color-owner-secondary)] absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  id="owner-bookings-search"
                  type="text"
                  value={bookingSearch}
                  onChange={(e) => setBookingSearch(e.target.value)}
                  placeholder="ابحث بالاسم أو رقم الهاتف أو اسم البيت..."
                  className="w-full bg-[var(--color-owner-surface)] border border-[var(--color-owner-border)] rounded-2xl pr-9 pl-3 py-2.5 text-xs text-[var(--color-owner-text)] outline-none focus:border-[var(--color-owner-primary)]"
                />
              </div>
              <button
                id="owner-add-booking-toggle"
                type="button"
                onClick={() => setShowAddBooking((v) => !v)}
                className="flex items-center gap-1 bg-[var(--color-owner-primary)] hover:bg-[var(--color-owner-primary-hover)] text-white text-[10px] font-bold px-3 py-2 rounded-2xl shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة حجز</span>
              </button>
            </div>

            {showAddBooking && (
              <div className="bg-[var(--color-owner-surface)] rounded-3xl border border-[var(--color-owner-border)] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-[var(--color-owner-text)]">إضافة حجز يدوي / مؤقت</span>
                  <button type="button" onClick={() => setShowAddBooking(false)} className="text-[var(--color-owner-secondary)] cursor-pointer"><X className="w-4 h-4" /></button>
                </div>
                <p className="text-[9.5px] text-[var(--color-owner-secondary)]">للحجوزات اللي بتوصلك بالتليفون أو الحضور المباشر. الحجز المؤقت بيحجز السعة لحد ما المجموعة تأكد، وتقدر ترفضه في أي وقت لإلغائه.</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[8.5px] font-bold text-[var(--color-owner-secondary)] mb-0.5">اسم الحاجز / الجهة:</label>
                    <input id="mb-name" type="text" value={mbName} onChange={(e) => setMbName(e.target.value)}
                      className="w-full bg-white border border-[var(--color-owner-border)] text-[10px] px-2 py-1.5 rounded-lg focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-[8.5px] font-bold text-[var(--color-owner-secondary)] mb-0.5">رقم الهاتف:</label>
                    <input id="mb-phone" type="tel" value={mbPhone} onChange={(e) => setMbPhone(e.target.value)}
                      className="w-full bg-white border border-[var(--color-owner-border)] text-[10px] px-2 py-1.5 rounded-lg focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-[8.5px] font-bold text-[var(--color-owner-secondary)] mb-0.5">نوع الحجز:</label>
                    <select id="mb-type" value={mbType} onChange={(e) => setMbType(e.target.value as 'manual' | 'temporary')}
                      className="w-full bg-white border border-[var(--color-owner-border)] text-[10px] px-2 py-1.5 rounded-lg focus:outline-none">
                      <option value="manual">يدوي مؤكد</option>
                      <option value="temporary">مؤقت (بانتظار التأكيد)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[8.5px] font-bold text-[var(--color-owner-secondary)] mb-0.5">تاريخ الوصول:</label>
                    <input id="mb-checkin" type="date" value={mbCheckIn} onChange={(e) => setMbCheckIn(e.target.value)}
                      className="w-full bg-white border border-[var(--color-owner-border)] text-[10px] px-2 py-1.5 rounded-lg focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-[8.5px] font-bold text-[var(--color-owner-secondary)] mb-0.5">تاريخ المغادرة:</label>
                    <input id="mb-checkout" type="date" value={mbCheckOut} onChange={(e) => setMbCheckOut(e.target.value)}
                      className="w-full bg-white border border-[var(--color-owner-border)] text-[10px] px-2 py-1.5 rounded-lg focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-[8.5px] font-bold text-[var(--color-owner-secondary)] mb-0.5">عدد الأفراد:</label>
                    <input id="mb-guests" type="number" min={1} value={mbGuests} onChange={(e) => setMbGuests(parseInt(e.target.value) || 1)} onFocus={(e) => e.target.select()}
                      className="w-full bg-white border border-[var(--color-owner-border)] text-[10px] px-2 py-1.5 rounded-lg focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-[8.5px] font-bold text-[var(--color-owner-secondary)] mb-0.5">إجمالي السعر (ج.م):</label>
                    <input id="mb-price" type="number" min={0} value={mbPrice} onChange={(e) => setMbPrice(e.target.value)} onFocus={(e) => e.target.select()}
                      className="w-full bg-white border border-[var(--color-owner-border)] text-[10px] px-2 py-1.5 rounded-lg focus:outline-none" />
                  </div>
                </div>
                {(() => {
                  const house = ownerHouses[0];
                  if (!house || !mbCheckIn || !mbCheckOut) return null;
                  const availability = getHouseRoomAvailabilityForRange(ownerRooms, allocations, ownerBookings, house.id, mbCheckIn, mbCheckOut);
                  if (availability.length === 0) return null;
                  const totalFree = availability.reduce((s, a) => s + a.freeBeds, 0);
                  return totalFree < mbGuests ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-[9.5px] text-amber-900 font-bold">
                      يمكن استيعاب {totalFree} من {mbGuests} فرد فقط في هذه التواريخ حسب الغرف المتاحة حالياً. يمكنك المتابعة، لكن التوزيع على الغرف سيحتاج مراجعة يدوية بعد الحفظ.
                    </div>
                  ) : null;
                })()}
                <button
                  id="mb-submit"
                  type="button"
                  onClick={handleCreateManualBooking}
                  disabled={mbSaving}
                  className="w-full bg-[var(--color-owner-primary)] hover:bg-[var(--color-owner-primary-hover)] disabled:opacity-50 text-white text-xs font-bold py-2.5 rounded-xl cursor-pointer"
                >
                  {mbSaving ? 'جارٍ الحفظ...' : mbType === 'manual' ? 'تسجيل الحجز المؤكد' : 'تسجيل الحجز المؤقت'}
                </button>
              </div>
            )}

            <div className="flex items-center gap-1.5 text-[10px] font-bold">
              <span className="text-[var(--color-owner-secondary)] shrink-0">مصدر الحجز:</span>
              {([
                { key: 'all' as const, label: 'الكل' },
                { key: 'manual' as const, label: 'يدوي 📞' },
                { key: 'temporary' as const, label: 'مؤقت ⏳' },
              ]).map((s) => (
                <button key={s.key} type="button" onClick={() => setSourceFilter(s.key)}
                  className={`px-2 py-1 rounded-lg transition-all cursor-pointer ${
                    sourceFilter === s.key ? 'bg-[var(--color-owner-primary)] text-white' : 'bg-[var(--color-owner-surface)] border border-[var(--color-owner-border)] text-[var(--color-owner-secondary)]'
                  }`}
                >{s.label}</button>
              ))}
            </div>

            <div className="flex flex-wrap gap-1.5 bg-[var(--color-owner-surface)] border border-[var(--color-owner-border)] p-1.5 rounded-2xl">
              {([
                { key: 'all', label: 'الكل', color: 'bg-[var(--color-owner-primary)]' },
                { key: 'new', label: 'طلبات جديدة', color: 'bg-amber-600' },
                { key: 'pending_payment', label: 'بانتظار الدفع', color: 'bg-[var(--color-owner-info)]' },
                { key: 'confirmed', label: 'مؤكدة', color: 'bg-emerald-600' },
                { key: 'arrivals_today', label: 'وصول اليوم', color: 'bg-sky-600' },
                { key: 'departures_today', label: 'مغادرة اليوم', color: 'bg-slate-600' },
                { key: 'completed', label: 'مكتملة', color: 'bg-slate-500' },
                { key: 'cancelled', label: 'ملغاة', color: 'bg-rose-500' },
                { key: 'waitlist', label: 'قائمة الانتظار', color: 'bg-purple-600' },
              ] as const).map((f) => {
                const isSel = bookingFilter === f.key;
                const count = bookingCountByCategory[f.key];
                return (
                  <button key={f.key} id={`owner-booking-filter-${f.key}`} onClick={() => setBookingFilter(f.key)}
                    className={`flex items-center gap-1.5 text-[10px] font-extrabold px-2.5 py-1 rounded-xl transition-all cursor-pointer ${
                      isSel ? `${f.color} text-white shadow-sm` : 'bg-[var(--color-owner-bg)] text-[var(--color-owner-secondary)] hover:bg-[var(--color-owner-hover)]'
                    }`}
                  >
                    <span>{f.label}</span>
                    <span className={`text-[9px] px-1.5 rounded-full ${isSel ? 'bg-white/25' : 'bg-white border border-[var(--color-owner-border)] text-[var(--color-owner-text)]'}`}>{count}</span>
                  </button>
                );
              })}
            </div>

            {bookingFilter === 'waitlist' ? (
              ownerWaitlist.length === 0 ? (
                <div className="bg-[var(--color-owner-surface)] rounded-2xl border border-[var(--color-owner-border)] p-6 text-center text-[10px] text-[var(--color-owner-secondary)]">
                  لا يوجد عملاء في قائمة الانتظار حالياً.
                </div>
              ) : (
                <div className="space-y-2">
                  {ownerWaitlist.slice().sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).map((w) => (
                    <div key={w.id} className="bg-[var(--color-owner-surface)] rounded-2xl border border-[var(--color-owner-border)] p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[var(--color-owner-text)]">{w.userName}</span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          w.status === 'waiting' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                          w.status === 'notified' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-[var(--color-owner-bg)] text-[var(--color-owner-secondary)]'
                        }`}>
                          {w.status === 'waiting' ? 'بانتظار مكان' : w.status === 'notified' ? 'تم الإشعار' : w.status === 'expired' ? 'منتهية' : 'ملغاة'}
                        </span>
                      </div>
                      <div className="text-[10px] text-[var(--color-owner-secondary)]">{w.checkIn} → {w.checkOut} · {w.guestsCount} فرد · {w.userPhone}</div>
                    </div>
                  ))}
                </div>
              )
            ) : filteredOwnerBookings.length === 0 ? (
              <div className="bg-[var(--color-owner-surface)] rounded-3xl p-8 border border-[var(--color-owner-border)] text-center">
                <p className="text-xs text-[var(--color-owner-secondary)]">{ownerBookings.length === 0 ? 'لا يوجد أي حجوزات واردة لبيوتك بعد.' : 'لا توجد حجوزات في هذا التصنيف حالياً.'}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredOwnerBookings.map((booking) => {
                  const category = categorizeBooking(booking);
                  const statusBadge = (() => {
                    if (booking.status === 'rejected') return { label: 'مرفوض', cls: 'bg-rose-50 text-rose-800 border-rose-200' };
                    if (booking.status === 'cancelled') return { label: 'ملغى من المستخدم', cls: 'bg-slate-50 text-slate-600 border-slate-200' };
                    if (booking.status === 'completed') return { label: 'مكتمل', cls: 'bg-slate-100 text-slate-700 border-slate-200' };
                    if (booking.status === 'pending') return { label: 'جديد ⚠️', cls: 'bg-amber-50 text-amber-800 border-amber-200' };
                    if (category === 'arrivals_today') return { label: 'وصول اليوم', cls: 'bg-sky-50 text-sky-800 border-sky-200' };
                    if (category === 'departures_today') return { label: 'مغادرة اليوم', cls: 'bg-slate-50 text-slate-700 border-slate-200' };
                    if (category === 'pending_payment') return { label: 'بانتظار الدفع', cls: 'bg-sky-50 text-sky-800 border-sky-200' };
                    return { label: 'مؤكد', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
                  })();
                  const depositAmt = booking.depositAmount || Math.round(booking.totalPrice * settings.depositRate);
                  const outstanding = booking.totalPrice - (booking.depositPaid ? depositAmt : 0);
                  const whatsappLink = `https://wa.me/2${booking.userPhone.replace(/^0/, '')}`;
                  return (
                    <div
                      id={`owner-booking-${booking.id}`}
                      key={booking.id}
                      onClick={() => setSelectedBookingId(booking.id)}
                      className="w-full text-right bg-[var(--color-owner-surface)] hover:bg-[var(--color-owner-hover)] rounded-3xl border border-[var(--color-owner-border)] shadow-sm p-4 space-y-2 transition-colors cursor-pointer"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[9px] text-[var(--color-owner-secondary)] font-bold flex items-center gap-1.5">
                            الحساب: {booking.userName}
                            {booking.source === 'manual' && <span className="text-[8px] font-bold bg-[var(--color-owner-hover)] text-[var(--color-owner-primary)] border border-[var(--color-owner-border)] px-1.5 py-0.5 rounded-full">يدوي 📞</span>}
                            {booking.source === 'temporary' && <span className="text-[8px] font-bold bg-sky-50 text-sky-800 border border-sky-200 px-1.5 py-0.5 rounded-full">مؤقت ⏳</span>}
                          </span>
                          <h4 className="text-xs font-bold text-[var(--color-owner-text)] mt-0.5">{booking.houseName}</h4>
                          <div className="text-[10px] text-[var(--color-owner-secondary)] font-medium">{booking.checkIn} → {booking.checkOut} · {booking.guestsCount} فرد</div>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${statusBadge.cls}`}>{statusBadge.label}</span>
                      </div>
                      {outstanding > 0 && (
                        <div className="text-[10px] font-bold text-[var(--color-owner-warning)]">المبلغ المتبقي: {outstanding.toLocaleString()} ج.م</div>
                      )}
                      <div className="flex gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                        <a href={`tel:${booking.userPhone}`} className="flex items-center gap-1 bg-[var(--color-owner-bg)] hover:bg-[var(--color-owner-hover)] border border-[var(--color-owner-border)] text-[var(--color-owner-text)] px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer">
                          <Phone className="w-3 h-3" /><span>اتصال</span>
                        </a>
                        <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer">
                          <MessageCircle className="w-3 h-3" /><span>واتساب</span>
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )
      )}

      {/* Messages */}
      {activeTab === 'messages' && <OwnerMessages owner={owner} ownerBookings={ownerBookings} users={users} />}

      {/* Calendar / occupancy — dynamic current + next month */}
      {activeTab === 'occupancy' && (
        <div className="bg-[var(--color-owner-surface)] p-6 rounded-3xl border border-[var(--color-owner-border)] text-right space-y-6">
          <div className="flex items-center gap-3 border-b border-[var(--color-owner-border)] pb-4">
            <div className="p-2.5 rounded-2xl bg-[var(--color-owner-hover)] text-[var(--color-owner-primary)] border border-[var(--color-owner-border)]">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-[var(--color-owner-text)]">لوحة التحكم الكاملة في أيام الإشغال والتواريخ المتاحة 🗓️</h3>
              <p className="text-[10px] text-[var(--color-owner-secondary)]">حدد تواريخ أعمال الصيانة، التجهيز، أو الحجوزات اليدوية الداخلية لحظرها أو إتاحتها للجميع.</p>
            </div>
          </div>

          {blockSuccessMsg && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-950 p-4 rounded-2xl flex items-center gap-3 text-xs font-bold">
              <span className="text-lg">✅</span><span>{blockSuccessMsg}</span>
            </div>
          )}

          {ownerHouses.length === 0 ? (
            <div className="text-center py-8 text-xs text-[var(--color-owner-secondary)]">لم تقم بتسجيل أي بيت خلوة باسمك حتى الآن. يرجى تسجيل بيت أولاً لتفعيل لوحة الإشغال.</div>
          ) : (() => {
            const activeHouse = ownerHouses[0];
            const blockedList = activeHouse.blockedDates || [];
            const monthsToShow = [0, 1].map((offset) => {
              const d = new Date(curYear, now.getMonth() + offset, 1);
              return { year: d.getFullYear(), month: d.getMonth() + 1, label: d.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' }) };
            });
            return (
              <div className="space-y-6">
                <div className="bg-[var(--color-owner-bg)] border border-[var(--color-owner-border)] p-4 rounded-2xl text-xs space-y-2">
                  <span className="font-extrabold text-[var(--color-owner-text)] block">🏨 البيت الخاضع للإدارة والتحكم: "{activeHouse.name}"</span>
                  <p className="text-[10.5px] text-[var(--color-owner-primary)] leading-relaxed">
                    التواريخ التي يتم حظرها هنا ستظهر فوراً كغير متاحة للحجز للخدام ولن يستطيع أحد تقديم طلب حجز فيها.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <form onSubmit={(e) => handleBlockDateSubmit(e, activeHouse)} className="bg-[var(--color-owner-bg)] border border-[var(--color-owner-border)] p-4 rounded-2xl space-y-4">
                    <span className="text-xs font-black text-[var(--color-owner-text)] block pb-2 border-b border-[var(--color-owner-border)]">🔒 حظر أو إغلاق فترة معينة:</span>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold text-[var(--color-owner-secondary)]">من تاريخ 📆:</label>
                        <input id="block-date-picker" type="date" required value={selectedBlockDate} onChange={(e) => setSelectedBlockDate(e.target.value)}
                          className="w-full bg-white border border-[var(--color-owner-border)] text-xs px-3 py-2 rounded-xl text-[var(--color-owner-text)] focus:outline-none text-left" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold text-[var(--color-owner-secondary)]">إلى تاريخ (اختياري لتحديد أكتر من يوم):</label>
                        <input id="block-date-picker-end" type="date" min={selectedBlockDate || undefined} value={selectedBlockDateEnd} onChange={(e) => setSelectedBlockDateEnd(e.target.value)}
                          className="w-full bg-white border border-[var(--color-owner-border)] text-xs px-3 py-2 rounded-xl text-[var(--color-owner-text)] focus:outline-none text-left" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-[var(--color-owner-secondary)]">سبب الحظر أو الإشغال 📝:</label>
                      <input id="block-date-reason" type="text" required value={blockReason} onChange={(e) => setBlockReason(e.target.value)} onFocus={(e) => e.target.select()}
                        className="w-full bg-white border border-[var(--color-owner-border)] text-xs px-3 py-2 rounded-xl text-[var(--color-owner-text)] focus:outline-none" />
                    </div>
                    <button id="submit-block-btn" type="submit" className="w-full bg-[var(--color-owner-primary)] hover:bg-[var(--color-owner-primary-hover)] text-white text-xs font-bold py-2.5 rounded-xl transition-all shadow-sm cursor-pointer">
                      🔒 حظر وإغلاق هذا التاريخ الآن
                    </button>
                  </form>

                  <div className="bg-white border border-[var(--color-owner-border)] p-4 rounded-2xl flex flex-col space-y-3">
                    <span className="text-xs font-black text-[var(--color-owner-text)] block pb-2 border-b border-[var(--color-owner-border)]">🚫 قائمة التواريخ المغلقة والمحجوزة يدوياً ({blockedList.length}):</span>
                    {blockedList.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center py-8 text-center text-[11px] text-[var(--color-owner-secondary)] space-y-1">
                        <span>🌟 لا توجد أي تواريخ محظورة يدوياً.</span>
                      </div>
                    ) : (
                      <div className="flex-1 overflow-y-auto max-h-[220px] space-y-2">
                        {blockedList.map((dateStr) => (
                          <div key={dateStr} className="bg-rose-50/50 border border-rose-100 p-2.5 rounded-xl flex items-center justify-between text-xs">
                            <div>
                              <div className="font-extrabold text-[var(--color-owner-text)]">{dateStr}</div>
                              <div className="text-[9px] text-rose-800 font-bold">مغلق للصيانة والخدمة ⚠️</div>
                            </div>
                            <button id={`unblock-btn-${dateStr}`} type="button" onClick={() => handleUnblockDate(dateStr, activeHouse)}
                              className="bg-white hover:bg-emerald-50 border border-rose-200 hover:border-emerald-200 text-rose-700 hover:text-emerald-700 text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all shadow-sm cursor-pointer">
                              إلغاء الحظر 🔓
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-[var(--color-owner-border)]">
                  <span className="text-xs font-black text-[var(--color-owner-text)] block">📅 المعاينة الحية لجدول الإشغال الكلي:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {monthsToShow.map(({ year, month, label }) => {
                      const daysCount = new Date(year, month, 0).getDate();
                      const firstWeekday = new Date(year, month - 1, 1).getDay();
                      return (
                        <div key={`${year}-${month}`} className="border border-[var(--color-owner-border)] bg-white p-3 rounded-2xl space-y-2">
                          <div className="text-center text-xs font-extrabold text-[var(--color-owner-text)] pb-1.5 border-b border-[var(--color-owner-border)]">{label}</div>
                          <div className="grid grid-cols-7 gap-1 text-[9px] font-bold text-[var(--color-owner-secondary)] text-center mb-1">
                            <div>ح</div><div>ن</div><div>ث</div><div>ر</div><div>خ</div><div>ج</div><div>س</div>
                          </div>
                          <div className="grid grid-cols-7 gap-1">
                            {Array.from({ length: firstWeekday }).map((_, i) => <div key={`pad-${year}-${month}-${i}`} />)}
                            {Array.from({ length: daysCount }, (_, i) => i + 1).map((day) => {
                              const dateStr = `${year}-${month < 10 ? '0' + month : month}-${day < 10 ? '0' + day : day}`;
                              const isBlocked = blockedList.includes(dateStr);
                              const isBooked = isDateBooked(activeHouse.id, year, month, day);
                              return (
                                <div key={`${year}-${month}-day-${day}`}
                                  className={`py-1 rounded text-center text-[10px] font-bold ${
                                    isBlocked ? 'bg-rose-600 text-white shadow-sm' : isBooked ? 'bg-amber-100 text-amber-900 border border-amber-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-100'
                                  }`}
                                  title={isBlocked ? 'مغلق ومحجوز يدوياً' : isBooked ? 'محجوز رسمياً' : 'شاغر ومتاح'}
                                >{day}</div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-center gap-4 text-[9.5px] font-bold text-[var(--color-owner-secondary)] pt-1 flex-wrap">
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-rose-600 border border-rose-700" /><span>مغلق يدويًا</span></span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-100 border border-amber-200" /><span>محجوز رسميًا</span></span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-50 border border-emerald-100" /><span>شاغر ومتاح</span></span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Overflow: Rooms */}
      {activeTab === 'rooms' && (
        <div className="space-y-3">
          {ownerHouses.length === 0 ? (
            <div className="bg-[var(--color-owner-surface)] rounded-2xl border border-[var(--color-owner-border)] p-6 text-center text-xs text-[var(--color-owner-secondary)]">
              أضف بيتك أولاً من "بيانات البيت" قبل إدارة الغرف.
            </div>
          ) : (
            <>
              <div className="bg-[var(--color-owner-surface)] rounded-2xl border border-[var(--color-owner-border)] p-4 space-y-3">
                <div className="text-xs font-bold text-[var(--color-owner-text)] flex items-center gap-1.5">
                  <BedDouble className="w-4 h-4 text-[var(--color-owner-primary)]" />
                  {editingRoomId ? 'تعديل بيانات الغرفة' : 'إضافة غرفة جديدة'}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="block text-[8.5px] font-bold text-[var(--color-owner-secondary)] mb-0.5">اسم/رقم الغرفة:</label>
                    <input id="room-name-input" type="text" value={roomName} onChange={(e) => setRoomName(e.target.value)} onFocus={(e) => e.target.select()}
                      className="w-full bg-white border border-[var(--color-owner-border)] text-[10px] px-2 py-1.5 rounded-lg focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-[8.5px] font-bold text-[var(--color-owner-secondary)] mb-0.5">عدد الأسرة:</label>
                    <input id="room-beds-input" type="number" min={1} value={roomBeds} onChange={(e) => setRoomBeds(parseInt(e.target.value) || 1)} onFocus={(e) => e.target.select()}
                      className="w-full bg-white border border-[var(--color-owner-border)] text-[10px] px-2 py-1.5 rounded-lg focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-[8.5px] font-bold text-[var(--color-owner-secondary)] mb-0.5">الدور:</label>
                    <input id="room-floor-input" type="number" min={0} value={roomFloor} onChange={(e) => setRoomFloor(parseInt(e.target.value) || 1)} onFocus={(e) => e.target.select()}
                      className="w-full bg-white border border-[var(--color-owner-border)] text-[10px] px-2 py-1.5 rounded-lg focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-[8.5px] font-bold text-[var(--color-owner-secondary)] mb-0.5">السعر لليلة (اختياري):</label>
                    <input id="room-price-input" type="number" min={0} value={roomPrice} onChange={(e) => setRoomPrice(e.target.value)} onFocus={(e) => e.target.select()}
                      className="w-full bg-white border border-[var(--color-owner-border)] text-[10px] px-2 py-1.5 rounded-lg focus:outline-none" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button id="room-submit-btn" type="button" onClick={() => {
                      if (!roomName.trim()) { alert('يرجى إدخال اسم الغرفة.'); return; }
                      const house = ownerHouses[0];
                      if (editingRoomId) {
                        const existing = ownerRooms.find((r) => r.id === editingRoomId);
                        if (existing && onUpdateRoom) onUpdateRoom({ ...existing, name: roomName.trim(), bedsCount: roomBeds, floor: roomFloor, pricePerNight: roomPrice ? parseFloat(roomPrice) : undefined });
                      } else if (onAddRoom) {
                        onAddRoom({ id: `room_${Date.now()}`, houseId: house.id, name: roomName.trim(), bedsCount: roomBeds, floor: roomFloor, pricePerNight: roomPrice ? parseFloat(roomPrice) : undefined, images: [], status: 'available', createdAt: new Date().toISOString() });
                      }
                      setRoomName(''); setRoomBeds(2); setRoomFloor(1); setRoomPrice(''); setEditingRoomId(null);
                    }}
                    className="bg-[var(--color-owner-primary)] hover:bg-[var(--color-owner-primary-hover)] text-white text-[10px] font-bold px-4 py-2 rounded-xl cursor-pointer">
                    {editingRoomId ? 'حفظ التعديل' : 'إضافة الغرفة'}
                  </button>
                  {editingRoomId && (
                    <button type="button" onClick={() => { setEditingRoomId(null); setRoomName(''); setRoomBeds(2); setRoomFloor(1); setRoomPrice(''); }}
                      className="bg-[var(--color-owner-bg)] text-[var(--color-owner-text)] text-[10px] font-bold px-4 py-2 rounded-xl cursor-pointer">إلغاء</button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <div className="text-xs font-bold text-[var(--color-owner-secondary)]">خريطة الإشغال ({ownerRooms.length} غرفة):</div>
                  <div className="flex gap-2.5 text-[8.5px] font-bold text-[var(--color-owner-secondary)]">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />متاحة</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" />مشغولة</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />تنظيف</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-400" />صيانة</span>
                  </div>
                </div>
                {ownerRooms.length === 0 ? (
                  <div className="bg-[var(--color-owner-surface)] rounded-2xl border border-[var(--color-owner-border)] p-4 text-center text-[10px] text-[var(--color-owner-secondary)]">لا توجد غرف مضافة بعد.</div>
                ) : (
                  // Rooms grouped per floor — the occupancy map from the mockup.
                  [...new Set(ownerRooms.map((r) => r.floor ?? 1))].sort((a, b) => a - b).map((floor) => (
                    <div key={floor} className="bg-[var(--color-owner-surface)] rounded-2xl border border-[var(--color-owner-border)] p-3 space-y-2">
                      <div className="text-[10px] font-black text-[var(--color-owner-text)]">
                        {floor === 0 ? 'الدور الأرضي' : `الدور ${floor}`}
                      </div>
                      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                        {ownerRooms.filter((r) => (r.floor ?? 1) === floor).map((room) => {
                          const bedState = getRoomBedState(room, allocations, ownerBookings, todayStr);
                          const cls =
                            bedState === 'available' ? 'bg-emerald-50 border-emerald-300 text-emerald-900' :
                            bedState === 'partial' ? 'bg-amber-50 border-amber-300 text-amber-900' :
                            bedState === 'full' ? 'bg-rose-50 border-rose-300 text-rose-900' :
                            bedState === 'cleaning' ? 'bg-sky-50 border-sky-300 text-sky-900' :
                            'bg-slate-100 border-slate-300 text-slate-700';
                          const label =
                            bedState === 'available' ? 'متاحة' : bedState === 'partial' ? 'مشغولة جزئياً' :
                            bedState === 'full' ? 'ممتلئة' : bedState === 'cleaning' ? 'تنظيف' : 'صيانة';
                          return (
                            <button key={room.id} type="button" onClick={() => setSelectedRoomId(selectedRoomId === room.id ? null : room.id)}
                              className={`flex flex-col items-center justify-center gap-1 aspect-square rounded-2xl border-2 p-2 text-center transition-all cursor-pointer ${cls} ${selectedRoomId === room.id ? 'ring-2 ring-[var(--color-owner-primary)]' : ''}`}
                            >
                              <BedDouble className="w-4 h-4" />
                              <span className="text-[10px] font-black truncate w-full">{room.name}</span>
                              <span className="text-[8px] font-bold">{label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}

                {selectedRoomId && (() => {
                  const room = ownerRooms.find((r) => r.id === selectedRoomId);
                  if (!room) return null;
                  return (
                    <div className="bg-[var(--color-owner-surface)] rounded-2xl border border-[var(--color-owner-border)] p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-[var(--color-owner-text)]">{room.name}</span>
                        <button type="button" onClick={() => setSelectedRoomId(null)} className="text-[var(--color-owner-secondary)] cursor-pointer"><X className="w-4 h-4" /></button>
                      </div>
                      <div className="text-[10px] text-[var(--color-owner-secondary)]">{room.bedsCount} سرير · {room.pricePerNight ? `${room.pricePerNight} ج.م/ليلة` : 'سعر البيت الافتراضي'}</div>
                      <div className="text-[9px] text-[var(--color-owner-secondary)] font-bold">
                        حالة الإشغال (متاحة/مشغولة جزئياً/ممتلئة) تُحسب تلقائياً من الحجوزات. اضبط هنا فقط حالات التنظيف والصيانة اليدوية:
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {([
                          { key: 'available', label: 'إلغاء الحظر (متاحة)' },
                          { key: 'cleaning', label: 'تنظيف' }, { key: 'maintenance', label: 'صيانة' },
                        ] as const).map((s) => (
                          <button key={s.key} type="button" onClick={() => onUpdateRoom && onUpdateRoom({ ...room, status: s.key })}
                            className={`text-[9px] font-bold py-1.5 rounded-lg border cursor-pointer ${
                              room.status === s.key ? 'bg-[var(--color-owner-primary)] border-[var(--color-owner-primary)] text-white' : 'bg-[var(--color-owner-bg)] border-[var(--color-owner-border)] text-[var(--color-owner-text)]'
                            }`}
                          >{s.label}</button>
                        ))}
                      </div>
                      {(() => {
                        // Per-room occupancy calendar for the current month, from the
                        // bookings actually allocated to this room (توزيع الغرف). If no
                        // allocation links this room yet, say so rather than guessing
                        // from house-level bookings.
                        const roomBookingIds = new Set(allocations.filter((al) => al.roomId === room.id).map((al) => al.bookingId));
                        const roomBookings = ownerBookings.filter((b) => roomBookingIds.has(b.id) && (b.status === 'approved' || b.status === 'completed'));
                        const daysCount = new Date(curYear, curMonth, 0).getDate();
                        const firstWeekday = new Date(curYear, curMonth - 1, 1).getDay();
                        const monthLabel = new Date(curYear, curMonth - 1, 1).toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
                        return (
                          <div className="space-y-1.5 pt-1 border-t border-[var(--color-owner-border)]">
                            <div className="text-[9.5px] font-black text-[var(--color-owner-text)]">تواريخ إشغال الغرفة — {monthLabel}</div>
                            {roomBookings.length === 0 ? (
                              <p className="text-[9px] text-[var(--color-owner-secondary)]">لا توجد حجوزات موزّعة على هذه الغرفة بعد — التوزيع بيتم من "توزيع الغرف" داخل الحجز.</p>
                            ) : (
                              <>
                                <div className="grid grid-cols-7 gap-1 text-[8px] font-bold text-[var(--color-owner-secondary)] text-center">
                                  <div>ح</div><div>ن</div><div>ث</div><div>ر</div><div>خ</div><div>ج</div><div>س</div>
                                </div>
                                <div className="grid grid-cols-7 gap-1">
                                  {Array.from({ length: firstWeekday }).map((_, i) => <div key={`pad-room-${i}`} />)}
                                  {Array.from({ length: daysCount }, (_, i) => i + 1).map((day) => {
                                    const dateStr = `${curYear}-${curMonth < 10 ? '0' + curMonth : curMonth}-${day < 10 ? '0' + day : day}`;
                                    const occupiedBy = roomBookings.find((b) => dateStr >= b.checkIn && dateStr <= b.checkOut);
                                    return (
                                      <div key={`room-day-${day}`}
                                        title={occupiedBy ? `${occupiedBy.organizationName || occupiedBy.userName}` : 'شاغرة'}
                                        className={`py-0.5 rounded text-center text-[9px] font-bold ${
                                          occupiedBy ? 'bg-rose-100 text-rose-900 border border-rose-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-100'
                                        }`}
                                      >{day}</div>
                                    );
                                  })}
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })()}

                      <div className="flex gap-2 pt-1">
                        <button type="button" onClick={() => { setEditingRoomId(room.id); setRoomName(room.name); setRoomBeds(room.bedsCount); setRoomFloor(room.floor ?? 1); setRoomPrice(room.pricePerNight?.toString() || ''); setSelectedRoomId(null); }}
                          className="flex-1 text-[10px] font-bold text-[var(--color-owner-primary)] border border-[var(--color-owner-primary)]/30 rounded-lg py-1.5 hover:bg-[var(--color-owner-hover)] cursor-pointer">تعديل البيانات</button>
                        <button type="button" onClick={() => { if (confirm('هل تريد حذف هذه الغرفة؟') && onDeleteRoom) { onDeleteRoom(room.id); setSelectedRoomId(null); } }}
                          className="flex-1 text-[10px] font-bold text-rose-600 border border-rose-200 rounded-lg py-1.5 hover:bg-rose-50 cursor-pointer">حذف الغرفة</button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </>
          )}
        </div>
      )}

      {/* Overflow: Room Distribution — house-wide view */}
      {activeTab === 'room_distribution' && (
        <OwnerRoomDistributionScreen
          rooms={ownerRooms}
          allocations={allocations}
          bookings={ownerBookings}
          onOpenBooking={(booking) => { setActiveAllocationBooking(booking); onOpenRoomDistribution?.(booking.id); }}
          onRecalculateAll={async () => { if (ownerHouses[0] && onRecalculateAllocation) await onRecalculateAllocation(ownerHouses[0].id); }}
        />
      )}

      {/* Overflow: Customers */}
      {activeTab === 'customers' && <OwnerCustomers bookings={ownerBookings} />}

      {/* Overflow: Finance */}
      {activeTab === 'financials' && (
        <div className="space-y-4">
          <div className="bg-[var(--color-owner-surface)] p-4 rounded-3xl border border-[var(--color-owner-border)] space-y-3 text-right">
            <h3 className="text-xs font-black text-[var(--color-owner-text)] border-b border-[var(--color-owner-border)] pb-2">📊 نظرة عامة على الإيرادات</h3>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="bg-[var(--color-owner-hover)] p-2.5 rounded-xl border border-[var(--color-owner-border)]">
                <div className="text-[9px] text-[var(--color-owner-secondary)] font-bold mb-0.5">إجمالي قيمة الحجوزات المؤكدة</div>
                <div className="text-sm font-extrabold text-[var(--color-owner-text)]">{confirmedRevenue.toLocaleString()} ج.م</div>
              </div>
              <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                <div className="text-[9px] text-emerald-800 font-bold mb-0.5">العربون المستلم</div>
                <div className="text-sm font-extrabold text-emerald-900">{depositReceived.toLocaleString()} ج.م</div>
              </div>
              <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                <div className="text-[9px] text-amber-800 font-bold mb-0.5">المبلغ المتبقي (لم يُحصّل بعد)</div>
                <div className="text-sm font-extrabold text-amber-900">{remainingBalance.toLocaleString()} ج.م</div>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <div className="text-[9px] text-slate-700 font-bold mb-0.5">عدد الحجوزات المؤكدة</div>
                <div className="text-sm font-extrabold text-slate-800">{confirmedBookings.length} حجز</div>
              </div>
            </div>
          </div>

          <div className="bg-[var(--color-owner-surface)] p-4 rounded-3xl border border-[var(--color-owner-border)] space-y-3 text-right">
            <h3 className="text-xs font-black text-[var(--color-owner-text)] border-b border-[var(--color-owner-border)] pb-2">🧾 عمولة التطبيق ({(PLATFORM_COMMISSION * 100).toFixed(0)}%)</h3>
            <div className="space-y-2 text-[11px]">
              <div className="flex justify-between items-center bg-[var(--color-owner-hover)] p-2.5 rounded-xl border border-[var(--color-owner-border)]">
                <span className="text-[var(--color-owner-secondary)] font-bold">إجمالي قيمة الحجوزات</span>
                <span className="font-extrabold text-[var(--color-owner-text)]">{confirmedRevenue.toLocaleString()} ج.م</span>
              </div>
              <div className="flex justify-between items-center bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                <span className="text-rose-800 font-bold">عمولة المنصة ({(PLATFORM_COMMISSION * 100).toFixed(0)}%)</span>
                <span className="font-extrabold text-rose-900">− {platformCommissionAmount.toLocaleString()} ج.م</span>
              </div>
              <div className="flex justify-between items-center bg-emerald-100 p-3 rounded-xl border-2 border-emerald-400">
                <span className="text-emerald-900 font-black">✓ صافي مستحقاتك</span>
                <span className="text-base font-black text-emerald-900">{netOwnerPayout.toLocaleString()} ج.م</span>
              </div>
            </div>
          </div>

          <div className="bg-[var(--color-owner-surface)] p-4 rounded-3xl border border-[var(--color-owner-border)] space-y-3 text-right">
            <h3 className="text-xs font-black text-[var(--color-owner-text)] border-b border-[var(--color-owner-border)] pb-2">💸 المصروفات</h3>
            <div className="flex gap-2">
              <input type="text" placeholder="وصف المصروف" value={expenseDesc} onChange={(e) => setExpenseDesc(e.target.value)}
                className="flex-1 bg-white border border-[var(--color-owner-border)] text-[10px] px-2.5 py-1.5 rounded-lg text-[var(--color-owner-text)] focus:outline-none" />
              <input type="number" min={0} placeholder="المبلغ" value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} onFocus={(e) => e.target.select()}
                className="w-24 bg-white border border-[var(--color-owner-border)] text-[10px] px-2.5 py-1.5 rounded-lg text-[var(--color-owner-text)] focus:outline-none" />
              <button type="button" onClick={() => {
                  const amount = parseFloat(expenseAmount);
                  if (!expenseDesc.trim() || !amount || amount <= 0 || !ownerHouses[0]) return;
                  onAddExpense?.({ id: `exp_${Date.now()}`, houseId: ownerHouses[0].id, description: expenseDesc.trim(), amount, expenseDate: new Date().toISOString().split('T')[0], createdAt: new Date().toISOString() });
                  setExpenseDesc(''); setExpenseAmount('');
                }}
                className="bg-[var(--color-owner-primary)] text-white text-[10px] font-bold px-3 py-1.5 rounded-lg shrink-0 cursor-pointer">إضافة</button>
            </div>
            {ownerExpenses.length === 0 ? (
              <p className="text-[10px] text-[var(--color-owner-secondary)]">لا توجد مصروفات مسجلة بعد.</p>
            ) : (
              <div className="space-y-1.5">
                {ownerExpenses.map((e) => (
                  <div key={e.id} className="flex items-center justify-between bg-[var(--color-owner-bg)] border border-[var(--color-owner-border)] rounded-xl px-3 py-2 text-[10.5px]">
                    <div><span className="font-bold text-[var(--color-owner-text)]">{e.description}</span><span className="text-[var(--color-owner-secondary)] mr-2">{e.expenseDate}</span></div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-rose-700">− {e.amount.toLocaleString()} ج.م</span>
                      <button type="button" onClick={() => onDeleteExpense?.(e.id)} className="text-rose-600 hover:text-rose-800 cursor-pointer"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-between items-center bg-[var(--color-owner-primary)]/10 p-3 rounded-xl border-2 border-[var(--color-owner-primary)]/30">
              <span className="text-[var(--color-owner-primary)] font-black">💰 صافي الربح (بعد المصروفات)</span>
              <span className="text-base font-black text-[var(--color-owner-primary)]">{netProfit.toLocaleString()} ج.م</span>
            </div>
          </div>

          <div className="bg-[var(--color-owner-surface)] p-4 rounded-3xl border border-[var(--color-owner-border)] space-y-3 text-right">
            <h3 className="text-xs font-black text-[var(--color-owner-text)] border-b border-[var(--color-owner-border)] pb-2">📝 سجل العمليات المالية</h3>
            {confirmedBookings.length === 0 ? (
              <p className="text-[11px] text-[var(--color-owner-secondary)] text-center py-3">لا توجد حجوزات مؤكدة بعد.</p>
            ) : (
              <div className="overflow-x-auto -mx-2">
                <table className="min-w-full text-[10px] text-right">
                  <thead className="bg-[var(--color-owner-hover)] text-[var(--color-owner-text)] font-extrabold">
                    <tr><th className="px-2 py-1.5">رقم الحجز</th><th className="px-2 py-1.5">القيمة</th><th className="px-2 py-1.5">العمولة</th><th className="px-2 py-1.5">الصافي</th><th className="px-2 py-1.5">الحالة</th></tr>
                  </thead>
                  <tbody>
                    {confirmedBookings.map((b) => {
                      const comm = b.totalPrice * PLATFORM_COMMISSION;
                      const net = b.totalPrice - comm;
                      return (
                        <tr key={b.id} className="border-t border-[var(--color-owner-border)]">
                          <td className="px-2 py-1.5 font-mono text-[9px] text-[var(--color-owner-secondary)]">#{b.id.replace('booking_', '').slice(0, 8)}</td>
                          <td className="px-2 py-1.5 font-bold text-[var(--color-owner-text)]">{b.totalPrice.toLocaleString()}</td>
                          <td className="px-2 py-1.5 text-rose-700 font-bold">− {comm.toLocaleString()}</td>
                          <td className="px-2 py-1.5 text-emerald-800 font-extrabold">{net.toLocaleString()}</td>
                          <td className="px-2 py-1.5">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${b.depositPaid ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'}`}>
                              {b.depositPaid ? 'تم التحويل' : 'قيد المراجعة'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Overflow: Reviews */}
      {activeTab === 'reviews' && (
        <div className="bg-[var(--color-owner-surface)] p-6 rounded-3xl border border-[var(--color-owner-border)] text-right space-y-6">
          <div className="flex items-center gap-3 border-b border-[var(--color-owner-border)] pb-4">
            <div className="p-2.5 rounded-2xl bg-[var(--color-owner-hover)] text-[var(--color-owner-primary)] border border-[var(--color-owner-border)]"><MessageSquare className="w-5 h-5" /></div>
            <div>
              <h3 className="text-sm font-black text-[var(--color-owner-text)]">صلاحية الرد الفوري على تقييمات الخدام باسم البيت 💬</h3>
              <p className="text-[10px] text-[var(--color-owner-secondary)]">اكتب ردوداً ترحيبية رسمية باسم بيت المؤتمرات.</p>
            </div>
          </div>
          {reviewsSuccessMsg && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-950 p-4 rounded-2xl flex items-center gap-3 text-xs font-bold">
              <span className="text-lg">✅</span><span>{reviewsSuccessMsg}</span>
            </div>
          )}
          {ownerReviews.length === 0 ? (
            <div className="text-center py-12 bg-[var(--color-owner-bg)] rounded-3xl border border-[var(--color-owner-border)] space-y-2">
              <p className="text-xs font-bold text-[var(--color-owner-text)]">لا توجد أي تقييمات مكتوبة لبيتكم بعد.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {ownerReviews.map((rev) => (
                <div key={rev.id} className="bg-[var(--color-owner-bg)] border border-[var(--color-owner-border)] rounded-3xl p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs font-extrabold text-[var(--color-owner-text)]">{rev.userName}</span>
                      <span className="text-[9.5px] text-[var(--color-owner-secondary)] font-medium block mt-0.5">{rev.houseName}</span>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 text-amber-900 px-2 py-0.5 rounded-lg text-[10px] font-mono font-black">{rev.rating} / 5 ★</div>
                  </div>
                  <p className="text-[11px] text-[var(--color-owner-text)] leading-relaxed font-medium bg-white p-3 rounded-2xl border border-[var(--color-owner-border)]">"{rev.comment}"</p>
                  {rev.ownerReply ? (
                    <div className="bg-[var(--color-owner-primary)]/5 border-r-2 border-[var(--color-owner-primary)] p-3 rounded-l-2xl space-y-2">
                      <div className="flex items-center justify-between text-[10px] font-extrabold text-[var(--color-owner-primary)]"><span>رد الإدارة الحالي 🏨:</span></div>
                      <p className="text-[10.5px] text-[var(--color-owner-text)] leading-relaxed">{rev.ownerReply}</p>
                      <div className="flex gap-2 justify-end pt-1">
                        <button type="button" onClick={() => { setReplyingToReviewId(rev.id); setReviewReplyText(rev.ownerReply || ''); }} className="text-[9.5px] font-bold text-[var(--color-owner-primary)] hover:underline cursor-pointer">تعديل الرد ✏️</button>
                        <button type="button" onClick={() => handleDeleteReply(rev.id)} className="text-[9.5px] font-bold text-red-600 hover:underline cursor-pointer">حذف الرد ✕</button>
                      </div>
                    </div>
                  ) : replyingToReviewId === rev.id ? (
                    <form onSubmit={(e) => handleAddReplySubmit(e, rev.id)} className="space-y-2 pt-2">
                      <textarea required value={reviewReplyText} onChange={(e) => setReviewReplyText(e.target.value)}
                        className="w-full bg-white border border-[var(--color-owner-border)] rounded-xl p-2.5 text-[10.5px] text-[var(--color-owner-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-owner-primary)]" rows={3} />
                      <div className="flex gap-2">
                        <button type="submit" className="bg-[var(--color-owner-primary)] hover:bg-[var(--color-owner-primary-hover)] text-white text-[10px] font-bold px-3 py-1.5 rounded-lg cursor-pointer">إرسال الرد الرسمي</button>
                        <button type="button" onClick={() => { setReplyingToReviewId(null); setReviewReplyText(''); }} className="bg-[var(--color-owner-bg)] text-[var(--color-owner-text)] text-[10px] font-bold px-3 py-1.5 rounded-lg cursor-pointer">إلغاء</button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex justify-end">
                      <button type="button" onClick={() => { setReplyingToReviewId(rev.id); setReviewReplyText(''); }}
                        className="bg-[var(--color-owner-primary)]/10 hover:bg-[var(--color-owner-primary)]/20 text-[var(--color-owner-primary)] text-[10.5px] font-extrabold px-3 py-1.5 rounded-xl cursor-pointer">💬 كتابة رد رسمي باسم المكان</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Overflow: House Info */}
      {/* Unified House page — Images / Pricing / Facilities / Policies / Location / Food / Gallery,
          in that order, merging what used to be three separate nav destinations. */}
      {activeTab === 'house' && (
        <div className="space-y-4">
          {ownerHouses.length >= 1 && (
            <div className="bg-[var(--color-owner-surface)] rounded-3xl border border-[var(--color-owner-border)] p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--color-owner-text)]">حالة البيت الحالية:</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                  ownerHouses[0].status === 'approved' ? 'bg-emerald-600 text-white' : ownerHouses[0].status === 'pending' ? 'bg-amber-600 text-white' : 'bg-rose-600 text-white'
                }`}>
                  {ownerHouses[0].status === 'approved' ? 'نشط ويظهر للجميع' : ownerHouses[0].status === 'pending' ? 'بانتظار موافقة الإدارة' : 'مرفوض'}
                </span>
              </div>
              {ownerHouses[0].pendingEdit && (
                <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-2.5 text-[10.5px] font-bold flex items-start gap-2">
                  <span>⏳</span><span>لديك تعديل مُرسل بانتظار موافقة الإدارة.</span>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmitHouse} className="bg-[var(--color-owner-surface)] rounded-3xl border border-[var(--color-owner-border)] p-5 space-y-5 text-right">
            <div className="space-y-1 pb-2 border-b border-[var(--color-owner-border)]">
              <h3 className="text-xs font-extrabold text-[var(--color-owner-text)]">{ownerHouses.length >= 1 ? 'تعديل بيانات بيتك الحالي' : 'تفاصيل تسجيل بيت مؤتمرات جديد'}</h3>
            </div>

            {/* Basic info — name/type/description, prerequisite fields not covered by the 7 named sections below */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-[var(--color-owner-secondary)] mb-1">نوع وتصنيف العقار السكني:</label>
                  <select id="add-property-type" value={propertyType} onChange={(e) => setPropertyType(e.target.value as 'conference' | 'student' | 'staff')}
                    className="w-full bg-white border border-[var(--color-owner-border)] text-xs px-2.5 py-2 rounded-xl text-[var(--color-owner-text)] focus:outline-none">
                    <option value="conference">بيت مؤتمرات / فندق مسيحي</option>
                    <option value="student">سكن طلاب وطالبات مغتربين</option>
                    <option value="staff">سكن موظفين ومغتربين</option>
                  </select>
                </div>
                {propertyType === 'student' && (
                  <div>
                    <label className="block text-[11px] font-bold text-[var(--color-owner-secondary)] mb-1">فئة السكن الطلابية:</label>
                    <select value={studentHousingGender} onChange={(e) => setStudentHousingGender(e.target.value as 'boys' | 'girls')}
                      className="w-full bg-white border border-[var(--color-owner-border)] text-xs px-2.5 py-2 rounded-xl text-[var(--color-owner-text)] focus:outline-none">
                      <option value="boys">بنين (شباب مسيحي)</option><option value="girls">بنات (شابات مسيحيات)</option>
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[var(--color-owner-secondary)] mb-1">{propertyType === 'conference' ? 'اسم بيت المؤتمرات / الفندق المسيحي:' : 'اسم السكن المغترب:'}</label>
                <input id="add-house-name" type="text" required value={houseName} onChange={(e) => setHouseName(e.target.value)} onFocus={(e) => e.target.select()}
                  className="w-full bg-white border border-[var(--color-owner-border)] text-xs px-3 py-2 rounded-xl text-[var(--color-owner-text)] focus:outline-none focus:border-[var(--color-owner-primary)]" />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[var(--color-owner-secondary)] mb-1">وصف تفصيلي للبيت ومميزاته:</label>
                <textarea id="add-house-desc" rows={3} required value={houseDesc} onChange={(e) => setHouseDesc(e.target.value)} onFocus={(e) => e.target.select()}
                  className="w-full bg-white border border-[var(--color-owner-border)] text-xs px-3 py-2 rounded-xl text-[var(--color-owner-text)] focus:outline-none focus:border-[var(--color-owner-primary)]" />
              </div>
            </div>

            {/* 1. Images */}
            <div className="space-y-2 pt-3 border-t border-[var(--color-owner-border)]">
              <div className="flex items-center gap-1.5"><ImageIcon className="w-3.5 h-3.5 text-[var(--color-owner-primary)]" /><span className="text-[11px] font-black text-[var(--color-owner-text)]">الصور</span></div>
              <label className="block text-[10px] font-bold text-[var(--color-owner-secondary)] mb-1">صورة واجهة البيت:</label>
              <PhotoPickerButtons idPrefix="add-house-image" onSelect={setImageUrl} />
              {imageUrl && <img src={imageUrl} alt="معاينة صورة الواجهة" className="mt-2 w-full h-28 object-cover rounded-xl border border-[var(--color-owner-border)]" />}
            </div>

            {/* 2. Pricing */}
            <div className="space-y-2 pt-3 border-t border-[var(--color-owner-border)]">
              <div className="flex items-center gap-1.5"><Coins className="w-3.5 h-3.5 text-[var(--color-owner-primary)]" /><span className="text-[11px] font-black text-[var(--color-owner-text)]">السعر</span></div>
              {(propertyType === 'student' || propertyType === 'staff') && (
                <div className="grid grid-cols-2 gap-2 p-3 bg-[var(--color-owner-hover)] rounded-2xl border border-[var(--color-owner-border)]">
                  <div>
                    <label className="block text-[10px] font-bold text-[var(--color-owner-secondary)] mb-1">الإيجار الشهري المطلوب للفرد (ج.م):</label>
                    <input type="number" required min={100} value={monthlyRent} onChange={(e) => setMonthlyRent(parseInt(e.target.value) || 1500)} onFocus={(e) => e.target.select()}
                      className="w-full bg-white border border-[var(--color-owner-border)] text-xs px-3 py-1.5 rounded-xl text-[var(--color-owner-text)] focus:outline-none" />
                  </div>
                  {propertyType === 'student' && (
                    <div>
                      <label className="block text-[10px] font-bold text-[var(--color-owner-secondary)] mb-1">القرب من الجامعة / الكلية:</label>
                      <input type="text" value={distanceFromUniversity} onChange={(e) => setDistanceFromUniversity(e.target.value)}
                        className="w-full bg-white border border-[var(--color-owner-border)] text-xs px-3 py-1.5 rounded-xl text-[var(--color-owner-text)] focus:outline-none" />
                    </div>
                  )}
                </div>
              )}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-[var(--color-owner-secondary)] mb-1">{propertyType === 'conference' ? 'سعر الفرد لليلة (ج.م):' : 'سعر تأمين الحجز مسبقاً (ج.م):'}</label>
                  <input id="add-house-price" type="number" required min={0} value={propertyType === 'conference' ? pricePerNight : 200} disabled={propertyType !== 'conference'}
                    onChange={(e) => setPricePerNight(parseInt(e.target.value) || 150)} onFocus={(e) => e.target.select()}
                    className="w-full bg-white disabled:bg-gray-100 border border-[var(--color-owner-border)] text-xs px-3 py-2 rounded-xl text-[var(--color-owner-text)] focus:outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[var(--color-owner-secondary)] mb-1">عدد الغرف الإجمالي:</label>
                  <input id="add-house-rooms" type="number" required min={1} value={roomsCount} onChange={(e) => setRoomsCount(parseInt(e.target.value) || 10)} onFocus={(e) => e.target.select()}
                    className="w-full bg-white border border-[var(--color-owner-border)] text-xs px-3 py-2 rounded-xl text-[var(--color-owner-text)] focus:outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[var(--color-owner-secondary)] mb-1">عدد الأسرة الكلي:</label>
                  <input id="add-house-beds" type="number" required min={1} value={bedsCount} onChange={(e) => setBedsCount(parseInt(e.target.value) || 30)} onFocus={(e) => e.target.select()}
                    className="w-full bg-white border border-[var(--color-owner-border)] text-xs px-3 py-2 rounded-xl text-[var(--color-owner-text)] focus:outline-none" />
                </div>
              </div>

              {/* Seasonal rates & offers — saved instantly (owner-direct,
                  no admin review, migration 055), unlike the base form. */}
              {ownerHouses.length >= 1 && propertyType === 'conference' && (() => {
                const srHouse = ownerHouses[0];
                const currentRates = srHouse.seasonalRates ?? [];
                return (
                  <div className="bg-amber-50/50 border border-amber-200/70 rounded-2xl p-3 space-y-2.5">
                    <div className="text-[11px] font-black text-amber-900">🏷️ أسعار المواسم والعروض <span className="font-medium text-[10px]">(تُطبَّق فوراً بدون مراجعة الإدارة — أول موسم مطابق لليلة هو اللي بيتحسب)</span></div>

                    {currentRates.length > 0 && (
                      <div className="space-y-1.5">
                        {currentRates.map((r) => (
                          <div key={r.id} className="flex items-center justify-between bg-white border border-[var(--color-owner-border)] rounded-xl px-3 py-1.5 text-[10px]">
                            <span className="font-extrabold text-[var(--color-owner-text)]">{r.label}</span>
                            <span className="text-[var(--color-owner-secondary)] font-bold">{r.startDate} ← {r.endDate}</span>
                            <span className="font-black text-amber-800">{r.pricePerNight} ج.م/ليلة</span>
                            <button type="button" onClick={() => onUpdateHouse?.({ ...srHouse, seasonalRates: currentRates.filter((x) => x.id !== r.id) })}
                              className="text-rose-600 hover:text-rose-800 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
                      <div className="sm:col-span-1">
                        <label className="block text-[9px] font-bold text-[var(--color-owner-secondary)] mb-0.5">اسم الموسم/العرض:</label>
                        <input id="sr-label-input" type="text" value={srLabel} onChange={(e) => setSrLabel(e.target.value)} onFocus={(e) => e.target.select()} placeholder="موسم الصيف"
                          className="w-full bg-white border border-[var(--color-owner-border)] text-[10px] px-2 py-1.5 rounded-xl text-[var(--color-owner-text)] focus:outline-none" />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-[var(--color-owner-secondary)] mb-0.5">من:</label>
                        <input id="sr-start-input" type="date" value={srStart} onChange={(e) => setSrStart(e.target.value)}
                          className="w-full bg-white border border-[var(--color-owner-border)] text-[10px] px-2 py-1.5 rounded-xl text-[var(--color-owner-text)] focus:outline-none" />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-[var(--color-owner-secondary)] mb-0.5">إلى:</label>
                        <input id="sr-end-input" type="date" value={srEnd} min={srStart || undefined} onChange={(e) => setSrEnd(e.target.value)}
                          className="w-full bg-white border border-[var(--color-owner-border)] text-[10px] px-2 py-1.5 rounded-xl text-[var(--color-owner-text)] focus:outline-none" />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-[var(--color-owner-secondary)] mb-0.5">سعر الفرد/ليلة:</label>
                        <input id="sr-price-input" type="number" min={0} value={srPrice} onChange={(e) => setSrPrice(e.target.value)} onFocus={(e) => e.target.select()}
                          className="w-full bg-white border border-[var(--color-owner-border)] text-[10px] px-2 py-1.5 rounded-xl text-[var(--color-owner-text)] focus:outline-none" />
                      </div>
                      <button id="sr-add-btn" type="button" onClick={() => {
                          const price = parseFloat(srPrice);
                          if (!srLabel.trim() || !srStart || !srEnd || srStart > srEnd || !Number.isFinite(price) || price < 0) {
                            alert('يرجى إدخال اسم الموسم وتاريخين صحيحين وسعر لليلة.');
                            return;
                          }
                          onUpdateHouse?.({ ...srHouse, seasonalRates: [...currentRates, { id: `sr_${Date.now()}`, label: srLabel.trim(), startDate: srStart, endDate: srEnd, pricePerNight: price }] });
                          setSrLabel(''); setSrStart(''); setSrEnd(''); setSrPrice('');
                        }}
                        className="bg-[var(--color-owner-primary)] hover:bg-[var(--color-owner-primary-hover)] text-white text-[10px] font-bold py-1.5 px-3 rounded-xl cursor-pointer">
                        + إضافة
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* 3. Facilities — suitability + activities + services checklist + conference halls */}
            <div className="space-y-3 pt-3 border-t border-[var(--color-owner-border)]">
              <div className="flex items-center gap-1.5"><ClipboardList className="w-3.5 h-3.5 text-[var(--color-owner-primary)]" /><span className="text-[11px] font-black text-[var(--color-owner-text)]">المرافق والخدمات</span></div>

              <div>
                <label className="block text-[11px] font-bold text-[var(--color-owner-secondary)] mb-1">مناسب من حيث الفئات لـ:</label>
                <div className="flex flex-wrap gap-2 pt-1">
                  {(Object.keys(SUITABILITY_MAP) as ('youth' | 'children' | 'families' | 'retreat')[]).map((key) => {
                    const isSelected = selectedSuitability.includes(key);
                    return (
                      <button key={key} type="button" onClick={() => handleSuitabilityToggle(key)}
                        className={`text-[10px] font-bold px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer ${
                          isSelected ? 'bg-[var(--color-owner-primary)] border-[var(--color-owner-primary)] text-white shadow-sm' : 'bg-[var(--color-owner-hover)] border border-[var(--color-owner-border)] text-[var(--color-owner-text)]'
                        }`}>{SUITABILITY_MAP[key]}</button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[var(--color-owner-secondary)] mb-1">الأنشطة (افصل بـ "،"):</label>
                <input type="text" value={activitiesInput} onChange={(e) => setActivitiesInput(e.target.value)}
                  className="w-full bg-white border border-[var(--color-owner-border)] text-xs px-3 py-2 rounded-xl text-[var(--color-owner-text)] focus:outline-none focus:border-[var(--color-owner-primary)]" />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[var(--color-owner-secondary)] mb-1">الخدمات المتوفرة والمرافق بالبيت:</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {AMENITIES_LIST.map((srv) => {
                    const isChecked = selectedServices.includes(srv);
                    return (
                      <button key={srv} type="button" onClick={() => handleServiceToggle(srv)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[10px] font-semibold text-right transition-all cursor-pointer ${
                          isChecked ? 'bg-emerald-50 border-emerald-500 text-emerald-900' : 'bg-[var(--color-owner-hover)] border border-[var(--color-owner-border)] text-[var(--color-owner-text)]'
                        }`}>
                        <span className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0 ${isChecked ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-300'}`}>
                          {isChecked && <Check className="w-2.5 h-2.5" />}
                        </span>
                        <span>{srv}</span>
                      </button>
                    );
                  })}
                </div>
                {ownerHouses.length >= 1 && (
                  <button type="button" onClick={() => requestHouseEdit(ownerHouses[0], { services: selectedServices })}
                    className="w-full mt-1.5 bg-[var(--color-owner-hover)] text-[var(--color-owner-text)] text-[10px] font-bold py-1.5 rounded-lg cursor-pointer">حفظ الخدمات الآن</button>
                )}
              </div>

              {ownerHouses.length >= 1 && (
                <div className="bg-[var(--color-owner-bg)] p-3 rounded-2xl border border-[var(--color-owner-border)] space-y-2">
                  <label className="block text-[11px] font-bold text-[var(--color-owner-text)]">إضافة قاعات اجتماعات ومؤتمرات كنسية:</label>
                  {halls.length > 0 && (
                    <div className="space-y-1 mb-2">
                      {halls.map((h) => (
                        <div key={h.id} className="flex justify-between items-center bg-white px-2.5 py-1.5 rounded-lg text-[10px] border border-[var(--color-owner-border)]">
                          <div><span className="font-bold text-[var(--color-owner-text)]">{h.name}</span><span className="text-[var(--color-owner-secondary)] font-medium"> (سعة {h.capacity} فرد)</span></div>
                          <button type="button" onClick={() => handleRemoveHall(h.id)} className="text-rose-600 hover:text-rose-800 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <input type="text" placeholder="اسم القاعة" value={hallName} onChange={(e) => setHallName(e.target.value)}
                      className="w-full bg-white border border-[var(--color-owner-border)] text-[10px] px-2 py-1.5 rounded-lg text-[var(--color-owner-text)] focus:outline-none" />
                    <div className="flex gap-2 items-center">
                      <input type="number" placeholder="السعة الاستيعابية" value={hallCapacity} onChange={(e) => setHallCapacity(parseInt(e.target.value) || 50)} onFocus={(e) => e.target.select()}
                        className="flex-1 bg-white border border-[var(--color-owner-border)] text-[10px] px-2 py-1.5 rounded-lg text-[var(--color-owner-text)] focus:outline-none" />
                      <button type="button" onClick={handleAddHall} className="bg-[var(--color-owner-primary)] text-white text-[10px] font-bold px-3 py-1.5 rounded-lg shrink-0 cursor-pointer">أضف القاعة +</button>
                    </div>
                    <button type="button" onClick={() => requestHouseEdit(ownerHouses[0], { conferenceHalls: halls })}
                      className="w-full bg-[var(--color-owner-hover)] text-[var(--color-owner-text)] text-[10px] font-bold py-1.5 rounded-lg cursor-pointer">حفظ القاعات</button>
                  </div>
                </div>
              )}
            </div>

            {/* 4. Policies */}
            <div className="space-y-2 pt-3 border-t border-[var(--color-owner-border)]">
              <div className="flex items-center gap-1.5"><ShieldAlert className="w-3.5 h-3.5 text-[var(--color-owner-primary)]" /><span className="text-[11px] font-black text-[var(--color-owner-text)]">السياسات</span></div>
              {ownerHouses.length >= 1 && (ownerHouses[0].housingRules?.length || ownerHouses[0].contractTerms) ? (
                <div className="bg-[var(--color-owner-hover)] rounded-2xl border border-[var(--color-owner-border)] p-3 space-y-1.5 text-[10.5px] text-[var(--color-owner-text)]">
                  {ownerHouses[0].contractTerms && <p className="font-bold">{ownerHouses[0].contractTerms}</p>}
                  {ownerHouses[0].housingRules?.map((rule, i) => <p key={i}>• {rule}</p>)}
                </div>
              ) : (
                <p className="text-[10px] text-[var(--color-owner-secondary)]">لا توجد سياسات خاصة مسجلة لهذا النوع من العقار.</p>
              )}
            </div>

            {/* 5. Location */}
            <div className="space-y-2 pt-3 border-t border-[var(--color-owner-border)]">
              <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-[var(--color-owner-primary)]" /><span className="text-[11px] font-black text-[var(--color-owner-text)]">الموقع</span></div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-[var(--color-owner-secondary)] mb-1">المحافظة التابع لها:</label>
                  <select id="add-house-gov" value={houseGov} onChange={(e) => setHouseGov(e.target.value)}
                    className="w-full bg-white border border-[var(--color-owner-border)] text-xs px-2.5 py-2 rounded-xl text-[var(--color-owner-text)] focus:outline-none">
                    {GOVERNORATES.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[var(--color-owner-secondary)] mb-1">العنوان بالتفصيل:</label>
                  <input id="add-house-address" type="text" required value={houseAddress} onChange={(e) => setHouseAddress(e.target.value)} onFocus={(e) => e.target.select()}
                    className="w-full bg-white border border-[var(--color-owner-border)] text-xs px-3 py-2 rounded-xl text-[var(--color-owner-text)] focus:outline-none focus:border-[var(--color-owner-primary)]" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[11px] font-bold text-[var(--color-owner-secondary)] mb-1">موقع البيت على الخريطة:</label>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button type="button" onClick={() => {
                        if (!navigator.geolocation) { setGeoError('المتصفح لا يدعم تحديد الموقع.'); return; }
                        setGeoLoading(true); setGeoError('');
                        navigator.geolocation.getCurrentPosition(
                          (pos) => { setHouseLat(pos.coords.latitude); setHouseLng(pos.coords.longitude); setGeoLoading(false); },
                          () => { setGeoError('تعذر تحديد الموقع. تأكد من إذن الموقع في المتصفح.'); setGeoLoading(false); }
                        );
                      }}
                      className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-xl border border-[var(--color-owner-primary)] text-[var(--color-owner-primary)] bg-white hover:bg-[var(--color-owner-hover)] transition-colors">
                      {geoLoading ? <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-[var(--color-owner-primary)] border-t-transparent rounded-full" /> : '📍'}
                      {geoLoading ? 'جاري تحديد الموقع...' : 'استخدم موقعي الحالي'}
                    </button>
                    <button
                      type="button"
                      id="toggle-manual-map-btn"
                      onClick={() => setShowManualMap((v) => !v)}
                      className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl border border-[var(--color-owner-border)] text-[var(--color-owner-text)] bg-white hover:bg-[var(--color-owner-hover)] transition-colors"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      {showManualMap ? 'إخفاء الخريطة' : 'أو حدد يدوياً على الخريطة'}
                    </button>
                  </div>
                  {houseLat && houseLng && <p className="mt-1.5 text-[11px] text-emerald-600 font-semibold">تم تحديد الموقع: {houseLat.toFixed(5)}, {houseLng.toFixed(5)}</p>}
                  {geoError && <p className="mt-1.5 text-[11px] text-red-500">{geoError}</p>}
                  {showManualMap && (
                    <div className="mt-2 space-y-1.5">
                      <p className="text-[10px] text-[var(--color-owner-secondary)] font-medium">اضغط على أي نقطة بالخريطة لتحديد موقع البيت، أو اسحب الدبوس لضبطه بدقة.</p>
                      <LocationPicker
                        lat={houseLat ?? 30.0444}
                        lng={houseLng ?? 31.2357}
                        onChange={(lat, lng) => { setHouseLat(lat); setHouseLng(lng); }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <button id="add-house-submit" type="submit" className="w-full bg-[var(--color-owner-primary)] hover:bg-[var(--color-owner-primary-hover)] text-white text-xs font-bold py-2.5 rounded-xl shadow-md transition-all cursor-pointer">
              {ownerHouses.length >= 1 ? 'إرسال التعديلات للمراجعة' : 'إرسال البيت الجديد للمراجعة وتأكيده للظهور'}
            </button>
          </form>

          {/* 6. Food */}
          <div className="bg-[var(--color-owner-surface)] rounded-3xl border border-[var(--color-owner-border)] p-5 space-y-3">
            <div className="flex items-center gap-1.5 pb-2 border-b border-[var(--color-owner-border)]"><Utensils className="w-3.5 h-3.5 text-[var(--color-owner-primary)]" /><span className="text-[11px] font-black text-[var(--color-owner-text)]">الطعام</span></div>
            <OwnerFoodMenu house={ownerHouses[0]} onUpdateHouse={onUpdateHouse} />
          </div>

          {/* 7. Gallery — photo manager */}
          {ownerHouses.length >= 1 && (() => {
            const house = ownerHouses[0];
            const base = getEditBase(house);
            return (
              <div className="bg-[var(--color-owner-surface)] rounded-3xl border border-[var(--color-owner-border)] p-4 space-y-3">
                <div className="flex items-center gap-1.5 pb-2 border-b border-[var(--color-owner-border)]"><Camera className="w-3.5 h-3.5 text-[var(--color-owner-primary)]" /><span className="text-[11px] font-black text-[var(--color-owner-text)]">المعرض</span></div>
                <button type="button" onClick={() => setExpandedPhotosForHouse(expandedPhotosForHouse === house.id ? null : house.id)}
                  className="w-full flex items-center justify-between text-[11px] font-black text-[var(--color-owner-primary)] hover:bg-[var(--color-owner-hover)] py-1.5 px-2 rounded-xl transition-all cursor-pointer">
                  <span>إدارة صور الغرف والخدمات والمباني 📸</span>
                  <span className="text-[10px] text-[var(--color-owner-secondary)]">{expandedPhotosForHouse === house.id ? 'إخفاء الصور ▲' : 'إضافة وعرض الصور ▼'}</span>
                </button>
                {expandedPhotosForHouse === house.id && (
                  <div className="p-3 bg-[var(--color-owner-bg)] border border-[var(--color-owner-border)] rounded-2xl space-y-3 text-right">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[8.5px] font-bold text-[var(--color-owner-secondary)] mb-0.5">نوع وتصنيف الصورة:</label>
                        <select value={extraPhotoCategory} onChange={(e) => setExtraPhotoCategory(e.target.value as 'room' | 'service' | 'other')}
                          className="w-full bg-white border border-[var(--color-owner-border)] text-[10px] px-2 py-1.5 rounded-lg focus:outline-none">
                          <option value="room">🛌 غرف النوم والأسرة</option><option value="service">🍽️ الخدمات والمطعم والملاعب</option><option value="other">⛪ المبنى وقاعات الاجتماعات</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[8.5px] font-bold text-[var(--color-owner-secondary)] mb-0.5">وصف مختصر:</label>
                        <input type="text" value={extraPhotoLabel} onChange={(e) => setExtraPhotoLabel(e.target.value)}
                          className="w-full bg-white border border-[var(--color-owner-border)] text-[10px] px-2 py-1.5 rounded-lg focus:outline-none" />
                      </div>
                      <div>
                        <label className="block text-[8.5px] font-bold text-[var(--color-owner-secondary)] mb-0.5">صورة الغرفة/الخدمة:</label>
                        <PhotoPickerButtons idPrefix={`photo-${house.id}`} onSelect={setExtraPhotoUrl} />
                        {extraPhotoUrl && (
                          <div className="flex items-center gap-2 mt-1.5">
                            <img src={extraPhotoUrl} alt="معاينة" className="w-10 h-10 object-cover rounded-lg border border-[var(--color-owner-border)]" />
                            <button type="button" onClick={() => {
                                const labelPrefix = extraPhotoCategory === 'room' ? '🛌 غرف' : extraPhotoCategory === 'service' ? '🍽️ خدمات' : '⛪ مباني';
                                const descStr = extraPhotoLabel.trim() ? `${labelPrefix}: ${extraPhotoLabel.trim()}` : labelPrefix;
                                requestHouseEdit(house, { images: [...base.images, extraPhotoUrl], imageDescriptions: { ...(base.imageDescriptions || {}), [extraPhotoUrl]: descStr } });
                                setExtraPhotoUrl(''); setExtraPhotoLabel('');
                                setPhotosSuccessMsg('تم إرسال الصورة ضمن طلب تعديل بانتظار موافقة الإدارة!');
                                setTimeout(() => setPhotosSuccessMsg(''), 3000);
                              }}
                              className="flex-1 bg-[var(--color-owner-primary)] text-white text-[10px] font-bold px-2 py-1.5 rounded-lg cursor-pointer">إضافة للألبوم</button>
                          </div>
                        )}
                      </div>
                    </div>
                    {photosSuccessMsg && <p className="text-[9px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-1.5 text-center font-bold">{photosSuccessMsg}</p>}
                    <div className="space-y-1.5 pt-2 border-t border-[var(--color-owner-border)]">
                      <span className="text-[9.5px] font-extrabold text-[var(--color-owner-text)]">الصور المضافة حالياً للبيت ({base.images.length}):</span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {base.images.map((img, idx) => {
                          const desc = base.imageDescriptions?.[img] || (idx === 0 ? 'الصورة الرئيسية' : 'صورة إضافية');
                          return (
                            <div key={`${img}-${idx}`} className="relative bg-white border border-[var(--color-owner-border)] rounded-xl overflow-hidden">
                              <img referrerPolicy="no-referrer" src={img} alt="بيت خلوة" className="w-full h-14 object-cover" />
                              <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[8px] p-0.5 text-center truncate font-bold">{desc}</div>
                              {base.images.length > 1 && (
                                <button type="button" onClick={() => { if (confirm('حذف هذه الصورة؟')) requestHouseEdit(house, { images: base.images.filter((_, i) => i !== idx) }); }}
                                  className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[8px] font-bold hover:bg-red-700 cursor-pointer">✕</button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {ownerHouses.length >= 1 && (
            <button type="button" onClick={() => { if (confirm(`هل أنت متأكد من رغبتك في حذف بيت "${ownerHouses[0].name}" نهائياً؟`)) onDeleteHouse?.(ownerHouses[0].id); }}
              className="w-full flex items-center justify-center gap-1.5 text-[11px] font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl py-2.5 transition-colors cursor-pointer bg-white">
              <Trash2 className="w-3.5 h-3.5" /><span>حذف البيت نهائياً</span>
            </button>
          )}
        </div>
      )}

      {/* Overflow: Reports */}
      {activeTab === 'reports' && (
        <OwnerReports ownerBookings={ownerBookings} ownerReviews={ownerReviews} confirmedRevenue={confirmedRevenue} platformCommissionAmount={platformCommissionAmount} netOwnerPayout={netOwnerPayout} occupancyRate={occupancyRate} avgRating={avgRating} />
      )}

      {/* Overflow: Notifications */}
      {activeTab === 'notifications' && (
        <OwnerNotifications owner={owner} notifications={notifications} onMarkNotificationAsRead={onMarkNotificationAsRead ?? (() => {})} />
      )}

      {/* Overflow: Settings / Profile */}
      {activeTab === 'profile' && (
        <div className="space-y-3">
          <div className="bg-[var(--color-owner-surface)] p-6 rounded-3xl border border-[var(--color-owner-border)] text-right space-y-5">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--color-owner-border)] pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-[var(--color-owner-hover)] text-[var(--color-owner-primary)] border border-[var(--color-owner-border)]"><Settings className="w-5 h-5" /></div>
                <div>
                  <h3 className="text-sm font-black text-[var(--color-owner-text)]">الملف الشخصي لمالك البيت</h3>
                  <p className="text-[10px] text-[var(--color-owner-secondary)]">بياناتك الشخصية وبيانات التواصل المسجلة لدى الإدارة</p>
                </div>
              </div>
              <span className="text-[9px] font-bold text-[var(--color-owner-secondary)] flex items-center gap-1 shrink-0"><Lock className="w-3 h-3" /> غير قابلة للتعديل</span>
            </div>
            <div className="space-y-2 text-[11px]">
              <div className="flex items-center gap-2 bg-[var(--color-owner-bg)] p-2.5 rounded-2xl border border-[var(--color-owner-border)]">
                <ShieldAlert className="w-4 h-4 text-[var(--color-owner-primary)] shrink-0" />
                <div><span className="text-[9px] text-[var(--color-owner-secondary)] font-bold block">الاسم الكامل</span><span className="font-bold text-[var(--color-owner-text)]">{owner.name}</span></div>
              </div>
              <div className="flex items-center gap-2 bg-[var(--color-owner-bg)] p-2.5 rounded-2xl border border-[var(--color-owner-border)]">
                <Mail className="w-4 h-4 text-[var(--color-owner-primary)] shrink-0" />
                <div><span className="text-[9px] text-[var(--color-owner-secondary)] font-bold block">البريد الإلكتروني</span><span className="font-bold text-[var(--color-owner-text)]" dir="ltr">{owner.email}</span></div>
              </div>
              <div className="flex items-center gap-2 bg-[var(--color-owner-bg)] p-2.5 rounded-2xl border border-[var(--color-owner-border)]">
                <Phone className="w-4 h-4 text-[var(--color-owner-primary)] shrink-0" />
                <div><span className="text-[9px] text-[var(--color-owner-secondary)] font-bold block">رقم الهاتف</span><span className="font-bold text-[var(--color-owner-text)]" dir="ltr">{owner.phone}</span></div>
              </div>
              {owner.organizationName && (
                <div className="flex items-center gap-2 bg-[var(--color-owner-bg)] p-2.5 rounded-2xl border border-[var(--color-owner-border)]">
                  <Building className="w-4 h-4 text-[var(--color-owner-primary)] shrink-0" />
                  <div><span className="text-[9px] text-[var(--color-owner-secondary)] font-bold block">اسم جهة الإدارة / الاسم التجاري</span><span className="font-bold text-[var(--color-owner-text)]">{owner.organizationName}</span></div>
                </div>
              )}
            </div>
          </div>

          {/* Payment methods — directly owner-editable, no admin gate (migration 042) */}
          <div className="bg-[var(--color-owner-surface)] p-5 rounded-3xl border border-[var(--color-owner-border)] text-right space-y-3">
            <h3 className="text-xs font-black text-[var(--color-owner-text)]">وسائل استلام مستحقاتك</h3>
            {activeHouseForPayments ? (
              <>
                {(activeHouseForPayments.paymentMethods || []).length === 0 ? (
                  <p className="text-[10px] text-[var(--color-owner-secondary)]">لم تُضف أي وسيلة دفع بعد — لن يتمكن الحاجزون من رؤية طريقة تحويل العربون.</p>
                ) : (
                  <div className="space-y-1.5">
                    {(activeHouseForPayments.paymentMethods || []).map((pm) => (
                      <div key={pm.id} className="flex items-center justify-between bg-[var(--color-owner-bg)] border border-[var(--color-owner-border)] rounded-xl px-3 py-2 text-[11px]">
                        <div><span className="font-bold text-[var(--color-owner-text)]">{pm.label}</span><span className="text-[var(--color-owner-secondary)] font-mono mr-2">{pm.value}</span></div>
                        <button type="button" onClick={() => handleRemovePaymentMethod(pm.id)} className="text-rose-600 hover:text-rose-800 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-2 items-center pt-2 border-t border-[var(--color-owner-border)]">
                  <select value={paymentDraftType} onChange={(e) => setPaymentDraftType(e.target.value as typeof paymentDraftType)}
                    className="bg-white border border-[var(--color-owner-border)] text-[10px] px-2 py-1.5 rounded-lg text-[var(--color-owner-text)] focus:outline-none">
                    {Object.entries(PAYMENT_TYPE_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                  </select>
                  <input type="text" placeholder="الرقم أو المعرّف" value={paymentDraftValue} onChange={(e) => setPaymentDraftValue(e.target.value)}
                    className="flex-1 min-w-[120px] bg-white border border-[var(--color-owner-border)] text-[10px] px-2 py-1.5 rounded-lg text-[var(--color-owner-text)] focus:outline-none" />
                  <button type="button" onClick={handleAddPaymentMethod} className="bg-[var(--color-owner-primary)] text-white text-[10px] font-bold px-3 py-1.5 rounded-lg cursor-pointer">إضافة</button>
                </div>
              </>
            ) : (
              <p className="text-[10px] text-[var(--color-owner-secondary)]">أضف بيتك أولاً لتتمكن من إضافة وسائل الدفع.</p>
            )}
          </div>

          <div className="bg-amber-50/60 border border-amber-200/60 p-4 rounded-2xl space-y-1 text-right">
            <span className="text-[10px] font-extrabold text-amber-950 block">🔐 معلومات الأمان وصلاحية الحساب:</span>
            <p className="text-[9px] text-amber-900 leading-relaxed">
              نوع الحساب الحالي هو <strong className="text-[var(--color-owner-primary)]">مالك بيوت خلوات ومؤتمرات (Owner)</strong> معتمد ومفعل.
            </p>
          </div>

          {/* Security — real password change via Supabase auth */}
          <div className="bg-[var(--color-owner-surface)] p-5 rounded-3xl border border-[var(--color-owner-border)] text-right space-y-3">
            <div className="flex items-center gap-1.5"><KeyRound className="w-4 h-4 text-[var(--color-owner-primary)]" /><h3 className="text-xs font-black text-[var(--color-owner-text)]">تغيير كلمة السر</h3></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input id="owner-new-password" type="password" placeholder="كلمة السر الجديدة" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                className="bg-white border border-[var(--color-owner-border)] text-xs px-3 py-2 rounded-xl text-[var(--color-owner-text)] focus:outline-none focus:border-[var(--color-owner-primary)]" />
              <input id="owner-confirm-password" type="password" placeholder="تأكيد كلمة السر" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                className="bg-white border border-[var(--color-owner-border)] text-xs px-3 py-2 rounded-xl text-[var(--color-owner-text)] focus:outline-none focus:border-[var(--color-owner-primary)]" />
            </div>
            {passwordMsg && (
              <p className={`text-[10px] font-bold ${passwordMsg.ok ? 'text-emerald-700' : 'text-rose-600'}`}>{passwordMsg.text}</p>
            )}
            <button id="owner-change-password-btn" type="button" onClick={handleChangePassword} disabled={passwordSaving || !newPassword || !confirmPassword}
              className="bg-[var(--color-owner-primary)] hover:bg-[var(--color-owner-primary-hover)] disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer">
              {passwordSaving ? 'جارٍ الحفظ...' : 'حفظ كلمة السر الجديدة'}
            </button>
          </div>

          {/* Support */}
          {onNavigateSupport && (
            <button type="button" id="owner-support-btn" onClick={onNavigateSupport}
              className="w-full flex items-center justify-center gap-1.5 text-[11px] font-bold text-[var(--color-owner-primary)] hover:bg-[var(--color-owner-hover)] border border-[var(--color-owner-border)] rounded-xl py-2.5 transition-colors cursor-pointer bg-[var(--color-owner-surface)]">
              <HelpCircle className="w-3.5 h-3.5" /><span>تواصل مع الدعم الفني</span>
            </button>
          )}
        </div>
      )}

      {activeAllocationBooking && (() => {
        const house = houses.find(h => h.id === activeAllocationBooking.houseId);
        if (!house) return null;
        return (
          <RoomDistribution booking={activeAllocationBooking} house={house} currentUser={owner} onClose={() => setActiveAllocationBooking(null)}
            globalAttendees={attendees} globalAllocations={allocations} onUpdateAttendees={onUpdateAttendees} onUpdateAllocations={onUpdateAllocations}
            houseRooms={ownerRooms.filter((r) => r.houseId === house.id)} allBookings={ownerBookings} />
        );
      })()}
      </div>
    </div>
  );
}
