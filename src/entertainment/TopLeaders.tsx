import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Trophy, Award, Crown, Star, Medal, ArrowUp, 
  ChevronRight, TrendingUp, TrendingDown, Flame, 
  Zap, Users 
} from 'lucide-react';
import { User as UserType } from '../types';
import { LEADERBOARD_MOCKS } from './data/leaderboardMocks';
import { loadLeaderboard, loadMyRank } from './leaderboard';

interface TopLeadersProps {
  currentUser: UserType;
}

const NumberCounter = ({ value }: { value: number }) => {
  const [displayValue, setDisplayValue] = useState(0);
  
  useEffect(() => {
    let start = 0;
    const end = value;
    const duration = 1500;
    const increment = end / (duration / 16);
    
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setDisplayValue(end);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(start));
      }
    }, 16);
    
    return () => clearInterval(timer);
  }, [value]);
  
  return <span>{displayValue.toLocaleString('ar-EG')}</span>;
};

export const TopLeaders: React.FC<TopLeadersProps> = ({ currentUser }) => {
  const [allLeaders, setAllLeaders] = useState<any[]>([]);
  const [nearbyPlayers, setNearbyPlayers] = useState<any[]>([]);
  const [totalPlayers, setTotalPlayers] = useState<number>(1254);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const getTier = (points: number) => {
    if (points >= 10000) return { name: 'أسطوري', color: 'text-purple-400', bg: 'bg-purple-500/20', border: 'border-purple-500/30' };
    if (points >= 5000) return { name: 'لماسة', color: 'text-blue-400', bg: 'bg-blue-500/20', border: 'border-blue-500/30' };
    if (points >= 2500) return { name: 'ذهبي', color: 'text-amber-400', bg: 'bg-amber-500/20', border: 'border-amber-500/30' };
    if (points >= 1000) return { name: 'فضي', color: 'text-slate-300', bg: 'bg-slate-500/20', border: 'border-slate-500/30' };
    return { name: 'برونزي', color: 'text-orange-400', bg: 'bg-orange-500/20', border: 'border-orange-500/30' };
  };

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      try {
        setIsLoading(true);

        // Real board via the leaderboard RPC (migration 072); map avatar_url →
        // the `avatar` field the UI reads. Falls back to mocks when empty.
        const rows = await loadLeaderboard(10);
        let leaders: any[] = rows.map((r) => ({ id: r.id, name: r.name, points: r.points, avatar: r.avatar_url || undefined }));
        if (leaders.length === 0) leaders = LEADERBOARD_MOCKS.weekly;
        if (cancelled) return;
        setAllLeaders(leaders);

        const stats = await loadMyRank();
        if (cancelled) return;
        const total = stats?.total_players || leaders.length || 1;
        let rank = stats?.my_rank || (leaders.findIndex((u) => u.id === currentUser.id) + 1);
        if (!rank || rank < 1) rank = leaders.length + 1;
        setTotalPlayers(total);
        setUserRank(rank);

        // Nearby players (for the scrolling list) — same presentation as source.
        if (rank <= 8) {
          setNearbyPlayers(leaders.slice(0, 10).map((u, i) => ({ ...u, rank: i + 1 })));
        } else {
          const p = currentUser.points || 0;
          setNearbyPlayers([
            { id: 'n_m3', name: 'خادم متميز', points: p + 120, rank: rank - 3 },
            { id: 'n1', name: 'أحمد', points: p + 50, rank: rank - 2 },
            { id: 'n2', name: 'محمد', points: p + 20, rank: rank - 1 },
            { ...currentUser, rank, isUser: true },
            { id: 'n3', name: 'كريم', points: Math.max(0, p - 10), rank: rank + 1 },
            { id: 'n4', name: 'يوسف', points: Math.max(0, p - 30), rank: rank + 2 },
            { id: 'n5', name: 'سارة', points: Math.max(0, p - 45), rank: rank + 3 },
            { id: 'n6', name: 'مريم', points: Math.max(0, p - 60), rank: rank + 4 },
          ]);
        }
      } catch (err) {
        console.error('TopLeaders:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, [currentUser.id, currentUser.points]);

  if (isLoading) return null;

  const top3 = allLeaders.slice(0, 3);
  const podiumOrder = [1, 0, 2];
  const podiumData = podiumOrder.map(idx => top3[idx]).filter(Boolean);
  const userTier = getTier(currentUser.points || 0);
  const topPercent = Math.max(1, Math.min(100, Math.round((userRank || 1) / totalPlayers * 100)));
  
  // Logic for Average Performance Gauge
  const communityAverage = 1850; // Mock average points for demonstration
  const performanceRatio = Math.min(1.5, (currentUser.points || 0) / communityAverage);
  const isAboveAverage = (currentUser.points || 0) >= communityAverage;

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8">
      <style>{`
        .leaderboard-scroll::-webkit-scrollbar { width: 4px; }
        .leaderboard-scroll::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); border-radius: 10px; }
        .leaderboard-scroll::-webkit-scrollbar-thumb { background: rgba(59,130,246,0.3); border-radius: 10px; }
        .leaderboard-scroll::-webkit-scrollbar-thumb:hover { background: rgba(59,130,246,0.5); }
      `}</style>
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative bg-gradient-to-b from-[#0A1128] to-[#050B18] border border-blue-500/30 rounded-[40px] p-8 overflow-hidden shadow-2xl"
      >
        {/* Background Decorative Elements */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col items-center">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-amber-500/20 p-2 rounded-xl">
              <Trophy className="w-6 h-6 text-amber-400" />
            </div>
            <h3 className="text-xl font-black text-white tracking-tight">أساطير الصدارة الروحية 🏆</h3>
          </div>
          <p className="text-slate-400 text-xs mb-10 text-center max-w-md">
            نحتفي بالأبطال الأكثر نشاطاً في المسابقات والأنشطة الترفيهية.
          </p>

          {/* Podium Visualization */}
          <div className="flex items-end justify-center gap-4 sm:gap-8 w-full mb-16">
            {podiumData.map((user, displayIdx) => {
              const actualRank = top3.indexOf(user) + 1;
              const isFirst = actualRank === 1;
              const isSecond = actualRank === 2;
              const isThird = actualRank === 3;

              return (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0, scale: 0.9, y: 30 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: 0.2 + displayIdx * 0.1, type: "spring" }}
                  className="flex flex-col items-center group"
                >
                  {/* Avatar Section */}
                  <div className="relative mb-4">
                    <div className={`
                      relative rounded-full p-1.5 transition-all duration-500 group-hover:scale-110
                      ${isFirst ? 'bg-gradient-to-tr from-amber-600 to-yellow-300 w-24 h-24 sm:w-28 sm:h-28' : 
                        isSecond ? 'bg-gradient-to-tr from-slate-500 to-slate-200 w-20 h-20 sm:w-24 sm:h-24' : 
                        'bg-gradient-to-tr from-amber-800 to-amber-500 w-16 h-16 sm:w-20 sm:h-20'}
                    `}>
                      <div className="w-full h-full rounded-full overflow-hidden border-2 border-[#0A1128] bg-[#0A1128]">
                        <img 
                          src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`} 
                          alt={user.name} 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      
                      {/* Rank Icon */}
                      <div className={`
                        absolute -bottom-1 -right-1 flex items-center justify-center rounded-full border-2 border-[#0A1128] font-black text-white shadow-lg
                        ${isFirst ? 'w-8 h-8 bg-amber-500 text-sm' : isSecond ? 'w-7 h-7 bg-slate-400 text-xs' : 'w-6 h-6 bg-amber-700 text-[10px]'}
                      `}>
                        {actualRank}
                      </div>

                      {/* Crown for #1 */}
                      {isFirst && (
                        <motion.div 
                          animate={{ y: [0, -5, 0] }}
                          transition={{ repeat: Infinity, duration: 2 }}
                          className="absolute -top-8 left-1/2 -translate-x-1/2 text-amber-400"
                        >
                          <Crown className="w-8 h-8 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]" />
                        </motion.div>
                      )}
                    </div>
                  </div>

                  {/* Name & Points */}
                  <div className="text-center mb-4">
                    <h4 className={`font-black text-white mb-0.5 line-clamp-1 max-w-[100px] sm:max-w-[140px] ${isFirst ? 'text-base' : 'text-sm'}`}>
                      {user.name.split(' ')[0]}
                    </h4>
                    <div className="flex items-center justify-center gap-1">
                      <Star className={`w-3 h-3 ${isFirst ? 'text-amber-400' : 'text-slate-400'}`} />
                      <span className={`font-mono font-black ${isFirst ? 'text-amber-400 text-sm' : 'text-slate-300 text-xs'}`}>
                        {(user.points || 0).toLocaleString('ar-EG')}
                      </span>
                    </div>
                  </div>

                  {/* Podium Base */}
                  <div className={`
                    w-20 sm:w-28 rounded-t-2xl shadow-inner relative overflow-hidden
                    ${isFirst ? 'h-32 bg-gradient-to-b from-amber-500/20 to-amber-500/5 border-t border-x border-amber-500/40' : 
                      isSecond ? 'h-24 bg-gradient-to-b from-slate-500/20 to-slate-500/5 border-t border-x border-slate-500/40' : 
                      'h-16 bg-gradient-to-b from-amber-900/20 to-amber-900/5 border-t border-x border-amber-900/40'}
                  `}>
                    <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
                    <div className="flex items-center justify-center h-full">
                      <span className={`text-4xl font-black opacity-20 ${isFirst ? 'text-amber-500' : isSecond ? 'text-slate-400' : 'text-amber-900'}`}>
                        {actualRank}
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* 🚀 PLAYER RANKING CARD 🚀 */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full bg-[#0D1B3E]/60 backdrop-blur-xl border border-blue-500/30 rounded-[32px] overflow-hidden shadow-2xl relative"
          >
            {/* Header / Title */}
            <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 p-6 border-b border-white/10 flex items-center justify-between">
               <h4 className="text-white font-black text-lg tracking-tight">تحليل أدائك 📊</h4>
               <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                 <span className="text-[10px] text-emerald-400 font-black uppercase tracking-widest">مباشر الآن</span>
               </div>
            </div>

            <div className="p-8 flex flex-col items-center">
              {/* Main Rank Display & Average Indicator */}
              <div className="mb-10 text-center w-full max-w-md">
                <motion.div 
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="inline-flex flex-col items-center mb-6"
                >
                  <div className="text-6xl sm:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-br from-blue-400 to-purple-500 mb-2">
                    #{userRank || '??'}
                  </div>
                  <div className="text-slate-400 font-bold text-sm sm:text-base">
                    من أصل <NumberCounter value={totalPlayers} /> لاعب
                  </div>
                </motion.div>
                
                {/* Visual Average Indicator */}
                <div className="w-full space-y-3 bg-white/5 p-4 rounded-2xl border border-white/5">
                  <div className="flex justify-between items-end mb-1 px-1">
                    <span className="text-[10px] font-black text-slate-500">متوسط المجتمع</span>
                    <span className={`text-xs font-black ${isAboveAverage ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {isAboveAverage ? 'أداء فوق المتوسط ✨' : 'اقتربت من المتوسط 🔥'}
                    </span>
                    <span className="text-[10px] font-black text-slate-500">مستواك الحالي</span>
                  </div>
                  
                  <div className="relative h-2.5 w-full bg-[#081326] rounded-full overflow-hidden border border-white/5">
                    {/* Average Line Indicator */}
                    <div className="absolute top-0 left-[66%] h-full w-0.5 bg-white/20 z-10" />
                    
                    {/* User Progress Bar */}
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, performanceRatio * 66)}%` }}
                      transition={{ duration: 1.5, ease: "easeOut" }}
                      className={`h-full rounded-full ${isAboveAverage ? 'bg-gradient-to-r from-blue-500 to-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.4)]' : 'bg-gradient-to-r from-blue-600 to-amber-500'}`}
                    />
                  </div>
                  
                  <div className="flex justify-between items-center text-[9px] font-black text-slate-600 px-1 pt-1">
                    <span>{communityAverage} نقطة</span>
                    <span>{(currentUser.points || 0)} نقطة</span>
                  </div>
                </div>

                <div className="mt-6 inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                   <TrendingUp className="w-4 h-4 text-emerald-400" />
                   <span className="text-emerald-400 text-xs font-black">أنت ضمن أفضل {topPercent}% من اللاعبين</span>
                </div>
              </div>

              {/* Scrollable Ranking Preview */}
              <div className="w-full max-w-md bg-black/30 rounded-3xl p-2 border border-white/5 mb-8 overflow-hidden">
                 <div className="flex justify-between items-center px-4 py-3 border-b border-white/5">
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">المنافسون المباشرون</p>
                    <div className="flex items-center gap-1.5">
                       <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,0.5)]" />
                       <span className="text-[9px] text-blue-400 font-black">قائمة متفاعلة</span>
                    </div>
                 </div>
                 
                 <div className="leaderboard-scroll max-h-[280px] overflow-y-auto px-2 py-2 space-y-1.5">
                   {nearbyPlayers.map((player, idx) => {
                      const isUser = player.id === currentUser.id;
                      const isHigher = player.rank < (userRank || 0);
                      
                      return (
                        <motion.div 
                          key={player.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className={`flex items-center justify-between p-3 rounded-2xl transition-all ${
                            isUser ? 'bg-blue-600/30 border border-blue-400/50 shadow-lg scale-[1.01]' : 'bg-white/5 border border-transparent hover:bg-white/10'
                          }`}
                        >
                           <div className="flex items-center gap-3">
                             <div className={`w-5 h-5 flex items-center justify-center rounded-lg text-[9px] font-black ${isUser ? 'bg-blue-500 text-white' : 'bg-white/10 text-slate-500'}`}>
                                {player.rank}
                             </div>
                             <div className="flex items-center gap-2">
                                <span className={`text-sm font-black ${isUser ? 'text-white' : 'text-slate-300'}`}>{player.name}</span>
                                {isUser && (
                                  <motion.span 
                                    animate={{ scale: [1, 1.1, 1] }} 
                                    transition={{ repeat: Infinity, duration: 2 }}
                                    className="text-[8px] bg-blue-500 text-white px-1.5 py-0.5 rounded-md font-black"
                                  >
                                    أنت
                                  </motion.span>
                                )}
                             </div>
                           </div>
                           <div className="flex items-center gap-2">
                              <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${isUser ? 'bg-blue-500/20' : 'bg-black/20'}`}>
                                <Star className={`w-3 h-3 ${isUser ? 'text-amber-400' : 'text-slate-500'}`} />
                                <span className={`text-[10px] font-mono font-black ${isUser ? 'text-amber-400' : 'text-slate-400'}`}>
                                  {(player.points || 0).toLocaleString('ar-EG')}
                                </span>
                              </div>
                              <span className={`text-[10px] ${isUser ? 'hidden' : 'block'}`}>
                                 {isHigher ? '⬆️' : '⬇️'}
                              </span>
                           </div>
                        </motion.div>
                      );
                   })}
                 </div>
                 
                 <div className="p-3 text-center border-t border-white/5 bg-white/5">
                    <p className="text-[9px] text-slate-500 font-black">اسحب للأعلى لرؤية المزيد من المنافسين 👆</p>
                 </div>
              </div>

              {/* Extra Statistics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full mb-8">
                 {[
                   { label: 'مجموع النقاط', value: (currentUser.points || 0).toLocaleString('ar-EG'), icon: Star, color: 'text-amber-400', bg: 'bg-amber-500/10' },
                   { label: 'مرات الفوز', value: '14', icon: Trophy, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                   { label: 'سلسلة انتصارات', value: '🔥 5', icon: Flame, color: 'text-orange-400', bg: 'bg-orange-500/10' },
                   { label: 'تغير الترتيب', value: '+3', icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                 ].map((stat, i) => (
                   <motion.div 
                     key={i} 
                     whileHover={{ y: -5 }}
                     className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col items-center text-center group transition-colors hover:bg-white/10"
                   >
                      <div className={`${stat.bg} p-2 rounded-xl mb-2 group-hover:scale-110 transition-transform`}>
                         <stat.icon className={`w-4 h-4 ${stat.color}`} />
                      </div>
                      <p className="text-[9px] text-slate-500 font-bold mb-1">{stat.label}</p>
                      <p className={`text-sm font-black ${stat.color}`}>{stat.value}</p>
                   </motion.div>
                 ))}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 w-full">
                 <button className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-blue-900/20 flex items-center justify-center gap-2 group">
                    <Medal className="w-5 h-5" />
                    <span>عرض لوحة الشرف الكاملة</span>
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                 </button>
                 <button className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-2">
                    <Users className="w-5 h-5 text-slate-400" />
                    <span>أفضل 100 لاعب</span>
                 </button>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
};
