import { useEffect, useRef, useState } from 'react';

/** True when the user has asked the OS for reduced motion. */
function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Counts a number up to its target on mount, and re-counts from wherever it is
 * whenever the target changes (an ad claim adding +25 tallies up, it does not
 * jump).
 *
 * FAIL-VISIBLE, like useRevealOnScroll: this is a NUMBER the user needs, not a
 * decoration. Under reduced motion, without requestAnimationFrame, or for a
 * target of zero, the hook returns the real value immediately and never
 * animates. An animation must never be able to hide a balance.
 */
export function useCountUp(target: number, duration = 1000): number {
  const safeTarget = Number.isFinite(target) ? target : 0;
  const canAnimate = typeof requestAnimationFrame === 'function' && !prefersReducedMotion();

  const [value, setValue] = useState(canAnimate && safeTarget > 0 ? 0 : safeTarget);
  const fromRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!canAnimate || safeTarget === fromRef.current) { setValue(safeTarget); fromRef.current = safeTarget; return; }

    const from = fromRef.current;
    const delta = safeTarget - from;
    // The clock is the rAF timestamp itself, anchored on the FIRST frame.
    // Seeding it from performance.now() instead assumes the two share a time
    // origin; where they do not, the elapsed fraction comes out wildly
    // negative and the balance renders as a huge negative number. Clamping
    // to [0,1] is the second guard on the same failure.
    let start: number | null = null;

    const tick = (now: number) => {
      if (start === null) start = now;
      const t = Math.min(1, Math.max(0, (now - start) / duration));
      // easeOutCubic — matches --motion-ease, so the number decelerates on the
      // same curve everything else on the page moves with.
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(from + delta * eased));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else { fromRef.current = safeTarget; setValue(safeTarget); }
    };
    rafRef.current = requestAnimationFrame(tick);

    // Watchdog. requestAnimationFrame is throttled to nothing in a background
    // tab, an inactive pane or a renderer that is not compositing — and a
    // tween that never advances leaves the number frozen at its start value,
    // which on a booking screen means showing a price of zero. If the frames
    // have not carried us home by the time the animation should have ended,
    // stop waiting for them and show the real number.
    const watchdog = setTimeout(() => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      fromRef.current = safeTarget;
      setValue(safeTarget);
    }, duration + 400);

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      clearTimeout(watchdog);
    };
  }, [safeTarget, duration, canAnimate]);

  return value;
}

/**
 * Returns 0 on the first paint, then the real percentage one frame later — so a
 * CSS width transition has something to animate from and every bar on the page
 * fills instead of appearing pre-filled.
 *
 * Same fail-visible rule: under reduced motion the real value is returned
 * immediately, so a bar is never stuck at zero.
 */
export function useGrowOnMount(pct: number, delay = 0): number {
  const target = Math.min(100, Math.max(0, Number.isFinite(pct) ? pct : 0));
  const canAnimate = typeof window !== 'undefined' && !prefersReducedMotion();
  const [width, setWidth] = useState(canAnimate ? 0 : target);

  useEffect(() => {
    if (!canAnimate) { setWidth(target); return; }
    const t = setTimeout(() => setWidth(target), delay + 60);
    return () => clearTimeout(t);
  }, [target, delay, canAnimate]);

  return width;
}
