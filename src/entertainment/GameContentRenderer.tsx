import React, { useState, useEffect } from "react";
import { Check, X, Timer, Crown, Star, Sparkles, HelpCircle, Lock, Unlock, Play, ArrowUpRight, Clock, Flame, ListOrdered, Link2, BookOpen, Keyboard } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { CHARADES_ITEMS, GUESS_IMAGE_ITEMS, ESCAPE_ROOM_LOCKS, BOMB_BOXES_POOL, SPIRITUAL_RANDOM_CHALLENGES, TIMELINE_ITEMS, VERSE_MATCH_ITEMS, SACRAMENTS_QUESTIONS, TYPE_VERSE_ITEMS } from "./gamePlugins";
import { BASE_TRIVIA_QUESTIONS } from './data/triviaData';

interface GameContentRendererProps {
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
}

export const GameContentRenderer: React.FC<GameContentRendererProps> = ({
  currentGame,
  currentQuestionIndex,
  currentRoundQuizQuestions,
  role,
  currentUser,
  room,
  hasSubmittedAnswer,
  selectedOptionIdx,
  handlePlayerSubmitAnswer,
  speedMultiplier,
  timeRushCorrect,
  timeRushTotal,
  setTimeRushCorrect,
  setTimeRushTotal,
  charadesActor,
  charadesItem,
  setCharadesItem,
  handleAdjustPoints,
  guessImageRevealed,
  setGuessImageRevealed,
  guessImageGuessValue,
  setGuessImageGuessValue,
  guessImageSolved,
  setGuessImageSolved,
  guessImageItem,
  setGuessImageItem,
  wheelAngle,
  setWheelAngle,
  wheelIsSpinning,
  setWheelIsSpinning,
  wheelResultText,
  setWheelResultText,
  escapeLockIdx,
  setEscapeLockIdx,
  escapeCodeValue,
  setEscapeCodeValue,
  escapeRoomHintShown,
  setEscapeRoomHintShown,
  bombBoxes,
  setBombBoxes,
  luckyBoxChoices,
  setLuckyBoxChoices,
  luckyBoxOutcomes,
  setLuckyBoxOutcomes,
  diceValue,
  setDiceValue,
  isDiceRolling,
  setIsDiceRolling,
  customQuestionBank,
  setCustomQuestionBank,
  qBankForm,
  setQBankForm,
  tournamentMatches,
  setTournamentMatches,
  drawSecret,
  drawPaths,
  setDrawPaths,
  randomChallengeText,
  setRandomChallengeText,
  dailyEventItem,
  showToast
}) => {
  const selfPlayer = room?.players.find((p: any) => p.id === currentUser.id);
  const selfTeamId = selfPlayer?.teamId;

  // --- Timeline Game State ---
  const [timelineIdx, setTimelineIdx] = useState(0);
  const [timelineEvents, setTimelineEvents] = useState<any[]>([]);
  const [timelineSelected, setTimelineSelected] = useState<any[]>([]);
  const [timelineSolved, setTimelineSolved] = useState<boolean | null>(null);

  useEffect(() => {
    const activeTimeline = TIMELINE_ITEMS[timelineIdx];
    if (activeTimeline) {
      const shuffled = [...activeTimeline.events].sort(() => Math.random() - 0.5);
      setTimelineEvents(shuffled);
      setTimelineSelected([]);
      setTimelineSolved(null);
    }
  }, [timelineIdx, currentGame]);

  // --- Verse Match Game State ---
  const [selectedVerse, setSelectedVerse] = useState<string | null>(null);
  const [selectedRef, setSelectedRef] = useState<string | null>(null);
  const [completedMatches, setCompletedMatches] = useState<string[]>([]);
  const [shuffledVerses, setShuffledVerses] = useState<string[]>([]);
  const [shuffledRefs, setShuffledRefs] = useState<string[]>([]);

  useEffect(() => {
    if (currentGame === 'versematch') {
      const verses = VERSE_MATCH_ITEMS.map(item => item.verse).sort(() => Math.random() - 0.5);
      const refs = VERSE_MATCH_ITEMS.map(item => item.reference).sort(() => Math.random() - 0.5);
      setShuffledVerses(verses);
      setShuffledRefs(refs);
      setCompletedMatches([]);
      setSelectedVerse(null);
      setSelectedRef(null);
    }
  }, [currentGame]);

  // --- Sacraments Game State ---
  const [sacramentIdx, setSacramentIdx] = useState(0);
  const [sacramentAnswer, setSacramentAnswer] = useState<number | null>(null);
  const [sacramentAnswered, setSacramentAnswered] = useState(false);

  useEffect(() => {
    setSacramentAnswer(null);
    setSacramentAnswered(false);
  }, [sacramentIdx, currentGame]);

  // --- Speed Typer Game State ---
  const [typeVerseIdx, setTypeVerseIdx] = useState(0);
  const [typeInput, setTypeInput] = useState("");
  const [typeSuccess, setTypeSuccess] = useState<boolean | null>(null);
  const [typeTimer, setTypeTimer] = useState(25);

  useEffect(() => {
    if (currentGame !== 'typeverse' || typeSuccess !== null) return;
    const interval = setInterval(() => {
      setTypeTimer(t => {
        if (t <= 1) {
          clearInterval(interval);
          setTypeSuccess(false);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [currentGame, typeVerseIdx, typeSuccess]);

  useEffect(() => {
    setTypeInput("");
    setTypeSuccess(null);
    setTypeTimer(25);
  }, [typeVerseIdx, currentGame]);

  return (
    <div className="space-y-4 py-2 text-right">
      {/* --- MULTIPLE CHOICE TRIVIA PANELS --- */}
      {["trivia", "general_trivia", "whoami", "fillverse", "speed", "timerush", "auction"].includes(currentGame) && (
        currentRoundQuizQuestions.length > 0 && currentQuestionIndex < currentRoundQuizQuestions.length ? (
          <div className="space-y-4">
            {/* Speed Challenge Banner */}
            {currentGame === "speed" && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-2.5 text-xs text-amber-800 flex justify-between items-center font-black animate-pulse">
                <span>⚡ مكافأة السرعة الجارية:</span>
                <span className="bg-amber-500 text-white px-2 py-0.5 rounded-full font-mono">+{speedMultiplier} نقطة</span>
              </div>
            )}

            {/* Time Rush Banner */}
            {currentGame === "timerush" && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-2.5 text-xs text-blue-800 flex justify-between items-center font-black">
                <span>⏱️ سباق الوقت السريع:</span>
                <span className="font-mono text-xs">تمت الإجابة: {timeRushCorrect} من أصل {timeRushTotal}</span>
              </div>
            )}

            {/* Points Auction Banner */}
            {currentGame === "auction" && (
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-3 text-xs text-purple-900 space-y-2">
                <h5 className="font-black">⚖️ مزاد المراهنة على النقاط:</h5>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  قم بالمراهنة بنقاط من رصيدك قبل الإجابة. الإجابة الصحيحة تضاعف رصيد الرهان، والخاطئة تخصمه!
                </p>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    placeholder="رقم الرهان (مثلاً 20)"
                    id="auction-bid-input"
                    className="w-28 p-1.5 border rounded-lg text-xs"
                  />
                  <button
                    onClick={() => {
                      const val = parseInt((document.getElementById("auction-bid-input") as HTMLInputElement)?.value || "10");
                      showToast(`⚖️ تم تسجيل رهان بقيمة ${val} نقطة على هذا السؤال!`);
                    }}
                    className="bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-black px-3 py-1.5 rounded-lg"
                  >
                    تأكيد الرهان
                  </button>
                </div>
              </div>
            )}

            {/* Animated Question & Options Container */}
            <AnimatePresence mode="wait">
              <motion.div
                key={`live-q-${currentQuestionIndex}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ type: "spring", stiffness: 350, damping: 25 }}
                className="space-y-4"
              >
                {/* The Question Text */}
                <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4">
                  <p className="text-xs sm:text-sm font-black text-slate-800 whitespace-pre-line leading-relaxed">
                    {currentRoundQuizQuestions[currentQuestionIndex].question}
                  </p>
                </div>

                {/* Options List */}
                {role === "participant" ? (
                  <motion.div 
                    className="grid grid-cols-1 sm:grid-cols-2 gap-2.5"
                    variants={{
                      hidden: { opacity: 0 },
                      show: {
                        opacity: 1,
                        transition: {
                          staggerChildren: 0.05
                        }
                      }
                    }}
                    initial="hidden"
                    animate="show"
                  >
                    {currentRoundQuizQuestions[currentQuestionIndex].options.map((opt: string, idx: number) => {
                      const isCorrectAns = idx === currentRoundQuizQuestions[currentQuestionIndex].correctIdx;
                      const isSelected = idx === selectedOptionIdx;
                      return (
                        <motion.button
                          key={opt}
                          type="button"
                          disabled={hasSubmittedAnswer}
                          onClick={() => {
                            handlePlayerSubmitAnswer(idx);
                            if (currentGame === "timerush") {
                              setTimeRushTotal(t => t + 1);
                              if (isCorrectAns) setTimeRushCorrect(c => c + 1);
                            }
                          }}
                          variants={{
                            hidden: { opacity: 0, y: 15 },
                            show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 20 } }
                          }}
                          whileHover={!hasSubmittedAnswer ? { scale: 1.01, backgroundColor: "#f8fafc" } : {}}
                          whileTap={!hasSubmittedAnswer ? { scale: 0.99 } : {}}
                          animate={
                            hasSubmittedAnswer
                              ? isCorrectAns
                                ? { scale: [1, 1.08, 0.98, 1.02, 1], transition: { duration: 0.5, type: 'spring' } } // Pop effect for correct answer
                                : isSelected
                                  ? { x: [0, -8, 8, -8, 8, -4, 4, 0], transition: { duration: 0.4 } } // Shake effect for selected incorrect
                                  : {}
                              : {}
                          }
                          className={`p-3.5 rounded-xl text-xs font-black text-right border transition-all flex items-center justify-between cursor-pointer ${
                            hasSubmittedAnswer
                              ? idx === selectedOptionIdx
                                ? isCorrectAns
                                  ? "bg-emerald-500 text-white border-emerald-600 animate-pulse shadow-md"
                                  : "bg-red-500 text-white border-red-600 shadow-md"
                                : isCorrectAns
                                  ? "bg-emerald-100 border-emerald-300 text-emerald-800"
                                  : "bg-slate-50 border-slate-200 text-slate-400"
                              : isSelected
                                ? "bg-blue-50 border-[#0A2342] text-[#0A2342] scale-[1.01] shadow-3xs"
                                : "bg-white border-slate-200 hover:border-blue-400 hover:bg-blue-50/30"
                          }`}
                        >
                          <span>{opt}</span>
                          {hasSubmittedAnswer && isCorrectAns && <Check className="w-3.5 h-3.5" />}
                          {hasSubmittedAnswer && idx === selectedOptionIdx && !isCorrectAns && <X className="w-3.5 h-3.5" />}
                        </motion.button>
                      );
                    })}
                  </motion.div>
                ) : (
                  // Host View: reveals answer details instantly
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-400">خيارات الإجابة للمتسابقين (الإجابة الصحيحة باللون الأخضر للخادم):</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {currentRoundQuizQuestions[currentQuestionIndex].options.map((opt: string, idx: number) => {
                        const isCorrectAns = idx === currentRoundQuizQuestions[currentQuestionIndex].correctIdx;
                        return (
                          <div
                            key={opt}
                            className={`p-2.5 rounded-xl text-xs font-black border ${
                              isCorrectAns 
                                ? "bg-emerald-50 text-emerald-800 border-emerald-300" 
                                : "bg-slate-50 text-slate-600 border-slate-200"
                            }`}
                          >
                            {opt} {isCorrectAns && "✓"}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Explanation card */}
                {(hasSubmittedAnswer || role === "host") && currentRoundQuizQuestions[currentQuestionIndex].explanation && (
                  <div className="bg-amber-50 border border-amber-200/60 rounded-xl p-3 text-[10.5px] leading-relaxed text-amber-900 animate-fade-in">
                    <strong>💡 تأمل كنسي / تفسير:</strong> {currentRoundQuizQuestions[currentQuestionIndex].explanation}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        ) : (
          <div className="text-center py-6 text-slate-400">تحميل محتوى الأسئلة بنعمة الله...</div>
        )
      )}

      {/* --- GAME 2: CHARADES 🎭 --- */}
      {currentGame === "charades" && (
        <div className="space-y-4 bg-slate-50 border rounded-2xl p-4 text-right">
          <div className="border-b pb-2 flex justify-between items-center">
            <span className="text-[10px] bg-red-100 text-red-800 font-bold px-2.5 py-0.5 rounded-full">التمثيل الإيمائي 🎭</span>
            <span className="text-[10px] font-bold text-slate-400">الممثل المختار: {charadesActor?.name || "جارٍ التحديد..."}</span>
          </div>

          {(role === "host" || (charadesActor && currentUser.id === charadesActor.id)) ? (
            <div className="bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-xl p-4 text-center space-y-2 shadow-sm">
              <p className="text-[10px] opacity-90">الكلمة أو القصة السرية للتمثيل (سرية تماماً!):</p>
              <h4 className="text-sm sm:text-base font-black">{charadesItem?.text || "يونان في بطن الحوت"}</h4>
              <span className="text-[9px] bg-white/20 px-2.5 py-0.5 rounded-full">التصنيف: {charadesItem?.category} • صعوبة: {charadesItem?.diff}</span>
            </div>
          ) : (
            <div className="bg-white border rounded-xl p-6 text-center space-y-2">
              <p className="text-xs font-black text-slate-700">الممثل الروحي يقوم بتمثيل المفهوم الإنجيلي صامتاً!</p>
              <p className="text-[10px] text-slate-400">تحدثوا وتواصلوا لتخمين اللغز.</p>
            </div>
          )}

          {role === "host" && (
            <div className="pt-2 border-t flex gap-2 justify-end">
              <button
                onClick={() => {
                  if (charadesActor?.teamId) {
                    handleAdjustPoints(charadesActor.teamId, 30);
                    showToast(`🎉 تخمين صحيح! تم منح فريق الممثل +30 نقطة!`);
                  }
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10.5px] font-black px-4 py-2 rounded-xl cursor-pointer"
              >
                ✅ تخمين صحيح (+30)
              </button>
              <button
                onClick={() => {
                  const randomItem = CHARADES_ITEMS[Math.floor(Math.random() * CHARADES_ITEMS.length)];
                  setCharadesItem(randomItem);
                  showToast(`🔄 تم تغيير الكلمة العشوائية للتمثيل.`);
                }}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-black px-3 py-2 rounded-xl cursor-pointer"
              >
                🔄 تغيير الكلمة
              </button>
            </div>
          )}
        </div>
      )}

      {/* --- GAME 3: GUESS THE IMAGE 🖼️ --- */}
      {currentGame === "guessimage" && (
        <div className="space-y-4 bg-slate-50 border rounded-2xl p-4 text-right">
          <div className="border-b pb-2 flex justify-between items-center">
            <span className="text-[10px] bg-sky-100 text-sky-800 font-bold px-2.5 py-0.5 rounded-full">خمن الصورة بالرموز 🖼️</span>
            <span className="text-[10px] text-slate-400">تظهر الرموز تدريجياً كشفرة بصرية</span>
          </div>

          <div className="max-w-xs mx-auto grid grid-cols-4 gap-1.5 bg-slate-200 p-2 rounded-xl border">
            {Array(16).fill(0).map((_, i) => {
              const isRevealed = guessImageRevealed[i] || guessImageSolved;
              return (
                <div
                  key={i}
                  className={`aspect-square rounded-lg flex items-center justify-center transition-all font-mono font-black text-xs ${
                    isRevealed 
                      ? "bg-sky-50 text-sky-800 text-lg border border-sky-200 scale-95" 
                      : "bg-slate-900 text-white border border-slate-700 select-none"
                  }`}
                >
                  {isRevealed ? (
                    guessImageItem?.icon ? (guessImageItem.icon.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g) || guessImageItem.icon.split(""))[i % 4] || "✨" : "✨"
                  ) : (
                    "?"
                  )}
                </div>
              );
            })}
          </div>

          <div className="bg-white border rounded-xl p-3 text-center space-y-1.5">
            <p className="text-[11px] text-slate-500"><strong>تلميح الحل:</strong> {guessImageItem?.hint || "قصة شهيرة بالعهد القديم"}</p>
            {guessImageSolved ? (
              <p className="text-xs font-black text-emerald-600">🎉 الإجابة الصحيحة: {guessImageItem?.title}</p>
            ) : null}
          </div>

          {!guessImageSolved && (
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="اكتب اسم الحدث لتخمينه..."
                value={guessImageGuessValue}
                onChange={(e) => setGuessImageGuessValue(e.target.value)}
                className="flex-1 p-2 border rounded-xl text-xs text-right"
              />
              <button
                onClick={() => {
                  if (guessImageGuessValue.trim() === guessImageItem?.title || guessImageGuessValue.includes(guessImageItem?.title.slice(0, 4))) {
                    setGuessImageSolved(true);
                    showToast(`🎉 كيرياليسون! تخمين صحيح تماماً!`);
                    if (selfTeamId) {
                      handleAdjustPoints(selfTeamId, 40);
                    }
                  } else {
                    showToast(`❌ تخمين خاطئ، حاول مراجعة الرموز المفتوحة.`);
                  }
                }}
                className="bg-sky-600 hover:bg-sky-700 text-white text-[10.5px] font-black px-4 py-2 rounded-xl"
              >
                تأكيد التخمين
              </button>
            </div>
          )}

          {role === "host" && (
            <div className="pt-2 border-t flex gap-2 justify-end">
              <button
                onClick={() => {
                  setGuessImageRevealed(Array(16).fill(true));
                  setGuessImageSolved(true);
                }}
                className="bg-amber-500 text-white text-[10px] font-black px-3 py-1.5 rounded-lg"
              >
                👀 كشف الصورة بالكامل
              </button>
              <button
                onClick={() => {
                  const randomItem = GUESS_IMAGE_ITEMS[Math.floor(Math.random() * GUESS_IMAGE_ITEMS.length)];
                  setGuessImageItem(randomItem);
                  setGuessImageRevealed(Array(16).fill(false));
                  setGuessImageSolved(false);
                }}
                className="bg-slate-200 text-slate-700 text-[10px] font-black px-3 py-1.5 rounded-lg"
              >
                🔄 صورة أخرى
              </button>
            </div>
          )}
        </div>
      )}

      {/* --- GAME 4: CHALLENGE WHEEL 🎡 --- */}
      {currentGame === "wheel" && (
        <div className="space-y-4 bg-slate-50 border rounded-2xl p-4 text-center">
          <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2.5 py-0.5 rounded-full">عجلة التحديات التفاعلية 🎡</span>
          
          <div className="relative w-40 h-40 mx-auto border-4 border-slate-800 rounded-full flex items-center justify-center overflow-hidden transition-all duration-[3000ms]" style={{ transform: `rotate(${wheelAngle}deg)` }}>
            <div className="absolute inset-0 bg-gradient-to-tr from-amber-400 via-rose-400 to-sky-400 opacity-90" />
            <div className="absolute w-full h-0.5 bg-slate-900" />
            <div className="absolute w-0.5 h-full bg-slate-900" />
            <span className="z-10 font-black text-slate-950 text-xs bg-white/95 px-2 py-1 rounded-full shadow-md">🎯 SPIN ME</span>
          </div>

          <div className="space-y-1.5">
            <button
              type="button"
              disabled={wheelIsSpinning}
              onClick={() => {
                setWheelIsSpinning(true);
                const extraAngle = 1080 + Math.floor(Math.random() * 360);
                setWheelAngle(prev => prev + extraAngle);
                setTimeout(() => {
                  setWheelIsSpinning(false);
                  const options = [
                    "ترتيل لحن كنسي مبارك 🎵",
                    "تلاوة آية روحية كاملة مع الشاهد 📖",
                    "تمثيل شخصية قديس مشهور 👤",
                    "هدية مباركة بقيمة +30 نقطة للفريق! 💎",
                    "سؤال كنسي عقائدي صعب ⚡",
                    "الحديث عن فضيلة مسيحية هامة ✝️",
                    "انفجار قنبلة وخصم -10 نقاط! 💣",
                    "صندوق الحظ الذهبي 🎁"
                  ];
                  const picked = options[Math.floor(Math.random() * options.length)];
                  setWheelResultText(picked);
                  showToast(`🎡 وقفت العجلة عند: ${picked}`);
                }, 3000);
              }}
              className="bg-amber-500 hover:bg-amber-600 text-white font-black text-xs px-6 py-2 rounded-xl shadow-md cursor-pointer transition-all disabled:opacity-40"
            >
              {wheelIsSpinning ? "تتحرك العجلة بنعمة..." : "تدوير العجلة الآن 🔄"}
            </button>

            {wheelResultText && (
              <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-3.5 mt-2 animate-bounce">
                <p className="text-[10px] text-amber-800">التحدي الذي تم اختياره:</p>
                <h4 className="text-xs font-black text-[#0A2342] mt-1">{wheelResultText}</h4>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- GAME 5: BIBLE ESCAPE ROOM 🔑 --- */}
      {currentGame === "escaperoom" && (
        <div className="space-y-4 bg-slate-50 border rounded-2xl p-4 text-right">
          <div className="flex justify-between items-center bg-slate-200/50 p-2.5 rounded-xl">
            {ESCAPE_ROOM_LOCKS.map((lock, i) => (
              <div key={lock.id} className="flex items-center gap-1">
                <span className={`text-xs font-black rounded-full w-5 h-5 flex items-center justify-center ${
                  escapeLockIdx > i 
                    ? "bg-emerald-500 text-white" 
                    : escapeLockIdx === i 
                      ? "bg-amber-500 text-white animate-pulse" 
                      : "bg-slate-400 text-white"
                }`}>
                  {escapeLockIdx > i ? "✓" : lock.id}
                </span>
                <span className="text-[8.5px] text-slate-500 hidden sm:inline">{lock.title.split(" ")[0]}</span>
              </div>
            ))}
          </div>

          {escapeLockIdx < ESCAPE_ROOM_LOCKS.length ? (
            <div className="space-y-3.5">
              <div className="bg-white border rounded-xl p-3.5 space-y-2">
                <span className="text-[9px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">القفل النشط {escapeLockIdx + 1} 🔒</span>
                <h4 className="text-xs font-black text-slate-800 leading-relaxed">{ESCAPE_ROOM_LOCKS[escapeLockIdx].question}</h4>
                
                {ESCAPE_ROOM_LOCKS[escapeLockIdx].options && (
                  <div className="space-y-1.5 pt-1.5">
                    {ESCAPE_ROOM_LOCKS[escapeLockIdx].options?.map((opt, idx) => (
                      <button
                        key={opt}
                        onClick={() => setEscapeCodeValue(idx.toString())}
                        className={`w-full text-right p-2 border rounded-lg text-[10.5px] font-black ${
                          escapeCodeValue === idx.toString() 
                            ? "bg-blue-50 border-blue-400 text-blue-900" 
                            : "bg-white hover:bg-slate-50"
                        }`}
                      >
                        [{idx + 1}] {opt}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {!ESCAPE_ROOM_LOCKS[escapeLockIdx].options && (
                <input
                  type="text"
                  placeholder="ادخل الشفرة لحل اللغز..."
                  value={escapeCodeValue}
                  onChange={(e) => setEscapeCodeValue(e.target.value)}
                  className="w-full p-2.5 border rounded-xl text-xs text-center font-mono font-black"
                />
              )}

              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setEscapeRoomHintShown(true)}
                  className="text-[9.5px] font-black text-amber-600 hover:underline cursor-pointer"
                >
                  💡 إظهار تلميح اللغز
                </button>
                <button
                  onClick={() => {
                    const lock = ESCAPE_ROOM_LOCKS[escapeLockIdx];
                    if (escapeCodeValue.trim() === lock.solution) {
                      showToast("🔓 فتح القفل بنجاح! الانتقال للغرفة التالية...");
                      setEscapeLockIdx(prev => prev + 1);
                      setEscapeCodeValue("");
                      setEscapeRoomHintShown(false);
                      if (selfTeamId) handleAdjustPoints(selfTeamId, 15);
                    } else {
                      showToast("❌ الشفرة غير متطابقة! جرب الحل الروحي بدقة.");
                    }
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10.5px] font-black px-4 py-1.5 rounded-xl cursor-pointer"
                >
                  🗝️ محاولة فتح القفل
                </button>
              </div>

              {escapeRoomHintShown && (
                <p className="bg-amber-50 text-[10px] text-amber-900 rounded-lg p-2 leading-relaxed">
                  <strong>💡 التلميح الكنسي:</strong> {ESCAPE_ROOM_LOCKS[escapeLockIdx].hint}
                </p>
              )}
            </div>
          ) : (
            <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-5 text-center space-y-3">
              <h4 className="text-sm font-black text-emerald-800">👑 لقد نجح فريقكم في الهروب والوصول للبر الإنجيلي بالكامل!</h4>
              <p className="text-[10.5px] text-slate-500">تم منح الفريق مكافأة هروب كبرى قدرها +50 نقطة!</p>
            </div>
          )}
        </div>
      )}

      {/* --- GAME 6: BOMB GAME 💣 --- */}
      {currentGame === "bomb" && (
        <div className="space-y-4 bg-slate-50 border rounded-2xl p-4 text-right">
          <div className="border-b pb-2 flex justify-between items-center">
            <span className="text-[10px] bg-red-100 text-red-800 font-bold px-2.5 py-0.5 rounded-full">حقل الصناديق المتفجرة 💣</span>
            <span className="text-[10px] text-slate-400">تحتوي الصناديق على مفاجآت عشوائية</span>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {bombBoxes.map((box) => (
              <button
                key={box.id}
                disabled={box.openedByTeamId !== null}
                onClick={() => {
                  if (!selfTeamId) {
                    showToast("برجاء التوزيع على فريق للمشاركة أولاً!");
                    return;
                  }
                  
                  setBombBoxes(prev => prev.map(b => b.id === box.id ? { ...b, openedByTeamId: selfTeamId } : b));
                  showToast(box.text);
                  handleAdjustPoints(selfTeamId, box.value);
                }}
                className={`aspect-square rounded-xl flex flex-col items-center justify-center p-2 border transition-all ${
                  box.openedByTeamId 
                    ? "bg-slate-900 border-slate-950 text-white" 
                    : "bg-gradient-to-br from-amber-50 to-amber-100 border-amber-300 hover:scale-105 hover:bg-amber-100 cursor-pointer shadow-xs"
                }`}
              >
                {box.openedByTeamId ? (
                  <div className="text-center space-y-1">
                    <span className="text-sm">{box.type === "bomb" ? "💣" : "🎁"}</span>
                    <p className="text-[8.5px] font-black font-mono leading-tight">+{box.value}ن</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <span className="text-base">📦</span>
                    <p className="text-[10px] font-black font-mono mt-0.5">#{box.id}</p>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* --- GAME 7: LUCKY BOX 🎁 --- */}
      {currentGame === "luckybox" && (
        <div className="space-y-4 bg-slate-50 border rounded-2xl p-4 text-center">
          <span className="text-[10px] bg-yellow-100 text-yellow-800 font-bold px-2.5 py-0.5 rounded-full">صناديق الحظ الروحية 🎁</span>
          <p className="text-[10.5px] text-slate-500 leading-relaxed">اختر صندوقاً واحداً غامضاً لتكشف عنه!</p>

          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((num) => {
              const isChosen = selfTeamId && luckyBoxChoices[selfTeamId] === num;
              return (
                <button
                  key={num}
                  disabled={selfTeamId ? luckyBoxChoices[selfTeamId] !== undefined : false}
                  onClick={() => {
                    if (!selfTeamId) return;
                    const outcomes = [
                      "مضاعفة النقاط في الجولة التالية! ✨",
                      "حصانة وحماية من عقوبات القنابل القادمة 🛡️",
                      "خصم عقابي خفيف -15 نقطة! 💥"
                    ];
                    const result = outcomes[num - 1];
                    setLuckyBoxChoices(prev => ({ ...prev, [selfTeamId!]: num }));
                    setLuckyBoxOutcomes(prev => ({ ...prev, [selfTeamId!]: result }));
                    showToast(`🎁 اخترت الصندوق رقم ${num}: ${result}`);
                    if (num === 3) handleAdjustPoints(selfTeamId, -15);
                  }}
                  className={`aspect-square rounded-2xl flex flex-col items-center justify-center p-3 border-2 transition-all cursor-pointer ${
                    isChosen 
                      ? "bg-slate-900 text-white border-slate-900 scale-105 shadow-md" 
                      : "bg-white border-amber-300 hover:bg-amber-50/50"
                  }`}
                >
                  <span className="text-xl sm:text-2xl">{isChosen ? "🔓" : "🎁"}</span>
                  <p className="text-xs font-black mt-1">صندوق #{num}</p>
                  {isChosen && (
                    <p className="text-[8.5px] text-amber-300 leading-normal mt-1">{luckyBoxOutcomes[selfTeamId!]}</p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* --- GAME 8: DIGITAL DICE 🎲 --- */}
      {currentGame === "dice" && (
        <div className="space-y-4 bg-slate-50 border rounded-2xl p-4 text-center">
          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full">رمي النرد الروحي 🎲</span>
          
          <div className="py-4">
            <button
              disabled={isDiceRolling}
              onClick={() => {
                setIsDiceRolling(true);
                const interval = setInterval(() => {
                  setDiceValue(Math.floor(Math.random() * 6) + 1);
                }, 100);
                setTimeout(() => {
                  clearInterval(interval);
                  setIsDiceRolling(false);
                  const rolled = Math.floor(Math.random() * 6) + 1;
                  setDiceValue(rolled);
                  showToast(`🎲 استقر النرد على الرقم ${rolled}!`);
                }, 1500);
              }}
              className={`w-20 h-20 mx-auto rounded-2xl bg-white border-4 border-slate-900 flex items-center justify-center text-3xl font-black font-mono shadow-md cursor-pointer hover:bg-slate-50 active:scale-95 transition-all ${
                isDiceRolling ? "animate-spin" : ""
              }`}
            >
              {diceValue === 1 ? "⚀" : diceValue === 2 ? "⚁" : diceValue === 3 ? "⚂" : diceValue === 4 ? "⚃" : diceValue === 5 ? "⚄" : "⚅"}
            </button>
          </div>

          <div className="bg-white border rounded-xl p-3 text-right">
            <p className="text-[10.5px] font-black text-[#0A2342] border-b pb-1.5 mb-2 flex items-center gap-1">
              <span>📋</span>
              جدول المهام التابع للنرد:
            </p>
            <div className="grid grid-cols-2 gap-2 text-[9.5px]">
              <div className={`p-1.5 rounded border ${diceValue === 1 ? "bg-emerald-50 border-emerald-300 font-bold" : ""}`}>1 = سؤال كتابي سهل</div>
              <div className={`p-1.5 rounded border ${diceValue === 2 ? "bg-emerald-50 border-emerald-300 font-bold" : ""}`}>2 = سؤال كتابي متوسط</div>
              <div className={`p-1.5 rounded border ${diceValue === 3 ? "bg-emerald-50 border-emerald-300 font-bold" : ""}`}>3 = سؤال كتابي صعب</div>
              <div className={`p-1.5 rounded border ${diceValue === 4 ? "bg-emerald-50 border-emerald-300 font-bold" : ""}`}>4 = هدية مجانية (+20)</div>
              <div className={`p-1.5 rounded border ${diceValue === 5 ? "bg-emerald-50 border-emerald-300 font-bold" : ""}`}>5 = قنبلة وخصم نقاط (-10)</div>
              <div className={`p-1.5 rounded border ${diceValue === 6 ? "bg-emerald-50 border-emerald-300 font-bold" : ""}`}>6 = صندوق الحظ الذهبي</div>
            </div>
          </div>
        </div>
      )}

      {/* --- GAME 9: CUSTOM QUESTION BANK EDITOR 📂 --- */}
      {currentGame === "qbank" && (
        <div className="space-y-4 bg-slate-50 border rounded-2xl p-4 text-right">
          <span className="text-[10px] bg-slate-200 text-slate-800 font-bold px-2.5 py-0.5 rounded-full">إدارة بنك الأسئلة المخصص 📂</span>
          
          {role === "host" ? (
            <div className="space-y-3.5 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="space-y-1">
                  <label className="font-bold text-slate-600">السؤال:</label>
                  <input
                    type="text"
                    placeholder="مثال: من هو النبي الصغير؟"
                    value={qBankForm.question}
                    onChange={(e) => setQBankForm({ ...qBankForm, question: e.target.value })}
                    className="w-full p-2 border rounded-xl text-right"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-600">التصنيف الكنسي:</label>
                  <select
                    value={qBankForm.category}
                    onChange={(e) => setQBankForm({ ...qBankForm, category: e.target.value })}
                    className="w-full p-2 border rounded-xl text-right"
                  >
                    <option value="الكتاب المقدس">الكتاب المقدس</option>
                    <option value="الشخصيات">الشخصيات</option>
                    <option value="العقيدة والطقوس">العقيدة والطقوس</option>
                    <option value="القديسون">القديسون</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <input
                  type="text"
                  placeholder="الاختيار أ"
                  value={qBankForm.optionA}
                  onChange={(e) => setQBankForm({ ...qBankForm, optionA: e.target.value })}
                  className="p-1.5 border rounded-lg text-right"
                />
                <input
                  type="text"
                  placeholder="الاختيار ب"
                  value={qBankForm.optionB}
                  onChange={(e) => setQBankForm({ ...qBankForm, optionB: e.target.value })}
                  className="p-1.5 border rounded-lg text-right"
                />
                <input
                  type="text"
                  placeholder="الاختيار ج"
                  value={qBankForm.optionC}
                  onChange={(e) => setQBankForm({ ...qBankForm, optionC: e.target.value })}
                  className="p-1.5 border rounded-lg text-right"
                />
                <input
                  type="text"
                  placeholder="الاختيار د"
                  value={qBankForm.optionD}
                  onChange={(e) => setQBankForm({ ...qBankForm, optionD: e.target.value })}
                  className="p-1.5 border rounded-lg text-right"
                />
              </div>

              <div className="flex gap-2 items-center text-xs justify-between">
                <div className="flex gap-1.5 items-center">
                  <label className="font-bold">الإجابة الصحيحة:</label>
                  <select
                    value={qBankForm.correctOption}
                    onChange={(e) => setQBankForm({ ...qBankForm, correctOption: e.target.value })}
                    className="p-1.5 border rounded-lg text-right"
                  >
                    <option value="A">الاختيار أ</option>
                    <option value="B">الاختيار ب</option>
                    <option value="C">الاختيار ج</option>
                    <option value="D">الاختيار د</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (!qBankForm.question || !qBankForm.optionA || !qBankForm.optionB) {
                      showToast("⚠️ يرجى ملء حقول الأسئلة على الأقل الخيارين أ وب!");
                      return;
                    }
                    const opts = [qBankForm.optionA, qBankForm.optionB, qBankForm.optionC, qBankForm.optionD].filter(Boolean);
                    const correctIdx = qBankForm.correctOption === "A" ? 0 : qBankForm.correctOption === "B" ? 1 : qBankForm.correctOption === "C" ? 2 : 3;
                    const newQ = {
                      question: `[${qBankForm.category}] ${qBankForm.question}`,
                      options: opts,
                      correctIdx,
                      explanation: `سؤال مخصص تمت إضافته يدوياً بقيمة ${qBankForm.points} نقطة.`
                    };
                    setCustomQuestionBank(prev => [newQ, ...prev]);
                    setQBankForm({
                      question: "", optionA: "", optionB: "", optionC: "", optionD: "",
                      correctOption: "A", category: "الكتاب المقدس", difficulty: "متوسط", points: 20
                    });
                    showToast("✓ تم إضافة السؤال بنجاح في مخزن الغرفة!");
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-4 py-2 rounded-xl cursor-pointer"
                >
                  💾 حفظ السؤال
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500 py-4 text-center">أنت متفرج الآن. الخادم المنظم للغرفة يقوم بإضافة الأسئلة من لوحته الخاصة.</p>
          )}

          <div className="pt-2 border-t space-y-1.5">
            <p className="text-[10px] text-slate-400 font-bold">الأسئلة المتوفرة بمخزن الغرفة ({customQuestionBank.length + BASE_TRIVIA_QUESTIONS.length}):</p>
            <div className="max-h-24 overflow-y-auto text-[9.5px] space-y-1">
              {customQuestionBank.map((q, i) => (
                <div key={i} className="p-1 bg-white border rounded flex justify-between items-center text-right">
                  <span className="font-bold truncate max-w-[200px]">{q.question}</span>
                  <span className="text-emerald-600 font-mono">يدوي ✓</span>
                </div>
              ))}
              {BASE_TRIVIA_QUESTIONS.slice(0, 5).map((q, i) => (
                <div key={i} className="p-1 bg-slate-100 border rounded flex justify-between items-center text-slate-500 text-right">
                  <span className="truncate max-w-[200px]">{q.question}</span>
                  <span>افتراضي</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- GAME 10: TOURNAMENT MODE ⚔️ --- */}
      {currentGame === "tournament" && (
        <div className="space-y-4 bg-slate-50 border rounded-2xl p-4 text-center">
          <span className="text-[10px] bg-red-100 text-red-800 font-bold px-2.5 py-0.5 rounded-full">شجرة الإقصائيات والبطولة ⚔️</span>
          
          <div className="py-2 space-y-4 max-w-sm mx-auto text-xs text-right">
            {tournamentMatches.map((match) => (
              <div key={match.id} className="border bg-white rounded-xl p-3 space-y-2 shadow-xs">
                <div className="flex justify-between items-center border-b pb-1">
                  <span className="font-bold text-slate-400">{match.round}</span>
                  <Crown className="w-3.5 h-3.5 text-amber-500" />
                </div>
                <div className="flex justify-between items-center">
                  <button
                    onClick={() => {
                      if (role !== "host") return;
                      setTournamentMatches(prev => prev.map(m => m.id === match.id ? { ...m, winner: match.teamA } : m));
                      showToast(`👑 فاز ${match.teamA} وتأهل للدور التالي!`);
                    }}
                    className={`px-2 py-1 rounded-lg border font-black cursor-pointer ${match.winner === match.teamA ? "bg-emerald-500 text-white" : "bg-slate-50 text-slate-700"}`}
                  >
                    {match.teamA}
                  </button>
                  <span className="font-bold text-slate-300">ضد</span>
                  <button
                    onClick={() => {
                      if (role !== "host") return;
                      setTournamentMatches(prev => prev.map(m => m.id === match.id ? { ...m, winner: match.teamB } : m));
                      showToast(`👑 فاز ${match.teamB} وتأهل للدور التالي!`);
                    }}
                    className={`px-2 py-1 rounded-lg border font-black cursor-pointer ${match.winner === match.teamB ? "bg-emerald-500 text-white" : "bg-slate-50 text-slate-700"}`}
                  >
                    {match.teamB}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- GAME 11: DRAW & GUESS 🎨 --- */}
      {currentGame === "drawguess" && (
        <div className="space-y-4 bg-slate-50 border rounded-2xl p-4 text-center">
          <div className="border-b pb-2 flex justify-between items-center">
            <span className="text-[10px] bg-sky-100 text-sky-800 font-bold px-2.5 py-0.5 rounded-full">اللوحة البيضاء للرسم 🎨</span>
            <span className="text-[10px] text-slate-400">الرسام المختار يرسم دون كلام!</span>
          </div>

          <div className="relative w-full h-48 bg-white border-2 border-slate-300 rounded-xl overflow-hidden flex flex-col justify-between">
            {role === "host" || (charadesActor && currentUser.id === charadesActor.id) ? (
              <div className="absolute top-2 right-2 bg-slate-900/85 text-white px-3 py-1 rounded-full text-[9.5px] font-black animate-pulse z-10">
                الكلمة المطلوب رسمها: {drawSecret}
              </div>
            ) : null}

            <div className="flex-1 flex flex-wrap gap-1 p-3 items-center justify-center relative bg-slate-50/50">
              {drawPaths.length === 0 ? (
                <p className="text-[10px] text-slate-400">انقر على السبورة أسفله لإضافة تفاصيل للرسم!</p>
              ) : (
                <div className="w-full h-full flex items-center justify-center font-black text-4xl select-none opacity-40">
                  ✏️🎨✨
                </div>
              )}

              <div className="absolute inset-0 p-4 flex flex-wrap content-start gap-1">
                {drawPaths.map((path, i) => (
                  <span key={i} className="bg-sky-100 text-sky-800 text-[8.5px] font-black px-2 py-0.5 rounded-md border border-sky-200">
                    {path}
                  </span>
                ))}
              </div>
            </div>

            <div className="p-2 border-t bg-slate-50 flex gap-2 justify-between items-center">
              <button
                type="button"
                onClick={() => {
                  const details = ["خط مائل ↗️", "صليب كنسي ✝️", "دائرة القبة ⛪", "حوت نوح 🐋", "تاج ذهبي 👑", "نجمة ميلاد ⭐️"];
                  const randomDetail = details[Math.floor(Math.random() * details.length)];
                  setDrawPaths(prev => [...prev, randomDetail]);
                }}
                className="bg-sky-600 text-white font-black text-[9.5px] px-3 py-1 rounded-lg cursor-pointer"
              >
                ✏️ أضف خط رسم مخصص
              </button>
              
              <button
                type="button"
                onClick={() => setDrawPaths([])}
                className="bg-slate-200 text-slate-700 font-bold text-[9px] px-2.5 py-1 rounded-lg cursor-pointer"
              >
                مسح اللوحة 🗑️
              </button>
            </div>
          </div>

          {role === "participant" && (
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="اكتب تخمينك للرسمة هنا..."
                id="draw-guess-input"
                className="flex-1 p-2 border rounded-xl text-xs text-right"
              />
              <button
                onClick={() => {
                  const guess = (document.getElementById("draw-guess-input") as HTMLInputElement)?.value || "";
                  if (guess.trim() === drawSecret || guess.includes(drawSecret)) {
                    showToast("🎉 أحسنت صنعاً! تخمين صحيح للرسمة الروحية!");
                    if (selfTeamId) handleAdjustPoints(selfTeamId, 30);
                  } else {
                    showToast("❌ ليس الحل الصحيح، حاول مجدداً.");
                  }
                }}
                className="bg-sky-600 text-white font-black text-[10px] px-4 py-2 rounded-xl cursor-pointer"
              >
                تأكيد التخمين
              </button>
            </div>
          )}
        </div>
      )}

      {/* --- GAME 12: RANDOM CHALLENGES 🎯 --- */}
      {currentGame === "randomchallenge" && (
        <div className="space-y-4 bg-slate-50 border rounded-2xl p-4 text-center">
          <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2.5 py-0.5 rounded-full">التحديات العشوائية الفورية 🎯</span>
          
          <div className="bg-white border-2 border-indigo-200 rounded-2xl p-5 space-y-3 shadow-xs">
            <p className="text-xs sm:text-sm font-black text-indigo-950 leading-relaxed">
              {randomChallengeText || "اذكر 5 قديسين شهداء في 10 ثوانٍ فقط!"}
            </p>
          </div>

          {role === "host" && (
            <div className="pt-2 border-t flex gap-2 justify-end">
              <button
                onClick={() => {
                  const randomTeam = Object.keys(room.teams)[Math.floor(Math.random() * Object.keys(room.teams).length)];
                  if (randomTeam) {
                    handleAdjustPoints(randomTeam, 20);
                    showToast(`🎉 كسب الفريق نقاط التحدي الفوري!`);
                  }
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10.5px] font-black px-4 py-2 rounded-xl cursor-pointer"
              >
                ✅ منح نقاط لـ فريق عشوائي (+20)
              </button>
              <button
                onClick={() => {
                  const challenge = SPIRITUAL_RANDOM_CHALLENGES[Math.floor(Math.random() * SPIRITUAL_RANDOM_CHALLENGES.length)];
                  setRandomChallengeText(challenge);
                }}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-black px-3 py-2 rounded-xl cursor-pointer"
              >
                🔄 تحدٍ آخر
              </button>
            </div>
          )}
        </div>
      )}

      {/* --- GAME 13: DAILY EVENT 📅 --- */}
      {currentGame === "dailyevent" && (
        <div className="space-y-4 bg-slate-50 border rounded-2xl p-4 text-right">
          <span className="text-[10px] bg-violet-100 text-violet-800 font-bold px-2.5 py-0.5 rounded-full">بركة اليوم والمناسبة الكنسية 📅</span>
          
          <div className="bg-gradient-to-br from-violet-50 to-violet-100/50 border border-violet-200 rounded-2xl p-5 space-y-3 text-right">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-black text-violet-900">{dailyEventItem.title}</h4>
              <span className="text-[9.5px] text-violet-700 font-mono">
                {new Date().toLocaleDateString("ar-EG", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">{dailyEventItem.desc}</p>
          </div>
        </div>
      )}

      {/* --- GAME 14: TIMELINE ORDER ⏳ --- */}
      {currentGame === "timeline" && (
        <div className="space-y-4 bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 text-right">
          <div className="border-b pb-2 flex justify-between items-center">
            <span className="text-[10px] bg-amber-100 text-amber-800 font-black px-2.5 py-0.5 rounded-full">ترتيب الأحداث التاريخية ⏳</span>
            <span className="text-[10.5px] font-bold text-slate-500">سؤال {timelineIdx + 1} من {TIMELINE_ITEMS.length}</span>
          </div>

          <div className="space-y-3">
            <p className="text-xs sm:text-sm font-black text-slate-800">{TIMELINE_ITEMS[timelineIdx].question}</p>
            
            {/* Steps chosen */}
            <div className="bg-white border border-dashed border-slate-350 p-3.5 rounded-xl space-y-2 min-h-[100px] flex flex-col justify-center">
              {timelineSelected.length === 0 ? (
                <p className="text-[10px] text-slate-400 text-center">اضغط على الأحداث بالأسفل لوضعها في الترتيب الصحيح (من الأقدم للأحدث)</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {timelineSelected.map((item, idx) => (
                    <div key={item.id} className="flex items-center justify-between bg-amber-50 border border-amber-200 p-2 rounded-lg text-xs font-black">
                      <span className="bg-amber-500 text-white rounded-full w-5 h-5 flex items-center justify-center font-mono">{idx + 1}</span>
                      <span className="flex-1 pr-3 text-slate-800">{item.text}</span>
                      <button 
                        onClick={() => setTimelineSelected(prev => prev.filter(x => x.id !== item.id))}
                        className="text-rose-500 hover:text-rose-600 text-[10px] font-bold"
                      >
                        إزالة ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Event options to pick */}
            {timelineSelected.length < 4 && (
              <div className="grid grid-cols-1 gap-2">
                {timelineEvents
                  .filter(e => !timelineSelected.some(s => s.id === e.id))
                  .map(event => (
                    <button
                      key={event.id}
                      onClick={() => setTimelineSelected(prev => [...prev, event])}
                      className="w-full text-right p-2.5 bg-white border border-slate-200 hover:border-amber-400 hover:bg-amber-50/20 rounded-xl text-xs font-bold transition-all"
                    >
                      {event.text}
                    </button>
                  ))}
              </div>
            )}

            {/* Validation & explanation */}
            {timelineSelected.length === 4 && timelineSolved === null && (
              <button
                onClick={() => {
                  const correct = timelineSelected.every((item, idx) => item.order === idx + 1);
                  setTimelineSolved(correct);
                  if (correct) {
                    showToast("🎉 كيرياليسون! الترتيب صحيح تماماً! بركة روحية ممتازة.");
                    if (selfTeamId) handleAdjustPoints(selfTeamId, 30);
                  } else {
                    showToast("❌ للأسف الترتيب خاطئ! راجع التواريخ والأحداث وحاول مجدداً.");
                  }
                }}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs rounded-xl transition-all shadow-sm"
              >
                تأكيد ومراجعة الترتيب 🔑
              </button>
            )}

            {timelineSolved !== null && (
              <div className={`p-4 rounded-xl border text-xs leading-relaxed space-y-2 ${
                timelineSolved 
                  ? "bg-emerald-50 border-emerald-300 text-emerald-950" 
                  : "bg-rose-50 border-rose-300 text-rose-950"
              }`}>
                <div className="flex items-center gap-1.5 font-black">
                  {timelineSolved ? <Check className="w-4 h-4 text-emerald-600" /> : <X className="w-4 h-4 text-rose-600" />}
                  <span>{timelineSolved ? "✓ أحسنت! الترتيب التاريخي صحيح بنسبة 100%" : "✕ الترتيب الحالي غير متطابق تاريخياً"}</span>
                </div>
                
                {timelineSolved ? (
                  <p className="text-[10.5px]"><strong>توضيح تاريخي:</strong> {TIMELINE_ITEMS[timelineIdx].explanation}</p>
                ) : (
                  <button
                    onClick={() => {
                      setTimelineSelected([]);
                      setTimelineSolved(null);
                    }}
                    className="mt-2 px-3 py-1 bg-white border border-rose-300 hover:bg-rose-50 text-rose-700 rounded-lg text-[10px] font-black"
                  >
                    إعادة المحاولة 🔄
                  </button>
                )}
              </div>
            )}

            {/* Next / Prev Controls */}
            <div className="flex justify-between items-center pt-3 border-t">
              <button
                disabled={timelineIdx === 0}
                onClick={() => setTimelineIdx(prev => prev - 1)}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 disabled:opacity-40 text-slate-700 rounded-lg text-[10px] font-black transition-all"
              >
                السابق
              </button>
              <button
                disabled={timelineIdx === TIMELINE_ITEMS.length - 1}
                onClick={() => setTimelineIdx(prev => prev + 1)}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 disabled:opacity-40 text-slate-700 rounded-lg text-[10px] font-black transition-all"
              >
                التحدي التالي
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- GAME 15: VERSE MATCH 🔗 --- */}
      {currentGame === "versematch" && (
        <div className="space-y-4 bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 text-right">
          <div className="border-b pb-2 flex justify-between items-center">
            <span className="text-[10px] bg-sky-100 text-sky-800 font-black px-2.5 py-0.5 rounded-full">تطابق الآيات والشواهد 🔗</span>
            <span className="text-[10px] font-bold text-slate-400">طابق الآية بشاهدها الصحيح للحصول على +30 نقطة!</span>
          </div>

          {completedMatches.length === VERSE_MATCH_ITEMS.length ? (
            <div className="bg-emerald-50 border-2 border-emerald-300 p-5 rounded-2xl text-center space-y-3 animate-fade-in">
              <Sparkles className="w-8 h-8 text-emerald-600 mx-auto animate-bounce" />
              <h4 className="text-sm font-black text-emerald-800">🎉 مبارك! لقد قمت بمطابقة كافة الآيات بالشواهد بدقة متناهية!</h4>
              <p className="text-[10.5px] text-slate-600 leading-normal">تمت إضافة +30 نقطة مباركة لفريقك الروحي ✨</p>
              <button
                onClick={() => {
                  const verses = VERSE_MATCH_ITEMS.map(item => item.verse).sort(() => Math.random() - 0.5);
                  const refs = VERSE_MATCH_ITEMS.map(item => item.reference).sort(() => Math.random() - 0.5);
                  setShuffledVerses(verses);
                  setShuffledRefs(refs);
                  setCompletedMatches([]);
                  setSelectedVerse(null);
                  setSelectedRef(null);
                }}
                className="mt-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black cursor-pointer"
              >
                اللعب مرة أخرى 🔄
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold">
                <span>تطابق حتى الآن: {completedMatches.length} من {VERSE_MATCH_ITEMS.length}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Column 1: Verses */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 block border-b pb-1">الآية الروحية 📖</span>
                  <div className="flex flex-col gap-1.5">
                    {shuffledVerses.map(v => {
                      const isMatched = completedMatches.includes(v);
                      const isChosen = selectedVerse === v;
                      return (
                        <button
                          key={v}
                          disabled={isMatched}
                          onClick={() => {
                            setSelectedVerse(v);
                            // Check if matched right away if reference was selected
                            if (selectedRef) {
                              const match = VERSE_MATCH_ITEMS.find(item => item.verse === v && item.reference === selectedRef);
                              if (match) {
                                showToast(`✓ صحيح! آية مباركة وشاهد متطابق.`);
                                setCompletedMatches(prev => [...prev, v]);
                                if (completedMatches.length + 1 === VERSE_MATCH_ITEMS.length && selfTeamId) {
                                  handleAdjustPoints(selfTeamId, 30);
                                }
                              } else {
                                showToast(`❌ الشاهد غير متطابق مع الآية، حاول مجدداً.`);
                              }
                              setSelectedVerse(null);
                              setSelectedRef(null);
                            }
                          }}
                          className={`w-full text-right p-2.5 rounded-xl border text-[11px] font-bold leading-normal transition-all ${
                            isMatched
                              ? "bg-emerald-50 border-emerald-200 text-emerald-400 cursor-not-allowed line-through"
                              : isChosen
                                ? "bg-sky-100 border-sky-400 text-sky-900 scale-[0.98]"
                                : "bg-white border-slate-200 hover:border-sky-300"
                          }`}
                        >
                          "{v}"
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Column 2: References */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 block border-b pb-1">الشاهد الروحي 🔗</span>
                  <div className="flex flex-col gap-1.5">
                    {shuffledRefs.map(ref => {
                      const originMatch = VERSE_MATCH_ITEMS.find(item => item.reference === ref);
                      const isMatched = originMatch ? completedMatches.includes(originMatch.verse) : false;
                      const isChosen = selectedRef === ref;
                      return (
                        <button
                          key={ref}
                          disabled={isMatched}
                          onClick={() => {
                            setSelectedRef(ref);
                            // Check match right away
                            if (selectedVerse) {
                              const match = VERSE_MATCH_ITEMS.find(item => item.verse === selectedVerse && item.reference === ref);
                              if (match) {
                                showToast(`✓ صحيح! آية مباركة وشاهد متطابق.`);
                                setCompletedMatches(prev => [...prev, selectedVerse]);
                                if (completedMatches.length + 1 === VERSE_MATCH_ITEMS.length && selfTeamId) {
                                  handleAdjustPoints(selfTeamId, 30);
                                }
                              } else {
                                showToast(`❌ الشاهد غير متطابق مع الآية، حاول مجدداً.`);
                              }
                              setSelectedVerse(null);
                              setSelectedRef(null);
                            }
                          }}
                          className={`w-full text-center p-2.5 rounded-xl border text-[11px] font-black transition-all ${
                            isMatched
                              ? "bg-emerald-50 border-emerald-200 text-emerald-400 cursor-not-allowed line-through"
                              : isChosen
                                ? "bg-sky-100 border-sky-400 text-sky-900 scale-[0.98]"
                                : "bg-white border-slate-200 hover:border-sky-300"
                          }`}
                        >
                          {ref}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- GAME 16: CHURCH SACRAMENTS ⛪ --- */}
      {currentGame === "sacraments" && (
        <div className="space-y-4 bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 text-right">
          <div className="border-b pb-2 flex justify-between items-center">
            <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2.5 py-0.5 rounded-full">أسرار الكنيسة السبعة ⛪</span>
            <span className="text-[10px] font-bold text-slate-400">انقر على السر المقدس للإبحار والإجابة</span>
          </div>

          {/* Grid of Sacraments */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {SACRAMENTS_QUESTIONS.map((item, idx) => {
              const isActive = sacramentIdx === idx;
              return (
                <button
                  key={item.sacrament}
                  onClick={() => setSacramentIdx(idx)}
                  className={`p-3 rounded-2xl border text-right transition-all flex flex-col justify-between h-[85px] group cursor-pointer ${
                    isActive
                      ? "bg-gradient-to-tr from-[#C5A059] to-amber-400 border-amber-600 text-slate-950 font-black shadow-md scale-[1.01]"
                      : "bg-white hover:bg-amber-50/20 border-slate-200 text-slate-800"
                  }`}
                >
                  <div className="flex justify-between items-center w-full">
                    <span className={isActive ? "text-slate-950 text-base" : "text-amber-600 group-hover:text-amber-500 text-base"}>
                      ⛪
                    </span>
                    <span className="text-[8.5px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">سر #{idx + 1}</span>
                  </div>
                  <div>
                    <h5 className="text-[10px] font-black line-clamp-1">{item.sacrament.split(" ")[1] || item.sacrament}</h5>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selected Sacrament Details & Question */}
          <div className="bg-white border rounded-2xl p-4 space-y-3.5">
            <div className="border-b pb-2">
              <h4 className="text-xs sm:text-sm font-black text-[#0A2342] flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-amber-500" />
                {SACRAMENTS_QUESTIONS[sacramentIdx].sacrament}
              </h4>
              <p className="text-[10px] text-slate-400 mt-1">{SACRAMENTS_QUESTIONS[sacramentIdx].description}</p>
            </div>

            <div className="space-y-3">
              <span className="text-[10px] font-extrabold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">سؤال السر اللاهوتي:</span>
              <p className="text-xs sm:text-sm font-black text-slate-800 leading-relaxed">{SACRAMENTS_QUESTIONS[sacramentIdx].question}</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SACRAMENTS_QUESTIONS[sacramentIdx].options.map((opt, i) => {
                  const isCorrect = i === SACRAMENTS_QUESTIONS[sacramentIdx].correctIdx;
                  return (
                    <button
                      key={opt}
                      disabled={sacramentAnswered}
                      onClick={() => {
                        setSacramentAnswer(i);
                        setSacramentAnswered(true);
                        if (isCorrect) {
                          showToast("🎉 إجابة روحية موفقة تماماً! نلت بركة السر الكنسي.");
                          if (selfTeamId) handleAdjustPoints(selfTeamId, 25);
                        } else {
                          showToast("❌ للأسف إجابة غير صحيحة، حاول اختيار الخيار اللاهوتي الأدق.");
                        }
                      }}
                      className={`w-full text-right p-3 rounded-xl border text-[11px] font-bold transition-all flex items-center justify-between cursor-pointer ${
                        sacramentAnswered
                          ? i === sacramentAnswer
                            ? isCorrect
                              ? "bg-emerald-500 border-emerald-600 text-white font-black"
                              : "bg-rose-500 border-rose-600 text-white font-black"
                            : isCorrect
                              ? "bg-emerald-50 border-emerald-200 text-emerald-800 font-bold"
                              : "bg-slate-50 border-slate-200 text-slate-400"
                          : "bg-slate-50 border-slate-150 hover:border-amber-400 hover:bg-amber-50/10"
                      }`}
                    >
                      <span>{opt}</span>
                      {sacramentAnswered && isCorrect && <Check className="w-3.5 h-3.5" />}
                      {sacramentAnswered && i === sacramentAnswer && !isCorrect && <X className="w-3.5 h-3.5" />}
                    </button>
                  );
                })}
              </div>

              {sacramentAnswered && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[10.5px] leading-relaxed text-amber-950 animate-fade-in">
                  <strong>💡 تأمل لاهوتي وكنسي:</strong> {SACRAMENTS_QUESTIONS[sacramentIdx].insight}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- GAME 17: SPEED TYPER ✍️ --- */}
      {currentGame === "typeverse" && (
        <div className="space-y-4 bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 text-right">
          <div className="border-b pb-2 flex justify-between items-center">
            <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2.5 py-0.5 rounded-full">سباق كتابة الآية المفقودة ✍️</span>
            <span className="text-[10px] font-bold text-slate-400">اكتب الكلمة المفقودة بدقة وسرعة قبل انتهاء الوقت!</span>
          </div>

          <div className="bg-white border rounded-2xl p-4 space-y-4 relative overflow-hidden">
            {/* Visual timer countdown */}
            <div className="absolute top-0 right-0 left-0 h-1.5 bg-slate-100">
              <div 
                className={`h-full transition-all duration-1000 ${typeTimer < 8 ? "bg-rose-500 animate-pulse" : "bg-indigo-500"}`}
                style={{ width: `${(typeTimer / 25) * 100}%` }}
              />
            </div>

            <div className="flex justify-between items-center pt-1.5 text-[10px] text-slate-500 font-bold">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                الوقت المتبقي: {typeTimer} ثانية
              </span>
              <span>تحدي {typeVerseIdx + 1} من {TYPE_VERSE_ITEMS.length}</span>
            </div>

            <div className="text-center py-4 space-y-2">
              <p className="text-base sm:text-lg font-black text-[#0A2342] tracking-wide leading-relaxed">
                "{TYPE_VERSE_ITEMS[typeVerseIdx].verseWithGap}"
              </p>
              <span className="text-[11px] text-amber-600 font-black">({TYPE_VERSE_ITEMS[typeVerseIdx].reference})</span>
            </div>

            {typeSuccess === null ? (
              <div className="flex gap-2.5">
                <input
                  type="text"
                  placeholder="اكتب الكلمة المفقودة هنا بدقة..."
                  value={typeInput}
                  onChange={(e) => setTypeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const trimmed = typeInput.trim();
                      const target = TYPE_VERSE_ITEMS[typeVerseIdx].missingWord;
                      if (trimmed === target || target.includes(trimmed)) {
                        setTypeSuccess(true);
                        showToast("🎉 يا للروعة! كتابة دقيقة وسريعة للآية المباركة!");
                        if (selfTeamId) handleAdjustPoints(selfTeamId, 35);
                      } else {
                        setTypeSuccess(false);
                        showToast("❌ الكلمة غير صحيحة، حاول مجدداً مع التحدي اللاحق.");
                      }
                    }
                  }}
                  className="flex-1 p-2.5 border-2 border-indigo-200 focus:border-indigo-500 rounded-xl text-xs text-center font-bold text-slate-800"
                />
                <button
                  onClick={() => {
                    const trimmed = typeInput.trim();
                    const target = TYPE_VERSE_ITEMS[typeVerseIdx].missingWord;
                    if (trimmed === target || target.includes(trimmed)) {
                      setTypeSuccess(true);
                      showToast("🎉 يا للروعة! كتابة دقيقة وسريعة للآية المباركة!");
                      if (selfTeamId) handleAdjustPoints(selfTeamId, 35);
                    } else {
                      setTypeSuccess(false);
                      showToast("❌ الكلمة غير صحيحة، حاول مجدداً مع التحدي اللاحق.");
                    }
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10.5px] font-black px-4 py-2 rounded-xl transition-all shadow-sm cursor-pointer"
                >
                  تأكيد الكلمة ✍️
                </button>
              </div>
            ) : (
              <div className={`p-4 rounded-xl border text-center space-y-2 animate-fade-in ${
                typeSuccess 
                  ? "bg-emerald-50 border-emerald-300 text-emerald-950 font-bold" 
                  : "bg-rose-50 border-rose-300 text-rose-950 font-bold"
              }`}>
                <h4 className="text-xs font-black">
                  {typeSuccess ? "✓ إنجاز رائع ومبهر!" : "✕ انتهى الوقت أو الإجابة خاطئة!"}
                </h4>
                <p className="text-[11px] text-slate-700 font-bold">
                  الآية الكاملة: <strong>"{TYPE_VERSE_ITEMS[typeVerseIdx].fullVerse}"</strong>
                </p>
                <p className="text-[10px] text-slate-500">الكلمة الصحيحة كانت: <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-black font-mono">{TYPE_VERSE_ITEMS[typeVerseIdx].missingWord}</span></p>
              </div>
            )}

            {/* Next controls */}
            <div className="flex justify-end pt-2 border-t">
              <button
                disabled={typeVerseIdx === TYPE_VERSE_ITEMS.length - 1}
                onClick={() => setTypeVerseIdx(prev => prev + 1)}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 disabled:opacity-40 text-slate-700 rounded-lg text-[10px] font-black transition-all"
              >
                الآية التالية ➡️
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
