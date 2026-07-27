import React, { useEffect, useState } from 'react';
import { Instagram, Facebook, Youtube, Twitter, Send, Globe, Music2, MessageCircle, Phone, Mail } from 'lucide-react';
import { PromoBanner, PromoBannerLink, PromoLinkPlatform } from '../types';
import { safeUrl } from '../lib/safeUrl';
import BannerCanvas from './banner/BannerCanvas';
import type { BannerLiveData } from './banner/BannerCanvas';
import { useBannerTracking } from './banner/useBannerTracking';

// Icon + brand tint per platform. lucide has no WhatsApp/TikTok glyph, so those
// reuse the closest shape (chat bubble / music note) with their brand colour.
const PLATFORM_META: Record<PromoLinkPlatform, { Icon: React.ElementType; tint: string; label: string }> = {
  instagram: { Icon: Instagram, tint: '#E1306C', label: 'إنستجرام' },
  facebook: { Icon: Facebook, tint: '#1877F2', label: 'فيسبوك' },
  youtube: { Icon: Youtube, tint: '#FF0000', label: 'يوتيوب' },
  whatsapp: { Icon: MessageCircle, tint: '#25D366', label: 'واتساب' },
  telegram: { Icon: Send, tint: '#229ED9', label: 'تليجرام' },
  tiktok: { Icon: Music2, tint: '#000000', label: 'تيك توك' },
  x: { Icon: Twitter, tint: '#111111', label: 'إكس / تويتر' },
  website: { Icon: Globe, tint: '#0A2342', label: 'الموقع' },
  phone: { Icon: Phone, tint: '#5A5A40', label: 'اتصال' },
  email: { Icon: Mail, tint: '#8A8A70', label: 'إيميل' },
};

export const PROMO_PLATFORMS = Object.entries(PLATFORM_META).map(([value, m]) => ({
  value: value as PromoLinkPlatform,
  label: m.label,
}));

// The row of round icon links drawn inside a banner. Each is a real anchor, so
// a tap opens the account directly instead of firing the banner's own CTA.
export function BannerLinkIcons({ links, size = 'w-7 h-7' }: { links?: PromoBannerLink[]; size?: string }) {
  const usable = (links ?? [])
    .map((l) => ({ ...l, href: safeUrl(l.url) }))
    .filter((l) => l.href);
  if (usable.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5 flex-wrap" dir="ltr">
      {usable.map((l) => {
        const meta = PLATFORM_META[l.platform] ?? PLATFORM_META.website;
        const { Icon } = meta;
        return (
          <a
            key={l.id}
            data-el="icons"
            href={l.href!}
            target="_blank"
            rel="noopener noreferrer nofollow"
            onClick={(e) => e.stopPropagation()}
            title={l.label || meta.label}
            aria-label={l.label || meta.label}
            className={`${size} rounded-full bg-white/95 hover:bg-white flex items-center justify-center shadow-sm transition-transform hover:scale-110 active:scale-95 shrink-0`}
          >
            <Icon className="w-3.5 h-3.5" style={{ color: meta.tint }} />
          </a>
        );
      })}
    </div>
  );
}

// Promo banners ported from the source app (same dimensions, colors and layout):
//  - SummerOfferCarousel: 3-slide auto-rotating hero shown at the TOP.
//  - CountdownOfferBanner: a live-countdown offer shown at the BOTTOM.
// Both are admin-managed (migration 076): pass DB rows to drive them, and they
// fall back to the ported default content when none are configured.
// onCta fires when a call-to-action is pressed (e.g. scroll to the listings).

// Per-slide accent presets so admin-created slides keep the original variety.
const ACCENTS = [
  { badge: 'text-[#C5A059] bg-[#0A2342]/70', cta: 'bg-[#5A5A40] hover:bg-[#4A4A3A] text-white' },
  { badge: 'text-amber-300 bg-rose-950/70', cta: 'bg-[#0A2342] hover:bg-slate-800 text-white' },
  { badge: 'text-[#C5A059] bg-[#5A5A40]/70', cta: 'bg-[#C5A059] hover:bg-amber-600 text-[#0A2342]' },
];

interface DefaultSlide { img?: string; gradient?: string; badge: string; title: string; sub: string; cta: string; href?: string | null; houseId?: string | null; links?: PromoBannerLink[]; }

