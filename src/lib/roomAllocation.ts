// Smart room allocation engine, operating against REAL Room rows (not the
// legacy generated/virtual rooms RoomDistribution.tsx falls back to for
// houses that haven't configured real rooms yet).
import { Attendee, Room, Booking, RoomAllocation } from '../types';
import { getHouseRoomAvailabilityForRange } from './roomOccupancy';

export interface AutoAllocateOptions {
  mode: 'smart' | 'comfort';
  separateGenders: boolean;
  groupTypesTogether: boolean;
  checkIn: string;
  checkOut: string;
  houseId: string;
}

const COMFORT_CAP_RATIO = 0.7;

// Packs `attendees` into `rooms` for the given booking's stay, respecting
// every OTHER active booking's existing room allocations for date overlap
// (not a flat house-wide bed total). Comfort mode caps usable beds per room
// at ~70% so rooms are never packed to the brim.
export function autoAllocate(
  attendees: Attendee[],
  rooms: Room[],
  allBookings: Booking[],
  allAllocations: RoomAllocation[],
  bookingId: string,
  options: AutoAllocateOptions
): RoomAllocation[] {
  const availability = getHouseRoomAvailabilityForRange(
    rooms, allAllocations, allBookings, options.houseId, options.checkIn, options.checkOut, bookingId
  );

  const sortedRooms = availability
    .map(({ room, freeBeds }) => ({
      room,
      capacity: options.mode === 'comfort'
        ? Math.min(freeBeds, Math.max(1, Math.floor(room.bedsCount * COMFORT_CAP_RATIO)))
        : freeBeds,
    }))
    .filter((r) => r.capacity > 0)
    .sort((a, b) => b.capacity - a.capacity);

  const tempAllocations: RoomAllocation[] = [];
  let seq = 0;
  const makeId = (attendeeId: string) => `alloc_${bookingId}_${attendeeId}_${seq++}`;

  if (options.separateGenders) {
    const males = attendees.filter((a) => a.gender === 'male');
    const females = attendees.filter((a) => a.gender === 'female');
    if (options.groupTypesTogether) {
      males.sort((a, b) => a.groupType.localeCompare(b.groupType));
      females.sort((a, b) => a.groupType.localeCompare(b.groupType));
    }

    const occ: Record<string, { count: number; gender: 'male' | 'female' | null }> = {};
    sortedRooms.forEach((r) => { occ[r.room.id] = { count: 0, gender: null }; });

    let maleIdx = 0;
    for (const { room, capacity } of sortedRooms) {
      if (maleIdx >= males.length) break;
      const o = occ[room.id];
      if (o.gender === null || o.gender === 'male') {
        o.gender = 'male';
        const avail = capacity - o.count;
        for (let i = 0; i < avail && maleIdx < males.length; i++) {
          const attendee = males[maleIdx++];
          tempAllocations.push({ id: makeId(attendee.id), bookingId, attendeeId: attendee.id, roomId: room.id, bedNumber: o.count + 1 });
          o.count++;
        }
      }
    }

    let femaleIdx = 0;
    for (const { room, capacity } of sortedRooms) {
      if (femaleIdx >= females.length) break;
      const o = occ[room.id];
      if (o.gender === null) {
        o.gender = 'female';
        const avail = capacity - o.count;
        for (let i = 0; i < avail && femaleIdx < females.length; i++) {
          const attendee = females[femaleIdx++];
          tempAllocations.push({ id: makeId(attendee.id), bookingId, attendeeId: attendee.id, roomId: room.id, bedNumber: o.count + 1 });
          o.count++;
        }
      }
    }

    const leftover = [...males.slice(maleIdx), ...females.slice(femaleIdx)];
    if (leftover.length > 0) {
      for (const { room, capacity } of sortedRooms) {
        const o = occ[room.id];
        const avail = capacity - o.count;
        for (let i = 0; i < avail && leftover.length > 0; i++) {
          const attendee = leftover.shift()!;
          tempAllocations.push({ id: makeId(attendee.id), bookingId, attendeeId: attendee.id, roomId: room.id, bedNumber: o.count + 1 });
          o.count++;
        }
      }
    }
  } else {
    const sortedAttendees = [...attendees];
    if (options.groupTypesTogether) sortedAttendees.sort((a, b) => a.groupType.localeCompare(b.groupType));
    let idx = 0;
    for (const { room, capacity } of sortedRooms) {
      if (idx >= sortedAttendees.length) break;
      for (let bed = 1; bed <= capacity && idx < sortedAttendees.length; bed++) {
        const attendee = sortedAttendees[idx++];
        tempAllocations.push({ id: makeId(attendee.id), bookingId, attendeeId: attendee.id, roomId: room.id, bedNumber: bed });
      }
    }
  }

  return tempAllocations;
}

const isPlaceholder = (attendees: Attendee[], attendeeId: string) => attendees.find((a) => a.id === attendeeId)?.name.startsWith('ضيف ') ?? false;

// "Quick mode": +/- bed-count steppers per room card, for the common case
// where the owner doesn't need a named roster. Auto-generates lightweight
// placeholder attendees ("ضيف N") so this reuses the existing attendees/
// room_allocations tables — no new schema needed. Removing beds prefers
// dropping placeholders first, leaving named attendees (from detailed mode)
// untouched if a room has a mix of both.
export function quickAssignRoom(
  attendees: Attendee[],
  allocations: RoomAllocation[],
  room: Room,
  deltaBeds: number,
  bookingId: string
): { attendees: Attendee[]; allocations: RoomAllocation[] } {
  if (deltaBeds === 0) return { attendees, allocations };

  if (deltaBeds > 0) {
    const existingRoomCount = allocations.filter((al) => al.roomId === room.id).length;
    const newAttendees: Attendee[] = [];
    const newAllocations: RoomAllocation[] = [];
    for (let i = 0; i < deltaBeds; i++) {
      const displayIdx = attendees.length + newAttendees.length + 1;
      const attendeeId = `ph_${bookingId}_${Date.now()}_${i}`;
      newAttendees.push({
        id: attendeeId, bookingId, name: `ضيف ${displayIdx}`,
        gender: displayIdx % 2 === 0 ? 'female' : 'male', groupType: 'other',
      });
      newAllocations.push({
        id: `alloc_${bookingId}_${attendeeId}`, bookingId, attendeeId,
        roomId: room.id, bedNumber: existingRoomCount + i + 1,
      });
    }
    return { attendees: [...attendees, ...newAttendees], allocations: [...allocations, ...newAllocations] };
  }

  const roomAllocs = allocations.filter((al) => al.roomId === room.id);
  const removeCount = Math.min(-deltaBeds, roomAllocs.length);
  const sorted = [...roomAllocs].sort(
    (a, b) => (isPlaceholder(attendees, b.attendeeId) ? 1 : 0) - (isPlaceholder(attendees, a.attendeeId) ? 1 : 0)
  );
  const toRemoveAllocIds = new Set(sorted.slice(0, removeCount).map((al) => al.id));
  const toRemoveAttendeeIds = new Set(
    sorted.slice(0, removeCount).filter((al) => isPlaceholder(attendees, al.attendeeId)).map((al) => al.attendeeId)
  );
  return {
    attendees: attendees.filter((a) => !toRemoveAttendeeIds.has(a.id)),
    allocations: allocations.filter((al) => !toRemoveAllocIds.has(al.id)),
  };
}
