import React, { useId } from 'react';

/**
 * The shared text input.
 *
 * NOT YET ADOPTED.
 *
 * ON RTL: horizontal padding is `ps-3 pe-3` rather than `px-3`. For a
 * symmetric value the two are identical today, so this is not a bug fix — it
 * is the pattern being set where it matters. The moment an input grows a
 * leading icon (search does), physical padding sends the icon to the wrong
 * side of an Arabic field, and the version of this spec written before that
 * rule literally said `padding: 0 12px 0 36px`, which is backwards in RTL.
 * Starting logical means nobody has to remember to convert later.
 *
 * ON ERRORS: the message is wired to the field with aria-describedby and the
 * field is marked aria-invalid, so a screen reader announces the reason rather
 * than just a red rectangle. Colour alone is never the signal.
 */

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'className'> {
  label?: string;
  /** The problem, in words the person can act on. Presence turns on the error
   *  styling — there is no separate `invalid` flag to keep in sync. */
  error?: string;
  /** Quiet helper text below the field. Hidden while an error is showing, so
   *  the two never stack and compete. */
  hint?: string;
  className?: string;
  wrapperClassName?: string;
}

export default function Input({
  label,
  error,
  hint,
  id,
  disabled,
  className = '',
  wrapperClassName = '',
  ...rest
}: InputProps) {
  const auto = useId();
  const inputId = id ?? `ui-input-${auto}`;
  const msgId = `${inputId}-msg`;
  const hasError = Boolean(error);

  return (
    <div className={['flex flex-col gap-1.5', wrapperClassName].filter(Boolean).join(' ')}>
      {label && (
        <label htmlFor={inputId} className="text-[12px] font-semibold text-[var(--ds-text)]">
          {label}
        </label>
      )}

      <input
        id={inputId}
        disabled={disabled}
        aria-invalid={hasError || undefined}
        aria-describedby={error || hint ? msgId : undefined}
        className={[
          'min-h-11 ps-3 pe-3 rounded-[12px] text-[14px] w-full',
          'bg-[var(--ds-surface)] text-[var(--ds-text)]',
          'placeholder:text-[var(--ds-text-faint)]',
          // No transition-colors here, for the same reason Button does not
          // transition background-color: border-color reads var(--ds-border)
          // and var(--ds-primary), and a transition on a property fed by an
          // unregistered custom property never resolves when that property
          // changes — the field would keep its previous theme's border after
          // the owner's dark-mode toggle. The focus border now snaps, which
          // is the correct trade against a permanently stale one.
          'border outline-none',
          hasError
            ? 'border-[var(--ds-danger)] focus:border-[var(--ds-danger)]'
            : 'border-[var(--ds-border)] focus:border-[var(--ds-primary)]',
          'focus-visible:ring-2 focus-visible:ring-offset-1',
          hasError
            ? 'focus-visible:ring-[var(--ds-danger)]'
            : 'focus-visible:ring-[var(--ds-primary)]',
          'focus-visible:ring-offset-[var(--ds-bg)]',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'disabled:bg-[var(--ds-raised)]',
          className,
        ].filter(Boolean).join(' ')}
        {...rest}
      />

      {(error || hint) && (
        <span
          id={msgId}
          className={`text-[12px] ${
            hasError
              ? 'text-[var(--ds-danger-ink)] font-semibold'
              : 'text-[var(--ds-text-2)]'
          }`}
        >
          {error || hint}
        </span>
      )}
    </div>
  );
}
