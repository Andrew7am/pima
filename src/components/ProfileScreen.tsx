import React, { useState } from 'react';
import { User } from '../types';
import { User as UserIcon, Phone, MapPin, Church, LogOut, Lock, HelpCircle, ChevronLeft, Trash2, ShieldCheck, Sparkles } from 'lucide-react';
import RewardsDashboard from './RewardsDashboard';

interface ProfileScreenProps {
  currentUser: User;
  onLogout: () => void;
  onBack: () => void;
  onNavigateSupport: () => void;
  onNavigatePrivacy: () => void;
  onNavigateEntertainment: () => void;
  onDeleteAccount: () => Promise<{ ok: boolean; error?: string }>;
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

function calculateAge(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const hasHadBirthdayThisYear =
    today.getMonth() > dob.getMonth() ||
    (today.getMonth() === dob.getMonth() && today.getDate() >= dob.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}

export default function ProfileScreen({ currentUser, onLogout, onBack, onNavigateSupport, onNavigatePrivacy, onNavigateEntertainment, onDeleteAccount }: ProfileScreenProps) {
  const roleLabel = currentUser.role === 'servant' ? 'خادم' : currentUser.role === 'owner' ? 'صاحب بيت' : 'مستخدم';
  const canSelfDelete = currentUser.role === 'individual' || currentUser.role === 'servant';

  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    setDeleteError('');
    const result = await onDeleteAccount();
    if (!result.ok) {
      setDeleteError('تعذر حذف الحساب. حاول مرة أخرى أو تواصل مع الدعم الفني.');
      setIsDeleting(false);
    }
    // On success, the auth session is cleared by the caller and this screen unmounts.
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

      {/* Personal info — read-only, locked after signup */}
      <div className="bg-white rounded-3xl p-4 border border-[#D6D6C2] shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-[#D6D6C2]/60 pb-2">
          <h3 className="text-xs font-black text-[#0A2342]">البيانات الشخصية</h3>
          <span className="text-[9px] font-bold text-[#8A8A70] flex items-center gap-1">
            <Lock className="w-3 h-3" /> غير قابلة للتعديل
          </span>
        </div>
        <p className="text-[9.5px] text-[#8A8A70] leading-relaxed -mt-1">
          هذه البيانات ثابتة بعد إنشاء الحساب لضمان مطابقتها لبطاقتك الشخصية. لتصحيح أي خطأ، تواصل مع الدعم الفني.
        </p>

        <div className="space-y-2 text-[11px]">
          <InfoRow icon={Phone} label="رقم الهاتف" value={currentUser.phone} />
          {currentUser.dateOfBirth && (
            <InfoRow icon={UserIcon} label="السن" value={`${calculateAge(currentUser.dateOfBirth)} سنة`} />
          )}
          {currentUser.governorate && (
            <InfoRow icon={MapPin} label="المحافظة" value={currentUser.governorate} />
          )}
          {currentUser.address && (
            <InfoRow icon={MapPin} label="العنوان بالكامل" value={currentUser.address} />
          )}
          {currentUser.churchName && (
            <InfoRow icon={Church} label="الكنيسة" value={`${currentUser.churchName}${currentUser.priestName ? ' — ' + currentUser.priestName : ''}`} />
          )}
          {currentUser.organizationName && <InfoRow icon={Church} label="الجهة" value={currentUser.organizationName} />}
        </div>
      </div>

      {/* Rewards & points, folded into Profile */}
      <RewardsDashboard currentUser={currentUser} onBack={onBack} />

      {/* Entertainment hub — solo trivia now, more games later */}
      <button
        onClick={onNavigateEntertainment}
        className="w-full flex items-center justify-between gap-2 bg-gradient-to-br from-[#132247] to-[#0A1732] border border-[#C5A059]/30 rounded-2xl p-3.5 hover:from-[#152A55] transition-colors cursor-pointer text-white shadow-md"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-amber-300" />
          </div>
          <div className="text-right leading-tight">
            <span className="block text-xs font-black">مركز الترفيه</span>
            <span className="block text-[9px] text-slate-300">ألعاب كتابية وتحديات روحية</span>
          </div>
        </div>
        <ChevronLeft className="w-4 h-4 text-amber-300" />
      </button>

      {/* Support entry point, folded into Profile instead of its own nav tab */}
      <button
        onClick={onNavigateSupport}
        className="w-full flex items-center justify-between gap-2 bg-white border border-[#D6D6C2] rounded-2xl p-3.5 hover:bg-[#FAF8F5] transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-[#5A5A40]" />
          <span className="text-xs font-bold text-[#4A4A3A]">التواصل والدعم الفني</span>
        </div>
        <ChevronLeft className="w-4 h-4 text-[#8A8A70]" />
      </button>

      <button
        onClick={onNavigatePrivacy}
        className="w-full flex items-center justify-between gap-2 bg-white border border-[#D6D6C2] rounded-2xl p-3.5 hover:bg-[#FAF8F5] transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#5A5A40]" />
          <span className="text-xs font-bold text-[#4A4A3A]">سياسة الخصوصية وشروط الاستخدام</span>
        </div>
        <ChevronLeft className="w-4 h-4 text-[#8A8A70]" />
      </button>

      <button
        onClick={onLogout}
        className="w-full flex items-center justify-center gap-2 text-xs font-bold text-red-500 hover:bg-red-50 border border-red-200 rounded-2xl py-3 transition-colors cursor-pointer"
      >
        <LogOut className="w-4 h-4" />
        <span>تسجيل الخروج</span>
      </button>

      {/* Danger zone: permanent account deletion */}
      <div className="bg-white rounded-3xl p-4 border border-red-200 shadow-sm space-y-3">
        <h3 className="text-xs font-black text-red-700 flex items-center gap-1.5">
          <Trash2 className="w-4 h-4" />
          حذف الحساب نهائياً
        </h3>

        {!canSelfDelete ? (
          <p className="text-[10px] text-[#8A8A70] leading-relaxed">
            حذف حسابات {currentUser.role === 'owner' ? 'أصحاب البيوت' : 'الإدارة'} يتم عبر الدعم الفني لضمان نقل بيانات الحجوزات المرتبطة بشكل آمن. تواصل معنا لطلب الحذف.
          </p>
        ) : !isConfirmingDelete ? (
          <>
            <p className="text-[10px] text-[#8A8A70] leading-relaxed">
              سيتم حذف حسابك وكل بياناتك (الحجوزات، التقييمات، النقاط) نهائياً ولا يمكن التراجع عن هذا الإجراء.
            </p>
            <button
              onClick={() => setIsConfirmingDelete(true)}
              className="w-full flex items-center justify-center gap-2 text-xs font-bold text-red-600 hover:bg-red-50 border border-red-300 rounded-2xl py-2.5 transition-colors cursor-pointer"
            >
              حذف حسابي نهائياً
            </button>
          </>
        ) : (
          <div className="space-y-3">
            <p className="text-[10px] text-red-700 font-bold leading-relaxed">
              هذا الإجراء نهائي ولا يمكن التراجع عنه. للتأكيد، اكتب كلمة "حذف" في الحقل بالأسفل.
            </p>
            {deleteError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-[10px] rounded-xl px-3 py-2 text-center">
                {deleteError}
              </div>
            )}
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder='اكتب "حذف" للتأكيد'
              className="w-full bg-white border border-red-300 rounded-xl py-2 px-3 text-xs text-[#4A4A3A] focus:outline-none text-center"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setIsConfirmingDelete(false); setDeleteConfirmText(''); setDeleteError(''); }}
                disabled={isDeleting}
                className="flex-1 text-xs font-bold text-[#4A4A3A] bg-[#EBEBE0] hover:bg-[#DEDECB] rounded-xl py-2.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                تراجع
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleteConfirmText !== 'حذف' || isDeleting}
                className="flex-1 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed rounded-xl py-2.5 transition-colors cursor-pointer"
              >
                {isDeleting ? 'جارٍ الحذف...' : 'تأكيد الحذف النهائي'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
