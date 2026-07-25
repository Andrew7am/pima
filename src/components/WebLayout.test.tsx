import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WebLayout from './WebLayout';
import type { AppNotification, User } from '../types';

const me = { id: 'u1', name: 'أندرو', role: 'individual' } as User;

function notif(over: Partial<AppNotification>): AppNotification {
  return {
    id: 'n1', userId: 'u1', bookingId: 'b1', title: 'عنوان',
    message: 'نص', type: 'info', isRead: false, createdAt: '2026-07-01T10:00:00Z',
    ...over,
  };
}

function renderLayout(notifications: AppNotification[], onMarkAllRead = vi.fn()) {
  render(
    <WebLayout
      activeScreen="explore"
      setActiveScreen={vi.fn()}
      currentUser={me}
      onLogout={vi.fn()}
      notifications={notifications}
      onMarkNotificationAsRead={vi.fn()}
      onMarkAllRead={onMarkAllRead}
    >
      <div>محتوى</div>
    </WebLayout>,
  );
  return { onMarkAllRead };
}

const openPanel = async () => {
  await userEvent.click(screen.getByRole('button', { name: 'الإشعارات' }));
  // The panel is the region holding the "mark all" control.
  return screen.getByRole('button', { name: /تمييز الكل كمقروء/ }).closest('div')!.parentElement!.parentElement!;
};

describe('WebLayout notifications', () => {
  it('badges the unread count on the bell', async () => {
    renderLayout([notif({ id: 'a' }), notif({ id: 'b' }), notif({ id: 'c', isRead: true })]);
    const bell = screen.getByRole('button', { name: 'الإشعارات' });
    expect(within(bell).getByText('2')).toBeInTheDocument();
  });

  // Regression: notifications are scoped per user — another account's rows
  // must never render, even if they somehow reach the client.
  it('never renders another user\'s notifications', async () => {
    renderLayout([
      notif({ id: 'mine', title: 'رسالتي' }),
      notif({ id: 'theirs', userId: 'u2', title: 'رسالة حد تاني' }),
    ]);
    await openPanel();
    expect(screen.getByText('رسالتي')).toBeInTheDocument();
    expect(screen.queryByText('رسالة حد تاني')).not.toBeInTheDocument();
  });

  // Regression: "mark all as read" looked like it did nothing because read and
  // unread items were visually identical. Unread must carry the "جديد" pill.
  it('marks unread items with a "جديد" pill and read items without one', async () => {
    renderLayout([
      notif({ id: 'unread', title: 'غير مقروء', isRead: false }),
      notif({ id: 'read', title: 'مقروء', isRead: true }),
    ]);
    await openPanel();

    const unreadRow = screen.getByText('غير مقروء').closest('div')!.parentElement!.parentElement!;
    const readRow = screen.getByText('مقروء').closest('div')!.parentElement!.parentElement!;

    expect(within(unreadRow).getByText('جديد')).toBeInTheDocument();
    expect(within(readRow).queryByText('جديد')).not.toBeInTheDocument();
  });

  it('calls onMarkAllRead when the button is pressed', async () => {
    const onMarkAllRead = vi.fn();
    renderLayout([notif({ id: 'a' })], onMarkAllRead);
    await openPanel();

    await userEvent.click(screen.getByRole('button', { name: /تمييز الكل كمقروء/ }));
    expect(onMarkAllRead).toHaveBeenCalledTimes(1);
  });

  // Once everything is read the action is a no-op, so it must not look tappable.
  it('disables the mark-all button when nothing is unread', async () => {
    renderLayout([notif({ id: 'a', isRead: true }), notif({ id: 'b', isRead: true })]);
    await openPanel();

    expect(screen.getByRole('button', { name: /تمييز الكل كمقروء/ })).toBeDisabled();
    // ...and the bell carries no count badge.
    const bell = screen.getByRole('button', { name: 'الإشعارات' });
    expect(within(bell).queryByText('2')).not.toBeInTheDocument();
  });

  it('shows an empty state when the user has no notifications', async () => {
    renderLayout([]);
    await openPanel();
    expect(screen.getByText('لا توجد إشعارات')).toBeInTheDocument();
  });
});
