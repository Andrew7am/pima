import React, { useState, useMemo, useEffect } from 'react';
import { RetreatHouse, Booking, Review, User, Room, Announcement, WaitlistEntry, PlatformSettings, DEFAULT_PLATFORM_SETTINGS } from '../types';
import HouseHero from './house/HouseHero';
import HouseLocationTrust from './house/HouseLocationTrust';
import HouseReviews from './house/HouseReviews';
import PimaSheet from './PimaSheet';
import { ExploreSection, ExploreCard } from './house/HouseExplore';
import BookingFlow, { ApplicantDetails } from './house/BookingFlow';
import { arabicNumber } from '../lib/arabic';
import { tapFeedback } from '../lib/haptics';
import ReviewWizard from './ReviewWizard';
import { computeStayPrice } from '../lib/pricing';
import { getCapacityStatus } from '../lib/roomOccupancy';
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
      return <Sun className="w-4 h-4 text-amber-500 fill-amber-100 animate-pulse shrink-0" />;
    case 'cloud-sun':
      return <CloudSun className="w-4 h-4 text-amber-500 shrink-0" />;
    case 'cloud':
      return <Cloud className="w-4 h-4 text-slate-400 shrink-0" />;
    case 'cloud-rain':
      return <CloudRain className="w-4 h-4 text-blue-500 shrink-0" />;
    case 'wind':
      return <Wind className="w-4 h-4 text-teal-500 shrink-0" />;
    default:
      return <Sun className="w-4 h-4 text-amber-500 shrink-0" />;
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
  /** Called when the inline calendar is done, so the sheet can close itself. */
  onDone?: () => void;
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

  const today = new Date().toISOString().split('T')[0];

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

    if (!checkIn || (checkIn && checkOut)) {
      setCheckIn(clickedDateStr);
      setCheckOut('');
    } else {
      if (clickedDateStr < checkIn) {
        setCheckIn(clickedDateStr);
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

  const WEEKDAYS_AR = ['أح', 'اث', 'ث', 'أر', 'خ', 'ج', 'س'];

  // The calendar itself, with no chrome of its own. Inline mode drops it
  // straight into the sheet; the standalone mode wraps it in the modal below.
  const calendar = (
    <>
            <div className="grid grid-cols-2 gap-2 bg-[#FDFBF7] p-2.5 rounded-2xl border border-[#D6D6C2]/50 text-[10px]">
              <div>
                <span className="text-[#8A8A70] block font-bold mb-0.5">من تاريخ (الوصول):</span>
                <span className="text-[#0A2342] font-black">{checkIn ? formatDateToShow(checkIn) : 'لم يحدد'}</span>
              </div>
              <div>
                <span className="text-[#8A8A70] block font-bold mb-0.5">إلى تاريخ (المغادرة):</span>
                <span className="text-[#0A2342] font-black">{checkOut ? formatDateToShow(checkOut) : 'لم يحدد'}</span>
              </div>
            </div>

            <div className="flex items-center justify-between px-1">
              <button
                type="button"
                onClick={prevMonth}
                className="w-8 h-8 rounded-full border border-[#D6D6C2] text-[#4A4A3A] hover:bg-[#EBEBE0] flex items-center justify-center text-xs font-bold cursor-pointer transition-all"
              >
                ◀
              </button>
              <span className="text-xs font-extrabold text-[#0A2342]">
                {MONTH_NAMES_AR[month]} {year}
              </span>
              <button
                type="button"
                onClick={nextMonth}
                className="w-8 h-8 rounded-full border border-[#D6D6C2] text-[#4A4A3A] hover:bg-[#EBEBE0] flex items-center justify-center text-xs font-bold cursor-pointer transition-all"
              >
                ▶
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-black text-[#8A8A70] border-b border-[#D6D6C2]/20 pb-1.5">
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

                let dayStyle = "text-xs font-semibold rounded-xl py-1.5 transition-all text-center ";

                if (isSelectedStart || isSelectedEnd) {
                  dayStyle += "bg-[#0A2342] text-[#C5A059] shadow-sm font-bold cursor-pointer";
                } else if (isApproved) {
                  dayStyle += "bg-red-100 text-red-400 line-through cursor-not-allowed";
                } else if (isPast) {
                  dayStyle += "text-gray-300 cursor-not-allowed";
                } else if (isPending) {
                  dayStyle += "bg-amber-100 text-amber-600 cursor-pointer";
                } else if (isInRange) {
                  dayStyle += "bg-[#C5A059]/20 text-[#0A2342] cursor-pointer";
                } else {
                  dayStyle += "text-[#4A4A3A] hover:bg-[#EBEBE0]/50 cursor-pointer";
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
            <div className="flex flex-wrap gap-3 text-[10px] border-t border-[#D6D6C2]/20 pt-2">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 inline-block" />محجوز</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-100 inline-block" />قيد المراجعة</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#C5A059]/20 inline-block" />الفترة المختارة</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#0A2342] inline-block" />بداية / نهاية</span>
            </div>

            <div className="flex gap-2 border-t border-[#D6D6C2]/40 pt-3">
              <button
                type="button"
                onClick={() => (inline ? onDone?.() : setIsOpen(false))}
                disabled={!checkIn || !checkOut}
                className="flex-1 bg-[#0A2342] disabled:opacity-50 hover:bg-[#071930] text-white text-xs font-bold py-2 rounded-xl text-center shadow-md transition-colors cursor-pointer"
              >
                تأكيد فترة الإقامة
              </button>
              <button
                type="button"
                onClick={() => {
                  setCheckIn('');
                  setCheckOut('');
                }}
                className="px-3 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold py-2 rounded-xl border border-red-200 transition-colors cursor-pointer"
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
        className="w-full bg-white border border-[#D6D6C2] hover:border-[#C5A059] transition-all text-xs px-3 py-2.5 rounded-xl text-[#4A4A3A] flex items-center justify-between text-right cursor-pointer"
      >
        <span className="font-bold">{formattedRange}</span>
        <Calendar className="w-4 h-4 text-[#C5A059] shrink-0" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
          <div className="absolute inset-0" onClick={() => setIsOpen(false)} />

          <div className="relative bg-white rounded-3xl border border-[#D6D6C2] shadow-xl w-full max-w-sm overflow-hidden z-10 p-5 text-right space-y-4" dir="rtl">
            <div className="flex items-center justify-between border-b border-[#D6D6C2]/40 pb-3">
              <span className="text-xs font-black text-[#0A2342]">تحديد فترة الإقامة والتعاقد</span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-[#8A8A70] hover:text-[#4A4A3A] text-xs font-bold p-1"
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

  // Form states for booking
  const [checkIn, setCheckIn] = useState((house.propertyType === 'student' || house.propertyType === 'staff') ? '2026-09-01' : '2026-07-15');
  const [checkOut, setCheckOut] = useState((house.propertyType === 'student' || house.propertyType === 'staff') ? '2027-06-30' : '2026-07-18');
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
  const [mealsIncluded, setMealsIncluded] = useState(true);
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

  // Simple calendar generator for July 2026 (since current year is 2026, and booking season is July)
  const JULY_2026_DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

  const isDateBooked = (day: number) => {
    const dateStr = `2026-07-${day < 10 ? '0' + day : day}`;
    return isDateFull(dateStr);
  };

  // What the availability card leads with: the count a visitor is actually
  // looking for, so they can decide without opening the month.
  const freeJulyDays = JULY_2026_DAYS.filter((d) => !isDateBooked(d)).length;

  const calculateNights = () => {
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays || 1;
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
  const originalTotalPrice = isMonthlyHousing
    ? (house.monthlyRent || 1500) * guestsCount * months
    : stayPrice.total;

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
          <span aria-hidden="true" className="w-1 h-1 rounded-full bg-[#C9A24A] shrink-0" />
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
          className="pima-rise shrink-0 whitespace-nowrap inline-flex items-center gap-1.5 rounded-full border border-[#EDE7DA] bg-white px-3 py-1.5 text-[10.5px] font-bold text-[#2D2D24] shadow-[0_1px_4px_rgba(45,45,36,0.05)]"
          style={{ animationDelay: `${240 + i * 80}ms` }}
        >
          <Glyph className="w-3.5 h-3.5 text-[#C9A24A]" />
          {label}
        </span>
      ))}
      {facilitiesTotal > namedFacilities.length && (
        <span
          className="pima-rise shrink-0 whitespace-nowrap inline-flex items-center rounded-full border border-[#EBD9B4] bg-[#FDF9EF] px-3 py-1.5 text-[10.5px] font-black text-[#B8944E]"
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
      <Users className="w-36 h-36 text-[#C9A24A] opacity-[0.06]" />
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
        <span key={unit} className="flex-1 min-w-0 flex items-center justify-center gap-1 whitespace-nowrap rounded-xl border border-[#EDE7DA] bg-white px-1.5 py-1.5 shadow-[0_1px_4px_rgba(45,45,36,0.05)]">
          <Glyph className="w-3.5 h-3.5 text-[#C9A24A] shrink-0" />
          <span className="text-[14px] font-black text-[#0A2342] leading-none [font-variant-numeric:tabular-nums]">{arabicNumber(n)}</span>
          <span className="text-[9px] font-bold text-[#8A8A70]">{unit}</span>
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
      <p className="text-[10.5px] font-bold text-[#4A4A3A] leading-relaxed line-clamp-2">{house.description}</p>
      <div className="flex flex-wrap gap-1.5">
        {house.suitability.slice(0, 2).map((s) => (
          <span key={s} className="inline-flex items-center whitespace-nowrap rounded-full border border-[#EBD9B4] bg-white px-2.5 py-1 text-[9.5px] font-black text-[#B8944E]">
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
          <span className="block text-[36px] font-black text-[#0A2342] [font-variant-numeric:tabular-nums]">
            {arabicNumber(cardWeather.currentTemp)}°
          </span>
          <span className="block text-[11px] font-black text-[#2D2D24] mt-1.5">{house.governorate}</span>
          <span className="block text-[9.5px] font-medium text-[#8A8A70] mt-0.5">{cardWeather.conditionText}</span>
        </span>
      </div>
      <span aria-hidden="true" className="w-px self-stretch bg-[#EBD9B4]/60" />
      <div className="flex-1 min-w-0 space-y-1.5">
        {[
          { label: 'درجة الحرارة', Glyph: Thermometer },
          { label: 'توقعات الأيام القادمة', Glyph: CalendarDays },
          { label: 'نصائح للرحلة', Glyph: Lightbulb },
        ].map(({ label, Glyph }) => (
          <span key={label} className="flex items-center gap-2 rounded-xl bg-white border border-[#EDE7DA] px-3 py-2 text-[10.5px] font-bold text-[#2D2D24] shadow-[0_1px_4px_rgba(45,45,36,0.05)]">
            <Glyph className="w-4 h-4 text-[#C9A24A] shrink-0" />
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
    };

    // Notes and diocese ride in the conference_details jsonb, which needs no
    // migration to carry them. Written whenever there is anything to say —
    // not only for conference quotes.
    const extras = [
      isQuoteMode ? (extraRequests || 'مطلوب تنظيم اليوم كامل بمائدة محبة وقاعات اجتماعات مناسبة.') : '',
      trimmed.notes,
    ].filter(Boolean).join('\n');
    const details = (isQuoteMode || extras || trimmed.diocese)
      ? {
          ...(isQuoteMode ? { hallId: selectedHallId, mealsIncluded } : {}),
          extraRequests: extras,
          ...(trimmed.diocese ? { diocese: trimmed.diocese } : {}),
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
    // A short, readable reference rather than the raw row id.
    return `PM-${bookingId.slice(-5)}`;
  };

  // The booking journey is a screen, not a panel: while it is open the place
  // page is not rendered at all, so the reader is on one thing at a time.
  if (bookingOpen) {
    return (
      <div className="pb-6 text-right text-[#4A4A3A]">
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
            datePicker={
              <DateRangePicker
                checkIn={checkIn}
                setCheckIn={setCheckIn}
                checkOut={checkOut}
                setCheckOut={setCheckOut}
                isMonthlyHousing={isMonthlyHousing}
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
                  <label className="flex items-center gap-3 bg-white rounded-[28px] border border-[#EDE7DA] p-3 cursor-pointer shadow-[0_8px_24px_rgba(0,0,0,0.06),0_2px_6px_rgba(0,0,0,0.03)]">
                    <input
                      type="checkbox"
                      checked={usePoints}
                      onChange={(e) => setUsePoints(e.target.checked)}
                      className="w-4 h-4 accent-[#C9A24A] shrink-0 cursor-pointer"
                    />
                    <span className="flex-1 min-w-0">
                      <span className="block text-[11.5px] font-black text-[#2D2D24]">استخدم نقاطي في هذا الحجز</span>
                      <span className="block text-[9.5px] font-medium text-[#8A8A70] mt-0.5">
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
                  <div className="rounded-[28px] border border-amber-200 bg-amber-50 p-3 space-y-2">
                    <p className="text-[10.5px] font-bold text-amber-900 leading-relaxed text-center">
                      هذا البيت يتسع لـ <strong>{arabicNumber(house.bedsCount)}</strong> فرد كحد أقصى، وأنت طلبت <strong>{arabicNumber(guestsCount)}</strong>.
                    </p>
                    <button
                      type="button"
                      onClick={() => { tapFeedback(); setGuestsCount(house.bedsCount || 1); }}
                      className="w-full bg-amber-600 hover:bg-amber-700 text-white text-[11.5px] font-black py-3 rounded-2xl transition-colors cursor-pointer pima-press"
                    >
                      اضبط العدد على {arabicNumber(house.bedsCount)} فرد
                    </button>
                  </div>
                )}
                {isFullOnDates && (
                  <div className="rounded-[28px] border border-amber-200 bg-amber-50 p-3 space-y-2">
                    <p className="text-[10.5px] font-bold text-amber-900 text-center">
                      البيت مكتمل الإشغال في هذه التواريخ لعدد الأفراد المطلوب.
                    </p>
                    <button
                      id="join-waitlist-btn"
                      type="button"
                      disabled={alreadyOnWaitlist}
                      onClick={handleJoinWaitlistClick}
                      className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[11.5px] font-black py-3 rounded-2xl transition-colors cursor-pointer pima-press"
                    >
                      {alreadyOnWaitlist ? 'أنت مسجل بالفعل في قائمة الانتظار ⏳' : 'انضم لقائمة الانتظار ⏳'}
                    </button>
                  </div>
                )}

                {/* Cancellation terms, stated before anything is committed. */}
                <div className="rounded-[28px] border border-[#EDE7DA] bg-white p-3 space-y-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.06),0_2px_6px_rgba(0,0,0,0.03)]">
                  <span className="flex items-center gap-1.5 text-[11.5px] font-black text-[#0A2342]">
                    <ShieldCheck className="w-4 h-4 text-[#C9A24A]" />
                    سياسة الإلغاء والاسترداد
                  </span>
                  <ul className="space-y-1 text-[10px] font-medium text-[#4A4A3A] pr-4 list-disc marker:text-[#C9A24A]">
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

  return (    <div className="space-y-4 pb-6 text-right text-[#4A4A3A]">
      
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
          <p className="text-xs text-[#4A4A3A] leading-relaxed font-medium">{house.description}</p>

          {house.suitability.length > 0 && (
            <div className="space-y-2">
              <span className="block text-[11px] font-extrabold text-[#0A2342]">يناسب:</span>
              <div className="flex flex-wrap gap-2">
                {house.suitability.map((s) => (
                  <span key={s} className="inline-flex items-center rounded-full border border-[#EBD9B4] bg-[#FDF9EF] px-3 py-1.5 text-[10.5px] font-bold text-[#B8944E]">
                    {SUITABILITY_MAP[s]}
                  </span>
                ))}
              </div>
            </div>
          )}

          {house.propertyType === 'student' && house.distanceFromUniversity && (
            <div className="bg-amber-50/70 border border-amber-200/50 p-3 rounded-2xl text-xs font-bold text-amber-900 mt-2">
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
            <div className="bg-white rounded-3xl p-5 border border-[#D6D6C2] shadow-sm text-center py-8 space-y-3">
              <Utensils className="w-8 h-8 text-[#BCBC9D] mx-auto" />
              {/* No heading here: the section header above already says it. */}
              <p className="text-xs text-[#8A8A70]">لم يتم تحديد قائمة وجبات طعام مخصصة لهذا البيت بعد.</p>
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-5 border border-[#D6D6C2] shadow-sm space-y-4">
              {/* Header */}
              <div className="flex items-center gap-2 justify-between flex-wrap">
                <div className="flex items-center gap-2">
                  <Utensils className="w-5 h-5 text-[#5A5A40]" />
                  <h3 className="text-xs font-extrabold text-[#4A4A3A]">المنيو والوجبات الأسبوعية والأسعار:</h3>
                </div>
                <div className="flex gap-1.5 items-center">
                  {!isEditingMenu && house.menu && (
                    <button
                      id="toggle-menu-view"
                      type="button"
                      onClick={() => setShowFullMenu(!showFullMenu)}
                      className="text-[9px] font-bold bg-[#5A5A40]/10 text-[#5A5A40] hover:bg-[#5A5A40]/20 px-2.5 py-1 rounded-xl transition-all cursor-pointer"
                    >
                      {showFullMenu ? 'عرض يومي تفاعلي' : 'عرض الأسبوع كاملاً'}
                    </button>
                  )}
                  {isOwnerOrAdmin && (
                    <button
                      id="edit-menu-btn"
                      type="button"
                      onClick={isEditingMenu ? handleSaveMenuChanges : handleStartEditing}
                      className={`text-[9px] font-extrabold px-2.5 py-1 rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
                        isEditingMenu 
                          ? 'bg-emerald-600 text-white hover:bg-emerald-700' 
                          : 'bg-[#5A5A40] text-white hover:bg-[#4A4A32]'
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
                      className="text-[9px] font-extrabold bg-slate-100 text-slate-700 hover:bg-slate-200 px-2.5 py-1 rounded-xl transition-all cursor-pointer"
                    >
                      إلغاء
                    </button>
                  )}
                </div>
              </div>

              {isEditingMenu ? (
                /* --- MENU EDITOR VIEW --- */
                <div className="space-y-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-200 text-right animate-fade-in" dir="rtl">
                  <div className="text-xs font-extrabold text-slate-800 mb-2 border-b border-slate-200 pb-1.5 flex justify-between items-center">
                    <span>⚙️ إعدادات المنيو والأسعار لبيت {house.name}</span>
                    <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded">لوحة التحكم</span>
                  </div>

                  {/* General settings */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <label className="flex items-center gap-2 bg-white p-2.5 rounded-xl border border-slate-200 cursor-pointer text-[10.5px] font-bold select-none">
                      <input 
                        type="checkbox" 
                        checked={editIsIncluded} 
                        onChange={(e) => setEditIsIncluded(e.target.checked)}
                        className="rounded text-[#5A5A40] focus:ring-[#5A5A40] w-4 h-4"
                      />
                      <span>الوجبات مشمولة في السعر الأساسي للإقامة</span>
                    </label>

                    <div className="bg-white p-2 rounded-xl border border-slate-200 flex flex-col justify-between">
                      <span className="text-[9px] text-slate-500 font-bold block mb-1">تكلفة الوجبة الإضافية (ج.م):</span>
                      <input 
                        type="number" 
                        value={editExtraMealPrice} 
                        onChange={(e) => setEditExtraMealPrice(Number(e.target.value))}
                        className="w-full text-xs font-bold border-none p-0 focus:ring-0 text-[#4A4A3A]"
                        placeholder="مثال: 50"
                      />
                    </div>

                    <label className="flex items-center gap-2 bg-white p-2.5 rounded-xl border border-slate-200 cursor-pointer text-[10.5px] font-bold select-none">
                      <input 
                        type="checkbox" 
                        checked={editAllowsSpecial} 
                        onChange={(e) => setEditAllowsSpecial(e.target.checked)}
                        className="rounded text-[#5A5A40] focus:ring-[#5A5A40] w-4 h-4"
                      />
                      <span>توفير بدائل وأنظمة غذائية (صيامي/نباتي)</span>
                    </label>
                  </div>

                  {/* Editor Menu Type Selector */}
                  <div className="flex bg-slate-200/60 p-1 rounded-xl gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditorIsFasting(false);
                        setEditorSelectedDay('السبت');
                      }}
                      className={`flex-1 py-1.5 text-center text-[10px] font-extrabold rounded-lg transition-all cursor-pointer ${
                        !editorIsFasting
                          ? 'bg-[#5A5A40] text-white shadow-sm'
                          : 'text-slate-700 hover:bg-slate-300'
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
                      className={`flex-1 py-1.5 text-center text-[10px] font-extrabold rounded-lg transition-all cursor-pointer ${
                        editorIsFasting
                          ? 'bg-emerald-700 text-white shadow-sm'
                          : 'text-slate-700 hover:bg-slate-300'
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
                          className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all shrink-0 cursor-pointer border ${
                            isSelected
                              ? editorIsFasting
                                ? 'bg-emerald-700 text-white border-emerald-700'
                                : 'bg-[#5A5A40] text-white border-[#5A5A40]'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
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
                      <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 animate-fade-in text-right">
                        <div className="text-[10.5px] font-extrabold text-[#5A5A40] border-b pb-1 flex justify-between items-center">
                          <span>📝 وجبات وأسعار يوم ({editorSelectedDay}) - {editorIsFasting ? 'النظام الصيامي' : 'النظام الفطاري'}</span>
                          <span className="text-[10px] text-amber-600">يرجى كتابة الوجبة بدقة بالتفصيل</span>
                        </div>

                        <div className="space-y-2.5">
                          {/* Breakfast */}
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-extrabold text-slate-600">🍳 وجبة الإفطار:</span>
                            <textarea
                              rows={2}
                              value={activeDayData.breakfast || ''}
                              onChange={(e) => handleDayMealChange(editorSelectedDay, 'breakfast', e.target.value)}
                              className="w-full text-xs font-semibold rounded-lg border-slate-200 focus:border-[#5A5A40] focus:ring-1 focus:ring-[#5A5A40] p-2"
                              placeholder="اكتب مكونات وجبة الإفطار هنا..."
                            />
                          </div>

                          {/* Lunch */}
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-extrabold text-slate-600">🍖 وجبة الغداء:</span>
                            <textarea
                              rows={2}
                              value={activeDayData.lunch || ''}
                              onChange={(e) => handleDayMealChange(editorSelectedDay, 'lunch', e.target.value)}
                              className="w-full text-xs font-semibold rounded-lg border-slate-200 focus:border-[#5A5A40] focus:ring-1 focus:ring-[#5A5A40] p-2"
                              placeholder="اكتب مكونات وجبة الغداء بالتفصيل..."
                            />
                          </div>

                          {/* Dinner */}
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-extrabold text-slate-600">🍲 وجبة العشاء:</span>
                            <textarea
                              rows={2}
                              value={activeDayData.dinner || ''}
                              onChange={(e) => handleDayMealChange(editorSelectedDay, 'dinner', e.target.value)}
                              className="w-full text-xs font-semibold rounded-lg border-slate-200 focus:border-[#5A5A40] focus:ring-1 focus:ring-[#5A5A40] p-2"
                              placeholder="اكتب مكونات وجبة العشاء..."
                            />
                          </div>

                          {/* Day Price - This is exactly what the user wanted: "اضافة الاسعار الخاصه بكل يوم" */}
                          <div className="bg-amber-50/50 p-3 rounded-lg border border-amber-200/60 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                            <div className="space-y-0.5">
                              <span className="text-[10.5px] font-extrabold text-amber-950 block">💰 سعر طعام اليوم ({editorSelectedDay}):</span>
                              <span className="text-[9px] text-amber-800 font-semibold block">سعر الوجبات الثلاث الإجمالي لهذا اليوم تحديداً للفرد</span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0 w-full sm:w-auto">
                              <input
                                type="number"
                                min={0}
                                value={activeDayData.price || ''}
                                onChange={(e) => handleDayMealChange(editorSelectedDay, 'price', Number(e.target.value))}
                                className="w-24 text-xs font-bold rounded-lg border-amber-200 focus:border-[#5A5A40] focus:ring-1 focus:ring-[#5A5A40] p-1 text-center text-[#5A5A40]"
                                placeholder="مثال: 120"
                              />
                              <span className="text-[10px] font-extrabold text-amber-900">ج.م / فرد</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Save button footer inside form */}
                  <div className="flex gap-2 justify-end pt-2 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={handleSaveMenuChanges}
                      className="bg-emerald-600 text-white text-xs font-extrabold px-5 py-2 rounded-xl hover:bg-emerald-700 transition-all cursor-pointer shadow-sm"
                    >
                      💾 حفظ التعديلات وحفظ المنيو بالكامل
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingMenu(false)}
                      className="bg-slate-200 text-slate-700 text-xs font-extrabold px-4 py-2 rounded-xl hover:bg-slate-300 transition-all cursor-pointer"
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
                    <div className="bg-[#FBFBFA] p-2.5 rounded-2xl border border-[#D6D6C2]/40 flex flex-col justify-between text-right">
                      <span className="text-[9px] text-[#8A8A70] font-bold block mb-0.5">توفير الطعام والوجبات:</span>
                      <span className="text-[10px] font-extrabold text-[#4A4A3A]">
                        {house.menu?.isIncluded ? 'مشمول في قيمة الحجز الأساسي' : 'غير مشمول (اختياري)'}
                      </span>
                    </div>

                    <div className="bg-[#FBFBFA] p-2.5 rounded-2xl border border-[#D6D6C2]/40 flex flex-col justify-between text-right">
                      <span className="text-[9px] text-[#8A8A70] font-bold block mb-0.5">تكلفة الوجبة الإضافية:</span>
                      <span className="text-[10px] font-extrabold text-[#4A4A3A]">
                        {house.menu?.extraMealPrice ? `${house.menu.extraMealPrice} ج.م / فرد` : 'غير متوفر'}
                      </span>
                    </div>

                    <div className="bg-[#FBFBFA] p-2.5 rounded-2xl border border-[#D6D6C2]/40 flex flex-col justify-between text-right">
                      <span className="text-[9px] text-[#8A8A70] font-bold block mb-0.5">أنظمة غذائية خاصة:</span>
                      <div className="flex gap-1 mt-0.5">
                        <span className="text-[8.5px] font-extrabold bg-emerald-100/70 text-emerald-800 px-1.5 py-0.5 rounded-md">
                          🌿 صيامي
                        </span>
                        <span className="text-[8.5px] font-extrabold bg-teal-100/70 text-teal-800 px-1.5 py-0.5 rounded-md">
                          🌱 نباتي
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Fasting vs Regular Menu Selector */}
                  <div className="flex bg-[#F1F1E8] p-1 rounded-2xl gap-1" dir="rtl">
                    <button
                      type="button"
                      onClick={() => {
                        setIsFastingMenu(false);
                        const firstDay = house.menu?.weeklyMenu?.[0]?.day || 'السبت';
                        setSelectedMenuDay(firstDay);
                      }}
                      className={`flex-1 py-2 text-center text-[10px] font-extrabold rounded-xl transition-all cursor-pointer ${
                        !isFastingMenu
                          ? 'bg-[#5A5A40] text-white shadow-sm'
                          : 'text-[#5A5A40] hover:bg-[#EBEBE0]'
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
                      className={`flex-1 py-2 text-center text-[10px] font-extrabold rounded-xl transition-all cursor-pointer ${
                        isFastingMenu
                          ? 'bg-emerald-700 text-white shadow-sm'
                          : 'text-emerald-800 hover:bg-emerald-50'
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
                                  className={`px-3 py-1.5 rounded-xl text-[10px] font-extrabold transition-all shrink-0 cursor-pointer border flex flex-col items-center ${
                                    isSelected
                                      ? isFastingMenu 
                                        ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm'
                                        : 'bg-[#5A5A40] text-white border-[#5A5A40] shadow-sm'
                                      : 'bg-white text-[#4A4A3A] border-[#D6D6C2] hover:bg-[#F9F9F6]'
                                  }`}
                                >
                                  <span>{menuDay.day}</span>
                                  {menuDay.price && (
                                    <span className={`text-[8px] font-bold mt-0.5 ${isSelected ? 'text-white/90' : 'text-slate-500'}`}>
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
                            if (!currentDay) return <p className="text-xs text-center text-[#8A8A70]">لا توجد وجبات متاحة</p>;
                            return (
                              <div className="space-y-2.5 animate-fade-in text-right">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                  {/* Breakfast */}
                                  <div className="bg-amber-50/40 border border-amber-200/50 rounded-2xl p-3 space-y-1.5">
                                    <div className="flex items-center gap-1.5">
                                      <span className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center text-[10px]">🍳</span>
                                      <span className="text-[10px] font-extrabold text-amber-950">وجبة الإفطار {isFastingMenu && ' (صيامي)'}</span>
                                    </div>
                                    <p className="text-[10.5px] font-bold text-amber-900 leading-relaxed min-h-[36px]">{currentDay.breakfast || 'لم تحدد'}</p>
                                  </div>

                                  {/* Lunch */}
                                  <div className={`${isFastingMenu ? 'bg-emerald-50/40 border-emerald-200/50' : 'bg-[#5A5A40]/5 border-[#5A5A40]/10'} border rounded-2xl p-3 space-y-1.5`}>
                                    <div className="flex items-center gap-1.5">
                                      <span className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-[10px]">{isFastingMenu ? '🐟' : '🍖'}</span>
                                      <span className="text-[10px] font-extrabold text-emerald-950">وجبة الغداء {isFastingMenu && ' (صيامي)'}</span>
                                    </div>
                                    <p className="text-[10.5px] font-bold text-emerald-900 leading-relaxed min-h-[36px]">{currentDay.lunch || 'لم تحدد'}</p>
                                  </div>

                                  {/* Dinner */}
                                  <div className="bg-purple-50/40 border border-purple-200/50 rounded-2xl p-3 space-y-1.5">
                                    <div className="flex items-center gap-1.5">
                                      <span className="w-5 h-5 rounded-full bg-purple-100 flex items-center justify-center text-[10px]">🍲</span>
                                      <span className="text-[10px] font-extrabold text-purple-950">وجبة العشاء {isFastingMenu && ' (صيامي)'}</span>
                                    </div>
                                    <p className="text-[10.5px] font-bold text-purple-900 leading-relaxed min-h-[36px]">{currentDay.dinner || 'لم تحدد'}</p>
                                  </div>
                                </div>

                                {currentDay.price && (
                                  <div className="bg-[#FBFBFA] border border-[#D6D6C2]/60 p-2.5 rounded-2xl flex justify-between items-center text-[10.5px] font-bold text-[#4A4A3A]">
                                    <span className="text-[#8A8A70]">💰 سعر الوجبات المخصصة لهذا اليوم ({currentDay.day}):</span>
                                    <span className="text-[#5A5A40] text-xs font-extrabold bg-[#5A5A40]/5 px-3 py-1 rounded-lg">
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
                        <div className="space-y-2 max-h-80 overflow-y-auto pr-1 border border-[#D6D6C2]/50 p-2.5 rounded-2xl bg-[#FBFBFA] divide-y divide-[#D6D6C2]/30">
                          {activeMenu.map((menuDay) => (
                            <div key={menuDay.day} className="py-2.5 first:pt-0 last:pb-0 text-right">
                              <div className="font-extrabold text-[#5A5A40] text-[10.5px] mb-1.5 flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#5A5A40]" />
                                  {menuDay.day}
                                </div>
                                {menuDay.price && (
                                  <span className="text-[9px] bg-[#5A5A40]/10 text-[#5A5A40] px-2 py-0.5 rounded-lg font-black">
                                    سعر اليوم: {menuDay.price} ج.م / فرد
                                  </span>
                                )}
                              </div>
                              <div className="grid grid-cols-3 gap-2 text-right">
                                <div className="bg-white p-2 rounded-xl border border-[#D6D6C2]/30">
                                  <span className="text-[8px] text-amber-800 font-bold block mb-0.5">🍳 إفطار {isFastingMenu && 'صيامي'}</span>
                                  <p className="text-[10px] text-[#4A4A3A] font-semibold leading-relaxed">{menuDay.breakfast || 'غير محدد'}</p>
                                </div>
                                <div className="bg-white p-2 rounded-xl border border-[#D6D6C2]/30">
                                  <span className="text-[8px] text-emerald-800 font-bold block mb-0.5">{isFastingMenu ? '🐟' : '🍖'} غداء {isFastingMenu && 'صيامي'}</span>
                                  <p className="text-[10px] text-[#4A4A3A] font-semibold leading-relaxed">{menuDay.lunch || 'غير محدد'}</p>
                                </div>
                                <div className="bg-white p-2 rounded-xl border border-[#D6D6C2]/30">
                                  <span className="text-[8px] text-purple-800 font-bold block mb-0.5">🍲 عشاء {isFastingMenu && 'صيامي'}</span>
                                  <p className="text-[10px] text-[#4A4A3A] font-semibold leading-relaxed">{menuDay.dinner || 'غير محدد'}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    }
                  })()}

                  {/* Special Note */}
                  <div className="bg-amber-50/50 border border-amber-200/50 p-2.5 rounded-xl flex items-start gap-2 text-[9.5px] text-amber-900 leading-relaxed text-right" dir="rtl">
                    <span className="text-xs shrink-0">💡</span>
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
              <span className="text-[10px] font-black bg-[#F6F0E2] text-[#B8944E] px-3 py-1 rounded-full">
                {arabicNumber(house.roomsCount)} غرفة
              </span>
              <span className="text-[10px] font-black bg-[#F6F0E2] text-[#B8944E] px-3 py-1 rounded-full">
                {arabicNumber(house.bedsCount)} سرير
              </span>
            </div>
            
            <p className="text-xs text-[#8A8A70] leading-relaxed font-medium">{house.roomsDescription}</p>

            {/* Actual rooms added by the owner (real availability, not the illustrative grid below) */}
            {rooms.length > 0 && (
              <div className="space-y-2 pt-1">
                <span className="text-[10px] font-extrabold text-[#4A4A3A]">حالة الغرف المتاحة فعلياً:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {rooms.map((room) => (
                    <div key={room.id} className="flex items-center justify-between bg-[#FAF8F5] border border-[#E7E5DB] rounded-xl px-3 py-2">
                      <div>
                        <span className="text-[11px] font-bold text-[#4A4A3A] block">{room.name}</span>
                        <span className="text-[9.5px] text-[#8A8A70]">
                          {arabicNumber(room.bedsCount)} سرير{room.pricePerNight ? ` · ${arabicNumber(room.pricePerNight)} ج.م/ليلة` : ''}
                        </span>
                      </div>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        room.status === 'available' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
                        room.status === 'booked' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                        'bg-rose-50 text-rose-800 border border-rose-200'
                      }`}>
                        {room.status === 'available' ? 'متاحة' : room.status === 'booked' ? 'محجوزة' : 'صيانة'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Room Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3" dir="rtl">
              {(() => {
                const isMonthly = house.propertyType === 'student' || house.propertyType === 'staff';
                const basePrice = isMonthly ? (house.monthlyRent || 1500) : house.pricePerNightPerPerson;

                const roomTypesList = [
                  {
                    id: 'single',
                    name: isMonthly ? 'غرفة فردية فاخرة (سنجل)' : 'غرفة فردية فندقية',
                    capacity: '١ فرد (سرير واحد مريح)',
                    capacityLabel: 'فرد واحد',
                    price: isMonthly ? basePrice : Math.round(basePrice * 1.3),
                    priceUnit: isMonthly ? 'شهرياً' : 'لكل فرد / ليلة',
                    image: 'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=600&q=80',
                    shortDesc: 'مساحة مخصصة للخلوة الهادئة، المذاكرة، والتركيز الفردي المريح مع كامل الخدمات الخاصة.',
                    features: ['تكييف مستقل', 'مكتب عمل وقراءة', 'خزانة ملابس خاصة', 'حمام داخلي خاص', 'إنترنت سريع'],
                    extendedDetails: 'صُممت هذه الغرفة لتلائم الاحتياجات الفردية، سواء للخلوات الروحية الهادئة أو للطلبة والموظفين المغتربين الذين يحتاجون لخصوصية كاملة مع تجهيز عملي للدراسة والقراءة.'
                  },
                  {
                    id: 'double',
                    name: isMonthly ? 'غرفة مزدوجة مشتركة' : 'غرفة مزدوجة / ثلاثية قياسية',
                    capacity: isMonthly ? '٢ أفراد (سريرين منفصلين)' : '٢ إلى ٣ أفراد (أسرة منفصلة)',
                    capacityLabel: isMonthly ? '٢ أفراد' : '٢ - ٣ أفراد',
                    price: isMonthly ? Math.round(basePrice * 0.7) : basePrice,
                    priceUnit: isMonthly ? 'شهرياً للفرد' : 'لكل فرد / ليلة',
                    image: 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=600&q=80',
                    shortDesc: 'الخيار القياسي الممتاز للمؤتمرات والخدمات الكنسية والمغتربين مع أسرة طبية مريحة.',
                    features: ['تكييف ممتاز', 'أسرة منفصلة طبية', 'ثلاجة ميني بار', 'حمام خاص مجهز', 'شرفة مستقلة'],
                    extendedDetails: 'توفر الغرفة المزدوجة توازناً رائعاً بين القيمة الاقتصادية والمساحة المريحة. مجهزة بمراتب طبية مريحة ومساحات تخزين مستقلة وخزائن منفصلة لكل فرد.'
                  },
                  {
                    id: 'suite',
                    name: isMonthly ? 'جناح استوديو للمجموعات' : 'جناح خاص / للآباء الكهنة والعائلات',
                    capacity: '٤ إلى ٦ أفراد (غرف عائلية متصلة)',
                    capacityLabel: '٤ - ٦ أفراد',
                    price: isMonthly ? Math.round(basePrice * 1.4) : Math.round(basePrice * 1.8),
                    priceUnit: isMonthly ? 'شهرياً' : 'لكل فرد / ليلة',
                    image: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=600&q=80',
                    shortDesc: 'مساحة عائلية أو قيادية فاخرة تحتوي على صالة ومطبخ تحضيري لإقامة متكاملة.',
                    features: ['تكييف مركزي', 'صالة معيشة مستقلة', 'مطبخ تحضيري', 'شاشة ذكية سمارت', 'إطلالة بانورامية'],
                    extendedDetails: 'جناح راقٍ واسع يحتوي على غرف نوم متصلة، صالون استقبال مريح، حمامين مجهزين بالكامل، ومطبخ صغير ومرافق إعداد المشروبات الساخنة. مثالي للعائلات أو الآباء الكهنة والمحاضرين.'
                  }
                ];

                return roomTypesList.map((room) => {
                  const isSelected = selectedRoomId === room.id;
                  return (
                    <div 
                      key={room.id}
                      className={`group bg-white rounded-2xl border transition-all duration-300 overflow-hidden flex flex-col justify-between ${
                        isSelected 
                          ? 'border-[#5A5A40] shadow-md ring-1 ring-[#5A5A40]' 
                          : 'border-[#D6D6C2] hover:border-[#8A8A70] hover:shadow-sm'
                      }`}
                    >
                      {/* Image section with capacity badge */}
                      <div className="relative h-28 w-full overflow-hidden bg-gray-100">
                        <img 
                          src={room.image} 
                          alt={room.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute top-2 right-2 bg-[#5A5A40] text-white text-[8px] font-black px-2 py-0.5 rounded-full shadow-sm">
                          👤 {room.capacityLabel}
                        </div>
                      </div>

                      {/* Content section */}
                      <div className="p-3.5 space-y-2 text-right flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start gap-1">
                            <h4 className="text-[11px] font-extrabold text-[#4A4A3A] group-hover:text-[#5A5A40] transition-colors">
                              {room.name}
                            </h4>
                          </div>
                          <p className="text-[9.5px] text-[#8A8A70] leading-relaxed font-semibold mt-1 line-clamp-2">
                            {room.shortDesc}
                          </p>
                        </div>

                        <div className="pt-2 border-t border-[#D6D6C2]/40 mt-2 space-y-2">
                          <div className="flex justify-between items-baseline">
                            <span className="text-[9px] text-[#8A8A70] font-bold">التسعير التقديري:</span>
                            <span className="text-xs font-black text-[#5A5A40]">
                              {arabicNumber(room.price)} ج.م <span className="text-[8px] text-[#8A8A70] font-bold">/ {room.priceUnit}</span>
                            </span>
                          </div>

                          <button
                            id={`room-detail-btn-${room.id}`}
                            type="button"
                            onClick={() => setSelectedRoomId(isSelected ? null : room.id)}
                            className={`w-full py-1.5 rounded-xl text-[9px] font-black transition-all cursor-pointer text-center ${
                              isSelected
                                ? 'bg-[#5A5A40] text-white'
                                : 'bg-[#EBEBE0]/40 text-[#5A5A40] hover:bg-[#EBEBE0]'
                            }`}
                          >
                            {isSelected ? 'إخفاء التفاصيل الإضافية' : 'عرض التفاصيل والخصائص'}
                          </button>
                        </div>
                      </div>

                      {/* Expandable Inline section inside the card itself for responsive mobile/tablet layout */}
                      {isSelected && (
                        <div className="bg-[#FBFBFA] border-t border-[#D6D6C2] p-3.5 text-right space-y-3 animate-fade-in text-[10px]">
                          <div className="space-y-1">
                            <span className="font-extrabold text-[#5A5A40] text-[10.5px]">الوصف التجهيزي:</span>
                            <p className="text-[#4A4A3A] leading-relaxed font-medium">{room.extendedDetails}</p>
                          </div>

                          <div className="space-y-1.5">
                            <span className="font-extrabold text-[#5A5A40] text-[10.5px]">المميزات والتجهيزات:</span>
                            <div className="grid grid-cols-2 gap-1.5 text-right">
                              {room.features.map((feature, idx) => (
                                <div key={idx} className="flex items-center gap-1 text-[9.5px] text-[#4A4A3A] font-bold">
                                  <span className="text-emerald-600 text-xs shrink-0">✓</span>
                                  <span>{feature}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="bg-amber-50/60 border border-amber-200/50 p-2 rounded-xl text-[9px] text-amber-900 font-bold leading-relaxed">
                            💡 ملاحظة: يمكن طلب توفير أدوات إضافية (مكواة، مجفف شعر، غلاية مياه) من ريسبشن البيت عند التسكين مجاناً.
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
                <span className="font-extrabold text-[#0A2342] text-[11px] block">قاعات الاجتماعات والمؤتمرات:</span>
                {house.conferenceHalls.length === 0 ? (
                  <p className="text-[11px] text-[#8A8A70]">لا تتوفر قاعات اجتماعات خاصة، الاجتماعات تقام بالساحات الخارجية.</p>
                ) : (
                  <div className="space-y-2.5">
                    {house.conferenceHalls.map((hall) => (
                      <div key={hall.id} className="bg-[#EBEBE0]/30 border border-[#D6D6C2] p-3 rounded-2xl flex justify-between items-center text-xs">
                        <div>
                          <div className="font-bold text-[#4A4A3A]">{hall.name}</div>
                          <div className="text-[10px] text-[#8A8A70] font-semibold mt-0.5">تتسع لـ: {arabicNumber(hall.capacity)} فرد</div>
                          {hall.price !== undefined && (
                            <div className="text-[10px] text-[#5A5A40] font-bold mt-0.5">{arabicNumber(hall.price)} جنيه / اليوم</div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {hall.hasSoundSystem && (
                            <span className="p-1 bg-white border border-[#D6D6C2] rounded-lg text-[#5A5A40]" title="أنظمة صوت مدمجة">
                              <Volume2 className="w-3.5 h-3.5 text-[#5A5A40]" />
                            </span>
                          )}
                          {hall.hasProjector && (
                            <span className="p-1 bg-white border border-[#D6D6C2] rounded-lg text-[#8A8A70]" title="بروجيكتور وشاشات عرض">
                              <Monitor className="w-3.5 h-3.5 text-[#8A8A70]" />
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Amenities checklist */}
              <div className="space-y-3 pt-3 border-t border-[#D6D6C2]/30 text-right">
                <span className="font-extrabold text-[#0A2342] text-[11px] block">المرافق والخدمات المتوفرة:</span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {house.services.map((srv) => (
                    <div key={srv} className="flex items-center gap-2 text-[#4A4A3A] bg-[#EBEBE0]/20 p-1.5 rounded-xl border border-[#D6D6C2]">
                      <span className="w-4 h-4 rounded-full bg-[#EBEBE0] border border-[#BCBC9D] text-[#5A5A40] flex items-center justify-center shrink-0">
                        <Check className="w-2.5 h-2.5" />
                      </span>
                      <span className="font-semibold text-[11px] text-[#4A4A3A]">{srv}</span>
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
                    <span className="text-[9px] bg-emerald-50 text-emerald-800 border border-emerald-200/50 px-2 py-0.5 rounded-full font-bold">
                      مباشر ومحدث
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-center">
                    {/* Current conditions */}
                    <div className="bg-[#EBEBE0]/20 border border-[#D6D6C2] p-3 rounded-2xl flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-bold text-[#8A8A70]">الطقس الحالي</span>
                        <div className="text-xs font-black text-[#4A4A3A]">{weather.conditionText}</div>
                        <div className="flex gap-2 text-[9px] text-[#8A8A70] pt-1">
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
                      <div className="flex flex-col items-center justify-center bg-white border border-[#D6D6C2] rounded-xl px-2.5 py-1.5 shadow-sm">
                        <span className="text-lg font-black text-[#5A5A40] tracking-tight">{arabicNumber(weather.currentTemp)}°م</span>
                        <Thermometer className="w-4 h-4 text-rose-500 fill-rose-100" />
                      </div>
                    </div>

                    {/* 3-day short forecast */}
                    <div className="space-y-1.5">
                      <span className="block text-[10px] font-extrabold text-[#8A8A70]">توقعات الأيام الثلاثة القادمة:</span>
                      <div className="grid grid-cols-3 gap-1.5 text-center">
                        {weather.forecast.map((day, idx) => (
                          <div key={idx} className="bg-[#FBFBFA] border border-[#D6D6C2]/60 p-2 rounded-xl space-y-1">
                            <div className="text-[9px] font-extrabold text-[#8A8A70]">{day.dayName}</div>
                            <div className="flex justify-center py-0.5">
                              {getWeatherIcon(day.icon)}
                            </div>
                            <div className="text-[9.5px] font-black text-[#4A4A3A]">{arabicNumber(day.tempHigh)}° / {arabicNumber(day.tempLow)}°</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Recommendation and Planning tip */}
                  <div className="bg-amber-50/50 border border-amber-200/60 rounded-2xl p-3.5 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-amber-950">
                      <span className="text-xs">💡</span>
                      <span>توصية التخطيط للرحلة والأنشطة:</span>
                    </div>
                    <p className="text-[10px] font-medium text-amber-900 leading-relaxed">
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
            className="group block w-full text-right rounded-[30px] overflow-hidden bg-[#FAF8F4] border border-[#C9A24A]/10 shadow-[0_10px_30px_rgba(45,45,36,0.07),0_2px_8px_rgba(45,45,36,0.04)] hover:shadow-[0_14px_36px_rgba(201,162,74,0.18),0_3px_10px_rgba(45,45,36,0.06)] active:scale-[0.98] transition-[transform,box-shadow] duration-200 ease-in-out cursor-pointer"
          >
            <div className="flex items-stretch gap-4 p-5">
              {/* Zone one: the number carries the card. */}
              <div className="basis-[35%] shrink-0 text-center leading-none">
                <span className="block text-[11px] font-black text-[#C9A24A]">ابتداءً من</span>
                <span className="flex items-baseline justify-center gap-1 my-2">
                  <span className="text-[40px] font-black text-[#0A2342] [font-variant-numeric:tabular-nums]">
                    {arabicNumber(isMonthlyHousing ? (house.monthlyRent || 0) : house.pricePerNightPerPerson)}
                  </span>
                  <span className="text-[13px] font-black text-[#0A2342]">ج.م</span>
                </span>
                <span className="block text-[10.5px] font-medium text-[#8A8A70]">
                  {isMonthlyHousing ? 'لكل فرد / شهر' : 'لكل فرد / ليلة'}
                </span>
                <span aria-hidden="true" className="block w-12 h-0.5 rounded-full bg-[#C9A24A]/30 mx-auto mt-3" />
              </div>

              <span aria-hidden="true" className="w-px self-stretch bg-[#C9A24A]/15" />

              {/* Zone two: the reassurance, compact and beside the price rather
                  than stacked under it — no empty middle. */}
              <div className="flex-1 min-w-0 flex items-center gap-3">
                <span className="w-11 h-11 rounded-full bg-[#F4EDDD] flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5 text-[#C9A24A]" />
                </span>
                <span className="min-w-0 leading-snug">
                  <span className="block text-[12.5px] font-black text-[#0A2342]">لن يتم خصم أي مبلغ الآن</span>
                  <span className="block text-[10px] font-medium text-[#8A8A70] mt-1">
                    سيتم مراجعة طلبك من إدارة المكان أولاً قبل تأكيد الحجز.
                  </span>
                </span>
              </div>
            </div>

            {/* Zone three: the bottom edge of the card, and the action. It
                inherits the card's radius because the card clips it. */}
            <span className="flex items-center h-14 px-5 bg-gradient-to-l from-[#B8944E] via-[#C9A24A] to-[#D6AE5C] text-white transition-[filter] duration-200 ease-in-out group-active:brightness-95">
              <CalendarDays className="w-5 h-5 shrink-0" />
              <span className="flex-1 text-center text-[15px] font-black">احجز الآن</span>
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
        className="w-full bg-white rounded-3xl p-5 border border-[#EDE7DA] shadow-[0_8px_24px_rgba(0,0,0,0.06),0_2px_6px_rgba(0,0,0,0.03)] flex items-center gap-3 text-right cursor-pointer pima-press hover:border-[#E3CD9F] transition-colors"
      >
        <span className="w-12 h-12 rounded-full bg-[#F6F0E2] flex items-center justify-center shrink-0">
          <Calendar className="w-5 h-5 text-[#C9A24A]" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[13px] font-black text-[#0A2342]">جدول الإشغال</span>
          <span className="block text-[10px] font-medium text-[#8A8A70] leading-snug mt-0.5">
            {freeJulyDays > 0
              ? <>{arabicNumber(freeJulyDays)} من {arabicNumber(JULY_2026_DAYS.length)} يوم متاحة في يوليو ٢٠٢٦</>
              : <>لا توجد أيام متاحة في يوليو ٢٠٢٦</>}
          </span>
        </span>
        <ChevronLeft className="w-4 h-4 text-[#B5AF98] shrink-0" />
      </button>

      <PimaSheet
        open={availabilityOpen}
        onClose={() => setAvailabilityOpen(false)}
        title="جدول الإشغال"
        subtitle="تقويم إشغال البيت — يوليو ٢٠٢٦"
        icon={<Calendar className="w-4 h-4 text-[#C9A24A]" />}
      >
          <div className="space-y-3">
            {/* Visual Calendar Grid */}
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold">
              {['أ', 'ث', 'خ', 'ج', 'ج', 'س', 'ح'].map((d, i) => (
                <div key={i} className="text-[#8A8A70] py-1">{d}</div>
              ))}
              {JULY_2026_DAYS.map((day) => {
                const booked = isDateBooked(day);
                return (
                  <div
                    key={day}
                    className={`py-1.5 rounded-lg border text-center transition-all ${
                      booked 
                        ? 'bg-rose-50 border-rose-100 text-rose-700 font-extrabold' 
                        : 'bg-emerald-50 border-emerald-100 text-emerald-850'
                    }`}
                    title={booked ? 'محجوز بالكامل' : 'متاح للحجز'}
                  >
                    {day}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between text-[10px] text-[#8A8A70] pt-2 border-t border-[#EDE7DA]">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span>محجوز لمؤتمرات أخرى</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>متاح لخلوتكم</span>
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
        className="w-full bg-white rounded-3xl p-5 border border-[#EDE7DA] shadow-[0_8px_24px_rgba(0,0,0,0.06),0_2px_6px_rgba(0,0,0,0.03)] flex items-center gap-3 text-right cursor-pointer pima-press hover:border-[#E3CD9F] transition-colors"
      >
        <span className="w-12 h-12 rounded-full bg-[#F6F0E2] flex items-center justify-center shrink-0">
          <Calculator className="w-5 h-5 text-[#C9A24A]" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[13px] font-black text-[#0A2342]">مساعد ميزانية الخلوة</span>
          <span className="block text-[10px] font-medium text-[#8A8A70] leading-snug mt-0.5">احسب تكلفة الفرد وميزانية الرحلة بالكامل</span>
        </span>
        <ChevronLeft className="w-4 h-4 text-[#B5AF98] shrink-0" />
      </button>

      <PimaSheet
        open={budgetOpen}
        onClose={() => setBudgetOpen(false)}
        title="مساعد ميزانية الخلوة"
        subtitle="أداة لأمين الرحلة: احسب تكلفة الفرد وميزانية المؤتمر بالكامل"
        icon={<Calculator className="w-4 h-4 text-[#C9A24A]" />}
      >
        {/* The title and blurb the card used to carry now live in the sheet's
            own header, so they are not repeated here. */}
            <div className="space-y-2.5 text-[11px] font-bold">
              {/* Bus Costs */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9px] text-[#8A8A70] mb-1">تكلفة إيجار الأتوبيس:</label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      value={calcBusPrice}
                      onChange={(e) => setCalcBusPrice(Number(e.target.value) || 0)}
                      className="w-full bg-[#FAF8F5] border border-[#E7E5DB] rounded-lg px-2 py-1 text-center font-bold text-[#4A4A3A]"
                    />
                    <span className="absolute left-1.5 top-1 text-[8.5px] text-[#8A8A70]">ج.م</span>
                  </div>
                </div>
                <div>
                  <label className="block text-[9px] text-[#8A8A70] mb-1">عدد الأتوبيسات:</label>
                  <input
                    type="number"
                    min={0}
                    value={calcBusesCount}
                    onChange={(e) => setCalcBusesCount(Number(e.target.value) || 0)}
                    className="w-full bg-[#FAF8F5] border border-[#E7E5DB] rounded-lg px-2 py-1 text-center font-bold text-[#4A4A3A]"
                  />
                </div>
              </div>

              {/* Misc Expenses & Registration Target */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9px] text-[#8A8A70] mb-1">مصاريف أخرى وأنشطة:</label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      value={calcMiscExpenses}
                      onChange={(e) => setCalcMiscExpenses(Number(e.target.value) || 0)}
                      className="w-full bg-[#FAF8F5] border border-[#E7E5DB] rounded-lg px-2 py-1 text-center font-bold text-[#4A4A3A]"
                    />
                    <span className="absolute left-1.5 top-1 text-[8.5px] text-[#8A8A70]">ج.م</span>
                  </div>
                </div>
                <div>
                  <label className="block text-[9px] text-[#8A8A70] mb-1">قيمة اشتراك الفرد المقترح:</label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      value={calcTargetSubscription}
                      onChange={(e) => setCalcTargetSubscription(Number(e.target.value) || 0)}
                      className="w-full bg-[#FAF8F5] border border-[#E7E5DB] rounded-lg px-2 py-1 text-center font-bold text-[#4A4A3A] border-amber-300 focus:border-amber-500"
                    />
                    <span className="absolute left-1.5 top-1 text-[8.5px] text-amber-700">ج.م</span>
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
                  <div className="bg-[#FAF8F5] rounded-2xl p-3 border border-[#E7E5DB] space-y-2 mt-2">
                    <div className="flex justify-between text-[#8A8A70]">
                      <span>إجمالي حجز البيت:</span>
                      <span className="text-[#4A4A3A] font-extrabold">{originalTotalPrice.toLocaleString()} ج.م</span>
                    </div>
                    <div className="flex justify-between text-[#8A8A70]">
                      <span>إجمالي تكلفة الانتقالات:</span>
                      <span className="text-[#4A4A3A] font-extrabold">{totalBusCost.toLocaleString()}  ج.م</span>
                    </div>
                    <div className="flex justify-between text-[#8A8A70]">
                      <span>إجمالي التكلفة الكلية للرحلة:</span>
                      <span className="text-[#4A4A3A] font-extrabold">{totalTripCost.toLocaleString()} ج.م</span>
                    </div>

                    <div className="pt-2 border-t border-[#E7E5DB] flex justify-between font-black text-xs text-[#2D2D24]">
                      <span>التكلفة الفعلية للفرد الواحد:</span>
                      <span className="text-[#5A5A40] text-sm underline decoration-[#BCBC9D] decoration-2">{actualCostPerPerson.toLocaleString()} ج.م</span>
                    </div>

                    <div className="flex justify-between text-[#8A8A70] pt-1">
                      <span>الاشتراكات المجمعة ({guestsCount} فرد):</span>
                      <span className="text-[#4A4A3A] font-black">{totalRevenue.toLocaleString()} ج.م</span>
                    </div>

                    {/* Budget Profit/Loss Status */}
                    <div className="pt-2">
                      {balance >= 0 ? (
                        <div className="bg-emerald-50 text-emerald-800 text-[10px] font-extrabold p-2 rounded-xl text-center border border-emerald-150 flex items-center justify-center gap-1">
                          <Coins className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>ميزانية رابحة: فائض قدره +{balance.toLocaleString()} ج.م ✅</span>
                        </div>
                      ) : (
                        <div className="bg-rose-50 text-rose-800 text-[10px] font-extrabold p-2 rounded-xl text-center border border-rose-150 flex items-center justify-center gap-1">
                          <TrendingDown className="w-3.5 h-3.5 text-rose-600 shrink-0 animate-bounce" />
                          <span>عجز في الميزانية: قدره {Math.abs(balance).toLocaleString()} ج.م ⚠️</span>
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
            <p className="text-[10.5px] font-medium text-[#8A8A70]">سجّل دخولك لكتابة تقييم بعد إقامتك.</p>
            <button
              type="button"
              onClick={() => onRequireLogin?.()}
              className="bg-gradient-to-b from-[#C9A96A] to-[#B8944E] text-white font-black text-[11.5px] px-6 py-2.5 rounded-2xl shadow-[0_2px_8px_rgba(184,148,78,0.35)] transition-transform cursor-pointer pima-press"
            >
              تسجيل الدخول
            </button>
          </div>
        )}
      </HouseReviews>

    </div>
  );
}
