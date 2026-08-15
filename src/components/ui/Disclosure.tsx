import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export interface DisclosureProps {
  title: string;
  /** Shown on the closed row — the one line worth reading without opening.
   *  A section you must open to learn whether it is worth opening is a section
   *  people stop opening. */
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

/**
 * A titled section that starts closed, in the guest palette.
 *
 * The owner side already has this ({@link ../owner/OwnerDisclosure}); it is
 * bound to the `--color-owner-*` tokens, so the booking sheet could not use it.
 * Same chevron, same rotation, same fold — the two sides of the app should not
 * disagree about what a foldable section looks like — over `--ds-*` and the
 * 28px radius the booking cards use.
 */
export default function Disclosure({ title, hint, icon, defaultOpen = false, children }: DisclosureProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-[var(--ds-surface)] rounded-[28px] border border-[var(--ds-border)] overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.06),0_2px_6px_rgba(0,0,0,0.03)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 px-3 min-h-11 text-right cursor-pointer hover:bg-[var(--ds-bg)] transition-colors"
      >
        <span className="flex items-center gap-1.5 min-w-0">
          {icon}
          <span className="text-[12px] font-black text-[var(--ds-brand)] truncate">{title}</span>
        </span>
        <span className="flex items-center gap-1.5 shrink-0">
          {hint && <span className="text-[11px] font-medium text-[var(--ds-text-2)]">{hint}</span>}
          <ChevronDown className={`w-4 h-4 text-[var(--ds-text-2)] transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {open && <div className="px-3 pb-3 pt-0.5">{children}</div>}
    </div>
  );
}
