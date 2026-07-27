import React from 'react';
import { PromoBanner, BannerElement, BannerLayout, BannerFit } from '../../types';
import { safeUrl } from '../../lib/safeUrl';
import { BannerLinkIcons } from '../PromoBanners';

// The single renderer for a designed banner — used by BOTH the admin editor
// and the live app, so "what you design" is literally "what ships".
//
// Geometry is percent-based and type sizes use container-query units, which is
// what keeps a layout correct inside the app's EXISTING banner boxes at any
// width. The box's own height/rounding is owned by the caller and never
// changed here.

// The canvas the admin designs against. Element x-positions are stored as % of
// it, so it still describes the layout — but it no longer drives type size; see
// cqAt below.
export const DESIGN_WIDTH = 360;

// Fixed heights of the app's banner slots. Changing these would resize the
// containers the mobile app already ships — don't.
export const BANNER_BOX: Record<PromoBanner['placement'], { height: number; label: string }> = {
  carousel: { height: 176, label: 'الكاروسيل العلوي' }, // h-44
  countdown: { height: 128, label: 'بانر العدّاد' },     // h-32
};

export const DEFAULT_LAYOUT = (placement: PromoBanner['placement']): BannerLayout => ({
  version: 1,
  background: 'linear-gradient(135deg,#0A2342 0%,#123E75 100%)',
  image: { fit: 'cover', scale: 1, x: 0, y: 0, opacity: placement === 'countdown' ? 0.3 : 0.8 },
  overlay: { enabled: true, opacity: 0.45 },
  elements: [
    { id: 'badge', type: 'badge', visible: true, locked: false, x: 6, y: 12, fontSize: 10, color: '#C5A059', bg: '#0A2342', radius: 6, opacity: 1, align: 'start' },
    { id: 'title', type: 'title', visible: true, locked: false, x: 6, y: 32, width: 72, fontSize: 16, color: '#FFFFFF', opacity: 1, align: 'start' },
    { id: 'subtitle', type: 'subtitle', visible: true, locked: false, x: 6, y: 52, width: 72, fontSize: 11, color: '#E5E7EB', opacity: 1, align: 'start' },
    { id: 'button', type: 'button', visible: true, locked: false, x: 6, y: 72, fontSize: 10, color: '#FFFFFF', bg: '#5A5A40', radius: 12, opacity: 1, align: 'start' },
    { id: 'icons', type: 'icons', visible: true, locked: false, x: 60, y: 72, opacity: 1, align: 'start' },
    { id: 'logo', type: 'logo', visible: false, locked: false, x: 82, y: 10, fontSize: 12, color: '#FFFFFF', opacity: 0.9, align: 'start' },
  ],
});

// object-position for the crop presets; cover/contain/fill map to object-fit.
const FIT_STYLE: Record<BannerFit, { objectFit: React.CSSProperties['objectFit']; objectPosition: string }> = {
  cover: { objectFit: 'cover', objectPosition: 'center' },
  contain: { objectFit: 'contain', objectPosition: 'center' },
  fill: { objectFit: 'fill', objectPosition: 'center' },
  center: { objectFit: 'cover', objectPosition: 'center' },
  top: { objectFit: 'cover', objectPosition: 'top' },
  bottom: { objectFit: 'cover', objectPosition: 'bottom' },
  left: { objectFit: 'cover', objectPosition: 'left' },
  right: { objectFit: 'cover', objectPosition: 'right' },
};

// px at the design size → container-query units, so text scales with the box.
//
// Anchored to HEIGHT (cqh), not width. Element positions are already stored as
// % of the box, so they scale with it either way — but sizing text off the box
// WIDTH meant any box wider than the 360px design width blew every font up by
// the same factor. At a desktop width of 1112px the 16px title rendered at
// 62px inside a 176px-tall box: four overlapping pairs and two elements spilling
// out of the frame. Anchoring to height keeps the composition intact at any
// width, which is what lets the banner run full-bleed on a desktop.
//
// The design height differs per placement (carousel 176, countdown 128), so the
// caller binds the right one — a shared constant would shrink countdown text to
// 73% of its designed size.
const cqAt = (px: number, designHeight: number) => `${((px / designHeight) * 100).toFixed(3)}cqh`;

