/**
 * The browse query and the view it reads must agree on their columns.
 *
 * This exists because of a real, silent production regression. Migration 0110
 * created public.houses_list so browsing would stop downloading every house's
 * full base64 photo set. Migration 0116 then added four discount columns to
 * public.houses AND to the projection loadHouses() selects — but not to the
 * view. PostgREST rejects the entire select when one column is missing:
 *
 *     42703  column houses_list.discount_pct does not exist
 *
 * loadHouses() caught that, fell back to public.houses, and the fallback selects
 * `images`. So the optimisation was dead for months while the site looked
 * completely fine — the only symptom was the egress bill it was written to fix.
 *
 * A view whose column list is written out by hand cannot be kept in step by
 * remembering to. This test is the thing that remembers.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS = join(process.cwd(), 'supabase', 'migrations');

/** The newest migration that (re)defines the view — the one in force. */
function latestViewDefinition(): { file: string; sql: string } {
  const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort();
  for (const file of [...files].reverse()) {
    const sql = readFileSync(join(MIGRATIONS, file), 'utf8');
    if (/CREATE\s+VIEW\s+public\.houses_list/i.test(sql)) return { file, sql };
  }
  throw new Error('no migration defines public.houses_list');
}

/** Column names the view exposes, including AS-aliases. */
function viewColumns(sql: string): string[] {
  const start = sql.search(/CREATE\s+VIEW\s+public\.houses_list/i);
  const end = sql.indexOf('FROM public.houses', start);
  const body = sql
    .slice(sql.indexOf('SELECT', start) + 'SELECT'.length, end)
    .replace(/--[^\n]*/g, '');            // strip line comments
  return body
    .split(',')
    .map((t) => t.trim())
    .map((t) => {
      const alias = t.match(/\bAS\s+([a-z_][a-z0-9_]*)\s*$/i);
      if (alias) return alias[1];
      return /^[a-z_][a-z0-9_]*$/.test(t) ? t : '';
    })
    .filter(Boolean);
}

/** Columns loadHouses() selects. */
function requestedColumns(): string[] {
  const db = readFileSync(join(process.cwd(), 'src', 'lib', 'db.ts'), 'utf8');
  const decl = db.match(/const HOUSE_PUBLIC_COLUMNS\s*=([\s\S]*?);\s*\n/);
  if (!decl) throw new Error('HOUSE_PUBLIC_COLUMNS not found in src/lib/db.ts');
  return (decl[1].match(/'([^']*)'/g) ?? [])
    .map((s) => s.slice(1, -1))
    .join('')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

describe('houses_list carries every column the browse query selects', () => {
  const { file, sql } = latestViewDefinition();
  const have = viewColumns(sql);
  const want = requestedColumns();

  it('parses both sides (guards the test itself against a silent no-op)', () => {
    expect(want.length).toBeGreaterThan(30);
    expect(have.length).toBeGreaterThan(30);
    expect(want).toContain('id');
    expect(have).toContain('id');
  });

  // THE regression. A missing column here means every browse request 400s and
  // quietly falls back to the full table, base64 images and all.
  it(`exposes all ${requestedColumns().length} requested columns (view: ${file})`, () => {
    const missing = want.filter((c) => !have.includes(c));
    expect(missing).toEqual([]);
  });

  it('exposes images_count, which the query appends separately', () => {
    expect(have).toContain('images_count');
  });

  // The reason the view exists. `images` must be the cover slice, never the
  // whole column — selecting it raw would reinstate the exact payload
  // migration 0110 removed.
  it('sends the cover photo only, not the whole images column', () => {
    expect(sql).toMatch(/images\[1:1\]\s+AS\s+images/i);
    expect(sql).not.toMatch(/\n\s*images\s*,/);
  });

  // payment_methods is column-revoked from anon on the table. A view is not a
  // way around that, and must never quietly become one.
  it('does not expose payment_methods', () => {
    expect(have).not.toContain('payment_methods');
  });

  // Without security_invoker the view runs as its owner and RLS on
  // public.houses stops applying — anon would see unapproved houses.
  it('keeps security_invoker so RLS still applies to the caller', () => {
    expect(sql).toMatch(/security_invoker\s*=\s*true/i);
  });

  /**
   * image_descriptions looks like an obvious thing to drop from a payload sent
   * to anonymous visitors — it is an owner-only caption map, and before
   * migration 0130 it was 452 KB of orphaned base64, 99% of the browse
   * response. Dropping it is still the wrong fix TODAY, and this pins why.
   *
   * The owner gallery reads its captions from the public browse projection:
   *
   *     loadHouses() -> HOUSE_PUBLIC_COLUMNS -> App.houses
   *       -> ownerHouses -> getEditBase() -> base.imageDescriptions
   *
   * so removing it here would silently caption every owner photo «صورة إضافية»
   * with nothing failing anywhere. 0130 removed the WEIGHT instead, leaving the
   * feature intact. Giving the owner screen its own fetch is the real fix, and
   * until someone does that, this column stays. Delete this test when they do.
   */
  it('still carries image_descriptions — the owner gallery reads captions from here', () => {
    expect(want).toContain('image_descriptions');
    expect(have).toContain('image_descriptions');
  });
});
