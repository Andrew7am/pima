import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { 
  Gamepad2, Trophy, User, Play, CheckCircle2, XCircle, 
  Clock, ArrowRight, Check, HelpCircle, Award, Sparkles, 
  Compass, BookOpen, Star, RefreshCw, X, ArrowUp, ArrowDown, LogIn,
  Copy, Plus, Users, Share2, LogOut, MessageSquare, UserPlus, UserCheck, Send,
  Shield, Timer, TrendingUp, Zap, Lightbulb
} from 'lucide-react';
import { User as UserType } from '../types';
import { SmartAssistBar } from './SmartAssistBar';
import { ChatComponent } from './ChatComponent';
import { FriendChat } from './FriendChat';
import { triggerHaptic } from '../lib/haptic';
import { playSound, toggleBackgroundMusic } from '../lib/sounds';
import { socialService } from './socialService';
import { gameService, GameRoom } from './gameService';
import { auth, db } from './rmatchFirebase';
import { signInAnonymously } from './rmatchFirebase';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  onSnapshot, 
  deleteDoc, 
  collection, 
  query, 
  where, 
  getDocs 
} from './rmatchFirebase';

interface RandomMatchGameProps {
  currentUser: UserType;
  onUpdateUser: (updatedUser: UserType) => void;
  onClose: () => void;
  isSoundEnabled?: boolean;
  isMusicEnabled?: boolean;
}

const AssetWithFallback = ({ src, alt, className, fallbackSvg }: { src: string; alt: string; className: string; fallbackSvg: React.ReactNode }) => {
  const [hasError, setHasError] = useState(false);
  return hasError ? (
    <div className={className}>{fallbackSvg}</div>
  ) : (
    <img 
      src={src} 
      alt={alt} 
      className={`${className} object-cover`}
      onError={() => setHasError(true)} 
      referrerPolicy="no-referrer"
    />
  );
};

// League structure
const LEAGUES = [
  { id: 'beginner', min: 0, max: 199, name: 'مبتدئ 🥉', badge: '🥉', color: 'from-amber-700 to-amber-900', textColor: 'text-amber-500', glow: 'shadow-amber-500/20' },
  { id: 'student', min: 200, max: 499, name: 'دارس 🥈', badge: '🥈', color: 'from-slate-400 to-slate-600', textColor: 'text-slate-300', glow: 'shadow-slate-400/20' },
  { id: 'disciple', min: 500, max: 999, name: 'تلميذ 🥇', badge: '🥇', color: 'from-yellow-400 to-amber-600', textColor: 'text-amber-400', glow: 'shadow-yellow-500/20' },
  { id: 'teacher', min: 1000, max: 1999, name: 'معلم 💎', badge: '💎', color: 'from-cyan-400 to-blue-600', textColor: 'text-cyan-400', glow: 'shadow-cyan-500/20' },
  { id: 'master', min: 2000, max: Infinity, name: 'حكيم الكتاب 👑', badge: '👑', color: 'from-purple-600 to-indigo-900', textColor: 'text-purple-400', glow: 'shadow-purple-500/20' }
];

const getLeague = (rating: number) => {
  return LEAGUES.find(l => rating >= l.min && rating <= l.max) || LEAGUES[0];
};

const SIMULATED_OPPONENTS = [
  { uid: 'sim_mina', name: 'مينا العجايبي', level: 6, rating: 110, avatarBg: 'bg-emerald-500' },
  { uid: 'sim_kyrillos', name: 'كيرلس البطل', level: 4, rating: 85, avatarBg: 'bg-indigo-500' },
  { uid: 'sim_demiana', name: 'دميانة القديسة', level: 7, rating: 145, avatarBg: 'bg-pink-500' },
  { uid: 'sim_tony', name: 'توني فايز', level: 5, rating: 95, avatarBg: 'bg-amber-500' },
  { uid: 'sim_sandra', name: 'ساندرا عادل', level: 6, rating: 120, avatarBg: 'bg-cyan-500' },
  { uid: 'sim_marina', name: 'مارينا كمال', level: 5, rating: 98, avatarBg: 'bg-rose-500' },
  { uid: 'sim_yohanna', name: 'يوحنا رمزي', level: 8, rating: 320, avatarBg: 'bg-purple-500' }
];

const GAME_MODES_QUESTIONS: Record<string, any[]> = {
  // 1. مسابقة كتابية 1 ضد 1
  bible_quiz: [
    {
      question: 'من هو النبي الذي صعد إلى السماء في مركبة نارية فريدة؟',
      options: ['موسى النبي', 'إيليا النبي', 'أشعياء النبي', 'أرميا النبي'],
      answer: 'إيليا النبي',
      hint: 'واجه أنبياء البعل في جبل الكرمل.'
    },
    {
      question: 'أين ولد القديس بولس الرسول كارز الأمم العظيم؟',
      options: ['أورشليم', 'دمشق', 'طرسوس', 'روما'],
      answer: 'طرسوس',
      hint: 'كان مواطناً رومانياً بالولادة.'
    },
    {
      question: 'كم عدد المرات التي دار فيها بنو إسرائيل حول أسوار أريحا في اليوم السابع؟',
      options: ['مرة واحدة', '٣ مرات', '٧ مرات', '١٢ مرة'],
      answer: '٧ مرات',
      hint: 'سقطت الأسوار بصيحاتهم وأصوات الأبواق.'
    },
    {
      question: 'من هو أول ملك مُسح على شعب إسرائيل بواسطة صموئيل النبي؟',
      options: ['داود الملك', 'سليمان الملك', 'شاول الملك', 'رحبعام الملك'],
      answer: 'شاول الملك',
      hint: 'كان من سبط بنيامين وكان طويلاً وجميلاً.'
    },
    {
      question: 'ما هو اسم الجبل الذي استقر عليه فلك نوح بعد الطوفان؟',
      options: ['جبل سيناء', 'جبال أراراط', 'جبل الزيتون', 'جبل الكرمل'],
      answer: 'جبال أراراط',
      hint: 'يقع في المنطقة الحدودية بين تركيا وأرمينيا.'
    }
  ],

  // 2. من أنا؟ (ألغاز الشخصيات)
  who_am_i: [
    {
      question: 'رأيت سلماً واصلاً بين الأرض والسماء والملائكة تصعد وتنزل عليه، ودعوت المكان "بيت الله"، فمن أنا؟',
      options: ['إبراهيم الخليل', 'إسحق البار', 'يعقوب أبو الآباء', 'يوسف الصديق'],
      answer: 'يعقوب أبو الآباء',
      hint: 'تصارعت مع ملاك حتى الفجر وتغير اسمي.'
    },
    {
      question: 'أنا ملك طلبت الحكمة من الله عوضاً عن الغنى، فوهبني حكمة فريدة ومجداً، فمن أنا؟',
      options: ['داود الملك', 'شاول الملك', 'سليمان الحكيم', 'حزقيا الملك'],
      answer: 'سليمان الحكيم',
      hint: 'بنيت الهيكل الأول العظيم في أورشليم.'
    },
    {
      question: 'أنا التلميذ الذي مشى على الماء مع الرب يسوع لكنني بدأت أغرق عندما شككت، فمن أنا؟',
      options: ['يوحنا الحبيب', 'أندراوس الرسول', 'بطرس الرسول', 'توما الشكاك'],
      answer: 'بطرس الرسول',
      hint: 'كنت صياداً ولقبني الرب بـ "الصخرة".'
    },
    {
      question: 'أنا ملكة شجاعة صمت وصليت لإنقاذ شعبي من الإبادة وقلت "إن هلكت هلكت"، فمن أنا؟',
      options: ['راحاب', 'راعوث', 'أستير الملكة', 'دبورة القاضية'],
      answer: 'أستير الملكة',
      hint: 'عشت في قصر الملك أحشويروش وأنقذت اليهود.'
    },
    {
      question: 'كنت عشاراً أجمع الضرائب، فدعاني الرب لأتبعه وكتبت أول الأناجيل، فمن أنا؟',
      options: ['لوقا الطبيب', 'متى الإنجيلي', 'مرقس الكارز', 'برثلماوس'],
      answer: 'متى الإنجيلي',
      hint: 'كنت تلميذاً للرب وكتبت عن نسب المسيح الملكي.'
    }
  ],

  // 3. تحدي السرعة 1 ضد 1
  speed_challenge: [
    {
      question: 'أين ولد السيد المسيح له المجد بالجسد؟',
      options: ['الناصرة', 'أورشليم', 'بيت لحم', 'مصر'],
      answer: 'بيت لحم',
      hint: 'مدينة داود الصغيرة المباركة.'
    },
    {
      question: 'كم سنة تاه بنو إسرائيل وتجولوا في برية سيناء القاحلة؟',
      options: ['٧ سنوات', '١٢ سنة', '٤٠ سنة', '٧٠ سنة'],
      answer: '٤٠ سنة',
      hint: 'بسبب عصيانهم وعدم إيمانهم الأولي.'
    },
    {
      question: 'من هو بكر الأنبياء والآباء الذي لُقب بـ "أبو الآباء والخلّاق"؟',
      options: ['آدم', 'نوح', 'إبراهيم', 'موسى'],
      answer: 'إبراهيم',
      hint: 'أطاع الله وخرج من موطنه لا يعلم إلى أين يذهب.'
    },
    {
      question: 'ما هو أقصر مزمور في سفر المزامير يتكون من آيتين فقط؟',
      options: ['مزمور ١', 'مزمور ٢٣', 'مزمور ١١٧', 'مزمور ١٥٠'],
      answer: 'مزمور ١١٧',
      hint: 'يدعو كل الأمم لتسبيح الرب الحبيب.'
    },
    {
      question: 'من هي أول من شاهدت السيد المسيح قائماً من القبر وبشرت الرسل؟',
      options: ['العذراء مريم', 'مريم المجدلية', 'سالومة', 'حنّة النبية'],
      answer: 'مريم المجدلية',
      hint: 'أخرج منها سبعة شياطين فتبعته بمحبة تامة.'
    }
  ],

  // 4. خمن القصة بالإيموجي 🎨
  guess_emoji: [
    {
      question: '🌊🚢🕊️🌿',
      options: ['خروج شعب إسرائيل', 'طوفان نوح', 'يونان في الحوت', 'صيد السمك مع بطرس'],
      answer: 'طوفان نوح',
      hint: 'الماء والغراب والحمامة وغصن الزيتون.'
    },
    {
      question: '🌈🐑🏔️🔪',
      options: ['ذبيحة هابيل', 'قصة أيوب', 'تضحية إبراهيم بابنه إسحق', 'خروف الفصح'],
      answer: 'تضحية إبراهيم بابنه إسحق',
      hint: 'قوس قزح كعلامة للعهد وكبش الفداء.'
    },
    {
      question: '🧺🌊👸🐍',
      options: ['ميلاد المسيح', 'قصة يوسف', 'ولادة موسى النبي', 'دانيال في جب الأسود'],
      answer: 'ولادة موسى النبي',
      hint: 'السلة في النيل وابنة فرعون التي التقطته.'
    },
    {
      question: '🦁🍖🙏🤴',
      options: ['سامسون الجبار', 'داود وجليات', 'دانيال في جب الأسود', 'سليمان الحكيم'],
      answer: 'دانيال في جب الأسود',
      hint: 'النبي الذي لم تلمسه الأسود الجائعة.'
    }
  ],

  // 5. ترتيب الأحداث 1 ضد 1
  event_ordering: [
    {
      question: 'ما هو الحدث الأقدم تاريخياً وبداية العهود الإلهية؟',
      options: ['طوفان نوح العظيم', 'خروج شعب إسرائيل من مصر', 'سبي بابل وتشتت أورشليم', 'ولادة داود الملك البار'],
      answer: 'طوفان نوح العظيم',
      hint: 'حدث في فجر تاريخ البشرية الأثيم.'
    },
    {
      question: 'من عاصر موسى النبي أولاً وخلفه في قيادة الشعب لدخول كنعان؟',
      options: ['يشوع بن نون البطل', 'داود الملك المرتل', 'إشعياء النبي الإنجيلي', 'ملاخي النبي الأخير'],
      answer: 'يشوع بن نون البطل',
      hint: 'هو من قسم الأرض وبارك الأسباط وجعل الأسوار تسقط.'
    },
    {
      question: 'أي من هؤلاء الآباء العظام ولد أولاً في شجرة العهد؟',
      options: ['إبراهيم الخليل', 'إسحق البار', 'يعقوب أبو الأسباط', 'يوسف الصديق بمصر'],
      answer: 'إبراهيم الخليل',
      hint: 'جد الآباء وحامل الوعد الخالد الأول.'
    },
    {
      question: 'أي من الأسفار التالية تم تدوينه تاريخياً كآخر أسفار الكتاب المقدس؟',
      options: ['سفر الرؤيا اللاهوتي', 'إنجيل يوحنا الروحاني', 'سفر ملاخي الختامي', 'سفر التكوين البدائي'],
      answer: 'سفر الرؤيا اللاهوتي',
      hint: 'دونه يوحنا اللاهوتي في جزيرة بطمس المنفية.'
    },
    {
      question: 'ما هي الأعجوبة الإلهية الأولى التي صنعها المخلص وبدأ بها آياته بمحبة؟',
      options: ['تحويل الماء خمراً في عرس قانا الجليل', 'شفاء المولود أعمى بأورشليم', 'إقامة لعازر من القبر بعد ٤ أيام', 'المشي على مياه بحيرة طبرية العاصفة'],
      answer: 'تحويل الماء خمراً في عرس قانا الجليل',
      hint: 'حدث بطلب حنون من أمه العذراء الطاهرة مريم.'
    }
  ]
};

