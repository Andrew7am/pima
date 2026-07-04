import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { User as UserIcon, BookOpen, Building, Users, Phone, MapPin, Church } from 'lucide-react';
import Logo from './Logo';
import { GOVERNORATES } from '../mockData';

interface CompleteProfileScreenProps {
  currentUser: User;
  onComplete: (fields: {
    role: UserRole;
    phone: string;
    age: number;
    governorate: string;
    village?: string;
    city?: string;
    organizationName?: string;
    churchName?: string;
    priestName?: string;
  }) => void;
}

export default function CompleteProfileScreen({ currentUser, onComplete }: CompleteProfileScreenProps) {
  const [role, setRole] = useState<UserRole>(currentUser.role === 'admin' ? 'individual' : currentUser.role);
  const [phone, setPhone] = useState(currentUser.phone || '');
  const [age, setAge] = useState(currentUser.age?.toString() || '');
  const [governorate, setGovernorate] = useState(currentUser.governorate || '');
  const [village, setVillage] = useState(currentUser.village || '');
  const [city, setCity] = useState(currentUser.city || '');
  const [orgName, setOrgName] = useState(currentUser.organizationName || '');
  const [churchName, setChurchName] = useState(currentUser.churchName || '');
  const [priestName, setPriestName] = useState(currentUser.priestName || '');
  const [error, setError] = useState('');

  const isChurchAffiliated = role === 'individual' || role === 'servant' || role === 'church';
  const needsOrgName = role === 'servant' || role === 'church' || role === 'owner';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !age || !governorate) {
      setError('الرجاء ملء رقم الهاتف والسن والمحافظة.');
      return;
    }
    if (needsOrgName && !orgName.trim()) {
      setError('الرجاء كتابة اسم الكنيسة/بيت المؤتمرات التابع له.');
      return;
    }
    if (isChurchAffiliated && (!churchName.trim() || !priestName.trim())) {
      setError('الرجاء كتابة اسم الكنيسة والأب الكاهن المسؤول.');
      return;
    }
    setError('');
    onComplete({
      role,
      phone,
      age: parseInt(age, 10),
      governorate,
      village: village.trim() || undefined,
      city: city.trim() || undefined,
      organizationName: needsOrgName ? orgName.trim() : undefined,
      churchName: isChurchAffiliated ? churchName.trim() : undefined,
      priestName: isChurchAffiliated ? priestName.trim() : undefined,
    });
  };

  return (
    <div className="min-h-screen bg-[#EBEBE0] flex items-center justify-center p-4 font-sans select-none antialiased text-right">
      <div className="w-full max-w-md bg-[#FDFBF7] rounded-[32px] border border-[#D6D6C2] shadow-2xl p-6 space-y-6 relative overflow-hidden text-[#4A4A3A]">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-l from-[#0A2342] to-[#C5A059]" />

        <div className="pt-2">
          <Logo variant="full" size={130} className="shadow-none border-none p-0 bg-transparent" />
        </div>

        <div className="space-y-1">
          <h2 className="text-xs font-bold text-[#4A4A3A]">أهلاً بك يا {currentUser.name}! أكمل بياناتك للمتابعة:</h2>
          <p className="text-[10px] text-[#8A8A70]">نحتاج بعض التفاصيل الإضافية قبل استخدام المنصة.</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-3 py-2 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-4 gap-1.5 p-1 bg-[#EBEBE0] border border-[#D6D6C2] rounded-2xl">
            {(['individual', 'servant', 'church', 'owner'] as UserRole[]).map((r) => {
              const isSelected = role === r;
              let label = '';
              let Icon = UserIcon;
              if (r === 'individual') { label = 'فرد'; Icon = UserIcon; }
              else if (r === 'servant') { label = 'خادم'; Icon = BookOpen; }
              else if (r === 'church') { label = 'كنيسة'; Icon = Building; }
              else if (r === 'owner') { label = 'صاحب بيت'; Icon = Users; }
              return (
                <button key={r} type="button" onClick={() => setRole(r)}
                  className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl transition-all ${isSelected ? 'bg-[#0A2342] text-white shadow-sm font-extrabold' : 'text-[#8A8A70] hover:bg-[#DEDECB]'}`}>
                  <Icon className="w-4 h-4" />
                  <span className="text-[9px]">{label}</span>
                </button>
              );
            })}
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-bold text-[#8A8A70] mb-1">رقم الهاتف / المحمول:</label>
              <div className="relative">
                <input type="tel" required maxLength={11} placeholder="01234567890" value={phone} onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-white border border-[#D6D6C2] rounded-xl py-2 pl-3 pr-10 text-xs text-[#4A4A3A] focus:outline-none text-left" />
                <Phone className="absolute top-2.5 right-3 w-4 h-4 text-[#BCBC9D]" />
              </div>
            </div>

            {needsOrgName && (
              <div>
                <label className="block text-[10px] font-bold text-[#8A8A70] mb-1">
                  {role === 'owner' ? 'اسم بيت المؤتمرات / الشركة الممثلة:' : 'اسم الكنيسة / أسرة الخدمة التابع لها:'}
                </label>
                <input type="text" required placeholder="مثال: كنيسة العذراء بالزيتون" value={orgName} onChange={(e) => setOrgName(e.target.value)}
                  className="w-full bg-white border border-[#D6D6C2] rounded-xl py-2 px-3 text-xs text-[#4A4A3A] focus:outline-none" />
              </div>
            )}

            <div>
              <label className="block text-[10px] font-bold text-[#8A8A70] mb-1">السن:</label>
              <input type="number" required min={1} max={120} placeholder="مثال: 25" value={age} onChange={(e) => setAge(e.target.value)}
                className="w-full bg-white border border-[#D6D6C2] rounded-xl py-2 px-3 text-xs text-[#4A4A3A] focus:outline-none" />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[#8A8A70] mb-1">المحافظة:</label>
              <div className="relative">
                <select required value={governorate} onChange={(e) => setGovernorate(e.target.value)}
                  className="w-full bg-white border border-[#D6D6C2] rounded-xl py-2 pl-3 pr-10 text-xs text-[#4A4A3A] focus:outline-none appearance-none">
                  <option value="" disabled>اختر المحافظة</option>
                  {GOVERNORATES.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
                <MapPin className="absolute top-2.5 right-3 w-4 h-4 text-[#BCBC9D] pointer-events-none" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-[#8A8A70] mb-1">المدينة (اختياري):</label>
                <input type="text" placeholder="مثال: شبين الكوم" value={city} onChange={(e) => setCity(e.target.value)}
                  className="w-full bg-white border border-[#D6D6C2] rounded-xl py-2 px-3 text-xs text-[#4A4A3A] focus:outline-none" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#8A8A70] mb-1">القرية (اختياري):</label>
                <input type="text" placeholder="مثال: ميت حبيش" value={village} onChange={(e) => setVillage(e.target.value)}
                  className="w-full bg-white border border-[#D6D6C2] rounded-xl py-2 px-3 text-xs text-[#4A4A3A] focus:outline-none" />
              </div>
            </div>

            {isChurchAffiliated && (
              <>
                <div>
                  <label className="block text-[10px] font-bold text-[#8A8A70] mb-1">اسم الكنيسة:</label>
                  <div className="relative">
                    <input type="text" required placeholder="مثال: كنيسة الأنبا أنطونيوس" value={churchName} onChange={(e) => setChurchName(e.target.value)}
                      className="w-full bg-white border border-[#D6D6C2] rounded-xl py-2 pl-3 pr-10 text-xs text-[#4A4A3A] focus:outline-none" />
                    <Church className="absolute top-2.5 right-3 w-4 h-4 text-[#BCBC9D]" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#8A8A70] mb-1">اسم الأب الكاهن المسؤول:</label>
                  <input type="text" required placeholder="مثال: القس مرقس جرجس" value={priestName} onChange={(e) => setPriestName(e.target.value)}
                    className="w-full bg-white border border-[#D6D6C2] rounded-xl py-2 px-3 text-xs text-[#4A4A3A] focus:outline-none" />
                </div>
              </>
            )}
          </div>

          <button type="submit"
            className="w-full bg-[#0A2342] hover:bg-[#071930] text-white text-xs font-bold py-2.5 rounded-xl shadow-md text-center transition-colors">
            حفظ ومتابعة إلى المنصة
          </button>
        </form>
      </div>
    </div>
  );
}
