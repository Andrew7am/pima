import { describe, it, expect } from 'vitest';
import { buildRoomOfferings, FACILITY_LABELS } from './roomOffering';
import type { RetreatHouse, Room, RoomType } from '../types';

const house = (over: Partial<RetreatHouse> = {}): RetreatHouse => ({
  id: 'h1', name: 'بيت', description: '', ownerId: 'o1', ownerName: 'مالك',
  governorate: 'القاهرة', address: '', lat: 0, lng: 0,
  roomsCount: 0, bedsCount: 0, roomsDescription: '',
  pricePerNightPerPerson: 200, services: [], suitability: [],
  conferenceHalls: [], restaurants: [], activities: [], paymentMethods: [],
  images: [], status: 'approved', rating: 0, reviewsCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
} as RetreatHouse);

const room = (over: Partial<Room> = {}): Room => ({
  id: 'r1', houseId: 'h1', name: '101', bedsCount: 2,
  images: [], status: 'available', createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

const type = (over: Partial<RoomType> = {}): RoomType => ({
  id: 't1', houseId: 'h1', name: 'غرفة مكيفة', price: 250, bedsCount: 2,
  facilities: ['ac', 'bathroom'], createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

describe('buildRoomOfferings', () => {
  it('offers nothing when the owner has entered nothing', () => {
    // The whole point. The page used to show three fabricated room types —
    // including a «جناح خاص للآباء الكهنة» — on every house alive.
    expect(buildRoomOfferings(house(), [], [])).toEqual([]);
  });

  it('never invents a description or a feature', () => {
    const [offering] = buildRoomOfferings(house(), [room()], []);
    expect(offering.features).toEqual([]);
    expect(offering.description).toBeUndefined();
    expect(offering.image).toBeUndefined();
  });

  describe('from the owner’s room types', () => {
    it('uses their name, price, beds and facilities', () => {
      const [o] = buildRoomOfferings(house(), [], [type()]);
      expect(o.name).toBe('غرفة مكيفة');
      expect(o.price).toBe(250);
      expect(o.bedsCount).toBe(2);
      expect(o.features).toEqual([FACILITY_LABELS.ac, FACILITY_LABELS.bathroom]);
    });

    it('counts the rooms of that type, and how many are free', () => {
      const rooms = [
        room({ id: 'a', typeId: 't1', status: 'available' }),
        room({ id: 'b', typeId: 't1', status: 'booked' }),
        room({ id: 'c', typeId: 't1', status: 'maintenance' }),
        room({ id: 'd', typeId: 'other', status: 'available' }),
      ];
      const [o] = buildRoomOfferings(house(), rooms, [type()]);
      expect(o.count).toBe(3);
      expect(o.availableCount).toBe(1);
    });

    it('shows a real photograph when one of those rooms has one', () => {
      const rooms = [room({ id: 'a', typeId: 't1', images: [] }), room({ id: 'b', typeId: 't1', images: ['photo.jpg'] })];
      expect(buildRoomOfferings(house(), rooms, [type()])[0].image).toBe('photo.jpg');
    });

    it('falls back to the house price when the type carries none', () => {
      const [o] = buildRoomOfferings(house({ pricePerNightPerPerson: 180 }), [], [type({ price: 0 })]);
      expect(o.price).toBe(180);
    });
  });

  describe('from the rooms themselves, when no types are defined', () => {
    it('groups them by how many sleep in the room', () => {
      const rooms = [
        room({ id: 'a', bedsCount: 2 }), room({ id: 'b', bedsCount: 2 }),
        room({ id: 'c', bedsCount: 4 }), room({ id: 'd', bedsCount: 1 }),
      ];
      const out = buildRoomOfferings(house(), rooms, []);
      expect(out.map((o) => o.bedsCount)).toEqual([1, 2, 4]);
      expect(out.map((o) => o.count)).toEqual([1, 2, 1]);
    });

    it('names a group after its size in Arabic', () => {
      const out = buildRoomOfferings(house(), [
        room({ id: 'a', bedsCount: 1 }), room({ id: 'b', bedsCount: 2 }), room({ id: 'c', bedsCount: 3 }),
      ], []);
      expect(out.map((o) => o.name)).toEqual(['غرفة فردية', 'غرفة بسريرين', 'غرفة بثلاثة أسرّة']);
    });

    it('quotes the cheapest real price in the group, not an average', () => {
      // Whatever is shown has to be a price somebody can actually book.
      const rooms = [
        room({ id: 'a', bedsCount: 2, pricePerNight: 300 }),
        room({ id: 'b', bedsCount: 2, pricePerNight: 220 }),
      ];
      expect(buildRoomOfferings(house(), rooms, [])[0].price).toBe(220);
    });

    it('falls back to the house price for rooms that carry none', () => {
      const rooms = [room({ id: 'a', bedsCount: 2, pricePerNight: undefined })];
      expect(buildRoomOfferings(house({ pricePerNightPerPerson: 175 }), rooms, [])[0].price).toBe(175);
    });
  });

  it('ignores rooms and types belonging to another house', () => {
    const out = buildRoomOfferings(
      house({ id: 'h1' }),
      [room({ id: 'x', houseId: 'h2' })],
      [type({ id: 'tx', houseId: 'h2' })],
    );
    expect(out).toEqual([]);
  });

  it('prices a monthly let by the month, not per night', () => {
    const out = buildRoomOfferings(
      house({ propertyType: 'student', monthlyRent: 1800 }),
      [room({ bedsCount: 1 })],
      [],
    );
    expect(out[0].price).toBe(1800);
    expect(out[0].priceUnit).toBe('شهرياً');
  });

  it('reads the person count in Arabic rather than a bare number', () => {
    const out = buildRoomOfferings(house(), [
      room({ id: 'a', bedsCount: 1 }), room({ id: 'b', bedsCount: 2 }), room({ id: 'c', bedsCount: 5 }),
    ], []);
    expect(out.map((o) => o.capacityLabel)).toEqual(['فرد واحد', 'فردان', '5 أفراد']);
  });
});
