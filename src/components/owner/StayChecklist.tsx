import { CheckCircle2, Circle } from 'lucide-react';
import { CHECKIN_ITEMS, CHECKOUT_ITEMS, isTicked, toggleTick, tickedCount } from '../../lib/stayChecklist';
import type { ChecklistTick } from '../../lib/stayChecklist';

interface Props {
  kind: 'checkin' | 'checkout';
  ticks: ChecklistTick[] | undefined;
  onChange: (next: ChecklistTick[]) => void;
  /** Stamped onto each tick so a house with staff on the gate knows who. */
  by?: string;
}

/**
 * The boxes somebody stood there and ticked.
 *
 * Arrival and departure were each one tap, and the booking got a timestamp and
 * nothing else — so «سجّل الوصول» recorded that a button was pressed, not that
 * the cash was collected or the keys came back. At departure that gap is money:
 * a group leaves, a mattress is torn, and there is no record of anyone having
 * looked at the room.
 *
 * Nothing here blocks anything. An owner at the gate with a bus unloading has
 * to be able to record an arrival with every box empty.
 */
export default function StayChecklist({ kind, ticks, onChange, by }: Props) {
  const items = kind === 'checkin' ? CHECKIN_ITEMS : CHECKOUT_ITEMS;
  const done = tickedCount(ticks, items);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-black text-[var(--color-owner-text)]">
          {kind === 'checkin' ? 'قبل ما تستلمهم' : 'قبل ما يمشوا'}
        </span>
        <span className="text-[11px] font-black text-[var(--color-owner-secondary)]">
          {done} من {items.length}
        </span>
      </div>

      <div className="h-1.5 bg-[var(--color-owner-bg)] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${Math.round((done / items.length) * 100)}%` }}
        />
      </div>

      <ul className="space-y-1.5">
        {items.map((it) => {
          const on = isTicked(ticks, it.key);
          return (
            <li key={it.key}>
              <button
                type="button"
                onClick={() => onChange(toggleTick(ticks, it.key, by))}
                aria-pressed={on}
                className="w-full text-right flex items-start gap-2 rounded-xl bg-[var(--color-owner-bg)] p-2.5 min-h-11 cursor-pointer hover:bg-[var(--color-owner-hover)] transition-colors"
              >
                {on
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  : <Circle className="w-4 h-4 text-[var(--color-owner-secondary)] shrink-0 mt-0.5" />}
                <span className="min-w-0 flex-1">
                  <span className={`block text-[12px] font-bold leading-snug ${on ? 'text-[var(--color-owner-secondary)] line-through' : 'text-[var(--color-owner-text)]'}`}>
                    {it.label}
                  </span>
                  {it.note && !on && (
                    <span className="block text-[10.5px] text-[var(--color-owner-secondary)] mt-0.5 leading-snug">
                      {it.note}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