export function elementLabel(type: BannerElement['type']): string {
  return {
    badge: 'الشارة', title: 'العنوان', subtitle: 'الوصف', button: 'زر الإجراء',
    icons: 'الأيقونات', logo: 'الشعار', availability: 'الأماكن المتاحة', testimonial: 'رأي ضيف',
  }[type];
}

// Numbers and quotes that must come from the database, never from the layout.
// When a field is missing the element renders nothing at all — an empty banner
// slot is honest, an invented "باقي ٣ أماكن" is not.
export interface BannerLiveData {
  freeBeds?: number | null;
  testimonial?: { text: string; author: string; rating: number } | null;
}

function ElementBody({ el, banner, onOpenHouse, live }: { el: BannerElement; banner: PromoBanner; onOpenHouse?: (houseId: string) => void; live?: BannerLiveData }) {
  // Bound to this placement's design height — see cqAt.
  const designHeight = BANNER_BOX[banner.placement]?.height ?? BANNER_BOX.carousel.height;
  const cq = (px: number) => cqAt(px, designHeight);

  const common: React.CSSProperties = {
    color: el.color,
    opacity: el.opacity ?? 1,
    fontFamily: el.fontFamily,
    fontWeight: el.fontWeight,
    letterSpacing: el.letterSpacing != null ? cq(el.letterSpacing) : undefined,
    // Photos vary wildly; a soft shadow is what keeps text readable on top.
    textShadow: el.shadow ? '0 2px 6px rgba(0,0,0,0.55)' : undefined,
  };
  switch (el.type) {
    case 'badge':
      return banner.badge ? (
        <span style={{ ...common, background: el.bg, borderRadius: el.radius, fontSize: cq(el.fontSize ?? 10), padding: `${cq(3)} ${cq(8)}` }}
          className="inline-block font-extrabold whitespace-nowrap">{banner.badge}</span>
      ) : null;
    case 'title':
      return <h2 style={{ ...common, fontSize: cq(el.fontSize ?? 16) }} className="font-black leading-tight">{banner.title}</h2>;
    case 'subtitle':
      return <p style={{ ...common, fontSize: cq(el.fontSize ?? 11) }} className="font-bold leading-snug">{banner.subtitle}</p>;
    case 'button': {
      const style: React.CSSProperties = { ...common, background: el.bg, borderRadius: el.radius, fontSize: cq(el.fontSize ?? 10), padding: `${cq(6)} ${cq(16)}` };
      const cls = 'inline-block font-black whitespace-nowrap shadow';
      // An in-app house target wins over an external link: keeping the visitor
      // inside the app is the whole point of promoting a house.
      if (banner.linkedHouseId && onOpenHouse) {
        return (
          <button type="button" style={style} className={`${cls} cursor-pointer`}
            onClick={(e) => { e.stopPropagation(); onOpenHouse(banner.linkedHouseId!); }}>
            {banner.ctaText}
          </button>
        );
      }
      const href = safeUrl(banner.linkUrl);
      return href
        ? <a href={href} target="_blank" rel="noopener noreferrer nofollow" style={style} className={cls}>{banner.ctaText}</a>
        : <span style={style} className={cls}>{banner.ctaText}</span>;
    }
    case 'availability': {
      // Real free beds for this banner's house and window, or nothing.
      const n = live?.freeBeds;
      if (n == null || n <= 0) return null;
      return (
        <span style={{ ...common, background: el.bg ?? 'rgba(217,74,74,0.92)', borderRadius: el.radius ?? 999, fontSize: cq(el.fontSize ?? 10), padding: `${cq(4)} ${cq(10)}` }}
          className="inline-flex items-center gap-[0.4em] font-black whitespace-nowrap shadow">
          <span style={{ width: cq(5), height: cq(5) }} className="rounded-full bg-white/90 animate-pulse" />
          باقي {n.toLocaleString('ar-EG')} سرير متاح
        </span>
      );
    }
    case 'testimonial': {
      const t = live?.testimonial;
      if (!t) return null;
      return (
        <div style={{ ...common, background: el.bg ?? 'rgba(255,255,255,0.94)', borderRadius: el.radius ?? 16, padding: `${cq(8)} ${cq(10)}` }}
          className="shadow-lg text-right">
          <div style={{ fontSize: cq(9) }} className="text-[#C5A059] leading-none mb-[0.35em]">{'★'.repeat(Math.round(t.rating))}</div>
          <p style={{ fontSize: cq(el.fontSize ?? 9.5), color: el.color ?? '#2E2E24' }} className="font-bold leading-snug line-clamp-2">“{t.text}”</p>
          <span style={{ fontSize: cq(8) }} className="font-black text-[#8A8A70]">— {t.author}</span>
        </div>
      );
    }
    case 'icons':
      return <div style={{ opacity: el.opacity ?? 1 }}><BannerLinkIcons links={banner.links} /></div>;
    case 'logo':
      return <span style={{ ...common, fontSize: cq(el.fontSize ?? 12) }} className="font-black">بيما</span>;
  }
}

