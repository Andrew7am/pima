import { RetreatHouse, User, Booking, Review, Payment } from './types';

export const INITIAL_USERS: User[] = [
  {
    id: 'user_1',
    email: 'fady@gmail.com',
    name: 'مينا الديب ',
    role: 'individual',
    phone: '01122334455',
    createdAt: '2026-01-15T10:00:00Z',
    points: 450,
    pointsHistory: [
      {
        id: 'pt_init_1_1',
        date: '2026-05-10T10:00:00Z',
        amount: 450,
        description: 'نقاط ترحيبية من كنيستنا دوت كوم',
        type: 'earned'
      }
    ]
  },
  {
    id: 'user_2',
    email: 'mina@servant.org',
    name: 'مينا الديب',
    role: 'servant',
    phone: '01223344556',
    organizationName: 'أسرة ثانوي كنيسة العذراء بالزيتون',
    createdAt: '2026-02-10T12:00:00Z',
    points: 1250,
    pointsHistory: [
      {
        id: 'pt_init_2_1',
        date: '2026-04-15T09:00:00Z',
        amount: 1000,
        description: 'نقاط مكتسبة من حجز بيت مارمرقس للمؤتمرات',
        type: 'earned'
      },
      {
        id: 'pt_init_2_2',
        date: '2026-05-01T14:30:00Z',
        amount: 200,
        description: 'خصم حجز بيت الشماسة فيبي',
        type: 'redeemed'
      },
      {
        id: 'pt_init_2_3',
        date: '2026-06-12T11:00:00Z',
        amount: 450,
        description: 'نقاط مكتسبة من حجز بيت مارمينا وبيت عنيا',
        type: 'earned'
      }
    ]
  },
  {
    id: 'user_3',
    email: 'church_admin@outlook.com',
    name: 'تامر منير',
    role: 'individual',
    phone: '01556677889',
    organizationName: 'كنيسة مارجرجس هليوبوليس',
    createdAt: '2026-03-01T09:00:00Z',
  },
  {
    id: 'user_owner',
    email: 'owner@church.eg',
    name: 'أ. جرجس نبيل',
    role: 'owner',
    phone: '01234567890',
    approvalStatus: 'approved',
    createdAt: '2026-01-01T08:00:00Z',
  },
  {
    id: 'user_owner_2',
    email: 'shenouda@retreat.eg',
    name: 'م. شنودة نجيب',
    role: 'owner',
    phone: '01288997766',
    approvalStatus: 'approved',
    createdAt: '2026-04-10T11:00:00Z',
  },
  {
    id: 'user_admin',
    email: 'admin@church.eg',
    name: 'أبونا ميخائيل',
    role: 'admin',
    phone: '01001122334',
    createdAt: '2026-01-01T00:00:00Z',
  }
];

