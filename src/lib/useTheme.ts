import { useCallback, useEffect, useState } from 'react';

export type ThemeChoice = 'system' | 'light' | 'dark';

const KEY = 'pima-theme';

/** Reads the choice the pre-paint script in index.html already acted on, so the
 *  hook and the document never disagree on first render. */
function readChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    /* privacy mode — fall through to the default */
  }
  return 'system';
}

function resolve(choice: ThemeChoice): 'light' | 'dark' {
  if (choice === 'light' || choice === 'dark') return choice;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function apply(choice: ThemeChoice) {
  document.documentElement.dataset.theme = resolve(choice);
}

/** Theme state for normal Pima. Owner (.owner-theme) and Entertainment
 *  (.play-theme) bind --ds-* on their own subtrees and are unaffected by this —
 *  custom properties resolve from the nearest ancestor that declares them. */
export function useTheme() {
  const [choice, setChoiceState] = useState<ThemeChoice>(readChoice);

  const setTheme = useCallback((next: ThemeChoice) => {
    setChoiceState(next);
    apply(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* the attribute is already set; persistence is best-effort */
    }
  }, []);

  // Only follow the OS while the user has not made an explicit choice.
  useEffect(() => {
    if (choice !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => apply('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [choice]);

  return { theme: choice, resolved: resolve(choice), setTheme };
}
