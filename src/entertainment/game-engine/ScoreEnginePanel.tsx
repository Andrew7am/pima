import React from 'react';
import { motion } from 'motion/react';
import { Award, ShieldAlert, TrendingUp, TrendingDown, Star, Zap, History, RefreshCw } from 'lucide-react';
import { ScoreTransaction } from './GameEngineModels';

interface ScoreEnginePanelProps {
  teams: { [id: string]: { id: string; name: string; color: string; score: number } };
  transactions: ScoreTransaction[];
  onAdjustPoints: (teamId: string, amount: number, type: 'add' | 'deduct' | 'bonus' | 'penalty' | 'double', description: string) => void;
  onResetPoints?: () => void;
  role: 'host' | 'participant';
}

export const ScoreEnginePanel: React.FC<ScoreEnginePanelProps> = ({
  teams,
  transactions,
  onAdjustPoints,
  onResetPoints,
  role
}) => {
  const teamsList = (Object.values(teams || {}) as { id: string; name: string; color: string; score: number }[])
    .sort((a, b) => b.score - a.score);

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 space-y-4 text-right" dir="rtl">
      {/* Title */}
      <div className="flex justify-between items-center border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-500 text-white rounded-xl flex items-center justify-center">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-black text-[#0A2342]">محرك النقاط والبركات الروحيّة (Score Engine)</h4>
            <p className="text-[9.5px] text-slate-400">إدارة موازين النقاط والعمليات وتتبع تاريخ الرهانات والأجوبة</p>
          </div>
        </div>
        {role === 'host' && onResetPoints && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm('هل أنت متأكد من تصفير وإعادة ضبط النقاط لجميع المجموعات؟')) {
                onResetPoints();
              }
            }}
            className="flex items-center gap-1 text-[9.5px] text-rose-600 hover:text-rose-800 font-extrabold border border-rose-100 bg-rose-50 px-2.5 py-1 rounded-lg transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5 animate-spin-slow" />
            تصفير النقاط
          </button>
        )}
      </div>

      {/* Grid of Teams with Quick Modifiers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {teamsList.map((team, idx) => (
          <div
            key={team.id}
            className="bg-white border border-slate-200 p-4 rounded-2xl flex flex-col justify-between shadow-3xs relative overflow-hidden group hover:border-[#0A2342] transition-colors"
          >
            {/* Crown icon for leader */}
            {idx === 0 && (
              <div className="absolute top-2 left-2 bg-amber-500 text-slate-950 p-1 rounded-lg shadow-3xs animate-bounce">
                <Star className="w-3.5 h-3.5 fill-current" />
              </div>
            )}

            <div className="flex items-center gap-2.5 mb-3">
              <span className="w-5 h-5 rounded-full" style={{ backgroundColor: team.color }} />
              <div>
                <h5 className="text-[12px] font-black text-[#0A2342]">{team.name}</h5>
                <span className="text-[14px] font-mono font-black text-slate-700">
                  {team.score} <span className="text-[10px] text-slate-400 font-bold">نقطة</span>
                </span>
              </div>
            </div>

            {role === 'host' && (
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <span className="text-[8.5px] text-slate-400 block font-bold">لوحة التعديل السريع للمسؤول:</span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => onAdjustPoints(team.id, 20, 'bonus', 'بركة روحيّة إضافية للمجموعة 🌟')}
                    className="py-1 px-2 text-[9.5px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 rounded-lg flex items-center justify-center gap-1 transition-all"
                  >
                    <TrendingUp className="w-3 h-3" />
                    +٢٠ بركة
                  </button>
                  <button
                    onClick={() => onAdjustPoints(team.id, -15, 'penalty', 'عقوبة لعدم الالتزام ⚠️')}
                    className="py-1 px-2 text-[9.5px] font-extrabold text-rose-700 bg-rose-50 border border-rose-100 hover:bg-rose-100 rounded-lg flex items-center justify-center gap-1 transition-all"
                  >
                    <TrendingDown className="w-3 h-3" />
                    -١٥ عقوبة
                  </button>
                  <button
                    onClick={() => onAdjustPoints(team.id, team.score, 'double', 'مضاعفة رصيد النقاط كاملاً 🎉')}
                    disabled={team.score <= 0}
                    className="py-1 px-2 text-[9.5px] font-extrabold text-amber-700 bg-amber-50 border border-amber-100 hover:bg-amber-100 disabled:opacity-40 rounded-lg flex items-center justify-center gap-1 transition-all col-span-2"
                  >
                    <Zap className="w-3 h-3 fill-amber-500" />
                    مضاعفة الرصيد الحالي!
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Point audit log trail */}
      <div className="space-y-2">
        <h5 className="text-[10px] font-black text-slate-700 flex items-center gap-1">
          <History className="w-4 h-4 text-indigo-500" />
          <span>سجل التعديلات ومحاضر النقاط الروحية ({transactions.length})</span>
        </h5>
        
        {transactions.length === 0 ? (
          <div className="text-center py-5 border border-dashed border-slate-200 rounded-xl bg-white">
            <p className="text-[10px] text-slate-400">لا يوجد تعديلات نقاط في هذه الجلسة بعد. نقاط المسابقات تدرج تلقائياً.</p>
          </div>
        ) : (
          <div className="max-h-[120px] overflow-y-auto border border-slate-200 rounded-xl bg-white p-2 divide-y divide-slate-100 scrollbar-thin scrollbar-thumb-slate-300">
            {transactions.slice().reverse().map((t) => (
              <div key={t.id} className="py-2 flex justify-between items-center text-[9.5px]">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`px-1.5 py-0.5 rounded-full font-black ${
                      t.amount > 0 
                        ? 'bg-emerald-100 text-emerald-800' 
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {t.amount > 0 ? '+' : ''}{t.amount}
                  </span>
                  <span className="font-bold text-slate-700">{t.teamName}</span>
                  <span className="text-slate-400">({t.description})</span>
                </div>
                <span className="text-slate-400 font-mono">{t.timestamp.split('T')[1].slice(0, 5)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
