import React, { useCallback, useRef, useState } from 'react';
import { RetreatHouse } from '../../types';
import { ArrowRight, ChevronLeft, ChevronRight, Heart, MapPin, Share2, Star, MoveHorizontal } from 'lucide-react';
import { tapFeedback } from '../../lib/haptics';

interface HouseHeroProps {
  house: RetreatHouse;
  reviewsCount: number;
  isFavorited: boolean;
  isCopied: boolean;
  onBack: () => void;
  onShare: () => void;
  onToggleFavorite: (houseId: string) => void;
}

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
const IconChurch = () => (
  <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2.2v4.4M10 4.4h4" />
    <path d="M12 6.6 5.5 11.4V21h13v-9.6L12 6.6Z" />
    <path d="M10 21v-4.2a2 2 0 0 1 4 0V21" />
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
  house, reviewsCount, isFavorited, isCopied, onBack, onShare, onToggleFavorite,
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

  // No autoplay. The frame changes only when someone asks for it — by swipe,
  // arrow, dot or thumbnail. A gallery that moves on its own takes the photo
  // away mid-look and moves the caption while it is being read.

  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < SWIPE_THRESHOLD) return;
    // RTL: dragging rightwards turns the page forward, as in an Arabic book.
    step(dx > 0 ? 1 : -1);
  };

  // Headline facts, each read off the record and simply absent when untrue —
  // an empty slot is better than a claim the house cannot honour.
  const amenities: { icon: React.ReactNode; label: string }[] = [];
  if (house.bedsCount > 0) amenities.push({ icon: <IconGuests />, label: `حتى ${house.bedsCount} فرد` });
  if (house.roomsCount > 0) amenities.push({ icon: <IconBed />, label: `${house.roomsCount} غرفة` });
  if (house.services?.some((s) => s.includes('كنيسة'))) amenities.push({ icon: <IconChurch />, label: 'كنيسة' });
  if (house.services?.includes('حمام سباحة')) amenities.push({ icon: <IconPool />, label: 'مسبح' });
  if (house.conferenceHalls?.length) amenities.push({ icon: <IconHall />, label: 'قاعة اجتماعات' });
  if (house.menu?.isIncluded) amenities.push({ icon: <IconMeals />, label: 'إقامة كاملة' });

  // The captions belong to the opening frame. Everything after it is a plain
  // photograph — no wash, no badge, no text — so the gallery reads as a gallery.
  const showOverlay = index === 0;
  const roundStars = Math.round(house.rating);
  const glassBtn = 'w-9 h-9 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center transition-colors hover:bg-white/30 cursor-pointer pima-press';

  return (
    // Full bleed: the app's main element pads its children by 16px (24px from
    // sm up), and the hero has to reach the edges of the screen through it.
    <div className="-mx-4 sm:-mx-6 -mt-4 sm:-mt-6 mb-4">
      <div
        className="relative overflow-hidden rounded-b-[32px] bg-slate-900 select-none h-[56dvh] min-h-[430px] max-h-[600px] shadow-[0_16px_40px_-12px_rgba(45,45,36,0.35)]"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Frames cross-fade; the waiting ones sit slightly larger so they
            settle rather than snap into place. */}
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

        {/* One wash, up from the floor of the frame, carrying the thumbnails
            and — on the first frame only — the text above them. */}
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black/80 via-black/45 to-transparent" />

        {/* Governorate on the reading side; the page's own controls opposite. */}
        {showOverlay && (
          <span className="absolute top-4 left-4 flex items-center gap-1.5 bg-black/35 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-[11px] font-black">
            <MapPin className="w-3.5 h-3.5" />
            {house.governorate}
          </span>
        )}

        {/* Controls on the right. Back is the outermost of the three, so the
            thumb reaches it first on the side it is held. */}
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <button
            id="detail-back-btn"
            onClick={() => { tapFeedback(); onBack(); }}
            aria-label="رجوع"
            className={`${glassBtn} text-white`}
          >
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            id={`share-detail-${house.id}`}
            onClick={() => { tapFeedback(); onShare(); }}
            aria-label={isCopied ? 'تم نسخ الرابط' : 'مشاركة'}
            className={`${glassBtn} ${isCopied ? 'text-emerald-300' : 'text-white'}`}
          >
            <Share2 className="w-4 h-4" />
          </button>
          <button
            id={`toggle-fav-detail-${house.id}`}
            onClick={() => { tapFeedback(); onToggleFavorite(house.id); }}
            aria-label={isFavorited ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
            aria-pressed={isFavorited}
            className={glassBtn}
          >
            <Heart className={`w-4 h-4 transition-colors ${isFavorited ? 'fill-rose-400 text-rose-400' : 'text-white'}`} />
          </button>
        </div>

        {images.length > 1 && (
          <>
            <button
              type="button" onClick={() => step(1)} aria-label="الصورة التالية"
              className="absolute top-[38%] right-3 w-9 h-9 rounded-full bg-black/30 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/50 transition-colors cursor-pointer pima-press"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <button
              type="button" onClick={() => step(-1)} aria-label="الصورة السابقة"
              className="absolute top-[38%] left-3 w-9 h-9 rounded-full bg-black/30 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/50 transition-colors cursor-pointer pima-press"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          </>
        )}

        {/* Bottom stack. Pinned by its bottom edge, so when the caption block
            disappears on later frames the dots and thumbnails stay put instead
            of sliding down the image. */}
        <div className="absolute inset-x-0 bottom-0 px-4 pb-4">
          {showOverlay && (
            <>
              {/* The house name keeps the reading side — it is the longest
                  Arabic run on the screen, and left-aligning it would break
                  the eye's line down the page. */}
              <h1 className="text-[21px] leading-tight font-black text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)] max-w-[82%]">
                {house.name}
              </h1>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="text-[15px] font-black text-white">{house.rating.toFixed(1)}</span>
                <span className="flex items-center gap-0.5" aria-hidden="true">
                  {[0, 1, 2, 3, 4].map((i) => (
                    // Lighter than the brand gold but still saturated — going
                    // pale drains the colour out of it and it stops reading
                    // as gold at all.
                    <Star key={i} className={`w-4 h-4 ${i < roundStars ? 'fill-[#F0C560] text-[#F0C560]' : 'text-white/35'}`} />
                  ))}
                </span>
                <span className="text-[11.5px] font-bold text-white/85">({reviewsCount} تقييم)</span>
              </div>

              {/* Amenities: dividers only, no panel. The wash below already
                  carries the text, so a second surface on top of it was one
                  layer more than the photograph needed. */}
              {amenities.length > 0 && (
                <div className="mt-3 flex items-stretch overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {amenities.map((a, i) => (
                    <React.Fragment key={a.label}>
                      {i > 0 && <span aria-hidden="true" className="w-px self-stretch bg-white/30 shrink-0 my-0.5" />}
                      <span className="flex-1 min-w-[68px] flex flex-col items-center gap-1 px-1.5">
                        {/* Shadows do the work the panel used to: the strip has
                            to stay readable straight over a photograph. */}
                        <span className="text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.7)]">{a.icon}</span>
                        <span className="text-[9.5px] font-bold text-white whitespace-nowrap drop-shadow-[0_1px_4px_rgba(0,0,0,0.7)]">{a.label}</span>
                      </span>
                    </React.Fragment>
                  ))}
                </div>
              )}
            </>
          )}

          {images.length > 1 && (
            <>
              <div className="mt-3 flex items-center justify-center gap-1.5">
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
                      i === index ? 'w-6 h-1.5 bg-[#E3CD9F]' : 'w-1.5 h-1.5 bg-white/75 hover:bg-white'
                    }`}
                  />
                ))}
              </div>

              {/* Four across the width; a longer gallery scrolls rather than
                  shrinking the tiles into stamps. */}
              <div className="mt-2.5 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {images.map((img, i) => (
                  <button
                    id={`detail-thumb-${i}`}
                    key={img + i}
                    type="button"
                    onClick={() => { tapFeedback(); setInteracted(true); go(i); }}
                    aria-label={`عرض الصورة ${i + 1}`}
                    aria-current={i === index}
                    className={`shrink-0 basis-[calc((100%-1.5rem)/4)] aspect-[16/11] rounded-xl overflow-hidden border-2 transition-all duration-[250ms] ease-[cubic-bezier(0.33,1,0.68,1)] cursor-pointer ${
                      i === index
                        ? 'border-[#E3CD9F] shadow-[0_4px_14px_rgba(0,0,0,0.45)]'
                        : 'border-white/25 opacity-80 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
