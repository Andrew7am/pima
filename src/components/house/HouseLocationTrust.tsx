import React from 'react';
import { RetreatHouse, Announcement, User } from '../../types';
import { MapPin, ShieldCheck, BadgeCheck, Lock, MessageSquare, Headphones, CheckCircle2 } from 'lucide-react';

interface OwnerProfile {
  firstName: string;
  avatarUrl?: string;
  verified: boolean;
  hostedGroups: number;
  avgResponseHours: number | null;
}

interface HouseLocationTrustProps {
  house: RetreatHouse;
  ownerProfile: OwnerProfile | null;
  announcements: Announcement[];
}

const CARD = 'bg-white rounded-3xl border border-[#EDE7DA] shadow-[0_8px_24px_rgba(0,0,0,0.06),0_2px_6px_rgba(0,0,0,0.03)]';

/* Brand marks, drawn rather than fetched: a strict CSP and an offline-capable
   app both rule out hotlinking three logos from three CDNs. */
const GoogleMapsMark = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" aria-hidden="true">
    <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Z" fill="#34A853" />
    <path d="M6.1 5.2A7 7 0 0 1 12 2c2.2 0 4.1 1 5.3 2.6l-4.2 3.5A2.5 2.5 0 0 0 9.6 9L6.1 5.2Z" fill="#EA4335" />
    <path d="M17.3 4.6A7 7 0 0 1 19 9c0 1.6-.7 3.6-1.7 5.5l-4.4-6.2 4.4-3.7Z" fill="#FBBC04" />
    <path d="M5.4 6.5A7 7 0 0 0 5 9c0 2 1 4.5 2.3 6.8l4.2-6.4a2.5 2.5 0 0 1-.3-3.2L5.4 6.5Z" fill="#4285F4" />
    <circle cx="12" cy="9" r="2.4" fill="#FFFFFF" />
  </svg>
);

const AppleMark = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" fill="#111111" aria-hidden="true">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
  </svg>
);

const WazeMark = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" aria-hidden="true">
    <circle cx="12" cy="11" r="9" fill="#33CCFF" />
    <circle cx="9" cy="10" r="1.5" fill="#FFFFFF" /><circle cx="15" cy="10" r="1.5" fill="#FFFFFF" />
    <circle cx="9.4" cy="10.2" r="0.7" fill="#111111" /><circle cx="15.4" cy="10.2" r="0.7" fill="#111111" />
    <path d="M8.6 14a3.6 3.6 0 0 0 6.8 0" fill="none" stroke="#111111" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

/**
 * The two cards under the hero: where the place is, and why booking it is
 * safe.
 *
 * The guarantee copy is the platform's promise, not a fact read off the
 * record — it says the same thing on every house, deliberately, because it
 * describes the platform rather than the property.
 */
