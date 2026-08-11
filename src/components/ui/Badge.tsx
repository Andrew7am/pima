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
 * wash. Every theme binds both halves, which is why a badge never uses the
 * plain fill as text: the owner's amber on white measures 2.2:1.
 */

export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

/** Where the badge is sitting. `default` is a light page surface; `inverse` is
 *  the dark identity panel — a profile hero, an owner header, a game card. */
export type BadgeVariant = 'default' | 'inverse';

const TONE: Record<BadgeTone, { fill: string; ink: string }> = {
  success: { fill: 'var(--ds-success)', ink: 'var(--ds-success-ink)' },
  warning: { fill: 'var(--ds-warning)', ink: 'var(--ds-warning-ink)' },
  danger:  { fill: 'var(--ds-danger)',  ink: 'var(--ds-danger-ink)' },
  info:    { fill: 'var(--ds-primary)',   ink: 'var(--ds-primary)' },
  neutral: { fill: 'var(--ds-text-2)', ink: 'var(--ds-text)' },
};

/** The tone's own colour on a brand panel, for the inverse variant. The -ink
 *  pairs are tuned for a pale wash on a light page and go invisible on a dark
 *  one, so they cannot be reused here. */
const INVERSE_TONE: Record<BadgeTone, string> = {
  success: 'var(--ds-success)',
  warning: 'var(--ds-warning)',
  danger:  'var(--ds-danger)',
  info:    'var(--ds-accent)',   // primary is the panel's own hue in some themes
  neutral: '',                   // no hue: the on-brand colour, plain
};

export interface BadgeProps {
  tone?: BadgeTone;
  /** `inverse` for a badge on --ds-brand. See BadgeVariant. */
  variant?: BadgeVariant;
  icon?: React.ReactNode;
  /** Required: the badge must say what it means, not only colour it. */
  children: React.ReactNode;
  className?: string;
}

export default function Badge({
  tone = 'neutral', variant = 'default', icon, children, className = '',
}: BadgeProps) {
  const { fill, ink } = TONE[tone];

  // THE INVERSE VARIANT, and why it needs no theme branching.
  //
  // A badge on the identity panel has exactly one requirement: be legible on
  // --ds-brand. Every theme already names the colour that satisfies that —
  // --ds-on-brand — so the whole variant derives from it and inverts for free.
  // Guest, owner light, admin and entertainment all bind a LIGHT on-brand over
  // a dark panel; owner night mode binds a DARK one over a light panel, and
  // the same three expressions flip with it. There is no `if dark` to write
  // because the binding layer has already answered the question.
  //
  // The tint and border are on-brand rather than the tone, so the chip is the
  // same subtle shape whatever it says. The tone survives in the TEXT, pulled
  // 40% of the way from on-brand toward its own hue — far enough to read as
  // green or red, not so far that it drops out of contrast. Pure tone colours
  // would: --ds-success on the guest navy is 3.2:1.
  const hue = INVERSE_TONE[tone];
  const inverse = {
    backgroundColor: 'color-mix(in srgb, var(--ds-on-brand) 14%, transparent)',
    borderColor: 'color-mix(in srgb, var(--ds-on-brand) 26%, transparent)',
    color: hue ? `color-mix(in srgb, ${hue} 40%, var(--ds-on-brand))` : 'var(--ds-on-brand)',
  };

  return (
    <span
      className={[
        'inline-flex items-center gap-1 h-[22px] ps-2 pe-2',
        'rounded-full text-[11px] font-bold whitespace-nowrap',
        'border',
        className,
      ].filter(Boolean).join(' ')}
      style={variant === 'inverse' ? inverse : {
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
