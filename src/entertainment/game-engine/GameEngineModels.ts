export interface ScoreTransaction {
  id: string;
  teamId: string;
  teamName: string;
  amount: number;
  type: 'add' | 'deduct' | 'bonus' | 'penalty' | 'double';
  description: string;
  timestamp: string;
}

export interface GamePlugin {
  id: string;
  label: string;
  icon: string;
  category: 'knowledge' | 'speed' | 'luck' | 'creative' | 'logic';
  desc: string;
  instructions: string;
  timeLimit: number; // in seconds
  scoreMultiplier: number;
  mediaUrl?: string;
  mediaType?: 'image' | 'audio' | 'video' | 'gif';
  questionType: 'mcq' | 'tf' | 'text' | 'order' | 'matching' | 'media' | 'random';
}

export interface GameSession {
  id: string;
  roomCode: string;
  roomName: string;
  startTime: string;
  endTime?: string;
  activeGameId: string | null;
  totalDuration: number; // in seconds
  gamesPlayed: string[];
  transactions: ScoreTransaction[];
  participantsCount: number;
}

export const GAME_ENGINE_PLUGINS: GamePlugin[] = [
  {
    id: 'trivia',
    label: 'مسابقة الكتاب المقدس (Quiz)',
    icon: '📖',
    category: 'knowledge',
    desc: 'أسئلة اختيار من متعدد تفاعلية بمؤقت زمني دقيق',
    instructions: 'اختر الإجابة الصحيحة قبل انتهاء الوقت لتسجيل نقاط لفريقك.',
    timeLimit: 30,
    scoreMultiplier: 1,
    questionType: 'mcq'
  },
  {
    id: 'whoami',
    label: 'من أنا في الكتاب؟ (Who Am I)',
    icon: '👤',
    category: 'knowledge',
    desc: 'تخمين الشخصيات المقدسة بالقرائن المتتابعة',
    instructions: 'اقرأ القرائن تدريجياً، وحاول تخمين الشخصية الكتابية أو القديس.',
    timeLimit: 45,
    scoreMultiplier: 1.5,
    questionType: 'mcq'
  },
  {
    id: 'charades',
    label: 'تمثيل الشخصيات (Charades)',
    icon: '🎭',
    category: 'creative',
    desc: 'يمثل اللاعب المختار قصة أو آية دون كلام ويخمن البقية',
    instructions: 'يظهر المفهوم الروحي للاعب واحد فقط ليمثله صامتاً، وعلى فريقه التخمين في دقيقتين.',
    timeLimit: 120,
    scoreMultiplier: 2,
    questionType: 'text'
  },
  {
    id: 'guessimage',
    label: 'خمن الصورة (Guess Image)',
    icon: '🖼️',
    category: 'logic',
    desc: 'اكشف مربعات من الصورة المغطاة تدريجياً وخمن الحدث',
    instructions: 'كل بضع ثوانٍ ينكشف مربع جديد. أول من يضغط على تخمين صحيح يكسب نقاطاً مضاعفة.',
    timeLimit: 60,
    scoreMultiplier: 1.5,
    questionType: 'media',
    mediaType: 'image'
  },
  {
    id: 'speed',
    label: 'تحدي السرعة (Speed Challenge)',
    icon: '⚡',
    category: 'speed',
    desc: 'إجابة صحيحة أسرع تعني نقاطاً أكثر وفوراناً بالصدارة!',
    instructions: 'النقاط تتناقص بمرور الثواني، الأسرع في الإجابة الصحيحة يكتسح الصدارة.',
    timeLimit: 15,
    scoreMultiplier: 2,
    questionType: 'mcq'
  },
  {
    id: 'bomb',
    label: 'لعبة القنابل والبراميل (Bomb Game)',
    icon: '💣',
    category: 'luck',
    desc: 'صناديق رقمية تخبئ مكافآت ذهبية أو قنابل ناسفة للنقاط!',
    instructions: 'اختر صندوقاً من 12 صندوقاً. قد تكسب نقاطاً، تفجر نقاط فريق آخر، أو تخسر نقاطاً!',
    timeLimit: 45,
    scoreMultiplier: 1,
    questionType: 'random'
  },
  {
    id: 'drawguess',
    label: 'ارسم وخمن (Draw & Guess)',
    icon: '🎨',
    category: 'creative',
    desc: 'لوحة رسم للمتسابق يمثل آية أو قصة ويرسمها للباقين يدوياً',
    instructions: 'يرسم أحد المتسابقين الكلمة الروحية على السبورة البيضاء بينما يخمن الزملاء الكلمة.',
    timeLimit: 90,
    scoreMultiplier: 2,
    questionType: 'text'
  },
  {
    id: 'escaperoom',
    label: 'هروب الكتاب المقدس (Escape Room)',
    icon: '🚪',
    category: 'logic',
    desc: 'حل شفرات وألغاز متتالية لفتح مخرج الطوارئ الروحي',
    instructions: 'تتكون الغرفة من 4 أقفال: شفرة أرقام، ترتيب أحداث، معضلة عقائدية، والآية المفقودة.',
    timeLimit: 180,
    scoreMultiplier: 2.5,
    questionType: 'order'
  },
  {
    id: 'timerush',
    label: 'سباق الوقت (Time Rush)',
    icon: '⏱️',
    category: 'speed',
    desc: 'أكبر عدد من الإجابات الصحيحة في دقيقة واحدة متواصلة',
    instructions: 'أسئلة سريعة ومتتالية بدون توقف. أجب بأكبر عدد ممكن قبل انتهاء الـ 60 ثانية!',
    timeLimit: 60,
    scoreMultiplier: 1.5,
    questionType: 'mcq'
  },
  {
    id: 'timeline',
    label: 'ترتيب الأحداث (Timeline)',
    icon: '⏳',
    category: 'logic',
    desc: 'رتب الأحداث التاريخية الكتابية من الأقدم للأحدث ترتيباً دقيقاً',
    instructions: 'اسحب أو اضغط لترتيب الأحداث الأربعة المعروضة بشكل صحيح تاريخياً.',
    timeLimit: 90,
    scoreMultiplier: 1.8,
    questionType: 'order'
  }
];