export const INITIAL_HOUSES: RetreatHouse[] = [
  {
    id: 'house_1',
    name: 'بيت مارمرقس للمؤتمرات - كينج مريوط',
    description: 'من أعرق وأهدأ بيوت المؤتمرات في كينج مريوط، يتميز بمساحات خضراء شاسعة مريحة للنفس ومثالية لخلوات الخدام والمؤتمرات الكنسية الكبيرة والصغيرة. مجهز بكافة الخدمات والمرافق الحديثة ومبنى خاص للقداسات والاجتماعات.',
    ownerId: 'user_owner',
    ownerName: 'أ. جرجس نبيل',
    governorate: 'الإسكندرية',
    address: 'كينج مريوط، خلف الكافور، الإسكندرية',
    lat: 31.0183,
    lng: 29.8131,
    roomsCount: 45,
    bedsCount: 150,
    roomsDescription: 'غرف ثنائية وثلاثية مجهزة بتكييف، حمام خاص، وتليفزيون وصالون معيشة مريح.',
    pricePerNightPerPerson: 250,
    services: ['واي فاي', 'تكييف', 'مصلى / كنيسة صغيرة', 'حديقة واسعة', 'ملعب كرة قدم'],
    suitability: ['retreat', 'youth', 'families'],
    conferenceHalls: [
      { id: 'hall_1_1', name: 'قاعة مارمرقس الكبرى', capacity: 200, hasSoundSystem: true, hasProjector: true }
    ],
    restaurants: [
      { id: 'rest_1', name: 'مطعم الكرم والشركة', capacity: 150, mealsServed: ['breakfast', 'lunch', 'dinner'] }
    ],
    activities: ['رياضة وألعاب جماعية', 'أمسيات ترفيهية وروحية', 'مسابقات ثقافية'],
    images: [
      'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1445019980597-93fa8acb246c?w=800&auto=format&fit=crop&q=80'
    ],
    status: 'approved',
    rating: 4.8,
    reviewsCount: 2,
    createdAt: '2026-02-10T12:00:00Z',
    propertyType: 'conference',
    seaProximity: 'far',
    menu: {
      isIncluded: true,
      extraMealPrice: 70,
      allowsSpecialRequests: true,
      weeklyMenu: [
        { day: 'السبت', breakfast: 'فول بالزيت الحار وجبنة بيضاء بالخيار وعيش طازج', lunch: 'فراخ مشوية وأرز بسمتي وسلطة خضراء', dinner: 'بيض مسلوق وجبنة بيضاء وزبادي ومربى' },
        { day: 'الأحد', breakfast: 'طعمية سخنة وبابا غنوج وبطاطس محمرة وعيش دافئ', lunch: 'لحمة كباب حلة ومكرونة بالصلصة وشوربة خضار', dinner: 'جبنة قريش بالطماطم وزيت زيتون وعسل نحل وعيش' },
        { day: 'الاثنين', breakfast: 'بيض مسلوق بالزبدة وجبنة نستو وعسل أسود وحلاوة وعيش', lunch: 'صينية بطاطس بالفراخ في الفرن وأرز مصري بالشعرية وسلطة خضراء', dinner: 'شعرية باللبن دافئة أو شاي بلبن وبسكويت' },
        { day: 'الثلاثاء', breakfast: 'فول مدمس بالليمون والكمون وبيض أومليت وخيار وجبن', lunch: 'كفتة مشوية على الفحم وأرز بسمتي أصفر وسلطة طحينة وسلطة خضراء', dinner: 'كلوب ساندوتش تونة بالبصل والفلفل والألوان وبطاطس محمرة' },
        { day: 'الأربعاء', breakfast: 'بيض عيون وبطاطس بوريه بالزبدة وجبنة رومي ومربى وعيش', lunch: 'سمك فيليه مقلي مقرمش وأرز صيادية بني متبل وسلطة خضراء وطحينة', dinner: 'فطيرة زعتر وجبنة بيضاء ثلاجة وشاي دافئ بالنعناع' },
        { day: 'الخميس', breakfast: 'بوفيه صغير: أجبان مشكلة ولانشون وفول وعسل نحل وتوست ومربى', lunch: 'بفتيك لحم بقري محمر ومكرونة وايت صوص بالمشروم وبطاطس فارم فريتس', dinner: 'بيتزا مارجريتا أو خضار خفيفة وسلطة زيتون طازجة' },
        { day: 'الجمعة', breakfast: 'فول مدمس بالسمن البلدي وطعمية سخنة وباذنجان مخلل وجرجير وعيش بلدي', lunch: 'أرز معمر بالفراخ البلدي وملوخية مصرية دافئة وسلطات ومخلل مشكل', dinner: 'عشاء خفيف: أجبان مشكلة وقشطة وعسل بلدي وعيش بلدي سخن' }
      ],
      fastingWeeklyMenu: [
        { day: 'السبت', breakfast: 'فول مدمس بالزيت الحار، طعمية سخنة، عيش بلدي، مخللات', lunch: 'طاجن تورلي صيامي بالفرن، أرز بالشعرية، شوربة خضار كنسية سادة', dinner: 'بطاطس مسلوقة ومهروسة بزيت زيتون، بابا غنوج طازج، طماطم متبلة' },
        { day: 'الأحد', breakfast: 'بطاطس أصابع محمرة، تونة صيامي بقطع البصل والليمون والخل، جرجير وعيش بلدي', lunch: 'سمك فيليه صيامي مقلي مقرمش، أرز بني صيادية، سلطة خضراء وطحينة', dinner: 'حلاوة طحينية فاخرة، مربى فراولة بلدي، عسل أسود بالطحينة وعيش بلدي' },
        { day: 'الاثنين', breakfast: 'فول مدمس بالليمون والكمون، جبنة صيامي نباتية بالطماطم، خيار بلدي', lunch: 'كوشري مصري أصيل متكامل بالدقة والصلصة والمشروم المقلي والتقلية', dinner: 'باذنجان مقلي بالخل والثوم والبهارات، بطاطس محمرة، مخلل لفت' },
        { day: 'الثلاثاء', breakfast: 'طعمية بيتي بالسمسم، بابا غنوج، بطاطس بوريه بالزيت والكمون وعيش دافئ', lunch: 'رقاق صيامي محشو بالخضار والبسلة والمشروم، محشي كرنب وورق عنب صيامي بالزيت', dinner: 'كورن فليكس بلبن جوز الهند الطبيعي، سلطة فواكه الموسم المشكلة' },
        { day: 'الأربعاء', breakfast: 'فول مدمس بالطماطم والزيت الحار، زيتون تفاحي أسود، جرجير طازج وعيش سخن', lunch: 'مسقعة صيامي بالباذنجان الرومي والفلفل الحار والصلصة، أرز أبيض، سلطة طماطم', dinner: 'تونة قطع مصفاة من الزيت بالليمون والكمون، شرائح فلفل ألوان وخيار' },
        { day: 'الخميس', breakfast: 'قرص صيامي بالسمسم والعجوة، شاي سادة دافئ بالنعناع، مربى التين والبرتقال', lunch: 'سمك بوري مشوي بالردة، أرز صيادية بالبصل، سلطة جرجير وطحينة وبصل أخضر', dinner: 'بطاطس مسلوقة ومهروسة بالبقدونس وزيت الزيتون البكر، بابا غنوج متبل وعيش سن' },
        { day: 'الجمعة', breakfast: 'طعمية سخنة بالكزبرة، فول بالخلطة الإسكندراني الحارة، باذنجان مخلل وجرجير', lunch: 'صينية بطاطس صيامي بالفرن بالمشروم والبهارات الطازجة، أرز حبة وحبة، شوربة خضار', dinner: 'عشاء صيامي خفيف: أجبان نباتية صيامي، عسل أسود بالطحينة، خيار وطماطم وعيش بلدي' }
      ]
    }
  },
  {
    id: 'house_2',
    name: 'بيت الشماسة فيبي للخلوات - وادي النطرون',
    description: 'يقع وسط طبيعة هادئة قريبة من الأديرة الأثرية العامرة بوادي النطرون. مصمم خصيصاً لخلوات الشباب والشابات الروحية، ويوفر جواً مهيئاً للصلاة والقراءة والهدوء الداخلي بعيداً عن صخب المدن.',
    ownerId: 'user_owner',
    ownerName: 'أ. جرجس نبيل',
    governorate: 'البحيرة',
    address: 'طريق مصر إسكندرية الصحراوي، بالقرب من دير الأنبا بيشوي، وادي النطرون',
    lat: 30.3831,
    lng: 30.3458,
    roomsCount: 20,
    bedsCount: 50,
    roomsDescription: 'غرف فردية وثنائية مخصصة للهدوء والخلوات، مجهزة بمكتب خاص للقراءة وحمام نظيف.',
    pricePerNightPerPerson: 180,
    services: ['واي فاي', 'مصلى / كنيسة صغيرة', 'حديقة واسعة', 'تكييف', 'مكتبة كنسية'],
    suitability: ['retreat', 'youth'],
    conferenceHalls: [
      { id: 'hall_2_1', name: 'قاعة اللوجوس للصلاة والدرس', capacity: 60, hasSoundSystem: true, hasProjector: true }
    ],
    restaurants: [
      { id: 'rest_2', name: 'مائدة المحبة البسيطة', capacity: 60, mealsServed: ['breakfast', 'lunch', 'dinner'] }
    ],
    activities: ['قراءة وتأمل', 'جولات سير دينية للأديرة الكنسية', 'مناقشات روحية'],
    images: [
      'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1445019980597-93fa8acb246c?w=800&auto=format&fit=crop&q=80'
    ],
    status: 'approved',
    rating: 4.9,
    reviewsCount: 2,
    createdAt: '2026-02-15T14:00:00Z',
    propertyType: 'conference',
    seaProximity: 'far',
    menu: {
      isIncluded: true,
      extraMealPrice: 60,
      allowsSpecialRequests: true,
      weeklyMenu: [
        { day: 'السبت', breakfast: 'فول بالزيت وطماطم وجبنة فيتا وعيش بلدي', lunch: 'مسقعة باللحم المفروم وأرز أبيض وشوربة', dinner: 'جبنة وعسل أبيض ولبنة بالنعناع' },
        { day: 'الأحد', breakfast: 'بيض بالبسطرمة وجبنة شيدر وزيتون', lunch: 'فراخ بانيه مكرونة اسباجتي بطاطس شيبسي', dinner: 'حلاوة طحينية ومربى وجبنة نستو وشاي باللبن' },
        { day: 'الاثنين', breakfast: 'طعمية سخنة وبتنجان مقلي وعيش سخن', lunch: 'كفتة داوود باشا وأرز بالشعرية وسلطة خضراء', dinner: 'تونة بالبصل والفلفل وجبنة بيضاء' },
        { day: 'الثلاثاء', breakfast: 'بيض مسلوق وعسل نحل وجبنة قريش بالخيار', lunch: 'سمك ماكريل مشوي بالفرن أرز صيادية طحينة', dinner: 'شعرية بالسكر أو كورن فليكس باللبن' },
        { day: 'الأربعاء', breakfast: 'فول صيامي بالليمون وزيتون وخيار', lunch: 'عدس أصفر دافئ شوربة بصل مخلل عيش محمص', dinner: 'بطاطس مسلوقة ومهروسة بالزيت والكمون' },
        { day: 'الخميس', breakfast: 'شاورما فراخ خفيفة وجبنة بيضاء وشاي', lunch: 'صينية جلاش باللحمة المفرومة وفراخ مشوية بالفرن', dinner: 'عشاء خفيف أجبان مشكلة وفاكهة الموسم' },
        { day: 'الجمعة', breakfast: 'فول بالخلطة وطعمية وبطاطس محمرة وجرجير', lunch: 'لحم بقري محمر خضار سوتيه أرز أبيض ومخلل', dinner: 'زبادي بالفواكه وعسل نحل وبسكوت' }
      ],
      fastingWeeklyMenu: [
        { day: 'السبت', breakfast: 'فول بالزيت الحار وطماطم وعيش بلدي مخلل وسلطة', lunch: 'مسقعة بالباذنجان والفلفل الحلو والحار وأرز أبيض وشوربة خضار', dinner: 'أجبان صيامي نباتية وعسل أسود بالطحينة ومربى مشمش' },
        { day: 'الأحد', breakfast: 'بابا غنوج متبل وجبنة نباتي بيضاء وزيتون وخيار', lunch: 'صينية بطاطس صيامي بالفرن بالمشروم والبصل وأرز بالشعرية وجرجير', dinner: 'حلاوة طحينية ومربى توت وجبنة نباتية وشاي سادة' },
        { day: 'الاثنين', breakfast: 'طعمية بيتي سخنة وباذنجان مقلي مخلل وعيش بلدي دافئ', lunch: 'فاصوليا بيضاء بالصلصة مطبوخة بالزيت وأرز مصري بالشعرية وسلطة خضراء', dinner: 'تونة قطع بالبصل المفروم والفلفل الألوان وعصير ليمون وعيش بلدي' },
        { day: 'الثلاثاء', breakfast: 'فول مدمس بالزيت الحار وعسل أسود وجبنة نباتي بالخيار', lunch: 'سمك ماكريل مشوي بالفرن بالليمون والبهارات، أرز صيادية بني متبل', dinner: 'كورن فليكس بلبن اللوز الطبيعي أو بسكوت شاي صيامي' },
        { day: 'الأربعاء', breakfast: 'فول صيامي بالليمون والكمون وزيتون وخيار وجرجير', lunch: 'عدس أصفر دافئ بالكمون والليمون وعيش بلدي محمص وبصل مخلل', dinner: 'بطاطس مسلوقة ومهروسة بزيت الزيتون والكمون الناعم وعيش سخن' },
        { day: 'الخميس', breakfast: 'شاورما مشروم صيامي بالتوابل وجبنة صيامي نباتية وشاي بالنعناع', lunch: 'صينية جلاش صيامي بالخضار والمشروم وفراخ صيامي مشوية بالفرن (فول صويا)', dinner: 'عشاء خفيف أجبان صيامي مشكلة وفاكهة الموسم الطازجة' },
        { day: 'الجمعة', breakfast: 'فول بالخلطة الخاصة وطعمية وبطاطس محمرة متبلة وجرجير وعيش بلدي', lunch: 'كوشري مصري متكامل بالدقة والتقلية وسلطة بلدي وشرائح بطاطس مقرمشة', dinner: 'سلطة فواكه طازجة بعصير البرتقال وحلوى صيامي خفيفة' }
      ]
    }
  },
  {
    id: 'house_3',
    name: 'فندق العذراء ومارجرجس السياحي - سيدي كرير',
    description: 'فندق مسيحي هادئ مطل مباشرة على شاطئ البحر الأبيض المتوسط في سيدي كرير بالساحل الشمالي. مجهز لاستقبال مؤتمرات الأسر والشباب، ورحلات اليوم الواحد. متعة البحر مع الروح والخدمة المسيحية المتميزة.',
    ownerId: 'user_owner_2',
    ownerName: 'م. شنودة نجيب',
    governorate: 'الإسكندرية',
    address: 'سيدي كرير، الكيلو ٣٥ طريق مطروح، الإسكندرية',
    lat: 31.0028,
    lng: 29.6278,
    roomsCount: 60,
    bedsCount: 220,
    roomsDescription: 'شاليهات وغرف عائلية فاخرة مطلة على البحر والحدائق الداخلية مجهزة بالكامل.',
    pricePerNightPerPerson: 350,
    services: ['واي فاي', 'تكييف', 'حمام سباحة', 'ملعب كرة قدم', 'منطقة ألعاب أطفال', 'مصلى / كنيسة صغيرة', 'جراج خاص'],
    suitability: ['families', 'youth', 'children'],
    conferenceHalls: [
      { id: 'hall_3_1', name: 'قاعة العذراء الملكة', capacity: 250, hasSoundSystem: true, hasProjector: true },
      { id: 'hall_3_2', name: 'قاعة الأنشطة وورش العمل', capacity: 100, hasSoundSystem: true, hasProjector: false }
    ],
    restaurants: [
      { id: 'rest_3_1', name: 'مطعم السلام للوجبات البحرية والشرقية', capacity: 200, mealsServed: ['breakfast', 'lunch', 'dinner'] }
    ],
    activities: ['سباحة وألعاب مائية', 'مسرح عرائس للأطفال', 'حفلات شواء مسائية', 'كرة طائرة شاطئية'],
    images: [
      'https://images.unsplash.com/photo-1498503182468-3b51cbb6cb24?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&auto=format&fit=crop&q=80'
    ],
    status: 'approved',
    rating: 4.6,
    reviewsCount: 1,
    createdAt: '2026-03-20T10:00:00Z',
    propertyType: 'conference',
    seaProximity: 'beach',
    menu: {
      isIncluded: false,
      extraMealPrice: 100,
      allowsSpecialRequests: true,
      weeklyMenu: [
        { day: 'السبت', breakfast: 'بوفيه مفتوح: أجبان، بيض، فول، طعمية، معجنات، فواكه، وعصائر طبيعية', lunch: 'سمك بلطي أو فيليه مقلي، أرز صيادية، شوربة سي فود، وسلطات متنوعة', dinner: 'فطائر دافئة، عسل نحل، قشطة، وجبنة رومي' },
        { day: 'الأحد', breakfast: 'بوفيه مفتوح: أومليت حسب الطلب، كورن فليكس، توست ومربى وزبدة', lunch: 'كباب حلة، أرز بالخلطة والمكسرات، صينية رقاق باللحمة المفرومة', dinner: 'كلوب ساندوتش تونة مع بطاطس فارم فريتس' },
        { day: 'الاثنين', breakfast: 'بوفيه مفتوح كلاسيكي مع مخبوزات كنسية طازجة وشاي باللبن', lunch: 'فراخ بانيه مقرمشة، مكرونة بشاميل غنية، بطاطس محمرة وسلطة سيزر', dinner: 'بيتزا مارجريتا أو خضار خفيفة مع سلطة زيتون' },
        { day: 'الثلاثاء', breakfast: 'بوفيه مفتوح دافئ يحتوي على الفول بالخلطة والبيض المسلوق والأجبان', lunch: 'صينية بطاطس بالفراخ بالفرن، أرز مصري بالشعرية، شوربة لسان عصفور', dinner: 'شوربة خضار دافئة وتوست أسمر بالجبنة البيضاء' },
        { day: 'الأربعاء', breakfast: 'بوفيه صيامي متكامل: بابا غنوج، فول بالزيت، باذنجان مخلل وعيش بلدي', lunch: 'سمك بوري مشوي بالردة، أرز صيادية بني، سلطة خضراء وطحينة وبصل أخضر', dinner: 'تونة قطع بالليمون والخل ومخللات مشكلة وعيش سن' },
        { day: 'الخميس', breakfast: 'بوفيه مفتوح: كورن فليكس، زبادي بلدي، عسل أبيض ومربى المشمش وجبنة', lunch: 'شيش طاووق مشوي، أرز أصفر بسمتي، ثومية وعيش صاج وبطاطس', dinner: 'برجر عائلي مشوي وشيبسي بوم فريت ومشروب غازي' },
        { day: 'الجمعة', breakfast: 'بوفيه ريفي فاخر: فطير مشلتت، عسل، قشطة، جبنة قديمة، وفول بالزيت', lunch: 'صينية تورلي باللحم الضأن، أرز معمر فلاحي، شوربة كوارع وسلطات', dinner: 'طبق فاكهة الموسم المشكلة مع زبادي بالعسل والمكسرات' }
      ],
      fastingWeeklyMenu: [
        { day: 'السبت', breakfast: 'بوفيه صيامي مفتوح: معجنات صيامي بالزعتر والزيتون، فول مدمس، طعمية بيتي سخنة، فواكه، عصير طبيعي', lunch: 'سمك بلطي أو فيليه مشوي بالردة والخل والليمون، أرز صيادية، شوربة سي فود صيامي، وسلطات طحينة وبابا غنوج', dinner: 'مناقيش صيامي دافئة، عسل أسود بالطحينة، زيتون مخلل مشكل وجبنة نباتية صيامي بالخيار' },
        { day: 'الأحد', breakfast: 'بوفيه صيامي مفتوح: بطاطس بوم فريت، تونة صيامي متبلة، كورن فليكس بلبن جوز الهند، مربى وعسل', lunch: 'كوشري مصري ملكي غني بالدقة والصلصة والمشروم المقرمش والتقلية البصل، شوربة عدس', dinner: 'ساندوتش تونة بالليمون الحامض والمايونيز الصيامي النباتي مع رقائق بطاطس مقرمشة' },
        { day: 'الاثنين', breakfast: 'بوفيه صيامي مفتوح: مخبوزات كنسية صيامي طازجة، قرص بالعجوة، شاي بالنعناع، ومربى', lunch: 'فراخ صيامي مشوية (بديل نباتي فول الصويا)، مكرونة حمراء بالصلصة والريحان، بطاطس وكاتشب وسلطة خضراء', dinner: 'بيتزا صيامي بالخضروات والمشروم والزيتون مع جبنة موتزاريلا صيامي نباتية ممتازة' },
        { day: 'الثلاثاء', breakfast: 'بوفيه صيامي دافئ: فول بالخلطة، طعمية بالسمسم، باذنجان بالخل والثوم، وأجبان صيامي', lunch: 'صينية تورلي خضار صيامي بالفرن، أرز مصري بالشعرية، شوربة لسان عصفور صيامي بالخضار', dinner: 'شوربة خضار دافئة متكاملة، توست محمص بالجبنة البيضاء الصيامي النباتية' },
        { day: 'الأربعاء', breakfast: 'بوفيه صيامي متكامل: بابا غنوج، فول بالزيت، باذنجان مخلل وعيش بلدي سخن', lunch: 'سمك بوري مشوي بالردة، أرز صيادية بني، سلطة خضراء وطحينة وبصل أخضر', dinner: 'تونة قطع بالليمون والخل ومخللات مشكلة وعيش بلدي ساخن' },
        { day: 'الخميس', breakfast: 'بوفيه صيامي مفتوح: كورن فليكس بلبن اللوز، مربى الفراولة والبرتقال، عسل أسود وجبنة صيامي بالزعتر', lunch: 'شاورما مشروم صيامي بالثومية والبهارات، أرز أصفر بسمتي، سلطة كول سلو صيامي بالمايونيز النباتي', dinner: 'برجر نباتي صيامي مشوي بالبهارات، شيبسي بلدي دافئ ومشروب غازي' },
        { day: 'الجمعة', breakfast: 'بوفيه صيامي ريفي: فطير مشلتت صيامي بالزيت النباتي، عسل أسود بالطحينة، فول بالخلطة، وجرجير طازج', lunch: 'صينية بطاطس صيامي بالفرن بالمشروم، أرز معمر صيامي بلبن جوز الهند والزيت، ملوخية خضراء وسلطة', dinner: 'طبق فاكهة الموسم المشكلة مع حلوى الجيلي الصيامي وسلطة فواكه بالعصير' }
      ]
    }
  },
  {
    id: 'house_4',
    name: 'بيت مارمينا وبيت عنيا للخلوات - العين السخنة',
    description: 'يقع تحت جبل الجلالة الشاهق بالعين السخنة، ويطل على البحر الأحمر مباشرة. يتميز البيت بالهدوء المطلق والجو الساحر للمزج بين تأملات الجبل والبحر. مناسب جداً لخلوات المكرسين، الخدام والشباب الواعد.',
    ownerId: 'user_owner_2',
    ownerName: 'م. شنودة نجيب',
    governorate: 'السويس',
    address: 'العين السخنة، طريق الزعفرانة، السويس',
    lat: 29.5894,
    lng: 32.4172,
    roomsCount: 30,
    bedsCount: 90,
    roomsDescription: 'غرف حديثة مكيفة مواجهة للبحر، مع شرفات واسعة وغرف ثنائية مريحة جداً.',
    pricePerNightPerPerson: 320,
    services: ['تكييف', 'واي فاي', 'مصلى / كنيسة صغيرة', 'حديقة واسعة', 'ملعب كرة قدم'],
    suitability: ['retreat', 'youth', 'families'],
    conferenceHalls: [
      { id: 'hall_4_1', name: 'قاعة جبل موسى الروحية', capacity: 120, hasSoundSystem: true, hasProjector: true }
    ],
    restaurants: [
      { id: 'rest_4', name: 'مطعم المن وسلوى', capacity: 100, mealsServed: ['breakfast', 'lunch', 'dinner'] }
    ],
    activities: ['تسلق الجبال الآمن', 'تأمل شروق الشمس على الشاطئ', 'ألعاب كنسية ترفيهية'],
    images: [
      'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&auto=format&fit=crop&q=80'
    ],
    status: 'approved',
    rating: 4.7,
    reviewsCount: 1,
    createdAt: '2026-04-05T08:30:00Z',
    propertyType: 'conference',
    seaProximity: 'view',
    menu: {
      isIncluded: true,
      extraMealPrice: 85,
      allowsSpecialRequests: true,
      weeklyMenu: [
        { day: 'السبت', breakfast: 'فول بالزيت وطعمية وجبنة بيضاء بطماطم عيش', lunch: 'فراخ مشوية على الفحم أرز خلطة سلطة خضراء', dinner: 'عشاء خفيف جبن مشكلة ومربى وزبادي' },
        { day: 'الأحد', breakfast: 'بيض عيون وبطاطس مقلية وجبنة كيري توست دافئ', lunch: 'لحمة محمرة بالبصل صينية رقاق أرز أبيض شوربة', dinner: 'فطيرة مشلتت عسل أبيض وقشطة وشاي' },
        { day: 'الاثنين', breakfast: 'قرص بالعسل وشاي سادة وجبنة بيضاء ومربى', lunch: 'صينية بطاطس بالفراخ أرز مصري سلطة بلدي ومخلل', dinner: 'تونة قطع بالليمون سلطة جرجير وطماطم' },
        { day: 'الثلاثاء', breakfast: 'فول مدمس بالسمن بيض أومليت جبنة شيدر', lunch: 'سمك فيله مقلي أرز بني سلطة طحينة بصل أخضر', dinner: 'شعرية باللبن دافئ أو بسكوت الشاي' },
        { day: 'الأربعاء', breakfast: 'فول بالخلطة صيامي طعمية سخنة باذنجان مخلل وجرجير', lunch: 'كوشري مصري متميز بالتقلية والدقة عيش محمص وشيبسي', dinner: 'بطاطس بوريه بالزيت والكمون زيتون أسود ومخلل' },
        { day: 'الخميس', breakfast: 'بيض مسلوق جبنة قريش بالخيار وعسل نحل وتوست', lunch: 'بفتيك لحم بقري مكرونة قلم بالبشاميل بطاطس وكاتشب', dinner: 'مناقيش زعتر وجبنة شاي بالنعناع' },
        { day: 'الجمعة', breakfast: 'فول بالزيت الحار طعمية جبنة رومي عيش طازج جرجير', lunch: 'أرز معمر بالفراخ ملوخية وسلطات متنوعة ومخللات', dinner: 'طبق فواكه الموسم المشكلة زبادي بلدي دافئ' }
      ]
    }
  },
  {
    id: 'house_5',
    name: 'بيت الأنبا بولا للتنمية والمؤتمرات - الفيوم',
    description: 'بيت ريفي مميز يطل على بحيرة قارون الجميلة بالفيوم. يوفر مكاناً هادئاً ومناسباً جداً للمدارس الروحية ومؤتمرات مدارس الأحد للأطفال والشباب، مع جو ريفي طبيعي وأنشطة تفاعلية في أحضان الطبيعة الدافئة.',
    ownerId: 'user_owner',
    ownerName: 'أ. جرجس نبيل',
    governorate: 'الفيوم',
    address: 'بحيرة قارون، خلف واحة لوران، الفيوم',
    lat: 29.4754,
    lng: 30.6358,
    roomsCount: 25,
    bedsCount: 110,
    roomsDescription: 'غرف ريفية نظيفة ودافئة تتسع لـ ٣ إلى ٥ أفراد، ممتازة لرحلات مدارس الأحد والجروبات الكبيرة.',
    pricePerNightPerPerson: 150,
    services: ['مصلى / كنيسة صغيرة', 'منطقة ألعاب أطفال', 'حديقة واسعة', 'ملعب كرة قدم', 'واي فاي'],
    suitability: ['children', 'youth', 'families'],
    conferenceHalls: [
      { id: 'hall_5_1', name: 'قاعة الأنبا أنطونيوس الدائرية', capacity: 150, hasSoundSystem: true, hasProjector: true }
    ],
    restaurants: [
      { id: 'rest_5', name: 'صالة طعام الفخار الشعبي', capacity: 120, mealsServed: ['breakfast', 'lunch', 'dinner'] }
    ],
    activities: ['جولات ريفية بالمركب في البحيرة', 'ورش عمل فخار وصناعات يدوية', 'ألعاب حركية ومغامرات'],
    images: [
      'https://images.unsplash.com/photo-1445019980597-93fa8acb246c?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&auto=format&fit=crop&q=80'
    ],
    status: 'pending',
    rating: 4.5,
    reviewsCount: 0,
    createdAt: '2026-06-25T11:00:00Z',
    propertyType: 'conference',
    seaProximity: 'near',
  },
  {
    id: 'house_student_1',
    name: 'سكن سانت ماريا للطالبات المغتربات - مصر الجديدة',
    description: 'سكن طالبات متميز وآمن جداً تديره بعض المكرسات الكنيسة بمصر الجديدة. يوفر بيئة هادئة ومثالية للمذاكرة والنمو الروحي والاجتماعي. قريب جداً من جامعات عين شمس ومحطات مترو الأنفاق.',
    ownerId: 'user_owner',
    ownerName: 'أ. جرجس نبيل',
    governorate: 'القاهرة',
    address: '١٢ شارع الأهرام، روكسي، مصر الجديدة، القاهرة',
    lat: 30.0910,
    lng: 31.3211,
    roomsCount: 15,
    bedsCount: 30,
    roomsDescription: 'غرف ثنائية مؤثثة بالكامل، بأسرة مريحة، مكاتب مذاكرة خاصة لكل طالبة، دواليب واسعة، ثلاجة ميني بار بكل غرفة، وإضاءة مريحة.',
    pricePerNightPerPerson: 80,
    services: ['واي فاي', 'تكييف', 'مصلى / كنيسة صغيرة', 'مطبخ مجهز بالكامل', 'غسيل ملابس', 'نظافة دورية'],
    suitability: ['youth'],
    conferenceHalls: [],
    restaurants: [],
    activities: ['ورش تطوير مهارات', 'لقاءات روحية أسبوعية للمغتربات'],
    images: [
      'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1598928506311-c55ded91a20c?w=800&auto=format&fit=crop&q=80'
    ],
    status: 'approved',
    rating: 4.9,
    reviewsCount: 0,
    createdAt: '2026-05-10T12:00:00Z',
    propertyType: 'student',
    seaProximity: 'far',
    studentHousingGender: 'girls',
    distanceFromUniversity: '١٠ دقائق من جامعة عين شمس (قريب من المترو مباشرة)',
    monthlyRent: 1800,
    roomCapacity: 2,
    housingRules: [
      'الالتزام بمواعيد غلق بوابات السكن الخارجية (الساعة ١٠ مساءً كحد أقصى)',
      'الحفاظ التام على الهدوء أثناء أوقات الامتحانات والمذاكرة الروحية والدرسية',
      'ممنوع استقبال الزيارات الذكورية داخل غرف السكن نهائياً وتقتصر على صالة الاستقبال بالدور الأرضي',
      'الالتزام الكامل بروح الزمالة والمحبة المسيحية والأخوة داخل البيت مع المكرسات والزميلات'
    ],
    contractTerms: 'عقود مرنة سنوية أو نصف سنوية تضمن تثبيت السكن والمبلغ طوال فترة الدراسة.'
  },
  {
    id: 'house_student_2',
    name: 'بيت الأنبا بيشوي لسكن الطلاب المغتربين - العباسية',
    description: 'بيت شبابي مخصص للطلبة المغتربين الأقباط الدارسين بجامعات القاهرة وعين شمس وحلوان. يتميز بالهدوء التام للتفوق الدراسي مع وجود أنشطة مشتركة مبهجة وجدول روحي خفيف للنمو الشخصي لمن يرغب.',
    ownerId: 'user_owner_2',
    ownerName: 'م. شنودة نجيب',
    governorate: 'القاهرة',
    address: '٥ شارع رمسيس، العباسية، القاهرة',
    lat: 30.0689,
    lng: 31.2825,
    roomsCount: 20,
    bedsCount: 60,
    roomsDescription: 'غرف ثلاثية مكيفة وواسعة، مجهزة بأسرة مريحة، دولاب منفصل لكل طالب، مكاتب دراسية مشتركة، وصالون اجتماعات صغير بكل دور.',
    pricePerNightPerPerson: 60,
    services: ['واي فاي', 'تكييف', 'مطبخ مجهز بالكامل', 'نظافة دورية', 'ملعب كرة قدم'],
    suitability: ['youth'],
    conferenceHalls: [],
    restaurants: [],
    activities: ['دوري كرة قدم أسبوعي للمغتربين', 'سينما ومناقشات فكرية كنسية'],
    images: [
      'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=800&auto=format&fit=crop&q=80'
    ],
    status: 'approved',
    rating: 4.7,
    reviewsCount: 0,
    createdAt: '2026-05-15T14:30:00Z',
    propertyType: 'student',
    seaProximity: 'far',
    studentHousingGender: 'boys',
    distanceFromUniversity: '٥ دقائق مشياً من جامعة عين شمس (قريب من كليتي الهندسة والعلوم)',
    monthlyRent: 1500,
    roomCapacity: 3,
    housingRules: [
      'يغلق باب السكن الخارجي تماماً الساعة ١١ مساءً لتأمين الطلاب المغتربين',
      'يمنع التدخين نهائياً داخل غرف النوم أو الممرات المشتركة للحفاظ على صحة الجميع',
      'المشاركة الإلزامية الخفيفة في جدول النظافة وترتيب المطبخ المشترك أسبوعياً'
    ],
    contractTerms: 'عقد دراسي متصل لمدة ٩ شهور مع تسهيلات مرنة للسداد الشهري الميسر.'
  },
  {
    id: 'house_staff_1',
    name: 'سكن الخريجين والموظفين الأقباط - المعادي',
    description: 'سكن شبابي راقي جداً وتجاري مخصص للمهندسين، الأطباء، والموظفين المغتربين العاملين بالشركات والمستشفيات الكبرى بالقاهرة. يتميز بالهدوء التام والنظافة الفندقية اليومية ووجود مساحات مخصصة للعمل المشترك عن بعد.',
    ownerId: 'user_owner_2',
    ownerName: 'م. شنودة نجيب',
    governorate: 'القاهرة',
    address: 'شارع ٩، المعادي، القاهرة',
    lat: 29.9602,
    lng: 31.2569,
    roomsCount: 10,
    bedsCount: 10,
    roomsDescription: 'غرف فردية مستقلة وممتازة، مجهزة بمكتب عمل مريح، شاشة تلفزيون سمارت، حمام خاص مدمج بكل غرفة وتكييف هواء سبليت.',
    pricePerNightPerPerson: 120,
    services: ['واي فاي', 'تكييف', 'نظافة دورية', 'غسيل ملابس', 'جراج خاص'],
    suitability: ['youth', 'retreat'],
    conferenceHalls: [],
    restaurants: [],
    activities: ['جلسات عمل وتطوير شبكات المعارف للموظفين'],
    images: [
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&auto=format&fit=crop&q=80'
    ],
    status: 'approved',
    rating: 4.8,
    reviewsCount: 0,
    createdAt: '2026-06-01T10:00:00Z',
    propertyType: 'staff',
    seaProximity: 'far',
    monthlyRent: 2800,
    roomCapacity: 1,
    housingRules: [
      'مراعاة أوقات نوم الآخرين والهدوء الكامل بدءاً من الساعة ١١ مساءً',
      'الحفاظ على مرافق الغرف الذكية والكهرباء والأثاث بحالة ممتازة ونظيفة',
      'التعاون وروح السلام والود والاحترام المتبادل بين الساكنين في السكن'
    ],
    contractTerms: 'عقود شهرية مرنة قابلة للتجديد التلقائي مع دفع تأمين مسترد بقيمة شهر واحد.'
  }
];

