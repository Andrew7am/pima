// TEMPORARY design-review page — mirrors the house card from UserDashboard so
// the layout can be checked without booting the whole app (which needs Supabase
// credentials). Delete this file and preview-card.html once the card is signed
// off. Served at /preview-card.html by the dev server.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Star, MapPin, Heart, ArrowLeftRight, Users, BedDouble, ArrowLeft, Wifi, SquareParking, Scale, X, Flame } from 'lucide-react';
import { INITIAL_HOUSES, SUITABILITY_MAP } from './mockData';
import { computeStayPrice } from './lib/pricing';
import type { RetreatHouse } from './types';
import './index.css';

function bedsLabel(n: number): string {
  if (n === 1) return 'سرير واحد';
  if (n === 2) return 'سريرين';
  if (n >= 3 && n <= 10) return `${n} أسرّة`;
  return `${n} سرير`;
}

function Preview() {
  // Deliberately mixed: conference houses plus student/staff listings, so the
  // monthly-rent card variant and the "prices aren't comparable" path both show.
  const houses = INITIAL_HOUSES.slice(0, 8);
  const [favorites, setFavorites] = useState<string[]>([houses[0]?.id]);
  const [comparedHouseIds, setComparedHouseIds] = useState<string[]>([]);
  const [showComparisonModal, setShowComparisonModal] = useState(false);
  const [availability, setAvailability] = useState<Record<string, number> | null>(null);
  const [partySize, setPartySize] = useState(0);
  const [stayNights, setStayNights] = useState(0);
  const filterCheckIn = stayNights ? '2026-08-10' : '';
  const filterCheckOut = stayNights ? `2026-08-${String(10 + stayNights).padStart(2, '0')}` : '';
  const onSelectHouse = (_h: RetreatHouse) => undefined;

  const onToggleFavorite = (id: string) =>
    setFavorites((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));
  const handleToggleCompare = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setComparedHouseIds((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  };
  const currentUser = { favorites } as { favorites: string[] };

  // Stand-ins for the migration-086 RPC and the user's own booking history, so
  // the two new badges can be seen without a live Supabase connection.
  const mostBookedIds = new Set([houses[0]?.id, houses[2]?.id].filter(Boolean));
  const bookedBeforeIds = new Set([houses[1]?.id].filter(Boolean));
  const landmarkFor = (h: RetreatHouse, i: number) =>
    h.nearbyLandmark ?? (i === 0 ? '12 كم من المنتزه' : i === 1 ? '15 كم من سيدي بشر' : undefined);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1C1C16] via-[#232319] to-[#141410] text-[#EDEBE3] p-3 text-right" style={{ fontFamily: 'system-ui, sans-serif' }}>
      <div className="mb-3 flex flex-wrap gap-1.5 text-[10px] font-bold">
        <button
          onClick={() => {
            // Mixed occupancy on purpose: near-empty, half, and nearly full.
            setAvailability(availability ? null : Object.fromEntries(houses.map((h, i) => [h.id, Math.round(h.bedsCount * [0.95, 0.5, 0.2, 0.6][i % 4])])));
            setStayNights(stayNights ? 0 : 3);
          }}
          className={`border rounded-xl px-3 py-1.5 ${stayNights ? 'bg-[#464E3D] text-white border-[#464E3D]' : 'bg-white border-[#3C3C2E]'}`}
        >
          {stayNights ? 'إلغاء التواريخ' : 'حدد تواريخ (٣ ليالي)'}
        </button>
        {[0, 5, 45, 200].map((n) => (
          <button
            key={n}
            onClick={() => setPartySize(n)}
            className={`border rounded-xl px-3 py-1.5 ${partySize === n ? 'bg-[#464E3D] text-white border-[#464E3D]' : 'bg-white border-[#3C3C2E]'}`}
          >
            {n === 0 ? 'بدون عدد' : `${n} فرد`}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {houses.map((house, houseIndex) => (
          <div
            id={`house-card-${house.id}`}
            key={house.id}
            className="relative bg-[#2A2A20] rounded-3xl border border-[#3C3C2E] shadow-sm overflow-hidden hover:shadow-md transition-all duration-300 cursor-pointer group"
          >
            <div className="absolute inset-0 overflow-hidden">
              <img
                referrerPolicy="no-referrer"
                src={house.images[0]}
                alt={house.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/25" />
            </div>

            <div className="absolute top-3 left-3 flex items-center gap-1.5">
              <span className="bg-white/95 backdrop-blur-sm text-[#4A4A3A] text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow">
                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                <span>{house.rating.toFixed(1)}</span>
              </span>
              {mostBookedIds.has(house.id) && (
                <span className="bg-rose-700/90 backdrop-blur-sm text-white text-[9px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1 shadow">
                  <Flame className="w-3 h-3" />
                  الأكثر حجزًا
                </span>
              )}
            </div>

            <div className="absolute bottom-3 left-3 flex items-center gap-1.5 max-w-[47%]">
              <span className="bg-[#5A5A40]/90 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shrink-0">
                <MapPin className="w-3 h-3" />
                {house.governorate}
              </span>
              {landmarkFor(house, houseIndex) && (
                <span className="bg-black/45 backdrop-blur-sm text-white text-[9px] font-bold px-2 py-1 rounded-full truncate min-w-0">
                  {landmarkFor(house, houseIndex)}
                </span>
              )}
            </div>

            <div className="absolute top-2.5 right-3 flex items-center gap-1.5">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onToggleFavorite(house.id); }}
                className="bg-white/95 hover:bg-white text-rose-500 hover:text-rose-600 p-1.5 rounded-full flex items-center justify-center shadow transition-all duration-200 cursor-pointer"
              >
                <Heart className={`w-3.5 h-3.5 ${currentUser?.favorites?.includes(house.id) ? 'fill-rose-500 text-rose-500' : 'text-slate-400'}`} />
              </button>
              <button
                type="button"
                onClick={(e) => handleToggleCompare(house.id, e)}
                className={`p-1.5 rounded-full flex items-center justify-center shadow transition-all duration-200 cursor-pointer ${
                  comparedHouseIds.includes(house.id)
                    ? 'bg-amber-600 text-white hover:bg-amber-700'
                    : 'bg-white/95 text-slate-400 hover:text-[#5A5A40] hover:bg-white'
                }`}
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="absolute top-11 left-3 flex flex-col gap-1 items-start">
              {availability !== null && (
                <span className="bg-emerald-600/95 backdrop-blur-sm text-white text-[8.5px] font-extrabold px-2 py-0.5 rounded-full shadow-sm">
                  ✓ متاح في تواريخك
                </span>
              )}
              {bookedBeforeIds.has(house.id) && (
                <span className="bg-[#0A2342]/90 backdrop-blur-sm text-[#C5A059] text-[8.5px] font-extrabold px-2 py-0.5 rounded-full shadow-sm">
                  ⭐ حجزتم هنا قبل كده
                </span>
              )}
              {house.propertyType === 'student' && (
                <span className={`text-[8.5px] font-extrabold px-2 py-0.5 rounded-full shadow-sm text-white ${house.studentHousingGender === 'girls' ? 'bg-[#9C4B64]' : 'bg-[#4B6B9C]'}`}>
                  {house.studentHousingGender === 'girls' ? 'سكن طالبات ♀' : 'سكن طلاب ♂'}
                </span>
              )}
              {house.propertyType === 'staff' && (
                <span className="bg-[#4B7C6B] text-white text-[8.5px] font-extrabold px-2 py-0.5 rounded-full shadow-sm">
                  سكن موظفين ومغتربين
                </span>
              )}
            </div>

            <div className="relative flex p-2.5">
              <div className="w-[47%] bg-black/35 backdrop-blur-xl rounded-2xl border border-white/25 shadow-sm p-2.5 space-y-1.5">
                <h3 className="text-[11.5px] font-black text-white leading-snug line-clamp-2">{house.name}</h3>

                <p className="text-[9.5px] text-white/70 font-bold line-clamp-2 leading-relaxed">{house.description}</p>

                <div className="flex items-start gap-1.5 pt-0.5">
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="w-7 h-7 rounded-full bg-white/15 border border-white/20 flex items-center justify-center text-white">
                      <Users className="w-4 h-4" />
                    </span>
                    <span className="text-[9.5px] font-black text-white leading-none">
                      {house.propertyType === 'student' || house.propertyType === 'staff' ? house.roomCapacity : house.bedsCount}
                    </span>
                    <span className="text-[8px] font-bold text-white/70 leading-none">
                      {house.propertyType === 'student' || house.propertyType === 'staff' ? 'بالغرفة' : 'فرد'}
                    </span>
                  </div>

                  <div className="flex flex-col items-center gap-0.5">
                    <span className="w-7 h-7 rounded-full bg-white/15 border border-white/20 flex items-center justify-center text-white">
                      <BedDouble className="w-4 h-4" />
                    </span>
                    <span className="text-[9.5px] font-black text-white leading-none">{house.roomsCount}</span>
                    <span className="text-[8px] font-bold text-white/70 leading-none">غرف</span>
                  </div>

                  {(house.services.includes('موقف مجاني') || house.services.includes('جراج خاص')) && (
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="w-7 h-7 rounded-full bg-white/15 border border-white/20 flex items-center justify-center text-white">
                        <SquareParking className="w-4 h-4" />
                      </span>
                      <span className="text-[8px] font-bold text-white/70 leading-none text-center">
                        {house.services.includes('موقف مجاني') ? <>موقف<br />مجاني</> : <>جراج<br />خاص</>}
                      </span>
                    </div>
                  )}

                  {house.services.includes('واي فاي') && (
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="w-7 h-7 rounded-full bg-white/15 border border-white/20 flex items-center justify-center text-white">
                        <Wifi className="w-4 h-4" />
                      </span>
                      <span className="text-[8px] font-bold text-white/70 leading-none text-center">واي<br />فاي</span>
                    </div>
                  )}
                </div>

                <div className="flex items-baseline gap-1 pt-1">
                  {house.propertyType === 'student' || house.propertyType === 'staff' ? (
                    <>
                      <span className="text-[15px] font-black text-[#E8C88A] leading-none">{house.monthlyRent ?? 0}</span>
                      <span className="text-[8.5px] font-bold text-white/70">ج.م / شهريًا</span>
                    </>
                  ) : (
                    <>
                      <span className="text-[8.5px] font-bold text-white/70">من</span>
                      <span className="text-[15px] font-black text-[#E8C88A] leading-none">{house.pricePerNightPerPerson}</span>
                      <span className="text-[8.5px] font-bold text-white/70">ج.م / الليلة للفرد</span>
                    </>
                  )}
                </div>

                {(() => {
                  if (house.propertyType === 'student' || house.propertyType === 'staff') return null;

                  const total = stayNights && partySize
                    ? computeStayPrice(house, filterCheckIn, filterCheckOut, partySize).total
                    : 0;
                  const freeBeds = availability?.[house.id];
                  const hasBeds = typeof freeBeds === 'number' && house.bedsCount > 0;
                  const freeShare = hasBeds ? Math.min(1, Math.max(0, freeBeds / house.bedsCount)) : null;
                  const short = partySize && typeof freeBeds === 'number' ? partySize - freeBeds : 0;

                  if (!total && freeShare === null) return null;

                  return (
                    <div className="pt-1.5 mt-1 border-t border-white/15 space-y-1">
                      {total > 0 && (
                        <div>
                          <div className="flex items-baseline gap-1">
                            <span className="text-[8.5px] font-bold text-white/70">الإجمالي</span>
                            <span className="text-[13px] font-black text-white leading-none">{total.toLocaleString('en-US')}</span>
                            <span className="text-[8.5px] font-bold text-white/70">ج.م</span>
                          </div>
                          <span className="text-[8px] font-bold text-white/60">
                            {partySize} فرد × {stayNights} {stayNights === 1 ? 'ليلة' : stayNights === 2 ? 'ليلتين' : 'ليالي'}
                          </span>
                        </div>
                      )}

                      {hasBeds && partySize > 0 && (
                        short > 0 ? (
                          <span className="block text-[8px] font-black text-amber-300">ينقص {bedsLabel(short)} عن عددكم</span>
                        ) : (
                          <span className="block text-[8px] font-black text-emerald-300">يكفي عددكم — متاح {bedsLabel(freeBeds)}</span>
                        )
                      )}

                      {short <= 0 && freeShare !== null && freeShare >= 0.85 && (
                        <span className="block text-[8px] font-bold text-white/60">البيت شبه فاضي في تواريخكم</span>
                      )}
                      {short <= 0 && freeShare !== null && freeShare <= 0.4 && (
                        <span className="block text-[8px] font-bold text-white/60">محجوز {Math.round((1 - freeShare) * 100)}٪ في تواريخكم</span>
                      )}
                    </div>
                  );
                })()}

                <div className="relative flex items-center justify-center bg-gradient-to-l from-[#B8944E] to-[#E0C48A] text-white rounded-full py-2 mt-1">
                  <span className="text-[10px] font-extrabold">عرض التفاصيل</span>
                  <span className="absolute right-1.5 w-5 h-5 rounded-full bg-black/25 flex items-center justify-center">
                    <ArrowLeft className="w-3 h-3" />
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {comparedHouseIds.length > 0 && (
        <div className="sticky bottom-2 z-35 bg-[#26261D] border border-[#3C3C2E] rounded-2xl p-3 shadow-lg flex items-center justify-between gap-2 mt-4">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex items-center gap-1 shrink-0">
              {comparedHouseIds.map((id) => {
                const picked = houses.find((h) => h.id === id);
                if (!picked) return null;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={(e) => handleToggleCompare(id, e)}
                    aria-label={`إزالة ${picked.name} من المقارنة`}
                    className="relative w-8 h-8 rounded-xl overflow-hidden border border-[#3C3C2E] group/thumb cursor-pointer"
                  >
                    <img referrerPolicy="no-referrer" src={picked.images[0]} alt="" className="w-full h-full object-cover" />
                    <span className="absolute inset-0 bg-black/45 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity">
                      <X className="w-3 h-3 text-white" />
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="text-right min-w-0">
              <span className="text-[11px] font-extrabold text-[#EDEBE3] block">{comparedHouseIds.length} من ٣ للمقارنة</span>
              <span className="text-[9px] text-[#A5A28C] font-bold">
                {comparedHouseIds.length < 2 ? 'اختر بيتًا آخر على الأقل' : 'اضغط على صورة لإزالتها'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={() => setComparedHouseIds([])} className="text-[#A5A28C] hover:text-rose-300 text-[10px] font-bold px-2 py-1.5 rounded-xl hover:bg-rose-900/20 transition-all cursor-pointer">
              مسح
            </button>
            <button
              onClick={() => setShowComparisonModal(true)}
              disabled={comparedHouseIds.length < 2}
              className="bg-[#5A5A40] hover:bg-[#4A4A3A] disabled:bg-[#3F3F33] disabled:text-[#8A8570] disabled:cursor-not-allowed text-white text-[11px] font-extrabold px-3.5 py-1.5 rounded-xl shadow-sm transition-all flex items-center gap-1 cursor-pointer"
            >
              <Scale className="w-3.5 h-3.5" />
              <span>قارن</span>
            </button>
          </div>
        </div>
      )}

      {showComparisonModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 text-right">
          <div className="bg-[#20201A] rounded-3xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-[#3C3C2E]">
            <div className="bg-[#5A5A40] text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-amber-200" />
                <h3 className="text-xs font-extrabold">مقارنة بيوت الخلوة والمؤتمرات</h3>
              </div>
              <button onClick={() => setShowComparisonModal(false)} className="p-1 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-all cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {(() => {
              const picked = comparedHouseIds
                .map((id) => houses.find((h) => h.id === id))
                .filter((h): h is RetreatHouse => Boolean(h));
              if (!picked.length) return null;

              const isMonthly = (h: RetreatHouse) => h.propertyType === 'student' || h.propertyType === 'staff';
              const sameBasis = picked.every(isMonthly) || picked.every((h) => !isMonthly(h));
              const priceOf = (h: RetreatHouse) => (isMonthly(h) ? h.monthlyRent ?? 0 : h.pricePerNightPerPerson);
              const capacityOf = (h: RetreatHouse) => (isMonthly(h) ? h.roomCapacity ?? 0 : h.bedsCount);
              const bestOf = (pick: (h: RetreatHouse) => number, mode: 'min' | 'max') => {
                const values = picked.map(pick);
                const best = mode === 'min' ? Math.min(...values) : Math.max(...values);
                return values.filter((v) => v === best).length === values.length ? null : best;
              };
              const cheapest = sameBasis ? bestOf(priceOf, 'min') : null;
              const roomiest = sameBasis ? bestOf(capacityOf, 'max') : null;
              const topRated = bestOf((h) => h.rating, 'max');

              const cols = { gridTemplateColumns: `repeat(${picked.length}, minmax(0, 1fr))` };
              const Win = () => <span className="bg-emerald-600 text-white text-[7px] font-black px-1 py-0.5 rounded-full">الأفضل</span>;
              const Band = ({ label, children }: { label: string; children: React.ReactNode }) => (
                <div className="space-y-1">
                  <span className="text-[8.5px] text-[#A5A28C] font-black block border-b border-[#3C3C2E] pb-0.5">{label}</span>
                  <div className="grid gap-2" style={cols}>{children}</div>
                </div>
              );

              return (
                <div className="p-4 overflow-y-auto space-y-3 text-[10px] leading-relaxed">
                  <div className="grid gap-2" style={cols}>
                    {picked.map((h) => (
                      <div key={h.id} className="text-center space-y-1">
                        <div className="h-14 bg-[#2A2A20] rounded-xl overflow-hidden border border-[#3C3C2E]">
                          <img referrerPolicy="no-referrer" loading="lazy" src={h.images[0]} alt={h.name} className="w-full h-full object-cover" />
                        </div>
                        <h4 className="font-extrabold text-[#EDEBE3] line-clamp-2 leading-tight text-[9px]">{h.name}</h4>
                      </div>
                    ))}
                  </div>

                  <Band label="الموقع">
                    {picked.map((h) => <span key={h.id} className="font-bold text-[#EDEBE3] text-center block">{h.governorate}</span>)}
                  </Band>

                  <Band label={!sameBasis ? 'السعر' : picked.every(isMonthly) ? 'الإيجار الشهري' : 'السعر لليلة للفرد'}>
                    {picked.map((h) => (
                      <div key={h.id} className="flex flex-col items-center gap-0.5">
                        <span className={`font-black ${cheapest !== null && priceOf(h) === cheapest ? 'text-emerald-300' : 'text-[#E4E1CB]'}`}>{priceOf(h)} ج.م</span>
                        {!sameBasis && <span className="text-[7.5px] text-[#A5A28C] font-bold">{isMonthly(h) ? 'شهريًا' : 'لليلة للفرد'}</span>}
                        {cheapest !== null && priceOf(h) === cheapest && <Win />}
                      </div>
                    ))}
                  </Band>

                  <Band label={!sameBasis ? 'السعة' : picked.every(isMonthly) ? 'سعة الغرفة' : 'عدد الأسرّة'}>
                    {picked.map((h) => (
                      <div key={h.id} className="flex flex-col items-center gap-0.5">
                        <span className={`font-black ${roomiest !== null && capacityOf(h) === roomiest ? 'text-emerald-300' : 'text-[#EDEBE3]'}`}>{capacityOf(h)}</span>
                        {!sameBasis && <span className="text-[7.5px] text-[#A5A28C] font-bold">{isMonthly(h) ? 'بالغرفة' : 'سرير'}</span>}
                        {roomiest !== null && capacityOf(h) === roomiest && <Win />}
                      </div>
                    ))}
                  </Band>

                  <Band label="التقييم">
                    {picked.map((h) => (
                      <div key={h.id} className="flex flex-col items-center gap-0.5">
                        <span className="font-black text-amber-400 flex items-center gap-0.5">
                          <Star className="w-3 h-3 fill-amber-500 text-amber-500 shrink-0" />
                          {h.rating.toFixed(1)}
                        </span>
                        {topRated !== null && h.rating === topRated && <Win />}
                      </div>
                    ))}
                  </Band>

                  <Band label="الفئات المناسبة">
                    {picked.map((h) => (
                      <div key={h.id} className="flex flex-wrap gap-0.5 justify-center content-start">
                        {h.suitability.map((s) => (
                          <span key={s} className="bg-[#8A8A70]/25 text-[#D8D5C6] text-[7.5px] px-1 py-0.5 rounded-sm font-semibold">{SUITABILITY_MAP[s]}</span>
                        ))}
                      </div>
                    ))}
                  </Band>

                  <Band label="الخدمات">
                    {picked.map((h) => (
                      <div key={h.id} className="flex flex-wrap gap-0.5 justify-center content-start">
                        {h.services.slice(0, 2).map((s) => (
                          <span key={s} className="bg-emerald-900/30 text-emerald-200 text-[7px] px-1 py-0.5 rounded-sm font-bold">{s}</span>
                        ))}
                        {h.services.length > 2 && <span className="text-[7px] text-[#A5A28C] font-bold px-1 py-0.5">+{h.services.length - 2}</span>}
                      </div>
                    ))}
                  </Band>

                  {!sameBasis && (
                    <p className="text-[8.5px] text-[#A5A28C] font-bold text-center bg-[#2E2E23] rounded-xl p-2">
                      البيوت المختارة أسعارها محسوبة بطرق مختلفة (ليلة للفرد مقابل إيجار شهري)، فمفيش مقارنة مباشرة للسعر أو السعة.
                    </p>
                  )}

                  <div className="grid gap-2 pt-1" style={cols}>
                    {picked.map((h) => (
                      <button
                        key={h.id}
                        onClick={() => { onSelectHouse(h); setShowComparisonModal(false); }}
                        className="w-full bg-[#5A5A40] hover:bg-[#4A4A3A] text-white text-[9px] font-bold py-1.5 rounded-xl transition-all text-center cursor-pointer"
                      >
                        عرض التفاصيل
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}

            <div className="bg-[#2A2A20] p-3 text-center border-t border-[#3C3C2E]">
              <button onClick={() => setShowComparisonModal(false)} className="bg-[#26261D] border border-[#3C3C2E] text-[#EDEBE3] hover:bg-[#2E2E23] text-[10px] font-bold px-4 py-1.5 rounded-xl transition-all cursor-pointer">
                إغلاق المقارنة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Keep one root across Vite hot reloads so the console stays clean.
const container = document.getElementById('root')! as HTMLElement & { _root?: ReturnType<typeof createRoot> };
container._root ??= createRoot(container);
container._root.render(<Preview />);
