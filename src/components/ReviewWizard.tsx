import React, { useState } from 'react';
import { Review, RetreatHouse, User } from '../types';
import { Star, ChevronRight, Check, UserCheck, MessageSquareQuote, CheckCircle2, Home } from 'lucide-react';

interface ReviewWizardProps {
  house: RetreatHouse;
  currentUser: User;
  onSubmitReview: (review: Review) => void;
  onDone?: () => void;
  previewMode?: boolean;
}

type DetailKey = 'cleanliness' | 'service' | 'food' | 'organization' | 'value';

const DETAIL_DIMENSIONS: { key: DetailKey; label: string; emoji: string }[] = [
  { key: 'cleanliness', label: 'النظافة', emoji: '🧼' },
  { key: 'service', label: 'الخدمة', emoji: '🤵' },
  { key: 'food', label: 'الطعام', emoji: '🍗' },
  { key: 'organization', label: 'التنظيم', emoji: '📋' },
  { key: 'value', label: 'القيمة مقابل السعر', emoji: '💰' },
];

const VISIT_PURPOSES: { key: NonNullable<Review['visitPurpose']>; label: string; emoji: string }[] = [
  { key: 'conference', label: 'مؤتمر', emoji: '🏕' },
  { key: 'business_meeting', label: 'اجتماع عمل', emoji: '💼' },
  { key: 'training_course', label: 'دورة تدريبية', emoji: '🎓' },
  { key: 'exhibition', label: 'معرض', emoji: '🖼' },
  { key: 'other', label: 'أخرى', emoji: '✨' },
];

const LIKED_TAGS: { key: string; label: string; emoji: string }[] = [
  { key: 'cleanliness', label: 'النظافة', emoji: '✨' },
  { key: 'service', label: 'الخدمة', emoji: '🤵' },
  { key: 'food', label: 'الطعام', emoji: '🍽' },
  { key: 'rooms', label: 'الغرف', emoji: '🛏' },
  { key: 'quiet', label: 'الهدوء', emoji: '🤫' },
  { key: 'organization', label: 'التنظيم', emoji: '📋' },
  { key: 'location', label: 'الموقع', emoji: '📍' },
  { key: 'value', label: 'القيمة مقابل السعر', emoji: '💰' },
  { key: 'checkin', label: 'سهولة تسجيل الدخول', emoji: '⏱' },
  { key: 'facilities', label: 'المرافق', emoji: '🏢' },
];

const PROBLEM_TAGS: { key: string; label: string; emoji: string }[] = [
  { key: 'internet', label: 'الإنترنت', emoji: '📶' },
  { key: 'ac', label: 'التكييف', emoji: '❄️' },
  { key: 'food', label: 'الطعام', emoji: '🍽' },
  { key: 'rooms', label: 'الغرف', emoji: '🛏' },
  { key: 'cleanliness', label: 'النظافة', emoji: '✨' },
  { key: 'noise', label: 'الضوضاء', emoji: '🔊' },
  { key: 'water', label: 'المياه', emoji: '💧' },
  { key: 'facilities', label: 'المرافق', emoji: '🏢' },
  { key: 'other', label: 'أخرى', emoji: '⋯' },
];

const TAG_LABEL: Record<string, string> = Object.fromEntries(
  [...LIKED_TAGS, ...PROBLEM_TAGS].map((t) => [t.key, t.label])
);
const PURPOSE_LABEL: Record<string, string> = Object.fromEntries(VISIT_PURPOSES.map((p) => [p.key, `${p.emoji} ${p.label}`]));

function ratingLabel(n: number): string {
  return n >= 4.5 ? 'ممتاز' : n >= 3.5 ? 'جيد جداً' : n >= 2.5 ? 'جيد' : n >= 1.5 ? 'مقبول' : 'ضعيف';
}

function StarPicker({ value, onChange, size = 'w-6 h-6' }: { value: number; onChange: (v: number) => void; size?: string }) {
  return (
    <div className="flex gap-1 justify-center">
      {[1, 2, 3, 4, 5].map((s) => (
        <button key={s} type="button" onClick={() => onChange(s)} className="cursor-pointer p-0.5 focus:outline-none">
          <Star className={`${size} transition-colors ${s <= value ? 'text-amber-500 fill-amber-500' : 'text-[#D6D6C2] hover:text-amber-300'}`} />
        </button>
      ))}
    </div>
  );
}