export default function HouseLocationTrust({ house, ownerProfile, announcements }: HouseLocationTrustProps) {
  const hasCoords = !!(house.lat && house.lng);
  const maps = [
    { key: 'waze',   label: 'Waze',        mark: <WazeMark />,       href: `https://waze.com/ul?ll=${house.lat},${house.lng}&navigate=yes` },
    { key: 'apple',  label: 'Apple Maps',  mark: <AppleMark />,      href: `https://maps.apple.com/?q=${house.lat},${house.lng}` },
    { key: 'google', label: 'Google Maps', mark: <GoogleMapsMark />, href: `https://www.google.com/maps/search/?api=1&query=${house.lat},${house.lng}` },
  ];

  const guarantees = [
    { icon: BadgeCheck,    title: 'مكان موثق',   body: 'جميع الأماكن مراجعة وموثقة' },
    { icon: Lock,          title: 'دفع آمن',      body: 'جميع المدفوعات مؤمنة ١٠٠٪' },
    { icon: MessageSquare, title: 'التواصل بعد', body: 'تأكيد الحجز فقط لحمايتك وخصوصيتك' },
    { icon: Headphones,    title: 'دعم من بيما',  body: 'نحن هنا لمساعدتك عند الحاجة ٢٤/٧' },
  ];

  const liveAnnouncements = announcements.filter((a) => a.isActive);

  return (
    <div className="space-y-4">
      {/* Anything the owner has posted stays at the top of this stack — a
          notice about the pool being closed is no use below the guarantees. */}
      {liveAnnouncements.map((a) => (
        <div key={a.id} className="p-3 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-2 text-[10.5px] text-amber-900 font-bold">
          <span className="text-sm">📢</span>
          <span>{a.message}</span>
        </div>
      ))}

      {/* ── Where it is ── */}
      <div className={`${CARD} p-5 space-y-4`}>
        <div className="flex items-center gap-3">
          <span className="w-14 h-14 rounded-full bg-[#F6F0E2] flex items-center justify-center shrink-0">
            <MapPin className="w-7 h-7 text-[#C5A059]" />
          </span>
          <div className="min-w-0">
            <p className="text-[14px] font-black text-[#0A2342] leading-snug">{house.address}</p>
            <p className="text-[11px] font-medium text-[#8A8A70] mt-0.5">الموقع على الخريطة</p>
          </div>
        </div>

        {hasCoords && (
          <div className="grid grid-cols-3 gap-2">
            {maps.map((m) => (
              <a
                key={m.key}
                href={m.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 rounded-2xl bg-white border border-[#EDE7DA] px-2 py-3 shadow-[0_2px_8px_rgba(45,45,36,0.05)] hover:bg-[#FBF9F4] hover:border-[#E3CD9F] transition-colors pima-press"
              >
                {m.mark}
                <span className="text-[11px] font-bold text-[#2D2D24] truncate" dir="ltr">{m.label}</span>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* ── Who is hosting. Kept from the previous layout: the guarantees below
             describe Pima, this describes the person you will actually be
             dealing with, and one does not stand in for the other. ── */}
      {ownerProfile && (
        <div className={`${CARD} p-4 flex items-center gap-3`}>
          <div className="w-12 h-12 rounded-full bg-[#5A5A40] text-white flex items-center justify-center text-base font-black shrink-0 overflow-hidden">
            {ownerProfile.avatarUrl ? (
              <img src={ownerProfile.avatarUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <span>{ownerProfile.firstName.charAt(0)}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-black text-[#2D2D24]">مضيفك: {ownerProfile.firstName}</span>
              {ownerProfile.verified && (
                <span className="text-[9px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                  <CheckCircle2 className="w-3 h-3" /><span>موثّق</span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 text-[10px] text-[#8A8A70] font-bold">
              {ownerProfile.hostedGroups > 0 && <span>🎉 استضاف {ownerProfile.hostedGroups} مجموعة</span>}
              {ownerProfile.avgResponseHours != null && (
                <span>⚡ يرد عادةً خلال {ownerProfile.avgResponseHours < 1 ? 'أقل من ساعة' : `${Math.round(ownerProfile.avgResponseHours)} ساعات`}</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Why it is safe ── */}
      <div className={`${CARD} p-5`}>
        <div className="text-center space-y-1">
          <h3 className="text-[17px] font-black text-[#0A2342] flex items-center justify-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#C5A059]" />
            ضمانات بيما
          </h3>
          <p className="text-[11px] font-medium text-[#8A8A70]">احجز بثقة وأمان معنا</p>
        </div>

        <div className="mt-5 grid grid-cols-4">
          {guarantees.map((g, i) => (
            <div
              key={g.title}
              className={`flex flex-col items-center text-center gap-1.5 px-1 ${i > 0 ? 'border-l border-[#EDE7DA]' : ''}`}
            >
              <span className="w-11 h-11 rounded-full bg-[#F6F0E2] flex items-center justify-center">
                <g.icon className="w-5 h-5 text-[#C5A059]" />
              </span>
              <span className="text-[10px] font-black text-[#2D2D24] leading-tight">{g.title}</span>
              <span className="text-[8.5px] font-medium text-[#8A8A70] leading-snug">{g.body}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
