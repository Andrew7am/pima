import React, { useEffect, useMemo, useState } from 'react';
import { RetreatHouse } from '../types';
import {
  ChevronRight, Check, Lock, Stamp as StampIcon, MapPin, Church,
  CalendarDays, Map as MapIcon, Sparkles,
} from 'lucide-react';
import { arabicNumber, arabicDate } from '../lib/arabic';
import { PassportStamp as StampArt, PassportBook, GiftBox, markForId } from './rewards/RewardIcons';
import { tapFeedback } from '../lib/haptics';

export interface PassportStamp {
  houseId: string;
  houseName: string;
  /** First stay's date — the day the stamp was earned. */
  date: string;
}

interface PassportScreenProps {
  stamps: PassportStamp[];
  target: number;
  tierName: string;
  completedBookings: number;
  houses?: RetreatHouse[];
  onBack: () => void;
}

// Per-stamp rotation, so no two sit identically on the page. The mark itself
// comes from markForId in the icon set — same id, same architecture, always.
const hashOf = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

// Egypt's bounding box, for projecting real house coordinates onto the
// decorative discovery panel. Exploration, not navigation: no tiles, no
// panning — just where your journey has reached.
const EGYPT = { latMin: 22, latMax: 31.8, lngMin: 24.5, lngMax: 35.2 };

const SEEN_KEY = 'pima_passport_seen_stamps';

