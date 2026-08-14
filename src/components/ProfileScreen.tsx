import React, { useEffect, useState } from 'react';
import { User, Booking, Review, RetreatHouse } from '../types';
import {
  User as UserIcon, Phone, MapPin, Church, LogOut, Lock, HelpCircle, ChevronLeft,
  Trash2, ShieldCheck, Camera, Coins, Award, CalendarCheck, ChevronRight, Copy, Check, Mail, Bell, Moon,
} from 'lucide-react';
import RewardsDashboard from './RewardsDashboard';
import PhotoPickerButtons from './PhotoPickerButtons';
import { setEmailOptOut } from '../lib/db';
import WebPushToggle from './WebPushToggle';
import { useTheme } from '../lib/useTheme';
import { Badge, Button, Card, Input } from './ui';

/**
 * THE FIRST SCREEN ON THE DESIGN SYSTEM.
 *
 * Nothing here changed about what this screen does. Same three views, same
 * state, same handlers, same props, same Arabic. What changed is that the
 * colours are now roles instead of hexes, the buttons and the two card shapes
 * come from src/components/ui, and every font size sits on the approved
 * 11/12/14/16/20 scale.
 *
 * ON THE SIZES: this file had 9px, 9.5px, 10px, 10.5px, 12.5px and 13px. The
 * scale has none of those, and 9px Arabic is not small text so much as text
 * you do not read — Arabic carries meaning in marks that vanish first. Those
 * are the visible differences from before, and they are the point rather than
 * a side effect.
 *
 * ON WHAT DID NOT BECOME A COMPONENT: the switch rows, the stat tiles and the
 * back arrow are still hand-built. A stat tile is a tappable figure, not a
 * card, and a switch row is a list item, not a button. Forcing either would
 * have meant redesigning the screen to suit the toolkit, which is backwards.
 * The role chip in the hero DID become a Badge once the inverse variant
 * existed — it was the use case that prompted it.
 */

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

/** A role colour at low opacity, for the soft square behind a row's icon.
 *  Replaces the `${tint}14` hex-alpha concatenation, which silently produced
 *  the string "var(--ds-primary)14" the moment the tint became a token. */
const wash = (role: string, pct: number) => `color-mix(in srgb, ${role} ${pct}%, transparent)`;

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div
      className="flex items-start gap-3 p-3 rounded-2xl border"
      style={{ backgroundColor: 'var(--ds-bg)', borderColor: wash('var(--ds-border)', 50) }}
    >
      <span
        className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: wash('var(--ds-brand)', 5) }}
      >
        <Icon className="w-4 h-4" style={{ color: 'var(--ds-primary)' }} />
      </span>
      <div className="min-w-0 pt-0.5">
        <span className="text-[11px] font-bold block mb-0.5" style={{ color: 'var(--ds-text-2)' }}>{label}</span>
        <span className="font-bold text-[12px] leading-snug break-words" style={{ color: 'var(--ds-text)' }}>{value}</span>
      </div>
    </div>
  );
}

function SettingsRow({ icon: Icon, label, sublabel, onClick, tint = 'var(--ds-primary)', badge }: {
  icon: React.ElementType; label: string; sublabel?: string; onClick: () => void; tint?: string; badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      // Background as a CLASS, not inline style: an inline background would
      // outrank the hover rule and the row would never light up.
      //
      // outline, not ring. Two reasons, both measured rather than assumed:
      // `ring-2 ring-inset` is Tailwind v3 spelling that emits nothing at all
      // on v4, and a ring is a box-shadow, which these rows already spend on
      // the card. A negative outline offset draws the indicator INSIDE the
      // row, so the card's overflow-hidden cannot clip it on the first and
      // last row.
      className="w-full flex items-center gap-3 min-h-11 bg-[var(--ds-surface)] hover:bg-[var(--ds-bg)] active:scale-[0.99] px-3.5 py-3 transition-all cursor-pointer text-right ds-focus-inset"
    >
      <span className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: wash(tint, 8) }}>
        <Icon className="w-[18px] h-[18px]" style={{ color: tint }} />
      </span>
      <div className="flex-1 min-w-0">
        <span className="text-[14px] font-bold block truncate" style={{ color: 'var(--ds-text)' }}>{label}</span>
        {sublabel && <span className="text-[11px] font-medium block truncate" style={{ color: 'var(--ds-text-2)' }}>{sublabel}</span>}
      </div>
      {badge != null && badge > 0 && (
        <span
          className="min-w-[18px] h-[18px] px-1.5 text-[11px] font-black rounded-full flex items-center justify-center"
          style={{ backgroundColor: 'var(--ds-danger)', color: 'var(--ds-on-danger)' }}
        >
          {badge > 9 ? '9+' : badge}
        </span>
      )}
      <ChevronLeft className="w-4 h-4 shrink-0" style={{ color: 'var(--ds-text-faint)' }} />
    </button>
  );
}

