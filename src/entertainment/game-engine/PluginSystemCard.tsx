import React from 'react';
import { motion } from 'motion/react';
import { CheckCircle, Shield, Settings, Zap, Play, Award, HelpCircle } from 'lucide-react';
import { GamePlugin, GAME_ENGINE_PLUGINS } from './GameEngineModels';

interface PluginSystemCardProps {
  plugin: GamePlugin;
  isActive: boolean;
  onLaunch: (pluginId: string) => void;
  role: 'host' | 'participant';
}

export const PluginSystemCard: React.FC<PluginSystemCardProps> = ({
  plugin,
  isActive,
  onLaunch,
  role
}) => {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className={`relative overflow-hidden rounded-2xl border p-4 transition-all duration-300 h-[140px] flex flex-col justify-between ${
        isActive
          ? 'bg-gradient-to-br from-[#0A2342] via-[#0D2E55] to-[#123E73] border-indigo-500/50 text-white shadow-xl'
          : 'bg-[#0B0F1A] border-white/5 hover:border-white/10 hover:shadow-[0_10px_30px_rgba(0,0,0,0.2)] text-white'
      }`}
      dir="rtl"
    >
      {/* Background visual cue for categories */}
      <div className={`absolute -top-10 -left-10 w-24 h-24 rounded-full blur-2xl pointer-events-none opacity-20 ${isActive ? 'bg-indigo-400' : 'bg-slate-800'}`} />

      {/* Top Bar: Icon, Name and Status */}
      <div className="relative z-10 flex justify-between items-start">
        <div className="flex items-center gap-2.5">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
            isActive ? 'bg-white/20 text-white' : 'bg-slate-800/50 border border-white/5 text-slate-300'
          }`}>
            {plugin.icon}
          </div>
          <div>
            <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-black uppercase tracking-wider ${
              plugin.category === 'knowledge' ? 'bg-indigo-500/20 text-indigo-300' :
              plugin.category === 'speed' ? 'bg-amber-500/20 text-amber-300' :
              plugin.category === 'luck' ? 'bg-rose-500/20 text-rose-300' :
              plugin.category === 'creative' ? 'bg-purple-500/20 text-purple-300' :
              'bg-emerald-500/20 text-emerald-300'
            }`}>
              {plugin.category === 'knowledge' ? 'معرفة وعقيدة' :
               plugin.category === 'speed' ? 'سرعة وحركة' :
               plugin.category === 'luck' ? 'حظ ومخاطرة' :
               plugin.category === 'creative' ? 'إبداع ورسم' :
               'ذكاء وألغاز'}
            </span>
            <h4 className="text-[12px] font-black mt-0.5 leading-tight">{plugin.label}</h4>
          </div>
        </div>

        {isActive ? (
          <span className="flex items-center gap-1 text-[8px] bg-white/20 text-white font-extrabold px-1.5 py-0.5 rounded-full border border-white/20">
            <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
            نشط
          </span>
        ) : (
          <span className="text-[8px] text-slate-400 font-bold bg-white/5 border border-white/5 px-1.5 py-0.5 rounded-full">
            جاهز
          </span>
        )}
      </div>

      {/* Description */}
      <div className="relative z-10 my-1">
        <p className={`text-[10px] leading-relaxed line-clamp-1 ${isActive ? 'text-slate-200' : 'text-slate-400'}`}>
          {plugin.desc}
        </p>
      </div>

      {/* Footer: Compatible Engines & Actions */}
      <div className="relative z-10 border-t border-white/5 pt-2 flex justify-between items-center">
        {/* Core Engine Hooks badge list */}
        <div className="flex gap-1">
          <span className="text-[8px] bg-white/5 text-slate-500 font-black px-1.5 py-0.5 rounded-md">T</span>
          <span className="text-[8px] bg-white/5 text-slate-500 font-black px-1.5 py-0.5 rounded-md">S</span>
        </div>

        {role === 'host' ? (
          <button
            onClick={() => onLaunch(plugin.id)}
            disabled={isActive}
            className={`py-1 px-3 rounded-lg text-[9px] font-black flex items-center gap-1 transition-all cursor-pointer ${
              isActive
                ? 'bg-emerald-600/50 text-white opacity-50 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md active:scale-95'
            }`}
          >
            <Play className="w-3 h-3 fill-current" />
            <span>{isActive ? 'قيد اللعب' : 'تشغيل اللعبة'}</span>
          </button>
        ) : (
          <span className="text-[8px] text-slate-500 italic font-medium">بانتظار المنظم</span>
        )}
      </div>
    </motion.div>
  );
};
export { GAME_ENGINE_PLUGINS };
