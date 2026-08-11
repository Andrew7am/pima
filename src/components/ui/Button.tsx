import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * The shared button.
 *
 * NOT YET ADOPTED. Nothing in the app renders this — it exists so the screens
 * can move onto it one at a time, and so the eight different spellings of
 * "primary button" currently in the codebase have somewhere to converge.
 *
 * ON COLOUR: this reads the guest tokens, which is the theme it will be
 * adopted into first. The owner and admin panels have their own palettes and
 * their own wrapper classes; the mapping layer that lets one button serve all
 * four themes belongs with that adoption, when we know what it actually needs,
 * not invented here against a screen nobody has migrated yet.
 *
 * ON PRIMARY: the fill is --color-natural-olive (#5A5A40), not
 * --color-natural-primary (#464E3D). Both are real, but 60 of the app's
 * primary buttons are the olive and the darker value belongs to the shell.
 * Matching the majority is what makes this a drop-in rather than a restyle.
 * The white label was measured against that olive: 7.07:1.
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
    'bg-[var(--color-natural-olive)] text-[var(--color-natural-on-primary)] ' +
    'hover:brightness-110 border border-transparent',
  secondary:
    'bg-[var(--color-natural-surface)] text-[var(--color-natural-ink)] ' +
    'border border-[var(--color-natural-rule)] hover:bg-[var(--color-natural-raised)]',
  ghost:
    'bg-transparent text-[var(--color-natural-olive)] border border-transparent ' +
    'hover:bg-[var(--color-natural-raised)]',
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
        'focus-visible:ring-[var(--color-natural-olive)] focus-visible:ring-offset-2',
        'focus-visible:ring-offset-[var(--color-natural-bg)]',
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
