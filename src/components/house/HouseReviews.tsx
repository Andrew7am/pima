import React, { useMemo, useState } from 'react';
import { Review } from '../../types';
import {
  Star, ChevronDown, Sparkles, BedDouble, UtensilsCrossed, ClipboardList,
  Wallet, Info, CornerDownLeft, PencilLine, Award, SlidersHorizontal, Users,
} from 'lucide-react';
import { tapFeedback } from '../../lib/haptics';

interface HouseReviewsProps {
  reviews: Review[];
  /** Rendered under the list — the wizard, or the sign-in prompt. */
  children?: React.ReactNode;
}

type SortKey = 'all' | 'highest' | 'lowest' | 'newest';

const CARD = 'bg-white rounded-3xl border border-[#EDE7DA] shadow-[0_8px_24px_rgba(0,0,0,0.06),0_2px_6px_rgba(0,0,0,0.03)]';

const scoreWord = (n: number) =>
  n >= 4.7 ? 'استثنائية' : n >= 4.3 ? 'ممتاز جدًا' : n >= 3.5 ? 'جيد جدًا' : n >= 2.5 ? 'جيد' : 'مقبول';

/** "منذ ٣ أيام" — how people actually refer to a recent review. */
function relativeDate(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const days = Math.floor((Date.now() - then) / 86400000);
  if (days <= 0) return 'اليوم';
  if (days === 1) return 'أمس';
  if (days < 7) return `منذ ${days} أيام`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return 'منذ أسبوع';
  if (weeks === 2) return 'منذ أسبوعين';
  if (weeks < 5) return `منذ ${weeks} أسابيع`;
  const months = Math.floor(days / 30);
  if (months === 1) return 'منذ شهر';
  if (months === 2) return 'منذ شهرين';
  if (months < 12) return `منذ ${months} أشهر`;
  const years = Math.floor(days / 365);
  return years === 1 ? 'منذ سنة' : years === 2 ? 'منذ سنتين' : `منذ ${years} سنوات`;
}

/** Half-star aware row. */
function Stars({ value, size = 'w-3.5 h-3.5' }: { value: number; size?: string }) {
  return (
    <span className="flex items-center gap-0.5" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((s) => {
        const fill = Math.max(0, Math.min(1, value - (s - 1)));
        return (
          <span key={s} className={`relative ${size} inline-block`}>
            <Star className={`absolute inset-0 ${size} text-[#E6DDCA]`} />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className={`${size} fill-[#E0A82E] text-[#E0A82E]`} />
            </span>
          </span>
        );
      })}
    </span>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <span className="w-11 h-11 rounded-full bg-[#F6F0E2] border border-[#EDE7DA] text-[#B8944E] flex items-center justify-center text-[15px] font-black shrink-0">
      {(name || '؟').trim().charAt(0)}
    </span>
  );
}

/**
 * The guest reviews section.
 *
 * Categories are the five the database actually stores. The reference design
 * asked for راحة, موقع and مرافق as well, but no review carries those numbers —
 * inventing a score for a real place is not a design decision.
 */