function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
  const steps: { n: 1 | 2 | 3; label: string }[] = [
    { n: 1, label: 'التقييم' },
    { n: 2, label: 'التفاصيل' },
    { n: 3, label: 'ملاحظات' },
  ];
  return (
    <div className="flex items-center justify-center gap-2">
      {steps.map((s, i) => (
        <React.Fragment key={s.n}>
          <div className="flex flex-col items-center gap-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black transition-colors ${
              step === s.n ? 'bg-[#5A5A40] text-white' : step > s.n ? 'bg-emerald-100 text-emerald-700' : 'bg-[#EBEBE0] text-[#8A8A70]'
            }`}>
              {step > s.n ? <Check className="w-3.5 h-3.5" /> : s.n}
            </div>
            <span className="text-[9px] font-bold text-[#8A8A70]">{s.label}</span>
          </div>
          {i < steps.length - 1 && <div className={`w-8 h-0.5 mb-4 transition-colors ${step > s.n ? 'bg-emerald-300' : 'bg-[#EBEBE0]'}`} />}
        </React.Fragment>
      ))}
    </div>
  );
}

// 3-step guest review flow (rate → details → confirm & submit), no photo
// upload per spec. Fully self-contained/reusable — parent only needs to
// supply the house/user and a submit handler, same as the old inline form.
export default function ReviewWizard({ house, currentUser, onSubmitReview, onDone, previewMode = false }: ReviewWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submitted, setSubmitted] = useState(false);

  const [overall, setOverall] = useState(5);
  const [overallTouched, setOverallTouched] = useState(false);
  const [detail, setDetail] = useState<Record<DetailKey, number>>({ cleanliness: 5, service: 5, food: 5, organization: 5, value: 5 });
  const [purpose, setPurpose] = useState<Review['visitPurpose']>(undefined);

  const [likedTags, setLikedTags] = useState<string[]>([]);
  const [problemTags, setProblemTags] = useState<string[]>([]);
  const [problemOtherText, setProblemOtherText] = useState('');
  const [comment, setComment] = useState('');

  const [anonymous, setAnonymous] = useState(false);

  const detailAvg = parseFloat((Object.values(detail).reduce((a, b) => a + b, 0) / 5).toFixed(1));
  const displayedOverall = overallTouched ? overall : Math.round(detailAvg);

  const toggleTag = (list: string[], setList: (v: string[]) => void, key: string) => {
    setList(list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);
  };

  const handleSubmit = () => {
    if (previewMode) { alert('معاينة فقط — التقييم معطّل أثناء مراجعة الإدارة.'); return; }
    const finalOverall = displayedOverall;
    const newReview: Review = {
      id: `rev_${Date.now()}`,
      houseId: house.id,
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      rating: finalOverall,
      food_rating: detail.food,
      service_rating: detail.service,
      cleanliness_rating: detail.cleanliness,
      organization_rating: detail.organization,
      value_rating: detail.value,
      overall_rating: finalOverall,
      comment: comment.trim(),
      createdAt: new Date().toISOString(),
      visitPurpose: purpose,
      likedTags: likedTags.length ? likedTags : undefined,
      problemTags: problemTags.length ? problemTags : undefined,
      problemOther: problemTags.includes('other') && problemOtherText.trim() ? problemOtherText.trim() : undefined,
      displayAnonymous: anonymous,
    };
    onSubmitReview(newReview);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="bg-[#FAF8F5] border border-[#D6D6C2] rounded-3xl p-8 text-center space-y-3 animate-in fade-in zoom-in-95 duration-300">
        <div className="mx-auto w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-600" />
        </div>
        <h3 className="text-sm font-black text-[#4A4A3A]">شكراً لمشاركتك!</h3>
        <p className="text-[11px] text-[#8A8A70] leading-relaxed max-w-sm mx-auto">
          تم إرسال تقييمك بنجاح وسيساعد الضيوف الآخرين في اختيار المكان المناسب.
        </p>
        <button
          type="button"
          onClick={() => { onDone?.(); }}
          className="bg-[#5A5A40] hover:bg-[#4A4A3A] text-white font-extrabold text-xs px-5 py-2.5 rounded-xl transition-colors cursor-pointer inline-flex items-center gap-1.5"
        >
          <Home className="w-3.5 h-3.5" />
          <span>الرجوع لتقييمات البيت</span>
        </button>
      </div>
    );
  }

  return (
    <div className="bg-[#FAF8F5] border border-[#D6D6C2] rounded-3xl p-4 sm:p-5 space-y-4 animate-in fade-in duration-200">
      <div>
        <h3 className="text-sm font-black text-[#4A4A3A] text-center">تقييم تجربتك</h3>
        <p className="text-[10px] text-[#8A8A70] font-medium text-center mt-0.5">شارك رأيك لمساعدة الآخرين</p>
      </div>

      <StepIndicator step={step} />

      {step === 1 && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-4 border border-[#D6D6C2] space-y-2 text-center">
            <h4 className="text-xs font-black text-[#4A4A3A]">كيف كانت تجربتك بشكل عام؟</h4>
            <StarPicker value={displayedOverall} onChange={(v) => { setOverall(v); setOverallTouched(true); }} size="w-7 h-7" />
            <span className="inline-block text-[10px] font-extrabold text-amber-800 bg-amber-50 border border-amber-200/60 px-2.5 py-0.5 rounded-lg">
              {ratingLabel(displayedOverall)}
            </span>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-[#D6D6C2] space-y-2.5">
            <h4 className="text-xs font-black text-[#4A4A3A]">قيّم الجوانب التالية</h4>
            {DETAIL_DIMENSIONS.map((d) => (
              <div key={d.key} className="flex items-center justify-between bg-[#FBFBFA] px-3 py-2 rounded-xl border border-[#D6D6C2]/50">
                <span className="text-[10.5px] font-bold text-[#4A4A3A]">{d.emoji} {d.label}</span>
                <StarPicker value={detail[d.key]} onChange={(v) => setDetail((prev) => ({ ...prev, [d.key]: v }))} size="w-4 h-4" />
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl p-4 border border-[#D6D6C2] space-y-2.5">
            <h4 className="text-xs font-black text-[#4A4A3A]">ما هدف زيارتك للمكان؟ <span className="font-medium text-[#8A8A70]">(اختياري)</span></h4>
            <div className="flex flex-wrap gap-2">
              {VISIT_PURPOSES.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPurpose(purpose === p.key ? undefined : p.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-extrabold transition-all cursor-pointer ${
                    purpose === p.key ? 'bg-[#5A5A40] border-[#5A5A40] text-white scale-105' : 'bg-[#FBFBFA] border-[#D6D6C2] text-[#4A4A3A] hover:border-[#8A8A70]'
                  }`}
                >
                  <span>{p.emoji}</span><span>{p.label}</span>
                  {purpose === p.key && <Check className="w-3 h-3" />}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setStep(2)}
            className="w-full bg-[#5A5A40] hover:bg-[#4A4A3A] text-white font-extrabold text-xs py-3 rounded-2xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>التالي</span>
            <ChevronRight className="w-4 h-4 rotate-180" />
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div>
            <h4 className="text-xs font-black text-[#4A4A3A] text-center">شاركنا تفاصيل تجربتك</h4>
            <p className="text-[9.5px] text-[#8A8A70] font-medium text-center mt-0.5">ساعدنا في تحسين تجربة الضيوف</p>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-[#D6D6C2] space-y-2.5">
            <h4 className="text-[11px] font-black text-[#4A4A3A]">ما أكثر شيء أعجبك؟ <span className="font-medium text-[#8A8A70]">(اختياري)</span></h4>
            <div className="flex flex-wrap gap-2">
              {LIKED_TAGS.map((t) => {
                const active = likedTags.includes(t.key);
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => toggleTag(likedTags, setLikedTags, t.key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-extrabold transition-all cursor-pointer ${
                      active ? 'bg-amber-50 border-amber-400 text-amber-900' : 'bg-[#FBFBFA] border-[#D6D6C2] text-[#4A4A3A] hover:border-[#8A8A70]'
                    }`}
                  >
                    <span>{t.emoji}</span><span>{t.label}</span>
                    {active && <Check className="w-3 h-3 text-amber-600" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-[#D6D6C2] space-y-2.5">
            <h4 className="text-[11px] font-black text-[#4A4A3A]">هل واجهت أي مشكلة؟ <span className="font-medium text-[#8A8A70]">(اختياري)</span></h4>
            <div className="flex flex-wrap gap-2">
              {PROBLEM_TAGS.map((t) => {
                const active = problemTags.includes(t.key);
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => toggleTag(problemTags, setProblemTags, t.key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-extrabold transition-all cursor-pointer ${
                      active ? 'bg-rose-50 border-rose-300 text-rose-900' : 'bg-[#FBFBFA] border-[#D6D6C2] text-[#4A4A3A] hover:border-[#8A8A70]'
                    }`}
                  >
                    <span>{t.emoji}</span><span>{t.label}</span>
                    {active && <Check className="w-3 h-3 text-rose-600" />}
                  </button>
                );
              })}
            </div>
            {problemTags.includes('other') && (
              <input
                type="text"
                value={problemOtherText}
                onChange={(e) => setProblemOtherText(e.target.value)}
                placeholder="اذكر المشكلة..."
                className="w-full bg-[#FBFBFA] border border-[#D6D6C2] text-[11px] px-3 py-2 rounded-xl text-[#4A4A3A] focus:outline-none focus:border-[#5A5A40] font-medium"
              />
            )}
          </div>

          <div className="bg-white rounded-2xl p-4 border border-[#D6D6C2] space-y-2">
            <h4 className="text-[11px] font-black text-[#4A4A3A]">تعليقك <span className="font-medium text-[#8A8A70]">(اختياري)</span></h4>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, 500))}
              maxLength={500}
              rows={4}
              placeholder="اكتب تعليقك هنا..."
              className="w-full bg-[#FBFBFA] border border-[#D6D6C2] text-[11px] px-3 py-2.5 rounded-xl text-[#4A4A3A] focus:outline-none focus:border-[#5A5A40] font-medium resize-none"
            />
            <div className="text-left text-[9px] text-[#8A8A70] font-bold">{comment.length}/500</div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="shrink-0 bg-white border border-[#D6D6C2] text-[#4A4A3A] font-extrabold text-xs px-4 py-3 rounded-2xl transition-colors cursor-pointer"
            >
              رجوع
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="flex-1 bg-[#5A5A40] hover:bg-[#4A4A3A] text-white font-extrabold text-xs py-3 rounded-2xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>التالي</span>
              <ChevronRight className="w-4 h-4 rotate-180" />
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3 animate-in fade-in duration-200">
          <div>
            <h4 className="text-xs font-black text-[#4A4A3A] text-center">راجع تقييمك قبل الإرسال</h4>
            <p className="text-[9.5px] text-[#8A8A70] font-medium text-center mt-0.5">تأكد أن جميع البيانات صحيحة</p>
          </div>

          {/* Card 1: overall */}
          <div className="bg-white rounded-2xl p-3.5 border border-[#D6D6C2] flex items-center justify-between">
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star key={s} className={`w-4 h-4 ${s <= displayedOverall ? 'fill-amber-500 text-amber-500' : 'text-[#D6D6C2]'}`} />
              ))}
            </div>
            <div className="text-left">
              <span className="text-sm font-black text-[#4A4A3A]">{displayedOverall.toFixed(1)}</span>
              <span className="text-[10px] font-extrabold text-amber-800 mr-1">{ratingLabel(displayedOverall)}</span>
            </div>
          </div>

          {/* Card 2: detail summary */}
          <div className="bg-white rounded-2xl p-3.5 border border-[#D6D6C2] space-y-1.5">
            {DETAIL_DIMENSIONS.map((d) => (
              <div key={d.key} className="flex items-center justify-between text-[10.5px] font-bold text-[#4A4A3A]">
                <span>{d.emoji} {d.label}</span>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} className={`w-3 h-3 ${s <= detail[d.key] ? 'fill-amber-500 text-amber-500' : 'text-[#D6D6C2]'}`} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Card 3: visit purpose */}
          {purpose && (
            <div className="bg-white rounded-2xl p-3.5 border border-[#D6D6C2] flex items-center justify-between">
              <span className="text-[10px] font-bold text-[#8A8A70]">سبب الزيارة</span>
              <span className="text-[10.5px] font-extrabold text-[#4A4A3A] bg-[#EBEBE0] px-2.5 py-1 rounded-lg">{PURPOSE_LABEL[purpose]}</span>
            </div>
          )}

          {/* Card 4: liked */}
          {likedTags.length > 0 && (
            <div className="bg-white rounded-2xl p-3.5 border border-[#D6D6C2] space-y-2">
              <span className="text-[10px] font-bold text-[#8A8A70]">ما أعجبك</span>
              <div className="flex flex-wrap gap-1.5">
                {likedTags.map((k) => (
                  <span key={k} className="text-[9.5px] font-bold bg-amber-50 border border-amber-200/60 text-amber-900 px-2 py-1 rounded-lg">{TAG_LABEL[k]}</span>
                ))}
              </div>
            </div>
          )}

          {/* Card 5: problems */}
          <div className="bg-white rounded-2xl p-3.5 border border-[#D6D6C2] space-y-2">
            <span className="text-[10px] font-bold text-[#8A8A70]">المشكلات</span>
            {problemTags.length === 0 ? (
              <p className="text-[10.5px] font-bold text-emerald-700 flex items-center gap-1">✅ لم يتم الإبلاغ عن أي مشكلة</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {problemTags.map((k) => (
                  <span key={k} className="text-[9.5px] font-bold bg-rose-50 border border-rose-200/60 text-rose-900 px-2 py-1 rounded-lg">
                    {k === 'other' && problemOtherText.trim() ? problemOtherText.trim() : TAG_LABEL[k]}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Card 6: comment */}
          {comment.trim() && (
            <div className="bg-[#FBFBFA] rounded-2xl p-3.5 border border-[#D6D6C2] flex gap-2">
              <MessageSquareQuote className="w-4 h-4 text-[#8A8A70] shrink-0 mt-0.5" />
              <p className="text-[10.5px] text-[#4A4A3A] leading-relaxed">{comment.trim()}</p>
            </div>
          )}

          {/* Card 7: display name */}
          <div className="bg-white rounded-2xl p-3.5 border border-[#D6D6C2] space-y-2">
            <span className="text-[10px] font-bold text-[#8A8A70]">كيف ترغب في إظهار اسمك؟</span>
            <div className="space-y-1.5">
              <label className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${!anonymous ? 'border-[#5A5A40] bg-[#5A5A40]/5' : 'border-[#D6D6C2]'}`}>
                <input type="radio" checked={!anonymous} onChange={() => setAnonymous(false)} className="accent-[#5A5A40] cursor-pointer" />
                <UserCheck className="w-3.5 h-3.5 text-[#5A5A40]" />
                <div>
                  <div className="text-[10.5px] font-extrabold text-[#4A4A3A]">باسمي الحقيقي</div>
                  <div className="text-[9px] text-[#8A8A70]">سيظهر اسمك مع التقييم</div>
                </div>
              </label>
              <label className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${anonymous ? 'border-[#5A5A40] bg-[#5A5A40]/5' : 'border-[#D6D6C2]'}`}>
                <input type="radio" checked={anonymous} onChange={() => setAnonymous(true)} className="accent-[#5A5A40] cursor-pointer" />
                <span className="w-3.5 h-3.5 text-[#8A8A70] text-center text-xs">👤</span>
                <div>
                  <div className="text-[10.5px] font-extrabold text-[#4A4A3A]">زائر موثق</div>
                  <div className="text-[9px] text-[#8A8A70]">سيظهر "زائر موثق" فقط بدون اسمك</div>
                </div>
              </label>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="shrink-0 bg-white border border-[#D6D6C2] text-[#4A4A3A] font-extrabold text-xs px-4 py-3 rounded-2xl transition-colors cursor-pointer"
            >
              رجوع
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="flex-1 bg-[#5A5A40] hover:bg-[#4A4A3A] text-white font-extrabold text-xs py-3 rounded-2xl transition-colors cursor-pointer"
            >
              إرسال التقييم
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
