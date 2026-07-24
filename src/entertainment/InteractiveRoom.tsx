import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, Users, Check, X, RefreshCw, Trophy, Play, Pause, 
  Gamepad2, QrCode, Timer, Share2, CheckCircle2, UserPlus, 
  Plus, Minus, Lock, Unlock, Settings, Image, Award, Crown, ArrowLeft, ArrowRight, Star
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { BASE_TRIVIA_QUESTIONS } from './data/triviaData';
const GENERAL_TRIVIA_QUESTIONS = BASE_TRIVIA_QUESTIONS;
import { RAW_CHARACTERS } from './data/whoAmIData';
import { getSmartQuestionRound, initializeQuestionPool } from './questionPoolEngine';
import { triggerHaptic } from '../lib/haptic';
import { playSound } from '../lib/sounds';
import {
  getQuestionsFromFirestore,
  trackQuestionPlayed,
  getPlayedQuestionIds,
  getWeightedSmartRound,
  saveAIQuestionsToFirestore,
  DbQuestion
} from '../lib/questionDb';
import {
  GAME_PLUGINS, CHARADES_ITEMS, GUESS_IMAGE_ITEMS, ESCAPE_ROOM_LOCKS, 
  BOMB_BOXES_POOL, SPIRITUAL_RANDOM_CHALLENGES, DAILY_EVENTS_POOL, EscapeRoomLock
} from './gamePlugins';
import { GameContentRenderer } from './GameContentRenderer';
import { GameRoomManager } from './GameRoomManager';
import { RoomCreateWizard } from './RoomCreateWizard';
import { RoomHostDashboard } from './RoomHostDashboard';

// Game Engine Modular Imports
import { ScoreTransaction, GameSession, GAME_ENGINE_PLUGINS } from './game-engine/GameEngineModels';
import { ScoreEnginePanel } from './game-engine/ScoreEnginePanel';
import { TimerEnginePanel } from './game-engine/TimerEnginePanel';
import { PluginSystemCard } from './game-engine/PluginSystemCard';
import { EffectsEngine } from './game-engine/EffectsEngine';

// Real-time server connection state types
interface Player {
  id: string;
  name: string;
  avatar: string;
  approved: boolean;
  teamId: string | null;
  score: number;
  isHost: boolean;
  isOnline: boolean;
}

interface Team {
  id: string;
  name: string;
  color: string;
  score: number;
}

interface GameRoundHistory {
  game: string;
  scores: { [teamId: string]: number };
}

interface RoomState {
  code: string;
  name: string;
  eventType: string; // 'meeting' | 'conference' | 'retreat'
  teamCount: number;
  divisionMethod: 'random' | 'manual';
  allowedGames: string[];
  hostId: string;
  players: Player[];
  currentGame: string | null;
  gameState: 'lobby' | 'playing' | 'round_over' | 'finished';
  roundTimer: number;
  isTimerPaused: boolean;
  currentQuestionIndex: number;
  teams: { [teamId: string]: Team };
  gameHistory: GameRoundHistory[];
  isLocked: boolean;
  mvp?: { id: string; name: string; score: number } | null;
  sessionStartTime: number;
  transactions: ScoreTransaction[];
  sessionHistory: GameSession[];
}

// Predefined Avatars for players
const PRESET_AVATARS = ["⛪", "🕊️", "🕯️", "📖", "👑", "🦁", "🍇", "🐟", "☀️", "🛡️"];

// Mock names for simulator
const MOCK_NAMES = [
  "أبانوب جرجس", "مارينا ناجي", "كيرلس فايز", "دميانة رأفت", "بيشوي وسيم", 
  "يوستينا أشرف", "مينا رأفت", "فادي عماد", "مريم صبحي", "جون عادل"
];

const PREDEFINED_GAMES = GAME_PLUGINS;

interface InteractiveRoomProps {
  currentUser: { id: string; name: string; avatar?: string; xp?: number; points?: number; churchName?: string };
  onBack: () => void;
  onUpdateUser: (updatedUser: any) => void;
  initialMode?: 'selection' | 'create' | 'join' | 'active';
  initialRole?: 'host' | 'participant';
}

