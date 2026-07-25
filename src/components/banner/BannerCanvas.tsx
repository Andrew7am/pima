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

export const DESIGN_WIDTH = 360; // px the admin designs against

// Fixed heights of the app's banner slots. Changing these would resize the
// containers the mobile app already ships — don't.
export const BANNER_BOX: Record<PromoBanner['placement'], { height: number; label: string }> = {
  carousel: { height: 176, label: 'الكاروسيل العلوي' }, // h-44
  countdown: { height: 128, label: 'بانر العدّاد' },     // h-32
};

export const DEFAULT_LAYOUT = (placement: PromoBanner['placement']): BannerLayout => ({
  version: 1,
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

// px at design width → container-query units, so text scales with the box.
const cq = (px: number) => `${((px / DESIGN_WIDTH) * 100).toFixed(3)}cqw`;

export function elementLabel(type: BannerElement['type']): string {
  return { badge: 'الشارة', title: 'العنوان', subtitle: 'الوصف', button: 'زر الإجراء', icons: 'الأيقونات', logo: 'الشعار' }[type];
}

function ElementBody({ el, banner }: { el: BannerElement; banner: PromoBanner }) {
  const common: React.CSSProperties = { color: el.color, opacity: el.opacity ?? 1 };
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
      const href = safeUrl(banner.linkUrl);
      const style: React.CSSProperties = { ...common, background: el.bg, borderRadius: el.radius, fontSize: cq(el.fontSize ?? 10), padding: `${cq(6)} ${cq(16)}` };
      const cls = 'inline-block font-black whitespace-nowrap shadow';
      return href
        ? <a href={href} target="_blank" rel="noopener noreferrer nofollow" style={style} className={cls}>{banner.ctaText}</a>
        : <span style={style} className={cls}>{banner.ctaText}</span>;
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
}

// Renders the layout inside a box whose height comes from BANNER_BOX — the
// same fixed height the app already uses for that placement.
export default function BannerCanvas({ banner, layout, selectedId, onSelect, interactive }: BannerCanvasProps) {
  const img = layout.image;
  const fit = FIT_STYLE[img.fit] ?? FIT_STYLE.cover;
  return (
    <div
      className="relative w-full h-full overflow-hidden select-none"
      style={{ containerType: 'inline-size' }}
    >
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
            <ElementBody el={el} banner={banner} />
          </div>
        );
      })}
    </div>
  );
}
