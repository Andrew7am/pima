import React, { useState } from 'react';
import { UserRole } from '../types';
import {
  User as UserIcon, BookOpen, Users, Lock, Mail, Phone, MapPin, Church,
  Home, Calendar as CalendarIcon, ShieldCheck, UserPlus, Award, Headphones,
  Eye, EyeOff, ChevronLeft,
} from 'lucide-react';
import Logo from './Logo';
import { supabase } from '../lib/supabase';
import { GOVERNORATES } from '../mockData';
import PrivacyPolicy from './PrivacyPolicy';

// Small ornamental Coptic-style cross for the divider between the form
// and the "create account" row.
function CrossOrnament({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="2.4" fill="#C5A059" />
      <path d="M12 4 L13 10 L11 10 Z" fill="#C5A059" />
      <path d="M12 20 L13 14 L11 14 Z" fill="#C5A059" />
      <path d="M4 12 L10 13 L10 11 Z" fill="#C5A059" />
      <path d="M20 12 L14 13 L14 11 Z" fill="#C5A059" />
    </svg>
  );
}

// Curved leaf flourish used to frame the "تسجيل الدخول" heading — matches
// the arabesque motifs in the mockup. `flip` mirrors it so the two sides
// of the heading point inward toward the text.
function LeafFlourish({ className = '', flip = false }: { className?: string; flip?: boolean }) {
  return (
    <svg
      viewBox="0 0 40 12"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={flip ? { transform: 'scaleX(-1)' } : undefined}
    >
      <path d="M2 6 Q 14 -2, 26 6" stroke="#C5A059" strokeWidth="1.2" strokeLinecap="round" fill="none" />
      <path d="M26 6 C 30 6, 33 3, 33 3 C 33 3, 35 6, 32 8 C 30 9, 27 8, 26 6 Z" fill="#C5A059" />
      <circle cx="4" cy="6" r="1.3" fill="#C5A059" />
    </svg>
  );
}

function FeatureChip({ icon, label, sub }: { icon: React.ReactNode; label: string; sub: string }) {
  return (
    <div className="flex flex-col items-center gap-1 p-1 text-center">
      <div className="w-9 h-9 rounded-full bg-white border border-[#EFE8D8] flex items-center justify-center shadow-sm">
        {icon}
      </div>
      <div className="text-[9.5px] font-black text-[#0A2342] leading-tight">{label}</div>
      <div className="text-[8px] text-[#8A8A70] leading-tight">{sub}</div>
    </div>
  );
}

function BottomChip({ icon, label, sub }: { icon: React.ReactNode; label: string; sub: string }) {
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center border border-[#C5A059]/40">
        {icon}
      </div>
      <div className="text-[9.5px] font-black text-white leading-tight">{label}</div>
      <div className="text-[8px] text-white/70 leading-tight">{sub}</div>
    </div>
  );
}

// Google G icon (colored) — extracted so we don't repeat the SVG.
function GoogleG({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
    </svg>
  );
}

