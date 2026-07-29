import { useEffect, useRef } from 'react';

// Drifts the hero at most 20px against the page as it scrolls away.
//
// Written to cost nothing on the scroll thread: the listener is passive, does
// no work of its own beyond storing a number, and every read/write happens
// inside one requestAnimationFrame. It writes a CSS custom property rather than
// a style, so the element decides what to do with it and React never re-renders
// while the finger is down.
//
// The scroller is the app shell's <main>, not the window — WebLayout puts the
// page in an overflow-y-auto column, so window scroll never fires.
export function useHeroParallax<T extends HTMLElement>(maxShift = 20) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const scroller = el.closest('main') ?? document.scrollingElement;
    if (!scroller) return;

    let frame = 0;
    const apply = () => {
      frame = 0;
      // Only the first screen-height of scrolling moves it; past that the hero
      // is gone and there is nothing to parallax.
      const y = Math.min(scroller.scrollTop, el.offsetHeight);
      const shift = (y / Math.max(el.offsetHeight, 1)) * maxShift;
      el.style.setProperty('--pima-parallax', `${shift.toFixed(1)}px`);
    };

    const onScroll = () => {
      if (frame) return; // coalesce: at most one write per frame
      frame = requestAnimationFrame(apply);
    };

    apply();
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      scroller.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [maxShift]);

  return ref;
}
