import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PlatformAnnouncement, RetreatHouse, User } from '../types';

interface AnnouncementCarouselProps {
  currentUser: User;
  announcements: PlatformAnnouncement[]; // already filtered to active
  houses: RetreatHouse[];
  onSelectHouse: (house: RetreatHouse) => void;
}

const ROTATE_MS = 6000;

export default function AnnouncementCarousel({ currentUser, announcements, houses, onSelectHouse }: AnnouncementCarouselProps) {
  const [index, setIndex] = useState(0);

  // The welcome message only appears when there's nothing else to show —
  // once an admin publishes an announcement, the carousel is announcements-only.
  const hasAnnouncements = announcements.length > 0;
  const slideCount = hasAnnouncements ? announcements.length : 1;

  const goNext = () => setIndex((i) => (i + 1) % slideCount);
  const goPrev = () => setIndex((i) => (i - 1 + slideCount) % slideCount);

  // Restart the auto-advance countdown whenever the slide changes, so a
  // manual click doesn't get immediately overridden by a pending timer.
  useEffect(() => {
    if (slideCount <= 1) return;
    const timer = setInterval(goNext, ROTATE_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideCount, index]);

  useEffect(() => {
    if (index >= slideCount) setIndex(0);
  }, [slideCount, index]);

  const activeAnnouncement = hasAnnouncements ? announcements[index] : null;
  const linkedHouse = activeAnnouncement?.linkedHouseId
    ? houses.find((h) => h.id === activeAnnouncement.linkedHouseId)
    : undefined;

  return (
    <div
      className={`relative h-48 rounded-3xl shadow-sm overflow-hidden text-white ${linkedHouse ? 'cursor-pointer' : ''} ${
        activeAnnouncement?.imageUrl ? '' : 'bg-gradient-to-br from-[#5A5A40] to-[#3D3D2B]'
      }`}
      onClick={() => linkedHouse && onSelectHouse(linkedHouse)}
    >
      {activeAnnouncement?.imageUrl && (
        <img
          src={activeAnnouncement.imageUrl}
          alt=""
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
      {/* Gradient overlay for text legibility over any background image */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />

      <div className={`relative h-full flex flex-col justify-end p-4 gap-1.5 ${slideCount > 1 ? 'pr-9 pl-9' : ''}`}>
        {activeAnnouncement ? (
          <>
            <span className="text-[10px] text-[#EBEBE0] font-bold tracking-wider">📢 إعلان</span>
            <h2 className="text-base font-black text-white leading-snug line-clamp-2">{activeAnnouncement.message}</h2>
            {linkedHouse && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onSelectHouse(linkedHouse); }}
                className="mt-1 self-start bg-[#C5A059] hover:bg-[#B7924A] text-[#0A2342] text-xs font-extrabold px-4 py-1.5 rounded-full shadow-sm transition-colors"
              >
                عرض {linkedHouse.name} ←
              </button>
            )}
          </>
        ) : (
          <>
            <span className="text-[10px] text-[#EBEBE0] font-bold tracking-wider">أهلاً بك يا {currentUser.name} 🌾</span>
            <h2 className="text-base font-black text-white leading-snug">ابحث عن مكان خلوتك ومؤتمراتك القبطية بمصر</h2>
            <p className="text-[11px] text-[#DEDECB] font-medium leading-relaxed">مئات بيوت المؤتمرات والفنادق المسيحية المناسبة لكنائسنا وخدماتنا.</p>
          </>
        )}
      </div>

      {slideCount > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            className="absolute top-1/2 -translate-y-1/2 right-2.5 bg-white/20 hover:bg-white/30 rounded-full p-1.5 transition-colors"
            title="السابق"
          >
            <ChevronRight className="w-4 h-4 text-white" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            className="absolute top-1/2 -translate-y-1/2 left-2.5 bg-white/20 hover:bg-white/30 rounded-full p-1.5 transition-colors"
            title="التالي"
          >
            <ChevronLeft className="w-4 h-4 text-white" />
          </button>

          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
            {Array.from({ length: slideCount }).map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${i === index ? 'w-5 bg-[#C5A059]' : 'w-1.5 bg-white/40'}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
