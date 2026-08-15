import React from 'react';
import { ShieldCheck, Baby } from 'lucide-react';
import { arabicNumber } from '../../lib/arabic';
import { EffectivePolicy } from '../../lib/bookingPolicy';

interface Props {
  policy: EffectivePolicy;
  /** 'card' is the bordered panel the house page shows; 'plain' drops the
   *  chrome so the same words can sit inside a panel that already has some. */
  variant?: 'card' | 'plain';
  className?: string;
}

/**
 * The booking policy, in words, wherever it needs saying.
 *
 * Every number here comes from the database — the property's own value, or the
 * platform's where the property has no opinion. Nothing is hard-coded, because
 * the whole point of migration 0128 is that 7/3/50 is no longer true of every
 * house, and a screen that spells it out would be lying about most of them.
 *
 * The caller decides WHICH policy: resolvePolicy(house) before booking, and
 * policyForBooking(booking) afterwards. This component only renders one.
 */
export default function PropertyBookingPolicy({ policy, variant = 'card', className = '' }: Props) {
  const pct = arabicNumber(Math.round(policy.partialRefundPct * 100));

  const body = (
    <>
      <ul className="space-y-1 text-[11px] font-medium text-[var(--ds-text)] pr-4 list-disc marker:text-[var(--ds-accent)]">
        <li>قبل الوصول بـ<strong> {arabicNumber(policy.freeCancelDays)} أيام</strong> أو أكثر: استرداد <strong>كامل</strong>.</li>
        <li>قبل الوصول بـ<strong> {arabicNumber(policy.partialRefundDays)} أيام</strong> أو أكثر: استرداد <strong>{pct}٪</strong>.</li>
        <li>أقل من ذلك: لا يوجد استرداد.</li>
      </ul>

      {/* Only when the property actually has a child rule. A house that has not
          set one charges for everybody, and saying nothing is the truth. */}
      {policy.childFreeUnderAge != null && (
        <div className="flex items-start gap-1.5 pt-1">
          <Baby className="w-4 h-4 shrink-0 text-[var(--ds-accent)]" />
          <span className="text-[11px] font-medium text-[var(--ds-text)]">
            الأطفال تحت <strong>{arabicNumber(policy.childFreeUnderAge)} سنوات</strong> مجانًا — بيدفعوا من سن {arabicNumber(policy.childFreeUnderAge)} فيما فوق.
          </span>
        </div>
      )}

      {policy.notes && (
        <p className="text-[11px] font-medium text-[var(--ds-text-2)] leading-relaxed whitespace-pre-line pt-1">
          {policy.notes}
        </p>
      )}
    </>
  );

  if (variant === 'plain') return <div className={`space-y-1.5 ${className}`}>{body}</div>;

  return (
    <div className={`rounded-[28px] border border-[var(--ds-border)] bg-[var(--ds-surface)] p-3 space-y-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.06),0_2px_6px_rgba(0,0,0,0.03)] ${className}`}>
      <span className="flex items-center gap-1.5 text-[12px] font-black text-[var(--ds-brand)]">
        <ShieldCheck className="w-4 h-4 text-[var(--ds-accent)]" />
        سياسة الإلغاء والاسترداد
      </span>
      {body}
    </div>
  );
}
