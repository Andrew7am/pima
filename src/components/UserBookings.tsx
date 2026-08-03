import React, { useState, useEffect, useRef } from 'react';
import { Booking, User, RetreatHouse, Attendee, RoomAllocation, Room, Payment, Review, PlatformSettings, DEFAULT_PLATFORM_SETTINGS } from '../types';
import { 
  Calendar, Users, DollarSign, Clock, CheckCircle2, XCircle, FileText, 
  Printer, Building, AlertTriangle, Bell, Smartphone, CreditCard, 
  Coins, Upload, ShieldCheck, Image, Check, Sparkles, ListTodo, Plus, Trash2, BookOpen,
  FileDown, MessageCircle, MapPin, CalendarCheck, Wallet, ChevronLeft, CalendarPlus, Star, X, UserPlus,
  Search, ArrowDownWideNarrow, Copy
} from 'lucide-react';
import RoomDistribution from './RoomDistribution';
import BookingJourney from './BookingJourney';
import BookingChatPanel from './BookingChatPanel';
import ReviewWizard from './ReviewWizard';
import { refundAmountFor } from '../lib/cancellationPolicy';
import { getBookingStage } from '../lib/bookingStage';
import DepositPayment from './booking/DepositPayment';
import { downloadBookingIcs } from '../lib/ics';
import { setAttendeeSharePaid } from '../lib/db';
import { arabicPlural, arabicDate, arabicDateRange } from '../lib/arabic';
import { bookingTypeLabel } from '../lib/bookingGroups';

interface UserBookingsProps {
  bookings: Booking[];
  houses: RetreatHouse[];
  currentUser: User;
  onCancelBooking?: (bookingId: string) => void;
  attendees: Attendee[];
  allocations: RoomAllocation[];
  rooms?: Room[];
  onUpdateAttendees: (bookingId: string, attendees: Attendee[]) => void;
  onUpdateAllocations: (bookingId: string, allocations: RoomAllocation[]) => void;
  onOpenRoomDistribution?: (bookingId: string) => void;
  onNotifyOwnerDistribution?: (bookingId: string) => Promise<boolean>;
  payments: Payment[];
  onSubmitPayment: (payment: Payment) => void;
  settings?: PlatformSettings;
  reviews?: Review[];
  onSubmitReview?: (review: Review) => void;
  // Set right after a booking request is placed so the guest lands straight on
  // the transfer card instead of having to hunt for it.
  autoPayBookingId?: string | null;
  onAutoPayConsumed?: () => void;
}

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  instapay: 'إنستاباي',
  vodafone_cash: 'فودافون كاش',
  etisalat_cash: 'اتصالات كاش',
  orange_cash: 'أورنج كاش',
  we_cash: 'وي كاش',
  bank_transfer: 'تحويل بنكي',
};

const DEFAULT_CHECKLIST_ITEMS = [
  { id: '1', text: 'أدوات القداس الإلهي (لوح مقدس، أواني، بخور، قربان، كؤوس، أغطية، كتب الصلوات الأرثوذكسية) ⛪', checked: false, category: 'group' as const },
  { id: '2', text: 'أجهزة الصوتيات والساوند سيستم ومايكات لاسلكية وسماعات خارجية مع التوصيلات 🎤', checked: false, category: 'group' as const },
  { id: '3', text: 'بروجيكتور (داتا شو) وشاشة العرض ووصلات HDMI ولابتوب الخادم المسؤول 📹', checked: false, category: 'group' as const },
  { id: '4', text: 'شنطة إسعافات أولية متكاملة (مسكنات، مطهرات، قطن، شاش، بلاستر للجروح) 💊', checked: false, category: 'group' as const },
  { id: '5', text: 'هدايا الرحلة الختامية وبركة الآباء وجوائز الأنشطة الترفيهية ومسابقات الكرنفال 🎁', checked: false, category: 'group' as const },
  { id: '6', text: 'كشوف الحضور والغياب، بطاقات التعريف (Name Tags)، وتوزيع التسكين المطبوع 📝', checked: false, category: 'group' as const },
  { id: '7', text: 'أدوات الكرنفال والألعاب الجماعية (كرات، حبال، بالونات، ألوان مائية) 🎈', checked: false, category: 'group' as const },
  
  { id: '10', text: 'الكتاب المقدس والأجبية (كتاب صلوات الساعات السبع المكتوبة) 📖', checked: false, category: 'personal' as const },
  { id: '11', text: 'الشواحن الكهربائية الخاصة بهاتفك، والباوربانك لضمان البقاء متصلاً 🔌', checked: false, category: 'personal' as const },
  { id: '12', text: 'أدوات النظافة الشخصية وفوطة ووسادة مريحة (اختياري حسب طبيعة السكن) 🧼', checked: false, category: 'personal' as const },
  { id: '13', text: 'ملابس ثقيلة إضافية لبرودة الجو ليلاً بالبيوت الصحراوية أو الساحلية 🧥', checked: false, category: 'personal' as const },
  { id: '14', text: 'أدوية شخصية هامة معتاد عليها لحالات المرض والوقاية اليومية 🧪', checked: false, category: 'personal' as const },
  { id: '15', text: 'نوتة كنسية صغيرة وقلم لتسجيل الفوائد الروحية وتأملات الخلوة الشخصية ✏️', checked: false, category: 'personal' as const }
];

const getThemeActivities = (theme: 'growth' | 'fellowship' | 'saints'): { id: string; day: number; time: string; activity: string }[] => {
  const activities = theme === 'growth' ? [
    { day: 1, time: '09:00 ص', activity: 'التجمع والتحرك من أمام الكنيسة بالأوتوبيسات 🚌' },
    { day: 1, time: '11:30 ص', activity: 'الوصول لبيت المؤتمرات وتسكين الغرف وتوزيع المفاتيح 🔑' },
    { day: 1, time: '01:00 م', activity: 'صلاة الغروب وتناول وجبة الغداء الساخنة الجماعية 🍲' },
    { day: 1, time: '04:00 م', activity: 'المحاضرة الأولى: "أساسيات الإيمان الأرثوذكسي والبناء الروحي" 📖' },
    { day: 1, time: '06:30 م', activity: 'صلاة النوم ووقت هدوء وتأمل شخصي في فناء البيت الهادئ 🌅' },
    { day: 1, time: '08:30 م', activity: 'العشاء وجلسة سمر روحية دافئة حول المسامرة والنار 🏕️' },
    
    { day: 2, time: '07:30 ص', activity: 'صلاة باكر وتأمل صباحي مبهج في آية اليوم ☀️' },
    { day: 2, time: '08:30 ص', activity: 'تناول وجبة الإفطار الصباحي بالبيت 🍳' },
    { day: 2, time: '10:00 ص', activity: 'المحاضرة الثانية: "البناء النفسي للخادم الناجح والخدمة المؤثرة" 🧠' },
    { day: 2, time: '01:000 م', activity: 'وجبة الغداء ومسابقات ترفيهية ورياضية بالحديقة 🏆' },
    { day: 2, time: '04:30 م', activity: 'ورش عمل كنسية تفاعلية ودراسة كتاب مقدسة جماعية 🛠️' },
    { day: 2, time: '07:00 م', activity: 'صلاة عشية والتحضير الروحي والاعترافات للقداس الإلهي 🕯️' },
    { day: 2, time: '08:30 م', activity: 'العشاء وجلسة تسبحة وألحان وتسابيح كنسية مباركة 🎼' },
    
    { day: 3, time: '06:00 ص', activity: 'صلاة القداس الإلهي ببيت المؤتمرات وتناول الأسرار المقدسة ⛪' },
    { day: 3, time: '09:00 ص', activity: 'تناول وجبة الإفطار وصور تذكارية جماعية لكافة المشاركين 📸' },
    { day: 3, time: '11:00 ص', activity: 'الجلسة الختامية وتوزيع هدايا بركة الرحلة للجميع 🎁' },
    { day: 3, time: '01:00 م', activity: 'تسليم الغرف ومغادرة البيت والعودة بسلامة الله 🚌' }
  ] : theme === 'fellowship' ? [
    { day: 1, time: '09:00 ص', activity: 'التجمع والانطلاق بالأوتوبيسات السياحية المجهزة 🚌' },
    { day: 1, time: '11:30 ص', activity: 'الوصول وتسكين الغرف واستلام المفاتيح والاسترخاء 🔑' },
    { day: 1, time: '01:00 م', activity: 'وجبة غداء المحبة وتوضيح كشوف المجموعات وقوانين الكامب 🍲' },
    { day: 1, time: '04:00 م', activity: 'ألعاب تعارف كنسية جماعية وكسر الجليد (Ice Breakers) 🎯' },
    { day: 1, time: '06:30 م', activity: 'صلاة الغروب ووقت ترفيهي حر بالحمامات أو الملاعب 🏊‍♂️' },
    { day: 1, time: '08:30 م', activity: 'العشاء وجلسة سمر كوميدية وسهرة حول نار المعسكر الرائعة 🔥' },
    
    { day: 2, time: '08:00 ص', activity: 'صلاة باكر وتأمل روحي خفيف لتجديد النشاط ☀️' },
    { day: 2, time: '09:00 ص', activity: 'الإفطار الصباحي اللذيذ 🍳' },
    { day: 2, time: '10:00 ص', activity: 'بدء الكرنفال الرياضي، الألعاب المائية، والتحديات الجماعية 🌊' },
    { day: 2, time: '01:30 م', activity: 'الغداء وفترة راحة واسترخاء قصيرة بالبيوت 😴' },
    { day: 2, time: '04:00 م', activity: 'مسابقة البحث عن الكنز والأنشطة الذهنية وحل الألغاز 🧭' },
    { day: 2, time: '07:00 م', activity: 'صلاة عشية وسهرة تسابيح ممتعة ومرنمة 🎤' },
    { day: 2, time: '08:30 م', activity: 'العشاء وبطولات في تنس الطاولة، بلايستيشن، والبيبي فوت 🏓' },
    
    { day: 3, time: '07:00 ص', activity: 'القداس الإلهي الروحي بصلوات الخدام الأحباء ⛪' },
    { day: 3, time: '10:00 ص', activity: 'الإفطار الصباحي ولقاء تقييم لفعاليات الكامب بالكامل 📝' },
    { day: 3, time: '12:00 م', activity: 'التقاط الصور الجماعية وكتابة أجمل الذكريات في كتاب الذكرى 📸' },
    { day: 3, time: '02:00 م', activity: 'تسليم المفاتيح والعودة للكنيسة سالمين غانمين 🚌' }
  ] : [
    { day: 1, time: '08:30 ص', activity: 'التجمع والتحرك لقضاء رحلة روحية ممتعة 🚌' },
    { day: 1, time: '11:00 ص', activity: 'الوصول واستقبال الإخوة بالبيت وتوزيع الغرف بالتسكين 🔑' },
    { day: 1, time: '12:30 م', activity: 'وجبة غداء وتأمل في آية اليوم الروحية وشرح فلسفة الرحلة 📖' },
    { day: 1, time: '03:30 م', activity: 'لقاء مع سير وتاريخ الكنيسة: "حياة الآباء القديسين والقدوة المعاصرة" ✨' },
    { day: 1, time: '06:00 م', activity: 'صلاة عشية وتأمل هادئ ومريح في فناء الكامب الخلاب 🌿' },
    { day: 1, time: '08:00 م', activity: 'عشاء دافئ تليها ندوة مفتوحة حول تطبيق فضائل القديسين في حياتنا 🕯️' },
    
    { day: 2, time: '07:30 ص', activity: 'صلاة باكر والتحرك لزيارة دير أثري مجاور للبيت ⛪' },
    { day: 2, time: '09:00 ص', activity: 'الإفطار الصباحي المبارك في الضيافة الكنسية 🍳' },
    { day: 2, time: '11:00 ص', activity: 'جولة روحية وتاريخية مع آباء الدير والتعرف على معالم الدير الأثرية ⛪' },
    { day: 2, time: '02:00 م', activity: 'العودة للبيت وتناول وجبة الغداء الساخنة المجهزة 🍲' },
    { day: 2, time: '05:00 م', activity: 'مسابقة ثقافية دينية ومسابقة في تاريخ الكنيسة وآباء الإسكندرية 🏆' },
    { day: 2, time: '08:000 م', activity: 'العشاء وبدء صلوات التسبحة الكيهكية / الألحان الكنسية الجميلة 🕯️' },
    
    { day: 3, time: '06:00 ص', activity: 'صلاة القداس الإلهي المبارك ببركات الآباء القديسين ⛪' },
    { day: 3, time: '09:00 ص', activity: 'وجبة الإفطار الجماعية الختامية وتوثيق اللحظات بالصور 📸' },
    { day: 3, time: '11:30 ص', activity: 'كلمة منفعة روحية سريعة وخاتمة وتوزيع البركة 🎁' },
    { day: 3, time: '01:30 م', activity: 'حزم الحقائب ومغادرة الكامب والبيت بسلامة الرب 🚌' }
  ];

  return activities.map((act, index) => ({
    id: `${theme}-${act.day}-${index}`,
    ...act
  }));
};

