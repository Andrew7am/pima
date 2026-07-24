import React, { useState } from "react";
import { 
  Gamepad2, Settings, UserCheck, Star, Award, RotateCcw, Zap, Timer, HelpCircle,
  Play, Pause, Users, Plus, Minus, Shuffle, Crown, ShieldAlert, Check, RefreshCw,
  BookOpen, Image, Lock, Gift, Coins, FolderOpen, Paintbrush, Sparkles, Calendar,
  ListOrdered, Link2, Flame, Type
} from "lucide-react";
import { WhoAmIModule } from "./WhoAmIModule";
import { SpeedChallengeModule } from "./SpeedChallengeModule";
import { TimeRushModule } from "./TimeRushModule";
import { GameContentRenderer } from "./GameContentRenderer";
import { GAME_PLUGINS } from "./gamePlugins";
import { motion, AnimatePresence } from "motion/react";

interface GameRoomManagerProps {
  currentGame: string;
  currentQuestionIndex: number;
  currentRoundQuizQuestions: any[];
  role: "host" | "participant";
  currentUser: any;
  room: any;
  hasSubmittedAnswer: boolean;
  selectedOptionIdx: number | null;
  handlePlayerSubmitAnswer: (idx: number) => void;
  speedMultiplier: number;
  timeRushCorrect: number;
  timeRushTotal: number;
  setTimeRushCorrect: React.Dispatch<React.SetStateAction<number>>;
  setTimeRushTotal: React.Dispatch<React.SetStateAction<number>>;
  charadesActor: any;
  charadesItem: any;
  setCharadesItem: React.Dispatch<React.SetStateAction<any>>;
  handleAdjustPoints: (teamId: string, pts: number) => void;
  guessImageRevealed: boolean[];
  setGuessImageRevealed: React.Dispatch<React.SetStateAction<boolean[]>>;
  guessImageGuessValue: string;
  setGuessImageGuessValue: React.Dispatch<React.SetStateAction<string>>;
  guessImageSolved: boolean;
  setGuessImageSolved: React.Dispatch<React.SetStateAction<boolean>>;
  guessImageItem: any;
  setGuessImageItem: React.Dispatch<React.SetStateAction<any>>;
  wheelAngle: number;
  setWheelAngle: React.Dispatch<React.SetStateAction<number>>;
  wheelIsSpinning: boolean;
  setWheelIsSpinning: React.Dispatch<React.SetStateAction<boolean>>;
  wheelResultText: string;
  setWheelResultText: React.Dispatch<React.SetStateAction<string>>;
  escapeLockIdx: number;
  setEscapeLockIdx: React.Dispatch<React.SetStateAction<number>>;
  escapeCodeValue: string;
  setEscapeCodeValue: React.Dispatch<React.SetStateAction<string>>;
  escapeRoomHintShown: boolean;
  setEscapeRoomHintShown: React.Dispatch<React.SetStateAction<boolean>>;
  bombBoxes: any[];
  setBombBoxes: React.Dispatch<React.SetStateAction<any[]>>;
  luckyBoxChoices: {[teamId: string]: number};
  setLuckyBoxChoices: React.Dispatch<React.SetStateAction<{[teamId: string]: number}>>;
  luckyBoxOutcomes: {[teamId: string]: string};
  setLuckyBoxOutcomes: React.Dispatch<React.SetStateAction<{[teamId: string]: string}>>;
  diceValue: number;
  setDiceValue: React.Dispatch<React.SetStateAction<number>>;
  isDiceRolling: boolean;
  setIsDiceRolling: React.Dispatch<React.SetStateAction<boolean>>;
  customQuestionBank: any[];
  setCustomQuestionBank: React.Dispatch<React.SetStateAction<any[]>>;
  qBankForm: any;
  setQBankForm: React.Dispatch<React.SetStateAction<any>>;
  tournamentMatches: any[];
  setTournamentMatches: React.Dispatch<React.SetStateAction<any[]>>;
  drawSecret: string;
  drawPaths: string[];
  setDrawPaths: React.Dispatch<React.SetStateAction<string[]>>;
  randomChallengeText: string;
  setRandomChallengeText: React.Dispatch<React.SetStateAction<string>>;
  dailyEventItem: any;
  showToast: (msg: string) => void;
  sendWSMessage: (msg: any) => void;
}

