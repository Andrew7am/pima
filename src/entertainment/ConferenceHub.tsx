import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import JoinConferenceCard from './JoinConferenceCard';
import { ConferenceRoom, ConferenceAnnouncement, ConferenceChecklistItem, ConferenceEvent, ConferenceLiveChatMessage, ConferenceScheduleItem } from '../types';
import { QrCode, Search, LogIn, ArrowRight, Gamepad2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import ParticipantCard from './ParticipantCard';
import ParticipantCardEditor from './ParticipantCardEditor';
import InteractiveRoom from './InteractiveRoom';
import QRScanner from './QRScanner';
import SpiritualJournal from './SpiritualJournal';

import { motion, AnimatePresence } from 'motion/react';
import { 
  MapPin, Phone, Calendar, Clock, Compass, Users, Crown, Bell, Plus, PlusCircle, RefreshCw, LayoutList,
  Trash2, MessageSquare, CheckSquare, Square, Radio, Heart, Send, 
  Eye, AlertCircle, Map, ChevronDown, ChevronUp, Check, Star, ShieldCheck,
  Award, Sparkles, BookOpen, Music, LayoutGrid, AlertTriangle, Pin, Timer,
  Activity, TrendingUp, Zap
} from 'lucide-react';

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, Legend } from 'recharts';
import { triggerHaptic } from '../lib/haptic';
import { playSound } from '../lib/sounds';



// --- SPIRITUAL MATERIAL GENERATOR FOR LECTURES & READING MODE ---
function getSpiritualMaterial(title: string): { 
  intro: string; 
  keyPoints: string[]; 
  fathersQuotes: string[]; 
  verses: string[]; 
  summary: string; 
} {
  const normTitle = title.toLowerCase();
  
  if (normTitle.includes('تسليم') || normTitle.includes('التسليم')) {
    return {
      intro: "إن حياة التسليم الكامل للمصلوب هي قمة النضوج والجهاد الروحي الواعي، وهي المدخل الحقيقي للسلام الإلهي الذي يفوق كل عقل بشري ضيق. التسليم ليس استسلاماً سلبياً أو هروباً من المسؤوليات، بل هو ثقة طفولية حية في محبة الآب ورعايته الفائقة، وطرح لكل الأثقال والهموم عند قدمي المخلص.",
      keyPoints: [
        "إدراك أن الله صانع خيرات ورحيم في جميع تدابيره وأحكامه اليومية.",
        "التدريب اليومي على قول: 'لتكن مشيئتك يا رب لا مشيئتي'، خاصة في الأوقات الصعبة.",
        "التحرر التام من القلق المرضي والخوف من المستقبل والمصاعب المتوقعة.",
        "تقديم الشكر الدائم في كل الظروف كبرهان عملي على صدق التسليم الروحي."
      ],
      fathersQuotes: [
        "«سلّم تدبير حياتك للرب، واسترح بالكامل من وطأة كثرة الهم والتفكير البشري المعيق.» — القديس باسيليوس الكبير",
        "«من يلقي بمركبته في تيار النعمة الإلهية الصادقة لن يخشى أبداً عواصف البحر.» — القديس يوحنا ذهبي الفم",
        "«الحياة الهادئة الخالية من الهموم هي بداية السلوك في مشيئة الله الحقة وطاعة روحه القدوس.» — البابا شنودة الثالث"
      ],
      verses: [
        "«عَلَى الرَّبِّ تَوَكَّلْ بِكُلِّ قَلْبِكَ، وَعَلَى فَهْمِكَ لاَ تَعْتَمِدْ.» (أمثال ٣: ٥)",
        "«مُلْقِينَ كُلَّ هَمِّكُمْ عَلَيْهِ، لأَنَّهُ هُوَ يَعْتَنِي بِكُمْ.» (١ بطرس ٥: ٧)",
        "«لِتَكُنْ لاَ مَشِيئَتِي بَلْ مَشِيئَتُكَ.» (لوقا ٢٢: ٤٢)"
      ],
      summary: "إن التسليم الروحي الصادق يبسط النفس ويملأ مخدع الصلاة طمأنينة وسلاماً، ويحول الصليب اليومي من ثقل متعب إلى بركة ونعمة متجددة لمجد اسم الله."
    };
  }
  
  if (normTitle.includes('صلاة') || normTitle.includes('الصلاة') || normTitle.includes('الجهاد')) {
    return {
      intro: "الصلاة هي نبض الحياة الروحية وحبل الوفاق المباشر بين المؤمن ومصدر الوجود والنور الفائق. بدون الصلاة والجهاد الصامت، تذبل كل الفضائل وتجف ينبوع النعمة في القلب ويصيبه صقيع الفتور. الصلاة هي السلاح الفعّال الذي يحصن النفس ويهب الخادم القوة للبذل والجهاد بفرح لا ينقطع.",
      keyPoints: [
        "أهمية الصلاة السهمية القصيرة المتكررة (صلاة يسوع) كحارس يقظ للفكر.",
        "تأسيس مذبح صلاة صامت في المخدع اليومي كركيزة أساسية للجهاد الروحي.",
        "مقاومة الفتور الروحي بالصبر والنهوض بعد كل سقطة بإرشاد حكيم.",
        "ربط الصلوات الفردية بذبيحة الإفخارستيا والقداسات والأسرار الكنسية."
      ],
      fathersQuotes: [
        "«الصلاة الحارة المتواضعة هي سور منيع ضد سهام العدو الملتهبة وحيله الخفية.» — القديس مار اسحق السرياني",
        "«صلاة واحدة نابعة من عمق قلب منكسر تعادل جهاد سنين طوال بغير صلاة.» — القديس أنطونيوس الكبير",
        "«الخادم الذي لا يحني ركبتيه بدموع لأجل مخدوميه، لا تملك كلماته قوة لجذب النفوس.» — القديس يوحنا ذهبي الفم"
      ],
      verses: [
        "«صَلُّوا بِلاَ انْقِطَاعٍ.» (١ تسالونيكي ٥: ١٧)",
        "«اِسْهَرُوا وَصَلُّوا لِكَيْ لاَ تَدْخُلُوا فِي تَجْرِبَةٍ.» (متى ٢٦: ٤١)",
        "«اِلْبَسُوا سِلاَحَ اللهِ الْكَامِلَ لِكَيْ تَقْدِرُوا أَنْ تَثْبُتُوا ضِدَّ مَكَايِدِ إِبْلِيسَ.» (أفسس ٦: ١١)"
      ],
      summary: "بالصلاة المتواترة والسهر الروحي تتقد حرارة المخدع ويتحول الجهاد من مجهود بشري جاف إلى شركة حب وشركة مجد وصداقة وثيقة مع المسيح مخلص نفوسنا."
    };
  }

  if (normTitle.includes('خدمة') || normTitle.includes('الخدمة') || normTitle.includes('الاتضاع') || normTitle.includes('القيادة') || normTitle.includes('خادم') || normTitle.includes('الخدام')) {
    return {
      intro: "الخدمة الكنسية في جوهرها هي امتداد لعمل المخلص الباذل الذي جاء 'لا ليُخدم بل ليخدم ويبذل نفسه فدية'. ليست الخدمة كرامة عالمية أو مكسباً بشرياً، بل هي انحناء متضع لغسل أرجل المخدومين بروح المسؤولية الصادقة. الخدمة الحقيقية تقتضي اختفاء الخادم الدائم ليشرق وجه المسيح وحده.",
      keyPoints: [
        "اقتناء منهج 'المغسلة والفوطة' في غسل أرجل المخدومين والتحلي بروح الاتضاع.",
        "تحمل مسؤولية رعاية النفوس المخدومة بأمانة بالغة ومثابرة واهتمام مستمر.",
        "الاعتماد الكامل على معونة وعمل الروح القدس، ونبذ الاتكال على الذات والخبرة الفردية.",
        "تقديم القدوة الصامتة في السلوك الشخصي كأقوى وسيلة للتعليم والتأثير الروحي."
      ],
      fathersQuotes: [
        "«من أراد أن يكون عظيماً، فليكن للكل خادماً متواضعاً من أعماق قلبه.» — القديس باسيليوس الكبير",
        "«أرض الاتضاع هي التربة الروحية الخصبة الوحيدة التي تثمر فيها مواهب الروح بغير غرور.» — القديس مار اسحق السرياني",
        "«الخادم الحقيقي هو من يحترق حباً لكي يرى مخدوميه ينمون في النعمة والقداسة.» — البابا كيرلس السادس"
      ],
      verses: [
        "«لأَنَّ ابْنَ الإِنْسَانِ أَيْضاً لَمْ يَأْتِ لِيُخْدَمَ بَلْ لِيَخْدُمَ وَلِيَبْذِلَ نَفْسَهُ فِدْيَةً عَنْ كَثِيرِينَ.» (مرقس ١٠: ٤٥)",
        "«مَنْ أَرَادَ أَنْ يَكُونَ فِيكُمْ أَوَّلاً فَلْيَكُنْ لَكُمْ عَبْداً.» (متى ٢٠: ٢٧)",
        "«كُنْ أَمِيناً إِلَى الْمَوْتِ فَسَأُعْطِيكَ إِكْلِيلَ الْحَيَاةِ.» (رؤيا ٢: ١٠)"
      ],
      summary: "إن بركة الخدمة تكمن في نقاوة دافعها واتضاع خادمها؛ وحيثما وجد الاتضاع والمحبة والخدمة الصامتة، انسابت النعمة والبركة بغزارة لنمو وخلاص النفوس."
    };
  }

  if (normTitle.includes('نمو') || normTitle.includes('النمو') || normTitle.includes('الحياة والنمو')) {
    return {
      intro: "النمو الروحي هو حركة حية مستمرة في اتجاه الكمال المسيحي ولا يعرف التوقف أو السكون. إن الكنيسة هي مشتل النفوس حيث ينمو المؤمن يوماً بعد يوم، ممداً جذوره في أسرار النعمة ومتغذياً بكلمة الإنجيل الطاهرة. النمو يحمي النفس من صقيع الفتور والتعود، ويحافظ على نضارة الحياة الروحية وسلامها الداخلي المتجدد.",
      keyPoints: [
        "المواظبة على وسائط الخلاص (الكتاب المقدس، التناول، الصوم، والاعتراف) كأقوات لازمة للنمو.",
        "التدرج الهادئ والمتزن في الممارسات الروحية تحت إرشاد وتوجيه أب اعتراف حكيم.",
        "مقاومة حروب اليأس والنهوض سريعاً بعد السقطات بفضل توبة متجددة ويقظة روهرية.",
        "تحويل ثمار النمو الروحي الداخلي إلى محبة عملية وعطاء مستمر تجاه الآخرين."
      ],
      fathersQuotes: [
        "«إن لم تكن تتقدم وتصعد في طريق الرب يوماً بعد يوم، فاعلم أنك تتراجع دون أن تشعر.» — القديس يوحنا كليماكوس",
        "«ينابيع النعمة تفيض بغير انقطاع، فاغرف منها قدر ما تشاء بصلواتك وتوبتك المستمرة.» — القديس مار اسحق السرياني",
        "«النمو الحقيقي يبدأ بدموع التوبة الصادقة في الخفاء وينتهي ببحار من سلام النور الإلهي الغامر.» — القديس غريغوريوس النيصي"
      ],
      verses: [
        "«وَلَكِنِ انْمُوا فِي النِّعْمَةِ وَفِي مَعْرِفَةِ رَبِّنَا وَمُخَلِّصِنَا يَسُوعَ الْمَسِيحِ.» (٢ بطرس ٣: ١٨)",
        "«الَّذِينَ يَزْرَعُونَ بِالدُّمُوعِ يَحْصُدُونَ بِالاِبْتِهَاجِ.» (مزمور ١٢٦: ٥)",
        "«أَنَا كَرْمَةٌ حَقِيقِيَّةٌ وَأَبِي الْكَرَّامُ... الَّذِي يَثْبُتُ فِيَّ وَأَنَا فِيهِ هَذَا يَأْتِي بِثَمَرٍ كَثِيرٍ.» (يوحنا ١٥: ١-٥)"
      ],
      summary: "النمو الروحي الحقيقي مسار يبدأ بالأمانة في القليل والصبر على الجهاد، واثقين بوعود الله الأمين الذي يكمل البدايات الضعيفة بمجد قياس قامة ملء المسيح."
    };
  }

  // --- FALLBACK GENERAL SPIRITUAL MATERIAL ---
  return {
    intro: "مرحباً بك في صفحة المواد الروحية وقراءة الكتب والتعاليم الروحية للمؤتمر. إن القراءة والتأمل الواعي في الإلهيات هما غذاء حقيقي للنفس وسلاح قوي ضد الفتور ومصاعب العصر وضغوطاته الصاخبة. خذ دقائق معدودة في هدوء تام وصمت مريح لتأمل هذه النقاط ومراجعتها بروح الصلاة والصمت لتشرق في قلبك طمأنينة الروح وسلام المسيح.",
    keyPoints: [
      "تخصيص وقت يومي للقراءة الهادئة والتأمل في كلمة الله المباركة ومبادئ الإنجيل السامية.",
      "تطبيق ما تسمعه وتتعلمه من محاضرات روحية في حياتك وسلوكك العملي ليكون قدوة حية.",
      "السعي المستمر لإشعال محبة الله الفائقة في القلب بالصلاة السهمية المتواترة والأفكار الإيجابية.",
      "الاتفاق الدائم مع مرشدك الروحي على برنامج قراءة متوازن يتوافق مع قامتك الروحية الحالية."
    ],
    fathersQuotes: [
      "«القراءة الروحية الهادئة تطرد الغفلة وتوقظ الذهن وتستدعي الدموع الساخنة وتدفئ القلب للصلاة الحارة.» — القديس مار اسحق السرياني",
      "«اجعل إنجيلك الصديق الأقرب إليك، ففيه تجد إجابة وافية لكل سؤال وضياء لكافة دروب السير.» — القديس أنطونيوس الكبير"
    ],
    verses: [
      "«سِرَاجٌ لِرِجْلِي كَلاَمُكَ وَنُورٌ لِسَبِيلِي.» (مزمور ١١٩: ١٠٥)",
      "«تَفَتَّشُوا الْكُتُبَ لأَنَّكُمْ تَظُنُّونَ أَنَّ لَكُمْ فِيهَا حَيَاةً أَبَدِيَّةً.» (يوحنا ٥: ٣٩)"
    ],
    summary: "إن التأمل المستمر والجهاد الواعي في القراءة يبنيان حصناً روحياً حول النفس يحميها من رياح التشكك والاضطراب، ويثبتان رجاءنا الأبدي صامداً وقوياً على الدوام."
  };
}

// --- SLIDE IMAGE RESOLVER ---
function getSlideImageUrl(prompt: string, presetStyle: string): string {
  const norm = (prompt || '').toLowerCase();
  if (norm.includes('صلاة') || norm.includes('صلوات') || norm.includes('prayer') || norm.includes('الأجبية')) {
    return 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=1200&q=80';
  }
  if (norm.includes('مسابقة') || norm.includes('كأس') || norm.includes('game') || norm.includes('trophy') || norm.includes('لعبة')) {
    return 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=80';
  }
  if (norm.includes('قوانين') || norm.includes('قانون') || norm.includes('rules') || norm.includes('بروتوكول') || norm.includes('تعليمات')) {
    return 'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=1200&q=80';
  }
  if (norm.includes('كنيسة') || norm.includes('قداس') || norm.includes('church') || norm.includes('منبر')) {
    return 'https://images.unsplash.com/photo-1438032005730-c779502df39b?auto=format&fit=crop&w=1200&q=80';
  }
  if (norm.includes('جبل') || norm.includes('خلوة') || norm.includes('nature') || norm.includes('mountain') || norm.includes('برية')) {
    return 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80';
  }
  
  if (presetStyle === 'golden') {
    return 'https://images.unsplash.com/photo-1518156677180-95a2893f3e9f?auto=format&fit=crop&w=1200&q=80';
  }
  if (presetStyle === 'sky') {
    return 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?auto=format&fit=crop&w=1200&q=80';
  }
  if (presetStyle === 'purple') {
    return 'https://images.unsplash.com/photo-1516550893923-42d28e5677af?auto=format&fit=crop&w=1200&q=80';
  }
  
  return 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1200&q=80';
}

// The «نبض المؤتمر» dashboard lived here: invented per-hour attendance and
// interaction counts for three days, plus a button that multiplied them by
// 1.25. Nothing in Pima measures either. It was computed on every render and
// never drawn — dead code presenting fabricated telemetry — so it is gone.
const CustomPulseTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const dataPoint = payload[0].payload;
    return (
      <div className="bg-slate-900/95 border border-purple-500/30 p-4 rounded-2xl shadow-xl text-right text-xs text-white space-y-2 max-w-[280px]" style={{ direction: 'rtl' }}>
        <p className="font-black text-amber-300 border-b border-white/10 pb-1 flex justify-between items-center gap-2">
          <span>{label}</span>
          <span className="text-[10px] font-bold bg-purple-900/60 text-purple-200 px-2 py-0.5 rounded-full">{dataPoint.activeUsers} حاضر 👤</span>
        </p>
        <p className="text-[11px] font-black leading-relaxed text-slate-100">
          📍 {dataPoint.activity}
        </p>
        <div className="pt-1.5 space-y-1 border-t border-white/5 text-[10px]">
          <p className="flex justify-between items-center text-emerald-400">
            <span>👤 الحضور النشط:</span>
            <span className="font-mono font-bold">{payload[0].value} مشترك</span>
          </p>
          <p className="flex justify-between items-center text-amber-400">
            <span>⚡ مستوى التفاعل العام:</span>
            <span className="font-mono font-bold">{payload[1]?.value || 0} عملية</span>
          </p>
        </div>
      </div>
    );
  }
  return null;
};

