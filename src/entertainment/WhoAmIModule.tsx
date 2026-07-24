import React, { useState, useEffect } from "react";
import { HelpCircle, Sparkles, ChevronLeft, ChevronRight, Award, AlertCircle, CheckCircle2, UserCheck } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface WhoAmIModuleProps {
  role: "host" | "participant";
  room: any;
  currentQuestionIndex: number;
  currentRoundQuizQuestions: any[];
  hasSubmittedAnswer: boolean;
  selectedOptionIdx: number | null;
  handlePlayerSubmitAnswer: (idx: number) => void;
  handleAdjustPoints: (teamId: string, pts: number) => void;
  sendWSMessage: (msg: any) => void;
  showToast: (msg: string) => void;
  currentUser: any;
}

export const WhoAmIModule: React.FC<WhoAmIModuleProps> = ({
  role,
  room,
  currentQuestionIndex,
  currentRoundQuizQuestions,
  hasSubmittedAnswer,
  selectedOptionIdx,
  handlePlayerSubmitAnswer,
  handleAdjustPoints,
  sendWSMessage,
  showToast,
  currentUser,
}) => {
  const currentQuestion = currentRoundQuizQuestions[currentQuestionIndex];
  const selfPlayer = room?.players?.find((p: any) => p.id === currentUser.id);
  const selfTeamId = selfPlayer?.teamId;

  // Split clues by newline if it's a long string containing bullet points, or use as array
  const clues: string[] = React.useMemo(() => {
    if (!currentQuestion) return [];
    const questionText = currentQuestion.question || "";
    // If it contains lines starting with •, split them
    if (questionText.includes("•")) {
      return questionText
        .split("\n")
        .filter((line: string) => line.trim().startsWith("•"))
        .map((line: string) => line.replace("•", "").trim());
    }
    // Fallback: split by newline and filter out title
    return questionText
      .split("\n")
      .filter((line: string) => line.trim() && !line.includes("خمن الشخصية"));
  }, [currentQuestion]);

  // Track revealed clues index
  const [revealedCount, setRevealedCount] = useState<number>(1);

  // Automatically reset revealed clues when question changes
  useEffect(() => {
    setRevealedCount(1);
  }, [currentQuestionIndex]);

  if (!currentQuestion) {
    return (
      <div className="text-center py-8 text-slate-400 font-bold">
        🔄 بنعمة الله، جاري تحميل لغز "مين أنا" ...
      </div>
    );
  }

  const isCorrect = selectedOptionIdx === currentQuestion.correctIdx;

  // Calculate potential points based on how many clues were revealed before answering
  const calculatePotentialPoints = (cluesUsed: number) => {
    if (cluesUsed <= 1) return 50;
    if (cluesUsed === 2) return 35;
    return 20;
  };

  const currentPointsReward = calculatePotentialPoints(revealedCount);

  // Host handler to reveal next clue
  const handleRevealNextClue = () => {
    if (revealedCount < clues.length) {
      setRevealedCount((prev) => prev + 1);
      showToast("💡 تم الكشف عن قرينة كنسية جديدة للجميع!");
    } else {
      showToast("📢 تم كشف جميع القرائن المتاحة بالفعل!");
    }
  };

  return (
    <motion.div
      id="whoami-module-container"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="space-y-5 text-right"
    >
      {/* Module Title Banner */}
      <div className="bg-gradient-to-l from-amber-500/10 via-amber-500/5 to-transparent border-r-4 border-amber-500 p-3 rounded-l-2xl flex justify-between items-center">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-amber-500 animate-bounce" />
          <div>
            <h3 className="text-xs sm:text-sm font-black text-slate-800">مين أنا؟ (Who Am I)</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">تخمين الشخصية المقدسة بالقرائن المتتالية</p>
          </div>
        </div>
        <div className="bg-amber-100 text-amber-800 font-black text-[10px] px-2.5 py-1 rounded-full flex items-center gap-1">
          <Award className="w-3.5 h-3.5" />
          <span>مكافأة الحل الحالي: {currentPointsReward} ن</span>
        </div>
      </div>

      {/* Clues Card Stack */}
      <div className="bg-white border-2 border-amber-200/50 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
        <span className="text-[10.5px] font-bold text-slate-400 block border-b pb-1.5">
          📋 القرائن والشواهد الكنسية المكشوفة ({revealedCount} من أصل {clues.length}):
        </span>

        <div className="space-y-2.5">
          <AnimatePresence mode="popLayout">
            {clues.slice(0, revealedCount).map((clue, idx) => (
              <motion.div
                key={clue}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.1 }}
                className="bg-amber-50/40 border border-amber-100 p-3 rounded-xl flex items-start gap-2 text-right"
              >
                <span className="bg-amber-400 text-slate-900 w-5 h-5 rounded-full flex items-center justify-center font-black text-[10px] shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                <p className="text-xs font-bold text-slate-700 leading-relaxed">
                  {clue}
                </p>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Clue Controllers */}
        <div className="flex justify-between items-center pt-2">
          {role === "host" ? (
            <button
              onClick={handleRevealNextClue}
              disabled={revealedCount >= clues.length}
              className="py-1.5 px-4 bg-slate-900 hover:bg-slate-800 text-white disabled:opacity-40 text-[10px] font-black rounded-lg transition-all flex items-center gap-1 cursor-pointer"
            >
              <span>🔍 كشف قرينة تالية</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            </button>
          ) : (
            <div className="text-[9.5px] text-slate-400 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
              <span>يقوم الخادم بكشف قرائن إضافية تدريجياً لتبسيط اللغز.</span>
            </div>
          )}

          <div className="text-[10px] text-slate-400 font-black">
            السؤال {room.currentQuestionIndex + 1} من أصل {currentRoundQuizQuestions.length}
          </div>
        </div>
      </div>

      {/* Answer Options Grid */}
      <div className="space-y-2.5">
        <span className="text-[10.5px] font-bold text-slate-400 block pr-1">
          💡 اختر اسم الشخصية الصحيحة من الخيارات:
        </span>

        {role === "participant" ? (
          <motion.div 
            className="grid grid-cols-1 sm:grid-cols-2 gap-3"
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
            {currentQuestion.options.map((opt: string, idx: number) => {
              const isSelected = idx === selectedOptionIdx;
              const isCorrectAns = idx === currentQuestion.correctIdx;
              return (
                <motion.button
                  key={opt}
                  type="button"
                  disabled={hasSubmittedAnswer}
                  onClick={() => {
                    handlePlayerSubmitAnswer(idx);
                    // Add potential rewards manually based on revealed clues
                    if (isCorrectAns && selfTeamId) {
                      handleAdjustPoints(selfTeamId, currentPointsReward);
                    }
                  }}
                  variants={{
                    hidden: { opacity: 0, y: 15 },
                    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 20 } }
                  }}
                  whileHover={!hasSubmittedAnswer ? { scale: 1.01, backgroundColor: "#fffbeb" } : {}}
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
                      ? isSelected
                        ? isCorrectAns
                          ? "bg-emerald-500 text-white border-emerald-600 shadow-md"
                          : "bg-red-500 text-white border-red-600 shadow-md"
                        : isCorrectAns
                          ? "bg-emerald-100 border-emerald-300 text-emerald-800"
                          : "bg-slate-50 border-slate-200 text-slate-400"
                      : isSelected
                        ? "bg-amber-50 border-amber-400 text-amber-950 scale-[1.01] shadow-3xs"
                        : "bg-white border-slate-200 hover:border-amber-400 hover:bg-amber-50/10 hover:shadow-xs"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full border border-slate-300 flex items-center justify-center text-[8px] font-black font-mono">
                      {idx + 1}
                    </span>
                    <span>{opt}</span>
                  </span>
                  {hasSubmittedAnswer && isCorrectAns && <CheckCircle2 className="w-4 h-4 text-white" />}
                </motion.button>
              );
            })}
          </motion.div>
        ) : (
          /* Host View */
          <div className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {currentQuestion.options.map((opt: string, idx: number) => {
                const isCorrectAns = idx === currentQuestion.correctIdx;
                return (
                  <div
                    key={opt}
                    className={`p-3 rounded-xl text-xs font-black border flex items-center justify-between ${
                      isCorrectAns
                        ? "bg-emerald-50 text-emerald-800 border-emerald-300 shadow-3xs"
                        : "bg-slate-50 text-slate-500 border-slate-200"
                    }`}
                  >
                    <span>{opt}</span>
                    {isCorrectAns && <UserCheck className="w-4 h-4 text-emerald-600" />}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Explanation Details */}
      {(hasSubmittedAnswer || role === "host") && currentQuestion.explanation && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-amber-50/80 border-2 border-amber-200/60 rounded-xl p-4 text-xs leading-relaxed text-amber-950 shadow-3xs text-right"
        >
          <div className="flex items-center gap-1.5 border-b border-amber-200/55 pb-2 mb-2 font-black">
            <Sparkles className="w-4 h-4 text-amber-600" />
            <span>التأمل الروحي والتفسير العقائدي:</span>
          </div>
          <p className="font-medium text-[11.5px]">{currentQuestion.explanation}</p>
        </motion.div>
      )}
    </motion.div>
  );
};
