import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Every field a mapper is supposed to fill, filled.
 *
 * A field added to a type and forgotten in its row mapper reads back as
 * undefined for ever. The types line up, the build passes, and the feature
 * behaves perfectly in the tab that set it — so this is only ever found by
 * somebody using the app twice. It has shipped five times:
 *
 *   notificationsLog   — the servant's announcements
 *   instantAlert       — the emergency notice, under a toast saying «تم البث»
 *   presentationSlides — a whole deck, used in 38 places
 *   activeSlideId      — which slide the room is looking at
 *   commissionRate     — and this one is money
 *
 * The last is the reason this test covers every mapper and not just
 * conferences. Migration 0113 froze the commission rate onto each booking so
 * that raising the platform rate could not recompute what owners were owed on
 * deals already closed — in some cases on money already transferred. The money
 * layer was written for it: rateOf() prefers booking.commissionRate and falls
 * back to the live rate only for rows predating the column. mapBooking never
 * read the column, so the value was undefined on every booking and the
 * fallback ran every single time. The migration existed and did nothing, and
 * nothing anywhere said so.
 *
 * Exceptions are listed, not inferred. Each one states why the mapper is right
 * to skip the field — which also means this file is the register of every
 * field the app shows without a column behind it.
 */

const R = process.cwd();
const types = readFileSync(join(R, 'src', 'types.ts'), 'utf8');
const db = readFileSync(join(R, 'src', 'lib', 'db.ts'), 'utf8');

/** `${Type}.${field}` -> why the mapper does not set it. */
const EXPECTED_GAPS: Record<string, string> = {
  'User.pointsHistory':
    'fetched by its own query and merged in loadUserProfile — not a column on users',

  // Entertainment fields with no column anywhere. They are not mapper bugs;
  // they are features that were never given storage, and every account gets
  // the same default. Recorded here so that stays a known fact.
  'User.streak':
    'NO COLUMN. EntertainmentHome shows «أيام التوالي» from `currentUser.streak ?? 1`, ' +
    'so every account shows 1 for ever. Either give it a column or stop showing it.',
  'User.profileTitle':
    'NO COLUMN. EntertainmentHome falls back to «خادم مبتدئ 🕯️», so every account ' +
    'carries that title for ever. Either give it a column or stop showing it.',
  'User.avatar':
    'NO COLUMN. Separate from avatarUrl: an emoji the ported games use, ' +
    'defaulted to ⛪ at each call site in InteractiveRoom.',
  'User.equippedAssists':
    'NO COLUMN and no reader anywhere in src — a leftover on the type.',
};

const mapperNames = [...db.matchAll(/function map([A-Z]\w*)\s*\(/g)].map((m) => m[1]);

const bodyOf = (name: string) => {
  const i = db.indexOf(`function map${name}(`);
  if (i < 0) return '';
  const rest = db.slice(i + 10);
  const j = rest.search(/\n(export )?(function|const|type|interface) /);
  return j < 0 ? rest : rest.slice(0, j);
};

const fieldsOf = (name: string) => {
  const m = types.match(new RegExp(`export interface ${name} \\{([\\s\\S]*?)\\n\\}`));
  return m ? [...m[1].matchAll(/^ {2}(\w+)\??:/gm)].map((x) => x[1]) : null;
};

describe('row mappers fill the type they claim to', () => {
  it('finds the mappers', () => {
    expect(mapperNames.length).toBeGreaterThan(10);
  });

  it('no field is silently dropped', () => {
    const dropped: string[] = [];

    for (const name of mapperNames) {
      const fields = fieldsOf(name);
      if (!fields || fields.length === 0) continue;
      const body = bodyOf(name);
      for (const f of fields) {
        const key = `${name}.${f}`;
        if (EXPECTED_GAPS[key]) continue;
        // `field:` at the start of a property, not `something.field:`
        if (!new RegExp(`(^|[^.\\w])${f}\\s*:`, 'm').test(body)) dropped.push(key);
      }
    }

    expect(
      dropped,
      'These fields are never set by their mapper, so they read back as undefined ' +
        `however well the app behaves in one tab: ${dropped.join(', ')}. ` +
        'If the mapper is right to skip one, add it to EXPECTED_GAPS with the reason.',
    ).toEqual([]);
  });

  it('every listed exception is still a real field', () => {
    const stale = Object.keys(EXPECTED_GAPS).filter((key) => {
      const [type, field] = key.split('.');
      const fields = fieldsOf(type);
      return !fields || !fields.includes(field);
    });
    expect(
      stale,
      `EXPECTED_GAPS names fields that no longer exist: ${stale.join(', ')}. ` +
        'A stale exception is a hole the next mistake can fall through.',
    ).toEqual([]);
  });
});
