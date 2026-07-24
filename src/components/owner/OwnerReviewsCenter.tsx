import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Review } from '../../types';
import {
  Star, MessageSquare, Pencil, Trash2, Check, CornerDownLeft, ThumbsUp, AlertTriangle,
  Sparkles, Award, Search, Smile, Lightbulb, ChevronLeft, Send, BarChart3,
} from 'lucide-react';
import BottomSheet from './BottomSheet';

interface OwnerReviewsCenterProps {
  reviews: Review[];
  onUpdateReview?: (review: Review) => void;
}

type FilterKey = 'all' | 'answered' | 'unanswered' | 5 | 4 | 3 | 2 | 1;
type SortKey = 'newest' | 'oldest' | 'highest' | 'lowest';
const REPLY_MAX = 600;

// ── small helpers ──────────────────────────────────────────────────
function useCountUp(target: number, decimals = 0, duration = 700) {
  const [v, setV] = useState(target);
  const prev = useRef(target);
  useEffect(() => {
    const from = prev.current;
    if (from === target) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const e = 1 - Math.pow(1 - t, 3);
      setV(from + (target - from) * e);
      if (t < 1) raf = requestAnimationFrame(tick); else prev.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return decimals ? v.toFixed(decimals) : Math.round(v).toString();
}

function Stars({ value, className = 'w-3.5 h-3.5' }: { value: number; className?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={`${className} ${n <= Math.round(value) ? 'text-amber-400 fill-amber-400' : 'text-[var(--color-owner-border)]'}`} />
      ))}
    </span>
  );
}

function timeAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'اليوم';
  if (days === 1) return 'أمس';
  if (days < 7) return `منذ ${days} أيام`;
  if (days < 30) return `منذ ${Math.floor(days / 7)} أسابيع`;
  const months = Math.floor(days / 30);
  return months === 1 ? 'منذ شهر' : `منذ ${months} أشهر`;
}

// Contextual reply drafts — three tones, adapted to the review's sentiment.
function replySuggestions(rev: Review): { key: string; label: string; text: string }[] {
  const name = rev.userName?.split(' ')[0] || 'ضيفنا العزيز';
  const complaint = rev.problemTags?.[0];
  const positive = rev.rating >= 4 && !complaint;
  if (positive) {
    return [
      { key: 'friendly', label: 'ودّي', text: `شكرًا جزيلًا يا ${name} على كلماتك الجميلة 🙏 سعدنا كثيرًا باستضافتك، ونتمنى نراك مرة أخرى قريبًا.` },
      { key: 'professional', label: 'رسمي', text: `نشكرك على تقييمك الطيب ومشاركتك تجربتك معنا. يسعدنا دائمًا خدمتك، ونعمل على تقديم الأفضل في كل زيارة.` },
      { key: 'warm', label: 'راقٍ', text: `يسعدنا أن إقامتك كانت مميزة يا ${name} 🤍 رضاك هو هدفنا الأول، وبابنا مفتوح لاستقبالك دائمًا.` },
    ];
  }
  const c = complaint ? `بخصوص ${complaint}` : 'بخصوص ملاحظتك';
  return [
    { key: 'friendly', label: 'ودّي', text: `نعتذر يا ${name} عن أي إزعاج، ونشكرك على صراحتك 🙏 ${c} سنعمل على تحسينه فورًا، ونتمنى تمنحنا فرصة أخرى.` },
    { key: 'professional', label: 'رسمي', text: `نشكرك على ملاحظتك القيّمة. ${c} تم رفعه لفريق الجودة لمعالجته، ونحرص على ألا يتكرر. نقدّر تفهّمك.` },
    { key: 'warm', label: 'راقٍ', text: `رأيك يهمنا كثيرًا يا ${name}. نأسف لعدم اكتمال تجربتك، ${c} أصبح أولوية لدينا، ونعدك بتجربة أفضل في زيارتك القادمة.` },
  ];
}

