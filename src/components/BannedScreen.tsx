import React from 'react';
import { User } from '../types';
import { Ban, LogOut, MessageCircle } from 'lucide-react';
import Logo from './Logo';

interface BannedScreenProps {
  currentUser: User;
  onLogout: () => void;
}

export default function BannedScreen({ currentUser, onLogout }: BannedScreenProps) {
  return (
    <div className="min-h-screen bg-[#EBEBE0] flex items-center justify-center p-4 font-sans select-none antialiased text-right">
      <div className="w-full max-w-md bg-[#FDFBF7] rounded-[32px] border border-[#D6D6C2] shadow-2xl p-6 space-y-5 relative overflow-hidden text-[#4A4A3A] text-center">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-l from-rose-700 to-[#C5A059]" />

        <div className="pt-2 flex justify-center">
          <Logo variant="full" size={130} className="shadow-none border-none p-0 bg-transparent" />
        </div>

        <div className="mx-auto w-14 h-14 rounded-full flex items-center justify-center bg-rose-50">
          <Ban className="w-7 h-7 text-rose-600" />
        </div>

        <div className="space-y-1.5">
          <h2 className="text-sm font-bold text-[#4A4A3A]">تم إيقاف حسابك</h2>
          <p className="text-[11px] text-[#8A8A70] leading-relaxed">
            نأسف يا {currentUser.name}، تم إيقاف حسابك عن استخدام المنصة من قبل الإدارة.
            لو تعتقد أن هذا حدث بالخطأ، تواصل مع الدعم الفني.
          </p>
        </div>

        <a
          href="https://wa.me/201234567890?text=سلام%20ونعمة%2C%20حسابي%20على%20بيما%20متوقف%20وأريد%20الاستفسار"
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-bold py-2.5 hover:bg-emerald-100 transition-colors"
        >
          <MessageCircle className="w-4 h-4" />
          <span>تواصل مع الدعم</span>
        </a>

        <button
          onClick={onLogout}
          className="mx-auto flex items-center gap-2 text-xs text-red-500 hover:bg-red-50 rounded-lg py-2 px-4 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </div>
  );
}
