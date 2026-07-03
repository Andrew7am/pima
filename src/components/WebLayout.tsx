import React, { useState } from 'react';
import {
  Compass, BookOpen, ShieldAlert, Coffee, HelpCircle, Bell,
  Trash2, Check, X, LogOut, User as UserIcon, Menu, Gift, Home
} from 'lucide-react';
import { User, AppNotification } from '../types';
import Logo from './Logo';

type Screen = 'explore' | 'bookings' | 'owner_panel' | 'admin_panel' | 'meals' | 'support' | 'rewards';

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
  { id: 'explore',      label: 'استكشاف البيوت', icon: <Compass className="w-5 h-5" />,   roles: ['individual', 'servant', 'church'] },
  { id: 'bookings',     label: 'حجوزاتي',         icon: <BookOpen className="w-5 h-5" />,  roles: ['individual', 'servant', 'church'] },
  { id: 'rewards',      label: 'المكافآت',         icon: <Gift className="w-5 h-5" />,      roles: ['individual', 'servant', 'church'] },
  { id: 'owner_panel',  label: 'لوحة المالك',      icon: <Home className="w-5 h-5" />,      roles: ['owner'] },
  { id: 'meals',        label: 'قائمة الطعام',     icon: <Coffee className="w-5 h-5" />,    roles: ['owner'] },
  { id: 'admin_panel',  label: 'لوحة الإدارة',     icon: <ShieldAlert className="w-5 h-5" />, roles: ['admin'] },
  { id: 'support',      label: 'التواصل والدعم الفني', icon: <HelpCircle className="w-5 h-5" />, roles: ['individual', 'servant', 'church', 'owner'] },
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
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const visibleNav = NAV_ITEMS.filter(item => item.roles.includes(currentUser.role));
  const unreadCount = notifications.filter(n => n.userId === currentUser.id && !n.isRead).length;
  const userNotifications = notifications.filter(n => n.userId === currentUser.id);

  const roleLabel: Record<string, string> = {
    individual: 'مستخدم',
    servant: 'خادم',
    church: 'كنيسة',
    owner: 'مالك',
    admin: 'مشرف',
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--color-natural-bg)]" dir="rtl">

      {/* Sidebar */}
      <aside
        className={`flex flex-col shrink-0 bg-[var(--color-natural-sidebar)] border-l border-[var(--color-natural-border)] transition-all duration-300 ${sidebarOpen ? 'w-60' : 'w-16'}`}
      >
        {/* Logo */}
        <div className={`flex items-center gap-3 px-4 py-4 border-b border-[var(--color-natural-border)] ${!sidebarOpen && 'justify-center px-2'}`}>
          <div className="shrink-0">
            <Logo size={32} variant="icon" />
          </div>
          {sidebarOpen && (
            <span className="font-bold text-[var(--color-natural-primary)] text-lg tracking-wide">بيما</span>
          )}
        </div>

        {/* Nav Items */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {visibleNav.map(item => {
            const isActive = activeScreen === item.id;
            return (
              <div key={item.id} className={`my-0.5 px-2 ${!sidebarOpen && 'flex justify-center'}`}>
                <button
                  onClick={() => setActiveScreen(item.id)}
                  title={item.label}
                  className={`flex items-center gap-3 py-2.5 text-sm font-medium transition-all duration-150 rounded-xl
                    ${sidebarOpen ? 'w-full px-3' : 'w-10 h-10 justify-center'}
                    ${isActive
                      ? 'bg-[var(--color-natural-primary)] text-white shadow-sm'
                      : 'text-[var(--color-natural-secondary)] hover:bg-[var(--color-natural-hover)] hover:text-[var(--color-natural-text)]'
                    }`}
                >
                  {item.icon}
                  {sidebarOpen && <span>{item.label}</span>}
                </button>
              </div>
            );
          })}
        </nav>

        {/* User Info + Logout */}
        <div className={`border-t border-[var(--color-natural-border)] p-3 ${!sidebarOpen && 'flex flex-col items-center'}`}>
          {sidebarOpen ? (
            <div className="flex items-center gap-2 mb-2 px-1">
              <div className="w-8 h-8 rounded-full bg-[var(--color-natural-primary)] text-white flex items-center justify-center text-xs font-bold shrink-0">
                {currentUser.name.charAt(0)}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[var(--color-natural-text)] truncate">{currentUser.name}</p>
                <p className="text-[10px] text-[var(--color-natural-secondary)]">{roleLabel[currentUser.role]}</p>
              </div>
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-[var(--color-natural-primary)] text-white flex items-center justify-center text-xs font-bold mb-2">
              {currentUser.name.charAt(0)}
            </div>
          )}
          <button
            onClick={onLogout}
            title="تسجيل الخروج"
            className={`flex items-center gap-2 text-xs text-red-500 hover:bg-red-50 rounded-lg py-2 px-3 transition-colors w-full
              ${!sidebarOpen && 'justify-center px-2'}`}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {sidebarOpen && <span>تسجيل الخروج</span>}
          </button>
        </div>
      </aside>

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top Navbar */}
        <header className="shrink-0 h-14 flex items-center justify-between px-5 bg-white border-b border-[var(--color-natural-border)] shadow-sm z-10">
          <button
            onClick={() => setSidebarOpen(v => !v)}
            className="p-1.5 rounded-lg hover:bg-[var(--color-natural-hover)] text-[var(--color-natural-secondary)] transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
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
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>

      {/* Backdrop for notifications on mobile */}
      {showNotif && (
        <div className="fixed inset-0 z-40" onClick={() => setShowNotif(false)} />
      )}
    </div>
  );
}
