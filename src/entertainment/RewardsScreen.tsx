import React, { useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { Gift, Sparkles, Check, Zap } from 'lucide-react';
import { User } from '../types';
import { awardGameReward, checkAchievements } from '../lib/db';
import AdGateModal from './AdGateModal';

interface Props {
  currentUser: User;
  onBack: () => void;
  onUserUpdated: (patch: Partial<User>) => void;
  onAchievementsUnlocked?: (ids: string[]) => void;
}

// Wheel segments — XP rewards (not redeemable points).
const WHEEL = [
  { xp: 10, color: '#f59e0b' },
  { xp: 20, color: '#10b981' },
  { xp: 30, color: '#3b82f6' },
  { xp: 50, color: '#ef4444' },
  { xp: 75, color: '#a855f7' },
  { xp: 100, color: '#eab308' },
];
const SEG = 360 / WHEEL.length;

const DAILY_CHALLENGES = [
  { id: 'dc_1', label: '📖 قراءة أصحاح كامل بتأمل وفهم عميق', xp: 50 },
  { id: 'dc_2', label: '🙏 صلاة حارة في مخدعك لمدة ١٠ دقائق من أجل الآخرين والخدمة', xp: 50 },
  { id: 'dc_3', label: '🕯️ حفظ آية اليوم المباركة وكتابتها لمشاركتها مع أصدقائك', xp: 40 },
  { id: 'dc_4', label: '⛪ زيارة مريض أو الاتصال بأحد الغائبين عن الكنيسة لتشجيعه', xp: 60 },
  { id: 'dc_5', label: '📚 قراءة صفحتين من كتاب روحي من آبائيات الكنيسة', xp: 45 },
  { id: 'dc_6', label: '🕊️ ترديد صلاة يسوع السهمية ("يا ربي يسوع المسيح ارحمني") طوال اليوم', xp: 40 },
];

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
function dayIndex(): number {
  const d = new Date();
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d.getTime() - start.getTime()) / 86400000) % DAILY_CHALLENGES.length;
}

