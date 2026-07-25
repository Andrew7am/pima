// Room occupancy is derived from real bookings/allocations, not a manually
// toggled status. `room.status` is now only a manual override for the two
// states an owner genuinely has to set by hand (cleaning/maintenance) — the
// rest (available/partial/full) is always computed live from active bookings.
import { Room, RoomAllocation, Booking } from '../types';

export type RoomBedState = 'available' | 'partial' | 'full' | 'cleaning' | 'maintenance';

const ACTIVE_STATUSES: Booking['status'][] = ['pending', 'approved'];

function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function getRoomBedState(
  room: Room,
  allocations: RoomAllocation[],
  bookings: Booking[],
  dateStr: string
): RoomBedState {
  if (room.status === 'cleaning' || room.status === 'maintenance') return room.status;

  const activeBookingIds = new Set(
    bookings
      .filter((b) => ACTIVE_STATUSES.includes(b.status) && dateStr >= b.checkIn && dateStr < b.checkOut)
      .map((b) => b.id)
  );
  const usedBeds = allocations.filter((al) => al.roomId === room.id && activeBookingIds.has(al.bookingId)).length;

  if (usedBeds <= 0) return 'available';
  if (usedBeds >= room.bedsCount) return 'full';
  return 'partial';
}

// Minimum free beds in `room` across the whole [checkIn, checkOut) stay —
// mirrors the overlap logic of the check_booking_capacity() DB trigger so
// client-side checks never disagree with what the server will accept.
export function getRoomFreeBedsForRange(
  room: Room,
  allocations: RoomAllocation[],
  bookings: Booking[],
  checkIn: string,
  checkOut: string,
  excludeBookingId?: string
): number {
  const overlappingBookingIds = new Set(
    bookings
      .filter((b) => b.id !== excludeBookingId)
      .filter((b) => ACTIVE_STATUSES.includes(b.status))
      .filter((b) => rangesOverlap(checkIn, checkOut, b.checkIn, b.checkOut))
      .map((b) => b.id)
  );
  const usedBeds = allocations.filter((al) => al.roomId === room.id && overlappingBookingIds.has(al.bookingId)).length;
  return Math.max(0, room.bedsCount - usedBeds);
}

export function getHouseRoomAvailabilityForRange(
  rooms: Room[],
  allocations: RoomAllocation[],
  bookings: Booking[],
  houseId: string,
  checkIn: string,
  checkOut: string,
  excludeBookingId?: string
): { room: Room; freeBeds: number }[] {
  return rooms
    .filter((r) => r.houseId === houseId && r.status !== 'maintenance')
    .map((room) => ({ room, freeBeds: getRoomFreeBedsForRange(room, allocations, bookings, checkIn, checkOut, excludeBookingId) }));
}

// ─── Booking-form capacity decision ────────────────────────────────────────

export type CapacityStatus =
  | 'ok'              // the request fits — show the booking button
  | 'exceeds_house'   // group is bigger than the house itself — waitlist is a dead end
  | 'full_on_dates';  // house could fit them, but not on these dates — waitlist helps

// Kept as a pure function so the booking form's most consequential branch is
// testable. It previously lived inline in HouseDetail and conflated the two
// failure modes: a 30-person default on a 20-bed house rendered "fully booked
// on these dates" on an empty house, pushing visitors to a waitlist that could
// never help them.
export function getCapacityStatus(opts: {
  bedsCount: number;
  guestsCount: number;
  checkIn: string;
  checkOut: string;
  usedBedsOnDate: (dateStr: string) => number;
  isMonthly?: boolean;
}): CapacityStatus {
  const { bedsCount, guestsCount, checkIn, checkOut, usedBedsOnDate, isMonthly } = opts;
  // Monthly housing is contracted per person, not against a nightly bed count.
  if (isMonthly) return 'ok';
  // An owner who never declared a bed count means capacity is unknown, not
  // zero. Treating it as zero would silently make the house unbookable and
  // report it as "fully booked" — the server's capacity trigger is the real
  // backstop, so let the request through rather than invent a wall.
  if (bedsCount <= 0) return 'ok';
  if (guestsCount > bedsCount) return 'exceeds_house';
  if (!checkIn || !checkOut || checkIn >= checkOut) return 'ok';

  const end = new Date(`${checkOut}T00:00:00`);
  for (const d = new Date(`${checkIn}T00:00:00`); d < end; d.setDate(d.getDate() + 1)) {
    const s = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (usedBedsOnDate(s) + guestsCount > bedsCount) return 'full_on_dates';
  }
  return 'ok';
}
