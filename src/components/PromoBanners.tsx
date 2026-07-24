import React, { useEffect, useState } from 'react';
import { PromoBanner } from '../types';

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

interface DefaultSlide { img: string; badge: string; title: string; sub: string; cta: string; }
const DEFAULT_SLIDES: DefaultSlide[] = [
  { img: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80', badge: 'عرض خاص', title: 'عرض الصيف', sub: 'خصومات تصل إلى ٣٠٪ على بيوت الساحل ومطروح', cta: 'احجز الآن' },
  { img: 'https://images.unsplash.com/photo-1438032005730-c779502df39b?auto=format&fit=crop&w=1200&q=80', badge: 'حصري ومميز', title: 'خلوات العائلات والخدام', sub: 'أجواء روحية متكاملة لخدمتكم وكنيستكم', cta: 'اكتشف البيوت' },
  { img: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80', badge: 'محدود للغاية', title: 'خصومات الحجز المبكر ⏳', sub: 'وفر ٢٠٪ إضافية عند تأكيد حجزك للأسبوع القادم', cta: 'احجز اليوم' },
];

export function SummerOfferCarousel({ slides, onCta }: { slides?: PromoBanner[]; onCta?: () => void }) {
  const items: DefaultSlide[] = slides && slides.length > 0
    ? slides.map((s) => ({
        img: s.imageUrl || DEFAULT_SLIDES[0].img,
        badge: s.badge || 'عرض خاص',
        title: s.title || '',
        sub: s.subtitle || '',
        cta: s.ctaText || 'احجز الآن',
      }))
    : DEFAULT_SLIDES;

  const [activeSlide, setActiveSlide] = useState(0);
  useEffect(() => {
    if (items.length <= 1) return;
    const interval = setInterval(() => setActiveSlide((prev) => (prev + 1) % items.length), 4000);
    return () => clearInterval(interval);
  }, [items.length]);
  const active = Math.min(activeSlide, items.length - 1);

  return (
    <div className="relative rounded-3xl overflow-hidden h-44 shadow-md bg-slate-900 group select-none">
      {items.map((s, i) => {
        if (i !== active) return null;
        const accent = ACCENTS[i % ACCENTS.length];
        return (
          <div key={i} className="absolute inset-0 transition-all duration-700 ease-in-out">
            <img src={s.img} alt={s.title} className="w-full h-full object-cover opacity-80" referrerPolicy="no-referrer" />
            <div className="absolute inset-0 bg-gradient-to-l from-black/60 via-black/30 to-transparent flex flex-col justify-center px-6 text-white text-right">
              <span className={`text-[10px] font-extrabold tracking-wider self-start px-2 py-0.5 rounded-md mb-1.5 ${accent.badge}`}>{s.badge}</span>
              <h2 className="text-base font-black leading-tight">{s.title}</h2>
              <p className="text-[11px] text-gray-200 font-bold mt-1">{s.sub}</p>
              <button onClick={onCta} className={`mt-3 text-[10px] font-black px-4 py-1.5 rounded-xl self-start shadow transition-all active:scale-95 ${accent.cta}`}>{s.cta}</button>
            </div>
          </div>
        );
      })}

      {/* Carousel Indicators */}
      {items.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10">
          {items.map((_, i) => (
            <button key={i} onClick={() => setActiveSlide(i)} className={`w-1.5 h-1.5 rounded-full transition-all ${active === i ? 'bg-white w-3' : 'bg-white/40'}`} />
          ))}
        </div>
      )}
    </div>
  );
}

const DEFAULT_COUNTDOWN = {
  img: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80',
  badge: 'عرض لفترة محدودة',
  discount: 'خصم ٢٠٪ على جميع الحجوزات',
  cta: 'احجز الآن',
};

export function CountdownOfferBanner({ banner, onCta }: { banner?: PromoBanner; onCta?: () => void }) {
  const img = banner?.imageUrl || DEFAULT_COUNTDOWN.img;
  const badge = banner?.badge || DEFAULT_COUNTDOWN.badge;
  const discount = banner?.title || DEFAULT_COUNTDOWN.discount;
  const cta = banner?.ctaText || DEFAULT_COUNTDOWN.cta;
  const endsAt = banner?.endsAt ? new Date(banner.endsAt).getTime() : null;

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

  return (
    <div className="relative rounded-3xl overflow-hidden h-32 bg-slate-950 text-white select-none shadow-md">
      <img src={img} alt="Limited offer background" className="w-full h-full absolute inset-0 object-cover opacity-30" referrerPolicy="no-referrer" />
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

          <button onClick={onCta} className="bg-[#C5A059] hover:bg-amber-600 text-[#0A2342] text-[10px] font-black px-4 py-2 rounded-xl shadow transition-all active:scale-95">{cta}</button>
        </div>
      </div>
    </div>
  );
}
