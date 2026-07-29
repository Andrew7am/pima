import React from 'react';
import { Check, ShieldCheck, Wallet, Car, BedDouble } from 'lucide-react';
import type { Booking, Payment } from '../types';
import { buildBookingJourney, type JourneyStepKey } from '../lib/bookingJourney';
import { arabicDate } from '../lib/arabic';

const ICONS: Record<JourneyStepKey, React.ElementType> = {
  submitted: Check,
  approved: ShieldCheck,
  deposit: Wallet,
  arrival: Car,
  departure: BedDouble,
};

/** "اليوم ١٠:٣٠ ص" for today, otherwise the date. */
function lastUpdated(iso?: string): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  const time = d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  const today = d.toDateString() === new Date().toDateString();
  return today ? `آخر تحديث: اليوم ${time}` : `آخر تحديث: ${arabicDate(iso)}`;
}

/**
 * `full` — the detail sheet: title, per-stage dates and the explanation banner.
 * `bar`  — under the featured card on the bookings screen: the same five stages
 *          and the same source of truth, just the line on its own. One journey
 *          drawn two ways beats two journeys that can disagree.
 */
export default function BookingJourney({
  booking, payments, variant = 'full',
}: { booking: Booking; payments?: Payment[]; variant?: 'full' | 'bar' }) {
  const { steps, message } = buildBookingJourney(booking, payments);
  const bar = variant === 'bar';

  return (
    <div className={bar ? '' : 'space-y-3'}>
      {!bar && <h4 className="text-[11px] font-black text-[#0A2342]">رحلة حجزك مع بيما</h4>}

      <div className="flex items-start">
        {steps.map((step, i) => {
          const Icon = ICONS[step.key];
          const done = step.state === 'done';
          const current = step.state === 'current';
          // The connector before a step is filled only when that step is
          // reached, so the line always stops at the stage actually reached.
          const linkFilled = steps[i + 1] && steps[i + 1].state === 'done';

          return (
            <React.Fragment key={step.key}>
              <div className="flex flex-col items-center gap-1 shrink-0 w-[19%] text-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                    done ? 'bg-[#0A2342] text-white'
                      : current ? 'bg-[#FBF3E4] text-[#C5A059] ring-2 ring-[#C5A059]/40'
                        : 'bg-[#EBEBE0] text-[#B8B8A0]'
                  }`}
                >
                  {done ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>

                <span className={`text-[8.5px] font-black leading-tight ${
                  done ? 'text-[#0A2342]' : current ? 'text-[#C5A059]' : 'text-[#B8B8A0]'
                }`}>
                  {step.label}
                </span>

                {/* Only ever a real timestamp — a stage with no recorded date
                    (e.g. approved before migration 087) shows none. */}
                {!bar && step.at && (
                  <span className="text-[7.5px] font-bold text-[#8A8A70] leading-tight">{arabicDate(step.at)}</span>
                )}
                {!bar && step.note && (
                  <span className="text-[7.5px] font-bold text-[#8A8A70] leading-tight">{step.note}</span>
                )}
                {!bar && current && step.key === 'approved' && lastUpdated(booking.updatedAt) && (
                  <span className="text-[7px] font-bold text-[#B8B8A0] leading-tight">{lastUpdated(booking.updatedAt)}</span>
                )}
              </div>

              {i < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mt-4 rounded-full transition-colors ${
                  linkFilled ? 'bg-[#0A2342]' : 'bg-[#EBEBE0]'
                }`} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {!bar && (
        <div className="flex items-start gap-2 bg-[#FBF3E4] border border-[#C5A059]/30 rounded-2xl px-3 py-2.5">
          <ShieldCheck className="w-4 h-4 text-[#C5A059] shrink-0 mt-0.5" />
          <p className="text-[10px] font-bold text-[#4A4A3A] leading-relaxed">{message}</p>
        </div>
      )}
    </div>
  );
}