export const INITIAL_BOOKINGS: Booking[] = [
  {
    id: 'booking_1',
    houseId: 'house_1',
    houseName: 'بيت مارمرقس للمؤتمرات - كينج مريوط',
    userId: 'user_2',
    userName: 'مينا الديب',
    userPhone: '01223344556',
    userEmail: 'mina@servant.org',
    userRole: 'servant',
    organizationName: 'أسرة ثانوي كنيسة العذراء بالزيتون',
    checkIn: '2026-07-10',
    checkOut: '2026-07-13',
    guestsCount: 40,
    totalPrice: 30000, // 40 people * 250 EGP * 3 nights
    depositPaid: true,
    depositAmount: 5000,
    status: 'approved',
    isLargeConferenceQuote: false,
    createdAt: '2026-06-15T15:30:00Z',
  },
  {
    id: 'booking_2',
    houseId: 'house_2',
    houseName: 'بيت الشماسة فيبي للخلوات - وادي النطرون',
    userId: 'user_1',
    userName: 'فادي سامح',
    userPhone: '01122334455',
    userEmail: 'fady@gmail.com',
    userRole: 'individual',
    checkIn: '2026-07-01',
    checkOut: '2026-07-03',
    guestsCount: 2,
    totalPrice: 720, // 2 people * 180 EGP * 2 nights
    depositPaid: false,
    depositAmount: 0,
    status: 'pending',
    isLargeConferenceQuote: false,
    createdAt: '2026-06-27T18:20:00Z',
  },
  {
    id: 'booking_3',
    houseId: 'house_3',
    houseName: 'فندق العذراء ومارجرجس السياحي - سيدي كرير',
    userId: 'user_3',
    userName: 'تامر منير',
    userPhone: '01556677889',
    userEmail: 'church_admin@outlook.com',
    userRole: 'individual',
    organizationName: 'كنيسة مارجرجس هليوبوليس',
    checkIn: '2026-08-15',
    checkOut: '2026-08-18',
    guestsCount: 120,
    totalPrice: 126000, // 120 people * 350 EGP * 3 nights
    depositPaid: false,
    depositAmount: 0,
    status: 'pending',
    isLargeConferenceQuote: true,
    conferenceDetails: {
      hallId: 'hall_3_1',
      mealsIncluded: true,
      extraRequests: 'نحتاج لقاعة المؤتمرات الكبرى بشكل كامل مجهزة بالساوند سيستم والبروجيكتور وتجهيز ٣ وجبات يومية لعدد ١٢٠ شخص، مع توفير غرف إضافية للآباء الكهنة.',
    },
    createdAt: '2026-06-26T10:15:00Z',
  }
];

