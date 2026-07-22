import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, X, Home, ClipboardList, BedDouble, MessageCircle, HelpCircle, Sparkles } from 'lucide-react';

interface OwnerTourProps {
  ownerFirstName: string;
  onClose: () => void;
  onNavigateSupport?: () => void;
}

interface Step {
  icon: React.ElementType;
  chip: string;
  title: string;
  body: React.ReactNode;
  tip?: string;
}

// First-run tour for new owners. Modal-based (no DOM anchors that would
// break on the next redesign). Dismissal is remembered in localStorage
// under `pima_owner_tour_done`; the shell also exposes a "?" help button
// that clears the flag and re-opens the tour on demand.
export default function OwnerTour({ ownerFirstName, onClose, onNavigateSupport }: OwnerTourProps) {
  const [step, setStep] = useState(0);

  const steps: Step[] = [
    {
      icon: Sparkles,
      chip: 'مرحباً بك',
      title: `أهلاً بك يا ${ownerFirstName} 👋`,
      body: (
        <>
          بيما بيدير معاك بيت المؤتمرات بالكامل — مش مجرد قائمة حجوزات. في 4 خطوات سريعة هوريك أهم اللي تقدر تعمله في لوحتك، وتقدر تخطى في أي وقت وترجعلها بضغطة زرار "؟".
        </>
      ),
      tip: '⏱️ الجولة أقل من دقيقة، ومش هتتظهرلك تاني.',
    },
    {
      icon: ClipboardList,
      chip: 'الخطوة ١ · الحجوزات',
      title: 'كل حجز في مكان واحد',
      body: (
        <>
          سواء اللي جالك من التطبيق أو من واتساب أو تليفون — تقدر تضيفهم كلهم بنفسك عن طريق زرار{' '}
          <strong className="text-[var(--color-owner-primary)]">"إضافة حجز جديد"</strong> في تاب الحجوزات. اللوحة بتوريك مين قدّم طلب لسه، مين متأخر في دفع العربون، ومين وصول ومغادرة النهارده.
        </>
      ),
      tip: '💡 مفيش سبب تدير حجوزاتك في كشكول لسه — كل شيء هنا مع تنبيهات فورية.',
    },
    {
      icon: BedDouble,
      chip: 'الخطوة ٢ · توزيع الغرف الذكي',
      title: 'خلي السيستم يوزّع الغرف بدلاً منك',
      body: (
        <>
          افتح أي حجز واختار <strong className="text-[var(--color-owner-primary)]">"توزيع الغرف"</strong>: السيستم بيوزّع الأفراد بالسعات المتاحة في التواريخ دي بالظبط (مش السعة الاجمالية للبيت)، ويحسب عربون كل حجز، ويقفل التعارضات قبل ما تحصل. تقدر تحرك يدوياً برضو لو حبيت.
        </>
      ),
      tip: '🎯 لو الغرفة فاضية أول 3 ليالي بس، هيوصّل هذا للضيف قبل الحجز.',
    },
    {
      icon: MessageCircle,
      chip: 'الخطوة ٣ · محادثات + نقاط',
      title: 'محادثات منظّمة ونقاط ولاء لعملائك',
      body: (
        <>
          كل محادثة مع الضيف موجودة في تاب <strong className="text-[var(--color-owner-primary)]">"المحادثات"</strong> ومربوطة بحجزها — تقدر ترجعلها في أي وقت لأي تفصيلة أو اتفاق. والضيف بياخد نقاط ولاء على كل حجز مدفوع بيقدر يخصمها من حجزه الجاي، ودي هدية جميلة تشجّعه يفضل معاك.
        </>
      ),
      tip: '💚 كل حاجة داخل التطبيق: بترتب شغلك وتوفّر وقتك، وبتدي عملاءك تجربة أكثر احترافية.',
    },
    {
      icon: HelpCircle,
      chip: 'احنا معاك',
      title: 'محتاج مساعدة؟ اتواصل معانا',
      body: (
        <>
          لو لقيت أي حاجة مش واضحة أو محتاج نساعدك تظبط بيتك، تواصل مع فريق الدعم مباشرة من داخل التطبيق. برضو تقدر ترجع للجولة دي في أي وقت من زرار{' '}
          <span className="inline-flex items-center gap-0.5 bg-[var(--color-owner-hover)] border border-[var(--color-owner-border)] rounded-md px-1.5 py-0.5 text-[10px] font-black text-[var(--color-owner-text)]">
            ؟
          </span>{' '}
          في أعلى الصفحة الرئيسية.
        </>
      ),
    },
  ];

  const current = steps[step];
  const isLast = step === steps.length - 1;
  const Icon = current.icon;

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-[var(--color-owner-surface)] w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl border border-[var(--color-owner-border)] shadow-2xl overflow-hidden text-right animate-in slide-in-from-bottom-4 duration-300 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-[var(--color-owner-primary)] text-white p-5 relative">
          <button
            id="owner-tour-close-x"
            type="button"
            onClick={onClose}
            className="absolute top-4 left-4 p-1.5 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-white/10 rounded-2xl flex items-center justify-center shrink-0">
              <Icon className="w-5 h-5 text-[var(--color-owner-accent)]" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-black text-[var(--color-owner-accent)] tracking-wide">{current.chip}</span>
              <h3 className="text-base font-black mt-0.5 leading-tight">{current.title}</h3>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          <p className="text-xs text-[var(--color-owner-text)] leading-relaxed font-medium">{current.body}</p>
          {current.tip && (
            <div className="bg-[var(--color-owner-bg)] border border-[var(--color-owner-border)] rounded-2xl px-3 py-2.5 text-[11px] font-bold text-[var(--color-owner-secondary)]">
              {current.tip}
            </div>
          )}
        </div>

        {/* Progress dots */}
        <div className="px-5 py-3 flex items-center justify-center gap-1.5">
          {steps.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? 'w-6 bg-[var(--color-owner-primary)]' : i < step ? 'w-1.5 bg-[var(--color-owner-primary)]/40' : 'w-1.5 bg-[var(--color-owner-border)]'
              }`}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--color-owner-border)] flex items-center justify-between gap-2 bg-[var(--color-owner-bg)]">
          {step > 0 ? (
            <button
              id="owner-tour-back"
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="flex items-center gap-1 text-[11px] font-bold text-[var(--color-owner-secondary)] hover:text-[var(--color-owner-text)] px-3 py-2 rounded-xl transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
              <span>السابق</span>
            </button>
          ) : (
            <button
              id="owner-tour-skip"
              type="button"
              onClick={onClose}
              className="text-[11px] font-bold text-[var(--color-owner-secondary)] hover:text-[var(--color-owner-text)] px-3 py-2 rounded-xl transition-colors cursor-pointer"
            >
              تخطي الجولة
            </button>
          )}

          {isLast ? (
            <div className="flex items-center gap-2">
              {onNavigateSupport && (
                <button
                  id="owner-tour-contact-support"
                  type="button"
                  onClick={() => { onClose(); onNavigateSupport(); }}
                  className="text-[11px] font-bold text-[var(--color-owner-primary)] px-3 py-2 rounded-xl hover:bg-[var(--color-owner-hover)] transition-colors cursor-pointer"
                >
                  تواصل مع الدعم
                </button>
              )}
              <button
                id="owner-tour-done"
                type="button"
                onClick={onClose}
                className="bg-[var(--color-owner-primary)] hover:bg-[var(--color-owner-primary-hover)] text-white font-black text-xs px-5 py-2.5 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Home className="w-3.5 h-3.5" />
                <span>يلا نبدأ</span>
              </button>
            </div>
          ) : (
            <button
              id="owner-tour-next"
              type="button"
              onClick={() => setStep((s) => s + 1)}
              className="bg-[var(--color-owner-primary)] hover:bg-[var(--color-owner-primary-hover)] text-white font-black text-xs px-5 py-2.5 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <span>التالي</span>
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