const ASSISTS_DATA = [
  { id: 'hint', icon: '💡', level: 1 },
  { id: '5050', icon: '✂️', level: 3 },
  { id: 'extra_time', icon: '⏳', level: 5 },
  { id: 'retry', icon: '🔄', level: 8 },
  { id: 'skip', icon: '⏭', level: 12 },
  { id: 'double', icon: '🎯', level: 15 },
];

export default function RandomMatchGame({ 
  currentUser, 
  onUpdateUser, 
  onClose,
  isSoundEnabled = true,
  isMusicEnabled = true
}: RandomMatchGameProps) {
  // Sync background music with prop
  useEffect(() => {
    toggleBackgroundMusic(isMusicEnabled);
    return () => toggleBackgroundMusic(false); // Cleanup on unmount
  }, [isMusicEnabled]);

  // Sync sound setting to localStorage for the global SoundManager
  useEffect(() => {
    localStorage.setItem('entertainment_sound_enabled', isSoundEnabled ? 'true' : 'false');
  }, [isSoundEnabled]);
  // Persistence of competitive rating in localStorage
  const [rating, setRating] = useState<number>(() => {
    const saved = localStorage.getItem('coptic_random_match_rating');
    return saved ? parseInt(saved, 10) : 75;
  });

  const [streak, setStreak] = useState<number>(() => {
    const saved = localStorage.getItem('coptic_random_match_streak');
    return saved ? parseInt(saved, 10) : 0;
  });

  // Game States
  const [screen, setScreen] = useState<'menu' | 'league_info' | 'searching' | 'opponent_found' | 'playing' | 'results' | 'friend_menu' | 'create_friend_room' | 'waiting_friend_room' | 'playing_friend' | 'results_friend'>('league_info');
  const [selectedMode, setSelectedMode] = useState<string>('all_mixed');
  
  // Search state
  const [searchTimer, setSearchTimer] = useState(0);
  const [searchRange, setSearchRange] = useState(50);
  const [opponent, setOpponent] = useState<any>(null);
  const searchIntervalRef = useRef<any>(null);

  // Assists state
  const [equippedAssists, setEquippedAssists] = useState<string[]>(() => {
    return currentUser.equippedAssists || ['hint', '5050'];
  });
  const [usedAssists, setUsedAssists] = useState<string[]>([]);
  const [removedAnswers, setRemovedAnswers] = useState<string[]>([]);
  const [isTimerFrozen, setIsTimerFrozen] = useState(false);
  const isTimerFrozenRef = useRef(false);
  const [canRetry, setCanRetry] = useState(true);
  const [hasUsedRetry, setHasUsedRetry] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);

  // ... existing code ...

  const useAssist = (assistId: string) => {
    if (usedAssists.includes(assistId)) return;
    
    setUsedAssists(prev => [...prev, assistId]);

    switch (assistId) {
      case '5050':
        const currentQ = questions[currentQuestionIndex];
        const incorrect = currentQ.options.filter((o: string) => o !== currentQ.answer);
        const toRemove = incorrect.sort(() => 0.5 - Math.random()).slice(0, 2);
        setRemovedAnswers(toRemove);
        break;
      case 'extra_time':
        setIsTimerFrozen(true);
        isTimerFrozenRef.current = true;
        setTimeout(() => {
          setIsTimerFrozen(false);
          isTimerFrozenRef.current = false;
        }, 10000);
        break;
      case 'retry':
        setHasUsedRetry(true);
        break;
    }
  };

  const [questions, setQuestions] = useState<any[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userScore, setUserScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [userSelectedAnswer, setUserSelectedAnswer] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [showRetryMessage, setShowRetryMessage] = useState(false);
  const [playTimer, setPlayTimer] = useState(20);
  const playIntervalRef = useRef<any>(null);
  const [outcome, setOutcome] = useState<'win' | 'loss' | 'draw'>('win');

  // Play with Friend (Private Rooms) States
  const [roomCode, setRoomCode] = useState<string>('');
  const [isCreator, setIsCreator] = useState<boolean>(false);
  const [liveRoom, setLiveRoom] = useState<any>(null);
  const [joinCode, setJoinCode] = useState<string>('');
  const [joinError, setJoinError] = useState<string>('');
  const [isJoining, setIsJoining] = useState<boolean>(false);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [friendCountdown, setFriendCountdown] = useState<number>(300);
  const [hasRewardedFriend, setHasRewardedFriend] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [localCurrentIndex, setLocalCurrentIndex] = useState<number>(0);
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);

  // Social System States
  const [friendStatus, setFriendStatus] = useState<'none' | 'pending' | 'accepted' | 'rejected'>('none');
  const [isSendingRequest, setIsSendingRequest] = useState<boolean>(false);
  const [friends, setFriends] = useState<any[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<any[]>([]);

  // Auth listener & Subscribe to friends and requests
  useEffect(() => {
    const tutorialShown = localStorage.getItem('assistTutorialShown');
    if (!tutorialShown) {
      setShowTutorial(true);
      localStorage.setItem('assistTutorialShown', 'true');
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (!auth.currentUser) {
          // Only attempt if not already in an error state
          await signInAnonymously(auth).catch(err => {
            console.warn("Anonymous auth disabled or restricted:", err.message);
          });
        }
      } catch (err) {
        console.warn("Auth initialization skipped");
      }
    };

    initAuth();

    const unsubAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        // Subscribe to friends
        const unsubFriends = socialService.subscribeToFriends(user.uid, (data) => {
          setFriends(data);
        });

        // Subscribe to requests
        const unsubRequests = socialService.subscribeToIncomingRequests(user.uid, (data) => {
          setIncomingRequests(data);
        });

        return () => {
          unsubFriends();
          unsubRequests();
        };
      }
    });

    return () => unsubAuth();
  }, []);

  // Check friend status when opponent is found
  useEffect(() => {
    if (opponent && opponent.uid) {
      socialService.getFriendRequestStatus(opponent.uid).then(status => {
        setFriendStatus(status as any);
      });
    } else {
      setFriendStatus('none');
    }
  }, [opponent]);

  const handleSendFriendRequest = async () => {
    if (!opponent || !opponent.uid || isSendingRequest) return;
    setIsSendingRequest(true);
    try {
      await socialService.sendFriendRequest(opponent.uid, currentUser.name);
      setFriendStatus('pending');
    } catch (err) {
      console.error("Error sending friend request:", err);
    } finally {
      setIsSendingRequest(false);
    }
  };

  const handleAcceptRequest = async (request: any) => {
    try {
      await socialService.acceptFriendRequest(request.id, request.senderId, request.senderName, currentUser.name);
    } catch (err) {
      console.error("Error accepting friend request:", err);
    }
  };

  const handleRejectRequest = async (request: any) => {
    try {
      await socialService.rejectFriendRequest(request.id);
    } catch (err) {
      console.error("Error rejecting friend request:", err);
    }
  };

  const shareViaWhatsApp = (code: string) => {
    const message = `🎮 مرحباً! لقد أنشأت غرفة خاصة للعب معك.\n\n🔑 كود الغرفة: ${code}\n\n📲 افتح اللعبة ثم اختر "العب مع صديق" وأدخل الكود.\n\n🚀 هيا نبدأ التحدي!\n\n🔗 https://yourapp.com/download`;
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
  };

  // Load state or update when rating changes
  useEffect(() => {
    localStorage.setItem('coptic_random_match_rating', rating.toString());
  }, [rating]);

  useEffect(() => {
    localStorage.setItem('coptic_random_match_streak', streak.toString());
  }, [streak]);

  // Cleanup timers on unmount
  useEffect(() => {
    // Periodic cleanup of expired rooms
    const cleanupInterval = setInterval(() => {
      cleanupExpiredRooms();
    }, 60000); // Every minute

    return () => {
      if (searchIntervalRef.current) clearInterval(searchIntervalRef.current);
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
      clearInterval(cleanupInterval);
    };
  }, []);

  // --- PRIVATE ROOMS (PLAY WITH A FRIEND) LOGIC ---

  // Cleanup expired rooms when accessing the friend menu
  const cleanupExpiredRooms = async () => {
    try {
      const q = query(collection(db, 'private_rooms'), where('expiresAt', '<', Date.now()));
      const snapshot = await getDocs(q);
      snapshot.forEach((doc) => {
        deleteDoc(doc.ref).catch(err => console.error("Error deleting expired room:", err));
      });
    } catch (err) {
      console.error("Error cleaning up expired rooms:", err);
    }
  };

  // Create Room
  const handleCreateFriendRoom = async (modeId: string) => {
    setIsCreating(true);
    setJoinError('');
    try {
      // Optional: Try auth but don't block
      if (!auth.currentUser) {
        await signInAnonymously(auth).catch(() => {});
      }
      
      const code = 'ROOM-' + Math.floor(1000 + Math.random() * 9000);
      const pool = GAME_MODES_QUESTIONS[modeId] || GAME_MODES_QUESTIONS.bible_quiz;
      
      // Improved Fisher-Yates Shuffle for truly random selection
      const shuffledPool = [...pool];
      for (let i = shuffledPool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledPool[i], shuffledPool[j]] = [shuffledPool[j], shuffledPool[i]];
      }
      const selectedQuestions = shuffledPool.slice(0, 5);

      const now = Date.now();
      const expires = now + 5 * 60 * 1000; // 5 minutes

      const roomData = {
        id: code,
        code: code,
        creatorId: auth.currentUser?.uid || currentUser.id,
        creatorName: currentUser.name,
        player1Id: auth.currentUser?.uid || currentUser.id,
        player1Name: currentUser.name,
        player1Level: currentUser.level || 1,
        player1Rating: rating,
        player2Id: null,
        player2Name: null,
        player2Level: null,
        player2Rating: null,
        status: 'waiting',
        selectedMode: modeId,
        questions: selectedQuestions,
        player1Score: 0,
        player2Score: 0,
        player1CurrentIndex: 0,
        player2CurrentIndex: 0,
        createdAt: now,
        expiresAt: expires,
        updatedAt: now
      };

      await setDoc(doc(db, 'private_rooms', code), roomData);
      
      setRoomCode(code);
      setIsCreator(true);
      setLiveRoom(roomData);
      setLocalCurrentIndex(0);
      setFriendCountdown(300);
      setScreen('waiting_friend_room');
    } catch (err) {
      console.error("Error creating private room:", err);
      setJoinError("فشل إنشاء الغرفة. يرجى التحقق من اتصال الإنترنت.");
    } finally {
      setIsCreating(false);
    }
  };

  // Join Room
  const handleJoinFriendRoom = async (codeStr: string) => {
    const formattedCode = codeStr.trim().toUpperCase();
    if (!formattedCode) {
      setJoinError("يرجى إدخال كود الغرفة.");
      return;
    }
    
    setIsJoining(true);
    setJoinError('');
    try {
      if (!auth.currentUser) {
        await signInAnonymously(auth).catch(() => {});
      }
      
      const roomRef = doc(db, 'private_rooms', formattedCode);
      const snapshot = await getDoc(roomRef);
      
      if (!snapshot.exists()) {
        setJoinError("كود الغرفة غير صحيح، يرجى التأكد وإعادة المحاولة.");
        setIsJoining(false);
        return;
      }

      const data = snapshot.data();
      const now = Date.now();

      if (data.expiresAt < now) {
        setJoinError("عذراً، هذه الغرفة قد انتهت صلاحيتها (صلاحية الغرف ٥ دقائق فقط).");
        setIsJoining(false);
        return;
      }

      if (data.status !== 'waiting' || data.player2Id) {
        setJoinError("هذه الغرفة ممتلئة بالفعل أو بدأت المباراة فيها.");
        setIsJoining(false);
        return;
      }

      if (data.creatorId === (auth.currentUser?.uid || currentUser.id)) {
        setJoinError("لا يمكنك الانضمام إلى غرفة قمت أنت بإنشائها.");
        setIsJoining(false);
        return;
      }

      // Valid join! Update Firestore
      const updatedData = {
        player2Id: auth.currentUser?.uid || currentUser.id,
        player2Name: currentUser.name,
        player2Level: currentUser.level || 1,
        player2Rating: rating,
        status: 'started',
        updatedAt: now
      };

      await updateDoc(roomRef, updatedData);

      setRoomCode(formattedCode);
      setIsCreator(false);
      setLocalCurrentIndex(0); // Reset local index
      setLiveRoom({
        ...data,
        ...updatedData
      });
      setScreen('playing_friend');
    } catch (err) {
      console.error("Error joining private room:", err);
      setJoinError("فشل الانضمام للغرفة. يرجى التحقق من اتصال الإنترنت.");
    } finally {
      setIsJoining(false);
    }
  };

  const handleLeaveFriendRoom = () => {
    setRoomCode('');
    setLiveRoom(null);
  };

  // Question timer for friend play
  const startFriendQuestionTimer = () => {
    setPlayTimer(20);
    if (playIntervalRef.current) clearInterval(playIntervalRef.current);

    playIntervalRef.current = setInterval(() => {
      setPlayTimer((prev) => {
        if (isTimerFrozenRef.current) return prev;
        if (prev <= 1) {
          clearInterval(playIntervalRef.current);
          handleFriendAnswerSelection(''); // Timeout answer
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Answer selection in friend play
  const handleFriendAnswerSelection = async (option: string) => {
    if (userSelectedAnswer !== null || !liveRoom) return;

    if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    setUserSelectedAnswer(option);
    setShowExplanation(true);

    const currentIndex = isCreator ? liveRoom.player1CurrentIndex : liveRoom.player2CurrentIndex;
    const currentQuestion = liveRoom.questions[currentIndex];
    if (!currentQuestion) return;

    const isCorrect = option === currentQuestion.answer;
    if (isCorrect) {
      triggerHaptic('success');
    } else {
      triggerHaptic('error');
    }
    const addedScore = isCorrect ? 10 : 0;
    
    const oldScore = isCreator ? liveRoom.player1Score : liveRoom.player2Score;
    const newScore = oldScore + addedScore;
    const nextIndex = currentIndex + 1;

    // Update local score hook
    setUserScore(newScore);

    // Delay before next question to prevent immediate UI jump
    setTimeout(async () => {
      // Write progress to Firestore ONLY after showing feedback/explanation
      try {
        const roomRef = doc(db, 'private_rooms', roomCode);
        const updatePayload: any = {};
        if (isCreator) {
          updatePayload.player1Score = newScore;
          updatePayload.player1CurrentIndex = nextIndex;
        } else {
          updatePayload.player2Score = newScore;
          updatePayload.player2CurrentIndex = nextIndex;
        }
        updatePayload.updatedAt = Date.now();
        await updateDoc(roomRef, updatePayload);
      } catch (err) {
        console.error("Error updating score in Firestore:", err);
      }

      setUserSelectedAnswer(null);
      setShowExplanation(false);
      setLocalCurrentIndex(nextIndex);
      
      if (nextIndex < 5) {
        startFriendQuestionTimer();
      }
    }, 2500);
  };

  // Real-time Firestore snapshot listener
  useEffect(() => {
    if (!roomCode || (screen !== 'waiting_friend_room' && screen !== 'playing_friend' && screen !== 'results_friend')) return;

    const roomRef = doc(db, 'private_rooms', roomCode);
    const unsubscribe = onSnapshot(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setLiveRoom(data);
        
        // Auto transition to playing when player 2 joins
        if (screen === 'waiting_friend_room' && data.status === 'started') {
          setScreen('playing_friend');
        }
      } else {
        // Room deleted, notify or go back
        if (screen === 'playing_friend' || screen === 'waiting_friend_room') {
          setScreen('menu');
          alert("تم إنهاء الغرفة أو لم تعد متاحة.");
        }
      }
    }, (error) => {
      console.error("Firestore onSnapshot error:", error);
    });

    return () => {
      unsubscribe();
    };
  }, [roomCode, screen]);

  // Transition to results_friend when both players have finished answering
  useEffect(() => {
    if (screen === 'playing_friend' && liveRoom) {
      if (liveRoom.player1CurrentIndex === 5 && liveRoom.player2CurrentIndex === 5) {
        setScreen('results_friend');
        
        // Mark room status as finished in Firestore
        if (isCreator && liveRoom.status !== 'finished') {
          updateDoc(doc(db, 'private_rooms', roomCode), {
            status: 'finished',
            updatedAt: Date.now()
          }).catch(err => console.error("Error setting room as finished:", err));
        }
      }
    }
  }, [liveRoom, screen, isCreator, roomCode]);

  // Countdown timer in waiting room
  useEffect(() => {
    if (screen !== 'waiting_friend_room' || !liveRoom) return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((liveRoom.expiresAt - Date.now()) / 1000));
      setFriendCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        setScreen('menu');
        alert("انتهت صلاحية الغرفة المحددة بخمس دقائق.");
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [screen, liveRoom]);

  // Handle active game timers in playing_friend
  useEffect(() => {
    if (screen === 'playing_friend') {
      setUserSelectedAnswer(null);
      setShowExplanation(false);
      setHasRewardedFriend(false);
      startFriendQuestionTimer();
    }
    return () => {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    };
  }, [screen]);

  // Award rewards on results_friend
  useEffect(() => {
    if (screen === 'results_friend' && liveRoom && !hasRewardedFriend) {
      setHasRewardedFriend(true);

      const myScore = isCreator ? liveRoom.player1Score : liveRoom.player2Score;
      const oppScore = isCreator ? liveRoom.player2Score : liveRoom.player1Score;

      let matchOutcome: 'win' | 'loss' | 'draw' = 'win';
      let ratingChange = 0;
      let xpGain = 15;
      let pointsGain = 5;

      if (myScore > oppScore) {
        matchOutcome = 'win';
        ratingChange = 25;
        xpGain = 50;
        pointsGain = 20;
        setStreak(s => s + 1);
      } else if (myScore < oppScore) {
        matchOutcome = 'loss';
        ratingChange = -15;
        xpGain = 15;
        pointsGain = 5;
        setStreak(0);
      } else {
        matchOutcome = 'draw';
        ratingChange = 0;
        xpGain = 20;
        pointsGain = 10;
      }

      const nextRating = Math.max(0, rating + ratingChange);
      setRating(nextRating);
      setOutcome(matchOutcome);
      if (matchOutcome === 'win') {
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 }
        });
      }
      const nextXP = (currentUser.xp || 0) + xpGain;
      const nextPoints = (currentUser.points || 0) + pointsGain;
      const currentLevel = currentUser.level || 1;
      const xpNeeded = currentLevel * 200;
      let nextLevel = currentLevel;
      let finalXP = nextXP;

      if (nextXP >= xpNeeded) {
        nextLevel = currentLevel + 1;
        finalXP = nextXP - xpNeeded;
      }

      onUpdateUser({
        ...currentUser,
        xp: finalXP,
        points: nextPoints,
        level: nextLevel
      });
    }
  }, [screen, liveRoom, hasRewardedFriend, isCreator, rating, currentUser, onUpdateUser]);

  // START MATCHMAKING (Competitive Flow)
  const startSearching = () => {
    triggerHaptic('light');
    playSound('click');
    setScreen('searching');
    setSearchTimer(0);
    setSearchRange(50);
    setOpponent(null);

    if (searchIntervalRef.current) clearInterval(searchIntervalRef.current);
    
    searchIntervalRef.current = setInterval(() => {
      setSearchTimer(prev => {
        const nextTime = prev + 1;
        
        // Expand search range every 3 seconds
        if (nextTime % 3 === 0) {
          setSearchRange(r => r + 50);
        }

        // Simulate finding opponent after 5-10 seconds
        if (nextTime >= 5 && Math.random() > 0.7) {
          const suitableOpponents = SIMULATED_OPPONENTS.filter(o => 
            Math.abs(o.rating - rating) <= searchRange + 100
          );
          const found = suitableOpponents[Math.floor(Math.random() * suitableOpponents.length)] || SIMULATED_OPPONENTS[0];
          
          clearInterval(searchIntervalRef.current);
          handleOpponentFound(found);
          return nextTime;
        }
        
        // Timeout/Fallback after 15 seconds
        if (nextTime >= 15) {
          clearInterval(searchIntervalRef.current);
          handleOpponentFound(SIMULATED_OPPONENTS[0]);
          return nextTime;
        }

        return nextTime;
      });
    }, 1000);
  };

  const handleOpponentFound = (foundOpponent: any) => {
    setOpponent(foundOpponent);
    setScreen('opponent_found');
    playSound('success');
    triggerHaptic('medium');
    
    // Auto start game after 3 seconds
    setTimeout(() => {
      startCompetitiveGame();
    }, 3000);
  };

  const startCompetitiveGame = () => {
    // Mix all categories
    const allQuestions: any[] = [];
    Object.keys(GAME_MODES_QUESTIONS).forEach(mode => {
      allQuestions.push(...GAME_MODES_QUESTIONS[mode].map(q => ({ ...q, category: mode })));
    });
    
    // Shuffle and pick 5
    const shuffled = allQuestions.sort(() => 0.5 - Math.random()).slice(0, 5);
    
    setQuestions(shuffled);
    setCurrentQuestionIndex(0);
    setUserScore(0);
    setOpponentScore(0);
    setUserSelectedAnswer(null);
    setShowExplanation(false);
    setUsedAssists([]);
    setRemovedAnswers([]);
    setScreen('playing');
    startQuestionTimer();
  };

  // CANCEL SEARCHING
  const cancelSearching = () => {
    triggerHaptic('light');
    if (searchIntervalRef.current) clearInterval(searchIntervalRef.current);
    setScreen('league_info');
  };

  // QUESTION TIMER CONTROL
  const startQuestionTimer = () => {
    setPlayTimer(20);
    if (playIntervalRef.current) clearInterval(playIntervalRef.current);

    // Opponent answering logic: simulated latency
    let opponentAnswered = false;
    const opponentAnswerDelay = 3000 + Math.random() * 8000; // Opponent takes 3-11s to answer

    playIntervalRef.current = setInterval(() => {
      setPlayTimer((prev) => {
        if (isTimerFrozenRef.current) return prev;
        // Simulate opponent answering
        if (!opponentAnswered && (20 - prev) * 1000 >= opponentAnswerDelay) {
          opponentAnswered = true;
          // Determine if opponent got it right (e.g. 70% chance)
          const isCorrect = Math.random() < 0.75;
          if (isCorrect) {
            setOpponentScore(score => score + 10);
          }
        }

        if (prev <= 1) {
          // Time's up! Force next or select incorrect automatically
          clearInterval(playIntervalRef.current);
          handleAnswerSelection(''); // Timeout answer
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // HANDLE USER SELECTION
  const handleAnswerSelection = (option: string) => {
    if (userSelectedAnswer !== null) return; // Prevent double answer

    clearInterval(playIntervalRef.current);
    setUserSelectedAnswer(option);

    const currentQuestion = questions[currentQuestionIndex];
    const isCorrect = option === currentQuestion.answer;

    if (isCorrect) {
      setShowExplanation(true);
      setUserScore(score => score + 10);
      triggerHaptic('success');
      playSound('success');
    } else {
      // Retry Assist check
      if (hasUsedRetry) {
        setHasUsedRetry(false); // Consume the retry
        triggerHaptic('warning');
        
        setShowRetryMessage(true);
        // Remove the selected wrong answer so they can't click it again
        setRemovedAnswers(prev => [...prev, option]);
        
        // Let them try again after a brief pause
        setTimeout(() => {
          setShowRetryMessage(false);
          setUserSelectedAnswer(null);
          startQuestionTimer();
        }, 2000);
        
        return; // Early return to avoid advancing question
      }
      
      setShowExplanation(true);
      triggerHaptic('error');
      playSound('wrong');
    }

    // Reset assists for next question
    setRemovedAnswers([]);

    // Advance to next question after 2.5 seconds
    setTimeout(() => {
      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
        setUserSelectedAnswer(null);
        setShowExplanation(false);
        startQuestionTimer();
      } else {
        // End game! Determine outcomes
        calculateFinalResults(userScore + (isCorrect ? 10 : 0));
      }
    }, 2500);
  };

  // ... existing code ...


  // CALCULATE RESULTS AND SAVE REWARDS
  const calculateFinalResults = (finalUserScore: number) => {
    let matchOutcome: 'win' | 'loss' | 'draw' = 'win';
    let ratingChange = 0;
    let xpGain = 50;
    let coinsGain = 20;

    if (finalUserScore > opponentScore) {
      matchOutcome = 'win';
      ratingChange = 25;
      xpGain = 100;
      coinsGain = 50;
      setStreak(s => s + 1);
    } else if (finalUserScore < opponentScore) {
      matchOutcome = 'loss';
      ratingChange = -15;
      xpGain = 20;
      coinsGain = 5;
      setStreak(0); // break streak
    } else {
      matchOutcome = 'draw';
      ratingChange = 0;
      xpGain = 40;
      coinsGain = 15;
    }

    // Apply rating safeguards (rating can't go below 0)
    const nextRating = Math.max(0, rating + ratingChange);
    setRating(nextRating);
    setOutcome(matchOutcome);
    
    if (matchOutcome === 'win') {
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 }
      });
      playSound('win');
    } else {
      playSound('levelUp');
    }

    // Apply Real User Profile Update
    const currentXP = currentUser.xp || 0;
    const currentPoints = currentUser.points || 0;
    const currentLevel = currentUser.level || 1;

    const nextXP = currentXP + xpGain;
    const nextPoints = currentPoints + coinsGain;
    
    // Simple level up calculation (200 XP per level scale)
    const xpNeededForNextLevel = currentLevel * 200;
    let nextLevel = currentLevel;
    let finalXP = nextXP;

    if (nextXP >= xpNeededForNextLevel) {
      nextLevel = currentLevel + 1;
      finalXP = nextXP - xpNeededForNextLevel;
      playSound('levelUp');
    }

    onUpdateUser({
      ...currentUser,
      xp: finalXP,
      points: nextPoints,
      level: nextLevel
    });

    setScreen('results');
  };

  const userLeague = getLeague(rating);

  return (
    <div className="bg-[#081326] text-slate-100 rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.8)] border border-blue-900/40 p-1.5 md:p-4 text-right dir-rtl font-sans relative min-h-[750px]">

      
      {/* AAA Game Background Gradients & Glows */}
      <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-purple-600/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-[30%] left-[10%] w-[150px] h-[150px] bg-yellow-500/5 rounded-full blur-[80px] pointer-events-none" />

      {/* Floating Premium Header Bar */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 bg-[#0d1b3e]/60 backdrop-blur-md border border-blue-500/15 p-3.5 rounded-[24px] mb-5 shadow-lg shadow-black/30">
        {/* Left: Close & Notifications buttons */}
        <div className="flex items-center gap-2">
          <button 
            onClick={() => {
              playSound('click');
              onClose();
            }}
            className="px-4 py-2 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-black text-xs rounded-xl shadow-md shadow-rose-950/40 transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-1.5"
          >
            <span>خروج</span>
          </button>
          <button className="bg-[#122244] hover:bg-[#1b3266] text-slate-300 hover:text-white border border-blue-500/20 p-2.5 rounded-xl transition-all cursor-pointer relative">
            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border border-[#0d1b3e] animate-pulse" />
            <Sparkles className="w-4 h-4 text-[#F5C542]" />
          </button>
        </div>

        {/* Center: Branding Logo */}
        <div className="text-center flex-1 min-w-[120px]">
          <div className="flex items-center justify-center gap-1.5">
            <span className="text-[#F5C542] font-black text-lg animate-pulse">~</span>
            <span className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#F5C542] via-white to-[#F5C542] tracking-widest font-sans drop-shadow-[0_2px_8px_rgba(245,197,66,0.2)]">PiMã</span>
            <span className="text-[#F5C542] font-black text-lg animate-pulse">~</span>
          </div>
          <p className="text-[9px] text-slate-400 font-bold tracking-tight">بدون إعلانات | تجربة نقية</p>
        </div>

        {/* Right: User Level & Avatar */}
        <div className="flex items-center gap-2.5 bg-[#122244]/80 border border-blue-500/20 rounded-2xl px-3 py-1.5 shadow-inner">
          <div className="text-left">
            <div className="flex items-center gap-1 justify-end">
              <span className="text-[9px] font-black text-[#F5C542]">Lv. {currentUser.level || 23}</span>
            </div>
            <div className="bg-slate-900 rounded-full h-1.5 w-12 overflow-hidden border border-blue-900/30 mt-0.5">
              <div className="bg-gradient-to-r from-blue-500 to-cyan-400 h-full" style={{ width: '75%' }} />
            </div>
          </div>
          <div className="relative">
            <img 
              src={currentUser.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80"} 
              alt="avatar" 
              className="w-8 h-8 rounded-full border-2 border-[#F5C542] object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#122244]" />
          </div>
        </div>
      </div>

      {/* Floating Church Selection Card */}
      <div className="relative z-10 bg-gradient-to-l from-[#0b1b36] to-[#071329] border border-blue-500/15 rounded-2xl p-3.5 flex items-center justify-between shadow-lg mb-5 max-w-md mx-auto w-full">
        <button className="flex items-center gap-1 text-[10px] font-black text-[#F5C542] bg-yellow-500/10 border border-yellow-500/20 px-3 py-1.5 rounded-xl transition-all hover:bg-yellow-500/20">
          <Trophy className="w-3 h-3 text-[#F5C542]" />
          <span>تغيير</span>
        </button>
        <div className="text-right">
          <p className="text-[9px] text-[#F5C542] font-bold">الحساب الحالي</p>
          <p className="text-xs font-black text-slate-200 leading-relaxed truncate max-w-[200px]">
            {currentUser.name} ({currentUser.churchName || 'كنيسة مار مرقس'})
          </p>
        </div>
        <div className="w-7 h-7 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
          <User className="w-3.5 h-3.5 text-blue-400" />
        </div>
      </div>

      <AnimatePresence mode="wait">
        
        {/* SCREEN: LEAGUE INFO (Competitive Entry) */}
        {screen === 'league_info' && (
          <motion.div 
            key="league_info"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="space-y-6 p-2 relative z-10"
          >
            {/* League Badge Display */}
            <div className="flex flex-col items-center justify-center pt-4">
              <motion.div 
                animate={{ 
                  y: [0, -10, 0],
                  filter: ['drop-shadow(0 0 0px transparent)', `drop-shadow(0 0 20px ${userLeague.textColor.replace('text-', '')})`, 'drop-shadow(0 0 0px transparent)']
                }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className={`w-40 h-40 rounded-full bg-gradient-to-br ${userLeague.color} flex items-center justify-center border-4 border-white/20 shadow-2xl relative group`}
              >
                <div className={`absolute inset-0 rounded-full bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity`} />
                <span className="text-7xl filter drop-shadow-2xl">{userLeague.badge}</span>
              </motion.div>
              <h2 className={`mt-6 text-3xl font-black ${userLeague.textColor} tracking-tight drop-shadow-lg`}>
                {userLeague.name}
              </h2>
            </div>

            {/* Rating & Stats Cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-4 text-center">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">التقييم الحالي</span>
                <div className="flex items-center justify-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  <span className="text-2xl font-black text-white font-mono">{rating}</span>
                </div>
              </div>
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-4 text-center">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">المكافآت المتوقعة</span>
                <div className="flex items-center justify-center gap-3">
                  <div className="flex items-center gap-1">
                    <span className="text-emerald-400 font-black">+50</span>
                    <span className="text-[10px] text-slate-400">XP</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-amber-400 font-black">+20</span>
                    <span className="text-[10px] text-slate-400">🪙</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 pt-4">
              <motion.button
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={startSearching}
                className="w-full py-5 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white rounded-[24px] shadow-2xl shadow-blue-900/40 border border-blue-400/30 flex items-center justify-center gap-3 transition-all cursor-pointer group"
              >
                <Zap className="w-6 h-6 text-yellow-400 group-hover:scale-125 transition-transform" />
                <span className="text-lg font-black tracking-tight">بدء البحث عن خصم</span>
              </motion.button>

              <div className="flex gap-3">
                <button
                  onClick={() => setScreen('friend_menu')}
                  className="flex-1 py-3.5 bg-white/5 hover:bg-white/10 text-white rounded-2xl text-[11px] font-black border border-white/10 transition-all flex items-center justify-center gap-2"
                >
                  <Users className="w-4 h-4" />
                  <span>تحدي صديق</span>
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 py-3.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-2xl text-[11px] font-black border border-rose-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span>رجوع</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* SCREEN: SEARCHING (Competitive) */}
        {screen === 'searching' && (
          <motion.div 
            key="searching"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-20 space-y-12 relative z-10"
          >
            {/* Animated Radar Search */}
            <div className="relative">
              {[0.5, 1, 1.5].map((delay, i) => (
                <motion.div
                  key={i}
                  initial={{ scale: 0.5, opacity: 0.5 }}
                  animate={{ scale: 2.5, opacity: 0 }}
                  transition={{ duration: 3, repeat: Infinity, delay }}
                  className="absolute inset-0 rounded-full border-2 border-blue-500/30"
                />
              ))}
              
              <div className="relative w-32 h-32 bg-slate-900 rounded-full border-2 border-blue-500/50 flex items-center justify-center shadow-[0_0_50px_rgba(59,130,246,0.3)]">
                <img 
                  src={currentUser.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80"} 
                  className="w-24 h-24 rounded-full border-4 border-blue-500/30 object-cover"
                  alt="My Avatar"
                  referrerPolicy="no-referrer"
                />
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-[-10px] border-t-4 border-blue-500 rounded-full"
                />
              </div>
            </div>

            <div className="text-center space-y-4">
              <h3 className="text-2xl font-black text-white tracking-tight animate-pulse">جاري البحث عن منافس...</h3>
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-2 bg-blue-500/10 px-4 py-2 rounded-full border border-blue-500/20">
                  <TrendingUp className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-black text-blue-300">نطاق البحث: {rating - searchRange} - {rating + searchRange}</span>
                </div>
                <span className="text-[10px] font-black text-slate-500 font-mono">مدة البحث: {searchTimer} ثانية</span>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={cancelSearching}
              className="bg-white/5 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 px-8 py-3 rounded-2xl border border-white/10 hover:border-rose-500/20 text-xs font-black transition-all"
            >
              إلغاء البحث
            </motion.button>
          </motion.div>
        )}

        {/* SCREEN: OPPONENT FOUND */}
        {screen === 'opponent_found' && opponent && (
          <motion.div 
            key="opponent_found"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-10 space-y-8 relative z-10"
          >
            <div className="w-full flex items-center justify-around gap-4 px-4">
              {/* Me */}
              <motion.div 
                initial={{ x: 50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                className="text-center space-y-4"
              >
                <div className="w-24 h-24 rounded-2xl bg-blue-500/20 border-2 border-blue-500/50 p-1">
                  <img src={currentUser.avatar} className="w-full h-full rounded-xl object-cover" alt="My Avatar" referrerPolicy="no-referrer" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-black text-white">{currentUser.name}</h4>
                  <span className="text-[10px] font-black text-blue-400">{rating} 🏆</span>
                </div>
              </motion.div>

              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center border border-white/20"
              >
                <span className="text-2xl font-black text-amber-500">VS</span>
              </motion.div>

              {/* Opponent */}
              <motion.div 
                initial={{ x: -50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                className="text-center space-y-4"
              >
                <div className="w-24 h-24 rounded-2xl bg-rose-500/20 border-2 border-rose-500/50 p-1">
                  <div className={`w-full h-full rounded-xl ${opponent.avatarBg || 'bg-slate-700'} flex items-center justify-center`}>
                    <User className="w-10 h-10 text-white/50" />
                  </div>
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-black text-white">{opponent.name}</h4>
                  <span className="text-[10px] font-black text-rose-400">{opponent.rating} 🏆</span>
                </div>
              </motion.div>
            </div>

            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="bg-amber-500/10 border border-amber-500/20 px-8 py-4 rounded-3xl text-center"
            >
              <h3 className="text-xl font-black text-amber-500 mb-1">تم العثور على منافس!</h3>
              <p className="text-[10px] text-amber-200/60 font-bold uppercase tracking-widest">تبدأ المباراة خلال ثوانٍ...</p>
            </motion.div>

            {/* Mixing Categories Hint */}
            <div className="text-center opacity-60">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-2">نوع التحدي</span>
              <div className="flex gap-2">
                {['📖 مسابقة', '👤 من أنا', '⚡ سرعة'].map(t => (
                  <span key={t} className="text-[10px] font-black text-white bg-white/5 px-3 py-1 rounded-full border border-white/10">{t}</span>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* SCREEN: FRIEND MENU */}
        {screen === 'friend_menu' && (
          <motion.div 
            key="friend_menu"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="space-y-4 p-2 text-center relative overflow-hidden bg-[#050b18] rounded-[32px] border border-blue-900/30"
          >
            {/* Background Radial Glow */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(59,130,246,0.1)_0%,transparent_70%)] pointer-events-none z-0" />
            
            {/* MAIN HERO CARD (Compact & Intense) */}
            <div className="relative z-10 max-w-xl mx-auto rounded-[28px] p-4 md:p-6 bg-gradient-to-b from-slate-900/40 via-slate-950/80 to-black/90 border border-blue-500/10 shadow-2xl overflow-hidden">
              {/* Character & Bible Illustration Row (Compact) */}
              <div className="flex flex-row items-center justify-between gap-2 mb-4 relative px-4">
                {/* Character 1 */}
                <div className="flex flex-col items-center flex-1">
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center p-2 group transition-all hover:bg-emerald-500/20 shadow-lg">
                    <User className="w-full h-full text-emerald-400 opacity-80" />
                  </div>
                  <div className="mt-2 bg-emerald-600/20 text-emerald-400 font-black text-[9px] px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                    أنت (المتحدي)
                  </div>
                </div>

                {/* Center visual: Intense Battle Icon */}
                <div className="flex flex-col items-center justify-center flex-1 relative py-2">
                  <div className="absolute w-20 h-20 bg-amber-500/10 rounded-full blur-xl pointer-events-none animate-pulse" />
                  <motion.div 
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="relative z-10"
                  >
                    <div className="w-12 h-12 bg-gradient-to-tr from-amber-500 to-amber-600 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(245,158,11,0.4)] border border-amber-400/50">
                      <span className="text-xl">⚔️</span>
                    </div>
                  </motion.div>
                  <span className="text-[10px] font-black text-amber-500 mt-2 tracking-widest uppercase">Versus</span>
                </div>

                {/* Character 2 */}
                <div className="flex flex-col items-center flex-1">
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center p-2 group transition-all hover:bg-blue-500/20 shadow-lg">
                    <Users className="w-full h-full text-blue-400 opacity-80" />
                  </div>
                  <div className="mt-2 bg-blue-600/20 text-blue-400 font-black text-[9px] px-2.5 py-0.5 rounded-full border border-blue-500/30">
                    صديقك (الخصم)
                  </div>
                </div>
              </div>

              {/* Title Section (More Pro) */}
              <div className="space-y-1.5 mb-5">
                <h2 className="text-lg md:text-xl font-black text-white flex items-center justify-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  ميدان التحدي المباشر
                </h2>
                <p className="text-[10px] md:text-xs text-slate-400 leading-relaxed max-w-md mx-auto font-bold px-4 text-center">
                  أنشئ غرفة محصنة وادعُ صديقك لمواجهة كتابية شرسة تظهر من هو الأكثر تعمقاً في الإيمان.
                </p>
              </div>

              {/* Feature Chips (Dense & Pro) */}
              <div className="flex flex-wrap justify-center gap-2 mb-6 px-2">
                {[
                  { label: 'أسئلة حصرية', icon: <BookOpen className="w-3 h-3" />, color: 'text-purple-400 bg-purple-500/10' },
                  { label: 'نتائج لحظية', icon: <Timer className="w-3 h-3" />, color: 'text-emerald-400 bg-emerald-500/10' },
                  { label: 'تواصل مباشر', icon: <MessageSquare className="w-3 h-3" />, color: 'text-blue-400 bg-blue-500/10' },
                  { label: 'إحصائيات برو', icon: <TrendingUp className="w-3 h-3" />, color: 'text-amber-400 bg-amber-500/10' }
                ].map((chip, idx) => (
                  <div key={idx} className={`${chip.color} border border-white/5 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 text-[9px] font-black shadow-inner`}>
                    {chip.icon}
                    <span>{chip.label}</span>
                  </div>
                ))}
              </div>

              {joinError && (
                <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="bg-rose-950/40 border border-rose-500/30 text-rose-300 text-[10px] font-bold p-2.5 rounded-xl max-w-sm mx-auto text-center mb-4">
                  {joinError}
                </motion.div>
              )}

              {/* Action Hub (Compact & High Contrast) */}
              <div className="space-y-3 max-w-sm mx-auto relative z-10">
                <button
                  onClick={() => setScreen('create_friend_room')}
                  className="w-full py-4 bg-gradient-to-r from-emerald-600 to-green-700 hover:from-emerald-500 hover:to-green-600 text-white rounded-2xl shadow-xl shadow-emerald-950/20 border border-emerald-400/20 flex items-center justify-center gap-3 transition-all active:scale-95 group cursor-pointer"
                >
                  <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                  <span className="text-sm font-black tracking-wide">إنشاء غرفة تحدي جديدة</span>
                </button>

                <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-blue-500/10 space-y-2.5">
                  <span className="text-[9px] font-black text-slate-500 block uppercase tracking-widest text-center">لديك كود؟ ادخل الميدان الآن</span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="كود الغرفة (ROOM-XXXX)"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value)}
                      className="flex-1 text-center font-mono font-black text-xs bg-black/60 border border-slate-800 rounded-xl px-3 py-2.5 text-amber-400 placeholder:text-slate-700 focus:outline-none focus:border-blue-500 transition-all uppercase"
                    />
                    <button
                      onClick={() => handleJoinFriendRoom(joinCode)}
                      disabled={isJoining}
                      className="bg-blue-600 hover:bg-blue-500 text-white px-5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center shadow-lg active:scale-95 disabled:opacity-50"
                    >
                      {isJoining ? <RefreshCw className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Stats Bar (Compact Footer) */}
            <div className="relative z-10 max-w-xl mx-auto grid grid-cols-3 gap-2 py-3 px-1">
              {[
                { label: 'وقت المباراة', val: '5 دق', icon: <Clock className="w-3 h-3" /> },
                { label: 'النقاط', val: '+50 XP', icon: <Star className="w-3 h-3" /> },
                { label: 'الوضع', val: 'مباشر ⚡', icon: <Zap className="w-3 h-3" /> }
              ].map((item, i) => (
                <div key={i} className="bg-slate-900/40 border border-white/5 p-2 rounded-xl flex flex-col items-center justify-center">
                  <div className="text-slate-500 mb-0.5">{item.icon}</div>
                  <span className="text-[9px] font-black text-slate-100">{item.val}</span>
                  <span className="text-[8px] text-slate-500 font-bold">{item.label}</span>
                </div>
              ))}
            </div>

            <button 
              onClick={() => { setJoinError(''); setScreen('menu'); }}
              className="relative z-10 text-[10px] font-black text-slate-500 hover:text-white transition-all py-2 px-6 rounded-full border border-white/5 hover:bg-white/5"
            >
              العودة للقائمة الرئيسية
            </button>
          </motion.div>
        )}

        {/* SCREEN: CREATE FRIEND ROOM (MODE SELECTOR) */}
        {screen === 'create_friend_room' && (
          <motion.div 
            key="create_friend_room"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="space-y-6 p-2 max-w-xl mx-auto relative z-10"
          >
            <div className="text-right border-r-4 border-emerald-500 pr-6 py-2 bg-emerald-500/5 rounded-l-2xl">
              <h3 className="text-xl font-black text-white mb-1 tracking-tight">إنشاء ميدان خاص 🛡️</h3>
              <p className="text-[11px] text-slate-400 font-bold leading-relaxed">قم بتهيئة المواجهة ودعوة رفقائك لمبارزة إيمانية مباشرة</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { id: 'bible_quiz', title: 'المسابقة الكبرى', icon: '📖', desc: 'تحدي شامل في أسفار العهدين والطقوس الكنسية.' },
                { id: 'who_am_i', title: 'ميدان الشخصيات', icon: '👤', desc: 'من هو الأب أو القديس؟ استنتاج ذكي للشخصيات.' },
                { id: 'guess_emoji', title: 'شفرة الرموز', icon: '🎨', desc: 'قصص ومعجزات مرمزة في انتظار من يفك شيفرتها.' },
                { id: 'speed_challenge', title: 'البرق الخاطف', icon: '⚡', desc: 'اختبار فائق للسرعة، لا مجال للتردد في الإجابة.' },
                { id: 'event_ordering', title: 'سجل التاريخ', icon: '🕰️', desc: 'رتب الوقائع التاريخية في سياقها الزمني الصحيح.' }
              ].map((mode) => (
                <motion.button
                  key={mode.id}
                  onClick={() => handleCreateFriendRoom(mode.id)}
                  disabled={isCreating}
                  className="group relative flex flex-col text-right p-6 rounded-[32px] bg-gradient-to-br from-white/5 to-transparent border border-white/10 hover:border-emerald-500/40 hover:from-emerald-500/10 transition-all cursor-pointer overflow-hidden shadow-2xl"
                  whileHover={{ y: -4, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="absolute -top-12 -left-12 w-24 h-24 bg-white/5 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all" />
                  <div className="text-3xl mb-4 self-end">{mode.icon}</div>
                  <h4 className="text-sm font-black text-white mb-2 relative z-10">
                    {mode.title}
                  </h4>
                  <p className="text-[10px] text-slate-400 font-bold leading-relaxed relative z-10">{mode.desc}</p>
                  
                  {/* Decorative indicator */}
                  <div className="absolute bottom-4 left-6 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0">
                    <ArrowRight className="w-4 h-4 text-emerald-400" />
                  </div>
                </motion.button>
              ))}
            </div>

            <div className="text-center pt-4">
              <motion.button
                whileHover={{ x: -4 }}
                onClick={() => setScreen('friend_menu')}
                className="text-[11px] font-black text-slate-500 hover:text-rose-400 transition-all cursor-pointer flex items-center gap-2 mx-auto px-4 py-2 rounded-full hover:bg-rose-500/5"
              >
                <ArrowRight className="w-4 h-4" />
                <span>العدول عن الإنشاء والعودة للمنصة</span>
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* SCREEN: WAITING FRIEND ROOM */}
        {screen === 'waiting_friend_room' && (
          <motion.div 
            key="waiting_friend_room"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="p-8 text-center space-y-8 flex flex-col items-center justify-center max-w-sm mx-auto bg-gradient-to-b from-[#0c1b36] to-[#071329] rounded-[48px] border border-white/5 mt-6 shadow-[0_40px_80px_rgba(0,0,0,0.6)] relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-500" />
            <div className="absolute -top-24 -left-24 w-64 h-64 bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />
            
            <div className="relative">
              <div className="absolute -inset-8 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.2),transparent_70%)] rounded-full blur-xl animate-pulse" />
              <div className="w-20 h-20 bg-emerald-500/10 text-emerald-400 rounded-3xl flex items-center justify-center border border-emerald-500/20 relative z-10 shadow-inner">
                <RefreshCw className="w-10 h-10 animate-spin-slow" />
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-black text-white tracking-tight">في انتظار الرفقاء...</h3>
              <p className="text-[11px] text-slate-400 leading-relaxed font-bold px-4">
                شارك كود الميدان الخاص لتمكين المنافسين من الانضمام لهذه الجلسة المشفرة.
              </p>
            </div>

            {/* Room Code Card (Premium Digital Vault Style) */}
            <div className="w-full space-y-6 relative z-10">
              <div className="bg-white/5 backdrop-blur-2xl rounded-[32px] p-8 border border-white/10 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                
                <span className="text-[9px] text-slate-500 font-black block uppercase tracking-[0.3em] mb-4">ACCESS TOKEN</span>
                <div className="text-4xl font-black font-mono text-amber-400 tracking-[0.2em] mb-8 select-all drop-shadow-glow">{roomCode}</div>
                
                <div className="flex flex-col gap-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      navigator.clipboard.writeText(roomCode);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="w-full bg-white/5 hover:bg-white/10 text-white h-14 rounded-2xl text-[11px] font-black transition-all cursor-pointer flex items-center justify-center gap-3 border border-white/10"
                  >
                    {copied ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5 text-slate-400" />}
                    <span>{copied ? 'تم نسخ الشفرة بنجاح' : 'نسخ شفرة الميدان'}</span>
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => shareViaWhatsApp(roomCode)}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white h-14 rounded-2xl text-[11px] font-black transition-all cursor-pointer flex items-center justify-center gap-3 shadow-xl shadow-emerald-950/40"
                  >
                    <MessageSquare className="w-5 h-5" />
                    <span>دعوة عبر واتساب</span>
                  </motion.button>
                </div>
              </div>

              {/* Expiry Progress/Timer */}
              <div className="flex flex-col items-center gap-3">
                <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: "100%" }}
                    animate={{ width: `${(friendCountdown / 600) * 100}%` }}
                    className="h-full bg-rose-500/50"
                  />
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold">
                  <Clock className="w-3.5 h-3.5 text-rose-500/80" />
                  <span>تنتهي الجلسة خلال:</span>
                  <span className="font-mono text-white bg-white/5 px-2 py-0.5 rounded-md">
                    {Math.floor(friendCountdown / 60)}:{(friendCountdown % 60).toString().padStart(2, '0')}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Connected Players list (Pro Table Style) */}
            <div className="w-full bg-slate-950/60 border border-white/5 rounded-2xl p-3 text-right space-y-2 shadow-xl">
              <h4 className="text-[9px] font-black text-slate-500 border-b border-white/5 pb-1.5 flex items-center gap-1 justify-end">
                <span>اللاعبون المستعدون 👥</span>
              </h4>
              <div className="space-y-1.5 text-[10px]">
                <div className="flex justify-between items-center bg-white/5 p-2 rounded-lg border border-white/5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
                    <span className="text-emerald-400 text-[8px] font-black uppercase">Host</span>
                  </div>
                  <span className="font-black text-slate-200">{currentUser.name}</span>
                </div>
                <div className="flex justify-between items-center bg-black/20 p-2 rounded-lg border border-white/5 opacity-50">
                  <div className="flex items-center gap-1.5">
                    <RefreshCw className="w-3 h-3 text-slate-500 animate-spin" />
                    <span className="text-slate-500 text-[8px] font-black uppercase">Waiting</span>
                  </div>
                  <span className="font-black text-slate-500">جاري البحث عن الخصم...</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                handleLeaveFriendRoom();
                setScreen('friend_menu');
              }}
              className="text-[9px] font-black text-slate-600 hover:text-rose-400 transition-all cursor-pointer py-1"
            >
              إلغاء التحدي والانسحاب
            </button>
          </motion.div>
        )}

        {/* SCREEN: PLAYING FRIEND */}
        {screen === 'playing_friend' && liveRoom && (
          <motion.div 
            key="playing_friend"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="p-2 md:p-4 space-y-4 text-right"
          >
            {/* Realtime Match Score and Progress Bar (Pro Compact) */}
            <div className="bg-[#050b18] text-white rounded-[24px] p-3 md:p-4 border border-blue-500/20 shadow-2xl flex items-center justify-between gap-3 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-transparent to-rose-500/5 pointer-events-none" />
              
              <div className="text-center space-y-1 relative z-10">
                <span className="text-[9px] text-slate-500 block font-black truncate max-w-[80px] uppercase tracking-tighter">{isCreator ? liveRoom.player1Name : 'أنت'}</span>
                <span className="text-base font-black font-mono text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]">{isCreator ? liveRoom.player1Score : liveRoom.player2Score}</span>
                <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden mt-1">
                  <div className="h-full bg-emerald-500" style={{ width: `${(Math.min(5, (isCreator ? liveRoom.player1CurrentIndex : liveRoom.player2CurrentIndex)) / 5) * 100}%` }} />
                </div>
              </div>
              
              <div className="flex-1 px-1 text-center relative z-10">
                <div className="text-slate-500 font-black text-[8px] italic mb-0.5 uppercase tracking-[0.2em]">Live Battle</div>
                <div className="flex justify-center items-center gap-1">
                  <span className="text-[9px] text-amber-500 font-black uppercase tracking-widest animate-pulse">Synced ⚡</span>
                </div>
              </div>

              <div className="text-center space-y-1 relative z-10">
                <span className="text-[9px] text-slate-500 block font-black truncate max-w-[80px] uppercase tracking-tighter">{isCreator ? (liveRoom.player2Name || 'صديقك') : liveRoom.player1Name}</span>
                <span className="text-base font-black font-mono text-rose-500 drop-shadow-[0_0_8px_rgba(244,63,94,0.3)]">{isCreator ? liveRoom.player2Score : liveRoom.player1Score}</span>
                <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden mt-1">
                  <div className="h-full bg-rose-500" style={{ width: `${(Math.min(5, (isCreator ? liveRoom.player2CurrentIndex : liveRoom.player1CurrentIndex)) / 5) * 100}%` }} />
                </div>
              </div>
            </div>

            {/* Question panel */}
            {(() => {
              const currentIndex = localCurrentIndex;
              if (currentIndex < 5) {
                const currentQuestion = liveRoom.questions[currentIndex];
                if (!currentQuestion) return null;

                return (
                  <div className="space-y-4">
                    {/* Timer & Meta (Compact Pro) */}
                    <div className="flex items-center justify-between bg-black/40 border border-white/5 rounded-2xl px-4 py-2 shadow-inner">
                      <div className="flex items-center gap-2">
                        <Clock className={`w-3.5 h-3.5 ${isTimerFrozen ? 'text-cyan-400' : playTimer <= 5 ? 'text-rose-500 animate-pulse' : 'text-slate-500'}`} />
                        <span className={`text-xs font-black font-mono ${isTimerFrozen ? 'text-cyan-400' : playTimer <= 5 ? 'text-rose-500' : 'text-white'}`}>{playTimer}s</span>
                      </div>
                      <div className="text-[9px] font-black text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-lg border border-blue-500/20 uppercase tracking-widest">
                        {selectedMode === 'bible_quiz' ? 'Bible' : selectedMode === 'who_am_i' ? 'Who Am I' : 'Knowledge'} Challenge
                      </div>
                    </div>

                    {/* Question Box (Intense Dark Style) */}
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={currentIndex}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="bg-slate-900/60 backdrop-blur-xl border border-white/5 rounded-[24px] p-5 md:p-6 shadow-2xl text-right space-y-4 relative overflow-hidden"
                      >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
                        <span className="text-[9px] font-black text-amber-500/60 uppercase block tracking-[0.3em]">Quest {currentIndex + 1} of 5</span>
                        <h3 className="text-sm md:text-base font-black text-white leading-relaxed relative z-10">
                          {currentQuestion.question}
                        </h3>
                        
                        {currentQuestion.clues && (
                          <div className="space-y-1.5 pt-3 border-t border-white/5 relative z-10">
                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-wider block">Intelligence Clues:</span>
                            {currentQuestion.clues.map((clue: string, idx: number) => (
                              <p key={idx} className="text-[10px] text-slate-400 font-bold">• {clue}</p>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    </AnimatePresence>

                    {/* Answers Grid (Compact Buttons) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {currentQuestion.options.map((option: string, idx: number) => {
                        const isSelected = userSelectedAnswer === option;
                        const isCorrect = option === currentQuestion.answer;
                        let btnStyle = "bg-slate-900/40 border-white/5 text-slate-300 hover:bg-slate-800/60 hover:border-white/10";

                        if (showExplanation) {
                          if (isCorrect) {
                            btnStyle = "bg-emerald-500/10 border-emerald-500/40 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]";
                          } else if (isSelected) {
                            btnStyle = "bg-rose-500/10 border-rose-500/40 text-rose-400";
                          } else {
                            btnStyle = "bg-transparent border-white/5 text-slate-600 opacity-40";
                          }
                        }

                        return (
                          <motion.button
                            whileHover={!showExplanation ? { scale: 1.02 } : {}}
                            whileTap={!showExplanation ? { scale: 0.98 } : {}}
                            key={idx}
                            onClick={() => handleFriendAnswerSelection(option)}
                            disabled={showExplanation}
                            className={`w-full p-3.5 rounded-xl border text-right transition-all font-bold text-xs flex items-center justify-between cursor-pointer group ${btnStyle}`}
                          >
                            <div className="flex items-center gap-2">
                              {showExplanation && isCorrect && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                              {showExplanation && isSelected && !isCorrect && <XCircle className="w-3.5 h-3.5 text-rose-500" />}
                              <span className="flex-1">{option}</span>
                            </div>
                            <span className="text-[8px] text-slate-600 font-black bg-white/5 px-1.5 py-0.5 rounded group-hover:bg-white/10">{['A', 'B', 'C', 'D'][idx]}</span>
                          </motion.button>
                        );
                      })}
                    </div>

                    {/* Explanation (Dark Glass) */}
                    <AnimatePresence>
                      {showExplanation && currentQuestion.explanation && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-3.5 text-right space-y-1 relative overflow-hidden"
                        >
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500/40" />
                          <span className="text-[9px] font-black text-blue-400 block uppercase tracking-wider">Historical Context 📜</span>
                          <p className="text-[10px] text-slate-300 leading-relaxed font-bold">{currentQuestion.explanation}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              } else {
                return (
                  <div className="flex flex-col items-center justify-center p-8 space-y-4 text-center bg-[#050b18] border border-blue-900/20 rounded-3xl shadow-2xl relative overflow-hidden mt-8">
                    <div className="absolute inset-0 bg-gradient-to-t from-emerald-500/5 to-transparent pointer-events-none" />
                    <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center relative z-10">
                      <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
                    </div>
                    <div className="space-y-1 relative z-10">
                      <h3 className="text-sm font-black text-white uppercase tracking-wide">بانتظار مزامنة النتائج...</h3>
                      <p className="text-[10px] text-slate-500 leading-relaxed font-bold max-w-xs mx-auto">
                        لقد أتممت مهمتك بنجاح. صديقك الآن في المرحلة الأخيرة من المواجهة. استعد للنتيجة النهائية!
                      </p>
                    </div>
                    
                    {/* Live Progress Track (Dark Pro) */}
                    <div className="bg-black/40 border border-white/5 rounded-2xl p-4 w-full max-w-xs space-y-3 text-right shadow-inner relative z-10">
                      <div className="flex justify-between items-center text-[10px] font-black">
                        <span className="text-slate-500">أنت (المنهي)</span>
                        <span className="text-emerald-400 font-mono tracking-tighter">MISSION COMPLETE ✅</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] font-black">
                        <span className="text-slate-500">{isCreator ? (liveRoom.player2Name || 'الخصم') : liveRoom.player1Name}</span>
                        <span className="text-amber-500 font-mono animate-pulse">
                          {isCreator 
                            ? (liveRoom.player2CurrentIndex === 5 ? "SYNCING..." : `QUEST ${liveRoom.player2CurrentIndex}/5`) 
                            : (liveRoom.player1CurrentIndex === 5 ? "SYNCING..." : `QUEST ${liveRoom.player1CurrentIndex}/5`)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              }
            })()}
          </motion.div>
        )}

        {/* SCREEN: RESULTS FRIEND */}
        {screen === 'results_friend' && liveRoom && (
          <motion.div 
            key="results_friend"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="p-4 space-y-6 text-center flex flex-col items-center bg-[#050b18] rounded-[32px] border border-blue-900/30 m-2 shadow-2xl relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-transparent pointer-events-none" />

            {/* Outcome Display (Intense Pro Style) */}
            <div className="space-y-4 relative z-10 w-full flex flex-col items-center">
              {outcome === 'win' && (
                <motion.div 
                  initial={{ scale: 0.8, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  className="space-y-4 flex flex-col items-center"
                >
                  <div className="relative">
                    <motion.div 
                      animate={{ rotate: 360 }}
                      transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                      className="absolute -inset-10 bg-emerald-400/20 rounded-full blur-2xl"
                    />
                    <div className="w-20 h-20 bg-emerald-500/10 rounded-3xl flex items-center justify-center text-5xl shadow-[0_0_30px_rgba(16,185,129,0.3)] border border-emerald-400/30 relative z-10">
                      🏆
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-black text-white uppercase tracking-wider">انتصار ساحق في الميدان ⚔️</h3>
                    <p className="text-[10px] text-slate-400 font-bold max-w-[240px] mx-auto">
                      لقد أثبت جدارتك وتفوقت ببراعة على <span className="text-emerald-400">{isCreator ? (liveRoom.player2Name || 'الخصم') : liveRoom.player1Name}</span>.
                    </p>
                  </div>
                </motion.div>
              )}
              {outcome === 'loss' && (
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="space-y-4 flex flex-col items-center"
                >
                  <div className="w-20 h-20 bg-rose-500/10 rounded-3xl flex items-center justify-center text-5xl shadow-[0_0_30px_rgba(244,63,94,0.2)] border border-rose-400/20">
                    🛡️
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-black text-white uppercase tracking-wider">تراجع تكتيكي مؤقت!</h3>
                    <p className="text-[10px] text-slate-400 font-bold max-w-[240px] mx-auto">
                      الخصم <span className="text-rose-400">{isCreator ? (liveRoom.player2Name || 'الخصم') : liveRoom.player1Name}</span> كان أكثر سرعة هذه المرة. الميدان ينتظر انتقامك!
                    </p>
                  </div>
                </motion.div>
              )}
              {outcome === 'draw' && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-4 flex flex-col items-center"
                >
                  <div className="w-20 h-20 bg-slate-500/10 rounded-3xl flex items-center justify-center text-5xl shadow-xl border border-white/5">
                    🤝
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-black text-white uppercase tracking-wider">تعادل العمالقة!</h3>
                    <p className="text-[10px] text-slate-400 font-bold max-w-[240px] mx-auto">لقد تساوت القوى في هذا الصدام العنيف. من سيحسم الجولة القادمة؟</p>
                  </div>
                </motion.div>
              )}

              {/* Final Score Table (Pro Style) */}
              <div className="w-full max-w-xs bg-black/40 border border-white/5 rounded-2xl overflow-hidden mt-4">
                <div className="grid grid-cols-2 text-[9px] font-black text-slate-500 border-b border-white/5 bg-white/5 py-2 px-4 uppercase tracking-widest">
                  <span>Player Entity</span>
                  <span className="text-left">Combat Score</span>
                </div>
                <div className="p-1">
                  <div className={`flex justify-between items-center p-3 rounded-xl ${outcome === 'win' ? 'bg-emerald-500/5 border border-emerald-500/10' : 'bg-transparent'}`}>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center text-[10px] text-emerald-400 border border-emerald-500/20">A</div>
                      <span className="text-[10px] font-black text-slate-200">أنت</span>
                    </div>
                    <span className="text-xs font-black font-mono text-emerald-400 tracking-tighter">{isCreator ? liveRoom.player1Score : liveRoom.player2Score} PTS</span>
                  </div>
                  <div className={`flex justify-between items-center p-3 rounded-xl mt-1 ${outcome === 'loss' ? 'bg-rose-500/5 border border-rose-500/10' : 'bg-transparent'}`}>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-rose-500/10 flex items-center justify-center text-[10px] text-rose-400 border border-rose-400/20">B</div>
                      <span className="text-[10px] font-black text-slate-200">{isCreator ? (liveRoom.player2Name || 'صديقك') : liveRoom.player1Name}</span>
                    </div>
                    <span className="text-xs font-black font-mono text-rose-400 tracking-tighter">{isCreator ? liveRoom.player2Score : liveRoom.player1Score} PTS</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons (Pro Compact) */}
              <div className="flex flex-col gap-2 w-full max-w-xs mt-2">
                <button
                  onClick={() => setScreen('create_friend_room')}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[11px] font-black transition-all shadow-lg active:scale-95 border border-white/10 uppercase tracking-wide"
                >
                  إعادة التحدي فوراً ⚔️
                </button>
                <button
                  onClick={() => {
                    handleLeaveFriendRoom();
                    setScreen('friend_menu');
                  }}
                  className="w-full py-3 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl text-[11px] font-black transition-all border border-white/5 uppercase tracking-wide"
                >
                  الانسحاب للقائمة الرئيسية
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* SCREEN 4: PLAYING THE MATCH */}
        {screen === 'playing' && questions.length > 0 && (
          <motion.div 
            key="playing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-6 p-2 max-w-lg mx-auto relative z-10 animate-fade-in"
          >
            {/* Premium Live HUD */}
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 via-transparent to-rose-500/20 rounded-[32px] blur-sm pointer-events-none" />
              <div className="grid grid-cols-3 gap-2 bg-[#0d1b3e]/90 backdrop-blur-xl text-white rounded-[32px] p-5 border border-white/5 items-center shadow-2xl relative z-10">
                {/* You */}
                <div className="text-center space-y-1">
                  <span className="text-[9px] font-black text-slate-400 block tracking-widest uppercase">محارب</span>
                  <div className="text-2xl font-black text-emerald-400 font-mono tracking-tighter">{userScore}</div>
                </div>

                {/* Match Info */}
                <div className="text-center border-x border-white/5 flex flex-col items-center px-2 space-y-2">
                  <div className="bg-white/5 border border-white/10 px-3 py-1 rounded-full">
                    <span className="text-[10px] font-black text-blue-300 tracking-tighter">جولة {currentQuestionIndex + 1} / {questions.length}</span>
                  </div>
                  <div className={`flex items-center gap-1.5 font-black justify-center ${isTimerFrozen ? 'text-cyan-400' : 'text-[#F5C542]'}`}>
                    <Clock className={`w-4 h-4 ${isTimerFrozen ? '' : 'animate-pulse'}`} />
                    <span className="text-base font-mono leading-none">{playTimer}s</span>
                  </div>
                </div>

              {/* Opponent */}
                <div className="text-center space-y-1 relative">
                  <span className="text-[9px] font-black text-slate-400 block tracking-widest uppercase truncate max-w-[80px] mx-auto">{opponent?.name || 'الخصم'}</span>
                  <div className="text-2xl font-black text-rose-400 font-mono tracking-tighter">{opponentScore}</div>
                </div>
              </div>
            </div>

            <ChatComponent roomId={roomCode || 'random_match_global'} senderName={currentUser.name || 'لاعب'} />

            {/* Dynamic Tug-of-War Progress */}
            <div className="relative px-2">
              <div className="w-full bg-black/40 h-4 rounded-full flex overflow-hidden border border-white/5 p-1 shadow-inner relative">
                <motion.div 
                  initial={{ width: "50%" }}
                  animate={{ width: `${(userScore / (userScore + opponentScore || 1)) * 100}%` }}
                  transition={{ duration: 0.8, ease: "circOut" }}
                  className="bg-gradient-to-r from-emerald-600 to-teal-400 h-full rounded-l-full relative"
                >
                  <div className="absolute inset-0 bg-white/20 opacity-30 animate-pulse" />
                </motion.div>
                <motion.div 
                  initial={{ width: "50%" }}
                  animate={{ width: `${(opponentScore / (userScore + opponentScore || 1)) * 100}%` }}
                  transition={{ duration: 0.8, ease: "circOut" }}
                  className="bg-gradient-to-l from-rose-600 to-red-500 h-full rounded-r-full relative"
                >
                  <div className="absolute inset-0 bg-white/20 opacity-30 animate-pulse" />
                </motion.div>
                {/* Center marker */}
                <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-white/20 -translate-x-1/2 z-20" />
              </div>
            </div>

            {/* Active Question Box - Premium Editorial Card */}
            {showTutorial && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-[#0A1128] border border-emerald-500/50 p-6 rounded-[32px] text-center text-white max-w-sm w-full shadow-[0_0_40px_rgba(16,185,129,0.3)] relative overflow-hidden"
                >
                  <div className="absolute top-0 inset-x-0 h-32 bg-emerald-500/10 blur-3xl" />
                  
                  <div className="relative z-10">
                    <span className="text-4xl mb-4 block">🧰</span>
                    <h2 className="text-2xl font-black mb-2 text-emerald-400">أدوات التحدي</h2>
                    <p className="text-sm text-slate-300 mb-6 font-bold leading-relaxed">
                      استخدم هذه الأدوات بذكاء لتجاوز الأسئلة الصعبة
                    </p>

                    <div className="space-y-4 mb-8 text-right">
                      <div className="flex items-center gap-4 bg-slate-800/50 p-3 rounded-2xl border border-slate-700/50">
                        <span className="text-3xl">✂️</span>
                        <div>
                          <h4 className="font-black text-amber-400 text-sm">حذف إجابتين</h4>
                          <p className="text-xs text-slate-300 font-bold mt-1">يزيل إجابتين غير صحيحتين.</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4 bg-slate-800/50 p-3 rounded-2xl border border-slate-700/50">
                        <span className="text-3xl">⏸️</span>
                        <div>
                          <h4 className="font-black text-sky-400 text-sm">تجميد الوقت</h4>
                          <p className="text-xs text-slate-300 font-bold mt-1">يوقف المؤقت لمدة 10 ثوانٍ.</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 bg-slate-800/50 p-3 rounded-2xl border border-slate-700/50">
                        <span className="text-3xl">❤️</span>
                        <div>
                          <h4 className="font-black text-rose-400 text-sm">فرصة إضافية</h4>
                          <p className="text-xs text-slate-300 font-bold mt-1">يمنحك محاولة ثانية إذا أخطأت.</p>
                        </div>
                      </div>
                    </div>

                    <button 
                      onClick={() => setShowTutorial(false)} 
                      className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-6 py-4 rounded-2xl font-black text-lg shadow-[0_4px_15px_rgba(16,185,129,0.4)] active:scale-95 transition-transform"
                    >
                      ابدأ التحدي
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentQuestionIndex}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                className="bg-gradient-to-b from-[#122244] to-[#0a152b] border border-white/10 rounded-[36px] p-8 shadow-[0_30px_60px_rgba(0,0,0,0.5)] relative text-center overflow-hidden min-h-[160px] flex flex-col items-center justify-center group"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 opacity-30" />
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl group-hover:bg-blue-500/10 transition-colors" />
                
                <div className="mb-4 inline-flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-1.5 rounded-full">
                  <HelpCircle className="w-4 h-4 text-[#F5C542]" />
                  <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">سؤال التحدي</span>
                </div>

                <h3 className="text-lg md:text-xl font-black text-white leading-tight mb-2 tracking-tight">
                  {questions[currentQuestionIndex]?.question || 'جاري التحميل...'}
                </h3>
                
                <div className="mt-4 flex gap-1">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full bg-blue-500/20" />
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Premium Multiple Choice Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {questions[currentQuestionIndex].options.filter(o => !removedAnswers.includes(o)).map((option: string) => {
                const isSelected = userSelectedAnswer === option;
                const isCorrect = option === questions[currentQuestionIndex].answer;
                
                let optClass = 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-200';
                if (userSelectedAnswer !== null) {
                  if (isCorrect) {
                    optClass = 'bg-gradient-to-br from-emerald-600 to-teal-700 text-white border-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.3)] z-10 scale-105';
                  } else if (isSelected) {
                    optClass = 'bg-gradient-to-br from-rose-600 to-red-700 text-white border-rose-400 shadow-[0_0_30px_rgba(244,63,94,0.3)] z-10 scale-105';
                  } else {
                    optClass = 'bg-black/40 text-slate-600 border-white/5 opacity-40 grayscale';
                  }
                }

                return (
                  <motion.button
                    key={option}
                    disabled={userSelectedAnswer !== null}
                    onClick={() => handleAnswerSelection(option)}
                    className={`group w-full text-right p-5 rounded-[24px] border-2 transition-all font-black text-sm flex items-center justify-between cursor-pointer relative overflow-hidden ${optClass}`}
                    whileHover={userSelectedAnswer === null ? { y: -2, scale: 1.02 } : {}}
                    whileTap={userSelectedAnswer === null ? { scale: 0.98 } : {}}
                  >
                    <div className="absolute inset-0 bg-white/[0.02] opacity-0 group-hover:opacity-100 transition-opacity" />
                    <span className="relative z-10">{option}</span>
                    <div className="relative z-10">
                      {userSelectedAnswer !== null && isCorrect && (
                        <CheckCircle2 className="w-5 h-5 text-white filter drop-shadow-md" />
                      )}
                      {userSelectedAnswer !== null && isSelected && !isCorrect && (
                        <XCircle className="w-5 h-5 text-white filter drop-shadow-md" />
                      )}
                      {userSelectedAnswer === null && (
                        <div className="w-6 h-6 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                          <ArrowRight className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </div>
                  </motion.button>
                );
              })}
            </div>

            {/* Retry Feedback Animation */}
            <AnimatePresence>
              {showRetryMessage && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8, y: -20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8, y: 20 }}
                  className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none"
                >
                  <div className="bg-red-500/20 backdrop-blur-xl border border-red-500/50 p-6 rounded-[32px] text-center shadow-[0_0_40px_rgba(239,68,68,0.4)] relative overflow-hidden flex flex-col items-center gap-4">
                    <motion.div
                      animate={{ scale: [1, 1.2, 1], opacity: [0.8, 1, 0.8] }}
                      transition={{ duration: 1, repeat: Infinity }}
                      className="absolute inset-0 bg-red-500/20 blur-xl"
                    />
                    <div className="relative z-10 text-4xl">❤️</div>
                    <h3 className="relative z-10 text-xl font-black text-red-100">لديك فرصة إضافية!</h3>
                    <p className="relative z-10 text-sm text-red-200/80 font-bold">لا تستسلم، حاول مرة أخرى</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <SmartAssistBar 
              usedAssists={usedAssists}
              onUseAssist={useAssist}
              canUseRetry={canRetry}
              questionIndex={currentQuestionIndex}
            />

            {/* Immersive Explanation Box */}
            <AnimatePresence>
              {showExplanation && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className="bg-amber-500/5 backdrop-blur-xl border border-amber-500/20 rounded-[28px] p-6 text-right relative overflow-hidden shadow-2xl"
                >
                  <div className="absolute -top-10 -left-10 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl" />
                  <div className="flex items-start gap-4 justify-end relative z-10">
                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center justify-end gap-2 text-amber-400 font-black text-[10px] uppercase tracking-widest">
                        <span>نور من المعرفة</span>
                        <Lightbulb className="w-3.5 h-3.5" />
                      </div>
                      <p className="text-xs text-slate-200 leading-relaxed font-bold">
                        {questions[currentQuestionIndex].hint || 'استعد للسؤال القادم، السرعة هي مفتاح الغلبة في هذا الميدان!'}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* SCREEN 5: GAME OVER / POST-MATCH RESULTS */}
        {screen === 'results' && (
          <motion.div 
            key="results"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="p-4 space-y-6 text-center flex flex-col items-center bg-[#0b1b36]/40 backdrop-blur-md rounded-3xl border border-blue-500/10 max-w-md mx-auto shadow-2xl relative"
          >
            {/* Glowing backgrounds */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Immersive Outcome Header */}
            <div className="relative w-full py-8 overflow-visible">
              {outcome === 'win' && (
                <motion.div 
                  initial={{ scale: 0, rotate: -15 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', damping: 12, stiffness: 100 }}
                  className="space-y-4 flex flex-col items-center relative z-10"
                >
                  <div className="relative">
                    <motion.div 
                      animate={{ scale: [1, 1.2, 1], rotate: 360 }}
                      transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                      className="absolute -inset-12 bg-[radial-gradient(circle_at_center,rgba(245,197,66,0.3),transparent_70%)] rounded-full blur-2xl"
                    />
                    <div className="w-32 h-32 bg-gradient-to-br from-[#F5C542] via-amber-400 to-yellow-600 rounded-full flex items-center justify-center text-6xl shadow-[0_20px_50px_rgba(245,197,66,0.4)] border-4 border-white/20 relative z-10">
                      🏆
                    </div>
                    <motion.div 
                      animate={{ y: [-10, 10, -10], opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="absolute -top-6 -right-6 text-4xl"
                    >
                      ✨
                    </motion.div>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-3xl font-black text-white tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-yellow-200 via-amber-400 to-yellow-500">نصرٌ مـؤزر!</h3>
                    <p className="text-[11px] text-emerald-400 font-black uppercase tracking-[0.2em]">تمت السيطرة على الميدان بنجاح</p>
                  </div>
                </motion.div>
              )}
              
              {outcome === 'loss' && (
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="space-y-4 flex flex-col items-center relative z-10"
                >
                  <div className="w-28 h-28 bg-[#122244] rounded-[40px] flex items-center justify-center text-5xl shadow-2xl border-2 border-rose-500/30 opacity-90 relative">
                    <div className="absolute inset-0 bg-rose-500/10 rounded-[40px] blur-xl" />
                    ⚔️
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-2xl font-black text-white tracking-tight">كبوة جـواد..</h3>
                    <p className="text-[11px] text-rose-400 font-black uppercase tracking-[0.2em]">تراجع مؤقت لإعادة رص الصفوف</p>
                  </div>
                </motion.div>
              )}

              {outcome === 'draw' && (
                <motion.div 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="space-y-4 flex flex-col items-center relative z-10"
                >
                  <div className="w-28 h-28 bg-[#122244] rounded-full flex items-center justify-center text-5xl shadow-2xl border-2 border-slate-500/30">
                    🤝
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-2xl font-black text-white tracking-tight">تـعادل الـكبار</h3>
                    <p className="text-[11px] text-slate-400 font-black uppercase tracking-[0.2em]">مواجهة متكافئة حتى الرمق الأخير</p>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Premium Match Statistics */}
            <div className="w-full max-w-sm space-y-4 relative z-10">
              <div className="grid grid-cols-3 gap-3 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[32px] p-6 items-center shadow-2xl">
                <div className="text-center">
                  <span className="text-[9px] font-black text-slate-500 block uppercase mb-1">أنت</span>
                  <span className="text-3xl font-black text-emerald-400 font-mono tracking-tighter">{userScore}</span>
                </div>
                <div className="flex flex-col items-center justify-center gap-1">
                  <div className="h-px w-8 bg-white/20" />
                  <span className="text-[10px] font-black text-slate-600">ضد</span>
                  <div className="h-px w-8 bg-white/20" />
                </div>
                <div className="text-center">
                  <span className="text-[9px] font-black text-slate-500 block uppercase mb-1">{opponent?.name || 'الخصم'}</span>
                  <span className="text-3xl font-black text-rose-400 font-mono tracking-tighter">{opponentScore}</span>
                </div>
              </div>

              {/* Rewards Panel - Glass Card */}
              <motion.div 
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="bg-gradient-to-b from-white/10 to-transparent backdrop-blur-2xl border border-white/10 rounded-[40px] p-8 shadow-3xl text-right relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
                
                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest border-b border-white/5 pb-4 mb-6 flex items-center gap-2 justify-end">
                  <span>غنـائم الـمواجهة</span>
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                </h4>
                
                <div className="grid grid-cols-2 gap-4">
                  {/* Rating Delta */}
                  <div className="bg-black/20 border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center space-y-1">
                    <span className="text-[9px] font-black text-amber-500/80 uppercase">الرتبة</span>
                    <div className="flex items-center gap-1.5 font-black text-xl font-mono">
                      {outcome === 'win' ? (
                        <span className="text-emerald-400">+{25}</span>
                      ) : outcome === 'loss' ? (
                        <span className="text-rose-400">-{15}</span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </div>
                  </div>

                  {/* XP Gain */}
                  <div className="bg-black/20 border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center space-y-1">
                    <span className="text-[9px] font-black text-blue-500/80 uppercase">الخبرة</span>
                    <span className="text-blue-300 font-mono text-xl font-black">+{outcome === 'win' ? 50 : outcome === 'loss' ? 15 : 20}</span>
                  </div>

                  {/* Points Gain */}
                  <div className="bg-black/20 border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center space-y-1 col-span-2">
                    <span className="text-[9px] font-black text-purple-500/80 uppercase">نقاط المكافأة</span>
                    <div className="flex items-center gap-2 text-purple-300 font-mono text-xl font-black">
                      <span>+{outcome === 'win' ? 20 : outcome === 'loss' ? 5 : 10}</span>
                      <span className="text-sm">🪙</span>
                    </div>
                  </div>
                </div>

                <div className="mt-8 bg-black/40 rounded-2xl p-4 border border-white/5">
                  <p className="text-[10px] text-slate-400 font-medium text-center leading-relaxed">
                    رصيدك الحالي: <span className="text-white font-black">{rating}</span> نقطة • الرتبة: <span className="text-blue-400 font-black tracking-tight">{userLeague.name}</span>
                  </p>
                </div>
              </motion.div>
            </div>

            {/* Premium Post-Game Actions */}
            <div className="flex flex-col gap-4 w-full max-w-sm pt-4 relative z-10">
              <motion.button
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={startSearching}
                className="w-full h-16 bg-gradient-to-r from-[#F5C542] via-amber-500 to-amber-600 text-slate-950 rounded-2xl font-black text-sm shadow-[0_15px_35px_rgba(245,197,66,0.25)] flex items-center justify-center gap-3 cursor-pointer border-t border-white/40"
              >
                <RefreshCw className="w-5 h-5" />
                <span>خوض تحدي جديد فوراً</span>
              </motion.button>

              <div className="grid grid-cols-2 gap-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSendFriendRequest}
                  disabled={friendStatus !== 'none' || isSendingRequest}
                  className={`h-14 rounded-2xl font-black text-[11px] shadow-xl transition-all flex items-center justify-center gap-2 border ${
                    friendStatus === 'accepted' 
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' 
                      : friendStatus === 'pending'
                      ? 'bg-amber-500/15 text-amber-400 border-amber-500/20'
                      : 'bg-white/5 text-slate-300 border-white/10'
                  }`}
                >
                  {friendStatus === 'accepted' ? 'رفيق متصل' : friendStatus === 'pending' ? 'الطلب معلق' : 'طلب صداقة'}
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setScreen('menu');
                  }}
                  className="bg-white/5 hover:bg-white/10 text-slate-300 h-14 rounded-2xl font-black text-[11px] transition-all cursor-pointer border border-white/10 shadow-xl"
                >
                  الخروج للمنصة
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}

      </AnimatePresence>

      {roomCode && ['waiting_friend_room', 'playing_friend', 'results_friend'].includes(screen) && (
        <FriendChat
          roomCode={roomCode}
          currentUser={currentUser}
          liveRoom={liveRoom}
        />
      )}

      {/* Coptic church portal footnote */}
      <p className="text-[9px] text-slate-400 font-bold text-center mt-6">
        بوابة مباراة عشوائية الذكية © كنيستنا دوت كوم ٢٠٢٦
      </p>
    </div>
  );
}
