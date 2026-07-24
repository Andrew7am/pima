import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ASSISTS_DATA } from './assistData';

interface SmartAssistBarProps {
  usedAssists: string[];
  onUseAssist: (assistId: string) => void;
  canUseRetry: boolean;
  questionIndex: number;
}

export const SmartAssistBar: React.FC<SmartAssistBarProps> = ({ 
  usedAssists, onUseAssist, canUseRetry, questionIndex
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Auto-collapse logic or other logic? 
  // User says "Simply expand the row horizontally with a smooth animation."

  return (
    <div className="flex justify-end mt-6 z-[50]">
      <div className="bg-[#0A1128]/80 backdrop-blur-xl border border-amber-400/50 shadow-[0_0_20px_rgba(16,185,129,0.15)] rounded-full p-2 flex items-center gap-2">
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div 
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 'auto', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="flex items-center gap-2 overflow-hidden"
            >
              {ASSISTS_DATA.map(assist => {
                const isUsed = usedAssists.includes(assist.id);
                const isDisabled = isUsed || (assist.id === 'retry' && !canUseRetry);
                return (
                  <motion.button
                    key={assist.id}
                    whileHover={!isDisabled ? { scale: 1.05 } : {}}
                    whileTap={!isDisabled ? { scale: 0.95 } : {}}
                    onClick={() => !isDisabled && onUseAssist(assist.id)}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                      isDisabled ? 'opacity-40 grayscale' : 'bg-slate-800'
                    }`}
                  >
                    {assist.icon}
                    {isUsed && <span className="absolute text-[8px] font-black text-emerald-400">✓</span>}
                  </motion.button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
        
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-xl"
        >
          🧰
        </button>
      </div>
    </div>
  );
};