interface ActiveConferenceHubProps {
  currentUser: {
    id?: string;
    name: string;
    points?: number;
    organizationName?: string;
  };
  conference: ConferenceRoom;
  onLeave: () => void;
  onUpdateConference: (updated: ConferenceRoom) => void;
  onUpdateUser?: (updated: any) => void;
}

function ActiveConferenceHub({ currentUser, conference, onLeave, onUpdateConference, onUpdateUser }: ActiveConferenceHubProps) {
  // --- STATE FOR SERVANT MODE & CONFIGS ---
  // Who actually owns this room. Derived, never stored, so it cannot drift out
  // of step with the conference being displayed — and so the toggle below has
  // something to check rather than trusting whoever pressed it.
  const isHost = currentUser.id === conference.hostUserId;
  const [isServantMode, setIsServantMode] = useState(isHost);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);

  // --- STATE FOR INTERACTIVE GROUP GAMES ---
  const [activeView, setActiveView] = useState<'dashboard' | 'game_room'>('dashboard');
  const [gameRoomMode, setGameRoomMode] = useState<'selection' | 'create' | 'join' | 'active'>('selection');
  const [gameRoomRole, setGameRoomRole] = useState<'host' | 'participant' | undefined>(undefined);
  const [showJoinScanner, setShowJoinScanner] = useState(false);
  const [scannedJoinCode, setScannedJoinCode] = useState<string | undefined>(undefined);

  const handleApproveRequest = (reqUserId: string) => {
    const updated = {
      ...conference,
      pendingUserRequests: (conference.pendingUserRequests || []).filter(req => req.userId !== reqUserId),
      joinedUserIds: [...(conference.joinedUserIds || []), reqUserId]
    };
    onUpdateConference(updated);
    showToast('تمت الموافقة على طلب الانضمام بنجاح! 🎉');
  };

  const handleRejectRequest = (reqUserId: string) => {
    const updated = {
      ...conference,
      pendingUserRequests: (conference.pendingUserRequests || []).filter(req => req.userId !== reqUserId)
    };
    onUpdateConference(updated);
    showToast('تم رفض طلب الانضمام.');
  };

  const handleChangeCode = () => {
    const newCode = prompt('أدخل كود الغرفة الجديد (سهل وقصير):', conference.conferenceCode);
    if (!newCode) return;
    const cleanedCode = newCode.trim().toUpperCase();
    if (cleanedCode.length < 3) {
      alert('يجب أن يتكون الكود من ٣ أحرف أو أرقام على الأقل.');
      return;
    }
    onUpdateConference({
      ...conference,
      conferenceCode: cleanedCode
    });
    showToast(`تم تغيير كود الغرفة إلى ${cleanedCode} بنجاح! ✏️`);
  };

  const handleToggleDisabled = () => {
    const nextDisabled = !conference.isDisabled;
    onUpdateConference({
      ...conference,
      isDisabled: nextDisabled
    });
    showToast(nextDisabled ? 'تم تعطيل كود الغرفة مؤقتاً 🚫' : 'تم تفعيل كود الغرفة بنجاح! ✅');
  };

  const handleToggleRequirements = () => {
    const nextReq = conference.joiningRequirements === 'open' ? 'approval_needed' : 'open';
    onUpdateConference({
      ...conference,
      joiningRequirements: nextReq
    });
    showToast(nextReq === 'open' ? 'تم ضبط نظام الانضمام: مفتوح للجميع (مباشر) 🔓' : 'تم ضبط نظام الانضمام: بموافقة الخادم المشرف 🔐');
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(conference.conferenceCode);
    showToast('تم نسخ كود الغرفة إلى الحافظة! 📋');
  };

  const handleShareCode = () => {
    if (navigator.share) {
      navigator.share({
        title: conference.title,
        text: `انضم إلينا في غرفة المؤتمر الخاصة بـ ${conference.title} باستخدام الكود: ${conference.conferenceCode}`,
        url: window.location.href
      }).catch(() => {});
    } else {
      handleCopyCode();
    }
  };

  // --- 1. COUNTDOWN TIMER STATE (12 Days, 5 Hours, 22 Min, 10 Sec) ---
  // Counts to the booking's check-in (migration 125). It used to start at a
  // hardcoded 11d 5h 22m 10s and tick down from there — not early or late, but
  // counting to nothing, because a conference had no date at all.
  //
  // Recomputed from the clock every second rather than decremented: a
  // decrementing timer drifts, and stops being true the moment the phone sleeps
  // or the tab is backgrounded. A servant asking «كام يوم فاضل» would be told
  // whatever the counter happened to have reached.
  const remaining = (iso?: string) => {
    if (!iso) return null;
    const ms = new Date(`${iso}T00:00:00`).getTime() - Date.now();
    if (!Number.isFinite(ms) || ms <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    return {
      days: Math.floor(ms / 86400000),
      hours: Math.floor(ms / 3600000) % 24,
      minutes: Math.floor(ms / 60000) % 60,
      seconds: Math.floor(ms / 1000) % 60,
    };
  };
  const ZERO = { days: 0, hours: 0, minutes: 0, seconds: 0 };
  const [countdown, setCountdown] = useState(() => remaining(conference.startsAt) ?? ZERO);

  // How many nights the booking covers, and where today sits inside it. Both
  // chips beside the countdown used to be literals — «٣ أيام كاملة» for every
  // conference regardless of length, and «مباشر الآن» pulsing red on a retreat
  // that is still two weeks away.
  const nights = (() => {
    if (!conference.startsAt || !conference.endsAt) return null;
    const ms = new Date(`${conference.endsAt}T00:00:00`).getTime()
             - new Date(`${conference.startsAt}T00:00:00`).getTime();
    const n = Math.round(ms / 86400000);
    return n > 0 ? n : null;
  })();
  const arabicDays = (n: number) => {
    if (n === 1) return 'يوم واحد';
    if (n === 2) return 'يومين';
    if (n <= 10) return `${n.toLocaleString('ar-EG')} أيام`;
    return `${n.toLocaleString('ar-EG')} يوم`;
  };
  // Compared against the end of the last day, not its start: a conference that
  // finishes today is still running today.
  const phase: 'before' | 'during' | 'after' = (() => {
    if (!conference.startsAt) return 'before';
    const now = Date.now();
    if (now < new Date(`${conference.startsAt}T00:00:00`).getTime()) return 'before';
    if (conference.endsAt && now > new Date(`${conference.endsAt}T00:00:00`).getTime() + 86400000) return 'after';
    return 'during';
  })();

  useEffect(() => {
    const tick = () => setCountdown(remaining(conference.startsAt) ?? ZERO);
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conference.startsAt]);

  // --- PRESENTATION SLIDES STATES ---
  const [slides, setSlides] = useState<any[]>(conference.presentationSlides || []);
  const [activeSlideId, setActiveSlideId] = useState<string | null>(
    conference.activeSlideId || (conference.presentationSlides && conference.presentationSlides[0]?.id) || null
  );
  const [isFullscreenSlide, setIsFullscreenSlide] = useState(false);
  const [autoplaySlide, setAutoplaySlide] = useState(false);
  
  // Slide creation form states
  const [newSlideTitle, setNewSlideTitle] = useState('');
  const [newSlideContent, setNewSlideContent] = useState('');
  const [newSlideBgStyle, setNewSlideBgStyle] = useState('golden');
  const [newSlidePrompt, setNewSlidePrompt] = useState('');
  const [newSlideImageUrl, setNewSlideImageUrl] = useState('');
  const [isGeneratingSlideImage, setIsGeneratingSlideImage] = useState(false);

  // Instant alerts state
  const [instantAlertInput, setInstantAlertInput] = useState('');
  const [dismissedAlertId, setDismissedAlertId] = useState<string | null>(null);

  // Sync state if conference room changes
  useEffect(() => {
    if (conference.presentationSlides) {
      setSlides(conference.presentationSlides);
    } else {
      setSlides([]);
    }
    if (conference.activeSlideId) {
      setActiveSlideId(conference.activeSlideId);
    } else if (conference.presentationSlides && conference.presentationSlides.length > 0) {
      setActiveSlideId(conference.presentationSlides[0].id);
    } else {
      setActiveSlideId(null);
    }
  }, [conference]);

  // Autoplay slideshow handler
  useEffect(() => {
    let autoplayTimer: any;
    if (autoplaySlide && slides.length > 0) {
      autoplayTimer = setInterval(() => {
        const currentIndex = slides.findIndex(s => s.id === activeSlideId);
        const nextIndex = (currentIndex + 1) % slides.length;
        const nextSlide = slides[nextIndex];
        if (nextSlide) {
          setActiveSlideId(nextSlide.id);
          if (isServantMode) {
            onUpdateConference({
              ...conference,
              activeSlideId: nextSlide.id
            });
          }
        }
      }, 6000); // Transitions slides every 6 seconds
    }
    return () => {
      if (autoplayTimer) clearInterval(autoplayTimer);
    };
  }, [autoplaySlide, slides, activeSlideId, isServantMode, conference]);

  // Presentation action handlers
  const handleSelectActiveSlide = (slideId: string) => {
    setActiveSlideId(slideId);
    onUpdateConference({
      ...conference,
      activeSlideId: slideId
    });
    showToast('تم بث هذه الشريحة للمشاركين بنجاح! 📡');
  };

  const handleDeleteSlide = (slideId: string) => {
    const updatedSlides = slides.filter(s => s.id !== slideId);
    setSlides(updatedSlides);
    let nextActiveId = activeSlideId;
    if (activeSlideId === slideId) {
      nextActiveId = updatedSlides.length > 0 ? updatedSlides[0].id : null;
      setActiveSlideId(nextActiveId);
    }
    onUpdateConference({
      ...conference,
      presentationSlides: updatedSlides,
      activeSlideId: nextActiveId
    });
    showToast('تم حذف الشريحة بنجاح.');
  };

  const handleCreateSlide = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSlideTitle.trim() || !newSlideContent.trim()) return;

    setIsGeneratingSlideImage(true);
    
    // Simulate premium AI slide card generation
    setTimeout(() => {
      const promptKeyword = newSlidePrompt || newSlideTitle;
      const resolvedImg = newSlideImageUrl.trim() || getSlideImageUrl(promptKeyword, newSlideBgStyle);
      
      const newSlide = {
        id: 'slide_' + Date.now(),
        title: newSlideTitle.trim(),
        content: newSlideContent.trim(),
        imageUrl: resolvedImg
      };
      
      const updatedSlides = [...slides, newSlide];
      setSlides(updatedSlides);
      
      let nextActiveId = activeSlideId;
      if (!activeSlideId) {
        nextActiveId = newSlide.id;
        setActiveSlideId(newSlide.id);
      }
      
      onUpdateConference({
        ...conference,
        presentationSlides: updatedSlides,
        activeSlideId: nextActiveId || newSlide.id
      });
      
      setIsGeneratingSlideImage(false);
      showToast(newSlideImageUrl.trim() ? 'تمت إضافة الشريحة بالصورة المحددة بنجاح! 📸' : 'تم توليد وصناعة شريحة العرض بالذكاء الاصطناعي بنجاح! 🎨🎬');
      
      // Clear inputs
      setNewSlideTitle('');
      setNewSlideContent('');
      setNewSlidePrompt('');
      setNewSlideImageUrl('');
    }, 1500);
  };

  // --- 2. SCHEDULE STATE ---
  const [schedule, setSchedule] = useState<ConferenceScheduleItem[]>(conference.schedule || []);
  
  // --- READING MODE & LECTURE DETAIL STATES ---
  const [selectedLecture, setSelectedLecture] = useState<ConferenceScheduleItem | null>(null);
  const [isReadingMode, setIsReadingMode] = useState(false);
  const [readingTheme, setReadingTheme] = useState<'normal' | 'sepia' | 'dim' | 'night'>('normal');
  const [readingFontSize, setReadingFontSize] = useState<number>(18);
  const [blueLightFilter, setBlueLightFilter] = useState(false);
  const [readingProgress, setReadingProgress] = useState(0);

  const handleReadingScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    if (container.scrollHeight === container.clientHeight) {
      setReadingProgress(100);
      return;
    }
    const scrollPercent = (container.scrollTop / (container.scrollHeight - container.clientHeight)) * 100;
    setReadingProgress(Math.min(100, Math.max(0, scrollPercent)));
  };

  // Servant Add Schedule state
  const [newSchedTime, setNewSchedTime] = useState('');
  const [newSchedTitle, setNewSchedTitle] = useState('');
  const [newSchedLoc, setNewSchedLoc] = useState('');
  const [newSchedDur, setNewSchedDur] = useState('');
  const [newSchedSpeaker, setNewSchedSpeaker] = useState('');
  const [newSchedInfo, setNewSchedInfo] = useState('');

  const handleAddScheduleItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSchedTitle || !newSchedTime) return;
    const newItem = {
      id: Date.now().toString(),
      time: newSchedTime,
      title: newSchedTitle,
      location: newSchedLoc || 'القاعة الرئيسية',
      duration: newSchedDur || '60 دقيقة',
      speaker: newSchedSpeaker || 'غير محدد',
      info: newSchedInfo || 'لا يوجد تفاصيل إضافية.',
      completed: false,
      isCurrent: false
    };
    setSchedule([...schedule, newItem]);
    showToast('تمت إضافة الفعالية للجدول بنجاح! 🎉');
    // Clear form
    setNewSchedTime('');
    setNewSchedTitle('');
    setNewSchedLoc('');
    setNewSchedDur('');
    setNewSchedSpeaker('');
    setNewSchedInfo('');
  };

  const handleToggleCompleted = (id: string) => {
    setSchedule(prev => prev.map(item => item.id === id ? { ...item, completed: !item.completed } : item));
  };

  const handleSetCurrent = (id: string) => {
    setSchedule(prev => prev.map(item => ({ ...item, isCurrent: item.id === id })));
    const selected = schedule.find(item => item.id === id);
    if (selected) {
      setLiveMode(prev => ({
        ...prev,
        eventName: selected.title,
        speaker: selected.speaker,
        location: selected.location
      }));
    }
    showToast('تم تحديث الفعالية الجارية المباشرة بنجاح! 📡');
  };

  const handleDeleteScheduleItem = (id: string) => {
    setSchedule(prev => prev.filter(item => item.id !== id));
    showToast('تم حذف الفعالية من الجدول.');
  };

  // --- 3. EVENTS STATE (الفعاليات والمحطات) ---
  const [events, setEvents] = useState([
    { id: 'ev1', title: 'المسابقة الكتابية والطقسية الكبرى 📖', day: 'اليوم الأول', time: '04:00 م', icon: '🏆', points: 150 },
    { id: 'ev2', title: 'غرفة الألعاب الجماعية والتحديات التفاعلية ⚔️', day: 'اليوم الأول', time: '07:30 م', icon: '🎮', points: 200 },
    { id: 'ev3', title: 'سهرة الترانيم والتأملات الروحية الهادئة 🎶', day: 'اليوم الثاني', time: '09:00 م', icon: '🎻', points: 100 },
    { id: 'ev4', title: 'الرحلة الخارجية الاستكشافية لصحراء النطرون 🗺️', day: 'اليوم الثالث', time: '06:00 ص', icon: '🗺️', points: 300 },
  ]);

  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDay, setNewEventDay] = useState('اليوم الأول');
  const [newEventTime, setNewEventTime] = useState('');
  const [newEventPoints, setNewEventPoints] = useState(100);

  const handleAddEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle) return;
    const newEv = {
      id: Date.now().toString(),
      title: newEventTitle,
      day: newEventDay,
      time: newEventTime || 'مساءً',
      icon: '✨',
      points: Number(newEventPoints)
    };
    setEvents([...events, newEv]);
    showToast('تمت إضافة الفعالية بنجاح! 🌟');
    setNewEventTitle('');
    setNewEventTime('');
  };

  const handleDeleteEvent = (id: string) => {
    setEvents(prev => prev.filter(e => e.id !== id));
    showToast('تم إزالة الفعالية.');
  };

  // --- 4. ANNOUNCEMENTS STATE ---
  const [announcements, setAnnouncements] = useState<ConferenceAnnouncement[]>(conference.announcements || []);

  const [newAnnText, setNewAnnText] = useState('');
  const [newAnnUrgent, setNewAnnUrgent] = useState(false);
  const [newAnnPinned, setNewAnnPinned] = useState(false);
  const [commentsEnabled, setCommentsEnabled] = useState(true);
  
  // Comment entry state
  const [commentInput, setCommentInput] = useState<{ [key: string]: string }>({});

  const handleAddAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnText.trim()) return;
    const newAnn = {
      id: Date.now().toString(),
      text: newAnnText,
      isPinned: newAnnPinned,
      timestamp: 'الآن',
      isUrgent: newAnnUrgent,
      comments: []
    };
    
    // If pinned, insert at beginning, else after other pinned items
    if (newAnnPinned) {
      setAnnouncements([newAnn, ...announcements]);
    } else {
      setAnnouncements([...announcements, newAnn]);
    }
    showToast('تم إرسال الإعلان لجميع المشتركين بنجاح! 🔔');
    setNewAnnText('');
    setNewAnnUrgent(false);
    setNewAnnPinned(false);
  };

  const handleTogglePinAnnouncement = (id: string) => {
    setAnnouncements(prev => prev.map(ann => ann.id === id ? { ...ann, isPinned: !ann.isPinned } : ann));
  };

  const handleDeleteAnnouncement = (id: string) => {
    setAnnouncements(prev => prev.filter(ann => ann.id !== id));
    showToast('تم حذف الإعلان.');
  };

  const handleAddComment = (annId: string) => {
    const text = commentInput[annId];
    if (!text || !text.trim()) return;

    setAnnouncements(prev => prev.map(ann => {
      if (ann.id === annId) {
        return {
          ...ann,
          comments: [
            ...ann.comments,
            {
              id: Date.now().toString(),
              author: currentUser.name || 'مشارك مؤتمر',
              text: text,
              date: 'الآن'
            }
          ]
        };
      }
      return ann;
    }));

    setCommentInput(prev => ({ ...prev, [annId]: '' }));
    showToast('تم إضافة تعليقك بنجاح! 💬');
  };

  // --- 5. CHECKLIST STATE ---
  const [checklist, setChecklist] = useState<ConferenceChecklistItem[]>(conference.checklist || []);

  const [newChecklistItem, setNewChecklistItem] = useState('');

  const handleToggleChecklist = (id: string) => {
    setChecklist(prev => prev.map(item => item.id === id ? { ...item, checked: !item.checked } : item));
  };

  const handleAddChecklistItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChecklistItem.trim()) return;
    setChecklist([...checklist, {
      id: Date.now().toString(),
      label: newChecklistItem,
      checked: false
    }]);
    setNewChecklistItem('');
    showToast('تمت إضافة غرض جديد للقائمة ✨');
  };

  // --- 6. LIVE MODE STATE ---
  // Was a hardcoded lecture given by a named priest to 150 viewers, live in
  // every conference that had ever been opened. The column exists (122) and the
  // servant fills it; until they do, this is off, because a hub that announces
  // a session nobody is holding sends people to an empty hall.
  const [liveMode, setLiveMode] = useState({
    eventName: conference.liveMode?.eventName ?? '',
    speaker: conference.liveMode?.speaker ?? '',
    location: conference.liveMode?.location ?? '',
    minutesLeft: conference.liveMode?.minutesLeft ?? 0,
    viewersCount: conference.liveMode?.viewersCount ?? 0,
    isLive: conference.liveMode?.isLive ?? false,
  });

  // These three were seeded with invented messages signed «أبونا يوحنا»,
  // «مينا كمال» and «مريم عادل» — words put in a named priest's mouth, shown
  // to everyone who opened the chat. There is no chat backend yet, so this
  // stays local to the session and starts empty rather than starting a lie.
  const [liveChatMessages, setLiveChatMessages] = useState<{ id: string; author: string; text: string }[]>([]);
  const [newChatMessage, setNewChatMessage] = useState('');

  const handleSendLiveChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChatMessage.trim()) return;
    setLiveChatMessages([...liveChatMessages, {
      id: Date.now().toString(),
      author: currentUser.name || 'مشارك',
      text: newChatMessage
    }]);
    setNewChatMessage('');
  };

  // --- ANNOUNCEMENTS LOG ---
  // Migration 122 added conferences.notifications_log and this read the three
  // literals below instead — so every conference showed the same three
  // announcements, including a bus gathering «في السادسة مساءً» that nobody
  // had arranged, and anything the servant actually sent vanished on reload.
  const notificationsLog = conference.notificationsLog ?? [];
  const setNotificationsLog = (next: ConferenceRoom['notificationsLog']) =>
    onUpdateConference({ ...conference, notificationsLog: next });

  const [notificationInputTitle, setNotificationInputTitle] = useState('');
  const [notificationInputBody, setNotificationInputBody] = useState('');

  const handleSendSimulatedNotification = (e: React.FormEvent) => {
    e.preventDefault();
    if (!notificationInputTitle || !notificationInputBody) return;
    const newNotif = {
      id: Date.now().toString(),
      title: notificationInputTitle,
      body: notificationInputBody,
      // Stored as an instant, not as the words «مباشر الآن» — which is what it
      // used to save, so a week-old announcement still claimed to be live.
      time: new Date().toISOString(),
    };
    setNotificationsLog([newNotif, ...notificationsLog]);
    showToast(`اتبعت لكل المشتركين: ${notificationInputTitle} 🔔`);
    setNotificationInputTitle('');
    setNotificationInputBody('');
  };

  const handleSendInstantAlert = (e: React.FormEvent) => {
    e.preventDefault();
    if (!instantAlertInput.trim()) return;
    
    const newAlert = {
      id: 'alert_' + Date.now(),
      message: instantAlertInput.trim(),
      sentAt: Date.now(),
      senderName: currentUser.name || 'المنظم المشرف'
    };

    onUpdateConference({
      ...conference,
      instantAlert: newAlert
    });

    showToast('🚀 تم بث التنبيه العاجل لجميع شاشات الحضور الآن!');
    setInstantAlertInput('');
  };

  const handleClearInstantAlert = () => {
    onUpdateConference({
      ...conference,
      instantAlert: null
    });
    showToast('🧹 تم إلغاء وبث تنظيف التنبيه العاجل بنجاح.');
  };

  // Toast helper
  const showToast = (message: string) => {
    setSuccessToast(message);
    setTimeout(() => {
      setSuccessToast(null);
    }, 4000);
  };

  /* pima-play-wide is the PAGE container, and it belongs here rather than
     deeper in the tree. Three kinds of content live in this component and only
     one of them is page content:

       A. page content   — everything in normal flow below. Constrained here.
       B. modals         — four `fixed inset-0` overlays (842, 2680, 2766) keep
                           their own max-w-3xl / max-w-sm. Out of flow, so this
                           container cannot reach them, which is why the modal
                           behaviour is unchanged.
       C. full-bleed     — the presentation/slide view (2518) is also
                           `fixed inset-0`, so slides stay edge to edge.

     Without this, page content had NO width constraint at all and ran the full
     width of <main> — 1392px at a 1440 viewport, against 1160/1040 on every
     other Entertainment screen. Measured before/after (both RTL and LTR, which
     match because the container centres with margin-inline):

       vw  375   375 -> 375    unchanged   (mobile full-bleed preserved)
       vw  800   752 -> 752    unchanged   (cap does not bind below lg)
       vw 1280  1232 -> 1160   96.3% -> 90.6%
       vw 1440  1392 -> 1320   96.7% -> 91.7%

     The earlier .pima-play-mid inside the lecture modal is a separate thing and
     stays inert by design — see the note at its site. */
  return (
    <div className="pima-play-wide space-y-8 select-none" dir="rtl">
      {/* Toast Notification */}
      <AnimatePresence>
        {successToast && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-6 left-6 right-6 sm:left-auto sm:right-6 sm:w-96 bg-[#4C1D95] text-amber-200 border-2 border-amber-500/50 px-5 py-4 rounded-2xl shadow-2xl z-50 flex items-center gap-3"
          >
            <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-lg shrink-0">✨</div>
            <div>
              <p className="text-xs font-black leading-relaxed">{successToast}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Instant Urgent Alert Overlay Modal (تنبيه عاجل وفوري) */}
      <AnimatePresence>
        {conference.instantAlert && dismissedAlertId !== conference.instantAlert.id && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="alertdialog" aria-modal="true" aria-label="تنبيه عاجل" className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[20000] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 20, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="bg-gradient-to-br from-red-950 via-slate-900 to-black border-2 border-red-500/40 p-6 sm:p-8 rounded-[32px] shadow-2xl shadow-red-500/10 max-w-lg w-full text-center space-y-6 relative overflow-hidden"
            >
              {/* Animated glowing bg decoration */}
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent animate-pulse" />
              <div className="absolute -top-12 -left-12 w-32 h-32 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

              {/* Alert Icon and Pulsing Ring */}
              <div className="flex justify-center">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-red-500/20 animate-ping" />
                  <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500 text-3xl relative z-10">
                    <AlertTriangle className="w-8 h-8 text-red-500" />
                  </div>
                </div>
              </div>

              {/* Alert Title */}
              <div className="space-y-1">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-red-400 bg-red-500/10 px-3 py-1 rounded-full inline-block border border-red-500/20">
                  تنبيه عاجل وفوري من إدارة الخدمة ⚠️
                </span>
                <h3 className="text-lg sm:text-xl font-black text-white mt-3">رسالة طارئة ومباشرة حالياً</h3>
              </div>

              {/* Alert Message */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-right">
                <p className="text-sm sm:text-base font-bold text-amber-200 leading-relaxed text-center whitespace-pre-wrap">
                  {conference.instantAlert.message}
                </p>
              </div>

              {/* Sender & Time Info */}
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold border-t border-white/5 pt-4">
                <span>بواسطة: {conference.instantAlert.senderName}</span>
                <span>منذ: {new Date(conference.instantAlert.sentAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    playSound('click');
                    setDismissedAlertId(conference.instantAlert!.id);
                  }}
                  className="flex-1 bg-red-600 hover:bg-red-500 active:scale-95 text-white py-3.5 rounded-2xl text-xs font-black transition-all cursor-pointer shadow-lg shadow-red-500/20 flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>فهمت وموافق (تأكيد الانتباه) 👍</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {activeView === 'game_room' ? (
        <div className="space-y-4 text-right" dir="rtl">
          {/* Back button */}
          <div className="flex justify-start">
            <button
              onClick={() => setActiveView('dashboard')}
              className="flex items-center gap-1.5 text-xs font-black text-white bg-purple-900 hover:bg-purple-800 border border-purple-500/30 px-5 py-2.5 rounded-2xl transition-all cursor-pointer shadow-md active:scale-95"
            >
              <ArrowRight className="w-4 h-4 text-amber-300" />
              <span>العودة لمركز المؤتمر 🏰</span>
            </button>
          </div>

          <InteractiveRoom
            currentUser={currentUser as any}
            onBack={() => setActiveView('dashboard')}
            onUpdateUser={onUpdateUser || (() => {})}
            initialMode={gameRoomMode}
            initialRole={gameRoomRole}
            initialJoinCode={scannedJoinCode}
          />
        </div>
      ) : (
        <>
          {/* Leave Conference & Share QR Code Button */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <button 
          onClick={() => {
            playSound('click');
            onLeave();
          }}
          className="bg-white hover:bg-slate-50 text-slate-600 px-4 py-2 rounded-xl text-xs font-black transition-all border border-slate-200 shadow-sm flex items-center gap-2 cursor-pointer"
        >
          <ArrowRight className="w-4 h-4" />
          <span>الخروج من المؤتمر</span>
        </button>

        <button 
          onClick={() => {
            playSound('click');
            setShowShareModal(true);
          }}
          className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-xs font-black transition-all shadow-sm flex items-center gap-2 cursor-pointer border border-amber-400"
        >
          <QrCode className="w-4 h-4" />
          <span>عرض رمز QR للمشاركة 🔗</span>
        </button>
      </div>
      
{/* --- CROWN SERVANT ACCESS BUTTON --- */}
      {/* Host-only, and hidden rather than disabled: showing a participant a
          crown they can never press reads as a locked feature, when really it
          is simply somebody else's job. */}
      {isHost && (
      <div className="flex justify-between items-center gap-4 bg-purple-950/40 p-4 rounded-3xl border border-purple-500/20 shadow-md">
        <div className="flex items-center gap-2">
          <Crown className={`w-5 h-5 ${isServantMode ? 'text-amber-400 animate-pulse' : 'text-slate-400'}`} />
          <span className="text-[11px] font-black text-purple-200">صلاحيات الإشراف والخدمة الكنسية الخاصة 👑</span>
        </div>
        <button
          onClick={() => {
            playSound('click');
            // The toggle used to flip unconditionally, so anyone who opened a
            // conference could grant themselves the supervision panel by
            // pressing a button. Only the host may turn it on; for them it
            // stays a way to look at their own room as a participant sees it.
            if (!isHost) {
              showToast('لوحة الإشراف لمسؤول المؤتمر بس.');
              return;
            }
            setIsServantMode(!isServantMode);
            showToast(isServantMode ? 'تم تسجيل الخروج من وضع الخادم والعودة لوضع المشترك.' : 'مرحبًا بك يا خادم المسيح! تم تفعيل لوحة الإشراف وإرسال الإشعارات. 👑');
          }}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all duration-300 ${
            isServantMode 
              ? 'bg-amber-500 hover:bg-amber-600 text-purple-950 shadow-md' 
              : 'bg-purple-900/60 hover:bg-purple-900 text-amber-200 border border-amber-500/30'
          }`}
        >
          {isServantMode ? 'خروج من وضع المشرف' : 'تفعيل لوحة المنظم / الخادم'}
        </button>
      </div>
      )}


      {isServantMode && (
        <div className="bg-gradient-to-br from-[var(--ds-brand)] to-[#0D315C] rounded-[36px] p-6 sm:p-8 shadow-xl border border-blue-900/50 mb-6 relative overflow-hidden text-right">
          <div className="absolute -top-16 -right-16 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl"></div>
          <div className="relative z-10 flex flex-col md:flex-row gap-8 items-center md:items-start justify-between">
            
            <div className="flex-1 space-y-5 text-right w-full">
              <div className="flex items-center justify-end gap-2 mb-2">
                <h3 className="text-xl font-black text-amber-400">إدارة غرفة المؤتمر (كود الدعوة) 👑</h3>
                <div className={`px-3 py-1 text-[10px] font-black rounded-full border ${
                  conference.isDisabled 
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' 
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                }`}>
                  {conference.isDisabled ? '🚫 معطلة مؤقتاً' : '🟢 نشطة ومتاحة'}
                </div>
              </div>
              
              <div className="bg-slate-900/50 p-5 rounded-2xl border border-slate-700 flex flex-col sm:flex-row items-center justify-between shadow-inner gap-4">
                <div className="flex gap-2 w-full sm:w-auto order-last sm:order-first">
                  <button 
                    onClick={handleShareCode}
                    className="flex-1 sm:flex-none bg-amber-500 hover:bg-amber-600 text-[var(--ds-brand)] px-5 py-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                  >
                    <span>مشاركة</span>
                    <Send className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={handleCopyCode}
                    className="flex-1 sm:flex-none bg-slate-800 hover:bg-slate-700 text-white px-5 py-3 rounded-xl text-xs font-black transition-all border border-slate-600 cursor-pointer"
                  >
                    نسخ الكود 📋
                  </button>
                </div>
                <div className="flex flex-col items-center sm:items-end">
                  <span className="text-[10px] text-slate-400 font-bold mb-1">الكود التعريفي للغرفة</span>
                  <span className="text-3xl font-mono font-black text-white tracking-widest">{conference.conferenceCode}</span>
                </div>
              </div>
              
              <p className="text-xs text-slate-300 font-medium">شارك هذا الكود مع الخدام والمخدومين لتسهيل وصولهم المباشر للغرفة ومتابعة الفعاليات.</p>


              <div className="flex flex-wrap gap-2 pt-2 justify-end">
                 <button 
                   onClick={handleChangeCode}
                   className="text-[11px] bg-slate-800 border border-slate-600 text-slate-300 px-3 py-2 rounded-xl font-bold hover:bg-slate-700 transition-colors cursor-pointer"
                 >
                   تغيير الكود ✏️
                 </button>
                 <button 
                   onClick={handleToggleDisabled}
                   className={`text-[11px] border px-3 py-2 rounded-xl font-bold transition-colors cursor-pointer ${
                     conference.isDisabled 
                       ? 'bg-emerald-900/50 border-emerald-600/50 text-emerald-300 hover:bg-emerald-800' 
                       : 'bg-rose-900/50 border-rose-600/50 text-rose-300 hover:bg-rose-800'
                   }`}
                 >
                   {conference.isDisabled ? 'تفعيل الغرفة ✅' : 'تعطيل مؤقت 🚫'}
                 </button>
                 <button 
                   onClick={handleToggleRequirements}
                   className="text-[11px] bg-slate-800 border border-slate-600 text-slate-300 px-3 py-2 rounded-xl font-bold hover:bg-slate-700 transition-colors cursor-pointer"
                 >
                   نظام الانضمام: {conference.joiningRequirements === 'open' ? '🔓 مفتوح للجميع' : '🔐 بموافقة الخادم'}
                 </button>
              </div>

              {/* Pending requests sub-panel inside the organizer block */}
              {conference.pendingUserRequests && conference.pendingUserRequests.length > 0 && (
                <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-3 mt-4 text-right">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full animate-pulse">طلبات معلقة</span>
                    <h4 className="text-xs font-black text-amber-400">طلبات الانضمام لغرفتك ({conference.pendingUserRequests.length}) 📨</h4>
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {conference.pendingUserRequests.map(reqUser => (
                      <div key={reqUser.userId} className="flex items-center justify-between bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApproveRequest(reqUser.userId)}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                          >
                            موافقة ✅
                          </button>
                          <button
                            onClick={() => handleRejectRequest(reqUser.userId)}
                            className="bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-black px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                          >
                            رفض ❌
                          </button>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold text-white block">{reqUser.userName}</span>
                          <span className="text-[9px] text-slate-400">{reqUser.userEmail}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button type="button" aria-label="عرض رمز مشاركة المؤتمر" className="w-40 h-40 bg-white rounded-3xl p-3 shadow-lg flex items-center justify-center shrink-0 order-first md:order-last relative group cursor-pointer" onClick={() => setShowShareModal(true)}>
              <div className="w-full h-full border-4 border-[var(--ds-brand)] rounded-xl flex items-center justify-center bg-white relative overflow-hidden p-1.5">
                <QRCodeSVG value={conference.conferenceCode} size={115} level="H" includeMargin={false} />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-amber-500/20 to-transparent translate-y-[-100%] animate-[scan_2s_ease-in-out_infinite]" />
              </div>
              <div className="absolute -bottom-2 bg-slate-900 text-amber-400 text-[8px] font-black px-2 py-0.5 rounded-md shadow border border-slate-700">اضغط للتكبير 🔍</div>
            </button>

          </div>
        </div>
      )}

      {isServantMode && (
        <div className="mb-2">
          <ParticipantCardEditor currentUser={currentUser as any} />
        </div>
      )}

{/* ----------------- CORE PREMIUM CONFERENCE HUB HEADER ----------------- */}
      <div className="bg-gradient-to-br from-purple-950 via-[var(--color-play-conference-violet)] to-[var(--color-play-conference)] text-white p-6 sm:p-8 rounded-[36px] border-2 border-amber-500/40 shadow-2xl relative overflow-hidden">
        {/* Artistic luxury circular glow backdrops */}
        <div className="absolute -top-16 -left-16 w-56 h-56 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-16 w-72 h-72 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
        
        {/* Elegant traditional corner pattern line */}
        <div className="absolute top-0 right-0 left-0 h-[2px] bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
        
        <div className="flex flex-col lg:flex-row items-center gap-6 justify-between relative z-10">
          <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-right">
            {/* Visual Icon Badge */}
            <div className="relative group cursor-pointer shrink-0">
              <div className="absolute inset-0 bg-gradient-to-tr from-amber-400 to-amber-600 rounded-full blur-md opacity-40 group-hover:opacity-75 transition-opacity duration-300" />
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 border-amber-400 flex items-center justify-center bg-[var(--color-play-conference)] shadow-inner">
                <span className="text-3xl sm:text-4xl">🏰</span>
              </div>
            </div> 
            
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-3 py-1 rounded-full font-bold tracking-wide shadow-xs">
                  {/* Was «خلوة الشباب الروحية ٢٠٢٦», a literal. The hub greeted
                      every servant with somebody else's retreat while the real
                      conference the database had opened for their booking was
                      nowhere on the screen meant to be showing it. */}
                  {conference.title || 'مؤتمر جديد'} ⛰️
                </span>
                {(conference.organizationName || conference.houseName) && (
                  <span className="text-[10px] bg-purple-900/60 text-purple-200 border border-purple-500/30 px-3 py-1 rounded-full font-bold">
                    {conference.organizationName || conference.houseName}
                  </span>
                )}
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">مركز إدارة وتجربة المؤتمرات والفعاليات 🏆</h2>

              {/* The other side of the code. The host reads theirs out; anyone
                  who is not the host needs somewhere to spend one, and until
                  now there was nowhere — the code was printed and shared and
                  led nowhere. Hidden from the host, who cannot join their own
                  room and does not need the clutter. */}
              {currentUser.id !== conference.hostUserId && (
                <div className="pt-2">
                  <JoinConferenceCard onJoined={() => window.location.reload()} />
                </div>
              )}
              <p className="text-xs text-purple-200/80 leading-relaxed max-w-lg">
                مرحباً بك في المنصة الروحية المتكاملة لإدارة مؤتمراتك! هنا تجد كل تفاصيل الحجز، الجدول اليومي التفاعلي، الإعلانات الفورية، والعد التنازلي للتجمع المبارك.
              </p>
            </div>
          </div>

          {/* Core Info Stats Cards */}
          <div className="flex flex-wrap items-center justify-center gap-3 text-center">
            <div className="bg-purple-900/40 hover:bg-purple-900/60 border border-purple-500/20 px-4 py-3 rounded-2xl min-w-[90px] sm:min-w-[110px]">
              <span className="text-[9px] text-purple-300 block font-bold mb-1">المشتركين 👥</span>
              {/* Was the literal «٨٥ مشتركاً», which told a servant with nobody
                  in the room that eighty-five people were waiting. Joined out of
                  seats booked — both real, and the pair is the honest answer:
                  «٣ من ٧٦» says what «٨٥» never could. */}
              <span className="text-lg sm:text-xl font-black text-amber-300 font-mono">
                {conference.guestsCount
                  ? `${conference.joinedUserIds.length} من ${conference.guestsCount}`
                  : `${conference.joinedUserIds.length} منضم`}
              </span>
            </div>
            
            <div className="bg-purple-900/40 hover:bg-purple-900/60 border border-purple-500/20 px-4 py-3 rounded-2xl min-w-[90px] sm:min-w-[110px]">
              <span className="text-[9px] text-purple-300 block font-bold mb-1">المدة 📅</span>
              <span className="text-lg sm:text-xl font-black text-amber-300 font-mono">
                {nights ? arabicDays(nights) : '—'}
              </span>
            </div>

            <div className="bg-purple-900/40 hover:bg-purple-900/60 border border-purple-500/20 px-4 py-3 rounded-2xl min-w-[90px] sm:min-w-[110px]">
              <span className="text-[9px] text-purple-300 block font-bold mb-1">الوضع الجاري 📍</span>
              {phase === 'during' ? (
                <span className="text-[11px] font-black text-rose-400 block mt-1 animate-pulse">مباشر الآن 🟢</span>
              ) : phase === 'before' ? (
                <span className="text-[11px] font-black text-amber-300 block mt-1">لسه ما بدأش ⏳</span>
              ) : (
                <span className="text-[11px] font-black text-slate-400 block mt-1">انتهى ✅</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* --- MY CARD (بطاقتي) DIGITAL PARTICIPANT CARD --- */}
      <ParticipantCard currentUser={currentUser as any} />

      {/* --- COUNTDOWN TIMER BLOCK --- */}
      <div className="bg-gradient-to-r from-purple-950 to-[var(--color-play-conference-violet)] border-2 border-amber-500/30 p-5 rounded-3xl text-center space-y-3 relative overflow-hidden shadow-lg">
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl" />
        <h4 className="text-xs font-black text-amber-200 tracking-wider">⏱️ الوقت المتبقي حتى بداية الرحلة والتحرك بالبركة</h4>
        
        <div className="flex items-center justify-center gap-3 max-w-md mx-auto" dir="ltr">
          {/* Days */}
          <div className="bg-purple-900/80 border border-amber-500/30 p-3 rounded-2xl min-w-[65px] sm:min-w-[80px]">
            <span className="text-xl sm:text-2xl font-black text-white font-mono block">{String(countdown.days).padStart(2, '0')}</span>
            <span className="text-[9px] text-purple-300 font-bold uppercase tracking-wider">أيام (Days)</span>
          </div>
          <span className="text-lg font-black text-amber-400 animate-pulse">:</span>
          
          {/* Hours */}
          <div className="bg-purple-900/80 border border-amber-500/30 p-3 rounded-2xl min-w-[65px] sm:min-w-[80px]">
            <span className="text-xl sm:text-2xl font-black text-white font-mono block">{String(countdown.hours).padStart(2, '0')}</span>
            <span className="text-[9px] text-purple-300 font-bold uppercase tracking-wider">ساعة (Hrs)</span>
          </div>
          <span className="text-lg font-black text-amber-400 animate-pulse">:</span>
          
          {/* Minutes */}
          <div className="bg-purple-900/80 border border-amber-500/30 p-3 rounded-2xl min-w-[65px] sm:min-w-[80px]">
            <span className="text-xl sm:text-2xl font-black text-white font-mono block">{String(countdown.minutes).padStart(2, '0')}</span>
            <span className="text-[9px] text-purple-300 font-bold uppercase tracking-wider">دقيقة (Mins)</span>
          </div>
          <span className="text-lg font-black text-amber-400 animate-pulse">:</span>
          
          {/* Seconds */}
          <div className="bg-purple-900/80 border border-amber-500/30 p-3 rounded-2xl min-w-[65px] sm:min-w-[80px]">
            <span className="text-xl sm:text-2xl font-black text-rose-400 font-mono block">{String(countdown.seconds).padStart(2, '0')}</span>
            <span className="text-[9px] text-purple-300 font-bold uppercase tracking-wider">ثانية (Secs)</span>
          </div>
        </div>
      </div>



      {/* --- CONFERENCE DIGITAL INTERACTIVE GROUP GAMES --- */}
      <motion.div 
        whileHover={{ scale: 1.01, translateY: -2 }}
        transition={{ duration: 0.3 }}
        className="bg-gradient-to-br from-[var(--color-play-conference)] via-purple-950 to-[var(--color-play-conference-violet)] text-white rounded-[36px] p-6 sm:p-8 shadow-2xl relative overflow-hidden border-2 border-amber-500/40 text-right group"
      >
        {/* Glow ambient effects */}
        <div className="absolute bg-amber-500/10 w-64 h-64 rounded-full blur-[100px] -top-12 -right-12 pointer-events-none" />
        <div className="absolute bg-purple-500/15 w-80 h-80 rounded-full blur-[120px] -bottom-24 -left-24 pointer-events-none" />
        
        {/* Large Gamepad Icon in background */}
        <div className="absolute -left-10 -bottom-10 opacity-[0.05] pointer-events-none rotate-12 transition-transform duration-700 group-hover:rotate-6 group-hover:scale-105">
          <Gamepad2 className="w-72 h-72 text-amber-400" strokeWidth={1} />
        </div>

        <div className="relative z-10 space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
                <Gamepad2 className="w-8 h-8 text-[var(--color-play-conference)]" />
              </div>
              <div>
                <h4 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-2">
                  غرفة الألعاب الجماعية التفاعلية للمؤتمر ⚔️
                </h4>
                <p className="text-xs text-purple-200 font-bold mt-1">
                  تنافس فوري وتفاعلي مع الحاضرين في المسابقات والألعاب المسيحية
                </p>
              </div>
            </div>
            {/* Live Badge */}
            <div className="self-start sm:self-center">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-lg shadow-emerald-500/10 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>🟢 غرف الألعاب نشطة</span>
              </div>
            </div>
          </div>

          {/* Description */}
          <p className="text-xs sm:text-sm text-purple-100 leading-relaxed max-w-2xl font-medium">
            أنشئ غرفة ألعاب خاصة بمجموعتك في المؤتمر، ادعُ الحاضرين عبر رمز أو QR، كوّن فرقاً، وابدأ منافسات كنسية مباشرة مع لوحة نتائج لحظية، مؤقت ذكي، وأسئلة متزامنة لجميع اللاعبين.
          </p>

          {/* Premium Feature Chips Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
            {[
              { text: "👥 حتى 100 لاعب", color: "from-purple-900/40 to-purple-900/20 text-purple-200 border-purple-500/20" },
              { text: "⚡ نتائج مباشرة", color: "from-amber-500/10 to-amber-500/5 text-amber-200 border-amber-500/20" },
              { text: "🏆 ترتيب لحظي للمجموعات", color: "from-yellow-500/10 to-yellow-500/5 text-yellow-200 border-yellow-500/20" },
              { text: "⏱️ مؤقت تفاعلي ذكي", color: "from-indigo-500/10 to-indigo-500/5 text-indigo-200 border-indigo-500/20" }
            ].map((chip, idx) => (
              <div 
                key={idx} 
                className={`bg-gradient-to-br ${chip.color} border backdrop-blur-md rounded-xl px-3 py-2 flex items-center justify-center gap-1.5 text-[10px] sm:text-xs font-black shadow-xs`}
              >
                <span>{chip.text}</span>
              </div>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-purple-500/10">
            <button
              onClick={() => { 
                playSound('click');
                setGameRoomMode('create'); 
                setGameRoomRole('host'); 
                setActiveView('game_room'); 
              }}
              className="relative overflow-hidden bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 text-xs font-black px-8 py-3.5 rounded-2xl shadow-xl transition-all duration-300 hover:shadow-amber-500/20 hover:shadow-[0_0_20px_rgba(245,158,11,0.3)] flex items-center justify-center gap-2 cursor-pointer active:scale-95 flex-1"
            >
              <Gamepad2 className="w-5 h-5 relative z-10" />
              <span className="relative z-10">🎮 إنشاء غرفة ألعاب الآن</span>
            </button>
            
            <button
              onClick={() => {
                playSound('click');
                setScannedJoinCode(undefined);
                setGameRoomMode('join');
                setGameRoomRole('participant');
                setActiveView('game_room');
              }}
              className="relative overflow-hidden bg-white/5 hover:bg-white/10 text-white border border-purple-500/30 text-xs font-black px-8 py-3.5 rounded-2xl shadow-lg transition-all duration-300 hover:shadow-purple-500/10 hover:border-purple-500/50 flex items-center justify-center gap-2 cursor-pointer active:scale-95 flex-1"
            >
              <span className="relative z-10">🔗 الانضمام برمز اللعبة</span>
            </button>

            <button
              onClick={() => { playSound('click'); setShowJoinScanner(true); }}
              className="relative overflow-hidden bg-white/5 hover:bg-white/10 text-white border border-emerald-500/30 text-xs font-black px-8 py-3.5 rounded-2xl shadow-lg transition-all duration-300 hover:border-emerald-500/50 flex items-center justify-center gap-2 cursor-pointer active:scale-95 flex-1"
            >
              <QrCode className="w-5 h-5 relative z-10" />
              <span className="relative z-10">📷 امسح كود QR للانضمام</span>
            </button>
          </div>
        </div>
      </motion.div>

      {/* --- LIVE MODE & EVENT CURRENTLY HAPPENING --- */}
      {liveMode.isLive && (
        <div className="bg-gradient-to-r from-red-950 via-[var(--color-play-conference)] to-purple-950 border-2 border-red-500/40 p-5 rounded-3xl relative overflow-hidden shadow-lg">
          <div className="absolute top-0 left-0 bg-red-600 text-white text-[9px] font-black px-4 py-1.5 rounded-br-2xl flex items-center gap-1.5 animate-pulse z-15">
            <Radio className="w-3.5 h-3.5 animate-bounce" />
            <span>مباشر الآن / Live Mode 🔴</span>
          </div>
          
          <div className="flex flex-col md:flex-row items-center justify-between gap-5 pt-4 relative z-10 text-right">
            <div className="space-y-2">
              <h3 className="text-base font-black text-amber-200">{liveMode.eventName}</h3>
              <p className="text-xs text-purple-200/90 flex flex-wrap items-center gap-3">
                <span>🎤 المتحدث: <strong>{liveMode.speaker}</strong></span>
                <span className="text-purple-400">|</span>
                <span>📍 الموقع: <strong>{liveMode.location}</strong></span>
              </p>
              
              {/* Progress bar */}
              <div className="space-y-1 w-64 sm:w-80">
                <div className="flex justify-between text-[10px] text-purple-300 font-bold">
                  <span>الزمن المتبقي</span>
                  <span>{liveMode.minutesLeft} دقيقة</span>
                </div>
                <div className="h-2 bg-purple-900 rounded-full overflow-hidden border border-purple-500/10">
                  <div className="h-full bg-gradient-to-r from-red-500 to-amber-500 rounded-full" style={{ width: '40%' }}></div>
                </div>
              </div>
            </div>

            {/* Live chat feed. The «المشاهدين الحاليين» counter that sat here
                read a stored number, not a count — nothing in Pima tracks who
                is watching, so it was a figure the servant typed and everyone
                else read as measured. Removed rather than zeroed. */}
            <div className="bg-black/40 border border-purple-500/20 p-3 rounded-2xl w-full md:w-80 text-right space-y-2">
              <div className="flex items-center gap-1 text-[10px] text-purple-200 border-b border-purple-500/20 pb-1.5 font-bold">
                <Users className="w-3 h-3 text-red-400" />
                <span>الشات المباشر</span>
              </div>
              {liveChatMessages.length === 0 && (
                <p className="text-[10px] text-purple-300/60 py-2">لسه مفيش رسايل — ابدأ انت.</p>
              )}

              <div className="h-20 overflow-y-auto space-y-1.5 scrollbar-thin text-[10px] pr-1">
                {liveChatMessages.map(msg => (
                  <div key={msg.id} className="leading-tight">
                    <span className="font-black text-amber-300 ml-1">{msg.author}:</span>
                    <span className="text-purple-100">{msg.text}</span>
                  </div>
                ))}
              </div>

              {/* Chat Input */}
              <form onSubmit={handleSendLiveChatMessage} className="flex gap-1.5 mt-1.5">
                <input aria-label="أرسل مشاركة تشجيعية..."
                  type="text"
                  placeholder="أرسل مشاركة تشجيعية..."
                  value={newChatMessage}
                  onChange={(e) => setNewChatMessage(e.target.value)}
                  className="bg-purple-950/80 border border-purple-500/30 text-purple-100 text-[10.5px] rounded-xl px-2.5 py-1.5 flex-1 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                <button aria-label="إرسال الرسالة"
                  type="submit"
                  className="bg-amber-500 text-purple-950 p-1.5 rounded-xl hover:bg-amber-600 transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}


      {/* ================= CONFERENCE PRESENTATION SYSTEM (نظام العرض التقديمي للمؤتمرات) ================= */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="bg-[#0F172A] border-2 border-purple-500/30 p-6 rounded-[36px] space-y-6 text-right relative overflow-hidden shadow-xl"
      >
        {/* Glow Effects */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4 relative z-10">
          <div className="space-y-1">
            <h4 className="text-base sm:text-lg font-black text-amber-300 flex items-center justify-start gap-2">
              <Eye className="w-5 h-5 text-purple-400 animate-pulse" />
              <span>العرض التقديمي والشرائح للمؤتمرات 📽️🖥️</span>
            </h4>
            <p className="text-xs text-slate-300 font-medium">
              تابع المحاضرات والشرائح التوضيحية التي يعرضها المنظم مباشرة بوضع ملء الشاشة التفاعلي.
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            {autoplaySlide && (
              <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1 rounded-full animate-pulse font-bold">
                🔄 تشغيل تلقائي نشط
              </span>
            )}
            <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-3 py-1 rounded-full font-bold">
              📡 بث حي ومزامن
            </span>
          </div>
        </div>

        {/* Presenter Visualizer Box ("Hall Projector Screen") */}
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          
          {/* Left Column: Projector Display */}
          <div className="lg:col-span-8 flex flex-col justify-between bg-black/60 border border-slate-700/50 rounded-3xl overflow-hidden relative min-h-[300px] sm:min-h-[380px] shadow-inner group">
            
            {/* Active Slide Content */}
            {slides.length > 0 && activeSlideId ? (() => {
              const activeSlide = slides.find(s => s.id === activeSlideId) || slides[0];
              const slideIndex = slides.findIndex(s => s.id === activeSlide.id) + 1;
              return (
                <>
                  {/* Background Slide Image with fallback & overlay */}
                  <div className="absolute inset-0 z-0">
                    <img 
                      src={activeSlide.imageUrl} 
                      alt={activeSlide.title} 
                      className="w-full h-full opacity-30 group-hover:scale-105 transition-transform duration-1000 object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent" />
                  </div>

                  {/* Top bar indicators */}
                  <div className="relative z-10 p-4 flex justify-between items-center bg-black/30 backdrop-blur-xs border-b border-white/5">
                    <span className="text-[10px] bg-amber-500/10 text-amber-400 px-3 py-1 rounded-full font-black border border-amber-500/20 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-ping" />
                      الشريحة المعروضة حالياً
                    </span>
                    <span className="text-[11px] font-mono text-slate-400 font-bold">
                      {slideIndex} / {slides.length}
                    </span>
                  </div>

                  {/* Central Text/Content */}
                  <div className="relative z-10 p-6 sm:p-8 space-y-4 my-auto">
                    <motion.h2 
                      key={activeSlide.id + '_title'}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-xl sm:text-2xl font-black text-white leading-tight drop-shadow-md"
                    >
                      {activeSlide.title}
                    </motion.h2>
                    <motion.p 
                      key={activeSlide.id + '_content'}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      className="text-xs sm:text-sm text-slate-200 leading-relaxed max-w-xl font-medium drop-shadow-sm"
                    >
                      {activeSlide.content}
                    </motion.p>
                  </div>

                  {/* Bottom bar control action */}
                  <div className="relative z-10 p-4 bg-black/40 backdrop-blur-xs border-t border-white/5 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-[10px] text-slate-400">
                      📽️ معروض بجودة فائقة لجميع الحاضرين
                    </div>
                    <button
                      onClick={() => setIsFullscreenSlide(true)}
                      className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shadow-md shadow-purple-900/30 active:scale-95 flex items-center gap-1.5"
                    >
                      <span>توسيع لملء الشاشة 🖥️</span>
                    </button>
                  </div>
                </>
              );
            })() : (
              <div className="flex flex-col items-center justify-center p-8 text-center my-auto space-y-3 relative z-10">
                <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 text-2xl">📽️</div>
                <div className="space-y-1">
                  <p className="text-sm font-black text-slate-300">لا توجد شرائح عرض نشطة حالياً</p>
                  <p className="text-xs text-slate-400 max-w-sm">بانتظار أن يقوم المنظم بتشغيل وبث الشرائح التفاعلية للمؤتمر.</p>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Mini Sidebar Slider */}
          <div className="lg:col-span-4 flex flex-col bg-slate-900/40 border border-slate-700/40 p-4 rounded-3xl justify-between gap-4">
            <div className="space-y-3">
              <span className="text-[10px] text-slate-400 font-black block">قائمة شرائح المؤتمر 🎞️</span>
              
              <div className="space-y-2 max-h-[220px] sm:max-h-[290px] overflow-y-auto pr-1 text-right">
                {slides.map((s, idx) => {
                  const isSelected = s.id === activeSlideId;
                  return (
                    <button
                      type="button"
                      key={s.id}
                      onClick={() => handleSelectActiveSlide(s.id)}
                      className={`p-2.5 rounded-2xl border transition-all cursor-pointer flex gap-2.5 items-center relative overflow-hidden group ${
                        isSelected 
                          ? 'bg-purple-900/40 border-purple-500/50' 
                          : 'bg-black/30 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {/* Mini thumbnail */}
                      <div className="w-12 h-10 rounded-lg overflow-hidden shrink-0 bg-slate-800 relative">
                        <img src={s.imageUrl} alt="" className="w-full h-full object-cover opacity-60" referrerPolicy="no-referrer" />
                        <span className="absolute bottom-0 right-0 bg-black/60 text-[8px] font-mono font-bold text-slate-300 px-1.5 rounded-tl-md">
                          #{idx + 1}
                        </span>
                      </div>

                      {/* Info */}
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <span className={`text-[11px] font-black block truncate ${isSelected ? 'text-amber-300' : 'text-slate-200'}`}>
                          {s.title}
                        </span>
                        <span className="text-[9px] text-slate-400 block truncate font-medium">
                          {s.content}
                        </span>
                      </div>

                      {/* Active indicator badge */}
                      {isSelected && (
                        <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />
                      )}
                    </button>
                  );
                })}

                {slides.length === 0 && (
                  <p className="text-[10px] text-slate-400 py-6 text-center font-bold">لا يوجد شرائح مسجلة.</p>
                )}
              </div>
            </div>

            {/* Quick Helper */}
            <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800 text-[10px] text-slate-400 leading-relaxed font-medium">
              💡 اضغط على أي شريحة من القائمة لعرض تفاصيلها محلياً، وسيتم تحديث شاشتك بآخر شريحة يختارها المحاضر في القاعة.
            </div>
          </div>

        </div>

        {/* --- ORGANIZER'S EXCLUSIVE BOARD (لوحة تحكم خادم المنصة) --- */}
        {isServantMode && (
          <div className="bg-slate-900 border border-amber-500/20 rounded-3xl overflow-hidden shadow-2xl relative">
            {/* Header / Meta Bar */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-4 border-b border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                  <Crown className="w-5 h-5 text-amber-500" />
                </div>
                <div className="text-right">
                  <h3 className="text-sm font-black text-white">مركز قيادة المؤتمر 🚀</h3>
                  <p className="text-[10px] text-slate-400 font-bold">التحكم الحصري لمنظم العرض والبث المباشر</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setAutoplaySlide(!autoplaySlide);
                    showToast(autoplaySlide ? 'تم إيقاف التشغيل التلقائي للشرائح.' : 'تم تشغيل العرض التلقائي! سيتم تدوير الشرائح كل ٦ ثوانٍ 🔄');
                  }}
                  className={`px-4 py-1.5 rounded-xl text-[10px] font-black transition-all flex items-center gap-2 border ${
                    autoplaySlide 
                      ? 'bg-amber-500 border-amber-400 text-slate-950 shadow-lg' 
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  <span>{autoplaySlide ? 'إيقاف الأوتوبلاي' : 'تشغيل العرض التلقائي'}</span>
                  <div className={`w-2 h-2 rounded-full ${autoplaySlide ? 'bg-slate-950 animate-ping' : 'bg-slate-600'}`} />
                </button>
              </div>
            </div>

            <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* LIVE PREVIEW & NAVIGATION (Left Side) */}
              <div className="space-y-4">
                <div className="bg-black/60 border border-slate-800 p-4 rounded-2xl space-y-3 relative overflow-hidden h-full flex flex-col">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <div className="absolute inset-0 bg-emerald-500/20 animate-ping rounded-full" />
                        <div className="w-2 h-2 rounded-full bg-emerald-500 relative z-10" />
                      </div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Live Audience View</span>
                    </div>
                    {slides.length > 0 && activeSlideId && (
                      <span className="text-[10px] font-mono font-bold text-amber-400 bg-black px-2 py-0.5 rounded border border-white/5">
                        {slides.findIndex(s => s.id === activeSlideId) + 1} / {slides.length}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 flex flex-col justify-between">
                    {slides.length > 0 && activeSlideId ? (() => {
                      const activeSlide = slides.find(s => s.id === activeSlideId) || slides[0];
                      return (
                        <div className="flex-1 flex flex-col">
                          <div className="relative h-28 rounded-xl overflow-hidden bg-black/80 flex flex-col justify-end p-4 border border-white/5">
                            <div className="absolute inset-0 z-0">
                              <img 
                                src={activeSlide.imageUrl} 
                                alt="" 
                                className="w-full h-full opacity-20 grayscale object-cover"
                                referrerPolicy="no-referrer"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent" />
                            </div>
                            <div className="relative z-10 text-right space-y-0.5">
                              <h5 className="text-[11px] font-black text-white truncate">{activeSlide.title}</h5>
                              <p className="text-[9px] text-slate-400 line-clamp-1 font-bold">{activeSlide.content}</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 mt-3">
                            <button
                              onClick={() => {
                                const currentIndex = slides.findIndex(s => s.id === activeSlideId);
                                const prevIndex = (currentIndex - 1 + slides.length) % slides.length;
                                handleSelectActiveSlide(slides[prevIndex].id);
                              }}
                              className="bg-slate-800/50 hover:bg-slate-700 text-white py-2 rounded-xl text-[10px] font-black transition-all border border-white/5 flex items-center justify-center gap-2 cursor-pointer"
                            >
                              ◀️ السابق
                            </button>
                            <button
                              onClick={() => {
                                const currentIndex = slides.findIndex(s => s.id === activeSlideId);
                                const nextIndex = (currentIndex + 1) % slides.length;
                                handleSelectActiveSlide(slides[nextIndex].id);
                              }}
                              className="bg-slate-800/50 hover:bg-slate-700 text-white py-2 rounded-xl text-[10px] font-black transition-all border border-white/5 flex items-center justify-center gap-2 cursor-pointer"
                            >
                              التالي ▶️
                            </button>
                          </div>
                        </div>
                      );
                    })() : (
                      <div className="h-32 bg-black/40 border border-dashed border-slate-800 rounded-xl flex items-center justify-center">
                        <p className="text-[10px] font-bold text-slate-600 italic">بانتظار تفعيل أي شريحة عرض...</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* INSTANT ALERTS & URGENT BROADCAST (Right Side) */}
              <div className="space-y-4">
                <div className="bg-gradient-to-br from-rose-950/20 to-slate-950 border border-rose-500/20 p-4 rounded-2xl h-full flex flex-col justify-between">
                  <div className="space-y-1.5 text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <span className="text-[10px] font-black text-rose-300 uppercase tracking-widest">مركز التنبيهات العاجلة</span>
                      <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                    </div>
                    <p className="text-[9px] text-slate-400 font-bold">بث رسائل نصية عاجلة تظهر فوراً على شاشات جميع الحضور.</p>
                  </div>

                  <form onSubmit={handleSendInstantAlert} className="space-y-3 mt-4">
                    <div className="relative">
                      <input aria-label="ادخل نص التنبيه العاجل..."
                        type="text"
                        placeholder="ادخل نص التنبيه العاجل..."
                        value={instantAlertInput}
                        onChange={(e) => setInstantAlertInput(e.target.value)}
                        className="w-full bg-black/40 border border-rose-500/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500/50 transition-all text-right"
                        required
                      />
                      <div className="absolute left-3 top-1/2 -translate-y-1/2">
                        <AlertCircle className="w-4 h-4 text-rose-500/30" />
                      </div>
                    </div>
                    
                    <button
                      type="submit"
                      className="w-full bg-rose-600 hover:bg-rose-500 text-white py-3 rounded-xl text-[11px] font-black transition-all shadow-lg shadow-rose-950/40 flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer"
                    >
                      <Zap className="w-4 h-4" />
                      <span>إرسال التنبيه العاجل الآن</span>
                    </button>
                  </form>

                  {conference.instantAlert && (
                    <div className="mt-3 bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl flex items-center justify-between text-right">
                      <div className="flex items-center gap-2 truncate">
                        <div className="w-5 h-5 rounded-lg bg-rose-500/20 flex items-center justify-center text-[10px]">🚨</div>
                        <span className="text-[10px] font-bold text-rose-200 truncate italic">"{conference.instantAlert.message}"</span>
                      </div>
                      <button
                        onClick={handleClearInstantAlert}
                        className="text-[9px] font-black text-rose-400 hover:text-white transition-all bg-white/5 px-2 py-1 rounded-md cursor-pointer"
                      >
                        إلغاء
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Slide Management Grid (Expanded) */}
            <div className="bg-black/20 p-4 border-t border-white/5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Add Slide Form */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 justify-end">
                    <span className="text-[11px] font-black text-white">إضافة محتوى عرض جديد</span>
                    <PlusCircle className="w-4 h-4 text-emerald-400" />
                  </div>
                  <form onSubmit={handleCreateSlide} className="space-y-2 bg-black/40 p-3 rounded-2xl border border-white/5 text-right">
                    <input aria-label="عنوان الشريحة..."
                      type="text"
                      placeholder="عنوان الشريحة..."
                      value={newSlideTitle}
                      onChange={(e) => setNewSlideTitle(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-500/50 text-right"
                      required
                    />
                    <textarea aria-label="وصف المحتوى أو الآيات المستهدفة..."
                      placeholder="وصف المحتوى أو الآيات المستهدفة..."
                      value={newSlideContent}
                      onChange={(e) => setNewSlideContent(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-500/50 text-right"
                      rows={2}
                      required
                    />
                    
                    <div className="flex gap-2">
                      {newSlideTitle.trim() && (
                        <button
                          type="button"
                          onClick={() => {
                            const promptKeyword = newSlidePrompt || newSlideTitle;
                            const resolvedImg = getSlideImageUrl(promptKeyword, newSlideBgStyle);
                            setNewSlideImageUrl(resolvedImg);
                            showToast('تم اقتراح رابط صورة روحي ملائم للعنوان! 🔮');
                          }}
                          className="px-2 bg-purple-950/40 hover:bg-purple-900/40 text-purple-300 border border-purple-800/40 rounded-xl text-[10px] font-bold transition-all shrink-0 cursor-pointer"
                        >
                          🔮 AI Link
                        </button>
                      )}
                      <input aria-label="رابط الصورة (اختياري)..."
                        type="url"
                        placeholder="رابط الصورة (اختياري)..."
                        value={newSlideImageUrl}
                        onChange={(e) => setNewSlideImageUrl(e.target.value)}
                        className="flex-1 bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-[10px] text-white focus:outline-none focus:border-amber-500/50 text-right"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <select
                        aria-label="خلفية الشريحة" value={newSlideBgStyle}
                        onChange={(e) => setNewSlideBgStyle(e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-white ds-focus-on-brand"
                      >
                        <option value="golden">ذهبي كنسي ⚜️</option>
                        <option value="sky">سماء مرصعة 🌌</option>
                        <option value="purple">بنفسجي روحي 🕯️</option>
                      </select>
                      <input aria-label="كلمات مفتاحية للـ AI..."
                        type="text"
                        placeholder="كلمات مفتاحية للـ AI..."
                        value={newSlidePrompt}
                        onChange={(e) => setNewSlidePrompt(e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded-xl p-2 text-[10px] text-white ds-focus-on-brand text-right"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isGeneratingSlideImage}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 mt-1"
                    >
                      {isGeneratingSlideImage ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                          <span>توليد وإضافة الشريحة 🎨</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>

                {/* Slides List */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 justify-end">
                    <span className="text-[11px] font-black text-white">قائمة التحكم في البث المباشر</span>
                    <LayoutList className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="bg-black/40 border border-white/5 rounded-2xl p-2 h-[220px] overflow-y-auto space-y-1.5 custom-scrollbar">
                    {slides.map((s, idx) => (
                      <div key={s.id} className={`p-2 rounded-xl flex items-center justify-between group transition-all ${s.id === activeSlideId ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-slate-900/40 border border-white/5'}`}>
                        <div className="flex items-center gap-3 truncate">
                          <span className="text-[9px] font-mono text-slate-600">{idx + 1}</span>
                          <span className={`text-[10px] font-black truncate max-w-[120px] ${s.id === activeSlideId ? 'text-amber-400' : 'text-slate-400'}`}>{s.title}</span>
                        </div>
                        <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleSelectActiveSlide(s.id)}
                            className={`px-2 py-1 rounded-lg text-[9px] font-black transition-all cursor-pointer ${s.id === activeSlideId ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                          >
                            {s.id === activeSlideId ? '📡 معروض' : 'بث'}
                          </button>
                          <button aria-label="حذف الشريحة"
                            onClick={() => handleDeleteSlide(s.id)}
                            className="p-1.5 bg-rose-500/10 text-rose-500 rounded-lg hover:bg-rose-500/20 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {slides.length === 0 && (
                      <p className="text-[10px] text-slate-600 text-center py-8 italic">لا يوجد محتوى عرض حالياً.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* --- GRID OF SECTIONS --- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* ================= SECTION 1: THE COMPLETE SCHEDULE (الجدول الكامل) ================= */}
        <div className="lg:col-span-7 bg-white shadow-sm shadow-slate-200/50 border border-slate-100 p-5 rounded-3xl space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <div>
              <h4 className="text-xs font-black text-[var(--ds-brand)] flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-purple-600" />
                <span>الجدول اليومي والتسلسل الزمني للفعاليات 📅</span>
              </h4>
              <p className="text-[9.5px] text-slate-500 mt-0.5">تتبع المحاضرات، فترات الراحة، والمواعيد الرسمية للمؤتمر بدقة</p>
            </div>
            {isServantMode && (
              <span className="text-[9px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-black">وضع الخادم نشط</span>
            )}
          </div>

          {/* Interactive Schedule List */}
          <div className="space-y-3">
            {schedule.map((item, idx) => {
              return (
                <div 
                  key={item.id} 
                  className={`p-4 rounded-2xl border transition-all ${
                    item.completed 
                      ? 'bg-slate-50/70 border-slate-200 opacity-60' 
                      : item.isCurrent 
                        ? 'bg-purple-50/60 border-purple-400 shadow-sm relative overflow-hidden' 
                        : 'bg-[#FAF8F5]/80 border-slate-200/80 hover:border-slate-300'
                  }`}
                >
                  {item.isCurrent && (
                    <div className="absolute top-0 right-0 bg-purple-600 text-white text-[8px] font-black px-3 py-0.5 rounded-bl-xl">
                      الفعالية الجارية الآن ⚡
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1.5 text-right">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black font-mono ${
                          item.completed 
                            ? 'bg-slate-200 text-slate-600' 
                            : item.isCurrent 
                              ? 'bg-purple-200 text-purple-800' 
                              : 'bg-amber-100 text-amber-800'
                        }`}>
                          {item.time}
                        </span>
                        <h5 className={`text-[12px] font-black ${item.completed ? 'line-through text-slate-500' : 'text-[var(--ds-brand)]'}`}>
                          {item.title}
                        </h5>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-[var(--ds-accent)]" />
                          <span>الموقع: <strong>{item.location}</strong></span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-purple-500" />
                          <span>المدة: <strong>{item.duration}</strong></span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Crown className="w-3 h-3 text-amber-600" />
                          <span>المتحدث: <strong>{item.speaker}</strong></span>
                        </span>
                      </div>

                      <p className="text-[10px] text-slate-400 leading-relaxed mt-1">
                        {item.info}
                      </p>
                    </div>

                    {/* Interactive Action Buttons */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <button
                        onClick={() => {
                          setSelectedLecture(item);
                          setIsReadingMode(false);
                          setReadingProgress(0);
                        }}
                        className="bg-purple-600 hover:bg-purple-700 text-white text-[9.5px] font-black px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
                      >
                        <BookOpen className="w-3.5 h-3.5 text-amber-300" />
                        <span>متابعة المادة الروحية 📖</span>
                      </button>

                      {isServantMode ? (
                        <>
                          <button
                            onClick={() => handleToggleCompleted(item.id)}
                            className={`p-1.5 rounded-xl border transition-colors ${
                              item.completed 
                                ? 'bg-emerald-50 text-emerald-600 border-emerald-300' 
                                : 'bg-white text-slate-400 border-slate-200 hover:text-emerald-600 hover:border-emerald-300'
                            }`}
                            title="تحديد كمكتملة"
                          >
                            <CheckSquare className="w-4 h-4" />
                          </button>
                          
                          <button
                            onClick={() => handleSetCurrent(item.id)}
                            className={`px-2 py-1.5 rounded-xl text-[9px] font-black border transition-colors ${
                              item.isCurrent 
                                ? 'bg-purple-100 text-purple-800 border-purple-300' 
                                : 'bg-white text-slate-500 border-slate-200 hover:text-purple-600'
                            }`}
                          >
                            مباشر
                          </button>

                          <button
                            onClick={() => handleDeleteScheduleItem(item.id)}
                            className="p-1.5 bg-red-50 text-red-600 border border-red-200 rounded-xl hover:bg-red-100"
                            title="حذف"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        item.completed ? (
                          <span className="text-emerald-600 text-xs font-black flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> مكتملة
                          </span>
                        ) : item.isCurrent ? (
                          <span className="text-purple-600 text-[10px] font-black animate-pulse">مستمرة ⚡</span>
                        ) : null
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Servant Schedule Form */}
          {isServantMode && (
            <form onSubmit={handleAddScheduleItem} className="bg-amber-50/50 border border-amber-500/20 p-4 rounded-2xl space-y-3">
              <h5 className="text-[11px] font-black text-purple-950 flex items-center gap-1">
                <span>➕ إضافة فعالية أو محاضرة جديدة للجدول</span>
              </h5>
              <div className="grid grid-cols-2 gap-2">
                <input aria-label="الوقت (مثال: 02:00 م)"
                  type="text"
                  placeholder="الوقت (مثال: 02:00 م)"
                  value={newSchedTime}
                  onChange={(e) => setNewSchedTime(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl p-2 text-xs ds-focus"
                  required
                />
                <input aria-label="عنوان الفعالية"
                  type="text"
                  placeholder="عنوان الفعالية"
                  value={newSchedTitle}
                  onChange={(e) => setNewSchedTitle(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl p-2 text-xs ds-focus"
                  required
                />
                <input aria-label="مكان الانعقاد"
                  type="text"
                  placeholder="مكان الانعقاد"
                  value={newSchedLoc}
                  onChange={(e) => setNewSchedLoc(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl p-2 text-xs ds-focus"
                />
                <input aria-label="المدة (مثال: 45 دقيقة)"
                  type="text"
                  placeholder="المدة (مثال: 45 دقيقة)"
                  value={newSchedDur}
                  onChange={(e) => setNewSchedDur(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl p-2 text-xs ds-focus"
                />
                <input aria-label="المتحدث / المشرف"
                  type="text"
                  placeholder="المتحدث / المشرف"
                  value={newSchedSpeaker}
                  onChange={(e) => setNewSchedSpeaker(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl p-2 text-xs ds-focus col-span-2"
                />
              </div>
              <textarea aria-label="تفاصيل إضافية عن الفعالية..."
                placeholder="تفاصيل إضافية عن الفعالية..."
                value={newSchedInfo}
                onChange={(e) => setNewSchedInfo(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs ds-focus"
                rows={2}
              />
              <button
                type="submit"
                className="w-full bg-[var(--ds-brand)] text-white py-2 rounded-xl text-xs font-black hover:bg-[#0D315C] transition-colors cursor-pointer"
              >
                تحديث الجدول فوراً 💾
              </button>
            </form>
          )}
        </div>

        {/* ================= SECTION 2: SPECIAL EVENTS (الفعاليات الكبرى) ================= */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Active Events & Competitions */}
          <div className="bg-white shadow-sm shadow-slate-200/50 border border-slate-100 p-5 rounded-3xl space-y-4">
            <div>
              <h4 className="text-xs font-black text-[var(--ds-brand)] flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-purple-600" />
                <span>الفعاليات التنافسية والأنشطة ⚔️</span>
              </h4>
              <p className="text-[9.5px] text-slate-500 mt-0.5">مسابقات وأنشطة فرعية تزيد الحصيلة وتمنح نقاطاً كنسية مباركة</p>
            </div>

            <div className="space-y-2.5">
              {events.map(ev => (
                <div key={ev.id} className="p-3 bg-purple-50/40 border border-purple-500/10 rounded-2xl flex items-center justify-between gap-2.5 text-right">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl shrink-0">{ev.icon}</span>
                    <div className="space-y-0.5">
                      <span className="text-[11px] font-black text-[var(--ds-brand)] block">{ev.title}</span>
                      <span className="text-[9px] text-slate-400 block">🗓️ {ev.day} | ⏰ {ev.time}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[9px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold font-mono">+{ev.points} XP</span>
                    {isServantMode && (
                      <button aria-label="حذف الحدث"
                        onClick={() => handleDeleteEvent(ev.id)}
                        className="p-1 bg-red-50 text-red-600 rounded-lg border border-red-100 hover:bg-red-100"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Servant Add Event form */}
            {isServantMode && (
              <form onSubmit={handleAddEvent} className="bg-purple-50/50 border border-purple-500/20 p-3.5 rounded-2xl space-y-2">
                <h5 className="text-[10px] font-black text-purple-950">➕ إضافة فعالية كبرى جديدة</h5>
                <input aria-label="عنوان الفعالية (مثل: دوري كرة القدم)"
                  type="text"
                  placeholder="عنوان الفعالية (مثل: دوري كرة القدم)"
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs ds-focus"
                  required
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    aria-label="يوم الحدث" value={newEventDay}
                    onChange={(e) => setNewEventDay(e.target.value)}
                    className="bg-white border border-slate-200 rounded-xl p-2 text-xs ds-focus"
                  >
                    <option value="اليوم الأول">اليوم الأول</option>
                    <option value="اليوم الثاني">اليوم الثاني</option>
                    <option value="اليوم الثالث">اليوم الثالث</option>
                  </select>
                  <input aria-label="الوقت (مثال: 07:30 م)"
                    type="text"
                    placeholder="الوقت (مثال: 07:30 م)"
                    value={newEventTime}
                    onChange={(e) => setNewEventTime(e.target.value)}
                    className="bg-white border border-slate-200 rounded-xl p-2 text-xs ds-focus"
                  />
                </div>
                <input aria-label="النقاط الممنوحة (XP)"
                  type="number"
                  placeholder="النقاط الممنوحة (XP)"
                  value={newEventPoints}
                  onChange={(e) => setNewEventPoints(Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs ds-focus"
                />
                <button
                  type="submit"
                  className="w-full bg-purple-900 text-white py-1.5 rounded-xl text-xs font-black hover:bg-purple-950 transition-colors cursor-pointer"
                >
                  حفظ الفعالية الكبرى 💾
                </button>
              </form>
            )}
          </div>

          {/* Packing checklist */}
          <div className="bg-white shadow-sm shadow-slate-200/50 border border-slate-100 p-5 rounded-3xl space-y-4">
            <div>
              <h4 className="text-xs font-black text-[var(--ds-brand)] flex items-center gap-1.5">
                <CheckSquare className="w-4 h-4 text-[var(--ds-accent)]" />
                <span>قائمة التجهيزات والاحتياجات الشخصية 🧳</span>
              </h4>
              <p className="text-[9.5px] text-slate-500 mt-0.5">تأكد من إحضار كافة الأغراض والترتيبات لضمان راحتك في بيت الخلوة</p>
            </div>

            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              {checklist.map(item => (
                <button
                type="button"
                aria-pressed={item.checked}
                key={item.id}
                onClick={() => handleToggleChecklist(item.id)}
                  className={`p-2.5 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all ${
                    item.checked 
                      ? 'bg-emerald-50/50 border-emerald-200 text-slate-500 line-through' 
                      : 'bg-slate-50/80 border-slate-200 hover:border-slate-300 text-slate-700'
                  }`}
                >
                  {item.checked ? (
                    <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400 shrink-0" />
                  )}
                  <span className="text-[11px] font-bold leading-relaxed">{item.label}</span>
                </button>
              ))}
            </div>

            <form onSubmit={handleAddChecklistItem} className="flex gap-2 pt-1">
              <input aria-label="إضافة غرض شخصي آخر..."
                type="text"
                placeholder="إضافة غرض شخصي آخر..."
                value={newChecklistItem}
                onChange={(e) => setNewChecklistItem(e.target.value)}
                className="bg-[#FAF8F5]/80 border border-slate-200 rounded-xl px-3 py-2 text-xs flex-1 focus:outline-none focus:ring-1 focus:ring-[var(--ds-brand)]"
              />
              <button aria-label="إضافة عنصر للقائمة"
                type="submit"
                className="bg-[var(--ds-brand)] text-white p-2 rounded-xl hover:bg-[#0D315C] shrink-0"
              >
                <Plus className="w-4 h-4" />
              </button>
            </form>
          </div>

        </div>
      </div>

      {/* ================= SECTION 3: ANNOUNCEMENTS & EMERGENCY UPDATES (الإعلانات الفورية) ================= */}
      <div className="bg-white shadow-sm shadow-slate-200/50 border border-slate-100 p-5 rounded-3xl space-y-4">
        <div className="flex justify-between items-center border-b border-slate-150 pb-3">
          <div>
            <h4 className="text-xs font-black text-[var(--ds-brand)] flex items-center gap-1.5">
              <Bell className="w-4 h-4 text-purple-600 animate-swing" />
              <span>الإعلانات الرسمية والتنبيهات الفورية 📢</span>
            </h4>
            <p className="text-[9.5px] text-slate-500 mt-0.5">آخر المستجدات والتغييرات الهامة المنشورة مباشرة بواسطة منظمي المؤتمر</p>
          </div>
          <button
            onClick={() => setCommentsEnabled(!commentsEnabled)}
            className="text-[9px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-xl font-bold"
          >
            {commentsEnabled ? 'قفل التعليقات 🔒' : 'فتح التعليقات 🔓'}
          </button>
        </div>

        {/* Announcements Stream */}
        <div className="space-y-4">
          {announcements.map(ann => (
            <div 
              key={ann.id} 
              className={`p-4 rounded-2xl border relative transition-all ${
                ann.isPinned 
                  ? 'bg-amber-50/40 border-amber-300' 
                  : ann.isUrgent 
                    ? 'bg-rose-50/40 border-rose-300' 
                    : 'bg-slate-50/60 border-slate-200'
              }`}
            >
              {ann.isPinned && (
                <span className="absolute top-3 left-3 text-amber-600 flex items-center gap-0.5 text-[9px] font-black">
                  <Pin className="w-3 h-3 rotate-45" /> مثبت
                </span>
              )}

              <div className="space-y-2 text-right">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${ann.isUrgent ? 'bg-rose-500 animate-ping' : 'bg-amber-500'}`} />
                  <span className="text-[10px] text-slate-400 font-bold font-mono">{ann.timestamp}</span>
                  {ann.isUrgent && (
                    <span className="text-[8px] bg-rose-100 text-rose-700 font-extrabold px-1.5 py-0.5 rounded">هام جداً</span>
                  )}
                </div>

                <p className="text-xs font-bold leading-relaxed text-slate-800 whitespace-pre-line pl-6">
                  {ann.text}
                </p>

                {/* Interactive Servant actions */}
                {isServantMode && (
                  <div className="flex gap-2 pt-2 border-t border-slate-200/50">
                    <button
                      onClick={() => handleTogglePinAnnouncement(ann.id)}
                      className={`px-2.5 py-1 rounded text-[9px] font-black border transition-colors ${
                        ann.isPinned 
                          ? 'bg-amber-100 text-amber-800 border-amber-300' 
                          : 'bg-white text-slate-500 border-slate-200 hover:bg-amber-50'
                      }`}
                    >
                      {ann.isPinned ? 'إلغاء التثبيت 📍' : 'تثبيت الإعلان 📌'}
                    </button>
                    <button
                      onClick={() => handleDeleteAnnouncement(ann.id)}
                      className="px-2.5 py-1 bg-red-50 text-red-600 border border-red-200 rounded text-[9px] font-black hover:bg-red-100"
                    >
                      حذف الإعلان 🗑️
                    </button>
                  </div>
                )}

                {/* Comments block under announcement */}
                {commentsEnabled && (
                  <div className="mt-3 pt-3 border-t border-slate-150/60 space-y-2">
                    <span className="text-[9px] text-slate-400 font-bold block mb-1">تعليقات ومشاركات المشتركين 💬 ({ann.comments.length})</span>
                    
                    {ann.comments.length > 0 && (
                      <div className="space-y-1.5 max-h-40 overflow-y-auto bg-white/60 p-2 rounded-xl border border-slate-100">
                        {ann.comments.map(c => (
                          <div key={c.id} className="text-[10px] leading-relaxed">
                            <span className="font-extrabold text-[var(--ds-brand)] ml-1">{c.author}:</span>
                            <span className="text-slate-600">{c.text}</span>
                            <span className="text-[8px] text-slate-400 mr-2 font-mono">{c.date}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Submit Comment */}
                    <div className="flex gap-1.5 mt-2">
                      <input aria-label="اكتب استفسارًا أو مشاركة..."
                        type="text"
                        placeholder="اكتب استفسارًا أو مشاركة..."
                        value={commentInput[ann.id] || ''}
                        onChange={(e) => setCommentInput({ ...commentInput, [ann.id]: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleAddComment(ann.id);
                          }
                        }}
                        className="bg-white border border-slate-200 text-[10.5px] rounded-xl px-2.5 py-1.5 flex-1 focus:outline-none focus:ring-1 focus:ring-purple-500"
                      />
                      <button
                        onClick={() => handleAddComment(ann.id)}
                        className="bg-purple-900 text-white text-[10px] font-bold px-3 py-1.5 rounded-xl hover:bg-purple-950 transition-colors"
                      >
                        إرسال
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Servant post announcement form */}
        {isServantMode && (
          <form onSubmit={handleAddAnnouncement} className="bg-amber-50/50 border border-amber-500/20 p-4 rounded-2xl space-y-3">
            <h5 className="text-[11px] font-black text-purple-950 flex items-center gap-1">
              <span>➕ نشر إعلان أو تنبيه جديد للجميع</span>
            </h5>
            <textarea aria-label="اكتب التنبيه أو الإعلان هنا بوضوح ودقة..."
              placeholder="اكتب التنبيه أو الإعلان هنا بوضوح ودقة..."
              value={newAnnText}
              onChange={(e) => setNewAnnText(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs ds-focus"
              rows={3}
              required
            />
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newAnnUrgent}
                  onChange={(e) => setNewAnnUrgent(e.target.checked)}
                  className="rounded text-purple-600 focus:ring-purple-500"
                />
                <span>تحديد كأهمية قصوى (هام جداً ⚠️)</span>
              </label>
              <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-700 cursor-pointer">
                <input aria-label="تحديد كأهمية قصوى (هام جداً ⚠️)"
                  type="checkbox"
                  checked={newAnnPinned}
                  onChange={(e) => setNewAnnPinned(e.target.checked)}
                  className="rounded text-purple-600 focus:ring-purple-500"
                />
                <span>تثبيت الإعلان في الأعلى 📌</span>
              </label>
            </div>
            <button
              type="submit"
              className="w-full bg-[var(--ds-brand)] text-white py-2 rounded-xl text-xs font-black hover:bg-[#0D315C] transition-colors cursor-pointer"
            >
              بث الإعلان فورا وإخطار المشتركين 📡
            </button>
          </form>
        )}
      </div>

      {/* ================= SECTION 4: LOCATION & VENUE DETAILS (تفاصيل المكان) ================= */}
      <div className="bg-[var(--ds-bg)] border border-[#C5A059]/40 rounded-3xl p-5 space-y-4">
        <div>
          <h4 className="text-xs font-black text-[var(--ds-brand)] flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-[var(--ds-accent)]" />
            <span>تفاصيل بيت الخلوة ومقر المؤتمر 📍</span>
          </h4>
          <p className="text-[9.5px] text-slate-500 mt-0.5">عنوان البيت، ورقم مسؤول المؤتمر، وموعد الوصول</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          {/* Text descriptions */}
          <div className="md:col-span-7 space-y-3">
            <div className="p-4 bg-white rounded-2xl border border-slate-150 text-right space-y-2">
              <span className="text-[10px] text-slate-400 font-bold block">موقع بيت الخلوة السكني</span>
              <h5 className="text-sm font-black text-purple-950">🏡 {conference.houseName || 'بيت المؤتمر'}</h5>
              {/* Was a paragraph about air-conditioned halls, football pitches and
                  a secured pool at a house in وادي النطرون — printed over every
                  conference in the country. The address is the one thing here
                  that is actually true of this booking, so it is the only thing
                  shown, and nothing takes its place when it is missing. */}
              {(conference.houseAddress || conference.houseGovernorate) && (
                <p className="text-[10.5px] text-slate-500 leading-relaxed">
                  {[conference.houseAddress, conference.houseGovernorate].filter(Boolean).join('، ')}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 bg-white rounded-xl border border-slate-150 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center text-lg">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[8px] text-slate-400 block font-bold">رقم مسؤول المؤتمر</span>
                  {/* Was 0123456789 — a number that rings nobody, offered to
                      every group as their emergency contact. */}
                  <span className="text-xs font-black text-slate-800 font-mono" dir="ltr">
                    {conference.hostPhone || '—'}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-150 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center text-lg">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[8px] text-slate-400 block font-bold">موعد الوصول</span>
                  {/* Was «الجمعة 06:00 مساءً» on every conference. The booking
                      knows the day; it does not know an hour, so none is
                      invented — a wrong gathering time strands a bus. */}
                  <span className="text-xs font-black text-slate-800">
                    {conference.startsAt
                      ? new Date(`${conference.startsAt}T00:00:00`).toLocaleDateString('ar-EG', {
                          weekday: 'long', day: 'numeric', month: 'long',
                        })
                      : '—'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              {/* Opened maps.google.com — the home page, centred on wherever the
                  phone happens to be. Coordinates when the house has them,
                  otherwise a search for its name and governorate; and if there
                  is neither, no button, because a map button that lands nowhere
                  is worse than none. */}
              {(conference.houseLat != null && conference.houseLng != null) || conference.houseName ? (
                <button
                  onClick={() => {
                    const q = conference.houseLat != null && conference.houseLng != null
                      ? `${conference.houseLat},${conference.houseLng}`
                      : [conference.houseName, conference.houseAddress, conference.houseGovernorate]
                          .filter(Boolean).join(' ');
                    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`, '_blank');
                  }}
                  className="bg-[var(--ds-brand)] hover:bg-[#0D315C] text-white px-5 py-3 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2 flex-1 cursor-pointer"
                >
                  <Map className="w-4 h-4 text-amber-300" />
                  <span>فتح الخريطة على الجوال 🗺️</span>
                </button>
              ) : null}

              {conference.hostPhone && (
                <a
                  href={`tel:${conference.hostPhone}`}
                  className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 px-4 py-3 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Phone className="w-4 h-4 text-rose-500" />
                  <span>اتصال بالمسؤول</span>
                </a>
              )}
            </div>
          </div>

          {/* Simulated Premium Minimap component */}
          <div className="md:col-span-5 bg-gradient-to-br from-purple-950 via-[var(--color-play-conference)] to-slate-900 border border-purple-500/20 p-4 rounded-2xl flex flex-col items-center justify-center text-center relative overflow-hidden min-h-[220px]">
            {/* Visual Grid Map simulation */}
            <div className="absolute inset-0 opacity-15 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#C5A059 1.5px, transparent 1.5px)', backgroundSize: '15px 15px' }} />
            
            {/* Pulsing center point */}
            <div className="relative z-10 w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/40 mb-3">
              <div className="w-3 h-3 rounded-full bg-amber-400 animate-ping absolute" />
              <div className="w-3 h-3 rounded-full bg-amber-500 relative z-10" />
            </div>

            {/* Said «الكيلو 102 – وادي النطرون» under a decorative pin, plus a
                promise of air-conditioned coaches with guides that Pima does not
                arrange and cannot keep. The governorate and address are what we
                actually know. */}
            <div className="space-y-1 relative z-10">
              <span className="text-[9px] text-amber-300 font-extrabold uppercase tracking-widest block">
                {conference.houseGovernorate || 'الموقع'}
              </span>
              <h5 className="text-[12px] font-black text-white">{conference.houseName || '—'}</h5>
              {conference.houseAddress && (
                <p className="text-[9px] text-purple-200/70 max-w-[180px] mx-auto mt-1 leading-relaxed">
                  {conference.houseAddress}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ================= SECTION 5: PUSH NOTIFICATIONS HISTORY & INTEGRATION LOGS ================= */}
      <div className="bg-white shadow-sm shadow-slate-200/50 border border-slate-100 p-5 rounded-3xl space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h4 className="text-xs font-black text-[var(--ds-brand)] flex items-center gap-1.5">
              <Bell className="w-4 h-4 text-purple-600" />
              <span>أرشيف وسجل التنبيهات الذكية والمستجدات 📳</span>
            </h4>
            <p className="text-[9.5px] text-slate-500 mt-0.5">كل الإشعارات اللي مسؤول المؤتمر بعتها للمشتركين</p>
          </div>
          {isServantMode && (
            <span className="text-[9px] bg-slate-100 text-slate-700 px-2.5 py-1 rounded-xl font-extrabold">{notificationsLog.length} إشعار</span>
          )}
        </div>

        {/* List of past notifications */}
        {notificationsLog.length === 0 && (
          <p className="text-[10.5px] text-slate-400 text-center py-6">
            لسه مفيش إشعارات اتبعتت في المؤتمر ده.
          </p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {notificationsLog.map(notif => (
            <div key={notif.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-right space-y-1 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-24 h-24 bg-purple-500/5 rounded-full blur-xl pointer-events-none" />
              <div className="flex justify-between items-center">
                {/* Rows written before the timestamp fix hold a phrase, not a
                    date. Those are shown as they were saved rather than turned
                    into «Invalid Date». */}
                <span className="text-[8.5px] text-slate-400 font-bold font-mono">
                  {Number.isNaN(new Date(notif.time).getTime())
                    ? notif.time
                    : new Date(notif.time).toLocaleString('ar-EG', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                </span>
                <span className="text-xs">🔔</span>
              </div>
              <h5 className="text-[11.5px] font-black text-purple-950 mt-1">{notif.title}</h5>
              <p className="text-[10px] text-slate-500 leading-relaxed mt-1">
                {notif.body}
              </p>
            </div>
          ))}
        </div>

        {/* Servant post simulated notification */}
        {isServantMode && (
          <form onSubmit={handleSendSimulatedNotification} className="bg-purple-950/40 border border-amber-500/30 p-4 rounded-2xl space-y-3 mt-2">
            {/* Said «Push Notification لجميع الهواتف». Pima sends no phone
                pushes — this writes an announcement participants see when they
                open the hub, which is a useful thing and a different thing. */}
            <h5 className="text-[11px] font-black text-amber-200 flex items-center gap-1">
              <span>🔔 إشعار لكل المشتركين داخل التطبيق</span>
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input aria-label="عنوان الإشعار الفوري (مثال: باقي ساعة على التجمع!)"
                type="text"
                placeholder="عنوان الإشعار الفوري (مثال: باقي ساعة على التجمع!)"
                value={notificationInputTitle}
                onChange={(e) => setNotificationInputTitle(e.target.value)}
                className="bg-white border border-purple-500/20 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                required
              />
              <input aria-label="محتوى الإشعار وتفاصيله الموجهة..."
                type="text"
                placeholder="محتوى الإشعار وتفاصيله الموجهة..."
                value={notificationInputBody}
                onChange={(e) => setNotificationInputBody(e.target.value)}
                className="bg-white border border-purple-500/20 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full bg-amber-500 text-purple-950 py-2.5 rounded-xl text-xs font-black hover:bg-amber-600 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Bell className="w-4 h-4 text-purple-950" />
              <span>إرسال الإشعار 🚀</span>
            </button>
          </form>
        )}

        {/* Instant urgent alerts control - MOVED TO TOP */}
      </div>

      {/* ================= SECTION 6: SERVANT LIVE ATTENDANCE DASHBOARD (لوحة الإحصاءات والغياب) ================= */}
      {isServantMode && (
        <div className="bg-gradient-to-br from-purple-950 via-[#1e103f] to-slate-900 border-2 border-amber-500/30 p-5 rounded-3xl space-y-4">
          <div>
            <h4 className="text-xs font-black text-amber-200 flex items-center gap-1.5">
              <ShieldCheck className="w-5 h-5 text-amber-400" />
              <span>لوحة إحصائيات ونسب حضور المشتركين 📊 (صلاحيات الخادم)</span>
            </h4>
            <p className="text-[9.5px] text-purple-200/80 mt-0.5">تقارير كشف الغياب، توزيع الغرف، وسرعة حصر المشاركين بالـ QR والباركود</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-white/5 border border-purple-500/10 rounded-2xl text-right space-y-1">
              <span className="text-[8.5px] text-purple-300 block font-bold">إجمالي نسبة الحضور اليوم</span>
              <span className="text-xl font-black text-amber-300 block font-mono">94.8%</span>
              <div className="h-1.5 bg-purple-900/60 rounded-full overflow-hidden mt-2">
                <div className="h-full bg-amber-400 rounded-full" style={{ width: '94.8%' }}></div>
              </div>
            </div>

            <div className="p-4 bg-white/5 border border-purple-500/10 rounded-2xl text-right space-y-1">
              <span className="text-[8.5px] text-purple-300 block font-bold">الغرف والأسرة المحجوزة</span>
              <span className="text-xl font-black text-emerald-400 block font-mono">22 / 24 غرفة</span>
              <p className="text-[9px] text-purple-200/70 mt-1">✓ نسبة التسكين: 91.6%</p>
            </div>

            <div className="p-4 bg-white/5 border border-purple-500/10 rounded-2xl text-right space-y-1">
              <span className="text-[8.5px] text-purple-300 block font-bold">تسجيل الدخول الرقمي (Check-in)</span>
              <span className="text-xl font-black text-blue-400 block font-mono">81 / 85 مشارك</span>
              <p className="text-[9px] text-purple-200/70 mt-1">✓ مسح الـ QR عند ركوب الحافلة</p>
            </div>
          </div>
        </div>
      )}

      {/* Full-Screen Presentation Immersive Slideshow Modal */}
      <AnimatePresence>
        {isFullscreenSlide && slides.length > 0 && activeSlideId && (() => {
          const activeSlide = slides.find(s => s.id === activeSlideId) || slides[0];
          const slideIndex = slides.findIndex(s => s.id === activeSlide.id) + 1;
          return (
            <div role="dialog" aria-modal="true" aria-label="عرض الشرائح بملء الشاشة" className="fixed inset-0 bg-slate-950/98 backdrop-blur-2xl z-[10000] flex flex-col justify-between p-4 sm:p-8 select-none" dir="rtl">
              
              {/* Floating lights drift particle effects (magical visual polish) */}
              <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                {[...Array(15)].map((_, i) => {
                  const duration = 15 + (i % 5) * 4;
                  const delay = (i % 4) * 3;
                  const size = 4 + (i % 3) * 3;
                  const left = (i * 7) % 100;
                  return (
                    <div 
                      key={i} 
                      className="absolute bg-amber-400/25 rounded-full" 
                      style={{
                        width: `${size}px`,
                        height: `${size}px`,
                        left: `${left}%`,
                        bottom: `-5%`,
                        animation: `floatParticle ${duration}s linear infinite`,
                        animationDelay: `${delay}s`
                      }}
                    />
                  );
                })}
                
                {/* CSS for floatParticle directly injected inside a style block */}
                <style dangerouslySetInnerHTML={{__html: `
                  @keyframes floatParticle {
                    0% { transform: translateY(0) translateX(0); opacity: 0; }
                    10% { opacity: 0.4; }
                    90% { opacity: 0.4; }
                    100% { transform: translateY(-110vh) translateX(50px); opacity: 0; }
                  }
                `}} />
              </div>

              {/* Modal Header */}
              <div className="relative z-10 flex items-center justify-between bg-black/40 backdrop-blur-md p-4 rounded-3xl border border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-lg shrink-0">📽️</div>
                  <div className="text-right">
                    <h3 className="text-sm sm:text-base font-black text-white leading-none">{conference.title}</h3>
                    <p className="text-[10px] sm:text-xs text-slate-400 mt-1 font-medium">عرض توضيحي حي للمحاضرات والفعاليات</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Autoplay Slide status */}
                  {autoplaySlide && (
                    <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] bg-amber-500/10 text-amber-400 px-3 py-1 rounded-full border border-amber-500/20 animate-pulse font-bold">
                      🔄 تدوير تلقائي
                    </span>
                  )}
                  
                  <span className="text-xs font-mono font-black text-slate-300 bg-slate-800 px-4 py-1.5 rounded-full">
                    شريحة {slideIndex} من {slides.length}
                  </span>

                  <button
                    onClick={() => setIsFullscreenSlide(false)}
                    className="bg-red-600 hover:bg-red-700 text-white w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs font-black transition-all cursor-pointer shadow-md active:scale-95 shrink-0"
                    title="إغلاق ملء الشاشة"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Center Canvas: Immersive Display */}
              <div className="relative z-10 flex-1 flex flex-col md:flex-row items-center justify-center gap-6 max-w-6xl mx-auto w-full py-6">
                
                {/* Large visual card with split layout */}
                <div className="w-full bg-slate-900/60 border border-white/10 rounded-[36px] overflow-hidden shadow-2xl flex flex-col md:flex-row items-stretch max-h-[75vh] md:h-[550px] relative">
                  
                  {/* Right Half: Immersive Background / High quality theme image */}
                  <div className="md:w-1/2 min-h-[180px] md:min-h-0 bg-slate-950 relative overflow-hidden flex items-center justify-center">
                    <img 
                      src={activeSlide.imageUrl} 
                      alt="" 
                      className="absolute inset-0 w-full h-full opacity-50 object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-l from-slate-900 via-transparent to-transparent" />
                    
                    {/* Floating Cross icon or branding */}
                    <div className="relative z-10 p-6 text-center space-y-2">
                      <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-md mx-auto flex items-center justify-center text-2xl text-amber-300 shadow">⛪</div>
                      <span className="text-[10px] tracking-widest text-slate-300 font-bold uppercase block">Conference Presentation</span>
                    </div>
                  </div>

                  {/* Left Half: Pure Elegant typography */}
                  <div className="md:w-1/2 p-6 sm:p-10 flex flex-col justify-between text-right bg-slate-900/80 backdrop-blur-md relative">
                    {/* Decorative lights */}
                    <div className="absolute top-0 left-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl pointer-events-none" />
                    
                    <div className="space-y-6 my-auto">
                      <div className="space-y-1.5">
                        <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2.5 py-1 rounded-md font-bold inline-block">
                          📖 موضوع العرض الحالي
                        </span>
                        <h1 className="text-xl sm:text-3xl font-black text-amber-300 leading-tight">
                          {activeSlide.title}
                        </h1>
                      </div>

                      <p className="text-sm sm:text-base text-slate-200 leading-relaxed font-medium">
                        {activeSlide.content}
                      </p>
                    </div>

                    {/* Fell back to «الخادم المتحدث» in «قاعة الاجتماعات الكبرى»
                        — a speaker and a hall invented for a slide projected in
                        front of a room. Blank is honest; an empty row is not
                        drawn at all. */}
                    {(liveMode.speaker || liveMode.location) && (
                      <div className="text-[11px] text-slate-400 mt-6 border-t border-white/5 pt-4 flex justify-between items-center">
                        {liveMode.speaker ? <span>👤 المحاضر: <strong>{liveMode.speaker}</strong></span> : <span />}
                        {liveMode.location && <span>📍 الموقع: {liveMode.location}</span>}
                      </div>
                    )}
                  </div>

                </div>

              </div>

              {/* Footer navigation bars */}
              <div className="relative z-10 bg-black/40 backdrop-blur-md p-4 rounded-3xl border border-white/5 flex flex-wrap items-center justify-between gap-4 max-w-6xl mx-auto w-full">
                
                {/* Prev slide action */}
                <button
                  onClick={() => {
                    const currentIndex = slides.findIndex(s => s.id === activeSlideId);
                    const prevIndex = (currentIndex - 1 + slides.length) % slides.length;
                    setActiveSlideId(slides[prevIndex].id);
                  }}
                  className="bg-white/5 hover:bg-white/10 text-white px-6 py-3 rounded-2xl text-xs font-bold transition-all border border-white/10 cursor-pointer active:scale-95 flex items-center gap-1.5"
                >
                  ◀️ الشريحة السابقة
                </button>

                <div className="text-center text-xs text-slate-400 hidden sm:block">
                  📽️ اضغط على الأسهم للتبديل، أو استرخِ لمتابعة البث الحي التلقائي للشرائح مع المحاضر.
                </div>

                {/* Next slide action */}
                <button
                  onClick={() => {
                    const currentIndex = slides.findIndex(s => s.id === activeSlideId);
                    const nextIndex = (currentIndex + 1) % slides.length;
                    setActiveSlideId(slides[nextIndex].id);
                  }}
                  className="bg-white/5 hover:bg-white/10 text-white px-6 py-3 rounded-2xl text-xs font-bold transition-all border border-white/10 cursor-pointer active:scale-95 flex items-center gap-1.5"
                >
                  الشريحة التالية ▶️
                </button>

              </div>

            </div>
          );
        })()}
      </AnimatePresence>

      {/* Share QR Code Modal */}
      <AnimatePresence>
        {showShareModal && (
          <div role="dialog" aria-modal="true" aria-label="مشاركة رمز الدخول" className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-[32px] max-w-sm w-full p-6 text-center space-y-5 shadow-2xl border border-slate-100 relative overflow-hidden"
            >
              {/* Decorative radial gradients */}
              <div className="absolute -top-12 -left-12 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="space-y-1">
                <h3 className="text-lg font-black text-[var(--ds-brand)] leading-tight">{conference.title}</h3>
                <p className="text-xs text-slate-500 font-bold">{conference.organizationName}</p>
              </div>

              {/* Real QR Code rendering */}
              <div className="bg-slate-50 border border-slate-100 p-5 rounded-3xl inline-flex items-center justify-center shadow-inner relative group">
                <div className="bg-white p-4 rounded-2xl shadow border border-slate-200">
                  <QRCodeSVG 
                    value={conference.conferenceCode} 
                    size={170} 
                    level="H" 
                    includeMargin={false}
                  />
                </div>
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-amber-500/10 to-transparent translate-y-[-100%] animate-[scan_2.5s_ease-in-out_infinite] pointer-events-none rounded-3xl" />
              </div>

              {/* Invitation Code */}
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 font-black block">كود الدعوة السريع للغرفة</span>
                <div className="text-xl font-mono font-black text-[var(--ds-brand)] tracking-widest bg-slate-100 py-2 px-6 rounded-xl border border-slate-200/60 inline-block">
                  {conference.conferenceCode}
                </div>
              </div>

              <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                امسح الرمز بكاميرا الموبايل أو أرسل الكود مباشرة لأصدقائك في الخدمة للانضمام التلقائي لغرفة المؤتمر ومتابعة الفعاليات والتنبيهات.
              </p>

              {/* Dialog buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(conference.conferenceCode);
                    showToast('تم نسخ كود المؤتمر بنجاح! 📋');
                  }}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-[var(--ds-brand)] py-3 rounded-2xl text-xs font-black transition-all cursor-pointer"
                >
                  نسخ الكود 📋
                </button>
                <button
                  onClick={() => setShowShareModal(false)}
                  className="flex-1 bg-[var(--ds-brand)] hover:bg-[#0D315C] text-white py-3 rounded-2xl text-xs font-black transition-all cursor-pointer"
                >
                  إغلاق ✕
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Camera QR scanner — scan a host's game-room QR to join instantly */}
      {showJoinScanner && (
        <QRScanner
          title="امسح كود غرفة الألعاب"
          hint="وجّه الكاميرا نحو رمز QR المعروض على شاشة الخادم للانضمام"
          onClose={() => setShowJoinScanner(false)}
          onScan={(text) => {
            const m = text.match(/\d{6}/);
            setShowJoinScanner(false);
            if (m) {
              setScannedJoinCode(m[0]);
              setGameRoomMode('join');
              setGameRoomRole('participant');
              setActiveView('game_room');
            }
          }}
        />
      )}

      {/* Lecture Details and Reading Mode Modal */}
      <AnimatePresence>
        {selectedLecture && (
          <div role="dialog" aria-modal="true" aria-label="تفاصيل المحاضرة والقراءة" className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[1000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.95 }}
              className={`w-full max-w-3xl rounded-[32px] shadow-2xl border flex flex-col overflow-hidden h-[90vh] transition-colors duration-300 relative ${
                readingTheme === 'normal' ? 'bg-[var(--ds-bg)] text-[var(--ds-brand)] border-slate-200' :
                readingTheme === 'sepia' ? 'bg-[#FAF4EB] text-[#3D2F20] border-[#E8DEC9]' :
                readingTheme === 'dim' ? 'bg-[#1E2022] text-[#E0E0E0] border-[#2D3033]' :
                'bg-[#0F172A] text-[#CBD5E1] border-[#1E293B]'
              }`}
            >
              {/* Reading Progress Indicator */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-slate-200/20 z-50">
                <div 
                  className="h-full bg-amber-500 transition-all duration-150" 
                  style={{ width: `${readingProgress}%` }}
                />
              </div>

              {/* Blue Light Eye-Protection Filter simulation Overlay */}
              {blueLightFilter && (
                <div className="absolute inset-0 bg-amber-500/5 mix-blend-multiply pointer-events-none z-40 rounded-[32px]" />
              )}

              {/* Header / Control Bar */}
              <div className={`p-5 border-b flex flex-wrap gap-4 items-center justify-between z-30 transition-colors ${
                readingTheme === 'normal' ? 'bg-[#F1ECE4]/60 border-slate-200/80' :
                readingTheme === 'sepia' ? 'bg-[#F2E6D1]/80 border-[#E8DEC9]' :
                readingTheme === 'dim' ? 'bg-[#292B2D] border-[#3D4043]' :
                'bg-[#1E293B] border-[#334155]'
              }`}>
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-xl ${isReadingMode ? 'bg-amber-500/20 text-amber-500' : 'bg-purple-600/10 text-purple-600'}`}>
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div className="text-right">
                    <h3 className="text-sm font-black tracking-tight flex items-center gap-1.5">
                      <span>{selectedLecture.title}</span>
                    </h3>
                    <p className={`text-[10px] font-bold ${readingTheme === 'night' || readingTheme === 'dim' ? 'text-slate-400' : 'text-slate-500'}`}>
                      {isReadingMode ? 'وضع القراءة النشط والمحمي 👁️✨' : 'تفاصيل المحاضرة والمادة الروحية الكنسية'}
                    </p>
                  </div>
                </div>

                {/* Controls Panel */}
                <div className="flex items-center flex-wrap gap-2.5">
                  {/* Theme Selectors */}
                  <div className="flex items-center gap-1 bg-black/10 rounded-xl p-1">
                    <button
                      onClick={() => setReadingTheme('normal')}
                      className={`text-[9.5px] px-2 py-1 rounded-lg font-black transition-all ${readingTheme === 'normal' ? 'bg-white text-[var(--ds-brand)] shadow-xs' : 'text-slate-400 hover:text-slate-200'}`}
                      title="النمط الطبيعي الأبيض"
                    >
                      عادي
                    </button>
                    <button
                      onClick={() => setReadingTheme('sepia')}
                      className={`text-[9.5px] px-2 py-1 rounded-lg font-black transition-all ${readingTheme === 'sepia' ? 'bg-[#FAF4EB] text-[#3D2F20] shadow-xs border border-[#E8DEC9]' : 'text-amber-600 hover:text-amber-500'}`}
                      title="نمط ورق البردي الدافئ"
                    >
                      بِرْدي
                    </button>
                    <button
                      onClick={() => setReadingTheme('dim')}
                      className={`text-[9.5px] px-2 py-1 rounded-lg font-black transition-all ${readingTheme === 'dim' ? 'bg-[#1E2022] text-[#E0E0E0] shadow-xs' : 'text-slate-400 hover:text-slate-200'}`}
                      title="نمط خافت لراحة العين"
                    >
                      خافت
                    </button>
                    <button
                      onClick={() => setReadingTheme('night')}
                      className={`text-[9.5px] px-2 py-1 rounded-lg font-black transition-all ${readingTheme === 'night' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'}`}
                      title="الوضع الليلي الكامل"
                    >
                      ليلي
                    </button>
                  </div>

                  {/* Font Size Adjusters */}
                  <div className="flex items-center gap-1 bg-black/10 rounded-xl p-1">
                    <button
                      onClick={() => setReadingFontSize(prev => Math.max(14, prev - 2))}
                      className="p-1 text-[11px] font-black hover:bg-white/10 rounded-lg w-6 h-6 flex items-center justify-center transition-colors cursor-pointer"
                      title="تصغير الخط"
                    >
                      أ-
                    </button>
                    <span className="text-[10px] font-black px-1 min-w-[28px] text-center font-mono">{readingFontSize}px</span>
                    <button
                      onClick={() => setReadingFontSize(prev => Math.min(30, prev + 2))}
                      className="p-1 text-[11px] font-black hover:bg-white/10 rounded-lg w-6 h-6 flex items-center justify-center transition-colors cursor-pointer"
                      title="تكبير الخط"
                    >
                      أ+
                    </button>
                  </div>

                  {/* Eye Filter Selector */}
                  <button
                    onClick={() => setBlueLightFilter(!blueLightFilter)}
                    className={`p-1.5 rounded-xl border text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                      blueLightFilter 
                        ? 'bg-amber-500 text-white border-amber-400 shadow-xs' 
                        : 'bg-black/10 text-slate-400 border-transparent hover:bg-white/10'
                    }`}
                    title="حماية العين من الإشعاع الأزرق"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">درع العين 🛡️</span>
                  </button>

                  {/* Immersive Reading Toggle */}
                  <button
                    onClick={() => setIsReadingMode(!isReadingMode)}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black flex items-center gap-1 transition-all cursor-pointer ${
                      isReadingMode 
                        ? 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700' 
                        : 'bg-purple-600 text-white hover:bg-purple-700'
                    }`}
                  >
                    <span>{isReadingMode ? 'بيانات عامة 🔍' : 'وضع القراءة 📖'}</span>
                  </button>
                </div>
              </div>

              {/* Scrollable Material Container */}
              <div 
                onScroll={handleReadingScroll}
                className="flex-1 overflow-y-auto p-6 sm:p-10 text-right space-y-6 relative focus:outline-none scroll-smooth"
              >
                {/* Immersive mode status badge */}
                {isReadingMode && (
                  <div className="flex justify-center mb-6">
                    <span className={`text-[10px] font-black px-4 py-1.5 rounded-full border ${
                      readingTheme === 'night' || readingTheme === 'dim' 
                        ? 'bg-slate-800/80 border-slate-700 text-amber-400' 
                        : 'bg-amber-50 border-amber-200 text-amber-800'
                    }`}>
                      📖 وضع القراءة نشط الآن - تم إخفاء المشتتات وتكبير نصوص المادة الروحية لحماية عينيك
                    </span>
                  </div>
                )}

                {/* 1. Normal Lecture Metadata Details */}
                {!isReadingMode && (
                  <div className={`p-5 rounded-3xl border transition-all ${
                    readingTheme === 'normal' ? 'bg-[#FAF8F5]/50 border-slate-200' :
                    readingTheme === 'sepia' ? 'bg-[#FAF4EB]/50 border-[#E8DEC9]' :
                    readingTheme === 'dim' ? 'bg-slate-800/40 border-slate-700' :
                    'bg-slate-900/40 border-slate-800'
                  }`}>
                    <h4 className="text-xs font-black text-purple-600 mb-3 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      <span>معلومات المحاضرة الأساسية</span>
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-slate-400 block font-bold">المتكلم / المحاضر الروحي</span>
                        <strong className="text-sm font-black">{selectedLecture.speaker || 'غير محدد'}</strong>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-slate-400 block font-bold">المكان / القاعة</span>
                        <strong className="text-sm font-black">{selectedLecture.location}</strong>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-slate-400 block font-bold">التوقيت</span>
                        <strong className="text-sm font-black font-mono">{selectedLecture.time}</strong>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-slate-400 block font-bold">المدة المقدرة</span>
                        <strong className="text-sm font-black">{selectedLecture.duration}</strong>
                      </div>
                    </div>
                    {selectedLecture.info && (
                      <div className="mt-4 pt-3 border-t border-dashed border-slate-200/50">
                        <span className="text-[10px] text-slate-400 block font-bold mb-1">الموجز والملخص السريع للفكرة الأساسية:</span>
                        <p className="text-[11.5px] leading-relaxed opacity-90">{selectedLecture.info}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Pure Spiritual Material Reading Space */}
                {(() => {
                  const content = getSpiritualMaterial(selectedLecture.title);
                  /* NOTE — this .pima-play-mid does nothing, and that is a
                        finding rather than a bug to quietly delete.

                        The responsive pass applied the page-container utility
                        here, but this element is nested four levels inside the
                        lecture modal above, which is `w-full max-w-3xl` (768px).
                        The modal wins at every width, so the utility's cap never
                        binds. Measured in a browser against the compiled CSS:

                          vw 375  modal 343  reading 294  cap  672px
                          vw 735  modal 703  reading 654  cap  672px
                          vw 1280 modal 768  reading 718  cap 1040px
                          vw 1440 modal 768  reading 718  cap 1160px

                        Reading width is pinned at 718 from 1280 up — by
                        max-w-3xl, not by this class.

                        The real gap it was meant to close is still open:
                        ConferenceHub has NO page-level container. Giving it one
                        is a layout decision about a 3000-line screen that also
                        hosts deliberately full-bleed presentation and slide
                        views, so it belongs to the product owner, not to a
                        colour migration. */
                  return (
                    <div
                      className="pima-play-mid space-y-8 pb-10"
                      style={{ fontSize: `${readingFontSize}px`, lineHeight: 1.8 }}
                    >
                      {/* Section: Intro Contemplation */}
                      <section className="space-y-3">
                        <span className="text-xs font-black text-amber-500 tracking-wider block font-bold">▣ تأمل روحي تمهيدي للمادة الروحية</span>
                        <p className="indent-4 leading-relaxed font-normal text-justify text-[1.05em]">
                          {content.intro}
                        </p>
                      </section>

                      {/* Section: Biblical Verses (Highlighted beautifully) */}
                      <section className="space-y-3">
                        <span className="text-xs font-black text-purple-600 block">✙ آيات وشواهد الكتاب المقدس للحفظ والتدريب</span>
                        <div className={`p-5 rounded-2xl border-r-4 space-y-3 ${
                          readingTheme === 'night' || readingTheme === 'dim'
                            ? 'bg-red-950/20 border-red-500 text-red-200'
                            : 'bg-red-50/80 border-red-500 text-red-900'
                        }`}>
                          {content.verses.map((verse, vIdx) => (
                            <p key={vIdx} className="font-serif leading-relaxed text-[0.98em] italic">
                              {verse}
                            </p>
                          ))}
                        </div>
                      </section>

                      {/* Section: Key Points / Lessons */}
                      <section className="space-y-3">
                        <span className="text-xs font-black text-amber-500 block">▣ الدروس الأساسية والتدريبات الروحية العملية للنمو</span>
                        <ul className="space-y-2.5 list-none pl-0 pr-1">
                          {content.keyPoints.map((point, pIdx) => (
                            <li key={pIdx} className="flex items-start gap-2 text-[0.95em]">
                              <span className="text-amber-500 shrink-0 mt-1.5 text-[0.8em]">✦</span>
                              <span className="leading-relaxed">{point}</span>
                            </li>
                          ))}
                        </ul>
                      </section>

                      {/* Section: Fathers Quotes */}
                      <section className="space-y-3">
                        <span className="text-xs font-black text-purple-600 block">✙ من ينبوع أقوال آباء الكنيسة وقديسيها الأطهار</span>
                        <div className={`p-5 rounded-2xl border-l-4 space-y-4 ${
                          readingTheme === 'night' || readingTheme === 'dim'
                            ? 'bg-slate-800/50 border-amber-500/50 text-slate-200'
                            : 'bg-amber-50/30 border-amber-500/40 text-amber-950'
                        }`}>
                          {content.fathersQuotes.map((quote, qIdx) => (
                            <div key={qIdx} className="space-y-1">
                              <p className="italic leading-relaxed text-[0.95em]">
                                {quote}
                              </p>
                            </div>
                          ))}
                        </div>
                      </section>

                      {/* Section: Summary */}
                      <section className="pt-4 border-t border-dashed border-slate-300/40 space-y-3">
                        <span className="text-xs font-black text-emerald-600 block">✔ خلاصة الدرس وهدف التطبيق السلوكي</span>
                        <p className="leading-relaxed text-[0.95em]">
                          {content.summary}
                        </p>
                      </section>
                    </div>
                  );
                })()}

                {/* Eye Relaxation Timer Helper Widget inside scroll area */}
                <div className={`p-4 rounded-2xl max-w-md mx-auto border text-center space-y-3 ${
                  readingTheme === 'night' || readingTheme === 'dim'
                    ? 'bg-slate-800/40 border-slate-700/80'
                    : 'bg-purple-50/40 border-purple-200/50'
                }`}>
                  <h5 className="text-xs font-black text-purple-600 flex items-center justify-center gap-1">
                    <Timer className="w-4 h-4 text-amber-500" />
                    <span>مساعد حماية العين والراحة (قاعدة ٢٠-٢٠-٢٠) ⏱️</span>
                  </h5>
                  <p className="text-[10px] opacity-80 leading-relaxed">
                    لحماية عينيك أثناء القراءة الروحية الممتدة، اضغط أدناه لبدء اختبار راحة العين التلقائي وتفعيل التنبيه الصحي بعد ٥ ثوانٍ.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      showToast('⏱️ تم بدء فحص عضلات العين وتنشيط مؤقت الراحة! انتظر ٥ ثوانٍ لتلقي التنبيه...');
                      setTimeout(() => {
                        alert('⏱️ تنبيه صحة وراحة العينين! يُرجى إغلاق العينين أو النظر لشيء بعيد لمدة ٢٠ ثانية لتريح عضلات العين وتمنع الصداع أو الإجهاد البصري. دمتم سالمين روحيّاً وجسديّاً! 🌸✨');
                      }, 5000);
                    }}
                    className="bg-purple-600 hover:bg-purple-700 text-white text-[9.5px] font-black px-3.5 py-2 rounded-xl transition-all cursor-pointer shadow-sm active:scale-95"
                  >
                    بدء تنبيه فحص وإراحة العينين 🔔
                  </button>
                </div>
              </div>

              {/* Footer Buttons */}
              <div className={`p-4 border-t flex items-center justify-between z-30 ${
                readingTheme === 'normal' ? 'bg-slate-100/80 border-slate-200' :
                readingTheme === 'sepia' ? 'bg-[#FAF4EB] border-[#E8DEC9]' :
                readingTheme === 'dim' ? 'bg-[#1E2022] border-[#2D3033]' :
                'bg-[#0F172A] border-[#1E293B]'
              }`}>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setIsReadingMode(!isReadingMode);
                    }}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer active:scale-95 ${
                      isReadingMode 
                        ? 'bg-purple-600 hover:bg-purple-700 text-white' 
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                  >
                    {isReadingMode ? 'التبديل إلى الواجهة العادية 🔍' : 'تفعيل وضع القراءة المريح للعينين 📖'}
                  </button>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setSelectedLecture(null);
                    }}
                    className="bg-red-500 hover:bg-red-600 text-white px-5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer active:scale-95"
                  >
                    إغلاق المادة الروحية ✕
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
        </>
      )}
    </div>
  );
}


export interface ConferenceHubProps {
  currentUser: {
    id?: string;
    name: string;
    points?: number;
    organizationName?: string;
  };
  conference: ConferenceRoom;
  onUpdateConference: (updated: ConferenceRoom) => void;
  onBack: () => void;
  onUpdateUser?: (updated: any) => void;
}

export default function ConferenceHub({ currentUser, conference, onUpdateConference, onBack, onUpdateUser }: ConferenceHubProps) {
  return (
    <ActiveConferenceHub 
      currentUser={currentUser} 
      conference={conference} 
      onLeave={onBack} 
      onUpdateConference={onUpdateConference}
      onUpdateUser={onUpdateUser}
    />
  );
}
