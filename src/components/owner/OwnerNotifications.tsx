import React from 'react';
import { AppNotification, User } from '../../types';
import { CheckCircle2, XCircle, Info } from 'lucide-react';

interface OwnerNotificationsProps {
  owner: User;
  notifications: AppNotification[];
  onMarkNotificationAsRead: (id: string) => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function OwnerNotifications({ owner, notifications, onMarkNotificationAsRead }: OwnerNotificationsProps) {
  const ownerNotifications = notifications
    .filter((n) => n.userId === owner.id)
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="space-y-3">
      <div className="text-xs font-bold text-[var(--color-owner-secondary)] px-1">
        كل الإشعارات ({ownerNotifications.length}):
      </div>

      {ownerNotifications.length === 0 ? (
        <div className="bg-[var(--color-owner-surface)] rounded-3xl border border-[var(--color-owner-border)] p-8 text-center text-xs text-[var(--color-owner-secondary)]">
          لا توجد إشعارات بعد.
        </div>
      ) : (
        <div className="space-y-2">
          {ownerNotifications.map((n) => {
            const Icon = n.type === 'success' ? CheckCircle2 : n.type === 'danger' ? XCircle : Info;
            const iconColor = n.type === 'success' ? 'text-emerald-600' : n.type === 'danger' ? 'text-rose-600' : 'text-[var(--color-owner-primary)]';
            return (
              <button
                key={n.id}
                id={`owner-notification-${n.id}`}
                type="button"
                onClick={() => !n.isRead && onMarkNotificationAsRead(n.id)}
                className={`w-full flex items-start gap-3 text-right rounded-2xl border p-3.5 transition-colors cursor-pointer ${
                  n.isRead
                    ? 'bg-[var(--color-owner-surface)] border-[var(--color-owner-border)]'
                    : 'bg-[var(--color-owner-hover)] border-[var(--color-owner-primary)]/30'
                }`}
              >
                <div className={`shrink-0 mt-0.5 ${iconColor}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-[var(--color-owner-text)]">{n.title}</span>
                    {!n.isRead && <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-owner-accent)] shrink-0" />}
                  </div>
                  <p className="text-[10.5px] text-[var(--color-owner-secondary)] mt-0.5">{n.message}</p>
                  <span className="text-[9px] text-[var(--color-owner-secondary)]/70 mt-1 block">{formatDate(n.createdAt)}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
