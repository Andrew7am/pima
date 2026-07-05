import React from 'react';
import { User } from '../types';
import { User as UserIcon, Phone, MapPin, Church, LogOut, Lock } from 'lucide-react';
import RewardsDashboard from './RewardsDashboard';

interface ProfileScreenProps {
  currentUser: User;
  onLogout: () => void;
  onBack: () => void;
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 bg-[#FDFBF7] p-2.5 rounded-2xl border border-[#D6D6C2]/40">
      <Icon className="w-4 h-4 text-[#5A5A40] shrink-0" />
      <div>
        <span className="text-[9px] text-[#8A8A70] font-bold block">{label}</span>
        <span className="font-bold text-[#4A4A3A]">{value}</span>
      </div>
    </div>
  );
}

function calculateAge(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const hasHadBirthdayThisYear =
    today.getMonth() > dob.getMonth() ||
    (today.getMonth() === dob.getMonth() && today.getDate() >= dob.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}

export default function ProfileScreen({ currentUser, onLogout, onBack }: ProfileScreenProps) {
  const roleLabel = currentUser.role === 'servant' ? 'خادم' : currentUser.role === 'owner' ? 'صاحب بيت' : 'مستخدم';

  return (
    <div className="space-y-4 text-right animate-in fade-in duration-200 pb-8">
      {/* Header card */}
      <div className="bg-gradient-to-br from-[#0A2342] to-[#123E75] text-white rounded-3xl p-5 flex items-center gap-3 relative overflow-hidden">
        <div className="absolute -top-8 -left-8 w-24 h-24 bg-white/5 rounded-full blur-xl pointer-events-none" />
        <div className="w-14 h-14 rounded-full bg-[#C5A059] text-[#0A2342] flex items-center justify-center text-xl font-black shrink-0">
          {currentUser.name.charAt(0)}
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-black truncate">{currentUser.name}</h2>
          <p className="text-[10px] text-slate-300 truncate">{currentUser.email}</p>
          <span className="inline-block mt-1 text-[9px] font-bold bg-white/10 px-2 py-0.5 rounded-full">{roleLabel}</span>
        </div>
      </div>

      {/* Personal info — read-only, locked after signup */}
      <div className="bg-white rounded-3xl p-4 border border-[#D6D6C2] shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-[#D6D6C2]/60 pb-2">
          <h3 className="text-xs font-black text-[#0A2342]">البيانات الشخصية</h3>
          <span className="text-[9px] font-bold text-[#8A8A70] flex items-center gap-1">
            <Lock className="w-3 h-3" /> غير قابلة للتعديل
          </span>
        </div>
        <p className="text-[9.5px] text-[#8A8A70] leading-relaxed -mt-1">
          هذه البيانات ثابتة بعد إنشاء الحساب لضمان مطابقتها لبطاقتك الشخصية. لتصحيح أي خطأ، تواصل مع الدعم الفني.
        </p>

        <div className="space-y-2 text-[11px]">
          <InfoRow icon={Phone} label="رقم الهاتف" value={currentUser.phone} />
          {currentUser.dateOfBirth && (
            <InfoRow icon={UserIcon} label="السن" value={`${calculateAge(currentUser.dateOfBirth)} سنة`} />
          )}
          {currentUser.governorate && (
            <InfoRow icon={MapPin} label="المحافظة" value={[currentUser.governorate, currentUser.city, currentUser.village].filter(Boolean).join(' - ')} />
          )}
          {currentUser.churchName && (
            <InfoRow icon={Church} label="الكنيسة" value={`${currentUser.churchName}${currentUser.priestName ? ' — ' + currentUser.priestName : ''}`} />
          )}
          {currentUser.organizationName && <InfoRow icon={Church} label="الجهة" value={currentUser.organizationName} />}
        </div>
      </div>

      {/* Rewards & points, folded into Profile */}
      <RewardsDashboard currentUser={currentUser} onBack={onBack} />

      <button
        onClick={onLogout}
        className="w-full flex items-center justify-center gap-2 text-xs font-bold text-red-500 hover:bg-red-50 border border-red-200 rounded-2xl py-3 transition-colors cursor-pointer"
      >
        <LogOut className="w-4 h-4" />
        <span>تسجيل الخروج</span>
      </button>
    </div>
  );
}