// Same visual language as SettingsRow, but the control is a switch rather than
// a navigation chevron.
function ToggleRow({ icon: Icon, label, sublabel, checked, onChange, tint = 'var(--ds-primary)', busy, disabled }: {
  icon: React.ElementType; label: string; sublabel?: string;
  checked: boolean; onChange: (next: boolean) => void; tint?: string; busy?: boolean;
  /** Set when the switch cannot act at all — a browser that has denied
   *  notifications can only be changed from its own site settings. */
  disabled?: boolean;
}) {
  return (
    <div className="w-full flex items-center gap-3 min-h-11 px-3.5 py-3 text-right" style={{ backgroundColor: 'var(--ds-surface)' }}>
      <span className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: wash(tint, 8) }}>
        <Icon className="w-[18px] h-[18px]" style={{ color: tint }} />
      </span>
      <div className="flex-1 min-w-0">
        <span className="text-[14px] font-bold block truncate" style={{ color: 'var(--ds-text)' }}>{label}</span>
        {sublabel && <span className="text-[11px] font-medium block truncate" style={{ color: 'var(--ds-text-2)' }}>{sublabel}</span>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={busy || disabled}
        onClick={() => onChange(!checked)}
        // right-*, not end-*: the app runs RTL, and a logical property would
        // put the knob on the opposite side from where it has always been.
        //
        // The ::after is an invisible 44px-tall hit area over a 24px track.
        // The switch looks exactly as it always did; it is just no longer a
        // 24px target on a touch screen.
        //
        // NO transition-colors. It was here before and it was safe, because
        // the track was two literal hex classes. Feeding the same property
        // from var(--ds-success)/var(--ds-border) instead brought back the
        // bug the Button documents: the transition never resolves and the
        // track keeps painting the OLD colour. Measured after this swap —
        // aria-checked went to "false" while the track stayed green 800ms
        // later. A switch that reports off and looks on is worse than one
        // that snaps.
        className="relative w-11 h-6 rounded-full shrink-0 disabled:opacity-50 cursor-pointer after:absolute after:content-[''] after:inset-x-0 after:-inset-y-2.5 ds-focus"
        style={{ backgroundColor: checked ? 'var(--ds-success)' : 'var(--ds-border)' }}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 rounded-full shadow transition-all ${checked ? 'right-0.5' : 'right-[22px]'}`}
          style={{ backgroundColor: 'var(--ds-surface)' }}
        />
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
      // Gold ring on focus, not the olive primary: this control sits on the
      // navy panel, where olive all but disappears.
      className="relative rounded-full flex items-center justify-center font-black shrink-0 overflow-hidden ring-4 ring-white/15 shadow-lg disabled:cursor-default cursor-pointer ds-focus-on-brand"
      style={{
        width: size, height: size, fontSize: size / 2.6,
        // Navy on gold measures 6.41:1. --ds-on-accent would also pass, but
        // the navy initial on a gold disc is the mark people recognise.
        backgroundColor: 'var(--ds-accent)', color: 'var(--ds-brand)',
      }}
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

/** The dark identity panel behind the avatar. Physical `to bottom right`, not
 *  a logical direction: it is the same diagonal in both writing directions and
 *  flipping it in RTL would be a change, not a fix. */
const BRAND_PANEL: React.CSSProperties = {
  backgroundImage: 'linear-gradient(to bottom right, var(--ds-brand), var(--ds-brand-2))',
  color: 'var(--ds-on-brand)',
};

export default function ProfileScreen({
  currentUser, onLogout, onBack, onNavigateSupport, onNavigatePrivacy, onDeleteAccount, onUpdateAvatar, reviews, houses,
  bookings = [], onNavigateBookings, initialView = 'hub', onInitialViewConsumed,
}: ProfileScreenProps) {
  const { theme, setTheme } = useTheme();
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
            // 44×44. It was 30px — under the floor for a control that is the
            // only way back out of this view.
            className="w-11 h-11 flex items-center justify-center rounded-xl border bg-[var(--ds-surface)] hover:bg-[var(--ds-raised)] transition-all cursor-pointer ds-focus"
            style={{ borderColor: 'var(--ds-border)', color: 'var(--ds-text)' }}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <h2 className="text-[14px] font-black" style={{ color: 'var(--ds-brand)' }}>البيانات الشخصية</h2>
        </div>

        {/* Avatar + change photo */}
        <div className="rounded-3xl p-6 flex flex-col items-center gap-3 relative overflow-hidden" style={BRAND_PANEL}>
          <div className="absolute -top-10 -left-10 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none" />
          <div
            className="absolute -bottom-12 -right-8 w-32 h-32 rounded-full blur-2xl pointer-events-none"
            style={{ backgroundColor: wash('var(--ds-accent)', 10) }}
          />
          <Avatar user={currentUser} size={92} />
          <div className="text-center">
            <h3 className="text-[16px] font-black">{currentUser.name}</h3>
            <p className="text-[11px] opacity-70">{currentUser.email}</p>
          </div>
          <div className="w-full max-w-[260px] pt-1">
            <PhotoPickerButtons idPrefix="profile-avatar" onSelect={(dataUrl) => onUpdateAvatar(dataUrl)} />
          </div>
        </div>

        {/* Locked personal info */}
        <Card className="space-y-3">
          <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: wash('var(--ds-border)', 60) }}>
            <h3 className="text-[12px] font-black" style={{ color: 'var(--ds-brand)' }}>بيانات التسجيل</h3>
            <span className="text-[11px] font-bold flex items-center gap-1" style={{ color: 'var(--ds-text-2)' }}>
              <Lock className="w-3 h-3" /> غير قابلة للتعديل
            </span>
          </div>
          <p className="text-[11px] leading-relaxed -mt-1" style={{ color: 'var(--ds-text-2)' }}>
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
        </Card>

        {/* Danger zone — moved here, out of the main account hub */}
        {canSelfDelete ? (
          <Card className="space-y-3" style={{ borderColor: wash('var(--ds-danger)', 30) }}>
            <h3 className="text-[12px] font-black flex items-center gap-1.5" style={{ color: 'var(--ds-danger-ink)' }}>
              <Trash2 className="w-4 h-4" /> حذف الحساب نهائياً
            </h3>
            {!isConfirmingDelete ? (
              <>
                <p className="text-[11px] leading-relaxed" style={{ color: 'var(--ds-text-2)' }}>
                  سيتم حذف حسابك وكل بياناتك (الحجوزات، التقييمات، النقاط) نهائياً ولا يمكن التراجع عن هذا الإجراء.
                </p>
                <Button variant="danger-quiet" fullWidth onClick={() => setIsConfirmingDelete(true)}>
                  حذف حسابي نهائياً
                </Button>
              </>
            ) : (
              <div className="space-y-3">
                <p className="text-[11px] font-bold leading-relaxed" style={{ color: 'var(--ds-danger-ink)' }}>
                  هذا الإجراء نهائي ولا يمكن التراجع عنه. للتأكيد، اكتب كلمة "حذف" في الحقل بالأسفل.
                </p>
                {/* The failure message is now the field's own error: tied to it
                    with aria-describedby and announced, instead of a red box
                    floating above that a screen reader never connects to the
                    input. It reads below the field rather than above it. */}
                <Input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder='اكتب "حذف" للتأكيد'
                  error={deleteError || undefined}
                  className="text-center"
                />
                {/* Stacked at phone width, side by side from 640px. The pair
                    used to be 12px labels sharing one row; at the system's
                    16px, "تأكيد الحذف النهائي" wraps to two lines inside a
                    151px button on a 375px screen. Full width is also the
                    safer shape for the irreversible half of the pair. */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={() => { setIsConfirmingDelete(false); setDeleteConfirmText(''); setDeleteError(''); }}
                    disabled={isDeleting}
                  >
                    تراجع
                  </Button>
                  <Button
                    variant="danger"
                    className="flex-1"
                    onClick={handleConfirmDelete}
                    disabled={deleteConfirmText !== 'حذف'}
                    loading={isDeleting}
                  >
                    {isDeleting ? 'جارٍ الحذف...' : 'تأكيد الحذف النهائي'}
                  </Button>
                </div>
              </div>
            )}
          </Card>
        ) : (
          <Card>
            <p className="text-[11px] leading-relaxed" style={{ color: 'var(--ds-text-2)' }}>
              حذف حسابات {currentUser.role === 'owner' ? 'أصحاب البيوت' : 'الإدارة'} يتم عبر الدعم الفني لضمان نقل بيانات الحجوزات المرتبطة بشكل آمن. تواصل معنا لطلب الحذف.
            </p>
          </Card>
        )}
      </div>
    );
  }

  // ── Account hub (main) ───────────────────────────────────────────
  const stats = [
    { key: 'points', icon: Coins, tint: 'var(--ds-accent)', value: points.toLocaleString('ar-EG'), label: 'نقطة', onClick: () => setView('rewards') },
    { key: 'tier', icon: Award, tint: 'var(--ds-brand-2)', value: `${tier.emoji}`, label: tier.name, onClick: () => setView('rewards') },
    { key: 'bookings', icon: CalendarCheck, tint: 'var(--ds-primary)', value: activeBookings.toLocaleString('ar-EG'), label: 'حجز', onClick: onNavigateBookings },
  ];

  return (
    <div className="space-y-4 text-right animate-in fade-in duration-200 pb-10">
      {/* Hero — avatar is the entry to personal data */}
      <div className="rounded-3xl p-6 flex flex-col items-center gap-3 relative overflow-hidden" style={BRAND_PANEL}>
        <div className="absolute -top-10 -left-10 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none" />
        <div
          className="absolute -bottom-12 -right-8 w-36 h-36 rounded-full blur-2xl pointer-events-none"
          style={{ backgroundColor: wash('var(--ds-accent)', 10) }}
        />
        <Avatar user={currentUser} size={92} onClick={() => setView('personal')} />
        <div className="text-center">
          <h2 className="text-[16px] font-black">{currentUser.name}</h2>
          <p className="text-[11px] mt-0.5 opacity-70">{currentUser.email}</p>
          {/* Was a hand-built pill, because every Badge tone was built for a
              light surface and its neutral vanished here. Badge now has the
              inverse variant for exactly this: 10.30:1 on the guest panel. */}
          <Badge variant="inverse" className="mt-2">{roleLabel}</Badge>
        </div>
        <button
          onClick={() => setView('personal')}
          className="mt-1 min-h-11 px-2 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-opacity hover:opacity-80 cursor-pointer ds-focus-on-brand"
          style={{ color: 'var(--ds-accent)' }}
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
              // outline rather than ring: a ring is a box-shadow, and this
              // tile already uses box-shadow for its elevation, so the two
              // compete for the same property and the focus ring loses.
              className="rounded-2xl p-3 flex flex-col items-center gap-1 shadow-[var(--shadow-subtle)] border hover:shadow-[var(--shadow-medium)] hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer disabled:cursor-default disabled:hover:translate-y-0 disabled:hover:shadow-[var(--shadow-subtle)] ds-focus"
              style={{ backgroundColor: 'var(--ds-surface)', borderColor: 'var(--ds-border)' }}
            >
              <span className="w-8 h-8 rounded-xl flex items-center justify-center mb-0.5" style={{ backgroundColor: wash(s.tint, 9) }}>
                <Icon className="w-4 h-4" style={{ color: s.tint }} />
              </span>
              <span className="text-[16px] font-black leading-none" style={{ color: 'var(--ds-text)' }}>{s.value}</span>
              <span className="text-[11px] font-bold" style={{ color: 'var(--ds-text-2)' }}>{s.label}</span>
            </button>
          );
        })}
      </div>

      {/* Referral code — a small, self-contained perk card */}
      {currentUser.referralCode && (
        <Card className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="text-[11px] font-bold block" style={{ color: 'var(--ds-text-2)' }}>كود دعوة أصدقائك</span>
            <span className="text-[14px] font-black tracking-wider" dir="ltr" style={{ color: 'var(--ds-brand)' }}>{currentUser.referralCode}</span>
          </div>
          <Button variant="secondary" onClick={handleCopyReferral} className="shrink-0">
            {copied ? <><Check className="w-3.5 h-3.5" style={{ color: 'var(--ds-success)' }} /> تم النسخ</> : <><Copy className="w-3.5 h-3.5" /> نسخ</>}
          </Button>
        </Card>
      )}

      {/* Settings list */}
      <Card flush className="divide-y divide-[var(--ds-border)]">
        <SettingsRow icon={UserIcon} tint="var(--ds-brand-2)" label="البيانات الشخصية" sublabel="بياناتك وصورتك وحذف الحساب" onClick={() => setView('personal')} />
        <SettingsRow icon={Award} tint="var(--ds-accent)" label="المكافآت والنقاط" sublabel={`${tier.emoji} ${tier.name} · ${points.toLocaleString('ar-EG')} نقطة`} onClick={() => setView('rewards')} />
        <ToggleRow
          icon={Mail}
          tint="var(--ds-success)"
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
            tint="var(--ds-warning)"
            label={p.label}
            sublabel={p.sublabel}
            checked={p.checked}
            onChange={p.onChange}
            busy={p.busy}
            disabled={p.disabled}
          />
        )} />
        {/* Theme. Three segments rather than a switch, because "system" is a
            real third state and a two-way toggle cannot express it. Uses the
            same row metrics as its neighbours — no new control invented. */}
        <div className="flex items-center gap-3 min-h-11 px-3.5 py-3 text-right">
          <span
            className="w-9 h-9 rounded-xl grid place-items-center shrink-0"
            style={{ backgroundColor: 'var(--ds-raised)', color: 'var(--ds-accent)' }}
          >
            <Moon className="w-4 h-4" />
          </span>
          <span className="flex-1 min-w-0 text-[14px] font-bold text-[var(--ds-text)]">المظهر</span>
          <div className="flex gap-1 shrink-0" role="group" aria-label="المظهر">
            {([
              { v: 'system', l: 'النظام' },
              { v: 'light', l: 'فاتح' },
              { v: 'dark', l: 'داكن' },
            ] as const).map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => setTheme(o.v)}
                aria-pressed={theme === o.v}
                className="min-h-11 px-3 rounded-xl text-[12px] font-black border transition-colors cursor-pointer ds-focus"
                style={theme === o.v
                  ? { backgroundColor: 'var(--ds-accent)', color: 'var(--ds-on-accent)', borderColor: 'var(--ds-accent)' }
                  : { backgroundColor: 'var(--ds-surface)', color: 'var(--ds-text-2)', borderColor: 'var(--ds-border)' }}
              >
                {o.l}
              </button>
            ))}
          </div>
        </div>
        <SettingsRow icon={HelpCircle} label="التواصل والدعم الفني" onClick={onNavigateSupport} />
        <SettingsRow icon={ShieldCheck} label="سياسة الخصوصية وشروط الاستخدام" onClick={onNavigatePrivacy} />
      </Card>

      {/* Logout */}
      <Button variant="danger-quiet" fullWidth onClick={onLogout} icon={<LogOut className="w-4 h-4" />}>
        تسجيل الخروج
      </Button>

      <p className="text-center text-[11px] font-bold pt-1" style={{ color: 'var(--ds-text-faint)' }}>بيما · نسخة 1.0</p>
    </div>
  );
}
