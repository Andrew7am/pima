import { useEffect, useRef, useState } from 'react';

const DEFAULT_CHECK_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

// Polls the build-stamped version.json (written fresh on every production
// build — see vite.config.ts's versionFilePlugin) and reports when it
// changes, meaning a new deploy has landed while this tab was open. Never
// reloads on its own — the caller decides how to surface it (see
// UpdateBanner.tsx), since forcing a reload could wipe an in-progress form.
export function useVersionCheck(intervalMs: number = DEFAULT_CHECK_INTERVAL_MS): boolean {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const initialVersionRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const res = await fetch('/version.json', { cache: 'no-store' });
        if (!res.ok || cancelled) return;
        const { version } = await res.json();
        if (cancelled) return;
        if (initialVersionRef.current === null) {
          initialVersionRef.current = version;
        } else if (version !== initialVersionRef.current) {
          setUpdateAvailable(true);
        }
      } catch {
        // Network hiccup or version.json missing (e.g. local dev) — ignore, retry next interval.
      }
    };

    check();
    const id = setInterval(check, intervalMs);
    return () => { cancelled = true; clearInterval(id); };
  }, [intervalMs]);

  return updateAvailable;
}