export default function OwnerReviewsCenter({ reviews, onUpdateReview }: OwnerReviewsCenterProps) {
  const [view, setView] = useState<'dashboard' | 'all'>('dashboard');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [sort, setSort] = useState<SortKey>('newest');
  const [replyFor, setReplyFor] = useState<Review | null>(null);
  const [replyText, setReplyText] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [visibleCount, setVisibleCount] = useState(8);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // ── aggregates (all from real data) ──
  const total = reviews.length;
  const avgNum = total > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / total : 0;
  const dist = useMemo(() => {
    const d: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach((r) => { d[Math.min(5, Math.max(1, Math.round(r.rating)))]++; });
    return d;
  }, [reviews]);
  const answered = reviews.filter((r) => r.ownerReply).length;
  const unanswered = total - answered;
  const repliedPct = total > 0 ? Math.round((answered / total) * 100) : 0;

  const likedTop = useMemo(() => aggTags(reviews, 'likedTags').slice(0, 3), [reviews]);
  // Full ranked list of recurring complaints (structured tags + free-text "other").
  const complaintList = useMemo(() => aggTagsWithCounts(reviews, 'problemTags', 'problemOther'), [reviews]);
  const complaintTop = complaintList[0]?.tag;
  const complaintMax = complaintList[0]?.count ?? 1;
  const targetRating = Math.min(5, avgNum + 0.1);

  const badge = avgNum >= 4.5
    ? { label: avgNum >= 4.8 ? 'أداء استثنائي' : 'تقييم ممتاز', sub: 'استمر في تقديم تجربة رائعة 🎉' }
    : avgNum >= 4
      ? { label: 'تقييم جيد جدًا', sub: 'أنت على الطريق الصحيح' }
      : null;

  const avgAnim = useCountUp(avgNum, 1);
  const totalAnim = useCountUp(total);
  const repliedPctAnim = useCountUp(repliedPct);
  const unansweredAnim = useCountUp(unanswered);

  const sorted = useMemo(() => {
    const arr = [...reviews];
    if (sort === 'newest') arr.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    else if (sort === 'oldest') arr.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
    else if (sort === 'highest') arr.sort((a, b) => b.rating - a.rating);
    else arr.sort((a, b) => a.rating - b.rating);
    return arr;
  }, [reviews, sort]);

  const latest3 = useMemo(() => [...reviews].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 3), [reviews]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sorted.filter((r) => {
      if (filter === 'answered' && !r.ownerReply) return false;
      if (filter === 'unanswered' && r.ownerReply) return false;
      if (typeof filter === 'number' && Math.round(r.rating) !== filter) return false;
      if (q && !(`${r.userName} ${r.comment}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [sorted, filter, search]);

  // Lazy loading for the all-reviews list.
  useEffect(() => { setVisibleCount(8); }, [filter, search, sort, view]);
  useEffect(() => {
    if (view !== 'all' || !sentinelRef.current) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) setVisibleCount((c) => c + 8);
    }, { rootMargin: '200px' });
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [view, filtered.length]);

  const flash = (m: string) => { setSuccessMsg(m); setTimeout(() => setSuccessMsg(''), 3500); };
  const openReply = (rev: Review) => { setReplyFor(rev); setReplyText(rev.ownerReply || ''); };
  const submitReply = () => {
    if (!replyFor || !replyText.trim()) return;
    onUpdateReview?.({ ...replyFor, ownerReply: replyText.trim(), ownerReplyCreatedAt: new Date().toISOString() });
    setReplyFor(null); setReplyText('');
    flash('تم إرسال الرد وسيظهر على صفحة بيتك.');
  };
  const deleteReply = (rev: Review) => {
    if (!confirm('حذف هذا الرد؟')) return;
    onUpdateReview?.({ ...rev, ownerReply: undefined, ownerReplyCreatedAt: undefined });
    flash('تم حذف الرد.');
  };

  // ── shared review card ──
  const ReviewCard = (rev: Review) => {
    const isNew = !rev.ownerReply && (Date.now() - +new Date(rev.createdAt)) < 3 * 86_400_000;
    return (
      <div key={rev.id} className="bg-[var(--color-owner-surface)] rounded-[22px] border border-[var(--color-owner-border)] p-4 space-y-3 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-[var(--color-owner-primary)] text-white flex items-center justify-center text-sm font-black shrink-0">{rev.userName.charAt(0)}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-black text-[var(--color-owner-text)] truncate">{rev.userName}</span>
              {rev.ownerReply
                ? <span className="shrink-0 text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">تم الرد</span>
                : isNew
                  ? <span className="shrink-0 text-[9px] font-black px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200">جديد</span>
                  : <span className="shrink-0 text-[9px] font-black px-2 py-0.5 rounded-full bg-[var(--color-owner-bg)] text-[var(--color-owner-secondary)] border border-[var(--color-owner-border)]">بدون رد</span>}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Stars value={rev.rating} className="w-3 h-3" />
              <span className="text-[9px] text-[var(--color-owner-secondary)] font-bold">{timeAgo(rev.createdAt)}</span>
            </div>
          </div>
        </div>

        {rev.comment && <p className="text-[11.5px] text-[var(--color-owner-text)] leading-relaxed">"{rev.comment}"</p>}

        {(rev.likedTags?.length || rev.problemTags?.length) ? (
          <div className="flex flex-wrap gap-1.5">
            {rev.likedTags?.map((tag) => (
              <span key={`l-${tag}`} className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-1.5 py-0.5"><ThumbsUp className="w-2.5 h-2.5" /> {tag}</span>
            ))}
            {rev.problemTags?.map((tag) => (
              <span key={`p-${tag}`} className="inline-flex items-center gap-1 text-[9px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-1.5 py-0.5"><AlertTriangle className="w-2.5 h-2.5" /> {tag}</span>
            ))}
          </div>
        ) : null}

        {rev.ownerReply ? (
          <div className="bg-[var(--color-owner-bg)] border border-[var(--color-owner-border)] rounded-2xl p-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[9.5px] font-black text-[var(--color-owner-primary)] flex items-center gap-1"><MessageSquare className="w-3 h-3" /> رد الإدارة</span>
              {rev.ownerReplyCreatedAt && <span className="text-[8.5px] text-[var(--color-owner-secondary)] font-bold">{timeAgo(rev.ownerReplyCreatedAt)}</span>}
            </div>
            <p className="text-[10.5px] text-[var(--color-owner-text)] leading-relaxed">{rev.ownerReply}</p>
            <div className="flex gap-2 justify-end pt-0.5">
              <button type="button" onClick={() => openReply(rev)} className="flex items-center gap-1 text-[9.5px] font-bold text-[var(--color-owner-primary)]"><Pencil className="w-3 h-3" /> تعديل</button>
              <button type="button" onClick={() => deleteReply(rev)} className="flex items-center gap-1 text-[9.5px] font-bold text-rose-600"><Trash2 className="w-3 h-3" /> حذف</button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-2 pt-0.5">
            <button type="button" onClick={() => openReply(rev)}
              className="flex items-center gap-1 bg-[var(--color-owner-primary)] text-white text-[10.5px] font-black px-3.5 py-1.5 rounded-xl active:scale-[0.98] transition-transform">
              <CornerDownLeft className="w-3.5 h-3.5" /> الرد
            </button>
          </div>
        )}
      </div>
    );
  };

  if (total === 0) {
    return (
      <div className="space-y-3" dir="rtl">
        <ReviewsHeader />
        <div className="bg-[var(--color-owner-surface)] rounded-[24px] border border-[var(--color-owner-border)] p-10 text-center space-y-2">
          <MessageSquare className="w-9 h-9 text-[var(--color-owner-secondary)]/40 mx-auto" />
          <p className="text-xs font-bold text-[var(--color-owner-text)]">لا توجد تقييمات لبيتك بعد.</p>
          <p className="text-[10px] text-[var(--color-owner-secondary)]">ستظهر هنا آراء الضيوف فور تقييمهم لإقامتهم.</p>
        </div>
      </div>
    );
  }

  // ── LEVEL 2: All reviews ──
  if (view === 'all') {
    const shown = filtered.slice(0, visibleCount);
    return (
      <div className="space-y-3" dir="rtl">
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => setView('dashboard')} className="flex items-center gap-1 text-[11px] font-bold text-[var(--color-owner-secondary)]">
            <ChevronLeft className="w-4 h-4 rotate-180" /> رجوع للملخص
          </button>
          <h2 className="text-sm font-black text-[var(--color-owner-text)]">كل التقييمات ({total})</h2>
        </div>

        {successMsg && <Flash msg={successMsg} />}

        {/* Sticky search + filters */}
        <div className="sticky top-0 z-10 -mx-1 px-1 py-2 bg-[var(--color-owner-bg)] space-y-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[var(--color-owner-secondary)] absolute right-3 top-1/2 -translate-y-1/2" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث بالاسم أو نص التقييم…"
              className="w-full bg-[var(--color-owner-surface)] border border-[var(--color-owner-border)] rounded-2xl pr-9 pl-3 py-2.5 text-[11px] text-[var(--color-owner-text)] outline-none focus:border-[var(--color-owner-primary)]" />
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {([['all', `الكل (${total})`], ['answered', `تم الرد (${answered})`], ['unanswered', `بدون رد (${unanswered})`], [5, '5★'], [4, '4★'], [3, '3★'], [2, '2★'], [1, '1★']] as [FilterKey, string][]).map(([k, label]) => (
              <button key={String(k)} type="button" onClick={() => setFilter(k)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-black border transition-colors ${filter === k ? 'bg-[var(--color-owner-primary)] text-white border-[var(--color-owner-primary)]' : 'bg-[var(--color-owner-surface)] text-[var(--color-owner-secondary)] border-[var(--color-owner-border)]'}`}>{label}</button>
            ))}
          </div>
          <div className="flex gap-1.5">
            {([['newest', 'الأحدث'], ['oldest', 'الأقدم'], ['highest', 'الأعلى'], ['lowest', 'الأقل']] as [SortKey, string][]).map(([k, label]) => (
              <button key={k} type="button" onClick={() => setSort(k)}
                className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border ${sort === k ? 'bg-[var(--color-owner-hover)] text-[var(--color-owner-primary)] border-[var(--color-owner-border)]' : 'bg-[var(--color-owner-surface)] text-[var(--color-owner-secondary)] border-[var(--color-owner-border)]'}`}>{label}</button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="bg-[var(--color-owner-surface)] rounded-2xl border border-[var(--color-owner-border)] p-8 text-center text-[11px] text-[var(--color-owner-secondary)] font-bold">لا توجد تقييمات مطابقة.</div>
        ) : (
          <div className="space-y-2.5">
            {shown.map((rev) => ReviewCard(rev))}
            {visibleCount < filtered.length && (
              <div ref={sentinelRef} className="py-3 text-center text-[10px] text-[var(--color-owner-secondary)] font-bold">جارٍ تحميل المزيد…</div>
            )}
          </div>
        )}

        {replySheet()}
      </div>
    );
  }

  // ── LEVEL 1: Dashboard ──
  return (
    <div className="space-y-3" dir="rtl">
      <ReviewsHeader />
      {successMsg && <Flash msg={successMsg} />}

      {/* Summary */}
      <div className="bg-[var(--color-owner-surface)] rounded-[24px] border border-[var(--color-owner-border)] p-4 shadow-sm">
        <div className="flex gap-4">
          <div className="text-center shrink-0 pt-1">
            <div className="text-4xl font-black text-[var(--color-owner-primary)] leading-none flex items-center gap-1 justify-center">{avgAnim}<Star className="w-5 h-5 text-amber-400 fill-amber-400" /></div>
            <div className="text-[10px] font-black text-[var(--color-owner-text)] mt-1">{avgNum >= 4.5 ? 'ممتاز' : avgNum >= 4 ? 'جيد جدًا' : avgNum >= 3 ? 'جيد' : 'مقبول'}</div>
            <Stars value={avgNum} className="w-3 h-3 mt-1" />
            <div className="text-[9px] text-[var(--color-owner-secondary)] font-bold mt-1">({total} تقييم)</div>
          </div>
          <div className="flex-1 space-y-1.5 pt-0.5">
            {[5, 4, 3, 2, 1].map((star, i) => {
              const pct = total > 0 ? Math.round((dist[star] / total) * 100) : 0;
              return (
                <div key={star} className="flex items-center gap-2">
                  <span className="text-[9px] font-bold text-[var(--color-owner-secondary)] w-5 shrink-0 flex items-center gap-0.5">{star}<Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400" /></span>
                  <span className="flex-1 h-2 rounded-full bg-[var(--color-owner-bg)] overflow-hidden">
                    <span className="block h-full bg-amber-400 rounded-full transition-all duration-700" style={{ width: `${pct}%`, transitionDelay: `${i * 60}ms` }} />
                  </span>
                  <span className="text-[9px] font-bold text-[var(--color-owner-secondary)] w-14 shrink-0 text-left">{pct}% ({dist[star]})</span>
                </div>
              );
            })}
          </div>
        </div>

        {badge && (
          <div className="mt-3 flex items-center gap-2.5 bg-[#D4AF37]/10 border border-[#D4AF37]/25 rounded-2xl p-3">
            <div className="w-9 h-9 rounded-full bg-[#D4AF37]/20 flex items-center justify-center shrink-0"><Award className="w-4.5 h-4.5 text-[#B8901F]" /></div>
            <div className="min-w-0">
              <div className="text-[11px] font-black text-[var(--color-owner-text)]">{badge.label}</div>
              <div className="text-[9.5px] font-bold text-[var(--color-owner-secondary)]">{badge.sub}</div>
            </div>
          </div>
        )}

        <button type="button" onClick={() => setView('all')}
          className="mt-3 w-full flex items-center justify-center gap-2 bg-[var(--color-owner-primary)] text-white text-[11px] font-black py-2.5 rounded-2xl active:scale-[0.99] transition-transform">
          عرض جميع التقييمات
        </button>
      </div>

      {/* AI guest insights */}
      {(likedTop.length > 0 || complaintTop) && (
        <div className="bg-[var(--color-owner-surface)] rounded-[24px] border border-[var(--color-owner-border)] p-4 space-y-3 shadow-sm">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-[#D4AF37]" />
            <span className="text-xs font-black text-[var(--color-owner-text)]">تحليل آراء الضيوف</span>
          </div>
          {likedTop.length > 0 && (
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0"><Smile className="w-4 h-4 text-emerald-600" /></div>
              <div>
                <div className="text-[10px] font-black text-[var(--color-owner-text)]">أكثر ما أعجب الضيوف</div>
                <div className="text-[10.5px] font-bold text-[var(--color-owner-secondary)]">{likedTop.join(' · ')}</div>
              </div>
            </div>
          )}
          {complaintList.length > 0 && (
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-rose-50 flex items-center justify-center shrink-0"><AlertTriangle className="w-4 h-4 text-rose-600" /></div>
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-black text-[var(--color-owner-text)]">أكثر الشكاوى تكرارًا</div>
                  <div className="text-[9px] font-bold text-[var(--color-owner-secondary)]">{complaintList.length} نوع</div>
                </div>
                {complaintList.slice(0, 6).map((c, i) => (
                  <div key={c.tag} className="flex items-center gap-2">
                    <span className="text-[9px] font-black text-[var(--color-owner-secondary)] w-4 shrink-0">{i + 1}</span>
                    <span className="text-[10px] font-bold text-[var(--color-owner-text)] w-24 shrink-0 truncate">{c.tag}</span>
                    <span className="flex-1 h-1.5 rounded-full bg-[var(--color-owner-bg)] overflow-hidden">
                      <span className="block h-full bg-rose-400 rounded-full" style={{ width: `${(c.count / complaintMax) * 100}%` }} />
                    </span>
                    <span className="text-[9px] font-black text-rose-600 w-8 shrink-0 text-left">{c.count} {c.count === 1 ? 'مرة' : 'مرات'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {complaintTop && (
            <div className="flex items-start gap-2.5 bg-[var(--color-owner-bg)] rounded-2xl p-2.5">
              <div className="w-8 h-8 rounded-xl bg-sky-50 flex items-center justify-center shrink-0"><Lightbulb className="w-4 h-4 text-sky-600" /></div>
              <p className="text-[10.5px] font-bold text-[var(--color-owner-text)] leading-relaxed">تحسين <span className="text-[var(--color-owner-primary)]">{complaintTop}</span> قد يرفع متوسط تقييمك إلى {targetRating.toFixed(1)}.</p>
            </div>
          )}
        </div>
      )}

      {/* Statistics */}
      <div className="bg-[var(--color-owner-surface)] rounded-[24px] border border-[var(--color-owner-border)] p-4 space-y-3 shadow-sm">
        <div className="flex items-center gap-1.5">
          <BarChart3 className="w-4 h-4 text-[var(--color-owner-primary)]" />
          <span className="text-xs font-black text-[var(--color-owner-text)]">إحصائيات التقييمات</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'متوسط التقييم', value: avgAnim, suffix: '★', color: 'text-amber-500' },
            { label: 'إجمالي التقييمات', value: totalAnim, suffix: '', color: 'text-[var(--color-owner-text)]' },
            { label: 'تم الرد', value: `${repliedPctAnim}%`, suffix: '', color: 'text-emerald-600' },
            { label: 'بدون رد', value: unansweredAnim, suffix: '', color: 'text-rose-600' },
          ].map((s) => (
            <div key={s.label} className="bg-[var(--color-owner-bg)] rounded-2xl p-3 text-center">
              <div className={`text-xl font-black ${s.color}`}>{s.value}{s.suffix}</div>
              <div className="text-[9px] font-bold text-[var(--color-owner-secondary)] mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Latest 3 reviews */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-black text-[var(--color-owner-text)]">أحدث التقييمات</span>
        <button type="button" onClick={() => setView('all')} className="text-[10px] font-bold text-[var(--color-owner-primary)]">عرض الكل</button>
      </div>
      <div className="space-y-2.5">
        {latest3.map((rev) => ReviewCard(rev))}
      </div>

      {replySheet()}
    </div>
  );

  // ── reply bottom sheet (shared by both levels) ──
  function replySheet() {
    const suggestions = replyFor ? replySuggestions(replyFor) : [];
    return (
      <BottomSheet open={!!replyFor} onClose={() => setReplyFor(null)} title={replyFor?.ownerReply ? 'تعديل الرد' : 'الرد على التقييم'}>
        {replyFor && (
          <div className="space-y-3">
            <div className="bg-[var(--color-owner-bg)] rounded-2xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-black text-[var(--color-owner-text)]">{replyFor.userName}</span>
                <Stars value={replyFor.rating} className="w-3 h-3" />
              </div>
              <p className="text-[10.5px] text-[var(--color-owner-secondary)] leading-relaxed">"{replyFor.comment}"</p>
            </div>

            {/* AI reply suggestions */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1 text-[10px] font-black text-[var(--color-owner-text)]"><Sparkles className="w-3 h-3 text-[#D4AF37]" /> اقتراح رد</div>
              <div className="flex gap-1.5">
                {suggestions.map((s) => (
                  <button key={s.key} type="button" onClick={() => setReplyText(s.text)}
                    className="flex-1 text-[9.5px] font-black text-[var(--color-owner-primary)] bg-[var(--color-owner-bg)] border border-[var(--color-owner-border)] rounded-xl py-2">{s.label}</button>
                ))}
              </div>
            </div>

            <div className="relative">
              <textarea value={replyText} onChange={(e) => setReplyText(e.target.value.slice(0, REPLY_MAX))} rows={4}
                placeholder="اكتب ردًا رسميًا ومهذبًا باسم بيتك…"
                className="w-full bg-[var(--color-owner-bg)] border border-[var(--color-owner-border)] rounded-2xl p-3 text-[11px] text-[var(--color-owner-text)] outline-none focus:border-[var(--color-owner-primary)] resize-none" />
              <span className="absolute bottom-2 left-3 text-[8.5px] font-bold text-[var(--color-owner-secondary)]">{replyText.length}/{REPLY_MAX}</span>
            </div>

            <button type="button" onClick={submitReply} disabled={!replyText.trim()}
              className="w-full flex items-center justify-center gap-1.5 bg-[var(--color-owner-primary)] disabled:opacity-40 text-white text-[11px] font-black py-3 rounded-2xl">
              <Send className="w-4 h-4" /> إرسال الرد
            </button>
          </div>
        )}
      </BottomSheet>
    );
  }
}

// ── module helpers ─────────────────────────────────────────────────
function aggTags(reviews: Review[], key: 'likedTags' | 'problemTags'): string[] {
  const m = new Map<string, number>();
  reviews.forEach((r) => (r[key] || []).forEach((tag) => m.set(tag, (m.get(tag) || 0) + 1)));
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map((e) => e[0]);
}

// Ranked tags with counts; optionally folds in a free-text field ("other").
function aggTagsWithCounts(reviews: Review[], key: 'likedTags' | 'problemTags', otherKey?: 'problemOther'): { tag: string; count: number }[] {
  const m = new Map<string, number>();
  reviews.forEach((r) => {
    (r[key] || []).forEach((tag) => m.set(tag, (m.get(tag) || 0) + 1));
    if (otherKey) {
      const other = (r[otherKey] || '').trim();
      if (other) m.set(other, (m.get(other) || 0) + 1);
    }
  });
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([tag, count]) => ({ tag, count }));
}

function ReviewsHeader() {
  return (
    <div>
      <h2 className="text-base font-black text-[var(--color-owner-text)] flex items-center gap-1.5">
        <MessageSquare className="w-4.5 h-4.5 text-[var(--color-owner-primary)]" /> التقييمات
      </h2>
      <p className="text-[11px] text-[var(--color-owner-secondary)] mt-0.5">آراء ضيوف بيت المؤتمرات</p>
    </div>
  );
}

function Flash({ msg }: { msg: string }) {
  return (
    <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-3 rounded-2xl flex items-center gap-2 text-[11px] font-bold">
      <Check className="w-4 h-4 shrink-0" /> {msg}
    </div>
  );
}
