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

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-quiet';

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
  // Destructive, at two weights. The pilot screen needed both: one solid
  // button that carries out the deletion, and two quiet ones — log out, and
  // "delete my account" before it is confirmed — that must read as dangerous
  // without shouting on a screen you visit for ordinary reasons.
  danger:
    'bg-[var(--ds-danger)] text-[var(--ds-on-danger)] ' +
    'hover:brightness-110 border border-transparent',
  'danger-quiet':
    'bg-transparent text-[var(--ds-danger-ink)] border ' +
    'hover:bg-[color-mix(in_srgb,var(--ds-danger)_8%,transparent)]',
};

// The quiet variant's border is the danger colour at a fraction, which is a
// derived value rather than a token — same reason Badge computes its tint
// inline. Everything else is a plain token reference a class can express.
const VARIANT_STYLE: Partial<Record<Variant, React.CSSProperties>> = {
  'danger-quiet': { borderColor: 'color-mix(in srgb, var(--ds-danger) 34%, transparent)' },
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
  style,
  ...rest
}: ButtonProps) {
  const size = compact
    ? 'min-h-10 ps-3 pe-3 text-[14px]'
    : 'min-h-11 ps-4 pe-4 text-[16px]';

  // A destructive button that focuses to a green-olive ring is telling the
  // keyboard user the wrong thing about what they are about to press.
  const isDestructive = variant === 'danger' || variant === 'danger-quiet';
  const ring = isDestructive
    ? 'focus-visible:ring-[var(--ds-danger)]'
    : 'focus-visible:ring-[var(--ds-primary)]';

  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      style={{ ...VARIANT_STYLE[variant], ...style }}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-[12px] font-bold',
        // background-color is deliberately NOT transitioned.
        //
        // Its value comes from var(--ds-primary), and an UNREGISTERED custom
        // property cannot be interpolated. When the theme class changes on an
        // ancestor the variable changes, Chrome starts a background-color
        // transition it can never resolve, and the button keeps painting the
        // OLD theme's colour indefinitely — not for 150ms, permanently.
        //
        // Found in the showcase: switching themes moved every page, card and
        // label colour while the primary button stayed olive in all five.
        // `transition: none` on the element corrected it instantly, which is
        // what identified the cause. This is not cosmetic — the owner's
        // dark-mode toggle flips .owner-dark on live elements, so shipping
        // this would have frozen every button at its pre-toggle colour.
        //
        // The cost is that the hover background on secondary/ghost now
        // changes instantly. transform and filter still animate, and
        // hover:brightness-110 (a filter) carries the primary's hover feel.
        // The alternative — registering all 20 roles with @property so they
        // become interpolatable — is available if the fade is missed.
        'transition-[transform,filter] duration-150',
        'active:scale-[0.97] cursor-pointer',
        'focus-visible:outline-none focus-visible:ring-2',
        ring,
        'focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ds-bg)]',
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
