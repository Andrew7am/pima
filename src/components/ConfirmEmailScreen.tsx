/**
 * «افتح بريدك لتفعيل الحساب» — shown after a sign-up that needs confirmation.
 *
 * Pulled out of AuthScreen so it can be rendered and looked at without a
 * pending sign-up. It only appears after a real registration, which made it
 * the one screen in the flow nobody could check before shipping.
 *
 * Presentational: every action is a prop.
 */

const NAVY = '#0A2342';
const GOLD = '#C5A059';
const MUTED = '#8A8A70';
const LINE = '#E7E2D5';

interface Props {
  email: string;
  /** Re-sends the activation link. Disabled while a send is in flight. */
  onResend: () => void;
  /** «تحققت من بريدي» — re-checks the session after the link was clicked. */
  onRecheck: () => void;
  onUseAnotherEmail: () => void;
  onContactSupport?: () => void;
  sending?: boolean;
  /** Seconds Supabase says to wait; 0 when a resend is allowed. */
  cooldown?: number;
  cooldownLabel?: string;
  checking?: boolean;
}

export default function ConfirmEmailScreen({
  email, onResend, onRecheck, onUseAnotherEmail, onContactSupport,
  sending = false, cooldown = 0, cooldownLabel = '', checking = false,
}: Props) {
  return (
    <div className="flex flex-col items-center text-center gap-4 py-1">
      <span className="w-[4.5rem] h-[4.5rem] rounded-full grid place-items-center"
        style={{ backgroundColor: '#FBF2DE' }} aria-hidden="true">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" style={{ color: GOLD }}>
          <rect x="2.5" y="5" width="19" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
          <path d="m3.5 7 8.5 6 8.5-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>

      <div className="flex flex-col gap-1.5">
        <h2 className="text-[17px] font-black" style={{ color: NAVY }}>افتح بريدك لتفعيل الحساب</h2>
        <p className="text-[12px]" style={{ color: '#4A4A3A' }}>أرسلنا رابط تفعيل إلى</p>
        <p dir="ltr" className="text-[13.5px] font-black" style={{ color: NAVY }}>{email}</p>
      </div>

      <svg width="150" height="12" viewBox="0 0 150 12" fill="none" aria-hidden="true">
        <path d="M6 6h56M88 6h56" stroke={GOLD} strokeWidth="1" strokeLinecap="round" opacity=".5" />
        <path d="M75 1.5 78 6l-3 4.5L72 6Z" fill={GOLD} />
      </svg>

      <p className="text-[11.5px] leading-relaxed max-w-[30ch]" style={{ color: MUTED }}>
        اضغط على الرابط في الرسالة ثم ارجع وسجّل الدخول.
        <br />لو مش لاقيها، بُص في الرسائل غير المرغوب فيها (Spam).
      </p>

      {/* The screen used to offer only «أعد إرسال». Someone who had clicked the
          link had no way to tell the app so — reloading was the only route on,
          and nothing on screen said that. */}
      <button type="button" onClick={onRecheck} disabled={checking}
        className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 text-[13.5px] font-black text-white cursor-pointer disabled:opacity-60"
        style={{ backgroundColor: NAVY }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
          <path d="m8.5 12 2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {checking ? 'بنتأكد...' : 'تحققت من بريدي'}
      </button>

      <button type="button" onClick={onResend} disabled={sending || cooldown > 0}
        className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 text-[13px] font-bold bg-white border cursor-pointer disabled:opacity-60"
        style={{ borderColor: GOLD, color: NAVY }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ color: GOLD }}>
          <path d="M21 3 10.5 13.5M21 3l-6.5 18-4-8-8-4L21 3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
        {cooldown > 0 ? cooldownLabel : sending ? 'جارٍ الإرسال...' : 'أعد إرسال رابط التفعيل'}
      </button>

      <div className="flex items-center gap-2 w-full">
        <span className="flex-1 h-px" style={{ backgroundColor: LINE }} />
        <span className="text-[11px] font-bold" style={{ color: MUTED }}>أو</span>
        <span className="flex-1 h-px" style={{ backgroundColor: LINE }} />
      </div>

      <button type="button" onClick={onUseAnotherEmail}
        className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 text-[13px] font-bold bg-white border cursor-pointer"
        style={{ borderColor: LINE, color: NAVY }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ color: MUTED }}>
          <rect x="2.5" y="5" width="19" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
          <path d="m3.5 7 8.5 6 8.5-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        استخدم بريدًا آخر
      </button>

      {onContactSupport && (
        <p className="text-[11px]" style={{ color: MUTED }}>
          ما زلت لم تستلم البريد؟{' '}
          <button type="button" onClick={onContactSupport} className="font-bold cursor-pointer" style={{ color: GOLD }}>
            تواصل معنا
          </button>
        </p>
      )}
    </div>
  );
}
