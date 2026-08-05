import { useEffect, useRef } from 'react';

/**
 * Keyboard and screen-reader handling for a modal dialog.
 *
 * `role="dialog" aria-modal="true"` tells assistive tech that the rest of the
 * page is inert, but it does not make it so. Without focus management the
 * sheets in this app opened with focus still on the button behind them, so a
 * keyboard user pressing Tab walked through the page *under* the dimmed
 * backdrop — invisibly, since the backdrop hides what has focus — and a screen
 * reader kept reading the page it had been on. Closing the sheet then dropped
 * focus onto <body>, losing the reader's place entirely.
 *
 * This does the three things the ARIA attributes only promise:
 *
 *   1. moves focus into the dialog when it opens (the panel itself, so the
 *      reader announces the dialog's label before its contents rather than
 *      jumping straight to the close button),
 *   2. keeps Tab and Shift+Tab inside it while it is open,
 *   3. returns focus to whatever opened it on the way out.
 *
 * Escape is handled here too, so a sheet cannot ship with a trap and no exit.
 *
 * Returns a ref to attach to the dialog panel — the element that should hold
 * the focus, not the full-screen wrapper with the backdrop in it.
 */
export function useDialogFocus<T extends HTMLElement = HTMLDivElement>(
  open: boolean,
  onClose?: () => void,
) {
  const panelRef = useRef<T>(null);
  // Read inside the effect cleanup, so a parent that re-creates onClose every
  // render does not tear the listener down and rebuild it on each keystroke.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    const panel = panelRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // A container is not focusable by default; tabIndex -1 makes it a valid
    // focus target without adding it to the tab order.
    if (panel) {
      if (!panel.hasAttribute('tabindex')) panel.setAttribute('tabindex', '-1');
      panel.focus({ preventScroll: true });
    }

    const focusable = (): HTMLElement[] => {
      if (!panel) return [];
      const nodes = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      // A collapsed wizard step must not be a Tab stop. This deliberately does
      // not use offsetParent: it is null for anything inside a position:fixed
      // subtree in some engines, and always null under jsdom, so the filter
      // would silently throw the whole list away — which is exactly what the
      // wrap-around tests caught.
      return [...nodes].filter((el) => {
        if (el.closest('[hidden]')) return false;
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden';
      });
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current?.();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;

      const items = focusable();
      if (items.length === 0) {
        // Nothing to land on — keep focus on the panel rather than letting it
        // escape to the page behind.
        e.preventDefault();
        panel.focus({ preventScroll: true });
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (!panel.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      // Only take focus back if it is still somewhere in the dialog. If the
      // close also navigated elsewhere, whatever that screen focused wins.
      const active = document.activeElement;
      const stillInside = !active || active === document.body || panel?.contains(active);
      if (stillInside && previouslyFocused?.isConnected) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [open]);

  return panelRef;
}
