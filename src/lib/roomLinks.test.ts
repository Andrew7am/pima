import { describe, it, expect } from 'vitest';
import { applyAttendeeLinks, spreadSupervisors, type AttendeeLink } from './roomLinks';
import type { Attendee, RoomAllocation } from '../types';

type P = Attendee & { isSupervisor?: boolean };

const person = (id: string, over: Partial<P> = {}): P => ({
  id, bookingId: 'b1', name: id, gender: 'male', groupType: 'youth', ...over,
} as P);

const alloc = (attendeeId: string, roomId: string, bedNumber = 1): RoomAllocation =>
  ({ id: `al_${attendeeId}`, bookingId: 'b1', attendeeId, roomId, bedNumber });

describe('applyAttendeeLinks', () => {
  it('puts a «together» pair in one room by swapping, not by adding a bed', () => {
    // The brothers case. A swap cannot change how many beds are used, which
    // is why the allocator's availability guarantees survive this pass.
    const attendees = [person('a'), person('b'), person('c'), person('d')];
    const allocations = [alloc('a', 'r1'), alloc('c', 'r1'), alloc('b', 'r2'), alloc('d', 'r2')];
    const links: AttendeeLink[] = [{ attendeeA: 'a', attendeeB: 'b', kind: 'together' }];

    const out = applyAttendeeLinks({ allocations, attendees, links });
    const room = (id: string) => out.allocations.find((x) => x.attendeeId === id)!.roomId;
    expect(room('a')).toBe(room('b'));
    expect(out.honoured).toBe(1);
    expect(out.unmet).toEqual([]);
    expect(out.allocations).toHaveLength(4);
    // room occupancy unchanged: still two per room
    const counts = out.allocations.reduce<Record<string, number>>((m, a) => { m[a.roomId] = (m[a.roomId] || 0) + 1; return m; }, {});
    expect(counts).toEqual({ r1: 2, r2: 2 });
  });

  it('separates an «apart» pair', () => {
    const attendees = [person('a'), person('b'), person('c'), person('d')];
    const allocations = [alloc('a', 'r1'), alloc('b', 'r1'), alloc('c', 'r2'), alloc('d', 'r2')];
    const out = applyAttendeeLinks({
      allocations, attendees, links: [{ attendeeA: 'a', attendeeB: 'b', kind: 'apart' }],
    });
    const room = (id: string) => out.allocations.find((x) => x.attendeeId === id)!.roomId;
    expect(room('a')).not.toBe(room('b'));
    expect(out.honoured).toBe(1);
  });

  it('leaves an already-satisfied link alone', () => {
    const attendees = [person('a'), person('b')];
    const allocations = [alloc('a', 'r1'), alloc('b', 'r1')];
    const out = applyAttendeeLinks({
      allocations, attendees, links: [{ attendeeA: 'a', attendeeB: 'b', kind: 'together' }],
    });
    expect(out.honoured).toBe(1);
    expect(out.allocations).toEqual(allocations);
  });

  it('never breaks gender separation to satisfy a link', () => {
    // Two girls in r2; putting a boy with his brother there would mix them.
    const attendees = [
      person('boy1'), person('boy2'),
      person('girl1', { gender: 'female' }), person('girl2', { gender: 'female' }),
    ];
    const allocations = [alloc('boy1', 'r1'), alloc('boy2', 'r1'), alloc('girl1', 'r2'), alloc('girl2', 'r2')];
    const out = applyAttendeeLinks({
      allocations, attendees, links: [{ attendeeA: 'boy1', attendeeB: 'girl1', kind: 'together' }],
    });
    const room = (id: string) => out.allocations.find((x) => x.attendeeId === id)!.roomId;
    expect(room('boy1')).not.toBe(room('girl1'));
    expect(out.unmet).toHaveLength(1);       // reported, not silently dropped
    expect(out.honoured).toBe(0);
  });

  it('reports a link it cannot satisfy rather than pretending', () => {
    // Only one room exists, so an apart-pair is impossible.
    const attendees = [person('a'), person('b')];
    const out = applyAttendeeLinks({
      allocations: [alloc('a', 'r1'), alloc('b', 'r1')], attendees,
      links: [{ attendeeA: 'a', attendeeB: 'b', kind: 'apart' }],
    });
    expect(out.unmet).toEqual([{ attendeeA: 'a', attendeeB: 'b', kind: 'apart' }]);
  });

  it('does not satisfy one link by breaking another', () => {
    const attendees = [person('a'), person('b'), person('c'), person('d')];
    const allocations = [alloc('a', 'r1'), alloc('c', 'r1'), alloc('b', 'r2'), alloc('d', 'r2')];
    const out = applyAttendeeLinks({
      allocations, attendees,
      links: [
        { attendeeA: 'a', attendeeB: 'b', kind: 'together' },
        { attendeeA: 'c', attendeeB: 'd', kind: 'together' },
      ],
    });
    const room = (id: string) => out.allocations.find((x) => x.attendeeId === id)!.roomId;
    expect(room('a')).toBe(room('b'));
    expect(room('c')).toBe(room('d'));
    expect(out.honoured).toBe(2);
  });

  it('ignores a pair whose people were never placed', () => {
    const out = applyAttendeeLinks({
      allocations: [alloc('a', 'r1')], attendees: [person('a'), person('ghost')],
      links: [{ attendeeA: 'a', attendeeB: 'ghost', kind: 'together' }],
    });
    expect(out.unmet).toHaveLength(1);
  });

  it('does not mutate the array it was given', () => {
    // Callers hand in the allocator's own output and may still be using it.
    const allocations = [alloc('a', 'r1'), alloc('b', 'r2')];
    const snapshot = JSON.stringify(allocations);
    applyAttendeeLinks({
      allocations, attendees: [person('a'), person('b')],
      links: [{ attendeeA: 'a', attendeeB: 'b', kind: 'together' }],
    });
    expect(JSON.stringify(allocations)).toBe(snapshot);
  });
});

