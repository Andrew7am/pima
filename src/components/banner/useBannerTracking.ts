import { useEffect, useRef } from 'react';
import { recordBannerImpression, recordBannerClick, BannerElementKind } from '../../lib/bannerEvents';

// Attaches impression + click tracking to a banner box.
//
// An impression only counts once the banner is actually ON SCREEN (half of it
// visible), so a banner below the fold never inflates the numbers. Clicks are
// attributed to the nearest [data-el] ancestor, which is what turns the
// dashboard's "which part gets tapped" breakdown into real data.
//
// Visibility is measured with getBoundingClientRect on mount/scroll/resize
// rather than relying on IntersectionObserver alone: IO callbacks are silently
// never delivered in some embedded webviews (observed in this project's own
// preview browser), which would mean zero impressions forever. IO is still
// used when it works — it just isn't the only path.

const VISIBLE_RATIO = 0.5;

export function useBannerTracking(bannerId?: string) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || !bannerId) return;

    let done = false;
    let observer: IntersectionObserver | null = null;

    const finish = () => {
      if (done) return;
      done = true;
      recordBannerImpression(bannerId);
      observer?.disconnect();
      window.removeEventListener('scroll', check, true);
      window.removeEventListener('resize', check);
    };

    function check() {
      if (done || !node) return;
      const r = node.getBoundingClientRect();
      if (r.height === 0) return;
      const visible = Math.max(0, Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0));
      if (visible / r.height >= VISIBLE_RATIO) finish();
    }

    if (typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        (entries) => { for (const e of entries) if (e.isIntersecting) finish(); },
        { threshold: VISIBLE_RATIO },
      );
      observer.observe(node);
    }
    // Layout settles a tick after mount; re-check then, and on any scroll.
    const t = setTimeout(check, 60);
    window.addEventListener('scroll', check, true);
    window.addEventListener('resize', check);
    check();

    return () => {
      clearTimeout(t);
      observer?.disconnect();
      window.removeEventListener('scroll', check, true);
      window.removeEventListener('resize', check);
    };
  }, [bannerId]);

  const onClickCapture = (e: React.MouseEvent) => {
    if (!bannerId) return;
    const el = (e.target as HTMLElement).closest('[data-el]') as HTMLElement | null;
    const kind = (el?.dataset.el as BannerElementKind | undefined);
    // No element hit → the tap landed on the artwork itself.
    recordBannerClick(bannerId, kind ?? 'image');
  };

  return { ref, onClickCapture };
}
