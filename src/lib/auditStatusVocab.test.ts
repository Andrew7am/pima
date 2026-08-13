import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The audit log writes its own Arabic at INSERT time, inside a Postgres
 * trigger — so nothing in the TypeScript build can catch it going stale. Add a
 * status to a union here and forget the migration, and the log quietly starts
 * printing a raw database key in the middle of an Arabic sentence. That is the
 * exact defect 105 was written to remove, and this is what stops it returning.
 *
 * The unions below are copied deliberately, not imported: importing the type
 * would make this test agree with whatever the type says, which is the thing
 * it is supposed to be checking against the SQL.
 */

/**
 * Located by SUFFIX, not by version number. The migrations were renumbered to
 * 0001-0126 to remove six duplicate versions that made `supabase db reset`
 * impossible, and a hardcoded `105_...` path broke this file. The name after
 * the version is the stable part.
 */
const MIGRATION_SUFFIX = '_audit_details_in_arabic.sql';
const MIGRATIONS = join(process.cwd(), 'supabase', 'migrations');
const match = readdirSync(MIGRATIONS).find((f) => f.endsWith(MIGRATION_SUFFIX));
if (!match) throw new Error(`no migration ending in ${MIGRATION_SUFFIX}`);
const SQL = readFileSync(join(MIGRATIONS, match), 'utf8');

/** Pull one `WHEN 'kind' THEN CASE value ... END` block out of the helper. */
function mappedValues(kind: string): string[] {
  const block = SQL.split(`WHEN '${kind}' THEN CASE value`)[1];
  if (!block) return [];
  const body = block.split(/\bEND\b/)[0];
  return [...body.matchAll(/WHEN\s+'([a-z_]+)'\s+THEN/g)].map((m) => m[1]);
}

const EXPECTED: Record<string, string[]> = {
  // Booking.status — src/types.ts
  booking: ['pending', 'approved', 'rejected', 'completed', 'cancelled'],
  // RetreatHouse.status
  house: ['pending', 'approved', 'rejected', 'suspended'],
  // User.approvalStatus
  approval: ['pending', 'approved', 'rejected'],
  // Payment.paymentStatus
  payment: ['pending', 'approved', 'rejected'],
  // Payout.status
  payout: ['pending', 'processing', 'completed', 'rejected'],
};

describe('the audit log can name every state the system can be in', () => {
  for (const [kind, values] of Object.entries(EXPECTED)) {
    it(`covers every ${kind} status`, () => {
      expect([...mappedValues(kind)].sort()).toEqual([...values].sort());
    });
  }

  // A word the log invents is a word somebody has to translate back.
  it('speaks Arabic in every branch', () => {
    const arabic = /[؀-ۿ]/;
    for (const kind of Object.keys(EXPECTED)) {
      const block = SQL.split(`WHEN '${kind}' THEN CASE value`)[1].split(/\bEND\b/)[0];
      const labels = [...block.matchAll(/THEN\s+'([^']+)'/g)].map((m) => m[1]);
      expect(labels.length).toBeGreaterThan(0);
      for (const label of labels) expect(arabic.test(label)).toBe(true);
    }
  });

  // An unrecognised value must survive as itself. A log that silently drops
  // what it cannot name is worse than one that shows the raw value.
  it('falls back to the raw value rather than dropping it', () => {
    expect(SQL).toMatch(/COALESCE\(value, '—'\)/);
  });

  // SECURITY DEFINER without a fixed search_path is the hole where a schema
  // earlier in the caller's path shadows a referenced object.
  it('pins search_path on every SECURITY DEFINER function it defines', () => {
    const definers = SQL.split('SECURITY DEFINER').length - 1;
    const pinned = SQL.split('SET search_path = public, pg_temp').length - 1;
    expect(definers).toBeGreaterThan(0);
    expect(pinned).toBe(definers);
  });
});
