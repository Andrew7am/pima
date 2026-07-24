import React from 'react';

// Reusable loading skeletons (Tailwind's animate-pulse). Use these instead
// of a bare "جارٍ التحميل…" so screens feel instant and premium.
export function SkeletonBar({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-[var(--color-owner-hover)] rounded-lg ${className}`} />;
}

export function SkeletonRow() {
  return (
    <div className="bg-[var(--color-owner-surface)] rounded-2xl border border-[var(--color-owner-border)] p-3.5 flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-[var(--color-owner-hover)] animate-pulse shrink-0" />
      <div className="flex-1 space-y-2">
        <SkeletonBar className="h-3 w-1/3" />
        <SkeletonBar className="h-2.5 w-2/3" />
      </div>
    </div>
  );
}

export function SkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="جارٍ التحميل">
      {Array.from({ length: rows }).map((_, i) => <SkeletonRow key={i} />)}
    </div>
  );
}

export function SkeletonCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-2.5" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-[var(--color-owner-surface)] rounded-2xl border border-[var(--color-owner-border)] p-3 space-y-2">
          <div className="w-8 h-8 rounded-xl bg-[var(--color-owner-hover)] animate-pulse" />
          <SkeletonBar className="h-4 w-1/2" />
          <SkeletonBar className="h-2.5 w-2/3" />
        </div>
      ))}
    </div>
  );
}
