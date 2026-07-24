import React, { useState, useEffect } from 'react';
import { Booking, User, RetreatHouse, Attendee, RoomAllocation, Room, Payment, PlatformSettings, DEFAULT_PLATFORM_SETTINGS } from '../types';
import { 
  Calendar, Users, DollarSign, Clock, CheckCircle2, XCircle, FileText, 
  Printer, Building, AlertTriangle, Bell, Smartphone, CreditCard, 
  Coins, Upload, ShieldCheck, Image, Check, Sparkles, ListTodo, Plus, Trash2, BookOpen,
  FileDown, MessageCircle, MapPin
} from 'lucide-react';
import RoomDistribution from './RoomDistribution';
import BookingChatPanel from './BookingChatPanel';
import { refundAmountFor } from '../lib/cancellationPolicy';

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
  payments: Payment[];
  onSubmitPayment: (payment: Payment) => void;
  settings?: PlatformSettings;
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
  payments,
  onSubmitPayment,
  settings = DEFAULT_PLATFORM_SETTINGS,
}: UserBookingsProps) {
  const [activeReceipt, setActiveReceipt] = useState<Booking | null>(null);
  const [activeAllocationBooking, setActiveAllocationBooking] = useState<Booking | null>(null);
  const [isPaying, setIsPaying] = useState<string | null>(null);
  const [chatOpenBookingId, setChatOpenBookingId] = useState<string | null>(null);
  
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

  const handleGenerateMockProof = (amountVal: number) => {
    let iconColor = '%2310B981'; // Emerald
    let methodText = 'InstaPay%20Transfer';
    let reference = 'Ref:%20IP-' + Math.floor(10000000 + Math.random() * 90000000);

    if (selectedMethod === 'vodafone') {
      iconColor = '%23EF4444'; // Red for Vodafone
      methodText = 'Vodafone%20Cash';
      reference = 'TxID:%20' + Math.floor(10000000000 + Math.random() * 90000000000);
    } else if (selectedMethod === 'bank') {
      iconColor = '%23464E3D'; // Earthy primary for Bank
      methodText = 'Bank%20Transfer';
      reference = 'Ref:%20BT-' + Math.floor(100000 + Math.random() * 900000);
    }

    const displayAmount = paymentAmount ? parseFloat(paymentAmount).toLocaleString('ar-EG') : amountVal.toLocaleString('ar-EG');

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="150" viewBox="0 0 300 150">
      <rect width="300" height="150" fill="%23FAF8F5" rx="10" stroke="${iconColor}" stroke-width="3"/>
      <circle cx="50" cy="40" r="20" fill="${iconColor}"/>
      <text x="50" y="45" font-family="sans-serif" font-size="16" font-weight="bold" fill="white" text-anchor="middle">✓</text>
      <text x="85" y="40" font-family="sans-serif" font-size="14" font-weight="bold" fill="%232D2D24">${methodText}</text>
      <text x="85" y="55" font-family="sans-serif" font-size="10" fill="%23867E65">Transaction Successful</text>
      <line x1="20" y1="80" x2="280" y2="80" stroke="%23E7E5DB" stroke-width="1" stroke-dasharray="5,5"/>
      <text x="20" y="105" font-family="sans-serif" font-size="11" font-weight="bold" fill="%23464E3D">EGP ${displayAmount}</text>
      <text x="20" y="125" font-family="sans-serif" font-size="9" fill="%23867E65">${reference}</text>
      <text x="280" y="125" font-family="sans-serif" font-size="8" fill="%23867E65" text-anchor="end">Coptic Retreats Pay</text>
    </svg>`;
    const dataUrl = `data:image/svg+xml;utf8,${svg}`;
    setProofImage(dataUrl);
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
      <div className="flex items-center justify-between">
        <h2 className="text-base font-extrabold text-[#4A4A3A]">حجوزاتي وطلبات الأسعار</h2>
        <span className="text-[11px] font-bold text-[#4A4A3A] bg-[#EBEBE0] px-2.5 py-1 rounded-full border border-[#D6D6C2]">
          {userBookings.length} طلب
        </span>
      </div>

      {unpaidApprovedCount > 0 && (
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
        <div className="space-y-3">
          {userBookings.map((booking) => {
            const badge = getStatusBadge(booking.status);
            const StatusIcon = badge.icon;
            const canPayDeposit = booking.status === 'approved' && !booking.depositPaid;
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

            return (
              <div
                id={`booking-card-${booking.id}`}
                key={booking.id}
                className="bg-white rounded-3xl border border-[#D6D6C2] shadow-sm overflow-hidden text-right"
              >
                {/* Header info */}
                <div className="p-4 border-b border-[#D6D6C2]/60 flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <span className="text-[9px] text-[#8A8A70] font-semibold tracking-wider">
                      رقم الطلب: #{booking.id.toUpperCase()}
                    </span>
                    <h3 className="text-xs font-bold text-[#4A4A3A] line-clamp-1">{booking.houseName}</h3>
                    
                    {booking.isLargeConferenceQuote && (
                      <span className="inline-block text-[9px] bg-[#EBEBE0] border border-[#BCBC9D] text-[#5A5A40] px-1.5 py-0.5 rounded font-extrabold">
                        طلب عرض سعر لمؤتمر كبير
                      </span>
                    )}
                  </div>
                  
                  <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-bold shrink-0 ${badge.color}`}>
                    <StatusIcon className="w-3.5 h-3.5 shrink-0" />
                    <span>{badge.label}</span>
                  </div>
                </div>

                {/* Details Body */}
                <div className="p-4 grid grid-cols-2 gap-3 text-xs border-b border-[#D6D6C2]/60 bg-[#EBEBE0]/20">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#BCBC9D] shrink-0" />
                    <div>
                      <div className="text-[9px] text-[#8A8A70] font-medium">تاريخ الدخول والوصول:</div>
                      <div className="font-bold text-[#4A4A3A]">{booking.checkIn}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#BCBC9D] shrink-0" />
                    <div>
                      <div className="text-[9px] text-[#8A8A70] font-medium">تاريخ المغادرة والخرود:</div>
                      <div className="font-bold text-[#4A4A3A]">{booking.checkOut}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#BCBC9D] shrink-0" />
                    <div>
                      <div className="text-[9px] text-[#8A8A70] font-medium">عدد الأفراد والحاضرين:</div>
                      <div className="font-bold text-[#4A4A3A]">{booking.guestsCount} فرد</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-[#BCBC9D] shrink-0" />
                    <div>
                      <div className="text-[9px] text-[#8A8A70] font-medium">إجمالي التكلفة المتوقعة:</div>
                      <div className="font-bold text-[#4A4A3A]">{booking.totalPrice.toLocaleString()} ج.م</div>
                    </div>
                  </div>
                </div>

                {/* Large conference custom options if present */}
                {booking.isLargeConferenceQuote && booking.conferenceDetails && (
                  <div className="p-4 bg-[#EBEBE0]/15 border-b border-[#D6D6C2]/60 text-xs text-[#4A4A3A] space-y-1">
                    <div className="font-bold flex items-center gap-1 text-[#464E3D]">
                      <Building className="w-3.5 h-3.5" />
                      <span>متطلبات المؤتمر الكنسي:</span>
                    </div>
                    <div className="text-[10px] text-[#2D2D24]/80 leading-relaxed bg-white border border-[#E7E5DB] p-2 rounded-xl mt-1 text-right">
                      {booking.conferenceDetails.extraRequests}
                    </div>
                    <div className="flex gap-4 text-[10px] text-[#464E3D] font-medium pt-1">
                      <span>• شامل حجز قاعة الاجتماعات</span>
                      {booking.conferenceDetails.mealsIncluded && <span>• شامل الوجبات اليومية الثلاث كاملة</span>}
                    </div>
                  </div>
                )}
                {canPayDeposit && (
                  <div className="px-4 py-2.5 bg-amber-50/70 border-b border-[#D6D6C2]/60 flex items-center gap-2 text-[10px] text-amber-950 font-bold">
                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>تنبيه السداد: يرجى إرسال عربون جدية الحجز بقيمة {Math.round(booking.totalPrice * settings.depositRate).toLocaleString('ar-EG')} ج.م ({Math.round(settings.depositRate * 100)}%) لتثبيت الحجز والغرف بالبيت.</span>
                  </div>
                )}

                {/* Communication with the owner happens ONLY through the
                    in-app chat — no phone/email reveal. The address shows
                    up here after deposit is paid, so the group knows where
                    to go on the day. */}
                {booking.status === 'approved' && booking.depositPaid && (() => {
                  const house = houses.find(h => h.id === booking.houseId);
                  return (
                    <div className="px-4 py-3 bg-emerald-50 border-b border-emerald-200 space-y-2 text-[10px]">
                      <div className="flex items-center gap-1.5 font-extrabold text-emerald-900">
                        <ShieldCheck className="w-4 h-4 text-emerald-700" />
                        <span>✓ حجزك مؤكد وجاهز</span>
                      </div>
                      {house?.address && (
                        <div className="bg-white p-2.5 rounded-xl border border-emerald-200 flex items-start gap-2 text-slate-700">
                          <MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                          <div>
                            <div className="text-emerald-800 font-bold mb-0.5">عنوان البيت:</div>
                            <div>{house.address}</div>
                          </div>
                        </div>
                      )}
                      <p className="text-emerald-900 text-[10px] leading-relaxed">
                        💬 لأي استفسار أو تنسيق قبل الوصول، تواصل مع صاحب البيت مباشرةً من محادثة الحجز بالأسفل — كل الرسائل محفوظة عندك.
                      </p>
                    </div>
                  );
                })()}

                {/* While pending, show the owner's payment methods as a preview so the guest
                    knows in advance how they'll pay once approved — the actual pay/upload
                    form only unlocks after approval (bookingHouse defined above, line ~537). */}
                {booking.status === 'pending' && payMethods.length > 0 && (
                  <div className="px-4 py-3 bg-[#FAF8F5] border-b border-[#D6D6C2]/60 space-y-1.5 text-[10px]">
                    <div className="flex items-center gap-1.5 font-extrabold text-[#4A4A3A]">
                      <Coins className="w-4 h-4 text-[#867E65]" />
                      <span>وسائل دفع العربون عند الموافقة (السداد إلى {payeeLabel})</span>
                    </div>
                    <p className="text-[9px] text-[#8A8A70]">هتقدر تسدد العربون بمجرد الموافقة على حجزك عن طريق أي من الوسائل دي:</p>
                    <div className="bg-white p-2.5 rounded-xl border border-[#E7E5DB] space-y-1.5">
                      {payMethods.map((pm) => (
                        <div key={pm.id} className="flex justify-between items-center">
                          <span className="text-[#867E65] font-bold">{PAYMENT_TYPE_LABELS[pm.type] || pm.label}:</span>
                          <span className="font-mono font-extrabold text-[#2D2D24]">{pm.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Smart 3-Days Check-In Reminder Banner */}
                {(() => {
                  if (booking.status !== 'approved') return null;

                  const checkInDate = new Date(booking.checkIn);
                  const today = new Date();
                  checkInDate.setHours(0, 0, 0, 0);
                  today.setHours(0, 0, 0, 0);
                  const timeDiff = checkInDate.getTime() - today.getTime();
                  const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

                  if (daysDiff > 3 || daysDiff < 0) return null;

                  // Calculate remaining balance
                  const bPayments = payments.filter(
                    (p) => p.bookingId === booking.id && p.paymentStatus === 'approved'
                  );
                  const totalPaid = bPayments.reduce((sum, p) => sum + p.amount, 0);
                  const remaining = booking.totalPrice - totalPaid;
                  const hasRemaining = remaining > 0;

                  // Check if rooms and attendees are incomplete
                  const bAttendees = attendees.filter((a) => a.bookingId === booking.id);
                  const bAllocations = allocations.filter((al) => al.bookingId === booking.id);
                  const isRoomsIncomplete =
                    bAttendees.length < booking.guestsCount ||
                    bAllocations.length < booking.guestsCount;

                  if (!hasRemaining && !isRoomsIncomplete) return null;

                  return (
                    <div className="px-4 py-3 bg-amber-50 border-b border-amber-200 flex flex-col gap-2 text-xs text-amber-950">
                      <div className="flex items-center gap-1.5 font-extrabold text-amber-900">
                        <Bell className="w-4 h-4 text-amber-700 shrink-0 animate-bounce" />
                        <span>تنبيه ذكي: موعد خلوتك يقترب بعد {daysDiff} أيام ({booking.checkIn})!</span>
                      </div>
                      <div className="space-y-1.5 pl-1.5 text-[10.5px] text-amber-900/90 pr-1">
                        {hasRemaining && (
                          <div className="flex items-start gap-1 font-bold">
                            <span className="text-rose-700 shrink-0">⚠️</span>
                            <span>يرجى سداد المبلغ المتبقي المستحق وقدره <strong className="text-rose-800 font-extrabold">{remaining.toLocaleString('ar-EG')} ج.م</strong> لتأكيد السداد الكامل للخلوة.</span>
                          </div>
                        )}
                        {isRoomsIncomplete && (
                          <div className="flex items-start gap-1 font-bold">
                            <span className="text-amber-700 shrink-0">⚠️</span>
                            <span>يرجى إكمال قائمة الحاضرين وتوزيع الغرف بالبيت. تم إدخال <strong className="text-amber-800">{bAttendees.length} من أصل {booking.guestsCount}</strong> مرافقين حالياً.</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Extended Payment & Status Indicators bar */}
                <div className="p-3.5 bg-[#FAF8F5] border-b border-[#E7E5DB] flex flex-wrap items-center justify-between gap-3">
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

                  <div className="flex items-center gap-1.5">
                    {/* Cancel booking (pending or approved) — the confirm
                        shows the declared refund entitlement so the guest
                        knows exactly what they're owed before deciding. */}
                    {(booking.status === 'pending' || booking.status === 'approved') && (
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
                        className="flex items-center gap-1 bg-red-50 hover:bg-red-100 text-red-800 border border-red-200 px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5 text-red-600" />
                        <span>إلغاء الحجز</span>
                      </button>
                    )}

                    {/* Room distribution feature (visible for approved or completed bookings) */}
                    {(booking.status === 'approved' || booking.status === 'completed') && (
                      <button
                        id={`booking-allocation-btn-${booking.id}`}
                        onClick={() => { setActiveAllocationBooking(booking); onOpenRoomDistribution?.(booking.id); }}
                        className="flex items-center gap-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all cursor-pointer"
                      >
                        <Building className="w-3.5 h-3.5 text-amber-700" />
                        <span>توزيع الغرف</span>
                      </button>
                    )}

                    {/* Invoice/Receipt action */}
                    <button
                      id={`booking-receipt-btn-${booking.id}`}
                      onClick={() => setActiveReceipt(booking)}
                      className="flex items-center gap-1 bg-[#E7E2D5] hover:bg-[#FAF8F5] text-[#2D2D24] border border-[#C5BCA0] px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5 text-[#867E65]" />
                      <span>سند التأكيد</span>
                    </button>

                    {/* Retreat Program Planner button */}
                    {(booking.status === 'approved' || booking.status === 'completed') && (
                      <button
                        id={`booking-planner-btn-${booking.id}`}
                        onClick={() => {
                          setActivePlannerBooking(booking);
                          setPlannerTheme('growth');
                          setPlannerTab('schedule');
                          // Initialize packing checklist for this booking if empty
                          if (!plannerChecklist[booking.id]) {
                            setPlannerChecklist(prev => ({
                              ...prev,
                              [booking.id]: DEFAULT_CHECKLIST_ITEMS.map(item => ({ ...item }))
                            }));
                          }
                          // Initialize activities for this booking if empty
                          if (!customActivities[booking.id]) {
                            setCustomActivities(prev => ({
                              ...prev,
                              [booking.id]: getThemeActivities('growth')
                            }));
                          }
                        }}
                        className="flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-950 border border-emerald-200 px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all cursor-pointer"
                      >
                        <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                        <span>برنامج الخلوة 📅</span>
                      </button>
                    )}

                    {/* Message the house owner — booking-scoped chat, works for any
                        non-rejected/cancelled booking (mirrors the owner side's gate) */}
                    {booking.status !== 'rejected' && booking.status !== 'cancelled' && (
                      <button
                        id={`booking-chat-btn-${booking.id}`}
                        onClick={() => setChatOpenBookingId(chatOpenBookingId === booking.id ? null : booking.id)}
                        className="flex items-center gap-1 bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200 px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all cursor-pointer"
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-sky-700" />
                        <span>راسل صاحب البيت</span>
                      </button>
                    )}

                    {/* Egyptian Payment Trigger button */}
                    {canPayDeposit && (
                      <button
                        id={`pay-deposit-btn-${booking.id}`}
                        onClick={() => {
                          setIsPaying(booking.id);
                          setPaymentAmount(Math.round(booking.totalPrice * settings.depositRate).toString());
                        }}
                        className="bg-[#464E3D] hover:bg-[#343A2D] text-white border border-[#464E3D] px-3.5 py-1 rounded-xl text-[10px] font-extrabold transition-all cursor-pointer shadow-sm"
                      >
                        سداد الدفعة الآن
                      </button>
                    )}
                  </div>
                </div>

                {chatOpenBookingId === booking.id && (
                  <div className="px-4 pb-4">
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
                {isPaying === booking.id && (
                  <div className="p-5 bg-[#F3F0E8] border-t border-[#E7E5DB] space-y-4 animate-in slide-in-from-top duration-300">
                    <div className="flex items-center justify-between border-b border-[#E7E5DB] pb-2">
                      <div className="space-y-0.5 text-right">
                        <h4 className="text-xs font-extrabold text-[#2D2D24] flex items-center gap-1">
                          <Coins className="w-4 h-4 text-[#464E3D]" />
                          <span>بوابة سداد حجز بيت المؤتمرات</span>
                        </h4>
                        <p className="text-[10px] text-[#867E65]">اختر وسيلة الدفع المناسبة لك من الخيارات المتاحة بالسوق المصري</p>
                      </div>
                      <button 
                        id="pay-close-cross-btn"
                        onClick={() => setIsPaying(null)} 
                        className="text-[11px] font-bold text-rose-700 hover:bg-rose-50 px-2 py-1 rounded-lg border border-rose-200"
                      >
                        إلغاء بوابة السداد ✕
                      </button>
                    </div>

                    {/* Payment methods selector tabs */}
                    <div className={`grid gap-1.5 ${payToPlatform ? 'grid-cols-3' : 'grid-cols-5'}`}>
                      {[
                        { id: 'instapay', label: 'إنستا باي', desc: 'InstaPay', icon: Smartphone },
                        { id: 'vodafone', label: 'فودافون كاش', desc: 'Vodafone', icon: Smartphone },
                        { id: 'bank', label: 'تحويل بنكي', desc: 'Bank Transfer', icon: Building },
                        // Cash-at-house routes money to the owner and the "online" card is a
                        // mock gateway — both bypass platform collection, so hide them when
                        // the platform holds the deposit (migration 069).
                        ...(payToPlatform ? [] : [
                          { id: 'cash', label: 'دفع نقدي', desc: 'Cash Payment', icon: Coins },
                          { id: 'online', label: 'كارت أونلاين', desc: 'Visa/Master', icon: CreditCard },
                        ]),
                      ].map((m) => {
                        const IconComponent = m.icon;
                        const isSelected = selectedMethod === m.id;
                        return (
                          <button
                            id={`pay-method-tab-${m.id}`}
                            key={m.id}
                            type="button"
                            onClick={() => {
                              setSelectedMethod(m.id as any);
                              setProofImage('');
                            }}
                            className={`flex flex-col items-center justify-center p-2 rounded-2xl border transition-all text-center space-y-1 cursor-pointer ${
                              isSelected
                                ? 'bg-[#464E3D] text-white border-[#464E3D] shadow-md scale-[1.03]'
                                : 'bg-white text-[#2D2D24] border-[#E7E5DB] hover:bg-[#FAF8F5]'
                            }`}
                          >
                            <IconComponent className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-[#867E65]'}`} />
                            <div className="text-[9px] font-extrabold leading-tight">{m.label}</div>
                            <div className="text-[8px] opacity-70 font-mono hidden sm:block">{m.desc}</div>
                          </button>
                        );
                      })}
                    </div>

                    <form onSubmit={(e) => handleEgyptianPaymentSubmit(e, booking)} className="space-y-4">
                      {/* Amount Input */}
                      <div className="bg-white p-3 rounded-2xl border border-[#E7E5DB] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-inner">
                        <div className="space-y-0.5">
                          <label className="block text-[10px] font-bold text-[#867E65]">مبلغ الدفع المقترح (ج.م):</label>
                          <p className="text-[9px] text-[#867E65]">الحد الأدنى للعربون ({Math.round(settings.depositRate * 100)}%): {Math.round(booking.totalPrice * settings.depositRate).toLocaleString('ar-EG')} ج.م / التكلفة الكلية: {booking.totalPrice.toLocaleString('ar-EG')} ج.م</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            id="payment-amount-input"
                            type="number"
                            required
                            min={Math.round(booking.totalPrice * settings.depositRate)}
                            max={booking.totalPrice}
                            value={paymentAmount}
                            onChange={(e) => {
                              setPaymentAmount(e.target.value);
                              setProofImage('');
                            }}
                            className="bg-[#FAF8F5] border border-[#E7E5DB] rounded-xl text-xs font-bold px-3 py-1.5 w-32 text-center text-[#2D2D24] focus:outline-none focus:ring-1 focus:ring-[#464E3D]"
                          />
                          <button
                            id="pay-amount-full-btn"
                            type="button"
                            onClick={() => {
                              setPaymentAmount(booking.totalPrice.toString());
                              setProofImage('');
                            }}
                            className="bg-[#E7E2D5] hover:bg-[#FAF8F5] border border-[#C5BCA0] text-[#2D2D24] text-[9px] font-bold px-2 py-1.5 rounded-lg transition-colors"
                          >
                            دفع كامل المبلغ
                          </button>
                        </div>
                      </div>

                      {/* Instruction & custom inputs based on selected method */}
                      <div className="bg-white p-4 rounded-2xl border border-[#E7E5DB] space-y-3">
                        {selectedMethod === 'instapay' && (
                          <div className="space-y-3">
                            <div className="bg-emerald-50 border border-emerald-100 p-2.5 rounded-xl text-[10px] text-emerald-950 leading-relaxed font-bold">
                              {ownerPaymentFor('instapay') ? (
                                <>💡 تعليمات إنستا باي: يرجى التحويل إلى {payeeLabel} على عنوان الدفع (IPA): <span className="font-mono underline text-emerald-900">{ownerPaymentFor('instapay')!.value}</span> عبر تطبيق إنستاباي.</>
                              ) : (
                                <>⚠️ لا يوجد رقم إنستاباي متاح حالياً. اختر وسيلة دفع أخرى.</>
                              )}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[10px] font-bold text-[#867E65] mb-1">اسم حسابك / عنوانك في InstaPay:</label>
                                <input
                                  id="instapay-address"
                                  type="text"
                                  required
                                  placeholder="Mina@instapay"
                                  value={instaAddress}
                                  onChange={(e) => setInstaAddress(e.target.value)}
                                  className="w-full bg-[#FAF8F5] border border-[#E7E5DB] rounded-xl text-xs px-3 py-2 text-[#2D2D24] focus:outline-none focus:border-[#464E3D]"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-[#867E65] mb-1">رقم مرجع التحويل (Ref ID):</label>
                                <input
                                  id="instapay-ref"
                                  type="text"
                                  required
                                  placeholder="مرجع التحويل الـ 12 رقم"
                                  value={instaRef}
                                  onChange={(e) => setInstaRef(e.target.value)}
                                  className="w-full bg-[#FAF8F5] border border-[#E7E5DB] rounded-xl text-xs px-3 py-2 text-[#2D2D24] focus:outline-none focus:border-[#464E3D]"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {selectedMethod === 'vodafone' && (
                          <div className="space-y-3">
                            <div className="bg-rose-50 border border-rose-100 p-2.5 rounded-xl text-[10px] text-rose-950 leading-relaxed font-bold">
                              {(() => {
                                const wallet = ownerPaymentFor('vodafone_cash') ?? ownerPaymentFor('etisalat_cash') ?? ownerPaymentFor('orange_cash') ?? ownerPaymentFor('we_cash');
                                return wallet ? (
                                  <>💡 تعليمات المحفظة ({wallet.label}): يرجى إرسال العربون إلى {payeeLabel} على رقم: <span className="font-mono text-rose-900 underline">{wallet.value}</span>.</>
                                ) : (
                                  <>⚠️ لا يوجد رقم محفظة متاح حالياً. اختر وسيلة دفع أخرى.</>
                                );
                              })()}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[10px] font-bold text-[#867E65] mb-1">رقم المحفظة المرسل منها:</label>
                                <input
                                  id="vodafone-number"
                                  type="text"
                                  required
                                  maxLength={11}
                                  placeholder="010XXXXXXXX"
                                  value={vodafoneNumber}
                                  onChange={(e) => setVodafoneNumber(e.target.value)}
                                  className="w-full bg-[#FAF8F5] border border-[#E7E5DB] rounded-xl text-xs px-3 py-2 text-[#2D2D24] focus:outline-none focus:border-[#464E3D]"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-[#867E65] mb-1">معرف العملية (Transaction ID):</label>
                                <input
                                  id="vodafone-txid"
                                  type="text"
                                  required
                                  placeholder="الرقم التعريفي من رسالة فودافون"
                                  value={vodafoneTxId}
                                  onChange={(e) => setVodafoneTxId(e.target.value)}
                                  className="w-full bg-[#FAF8F5] border border-[#E7E5DB] rounded-xl text-xs px-3 py-2 text-[#2D2D24] focus:outline-none focus:border-[#464E3D]"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {selectedMethod === 'bank' && (
                          <div className="space-y-3">
                            <div className="bg-indigo-50 border border-indigo-100 p-2.5 rounded-xl text-[10px] text-indigo-950 leading-relaxed font-bold">
                              {ownerPaymentFor('bank_transfer') ? (
                                <>💡 تعليمات التحويل البنكي: يرجى التحويل إلى حساب {payeeLabel} — <span className="font-mono text-indigo-900 underline">{ownerPaymentFor('bank_transfer')!.value}</span>.</>
                              ) : (
                                <>⚠️ لا يوجد حساب بنكي متاح حالياً. اختر وسيلة دفع أخرى.</>
                              )}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[10px] font-bold text-[#867E65] mb-1">اسم البنك المرسل منه:</label>
                                <select
                                  id="bank-name-select"
                                  value={bankName}
                                  onChange={(e) => setBankName(e.target.value)}
                                  className="w-full bg-[#FAF8F5] border border-[#E7E5DB] rounded-xl text-xs px-3 py-2 text-[#2D2D24] focus:outline-none focus:border-[#464E3D]"
                                >
                                  <option>البنك الأهلي المصري (NBE)</option>
                                  <option>بنك مصر (Banque Misr)</option>
                                  <option>البنك التجاري الدولي (CIB)</option>
                                  <option>بنك قطر الوطني (QNB)</option>
                                  <option>بنك الإسكندرية</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-[#867E65] mb-1">رقم مرجع التحويل أو الحوالة البنكية:</label>
                                <input
                                  id="bank-ref"
                                  type="text"
                                  required
                                  placeholder="رقم العملية البنكية"
                                  value={bankRef}
                                  onChange={(e) => setBankRef(e.target.value)}
                                  className="w-full bg-[#FAF8F5] border border-[#E7E5DB] rounded-xl text-xs px-3 py-2 text-[#2D2D24] focus:outline-none focus:border-[#464E3D]"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {selectedMethod === 'cash' && (
                          <div className="space-y-3">
                            <div className="bg-amber-50 border border-amber-100 p-2.5 rounded-xl text-[10px] text-amber-950 leading-relaxed font-bold">
                              💡 السداد النقدي بالبيت: للدفع مباشرة ببيت المؤتمرات، يرجى تقديم الدفعة لمسؤول الاستقبال أو الراهب المشرف، والحصول على إيصال استلام رسمي. أدخل بياناته هنا ليقوم الأدمن بالمطابقة الفورية.
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[10px] font-bold text-[#867E65] mb-1">اسم الشخص مستلم النقدية بالبيت:</label>
                                <input
                                  id="cash-receiver"
                                  type="text"
                                  required
                                  placeholder="أ. مينا رسمي (مسؤول الاستقبال)"
                                  value={cashReceiver}
                                  onChange={(e) => setCashReceiver(e.target.value)}
                                  className="w-full bg-[#FAF8F5] border border-[#E7E5DB] rounded-xl text-xs px-3 py-2 text-[#2D2D24] focus:outline-none focus:border-[#464E3D]"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-[#867E65] mb-1">رقم الإيصال الورقي المسلم لك:</label>
                                <input
                                  id="cash-receipt"
                                  type="text"
                                  required
                                  placeholder="مثال: REC-5023"
                                  value={cashReceiptNo}
                                  onChange={(e) => setCashReceiptNo(e.target.value)}
                                  className="w-full bg-[#FAF8F5] border border-[#E7E5DB] rounded-xl text-xs px-3 py-2 text-[#2D2D24] focus:outline-none focus:border-[#464E3D]"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {selectedMethod === 'online' && (
                          <div className="space-y-3">
                            <div className="bg-[#464E3D]/10 border border-[#C5BCA0] p-2.5 rounded-xl text-[10px] text-[#2D2D24] leading-relaxed font-bold">
                              🔒 بوابة دفع ميزة وفيزا وماستركارد مؤمنة (محاكاة دفع فوري): يرجى إدخال بيانات الكارت لتسجيل دفعتك واعتمادها فورياً بالبرنامج دون انتظار مراجعة يدوية.
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[10px] font-bold text-[#867E65] mb-1">الاسم بالكامل على البطاقة:</label>
                                <input
                                  id="online-card-name"
                                  type="text"
                                  required
                                  placeholder="Mina Raafat George"
                                  value={cardName}
                                  onChange={(e) => setCardName(e.target.value)}
                                  className="w-full bg-[#FAF8F5] border border-[#E7E5DB] rounded-xl text-xs px-3 py-2 text-[#2D2D24] focus:outline-none focus:border-[#464E3D]"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-[#867E65] mb-1">رقم الكارت الائتماني (16 رقم):</label>
                                <input
                                  id="online-card-num"
                                  type="text"
                                  required
                                  maxLength={16}
                                  placeholder="5078123456789012"
                                  value={cardNumber}
                                  onChange={(e) => setCardNumber(e.target.value)}
                                  className="w-full bg-[#FAF8F5] border border-[#E7E5DB] rounded-xl text-xs px-3 py-2 text-[#2D2D24] focus:outline-none focus:border-[#464E3D]"
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[10px] font-bold text-[#867E65] mb-1">تاريخ الانتهاء (MM/YY):</label>
                                <input
                                  id="online-card-exp"
                                  type="text"
                                  required
                                  maxLength={5}
                                  placeholder="12/28"
                                  value={expiry}
                                  onChange={(e) => setExpiry(e.target.value)}
                                  className="w-full bg-[#FAF8F5] border border-[#E7E5DB] rounded-xl text-xs px-3 py-2 text-[#2D2D24] focus:outline-none focus:border-[#464E3D]"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-[#867E65] mb-1">رمز الأمان (CVV):</label>
                                <input
                                  id="online-card-cvv"
                                  type="password"
                                  required
                                  maxLength={3}
                                  placeholder="***"
                                  value={cvv}
                                  onChange={(e) => setCvv(e.target.value)}
                                  className="w-full bg-[#FAF8F5] border border-[#E7E5DB] rounded-xl text-xs px-3 py-2 text-[#2D2D24] focus:outline-none focus:border-[#464E3D]"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {/* File Upload screenshot section (For Vodafone, InstaPay, Bank) */}
                        {selectedMethod !== 'online' && selectedMethod !== 'cash' && (
                          <div className="border-t border-[#E7E5DB] pt-3 space-y-2">
                            <label className="block text-[10px] font-extrabold text-[#464E3D] mb-1 flex items-center gap-1">
                              <Image className="w-3.5 h-3.5 text-[#867E65]" />
                              <span>إرفاق إثبات الدفع / لقطة الشاشة (مطلوب):</span>
                            </label>

                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                              {/* File picker dropzone */}
                              <div className="flex-1 border-2 border-dashed border-[#C5BCA0] rounded-2xl p-3 bg-[#FAF8F5] hover:bg-[#FAF8F5]/80 transition-colors flex flex-col items-center justify-center relative cursor-pointer group">
                                <input
                                  id="proof-file-picker"
                                  type="file"
                                  accept="image/*"
                                  onChange={handleFileChange}
                                  className="absolute inset-0 opacity-0 cursor-pointer"
                                />
                                <Upload className="w-5 h-5 text-[#867E65] mb-1 group-hover:scale-110 transition-transform" />
                                <span className="text-[10px] text-[#2D2D24] font-bold">اضغط هنا أو اسحب إيصال الدفع</span>
                                <span className="text-[8px] text-[#867E65] mt-0.5">JPG, PNG أو لقطة شاشة الموبايل</span>
                              </div>

                              {/* OR easy simulation button */}
                              <div className="flex flex-col items-center justify-center p-2 border border-[#E7E5DB] bg-[#F3F0E8]/40 rounded-2xl w-full sm:w-44 text-center">
                                <span className="text-[9px] text-[#867E65] mb-1.5 font-bold">لا تملك صورة إيصال على جهازك؟</span>
                                <button
                                  id="generate-mock-receipt-btn"
                                  type="button"
                                  onClick={() => handleGenerateMockProof(parseFloat(paymentAmount) || Math.round(booking.totalPrice * settings.depositRate))}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-bold py-1.5 px-3 rounded-xl transition-all w-full flex items-center justify-center gap-1 cursor-pointer"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>توليد إثبات تحويل فوري</span>
                                </button>
                              </div>
                            </div>

                            {/* Image preview of uploaded/generated proof */}
                            {proofImage && (
                              <div className="mt-2.5 p-2 bg-[#FAF8F5] border border-[#E7E5DB] rounded-2xl flex flex-col items-center">
                                <span className="text-[9px] text-emerald-800 font-bold mb-1 flex items-center gap-1">
                                  <Check className="w-3 h-3 text-emerald-700" />
                                  <span>جاهز ومقيد كإثبات سداد:</span>
                                </span>
                                <img
                                  src={proofImage}
                                  alt="إثبات الدفع"
                                  referrerPolicy="no-referrer"
                                  className="max-h-28 rounded-lg border border-[#E7E5DB] object-contain shadow-sm"
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center justify-between border-t border-[#E7E5DB] pt-3">
                        <span className="text-[10px] text-[#867E65] font-bold">
                          المبلغ الذي سيتم تقييده: <strong className="text-[#2D2D24] font-extrabold text-xs">{(parseFloat(paymentAmount) || Math.round(booking.totalPrice * settings.depositRate)).toLocaleString('ar-EG')} ج.م</strong>
                        </span>
                        
                        <div className="flex gap-2">
                          <button
                            id="pay-cancel-form-btn"
                            type="button"
                            onClick={() => setIsPaying(null)}
                            className="bg-white hover:bg-[#FAF8F5] border border-[#E7E5DB] text-[#2D2D24] text-[10px] font-bold px-3 py-2 rounded-xl transition-colors cursor-pointer"
                          >
                            تراجع وإلغاء
                          </button>
                          <button
                            id="pay-submit-form-btn"
                            type="submit"
                            disabled={selectedPayeeMissing}
                            className="bg-[#464E3D] hover:bg-[#343A2D] text-white text-[10px] font-extrabold px-4 py-2 rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>إرسال وتأكيد السداد للإدارة</span>
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

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
