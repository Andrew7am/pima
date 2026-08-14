import React, { useId } from 'react';
import { Search } from 'lucide-react';

/**
 * The shared search field.
 *
 * WHY THIS IS NOT A WRAPPER AROUND <Input>. Input hard-codes `ps-3 pe-3`, and
 * a leading icon needs the start padding opened up to clear it. Passing
 * `ps-10` through className puts two padding-inline-start utilities on one
 * element at equal specificity, where the winner is whichever Tailwind emits
 * later — not something a caller can see or rely on. The alternative was
 * adding an icon slot to Input, which is explicitly out of scope. So this
 * matches Input's CONTRACT exactly — same 44px floor, same 14px label, same
 * 12px radius, same border, focus and disabled treatment, same tokens — while
 * owning its own padding. If Input's contract changes, this changes with it;
 * the shared-ness is in the tokens and the measurements, not in the import.
 *
 * ON DIRECTION: the icon is placed with `start-3` (inset-inline-start) and the
 * field is padded with `ps-10 pe-3`. Nothing here says left or right. The
 * production field this replaces uses `pr-10 pl-3`, which happens to look
 * right in Arabic and puts the icon on the wrong side of an English one.
 */

export interface SearchInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'className' | 'type'> {
  /** Visible label. Where the design has no room for one, pass `aria-label`
   *  instead — a search field with neither is unusable on a screen reader,
   *  because a placeholder is not a name. */
  label?: string;
  className?: string;
  wrapperClassName?: string;
  /** Set false when the field sits inside something that already provides the
   *  surface — the homepage hero pill, which is frosted glass with its own
   *  background, border and radius. Omitting those classes is not the same as
   *  overriding them through className: two background or radius utilities at
   *  equal specificity resolve by whichever Tailwind emits later, which the
   *  caller cannot see or rely on. Everything that makes this a search field —
   *  the 44px floor, the logical padding, the icon, the type, the focus ring —
   *  is unaffected. */
  surface?: boolean;
}

export default function SearchInput({
  label,
  id,
  disabled,
  className = '',
  wrapperClassName = '',
  surface = true,
  ...rest
}: SearchInputProps) {
  const auto = useId();
  const inputId = id ?? `ui-search-${auto}`;

  return (
    <div className={['flex flex-col gap-1.5', wrapperClassName].filter(Boolean).join(' ')}>
      {label && (
        <label htmlFor={inputId} className="text-[12px] font-semibold text-[var(--ds-text)]">
          {label}
        </label>
      )}

      <div className="relative">
        {/* Decorative: the field is already named by its label or aria-label,
            and announcing "search" twice is noise. pointer-events-none so the
            icon never eats a tap meant for the field. */}
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ds-text-faint)]"
        />
        <input
          id={inputId}
          type="search"
          disabled={disabled}
          className={[
            // Same box as Input, with the start padding opened for the icon.
            'min-h-11 ps-10 pe-3 text-[14px] w-full',
            surface && 'rounded-[12px] bg-[var(--ds-surface)]',
            'text-[var(--ds-text)]',
            'placeholder:text-[var(--ds-text-faint)]',
            // No transition-colors, for the reason Button and Input document:
            // border-color reads an unregistered custom property, and a
            // transition on one never resolves when the theme changes — the
            // border would keep the previous theme's colour for good.
            surface && 'border border-[var(--ds-border)]',
            'outline-none',
            surface && 'focus:border-[var(--ds-primary)]',
            'focus-visible:ring-2 focus-visible:ring-[var(--ds-primary)]',
            'focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--ds-bg)]',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            surface && 'disabled:bg-[var(--ds-raised)]',
            // Safari paints its own clear affordance on type=search, which
            // would be a second, unstyled control inside the field.
            '[&::-webkit-search-cancel-button]:appearance-none',
            className,
          ].filter(Boolean).join(' ')}
          {...rest}
        />
      </div>
    </div>
  );
}
