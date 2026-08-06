import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface OwnerDisclosureProps {
  title: string;
  /** Right-hand summary shown while collapsed — a count, a total, a status.
   *  A section you must open to find out whether it is worth opening is a
   *  section people stop opening. */
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  id?: string;
  children: React.ReactNode;
}

/**
 * A titled section that starts closed.
 *
 * The pattern already existed once — the financial centre hides its «كيف تُحسب
 * مستحقاتك؟» explainer behind exactly this — but it was written inline, so the
 * booking detail could not use it and grew into fourteen stacked blocks with an
 * accept button somewhere in the middle. Same chevron, same rotation, same
 * surface, so the two screens do not disagree about what a foldable section
 * looks like.
 */
export default function OwnerDisclosure({ title, hint, icon, defaultOpen = false, id, children }: OwnerDisclosureProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-[var(--color-owner-bg)] rounded-2xl border border-[var(--color-owner-border)] overflow-hidden">
      <button
        type="button"
        id={id}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 px-3 min-h-11.5 text-right cursor-pointer hover:bg-[var(--color-owner-hover)] transition-colors"
      >
        <span className="flex items-center gap-1.5 min-w-0">
          {icon}
          <span className="text-[12px] font-black text-[var(--color-owner-text)] truncate">{title}</span>
        </span>
        <span className="flex items-center gap-1.5 shrink-0">
          {hint && <span className="text-[11px] font-bold text-[var(--color-owner-secondary)]">{hint}</span>}
          <ChevronDown className={`w-4 h-4 text-[var(--color-owner-secondary)] transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {open && <div className="px-3 pb-3 pt-0.5">{children}</div>}
    </div>
  );
}
