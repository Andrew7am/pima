import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RetreatHouse } from '../../types';
import { ArrowRight, ChevronLeft, ChevronRight, Heart, MapPin, Share2, Star, MoveHorizontal } from 'lucide-react';
import { tapFeedback } from '../../lib/haptics';

interface HouseHeroProps {
  house: RetreatHouse;
  reviewsCount: number;
  isFavorited: boolean;
  isCopied: boolean;
  whatsappShareUrl: string;
  onBack: () => void;
  onShare: () => void;
  onToggleFavorite: (houseId: string) => void;
}

const AUTOPLAY_MS = 5000;
const SWIPE_THRESHOLD = 40; // px — a shorter drag is a tap, not a swipe

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/* Amenity glyphs, drawn as one set so the row reads as a single strip rather
   than five icons borrowed from different families. */
const IconGuests = () => (
  <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="8" r="3.2" /><path d="M2.5 19.5v-1a6.5 6.5 0 0 1 13 0v1" />
    <path d="M16.5 5.6a3.2 3.2 0 0 1 0 5.2M17.5 13.4a5.5 5.5 0 0 1 4 5.3v.8" />
  </svg>
);
const IconBed = () => (
  <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2.5 18v-8M2.5 13h19v5M21.5 18v-4.5a3 3 0 0 0-3-3H11V13" /><circle cx="6.8" cy="9.8" r="2" />
  </svg>
);
const IconPool = () => (
  <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 17.5c1.6 0 1.6 1.4 3.2 1.4s1.6-1.4 3.2-1.4 1.6 1.4 3.2 1.4 1.6-1.4 3.2-1.4 1.6 1.4 3.2 1.4 1.6-1.4 3.2-1.4" />
    <path d="M2 12.8c1.6 0 1.6 1.4 3.2 1.4s1.6-1.4 3.2-1.4 1.6 1.4 3.2 1.4 1.6-1.4 3.2-1.4 1.6 1.4 3.2 1.4 1.6-1.4 3.2-1.4" />
    <path d="M7.5 10.5V6.2a2.2 2.2 0 0 1 4.4 0M14.5 10.5V6.2a2.2 2.2 0 0 1 4.4 0" />
  </svg>
);
const IconHall = () => (
  <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="7.5" r="2.6" /><path d="M7.4 15.5a4.8 4.8 0 0 1 9.2 0" />
    <circle cx="4.6" cy="11" r="2" /><circle cx="19.4" cy="11" r="2" />
    <path d="M2 18.5a3.4 3.4 0 0 1 4.6-2.6M22 18.5a3.4 3.4 0 0 0-4.6-2.6" />
  </svg>
);
const IconMeals = () => (
  <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 3v8a2.5 2.5 0 0 1-5 0V3M4.5 11v10" />
    <path d="M17 3c-2.2 0-3.5 2.2-3.5 5s1.3 4.5 3.5 4.5V21" /><path d="M20.5 3v18" />
  </svg>
);

/**
 * The place-detail hero: a swipeable gallery carrying the headline facts.
 *
 * Deliberately its own file. The detail screen below it is ~2,400 lines of
 * booking, rooms, menu, facilities, weather, reviews and calculators, and none
 * of it should have to be opened to change the top of the page.
 *
 * Reads only from the house record it is handed — no fetching, no new state
 * beyond which frame is showing.
 */
