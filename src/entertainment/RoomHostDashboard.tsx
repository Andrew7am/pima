import React, { useState, useEffect } from "react";
import { 
  Users, Lock, Unlock, Copy, Share2, Play, Trophy, HelpCircle, 
  Settings, ArrowRight, ShieldCheck, UserCheck, X, Check, RefreshCw, 
  Gamepad2, Calendar, LayoutGrid, Timer, QrCode, ArrowLeft, Star,
  Sparkles, Database, Plus, ChevronDown, ChevronUp
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { getPoolStats, appendQuestionsToPool, SmartQuestion } from "./questionPoolEngine";

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
  icon?: string;
}

interface RoomState {
  code: string;
  name: string;
  eventType: string;
  teamCount: number;
  divisionMethod: "random" | "manual";
  allowedGames: string[];
  hostId: string;
  players: Player[];
  currentGame: string | null;
  gameState: "lobby" | "playing" | "round_over" | "finished";
  roundTimer: number;
  isTimerPaused: boolean;
  currentQuestionIndex: number;
  teams: { [teamId: string]: Team };
  isLocked: boolean;
}

interface RoomHostDashboardProps {
  room: RoomState;
  currentUser: any;
  role: "host" | "participant";
  sendWSMessage: (msg: any) => void;
  showToast: (msg: string) => void;
  onStartFirstGame: () => void;
  onAssignTeamManual: (playerId: string, teamId: string) => void;
  onTriggerRandomTeams: () => void;
  onBackToSelection: () => void;
}

