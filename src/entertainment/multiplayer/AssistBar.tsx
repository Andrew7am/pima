import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Wrench, Check, Lock } from 'lucide-react';

export type AssistId = 'hint' | '5050' | 'extra_time' | 'retry';

interface AssistDef {
  id: AssistId;
  icon: string;
  label: string;
  level: number;
}

const ASSISTS: AssistDef[] = [
  { id: 'hint', icon: '💡', label: 'تلميح', level: 1 },
  { id: '5050', icon: '✂️', label: '٥٠/٥٠', level: 3 },
  { id: 'extra_time', icon: '⏸️', label: 'تجميد الوقت', level: 5 },
  { id: 'retry', icon: '❤️', label: 'إعادة محاولة', level: 8 },
];

interface AssistBarProps {
  usedAssists: AssistId[];
  onUseAssist: (id: AssistId) => void;
  userLevel: number;
}

// Power-ups ported from the original prototype's SmartAssistBar — same
// 4 assists that actually had working effects there (hint's effect is
// a new design here; the original declared it but never implemented
// it). Purely presentational: all effects live in the caller.
export default function AssistBar({ usedAssists, onUseAssist, userLevel }: AssistBarProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="flex justify-end" dir="rtl">
      <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full p-1.5">
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 'auto', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: 'spring', damping: 24, stiffness: 300 }}
              className="flex items-center gap-1.5 overflow-hidden"
            >
              {ASSISTS.map((a) => {
                const used = usedAssists.includes(a.id);
                const locked = userLevel < a.level;
                const disabled = used || locked;
                return (
                  <button
                    key={a.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => onUseAssist(a.id)}
                    title={locked ? `يتطلب المستوى ${a.level}` : a.label}
                    className={`relative w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-base transition-all ${
                      disabled
                        ? 'bg-white/5 grayscale opacity-40 cursor-not-allowed'
                        : 'bg-white/10 hover:bg-white/20 cursor-pointer'
                    }`}
                  >
                    {locked ? <Lock className="w-3.5 h-3.5 text-slate-400" /> : a.icon}
                    {used && (
                      <span className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center border border-[#0A1428]">
                        <Check className="w-2.5 h-2.5 text-white" />
                      </span>
                    )}
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center bg-gradient-to-br from-amber-500 to-amber-700 text-white"
        >
          <Wrench className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
