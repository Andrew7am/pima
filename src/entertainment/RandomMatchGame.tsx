import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import {
  Trophy, User, CheckCircle2, XCircle, Clock, ArrowRight, Sparkles, BookOpen,
  Star, RefreshCw, LogIn, Copy, Plus, Users, LogOut, MessageSquare, Shield,
  Timer, TrendingUp, Zap, Coins, Gift, ChevronLeft
} from 'lucide-react';
import { User as UserType } from '../types';
import { xpToNext, xpProgressPct } from './progress';
import { getLeague } from './leagues';
import { awardGameReward } from '../lib/db';
import { shareToWhatsApp, SITE_URL } from '../lib/openExternal';
import { findOrCreateRandomRoom } from './multiplayer';
import { buildRandomMatchQuestions } from './multiplayer/matchQuestions';
import MatchBannerScene from './multiplayer/MatchBannerScene';
import { FriendChat } from './FriendChat';
import { triggerHaptic } from '../lib/haptic';
import { playSound, toggleBackgroundMusic } from '../lib/sounds';
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
  /** Opens the rewards screen. The daily-rewards card is only rendered when
   *  this is provided, since there is nowhere for it to go otherwise. */
  onOpenRewards?: () => void;
  /** Hands a real matchmade room to the live match screen. Required — there
   *  is no longer a scripted fallback to degrade to. */
  onEnterMatch: (roomId: string) => void;
  /** Start a local match against a bot. Nothing is at stake. */
  onOpenPractice?: () => void;
}


// The league table lives in leagues.ts. This file used to carry a second
// copy whose names had emoji baked in — «مبتدئ 🥉» against the shared
// «مبتدئ» — so the same tier was spelled two ways depending on the screen.


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