describe('spreadSupervisors', () => {
  it('moves a spare supervisor into a room that has none', () => {
    const attendees = [
      person('s1', { isSupervisor: true }), person('s2', { isSupervisor: true }),
      person('k1'), person('k2'),
    ];
    // Both supervisors in r1; r2 has none.
    const allocations = [alloc('s1', 'r1'), alloc('s2', 'r1'), alloc('k1', 'r2'), alloc('k2', 'r2')];
    const out = spreadSupervisors({ allocations, attendees });
    expect(out.roomsWithoutSupervisor).toEqual([]);
  });

  it('never strips the last supervisor out of a room to cover another', () => {
    // One each in r1 and r2, none in r3. Robbing either would just move the
    // hole, so it reports r3 instead.
    const attendees = [
      person('s1', { isSupervisor: true }), person('s2', { isSupervisor: true }),
      person('k1'), person('k2'), person('k3'),
    ];
    const allocations = [
      alloc('s1', 'r1'), alloc('k1', 'r1'),
      alloc('s2', 'r2'), alloc('k2', 'r2'),
      alloc('k3', 'r3'),
    ];
    const out = spreadSupervisors({ allocations, attendees });
    expect(out.roomsWithoutSupervisor).toEqual(['r3']);
  });

  it('says which rooms are uncovered instead of claiming they all are', () => {
    // A servant told «كل أوضة فيها خادم» when two are not is worse off than
    // one told the truth and moving someone himself.
    const attendees = [person('k1'), person('k2')];
    const out = spreadSupervisors({ allocations: [alloc('k1', 'r1'), alloc('k2', 'r2')], attendees });
    expect(out.roomsWithoutSupervisor.sort()).toEqual(['r1', 'r2']);
  });

  it('respects gender separation when moving a supervisor', () => {
    const attendees = [
      person('s1', { isSupervisor: true }), person('s2', { isSupervisor: true }),
      person('g1', { gender: 'female' }), person('g2', { gender: 'female' }),
    ];
    const allocations = [alloc('s1', 'r1'), alloc('s2', 'r1'), alloc('g1', 'r2'), alloc('g2', 'r2')];
    const out = spreadSupervisors({ allocations, attendees });
    // No male supervisor may enter the girls' room, so r2 stays reported.
    expect(out.roomsWithoutSupervisor).toEqual(['r2']);
  });
});
