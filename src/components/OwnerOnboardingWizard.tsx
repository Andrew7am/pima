import React, { useMemo, useState } from 'react';
import { RetreatHouse, Room, ConferenceHall, OwnerPaymentMethod, User } from '../types';
import { GOVERNORATES, AMENITIES_LIST, SUITABILITY_MAP } from '../mockData';
import PhotoPickerButtons from './PhotoPickerButtons';
import Logo from './Logo';
import {
  ChevronRight, ChevronLeft, Check, Plus, Trash2, MapPin, Home,
  BedDouble, Sparkles, Landmark, Wallet, ClipboardCheck, LogOut, PartyPopper,
} from 'lucide-react';

interface OwnerOnboardingWizardProps {
  owner: User;
  existingHouse: RetreatHouse | null;
  existingRooms: Room[];
  onCreateHouse: (house: RetreatHouse) => void;
  onAddRoom: (room: Room) => void;
  onUpdatePaymentMethods: (house: RetreatHouse, methods: OwnerPaymentMethod[]) => void;
  onLogout: () => void;
  // Called the instant submission succeeds — the parent keeps rendering
  // this wizard (instead of switching straight to the dashboard the
  // moment the underlying data satisfies the completeness gate) so the
  // success screen below actually gets to display.
  onSubmitted?: () => void;
  // Called when the owner dismisses the success screen — parent then
  // lets the completeness gate resolve to the real dashboard.
  onContinue?: () => void;
}

const PAYMENT_TYPE_LABELS: Record<OwnerPaymentMethod['type'], string> = {
  instapay: 'إنستاباي',
  vodafone_cash: 'فودافون كاش',
  etisalat_cash: 'اتصالات كاش',
  orange_cash: 'أورنج كاش',
  we_cash: 'وي كاش',
  bank_transfer: 'تحويل بنكي',
};

interface DraftRoom {
  name: string;
  bedsCount: number;
  pricePerNight: string;
}

interface DraftHall {
  name: string;
  capacity: number;
  price: string;
  hasSoundSystem: boolean;
  hasProjector: boolean;
}

interface DraftPayment {
  type: OwnerPaymentMethod['type'];
  label: string;
  value: string;
}

// A mandatory, blocking wizard shown instead of the normal owner
// dashboard until the house has: at least one photo, one service, one
// priced room, and one payment method — see isOwnerOnboardingComplete
// in App.tsx for the exact gate condition. Reuses the same field
// components (PhotoPickerButtons, AMENITIES_LIST/SUITABILITY_MAP
// checklists) as the older flat OwnerDashboard form.
const STEP_LABELS: Record<string, string> = {
  basics: 'معلومات أساسية',
  photos: 'الصور',
  services: 'الخدمات',
  rooms: 'الغرف',
  halls: 'القاعات',
  payment: 'الدفع',
  review: 'المراجعة',
};

