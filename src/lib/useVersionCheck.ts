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
        // Unique URL per poll so no layer ever serves a stale copy — not the
        // browser cache, not a leftover service worker, and (crucially) not
        // Vercel's CDN edge cache, which otherwise HITs on /version.json and
        // can hide a fresh deploy for minutes. A distinct query string is a
        // distinct cache key → always revalidated against the origin.
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
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
