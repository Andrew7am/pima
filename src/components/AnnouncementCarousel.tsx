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
      className={`bg-[#5A5A40] text-white p-3.5 px-4 rounded-2xl shadow-sm space-y-0.5 relative overflow-hidden ${linkedHouse ? 'cursor-pointer' : ''}`}
      onClick={() => linkedHouse && onSelectHouse(linkedHouse)}
    >
      <div className="absolute top-0 left-0 w-20 h-20 bg-[#BCBC9D]/10 rounded-full blur-xl pointer-events-none" />

      <div className={slideCount > 1 ? 'pr-7 pl-7' : ''}>
        {activeAnnouncement ? (
          <>
            {activeAnnouncement.imageUrl && (
              <img
                src={activeAnnouncement.imageUrl}
                alt=""
                referrerPolicy="no-referrer"
                className="absolute inset-0 w-full h-full object-cover opacity-25"
              />
            )}
            <span className="text-[9px] text-[#EBEBE0] font-bold tracking-wider relative">📢 إعلان</span>
            <h2 className="text-xs font-black text-[#F5F5F0] relative leading-relaxed">{activeAnnouncement.message}</h2>
            {linkedHouse && (
              <p className="text-[9px] text-[#DEDECB] font-medium relative">{linkedHouse.name} — اضغط لعرض التفاصيل ←</p>
            )}
          </>
        ) : (
          <>
            <span className="text-[9px] text-[#EBEBE0] font-bold tracking-wider">أهلاً بك يا {currentUser.name} 🌾</span>
            <h2 className="text-xs font-black text-[#F5F5F0]">ابحث عن مكان خلوتك ومؤتمراتك القبطية بمصر</h2>
            <p className="text-[9px] text-[#DEDECB] font-medium">مئات بيوت المؤتمرات والفنادق المسيحية المناسبة لكنائسنا وخدماتنا.</p>
          </>
        )}
      </div>

      {slideCount > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            className="absolute top-1/2 -translate-y-1/2 right-1.5 bg-white/15 hover:bg-white/25 rounded-full p-1 transition-colors"
            title="السابق"
          >
            <ChevronRight className="w-3.5 h-3.5 text-white" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            className="absolute top-1/2 -translate-y-1/2 left-1.5 bg-white/15 hover:bg-white/25 rounded-full p-1 transition-colors"
            title="التالي"
          >
            <ChevronLeft className="w-3.5 h-3.5 text-white" />
          </button>

          <div className="flex items-center gap-1 pt-1.5 relative">
            {Array.from({ length: slideCount }).map((_, i) => (
              <span
                key={i}
                className={`h-1 rounded-full transition-all ${i === index ? 'w-4 bg-[#C5A059]' : 'w-1 bg-white/30'}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
