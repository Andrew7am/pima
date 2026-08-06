import React, { useState } from 'react';
import { arabicBadge } from '../lib/arabic';
import {
  Compass, BookOpen, CalendarDays, ShieldAlert, Coffee, Bell,
  Check, X, LogOut, UserCircle, Home, Map as MapIcon, Sparkles, MessageCircle
} from 'lucide-react';
import { User, AppNotification } from '../types';
import { timeAgo } from '../lib/timeAgo';
import Logo from './Logo';
import { tapFeedback } from '../lib/haptics';

type Screen = 'explore' | 'bookings' | 'messages' | 'map' | 'owner_panel' | 'admin_panel' | 'meals' | 'support' | 'profile' | 'privacy' | 'entertainment' | 'trivia' | 'whoami' | 'hymns' | 'fillverse' | 'multiplayer_lobby' | 'live_match' | 'achievements' | 'friends' | 'chat_thread' | 'leaderboard' | 'interactive_room' | 'conference_hub' | 'random_match' | 'games_catalog' | 'rewards';

interface WebLayoutProps {
  children: React.ReactNode;
  activeScreen: Screen;
  setActiveScreen: (screen: Screen) => void;
  currentUser: User | null;
  onLogout: () => void;
  notifications: AppNotification[];
  onMarkNotificationAsRead: (id: string) => void;
  onMarkAllRead: () => void;
  // Guest mode only — shows the login button and routes gated taps to auth
  onRequireLogin?: () => void;
  // Unread incoming booking-messages — drives the red badge on the محادثات tab
  messagesUnreadCount?: number;
  // Requests still waiting on the house — drives the badge on the حجوزاتي tab
  bookingsPendingCount?: number;
}

interface NavItem {
  id: Screen;
  label: string;
  icon: React.ReactNode;
  roles: string[];
}

// Labels stay to one short word: six items share a 375px bar, so each gets
// ~54px of usable width. "استكشاف البيوت" measured 73px and wrapped to two
// lines, making that one tab taller than the other five.
// Five tabs, so الرئيسية sits third — dead centre of the bar, where it is drawn
// as the raised gold disc. In RTL the FIRST entry is the RIGHTMOST tab, so this
// array reads right-to-left and lands on screen as:
//   الترفيه · المحادثات · [الرئيسية] · حجوزاتي · حسابي
// الخريطة is deliberately NOT here: it is the same search drawn on a map, so it
// lives as a button beside the search box on the browse screen. Freeing that
// slot is also what lets an odd number of tabs centre the home tab exactly.
const NAV_ITEMS: NavItem[] = [
  { id: 'entertainment', label: 'الترفيه',         icon: <Sparkles className="w-5 h-5" />,  roles: ['individual', 'servant'] },
  { id: 'messages',      label: 'المحادثات',       icon: <MessageCircle className="w-5 h-5" />, roles: ['individual', 'servant'] },
  { id: 'explore',       label: 'الرئيسية',        icon: <Compass className="w-5 h-5" />,   roles: ['individual', 'servant'] },
  { id: 'bookings',      label: 'حجوزاتي',         icon: <CalendarDays className="w-5 h-5" />, roles: ['individual', 'servant'] },
  { id: 'profile',       label: 'حسابي',           icon: <UserCircle className="w-5 h-5" />, roles: ['individual', 'servant'] },
  { id: 'owner_panel',   label: 'لوحة المالك',      icon: <Home className="w-5 h-5" />,      roles: ['owner'] },
  { id: 'meals',         label: 'قائمة الطعام',     icon: <Coffee className="w-5 h-5" />,    roles: ['owner'] },
  { id: 'admin_panel',   label: 'لوحة الإدارة',     icon: <ShieldAlert className="w-5 h-5" />, roles: ['admin'] },
];

// Logged-out visitors browse freely; anything beyond these routes to login.
const GUEST_NAV: NavItem[] = [
  // Only two tabs here, so the full label fits — and a first-time visitor is
  // better served by what the screen actually does than by "الرئيسية".
  { id: 'explore', label: 'استكشاف البيوت', icon: <Compass className="w-5 h-5" />, roles: [] },
  { id: 'map',     label: 'الخريطة',         icon: <MapIcon className="w-5 h-5" />, roles: [] },
];

