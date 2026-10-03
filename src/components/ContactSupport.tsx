import React from 'react';
import { supportWhatsAppUrl, supportWhatsAppNumber, SUPPORT_EMAIL, SUPPORT_PHONES } from '../lib/support';
import {
  Phone, Mail, Facebook, Instagram, MessageCircle, ShieldCheck, HeartHandshake, ChevronRight
} from 'lucide-react';

interface ContactSupportProps {
  // Still passed by App; unused since the screen stopped pre-filling a form.
  currentUser: {
    name: string;
    phone: string;
    email: string;
  };
  onBack?: () => void;
}

// What the WhatsApp chat opens with when someone reports a problem or sends an idea.
const REPORT_MESSAGE = 'سلام ونعمة، عندي مشكلة أو اقتراح بخصوص تطبيق بيما: ';

export default function ContactSupport({ onBack }: ContactSupportProps) {
  return (
    <div className="space-y-4 pb-12 text-right text-[var(--ds-text)]" dir="rtl">

      {onBack && (
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--ds-text-2)] hover:text-[var(--ds-text)] transition-colors cursor-pointer"
        >
          <ChevronRight className="w-3.5 h-3.5" />
          <span>رجوع لحسابي</span>
        </button>
      )}

      {/* Title & Brand Intro */}
      <div className="bg-[var(--ds-surface)] rounded-3xl p-5 border border-[var(--ds-border)] shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-l from-[var(--ds-brand)] to-[var(--ds-accent)]" />
        
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-[var(--ds-brand)]/10 rounded-2xl">
            <HeartHandshake className="w-6 h-6 text-[var(--ds-brand)]" />
          </div>
          <div>
            <h1 className="text-sm font-extrabold text-[var(--ds-brand)]">التواصل والدعم الفني وخدمة عملاء بيما</h1>
            <p className="text-[10px] text-[var(--ds-text-2)] font-bold">نسعد بخدمتكم وتلقي آرائكم واستفساراتكم</p>
          </div>
        </div>
        <p className="text-xs text-[var(--ds-text)] leading-relaxed mt-2 font-medium">
          يسعى فريق خدمة «بيما | PiMa» لتقديم أفضل تجربة لتنسيق خلوات ومؤتمرات الكنيسة القبطية. إذا كنت تواجه مشكلة أو تود تقديم اقتراح لخدمة الكنيسة بشكل أفضل، تواصل معنا فوراً!
        </p>
      </div>

      {/* Grid: Call Support & Social Medias */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Contact info Box */}
        <div className="bg-[var(--ds-surface)] rounded-3xl p-5 border border-[var(--ds-border)] shadow-sm space-y-4">
          <div className="border-b border-[var(--ds-border)]/40 pb-2">
            <h2 className="text-xs font-black text-[var(--ds-brand)]">قنوات التواصل المباشر</h2>
            <p className="text-[9px] text-[var(--ds-text-2)] font-bold">ابعتلنا على واتساب وفريق الدعم هيرد عليك</p>
          </div>

          {/* WhatsApp is the one channel with a confirmed number — the admin sets it
              in platform settings. Phone lines and an email appear here only once
              they are filled in SUPPORT_PHONES / SUPPORT_EMAIL (lib/support). */}
          <div className="space-y-2.5">
            <a
              href={supportWhatsAppUrl()}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between p-3 rounded-2xl bg-[var(--ds-surface)] border border-[var(--ds-border)]/60 hover:border-[var(--ds-accent)] transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100 group-hover:bg-emerald-100">
                  <MessageCircle className="w-4 h-4" />
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-[var(--ds-text-2)] font-bold block leading-none">واتساب الدعم الفني وخدمة العملاء</span>
                  <span className="text-xs font-black text-[var(--ds-brand)] mt-1 block tracking-wider" dir="ltr">+{supportWhatsAppNumber()}</span>
                </div>
              </div>
              <span className="text-[9px] bg-emerald-100 text-emerald-800 font-extrabold px-2.5 py-1 rounded-xl group-hover:scale-105 transition-all">راسلنا</span>
            </a>

            {SUPPORT_PHONES.map((p) => (
              <a
                key={p.tel}
                href={`tel:${p.tel}`}
                className="flex items-center justify-between p-3 rounded-2xl bg-[var(--ds-surface)] border border-[var(--ds-border)]/60 hover:border-[var(--ds-accent)] transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-100 group-hover:bg-blue-100">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-[var(--ds-text-2)] font-bold block leading-none">{p.label}</span>
                    <span className="text-xs font-black text-[var(--ds-brand)] mt-1 block tracking-wider" dir="ltr">{p.display}</span>
                  </div>
                </div>
                <span className="text-[9px] bg-blue-100 text-blue-800 font-extrabold px-2.5 py-1 rounded-xl group-hover:scale-105 transition-all">اتصل الآن 📞</span>
              </a>
            ))}

            {SUPPORT_EMAIL && (
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-[var(--ds-surface)] border border-[var(--ds-border)]/60">
                <div className="w-9 h-9 rounded-xl bg-[var(--ds-brand)]/5 text-[var(--ds-brand)] flex items-center justify-center border border-[var(--ds-brand)]/10">
                  <Mail className="w-4 h-4" />
                </div>
                <div className="text-right flex-1">
                  <span className="text-[10px] text-[var(--ds-text-2)] font-bold block leading-none">البريد الإلكتروني الرسمي للمنصة</span>
                  <span className="text-xs font-black text-[var(--ds-brand)] mt-1 block tracking-normal select-all" dir="ltr">{SUPPORT_EMAIL}</span>
                </div>
              </div>
            )}
          </div>

          {/* Social Platforms */}
          <div className="pt-2">
            <span className="block text-[10px] font-extrabold text-[var(--ds-text-2)] mb-2.5">تابعونا على مواقع التواصل الاجتماعي:</span>
            <div className="grid grid-cols-3 gap-2">
              {/* WhatsApp direct link */}
              <a 
                href={supportWhatsAppUrl()}
                target="_blank" 
                rel="noreferrer" 
                className="flex items-center justify-center gap-1.5 p-2 rounded-xl border border-[var(--ds-border)]/50 hover:border-emerald-500 bg-emerald-50/20 text-emerald-800 text-[10px] font-extrabold transition-all hover:bg-emerald-50"
              >
                <MessageCircle className="w-4 h-4 text-emerald-600" />
                <span>واتساب</span>
              </a>

              {/* Facebook */}
              <a
                href="https://www.facebook.com/share/1F27QZY4xR/?mibextid=wwXIfr"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1.5 p-2 rounded-xl border border-[var(--ds-border)]/50 hover:border-blue-600 bg-blue-50/20 text-blue-800 text-[10px] font-extrabold transition-all hover:bg-blue-50"
              >
                <Facebook className="w-4 h-4 text-blue-600" />
                <span>فيسبوك</span>
              </a>

              {/* Instagram */}
              <a
                href="https://www.instagram.com/pima_app?igsh=Zzh2YmxsbWs5Nm82&utm_source=qr"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1.5 p-2 rounded-xl border border-[var(--ds-border)]/50 hover:border-pink-600 bg-pink-50/20 text-pink-800 text-[10px] font-extrabold transition-all hover:bg-pink-50"
              >
                <Instagram className="w-4 h-4 text-pink-600" />
                <span>إنستجرام</span>
              </a>
            </div>
          </div>
        </div>

        {/* About App Box */}
        <div className="bg-[var(--ds-surface)] rounded-3xl p-5 border border-[var(--ds-border)] shadow-sm space-y-3.5 flex flex-col justify-between">
          <div>
            <div className="border-b border-[var(--ds-border)]/40 pb-2 mb-3">
              <h2 className="text-xs font-black text-[var(--ds-brand)]">حول التطبيق والخدمة</h2>
              <p className="text-[9px] text-[var(--ds-text-2)] font-bold">تعرّف على بيما</p>
            </div>

            <p className="text-xs text-[var(--ds-text)] leading-relaxed font-medium">
              تطبيق <strong className="text-[var(--ds-brand)] font-black">بيما | PiMa</strong> هو النظام الرقمي الأول لتصفح وإدارة بيوت المؤتمرات والفنادق والمغتربين للمسيحيين بمصر. يهدف لتخفيف التعب الملقى على عاتق أمناء الخدمة والآباء الكهنة في البحث عن الخلوات المناسبة لأسرهم واجتماعاتهم بمختلف المحافظات.
            </p>
          </div>

          <div className="bg-[var(--ds-surface)] border border-[var(--ds-border)]/80 rounded-2xl p-3 space-y-1.5 text-xs">
            <div className="flex justify-between items-center text-[10.5px]">
              <span className="text-[var(--ds-text-2)] font-bold">اسم التطبيق:</span>
              <span className="text-[var(--ds-brand)] font-extrabold">بيما | PiMa لبيوت المؤتمرات</span>
            </div>
            <div className="flex justify-between items-center text-[10.5px] border-t border-[var(--ds-border)]/40 pt-1.5 mt-1.5">
              <span className="text-[var(--ds-text-2)] font-bold">المطور التقني:</span>
              <span className="text-[var(--ds-brand)] font-black flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[var(--ds-accent)]" />
                <span>خدمة بيوت المؤتمرات القبطية</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Report a problem or send an idea. There is no ticket system behind this
          screen, so it does not pretend to be one: it hands the person to the same
          support WhatsApp every other "contact us" in the app uses. */}
      <div className="bg-[var(--ds-surface)] rounded-3xl p-5 border border-[var(--ds-border)] shadow-md relative overflow-hidden space-y-3">
        <div className="absolute top-0 right-0 h-1 bg-[var(--ds-accent)] w-32" />

        <div className="border-b border-[var(--ds-border)]/40 pb-2.5">
          <h2 className="text-xs font-black text-[var(--ds-brand)]">إبلاغ عن مشكلة أو إرسال اقتراح</h2>
          <p className="text-[9px] text-[var(--ds-text-2)] font-bold">مساحتك لإبداء رأيك أو الإبلاغ عن مشكلة تواجهك في التطبيق</p>
        </div>

        <p className="text-xs text-[var(--ds-text)] leading-relaxed font-medium">
          ابعت لفريق الدعم على واتساب واكتب المشكلة أو الاقتراح بالتفصيل. ولو المشكلة في حجز معيّن، اذكر اسم البيت وتاريخ الحجز علشان نقدر نساعدك أسرع.
        </p>

        <a
          id="support-report-whatsapp"
          href={supportWhatsAppUrl(REPORT_MESSAGE)}
          target="_blank"
          rel="noreferrer"
          className="w-full bg-[var(--ds-brand)] hover:opacity-90 text-[var(--ds-on-brand)] min-h-11 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
        >
          <MessageCircle className="w-4 h-4 text-[var(--ds-accent)]" />
          <span>راسل الدعم الفني على واتساب</span>
        </a>
      </div>
    </div>
  );
}
