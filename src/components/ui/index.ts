/**
 * The shared design-system components.
 *
 * NONE OF THESE ARE ADOPTED YET. No screen imports from here — they were built
 * so the migration can happen one screen at a time, and so the eight spellings
 * of "primary button" now in the codebase have somewhere to converge.
 *
 * They read the guest tokens (--color-natural-*), which is the theme they will
 * be adopted into first and the one the majority of screens already use. The
 * mapping that lets one component serve the owner, admin and play themes lands
 * with those adoptions, when the real requirements are known.
 */

export { default as Button } from './Button';
export type { ButtonProps } from './Button';

export { default as Card } from './Card';
export type { CardProps } from './Card';

export { default as Input } from './Input';
export type { InputProps } from './Input';

export { default as Badge } from './Badge';
export type { BadgeProps, BadgeTone } from './Badge';

export { default as EmptyState } from './EmptyState';
export type { EmptyStateProps } from './EmptyState';

export { default as Skeleton, SkeletonGroup } from './Skeleton';
export type { SkeletonProps } from './Skeleton';
