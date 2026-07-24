import React, { useEffect, useState } from 'react';
import { User } from '../types';
import { ChevronRight, BookOpen, Zap, Coins, Trophy, Sparkles, Music, FileText, HelpCircle, Users, Award, Gamepad2, CalendarDays } from 'lucide-react';
import { xpToNext, xpProgressPct } from './progress';
import { getLeague } from './leagues';
import { getConversations } from './social';

interface EntertainmentHomeProps {
  currentUser: User;
  onBack: () => void;
  onOpenTrivia: () => void;
  onOpenWhoAmI: () => void;
  onOpenHymns: () => void;
  onOpenFillVerse: () => void;
  onOpenMultiplayer: () => void;
  onOpenAchievements: () => void;
  onOpenFriends: () => void;
  onOpenLeaderboard: () => void;
  onOpenRooms: () => void;
  onOpenConference: () => void;
  onOpenRandomMatch: () => void;
  onOpenGamesCatalog: () => void;
}

interface GameCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
  badge?: string;
  gradient?: string;
}

function GameCard({ title, description, icon, onClick, badge = 'فردي', gradient = 'from-amber-500 to-amber-700' }: GameCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-right bg-gradient-to-br from-[#152A55] to-[#0D1B3B] border border-white/10 hover:border-amber-500/40 rounded-3xl p-4 flex items-center gap-4 shadow-lg transition-all group cursor-pointer"
    >
      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-md shrink-0 group-hover:scale-105 transition-transform`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <h4 className="text-sm font-black text-white">{title}</h4>
          <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            {badge}
          </span>
        </div>
        <p className="text-[10.5px] text-slate-400 leading-relaxed">{description}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition-colors rotate-180 shrink-0" />
    </button>
  );
}

// Phase 1 entertainment hub — deliberately dark-themed so gameplay
// feels like a distinct immersive space, separate from the cream/gold
// booking-app shell. Shows the player their XP progress toward the
// next level, their loyalty-point balance, and a single card that
// launches the solo Trivia game. More game cards (Who Am I, Hymns,
// Fill Verse, Word Search, and online rooms) get added below this
// one in later phases.
export default function EntertainmentHome({
  currentUser, onBack, onOpenTrivia, onOpenWhoAmI, onOpenHymns, onOpenFillVerse, onOpenMultiplayer, onOpenAchievements, onOpenFriends, onOpenLeaderboard, onOpenRooms, onOpenConference, onOpenRandomMatch, onOpenGamesCatalog,
}: EntertainmentHomeProps) {
  const league = getLeague(currentUser.rating ?? 100);
  const level = currentUser.level ?? 1;
  const xp = currentUser.xp ?? 0;
  const coins = currentUser.gameCoins ?? 0;
  const needed = xpToNext(level);
  const pct = xpProgressPct(xp, level);
  const unlockedCount = currentUser.unlockedAchievements?.length ?? 0;

  const [unreadMessages, setUnreadMessages] = useState(0);
  useEffect(() => {
    getConversations().then((convos) => {
      setUnreadMessages(convos.reduce((sum, c) => sum + c.unreadCount, 0));
    });
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0A1428] via-[#0E1A33] to-[#08101F] text-slate-100 -mx-4 -my-6 sm:mx-0 sm:my-0 sm:rounded-3xl overflow-hidden">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-5 space-y-5" dir="rtl">

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
            <span>رجوع</span>
          </button>
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-black tracking-wider text-slate-200">مركز الترفيه</span>
          </div>
          <div className="w-14" aria-hidden />
        </div>

        <div className="bg-gradient-to-br from-[#132247] to-[#0A1732] border border-white/10 rounded-3xl p-5 shadow-xl">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="min-w-0">
              <p className="text-[10px] text-slate-400 font-bold">مستواك الحالي</p>
              <h2 className="text-xl font-black text-white leading-tight truncate">{currentUser.name}</h2>
            </div>
            <div className="flex flex-col items-center bg-gradient-to-br from-amber-500 to-amber-700 text-white rounded-2xl px-4 py-2 shadow-lg shrink-0">
              <span className="text-[8px] font-black uppercase tracking-widest opacity-80">Level</span>
              <span className="text-2xl font-black leading-none">{level}</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mb-1.5">
              <span>{xp} / {needed} XP</span>
              <span>للوصول للمستوى {level + 1}</span>
            </div>
            <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
              <div
                className="h-full bg-gradient-to-l from-amber-400 to-amber-600 rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 mt-4">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-bold text-slate-400">إجمالي الخبرة</p>
                <p className="text-sm font-black text-white truncate">{xp} XP</p>
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-amber-500/15 border border-amber-400/30 flex items-center justify-center shrink-0">
                <Coins className="w-4 h-4 text-amber-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-bold text-slate-400">عملات اللعب</p>
                <p className="text-sm font-black text-white truncate">{coins.toLocaleString('ar-EG')}</p>
              </div>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenAchievements}
          className="w-full text-right bg-gradient-to-br from-[#152A55] to-[#0D1B3B] border border-white/10 hover:border-emerald-500/40 rounded-3xl p-4 flex items-center gap-4 shadow-lg transition-all group cursor-pointer"
        >
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-md shrink-0 group-hover:scale-105 transition-transform">
            <Award className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h4 className="text-sm font-black text-white">الإنجازات والشارات</h4>
              <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                {unlockedCount} / 9
              </span>
            </div>
            <p className="text-[10.5px] text-slate-400 leading-relaxed">تابع تقدمك واجمع مكافآت إضافية من الخبرة والعملات.</p>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition-colors rotate-180 shrink-0" />
        </button>

        <button
          type="button"
          onClick={onOpenFriends}
          className="w-full text-right bg-gradient-to-br from-[#152A55] to-[#0D1B3B] border border-white/10 hover:border-sky-500/40 rounded-3xl p-4 flex items-center gap-4 shadow-lg transition-all group cursor-pointer"
        >
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-500 to-sky-700 flex items-center justify-center shadow-md shrink-0 group-hover:scale-105 transition-transform">
            <Users className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h4 className="text-sm font-black text-white">الأصدقاء والمحادثات</h4>
              {unreadMessages > 0 && (
                <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30">
                  {unreadMessages > 9 ? '9+' : unreadMessages} رسائل جديدة
                </span>
              )}
            </div>
            <p className="text-[10.5px] text-slate-400 leading-relaxed">أضف أصدقاء من المستخدمين وابدأ محادثة مباشرة.</p>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-sky-400 transition-colors rotate-180 shrink-0" />
        </button>

        <button
          type="button"
          onClick={onOpenLeaderboard}
          className="w-full text-right bg-gradient-to-br from-[#152A55] to-[#0D1B3B] border border-white/10 hover:border-amber-500/40 rounded-3xl p-4 flex items-center gap-4 shadow-lg transition-all group cursor-pointer"
        >
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center shadow-md shrink-0 group-hover:scale-105 transition-transform">
            <Trophy className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h4 className="text-sm font-black text-white">لوحة الصدارة</h4>
              <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">🏆 المتصدرون</span>
            </div>
            <p className="text-[10.5px] text-slate-400 leading-relaxed">شوف أساطير الصدارة الروحية وترتيبك بين اللاعبين.</p>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition-colors rotate-180 shrink-0" />
        </button>

        <button
          type="button"
          onClick={onOpenRooms}
          className="w-full text-right bg-gradient-to-br from-[#152A55] to-[#0D1B3B] border border-white/10 hover:border-emerald-500/40 rounded-3xl p-4 flex items-center gap-4 shadow-lg transition-all group cursor-pointer"
        >
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md shrink-0 group-hover:scale-105 transition-transform">
            <Gamepad2 className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h4 className="text-sm font-black text-white">الغرف التفاعلية</h4>
              <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">🎮 ألعاب جماعية</span>
            </div>
            <p className="text-[10.5px] text-slate-400 leading-relaxed">اعمل غرفة للخلوة أو الاجتماع، وسّع الفرق والعب مسابقات جماعية على شاشة واحدة.</p>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition-colors rotate-180 shrink-0" />
        </button>

        <button
          type="button"
          onClick={onOpenConference}
          className="w-full text-right bg-gradient-to-br from-[#152A55] to-[#0D1B3B] border border-white/10 hover:border-sky-500/40 rounded-3xl p-4 flex items-center gap-4 shadow-lg transition-all group cursor-pointer"
        >
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center shadow-md shrink-0 group-hover:scale-105 transition-transform">
            <CalendarDays className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h4 className="text-sm font-black text-white">مركز المؤتمر</h4>
              <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30">⛪ رفيق المؤتمر</span>
            </div>
            <p className="text-[10.5px] text-slate-400 leading-relaxed">جدول المؤتمر، الإعلانات، البث المباشر، بطاقة المشارك والمذكرة الروحية في مكان واحد.</p>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-sky-400 transition-colors rotate-180 shrink-0" />
        </button>

        <button
          type="button"
          onClick={onOpenRandomMatch}
          className="w-full text-right bg-gradient-to-br from-[#152A55] to-[#0D1B3B] border border-white/10 hover:border-rose-500/40 rounded-3xl p-4 flex items-center gap-4 shadow-lg transition-all group cursor-pointer"
        >
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center shadow-md shrink-0 group-hover:scale-105 transition-transform">
            <Zap className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h4 className="text-sm font-black text-white">المباراة العشوائية</h4>
              <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30">⚔️ 1 ضد 1</span>
            </div>
            <p className="text-[10.5px] text-slate-400 leading-relaxed">اتحدى لاعب عشوائي أو صاحبك في مباراة أسئلة سريعة لايف، واصعد في الترتيب.</p>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-rose-400 transition-colors rotate-180 shrink-0" />
        </button>

        <button
          type="button"
          onClick={onOpenGamesCatalog}
          className="w-full text-right bg-gradient-to-br from-[#152A55] to-[#0D1B3B] border border-white/10 hover:border-teal-500/40 rounded-3xl p-4 flex items-center gap-4 shadow-lg transition-all group cursor-pointer"
        >
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center shadow-md shrink-0 group-hover:scale-105 transition-transform">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h4 className="text-sm font-black text-white">مركز الألعاب الكتابية</h4>
              <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-300 border border-teal-500/30">✨ 12 لعبة</span>
            </div>
            <p className="text-[10.5px] text-slate-400 leading-relaxed">أمثال، رؤيا، بولس، أنبياء، تخمين شخصيات، آيات، تفسير، ذاكرة، بحث كلمات، ترتيب أحداث ومتقاطعة.</p>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-teal-400 transition-colors rotate-180 shrink-0" />
        </button>

        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Trophy className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-black text-slate-200">الألعاب المتاحة</h3>
          </div>

          {/* Featured multiplayer CTA — league badge doubles as visual hook */}
          <button
            type="button"
            onClick={onOpenMultiplayer}
            className={`w-full text-right bg-gradient-to-br ${league.gradient} rounded-3xl p-4 flex items-center gap-4 shadow-2xl transition-all group cursor-pointer border border-white/10`}
          >
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0 text-3xl">
              {league.badge}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h4 className="text-sm font-black text-white">مباريات مباشرة 1v1</h4>
                <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-white/20 text-white border border-white/30">
                  {league.name}
                </span>
              </div>
              <p className="text-[10.5px] text-white/85 leading-relaxed">
                تحدى لاعبين حقيقيين، اربح تقييم واصعد الدوريات. غرف خاصة أو بحث عشوائي.
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-white/70 group-hover:text-white transition-colors rotate-180 shrink-0" />
          </button>

          <GameCard
            title="أسئلة كتابية"
            description="٥ أسئلة سريعة من الكتاب المقدس والتراث الكنسي. اربح خبرة وعملات عن كل إجابة صحيحة."
            icon={<BookOpen className="w-7 h-7 text-white" />}
            onClick={onOpenTrivia}
          />

          <GameCard
            title="من أنا؟"
            description="خمّن شخصية كتابية من التلميحات. كل ما استخدمت تلميحات أقل، كل ما ربحت أكتر."
            icon={<HelpCircle className="w-7 h-7 text-white" />}
            onClick={onOpenWhoAmI}
            gradient="from-purple-500 to-purple-700"
          />

          <GameCard
            title="ألحان قبطية"
            description="اختبر معلوماتك في ألحان وطقوس الكنيسة القبطية والمصطلحات الليتورجية."
            icon={<Music className="w-7 h-7 text-white" />}
            onClick={onOpenHymns}
            gradient="from-rose-500 to-rose-700"
          />

          <GameCard
            title="أكمل الآية"
            description="آيات كتابية شهيرة بكلمة ناقصة. اختر الكلمة الصحيحة من بين ٤ خيارات."
            icon={<FileText className="w-7 h-7 text-white" />}
            onClick={onOpenFillVerse}
            gradient="from-cyan-500 to-cyan-700"
          />

        </div>

      </div>
    </div>
  );
}
