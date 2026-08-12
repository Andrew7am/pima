import React, { useState, useMemo, useEffect } from 'react';
import { arabicNumber } from '../lib/arabic';
import { RetreatHouse, Booking, Review, User, Room, RoomType, Announcement, WaitlistEntry, PlatformSettings, DEFAULT_PLATFORM_SETTINGS } from '../types';
import HouseHero from './house/HouseHero';
import HouseLocationTrust from './house/HouseLocationTrust';
import HouseReviews from './house/HouseReviews';
import PimaSheet from './PimaSheet';
import { ExploreSection, ExploreCard } from './house/HouseExplore';
import BookingFlow, { ApplicantDetails } from './house/BookingFlow';
import { tapFeedback } from '../lib/haptics';
import ReviewWizard from './ReviewWizard';
import { computeStayPrice, offersDayUse, computeMealPlan, activeDiscountFor, applyDiscount } from '../lib/pricing';
import { buildPriestQuote, printPriestQuote } from '../lib/priestQuote';
import { buildRoomOfferings } from '../lib/roomOffering';
import { bookingRef } from '../lib/bookingRef';
import { getCapacityStatus, occupiedEnd } from '../lib/roomOccupancy';
import { 
  BedDouble, Calendar, Users, 
  DollarSign, Check, Award, Flame, MessageSquare, Star, 
  Utensils, Volume2, Monitor, HelpCircle, Send,
  Sun, Cloud, CloudSun, CloudRain, Thermometer, Droplets, Wind, Phone, Copy,
  Calculator, TrendingDown, Coins, Bus, ChevronDown, ChevronLeft, ShieldCheck, CalendarDays,
  Info, Tag, Lock, Church, Theater, Lightbulb, Sparkles, DoorOpen
} from 'lucide-react';
import { SUITABILITY_MAP } from '../mockData';

interface HouseDetailProps {
  house: RetreatHouse;
  currentUser: User | null; // null = logged-out visitor browsing publicly
  bookings: Booking[];
  reviews: Review[];
  onBack: () => void;
  onBook: (booking: Booking, pointsRedeemed?: number) => Promise<boolean> | boolean | void;
  onSubmitReview: (review: Review) => void;
  onUpdateMenu?: (houseId: string, updatedMenu: any) => void;
  isFavorited: boolean;
  onToggleFavorite: (houseId: string) => void;
  rooms?: Room[];
  /** The owner-defined room types, when they have any. Without these the
   *  page falls back to grouping their real rooms by size. */
  roomTypes?: RoomType[];
  announcements?: Announcement[];
  waitlist?: WaitlistEntry[];
  onJoinWaitlist?: (entry: WaitlistEntry) => boolean;
  settings?: PlatformSettings;
  // Read-only admin preview (pending-house review) — the booking/review
  // forms still render (so admin can see exactly what a guest would),
  // but submitting is a no-op instead of creating a real record.
  previewMode?: boolean;
  // Guest mode: called instead of submitting when there's no logged-in user
  onRequireLogin?: () => void;
  /** After a request is sent: «متابعة الطلب» and «العودة للرئيسية». */
  onNavigateBookings?: () => void;
  onNavigateHome?: () => void;
}

// Illustrative food spread for the menu card — same practice as the room-type
// cards below, which already use curated Unsplash shots. House photos are of
// the property, not the table, so the card would otherwise show a building
// over the word «الطعام».
const FOOD_CARD_IMAGE = 'https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&w=800&q=80';

// Weather card kill-switch — hidden for now at the owner's request, kept
// compiled so it comes back with one word.
const SHOW_WEATHER_CARD = false;

const GOVERNORATE_WEATHER_DATA: Record<string, {
  currentTemp: number;
  humidity: number;
  windSpeed: number;
  conditionText: string;
  recommendation: string;
  forecast: {
    date: string;
    dayName: string;
    tempHigh: number;
    tempLow: number;
    condition: string;
    icon: 'sun' | 'cloud-sun' | 'cloud-rain' | 'cloud' | 'wind';
  }[];
}> = {
  'الإسكندرية': {
    currentTemp: 30,
    humidity: 65,
    windSpeed: 18,
    conditionText: 'صافٍ مع نسيم بحر معتدل',
    recommendation: 'أجواء ساحلية منعشة وممتازة لقضاء العطلة والتأمل. يُنصح بارتداء ملابس قطنية خفيفة ومريحة.',
    forecast: [
      { date: '28 يونيو', dayName: 'اليوم', tempHigh: 30, tempLow: 22, condition: 'صافٍ ولطيف', icon: 'sun' },
      { date: '29 يونيو', dayName: 'الإثنين', tempHigh: 31, tempLow: 23, condition: 'صافٍ مشمس', icon: 'sun' },
      { date: '30 يونيو', dayName: 'الثلاثاء', tempHigh: 31, tempLow: 22, condition: 'نسيم لطيف', icon: 'wind' }
    ]
  },
  'البحيرة': {
    currentTemp: 34,
    humidity: 45,
    windSpeed: 14,
    conditionText: 'مشمس وصافٍ تماماً',
    recommendation: 'الطقس دافئ ومثالي لزيارة الأديرة الروحية والتأمل بالصحراء. احرص على شرب المياه الكافية نهاراً.',
    forecast: [
      { date: '28 يونيو', dayName: 'اليوم', tempHigh: 34, tempLow: 22, condition: 'مشمس', icon: 'sun' },
      { date: '29 يونيو', dayName: 'الإثنين', tempHigh: 35, tempLow: 23, condition: 'صافٍ', icon: 'sun' },
      { date: '30 يونيو', dayName: 'الثلاثاء', tempHigh: 36, tempLow: 23, condition: 'حار قليلاً', icon: 'sun' }
    ]
  },
  'الفيوم': {
    currentTemp: 35,
    humidity: 35,
    windSpeed: 12,
    conditionText: 'حار نهاراً ومعتدل ليلاً',
    recommendation: 'الطقس رائع لرحلات بحيرة قارون ووادي الريان. يُنصح بتجنب التعرض المباشر للشمس في فترات الظهيرة.',
    forecast: [
      { date: '28 يونيو', dayName: 'اليوم', tempHigh: 35, tempLow: 23, condition: 'مشمس', icon: 'sun' },
      { date: '29 يونيو', dayName: 'الإثنين', tempHigh: 36, tempLow: 24, condition: 'مشمس', icon: 'sun' },
      { date: '30 يونيو', dayName: 'الثلاثاء', tempHigh: 37, tempLow: 24, condition: 'صافٍ مشمس', icon: 'sun' }
    ]
  },
  'السويس': {
    currentTemp: 33,
    humidity: 50,
    windSpeed: 16,
    conditionText: 'مشمس مع نسيم القناة',
    recommendation: 'الطقس مشمس ومناسب للأنشطة والرياضات المائية والندوات الخارجية المظللة.',
    forecast: [
      { date: '28 يونيو', dayName: 'اليوم', tempHigh: 33, tempLow: 24, condition: 'مشمس', icon: 'sun' },
      { date: '29 يونيو', dayName: 'الإثنين', tempHigh: 34, tempLow: 24, condition: 'صافٍ', icon: 'sun' },
      { date: '30 يونيو', dayName: 'الثلاثاء', tempHigh: 35, tempLow: 25, condition: 'مشمس ولطيف', icon: 'sun' }
    ]
  },
  'القاهرة': {
    currentTemp: 35,
    humidity: 40,
    windSpeed: 11,
    conditionText: 'صافٍ ومشمش نهاراً معتدل ليلاً',
    recommendation: 'طقس صيفي رائع ومناسب لكافة اللقاءات التفاعلية وحفلات الشواء في حدائق البيوت الخارجية.',
    forecast: [
      { date: '28 يونيو', dayName: 'اليوم', tempHigh: 35, tempLow: 24, condition: 'صافٍ', icon: 'sun' },
      { date: '29 يونيو', dayName: 'الإثنين', tempHigh: 36, tempLow: 25, condition: 'مشمس وصافٍ', icon: 'sun' },
      { date: '30 يونيو', dayName: 'الثلاثاء', tempHigh: 37, tempLow: 25, condition: 'صافٍ', icon: 'sun' }
    ]
  },
  'الجيزة': {
    currentTemp: 35,
    humidity: 40,
    windSpeed: 11,
    conditionText: 'صافٍ ومشمش نهاراً معتدل ليلاً',
    recommendation: 'أجواء مثالية للاجتماعات والخدمة في المساحات الخارجية. احرص على أخذ قبعات الشمس أثناء جولات الظهر.',
    forecast: [
      { date: '28 يونيو', dayName: 'اليوم', tempHigh: 35, tempLow: 24, condition: 'صافٍ', icon: 'sun' },
      { date: '29 يونيو', dayName: 'الإثنين', tempHigh: 36, tempLow: 25, condition: 'مشمس وصافٍ', icon: 'sun' },
      { date: '30 يونيو', dayName: 'الثلاثاء', tempHigh: 37, tempLow: 25, condition: 'صافٍ', icon: 'sun' }
    ]
  },
  'المنيا': {
    currentTemp: 38,
    humidity: 25,
    windSpeed: 10,
    conditionText: 'حار وجاف نهاراً ولطيف ليلاً',
    recommendation: 'يُنصح بإقامة الألعاب والندوات الرياضية المفتوحة في الصباح الباكر أو بعد غروب الشمس لتفادي حرارة الظهر.',
    forecast: [
      { date: '28 يونيو', dayName: 'اليوم', tempHigh: 38, tempLow: 25, condition: 'حار وجاف', icon: 'sun' },
      { date: '29 يونيو', dayName: 'الإثنين', tempHigh: 39, tempLow: 26, condition: 'مشمس جداً', icon: 'sun' },
      { date: '30 يونيو', dayName: 'الثلاثاء', tempHigh: 40, tempLow: 26, condition: 'حار مشمس', icon: 'sun' }
    ]
  },
  'أسيوط': {
    currentTemp: 38,
    humidity: 25,
    windSpeed: 10,
    conditionText: 'حار وجاف نهاراً ولطيف ليلاً',
    recommendation: 'الطقس مشمس وصيفي مميز. يفضل شرب كميات وفيرة من السوائل واستخدام الغرف المكيفة خلال فترات الظهر.',
    forecast: [
      { date: '28 يونيو', dayName: 'اليوم', tempHigh: 38, tempLow: 25, condition: 'حار وجاف', icon: 'sun' },
      { date: '29 يونيو', dayName: 'الإثنين', tempHigh: 39, tempLow: 26, condition: 'مشمس جداً', icon: 'sun' },
      { date: '30 يونيو', dayName: 'الثلاثاء', tempHigh: 40, tempLow: 26, condition: 'حار مشمس', icon: 'sun' }
    ]
  },
  'الاسماعيلية': {
    currentTemp: 33,
    humidity: 55,
    windSpeed: 15,
    conditionText: 'مشمس وصافٍ مع رطوبة متوسطة',
    recommendation: 'الأجواء منعشة ولطيفة للغاية لممارسة الرياضة والمشي بالحدائق نهاراً واجتماعات السمر ليلاً.',
    forecast: [
      { date: '28 يونيو', dayName: 'اليوم', tempHigh: 33, tempLow: 23, condition: 'صافٍ', icon: 'sun' },
      { date: '29 يونيو', dayName: 'الإثنين', tempHigh: 34, tempLow: 24, condition: 'مشمس', icon: 'sun' },
      { date: '30 يونيو', dayName: 'الثلاثاء', tempHigh: 35, tempLow: 24, condition: 'صافٍ مشمس', icon: 'sun' }
    ]
  },
  'جنوب سيناء': {
    currentTemp: 29,
    humidity: 30,
    windSpeed: 15,
    conditionText: 'هواء نقي معتدل وجاف',
    recommendation: 'الطقس جاف ولطيف جداً خصوصاً في المناطق المرتفعة كسانت كاترين. مثالي للصلوات الصامتة والمسير والخلوات.',
    forecast: [
      { date: '28 يونيو', dayName: 'اليوم', tempHigh: 29, tempLow: 18, condition: 'منعش وصافٍ', icon: 'cloud-sun' },
      { date: '29 يونيو', dayName: 'الإثنين', tempHigh: 30, tempLow: 19, condition: 'صافٍ ولطيف', icon: 'sun' },
      { date: '30 يونيو', dayName: 'الثلاثاء', tempHigh: 31, tempLow: 19, condition: 'معتدل تماماً', icon: 'sun' }
    ]
  },
  'البحر الأحمر': {
    currentTemp: 36,
    humidity: 38,
    windSpeed: 22,
    conditionText: 'مشمس مع رياح تلطيفية نشطة',
    recommendation: 'الرياح النشطة تجعل التواجد على البحر وحمام السباحة تجربة ساحرة. تجنب التعرض للشمس المباشرة طويلاً.',
    forecast: [
      { date: '28 يونيو', dayName: 'اليوم', tempHigh: 36, tempLow: 26, condition: 'رياح منعشة', icon: 'wind' },
      { date: '29 يونيو', dayName: 'الإثنين', tempHigh: 37, tempLow: 27, condition: 'صافٍ مشمس', icon: 'sun' },
      { date: '30 يونيو', dayName: 'الثلاثاء', tempHigh: 37, tempLow: 26, condition: 'مشمس وصافٍ', icon: 'sun' }
    ]
  }
};

const DEFAULT_WEATHER = {
  currentTemp: 34,
  humidity: 45,
  windSpeed: 12,
  conditionText: 'مشمس ومعتدل',
  recommendation: 'الطقس معتدل ومناسب جداً للرحلات والاجتماعات الخارجية. يُنصح بارتداء قبعات الشمس وتناول المياه بكثرة.',
  forecast: [
    { date: '28 يونيو', dayName: 'اليوم', tempHigh: 34, tempLow: 23, condition: 'صافٍ', icon: 'sun' as const },
    { date: '29 يونيو', dayName: 'الإثنين', tempHigh: 35, tempLow: 24, condition: 'مشمس', icon: 'sun' as const },
    { date: '30 يونيو', dayName: 'الثلاثاء', tempHigh: 36, tempLow: 24, condition: 'صافٍ', icon: 'sun' as const }
  ]
};

const DEFAULT_FASTING_MENU = [
  { day: 'السبت', breakfast: 'فول مدمس بالزيت الحار وطعمية سخنة وعيش بلدي مخلل وسلطة', lunch: 'طاجن تورلي صيامي بالفرن، أرز بالشعرية، شوربة خضار كنسية سادة وجرجير طازج', dinner: 'بطاطس مسلوقة ومهروسة بزيت زيتون وبابا غنوج متبل وطماطم بلدي بالخل والثوم', price: 110 },
  { day: 'الأحد', breakfast: 'بطاطس محمرة متبلة بالزعتر وتونة صيامي بقطع البصل والليمون والخل وجرجير وعيش دافئ', lunch: 'سمك فيليه صيامي مقلي مقرمش وأرز بني صيادية وسلطة خضراء بلدي وطحينة', dinner: 'حلاوة طحينية فاخرة ومربى فراولة بلدي وعسل أسود بالطحينة السمسم وعيش بلدي', price: 130 },
  { day: 'الاثنين', breakfast: 'فول مدمس بالليمون والكمون وجبنة صيامي نباتية بالطماطم وخيار بلدي مقرمش', lunch: 'كوشري مصري أصيل متكامل بالدقة والصلصة والمشروم المقلي والتقلية المقرمشة', dinner: 'باذنجان مقلي بالخل والثوم والبهارات وبطاطس محمرة ومخلل لفت بيتي', price: 100 },
  { day: 'الثلاثاء', breakfast: 'طعمية بيتي سخنة بالسمسم وبابا غنوج وبطاطس بوريه بالزيت والكمون وعيش دافئ', lunch: 'رقاق صيامي محشو بالخضار والبسلة والمشروم ومحشي كرنب وورق عنب صيامي بالزيت', dinner: 'كورن فليكس بلبن جوز الهند الطبيعي وسلطة فواكه الموسم المشكلة اللذيذة', price: 120 },
  { day: 'الأربعاء', breakfast: 'فول مدمس بالطماطم والزيت الحار وزيتون تفاحي أسود وجرجير طازج وعيش سخن', lunch: 'مسقعة صيامي بالباذنجان الرومي والفلفل الحار والصلصة وأرز أبيض وسلطة طماطم متبلة', dinner: 'تونة قطع مصفاة من الزيت بالليمون والكمون وشرائح فلفل ألوان وخيار مقرمش', price: 115 },
  { day: 'الخميس', breakfast: 'قرص صيامي بالسمسم والعجوة وشاي سادة دافئ بالنعناع ومربى التين والبرتقال', lunch: 'سمك بوري مشوي بالردة وأرز صيادية بالبصل وسلطة جرجير وطحينة وبصل أخضر فرش', dinner: 'بطاطس مسلوقة ومهروسة بالبقدونس وزيت الزيتون البكر وبابا غنوج متبل وعيش سن دافئ', price: 135 },
  { day: 'الجمعة', breakfast: 'طعمية سخنة بالكزبرة وفول بالخلطة الإسكندراني الحارة وباذنجان مخلل وجرجير', lunch: 'صينية بطاطس صيامي بالفرن بالمشروم والبهارات الطازجة وأرز حبة وحبة وشوربة خضار', dinner: 'عشاء صيامي خفيف: أجبان نباتية صيامي وعسل أسود بالطحينة وخيار وطماطم وعيش بلدي', price: 125 }
];

