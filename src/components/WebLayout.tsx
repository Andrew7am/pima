import React, { useState } from 'react';
import {
  Compass, BookOpen, ShieldAlert, Coffee, Bell,
  Check, X, LogOut, UserCircle, Home, Map as MapIcon, Sparkles, MessageCircle
} from 'lucide-react';
import { User, AppNotification } from '../types';
import { timeAgo } from '../lib/timeAgo';
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

const NAV_ITEMS: NavItem[] = [
  { id: 'explore',       label: 'استكشاف البيوت', icon: <Compass className="w-5 h-5" />,   roles: ['individual', 'servant'] },
  { id: 'bookings',      label: 'حجوزاتي',         icon: <BookOpen className="w-5 h-5" />,  roles: ['individual', 'servant'] },
  { id: 'messages',      label: 'المحادثات',       icon: <MessageCircle className="w-5 h-5" />, roles: ['individual', 'servant'] },
  { id: 'entertainment', label: 'الترفيه',         icon: <Sparkles className="w-5 h-5" />,  roles: ['individual', 'servant'] },
  { id: 'map',           label: 'الخريطة',         icon: <MapIcon className="w-5 h-5" />,   roles: ['individual', 'servant'] },
  { id: 'profile',       label: 'حسابي',           icon: <UserCircle className="w-5 h-5" />, roles: ['individual', 'servant'] },
  { id: 'owner_panel',   label: 'لوحة المالك',      icon: <Home className="w-5 h-5" />,      roles: ['owner'] },
  { id: 'meals',         label: 'قائمة الطعام',     icon: <Coffee className="w-5 h-5" />,    roles: ['owner'] },
  { id: 'admin_panel',   label: 'لوحة الإدارة',     icon: <ShieldAlert className="w-5 h-5" />, roles: ['admin'] },
];

// Logged-out visitors browse freely; anything beyond these routes to login.
const GUEST_NAV: NavItem[] = [
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

        {/* Top Navbar */}
        {/* `relative` is load-bearing, not decoration: a z-index on a static
            element is inert, so this bar never actually formed a layer. Nothing
            below it carried a z-index either, so it went unnoticed — until the
            promo banner arrived with `z-10` on a positioned wrapper and started
            painting straight over the open notifications panel, swallowing its
            clicks. z-40 keeps the bar above page content while leaving the
            fixed z-50 overlays (modals, the floating WhatsApp button) on top. */}
        <header className="shrink-0 h-14 flex items-center justify-between px-4 bg-white border-b border-[var(--color-natural-border)] shadow-sm relative z-40">
          <div className="flex items-center gap-2 shrink-0">
            <Logo size={28} variant="icon" />
            <span className="font-bold text-[var(--color-natural-primary)] text-base tracking-wide">بيما</span>
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
          <div className="flex items-center gap-1">
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
                          className={`px-4 py-3 border-b border-[var(--color-natural-border)] last:border-0 flex gap-3 items-start transition-colors
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
                              {!n.isRead && <span className="shrink-0 text-[8px] font-black text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full">جديد</span>}
                            </div>
                            {/* Arabic needs the looser leading to stay readable at this size. */}
                            <p className={`text-[11px] leading-[1.75] line-clamp-3 ${n.isRead ? 'text-[var(--color-natural-secondary)]/60' : 'text-[var(--color-natural-secondary)]'}`}>{n.message}</p>
                            <span className="block mt-1 text-[9px] font-bold text-[var(--color-natural-secondary)]/60">{timeAgo(n.createdAt)}</span>
                          </div>
                          {!n.isRead && (
                            <button
                              onClick={() => onMarkNotificationAsRead(n.id)}
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

            {/* User avatar */}
            <div className="flex items-center gap-2 pl-1">
              <div className="text-left hidden sm:block">
                <p className="text-xs font-semibold text-[var(--color-natural-text)] leading-tight">{currentUser.name}</p>
                <p className="text-[10px] text-[var(--color-natural-secondary)]">{roleLabel[currentUser.role]}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-[var(--color-natural-primary)] text-white flex items-center justify-center text-sm font-bold overflow-hidden shrink-0">
                {currentUser.avatarUrl
                  ? <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  : currentUser.name.charAt(0)}
              </div>
            </div>

            {/* Logout */}
            <button
              onClick={onLogout}
              title="تسجيل الخروج"
              className="p-2 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
            >
              <LogOut className="w-5 h-5" />
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
      <nav className={`shrink-0 bg-white border-t border-[var(--color-natural-border)] shadow-[0_-2px_8px_rgba(0,0,0,0.05)] flex items-stretch z-10 ${
        currentUser?.role === 'owner' && activeScreen === 'owner_panel' ? 'hidden' : ''
      }`}>
        {visibleNav.map(item => {
          const isActive = activeScreen === item.id;
          const badge = item.id === 'messages' ? messagesUnreadCount : 0;
          return (
            <button
              key={item.id}
              onClick={() => setActiveScreen(item.id)}
              title={item.label}
              className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 py-2 px-1 text-center transition-colors duration-150
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
              <span className={`text-[9.5px] font-bold leading-tight ${isActive ? 'font-black' : ''}`}>{item.label}</span>
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
