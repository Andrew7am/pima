import React from 'react';
import Button from './Button';

/**
 * The shared empty state.
 *
 * NOT YET ADOPTED.
 *
 * An empty list is a question the reader is already asking — "is this broken,
 * or have I just not done anything yet?" — so the copy has to answer it. The
 * `title` says which of the two it is and the optional `description` says what
 * would fill it. "لا توجد بيانات" answers neither and is the string this
 * component exists to replace.
 *
 * The action is optional on purpose: offer one only where the reader can
 * actually do the thing. A guest with no bookings can go and browse; an owner
 * with no reviews yet cannot conjure one, and a button there would be a dead
 * end dressed up as help.
 */

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={[
        'flex flex-col items-center text-center gap-2',
        'py-8 ps-6 pe-6',
        className,
      ].filter(Boolean).join(' ')}
    >
      {icon && (
        <span className="text-[var(--ds-text-faint)] mb-1" aria-hidden="true">
          {icon}
        </span>
      )}

      <h3 className="text-[16px] font-bold text-[var(--ds-text)] text-balance">
        {title}
      </h3>

      {description && (
        <p className="text-[12px] text-[var(--ds-text-2)] max-w-[38ch] leading-relaxed">
          {description}
        </p>
      )}

      {action && (
        <Button className="mt-2" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