export default function PassportScreen({ stamps, target, tierName, completedBookings, houses = [], onBack }: PassportScreenProps) {
  const remaining = Math.max(0, target - stamps.length);
  const pct = Math.min(100, Math.round((stamps.length / target) * 100));

  const houseById = useMemo(() => new Map(houses.map((h) => [h.id, h])), [houses]);
  const governorates = useMemo(
    () => new Set(stamps.map((s) => houseById.get(s.houseId)?.governorate).filter(Boolean)).size,
    [stamps, houseById],
  );
  const pins = useMemo(() => stamps
    .map((s) => houseById.get(s.houseId))
    .filter((h): h is RetreatHouse => !!h && Number.isFinite(h.lat) && Number.isFinite(h.lng))
    .map((h) => ({
      id: h.id, name: h.name,
      x: ((h.lng - EGYPT.lngMin) / (EGYPT.lngMax - EGYPT.lngMin)) * 100,
      y: ((EGYPT.latMax - h.lat) / (EGYPT.latMax - EGYPT.latMin)) * 100,
    }))
    .filter((p) => p.x >= 0 && p.x <= 100 && p.y >= 0 && p.y <= 100),
  [stamps, houseById]);

  // The ink-stamp moment plays ONCE per newly earned stamp: the count last
  // seen lives in localStorage, and only a stamp beyond it animates in.
  const [seenCount] = useState(() => {
    const raw = Number(localStorage.getItem(SEEN_KEY) ?? '0');
    return Number.isFinite(raw) ? raw : 0;
  });
  const hasNew = stamps.length > seenCount;
  const [toast, setToast] = useState(false);
  useEffect(() => {
    if (!hasNew) return;
    tapFeedback();
    setToast(true);
    const t = setTimeout(() => setToast(false), 3000);
    localStorage.setItem(SEEN_KEY, String(stamps.length));
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = [
    { icon: StampIcon,     value: stamps.length,     label: 'أختام تم جمعها' },
    { icon: MapPin,        value: stamps.length,     label: 'أماكن مكتشفة' },
    { icon: CalendarDays, value: completedBookings, label: 'حجوزات مكتملة' },
    { icon: MapIcon,       value: governorates,      label: 'محافظات مكتشفة' },
  ];

  return (
    <div className="space-y-4 text-right animate-in fade-in duration-200">

      {/* Header */}
      <div className="flex items-center gap-2 pb-1 border-b border-[#EDE7DA]">
        <button onClick={onBack} aria-label="رجوع"
          className="w-10 h-10 rounded-xl border border-[#EDE7DA] bg-white hover:bg-[#F1ECE0] text-[#4A4A3A] transition-colors flex items-center justify-center cursor-pointer pima-press">
          <ChevronRight className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-sm font-black text-[#0A2342]">جواز بيما</h2>
          <p className="text-[10px] text-[#8A8A70]">اكتشف أماكن جديدة واجمع الأختام</p>
        </div>
      </div>

      {/* New-stamp toast — plays once per newly earned stamp. */}
      {toast && (
        <div className="flex items-center justify-center gap-1.5 bg-[#0A2342] text-white rounded-2xl px-4 py-2.5 shadow-[0_8px_24px_rgba(10,35,66,0.35)] animate-in fade-in slide-in-from-top-2 duration-300">
          <Sparkles className="w-3.5 h-3.5 text-[#C5A059]" />
          <span className="text-[11px] font-black">تمت إضافة ختم جديد إلى جواز بيما</span>
        </div>
      )}

      {/* ── Open passport: navy cover right (RTL start), info page left ── */}
      <div className="rounded-3xl bg-gradient-to-b from-[#F4EEDF] to-[#EDE4CF] p-3 shadow-[0_8px_24px_rgba(0,0,0,0.08),0_2px_6px_rgba(0,0,0,0.03)]">
        <div className="grid grid-cols-2 gap-0 rounded-2xl overflow-hidden shadow-[0_10px_28px_rgba(10,35,66,0.28)]">

          {/* Cover — leather navy, gold foil. Layered radial washes stand in
              for grain; no external texture asset needed. */}
          <div className="relative bg-[#12264A] p-4 flex flex-col items-center justify-center gap-2 min-h-[210px]"
            style={{ backgroundImage: 'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.07), transparent 55%), radial-gradient(circle at 75% 85%, rgba(0,0,0,0.35), transparent 60%)' }}>
            <span aria-hidden="true" className="absolute inset-2 rounded-xl border border-[#C5A059]/35" />
            <span className="text-[15px] font-black tracking-[0.18em] text-[#C5A059]" dir="ltr">PIMA</span>
            <span className="text-[8px] font-black tracking-[0.3em] text-[#C5A059]/80 -mt-1.5" dir="ltr">PASSPORT</span>
            {/* The Pima mark in gold foil: a house carrying a cross. */}
            <span className="w-12 h-12 rounded-full border-2 border-[#C5A059]/70 flex items-center justify-center my-1">
              <svg viewBox="0 0 48 48" className="w-7 h-7" fill="none" aria-hidden="true">
                <g stroke="#C5A059" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round">
                  <path d="M12 27 L24 16 L36 27 L36 39 L12 39 Z" />
                  <path d="M24 8 V16 M20 11.5 H28" />
                </g>
              </svg>
            </span>
            <span className="text-[10px] font-black text-[#C5A059]">جواز بيما</span>
            <span aria-hidden="true" className="w-8 h-1 rounded-full bg-[#C5A059]/50 mt-1" />
          </div>

          {/* Info page — cream paper. */}
          <div className="relative bg-[#FBF7EC] p-3.5 flex flex-col justify-center gap-2"
            style={{ backgroundImage: 'radial-gradient(circle at 80% 15%, rgba(197,160,89,0.08), transparent 50%)' }}>
            <div className="flex items-center gap-1 justify-start">
              <span className="text-[10px] font-black text-[#8A6A22]">أختامك المكتشفة</span>
              <Sparkles className="w-3 h-3 text-[#C5A059]" />
            </div>
            <span className="text-[26px] font-black text-[#0A2342] leading-none" dir="ltr">
              {arabicNumber(stamps.length)} / {arabicNumber(target)}
            </span>
            <span className="text-[9px] font-bold text-[#8A8A70]">ختم تم جمعها</span>
            <div className="flex items-center gap-1.5">
              <div className="flex-1 bg-[#EBE2CC] rounded-full h-1.5 overflow-hidden">
                <div className="bg-gradient-to-l from-[#C9A96A] to-[#B8944E] h-full rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-[9px] font-black text-[#8A6A22]" dir="ltr">٪{arabicNumber(pct)}</span>
            </div>
            {remaining > 0 ? (
              <div className="mt-1 rounded-xl border border-[#EBD9B4] bg-[#FDF9EF] px-2.5 py-2 flex items-center gap-1.5">
                <GiftBox size={18} className="shrink-0" />
                <span className="text-[8.5px] font-bold text-[#4A4A3A] leading-snug">
                  تبقى لك <span className="font-black text-[#B8944E]">{arabicNumber(remaining)} {remaining === 1 ? 'ختم' : remaining === 2 ? 'ختمان' : remaining <= 10 ? 'أختام' : 'ختمًا'}</span> لتحصل على مكافأة خاصة
                </span>
              </div>
            ) : (
              <div className="mt-1 rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-2 flex items-center gap-1.5">
                <GiftBox size={18} className="shrink-0" />
                <span className="text-[8.5px] font-black text-emerald-800">اكتمل جوازك — مكافأتك الخاصة في الطريق من فريق بيما 🎁</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Stamps grid: 15 slots, collected in gold ink, the rest a mystery ── */}
      <div className="space-y-2">
        <h3 className="text-[11.5px] font-black text-[#0A2342] px-1 flex items-center gap-1.5">
          <StampIcon className="w-4 h-4 text-[#C5A059]" />
          أختام الأماكن
        </h3>
        <div className="bg-white rounded-3xl border border-[#EDE7DA] p-3 shadow-[0_8px_24px_rgba(0,0,0,0.08),0_2px_6px_rgba(0,0,0,0.03)]">
          <div className="grid grid-cols-5 gap-x-1.5 gap-y-3">
            {Array.from({ length: target }).map((_, i) => {
              const stamp = stamps[i];
              if (!stamp) {
                // Locked: never a future house's name — mystery is the point.
                return (
                  <div key={`locked-${i}`} className="flex flex-col items-center gap-1 text-center">
                    <span className="relative w-[52px] h-[52px] flex items-center justify-center">
                      <StampArt mark="dome" size={52} muted className="opacity-45 blur-[1.2px]" />
                      <Lock className="absolute w-3.5 h-3.5 text-[#B3AC9C]" />
                    </span>
                    <span className="text-[7px] font-black text-[#B5AF98] leading-tight">ختم غير مكتشف</span>
                    <span className="text-[6.5px] font-bold text-[#C9C2B0] leading-tight">اكتشف مكانًا جديدًا</span>
                  </div>
                );
              }
              const tilt = (hashOf(stamp.houseId) % 11) - 5; // -5°..+5° — hand-stamped, not printed
              const isNewest = hasNew && i === stamps.length - 1;
              return (
                <div key={stamp.houseId} className="flex flex-col items-center gap-1 text-center">
                  <span
                    className={`relative flex items-center justify-center ${isNewest ? 'pima-stamp-in' : ''}`}
                    style={{ transform: `rotate(${tilt}deg)` }}
                  >
                    <StampArt mark={markForId(stamp.houseId)} size={52} />
                    <span className="absolute -top-0.5 -left-0.5 w-4 h-4 rounded-full bg-emerald-500 ring-2 ring-white flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-white" />
                    </span>
                  </span>
                  <span className="text-[7px] font-black text-[#2D2D24] leading-tight line-clamp-2">{stamp.houseName}</span>
                  <span className="text-[6.5px] font-bold text-[#8A8A70] leading-none">{arabicDate(stamp.date)}</span>
                </div>
              );
            })}
          </div>

          <p className="mt-3 flex items-center justify-center gap-1.5 text-[9px] font-bold text-[#8A8A70] bg-[#FBF9F4] border border-[#EDE7DA] rounded-xl py-2 px-3">
            <Sparkles className="w-3 h-3 text-[#C5A059] shrink-0" />
            كل زيارة جديدة تضيف ختمًا جديدًا إلى جوازك وتقربك من المكافأة القادمة
          </p>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="space-y-2">
        <h3 className="text-[11.5px] font-black text-[#0A2342] px-1">إحصائيات جوازك</h3>
        <div className="grid grid-cols-4 gap-2">
          {stats.map((s) => (
            <div key={s.label} className="bg-white rounded-2xl border border-[#EDE7DA] p-2.5 flex flex-col items-center gap-1 text-center shadow-[0_8px_24px_rgba(0,0,0,0.08),0_2px_6px_rgba(0,0,0,0.03)]">
              <span className="w-8 h-8 rounded-full bg-[#F6F0E2] flex items-center justify-center">
                <s.icon className="w-4 h-4 text-[#B8944E]" />
              </span>
              <span className="text-[15px] font-black text-[#0A2342] leading-none">{arabicNumber(s.value)}</span>
              <span className="text-[7.5px] font-bold text-[#8A8A70] leading-tight">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Discovery panel — where the journey has reached. Real coordinates,
             no tiles, no navigation; undiscovered places simply are not there. ── */}
      <div className="space-y-2">
        <h3 className="text-[11.5px] font-black text-[#0A2342] px-1 flex items-center gap-1.5">
          <MapIcon className="w-4 h-4 text-[#C5A059]" />
          اكتشافاتك في مصر
        </h3>
        <div className="bg-gradient-to-b from-[#F2EBDC] to-[#EAE0CB] rounded-3xl border border-[#E3DCCB] p-3 shadow-[0_8px_24px_rgba(0,0,0,0.08),0_2px_6px_rgba(0,0,0,0.03)]">
          <div className="relative w-full rounded-2xl bg-[#EFE7D3] overflow-hidden" style={{ aspectRatio: '16/10', backgroundImage: 'radial-gradient(rgba(184,148,78,0.14) 1px, transparent 1px)', backgroundSize: '18px 18px' }}>
            {pins.length === 0 ? (
              <span className="absolute inset-0 flex items-center justify-center text-[9.5px] font-bold text-[#A79E85] px-6 text-center">
                أول إقامة تكتمل تضع أول علامة على خريطتك
              </span>
            ) : pins.map((p) => (
              <span key={p.id} title={p.name}
                className="absolute -translate-x-1/2 -translate-y-full"
                style={{ left: `${p.x}%`, top: `${p.y}%` }}>
                <MapPin className="w-5 h-5 text-[#B8944E] fill-[#E9D5A3] drop-shadow-[0_2px_4px_rgba(184,148,78,0.5)]" />
              </span>
            ))}
            <span className="absolute bottom-2 right-2 flex items-center gap-1 bg-white/85 backdrop-blur-sm rounded-full px-2 py-1 text-[7.5px] font-black text-[#4A4A3A]">
              <MapPin className="w-2.5 h-2.5 text-[#B8944E]" />
              أماكن تم اكتشافها
            </span>
          </div>
          <p className="mt-2 text-[9px] font-bold text-[#8A8A70] text-center flex items-center justify-center gap-1">
            <Sparkles className="w-3 h-3 text-[#C5A059]" />
            استمر في الاستكشاف لفتح المزيد من الأماكن الجميلة
          </p>
        </div>
      </div>
    </div>
  );
}