const getWeatherIcon = (iconName: string) => {
  switch (iconName) {
    case 'sun':
      return <Sun className="w-4 h-4 text-[var(--ds-warning)] fill-[color-mix(in_srgb,var(--ds-warning)_16%,transparent)] animate-pulse shrink-0" />;
    case 'cloud-sun':
      return <CloudSun className="w-4 h-4 text-[var(--ds-warning)] shrink-0" />;
    case 'cloud':
      return <Cloud className="w-4 h-4 text-[var(--ds-text-faint)] shrink-0" />;
    case 'cloud-rain':
      return <CloudRain className="w-4 h-4 text-blue-500 shrink-0" />;
    case 'wind':
      return <Wind className="w-4 h-4 text-teal-500 shrink-0" />;
    default:
      return <Sun className="w-4 h-4 text-[var(--ds-warning)] shrink-0" />;
  }
};

interface BookedRange { checkIn: string; checkOut: string; status: 'approved' | 'pending'; }

interface DateRangePickerProps {
  checkIn: string;
  setCheckIn: (val: string) => void;
  checkOut: string;
  setCheckOut: (val: string) => void;
  isMonthlyHousing?: boolean;
  bookedRanges?: BookedRange[];
  blockedDates?: string[];
  /** Draw the calendar straight into the parent instead of behind a trigger
   *  and a modal of its own — used when it is already inside a sheet, where
   *  the extra step meant tapping twice to reach the dates. */
  inline?: boolean;
  /** Lets check-out equal check-in — a «يوم روحي». Off unless the house has
   *  actually priced one, or a guest could pick a day that costs nothing. */
  allowSameDay?: boolean;
  /** Day mode: one tap IS the whole stay. Choosing a day retreat by tapping
   *  the same square twice is a thing nobody discovers. */
  singleDay?: boolean;
  /** Called when the inline calendar is done, so the sheet can close itself. */
  onDone?: () => void;
}

// Sunday-first, matching JS getDay(), so index 0 is الأحد. Both calendars in
// this file print this row and both offset their first cell by getDay(), so
// every date sits under its real weekday.
const WEEKDAY_INITIALS = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'];

// ── Dates the booking form opens on ──────────────────────────────────────
// Everything here is relative to the day the page is opened. The previous
// literals ('2026-07-15' etc.) were correct only until that date passed;
// after it, every visitor arrived on a form pointed at the past.
//
// Local date parts, not toISOString(): Egypt is UTC+2/+3, so the UTC day can
// already be tomorrow late in the evening.
function localISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysFromToday(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return localISODate(d);
}

export function isMonthlyStay(propertyType?: string): boolean {
  return propertyType === 'student' || propertyType === 'staff';
}

/** Student and staff housing is let by the month, so it starts on a 1st. */
function firstOfNextMonth(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1, 1);
  return localISODate(d);
}

/** …and runs to the end of the academic year, the next 30 June ahead of us. */
function endOfAcademicYear(): string {
  const now = new Date();
  const year = now.getMonth() >= 5 ? now.getFullYear() + 1 : now.getFullYear();
  return `${year}-06-30`;
}