export default function OwnerOnboardingWizard({
  owner, existingHouse, existingRooms, onCreateHouse, onAddRoom, onUpdatePaymentMethods, onLogout,
  onSubmitted, onContinue,
}: OwnerOnboardingWizardProps) {
  const [submitted, setSubmitted] = useState(false);
  const needsBasics = !existingHouse;
  const needsPhotos = !existingHouse || existingHouse.images.length === 0;
  const needsServices = !existingHouse || existingHouse.services.length === 0;
  const needsRooms = existingRooms.length === 0;
  const needsPayment = !existingHouse || existingHouse.paymentMethods.length === 0;

  // ── Basic info ──────────────────────────────────────────────
  const [houseName, setHouseName] = useState('');
  const [houseDesc, setHouseDesc] = useState('');
  const [propertyType, setPropertyType] = useState<'conference' | 'student' | 'staff'>('conference');
  const [houseGov, setHouseGov] = useState(GOVERNORATES[0]);
  const [houseAddress, setHouseAddress] = useState('');
  const [houseLat, setHouseLat] = useState<number | null>(null);
  const [houseLng, setHouseLng] = useState<number | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [pricePerNight, setPricePerNight] = useState(200);
  const [monthlyRent, setMonthlyRent] = useState(1500);
  const [roomsCount, setRoomsCount] = useState(5);
  const [bedsCount, setBedsCount] = useState(10);

  // ── Photos ──────────────────────────────────────────────────
  const [imageUrl, setImageUrl] = useState('');

  // ── Services / suitability ──────────────────────────────────
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [selectedSuitability, setSelectedSuitability] = useState<(keyof typeof SUITABILITY_MAP)[]>([]);

  // ── Rooms ───────────────────────────────────────────────────
  const [draftRooms, setDraftRooms] = useState<DraftRoom[]>([]);
  const [roomDraft, setRoomDraft] = useState<DraftRoom>({ name: '', bedsCount: 2, pricePerNight: '' });

  // ── Halls (optional) ────────────────────────────────────────
  const [draftHalls, setDraftHalls] = useState<DraftHall[]>([]);
  const [hallDraft, setHallDraft] = useState<DraftHall>({ name: '', capacity: 50, price: '', hasSoundSystem: false, hasProjector: false });

  // ── Payment methods ─────────────────────────────────────────
  const [draftPayments, setDraftPayments] = useState<DraftPayment[]>([]);
  const [paymentDraft, setPaymentDraft] = useState<DraftPayment>({ type: 'instapay', label: 'إنستاباي', value: '' });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const steps = useMemo(() => {
    const s: string[] = [];
    if (needsBasics) s.push('basics');
    if (needsPhotos) s.push('photos');
    if (needsServices) s.push('services');
    if (needsRooms) s.push('rooms');
    if (needsBasics && propertyType === 'conference') s.push('halls');
    if (needsPayment) s.push('payment');
    s.push('review');
    return s;
  }, [needsBasics, needsPhotos, needsServices, needsRooms, needsPayment, propertyType]);

  const [stepIdx, setStepIdx] = useState(0);
  const step = steps[stepIdx];
  const isMonthly = propertyType !== 'conference';

  const goNext = () => setStepIdx((i) => Math.min(i + 1, steps.length - 1));
  const goBack = () => setStepIdx((i) => Math.max(i - 1, 0));

  const addDraftRoom = () => {
    if (!roomDraft.name.trim() || !roomDraft.pricePerNight) return;
    setDraftRooms((prev) => [...prev, roomDraft]);
    setRoomDraft({ name: `غرفة ${draftRooms.length + 2}`, bedsCount: 2, pricePerNight: '' });
  };

  const addDraftHall = () => {
    if (!hallDraft.name.trim()) return;
    setDraftHalls((prev) => [...prev, hallDraft]);
    setHallDraft({ name: '', capacity: 50, price: '', hasSoundSystem: false, hasProjector: false });
  };

  const addDraftPayment = () => {
    if (!paymentDraft.value.trim()) return;
    setDraftPayments((prev) => [...prev, paymentDraft]);
    setPaymentDraft({ type: 'instapay', label: PAYMENT_TYPE_LABELS.instapay, value: '' });
  };

  const canAdvance = (): boolean => {
    if (step === 'basics') return !!(houseName.trim() && houseDesc.trim() && houseAddress.trim());
    if (step === 'photos') return !!imageUrl;
    if (step === 'services') return selectedServices.length > 0;
    if (step === 'rooms') return draftRooms.length > 0;
    if (step === 'halls') return true; // optional
    if (step === 'payment') return draftPayments.length > 0;
    return true;
  };

  const handleSubmit = () => {
    setSubmitting(true);
    setError('');
    try {
      let house = existingHouse;

      if (needsBasics) {
        const newHouseId = `house_${Date.now()}`;
        house = {
          id: newHouseId,
          name: houseName,
          description: houseDesc,
          ownerId: owner.id,
          ownerName: owner.name,
          governorate: houseGov,
          address: houseAddress,
          lat: houseLat ?? 30.0444 + (Math.random() - 0.5) * 0.4,
          lng: houseLng ?? 31.2357 + (Math.random() - 0.5) * 0.4,
          roomsCount,
          bedsCount,
          roomsDescription: 'غرف مجهزة ومريحة.',
          pricePerNightPerPerson: isMonthly ? 0 : pricePerNight,
          propertyType,
          monthlyRent: isMonthly ? monthlyRent : undefined,
          services: selectedServices,
          suitability: selectedSuitability.length > 0 ? selectedSuitability : ['families'],
          conferenceHalls: draftHalls.map((h, i) => ({
            id: `hall_${Date.now()}_${i}`,
            name: h.name,
            capacity: h.capacity,
            hasSoundSystem: h.hasSoundSystem,
            hasProjector: h.hasProjector,
            price: h.price ? Number(h.price) : undefined,
          } as ConferenceHall)),
          restaurants: [{ id: `rest_${Date.now()}`, name: 'المطعم الرئيسي للبيت', capacity: bedsCount, mealsServed: ['breakfast', 'lunch', 'dinner'] }],
          activities: ['مسابقات وألعاب روحية', 'عروض مسرحية'],
          paymentMethods: draftPayments.map((p, i) => ({ id: `pay_${Date.now()}_${i}`, type: p.type, label: p.label || PAYMENT_TYPE_LABELS[p.type], value: p.value })),
          images: [imageUrl],
          status: 'pending',
          rating: 5.0,
          reviewsCount: 0,
          createdAt: new Date().toISOString(),
        };
        onCreateHouse(house);
      } else if (needsPayment && house) {
        const methods: OwnerPaymentMethod[] = draftPayments.map((p, i) => ({
          id: `pay_${Date.now()}_${i}`, type: p.type, label: p.label || PAYMENT_TYPE_LABELS[p.type], value: p.value,
        }));
        onUpdatePaymentMethods(house, methods);
      }

      if (house && needsRooms) {
        const houseId = house.id;
        draftRooms.forEach((r, i) => {
          onAddRoom({
            id: `room_${Date.now()}_${i}`,
            houseId,
            name: r.name,
            bedsCount: r.bedsCount,
            pricePerNight: r.pricePerNight ? Number(r.pricePerNight) : undefined,
            images: [],
            status: 'available',
            createdAt: new Date().toISOString(),
          });
        });
      }

      setSubmitting(false);
      setSubmitted(true);
      onSubmitted?.();
    } catch (e) {
      console.error('onboarding submit:', e);
      setError('حدث خطأ أثناء الحفظ، حاول مرة أخرى.');
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#EBEBE0] flex items-center justify-center p-4 font-sans antialiased" dir="rtl">
        <div className="w-full max-w-md bg-white rounded-[28px] border border-[#D6D6C2] shadow-2xl overflow-hidden text-center p-8 space-y-4">
          <div className="mx-auto w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center">
            <PartyPopper className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className="text-lg font-black text-[#2D2D24]">تم استلام بياناتك بنجاح!</h2>
          <p className="text-[11px] text-[#8A8A70] leading-relaxed">
            هيقوم فريق إدارة المنصة بمراجعة بيانات بيتك، وهيظهر تلقائيًا للحجاز فور الاعتماد.
          </p>
          <div className="bg-[#F7F4EB] border border-[#D6D6C2] rounded-2xl p-4 space-y-1.5 text-[11px] text-[#4A4A3A] text-right">
            <p className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> تم إرسال بياناتك للمراجعة</p>
            <p className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> هتوصلك إشعارات بأي تحديث في حالة المراجعة</p>
            <p className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> بعد الاعتماد، بيتك هيظهر للحجاز على طول</p>
          </div>
          <button type="button" onClick={() => { setSubmitted(false); onContinue?.(); }}
            className="w-full bg-[#5A5A40] hover:bg-[#4A4A34] text-white text-sm font-black py-3 rounded-2xl">
            المتابعة للوحة التحكم
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#EBEBE0] flex items-center justify-center p-4 font-sans antialiased" dir="rtl">
      <div className="w-full max-w-xl bg-white rounded-[28px] border border-[#D6D6C2] shadow-2xl overflow-hidden text-[#4A4A3A]">

        <div className="px-6 pt-6 pb-4 border-b border-[#D6D6C2] bg-[#F7F4EB]">
          <div className="flex items-center justify-between mb-3">
            <Logo variant="icon" size={36} />
            <button type="button" onClick={onLogout} className="flex items-center gap-1 text-[11px] font-bold text-red-500 hover:text-red-600">
              <LogOut className="w-3.5 h-3.5" />
              تسجيل الخروج
            </button>
          </div>
          <h2 className="text-lg font-black text-[#2D2D24]">إعداد بيت المؤتمرات</h2>
          <p className="text-[11px] text-[#8A8A70] mt-1 leading-relaxed">
            خطوة {stepIdx + 1} من {steps.length}: {STEP_LABELS[step] ?? ''} — مش هتقدر توصل للوحة التحكم لحد ما تخلّص كل الخطوات.
          </p>

          {/* Numbered step circles, connected by a line — filled/checked
              for completed steps, highlighted for the current one. */}
          <div className="flex items-center mt-4" dir="ltr">
            {steps.map((s, i) => (
              <React.Fragment key={s}>
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black border-2 transition-colors ${
                    i < stepIdx ? 'bg-[#5A5A40] border-[#5A5A40] text-white'
                      : i === stepIdx ? 'bg-white border-[#5A5A40] text-[#5A5A40]'
                        : 'bg-white border-[#D6D6C2] text-[#BCBC9D]'
                  }`}>
                    {i < stepIdx ? <Check className="w-3.5 h-3.5" /> : i + 1}
                  </div>
                </div>
                {i < steps.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 ${i < stepIdx ? 'bg-[#5A5A40]' : 'bg-[#D6D6C2]'}`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">

          {step === 'basics' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-[#5A5A40] font-black text-sm"><Home className="w-4 h-4" /> البيانات الأساسية</div>
              <div className="grid grid-cols-3 gap-2">
                {(['conference', 'student', 'staff'] as const).map((t) => (
                  <button key={t} type="button" onClick={() => setPropertyType(t)}
                    className={`text-[11px] font-bold py-2 rounded-xl border ${propertyType === t ? 'bg-[#5A5A40] text-white border-[#5A5A40]' : 'bg-white border-[#D6D6C2] text-[#4A4A3A]'}`}>
                    {t === 'conference' ? 'بيت مؤتمرات' : t === 'student' ? 'سكن طلابي' : 'سكن عاملين'}
                  </button>
                ))}
              </div>
              <input type="text" placeholder="اسم البيت" value={houseName} onChange={(e) => setHouseName(e.target.value)}
                className="w-full bg-white border border-[#D6D6C2] text-xs px-3 py-2.5 rounded-xl focus:outline-none focus:border-[#5A5A40]" />
              <textarea placeholder="وصف مختصر للبيت" value={houseDesc} onChange={(e) => setHouseDesc(e.target.value)} rows={3}
                className="w-full bg-white border border-[#D6D6C2] text-xs px-3 py-2.5 rounded-xl focus:outline-none focus:border-[#5A5A40] resize-none" />
              <select value={houseGov} onChange={(e) => setHouseGov(e.target.value)}
                className="w-full bg-white border border-[#D6D6C2] text-xs px-3 py-2.5 rounded-xl">
                {GOVERNORATES.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
              <input type="text" placeholder="العنوان التفصيلي" value={houseAddress} onChange={(e) => setHouseAddress(e.target.value)}
                className="w-full bg-white border border-[#D6D6C2] text-xs px-3 py-2.5 rounded-xl focus:outline-none focus:border-[#5A5A40]" />
              <button type="button" onClick={() => {
                if (!navigator.geolocation) { setGeoError('المتصفح لا يدعم تحديد الموقع.'); return; }
                setGeoLoading(true); setGeoError('');
                navigator.geolocation.getCurrentPosition(
                  (pos) => { setHouseLat(pos.coords.latitude); setHouseLng(pos.coords.longitude); setGeoLoading(false); },
                  () => { setGeoError('تعذر تحديد الموقع.'); setGeoLoading(false); },
                );
              }} className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-xl border border-[#5A5A40] text-[#5A5A40] bg-white">
                <MapPin className="w-3.5 h-3.5" />
                {geoLoading ? 'جاري تحديد الموقع...' : houseLat ? 'تم تحديد الموقع ✓' : 'استخدم موقعي الحالي'}
              </button>
              {geoError && <p className="text-[11px] text-red-500">{geoError}</p>}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-[#8A8A70] mb-1">عدد الغرف الإجمالي</label>
                  <input type="number" min={1} value={roomsCount} onChange={(e) => setRoomsCount(Number(e.target.value))}
                    className="w-full bg-white border border-[#D6D6C2] text-xs px-3 py-2 rounded-xl" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#8A8A70] mb-1">عدد الأسرّة الإجمالي</label>
                  <input type="number" min={1} value={bedsCount} onChange={(e) => setBedsCount(Number(e.target.value))}
                    className="w-full bg-white border border-[#D6D6C2] text-xs px-3 py-2 rounded-xl" />
                </div>
              </div>
              {isMonthly ? (
                <div>
                  <label className="block text-[10px] font-bold text-[#8A8A70] mb-1">الإيجار الشهري (جنيه)</label>
                  <input type="number" min={0} value={monthlyRent} onChange={(e) => setMonthlyRent(Number(e.target.value))}
                    className="w-full bg-white border border-[#D6D6C2] text-xs px-3 py-2 rounded-xl" />
                </div>
              ) : (
                <div>
                  <label className="block text-[10px] font-bold text-[#8A8A70] mb-1">السعر لليلة للفرد (جنيه)</label>
                  <input type="number" min={0} value={pricePerNight} onChange={(e) => setPricePerNight(Number(e.target.value))}
                    className="w-full bg-white border border-[#D6D6C2] text-xs px-3 py-2 rounded-xl" />
                </div>
              )}
            </div>
          )}

          {step === 'photos' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-[#5A5A40] font-black text-sm"><Sparkles className="w-4 h-4" /> صورة البيت</div>
              <p className="text-[11px] text-[#8A8A70]">ارفع صورة واحدة على الأقل تظهر للحجاز.</p>
              {imageUrl && <img src={imageUrl} alt="معاينة" className="w-full h-40 object-cover rounded-2xl border border-[#D6D6C2]" />}
              <PhotoPickerButtons idPrefix="onboarding-cover" onSelect={setImageUrl} />
            </div>
          )}

          {step === 'services' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-[#5A5A40] font-black text-sm"><Check className="w-4 h-4" /> الخدمات والمرافق</div>
              <p className="text-[11px] text-[#8A8A70]">اختر كل الخدمات المتاحة في بيتك (واحدة على الأقل).</p>
              <div className="grid grid-cols-2 gap-2">
                {AMENITIES_LIST.map((s) => {
                  const active = selectedServices.includes(s);
                  return (
                    <button key={s} type="button" onClick={() => setSelectedServices((prev) => active ? prev.filter((x) => x !== s) : [...prev, s])}
                      className={`text-[11px] font-bold py-2 px-2 rounded-xl border flex items-center gap-1.5 ${active ? 'bg-[#5A5A40] text-white border-[#5A5A40]' : 'bg-white border-[#D6D6C2] text-[#4A4A3A]'}`}>
                      {active && <Check className="w-3 h-3" />}
                      {s}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-[#8A8A70] pt-2">مناسب لـ:</p>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(SUITABILITY_MAP) as (keyof typeof SUITABILITY_MAP)[]).map((k) => {
                  const active = selectedSuitability.includes(k);
                  return (
                    <button key={k} type="button" onClick={() => setSelectedSuitability((prev) => active ? prev.filter((x) => x !== k) : [...prev, k])}
                      className={`text-[11px] font-bold py-2 px-2 rounded-xl border ${active ? 'bg-[#5A5A40] text-white border-[#5A5A40]' : 'bg-white border-[#D6D6C2] text-[#4A4A3A]'}`}>
                      {SUITABILITY_MAP[k]}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 'rooms' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-[#5A5A40] font-black text-sm"><BedDouble className="w-4 h-4" /> الغرف وأسعارها</div>
              <p className="text-[11px] text-[#8A8A70]">أضف غرفة واحدة على الأقل برقمها/اسمها وسعرها.</p>

              {draftRooms.length > 0 && (
                <div className="space-y-1.5">
                  {draftRooms.map((r, i) => (
                    <div key={i} className="flex items-center justify-between bg-[#F7F4EB] border border-[#D6D6C2] rounded-xl px-3 py-2 text-[11px]">
                      <span className="font-bold">{r.name} — {r.bedsCount} سرير — {r.pricePerNight} ج/الليلة</span>
                      <button type="button" onClick={() => setDraftRooms((prev) => prev.filter((_, idx) => idx !== i))} className="text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                <input type="text" placeholder="رقم/اسم الغرفة" value={roomDraft.name}
                  onChange={(e) => setRoomDraft((d) => ({ ...d, name: e.target.value }))}
                  className="col-span-1 bg-white border border-[#D6D6C2] text-[11px] px-2 py-2 rounded-xl" />
                <input type="number" min={1} placeholder="الأسرّة" value={roomDraft.bedsCount}
                  onChange={(e) => setRoomDraft((d) => ({ ...d, bedsCount: Number(e.target.value) }))}
                  className="bg-white border border-[#D6D6C2] text-[11px] px-2 py-2 rounded-xl" />
                <input type="number" min={0} placeholder="السعر/الليلة" value={roomDraft.pricePerNight}
                  onChange={(e) => setRoomDraft((d) => ({ ...d, pricePerNight: e.target.value }))}
                  className="bg-white border border-[#D6D6C2] text-[11px] px-2 py-2 rounded-xl" />
              </div>
              <button type="button" onClick={addDraftRoom} className="flex items-center gap-1.5 text-xs font-bold text-[#5A5A40]">
                <Plus className="w-4 h-4" /> إضافة الغرفة
              </button>
            </div>
          )}

          {step === 'halls' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-[#5A5A40] font-black text-sm"><Landmark className="w-4 h-4" /> قاعات المؤتمرات (اختياري)</div>
              <p className="text-[11px] text-[#8A8A70]">لو بيتك فيه قاعة اجتماعات، أضفها وسعرها. ممكن تتخطى الخطوة دي لو مفيش.</p>

              {draftHalls.length > 0 && (
                <div className="space-y-1.5">
                  {draftHalls.map((h, i) => (
                    <div key={i} className="flex items-center justify-between bg-[#F7F4EB] border border-[#D6D6C2] rounded-xl px-3 py-2 text-[11px]">
                      <span className="font-bold">{h.name} — تسع {h.capacity} — {h.price || 0} ج</span>
                      <button type="button" onClick={() => setDraftHalls((prev) => prev.filter((_, idx) => idx !== i))} className="text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <input type="text" placeholder="اسم القاعة" value={hallDraft.name}
                onChange={(e) => setHallDraft((d) => ({ ...d, name: e.target.value }))}
                className="w-full bg-white border border-[#D6D6C2] text-xs px-3 py-2 rounded-xl" />
              <div className="grid grid-cols-2 gap-2">
                <input type="number" min={1} placeholder="السعة" value={hallDraft.capacity}
                  onChange={(e) => setHallDraft((d) => ({ ...d, capacity: Number(e.target.value) }))}
                  className="bg-white border border-[#D6D6C2] text-xs px-3 py-2 rounded-xl" />
                <input type="number" min={0} placeholder="السعر لليوم" value={hallDraft.price}
                  onChange={(e) => setHallDraft((d) => ({ ...d, price: e.target.value }))}
                  className="bg-white border border-[#D6D6C2] text-xs px-3 py-2 rounded-xl" />
              </div>
              <div className="flex gap-3">
                <label className="flex items-center gap-1.5 text-[11px] font-bold">
                  <input type="checkbox" checked={hallDraft.hasSoundSystem} onChange={(e) => setHallDraft((d) => ({ ...d, hasSoundSystem: e.target.checked }))} />
                  نظام صوت
                </label>
                <label className="flex items-center gap-1.5 text-[11px] font-bold">
                  <input type="checkbox" checked={hallDraft.hasProjector} onChange={(e) => setHallDraft((d) => ({ ...d, hasProjector: e.target.checked }))} />
                  بروجيكتور
                </label>
              </div>
              <button type="button" onClick={addDraftHall} className="flex items-center gap-1.5 text-xs font-bold text-[#5A5A40]">
                <Plus className="w-4 h-4" /> إضافة القاعة
              </button>
            </div>
          )}

          {step === 'payment' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-[#5A5A40] font-black text-sm"><Wallet className="w-4 h-4" /> طريقة استلام الدفع</div>
              <p className="text-[11px] text-[#8A8A70]">هتظهر للحجاز عشان يحوّلوا لك الفلوس مباشرة. أضف وسيلة واحدة على الأقل.</p>

              {draftPayments.length > 0 && (
                <div className="space-y-1.5">
                  {draftPayments.map((p, i) => (
                    <div key={i} className="flex items-center justify-between bg-[#F7F4EB] border border-[#D6D6C2] rounded-xl px-3 py-2 text-[11px]">
                      <span className="font-bold">{PAYMENT_TYPE_LABELS[p.type]} — {p.value}</span>
                      <button type="button" onClick={() => setDraftPayments((prev) => prev.filter((_, idx) => idx !== i))} className="text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <select value={paymentDraft.type} onChange={(e) => {
                const type = e.target.value as OwnerPaymentMethod['type'];
                setPaymentDraft((d) => ({ ...d, type, label: PAYMENT_TYPE_LABELS[type] }));
              }} className="w-full bg-white border border-[#D6D6C2] text-xs px-3 py-2 rounded-xl">
                {(Object.keys(PAYMENT_TYPE_LABELS) as OwnerPaymentMethod['type'][]).map((t) => (
                  <option key={t} value={t}>{PAYMENT_TYPE_LABELS[t]}</option>
                ))}
              </select>
              <input type="text" placeholder={paymentDraft.type === 'bank_transfer' ? 'رقم الحساب / IBAN' : 'الرقم أو المعرّف'}
                value={paymentDraft.value} onChange={(e) => setPaymentDraft((d) => ({ ...d, value: e.target.value }))}
                className="w-full bg-white border border-[#D6D6C2] text-xs px-3 py-2 rounded-xl" />
              <button type="button" onClick={addDraftPayment} className="flex items-center gap-1.5 text-xs font-bold text-[#5A5A40]">
                <Plus className="w-4 h-4" /> إضافة وسيلة الدفع
              </button>
            </div>
          )}

          {step === 'review' && (() => {
            // Merge what's already saved on the house (from an earlier
            // pass, if this owner is just completing missing pieces) with
            // whatever's being entered right now — so this shows the WHOLE
            // house, not just the delta from this session.
            const displayName = needsBasics ? houseName : existingHouse?.name;
            const displayImage = imageUrl || existingHouse?.images[0];
            const displayServices = needsServices ? selectedServices : (existingHouse?.services ?? []);
            const displayRooms: { name: string; bedsCount: number; price: string | number }[] = [
              ...existingRooms.map((r) => ({ name: r.name, bedsCount: r.bedsCount, price: r.pricePerNight ?? '—' })),
              ...draftRooms.map((r) => ({ name: r.name, bedsCount: r.bedsCount, price: r.pricePerNight })),
            ];
            const displayHalls: { name: string; capacity: number; price?: number }[] = needsBasics
              ? draftHalls.map((h) => ({ name: h.name, capacity: h.capacity, price: h.price ? Number(h.price) : undefined }))
              : (existingHouse?.conferenceHalls ?? []);
            const displayPayments: { label: string; value: string }[] = [
              ...(existingHouse?.paymentMethods ?? []).map((p) => ({ label: p.label, value: p.value })),
              ...draftPayments.map((p) => ({ label: p.label || PAYMENT_TYPE_LABELS[p.type], value: p.value })),
            ];

            return (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-[#5A5A40] font-black text-sm"><ClipboardCheck className="w-4 h-4" /> المراجعة والإرسال</div>
                <p className="text-[11px] text-[#8A8A70] leading-relaxed">
                  هيتم إرسال بياناتك لإدارة المنصة للمراجعة والاعتماد قبل ما تظهر للحجاز — بالظبط زي أي بيت جديد.
                </p>

                {displayImage && (
                  <img src={displayImage} alt="معاينة" className="w-full h-36 object-cover rounded-2xl border border-[#D6D6C2]" />
                )}

                <div className="bg-[#F7F4EB] border border-[#D6D6C2] rounded-2xl p-4 space-y-3 text-[11px] text-[#4A4A3A]">
                  <p><span className="text-[#8A8A70] font-bold">اسم البيت: </span><span className="font-black">{displayName || '—'}</span></p>

                  <div>
                    <p className="text-[#8A8A70] font-bold mb-1">الخدمات والمرافق ({displayServices.length}):</p>
                    {displayServices.length === 0 ? <p className="text-red-500">لا توجد خدمات مختارة</p> : (
                      <div className="flex flex-wrap gap-1.5">
                        {displayServices.map((s) => (
                          <span key={s} className="bg-white border border-[#D6D6C2] rounded-lg px-2 py-1 text-[10px] font-bold">{s}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-[#8A8A70] font-bold mb-1">الغرف ({displayRooms.length}):</p>
                    {displayRooms.length === 0 ? <p className="text-red-500">لا توجد غرف مضافة</p> : (
                      <div className="space-y-1">
                        {displayRooms.map((r, i) => (
                          <p key={i}>• {r.name} — {r.bedsCount} سرير — {r.price || 0} ج/الليلة</p>
                        ))}
                      </div>
                    )}
                  </div>

                  {(propertyType === 'conference' || existingHouse?.propertyType === 'conference') && (
                    <div>
                      <p className="text-[#8A8A70] font-bold mb-1">قاعات المؤتمرات ({displayHalls.length}):</p>
                      {displayHalls.length === 0 ? <p>لا توجد قاعات (اختياري)</p> : (
                        <div className="space-y-1">
                          {displayHalls.map((h, i) => (
                            <p key={i}>• {h.name} — تسع {h.capacity}{h.price !== undefined ? ` — ${h.price} ج/اليوم` : ''}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <p className="text-[#8A8A70] font-bold mb-1">وسائل استلام الدفع ({displayPayments.length}):</p>
                    {displayPayments.length === 0 ? <p className="text-red-500">لا توجد وسيلة دفع</p> : (
                      <div className="space-y-1">
                        {displayPayments.map((p, i) => (
                          <p key={i}>• {p.label}: {p.value}</p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {error && <p className="text-[11px] text-red-500">{error}</p>}
              </div>
            );
          })()}

        </div>

        <div className="px-6 py-4 border-t border-[#D6D6C2] flex items-center justify-between bg-[#F7F4EB]">
          <button type="button" onClick={goBack} disabled={stepIdx === 0}
            className="flex items-center gap-1 text-xs font-bold text-[#8A8A70] disabled:opacity-30">
            <ChevronRight className="w-4 h-4" /> السابق
          </button>
          <span className="text-[10px] text-[#8A8A70] font-bold">{stepIdx + 1} / {steps.length}</span>
          {step === 'review' ? (
            <button type="button" onClick={handleSubmit} disabled={submitting}
              className="flex items-center gap-1.5 bg-[#5A5A40] hover:bg-[#4A4A34] disabled:opacity-60 text-white text-xs font-black px-5 py-2.5 rounded-xl">
              {submitting ? 'جارٍ الإرسال...' : 'إرسال للمراجعة'}
            </button>
          ) : (
            <button type="button" onClick={goNext} disabled={!canAdvance()}
              className="flex items-center gap-1 bg-[#5A5A40] hover:bg-[#4A4A34] disabled:opacity-30 text-white text-xs font-black px-5 py-2.5 rounded-xl">
              التالي <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
