import React, { useState, useEffect } from "react";
import { 
  Sparkles, Check, ArrowRight, ArrowLeft, Trophy, Settings, Users, 
  Gamepad2, Calendar, FileText, Lock, Plus, Minus, Volume2, Music, 
  Database, HelpCircle, ShieldAlert, CheckCircle2, RefreshCw, Layers,
  ChevronUp, ChevronDown, RotateCcw, Image as ImageIcon
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import confetti from "canvas-confetti";
import { GAME_PLUGINS, GamePluginConfig } from "./gamePlugins";

interface RoomCreateWizardProps {
  onCancel: () => void;
  onCreateRoom: (roomData: {
    name: string;
    eventType: string;
    teamCount: number;
    divisionMethod: "random" | "manual";
    allowedGames: string[];
    roomDesc: string;
    maxParticipants: number;
    roomImage: string;
    teamConfigs: { id: string; name: string; color: string; icon: string }[];
    settings: {
      roundTimer: number;
      questionTimer: number;
      hostApproval: boolean;
      lockWhenFull: boolean;
      allowSpectate: boolean;
      playSFX: boolean;
      playBGM: boolean;
      autoScore: boolean;
      manualScore: boolean;
      questionLanguage: string;
      difficulty: string;
    };
  }) => void;
}

const PRESET_ROOM_IMAGES = ["⛪", "⛺", "🌟", "🕊️", "📖", "🦁", "🏺", "🕯️"];

export const RoomCreateWizard: React.FC<RoomCreateWizardProps> = ({ onCancel, onCreateRoom }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);

  // --- Step 1: Room Info ---
  const [roomName, setRoomName] = useState("خلوة الشباب الروحية - كنيستنا ⛪");
  const [roomImage, setRoomImage] = useState("⛪");
  const [eventType, setEventType] = useState("retreat");
  const [roomDesc, setRoomDesc] = useState("مسابقات تفاعلية وفعاليات روحية ممتعة وجاذبة للجميع");
  const [maxParticipants, setMaxParticipants] = useState(50);

  // --- Step 2: Teams Configuration ---
  const [teamCount, setTeamCount] = useState(2);
  const [divisionMethod, setDivisionMethod] = useState<"random" | "manual">("random");
  
  // Default team settings
  const [teamConfigs, setTeamConfigs] = useState<
    { id: string; name: string; color: string; icon: string }[]
  >([
    { id: "team_1", name: "فريق القديس بولس 🔴", color: "#EF4444", icon: "🔴" },
    { id: "team_2", name: "فريق القديس بطرس 🔵", color: "#3B82F6", icon: "🔵" },
    { id: "team_3", name: "فريق القديس مرقس 🟢", color: "#10B981", icon: "🟢" },
    { id: "team_4", name: "فريق القديس يوحنا 🟡", color: "#F59E0B", icon: "🟡" },
    { id: "team_5", name: "فريق القديس أندراوس 🟣", color: "#8B5CF6", icon: "🟣" },
    { id: "team_6", name: "فريق القديس توما 💗", color: "#EC4899", icon: "💗" },
  ]);

  // --- Step 3: Game Selection & Order ---
  const [allowedGames, setAllowedGames] = useState<string[]>(["trivia", "general_trivia", "whoami", "fillverse"]);
  const [gamesOrder, setGamesOrder] = useState<string[]>(["trivia", "general_trivia", "whoami", "fillverse"]);

  // --- Step 4: Session Settings ---
  const [roundTimer, setRoundTimer] = useState(120);
  const [questionTimer, setQuestionTimer] = useState(30);
  const [hostApproval, setHostApproval] = useState(true);
  const [lockWhenFull, setLockWhenFull] = useState(false);
  const [allowSpectate, setAllowSpectate] = useState(true);
  const [playSFX, setPlaySFX] = useState(true);
  const [playBGM, setPlayBGM] = useState(false);
  const [autoScore, setAutoScore] = useState(true);
  const [manualScore, setManualScore] = useState(true);
  const [questionLanguage, setQuestionLanguage] = useState("العربية");
  const [difficulty, setDifficulty] = useState("متوسط");

  // Load draft from localStorage on mount
  useEffect(() => {
    const savedDraft = localStorage.getItem("coptic_room_creation_draft");
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        if (parsed.roomName) setRoomName(parsed.roomName);
        if (parsed.roomImage) setRoomImage(parsed.roomImage);
        if (parsed.eventType) setEventType(parsed.eventType);
        if (parsed.roomDesc) setRoomDesc(parsed.roomDesc);
        if (parsed.maxParticipants) setMaxParticipants(parsed.maxParticipants);
        if (parsed.teamCount) setTeamCount(parsed.teamCount);
        if (parsed.divisionMethod) setDivisionMethod(parsed.divisionMethod);
        if (parsed.teamConfigs) setTeamConfigs(parsed.teamConfigs);
        if (parsed.allowedGames) setAllowedGames(parsed.allowedGames);
        if (parsed.gamesOrder) setGamesOrder(parsed.gamesOrder);
        if (parsed.roundTimer) setRoundTimer(parsed.roundTimer);
        if (parsed.questionTimer) setQuestionTimer(parsed.questionTimer);
        if (parsed.hostApproval !== undefined) setHostApproval(parsed.hostApproval);
        if (parsed.lockWhenFull !== undefined) setLockWhenFull(parsed.lockWhenFull);
        if (parsed.allowSpectate !== undefined) setAllowSpectate(parsed.allowSpectate);
        if (parsed.playSFX !== undefined) setPlaySFX(parsed.playSFX);
        if (parsed.playBGM !== undefined) setPlayBGM(parsed.playBGM);
        if (parsed.autoScore !== undefined) setAutoScore(parsed.autoScore);
        if (parsed.manualScore !== undefined) setManualScore(parsed.manualScore);
        if (parsed.questionLanguage) setQuestionLanguage(parsed.questionLanguage);
        if (parsed.difficulty) setDifficulty(parsed.difficulty);
        if (parsed.currentStep) setCurrentStep(parsed.currentStep);
      } catch (e) {
        console.error("Error reading saved wizard draft", e);
      }
    }
  }, []);

  // Sync / Auto-save values to draft in localStorage
  const saveDraft = (stepToSave?: number) => {
    const draft = {
      roomName,
      roomImage,
      eventType,
      roomDesc,
      maxParticipants,
      teamCount,
      divisionMethod,
      teamConfigs,
      allowedGames,
      gamesOrder,
      roundTimer,
      questionTimer,
      hostApproval,
      lockWhenFull,
      allowSpectate,
      playSFX,
      playBGM,
      autoScore,
      manualScore,
      questionLanguage,
      difficulty,
      currentStep: stepToSave || currentStep
    };
    localStorage.setItem("coptic_room_creation_draft", JSON.stringify(draft));
  };

  // Trigger save on state updates or stepping
  const handleNext = () => {
    if (currentStep < 5) {
      const next = currentStep + 1;
      setCurrentStep(next);
      saveDraft(next);
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      const prev = currentStep - 1;
      setCurrentStep(prev);
      saveDraft(prev);
    }
  };

  const handleJumpToStep = (step: number) => {
    setCurrentStep(step);
    saveDraft(step);
  };

  const handleSaveAsDraftClick = () => {
    saveDraft();
    confetti({
      particleCount: 40,
      spread: 50,
      origin: { y: 0.8 }
    });
  };

  const handleResetDraft = () => {
    localStorage.removeItem("coptic_room_creation_draft");
    // Reload state defaults
    setRoomName("خلوة الشباب الروحية - كنيستنا ⛪");
    setRoomImage("⛪");
    setEventType("retreat");
    setRoomDesc("مسابقات تفاعلية وفعاليات روحية ممتعة وجاذبة للجميع");
    setMaxParticipants(50);
    setTeamCount(2);
    setDivisionMethod("random");
    setAllowedGames(["trivia", "general_trivia", "whoami", "fillverse"]);
    setGamesOrder(["trivia", "general_trivia", "whoami", "fillverse"]);
    setRoundTimer(120);
    setQuestionTimer(30);
    setHostApproval(true);
    setLockWhenFull(false);
    setAllowSpectate(true);
    setPlaySFX(true);
    setPlayBGM(false);
    setAutoScore(true);
    setManualScore(true);
    setQuestionLanguage("العربية");
    setDifficulty("متوسط");
    setCurrentStep(1);
  };

  // Keep gamesOrder synced when allowedGames changes
  useEffect(() => {
    // Keep games that are currently in allowedGames
    const filtered = gamesOrder.filter(gId => allowedGames.includes(gId));
    // Add newly checked games
    allowedGames.forEach(gId => {
      if (!filtered.includes(gId)) {
        filtered.push(gId);
      }
    });
    setGamesOrder(filtered);
  }, [allowedGames]);

  // Handle Team Configuration count updates
  useEffect(() => {
    // Ensure we have configs matching teamCount
    if (teamConfigs.length < teamCount) {
      const defaultNames = ["القديس مرقس 🟢", "القديس يوحنا 🟡", "القديس أندراوس 🟣", "القديس توما 💗"];
      const defaultColors = ["#10B981", "#F59E0B", "#8B5CF6", "#EC4899"];
      const defaultIcons = ["🟢", "🟡", "🟣", "💗"];
      
      const updated = [...teamConfigs];
      for (let i = teamConfigs.length; i < teamCount; i++) {
        const listIndex = i - 2; // Offset since first 2 are always setup
        updated.push({
          id: `team_${i + 1}`,
          name: `فريق ${defaultNames[listIndex] || `القديس ${i + 1}`}`,
          color: defaultColors[listIndex] || "#64748B",
          icon: defaultIcons[listIndex] || "🏳️"
        });
      }
      setTeamConfigs(updated);
    }
  }, [teamCount]);

  const updateTeamConfig = (id: string, updates: Partial<{ name: string; color: string; icon: string }>) => {
    setTeamConfigs(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  // Reordering handers for Step 3
  const moveGameOrder = (index: number, direction: "up" | "down") => {
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= gamesOrder.length) return;
    
    const reordered = [...gamesOrder];
    const temp = reordered[index];
    reordered[index] = reordered[nextIndex];
    reordered[nextIndex] = temp;
    setGamesOrder(reordered);
  };

  const handleCreateAndSubmit = () => {
    // Trigger canvas-confetti
    confetti({
      particleCount: 150,
      spread: 80,
      origin: { y: 0.6 }
    });
    
    // Show beautiful success overlay first, then trigger callback after a delay
    setShowSuccessOverlay(true);
    
    setTimeout(() => {
      // Clear draft after successful creation
      localStorage.removeItem("coptic_room_creation_draft");
      onCreateRoom({
        name: roomName,
        eventType,
        teamCount,
        divisionMethod,
        allowedGames: gamesOrder, // pass the custom-ordered games
        roomDesc,
        maxParticipants,
        roomImage,
        teamConfigs: teamConfigs.slice(0, teamCount),
        settings: {
          roundTimer,
          questionTimer,
          hostApproval,
          lockWhenFull,
          allowSpectate,
          playSFX,
          playBGM,
          autoScore,
          manualScore,
          questionLanguage,
          difficulty
        }
      });
    }, 2800);
  };

  // Custom Toggle Switch Component
  const ToggleSwitch = ({ checked, onChange, icon }: { checked: boolean; onChange: (v: boolean) => void; icon?: React.ReactNode }) => (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
        checked ? "bg-amber-500" : "bg-slate-200"
      }`}
    >
      <span
        className={`pointer-events-none relative inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out flex items-center justify-center ${
          checked ? "-translate-x-5" : "translate-x-0"
        }`}
      >
        {icon && <span className="text-[9px] text-slate-500">{icon}</span>}
      </span>
    </button>
  );

  return (
    <div className="relative" dir="rtl">
      
      {/* ----------------- SUCCESS CELEBRATION OVERLAY ----------------- */}
      <AnimatePresence>
        {showSuccessOverlay && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/90 z-[99999] flex flex-col items-center justify-center text-center p-6"
          >
            <motion.div
              initial={{ scale: 0.3, y: 50, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              transition={{ type: "spring", damping: 15 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full space-y-6 shadow-2xl border border-amber-100"
            >
              <div className="w-20 h-20 bg-emerald-500 rounded-full mx-auto flex items-center justify-center shadow-lg animate-bounce">
                <Check className="w-10 h-10 text-white stroke-[3px]" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-900">تم تأسيس الغرفة بنجاح! 🎉</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  تم إعداد الشفرات، تجهيز غرف الهروب وتوزيع بركات المسابقات بنجاح. سننتقل الآن إلى لوحة تحكم الخادم الاحترافية للبدء.
                </p>
              </div>

              {/* Loader animation */}
              <div className="flex justify-center gap-1.5 py-2">
                <span className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-bounce" />
              </div>

              <p className="text-[10px] text-slate-400 font-bold">نشكر إرشاد الروح القدس 🕊️</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white border border-[#D6D6C2] rounded-3xl p-6 space-y-6 shadow-sm overflow-hidden">
        
        {/* HEADER SECTION */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b pb-4 border-[#D6D6C2] gap-3">
          <div className="space-y-1 text-right">
            <h3 className="text-base font-black text-[#0A2342] flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500 animate-pulse" />
              مساعد إعداد وتأسيس غرفة ألعاب جديدة
            </h3>
            <p className="text-xs text-slate-500">صمم سيرفر خلوتك المباركة بطابع منظم وعصري</p>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveAsDraftClick}
              className="py-1.5 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 text-[11px] font-black rounded-xl border border-slate-200 transition-all cursor-pointer"
              title="حفظ التقدم الحالي للرجوع إليه لاحقاً"
            >
              💾 حفظ كمسودة
            </button>
            <button
              onClick={handleResetDraft}
              className="py-1.5 px-3 bg-red-50 hover:bg-red-100 text-red-700 text-[11px] font-black rounded-xl border border-red-100 transition-all cursor-pointer"
              title="تصفير البيانات والبدء من جديد"
            >
              🔄 تصفير
            </button>
            <button 
              type="button" 
              onClick={onCancel} 
              className="py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-500 text-[11px] font-black rounded-xl transition-all cursor-pointer"
            >
              إلغاء
            </button>
          </div>
        </div>

        {/* MODERN WIZARD STEPPER (●────●────●────●────●) */}
        <div className="py-2 px-1 max-w-xl mx-auto">
          <div className="relative flex items-center justify-between">
            {/* Background line */}
            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 bg-slate-100 -z-10" />
            
            {/* Active connection progress bar */}
            <div 
              className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-gradient-to-r from-amber-500 to-amber-500 transition-all duration-500 -z-10"
              style={{ 
                left: "10%",
                right: `${100 - (currentStep - 1) * 25 - 10}%`
              }} 
            />

            {[1, 2, 3, 4, 5].map((step) => {
              const isActive = currentStep === step;
              const isCompleted = currentStep > step;
              
              const stepIcons = [
                "🏕️", // Room Info
                "👥", // Teams
                "🎮", // Games
                "⚙️", // Settings
                "🚀"  // Create
              ];

              const stepLabels = [
                "الغرفة",
                "الفرق",
                "الألعاب",
                "الإعدادات",
                "المراجعة"
              ];

              return (
                <button
                  key={step}
                  type="button"
                  onClick={() => handleJumpToStep(step)}
                  className="flex flex-col items-center focus:outline-none group relative cursor-pointer"
                >
                  <div 
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-300 ${
                      isActive 
                        ? "bg-amber-500 text-white ring-4 ring-amber-100 scale-110 shadow-md" 
                        : isCompleted 
                          ? "bg-amber-600 text-white" 
                          : "bg-white text-slate-400 border-2 border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    {isCompleted ? <Check className="w-4 h-4 stroke-[3px]" /> : stepIcons[step - 1]}
                  </div>
                  <span className={`text-[10px] font-black mt-1.5 transition-colors ${isActive ? "text-amber-600" : "text-slate-400"}`}>
                    {stepLabels[step - 1]}
                  </span>
                </button>
              );
            })}
          </div>
          
          <div className="text-center mt-3 text-[10px] text-slate-400 font-bold">
            متبقي {5 - currentStep} خطوات لإتمام إطلاق الغرفة 🚀
          </div>
        </div>

        {/* STEP CONTENT SWITCH WITH SLIDE/FADE HERO TRANSITIONS */}
        <div className="bg-slate-50/50 rounded-3xl p-5 border border-slate-100 min-h-[340px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              className="space-y-4 text-right"
            >
              
              {/* ----------------- STEP 1: ROOM INFO ----------------- */}
              {currentStep === 1 && (
                <div className="space-y-4">
                  
                  {/* Elegant Top Illustration */}
                  <div className="bg-gradient-to-r from-amber-500/10 to-amber-600/5 border border-amber-500/10 rounded-2xl p-4 flex items-center gap-4">
                    <div className="w-14 h-14 bg-amber-500 text-white rounded-2xl flex items-center justify-center shadow-md text-2xl shrink-0">
                      🏕️
                    </div>
                    <div className="space-y-0.5">
                      <h4 className="text-xs font-black text-amber-800">🏕️ الخطوة الأولى: معلومات الغرفة الأساسية</h4>
                      <p className="text-[10px] text-slate-500 leading-relaxed">
                        اختر اسماً مباركاً معبراً لغرفة المسابقات ومستوى المشاركين لتسهيل انخراطهم وتأسيس جو من المحبة.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Room Name */}
                    <div className="space-y-1">
                      <label className="block text-[11px] font-black text-slate-700">اسم الغرفة أو الفعالية 🏷️ <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        required
                        value={roomName}
                        onChange={(e) => setRoomName(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-amber-500 text-slate-800 font-bold"
                        placeholder="مثال: مسابقات خلوة الشباب كنيسة العذراء"
                      />
                    </div>

                    {/* Room Icon / Emoji Preset Avatar */}
                    <div className="space-y-1">
                      <label className="block text-[11px] font-black text-slate-700">أيقونة أو رمز الغرفة المفضل 📷</label>
                      <div className="flex gap-2 flex-wrap bg-white border p-1.5 rounded-xl">
                        {PRESET_ROOM_IMAGES.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => setRoomImage(emoji)}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all cursor-pointer ${
                              roomImage === emoji 
                                ? "bg-amber-100 border border-amber-400 scale-110" 
                                : "hover:bg-slate-50 border border-transparent"
                            }`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Event Type */}
                    <div className="space-y-1">
                      <label className="block text-[11px] font-black text-slate-700">نوع الحدث أو المؤتمر ⛪</label>
                      <select
                        value={eventType}
                        onChange={(e) => setEventType(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-amber-500 font-bold"
                      >
                        <option value="retreat">🏕️ خلوة كنسية روحيّة</option>
                        <option value="conference">🏛️ مؤتمر شباب عام</option>
                        <option value="meeting">⛪ اجتماع روحي أسبوعي</option>
                        <option value="party">🎉 حفلة أو يوم ترفيهي كنسي</option>
                      </select>
                    </div>

                    {/* Max Participants */}
                    <div className="space-y-1">
                      <label className="block text-[11px] font-black text-slate-700">الحد الأقصى للمشاركين المتصلين 👥</label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setMaxParticipants(Math.max(5, maxParticipants - 5))}
                          className="w-10 h-10 bg-white border rounded-xl flex items-center justify-center font-black hover:bg-slate-50 cursor-pointer text-slate-600"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-xs font-mono font-black text-slate-800 bg-white border rounded-xl px-4 py-2 text-center flex-1">
                          {maxParticipants} فرداً
                        </span>
                        <button
                          type="button"
                          onClick={() => setMaxParticipants(Math.min(250, maxParticipants + 5))}
                          className="w-10 h-10 bg-white border rounded-xl flex items-center justify-center font-black hover:bg-slate-50 cursor-pointer text-slate-600"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Room Description */}
                    <div className="space-y-1 md:col-span-2">
                      <label className="block text-[11px] font-black text-slate-700">وصف مختصر للغرفة أو الغرض من الفعالية 📝</label>
                      <textarea
                        value={roomDesc}
                        onChange={(e) => setRoomDesc(e.target.value)}
                        rows={2}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-amber-500 text-slate-800 resize-none font-medium"
                        placeholder="أدخل رسالة قصيرة ترحيبية تظهر للاعبين فور انضمامهم للمسابقة..."
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ----------------- STEP 2: TEAMS CONFIG ----------------- */}
              {currentStep === 2 && (
                <div className="space-y-4">
                  <div className="bg-gradient-to-r from-blue-500/10 to-blue-600/5 border border-blue-500/10 rounded-2xl p-4 flex items-center gap-4">
                    <div className="w-14 h-14 bg-blue-500 text-white rounded-2xl flex items-center justify-center shadow-md text-2xl shrink-0">
                      👥
                    </div>
                    <div className="space-y-0.5">
                      <h4 className="text-xs font-black text-blue-800">👥 الخطوة الثانية: إعداد وهيكلة الفرق</h4>
                      <p className="text-[10px] text-slate-500 leading-relaxed">
                        حدد عدد المجموعات، خصص ألوانها ورموزها، واختر طريقة تقسيم اللاعبين (تلقائية بالتساوي أو سحب يدوي).
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    
                    {/* Basic Settings */}
                    <div className="space-y-4 md:col-span-1 bg-white p-4 rounded-2xl border border-slate-100">
                      <div className="space-y-1">
                        <label className="block text-[11px] font-black text-slate-700">عدد الفرق المتنافسة 👥</label>
                        <select
                          value={teamCount}
                          onChange={(e) => setTeamCount(Number(e.target.value))}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-amber-500 font-bold"
                        >
                          <option value={2}>فريقين (٢)</option>
                          <option value={3}>٣ فرق متنافسة</option>
                          <option value={4}>٤ فرق متنافسة</option>
                          <option value={6}>٦ مجموعات مخصصة</option>
                        </select>
                      </div>

                      <div className="space-y-1.5 pt-2">
                        <label className="block text-[11px] font-black text-slate-700">طريقة توزيع اللاعبين على الفرق 🔀</label>
                        <div className="flex flex-col gap-2">
                          <button
                            type="button"
                            onClick={() => setDivisionMethod('random')}
                            className={`py-2 px-3 rounded-xl border text-[11px] font-black text-right flex items-center justify-between cursor-pointer ${
                              divisionMethod === 'random'
                                ? 'bg-amber-50 border-amber-400 text-amber-900 shadow-3xs'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <span>توزيع تلقائي بالتساوي (عشوائي)</span>
                            <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-black">موصى به</span>
                          </button>
                          
                          <button
                            type="button"
                            onClick={() => setDivisionMethod('manual')}
                            className={`py-2 px-3 rounded-xl border text-[11px] font-black text-right flex items-center justify-between cursor-pointer ${
                              divisionMethod === 'manual'
                                ? 'bg-amber-50 border-amber-400 text-amber-900 shadow-3xs'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <span>توزيع يدوي (Drag & Select)</span>
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-black">تحكم كامل</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Customizer + Preview Column */}
                    <div className="md:col-span-2 space-y-3">
                      <label className="block text-[11px] font-black text-slate-700">تخصيص ومعاينة الفرق الحالية المباشرة:</label>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pr-1">
                        {teamConfigs.slice(0, teamCount).map((team, idx) => (
                          <div 
                            key={team.id} 
                            className="bg-white border rounded-2xl p-3 flex flex-col justify-between space-y-2.5 shadow-3xs hover:border-slate-300 transition-all"
                            style={{ borderTop: `4px solid ${team.color}` }}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-slate-400 font-mono">#{idx+1}</span>
                              <input 
                                type="text"
                                value={team.name}
                                onChange={(e) => updateTeamConfig(team.id, { name: e.target.value })}
                                className="text-xs font-black text-slate-800 bg-slate-50 hover:bg-slate-100 focus:bg-white rounded-lg px-2 py-1 flex-1 text-right focus:outline-none focus:ring-1 focus:ring-amber-500"
                              />
                            </div>
                            
                            <div className="flex items-center justify-between gap-1.5">
                              {/* Color selector */}
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-slate-400 font-bold ml-1">اللون:</span>
                                {["#EF4444", "#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899"].map((color) => (
                                  <button
                                    key={color}
                                    type="button"
                                    onClick={() => updateTeamConfig(team.id, { color })}
                                    className={`w-4.5 h-4.5 rounded-full border border-slate-200 transition-all cursor-pointer ${
                                      team.color === color ? "scale-125 ring-2 ring-slate-400" : ""
                                    }`}
                                    style={{ backgroundColor: color }}
                                  />
                                ))}
                              </div>

                              {/* Emoji select */}
                              <input 
                                type="text" 
                                value={team.icon} 
                                onChange={(e) => updateTeamConfig(team.id, { icon: e.target.value })}
                                className="w-7 h-7 text-xs text-center border bg-slate-50 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
                                placeholder="🔴"
                                title="أيقونة أو إيموجي الفريق"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ----------------- STEP 3: GAME SELECTION & ORDER ----------------- */}
              {currentStep === 3 && (
                <div className="space-y-4">
                  <div className="bg-gradient-to-r from-purple-500/10 to-purple-600/5 border border-purple-500/10 rounded-2xl p-4 flex items-center gap-4">
                    <div className="w-14 h-14 bg-purple-500 text-white rounded-2xl flex items-center justify-center shadow-md text-2xl shrink-0">
                      🎮
                    </div>
                    <div className="space-y-0.5">
                      <h4 className="text-xs font-black text-purple-800">🎮 الخطوة الثالثة: اختيار وترتيب الألعاب داخل الجلسة</h4>
                      <p className="text-[10px] text-slate-500 leading-relaxed">
                        انقر على الألعاب لتضمينها في جلستك، ثم تحكم في ترتيب تشغيلها باستخدام الأسهم لترتيب ألعاب المسابقة بالتسلسل المطلوب.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    
                    {/* Game Grid selection */}
                    <div className="md:col-span-2 space-y-2">
                      <label className="block text-[11px] font-black text-slate-700">مكتبة الألعاب المتاحة بالمحرّك (انقر للاختيار):</label>
                      
                      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2 max-h-[320px] overflow-y-auto pr-1">
                        {GAME_PLUGINS.map((plugin) => {
                          const isSelected = allowedGames.includes(plugin.id);
                          return (
                            <button
                              key={plugin.id}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  if (allowedGames.length <= 1) {
                                    alert("يجب اختيار لعبة واحدة على الأقل في الجلسة!");
                                    return;
                                  }
                                  setAllowedGames(allowedGames.filter(id => id !== plugin.id));
                                } else {
                                  setAllowedGames([...allowedGames, plugin.id]);
                                }
                              }}
                              className={`p-2 rounded-xl border text-center flex flex-col items-center justify-center transition-all cursor-pointer relative group h-20 ${
                                isSelected
                                  ? "bg-purple-50 border-purple-400 text-purple-900 ring-2 ring-purple-100 shadow-sm"
                                  : "bg-white border-slate-150 text-slate-600 hover:border-slate-300"
                              }`}
                            >
                              <div className="text-xl mb-1">{plugin.icon}</div>
                              <h5 className="text-[9px] font-black truncate w-full px-1">{plugin.label.split(" ")[0]}</h5>
                              
                              {isSelected && (
                                <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-purple-600 rounded-full flex items-center justify-center text-white">
                                  <Check className="w-2.5 h-2.5 stroke-[4px]" />
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Games Sequencing List */}
                    <div className="space-y-2">
                      <label className="block text-[11px] font-black text-slate-700">ترتيب الألعاب داخل الجلسة ⏳:</label>
                      <div className="bg-white border p-3 rounded-2xl space-y-1.5 max-h-[320px] overflow-y-auto">
                        <p className="text-[9px] text-slate-400 mb-1 leading-normal">
                          * يتم تشغيل الألعاب بهذا الترتيب تماماً. انقر على الأسهم لتغيير مكان اللعبة بالتسلسل.
                        </p>
                        
                        {gamesOrder.map((gId, idx) => {
                          const game = GAME_PLUGINS.find(p => p.id === gId);
                          if (!game) return null;
                          return (
                            <div 
                              key={gId}
                              className="flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-100 text-xs font-black text-slate-800"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] bg-slate-200 text-slate-600 w-5 h-5 rounded-full flex items-center justify-center font-mono">
                                  {idx + 1}
                                </span>
                                <span className="text-base">{game.icon}</span>
                                <span className="truncate max-w-[100px]">{game.label.split(" ")[0]}</span>
                              </div>
                              
                              <div className="flex gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => moveGameOrder(idx, "up")}
                                  disabled={idx === 0}
                                  className="p-1 hover:bg-slate-200 disabled:opacity-30 rounded text-slate-500 cursor-pointer"
                                  title="تحريك لأعلى"
                                >
                                  <ChevronUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveGameOrder(idx, "down")}
                                  disabled={idx === gamesOrder.length - 1}
                                  className="p-1 hover:bg-slate-200 disabled:opacity-30 rounded text-slate-500 cursor-pointer"
                                  title="تحريك لأسفل"
                                >
                                  <ChevronDown className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}

                        {gamesOrder.length === 0 && (
                          <p className="text-xs text-slate-400 text-center py-6">الرجاء تحديد الألعاب من القائمة أولاً.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ----------------- STEP 4: SESSION SETTINGS ----------------- */}
              {currentStep === 4 && (
                <div className="space-y-4">
                  <div className="bg-gradient-to-r from-emerald-500/10 to-emerald-600/5 border border-emerald-500/10 rounded-2xl p-4 flex items-center gap-4">
                    <div className="w-14 h-14 bg-emerald-500 text-white rounded-2xl flex items-center justify-center shadow-md text-2xl shrink-0">
                      ⚙️
                    </div>
                    <div className="space-y-0.5">
                      <h4 className="text-xs font-black text-emerald-800">⚙️ الخطوة الرابعة: تخصيص إعدادات وقوانين الجلسة</h4>
                      <p className="text-[10px] text-slate-500 leading-relaxed">
                        قم بتهيئة مؤقت الأسئلة والجولات، شروط الدخول والتحكم، وميزات الموسيقى والتحكيم اليدوي بالكامل.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto pr-1">
                    
                    {/* Timer configs */}
                    <div className="bg-white border rounded-2xl p-3.5 space-y-2">
                      <h5 className="text-[11px] font-black text-[#0A2342] border-b pb-1">⏱️ إعدادات المؤقت والوقت</h5>
                      
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold text-slate-500">مؤقت الجولة الكلي (بالثواني)</label>
                        <select 
                          value={roundTimer} 
                          onChange={(e) => setRoundTimer(Number(e.target.value))}
                          className="w-full bg-slate-50 border rounded-lg px-2 py-1 text-xs font-black focus:outline-none"
                        >
                          <option value={60}>⏱️ دقيقة واحدة (60 ث)</option>
                          <option value={120}>⏱️ دقيقتان (120 ث)</option>
                          <option value={180}>⏱️ ٣ دقائق (180 ث)</option>
                          <option value={300}>⏱️ ٥ دقائق (300 ث)</option>
                        </select>
                      </div>

                      <div className="space-y-1.5 pt-1">
                        <label className="block text-[10px] font-bold text-slate-500">مؤقت الإجابة عن السؤال (ثانية)</label>
                        <select 
                          value={questionTimer} 
                          onChange={(e) => setQuestionTimer(Number(e.target.value))}
                          className="w-full bg-slate-50 border rounded-lg px-2 py-1 text-xs font-black focus:outline-none"
                        >
                          <option value={15}>⚡ سريع جداً (15 ث)</option>
                          <option value={30}>⚡ متوسط مناسب (30 ث)</option>
                          <option value={45}>⚡ هادئ كافٍ (45 ث)</option>
                          <option value={60}>⚡ طويل كافٍ (60 ث)</option>
                        </select>
                      </div>
                    </div>

                    {/* Room protection */}
                    <div className="bg-white border rounded-2xl p-3.5 space-y-2.5">
                      <h5 className="text-[11px] font-black text-[#0A2342] border-b pb-1">🛡️ الأمان وضوابط الدخول</h5>
                      
                      <div className="flex items-center justify-between text-xs font-black">
                        <span className="text-slate-700">موافقة المنظم قبل الدخول</span>
                        <ToggleSwitch checked={hostApproval} onChange={setHostApproval} />
                      </div>
                      
                      <div className="flex items-center justify-between text-xs font-black">
                        <span className="text-slate-700">قفل الغرفة عند اكتمال العدد</span>
                        <ToggleSwitch checked={lockWhenFull} onChange={setLockWhenFull} />
                      </div>

                      <div className="flex items-center justify-between text-xs font-black">
                        <span className="text-slate-700">السماح بالمشاهدة والانتظار</span>
                        <ToggleSwitch checked={allowSpectate} onChange={setAllowSpectate} />
                      </div>
                    </div>

                    {/* Sounds and FX */}
                    <div className="bg-white border rounded-2xl p-3.5 space-y-2.5">
                      <h5 className="text-[11px] font-black text-[#0A2342] border-b pb-1">🔊 الصوت والموسيقى</h5>
                      
                      <div className="flex items-center justify-between text-xs font-black">
                        <span className="text-slate-700">تشغيل المؤثرات الصوتية (SFX)</span>
                        <ToggleSwitch checked={playSFX} onChange={setPlaySFX} icon={<Volume2 className="w-2.5 h-2.5" />} />
                      </div>

                      <div className="flex items-center justify-between text-xs font-black">
                        <span className="text-slate-700">تشغيل الموسيقى الخلفية</span>
                        <ToggleSwitch checked={playBGM} onChange={setPlayBGM} icon={<Music className="w-2.5 h-2.5" />} />
                      </div>
                    </div>

                    {/* Scoring engines */}
                    <div className="bg-white border rounded-2xl p-3.5 space-y-2.5">
                      <h5 className="text-[11px] font-black text-[#0A2342] border-b pb-1">📊 التحكيم واحتساب النقاط</h5>
                      
                      <div className="flex items-center justify-between text-xs font-black">
                        <span className="text-slate-700">احتساب النقاط تلقائياً</span>
                        <ToggleSwitch checked={autoScore} onChange={setAutoScore} />
                      </div>

                      <div className="flex items-center justify-between text-xs font-black">
                        <span className="text-slate-700">السماح بالتعديل اليدوي</span>
                        <ToggleSwitch checked={manualScore} onChange={setManualScore} />
                      </div>
                    </div>

                    {/* Difficulty and Localization */}
                    <div className="bg-white border rounded-2xl p-3.5 space-y-2">
                      <h5 className="text-[11px] font-black text-[#0A2342] border-b pb-1">🌍 اللغة ومستوى الصعوبة</h5>
                      
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-slate-500">لغة الأسئلة المعتمدة</label>
                        <select 
                          value={questionLanguage} 
                          onChange={(e) => setQuestionLanguage(e.target.value)}
                          className="w-full bg-slate-50 border rounded-lg px-2 py-1 text-xs font-black focus:outline-none"
                        >
                          <option value="العربية">العربية (الأولية)</option>
                          <option value="القبطية">القبطية والطقوس</option>
                          <option value="الإنجليزية">English (مترجمة)</option>
                        </select>
                      </div>

                      <div className="space-y-1 pt-1">
                        <label className="block text-[10px] font-bold text-slate-500">مستوى صعوبة الأسئلة</label>
                        <select 
                          value={difficulty} 
                          onChange={(e) => setDifficulty(e.target.value)}
                          className="w-full bg-slate-50 border rounded-lg px-2 py-1 text-xs font-black focus:outline-none"
                        >
                          <option value="سهل">سهل وبسيط</option>
                          <option value="متوسط">متوسط متوازن</option>
                          <option value="صعب">صعب ولاهوتي متميز</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ----------------- STEP 5: REVIEW & CREATE ----------------- */}
              {currentStep === 5 && (
                <div className="space-y-4">
                  <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-2xl p-4 flex items-center gap-4">
                    <div className="w-14 h-14 bg-white/20 text-white rounded-2xl flex items-center justify-center shadow-inner text-2xl shrink-0">
                      🚀
                    </div>
                    <div className="space-y-0.5">
                      <h4 className="text-xs font-black text-amber-100">🚀 الخطوة الخامسة: مراجعة وإطلاق الغرفة المباركة</h4>
                      <p className="text-[10px] text-amber-50 leading-relaxed">
                        راجع ملخص التكوينات، ثم انقر على الزر الكلي أدناه لإطلاق الغرفة وبدء استقبال اللاعبين فوراً.
                      </p>
                    </div>
                  </div>

                  {/* Summary grid details */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    
                    {/* Column 1: basic */}
                    <div className="bg-white border rounded-2xl p-3.5 space-y-2">
                      <h5 className="text-[11px] font-black text-[#0A2342] border-b pb-1">🏕️ معلومات الغرفة</h5>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between font-bold">
                          <span className="text-slate-400">الاسم:</span>
                          <span className="text-slate-800 truncate max-w-[150px]">{roomName}</span>
                        </div>
                        <div className="flex justify-between font-bold">
                          <span className="text-slate-400">الأيقونة:</span>
                          <span className="text-slate-800 text-sm">{roomImage}</span>
                        </div>
                        <div className="flex justify-between font-bold">
                          <span className="text-slate-400">النوع:</span>
                          <span className="text-slate-800">
                            {eventType === "retreat" ? "🏕️ خلوة" : eventType === "conference" ? "🏛️ مؤتمر" : "⛪ اجتماع"}
                          </span>
                        </div>
                        <div className="flex justify-between font-bold">
                          <span className="text-slate-400">الحد الأقصى:</span>
                          <span className="text-slate-800">{maxParticipants} فرد</span>
                        </div>
                      </div>
                    </div>

                    {/* Column 2: teams */}
                    <div className="bg-white border rounded-2xl p-3.5 space-y-2">
                      <h5 className="text-[11px] font-black text-[#0A2342] border-b pb-1">👥 تكوين الفرق ({teamCount})</h5>
                      <div className="space-y-1.5">
                        <div className="grid grid-cols-2 gap-1 max-h-24 overflow-y-auto">
                          {teamConfigs.slice(0, teamCount).map(t => (
                            <div key={t.id} className="text-[10px] font-black px-2 py-1 rounded bg-slate-50 border-r-4 flex items-center gap-1" style={{ borderRightColor: t.color }}>
                              <span>{t.icon}</span>
                              <span className="truncate">{t.name.split(" ")[1] || t.name}</span>
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-between text-xs font-bold pt-1.5 border-t">
                          <span className="text-slate-400">طريقة التوزيع:</span>
                          <span className="text-slate-800">{divisionMethod === "random" ? "تلقائي بالتساوي" : "توزيع يدوي"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Column 3: games */}
                    <div className="bg-white border rounded-2xl p-3.5 space-y-2">
                      <h5 className="text-[11px] font-black text-[#0A2342] border-b pb-1">🎮 الألعاب المعتمدة بترتيبها</h5>
                      <div className="space-y-1 text-[10px] font-black max-h-28 overflow-y-auto">
                        {gamesOrder.map((gId, index) => {
                          const g = GAME_PLUGINS.find(p => p.id === gId);
                          return (
                            <div key={gId} className="flex justify-between text-slate-800">
                              <span>#{index + 1} {g?.icon} {g?.label.split(" ")[0]}</span>
                              <span className="text-[9px] text-slate-400 font-bold">جاهز</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                  </div>

                  {/* Gigantic Create Room button */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleCreateAndSubmit}
                      className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-sm font-black rounded-2xl shadow-xl transform hover:scale-[1.01] active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      <span>🎮</span>
                      <span>توليد الغرفة وبدء استقبال اللاعبين الآن ⚡</span>
                    </button>
                  </div>

                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>

        {/* BOTTOM NAVIGATION BUTTONS */}
        <div className="flex justify-between items-center border-t pt-4 border-[#D6D6C2]">
          <button
            type="button"
            onClick={handlePrev}
            disabled={currentStep === 1}
            className="px-4 py-2 bg-slate-50 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none text-xs font-black rounded-xl border border-slate-200 text-slate-600 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            <span>السابق</span>
          </button>

          <span className="text-xs font-black text-slate-400">
            الخطوة {currentStep} من 5
          </span>

          {currentStep < 5 ? (
            <button
              type="button"
              onClick={handleNext}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-black rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>التالي</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          ) : (
            <div className="w-16" /> // spacer
          )}
        </div>

      </div>
    </div>
  );
};
