/**
 * The shared design-system components.
 *
 * NONE OF THESE ARE ADOPTED YET. No screen imports from here — they were built
 * so the migration can happen one screen at a time, and so the eight spellings
 * of "primary button" now in the codebase have somewhere to converge.
 *
 * They are THEME-AGNOSTIC: every colour they use is a --ds-* role, and the
 * surrounding theme decides what that role looks like. None of them contains
 * an 'if owner' or 'if admin' branch. See the THEME BINDING block in
 * index.css for the five bindings and why night mode needs no block of its own.
 */

export { default as Button } from './Button';
export type { ButtonProps } from './Button';

export { default as Card } from './Card';
export type { CardProps } from './Card';

export { default as Input } from './Input';
export type { InputProps } from './Input';

export { default as Badge } from './Badge';
export type { BadgeProps, BadgeTone, BadgeVariant } from './Badge';

export { default as EmptyState } from './EmptyState';
export type { EmptyStateProps } from './EmptyState';

export { default as Skeleton, SkeletonGroup } from './Skeleton';
export type { SkeletonProps } from './Skeleton';

/* ── BACKLOG: gaps found by real screens, NOT to be built speculatively ──────
 *
 * Recorded here rather than fixed, because a variant invented before a second
 * caller exists is a guess. Both came out of the bookings migration, where the
 * production code was left as-is rather than bent around the toolkit.
 *
 * 1. Input has no LEADING-ICON slot.
 *    UserBookings' search field puts a magnifier in an absolutely positioned
 *    slot (`right-3` with `pr-10` on the field). Input is `ps-3 pe-3` with no
 *    API for it, so the field stayed hand-built. Whoever adds this: the slot
 *    must be logical, or the icon lands on the wrong side in Arabic.
 *
 * 2. Button has no ACCENT-GRADIENT variant.
 *    Three of the bookings CTAs are a gold gradient — --ds-accent to
 *    --ds-accent-deep — which is the screen's signature and was explicitly
 *    ruled out of being flattened to a flat accent. Button's variants are all
 *    single-fill, so those three stayed hand-built too. Note when building it
 *    that the label must be --ds-on-accent: white on that gradient measures
 *    2.46–2.84:1, which is how it shipped for a while.
 */
