// Static Data and Runtime Generators for Coptic Christian Entertainment & Engagement Dashboard
import { RAW_VERSES } from './data/versesData';
import { RAW_CHARACTERS } from './data/whoAmIData';
import { RAW_CHARACTERS_NT } from './data/whoAmIData_NT';
import {
  BASE_TRIVIA_QUESTIONS,
  BIBLE_BOOKS_CHAPTERS,
  PAUL_LETTERS,
  CHARACTER_TRIBES,
  NAME_MEANINGS
} from './data/triviaData';
import {
  BASE_HYMN_QUESTIONS,
  COPTIC_TERMS,
  HYMN_SEASONS,
  MIDNIGHT_PRAISE_HOSES,
  LITURGICAL_BOOKS
} from './data/hymnsData';

export interface TriviaQuestion {
  question: string;
  options: string[];
  correctIdx: number;
  explanation: string;
}

export interface WhoAmIQuestion {
  clues: string[];
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export interface EventItem {
  id: string;
  name: string;
  order: number;
}

export interface HymnQuestion {
  question: string;
  options: string[];
  correctIdx: number;
  explanation: string;
}

export interface FillVerseQuestion {
  verse: string;
  options: string[];
  correctIdx: number;
  explanation: string;
}

export interface PrayerRequest {
  id: string;
  author: string;
  church: string;
  text: string;
  prayersCount: number;
  date: string;
  isUserPraying?: boolean;
}

export interface SpiritualMeditation {
  id: string;
  quote: string;
  author: string;
  category: string;
}

export interface LeaderboardUser {
  id: string;
  name: string;
  points: number;
  avatar: string;
  rank: number;
  church: string;
  isCurrentUser?: boolean;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  target: number;
  current: number;
  icon: string;
  xpReward: number;
  pointsReward: number;
}

export interface Badge {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
}

export interface CosmeticFrame {
  id: string;
  name: string;
  price: number;
  class: string;
  borderColor: string;
}

export interface CosmeticTitle {
  id: string;
  name: string;
  price: number;
}

export interface RealBenefit {
  id: string;
  title: string;
  description: string;
  price: number;
  icon: string;
}

export const COSMETIC_FRAMES: CosmeticFrame[] = [
  { id: "f_default", name: "بدون إطار", price: 0, class: "", borderColor: "" },
  { id: "f_bronze", name: "إطار المبتدئ البرونزي", price: 150, class: "ring-2 ring-amber-700", borderColor: "border-amber-700" },
  { id: "f_silver", name: "إطار الفارس الفضي", price: 300, class: "ring-2 ring-slate-400 animate-pulse", borderColor: "border-slate-400" },
  { id: "f_gold", name: "إطار البطل الذهبي", price: 500, class: "ring-2 ring-yellow-500 shadow-lg shadow-yellow-500/20", borderColor: "border-yellow-500" },
  { id: "f_royal", name: "إطار التاج الملكي الإمبراطوري", price: 1000, class: "ring-2 ring-purple-600 animate-bounce", borderColor: "border-purple-600" }
];

export const COSMETIC_TITLES: CosmeticTitle[] = [
  { id: "t_reader", name: "شماس متقد", price: 100 },
  { id: "t_servant", name: "خادم مخلص", price: 250 },
  { id: "t_teacher", name: "معلم الحكمة", price: 500 },
  { id: "t_saintly", name: "سفير المحبة الروحية", price: 1000 }
];

export const REAL_BENEFITS: RealBenefit[] = [
  { id: "b_meal", title: "وجبة عشاء فاخرة إضافية", description: "احصل على وجبة عشاء عائلية خاصة ببيت المؤتمرات مجاناً.", price: 600, icon: "🍔" },
  { id: "b_room", title: "ترقية مجانية لغرفة فردية ممتازة", description: "ترقية إقامتك لخلوة هادئة بغرفة منفصلة ومطلة ببيت الأديرة.", price: 1200, icon: "🛌" },
  { id: "b_coffee", title: "كوبون مشروبات غير محدود", description: "مشروبات ساخنة مجانية غير محدودة طوال فترة المؤتمر.", price: 300, icon: "☕" },
  { id: "b_discount", title: "خصم 20% على الاشتراك المقبل", description: "قسيمة خصم فوري على اشتراك مؤتمرك أو خلوتك المقبلة عبر التطبيق.", price: 1500, icon: "🎫" }
];

// ------------------- SHUFFLE HELPER -------------------
// Safe seeded or pseudo-random shuffle to use at module loading time
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Helper to choose 3 unique wrong answers from a pool of strings
function getWrongChoices(correct: string, pool: string[], count = 3): string[] {
  const filtered = pool.filter(item => item !== correct);
  const shuffled = shuffleArray(filtered);
  return shuffled.slice(0, count);
}

// Helper to generate distinct wrong numbers around a correct value
const getChapterOptions = (correct: number): number[] => {
  const optionsSet = new Set<number>([correct]);
  const offsets = [-2, 2, 5, -5, 10, -10, 4, -4, 8, -8];
  for (const offset of offsets) {
    const val = correct + offset;
    if (val > 0 && val !== correct && optionsSet.size < 4) {
      optionsSet.add(val);
    }
  }
  while (optionsSet.size < 4) {
    const val = Math.floor(Math.random() * 40) + 1;
    if (val !== correct) optionsSet.add(val);
  }
  return shuffleArray(Array.from(optionsSet));
};

// ------------------- DYNAMIC GENERATOR: TRIVIA_QUESTIONS -------------------
const generateTriviaQuestions = (): TriviaQuestion[] => {
  const list: TriviaQuestion[] = [...BASE_TRIVIA_QUESTIONS];

  // 1. Generate questions for Bible Book chapters (66 questions)
  for (const book of BIBLE_BOOKS_CHAPTERS) {
    const chapterOptions = getChapterOptions(book.chapters);
    const options = chapterOptions.map(n => `${n} إصحاحاً`);
    const correctIdx = options.indexOf(`${book.chapters} إصحاحاً`);
    list.push({
      question: `كم عدد إصحاحات سفر "${book.name}" (في ${book.testament})؟`,
      options,
      correctIdx,
      explanation: `يحتوي سفر "${book.name}" في ${book.testament} على ${book.chapters} إصحاحاً حسب ترتيب الكتاب المقدس التقليدي.`
    });
  }

  // 2. Generate questions for Pauline Epistles Authorship (14 questions)
  const paulinePool = ["بولس الرسول", "بطرس الرسول", "يوحنا الحبيب", "يعقوب الرسول"];
  for (const letter of PAUL_LETTERS) {
    const shuffledPool = shuffleArray(paulinePool);
    const correctIdx = shuffledPool.indexOf("بولس الرسول");
    list.push({
      question: `من هو الكاتب الموحى إليه بالرسالة إلى "${letter}" في أسفار العهد الجديد؟`,
      options: shuffledPool,
      correctIdx,
      explanation: `الرسالة إلى "${letter}" هي إحدى رسائل القديس بولس الرسول الـ١٤ المسجلة بالعهد الجديد.`
    });
  }

  // 3. Generate questions for Biblical Tribes (7 questions)
  const tribePool = ["سبط لاوي", "سبط يهوذا", "سبط بنيامين", "سبط أفرايم", "سبط منسى", "سبط رأوبين", "سبط يساكر"];
  for (const char of CHARACTER_TRIBES) {
    const wrongTribes = getWrongChoices(char.tribe, tribePool, 3);
    const options = shuffleArray([char.tribe, ...wrongTribes]);
    const correctIdx = options.indexOf(char.tribe);
    list.push({
      question: `إلى أي سبط من أسباط بني إسرائيل الاثني عشر ينتمي "${char.name}" تاريخياً؟`,
      options,
      correctIdx,
      explanation: `ينتمي "${char.name}" في الكتاب المقدس إلى "${char.tribe}".`
    });
  }

  // 4. Generate questions for Hebrew Name Meanings (24 questions)
  const allMeaningsPool = NAME_MEANINGS.map(m => m.meaning);
  for (const item of NAME_MEANINGS) {
    const wrongMeanings = getWrongChoices(item.meaning, allMeaningsPool, 3);
    const options = shuffleArray([item.meaning, ...wrongMeanings]);
    const correctIdx = options.indexOf(item.meaning);
    list.push({
      question: `ما معنى اسم "${item.name}" في اللغة الأصلية (العبرية أو اليونانية)؟`,
      options,
      correctIdx,
      explanation: `اسم "${item.name}" يعني باللغة الأصلية (العبرية أو اليونانية): "${item.meaning}".`
    });
  }

  return shuffleArray(list);
};

export const TRIVIA_QUESTIONS: TriviaQuestion[] = generateTriviaQuestions();

// ------------------- DYNAMIC GENERATOR: WHO_AM_I_QUESTIONS -------------------
const generateWhoAmIQuestions = (): WhoAmIQuestion[] => {
  const allRawCharacters = [...RAW_CHARACTERS, ...RAW_CHARACTERS_NT];
  const charNamesPool = allRawCharacters.map(c => c.name);

  return allRawCharacters.map(char => {
    const wrongNames = getWrongChoices(char.name, charNamesPool, 3);
    const options = shuffleArray([char.name, ...wrongNames]);
    return {
      clues: char.clues,
      options,
      correctAnswer: char.name,
      explanation: char.explanation
    };
  });
};

export const WHO_AM_I_QUESTIONS: WhoAmIQuestion[] = generateWhoAmIQuestions();

// ------------------- DYNAMIC GENERATOR: HYMN_QUESTIONS -------------------
const generateHymnQuestions = (): HymnQuestion[] => {
  const list: HymnQuestion[] = [...BASE_HYMN_QUESTIONS];

  // 1. Generate questions for Coptic vocabulary terms (31 questions)
  const allMeanings = COPTIC_TERMS.map(t => t.meaning);
  for (const term of COPTIC_TERMS) {
    const wrongMeanings = getWrongChoices(term.meaning, allMeanings, 3);
    const options = shuffleArray([term.meaning, ...wrongMeanings]);
    const correctIdx = options.indexOf(term.meaning);
    list.push({
      question: `ما معنى الكلمة اليونانية أو القبطية المستعملة كنسياً في القداس والتسبحة "${term.word}"؟`,
      options,
      correctIdx,
      explanation: `تعني كلمة "${term.word}" في أصلها اللغوي كنسياً: "${term.meaning}".`
    });
  }

  // 2. Generate questions for Hymn seasons (10 questions)
  const allSeasons = HYMN_SEASONS.map(s => s.season);
  for (const item of HYMN_SEASONS) {
    const wrongSeasons = getWrongChoices(item.season, allSeasons, 3);
    const options = shuffleArray([item.season, ...wrongSeasons]);
    const correctIdx = options.indexOf(item.season);
    list.push({
      question: `في أي فترة طقسية أو مناسبة كنسية مباركة يُرتل "${item.hymn}" في الكنيسة القبطية؟`,
      options,
      correctIdx,
      explanation: `يُرتل "${item.hymn}" ضمن طقوس وألحان الكنيسة القبطية في "${item.season}".`
    });
  }

  // 3. Generate questions for Midnight Praise Hoses (4 questions)
  const allTopics = MIDNIGHT_PRAISE_HOSES.map(h => h.topic);
  for (const item of MIDNIGHT_PRAISE_HOSES) {
    const wrongTopics = getWrongChoices(item.topic, allTopics, 3);
    const options = shuffleArray([item.topic, ...wrongTopics]);
    const correctIdx = options.indexOf(item.topic);
    list.push({
      question: `ما هو الموضوع الأساسي أو النص الكتابي الذي يتمحور حوله "${item.name}" في تسبحة نصف الليل الكنسية؟`,
      options,
      correctIdx,
      explanation: `يتمحور "${item.name}" في تسبحة نصف الليل حول "${item.topic}".`
    });
  }

  // 4. Generate questions for Liturgical Books (7 questions)
  const allPurposes = LITURGICAL_BOOKS.map(b => b.purpose);
  for (const item of LITURGICAL_BOOKS) {
    const wrongPurposes = getWrongChoices(item.purpose, allPurposes, 3);
    const options = shuffleArray([item.purpose, ...wrongPurposes]);
    const correctIdx = options.indexOf(item.purpose);
    list.push({
      question: `ما هو الاستخدام الكنسي أو المحتوى الروحي لكتاب "${item.book}" المستعمل طقسياً؟`,
      options,
      correctIdx,
      explanation: `يستخدم كتاب "${item.book}" في صلوات الكنيسة حيث "${item.purpose}".`
    });
  }

  return shuffleArray(list);
};

export const HYMN_QUESTIONS: HymnQuestion[] = generateHymnQuestions();

// ------------------- DYNAMIC GENERATOR: FILL_VERSE_QUESTIONS -------------------
const generateFillVerseQuestions = (): FillVerseQuestion[] => {
  const wordsPool = Array.from(new Set(RAW_VERSES.map(v => v.word)));

  return RAW_VERSES.map(v => {
    const wrongWords = getWrongChoices(v.word, wordsPool, 3);
    const options = shuffleArray([v.word, ...wrongWords]);
    const correctIdx = options.indexOf(v.word);
    return {
      verse: v.verse,
      options,
      correctIdx,
      explanation: v.explanation
    };
  });
};

export const FILL_VERSE_QUESTIONS: FillVerseQuestion[] = generateFillVerseQuestions();

// ------------------- BIBLICAL CHRONOLOGICAL EVENT GAME -------------------
export const BIBLICAL_EVENTS_SETS: EventItem[][] = [
  [
    { id: '1', name: "🌅 خلق العالم وآدم وحواء", order: 1 },
    { id: '2', name: "🌊 طوفان نوح وبناء الفلك", order: 2 },
    { id: '3', name: "⛪ خروج بني إسرائيل من مصر بقيادة موسى", order: 3 },
    { id: '4', name: "✝️ ميلاد وقيامة السيد المسيح له المجد", order: 4 },
  ],
  [
    { id: 'a', name: "🔔 دعوة إبراهيم أبو الآباء لترك أرضه", order: 1 },
    { id: 'b', name: "🏰 بناء الهيكل العظيم في أورشليم بواسطة سليمان", order: 2 },
    { id: 'c', name: "⛓️ السبي البابلي ونفي الشعب وتدمير الهيكل", order: 3 },
    { id: 'd', name: "🕊️ حلول الروح القدس على التلاميذ يوم الخمسين", order: 4 },
  ]
];

// ------------------- WORD SEARCH GAME DATA -------------------
export const WORD_SEARCH_GRID = [
  ['ي', 'س', 'و', 'ع', 'ب', 'ت'],
  ['م', 'ر', 'ي', 'م', 'خ', 'و'],
  ['و', 'ح', 'ن', 'ا', 'ا', 'م'],
  ['س', 'ر', 'د', 'ا', 'و', 'د'],
  ['ى', 'ق', 'ي', 'ل', 'ي', 'ا'],
  ['ب', 'و', 'ل', 'س', 'م', 'ن']
];

export const WORD_SEARCH_ANSWERS = [
  { word: "يسوع", color: "from-emerald-500 to-teal-500", found: false },
  { word: "مريم", color: "from-blue-500 to-indigo-500", found: false },
  { word: "موسى", color: "from-purple-500 to-pink-500", found: false },
  { word: "داود", color: "from-amber-500 to-orange-500", found: false },
  { word: "إيليا", color: "from-rose-500 to-red-500", found: false },
  { word: "بولس", color: "from-cyan-500 to-sky-500", found: false },
];

// ------------------- INITIAL PRAYER REQUESTS -------------------
export const INITIAL_PRAYER_REQUESTS: PrayerRequest[] = [
  {
    id: 'p1',
    author: "تادرس مكرم",
    church: "كنيسة مارمرقس الإسكندرية",
    text: "من أجل شفاء والدي في العناية المركزة والتعزية والسلام لأسرتنا.",
    prayersCount: 42,
    date: "اليوم، ٣:١٤ م"
  },
  {
    id: 'p2',
    author: "سارة يوسف",
    church: "كنيسة العذراء مريم الزيتون",
    text: "نطلب صلواتكم لدعم شباب ثانوية عامة وبدء امتحاناتهم ليعطيهم الرب سلاماً وتركيزاً ونعمة.",
    prayersCount: 56,
    date: "اليوم، ١:٢٠ م"
  },
  {
    id: 'p3',
    author: "كيرلس عاطف",
    church: "دير القديس أنطونيوس البحر الأحمر",
    text: "من أجل بركة ونعمة خلوة الشباب المقررة الأسبوع القادم، لكي تكون عودة روحية وتجديد حقيقي لقلوبنا.",
    prayersCount: 29,
    date: "أمس، ٨:٤٥ م"
  }
];

// ------------------- SPIRITUAL MEDITATIONS -------------------
export const SPIRITUAL_MEDITATIONS: SpiritualMeditation[] = [
  {
    id: 'm1',
    quote: "إن الصلاة هي مفتاح السماء، وبها يستطيع الإنسان أن ينال بركات ونعماً لا حدود لها.",
    author: "البابا كيرلس السادس",
    category: "الصلاة والتأمل"
  },
  {
    id: 'm2',
    quote: "المحبة الحقيقية هي التي تضحي وتبذل دون أن تنتظر شيئاً في المقابل، تشبهاً بمخلصنا الصالح.",
    author: "البابا شنودة الثالث",
    category: "المحبة والمسيحية"
  },
  {
    id: 'm3',
    quote: "كن أميناً في الصغير، والرب سوف يقيمك ويسلمك الكثير في حينه المبارك.",
    author: "مارجرجس البطل",
    category: "الأمانة والجهاد"
  }
];

// ------------------- MOCK LEADERBOARD DATA -------------------
export const LEADERBOARD_MOCKS = {
  daily: [
    { id: 'l1', name: "يوحنا أنور", points: 280, avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80", rank: 1, church: "مارجرجس هليوبوليس" },
    { id: 'l2', name: "مينا سامح", points: 250, avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80", rank: 2, church: "العذراء الزيتون" },
    { id: 'l3', name: "ماريا عادل", points: 190, avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80", rank: 3, church: "الملاك شيراتون" },
  ],
  weekly: [
    { id: 'l1', name: "يوحنا أنور", points: 1250, avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80", rank: 1, church: "مارجرجس هليوبوليس" },
    { id: 'l2', name: "مينا سامح", points: 1100, avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80", rank: 2, church: "العذراء الزيتون" },
    { id: 'l3', name: "كيرلس ماهر", points: 950, avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80", rank: 3, church: "مارمرقس مصر الجديدة" },
  ],
  monthly: [
    { id: 'l1', name: "يوحنا أنور", points: 5400, avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80", rank: 1, church: "مارجرجس هليوبوليس" },
    { id: 'l2', name: "مينا سامح", points: 4800, avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80", rank: 2, church: "العذراء الزيتون" },
    { id: 'l3', name: "ماريا عادل", points: 4320, avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80", rank: 3, church: "الملاك شيراتون" },
  ]
};

// ------------------- ACHIEVEMENTS LIST -------------------
export const ACHIEVEMENTS_LIST: Achievement[] = [
  {
    id: "ach_1",
    title: "أول مؤتمر",
    description: "احجز وقم بإنهاء أول مؤتمر كنسي لك عبر التطبيق.",
    target: 1,
    current: 1,
    icon: "🏰",
    xpReward: 100,
    pointsReward: 50
  },
  {
    id: "ach_2",
    title: "أول خلوة روحية",
    description: "قم بحجز وتأكيد خلوتك الروحية الفردية في بيوت الأديرة.",
    target: 1,
    current: 0,
    icon: "🏕️",
    xpReward: 150,
    pointsReward: 100
  },
  {
    id: "ach_3",
    title: "خبير الإنجيل",
    description: "أجب بشكل صحيح على 100 سؤال كتابي وعقائدي.",
    target: 100,
    current: 45,
    icon: "📖",
    xpReward: 200,
    pointsReward: 150
  },
  {
    id: "ach_4",
    title: "حافظ الآيات",
    description: "قم بحفظ وتأمين 10 آيات من آيات اليوم.",
    target: 10,
    current: 3,
    icon: "🔖",
    xpReward: 120,
    pointsReward: 60
  },
  {
    id: "ach_5",
    title: "مواظب يومي",
    description: "سجل دخولك اليومي لمدة 30 يوماً متتالياً.",
    target: 30,
    current: 4,
    icon: "🔥",
    xpReward: 300,
    pointsReward: 200
  },
  {
    id: "ach_6",
    title: "محب الاجتماعات",
    description: "احضر 5 مؤتمرات أو خلوات مختلفة.",
    target: 5,
    current: 2,
    icon: "👑",
    xpReward: 250,
    pointsReward: 200
  },
  {
    id: "ach_7",
    title: "محارب الصلاة الروحي",
    description: "ادعم 50 طلباً للصلاة في قسم طلبات صلاة المجتمع.",
    target: 50,
    current: 12,
    icon: "🙏",
    xpReward: 180,
    pointsReward: 90
  }
];

// ------------------- BADGES LIST -------------------
export const BADGES_LIST: Badge[] = [
  { id: "b_bible", title: "Bible Expert 📖", description: "معرفة متميزة بآيات الإنجيل وأسفاره", icon: "📖", color: "from-blue-500 to-indigo-600" },
  { id: "b_quiz", title: "Quiz Master 👑", description: "إكمال 5 مسابقات متتالية بإجابات صحيحة", icon: "👑", color: "from-amber-500 to-orange-600" },
  { id: "b_conf", title: "Conference Lover 🏰", description: "حضور ومشاركة في مؤتمرات كنسية متعددة", icon: "🏰", color: "from-purple-500 to-pink-600" }
];

// ------------------- FOUR NEW SCRIPTURAL GAMES QUESTIONS -------------------
export const PROVERBS_QUESTIONS: TriviaQuestion[] = [
  {
    question: "بدء المعرفة مخافة الرب، أما الجاهلون فيحتقرون الحكمة والأدب. في أي سفر كُتب هذا؟",
    options: ["سفر الأمثال", "سفر الجامعة", "سفر أيوب", "سفر النشيد"],
    correctIdx: 0,
    explanation: "هو الآية المفتاحية لسفر الأمثال الأصحاح الأول (الأمثال ١:٧)."
  },
  {
    question: "أكمل الآية: 'الابن الحكيم يسر أباه، والابن الجاهل...'",
    options: ["حزن أمه", "يغضب والده", "يهلك ماله", "يفسد بيته"],
    correctIdx: 0,
    explanation: "المكتوب في الأمثال ١٠:١ 'الابن الحكيم يسر أباه، والابن الجاهل حزن أمه'."
  },
  {
    question: "ما هي الحشرة التي ينصحنا سفر الأمثال بالذهاب إليها لنتعلم الحكمة والنشاط؟",
    options: ["النملة", "النحلة", "العنكبوت", "الجرادة"],
    correctIdx: 0,
    explanation: "أمثال ٦:٦ 'اذهب إلى النملة أيها الكسلان، تأمل طرقها وكن حكيماً'."
  },
  {
    question: "شخص ثقة يذم الغضب المتسرع قائلاً: 'البطيء الغضب خير من الجبار، ومالك روحه خير من...'",
    options: ["من يأخذ مدينة", "من يجمع ذهباً", "من يقهر جيشاً", "من يبني بيتاً"],
    correctIdx: 0,
    explanation: "الآية في أمثال ١٦:٣٢ 'البطيء الغضب خير من الجبار، ومالك روحه خير من يأخذ مدينة'."
  },
  {
    question: "«الابن الحكيم يقبل تأديب أبيه، والمستهزئ لا يسمع...» ما الكلمة المتممة؟",
    options: ["انتهاراً", "نصيحة", "صوتاً", "توبيخاً"],
    correctIdx: 0,
    explanation: "أمثال ١٣:١ «الابن الحكيم يقبل تأديب أبيه، والمستهزئ لا يسمع انتهاراً»."
  },
  {
    question: "«الصيت أفضل من الغنى العظيم، والنعمة الصالحة أفضل من...»",
    options: ["الفضة والذهب", "القصور والملك", "العلم والحكمة", "الصحة الطويلة"],
    correctIdx: 0,
    explanation: "أمثال ٢٢:١ «الصيت أفضل من الغنى العظيم، والنعمة الصالحة أفضل من الفضة والذهب»."
  },
  {
    question: "«الجواب اللين يصرف الغضب، والكلام الموجع...»",
    options: ["يهيج السخط", "يبكي القلوب", "يجرح النفس", "يبني العداوة"],
    correctIdx: 0,
    explanation: "أمثال ١٥:١ «الجواب اللين يصرف الغضب، والكلام الموجع يهيج السخط»."
  },
  {
    question: "«قبل الكسر الكبرياء، وقبل السقوط...»",
    options: ["تشامخ الروح", "ضعف الجسد", "كثرة الذنوب", "ابتعاد الأصدقاء"],
    correctIdx: 0,
    explanation: "أمثال ١٦:١٨ «قبل الكسر الكبرياء، وقبل السقوط تشامخ الروح»."
  },
  {
    question: "«المرأة الفاضلة تاج لزوجها، أما المخزية فـ...»",
    options: ["كنخر في عظامه", "كمرض في جسده", "كحزن في قلبه", "كظلمة في بيته"],
    correctIdx: 0,
    explanation: "أمثال ١٢:٤ «المرأة الفاضلة تاج لزوجها، أما المخزية فكنخر في عظامه»."
  },
  {
    question: "«القلب الفرحان يجعل الوجه متهللاً، وبحزن القلب تنكسر...»",
    options: ["الروح", "العظام", "الأحلام", "العلاقات"],
    correctIdx: 0,
    explanation: "أمثال ١٥:١٣ «القلب الفرحان يجعل الوجه متهللاً، وبحزن القلب تنكسر الروح»."
  },
  {
    question: "«الرجل الغضوب يهيج الخصومة، والبطيء الغضب...»",
    options: ["يسكن الخصام", "ينال الكرامة", "يحبه الجميع", "يكسب السلام"],
    correctIdx: 0,
    explanation: "أمثال ١٥:١٨ «الرجل الغضوب يهيج الخصومة، والبطيء الغضب يسكن الخصام»."
  },
  {
    question: "«لا توبخ مستهزئاً لئلا يبغضك. وبخ حكيماً فـ...»",
    options: ["يحبك", "يزيد حكمة", "يشكرك", "يرشدك"],
    correctIdx: 0,
    explanation: "أمثال ٩:٨ «لا توبخ مستهزئاً لئلا يبغضك. وبخ حكيماً فيحبك»."
  }
];

export const REVELATION_QUESTIONS: TriviaQuestion[] = [
  {
    question: "ما هو الرمز الذي يُشار به إلى 'سبع كنائس' في سفر الرؤيا؟",
    options: ["سبع مناير ذهبية", "سبعة كواكب", "سبعة أختام", "سبعة أبواق"],
    correctIdx: 0,
    explanation: "رؤيا ١:٢٠ 'والمناير السبع التي رأيتها هي السبع الكنائس'."
  },
  {
    question: "من هو الشخص الملقب بـ 'الألف والياء، البداية والنهاية' في سفر الرؤيا؟",
    options: ["السيد المسيح له المجد", "القديس يوحنا الحبيب", "الملاك ميخائيل", "داود النبي"],
    correctIdx: 0,
    explanation: "يقول الرب يسوع 'أنا هو الألف والياء، البداية والنهاية، الأول والآخر' (رؤيا ٢٢:١٣)."
  },
  {
    question: "كم هو عدد الشيوخ (القسوس) الجالسين حول العرش الإلهي متسربلين بثياب بيض؟",
    options: ["٢٤ شيخاً", "١٢ شيخاً", "٧٠ شيخاً", "١٤٤ شيخاً"],
    correctIdx: 0,
    explanation: "رؤيا ٤:٤ 'ورأيت حول العرش أربعة وعشرين عرشاً. وعلى العروش رأيت أربعة وعشرين شيخاً جالسين'."
  },
  {
    question: "ما هي المدينة المقدسة التي رآها يوحنا نازلة من السماء من عند الله مهيأة كعروس مزينة لرجلها؟",
    options: ["أورشليم الجديدة", "أفسس", "روما الجديدة", "السامرة"],
    correctIdx: 0,
    explanation: "رؤيا ٢١:٢ 'وأنا يوحنا رأيت المدينة المقدسة أورشليم الجديدة نازلة من السماء من عند الله'."
  },
  {
    question: "أي ختم من الأختام السبعة عند فتحه رأى يوحنا نفوس الشهداء تحت المذبح يصرخون طلباً للعدل؟",
    options: ["الختم الخامس", "الختم الأول", "الختم السابع", "الختم الثالث"],
    correctIdx: 0,
    explanation: "رؤيا ٦:٩ «ولما فتح الختم الخامس، رأيت تحت المذبح نفوس الذين قتلوا من أجل كلمة الله»."
  },
  {
    question: "ما هو العدد الرمزي للذين خُتموا في جبهاتهم من جميع أسباط بني إسرائيل؟",
    options: ["١٤٤ ألفاً", "١٢ ألفاً", "٧٠ ألفاً", "مليون شخص"],
    correctIdx: 0,
    explanation: "رؤيا ٧:٤ «وسمعت عدد المختومين مئة وأربعة وأربعين ألفاً، مختومين من كل سبط»."
  },
  {
    question: "ما هي الكنيسة التي وُصفت بأنها 'فتية وفاترة لا حارة ولا باردة' وسيزمع الرب أن يتقيأها؟",
    options: ["كنيسة لاودكية", "كنيسة أفسس", "كنيسة ساردس", "كنيسة سميرنا"],
    correctIdx: 0,
    explanation: "كنيسة لاودكية وُبخت بفتورها الروحي الشديد والاعتماد على الغنى المادي والرياء (رؤيا ٣)."
  },
  {
    question: "في رؤية الأصحاح الأول، كيف وصفت عينا السيد المسيح الممجّد؟",
    options: ["كأنهما لهيب نار", "شبه اللؤلؤ الأبيض", "كالشمس المضيئة", "كالبحر الصافي العميق"],
    correctIdx: 0,
    explanation: "رؤيا ١:١٤ وصف لاهوته وبصيرته النافذة بـ «وعيناه كلهيب نار»."
  },
  {
    question: "ما هو وصف السفر الذي بيمين الجالس على العرش في الأصحاح الخامس؟",
    options: ["مكتوب من داخل ومن وراء ومختوم بسبعة أختام", "مكتوب بنور من ذهب ولا تفتحه يد بشر", "مفتوح للجميع لقراءته وفهم أسراره", "سجل فيه أسماء ملائكة الكنائس السبع"],
    correctIdx: 0,
    explanation: "رؤيا ٥:١ «رأيت على يمين الجالس على العرش سفراً مكتوباً من داخل ومن وراء، مختوماً بسبعة أختام»."
  },
  {
    question: "ما اسم النجم العظيم الذي سقط من السماء وهو يتقد كمصباح فجعل ثلث المياه مرة؟",
    options: ["الأفسنتين", "الزهرة", "الصبح المنير", "البرق الإلهي"],
    correctIdx: 0,
    explanation: "رؤيا ٨:١١ «واسم النجم يُدعى الأفسنتين، فصار ثلث المياه أفسنتيناً ومات كثير من الناس»."
  },
  {
    question: "ماذا وُعد المؤمنون الغالبون في كنيسة برغامس أن يُعطوا كمكافأة روحية؟",
    options: ["المن المخفى وحصاة بيضاء عليها اسم جديد", "إكليل الملوك وتاج الحياة الباقي", "سلطان كامل على شعوب وأمم الأرض", "رؤية المجد السماوي مباشرة بلا حجاب"],
    correctIdx: 0,
    explanation: "رؤيا ٢:١٧ «من يغلب فسأعطيه أن يأكل من المن المخفى، وأعطيه حصاة بيضاء، وعلى الحصاة اسم جديد»."
  },
  {
    question: "ما هي الشجرة العظيمة المزروعة على جانبي نهر ماء الحياة وتصنع اثني عشر ثمراً؟",
    options: ["شجرة الحياة", "شجرة الزيتون المباركة", "كرمة الفداء الروحي", "شجرة التين المورقة"],
    correctIdx: 0,
    explanation: "رؤيا ٢٢:٢ «وعلى نهر الحياة من هنا ومن هناك شجرة حياة تصنع اثني عشر ثمراً، وأوراقها لشفاء الأمم»."
  }
];

export const STPAUL_QUESTIONS: TriviaQuestion[] = [
  {
    question: "في أي مدينة كانت ولادة ونشأة شاول الطرسوسي (بولس الرسول)؟",
    options: ["طرسوس", "دمشق", "أورشليم", "روما"],
    correctIdx: 0,
    explanation: "ولد القديس بولس في مدينة طرسوس التابعة لكيليكية وكان رومانياً بالمولد (أعمال ٢٢:٣)."
  },
  {
    question: "من هو التلميذ الأمين الذي اصطحبه بولس الرسول في رحلته التبشيرية الثانية بعد اختلافه مع برنابا؟",
    options: ["سيلا", "مرقس", "لوقا", "برنابا"],
    correctIdx: 0,
    explanation: "أعمال ١٥:٤٠ 'أما بولس فاختار سيلا وخرج مستودعاً من الإخوة إلى نعمة الله'."
  },
  {
    question: "ما هي المدينة اليونانية التي ألقى فيها بولس الرسول خطابه الشهير في ساحة 'أريوس باغوس'؟",
    options: ["أثينا", "كورنثوس", "تسالونيكي", "أفسس"],
    correctIdx: 0,
    explanation: "وقف بولس في وسط أريوس باغوس في أثينا وخاطبهم عن 'الإله المجهول' الذي يتقونه (أعمال ١٧:٢٢)."
  },
  {
    question: "ما هو اسم الجزيرة التي انكسرت بها سفينة القديس بولس ونجا مع رفاقه من الغرق؟",
    options: ["مليطة (مالطا)", "قبرص", "كريت", "بطمس"],
    correctIdx: 0,
    explanation: "لما نجوا وجدوا أن الجزيرة تدعى مليطة (مالطا الآن) وأظهر أهلها بربراً إحساناً غير عادي (أعمال ٢٨:١)."
  },
  {
    question: "في أي رسالة لبولس الرسول كُتب أصحاح المحبة الشهير (الأصحاح ١٣)؟",
    options: ["الرسالة الأولى إلى أهل كورنثوس", "الرسالة إلى أهل رومية", "الرسالة إلى أهل أفسس", "الرسالة إلى العبرانيين"],
    correctIdx: 0,
    explanation: "الرسالة الأولى إلى كورنثوس الأصحاح ١٣ تقدم أعمق دراسة وتعريف للمحبة المسيحية الفائقة."
  },
  {
    question: "من هو العبد الهارب الذي آمن على يدي بولس الرسول في السجن وكتب لأجله رسالة خاصة تطلب الصفح والحرية؟",
    options: ["أونيسيموس", "أبولوس", "ديماس", "تيخيكوس"],
    correctIdx: 0,
    explanation: "كتب القديس بولس رسالة 'فليمون' من أجل العبد التائب أونيسيموس ليعود لسيده فليمون كأخ حبيب."
  },
  {
    question: "ما اسما الخادمتين في فيلبي اللتين حثهما بولس الرسول في رسالته أن تفتكرا فكراً واحداً في الرب؟",
    options: ["أفودية وسنتيخي", "بريسكلا ومريم", "فيبي وحنة", "ليديا ودمارس"],
    correctIdx: 0,
    explanation: "في فيلبي، حث الرسول بولس الأختين أفودية وسنتيخي على الوفاق الروحي والفكر الواحد في الرب (فيلبي ٤:٢)."
  },
  {
    question: "من هو الساحر اليهودي الكذاب الذي قاوم بولس وبرنابا في بافوس فضربه بولس بالعمى المؤقت؟",
    options: ["بار يشوع (عليم الساحر)", "سيمون الساحر", "هيرودس", "ديوتريفس"],
    correctIdx: 0,
    explanation: "أعمال ١٣:٦ «وجدوا رجلاً ساحراً نبياً كذاباً يهودياً اسمه بار يشوع.. قاومهما عليم الساحر»."
  },
  {
    question: "من هو الابن الروحي والأسقف الشاب الآخر الذي أقامه بولس على جزيرة كريت لتنظيم شؤون الكنيسة؟",
    options: ["تيطس", "تيموثاوس", "أبولوس", "أونيسيمس"],
    correctIdx: 0,
    explanation: "أرسل بولس رسالة رعوية لتلميذه تيطس أسقف كريت لإرشاده في اختيار الكهنة وتنظيم الرعية."
  },
  {
    question: "من هو الوالي الروماني الذي ارتعد عندما تكلم معه بولس الرسول عن البر والتعفف والدينونة العتيدة؟",
    options: ["فليكس الوالي", "فستوس", "بيلاطس", "غالينوس"],
    correctIdx: 0,
    explanation: "أعمال ٢٤:٢٥ «وبينما كان يتكلم عن البر والتعفف والدينونة العتيدة، ارتعد فليكس وأجاب: اذهب الآن»."
  },
  {
    question: "كم عدد الرسائل اللاهوتية المنسوبة للقديس بولس الرسول والمسجلة في العهد الجديد؟",
    options: ["١٤ رسالة", "١٢ رسالة", "٧ رسائل", "١٠ رسائل"],
    correctIdx: 0,
    explanation: "كتب القديس بولس ١٤ رسالة لاهوتية شهيرة، من رومية حتى العبرانيين."
  },
  {
    question: "ما هي المهنة اليدوية التي كان يمارسها بولس الرسول مع أكيلا وبريسكلا ليعول نفسه ولا يثقل الكنيسة؟",
    options: ["صناعة الخيام", "صيد السمك", "النجارة", "صناعة الجلود"],
    correctIdx: 0,
    explanation: "أعمال ١٨:٣ «لكونهما من نفس الصناعة، أقام عندهما وعمل، لأنهما كانا صانعي خيام»."
  }
];

export const PROPHETS_QUESTIONS: TriviaQuestion[] = [
  {
    question: "أي نبي صلى فاستجيب له بنزول نار من السماء لتلتهم المحرقة وتبرهن على حقيقة عبادة الله أمام أنبياء البعل؟",
    options: ["إيليا النبي", "إشعياء النبي", "أليشع النبي", "موسى النبي"],
    correctIdx: 0,
    explanation: "حدث هذا في جبل الكرمل حين تحدى إيليا أنبياء البعل فنزلت نار الرب وأكلت المحرقة والحطب (١ ملوك ١٨)."
  },
  {
    question: "من هو النبي الذي سُدّت أفواه الأسود في الجب بصلاته وأمانته للرب أمام الملك داريوس؟",
    options: ["دانيال النبي", "حزقيال النبي", "إرميا النبي", "يونان النبي"],
    correctIdx: 0,
    explanation: "أرسل الله ملاكه وسد أفواه الأسود فلم تضر دانيال لأنه وجد باراً قدامه (دانيال ٦:٢٢)."
  },
  {
    question: "من هو النبي الذي ألقاه البحارة في البحر فابتلعه حوت عظيم وظل في جوفه ثلاثة أيام وثلاث ليالٍ؟",
    options: ["يونان النبي", "هوشع النبي", "إيليا النبي", "ميخا النبي"],
    correctIdx: 0,
    explanation: "سفر يونان يصف كيف أعد الرب حوتاً عظيماً ليبتلع يونان، وكان رمزاً لموت وقيامة السيد المسيح."
  },
  {
    question: "من هو النبي والملك الكاتب لمعظم مزامير سفر المزامير الشهير في العهد القديم؟",
    options: ["داود النبي", "سليمان الحكيم", "موسى النبي", "صموئيل النبي"],
    correctIdx: 0,
    explanation: "داود النبي والملك هو 'مرنم إسرائيل الحلو' وكاتب الجزء الأكبر من المزامير بروح النبوة والإرشاد الإلهي."
  },
  {
    question: "من هو النبي الذي أخذ رداء معلمه إيليا وشق به نهر الأردن وصنع معجزات عظيمة؟",
    options: ["أليشع النبي", "هوشع النبي", "ميخا", "صموئيل"],
    correctIdx: 0,
    explanation: "طلب أليشع نصيب اثنين من روح إيليا ورافقه حتى صعوده، وشق نهر الأردن برداء إيليا (٢ ملوك ٢)."
  },
  {
    question: "أي نبي عاين رؤيا وادي العظام اليابسة التي تجمعت ودبت فيها الحياة بكلمة الرب؟",
    options: ["حزقيال النبي", "دانيال", "إرميا", "إشعياء"],
    correctIdx: 0,
    explanation: "حزقيال ٣٧ يصف هذه الرؤيا الشهيرة والمؤثرة التي ترمز لقيامة الأمة وقيامة الأجساد العامة."
  },
  {
    question: "من هو النبي الذي واجه داود الملك ووبخه بحكمة وأدب مستعيناً بمثل 'النعجة الواحدة'؟",
    options: ["ناثان النبي", "صموئيل النبي", "جاد الرائي", "إيليا النبي"],
    correctIdx: 0,
    explanation: "٢ صموئيل ١٢ يصف كيف واجه ناثان النبي داود الملك بخطيته بروح الأمانة والتبكيت الإلهي فتاب داود."
  },
  {
    question: "من هو النبي الملقب بـ 'النبي الإنجيلي' لكثرة ووضوح نبوءاته الفائقة عن تجسد وميلاد وآلام المسيح؟",
    options: ["إشعياء النبي", "إرميا", "ميخا", "دانيال"],
    correctIdx: 0,
    explanation: "تنبأ إشعياء عن الميلاد من عذراء (إشعياء ٧) وعن الآلام والصلب الفدائي بدقة بالغة (إشعياء ٥٣)."
  },
  {
    question: "أي نبي دُعي 'بالنبي الباكي' وحزن بمرارة شديدة على خراب أورشليم وسبي شعبه ودوّن سفر المراثي؟",
    options: ["إرميا النبي", "حزقيال", "عاموس", "ملاخي"],
    correctIdx: 0,
    explanation: "عاش إرميا النبي مأساة سبي بابل وخراب أورشليم وعبر عن حزنه الشديد بالدموع والصلوات والمراثي."
  },
  {
    question: "من هو النبي الصغير الذي تنبأ باسم وموقع ولادة المخلص بدقة: «أما أنت يا بيت لحم... فمنك يخرج لي...»؟",
    options: ["ميخا النبي", "هوشع النبي", "زكريا النبي", "يوئيل النبي"],
    correctIdx: 0,
    explanation: "ميخا ٥:٢ «أما أنت يا بيت لحم أفراتة.. فمنك يخرج لي الذي يكون متسلطاً في إسرائيل ومخارجه منذ القديم»."
  },
  {
    question: "من هو النبي والملك الشهير بـ 'الحكيم' الذي شيد الهيكل الأول الفخم في أورشليم وكتب سفر الجامعة؟",
    options: ["سليمان الحكيم", "داود الملك", "حزقيا الملك", "يوشيا الملك"],
    correctIdx: 0,
    explanation: "سليمان هو ملك الحكمة والسلام باني الهيكل الأول وصاحب سفر الأمثال والجامعة والنشيد."
  },
  {
    question: "من هو آخر الأنبياء في العهد القديم الذي ختم أسفاره بالتنبؤ بمجيء إيليا الجديد (يوحنا المعمدان)؟",
    options: ["ملاخي النبي", "زكريا النبي", "حجي النبي", "صفنيا النبي"],
    correctIdx: 0,
    explanation: "سفر ملاخي هو آخر أسفار العهد القديم وتنبأ عن رسول يهيئ الطريق أمام الرب ومجيء إيليا الروحي."
  }
];
