import React, { useState, useMemo } from 'react';
import { RetreatHouse, Booking, Review, User, Room, Announcement, WaitlistEntry, PlatformSettings, DEFAULT_PLATFORM_SETTINGS } from '../types';
import { SUITABILITY_MAP } from '../mockData';
import ReviewWizard from './ReviewWizard';
import { computeStayPrice } from '../lib/pricing';
import { 
  ArrowRight, MapPin, BedDouble, Calendar, Users, 
  DollarSign, Check, Award, Flame, MessageSquare, Star, 
  Utensils, Volume2, Monitor, HelpCircle, Send, CheckCircle2,
  Sun, Cloud, CloudSun, CloudRain, Thermometer, Droplets, Wind, Phone, Heart, Copy, Share2,
  Calculator, TrendingDown, TrendingUp, Coins, Bus, ChevronDown
} from 'lucide-react';

type ReviewCategoryFilter = 'all' | 'food' | 'service' | 'cleanliness' | 'organization' | 'value';
const REVIEW_CATEGORY_CHIPS: { key: ReviewCategoryFilter; label: string }[] = [
  { key: 'all', label: 'الكل' },
  { key: 'food', label: 'الطعام' },
  { key: 'service', label: 'الخدمة' },
  { key: 'cleanliness', label: 'النظافة' },
  { key: 'organization', label: 'التنظيم' },
  { key: 'value', label: 'القيمة مقابل السعر' },
];
const REVIEW_RATING_LABEL = (n: number) => n >= 4.5 ? 'ممتاز' : n >= 3.5 ? 'جيد جداً' : n >= 2.5 ? 'جيد' : n >= 1.5 ? 'مقبول' : 'ضعيف';

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
}

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
}: DateRangePickerProps) => {
  const [isOpen, setIsOpen] = useState(false);

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
                onClick={() => setIsOpen(false)}
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
          </div>
        </div>
      )}
    </div>
  );
};

interface AccordionItemProps {
  id: string;
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  icon: React.ComponentType<any>;
  children: React.ReactNode;
}

