import type { Attendee, RoomAllocation } from '../types';

/**
 * The constraints the allocator cannot know.
 *
 * autoAllocate splits on gender and group type. That is everything the
 * database knows and none of what the servant knows: هما أخوات لازم مع بعض؛
 * الولد ده بيخاف ينام لوحده؛ الاتنين دول لو في أوضة واحدة مفيش نوم في البيت
 * كله. So he lets the machine run and then redoes it by hand — which is why
 * "automatic room allocation is solved" was only half true.
 *
 * This is a REPAIR PASS over the allocator's output rather than surgery on
 * the greedy fill itself: the fill is well covered by tests and packs against
 * real availability across overlapping bookings, and a constraint solver
 * grafted into it would put both jobs at risk. Swapping two people between
 * rooms afterwards cannot change how many beds are used, so the availability
 * guarantees the allocator establishes survive untouched.
 *
 * SAFEGUARDING. An «apart» pair is a sensitive claim about two named
 * children, so it is only ever a bare pair — migration 111 gives it no reason
 * column and no free text, because a reason typed about a minor is a
 * disclosure with no safe reader. Nothing here reads or emits one.
 *
 * The supervisor rule is the part a priest cares about: «خادم مسؤول في كل
 * أوضة» stops being something the servant hopes he remembered and becomes
 * something enforced here and provable on the printed list.
 */

export interface AttendeeLink {
  attendeeA: string;
  attendeeB: string;
  kind: 'together' | 'apart';
}

export interface LinkOutcome {
  allocations: RoomAllocation[];
  /** How many links ended up satisfied. */
  honoured: number;
  /** Pairs that could not be satisfied — reported, never hidden. */
  unmet: AttendeeLink[];
  /** Rooms with people in them but no supervisor. */
  roomsWithoutSupervisor: string[];
}

const roomOf = (allocs: RoomAllocation[], attendeeId: string) =>
  allocs.find((a) => a.attendeeId === attendeeId)?.roomId;

/** Swap two people's rooms, keeping each one's bed number with the room. */
function swap(allocs: RoomAllocation[], x: string, y: string): void {
  const ax = allocs.find((a) => a.attendeeId === x);
  const ay = allocs.find((a) => a.attendeeId === y);
  if (!ax || !ay) return;
  const room = ax.roomId, bed = ax.bedNumber;
  ax.roomId = ay.roomId; ax.bedNumber = ay.bedNumber;
  ay.roomId = room; ay.bedNumber = bed;
}

/**
 * Find someone in `targetRoom` who can trade places with `mover` without
 * breaking gender separation or any link already satisfied.
 */
function findSwapPartner(args: {
  allocs: RoomAllocation[];
  attendees: Map<string, Attendee>;
  links: AttendeeLink[];
  mover: string;
  targetRoom: string;
  separateGenders: boolean;
  /**
   * The person we are trying to reach. Swapping with THEM just exchanges the
   * two rooms and leaves the pair exactly as separated as before — which is
   * what happened the first time this ran.
   */
  keepInPlace?: string;
}): string | undefined {
  const { allocs, attendees, links, mover, targetRoom, separateGenders, keepInPlace } = args;
  const moverA = attendees.get(mover);
  const fromRoom = roomOf(allocs, mover);

  return allocs
    .filter((a) => a.roomId === targetRoom && a.attendeeId !== mover && a.attendeeId !== keepInPlace)
    .map((a) => a.attendeeId)
    .find((candidate) => {
      const c = attendees.get(candidate);
      if (!c || !moverA) return false;
      if (separateGenders && c.gender !== moverA.gender) return false;
      // Moving the candidate must not split a pair that wants to be together,
      // nor push an apart-pair into one room.
      return !links.some((l) => {
        const other = l.attendeeA === candidate ? l.attendeeB
          : l.attendeeB === candidate ? l.attendeeA : undefined;
        if (!other || other === mover) return false;
        const otherRoom = roomOf(allocs, other);
        if (l.kind === 'together') return otherRoom === targetRoom;   // would be separated
        return otherRoom === fromRoom;                                 // would be joined
      });
    });
}