interface BannerCanvasProps {
  banner: PromoBanner;
  layout: BannerLayout;
  /** Editor-only chrome */
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  interactive?: boolean;
  /** Opens a house inside the app when the banner targets one. */
  onOpenHouse?: (houseId: string) => void;
  /** Real numbers/quotes for the live elements; absent → they render nothing. */
  live?: BannerLiveData;
}

// Renders the layout inside a box whose height comes from BANNER_BOX — the
// same fixed height the app already uses for that placement.
export default function BannerCanvas({ banner, layout, selectedId, onSelect, interactive, onOpenHouse, live }: BannerCanvasProps) {
  const img = layout.image;
  const fit = FIT_STYLE[img.fit] ?? FIT_STYLE.cover;
  return (
    <div
      className="relative w-full h-full overflow-hidden select-none"
      // 'size' (not 'inline-size') so cqh resolves. Safe because every caller
      // gives this box a definite height — PromoBanners uses the fixed h-44/h-32
      // slots and the studio uses BANNER_BOX. An auto-height parent would
      // collapse it.
      style={{ containerType: 'size' }}
    >
      {/* Painted first so a banner with no photo still has a real look. */}
      {layout.background && (
        <div className="absolute inset-0" style={{ background: layout.background }} />
      )}
      {banner.imageUrl && (
        <img
          src={banner.imageUrl}
          alt=""
          referrerPolicy="no-referrer"
          draggable={false}
          className="absolute inset-0 w-full h-full"
          style={{
            objectFit: fit.objectFit,
            objectPosition: fit.objectPosition,
            opacity: img.opacity,
            // Pan + zoom are a transform so the image is repositioned inside
            // the frame instead of the frame being resized.
            transform: `translate(${img.x}%, ${img.y}%) scale(${img.scale})`,
          }}
        />
      )}
      {layout.overlay.enabled && (
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: `linear-gradient(to left, rgba(0,0,0,${layout.overlay.opacity}), rgba(0,0,0,${layout.overlay.opacity * 0.55}), transparent)` }} />
      )}

      {layout.elements.map((el) => {
        if (!el.visible) return null;
        const selected = interactive && selectedId === el.id;
        return (
          <div
            key={el.id}
            data-el={el.id}
            onPointerDown={interactive && !el.locked ? () => onSelect?.(el.id) : undefined}
            className={`absolute text-right ${interactive && !el.locked ? 'cursor-move' : ''} ${selected ? 'outline outline-2 outline-[#5A5A40] outline-offset-2 rounded-sm' : ''}`}
            style={{
              right: `${el.x}%`,
              top: `${el.y}%`,
              width: el.width != null ? `${el.width}%` : undefined,
              transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
              textAlign: el.align === 'center' ? 'center' : el.align === 'end' ? 'left' : 'right',
            }}
          >
            <ElementBody el={el} banner={banner} onOpenHouse={onOpenHouse} live={live} />
          </div>
        );
      })}
    </div>
  );
}
