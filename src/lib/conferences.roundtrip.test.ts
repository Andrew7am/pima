import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Every field of a conference has to survive the round trip.
 *
 * This bug has shipped four times, always the same way: a field is added to the
 * ConferenceRoom type and used in the hub, and the row mapper in
 * lib/conferences.ts is not widened to match. The feature then works perfectly
 * in the tab it was used in and nowhere else — it does not survive a reload on
 * the author's own phone, and no participant ever sees it.
 *
 *   notificationsLog   — the servant's announcements
 *   instantAlert       — the emergency notice, under a toast saying «تم البث»
 *   presentationSlides — a whole deck, used in 38 places in the hub
 *   activeSlideId      — which slide the room is looking at
 *
 * Nothing caught any of them: the types line up, the build passes, and the
 * screen behaves. Only opening it twice reveals it.
 *
 * So: read the type and the mapper, and require every field to appear in the
 * Row type, in toRoom, and in toRow — unless it is listed below with a reason.
 */

const R = join(process.cwd());
const types = readFileSync(join(R, 'src', 'types.ts'), 'utf8');
const lib = readFileSync(join(R, 'src', 'lib', 'conferences.ts'), 'utf8');

/**
 * Fields the client deliberately does not write back. Each is stamped by the
 * server and would be clobbered by a client save, so writing them is the bug,
 * not omitting them.
 */
const NOT_CLIENT_WRITABLE: Record<string, string> = {
  houseGovernorate: 'venue, stamped by create_conference_for_booking (0137)',
  houseAddress: 'venue, stamped by create_conference_for_booking (0137)',
  houseLat: 'venue, stamped by create_conference_for_booking (0137)',
  houseLng: 'venue, stamped by create_conference_for_booking (0137)',
  hostPhone: 'the organiser, stamped server-side (0137)',
  instantAlert: 'written only by broadcast_conference_alert (0160), which checks the sender is the host',
};

/** Fields with no database column at all, and why that is acceptable. */
const NOT_PERSISTED: Record<string, string> = {
  pendingUserRequests:
    'approval_needed is not implemented end to end — see 0134. The column is ' +
    'deliberately absent rather than half-present: storing requests while RLS ' +
    'still admits everyone would make the setting look enforced when it is not.',
};

const between = (src: string, start: string, end: string) => {
  const i = src.indexOf(start);
  if (i < 0) return '';
  const j = src.indexOf(end, i);
  return j < 0 ? '' : src.slice(i, j);
};

const snake = (s: string) => s.replace(/[A-Z]/g, (ch) => '_' + ch.toLowerCase());

describe('a conference field survives the round trip', () => {
  const body = types.match(/export interface ConferenceRoom \{([\s\S]*?)\n\}/);
  const fields = body ? [...body[1].matchAll(/^ {2}(\w+)\??:/gm)].map((m) => m[1]) : [];

  const rowType = between(lib, 'type Row = {', '\n};');
  const toRoomBody = between(lib, 'const toRoom', '\n});');
  const toRowBody = between(lib, 'const toRow', '\n});');

  it('finds the type and both mappers', () => {
    expect(fields.length).toBeGreaterThan(20);
    expect(rowType.length).toBeGreaterThan(100);
    expect(toRoomBody.length).toBeGreaterThan(100);
    expect(toRowBody.length).toBeGreaterThan(100);
  });

  it('every field is read back', () => {
    const missing = fields.filter((f) => {
      if (NOT_PERSISTED[f]) return false;
      const col = snake(f);
      return !new RegExp(`\\b${col}\\b`).test(rowType) || !new RegExp(`\\b${f}:`).test(toRoomBody);
    });
    expect(
      missing,
      `ConferenceRoom fields missing from the Row type or toRoom: ${missing.join(', ')}. ` +
        'They will read back as undefined however well the hub behaves in one tab.',
    ).toEqual([]);
  });

  it('every field is written, or is listed as server-owned', () => {
    const missing = fields.filter((f) => {
      if (NOT_PERSISTED[f] || NOT_CLIENT_WRITABLE[f]) return false;
      return !new RegExp(`\\b${snake(f)}:`).test(toRowBody);
    });
    expect(
      missing,
      `ConferenceRoom fields missing from toRow: ${missing.join(', ')}. ` +
        'The hub will appear to save them and they will be dropped — the bug ' +
        'that hid the announcements, the emergency alert and the whole slide deck. ' +
        'If the field is written server-side instead, add it to NOT_CLIENT_WRITABLE with the reason.',
    ).toEqual([]);
  });
});