export default function RandomMatchGame({ 
  currentUser, 
  onUpdateUser, 
  onClose,
  isSoundEnabled = true,
  isMusicEnabled = true,
  onOpenRewards,
  onEnterMatch,
  onOpenPractice
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
  // Competitive rating. Seeded from the account's own rating rather than a
  // bare 75, so the league chip on this screen agrees with the one
  // EntertainmentHome and LiveMatchGame draw from users.rating — they all
  // call getLeague on it, and a user the rest of the app calls «معلم» was
  // being shown «مبتدئ» here. Still kept in localStorage afterwards: this
  // screen's matches never reach finalize_match, so it has nothing else to
  // write to.
  // Read straight off the account, every render. This was state seeded from
  // localStorage, so once written it never looked at users.rating again — and
  // the friend match kept writing to it. Two ratings, drifting apart, with
  // this screen the only one reading the local copy.
  const rating = currentUser.rating ?? 100;

  const [streak, setStreak] = useState<number>(() => {
    const saved = localStorage.getItem('coptic_random_match_streak');
    return saved ? parseInt(saved, 10) : 0;
  });

  // Game States
  // Real progression, read rather than decorated. The header used to print
  // `Lv. {currentUser.level || 23}` — and the 23 in the approved design is
  // that very fallback, photographed and handed back. `||` also fires on a
  // legitimate 0, so a placeholder behind it can never be told from data.
  // Real matchmaking state, separate from the scripted flow below.
  const [findingMatch, setFindingMatch] = useState(false);
  const [matchError, setMatchError] = useState('');
  const userLevel = currentUser.level ?? 1;
  const userXp = currentUser.xp ?? 0;

  const [screen, setScreen] = useState<'league_info' | 'friend_menu' | 'create_friend_room' | 'waiting_friend_room' | 'playing_friend' | 'results_friend'>('league_info');
  const [selectedMode, setSelectedMode] = useState<string>('all_mixed');
  
  // Search state
  const searchIntervalRef = useRef<any>(null);

  // Assists state
  const [isTimerFrozen, setIsTimerFrozen] = useState(false);
  const isTimerFrozenRef = useRef(false);

  // ... existing code ...


  const [userScore, setUserScore] = useState(0);
  const [userSelectedAnswer, setUserSelectedAnswer] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
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

  // Anonymous Firebase sign-in, needed by the friend-room (Firestore) path.
  //
  // The friends/requests subscriptions that used to live here fed the
  // «طلب صداقة» button on the scripted results screen — where the opponent
  // was one of seven names in this file. With that screen gone the state had
  // no reader. The real match has no add-friend control of its own yet.
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (!auth.currentUser) {
          await signInAnonymously(auth).catch((err) => {
            console.warn('Anonymous auth disabled or restricted:', err.message);
          });
        }
      } catch {
        console.warn('Auth initialization skipped');
      }
    };
    initAuth();
  }, []);




  /**
   * Share the room code.
   *
   * Two things were wrong with this and both made the button useless. It
   * called window.open(url, '_blank'), which is a silent no-op inside the
   * Capacitor Android WebView — the tap did nothing at all. And the message
   * ended in `https://yourapp.com/download`, a placeholder nobody ever
   * replaced, so anyone who did receive it got a dead link.
   */
  /** What the last invite attempt did, so the button can say so. */
  const [shareNote, setShareNote] = useState<string | null>(null);

  const shareViaWhatsApp = async (code: string) => {
    const message = [
      '🎮 تعالى نلعب مع بعض على بيما!',
      '',
      `🔑 كود الغرفة: ${code}`,
      '',
      '📲 افتح اللعبة، اختار «العب مع صاحبك» واكتب الكود.',
      '',
      SITE_URL,
    ].join('\n');
    setShareNote(null);
    const outcome = await shareToWhatsApp(message);
    // Only worth saying something when WhatsApp did NOT take over — if it
    // did, the player is already in WhatsApp and will never see this.
    if (outcome === 'copied') {
      setShareNote('الدعوة اتنسخت — افتح واتساب والصقها.');
    } else if (outcome === 'failed') {
      setShareNote('مقدرناش نفتح واتساب. انسخ كود الغرفة وابعته بنفسك.');
    }
  };

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
          setScreen('league_info');
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
        setScreen('league_info');
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
    if (screen !== 'results_friend' || !liveRoom || hasRewardedFriend) return;
    setHasRewardedFriend(true);
    void (async () => {
      const myScore = isCreator ? liveRoom.player1Score : liveRoom.player2Score;
      const oppScore = isCreator ? liveRoom.player2Score : liveRoom.player1Score;

      let matchOutcome: 'win' | 'loss' | 'draw' = 'win';
      let xpGain = 15;
      let coinsGain = 5;

      if (myScore > oppScore) {
        matchOutcome = 'win';
        xpGain = 50;
        coinsGain = 20;
        setStreak(s => s + 1);
      } else if (myScore < oppScore) {
        matchOutcome = 'loss';
        xpGain = 15;
        coinsGain = 5;
        setStreak(0);
      } else {
        matchOutcome = 'draw';
        xpGain = 20;
        coinsGain = 10;
      }

      setOutcome(matchOutcome);
      if (matchOutcome === 'win') {
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 }
        });
      }

      // Awarded by the server, like every other game in the app.
      //
      // This used to compute the reward here and write xp/points/level
      // straight onto the user — which migration 036's
      // protect_user_privileged_columns() silently reverts. The screen showed
      // the numbers going up and the database threw them away; the next load
      // had none of it. It also paid into `points`, the BOOKING loyalty
      // balance where 100 points is one EGP, rather than into game coins.
      //
      // The rating line is gone too. A friend match is a casual game against
      // someone you chose; it has no matchmaking and no server settlement, and
      // it was moving a SECOND rating kept in localStorage that nothing else
      // in the app can see — so this screen's league badge drifted further
      // from every other screen's with each game played. One rating,
      // server-owned, moved only by competitive matches.
      const result = await awardGameReward(
        xpGain,
        coinsGain,
        myScore,
        `مباراة مع صاحب — ${myScore} مقابل ${oppScore}`,
      );
      if (result) {
        onUpdateUser({ ...currentUser, xp: result.xp, level: result.level, gameCoins: result.gameCoins });
      }
    })();
  }, [screen, liveRoom, hasRewardedFriend, isCreator, currentUser, onUpdateUser]);

  /**
   * Find a real opponent.
   *
   * find_or_create_random_room either drops the player into someone else's
   * waiting room — matched on rating, closest first, within ±500 — or opens
   * one and leaves it waiting. Either way the live match screen takes it from
   * there: it renders the waiting state, flips to VS the moment a second
   * player arrives, and settles rating, XP and coins server-side through
   * finalize_match. Nothing about the opponent is decided on this device.
   *
   * What this replaces: a timer where `Math.random() > 0.7` decided a match
   * had been "found", the opponent was one of seven names written into this
   * file, and their answers were `Math.random() < 0.75`.
   */
  const startRealMatch = async () => {
    triggerHaptic('light');
    playSound('click');
    setMatchError('');
    setFindingMatch(true);
    try {
      const result = await findOrCreateRandomRoom('trivia', buildRandomMatchQuestions());
      if (!result) {
        setMatchError('تعذّر البحث عن خصم دلوقتي. تأكد من اتصالك وحاول تاني.');
        return;
      }
      onEnterMatch(result.roomId);
    } catch (err) {
      console.error('startRealMatch:', err);
      setMatchError('تعذّر البحث عن خصم دلوقتي. تأكد من اتصالك وحاول تاني.');
    } finally {
      setFindingMatch(false);
    }
  };

  const userLeague = getLeague(rating);

  return (
    <div className="bg-[var(--color-play-card)] text-slate-100 rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.8)] border border-blue-900/40 p-1.5 md:p-4 text-right dir-rtl font-sans relative min-h-[750px]">

      
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
          <button aria-label="مفاجآت ومكافآت" className="bg-[var(--color-play-card-raised)] hover:bg-[#1b3266] text-slate-300 hover:text-white border border-blue-500/20 p-2.5 rounded-xl transition-all cursor-pointer relative">
            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border border-[#0d1b3e] animate-pulse" />
            <Sparkles className="w-4 h-4 text-[var(--color-play-reward)]" />
          </button>
        </div>

        {/* Center: Branding Logo */}
        <div className="text-center flex-1 min-w-[120px]">
          <div className="flex items-center justify-center gap-1.5">
            <span className="text-[var(--color-play-reward)] font-black text-lg animate-pulse">~</span>
            <span className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[var(--color-play-reward)] via-white to-[var(--color-play-reward)] tracking-widest font-sans drop-shadow-[0_2px_8px_rgba(245,197,66,0.2)]">PiMã</span>
            <span className="text-[var(--color-play-reward)] font-black text-lg animate-pulse">~</span>
          </div>
          <p className="text-[9px] text-slate-400 font-bold tracking-tight">بدون إعلانات | تجربة نقية</p>
        </div>

        {/* The level chip and avatar that used to sit here are the profile
            card below now — one copy, and one that reads real values. This
            one printed `Lv. {currentUser.level || 23}` over a bar hardcoded
            to 75%, and stood a few pixels from the card that shows the
            truth. Shown on the inner screens only, where there is no card. */}
        <div className={`items-center gap-2.5 bg-[#122244]/80 border border-blue-500/20 rounded-2xl px-3 py-1.5 shadow-inner ${screen === 'league_info' ? 'hidden' : 'flex'}`}>
          <div className="text-left">
            <div className="flex items-center gap-1 justify-end">
              <span className="text-[9px] font-black text-[var(--color-play-reward)]">Lv. {userLevel}</span>
            </div>
            <div className="bg-slate-900 rounded-full h-1.5 w-12 overflow-hidden border border-blue-900/30 mt-0.5">
              <div className="bg-gradient-to-r from-blue-500 to-cyan-400 h-full" style={{ width: `${xpProgressPct(userXp, userLevel)}%` }} />
            </div>
          </div>
          <div className="relative">
            <img
              src={currentUser.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80"}
              alt="avatar"
              className="w-8 h-8 rounded-full border-2 border-[var(--color-play-reward)] object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[var(--color-play-card-raised)]" />
          </div>
        </div>
      </div>

      {/* Profile card — replaces the old «الحساب الحالي» strip, whose only
          control was a «تغيير» button with no onClick. Every number here is
          read, not decorated: level and xp are real columns, and the bar is
          computed by progress.ts, which is the one file guaranteed to agree
          with the server's level*200 rule. */}
      {screen === 'league_info' && (
        <div className="relative z-10 bg-gradient-to-l from-[#0b1b36] to-[#071329] border border-blue-500/15 rounded-2xl p-3.5 shadow-lg mb-4 max-w-md mx-auto w-full">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative shrink-0">
                {currentUser.avatar ? (
                  <img src={currentUser.avatar} alt="" referrerPolicy="no-referrer"
                    className="w-12 h-12 rounded-full border-2 border-[var(--color-play-reward)] object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-full border-2 border-[var(--color-play-reward)] bg-[var(--color-play-card-raised)] flex items-center justify-center">
                    <User className="w-5 h-5 text-[var(--color-play-reward)]" />
                  </div>
                )}
                <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-[#0b1b36]" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] text-slate-400 font-bold">مرحباً بك</p>
                <p className="text-sm font-black text-white truncate">{currentUser.name} 👋</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <div className="text-left">
                <p className="text-[9px] text-slate-400 font-bold">المستوى</p>
                <p className="text-[10px] font-black text-slate-200 font-mono" dir="ltr">
                  XP {userXp} / {xpToNext(userLevel)}
                </p>
                <div className="bg-slate-900 rounded-full h-1.5 w-24 overflow-hidden border border-blue-900/30 mt-1">
                  <div className="bg-gradient-to-r from-blue-500 to-cyan-400 h-full transition-all"
                    style={{ width: `${xpProgressPct(userXp, userLevel)}%` }} />
                </div>
              </div>
              <div className="w-12 h-12 shrink-0 flex flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--color-play-reward)] to-amber-600 border-2 border-amber-300/40 shadow-lg">
                <span className="text-base font-black text-[#0d1b3e] leading-none">{userLevel}</span>
                <span className="text-[7px] font-black text-[#0d1b3e]/80">Lv.</span>
              </div>
            </div>
          </div>

          {/* Two balances. The design's second tile was a diamond «gem»
              currency — there is no such column, no way to earn one and
              nothing to spend it on, so it shows نقاط المجد instead, which
              is the balance EntertainmentHome already displays. Neither tile
              carries the design's «+» button: no top-up or purchase flow
              exists anywhere in the app, and a + that dead-ends reads as a
              shop that isn't there. */}
          {/* Circular icon, the number, and the «+» from the drawing. The
              «+» goes where these are actually earned — there is no store,
              no top-up and no billing anywhere in the app, so a + that meant
              "buy" would be pointing at nothing. It is hidden entirely if
              there is nowhere to send it. */}
          <div className="grid grid-cols-2 gap-2 mt-3">
            {([
              { key: 'coins', value: currentUser.gameCoins ?? 0, label: 'عملات الألعاب',
                Icon: Coins, ring: 'from-[var(--color-play-reward)] to-amber-600', tint: 'text-[#0d1b3e]' },
              { key: 'glory', value: currentUser.points ?? 0, label: 'نقاط المجد',
                Icon: Sparkles, ring: 'from-cyan-300 to-blue-600', tint: 'text-[#0d1b3e]' },
            ] as const).map(({ key, value, label, Icon, ring, tint }) => (
              <div key={key} className="flex items-center justify-between gap-2 bg-[#122244]/80 border border-blue-500/20 rounded-2xl px-2.5 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-8 h-8 shrink-0 rounded-full bg-gradient-to-br ${ring} flex items-center justify-center shadow-inner`}>
                    <Icon className={`w-4 h-4 ${tint}`} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-white leading-none">{value}</p>
                    <p className="text-[8px] text-slate-400 font-bold mt-0.5 truncate">{label}</p>
                  </div>
                </div>
                {onOpenRewards && (
                  <button
                    type="button"
                    onClick={onOpenRewards}
                    aria-label={`اكسب المزيد من ${label}`}
                    className="w-6 h-6 shrink-0 rounded-lg bg-[#F5C542]/15 border border-[#F5C542]/40 text-[var(--color-play-reward)] flex items-center justify-center hover:bg-[#F5C542]/25 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

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
            {/* The match banner. The league chip carries the real tier from
                leagues.ts — the design's «الدوري الماسي II» names a league
                that does not exist, and a numbered division the ladder has no
                concept of; every other screen calling getLeague on the same
                rating would have contradicted it on sight.

                The subtitle is not the design's «تحدَّ لاعبين من نفس مستواك»
                either: the opponents this button finds are seven constants in
                this file, so that line would promise a live person and hand
                over a script. It describes the format instead, which is true
                whoever is on the other side. */}
            {/* The banner, laid out as drawn: text column on the right, the
                VS artwork above the call to action on the left, gold rule
                around the whole thing with a glow behind it. */}
            {/* The banner, to the reference: 16:9, the artwork filling it,
                and every piece of interface placed over it as its own layer —
                league pill top right, title left, reward bottom left, and the
                capsule button across the bottom centre. */}
            <div className="relative w-full aspect-[16/9] overflow-hidden rounded-[28px] border border-[#F5C542]/45 shadow-[0_0_44px_-10px_rgba(245,197,66,0.4)]">
              <MatchBannerScene className="absolute inset-0 w-full h-full" />

              {/* keeps the left-hand type legible over the artwork */}
              <div className="absolute inset-0 bg-gradient-to-r from-[#070C1F] via-[#070C1F]/70 to-transparent pointer-events-none" />

              {/* League — the real tier. The reference reads «الدوري الماسي
                  II»; there is no such league and no divisions, and every
                  other screen resolves the same rating through getLeague. */}
              <div className="absolute top-2.5 right-3 flex items-center gap-1.5 bg-[#0b1b3e]/85 border border-blue-400/40 rounded-full px-2.5 py-1 backdrop-blur-sm">
                <Shield className="w-3 h-3 text-cyan-300 shrink-0" />
                <span className="text-[9px] font-black text-white whitespace-nowrap">{userLeague.name}</span>
              </div>

              {/* Title */}
              <div className="absolute top-6 left-3.5 max-w-[45%]">
                <h2 className="text-[20px] font-black text-white leading-[1.1] tracking-tight drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
                  مباراة
                  <span className="block text-[var(--color-play-reward)]">عشوائية</span>
                </h2>
                {/* True now in a way it was not before: this button opens a
                    real matchmade room against a real person. */}
                <p className="text-[9.5px] text-white font-bold mt-1 drop-shadow-[0_1px_5px_rgba(0,0,0,1)]">
                  تحدَّ لاعبين الآن
                </p>
              </div>

              {/* Reward. +25 is real, but it is a rating delta — «نقاط» is the
                  loyalty balance redeemable against bookings. */}
              <div className="absolute bottom-3 left-3.5 flex items-center gap-1.5 bg-[#070C1F]/70 border border-white/10 rounded-xl px-2 py-1.5 backdrop-blur-sm">
                <Trophy className="w-4 h-4 text-[var(--color-play-reward)] shrink-0" />
                <div className="leading-none">
                  <span className="block text-[13px] font-black text-[var(--color-play-reward)]">+25</span>
                  <span className="block text-[8px] text-slate-300 font-bold mt-0.5 whitespace-nowrap">نقطة تقييم</span>
                </div>
              </div>

              {/* Call to action — capsule, centred, a little over half the
                  banner, as drawn. */}
              <motion.button
                whileHover={{ scale: findingMatch ? 1 : 1.03 }}
                whileTap={{ scale: findingMatch ? 1 : 0.97 }}
                disabled={findingMatch}
                onClick={startRealMatch}
                className="absolute bottom-3 left-1/2 -translate-x-1/2 w-[55%] py-2.5 bg-gradient-to-b from-[#FFD65C] to-[#F0A93B] hover:from-[#FFE082] hover:to-[#F5B94A] disabled:opacity-75 text-[#2A1B02] rounded-full shadow-[0_6px_22px_-4px_rgba(245,197,66,0.75)] flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                {findingMatch
                  ? <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                  : <Zap className="w-4 h-4 shrink-0" />}
                <span className="text-[13px] font-black whitespace-nowrap">
                  {findingMatch ? 'جارٍ البحث...' : 'ابدأ البحث'}
                </span>
              </motion.button>
            </div>

            {matchError && (
              <p className="text-[10px] font-bold text-rose-200 bg-rose-500/15 border border-rose-500/40 rounded-xl px-3 py-2 text-center">
                {matchError}
              </p>
            )}

            {/* Two half cards. The design's second was «المكافآت اليومية —
                صندوق يومي جاهز للفتح» with a red «1». There is no chest, no
                cooldown and nothing anywhere that counts unclaimed rewards,
                so the badge had no source and the word «صندوق» no referent.
                It points at the rewards screen that does exist, named for
                what is actually on it, and only when there is somewhere to
                send the tap. */}
            <div className={`grid ${onOpenRewards ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
              <button
                onClick={() => setScreen('friend_menu')}
                className="bg-gradient-to-br from-[#2a1a4a] to-[#1a1030] border border-purple-500/25 rounded-2xl p-3.5 text-right hover:border-purple-400/50 transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <Users className="w-7 h-7 text-purple-400 shrink-0" />
                  <ChevronLeft className="w-4 h-4 text-slate-500" />
                </div>
                <p className="text-xs font-black text-white mt-2">اللعب مع صديق</p>
                <p className="text-[9px] text-slate-400 font-bold mt-0.5">تحدَّ أصدقاءك الآن</p>
              </button>

              {onOpenRewards && (
                <button
                  onClick={onOpenRewards}
                  className="bg-gradient-to-br from-[#1a2a4a] to-[#101a30] border border-cyan-500/25 rounded-2xl p-3.5 text-right hover:border-cyan-400/50 transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <Gift className="w-7 h-7 text-cyan-400 shrink-0" />
                    <ChevronLeft className="w-4 h-4 text-slate-500" />
                  </div>
                  <p className="text-xs font-black text-white mt-2">الجوائز والتحدي اليومي</p>
                  <p className="text-[9px] text-slate-400 font-bold mt-0.5">عجلة الحظ وتحدي اليوم</p>
                </button>
              )}
            </div>

            <button
              onClick={onClose}
              className="w-full py-3 bg-white/5 hover:bg-white/10 text-slate-400 rounded-2xl text-[11px] font-black border border-white/10 transition-all flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              <span>رجوع</span>
            </button>
          </motion.div>
        )}

        {/* SCREEN: SEARCHING (Competitive) */}

        {/* SCREEN: OPPONENT FOUND */}

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

              {/* Practice.
                  Says what it is on the button, so it can never be taken for
                  matchmaking — which is exactly what the seven scripted
                  «opponents» removed from this file did wrong. Nothing is at
                  stake and the button says that too. */}
              {onOpenPractice && (
                <button
                  type="button"
                  onClick={onOpenPractice}
                  className="mx-auto mb-4 flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-2xl px-5 py-2.5 transition-colors"
                >
                  <span className="text-base">🤖</span>
                  <span className="text-[11px] font-black">تدريب مع بوت</span>
                  <span className="text-[9px] font-bold text-slate-500">— من غير نقط ولا تقييم</span>
                </button>
              )}

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
                    <button aria-label="انضمام لغرفة صديق"
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
              onClick={() => { setJoinError(''); setScreen('league_info'); }}
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

                  {shareNote && (
                    <p className="text-[10px] font-bold text-amber-300 text-center leading-relaxed px-2">
                      {shareNote}
                    </p>
                  )}
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

        {/* SCREEN 5: GAME OVER / POST-MATCH RESULTS */}

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
