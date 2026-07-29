import { useEffect, useRef } from 'react';

// Progressive reveal for a list: children carrying .pima-reveal rise into place
// the first time they enter the viewport.
//
// The hidden state is applied HERE, never in the stylesheet. An element is only
// hidden (.is-armed) once this hook is running and has an observer watching it,
// so a script failure, a missing IntersectionObserver, or an environment that
// never dispatches scroll leaves every card plainly visible. An animation must
// never be able to hide the content it is decorating.
//
// A watchdog backs that up: anything still unrevealed after 1.2s is shown
// regardless. Cheap insurance against a case where the observer attaches but
// never fires — which is exactly what a non-compositing WebView does.
//
// One observer for the whole grid, not one per card, and the class flip goes
// through the DOM rather than React state so revealing a card cannot re-render
// the list mid-scroll.
export function useRevealOnScroll<T extends HTMLElement>(itemCount: number) {
  const containerRef = useRef<T | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const targets = Array.from(container.querySelectorAll<HTMLElement>('.pima-reveal:not(.is-in)'));
    if (targets.length === 0) return;

    const revealAll = () => targets.forEach((el) => { el.classList.add('is-armed', 'is-in'); });

    // Reduced motion, or a browser without the API: show everything at once.
    if (
      typeof IntersectionObserver !== 'function' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      revealAll();
      return;
    }

    targets.forEach((el) => el.classList.add('is-armed'));

    const observer = new IntersectionObserver(
      (entries) => {
        entries
          .filter((e) => e.isIntersecting)
          .forEach((entry, i) => {
            const el = entry.target as HTMLElement;
            // 60ms between cards arriving together: a visible cascade, short
            // enough that no card feels like it is waiting its turn.
            el.style.transitionDelay = `${Math.min(i, 5) * 60}ms`;
            el.classList.add('is-in');
            observer.unobserve(el); // an entrance, not a scroll-linked effect
          });
      },
      // Start a little before the card's edge so the rise lands as it arrives.
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
    );

    targets.forEach((el) => observer.observe(el));

    const watchdog = window.setTimeout(revealAll, 1200);

    return () => {
      window.clearTimeout(watchdog);
      observer.disconnect();
    };
    // Re-runs when the result count changes, so cards a filter has just added
    // get observed too.
  }, [itemCount]);

  return containerRef;
}