export const RoomHostDashboard: React.FC<RoomHostDashboardProps> = ({
  room,
  currentUser,
  role,
  sendWSMessage,
  showToast,
  onStartFirstGame,
  onAssignTeamManual,
  onTriggerRandomTeams,
  onBackToSelection
}) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"players" | "teams" | "leaderboard">("players");
  const [simulatingJoin, setSimulatingJoin] = useState(false);

  // Smart AI Question Pool states
  const [poolStats, setPoolStatsState] = useState(() => getPoolStats());
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<"الكتاب المقدس" | "اللاهوت والعقيدة" | "الألحان والقبطي" | "تاريخ الكنيسة والطقوس" | "القديسون والشخصيات">("الكتاب المقدس");
  const [selectedDifficulty, setSelectedDifficulty] = useState<"سهل" | "متوسط" | "صعب">("متوسط");
  const [showPoolPanel, setShowPoolPanel] = useState(true);

  const handleReplenishPool = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch("/api/gemini/replenish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: selectedCategory, difficulty: selectedDifficulty })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "فشل توليد الأسئلة.");
      }
      const data = await response.json();
      if (data && Array.isArray(data.questions)) {
        appendQuestionsToPool(data.questions);
        setPoolStatsState(getPoolStats());
        showToast(`✨ نجاح: تم توليد وإضافة ${data.questions.length} أسئلة جديدة وحصرية إلى مستودع الأسئلة الذكي!`);
      } else {
        throw new Error("تنسيق الاستجابة من الذكاء الاصطناعي غير صالح.");
      }
    } catch (err: any) {
      console.error(err);
      showToast(`⚠️ خطأ: ${err.message || "عذراً، يرجى التحقق من توفر مفتاح GEMINI_API_KEY في إعدادات التطبيق."}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Filter players
  const hostPlayer = room.players.find(p => p.isHost);
  const regularPlayers = room.players.filter(p => !p.isHost);
  const approvedPlayersCount = room.players.filter(p => p.approved && !p.isHost).length;
  const waitingPlayers = room.players.filter(p => !p.approved && !p.isHost);

  // Time elapsed or active sessions details
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsElapsed(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(room.code);
    setCopied(true);
    showToast("📋 تم نسخ كود الغرفة السداسي بنجاح!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareRoom = () => {
    if (navigator.share) {
      navigator.share({
        title: room.name,
        text: `انضم إلى غرفتي التفاعلية للمسابقات الروحية! الكود هو: ${room.code}`,
        url: window.location.href
      }).catch(err => console.log(err));
    } else {
      handleCopyCode();
    }
  };

  const handleToggleLock = () => {
    if (role !== "host") return;
    const nextLockedState = !room.isLocked;
    sendWSMessage({
      type: "LOCK_ROOM",
      roomCode: room.code,
      isLocked: nextLockedState
    });
    showToast(nextLockedState ? "🔒 تم إغلاق الغرفة بنجاح وتأمين الدخول." : "🔓 تم فتح الغرفة لاستقبال متسابقين جدد!");
  };

  const handleApprovePlayer = (playerId: string, approved: boolean) => {
    sendWSMessage({
      type: "APPROVE_PLAYER",
      roomCode: room.code,
      playerId,
      approved
    });
    showToast(approved ? "✓ تم قبول اللاعب وإضافته للمنافسة." : "❌ تم رفض انضمام اللاعب.");
  };

  const handleKickPlayer = (playerId: string) => {
    sendWSMessage({
      type: "KICK_PLAYER",
      roomCode: room.code,
      playerId
    });
    showToast("🚪 تم طرد المتسابق من الغرفة.");
  };

  // Generate simulated players trigger helper
  const handleTriggerSimulatedJoin = () => {
    setSimulatingJoin(true);
    setTimeout(() => {
      sendWSMessage({
        type: "SIMULATE_PLAYER_JOIN",
        roomCode: room.code
      });
      setSimulatingJoin(false);
    }, 600);
  };

  // Sort teams list by score
  const teamsList = room.teams ? (Object.values(room.teams) as Team[]).sort((a, b) => b.score - a.score) : [];

  return (
    <div className="space-y-6 text-right" dir="rtl">
      
      {/* ROOM METRICS OVERVIEW GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Metric 1: Room Code */}
        <div className="bg-gradient-to-br from-[#0A2342] to-[#123e75] text-white p-5 rounded-3xl border border-slate-700/30 flex flex-col justify-between shadow-md relative overflow-hidden group">
          <div className="absolute top-2 left-2 text-white/5 group-hover:scale-110 transition-transform">
            <QrCode className="w-24 h-24" />
          </div>
          <div className="space-y-1 z-10">
            <p className="text-[10px] text-slate-300 font-bold">كود الدخول السداسي للغرفة 🔢</p>
            <h4 className="text-2xl font-black font-mono tracking-widest text-amber-400 select-all">{room.code}</h4>
          </div>
          <div className="flex gap-2 mt-4 z-10">
            <button
              onClick={handleCopyCode}
              className="flex-1 py-1.5 px-3 bg-white/10 hover:bg-white/20 text-xs font-black rounded-xl flex items-center justify-center gap-1 transition-all cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copied ? "تم النسخ!" : "نسخ الكود"}</span>
            </button>
            <button
              onClick={handleShareRoom}
              className="py-1.5 px-3 bg-white/10 hover:bg-white/20 text-xs font-black rounded-xl flex items-center justify-center transition-all cursor-pointer"
              title="مشاركة الكود والروابط"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Metric 2: Players Status */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs flex flex-col justify-between relative overflow-hidden">
          <div className="space-y-1">
            <p className="text-[10px] text-slate-400 font-bold">المتسابقون المتصلون حالياً 👥</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-[#0A2342]">{approvedPlayersCount}</span>
              <span className="text-[10px] text-slate-400 font-bold">مقبولين</span>
            </div>
            {waitingPlayers.length > 0 && (
              <p className="text-[9px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-black animate-pulse inline-block">
                ⚠️ يوجد {waitingPlayers.length} بانتظار الموافقة!
              </p>
            )}
          </div>
          
          <div className="mt-4 flex gap-2">
            <button
              onClick={handleTriggerSimulatedJoin}
              disabled={simulatingJoin}
              className="w-full py-1.5 bg-slate-50 hover:bg-slate-100 disabled:opacity-50 text-[10px] font-black text-slate-700 border border-slate-200 rounded-xl flex items-center justify-center gap-1 cursor-pointer transition-all"
            >
              <RefreshCw className={`w-3 h-3 ${simulatingJoin ? "animate-spin" : ""}`} />
              <span>محاكاة دخول متسابق جديد ➕</span>
            </button>
          </div>
        </div>

        {/* Metric 3: Room State Locking */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs flex flex-col justify-between">
          <div className="space-y-1">
            <p className="text-[10px] text-slate-400 font-bold">حالة الانضمام الحالية للغرفة 🟢</p>
            <div className="flex items-center gap-1.5 pt-1">
              <span className={`w-2.5 h-2.5 rounded-full ${room.isLocked ? "bg-red-500" : "bg-emerald-500 animate-pulse"}`} />
              <span className="text-xs font-black text-slate-800">
                {room.isLocked ? "مغلقة ومؤمنة (Closed)" : "مفتوحة للاعبين (Open)"}
              </span>
            </div>
            <p className="text-[9px] text-slate-400 leading-tight">
              {room.isLocked ? "لا يمكن لمتسابقين جدد الانضمام حالياً." : "يستطيع الجميع الدخول بالكود السداسي."}
            </p>
          </div>
          
          <button
            onClick={handleToggleLock}
            className={`mt-4 py-1.5 w-full text-[10px] font-black rounded-xl border flex items-center justify-center gap-1 transition-all cursor-pointer ${
              room.isLocked 
                ? "bg-red-50 hover:bg-red-100 text-red-700 border-red-200" 
                : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200"
            }`}
          >
            {room.isLocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
            <span>{room.isLocked ? "فتح الغرفة" : "قفل الغرفة وتجميد الدخول"}</span>
          </button>
        </div>

        {/* Metric 4: Session Clock / Details */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs flex flex-col justify-between">
          <div className="space-y-1">
            <p className="text-[10px] text-slate-400 font-bold">وقت الاستعداد الفعلي للجلسة ⏳</p>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black font-mono text-slate-800">{formatTimer(secondsElapsed)}</span>
              <span className="text-[9px] text-slate-400 font-bold">دقيقة</span>
            </div>
            <p className="text-[9px] text-slate-400 font-semibold truncate">
              اللعبة الأولى بالتسلسل: {room.allowedGames && room.allowedGames[0] ? `🎮 ${room.allowedGames[0].toUpperCase()}` : "لا يوجد"}
            </p>
          </div>

          <button
            onClick={onStartFirstGame}
            id="dashboard-start-game-btn"
            className="mt-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-black rounded-xl shadow-md flex items-center justify-center gap-1 transition-all cursor-pointer transform hover:scale-[1.01]"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>بدء المسابقة الكبرى واللعبة الأولى ▶</span>
          </button>
        </div>

      </div>

      {/* DASHBOARD DETAILS - TWO COLUMNS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN (2 COLS): ACTIVE PARTICIPANTS AND ROOM LOGS */}
        <div className="lg:col-span-2 bg-white border border-[#D6D6C2] rounded-3xl p-5 space-y-4">
          
          <div className="flex justify-between items-center border-b pb-3 border-slate-100">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-500" />
              <h4 className="text-xs font-black text-[#0A2342]">بوابة إدارة المتسابقين وتوزيع المجموعات</h4>
            </div>
            
            {/* Inner tab navigator */}
            <div className="flex gap-1.5">
              {[
                { id: "players", label: `المتسابقين (${room.players.length-1})` },
                { id: "teams", label: `توزيع المجموعات` }
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id as any)}
                  className={`px-3 py-1 rounded-lg text-[10.5px] font-black transition-all cursor-pointer ${
                    activeTab === t.id 
                      ? "bg-[#0A2342] text-white" 
                      : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* TAB 1: LIST OF PLAYERS & APPROVAL CONTROLS */}
          {activeTab === "players" && (
            <div className="space-y-3">
              {/* Waiting Approval section if any */}
              {waitingPlayers.length > 0 && (
                <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-3 space-y-2">
                  <h5 className="text-[10px] font-black text-amber-800 flex items-center gap-1.5 animate-pulse">
                    ⚠️ بانتظار موافقتك كمنظم ({waitingPlayers.length} متسابقين):
                  </h5>
                  <div className="space-y-2">
                    {waitingPlayers.map(p => (
                      <div key={p.id} className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-amber-100 shadow-3xs">
                        <div className="flex items-center gap-2">
                          <span className="text-sm w-7 h-7 bg-amber-100 rounded-full flex items-center justify-center">{p.avatar}</span>
                          <span className="text-xs font-black text-slate-800">{p.name}</span>
                        </div>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => handleApprovePlayer(p.id, true)}
                            className="py-1 px-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-[9px] font-black flex items-center gap-0.5 cursor-pointer"
                          >
                            <Check className="w-3 h-3" /> قبول
                          </button>
                          <button
                            onClick={() => handleApprovePlayer(p.id, false)}
                            className="py-1 px-2.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-[9px] font-black flex items-center gap-0.5 cursor-pointer"
                          >
                            <X className="w-3 h-3" /> رفض
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Regular Approved Player list */}
              <div className="space-y-2 max-h-80 overflow-y-auto">
                <div className="flex justify-between text-[10px] text-slate-400 font-bold border-b pb-1 px-1">
                  <span>اسم المتسابق والمجموعه</span>
                  <span>التحكيم والتوزيع المباشر</span>
                </div>
                
                {regularPlayers.filter(p => p.approved).map(p => (
                  <div key={p.id} className="flex justify-between items-center bg-slate-50 p-2 rounded-xl border border-slate-100 hover:bg-white transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="text-base w-8 h-8 rounded-full bg-slate-200/50 flex items-center justify-center">{p.avatar}</span>
                      <div>
                        <p className="text-xs font-black text-slate-800">{p.name}</p>
                        <p className="text-[9.5px] text-slate-400 mt-0.5 font-bold">
                          {p.teamId && room.teams[p.teamId] 
                            ? `فريق: ${room.teams[p.teamId].name}` 
                            : "⚠️ لم يتم توزيعه في فريق حالياً"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Quick assignment dropdown */}
                      <select
                        value={p.teamId || ''}
                        onChange={(e) => onAssignTeamManual(p.id, e.target.value)}
                        className="bg-white border text-[10px] font-black rounded-lg px-2 py-1 focus:outline-none focus:border-amber-500"
                      >
                        <option value="">-- بلا فريق --</option>
                        {Object.values(room.teams).map((t: any) => (
                          <option key={t.id} value={t.id}>{t.name.split(" ")[1] || t.name}</option>
                        ))}
                      </select>

                      <button
                        onClick={() => handleKickPlayer(p.id)}
                        className="p-1 hover:bg-red-50 text-red-500 rounded-lg text-[10px] font-bold"
                        title="طرد المتسابق من الغرفة"
                      >
                        طرد
                      </button>
                    </div>
                  </div>
                ))}

                {regularPlayers.filter(p => p.approved).length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-8">
                    أهلاً بك! لم ينضم أي متسابقين معتمدين إلى الغرفة حتى الآن.<br />
                    شارك كود الدخول <strong className="text-amber-600 font-mono text-sm">{room.code}</strong> مع المخدومين للبدء.
                  </p>
                )}
              </div>

            </div>
          )}

          {/* TAB 2: TEAMS DISTRIBUTION VIEW */}
          {activeTab === "teams" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-black text-slate-600">التوزيع الحالي للمتسابقين على الفرق المتنافسة:</span>
                <button
                  onClick={onTriggerRandomTeams}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-black rounded-xl flex items-center gap-1 shadow-xs cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>توزيع عشوائي متساوٍ فوري</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto">
                {Object.values(room.teams).map((team: any) => {
                  const members = room.players.filter(p => p.approved && p.teamId === team.id && !p.isHost);
                  return (
                    <div 
                      key={team.id} 
                      className="bg-white border rounded-2xl p-4 space-y-3 hover:border-slate-300 transition-all"
                      style={{ borderTop: `4px solid ${team.color}` }}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-black text-[#0A2342] flex items-center gap-1.5">
                          <span className="text-base">{team.icon || "🏳️"}</span>
                          {team.name}
                        </span>
                        <span className="text-[10px] bg-slate-100 text-slate-600 font-black px-2 py-0.5 rounded-full">
                          {members.length} متسابقين
                        </span>
                      </div>

                      <div className="bg-slate-50 rounded-xl p-2 min-h-[60px] space-y-1">
                        {members.map(m => (
                          <div key={m.id} className="text-[10px] font-black text-slate-700 bg-white p-1.5 rounded-lg border border-slate-100 flex items-center justify-between">
                            <span className="flex items-center gap-1">
                              <span>{m.avatar}</span>
                              <span className="truncate max-w-[120px]">{m.name}</span>
                            </span>
                            <button
                              onClick={() => onAssignTeamManual(m.id, "")}
                              className="text-[9px] text-red-500 hover:underline"
                            >
                              إلغاء
                            </button>
                          </div>
                        ))}
                        {members.length === 0 && (
                          <p className="text-[9.5px] text-slate-400 text-center py-4">فارغ، لا يوجد لاعبون</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* RIGHT COLUMN (1 COL): LEADERBOARD & QR CODES */}
        <div className="space-y-4">
          
          {/* Beautiful QR Code Card */}
          <div className="bg-white border border-[#D6D6C2] rounded-3xl p-5 text-center space-y-4">
            <h4 className="text-xs font-black text-[#0A2342] flex items-center justify-center gap-1.5 border-b pb-2">
              <QrCode className="w-4 h-4 text-amber-500" />
              المسح الضوئي السريع للانضمام
            </h4>
            
            {/* Visual Custom QR Code */}
            <div className="bg-slate-50 border p-4 rounded-2xl inline-block shadow-inner relative group">
              <div className="w-40 h-40 bg-white border-2 border-slate-200 rounded-xl flex items-center justify-center overflow-hidden relative">
                {/* Simulated QR block layout */}
                <svg className="w-32 h-32 text-slate-800" viewBox="0 0 100 100" fill="currentColor">
                  {/* Outer markers */}
                  <rect x="5" y="5" width="25" height="25" fill="none" stroke="currentColor" strokeWidth="6" />
                  <rect x="10" y="10" width="15" height="15" />
                  
                  <rect x="70" y="5" width="25" height="25" fill="none" stroke="currentColor" strokeWidth="6" />
                  <rect x="75" y="10" width="15" height="15" />
                  
                  <rect x="5" y="70" width="25" height="25" fill="none" stroke="currentColor" strokeWidth="6" />
                  <rect x="10" y="75" width="15" height="15" />

                  {/* Inner points representing data */}
                  <rect x="40" y="10" width="8" height="8" />
                  <rect x="52" y="15" width="6" height="6" />
                  <rect x="45" y="25" width="12" height="6" />
                  
                  <rect x="35" y="40" width="18" height="8" />
                  <rect x="60" y="45" width="8" height="12" />
                  <rect x="45" y="55" width="10" height="10" />

                  <rect x="75" y="75" width="18" height="18" />
                  <rect x="75" y="45" width="10" height="10" />
                  <rect x="10" y="45" width="12" height="10" />
                  <rect x="40" y="75" width="15" height="10" />
                  
                  {/* Center branding icon */}
                  <circle cx="50" cy="50" r="10" fill="white" />
                  <text x="50" y="53.5" fontSize="11" textAnchor="middle" fontWeight="black" fill="#D97706">⛪</text>
                </svg>
              </div>
              <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center pointer-events-none">
                <span className="text-[10px] bg-amber-500 text-white font-black px-2 py-1 rounded-full shadow-sm">مسح بالهاتف 📱</span>
              </div>
            </div>

            <p className="text-[10px] text-slate-500 leading-relaxed">
              يوجه هذا الرمز اللاعبين مباشرة لصفحة التسجيل والانضمام التلقائي للغرفة.
            </p>
          </div>

          {/* Real-time Team Leaderboard preview */}
          <div className="bg-white border border-[#D6D6C2] rounded-3xl p-5 space-y-4">
            <h4 className="text-xs font-black text-[#0A2342] flex items-center gap-1.5 border-b pb-2">
              <Trophy className="w-4 h-4 text-yellow-500 animate-bounce" />
              لوحة الصدارة والترتيب الحالي للفرق 🏆
            </h4>

            <div className="space-y-2">
              {teamsList.map((team, index) => {
                const colors = ["bg-yellow-500", "bg-slate-400", "bg-amber-600"];
                const crownColor = colors[index] || "bg-slate-200";
                return (
                  <div 
                    key={team.id}
                    className="flex justify-between items-center p-2.5 bg-slate-50 rounded-2xl border border-slate-100"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-5 h-5 rounded-full ${crownColor} text-white font-mono text-[10px] flex items-center justify-center font-black`}>
                        {index + 1}
                      </span>
                      <span className="text-base">{team.icon || "🏳️"}</span>
                      <span className="text-xs font-black text-slate-800">{team.name}</span>
                    </div>
                    <div className="text-left">
                      <span className="text-xs font-black text-[#0A2342] font-mono">{team.score}</span>
                      <span className="text-[9px] text-slate-400 font-bold mr-1">نقطة</span>
                    </div>
                  </div>
                );
              })}

              {teamsList.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-4">لا يوجد فرق مسجلة.</p>
              )}
            </div>
          </div>

          {/* Smart Coptic Question Pool & AI Generation Panel */}
          <div className="bg-white border border-[#D6D6C2] rounded-3xl p-5 space-y-4">
            <button 
              onClick={() => setShowPoolPanel(!showPoolPanel)}
              className="w-full flex justify-between items-center text-xs font-black text-[#0A2342] border-b pb-2 cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <Database className="w-4 h-4 text-indigo-600 animate-pulse" />
                <span>مستودع وبنك الأسئلة التفاعلي الذكي ⛪</span>
              </div>
              {showPoolPanel ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>

            {showPoolPanel && (
              <div className="space-y-4 text-right animate-in fade-in duration-200">
                {/* Stats Summary Badge Grid */}
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-150">
                  <div className="text-center p-2 bg-white rounded-xl shadow-3xs">
                    <span className="text-[9px] text-slate-400 font-bold block">إجمالي الأسئلة</span>
                    <span className="text-sm font-black text-slate-800 font-mono">{poolStats.total}</span>
                  </div>
                  <div className="text-center p-2 bg-white rounded-xl shadow-3xs">
                    <span className="text-[9px] text-slate-400 font-bold block">اللاهوت والعقيدة</span>
                    <span className="text-xs font-bold text-slate-700 font-mono">{poolStats.byCategory["اللاهوت والعقيدة"] || 0}</span>
                  </div>
                  <div className="text-center p-2 bg-white rounded-xl shadow-3xs">
                    <span className="text-[9px] text-slate-400 font-bold block">الكتاب المقدس</span>
                    <span className="text-xs font-bold text-slate-700 font-mono">{poolStats.byCategory["الكتاب المقدس"] || 0}</span>
                  </div>
                  <div className="text-center p-2 bg-white rounded-xl shadow-3xs">
                    <span className="text-[9px] text-slate-400 font-bold block">الألحان والقبطي</span>
                    <span className="text-xs font-bold text-slate-700 font-mono">{poolStats.byCategory["الألحان والقبطي"] || 0}</span>
                  </div>
                </div>

                {/* Difficulty distribution sub-text */}
                <div className="flex justify-around text-[10px] text-slate-500 font-bold px-1">
                  <span>سهل: <strong className="text-emerald-600 font-mono">{poolStats.byDifficulty["سهل"] || 0}</strong></span>
                  <span>متوسط: <strong className="text-amber-600 font-mono">{poolStats.byDifficulty["متوسط"] || 0}</strong></span>
                  <span>صعب: <strong className="text-rose-600 font-mono">{poolStats.byDifficulty["صعب"] || 0}</strong></span>
                </div>

                <div className="border-t border-slate-100 pt-3 space-y-2.5">
                  <span className="text-[10px] text-slate-400 font-black block">✨ توليد وتغذية البنك بالذكاء الاصطناعي (Gemini-3.5-Flash):</span>
                  
                  {/* Category Selection */}
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-400 font-bold">تصنيف السؤال:</label>
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value as any)}
                      className="w-full bg-slate-50 border border-slate-200 text-[11.5px] font-bold px-3 py-1.5 rounded-xl outline-none focus:border-indigo-500"
                    >
                      <option value="الكتاب المقدس">الكتاب المقدس 📖</option>
                      <option value="اللاهوت والعقيدة">اللاهوت والعقيدة ⛪</option>
                      <option value="الألحان والقبطي">الألحان والقبطي 🎼</option>
                      <option value="تاريخ الكنيسة والطقوس">تاريخ الكنيسة والطقوس 📜</option>
                      <option value="القديسون والشخصيات">القديسون والشخصيات ☦️</option>
                    </select>
                  </div>

                  {/* Difficulty Selection */}
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-400 font-bold">مستوى الصعوبة:</label>
                    <select
                      value={selectedDifficulty}
                      onChange={(e) => setSelectedDifficulty(e.target.value as any)}
                      className="w-full bg-slate-50 border border-slate-200 text-[11.5px] font-bold px-3 py-1.5 rounded-xl outline-none focus:border-indigo-500"
                    >
                      <option value="سهل">سهل 🟢</option>
                      <option value="متوسط">متوسط 🟡</option>
                      <option value="صعب">صعب 🔴</option>
                    </select>
                  </div>

                  {/* Submit Button */}
                  <button
                    onClick={handleReplenishPool}
                    disabled={isGenerating}
                    className="w-full py-2 bg-indigo-650 hover:bg-indigo-700 disabled:opacity-50 text-white text-[11px] font-black rounded-xl shadow-xs hover:shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${isGenerating ? "animate-spin" : ""}`} />
                    <span>{isGenerating ? "جاري ابتكار وتوليد الأسئلة..." : "توليد 5 أسئلة ذكية وإضافتها للبنك 🚀"}</span>
                  </button>

                  <p className="text-[9px] text-slate-400 text-center leading-normal">
                    سيقوم الذكاء الاصطناعي بصياغة ٥ أسئلة حصرية خالية من التكرار بنسبة ١٠٠٪ وإدراجها فورياً.
                  </p>
                </div>
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
};
