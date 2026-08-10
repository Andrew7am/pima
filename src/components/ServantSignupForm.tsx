import { useState } from 'react';

/**
 * Servant signup, in two steps.
 *
 * One long scroll asked for a birth date and a diocese in the same breath, and
 * the fields that decide what a servant sees afterwards sat below the fold.
 * Splitting it puts identity in step one and service in step two, and gives
 * step two room for the four answers that actually route a servant: where they
 * serve, under whom, and in what.
 *
 * Presentational. Values and handlers come from the caller, the way every
 * other screen here receives its actions, so this file has no idea what a
 * Supabase row looks like.
 */

const NAVY = '#0A2342';
const GOLD = '#C5A059';
const INK = '#4A4A3A';
const MUTED = '#8A8A70';
const LINE = '#D6D6C2';

export interface ServantSignupValues {
  name: string;
  email: string;
  phone: string;
  birthDate: string;
  password: string;
  passwordConfirm: string;
  governorate: string;
  diocese: string;
  church: string;
  serviceType: string;
  priestName: string;
  inviteCode: string;
}

export const EMPTY_SERVANT_SIGNUP: ServantSignupValues = {
  name: '', email: '', phone: '', birthDate: '', password: '', passwordConfirm: '',
  governorate: '', diocese: '', church: '', serviceType: '', priestName: '', inviteCode: '',
};

/** Known and finite — these are the services a Coptic church actually runs. */
export const SERVICE_TYPES = [
  'مدارس الأحد', 'خدمة الشباب', 'خدمة الجامعيين', 'الكشافة', 'الألحان والتسبحة',
  'الكورال', 'خدمة الافتقاد', 'الخدمة الاجتماعية', 'خدمة الأطفال', 'الإعداد والتدريب',
  'خدمة الأسر', 'خدمة ذوي الاحتياجات', 'الإعلام والنشر', 'خدمة أخرى',
];

interface Props {
  governorates: string[];
  /** name_ar keyed by governorate. Missing key → the field falls back to text. */
  diocesesByGovernorate: Record<string, string[]>;
  values: ServantSignupValues;
  onChange: (patch: Partial<ServantSignupValues>) => void;
  onSubmit: () => void;
  onBack: () => void;
  onGoToLogin: () => void;
  submitting?: boolean;
  error?: string;
}

/* ── shared field chrome ─────────────────────────────────────────────────── */

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-[11px] font-bold mb-1" style={{ color: MUTED }}>{children}</label>;
}

const fieldClass =
  'w-full bg-white border rounded-xl py-2.5 px-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#C5A059]/40';

function TextField({ label, ...rest }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <Label>{label}</Label>
      <input {...rest} className={fieldClass} style={{ borderColor: LINE, color: INK }} />
    </div>
  );
}

