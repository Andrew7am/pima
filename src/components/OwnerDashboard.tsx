import React, { useState } from 'react';
import { RetreatHouse, Booking, User, ConferenceHall, Restaurant, Attendee, RoomAllocation, Review, Room, Announcement, WaitlistEntry } from '../types';
import { GOVERNORATES, AMENITIES_LIST, SUITABILITY_MAP } from '../mockData';
import { Plus, Check, X, ShieldAlert, Coins, Home, Calendar, Users, Star, ClipboardList, Info, Trash2, Building, Settings, MessageSquare, Image, Camera, Sliders, BedDouble, Megaphone } from 'lucide-react';
import RoomDistribution from './RoomDistribution';
import PhotoPickerButtons from './PhotoPickerButtons';

interface OwnerDashboardProps {
  owner: User;
  houses: RetreatHouse[];
  bookings: Booking[];
  onAddHouse: (house: RetreatHouse) => void;
  onApproveBooking: (bookingId: string) => void;
  onRejectBooking: (bookingId: string) => void;
  onConfirmDeposit?: (bookingId: string) => void;
  onCheckInBooking?: (bookingId: string) => void;
  onCheckOutBooking?: (bookingId: string) => void;
  attendees: Attendee[];
  allocations: RoomAllocation[];
  onUpdateAttendees: (bookingId: string, attendees: Attendee[]) => void;
  onUpdateAllocations: (bookingId: string, allocations: RoomAllocation[]) => void;
  onUpdateOwnerProfile?: (updatedUser: User) => void;
  onUpdateHouse?: (house: RetreatHouse) => void;
  reviews?: Review[];
  onUpdateReview?: (review: Review) => void;
  rooms?: Room[];
  onAddRoom?: (room: Room) => void;
  onUpdateRoom?: (room: Room) => void;
  onDeleteRoom?: (roomId: string) => void;
  announcements?: Announcement[];
  onAddAnnouncement?: (announcement: Announcement) => void;
  onToggleAnnouncement?: (id: string, isActive: boolean) => void;
  waitlist?: WaitlistEntry[];
}

