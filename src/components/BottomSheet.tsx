import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * A bottom sheet that opens partway and can be dragged the rest of the way.
 *
 * Opening at full height turns a sheet into a page, and the servant loses the
 * sense that the booking is still underneath. Opening at 78% keeps the booking
 * visible at the top edge while still showing enough of a long list to be
 * worth opening. Dragging up commits to full screen; dragging down past a
 * threshold closes it.
 *
 * The drag is pointer-events, not touch-events, so it works with a mouse in
 * the preview and a finger on a phone without two code paths. It is armed only
 * from the handle and the header — dragging the list itself must scroll the
 * list, which is the mistake that makes home-grown sheets feel broken.
 */

const PEEK = 0.78;      // resting height, as a fraction of the viewport
const FULL = 1;
const CLOSE_AFTER = 110; // px dragged below the resting point before it closes

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  /** Pinned above the scrolling body — stats, search, filters. */
  header?: React.ReactNode;
  /** Pinned to the bottom edge, above the safe area — the action row. */
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export default function BottomSheet({ open, onClose, title, subtitle, header, footer, children }: Props) {
  const [expanded, setExpanded] = useState(false);
  // Live finger offset in px while dragging; null when not dragging, so the
  // height transition is only on for the settle and never fights the finger.
  const [drag, setDrag] = useState<number | null>(null);
  const startY = useRef(0);
  const sheet = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) { setExpanded(false); setDrag(null); return; }
    // A sheet over a scrolling page that also scrolls is disorienting.
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [open, onClose]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    startY.current = e.clientY;
    setDrag(0);
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (drag === null) return;
    setDrag(e.clientY - startY.current);
  }, [drag]);

  const onPointerUp = useCallback(() => {
    if (drag === null) return;
    const d = drag;
    setDrag(null);
    if (d < -60) { setExpanded(true); return; }
    // Order matters. Testing the close threshold first meant one pull down
    // from full screen dismissed the sheet outright, skipping the resting
    // height — the servant loses the list for a gesture that meant «smaller».
    // From full, down always lands on peek; only from peek does down close.
    if (expanded) { if (d > 60) setExpanded(false); return; }
    if (d > CLOSE_AFTER) { onClose(); }
  }, [drag, expanded, onClose]);

  if (!open) return null;

  const restPct = (expanded ? FULL : PEEK) * 100;
  // Subtract the live drag so the sheet tracks the finger exactly; clamped so
  // it can neither exceed the viewport nor invert.
  const style: React.CSSProperties = {
    height: `min(100dvh, max(30dvh, calc(${restPct}dvh - ${drag ?? 0}px)))`,
    transition: drag === null ? 'height .28s cubic-bezier(.32,.72,0,1)' : 'none',
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label={title}>
      {/* The scrim and the shadow stay literal navy. --ds-brand would be the
          matching role in light, but it inverts to cream in dark — a scrim has
          to darken what is behind it in every theme, so this one is fixed by
          intent rather than unmigrated. */}
      <button
        type="button"
        aria-label="إغلاق"
        onClick={onClose}
        className="absolute inset-0 bg-[#0A2342]/35 backdrop-blur-[2px] cursor-default"
      />

      {/* --ds-bg, not --ds-surface: the sheet is a page-like container and the
          cards inside it are --ds-surface, so the two keep the same relationship
          they have on any other screen. Reversing them would put white cards on
          a white panel in light. */}
      <div ref={sheet} style={style}
        className="relative w-full max-w-[30rem] mx-auto bg-[var(--ds-bg)] rounded-t-[1.75rem]
                   shadow-[0_-8px_40px_-8px_rgba(10,35,66,.35)] flex flex-col overflow-hidden">

        {/* Drag zone: handle + title. The list below scrolls normally. */}
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="shrink-0 touch-none select-none cursor-grab active:cursor-grabbing"
        >
          <div className="pt-2.5 pb-1 grid place-items-center">
            <span className="w-10 h-1 rounded-full bg-[var(--ds-border)]" aria-hidden="true" />
          </div>
          <div className="flex items-start justify-between gap-3 px-4 pb-3">
            <div className="min-w-0">
              <h2 className="text-[16px] font-black text-[var(--ds-brand)] truncate">{title}</h2>
              {subtitle && <p className="text-[11px] text-[var(--ds-text-2)] truncate mt-0.5">{subtitle}</p>}
            </div>
            <button type="button" onClick={onClose} aria-label="إغلاق القائمة"
              className="shrink-0 w-9 h-9 rounded-full grid place-items-center bg-[var(--ds-surface)] border border-[var(--ds-border)] text-[var(--ds-text)] cursor-pointer">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {header && <div className="shrink-0 px-4 pb-3 border-b border-[var(--ds-border)]">{header}</div>}

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3">{children}</div>

        {footer && (
          <div className="shrink-0 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-[var(--ds-border)] bg-[var(--ds-bg)]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
