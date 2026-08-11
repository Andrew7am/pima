import React from 'react';

/**
 * The shared card.
 *
 * NOT YET ADOPTED — created for the screens to move onto one at a time.
 *
 * A card is a GROUPING DEVICE, not the default wrapper for a section. The
 * audit found card-inside-card-inside-card in several places, which flattens
 * hierarchy instead of building it: once everything is a card, being a card
 * says nothing. Use one when the contents are a single thing — one booking,
 * one house, one self-contained figure — or when the whole block is tappable.
 * A section of a page, a settings list, a group of fields: those want a
 * heading and space, or a 1px rule, not a border and a shadow.
 *
 * Nesting is capped at two levels by convention (a row inside an "needs your
 * attention" card is the legitimate case). If a third feels necessary, the
 * layout is the problem, not the missing card.
 */

// HTMLElement rather than HTMLDivElement: `as` can render an <li>, and the
// div-specific event handler types are not assignable to the li ones — tsc
// rejected `as="li"` outright until this was widened.
export interface CardProps extends React.HTMLAttributes<HTMLElement> {
  /** 12px padding instead of 16px. The admin density setting — dashboards
   *  fit more per screen and are read, not thumbed. */
  compact?: boolean;
  /** Renders a <button>-like affordance: pointer, press feedback, focus ring.
   *  Pass onClick with it; without one this is just a box. */
  interactive?: boolean;
  as?: 'div' | 'section' | 'article' | 'li';
}

export default function Card({
  compact = false,
  interactive = false,
  as: Tag = 'div',
  children,
  className = '',
  ...rest
}: CardProps) {
  return (
    <Tag
      className={[
        'bg-[var(--ds-surface)]',
        'border border-[var(--ds-border)]',
        'rounded-[16px]',
        'shadow-[var(--shadow-subtle)]',
        compact ? 'p-3' : 'p-4',
        interactive
          ? 'cursor-pointer transition-transform duration-150 active:scale-[0.99] ' +
            'focus-visible:outline-none focus-visible:ring-2 ' +
            'focus-visible:ring-[var(--ds-primary)] focus-visible:ring-offset-2 ' +
            'focus-visible:ring-offset-[var(--ds-bg)]'
          : '',
        className,
      ].filter(Boolean).join(' ')}
      {...rest}
    >
      {children}
    </Tag>
  );
}
