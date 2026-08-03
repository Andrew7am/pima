import React, { useEffect, useState } from 'react';
import { Loader2, UserPlus, CheckCircle2, CalendarDays, Users, PartyPopper } from 'lucide-react';
import Logo from './Logo';
import { getBookingInviteInfo, selfRegisterAttendee, BookingInviteInfo } from '../lib/selfRegister';

// Standalone, no-auth page reached via ?join=<bookingId>. A group member opens
// the leader's shared link and adds their own name to the retreat's roster.
export default function SelfRegisterScreen({ bookingId }: { bookingId: string }) {
  const [info, setInfo] = useState<BookingInviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [groupType, setGroupType] = useState<'youth' | 'family' | 'child' | 'other'>('youth');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    getBookingInviteInfo(bookingId).then((res) => { if (!cancelled) { setInfo(res); setLoading(false); } });
    return () => { cancelled = true; };
  }, [bookingId]);

  const goHome = () => { window.location.href = window.location.origin; };

  const handleSubmit = async () => {
    setError('');
    if (name.trim().length === 0) { setError('من فضلك اكتب اسمك.'); return; }
    setSubmitting(true);
    const res = await selfRegisterAttendee(bookingId, name.trim(), gender, groupType);
    setSubmitting(false);
    if (res.ok) { setDone(true); setInfo((p) => p ? { ...p, registeredCount: p.registeredCount + 1 } : p); }
    else setError(res.error || 'تعذّر التسجيل.');
  };

  // A render function, deliberately NOT a component. Declared inside the render
  // body, a component is a new type on every render, so React remounted this
  // whole subtree — including the name field, which lost focus after every
  // single character typed.
  const renderShell = (children: React.ReactNode) => (
    <div dir="rtl" className="min-h-dvh bg-[#FAF8F5] flex flex-col items-center justify-center p-5 text-right">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-5">
          <Logo size={30} variant="icon" />
          <span className="font-black text-[#0A2342] text-lg">بيما</span>
        </div>
        {children}
      </div>
    </div>
  );

  if (loading) {
    return renderShell(<div className="flex flex-col items-center gap-3 py-16 text-[#8A8A70]"><Loader2 className="w-7 h-7 animate-spin" /><span className="text-xs font-bold">جارٍ فتح الدعوة…</span></div>);
  }

  if (!info || (info.status !== 'approved' && !done)) {
    return renderShell(
      <>
        <div className="bg-white rounded-3xl p-7 border border-[#D6D6C2] text-center space-y-3 shadow-sm">
          <h1 className="text-sm font-black text-[#4A4A3A]">الرابط غير متاح</h1>
          <p className="text-[11px] text-[#8A8A70] leading-relaxed">
            {!info ? 'لم نتمكن من العثور على هذا الحجز. تأكد من الرابط المُرسَل إليك.' : 'التسجيل غير مفتوح لهذا الحجز حالياً. تواصل مع مسؤول مجموعتك.'}
          </p>
          <button onClick={goHome} className="text-[11px] font-bold text-[#0A2342] underline cursor-pointer">الذهاب إلى بيما</button>
        </div>
      </>
    );
  }

  if (done) {
    return renderShell(
      <>
        <div className="bg-white rounded-3xl p-7 border border-[#D6D6C2] text-center space-y-3 shadow-sm animate-in fade-in zoom-in-95 duration-300">
          <div className="mx-auto w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center">
            <PartyPopper className="w-7 h-7 text-emerald-600" />
          </div>
          <h1 className="text-sm font-black text-[#4A4A3A]">تم تسجيلك بنجاح 🎉</h1>
          <p className="text-[11px] text-[#8A8A70] leading-relaxed">
            تمت إضافة <strong className="text-[#0A2342]">{name.trim()}</strong> إلى قائمة المشاركين في «{info.houseName}». مسؤول المجموعة هيوزّع الغرف.
          </p>
          <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-full py-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> سُجِّل {info.registeredCount} من {info.guestsCount}
          </div>
        </div>
      </>
    );
  }

  const remaining = Math.max(0, info.guestsCount - info.registeredCount);

  return renderShell(
    <>
      <div className="bg-white rounded-3xl border border-[#D6D6C2] shadow-sm overflow-hidden">
        <div className="bg-gradient-to-br from-[#0A2342] to-[#123E75] text-white p-5 space-y-2">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#C5A059]"><UserPlus className="w-3.5 h-3.5" /> دعوة انضمام لخلوة</div>
          <h1 className="text-base font-black leading-snug">{info.houseName}</h1>
          <div className="flex flex-wrap gap-3 text-[10.5px] text-slate-200 font-bold">
            <span className="flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5 text-[#C5A059]" /> {info.checkIn} → {info.checkOut}</span>
            <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5 text-[#C5A059]" /> سُجِّل {info.registeredCount}/{info.guestsCount}</span>
          </div>
        </div>

        <div className="p-5 space-y-3.5">
          <p className="text-[11px] text-[#8A8A70] leading-relaxed">اكتب بياناتك للانضمام لقائمة المشاركين. {remaining > 0 ? `باقي ${remaining} مكان.` : ''}</p>

          <div>
            <label className="text-[10px] font-black text-[#4A4A3A] block mb-1">الاسم الكامل</label>
            <input
              type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: مينا عادل"
              className="w-full bg-[#FDFBF7] border border-[#D6D6C2] rounded-xl py-2.5 px-3 text-xs text-[#4A4A3A] outline-none focus:border-[#0A2342]"
            />
          </div>

          <div>
            <label className="text-[10px] font-black text-[#4A4A3A] block mb-1">النوع</label>
            <div className="grid grid-cols-2 gap-2">
              {([['male', 'ذكر'], ['female', 'أنثى']] as const).map(([g, lbl]) => (
                <button key={g} onClick={() => setGender(g)}
                  className={`py-2 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${gender === g ? 'bg-[#0A2342] text-white border-[#0A2342]' : 'bg-white text-[#5A5A40] border-[#D6D6C2]'}`}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black text-[#4A4A3A] block mb-1">الفئة</label>
            <div className="grid grid-cols-4 gap-1.5">
              {([['youth', 'شباب'], ['family', 'عائلة'], ['child', 'طفل'], ['other', 'أخرى']] as const).map(([g, lbl]) => (
                <button key={g} onClick={() => setGroupType(g)}
                  className={`py-1.5 rounded-xl text-[10px] font-bold border transition-all cursor-pointer ${groupType === g ? 'bg-[#C5A059] text-[#3a2e12] border-[#C5A059]' : 'bg-white text-[#5A5A40] border-[#D6D6C2]'}`}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-[10px] rounded-xl px-3 py-2 text-center">{error}</div>}

          <button
            onClick={handleSubmit} disabled={submitting}
            className="w-full flex items-center justify-center gap-2 bg-[#464E3D] hover:bg-[#343A2D] disabled:opacity-60 text-white px-4 py-3 rounded-2xl text-xs font-black transition-all cursor-pointer shadow-sm"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            <span>{submitting ? 'جارٍ التسجيل…' : 'سجّلني في القائمة'}</span>
          </button>
        </div>
      </div>
    </>
  );
}
