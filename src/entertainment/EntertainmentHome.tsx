import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  ChevronRight, BookOpen, Zap, Trophy, Sparkles, Music, FileText, HelpCircle, Users, Award,
  Gamepad2, CalendarDays, Gift, Heart, Sun, Moon, Volume2, VolumeX, Flame, ArrowLeft,
  BarChart3, Target, Star, Swords, Radio, CheckCircle2,
} from 'lucide-react';
import { User } from '../types';
import { ACHIEVEMENTS_LIST } from './entertainmentData';
import CommunityPanel from './CommunityPanel';

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
  onOpenRewards: () => void;
  onUserUpdated?: (patch: Partial<User>) => void;
}

type Section = 'menu' | 'games' | 'seasons' | 'community' | 'stats' | 'settings';

// A compact stat tile used by the الإحصائيات section.
function StatTile({ icon, value, label, tint }: { icon: React.ReactNode; value: React.ReactNode; label: string; tint: string }) {
  return (
    <div className="bg-gradient-to-br from-[#152A55] to-[#0D1B3B] border border-white/10 rounded-2xl p-4 flex flex-col items-center text-center gap-1.5">
      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center border ${tint}`}>{icon}</div>
      <span className="text-xl font-black text-white leading-none">{value}</span>
      <span className="text-[10px] font-bold text-slate-400 leading-tight">{label}</span>
    </div>
  );
}

// Coptic spiritual seasons with a themed challenge each — the static, always-on
// content behind the "المواسم" section (the live conference companion sits above).
const SPIRITUAL_SEASONS = [
  { emoji: '✝️', name: 'الصوم الكبير المقدس', tint: 'from-[#2a0c3a] to-[#1a0826] border-fuchsia-500/25', challenge: 'صلاة الساعات وقراءة سفر من العهد القديم أسبوعياً.' },
  { emoji: '🌟', name: 'صوم الميلاد المجيد', tint: 'from-[#0b2a44] to-[#0d1b3b] border-cyan-500/25', challenge: 'تأمل يومي في نبوات ميلاد المسيح وأعمال رحمة.' },
  { emoji: '🕊️', name: 'الخماسين المقدسة', tint: 'from-[#0f2a1e] to-[#0d1b3b] border-emerald-500/25', challenge: 'ترديد "المسيح قام" ومشاركة فرح القيامة مع محتاج.' },
  { emoji: '⚓', name: 'صوم الرسل الأطهار', tint: 'from-[#2a1f0c] to-[#1a1206] border-amber-500/25', challenge: 'قراءة أعمال الرسل والصلاة من أجل الخدمة والكرازة.' },
  { emoji: '👑', name: 'صوم السيدة العذراء', tint: 'from-[#2a0c1a] to-[#1a0612] border-rose-500/25', challenge: 'تسبحة يومية وقراءة عن حياة القديسة مريم البتول.' },
] as const;

// A single dark navy entry card used inside the category sub-sections.
function HubCard({ icon, title, badge, badgeCls, desc, onClick, borderHover, chevronHover }: {
  icon: React.ReactNode; title: string; badge?: string; badgeCls?: string; desc: string;
  onClick: () => void; borderHover: string; chevronHover: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-right bg-gradient-to-br from-[#152A55] to-[#0D1B3B] border border-white/10 ${borderHover} rounded-3xl p-4 flex items-center gap-4 shadow-lg transition-all group cursor-pointer`}
    >
      <div className="w-14 h-14 rounded-2xl bg-[#0A1428]/60 border border-white/10 flex items-center justify-center shadow-md shrink-0 group-hover:scale-105 transition-transform">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <h4 className="text-sm font-black text-white">{title}</h4>
          {badge && <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${badgeCls}`}>{badge}</span>}
        </div>
        <p className="text-[10.5px] text-slate-400 leading-relaxed">{desc}</p>
      </div>
      <ChevronRight className={`w-4 h-4 text-slate-500 ${chevronHover} transition-colors rotate-180 shrink-0`} />
    </button>
  );
}

export default function EntertainmentHome({
  currentUser, onBack, onOpenTrivia, onOpenWhoAmI, onOpenHymns, onOpenFillVerse, onOpenMultiplayer,
  onOpenAchievements, onOpenFriends, onOpenLeaderboard, onOpenRooms, onOpenConference, onOpenRandomMatch,
  onOpenGamesCatalog, onOpenRewards, onUserUpdated,
}: EntertainmentHomeProps) {
  const [section, setSection] = useState<Section>('menu');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);

  const userXP = currentUser.xp ?? 0;
  const xpNeeded = 150;
  const currentLevel = Math.floor(userXP / xpNeeded) + 1;
  const xpInLevel = userXP % xpNeeded;
  const xpPercent = Math.min(100, Math.floor((xpInLevel / xpNeeded) * 100));
  const title = currentUser.profileTitle || 'خادم مبتدئ 🕯️';
  const glory = currentUser.points ?? 0;
  const streak = currentUser.streak ?? 1;
  const avatar = currentUser.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name || 'P')}&background=122244&color=F5C542`;

  const CATEGORIES = [
    { id: 'games' as Section, label: 'مركز الألعاب التفاعلي 🎮', sub: 'تحديات كنسية فردية، مباريات مباشرة وألعاب جماعية حماسية', icon: <Gamepad2 className="w-7 h-7 text-[#F5C542]" strokeWidth={1.5} />, box: 'from-[#122244] to-[#1C142E] border-blue-500/25', iconBg: 'bg-[#F5C542]/10 border-[#F5C542]/30' },
    { id: 'seasons' as Section, label: 'المؤتمرات والمواسم الروحية 📖', sub: 'الفعاليات المباركة، التحديات الموسمية والتسجيلات المباشرة', icon: <BookOpen className="w-7 h-7 text-[#00E5FF]" strokeWidth={1.5} />, box: 'from-[#0b1b36] to-[#0d315c] border-cyan-500/20', iconBg: 'bg-[#00E5FF]/10 border-[#00E5FF]/30' },
    { id: 'community' as Section, label: 'شركة الصلوات المباركة ❤️', sub: 'الأصدقاء، تأملات الآباء وطلبات الصلاة المتبادلة', icon: <Heart className="w-7 h-7 text-[#FF3D71]" strokeWidth={1.5} />, box: 'from-[#1a0826] to-[#2c0c3a] border-fuchsia-500/20', iconBg: 'bg-[#FF3D71]/10 border-[#FF3D71]/30' },
    { id: 'stats' as Section, label: 'إحصائياتي التفصيلية 📊', sub: 'مستواك، خبرتك، دقتك، انتصاراتك وإنجازاتك الروحية', icon: <BarChart3 className="w-7 h-7 text-[#22D3EE]" strokeWidth={1.5} />, box: 'from-[#0b1b36] to-[#08243f] border-sky-500/20', iconBg: 'bg-[#22D3EE]/10 border-[#22D3EE]/30' },
    { id: 'settings' as Section, label: 'إعدادات التجربة ⚙️', sub: 'التحكم في الصوت والمظهر وتخصيص الواجهة الترفيهية', icon: <Sparkles className="w-7 h-7 text-slate-400" strokeWidth={1.5} />, box: 'from-[#1a1a1a] to-[#262626] border-slate-500/20', iconBg: 'bg-white/5 border-white/10' },
  ];

  // ---- Category sub-section (dark card list) ----
  if (section !== 'menu') {
    const headers: Record<Exclude<Section, 'menu'>, string> = {
      games: 'مركز الألعاب التفاعلي', seasons: 'المؤتمرات والمواسم', community: 'شركة الصلوات المباركة', stats: 'إحصائياتي التفصيلية', settings: 'إعدادات التجربة',
    };
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0A1428] via-[#0E1A33] to-[#08101F] text-slate-100 -mx-4 -my-6 sm:mx-0 sm:my-0 sm:rounded-3xl overflow-hidden" dir="rtl">
        <div className="max-w-2xl mx-auto px-4 pt-5 pb-12">
          <button type="button" onClick={() => setSection('menu')} className="flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-slate-200 transition-colors mb-4">
            <ChevronRight className="w-4 h-4" /><span>رجوع للقائمة</span>
          </button>
          <h2 className="text-lg font-black text-white mb-4">{headers[section]}</h2>

          <div className="space-y-3">
            {section === 'games' && (<>
              <HubCard icon={<Sparkles className="w-6 h-6 text-teal-300" />} title="مركز الألعاب الكتابية" badge="✨ 12 لعبة" badgeCls="bg-teal-500/15 text-teal-300 border-teal-500/30" desc="أمثال، رؤيا، بولس، أنبياء، ذاكرة، بحث كلمات، ترتيب، متقاطعة والمزيد." onClick={onOpenGamesCatalog} borderHover="hover:border-teal-500/40" chevronHover="group-hover:text-teal-400" />
              <HubCard icon={<Gamepad2 className="w-6 h-6 text-emerald-300" />} title="الغرف التفاعلية" badge="🎮 جماعي" badgeCls="bg-emerald-500/15 text-emerald-300 border-emerald-500/30" desc="اعمل غرفة للخلوة أو الاجتماع والعب مسابقات جماعية على شاشة واحدة." onClick={onOpenRooms} borderHover="hover:border-emerald-500/40" chevronHover="group-hover:text-emerald-400" />
              <HubCard icon={<Zap className="w-6 h-6 text-rose-300" />} title="المباراة العشوائية" badge="⚔️ 1 ضد 1" badgeCls="bg-rose-500/15 text-rose-300 border-rose-500/30" desc="اتحدى لاعب عشوائي أو صاحبك في مباراة أسئلة سريعة لايف." onClick={onOpenRandomMatch} borderHover="hover:border-rose-500/40" chevronHover="group-hover:text-rose-400" />
              <HubCard icon={<Users className="w-6 h-6 text-sky-300" />} title="مباريات وبطولات" badge="🏆 لايف" badgeCls="bg-sky-500/15 text-sky-300 border-sky-500/30" desc="ادخل بطولة 1 ضد 1 حسب مستواك واصعد في الرتب." onClick={onOpenMultiplayer} borderHover="hover:border-sky-500/40" chevronHover="group-hover:text-sky-400" />
              <HubCard icon={<BookOpen className="w-6 h-6 text-amber-300" />} title="أسئلة كتابية" desc="مسابقة معلومات عامة من الكتاب المقدس." onClick={onOpenTrivia} borderHover="hover:border-amber-500/40" chevronHover="group-hover:text-amber-400" />
              <HubCard icon={<HelpCircle className="w-6 h-6 text-violet-300" />} title="مين أنا؟" desc="خمّن الشخصية المقدسة من القرائن." onClick={onOpenWhoAmI} borderHover="hover:border-violet-500/40" chevronHover="group-hover:text-violet-400" />
              <HubCard icon={<Music className="w-6 h-6 text-cyan-300" />} title="الألحان" desc="تعرّف على الألحان والمناسبات الكنسية." onClick={onOpenHymns} borderHover="hover:border-cyan-500/40" chevronHover="group-hover:text-cyan-400" />
              <HubCard icon={<FileText className="w-6 h-6 text-lime-300" />} title="أكمل الآية" desc="أكمل الآيات الإنجيلية المقدسة." onClick={onOpenFillVerse} borderHover="hover:border-lime-500/40" chevronHover="group-hover:text-lime-400" />
              <HubCard icon={<Trophy className="w-6 h-6 text-amber-300" />} title="لوحة الصدارة" badge="🏆" badgeCls="bg-amber-500/15 text-amber-300 border-amber-500/30" desc="شوف المتصدرين وترتيبك بينهم." onClick={onOpenLeaderboard} borderHover="hover:border-amber-500/40" chevronHover="group-hover:text-amber-400" />
              <HubCard icon={<Award className="w-6 h-6 text-fuchsia-300" />} title="الإنجازات" desc="افتح أوسمة الإنجازات كلما تقدّمت." onClick={onOpenAchievements} borderHover="hover:border-fuchsia-500/40" chevronHover="group-hover:text-fuchsia-400" />
              <HubCard icon={<Gift className="w-6 h-6 text-yellow-300" />} title="المكافآت وعجلة الحظ" badge="🎁 يومي" badgeCls="bg-yellow-500/15 text-yellow-300 border-yellow-500/30" desc="أدر عجلة الحظ واربح خبرة، وأنجز تحدي اليوم الروحي." onClick={onOpenRewards} borderHover="hover:border-yellow-500/40" chevronHover="group-hover:text-yellow-400" />
            </>)}

            {section === 'seasons' && (<>
              <HubCard icon={<CalendarDays className="w-6 h-6 text-sky-300" />} title="مركز المؤتمر" badge="⛪ رفيق المؤتمر" badgeCls="bg-sky-500/15 text-sky-300 border-sky-500/30" desc="جدول المؤتمر، الإعلانات، البث المباشر، بطاقة المشارك والمذكرة الروحية." onClick={onOpenConference} borderHover="hover:border-sky-500/40" chevronHover="group-hover:text-sky-400" />

              {/* Live recordings placeholder — activates during active conferences */}
              <div className="bg-gradient-to-br from-[#0b2a44] to-[#0d1b3b] border border-cyan-500/20 rounded-3xl p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center shrink-0">
                  <Radio className="w-6 h-6 text-cyan-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-black text-white mb-0.5">التسجيلات والبث المباشر</h4>
                  <p className="text-[10.5px] text-slate-400 leading-relaxed">يظهر بث الاجتماعات والعظات هنا تلقائياً أثناء انعقاد مؤتمرك — افتح مركز المؤتمر للمتابعة.</p>
                </div>
              </div>

              {/* Spiritual seasons + a challenge each */}
              <h3 className="text-xs font-black text-slate-300 flex items-center gap-1.5 px-1 pt-2">
                <Sparkles className="w-4 h-4 text-[#F5C542]" /><span>المواسم والتحديات الروحية</span>
              </h3>
              {SPIRITUAL_SEASONS.map((s) => (
                <div key={s.name} className={`bg-gradient-to-br ${s.tint} border rounded-3xl p-4 flex items-center gap-4`}>
                  <div className="w-12 h-12 rounded-2xl bg-[#081326]/50 border border-white/10 flex items-center justify-center text-2xl shrink-0">{s.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-black text-white mb-0.5">{s.name}</h4>
                    <p className="text-[10.5px] text-slate-300 leading-relaxed">🎯 تحدي الموسم: {s.challenge}</p>
                  </div>
                </div>
              ))}
            </>)}

            {section === 'community' && (<>
              <HubCard icon={<Users className="w-6 h-6 text-sky-300" />} title="الأصدقاء والدردشة" badge="❤️" badgeCls="bg-sky-500/15 text-sky-300 border-sky-500/30" desc="ابحث عن أصدقائك، أرسل طلبات، وابدأ محادثة." onClick={onOpenFriends} borderHover="hover:border-sky-500/40" chevronHover="group-hover:text-sky-400" />
              <CommunityPanel currentUser={currentUser} onUserUpdated={onUserUpdated} />
            </>)}

            {section === 'stats' && (() => {
              const played = currentUser.totalGamesPlayed ?? 0;
              const correct = currentUser.totalCorrectAnswers ?? 0;
              const wins = currentUser.totalMatchesWon ?? 0;
              const rating = currentUser.rating ?? 100;
              const achievements = currentUser.unlockedAchievements?.length ?? 0;
              const totalAch = ACHIEVEMENTS_LIST.length;
              const accuracy = played > 0 ? Math.round((correct / played) * 100) : 0;
              return (
                <div className="space-y-4">
                  {/* Level + XP banner */}
                  <div className="bg-gradient-to-br from-[#152A55] to-[#0D1B3B] border border-[#F5C542]/25 rounded-3xl p-5 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 mb-1">المستوى الحالي</p>
                      <p className="text-3xl font-black text-white leading-none">المستوى {currentLevel}</p>
                      <p className="text-[11px] font-bold text-[#F5C542] mt-1.5">{xpInLevel} / {xpNeeded} خبرة للمستوى التالي</p>
                    </div>
                    <div className="w-16 h-16 rounded-2xl bg-[#F5C542]/10 border border-[#F5C542]/30 flex items-center justify-center">
                      <Star className="w-8 h-8 text-[#F5C542] fill-current" />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <StatTile icon={<Gamepad2 className="w-5 h-5 text-blue-300" />} value={played} label="لعبة لُعبت" tint="bg-blue-500/10 border-blue-500/25" />
                    <StatTile icon={<CheckCircle2 className="w-5 h-5 text-emerald-300" />} value={correct} label="إجابة صحيحة" tint="bg-emerald-500/10 border-emerald-500/25" />
                    <StatTile icon={<Target className="w-5 h-5 text-amber-300" />} value={`${accuracy}%`} label="دقة الإجابات" tint="bg-amber-500/10 border-amber-500/25" />
                    <StatTile icon={<Swords className="w-5 h-5 text-rose-300" />} value={wins} label="انتصارات المباريات" tint="bg-rose-500/10 border-rose-500/25" />
                    <StatTile icon={<Flame className="w-5 h-5 text-orange-300" />} value={streak} label="أيام التوالي" tint="bg-orange-500/10 border-orange-500/25" />
                    <StatTile icon={<Trophy className="w-5 h-5 text-violet-300" />} value={rating} label="تقييم التنافس" tint="bg-violet-500/10 border-violet-500/25" />
                  </div>

                  {/* Glory + achievements */}
                  <div className="bg-gradient-to-br from-[#152A55] to-[#0D1B3B] border border-white/10 rounded-3xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center"><Flame className="w-5 h-5 text-amber-300 fill-current" /></div>
                      <div><h4 className="text-sm font-black text-white">نقاط المجد</h4><p className="text-[10.5px] text-slate-400">رصيدك من نقاط الولاء.</p></div>
                    </div>
                    <span className="text-xl font-black text-[#F5C542]">{glory}</span>
                  </div>
                  <button type="button" onClick={onOpenAchievements} className="w-full bg-gradient-to-br from-[#2c0c3a] to-[#1a0826] border border-fuchsia-500/25 hover:border-fuchsia-500/50 rounded-3xl p-4 flex items-center justify-between transition-all group">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-fuchsia-500/10 border border-fuchsia-500/25 flex items-center justify-center"><Award className="w-5 h-5 text-fuchsia-300" /></div>
                      <div className="text-right"><h4 className="text-sm font-black text-white">الإنجازات المفتوحة</h4><p className="text-[10.5px] text-slate-400">اضغط لعرض كل الأوسمة.</p></div>
                    </div>
                    <span className="text-lg font-black text-fuchsia-300">{achievements} <span className="text-[11px] text-slate-400">/ {totalAch}</span></span>
                  </button>
                </div>
              );
            })()}

            {section === 'settings' && (
              <div className="space-y-3">
                <div className="bg-gradient-to-br from-[#152A55] to-[#0D1B3B] border border-white/10 rounded-3xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-[#F5C542]/10 border border-[#F5C542]/20 flex items-center justify-center">{isSoundEnabled ? <Volume2 className="w-5 h-5 text-[#F5C542]" /> : <VolumeX className="w-5 h-5 text-slate-400" />}</div>
                    <div><h4 className="text-sm font-black text-white">الأصوات</h4><p className="text-[10.5px] text-slate-400">مؤثّرات صوتية داخل الألعاب.</p></div>
                  </div>
                  <button type="button" onClick={() => setIsSoundEnabled((v) => !v)} className={`px-4 py-2 rounded-xl text-[11px] font-black ${isSoundEnabled ? 'bg-[#F5C542] text-slate-950' : 'bg-white/10 text-slate-300'}`}>{isSoundEnabled ? 'مفعّل' : 'مكتوم'}</button>
                </div>
                <div className="bg-gradient-to-br from-[#152A55] to-[#0D1B3B] border border-white/10 rounded-3xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-[#F5C542]/10 border border-[#F5C542]/20 flex items-center justify-center">{isDarkMode ? <Moon className="w-5 h-5 fill-current text-[#F5C542]" /> : <Sun className="w-5 h-5 fill-current text-amber-400" />}</div>
                    <div><h4 className="text-sm font-black text-white">الوضع الليلي</h4><p className="text-[10.5px] text-slate-400">حماية العين والاستمتاع بالتجربة.</p></div>
                  </div>
                  <button type="button" onClick={() => setIsDarkMode((v) => !v)} className={`px-4 py-2 rounded-xl text-[11px] font-black ${isDarkMode ? 'bg-[#F5C542] text-slate-950' : 'bg-slate-900 text-white'}`}>{isDarkMode ? '💡 نهاري' : '🌙 ليلي'}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---- Landing menu (ported EntertainmentMenu design) ----
  const dark = isDarkMode;
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className={`w-full max-w-2xl mx-auto pb-24 text-right min-h-screen px-4 pt-6 -mx-4 -my-6 sm:mx-auto sm:my-0 transition-colors duration-500 ${dark ? 'bg-[#081326] text-white' : 'bg-[#FAFAFA] text-slate-900'}`}
      dir="rtl"
    >
      {/* Title + toggles */}
      <div className="mb-8 pr-2 flex justify-between items-end">
        <div>
          <div className="flex items-center gap-2 mb-1.5 justify-end">
            <span className="text-[10px] font-black bg-amber-500/25 text-amber-300 border border-amber-500/30 px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> الواجهة الترفيهية
            </span>
          </div>
          <h1 className={`text-4xl font-black mb-2 tracking-tighter flex items-center gap-2 ${dark ? 'text-white' : 'text-slate-950'}`}>
            <span>الألعاب والترفيه</span><span className="text-xl">✨</span>
          </h1>
          <p className={`text-sm font-bold ${dark ? 'text-slate-400' : 'text-slate-500'}`}>اختر القسم الذي ترغب في المغامرة والتحدي فيه.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsSoundEnabled((v) => !v)} className={`w-12 h-12 rounded-2xl shadow-lg border flex items-center justify-center transition-all hover:scale-105 active:scale-95 ${dark ? 'bg-[#122244] border-blue-500/20 text-[#F5C542]' : 'bg-white border-slate-200 text-slate-600'}`} title={isSoundEnabled ? 'كتم الصوت' : 'تفعيل الصوت'}>
            {isSoundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>
          <button onClick={() => setIsDarkMode((v) => !v)} className={`w-12 h-12 rounded-2xl shadow-lg border flex items-center justify-center transition-all hover:scale-105 active:scale-95 ${dark ? 'bg-[#122244] border-blue-500/20 text-[#F5C542]' : 'bg-white border-slate-200 text-slate-600'}`} title={dark ? 'الوضع النهاري' : 'الوضع الليلي'}>
            {dark ? <Sun className="w-5 h-5 fill-current" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Night-mode bar */}
      <div className={`p-4 rounded-[24px] border mb-6 flex items-center justify-between ${dark ? 'bg-gradient-to-r from-[#0f2142] to-[#162a54] border-blue-500/30 text-[#F5C542]' : 'bg-white border-slate-200 text-slate-800'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${dark ? 'bg-[#F5C542]/10 border border-[#F5C542]/20 text-[#F5C542]' : 'bg-slate-100 text-slate-600'}`}>
            {dark ? <Moon className="w-5 h-5 fill-current" /> : <Sun className="w-5 h-5 fill-current" />}
          </div>
          <div className="text-right">
            <h4 className="text-xs sm:text-sm font-black">الوضع الليلي وتعتيم الشاشة الذكي 🌙</h4>
            <p className={`text-[10px] sm:text-xs font-bold leading-none mt-1 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{dark ? 'الوضع المظلم الفاخر نشط لحماية عينيك ✨' : 'شغّل الوضع المظلم لتقليل إجهاد العين 🕯️'}</p>
          </div>
        </div>
        <button type="button" onClick={() => setIsDarkMode((v) => !v)} className={`px-4 py-2 rounded-xl text-[11px] font-black active:scale-95 ${dark ? 'bg-[#F5C542] text-slate-950' : 'bg-slate-900 text-white'}`}>{dark ? '💡 نهاري' : '🌙 ليلي'}</button>
      </div>

      {/* Player profile card */}
      <div className={`relative p-6 rounded-[32px] shadow-2xl mb-8 flex flex-col sm:flex-row items-center sm:items-start gap-6 border overflow-hidden ${dark ? 'bg-[#0b1b36]/90 border-blue-500/20' : 'bg-white border-slate-200'}`}>
        {dark && <div className="absolute top-0 left-0 w-48 h-48 bg-blue-500/5 blur-3xl pointer-events-none" />}
        <div className="relative shrink-0 group">
          <div className={`absolute -inset-1.5 rounded-full bg-gradient-to-tr ${dark ? 'from-amber-600 to-[#F5C542]' : 'from-slate-300 to-slate-400'} blur-sm opacity-70`} />
          <div className={`w-28 h-28 rounded-full overflow-hidden border-[4px] relative z-10 flex items-center justify-center ${dark ? 'border-[#081326] bg-[#122244]' : 'border-white bg-slate-100'}`}>
            <img src={avatar} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          </div>
          <div className={`absolute -bottom-2 -left-2 text-xs font-black w-9 h-9 rounded-full flex items-center justify-center border-4 relative z-20 shadow-xl ${dark ? 'bg-[#F5C542] text-slate-950 border-[#081326]' : 'bg-slate-800 text-white border-white'}`}>{currentLevel}</div>
        </div>

        <div className="flex-1 w-full space-y-4 text-center sm:text-right relative z-10">
          <div>
            <div className="flex items-center justify-center sm:justify-start gap-2 mb-1.5">
              <span className={`text-[9.5px] px-3 py-1 rounded-full font-black border ${dark ? 'bg-amber-500/15 text-amber-300 border-amber-500/20' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>🏆 {title}</span>
            </div>
            <h2 className={`text-2xl sm:text-3xl font-black tracking-tight ${dark ? 'text-white' : 'text-slate-900'}`}>{currentUser.name}</h2>
          </div>

          <div className="space-y-3.5">
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[10px] font-black px-1">
                <span className={dark ? 'text-slate-400' : 'text-slate-500'}>التقدم والخبرة الروحية (XP)</span>
                <span className={`font-mono ${dark ? 'text-amber-400' : 'text-slate-800'}`}>{xpInLevel} / {xpNeeded} XP</span>
              </div>
              <div className={`w-full h-3 rounded-full overflow-hidden p-0.5 border ${dark ? 'bg-[#081326]/80 border-blue-500/15' : 'bg-slate-100 border-slate-200'}`}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${xpPercent}%` }} transition={{ duration: 1, ease: 'easeOut' }} className={`h-full rounded-full ${dark ? 'bg-gradient-to-r from-amber-500 to-[#F5C542]' : 'bg-slate-700'}`} />
              </div>
            </div>

            <div className="flex items-center justify-center sm:justify-start gap-4 pt-1">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${dark ? 'bg-amber-500/5 border-amber-500/15 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                <Flame className="w-4 h-4 text-amber-400 fill-current" />
                <span className="text-xs font-black">{glory} <span className="text-[10px] font-bold opacity-80">نقطة مجد</span></span>
              </div>
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${dark ? 'bg-rose-500/5 border-rose-500/15 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
                <Trophy className="w-4 h-4 text-rose-400 fill-current" />
                <span className="text-xs font-black">{streak} <span className="text-[10px] font-bold opacity-80">أيام التوالي</span></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4 category cards */}
      <div className="space-y-4">
        {CATEGORIES.map((c, idx) => (
          <motion.div
            key={c.id}
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22, delay: idx * 0.08 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setSection(c.id)}
            className={`group cursor-pointer relative overflow-hidden rounded-[28px] p-5 md:p-6 flex items-center justify-between border transition-all duration-300 ${dark ? `bg-gradient-to-br ${c.box} hover:border-[#F5C542]/40` : 'bg-white border-slate-200/80 hover:border-slate-300'}`}
          >
            <div className="flex items-center gap-4 relative z-10 text-right">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border transition-all group-hover:scale-110 ${dark ? c.iconBg : 'bg-slate-100 border-slate-200'}`}>{c.icon}</div>
              <div className="space-y-1">
                <h3 className={`text-base font-black transition-colors ${dark ? 'text-white group-hover:text-[#F5C542]' : 'text-slate-800'}`}>{c.label}</h3>
                <p className={`text-[11.5px] font-bold leading-relaxed max-w-[280px] sm:max-w-md ${dark ? 'text-slate-300 opacity-90' : 'text-slate-500'}`}>{c.sub}</p>
              </div>
            </div>
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border transition-all relative z-10 shrink-0 ${dark ? 'bg-[#081326]/60 border-blue-500/10 text-slate-300 group-hover:bg-[#F5C542] group-hover:text-slate-950' : 'bg-slate-50 border-slate-100 text-slate-400 group-hover:bg-slate-900 group-hover:text-white'}`}>
              <ArrowLeft className="w-4 h-4 fill-current rotate-180 group-hover:rotate-0 transition-transform duration-300" />
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