export default function HouseHero({
  house, reviewsCount, isFavorited, isCopied, whatsappShareUrl, onBack, onShare, onToggleFavorite,
}: HouseHeroProps) {
  const images = house.images?.length ? house.images : [];
  const [index, setIndex] = useState(0);
  const [interacted, setInteracted] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const reduced = prefersReducedMotion();

  const go = useCallback((next: number) => {
    if (images.length === 0) return;
    setIndex(((next % images.length) + images.length) % images.length);
  }, [images.length]);

  const step = (delta: number) => {
    tapFeedback();
    setInteracted(true);
    go(index + delta);
  };

  // Autoplay, restarted by every index change — so a manual move buys a fresh
  // five seconds instead of being overtaken a moment later. Off entirely under
  // reduced motion: an unattended carousel is what that setting exists to stop.
  useEffect(() => {
    if (reduced || images.length < 2) return;
    const t = setTimeout(() => go(index + 1), AUTOPLAY_MS);
    return () => clearTimeout(t);
  }, [index, images.length, reduced, go]);

  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < SWIPE_THRESHOLD) return;
    // RTL: dragging rightwards turns the page forward, as in an Arabic book.
    step(dx > 0 ? 1 : -1);
  };

  // Headline facts, each read off the record and simply absent when the house
  // does not have it — an empty slot is better than a claim that is not true.
  const amenities: { icon: React.ReactNode; label: string }[] = [];
  if (house.bedsCount > 0) amenities.push({ icon: <IconGuests />, label: `حتى ${house.bedsCount} فرد` });
  if (house.roomsCount > 0) amenities.push({ icon: <IconBed />, label: `${house.roomsCount} غرفة` });
  if (house.services?.includes('حمام سباحة')) amenities.push({ icon: <IconPool />, label: 'مسبح' });
  if (house.conferenceHalls?.length) amenities.push({ icon: <IconHall />, label: 'قاعة اجتماعات' });
  if (house.menu?.isIncluded) amenities.push({ icon: <IconMeals />, label: 'إقامة كاملة' });

  // The captions belong to the opening frame. Everything after it is a plain
  // photograph — no wash, no badge, no text — so the gallery reads as a gallery.
  const showOverlay = index === 0;

  const roundStars = Math.round(house.rating);
  const circleBtn = 'w-10 h-10 rounded-full border shadow-[0_2px_8px_rgba(45,45,36,0.08)] flex items-center justify-center transition-colors cursor-pointer pima-press';

  return (
    <div className="space-y-3">
      {/* Page controls as circles, so nothing rectangular competes with the
          photograph. The avatar, bell and brand above these come from the app
          header and are left exactly as they are. */}
      <div className="flex items-center justify-between">
        <button
          id="detail-back-btn"
          onClick={() => { tapFeedback(); onBack(); }}
          aria-label="رجوع"
          className={`${circleBtn} bg-white border-[#EDE7DA] text-[#4A4A3A] hover:bg-[#F1ECE0]`}
        >
          <ArrowRight className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2">
          <a
            id={`whatsapp-share-detail-${house.id}`}
            href={whatsappShareUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="مشاركة على واتساب"
            className={`${circleBtn} bg-white border-[#EDE7DA] hover:bg-[#F1ECE0]`}
          >
            <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] fill-[#25D366]">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
          </a>

          <button
            id={`share-detail-${house.id}`}
            onClick={() => { tapFeedback(); onShare(); }}
            aria-label={isCopied ? 'تم نسخ الرابط' : 'مشاركة'}
            className={`${circleBtn} ${isCopied ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-white border-[#EDE7DA] text-[#4A4A3A] hover:bg-[#F1ECE0]'}`}
          >
            <Share2 className="w-[18px] h-[18px]" />
          </button>

          <button
            id={`toggle-fav-detail-${house.id}`}
            onClick={() => { tapFeedback(); onToggleFavorite(house.id); }}
            aria-label={isFavorited ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
            aria-pressed={isFavorited}
            className={`${circleBtn} ${isFavorited ? 'bg-rose-50 border-rose-200' : 'bg-white border-[#EDE7DA] hover:bg-[#F1ECE0]'}`}
          >
            <Heart className={`w-[18px] h-[18px] transition-colors ${isFavorited ? 'fill-rose-500 text-rose-500' : 'text-[#8A8A70]'}`} />
          </button>
        </div>
      </div>

      {/* ── Gallery ── */}
      <div
        className="relative rounded-[28px] overflow-hidden bg-slate-900 select-none h-[42dvh] min-h-[300px] max-h-[440px] shadow-[0_16px_40px_-8px_rgba(45,45,36,0.28),0_4px_12px_rgba(45,45,36,0.08)]"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Frames stack and cross-fade rather than slide: nothing appears to
            travel sideways behind a fixed frame. The waiting frames sit a
            little larger, which reads as depth as they settle. */}
        {images.map((img, i) => (
          <img
            key={img + i}
            src={img}
            alt={i === index ? house.name : ''}
            referrerPolicy="no-referrer"
            aria-hidden={i !== index}
            className="absolute inset-0 w-full h-full object-cover"
            style={{
              opacity: i === index ? 1 : 0,
              transform: reduced ? undefined : `scale(${i === index ? 1 : 1.06})`,
              transition: reduced ? undefined : 'opacity 600ms var(--motion-ease), transform 900ms var(--motion-ease)',
            }}
          />
        ))}

        {/* Wash only where words actually sit: the bottom of the first frame,
            at 30%, so the photograph keeps its own colour. Frames after the
            first carry nothing and are left completely clean. */}
        {showOverlay && (
          <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/30 via-black/15 to-transparent" />
        )}

        {showOverlay && (
          <span className="absolute top-4 right-4 flex items-center gap-1.5 bg-black/40 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-[11px] font-black">
            <MapPin className="w-3.5 h-3.5" />
            {house.governorate}
          </span>
        )}

        {images.length > 1 && (
          <>
            <button
              type="button" onClick={() => step(1)} aria-label="الصورة التالية"
              className="absolute top-1/2 -translate-y-1/2 right-3 w-9 h-9 rounded-full bg-black/40 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/60 transition-colors cursor-pointer pima-press"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <button
              type="button" onClick={() => step(-1)} aria-label="الصورة السابقة"
              className="absolute top-1/2 -translate-y-1/2 left-3 w-9 h-9 rounded-full bg-black/40 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/60 transition-colors cursor-pointer pima-press"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          </>
        )}

        {/* Name, rating, amenities — first frame only. Every frame after it is
            a plain photograph, which is what makes the gallery read as a
            gallery rather than as five captioned covers. */}
        {showOverlay && (
        <div className="absolute inset-x-0 bottom-0 p-5 pb-14">
          <div className="max-w-[70%] me-auto text-right space-y-2">
            <h1 className="text-[19px] leading-tight font-black text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)]">
              {house.name}
            </h1>
            <div className="flex items-center gap-2 justify-end">
              <span className="text-[15px] font-black text-white">{house.rating.toFixed(1)}</span>
              <span className="flex items-center gap-0.5" aria-hidden="true">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Star key={i} className={`w-3.5 h-3.5 ${i < roundStars ? 'fill-[#E3CD9F] text-[#E3CD9F]' : 'text-white/35'}`} />
                ))}
              </span>
              <span className="text-[11px] font-bold text-white/80">({reviewsCount} تقييم)</span>
            </div>
          </div>

          {/* Hairline dividers, no boxes — the strip stays quiet over a photo. */}
          {amenities.length > 0 && (
            <div className="mt-3.5 flex items-start gap-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {amenities.map((a, i) => (
                <React.Fragment key={a.label}>
                  {i > 0 && <span aria-hidden="true" className="w-px h-8 bg-white/25 shrink-0 mt-0.5" />}
                  <span className="flex flex-col items-center gap-1 shrink-0">
                    <span className="text-white/90">{a.icon}</span>
                    <span className="text-[9.5px] font-bold text-white/90 whitespace-nowrap">{a.label}</span>
                  </span>
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
        )}

        {/* Dots, with a hint that retires the moment the reader moves a frame. */}
        {images.length > 1 && (
          <div className="absolute inset-x-0 bottom-4 flex items-center justify-center gap-2">
            {/* Drop shadows rather than a scrim: the dots and the hint have to
                survive a bright photograph now that the frames after the first
                carry no wash at all. */}
            {!interacted && (
              <span className="flex items-center gap-1 text-[9.5px] font-bold text-white/75 ml-2 drop-shadow-[0_1px_3px_rgba(0,0,0,0.65)]">
                <MoveHorizontal className="w-3 h-3" />
                اسحب للتنقل بين الصور
              </span>
            )}
            {images.map((_, i) => (
              <button
                key={i} type="button" aria-label={`الصورة ${i + 1}`}
                onClick={() => { tapFeedback(); setInteracted(true); go(i); }}
                className={`rounded-full transition-all duration-[250ms] ease-[cubic-bezier(0.33,1,0.68,1)] cursor-pointer drop-shadow-[0_1px_3px_rgba(0,0,0,0.55)] ${
                  i === index ? 'w-5 h-1.5 bg-[#E3CD9F]' : 'w-1.5 h-1.5 bg-white/70 hover:bg-white'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Thumbnails. Three fit the width; any further images scroll, so a
             gallery of eight is still fully reachable from here. ── */}
      {images.length > 1 && (
        <div className="flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {images.map((img, i) => (
            <button
              id={`detail-thumb-${i}`}
              key={img + i}
              type="button"
              onClick={() => { tapFeedback(); setInteracted(true); go(i); }}
              aria-label={`عرض الصورة ${i + 1}`}
              aria-current={i === index}
              className={`relative shrink-0 basis-[calc((100%-1.25rem)/3)] aspect-[16/10] rounded-2xl overflow-hidden border-2 transition-all duration-[250ms] ease-[cubic-bezier(0.33,1,0.68,1)] cursor-pointer ${
                i === index
                  ? 'border-[#C5A059] scale-[1.03] shadow-[0_8px_20px_rgba(184,148,78,0.3)]'
                  : 'border-transparent opacity-70 hover:opacity-100'
              }`}
            >
              <img src={img} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
