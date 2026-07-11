import React, { useState } from 'react';
import { UserRole } from '../types';
import { User as UserIcon, BookOpen, Users, Lock, Mail, Phone, MapPin, Church } from 'lucide-react';
import Logo from './Logo';
import { supabase } from '../lib/supabase';
import { GOVERNORATES } from '../mockData';

export default function AuthScreen() {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [isForgotMode, setIsForgotMode] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>('individual');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Forgot-password fields
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  // Register fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [orgName, setOrgName] = useState('');
  const [password, setPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [address, setAddress] = useState('');
  const [governorate, setGovernorate] = useState('');
  const [churchName, setChurchName] = useState('');
  const [priestName, setPriestName] = useState('');

  // Sign in fields
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      setError('تعذر تسجيل الدخول بجوجل. حاول مرة أخرى.');
      setLoading(false);
    }
    // On success the browser redirects to Google, so no further local state change here.
  };

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

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim().toLowerCase(), {
      redirectTo: window.location.origin,
    });
    // Always show success (even on error) so we don't leak which emails are registered.
    if (error) console.error('resetPasswordForEmail:', error);
    setForgotSent(true);
    setLoading(false);
  };

  const isChurchAffiliated = selectedRole === 'individual' || selectedRole === 'servant';

  // Minimum accepted age is 6 years old
  const minAgeDate = new Date();
  minAgeDate.setFullYear(minAgeDate.getFullYear() - 6);
  const maxDateOfBirth = minAgeDate.toISOString().split('T')[0];

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !phone || !password || !dateOfBirth || !governorate) {
      setError('الرجاء ملء كافة الحقول الأساسية (بما فيها تاريخ الميلاد والمحافظة).');
      return;
    }
    if (new Date(dateOfBirth) > new Date(maxDateOfBirth)) {
      setError('عذراً، يجب ألا يقل عمر المستخدم عن 6 سنوات.');
      return;
    }
    if (isChurchAffiliated && (!churchName || !priestName)) {
      setError('الرجاء كتابة اسم الكنيسة والأب الكاهن المسؤول.');
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
          organization_name: (selectedRole === 'servant' || selectedRole === 'owner') ? orgName : null,
          referral_code: referralCode.trim() || null,
          date_of_birth: dateOfBirth,
          address: address.trim() || null,
          governorate,
          church_name: isChurchAffiliated ? churchName.trim() : null,
          priest_name: isChurchAffiliated ? priestName.trim() : null,
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

        <button
          type="button"
          disabled={loading}
          onClick={handleGoogleSignIn}
          className="w-full flex items-center justify-center gap-2 bg-white border border-[#D6D6C2] hover:bg-[#EBEBE0]/40 disabled:opacity-60 text-[#4A4A3A] text-xs font-bold py-2.5 rounded-xl shadow-sm transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
            <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
            <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
            <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
          </svg>
          <span>تسجيل الدخول بحساب Google</span>
        </button>

        <div className="flex items-center gap-2">
          <div className="flex-1 h-px bg-[#D6D6C2]" />
          <span className="text-[9px] text-[#8A8A70] font-bold">أو</span>
          <div className="flex-1 h-px bg-[#D6D6C2]" />
        </div>

        {isForgotMode ? (
          forgotSent ? (
            <div className="space-y-4 text-center py-2">
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl px-3 py-4 leading-relaxed">
                إذا كان بريدك الإلكتروني مسجلاً لدينا، فستصلك رسالة تحتوي على رابط إعادة تعيين كلمة المرور خلال دقائق. تأكد من صندوق الرسائل غير المرغوب فيها (Spam).
              </div>
              <button type="button" onClick={() => { setIsForgotMode(false); setForgotSent(false); setError(''); }}
                className="text-[10px] text-[#8A8A70] hover:text-[#4A4A3A] font-bold underline">
                العودة لتسجيل الدخول
              </button>
            </div>
          ) : (
            <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
              <div className="space-y-1">
                <button type="button" onClick={() => { setIsForgotMode(false); setError(''); }}
                  className="flex items-center gap-1 text-[10px] text-[#8A8A70] hover:text-[#0A2342] font-bold mb-1">
                  <span>→</span>
                  <span>رجوع لتسجيل الدخول</span>
                </button>
                <h2 className="text-xs font-bold text-[#4A4A3A]">إعادة تعيين كلمة المرور:</h2>
                <p className="text-[10px] text-[#8A8A70]">أدخل بريدك الإلكتروني المسجل، وسنرسل لك رابطاً لإعادة تعيين كلمة المرور.</p>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#8A8A70] mb-1">البريد الإلكتروني:</label>
                <div className="relative">
                  <input type="email" required placeholder="example@church.eg" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)}
                    className="w-full bg-white border border-[#D6D6C2] rounded-xl py-2.5 pl-3 pr-10 text-xs text-[#4A4A3A] focus:outline-none text-left" />
                  <Mail className="absolute top-3 right-3 w-4 h-4 text-[#BCBC9D]" />
                </div>
              </div>

              <button type="submit" disabled={loading}
                className="w-full bg-[#0A2342] hover:bg-[#071930] disabled:opacity-60 text-white text-xs font-bold py-2.5 rounded-xl shadow-md text-center transition-colors">
                {loading ? 'جارٍ الإرسال...' : 'إرسال رابط إعادة التعيين'}
              </button>

              <div className="text-center">
                <button type="button" onClick={() => { setIsForgotMode(false); setError(''); }}
                  className="text-[10px] text-[#8A8A70] hover:text-[#4A4A3A] font-bold underline">
                  العودة لتسجيل الدخول
                </button>
              </div>
            </form>
          )
        ) : isRegisterMode ? (
          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            <div className="space-y-1">
              <button type="button" onClick={() => { setIsRegisterMode(false); setError(''); }}
                className="flex items-center gap-1 text-[10px] text-[#8A8A70] hover:text-[#0A2342] font-bold mb-1">
                <span>→</span>
                <span>رجوع لتسجيل الدخول</span>
              </button>
              <h2 className="text-xs font-bold text-[#4A4A3A]">إنشاء حساب جديد بالمنصة:</h2>
              <p className="text-[10px] text-[#8A8A70]">اختر نوع حسابك لتخصيص محرك البحث والحجوزات.</p>
            </div>

            <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#EBEBE0] border border-[#D6D6C2] rounded-2xl">
              {(['individual', 'servant', 'owner'] as UserRole[]).map((role) => {
                const isSelected = selectedRole === role;
                let label = '';
                let Icon = UserIcon;
                if (role === 'individual') { label = 'فرد'; Icon = UserIcon; }
                else if (role === 'servant') { label = 'خادم'; Icon = BookOpen; }
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

              {(selectedRole === 'servant' || selectedRole === 'owner') && (
                <div>
                  <label className="block text-[10px] font-bold text-[#8A8A70] mb-1">
                    {selectedRole === 'owner' ? 'اسم بيت المؤتمرات / الشركة الممثلة:' : 'اسم الكنيسة / أسرة الخدمة التابع لها:'}
                  </label>
                  <input type="text" required placeholder="مثال: كنيسة العذراء بالزيتون" value={orgName} onChange={(e) => setOrgName(e.target.value)}
                    className="w-full bg-white border border-[#D6D6C2] rounded-xl py-2 px-3 text-xs text-[#4A4A3A] focus:outline-none" />
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-[#8A8A70] mb-1">تاريخ الميلاد:</label>
                <input
                  type="date" required max={maxDateOfBirth}
                  value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)}
                  className="w-full bg-white border border-[#D6D6C2] rounded-xl py-2 px-3 text-xs text-[#4A4A3A] focus:outline-none"
                />
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

              <div>
                <label className="block text-[10px] font-bold text-[#8A8A70] mb-1">العنوان بالكامل (اختياري):</label>
                <input type="text" placeholder="مثال: مدينة شبين الكوم، قرية ميت حبيش" value={address} onChange={(e) => setAddress(e.target.value)}
                  className="w-full bg-white border border-[#D6D6C2] rounded-xl py-2 px-3 text-xs text-[#4A4A3A] focus:outline-none" />
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

              <div>
                <label className="block text-[10px] font-bold text-[#8A8A70] mb-1">كلمة المرور:</label>
                <div className="relative">
                  <input type="password" required minLength={6} placeholder="6 أحرف على الأقل" value={password} onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white border border-[#D6D6C2] rounded-xl py-2 pl-3 pr-10 text-xs text-[#4A4A3A] focus:outline-none" />
                  <Lock className="absolute top-2.5 right-3 w-4 h-4 text-[#BCBC9D]" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#8A8A70] mb-1">كود دعوة صديق (اختياري):</label>
                <input type="text" placeholder="مثال: a1b2c3d4" value={referralCode} onChange={(e) => setReferralCode(e.target.value)}
                  className="w-full bg-white border border-[#D6D6C2] rounded-xl py-2 px-3 text-xs text-[#4A4A3A] focus:outline-none text-left" dir="ltr" />
                <p className="text-[9px] text-[#8A8A70] mt-1">إن كان لديك كود من صديق، أدخله ليحصل على 2,000 نقطة (20 ج.م) عند إتمامك أول حجز مدفوع.</p>
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
                <div className="text-left mt-1.5">
                  <button type="button" onClick={() => { setIsForgotMode(true); setForgotSent(false); setForgotEmail(signInEmail); setError(''); }}
                    className="text-[9.5px] text-[#8A8A70] hover:text-[#0A2342] font-bold underline">
                    نسيت كلمة المرور؟
                  </button>
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
        {!isForgotMode && (
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
        )}

      </div>
    </div>
  );
}
