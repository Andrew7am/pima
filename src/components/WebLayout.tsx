import React, { useState } from 'react';
import {
  Compass, BookOpen, ShieldAlert, Coffee, Bell,
  Check, X, LogOut, UserCircle, Home, Map as MapIcon, Sparkles, MessageCircle
} from 'lucide-react';
import { User, AppNotification } from '../types';
import Logo from './Logo';

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
  { id: 'bookings',      label: 'حجوزاتي',         icon: <BookOpen className="w-5 h-5" />,  roles: ['individual', 'servant'] },
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
}: WebLayoutProps) {
  const [showNotif, setShowNotif] = useState(false);

  const visibleNav = currentUser ? NAV_ITEMS.filter(item => item.roles.includes(currentUser.role)) : GUEST_NAV;
  const unreadCount = currentUser ? notifications.filter(n => n.userId === currentUser.id && !n.isRead).length : 0;
  const userNotifications = currentUser ? notifications.filter(n => n.userId === currentUser.id) : [];

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
            to crowd this bar are on the حسابي screen. */}
        <header className="relative shrink-0 h-[68px] flex items-center justify-between px-4 bg-white border-b border-[var(--color-natural-border)] shadow-sm z-10">
          <div className="absolute inset-x-0 flex flex-col items-center justify-center pointer-events-none">
            <div className="flex items-center gap-1.5">
              <Logo size={24} variant="icon" />
              <span className="font-black text-[var(--color-natural-primary)] text-lg tracking-wide leading-none">بيما</span>
            </div>
            <span className="text-[9.5px] font-bold text-[#C5A059] tracking-wide mt-0.5">بيوت المؤتمرات والخلوات</span>
          </div>

          {!currentUser ? (
            /* Guest header — one clear call to action, nothing else */
            <button
              id="guest-login-btn"
              onClick={onRequireLogin}
              className="flex items-center gap-1.5 bg-[var(--color-natural-primary)] hover:opacity-90 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer"
            >
              <UserCircle className="w-4 h-4" />
              <span>تسجيل الدخول / إنشاء حساب</span>
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
                  <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[9px] flex items-center justify-center font-bold">
                    {unreadCount > 9 ? '9+' : unreadCount}
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
                <div className="fixed inset-x-3 top-16 sm:absolute sm:inset-x-auto sm:top-11 sm:left-0 sm:w-80 bg-white rounded-2xl shadow-xl border border-[var(--color-natural-border)] z-50 overflow-hidden flex flex-col max-h-[75dvh] sm:max-h-none">
                  <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-[var(--color-natural-border)]">
                    <span className="font-bold text-sm text-[var(--color-natural-text)] flex items-center gap-1.5">
                      الإشعارات
                      {unreadCount > 0 && (
                        <span className="text-[9px] font-black text-white bg-blue-500 rounded-full px-1.5 py-0.5">{unreadCount} جديد</span>
                      )}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={onMarkAllRead}
                        disabled={unreadCount === 0}
                        className={`text-[10px] flex items-center gap-0.5 px-2 py-1 rounded-md transition-colors ${
                          unreadCount === 0
                            ? 'text-[var(--color-natural-secondary)]/40 cursor-default'
                            : 'text-[var(--color-natural-secondary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-natural-hover)]'
                        }`}
                      >
                        <Check className="w-3 h-3" /> تمييز الكل كمقروء
                      </button>
                      <button onClick={() => setShowNotif(false)} className="p-1 rounded-md hover:bg-[var(--color-natural-hover)]">
                        <X className="w-4 h-4 text-[var(--color-natural-secondary)]" />
                      </button>
                    </div>
                  </div>
                  {/* overscroll-contain stops a scroll that reaches the end of
                      the list from chaining to the page behind the sheet. */}
                  <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain sm:max-h-80">
                    {userNotifications.length === 0 ? (
                      <p className="text-center text-sm text-[var(--color-natural-secondary)] py-8">لا توجد إشعارات</p>
                    ) : (
                      userNotifications.map(n => (
                        <div
                          key={n.id}
                          className={`relative px-4 py-3 border-b border-[var(--color-natural-border)] last:border-0 flex gap-3 items-start transition-all
                            ${!n.isRead ? 'bg-blue-50' : 'bg-white'}`}
                        >
                          {/* Unread accent bar (start edge in RTL) */}
                          {!n.isRead && <span className="absolute right-0 top-0 bottom-0 w-1 bg-blue-500" />}
                          <div className={`w-2 h-2 mt-1.5 rounded-full shrink-0 ${
                            n.type === 'success' ? 'bg-green-500' :
                            n.type === 'danger' ? 'bg-red-500' : 'bg-blue-400'
                          } ${n.isRead ? 'opacity-30' : ''}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <p className={`text-xs ${!n.isRead ? 'font-black text-[var(--color-natural-text)]' : 'font-semibold text-[var(--color-natural-secondary)]'}`}>{n.title}</p>
                              {!n.isRead && <span className="shrink-0 text-[8px] font-black text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full">جديد</span>}
                            </div>
                            <p className={`text-[11px] leading-relaxed line-clamp-3 ${n.isRead ? 'text-[var(--color-natural-secondary)]/60' : 'text-[var(--color-natural-secondary)]'}`}>{n.message}</p>
                          </div>
                          {!n.isRead && (
                            <button
                              onClick={() => onMarkNotificationAsRead(n.id)}
                              title="تمييز كمقروء"
                              className="shrink-0 p-1 rounded-full hover:bg-green-100 text-green-500"
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
              className="w-9 h-9 rounded-full bg-[var(--color-natural-primary)] text-white flex items-center justify-center text-sm font-bold overflow-hidden shrink-0 ring-2 ring-white shadow-sm hover:opacity-90 transition-opacity cursor-pointer"
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
        className={`shrink-0 bg-white border-t border-[var(--color-natural-border)] rounded-t-3xl shadow-[0_-4px_16px_rgba(0,0,0,0.06)] flex items-stretch z-10 ${
          currentUser?.role === 'owner' && activeScreen === 'owner_panel' ? 'hidden' : ''
        }`}
      >
        {visibleNav.map(item => {
          const isActive = activeScreen === item.id;
          const badge = item.id === 'messages' ? messagesUnreadCount : 0;
          // The home tab is the primary action, so on the full bar it is drawn
          // as a raised gold disc rather than another flat icon. It stays inside
          // the bar's box — the app shell clips overflow, so a button that broke
          // the top edge would simply be cut off.
          const isPrimary = item.id === 'explore' && visibleNav.length >= 5;

          if (isPrimary) {
            return (
              <button
                key={item.id}
                onClick={() => setActiveScreen(item.id)}
                title={item.label}
                aria-current={isActive ? 'page' : undefined}
                className="relative flex-1 flex flex-col items-center justify-start gap-1 pt-1.5 pb-1.5 px-0.5 min-h-[62px] text-center cursor-pointer group"
              >
                <span
                  className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg ring-4 ring-white transition-transform duration-150 group-active:scale-95 ${
                    isActive
                      ? 'bg-gradient-to-b from-[#E0C48A] to-[#B8944E] text-[#2D2D24]'
                      : 'bg-gradient-to-b from-[#EBD9B4] to-[#C9A96A] text-[#4A4A3A]'
                  }`}
                >
                  <Home className="w-6 h-6" />
                </span>
                <span className={`text-[9.5px] leading-tight whitespace-nowrap ${isActive ? 'font-black text-[var(--color-natural-text)]' : 'font-bold text-[var(--color-natural-secondary)]'}`}>
                  {item.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={item.id}
              onClick={() => setActiveScreen(item.id)}
              title={item.label}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex-1 flex flex-col items-center justify-center gap-1 pt-2 pb-1.5 px-0.5 min-h-[62px] text-center transition-colors duration-150 cursor-pointer
                ${isActive
                  ? 'text-[var(--color-natural-primary)]'
                  : 'text-[var(--color-natural-secondary)] hover:text-[var(--color-natural-text)]'
                }`}
            >
              <span className="relative">
                {item.icon}
                {badge > 0 && (
                  <span className="absolute -top-1.5 -left-2 min-w-[15px] h-[15px] px-0.5 bg-red-500 text-white text-[8.5px] font-black rounded-full flex items-center justify-center">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </span>
              {/* Never wrap: one tall tab among four short ones is what made
                  the bar look uneven. */}
              <span className={`text-[9.5px] leading-tight whitespace-nowrap ${isActive ? 'font-black' : 'font-bold'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Backdrop for notifications on mobile */}
      {showNotif && (
        <div className="fixed inset-0 z-40" onClick={() => setShowNotif(false)} />
      )}
    </div>
  );
}