export default function RewardsScreen({ currentUser, onBack, onUserUpdated, onAchievementsUnlocked }: Props) {
  const [rotation, setRotation] = useState(0);
  const rotationRef = useRef(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [adOpen, setAdOpen] = useState(false);

  const challenge = useMemo(() => DAILY_CHALLENGES[dayIndex()], []);
  const challengeKey = `pima_daily_challenge_${todayKey()}`;
  const [challengeDone, setChallengeDone] = useState<boolean>(() => {
    try { return localStorage.getItem(challengeKey) === '1'; } catch { return false; }
  });
  const [awardingChallenge, setAwardingChallenge] = useState(false);

  // Called only after the rewarded ad completes.
  const runSpin = async () => {
    setAdOpen(false);
    if (spinning) return;
    setResult(null);
    setSpinning(true);
    const idx = Math.floor(Math.random() * WHEEL.length);
    const won = WHEEL[idx];
    // Accumulate rotation so it always spins forward and lands on the won segment.
    const targetMod = ((360 - (idx * SEG + SEG / 2)) % 360 + 360) % 360;
    const currentMod = ((rotationRef.current % 360) + 360) % 360;
    let delta = targetMod - currentMod;
    if (delta < 0) delta += 360;
    const final = rotationRef.current + 360 * 4 + delta;
    rotationRef.current = final;
    setRotation(final);
    setTimeout(async () => {
      setSpinning(false);
      confetti({ particleCount: 150, spread: 90, origin: { y: 0.5 } });
      const r = await awardGameReward(won.xp, 0, 0, `عجلة الحظ: +${won.xp} خبرة`);
      if (r) onUserUpdated({ xp: r.xp, level: r.level, gameCoins: r.gameCoins });
      setResult(`ربحت +${won.xp} نقطة خبرة! 🎉`);
    }, 4100);
  };

  const completeChallenge = async () => {
    if (challengeDone || awardingChallenge) return;
    setAwardingChallenge(true);
    const r = await awardGameReward(challenge.xp, 0, 0, `التحدي اليومي: ${challenge.label}`);
    if (r) onUserUpdated({ xp: r.xp, level: r.level, gameCoins: r.gameCoins });
    const unlocked = await checkAchievements();
    if (unlocked.length > 0) onAchievementsUnlocked?.(unlocked);
    try { localStorage.setItem(challengeKey, '1'); } catch { /* ignore */ }
    setChallengeDone(true);
    setAwardingChallenge(false);
  };

  const conic = `conic-gradient(${WHEEL.map((w, i) => `${w.color} ${i * SEG}deg ${(i + 1) * SEG}deg`).join(', ')})`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0A1428] via-[#0E1A33] to-[#08101F] text-slate-100 -mx-4 -my-6 sm:mx-0 sm:my-0 sm:rounded-3xl overflow-hidden" dir="rtl">
      <AdGateModal open={adOpen} title="شاهد الإعلان لتدوير العجلة" rewardLabel="أدر العجلة" onReward={runSpin} onClose={() => setAdOpen(false)} />

      <div className="max-w-lg mx-auto px-4 pt-5 pb-10">
        <div className="flex items-center justify-between mb-4">
          <button type="button" onClick={onBack} className="flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-slate-200 transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>
            <span>رجوع</span>
          </button>
          <span className="flex items-center gap-1 text-[11px] font-black text-amber-300 bg-amber-500/10 border border-amber-500/25 px-2.5 py-1 rounded-full">
            <Zap className="w-3.5 h-3.5" /> {currentUser.xp ?? 0} خبرة
          </span>
        </div>

        <div className="text-center mb-2">
          <h2 className="text-lg font-black text-white">المكافآت وعجلة الحظ</h2>
          <p className="text-[11px] text-slate-400">شاهد إعلاناً وأدر العجلة لتربح نقاط خبرة.</p>
        </div>

        <div className="flex flex-col items-center py-4">
          <div className="relative">
            <div className="absolute left-1/2 -translate-x-1/2 -top-1 z-10 w-0 h-0 border-l-8 border-r-8 border-t-[16px] border-l-transparent border-r-transparent border-t-amber-400" />
            <div
              className="w-60 h-60 rounded-full border-4 border-white/15 shadow-2xl relative"
              style={{ background: conic, transform: `rotate(${rotation}deg)`, transition: spinning ? 'transform 4s cubic-bezier(0.15,0.9,0.2,1)' : 'none' }}
            >
              {WHEEL.map((w, i) => {
                const ang = i * SEG + SEG / 2;
                return (
                  <span key={i} className="absolute left-1/2 top-1/2 text-white font-black text-sm" style={{ transform: `rotate(${ang}deg) translateY(-88px) rotate(-${ang}deg)`, transformOrigin: 'center' }}>+{w.xp}</span>
                );
              })}
            </div>
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-[#0A1428] border-4 border-amber-400 flex items-center justify-center z-10">
              <Sparkles className="w-5 h-5 text-amber-400" />
            </div>
          </div>

          <button
            type="button"
            onClick={() => { if (!spinning) setAdOpen(true); }}
            disabled={spinning}
            className={`mt-6 px-8 py-3 rounded-2xl text-[13px] font-black transition-all ${spinning ? 'bg-slate-600 text-slate-300' : 'bg-gradient-to-r from-amber-500 to-yellow-600 text-white hover:scale-105 active:scale-95'}`}
          >
            {spinning ? 'جارٍ الدوران… ⚙️' : 'شاهد إعلاناً وأدر العجلة 📺⚡'}
          </button>

          {result && <div className="mt-4 text-center text-[14px] font-black text-emerald-300">{result}</div>}
        </div>

        {/* Daily challenge */}
        <div className="mt-4 bg-gradient-to-br from-[#152A55] to-[#0D1B3B] border border-white/10 rounded-3xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Gift className="w-5 h-5 text-fuchsia-400" />
            <h3 className="text-sm font-black text-white">التحدي الروحي اليومي</h3>
            <span className="mr-auto text-[10px] font-black text-fuchsia-300 bg-fuchsia-500/15 border border-fuchsia-500/30 px-2 py-0.5 rounded-full">+{challenge.xp} خبرة</span>
          </div>
          <p className="text-[12.5px] text-slate-200 leading-relaxed mb-3">{challenge.label}</p>
          {challengeDone ? (
            <div className="flex items-center justify-center gap-1 text-emerald-300 font-black text-[12px] py-2"><Check className="w-4 h-4" /> أنجزت تحدي اليوم — بارك الله فيك 🙏</div>
          ) : (
            <button type="button" onClick={completeChallenge} disabled={awardingChallenge} className="w-full py-2.5 bg-fuchsia-500 hover:bg-fuchsia-600 disabled:opacity-60 text-white text-[12px] font-black rounded-xl">
              {awardingChallenge ? 'جارٍ التسجيل…' : 'أنجزت التحدي ✔️'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