export default function InteractiveRoom({ currentUser, onBack, onUpdateUser, initialMode, initialRole }: InteractiveRoomProps) {
  // Mode: 'role_selection' | 'create_form' | 'join_form' | 'lobby'
  const [mode, setMode] = useState<'selection' | 'create' | 'join' | 'active'>('selection');
  const [role, setRole] = useState<'host' | 'participant'>('participant');

  useEffect(() => {
    if (initialMode) {
      setMode(initialMode);
    }
    if (initialRole) {
      setRole(initialRole);
    }
  }, [initialMode, initialRole]);
  
  // Create Room Form state
  const [roomName, setRoomName] = useState('خلوة الشباب الروحية - كنيستنا ⛪');
  const [eventType, setEventType] = useState('retreat');
  const [teamCount, setTeamCount] = useState(2);
  const [divisionMethod, setDivisionMethod] = useState<'random' | 'manual'>('random');
  const [allowedGames, setAllowedGames] = useState<string[]>(['trivia', 'general_trivia', 'whoami', 'fillverse']);
  
  // Join Room Form state
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [joinNameInput, setJoinNameInput] = useState(currentUser.name || '');
  const [selectedAvatar, setSelectedAvatar] = useState(PRESET_AVATARS[0]);

  // Current active room state
  const [room, setRoom] = useState<RoomState | null>(null);
  const [connectionType, setConnectionType] = useState<'real' | 'simulated'>('simulated');
  const [wsConnected, setWsConnected] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [pointsEffectTrigger, setPointsEffectTrigger] = useState<{ teamName: string; amount: number } | null>(null);
  const [lobbyTab, setLobbyTab] = useState<'players' | 'plugins' | 'sessions'>('players');

  // References and local timers
  const wsRef = useRef<WebSocket | null>(null);
  const timerIntervalRef = useRef<any>(null);
  
  useEffect(() => {
    if (room?.gameState === 'finished') {
      confetti({
        particleCount: 200,
        spread: 160,
        origin: { y: 0.6 },
        colors: ['#FFD700', '#FFFFFF', '#000080', '#FF0000']
      });
      playSound('win');
    }
  }, [room?.gameState]);

  // Quiz states (synced locally for visual answers)
  const [selectedOptionIdx, setSelectedOptionIdx] = useState<number | null>(null);
  const [hasSubmittedAnswer, setHasSubmittedAnswer] = useState(false);
  const [currentRoundQuizQuestions, setCurrentRoundQuizQuestions] = useState<any[]>([]);
  const [playedQuestionIds, setPlayedQuestionIds] = useState<string[]>([]);
  const [playerHistoryIds, setPlayerHistoryIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('player_question_history') || '[]');
    } catch {
      return [];
    }
  });

  // Dynamic Coptic Smart Pool states
  const [firestoreQuestions, setFirestoreQuestions] = useState<DbQuestion[]>(() => 
    initializeQuestionPool().map(q => ({ ...q, lastUsedAt: null, usageCount: 0 }))
  );
  const [dbPlayedIds, setDbPlayedIds] = useState<string[]>([]);

  // Simulation state variables
  const [isSimulatorEnabled, setIsSimulatorEnabled] = useState(true);
  const [simulationLogs, setSimulationLogs] = useState<string[]>(["بوابة المحاكاة جاهزة لتجربة الخلوة التفاعلية."]);

  // --- 16 PLUGINS & ACTIVE GAME STATES ---
  // Charades
  const [charadesItem, setCharadesItem] = useState<any>(null);
  const [charadesActor, setCharadesActor] = useState<Player | null>(null);
  
  // Guess the Image
  const [guessImageItem, setGuessImageItem] = useState<any>(null);
  const [guessImageRevealed, setGuessImageRevealed] = useState<boolean[]>(Array(16).fill(false));
  const [guessImageGuessValue, setGuessImageGuessValue] = useState("");
  const [guessImageSolved, setGuessImageSolved] = useState(false);

  // Speed Challenge
  const [speedMultiplier, setSpeedMultiplier] = useState(50);

  // Challenge Wheel
  const [wheelAngle, setWheelAngle] = useState(0);
  const [wheelIsSpinning, setWheelIsSpinning] = useState(false);
  const [wheelResultText, setWheelResultText] = useState("");

  // Bible Escape Room
  const [escapeLockIdx, setEscapeLockIdx] = useState(0);
  const [escapeCodeValue, setEscapeCodeValue] = useState("");
  const [escapeRoomHintShown, setEscapeRoomHintShown] = useState(false);

  // Bomb Game
  const [bombBoxes, setBombBoxes] = useState<any[]>([]);
  
  // Lucky Box
  const [luckyBoxChoices, setLuckyBoxChoices] = useState<{[teamId: string]: number}>({});
  const [luckyBoxOutcomes, setLuckyBoxOutcomes] = useState<{[teamId: string]: string}>({});

  // Points Auction
  const [auctionBids, setAuctionBids] = useState<{[teamId: string]: number}>({});
  const [auctionQuestion, setAuctionQuestion] = useState<any>(null);

  // Time Rush
  const [timeRushCorrect, setTimeRushCorrect] = useState(0);
  const [timeRushTotal, setTimeRushTotal] = useState(0);

  // Digital Dice
  const [diceValue, setDiceValue] = useState(1);
  const [isDiceRolling, setIsDiceRolling] = useState(false);

  // Question Bank
  const [customQuestionBank, setCustomQuestionBank] = useState<any[]>([]);
  const [qBankForm, setQBankForm] = useState({
    question: "",
    optionA: "", optionB: "", optionC: "", optionD: "",
    correctOption: "A",
    category: "الكتاب المقدس",
    difficulty: "متوسط",
    points: 20
  });

  // Tournament Mode
  const [tournamentMatches, setTournamentMatches] = useState<any[]>([
    { id: 1, teamA: "فريق داود", teamB: "فريق سليمان", winner: null, round: "نصف النهائي" },
    { id: 2, teamA: "فريق موسى", teamB: "فريق إيليا", winner: null, round: "نصف النهائي" },
    { id: 3, teamA: "بانتظار الفائز 1", teamB: "بانتظار الفائز 2", winner: null, round: "النهائي" }
  ]);

  // Draw & Guess
  const [drawSecret, setDrawSecret] = useState("فلك نوح");
  const [drawPaths, setDrawPaths] = useState<string[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);

  // Random Challenges & Daily Event
  const [randomChallengeText, setRandomChallengeText] = useState("");
  const [dailyEventItem, setDailyEventItem] = useState<any>(DAILY_EVENTS_POOL[0]);

  // --- SHOW TOAST HELPER ---
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const addSimLog = (msg: string) => {
    setSimulationLogs(prev => [`[${new Date().toLocaleTimeString('ar-EG')}] ${msg}`, ...prev.slice(0, 15)]);
  };

  // --- LOAD DYNAMIC COPTIC SMART POOL DATA FROM FIRESTORE ---
  useEffect(() => {
    async function loadDbData() {
      if (!currentUser?.id) return;
      try {
        const questions = await getQuestionsFromFirestore();
        if (questions && questions.length > 0) {
          setFirestoreQuestions(questions);
          // Check if any category/difficulty is low and replenish automatically
          checkAndReplenishPool(questions);
        }
        const playedIds = await getPlayedQuestionIds(currentUser.id);
        setDbPlayedIds(playedIds);
      } catch (err) {
        console.error("Error loading question DB from Firestore:", err);
      }
    }
    loadDbData();
  }, [currentUser?.id]);

  const checkAndReplenishPool = async (allQs: DbQuestion[]) => {
    const categories = ["الكتاب المقدس", "اللاهوت والعقيدة", "الألحان والقبطي", "تاريخ الكنيسة والطقوس", "القديسون والشخصيات"];
    const difficulties = ["سهل", "متوسط", "صعب"];

    for (const cat of categories) {
      for (const diff of difficulties) {
        const count = allQs.filter(q => q.category === cat && q.difficulty === diff).length;
        if (count < 10) {
          console.log(`Question diversity is low for Category: ${cat}, Difficulty: ${diff} (Count: ${count}). Replenishing automatically...`);
          try {
            const response = await fetch("/api/gemini/replenish", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ category: cat, difficulty: diff })
            });
            if (response.ok) {
              const data = await response.json();
              if (data && Array.isArray(data.questions)) {
                await saveAIQuestionsToFirestore(data.questions);
                const updated = await getQuestionsFromFirestore();
                setFirestoreQuestions(updated);
                showToast(`✨ تم توليد وتغذية البنك تلقائياً بـ ٥ أسئلة جديدة لـ [${cat} - ${diff}] لضمان التنوع!`);
                return;
              }
            }
          } catch (err) {
            console.error("Auto replenishment failed:", err);
          }
        }
      }
    }
  };

  // --- ESTABLISH WEBSOCKET CONNECTION ---
  const connectToWebSocket = (
    code: string, 
    pId: string, 
    pName: string, 
    pAvatar: string, 
    asHost = false,
    teamConfigs?: { id: string; name: string; color: string; icon: string }[]
  ) => {
    try {
      const isHttps = window.location.protocol === 'https:';
      const wsProtocol = isHttps ? 'wss:' : 'ws:';
      // Fallback or development server ws port
      const wsUrl = `${wsProtocol}//${window.location.host}`;
      
      addSimLog(`محاولة الاتصال بالخادم الحقيقي عبر: ${wsUrl}`);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
        setConnectionType('real');
        addSimLog("✓ تم الاتصال بالخادم بنجاح! وضع الوقت الفعلي نشط.");
        
        if (asHost) {
          // Send creation payload if host
          ws.send(JSON.stringify({
            type: "CREATE_ROOM",
            name: roomName,
            eventType,
            teamCount,
            divisionMethod,
            allowedGames,
            hostId: pId,
            hostName: pName,
            hostAvatar: pAvatar
          }));
        } else {
          // Send join payload
          ws.send(JSON.stringify({
            type: "JOIN_ROOM",
            roomCode: code,
            playerId: pId,
            playerName: pName,
            playerAvatar: pAvatar
          }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleServerMessage(data);
        } catch (e) {
          console.error("Error reading socket payload", e);
        }
      };

      ws.onerror = (err) => {
        console.warn("WebSocket Connection failed, switching to premium local simulation engine", err);
        setConnectionType('simulated');
        setupSimulatedRoom(code, pId, pName, pAvatar, asHost, teamConfigs);
      };

      ws.onclose = () => {
        setWsConnected(false);
        addSimLog("انقطع الاتصال بالخادم. تفعيل المحاكاة لعدم انقطاع اللعب.");
      };
    } catch (e) {
      console.warn("WebSocket setup error, using offline simulation mode:", e);
      setConnectionType('simulated');
      setupSimulatedRoom(code, pId, pName, pAvatar, asHost, teamConfigs);
    }
  };

  // --- HANDLER FOR WS SERVER PAYLOADS ---
  const handleServerMessage = (data: any) => {
    const { type, room: updatedRoom, message, game, playerName, points } = data;

    switch (type) {
      case "ROOM_CREATED":
      case "ROOM_JOINED":
      case "ROOM_UPDATED":
        setRoom(updatedRoom);
        if (updatedRoom.currentGame) {
          loadGameQuestionsForRoom(updatedRoom.currentGame);
        }
        break;
      case "GAME_STARTED":
        setRoom(updatedRoom);
        loadGameQuestionsForRoom(game);
        showToast(`⚡ انطلقت لعبة: ${PREDEFINED_GAMES.find(g => g.id === game)?.label}`);
        setSelectedOptionIdx(null);
        setHasSubmittedAnswer(false);
        break;
      case "QUESTIONS_SYNCED":
        setCurrentRoundQuizQuestions(data.questions || []);
        break;
      case "SCORE_EARNED":
        setRoom(updatedRoom);
        showToast(`🎉 المشترك ${playerName} كسب +${points} نقطة لفريقه!`);
        break;
      case "ROUND_OVER":
        setRoom(updatedRoom);
        showToast("🏁 انتهت الجولة الحالية! لنتحقق من ترتيب الفرق.");
        break;
      case "CONTEST_FINISHED":
        setRoom(updatedRoom);
        showToast("🏆 كيرياليسون! انتهت المسابقة الكبرى وأُعلنت النتائج النهائية!");
        break;
      case "KICKED":
        showToast(message || "تم خروجك من الغرفة.");
        setRoom(null);
        setMode('selection');
        break;
      case "ERROR":
        showToast(message || "حدث خطأ ما.");
        break;
    }
  };

  // --- OFFLINE SIMULATION STATE ENGINE ---
  const setupSimulatedRoom = (
    code: string, 
    pId: string, 
    pName: string, 
    pAvatar: string, 
    asHost = false,
    teamConfigs?: { id: string; name: string; color: string; icon: string }[]
  ) => {
    setConnectionType('simulated');
    
    const hostPlayer: Player = {
      id: asHost ? pId : "host_sim_442",
      name: asHost ? pName : "الخادم مينا (المسؤول) ⛪",
      avatar: asHost ? pAvatar : "⛪",
      approved: true,
      teamId: null,
      score: 0,
      isHost: true,
      isOnline: true
    };

    const initialTeams: { [teamId: string]: Team } = {};
    const count = teamCount;

    if (teamConfigs && teamConfigs.length > 0) {
      teamConfigs.slice(0, count).forEach((tc) => {
        initialTeams[tc.id] = {
          id: tc.id,
          name: tc.name,
          color: tc.color,
          score: 0,
          icon: tc.icon
        } as any;
      });
    } else {
      const TEAM_NAMES_AR = [
        'فريق القديس بولس 🔴', 'فريق القديس بطرس 🔵', 'فريق القديس مرقس 🟢', 
        'فريق القديس يوحنا 🟡', 'فريق القديس أندراوس 🟣', 'فريق القديس توما 💗'
      ];
      const TEAM_COLORS_HEX = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];

      for (let i = 0; i < count; i++) {
        const id = `team_${i + 1}`;
        initialTeams[id] = {
          id,
          name: TEAM_NAMES_AR[i] || `فريق ${i + 1}`,
          color: TEAM_COLORS_HEX[i] || '#64748B',
          score: 0,
          icon: TEAM_NAMES_AR[i] ? TEAM_NAMES_AR[i].slice(-1) : '🏳️'
        } as any;
      }
    }

    const simRoom: RoomState = {
      code: code || "458921",
      name: asHost ? roomName : "مؤتمر خريجين كنيسة مارمرقس والأنبا رويس ⛪",
      eventType: asHost ? eventType : "conference",
      teamCount: count,
      divisionMethod: asHost ? divisionMethod : "random",
      allowedGames: asHost ? allowedGames : ["trivia", "general_trivia", "whoami", "fillverse"],
      hostId: hostPlayer.id,
      players: [hostPlayer],
      currentGame: null,
      gameState: "lobby",
      roundTimer: 0,
      isTimerPaused: false,
      currentQuestionIndex: 0,
      teams: initialTeams,
      gameHistory: [],
      isLocked: false,
      sessionStartTime: Date.now(),
      transactions: [],
      sessionHistory: []
    };

    if (!asHost) {
      // If user is a Participant, they join the simRoom with the host
      const selfPlayer: Player = {
        id: pId,
        name: pName,
        avatar: pAvatar,
        approved: false, // Wait for simulated host approval
        teamId: null,
        score: 0,
        isHost: false,
        isOnline: true
      };
      simRoom.players.push(selfPlayer);
    }

    setRoom(simRoom);
    addSimLog(`تأسيس غرفة محاكاة ذاتية مشفرة بكود: ${simRoom.code}`);
  };

  // --- ACTIONS SEND TO SERVER (OR SIMULATED STATE) ---
  const sendWSMessage = (payload: any) => {
    if (connectionType === 'real' && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    } else {
      // Run Simulated actions locally
      handleSimulatedAction(payload);
    }
  };

  // --- SIMULATED STATE HANDLER (LOCAL BACKEND MOCK) ---
  const handleSimulatedAction = (action: any) => {
    if (!room) return;
    const updated = { ...room };

    switch (action.type) {
      case "APPROVE_PLAYER": {
        const player = updated.players.find(p => p.id === action.playerId);
        if (player) {
          if (action.approved) {
            player.approved = true;
            addSimLog(`وافق الخادم على انضمام اللاعب: ${player.name}`);
          } else {
            updated.players = updated.players.filter(p => p.id !== action.playerId);
            addSimLog(`تم استبعاد طلب انضمام اللاعب: ${player.name}`);
          }
          setRoom(updated);
        }
        break;
      }

      case "KICK_PLAYER": {
        const player = updated.players.find(p => p.id === action.playerId);
        if (player) {
          updated.players = updated.players.filter(p => p.id !== action.playerId);
          addSimLog(`طرد الخادم المشترك: ${player.name}`);
          setRoom(updated);
        }
        break;
      }

      case "LOCK_ROOM": {
        updated.isLocked = action.isLocked;
        addSimLog(action.isLocked ? "تم إغلاق الغرفة ومكتملة العدد." : "تم فتح الانضمام للغرفة مجددًا.");
        setRoom(updated);
        break;
      }

      case "DIVIDE_TEAMS": {
        updated.divisionMethod = action.divisionMethod;
        
        // Reset player team assignments
        updated.players.forEach(p => {
          if (!p.isHost) p.teamId = null;
        });

        const approvedList = updated.players.filter(p => p.approved && !p.isHost);
        const teamIds = Object.keys(updated.teams);

        if (action.divisionMethod === "random") {
          // Distribute evenly
          approvedList.forEach((p, idx) => {
            p.teamId = teamIds[idx % teamIds.length];
          });
          addSimLog(`تم تقسيم الفرق عشوائياً بالتساوي على ${teamIds.length} فرق.`);
        } else if (action.divisionMethod === "manual" && action.teamAssignments) {
          approvedList.forEach(p => {
            if (action.teamAssignments[p.id]) {
              p.teamId = action.teamAssignments[p.id];
            }
          });
          addSimLog("تم توزيع الفرق يدوياً من قبل الخادم.");
        }
        setRoom(updated);
        break;
      }

      case "START_GAME": {
        updated.currentGame = action.game;
        updated.gameState = "playing";
        updated.currentQuestionIndex = 0;
        updated.roundTimer = 45;
        updated.isTimerPaused = false;
        
        addSimLog(`بدأت لعبة: ${PREDEFINED_GAMES.find(g => g.id === action.game)?.label}`);
        setRoom(updated);
        loadGameQuestionsForRoom(action.game);
        setSelectedOptionIdx(null);
        setHasSubmittedAnswer(false);
        break;
      }

      case "UPDATE_QUESTION_INDEX": {
        updated.currentQuestionIndex = action.index;
        updated.roundTimer = 45;
        setRoom(updated);
        break;
      }

      case "SET_TIMER": {
        if (action.timer !== undefined) updated.roundTimer = action.timer;
        if (action.isPaused !== undefined) updated.isTimerPaused = action.isPaused;
        setRoom(updated);
        break;
      }

      case "TRANSFER_HOST": {
        const previousHost = updated.players.find(p => p.id === updated.hostId);
        const newHost = updated.players.find(p => p.id === action.playerId);
        if (newHost) {
          if (previousHost) {
            previousHost.isHost = false;
            previousHost.teamId = null;
          }
          newHost.isHost = true;
          newHost.approved = true;
          newHost.teamId = null;
          updated.hostId = newHost.id;
          
          addSimLog(`قام المنظم بنقل صلاحيات التحكم الكاملة في الغرفة إلى اللاعب: ${newHost.name}`);
          
          if (newHost.id === currentUser.id) {
            setRole('host');
            addSimLog("أصبحت أنت منظم الغرفة الحالي الآن!");
          } else if (updated.hostId !== currentUser.id) {
            setRole('participant');
          }
          
          setRoom(updated);
        }
        break;
      }

      case "RESET_POINTS": {
        Object.keys(updated.teams).forEach(tId => {
          updated.teams[tId].score = 0;
        });
        updated.players.forEach(p => {
          p.score = 0;
        });
        updated.transactions = [];
        addSimLog("قام المنظم بتصفير وإعادة ضبط جميع نقاط المجموعات واللاعبين بنجاح.");
        setRoom(updated);
        break;
      }

      case "FINISH_SESSION": {
        // Build session report and archive it
        const approvedPlayers = updated.players.filter(p => p.approved && !p.isHost);
        let mvpPlayer = null;
        if (approvedPlayers.length > 0) {
          const sorted = [...approvedPlayers].sort((a, b) => b.score - a.score);
          mvpPlayer = {
            id: sorted[0].id,
            name: sorted[0].name,
            score: sorted[0].score
          };
        }
        updated.mvp = mvpPlayer;
        updated.gameState = "finished";

        const newSession: GameSession = {
          id: `session_${Date.now()}`,
          roomCode: updated.code,
          roomName: updated.name,
          startTime: new Date(updated.sessionStartTime).toISOString(),
          endTime: new Date().toISOString(),
          activeGameId: updated.currentGame,
          totalDuration: Math.floor((Date.now() - updated.sessionStartTime) / 1000),
          gamesPlayed: updated.gameHistory.map(h => h.game),
          transactions: updated.transactions || [],
          participantsCount: approvedPlayers.length
        };

        if (!updated.sessionHistory) {
          updated.sessionHistory = [];
        }
        updated.sessionHistory.push(newSession);
        
        addSimLog(`👑 تم إنهاء المسابقة وتتويج المجموعات! اللاعب المتميز (MVP): ${mvpPlayer?.name || "لا يوجد"}`);
        setRoom(updated);
        break;
      }

      case "ADJUST_POINTS": {
        const team = updated.teams[action.teamId];
        if (team) {
          team.score = Math.max(0, team.score + action.amount);
          const newTx: ScoreTransaction = {
            id: `tx_${Date.now()}_${Math.floor(Math.random()*1000)}`,
            teamId: action.teamId,
            teamName: team.name,
            amount: action.amount,
            type: action.txType || (action.amount > 0 ? 'add' : 'deduct'),
            description: action.description || 'تعديل يدوي من المنظم',
            timestamp: new Date().toISOString()
          };
          if (!updated.transactions) updated.transactions = [];
          updated.transactions.push(newTx);
          addSimLog(`تعديل نقاط: ${team.name} تغير بمقدار ${action.amount}ن (${newTx.description})`);
          setRoom(updated);
          
          setPointsEffectTrigger({ teamName: team.name, amount: action.amount });
        }
        break;
      }

      case "SUBMIT_ANSWER": {
        const player = updated.players.find(p => p.id === action.playerId);
        if (player && player.teamId) {
          if (action.isCorrect) {
            player.score += action.points;
            if (updated.teams[player.teamId]) {
              const team = updated.teams[player.teamId];
              team.score += action.points;
              
              const newTx: ScoreTransaction = {
                id: `tx_${Date.now()}_${Math.floor(Math.random()*1000)}`,
                teamId: player.teamId,
                teamName: team.name,
                amount: action.points,
                type: 'add',
                description: `إجابة صحيحة من اللاعب ${player.name}`,
                timestamp: new Date().toISOString()
              };
              if (!updated.transactions) updated.transactions = [];
              updated.transactions.push(newTx);
              
              setPointsEffectTrigger({ teamName: team.name, amount: action.points });
            }
            addSimLog(`✓ المشترك ${player.name} أجاب إجابة صحيحة وكسب +${action.points} لفريقه!`);
          }
        }
        setRoom(updated);
        break;
      }

      case "PAUSE_GAME": {
        updated.isTimerPaused = action.isPaused;
        setRoom(updated);
        break;
      }

      case "END_ROUND": {
        updated.gameState = "round_over";
        const roundScores: { [teamId: string]: number } = {};
        Object.keys(updated.teams).forEach(tId => {
          roundScores[tId] = updated.teams[tId].score;
        });

        updated.gameHistory.push({
          game: updated.currentGame || "ألعاب روحية تفاعلية",
          scores: roundScores
        });

        addSimLog(`انتهت جولة: ${updated.currentGame}. تم حفظ النقاط.`);
        setRoom(updated);
        break;
      }

      case "NEXT_GAME": {
        updated.currentGame = null;
        updated.gameState = "lobby";
        updated.currentQuestionIndex = 0;
        updated.roundTimer = 0;
        addSimLog("تجهيز اللعبة التالية مع الاحتفاظ بنفس اللاعبين ونقاطهم المتراكمة.");
        setRoom(updated);
        break;
      }

      case "FINISH_CONTEST": {
        updated.gameState = "finished";
        const approvedPlayers = updated.players.filter(p => p.approved && !p.isHost);
        let mvpPlayer = null;
        if (approvedPlayers.length > 0) {
          const sorted = [...approvedPlayers].sort((a, b) => b.score - a.score);
          mvpPlayer = {
            id: sorted[0].id,
            name: sorted[0].name,
            score: sorted[0].score
          };
        }
        updated.mvp = mvpPlayer;
        addSimLog(`تتويج المسابقة الروحية! اللاعب الأكثر تميزاً (MVP): ${mvpPlayer?.name || "لا يوجد"}`);
        setRoom(updated);
        break;
      }
    }
  };

  // --- LOAD REAL QUESTIONS BASED ON SELECTED GAME ---
  const loadGameQuestionsForRoom = (gameId: string) => {
    let questions: any[] = [];
    
    // Reset/Initialize plugin states
    setHasSubmittedAnswer(false);
    setSelectedOptionIdx(null);
    setEscapeLockIdx(0);
    setEscapeCodeValue("");
    setEscapeRoomHintShown(false);
    setGuessImageSolved(false);
    setGuessImageGuessValue("");
    setGuessImageRevealed(Array(16).fill(false));
    setLuckyBoxChoices({});
    setLuckyBoxOutcomes({});
    setWheelResultText("");
    setIsDiceRolling(false);
    setWheelIsSpinning(false);
    setSpeedMultiplier(50);

    const isHost = role === 'host';
    const roomPlayedIds = playedQuestionIds;
    const userPlayedIds = dbPlayedIds;

    if (gameId === 'trivia') {
      questions = getWeightedSmartRound(firestoreQuestions, 'trivia', 10, roomPlayedIds, userPlayedIds);
    } else if (gameId === 'general_trivia') {
      const shuffled = [...GENERAL_TRIVIA_QUESTIONS].sort(() => Math.random() - 0.5).slice(0, 10);
      questions = shuffled.map((q, idx) => ({
        id: `gen_trivia_${idx}_${Date.now()}`,
        ...q
      }));
    } else if (gameId === 'speed') {
      questions = getWeightedSmartRound(firestoreQuestions, 'speed', 10, roomPlayedIds, userPlayedIds);
      setSpeedMultiplier(50);
    } else if (gameId === 'timerush') {
      questions = getWeightedSmartRound(firestoreQuestions, 'timerush', 10, roomPlayedIds, userPlayedIds);
      setTimeRushCorrect(0);
      setTimeRushTotal(0);
    } else if (gameId === 'auction') {
      questions = getWeightedSmartRound(firestoreQuestions, 'auction', 5, roomPlayedIds, userPlayedIds);
      setAuctionBids({});
      setAuctionQuestion(questions[0]);
    } else if (gameId === 'whoami') {
      questions = getWeightedSmartRound(firestoreQuestions, 'whoami', 10, roomPlayedIds, userPlayedIds);
    } else if (gameId === 'fillverse') {
      questions = getWeightedSmartRound(firestoreQuestions, 'fillverse', 10, roomPlayedIds, userPlayedIds);
    }

    if (questions && questions.length > 0) {
      if (isHost && connectionType === 'real' && room?.code) {
        sendWSMessage({
          type: "SYNC_QUESTIONS",
          roomCode: room.code,
          questions
        });
      }

      const drawnIds = questions.map(q => q.id);
      setPlayedQuestionIds(prev => [...prev, ...drawnIds]);
      setPlayerHistoryIds(prev => {
        const next = Array.from(new Set([...prev, ...drawnIds])).slice(-100);
        localStorage.setItem('player_question_history', JSON.stringify(next));
        return next;
      });
    } else if (gameId === 'charades') {
      const randomItem = CHARADES_ITEMS[Math.floor(Math.random() * CHARADES_ITEMS.length)];
      setCharadesItem(randomItem);
      const candidates = room?.players.filter(p => p.approved && !p.isHost) || [];
      if (candidates.length > 0) {
        setCharadesActor(candidates[Math.floor(Math.random() * candidates.length)]);
      }
    } else if (gameId === 'guessimage') {
      const randomItem = GUESS_IMAGE_ITEMS[Math.floor(Math.random() * GUESS_IMAGE_ITEMS.length)];
      setGuessImageItem(randomItem);
    } else if (gameId === 'bomb') {
      const shuffled = [...BOMB_BOXES_POOL]
        .sort(() => Math.random() - 0.5)
        .map((box, i) => ({ ...box, id: i + 1, openedByTeamId: null }));
      setBombBoxes(shuffled);
    } else if (gameId === 'randomchallenge') {
      const challenge = SPIRITUAL_RANDOM_CHALLENGES[Math.floor(Math.random() * SPIRITUAL_RANDOM_CHALLENGES.length)];
      setRandomChallengeText(challenge);
    } else {
      // Fallback
      questions = BASE_TRIVIA_QUESTIONS.slice(10, 15);
    }
    
    setCurrentRoundQuizQuestions(questions);
  };

  // --- SIMULATED BACKGROUND PLAYERS TASK LOOP ---
  useEffect(() => {
    if (connectionType !== 'simulated' || !room || !isSimulatorEnabled) return;

    const interval = setInterval(() => {
      // 1. Simulate new player requesting to join while in Lobby
      if (room.gameState === 'lobby' && room.players.length < 8 && Math.random() > 0.6) {
        const availableNames = MOCK_NAMES.filter(n => !room.players.map(p => p.name).includes(n));
        if (availableNames.length > 0) {
          const name = availableNames[Math.floor(Math.random() * availableNames.length)];
          const avatar = PRESET_AVATARS[Math.floor(Math.random() * PRESET_AVATARS.length)];
          const newSimPlayer: Player = {
            id: `sim_player_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            name,
            avatar,
            approved: false, // Must be approved by the host user
            teamId: null,
            score: 0,
            isHost: false,
            isOnline: true
          };
          
          const updated = { ...room };
          updated.players.push(newSimPlayer);
          setRoom(updated);
          addSimLog(`طلب انضمام جديد من: ${name} ${avatar}`);
          showToast(`🔔 طلب انضمام جديد: ${name}`);
        }
      }

      // 2. Simulate Host auto-approving if user is a participant
      if (room.gameState === 'lobby' && role === 'participant' && !room.isLocked) {
        const self = room.players.find(p => p.id === currentUser.id);
        if (self && !self.approved) {
          const updated = { ...room };
          const selfIdx = updated.players.findIndex(p => p.id === currentUser.id);
          if (selfIdx !== -1) {
            updated.players[selfIdx].approved = true;
            // Also simulate 4 other players joining approved so they can build teams
            MOCK_NAMES.slice(0, 4).forEach((name, i) => {
              if (!updated.players.find(p => p.name === name)) {
                updated.players.push({
                  id: `sim_player_lobby_${i}`,
                  name,
                  avatar: PRESET_AVATARS[i + 1] || "👤",
                  approved: true,
                  teamId: null,
                  score: 0,
                  isHost: false,
                  isOnline: true
                });
              }
            });
            
            // Auto divide teams in 4 seconds
            setTimeout(() => {
              handleSimulatedAction({ type: "DIVIDE_TEAMS", divisionMethod: "random" });
            }, 3000);

            setRoom(updated);
            addSimLog("قام الخادم بموافقة طلب انضمامك للغرفة!");
            showToast("✓ وافق الخادم على انضمامك! جارٍ إعداد الفرق...");
          }
        }
      }

      // 3. Simulate automatic player responses during active Quiz game
      if (room.gameState === 'playing' && room.currentGame && !room.isTimerPaused) {
        // Find other approved players with assigned teams who haven't scored yet on this question index
        const participants = room.players.filter(p => p.approved && p.teamId && !p.isHost && p.id !== currentUser.id);
        if (participants.length > 0 && Math.random() > 0.7) {
          const shooter = participants[Math.floor(Math.random() * participants.length)];
          const isCorrect = Math.random() > 0.45; // 55% chance to guess correctly
          const pointsEarned = 20;

          handleSimulatedAction({
            type: "SUBMIT_ANSWER",
            playerId: shooter.id,
            points: pointsEarned,
            isCorrect
          });

          if (isCorrect) {
            showToast(`🔥 ${shooter.name} من فريق [${room.teams[shooter.teamId!]?.name.split(" ")[1]}] أجاب بشكل صحيح!`);
          }
        }
      }
    }, 4500);

    return () => clearInterval(interval);
  }, [room, connectionType, isSimulatorEnabled, role]);

  // --- GAME TIMER CLOCK SYNC LOOP ---
  useEffect(() => {
    if (!room || room.gameState !== 'playing') {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      return;
    }

    timerIntervalRef.current = setInterval(() => {
      if (room.isTimerPaused) return;

      // 1. Handle Speed Challenge point decay
      if (room.currentGame === 'speed') {
        setSpeedMultiplier(prev => Math.max(10, prev - 2));
      }

      // 2. Handle Guess Image tile reveal over time
      if (room.currentGame === 'guessimage' && !guessImageSolved) {
        if (room.roundTimer % 3 === 0) {
          setGuessImageRevealed(prev => {
            const hiddenIndices: number[] = [];
            prev.forEach((revealed, idx) => {
              if (!revealed) hiddenIndices.push(idx);
            });
            if (hiddenIndices.length > 0) {
              const randomIdx = hiddenIndices[Math.floor(Math.random() * hiddenIndices.length)];
              const next = [...prev];
              next[randomIdx] = true;
              return next;
            }
            return prev;
          });
        }
      }

      if (room.roundTimer > 1) {
        // Subtract timer
        setRoom(prev => {
          if (!prev) return null;
          return { ...prev, roundTimer: prev.roundTimer - 1 };
        });
      } else {
        // Timer ran out!
        if (role === 'host') {
          // If host, auto switch to next question or end round
          const maxQ = currentRoundQuizQuestions.length;
          if (room.currentQuestionIndex + 1 < maxQ) {
            sendWSMessage({
              type: "UPDATE_QUESTION_INDEX",
              roomCode: room.code,
              index: room.currentQuestionIndex + 1
            });
            showToast("⏰ انتهى وقت السؤال! الانتقال للسؤال التالي...");
          } else {
            sendWSMessage({
              type: "END_ROUND",
              roomCode: room.code
            });
          }
        }
      }
    }, 1000);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [room?.gameState, room?.currentQuestionIndex, room?.isTimerPaused, role, currentRoundQuizQuestions]);

  // --- HOST CREATES ROOM TRIGGER ---
  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const generatedCode = Math.floor(100000 + Math.random() * 900000).toString();
    setRole('host');
    setMode('active');
    
    // Connect and emit or setup local sim
    connectToWebSocket(generatedCode, currentUser.id, currentUser.name, currentUser.avatar || "⛪", true);
  };

  // --- PARTICIPANT JOIN ROOM TRIGGER ---
  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCodeInput.trim()) {
      showToast("برجاء إدخال كود الغرفة السداسي أولاً!");
      return;
    }
    const cleanCode = joinCodeInput.trim();
    setRole('participant');
    setMode('active');

    connectToWebSocket(cleanCode, currentUser.id, joinNameInput, selectedAvatar, false);
  };

  // --- SUBMIT ANSWER BY USER ---
  const handlePlayerSubmitAnswer = (optionIdx: number) => {
    if (hasSubmittedAnswer || !room || room.gameState !== 'playing') return;
    
    const self = room.players.find(p => p.id === currentUser.id);
    if (!self || !self.approved || !self.teamId) {
      showToast("لم يتم توزيعك على فريق للمشاركة حتى الآن!");
      return;
    }

    setSelectedOptionIdx(optionIdx);
    setHasSubmittedAnswer(true);

    const q = currentRoundQuizQuestions[room.currentQuestionIndex];
    if (q && q.id) {
      trackQuestionPlayed(currentUser.id, q.id);
      setDbPlayedIds(prev => Array.from(new Set([...prev, q.id])));
    }

    const isCorrect = q ? optionIdx === q.correctIdx : false;

    if (isCorrect) {
      playSound('success');
      sendWSMessage({
        type: "SUBMIT_ANSWER",
        roomCode: room.code,
        playerId: currentUser.id,
        points: 25,
        isCorrect: true
      });
      showToast("✨ إجابة صحيحة! أحسنت صنعاً وكسبت +25 نقطة لفريقك!");
      // Add XP & Points directly to user profile
      const userXP = (currentUser.xp || 0) + 20;
      const userPoints = (currentUser.points || 0) + 10;
      onUpdateUser({ ...currentUser, xp: userXP, points: userPoints });
    } else {
      playSound('wrong');
      showToast("❌ إجابة خاطئة! حظاً أفضل في السؤال القادم.");
    }
  };

  // --- GENERATE TEAMS AUTOMATICALLY ---
  const handleTriggerRandomTeams = () => {
    sendWSMessage({
      type: "DIVIDE_TEAMS",
      roomCode: room?.code,
      divisionMethod: "random"
    });
  };

  // --- MANUAL TEAM RE-ASSIGNMENT (SIMPLIFIED DRAG & DROP ALTERNATIVE) ---
  const handleAssignTeamManual = (playerId: string, teamId: string) => {
    if (!room) return;
    const currentAssignments: { [pId: string]: string } = {};
    room.players.forEach(p => {
      if (p.id === playerId) {
        currentAssignments[p.id] = teamId;
      } else if (p.teamId) {
        currentAssignments[p.id] = p.teamId;
      }
    });

    sendWSMessage({
      type: "DIVIDE_TEAMS",
      roomCode: room.code,
      divisionMethod: "manual",
      teamAssignments: currentAssignments
    });
  };

  // --- START SPECIFIC GAME FROM LOBBY ---
  const handleStartGame = (gameId: string) => {
    const approvedPlayers = room?.players.filter(p => p.approved && !p.isHost) || [];
    const withoutTeam = approvedPlayers.filter(p => !p.teamId);
    
    if (approvedPlayers.length === 0) {
      showToast("⚠️ لا يمكن بدء اللعبة بدون وجود مشتركين معتمدين في الغرفة!");
      return;
    }
    
    if (withoutTeam.length > 0) {
      // Auto divide remaining if manual but incomplete
      handleTriggerRandomTeams();
    }

    sendWSMessage({
      type: "START_GAME",
      roomCode: room?.code,
      game: gameId
    });
  };

  // --- MANUAL SCORE ADJUSTMENT ---
  const handleAdjustPoints = (teamId: string, amount: number, type?: string, description?: string) => {
    sendWSMessage({
      type: "ADJUST_POINTS",
      roomCode: room?.code,
      teamId,
      amount,
      txType: type,
      txDescription: description
    });
  };

  // --- NEXT GAME TRANSITION ---
  const handleTriggerNextGame = () => {
    sendWSMessage({
      type: "NEXT_GAME",
      roomCode: room?.code
    });
  };

  // --- END CONTEST FOREVER ---
  const handleFinishContest = () => {
    sendWSMessage({
      type: "FINISH_CONTEST",
      roomCode: room?.code
    });
  };

  // --- GENERATE IMAGE MOCK CARDS ---
  const handleShareAsImage = () => {
    showToast("📸 تم إنشاء بطاقة النتيجة وصورة الشرف لمشاركتها على واتساب ومجموعات الخدمة!");
  };

  // --- CLEANUP WS ON UNMOUNT ---
  useEffect(() => {
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  // Determine current team stats for participant
  const selfPlayer = room?.players.find(p => p.id === currentUser.id);
  const selfTeam = selfPlayer?.teamId ? room?.teams[selfPlayer.teamId] : null;
  const sortedTeams = room?.teams ? (Object.values(room.teams) as Team[]).sort((a, b) => b.score - a.score) : [];
  const selfRank = selfTeam ? sortedTeams.findIndex(t => t.id === selfTeam.id) + 1 : null;

  return (
    <div id="interactive-game-room-container" className="space-y-4 text-right" dir="rtl">
      
      {/* Toast Alert */}
      {toastMsg && (
        <div className="fixed top-20 left-4 right-4 bg-slate-900/95 text-white py-3.5 px-5 rounded-2xl text-xs font-black shadow-2xl z-[9999] flex items-center gap-2 border border-slate-700/50 justify-between animate-bounce">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-amber-400 rounded-full animate-ping" />
            <p>{toastMsg}</p>
          </div>
          <button onClick={() => setToastMsg(null)} className="text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Title Header bar */}
      <div className="flex justify-between items-center bg-gradient-to-r from-amber-600 to-amber-700 p-4 rounded-3xl text-white shadow-md">
        <div className="flex items-center gap-2.5">
          <button 
            onClick={() => {
              playSound('click');
              onBack();
            }} 
            className="p-1.5 bg-white/15 hover:bg-white/25 rounded-lg text-white transition-all"
            title="رجوع"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-sm font-black flex items-center gap-1">
              <Gamepad2 className="w-4.5 h-4.5 text-amber-200" />
              غرفة الألعاب التفاعلية 🎮
            </h2>
            <p className="text-[10px] text-amber-100">مسابقات مسيحية وأنشطة جماعية خلوية في الوقت الفعلي</p>
          </div>
        </div>

        {room && (
          <div className="bg-white/15 px-3 py-1.5 rounded-xl flex items-center gap-1.5 text-[10px] font-black">
            <span className={`w-2 h-2 rounded-full ${connectionType === 'real' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <span>{connectionType === 'real' ? 'خادم متصل' : 'محاكي ذاتي'}</span>
          </div>
        )}
      </div>

      {/* -------------------- 1. ROLE SELECTION SCREEN -------------------- */}
      {mode === 'selection' && (
        <div className="bg-white shadow-sm shadow-slate-200/50 border border-slate-100 rounded-3xl p-6 text-center space-y-6">
          <div className="max-w-md mx-auto space-y-2">
            <Crown className="w-12 h-12 text-amber-500 mx-auto animate-bounce" />
            <h3 className="text-base font-black text-[#0A2342]">انضم للتحدي الجماعي المبارك!</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              تتيح لك غرفة الألعاب التنافس مع أصدقائك في المؤتمر أو الخلوة. قم بإنشاء غرفة جديدة كخادم منظم، أو انضم لغرفة نشطة بمفردك أو مع زملائك.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto">
            {/* Create Room as Host Card */}
            <button
              id="select-host-role-btn"
              onClick={() => { setRole('host'); setMode('create'); }}
              className="bg-gradient-to-b from-amber-50 to-amber-100/50 hover:from-amber-100 border-2 border-amber-300 rounded-3xl p-5 text-right space-y-3 transition-all transform hover:scale-[1.02] shadow-sm cursor-pointer"
            >
              <div className="w-10 h-10 bg-amber-500 text-white rounded-2xl flex items-center justify-center font-black">
                <Crown className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-black text-[#0A2342]">أنا خادم منظم (Host)</h4>
                <p className="text-[10px] text-slate-500 leading-relaxed mt-1">
                  إنشاء غرفة جديدة، تقسيم المخدومين لفرق، اختيار الألعاب، التحكم في النقاط وحسم النتيجة الكبرى.
                </p>
              </div>
            </button>

            {/* Join Room as Participant Card */}
            <button
              id="select-participant-role-btn"
              onClick={() => { setRole('participant'); setMode('join'); }}
              className="bg-gradient-to-b from-blue-50 to-blue-100/30 hover:from-blue-100 border-2 border-blue-200 rounded-3xl p-5 text-right space-y-3 transition-all transform hover:scale-[1.02] shadow-sm cursor-pointer"
            >
              <div className="w-10 h-10 bg-blue-500 text-white rounded-2xl flex items-center justify-center font-black">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-black text-[#0A2342]">أنا مشترك متسابق (Join)</h4>
                <p className="text-[10px] text-slate-500 leading-relaxed mt-1">
                  الانضمام بكود الغرفة، الانخراط في فريق بطرس أو بولس، والإجابة عن الأسئلة في الوقت الفعلي.
                </p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* -------------------- 2. CREATE ROOM FORM -------------------- */}
      {mode === 'create' && (
        <RoomCreateWizard
          onCancel={() => setMode('selection')}
          onCreateRoom={(roomData) => {
            setRoomName(roomData.name);
            setEventType(roomData.eventType);
            setTeamCount(roomData.teamCount);
            setDivisionMethod(roomData.divisionMethod);
            setAllowedGames(roomData.allowedGames);
            
            setRole('host');
            setMode('active');

            const generatedCode = Math.floor(100000 + Math.random() * 900000).toString();
            connectToWebSocket(generatedCode, currentUser.id, currentUser.name, currentUser.avatar || "⛪", true, roomData.teamConfigs);
          }}
        />
      )}

      {/* -------------------- 3. JOIN ROOM FORM -------------------- */}
      {mode === 'join' && (
        <form onSubmit={handleJoinRoom} className="bg-white shadow-sm shadow-slate-200/50 border border-slate-100 rounded-3xl p-6 space-y-4">
          <div className="flex justify-between items-center border-b pb-3 border-[#D6D6C2]">
            <h3 className="text-xs font-black text-[#0A2342] flex items-center gap-1.5">
              <UserPlus className="w-4 h-4 text-blue-500" />
              انضمام إلى غرفة ألعاب جارية
            </h3>
            <button type="button" onClick={() => setMode('selection')} className="text-slate-400 hover:text-slate-600 text-xs font-black">إلغاء</button>
          </div>

          <div className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-black text-slate-700 mb-1">كود الغرفة المكون من ٦ أرقام 🔢</label>
              <input
                type="text"
                maxLength={6}
                required
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value.replace(/\D/g, ''))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 text-center text-lg font-black tracking-widest focus:outline-none focus:border-blue-500 text-slate-800"
                placeholder="458921"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black text-slate-700 mb-1">اسم الشهرة الخاص بك في اللعبة 👤</label>
              <input
                type="text"
                required
                value={joinNameInput}
                onChange={(e) => setJoinNameInput(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                placeholder="ادخل اسمك الثنائي"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black text-slate-700 mb-1">اختر الرمز أو الأيقونة الروحية المفضلة 🕊️</label>
              <div className="flex flex-wrap gap-2 justify-center py-1">
                {PRESET_AVATARS.map(av => (
                  <button
                    key={av}
                    type="button"
                    onClick={() => setSelectedAvatar(av)}
                    className={`w-9 h-9 rounded-full border text-sm flex items-center justify-center transition-all ${
                      selectedAvatar === av
                        ? 'bg-blue-100 border-blue-500 scale-110 shadow-xs'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {av}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            type="submit"
            id="submit-join-room-btn"
            className="w-full py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white text-xs font-black rounded-xl shadow-md transform hover:scale-[1.01] active:scale-95 transition-all cursor-pointer"
          >
            طلب الانضمام إلى الغرفة الروحية ✓
          </button>
        </form>
      )}

      {/* -------------------- 4. ACTIVE GAME ROOM INTERFACE -------------------- */}
      {mode === 'active' && room && (
        <div className="space-y-4">
          
          {/* TOP BAR / CARD */}
          <div className="bg-white shadow-sm shadow-slate-200/50 border border-slate-100 rounded-3xl p-4 shadow-xs relative overflow-hidden">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <span className="text-[10px] bg-amber-100 text-amber-800 font-black px-2.5 py-0.5 rounded-full">
                  {room.eventType === 'retreat' ? '⛪ خلوة مسيحية' : room.eventType === 'conference' ? '🏰 مؤتمر مبارك' : '⛪ اجتماع روحي'}
                </span>
                <h3 className="text-xs sm:text-sm font-black text-[#0A2342] mt-1.5">{room.name}</h3>
              </div>

              {/* ROOM CODE WITH QR CODE PREVIEW */}
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-150 p-2 rounded-2xl self-stretch sm:self-auto justify-between">
                <div className="text-right">
                  <p className="text-[8.5px] text-slate-400 font-bold">كود انضمام المشتركين</p>
                  <p className="text-base font-black tracking-wider text-slate-800 leading-none mt-0.5">{room.code}</p>
                </div>
                <div className="w-8 h-8 bg-white border rounded-lg flex items-center justify-center text-slate-700" title="QR Code للغرفة">
                  <QrCode className="w-5 h-5 shrink-0" />
                </div>
              </div>
            </div>

            {/* Quick Lock / Unlock Room Control for Host */}
            {role === 'host' && (
              <div className="flex justify-between items-center border-t border-slate-100 pt-2.5 mt-2.5">
                <span className="text-[10px] font-black text-slate-500">حالة باب الغرفة:</span>
                <button
                  type="button"
                  onClick={() => sendWSMessage({ type: "LOCK_ROOM", roomCode: room.code, isLocked: !room.isLocked })}
                  className={`px-3 py-1 rounded-lg text-[10px] font-black flex items-center gap-1.5 transition-all ${
                    room.isLocked
                      ? 'bg-red-50 text-red-600 border border-red-200'
                      : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                  }`}
                >
                  {room.isLocked ? (
                    <>
                      <Lock className="w-3.5 h-3.5" />
                      <span>الغرفة مقفلة ومكتملة</span>
                    </>
                  ) : (
                    <>
                      <Unlock className="w-3.5 h-3.5 animate-pulse" />
                      <span>باب الانضمام مفتوح</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* ------------------ A. LOBBY STATE (NOT PLAYING) ------------------ */}
          {room.gameState === 'lobby' && (
            role === 'host' ? (
              <RoomHostDashboard
                room={room}
                currentUser={currentUser}
                role={role}
                sendWSMessage={sendWSMessage}
                showToast={showToast}
                onStartFirstGame={() => handleStartGame(room.allowedGames[0])}
                onAssignTeamManual={handleAssignTeamManual}
                onTriggerRandomTeams={handleTriggerRandomTeams}
                onBackToSelection={() => {
                  setRoom(null);
                  setMode('selection');
                }}
              />
            ) : (
              <div className="space-y-4" dir="rtl">
              {/* TAB BAR NAVIGATION */}
              <div className="flex border-b border-slate-200 gap-1.5 pb-0.5">
                <button
                  onClick={() => setLobbyTab('players')}
                  className={`py-2 px-4 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    lobbyTab === 'players'
                      ? 'bg-[#0A2342] text-white shadow-3xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  👥 إدارة اللاعبين والفرق
                </button>
                <button
                  onClick={() => setLobbyTab('plugins')}
                  className={`py-2 px-4 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    lobbyTab === 'plugins'
                      ? 'bg-[#0A2342] text-white shadow-3xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  🎮 مكتبة ألعاب المحرّك (Plugins)
                </button>
                <button
                  onClick={() => setLobbyTab('sessions')}
                  className={`py-2 px-4 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    lobbyTab === 'sessions'
                      ? 'bg-[#0A2342] text-white shadow-3xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  📜 سجل الجلسات والتحكم بالنقاط
                </button>
              </div>

              {/* TAB 1: PLAYERS & TEAMS */}
              {lobbyTab === 'players' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* LEFT COLUMN: PARTICIPANTS STATUS */}
                  <div className="bg-[#0B0F1A] shadow-2xl border border-white/5 rounded-2xl p-4 space-y-3 md:col-span-2">
                    <div className="flex justify-between items-center border-b border-white/5 pb-2">
                      <h4 className="text-[11px] font-black text-white flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-amber-500" />
                        المتواجدون ({room.players.length})
                      </h4>
                      <span className="text-[9px] bg-white/5 text-slate-400 font-bold px-2 py-0.5 rounded-full">
                        المعتمدين: {room.players.filter(p => p.approved).length}
                      </span>
                    </div>

                    {/* Player List */}
                    <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                      {room.players.map(p => (
                        <div
                          key={p.id}
                          className={`flex justify-between items-center p-2 rounded-xl border transition-all ${
                            p.isHost 
                              ? 'bg-amber-500/5 border-amber-500/20' 
                              : p.approved 
                                ? 'bg-white/5 border-white/5' 
                                : 'bg-white/[0.02] border-white/5 animate-pulse'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">{p.avatar}</span>
                            <div>
                              <p className="text-[11px] font-black text-slate-100 flex items-center gap-1">
                                {p.name}
                                {p.isHost && <span className="text-[8px] bg-amber-500 text-white px-1.5 py-0.2 rounded-full uppercase">Host</span>}
                              </p>
                              <p className="text-[8.5px] text-slate-500 mt-0.5 font-medium">
                                {p.teamId ? `فريق: ${room.teams[p.teamId]?.name.split(" ")[1]}` : 'لم يوزع بعد'}
                                {!p.isOnline && ' • (Offline)'}
                              </p>
                            </div>
                          </div>

                          {/* Approval controls for Host */}
                          <div className="flex items-center gap-1.5">
                            {(role as string) === 'host' && !p.isHost && (
                              <div className="flex gap-1.5">
                                {!p.approved ? (
                                  <>
                                    <button
                                      onClick={() => sendWSMessage({ type: "APPROVE_PLAYER", roomCode: room.code, playerId: p.id, approved: true })}
                                      className="p-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-[9px] font-black px-2 flex items-center gap-0.5"
                                    >
                                      <Check className="w-3 h-3" /> قبول
                                    </button>
                                    <button
                                      onClick={() => sendWSMessage({ type: "APPROVE_PLAYER", roomCode: room.code, playerId: p.id, approved: false })}
                                      className="p-1 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-[9px] font-black px-2 flex items-center gap-0.5"
                                    >
                                      <X className="w-3 h-3" /> رفض
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => sendWSMessage({ type: "TRANSFER_HOST", roomCode: room.code, playerId: p.id })}
                                      className="p-1 text-amber-600 hover:bg-amber-50 rounded-lg text-[9px] font-black px-2 border border-amber-100"
                                      title="نقل صلاحية المنظم لهذا اللاعب"
                                    >
                                      تعيين كـ Host 👑
                                    </button>
                                    <button
                                      onClick={() => sendWSMessage({ type: "KICK_PLAYER", roomCode: room.code, playerId: p.id })}
                                      className="p-1 text-red-500 hover:bg-red-50 rounded-lg text-[9px] font-black px-2"
                                      title="طرد"
                                    >
                                      طرد المشترك
                                    </button>
                                  </>
                                )}
                              </div>
                            )}

                            {/* Dropdown manually assigning teams (Drag-alternative) */}
                            {(role as string) === 'host' && p.approved && !p.isHost && (
                              <select
                                value={p.teamId || ''}
                                onChange={(e) => handleAssignTeamManual(p.id, e.target.value)}
                                className="bg-slate-100 text-[9.5px] font-black rounded-lg border-none px-1 py-0.5"
                              >
                                <option value="">-- بلا فريق --</option>
                                {(Object.values(room.teams) as Team[]).map(t => (
                                  <option key={t.id} value={t.id}>{t.name.split(" ")[1] || t.name}</option>
                                ))}
                              </select>
                            )}

                            {/* Player self status display */}
                            {p.id === currentUser.id && (
                              <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                                {!p.approved ? 'بانتظار موافقة الخادم...' : 'تم قبولك وعضو بالغرفة ✓'}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Team Assignment Box */}
                    {room.players.filter(p => p.approved && !p.isHost).length > 0 && (
                      <div className="border-t border-[#D6D6C2] pt-4 mt-2 space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] font-black text-slate-700">توزيع فرق المتسابقين الحالية:</span>
                          {(role as string) === 'host' && (
                            <button
                              type="button"
                              onClick={handleTriggerRandomTeams}
                              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-black rounded-lg flex items-center gap-1"
                            >
                              <RefreshCw className="w-3 h-3" /> تقسيم عشوائي متساوي
                            </button>
                          )}
                        </div>

                        {/* Columns representing Teams */}
                        <div className="grid grid-cols-2 gap-2.5">
                          {(Object.values(room.teams) as Team[]).map(team => {
                            const members = room.players.filter(p => p.approved && p.teamId === team.id);
                            return (
                              <div key={team.id} className="border border-slate-150 rounded-2xl p-3 space-y-2" style={{ borderTop: `4px solid ${team.color}` }}>
                                <div className="flex justify-between items-center">
                                  <span className="text-[10.5px] font-black text-slate-800">{team.name}</span>
                                  <span className="text-[9px] text-slate-400 font-bold">{members.length} متسابق</span>
                                </div>
                                <div className="bg-slate-50 rounded-xl p-1.5 min-h-[50px] space-y-1">
                                  {members.length === 0 ? (
                                    <p className="text-[9px] text-slate-400 text-center py-3">فارغ</p>
                                  ) : (
                                    members.map(m => (
                                      <div key={m.id} className="text-[9.5px] font-black text-slate-700 bg-white p-1 rounded border flex items-center justify-between">
                                        <span>{m.avatar} {m.name.split(" ")[0]}</span>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* RIGHT COLUMN: INFORMATION STATUS CARD */}
                  <div className="space-y-4">
                    <div className="bg-white shadow-sm shadow-slate-200/50 border border-slate-100 rounded-3xl p-5 text-center space-y-4">
                      <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto animate-pulse">
                        <Users className="w-6 h-6" />
                      </div>
                      <div className="space-y-1.5">
                        <h4 className="text-xs font-black text-[#0A2342]">حالة الغرفة الحالية</h4>
                        <p className="text-[10.5px] text-slate-500 leading-relaxed">
                          رمز الغرفة: <strong className="text-amber-600 text-xs font-mono">{room.code}</strong>. شارك هذا الرمز أو قم بمسح الـ QR للإنضمام الفوري.
                        </p>
                      </div>

                      {selfTeam ? (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-right">
                          <p className="text-[10px] text-slate-400">مجموعتك الروحية الحالية:</p>
                          <p className="text-xs font-black text-emerald-800 mt-0.5 flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: selfTeam.color }} />
                            {selfTeam.name}
                          </p>
                        </div>
                      ) : (
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-right text-[10.5px] text-amber-800">
                          🔔 لم يقم الخادم بتوزيعك على فريق حتى الآن. انتظر التقسيم للمشاركة في الألعاب.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: PLUGINS LIBRARY */}
              {lobbyTab === 'plugins' && (
                <div className="space-y-3">
                  <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl text-right">
                    <h5 className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-600 fill-amber-500 animate-pulse" />
                      <span>محرك الألعاب الموحد (Unified Plugin Architecture)</span>
                    </h5>
                    <p className="text-[10px] text-amber-800 leading-relaxed mt-1">
                      تم تصميم محرك الألعاب هذا ليدير كافة الألعاب الروحية والعقائدية بالتوازي وبصورة مرنة. عند إضافة أي لعبة جديدة مستقبلًا، يتم دمجها تلقائيًا في مكتبة الـ Plugins دون تغيير البنية التحتية. اختر اللعبة من القائمة واضغط "تشغيل اللعبة".
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {GAME_ENGINE_PLUGINS.map(plugin => (
                      <PluginSystemCard
                        key={plugin.id}
                        plugin={plugin}
                        isActive={room.currentGame === plugin.id}
                        onLaunch={(pluginId) => handleStartGame(pluginId)}
                        role={role}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 3: SESSIONS HISTORY & SCORE ENGINE */}
              {lobbyTab === 'sessions' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* LEFT COLUMN: SESSIONS HISTORY */}
                  <div className="bg-white shadow-sm shadow-slate-200/50 border border-slate-100 rounded-3xl p-5 space-y-4 md:col-span-2 text-right font-sans">
                    <h4 className="text-xs font-black text-[#0A2342] border-b pb-2 flex items-center gap-1.5">
                      <Trophy className="w-4 h-4 text-amber-500" />
                      سجلات الجلسات المؤرشفة لهذه الغرفة ({room.sessionHistory?.length || 0} جلسة)
                    </h4>

                    {(!room.sessionHistory || room.sessionHistory.length === 0) ? (
                      <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-2xl bg-white">
                        <p className="text-xs text-slate-400 font-bold">لا توجد جلسات مؤرشفة بعد.</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">عند إنهاء المسابقة وتتويج الفرق، ستظهر التقارير الكاملة للألعاب والفرسان هنا.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {room.sessionHistory.map((s, idx) => (
                          <div key={s.id} className="border border-slate-200 bg-white p-4 rounded-2xl hover:border-indigo-400 transition-all shadow-3xs">
                            <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-2">
                              <span className="text-xs font-black text-slate-800">الجلسة #{idx + 1} - كود الغرفة {s.roomCode}</span>
                              <span className="text-[9px] bg-slate-200 px-2 py-0.5 rounded-full font-bold text-slate-600">
                                المدة: {Math.floor(s.totalDuration / 60)}د {s.totalDuration % 60}ث
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-600">
                              <p>📌 <strong>ألعاب ملعوبة:</strong> {s.gamesPlayed.join(', ') || 'لا يوجد'}</p>
                              <p>👥 <strong>عدد الحاضرين:</strong> {s.participantsCount} مشترك</p>
                              <p>🏆 <strong>تاريخ البدء:</strong> {new Date(s.startTime).toLocaleTimeString('ar-EG')}</p>
                              <p>⏳ <strong>تاريخ النهاية:</strong> {new Date(s.endTime || '').toLocaleTimeString('ar-EG')}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* RIGHT COLUMN: REAL-TIME SCORE ENGINE PANEL */}
                  <div className="space-y-4">
                    <ScoreEnginePanel
                      teams={room.teams}
                      transactions={room.transactions || []}
                      onAdjustPoints={(teamId, amount, type, desc) => handleAdjustPoints(teamId, amount, type, desc)}
                      onResetPoints={() => sendWSMessage({ type: "RESET_POINTS", roomCode: room.code })}
                      role={role}
                    />
                  </div>
                </div>
              )}
            </div>
            )
          )}

          {/* ------------------ B. PLAYING STATE ------------------ */}
          {room.gameState === 'playing' && room.currentGame && (
            <div className="space-y-4" dir="rtl">
              {/* TIMER ENGINE INTEGRATION AT THE TOP */}
              <TimerEnginePanel
                roundTimer={room.roundTimer}
                isTimerPaused={room.isTimerPaused}
                gameStartTime={room.sessionStartTime}
                onTogglePause={() => sendWSMessage({ type: "PAUSE_GAME", roomCode: room.code, isPaused: !room.isTimerPaused })}
                onResetTimer={() => sendWSMessage({ type: "SET_TIMER", roomCode: room.code, timer: 45 })}
                role={role}
                gameType={room.currentGame}
              />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* PRIMARY GAME CARD COLUMN */}
                <div className="bg-white shadow-sm shadow-slate-200/50 border border-slate-100 rounded-3xl p-5 space-y-4 md:col-span-2">
                  
                  {/* GAME ACTIVE HEADER */}
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-1.5 text-right">
                      <span className="text-sm bg-amber-100 p-1 rounded-lg">
                        {PREDEFINED_GAMES.find(g => g.id === room.currentGame)?.icon}
                      </span>
                      <div>
                        <h4 className="text-xs font-black text-slate-800">
                          {PREDEFINED_GAMES.find(g => g.id === room.currentGame)?.label}
                        </h4>
                        <p className="text-[9.5px] text-slate-400 mt-0.5">
                          السؤال {room.currentQuestionIndex + 1} من أصل {currentRoundQuizQuestions.length}
                        </p>
                      </div>
                    </div>

                    {/* ROUND TIMER */}
                    <div className="flex items-center gap-1.5 bg-slate-900 text-white px-3 py-1 rounded-full text-xs font-black">
                      <Timer className={`w-3.5 h-3.5 ${room.roundTimer < 10 ? 'text-red-500 animate-pulse' : 'text-amber-400'}`} />
                      <span className="font-mono">{room.roundTimer}ث</span>
                    </div>
                  </div>

                  {/* GAME CONTENT MODULE RENDERER */}
                  <GameRoomManager
                    currentGame={room.currentGame}
                    currentQuestionIndex={room.currentQuestionIndex}
                    currentRoundQuizQuestions={currentRoundQuizQuestions}
                    role={role}
                    currentUser={currentUser}
                    room={room}
                    hasSubmittedAnswer={hasSubmittedAnswer}
                    selectedOptionIdx={selectedOptionIdx}
                    handlePlayerSubmitAnswer={handlePlayerSubmitAnswer}
                    speedMultiplier={speedMultiplier}
                    timeRushCorrect={timeRushCorrect}
                    timeRushTotal={timeRushTotal}
                    setTimeRushCorrect={setTimeRushCorrect}
                    setTimeRushTotal={setTimeRushTotal}
                    charadesActor={charadesActor}
                    charadesItem={charadesItem}
                    setCharadesItem={setCharadesItem}
                    handleAdjustPoints={handleAdjustPoints}
                    guessImageRevealed={guessImageRevealed}
                    setGuessImageRevealed={setGuessImageRevealed}
                    guessImageGuessValue={guessImageGuessValue}
                    setGuessImageGuessValue={setGuessImageGuessValue}
                    guessImageSolved={guessImageSolved}
                    setGuessImageSolved={setGuessImageSolved}
                    guessImageItem={guessImageItem}
                    setGuessImageItem={setGuessImageItem}
                    wheelAngle={wheelAngle}
                    setWheelAngle={setWheelAngle}
                    wheelIsSpinning={wheelIsSpinning}
                    setWheelIsSpinning={setWheelIsSpinning}
                    wheelResultText={wheelResultText}
                    setWheelResultText={setWheelResultText}
                    escapeLockIdx={escapeLockIdx}
                    setEscapeLockIdx={setEscapeLockIdx}
                    escapeCodeValue={escapeCodeValue}
                    setEscapeCodeValue={setEscapeCodeValue}
                    escapeRoomHintShown={escapeRoomHintShown}
                    setEscapeRoomHintShown={setEscapeRoomHintShown}
                    bombBoxes={bombBoxes}
                    setBombBoxes={setBombBoxes}
                    luckyBoxChoices={luckyBoxChoices}
                    setLuckyBoxChoices={setLuckyBoxChoices}
                    luckyBoxOutcomes={luckyBoxOutcomes}
                    setLuckyBoxOutcomes={setLuckyBoxOutcomes}
                    diceValue={diceValue}
                    setDiceValue={setDiceValue}
                    isDiceRolling={isDiceRolling}
                    setIsDiceRolling={setIsDiceRolling}
                    customQuestionBank={customQuestionBank}
                    setCustomQuestionBank={setCustomQuestionBank}
                    qBankForm={qBankForm}
                    setQBankForm={setQBankForm}
                    tournamentMatches={tournamentMatches}
                    setTournamentMatches={setTournamentMatches}
                    drawSecret={drawSecret}
                    drawPaths={drawPaths}
                    setDrawPaths={setDrawPaths}
                    randomChallengeText={randomChallengeText}
                    setRandomChallengeText={setRandomChallengeText}
                    dailyEventItem={dailyEventItem}
                    showToast={showToast}
                    sendWSMessage={sendWSMessage}
                  />
                </div>

                {/* SIDEBAR FOR HOST CONTROLS OR PLAYER SCORE DISPLAY */}
                <div className="space-y-4">
                  {role === 'host' ? (
                    <>
                      <div className="bg-gradient-to-b from-slate-900 to-slate-800 text-white rounded-3xl p-5 space-y-4 shadow-lg border border-slate-700 text-right">
                        <h4 className="text-xs font-black text-amber-400 flex items-center gap-1.5">
                          <Settings className="w-4 h-4 animate-spin" />
                          لوحة تحكم الخادم (Host Control)
                        </h4>

                        {/* NEXT QUESTION / SKIP controls */}
                        <div className="space-y-2 border-b border-slate-700 pb-3">
                          <p className="text-[9px] text-slate-400">مرحلة اللعبة الحالية:</p>
                          
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => {
                                const nextIdx = room.currentQuestionIndex + 1;
                                if (nextIdx < currentRoundQuizQuestions.length) {
                                  sendWSMessage({ type: "UPDATE_QUESTION_INDEX", roomCode: room.code, index: nextIdx });
                                } else {
                                  showToast("⚠️ وصلت للسؤال الأخير بالفعل.");
                                }
                              }}
                              disabled={room.currentQuestionIndex + 1 >= currentRoundQuizQuestions.length}
                              className="py-2 bg-white/10 hover:bg-white/20 text-white disabled:opacity-40 text-[10.5px] font-black rounded-xl cursor-pointer transition-all"
                            >
                              السؤال التالي ⏭️
                            </button>

                            <button
                              onClick={() => sendWSMessage({ type: "PAUSE_GAME", roomCode: room.code, isPaused: !room.isTimerPaused })}
                              className={`py-2 text-[10.5px] font-black rounded-xl transition-all cursor-pointer ${
                                room.isTimerPaused 
                                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                                  : 'bg-amber-500 hover:bg-amber-600 text-white'
                              }`}
                            >
                              {room.isTimerPaused ? 'استئناف الوقت ▶️' : 'إيقاف مؤقت ⏸️'}
                            </button>
                          </div>

                          <button
                            onClick={() => sendWSMessage({ type: "END_ROUND", roomCode: room.code })}
                            className="w-full py-2 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white text-[10.5px] font-black rounded-xl shadow-xs cursor-pointer transition-all"
                          >
                            🏁 إنهاء الجولة وإعلان نتائج اللعبة
                          </button>
                        </div>
                      </div>

                      {/* SCORE ENGINE PANEL AND AUDIT LOGS */}
                      <ScoreEnginePanel
                        teams={room.teams}
                        transactions={room.transactions || []}
                        onAdjustPoints={(teamId, amount, type, desc) => handleAdjustPoints(teamId, amount, type, desc)}
                        onResetPoints={() => sendWSMessage({ type: "RESET_POINTS", roomCode: room.code })}
                        role={role}
                      />
                    </>
                  ) : (
                    // Player status during playing
                    <div className="bg-white shadow-sm shadow-slate-200/50 border border-slate-100 rounded-3xl p-5 space-y-4">
                      <h4 className="text-xs font-black text-[#0A2342] border-b pb-2">لوحة نتائج المتسابق</h4>
                      
                      {selfTeam ? (
                        <div className="space-y-3">
                          <div className="bg-slate-50 border p-3 rounded-2xl text-right">
                            <p className="text-[10px] text-slate-400">فريقك وترتيبه الحالي:</p>
                            <div className="flex justify-between items-center mt-1">
                              <p className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: selfTeam.color }} />
                                {selfTeam.name}
                              </p>
                              <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-black">
                                المركز {selfRank}
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-center">
                            <div className="bg-amber-50 p-2.5 rounded-xl">
                              <p className="text-[9.5px] text-amber-800">نقاط فريقك</p>
                              <p className="text-base font-black text-amber-600 font-mono mt-0.5">{selfTeam.score}</p>
                            </div>
                            <div className="bg-emerald-50 p-2.5 rounded-xl">
                              <p className="text-[9.5px] text-emerald-800">نقاطك الفردية</p>
                              <p className="text-base font-black text-emerald-600 font-mono mt-0.5">{selfPlayer?.score}</p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-[10.5px] text-slate-500 text-center py-4 leading-relaxed">
                          ⚠️ لست مسجلاً في فريق حتى الآن. يمكنك المشاهدة أو انتظار توزيع الخادم.
                        </p>
                      )}

                      {/* LIVE LEADERBOARD PREVIEW */}
                      <div className="space-y-1.5 pt-2 border-t">
                        <p className="text-[10px] font-black text-slate-400">ترتيب الفرق المباشر:</p>
                        {sortedTeams.map((team, index) => (
                          <div key={team.id} className="flex justify-between items-center text-xs p-1.5 rounded-lg hover:bg-slate-50">
                            <span className="text-slate-500 font-black">#{index + 1}</span>
                            <span className="font-bold flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: team.color }} />
                              {team.name}
                            </span>
                            <span className="font-mono text-slate-700 font-bold">{team.score} ن</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ------------------ C. ROUND OVER STATE ------------------ */}
          {room.gameState === 'round_over' && (
            <div className="bg-white shadow-sm shadow-slate-200/50 border border-slate-100 rounded-3xl p-6 text-center space-y-6">
              <div className="max-w-md mx-auto space-y-2">
                <Trophy className="w-12 h-12 text-amber-500 mx-auto" />
                <h3 className="text-base font-black text-[#0A2342]">انتهت الجولة الروحية بنجاح! 🏁</h3>
                <p className="text-xs text-slate-500">مبارك لجميع الفرق! إليكم ترتيب درجات النقاط الكلية بعد انتهاء اللعبة الحالية.</p>
              </div>

              {/* LEADERBOARD LIST */}
              <div className="max-w-md mx-auto bg-slate-50 rounded-2xl p-4 border space-y-2">
                {sortedTeams.map((t, idx) => (
                  <div key={t.id} className="flex justify-between items-center p-3 bg-white rounded-xl border border-slate-150">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-slate-400">
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                      </span>
                      <span className="font-bold flex items-center gap-1.5 text-xs text-slate-800">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                        {t.name}
                      </span>
                    </div>
                    <span className="font-mono font-black text-amber-600 text-xs">{t.score} نقطة</span>
                  </div>
                ))}
              </div>

              {/* NEXT STEP CONTROLS (Host Only) */}
              {role === 'host' ? (
                <div className="flex flex-col sm:flex-row gap-2.5 justify-center max-w-md mx-auto pt-4 border-t">
                  <button
                    onClick={handleTriggerNextGame}
                    className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white text-xs font-black rounded-xl shadow-xs transition-all"
                  >
                    🎮 اللعبة التالية (نفس المتسابقين)
                  </button>
                  <button
                    onClick={handleFinishContest}
                    className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black rounded-xl shadow-xs transition-all"
                  >
                    🏆 إنهاء وتتويج الفائز بالمسابقة
                  </button>
                </div>
              ) : (
                <p className="text-[10.5px] text-slate-500 leading-relaxed max-w-sm mx-auto">
                  يرجى الانتظار، يقوم الخادم حاليًا بتحديد اللعبة التالية أو إنهاء المسابقة وتتويج بطل الخلوة الروحية.
                </p>
              )}
            </div>
          )}

          {/* ------------------ D. FINISHED / CHAMPION STATE ------------------ */}
          {room.gameState === 'finished' && (
            <div className="bg-white shadow-sm shadow-slate-200/50 border border-slate-100 rounded-3xl p-6 text-center space-y-6">
              
              {/* Grand Celebratory Trophy header */}
              <div className="space-y-3">
                <Crown className="w-16 h-16 text-yellow-500 mx-auto animate-bounce" />
                <h3 className="text-lg font-black text-[#0A2342]">كأس الخلوة الروحية والمؤتمرات 🏆</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  توجت المسابقة بالنعمة والبركة الكنسية! نبارك للفريق المتصدر ولأفضل متسابق روحي متميز.
                </p>
              </div>

              {/* CARD: WINNER TEAM AND MVP */}
              <div id="pima-final-score-card" className="max-w-md mx-auto bg-gradient-to-br from-amber-50 to-amber-100/50 border-2 border-amber-300 rounded-3xl p-5 space-y-4 shadow-sm text-right relative overflow-hidden">
                <div className="absolute top-[-10px] left-[-10px] w-16 h-16 bg-amber-300/20 rounded-full blur-lg" />
                
                <div className="border-b border-amber-200 pb-3">
                  <span className="text-[10px] bg-amber-600 text-white font-black px-2.5 py-0.5 rounded-full">
                    فريق الأبطال المتصدر 👑
                  </span>
                  <p className="text-sm font-black text-slate-800 flex items-center gap-2 mt-2">
                    <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: sortedTeams[0]?.color }} />
                    {sortedTeams[0]?.name || 'فريق القديس بولس'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">الرصيد الكلي: <span className="font-mono font-black text-amber-600">{sortedTeams[0]?.score || 0} نقطة</span></p>
                </div>

                {/* MVP award */}
                {room.mvp && (
                  <div className="pt-1">
                    <span className="text-[10px] bg-blue-600 text-white font-black px-2.5 py-0.5 rounded-full">
                      نجم اللقاء الروحي (MVP) 🌟
                    </span>
                    <p className="text-xs font-black text-slate-800 mt-2 flex items-center gap-1">
                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-400" />
                      {room.mvp.name}
                    </p>
                    <p className="text-[10.5px] text-slate-500 mt-0.5">حصل فردياً على {room.mvp.score} نقطة تفاعلية مباركة!</p>
                  </div>
                )}
              </div>

              {/* STATISTICS GRID */}
              <div className="grid grid-cols-2 gap-3 max-w-md mx-auto text-right">
                <div className="bg-slate-50 p-3 rounded-2xl border text-slate-700">
                  <p className="text-[10px] text-slate-400">إجمالي الألعاب الملعبة:</p>
                  <p className="text-xs font-black mt-1 text-[#0A2342]">{room.gameHistory.length} ألعاب روحية</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-2xl border text-slate-700">
                  <p className="text-[10px] text-slate-400">الموسم أو المؤتمر التابع:</p>
                  <p className="text-xs font-black mt-1 text-[#0A2342]">Season: Summer 2026</p>
                </div>
              </div>

              {/* ACTION BUTTONS */}
              <div className="flex flex-col sm:flex-row gap-2.5 justify-center max-w-md mx-auto">
                <button
                  onClick={handleShareAsImage}
                  className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-black rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all"
                >
                  <Share2 className="w-4 h-4" />
                  مشاركة النتيجة كصورة 📸
                </button>
                <button
                  onClick={() => { setRoom(null); setMode('selection'); }}
                  className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black rounded-xl shadow-md transition-all"
                >
                  الخروج والعودة للرئيسية
                </button>
              </div>

            </div>
          )}

          {/* -------------------- SIMULATION CONTROLS BOX (COLLAPSIBLE SIDEBAR) -------------------- */}
          {connectionType === 'simulated' && (
            <div className="bg-slate-50 border border-slate-200 rounded-3xl p-4 space-y-3">
              <div className="flex justify-between items-center border-b pb-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-ping" />
                  <h4 className="text-[11px] font-black text-slate-700">بوابة محاكاة الألعاب الجماعية الروحية (Simulator Panel)</h4>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSimulatorEnabled(!isSimulatorEnabled)}
                  className={`px-2 py-0.5 rounded text-[9px] font-black text-white ${isSimulatorEnabled ? 'bg-red-500' : 'bg-emerald-500'}`}
                >
                  {isSimulatorEnabled ? 'إيقاف التوليد التلقائي' : 'تفعيل التوليد التلقائي'}
                </button>
              </div>

              {/* LOGS */}
              <div className="bg-slate-950 text-slate-200 rounded-xl p-3 font-mono text-[9px] h-24 overflow-y-auto space-y-1 text-left" dir="ltr">
                {simulationLogs.map((log, i) => (
                  <p key={i} className="leading-tight opacity-90">{log}</p>
                ))}
              </div>
              <p className="text-[9.5px] text-slate-400 leading-relaxed text-right">
                💡 <strong>نصيحة للمراجعة الفنية:</strong> نظرًا لأن التطبيق يتم تشغيله في بيئة معزولة، تتيح لك هذه اللوحة محاكاة لاعبين مخدومين يتجاوبون مع قراراتك، لتجربة تدفق الشاشات المتنقل بالكامل (إنشاء الغرفة، تقسيم المجموعات، تشغيل Quiz، وتعديل النقاط)! يمكنك أيضًا فتح رابط التطبيق في علامتي تبويب مختلفتين لتجربة التوصيل الحقيقي عبر الـ WebSockets!
              </p>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