export const INITIAL_REVIEWS: Review[] = [
  {
    id: 'rev_1',
    houseId: 'house_1',
    userId: 'user_2',
    userName: 'مينا الديب',
    userRole: 'servant',
    rating: 5,
    food_rating: 5,
    service_rating: 5,
    cleanliness_rating: 5,
    organization_rating: 5,
    value_rating: 5,
    overall_rating: 5.0,
    comment: 'البيت ممتاز ومهيأ جداً للمؤتمرات الكبيرة. المعاملة من صاحب البيت في غاية الاحترام والطعام كان وفيراً وشهياً ومطابقاً للشروط الروحية الصيامية. الخدمة ممتازة ونظافة الغرف ١٠/١٠.',
    createdAt: '2026-05-20T16:00:00Z',
  },
  {
    id: 'rev_2',
    houseId: 'house_1',
    userId: 'user_1',
    userName: 'فادي سامح',
    userRole: 'individual',
    rating: 4,
    food_rating: 4,
    service_rating: 4,
    cleanliness_rating: 4,
    organization_rating: 4,
    value_rating: 4,
    overall_rating: 4.0,
    comment: 'مكان جميل هادئ ومناسب جداً للراحة والتأمل. حمام السباحة رائع والحديقة الواسعة تتيح فرصة للصلاة بسلام. نتمنى زيادة سرعة الواي فاي قليلاً في الغرف الخلفية.',
    createdAt: '2026-06-01T11:30:00Z',
  },
  {
    id: 'rev_3',
    houseId: 'house_2',
    userId: 'user_2',
    userName: 'مينا الديب',
    userRole: 'servant',
    rating: 5,
    food_rating: 5,
    service_rating: 5,
    cleanliness_rating: 5,
    organization_rating: 5,
    value_rating: 5,
    overall_rating: 5.0,
    comment: 'مكان رائع وهادئ جداً للخلوة والتأمل الروحي. مناسب جداً للشباب وقريب من أديرة وادي النطرون المقدسة. شكراً جزيلاً لخدمتكم الراقية.',
    createdAt: '2026-06-10T14:00:00Z',
  }
];

