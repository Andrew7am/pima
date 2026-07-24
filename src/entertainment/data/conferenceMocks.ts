// Conference seed data for the interactive conference hub (ported from the source mockData).
import { ConferenceRoom } from '../../types';

export const INITIAL_CONFERENCE_ROOMS: ConferenceRoom[] = [
  {
    id: 'room_yth2026',
    bookingId: 'booking_1',
    houseId: 'house_1',
    houseName: 'بيت مارمرقس للمؤتمرات - كينج مريوط',
    title: 'خلوة الشباب الروحية ٢٠٢٦ ⛰️',
    organizationName: 'كنيسة الشهيد مارجرجس بالزيتون',
    conferenceCode: 'YTH2026',
    qrCodeUrl: 'YTH2026',
    joiningRequirements: 'open',
    hostUserId: 'user_2', // Mina El Deep (servant role)
    joinedUserIds: ['user_1', 'user_2', 'user_3'],
    schedule: [
      { id: '1', time: '08:00 ص', title: 'القداس الإلهي ببيت المؤتمرات', location: 'كنيسة الشهيد مارجرجس والأنبا بيشوي', duration: '90 دقيقة', speaker: 'الآباء الكهنة المرافقين', info: 'يبدأ القداس في تمام الثامنة صباحاً بحضور جميع المشتركين بمظهر كنسي مهيب.', completed: false, isCurrent: false },
      { id: '2', time: '09:30 ص', title: 'وجبة الإفطار الصباحي 🍳', location: 'المطعم الرئيسي وقاعة الضيافة', duration: '45 دقيقة', speaker: 'اللجنة المنظمة', info: 'بوفيه مفتوح للمأكولات الطازجة والمشروبات الساخنة والباردة.', completed: false, isCurrent: false },
      { id: '3', time: '11:00 ص', title: 'المحاضرة الأولى: «الحياة والنمو الروحي مع المسيح» 📖', location: 'القاعة الكبرى للمحاضرات', duration: '60 دقيقة', speaker: 'القمص يوحنا نصيف', info: 'دراسة تطبيقية لآباء الكنيسة الأوائل وكيفية مواجهة التحديات المعاصرة.', completed: false, isCurrent: true },
      { id: '4', time: '12:30 م', title: 'ورش عمل ومناقشات تفاعلية 💡', location: 'الخيام الخارجية وحديقة المؤتمرات', duration: '60 دقيقة', speaker: 'خدام وميسري المجموعات', info: 'توزيع المشتركين إلى 5 مجموعات لمناقشة تحديات الخدمة والعمل الفردي.', completed: false, isCurrent: false },
      { id: '5', time: '02:00 م', title: 'وجبة الغداء والاستراحة الكبرى 🍲', location: 'المطعم الرئيسي', duration: '120 دقيقة', speaker: 'اللجنة المنظمة', info: 'وجبة متكاملة تليها فترة راحة حرة للجميع لتجديد النشاط.', completed: false, isCurrent: false }
    ],
    events: [
      { id: 'ev1', title: 'المسابقة الكتابية والطقسية الكبرى 📖', day: 'اليوم الأول', time: '04:00 م', icon: '🏆', points: 150 },
      { id: 'ev2', title: 'غرفة الألعاب الجماعية والتحديات التفاعلية ⚔️', day: 'اليوم الأول', time: '07:30 م', icon: '🎮', points: 200 },
      { id: 'ev3', title: 'سهرة الترانيم والتأملات الروحية الهادئة 🎶', day: 'اليوم الثاني', time: '09:00 م', icon: '🎻', points: 100 },
      { id: 'ev4', title: 'الرحلة الخارجية الاستكشافية لصحراء النطرون 🗺️', day: 'اليوم الثالث', time: '06:00 ص', icon: '🗺️', points: 300 }
    ],
    announcements: [
      { 
        id: 'ann1', 
        text: '⚠️ تنبيه هام: يرجى التكرم بالوصول قبل موعد انطلاق الأوتوبيسات بـ 30 دقيقة، مع ضرورة إحضار تصريح الرقم القومي وكود الحجز الرقمي الخاص بكم لتأكيد ركوب الحافلة.', 
        isPinned: true, 
        timestamp: 'منذ ساعتين', 
        isUrgent: true,
        comments: [
          { id: 'c1', author: 'أبانوب جرجس', text: 'تمام يا فندم، التجمع عند الكاتدرائية صح؟', date: 'منذ ساعة' },
          { id: 'c2', author: 'تاسوني مارينا', text: 'شكرًا جزيلاً على التنبيه، ربنا يبارك خدمتكم.', date: 'منذ ٤٥ دقيقة' }
        ]
      },
      { 
        id: 'ann2', 
        text: '📢 تعديل موقع المحاضرة الثانية: تماشياً مع كبر الأعداد وحرصاً على راحتكم، تقرر نقل المحاضرة الخاصة بقدس أبونا يوحنا من قاعة الأنشطة الصغرى إلى القاعة الرئيسية الكبرى للمؤتمرات.', 
        isPinned: false, 
        timestamp: 'منذ ٤ ساعات', 
        isUrgent: false,
        comments: []
      }
    ],
    checklist: [
      { id: 'chk1', label: '📖 الإنجيل المقدس الشخصي والأجبية', checked: true },
      { id: 'chk2', label: '👟 ملابس رياضية مريحة للمسابقات والأنشطة الرياضية', checked: false },
      { id: 'chk3', label: '🪥 أدوات النظافة الشخصية والوقاية الشخصية', checked: false },
      { id: 'chk4', label: '💊 الأدوية الشخصية الخاصة (إن وجدت)', checked: false },
      { id: 'chk5', label: '📓 دفتر تدوين الملاحظات والمحاضرات الكنسية', checked: true },
      { id: 'chk6', label: '🔋 شاحن الهاتف الذكي والباور بانك المحمول', checked: false }
    ],
    liveMode: {
      eventName: 'المحاضرة الأولى: «الحياة والنمو الروحي مع المسيح»',
      speaker: 'القمص يوحنا نصيف',
      location: 'القاعة الكبرى للمحاضرات',
      minutesLeft: 45,
      viewersCount: 150,
      isLive: true,
      chatMessages: [
        { id: 'chat1', author: 'أبونا يوحنا', text: 'أهلاً بكم يا شباب، استعدوا لبدء المحاضرة بعد قليل' },
        { id: 'chat2', author: 'مينا كمال', text: 'المكان ممتاز والصوت واضح جداً يا آباء!' },
        { id: 'chat3', author: 'مريم عادل', text: 'ربنا يتمم المؤتمر ببركة عظيمة.' }
      ]
    },
    notificationsLog: [
      { id: 'n1', title: 'باقي أسبوع على المؤتمر! 🎉', body: 'تأكد من تأكيد كود الحجز الرقمي وسداد المتبقي مع خدام الخدمة لتثبيت غرفتك المخصصة.', time: 'قبل المؤتمر بـ 7 أيام' },
      { id: 'n2', title: 'لا تنس تجهيز أغراضك الشخصية! 🧳', body: 'راجع كشف قائمة التجهيزات داخل التطبيق حتى لا تنسى الإنجيل والملابس المناسبة ومثبت الأدوية.', time: 'قبل المؤتمر بـ 24 ساعة' },
      { id: 'n3', title: 'تنبيه موعد التجمع والتحرك 🚌', body: 'موعد تجمع الحافلات في السادسة مساءً تماماً أمام مبنى الخدمات الرئيسي، يرجى التواجد المبكر.', time: 'قبل التحرك بساعتين' }
    ],
    presentationSlides: [
      {
        id: 'slide_1',
        title: 'قوانين وبروتوكول المؤتمر الروحي 📜',
        content: 'نرحب بكم في خلوة الشباب الروحية ٢٠٢٦! يرجى الالتزام بمواعيد التجمع والصلوات والقداسات، والحفاظ على الهدوء والوقار داخل قاعات المحاضرات لتعم بركة المسيح على الجميع.',
        imageUrl: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=1200&q=80'
      },
      {
        id: 'slide_2',
        title: 'أهمية حياة التسليم الروحي للشباب ⛰️',
        content: 'محاضرة مخصصة لدراسة حياة التسليم الكامل للمصلوب: "سلّم تدبير حياتك للرب واسترح بالكامل من وطأة الهموم والتفكير البشري المعيق" - القديس باسيليوس الكبير.',
        imageUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80'
      },
      {
        id: 'slide_3',
        title: 'المسابقة الكبرى وألعاب الملاعب الروحية 🏆',
        content: 'استعدوا اليوم للبحث عن الكنز الكنسي وحل الألغاز الطقسية بمشاركة كافة المجموعات! الفائزون سيحصلون على دروع تكريم ونقاط إضافية في رصيدهم الرقمي.',
        imageUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=80'
      }
    ],
    activeSlideId: 'slide_1'
  },
  {
    id: 'room_marg4587',
    houseId: 'house_2',
    houseName: 'بيت يسوع الملك - العامرية',
    title: 'مؤتمر مارجرجس لإعداد الخدام ⛪',
    organizationName: 'كنيسة مارجرجس هليوبوليس',
    conferenceCode: 'MARG4587',
    qrCodeUrl: 'MARG4587',
    joiningRequirements: 'approval_needed',
    hostUserId: 'user_3', // Tamer Monir (church admin)
    joinedUserIds: ['user_3'],
    pendingUserRequests: [
      { userId: 'user_1', userName: 'مينا الديب (مستخدم)', userEmail: 'fady@gmail.com' }
    ],
    schedule: [
      { id: '1', time: '07:30 ص', title: 'صلاة باكر الجماعية', location: 'مصلى البيت الرئيسي', duration: '30 دقيقة', speaker: 'اللجنة الروحية', info: 'نبدأ يومنا بالصلاة والطلب برفع قلوب موحدة.', completed: false, isCurrent: false },
      { id: '2', time: '09:00 ص', title: 'محاضرة "مهارات القيادة الكنسية" 💡', location: 'قاعة الأنشطة الرئيسية', duration: '75 دقيقة', speaker: 'القمص داود لمعي', info: 'كيف تكون قائداً مؤثراً وخادماً حقيقياً على صورة المسيح.', completed: false, isCurrent: true }
    ],
    events: [
      { id: 'ev1', title: 'ورشة عمل إعداد مناهج مدارس الأحد 📝', day: 'اليوم الأول', time: '11:00 ص', icon: '📚', points: 120 }
    ],
    announcements: [
      {
        id: 'ann1',
        text: '📢 نرجو من جميع الخدام المتدربين إحضار حواسيبهم الشخصية للمشاركة في ورشة العمل التقنية لإدارة قواعد بيانات الكنيسة.',
        isPinned: true,
        timestamp: 'منذ ٣ ساعات',
        isUrgent: false,
        comments: []
      }
    ],
    checklist: [
      { id: 'chk1', label: '📖 إنجيل الخادم التفاعلي والنوت بوك', checked: false },
      { id: 'chk2', label: '💻 اللابتوب الشخصي للورشة', checked: false }
    ],
    liveMode: {
      eventName: 'محاضرة "مهارات القيادة الكنسية"',
      speaker: 'القمص داود لمعي',
      location: 'قاعة الأنشطة الرئيسية',
      minutesLeft: 30,
      viewersCount: 45,
      isLive: true,
      chatMessages: [
        { id: 'chat1', author: 'مريم جرجس', text: 'المحاضرة رائعة جداً وفي الصميم!' }
      ]
    },
    notificationsLog: [
      { id: 'n1', title: 'أهلاً بكم في مؤتمر إعداد الخدام', body: 'يرجى مراجعة الجدول والتحضير لمحاضرات الغد.', time: 'الآن' }
    ],
    presentationSlides: [
      {
        id: 'slide_1',
        title: 'القيادة الكنسية ورؤية الخدمة الناجحة 💡',
        content: 'مرحباً بخدامنا الأجلاء في مؤتمر إعداد الخدام! القيادة الكنسية هي مسؤولية باذلة واتضاع روحي حقيقي مقتدين بنموذج الغسل والفوطة الذي قدمه لنا رب المجد.',
        imageUrl: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1200&q=80'
      },
      {
        id: 'slide_2',
        title: 'ورش العمل التشاركية وإعداد المناهج 📚',
        content: 'ورشة عمل اليوم تركز على مراجعة مناهج مدارس الأحد وتطوير أساليب التدريس الروحي والتفاعل مع الأطفال والشباب بمختلف فئاتهم السنية.',
        imageUrl: 'https://images.unsplash.com/photo-1513258496099-48168024addd?auto=format&fit=crop&w=1200&q=80'
      }
    ],
    activeSlideId: 'slide_1'
  },
  {
    id: 'room_ret9031',
    houseId: 'house_3',
    houseName: 'بيت الشماسة فيبي - كينج مريوط',
    title: 'خلوة روحية هادئة 🕊️',
    organizationName: 'أسرة كنيسة العذراء بالزيتون',
    conferenceCode: 'RET-9031',
    qrCodeUrl: 'RET-9031',
    joiningRequirements: 'open',
    hostUserId: 'user_2',
    joinedUserIds: ['user_2'],
    schedule: [
      { id: '1', time: '06:00 ص', title: 'صلاة السحر والتأمل الصامت 🕊️', location: 'حديقة أشجار الزيتون بالبيت', duration: '60 دقيقة', speaker: 'الآباء المرافقين', info: 'فترة صمت كامل وتأمل في كلمة الله وسط الهدوء والسكينة الصباحية.', completed: false, isCurrent: false },
      { id: '2', time: '10:00 ص', title: 'تأمل روحي: «الهدوء والسكون في حياة الصلاة»', location: 'قاعة الاجتماعات الصغرى', duration: '60 دقيقة', speaker: 'أبونا شنودة', info: 'دراسة سيكولوجية وروحية عن كيفية خلق مخدع صلاة في وسط صخب العالم.', completed: false, isCurrent: false }
    ],
    events: [
      { id: 'ev1', title: 'مشاركة الصمت والتأمل الشخصي 📖', day: 'اليوم الثاني', time: '04:00 م', icon: '📝', points: 80 }
    ],
    announcements: [
      {
        id: 'ann1',
        text: '🤫 تنبيه الهدوء: يرجى التكرم بالالتزام بالصمت الكامل في الممرات والحديقة من الساعة ١٠ مساءً وحتى ٧ صباحاً لإتاحة فرصة الخلوة والراحة للجميع.',
        isPinned: true,
        timestamp: 'أمس',
        isUrgent: true,
        comments: []
      }
    ],
    checklist: [
      { id: 'chk1', label: '📿 الأجبية وسلسلة كتب الآباء والصلوات المكتوبة', checked: true }
    ],
    liveMode: {
      eventName: 'تأمل روحي: «الهدوء والسكون في حياة الصلاة»',
      speaker: 'أبونا شنودة',
      location: 'قاعة الاجتماعات الصغرى',
      minutesLeft: 60,
      viewersCount: 20,
      isLive: false,
      chatMessages: []
    },
    notificationsLog: [
      { id: 'n1', title: 'بداية خلوتكم المباركة', body: 'تمنياتنا بصلوات مقبولة وأوقات ملؤها الهدوء والنمو الروحي.', time: 'أمس' }
    ]
  }
];
