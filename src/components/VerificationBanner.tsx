import React from 'react';
import { ShieldCheck, MessageCircle } from 'lucide-react';
import { supportWhatsAppUrl } from '../lib/support';

/**
 * The account-under-review notice, as a banner rather than a wall.
 *
 * A servant used to sign up, fill six fields, and land on a full-screen
 * «حسابك قيد المراجعة» with two options: WhatsApp, or log out. No browsing, no
 * prices, no houses. Which produced the perverse result that signing up made
 * the product *worse* — a logged-out visitor could see every house and price,
 * and a registered servant could see nothing.
 *
 * Verification still gates the thing it actually protects: money. An
 * unverified account can browse, compare and send a booking request; it cannot
 * pay a deposit. Nothing leaves the platform and no owner is committed until a
 * human has checked the ID, so the protection is unchanged — only its timing
 * moved, from the front door to the till.
 */
export default function VerificationBanner({ role }: { role: 'servant' | 'owner' }) {
  const blocked = role === 'owner'
    ? 'بيتك هيظهر للناس بعد الموافقة'
    : 'تقدر تتصفح وتطلب حجز — الدفع بس هو اللي مستني الموافقة';

  return (
    <div
      role="status"
      className="mx-3 mt-3 rounded-2xl border border-[#E3CD9F] bg-[#FBF6E9] px-3.5 py-3 flex items-start gap-2.5"
      dir="rtl"
    >
      <span className="w-8 h-8 rounded-xl bg-[#F1E4C3] flex items-center justify-center shrink-0">
        <ShieldCheck className="w-4 h-4 text-[#8A6A28]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11.5px] font-black text-[#0A2342] leading-snug">
          حسابك قيد التوثيق
        </p>
        <p className="text-[10.5px] font-medium text-[#6B6552] leading-relaxed mt-0.5">
          {blocked}. ابعت صورة بطاقتك (وش وضهر) على واتساب الدعم عشان نخلّص المراجعة.
        </p>
        <a
          href={supportWhatsAppUrl('سلام ونعمة، حابب أبعت صورة بطاقتي لتوثيق حسابي على بيما')}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 mt-1.5 text-[10.5px] font-black text-[#3A6B4C] hover:underline"
        >
          <MessageCircle className="w-3.5 h-3.5" />
          إرسال البطاقة على واتساب
        </a>
      </div>
    </div>
  );
}
