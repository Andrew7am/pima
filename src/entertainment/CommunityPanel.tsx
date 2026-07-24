import React, { useEffect, useState } from 'react';
import { Heart, Send, MessageSquare, Award, Loader2, Trash2 } from 'lucide-react';
import { User } from '../types';
import { SPIRITUAL_MEDITATIONS } from './entertainmentData';
import { awardGameReward } from '../lib/db';
import {
  loadPrayerRequests, createPrayerRequest, togglePrayer, deletePrayerRequest,
  type PrayerRequestRow,
} from './prayerWall';

interface Props {
  currentUser: User;
  onUserUpdated?: (patch: Partial<User>) => void;
}

// "اليوم، ٣:١٤ م" style relative label for a fresh post; older rows keep the
// date the server stored.
function formatWhen(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    const time = d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    if (sameDay) return `اليوم، ${time}`;
    return d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' });
  } catch { return ''; }
}

const PRAYER_XP = 30;

export default function CommunityPanel({ currentUser, onUserUpdated }: Props) {
  const [prayers, setPrayers] = useState<PrayerRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);

  const church = currentUser.churchName || currentUser.organizationName || 'كنيستي';
  // Award the prayer-post XP at most once per day to keep it an encouragement,
  // not a farm.
  const xpKey = `pima_prayer_xp_${new Date().toISOString().slice(0, 10)}`;

  useEffect(() => {
    let alive = true;
    (async () => {
      const rows = await loadPrayerRequests(currentUser.id);
      if (alive) { setPrayers(rows); setLoading(false); }
    })();
    return () => { alive = false; };
  }, [currentUser.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || posting) return;
    setPosting(true);
    const created = await createPrayerRequest({
      userId: currentUser.id,
      authorName: currentUser.name,
      church,
      text: body,
    });
    if (created) {
      setPrayers((prev) => [created, ...prev]);
      setText('');
      // Once-a-day XP reward for contributing a request.
      let alreadyRewarded = false;
      try { alreadyRewarded = localStorage.getItem(xpKey) === '1'; } catch { /* ignore */ }
      if (!alreadyRewarded) {
        const r = await awardGameReward(PRAYER_XP, 0, 0, 'مشاركة طلبة صلاة في شركة الصلوات');
        if (r) onUserUpdated?.({ xp: r.xp, level: r.level, gameCoins: r.gameCoins });
        try { localStorage.setItem(xpKey, '1'); } catch { /* ignore */ }
      }
    }
    setPosting(false);
  };

  const handleSupport = async (id: string) => {
    // Optimistic flip; reconcile with the server's authoritative count.
    setPrayers((prev) => prev.map((p) => p.id === id
      ? { ...p, isPraying: !p.isPraying, prayersCount: p.prayersCount + (p.isPraying ? -1 : 1) }
      : p));
    const res = await togglePrayer(id);
    if (res) {
      setPrayers((prev) => prev.map((p) => p.id === id
        ? { ...p, isPraying: res.praying, prayersCount: res.count } : p));
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await deletePrayerRequest(id);
    if (ok) setPrayers((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="space-y-5">
      {/* Submit a new prayer request */}
      <div className="bg-gradient-to-br from-[#152A55] to-[#0D1B3B] border border-[#C5A059]/30 rounded-3xl p-5 space-y-3">
        <div>
          <h4 className="text-xs font-black text-white flex items-center gap-1.5">
            <Heart className="w-4 h-4 text-rose-400" />
            <span>تشارك معنا بطلبة صلاة في الهيكل الروحي:</span>
          </h4>
          <p className="text-[9.5px] text-slate-400 mt-0.5 leading-relaxed">اكتب طلبتك أو احتياجك لكي يصلي لأجلك الإخوة والخدام من جميع الكنائس والخدمات المترابطة.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-2">
          <textarea
            placeholder="اكتب طلبتك هنا بوقار (مثال: صلوا من أجل مريض، مسافر، أو توجيه روحي للخدمة...)"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={400}
            className="w-full bg-[#081326]/70 border border-white/10 rounded-2xl p-3 text-xs leading-relaxed text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-[#F5C542]/60"
            rows={3}
          />
          <div className="flex justify-between items-center">
            <span className="text-[9px] text-[#F5C542] font-bold">✓ اكسب +{PRAYER_XP} خبرة بمشاركة طلبتك (مرة يومياً)</span>
            <button
              type="submit"
              disabled={posting || !text.trim()}
              className="bg-[#F5C542] hover:brightness-105 disabled:opacity-40 text-slate-950 px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5"
            >
              {posting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              <span>انشر الصلاة</span>
            </button>
          </div>
        </form>
      </div>

      {/* Prayer requests feed */}
      <div className="space-y-3">
        <h3 className="text-xs font-black text-slate-200 flex items-center gap-1.5 px-1">
          <MessageSquare className="w-4 h-4 text-[#C5A059]" />
          <span>طلبات الصلاة الحية للآباء والخدام:</span>
        </h3>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 text-slate-500 animate-spin" /></div>
        ) : prayers.length === 0 ? (
          <div className="bg-white/5 border border-dashed border-white/15 rounded-3xl p-6 text-center text-slate-400 text-[12px] font-bold">
            كن أول من يشارك طلبة صلاة 🙏
          </div>
        ) : (
          <div className="space-y-3">
            {prayers.map((pr) => (
              <div key={pr.id} className="bg-[#0b1b36]/80 border border-white/10 p-4 rounded-2xl space-y-3 text-right">
                <div className="flex justify-between items-start">
                  <span className="text-[9px] text-slate-500 font-bold">{formatWhen(pr.createdAt)}</span>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <span className="text-[10.5px] font-black text-white block">{pr.authorName}</span>
                      <span className="text-[8.5px] text-slate-500 font-bold block mt-0.5">{pr.church}</span>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xs">🙏</div>
                  </div>
                </div>

                <p className="text-[11px] font-bold text-slate-300 leading-relaxed">"{pr.text}"</p>

                <div className="border-t border-white/5 pt-2 flex justify-between items-center text-[10px]">
                  <button
                    onClick={() => handleSupport(pr.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all font-black border ${
                      pr.isPraying
                        ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:text-rose-300'
                    }`}
                  >
                    <Heart className={`w-3.5 h-3.5 ${pr.isPraying ? 'fill-rose-400 text-rose-400' : ''}`} />
                    <span>{pr.isPraying ? 'أصلي لأجلك ✓' : 'أصلي لأجلك'}</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#C5A059]">{pr.prayersCount} أخ يصلي لأجل هذه الطلبة</span>
                    {pr.isMine && (
                      <button onClick={() => handleDelete(pr.id)} title="حذف طلبتي" className="p-1 rounded-md text-slate-500 hover:text-rose-400 hover:bg-white/5">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Coptic fathers' meditations */}
      <div className="bg-gradient-to-br from-[#152A55] to-[#0D1B3B] border border-white/10 rounded-3xl p-5 space-y-3.5">
        <h3 className="text-xs font-black text-white flex items-center gap-1.5">
          <Award className="w-4 h-4 text-[#C5A059]" />
          <span>من تأملات آباء الكنيسة الأطهار:</span>
        </h3>
        <div className="flex gap-3.5 overflow-x-auto pb-1">
          {SPIRITUAL_MEDITATIONS.map((med) => (
            <div key={med.id} className="bg-[#081326]/70 p-4 rounded-2xl border border-white/10 w-64 shrink-0 space-y-2 flex flex-col justify-between text-right">
              <p className="text-[10.5px] font-bold text-slate-300 leading-relaxed italic">"{med.quote}"</p>
              <div className="flex justify-between items-center pt-2 border-t border-white/5 text-[9px] font-black">
                <span className="bg-white/5 text-slate-300 px-1.5 py-0.5 rounded">{med.category}</span>
                <span className="text-[#F5C542]">{med.author}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