export default function AuthScreen() {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [isForgotMode, setIsForgotMode] = useState(false);
  const [isViewingPrivacy, setIsViewingPrivacy] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>('individual');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

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

  if (isViewingPrivacy) {
    return (
      <div className="min-h-screen bg-[#EBEBE0] flex items-center justify-center p-4 font-sans antialiased text-right">
        <div className="w-full max-w-md">
          <PrivacyPolicy onBack={() => setIsViewingPrivacy(false)} />
        </div>
      </div>
    );
  }

  // --- Fresh landing / login view (matches the current mobile mockup) -----
  // Register + forgot flows keep the older compact wrapper below.
  if (!isRegisterMode && !isForgotMode) {
    return (
      <div className="min-h-screen bg-[#EBEBE0] flex items-center justify-center p-4 font-sans antialiased text-right">
        <div className="w-full max-w-md bg-white rounded-[32px] border border-[#D6D6C2] shadow-2xl overflow-hidden text-[#4A4A3A]">

          {/* 1 — Hero image + curved bottom wave. Full image shown as-is
              (the user's uploaded file already has the correct
              "المسيحية" logo baked in). A convex white SVG wave at the
              bottom makes the transition into the content section flow
              seamlessly instead of a hard rectangular edge, with a
              subtle gold hairline tracing the same curve. */}
          <div className="relative w-full">
            <img
              src="/pima-hero.png"
              alt="بيما - بيوت المؤتمرات المسيحية"
              className="w-full h-64 object-cover object-center block"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
            {/* Convex wave — white content bulges up into the image */}
            <svg
              className="absolute -bottom-px inset-x-0 w-full"
              viewBox="0 0 400 50"
              preserveAspectRatio="none"
              style={{ height: 44 }}
              aria-hidden
            >
              <path d="M0,50 L0,38 Q200,-14 400,38 L400,50 Z" fill="white" />
            </svg>
            {/* Gold hairline riding the same curve, slightly above it */}
            <svg
              className="absolute -bottom-px inset-x-0 w-full pointer-events-none"
              viewBox="0 0 400 50"
              preserveAspectRatio="none"
              style={{ height: 44 }}
              aria-hidden
            >
              <path d="M0,34 Q200,-18 400,34" fill="none" stroke="#C5A059" strokeWidth="1.2" opacity="0.85" />
            </svg>
          </div>

          <div className="px-5 pt-2 pb-5 space-y-4">
            {/* 2 — Title */}
            <div className="text-center space-y-1">
              <h1 className="text-xl font-black text-[#0A2342]">
                أهلاً بك في <span className="text-[#C5A059] font-serif">PiMa</span>
              </h1>
              <p className="text-[11px] text-[#8A8A70] leading-relaxed max-w-[280px] mx-auto">
                احجز مكانك بسهولة واستمتع بتجربة روحانية مميزة
              </p>
            </div>

            {/* 3 — Feature chips (3 tiles — "للقاء والبركة" removed) */}
            <div className="grid grid-cols-3 gap-2 bg-white border border-[#EFE8D8] rounded-2xl p-2.5 shadow-sm">
              <FeatureChip icon={<Home className="w-4 h-4 text-[#C5A059]" strokeWidth={2.2} />} label="أكثر من مكان" sub="اختيارات متنوعة" />
              <FeatureChip icon={<CalendarIcon className="w-4 h-4 text-[#C5A059]" strokeWidth={2.2} />} label="احجز الآن" sub="بكل سهولة" />
              <FeatureChip icon={<ShieldCheck className="w-4 h-4 text-[#C5A059]" strokeWidth={2.2} />} label="موثوق وآمن" sub="حجوزات مؤكدة" />
            </div>

            {/* 4 — Section heading with leaf flourishes on both sides */}
            <div className="flex items-center justify-center gap-2 pt-1">
              <LeafFlourish className="w-10 h-3" />
              <span className="text-base font-black text-[#0A2342] px-1">تسجيل الدخول</span>
              <LeafFlourish className="w-10 h-3" flip />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-3 py-2 text-center">
                {error}
              </div>
            )}

            {/* 5 — Google */}
            <button
              type="button"
              disabled={loading}
              onClick={handleGoogleSignIn}
              className="w-full flex items-center justify-center gap-2 bg-[#0A2342] hover:bg-[#071930] disabled:opacity-60 text-white text-xs font-bold py-3 rounded-xl shadow-md transition-colors"
            >
              <div className="bg-white rounded-full p-0.5">
                <GoogleG className="w-3.5 h-3.5" />
              </div>
              <span>تسجيل الدخول بحساب Google</span>
            </button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-[#EFE8D8]" />
              <span className="text-[10px] text-[#8A8A70] font-bold">أو</span>
              <div className="flex-1 h-px bg-[#EFE8D8]" />
            </div>

            {/* 6 — Form */}
            <form onSubmit={handleSignInSubmit} className="space-y-3">
              <div className="relative">
                <input
                  type="email" required placeholder="البريد الإلكتروني"
                  value={signInEmail} onChange={(e) => setSignInEmail(e.target.value)}
                  className="w-full bg-white border border-[#EFE8D8] rounded-2xl py-3 pr-11 pl-3 text-xs text-[#4A4A3A] focus:outline-none focus:border-[#C5A059] text-right"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3.5">
                  <Mail className="w-4 h-4 text-[#BCBC9D]" />
                </div>
              </div>

              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'} required placeholder="كلمة المرور"
                  value={signInPassword} onChange={(e) => setSignInPassword(e.target.value)}
                  className="w-full bg-white border border-[#EFE8D8] rounded-2xl py-3 pr-11 pl-10 text-xs text-[#4A4A3A] focus:outline-none focus:border-[#C5A059] text-right"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3.5">
                  <Lock className="w-4 h-4 text-[#BCBC9D]" />
                </div>
                <button
                  type="button" onClick={() => setShowPass((s) => !s)}
                  className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#BCBC9D] hover:text-[#4A4A3A]"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <div className="flex items-center justify-between text-[10px]">
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox" checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-3.5 h-3.5 accent-[#C5A059] cursor-pointer"
                  />
                  <span className="text-[#4A4A3A] font-bold">تذكرني</span>
                </label>
                <button
                  type="button"
                  onClick={() => { setIsForgotMode(true); setForgotSent(false); setForgotEmail(signInEmail); setError(''); }}
                  className="text-[#8A8A70] hover:text-[#0A2342] font-bold underline"
                >
                  نسيت كلمة المرور؟
                </button>
              </div>

              <button
                type="submit" disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-[#C5A059] hover:bg-[#B28F4D] disabled:opacity-60 text-white text-sm font-black py-3 rounded-2xl shadow-lg transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>{loading ? 'جارٍ تسجيل الدخول...' : 'تسجيل الدخول ومتابعة الحجز'}</span>
              </button>
            </form>

            {/* 7 — Cross ornament divider — matches the arabesque motif
                on the mockup: leaf flourishes framing a small cross */}
            <div className="flex items-center justify-center gap-2 pt-2">
              <LeafFlourish className="w-8 h-3" />
              <CrossOrnament className="w-4 h-4" />
              <LeafFlourish className="w-8 h-3" flip />
            </div>

            {/* 8 — Create-account row */}
            <button
              type="button"
              onClick={() => { setIsRegisterMode(true); setError(''); }}
              className="w-full flex items-center justify-between gap-2 bg-white border border-[#EFE8D8] rounded-2xl p-3 hover:bg-[#FAF7F1] transition-colors"
            >
              <div className="w-9 h-9 rounded-full bg-[#FAF7F1] border border-[#EFE8D8] flex items-center justify-center shrink-0">
                <UserPlus className="w-4 h-4 text-[#C5A059]" strokeWidth={2.2} />
              </div>
              <div className="flex-1 text-center text-[11px]">
                <span className="text-[#8A8A70]">ليس لديك حساب؟ </span>
                <span className="text-[#C5A059] font-black">إنشاء حساب جديد</span>
              </div>
              <span className="w-9 shrink-0" aria-hidden />
            </button>
          </div>

          {/* 9 — Navy footer with 3 trust chips */}
          <div className="bg-[#0A2342] px-4 pt-4 pb-3 grid grid-cols-3 gap-3">
            <BottomChip icon={<ShieldCheck className="w-4 h-4 text-[#C5A059]" strokeWidth={2.2} />} label="حجوزات آمنة" sub="بياناتك محمية بالكامل" />
            <BottomChip icon={<Award className="w-4 h-4 text-[#C5A059]" strokeWidth={2.2} />} label="جودة موثوقة" sub="أفضل أماكن للإقامة" />
            <BottomChip icon={<Headphones className="w-4 h-4 text-[#C5A059]" strokeWidth={2.2} />} label="دعم على مدار الساعة" sub="نحن هنا لمساعدتك" />
          </div>
          <div className="bg-[#0A2342] text-center pb-3">
            <button
              type="button" onClick={() => setIsViewingPrivacy(true)}
              className="text-[9px] text-white/70 hover:text-white underline"
            >
              سياسة الخصوصية وشروط الاستخدام
            </button>
          </div>

        </div>
      </div>
    );
  }

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
        ) : (
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
        )}
        <div className="text-center pt-1">
          <button type="button" onClick={() => setIsViewingPrivacy(true)}
            className="text-[9px] text-[#8A8A70] hover:text-[#4A4A3A] underline">
            سياسة الخصوصية وشروط الاستخدام
          </button>
        </div>

      </div>
    </div>
  );
}