export function applyAttendeeLinks(args: {
  allocations: RoomAllocation[];
  attendees: Attendee[];
  links: AttendeeLink[];
  separateGenders?: boolean;
}): LinkOutcome {
  // Copy: callers hand in the allocator's own array and may still be using it.
  const allocs = args.allocations.map((a) => ({ ...a }));
  const byId = new Map(args.attendees.map((a) => [a.id, a]));
  const separateGenders = args.separateGenders ?? true;
  const unmet: AttendeeLink[] = [];
  let honoured = 0;

  // «together» first: it is the constraint a servant notices when it is
  // broken, and satisfying it can incidentally satisfy an apart-pair too.
  const ordered = [...args.links].sort((a, b) => (a.kind === 'together' ? -1 : 1) - (b.kind === 'together' ? -1 : 1));

  for (const link of ordered) {
    const roomA = roomOf(allocs, link.attendeeA);
    const roomB = roomOf(allocs, link.attendeeB);
    // A pair whose people are not both placed cannot be judged either way.
    if (!roomA || !roomB) { unmet.push(link); continue; }

    const satisfied = link.kind === 'together' ? roomA === roomB : roomA !== roomB;
    if (satisfied) { honoured++; continue; }

    if (link.kind === 'together') {
      const partner = findSwapPartner({ allocs, attendees: byId, links: args.links, mover: link.attendeeA, targetRoom: roomB, separateGenders, keepInPlace: link.attendeeB });
      if (partner) { swap(allocs, link.attendeeA, partner); honoured++; continue; }
      // Try moving the other one instead before giving up.
      const partner2 = findSwapPartner({ allocs, attendees: byId, links: args.links, mover: link.attendeeB, targetRoom: roomA, separateGenders, keepInPlace: link.attendeeA });
      if (partner2) { swap(allocs, link.attendeeB, partner2); honoured++; continue; }
      unmet.push(link);
    } else {
      // apart: move one of them to any other room that will take him.
      const otherRooms = [...new Set(allocs.map((a) => a.roomId))].filter((r) => r !== roomA);
      const target = otherRooms.find((r) =>
        findSwapPartner({ allocs, attendees: byId, links: args.links, mover: link.attendeeA, targetRoom: r, separateGenders }));
      if (target) {
        const partner = findSwapPartner({ allocs, attendees: byId, links: args.links, mover: link.attendeeA, targetRoom: target, separateGenders })!;
        swap(allocs, link.attendeeA, partner);
        honoured++;
      } else {
        unmet.push(link);
      }
    }
  }

  return { allocations: allocs, honoured, unmet, roomsWithoutSupervisor: roomsMissingSupervisor(allocs, byId) };
}

function roomsMissingSupervisor(allocs: RoomAllocation[], byId: Map<string, Attendee & { isSupervisor?: boolean }>): string[] {
  const rooms = [...new Set(allocs.map((a) => a.roomId))];
  return rooms.filter((r) =>
    !allocs.some((a) => a.roomId === r && byId.get(a.attendeeId)?.isSupervisor));
}

/**
 * Put a responsible adult in every occupied room, where there are enough of
 * them to go round.
 *
 * Deliberately reports the rooms it could not cover instead of silently
 * doing its best: a servant who is told «كل أوضة فيها خادم» when two are not
 * is worse off than one who is told the truth and moves someone himself.
 */
export function spreadSupervisors(args: {
  allocations: RoomAllocation[];
  attendees: (Attendee & { isSupervisor?: boolean })[];
  separateGenders?: boolean;
  links?: AttendeeLink[];
}): LinkOutcome {
  const allocs = args.allocations.map((a) => ({ ...a }));
  const byId = new Map(args.attendees.map((a) => [a.id, a]));
  const separateGenders = args.separateGenders ?? true;
  const links = args.links ?? [];

  const rooms = [...new Set(allocs.map((a) => a.roomId))];
  const hasSupervisor = (room: string) =>
    allocs.some((a) => a.roomId === room && byId.get(a.attendeeId)?.isSupervisor);

  for (const room of rooms) {
    if (hasSupervisor(room)) continue;
    // Take from a room that has more than one, never from a room that would
    // then be left without.
    const spare = allocs.find((a) => {
      const p = byId.get(a.attendeeId);
      if (!p?.isSupervisor) return false;
      const inThatRoom = allocs.filter((x) => x.roomId === a.roomId && byId.get(x.attendeeId)?.isSupervisor);
      return inThatRoom.length > 1;
    });
    if (!spare) continue;

    const partner = findSwapPartner({ allocs, attendees: byId, links, mover: spare.attendeeId, targetRoom: room, separateGenders });
    if (partner) swap(allocs, spare.attendeeId, partner);
  }

  return {
    allocations: allocs, honoured: 0, unmet: [],
    roomsWithoutSupervisor: roomsMissingSupervisor(allocs, byId),
  };
}
