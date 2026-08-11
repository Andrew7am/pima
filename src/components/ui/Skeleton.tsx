import React from 'react';

/**
 * The shared loading placeholder.
 *
 * NOT YET ADOPTED. Two skeletons already exist and both stay where they are:
 * owner/Skeleton.tsx is bound to the owner tokens and uses animate-pulse, and
 * chat/primitives.tsx's PimaSkeleton hardcodes the chat wallpaper's #EFE9DC.
 * Neither can serve a second theme, which is why this one exists rather than
 * one of them being widened — widening either would have meant editing a file
 * that is in live use, for no benefit to the screens using it today.
 *
 * The ANIMATION is not new: `pima-shimmer` is the existing keyframe in
 * index.css, a slow sweep rather than a pulse, already disabled under
 * prefers-reduced-motion along with the rest of the motion layer.
 *
 * A skeleton should draw the SHAPE OF WHAT IS COMING. A generic grey box tells
 * the reader nothing and makes the layout jump when the data lands; matching
 * the real geometry means the page only has to fill in, not rearrange.
 */

export interface SkeletonProps {
  /** Tailwind sizing — set both so the placeholder occupies the same box the
   *  real content will. */
  className?: string;
  /** Pill for avatars and dots; the default suits text and blocks. */
  circle?: boolean;
}

export default function Skeleton({ className = '', circle = false }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={[
        'block pima-shimmer bg-[var(--color-natural-raised)]',
        circle ? 'rounded-full' : 'rounded-[8px]',
        className,
      ].filter(Boolean).join(' ')}
    />
  );
}

/**
 * A labelled group of skeletons. Wrap a set of placeholders in this so the
 * whole region announces itself as busy once, instead of a screen reader
 * walking silently over a dozen empty spans.
 */
export function SkeletonGroup({
  children,
  label = 'جارٍ التحميل',
  className = '',
}: {
  children: React.ReactNode;
  label?: string;
  className?: string;
}) {
  return (
    <div aria-busy="true" aria-label={label} role="status" className={className}>
      {children}
    </div>
  );
}