export default function WebLayout({
  children,
  activeScreen,
  setActiveScreen,
  currentUser,
  onLogout,
  notifications,
  onMarkNotificationAsRead,
  onMarkAllRead,
  onRequireLogin,
  messagesUnreadCount = 0,
  bookingsPendingCount = 0,
}: WebLayoutProps) {
  const [showNotif, setShowNotif] = useState(false);

  const visibleNav = currentUser ? NAV_ITEMS.filter(item => item.roles.includes(currentUser.role)) : GUEST_NAV;
  const unreadCount = currentUser ? notifications.filter(n => n.userId === currentUser.id && !n.isRead).length : 0;
  const userNotifications = currentUser ? notifications.filter(n => n.userId === currentUser.id) : [];

  // Tapping a notification did nothing at all — the row carried no handler, so
  // the only thing anyone could act on was the small ✓. A notification exists to
  // take you to what it is about, so send the reader there and mark it read on
  // the way.
  const openNotification = (n: AppNotification) => {
    if (!n.isRead) onMarkNotificationAsRead(n.id);
    setShowNotif(false);
    if (!n.bookingId || !currentUser) return;
    setActiveScreen(currentUser.role === 'owner' ? 'owner_panel'
      : currentUser.role === 'admin' ? 'admin_panel'
      : 'bookings');
  };

  const roleLabel: Record<string, string> = {
    individual: 'مستخدم',
    servant: 'خادم',
    owner: 'مالك',
    admin: 'مشرف',
  };

  return (
    <div className="flex flex-col h-dvh w-screen overflow-hidden bg-[var(--color-natural-bg)]" dir="rtl">

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top Navbar — the brand sits centred and absolutely positioned so it
            stays optically centred no matter how wide the controls beside it
            get. Controls live on one side only; the account actions that used
            to crowd this bar are on the حسابي screen.

            `relative` is load-bearing, not decoration: a z-index on a static
            element is inert, so this bar never actually formed a layer. Nothing
            below it carried a z-index either, so it went unnoticed — until the
            promo banner arrived with `z-10` on a positioned wrapper and started
            painting straight over the open notifications panel, swallowing its
            clicks. z-40 keeps the bar above page content while leaving the
            fixed z-50 overlays (modals, the floating WhatsApp button) on top. */}
        {/* justify-end, not between: the brand is absolutely positioned and so
            takes part in no flex layout, which left the single control group
            sitting at flex-start — the right edge in RTL, right up against the
            centred logo. Pushed to the end it clears the brand entirely. */}
        <header className="relative shrink-0 h-[90px] flex items-center justify-end px-4 bg-white border-b border-[var(--color-natural-border)] shadow-sm z-40">
          <div className="absolute inset-x-0 flex flex-col items-center justify-center pointer-events-none">
            <div className="flex items-center gap-2">
              <Logo size={32} variant="icon" />
              <span className="font-black text-[#C5A059] text-[23px] tracking-wide leading-none">بيما</span>
            </div>
            {/* Hairline and a diamond either side of the strapline, as in the
                approved header — plain text alone read as an afterthought. */}
            <span className="flex items-center gap-1.5 mt-1">
              <span aria-hidden="true" className="w-5 h-px bg-gradient-to-l from-[#C5A059]/55 to-transparent" />
              <span aria-hidden="true" className="w-[3px] h-[3px] rotate-45 bg-[#C5A059]/70" />
              <span className="text-[11px] font-bold text-[#C5A059] tracking-[0.03em]">بيوت المؤتمرات والخلوات</span>
              <span aria-hidden="true" className="w-[3px] h-[3px] rotate-45 bg-[#C5A059]/70" />
              <span aria-hidden="true" className="w-5 h-px bg-gradient-to-r from-[#C5A059]/55 to-transparent" />
            </span>
          </div>

          {!currentUser ? (
            /* Guest header. The old full-width "تسجيل الدخول / إنشاء حساب"
               button measured 206px and started at x=153, painting straight
               over the centred brand, which sits at 146–228. Compact and
               pinned to the same side the avatar occupies once signed in. */
            <button
              id="guest-login-btn"
              onClick={onRequireLogin}
              title="تسجيل الدخول / إنشاء حساب"
              aria-label="تسجيل الدخول أو إنشاء حساب"
              className="relative z-10 flex items-center gap-1.5 bg-[var(--color-natural-primary)] hover:opacity-90 text-white text-[11px] font-bold px-3 min-h-11 rounded-full transition-all cursor-pointer shrink-0"
            >
              <UserCircle className="w-4 h-4 shrink-0" />
              <span>دخول</span>
            </button>
          ) : (
          <div className="relative z-10 flex items-center gap-1">
            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setShowNotif(v => !v)}
                aria-label="الإشعارات"
                className="relative p-2 rounded-lg hover:bg-[var(--color-natural-hover)] text-[var(--color-natural-secondary)] transition-colors"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[11px] flex items-center justify-center font-bold">
                    {arabicBadge(unreadCount)}
                  </span>
                )}
              </button>

              {/* Notifications Panel */}
              {showNotif && (
                // On a phone this was a 320px dropdown floating over a
                // full-screen backdrop: most taps landed on the backdrop and
                // dismissed it, and the short list was awkward to scroll. It is
                // now a near-full-width sheet on mobile and keeps the compact
                // dropdown from `sm:` up.
                // The container must keep a definite max-height in BOTH breakpoints:
                // the scrolling list below uses flex-1, and a flex child with
                // basis 0 inside a container whose height comes from its own
                // content resolves to a broken layout — the header and the list
                // detach and the panel sprawls down the page.
                <div className="fixed inset-x-3 top-16 sm:absolute sm:inset-x-auto sm:top-11 sm:left-0 sm:w-96 bg-white rounded-2xl shadow-xl border border-[var(--color-natural-border)] z-50 overflow-hidden flex flex-col max-h-[75dvh] sm:max-h-[26rem]">
                  <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-[var(--color-natural-border)]">
                    <span className="font-bold text-sm text-[var(--color-natural-text)] flex items-center gap-1.5">
                      الإشعارات
                      {unreadCount > 0 && (
                        <span className="text-[11px] font-black text-white bg-blue-500 rounded-full px-1.5 py-0.5">{unreadCount} جديد</span>
                      )}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={onMarkAllRead}
                        disabled={unreadCount === 0}
                        className={`text-[11px] flex items-center gap-0.5 px-2 py-1 rounded-md transition-colors ${
                          unreadCount === 0
                            ? 'text-[var(--color-natural-secondary)]/40 cursor-default'
                            : 'text-[var(--color-natural-secondary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-natural-hover)]'
                        }`}
                      >
                        <Check className="w-3 h-3" /> تمييز الكل كمقروء
                      </button>
                      <button aria-label="إغلاق الإشعارات" onClick={() => setShowNotif(false)} className="p-1 rounded-md hover:bg-[var(--color-natural-hover)]">
                        <X className="w-4 h-4 text-[var(--color-natural-secondary)]" />
                      </button>
                    </div>
                  </div>
                  {/* overscroll-contain stops a scroll that reaches the end of
                      the list from chaining to the page behind the sheet. */}
                  <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
                    {userNotifications.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 py-12 text-[var(--color-natural-secondary)]">
                        <Bell className="w-8 h-8 opacity-25" />
                        <p className="text-sm">لا توجد إشعارات</p>
                      </div>
                    ) : (
                      userNotifications.map(n => (
                        <div
                          key={n.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => openNotification(n)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openNotification(n); }
                          }}
                          className={`px-4 py-3 border-b border-[var(--color-natural-border)] last:border-0 flex gap-3 items-start transition-colors cursor-pointer hover:bg-[var(--color-natural-hover)]
                            ${!n.isRead ? 'bg-blue-50/70' : 'bg-white'}`}
                        >
                          {/* The tinted row, the coloured dot and the "جديد" pill
                              already say "unread" three times over — a fourth
                              accent bar just fought the panel's rounded corner. */}
                          <div className={`w-2 h-2 mt-1.5 rounded-full shrink-0 ${
                            n.type === 'success' ? 'bg-green-500' :
                            n.type === 'danger' ? 'bg-red-500' : 'bg-blue-400'
                          } ${n.isRead ? 'opacity-30' : ''}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1">
                              <p className={`text-xs truncate ${!n.isRead ? 'font-black text-[var(--color-natural-text)]' : 'font-semibold text-[var(--color-natural-secondary)]'}`}>{n.title}</p>
                              {!n.isRead && <span className="shrink-0 text-[11px] font-black text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full">جديد</span>}
                            </div>
                            {/* Arabic needs the looser leading to stay readable at this size. */}
                            <p className={`text-[11px] leading-[1.75] line-clamp-3 ${n.isRead ? 'text-[var(--color-natural-secondary)]/60' : 'text-[var(--color-natural-secondary)]'}`}>{n.message}</p>
                            <span className="block mt-1 text-[11px] font-bold text-[var(--color-natural-secondary)]/60">{timeAgo(n.createdAt)}</span>
                          </div>
                          {!n.isRead && (
                            <button
                              onClick={(e) => { e.stopPropagation(); onMarkNotificationAsRead(n.id); }}
                              title="تمييز كمقروء"
                              aria-label="تمييز كمقروء"
                              className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full border border-[var(--color-natural-border)] bg-white text-[var(--color-natural-secondary)] hover:border-green-400 hover:text-green-600 hover:bg-green-50 transition-colors"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Avatar — opens حسابي, which is where signing out now lives. The
                name/role block and the logout icon were removed from the bar to
                leave the brand its own space. */}
            <button
              onClick={() => setActiveScreen('profile')}
              title={currentUser.name}
              aria-label={`حسابي — ${currentUser.name}`}
              className="w-9 h-9 rounded-full bg-[var(--color-natural-primary)] text-white flex items-center justify-center text-sm font-bold overflow-hidden shrink-0 ring-2 ring-[#C5A059]/45 shadow-[0_2px_8px_rgba(45,45,36,0.14)] hover:opacity-90 transition-opacity cursor-pointer"
            >
              {currentUser.avatarUrl
                ? <img src={currentUser.avatarUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                : currentUser.name.charAt(0)}
            </button>
          </div>
          )}
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {children}
        </main>
      </div>

      {/* Bottom Navigation Bar — fully hidden when the owner is on their
          own dashboard: OwnerDashboardShell provides its own bottom nav
          on mobile and a sidebar on desktop, both covering more real
          destinations than the tiny 2-item bar we'd otherwise show. */}
      <nav
        // The inset keeps the tap targets clear of the Android gesture bar —
        // same treatment the owner dashboard's own bar already has.
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        className={`shrink-0 bg-white border-t border-[var(--color-natural-border)] rounded-t-3xl shadow-[0_-8px_24px_rgba(0,0,0,0.08),0_-2px_6px_rgba(0,0,0,0.03)] flex items-stretch z-10 ${
          currentUser?.role === 'owner' && activeScreen === 'owner_panel' ? 'hidden' : ''
        }`}
      >
        {visibleNav.map(item => {
          const isActive = activeScreen === item.id;
          const badge = item.id === 'messages' ? messagesUnreadCount
            : item.id === 'bookings' ? bookingsPendingCount : 0;
          // The home tab is the primary action, so on the full bar it is drawn
          // as a raised gold disc rather than another flat icon. It stays inside
          // the bar's box — the app shell clips overflow, so a button that broke
          // the top edge would simply be cut off.
          const isPrimary = item.id === 'explore' && visibleNav.length >= 5;

          if (isPrimary) {
            return (
              <button
                key={item.id}
                onClick={() => { tapFeedback(); setActiveScreen(item.id); }}
                title={item.label}
                aria-current={isActive ? 'page' : undefined}
                className="relative flex-1 flex flex-col items-center justify-start gap-1 pt-1.5 pb-1.5 px-0.5 min-h-[62px] text-center cursor-pointer group pima-press"
              >
                <span
                  className={`w-12 h-12 rounded-full flex items-center justify-center shadow-[0_8px_24px_rgba(0,0,0,0.08),0_2px_6px_rgba(0,0,0,0.03)] ring-4 ring-white transition-transform duration-120 ease-[cubic-bezier(0.33,1,0.68,1)] ${
                    isActive
                      ? 'bg-gradient-to-b from-[#E0C48A] to-[#B8944E] text-[#2D2D24]'
                      : 'bg-gradient-to-b from-[#EBD9B4] to-[#C9A96A] text-[#4A4A3A]'
                  }`}
                >
                  <Home className="w-6 h-6" />
                </span>
                <span className={`text-[11px] leading-tight whitespace-nowrap ${isActive ? 'font-black text-[var(--color-natural-text)]' : 'font-bold text-[var(--color-natural-secondary)]'}`}>
                  {item.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={item.id}
              onClick={() => { tapFeedback(); setActiveScreen(item.id); }}
              title={item.label}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex-1 flex flex-col items-center justify-center gap-1 pt-2 pb-1.5 px-0.5 min-h-[62px] text-center transition-colors duration-[250ms] ease-[cubic-bezier(0.33,1,0.68,1)] cursor-pointer pima-press
                ${isActive
                  ? 'text-[var(--color-natural-primary)]'
                  : 'text-[var(--color-natural-secondary)] hover:text-[var(--color-natural-text)]'
                }`}
            >
              <span className="relative">
                {item.icon}
                {badge > 0 && (
                  <span className="absolute -top-1.5 -left-2 min-w-[15px] h-[15px] px-0.5 bg-red-500 text-white text-[11px] font-black rounded-full flex items-center justify-center">
                    {arabicBadge(badge)}
                  </span>
                )}
              </span>
              {/* Never wrap: one tall tab among four short ones is what made
                  the bar look uneven. */}
              <span className={`text-[11px] leading-tight whitespace-nowrap ${isActive ? 'font-black' : 'font-bold'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Catches an outside tap to dismiss the panel. It must stay BELOW the
          top bar's z-40: at the same z-index it wins on DOM order, covers the
          whole bar including the open panel, and every tap inside the panel
          lands here and just closes it. Above the page content (z-10) is all
          it needs to be. */}
      {showNotif && (
        <div className="fixed inset-0 z-30" onClick={() => setShowNotif(false)} />
      )}
    </div>
  );
}