const AccordionItem = ({
  id,
  title,
  isOpen,
  onToggle,
  icon: Icon,
  children
}: AccordionItemProps) => {
  return (
    <div id={`accordion-item-${id}`} className="bg-white rounded-3xl border border-[#D6D6C2] shadow-sm overflow-hidden transition-all duration-300">
      <button
        id={`accordion-trigger-${id}`}
        type="button"
        onClick={onToggle}
        className="w-full px-5 py-4 flex items-center justify-between text-right font-black text-xs text-[#0A2342] bg-[#FDFBF7] hover:bg-[#F8F6F0] transition-all cursor-pointer border-b border-transparent hover:border-[#C5A059]/10"
      >
        <div className="flex items-center gap-2.5">
          <Icon className="w-5 h-5 text-[#C5A059] shrink-0" />
          <span className="text-[12px] font-black">{title}</span>
        </div>
        <span className={`transform transition-transform duration-300 text-[#C5A059] text-xs font-black ${isOpen ? 'rotate-180' : 'rotate-0'}`}>
          ▼
        </span>
      </button>
      
      {isOpen && (
        <div className="p-5 border-t border-[#D6D6C2]/40 bg-white animate-fade-in space-y-4">
          {children}
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
}: HouseDetailProps) {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isCopied, setIsCopied] = useState(false);

  // Deep link to this specific house — read back on load via ?house=<id>
  // (see App.tsx) instead of sharing the bare site URL.
  const handleShare = async () => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?house=${house.id}`;
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

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    services: true,
    menu: false,
    rooms: false,
    facilities: false,
    rules: false,
    location: false,
    contact: false,
    weather: false,
  });

  const toggleSection = (sectionKey: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  };

  const [isQuoteMode, setIsQuoteMode] = useState(false); // Toggle between regular booking & large conference quote

  // Form states for booking
  const [checkIn, setCheckIn] = useState((house.propertyType === 'student' || house.propertyType === 'staff') ? '2026-09-01' : '2026-07-15');
  const [checkOut, setCheckOut] = useState((house.propertyType === 'student' || house.propertyType === 'staff') ? '2027-06-30' : '2026-07-18');
  const [guestsCount, setGuestsCount] = useState<number>(
    (house.propertyType === 'student' || house.propertyType === 'staff') ? 1 : 30
  );
  const [usePoints, setUsePoints] = useState(false);
  
  // Custom price quote states
  const [selectedHallId, setSelectedHallId] = useState(house.conferenceHalls[0]?.id || '');
  const [mealsIncluded, setMealsIncluded] = useState(true);
  const [extraRequests, setExtraRequests] = useState('');

  // Review states
  const [reviewFilter, setReviewFilter] = useState<ReviewCategoryFilter>('all');
  const [reviewsVisibleCount, setReviewsVisibleCount] = useState(5);

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
  const hasSeasonalNights = stayPrice.breakdown.some((row) => row.label !== null);

  // Whether the currently selected dates/guest count would exceed remaining
  // capacity — used to offer joining the waitlist instead of a doomed booking attempt.
  const wouldExceedCapacity = (() => {
    if (!checkIn || !checkOut || isMonthlyHousing) return false;
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
      const s = d.toISOString().split('T')[0];
      if (usedBedsOnDate(s) + guestsCount > (house.bedsCount || 0)) return true;
    }
    return false;
  })();

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

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (previewMode) { alert('معاينة فقط — التسجيل معطّل أثناء مراجعة الإدارة.'); return; }
    if (!currentUser) { onRequireLogin?.(); return; }
    if (!checkIn || !checkOut || guestsCount <= 0) {
      alert('الرجاء التأكد من إدخال كافة بيانات التواريخ والأعداد.');
      return;
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
        return;
      }
    }

    const newBooking: Booking = {
      id: `book_${Date.now()}`,
      houseId: house.id,
      houseName: house.name,
      userId: currentUser.id,
      userName: currentUser.name,
      userPhone: currentUser.phone,
      userEmail: currentUser.email,
      userRole: currentUser.role,
      organizationName: currentUser.organizationName,
      checkIn,
      checkOut,
      guestsCount,
      totalPrice,
      depositPaid: false,
      depositAmount,
      status: 'pending', // Pending owner approval
      isLargeConferenceQuote: isQuoteMode,
      conferenceDetails: isQuoteMode ? {
        hallId: selectedHallId,
        mealsIncluded,
        extraRequests: extraRequests || 'مطلوب تنظيم اليوم كامل بمائدة محبة وقاعات اجتماعات مناسبة.'
      } : undefined,
      createdAt: new Date().toISOString()
    };

    // Wait for the DB write. If the capacity trigger rejects, App.tsx
    // already showed a specific error; we simply skip the success alert.
    const result = await onBook(newBooking, pointsToRedeem);
    if (result === false) return;
    alert(
      isQuoteMode
        ? 'تم إرسال طلب عرض السعر للمؤتمر الكنسي الكبير بنجاح! سيقوم مالك البيت بمراجعة الطلب وتقديم عرض سعر خاص خلال دقائق.'
        : 'تم تقديم طلب الحجز بنجاح! ستكسب نقاط مكافآت فور تأكيد دفع العربون. ستجد تفاصيل الحجز وقبول المالك في صفحة "حجوزاتي".'
    );
  };

  return (
    <div className="space-y-4 pb-6 text-right text-[#4A4A3A]">
      
      {/* Back button and navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            id="detail-back-btn"
            onClick={onBack}
            className="p-2 bg-white rounded-full border border-[#D6D6C2] text-[#4A4A3A] hover:bg-[#DEDECB] transition-colors shadow-sm"
          >
            <ArrowRight className="w-4 h-4 text-[#4A4A3A]" />
          </button>
          <span className="text-xs font-bold text-[#8A8A70]">تفاصيل بيت المؤتمرات</span>
        </div>
        
        {/* Actions button group */}
        <div className="flex items-center gap-2">
          {/* Share button — links directly to this house, not the site root */}
          <button
            id={`share-detail-${house.id}`}
            onClick={handleShare}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-xs font-bold transition-all shadow-xs ${
              isCopied
                ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                : 'bg-white border-[#D6D6C2] text-[#8A8A70] hover:bg-[#FDFBF7]'
            }`}
          >
            <Share2 className="w-3.5 h-3.5 text-sky-600" />
            <span>{isCopied ? 'تم نسخ الرابط!' : 'مشاركة'}</span>
          </button>

          {/* Favorite toggle button */}
          <button
            id={`toggle-fav-detail-${house.id}`}
            onClick={() => onToggleFavorite(house.id)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-xs font-bold transition-all shadow-xs ${
              isFavorited 
                ? 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100'
                : 'bg-white border-[#D6D6C2] text-[#8A8A70] hover:bg-[#FDFBF7]'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 transition-colors ${isFavorited ? 'fill-rose-500 text-rose-500' : 'text-[#8A8A70]'}`} />
            <span>{isFavorited ? 'مضاف للمفضلة' : 'إضافة للمفضلة'}</span>
          </button>
        </div>
      </div>

      {/* Hero Image Slider */}
      <div className="bg-white rounded-3xl overflow-hidden border border-[#D6D6C2] shadow-sm relative text-right">
        <div className="h-56 bg-[#EBEBE0] relative">
          <img referrerPolicy="no-referrer" src={house.images[activeImageIndex]} alt={house.name} className="w-full h-full object-cover" />
          <div className="absolute top-3 right-3 bg-[#5A5A40]/90 backdrop-blur-sm text-white px-3 py-1 rounded-full text-[11px] font-bold">
            {house.governorate}
          </div>
          
          {/* Suitability filters visual tags */}
          <div className="absolute bottom-3 right-3 flex flex-wrap gap-1.5">
            {house.suitability.map((suit) => (
              <span key={suit} className="bg-[#8A8A70] text-white px-2 py-0.5 rounded text-[9px] font-bold shadow-sm">
                {SUITABILITY_MAP[suit]}
              </span>
            ))}
          </div>
        </div>

        {/* Thumbnail Selector */}
        <div className="p-3 flex gap-2 border-b border-[#D6D6C2] overflow-x-auto bg-[#EBEBE0]/30">
          {house.images.map((img, idx) => (
            <button
              id={`detail-thumb-${idx}`}
              key={idx}
              onClick={() => setActiveImageIndex(idx)}
              className={`w-14 h-10 rounded-lg overflow-hidden border-2 shrink-0 transition-all ${
                idx === activeImageIndex ? 'border-[#5A5A40] scale-105' : 'border-transparent opacity-70'
              }`}
            >
              <img referrerPolicy="no-referrer" src={img} alt="thumbnail" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>

        {/* Title and Address */}
        <div className="p-5 space-y-2">
          <h1 className="text-sm font-extrabold text-[#4A4A3A] leading-tight">{house.name}</h1>
          <div className="flex items-center gap-1.5 text-xs text-[#8A8A70]">
            <MapPin className="w-4 h-4 text-[#BCBC9D] shrink-0" />
            <span>{house.address}</span>
          </div>

          {/* Open in external maps */}
          {house.lat && house.lng && (
            <div className="flex flex-wrap gap-2 pt-1">
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${house.lat},${house.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-xl bg-white border border-[#D6D6C2] text-[#4A4A3A] hover:bg-[#F0EDE6] transition-colors shadow-sm"
              >
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                Google Maps
              </a>
              <a
                href={`https://waze.com/ul?ll=${house.lat},${house.lng}&navigate=yes`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-xl bg-white border border-[#D6D6C2] text-[#5A86E8] hover:bg-blue-50 transition-colors shadow-sm"
              >
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor"><path d="M20.54 6.63A10.5 10.5 0 0 0 3.5 16.5c0 .94.26 1.82.7 2.57A2 2 0 0 0 6 20h12a2 2 0 0 0 1.8-1.13c.44-.75.7-1.63.7-2.57A10.48 10.48 0 0 0 20.54 6.63zM8.5 14a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm7 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/></svg>
                Waze
              </a>
              <a
                href={`https://maps.apple.com/?q=${house.lat},${house.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-xl bg-white border border-[#D6D6C2] text-[#555] hover:bg-gray-50 transition-colors shadow-sm"
              >
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
                Apple Maps
              </a>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2 text-xs font-bold text-[#4A4A3A]">
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
              <span>{house.rating.toFixed(1)} / 5</span>
            </div>
            <span className="text-[#D6D6C2]">|</span>
            <div className="text-[#8A8A70] font-medium">{houseReviews.length} تقييم</div>
            <span className="text-[#D6D6C2]">|</span>
            {house.propertyType === 'student' || house.propertyType === 'staff' ? (
              <div className="text-[#5A5A40] font-extrabold">{house.monthlyRent} ج.م <span className="text-[10px] text-[#8A8A70] font-medium">/ شهرياً</span></div>
            ) : (
              <div className="text-[#5A5A40] font-extrabold">{house.pricePerNightPerPerson} ج.م <span className="text-[10px] text-[#8A8A70] font-medium">لكل فرد / ليلة</span></div>
            )}
          </div>

          {/* Owner announcements */}
          {announcements.filter((a) => a.isActive).map((a) => (
            <div key={a.id} className="mt-3 p-2.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2 text-[10.5px] text-amber-900 font-bold">
              <span className="text-sm">📢</span>
              <span>{a.message}</span>
            </div>
          ))}

        </div>
      </div>

      {/* About section — moved up front so it's the first thing visitors read */}
      <AccordionItem
        id="services"
        title="نبذة عن المكان"
        isOpen={openSections.services}
        onToggle={() => toggleSection('services')}
        icon={Award}
      >
        <div className="space-y-3 text-right">
          <p className="text-xs text-[#4A4A3A] leading-relaxed font-medium">{house.description}</p>

          {house.propertyType === 'student' && house.distanceFromUniversity && (
            <div className="bg-amber-50/70 border border-amber-200/50 p-3 rounded-2xl text-xs font-bold text-amber-900 mt-2">
              🏫 القرب من الجامعة والمواصلات: {house.distanceFromUniversity}
            </div>
          )}
        </div>
      </AccordionItem>

      {/* Grid with description and features */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-right">

        {/* Left column: Rooms, Halls, Restaurants */}
        <div className="space-y-4">

          {/* Weekly Restaurant Menu Display or Editor */}
          <AccordionItem
            id="menu"
            title="قائمة الطعام والوجبات"
            isOpen={openSections.menu}
            onToggle={() => toggleSection('menu')}
            icon={Utensils}
          >
            {(!house.menu && !isOwnerOrAdmin) ? (
            <div className="bg-white rounded-3xl p-5 border border-[#D6D6C2] shadow-sm text-center py-8 space-y-3">
              <Utensils className="w-8 h-8 text-[#BCBC9D] mx-auto" />
              <h3 className="text-xs font-extrabold text-[#4A4A3A]">قائمة الطعام والوجبات</h3>
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
          </AccordionItem>

          {/* Rooms and Beds breakdown */}
          <AccordionItem
            id="rooms"
            title="أنواع الغرف وخيارات التسكين المتاحة"
            isOpen={openSections.rooms}
            onToggle={() => toggleSection('rooms')}
            icon={BedDouble}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#D6D6C2]/40 pb-2.5">
                <span className="text-[10px] font-bold bg-[#0A2342]/10 text-[#0A2342] px-3 py-1 rounded-full">
                  إجمالي الغرف: {house.roomsCount} | الأسرة: {house.bedsCount}
                </span>
              </div>
              <span className="text-[9px] font-bold bg-[#EBEBE0] text-[#5A5A40] px-2.5 py-0.5 rounded-full">
                إجمالي الغرف: {house.roomsCount} | الأسرة: {house.bedsCount}
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
                          {room.bedsCount} سرير{room.pricePerNight ? ` · ${room.pricePerNight} ج.م/ليلة` : ''}
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
                              {room.price.toLocaleString()} ج.م <span className="text-[8px] text-[#8A8A70] font-bold">/ {room.priceUnit}</span>
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
          </AccordionItem>

          {/* Facilities Section */}
          <AccordionItem
            id="facilities"
            title="المرافق وقاعات المؤتمرات"
            isOpen={openSections.facilities}
            onToggle={() => toggleSection('facilities')}
            icon={Monitor}
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
                          <div className="text-[10px] text-[#8A8A70] font-semibold mt-0.5">تتسع لـ: {hall.capacity} فرد</div>
                          {hall.price !== undefined && (
                            <div className="text-[10px] text-[#5A5A40] font-bold mt-0.5">{hall.price} جنيه / اليوم</div>
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
          </AccordionItem>

          {/* Weather & Trip Planning Accordion */}
          <AccordionItem
            id="weather"
            title={`حالة الطقس والتخطيط للرحلة في ${house.governorate}`}
            isOpen={openSections.weather}
            onToggle={() => toggleSection('weather')}
            icon={CloudSun}
          >
            {(() => {
              const weather = GOVERNORATE_WEATHER_DATA[house.governorate] || DEFAULT_WEATHER;
              return (
                <div className="space-y-4 text-right" dir="rtl">
                  <div className="flex items-center justify-between border-b border-[#D6D6C2]/50 pb-2.5">
                    <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#4A4A3A]">
                      <span className="text-base">🌤️</span>
                      <span>توقعات وتوصيات طقس {house.governorate}</span>
                    </div>
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
                            رطوبة: {weather.humidity}%
                          </span>
                          <span className="flex items-center gap-0.5">
                            <Wind className="w-3 h-3 text-teal-400" />
                            رياح: {weather.windSpeed} كم/س
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-center justify-center bg-white border border-[#D6D6C2] rounded-xl px-2.5 py-1.5 shadow-sm">
                        <span className="text-lg font-black text-[#5A5A40] tracking-tight">{weather.currentTemp}°م</span>
                        <Thermometer className="w-4 h-4 text-rose-500 fill-rose-100" />
                      </div>
                    </div>

                    {/* 3-day short forecast */}
                    <div className="space-y-1.5">
                      <span className="block text-[10px] font-extrabold text-[#8A8A70]">توقعات الـ 3 أيام القادمة:</span>
                      <div className="grid grid-cols-3 gap-1.5 text-center">
                        {weather.forecast.map((day, idx) => (
                          <div key={idx} className="bg-[#FBFBFA] border border-[#D6D6C2]/60 p-2 rounded-xl space-y-1">
                            <div className="text-[9px] font-extrabold text-[#8A8A70]">{day.dayName}</div>
                            <div className="flex justify-center py-0.5">
                              {getWeatherIcon(day.icon)}
                            </div>
                            <div className="text-[9.5px] font-black text-[#4A4A3A]">{day.tempHigh}° / {day.tempLow}°</div>
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
          </AccordionItem>

        </div>

        {/* Right column: Availability, Booking Form & Conference quote requests */}
        <div className="space-y-4">

          {/* Booking & Quote Request Form */}
          <div className="bg-white rounded-3xl p-5 border border-[#D6D6C2] shadow-2xl relative overflow-hidden">
            
            {/* Subtle banner accent */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-l from-[#5A5A40] to-[#8A8A70]" />

            <div className="flex justify-between items-center pb-3 border-b border-[#D6D6C2] mb-4">
              <h3 className="text-xs font-extrabold text-[#4A4A3A]">
                {isMonthlyHousing ? 'حجز السكن والتعاقد أونلاين' : 'حجز أونلاين وتأكيد الحضور'}
              </h3>
              
              {/* Toggle regular booking or conference quote */}
              {!isMonthlyHousing && (
                <div className="flex bg-[#EBEBE0] p-0.5 rounded-xl border border-[#D6D6C2]">
                  <button
                    id="toggle-booking-regular"
                    type="button"
                    onClick={() => setIsQuoteMode(false)}
                    className={`px-2.5 py-1 rounded-lg text-[9px] font-bold transition-all ${
                      !isQuoteMode ? 'bg-[#5A5A40] text-white shadow-sm' : 'text-[#8A8A70]'
                    }`}
                  >
                    حجز عادي
                  </button>
                  <button
                    id="toggle-booking-quote"
                    type="button"
                    onClick={() => setIsQuoteMode(true)}
                    className={`px-2.5 py-1 rounded-lg text-[9px] font-bold transition-all ${
                      isQuoteMode ? 'bg-[#8A8A70] text-white shadow-sm' : 'text-[#8A8A70]'
                    }`}
                  >
                    مؤتمر كبير
                  </button>
                </div>
              )}
            </div>

            {isQuoteMode ? (
              // Conference Price Quote request form
              <form onSubmit={handleBookingSubmit} className="space-y-3">
                <div className="bg-[#EBEBE0]/40 p-2.5 rounded-2xl text-[10px] text-[#4A4A3A] border border-[#D6D6C2] leading-relaxed">
                  <span className="font-bold text-[#5A5A40]">طلب عرض سعر مخصص للمؤتمرات:</span>
                  <p>يتيح هذا النموذج إرسال المتطلبات المعقدة والجروبات الضخمة (المدارس الروحية، اجتماعات الخدام الشاملة) مباشرة لمالك البيت للتسعير الخاص.</p>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#8A8A70] mb-1">تاريخ الإقامة:</label>
                  <DateRangePicker
                    checkIn={checkIn}
                    setCheckIn={setCheckIn}
                    checkOut={checkOut}
                    setCheckOut={setCheckOut}
                    bookedRanges={allBookedRanges}
                    blockedDates={house.blockedDates}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-[#8A8A70] mb-1">العدد الإجمالي التقريبي:</label>
                    <input
                      id="quote-guests"
                      type="number"
                      required
                      min={10}
                      value={guestsCount}
                      onChange={(e) => setGuestsCount(parseInt(e.target.value) || 30)}
                      className="w-full bg-white border border-[#D6D6C2] text-xs px-2.5 py-1.5 rounded-xl text-[#4A4A3A]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-[#8A8A70] mb-1">القاعة المطلوبة أساسياً:</label>
                    <select
                      id="quote-hall"
                      value={selectedHallId}
                      onChange={(e) => setSelectedHallId(e.target.value)}
                      className="w-full bg-white border border-[#D6D6C2] text-[11px] px-2.5 py-1.5 rounded-xl text-[#4A4A3A] outline-none"
                    >
                      {house.conferenceHalls.map((h) => (
                        <option key={h.id} value={h.id}>{h.name}{h.price !== undefined ? ` — ${h.price} ج/اليوم` : ''}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2 py-1">
                  <button
                    id="quote-meals-toggle"
                    type="button"
                    onClick={() => setMealsIncluded(!mealsIncluded)}
                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                      mealsIncluded ? 'bg-[#5A5A40] border-[#5A5A40] text-white' : 'bg-white border-[#D6D6C2]'
                    }`}
                  >
                    {mealsIncluded && <Check className="w-2.5 h-2.5" />}
                  </button>
                  <span className="text-[10px] text-[#8A8A70] font-semibold">شامل تأمين وجبات الإفطار والغداء والعشاء الكاملة للجروب.</span>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#8A8A70] mb-1">تفاصيل وطلبات إضافية لمالك البيت:</label>
                  <textarea
                    id="quote-requests"
                    rows={3}
                    placeholder="مثال: نرغب في توفير غرف فردية للآباء الكهنة المرافقين، وتجهيز الكنيسة الكبرى للقداس صباح الجمعة..."
                    value={extraRequests}
                    onChange={(e) => setExtraRequests(e.target.value)}
                    className="w-full bg-white border border-[#D6D6C2] text-xs px-3 py-2 rounded-xl text-[#4A4A3A] focus:outline-none"
                  />
                </div>

                <button
                  id="quote-submit-btn"
                  type="submit"
                  className="w-full bg-[#8A8A70] hover:bg-[#5A5A40] text-white text-xs font-bold py-2.5 rounded-xl shadow-md text-center transition-colors cursor-pointer"
                >
                  إرسال متطلبات المؤتمر لطلب عرض سعر
                </button>
              </form>
            ) : (
              // Regular Booking Form / Monthly Student Lease Form
              <form onSubmit={handleBookingSubmit} className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-[#8A8A70] mb-1">
                    تاريخ الإقامة:
                  </label>
                  <DateRangePicker
                    checkIn={checkIn}
                    setCheckIn={setCheckIn}
                    checkOut={checkOut}
                    setCheckOut={setCheckOut}
                    isMonthlyHousing={isMonthlyHousing}
                    bookedRanges={allBookedRanges}
                    blockedDates={house.blockedDates}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#8A8A70] mb-1">
                    {isMonthlyHousing ? 'عدد الطلاب / الموظفين:' : 'عدد أفراد الخلوة / الحضور:'}
                  </label>
                  <input
                    id="book-guests"
                    type="number"
                    required
                    min={1}
                    value={guestsCount}
                    onChange={(e) => setGuestsCount(parseInt(e.target.value) || 1)}
                    className="w-full bg-white border border-[#D6D6C2] text-xs px-3 py-2 rounded-xl text-[#4A4A3A]"
                  />
                </div>

                {/* Points redemption toggle — logged-in users with a balance only */}
                {(currentUser?.points || 0) > 0 && (
                  <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-3 space-y-1.5">
                    <label htmlFor="use-points-toggle" className="flex items-center justify-between gap-2 cursor-pointer">
                      <span className="flex items-center gap-2">
                        <input
                          id="use-points-toggle"
                          type="checkbox"
                          checked={usePoints}
                          onChange={(e) => setUsePoints(e.target.checked)}
                          className="w-4 h-4 accent-emerald-600 cursor-pointer shrink-0"
                        />
                        <span className="text-[10.5px] font-bold text-emerald-900">
                          استخدم نقاطك للخصم (رصيدك: {(currentUser?.points || 0).toLocaleString('ar-EG')} نقطة)
                        </span>
                      </span>
                      {usePoints && redemptionDiscount > 0 && (
                        <span className="text-[10px] font-black text-emerald-700 shrink-0">
                          -{redemptionDiscount.toLocaleString('ar-EG')} ج.م
                        </span>
                      )}
                    </label>
                    <p className="text-[9px] text-emerald-800/70 font-medium">
                      كل 100 نقطة = 1 ج.م خصم، وتغطي النقاط 10% كحد أقصى من قيمة الحجز (حتى {maxDiscountByPolicy.toLocaleString('ar-EG')} ج.م لهذا الحجز).
                    </p>
                  </div>
                )}

                {/* Live pricing display */}
                <div className="bg-[#EBEBE0]/30 border border-[#D6D6C2] rounded-2xl p-3.5 space-y-2 text-xs">
                  {isMonthlyHousing ? (
                    <>
                      <div className="flex justify-between text-[#8A8A70]">
                        <span>عدد الشهور الإجمالية التقريبية:</span>
                        <span className="font-bold text-[#4A4A3A]">{months} شهر</span>
                      </div>
                      <div className="flex justify-between text-[#8A8A70]">
                        <span>الإيجار الشهري للفرد:</span>
                        <span className="font-bold text-[#4A4A3A]">{house.monthlyRent} ج.م</span>
                      </div>
                      {redemptionDiscount > 0 && (
                        <div className="flex justify-between text-emerald-700">
                          <span>خصم النقاط المستخدمة:</span>
                          <span className="font-bold">-{redemptionDiscount.toLocaleString()} ج.م</span>
                        </div>
                      )}
                      <div className="flex justify-between font-black text-sm pt-2 border-t border-[#D6D6C2] text-[#4A4A3A]">
                        <span>الإجمالي للتعاقد:</span>
                        <span>{totalPrice.toLocaleString()} ج.م</span>
                      </div>
                      <div className="text-[9px] text-[#8A8A70] font-medium pt-1">
                        * يلتزم الساكن بدفع الإيجار بشكل شهري منتظم لمالك البيت طبقاً للاتفاق.
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between text-[#8A8A70]">
                        <span>عدد الليالي الإجمالي:</span>
                        <span className="font-bold text-[#4A4A3A]">{nights} ليلة</span>
                      </div>
                      {hasSeasonalNights ? (
                        // Seasonal rates hit: show the actual per-night mix
                        // instead of a single misleading base rate.
                        stayPrice.breakdown.map((row) => (
                          <div key={`${row.label ?? 'base'}-${row.rate}`} className="flex justify-between text-[#8A8A70]">
                            <span>{row.label ? `🏷️ ${row.label}` : 'السعر الأساسي'} ({row.nights} ليلة):</span>
                            <span className="font-bold text-[#4A4A3A]">{row.rate} ج.م/فرد</span>
                          </div>
                        ))
                      ) : (
                        <div className="flex justify-between text-[#8A8A70]">
                          <span>التسعير للفرد لليلة:</span>
                          <span className="font-bold text-[#4A4A3A]">{house.pricePerNightPerPerson} ج.م</span>
                        </div>
                      )}
                      {redemptionDiscount > 0 && (
                        <div className="flex justify-between text-emerald-700">
                          <span>خصم النقاط المستخدمة:</span>
                          <span className="font-bold">-{redemptionDiscount.toLocaleString()} ج.م</span>
                        </div>
                      )}
                      <div className="flex justify-between font-black text-sm pt-2 border-t border-[#D6D6C2] text-[#4A4A3A]">
                        <span>الإجمالي المقدر:</span>
                        <span>{totalPrice.toLocaleString()} ج.م</span>
                      </div>
                      <div className="text-[9px] text-[#8A8A70] font-medium pt-1">
                        * يمكنك اختيار دفع عربون مسبق لاحقاً بنسبة ١٥٪ لتأكيد حجزك رسمياً مع المالك.
                      </div>
                    </>
                  )}
                </div>

                {/* Declared cancellation policy — shown BEFORE any money moves */}
                <div className="bg-sky-50/60 border border-sky-200 rounded-2xl p-3 space-y-1.5 text-[10px] text-sky-950">
                  <div className="font-black flex items-center gap-1">🛡️ سياسة الإلغاء والاسترداد:</div>
                  <ul className="space-y-1 font-medium pr-4 list-disc">
                    <li>الإلغاء قبل الوصول بـ <strong>{settings.freeCancelDays} أيام أو أكثر</strong>: استرداد <strong>كامل</strong> لأي مبلغ مدفوع.</li>
                    <li>الإلغاء قبل الوصول بـ <strong>{settings.partialRefundDays} أيام أو أكثر</strong>: استرداد <strong>{Math.round(settings.partialRefundPct * 100)}%</strong> من المدفوع.</li>
                    <li>أقل من ذلك: لا يوجد استرداد.</li>
                  </ul>
                  <p className="text-[9px] text-sky-800/80 pt-0.5">يقوم المالك بإعادة المبلغ بنفس طريقة الدفع خلال أيام قليلة من الإلغاء.</p>
                </div>

                {wouldExceedCapacity ? (
                  <div className="space-y-2">
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-[10px] text-amber-800 font-bold text-center">
                      عذراً، البيت مكتمل الإشغال في هذه التواريخ لعدد الأفراد المطلوب.
                    </div>
                    <button
                      id="join-waitlist-btn"
                      type="button"
                      disabled={alreadyOnWaitlist}
                      onClick={handleJoinWaitlistClick}
                      className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold py-2.5 rounded-xl shadow-md text-center transition-colors cursor-pointer"
                    >
                      {alreadyOnWaitlist ? 'أنت مسجل بالفعل في قائمة الانتظار ⏳' : 'انضم لقائمة الانتظار ⏳'}
                    </button>
                  </div>
                ) : (
                  <button
                    id="book-submit-btn"
                    type="submit"
                    className="w-full bg-[#5A5A40] hover:bg-[#4A4A3A] text-white text-xs font-bold py-2.5 rounded-xl shadow-md text-center transition-colors cursor-pointer"
                  >
                    {isMonthlyHousing ? 'أرسل طلب التعاقد وحجز السكن للمالك' : 'احجز الآن وأرسل الطلب للمالك'}
                  </button>
                )}
              </form>
            )}

          </div>

          {/* Availability Calendar visual display */}
          <div className="bg-white rounded-3xl p-5 border border-[#D6D6C2] shadow-sm space-y-3">
            <div className="flex items-center gap-2 justify-between">
              <h3 className="text-xs font-extrabold text-[#4A4A3A]">تقويم إشغال البيت (يوليو ٢٠٢٦):</h3>
              <span className="text-[9px] font-bold text-[#8A8A70]">حالة التوافر</span>
            </div>
            
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

            <div className="flex items-center justify-between text-[10px] text-[#8A8A70] pt-2 border-t border-[#D6D6C2]">
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

          {/* Servant Budget Calculator card */}
          <div className="bg-white rounded-3xl p-5 border border-[#D6D6C2] shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-xs font-extrabold text-[#4A4A3A]">
              <Calculator className="w-4 h-4 text-[#5A5A40] shrink-0" />
              <span>مساعد ميزانية الخلوة (خاص بالخدام) 🧮</span>
            </div>
            <p className="text-[10px] text-[#8A8A70] leading-relaxed">
              أداة تفاعلية لمساعدتك كأمين رحلة أو خادم لحساب تكلفة الفرد وميزانية المؤتمر الكنسي بالكامل.
            </p>

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
          </div>

        </div>

      </div>

      {/* Ratings & Reviews List */}
      <div className="bg-white rounded-3xl p-5 border border-[#D6D6C2] shadow-sm space-y-5 text-right">
        <div>
          <h3 className="text-sm font-black text-[#4A4A3A]">تقييمات الضيوف</h3>
          <p className="text-[10px] text-[#8A8A70] font-medium mt-0.5">آراء الضيوف عن بيت المؤتمرات</p>
        </div>

        {houseReviews.length > 0 && (() => {
          const count = houseReviews.length;
          const overallOf = (r: Review) => r.overall_rating ?? r.rating;
          const overallAvg = parseFloat((houseReviews.reduce((s, r) => s + overallOf(r), 0) / count).toFixed(1));
          const histogram: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
          houseReviews.forEach((r) => {
            const bucket = Math.min(5, Math.max(1, Math.round(overallOf(r))));
            histogram[bucket]++;
          });

          return (
            <div className="bg-[#FAF8F5] border border-[#D6D6C2] rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Left: average score */}
              <div className="flex flex-col items-center justify-center text-center gap-1.5 sm:border-l sm:border-[#D6D6C2] sm:pl-4 py-2">
                <span className="text-3xl font-black text-[#4A4A3A]">{overallAvg}</span>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} className={`w-4 h-4 ${s <= Math.round(overallAvg) ? 'fill-amber-500 text-amber-500' : 'text-[#D6D6C2]'}`} />
                  ))}
                </div>
                <span className="text-[10px] font-extrabold text-amber-800">{REVIEW_RATING_LABEL(overallAvg)}</span>
                <span className="text-[9px] text-[#8A8A70] font-medium">{count} تقييم</span>
              </div>

              {/* Right: star distribution bar chart */}
              <div className="space-y-1.5 justify-center flex flex-col">
                {[5, 4, 3, 2, 1].map((star) => {
                  const c = histogram[star];
                  const pct = count ? Math.round((c / count) * 100) : 0;
                  return (
                    <div key={star} className="flex items-center gap-2 text-[9.5px] font-bold text-[#4A4A3A]">
                      <span className="w-7 shrink-0 flex items-center gap-0.5">{star}<Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" /></span>
                      <div className="flex-1 bg-[#EBEBE0] h-1.5 rounded-full overflow-hidden">
                        <div className="bg-amber-500 h-full rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-14 text-left text-[#8A8A70] font-medium">{pct}% ({c})</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Filter chips — reorders reviews by the selected category's score */}
        {houseReviews.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {REVIEW_CATEGORY_CHIPS.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => { setReviewFilter(chip.key); setReviewsVisibleCount(5); }}
                className={`px-3 py-1.5 rounded-full text-[10px] font-extrabold border transition-all duration-200 cursor-pointer ${
                  reviewFilter === chip.key
                    ? 'bg-[#4A4A3A] text-white border-[#4A4A3A] scale-105'
                    : 'bg-white text-[#4A4A3A] border-[#D6D6C2] hover:border-[#8A8A70]'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}

        {houseReviews.length === 0 ? (
          <p className="text-[11px] text-[#8A8A70]">لا توجد تقييمات مسجلة لهذا البيت بعد. كن أول من يضيف تقييماً خادماً للآخرين!</p>
        ) : (() => {
          const dimensionOf = (r: Review, key: ReviewCategoryFilter) => {
            switch (key) {
              case 'food': return r.food_rating ?? r.rating;
              case 'service': return r.service_rating ?? r.rating;
              case 'cleanliness': return r.cleanliness_rating ?? r.rating;
              case 'organization': return r.organization_rating ?? r.rating;
              case 'value': return r.value_rating ?? r.rating;
              default: return r.overall_rating ?? r.rating;
            }
          };
          const sortedReviews = reviewFilter === 'all'
            ? houseReviews
            : [...houseReviews].sort((a, b) => dimensionOf(b, reviewFilter) - dimensionOf(a, reviewFilter));
          const visibleReviews = sortedReviews.slice(0, reviewsVisibleCount);

          return (
            <>
              <div key={reviewFilter} className="space-y-3 animate-in fade-in duration-300">
                {visibleReviews.map((rev) => {
                  const reviewFood = rev.food_rating ?? rev.rating;
                  const reviewService = rev.service_rating ?? rev.rating;
                  const reviewClean = rev.cleanliness_rating ?? rev.rating;
                  const reviewOrg = rev.organization_rating ?? rev.rating;
                  const reviewVal = rev.value_rating ?? rev.rating;
                  const reviewOverall = rev.overall_rating ?? rev.rating;

                  return (
                    <div key={rev.id} className="bg-[#EBEBE0]/25 p-3.5 rounded-2xl border border-[#D6D6C2] space-y-2.5">
                      <div className="flex justify-between items-start text-xs">
                        <div>
                          <span className="font-bold text-[#4A4A3A]">{rev.displayAnonymous ? 'زائر موثق' : rev.userName}</span>
                          {!rev.displayAnonymous && (
                            <span className="text-[9px] text-[#8A8A70] font-medium"> ({rev.userRole === 'servant' ? 'خادم' : 'فرد'})</span>
                          )}
                          <span className="text-[8px] text-[#9A9A80] font-medium block mt-0.5">
                            {new Date(rev.createdAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}
                          </span>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star key={s} className={`w-3 h-3 ${s <= Math.round(reviewOverall) ? 'fill-amber-500 text-amber-500' : 'text-[#D6D6C2]'}`} />
                            ))}
                          </div>
                          <span className="text-[9px] font-black text-amber-900">{reviewOverall} / 5</span>
                        </div>
                      </div>

                      {/* Multi-dimensional Sub-ratings pills */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <span className="bg-amber-50 border border-amber-200/50 text-amber-950 text-[9px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-0.5">
                          🍗 طعام: {reviewFood}
                        </span>
                        <span className="bg-emerald-50 border border-emerald-200/50 text-emerald-950 text-[9px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-0.5">
                          🤵 خدمة: {reviewService}
                        </span>
                        <span className="bg-blue-50 border border-blue-200/50 text-blue-950 text-[9px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-0.5">
                          🧼 نظافة: {reviewClean}
                        </span>
                        <span className="bg-indigo-50 border border-indigo-200/50 text-indigo-950 text-[9px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-0.5">
                          📋 تنظيم: {reviewOrg}
                        </span>
                        <span className="bg-rose-50 border border-rose-200/50 text-rose-950 text-[9px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-0.5">
                          💰 قيمة: {reviewVal}
                        </span>
                      </div>

                      <p className="text-[11px] text-[#4A4A3A] leading-relaxed font-medium pt-1 border-t border-[#D6D6C2]/40">
                        {rev.comment}
                      </p>

                      {rev.ownerReply && (
                        <div className="bg-[#5A5A40]/5 border-r-2 border-[#5A5A40] p-2.5 rounded-l-xl mt-2 text-right space-y-1">
                          <div className="flex items-center justify-between text-[10px] font-extrabold text-[#5A5A40]">
                            <span>رد إدارة البيت 🏨:</span>
                            {rev.ownerReplyCreatedAt && (
                              <span className="text-[8px] text-[#8A8A70] font-mono">{new Date(rev.ownerReplyCreatedAt).toLocaleDateString('ar-EG')}</span>
                            )}
                          </div>
                          <p className="text-[10.5px] text-[#4A4A3A] leading-relaxed">
                            {rev.ownerReply}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {sortedReviews.length > reviewsVisibleCount && (
                <button
                  type="button"
                  onClick={() => setReviewsVisibleCount((c) => c + 5)}
                  className="w-full flex items-center justify-center gap-1.5 bg-[#FAF8F5] hover:bg-[#EBEBE0]/50 border border-[#D6D6C2] text-[#4A4A3A] font-extrabold py-2.5 rounded-2xl text-[11px] transition-all cursor-pointer"
                >
                  <span>عرض المزيد</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          );
        })()}

        {/* 3-step guest review flow — replaces the old single-screen form */}
        <div className="pt-4 border-t border-[#D6D6C2]">
          {currentUser ? (
            <ReviewWizard house={house} currentUser={currentUser} onSubmitReview={onSubmitReview} previewMode={previewMode} />
          ) : (
            // Logged-out visitor: reviews require an account (and a real
            // booking — enforced server-side), so prompt login instead.
            <div className="bg-[#FAF8F5] border border-[#D6D6C2] rounded-3xl p-6 text-center space-y-2">
              <p className="text-xs font-black text-[#4A4A3A]">عايز تشارك تجربتك في المكان ده؟</p>
              <p className="text-[10px] text-[#8A8A70] font-medium">سجّل دخولك لكتابة تقييم بعد إقامتك.</p>
              <button
                type="button"
                onClick={() => onRequireLogin?.()}
                className="bg-[#5A5A40] hover:bg-[#4A4A3A] text-white font-extrabold text-xs px-5 py-2.5 rounded-xl transition-colors cursor-pointer"
              >
                تسجيل الدخول
              </button>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
