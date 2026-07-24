import React, { useEffect, useState } from 'react';

// Promo banners ported from the source app (same dimensions, colors and layout):
//  - SummerOfferCarousel: a 3-slide auto-rotating hero shown at the TOP.
//  - CountdownOfferBanner: a live-countdown offer shown at the BOTTOM.
// onCta fires when any call-to-action is pressed (e.g. scroll to the listings).

export function SummerOfferCarousel({ onCta }: { onCta?: () => void }) {
  const [activeSlide, setActiveSlide] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setActiveSlide((prev) => (prev + 1) % 3), 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative rounded-3xl overflow-hidden h-44 shadow-md bg-slate-900 group select-none">
      {activeSlide === 0 && (
        <div className="absolute inset-0 transition-all duration-700 ease-in-out">
          <img src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80" alt="Summer Offer 1" className="w-full h-full object-cover opacity-80" referrerPolicy="no-referrer" />
          <div className="absolute inset-0 bg-gradient-to-l from-black/60 via-black/30 to-transparent flex flex-col justify-center px-6 text-white text-right">
            <span className="text-[10px] text-[#C5A059] font-extrabold tracking-wider bg-[#0A2342]/70 self-start px-2 py-0.5 rounded-md mb-1.5">عرض خاص</span>
            <h2 className="text-base font-black leading-tight">عرض الصيف</h2>
            <p className="text-[11px] text-gray-200 font-bold mt-1">خصومات تصل إلى ٣٠٪ على بيوت الساحل ومطروح</p>
            <button onClick={onCta} className="mt-3 bg-[#5A5A40] hover:bg-[#4A4A3A] text-white text-[10px] font-black px-4 py-1.5 rounded-xl self-start shadow transition-all active:scale-95">احجز الآن</button>
          </div>
        </div>
      )}
      {activeSlide === 1 && (
        <div className="absolute inset-0 transition-all duration-700 ease-in-out">
          <img src="https://images.unsplash.com/photo-1438032005730-c779502df39b?auto=format&fit=crop&w=1200&q=80" alt="Retreat Houses" className="w-full h-full object-cover opacity-80" referrerPolicy="no-referrer" />
          <div className="absolute inset-0 bg-gradient-to-l from-black/60 via-black/30 to-transparent flex flex-col justify-center px-6 text-white text-right">
            <span className="text-[10px] text-amber-300 font-extrabold tracking-wider bg-rose-950/70 self-start px-2 py-0.5 rounded-md mb-1.5">حصري ومميز</span>
            <h2 className="text-base font-black leading-tight">خلوات العائلات والخدام</h2>
            <p className="text-[11px] text-gray-200 font-bold mt-1">أجواء روحية متكاملة لخدمتكم وكنيستكم</p>
            <button onClick={onCta} className="mt-3 bg-[#0A2342] hover:bg-slate-800 text-white text-[10px] font-black px-4 py-1.5 rounded-xl self-start shadow transition-all active:scale-95">اكتشف البيوت</button>
          </div>
        </div>
      )}
      {activeSlide === 2 && (
        <div className="absolute inset-0 transition-all duration-700 ease-in-out">
          <img src="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80" alt="Summer Offer 3" className="w-full h-full object-cover opacity-80" referrerPolicy="no-referrer" />
          <div className="absolute inset-0 bg-gradient-to-l from-black/60 via-black/30 to-transparent flex flex-col justify-center px-6 text-white text-right">
            <span className="text-[10px] text-[#C5A059] font-extrabold tracking-wider bg-[#5A5A40]/70 self-start px-2 py-0.5 rounded-md mb-1.5">محدود للغاية</span>
            <h2 className="text-base font-black leading-tight">خصومات الحجز المبكر ⏳</h2>
            <p className="text-[11px] text-gray-200 font-bold mt-1">وفر ٢٠٪ إضافية عند تأكيد حجزك للأسبوع القادم</p>
            <button onClick={onCta} className="mt-3 bg-[#C5A059] hover:bg-amber-600 text-[#0A2342] text-[10px] font-black px-4 py-1.5 rounded-xl self-start shadow transition-all active:scale-95">احجز اليوم</button>
          </div>
        </div>
      )}

      {/* Carousel Indicators */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10">
        {[0, 1, 2].map((i) => (
          <button key={i} onClick={() => setActiveSlide(i)} className={`w-1.5 h-1.5 rounded-full transition-all ${activeSlide === i ? 'bg-white w-3' : 'bg-white/40'}`} />
        ))}
      </div>
    </div>
  );
}

export function CountdownOfferBanner({ onCta }: { onCta?: () => void }) {
  const [timeLeft, setTimeLeft] = useState({ hours: 12, minutes: 45, seconds: 30 });
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { ...prev, minutes: prev.minutes - 1, seconds: 59 };
        if (prev.hours > 0) return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        return { hours: 12, minutes: 45, seconds: 30 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative rounded-3xl overflow-hidden h-32 bg-slate-950 text-white select-none shadow-md">
      <img src="https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80" alt="Limited offer background" className="w-full h-full absolute inset-0 object-cover opacity-30" referrerPolicy="no-referrer" />
      <div className="absolute inset-0 p-4 flex flex-col justify-between text-right">
        <div className="flex justify-between items-center">
          <span className="text-[8px] font-black bg-rose-600 text-white px-2 py-0.5 rounded-full animate-pulse">عرض لفترة محدودة</span>
          <span className="text-[10px] font-black text-amber-300">خصم ٢٠٪ على جميع الحجوزات</span>
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

          <button onClick={onCta} className="bg-[#C5A059] hover:bg-amber-600 text-[#0A2342] text-[10px] font-black px-4 py-2 rounded-xl shadow transition-all active:scale-95">احجز الآن</button>
        </div>
      </div>
    </div>
  );
}
