import React, { useMemo, useState } from 'react';
import { Review } from '../../types';
import { Star, MessageSquare, Pencil, Trash2, Check, CornerDownLeft, ThumbsUp, AlertTriangle } from 'lucide-react';

interface OwnerReviewsCenterProps {
  reviews: Review[];
  onUpdateReview?: (review: Review) => void;
}

type FilterKey = 'all' | 'unanswered' | 5 | 4 | 3 | 2 | 1;
type SortKey = 'newest' | 'highest' | 'lowest';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'newest', label: 'الأحدث' },
  { key: 'highest', label: 'الأعلى تقييمًا' },
  { key: 'lowest', label: 'الأقل تقييمًا' },
];

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
  if (days < 30) return `منذ ${days} يوم`;
  const months = Math.floor(days / 30);
  return months === 1 ? 'منذ شهر' : `منذ ${months} أشهر`;
}

export default function OwnerReviewsCenter({ reviews, onUpdateReview }: OwnerReviewsCenterProps) {
  const [filter, setFilter] = useState<FilterKey>('all');
  const [sort, setSort] = useState<SortKey>('newest');
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const avg = reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  const dist = useMemo(() => {
    const d: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach((r) => { const k = Math.min(5, Math.max(1, Math.round(r.rating))); d[k]++; });
    return d;
  }, [reviews]);
  const maxDist = Math.max(1, ...Object.values(dist));
  const unansweredCount = reviews.filter((r) => !r.ownerReply).length;

  const filtered = useMemo(() => {
    let list = reviews;
    if (filter === 'unanswered') list = list.filter((r) => !r.ownerReply);
    else if (typeof filter === 'number') list = list.filter((r) => Math.round(r.rating) === filter);
    const sorted = [...list];
    if (sort === 'newest') sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    else if (sort === 'highest') sorted.sort((a, b) => b.rating - a.rating);
    else sorted.sort((a, b) => a.rating - b.rating);
    return sorted;
  }, [reviews, filter, sort]);

  const flash = (msg: string) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 4000); };
  const submitReply = (rev: Review) => {
    if (!replyText.trim()) return;
    onUpdateReview?.({ ...rev, ownerReply: replyText.trim(), ownerReplyCreatedAt: new Date().toISOString() });
    setReplyingId(null); setReplyText('');
    flash('تم إرسال الرد الرسمي وسيظهر للجميع على صفحة البيت.');
  };
  const deleteReply = (rev: Review) => {
    if (!confirm('حذف هذا الرد؟')) return;
    onUpdateReview?.({ ...rev, ownerReply: undefined, ownerReplyCreatedAt: undefined });
    flash('تم حذف الرد.');
  };

  const FILTERS: { key: FilterKey; label: string }[] = [
    { key: 'all', label: `الكل (${reviews.length})` },
    { key: 'unanswered', label: `بدون رد (${unansweredCount})` },
    { key: 5, label: '5★' }, { key: 4, label: '4★' }, { key: 3, label: '3★' }, { key: 2, label: '2★' }, { key: 1, label: '1★' },
  ];

  return (
    <div className="space-y-3" dir="rtl">
      <div>
        <h2 className="text-base font-black text-[var(--color-owner-text)] flex items-center gap-1.5">
          <MessageSquare className="w-4.5 h-4.5 text-[var(--color-owner-primary)]" /> التقييمات والردود
        </h2>
        <p className="text-[11px] text-[var(--color-owner-secondary)] mt-0.5">اطّلع على آراء الضيوف وردّ عليها رسميًا باسم بيتك.</p>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-3 rounded-2xl flex items-center gap-2 text-[11px] font-bold">
          <Check className="w-4 h-4 shrink-0" /> {successMsg}
        </div>
      )}

      {reviews.length === 0 ? (
        <div className="bg-[var(--color-owner-surface)] rounded-3xl border border-[var(--color-owner-border)] p-10 text-center space-y-2">
          <MessageSquare className="w-8 h-8 text-[var(--color-owner-secondary)]/40 mx-auto" />
          <p className="text-xs font-bold text-[var(--color-owner-text)]">لا توجد تقييمات لبيتك بعد.</p>
          <p className="text-[10px] text-[var(--color-owner-secondary)]">ستظهر هنا آراء الضيوف فور تقييمهم لإقامتهم.</p>
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="bg-[var(--color-owner-surface)] rounded-3xl border border-[var(--color-owner-border)] p-4 flex items-center gap-4">
            <div className="text-center shrink-0">
              <div className="text-4xl font-black text-[var(--color-owner-text)] leading-none">{avg.toFixed(1)}</div>
              <Stars value={avg} className="w-3.5 h-3.5" />
              <div className="text-[9.5px] text-[var(--color-owner-secondary)] font-bold mt-1">{reviews.length} تقييم</div>
            </div>
            <div className="flex-1 space-y-1">
              {[5, 4, 3, 2, 1].map((star) => (
                <button key={star} type="button" onClick={() => setFilter(filter === star ? 'all' : (star as FilterKey))}
                  className="w-full flex items-center gap-2 group">
                  <span className="text-[9px] font-bold text-[var(--color-owner-secondary)] w-6 shrink-0 flex items-center gap-0.5">{star}<Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400" /></span>
                  <span className="flex-1 h-2 rounded-full bg-[var(--color-owner-bg)] overflow-hidden">
                    <span className="block h-full bg-amber-400 rounded-full transition-all" style={{ width: `${(dist[star] / maxDist) * 100}%` }} />
                  </span>
                  <span className="text-[9px] font-bold text-[var(--color-owner-secondary)] w-4 shrink-0 text-left">{dist[star]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Needs-reply nudge */}
          {unansweredCount > 0 && (
            <button type="button" onClick={() => setFilter('unanswered')}
              className="w-full flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-2xl p-3 text-right">
              <CornerDownLeft className="w-4 h-4 text-amber-700 shrink-0" />
              <span className="text-[11px] font-bold text-amber-900">لديك {unansweredCount} {unansweredCount === 1 ? 'تقييم' : 'تقييمات'} بدون رد — ردّ عليها لتعزيز ثقة الضيوف.</span>
            </button>
          )}

          {/* Filters + sort */}
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-0.5 px-0.5">
            {FILTERS.map((f) => (
              <button key={String(f.key)} type="button" onClick={() => setFilter(f.key)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-[10.5px] font-black border transition-colors ${filter === f.key ? 'bg-[var(--color-owner-primary)] text-white border-[var(--color-owner-primary)]' : 'bg-[var(--color-owner-surface)] text-[var(--color-owner-secondary)] border-[var(--color-owner-border)]'}`}>
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            {SORTS.map((s) => (
              <button key={s.key} type="button" onClick={() => setSort(s.key)}
                className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border ${sort === s.key ? 'bg-[var(--color-owner-hover)] text-[var(--color-owner-primary)] border-[var(--color-owner-border)]' : 'bg-[var(--color-owner-surface)] text-[var(--color-owner-secondary)] border-[var(--color-owner-border)]'}`}>
                {s.label}
              </button>
            ))}
          </div>

          {/* Review cards */}
          {filtered.length === 0 ? (
            <div className="bg-[var(--color-owner-surface)] rounded-2xl border border-[var(--color-owner-border)] p-6 text-center text-[11px] text-[var(--color-owner-secondary)] font-bold">لا توجد تقييمات مطابقة.</div>
          ) : (
            <div className="space-y-2.5">
              {filtered.map((rev) => (
                <div key={rev.id} className="bg-[var(--color-owner-surface)] rounded-2xl border border-[var(--color-owner-border)] p-3.5 space-y-2.5">
                  <div className="flex items-start gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-[var(--color-owner-primary)] text-white flex items-center justify-center text-xs font-black shrink-0">{rev.userName.charAt(0)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12px] font-black text-[var(--color-owner-text)] truncate">{rev.userName}</span>
                        <span className="text-[9px] text-[var(--color-owner-secondary)] font-bold shrink-0">{timeAgo(rev.createdAt)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Stars value={rev.rating} className="w-3 h-3" />
                        {rev.houseName && <span className="text-[9px] text-[var(--color-owner-secondary)] font-bold truncate">· {rev.houseName}</span>}
                      </div>
                    </div>
                  </div>

                  {rev.comment && <p className="text-[11px] text-[var(--color-owner-text)] leading-relaxed font-medium">"{rev.comment}"</p>}

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

                  {/* Reply area */}
                  {rev.ownerReply && replyingId !== rev.id ? (
                    <div className="bg-[var(--color-owner-primary)]/5 border-r-2 border-[var(--color-owner-primary)] rounded-l-2xl p-2.5 space-y-1.5">
                      <div className="text-[9.5px] font-black text-[var(--color-owner-primary)]">ردّك باسم البيت 🏨</div>
                      <p className="text-[10.5px] text-[var(--color-owner-text)] leading-relaxed">{rev.ownerReply}</p>
                      <div className="flex gap-2 justify-end">
                        <button type="button" onClick={() => { setReplyingId(rev.id); setReplyText(rev.ownerReply || ''); }} className="flex items-center gap-1 text-[9.5px] font-bold text-[var(--color-owner-primary)]"><Pencil className="w-3 h-3" /> تعديل</button>
                        <button type="button" onClick={() => deleteReply(rev)} className="flex items-center gap-1 text-[9.5px] font-bold text-rose-600"><Trash2 className="w-3 h-3" /> حذف</button>
                      </div>
                    </div>
                  ) : replyingId === rev.id ? (
                    <div className="space-y-2">
                      <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} rows={3} placeholder="اكتب ردًا رسميًا ومهذبًا باسم بيتك…"
                        className="w-full bg-[var(--color-owner-bg)] border border-[var(--color-owner-border)] rounded-xl p-2.5 text-[11px] text-[var(--color-owner-text)] outline-none focus:border-[var(--color-owner-primary)] resize-none" />
                      <div className="flex gap-2">
                        <button type="button" onClick={() => submitReply(rev)} disabled={!replyText.trim()}
                          className="bg-[var(--color-owner-primary)] disabled:opacity-40 text-white text-[10.5px] font-black px-3.5 py-1.5 rounded-lg">إرسال الرد</button>
                        <button type="button" onClick={() => { setReplyingId(null); setReplyText(''); }}
                          className="bg-[var(--color-owner-bg)] text-[var(--color-owner-text)] text-[10.5px] font-bold px-3.5 py-1.5 rounded-lg">إلغاء</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-end">
                      <button type="button" onClick={() => { setReplyingId(rev.id); setReplyText(''); }}
                        className="flex items-center gap-1 bg-[var(--color-owner-primary)]/10 text-[var(--color-owner-primary)] text-[10.5px] font-black px-3 py-1.5 rounded-xl">
                        <CornerDownLeft className="w-3.5 h-3.5" /> رد رسمي
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
