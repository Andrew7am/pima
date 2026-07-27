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

// A z-index on a `position: static` element is inert — no layer is formed. The
// top bar carried `z-10` while static, so it never sat above page content; the
// promo banner's `z-10` positioned wrapper painted straight over the open
// notifications panel and swallowed its clicks. jsdom does no compositing, so
// this guards the invariant at the class level instead of the pixel level.
describe('WebLayout top bar layering', () => {
  it('makes the header a real stacking context, not an inert z-index', () => {
    renderLayout([]);
    const header = document.querySelector('header')!;
    expect(header.className).toMatch(/(^|\s)(relative|absolute|fixed|sticky)(\s|$)/);

    const z = header.className.match(/(?:^|\s)z-(\d+)(?:\s|$)/);
    expect(z).not.toBeNull();
    // Must clear the banner's z-10 wrapper, and stay under the z-50 overlays.
    expect(Number(z![1])).toBeGreaterThan(10);
    expect(Number(z![1])).toBeLessThanOrEqual(50);
  });
});

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

  // Reported symptom: "tapping anywhere closes the notifications". Interacting
  // with the panel's own contents must never dismiss it.
  it('stays open when the panel itself is tapped', async () => {
    renderLayout([notif({ id: 'a', title: 'إشعار' })]);
    await openPanel();

    await userEvent.click(screen.getByText('إشعار'));
    expect(screen.getByText('إشعار')).toBeInTheDocument();

    await userEvent.click(screen.getByText('الإشعارات', { selector: 'span' }));
    expect(screen.getByText('إشعار')).toBeInTheDocument();
  });

  // The panel rendered title + body but never the time, so a week-old alert and
  // one from a minute ago were indistinguishable.
  it('shows how long ago each notification arrived', async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    renderLayout([notif({ id: 'a', title: 'إشعار', createdAt: twoHoursAgo })]);
    await openPanel();
    expect(screen.getByText('منذ ساعتين')).toBeInTheDocument();
  });

  it('keeps the list scrollable rather than clipped when there are many', async () => {
    const many = Array.from({ length: 25 }, (_, i) => notif({ id: `n${i}`, title: `إشعار ${i}` }));
    renderLayout(many);
    await openPanel();

    // Every row is rendered — nothing is dropped — and the container that holds
    // them is the one allowed to scroll.
    expect(screen.getByText('إشعار 24')).toBeInTheDocument();
    const list = screen.getByText('إشعار 24').closest('.overflow-y-auto');
    expect(list).not.toBeNull();
  });
});
