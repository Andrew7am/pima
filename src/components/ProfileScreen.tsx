import React, { useState } from 'react';
import { User } from '../types';
import { User as UserIcon, Phone, MapPin, Church, LogOut, Pencil, Save } from 'lucide-react';
import { GOVERNORATES } from '../mockData';
import RewardsDashboard from './RewardsDashboard';

interface ProfileScreenProps {
  currentUser: User;
  onUpdateProfile: (updatedUser: User) => void;
  onLogout: () => void;
  onBack: () => void;
}

function Field({ label, value, onChange, type = 'text', dir }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; dir?: string;
}) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-[#8A8A70] mb-1">{label}:</label>
      <input
        type={type} value={value} onChange={(e) => onChange(e.target.value)} dir={dir}
        className="w-full bg-white border border-[#D6D6C2] rounded-xl py-2 px-3 text-xs text-[#4A4A3A] focus:outline-none"
      />
    </div>
  );
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

export default function ProfileScreen({ currentUser, onUpdateProfile, onLogout, onBack }: ProfileScreenProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(currentUser.name);
  const [phone, setPhone] = useState(currentUser.phone);
  const [age, setAge] = useState(currentUser.age?.toString() || '');
  const [governorate, setGovernorate] = useState(currentUser.governorate || '');
  const [city, setCity] = useState(currentUser.city || '');
  const [village, setVillage] = useState(currentUser.village || '');
  const [churchName, setChurchName] = useState(currentUser.churchName || '');
  const [priestName, setPriestName] = useState(currentUser.priestName || '');
  const [organizationName, setOrganizationName] = useState(currentUser.organizationName || '');

  const isChurchAffiliated = currentUser.role === 'individual' || currentUser.role === 'servant';
  const needsOrgName = currentUser.role === 'servant' || currentUser.role === 'owner';
  const roleLabel = currentUser.role === 'servant' ? 'خادم' : currentUser.role === 'owner' ? 'صاحب بيت' : 'مستخدم';

  const handleSave = () => {
    onUpdateProfile({
      ...currentUser,
      name,
      phone,
      age: age ? parseInt(age, 10) : undefined,
      governorate: governorate || undefined,
      city: city.trim() || undefined,
      village: village.trim() || undefined,
      churchName: churchName.trim() || undefined,
      priestName: priestName.trim() || undefined,
      organizationName: organizationName.trim() || undefined,
    });
    setIsEditing(false);
  };

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

      {/* Personal info */}
      <div className="bg-white rounded-3xl p-4 border border-[#D6D6C2] shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-[#D6D6C2]/60 pb-2">
          <h3 className="text-xs font-black text-[#0A2342]">البيانات الشخصية</h3>
          {!isEditing ? (
            <button onClick={() => setIsEditing(true)} className="text-[10px] font-bold text-[#5A5A40] hover:underline flex items-center gap-1 cursor-pointer">
              <Pencil className="w-3 h-3" /> تعديل
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setIsEditing(false)} className="text-[10px] font-bold text-rose-600 hover:underline cursor-pointer">إلغاء</button>
              <button onClick={handleSave} className="text-[10px] font-bold text-emerald-700 hover:underline flex items-center gap-1 cursor-pointer">
                <Save className="w-3 h-3" /> حفظ
              </button>
            </div>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-2.5">
            <Field label="الاسم بالكامل" value={name} onChange={setName} />
            <Field label="رقم الهاتف" value={phone} onChange={setPhone} dir="ltr" />
            <Field label="السن" value={age} onChange={setAge} type="number" />
            <div>
              <label className="block text-[10px] font-bold text-[#8A8A70] mb-1">المحافظة:</label>
              <select
                value={governorate} onChange={(e) => setGovernorate(e.target.value)}
                className="w-full bg-white border border-[#D6D6C2] rounded-xl py-2 px-3 text-xs text-[#4A4A3A] focus:outline-none"
              >
                <option value="">اختر المحافظة</option>
                {GOVERNORATES.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="المدينة" value={city} onChange={setCity} />
              <Field label="القرية" value={village} onChange={setVillage} />
            </div>
            {isChurchAffiliated && (
              <>
                <Field label="اسم الكنيسة" value={churchName} onChange={setChurchName} />
                <Field label="اسم الأب الكاهن المسؤول" value={priestName} onChange={setPriestName} />
              </>
            )}
            {needsOrgName && (
              <Field
                label={currentUser.role === 'owner' ? 'اسم بيت المؤتمرات' : 'اسم الكنيسة / أسرة الخدمة'}
                value={organizationName} onChange={setOrganizationName}
              />
            )}
          </div>
        ) : (
          <div className="space-y-2 text-[11px]">
            <InfoRow icon={Phone} label="رقم الهاتف" value={currentUser.phone} />
            {currentUser.age !== undefined && <InfoRow icon={UserIcon} label="السن" value={String(currentUser.age)} />}
            {currentUser.governorate && (
              <InfoRow icon={MapPin} label="المحافظة" value={[currentUser.governorate, currentUser.city, currentUser.village].filter(Boolean).join(' - ')} />
            )}
            {currentUser.churchName && (
              <InfoRow icon={Church} label="الكنيسة" value={`${currentUser.churchName}${currentUser.priestName ? ' — ' + currentUser.priestName : ''}`} />
            )}
            {currentUser.organizationName && <InfoRow icon={Church} label="الجهة" value={currentUser.organizationName} />}
          </div>
        )}
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
