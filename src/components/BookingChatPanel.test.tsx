import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import BookingChatPanel from './BookingChatPanel';
import type { BookingMessage } from '../types';
import * as api from '../lib/bookingMessages';

vi.mock('../lib/bookingMessages', () => ({
  loadBookingMessages: vi.fn(),
  sendBookingMessage: vi.fn(),
  deleteBookingMessage: vi.fn(),
  markBookingMessagesRead: vi.fn(),
  subscribeToBookingMessages: vi.fn(() => () => {}),
  subscribeToTypingPresence: vi.fn(() => ({ setTyping: vi.fn(), unsubscribe: vi.fn() })),
}));
vi.mock('../lib/attachments', () => ({ fileToAttachment: vi.fn() }));

function msg(over: Partial<BookingMessage>): BookingMessage {
  return {
    id: 1, bookingId: 'b1', senderId: 'other', senderName: 'صاحب البيت',
    content: 'نص', createdAt: '2026-07-01T10:00:00Z', ...over,
  };
}

const load = vi.mocked(api.loadBookingMessages);

beforeEach(() => {
  load.mockReset();
});

function panel(bookingIds: string[]) {
  return (
    <BookingChatPanel
      bookingId={bookingIds[0]}
      bookingIds={bookingIds}
      currentUserId="me"
      title="محادثة"
    />
  );
}

describe('BookingChatPanel thread isolation', () => {
  it('renders the messages of the thread it was given', async () => {
    load.mockResolvedValue([msg({ id: 1, content: 'رسالة المحادثة الأولى' })]);
    render(panel(['b1']));
    expect(await screen.findByText('رسالة المحادثة الأولى')).toBeInTheDocument();
  });

  // THE regression: switching conversations used to keep the previous thread's
  // messages on screen while the new history loaded, so one person's chat
  // appeared under another contact's name.
  it('never shows the previous conversation while the next one loads', async () => {
    load.mockResolvedValue([msg({ id: 1, content: 'سر المحادثة الأولى' })]);
    const { rerender } = render(panel(['b1']));
    expect(await screen.findByText('سر المحادثة الأولى')).toBeInTheDocument();

    // Switch to another conversation whose history has not arrived yet.
    let resolveSecond: (m: BookingMessage[]) => void = () => {};
    load.mockReturnValue(new Promise<BookingMessage[]>((res) => { resolveSecond = res; }));
    rerender(panel(['b2']));

    // The first thread's content must be gone immediately — not left hanging.
    await waitFor(() => {
      expect(screen.queryByText('سر المحادثة الأولى')).not.toBeInTheDocument();
    });

    resolveSecond([msg({ id: 2, bookingId: 'b2', content: 'رسالة المحادثة التانية' })]);
    expect(await screen.findByText('رسالة المحادثة التانية')).toBeInTheDocument();
    expect(screen.queryByText('سر المحادثة الأولى')).not.toBeInTheDocument();
  });

  it('unsubscribes from the old thread when switching', async () => {
    const unsubscribe = vi.fn();
    vi.mocked(api.subscribeToBookingMessages).mockReturnValue(unsubscribe);
    load.mockResolvedValue([]);

    const { rerender } = render(panel(['b1']));
    await waitFor(() => expect(api.subscribeToBookingMessages).toHaveBeenCalled());

    rerender(panel(['b2']));
    await waitFor(() => expect(unsubscribe).toHaveBeenCalled());
  });

  // A guest with several bookings at one house sees a single merged thread.
  it('merges every booking of a unified thread, oldest first', async () => {
    load.mockImplementation(async (id: string) =>
      id === 'b1'
        ? [msg({ id: 1, bookingId: 'b1', content: 'الأقدم', createdAt: '2026-07-01T09:00:00Z' })]
        : [msg({ id: 2, bookingId: 'b2', content: 'الأحدث', createdAt: '2026-07-02T09:00:00Z' })],
    );

    render(panel(['b1', 'b2']));

    const oldest = await screen.findByText('الأقدم');
    const newest = await screen.findByText('الأحدث');
    // documentPosition: oldest must precede newest in the DOM.
    expect(oldest.compareDocumentPosition(newest) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('marks the opened thread as read', async () => {
    load.mockResolvedValue([]);
    render(panel(['b1']));
    await waitFor(() => expect(api.markBookingMessagesRead).toHaveBeenCalledWith('b1'));
  });
});

// The booking-details sheet opens this panel with a narrower set of props than
// the conversations list does: one bookingId and no bookingIds, no booking, no
// house, no coverUrl and no onBack. That call site must render, not throw.
describe('BookingChatPanel opened from the booking sheet', () => {
  it('renders with only the props the booking sheet passes', async () => {
    load.mockResolvedValue([msg({ id: 1, content: 'أهلاً بك' })]);

    expect(() => render(
      <BookingChatPanel
        bookingId="b1"
        currentUserId="me"
        title="صاحب البيت"
        subtitle="بيت السيدة العذراء"
        variant="guest"
        heightClass="h-[50vh]"
      />,
    )).not.toThrow();

    expect(await screen.findByText('أهلاً بك')).toBeInTheDocument();
  });
});
