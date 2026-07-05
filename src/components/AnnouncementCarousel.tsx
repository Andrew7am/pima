import React, { useEffect, useState } from 'react';
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

  // Slide 0 is always the default welcome message, so the banner never looks
  // empty before an admin has published any announcements.
  const slideCount = 1 + announcements.length;

  useEffect(() => {
    if (slideCount <= 1) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % slideCount), ROTATE_MS);
    return () => clearInterval(timer);
  }, [slideCount]);

  useEffect(() => {
    if (index >= slideCount) setIndex(0);
  }, [slideCount, index]);

  const activeAnnouncement = index > 0 ? announcements[index - 1] : null;
  const linkedHouse = activeAnnouncement?.linkedHouseId
    ? houses.find((h) => h.id === activeAnnouncement.linkedHouseId)
    : undefined;

  return (
    <div
      className={`bg-[#5A5A40] text-white p-3.5 px-4 rounded-2xl shadow-sm space-y-0.5 relative overflow-hidden ${linkedHouse ? 'cursor-pointer' : ''}`}
      onClick={() => linkedHouse && onSelectHouse(linkedHouse)}
    >
      <div className="absolute top-0 left-0 w-20 h-20 bg-[#BCBC9D]/10 rounded-full blur-xl pointer-events-none" />

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

      {slideCount > 1 && (
        <div className="flex items-center gap-1 pt-1.5 relative">
          {Array.from({ length: slideCount }).map((_, i) => (
            <span
              key={i}
              className={`h-1 rounded-full transition-all ${i === index ? 'w-4 bg-[#C5A059]' : 'w-1 bg-white/30'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
