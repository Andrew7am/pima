import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * The shared button.
 *
 * NOT YET ADOPTED. Nothing in the app renders this — it exists so the screens
 * can move onto it one at a time, and so the eight different spellings of
 * "primary button" currently in the codebase have somewhere to converge.
 *
 * ON COLOUR: this names no palette. --ds-primary is a ROLE, and whichever
 * theme wraps the button decides what that role looks like — olive on a guest
 * screen, navy in the owner panel, indigo in a game. There is deliberately no
 * `if owner` anywhere in this file; adding one would put the theme's knowledge
 * inside the component, which is the thing the binding layer exists to avoid.
 * See the THEME BINDING block in index.css.
 *
 * The guest binding points --ds-primary at the olive #5A5A40 rather than
 * #464E3D, because 60 of the app's primary buttons are that olive and the
 * darker value belongs to the shell — matching the majority is what makes
 * this a drop-in later rather than a restyle. Its white label measures
 * 7.07:1. Every other theme's pair was measured too; none of them is white
 * by assumption.
 */

type Variant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  variant?: Variant;
  /** 14px/40px instead of 16px/44px. For table rows and dense admin surfaces
   *  ONLY — never on a touch-first screen, where 44px is the floor. */
  compact?: boolean;
  /** Swaps the label for a spinner and blocks the click. Keeps the button's
   *  width so the row does not reflow mid-request. */
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  className?: string;
}

const VARIANT: Record<Variant, string> = {
  primary:
    'bg-[var(--ds-primary)] text-[var(--ds-on-primary)] ' +
    'hover:brightness-110 border border-transparent',
  secondary:
    'bg-[var(--ds-surface)] text-[var(--ds-text)] ' +
    'border border-[var(--ds-border)] hover:bg-[var(--ds-raised)]',
  ghost:
    'bg-transparent text-[var(--ds-primary)] border border-transparent ' +
    'hover:bg-[var(--ds-raised)]',
};

export default function Button({
  variant = 'primary',
  compact = false,
  loading = false,
  icon,
  fullWidth = false,
  disabled,
  children,
  className = '',
  type = 'button',
  ...rest
}: ButtonProps) {
  const size = compact
    ? 'min-h-10 ps-3 pe-3 text-[14px]'
    : 'min-h-11 ps-4 pe-4 text-[16px]';

  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-[12px] font-bold',
        'transition-[transform,background-color,filter] duration-150',
        'active:scale-[0.97] cursor-pointer',
        'focus-visible:outline-none focus-visible:ring-2',
        'focus-visible:ring-[var(--ds-primary)] focus-visible:ring-offset-2',
        'focus-visible:ring-offset-[var(--ds-bg)]',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
        size,
        VARIANT[variant],
        fullWidth ? 'w-full' : '',
        className,
      ].filter(Boolean).join(' ')}
      {...rest}
    >
      {loading
        ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
        : icon}
      {children}
    </button>
  );
}
