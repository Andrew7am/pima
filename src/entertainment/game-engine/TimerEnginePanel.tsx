import React, { useState, useEffect } from 'react';
import { Play, Pause, Square, Timer, Hourglass, Zap, ShieldAlert } from 'lucide-react';
import { motion } from 'motion/react';

interface TimerEnginePanelProps {
  roundTimer: number;
  isTimerPaused: boolean;
  gameStartTime: number; // UTC timestamp of when room/game was started
  onTogglePause: () => void;
  onResetTimer?: () => void;
  role: 'host' | 'participant';
  gameType: string | null;
}

export const TimerEnginePanel: React.FC<TimerEnginePanelProps> = ({
  roundTimer,
  isTimerPaused,
  gameStartTime,
  onTogglePause,
  onResetTimer,
  role,
  gameType
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Core Session Count-up Timer from gameStartTime
  useEffect(() => {
    if (isTimerPaused || gameStartTime === 0) return;
    
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - gameStartTime) / 1000);
      setElapsedSeconds(elapsed > 0 ? elapsed : 0);
    }, 1000);

    return () => clearInterval(interval);
  }, [gameStartTime, isTimerPaused]);

  const formatSessionTime = (sec: number) => {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = sec % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-[#0A2342] text-white rounded-3xl p-5 shadow-lg flex flex-col md:flex-row justify-between items-center gap-4 text-right border border-[#144783]" dir="rtl">
      {/* 1. Left Section: Question/Round Countdown */}
      <div className="flex items-center gap-4 w-full md:w-auto">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl transition-all ${
          roundTimer <= 10 && roundTimer > 0
            ? 'bg-rose-500 text-white animate-pulse'
            : 'bg-white/10 text-amber-400'
        }`}>
          {roundTimer > 0 ? (
            <motion.span
              key={roundTimer}
              initial={{ scale: 0.8, opacity: 0.5 }}
              animate={{ scale: 1, opacity: 1 }}
              className="font-mono"
            >
              {roundTimer}
            </motion.span>
          ) : (
            '⏱️'
          )}
        </div>
        <div>
          <span className="text-[9.5px] text-slate-300 font-bold block flex items-center gap-1">
            <Hourglass className="w-3 h-3 text-amber-400 animate-spin-slow" />
            <span>مؤقت السؤال / الجولة الحاليّة</span>
          </span>
          <h4 className="text-xs font-black text-white mt-0.5">
            {roundTimer > 0 
              ? `متبقي ${roundTimer} ثانية للإجابة والمشاركة!` 
              : 'انتهى وقت الجولة الحالية ⏳'
            }
          </h4>
        </div>
      </div>

      {/* 2. Middle Section: Total Session Timer (Count Up) */}
      <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5 flex items-center gap-3.5 w-full md:w-auto justify-center">
        <Timer className="w-5 h-5 text-indigo-400" />
        <div className="text-right">
          <span className="text-[8.5px] text-slate-300 block font-bold">إجمالي وقت الجلسة (Session Timer)</span>
          <span className="font-mono text-sm font-black text-amber-300 tracking-wider">
            {formatSessionTime(elapsedSeconds || Math.floor((Date.now() - (gameStartTime || Date.now())) / 1000))}
          </span>
        </div>
      </div>

      {/* 3. Right Section: Host Control Board */}
      {role === 'host' && (
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <button
            onClick={onTogglePause}
            className={`py-2 px-4 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-md cursor-pointer ${
              isTimerPaused
                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
            }`}
          >
            {isTimerPaused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4 fill-current" />}
            <span>{isTimerPaused ? 'استئناف' : 'إيقاف مؤقت'}</span>
          </button>
          
          {onResetTimer && (
            <button
              onClick={onResetTimer}
              className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-xl text-xs font-black flex items-center gap-1 transition-all cursor-pointer"
              title="إعادة تعيين مؤقت الجولة"
            >
              <Square className="w-3.5 h-3.5" />
              <span>تصفير المؤقت</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