export default function OwnerDashboard({
  owner,
  houses,
  bookings,
  onAddHouse,
  onApproveBooking,
  onRejectBooking,
  onConfirmDeposit,
  onCheckInBooking,
  onCheckOutBooking,
  attendees,
  allocations,
  onUpdateAttendees,
  onUpdateAllocations,
  onUpdateOwnerProfile,
  onUpdateHouse,
  reviews = [],
  onUpdateReview,
  rooms = [],
  onAddRoom,
  onUpdateRoom,
  onDeleteRoom,
  announcements = [],
  onAddAnnouncement,
  onToggleAnnouncement,
  waitlist = [],
}: OwnerDashboardProps) {
  // Tabs within Owner panel
  const [activeTab, setActiveTab] = useState<'stats' | 'houses' | 'rooms' | 'add_house' | 'bookings' | 'profile' | 'occupancy' | 'reviews' | 'financials' | 'announcements' | 'waitlist'>('stats');
  const [activeAllocationBooking, setActiveAllocationBooking] = useState<Booking | null>(null);
  // Booking status filter for bookings tab
  const [bookingFilter, setBookingFilter] = useState<'all' | 'new' | 'confirmed' | 'current' | 'completed' | 'cancelled'>('all');
  // Platform commission rate (5%)
  const PLATFORM_COMMISSION = 0.05;

  // Form states for profile editing
  const [profileName, setProfileName] = useState(owner.name);
  const [profileEmail, setProfileEmail] = useState(owner.email);
  const [profilePhone, setProfilePhone] = useState(owner.phone);
  const [profileOrg, setProfileOrg] = useState(owner.organizationName || '');
  const [profileSuccessMsg, setProfileSuccessMsg] = useState('');

  React.useEffect(() => {
    setProfileName(owner.name);
    setProfileEmail(owner.email);
    setProfilePhone(owner.phone);
    setProfileOrg(owner.organizationName || '');
    setProfileSuccessMsg('');
  }, [owner]);

  // Form states for new house
  const [houseName, setHouseName] = useState('');
  const [houseDesc, setHouseDesc] = useState('');
  const [houseGov, setHouseGov] = useState(GOVERNORATES[0]);
  const [houseAddress, setHouseAddress] = useState('');
  const [houseLat, setHouseLat] = useState<number | null>(null);
  const [houseLng, setHouseLng] = useState<number | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [pricePerNight, setPricePerNight] = useState<number>(150);
  const [roomsCount, setRoomsCount] = useState<number>(10);
  const [bedsCount, setBedsCount] = useState<number>(30);
  const [roomsDesc, setRoomsDesc] = useState('');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [selectedSuitability, setSelectedSuitability] = useState<('youth' | 'children' | 'families' | 'retreat')[]>([]);
  const [imageUrl, setImageUrl] = useState('');
  const [activitiesInput, setActivitiesInput] = useState('');

  // New property types & student/staff variables
  const [propertyType, setPropertyType] = useState<'conference' | 'student' | 'staff'>('conference');
  const [monthlyRent, setMonthlyRent] = useState<number>(1500);
  const [studentHousingGender, setStudentHousingGender] = useState<'boys' | 'girls'>('boys');
  const [distanceFromUniversity, setDistanceFromUniversity] = useState('');

  // Form states for adding a Hall
  const [halls, setHalls] = useState<ConferenceHall[]>([]);
  const [hallName, setHallName] = useState('');
  const [hallCapacity, setHallCapacity] = useState<number>(50);
  const [hallSound, setHallSound] = useState(false);
  const [hallProjector, setHallProjector] = useState(false);

  // Calendar states
  const [expandedCalendar, setExpandedCalendar] = useState<string | null>(null);
  const [expandedPhotosForHouse, setExpandedPhotosForHouse] = useState<string | null>(null);
  const [activeMonthForHouse, setActiveMonthForHouse] = useState<{ [houseId: string]: { month: number; year: number } }>({});

  // States for room/services photos management
  const [extraPhotoUrl, setExtraPhotoUrl] = useState('');
  const [extraPhotoLabel, setExtraPhotoLabel] = useState('');
  const [extraPhotoCategory, setExtraPhotoCategory] = useState<'room' | 'service' | 'other'>('room');
  const [photosSuccessMsg, setPhotosSuccessMsg] = useState('');

  // States for block/unblock occupancy dates
  const [selectedBlockDate, setSelectedBlockDate] = useState('');
  const [blockReason, setBlockReason] = useState('أعمال صيانة وتجهيز');
  const [blockSuccessMsg, setBlockSuccessMsg] = useState('');

  // States for review replies
  const [reviewReplyText, setReviewReplyText] = useState('');
  const [replyingToReviewId, setReplyingToReviewId] = useState<string | null>(null);
  const [reviewsSuccessMsg, setReviewsSuccessMsg] = useState('');

  const getMonthDetails = (year: number, month: number) => {
    const firstDay = new Date(year, month - 1, 1);
    const totalDays = new Date(year, month, 0).getDate();
    const startDayOfWeek = firstDay.getDay(); // 0 = Sunday, 1 = Monday, ...
    return { totalDays, startDayOfWeek };
  };

  const isDateBooked = (houseId: string, year: number, month: number, day: number) => {
    const monthStr = month < 10 ? `0${month}` : `${month}`;
    const dayStr = day < 10 ? `0${day}` : `${day}`;
    const dateStr = `${year}-${monthStr}-${dayStr}`;
    
    // Check if manually blocked
    const targetHouse = houses.find(h => h.id === houseId);
    if (targetHouse && targetHouse.blockedDates && targetHouse.blockedDates.includes(dateStr)) {
      return {
        id: `blocked_${dateStr}`,
        houseId,
        houseName: targetHouse.name,
        userId: 'admin',
        userName: 'مغلق ومحجوز يدويًا',
        organizationName: 'مغلق للصيانة / أعمال الخدمة ⚠️',
        guestsCount: 0,
        status: 'approved',
        checkIn: dateStr,
        checkOut: dateStr,
        totalPrice: 0,
        depositPaid: false,
        depositAmount: 0,
        createdAt: ''
      } as Booking;
    }

    const houseBookings = bookings.filter(
      (b) => b.houseId === houseId && (b.status === 'approved' || b.status === 'completed')
    );
    
    const activeBooking = houseBookings.find((b) => {
      return dateStr >= b.checkIn && dateStr <= b.checkOut;
    });
    
    return activeBooking || null;
  };

  const handleBlockDateSubmit = (e: React.FormEvent, house: RetreatHouse) => {
    e.preventDefault();
    if (!selectedBlockDate) {
      alert('الرجاء اختيار تاريخ أولاً.');
      return;
    }
    const currentBlocked = house.blockedDates || [];
    if (currentBlocked.includes(selectedBlockDate)) {
      alert('هذا التاريخ محظور بالفعل.');
      return;
    }
    
    const updatedHouse = {
      ...house,
      blockedDates: [...currentBlocked, selectedBlockDate]
    };
    if (onUpdateHouse) {
      onUpdateHouse(updatedHouse);
    }
    setBlockSuccessMsg(`تم حظر التاريخ ${selectedBlockDate} بنجاح! أصبح مغلقاً للصيانة/الخدمة.`);
    setSelectedBlockDate('');
    setTimeout(() => setBlockSuccessMsg(''), 4000);
  };

  const handleUnblockDate = (dateStr: string, house: RetreatHouse) => {
    const currentBlocked = house.blockedDates || [];
    const updatedHouse = {
      ...house,
      blockedDates: currentBlocked.filter((d) => d !== dateStr)
    };
    if (onUpdateHouse) {
      onUpdateHouse(updatedHouse);
    }
    setBlockSuccessMsg(`تم إلغاء حظر التاريخ ${dateStr} بنجاح! أصبح متاحاً للحجوزات.`);
    setTimeout(() => setBlockSuccessMsg(''), 4000);
  };

  const handleAddReplySubmit = (e: React.FormEvent, reviewId: string) => {
    e.preventDefault();
    if (!reviewReplyText.trim()) {
      alert('الرجاء كتابة نص الرد أولاً.');
      return;
    }
    const targetReview = reviews.find((r) => r.id === reviewId);
    if (!targetReview) return;

    const updatedReview = {
      ...targetReview,
      ownerReply: reviewReplyText.trim(),
      ownerReplyCreatedAt: new Date().toISOString()
    };

    if (onUpdateReview) {
      onUpdateReview(updatedReview);
    }
    
    setReviewReplyText('');
    setReplyingToReviewId(null);
    setReviewsSuccessMsg('تم إرسال الرد الرسمي بنجاح وسيظهر للجميع على صفحة البيت!');
    setTimeout(() => setReviewsSuccessMsg(''), 4000);
  };

  const handleDeleteReply = (reviewId: string) => {
    if (!confirm('هل أنت متأكد من رغبتك في حذف هذا الرد؟')) return;
    const targetReview = reviews.find((r) => r.id === reviewId);
    if (!targetReview) return;

    const updatedReview = {
      ...targetReview,
      ownerReply: undefined,
      ownerReplyCreatedAt: undefined
    };

    if (onUpdateReview) {
      onUpdateReview(updatedReview);
    }
    
    setReviewsSuccessMsg('تم حذف الرد بنجاح.');
    setTimeout(() => setReviewsSuccessMsg(''), 4000);
  };

  // Filter owner's houses
  const ownerHouses = houses.filter((h) => h.ownerId === owner.id);
  const ownerHouseIds = ownerHouses.map((h) => h.id);

  // Filter bookings for owner's houses
  const ownerBookings = bookings.filter((b) => ownerHouseIds.includes(b.houseId));

  // Filter rooms, announcements, and waitlist entries for owner's houses
  const ownerRooms = rooms.filter((r) => ownerHouseIds.includes(r.houseId));
  const ownerAnnouncements = announcements.filter((a) => ownerHouseIds.includes(a.houseId));
  const ownerWaitlist = waitlist.filter((w) => ownerHouseIds.includes(w.houseId));

  // Room management form state
  const [roomName, setRoomName] = useState('');
  const [roomBeds, setRoomBeds] = useState(2);
  const [roomPrice, setRoomPrice] = useState('');
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);

  // Announcement form state
  const [announcementMessage, setAnnouncementMessage] = useState('');

  // Calculate stats
  const totalRevenue = ownerBookings
    .filter((b) => b.status === 'approved' || b.status === 'completed')
    .reduce((sum, b) => sum + (b.depositPaid ? b.depositAmount : b.totalPrice * 0.15), 0); // revenue counts paid deposit or estimated 15% secure deposit

  const totalFullBookingsValue = ownerBookings
    .filter((b) => b.status === 'approved' || b.status === 'completed')
    .reduce((sum, b) => sum + b.totalPrice, 0);

  const pendingBookings = ownerBookings.filter((b) => b.status === 'pending');

  // ─── Enhanced statistics for the Owner Home dashboard ──────────────
  const todayStr = new Date().toISOString().split('T')[0];
  const todayBookings = ownerBookings.filter(
    (b) => (b.status === 'approved' || b.status === 'completed') && b.checkIn <= todayStr && b.checkOut >= todayStr
  );
  const totalBookingsCount = ownerBookings.length;
  const confirmedBookings = ownerBookings.filter((b) => b.status === 'approved' || b.status === 'completed');
  const confirmedRevenue = confirmedBookings.reduce((sum, b) => sum + b.totalPrice, 0);
  const platformCommissionAmount = confirmedRevenue * PLATFORM_COMMISSION;
  const netOwnerPayout = confirmedRevenue - platformCommissionAmount;
  const depositReceived = confirmedBookings.filter((b) => b.depositPaid).reduce((sum, b) => sum + b.depositAmount, 0);
  const remainingBalance = confirmedRevenue - depositReceived;

  // Occupancy rate for the current month
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

  // Average rating across owner's houses
  const ownerReviews = reviews.filter((r) => ownerHouseIds.includes(r.houseId));
  const avgRating = ownerReviews.length > 0
    ? (ownerReviews.reduce((sum, r) => sum + r.rating, 0) / ownerReviews.length)
    : 0;

  // Categorize bookings for the Bookings tab
  const categorizeBooking = (b: Booking): 'new' | 'confirmed' | 'current' | 'completed' | 'cancelled' => {
    if (b.status === 'pending') return 'new';
    if (b.status === 'rejected') return 'cancelled';
    if (b.status === 'completed') return 'completed';
    // approved: check if current or upcoming
    if (b.checkIn <= todayStr && b.checkOut >= todayStr) return 'current';
    if (b.checkOut < todayStr) return 'completed';
    return 'confirmed';
  };
  const filteredOwnerBookings = bookingFilter === 'all'
    ? ownerBookings
    : ownerBookings.filter((b) => categorizeBooking(b) === bookingFilter);
  const bookingCountByCategory = {
    all: ownerBookings.length,
    new: ownerBookings.filter((b) => categorizeBooking(b) === 'new').length,
    confirmed: ownerBookings.filter((b) => categorizeBooking(b) === 'confirmed').length,
    current: ownerBookings.filter((b) => categorizeBooking(b) === 'current').length,
    completed: ownerBookings.filter((b) => categorizeBooking(b) === 'completed').length,
    cancelled: ownerBookings.filter((b) => categorizeBooking(b) === 'cancelled').length,
  };

  const handleServiceToggle = (srv: string) => {
    if (selectedServices.includes(srv)) {
      setSelectedServices(selectedServices.filter((s) => s !== srv));
    } else {
      setSelectedServices([...selectedServices, srv]);
    }
  };

  const handleSuitabilityToggle = (suit: 'youth' | 'children' | 'families' | 'retreat') => {
    if (selectedSuitability.includes(suit)) {
      setSelectedSuitability(selectedSuitability.filter((s) => s !== suit));
    } else {
      setSelectedSuitability([...selectedSuitability, suit]);
    }
  };

  const handleAddHall = () => {
    if (!hallName) return;
    const newHall: ConferenceHall = {
      id: `hall_${Date.now()}`,
      name: hallName,
      capacity: hallCapacity,
      hasSoundSystem: hallSound,
      hasProjector: hallProjector
    };
    setHalls([...halls, newHall]);
    setHallName('');
    setHallCapacity(50);
    setHallSound(false);
    setHallProjector(false);
  };

  const handleRemoveHall = (id: string) => {
    setHalls(halls.filter((h) => h.id !== id));
  };

  const handleSubmitHouse = (e: React.FormEvent) => {
    e.preventDefault();
    if (ownerHouses.length >= 1) {
      alert('عذراً، لا يمكن تسجيل أكثر من بيت واحد لكل مالك.');
      return;
    }
    if (!houseName || !houseDesc || !houseAddress) {
      alert('يرجى ملء كافة البيانات الأساسية للبيت.');
      return;
    }

    const isMonthly = propertyType === 'student' || propertyType === 'staff';

    const newHouse: RetreatHouse = {
      id: `house_${Date.now()}`,
      name: houseName,
      description: houseDesc,
      ownerId: owner.id,
      ownerName: owner.name,
      governorate: houseGov,
      address: houseAddress,
      lat: houseLat ?? 30.0444 + (Math.random() - 0.5) * 0.4,
      lng: houseLng ?? 31.2357 + (Math.random() - 0.5) * 0.4,
      roomsCount,
      bedsCount,
      roomsDescription: roomsDesc || (isMonthly ? 'غرف سكنية مجهزة ومريحة تناسب الدراسة والعمل الهادئ.' : 'غرف فندقية نظيفة ومريحة مجهزة بحمام وتكييف.'),
      pricePerNightPerPerson: isMonthly ? 0 : pricePerNight,
      propertyType,
      monthlyRent: isMonthly ? monthlyRent : undefined,
      studentHousingGender: propertyType === 'student' ? studentHousingGender : undefined,
      distanceFromUniversity: propertyType === 'student' ? distanceFromUniversity : undefined,
      housingRules: isMonthly ? [
        'المحافظة على الوقار والمبادئ المسيحية في التعامل والسلوك العام بالسكن.',
        'مواعيد غلق الباب الخارجي بحد أقصى الساعة ١٠:٣٠ مساءً يومياً.',
        'يمنع منعاً باتاً استقبال زوار من الجنس الآخر في غرف النوم الخاصة.',
        'المحافظة على نظافة الغرف والهدوء لتمكين الزملاء من المذاكرة والاستراحة.'
      ] : undefined,
      contractTerms: isMonthly 
        ? 'عقد إيجار مخصص للطلبة والمغتربين المسيحيين يبدأ من شهر إلى سنة كاملة قابلة للتجديد.'
        : undefined,
      services: selectedServices,
      suitability: selectedSuitability.length > 0 ? selectedSuitability : ['youth', 'families'],
      conferenceHalls: propertyType === 'conference' ? halls : [],
      restaurants: [{ id: `rest_${Date.now()}`, name: 'المطعم الرئيسي للبيت', capacity: bedsCount, mealsServed: ['breakfast', 'lunch', 'dinner'] }],
      activities: activitiesInput ? activitiesInput.split('،').map((a) => a.trim()) : ['مسابقات وألعاب روحية', 'عروض مسرحية'],
      images: [
        imageUrl || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800&auto=format&fit=crop&q=80'
      ],
      status: 'pending', // Requires admin approval first!
      rating: 5.0,
      reviewsCount: 0,
      createdAt: new Date().toISOString()
    };

    onAddHouse(newHouse);
    alert('تم إضافة العقار بنجاح! تم إرساله للمراجعة وسيظهر للجميع بمجرد تفعيله من قبل إدارة النظام.');
    
    // Reset fields
    setHouseName('');
    setHouseDesc('');
    setHouseGov(GOVERNORATES[0]);
    setHouseAddress('');
    setPricePerNight(150);
    setRoomsCount(10);
    setBedsCount(30);
    setRoomsDesc('');
    setSelectedServices([]);
    setSelectedSuitability([]);
    setImageUrl('');
    setHalls([]);
    setActivitiesInput('');
    setPropertyType('conference');
    setMonthlyRent(1500);
    setStudentHousingGender('boys');
    setDistanceFromUniversity('');

    setActiveTab('houses');
  };

  return (
    <div className="space-y-4 text-right text-[#4A4A3A]">
      {/* Header and owner name */}
      <div className="bg-gradient-to-r from-[#4A4A3A] to-[#5A5A40] text-white rounded-3xl p-4 flex items-center justify-between">
        <div>
          <span className="text-[10px] text-amber-300 font-black">لوحة تحكم مالك البيوت</span>
          <h2 className="text-sm font-extrabold">{owner.name}</h2>
        </div>
        <div className="flex gap-1">
          <span className="text-[9px] bg-[#4A4A3A]/40 border border-[#D6D6C2]/40 text-white px-2 py-0.5 rounded-full">
            {ownerHouses.length} بيت مسجل
          </span>
        </div>
      </div>

      {/* Internal Navigation Tabs */}
      <div className="flex flex-wrap md:flex-nowrap border border-[#D6D6C2] bg-white p-1 rounded-2xl gap-1">
        <button
          id="owner-tab-stats"
          onClick={() => setActiveTab('stats')}
          className={`flex-1 text-center py-2 px-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'stats' ? 'bg-[#5A5A40] text-white shadow-sm' : 'text-[#8A8A70] hover:bg-[#EBEBE0]/40'
          }`}
        >
          مؤشرات عامة
        </button>
        <button
          id="owner-tab-houses"
          onClick={() => setActiveTab('houses')}
          className={`flex-1 text-center py-2 px-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'houses' ? 'bg-[#5A5A40] text-white shadow-sm' : 'text-[#8A8A70] hover:bg-[#EBEBE0]/40'
          }`}
        >
          بيوتنا ({ownerHouses.length})
        </button>
        <button
          id="owner-tab-rooms"
          onClick={() => setActiveTab('rooms')}
          className={`flex-1 text-center py-2 px-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'rooms' ? 'bg-[#5A5A40] text-white shadow-sm' : 'text-[#8A8A70] hover:bg-[#EBEBE0]/40'
          }`}
        >
          🛏️ الغرف
        </button>
        <button
          id="owner-tab-bookings"
          onClick={() => setActiveTab('bookings')}
          className={`flex-1 text-center py-2 px-1 rounded-xl text-xs font-bold transition-all cursor-pointer relative ${
            activeTab === 'bookings' ? 'bg-[#5A5A40] text-white shadow-sm' : 'text-[#8A8A70] hover:bg-[#EBEBE0]/40'
          }`}
        >
          الحجوزات
          {pendingBookings.length > 0 && (
            <span className="absolute top-1.5 left-2 w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
          )}
        </button>
        <button
          id="owner-tab-occupancy"
          onClick={() => setActiveTab('occupancy')}
          className={`flex-1 text-center py-2 px-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'occupancy' ? 'bg-[#5A5A40] text-white shadow-sm' : 'text-[#8A8A70] hover:bg-[#EBEBE0]/40'
          }`}
        >
          🗓️ جدول الإشغال
        </button>
        <button
          id="owner-tab-reviews"
          onClick={() => setActiveTab('reviews')}
          className={`flex-1 text-center py-2 px-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'reviews' ? 'bg-[#5A5A40] text-white shadow-sm' : 'text-[#8A8A70] hover:bg-[#EBEBE0]/40'
          }`}
        >
          💬 الردود باسمنا
        </button>
        <button
          id="owner-tab-announcements"
          onClick={() => setActiveTab('announcements')}
          className={`flex-1 text-center py-2 px-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'announcements' ? 'bg-[#5A5A40] text-white shadow-sm' : 'text-[#8A8A70] hover:bg-[#EBEBE0]/40'
          }`}
        >
          📢 التنبيهات
        </button>
        <button
          id="owner-tab-waitlist"
          onClick={() => setActiveTab('waitlist')}
          className={`flex-1 text-center py-2 px-1 rounded-xl text-xs font-bold transition-all cursor-pointer relative ${
            activeTab === 'waitlist' ? 'bg-[#5A5A40] text-white shadow-sm' : 'text-[#8A8A70] hover:bg-[#EBEBE0]/40'
          }`}
        >
          ⏳ قائمة الانتظار
          {ownerWaitlist.filter((w) => w.status === 'waiting').length > 0 && (
            <span className="absolute top-1.5 left-2 w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
          )}
        </button>
        <button
          id="owner-tab-financials"
          onClick={() => setActiveTab('financials')}
          className={`flex-1 text-center py-2 px-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'financials' ? 'bg-[#5A5A40] text-white shadow-sm' : 'text-[#8A8A70] hover:bg-[#EBEBE0]/40'
          }`}
        >
          💰 الحسابات
        </button>
        <button
          id="owner-tab-add"
          onClick={() => ownerHouses.length === 0 && setActiveTab('add_house')}
          disabled={ownerHouses.length >= 1}
          className={`flex-1 text-center py-2 px-1 rounded-xl text-xs font-bold transition-all ${
            ownerHouses.length >= 1
              ? 'opacity-30 cursor-not-allowed text-[#8A8A70]'
              : activeTab === 'add_house' ? 'bg-[#5A5A40] text-white shadow-sm' : 'text-[#8A8A70] hover:bg-[#EBEBE0]/40 cursor-pointer'
          }`}
          title={ownerHouses.length >= 1 ? 'مسموح ببيت واحد فقط لكل مالك' : 'إضافة بيت جديد'}
        >
          {ownerHouses.length >= 1 ? 'بيت واحد فقط ✓' : 'إضافة بيت جديد +'}
        </button>
        <button
          id="owner-tab-profile"
          onClick={() => setActiveTab('profile')}
          className={`flex-1 text-center py-2 px-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'profile' ? 'bg-[#5A5A40] text-white shadow-sm' : 'text-[#8A8A70] hover:bg-[#EBEBE0]/40'
          }`}
        >
          الإعدادات ⚙️
        </button>
      </div>

      {/* Tab Contents */}

      {/* 1. Stats and metrics — Owner Home Dashboard */}
      {activeTab === 'stats' && (
        <div className="space-y-4">
          {/* Top KPIs — 6 core metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-white p-3 rounded-2xl border border-[#D6D6C2] space-y-1 text-right">
              <ClipboardList className="w-4 h-4 text-[#5A5A40]" />
              <div className="text-[9px] text-[#8A8A70] font-bold">إجمالي الحجوزات</div>
              <div className="text-lg font-extrabold text-[#4A4A3A]">{totalBookingsCount}</div>
            </div>
            <div className="bg-white p-3 rounded-2xl border border-[#D6D6C2] space-y-1 text-right relative">
              <Plus className="w-4 h-4 text-amber-600" />
              <div className="text-[9px] text-[#8A8A70] font-bold">حجوزات جديدة</div>
              <div className="text-lg font-extrabold text-amber-700">{pendingBookings.length}</div>
              {pendingBookings.length > 0 && <span className="absolute top-2 left-2 w-2 h-2 rounded-full bg-amber-500 animate-pulse" />}
            </div>
            <div className="bg-white p-3 rounded-2xl border border-[#D6D6C2] space-y-1 text-right">
              <Calendar className="w-4 h-4 text-emerald-700" />
              <div className="text-[9px] text-[#8A8A70] font-bold">الحجوزات اليوم</div>
              <div className="text-lg font-extrabold text-emerald-700">{todayBookings.length}</div>
            </div>
            <div className="bg-white p-3 rounded-2xl border border-[#D6D6C2] space-y-1 text-right">
              <Home className="w-4 h-4 text-[#5A5A40]" />
              <div className="text-[9px] text-[#8A8A70] font-bold">نسبة الإشغال (شهر جاري)</div>
              <div className="text-lg font-extrabold text-[#4A4A3A]">{occupancyRate}%</div>
            </div>
            <div className="bg-white p-3 rounded-2xl border border-[#D6D6C2] space-y-1 text-right">
              <Coins className="w-4 h-4 text-[#5A5A40]" />
              <div className="text-[9px] text-[#8A8A70] font-bold">إجمالي الإيرادات</div>
              <div className="text-base font-extrabold text-[#4A4A3A]">{confirmedRevenue.toLocaleString()} ج.م</div>
            </div>
            <div className="bg-white p-3 rounded-2xl border border-[#D6D6C2] space-y-1 text-right">
              <Star className="w-4 h-4 text-amber-500" />
              <div className="text-[9px] text-[#8A8A70] font-bold">متوسط التقييم</div>
              <div className="text-lg font-extrabold text-[#4A4A3A]">
                {avgRating > 0 ? avgRating.toFixed(1) : '—'} <span className="text-[10px] text-[#8A8A70]">/ 5</span>
              </div>
            </div>
          </div>

          {/* Net owner payout after commission */}
          <div className="bg-gradient-to-l from-emerald-50 to-white rounded-2xl p-4 border border-emerald-200 space-y-1.5">
            <div className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-emerald-700" />
              <span className="text-[11px] font-black text-emerald-900">صافي مستحقاتك بعد عمولة التطبيق ({(PLATFORM_COMMISSION * 100).toFixed(0)}%)</span>
            </div>
            <div className="text-2xl font-extrabold text-emerald-900">{netOwnerPayout.toLocaleString()} ج.م</div>
            <div className="text-[10px] text-emerald-800/70">
              من إجمالي {confirmedRevenue.toLocaleString()} ج.م − عمولة {platformCommissionAmount.toLocaleString()} ج.م
              <button
                onClick={() => setActiveTab('financials')}
                className="mr-2 underline font-bold text-emerald-900 hover:text-emerald-950 cursor-pointer"
              >
                عرض التفاصيل الكاملة ←
              </button>
            </div>
          </div>

          <div className="bg-[#EBEBE0]/30 rounded-2xl p-3 border border-[#D6D6C2] flex gap-2.5 items-start text-xs text-[#4A4A3A]">
            <Info className="w-4 h-4 text-[#8A8A70] shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-[#4A4A3A] block">نصيحة لتسويق بيوت المؤتمرات:</span>
              <span>تأكد من إضافة كافة القاعات، والمطاعم، وتفاصيل الكنائس المتوفرة ببيتك لتظهر بصورة احترافية وتزيد من نسب الحجز للمجموعات الكبيرة.</span>
            </div>
          </div>

          {/* Quick list of recent bookings */}
          <div className="space-y-2">
            <h3 className="text-xs font-extrabold text-[#4A4A3A] px-1">آخر الطلبات المستلمة:</h3>
            {ownerBookings.length === 0 ? (
              <p className="text-[11px] text-[#8A8A70] text-center py-4">لا توجد أي طلبات حجز مسجلة حاليًا.</p>
            ) : (
              <div className="space-y-2">
                {ownerBookings.slice(0, 3).map((b) => (
                  <div key={b.id} className="bg-white p-3 rounded-2xl border border-[#D6D6C2] flex justify-between items-center text-xs text-right">
                    <div>
                      <div className="font-bold text-[#4A4A3A]">{b.userName}</div>
                      <div className="text-[10px] text-[#8A8A70]">{b.houseName} • {b.guestsCount} فرد</div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      b.status === 'approved' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'
                    }`}>
                      {b.status === 'approved' ? 'مقبول' : 'قيد الانتظار'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. Owner's Houses */}
      {activeTab === 'houses' && (
        <div className="space-y-3">
          {ownerHouses.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 border border-[#D6D6C2] text-center space-y-2">
              <p className="text-sm text-[#4A4A3A] font-bold">لا يوجد لديك أي بيوت مسجلة باسمك بعد.</p>
              <button
                id="owner-add-house-shortcut"
                onClick={() => setActiveTab('add_house')}
                className="bg-[#5A5A40] hover:bg-[#4A4A3A] text-white text-xs px-4 py-2 rounded-xl cursor-pointer"
              >
                سجل بيتك الأول الآن
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {ownerHouses.map((house) => (
                <div key={house.id} className="bg-white rounded-3xl border border-[#D6D6C2] shadow-sm overflow-hidden flex flex-col text-right">
                  <div className="relative h-28 bg-[#EBEBE0]">
                    <img referrerPolicy="no-referrer" src={house.images[0]} alt={house.name} className="w-full h-full object-cover" />
                    <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-2.5 py-0.5 rounded-full text-[10px] font-bold text-[#4A4A3A]">
                      {house.governorate}
                    </div>
                    
                    {/* Approval Status Badge */}
                    <div className={`absolute bottom-2 right-2 px-2 py-0.5 rounded text-[10px] font-extrabold ${
                      house.status === 'approved' 
                        ? 'bg-emerald-600 text-white' 
                        : house.status === 'pending'
                        ? 'bg-amber-600 text-white'
                        : 'bg-rose-600 text-white'
                    }`}>
                      {house.status === 'approved' ? 'نشط ويظهر للجميع' : house.status === 'pending' ? 'بانتظار موافقة الإدارة' : 'مرفوض'}
                    </div>
                  </div>

                  <div className="p-4 space-y-2 text-right">
                    <h3 className="text-xs font-bold text-[#4A4A3A] line-clamp-1">{house.name}</h3>
                    <p className="text-[11px] text-[#8A8A70] line-clamp-2 leading-relaxed">{house.description}</p>
                    
                    <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-[#D6D6C2] bg-[#EBEBE0]/10 rounded-xl text-[10px] font-bold text-[#4A4A3A]">
                      <div>
                        <div className="text-[#8A8A70] text-[9px] mb-0.5">الغرف</div>
                        <div className="text-[#4A4A3A]">{house.roomsCount} غرفة</div>
                      </div>
                      <div>
                        <div className="text-[#8A8A70] text-[9px] mb-0.5">الأسرة الكلية</div>
                        <div className="text-[#4A4A3A]">{house.bedsCount} سرير</div>
                      </div>
                      <div>
                        <div className="text-[#8A8A70] text-[9px] mb-0.5">سعر الفرد</div>
                        <div className="text-[#5A5A40] font-black">{house.pricePerNightPerPerson} ج.م/ليلة</div>
                      </div>
                    </div>

                    {/* Collapsible Occupancy Calendar */}
                    <div className="border-t border-[#D6D6C2]/50 pt-2 mt-2">
                      <button
                        type="button"
                        id={`toggle-cal-${house.id}`}
                        onClick={() => {
                          setExpandedCalendar(expandedCalendar === house.id ? null : house.id);
                        }}
                        className="w-full flex items-center justify-between text-[11px] font-black text-[#5A5A40] hover:text-[#4A4A3A] hover:bg-[#EBEBE0]/20 py-1.5 px-2 rounded-xl transition-all cursor-pointer"
                      >
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>تقويم حجز وإشغال البيت 📅</span>
                        </span>
                        <span className="text-[10px] text-[#8A8A70]">
                          {expandedCalendar === house.id ? 'إخفاء التقويم ▲' : 'عرض التقويم المالي ▼'}
                        </span>
                      </button>

                      {expandedCalendar === house.id && (
                        <div className="mt-2 p-3 bg-[#FBFBFA] border border-[#D6D6C2]/60 rounded-2xl space-y-3 text-right">
                          {/* Month Toggle Tabs */}
                          <div className="flex justify-center gap-2">
                            {[
                              { label: 'يوليو ٢٠٢٦', month: 7, year: 2026 },
                              { label: 'أغسطس ٢٠٢٦', month: 8, year: 2026 }
                            ].map((m) => {
                              const isSelected = (activeMonthForHouse[house.id]?.month || 7) === m.month;
                              return (
                                <button
                                  type="button"
                                  key={`${m.year}-${m.month}`}
                                  onClick={() => setActiveMonthForHouse({
                                    ...activeMonthForHouse,
                                    [house.id]: { month: m.month, year: m.year }
                                  })}
                                  className={`text-[10px] font-extrabold px-3 py-1 rounded-xl transition-all cursor-pointer ${
                                    isSelected
                                      ? 'bg-[#5A5A40] text-white shadow-sm'
                                      : 'bg-white border border-[#D6D6C2] text-[#8A8A70] hover:bg-[#EBEBE0]/30'
                                  }`}
                                >
                                  {m.label}
                                </button>
                              );
                            })}
                          </div>

                          {/* Render selected month calendar */}
                          {(() => {
                            const curSel = activeMonthForHouse[house.id] || { month: 7, year: 2026 };
                            const { totalDays, startDayOfWeek } = getMonthDetails(curSel.year, curSel.month);
                            const daysArray = Array.from({ length: totalDays }, (_, i) => i + 1);
                            const weekDays = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'];

                            return (
                              <div className="space-y-2.5">
                                <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-black">
                                  {weekDays.map((wd, idx) => (
                                    <div key={idx} className="text-[#8A8A70] py-0.5">{wd}</div>
                                  ))}
                                  
                                  {/* Spacers */}
                                  {Array.from({ length: startDayOfWeek }).map((_, idx) => (
                                    <div key={`space-${idx}`} className="py-1" />
                                  ))}

                                  {/* Days */}
                                  {daysArray.map((day) => {
                                    const bookingOnDay = isDateBooked(house.id, curSel.year, curSel.month, day);
                                    return (
                                      <div
                                        key={day}
                                        className={`py-1 rounded-lg border text-center transition-all relative group cursor-help ${
                                          bookingOnDay
                                            ? 'bg-rose-50 border-rose-200 text-rose-700 font-extrabold'
                                            : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                        }`}
                                        title={
                                          bookingOnDay
                                            ? `محجوز: ${bookingOnDay.organizationName || bookingOnDay.userName} (${bookingOnDay.guestsCount} فرد)`
                                            : 'شاغر ومتاح للحجز'
                                        }
                                      >
                                        <span>{day}</span>
                                        
                                        {bookingOnDay && (
                                          <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-rose-600" />
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* Calendar Legend and Details */}
                                <div className="pt-2 border-t border-[#D6D6C2]/40 flex flex-col gap-1.5 text-[9.5px] text-[#8A8A70] font-bold">
                                  <div className="flex items-center justify-between">
                                    <span className="flex items-center gap-1">
                                      <span className="w-2.5 h-2.5 rounded bg-rose-50 border border-rose-200" />
                                      <span>محجوز (مشغول)</span>
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <span className="w-2.5 h-2.5 rounded bg-emerald-50 border border-emerald-200" />
                                      <span>شاغر (متاح)</span>
                                    </span>
                                  </div>

                                  {/* List of bookings in this month for this house */}
                                  {(() => {
                                    const monthBookings = bookings.filter((b) => {
                                      if (b.houseId !== house.id || (b.status !== 'approved' && b.status !== 'completed')) return false;
                                      // check if booking overlaps with this month
                                      const bStart = new Date(b.checkIn);
                                      const bEnd = new Date(b.checkOut);
                                      const rangeStart = new Date(curSel.year, curSel.month - 1, 1);
                                      const rangeEnd = new Date(curSel.year, curSel.month, 0);
                                      return bStart <= rangeEnd && bEnd >= rangeStart;
                                    });

                                    if (monthBookings.length > 0) {
                                      return (
                                        <div className="bg-[#EBEBE0]/20 p-2 rounded-xl border border-[#D6D6C2]/40 mt-1 space-y-1">
                                          <div className="text-[#4A4A3A] text-[9px] font-black">الحجوزات النشطة هذا الشهر:</div>
                                          {monthBookings.map((b) => (
                                            <div key={b.id} className="text-[#5A5A40] text-[9px] flex items-center justify-between border-b border-[#D6D6C2]/20 pb-1 last:border-0 last:pb-0">
                                              <span className="font-extrabold text-right truncate max-w-[130px]">
                                                • {b.organizationName || b.userName}
                                              </span>
                                              <span className="font-mono text-[8px] bg-amber-50 text-amber-900 border border-amber-100 px-1 rounded">
                                                {b.checkIn.split('-')[2]} - {b.checkOut.split('-')[2]} ({b.guestsCount} فرد)
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      );
                                    }
                                    return (
                                      <div className="text-center py-1.5 text-[#8A8A70] text-[9px] bg-emerald-50/20 border border-emerald-100 rounded-lg">
                                        لا توجد حجوزات مؤكدة في هذا الشهر، البيت شاغر بالكامل 🌟
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>

                    {/* Collapsible Photo Manager */}
                    <div className="border-t border-[#D6D6C2]/50 pt-2 mt-2">
                      <button
                        type="button"
                        id={`toggle-photos-${house.id}`}
                        onClick={() => {
                          setExpandedPhotosForHouse(expandedPhotosForHouse === house.id ? null : house.id);
                        }}
                        className="w-full flex items-center justify-between text-[11px] font-black text-[#5A5A40] hover:text-[#4A4A3A] hover:bg-[#EBEBE0]/20 py-1.5 px-2 rounded-xl transition-all cursor-pointer"
                      >
                        <span className="flex items-center gap-1.5">
                          <Camera className="w-3.5 h-3.5 text-[#5A5A40]" />
                          <span>إدارة صور الغرف والخدمات والمباني 📸</span>
                        </span>
                        <span className="text-[10px] text-[#8A8A70]">
                          {expandedPhotosForHouse === house.id ? 'إخفاء الصور ▲' : 'إضافة وعرض الصور ▼'}
                        </span>
                      </button>

                      {expandedPhotosForHouse === house.id && (
                        <div className="mt-2 p-3 bg-[#FBFBFA] border border-[#D6D6C2]/60 rounded-2xl space-y-3 text-right">
                          <div className="space-y-1">
                            <span className="text-[10px] font-extrabold text-[#4A4A3A]">إضافة صورة جديدة للغرف أو الخدمات:</span>
                            <p className="text-[9px] text-[#8A8A70]">اختر صورة من جهازك أو التقطها بالكاميرا لتحديث ألبوم المعاينة للخدام والمجموعات.</p>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div className="col-span-1">
                              <label className="block text-[8.5px] font-bold text-[#8A8A70] mb-0.5">نوع وتصنيف الصورة:</label>
                              <select
                                id={`photo-cat-${house.id}`}
                                value={extraPhotoCategory}
                                onChange={(e) => setExtraPhotoCategory(e.target.value as 'room' | 'service' | 'other')}
                                className="w-full bg-white border border-[#D6D6C2] text-[10px] px-2 py-1.5 rounded-lg focus:outline-none"
                              >
                                <option value="room">🛌 غرف النوم والأسرة</option>
                                <option value="service">🍽️ الخدمات والمطعم والملاعب</option>
                                <option value="other">⛪ المبنى وقاعات الاجتماعات</option>
                              </select>
                            </div>

                            <div className="col-span-1">
                              <label className="block text-[8.5px] font-bold text-[#8A8A70] mb-0.5">وصف مختصر (مثال: غرفة خلوة مزدوجة):</label>
                              <input
                                id={`photo-label-${house.id}`}
                                type="text"
                                placeholder="غرفة خلوة مزدوجة"
                                value={extraPhotoLabel}
                                onChange={(e) => setExtraPhotoLabel(e.target.value)}
                                className="w-full bg-white border border-[#D6D6C2] text-[10px] px-2 py-1.5 rounded-lg focus:outline-none"
                              />
                            </div>

                            <div className="col-span-1">
                              <label className="block text-[8.5px] font-bold text-[#8A8A70] mb-0.5">صورة الغرفة/الخدمة:</label>
                              <PhotoPickerButtons idPrefix={`photo-${house.id}`} onSelect={setExtraPhotoUrl} />
                              {extraPhotoUrl && (
                                <div className="flex items-center gap-2 mt-1.5">
                                  <img src={extraPhotoUrl} alt="معاينة" className="w-10 h-10 object-cover rounded-lg border border-[#D6D6C2]" />
                                  <button
                                    type="button"
                                    id={`add-photo-btn-${house.id}`}
                                    onClick={() => {
                                      const labelPrefix = extraPhotoCategory === 'room' ? '🛌 غرف' : extraPhotoCategory === 'service' ? '🍽️ خدمات' : '⛪ مباني';
                                      const descStr = extraPhotoLabel.trim() ? `${labelPrefix}: ${extraPhotoLabel.trim()}` : `${labelPrefix}`;

                                      const updatedHouse = {
                                        ...house,
                                        images: [...house.images, extraPhotoUrl],
                                        imageDescriptions: {
                                          ...(house.imageDescriptions || {}),
                                          [extraPhotoUrl]: descStr
                                        }
                                      };

                                      if (onUpdateHouse) {
                                        onUpdateHouse(updatedHouse);
                                      }
                                      setExtraPhotoUrl('');
                                      setExtraPhotoLabel('');
                                      setPhotosSuccessMsg('تم إضافة الصورة بنجاح وتحديث ألبوم البيت للزوار!');
                                      setTimeout(() => setPhotosSuccessMsg(''), 3000);
                                    }}
                                    className="flex-1 bg-[#5A5A40] text-white text-[10px] font-bold px-2 py-1.5 rounded-lg cursor-pointer hover:bg-[#4A4A3A]"
                                  >
                                    إضافة للألبوم
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          {photosSuccessMsg && (
                            <p className="text-[9px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-1.5 text-center font-bold">
                              {photosSuccessMsg}
                            </p>
                          )}

                          {/* Existing Images Gallery with Category Badges and Delete button */}
                          <div className="space-y-1.5 pt-2 border-t border-[#D6D6C2]/40">
                            <span className="text-[9.5px] font-extrabold text-[#4A4A3A]">الصور المضافة حالياً للبيت ({house.images.length}):</span>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {house.images.map((img, idx) => {
                                const desc = house.imageDescriptions?.[img] || (idx === 0 ? 'الصورة الرئيسية' : 'صورة إضافية');
                                return (
                                  <div key={`${img}-${idx}`} className="relative bg-white border border-[#D6D6C2] rounded-xl overflow-hidden group">
                                    <img referrerPolicy="no-referrer" src={img} alt="بيت خلوة" className="w-full h-14 object-cover" />
                                    <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[8px] p-0.5 text-center truncate font-bold" title={desc}>
                                      {desc}
                                    </div>
                                    {house.images.length > 1 && (
                                      <button
                                        type="button"
                                        title="حذف الصورة"
                                        onClick={() => {
                                          if (confirm('هل أنت متأكد من رغبتك في حذف هذه الصورة من ألبوم البيت؟')) {
                                            const updatedHouse = {
                                              ...house,
                                              images: house.images.filter((_, i) => i !== idx)
                                            };
                                            if (onUpdateHouse) {
                                              onUpdateHouse(updatedHouse);
                                            }
                                          }
                                        }}
                                        className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[8px] font-bold hover:bg-red-700 shadow cursor-pointer"
                                      >
                                        ✕
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2.5 Room Management */}
      {activeTab === 'rooms' && (
        <div className="space-y-3">
          {ownerHouses.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#D6D6C2] p-6 text-center text-xs text-[#8A8A70]">
              أضف بيتك أولاً من تبويب "إضافة بيت جديد" قبل إدارة الغرف.
            </div>
          ) : (
            <>
              <div className="bg-white rounded-2xl border border-[#D6D6C2] p-4 space-y-3">
                <div className="text-xs font-bold text-[#4A4A3A] flex items-center gap-1.5">
                  <BedDouble className="w-4 h-4 text-[#5A5A40]" />
                  {editingRoomId ? 'تعديل بيانات الغرفة' : 'إضافة غرفة جديدة'}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[8.5px] font-bold text-[#8A8A70] mb-0.5">اسم/رقم الغرفة:</label>
                    <input
                      id="room-name-input"
                      type="text"
                      placeholder="مثال: غرفة رقم 1"
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                      className="w-full bg-white border border-[#D6D6C2] text-[10px] px-2 py-1.5 rounded-lg focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[8.5px] font-bold text-[#8A8A70] mb-0.5">عدد الأسرة:</label>
                    <input
                      id="room-beds-input"
                      type="number"
                      min={1}
                      value={roomBeds}
                      onChange={(e) => setRoomBeds(parseInt(e.target.value) || 1)}
                      className="w-full bg-white border border-[#D6D6C2] text-[10px] px-2 py-1.5 rounded-lg focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[8.5px] font-bold text-[#8A8A70] mb-0.5">السعر لليلة (اختياري):</label>
                    <input
                      id="room-price-input"
                      type="number"
                      min={0}
                      placeholder="سعر البيت الافتراضي"
                      value={roomPrice}
                      onChange={(e) => setRoomPrice(e.target.value)}
                      className="w-full bg-white border border-[#D6D6C2] text-[10px] px-2 py-1.5 rounded-lg focus:outline-none"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    id="room-submit-btn"
                    type="button"
                    onClick={() => {
                      if (!roomName.trim()) { alert('يرجى إدخال اسم الغرفة.'); return; }
                      const house = ownerHouses[0];
                      if (editingRoomId) {
                        const existing = ownerRooms.find((r) => r.id === editingRoomId);
                        if (existing && onUpdateRoom) {
                          onUpdateRoom({
                            ...existing,
                            name: roomName.trim(),
                            bedsCount: roomBeds,
                            pricePerNight: roomPrice ? parseFloat(roomPrice) : undefined,
                          });
                        }
                      } else if (onAddRoom) {
                        onAddRoom({
                          id: `room_${Date.now()}`,
                          houseId: house.id,
                          name: roomName.trim(),
                          bedsCount: roomBeds,
                          pricePerNight: roomPrice ? parseFloat(roomPrice) : undefined,
                          images: [],
                          status: 'available',
                          createdAt: new Date().toISOString(),
                        });
                      }
                      setRoomName(''); setRoomBeds(2); setRoomPrice(''); setEditingRoomId(null);
                    }}
                    className="bg-[#5A5A40] hover:bg-[#4A4A3A] text-white text-[10px] font-bold px-4 py-2 rounded-xl cursor-pointer"
                  >
                    {editingRoomId ? 'حفظ التعديل' : 'إضافة الغرفة'}
                  </button>
                  {editingRoomId && (
                    <button
                      type="button"
                      onClick={() => { setEditingRoomId(null); setRoomName(''); setRoomBeds(2); setRoomPrice(''); }}
                      className="bg-[#EBEBE0] text-[#4A4A3A] text-[10px] font-bold px-4 py-2 rounded-xl cursor-pointer"
                    >
                      إلغاء
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-bold text-[#8A8A70] px-1">الغرف المضافة ({ownerRooms.length}):</div>
                {ownerRooms.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-[#D6D6C2] p-4 text-center text-[10px] text-[#8A8A70]">
                    لا توجد غرف مضافة بعد.
                  </div>
                ) : (
                  ownerRooms.map((room) => (
                    <div key={room.id} className="bg-white rounded-2xl border border-[#D6D6C2] p-3 flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-[#4A4A3A]">{room.name}</div>
                        <div className="text-[9.5px] text-[#8A8A70]">
                          {room.bedsCount} سرير · {room.pricePerNight ? `${room.pricePerNight} ج.م/ليلة` : 'سعر البيت الافتراضي'}
                        </div>
                      </div>
                      <select
                        value={room.status}
                        onChange={(e) => onUpdateRoom && onUpdateRoom({ ...room, status: e.target.value as Room['status'] })}
                        className={`text-[9.5px] font-bold border rounded-lg px-2 py-1 cursor-pointer ${
                          room.status === 'available' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                          room.status === 'booked' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                          'bg-rose-50 text-rose-800 border-rose-200'
                        }`}
                      >
                        <option value="available">متاحة</option>
                        <option value="booked">محجوزة</option>
                        <option value="maintenance">صيانة</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => { setEditingRoomId(room.id); setRoomName(room.name); setRoomBeds(room.bedsCount); setRoomPrice(room.pricePerNight?.toString() || ''); }}
                        className="text-[9.5px] font-bold text-[#5A5A40] hover:underline cursor-pointer shrink-0"
                      >
                        تعديل
                      </button>
                      <button
                        type="button"
                        onClick={() => { if (confirm('هل تريد حذف هذه الغرفة؟') && onDeleteRoom) onDeleteRoom(room.id); }}
                        className="text-[9.5px] font-bold text-rose-600 hover:underline cursor-pointer shrink-0"
                      >
                        حذف
                      </button>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* 3. Bookings Management */}
      {activeTab === 'bookings' && (
        <div className="space-y-3">
          <div className="text-xs font-bold text-[#8A8A70] px-1">إدارة طلبات الحجز حسب الحالة:</div>

          {/* Booking status filter chips */}
          <div className="flex flex-wrap gap-1.5 bg-white border border-[#D6D6C2] p-1.5 rounded-2xl">
            {([
              { key: 'all', label: 'الكل', color: 'bg-[#5A5A40]' },
              { key: 'new', label: 'جديدة', color: 'bg-amber-600' },
              { key: 'confirmed', label: 'مؤكدة', color: 'bg-emerald-600' },
              { key: 'current', label: 'حالية', color: 'bg-sky-600' },
              { key: 'completed', label: 'مكتملة', color: 'bg-slate-500' },
              { key: 'cancelled', label: 'ملغاة', color: 'bg-rose-500' },
            ] as const).map((f) => {
              const isSel = bookingFilter === f.key;
              const count = bookingCountByCategory[f.key];
              return (
                <button
                  key={f.key}
                  id={`owner-booking-filter-${f.key}`}
                  onClick={() => setBookingFilter(f.key)}
                  className={`flex items-center gap-1.5 text-[10px] font-extrabold px-2.5 py-1 rounded-xl transition-all cursor-pointer ${
                    isSel ? `${f.color} text-white shadow-sm` : 'bg-[#EBEBE0]/40 text-[#8A8A70] hover:bg-[#EBEBE0]/70'
                  }`}
                >
                  <span>{f.label}</span>
                  <span className={`text-[9px] px-1.5 rounded-full ${isSel ? 'bg-white/25' : 'bg-white border border-[#D6D6C2] text-[#4A4A3A]'}`}>{count}</span>
                </button>
              );
            })}
          </div>

          {filteredOwnerBookings.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 border border-[#D6D6C2] text-center">
              <p className="text-xs text-[#8A8A70]">
                {ownerBookings.length === 0 ? 'لا يوجد أي حجوزات واردة لبيوتك بعد.' : 'لا توجد حجوزات في هذا التصنيف حالياً.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredOwnerBookings.map((booking) => {
                const isPending = booking.status === 'pending';
                const isApproved = booking.status === 'approved';
                const isCompleted = booking.status === 'completed';
                const category = categorizeBooking(booking);
                const depositAmt = booking.depositAmount || Math.round(booking.totalPrice * 0.15);
                const remainingBalance = booking.totalPrice - (booking.depositPaid ? depositAmt : 0);

                const statusBadge = (() => {
                  if (booking.status === 'rejected') return { label: 'ملغى / مرفوض', cls: 'bg-rose-50 text-rose-800 border-rose-200' };
                  if (booking.status === 'completed') return { label: 'مكتمل', cls: 'bg-slate-100 text-slate-700 border-slate-200' };
                  if (isPending) return { label: 'جديد ⚠️', cls: 'bg-amber-50 text-amber-800 border-amber-200' };
                  if (category === 'current') return { label: 'حالي (نازل الآن)', cls: 'bg-sky-50 text-sky-800 border-sky-200' };
                  return { label: 'مؤكد', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
                })();

                return (
                  <div id={`owner-booking-${booking.id}`} key={booking.id} className="bg-white rounded-3xl border border-[#D6D6C2] shadow-sm p-4 space-y-3 text-right">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[9px] text-[#8A8A70] font-bold">الحساب: {booking.userName}</span>
                        <h4 className="text-xs font-bold text-[#4A4A3A] mt-0.5">{booking.houseName}</h4>
                        <div className="text-[10px] text-[#8A8A70] font-medium">
                          {booking.organizationName && <span>{booking.organizationName} • </span>}
                          رقم الهاتف: {booking.userPhone}
                        </div>
                      </div>

                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusBadge.cls}`}>
                        {statusBadge.label}
                      </span>
                    </div>

                    <div className="bg-[#EBEBE0]/30 rounded-2xl p-3 grid grid-cols-2 gap-2 text-[10px] text-[#4A4A3A] font-medium border border-[#D6D6C2]">
                      <div>تاريخ الوصول: <strong className="text-[#4A4A3A] font-bold">{booking.checkIn}</strong></div>
                      <div>تاريخ المغادرة: <strong className="text-[#4A4A3A] font-bold">{booking.checkOut}</strong></div>
                      <div>عدد الأفراد: <strong className="text-[#4A4A3A] font-bold">{booking.guestsCount} فرد</strong></div>
                      <div>قيمة الحجز: <strong className="text-[#5A5A40] font-extrabold">{booking.totalPrice.toLocaleString()} ج.م</strong></div>
                    </div>

                    {/* Financial breakdown: deposit + remaining */}
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div className={`p-2 rounded-xl border ${booking.depositPaid ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                        <div className="font-bold text-[9px] mb-0.5" style={{ color: booking.depositPaid ? '#065f46' : '#92400e' }}>
                          {booking.depositPaid ? '✓ العربون المستلم' : 'العربون (لم يُستلم)'}
                        </div>
                        <div className="font-extrabold" style={{ color: booking.depositPaid ? '#065f46' : '#92400e' }}>
                          {depositAmt.toLocaleString()} ج.م
                        </div>
                      </div>
                      <div className="p-2 rounded-xl border bg-slate-50 border-slate-200">
                        <div className="text-slate-700 font-bold text-[9px] mb-0.5">المبلغ المتبقي</div>
                        <div className="text-slate-800 font-extrabold">{remainingBalance.toLocaleString()} ج.م</div>
                      </div>
                    </div>

                    {/* Client notes / conference requests */}
                    {booking.isLargeConferenceQuote && booking.conferenceDetails && (
                      <div className="bg-amber-50/40 p-2.5 rounded-xl border border-amber-200/60 text-[10px] text-[#4A4A3A] space-y-1">
                        <span className="font-bold text-amber-900 block">📝 ملاحظات وطلبات العميل:</span>
                        <p className="italic text-slate-700">{booking.conferenceDetails.extraRequests}</p>
                        {booking.conferenceDetails.mealsIncluded && (
                          <span className="text-amber-800 font-semibold">• مطلوب تقديم الوجبات الغذائية كاملة مع القاعة</span>
                        )}
                      </div>
                    )}

                    {/* Check-in / Check-out timestamps */}
                    {(booking.checkedInAt || booking.checkedOutAt) && (
                      <div className="grid grid-cols-2 gap-2 text-[9px] text-[#8A8A70] bg-[#FBFBFA] p-2 rounded-xl border border-[#D6D6C2]/50">
                        {booking.checkedInAt && (
                          <div className="text-sky-800">
                            🏠 وصل: {new Date(booking.checkedInAt).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}
                          </div>
                        )}
                        {booking.checkedOutAt && (
                          <div className="text-slate-700">
                            🚪 غادر: {new Date(booking.checkedOutAt).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Pending Actions */}
                    {isPending && (
                      <div className="flex gap-2 justify-end pt-2 flex-wrap">
                        <button
                          id={`reject-booking-btn-${booking.id}`}
                          onClick={() => {
                            if (confirm('هل أنت متأكد من رفض هذا الحجز؟')) {
                              onRejectBooking(booking.id);
                            }
                          }}
                          className="flex items-center gap-1 bg-[#EBEBE0] hover:bg-rose-50 hover:text-rose-800 text-[#4A4A3A] border border-[#D6D6C2] px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                          <span>رفض الطلب</span>
                        </button>
                        <button
                          id={`approve-booking-btn-${booking.id}`}
                          onClick={() => onApproveBooking(booking.id)}
                          className="flex items-center gap-1 bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-1.5 rounded-xl text-xs font-extrabold transition-all shadow-sm cursor-pointer"
                        >
                          <Check className="w-4 h-4" />
                          <span>قبول وتأكيد الحجز</span>
                        </button>
                      </div>
                    )}

                    {/* Approved bookings: 4 workflow actions */}
                    {isApproved && (
                      <div className="flex gap-2 justify-end pt-2 flex-wrap">
                        {!booking.depositPaid && onConfirmDeposit && (
                          <button
                            id={`confirm-deposit-btn-${booking.id}`}
                            onClick={() => {
                              if (confirm(`تأكيد استلام عربون بمبلغ ${depositAmt.toLocaleString()} ج.م؟`)) {
                                onConfirmDeposit(booking.id);
                              }
                            }}
                            className="flex items-center gap-1 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
                          >
                            <Coins className="w-4 h-4" />
                            <span>تأكيد استلام العربون</span>
                          </button>
                        )}
                        {!booking.checkedInAt && onCheckInBooking && (
                          <button
                            id={`checkin-btn-${booking.id}`}
                            onClick={() => onCheckInBooking(booking.id)}
                            className="flex items-center gap-1 bg-sky-600 hover:bg-sky-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
                          >
                            <Home className="w-4 h-4" />
                            <span>تسجيل وصول</span>
                          </button>
                        )}
                        {booking.checkedInAt && !booking.checkedOutAt && onCheckOutBooking && (
                          <button
                            id={`checkout-btn-${booking.id}`}
                            onClick={() => {
                              if (confirm('تسجيل مغادرة العميل وإنهاء الحجز؟')) {
                                onCheckOutBooking(booking.id);
                              }
                            }}
                            className="flex items-center gap-1 bg-slate-600 hover:bg-slate-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
                          >
                            <span>🚪 تسجيل مغادرة</span>
                          </button>
                        )}
                        <button
                          id={`owner-allocate-btn-${booking.id}`}
                          onClick={() => setActiveAllocationBooking(booking)}
                          className="flex items-center gap-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
                        >
                          <Building className="w-4 h-4 text-amber-700" />
                          <span>توزيع الغرف 🛏️</span>
                        </button>
                      </div>
                    )}

                    {isCompleted && (
                      <div className="flex justify-end pt-1">
                        <button
                          id={`owner-allocate-btn-${booking.id}`}
                          onClick={() => setActiveAllocationBooking(booking)}
                          className="flex items-center gap-1 bg-[#EBEBE0] hover:bg-[#DEDECB] text-[#4A4A3A] border border-[#D6D6C2] px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
                        >
                          <Building className="w-4 h-4" />
                          <span>عرض توزيع الغرف</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 4. Add a New Retreat House */}
      {activeTab === 'add_house' && (
        ownerHouses.length >= 1 ? (
          <div className="bg-white rounded-3xl border border-[#D6D6C2] p-8 text-center space-y-4 animate-in fade-in duration-200">
            <div className="w-16 h-16 bg-amber-50 border border-amber-200 text-amber-600 rounded-full flex items-center justify-center mx-auto text-3xl">
              ⚠️
            </div>
            <div className="space-y-1.5 max-w-md mx-auto">
              <h3 className="text-sm font-black text-[#4A4A3A]">لقد وصلت للحد الأقصى المسموح به من البيوت!</h3>
              <p className="text-xs text-[#8A8A70] leading-relaxed">
                حسابك الحالي ذو صلاحية <strong>مالك بيت فردي</strong>. لا يمكنك إضافة أكثر من <strong>بيت واحد فقط ({ownerHouses[0]?.name})</strong> في لوحة التحكم هذه لضمان جودة الإشغال والمتابعة الدقيقة.
              </p>
              <div className="bg-[#FAF8F5] border border-[#D6D6C2] p-4 rounded-2xl text-[11px] text-[#5A5A40] text-right space-y-2 mt-2">
                <p className="font-bold">💡 ماذا يمكنك أن تفعل الآن؟</p>
                <p>• تعديل وإدارة تفاصيل بيتك الحالي وإضافة صور الغرف والخدمات وجدول الإشغال.</p>
                <p>• التواصل مع الدعم الفني أو المنسق البطريركي لطلب ترقية الحساب لإدارة مجموعة بيوت متعددة.</p>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmitHouse} className="bg-white rounded-3xl border border-[#D6D6C2] p-5 space-y-4 text-right">
          <div className="space-y-1 pb-2 border-b border-[#D6D6C2]">
            <h3 className="text-xs font-extrabold text-[#4A4A3A]">تفاصيل تسجيل بيت مؤتمرات جديد</h3>
            <p className="text-[10px] text-[#8A8A70]">يرجى ملء البيانات بدقة لتمكين الخدام والكنائس من حجز بيتك.</p>
          </div>

          <div className="space-y-3">
            {/* Property Type selector first */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-[#8A8A70] mb-1">نوع وتصنيف العقار السكني:</label>
                <select
                  id="add-property-type"
                  value={propertyType}
                  onChange={(e) => setPropertyType(e.target.value as 'conference' | 'student' | 'staff')}
                  className="w-full bg-white border border-[#D6D6C2] text-xs px-2.5 py-2 rounded-xl text-[#4A4A3A] focus:outline-none"
                >
                  <option value="conference">بيت مؤتمرات / فندق مسيحي</option>
                  <option value="student">سكن طلاب وطالبات مغتربين</option>
                  <option value="staff">سكن موظفين ومغتربين</option>
                </select>
              </div>

              {propertyType === 'student' ? (
                <div>
                  <label className="block text-[11px] font-bold text-[#8A8A70] mb-1">فئة السكن الطلابية:</label>
                  <select
                    id="add-student-gender"
                    value={studentHousingGender}
                    onChange={(e) => setStudentHousingGender(e.target.value as 'boys' | 'girls')}
                    className="w-full bg-white border border-[#D6D6C2] text-xs px-2.5 py-2 rounded-xl text-[#4A4A3A] focus:outline-none"
                  >
                    <option value="boys">بنين (شباب مسيحي)</option>
                    <option value="girls">بنات (شابات مسيحيات)</option>
                  </select>
                </div>
              ) : (
                <div className="opacity-50 select-none">
                  <label className="block text-[11px] font-bold text-[#8A8A70] mb-1">فئة السكن:</label>
                  <div className="w-full bg-gray-100 border border-[#D6D6C2] text-xs px-2.5 py-2 rounded-xl text-gray-500">مشترك / عائلات مغتربة</div>
                </div>
              )}
            </div>

            {/* If Student / Staff monthly rent and distance config */}
            {(propertyType === 'student' || propertyType === 'staff') && (
              <div className="grid grid-cols-2 gap-2 p-3 bg-[#EBEBE0]/30 rounded-2xl border border-[#D6D6C2] text-right animate-fade-in">
                <div>
                  <label className="block text-[10px] font-bold text-[#8A8A70] mb-1">الإيجار الشهري المطلوب للفرد (ج.م):</label>
                  <input
                    id="add-monthly-rent-input"
                    type="number"
                    required
                    min={100}
                    value={monthlyRent}
                    onChange={(e) => setMonthlyRent(parseInt(e.target.value) || 1500)}
                    className="w-full bg-white border border-[#D6D6C2] text-xs px-3 py-1.5 rounded-xl text-[#4A4A3A] focus:outline-none"
                  />
                </div>
                {propertyType === 'student' ? (
                  <div>
                    <label className="block text-[10px] font-bold text-[#8A8A70] mb-1">القرب من الجامعة / الكلية:</label>
                    <input
                      id="add-university-distance"
                      type="text"
                      placeholder="مثال: دقيقتين من جامعة أسيوط"
                      value={distanceFromUniversity}
                      onChange={(e) => setDistanceFromUniversity(e.target.value)}
                      className="w-full bg-white border border-[#D6D6C2] text-xs px-3 py-1.5 rounded-xl text-[#4A4A3A] focus:outline-none"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-[10px] font-bold text-[#8A8A70] mb-1">القرب من المواصلات العامة:</label>
                    <input
                      id="add-transport-distance"
                      type="text"
                      placeholder="مثال: بجوار محطة مترو مارجرجس"
                      className="w-full bg-white border border-[#D6D6C2] text-xs px-3 py-1.5 rounded-xl text-[#4A4A3A] focus:outline-none"
                    />
                  </div>
                )}
              </div>
            )}

            {/* House Name */}
            <div>
              <label className="block text-[11px] font-bold text-[#8A8A70] mb-1">
                {propertyType === 'conference' ? 'اسم بيت المؤتمرات / الفندق المسيحي:' : 'اسم السكن المغترب:'}
              </label>
              <input
                id="add-house-name"
                type="text"
                required
                placeholder={propertyType === 'conference' ? 'مثال: بيت الأنبا بولا للمؤتمرات والخدمات' : 'مثال: سكن القديس يوسف للطلبة المغتربين'}
                value={houseName}
                onChange={(e) => setHouseName(e.target.value)}
                className="w-full bg-white border border-[#D6D6C2] text-xs px-3 py-2 rounded-xl text-[#4A4A3A] focus:outline-none focus:border-[#5A5A40]"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-[11px] font-bold text-[#8A8A70] mb-1">وصف تفصيلي للبيت ومميزاته:</label>
              <textarea
                id="add-house-desc"
                rows={3}
                required
                placeholder="أدخل مميزات الموقع، الغرف، القاعات، الخدمات الروحية والقداسات المتوفرة..."
                value={houseDesc}
                onChange={(e) => setHouseDesc(e.target.value)}
                className="w-full bg-white border border-[#D6D6C2] text-xs px-3 py-2 rounded-xl text-[#4A4A3A] focus:outline-none focus:border-[#5A5A40]"
              />
            </div>

            {/* Governorate and Address */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-[#8A8A70] mb-1">المحافظة التابع لها:</label>
                <select
                  id="add-house-gov"
                  value={houseGov}
                  onChange={(e) => setHouseGov(e.target.value)}
                  className="w-full bg-white border border-[#D6D6C2] text-xs px-2.5 py-2 rounded-xl text-[#4A4A3A] focus:outline-none"
                >
                  {GOVERNORATES.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#8A8A70] mb-1">العنوان بالتفصيل:</label>
                <input
                  id="add-house-address"
                  type="text"
                  required
                  placeholder="الشارع، العلامة المميزة، المدينة"
                  value={houseAddress}
                  onChange={(e) => setHouseAddress(e.target.value)}
                  className="w-full bg-white border border-[#D6D6C2] text-xs px-3 py-2 rounded-xl text-[#4A4A3A] focus:outline-none focus:border-[#5A5A40]"
                />
              </div>

              {/* Location Picker */}
              <div>
                <label className="block text-[11px] font-bold text-[#8A8A70] mb-1">موقع البيت على الخريطة:</label>
                <button
                  type="button"
                  onClick={() => {
                    if (!navigator.geolocation) {
                      setGeoError('المتصفح لا يدعم تحديد الموقع.');
                      return;
                    }
                    setGeoLoading(true);
                    setGeoError('');
                    navigator.geolocation.getCurrentPosition(
                      (pos) => {
                        setHouseLat(pos.coords.latitude);
                        setHouseLng(pos.coords.longitude);
                        setGeoLoading(false);
                      },
                      () => {
                        setGeoError('تعذر تحديد الموقع. تأكد من إذن الموقع في المتصفح.');
                        setGeoLoading(false);
                      }
                    );
                  }}
                  className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-xl border border-[#5A5A40] text-[#5A5A40] bg-white hover:bg-[#F0EDE6] transition-colors"
                >
                  {geoLoading ? (
                    <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-[#5A5A40] border-t-transparent rounded-full" />
                  ) : (
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>
                  )}
                  {geoLoading ? 'جاري تحديد الموقع...' : 'استخدم موقعي الحالي'}
                </button>

                {houseLat && houseLng && (
                  <p className="mt-1.5 text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-emerald-500"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                    تم تحديد الموقع: {houseLat.toFixed(5)}, {houseLng.toFixed(5)}
                  </p>
                )}
                {geoError && (
                  <p className="mt-1.5 text-[11px] text-red-500">{geoError}</p>
                )}
              </div>
            </div>

            {/* Price & Capacity */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-[#8A8A70] mb-1">
                  {propertyType === 'conference' ? 'سعر الفرد لليلة (ج.م):' : 'سعر تأمين الحجز مسبقاً (ج.م):'}
                </label>
                <input
                  id="add-house-price"
                  type="number"
                  required
                  min={0}
                  value={propertyType === 'conference' ? pricePerNight : 200}
                  disabled={propertyType !== 'conference'}
                  onChange={(e) => setPricePerNight(parseInt(e.target.value) || 150)}
                  className="w-full bg-white disabled:bg-gray-100 border border-[#D6D6C2] text-xs px-3 py-2 rounded-xl text-[#4A4A3A] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#8A8A70] mb-1">عدد الغرف الإجمالي:</label>
                <input
                  id="add-house-rooms"
                  type="number"
                  required
                  min={1}
                  value={roomsCount}
                  onChange={(e) => setRoomsCount(parseInt(e.target.value) || 10)}
                  className="w-full bg-white border border-[#D6D6C2] text-xs px-3 py-2 rounded-xl text-[#4A4A3A] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#8A8A70] mb-1">عدد الأسرة الكلي:</label>
                <input
                  id="add-house-beds"
                  type="number"
                  required
                  min={1}
                  value={bedsCount}
                  onChange={(e) => setBedsCount(parseInt(e.target.value) || 30)}
                  className="w-full bg-white border border-[#D6D6C2] text-xs px-3 py-2 rounded-xl text-[#4A4A3A] focus:outline-none"
                />
              </div>
            </div>

            {/* Suitability */}
            <div>
              <label className="block text-[11px] font-bold text-[#8A8A70] mb-1">مناسب من حيث الفئات لـ:</label>
              <div className="flex flex-wrap gap-2 pt-1">
                {(Object.keys(SUITABILITY_MAP) as ('youth' | 'children' | 'families' | 'retreat')[]).map((key) => {
                  const isSelected = selectedSuitability.includes(key);
                  return (
                    <button
                      id={`add-suitability-${key}`}
                      key={key}
                      type="button"
                      onClick={() => handleSuitabilityToggle(key)}
                      className={`text-[10px] font-bold px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected 
                          ? 'bg-[#5A5A40] border-[#5A5A40] text-white shadow-sm' 
                          : 'bg-[#EBEBE0]/40 border border-[#D6D6C2] text-[#4A4A3A] hover:bg-[#DEDECB]'
                      }`}
                    >
                      {SUITABILITY_MAP[key]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Amenities / Services checklist */}
            <div>
              <label className="block text-[11px] font-bold text-[#8A8A70] mb-1">الخدمات المتوفرة والمرافق بالبيت:</label>
              <div className="grid grid-cols-2 gap-1.5 pt-1">
                {AMENITIES_LIST.map((srv) => {
                  const isChecked = selectedServices.includes(srv);
                  return (
                    <button
                      id={`add-service-${srv}`}
                      key={srv}
                      type="button"
                      onClick={() => handleServiceToggle(srv)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[10px] font-semibold text-right transition-all cursor-pointer ${
                        isChecked 
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-900' 
                          : 'bg-[#EBEBE0]/20 border border-[#D6D6C2] text-[#4A4A3A] hover:bg-[#DEDECB]'
                      }`}
                    >
                      <span className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0 ${
                        isChecked ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-300'
                      }`}>
                        {isChecked && <Check className="w-2.5 h-2.5" />}
                      </span>
                      <span>{srv}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Conference Halls Creator */}
            <div className="bg-[#EBEBE0]/30 p-3 rounded-2xl border border-[#D6D6C2] space-y-2">
              <label className="block text-[11px] font-bold text-[#4A4A3A]">إضافة قاعات اجتماعات ومؤتمرات كنسية:</label>
              
              {halls.length > 0 && (
                <div className="space-y-1 mb-2">
                  {halls.map((h) => (
                    <div key={h.id} className="flex justify-between items-center bg-white px-2.5 py-1.5 rounded-lg text-[10px] border border-[#D6D6C2]">
                      <div>
                        <span className="font-bold text-[#4A4A3A]">{h.name}</span>
                        <span className="text-[#8A8A70] font-medium"> (سعة {h.capacity} فرد)</span>
                      </div>
                      <button
                        id={`remove-hall-${h.id}`}
                        type="button"
                        onClick={() => handleRemoveHall(h.id)}
                        className="text-rose-600 hover:text-rose-800 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-1.5">
                <input
                  id="hall-name"
                  type="text"
                  placeholder="اسم القاعة (مثال: قاعة البابا شنودة الثالث)"
                  value={hallName}
                  onChange={(e) => setHallName(e.target.value)}
                  className="w-full bg-white border border-[#D6D6C2] text-[10px] px-2 py-1.5 rounded-lg text-[#4A4A3A] focus:outline-none focus:border-[#5A5A40]"
                />
                <div className="flex gap-2 items-center">
                  <div className="flex-1">
                    <input
                      id="hall-capacity"
                      type="number"
                      placeholder="السعة الاستيعابية كأفراد"
                      value={hallCapacity}
                      onChange={(e) => setHallCapacity(parseInt(e.target.value) || 50)}
                      className="w-full bg-white border border-[#D6D6C2] text-[10px] px-2 py-1.5 rounded-lg text-[#4A4A3A] focus:outline-none focus:border-[#5A5A40]"
                    />
                  </div>
                  <button
                    id="add-hall-btn"
                    type="button"
                    onClick={handleAddHall}
                    className="bg-[#5A5A40] text-white text-[10px] font-bold px-3 py-1.5 rounded-lg shrink-0 cursor-pointer hover:bg-[#4A4A3A]"
                  >
                    أضف القاعة +
                  </button>
                </div>
              </div>
            </div>

            {/* Activities and Images URL */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-[#8A8A70] mb-1">الأنشطة (افصل بـ "،"):</label>
                <input
                  id="add-house-activities"
                  type="text"
                  placeholder="سينما، حمام سباحة، ألعاب حركية"
                  value={activitiesInput}
                  onChange={(e) => setActivitiesInput(e.target.value)}
                  className="w-full bg-white border border-[#D6D6C2] text-xs px-3 py-2 rounded-xl text-[#4A4A3A] focus:outline-none focus:border-[#5A5A40]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#8A8A70] mb-1">صورة واجهة البيت:</label>
                <PhotoPickerButtons idPrefix="add-house-image" onSelect={setImageUrl} />
                {imageUrl && (
                  <img src={imageUrl} alt="معاينة صورة الواجهة" className="mt-2 w-full h-28 object-cover rounded-xl border border-[#D6D6C2]" />
                )}
              </div>
            </div>

          </div>

          <button
            id="add-house-submit"
            type="submit"
            className="w-full bg-[#5A5A40] hover:bg-[#4A4A3A] active:bg-[#4A4A3A] text-white text-xs font-bold py-2.5 rounded-xl shadow-md transition-all text-center cursor-pointer"
          >
            إرسال البيت الجديد للمراجعة وتأكيده للظهور
          </button>
        </form>
        )
      )}

      {/* 4b. Financials & Platform Commission */}
      {activeTab === 'financials' && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
          {/* Revenue overview */}
          <div className="bg-white p-4 rounded-3xl border border-[#D6D6C2] space-y-3 text-right">
            <h3 className="text-xs font-black text-[#4A4A3A] border-b border-[#EBEBE0] pb-2">📊 نظرة عامة على الإيرادات</h3>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="bg-[#EBEBE0]/30 p-2.5 rounded-xl border border-[#D6D6C2]/60">
                <div className="text-[9px] text-[#8A8A70] font-bold mb-0.5">إجمالي قيمة الحجوزات المؤكدة</div>
                <div className="text-sm font-extrabold text-[#4A4A3A]">{confirmedRevenue.toLocaleString()} ج.م</div>
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

          {/* Commission breakdown */}
          <div className="bg-white p-4 rounded-3xl border border-[#D6D6C2] space-y-3 text-right">
            <h3 className="text-xs font-black text-[#4A4A3A] border-b border-[#EBEBE0] pb-2">🧾 عمولة التطبيق ({(PLATFORM_COMMISSION * 100).toFixed(0)}%)</h3>
            <div className="space-y-2 text-[11px]">
              <div className="flex justify-between items-center bg-[#EBEBE0]/20 p-2.5 rounded-xl border border-[#D6D6C2]/50">
                <span className="text-[#8A8A70] font-bold">إجمالي قيمة الحجوزات</span>
                <span className="font-extrabold text-[#4A4A3A]">{confirmedRevenue.toLocaleString()} ج.م</span>
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
            <div className="text-[10px] text-[#8A8A70] bg-[#EBEBE0]/30 p-2 rounded-lg border border-[#D6D6C2]/40 flex items-start gap-1.5">
              <Info className="w-3 h-3 shrink-0 mt-0.5" />
              <span>يتم خصم عمولة التطبيق تلقائياً من كل حجز مؤكد. صافي المستحقات هو المبلغ الذي سيتم تحويله لحسابك البنكي بعد استلام الدفعة كاملة من العميل.</span>
            </div>
          </div>

          {/* Per-booking commission ledger */}
          <div className="bg-white p-4 rounded-3xl border border-[#D6D6C2] space-y-3 text-right">
            <h3 className="text-xs font-black text-[#4A4A3A] border-b border-[#EBEBE0] pb-2">📝 سجل العمليات المالية</h3>
            {confirmedBookings.length === 0 ? (
              <p className="text-[11px] text-[#8A8A70] text-center py-3">لا توجد حجوزات مؤكدة بعد.</p>
            ) : (
              <div className="overflow-x-auto -mx-2">
                <table className="min-w-full text-[10px] text-right">
                  <thead className="bg-[#EBEBE0]/40 text-[#4A4A3A] font-extrabold">
                    <tr>
                      <th className="px-2 py-1.5">رقم الحجز</th>
                      <th className="px-2 py-1.5">القيمة</th>
                      <th className="px-2 py-1.5">العمولة ({(PLATFORM_COMMISSION * 100).toFixed(0)}%)</th>
                      <th className="px-2 py-1.5">الصافي</th>
                      <th className="px-2 py-1.5">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {confirmedBookings.map((b) => {
                      const comm = b.totalPrice * PLATFORM_COMMISSION;
                      const net = b.totalPrice - comm;
                      const transferred = b.depositPaid;
                      return (
                        <tr key={b.id} className="border-t border-[#EBEBE0]/60">
                          <td className="px-2 py-1.5 font-mono text-[9px] text-[#8A8A70]">#{b.id.replace('booking_', '').slice(0, 8)}</td>
                          <td className="px-2 py-1.5 font-bold text-[#4A4A3A]">{b.totalPrice.toLocaleString()}</td>
                          <td className="px-2 py-1.5 text-rose-700 font-bold">− {comm.toLocaleString()}</td>
                          <td className="px-2 py-1.5 text-emerald-800 font-extrabold">{net.toLocaleString()}</td>
                          <td className="px-2 py-1.5">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                              transferred ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}>
                              {transferred ? 'تم التحويل' : 'قيد المراجعة'}
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

      {/* 5. Owner Profile Settings */}
      {activeTab === 'profile' && (
        <div className="bg-white p-6 rounded-3xl border border-[#D6D6C2] text-right space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center gap-3 border-b border-[#EBEBE0] pb-4">
            <div className="p-2.5 rounded-2xl bg-[#EBEBE0]/30 text-[#5A5A40] border border-[#D6D6C2]/60">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-[#4A4A3A]">إعدادات حساب مالك البيت</h3>
              <p className="text-[10px] text-[#8A8A70]">تعديل البيانات الشخصية وبيانات التواصل لمالك بيت المؤتمرات</p>
            </div>
          </div>

          {profileSuccessMsg && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-950 p-4 rounded-2xl flex items-center gap-3 text-xs font-bold animate-pulse">
              <span className="text-lg">✅</span>
              <span>{profileSuccessMsg}</span>
            </div>
          )}

          <form
            id="owner-profile-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!profileName.trim() || !profileEmail.trim() || !profilePhone.trim()) {
                alert('يرجى ملء الحقول الإلزامية الأساسية.');
                return;
              }
              
              const updatedUser: User = {
                ...owner,
                name: profileName,
                email: profileEmail,
                phone: profilePhone,
                organizationName: profileOrg || undefined
              };

              if (onUpdateOwnerProfile) {
                onUpdateOwnerProfile(updatedUser);
              }
              setProfileSuccessMsg('تم تحديث بيانات الحساب بنجاح! تم حفظ التغييرات وتطبيقها.');
              setTimeout(() => setProfileSuccessMsg(''), 4000);
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-[#8A8A70]">الاسم الكامل (الإلزامي) 👤:</label>
                <input
                  id="owner-profile-name"
                  type="text"
                  required
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full bg-slate-50 border border-[#D6D6C2] text-xs px-3 py-2.5 rounded-xl text-[#4A4A3A] focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#5A5A40] focus:border-[#5A5A40] transition-all"
                  placeholder="مثال: أ. جرجس نبيل"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-[#8A8A70]">رقم الهاتف للتواصل (الإلزامي) 📞:</label>
                <input
                  id="owner-profile-phone"
                  type="tel"
                  required
                  value={profilePhone}
                  onChange={(e) => setProfilePhone(e.target.value)}
                  className="w-full bg-slate-50 border border-[#D6D6C2] text-xs px-3 py-2.5 rounded-xl text-[#4A4A3A] focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#5A5A40] focus:border-[#5A5A40] transition-all text-left"
                  dir="ltr"
                  placeholder="مثال: 01234567890"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-[#8A8A70]">البريد الإلكتروني (الإلزامي) ✉️:</label>
                <input
                  id="owner-profile-email"
                  type="email"
                  required
                  value={profileEmail}
                  onChange={(e) => setProfileEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-[#D6D6C2] text-xs px-3 py-2.5 rounded-xl text-[#4A4A3A] focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#5A5A40] focus:border-[#5A5A40] transition-all text-left"
                  dir="ltr"
                  placeholder="owner@church.eg"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-[#8A8A70]">اسم جهة الإدارة / الاسم التجاري للبيت 🏨 (اختياري):</label>
                <input
                  id="owner-profile-org"
                  type="text"
                  value={profileOrg}
                  onChange={(e) => setProfileOrg(e.target.value)}
                  className="w-full bg-slate-50 border border-[#D6D6C2] text-xs px-3 py-2.5 rounded-xl text-[#4A4A3A] focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#5A5A40] focus:border-[#5A5A40] transition-all"
                  placeholder="مثال: إدارة دير مارمينا أو فندق سان مارك"
                />
              </div>
            </div>

            <div className="bg-amber-50/60 border border-amber-200/60 p-4 rounded-2xl space-y-1 text-right">
              <span className="text-[10px] font-extrabold text-amber-950 block">🔐 معلومات الأمان وصلاحية الحساب:</span>
              <p className="text-[9px] text-amber-900 leading-relaxed">
                نوع الحساب الحالي هو <strong className="text-[#5A5A40]">مالك بيوت خلوات ومؤتمرات (Owner)</strong> معتمد ومفعل. هذا الحساب يخضع لإشراف ومراجعة الإدارة البطريركية لضمان جودة وأمان خدمات بيوت الكنيسة القبطية الأرثوذكسية.
              </p>
            </div>

            <div className="pt-2">
              <button
                id="owner-profile-submit-btn"
                type="submit"
                className="w-full bg-[#5A5A40] hover:bg-[#4A4A3A] text-white text-xs font-bold py-3 rounded-xl shadow-md hover:shadow-lg active:scale-[0.99] transition-all text-center cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>💾 حفظ وتعديل بيانات الحساب</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 6. Occupancy Schedule & Block/Unblock Management */}
      {activeTab === 'occupancy' && (
        <div className="bg-white p-6 rounded-3xl border border-[#D6D6C2] text-right space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center gap-3 border-b border-[#EBEBE0] pb-4">
            <div className="p-2.5 rounded-2xl bg-[#EBEBE0]/30 text-[#5A5A40] border border-[#D6D6C2]/60">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-[#4A4A3A]">لوحة التحكم الكاملة في أيام الإشغال والتواريخ المتاحة 🗓️</h3>
              <p className="text-[10px] text-[#8A8A70]">حدد تواريخ أعمال الصيانة، التجهيز، أو الحجوزات اليدوية الداخلية لحظرها أو إتاحتها للجميع.</p>
            </div>
          </div>

          {blockSuccessMsg && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-950 p-4 rounded-2xl flex items-center gap-3 text-xs font-bold">
              <span className="text-lg">✅</span>
              <span>{blockSuccessMsg}</span>
            </div>
          )}

          {ownerHouses.length === 0 ? (
            <div className="text-center py-8 text-xs text-[#8A8A70]">
              لم تقم بتسجيل أي بيت خلوة باسمك حتى الآن. يرجى تسجيل بيت أولاً لتفعيل لوحة الإشغال.
            </div>
          ) : (() => {
            const activeHouse = ownerHouses[0]; // Restricted to 1 house maximum
            const blockedList = activeHouse.blockedDates || [];

            return (
              <div className="space-y-6">
                {/* Info Card */}
                <div className="bg-[#FAF8F5] border border-[#D6D6C2] p-4 rounded-2xl text-xs space-y-2">
                  <span className="font-extrabold text-[#4A4A3A] block">🏨 البيت الخاضع للإدارة والتحكم: "{activeHouse.name}"</span>
                  <p className="text-[10.5px] text-[#5A5A40] leading-relaxed">
                    من خلال هذه اللوحة، يمكنك القيام بحظر أي تاريخ (مثل أعمال صيانة، حجز كنسي خاص بجهتكم دون المرور بالموقع). التواريخ التي يتم حظرها هنا **ستظهر فوراً كغير متاحة للحجز** للخدام ولن يستطيع أحد تقديم طلب حجز فيها.
                  </p>
                </div>

                {/* Form and List Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Action Form */}
                  <form 
                    onSubmit={(e) => handleBlockDateSubmit(e, activeHouse)}
                    className="bg-[#FBFBFA] border border-[#D6D6C2]/70 p-4 rounded-2xl space-y-4"
                  >
                    <span className="text-xs font-black text-[#4A4A3A] block pb-2 border-b border-[#EBEBE0]">🔒 حظر أو إغلاق تاريخ معين:</span>
                    
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-[#8A8A70]">اختر التاريخ المطلوب 📆:</label>
                      <input 
                        id="block-date-picker"
                        type="date"
                        required
                        min="2026-07-01"
                        max="2026-08-31"
                        value={selectedBlockDate}
                        onChange={(e) => setSelectedBlockDate(e.target.value)}
                        className="w-full bg-white border border-[#D6D6C2] text-xs px-3 py-2 rounded-xl text-[#4A4A3A] focus:outline-none focus:border-[#5A5A40] text-left"
                      />
                      <span className="text-[9px] text-[#8A8A70] block">الموسم المالي الحالي يدعم شهر يوليو وأغسطس ٢٠٢٦.</span>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-[#8A8A70]">سبب الحظر أو الإشغال 📝:</label>
                      <input 
                        id="block-date-reason"
                        type="text"
                        required
                        placeholder="مثال: صيانة دورية للغرف / حجز للمطرانية"
                        value={blockReason}
                        onChange={(e) => setBlockReason(e.target.value)}
                        className="w-full bg-white border border-[#D6D6C2] text-xs px-3 py-2 rounded-xl text-[#4A4A3A] focus:outline-none focus:border-[#5A5A40]"
                      />
                    </div>

                    <button
                      id="submit-block-btn"
                      type="submit"
                      className="w-full bg-[#5A5A40] hover:bg-[#4A4A3A] text-white text-xs font-bold py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>🔒 حظر وإغلاق هذا التاريخ الآن</span>
                    </button>
                  </form>

                  {/* Blocked Dates List */}
                  <div className="bg-white border border-[#D6D6C2]/70 p-4 rounded-2xl flex flex-col space-y-3">
                    <span className="text-xs font-black text-[#4A4A3A] block pb-2 border-b border-[#EBEBE0]">🚫 قائمة التواريخ المغلقة والمحجوزة يدوياً ({blockedList.length}):</span>
                    
                    {blockedList.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center py-8 text-center text-[11px] text-[#8A8A70] space-y-1">
                        <span>🌟 لا توجد أي تواريخ محظورة يدوياً.</span>
                        <span>البيت متاح للجميع بالكامل في الأيام غير المحجوزة تلقائياً!</span>
                      </div>
                    ) : (
                      <div className="flex-1 overflow-y-auto max-h-[220px] space-y-2">
                        {blockedList.map((dateStr) => (
                          <div key={dateStr} className="bg-rose-50/50 border border-rose-100 p-2.5 rounded-xl flex items-center justify-between text-xs animate-in fade-in duration-200">
                            <div>
                              <div className="font-extrabold text-[#4A4A3A]">{dateStr}</div>
                              <div className="text-[9px] text-rose-800 font-bold">مغلق للصيانة والخدمة ⚠️</div>
                            </div>
                            <button
                              id={`unblock-btn-${dateStr}`}
                              type="button"
                              onClick={() => handleUnblockDate(dateStr, activeHouse)}
                              className="bg-white hover:bg-emerald-50 border border-rose-200 hover:border-emerald-200 text-rose-700 hover:text-emerald-700 text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all shadow-sm cursor-pointer"
                            >
                              إلغاء الحظر 🔓
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Calendar Preview for July & August 2026 */}
                <div className="space-y-3 pt-4 border-t border-[#EBEBE0]">
                  <span className="text-xs font-black text-[#4A4A3A] block">📅 المعاينة الحية لجدول الإشغال الكلي:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* July 2026 */}
                    <div className="border border-[#D6D6C2] bg-white p-3 rounded-2xl space-y-2">
                      <div className="text-center text-xs font-extrabold text-[#4A4A3A] pb-1.5 border-b border-[#EBEBE0]">يوليو ٢٠٢٦</div>
                      <div className="grid grid-cols-7 gap-1 text-[9px] font-bold text-[#8A8A70] text-center mb-1">
                        <div>ح</div><div>ن</div><div>ث</div><div>ر</div><div>خ</div><div>ج</div><div>س</div>
                      </div>
                      <div className="grid grid-cols-7 gap-1">
                        {/* July starts on Wednesday (3 padding days) */}
                        {Array.from({ length: 3 }).map((_, i) => <div key={`pad-jul-${i}`} />)}
                        {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
                          const dateStr = `2026-07-${day < 10 ? '0' + day : day}`;
                          const isBlocked = blockedList.includes(dateStr);
                          const isBooked = isDateBooked(activeHouse.id, 2026, 7, day);

                          return (
                            <div 
                              key={`jul-day-${day}`}
                              className={`py-1 rounded text-center text-[10px] font-bold relative ${
                                isBlocked 
                                  ? 'bg-rose-600 text-white shadow-sm'
                                  : isBooked
                                  ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                  : 'bg-emerald-50 text-emerald-800 border border-emerald-100'
                              }`}
                              title={isBlocked ? 'مغلق ومحجوز يدوياً' : isBooked ? 'محجوز رسمياً' : 'شاغر ومتاح'}
                            >
                              {day}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* August 2026 */}
                    <div className="border border-[#D6D6C2] bg-white p-3 rounded-2xl space-y-2">
                      <div className="text-center text-xs font-extrabold text-[#4A4A3A] pb-1.5 border-b border-[#EBEBE0]">أغسطس ٢٠٢٦</div>
                      <div className="grid grid-cols-7 gap-1 text-[9px] font-bold text-[#8A8A70] text-center mb-1">
                        <div>ح</div><div>ن</div><div>ث</div><div>ر</div><div>خ</div><div>ج</div><div>س</div>
                      </div>
                      <div className="grid grid-cols-7 gap-1">
                        {/* August starts on Saturday (6 padding days) */}
                        {Array.from({ length: 6 }).map((_, i) => <div key={`pad-aug-${i}`} />)}
                        {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
                          const dateStr = `2026-08-${day < 10 ? '0' + day : day}`;
                          const isBlocked = blockedList.includes(dateStr);
                          const isBooked = isDateBooked(activeHouse.id, 2026, 8, day);

                          return (
                            <div 
                              key={`aug-day-${day}`}
                              className={`py-1 rounded text-center text-[10px] font-bold relative ${
                                isBlocked 
                                  ? 'bg-rose-600 text-white shadow-sm'
                                  : isBooked
                                  ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                  : 'bg-emerald-50 text-emerald-800 border border-emerald-100'
                              }`}
                              title={isBlocked ? 'مغلق ومحجوز يدوياً' : isBooked ? 'محجوز رسمياً' : 'شاغر ومتاح'}
                            >
                              {day}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="flex justify-center gap-4 text-[9.5px] font-bold text-[#8A8A70] pt-1">
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded bg-rose-600 border border-rose-700" />
                      <span>مغلق يدويًا (صيانة / حجز داخلي)</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded bg-amber-100 border border-amber-200" />
                      <span>محجوز رسميًا (بطلب خلوة معتمد)</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded bg-emerald-50 border border-emerald-100" />
                      <span>شاغر ومتاح للجميع</span>
                    </span>
                  </div>
                </div>

              </div>
            );
          })()}
        </div>
      )}

      {/* 7. Reply to Reviews panel */}
      {activeTab === 'reviews' && (
        <div className="bg-white p-6 rounded-3xl border border-[#D6D6C2] text-right space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center gap-3 border-b border-[#EBEBE0] pb-4">
            <div className="p-2.5 rounded-2xl bg-[#EBEBE0]/30 text-[#5A5A40] border border-[#D6D6C2]/60">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-[#4A4A3A]">صلاحية الرد الفوري على تقييمات الخدام باسم البيت 💬</h3>
              <p className="text-[10px] text-[#8A8A70]">اكتب ردوداً ترحيبية رسمية باسم بيت المؤتمرات لبناء جسور الثقة مع الخدام والكهنة الزوار.</p>
            </div>
          </div>

          {reviewsSuccessMsg && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-950 p-4 rounded-2xl flex items-center gap-3 text-xs font-bold animate-pulse">
              <span className="text-lg">✅</span>
              <span>{reviewsSuccessMsg}</span>
            </div>
          )}

          {(() => {
            // Get all reviews for owner's houses
            const houseReviews = reviews.filter((r) => ownerHouseIds.includes(r.houseId));

            if (houseReviews.length === 0) {
              return (
                <div className="text-center py-12 bg-[#FAF8F5] rounded-3xl border border-[#D6D6C2]/50 space-y-2">
                  <p className="text-xs font-bold text-[#4A4A3A]">لا توجد أي تقييمات مكتوبة لبيتكم بعد.</p>
                  <p className="text-[10px] text-[#8A8A70]">التقييمات المكتوبة من الخدام بعد إتمام خلوتهم ستظهر هنا فورا للرد عليها.</p>
                </div>
              );
            }

            return (
              <div className="space-y-4">
                <span className="text-xs font-black text-[#4A4A3A] block px-1">تقييمات بيت المؤتمرات ({houseReviews.length}):</span>
                
                <div className="space-y-4">
                  {houseReviews.map((rev) => (
                    <div key={rev.id} className="bg-[#FAF8F5] border border-[#D6D6C2] rounded-3xl p-4 space-y-3 animate-in fade-in duration-200">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-extrabold text-[#4A4A3A]">{rev.userName}</span>
                            <span className="text-[8.5px] bg-[#EBEBE0]/80 border border-[#D6D6C2]/50 text-[#5A5A40] px-1.5 py-0.5 rounded font-bold">
                              {rev.userRole === 'owner' ? 'إدارة' : rev.userRole === 'admin' ? 'منسق بطريركي' : 'خادم كنسي'}
                            </span>
                          </div>
                          <span className="text-[9.5px] text-[#8A8A70] font-medium block mt-0.5">{rev.houseName}</span>
                        </div>

                        {/* Stars */}
                        <div className="bg-amber-50 border border-amber-200 text-amber-900 px-2 py-0.5 rounded-lg text-[10px] font-mono font-black">
                          {rev.rating} / 5 ★
                        </div>
                      </div>

                      {/* Criteria ratings */}
                      <div className="flex flex-wrap gap-1.5 text-[9px] font-bold text-[#4A4A3A]">
                        {rev.food_rating && <span className="bg-white border border-[#D6D6C2]/50 px-2 py-0.5 rounded-lg">🍗 طعام: {rev.food_rating}</span>}
                        {rev.service_rating && <span className="bg-white border border-[#D6D6C2]/50 px-2 py-0.5 rounded-lg">🤵 خدمة: {rev.service_rating}</span>}
                        {rev.cleanliness_rating && <span className="bg-white border border-[#D6D6C2]/50 px-2 py-0.5 rounded-lg">🧼 نظافة: {rev.cleanliness_rating}</span>}
                        {rev.organization_rating && <span className="bg-white border border-[#D6D6C2]/50 px-2 py-0.5 rounded-lg">📋 تنظيم: {rev.organization_rating}</span>}
                        {rev.value_rating && <span className="bg-white border border-[#D6D6C2]/50 px-2 py-0.5 rounded-lg">💰 قيمة: {rev.value_rating}</span>}
                      </div>

                      {/* Comment text */}
                      <p className="text-[11px] text-[#4A4A3A] leading-relaxed font-medium bg-white p-3 rounded-2xl border border-[#D6D6C2]/50">
                        "{rev.comment}"
                      </p>

                      {/* Review reply block */}
                      {rev.ownerReply ? (
                        <div className="bg-[#5A5A40]/5 border-r-2 border-[#5A5A40] p-3 rounded-l-2xl space-y-2">
                          <div className="flex items-center justify-between text-[10px] font-extrabold text-[#5A5A40]">
                            <span>رد الإدارة الحالي 🏨:</span>
                            {rev.ownerReplyCreatedAt && (
                              <span className="text-[8px] text-[#8A8A70] font-mono">{new Date(rev.ownerReplyCreatedAt).toLocaleDateString('ar-EG')}</span>
                            )}
                          </div>
                          <p className="text-[10.5px] text-[#4A4A3A] leading-relaxed">
                            {rev.ownerReply}
                          </p>
                          <div className="flex gap-2 justify-end pt-1">
                            <button
                              id={`edit-reply-${rev.id}`}
                              type="button"
                              onClick={() => {
                                setReplyingToReviewId(rev.id);
                                setReviewReplyText(rev.ownerReply || '');
                              }}
                              className="text-[9.5px] font-bold text-[#5A5A40] hover:underline"
                            >
                              تعديل الرد ✏️
                            </button>
                            <button
                              id={`delete-reply-${rev.id}`}
                              type="button"
                              onClick={() => handleDeleteReply(rev.id)}
                              className="text-[9.5px] font-bold text-red-600 hover:underline"
                            >
                              حذف الرد ✕
                            </button>
                          </div>
                        </div>
                      ) : replyingToReviewId === rev.id ? (
                        <form 
                          onSubmit={(e) => handleAddReplySubmit(e, rev.id)}
                          className="space-y-2 pt-2 animate-in slide-in-from-top-1 duration-150"
                        >
                          <label className="block text-[10px] font-bold text-[#8A8A70]">اكتب ردك الرسمي باسم البيت:</label>
                          <textarea
                            id={`reply-textarea-${rev.id}`}
                            required
                            placeholder="نشكركم يا أحباء على تقييمكم الرائع وملاحظاتكم الثمينة، ونسعد دائما بخدمتكم في المسيح..."
                            value={reviewReplyText}
                            onChange={(e) => setReviewReplyText(e.target.value)}
                            className="w-full bg-white border border-[#D6D6C2] rounded-xl p-2.5 text-[10.5px] text-[#4A4A3A] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
                            rows={3}
                          />
                          <div className="flex gap-2">
                            <button
                              id={`submit-reply-${rev.id}`}
                              type="submit"
                              className="bg-[#5A5A40] hover:bg-[#4A4A3A] text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                            >
                              إرسال الرد الرسمي
                            </button>
                            <button
                              id={`cancel-reply-${rev.id}`}
                              type="button"
                              onClick={() => {
                                setReplyingToReviewId(null);
                                setReviewReplyText('');
                              }}
                              className="bg-[#EBEBE0] text-[#4A4A3A] text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                            >
                              إلغاء
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="flex justify-end">
                          <button
                            id={`start-reply-btn-${rev.id}`}
                            type="button"
                            onClick={() => {
                              setReplyingToReviewId(rev.id);
                              setReviewReplyText('');
                            }}
                            className="bg-[#5A5A40]/10 hover:bg-[#5A5A40]/20 text-[#5A5A40] text-[10.5px] font-extrabold px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1"
                          >
                            <span>💬 كتابة رد رسمي باسم المكان</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Owner Announcements */}
      {activeTab === 'announcements' && (
        <div className="space-y-3">
          {ownerHouses.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#D6D6C2] p-6 text-center text-xs text-[#8A8A70]">
              أضف بيتك أولاً قبل نشر التنبيهات.
            </div>
          ) : (
            <>
              <div className="bg-white rounded-2xl border border-[#D6D6C2] p-4 space-y-3">
                <div className="text-xs font-bold text-[#4A4A3A] flex items-center gap-1.5">
                  <Megaphone className="w-4 h-4 text-[#5A5A40]" />
                  رسالة تظهر للعملاء على صفحة البيت
                </div>
                <p className="text-[9.5px] text-[#8A8A70]">مثال: "يوجد خصم هذا الأسبوع" أو "المسبح مغلق للصيانة". إضافة رسالة جديدة تُلغي الرسالة السابقة تلقائياً.</p>
                <textarea
                  id="announcement-input"
                  rows={2}
                  placeholder="اكتب رسالتك هنا..."
                  value={announcementMessage}
                  onChange={(e) => setAnnouncementMessage(e.target.value)}
                  className="w-full bg-white border border-[#D6D6C2] text-[11px] px-3 py-2 rounded-xl focus:outline-none"
                />
                <button
                  id="announcement-submit-btn"
                  type="button"
                  onClick={() => {
                    if (!announcementMessage.trim()) { alert('يرجى كتابة نص التنبيه.'); return; }
                    if (onAddAnnouncement) {
                      onAddAnnouncement({
                        id: `ann_${Date.now()}`,
                        houseId: ownerHouses[0].id,
                        message: announcementMessage.trim(),
                        isActive: true,
                        createdAt: new Date().toISOString(),
                      });
                    }
                    setAnnouncementMessage('');
                  }}
                  className="bg-[#5A5A40] hover:bg-[#4A4A3A] text-white text-[10px] font-bold px-4 py-2 rounded-xl cursor-pointer"
                >
                  نشر التنبيه
                </button>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-bold text-[#8A8A70] px-1">سجل التنبيهات ({ownerAnnouncements.length}):</div>
                {ownerAnnouncements.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-[#D6D6C2] p-4 text-center text-[10px] text-[#8A8A70]">
                    لا توجد تنبيهات منشورة بعد.
                  </div>
                ) : (
                  ownerAnnouncements.map((a) => (
                    <div key={a.id} className="bg-white rounded-2xl border border-[#D6D6C2] p-3 flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className={`text-[11px] font-bold ${a.isActive ? 'text-[#4A4A3A]' : 'text-[#BCBC9D] line-through'}`}>{a.message}</p>
                        <span className="text-[8.5px] text-[#8A8A70]">{new Date(a.createdAt).toLocaleDateString('ar-EG')}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onToggleAnnouncement && onToggleAnnouncement(a.id, !a.isActive)}
                        className={`text-[9.5px] font-bold px-2.5 py-1 rounded-lg shrink-0 cursor-pointer ${
                          a.isActive ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-[#EBEBE0] text-[#8A8A70]'
                        }`}
                      >
                        {a.isActive ? 'نشطة — إخفاء' : 'إظهار'}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Waitlist */}
      {activeTab === 'waitlist' && (
        <div className="space-y-2">
          <div className="text-xs font-bold text-[#8A8A70] px-1">
            العملاء المنتظرون لتوفر مكان ({ownerWaitlist.length}):
          </div>
          {ownerWaitlist.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#D6D6C2] p-6 text-center text-[10px] text-[#8A8A70]">
              لا يوجد عملاء في قائمة الانتظار حالياً.
            </div>
          ) : (
            ownerWaitlist
              .slice()
              .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
              .map((w) => (
                <div key={w.id} className="bg-white rounded-2xl border border-[#D6D6C2] p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#4A4A3A]">{w.userName}</span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                      w.status === 'waiting' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                      w.status === 'notified' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
                      'bg-[#EBEBE0] text-[#8A8A70]'
                    }`}>
                      {w.status === 'waiting' ? 'بانتظار مكان' : w.status === 'notified' ? 'تم الإشعار' : w.status === 'expired' ? 'منتهية' : 'ملغاة'}
                    </span>
                  </div>
                  <div className="text-[10px] text-[#8A8A70]">
                    {w.checkIn} → {w.checkOut} · {w.guestsCount} فرد · {w.userPhone}
                  </div>
                </div>
              ))
          )}
        </div>
      )}

      {/* Smart Room Allocation Modal */}
      {activeAllocationBooking && (() => {
        const house = houses.find(h => h.id === activeAllocationBooking.houseId);
        if (!house) return null;
        return (
          <RoomDistribution
            booking={activeAllocationBooking}
            house={house}
            currentUser={owner}
            onClose={() => setActiveAllocationBooking(null)}
            globalAttendees={attendees}
            globalAllocations={allocations}
            onUpdateAttendees={onUpdateAttendees}
            onUpdateAllocations={onUpdateAllocations}
          />
        );
      })()}

    </div>
  );
}
