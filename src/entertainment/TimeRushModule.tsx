import React, { useState, useEffect } from "react";
import { Timer, Zap, Play, Award, CheckCircle, XCircle, ChevronLeft, Volume2, Sparkles, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface TimeRushModuleProps {
  role: "host" | "participant";
  room: any;
  currentQuestionIndex: number;
  currentRoundQuizQuestions: any[];
  handlePlayerSubmitAnswer: (idx: number) => void;
  handleAdjustPoints: (teamId: string, pts: number) => void;
  timeRushCorrect: number;
  timeRushTotal: number;
  setTimeRushCorrect: React.Dispatch<React.SetStateAction<number>>;
  setTimeRushTotal: React.Dispatch<React.SetStateAction<number>>;
  showToast: (msg: string) => void;
  currentUser: any;
  sendWSMessage: (msg: any) => void;
}

export const TimeRushModule: React.FC<TimeRushModuleProps> = ({
  role,
  room,
  currentQuestionIndex,
  currentRoundQuizQuestions,
  handlePlayerSubmitAnswer,
  handleAdjustPoints,
  timeRushCorrect,
  timeRushTotal,
  setTimeRushCorrect,
  setTimeRushTotal,
  showToast,
  currentUser,
  sendWSMessage,
}) => {
  const selfPlayer = room?.players?.find((p: any) => p.id === currentUser.id);
  const selfTeamId = selfPlayer?.teamId;

  // Track current local question index specifically for rapid-fire
  const [localIndex, setLocalIndex] = useState<number>(0);
  const [answeredLocal, setAnsweredLocal] = useState<boolean>(false);
  const [selectedLocalIdx, setSelectedLocalIdx] = useState<number | null>(null);

  // Remaining questions array specifically for the time rush pool
  const rushQuestions = currentRoundQuizQuestions;

  const currentQuestion = rushQuestions[localIndex];

  // Auto transition to the next rapid fire question after a quick delay when answered
  const handleAnswerLocal = (idx: number) => {
    if (answeredLocal) return;

    setSelectedLocalIdx(idx);
    setAnsweredLocal(true);
    setTimeRushTotal((prev) => prev + 1);

    const isCorrect = idx === currentQuestion.correctIdx;

    if (isCorrect) {
      setTimeRushCorrect((prev) => prev + 1);
      if (selfTeamId) {
        // Award points immediately to the team (+15 per correct rapid question)
        handleAdjustPoints(selfTeamId, 15);
      }
    }

    // Quick delay of 750ms to let the feedback sink in, then advance to the next rapid fire question!
    setTimeout(() => {
      setAnsweredLocal(false);
      setSelectedLocalIdx(null);
      if (localIndex + 1 < rushQuestions.length) {
        setLocalIndex((prev) => prev + 1);
      } else {
        // Loop back or reset pool if we run out of questions in rapid fire
        setLocalIndex(0);
      }
    }, 750);
  };

  if (!currentQuestion) {
    return (
      <div className="text-center py-8 text-slate-400 font-bold">
        🔄 بنعمة الله، جاري تحميل أسئلة سباق الوقت...
      </div>
    );
  }

  return (
    <motion.div
      id="timerush-challenge-container"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="space-y-5 text-right"
    >
      {/* Module Title Banner */}
      <div className="bg-gradient-to-l from-blue-500/10 via-[#FAF8F5]/5 to-transparent border-r-4 border-blue-500 p-3.5 rounded-l-2xl flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Timer className="w-5 h-5 text-blue-500 animate-spin-slow" />
          <div>
            <h3 className="text-xs sm:text-sm font-black text-slate-800">سباق الوقت السريع (Time Rush)</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">أكبر عدد من الإجابات الصحيحة في دقيقة واحدة متواصلة!</p>
          </div>
        </div>

        {/* Quick statistics display */}
        <div className="flex gap-2">
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-black px-2.5 py-1.5 rounded-xl flex items-center gap-1 shrink-0">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
            <span>صحيحة: {timeRushCorrect}</span>
          </div>
          <div className="bg-blue-50 border border-blue-200 text-blue-800 text-[10px] font-black px-2.5 py-1.5 rounded-xl flex items-center gap-1 shrink-0">
            <Zap className="w-3.5 h-3.5 text-blue-600" />
            <span>محاولات: {timeRushTotal}</span>
          </div>
        </div>
      </div>

      {/* Progress metrics */}
      <div className="bg-blue-50/50 rounded-xl p-3 border border-blue-100/60 flex justify-between items-center">
        <div className="flex items-center gap-1 text-[10.5px] font-black text-blue-900">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>كسبت فريقك +{timeRushCorrect * 15}ن حتى الآن!</span>
        </div>
        <div className="text-[10px] text-slate-400 font-bold">
          السؤال الحالي: #{localIndex + 1}
        </div>
      </div>

      {/* Slide-in Animated Question Panel */}
      <div className="relative overflow-hidden min-h-[90px] flex items-center justify-center bg-white border-2 border-blue-100 rounded-2xl p-4 shadow-3xs">
        <AnimatePresence mode="wait">
          <motion.div
            key={localIndex}
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            transition={{ duration: 0.25 }}
            className="w-full space-y-1"
          >
            <span className="text-[9px] bg-blue-100 text-blue-800 font-black px-2 py-0.5 rounded-full">
              سؤال سريع بمكافأة مضاعفة
            </span>
            <p className="text-xs sm:text-sm font-black text-slate-800 leading-relaxed pt-1">
              {currentQuestion.question}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Answer Options Grid */}
      <div className="space-y-2.5">
        <span className="text-[10.5px] font-bold text-slate-400 block pr-1">
          💡 انقر فوراً على الخيار لتسجيل الإجابة والمتابعة:
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
              const isSelected = idx === selectedLocalIdx;
              const isCorrectAns = idx === currentQuestion.correctIdx;
              return (
                <motion.button
                  key={opt}
                  type="button"
                  disabled={answeredLocal}
                  onClick={() => handleAnswerLocal(idx)}
                  variants={{
                    hidden: { opacity: 0, y: 15 },
                    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 20 } }
                  }}
                  whileHover={!answeredLocal ? { scale: 1.01, backgroundColor: "#eff6ff" } : {}}
                  whileTap={!answeredLocal ? { scale: 0.99 } : {}}
                  animate={
                    answeredLocal
                      ? isCorrectAns
                        ? { scale: [1, 1.08, 0.98, 1.02, 1], transition: { duration: 0.5, type: 'spring' } } // Pop effect for correct answer
                        : isSelected
                          ? { x: [0, -8, 8, -8, 8, -4, 4, 0], transition: { duration: 0.4 } } // Shake effect for selected incorrect
                          : {}
                      : {}
                  }
                  className={`p-3.5 rounded-xl text-xs font-black text-right border transition-all flex items-center justify-between cursor-pointer ${
                    answeredLocal
                      ? isSelected
                        ? isCorrectAns
                          ? "bg-emerald-500 text-white border-emerald-600 shadow-md"
                          : "bg-red-500 text-white border-red-600 shadow-md"
                        : isCorrectAns
                          ? "bg-emerald-100 border-emerald-300 text-emerald-800 font-bold"
                          : "bg-slate-50 border-slate-200 text-slate-400"
                      : isSelected
                        ? "bg-blue-50 border-blue-400 text-blue-950 scale-[1.01] shadow-3xs"
                        : "bg-white border-slate-200 hover:border-blue-400 hover:bg-blue-50/10 hover:shadow-3xs"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full border border-slate-300 flex items-center justify-center text-[8px] font-black font-mono">
                      {idx + 1}
                    </span>
                    <span>{opt}</span>
                  </span>
                  {answeredLocal && isCorrectAns && <CheckCircle className="w-4 h-4 text-white" />}
                  {answeredLocal && isSelected && !isCorrectAns && <XCircle className="w-4 h-4 text-white" />}
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
                  className={`p-3 rounded-xl text-xs font-black border flex items-center justify-between ${
                    isCorrectAns
                      ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                      : "bg-slate-50 text-slate-500 border-slate-200"
                  }`}
                >
                  <span>{opt}</span>
                  {isCorrectAns && <span className="text-[10px] text-emerald-600 font-bold">✓ صحيح</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Manual skip button for Host or participant */}
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={() => {
            setLocalIndex((prev) => (prev + 1 < rushQuestions.length ? prev + 1 : 0));
            showToast("⏳ تم تخطي السؤال الروحي الحالي لتجنب التعطيل.");
          }}
          className="text-[10px] font-black text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>تخطي السؤال الحالي</span>
        </button>
      </div>
    </motion.div>
  );
};
