import React, { useState } from 'react';
import {
  Compass, BookOpen, ShieldAlert, Coffee, HelpCircle, Bell,
  Trash2, Check, X, LogOut, UserCircle, Home
} from 'lucide-react';
import { User, AppNotification } from '../types';
import Logo from './Logo';

type Screen = 'explore' | 'bookings' | 'owner_panel' | 'admin_panel' | 'meals' | 'support' | 'profile';

interface WebLayoutProps {
  children: React.ReactNode;
  activeScreen: Screen;
  setActiveScreen: (screen: Screen) => void;
  currentUser: User;
  onLogout: () => void;
  notifications: AppNotification[];
  onMarkNotificationAsRead: (id: string) => void;
  onClearNotifications: () => void;
}

interface NavItem {
  id: Screen;
  label: string;
  icon: React.ReactNode;
  roles: string[];
}

const NAV_ITEMS: NavItem[] = [
  { id: 'explore',      label: 'استكشاف البيوت', icon: <Compass className="w-5 h-5" />,   roles: ['individual', 'servant'] },
  { id: 'bookings',     label: 'حجوزاتي',         icon: <BookOpen className="w-5 h-5" />,  roles: ['individual', 'servant'] },
  { id: 'profile',      label: 'حسابي',           icon: <UserCircle className="w-5 h-5" />, roles: ['individual', 'servant'] },
  { id: 'owner_panel',  label: 'لوحة المالك',      icon: <Home className="w-5 h-5" />,      roles: ['owner'] },
  { id: 'meals',        label: 'قائمة الطعام',     icon: <Coffee className="w-5 h-5" />,    roles: ['owner'] },
  { id: 'admin_panel',  label: 'لوحة الإدارة',     icon: <ShieldAlert className="w-5 h-5" />, roles: ['admin'] },
  { id: 'support',      label: 'التواصل والدعم الفني', icon: <HelpCircle className="w-5 h-5" />, roles: ['individual', 'servant', 'owner'] },
];

export default function WebLayout({
  children,
  activeScreen,
  setActiveScreen,
  currentUser,
  onLogout,
  notifications,
  onMarkNotificationAsRead,
  onClearNotifications,
}: WebLayoutProps) {
  const [showNotif, setShowNotif] = useState(false);

  const visibleNav = NAV_ITEMS.filter(item => item.roles.includes(currentUser.role));
  const unreadCount = notifications.filter(n => n.userId === currentUser.id && !n.isRead).length;
  const userNotifications = notifications.filter(n => n.userId === currentUser.id);

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
        <header className="shrink-0 h-14 flex items-center justify-between px-4 bg-white border-b border-[var(--color-natural-border)] shadow-sm z-10">
          <div className="flex items-center gap-2 shrink-0">
            <Logo size={28} variant="icon" />
            <span className="font-bold text-[var(--color-natural-primary)] text-base tracking-wide">بيما</span>
          </div>

          <div className="flex items-center gap-1">
            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setShowNotif(v => !v)}
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
                <div className="absolute top-11 left-0 w-80 bg-white rounded-2xl shadow-xl border border-[var(--color-natural-border)] z-50 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-natural-border)]">
                    <span className="font-bold text-sm text-[var(--color-natural-text)]">الإشعارات</span>
                    <div className="flex gap-1">
                      <button
                        onClick={onClearNotifications}
                        className="text-[10px] text-red-400 hover:text-red-600 flex items-center gap-0.5 px-2 py-1 rounded-md hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" /> مسح الكل
                      </button>
                      <button onClick={() => setShowNotif(false)} className="p-1 rounded-md hover:bg-[var(--color-natural-hover)]">
                        <X className="w-4 h-4 text-[var(--color-natural-secondary)]" />
                      </button>
                    </div>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {userNotifications.length === 0 ? (
                      <p className="text-center text-sm text-[var(--color-natural-secondary)] py-8">لا توجد إشعارات</p>
                    ) : (
                      userNotifications.map(n => (
                        <div
                          key={n.id}
                          className={`px-4 py-3 border-b border-[var(--color-natural-border)] last:border-0 flex gap-3 items-start
                            ${!n.isRead ? 'bg-blue-50' : ''}`}
                        >
                          <div className={`w-2 h-2 mt-1.5 rounded-full shrink-0 ${
                            n.type === 'success' ? 'bg-green-500' :
                            n.type === 'danger' ? 'bg-red-500' : 'bg-blue-400'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-[var(--color-natural-text)] mb-0.5">{n.title}</p>
                            <p className="text-[11px] text-[var(--color-natural-secondary)] leading-relaxed line-clamp-3">{n.message}</p>
                          </div>
                          {!n.isRead && (
                            <button
                              onClick={() => onMarkNotificationAsRead(n.id)}
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

            {/* User avatar */}
            <div className="flex items-center gap-2 pl-1">
              <div className="text-left hidden sm:block">
                <p className="text-xs font-semibold text-[var(--color-natural-text)] leading-tight">{currentUser.name}</p>
                <p className="text-[10px] text-[var(--color-natural-secondary)]">{roleLabel[currentUser.role]}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-[var(--color-natural-primary)] text-white flex items-center justify-center text-sm font-bold">
                {currentUser.name.charAt(0)}
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
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {children}
        </main>
      </div>

      {/* Bottom Navigation Bar */}
      <nav className="shrink-0 bg-white border-t border-[var(--color-natural-border)] shadow-[0_-2px_8px_rgba(0,0,0,0.05)] flex items-stretch z-10">
        {visibleNav.map(item => {
          const isActive = activeScreen === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveScreen(item.id)}
              title={item.label}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 px-1 text-center transition-colors duration-150
                ${isActive
                  ? 'text-[var(--color-natural-primary)]'
                  : 'text-[var(--color-natural-secondary)] hover:text-[var(--color-natural-text)]'
                }`}
            >
              {item.icon}
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
