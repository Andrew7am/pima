import React from "react";
import { Zap, Timer, Award, CheckCircle, XCircle, AlertCircle, HelpCircle } from "lucide-react";
import { motion } from "motion/react";

interface SpeedChallengeModuleProps {
  role: "host" | "participant";
  room: any;
  currentQuestionIndex: number;
  currentRoundQuizQuestions: any[];
  hasSubmittedAnswer: boolean;
  selectedOptionIdx: number | null;
  handlePlayerSubmitAnswer: (idx: number) => void;
  handleAdjustPoints: (teamId: string, pts: number) => void;
  speedMultiplier: number; // decayed from 50 to 10
  showToast: (msg: string) => void;
  currentUser: any;
}

export const SpeedChallengeModule: React.FC<SpeedChallengeModuleProps> = ({
  role,
  room,
  currentQuestionIndex,
  currentRoundQuizQuestions,
  hasSubmittedAnswer,
  selectedOptionIdx,
  handlePlayerSubmitAnswer,
  handleAdjustPoints,
  speedMultiplier,
  showToast,
  currentUser,
}) => {
  const currentQuestion = currentRoundQuizQuestions[currentQuestionIndex];
  const selfPlayer = room?.players?.find((p: any) => p.id === currentUser.id);
  const selfTeamId = selfPlayer?.teamId;

  if (!currentQuestion) {
    return (
      <div className="text-center py-8 text-slate-400 font-bold">
        🔄 بنعمة الله، جاري تحميل تحدي السرعة...
      </div>
    );
  }

  // Calculate final score awarded: base points (e.g. 25) + the speed multiplier (between 10 and 50)
  const basePoints = 25;
  const totalAwardedPoints = basePoints + speedMultiplier;

  return (
    <motion.div
      id="speed-challenge-container"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="space-y-5 text-right"
    >
      {/* Module Title Banner */}
      <div className="bg-gradient-to-l from-red-500/10 via-amber-500/5 to-transparent border-r-4 border-red-500 p-3 rounded-l-2xl flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-red-500 animate-pulse" />
          <div>
            <h3 className="text-xs sm:text-sm font-black text-slate-800">تحدي السرعة (Speed Challenge)</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">كل ما تجاوب أسرع، تكسب نقاط أكتر وفيرة!</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Decaying Points Badge */}
          <div className="bg-red-500 text-white font-mono font-black text-[10.5px] px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm">
            <Award className="w-3.5 h-3.5" />
            <span>+{totalAwardedPoints} ن</span>
          </div>
        </div>
      </div>

      {/* Visual decaying score multiplier progress bar */}
      <div className="bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200">
        <motion.div
          id="speed-multiplier-progress-bar"
          initial={{ width: "100%" }}
          animate={{ width: `${((speedMultiplier - 10) / 40) * 100}%` }}
          transition={{ duration: 0.1 }}
          className="h-full bg-gradient-to-r from-red-500 via-orange-500 to-amber-500"
        />
      </div>

      <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold px-1">
        <span>⚡ مكافأة السرعة الأدنى: +10ن</span>
        <span>🔥 مكافأة السرعة الحالية: +{speedMultiplier}ن</span>
        <span>⚡ مكافأة السرعة القصوى: +50ن</span>
      </div>

      {/* Question Card */}
      <div className="bg-white border-2 border-red-100 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3 relative overflow-hidden">
        <div className="absolute top-0 left-0 bg-red-50 px-2 py-0.5 text-[8.5px] font-black text-red-700 rounded-br-lg">
          سؤال السرعة
        </div>
        <p className="text-xs sm:text-sm font-black text-slate-800 whitespace-pre-line leading-relaxed pt-1">
          {currentQuestion.question}
        </p>
      </div>

      {/* Answer Options */}
      <div className="space-y-2.5">
        <span className="text-[10.5px] font-bold text-slate-400 block pr-1">
          💡 اختر الإجابة الصحيحة بأقصى سرعة:
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
                    if (isCorrectAns && selfTeamId) {
                      handleAdjustPoints(selfTeamId, totalAwardedPoints);
                      showToast(`⚡ إجابة ممتازة وسريعة! كسبت +${totalAwardedPoints} نقطة لفريقك!`);
                    }
                  }}
                  variants={{
                    hidden: { opacity: 0, y: 15 },
                    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 20 } }
                  }}
                  whileHover={!hasSubmittedAnswer ? { scale: 1.01, backgroundColor: "#fef2f2" } : {}}
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
                          : "bg-red-500 text-white border-red-600 shadow-sm"
                        : isCorrectAns
                          ? "bg-emerald-100 border-emerald-300 text-emerald-800 font-bold"
                          : "bg-slate-50 border-slate-200 text-slate-400"
                      : isSelected
                        ? "bg-red-50 border-red-400 text-red-950 scale-[1.01] shadow-3xs"
                        : "bg-white border-slate-200 hover:border-red-400 hover:bg-red-50/10 hover:shadow-3xs"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full border border-slate-300 flex items-center justify-center text-[8px] font-black font-mono">
                      {idx === 0 ? "A" : idx === 1 ? "B" : idx === 2 ? "C" : "D"}
                    </span>
                    <span>{opt}</span>
                  </span>
                  {hasSubmittedAnswer && isCorrectAns && <CheckCircle className="w-4 h-4 text-white" />}
                  {hasSubmittedAnswer && isSelected && !isCorrectAns && <XCircle className="w-4 h-4 text-white" />}
                </motion.button>
              );
            })}
          </motion.div>
        ) : (
          /* Host View */
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {currentQuestion.options.map((opt: string, idx: number) => {
              const isCorrectAns = idx === currentQuestion.correctIdx;
              return (
                <div
                  key={opt}
                  className={`p-3 rounded-xl text-xs font-black border flex justify-between ${
                    isCorrectAns
                      ? "bg-emerald-50 text-emerald-800 border-emerald-300 shadow-3xs"
                      : "bg-slate-50 text-slate-500 border-slate-200"
                  }`}
                >
                  <span>{opt}</span>
                  {isCorrectAns && <span className="text-[10px] text-emerald-600 font-bold">الإجابة النموذجية ✓</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Explanation card */}
      {(hasSubmittedAnswer || role === "host") && currentQuestion.explanation && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-4 text-xs leading-relaxed text-amber-900 text-right"
        >
          <div className="flex items-center gap-1.5 border-b border-amber-200 pb-2 mb-2 font-black">
            <HelpCircle className="w-4 h-4 text-amber-700" />
            <span>تأمل كنسي مفسر وتفسير الآية:</span>
          </div>
          <p className="font-semibold text-[11.5px]">{currentQuestion.explanation}</p>
        </motion.div>
      )}
    </motion.div>
  );
};
