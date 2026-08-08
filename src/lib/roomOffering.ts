import type { RetreatHouse, Room, RoomType, RoomFacility } from '../types';

/**
 * The kinds of room a house actually offers.
 *
 * The house page used to render three room types from a literal in the
 * component: «غرفة فردية فندقية», «غرفة مزدوجة / ثلاثية قياسية» and «جناح خاص
 * / للآباء الكهنة والعائلات» — each with a stock photograph, a paragraph of
 * description, a list of features (ميني بار، شرفة مستقلة، شاشة ذكية،
 * إطلالة بانورامية) and a price derived from the house's base rate by
 * multiplying it. Every house on the platform showed exactly those three,
 * whether it had them or not, and no owner could add, edit or remove one.
 * Meanwhile the rooms the owner really did enter — and the room types they
 * can define, with real facilities and prices — were sitting in props the
 * page ignored.
 *
 * This builds the list from what the owner entered, and returns nothing when
 * they have entered nothing. A house with no rooms listed says so.
 */

export const FACILITY_LABELS: Record<RoomFacility, string> = {
  ac: 'تكييف',
  bathroom: 'حمام خاص',
  tv: 'تلفزيون',
  wifi: 'واي فاي',
  fridge: 'تلاجة',
  balcony: 'شرفة',
};

export interface RoomOffering {
  id: string;
  name: string;
  /** How many people sleep in it. */
  bedsCount: number;
  /** «٣ أفراد» / «فرد واحد». */
  capacityLabel: string;
  /** Per person per night, or the monthly rent for a monthly let. */
  price: number;
  priceUnit: string;
  /** A photograph of this room, when the owner uploaded one. */
  image?: string;
  description?: string;
  features: string[];
  /** How many rooms of this kind the house has. */
  count: number;
  /** How many of those are free right now. */
  /** Hand-flagged out of service. Real date availability lives in roomOccupancy. */
  outOfServiceCount: number;
}

const peopleLabel = (n: number): string => {
  if (n <= 0) return 'غير محدد';
  if (n === 1) return 'فرد واحد';
  if (n === 2) return 'فردان';
  if (n <= 10) return `${n} أفراد`;
  return `${n} فرد`;
};

/** «غرفة بسريرين» — a name for a group of rooms that share a size. */
const nameForSize = (beds: number): string => {
  if (beds <= 0) return 'غرفة';
  if (beds === 1) return 'غرفة فردية';
  if (beds === 2) return 'غرفة بسريرين';
  if (beds === 3) return 'غرفة بثلاثة أسرّة';
  return `غرفة بـ${beds} أسرّة`;
};

export function buildRoomOfferings(
  house: RetreatHouse,
  rooms: Room[] = [],
  roomTypes: RoomType[] = [],
): RoomOffering[] {
  const isMonthly = house.propertyType === 'student' || house.propertyType === 'staff';
  const basePrice = isMonthly ? (house.monthlyRent || 0) : house.pricePerNightPerPerson;
  const priceUnit = isMonthly ? 'شهرياً' : 'لكل فرد / ليلة';
  const mine = rooms.filter((r) => r.houseId === house.id);

  // Preferred source: the room types the owner defined, which carry a name,
  // a price, facilities and a description they wrote themselves.
  const myTypes = roomTypes.filter((t) => t.houseId === house.id);
  if (myTypes.length > 0) {
    return myTypes.map((t) => {
      const ofType = mine.filter((r) => r.typeId === t.id);
      return {
        id: t.id,
        name: t.name,
        bedsCount: t.bedsCount,
        capacityLabel: peopleLabel(t.bedsCount),
        price: t.price || basePrice,
        priceUnit,
        image: ofType.find((r) => r.images?.[0])?.images[0],
        description: t.description,
        features: t.facilities.map((f) => FACILITY_LABELS[f]).filter(Boolean),
        count: ofType.length,
        /**
         * Rooms an owner has HAND-FLAGGED out of service.
         *
         * This used to be availableCount, derived from rooms.status ===
         * 'available'. Nothing in the codebase writes 'booked' any more —
         * migration 051 moved real occupancy to room_allocations, and
         * roomOccupancy.ts is the live engine — so every room that was not
         * manually flagged read as free, and the guest page told visitors
         * rooms were available on dates they were fully allocated. It
         * overstated, which is the expensive direction.
         *
         * What rooms.status still genuinely knows is the two states an owner
         * sets by hand, so that is all this reports.
         */
        outOfServiceCount: ofType.filter((r) => r.status === 'maintenance' || r.status === 'cleaning').length,
      };
    });
  }

  // Otherwise group the actual rooms by how many sleep in them, which is the
  // choice a guest is making anyway.
  if (mine.length === 0) return [];

  const bySize = new Map<number, Room[]>();
  for (const room of mine) {
    const beds = room.bedsCount || 0;
    const list = bySize.get(beds);
    if (list) list.push(room); else bySize.set(beds, [room]);
  }

  return [...bySize.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([beds, group]) => {
      // The rooms' own price where they carry one — the cheapest, so the
      // figure shown is one a guest can actually get.
      const priced = group.map((r) => r.pricePerNight).filter((p): p is number => typeof p === 'number' && p > 0);
      return {
        id: `size-${beds}`,
        name: nameForSize(beds),
        bedsCount: beds,
        capacityLabel: peopleLabel(beds),
        price: priced.length > 0 ? Math.min(...priced) : basePrice,
        priceUnit,
        image: group.find((r) => r.images?.[0])?.images[0],
        features: [],
        count: group.length,
        outOfServiceCount: group.filter((r) => r.status === 'maintenance' || r.status === 'cleaning').length,
      };
    });
}