export const GameRoomManager: React.FC<GameRoomManagerProps> = (props) => {
  const {
    currentGame,
    role,
    room,
    sendWSMessage,
    showToast,
    handleAdjustPoints,
  } = props;

  // Local state for host control center
  const [selectedTeamForPoints, setSelectedTeamForPoints] = useState<string>("");
  const [customPointsInput, setCustomPointsInput] = useState<number>(20);
  const [activeAdminTab, setActiveAdminTab] = useState<"games" | "teams" | "flow">("games");

  // Get active teams list safely
  const teamsList: any[] = room?.teams ? Object.values(room.teams) : [];

  // Predefined modular games with their configs for the quick switcher
  const modularGames = [
    { id: "whoami", label: "👤 مين أنا؟", desc: "تخمين الشخصيات المقدسة بالقرائن" },
    { id: "speed", label: "⚡ تحدي السرعة", desc: "إجابة صحيحة أسرع بنقاط أكثر" },
    { id: "timerush", label: "⏱️ سباق الوقت", desc: "أكبر قدر إجابات بـ 60 ثانية" }
  ];

  // Handler to switch game modules dynamically
  const handleSwitchGameModule = (gameId: string) => {
    if (role !== "host") return;
    const gameLabel = GAME_PLUGINS.find(g => g.id === gameId)?.label || gameId;
    showToast(`🔄 جارٍ الانتقال إلى لعبة: ${gameLabel} مع الاحتفاظ بنقاط اللاعبين!`);
    
    sendWSMessage({
      type: "START_GAME",
      roomCode: room?.code,
      game: gameId
    });
  };

  // Toggle Pause/Resume state
  const handleTogglePause = () => {
    if (role !== "host" || !room) return;
    const nextPauseState = !room.isTimerPaused;
    sendWSMessage({
      type: "PAUSE_GAME",
      roomCode: room.code,
      isPaused: nextPauseState
    });
    showToast(nextPauseState ? "⏸️ تم إيقاف مؤقت اللعبة والعد التنازلي مؤقتاً." : "▶️ تم استئناف مؤقت اللعبة بنجاح!");
  };

  // Stop current game / Return to lobby
  const handleReturnToLobby = () => {
    if (role !== "host" || !room) return;
    sendWSMessage({
      type: "NEXT_GAME",
      roomCode: room.code
    });
    showToast("🚪 تم إنهاء اللعبة الحالية والرجوع إلى لوبي الاستعداد.");
  };

  // End current Round
  const handleEndRound = () => {
    if (role !== "host" || !room) return;
    sendWSMessage({
      type: "END_ROUND",
      roomCode: room.code
    });
    showToast("📊 تم تجميد نقاط هذه الجولة وحفظها في التاريخ بنجاح!");
  };

  // Finish Contest
  const handleFinishContest = () => {
    if (role !== "host" || !room) return;
    sendWSMessage({
      type: "FINISH_CONTEST",
      roomCode: room.code
    });
    showToast("👑 تهانينا! تم إنهاء المسابقة وتتويج الفريق الفائز والـ MVP!");
  };

  // Redistribute Teams randomly & evenly
  const handleShuffleTeams = () => {
    if (role !== "host" || !room) return;
    sendWSMessage({
      type: "DIVIDE_TEAMS",
      roomCode: room.code,
      divisionMethod: "random"
    });
    showToast("🔀 تم إعادة تقسيم وخلط جميع اللاعبين على الفرق بالتساوي!");
  };

  // Quick points adjustment
  const handleQuickPointsAdjustment = (amount: number) => {
    if (role !== "host") return;
    const targetTeamId = selectedTeamForPoints || (teamsList[0]?.id);
    if (!targetTeamId) {
      showToast("⚠️ برجاء إنشاء فرق أو اختيار فريق لتعديل نقاطه أولاً!");
      return;
    }
    const targetTeamName = room?.teams[targetTeamId]?.name || "الفريق";
    handleAdjustPoints(targetTeamId, amount);
    showToast(`${amount > 0 ? "➕ إضافة" : "➖ خصم"} ${Math.abs(amount)} نقطة لـ ${targetTeamName} بنجاح.`);
  };

  return (
    <div className="space-y-4">
      {/* 1. SPECTACULAR MATERIAL HOST ADMINISTRATIVE CONTROL CENTER */}
      {role === "host" && (
        <div id="host-advanced-control-panel" className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 p-4 sm:p-5 rounded-3xl border border-slate-700/60 shadow-xl text-right overflow-hidden relative">
          {/* Subtle decorative background light */}
          <div className="absolute top-0 left-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
          
          {/* Panel Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4 border-b border-slate-700/50 pb-3 relative z-10">
            <div>
              <span className="text-[10px] bg-amber-500/20 text-amber-400 font-extrabold px-3 py-1 rounded-full flex items-center gap-1 w-fit mb-1.5">
                <Crown className="w-3.5 h-3.5" />
                صلاحيات الخادم المنظم (Host Console)
              </span>
              <h3 className="text-xs sm:text-sm font-black text-white flex items-center gap-1.5">
                <Settings className="w-4 h-4 text-amber-500 animate-spin-slow" />
                لوحة التحكم المتقدمة للألعاب والفرق 🕹️
              </h3>
            </div>
            <span className="text-[9px] text-slate-400">
              كود الغرفة الحالي: <strong className="text-amber-400 font-mono text-[11px] bg-white/5 px-2 py-0.5 rounded-md">{room?.code}</strong>
            </span>
          </div>

          {/* Tab Selection buttons (Material Design spec) */}
          <div className="grid grid-cols-3 bg-white/5 p-1 rounded-xl gap-1 mb-4">
            <button
              onClick={() => setActiveAdminTab("games")}
              className={`py-1.5 rounded-lg text-[10px] sm:text-xs font-black transition-all cursor-pointer ${
                activeAdminTab === "games" 
                  ? "bg-amber-500 text-slate-950 font-black shadow-sm" 
                  : "text-slate-400 hover:text-white"
              }`}
            >
              🎮 اختيار الألعاب ({GAME_PLUGINS.length})
            </button>
            <button
              onClick={() => setActiveAdminTab("teams")}
              className={`py-1.5 rounded-lg text-[10px] sm:text-xs font-black transition-all cursor-pointer ${
                activeAdminTab === "teams" 
                  ? "bg-amber-500 text-slate-950 font-black shadow-sm" 
                  : "text-slate-400 hover:text-white"
              }`}
            >
              👥 النقاط والفرق
            </button>
            <button
              onClick={() => setActiveAdminTab("flow")}
              className={`py-1.5 rounded-lg text-[10px] sm:text-xs font-black transition-all cursor-pointer ${
                activeAdminTab === "flow" 
                  ? "bg-amber-500 text-slate-950 font-black shadow-sm" 
                  : "text-slate-400 hover:text-white"
              }`}
            >
              ⚡ التحكم بمسار الجولة
            </button>
          </div>

          {/* Tab contents with animation wrapper */}
          <div className="relative z-10">
            <AnimatePresence mode="wait">
              {/* TAB 1: ALL 17 GAMES SELECTOR */}
              {activeAdminTab === "games" && (
                <motion.div
                  key="tab-games"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-3"
                >
                  <div className="flex justify-between items-center px-1">
                    <span className="text-[10px] font-bold text-slate-400">
                      انقر على أي لعبة لبدء نشاطها فوراً وتحديث شاشات اللاعبين:
                    </span>
                    {currentGame && (
                      <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                        اللعبة النشطة حالياً: {GAME_PLUGINS.find(g => g.id === currentGame)?.label || currentGame}
                      </span>
                    )}
                  </div>

                  {/* Horizontal Scroll or Compact Grid for 17 games */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 max-h-[190px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-700">
                    {GAME_PLUGINS.map((game) => {
                      const isActive = currentGame === game.id;
                      
                      // Map each game to its beautiful distinctive Lucide icon
                      const getLucideIcon = (gameId: string) => {
                        switch (gameId) {
                          case 'trivia': return <BookOpen className="w-4.5 h-4.5" />;
                          case 'whoami': return <HelpCircle className="w-4.5 h-4.5" />;
                          case 'charades': return <Users className="w-4.5 h-4.5" />;
                          case 'guessimage': return <Image className="w-4.5 h-4.5" />;
                          case 'speed': return <Zap className="w-4.5 h-4.5" />;
                          case 'wheel': return <RotateCcw className="w-4.5 h-4.5" />;
                          case 'escaperoom': return <Lock className="w-4.5 h-4.5" />;
                          case 'bomb': return <ShieldAlert className="w-4.5 h-4.5" />;
                          case 'luckybox': return <Gift className="w-4.5 h-4.5" />;
                          case 'auction': return <Coins className="w-4.5 h-4.5" />;
                          case 'timerush': return <Timer className="w-4.5 h-4.5" />;
                          case 'dice': return <Gamepad2 className="w-4.5 h-4.5" />;
                          case 'qbank': return <FolderOpen className="w-4.5 h-4.5" />;
                          case 'tournament': return <Crown className="w-4.5 h-4.5" />;
                          case 'drawguess': return <Paintbrush className="w-4.5 h-4.5" />;
                          case 'randomchallenge': return <Sparkles className="w-4.5 h-4.5" />;
                          case 'dailyevent': return <Calendar className="w-4.5 h-4.5" />;
                          case 'timeline': return <ListOrdered className="w-4.5 h-4.5" />;
                          case 'versematch': return <Link2 className="w-4.5 h-4.5" />;
                          case 'sacraments': return <Flame className="w-4.5 h-4.5" />;
                          case 'typeverse': return <Type className="w-4.5 h-4.5" />;
                          default: return <Gamepad2 className="w-4.5 h-4.5" />;
                        }
                      };

                      return (
                        <button
                          key={game.id}
                          onClick={() => handleSwitchGameModule(game.id)}
                          className={`p-2.5 rounded-xl border text-right transition-all flex flex-col justify-between h-[65px] group cursor-pointer ${
                            isActive
                              ? "bg-gradient-to-tr from-amber-500 to-amber-400 border-amber-600 text-slate-950 font-black shadow-md scale-[1.01]"
                              : "bg-slate-800/60 hover:bg-slate-700/50 border-slate-700/50 text-slate-300 hover:text-white"
                          }`}
                        >
                          <div className="flex justify-between items-center w-full">
                            <span className={isActive ? "text-slate-950" : "text-amber-500 group-hover:text-amber-400"}>
                              {getLucideIcon(game.id)}
                            </span>
                            {isActive && <Check className="w-3.5 h-3.5 text-slate-950 font-extrabold" />}
                          </div>
                          <div className="w-full">
                            <span className="text-[9.5px] font-black line-clamp-1 group-hover:text-amber-400 group-hover:transition-colors group-active:scale-95">
                              {game.label.split(" (")[0]}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* TAB 2: POINTS AND TEAM RESPLIT */}
              {activeAdminTab === "teams" && (
                <motion.div
                  key="tab-teams"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-4"
                >
                  {/* Re-shuffle teams module */}
                  <div className="bg-white/5 border border-slate-700/40 p-3 rounded-2xl flex flex-col justify-between">
                    <div>
                      <h4 className="text-[11px] font-black text-amber-400 flex items-center gap-1 mb-1">
                        <Users className="w-3.5 h-3.5" />
                        إعادة توزيع المجموعات والفرق
                      </h4>
                      <p className="text-[9.5px] text-slate-400 leading-relaxed">
                        قم بإعادة خلط جميع اللاعبين المسجلين في الغرفة وتقسيمهم عشوائياً بالتساوي إلى {room?.teamCount || 2} مجموعات تنافسية.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleShuffleTeams}
                      className="mt-3 py-2 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Shuffle className="w-4 h-4" />
                      <span>تقسيم اللاعبين عشوائياً بالتساوي</span>
                    </button>
                  </div>

                  {/* Points adjuster module */}
                  <div className="bg-white/5 border border-slate-700/40 p-3 rounded-2xl space-y-2.5">
                    <h4 className="text-[11px] font-black text-amber-400 flex items-center gap-1">
                      <Award className="w-3.5 h-3.5" />
                      تعديل وإضافة النقاط اليدوية للفرق
                    </h4>

                    {/* Team Selector */}
                    <div className="flex gap-2">
                      <select
                        value={selectedTeamForPoints}
                        onChange={(e) => setSelectedTeamForPoints(e.target.value)}
                        className="bg-slate-800 text-slate-200 border border-slate-700 rounded-lg p-1.5 text-xs font-bold w-full focus:outline-none focus:border-amber-500"
                      >
                        <option value="">-- اختر فريقاً للتعديل --</option>
                        {teamsList.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} (الحالي: {t.score}ن)
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Quick increment buttons */}
                    <div className="space-y-1.5">
                      <span className="text-[8.5px] text-slate-400 block">إضافة سريعة للرصيد:</span>
                      <div className="grid grid-cols-3 gap-1">
                        <button
                          onClick={() => handleQuickPointsAdjustment(10)}
                          className="py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold rounded-lg cursor-pointer"
                        >
                          +10 نقاط
                        </button>
                        <button
                          onClick={() => handleQuickPointsAdjustment(25)}
                          className="py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold rounded-lg cursor-pointer"
                        >
                          +25 نقطة
                        </button>
                        <button
                          onClick={() => handleQuickPointsAdjustment(50)}
                          className="py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold rounded-lg cursor-pointer"
                        >
                          +50 نقطة
                        </button>
                      </div>
                    </div>

                    {/* Quick decrement buttons */}
                    <div className="space-y-1.5">
                      <span className="text-[8.5px] text-slate-400 block">خصم من الرصيد (عقوبة):</span>
                      <div className="grid grid-cols-3 gap-1">
                        <button
                          onClick={() => handleQuickPointsAdjustment(-10)}
                          className="py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-bold rounded-lg cursor-pointer"
                        >
                          -10 نقاط
                        </button>
                        <button
                          onClick={() => handleQuickPointsAdjustment(-25)}
                          className="py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-bold rounded-lg cursor-pointer"
                        >
                          -25 نقطة
                        </button>
                        <button
                          onClick={() => handleQuickPointsAdjustment(-50)}
                          className="py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-bold rounded-lg cursor-pointer"
                        >
                          -50 نقطة
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* TAB 3: ROUND FLOW AND TIMER CONTROLLERS */}
              {activeAdminTab === "flow" && (
                <motion.div
                  key="tab-flow"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-3"
                >
                  <span className="text-[10px] font-bold text-slate-400 block">
                    التحكم في مؤقت الأسئلة وحالة الغرفة الحالية لجميع المتسابقين:
                  </span>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {/* Pause/Resume Game Toggle Button */}
                    <button
                      type="button"
                      onClick={handleTogglePause}
                      className={`p-3 rounded-2xl border text-right flex items-center justify-between transition-all cursor-pointer ${
                        room?.isTimerPaused
                          ? "bg-emerald-500 hover:bg-emerald-400 border-emerald-600 text-slate-950 font-black"
                          : "bg-amber-500 hover:bg-amber-400 border-amber-600 text-slate-950 font-black"
                      }`}
                    >
                      <div>
                        <h5 className="text-[11px] font-black">
                          {room?.isTimerPaused ? "استئناف مؤقت السؤال" : "إيقاف مؤقت مؤقت"}
                        </h5>
                        <p className="text-[8.5px] opacity-75">
                          {room?.isTimerPaused ? "تفعيل الحركة والوقت" : "تجميد العد التنازلي"}
                        </p>
                      </div>
                      {room?.isTimerPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
                    </button>

                    {/* Freeze and End Round Button */}
                    <button
                      type="button"
                      onClick={handleEndRound}
                      className="p-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-2xl text-right text-slate-200 hover:text-white flex items-center justify-between transition-all cursor-pointer"
                    >
                      <div>
                        <h5 className="text-[11px] font-black">تجميد وحفظ الجولة</h5>
                        <p className="text-[8.5px] text-slate-400">حفظ النقاط وتجميد الألعاب</p>
                      </div>
                      <Timer className="w-5 h-5 text-amber-500" />
                    </button>

                    {/* Reset to Lobby (Next Game) */}
                    <button
                      type="button"
                      onClick={handleReturnToLobby}
                      className="p-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-2xl text-right text-slate-200 hover:text-white flex items-center justify-between transition-all cursor-pointer"
                    >
                      <div>
                        <h5 className="text-[11px] font-black">الرجوع للوبي الاستعداد</h5>
                        <p className="text-[8.5px] text-slate-400">إنهاء اللعبة وتجهيز نشاط جديد</p>
                      </div>
                      <RotateCcw className="w-5 h-5 text-blue-400" />
                    </button>

                    {/* Finish Contest & Announce MVP */}
                    <button
                      type="button"
                      onClick={handleFinishContest}
                      className="p-3 bg-gradient-to-l from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 border border-amber-500 rounded-2xl text-right text-white flex items-center justify-between transition-all shadow-md cursor-pointer"
                    >
                      <div>
                        <h5 className="text-[11px] font-black">تتويج الأبطال والـ MVP</h5>
                        <p className="text-[8.5px] text-amber-100">إعلان الفائزين وإنهاء المسابقة</p>
                      </div>
                      <Crown className="w-5 h-5 text-amber-200 animate-pulse" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* 2. PARTICIPANT GAME TRANSITION NOTIFICATION */}
      {role === "participant" && ["whoami", "speed", "timerush"].includes(currentGame) && (
        <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-[10px] text-slate-500 text-center font-bold">
          🎮 ينظم الخادم هذه المسابقة حاليًا. سيتم تحديث شاشتك بمجرد كشف قرائن أو إجابات جديدة!
        </div>
      )}

      {/* 3. DYNAMICALLY RENDER THE REQUESTED MODULAR GAME */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 shadow-xs">
        {currentGame === "whoami" ? (
          <WhoAmIModule
            role={props.role}
            room={props.room}
            currentQuestionIndex={props.currentQuestionIndex}
            currentRoundQuizQuestions={props.currentRoundQuizQuestions}
            hasSubmittedAnswer={props.hasSubmittedAnswer}
            selectedOptionIdx={props.selectedOptionIdx}
            handlePlayerSubmitAnswer={props.handlePlayerSubmitAnswer}
            handleAdjustPoints={props.handleAdjustPoints}
            sendWSMessage={props.sendWSMessage}
            showToast={props.showToast}
            currentUser={props.currentUser}
          />
        ) : currentGame === "speed" ? (
          <SpeedChallengeModule
            role={props.role}
            room={props.room}
            currentQuestionIndex={props.currentQuestionIndex}
            currentRoundQuizQuestions={props.currentRoundQuizQuestions}
            hasSubmittedAnswer={props.hasSubmittedAnswer}
            selectedOptionIdx={props.selectedOptionIdx}
            handlePlayerSubmitAnswer={props.handlePlayerSubmitAnswer}
            handleAdjustPoints={props.handleAdjustPoints}
            speedMultiplier={props.speedMultiplier}
            showToast={props.showToast}
            currentUser={props.currentUser}
          />
        ) : currentGame === "timerush" ? (
          <TimeRushModule
            role={props.role}
            room={props.room}
            currentQuestionIndex={props.currentQuestionIndex}
            currentRoundQuizQuestions={props.currentRoundQuizQuestions}
            handlePlayerSubmitAnswer={props.handlePlayerSubmitAnswer}
            handleAdjustPoints={props.handleAdjustPoints}
            timeRushCorrect={props.timeRushCorrect}
            timeRushTotal={props.timeRushTotal}
            setTimeRushCorrect={props.setTimeRushCorrect}
            setTimeRushTotal={props.setTimeRushTotal}
            showToast={props.showToast}
            currentUser={props.currentUser}
            sendWSMessage={props.sendWSMessage}
          />
        ) : (
          /* Fallback component rendering for the other remaining 14 games */
          <GameContentRenderer {...props} />
        )}
      </div>
    </div>
  );
};

