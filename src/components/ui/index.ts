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
