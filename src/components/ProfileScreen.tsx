import React, { useEffect, useState } from 'react';
import { User, Booking, Review, RetreatHouse } from '../types';
import {
  User as UserIcon, Phone, MapPin, Church, LogOut, Lock, HelpCircle, ChevronLeft,
  Trash2, ShieldCheck, Camera, Coins, Award, CalendarCheck, ChevronRight, Copy, Check, Mail, Bell,
} from 'lucide-react';
import RewardsDashboard from './RewardsDashboard';
import PhotoPickerButtons from './PhotoPickerButtons';
import { setEmailOptOut } from '../lib/db';
import WebPushToggle from './WebPushToggle';

interface ProfileScreenProps {
  currentUser: User;
  onLogout: () => void;
  onBack: () => void;
  onNavigateSupport: () => void;
  onNavigatePrivacy: () => void;
  onDeleteAccount: () => Promise<{ ok: boolean; error?: string }>;
  onUpdateAvatar: (avatarUrl: string) => void;
  bookings?: Booking[];
  reviews?: Review[];
  houses?: RetreatHouse[];
  onNavigateBookings?: () => void;
  /** Which sub-view to land on. The home screen's loyalty card sends
   *  'rewards' so it opens the programme itself rather than this hub. */
  initialView?: 'hub' | 'rewards';
  /** Called once the initial view has been taken, so the caller can clear it
   *  and a later visit through the nav lands on the hub as usual. */
  onInitialViewConsumed?: () => void;
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

// Loyalty tier for the profile stat — mirrors the ladder in RewardsDashboard
// (فضي ٥٬٠٠٠ / ذهبي ١٠٬٠٠٠ / ماسي ٢٠٬٠٠٠+). Display-only: the server's earn
// triggers know nothing about tiers.
function tierFor(points: number): { name: string; emoji: string } {
  if (points >= 20000) return { name: 'ماسي', emoji: '💎' };
  if (points >= 10000) return { name: 'ذهبي', emoji: '🥇' };
  if (points >= 5000) return { name: 'فضي', emoji: '🥈' };
  return { name: 'برونزي', emoji: '🥉' };
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 bg-[#FDFBF7] p-3 rounded-2xl border border-[#D6D6C2]/50">
      <span className="w-8 h-8 rounded-xl bg-[#0A2342]/5 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-[#5A5A40]" />
      </span>
      <div className="min-w-0 pt-0.5">
        <span className="text-[9.5px] text-[#8A8A70] font-bold block mb-0.5">{label}</span>
        <span className="font-bold text-[#4A4A3A] text-[12.5px] leading-snug break-words">{value}</span>
      </div>
    </div>
  );
}

function SettingsRow({ icon: Icon, label, sublabel, onClick, tint = '#5A5A40', badge }: {
  icon: React.ElementType; label: string; sublabel?: string; onClick: () => void; tint?: string; badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 bg-white hover:bg-[#FAF8F5] active:scale-[0.99] px-3.5 py-3 transition-all cursor-pointer text-right"
    >
      <span className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${tint}14` }}>
        <Icon className="w-[18px] h-[18px]" style={{ color: tint }} />
      </span>
      <div className="flex-1 min-w-0">
        <span className="text-[13px] font-bold text-[#2E2E24] block truncate">{label}</span>
        {sublabel && <span className="text-[10px] text-[#8A8A70] font-medium block truncate">{sublabel}</span>}
      </div>
      {badge != null && badge > 0 && (
        <span className="min-w-[18px] h-[18px] px-1.5 bg-rose-500 text-white text-[9.5px] font-black rounded-full flex items-center justify-center">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
      <ChevronLeft className="w-4 h-4 text-[#B8B8A0] shrink-0" />
    </button>
  );
}

// Same visual language as SettingsRow, but the control is a switch rather than
// a navigation chevron.
function ToggleRow({ icon: Icon, label, sublabel, checked, onChange, tint = '#5A5A40', busy, disabled }: {
  icon: React.ElementType; label: string; sublabel?: string;
  checked: boolean; onChange: (next: boolean) => void; tint?: string; busy?: boolean;
  /** Set when the switch cannot act at all — a browser that has denied
   *  notifications can only be changed from its own site settings. */
  disabled?: boolean;
}) {
  return (
    <div className="w-full flex items-center gap-3 bg-white px-3.5 py-3 text-right">
      <span className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${tint}14` }}>
        <Icon className="w-[18px] h-[18px]" style={{ color: tint }} />
      </span>
      <div className="flex-1 min-w-0">
        <span className="text-[13px] font-bold text-[#2E2E24] block truncate">{label}</span>
        {sublabel && <span className="text-[10px] text-[#8A8A70] font-medium block truncate">{sublabel}</span>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={busy || disabled}
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 disabled:opacity-50 cursor-pointer ${checked ? 'bg-[#2E7D5B]' : 'bg-[#D6D6C2]'}`}
      >
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${checked ? 'right-0.5' : 'right-[22px]'}`} />
      </button>
    </div>
  );
}