export default function HouseReviews({ reviews, children }: HouseReviewsProps) {
  const [sort, setSort] = useState<SortKey>('newest');
  const [visible, setVisible] = useState(5);
  const [categoriesOpen, setCategoriesOpen] = useState(true);
  const [openReply, setOpenReply] = useState<string | null>(null);

  const count = reviews.length;
  const overallOf = (r: Review) => r.overall_rating ?? r.rating;

  const stats = useMemo(() => {
    if (count === 0) return null;
    const avg = reviews.reduce((s, r) => s + overallOf(r), 0) / count;
    // "Recommends" is derived, not asked: the share of guests who rated the
    // stay 4 or better. Nothing in the record is a recommendation as such.
    const recommends = Math.round((reviews.filter((r) => overallOf(r) >= 4).length / count) * 100);
    const dim = (pick: (r: Review) => number | undefined) => {
      const vals = reviews.map((r) => pick(r) ?? r.rating).filter((n) => typeof n === 'number');
      return vals.length ? vals.reduce((s, n) => s + n, 0) / vals.length : 0;
    };
    return {
      avg: Math.round(avg * 10) / 10,
      recommends,
      categories: [
        { key: 'clean', label: 'النظافة', icon: Sparkles,        value: dim((r) => r.cleanliness_rating) },
        { key: 'service', label: 'الخدمة', icon: Users,          value: dim((r) => r.service_rating) },
        { key: 'food', label: 'الطعام',    icon: UtensilsCrossed, value: dim((r) => r.food_rating) },
        { key: 'org', label: 'التنظيم',    icon: ClipboardList,   value: dim((r) => r.organization_rating) },
        { key: 'value', label: 'القيمة',   icon: Wallet,          value: dim((r) => r.value_rating) },
      ].map((c) => ({ ...c, value: Math.round(c.value * 10) / 10 })),
    };
  }, [reviews, count]);

  const sorted = useMemo(() => {
    const list = [...reviews];
    switch (sort) {
      case 'highest': return list.sort((a, b) => overallOf(b) - overallOf(a));
      case 'lowest':  return list.sort((a, b) => overallOf(a) - overallOf(b));
      case 'newest':  return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      default:        return list;
    }
  }, [reviews, sort]);

  const shown = sorted.slice(0, visible);
  const RING = 100.5; // 2πr for r=16

  const tabs: { key: SortKey; label: string }[] = [
    { key: 'all',     label: `الكل (${count})` },
    { key: 'highest', label: 'الأعلى تقييمًا' },
    { key: 'lowest',  label: 'الأقل تقييمًا' },
    { key: 'newest',  label: 'الأحدث' },
  ];

  return (
    <div className="space-y-4 text-right">
      <div className="px-1">
        <h3 className="text-[15px] font-black text-[#0A2342]">التقييمات</h3>
        <p className="text-[10.5px] text-[#8A8A70] font-medium mt-0.5">آراء الضيوف عن المكان</p>
      </div>

      {stats && (
        <>
          {/* ── Overall ── */}
          <div className={`${CARD} p-5 flex items-center gap-4`}>
            <div className="text-center shrink-0">
              <span className="text-[9.5px] font-bold text-[#8A8A70] block">تقييم عام</span>
              <span className="text-[34px] leading-none font-black text-[#B8944E] block my-1">{stats.avg}</span>
              <Stars value={stats.avg} size="w-4 h-4" />
              <span className="text-[9.5px] font-medium text-[#8A8A70] block mt-1">({count} تقييم)</span>
            </div>

            <span aria-hidden="true" className="w-px self-stretch bg-[#EDE7DA]" />

            <div className="flex-1 min-w-0">
              <span className="inline-flex items-center gap-1.5 text-[12px] font-black text-[#0A2342]">
                <Award className="w-4 h-4 text-[#C9A24A]" />
                {scoreWord(stats.avg)}
              </span>
              <p className="text-[10.5px] font-medium text-[#8A8A70] leading-relaxed mt-1">
                أكثر من {stats.recommends}٪ من الضيوف يوصون بهذا المكان
              </p>
            </div>

            <span className="relative w-[76px] h-[76px] shrink-0">
              <svg viewBox="0 0 40 40" className="w-[76px] h-[76px] -rotate-90">
                <circle cx="20" cy="20" r="16" fill="none" stroke="#F2EBDC" strokeWidth="3.5" />
                <circle
                  cx="20" cy="20" r="16" fill="none" stroke="#C9A24A" strokeWidth="3.5" strokeLinecap="round"
                  strokeDasharray={RING} strokeDashoffset={RING - (stats.recommends / 100) * RING}
                  style={{ transition: 'stroke-dashoffset 900ms var(--motion-ease)' }}
                />
              </svg>
              <span className="absolute inset-0 flex flex-col items-center justify-center leading-none">
                <span className="text-[16px] font-black text-[#B8944E]">{stats.recommends}%</span>
                <span className="text-[8px] font-bold text-[#8A8A70] mt-0.5">يوصي به</span>
              </span>
            </span>
          </div>

          {/* ── By category, collapsible ── */}
          <div className={`${CARD} overflow-hidden`}>
            <button
              type="button"
              onClick={() => { tapFeedback(); setCategoriesOpen((v) => !v); }}
              aria-expanded={categoriesOpen}
              className="w-full p-5 flex items-center gap-3 text-right cursor-pointer pima-press"
            >
              <span className="w-12 h-12 rounded-full bg-[#F6F0E2] flex items-center justify-center shrink-0">
                <Star className="w-5 h-5 fill-[#E0A82E] text-[#E0A82E]" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[13px] font-black text-[#0A2342]">تقييم حسب الفئة</span>
                <span className="block text-[10px] font-medium text-[#8A8A70] leading-snug mt-0.5">اطّلع على تقييم كل جانب من تجربة الضيوف</span>
              </span>
              <span aria-hidden="true" className="w-px self-stretch bg-[#EDE7DA]" />
              <span className="text-center shrink-0">
                <span className="block text-[20px] font-black text-[#0A2342] leading-none">{stats.avg}</span>
                <span className="block text-[9.5px] font-bold text-[#B8944E] mt-0.5">{scoreWord(stats.avg)}</span>
                <span className="block mt-1"><Stars value={stats.avg} /></span>
              </span>
              <ChevronDown
                aria-hidden="true"
                className={`w-5 h-5 text-[#B5AF98] shrink-0 transition-transform duration-[300ms] ease-[cubic-bezier(0.33,1,0.68,1)] ${categoriesOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {/* Height, not display: the panel interpolates rather than snapping. */}
            <div
              aria-hidden={!categoriesOpen}
              className={`grid transition-[grid-template-rows,opacity] duration-[300ms] ease-[cubic-bezier(0.33,1,0.68,1)] ${
                categoriesOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
              }`}
            >
              <div className="overflow-hidden">
                <div className="px-5 pb-4 grid grid-cols-2 gap-2.5">
                  {stats.categories.map((c, i) => (
                    <div
                      key={c.key}
                      className="rounded-2xl border border-[#EDE7DA] bg-[#FDFCF9] p-3 flex items-start gap-2.5 pima-rise"
                      style={{ animationDelay: categoriesOpen ? `${i * 60}ms` : '0ms' }}
                    >
                      <span className="w-9 h-9 rounded-full bg-[#F6F0E2] flex items-center justify-center shrink-0">
                        <c.icon className="w-4 h-4 text-[#C9A24A]" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[11px] font-black text-[#0A2342]">{c.label}</span>
                        <span className="block mt-0.5"><Stars value={c.value} size="w-3 h-3" /></span>
                        <span className="flex items-baseline gap-1.5 mt-1">
                          <span className="text-[14px] font-black text-[#0A2342]">{c.value}</span>
                          <span className="text-[8.5px] font-medium text-[#8A8A70]">{scoreWord(c.value)}</span>
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
                <p className="pb-4 flex items-center justify-center gap-1 text-[9px] font-medium text-[#8A8A70]">
                  <Info className="w-3 h-3" />
                  تقييمات الضيوف حقيقية ومحدّثة باستمرار
                </p>
              </div>
            </div>
          </div>

          {/* ── Sort ── */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <span className="w-9 h-9 rounded-full border border-[#EDE7DA] bg-white flex items-center justify-center shrink-0" aria-hidden="true">
              <SlidersHorizontal className="w-4 h-4 text-[#8A8A70]" />
            </span>
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => { tapFeedback(); setSort(t.key); setVisible(5); }}
                aria-pressed={sort === t.key}
                className={`shrink-0 px-4 h-9 rounded-full text-[11px] font-black transition-colors duration-[250ms] cursor-pointer pima-press ${
                  sort === t.key
                    ? 'bg-[#C9A24A] text-white border border-[#C9A24A]'
                    : 'bg-white text-[#4A4A3A] border border-[#EDE7DA] hover:border-[#E3CD9F]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* ── The reviews ── */}
      {count === 0 ? (
        <div className={`${CARD} p-8 text-center space-y-2`}>
          <span className="inline-flex w-12 h-12 rounded-full bg-[#F6F0E2] items-center justify-center">
            <Star className="w-5 h-5 text-[#C9A24A]" />
          </span>
          <p className="text-[12px] font-black text-[#0A2342]">لا توجد تقييمات بعد</p>
          <p className="text-[10px] font-medium text-[#8A8A70]">كن أول من يشارك تجربته ويساعد غيره على الاختيار.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map((rev) => {
            const overall = overallOf(rev);
            const name = rev.displayAnonymous ? 'زائر موثق' : rev.userName;
            const isReplyOpen = openReply === rev.id;
            return (
              <div key={rev.id} className={`${CARD} p-4 space-y-3`}>
                <div className="flex items-start gap-3">
                  <Avatar name={name} />
                  <div className="min-w-0 flex-1">
                    <span className="block text-[12.5px] font-black text-[#0A2342] truncate">{name}</span>
                    <span className="block text-[9.5px] font-medium text-[#8A8A70] mt-0.5">{relativeDate(rev.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[12.5px] font-black text-[#0A2342]">{overall.toFixed(1)}</span>
                    <Stars value={overall} />
                  </div>
                </div>

                {rev.comment && (
                  <p className="text-[11.5px] text-[#4A4A3A] leading-relaxed font-medium">{rev.comment}</p>
                )}

                {/* The owner's reply is offered, not forced — most readers want
                    the guest's words, and the ones who care about the reply ask
                    for it. Shown only where a reply actually exists. */}
                {rev.ownerReply && (
                  <>
                    <button
                      type="button"
                      onClick={() => { tapFeedback(); setOpenReply(isReplyOpen ? null : rev.id); }}
                      aria-expanded={isReplyOpen}
                      className="flex items-center gap-1.5 text-[10px] font-bold text-[#8A8A70] hover:text-[#B8944E] transition-colors cursor-pointer"
                    >
                      <CornerDownLeft className="w-3.5 h-3.5" />
                      {isReplyOpen ? 'إخفاء رد المكان' : 'رد من المكان'}
                    </button>
                    {isReplyOpen && (
                      <div className="bg-[#FBF9F4] border-r-2 border-[#C9A24A] rounded-l-2xl p-3 space-y-1 animate-in fade-in slide-in-from-top-1 duration-200">
                        <div className="flex items-center justify-between text-[10px] font-black text-[#B8944E]">
                          <span>رد إدارة المكان</span>
                          {rev.ownerReplyCreatedAt && (
                            <span className="text-[8.5px] font-medium text-[#8A8A70]">{relativeDate(rev.ownerReplyCreatedAt)}</span>
                          )}
                        </div>
                        <p className="text-[10.5px] text-[#4A4A3A] leading-relaxed font-medium">{rev.ownerReply}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}

          {sorted.length > visible && (
            <button
              type="button"
              onClick={() => { tapFeedback(); setVisible((v) => v + 5); }}
              className="w-full flex items-center justify-center gap-1.5 bg-white hover:bg-[#FBF9F4] border border-[#EDE7DA] text-[#4A4A3A] font-black py-3 rounded-2xl text-[11px] transition-colors cursor-pointer pima-press"
            >
              عرض المزيد
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* ── Add your review ── */}
      <div className={`${CARD} p-5`}>
        <div className="text-center space-y-1 mb-3">
          <span className="inline-flex items-center gap-1.5 text-[13px] font-black text-[#B8944E]">
            <PencilLine className="w-4 h-4" />
            أضف تقييمك
          </span>
          <p className="text-[10px] font-medium text-[#8A8A70]">شارك تجربتك لمساعدة الآخرين</p>
        </div>
        {children}
      </div>
    </div>
  );
}