export const GOVERNORATES = [
  'الإسكندرية',
  'البحيرة',
  'الفيوم',
  'السويس',
  'القاهرة',
  'الجيزة',
  'المنيا',
  'أسيوط',
  'الاسماعيلية',
  'جنوب سيناء',
  'البحر الأحمر'
];

export const AMENITIES_LIST = [
  'تكييف',
  'واي فاي',
  'حمام سباحة',
  'ملعب كرة قدم',
  'مصلى / كنيسة صغيرة',
  'مطبخ مجهز بالكامل',
  'حديقة واسعة',
  'منطقة ألعاب أطفال',
  'جراج خاص',
  'مكتبة كنسية'
];

export const SUITABILITY_MAP = {
  youth: 'خلوة شباب',
  children: 'رحلات أطفال / مدارس أحد',
  families: 'اجتماعات أسر وعائلات',
  retreat: 'خلوات فردية وروحية'
};

export const INITIAL_PAYMENTS: Payment[] = [
  {
    id: 'pay_1',
    bookingId: 'booking_1',
    userId: 'user_2',
    userName: 'مينا الديب',
    amount: 5000,
    paymentMethod: 'instapay',
    paymentStatus: 'approved',
    paymentDate: '2026-06-16T10:00:00Z',
    transactionReference: 'IP-9821739213',
    adminNotes: 'تم التأكد من التحويل في حساب البنك الأهلي المصري تلقائياً. شكراً لكم.',
    details: {
      senderNumberOrAddress: 'mina@instapay',
    }
  }
];
