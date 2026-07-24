import React from 'react';
import { MapPin, Shield, Star, Users, ChevronLeft, Home, Calendar, MessageCircle } from 'lucide-react';
import AdSlot from './AdSlot';

interface LandingPageProps {
  onBrowse: () => void;
  onLogin: () => void;
  housesCount: number;
}

export default function LandingPage({ onBrowse, onLogin, housesCount }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-[#FBFBFA] overflow-x-hidden" dir="rtl">
      {/* Hero */}
      <section className="relative bg-gradient-to-bl from-[#3A6B4C] via-[#4A7C5C] to-[#2D5A3F] text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 right-10 w-72 h-72 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute bottom-10 left-10 w-56 h-56 rounded-full bg-white/15 blur-2xl" />
        </div>
        <nav className="relative z-10 flex items-center justify-between px-4 sm:px-8 py-4 max-w-6xl mx-auto">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center text-lg font-black">ب</div>
            <span className="text-lg font-black tracking-tight">بيما</span>
          </div>
          <button onClick={onLogin} className="bg-white/15 hover:bg-white/25 backdrop-blur border border-white/20 text-white text-[11px] font-bold px-4 py-1.5 rounded-xl transition-all">
            تسجيل الدخول
          </button>
        </nav>
        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-8 pt-8 pb-16 sm:pt-12 sm:pb-24 text-center">
          <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-4">
            احجز بيت مؤتمراتك<br />
            <span className="text-emerald-200">في ثوانٍ</span>
          </h1>
          <p className="text-white/80 text-sm sm:text-base max-w-lg mx-auto mb-8 leading-relaxed">
            أكبر منصة لحجز بيوت المؤتمرات والخلوات القبطية في مصر.
            {housesCount > 0 && <> تصفّح <strong className="text-white">{housesCount}+</strong> بيت مؤتمرات بأسعار واضحة وتقييمات حقيقية.</>}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button onClick={onBrowse} className="bg-white text-[#3A6B4C] font-black text-sm px-8 py-3 rounded-2xl hover:bg-emerald-50 transition-all shadow-lg hover:shadow-xl hover:scale-[1.02] flex items-center gap-2">
              <span>ابدأ التصفح مجاناً</span>
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={onLogin} className="border border-white/30 text-white font-bold text-sm px-8 py-3 rounded-2xl hover:bg-white/10 transition-all">
              إنشاء حساب
            </button>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#FBFBFA] to-transparent" />
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-4 sm:px-8 py-12 sm:py-20">
        <h2 className="text-xl sm:text-2xl font-black text-[#2D2D1F] text-center mb-10">ليه بيما؟</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Home, title: 'بيوت مؤتمرات متنوعة', desc: 'خلوات، مصايف، سكن طلبة — كل الخيارات في مكان واحد.' },
            { icon: Calendar, title: 'حجز فوري', desc: 'اختار التاريخ والعدد واحجز في دقيقة. بدون مكالمات أو انتظار.' },
            { icon: Star, title: 'تقييمات حقيقية', desc: 'كل بيت عليه تقييمات من خدام ومؤتمرات سابقة تساعدك تختار.' },
            { icon: Shield, title: 'أسعار شفافة', desc: 'شوف السعر الإجمالي قبل ما تحجز. بدون مفاجآت أو رسوم مخفية.' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-white border border-[#D6D6C2]/50 rounded-2xl p-5 hover:shadow-md transition-shadow">
              <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center mb-3">
                <Icon className="w-5 h-5 text-[#3A6B4C]" />
              </div>
              <h3 className="font-black text-[13px] text-[#2D2D1F] mb-1">{title}</h3>
              <p className="text-[11px] text-[#8A8A70] leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-[#F0F0E6] py-12 sm:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-8">
          <h2 className="text-xl sm:text-2xl font-black text-[#2D2D1F] text-center mb-10">إزاي تحجز؟</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { step: '1', icon: MapPin, title: 'تصفّح البيوت', desc: 'ابحث بالمحافظة أو التاريخ أو نوع البيت واختار اللي يناسبك.' },
              { step: '2', icon: Users, title: 'حدد التفاصيل', desc: 'اختار تاريخ الوصول والمغادرة وعدد الأفراد وشوف السعر الإجمالي.' },
              { step: '3', icon: MessageCircle, title: 'أكّد الحجز', desc: 'قدّم طلب الحجز وتواصل مع صاحب البيت مباشرة من داخل التطبيق.' },
            ].map(({ step, icon: Icon, title, desc }) => (
              <div key={step} className="text-center">
                <div className="w-14 h-14 bg-[#3A6B4C] text-white rounded-2xl flex items-center justify-center mx-auto mb-4 text-xl font-black shadow-lg">
                  {step}
                </div>
                <h3 className="font-black text-[13px] text-[#2D2D1F] mb-1">{title}</h3>
                <p className="text-[11px] text-[#8A8A70] leading-relaxed max-w-[220px] mx-auto">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For Owners */}
      <section className="max-w-5xl mx-auto px-4 sm:px-8 py-12 sm:py-20">
        <div className="bg-gradient-to-bl from-[#3A6B4C] to-[#2D5A3F] rounded-3xl p-6 sm:p-10 text-white text-center">
          <h2 className="text-xl sm:text-2xl font-black mb-3">عندك بيت مؤتمرات؟</h2>
          <p className="text-white/80 text-[12px] sm:text-sm max-w-md mx-auto mb-6 leading-relaxed">
            سجّل بيتك على بيما مجاناً واوصل لآلاف الخدام والكنائس. لوحة تحكم متكاملة لإدارة الحجوزات والغرف والتقييمات.
          </p>
          <button onClick={onLogin} className="bg-white text-[#3A6B4C] font-black text-sm px-8 py-3 rounded-2xl hover:bg-emerald-50 transition-all shadow-lg">
            سجّل بيتك الآن
          </button>
        </div>
      </section>

      {/* Display ad (public content page — policy-compliant). No-ops until AdSense is configured. */}
      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-2">
        <AdSlot slot="landing_display" />
      </div>

      {/* Footer */}
      <footer className="border-t border-[#D6D6C2]/50 bg-[#F5F5ED] py-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] text-[#8A8A70]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[#3A6B4C] rounded-lg flex items-center justify-center text-white text-[10px] font-black">ب</div>
            <span className="font-bold text-[#2D2D1F]">بيما</span>
            <span>— بيوت الخلوات والمصايف</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="/dalil/" className="hover:text-[#3A6B4C] transition-colors">الدليل والنصائح</a>
            <a href="https://wa.me/201234567890" target="_blank" rel="noreferrer" className="hover:text-[#3A6B4C] transition-colors">تواصل معنا</a>
            <span>© {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