// Module scope, alongside the other row components above, on purpose: declared
// inside the render body this would be a new component type on every render and
// React would remount the avatar — reloading the image — instead of updating it.
function Avatar({ user, size, onClick }: { user: User; size: number; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="relative rounded-full bg-[#C5A059] text-[#0A2342] flex items-center justify-center font-black shrink-0 overflow-hidden ring-4 ring-white/15 shadow-lg disabled:cursor-default cursor-pointer"
      style={{ width: size, height: size, fontSize: size / 2.6 }}
    >
      {user.avatarUrl ? (
        <img src={user.avatarUrl} alt="صورتك الشخصية" className="w-full h-full object-cover" />
      ) : (
        user.name.charAt(0)
      )}
      {onClick && (
        <span className="absolute bottom-0 inset-x-0 bg-black/45 backdrop-blur-sm flex items-center justify-center py-1">
          <Camera className="w-3.5 h-3.5 text-white" />
        </span>
      )}
    </button>
  );
}

export default function ProfileScreen({
  currentUser, onLogout, onBack, onNavigateSupport, onNavigatePrivacy, onDeleteAccount, onUpdateAvatar, reviews, houses,
  bookings = [], onNavigateBookings, initialView = 'hub', onInitialViewConsumed,
}: ProfileScreenProps) {
  const roleLabel = currentUser.role === 'servant' ? 'خادم' : currentUser.role === 'owner' ? 'صاحب بيت' : 'مستخدم';
  const canSelfDelete = currentUser.role === 'individual' || currentUser.role === 'servant';

  // Read once, on mount: this screen unmounts when you navigate away, so each
  // arrival re-reads whichever entry point sent you here.
  const [view, setView] = useState<'hub' | 'personal' | 'rewards'>(initialView);
  useEffect(() => {
    // Tell the caller the request has been honoured. Doing this on mount (not
    // on unmount) means a later tap on حسابي in the nav is already back to the
    // hub — the deep link fires once, not for every visit that follows.
    if (initialView !== 'hub') onInitialViewConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [copied, setCopied] = useState(false);
  // Stored as an opt-OUT server-side; shown as an opt-IN switch, which is what
  // a user expects to see next to "email notifications".
  const [emailsOn, setEmailsOn] = useState(!currentUser.emailOptOut);
  const [emailBusy, setEmailBusy] = useState(false);

  const handleToggleEmails = async (next: boolean) => {
    setEmailBusy(true);
    setEmailsOn(next); // optimistic
    const settled = await setEmailOptOut(!next);
    if (settled === null) setEmailsOn(!next); // revert on failure
    setEmailBusy(false);
  };

  const points = currentUser.points || 0;
  const tier = tierFor(points);
  const activeBookings = bookings.filter(
    (b) => b.userId === currentUser.id && b.status !== 'rejected' && b.status !== 'cancelled',
  ).length;

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

  const handleCopyReferral = () => {
    if (!currentUser.referralCode) return;
    navigator.clipboard?.writeText(currentUser.referralCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };


  // ── Rewards sub-view ─────────────────────────────────────────────
  if (view === 'rewards') {
    return (
      <div className="animate-in fade-in slide-in-from-left-2 duration-200 pb-8">
        <RewardsDashboard
          currentUser={currentUser}
          onBack={() => setView('hub')}
          bookings={bookings}
          reviews={reviews}
          houses={houses}
          onNavigateBookings={onNavigateBookings}
        />
      </div>
    );
  }

  // ── Personal-data sub-view (opened from the profile photo) ───────
  if (view === 'personal') {
    return (
      <div className="space-y-4 text-right animate-in fade-in slide-in-from-left-2 duration-200 pb-10">
        {/* Header */}
        <div className="flex items-center gap-2 pb-1">
          <button aria-label="رجوع"
            onClick={() => { setView('hub'); setIsConfirmingDelete(false); }}
            className="p-1.5 rounded-xl border border-[#D6D6C2] bg-white hover:bg-[#EBEBE0]/50 text-[#4A4A3A] transition-all cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <h2 className="text-sm font-black text-[#0A2342]">البيانات الشخصية</h2>
        </div>

        {/* Avatar + change photo */}
        <div className="bg-gradient-to-br from-[#0A2342] to-[#123E75] text-white rounded-3xl p-6 flex flex-col items-center gap-3 relative overflow-hidden">
          <div className="absolute -top-10 -left-10 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-12 -right-8 w-32 h-32 bg-[#C5A059]/10 rounded-full blur-2xl pointer-events-none" />
          <Avatar user={currentUser} size={92} />
          <div className="text-center">
            <h3 className="text-base font-black">{currentUser.name}</h3>
            <p className="text-[10.5px] text-slate-300">{currentUser.email}</p>
          </div>
          <div className="w-full max-w-[260px] pt-1">
            <PhotoPickerButtons idPrefix="profile-avatar" onSelect={(dataUrl) => onUpdateAvatar(dataUrl)} />
          </div>
        </div>

        {/* Locked personal info */}
        <div className="bg-white rounded-3xl p-4 border border-[#D6D6C2] shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-[#D6D6C2]/60 pb-2">
            <h3 className="text-xs font-black text-[#0A2342]">بيانات التسجيل</h3>
            <span className="text-[9px] font-bold text-[#8A8A70] flex items-center gap-1">
              <Lock className="w-3 h-3" /> غير قابلة للتعديل
            </span>
          </div>
          <p className="text-[9.5px] text-[#8A8A70] leading-relaxed -mt-1">
            هذه البيانات ثابتة بعد إنشاء الحساب لضمان مطابقتها لبطاقتك الشخصية. لتصحيح أي خطأ، تواصل مع الدعم الفني.
          </p>
          <div className="space-y-2">
            <InfoRow icon={Phone} label="رقم الهاتف" value={currentUser.phone} />
            {currentUser.dateOfBirth && (
              <InfoRow icon={UserIcon} label="السن" value={`${calculateAge(currentUser.dateOfBirth)} سنة`} />
            )}
            {currentUser.governorate && <InfoRow icon={MapPin} label="المحافظة" value={currentUser.governorate} />}
            {currentUser.address && <InfoRow icon={MapPin} label="العنوان بالكامل" value={currentUser.address} />}
            {currentUser.churchName && (
              <InfoRow icon={Church} label="الكنيسة" value={`${currentUser.churchName}${currentUser.priestName ? ' — ' + currentUser.priestName : ''}`} />
            )}
            {currentUser.organizationName && <InfoRow icon={Church} label="الجهة" value={currentUser.organizationName} />}
          </div>
        </div>

        {/* Danger zone — moved here, out of the main account hub */}
        {canSelfDelete ? (
          <div className="bg-white rounded-3xl p-4 border border-red-200 shadow-sm space-y-3">
            <h3 className="text-xs font-black text-red-700 flex items-center gap-1.5">
              <Trash2 className="w-4 h-4" /> حذف الحساب نهائياً
            </h3>
            {!isConfirmingDelete ? (
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
                  <div className="bg-red-50 border border-red-200 text-red-700 text-[10px] rounded-xl px-3 py-2 text-center">{deleteError}</div>
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
        ) : (
          <div className="bg-white rounded-3xl p-4 border border-[#D6D6C2] shadow-sm">
            <p className="text-[10px] text-[#8A8A70] leading-relaxed">
              حذف حسابات {currentUser.role === 'owner' ? 'أصحاب البيوت' : 'الإدارة'} يتم عبر الدعم الفني لضمان نقل بيانات الحجوزات المرتبطة بشكل آمن. تواصل معنا لطلب الحذف.
            </p>
          </div>
        )}
      </div>
    );
  }

  // ── Account hub (main) ───────────────────────────────────────────
  const stats = [
    { key: 'points', icon: Coins, tint: '#C5A059', value: points.toLocaleString('ar-EG'), label: 'نقطة', onClick: () => setView('rewards') },
    { key: 'tier', icon: Award, tint: '#123E75', value: `${tier.emoji}`, label: tier.name, onClick: () => setView('rewards') },
    { key: 'bookings', icon: CalendarCheck, tint: '#5A5A40', value: activeBookings.toLocaleString('ar-EG'), label: 'حجز', onClick: onNavigateBookings },
  ];

  return (
    <div className="space-y-4 text-right animate-in fade-in duration-200 pb-10">
      {/* Hero — avatar is the entry to personal data */}
      <div className="bg-gradient-to-br from-[#0A2342] to-[#123E75] text-white rounded-3xl p-6 flex flex-col items-center gap-3 relative overflow-hidden">
        <div className="absolute -top-10 -left-10 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-8 w-36 h-36 bg-[#C5A059]/10 rounded-full blur-2xl pointer-events-none" />
        <Avatar user={currentUser} size={92} onClick={() => setView('personal')} />
        <div className="text-center">
          <h2 className="text-base font-black">{currentUser.name}</h2>
          <p className="text-[10.5px] text-slate-300 mt-0.5">{currentUser.email}</p>
          <span className="inline-block mt-2 text-[9.5px] font-bold bg-white/10 border border-white/15 px-3 py-1 rounded-full">{roleLabel}</span>
        </div>
        <button
          onClick={() => setView('personal')}
          className="mt-1 text-[10.5px] font-bold text-[#C5A059] hover:text-[#d8b877] flex items-center gap-1 transition-colors cursor-pointer"
        >
          <Camera className="w-3.5 h-3.5" /> اضغط على صورتك لعرض بياناتك وتعديل صورتك
        </button>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-2.5">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.key}
              onClick={s.onClick}
              disabled={!s.onClick}
              className="bg-white border border-[#D6D6C2] rounded-2xl p-3 flex flex-col items-center gap-1 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer disabled:cursor-default disabled:hover:translate-y-0 disabled:hover:shadow-sm"
            >
              <span className="w-8 h-8 rounded-xl flex items-center justify-center mb-0.5" style={{ backgroundColor: `${s.tint}16` }}>
                <Icon className="w-4 h-4" style={{ color: s.tint }} />
              </span>
              <span className="text-base font-black text-[#2E2E24] leading-none">{s.value}</span>
              <span className="text-[9.5px] font-bold text-[#8A8A70]">{s.label}</span>
            </button>
          );
        })}
      </div>

      {/* Referral code — a small, self-contained perk card */}
      {currentUser.referralCode && (
        <div className="bg-gradient-to-l from-[#FDFBF7] to-[#F3EFE4] border border-[#E3D9BF] rounded-2xl p-3.5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="text-[10px] font-bold text-[#8A8A70] block">كود دعوة أصدقائك</span>
            <span className="text-sm font-black text-[#0A2342] tracking-wider" dir="ltr">{currentUser.referralCode}</span>
          </div>
          <button
            onClick={handleCopyReferral}
            className="flex items-center gap-1 text-[11px] font-bold text-[#0A2342] bg-white border border-[#E3D9BF] hover:bg-[#FAF8F5] px-3 py-2 rounded-xl transition-colors cursor-pointer shrink-0"
          >
            {copied ? <><Check className="w-3.5 h-3.5 text-emerald-600" /> تم النسخ</> : <><Copy className="w-3.5 h-3.5" /> نسخ</>}
          </button>
        </div>
      )}

      {/* Settings list */}
      <div className="bg-white rounded-3xl border border-[#D6D6C2] shadow-sm overflow-hidden divide-y divide-[#D6D6C2]/50">
        <SettingsRow icon={UserIcon} tint="#123E75" label="البيانات الشخصية" sublabel="بياناتك وصورتك وحذف الحساب" onClick={() => setView('personal')} />
        <SettingsRow icon={Award} tint="#C5A059" label="المكافآت والنقاط" sublabel={`${tier.emoji} ${tier.name} · ${points.toLocaleString('ar-EG')} نقطة`} onClick={() => setView('rewards')} />
        <ToggleRow
          icon={Mail}
          tint="#2E7D5B"
          label="إشعارات البريد الإلكتروني"
          sublabel={emailsOn ? `تصلك رسائل الحجز على ${currentUser.email}` : 'موقوفة — لن تصلك رسائل بريد'}
          checked={emailsOn}
          onChange={handleToggleEmails}
          busy={emailBusy}
        />
        {/* Only offered where it can actually work — a switch that cannot
            deliver is worse than no switch. Hidden in the Android app too,
            which registers for push on its own. Shared with the owner and
            admin settings so all three roles get the same opt-in. */}
        <WebPushToggle userId={currentUser.id} render={(p) => (
          <ToggleRow
            icon={Bell}
            tint="#B45309"
            label={p.label}
            sublabel={p.sublabel}
            checked={p.checked}
            onChange={p.onChange}
            busy={p.busy}
            disabled={p.disabled}
          />
        )} />
        <SettingsRow icon={HelpCircle} tint="#5A5A40" label="التواصل والدعم الفني" onClick={onNavigateSupport} />
        <SettingsRow icon={ShieldCheck} tint="#5A5A40" label="سياسة الخصوصية وشروط الاستخدام" onClick={onNavigatePrivacy} />
      </div>

      {/* Logout */}
      <button
        onClick={onLogout}
        className="w-full flex items-center justify-center gap-2 text-xs font-bold text-red-500 hover:bg-red-50 border border-red-200 rounded-2xl py-3.5 transition-colors cursor-pointer"
      >
        <LogOut className="w-4 h-4" />
        <span>تسجيل الخروج</span>
      </button>

      <p className="text-center text-[9px] text-[#B8B8A0] font-bold pt-1">بيما · نسخة 1.0</p>
    </div>
  );
}
