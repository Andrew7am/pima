import React, { useState } from 'react';
import { UserRole } from '../types';
import { User as UserIcon, BookOpen, Building, Users, Lock, Mail, Phone } from 'lucide-react';
import Logo from './Logo';
import { supabase } from '../lib/supabase';

export default function AuthScreen() {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>('individual');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Register fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [orgName, setOrgName] = useState('');
  const [password, setPassword] = useState('');

  // Sign in fields
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signInEmail || !signInPassword) return;
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signInWithPassword({
      email: signInEmail.trim().toLowerCase(),
      password: signInPassword,
    });

    if (error) {
      setError('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
    }
    setLoading(false);
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !phone || !password) {
      setError('الرجاء ملء كافة الحقول الأساسية.');
      return;
    }
    if (password.length < 6) {
      setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل.');
      return;
    }
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: {
          name,
          role: selectedRole,
          phone,
          organization_name: (selectedRole === 'servant' || selectedRole === 'church' || selectedRole === 'owner') ? orgName : null,
        },
      },
    });

    if (error) {
      setError(error.message === 'User already registered' ? 'البريد الإلكتروني مسجل بالفعل. سجل الدخول.' : error.message);
    }
    setLoading(false);
  };

  const DEMO_ACCOUNTS = [
    { email: 'fady@gmail.com',            label: 'مينا الديب',       sub: 'فرد' },
    { email: 'mina@servant.org',          label: 'مينا الديب',       sub: 'خادم' },
    { email: 'church_admin@outlook.com',  label: 'تامر منير',        sub: 'كنيسة' },
    { email: 'owner@church.eg',           label: 'بطرس ميلاد',       sub: 'مالك بيت' },
    { email: 'shenouda@retreat.eg',       label: 'شنودة رمسيس',      sub: 'مالك بيت' },
    { email: 'admin@church.eg',           label: 'القس مرقس جرجس',   sub: 'أدمن' },
  ];

  const handleDemoLogin = async (email: string) => {
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password: 'pima1234' });
    if (error) setError('تأكد من تشغيل الـ seed أولاً.');
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#EBEBE0] flex items-center justify-center p-4 font-sans select-none antialiased text-right">
      <div className="w-full max-w-md bg-[#FDFBF7] rounded-[32px] border border-[#D6D6C2] shadow-2xl p-6 space-y-6 relative overflow-hidden text-[#4A4A3A]">

        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-l from-[#0A2342] to-[#C5A059]" />

        <div className="pt-2">
          <Logo variant="full" size={130} className="shadow-none border-none p-0 bg-transparent" />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-3 py-2 text-center">
            {error}
          </div>
        )}

        {isRegisterMode ? (
          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-xs font-bold text-[#4A4A3A]">إنشاء حساب جديد بالمنصة:</h2>
              <p className="text-[10px] text-[#8A8A70]">اختر نوع حسابك لتخصيص محرك البحث والحجوزات.</p>
            </div>

            <div className="grid grid-cols-4 gap-1.5 p-1 bg-[#EBEBE0] border border-[#D6D6C2] rounded-2xl">
              {(['individual', 'servant', 'church', 'owner'] as UserRole[]).map((role) => {
                const isSelected = selectedRole === role;
                let label = '';
                let Icon = UserIcon;
                if (role === 'individual') { label = 'فرد'; Icon = UserIcon; }
                else if (role === 'servant') { label = 'خادم'; Icon = BookOpen; }
                else if (role === 'church') { label = 'كنيسة'; Icon = Building; }
                else if (role === 'owner') { label = 'صاحب بيت'; Icon = Users; }
                return (
                  <button key={role} type="button" onClick={() => setSelectedRole(role)}
                    className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl transition-all ${isSelected ? 'bg-[#0A2342] text-white shadow-sm font-extrabold' : 'text-[#8A8A70] hover:bg-[#DEDECB]'}`}>
                    <Icon className="w-4 h-4" />
                    <span className="text-[9px]">{label}</span>
                  </button>
                );
              })}
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-[#8A8A70] mb-1">الاسم بالكامل:</label>
                <div className="relative">
                  <input type="text" required placeholder="مثال: فادي كمال مرقس" value={name} onChange={(e) => setName(e.target.value)}
                    className="w-full bg-white border border-[#D6D6C2] rounded-xl py-2 pl-3 pr-10 text-xs text-[#4A4A3A] focus:outline-none" />
                  <UserIcon className="absolute top-2.5 right-3 w-4 h-4 text-[#BCBC9D]" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#8A8A70] mb-1">البريد الإلكتروني:</label>
                <div className="relative">
                  <input type="email" required placeholder="example@church.eg" value={email} onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white border border-[#D6D6C2] rounded-xl py-2 pl-3 pr-10 text-xs text-[#4A4A3A] focus:outline-none text-left" />
                  <Mail className="absolute top-2.5 right-3 w-4 h-4 text-[#BCBC9D]" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#8A8A70] mb-1">رقم الهاتف / المحمول:</label>
                <div className="relative">
                  <input type="tel" required maxLength={11} placeholder="01234567890" value={phone} onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-white border border-[#D6D6C2] rounded-xl py-2 pl-3 pr-10 text-xs text-[#4A4A3A] focus:outline-none text-left" />
                  <Phone className="absolute top-2.5 right-3 w-4 h-4 text-[#BCBC9D]" />
                </div>
              </div>

              {(selectedRole === 'servant' || selectedRole === 'church' || selectedRole === 'owner') && (
                <div>
                  <label className="block text-[10px] font-bold text-[#8A8A70] mb-1">
                    {selectedRole === 'owner' ? 'اسم بيت المؤتمرات / الشركة الممثلة:' : 'اسم الكنيسة / أسرة الخدمة التابع لها:'}
                  </label>
                  <input type="text" required placeholder="مثال: كنيسة العذراء بالزيتون" value={orgName} onChange={(e) => setOrgName(e.target.value)}
                    className="w-full bg-white border border-[#D6D6C2] rounded-xl py-2 px-3 text-xs text-[#4A4A3A] focus:outline-none" />
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-[#8A8A70] mb-1">كلمة المرور:</label>
                <div className="relative">
                  <input type="password" required minLength={6} placeholder="6 أحرف على الأقل" value={password} onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white border border-[#D6D6C2] rounded-xl py-2 pl-3 pr-10 text-xs text-[#4A4A3A] focus:outline-none" />
                  <Lock className="absolute top-2.5 right-3 w-4 h-4 text-[#BCBC9D]" />
                </div>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full bg-[#0A2342] hover:bg-[#071930] disabled:opacity-60 text-white text-xs font-bold py-2.5 rounded-xl shadow-md text-center transition-colors">
              {loading ? 'جارٍ إنشاء الحساب...' : 'تسجيل الحساب الجديد والدخول'}
            </button>

            <div className="text-center">
              <button type="button" onClick={() => { setIsRegisterMode(false); setError(''); }}
                className="text-[10px] text-[#8A8A70] hover:text-[#4A4A3A] font-bold underline">
                لديك حساب بالفعل؟ سجل الدخول الآن
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSignInSubmit} className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-xs font-bold text-[#4A4A3A]">تسجيل الدخول للحساب:</h2>
              <p className="text-[10px] text-[#8A8A70]">أدخل بريدك الإلكتروني وكلمة المرور للمتابعة.</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-[#8A8A70] mb-1">البريد الإلكتروني:</label>
                <div className="relative">
                  <input type="email" required placeholder="example@church.eg" value={signInEmail} onChange={(e) => setSignInEmail(e.target.value)}
                    className="w-full bg-white border border-[#D6D6C2] rounded-xl py-2.5 pl-3 pr-10 text-xs text-[#4A4A3A] focus:outline-none text-left" />
                  <Mail className="absolute top-3 right-3 w-4 h-4 text-[#BCBC9D]" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#8A8A70] mb-1">كلمة المرور:</label>
                <div className="relative">
                  <input type="password" required placeholder="كلمة المرور" value={signInPassword} onChange={(e) => setSignInPassword(e.target.value)}
                    className="w-full bg-white border border-[#D6D6C2] rounded-xl py-2.5 pl-3 pr-10 text-xs text-[#4A4A3A] focus:outline-none" />
                  <Lock className="absolute top-3 right-3 w-4 h-4 text-[#BCBC9D]" />
                </div>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full bg-[#0A2342] hover:bg-[#071930] disabled:opacity-60 text-white text-xs font-bold py-2.5 rounded-xl shadow-md text-center transition-colors">
              {loading ? 'جارٍ تسجيل الدخول...' : 'تسجيل الدخول ومتابعة الحجز'}
            </button>

            <div className="text-center">
              <button type="button" onClick={() => { setIsRegisterMode(true); setError(''); }}
                className="text-[10px] text-[#8A8A70] hover:text-[#4A4A3A] font-bold underline">
                ليس لديك حساب؟ قم بإنشاء حسابك الفردي أو الخدمي الآن
              </button>
            </div>
          </form>
        )}
        <div className="pt-4 border-t border-[#D6D6C2] space-y-2 text-right">
          <span className="block text-[10px] font-bold text-[#8A8A70]">حسابات تجريبية — كلمة المرور: pima1234</span>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                disabled={loading}
                onClick={() => handleDemoLogin(acc.email)}
                className="bg-[#EBEBE0] border border-[#D6D6C2] hover:bg-[#DEDECB] active:bg-[#BCBC9D] p-2 rounded-xl flex flex-col justify-start text-right transition-colors text-[#4A4A3A] disabled:opacity-50"
              >
                <span className="font-bold text-[#4A4A3A] truncate w-full">{acc.label}</span>
                <span className="text-[8px] text-[#8A8A70]">{acc.sub}</span>
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
