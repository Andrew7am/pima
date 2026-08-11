import React from 'react';

/**
 * The shared status badge.
 *
 * NOT YET ADOPTED.
 *
 * COLOUR IS NEVER THE ONLY SIGNAL. `children` is required, so a badge always
 * carries a word; an icon is optional on top of it. Around 8% of men have some
 * form of colour vision deficiency, and green-vs-amber is exactly the pair
 * they lose — a booking that is "confirmed" or "awaiting payment" must not
 * depend on telling those two apart.
 *
 * The fill is the semantic colour at 10% over the surface and the text is its
 * -ink pair, which is the same hue at a weight that stays readable on a light
 * wash. That split already exists in the owner theme; this is the guest-side
 * counterpart, and the reason a badge never uses the plain token as text:
 * #F59E0B on white measures 2.2:1.
 */

export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const TONE: Record<BadgeTone, { fill: string; ink: string }> = {
  success: { fill: 'var(--color-natural-success)', ink: 'var(--color-natural-success-ink)' },
  warning: { fill: 'var(--color-natural-warning)', ink: 'var(--color-natural-warning-ink)' },
  danger:  { fill: 'var(--color-natural-danger)',  ink: 'var(--color-natural-danger-ink)' },
  info:    { fill: 'var(--color-natural-olive)',   ink: 'var(--color-natural-olive)' },
  neutral: { fill: 'var(--color-natural-ink-muted)', ink: 'var(--color-natural-ink)' },
};

export interface BadgeProps {
  tone?: BadgeTone;
  icon?: React.ReactNode;
  /** Required: the badge must say what it means, not only colour it. */
  children: React.ReactNode;
  className?: string;
}

export default function Badge({ tone = 'neutral', icon, children, className = '' }: BadgeProps) {
  const { fill, ink } = TONE[tone];
  return (
    <span
      className={[
        'inline-flex items-center gap-1 h-[22px] ps-2 pe-2',
        'rounded-full text-[11px] font-bold whitespace-nowrap',
        'border',
        className,
      ].filter(Boolean).join(' ')}
      style={{
        // color-mix keeps one source of truth per tone: the tint and the
        // border are derived from the same token as the text, so a palette
        // change cannot leave them disagreeing.
        backgroundColor: `color-mix(in srgb, ${fill} 10%, transparent)`,
        borderColor: `color-mix(in srgb, ${fill} 22%, transparent)`,
        color: ink,
      }}
    >
      {icon}
      {children}
    </span>
  );
}
