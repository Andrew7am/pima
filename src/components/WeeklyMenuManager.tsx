import React, { useState, useEffect, useMemo } from 'react';
import { 
  Utensils, 
  ChefHat, 
  Calendar, 
  Filter, 
  AlertTriangle, 
  CheckCircle2, 
  Trash2, 
  Edit3, 
  Plus, 
  Bell, 
  BellRing, 
  Info, 
  Clock, 
  Leaf, 
  ChevronDown, 
  ChevronUp, 
  Coffee, 
  Volume2, 
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { User, RetreatHouse } from '../types';

interface WeeklyMenuManagerProps {
  currentUser: User;
  onBack?: () => void;
}

interface MealItem {
  id: string;
  dayKey: string; // 'sat' | 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri'
  type: 'breakfast' | 'lunch' | 'dinner';
  title: string;
  description: string;
  isFasting: boolean;
}

// Coptic Fasting Season type
interface FastingSeason {
  id: string;
  name: string;
  arabicName: string;
  description: string;
  duration: string;
  affectsAllDays: boolean;
  allowsFish: boolean;
}

const COPTIC_FASTING_SEASONS: FastingSeason[] = [
  {
    id: 'wed_fri',
    name: 'Wed & Fri Fast',
    arabicName: 'صوم الأربعاء والجمعة الأسبوعي',
    description: 'الصوم الأسبوعي التقليدي طوال العام، عدا فترة الخمسين المقدسة بعد عيد القيامة.',
    duration: 'طوال العام (كل أربعاء وجمعة)',
    affectsAllDays: false,
    allowsFish: false
  },
  {
    id: 'apostles',
    name: "Apostles' Fast",
    arabicName: 'صوم الرسل الأطهار',
    description: 'يبدأ من اليوم التالي لعيد العنصرة وحتى عيد الرسل (١٢ يوليو). يسمح فيه بأكل السمك.',
    duration: 'من أول يونيو حتى ١٢ يوليو ٢٠٢٦',
    affectsAllDays: true,
    allowsFish: true
  },
  {
    id: 'great_lent',
    name: 'Great Lent',
    arabicName: 'الصوم الكبير الموحد',
    description: 'أقدس أصوام الكنيسة، ينتهي بعيد القيامة المجيد. صوم انقطاعي تام ولا يسمح فيه بالسمك.',
    duration: '٥٥ يوماً (قبل عيد القيامة)',
    affectsAllDays: true,
    allowsFish: false
  },
  {
    id: 'nativity',
    name: 'Nativity Fast',
    arabicName: 'صوم الميلاد المجيد',
    description: 'يبدأ في ٢٥ نوفمبر وينتهي بعيد الميلاد (٧ يناير). يسمح فيه بالسمك عدا الأربعاء والجمعة.',
    duration: '٤٣ يوماً (قبل عيد الميلاد)',
    affectsAllDays: true,
    allowsFish: true
  },
  {
    id: 'virgin_mary',
    name: 'Virgin Mary Fast',
    arabicName: 'صوم السيدة العذراء مريم',
    description: 'صوم محبوب جداً للأقباط، يبدأ من ٧ أغسطس حتى ٢٢ أغسطس. يسمح فيه بالسمك.',
    duration: '١٥ يوماً (في أغسطس)',
    affectsAllDays: true,
    allowsFish: true
  }
];

// Seed default meals
const INITIAL_MEALS: MealItem[] = [
  // Saturday
  { id: 'm_sat_b', dayKey: 'sat', type: 'breakfast', title: 'فول بلدي بالطحينة وجبنة بيضاء بالنعناع', description: 'فول مدمس متبل بزيت الزيتون والطحينة، جبنة فيتا بالطماطم والنعناع، خيار طازج وعيش بلدي سخن.', isFasting: false },
  { id: 'm_sat_l', dayKey: 'sat', type: 'lunch', title: 'كباب حلة بقري بالبصل وأرز بالخلطة', description: 'قطع لحم بقري بلدي مطهوة ببطء مع البصل المكرمل، أرز مصري بالخلطة والشعرية، شوربة لحم بلدي دافئة وسلطة.', isFasting: false },
  { id: 'm_sat_d', dayKey: 'sat', type: 'dinner', title: 'جبنة رومي وبطاطس محمرة متبلة', description: 'أصابع بطاطس مقرمشة متبلة بالبهارات، شرائح جبنة رومي، حلاوة طحينية، وشاي بلبن دافئ.', isFasting: false },

  // Sunday
  { id: 'm_sun_b', dayKey: 'sun', type: 'breakfast', title: 'طعمية سخنة وبابا غنوج مشوي بالثوم', description: 'أقراص طعمية بالسمسم والكزبرة مقلية طازجة، باذنجان بابا غنوج متبل بالخل والليمون، شرائح طماطم ومخلل.', isFasting: false },
  { id: 'm_sun_l', dayKey: 'sun', type: 'lunch', title: 'دجاج مشوي بالبطاطس في الفرن', description: 'نصف دجاجة مشوية متبلة بالبهارات الشرقية مع صينية بطاطس بالصلصة، شوربة لسان عصفور بلدي، وأرز أبيض.', isFasting: false },
  { id: 'm_sun_d', dayKey: 'sun', type: 'dinner', title: 'جبنة قريش بالطماطم وبيص مسلوق', description: 'جبنة قريش صحية بزيت الزيتون والطماطم، بيض مسلوق، عسل أسود بالطحينة، شاي دافئ.', isFasting: false },

  // Monday
  { id: 'm_mon_b', dayKey: 'mon', type: 'breakfast', title: 'فطير مشلتت بالعسل الأسود والمربى', description: 'فطير مشلتت مورق بالزبدة البلدية، عسل أسود بالطحينة السمراء، مربى تين فاخرة، جبنة قديمة بالطماطم.', isFasting: false },
  { id: 'm_mon_l', dayKey: 'mon', type: 'lunch', title: 'مكرونة بشاميل غنية باللحم المفروم', description: 'صينية مكرونة بالبشاميل الذهبية محشوة باللحم المفروم المتبل، كفتة مشوية على الفحم وسلطة خضراء منعشة.', isFasting: false },
  { id: 'm_mon_d', dayKey: 'mon', type: 'dinner', title: 'بيض مقلي بالبسطرمة والزبدة البلدية', description: 'بيض مقلي طازج بالبسطرمة الإسكندراني، جبنة فيتا بيضاء، بطاطس شيبسي مقرمشة بيتي، عيش بلدي.', isFasting: false },

  // Tuesday
  { id: 'm_tue_b', dayKey: 'tue', type: 'breakfast', title: 'شكشوكة بالبيض والطماطم والفلفل الألوان', description: 'بيض مخفوق مع الطماطم والفلفل الرومي الألوان والبصل والبهارات، جبنة نستو، شاي بلبن.', isFasting: false },
  { id: 'm_tue_l', dayKey: 'tue', type: 'lunch', title: 'صينية سمك بلطي مشوي بالردة مع أرز صيادية', description: 'سمك بلطي طازج متبل بالثوم والليمون ومشوي بالردة، أرز صيادية بالبصل البني، سلطة طحينة وسلطة خضراء.', isFasting: true },
  { id: 'm_tue_d', dayKey: 'tue', type: 'dinner', title: 'تونة قطع بالليمون والكمون والتوست الساخن', description: 'تونة قطع فاخرة مصفاة من الزيت ومتبلة بالليمون والكمون والخل، شرائح فلفل ألوان وخيار طازج وتوست دافئ.', isFasting: true },

  // Wednesday (Fasting)
  { id: 'm_wed_b', dayKey: 'wed', type: 'breakfast', title: 'فول بالخلطة الإسكندراني وجرجير طازج', description: 'فول مدمس صيامي بالخلطة الاسكندراني (طماطم وفلفل وبصل وثوم)، باذنجان مخلل بالليمون، جرجير طازج.', isFasting: true },
  { id: 'm_wed_l', dayKey: 'wed', type: 'lunch', title: 'كشري مصري أصيل بالدقة والصلصة الحارة', description: 'أرز بالعدس بجبة والمكرونة وحمص الشام، مغطى بالبصل المقرمش (الورد)، دقة الثوم والخل والليمون، صلصة طماطم غنية.', isFasting: true },
  { id: 'm_wed_d', dayKey: 'wed', type: 'dinner', title: 'مسقعة صيامي بالباذنجان الرومي والفلفل الحار', description: 'شرائح باذنجان وفلفل رومي وحار مطهوة في الفرن بصلصة الطماطم المسبكة بالثوم والخل، بطاطس شيبسي بيتي وعيش.', isFasting: true },

  // Thursday
  { id: 'm_thu_b', dayKey: 'thu', type: 'breakfast', title: 'فول نابت بالليمون والكمون الساخن', description: 'فول نابت مسلوق في شوربة الكمون والليمون المنعشة، طعمية صيامي مقرمشة، بابا غنوج بيتي بالجرجير.', isFasting: false },
  { id: 'm_thu_l', dayKey: 'thu', type: 'lunch', title: 'بامية بقطع لحم الضأن وأرز بالشعرية', description: 'طاجن بامية بلدي بقطع لحم الضأن المطهوة بعناية، أرز مصري مفلفل بالشعرية، باذنجان مخلل بالثوم والخل.', isFasting: false },
  { id: 'm_thu_d', dayKey: 'thu', type: 'dinner', title: 'عجة بيض بالخضرة والبقدونس وشاي دافئ', description: 'عجة بيض مخفوقة بالبقدونس والكزبرة والبصل ومخبوزة بالفرن، جبنة خفيفة الملح وحلاوة طحينية مع الشاي.', isFasting: false },

  // Friday (Fasting)
  { id: 'm_fri_b', dayKey: 'fri', type: 'breakfast', title: 'طعمية سخنة بالسمسم وفول بالزيت الحار', description: 'طعمية بيتي مقلية طازجة بالسمسم، فول مدمس بالزيت الحار والليمون والكمون، سلطة خضراء بالجرجير.', isFasting: true },
  { id: 'm_fri_l', dayKey: 'fri', type: 'lunch', title: 'تورلي خضار صيامي بالفرن مع أرز بالشعرية', description: 'تشكيلة خضار طازج (كوسة، جزر، بطاطس، فاصوليا خضراء، بسلة) مطهوة بصلصة الطماطم البيتي، أرز صيامي بالشعرية.', isFasting: true },
  { id: 'm_fri_d', dayKey: 'fri', type: 'dinner', title: 'تونة قطع بالبصل والليمون والخل والخيار', description: 'تونة فاخرة بالبصل المفروم والفلفل الألوان مع عصير الليمون والكمون وزيت الزيتون، تقدم مع خيار وعيش بلدي.', isFasting: true }
];

// Predefined delicious suggestions for Coptic foods (helpful for adding/editing fast meals)
const FASTING_MEAL_SUGGESTIONS = [
  { title: 'كشري مصري أصيل', desc: 'أرز، عدس بجبة، مكرونة، حمص الشام، بصل مقرمش، دقة وثوم وصاصة.' },
  { title: 'طاجن تورلي خضار صيامي بالفرن', desc: 'كوسة، جزر، بطاطس، فاصوليا وبسلة مطهوة في الفرن بصلصة الطماطم.' },
  { title: 'مسقعة صيامي بالخل والثوم', desc: 'شرائح باذنجان مقلي وفلفل رومي وحامي مسبك بصلصة الثوم والخل.' },
  { title: 'شوربة عدس بالخضار والخبز المحمص', desc: 'عدس أصفر مطهو ومهروس مع الجزر والبطاطس والبصل والمتبل بالكمون والليمون.' },
  { title: 'فول بالخلطة الإسكندراني وطعمية طازجة', desc: 'فول مدمس بالطماطم والفلفل الحامي مع طعمية سخنة مقلية بالسمسم.' },
  { title: 'سمك بلطي مشوي وأرز صيادية بالبصل البني', desc: 'سمك بلطي متبل بالثوم والليمون والخل، أرز صيادية بني مكرمل وسلطة.' },
  { title: 'مكرونة قلم بالصلصة الحمراء الحارة وخضار سوتيه', desc: 'مكرونة بصلصة الطماطم الغنية مع تشكيلة خضار مطهو على البخار.' },
  { title: 'بطاطس بوريه بالثوم والبقدونس وزيت الزيتون', desc: 'بطاطس مهروسة ناعمة متبلة بالثوم المفروم والبقدونس الطازج وزيت الزيتون الدافئ.' }
];

const REGULAR_MEAL_SUGGESTIONS = [
  { title: 'دجاج مشوي بالبطاطس في الفرن', desc: 'نصف دجاجة متبلة ومحمرة بالفرن مع صينية بطاطس مسبكة وأرز أبيض.' },
  { title: 'كباب حلة بقري بالبصل المكرمل', desc: 'لحم بقري بلدي مطهو ببطء في عصارته مع البصل المكرمل والبهارات السبع.' },
  { title: 'مكرونة بشاميل غنية باللحم المفروم والجبن', desc: 'مكرونة مخبوزة بصلصة البشاميل الذهبية واللحم المفروم والجبنة الموتزاريلا.' },
  { title: 'فتة لحم بلدي بالخل والثوم والشوربة الدسمة', desc: 'أرز أبيض وخبز بلدي محمص بالثوم والخل، مغطى بقطع لحم الضأن أو البقر المسلوق.' },
  { title: 'شكشوكة بيض بالزبدة والجبنة الرومي والمخلل', desc: 'شكشوكة بيض كلاسيكية بالخضروات مع شرائح جبنة ومخللات بلدي مشكلة.' }
];

const DAYS_OF_WEEK = [
  { key: 'sat', name: 'السبت', date: '٢٧ يونيو', englishName: 'Saturday' },
  { key: 'sun', name: 'الأحد', date: '٢٨ يونيو', englishName: 'Sunday' },
  { key: 'mon', name: 'الإثنين', date: '٢٩ يونيو', englishName: 'Monday' },
  { key: 'tue', name: 'الثلاثاء', date: '٣٠ يونيو', englishName: 'Tuesday' },
  { key: 'wed', name: 'الأربعاء', date: '١ يوليو', englishName: 'Wednesday' },
  { key: 'thu', name: 'الخميس', date: '٢ يوليو', englishName: 'Thursday' },
  { key: 'fri', name: 'الجمعة', date: '٣ يوليو', englishName: 'Friday' }
];

export default function WeeklyMenuManager({ currentUser, onBack }: WeeklyMenuManagerProps) {
  // Check if admin or owner
  const isAdminOrOwner = currentUser.role === 'admin' || currentUser.role === 'owner';

  // --- States ---
  const [meals, setMeals] = useState<MealItem[]>(() => {
    const saved = localStorage.getItem('coptic_weekly_meals');
    return saved ? JSON.parse(saved) : INITIAL_MEALS;
  });

  const [selectedSeason, setSelectedSeason] = useState<string>(() => {
    return localStorage.getItem('coptic_active_fasting_season') || 'wed_fri';
  });

  const [activeFilter, setActiveFilter] = useState<'all' | 'fasting' | 'regular'>('all');
  const [editingMeal, setEditingMeal] = useState<MealItem | null>(null);
  
  // Modal / Form States
  const [formDay, setFormDay] = useState<string>('sat');
  const [formType, setFormType] = useState<'breakfast' | 'lunch' | 'dinner'>('breakfast');
  const [formTitle, setFormTitle] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formIsFasting, setFormIsFasting] = useState<boolean>(false);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  
  // Custom week start date
  const [selectedWeekStart, setSelectedWeekStart] = useState<string>('٢٧ يونيو - ٣ يوليو ٢٠٢٦');

  // Notifications state
  const [notifications, setNotifications] = useState<{ id: string; title: string; time: string; type: 'info' | 'alert' }[]>(() => {
    return [
      { id: '1', title: 'تم تحديث قائمة الطعام الأسبوعية بواسطة إدارة بيت المؤتمرات.', time: 'منذ ١٠ دقائق', type: 'info' },
      { id: '2', title: 'تنبيه صوم الرسل: اليوم صوم انقطاعي صيامي 🌿 يرجى اختيار وجبات خالية من الألبان واللحوم.', time: 'منذ ساعتين', type: 'alert' }
    ];
  });
  
  const [isSubscribed, setIsSubscribed] = useState<boolean>(() => {
    return localStorage.getItem('coptic_meal_subscribed') === 'true';
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // --- Sync storage ---
  useEffect(() => {
    localStorage.setItem('coptic_weekly_meals', JSON.stringify(meals));
  }, [meals]);

  useEffect(() => {
    localStorage.setItem('coptic_active_fasting_season', selectedSeason);
  }, [selectedSeason]);

  // Show Toast helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // --- Fasting awareness calculations ---
  const activeSeasonDetails = useMemo(() => {
    return COPTIC_FASTING_SEASONS.find(s => s.id === selectedSeason) || COPTIC_FASTING_SEASONS[0];
  }, [selectedSeason]);

  // Determine if a specific day key is a fasting day under the active season
  const isDayFasting = (dayKey: string) => {
    // Under full seasons (Apostles, Great Lent, Virgin Mary, Nativity), all days are fasting
    if (activeSeasonDetails.affectsAllDays) {
      return true;
    }
    // Otherwise, Wednesdays and Fridays are always fasting
    return dayKey === 'wed' || dayKey === 'fri';
  };

  // Filtered days list based on activeFilter
  const filteredDays = useMemo(() => {
    return DAYS_OF_WEEK.filter(day => {
      const fasting = isDayFasting(day.key);
      if (activeFilter === 'fasting') return fasting;
      if (activeFilter === 'regular') return !fasting;
      return true;
    });
  }, [activeFilter, selectedSeason]);

  // --- Meal Notification Simulation ---
  const handleToggleSubscription = () => {
    const nextState = !isSubscribed;
    setIsSubscribed(nextState);
    localStorage.setItem('coptic_meal_subscribed', nextState ? 'true' : 'false');
    showToast(nextState ? 'تم تفعيل إشعارات وجباتك القادمة بنجاح! 🔔' : 'تم إيقاف إشعارات الوجبات.');
  };

  const handleBroadcastNotification = (dayName: string, mealType: 'breakfast' | 'lunch' | 'dinner', mealTitle: string) => {
    const typeAr = mealType === 'breakfast' ? 'الإفطار' : mealType === 'lunch' ? 'الغداء' : 'العشاء';
    const newNotif = {
      id: Date.now().toString(),
      title: `تذكير بالوجبة: حان موعد وجبة ${typeAr} (${mealTitle}) في مطعم بيت المؤتمرات!`,
      time: 'الآن',
      type: 'info' as const
    };
    setNotifications(prev => [newNotif, ...prev]);
    showToast(`تم إرسال تذكير بوجبة ${typeAr} إلى جميع المشاركين! 📢`);
  };

  // --- Meal Actions ---
  const handleEditClick = (meal: MealItem) => {
    setEditingMeal(meal);
    setFormDay(meal.dayKey);
    setFormType(meal.type);
    setFormTitle(meal.title);
    setFormDescription(meal.description);
    setFormIsFasting(meal.isFasting);
    setShowAddModal(true);
  };

  const handleDeleteMeal = (mealId: string) => {
    if (window.confirm('هل أنت متأكد من رغبتك في حذف هذه الوجبة؟')) {
      setMeals(prev => prev.filter(m => m.id !== mealId));
      showToast('تم حذف الوجبة بنجاح من المنيو.');
    }
  };

  const handleAddNewClick = () => {
    setEditingMeal(null);
    setFormDay('sat');
    setFormType('breakfast');
    setFormTitle('');
    setFormDescription('');
    // Automatically pre-set fasting checkbox if the selected day is a fasting day!
    setFormIsFasting(isDayFasting('sat'));
    setShowAddModal(true);
  };

  // Update fasting state automatically if day changes in form
  const handleFormDayChange = (day: string) => {
    setFormDay(day);
    setFormIsFasting(isDayFasting(day));
  };

  // Save changes
  const handleSaveMeal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      alert('يرجى إدخال اسم الوجبة!');
      return;
    }

    if (editingMeal) {
      // Update existing
      setMeals(prev => prev.map(m => m.id === editingMeal.id ? {
        ...m,
        dayKey: formDay,
        type: formType,
        title: formTitle,
        description: formDescription,
        isFasting: formIsFasting
      } : m));
      showToast('تم تحديث الوجبة بنجاح!');
    } else {
      // Create new
      const newMeal: MealItem = {
        id: 'meal_' + Date.now(),
        dayKey: formDay,
        type: formType,
        title: formTitle,
        description: formDescription,
        isFasting: formIsFasting
      };
      setMeals(prev => [...prev, newMeal]);
      showToast('تم إضافة الوجبة الجديدة للمنيو الأسبوعي!');
    }

    setShowAddModal(false);
    setEditingMeal(null);
  };

  // Populate form with suggestion
  const applySuggestion = (s: { title: string; desc: string }, isFastingMeal: boolean) => {
    setFormTitle(s.title);
    setFormDescription(s.desc);
    setFormIsFasting(isFastingMeal);
  };

  // Auto-generate optimal default schedule if user wants to reset
  const handleResetToDefaults = () => {
    if (window.confirm('هل تود إعادة تعيين المنيو للوجبات النموذجية الافتراضية؟')) {
      setMeals(INITIAL_MEALS);
      showToast('تمت إعادة تعيين المنيو للوجبات الافتراضية بنجاح!');
    }
  };

  // Form Warning helper
  const formFastingConflictWarning = !formIsFasting && isDayFasting(formDay);

  return (
    <div className="space-y-4 text-right select-none animate-in fade-in duration-300" id="weekly-menu-manager">
      
      {/* Toast Message notification popup */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 text-white border border-[#D6D6C2]/40 text-xs py-2.5 px-4 rounded-xl shadow-xl flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Title & Header */}
      <div className="bg-[#5A5A40] text-[#F5F5F0] p-4 rounded-2xl shadow-md border-2 border-[#BCBC9D] relative overflow-hidden">
        <div className="absolute top-0 left-0 translate-x-[-15%] translate-y-[-15%] text-[100px] text-white/5 font-serif select-none pointer-events-none">
          ☦
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-[#F5F5F0]/10 rounded-xl">
              <ChefHat className="w-6 h-6 text-[#EBEBE0]" />
            </div>
            <div>
              <h2 className="text-sm font-black tracking-wide">جدول الطعام الأسبوعي القبطي</h2>
              <p className="text-[10px] text-[#EBEBE0]/80 font-medium">الأكل الصحي والمطابقة للطقس الكنسي</p>
            </div>
          </div>
          <div className="bg-[#F5F5F0]/20 text-[9px] px-2 py-0.5 rounded-md font-bold font-mono">
            ☦ COPTIC MENU
          </div>
        </div>
        
        {/* Date Selector Row */}
        <div className="mt-3 pt-3 border-t border-white/10 flex justify-between items-center text-[11px]">
          <span className="text-[#EBEBE0] font-bold">الأسبوع الحالي:</span>
          <span className="font-mono bg-[#F5F5F0]/15 px-2 py-0.5 rounded-md text-white font-bold">{selectedWeekStart}</span>
        </div>
      </div>

      {/* 1. Fasting Calendar Awareness System Widget */}
      <div className="bg-white p-3 rounded-2xl border border-[#D6D6C2] shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-[#EBEBE0] pb-2">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-[#5A5A40]" />
            <h3 className="text-xs font-bold text-[#4A4A3A]">رادار التقويم والأصوام القبطية</h3>
          </div>
          <span className="text-[10px] text-[#8A8A70] font-semibold">تعديل الموسم لتطابق ذكي</span>
        </div>

        <div className="grid grid-cols-1 gap-2.5">
          <div>
            <label className="block text-[10px] font-bold text-[#8A8A70] mb-1">اختر الصوم القبطي الفعّال حالياً:</label>
            <select
              id="coptic-season-select"
              value={selectedSeason}
              onChange={(e) => {
                setSelectedSeason(e.target.value);
                showToast(`تم تغيير موسم الصيام إلى: ${COPTIC_FASTING_SEASONS.find(s => s.id === e.target.value)?.arabicName}`);
              }}
              className="w-full bg-[#F5F5F0] border border-[#D6D6C2] text-xs rounded-xl p-2 font-semibold text-[#4A4A3A] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
            >
              {COPTIC_FASTING_SEASONS.map(season => (
                <option key={season.id} value={season.id}>{season.arabicName}</option>
              ))}
            </select>
          </div>

          <div className="bg-[#EBEBE0]/30 p-2.5 rounded-xl border border-[#D6D6C2]/50 text-[11px] space-y-1.5">
            <div className="flex items-center gap-1.5 text-[#5A5A40] font-bold">
              <Info className="w-3.5 h-3.5 flex-shrink-0" />
              <span>تفاصيل موسم {activeSeasonDetails.arabicName}:</span>
            </div>
            <p className="text-[#4A4A3A] leading-relaxed text-[10px]">{activeSeasonDetails.description}</p>
            <div className="flex flex-wrap gap-2 pt-1 border-t border-[#D6D6C2]/40 text-[9px] font-bold">
              <span className="bg-white px-2 py-0.5 rounded-md border text-[#4A4A3A]">
                نطاق الصوم: <span className="text-[#5A5A40]">{activeSeasonDetails.duration}</span>
              </span>
              <span className={`px-2 py-0.5 rounded-md border ${activeSeasonDetails.allowsFish ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'}`}>
                {activeSeasonDetails.allowsFish ? '🌿 يُسمح بالأسماك (عدا الأربعاء والجمعة)' : '🚫 غير مسموح بالأسماك قط'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Real-Time/In-App Notifications Centre & Subscriber Widget */}
      <div className="bg-[#F5F5F0] p-3 rounded-2xl border border-[#D6D6C2] shadow-sm space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {isSubscribed ? (
              <BellRing className="w-4 h-4 text-emerald-700 animate-swing" />
            ) : (
              <Bell className="w-4 h-4 text-[#8A8A70]" />
            )}
            <h3 className="text-xs font-bold text-[#4A4A3A]">تنبيهات ومواعيد الوجبات اليومية</h3>
          </div>
          <button
            id="btn-toggle-sub"
            onClick={handleToggleSubscription}
            className={`text-[9px] font-extrabold px-2 py-1 rounded-xl transition-all border cursor-pointer ${
              isSubscribed 
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                : 'bg-white text-[#5A5A40] border-[#BCBC9D] hover:bg-[#EBEBE0]/30'
            }`}
          >
            {isSubscribed ? '🔕 إلغاء الاشتراك' : '🔔 اشتراك بالتنبيهات'}
          </button>
        </div>

        {/* Current Upcoming Meal Alerter Box */}
        <div className="bg-white p-2.5 rounded-xl border border-[#D6D6C2]/70 flex items-start gap-2.5">
          <div className="p-2 bg-amber-50 rounded-lg text-amber-800 border border-amber-200 flex-shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div className="flex-1 text-[11px] space-y-0.5">
            <div className="flex items-center gap-1 justify-between">
              <span className="font-extrabold text-[#4A4A3A]">الوجبة القادمة المقترحة: الغداء</span>
              <span className="bg-amber-100 text-amber-900 text-[8px] font-black px-1.5 py-0.5 rounded">الساعة ٢:٠٠ م</span>
            </div>
            <p className="text-[#8A8A70] text-[10px]">
              {meals.find(m => m.dayKey === 'sun' && m.type === 'lunch')?.title || 'لم يتم العثور على وجبة للغداء اليوم'}
            </p>
            <div className="text-[9px] text-[#5A5A40] font-bold flex items-center gap-1 pt-1">
              <Leaf className="w-3 h-3 text-emerald-600" />
              <span>معدّل طقس صيام الرسل: وجبة فطارية لليوم الأحد (يُسمح بالفطاري للضيوف والمسافرين).</span>
            </div>
          </div>
        </div>

        {/* List of Recent Notifications (Collapse-style preview) */}
        <div className="space-y-1.5 text-[10px]">
          <div className="text-[9px] text-[#8A8A70] font-bold px-1">سجل التنبيهات الأخيرة:</div>
          {notifications.slice(0, 2).map((notif) => (
            <div 
              key={notif.id} 
              className={`p-1.5 rounded-lg border flex items-start gap-1.5 ${
                notif.type === 'alert' 
                  ? 'bg-red-50/50 border-red-100 text-[#4A4A3A]' 
                  : 'bg-white border-[#D6D6C2]/40 text-[#4A4A3A]'
              }`}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-[#5A5A40] mt-1.5 flex-shrink-0" />
              <div className="flex-1 leading-relaxed">
                <span className="font-semibold">{notif.title}</span>
                <span className="text-[#8A8A70] text-[8px] font-mono mr-1.5">({notif.time})</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Filter Options & Admin Actions Header */}
      <div className="bg-white p-3 rounded-2xl border border-[#D6D6C2] shadow-sm flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#EBEBE0] pb-2">
          <div>
            <h3 className="text-xs font-bold text-[#4A4A3A]">قائمة الطعام الأسبوعية واليومية</h3>
            <p className="text-[9px] text-[#8A8A70]">تصفح الوجبات حسب نوع اليوم (صيامي أو فطاري)</p>
          </div>

          {/* Admin Create/Reset Action */}
          {isAdminOrOwner && (
            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              <button
                id="btn-reset-meals"
                onClick={handleResetToDefaults}
                className="text-[9px] font-bold text-[#8A8A70] hover:text-[#4A4A3A] px-2 py-1 rounded-lg border border-[#D6D6C2]/60 hover:bg-[#EBEBE0]/30 transition-all flex items-center gap-1 cursor-pointer"
                title="إعادة ضبط المنيو الأسبوعي"
              >
                <RefreshCw className="w-3 h-3" />
                <span>افتراضي</span>
              </button>
              <button
                id="btn-add-meal-trigger"
                onClick={handleAddNewClick}
                className="bg-[#5A5A40] text-white text-[9px] font-black px-3 py-1.5 rounded-xl hover:bg-[#4A4A3A] transition-all flex items-center gap-1 cursor-pointer shadow-sm border border-[#BCBC9D]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة وجبة للمنيو</span>
              </button>
            </div>
          )}
        </div>

        {/* Filters Selectors Row */}
        <div className="flex items-center justify-between gap-1.5 bg-[#F5F5F0] p-1 rounded-xl border border-[#D6D6C2]/60">
          <button
            id="filter-all-btn"
            onClick={() => setActiveFilter('all')}
            className={`flex-1 text-center py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
              activeFilter === 'all' 
                ? 'bg-white text-[#5A5A40] shadow-sm font-black' 
                : 'text-[#8A8A70] hover:text-[#4A4A3A]'
            }`}
          >
            كل الأسبوع
          </button>
          <button
            id="filter-fasting-btn"
            onClick={() => setActiveFilter('fasting')}
            className={`flex-1 text-center py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
              activeFilter === 'fasting' 
                ? 'bg-emerald-50 text-emerald-800 shadow-sm font-black border border-emerald-100' 
                : 'text-[#8A8A70] hover:text-[#4A4A3A]'
            }`}
          >
            <Leaf className="w-3 h-3" />
            <span>الأيام الصيامي فقط</span>
          </button>
          <button
            id="filter-regular-btn"
            onClick={() => setActiveFilter('regular')}
            className={`flex-1 text-center py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
              activeFilter === 'regular' 
                ? 'bg-amber-50 text-amber-800 shadow-sm font-black border border-amber-100' 
                : 'text-[#8A8A70] hover:text-[#4A4A3A]'
            }`}
          >
            <Coffee className="w-3 h-3" />
            <span>الأيام الفطاري فقط</span>
          </button>
        </div>
      </div>

      {/* 4. Weekly Meals Grid Saturday - Friday */}
      <div className="space-y-3">
        {filteredDays.length === 0 ? (
          <div className="bg-white p-8 text-center rounded-2xl border border-[#D6D6C2] text-xs text-[#8A8A70]">
            لا توجد أيام مطابقة للفلتر المحدد في هذا الموسم الصيامى.
          </div>
        ) : (
          filteredDays.map((day) => {
            const isFastingDay = isDayFasting(day.key);
            
            // Get meals for this day
            const dayMeals = meals.filter(m => m.dayKey === day.key);
            const breakfast = dayMeals.find(m => m.type === 'breakfast');
            const lunch = dayMeals.find(m => m.type === 'lunch');
            const dinner = dayMeals.find(m => m.type === 'dinner');

            return (
              <div 
                key={day.key} 
                className={`bg-white rounded-2xl border transition-all duration-300 shadow-sm hover:shadow-md ${
                  isFastingDay 
                    ? 'border-emerald-200/80 bg-gradient-to-l from-emerald-50/10 to-white' 
                    : 'border-[#D6D6C2]'
                }`}
                id={`day-card-${day.key}`}
              >
                {/* Day Header */}
                <div className={`px-4 py-2.5 rounded-t-2xl flex items-center justify-between border-b ${
                  isFastingDay 
                    ? 'bg-emerald-50/60 border-emerald-100 text-emerald-950' 
                    : 'bg-[#EBEBE0]/40 border-[#D6D6C2]/60 text-[#4A4A3A]'
                }`}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black">{day.name}</span>
                    <span className="text-[10px] text-[#8A8A70] font-mono">{day.date}</span>
                  </div>

                  {/* Fasting Day Status Indicator Badge */}
                  <div className="flex items-center gap-1.5">
                    {isFastingDay ? (
                      <span className="bg-emerald-100 text-emerald-950 text-[9px] font-bold px-2 py-0.5 rounded-lg border border-emerald-200 flex items-center gap-0.5">
                        <Leaf className="w-2.5 h-2.5" />
                        <span>يوم صوم صيامي 🌿</span>
                      </span>
                    ) : (
                      <span className="bg-amber-100 text-amber-950 text-[9px] font-bold px-2 py-0.5 rounded-lg border border-amber-200 flex items-center gap-0.5">
                        <Coffee className="w-2.5 h-2.5" />
                        <span>يوم عادي فطاري 🍖</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Day Meals Container */}
                <div className="p-3.5 space-y-3">
                  {/* BREAKFAST (الإفطار) */}
                  <div className="border-b border-[#D6D6C2]/40 pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-[#EBEBE0] text-[#5A5A40] flex items-center justify-center text-[10px] font-bold">
                          ص
                        </div>
                        <span className="text-[11px] font-extrabold text-[#4A4A3A]">الإفطار (٨:٠٠ ص)</span>
                        {breakfast && (
                          <span className={`text-[8px] px-1.5 py-0.2 rounded font-bold ${breakfast.isFasting ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'}`}>
                            {breakfast.isFasting ? 'صيامي' : 'فطاري'}
                          </span>
                        )}
                      </div>

                      {/* Admin Controls */}
                      {isAdminOrOwner && breakfast && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleBroadcastNotification(day.name, 'breakfast', breakfast.title)}
                            className="p-1 hover:bg-slate-100 text-slate-500 rounded transition-all cursor-pointer"
                            title="إرسال إشعار تذكير"
                          >
                            <Bell className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleEditClick(breakfast)}
                            className="p-1 hover:bg-[#EBEBE0]/40 text-[#5A5A40] rounded transition-all cursor-pointer"
                            title="تعديل وجبة الإفطار"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteMeal(breakfast.id)}
                            className="p-1 hover:bg-rose-50 text-rose-700 rounded transition-all cursor-pointer"
                            title="حذف وجبة الإفطار"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                    {breakfast ? (
                      <div className="mr-6 space-y-0.5">
                        <div className="text-xs font-bold text-[#4A4A3A]">{breakfast.title}</div>
                        <p className="text-[10px] text-[#8A8A70] leading-relaxed font-medium">{breakfast.description}</p>
                      </div>
                    ) : (
                      <div className="mr-6 text-[10px] text-[#8A8A70] italic flex items-center justify-between">
                        <span>لم يتم تحديد وجبة الإفطار بعد.</span>
                        {isAdminOrOwner && (
                          <button
                            onClick={() => {
                              handleAddNewClick();
                              setFormDay(day.key);
                              setFormType('breakfast');
                              setFormIsFasting(isFastingDay);
                            }}
                            className="text-[9px] font-bold text-[#5A5A40] hover:underline cursor-pointer"
                          >
                            + إضافة إفطار
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* LUNCH (الغداء) */}
                  <div className="border-b border-[#D6D6C2]/40 pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-[#EBEBE0] text-[#5A5A40] flex items-center justify-center text-[10px] font-bold">
                          ظ
                        </div>
                        <span className="text-[11px] font-extrabold text-[#4A4A3A]">الغداء (٢:٠٠ م)</span>
                        {lunch && (
                          <span className={`text-[8px] px-1.5 py-0.2 rounded font-bold ${lunch.isFasting ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'}`}>
                            {lunch.isFasting ? 'صيامي' : 'فطاري'}
                          </span>
                        )}
                      </div>

                      {/* Admin Controls */}
                      {isAdminOrOwner && lunch && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleBroadcastNotification(day.name, 'lunch', lunch.title)}
                            className="p-1 hover:bg-slate-100 text-slate-500 rounded transition-all cursor-pointer"
                            title="إرسال إشعار تذكير"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleEditClick(lunch)}
                            className="p-1 hover:bg-[#EBEBE0]/40 text-[#5A5A40] rounded transition-all cursor-pointer"
                            title="تعديل وجبة الغداء"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteMeal(lunch.id)}
                            className="p-1 hover:bg-rose-50 text-rose-700 rounded transition-all cursor-pointer"
                            title="حذف وجبة الغداء"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                    {lunch ? (
                      <div className="mr-6 space-y-0.5">
                        <div className="text-xs font-bold text-[#4A4A3A]">{lunch.title}</div>
                        <p className="text-[10px] text-[#8A8A70] leading-relaxed font-medium">{lunch.description}</p>
                      </div>
                    ) : (
                      <div className="mr-6 text-[10px] text-[#8A8A70] italic flex items-center justify-between">
                        <span>لم يتم تحديد وجبة الغداء بعد.</span>
                        {isAdminOrOwner && (
                          <button
                            onClick={() => {
                              handleAddNewClick();
                              setFormDay(day.key);
                              setFormType('lunch');
                              setFormIsFasting(isFastingDay);
                            }}
                            className="text-[9px] font-bold text-[#5A5A40] hover:underline cursor-pointer"
                          >
                            + إضافة غداء
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* DINNER (العشاء) */}
                  <div className="last:border-0 last:pb-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-[#EBEBE0] text-[#5A5A40] flex items-center justify-center text-[10px] font-bold">
                          م
                        </div>
                        <span className="text-[11px] font-extrabold text-[#4A4A3A]">العشاء (٨:٠٠ م)</span>
                        {dinner && (
                          <span className={`text-[8px] px-1.5 py-0.2 rounded font-bold ${dinner.isFasting ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'}`}>
                            {dinner.isFasting ? 'صيامي' : 'فطاري'}
                          </span>
                        )}
                      </div>

                      {/* Admin Controls */}
                      {isAdminOrOwner && dinner && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleBroadcastNotification(day.name, 'dinner', dinner.title)}
                            className="p-1 hover:bg-slate-100 text-slate-500 rounded transition-all cursor-pointer"
                            title="إرسال إشعار تذكير"
                          >
                            <Bell className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleEditClick(dinner)}
                            className="p-1 hover:bg-[#EBEBE0]/40 text-[#5A5A40] rounded transition-all cursor-pointer"
                            title="تعديل وجبة العشاء"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteMeal(dinner.id)}
                            className="p-1 hover:bg-rose-50 text-rose-700 rounded transition-all cursor-pointer"
                            title="حذف وجبة العشاء"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                    {dinner ? (
                      <div className="mr-6 space-y-0.5">
                        <div className="text-xs font-bold text-[#4A4A3A]">{dinner.title}</div>
                        <p className="text-[10px] text-[#8A8A70] leading-relaxed font-medium">{dinner.description}</p>
                      </div>
                    ) : (
                      <div className="mr-6 text-[10px] text-[#8A8A70] italic flex items-center justify-between">
                        <span>لم يتم تحديد وجبة العشاء بعد.</span>
                        {isAdminOrOwner && (
                          <button
                            onClick={() => {
                              handleAddNewClick();
                              setFormDay(day.key);
                              setFormType('dinner');
                              setFormIsFasting(isFastingDay);
                            }}
                            className="text-[9px] font-bold text-[#5A5A40] hover:underline cursor-pointer"
                          >
                            + إضافة عشاء
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 5. ADD / EDIT MEAL MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 border border-[#D6D6C2] shadow-2xl max-h-[90vh] overflow-y-auto space-y-4 text-right">
            
            {/* Modal Title */}
            <div className="flex items-center justify-between border-b border-[#EBEBE0] pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-[#5A5A40] text-[#F5F5F0] rounded-lg">
                  <ChefHat className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-black text-[#4A4A3A]">
                  {editingMeal ? 'تعديل الوجبة المحددة' : 'إضافة وجبة جديدة للمنيو'}
                </h3>
              </div>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Smart Coptic Fasting Calendar Advice in Modal */}
            {isDayFasting(formDay) ? (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-950 p-2.5 rounded-xl text-[10px] space-y-1">
                <div className="flex items-center gap-1 font-bold">
                  <Leaf className="w-3.5 h-3.5 text-emerald-700" />
                  <span>تنبيه المواءمة الطقسية الكنسية:</span>
                </div>
                <p className="leading-relaxed">
                  هذا اليوم ({DAYS_OF_WEEK.find(d => d.key === formDay)?.name}) هو يوم صوم وفقاً لـ <strong>{activeSeasonDetails.arabicName}</strong>. يرجى تفعيل خيار "الوجبة صيامي" واختيار طعام خالٍ من اللحوم والألبان.
                </p>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 text-amber-950 p-2.5 rounded-xl text-[10px] flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-amber-800" />
                <span>يوم عادي غير صومي، يمكنك اختيار وجبة فطارية أو صيامي بحرية.</span>
              </div>
            )}

            {/* Meal Form */}
            <form onSubmit={handleSaveMeal} className="space-y-3">
              {/* Day Selection */}
              <div>
                <label className="block text-[10px] font-bold text-[#8A8A70] mb-1">اليوم:</label>
                <select
                  value={formDay}
                  onChange={(e) => handleFormDayChange(e.target.value)}
                  disabled={!!editingMeal} // Cannot change day while editing existing item to keep logic clean
                  className="w-full bg-[#F5F5F0] border border-[#D6D6C2] text-xs rounded-xl p-2 font-semibold text-[#4A4A3A] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
                >
                  {DAYS_OF_WEEK.map(day => (
                    <option key={day.key} value={day.key}>{day.name} ({day.date})</option>
                  ))}
                </select>
              </div>

              {/* Meal Type Selection */}
              <div>
                <label className="block text-[10px] font-bold text-[#8A8A70] mb-1">نوع الوجبة:</label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as any)}
                  disabled={!!editingMeal}
                  className="w-full bg-[#F5F5F0] border border-[#D6D6C2] text-xs rounded-xl p-2 font-semibold text-[#4A4A3A] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
                >
                  <option value="breakfast">الإفطار</option>
                  <option value="lunch">الغداء</option>
                  <option value="dinner">العشاء</option>
                </select>
              </div>

              {/* Fasting Toggle */}
              <div className="flex items-center justify-between bg-[#F5F5F0] p-2.5 rounded-xl border border-[#D6D6C2]/60">
                <div className="flex items-center gap-1.5">
                  <Leaf className="w-4 h-4 text-emerald-700" />
                  <span className="text-[11px] font-extrabold text-[#4A4A3A]">هذه الوجبة صيامي (نباتية خالية من المشتقات)</span>
                </div>
                <input
                  type="checkbox"
                  checked={formIsFasting}
                  onChange={(e) => setFormIsFasting(e.target.checked)}
                  className="w-4 h-4 rounded text-[#5A5A40] focus:ring-[#5A5A40] border-[#D6D6C2] cursor-pointer"
                />
              </div>

              {/* Fasting Conflict Warning */}
              {formFastingConflictWarning && (
                <div className="bg-rose-50 border border-rose-200 text-rose-950 p-2.5 rounded-xl text-[10px] flex items-start gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-700 flex-shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    <strong>تنبيه مخالفة الطقس:</strong> لقد اخترت وجبة فطارية في يوم صيام كنسي قبطي! يفضل تغيير الوجبة لصيامي أو إضافة خيار بديل صيامي للنزلاء الملتزمين بالصيام.
                  </p>
                </div>
              )}

              {/* Suggestion Quick Fillers */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-[#8A8A70]">توصيات سريعة للوجبات الصيامية / الفطارية:</label>
                <div className="flex flex-wrap gap-1.5 max-h-[110px] overflow-y-auto p-1 border border-[#D6D6C2]/50 rounded-lg">
                  {formIsFasting ? (
                    FASTING_MEAL_SUGGESTIONS.map((s, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => applySuggestion(s, true)}
                        className="bg-emerald-50/70 border border-emerald-100 hover:bg-emerald-100 text-emerald-950 text-[9px] px-2 py-1 rounded-md transition-all cursor-pointer text-right font-medium"
                      >
                        ⚡ {s.title}
                      </button>
                    ))
                  ) : (
                    REGULAR_MEAL_SUGGESTIONS.map((s, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => applySuggestion(s, false)}
                        className="bg-amber-50/70 border border-amber-100 hover:bg-amber-100 text-amber-950 text-[9px] px-2 py-1 rounded-md transition-all cursor-pointer text-right font-medium"
                      >
                        ⚡ {s.title}
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Meal Title Input */}
              <div>
                <label className="block text-[10px] font-bold text-[#8A8A70] mb-1">اسم الوجبة ومكوناتها الأساسية:</label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="مثال: كشري مصري، مكرونة بالصلصة، دجاج مشوي مع صينية بطاطس"
                  className="w-full bg-[#F5F5F0] border border-[#D6D6C2] text-xs rounded-xl p-2.5 font-semibold text-[#4A4A3A] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
                />
              </div>

              {/* Meal Description Input */}
              <div>
                <label className="block text-[10px] font-bold text-[#8A8A70] mb-1">الوصف التفصيلي وطريقة التقديم:</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="أدخل الوصف التفصيلي للوجبة أو التوصيات الخاصة بالحساسية ونوع الزيت المستخدم..."
                  rows={2}
                  className="w-full bg-[#F5F5F0] border border-[#D6D6C2] text-xs rounded-xl p-2.5 font-semibold text-[#4A4A3A] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-[#5A5A40] text-white text-xs font-black py-2.5 rounded-xl hover:bg-[#4A4A3A] transition-all cursor-pointer border border-[#BCBC9D]"
                >
                  حفظ الوجبة بالجدول
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="bg-[#EBEBE0] text-[#4A4A3A] text-xs font-bold py-2.5 px-4 rounded-xl hover:bg-[#D6D6C2] transition-all cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Brand Coptic Quote / Decorative Accent */}
      <div className="bg-[#EBEBE0]/40 p-3 rounded-2xl border border-[#D6D6C2]/60 text-center text-[10px] text-[#8A8A70] font-bold">
        « طعامه من تعب يديه.. يبارك الرب عمل يديك ويبارك بيتك ومخازنك » ☦ 🌿
      </div>
    </div>
  );
}
