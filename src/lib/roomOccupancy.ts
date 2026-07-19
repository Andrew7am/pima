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