function SelectField(
  { label, options, placeholder, ...rest }:
  { label: string; options: string[]; placeholder: string } & React.SelectHTMLAttributes<HTMLSelectElement>,
) {
  return (
    <div>
      <Label>{label}</Label>
      <select {...rest} className={`${fieldClass} appearance-none`} style={{ borderColor: LINE, color: rest.value ? INK : '#B6B4A2' }}>
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function PasswordField(
  { label, value, onChange, ...rest }:
  { label: string } & React.InputHTMLAttributes<HTMLInputElement>,
) {
  const [shown, setShown] = useState(false);
  return (
    <div>
      <Label>{label}</Label>
      <div className="relative">
        <input {...rest} type={shown ? 'text' : 'password'} value={value} onChange={onChange}
          className={`${fieldClass} pl-10`} style={{ borderColor: LINE, color: INK }} />
        <button type="button" onClick={() => setShown((s) => !s)}
          aria-label={shown ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
          className="absolute top-1/2 -translate-y-1/2 left-2 w-7 h-7 grid place-items-center rounded-lg"
          style={{ color: MUTED }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" stroke="currentColor" strokeWidth="1.8" />
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
            {!shown && <path d="m4 20 16-16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
          </svg>
        </button>
      </div>
    </div>
  );
}

function SectionHead({ title, hint, icon }: { title: string; hint?: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 mb-1">
      <div className="text-right">
        <h2 className="text-[15px] font-black" style={{ color: NAVY }}>{title}</h2>
        {hint && <p className="text-[11px] mt-0.5" style={{ color: MUTED }}>{hint}</p>}
      </div>
      <span className="shrink-0 w-8 h-8 grid place-items-center rounded-xl" style={{ backgroundColor: '#F6EFE1', color: GOLD }}>
        {icon}
      </span>
    </div>
  );
}

const IconUser = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="8" r="3.6" stroke="currentColor" strokeWidth="1.8" />
    <path d="M5 20c0-3.3 3.1-6 7-6s7 2.7 7 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

/* ── step indicator ──────────────────────────────────────────────────────── */

function StepBar({ step }: { step: 1 | 2 }) {
  const dot = (n: 1 | 2) => (
    <span className="w-7 h-7 rounded-full grid place-items-center text-[12px] font-black shrink-0"
      style={step >= n
        ? { backgroundColor: GOLD, color: '#fff' }
        : { backgroundColor: '#9A9A8C', color: '#fff' }}>
      {n}
    </span>
  );
  const label = (n: 1 | 2, text: string) => (
    <span className="text-[10.5px] font-bold" style={{ color: step === n ? GOLD : MUTED }}>{text}</span>
  );
  return (
    <div className="bg-white/85 backdrop-blur-[6px] rounded-2xl border px-4 py-3" style={{ borderColor: LINE }}>
      <div className="flex items-center gap-2">
        {dot(1)}
        <span className="flex-1 h-[2px] rounded" style={{ backgroundColor: step === 2 ? GOLD : LINE }} />
        {dot(2)}
      </div>
      <div className="flex items-center justify-between mt-1.5">
        {label(1, 'البيانات الأساسية')}
        {label(2, 'بيانات الخدمة')}
      </div>
    </div>
  );
}

/* ── screen ──────────────────────────────────────────────────────────────── */

export default function ServantSignupForm({
  governorates, diocesesByGovernorate, values, onChange,
  onSubmit, onBack, onGoToLogin, submitting = false, error = '',
}: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const set = (k: keyof ServantSignupValues) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => onChange({ [k]: e.target.value } as Partial<ServantSignupValues>);

  // Only the dioceses of the chosen governorate. Empty until one is picked, so
  // the servant never scrolls seventy names to find their own.
  const dioceses = diocesesByGovernorate[values.governorate] ?? [];

  const card = 'bg-white/88 backdrop-blur-[6px] rounded-[1.4rem] border p-4 flex flex-col gap-3';

  return (
    <div dir="rtl" className="min-h-[100dvh] w-full flex justify-center" style={{ backgroundColor: '#FBF7F0' }}>
      <div className="relative w-full max-w-[26rem] flex flex-col overflow-hidden">
        <img src="/auth-bg.png" alt="" aria-hidden="true"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
          className="pointer-events-none select-none absolute -top-[9%] left-0 w-full h-[109%] object-cover object-top" />

        <div className="relative flex flex-col gap-4 px-[7%] pt-[max(1rem,env(safe-area-inset-top))] pb-6">

          <div className="flex items-start justify-between">
            <button type="button" onClick={step === 2 ? () => setStep(1) : onBack}
              aria-label="رجوع"
              className="w-9 h-9 rounded-full bg-white/85 border grid place-items-center cursor-pointer"
              style={{ borderColor: LINE, color: NAVY }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M14.5 5 8 12l6.5 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div className="flex flex-col items-center gap-0.5">
              <svg width="46" height="40" viewBox="0 0 160 130" fill="none" aria-hidden="true">
                <path d="M25 65 L80 20 L135 65 V110 C135 112.2 133.2 114 131 114 H29 C26.8 114 25 112.2 25 110 V65 Z"
                  stroke={NAVY} strokeWidth="7" strokeLinejoin="round" strokeLinecap="round" fill="none" />
                <g transform="translate(80, 62) scale(1.05)">
                  <path d="M-3.5,-6 L-3.5,-20 C-3.5,-21.5 3.5,-21.5 3.5,-20 L3.5,-6 Z" fill={GOLD} />
                  <path d="M-3.5,-6 L-3.5,22 C-3.5,23 3.5,23 3.5,22 L3.5,-6 Z" fill={GOLD} />
                  <path d="M-16,-6 L16,-6 C17.5,-6 17.5,1 16,1 L-16,1 C-17.5,1 -17.5,-6 -16,-6 Z" fill={GOLD} />
                </g>
              </svg>
              <span className="text-[17px] font-black leading-none" style={{ color: NAVY }}>PiMa</span>
              <span className="text-[9px] font-extrabold" style={{ color: GOLD }}>بيتك معنا</span>
            </div>
          </div>

          <header className="text-center -mt-2">
            <h1 className="text-[24px] font-black leading-tight" style={{ color: NAVY }}>
              إنشاء حساب <span style={{ color: GOLD }}>خادم</span>
            </h1>
            <p className="text-[12.5px] mt-1" style={{ color: MUTED }}>خطوتين بسيطتين لبداية رحلتك معنا</p>
            <svg width="120" height="12" viewBox="0 0 150 14" fill="none" aria-hidden="true" className="mx-auto mt-1">
              <path d="M8 7h58M84 7h58" stroke={GOLD} strokeWidth="1" strokeLinecap="round" opacity=".55" />
              <path d="M75 2.5v9M70.5 7h9" stroke={GOLD} strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </header>

          <StepBar step={step} />

          {error && (
            <p className="text-[12px] font-bold text-center rounded-xl py-2 px-3 bg-rose-50 border border-rose-200 text-rose-700">
              {error}
            </p>
          )}

          {step === 1 ? (
            <form className={card} style={{ borderColor: LINE }}
              onSubmit={(e) => { e.preventDefault(); setStep(2); }}>
              <SectionHead title="معلوماتك الشخصية" icon={IconUser} />
              <TextField label="الاسم بالكامل" required placeholder="الاسم بالكامل كما بظهر في البطاقة"
                value={values.name} onChange={set('name')} />
              <TextField label="البريد الإلكتروني" type="email" required placeholder="example@church.eg"
                value={values.email} onChange={set('email')} />
              <div>
                <Label>رقم الهاتف المحمول</Label>
                <div className="flex gap-2">
                  <span className="shrink-0 grid place-items-center px-3 rounded-xl border bg-white text-[13px] font-bold"
                    style={{ borderColor: LINE, color: INK }} dir="ltr">🇪🇬 +20</span>
                  <input type="tel" required placeholder="01234567890" value={values.phone} onChange={set('phone')}
                    className={fieldClass} style={{ borderColor: LINE, color: INK }} />
                </div>
              </div>
              <TextField label="تاريخ الميلاد" type="date" required value={values.birthDate} onChange={set('birthDate')} />

              <div className="pt-1"><SectionHead title="معلومات الحساب" icon={IconUser} /></div>
              <PasswordField label="كلمة المرور" required value={values.password} onChange={set('password')} />
              <PasswordField label="تأكيد كلمة المرور" required value={values.passwordConfirm} onChange={set('passwordConfirm')} />

              <button type="submit"
                className="mt-1 w-full rounded-2xl py-3 text-[14px] font-black text-white flex items-center justify-center gap-2 cursor-pointer"
                style={{ backgroundColor: NAVY }}>
                <span className="w-7 h-7 rounded-full grid place-items-center" style={{ backgroundColor: 'rgba(197,160,89,.25)', color: GOLD }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M14.5 5 8 12l6.5 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                التالي
              </button>
              <p className="text-center text-[11.5px]" style={{ color: MUTED }}>
                لديك حساب بالفعل؟{' '}
                <button type="button" onClick={onGoToLogin} className="font-bold cursor-pointer" style={{ color: GOLD }}>
                  تسجيل الدخول
                </button>
              </p>
            </form>
          ) : (
            <form className={card} style={{ borderColor: LINE }}
              onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
              <SectionHead title="بيانات الخدمة" hint="يرجى إدخال بيانات خدمتك الحالية" icon={IconUser} />

              <SelectField label="المحافظة" placeholder="اختر المحافظة" options={governorates} required
                value={values.governorate}
                onChange={(e) => onChange({ governorate: e.target.value, diocese: '' })} />

              {/* A servant whose diocese is not in the seed must still get past
                  this field, so it degrades to text rather than trapping them. */}
              {dioceses.length > 0 ? (
                <SelectField label="الإيبارشية" placeholder="اختر الإيبارشية" options={dioceses}
                  value={values.diocese} onChange={set('diocese')} />
              ) : (
                <TextField label="الإيبارشية" placeholder="اكتب اسم الإيبارشية"
                  value={values.diocese} onChange={set('diocese')} />
              )}

              <TextField label="الكنيسة" required placeholder="مثال: كنيسة الأنبا أنطونيوس"
                value={values.church} onChange={set('church')} />
              <TextField label="اسم راعي الكنيسة" placeholder="مثال: القس مرقس جرجس"
                value={values.priestName} onChange={set('priestName')} />
              <SelectField label="الخدمة الحالية" placeholder="اختر خدمتك الحالية" options={SERVICE_TYPES} required
                value={values.serviceType} onChange={set('serviceType')} />

              <div>
                <TextField label="كود دعوة صديق (اختياري)" placeholder="مثال: a1b2c3d4"
                  value={values.inviteCode} onChange={set('inviteCode')} />
                <p className="text-[10.5px] mt-1 leading-relaxed" style={{ color: MUTED }}>
                  لو معاك كود من صديق، اكتبه هنا — هياخد ٢٬٠٠٠ نقطة لما تتمّ أول حجز مدفوع.
                </p>
              </div>

              <div className="flex gap-2 mt-1">
                <button type="button" onClick={() => setStep(1)}
                  className="rounded-2xl py-3 px-5 text-[13.5px] font-black bg-white border cursor-pointer"
                  style={{ borderColor: GOLD, color: NAVY }}>
                  السابق
                </button>
                <button type="submit" disabled={submitting}
                  className="flex-1 rounded-2xl py-3 text-[14px] font-black text-white flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  style={{ backgroundColor: NAVY }}>
                  {submitting ? 'جاري الإنشاء…' : 'إنشاء الحساب'}
                </button>
              </div>
              <p className="text-center text-[10.5px]" style={{ color: MUTED }}>
                🔒 بياناتك آمنة ولن تتم مشاركتها مع أي جهة خارجية
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
