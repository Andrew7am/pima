/**
 * Migration filename guard.
 *
 * This exists because of a real release blocker: six version numbers (101, 104,
 * 105, 106, 107, 108) were each used by two migration files. Supabase tracks
 * applied migrations in supabase_migrations.schema_migrations keyed on that
 * numeric prefix, so `supabase db reset` and `supabase migration up` both
 * aborted with
 *
 *   duplicate key value violates unique constraint "schema_migrations_pkey"
 *   Key (version)=(101) already exists
 *
 * A fresh environment could not be provisioned at all, and the local database
 * had been silently stranded at 98 of 125 migrations for weeks.
 *
 * It was not only a provisioning problem. Because 101_arabic_notification_text
 * claimed version 101 first, 101_waiting_room_heartbeat NEVER RAN, and the
 * function it creates (touch_waiting_room) was simply absent from the database.
 * A duplicate version silently drops a migration.
 *
 * Cheapest reliable place for this check is the test suite that already runs in
 * CI, rather than a new workflow.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(process.cwd(), 'supabase', 'migrations');
const files = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();

/** `0007_name.sql` -> `0007`. Null when the name does not carry a version. */
const versionOf = (f: string): string | null => {
  const m = /^(\d+)_/.exec(f);
  return m ? m[1] : null;
};

describe('migration filenames', () => {
  it('finds migrations to check', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('every file carries a numeric version prefix', () => {
    const bad = files.filter((f) => versionOf(f) === null);
    expect(bad, `malformed migration names: ${bad.join(', ')}`).toEqual([]);
  });

  it('no two migrations share a version — the bug that blocked the release', () => {
    const seen = new Map<string, string[]>();
    for (const f of files) {
      const v = versionOf(f)!;
      seen.set(v, [...(seen.get(v) ?? []), f]);
    }
    const dupes = [...seen.entries()].filter(([, fs]) => fs.length > 1);
    expect(
      dupes.map(([v, fs]) => `${v}: ${fs.join(' + ')}`),
      'duplicate migration versions silently drop a migration and break db reset',
    ).toEqual([]);
  });

  it('versions are fixed-width, so lexical and numeric order cannot disagree', () => {
    // "1015" sorts before "102" as text but after it as a number. Equal width
    // removes the ambiguity entirely, whichever way the tooling sorts.
    const widths = new Set(files.map((f) => versionOf(f)!.length));
    expect([...widths], `mixed version widths: ${[...widths].join(', ')}`).toHaveLength(1);
  });

  it('sorting by filename matches sorting by numeric version', () => {
    const byName = files.map((f) => versionOf(f)!);
    const byNumber = [...byName].sort((a, b) => Number(a) - Number(b));
    expect(byName).toEqual(byNumber);
  });

  it('versions are contiguous from 1, so none was dropped or double-allocated', () => {
    const nums = files.map((f) => Number(versionOf(f))).sort((a, b) => a - b);
    expect(nums[0]).toBe(1);
    const gaps = nums.filter((n, i) => i > 0 && n !== nums[i - 1] + 1);
    expect(gaps, `non-contiguous at: ${gaps.join(', ')}`).toEqual([]);
  });
});

/**
 * submit_answer's OUT names collide with its own columns.
 *
 * `RETURNS TABLE(host_score INT, guest_score INT, ...)` creates plpgsql
 * variables named after two real game_rooms columns, so a bare `host_score` on
 * the right of `SET host_score = host_score + gained` is ambiguous and Postgres
 * raises rather than guess. Every answer in every live match fails, and the
 * match cannot advance because current_question only moves when both players
 * have answered.
 *
 * This has shipped twice. 0039 fixed it by aliasing the table; 0106 rewrote the
 * body to add the round multiplier and dropped the alias, restoring the bug in
 * the one line the alias existed to protect. The fix lived only as a habit
 * inside one function body, so the next rewrite lost it.
 *
 * 0155 adds `#variable_conflict use_column`, which resolves the collision at
 * the language level however the body is written. This test keeps it there.
 */
describe('submit_answer cannot become ambiguous again', () => {
  it('the newest migration defining it declares #variable_conflict use_column', () => {
    const defining = files.filter((f) =>
      readFileSync(join(DIR, f), 'utf8').includes('FUNCTION public.submit_answer'));

    expect(defining.length).toBeGreaterThan(0);

    const newest = defining[defining.length - 1];
    const sql = readFileSync(join(DIR, newest), 'utf8');

    const declared = /^[ 	]*#variable_conflict[ 	]+use_column[ 	]*$/m.test(sql);

    expect(
      declared,
      `${newest} redefines submit_answer without "#variable_conflict use_column". ` +
        'Without it, `SET host_score = host_score + …` is ambiguous between the OUT ' +
        'parameter and the column, and every answer in a live match fails. See 0039 and 0155.',
    ).toBe(true);
  });
});
