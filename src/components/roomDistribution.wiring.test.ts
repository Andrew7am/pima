import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Room distribution must never invent the rooms.
 *
 * Two bugs, one cause. `rooms` was fetched only when somebody opened a house
 * page or when the viewer owned the house — never for a servant arriving at
 * توزيع الغرف from حجوزاتي. So looking up the booking's assignedRoomIds found
 * nothing, and RoomDistribution reads an empty `houseRooms` as «this house has
 * no real rooms configured» and falls back to generateHouseRooms(), which
 * lays out the ENTIRE house.
 *
 *   1. The servant was shown more rooms than the owner had given them.
 *   2. They distributed people into rooms that do not exist, and the save was
 *      fired without being awaited or checked — so the screen said saved, and
 *      the work was gone on the next visit.
 *
 * Three things hold the fix together, and each is cheap to lose in a refactor.
 */

const R = process.cwd();
const app = readFileSync(join(R, 'src', 'App.tsx'), 'utf8');
const bookings = readFileSync(join(R, 'src', 'components', 'UserBookings.tsx'), 'utf8');

describe('room distribution works on real rooms', () => {
  it('opening it fetches the house rooms', () => {
    const fn = app.slice(app.indexOf('const handleOpenRoomDistribution'));
    const body = fn.slice(0, fn.indexOf('\n  }, ['));
    expect(
      body.includes('loadRoomsForHouses'),
      'handleOpenRoomDistribution must fetch the booking house\'s rooms. Without ' +
        'them assignedRoomIds resolves to nothing and RoomDistribution generates ' +
        'a layout for the whole house.',
    ).toBe(true);
  });

  it('it refuses to open on a partially resolved room list', () => {
    expect(
      bookings.includes('assignedRooms.length < assignedIds.length'),
      'UserBookings must stop when the assigned rooms cannot all be resolved. ' +
        'Passing a short list to RoomDistribution makes it invent the house.',
    ).toBe(true);
  });

  it('both saves check their result', () => {
    for (const name of ['handleUpdateAttendees', 'handleUpdateAllocations']) {
      const fn = app.slice(app.indexOf(`const ${name} =`));
      const body = fn.slice(0, fn.indexOf('\n  };'));
      expect(
        /\.then\(\s*\(ok\)/.test(body),
        `${name} must check whether the save succeeded. Firing it and ignoring ` +
          'the result is what made a refused write look identical to a saved one.',
      ).toBe(true);
    }
  });
});

/**
 * No invented people in the roster.
 *
 * RoomDistribution shipped with forty hardcoded Coptic names and a pulsing
 * «توليد كشف حضور تلقائي» button, rendered whenever the roster was empty —
 * which is every roster, once, and it was the only button in that corner. It
 * was written to make testing easy. A servant who pressed it got forty people
 * who are not coming, and nothing downstream can tell them from the real ones:
 * the room distribution, the collection tracker, the headcount, the
 * participant links.
 *
 * The CSV import and the add form beside it were always the real answer.
 */
describe('the roster is never filled with invented names', () => {
  const rd = readFileSync(join(R, 'src', 'components', 'RoomDistribution.tsx'), 'utf8');

  it('has no mock-attendee generator', () => {
    const code = rd.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    for (const marker of ['COPTIC_MOCK_NAMES', 'handleGenerateMockAttendees', 'generate-mock-attendees']) {
      expect(code.includes(marker), `${marker} is back in RoomDistribution.tsx`).toBe(false);
    }
  });

  it('still offers the two real ways to fill a roster', () => {
    expect(rd.includes('استيراد من ملف CSV')).toBe(true);
    expect(rd.includes('handleAddAttendee')).toBe(true);
  });
});