// Whole days from today until an ISO date (negative if already past).
function daysUntil(iso: string): number {
  const target = new Date(iso + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
}

// One key/value fact with a soft icon chip — the building block of the tidy
// facts grid that replaced the old flat detail band.
function Fact({ icon: Icon, label, value, accent }: { icon: React.ElementType; label: string; value: string; accent?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-8 h-8 rounded-xl bg-[#0A2342]/5 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-[#5A5A40]" />
      </span>
      <div className="min-w-0">
        <div className="text-[9px] text-[#8A8A70] font-bold">{label}</div>
        <div className={`text-[12px] font-black truncate ${accent ?? 'text-[#4A4A3A]'}`}>{value}</div>
      </div>
    </div>
  );
}

// The four-step stepper that used to live here was replaced by BookingJourney,
// which shows the same lifecycle as the five named stages the guest recognises
// and dates each one from a real column.

export default function UserBookings({
  bookings,
  houses,
  currentUser,
  onCancelBooking,
  attendees,
  allocations,
  rooms = [],
  onUpdateAttendees,
  onUpdateAllocations,
  onOpenRoomDistribution,
  onNotifyOwnerDistribution,
  payments,
  onSubmitPayment,
  settings = DEFAULT_PLATFORM_SETTINGS,
  reviews = [],
  onSubmitReview,
  autoPayBookingId = null,
  onAutoPayConsumed,
}: UserBookingsProps) {
  // What the guest actually owes. The server normalises this on every write
  // (validate_booking_price: deposit_amount := ROUND(total_price * rate)) and
  // it is the figure every owner and admin finance screen sums — so the guest
  // must be quoted THAT number, not one recomputed here. Recomputing meant a
  // guest was quoted the new rate whenever an admin changed deposit_rate,
  // while the booking still carried the old one. The multiply is kept only as
  // a fallback for a row that somehow has no deposit_amount at all.
  const depositDueFor = (b: Booking) =>
    b.depositAmount || Math.round(b.totalPrice * settings.depositRate);

  const [activeReceipt, setActiveReceipt] = useState<Booking | null>(null);
  // Which booking's detail sheet is open. Stored as an id (not the object) so
  // the sheet always renders the freshest booking data from props.
  const [detailBookingId, setDetailBookingId] = useState<string | null>(null);
  const [copiedBookingId, setCopiedBookingId] = useState<string | null>(null);
  // The payment bar grows from zero once the sheet is up, so it reads as
  // filling rather than as a static state. Fail-visible: if the frame never
  // arrives the bar simply shows its real width from the start.
  const [barGrown, setBarGrown] = useState(false);
  useEffect(() => {
    if (!detailBookingId) { setBarGrown(false); return; }
    const t = setTimeout(() => setBarGrown(true), 60);
    const guard = setTimeout(() => setBarGrown(true), 900);
    return () => { clearTimeout(t); clearTimeout(guard); };
  }, [detailBookingId]);
  const paymentBarPct = (pct: number) => (barGrown ? pct : 0);
  // Freeze the list behind the sheet so only the sheet scrolls.
  useEffect(() => {
    if (!detailBookingId) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [detailBookingId]);

  // Collection tracker: flip one member's "paid their share" flag. The flag is
  // persisted with its own targeted update, then mirrored into App state via
  // the normal roster channel (whose upsert doesn't carry the flag column).
  const [togglingShareId, setTogglingShareId] = useState<string | null>(null);
  const toggleSharePaid = async (booking: Booking, attendee: Attendee) => {
    if (togglingShareId) return;
    const next = !attendee.sharePaid;
    setTogglingShareId(attendee.id);
    const ok = await setAttendeeSharePaid(attendee.id, next);
    setTogglingShareId(null);
    if (!ok) { alert('تعذّر حفظ حالة التحصيل. تأكد من اتصالك ثم حاول مرة أخرى.'); return; }
    const list = attendees
      .filter((a) => a.bookingId === booking.id)
      .map((a) => (a.id === attendee.id ? { ...a, sharePaid: next } : a));
    onUpdateAttendees(booking.id, list);
  };
  const [reviewingBooking, setReviewingBooking] = useState<Booking | null>(null);
  const [tab, setTab] = useState<'all' | 'action' | 'confirmed' | 'completed' | 'archived'>('all');
  const [activeAllocationBooking, setActiveAllocationBooking] = useState<Booking | null>(null);
  const [notifiedOwner, setNotifiedOwner] = useState<Set<string>>(new Set());
  const [isPaying, setIsPaying] = useState<string | null>(null);
  const [chatOpenBookingId, setChatOpenBookingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  // 'smart' keeps the existing behaviour — whatever needs the guest's attention
  // floats up. The other two are plain date order, for when they are hunting.
  const [sortBy, setSortBy] = useState<'smart' | 'newest' | 'oldest'>('smart');
  const chatRef = useRef<HTMLDivElement>(null);

  // The chat panel is appended at the end of the detail sheet's scrollable
  // content — well past the fold. Opening it therefore changed nothing the
  // guest could see, so "راسل صاحب البيت" read as a dead button and the app
  // looked frozen.
  //
  // scrollIntoView does NOT work here: the sheet sits inside a `fixed inset-0`
  // overlay, and the browser leaves the container's scrollTop at 0. Scrolling
  // the container by the measured delta does work, so do that instead.
  useEffect(() => {
    if (!chatOpenBookingId) return;
    const id = window.setTimeout(() => {
      const panel = chatRef.current;
      if (!panel) return;
      let sheet: HTMLElement | null = panel.parentElement;
      while (sheet && !(sheet.scrollHeight > sheet.clientHeight
        && /auto|scroll/.test(getComputedStyle(sheet).overflowY))) {
        sheet = sheet.parentElement;
      }
      if (!sheet) return;
      // Instant, not smooth: a smooth scroll is silently dropped wherever the
      // browser is not animating (reduced-motion, background tabs, embedded
      // webviews), and this scroll is the entire feedback for the tap. A jump
      // that always happens beats a glide that sometimes does not.
      const delta = panel.getBoundingClientRect().top - sheet.getBoundingClientRect().top;
      sheet.scrollTo({ top: sheet.scrollTop + delta - 8 });
    }, 60);
    return () => window.clearTimeout(id);
  }, [chatOpenBookingId]);

  // A request was just placed: open its transfer card immediately, prefilled
  // with the deposit, and clear the handoff so a later re-render doesn't
  // reopen it after the guest closed it.
  useEffect(() => {
    if (!autoPayBookingId) return;
    const fresh = bookings.find((b) => b.id === autoPayBookingId);
    if (!fresh) return;
    if (!fresh.depositPaid) {
      // The transfer form lives inside the booking's detail sheet, so the sheet
      // has to be opened too — setting isPaying alone leaves the list showing a
      // collapsed card and nothing else.
      setDetailBookingId(fresh.id);
      setIsPaying(fresh.id);
      setPaymentAmount(Math.round(fresh.totalPrice * settings.depositRate).toString());
    }
    onAutoPayConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPayBookingId, bookings.length]);
  
  // Egyptian Payment System Form States
  const [selectedMethod, setSelectedMethod] = useState<'bank' | 'instapay' | 'vodafone' | 'cash' | 'online'>('instapay');
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [bankName, setBankName] = useState('البنك الأهلي المصري (NBE)');
  const [bankRef, setBankRef] = useState('');
  const [instaAddress, setInstaAddress] = useState('');
  const [instaRef, setInstaRef] = useState('');
  const [vodafoneNumber, setVodafoneNumber] = useState('');
  const [vodafoneTxId, setVodafoneTxId] = useState('');
  const [cashReceiver, setCashReceiver] = useState('');
  const [cashReceiptNo, setCashReceiptNo] = useState('');
  const [proofImage, setProofImage] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  // Online Card states
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');

  // Spiritual & Activity Retreat Planner states
  const [activePlannerBooking, setActivePlannerBooking] = useState<Booking | null>(null);
  const [plannerTheme, setPlannerTheme] = useState<'growth' | 'fellowship' | 'saints'>('growth');
  const [plannerTab, setPlannerTab] = useState<'schedule' | 'packing'>('schedule');
  const [plannerChecklist, setPlannerChecklist] = useState<Record<string, { id: string; text: string; checked: boolean; category: 'group' | 'personal' }[]>>({});
  const [customActivities, setCustomActivities] = useState<Record<string, { id: string; day: number; time: string; activity: string }[]>>({});
  const [newGroupText, setNewGroupText] = useState('');
  const [newPersonalText, setNewPersonalText] = useState('');

  // Helper functions for Spiritual & Activity Retreat Planner
  const toggleChecklistItem = (bookingId: string, itemId: string) => {
    setPlannerChecklist(prev => {
      const items = prev[bookingId] || [];
      return {
        ...prev,
        [bookingId]: items.map(item => item.id === itemId ? { ...item, checked: !item.checked } : item)
      };
    });
  };

  const addChecklistItem = (bookingId: string, text: string, category: 'group' | 'personal') => {
    if (!text.trim()) return;
    setPlannerChecklist(prev => {
      const items = prev[bookingId] || [];
      const newItem = {
        id: `custom-check-${Date.now()}`,
        text,
        checked: false,
        category
      };
      return {
        ...prev,
        [bookingId]: [...items, newItem]
      };
    });
  };

  const deleteChecklistItem = (bookingId: string, itemId: string) => {
    setPlannerChecklist(prev => {
      const items = prev[bookingId] || [];
      return {
        ...prev,
        [bookingId]: items.filter(item => item.id !== itemId)
      };
    });
  };

  const updateActivity = (bookingId: string, activityId: string, field: 'time' | 'activity', value: string) => {
    setCustomActivities(prev => {
      const acts = prev[bookingId] || [];
      return {
        ...prev,
        [bookingId]: acts.map(act => act.id === activityId ? { ...act, [field]: value } : act)
      };
    });
  };

  const deleteActivity = (bookingId: string, activityId: string) => {
    setCustomActivities(prev => {
      const acts = prev[bookingId] || [];
      return {
        ...prev,
        [bookingId]: acts.filter(act => act.id !== activityId)
      };
    });
  };

  const addActivity = (bookingId: string, dayNum: number) => {
    setCustomActivities(prev => {
      const acts = prev[bookingId] || [];
      const newAct = {
        id: `custom-act-${Date.now()}`,
        day: dayNum,
        time: '12:00 م',
        activity: 'نشاط روحي أو فقرة جديدة 🌟'
      };
      return {
        ...prev,
        [bookingId]: [...acts, newAct]
      };
    });
  };

  const changeThemeTemplate = (bookingId: string, newTheme: 'growth' | 'fellowship' | 'saints') => {
    if (confirm('هل أنت متأكد من تغيير نمط البرنامج؟ سيؤدي هذا لإعادة تعيين الفقرات المكتوبة حالياً إلى القالب الافتراضي للمجموعة.')) {
      setPlannerTheme(newTheme);
      setCustomActivities(prev => ({
        ...prev,
        [bookingId]: getThemeActivities(newTheme)
      }));
    }
  };

  const exportReceiptAsPDF = async (booking: Booking) => {
    const element = document.getElementById('receipt-pdf-container');
    if (!element) return;

    setIsExportingPDF(true);

    const loadHtml2pdf = (): Promise<any> => {
      return new Promise((resolve, reject) => {
        if ((window as any).html2pdf) {
          resolve((window as any).html2pdf);
          return;
        }
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
        script.integrity = 'sha512-GsLlZN/3F2ErC5xIQmLe1LuppgUx5FSEDrEBgGH5VJub8NKTyT9fCNhG9XDG/yFQ9U0c8FF58GzpWEvy9Ji3oA==';
        script.crossOrigin = 'anonymous';
        script.onload = () => resolve((window as any).html2pdf);
        script.onerror = (err) => reject(err);
        document.body.appendChild(script);
      });
    };

    try {
      const html2pdf = await loadHtml2pdf();
      
      const opt = {
        margin:       [0.4, 0.4, 0.4, 0.4],
        filename:     `سند_حجز_${booking.houseName.replace(/\s+/g, '_')}_${booking.id}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { 
          scale: 2, 
          useCORS: true, 
          letterRendering: true,
          scrollY: 0,
          scrollX: 0
        },
        jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
      };
      
      await html2pdf().set(opt).from(element).save();
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('حدث خطأ أثناء تصدير ملف الـ PDF. يرجى المحاولة مرة أخرى أو استخدام ميزة طباعة السند.');
    } finally {
      setIsExportingPDF(false);
    }
  };

  // Filter bookings belonging to the current user
  const userBookings = bookings.filter((b) => b.userId === currentUser.id);

  // Count approved and unpaid bookings for alerts
  const unpaidApprovedCount = userBookings.filter(b => b.status === 'approved' && !b.depositPaid).length;

  // ── Booking triage: which pile a booking belongs to, so the header tabs can
  // filter the list instead of dumping every status into one long scroll. ──
  const todayISO = new Date().toISOString().split('T')[0];
  const categoryOf = (b: Booking): 'action' | 'confirmed' | 'completed' | 'archived' => {
    if (b.status === 'cancelled' || b.status === 'rejected') return 'archived';
    if (b.status === 'completed') return 'completed';
    if (b.status === 'pending' || (b.status === 'approved' && !b.depositPaid)) return 'action';
    return 'confirmed'; // approved + deposit paid
  };
  const counts = {
    all: userBookings.length,
    action: userBookings.filter((b) => categoryOf(b) === 'action').length,
    confirmed: userBookings.filter((b) => categoryOf(b) === 'confirmed').length,
    completed: userBookings.filter((b) => categoryOf(b) === 'completed').length,
    archived: userBookings.filter((b) => categoryOf(b) === 'archived').length,
  };
  // Header stat pills — the three numbers a guest actually cares about.
  const upcomingCount = userBookings.filter((b) => b.status === 'approved' && b.checkIn >= todayISO).length;
  // The trip the guest is actually waiting on — soonest arrival still ahead.
  const nextBooking = userBookings
    .filter((b) => b.checkIn >= todayISO && b.status !== 'cancelled' && b.status !== 'rejected')
    .sort((a, bk) => a.checkIn.localeCompare(bk.checkIn))[0];
  // Rank so the most time-sensitive cards float to the top of whatever tab is open.
  const rankOf = (b: Booking): number => {
    const c = categoryOf(b);
    return c === 'action' ? 0 : c === 'confirmed' ? 1 : c === 'completed' ? 2 : 3;
  };
  // Search matches the place or the reference, which are the only two things a
  // guest has to hand when hunting for one booking among many.
  const q = search.trim().toLowerCase();
  const visibleBookings = userBookings
    .filter((b) => tab === 'all' || categoryOf(b) === tab)
    .filter((b) => !q || `${b.houseName} ${b.id}`.toLowerCase().includes(q))
    .sort((a, bk) => {
      if (sortBy === 'newest') return bk.createdAt.localeCompare(a.createdAt);
      if (sortBy === 'oldest') return a.createdAt.localeCompare(bk.createdAt);
      return 0;
    })
    .sort((a, bk) => {
      if (sortBy !== 'smart') return 0;
      const r = rankOf(a) - rankOf(bk);
      if (r !== 0) return r;
      // Active piles: soonest check-in first. Past piles: most recent first.
      const past = rankOf(a) >= 2;
      return past ? bk.checkIn.localeCompare(a.checkIn) : a.checkIn.localeCompare(bk.checkIn);
    });

  // Labelled by where the stay sits in time, which is how a guest thinks about
  // their own bookings. The underlying keys are unchanged, so the filtering,
  // ranking and empty-state copy below keep working as they did.
  const TABS = [
    { key: 'all' as const, label: 'الكل', count: counts.all },
    { key: 'action' as const, label: 'القادمة', count: counts.action },
    { key: 'confirmed' as const, label: 'الحالية', count: counts.confirmed },
    { key: 'completed' as const, label: 'السابقة', count: counts.completed },
    { key: 'archived' as const, label: 'الملغية', count: counts.archived },
  ];
  const EMPTY_HINT: Record<typeof tab, string> = {
    all: 'تصفح بيوت المؤتمرات الرائعة في مصر وابدأ بالحجز لخلوتك القادمة.',
    action: 'لا يوجد حجوزات بانتظار إجراء منك حالياً — كله تمام 🎉',
    confirmed: 'لا توجد حجوزات مؤكدة بعد. بعد سداد العربون هتظهر حجوزاتك المؤكدة هنا.',
    completed: 'لسه مخلّصتش أي خلوة. بعد انتهاء زيارتك هتلاقيها هنا.',
    archived: 'لا توجد حجوزات ملغية أو مرفوضة.',
  };

  // Fetch the house owner's contact info (migration 031) the moment a
  // booking becomes eligible for reveal, instead of upfront for every
  // booking — mirrors onOpenRoomDistribution's lazy-load pattern.
  const getStatusBadge = (status: Booking['status']) => {
    switch (status) {
      case 'pending':
        return {
          label: 'قيد المراجعة',
          color: 'bg-amber-50 text-amber-800 border-amber-200',
          icon: Clock,
        };
      case 'approved':
        return {
          label: 'مؤكد ومقبول',
          color: 'bg-emerald-50 text-emerald-850 border-emerald-200',
          icon: CheckCircle2,
        };
      case 'rejected':
        return {
          label: 'مرفوض',
          color: 'bg-red-50 text-red-800 border-red-200',
          icon: XCircle,
        };
      case 'completed':
        return {
          label: 'تمت الزيارة',
          color: 'bg-[#EBEBE0]/30 text-[#4A4A3A] border-[#D6D6C2]',
          icon: CheckCircle2,
        };
      case 'cancelled':
        return {
          label: 'ملغى',
          color: 'bg-slate-50 text-slate-600 border-slate-200',
          icon: XCircle,
        };
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onloadend = () => {
      setProofImage(reader.result as string);
      setIsUploading(false);
    };
    reader.onerror = () => {
      alert('حدث خطأ أثناء قراءة الملف.');
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleEgyptianPaymentSubmit = (e: React.FormEvent, booking: Booking) => {
    e.preventDefault();

    const depositMin = Math.round(booking.totalPrice * settings.depositRate);
    const amount = parseFloat(paymentAmount) || depositMin;

    if (amount <= 0) {
      alert('الرجاء إدخال مبلغ دفع صحيح أكبر من صفر.');
      return;
    }

    // Validate based on selected method
    if (selectedMethod === 'bank') {
      if (!bankRef) {
        alert('الرجاء إدخال الرقم المرجعي للتحويل البنكي.');
        return;
      }
      if (!proofImage) {
        alert('الرجاء إرفاق صورة إيصال التحويل البنكي.');
        return;
      }
    } else if (selectedMethod === 'instapay') {
      if (!instaAddress || !instaRef) {
        alert('الرجاء إدخال عنوان إنستا باي والرقم المرجعي للتحويل.');
        return;
      }
      if (!proofImage) {
        alert('الرجاء إرفاق لقطة شاشة لإثبات تحويل إنستاباي.');
        return;
      }
    } else if (selectedMethod === 'vodafone') {
      if (!vodafoneNumber || !vodafoneTxId) {
        alert('الرجاء إدخال رقم محفظة فودافون كاش والمعرف الخاص بالعملية.');
        return;
      }
      if (!proofImage) {
        alert('الرجاء إرفاق لقطة شاشة للتحويل لمشرفي المحفظة.');
        return;
      }
    } else if (selectedMethod === 'cash') {
      if (!cashReceiver || !cashReceiptNo) {
        alert('الرجاء إدخال اسم مستلم النقدية ورقم الإيصال الورقي.');
        return;
      }
    } else if (selectedMethod === 'online') {
      if (!cardName || !cardNumber || !expiry || !cvv) {
        alert('الرجاء إدخال بيانات البطاقة الائتمانية بالكامل للدفع أونلاين.');
        return;
      }
    }

    const newPayment: Payment = {
      id: `pay_${Date.now()}`,
      bookingId: booking.id,
      userId: currentUser.id,
      userName: currentUser.name,
      amount,
      paymentMethod: selectedMethod,
      paymentStatus: selectedMethod === 'online' ? 'approved' : 'pending',
      paymentDate: new Date().toISOString(),
      proofImage: selectedMethod !== 'online' && selectedMethod !== 'cash' ? proofImage : undefined,
      transactionReference: selectedMethod === 'bank' ? bankRef :
                            selectedMethod === 'instapay' ? instaRef :
                            selectedMethod === 'vodafone' ? vodafoneTxId :
                            selectedMethod === 'cash' ? cashReceiptNo :
                            `ONL-${Math.floor(10000000 + Math.random() * 90000000)}`,
      details: {
        bankName: selectedMethod === 'bank' ? bankName : undefined,
        senderNumberOrAddress: selectedMethod === 'instapay' ? instaAddress :
                               selectedMethod === 'vodafone' ? vodafoneNumber : undefined,
        receiverName: selectedMethod === 'cash' ? cashReceiver : undefined,
        receiptNumber: selectedMethod === 'cash' ? cashReceiptNo : undefined,
      }
    };

    onSubmitPayment(newPayment);

    // All methods — including online card — go to pending_verification and
    // await owner/admin confirmation. There's no real payment gateway wired
    // up, so auto-confirming an "online" payment would let a guest confirm a
    // booking (and earn loyalty points) for unverified funds; the server-side
    // booking guard (migration 027) blocks that guest-side write anyway.

    // Reset states
    setIsPaying(null);
    setPaymentAmount('');
    setBankRef('');
    setInstaAddress('');
    setInstaRef('');
    setVodafoneNumber('');
    setVodafoneTxId('');
    setCashReceiver('');
    setCashReceiptNo('');
    setProofImage('');
    setCardName('');
    setCardNumber('');
    setExpiry('');
    setCvv('');
  };

  return (
    <div className="space-y-4 text-right text-[#4A4A3A]">
      {userBookings.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 border border-[#D6D6C2] text-center space-y-3">
          <div className="mx-auto w-12 h-12 bg-[#EBEBE0]/30 border border-[#D6D6C2] rounded-full flex items-center justify-center text-[#8A8A70]">
            <Calendar className="w-5 h-5 text-[#8A8A70]" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#4A4A3A]">لا توجد حجوزات حتى الآن</h3>
            <p className="text-[11px] text-[#8A8A70] mt-1">تصفح بيوت المؤتمرات الرائعة في مصر وابدأ بالحجز لخلوتك القادمة.</p>
          </div>
        </div>
      ) : (
        <>
          {/* Page title. Deliberately just a title — the app bar above already
              draws the bell and the avatar, and repeating them here would give
              the screen two headers. */}
          <div className="text-center pt-1">
            <h2 className="text-lg font-black text-[#2D2D24]">حجوزاتي</h2>
            <p className="text-[10.5px] font-bold text-[#8A8A70] mt-0.5">كل رحلتك في مكان واحد</p>
          </div>

          {/* Search — a guest hunting for one booking has the place name or the
              reference, so both match. */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#B8B8A0] pointer-events-none" />
              <input
                id="bookings-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث باسم المكان أو رقم الحجز"
                className="w-full bg-white border border-[#EDE7DA] rounded-2xl py-2.5 pr-10 pl-3 text-[11px] font-bold text-[#2D2D24] placeholder:text-[#B8B8A0] focus:outline-none focus:border-[#C5A059] shadow-sm"
              />
            </div>
            {search && (
              <button
                onClick={() => setSearch('')}
                className="shrink-0 flex items-center gap-1.5 bg-white border border-[#EDE7DA] rounded-2xl px-3 py-2.5 text-[11px] font-black text-[#5A5A40] shadow-sm cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>مسح</span>
              </button>
            )}
          </div>

          {/* Status filter tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {TABS.map((t) => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-[11px] font-black transition-all cursor-pointer border ${
                    active
                      ? 'bg-[#0A2342] text-white border-[#0A2342] shadow-sm'
                      : 'bg-white text-[#5A5A40] border-[#D6D6C2] hover:bg-[#FAF8F5]'
                  } ${t.count === 0 && !active ? 'opacity-45' : ''}`}
                >
                  <span>{t.label}</span>
                  <span className={`min-w-[17px] h-[17px] px-1 rounded-full text-[9px] font-black flex items-center justify-center ${
                    active ? 'bg-white/20 text-white' : t.key === 'action' && t.count > 0 ? 'bg-rose-500 text-white' : 'bg-[#EBEBE0] text-[#5A5A40]'
                  }`}>
                    {t.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Deposit reminder — only where it's actionable, not on every tab */}
          {(tab === 'all' || tab === 'action') && unpaidApprovedCount > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-3xl p-4 flex items-start gap-3 text-amber-900 text-xs shadow-sm animate-in fade-in slide-in-from-top duration-300">
              <div className="p-2 bg-amber-100 rounded-2xl text-amber-800 shrink-0 mt-0.5">
                <Bell className="w-5 h-5 text-amber-700" />
              </div>
              <div className="flex-1 space-y-1">
                <h4 className="font-extrabold text-amber-950">تذكير هام بسداد العربون!</h4>
                <p className="text-[11px] text-amber-900/90 leading-relaxed">
                  لديك {unpaidApprovedCount === 1 ? 'حجز مقبول ومؤكد' : `${unpaidApprovedCount} حجوزات مقبولة ومؤكدة`} بانتظار سداد عربون الجدية ({Math.round(settings.depositRate * 100)}%) لتثبيت المواعيد والغرف نهائياً وتجنب إلغاء الطلب تلقائياً من بيت المؤتمرات.
                </p>
              </div>
            </div>
          )}

          {/* The trip being waited on, given the whole width. Everything here
              is read from the booking — no placeholder art, so a house with no
              photo gets the brand gradient rather than a broken image. */}
          {nextBooking && !search && tab === 'all' && (() => {
            const h = houses.find((x) => x.id === nextBooking.houseId);
            const cover = h?.images?.[0];
            const badge = getStatusBadge(nextBooking.status);
            const BadgeIcon = badge.icon;
            const d = daysUntil(nextBooking.checkIn);
            return (
              <div className="space-y-0">
                <div className="relative rounded-3xl overflow-hidden h-52 shadow-md bg-gradient-to-br from-[#0A2342] to-[#123E75] text-white">
                  {cover && <img src={cover} alt="" referrerPolicy="no-referrer" className="absolute inset-0 w-full h-full object-cover" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/25" />

                  <span className="absolute top-3 right-3 flex items-center gap-1 bg-white/95 text-[#2D2D24] text-[9.5px] font-black px-2.5 py-1 rounded-full shadow-sm">
                    <Sparkles className="w-3 h-3 text-[#C5A059]" /> الحجز القادم
                  </span>

                  {d >= 0 && (
                    <div className="absolute top-14 right-3 bg-black/55 backdrop-blur-sm rounded-2xl px-3 py-2 text-center">
                      <div className="text-[8.5px] font-bold text-white/70 leading-none">تبقى</div>
                      <div className="text-xl font-black leading-tight">{d.toLocaleString('ar-EG')}</div>
                      <div className="text-[8.5px] font-bold text-white/70 leading-none">{d === 1 ? 'يوم' : d === 2 ? 'يومين' : 'أيام'}</div>
                    </div>
                  )}

                  <div className="absolute inset-x-0 bottom-0 p-4 space-y-1.5">
                    <h3 className="text-[15px] font-black leading-tight">{nextBooking.houseName}</h3>
                    {(h?.governorate || h?.address) && (
                      <div className="flex items-center gap-1 text-[10px] font-bold text-white/80">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span className="truncate">{[h?.address, h?.governorate].filter(Boolean).join(' - ')}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-3 text-[10px] font-bold text-white/85">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{arabicDateRange(nextBooking.checkIn, nextBooking.checkOut)}</span>
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" />{nextBooking.guestsCount.toLocaleString('ar-EG')} فرد</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-1.5">
                      <span className="text-[17px] font-black">{nextBooking.totalPrice.toLocaleString('ar-EG')} <span className="text-[11px]">ج.م</span></span>
                      <span className={`flex items-center gap-1 text-[9.5px] font-black px-2.5 py-1 rounded-full ${badge.color}`}>
                        <BadgeIcon className="w-3 h-3" /> {badge.label}
                      </span>
                    </div>
                    <button
                      onClick={() => setDetailBookingId(nextBooking.id)}
                      className="mt-1 flex items-center gap-1 bg-white/95 hover:bg-white text-[#2D2D24] text-[10px] font-black px-3 py-1.5 rounded-full shadow-sm cursor-pointer transition-colors"
                    >
                      عرض التفاصيل <ChevronLeft className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Its journey, straight under the card. Same buildBookingJourney
                    as the detail sheet — one source, drawn compactly. */}
                <div className="bg-white rounded-b-3xl border border-t-0 border-[#EDE7DA] px-3.5 pt-3 pb-3.5 -mt-3 relative z-10 shadow-sm">
                  <BookingJourney booking={nextBooking} payments={payments} variant="bar" />
                </div>
              </div>
            );
          })()}

          <div className="flex items-center justify-between px-1">
            <span className="text-[12px] font-black text-[#2D2D24]">جميع الحجوزات</span>
            <label className="flex items-center gap-1 text-[10px] font-black text-[#5A5A40] cursor-pointer">
              <ArrowDownWideNarrow className="w-3.5 h-3.5 text-[#B8B8A0]" />
              <select
                id="bookings-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="bg-transparent focus:outline-none cursor-pointer"
              >
                <option value="smart">الأهم أولاً</option>
                <option value="newest">الأحدث</option>
                <option value="oldest">الأقدم</option>
              </select>
            </label>
          </div>

          {visibleBookings.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 border border-[#D6D6C2] text-center space-y-3">
              <div className="mx-auto w-12 h-12 bg-[#EBEBE0]/30 border border-[#D6D6C2] rounded-full flex items-center justify-center text-[#8A8A70]">
                <Sparkles className="w-5 h-5 text-[#8A8A70]" />
              </div>
              <p className="text-[11px] text-[#8A8A70] leading-relaxed max-w-[260px] mx-auto">
                {search ? `مفيش حجز مطابق لـ"${search}".` : EMPTY_HINT[tab]}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleBookings.map((booking) => {
            const badge = getStatusBadge(booking.status);
            const StatusIcon = badge.icon;
            // Where this booking stands, and the single thing the guest may do
            // about it. The rule that matters: no money is asked for until the
            // house has approved — the booking flow promises exactly that on
            // three screens, and lib/bookingStage holds us to it.
            const { stage, canPay: canPayDeposit } = getBookingStage(booking, payments);
            const bookingHouse = houses.find((h) => h.id === booking.houseId);
            // Manual-collection model (migration 069): if the platform has its own
            // payment numbers, the guest pays THOSE (Pima collects the deposit,
            // then forwards the owner's share). Empty → fall back to owner-direct.
            const platformMethods = settings.paymentMethods ?? [];
            const payToPlatform = platformMethods.length > 0;
            const payMethods = payToPlatform ? platformMethods : (bookingHouse?.paymentMethods ?? []);
            const payeeLabel = payToPlatform ? 'منصة بيما' : 'صاحب البيت';
            const ownerPaymentFor = (type: string) => payMethods.find((p) => p.type === type);
            // No configured recipient for the picked method → block submit so a
            // guest can't record a "paid" deposit to a nonexistent payee.
            const walletPayee = ownerPaymentFor('vodafone_cash') ?? ownerPaymentFor('etisalat_cash') ?? ownerPaymentFor('orange_cash') ?? ownerPaymentFor('we_cash');
            const selectedPayeeMissing =
              (selectedMethod === 'instapay' && !ownerPaymentFor('instapay')) ||
              (selectedMethod === 'bank' && !ownerPaymentFor('bank_transfer')) ||
              (selectedMethod === 'vodafone' && !walletPayee);

            // Action affordances for this booking — used to give the footer a
            // clear hierarchy (one prominent primary CTA + secondary pills).
            const roomsAssigned = (booking.assignedRoomIds?.length ?? 0) > 0;
            const distributionStarted = attendees.some((a) => a.bookingId === booking.id);
            const roomsReady = booking.status === 'approved' && roomsAssigned && !distributionStarted;
            const canDistribute = booking.status === 'approved' || booking.status === 'completed';
            const canPlan = booking.status === 'approved' || booking.status === 'completed';
            const canChat = booking.status !== 'rejected' && booking.status !== 'cancelled';
            const canCancel = booking.status === 'pending' || booking.status === 'approved';
            const canNotifyDone = booking.status === 'approved' && roomsAssigned && distributionStarted && !!onNotifyOwnerDistribution;
            const hasReviewed = reviews.some((r) => r.houseId === booking.houseId && r.userId === currentUser.id);
            const canReview = booking.status === 'completed' && !hasReviewed && !!onSubmitReview;
            // The single most important next step, promoted to a full-width button.
            const primaryAction: 'pay' | 'distribute' | 'review' | 'chat' | null =
              canPayDeposit ? 'pay' : roomsReady ? 'distribute' : canReview ? 'review' : canChat ? 'chat' : null;

            // Compact-card teaser for the next step, mirroring primaryAction.
            const nextStep =
              primaryAction === 'pay' ? { label: 'مطلوب سداد العربون', cls: 'text-rose-700' }
                : primaryAction === 'distribute' ? { label: 'ابدأ توزيع الغرف', cls: 'text-emerald-700' }
                  : primaryAction === 'review' ? { label: 'قيّم خلوتك ⭐', cls: 'text-[#9a7b2f]' }
                    : { label: 'التفاصيل', cls: 'text-[#8A8A70]' };
            const dLeftCompact = booking.status === 'approved' ? daysUntil(booking.checkIn) : -1;
            const isOpen = detailBookingId === booking.id;

            return (
              <React.Fragment key={booking.id}>
                {/* ── Compact row in the list — everything else lives in the sheet ── */}
                <button
                  id={`booking-compact-${booking.id}`}
                  type="button"
                  onClick={() => {
                    setDetailBookingId(booking.id);
                    // Roster is lazy-loaded; fetch it so the collection tracker
                    // (and distribution state) are fresh when the sheet opens.
                    if (booking.status === 'approved' || booking.status === 'completed') onOpenRoomDistribution?.(booking.id);
                  }}
                  className="w-full bg-white rounded-3xl border border-[#D6D6C2] shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer text-right overflow-hidden"
                >
                  {/* Photo first: a place is recognised by how it looks long
                      before its name is read. Houses with no photo keep the
                      brand gradient rather than an empty grey box. */}
                  <div className="p-3 flex items-center gap-3">
                    <div className="w-[76px] h-[76px] rounded-2xl overflow-hidden shrink-0 bg-gradient-to-br from-[#0A2342] to-[#123E75] relative">
                      {bookingHouse?.images?.[0] && (
                        <img src={bookingHouse.images[0]} alt="" referrerPolicy="no-referrer" className="absolute inset-0 w-full h-full object-cover" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-[12.5px] font-black text-[#2E2E24] truncate">{booking.houseName}</h3>
                        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-black shrink-0 ${badge.color}`}>
                          <StatusIcon className="w-3 h-3 shrink-0" />
                          {badge.label}
                        </span>
                      </div>

                      {(bookingHouse?.governorate || bookingHouse?.address) && (
                        <div className="flex items-center gap-1 text-[9.5px] font-bold text-[#8A8A70]">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="truncate">{[bookingHouse?.address, bookingHouse?.governorate].filter(Boolean).join(' - ')}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2.5 text-[9.5px] font-bold text-[#5A5A40]">
                        <span className="flex items-center gap-1"><Users className="w-3 h-3 text-[#BCBC9D]" />{booking.guestsCount.toLocaleString('ar-EG')} فرد</span>
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3 text-[#BCBC9D]" />{arabicDateRange(booking.checkIn, booking.checkOut)}</span>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-0.5">
                        <div className="min-w-0">
                          <span className="text-[12.5px] font-black text-[#0A2342]">{booking.totalPrice.toLocaleString('ar-EG')} ج.م</span>
                          {/* What is still owed, or that nothing is — the number
                              a guest scans this row for. */}
                          <span className={`block text-[9px] font-black ${booking.depositPaid ? 'text-emerald-700' : 'text-[#B8944E]'}`}>
                            {booking.depositPaid
                              ? 'العربون مدفوع'
                              : `المتبقي ${Math.max(0, booking.totalPrice - (booking.depositPaid ? booking.depositAmount : 0)).toLocaleString('ar-EG')} ج.م`}
                          </span>
                        </div>
                        <span className={`flex items-center gap-0.5 text-[9.5px] font-black shrink-0 ${nextStep.cls}`}>
                          {nextStep.label}
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </span>
                      </div>

                      {dLeftCompact >= 0 && dLeftCompact <= 7 && (
                        <span className="inline-block text-[9px] font-black text-[#0A2342] bg-[#0A2342]/5 rounded-full px-2 py-0.5">
                          {dLeftCompact === 0
                            ? 'اليوم 🎉'
                            : `بعد ${arabicPlural(dLeftCompact, { one: 'يوم', two: 'يومين', few: 'أيام', many: 'يوم' })}`}
                        </span>
                      )}
                    </div>
                  </div>
                </button>

                {/* ── Full details in a bottom sheet, only while open ── */}
                {isOpen && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
                  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150" onClick={() => setDetailBookingId(null)} />
                  <div
                    id={`booking-card-${booking.id}`}
                    className="relative z-10 w-full sm:max-w-md max-h-[92dvh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-3xl border border-[#D6D6C2] shadow-2xl text-right animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
                  >
                    {/* Sheet grabber + close */}
                    <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-[#D6D6C2]/60 px-4 py-2 flex items-center justify-between">
                      <span className="text-[11px] font-black text-[#0A2342]">تفاصيل الحجز</span>
                      <button
                        type="button"
                        onClick={() => setDetailBookingId(null)}
                        className="p-1.5 rounded-full hover:bg-[#F1EEE6] cursor-pointer"
                        aria-label="إغلاق"
                      >
                        <X className="w-4 h-4 text-[#4A4A3A]" />
                      </button>
                    </div>
                {/* ── Hero: the place, its reference, and where it stands ── */}
                <div className="p-4">
                  <div className="rounded-[28px] border border-[#EDE7DA] bg-white shadow-[0_8px_24px_rgba(45,45,36,0.06),0_2px_6px_rgba(45,45,36,0.03)] p-3 flex items-start gap-3">
                    <div className="w-[86px] h-[86px] rounded-2xl overflow-hidden shrink-0 bg-gradient-to-br from-[#0A2342] to-[#123E75] relative">
                      {bookingHouse?.images?.[0] && (
                        <img src={bookingHouse.images[0]} alt="" referrerPolicy="no-referrer" className="absolute inset-0 w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <button
                        type="button"
                        onClick={() => { navigator.clipboard?.writeText(booking.id); setCopiedBookingId(booking.id); }}
                        className="flex items-center gap-1.5 text-[9.5px] font-bold text-[#8A8A70] hover:text-[#B8944E] transition-colors cursor-pointer"
                      >
                        <span dir="ltr">#{booking.id.toUpperCase()}</span>
                        {copiedBookingId === booking.id
                          ? <Check className="w-3 h-3 text-emerald-600" />
                          : <Copy className="w-3 h-3 text-[#B5AF98]" />}
                      </button>
                      <h3 className="text-[14px] font-black text-[#0A2342] leading-tight line-clamp-2">{booking.houseName}</h3>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-black ${badge.color}`}>
                        <StatusIcon className="w-3.5 h-3.5 shrink-0" />
                        {badge.label}
                      </span>
                      {booking.isLargeConferenceQuote && (
                        <span className="block text-[9px] font-bold text-[#8A8A70]">طلب عرض سعر لمؤتمر كبير</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* The booking's journey with Pima (live statuses only) */}
                {(booking.status === 'pending' || booking.status === 'approved' || booking.status === 'completed') && (
                  <div className="px-4 pb-4">
                    <div className="rounded-[28px] border border-[#EDE7DA] bg-white shadow-[0_8px_24px_rgba(45,45,36,0.06),0_2px_6px_rgba(45,45,36,0.03)] p-4">
                      <BookingJourney booking={booking} payments={payments} />
                      {/* Countdown — a confirmed trip that hasn't happened yet */}
                      {booking.status === 'approved' && (() => {
                        const d = daysUntil(booking.checkIn);
                        if (d < 0) return null;
                        const text = d === 0
                          ? 'خلوتك اليوم! 🎉'
                          : `باقي ${arabicPlural(d, { one: 'يوم واحد', two: 'يومين', few: 'أيام', many: 'يوم' })} على خلوتك`;
                        return (
                          <div className="mt-3 flex items-center justify-center gap-1.5 bg-[#FBF9F4] border border-[#EDE7DA] text-[#0A2342] rounded-full py-1.5 text-[10.5px] font-black">
                            <CalendarCheck className="w-3.5 h-3.5 text-[#C5A059]" />
                            <span>{text}</span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {/* ── The action. One per stage, and never a step ahead of
                       where the booking actually is. ── */}
                <div className="px-4 pb-4">
                  {stage === 'review' && (
                    <div className="rounded-[28px] border border-[#EDE7DA] bg-white shadow-[0_8px_24px_rgba(45,45,36,0.06),0_2px_6px_rgba(45,45,36,0.03)] p-4 text-center space-y-2">
                      <span className="inline-flex w-14 h-14 rounded-full bg-[#F6F0E2] items-center justify-center">
                        <Clock className="w-6 h-6 text-[#C9A24A]" />
                      </span>
                      <span className="block text-[13px] font-black text-[#0A2342]">بانتظار مراجعة الطلب</span>
                      <p className="text-[10.5px] font-medium text-[#8A8A70] leading-relaxed">
                        سيتم إشعارك فور مراجعة طلبك من قبل بيت المؤتمرات.
                        <br />لن يُطلب منك أي دفع قبل الموافقة.
                      </p>
                    </div>
                  )}

                  {stage === 'awaiting_deposit' && (
                    <div className="rounded-[28px] border border-[#EBD9B4] bg-[#FDF9EF] p-4 space-y-3">
                      <div className="flex items-start gap-3">
                        <span className="w-11 h-11 rounded-full bg-white border border-[#EBD9B4] flex items-center justify-center shrink-0">
                          <ShieldCheck className="w-5 h-5 text-[#C9A24A]" />
                        </span>
                        <div className="min-w-0">
                          <span className="block text-[12.5px] font-black text-[#0A2342] leading-snug">تمت الموافقة على طلبك 🎉</span>
                          <span className="block text-[10px] font-medium text-[#8A8A70] leading-relaxed mt-1">
                            وافق بيت المؤتمرات على طلبك. ادفع العربون لتأكيد الحجز النهائي.
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setIsPaying(booking.id); setPaymentAmount(Math.round(booking.totalPrice * settings.depositRate).toString()); }}
                        className="w-full flex items-center justify-center gap-2 bg-gradient-to-b from-[#C9A96A] to-[#B8944E] text-white font-black text-[12.5px] py-3.5 rounded-2xl shadow-[0_4px_14px_rgba(184,148,78,0.35)] transition-transform cursor-pointer pima-press"
                      >
                        <Wallet className="w-4 h-4" />
                        ادفع العربون الآن · {Math.round(booking.totalPrice * settings.depositRate).toLocaleString('ar-EG')} ج.م
                      </button>
                    </div>
                  )}

                  {stage === 'verifying' && (
                    <div className="rounded-[28px] border border-[#EDE7DA] bg-white shadow-[0_8px_24px_rgba(45,45,36,0.06),0_2px_6px_rgba(45,45,36,0.03)] p-4 space-y-3">
                      <div className="flex items-start gap-3">
                        <span className="w-11 h-11 rounded-full bg-[#F6F0E2] flex items-center justify-center shrink-0">
                          <FileDown className="w-5 h-5 text-[#C9A24A]" />
                        </span>
                        <div className="min-w-0">
                          <span className="block text-[12.5px] font-black text-[#0A2342] leading-snug">إثبات الدفع قيد المراجعة</span>
                          <span className="block text-[10px] font-medium text-[#8A8A70] leading-relaxed mt-1">
                            تم استلام إثبات الدفع بنجاح، وسيتم مراجعته خلال ساعات قليلة.
                          </span>
                        </div>
                      </div>
                      {/* Indeterminate: we genuinely do not know how far along a
                          human review is, and a percentage would be invented. */}
                      <div className="h-1.5 bg-[#F1ECE0] rounded-full overflow-hidden">
                        <div className="h-full w-1/3 rounded-full bg-gradient-to-l from-[#C9A96A] to-[#B8944E] pima-indeterminate" />
                      </div>
                    </div>
                  )}

                  {stage === 'confirmed' && (
                    <div className="rounded-[28px] border border-emerald-200 bg-emerald-50/60 p-4 space-y-3">
                      <div className="flex items-start gap-3">
                        <span className="w-11 h-11 rounded-full bg-white border border-emerald-200 flex items-center justify-center shrink-0">
                          <ShieldCheck className="w-5 h-5 text-emerald-600" />
                        </span>
                        <div className="min-w-0">
                          <span className="block text-[12.5px] font-black text-[#0A2342] leading-snug">الحجز مؤكّد 🎉</span>
                          <span className="block text-[10px] font-medium text-[#8A8A70] leading-relaxed mt-1">
                            تم تأكيد حجزك بنجاح. نتمنى لك إقامة مباركة.
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setActiveReceipt(booking)}
                          className="flex items-center justify-center gap-1.5 bg-white border border-[#EDE7DA] hover:border-[#E3CD9F] text-[#4A4A3A] font-black text-[11px] py-2.5 rounded-2xl transition-colors cursor-pointer pima-press"
                        >
                          <FileDown className="w-3.5 h-3.5 text-[#C9A24A]" />
                          عرض سند الحجز
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadBookingIcs(booking, bookingHouse?.address)}
                          className="flex items-center justify-center gap-1.5 bg-gradient-to-b from-[#C9A96A] to-[#B8944E] text-white font-black text-[11px] py-2.5 rounded-2xl shadow-[0_2px_8px_rgba(184,148,78,0.3)] cursor-pointer pima-press"
                        >
                          <CalendarPlus className="w-3.5 h-3.5" />
                          أضف إلى التقويم
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Four facts, four equal cards ── */}
                <div className="px-4 pb-4 grid grid-cols-2 gap-2.5">
                  {[
                    { icon: Calendar, label: 'الوصول', value: arabicDate(booking.checkIn) },
                    { icon: CalendarCheck, label: 'المغادرة', value: arabicDate(booking.checkOut) },
                    { icon: Users, label: 'عدد الأفراد', value: `${booking.guestsCount.toLocaleString('ar-EG')} فرد` },
                    { icon: Wallet, label: 'إجمالي التكلفة', value: `${booking.totalPrice.toLocaleString('ar-EG')} ج.م` },
                  ].map((f) => (
                    <div key={f.label} className="rounded-2xl border border-[#EDE7DA] bg-[#FBF9F4] p-3">
                      <span className="flex items-center gap-1.5 text-[9.5px] font-bold text-[#8A8A70]">
                        <f.icon className="w-3.5 h-3.5 text-[#C9A24A] shrink-0" />
                        {f.label}
                      </span>
                      <span className="block text-[12.5px] font-black text-[#0A2342] mt-1.5">{f.value}</span>
                    </div>
                  ))}
                </div>

                {/* Payment progress toward the house — paid so far vs. total */}
                {(booking.status === 'approved' || booking.status === 'completed') && booking.totalPrice > 0 && (() => {
                  const paid = payments.filter((p) => p.bookingId === booking.id && p.paymentStatus === 'approved').reduce((s, p) => s + p.amount, 0);
                  const pct = Math.min(100, Math.round((paid / booking.totalPrice) * 100));
                  const remaining = Math.max(0, booking.totalPrice - paid);
                  return (
                    <div className="px-4 pb-4">
                      <div className="rounded-[28px] border border-[#EDE7DA] bg-white shadow-[0_8px_24px_rgba(45,45,36,0.06),0_2px_6px_rgba(45,45,36,0.03)] p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-black text-[#0A2342]">تقدّم السداد</span>
                          <span className={`text-[11px] font-black ${remaining === 0 ? 'text-emerald-700' : 'text-[#B8944E]'}`}>
                            {pct.toLocaleString('ar-EG')}٪
                          </span>
                        </div>
                        {/* Grows from zero on open, so the bar is read as filling
                            rather than as a static state. */}
                        <div className="h-2 bg-[#F1ECE0] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${remaining === 0 ? 'bg-emerald-500' : 'bg-gradient-to-l from-[#C9A96A] to-[#B8944E]'}`}
                            style={{ width: `${paymentBarPct(pct)}%`, transition: 'width 800ms var(--motion-ease)' }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[9.5px] font-bold">
                          <span className="text-[#8A8A70]">مدفوع {paid.toLocaleString('ar-EG')} ج.م</span>
                          <span className={remaining === 0 ? 'text-emerald-700' : 'text-[#B8944E]'}>
                            {remaining === 0 ? 'مدفوع بالكامل ✓' : `المتبقي ${remaining.toLocaleString('ar-EG')} ج.م`}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* The request's own details. Shown for an ordinary booking too
                    now, since that is where the applicant's notes land. */}
                {booking.conferenceDetails && (booking.conferenceDetails.extraRequests || booking.conferenceDetails.diocese || booking.conferenceDetails.bookingType) && (
                  <div className="p-4 bg-[#EBEBE0]/15 border-b border-[#D6D6C2]/60 text-xs text-[#4A4A3A] space-y-1">
                    <div className="font-bold flex items-center gap-1 text-[#464E3D]">
                      <Building className="w-3.5 h-3.5" />
                      <span>{booking.isLargeConferenceQuote ? 'متطلبات المؤتمر الكنسي:' : 'تفاصيل طلبك:'}</span>
                    </div>
                    {/* Kept out of the four-fact grid above so it stays four
                        equal cards; this block is «what you asked for». */}
                    {booking.conferenceDetails.bookingType && (
                      <div className="text-[10px] text-[#464E3D] font-medium pt-1">نوع الحجز: {bookingTypeLabel(booking)}</div>
                    )}
                    {booking.conferenceDetails.extraRequests && (
                      <div className="text-[10px] text-[#2D2D24]/80 leading-relaxed bg-white border border-[#E7E5DB] p-2 rounded-xl mt-1 text-right whitespace-pre-line">
                        {booking.conferenceDetails.extraRequests}
                      </div>
                    )}
                    {booking.conferenceDetails.diocese && (
                      <div className="text-[10px] text-[#464E3D] font-medium pt-1">الإيبارشية: {booking.conferenceDetails.diocese}</div>
                    )}
                    {booking.isLargeConferenceQuote && (
                      <div className="flex gap-4 text-[10px] text-[#464E3D] font-medium pt-1">
                        <span>• شامل حجز قاعة الاجتماعات</span>
                        {booking.conferenceDetails.mealsIncluded && <span>• شامل الوجبات اليومية الثلاث كاملة</span>}
                      </div>
                    )}
                  </div>
                )}
                {/* One adaptive status note — replaces the old stack of separate
                    amber/emerald/gray banners with a single, consistently-styled
                    block that shows only what matters for the current state. */}
                {(() => {
                  const house = houses.find((h) => h.id === booking.houseId);
                  const depositAmt = Math.round(booking.totalPrice * settings.depositRate);
                  const dLeft = daysUntil(booking.checkIn);
                  const nearDate = booking.status === 'approved' && dLeft >= 0 && dLeft <= 3;
                  const paidSoFar = payments.filter((p) => p.bookingId === booking.id && p.paymentStatus === 'approved').reduce((s, p) => s + p.amount, 0);
                  const remaining = booking.totalPrice - paidSoFar;
                  const attCount = attendees.filter((a) => a.bookingId === booking.id).length;
                  const showConfirmed = booking.status === 'approved' && booking.depositPaid;
                  if (!(booking.status === 'pending' || canPayDeposit || showConfirmed)) return null;
                  return (
                    <div className="px-4 py-3.5 border-b border-[#D6D6C2]/60 space-y-2.5 text-[10.5px]">
                      {/* Awaiting-deposit prompt (the CTA below performs the action) */}
                      {canPayDeposit && (
                        <div className="flex items-start gap-2 bg-amber-50/70 border border-amber-200/80 rounded-2xl p-2.5 text-amber-950">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <span className="font-bold leading-relaxed">ثبّت حجزك بسداد عربون الجدية <strong className="text-amber-900">{depositAmt.toLocaleString('ar-EG')} ج.م</strong> ({Math.round(settings.depositRate * 100)}%) — استخدم زر السداد بالأسفل.</span>
                        </div>
                      )}

                      {/* Confirmed: address + coordination hint (+ near-date checklist) */}
                      {showConfirmed && (
                        <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-2.5 space-y-2 text-emerald-950">
                          <div className="flex items-center gap-1.5 font-black text-emerald-900"><ShieldCheck className="w-4 h-4 text-emerald-700" /> حجزك مؤكد وجاهز ✓</div>
                          {house?.address && (
                            <div className="flex items-start gap-2 text-emerald-900/90"><MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" /><span><strong className="text-emerald-800">العنوان:</strong> {house.address}</span></div>
                          )}
                          <div className="flex items-start gap-2 text-emerald-900/75"><MessageCircle className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" /><span>لأي تنسيق قبل الوصول، راسل صاحب البيت من الأسفل — كل الرسائل محفوظة.</span></div>
                          {nearDate && (remaining > 0 || attCount < booking.guestsCount) && (
                            <div className="pt-2 border-t border-emerald-200/70 space-y-1">
                              <div className="flex items-center gap-1.5 font-black text-amber-800"><Bell className="w-3.5 h-3.5" /> خلوتك بعد {dLeft.toLocaleString('ar-EG')} أيام — جهّز:</div>
                              {remaining > 0 && <div className="text-amber-900/90 font-bold pr-5">• المتبقي للسداد: {remaining.toLocaleString('ar-EG')} ج.م</div>}
                              {attCount < booking.guestsCount && <div className="text-amber-900/90 font-bold pr-5">• أكمل المشاركين: {attCount.toLocaleString('ar-EG')} من {booking.guestsCount.toLocaleString('ar-EG')}</div>}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Pending: awaiting approval + how you'll pay */}
                      {booking.status === 'pending' && (
                        <>
                          <div className="flex items-center gap-2 text-[#8A8A70] font-bold"><Clock className="w-3.5 h-3.5 text-[#BCBC9D]" /> بانتظار موافقة صاحب البيت على طلبك.</div>
                          {payMethods.length > 0 && (
                            <div className="bg-[#FAF8F5] border border-[#E7E5DB] rounded-2xl p-2.5 space-y-1.5">
                              <div className="flex items-center gap-1.5 font-black text-[#4A4A3A]"><Coins className="w-3.5 h-3.5 text-[#867E65]" /> حوّل العربون الآن إلى {payeeLabel} لتأكيد طلبك</div>
                              <div className="space-y-1">
                                {payMethods.map((pm) => (
                                  <div key={pm.id} className="flex justify-between items-center">
                                    <span className="text-[#867E65] font-bold">{PAYMENT_TYPE_LABELS[pm.type] || pm.label}:</span>
                                    <span className="font-mono font-extrabold text-[#2D2D24]" dir="ltr">{pm.value}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })()}

                {/* Collection tracker — who has paid their share to the leader.
                    Roster comes from self-registration / room distribution. */}
                {(booking.status === 'approved' || booking.status === 'completed') && booking.guestsCount > 0 && (() => {
                  const roster = attendees.filter((a) => a.bookingId === booking.id);
                  if (roster.length === 0) return null;
                  const share = Math.ceil(booking.totalPrice / booking.guestsCount);
                  const paidCount = roster.filter((a) => a.sharePaid).length;
                  const collected = paidCount * share;
                  return (
                    <div className="px-4 py-3.5 border-b border-[#D6D6C2]/60 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black text-[#0A2342] flex items-center gap-1.5"><Coins className="w-4 h-4 text-[#C5A059]" /> تحصيل المشاركين</span>
                        <span className="text-[9.5px] font-black text-[#8A8A70]">نصيب الفرد: {share.toLocaleString('ar-EG')} ج.م</span>
                      </div>
                      <div className="h-2 bg-[#EBEBE0] rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.round((paidCount / roster.length) * 100)}%` }} />
                      </div>
                      <div className="text-[9.5px] font-bold text-[#8A8A70]">دفع {paidCount.toLocaleString('ar-EG')} من {roster.length.toLocaleString('ar-EG')} — محصَّل {collected.toLocaleString('ar-EG')} ج.م</div>
                      <div className="max-h-44 overflow-y-auto space-y-1 pr-0.5">
                        {roster.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => toggleSharePaid(booking, a)}
                            disabled={togglingShareId === a.id}
                            className={`w-full flex items-center justify-between gap-2 rounded-xl border px-2.5 py-1.5 text-right transition-all cursor-pointer disabled:opacity-50 ${
                              a.sharePaid ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-[#D6D6C2] hover:bg-[#FAF8F5]'
                            }`}
                          >
                            <span className={`text-[10.5px] font-bold truncate ${a.sharePaid ? 'text-emerald-900' : 'text-[#4A4A3A]'}`}>{a.name || 'بدون اسم'}</span>
                            <span className={`shrink-0 flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full ${a.sharePaid ? 'bg-emerald-500 text-white' : 'bg-[#EBEBE0] text-[#8A8A70]'}`}>
                              {a.sharePaid ? <><Check className="w-3 h-3" /> دفع</> : 'لسه'}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Footer — payment status, room guidance, then a clear action
                    hierarchy: one prominent primary CTA + uniform secondary pills. */}
                <div className="p-4 bg-[#FAF8F5] border-b border-[#E7E5DB] space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-bold text-[#867E65]">حالة السداد والمالية:</span>
                    {(() => {
                      const payStatus = booking.paymentStatus || 'unpaid';
                      if (payStatus === 'pending_verification') {
                        return (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold bg-amber-50 text-amber-900 border border-amber-200 px-2.5 py-1 rounded-full shadow-sm">
                            <Clock className="w-3 h-3 text-amber-600 animate-pulse" />
                            <span>بانتظار مراجعة الإدارة والتحقق ⏳</span>
                          </span>
                        );
                      } else if (payStatus === 'paid_deposit') {
                        return (
                          <span className="inline-flex items-center gap-1 text-[9px] font-extrabold bg-emerald-50 text-emerald-950 border border-emerald-200 px-2.5 py-1 rounded-full shadow-sm">
                            <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                            <span>تم تأكيد دفع العربون ({Math.round(settings.depositRate * 100)}%) 🎉</span>
                          </span>
                        );
                      } else if (payStatus === 'paid_full') {
                        return (
                          <span className="inline-flex items-center gap-1 text-[9px] font-extrabold bg-emerald-100 text-emerald-900 border border-emerald-300 px-2.5 py-1 rounded-full shadow-sm">
                            <ShieldCheck className="w-3 h-3 text-emerald-700" />
                            <span>مدفوع بالكامل كلياً ✅</span>
                          </span>
                        );
                      } else {
                        return (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold bg-rose-50 text-rose-950 border border-rose-200 px-2.5 py-1 rounded-full shadow-sm">
                            <Coins className="w-3 h-3 text-rose-600" />
                            <span>بانتظار سداد العربون (لم يُدفع) 💸</span>
                          </span>
                        );
                      }
                    })()}
                  </div>

                  {/* Room-distribution guidance — its own row, not crammed among buttons */}
                  {booking.status === 'approved' && !roomsAssigned && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-right">
                      <div className="text-[11px] font-black text-amber-900 flex items-center gap-1.5"><Building className="w-3.5 h-3.5" /> بانتظار تخصيص الغرف من صاحب البيت</div>
                      <div className="text-[9.5px] text-amber-800 font-bold mt-1 leading-relaxed">أول ما صاحب البيت يبعت غرف مجموعتك، هتقدر تكتب أسماء المشاركين وتوزّعهم من هنا.</div>
                    </div>
                  )}
                  {booking.status === 'approved' && roomsReady && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-right space-y-1.5">
                      <div className="text-[11px] font-black text-emerald-900 flex items-center gap-1.5"><Building className="w-3.5 h-3.5" /> صاحب البيت خصّص لك {booking.assignedRoomIds?.length ?? 0} غرفة — ابدأ التوزيع 🎉</div>
                      <div className="text-[9.5px] text-emerald-800 font-bold leading-relaxed">١) اضغط «توزيع الغرف» ٢) اكتب أسماء المشاركين ٣) وزّعهم على الغرف (تلقائي أو يدوي) ٤) اطبع الكشف.</div>
                    </div>
                  )}

                  {/* Primary CTA. Paying is deliberately absent here: the action
                      card at the top and the sticky bar at the foot both carry
                      it, and a third button for the same thing is noise. */}
                  {primaryAction === 'distribute' && (
                    <button
                      id={`booking-allocation-btn-${booking.id}`}
                      onClick={() => { setActiveAllocationBooking(booking); onOpenRoomDistribution?.(booking.id); }}
                      className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer shadow-sm active:scale-[0.99]"
                    >
                      <Building className="w-4 h-4" />
                      <span>ابدأ توزيع الغرف</span>
                    </button>
                  )}
                  {primaryAction === 'review' && (
                    <button
                      onClick={() => setReviewingBooking(booking)}
                      className="w-full flex items-center justify-center gap-2 bg-gradient-to-l from-[#C5A059] to-[#D8B877] hover:from-[#b8925090] text-[#3a2e12] px-4 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer shadow-sm active:scale-[0.99]"
                    >
                      <Star className="w-4 h-4 fill-current" />
                      <span>قيّم خلوتك وساعد غيرك ⭐</span>
                    </button>
                  )}
                  {primaryAction === 'chat' && (
                    <button
                      id={`booking-chat-btn-${booking.id}`}
                      onClick={() => setChatOpenBookingId(chatOpenBookingId === booking.id ? null : booking.id)}
                      className="w-full flex items-center justify-center gap-2 bg-[#0A2342] hover:bg-[#123E75] text-white px-4 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer shadow-sm active:scale-[0.99]"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>{chatOpenBookingId === booking.id ? 'إغلاق المحادثة' : 'راسل صاحب البيت'}</span>
                    </button>
                  )}

                  {/* Secondary actions — uniform neutral pills */}
                  <div className="flex flex-wrap items-center gap-2">
                    {canDistribute && primaryAction !== 'distribute' && (
                      <button
                        id={`booking-allocation-btn-${booking.id}`}
                        onClick={() => { setActiveAllocationBooking(booking); onOpenRoomDistribution?.(booking.id); }}
                        className="flex items-center gap-1.5 bg-white hover:bg-[#F1EEE6] text-[#4A4A3A] border border-[#D6D6C2] px-3 py-1.5 rounded-xl text-[10.5px] font-bold transition-all cursor-pointer"
                      >
                        <Building className="w-3.5 h-3.5 text-[#867E65]" />
                        <span>توزيع الغرف</span>
                      </button>
                    )}
                    {canNotifyDone && (
                      <button
                        onClick={async () => { const ok = await onNotifyOwnerDistribution!(booking.id); if (ok) { setNotifiedOwner((p) => new Set(p).add(booking.id)); } }}
                        disabled={notifiedOwner.has(booking.id)}
                        className="flex items-center gap-1.5 bg-[#464E3D] hover:bg-[#333A2C] disabled:opacity-60 text-white px-3 py-1.5 rounded-xl text-[10.5px] font-bold transition-all cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{notifiedOwner.has(booking.id) ? 'تم إبلاغ صاحب البيت ✓' : 'أبلغ صاحب البيت إني خلّصت'}</span>
                      </button>
                    )}
                    {canPlan && (
                      <button
                        id={`booking-planner-btn-${booking.id}`}
                        onClick={() => {
                          setActivePlannerBooking(booking);
                          setPlannerTheme('growth');
                          setPlannerTab('schedule');
                          if (!plannerChecklist[booking.id]) {
                            setPlannerChecklist(prev => ({ ...prev, [booking.id]: DEFAULT_CHECKLIST_ITEMS.map(item => ({ ...item })) }));
                          }
                          if (!customActivities[booking.id]) {
                            setCustomActivities(prev => ({ ...prev, [booking.id]: getThemeActivities('growth') }));
                          }
                        }}
                        className="flex items-center gap-1.5 bg-white hover:bg-[#F1EEE6] text-[#4A4A3A] border border-[#D6D6C2] px-3 py-1.5 rounded-xl text-[10.5px] font-bold transition-all cursor-pointer"
                      >
                        <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                        <span>برنامج الخلوة</span>
                      </button>
                    )}
                    {(booking.status === 'approved' || booking.status === 'completed') && (
                      <button
                        onClick={() => downloadBookingIcs(booking, bookingHouse?.address)}
                        className="flex items-center gap-1.5 bg-white hover:bg-[#F1EEE6] text-[#4A4A3A] border border-[#D6D6C2] px-3 py-1.5 rounded-xl text-[10.5px] font-bold transition-all cursor-pointer"
                      >
                        <CalendarPlus className="w-3.5 h-3.5 text-[#867E65]" />
                        <span>أضف لتقويمك</span>
                      </button>
                    )}
                    {/* Invite members to self-register into the roster via a shared link */}
                    {booking.status === 'approved' && (
                      <button
                        onClick={() => {
                          const link = `${window.location.origin}/?join=${booking.id}`;
                          const msg = `سلام ونعمة 🙏\nانضم لقائمة مشاركين خلوة «${booking.houseName}» (${arabicDateRange(booking.checkIn, booking.checkOut)}) واكتب اسمك من هنا:\n${link}`;
                          window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
                        }}
                        className="flex items-center gap-1.5 bg-white hover:bg-[#F1EEE6] text-[#4A4A3A] border border-[#D6D6C2] px-3 py-1.5 rounded-xl text-[10.5px] font-bold transition-all cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5 text-emerald-700" />
                        <span>ادعُ المشاركين</span>
                      </button>
                    )}
                    {canChat && primaryAction !== 'chat' && (
                      <button
                        id={`booking-chat-btn-${booking.id}`}
                        onClick={() => setChatOpenBookingId(chatOpenBookingId === booking.id ? null : booking.id)}
                        className="flex items-center gap-1.5 bg-white hover:bg-[#F1EEE6] text-[#4A4A3A] border border-[#D6D6C2] px-3 py-1.5 rounded-xl text-[10.5px] font-bold transition-all cursor-pointer"
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-sky-700" />
                        <span>راسل صاحب البيت</span>
                      </button>
                    )}
                    <button
                      id={`booking-receipt-btn-${booking.id}`}
                      onClick={() => setActiveReceipt(booking)}
                      className="flex items-center gap-1.5 bg-white hover:bg-[#F1EEE6] text-[#4A4A3A] border border-[#D6D6C2] px-3 py-1.5 rounded-xl text-[10.5px] font-bold transition-all cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5 text-[#867E65]" />
                      <span>سند التأكيد</span>
                    </button>
                    {canCancel && (
                      <button
                        onClick={() => {
                          const { tier, pct, daysLeft, paid, refund } = refundAmountFor(booking, settings);
                          const policyLine = paid <= 0
                            ? 'لم تدفع أي مبلغ بعد — الإلغاء بدون أي التزامات.'
                            : tier === 'full'
                              ? `باقي ${daysLeft} يوم على الوصول — يحق لك استرداد كامل المبلغ المدفوع (${paid.toLocaleString('ar-EG')} ج.م).`
                              : tier === 'partial'
                                ? `باقي ${daysLeft} يوم على الوصول — يحق لك استرداد ${Math.round(pct * 100)}% من المدفوع (${refund.toLocaleString('ar-EG')} ج.م من أصل ${paid.toLocaleString('ar-EG')} ج.م).`
                                : `باقي ${daysLeft} يوم فقط على الوصول — وفقاً لسياسة الإلغاء لا يوجد استرداد للمبلغ المدفوع (${paid.toLocaleString('ar-EG')} ج.م).`;
                          if (confirm(`هل أنت متأكد من إلغاء هذا الحجز؟\n\n🛡️ سياسة الإلغاء: ${policyLine}`)) onCancelBooking?.(booking.id);
                        }}
                        className="flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-800 border border-red-200 px-3 py-1.5 rounded-xl text-[10.5px] font-bold transition-all cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5 text-red-600" />
                        <span>إلغاء الحجز</span>
                      </button>
                    )}
                  </div>
                </div>

                {chatOpenBookingId === booking.id && (
                  <div ref={chatRef} className="px-4 pb-4 scroll-mt-2">
                    <BookingChatPanel
                      bookingId={booking.id}
                      currentUserId={currentUser.id}
                      title={houses.find((h) => h.id === booking.houseId)?.ownerName || 'صاحب البيت'}
                      subtitle={booking.houseName}
                      variant="guest"
                      heightClass="h-[50vh]"
                    />
                  </div>
                )}

                {/* Egyptian Interactive Payment Module Dialog embedded inline */}
                {/* ── The deposit, as its own screen over everything else. It
                       builds the Payment record from what the guest actually
                       filled in and hands it to the same onSubmitPayment the
                       old inline form used, so nothing downstream changed. ── */}
                <DepositPayment
                  // Gated on the stage, not just on intent: the auto-pay
                  // hand-off could otherwise open payment on a booking the
                  // house has not approved, which is the one thing the flow
                  // promises will never happen.
                  open={isPaying === booking.id && canPayDeposit}
                  booking={booking}
                  house={bookingHouse}
                  currentUser={currentUser}
                  amount={depositDueFor(booking)}
                  payees={{
                    ...(ownerPaymentFor('instapay') ? { instapay: { label: 'إنستاباي', value: ownerPaymentFor('instapay')!.value } } : {}),
                    ...(walletPayee ? { vodafone: { label: walletPayee.label, value: walletPayee.value } } : {}),
                    ...(ownerPaymentFor('bank_transfer') ? { bank: { label: ownerPaymentFor('bank_transfer')!.label, value: ownerPaymentFor('bank_transfer')!.value } } : {}),
                  }}
                  onClose={() => setIsPaying(null)}
                  onSubmit={({ method, proofImage: proofData, reference }) => {
                    const amount = depositDueFor(booking);
                    // Every method lands as 'pending': no gateway is wired up,
                    // so auto-approving would confirm a booking on unverified
                    // funds. The server-side guard (migration 027) blocks that
                    // write anyway.
                    onSubmitPayment({
                      id: `pay_${Date.now()}`,
                      bookingId: booking.id,
                      userId: currentUser.id,
                      userName: currentUser.name,
                      amount,
                      paymentMethod: method,
                      paymentStatus: 'pending',
                      paymentDate: new Date().toISOString(),
                      proofImage: proofData,
                      transactionReference: reference,
                      details: {
                        senderNumberOrAddress: method === 'instapay' || method === 'vodafone' ? reference : undefined,
                        bankName: method === 'bank' ? (ownerPaymentFor('bank_transfer')?.label ?? undefined) : undefined,
                      },
                    });
                  }}
                />

                {/* ── Sticky pay bar. Stays with the guest all the way down the
                       sheet, so the one thing they owe is never scrolled past.
                       Hidden while the transfer form itself is open — the form
                       has its own submit and two pay buttons would compete. ── */}
                {stage === 'awaiting_deposit' && isPaying !== booking.id && (
                  <div className="sticky bottom-0 z-20 bg-white/95 backdrop-blur-sm border-t border-[#EDE7DA] px-4 py-3 flex items-center gap-3">
                    <div className="shrink-0 leading-tight">
                      <span className="block text-[9px] font-bold text-[#8A8A70]">المتبقي للدفع</span>
                      <span className="block text-[15px] font-black text-[#0A2342]">
                        {Math.round(booking.totalPrice * settings.depositRate).toLocaleString('ar-EG')} ج.م
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setIsPaying(booking.id); setPaymentAmount(Math.round(booking.totalPrice * settings.depositRate).toString()); }}
                      className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-b from-[#C9A96A] to-[#B8944E] text-white font-black text-[12.5px] py-3.5 rounded-2xl shadow-[0_4px_14px_rgba(184,148,78,0.35)] transition-transform cursor-pointer pima-press"
                    >
                      <Wallet className="w-4 h-4" />
                      ادفع العربون الآن
                    </button>
                  </div>
                )}
                  </div>
                </div>
                )}
              </React.Fragment>
            );
              })}
            </div>
          )}
        </>
      )}

      {/* Post-trip review — opened from a completed booking's primary CTA */}
      {reviewingBooking && (() => {
        const house = houses.find((h) => h.id === reviewingBooking.houseId);
        if (!house || !onSubmitReview) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setReviewingBooking(null)} />
            <div className="relative z-10 w-full max-w-md max-h-[90dvh] overflow-y-auto animate-in zoom-in-95 duration-200">
              <button
                onClick={() => setReviewingBooking(null)}
                className="absolute top-2 left-2 z-20 p-1.5 bg-white/90 hover:bg-white rounded-full border border-[#D6D6C2] cursor-pointer shadow-sm"
              >
                <X className="w-4 h-4 text-[#4A4A3A]" />
              </button>
              <ReviewWizard
                house={house}
                currentUser={currentUser}
                onSubmitReview={onSubmitReview}
                onDone={() => setReviewingBooking(null)}
              />
            </div>
          </div>
        );
      })()}

      {/* High-Fidelity Printable Receipt Dialog */}
      {activeReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setActiveReceipt(null)} />
          <div className="bg-white rounded-3xl max-w-md w-full border border-[#D6D6C2] shadow-2xl overflow-hidden relative z-10 animate-in zoom-in-95 duration-200 text-right text-[#4A4A3A]">
            
            <div id="receipt-pdf-container" className="bg-white relative">
              {/* Stamp styling */}
              <div className="absolute top-4 left-4 border-4 border-[#5A5A40]/30 text-[#5A5A40]/40 rounded-full w-14 h-14 flex items-center justify-center rotate-12 font-black text-[9px] uppercase pointer-events-none">
                CONFIRMED
              </div>

              {/* Receipt Header */}
              <div className="bg-gradient-to-r from-[#4A4A3A] to-[#5A5A40] text-white p-5 text-center space-y-1">
                <h3 className="text-sm font-extrabold tracking-wide">سند تأكيد حجز رسمي كنسي</h3>
                <p className="text-[10px] text-white/80">تطبيق حجز بيوت المؤتمرات والفنادق المسيحية بمصر</p>
              </div>

              {/* Receipt Content */}
              <div className="p-5 space-y-4">
                <div className="text-center pb-2 border-b border-dashed border-[#D6D6C2]">
                  <span className="text-[10px] text-[#8A8A70]">رقم الحجز: {activeReceipt.id.toUpperCase()}</span>
                  <div className="text-xs font-extrabold text-[#4A4A3A] mt-0.5">سند تأكيد {activeReceipt.userName}</div>
                  {activeReceipt.organizationName && (
                    <div className="text-[10px] text-[#8A8A70] mt-0.5">{activeReceipt.organizationName}</div>
                  )}
                </div>

                {/* Grid with info */}
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#8A8A70]">اسم بيت المؤتمرات:</span>
                    <span className="font-bold text-[#4A4A3A] text-left">{activeReceipt.houseName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8A8A70]">تاريخ الوصول:</span>
                    <span className="font-semibold text-[#4A4A3A]">{activeReceipt.checkIn}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8A8A70]">تاريخ المغادرة:</span>
                    <span className="font-semibold text-[#4A4A3A]">{activeReceipt.checkOut}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8A8A70]">عدد الأفراد المحجوز لهم:</span>
                    <span className="font-bold text-[#4A4A3A]">{activeReceipt.guestsCount} فرد</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8A8A70]">قيمة الدفع الكلية:</span>
                    <span className="font-extrabold text-[#4A4A3A]">{activeReceipt.totalPrice.toLocaleString()} ج.م</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-[#D6D6C2]">
                    <span className="text-[#8A8A70]">العربون المدفوع:</span>
                    <span className="font-bold text-emerald-700">
                      {activeReceipt.depositPaid ? `${activeReceipt.depositAmount} ج.م` : 'لم يتم دفع عربون'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8A8A70]">المبلغ المتبقي للدفع بالبيت:</span>
                    <span className="font-bold text-[#5A5A40]">
                      {activeReceipt.depositPaid 
                        ? `${activeReceipt.totalPrice - activeReceipt.depositAmount} ج.م` 
                        : `${activeReceipt.totalPrice} ج.م`}
                    </span>
                  </div>
                </div>

                <div className="bg-[#EBEBE0]/30 rounded-2xl p-3 border border-[#D6D6C2] text-[10px] text-[#8A8A70] leading-relaxed text-center space-y-1">
                  <p>يرجى تقديم هذا السند المطبوع أو عبر الموبايل لمسؤول الاستقبال عند الوصول للبيت لتسهيل عملية التسكين واستلام الغرف.</p>
                  <p className="font-semibold text-[#4A4A3A]">نتمنى لكم فترة خلوة مباركة ومثمرة روحيًا!</p>
                </div>
              </div>
            </div>

            {/* Receipt Footer */}
            <div className="bg-slate-50 p-4 border-t border-[#D6D6C2] flex gap-2 justify-end">
              <button
                id="receipt-pdf-btn"
                disabled={isExportingPDF}
                onClick={() => exportReceiptAsPDF(activeReceipt)}
                className="flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-950 border border-rose-200 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
              >
                <FileDown className="w-4 h-4 text-rose-700" />
                <span>{isExportingPDF ? 'جاري التصدير...' : 'تصدير كـ PDF 📄'}</span>
              </button>
              <button
                id="receipt-print-btn"
                onClick={() => {
                  window.print();
                }}
                className="flex items-center gap-1.5 bg-[#EBEBE0] hover:bg-[#DEDECB] text-[#4A4A3A] px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة السند</span>
              </button>
              <button
                id="receipt-close-btn"
                onClick={() => setActiveReceipt(null)}
                className="bg-[#5A5A40] hover:bg-[#4A4A3A] text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                إغلاق
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Smart Room Allocation Modal */}
      {activeAllocationBooking && (() => {
        const house = houses.find(h => h.id === activeAllocationBooking.houseId);
        if (!house) return null;
        // The owner assigns which rooms this group gets; the servant only fills
        // names inside those. If nothing's assigned yet, wait for the owner.
        const assignedIds = activeAllocationBooking.assignedRoomIds || [];
        const assignedRooms = assignedIds.map((id) => rooms.find((r) => r.id === id)).filter(Boolean) as Room[];
        if (assignedIds.length === 0) {
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setActiveAllocationBooking(null)}>
              <div className="bg-white rounded-3xl border border-[#D6D6C2] p-6 max-w-sm text-center space-y-2" dir="rtl" onClick={(e) => e.stopPropagation()}>
                <div className="text-3xl">🛏️</div>
                <h3 className="text-sm font-black text-[#2D2D24]">بانتظار تخصيص الغرف</h3>
                <p className="text-[11px] text-[#8A8A70] leading-relaxed">لسه صاحب البيت ماخصّصش غرف لمجموعتك. بمجرد ما يبعت الغرف، هتقدر تكتب أسماء المشاركين وتوزّعهم عليها من هنا.</p>
                <button type="button" onClick={() => setActiveAllocationBooking(null)} className="mt-2 bg-[#5A5A40] text-white text-xs font-black px-5 py-2.5 rounded-2xl">تمام</button>
              </div>
            </div>
          );
        }
        return (
          <RoomDistribution
            booking={activeAllocationBooking}
            house={house}
            currentUser={currentUser}
            houseRooms={assignedRooms}
            onClose={() => setActiveAllocationBooking(null)}
            globalAttendees={attendees}
            globalAllocations={allocations}
            onUpdateAttendees={onUpdateAttendees}
            onUpdateAllocations={onUpdateAllocations}
          />
        );
      })()}

      {/* Interactive Spiritual & Activity Retreat Planner Modal */}
      {activePlannerBooking && (() => {
        const bookingId = activePlannerBooking.id;
        const bookingChecklist = plannerChecklist[bookingId] || [];
        const bookingActs = customActivities[bookingId] || [];
        
        // Group activities by day
        const dayNumbers = Array.from(new Set<number>(bookingActs.map(a => a.day))).sort((a, b) => a - b);
        if (dayNumbers.length === 0) dayNumbers.push(1, 2, 3); // Fallback

        // Calculate progress stats
        const groupItems = bookingChecklist.filter(i => i.category === 'group');
        const personalItems = bookingChecklist.filter(i => i.category === 'personal');
        
        const groupChecked = groupItems.filter(i => i.checked).length;
        const personalChecked = personalItems.filter(i => i.checked).length;

        const totalItemsCount = bookingChecklist.length;
        const totalCheckedCount = bookingChecklist.filter(i => i.checked).length;
        const progressPercentage = totalItemsCount > 0 ? Math.round((totalCheckedCount / totalItemsCount) * 100) : 0;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 text-right">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setActivePlannerBooking(null)} />
            
            <div className="bg-[#FAF8F5] rounded-3xl w-full max-w-lg max-h-[88vh] flex flex-col shadow-2xl overflow-hidden border border-[#D6D6C2] relative z-10 animate-scale-up text-[#4A4A3A]">
              {/* Header */}
              <div className="bg-gradient-to-r from-[#4A4A3A] to-[#5A5A40] text-white px-5 py-4 flex items-center justify-between shadow-md">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                  <div className="text-right">
                    <h3 className="text-xs font-black">مخطط برنامج الخلوة والتحضيرات 📅</h3>
                    <p className="text-[9px] text-amber-100 font-medium">بيت {activePlannerBooking.houseName} • {activePlannerBooking.guestsCount} فرد</p>
                  </div>
                </div>
                <button
                  onClick={() => setActivePlannerBooking(null)}
                  className="p-1 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-all cursor-pointer"
                >
                  <XCircle className="w-4.5 h-4.5" />
                </button>
              </div>

              {/* Tab Selector */}
              <div className="bg-[#EBEBE0]/50 border-b border-[#D6D6C2] p-1.5 flex gap-1">
                <button
                  onClick={() => setPlannerTab('schedule')}
                  className={`flex-1 py-2 text-center text-[10.5px] font-black rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    plannerTab === 'schedule'
                      ? 'bg-white text-[#4A4A3A] shadow-xs border border-[#D6D6C2]'
                      : 'text-[#8A8A70] hover:text-[#4A4A3A]'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>البرنامج اليومي المقترح 📅</span>
                </button>
                <button
                  onClick={() => setPlannerTab('packing')}
                  className={`flex-1 py-2 text-center text-[10.5px] font-black rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    plannerTab === 'packing'
                      ? 'bg-white text-[#4A4A3A] shadow-xs border border-[#D6D6C2]'
                      : 'text-[#8A8A70] hover:text-[#4A4A3A]'
                  }`}
                >
                  <ListTodo className="w-3.5 h-3.5" />
                  <span>حقيبة وتجهيزات الرحلة 🧳</span>
                </button>
              </div>

              {/* Scrollable Content Body */}
              <div className="p-4 flex-1 overflow-y-auto space-y-4">
                
                {/* 1. Schedule Tab */}
                {plannerTab === 'schedule' && (
                  <div className="space-y-4">
                    {/* Theme selector info */}
                    <div className="bg-amber-50/70 border border-amber-200/60 p-3 rounded-2xl text-[10px] leading-relaxed">
                      <span className="font-extrabold text-[#5A5A40] block mb-1">💡 اختر الطابع الروحي المناسب لخدمتكم لتوليد برنامج تلقائي:</span>
                      
                      <div className="grid grid-cols-3 gap-1.5 mt-2">
                        <button
                          onClick={() => changeThemeTemplate(bookingId, 'growth')}
                          className={`py-1.5 px-2 rounded-lg text-[9px] font-bold text-center transition-all cursor-pointer border ${
                            plannerTheme === 'growth'
                              ? 'bg-[#5A5A40] border-[#5A5A40] text-white shadow-xs'
                              : 'bg-white border-[#D6D6C2] text-[#8A8A70] hover:text-[#4A4A3A]'
                          }`}
                        >
                          🌟 روحي وعقيدي
                        </button>
                        <button
                          onClick={() => changeThemeTemplate(bookingId, 'fellowship')}
                          className={`py-1.5 px-2 rounded-lg text-[9px] font-bold text-center transition-all cursor-pointer border ${
                            plannerTheme === 'fellowship'
                              ? 'bg-[#5A5A40] border-[#5A5A40] text-white shadow-xs'
                              : 'bg-white border-[#D6D6C2] text-[#8A8A70] hover:text-[#4A4A3A]'
                          }`}
                        >
                          🎉 تعارف ومحبة
                        </button>
                        <button
                          onClick={() => changeThemeTemplate(bookingId, 'saints')}
                          className={`py-1.5 px-2 rounded-lg text-[9px] font-bold text-center transition-all cursor-pointer border ${
                            plannerTheme === 'saints'
                              ? 'bg-[#5A5A40] border-[#5A5A40] text-white shadow-xs'
                              : 'bg-white border-[#D6D6C2] text-[#8A8A70] hover:text-[#4A4A3A]'
                          }`}
                        >
                          ⛪ آباء وقديسين
                        </button>
                      </div>
                    </div>

                    {/* Meal Fasting Suggestion Card */}
                    <div className="bg-emerald-50/60 border border-emerald-200/50 p-2.5 rounded-2xl flex items-center justify-between text-[9px]">
                      <div className="flex items-center gap-1.5 text-[#3D5E4E]">
                        <BookOpen className="w-4 h-4 shrink-0 text-emerald-700" />
                        <div>
                          <span className="font-extrabold block text-[10px]">قائمة الطعام والوجبات المقترحة للمجموعة:</span>
                          <span className="font-medium text-[#5A7E6E]">بناءً على أيام الأسبوع، نقترح تجهيز وجبات كنسية خفيفة وسهلة التحضير.</span>
                        </div>
                      </div>
                      <span className="bg-emerald-200/50 text-emerald-950 font-black px-2 py-1 rounded-md shrink-0">صيامي / فطاري 🍲</span>
                    </div>

                    {/* Daily Activities Schedule list */}
                    <div className="space-y-4">
                      {dayNumbers.map((dayNum) => {
                        const dayActs = bookingActs.filter(a => a.day === dayNum);
                        return (
                          <div key={dayNum} className="bg-white rounded-2xl border border-[#D6D6C2] p-3 space-y-2.5 shadow-xs">
                            <div className="flex justify-between items-center border-b border-[#EBEBE0] pb-1.5">
                              <span className="text-xs font-black text-[#5A5A40] flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5 text-amber-600" />
                                <span>اليوم ال{dayNum === 1 ? 'أول' : dayNum === 2 ? 'ثاني' : dayNum === 3 ? 'ثالث' : dayNum}</span>
                              </span>
                              
                              <button
                                onClick={() => addActivity(bookingId, dayNum)}
                                className="text-[#5A5A40] hover:text-emerald-700 text-[9px] font-black hover:underline flex items-center gap-0.5 cursor-pointer"
                              >
                                <Plus className="w-3 h-3" />
                                <span>إضافة فقرة للبرنامج</span>
                              </button>
                            </div>

                            {/* Activities Rows */}
                            {dayActs.length === 0 ? (
                              <p className="text-[9.5px] text-[#8A8A70] text-center py-2 font-bold">لا توجد فقرات مسجلة لبرنامج هذا اليوم حالياً.</p>
                            ) : (
                              <div className="space-y-1.5">
                                {dayActs.map((act) => (
                                  <div key={act.id} className="flex gap-1.5 items-center bg-[#FAF8F5] p-1.5 rounded-xl border border-[#D6D6C2]/35">
                                    {/* Time Input */}
                                    <input
                                      type="text"
                                      value={act.time}
                                      onChange={(e) => updateActivity(bookingId, act.id, 'time', e.target.value)}
                                      className="w-16 bg-white border border-[#D6D6C2] rounded-lg px-1.5 py-1 text-[9px] text-center font-bold text-[#4A4A3A] focus:ring-1 focus:ring-[#5A5A40] focus:outline-none"
                                      title="وقت الفقرة"
                                    />
                                    
                                    {/* Activity Text Input */}
                                    <input
                                      type="text"
                                      value={act.activity}
                                      onChange={(e) => updateActivity(bookingId, act.id, 'activity', e.target.value)}
                                      className="flex-1 bg-white border border-[#D6D6C2] rounded-lg px-2 py-1 text-[9.5px] font-semibold text-[#4A4A3A] focus:ring-1 focus:ring-[#5A5A40] focus:outline-none"
                                      title="تفاصيل ومسمى النشاط"
                                    />

                                    {/* Delete slot button */}
                                    <button
                                      onClick={() => deleteActivity(bookingId, act.id)}
                                      className="p-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                      title="حذف هذه الفقرة"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 2. Packing Checklist Tab */}
                {plannerTab === 'packing' && (
                  <div className="space-y-4">
                    {/* Progress indicator */}
                    <div className="bg-white rounded-2xl border border-[#D6D6C2] p-3 shadow-xs space-y-1.5">
                      <div className="flex justify-between text-[10px] font-black">
                        <span>معدل جاهزية تحضير الرحلة كنسيًا وشخصيًا:</span>
                        <span className="text-amber-700">{progressPercentage}% ({totalCheckedCount} من أصل {totalItemsCount})</span>
                      </div>
                      <div className="w-full bg-[#EBEBE0] h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-gradient-to-r from-amber-500 to-emerald-600 h-full transition-all duration-300"
                          style={{ width: `${progressPercentage}%` }}
                        />
                      </div>
                      <p className="text-[8.5px] text-[#8A8A70] leading-relaxed">تجهيز الأغراض يضمن عدم نسيان الأساسيات والاحتياجات الطقسية للخدام والمخدومين.</p>
                    </div>

                    {/* Group Items Section (للخدام) */}
                    <div className="space-y-2">
                      <h4 className="text-[10px] font-black text-[#5A5A40] flex items-center gap-1 pl-2">
                        <Users className="w-3.5 h-3.5 text-amber-600" />
                        <span>الأغراض وتجهيزات الخدمة المشتركة (للخدام):</span>
                      </h4>

                      {/* Add Group Item form */}
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={newGroupText}
                          onChange={(e) => setNewGroupText(e.target.value)}
                          placeholder="إضافة غرض خدمة مشترك (مثل: قربان، هدايا...)"
                          className="flex-1 bg-white border border-[#D6D6C2] rounded-xl px-2.5 py-1.5 text-[9.5px] font-bold focus:ring-1 focus:ring-[#5A5A40] focus:outline-none"
                        />
                        <button
                          onClick={() => {
                            addChecklistItem(bookingId, newGroupText, 'group');
                            setNewGroupText('');
                          }}
                          className="bg-[#5A5A40] hover:bg-[#4A4A3A] text-white text-[9.5px] font-black px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
                        >
                          إضافة
                        </button>
                      </div>

                      {/* Group list */}
                      <div className="bg-white rounded-2xl border border-[#D6D6C2] overflow-hidden shadow-xs divide-y divide-[#EBEBE0]/60">
                        {groupItems.length === 0 ? (
                          <p className="p-3 text-[9.5px] text-[#8A8A70] text-center font-bold">لا توجد أغراض مسجلة هنا.</p>
                        ) : (
                          groupItems.map(item => (
                            <div key={item.id} className="p-2.5 flex items-center justify-between hover:bg-[#FAF8F5] transition-colors gap-2">
                              <button
                                onClick={() => toggleChecklistItem(bookingId, item.id)}
                                className="flex-1 text-right flex items-start gap-2 cursor-pointer"
                              >
                                <span className={`w-4.5 h-4.5 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                                  item.checked 
                                    ? 'bg-emerald-600 border-emerald-600 text-white' 
                                    : 'border-[#D6D6C2] bg-white'
                                }`}>
                                  {item.checked && <Check className="w-3 h-3 stroke-[3]" />}
                                </span>
                                <span className={`text-[9.5px] font-bold leading-relaxed ${item.checked ? 'line-through text-[#8A8A70]' : 'text-[#4A4A3A]'}`}>
                                  {item.text}
                                </span>
                              </button>

                              <button
                                onClick={() => deleteChecklistItem(bookingId, item.id)}
                                className="text-[#8A8A70] hover:text-rose-600 p-1 rounded-md hover:bg-rose-50 transition-colors cursor-pointer"
                                title="حذف"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Personal Items Section (للأفراد) */}
                    <div className="space-y-2">
                      <h4 className="text-[10px] font-black text-[#5A5A40] flex items-center gap-1 pl-2">
                        <BookOpen className="w-3.5 h-3.5 text-[#5A5A40]" />
                        <span>الأغراض الشخصية الفردية (لكل مخدوم وخادم):</span>
                      </h4>

                      {/* Add Personal Item form */}
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={newPersonalText}
                          onChange={(e) => setNewPersonalText(e.target.value)}
                          placeholder="إضافة غرض شخصي فردي (مثل: كاب للشمس، أدوية...)"
                          className="flex-1 bg-white border border-[#D6D6C2] rounded-xl px-2.5 py-1.5 text-[9.5px] font-bold focus:ring-1 focus:ring-[#5A5A40] focus:outline-none"
                        />
                        <button
                          onClick={() => {
                            addChecklistItem(bookingId, newPersonalText, 'personal');
                            setNewPersonalText('');
                          }}
                          className="bg-[#5A5A40] hover:bg-[#4A4A3A] text-white text-[9.5px] font-black px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
                        >
                          إضافة
                        </button>
                      </div>

                      {/* Personal list */}
                      <div className="bg-white rounded-2xl border border-[#D6D6C2] overflow-hidden shadow-xs divide-y divide-[#EBEBE0]/60">
                        {personalItems.length === 0 ? (
                          <p className="p-3 text-[9.5px] text-[#8A8A70] text-center font-bold">لا توجد أغراض فردية مسجلة هنا.</p>
                        ) : (
                          personalItems.map(item => (
                            <div key={item.id} className="p-2.5 flex items-center justify-between hover:bg-[#FAF8F5] transition-colors gap-2">
                              <button
                                onClick={() => toggleChecklistItem(bookingId, item.id)}
                                className="flex-1 text-right flex items-start gap-2 cursor-pointer"
                              >
                                <span className={`w-4.5 h-4.5 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                                  item.checked 
                                    ? 'bg-[#5A5A40] border-[#5A5A40] text-white' 
                                    : 'border-[#D6D6C2] bg-white'
                                }`}>
                                  {item.checked && <Check className="w-3 h-3 stroke-[3]" />}
                                </span>
                                <span className={`text-[9.5px] font-bold leading-relaxed ${item.checked ? 'line-through text-[#8A8A70]' : 'text-[#4A4A3A]'}`}>
                                  {item.text}
                                </span>
                              </button>

                              <button
                                onClick={() => deleteChecklistItem(bookingId, item.id)}
                                className="text-[#8A8A70] hover:text-rose-600 p-1 rounded-md hover:bg-rose-50 transition-colors cursor-pointer"
                                title="حذف"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="bg-[#EBEBE0] p-3 text-center border-t border-[#D6D6C2] flex justify-between items-center gap-2">
                <button
                  onClick={() => {
                    window.print();
                  }}
                  className="bg-white border border-[#D6D6C2] text-[#4A4A3A] hover:bg-[#FAF8F5] text-[10.5px] font-black px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1 shadow-xs"
                >
                  <Printer className="w-4 h-4 text-slate-700" />
                  <span>طباعة البرنامج والتحضيرات 🖨️</span>
                </button>

                <button
                  onClick={() => setActivePlannerBooking(null)}
                  className="bg-[#5A5A40] hover:bg-[#4A4A3A] text-white text-[10.5px] font-black px-5 py-2 rounded-xl transition-all cursor-pointer"
                >
                  إغلاق التخطيط
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Smart Room Allocation Modal */}
      {activeAllocationBooking && (() => {
        const house = houses.find(h => h.id === activeAllocationBooking.houseId);
        if (!house) return null;
        // The owner assigns which rooms this group gets; the servant only fills
        // names inside those. If nothing's assigned yet, wait for the owner.
        const assignedIds = activeAllocationBooking.assignedRoomIds || [];
        const assignedRooms = assignedIds.map((id) => rooms.find((r) => r.id === id)).filter(Boolean) as Room[];
        if (assignedIds.length === 0) {
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setActiveAllocationBooking(null)}>
              <div className="bg-white rounded-3xl border border-[#D6D6C2] p-6 max-w-sm text-center space-y-2" dir="rtl" onClick={(e) => e.stopPropagation()}>
                <div className="text-3xl">🛏️</div>
                <h3 className="text-sm font-black text-[#2D2D24]">بانتظار تخصيص الغرف</h3>
                <p className="text-[11px] text-[#8A8A70] leading-relaxed">لسه صاحب البيت ماخصّصش غرف لمجموعتك. بمجرد ما يبعت الغرف، هتقدر تكتب أسماء المشاركين وتوزّعهم عليها من هنا.</p>
                <button type="button" onClick={() => setActiveAllocationBooking(null)} className="mt-2 bg-[#5A5A40] text-white text-xs font-black px-5 py-2.5 rounded-2xl">تمام</button>
              </div>
            </div>
          );
        }
        return (
          <RoomDistribution
            booking={activeAllocationBooking}
            house={house}
            currentUser={currentUser}
            houseRooms={assignedRooms}
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