// Returns all dates (YYYY-MM-DD) within [start, end] inclusive
function expandRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const cur = new Date(start);
  const last = new Date(end);
  while (cur <= last) {
    dates.push(cur.toISOString().split('T')[0]);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

const DateRangePicker = ({
  checkIn,
  setCheckIn,
  checkOut,
  setCheckOut,
  isMonthlyHousing = false,
  bookedRanges = [],
  blockedDates = [],
  inline = false,
  allowSameDay = false,
  singleDay = false,
  onDone,
}: DateRangePickerProps) => {
  // Inline mode has no trigger to press, so it starts open and stays open.
  const [isOpen, setIsOpen] = useState(inline);

  const [visibleDate, setVisibleDate] = useState(() => {
    const d = checkIn ? new Date(checkIn) : new Date();
    return isNaN(d.getTime()) ? new Date() : d;
  });

  // Build sets of booked/pending/blocked days for O(1) lookup
  const approvedDays = useMemo(() => {
    const set = new Set<string>();
    bookedRanges.filter(r => r.status === 'approved').forEach(r => expandRange(r.checkIn, r.checkOut).forEach(d => set.add(d)));
    blockedDates.forEach(d => set.add(d));
    return set;
  }, [bookedRanges, blockedDates]);

  const pendingDays = useMemo(() => {
    const set = new Set<string>();
    bookedRanges.filter(r => r.status === 'pending').forEach(r => expandRange(r.checkIn, r.checkOut).forEach(d => set.add(d)));
    return set;
  }, [bookedRanges]);

  // Local, not toISOString(): Cairo is UTC+2/+3, so between midnight and 2am
  // the UTC date is still yesterday — and yesterday would stay clickable.
  const today = localISODate(new Date());

  const year = visibleDate.getFullYear();
  const month = visibleDate.getMonth();

  const formatDateToShow = (dateStr: string) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  };

  const formattedRange = checkIn && checkOut
    ? `${formatDateToShow(checkIn)} - ${formatDateToShow(checkOut)}`
    : 'اختر فترة الإقامة';

  const prevMonth = () => {
    setVisibleDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setVisibleDate(new Date(year, month + 1, 1));
  };

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();

  const days = [];
  for (let i = 0; i < firstDayIndex; i++) {
    days.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(d);
  }

  const handleDayClick = (dayNum: number) => {
    const clickedDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    if (approvedDays.has(clickedDateStr) || clickedDateStr < today) return;

    // A day retreat is one tap. The two-tap range dance exists to express a
    // span; there is no span here, and asking for the same square twice is a
    // gesture nobody finds on their own.
    if (singleDay) {
      setCheckIn(clickedDateStr);
      setCheckOut(clickedDateStr);
      return;
    }

    if (!checkIn || (checkIn && checkOut)) {
      setCheckIn(clickedDateStr);
      setCheckOut('');
    } else {
      if (clickedDateStr < checkIn) {
        setCheckIn(clickedDateStr);
      } else if (clickedDateStr === checkIn && !allowSameDay) {
        // Tapping the same day twice used to set check-out equal to check-in,
        // which priced the stay at nothing. Where the house does not sell a
        // day, that tap now means nothing rather than meaning free.
        return;
      } else {
        // Check no approved days fall inside selected range
        const range = expandRange(checkIn, clickedDateStr);
        const hasConflict = range.some(d => approvedDays.has(d));
        if (hasConflict) return;
        setCheckOut(clickedDateStr);
      }
    }
  };

  const MONTH_NAMES_AR = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];

  // Same set as the occupancy calendar below, so the two grids in this file
  // read alike. The old row was ['أح','اث','ث','أر',…] — 'اث' and 'ث' differ
  // by one character at 10px, which is a coin flip to read.
  const WEEKDAYS_AR = WEEKDAY_INITIALS;

  // The calendar itself, with no chrome of its own. Inline mode drops it
  // straight into the sheet; the standalone mode wraps it in the modal below.
  const calendar = (
    <>
            <div className="grid grid-cols-2 gap-2 bg-[var(--ds-surface)] p-2.5 rounded-2xl border border-[var(--ds-border)]/50 text-[11px]">
              <div>
                <span className="text-[var(--ds-text-2)] block font-bold mb-0.5">من تاريخ (الوصول):</span>
                <span className="text-[var(--ds-brand)] font-black">{checkIn ? formatDateToShow(checkIn) : 'لم يحدد'}</span>
              </div>
              <div>
                <span className="text-[var(--ds-text-2)] block font-bold mb-0.5">إلى تاريخ (المغادرة):</span>
                <span className="text-[var(--ds-brand)] font-black">{checkOut ? formatDateToShow(checkOut) : 'لم يحدد'}</span>
              </div>
            </div>

            <div className="flex items-center justify-between px-1">
              <button aria-label="الشهر السابق"
                type="button"
                onClick={prevMonth}
                className="w-8 h-8 rounded-full border border-[var(--ds-border)] text-[var(--ds-text)] hover:bg-[var(--ds-raised)] flex items-center justify-center text-[12px] font-bold cursor-pointer transition-all"
              >
                ◀
              </button>
              <span className="text-[12px] font-extrabold text-[var(--ds-brand)]">
                {MONTH_NAMES_AR[month]} {year}
              </span>
              <button aria-label="الشهر التالي"
                type="button"
                onClick={nextMonth}
                className="w-8 h-8 rounded-full border border-[var(--ds-border)] text-[var(--ds-text)] hover:bg-[var(--ds-raised)] flex items-center justify-center text-[12px] font-bold cursor-pointer transition-all"
              >
                ▶
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-black text-[var(--ds-text-2)] border-b border-[var(--ds-border)]/20 pb-1.5">
              {WEEKDAYS_AR.map((day) => (
                <div key={day} className="py-1">{day}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {days.map((day, idx) => {
                if (day === null) {
                  return <div key={`empty-${idx}`} />;
                }

                const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const isSelectedStart = dStr === checkIn;
                const isSelectedEnd = dStr === checkOut;
                const isInRange = checkIn && checkOut && dStr > checkIn && dStr < checkOut;
                const isApproved = approvedDays.has(dStr);
                const isPending = !isApproved && pendingDays.has(dStr);
                const isPast = dStr < today;
                const isUnavailable = isApproved || isPast;

                let dayStyle = "text-[12px] font-semibold rounded-xl py-1.5 transition-all text-center ";

                if (isSelectedStart || isSelectedEnd) {
                  dayStyle += "bg-[var(--ds-brand)] text-[var(--ds-accent)] shadow-sm font-bold cursor-pointer";
                } else if (isApproved) {
                  dayStyle += "bg-[color-mix(in_srgb,var(--ds-danger)_16%,transparent)] text-[var(--ds-danger)] line-through cursor-not-allowed";
                } else if (isPast) {
                  dayStyle += "text-[var(--ds-text-faint)] cursor-not-allowed";
                } else if (isPending) {
                  dayStyle += "bg-[color-mix(in_srgb,var(--ds-warning)_16%,transparent)] text-[var(--ds-warning)] cursor-pointer";
                } else if (isInRange) {
                  dayStyle += "bg-[var(--ds-accent)]/20 text-[var(--ds-brand)] cursor-pointer";
                } else {
                  dayStyle += "text-[var(--ds-text)] hover:bg-[var(--ds-raised)]/50 cursor-pointer";
                }

                return (
                  <button
                    type="button"
                    key={`day-${day}`}
                    onClick={() => !isUnavailable && handleDayClick(day)}
                    title={isApproved ? 'محجوز' : isPending ? 'قيد المراجعة' : isPast ? 'تاريخ مضى' : ''}
                    className={dayStyle}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-3 text-[11px] border-t border-[var(--ds-border)]/20 pt-2">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[color-mix(in_srgb,var(--ds-danger)_16%,transparent)] inline-block" />محجوز</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[color-mix(in_srgb,var(--ds-warning)_16%,transparent)] inline-block" />قيد المراجعة</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[var(--ds-accent)]/20 inline-block" />الفترة المختارة</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[var(--ds-brand)] inline-block" />بداية / نهاية</span>
            </div>

            <div className="flex gap-2 border-t border-[var(--ds-border)]/40 pt-3">
              <button
                type="button"
                onClick={() => (inline ? onDone?.() : setIsOpen(false))}
                disabled={!checkIn || !checkOut}
                className="flex-1 bg-[var(--ds-brand)] disabled:opacity-50 hover:bg-[color-mix(in_srgb,var(--ds-brand)_82%,black)] text-[var(--ds-on-brand)] text-[12px] font-bold py-2 rounded-xl text-center shadow-md transition-colors cursor-pointer"
              >
                {singleDay ? 'تأكيد اليوم' : 'تأكيد فترة الإقامة'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCheckIn('');
                  setCheckOut('');
                }}
                className="px-3 bg-[color-mix(in_srgb,var(--ds-danger)_10%,transparent)] hover:bg-[color-mix(in_srgb,var(--ds-danger)_16%,transparent)] text-[var(--ds-danger)] text-[12px] font-bold py-2 rounded-xl border border-[color-mix(in_srgb,var(--ds-danger)_30%,transparent)] transition-colors cursor-pointer"
              >
                مسح
              </button>
            </div>
    </>
  );

  if (inline) {
    return <div className="space-y-4 text-right" dir="rtl">{calendar}</div>;
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="w-full bg-[var(--ds-surface)] border border-[var(--ds-border)] hover:border-[var(--ds-accent)] transition-all text-[12px] px-3 py-2.5 rounded-xl text-[var(--ds-text)] flex items-center justify-between text-right cursor-pointer"
      >
        <span className="font-bold">{formattedRange}</span>
        <Calendar className="w-4 h-4 text-[var(--ds-accent)] shrink-0" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
          <div className="absolute inset-0" onClick={() => setIsOpen(false)} />

          <div className="relative bg-[var(--ds-surface)] rounded-3xl border border-[var(--ds-border)] shadow-xl w-full max-w-sm overflow-hidden z-10 p-5 text-right space-y-4" dir="rtl">
            <div className="flex items-center justify-between border-b border-[var(--ds-border)]/40 pb-3">
              <span className="text-[12px] font-black text-[var(--ds-brand)]">تحديد فترة الإقامة والتعاقد</span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-[var(--ds-text-2)] hover:text-[var(--ds-text)] text-[12px] font-bold p-1"
              >
                إغلاق ✕
              </button>
            </div>
            {calendar}
          </div>
        </div>
      )}
    </div>
  );
};

export default function HouseDetail({
  house,
  currentUser,
  bookings,
  reviews,
  onBack,
  onBook,
  onSubmitReview,
  onUpdateMenu,
  isFavorited,
  onToggleFavorite,
  rooms = [],
  roomTypes = [],
  announcements = [],
  waitlist = [],
  onJoinWaitlist,
  settings = DEFAULT_PLATFORM_SETTINGS,
  previewMode = false,
  onRequireLogin,
  onNavigateBookings,
  onNavigateHome,
}: HouseDetailProps) {
  const [isCopied, setIsCopied] = useState(false);

  // Deep link to this specific house — shares the prerendered, crawlable
  // /house/<id>/ URL (see vite.config.ts + App.tsx deep-link effect) so the
  // link previews richly and is indexable, instead of the bare site URL.
  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/house/${house.id}/`;
    const shareData = {
      title: house.name,
      text: `اكتشف بيت المؤتمرات: ${house.name} في محافظة ${house.governorate} لخلوتكم ومؤتمراتكم القادمة.`,
      url: shareUrl,
    };

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.log("Error sharing:", err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      } catch (err) {
        console.log("Error copying link:", err);
      }
    }
  };

  // One-tap WhatsApp share — opens WhatsApp (app or Web) with the house's rich
  // /house/<id>/ link pre-filled so the recipient sees the preview card.
  const propLabelShort = house.propertyType === 'student' ? 'سكن طلاب'
    : house.propertyType === 'staff' ? 'سكن موظفين' : 'بيت مؤتمرات';

  const [isQuoteMode, setIsQuoteMode] = useState(false); // Toggle between regular booking & large conference quote

  // Auto-fill from repeat bookings — if the guest has booked this house
  // before, pre-fill guestsCount from their most recent booking here.
  const lastBookingHere = currentUser
    ? bookings
        .filter(b => b.houseId === house.id && b.userId === currentUser.id)
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))[0]
    : undefined;

  // Form states for booking.
  //
  // These used to be the literals '2026-07-15' / '2026-07-18'. A hardcoded
  // date is only ever right for as long as it is in the future: by August
  // 2026 every visitor was opening the booking form on a window that had
  // already passed, and nothing server-side refuses a booking in the past —
  // so an unchanged form submitted a request for a month that was over.
  const [checkIn, setCheckIn] = useState(() =>
    isMonthlyStay(house.propertyType) ? firstOfNextMonth() : daysFromToday(14));
  const [checkOut, setCheckOut] = useState(() =>
    isMonthlyStay(house.propertyType) ? endOfAcademicYear() : daysFromToday(17));
  const [guestsCount, setGuestsCount] = useState<number>(() => {
    const isMonthly = house.propertyType === 'student' || house.propertyType === 'staff';
    const fallback = isMonthly ? 1 : 30;
    const preferred = lastBookingHere?.guestsCount ?? fallback;
    // Never open the form already over the house's capacity: a 30-person
    // default on a 20-bed house made the page show "join the waitlist" before
    // the visitor had touched anything.
    const cap = house.bedsCount || 0;
    return cap > 0 ? Math.min(preferred, cap) : preferred;
  });
  const [usePoints, setUsePoints] = useState(false);
  
  // Custom price quote states
  const [selectedHallId, setSelectedHallId] = useState(house.conferenceHalls[0]?.id || '');
  // `mealsIncluded` used to be a state here that nothing ever set, spread into
  // every conference quote as a hardcoded true. The guest's real answer is
  // `withMeals` — one source for it, and it comes from a control they touched.
  const [extraRequests, setExtraRequests] = useState('');

  // Review sorting and paging now live inside HouseReviews, next to the list
  // they drive.
  // The public owner trust card is gone from this screen, and with it the
  // getHouseOwnerProfile RPC call that only ever fed it — no point paying for
  // a round trip per house opened to render nothing. The RPC itself (migration
  // 056) is untouched and still available if the card ever comes back.

  // Interactive weekly menu states
  const [selectedMenuDay, setSelectedMenuDay] = useState<string>(house.menu?.weeklyMenu?.[0]?.day || 'السبت');
  const [showFullMenu, setShowFullMenu] = useState(false);
  const [isFastingMenu, setIsFastingMenu] = useState(false);

  // Menu Editor States
  const [isEditingMenu, setIsEditingMenu] = useState(false);
  const [editIsIncluded, setEditIsIncluded] = useState(house.menu?.isIncluded ?? true);
  const [editExtraMealPrice, setEditExtraMealPrice] = useState(house.menu?.extraMealPrice ?? 50);
  const [editAllowsSpecial, setEditAllowsSpecial] = useState(house.menu?.allowsSpecialRequests ?? true);
  
  const [editWeeklyMenu, setEditWeeklyMenu] = useState<any[]>(() => 
    house.menu?.weeklyMenu || [
      { day: 'السبت', breakfast: 'فول بالزيت الحار وجبنة بيضاء بالخيار وعيش طازج', lunch: 'فراخ مشوية وأرز بسمتي وسلطة خضراء', dinner: 'بيض مسلوق وجبنة بيضاء وزبادي ومربى', price: 120 },
      { day: 'الأحد', breakfast: 'طعمية سخنة وبابا غنوج وبطاطس محمرة وعيش دافئ', lunch: 'لحمة كباب حلة ومكرونة بالصلصة وشوربة خضار', dinner: 'جبنة قريش بالطماطم وزيت زيتون وعسل نحل وعيش', price: 140 },
      { day: 'الاثنين', breakfast: 'بيض مسلوق بالزبدة وجبنة نستو وعسل أسود وحلاوة وعيش', lunch: 'صينية بطاطس بالفراخ في الفرن وأرز مصري بالشعرية وسلطة خضراء', dinner: 'شعرية باللبن دافئة أو شاي بلبن وبسكويت', price: 110 },
      { day: 'الثلاثاء', breakfast: 'فول مدمس بالليمون والكمون وبيض أومليت وخيار وجبن', lunch: 'كفتة مشوية على الفحم وأرز بسمتي أصفر وسلطة طحينة وسلطة خضراء', dinner: 'كلوب ساندوتش تونة بالبصل والفلفل والألوان وبطاطس محمرة', price: 130 },
      { day: 'الأربعاء', breakfast: 'بيض عيون وبطاطس بوريه بالزبدة وجبنة رومي ومربى وعيش', lunch: 'سمك فيليه مقلي مقرمش وأرز صيادية بني متبل وسلطة خضراء وطحينة', dinner: 'فطيرة زعتر وجبنة بيضاء ثلاجة وشاي دافئ بالنعناع', price: 115 },
      { day: 'الخميس', breakfast: 'بوفيه صغير: أجبان مشكلة ولانشون وفول وعسل نحل وتوست ومربى', lunch: 'بفتيك لحم بقري محمر ومكرونة وايت صوص بالمشروم وبطاطس فارم فريتس', dinner: 'بيتزا مارجريتا أو خضار خفيفة وسلطة زيتون طازجة', price: 135 },
      { day: 'الجمعة', breakfast: 'فول مدمس بالسمن البلدي وطعمية سخنة وباذنجان مخلل وجرجير وعيش بلدي', lunch: 'أرز معمر بالفراخ البلدي وملوخية مصرية دافئة وسلطات ومخلل مشكل', dinner: 'عشاء خفيف: أجبان مشكلة وقشطة وعسل بلدي وعيش بلدي سخن', price: 125 }
    ]
  );

  const [editFastingWeeklyMenu, setEditFastingWeeklyMenu] = useState<any[]>(() => 
    house.menu?.fastingWeeklyMenu || DEFAULT_FASTING_MENU
  );

  const [editorSelectedDay, setEditorSelectedDay] = useState('السبت');
  const [editorIsFasting, setEditorIsFasting] = useState(false);

  const handleStartEditing = () => {
    setEditIsIncluded(house.menu?.isIncluded ?? true);
    setEditExtraMealPrice(house.menu?.extraMealPrice ?? 50);
    setEditAllowsSpecial(house.menu?.allowsSpecialRequests ?? true);
    setEditWeeklyMenu(house.menu?.weeklyMenu || [
      { day: 'السبت', breakfast: 'فول بالزيت الحار وجبنة بيضاء بالخيار وعيش طازج', lunch: 'فراخ مشوية وأرز بسمتي وسلطة خضراء', dinner: 'بيض مسلوق وجبنة بيضاء وزبادي ومربى', price: 120 },
      { day: 'الأحد', breakfast: 'طعمية سخنة وبابا غنوج وبطاطس محمرة وعيش دافئ', lunch: 'لحمة كباب حلة ومكرونة بالصلصة وشوربة خضار', dinner: 'جبنة قريش بالطماطم وزيت زيتون وعسل نحل وعيش', price: 140 },
      { day: 'الاثنين', breakfast: 'بيض مسلوق بالزبدة وجبنة نستو وعسل أسود وحلاوة وعيش', lunch: 'صينية بطاطس بالفراخ في الفرن وأرز مصري بالشعرية وسلطة خضراء', dinner: 'شعرية باللبن دافئة أو شاي بلبن وبسكويت', price: 110 },
      { day: 'الثلاثاء', breakfast: 'فول مدمس بالليمون والكمون وبيض أومليت وخيار وجبن', lunch: 'كفتة مشوية على الفحم وأرز بسمتي أصفر وسلطة طحينة وسلطة خضراء', dinner: 'كلوب ساندوتش تونة بالبصل والفلفل والألوان وبطاطس محمرة', price: 130 },
      { day: 'الأربعاء', breakfast: 'بيض عيون وبطاطس بوريه بالزبدة وجبنة رومي ومربى وعيش', lunch: 'سمك فيليه مقلي مقرمش وأرز صيادية بني متبل وسلطة خضراء وطحينة', dinner: 'فطيرة زعتر وجبنة بيضاء ثلاجة وشاي دافئ بالنعناع', price: 115 },
      { day: 'الخميس', breakfast: 'بوفيه صغير: أجبان مشكلة ولانشون وفول وعسل نحل وتوست ومربى', lunch: 'بفتيك لحم بقري محمر ومكرونة وايت صوص بالمشروم وبطاطس فارم فريتس', dinner: 'بيتزا مارجريتا أو خضار خفيفة وسلطة زيتون طازجة', price: 135 },
      { day: 'الجمعة', breakfast: 'فول مدمس بالسمن البلدي وطعمية سخنة وباذنجان مخلل وجرجير وعيش بلدي', lunch: 'أرز معمر بالفراخ البلدي وملوخية مصرية دافئة وسلطات ومخلل مشكل', dinner: 'عشاء خفيف: أجبان مشكلة وقشطة وعسل بلدي وعيش بلدي سخن', price: 125 }
    ]);
    setEditFastingWeeklyMenu(house.menu?.fastingWeeklyMenu || DEFAULT_FASTING_MENU);
    setIsEditingMenu(true);
  };

  const handleSaveMenuChanges = () => {
    if (onUpdateMenu) {
      onUpdateMenu(house.id, {
        isIncluded: editIsIncluded,
        extraMealPrice: Number(editExtraMealPrice),
        allowsSpecialRequests: editAllowsSpecial,
        weeklyMenu: editWeeklyMenu,
        fastingWeeklyMenu: editFastingWeeklyMenu
      });
      setIsEditingMenu(false);
      alert('تم حفظ قائمة طعام وأسعار بيت المؤتمرات بنجاح!');
    }
  };

  const handleDayMealChange = (day: string, meal: 'breakfast' | 'lunch' | 'dinner' | 'price', value: string | number) => {
    if (editorIsFasting) {
      setEditFastingWeeklyMenu(prev => 
        prev.map(item => item.day === day ? { ...item, [meal]: value } : item)
      );
    } else {
      setEditWeeklyMenu(prev => 
        prev.map(item => item.day === day ? { ...item, [meal]: value } : item)
      );
    }
  };

  // Interactive room selection state
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  // Servant Budget Calculator state variables
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [availabilityOpen, setAvailabilityOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  // Bumped when the inline calendar confirms, so the sheet holding it closes.
  const [datesDone, setDatesDone] = useState(0);
  // Off until asked for. See mealPlan below.
  const [withMeals, setWithMeals] = useState(false);

  /**
   * Switching between a stay with nights in it and a day with none.
   *
   * The dates live here, so the switch does too. Going to a day collapses the
   * range onto the arrival date; coming back from one reopens it by a single
   * night rather than restoring whatever was there before — the guest is
   * choosing a kind of stay, not undoing an edit, and a remembered three-night
   * range reappearing under them reads as the app arguing.
   */
  const setStayMode = (mode: 'night' | 'day') => {
    tapFeedback();
    if (!checkIn) return;
    if (mode === 'day') setCheckOut(checkIn);
    else if (checkOut <= checkIn) setCheckOut(occupiedEnd(checkIn, checkIn));
  };
  const [calcBusPrice, setCalcBusPrice] = useState<number>(3500);
  const [calcBusesCount, setCalcBusesCount] = useState<number>(1);
  const [calcMiscExpenses, setCalcMiscExpenses] = useState<number>(1500);
  const [calcTargetSubscription, setCalcTargetSubscription] = useState<number>(350);

  // Filter reviews for this house
  const houseReviews = reviews.filter((r) => r.houseId === house.id);

  const isOwnerOrAdmin = currentUser && (currentUser.role === 'admin' || currentUser.role === 'owner' || currentUser.id === house.ownerId);

  const approvedBookingsForThisHouse = bookings.filter((b) => b.houseId === house.id && b.status === 'approved');
  const pendingBookingsForThisHouse = bookings.filter((b) => b.houseId === house.id && b.status === 'pending');
  const activeBookingsForThisHouse = [...approvedBookingsForThisHouse, ...pendingBookingsForThisHouse];

  // Compute per-date used beds by summing guests_count of overlapping active bookings.
  // A date is only "fully blocked" when used_beds >= house.bedsCount.
  const usedBedsOnDate = (dateStr: string): number => {
    return activeBookingsForThisHouse.reduce((sum, b) => {
      if (dateStr >= b.checkIn && dateStr < b.checkOut) return sum + (b.guestsCount || 0);
      return sum;
    }, 0);
  };

  const isDateFull = (dateStr: string): boolean => {
    if (house.blockedDates && house.blockedDates.includes(dateStr)) return true;
    return usedBedsOnDate(dateStr) >= (house.bedsCount || 0);
  };

  // Only date ranges where capacity is FULLY used should block the calendar.
  const allBookedRanges = activeBookingsForThisHouse
    .filter(b => {
      // Include this booking's range as "blocked" only if any day in it is fully booked.
      const start = new Date(b.checkIn);
      const end = new Date(b.checkOut);
      for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
        const s = d.toISOString().split('T')[0];
        if (isDateFull(s)) return true;
      }
      return false;
    })
    .map(b => ({ checkIn: b.checkIn, checkOut: b.checkOut, status: b.status as 'approved' | 'pending' }));

  // The occupancy calendar follows the month the guest is actually looking
  // at — the check-in they picked — rather than a month named in the source.
  // It used to be hardcoded to July 2026 and kept saying so after July ended.
  const calendarMonth = useMemo(() => {
    const d = new Date(`${checkIn}T00:00:00`);
    return Number.isNaN(d.getTime()) ? new Date() : d;
  }, [checkIn]);
  const calYear = calendarMonth.getFullYear();
  const calMonthIndex = calendarMonth.getMonth();
  const CALENDAR_DAYS = Array.from(
    { length: new Date(calYear, calMonthIndex + 1, 0).getDate() },
    (_, i) => i + 1,
  );
  // Blank cells before the 1st so each day sits under its real weekday.
  const calendarLeadingBlanks = new Date(calYear, calMonthIndex, 1).getDay();
  const calendarMonthLabel = calendarMonth.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });

  const calendarDateStr = (day: number) =>
    `${calYear}-${String(calMonthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const isDateBooked = (day: number) => isDateFull(calendarDateStr(day));
  // A day that has already gone is not "available" — it is simply over. The
  // grid used to paint it the same green as a free future day.
  const isDatePast = (day: number) => calendarDateStr(day) < localISODate(new Date());

  // What the availability card leads with: the count a visitor is actually
  // looking for, so they can decide without opening the month. Days already
  // behind us are not offered.
  const freeCalendarDays = CALENDAR_DAYS.filter((d) => !isDateBooked(d) && !isDatePast(d)).length;

  // 0 means «no night», which is a real answer now: a «يوم روحي» arrives and
  // leaves the same day. It used to return `diffDays || 1`, so a same-day
  // booking claimed one night on screen while computeStayPrice charged
  // nothing for it — the number and the money disagreed.
  const calculateNights = () => {
    if (!checkIn || !checkOut) return 0;
    const diff = Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000);
    return Number.isFinite(diff) && diff > 0 ? diff : 0;
  };

  const isMonthlyHousing = house.propertyType === 'student' || house.propertyType === 'staff';

  const calculateMonths = () => {
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const calculated = Math.round((diffDays || 30) / 30);
    return Math.max(1, calculated);
  };

  const nights = calculateNights();
  const months = calculateMonths();
  // Night-by-night with seasonal rates (lib/pricing.ts) — must match the
  // server's validate_booking_price math or the booking gets rejected.
  const stayPrice = !isMonthlyHousing && checkIn && checkOut
    ? computeStayPrice(house, checkIn, checkOut, guestsCount)
    : { total: 0, breakdown: [] };
  // What the house will feed them, and whether they have asked for it.
  // Opt-in: a charge the guest did not choose turning up in their total is
  // the one thing a booking screen must never do.
  const mealPlan = computeMealPlan(house, checkIn, checkOut, guestsCount);
  const mealsChargeable = mealPlan.state === 'priced' && !isMonthlyHousing;
  const mealsCost = withMeals && mealsChargeable ? mealPlan.total : 0;
  // The house discount, applied to the accommodation before meals are added.
  //
  // This has to mirror validate_booking_price (migration 110) exactly. The
  // server recomputes the accommodation from the house's own rates, applies
  // the same percentage, and refuses anything below the resulting floor — so a
  // client that discounts a different base, or rounds differently, produces a
  // booking the database rejects with PRICE_TOO_LOW and no explanation the
  // guest could act on.
  //
  // Meals are excluded on both sides: they are not in the server's figure at
  // all, and the offer is about the owner's empty beds, not his food.
  const accommodation = isMonthlyHousing
    ? (house.monthlyRent || 1500) * guestsCount * months
    : stayPrice.total;
  const discountPct = activeDiscountFor(house, checkIn);
  const accommodationAfterDiscount = applyDiscount(accommodation, discountPct);
  const discountSaving = accommodation - accommodationAfterDiscount;
  const originalTotalPrice = accommodationAfterDiscount + mealsCost;

  // Whether the currently selected dates/guest count would exceed remaining
  // capacity — used to offer joining the waitlist instead of a doomed booking attempt.
  // Two distinct failure modes, deliberately kept apart: a group larger than
  // the house can never be helped by a waitlist, while a house that is merely
  // full on the chosen dates can. See lib/roomOccupancy.getCapacityStatus.
  const capacityStatus = getCapacityStatus({
    bedsCount: house.bedsCount || 0,
    guestsCount,
    checkIn,
    checkOut,
    usedBedsOnDate,
    isMonthly: isMonthlyHousing,
  });
  const exceedsHouseCapacity = capacityStatus === 'exceeds_house';
  const isFullOnDates = capacityStatus === 'full_on_dates';

  const alreadyOnWaitlist = waitlist.some(
    (w) => w.userId === currentUser?.id && w.houseId === house.id && w.checkIn === checkIn && w.checkOut === checkOut && w.status === 'waiting'
  );

  const handleJoinWaitlistClick = () => {
    if (!currentUser) { onRequireLogin?.(); return; }
    if (!onJoinWaitlist) return;
    if (!checkIn || !checkOut || guestsCount <= 0) {
      alert('الرجاء التأكد من إدخال كافة بيانات التواريخ والأعداد.');
      return;
    }
    const ok = onJoinWaitlist({
      id: `wl_${Date.now()}`,
      houseId: house.id,
      houseName: house.name,
      userId: currentUser.id,
      userName: currentUser.name,
      userPhone: currentUser.phone,
      checkIn,
      checkOut,
      guestsCount,
      status: 'waiting',
      createdAt: new Date().toISOString(),
    });
    if (ok) alert('تم تسجيلك في قائمة الانتظار! سيتم إشعارك فور توفر مكان لهذه التواريخ.');
  };

  // Rewards system points calculation — rates are admin-configurable
  // (migration 024): pointsPerEgp for redemption, maxRedemptionPct as the
  // cap on how much of a booking points can cover.
  const POINTS_PER_EGP = settings.pointsPerEgp;
  const maxDiscountByPolicy = Math.round(originalTotalPrice * settings.maxRedemptionPct); // EGP
  const maxRedeemablePoints = Math.min(currentUser?.points || 0, maxDiscountByPolicy * POINTS_PER_EGP);
  const pointsToRedeem = usePoints ? maxRedeemablePoints : 0;
  const redemptionDiscount = Math.round(pointsToRedeem / POINTS_PER_EGP);
  const totalPrice = Math.max(0, originalTotalPrice - redemptionDiscount);
  const depositAmount = Math.round(totalPrice * settings.depositRate); // configurable deposit

  // Returns the new booking's id on success, or null if it was refused — the
  // flow needs the id to show the guest their request number, and needs the
  // null to stay on the confirmation step rather than declaring success.
  // Card previews. Two or three facts each, read off the record — enough to
  // make the card worth opening, never the section in miniature.
  const menuFacts = [
    house.menu?.weeklyMenu?.length ? `${arabicNumber(3)} وجبات يوميًا` : 'لم تُحدَّد القائمة بعد',
    house.menu?.isIncluded ? 'مشمولة في قيمة الحجز' : null,
    house.menu?.fastingWeeklyMenu?.length ? 'خيارات صيام' : null,
  ].filter(Boolean) as string[];
  const menuPreview = (
    <div className="space-y-1.5">
      {menuFacts.map((f) => (
        <span key={f} className="flex items-center gap-1.5 text-[11px] font-bold text-[#2D2D24]">
          <span aria-hidden="true" className="w-1 h-1 rounded-full bg-[var(--ds-accent)] shrink-0" />
          {f}
        </span>
      ))}
    </div>
  );

  // Three named, the rest counted: a wall of chips is not a summary.
  const namedFacilities = [
    house.conferenceHalls?.length ? { label: 'قاعة اجتماعات', Glyph: Users } : null,
    house.services?.some((s) => s.includes('كنيسة')) ? { label: 'كنيسة', Glyph: Church } : null,
    house.activities?.some((a) => a.includes('مسرح')) ? { label: 'مسرح', Glyph: Theater } : null,
  ].filter(Boolean) as { label: string; Glyph: React.ComponentType<{ className?: string }> }[];
  const facilitiesTotal = (house.services?.length || 0) + (house.activities?.length || 0)
    + (house.conferenceHalls?.length || 0) + (house.restaurants?.length || 0);
  // One line that scrolls, not a block that wraps: on a phone this card is a
  // strip under two columns, and wrapping chips turned it back into a panel.
  const facilityPreview = (
    <div className="flex flex-nowrap gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {/* Chips arrive one after another — the same rise the cards use, at
          80ms steps, so the card has motion without a photograph. */}
      {namedFacilities.map(({ label, Glyph }, i) => (
        <span
          key={label}
          className="pima-rise shrink-0 whitespace-nowrap inline-flex items-center gap-1.5 rounded-full border border-[var(--ds-border)] bg-[var(--ds-surface)] px-3 py-1.5 text-[11px] font-bold text-[#2D2D24] shadow-[0_1px_4px_rgba(45,45,36,0.05)]"
          style={{ animationDelay: `${240 + i * 80}ms` }}
        >
          <Glyph className="w-3.5 h-3.5 text-[var(--ds-accent)]" />
          {label}
        </span>
      ))}
      {facilitiesTotal > namedFacilities.length && (
        <span
          className="pima-rise shrink-0 whitespace-nowrap inline-flex items-center rounded-full border border-[var(--ds-accent-soft)] bg-[var(--ds-surface)] px-3 py-1.5 text-[11px] font-black text-[var(--ds-accent-deep)]"
          style={{ animationDelay: `${240 + namedFacilities.length * 80}ms` }}
        >
          <Sparkles className="w-3 h-3 ml-1 pima-twinkle" />
          +{arabicNumber(facilitiesTotal - namedFacilities.length)} المزيد
        </span>
      )}
    </div>
  );

  // A faint oversized glyph in the card's empty corner — presence, not
  // information. aria-hidden and 6% gold, so it reads as texture.
  const facilityDecor = (
    <span aria-hidden="true" className="absolute -bottom-6 -left-6 pointer-events-none">
      <Users className="w-36 h-36 text-[var(--ds-accent)] opacity-[0.06]" />
    </span>
  );

  // Two counts, each given its own tile: the numbers are the point of this
  // card, and a single grey line was hiding them.
  const roomsPreview = (
    <div className="flex gap-2">
      {[
        { n: house.roomsCount, unit: 'غرفة', Glyph: DoorOpen },
        { n: house.bedsCount, unit: 'سرير', Glyph: BedDouble },
      ].map(({ n, unit, Glyph }) => (
        <span key={unit} className="flex-1 min-w-0 flex items-center justify-center gap-1 whitespace-nowrap rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface)] px-1.5 py-1.5 shadow-[0_1px_4px_rgba(45,45,36,0.05)]">
          <Glyph className="w-3.5 h-3.5 text-[var(--ds-accent)] shrink-0" />
          <span className="text-[14px] font-black text-[var(--ds-brand)] leading-none [font-variant-numeric:tabular-nums]">{arabicNumber(n)}</span>
          <span className="text-[11px] font-bold text-[var(--ds-text-2)]">{unit}</span>
        </span>
      ))}
    </div>
  );

  // Who the place suits. The full labels («رحلات أطفال / مدارس أحد») are the
  // ones the owner picked and belong in the sheet; a chip in a half-column card
  // has room for one word, so the card gets the short forms.
  const SUITABILITY_SHORT: Record<RetreatHouse['suitability'][number], string> = {
    youth: 'شباب', children: 'أطفال', families: 'أسر', retreat: 'خلوات',
  };
  const aboutPreview = (
    <div className="space-y-2">
      <p className="text-[11px] font-bold text-[var(--ds-text)] leading-relaxed line-clamp-2">{house.description}</p>
      <div className="flex flex-wrap gap-1.5">
        {house.suitability.slice(0, 2).map((s) => (
          <span key={s} className="inline-flex items-center whitespace-nowrap rounded-full border border-[var(--ds-accent-soft)] bg-[var(--ds-surface)] px-2.5 py-1 text-[11px] font-black text-[var(--ds-accent-deep)]">
            {SUITABILITY_SHORT[s]}
          </span>
        ))}
      </div>
    </div>
  );

  const cardWeather = GOVERNORATE_WEATHER_DATA[house.governorate] || DEFAULT_WEATHER;
  const weatherPreview = (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-3 shrink-0">
        {getWeatherIcon(cardWeather.forecast?.[0]?.icon || 'cloudSun')}
        <span className="leading-none">
          <span className="block text-[36px] font-black text-[var(--ds-brand)] [font-variant-numeric:tabular-nums]">
            {arabicNumber(cardWeather.currentTemp)}°
          </span>
          <span className="block text-[11px] font-black text-[#2D2D24] mt-1.5">{house.governorate}</span>
          <span className="block text-[11px] font-medium text-[var(--ds-text-2)] mt-0.5">{cardWeather.conditionText}</span>
        </span>
      </div>
      <span aria-hidden="true" className="w-px self-stretch bg-[var(--ds-accent-soft)]/60" />
      <div className="flex-1 min-w-0 space-y-1.5">
        {[
          { label: 'درجة الحرارة', Glyph: Thermometer },
          { label: 'توقعات الأيام القادمة', Glyph: CalendarDays },
          { label: 'نصائح للرحلة', Glyph: Lightbulb },
        ].map(({ label, Glyph }) => (
          <span key={label} className="flex items-center gap-2 rounded-xl bg-[var(--ds-surface)] border border-[var(--ds-border)] px-3 py-2 text-[11px] font-bold text-[#2D2D24] shadow-[0_1px_4px_rgba(45,45,36,0.05)]">
            <Glyph className="w-4 h-4 text-[var(--ds-accent)] shrink-0" />
            {label}
          </span>
        ))}
      </div>
    </div>
  );

  const handleBookingSubmit = async (applicant: ApplicantDetails): Promise<string | null> => {
    if (previewMode) { alert('معاينة فقط — التسجيل معطّل أثناء مراجعة الإدارة.'); return null; }
    if (!currentUser) { onRequireLogin?.(); return null; }
    if (!checkIn || !checkOut || guestsCount <= 0) {
      alert('الرجاء التأكد من إدخال كافة بيانات التواريخ والأعداد.');
      return null;
    }

    // Validate if any date in range is blocked
    if (house.blockedDates && house.blockedDates.length > 0) {
      const start = new Date(checkIn);
      const end = new Date(checkOut);
      const blockedDatesInRange = house.blockedDates.filter((dStr) => {
        const d = new Date(dStr);
        return d >= start && d <= end;
      });
      if (blockedDatesInRange.length > 0) {
        alert(`نأسف، البيت غير متاح للحجز في التواريخ المحددة بسبب: أعمال صيانة أو إشغال مسبق (${blockedDatesInRange.join(', ')}). يرجى تغيير التواريخ.`);
        return null;
      }
    }

    // What the applicant typed wins over what the account holds: a servant
    // often books on behalf of a church whose details differ from their own.
    // Blank fields fall back to the account rather than writing an empty name.
    const bookingId = `book_${Date.now()}`;
    const trimmed = {
      fullName: applicant.fullName.trim(),
      phone: applicant.phone.trim(),
      organization: applicant.organization.trim(),
      diocese: applicant.diocese.trim(),
      email: applicant.email.trim(),
      notes: applicant.notes.trim(),
      bookingType: applicant.bookingType,
    };

    // Notes and diocese ride in the conference_details jsonb, which needs no
    // migration to carry them. Written whenever there is anything to say —
    // not only for conference quotes.
    const extras = [
      isQuoteMode ? (extraRequests || 'مطلوب تنظيم اليوم كامل بمائدة محبة وقاعات اجتماعات مناسبة.') : '',
      trimmed.notes,
    ].filter(Boolean).join('\n');
    const details = (isQuoteMode || extras || trimmed.diocese || trimmed.bookingType)
      ? {
          ...(isQuoteMode ? { hallId: selectedHallId } : {}),
          extraRequests: extras,
          ...(trimmed.diocese ? { diocese: trimmed.diocese } : {}),
          ...(trimmed.bookingType ? { bookingType: trimmed.bookingType } : {}),
          // Recorded whenever the house prices meals at all, true or false —
          // an absent key would read as «not asked», and the kitchen needs
          // the difference between «no» and «nobody said».
          ...(mealsChargeable ? { mealsIncluded: withMeals, mealsCost } : {}),
        }
      : undefined;

    const newBooking: Booking = {
      id: bookingId,
      houseId: house.id,
      houseName: house.name,
      userId: currentUser.id,
      userName: trimmed.fullName || currentUser.name,
      userPhone: trimmed.phone || currentUser.phone,
      userEmail: trimmed.email || currentUser.email,
      userRole: currentUser.role,
      organizationName: trimmed.organization || currentUser.organizationName,
      checkIn,
      checkOut,
      guestsCount,
      totalPrice,
      depositPaid: false,
      depositAmount,
      status: 'pending', // Pending owner approval
      isLargeConferenceQuote: isQuoteMode,
      conferenceDetails: details,
      createdAt: new Date().toISOString(),
    };

    // Wait for the DB write. If the capacity trigger rejects, App.tsx has
    // already shown a specific error, so stay on the confirmation step.
    setSubmitting(true);
    const result = await onBook(newBooking, pointsToRedeem);
    setSubmitting(false);
    if (result === false) return null;
    // The same reference the owner's screens show — see lib/bookingRef. It was
    // built inline here and nowhere else, so the number the guest reads off
    // their confirmation could not be looked up by the person they read it to.
    return bookingRef(bookingId);
  };

  // The booking journey is a screen, not a panel: while it is open the place
  // page is not rendered at all, so the reader is on one thing at a time.
  if (bookingOpen) {
    return (
      <div className="pb-6 text-right text-[var(--ds-text)]">
          {/* The reservation request, as its own three-screen journey. Pricing,
              capacity and dates stay here; the flow owns the walk through them. */}
          <BookingFlow
            house={house}
            currentUser={currentUser ?? null}
            checkIn={checkIn}
            checkOut={checkOut}
            nights={isMonthlyHousing ? months : nights}
            guestsCount={guestsCount}
            setGuestsCount={setGuestsCount}
            isQuoteMode={isQuoteMode}
            setIsQuoteMode={setIsQuoteMode}
            isMonthlyHousing={isMonthlyHousing}
            originalTotalPrice={originalTotalPrice}
            discountPct={discountPct}
            discountSaving={discountSaving}
            onPrintPriestQuote={currentUser && checkIn && checkOut ? () => printPriestQuote(buildPriestQuote({
              house, checkIn, checkOut, guestsCount, withMeals: !!withMeals,
              pointsDiscount: redemptionDiscount,
              settings, servant: currentUser,
            })) : undefined}
            totalPrice={totalPrice}
            depositAmount={depositAmount}
            breakdown={stayPrice.breakdown}
            submitting={submitting}
            onSubmit={handleBookingSubmit}
            onRequireLogin={onRequireLogin}
            onExit={() => setBookingOpen(false)}
            onTrackBooking={onNavigateBookings}
            onGoHome={onNavigateHome}
            datesConfirmed={datesDone}
            mealPlan={mealPlan}
            withMeals={withMeals}
            onSetWithMeals={(v) => { tapFeedback(); setWithMeals(v); }}
            dayUseAvailable={offersDayUse(house)}
            dayUsePrice={house.dayUsePricePerPerson}
            onSetStayMode={setStayMode}
            datePicker={
              <DateRangePicker
                checkIn={checkIn}
                setCheckIn={setCheckIn}
                checkOut={checkOut}
                setCheckOut={setCheckOut}
                isMonthlyHousing={isMonthlyHousing}
                allowSameDay={offersDayUse(house)}
                singleDay={offersDayUse(house) && Boolean(checkIn) && checkIn === checkOut}
                bookedRanges={[
                  ...approvedBookingsForThisHouse.map((b) => ({ checkIn: b.checkIn, checkOut: b.checkOut, status: 'approved' as const })),
                  ...pendingBookingsForThisHouse.map((b) => ({ checkIn: b.checkIn, checkOut: b.checkOut, status: 'pending' as const })),
                ]}
                blockedDates={house.blockedDates || []}
                inline
                onDone={() => setDatesDone((n) => n + 1)}
              />
            }
            notices={
              <>
                {/* Points redemption — only worth offering when the guest has
                    enough for it to change the number. */}
                {!isMonthlyHousing && maxRedeemablePoints > 0 && (
                  <label className="flex items-center gap-3 bg-[var(--ds-surface)] rounded-[28px] border border-[var(--ds-border)] p-3 cursor-pointer shadow-[0_8px_24px_rgba(0,0,0,0.06),0_2px_6px_rgba(0,0,0,0.03)]">
                    <input
                      type="checkbox"
                      checked={usePoints}
                      onChange={(e) => setUsePoints(e.target.checked)}
                      className="w-4 h-4 accent-[var(--ds-accent)] shrink-0 cursor-pointer"
                    />
                    <span className="flex-1 min-w-0">
                      <span className="block text-[12px] font-black text-[#2D2D24]">استخدم نقاطي في هذا الحجز</span>
                      <span className="block text-[11px] font-medium text-[var(--ds-text-2)] mt-0.5">
                        {usePoints && redemptionDiscount > 0
                          ? `خصم ${redemptionDiscount.toLocaleString('ar-EG')} ج.م من ${maxRedeemablePoints.toLocaleString('ar-EG')} نقطة`
                          : `لديك ${maxRedeemablePoints.toLocaleString('ar-EG')} نقطة قابلة للاستخدام`}
                      </span>
                    </span>
                  </label>
                )}

                {/* Capacity. Two different problems: a group larger than the
                    house can never be waitlisted, a full week can. */}
                {exceedsHouseCapacity && (
                  <div className="rounded-[28px] border border-[color-mix(in_srgb,var(--ds-warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--ds-warning)_10%,transparent)] p-3 space-y-2">
                    <p className="text-[11px] font-bold text-[var(--ds-warning-deep)] leading-relaxed text-center">
                      هذا البيت يتسع لـ <strong>{arabicNumber(house.bedsCount)}</strong> فرد كحد أقصى، وأنت طلبت <strong>{arabicNumber(guestsCount)}</strong>.
                    </p>
                    <button
                      type="button"
                      onClick={() => { tapFeedback(); setGuestsCount(house.bedsCount || 1); }}
                      className="w-full bg-[var(--ds-warning)] hover:bg-[var(--ds-warning)] text-white text-[12px] font-black py-3 rounded-2xl transition-colors cursor-pointer pima-press"
                    >
                      اضبط العدد على {arabicNumber(house.bedsCount)} فرد
                    </button>
                  </div>
                )}
                {isFullOnDates && (
                  <div className="rounded-[28px] border border-[color-mix(in_srgb,var(--ds-warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--ds-warning)_10%,transparent)] p-3 space-y-2">
                    <p className="text-[11px] font-bold text-[var(--ds-warning-deep)] text-center">
                      البيت مكتمل الإشغال في هذه التواريخ لعدد الأفراد المطلوب.
                    </p>
                    <button
                      id="join-waitlist-btn"
                      type="button"
                      disabled={alreadyOnWaitlist}
                      onClick={handleJoinWaitlistClick}
                      className="w-full bg-[var(--ds-warning)] hover:bg-[var(--ds-warning)] disabled:opacity-50 disabled:cursor-not-allowed text-white text-[12px] font-black py-3 rounded-2xl transition-colors cursor-pointer pima-press"
                    >
                      {alreadyOnWaitlist ? 'أنت مسجل بالفعل في قائمة الانتظار ⏳' : 'انضم لقائمة الانتظار ⏳'}
                    </button>
                  </div>
                )}

                {/* Cancellation terms, stated before anything is committed. */}
                <div className="rounded-[28px] border border-[var(--ds-border)] bg-[var(--ds-surface)] p-3 space-y-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.06),0_2px_6px_rgba(0,0,0,0.03)]">
                  <span className="flex items-center gap-1.5 text-[12px] font-black text-[var(--ds-brand)]">
                    <ShieldCheck className="w-4 h-4 text-[var(--ds-accent)]" />
                    سياسة الإلغاء والاسترداد
                  </span>
                  <ul className="space-y-1 text-[11px] font-medium text-[var(--ds-text)] pr-4 list-disc marker:text-[var(--ds-accent)]">
                    <li>قبل الوصول بـ<strong> {arabicNumber(settings.freeCancelDays)} أيام</strong> أو أكثر: استرداد <strong>كامل</strong>.</li>
                    <li>قبل الوصول بـ<strong> {arabicNumber(settings.partialRefundDays)} أيام</strong> أو أكثر: استرداد <strong>{arabicNumber(Math.round(settings.partialRefundPct * 100))}٪</strong>.</li>
                    <li>أقل من ذلك: لا يوجد استرداد.</li>
                  </ul>
                </div>
              </>
            }
          />

      </div>
    );
  }

  return (    <div className="space-y-4 pb-6 text-right text-[var(--ds-text)]">
      
      {/* Hero — gallery, headline facts and the page's own controls. Kept in
          its own component so the sections below are untouched by changes
          to the top of the page. */}
      <HouseHero
        house={house}
        reviewsCount={houseReviews.length}
        isFavorited={isFavorited}
        isCopied={isCopied}
        onBack={onBack}
        onShare={handleShare}
        onToggleFavorite={onToggleFavorite}
      />

      <HouseLocationTrust
        house={house}
        announcements={announcements}
      />

      {/* «استكشف المكان» — the five sections as cards that open into sheets,
          instead of a column of accordions unfolded one at a time. */}
      <ExploreSection>
      <ExploreCard
        id="services"
        title="نبذة عن المكان"
        subtitle="وصف البيت ولمن يناسب"
        icon={Info}
        place="right-top"
        tone="cream"
        cta="اقرأ المزيد"
        image={house.images?.[0]}
        imageMode="thumb"
        preview={aboutPreview}
      >
        <div className="space-y-3 text-right">
          <p className="text-[12px] text-[var(--ds-text)] leading-relaxed font-medium">{house.description}</p>

          {house.suitability.length > 0 && (
            <div className="space-y-2">
              <span className="block text-[11px] font-extrabold text-[var(--ds-brand)]">يناسب:</span>
              <div className="flex flex-wrap gap-2">
                {house.suitability.map((s) => (
                  <span key={s} className="inline-flex items-center rounded-full border border-[var(--ds-accent-soft)] bg-[var(--ds-surface)] px-3 py-1.5 text-[11px] font-bold text-[var(--ds-accent-deep)]">
                    {SUITABILITY_MAP[s]}
                  </span>
                ))}
              </div>
            </div>
          )}

          {house.propertyType === 'student' && house.distanceFromUniversity && (
            <div className="bg-[color-mix(in_srgb,var(--ds-warning)_7%,transparent)] border border-[color-mix(in_srgb,var(--ds-warning)_15%,transparent)] p-3 rounded-2xl text-[12px] font-bold text-[var(--ds-warning-deep)] mt-2">
              🏫 القرب من الجامعة والمواصلات: {house.distanceFromUniversity}
            </div>
          )}
        </div>
      </ExploreCard>

          {/* Weekly Restaurant Menu Display or Editor */}
          <ExploreCard
            id="menu"
            title="قائمة الطعام"
            subtitle="الوجبات والمنيو الأسبوعي وخيارات الصيام"
            icon={Utensils}
            place="left-tall"
            delay={1}
            cta="عرض المنيو"
            image={FOOD_CARD_IMAGE}
            imageMode="band"
            preview={menuPreview}
          >
            {(!house.menu && !isOwnerOrAdmin) ? (
            <div className="bg-[var(--ds-surface)] rounded-3xl p-5 border border-[var(--ds-border)] shadow-sm text-center py-8 space-y-3">
              <Utensils className="w-8 h-8 text-[var(--ds-text-faint)] mx-auto" />
              {/* No heading here: the section header above already says it. */}
              <p className="text-[12px] text-[var(--ds-text-2)]">لم يتم تحديد قائمة وجبات طعام مخصصة لهذا البيت بعد.</p>
            </div>
          ) : (
            <div className="bg-[var(--ds-surface)] rounded-3xl p-5 border border-[var(--ds-border)] shadow-sm space-y-4">
              {/* Header */}
              <div className="flex items-center gap-2 justify-between flex-wrap">
                <div className="flex items-center gap-2">
                  <Utensils className="w-5 h-5 text-[var(--ds-primary)]" />
                  <h3 className="text-[12px] font-extrabold text-[var(--ds-text)]">المنيو والوجبات الأسبوعية والأسعار:</h3>
                </div>
                <div className="flex gap-1.5 items-center">
                  {!isEditingMenu && house.menu && (
                    <button
                      id="toggle-menu-view"
                      type="button"
                      onClick={() => setShowFullMenu(!showFullMenu)}
                      className="text-[11px] font-bold bg-[var(--ds-primary)]/10 text-[var(--ds-primary)] hover:bg-[var(--ds-primary)]/20 px-2.5 py-1 rounded-xl transition-all cursor-pointer"
                    >
                      {showFullMenu ? 'عرض يومي تفاعلي' : 'عرض الأسبوع كاملاً'}
                    </button>
                  )}
                  {isOwnerOrAdmin && (
                    <button
                      id="edit-menu-btn"
                      type="button"
                      onClick={isEditingMenu ? handleSaveMenuChanges : handleStartEditing}
                      className={`text-[11px] font-extrabold px-2.5 py-1 rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
                        isEditingMenu 
                          ? 'bg-[var(--ds-success)] text-[var(--ds-on-success)] hover:bg-[var(--ds-success)]' 
                          : 'bg-[var(--ds-primary)] text-[var(--ds-on-primary)] hover:bg-[color-mix(in_srgb,var(--ds-primary)_85%,black)]'
                      }`}
                    >
                      {isEditingMenu ? '💾 حفظ التعديلات' : '✏️ تعديل المنيو والأسعار'}
                    </button>
                  )}
                  {isEditingMenu && (
                    <button
                      id="cancel-edit-menu-btn"
                      type="button"
                      onClick={() => setIsEditingMenu(false)}
                      className="text-[11px] font-extrabold bg-[var(--ds-raised)] text-[var(--ds-text)] hover:bg-[var(--ds-border)] px-2.5 py-1 rounded-xl transition-all cursor-pointer"
                    >
                      إلغاء
                    </button>
                  )}
                </div>
              </div>

              {isEditingMenu ? (
                /* --- MENU EDITOR VIEW --- */
                <div className="space-y-4 bg-[color-mix(in_srgb,var(--ds-raised)_50%,transparent)] p-4 rounded-2xl border border-[var(--ds-border)] text-right animate-fade-in" dir="rtl">
                  <div className="text-[12px] font-extrabold text-[var(--ds-text)] mb-2 border-b border-[var(--ds-border)] pb-1.5 flex justify-between items-center">
                    <span>⚙️ إعدادات المنيو والأسعار لبيت {house.name}</span>
                    <span className="text-[11px] bg-[var(--ds-border)] text-[var(--ds-text)] px-2 py-0.5 rounded">لوحة التحكم</span>
                  </div>

                  {/* General settings */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <label className="flex items-center gap-2 bg-[var(--ds-surface)] p-2.5 rounded-xl border border-[var(--ds-border)] cursor-pointer text-[11px] font-bold select-none">
                      <input 
                        type="checkbox" 
                        checked={editIsIncluded} 
                        onChange={(e) => setEditIsIncluded(e.target.checked)}
                        className="rounded text-[var(--ds-primary)] focus:ring-[var(--ds-primary)] w-4 h-4"
                      />
                      <span>الوجبات مشمولة في السعر الأساسي للإقامة</span>
                    </label>

                    <div className="bg-[var(--ds-surface)] p-2 rounded-xl border border-[var(--ds-border)] flex flex-col justify-between">
                      <span className="text-[11px] text-[var(--ds-text-2)] font-bold block mb-1">تكلفة الوجبة الإضافية (ج.م):</span>
                      <input 
                        type="number" 
                        value={editExtraMealPrice} 
                        onChange={(e) => setEditExtraMealPrice(Number(e.target.value))}
                        className="w-full text-[12px] font-bold border-none p-0 focus:ring-0 text-[var(--ds-text)]"
                        placeholder="مثال: 50"
                      />
                    </div>

                    <label className="flex items-center gap-2 bg-[var(--ds-surface)] p-2.5 rounded-xl border border-[var(--ds-border)] cursor-pointer text-[11px] font-bold select-none">
                      <input 
                        type="checkbox" 
                        checked={editAllowsSpecial} 
                        onChange={(e) => setEditAllowsSpecial(e.target.checked)}
                        className="rounded text-[var(--ds-primary)] focus:ring-[var(--ds-primary)] w-4 h-4"
                      />
                      <span>توفير بدائل وأنظمة غذائية (صيامي/نباتي)</span>
                    </label>
                  </div>

                  {/* Editor Menu Type Selector */}
                  <div className="flex bg-[color-mix(in_srgb,var(--ds-border)_60%,transparent)] p-1 rounded-xl gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditorIsFasting(false);
                        setEditorSelectedDay('السبت');
                      }}
                      className={`flex-1 py-1.5 text-center text-[11px] font-extrabold rounded-lg transition-all cursor-pointer ${
                        !editorIsFasting
                          ? 'bg-[var(--ds-primary)] text-[var(--ds-on-primary)] shadow-sm'
                          : 'text-[var(--ds-text)] hover:bg-[var(--ds-border)]'
                      }`}
                    >
                      🥩 تعديل وجبات المنيو الفطاري
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditorIsFasting(true);
                        setEditorSelectedDay('السبت');
                      }}
                      className={`flex-1 py-1.5 text-center text-[11px] font-extrabold rounded-lg transition-all cursor-pointer ${
                        editorIsFasting
                          ? 'bg-[var(--ds-success)] text-[var(--ds-on-success)] shadow-sm'
                          : 'text-[var(--ds-text)] hover:bg-[var(--ds-border)]'
                      }`}
                    >
                      🌿 تعديل وجبات المنيو الصيامي
                    </button>
                  </div>

                  {/* Editor Days selector */}
                  <div className="flex gap-1 overflow-x-auto pb-1.5 scrollbar-thin">
                    {['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'].map((day) => {
                      const isSelected = editorSelectedDay === day;
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => setEditorSelectedDay(day)}
                          className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all shrink-0 cursor-pointer border ${
                            isSelected
                              ? editorIsFasting
                                ? 'bg-[var(--ds-success)] text-[var(--ds-on-success)] border-[var(--ds-success)]'
                                : 'bg-[var(--ds-primary)] text-[var(--ds-on-primary)] border-[var(--ds-primary)]'
                              : 'bg-[var(--ds-surface)] text-[var(--ds-text)] border-[var(--ds-border)] hover:bg-[var(--ds-raised)]'
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>

                  {/* Day Inputs Form */}
                  {(() => {
                    const activeEditorMenu = editorIsFasting ? editFastingWeeklyMenu : editWeeklyMenu;
                    const activeDayData = activeEditorMenu.find(m => m.day === editorSelectedDay) || {
                      day: editorSelectedDay, breakfast: '', lunch: '', dinner: '', price: 100
                    };

                    return (
                      <div className="bg-[var(--ds-surface)] p-4 rounded-xl border border-[var(--ds-border)] space-y-3 animate-fade-in text-right">
                        <div className="text-[11px] font-extrabold text-[var(--ds-primary)] border-b pb-1 flex justify-between items-center">
                          <span>📝 وجبات وأسعار يوم ({editorSelectedDay}) - {editorIsFasting ? 'النظام الصيامي' : 'النظام الفطاري'}</span>
                          <span className="text-[11px] text-amber-600">يرجى كتابة الوجبة بدقة بالتفصيل</span>
                        </div>

                        <div className="space-y-2.5">
                          {/* Breakfast */}
                          <div className="flex flex-col gap-1">
                            <span className="text-[11px] font-extrabold text-[var(--ds-text-2)]">🍳 وجبة الإفطار:</span>
                            <textarea
                              rows={2}
                              value={activeDayData.breakfast || ''}
                              onChange={(e) => handleDayMealChange(editorSelectedDay, 'breakfast', e.target.value)}
                              className="w-full text-[12px] font-semibold rounded-lg border-[var(--ds-border)] focus:border-[var(--ds-primary)] focus:ring-1 focus:ring-[var(--ds-primary)] p-2"
                              placeholder="اكتب مكونات وجبة الإفطار هنا..."
                            />
                          </div>

                          {/* Lunch */}
                          <div className="flex flex-col gap-1">
                            <span className="text-[11px] font-extrabold text-[var(--ds-text-2)]">🍖 وجبة الغداء:</span>
                            <textarea
                              rows={2}
                              value={activeDayData.lunch || ''}
                              onChange={(e) => handleDayMealChange(editorSelectedDay, 'lunch', e.target.value)}
                              className="w-full text-[12px] font-semibold rounded-lg border-[var(--ds-border)] focus:border-[var(--ds-primary)] focus:ring-1 focus:ring-[var(--ds-primary)] p-2"
                              placeholder="اكتب مكونات وجبة الغداء بالتفصيل..."
                            />
                          </div>

                          {/* Dinner */}
                          <div className="flex flex-col gap-1">
                            <span className="text-[11px] font-extrabold text-[var(--ds-text-2)]">🍲 وجبة العشاء:</span>
                            <textarea
                              rows={2}
                              value={activeDayData.dinner || ''}
                              onChange={(e) => handleDayMealChange(editorSelectedDay, 'dinner', e.target.value)}
                              className="w-full text-[12px] font-semibold rounded-lg border-[var(--ds-border)] focus:border-[var(--ds-primary)] focus:ring-1 focus:ring-[var(--ds-primary)] p-2"
                              placeholder="اكتب مكونات وجبة العشاء..."
                            />
                          </div>

                          {/* Day Price - This is exactly what the user wanted: "اضافة الاسعار الخاصه بكل يوم" */}
                          <div className="bg-[color-mix(in_srgb,var(--ds-warning)_5%,transparent)] p-3 rounded-lg border border-[color-mix(in_srgb,var(--ds-warning)_18%,transparent)] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                            <div className="space-y-0.5">
                              <span className="text-[11px] font-extrabold text-[var(--ds-warning-deep)] block">💰 سعر طعام اليوم ({editorSelectedDay}):</span>
                              <span className="text-[11px] text-[var(--ds-warning-ink)] font-semibold block">سعر الوجبات الثلاث الإجمالي لهذا اليوم تحديداً للفرد</span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0 w-full sm:w-auto">
                              <input
                                type="number"
                                min={0}
                                value={activeDayData.price || ''}
                                onChange={(e) => handleDayMealChange(editorSelectedDay, 'price', Number(e.target.value))}
                                className="w-24 text-[12px] font-bold rounded-lg border-[color-mix(in_srgb,var(--ds-warning)_30%,transparent)] focus:border-[var(--ds-primary)] focus:ring-1 focus:ring-[var(--ds-primary)] p-1 text-center text-[var(--ds-primary)]"
                                placeholder="مثال: 120"
                              />
                              <span className="text-[11px] font-extrabold text-[var(--ds-warning-deep)]">ج.م / فرد</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Save button footer inside form */}
                  <div className="flex gap-2 justify-end pt-2 border-t border-[var(--ds-border)]">
                    <button
                      type="button"
                      onClick={handleSaveMenuChanges}
                      className="bg-[var(--ds-success)] text-[var(--ds-on-success)] text-[12px] font-extrabold px-5 py-2 rounded-xl hover:bg-[var(--ds-success)] transition-all cursor-pointer shadow-sm"
                    >
                      💾 حفظ التعديلات وحفظ المنيو بالكامل
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingMenu(false)}
                      className="bg-[var(--ds-border)] text-[var(--ds-text)] text-[12px] font-extrabold px-4 py-2 rounded-xl hover:bg-[var(--ds-border)] transition-all cursor-pointer"
                    >
                      إلغاء التعديل
                    </button>
                  </div>
                </div>
              ) : (
                /* --- STANDARD VIEW --- */
                <>
                  {/* Diet preferences & pricing cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="bg-[var(--ds-surface)] p-2.5 rounded-2xl border border-[var(--ds-border)]/40 flex flex-col justify-between text-right">
                      <span className="text-[11px] text-[var(--ds-text-2)] font-bold block mb-0.5">توفير الطعام والوجبات:</span>
                      <span className="text-[11px] font-extrabold text-[var(--ds-text)]">
                        {house.menu?.isIncluded ? 'مشمول في قيمة الحجز الأساسي' : 'غير مشمول (اختياري)'}
                      </span>
                    </div>

                    <div className="bg-[var(--ds-surface)] p-2.5 rounded-2xl border border-[var(--ds-border)]/40 flex flex-col justify-between text-right">
                      <span className="text-[11px] text-[var(--ds-text-2)] font-bold block mb-0.5">تكلفة الوجبة الإضافية:</span>
                      <span className="text-[11px] font-extrabold text-[var(--ds-text)]">
                        {house.menu?.extraMealPrice ? `${house.menu.extraMealPrice} ج.م / فرد` : 'غير متوفر'}
                      </span>
                    </div>

                    <div className="bg-[var(--ds-surface)] p-2.5 rounded-2xl border border-[var(--ds-border)]/40 flex flex-col justify-between text-right">
                      <span className="text-[11px] text-[var(--ds-text-2)] font-bold block mb-0.5">أنظمة غذائية خاصة:</span>
                      <div className="flex gap-1 mt-0.5">
                        <span className="text-[11px] font-extrabold bg-[color-mix(in_srgb,var(--ds-success)_11%,transparent)] text-[var(--ds-success-ink)] px-1.5 py-0.5 rounded-md">
                          🌿 صيامي
                        </span>
                        <span className="text-[11px] font-extrabold bg-teal-100/70 text-teal-800 px-1.5 py-0.5 rounded-md">
                          🌱 نباتي
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Fasting vs Regular Menu Selector */}
                  <div className="flex bg-[var(--ds-surface)] p-1 rounded-2xl gap-1" dir="rtl">
                    <button
                      type="button"
                      onClick={() => {
                        setIsFastingMenu(false);
                        const firstDay = house.menu?.weeklyMenu?.[0]?.day || 'السبت';
                        setSelectedMenuDay(firstDay);
                      }}
                      className={`flex-1 py-2 text-center text-[11px] font-extrabold rounded-xl transition-all cursor-pointer ${
                        !isFastingMenu
                          ? 'bg-[var(--ds-primary)] text-[var(--ds-on-primary)] shadow-sm'
                          : 'text-[var(--ds-primary)] hover:bg-[var(--ds-raised)]'
                      }`}
                    >
                      🥩 نظام الوجبات الفطاري المعتاد
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsFastingMenu(true);
                        const fastMenu = house.menu?.fastingWeeklyMenu || DEFAULT_FASTING_MENU;
                        const firstDay = fastMenu?.[0]?.day || 'السبت';
                        setSelectedMenuDay(firstDay);
                      }}
                      className={`flex-1 py-2 text-center text-[11px] font-extrabold rounded-xl transition-all cursor-pointer ${
                        isFastingMenu
                          ? 'bg-[var(--ds-success)] text-[var(--ds-on-success)] shadow-sm'
                          : 'text-[var(--ds-success-ink)] hover:bg-[color-mix(in_srgb,var(--ds-success)_10%,transparent)]'
                      }`}
                    >
                      🌿 نظام الوجبات الصيامي (نباتي/أسماك)
                    </button>
                  </div>

                  {(() => {
                    const activeMenu = isFastingMenu 
                      ? (house.menu?.fastingWeeklyMenu || DEFAULT_FASTING_MENU) 
                      : (house.menu?.weeklyMenu || [
                          { day: 'السبت', breakfast: 'فول بالزيت الحار وجبنة بيضاء بالخيار وعيش طازج', lunch: 'فراخ مشوية وأرز بسمتي وسلطة خضراء', dinner: 'بيض مسلوق وجبنة بيضاء وزبادي ومربى', price: 120 },
                          { day: 'الأحد', breakfast: 'طعمية سخنة وبابا غنوج وبطاطس محمرة وعيش دافئ', lunch: 'لحمة كباب حلة ومكرونة بالصلصة وشوربة خضار', dinner: 'جبنة قريش بالطماطم وزيت زيتون وعسل نحل وعيش', price: 140 },
                          { day: 'الاثنين', breakfast: 'بيض مسلوق بالزبدة وجبنة نستو وعسل أسود وحلاوة وعيش', lunch: 'صينية بطاطس بالفراخ في الفرن وأرز مصري بالشعرية وسلطة خضراء', dinner: 'شعرية باللبن دافئة أو شاي بلبن وبسكويت', price: 110 },
                          { day: 'الثلاثاء', breakfast: 'فول مدمس بالليمون والكمون وبيض أومليت وخيار وجبن', lunch: 'كفتة مشوية على الفحم وأرز بسمتي أصفر وسلطة طحينة وسلطة خضراء', dinner: 'كلوب ساندوتش تونة بالبصل والفلفل والألوان وبطاطس محمرة', price: 130 },
                          { day: 'الأربعاء', breakfast: 'بيض عيون وبطاطس بوريه بالزبدة وجبنة رومي ومربى وعيش', lunch: 'سمك فيليه مقلي مقرمش وأرز صيادية بني متبل وسلطة خضراء وطحينة', dinner: 'فطيرة زعتر وجبنة بيضاء ثلاجة وشاي دافئ بالنعناع', price: 115 },
                          { day: 'الخميس', breakfast: 'بوفيه صغير: أجبان مشكلة ولانشون وفول وعسل نحل وتوست ومربى', lunch: 'بفتيك لحم بقري محمر ومكرونة وايت صوص بالمشروم وبطاطس فارم فريتس', dinner: 'بيتزا مارجريتا أو خضار خفيفة وسلطة زيتون طازجة', price: 135 },
                          { day: 'الجمعة', breakfast: 'فول مدمس بالسمن البلدي وطعمية سخنة وباذنجان مخلل وجرجير وعيش بلدي', lunch: 'أرز معمر بالفراخ البلدي وملوخية مصرية دافئة وسلطات ومخلل مشكل', dinner: 'عشاء خفيف: أجبان مشكلة وقشطة وعسل بلدي وعيش بلدي سخن', price: 125 }
                        ]);

                    if (!showFullMenu) {
                      return (
                        // Daily Interactive Tabbed View
                        <div className="space-y-3">
                          {/* Days horizontal tab bar */}
                          <div className="flex gap-1 overflow-x-auto pb-1.5 scrollbar-thin scrollbar-thumb-gray-200 animate-fade-in" dir="rtl">
                            {activeMenu.map((menuDay) => {
                              const isSelected = selectedMenuDay === menuDay.day || (!selectedMenuDay && activeMenu[0]?.day === menuDay.day);
                              return (
                                <button
                                  key={menuDay.day}
                                  id={`menu-tab-${menuDay.day}`}
                                  type="button"
                                  onClick={() => setSelectedMenuDay(menuDay.day)}
                                  className={`px-3 py-1.5 rounded-xl text-[11px] font-extrabold transition-all shrink-0 cursor-pointer border flex flex-col items-center ${
                                    isSelected
                                      ? isFastingMenu 
                                        ? 'bg-[var(--ds-success)] text-[var(--ds-on-success)] border-[var(--ds-success)] shadow-sm'
                                        : 'bg-[var(--ds-primary)] text-[var(--ds-on-primary)] border-[var(--ds-primary)] shadow-sm'
                                      : 'bg-[var(--ds-surface)] text-[var(--ds-text)] border-[var(--ds-border)] hover:bg-[var(--ds-surface)]'
                                  }`}
                                >
                                  <span>{menuDay.day}</span>
                                  {menuDay.price && (
                                    <span className={`text-[11px] font-bold mt-0.5 ${isSelected ? 'text-[color-mix(in_srgb,var(--ds-on-primary)_90%,transparent)]' : 'text-[var(--ds-text-2)]'}`}>
                                      {menuDay.price} ج.م
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>

                          {/* Selected Day's Meals */}
                          {(() => {
                            const currentDay = activeMenu.find(m => m.day === selectedMenuDay) || activeMenu[0];
                            if (!currentDay) return <p className="text-[12px] text-center text-[var(--ds-text-2)]">لا توجد وجبات متاحة</p>;
                            return (
                              <div className="space-y-2.5 animate-fade-in text-right">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                  {/* Breakfast */}
                                  <div className="bg-amber-50/40 border border-amber-200/50 rounded-2xl p-3 space-y-1.5">
                                    <div className="flex items-center gap-1.5">
                                      <span className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center text-[11px]">🍳</span>
                                      <span className="text-[11px] font-extrabold text-amber-950">وجبة الإفطار {isFastingMenu && ' (صيامي)'}</span>
                                    </div>
                                    <p className="text-[11px] font-bold text-amber-900 leading-relaxed min-h-[36px]">{currentDay.breakfast || 'لم تحدد'}</p>
                                  </div>

                                  {/* Lunch */}
                                  <div className={`${isFastingMenu ? 'bg-emerald-50/40 border-emerald-200/50' : 'bg-[var(--ds-primary)]/5 border-[var(--ds-primary)]/10'} border rounded-2xl p-3 space-y-1.5`}>
                                    <div className="flex items-center gap-1.5">
                                      <span className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-[11px]">{isFastingMenu ? '🐟' : '🍖'}</span>
                                      <span className="text-[11px] font-extrabold text-emerald-950">وجبة الغداء {isFastingMenu && ' (صيامي)'}</span>
                                    </div>
                                    <p className="text-[11px] font-bold text-emerald-900 leading-relaxed min-h-[36px]">{currentDay.lunch || 'لم تحدد'}</p>
                                  </div>

                                  {/* Dinner */}
                                  <div className="bg-purple-50/40 border border-purple-200/50 rounded-2xl p-3 space-y-1.5">
                                    <div className="flex items-center gap-1.5">
                                      <span className="w-5 h-5 rounded-full bg-purple-100 flex items-center justify-center text-[11px]">🍲</span>
                                      <span className="text-[11px] font-extrabold text-purple-950">وجبة العشاء {isFastingMenu && ' (صيامي)'}</span>
                                    </div>
                                    <p className="text-[11px] font-bold text-purple-900 leading-relaxed min-h-[36px]">{currentDay.dinner || 'لم تحدد'}</p>
                                  </div>
                                </div>

                                {currentDay.price && (
                                  <div className="bg-[var(--ds-surface)] border border-[var(--ds-border)]/60 p-2.5 rounded-2xl flex justify-between items-center text-[11px] font-bold text-[var(--ds-text)]">
                                    <span className="text-[var(--ds-text-2)]">💰 سعر الوجبات المخصصة لهذا اليوم ({currentDay.day}):</span>
                                    <span className="text-[var(--ds-primary)] text-[12px] font-extrabold bg-[var(--ds-primary)]/5 px-3 py-1 rounded-lg">
                                      {currentDay.price} ج.م / للفرد
                                    </span>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      );
                    } else {
                      return (
                        // Full Weekly Grid/List View
                        <div className="space-y-2 max-h-80 overflow-y-auto pr-1 border border-[var(--ds-border)]/50 p-2.5 rounded-2xl bg-[var(--ds-surface)] divide-y divide-[var(--ds-border)]/30">
                          {activeMenu.map((menuDay) => (
                            <div key={menuDay.day} className="py-2.5 first:pt-0 last:pb-0 text-right">
                              <div className="font-extrabold text-[var(--ds-primary)] text-[11px] mb-1.5 flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--ds-primary)]" />
                                  {menuDay.day}
                                </div>
                                {menuDay.price && (
                                  <span className="text-[11px] bg-[var(--ds-primary)]/10 text-[var(--ds-primary)] px-2 py-0.5 rounded-lg font-black">
                                    سعر اليوم: {menuDay.price} ج.م / فرد
                                  </span>
                                )}
                              </div>
                              <div className="grid grid-cols-3 gap-2 text-right">
                                <div className="bg-[var(--ds-surface)] p-2 rounded-xl border border-[var(--ds-border)]/30">
                                  <span className="text-[11px] text-amber-800 font-bold block mb-0.5">🍳 إفطار {isFastingMenu && 'صيامي'}</span>
                                  <p className="text-[11px] text-[var(--ds-text)] font-semibold leading-relaxed">{menuDay.breakfast || 'غير محدد'}</p>
                                </div>
                                <div className="bg-[var(--ds-surface)] p-2 rounded-xl border border-[var(--ds-border)]/30">
                                  <span className="text-[11px] text-emerald-800 font-bold block mb-0.5">{isFastingMenu ? '🐟' : '🍖'} غداء {isFastingMenu && 'صيامي'}</span>
                                  <p className="text-[11px] text-[var(--ds-text)] font-semibold leading-relaxed">{menuDay.lunch || 'غير محدد'}</p>
                                </div>
                                <div className="bg-[var(--ds-surface)] p-2 rounded-xl border border-[var(--ds-border)]/30">
                                  <span className="text-[11px] text-purple-800 font-bold block mb-0.5">🍲 عشاء {isFastingMenu && 'صيامي'}</span>
                                  <p className="text-[11px] text-[var(--ds-text)] font-semibold leading-relaxed">{menuDay.dinner || 'غير محدد'}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    }
                  })()}

                  {/* Special Note */}
                  <div className="bg-[color-mix(in_srgb,var(--ds-warning)_5%,transparent)] border border-[color-mix(in_srgb,var(--ds-warning)_15%,transparent)] p-2.5 rounded-xl flex items-start gap-2 text-[11px] text-[var(--ds-warning-deep)] leading-relaxed text-right" dir="rtl">
                    <span className="text-[12px] shrink-0">💡</span>
                    <p className="font-bold">
                      ملحوظة: يمكنك طلب تعديل النظام الغذائي للجروب بالكامل بالتنسيق مع مالك البيت مسبقاً قبل التسكين، لضمان تلبية خيارات الوجبات الصيامي والأطعمة النباتية والصحية للمخدومين.
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
          </ExploreCard>

          {/* Rooms and Beds breakdown */}
          <ExploreCard
            id="rooms"
            title="الغرف والتسكين"
            subtitle="أنواع الغرف المتاحة وسعة كل منها"
            icon={BedDouble}
            place="right-bottom"
            delay={2}
            cta="عرض الغرف"
            image={house.images?.[1] || house.images?.[0]}
            imageMode="band"
            preview={roomsPreview}
          >
            {/* One totals line, not the two identical ones that were here. */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black bg-[color-mix(in_srgb,var(--ds-accent)_12%,var(--ds-surface))] text-[var(--ds-accent-deep)] px-3 py-1 rounded-full">
                {arabicNumber(house.roomsCount)} غرفة
              </span>
              <span className="text-[11px] font-black bg-[color-mix(in_srgb,var(--ds-accent)_12%,var(--ds-surface))] text-[var(--ds-accent-deep)] px-3 py-1 rounded-full">
                {arabicNumber(house.bedsCount)} سرير
              </span>
            </div>
            
            <p className="text-[12px] text-[var(--ds-text-2)] leading-relaxed font-medium">{house.roomsDescription}</p>

            {/* Actual rooms added by the owner (real availability, not the illustrative grid below) */}
            {rooms.length > 0 && (
              <div className="space-y-2 pt-1">
                <span className="text-[11px] font-extrabold text-[var(--ds-text)]">حالة الغرف المتاحة فعلياً:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {rooms.map((room) => (
                    <div key={room.id} className="flex items-center justify-between bg-[var(--ds-bg)] border border-[var(--ds-border)] rounded-xl px-3 py-2">
                      <div>
                        <span className="text-[11px] font-bold text-[var(--ds-text)] block">{room.name}</span>
                        <span className="text-[11px] text-[var(--ds-text-2)]">
                          {arabicNumber(room.bedsCount)} سرير{room.pricePerNight ? ` · ${arabicNumber(room.pricePerNight)} ج.م/ليلة` : ''}
                        </span>
                      </div>
                      {/* Only the two states rooms.status still genuinely
                          knows, because they are the two an owner sets by
                          hand. This used to print «متاحة» for every room that
                          was not hand-flagged — including rooms fully
                          allocated on the requested dates — because nothing
                          has written 'booked' since migration 051 moved
                          occupancy to room_allocations. Whether a room is free
                          on a date is answered by roomOccupancy, and this list
                          has no dates to answer it for, so it now says nothing
                          rather than something false. */}
                      {(room.status === 'maintenance' || room.status === 'cleaning') && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 bg-[color-mix(in_srgb,var(--ds-danger)_10%,transparent)] text-[var(--ds-danger-ink)] border border-[color-mix(in_srgb,var(--ds-danger)_30%,transparent)]">
                          {room.status === 'maintenance' ? 'صيانة' : 'تحضير'}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Room Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3" dir="rtl">
              {(() => {
                // Built from what the owner actually entered — their room
                // types, or failing that their rooms grouped by size. What
                // stood here was a literal of three room types, identical on
                // every house on the platform: a hotel single, a standard
                // double, and a «جناح خاص / للآباء الكهنة والعائلات» — each
                // with a stock photograph, a written description, invented
                // features (ميني بار، شرفة مستقلة، شاشة ذكية، إطلالة
                // بانورامية) and a price got by multiplying the house rate.
                // No owner could add one, edit one or remove one, because
                // none of them existed anywhere but in this file.
                const offerings = buildRoomOfferings(house, rooms ?? [], roomTypes ?? []);
                if (offerings.length === 0) {
                  return (
                    <div className="md:col-span-3 bg-[var(--ds-raised)]/30 border border-[var(--ds-border)] rounded-2xl p-4 text-center">
                      <p className="text-[11px] text-[var(--ds-text-2)] font-bold leading-relaxed">
                        صاحب البيت لسه ما أضافش تفاصيل الغرف. تقدر تسأله عن الأنواع والأسعار من خلال طلب الحجز.
                      </p>
                    </div>
                  );
                }
                return offerings.map((room) => {
                  const isSelected = selectedRoomId === room.id;
                  return (
                    <div
                      key={room.id}
                      className={`group bg-[var(--ds-surface)] rounded-2xl border transition-all duration-300 overflow-hidden flex flex-col justify-between ${
                        isSelected
                          ? 'border-[var(--ds-primary)] shadow-md ring-1 ring-[var(--ds-primary)]'
                          : 'border-[var(--ds-border)] hover:border-[var(--ds-text-2)] hover:shadow-sm'
                      }`}
                    >
                      {/* The owner's own photograph, or nothing. A stock
                          picture of a room that is not this one is worse
                          than no picture. */}
                      <div className="relative h-28 w-full overflow-hidden bg-[var(--ds-raised)]/50">
                        {room.image ? (
                          <img
                            src={room.image}
                            alt={room.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <BedDouble className="w-7 h-7 text-[var(--ds-text-faint)]" />
                          </div>
                        )}
                        <div className="absolute top-2 right-2 bg-[var(--ds-primary)] text-[var(--ds-on-primary)] text-[11px] font-black px-2 py-0.5 rounded-full shadow-sm">
                          👤 {room.capacityLabel}
                        </div>
                      </div>

                      <div className="p-3.5 space-y-2 text-right flex-1 flex flex-col justify-between">
                        <div>
                          <h4 className="text-[11px] font-extrabold text-[var(--ds-text)] group-hover:text-[var(--ds-primary)] transition-colors">
                            {room.name}
                          </h4>
                          {/* Real counts instead of a written-in blurb. */}
                          <p className="text-[11px] text-[var(--ds-text-2)] leading-relaxed font-semibold mt-1">
                            {room.count > 0
                              ? <>{arabicNumber(room.count)} غرفة من النوع ده{room.outOfServiceCount > 0 ? ` · ${arabicNumber(room.outOfServiceCount)} خارج الخدمة` : ''}</>
                              : 'غرفة متاحة للحجز'}
                          </p>
                          {room.description && (
                            <p className="text-[11px] text-[var(--ds-text-2)] leading-relaxed font-semibold mt-1 line-clamp-2">
                              {room.description}
                            </p>
                          )}
                        </div>

                        <div className="pt-2 border-t border-[var(--ds-border)]/40 mt-2 space-y-2">
                          <div className="flex justify-between items-baseline">
                            <span className="text-[11px] text-[var(--ds-text-2)] font-bold">السعر:</span>
                            <span className="text-[12px] font-black text-[var(--ds-primary)]">
                              {arabicNumber(room.price)} ج.م <span className="text-[11px] text-[var(--ds-text-2)] font-bold">/ {room.priceUnit}</span>
                            </span>
                          </div>

                          {room.features.length > 0 && (
                            <button
                              id={`room-detail-btn-${room.id}`}
                              type="button"
                              onClick={() => setSelectedRoomId(isSelected ? null : room.id)}
                              className={`w-full py-1.5 rounded-xl text-[11px] font-black transition-all cursor-pointer text-center ${
                                isSelected ? 'bg-[var(--ds-primary)] text-[var(--ds-on-primary)]' : 'bg-[var(--ds-raised)]/40 text-[var(--ds-primary)] hover:bg-[var(--ds-raised)]'
                              }`}
                            >
                              {isSelected ? 'إخفاء التجهيزات' : 'عرض التجهيزات'}
                            </button>
                          )}
                        </div>
                      </div>

                      {isSelected && room.features.length > 0 && (
                        <div className="bg-[var(--ds-surface)] border-t border-[var(--ds-border)] p-3.5 text-right space-y-1.5 animate-fade-in text-[11px]">
                          <span className="font-extrabold text-[var(--ds-primary)] text-[11px]">التجهيزات:</span>
                          <div className="grid grid-cols-2 gap-1.5 text-right">
                            {room.features.map((feature, idx) => (
                              <div key={idx} className="flex items-center gap-1 text-[11px] text-[var(--ds-text)] font-bold">
                                <span className="text-[var(--ds-success)] text-[12px] shrink-0">✓</span>
                                <span>{feature}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          </ExploreCard>

          {/* Facilities Section */}
          <ExploreCard
            id="facilities"
            title="المرافق والقاعات"
            subtitle="قاعات المؤتمرات والمطاعم والأنشطة"
            icon={Users}
            place="full"
            horizontal
            delay={3}
            cta="عرض كل المرافق"
            decor={facilityDecor}
            preview={facilityPreview}
          >
            <div className="space-y-4">
              {/* Conference Halls (القاعات) */}
              <div className="space-y-3 text-right">
                <span className="font-extrabold text-[var(--ds-brand)] text-[11px] block">قاعات الاجتماعات والمؤتمرات:</span>
                {house.conferenceHalls.length === 0 ? (
                  <p className="text-[11px] text-[var(--ds-text-2)]">لا تتوفر قاعات اجتماعات خاصة، الاجتماعات تقام بالساحات الخارجية.</p>
                ) : (
                  <div className="space-y-2.5">
                    {house.conferenceHalls.map((hall) => (
                      <div key={hall.id} className="bg-[var(--ds-raised)]/30 border border-[var(--ds-border)] p-3 rounded-2xl flex justify-between items-center text-[12px]">
                        <div>
                          <div className="font-bold text-[var(--ds-text)]">{hall.name}</div>
                          <div className="text-[11px] text-[var(--ds-text-2)] font-semibold mt-0.5">تتسع لـ: {arabicNumber(hall.capacity)} فرد</div>
                          {hall.price !== undefined && (
                            <div className="text-[11px] text-[var(--ds-primary)] font-bold mt-0.5">{arabicNumber(hall.price)} جنيه / اليوم</div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {hall.hasSoundSystem && (
                            <span className="p-1 bg-[var(--ds-surface)] border border-[var(--ds-border)] rounded-lg text-[var(--ds-primary)]" title="أنظمة صوت مدمجة">
                              <Volume2 className="w-3.5 h-3.5 text-[var(--ds-primary)]" />
                            </span>
                          )}
                          {hall.hasProjector && (
                            <span className="p-1 bg-[var(--ds-surface)] border border-[var(--ds-border)] rounded-lg text-[var(--ds-text-2)]" title="بروجيكتور وشاشات عرض">
                              <Monitor className="w-3.5 h-3.5 text-[var(--ds-text-2)]" />
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Amenities checklist */}
              <div className="space-y-3 pt-3 border-t border-[var(--ds-border)]/30 text-right">
                <span className="font-extrabold text-[var(--ds-brand)] text-[11px] block">المرافق والخدمات المتوفرة:</span>
                <div className="grid grid-cols-2 gap-2 text-[12px]">
                  {house.services.map((srv) => (
                    <div key={srv} className="flex items-center gap-2 text-[var(--ds-text)] bg-[var(--ds-raised)]/20 p-1.5 rounded-xl border border-[var(--ds-border)]">
                      <span className="w-4 h-4 rounded-full bg-[var(--ds-raised)] border border-[var(--ds-text-faint)] text-[var(--ds-primary)] flex items-center justify-center shrink-0">
                        <Check className="w-2.5 h-2.5" />
                      </span>
                      <span className="font-semibold text-[11px] text-[var(--ds-text)]">{srv}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ExploreCard>

          {/* Weather card — temporarily off at the owner's request (2026-08-01).
              Flip SHOW_WEATHER_CARD to bring it back exactly as it was; the
              card, its preview and the governorate data all stay compiled so
              nothing rots while it is hidden. */}
          {SHOW_WEATHER_CARD && (
          <ExploreCard
            id="weather"
            title="حالة الطقس"
            subtitle={`التخطيط للرحلة في ${house.governorate}`}
            icon={CloudSun}
            place="full"
            tone="cream"
            delay={3}
            cta="عرض تفاصيل الطقس"
            preview={weatherPreview}
          >
            {(() => {
              const weather = GOVERNORATE_WEATHER_DATA[house.governorate] || DEFAULT_WEATHER;
              return (
                <div className="space-y-4 text-right" dir="rtl">
                  {/* The section header already names the place and the
                      purpose; all that is left to say here is how fresh it is. */}
                  <div className="flex items-center justify-end">
                    <span className="text-[11px] bg-[color-mix(in_srgb,var(--ds-success)_10%,transparent)] text-[var(--ds-success-ink)] border border-[color-mix(in_srgb,var(--ds-success)_15%,transparent)] px-2 py-0.5 rounded-full font-bold">
                      مباشر ومحدث
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-center">
                    {/* Current conditions */}
                    <div className="bg-[var(--ds-raised)]/20 border border-[var(--ds-border)] p-3 rounded-2xl flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="text-[11px] font-bold text-[var(--ds-text-2)]">الطقس الحالي</span>
                        <div className="text-[12px] font-black text-[var(--ds-text)]">{weather.conditionText}</div>
                        <div className="flex gap-2 text-[11px] text-[var(--ds-text-2)] pt-1">
                          <span className="flex items-center gap-0.5">
                            <Droplets className="w-3 h-3 text-blue-400" />
                            رطوبة: {arabicNumber(weather.humidity)}٪
                          </span>
                          <span className="flex items-center gap-0.5">
                            <Wind className="w-3 h-3 text-teal-400" />
                            رياح: {arabicNumber(weather.windSpeed)} كم/س
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-center justify-center bg-[var(--ds-surface)] border border-[var(--ds-border)] rounded-xl px-2.5 py-1.5 shadow-sm">
                        <span className="text-lg font-black text-[var(--ds-primary)] tracking-tight">{arabicNumber(weather.currentTemp)}°م</span>
                        <Thermometer className="w-4 h-4 text-[var(--ds-danger)] fill-[color-mix(in_srgb,var(--ds-danger)_16%,transparent)]" />
                      </div>
                    </div>

                    {/* 3-day short forecast */}
                    <div className="space-y-1.5">
                      <span className="block text-[11px] font-extrabold text-[var(--ds-text-2)]">توقعات الأيام الثلاثة القادمة:</span>
                      <div className="grid grid-cols-3 gap-1.5 text-center">
                        {weather.forecast.map((day, idx) => (
                          <div key={idx} className="bg-[var(--ds-surface)] border border-[var(--ds-border)]/60 p-2 rounded-xl space-y-1">
                            <div className="text-[11px] font-extrabold text-[var(--ds-text-2)]">{day.dayName}</div>
                            <div className="flex justify-center py-0.5">
                              {getWeatherIcon(day.icon)}
                            </div>
                            <div className="text-[11px] font-black text-[var(--ds-text)]">{arabicNumber(day.tempHigh)}° / {arabicNumber(day.tempLow)}°</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Recommendation and Planning tip */}
                  <div className="bg-[color-mix(in_srgb,var(--ds-warning)_5%,transparent)] border border-[color-mix(in_srgb,var(--ds-warning)_18%,transparent)] rounded-2xl p-3.5 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-[var(--ds-warning-deep)]">
                      <span className="text-[12px]">💡</span>
                      <span>توصية التخطيط للرحلة والأنشطة:</span>
                    </div>
                    <p className="text-[11px] font-medium text-[var(--ds-warning-deep)] leading-relaxed">
                      {weather.recommendation}
                    </p>
                  </div>
                </div>
              );
            })()}
          </ExploreCard>
          )}
      </ExploreSection>

      {/* Booking, availability and the trip calculator. */}
      <div className="space-y-4">

          {/* Booking action card. Not a card with a button in it — the whole
              thing is one control, and its bottom edge IS the action, so the
              eye runs price → reassurance → book without a seam. */}
          <button
            id="open-booking-flow"
            type="button"
            onClick={() => { tapFeedback(); setBookingOpen(true); }}
            aria-label="احجز الآن"
            className="group block w-full text-right rounded-[30px] overflow-hidden bg-[var(--ds-bg)] border border-[var(--ds-accent)]/10 shadow-[0_10px_30px_rgba(45,45,36,0.07),0_2px_8px_rgba(45,45,36,0.04)] hover:shadow-[0_14px_36px_rgba(201,162,74,0.18),0_3px_10px_rgba(45,45,36,0.06)] active:scale-[0.98] transition-[transform,box-shadow] duration-200 ease-in-out cursor-pointer"
          >
            <div className="flex items-stretch gap-4 p-5">
              {/* Zone one: the number carries the card. */}
              <div className="basis-[35%] shrink-0 text-center leading-none">
                <span className="block text-[11px] font-black text-[var(--ds-accent)]">ابتداءً من</span>
                <span className="flex items-baseline justify-center gap-1 my-2">
                  <span className="text-[40px] font-black text-[var(--ds-brand)] [font-variant-numeric:tabular-nums]">
                    {arabicNumber(isMonthlyHousing ? (house.monthlyRent || 0) : house.pricePerNightPerPerson)}
                  </span>
                  <span className="text-[12px] font-black text-[var(--ds-brand)]">ج.م</span>
                </span>
                <span className="block text-[11px] font-medium text-[var(--ds-text-2)]">
                  {isMonthlyHousing ? 'لكل فرد / شهر' : 'لكل فرد / ليلة'}
                </span>
                {/* The other rate this house sells, where it sells one. Under
                    the nightly figure rather than beside it: it is the second
                    answer to the same question, not a competing headline. */}
                {offersDayUse(house) && (
                  <span className="block text-[11px] font-bold text-[var(--ds-accent-deep)] mt-2 leading-snug">
                    أو {arabicNumber(house.dayUsePricePerPerson as number)} ج.م
                    <br />
                    <span className="font-medium text-[var(--ds-text-2)]">لليوم بدون مبيت</span>
                  </span>
                )}
                <span aria-hidden="true" className="block w-12 h-0.5 rounded-full bg-[var(--ds-accent)]/30 mx-auto mt-3" />
              </div>

              <span aria-hidden="true" className="w-px self-stretch bg-[var(--ds-accent)]/15" />

              {/* Zone two: the reassurance, compact and beside the price rather
                  than stacked under it — no empty middle. */}
              <div className="flex-1 min-w-0 flex items-center gap-3">
                <span className="w-11 h-11 rounded-full bg-[color-mix(in_srgb,var(--ds-accent)_16%,var(--ds-surface))] flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5 text-[var(--ds-accent)]" />
                </span>
                <span className="min-w-0 leading-snug">
                  <span className="block text-[12px] font-black text-[var(--ds-brand)]">لن يتم خصم أي مبلغ الآن</span>
                  <span className="block text-[11px] font-medium text-[var(--ds-text-2)] mt-1">
                    سيتم مراجعة طلبك من إدارة المكان أولاً قبل تأكيد الحجز.
                  </span>
                </span>
              </div>
            </div>

            {/* Zone three: the bottom edge of the card, and the action. It
                inherits the card's radius because the card clips it. */}
            <span className="flex items-center h-14 px-5 bg-gradient-to-l from-[var(--ds-accent-deep)] via-[var(--ds-accent)] to-[#D6AE5C] text-white transition-[filter] duration-200 ease-in-out group-active:brightness-95">
              <CalendarDays className="w-5 h-5 shrink-0" />
              <span className="flex-1 text-center text-[16px] font-black">احجز الآن</span>
              <ChevronLeft className="w-5 h-5 shrink-0 transition-transform duration-200 ease-in-out group-active:-translate-x-1" />
            </span>
          </button>

      {/* Occupancy calendar. A month grid is a lot of screen for something a
          visitor consults rather than reads, so it sits behind a card that
          leads with the one number they actually want: how many nights are
          still free. */}
      <button
        type="button"
        onClick={() => { tapFeedback(); setAvailabilityOpen(true); }}
        className="w-full bg-[var(--ds-surface)] rounded-3xl p-5 border border-[var(--ds-border)] shadow-[0_8px_24px_rgba(0,0,0,0.06),0_2px_6px_rgba(0,0,0,0.03)] flex items-center gap-3 text-right cursor-pointer pima-press hover:border-[var(--ds-accent-soft)] transition-colors"
      >
        <span className="w-12 h-12 rounded-full bg-[color-mix(in_srgb,var(--ds-accent)_12%,var(--ds-surface))] flex items-center justify-center shrink-0">
          <Calendar className="w-5 h-5 text-[var(--ds-accent)]" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[12px] font-black text-[var(--ds-brand)]">جدول الإشغال</span>
          <span className="block text-[11px] font-medium text-[var(--ds-text-2)] leading-snug mt-0.5">
            {freeCalendarDays > 0
              ? <>{arabicNumber(freeCalendarDays)} من {arabicNumber(CALENDAR_DAYS.length)} يوم متاحة في {calendarMonthLabel}</>
              : <>لا توجد أيام متاحة في {calendarMonthLabel}</>}
          </span>
        </span>
        <ChevronLeft className="w-4 h-4 text-[var(--ds-text-faint)] shrink-0" />
      </button>

      <PimaSheet
        open={availabilityOpen}
        onClose={() => setAvailabilityOpen(false)}
        title="جدول الإشغال"
        subtitle={`تقويم إشغال البيت — ${calendarMonthLabel}`}
        icon={<Calendar className="w-4 h-4 text-[var(--ds-accent)]" />}
      >
          <div className="space-y-3">
            {/* Visual Calendar Grid */}
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold">
              {/* The old row here was ['أ','ث','خ','ج','ج','س','ح'] — ج twice,
                  الأربعاء missing entirely, and no offset before the 1st, so
                  every date sat under the wrong weekday. */}
              {WEEKDAY_INITIALS.map((d, i) => (
                <div key={i} className="text-[var(--ds-text-2)] py-1">{d}</div>
              ))}
              {Array.from({ length: calendarLeadingBlanks }, (_, i) => (
                <div key={`blank-${i}`} aria-hidden="true" />
              ))}
              {CALENDAR_DAYS.map((day) => {
                const past = isDatePast(day);
                const booked = isDateBooked(day);
                return (
                  <div
                    key={day}
                    className={`py-1.5 rounded-lg border text-center transition-all ${
                      past
                        ? 'bg-[var(--ds-raised)] border-[var(--ds-raised)] text-[var(--ds-text-faint)]'
                        : booked
                          ? 'bg-[color-mix(in_srgb,var(--ds-danger)_10%,transparent)] border-[color-mix(in_srgb,var(--ds-danger)_16%,transparent)] text-[var(--ds-danger-ink)] font-extrabold'
                          : 'bg-[color-mix(in_srgb,var(--ds-success)_10%,transparent)] border-[color-mix(in_srgb,var(--ds-success)_16%,transparent)] text-emerald-850'
                    }`}
                    title={past ? 'تاريخ مضى' : booked ? 'محجوز بالكامل' : 'متاح للحجز'}
                  >
                    {arabicNumber(day)}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between text-[11px] text-[var(--ds-text-2)] pt-2 border-t border-[var(--ds-border)]">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[var(--ds-danger)]" />
                <span>محجوز لمؤتمرات أخرى</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[var(--ds-success)]" />
                <span>متاح لخلوتكم</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[var(--ds-border)]" />
                <span>تاريخ مضى</span>
              </span>
            </div>
          </div>
      </PimaSheet>

          {/* Budget assistant. It is a servant's planning tool, not something a guest
          browsing a house needs open in front of them — so it lives behind a
          card that opens a sheet. */}
      <button
        type="button"
        onClick={() => { tapFeedback(); setBudgetOpen(true); }}
        className="w-full bg-[var(--ds-surface)] rounded-3xl p-5 border border-[var(--ds-border)] shadow-[0_8px_24px_rgba(0,0,0,0.06),0_2px_6px_rgba(0,0,0,0.03)] flex items-center gap-3 text-right cursor-pointer pima-press hover:border-[var(--ds-accent-soft)] transition-colors"
      >
        <span className="w-12 h-12 rounded-full bg-[color-mix(in_srgb,var(--ds-accent)_12%,var(--ds-surface))] flex items-center justify-center shrink-0">
          <Calculator className="w-5 h-5 text-[var(--ds-accent)]" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[12px] font-black text-[var(--ds-brand)]">مساعد ميزانية الخلوة</span>
          <span className="block text-[11px] font-medium text-[var(--ds-text-2)] leading-snug mt-0.5">احسب تكلفة الفرد وميزانية الرحلة بالكامل</span>
        </span>
        <ChevronLeft className="w-4 h-4 text-[var(--ds-text-faint)] shrink-0" />
      </button>

      <PimaSheet
        open={budgetOpen}
        onClose={() => setBudgetOpen(false)}
        title="مساعد ميزانية الخلوة"
        subtitle="أداة لأمين الرحلة: احسب تكلفة الفرد وميزانية المؤتمر بالكامل"
        icon={<Calculator className="w-4 h-4 text-[var(--ds-accent)]" />}
      >
        {/* The title and blurb the card used to carry now live in the sheet's
            own header, so they are not repeated here. */}
            <div className="space-y-2.5 text-[11px] font-bold">
              {/* Bus Costs */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-[var(--ds-text-2)] mb-1">تكلفة إيجار الأتوبيس:</label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      value={calcBusPrice}
                      onChange={(e) => setCalcBusPrice(Number(e.target.value) || 0)}
                      className="w-full bg-[var(--ds-bg)] border border-[var(--ds-border)] rounded-lg px-2 py-1 text-center font-bold text-[var(--ds-text)]"
                    />
                    <span className="absolute left-1.5 top-1 text-[11px] text-[var(--ds-text-2)]">ج.م</span>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] text-[var(--ds-text-2)] mb-1">عدد الأتوبيسات:</label>
                  <input
                    type="number"
                    min={0}
                    value={calcBusesCount}
                    onChange={(e) => setCalcBusesCount(Number(e.target.value) || 0)}
                    className="w-full bg-[var(--ds-bg)] border border-[var(--ds-border)] rounded-lg px-2 py-1 text-center font-bold text-[var(--ds-text)]"
                  />
                </div>
              </div>

              {/* Misc Expenses & Registration Target */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-[var(--ds-text-2)] mb-1">مصاريف أخرى وأنشطة:</label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      value={calcMiscExpenses}
                      onChange={(e) => setCalcMiscExpenses(Number(e.target.value) || 0)}
                      className="w-full bg-[var(--ds-bg)] border border-[var(--ds-border)] rounded-lg px-2 py-1 text-center font-bold text-[var(--ds-text)]"
                    />
                    <span className="absolute left-1.5 top-1 text-[11px] text-[var(--ds-text-2)]">ج.م</span>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] text-[var(--ds-text-2)] mb-1">قيمة اشتراك الفرد المقترح:</label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      value={calcTargetSubscription}
                      onChange={(e) => setCalcTargetSubscription(Number(e.target.value) || 0)}
                      className="w-full bg-[var(--ds-bg)] border border-[var(--ds-border)] rounded-lg px-2 py-1 text-center font-bold text-[var(--ds-text)] border-[color-mix(in_srgb,var(--ds-warning)_38%,transparent)] focus:border-[var(--ds-warning)]"
                    />
                    <span className="absolute left-1.5 top-1 text-[11px] text-[var(--ds-warning)]">ج.م</span>
                  </div>
                </div>
              </div>

              {/* Calculated Summary Box */}
              {(() => {
                const totalBusCost = calcBusPrice * calcBusesCount;
                const totalTripCost = originalTotalPrice + totalBusCost + calcMiscExpenses;
                const actualCostPerPerson = guestsCount > 0 ? Math.round(totalTripCost / guestsCount) : 0;
                const totalRevenue = calcTargetSubscription * guestsCount;
                const balance = totalRevenue - totalTripCost;

                return (
                  <div className="bg-[var(--ds-bg)] rounded-2xl p-3 border border-[var(--ds-border)] space-y-2 mt-2">
                    <div className="flex justify-between text-[var(--ds-text-2)]">
                      <span>إجمالي حجز البيت:</span>
                      <span className="text-[var(--ds-text)] font-extrabold">{arabicNumber(originalTotalPrice)} ج.م</span>
                    </div>
                    <div className="flex justify-between text-[var(--ds-text-2)]">
                      <span>إجمالي تكلفة الانتقالات:</span>
                      <span className="text-[var(--ds-text)] font-extrabold">{arabicNumber(totalBusCost)}  ج.م</span>
                    </div>
                    <div className="flex justify-between text-[var(--ds-text-2)]">
                      <span>إجمالي التكلفة الكلية للرحلة:</span>
                      <span className="text-[var(--ds-text)] font-extrabold">{arabicNumber(totalTripCost)} ج.م</span>
                    </div>

                    <div className="pt-2 border-t border-[var(--ds-border)] flex justify-between font-black text-[12px] text-[#2D2D24]">
                      <span>التكلفة الفعلية للفرد الواحد:</span>
                      <span className="text-[var(--ds-primary)] text-[14px] underline decoration-[var(--ds-text-faint)] decoration-2">{arabicNumber(actualCostPerPerson)} ج.م</span>
                    </div>

                    <div className="flex justify-between text-[var(--ds-text-2)] pt-1">
                      <span>الاشتراكات المجمعة ({guestsCount} فرد):</span>
                      <span className="text-[var(--ds-text)] font-black">{arabicNumber(totalRevenue)} ج.م</span>
                    </div>

                    {/* Budget Profit/Loss Status */}
                    <div className="pt-2">
                      {balance >= 0 ? (
                        <div className="bg-[color-mix(in_srgb,var(--ds-success)_10%,transparent)] text-[var(--ds-success-ink)] text-[11px] font-extrabold p-2 rounded-xl text-center border border-emerald-150 flex items-center justify-center gap-1">
                          <Coins className="w-3.5 h-3.5 text-[var(--ds-success)] shrink-0" />
                          <span>ميزانية رابحة: فائض قدره +{arabicNumber(balance)} ج.م ✅</span>
                        </div>
                      ) : (
                        <div className="bg-[color-mix(in_srgb,var(--ds-danger)_10%,transparent)] text-[var(--ds-danger-ink)] text-[11px] font-extrabold p-2 rounded-xl text-center border border-rose-150 flex items-center justify-center gap-1">
                          <TrendingDown className="w-3.5 h-3.5 text-[var(--ds-danger)] shrink-0 animate-bounce" />
                          <span>عجز في الميزانية: قدره {arabicNumber(Math.abs(balance))} ج.م ⚠️</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
      </PimaSheet>

      </div>

      {/* Guest reviews. The wizard (or the sign-in prompt for a logged-out
          visitor) is handed in as children so the section owns the layout and
          this file keeps owning who is allowed to write one. */}
      <HouseReviews reviews={houseReviews}>
        {currentUser ? (
          <ReviewWizard house={house} currentUser={currentUser} onSubmitReview={onSubmitReview} previewMode={previewMode} />
        ) : (
          // Logged-out visitor: reviews require an account (and a real
          // booking — enforced server-side), so prompt login instead.
          <div className="text-center space-y-2">
            <p className="text-[11px] font-medium text-[var(--ds-text-2)]">سجّل دخولك لكتابة تقييم بعد إقامتك.</p>
            <button
              type="button"
              onClick={() => onRequireLogin?.()}
              className="bg-gradient-to-b from-[#C9A96A] to-[var(--ds-accent-deep)] text-white font-black text-[12px] px-6 py-2.5 rounded-2xl shadow-[0_2px_8px_rgba(184,148,78,0.35)] transition-transform cursor-pointer pima-press"
            >
              تسجيل الدخول
            </button>
          </div>
        )}
      </HouseReviews>

    </div>
  );
}