// Shown only until an admin publishes real banners. These are drawn locally
// with Pima's own colours instead of pulling stock photos from a third-party
// CDN: no external request, no foreign beach imagery, and nothing that can
// break if that host changes.
const DEFAULT_SLIDES: DefaultSlide[] = [
  { gradient: 'linear-gradient(135deg,#0A2342 0%,#123E75 55%,#1B5E9E 100%)', badge: 'أهلاً بك في بيما', title: 'بيوت المؤتمرات والخلوات', sub: 'تصفّح البيوت واحجز خلوتك في دقيقة', cta: 'اكتشف البيوت' },
  { gradient: 'linear-gradient(135deg,#5A5A40 0%,#767659 60%,#A3A37E 100%)', badge: 'لخدمتك وكنيستك', title: 'خلوات العائلات والخدام', sub: 'أجواء روحية متكاملة في كل المحافظات', cta: 'ابدأ التصفّح' },
  { gradient: 'linear-gradient(135deg,#7A5C1E 0%,#C5A059 60%,#E7C987 100%)', badge: 'أسعار واضحة', title: 'احجز بثقة', sub: 'تقييمات حقيقية وأسعار بدون مفاجآت', cta: 'شوف البيوت' },
];

export function SummerOfferCarousel({ slides, onCta, onOpenHouse, live }: {
  slides?: PromoBanner[]; onCta?: () => void; onOpenHouse?: (houseId: string) => void;
  live?: Record<string, BannerLiveData>;
}) {
  const items: DefaultSlide[] = slides && slides.length > 0
    ? slides.map((s) => ({
        img: s.imageUrl,
        gradient: s.imageUrl ? undefined : DEFAULT_SLIDES[0].gradient,
        badge: s.badge || 'عرض خاص',
        title: s.title || '',
        sub: s.subtitle || '',
        cta: s.ctaText || 'احجز الآن',
        href: safeUrl(s.linkUrl),
        houseId: s.linkedHouseId,
        links: s.links,
      }))
    : DEFAULT_SLIDES;

  // Story-style progression: each slide fills a segment at the top, and the
  // visitor can tap either side to step through or hold to pause — the
  // interaction people already know from Instagram/WhatsApp stories.
  const [activeSlide, setActiveSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const SLIDE_MS = 5000;
  const TICK = 50;

  useEffect(() => {
    if (items.length <= 1 || paused) return;
    const timer = setInterval(() => {
      setProgress((p) => {
        const next = p + (TICK / SLIDE_MS) * 100;
        if (next >= 100) { setActiveSlide((s) => (s + 1) % items.length); return 0; }
        return next;
      });
    }, TICK);
    return () => clearInterval(timer);
  }, [items.length, paused]);

  const active = Math.min(activeSlide, items.length - 1);
  const step = (dir: 1 | -1) => {
    setProgress(0);
    setActiveSlide((s) => (s + dir + items.length) % items.length);
  };
  // A slide designed in the banner editor renders from its saved layout; the
  // rest keep the original fixed design. The box (h-44) is identical either way.
  const designed = slides && slides.length > 0 ? slides[active] : undefined;
  const track = useBannerTracking(designed?.id);

  return (
    <div
      ref={track.ref}
      onClickCapture={track.onClickCapture}
      // h-44 alone made this a 2:1 hero on a phone but a 7.6:1 letterbox strip
      // on a desktop, cropping most of the artwork away. Growing the height with
      // the viewport keeps it near a normal hero ratio at every width.
      className="relative rounded-3xl overflow-hidden h-44 sm:h-56 lg:h-72 shadow-md bg-slate-900 group select-none"
    >
      {designed?.layout ? (
        // z-10 keeps the artwork and its CTA above the story tap zones.
        <div className="relative z-10 w-full h-full">
          <BannerCanvas banner={designed} layout={designed.layout} onOpenHouse={onOpenHouse} live={live?.[designed.id]} />
        </div>
      ) : items.map((s, i) => {
        if (i !== active) return null;
        const accent = ACCENTS[i % ACCENTS.length];
        return (
          <div key={`${active}-${i}`} className="absolute inset-0 z-10 animate-in fade-in duration-500">
            {s.img
              ? <img src={s.img} alt={s.title} className="w-full h-full object-cover opacity-80" referrerPolicy="no-referrer" />
              : <div className="w-full h-full" style={{ background: s.gradient }} />}
            <div className="absolute inset-0 bg-gradient-to-l from-black/60 via-black/30 to-transparent flex flex-col justify-center px-6 text-white text-right">
              <span className={`text-[10px] font-extrabold tracking-wider self-start px-2 py-0.5 rounded-md mb-1.5 ${accent.badge}`}>{s.badge}</span>
              <h2 className="text-base font-black leading-tight">{s.title}</h2>
              <p className="text-[11px] text-gray-200 font-bold mt-1">{s.sub}</p>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {/* A configured link turns the CTA into a real anchor; otherwise
                    it keeps firing the caller's onCta (scroll to listings). */}
                {s.houseId && onOpenHouse ? (
                  <button data-el="button" onClick={() => onOpenHouse(s.houseId!)}
                    className={`text-[10px] font-black px-4 py-1.5 rounded-xl shadow transition-all active:scale-95 ${accent.cta}`}>
                    {s.cta}
                  </button>
                ) : s.href ? (
                  <a
                    data-el="button"
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className={`text-[10px] font-black px-4 py-1.5 rounded-xl shadow transition-all active:scale-95 ${accent.cta}`}
                  >
                    {s.cta}
                  </a>
                ) : (
                  <button data-el="button" onClick={onCta} className={`text-[10px] font-black px-4 py-1.5 rounded-xl shadow transition-all active:scale-95 ${accent.cta}`}>{s.cta}</button>
                )}
                <BannerLinkIcons links={s.links} />
              </div>
            </div>
          </div>
        );
      })}

      {/* Story progress bars — one segment per slide, the active one filling */}
      {items.length > 1 && (
        <div className="absolute top-2 inset-x-2 flex items-center gap-1 z-20 pointer-events-none">
          {items.map((_, i) => (
            <div key={i} className="flex-1 h-[3px] rounded-full bg-white/30 overflow-hidden">
              <div
                className="h-full bg-white rounded-full"
                style={{
                  width: i < active ? '100%' : i === active ? `${progress}%` : '0%',
                  transition: i === active ? 'width 50ms linear' : 'none',
                }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Tap the upper corners to step, hold to pause — story gestures kept out
          of the lower band so they can never swallow the CTA underneath. */}
      {items.length > 1 && (
        <>
          <button
            aria-label="الشريحة السابقة"
            onClick={() => step(-1)}
            onPointerDown={() => setPaused(true)}
            onPointerUp={() => setPaused(false)}
            onPointerLeave={() => setPaused(false)}
            className="absolute top-0 right-0 w-1/4 h-3/5 z-20 cursor-pointer"
          />
          <button
            aria-label="الشريحة التالية"
            onClick={() => step(1)}
            onPointerDown={() => setPaused(true)}
            onPointerUp={() => setPaused(false)}
            onPointerLeave={() => setPaused(false)}
            className="absolute top-0 left-0 w-1/4 h-3/5 z-20 cursor-pointer"
          />
        </>
      )}
    </div>
  );
}

const DEFAULT_COUNTDOWN = {
  // Local gradient, not a stock photo from someone else's CDN — see DEFAULT_SLIDES.
  gradient: 'linear-gradient(135deg,#1A1A14 0%,#3D3D2B 60%,#5A5A40 100%)',
  badge: 'عرض لفترة محدودة',
  discount: 'خصم ٢٠٪ على جميع الحجوزات',
  cta: 'احجز الآن',
};

export function CountdownOfferBanner({ banner, onCta, onOpenHouse, live }: { banner?: PromoBanner; onCta?: () => void; onOpenHouse?: (houseId: string) => void; live?: BannerLiveData }) {
  const img = banner?.imageUrl;
  const badge = banner?.badge || DEFAULT_COUNTDOWN.badge;
  const discount = banner?.title || DEFAULT_COUNTDOWN.discount;
  const cta = banner?.ctaText || DEFAULT_COUNTDOWN.cta;
  const endsAt = banner?.endsAt ? new Date(banner.endsAt).getTime() : null;

  const track = useBannerTracking(banner?.id);
  const [timeLeft, setTimeLeft] = useState({ hours: 12, minutes: 45, seconds: 30 });
  useEffect(() => {
    const tick = () => {
      if (endsAt) {
        const diff = Math.max(0, Math.floor((endsAt - Date.now()) / 1000));
        setTimeLeft({ hours: Math.floor(diff / 3600), minutes: Math.floor((diff % 3600) / 60), seconds: diff % 60 });
      } else {
        setTimeLeft((prev) => {
          if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
          if (prev.minutes > 0) return { ...prev, minutes: prev.minutes - 1, seconds: 59 };
          if (prev.hours > 0) return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
          return { hours: 12, minutes: 45, seconds: 30 };
        });
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [endsAt]);

  if (banner?.layout) {
    return (
      <div ref={track.ref} onClickCapture={track.onClickCapture}
        className="relative rounded-3xl overflow-hidden h-32 sm:h-40 lg:h-48 bg-slate-950 text-white select-none shadow-md">
        <BannerCanvas banner={banner} layout={banner.layout} onOpenHouse={onOpenHouse} live={live} />
      </div>
    );
  }

  return (
    <div ref={track.ref} onClickCapture={track.onClickCapture}
      className="relative rounded-3xl overflow-hidden h-32 sm:h-40 lg:h-48 bg-slate-950 text-white select-none shadow-md">
      {img
        ? <img src={img} alt="" className="w-full h-full absolute inset-0 object-cover opacity-30" referrerPolicy="no-referrer" />
        : <div className="absolute inset-0" style={{ background: DEFAULT_COUNTDOWN.gradient }} />}
      <div className="absolute inset-0 p-4 flex flex-col justify-between text-right">
        <div className="flex justify-between items-center">
          <span className="text-[8px] font-black bg-rose-600 text-white px-2 py-0.5 rounded-full animate-pulse">{badge}</span>
          <span className="text-[10px] font-black text-amber-300">{discount}</span>
        </div>

        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center gap-1" dir="ltr">
            <div className="flex flex-col items-center">
              <div className="bg-black/60 border border-white/20 rounded-lg w-7 h-7 flex items-center justify-center text-xs font-black text-white">{timeLeft.seconds.toString().padStart(2, '0')}</div>
              <span className="text-[6.5px] text-gray-300 font-bold mt-0.5">ثانية</span>
            </div>
            <span className="text-xs font-black text-white -mt-3">:</span>
            <div className="flex flex-col items-center">
              <div className="bg-black/60 border border-white/20 rounded-lg w-7 h-7 flex items-center justify-center text-xs font-black text-white">{timeLeft.minutes.toString().padStart(2, '0')}</div>
              <span className="text-[6.5px] text-gray-300 font-bold mt-0.5">دقيقة</span>
            </div>
            <span className="text-xs font-black text-white -mt-3">:</span>
            <div className="flex flex-col items-center">
              <div className="bg-black/60 border border-white/20 rounded-lg w-7 h-7 flex items-center justify-center text-xs font-black text-white">{timeLeft.hours.toString().padStart(2, '0')}</div>
              <span className="text-[6.5px] text-gray-300 font-bold mt-0.5">ساعة</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <BannerLinkIcons links={banner?.links} size="w-6 h-6" />
            {banner?.linkedHouseId && onOpenHouse ? (
              <button data-el="button" onClick={() => onOpenHouse(banner.linkedHouseId!)}
                className="bg-[#C5A059] hover:bg-amber-600 text-[#0A2342] text-[10px] font-black px-4 py-2 rounded-xl shadow transition-all active:scale-95">
                {cta}
              </button>
            ) : safeUrl(banner?.linkUrl) ? (
              <a
                data-el="button"
                href={safeUrl(banner?.linkUrl)!}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="bg-[#C5A059] hover:bg-amber-600 text-[#0A2342] text-[10px] font-black px-4 py-2 rounded-xl shadow transition-all active:scale-95"
              >
                {cta}
              </a>
            ) : (
              <button data-el="button" onClick={onCta} className="bg-[#C5A059] hover:bg-amber-600 text-[#0A2342] text-[10px] font-black px-4 py-2 rounded-xl shadow transition-all active:scale-95">{cta}</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
