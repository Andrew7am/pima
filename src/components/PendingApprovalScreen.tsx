import React from 'react';
import { User } from '../types';
import { Clock, XCircle, LogOut } from 'lucide-react';
import Logo from './Logo';

interface PendingApprovalScreenProps {
  currentUser: User;
  onLogout: () => void;
}

export default function PendingApprovalScreen({ currentUser, onLogout }: PendingApprovalScreenProps) {
  const isRejected = currentUser.approvalStatus === 'rejected';

  return (
    <div className="min-h-screen bg-[#EBEBE0] flex items-center justify-center p-4 font-sans select-none antialiased text-right">
      <div className="w-full max-w-md bg-[#FDFBF7] rounded-[32px] border border-[#D6D6C2] shadow-2xl p-6 space-y-5 relative overflow-hidden text-[#4A4A3A] text-center">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-l from-[#0A2342] to-[#C5A059]" />

        <div className="pt-2 flex justify-center">
          <Logo variant="full" size={130} className="shadow-none border-none p-0 bg-transparent" />
        </div>

        <div className={`mx-auto w-14 h-14 rounded-full flex items-center justify-center ${isRejected ? 'bg-rose-50' : 'bg-amber-50'}`}>
          {isRejected ? <XCircle className="w-7 h-7 text-rose-600" /> : <Clock className="w-7 h-7 text-amber-600" />}
        </div>

        {isRejected ? (
          <div className="space-y-1.5">
            <h2 className="text-sm font-bold text-[#4A4A3A]">تعذرت الموافقة على حسابك</h2>
            <p className="text-[11px] text-[#8A8A70] leading-relaxed">
              نأسف يا {currentUser.name}، لم تتم الموافقة على حسابك حالياً. تواصل مع الدعم الفني لمزيد من التفاصيل.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <h2 className="text-sm font-bold text-[#4A4A3A]">حسابك قيد المراجعة</h2>
            <p className="text-[11px] text-[#8A8A70] leading-relaxed">
              أهلاً بك يا {currentUser.name}! بياناتك وصورة بطاقتك وصلت بنجاح، وفريقنا بيراجع حسابك دلوقتي.
              هتقدر تستخدم المنصة بمجرد الموافقة عليه من الإدارة.
            </p>
          </div>
        )}

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
