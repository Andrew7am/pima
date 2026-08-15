/**
 * Migration 0130, executed — not read.
 *
 * houses.image_descriptions maps an image to the owner's label for it. The
 * feature is live; the historical DATA was not. When photos moved to Supabase
 * Storage the map kept its old base64 keys, so production carried 452 KB of
 * image bytes that could no longer label anything — through the public browse
 * payload, to every anonymous visitor.
 *
 * 0130 keeps exactly the keys present in that row's own images array. The whole
 * safety argument is that a correctly-keyed label is preserved BY CONSTRUCTION,
 * so these tests exercise the real migration file against a real Postgres with
 * the 0128 trigger installed, rather than asserting the SQL text looks right.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATION = join(process.cwd(), 'supabase', 'migrations', '0130_cleanup_orphaned_image_descriptions.sql');

/**
 * Run the migration file as a migration would: exec(), not query(). The file
 * holds an UPDATE and a COMMENT ON, and the extended protocol query() uses
 * refuses more than one command. Returns the rows the UPDATE actually wrote.
 */
async function runMigration(): Promise<number> {
  const results = await db.exec(readFileSync(MIGRATION, 'utf8'));
  return results[0]?.affectedRows ?? 0;
}

/** A base64 key of the shape that was actually found in production. */
const b64 = (salt: string) => `data:image/jpeg;base64,${'A'.repeat(4000)}${salt}`;

let db: PGlite;
let firstRun: number;
let stampsBefore: Record<string, string>;
let versionsBefore: Record<string, string>;

const row = async (id: string) =>
  (await db.query<{ d: Record<string, string> | null; p: string | null }>(
    `SELECT image_descriptions d, policy_updated_at::text p FROM public.houses WHERE id = $1`, [id])).rows[0];

beforeAll(async () => {
  db = await PGlite.create();

  await db.exec(`
    CREATE TABLE public.houses (
      id TEXT PRIMARY KEY, name TEXT, status TEXT DEFAULT 'approved',
      images TEXT[], image_descriptions JSONB DEFAULT '{}',
      price_per_night_per_person NUMERIC DEFAULT 100,
      free_cancel_days INT, partial_refund_days INT, partial_refund_pct NUMERIC,
      child_free_under_age INT, booking_policy_notes TEXT, policy_updated_at TIMESTAMPTZ);
    CREATE TABLE public.platform_settings (
      id INT PRIMARY KEY, free_cancel_days INT DEFAULT 7,
      partial_refund_days INT DEFAULT 3, partial_refund_pct NUMERIC DEFAULT 0.5);
    INSERT INTO public.platform_settings (id) VALUES (1);
  `);

  // The 0128 trigger, so "it leaves policy_updated_at alone" is tested against
  // the thing that would actually change it rather than against nothing.
  await db.exec(`
    CREATE OR REPLACE FUNCTION public.touch_house_policy() RETURNS TRIGGER LANGUAGE plpgsql AS $$
    DECLARE changed BOOLEAN;
    BEGIN
      IF TG_OP = 'UPDATE' THEN
        changed := NEW.free_cancel_days     IS DISTINCT FROM OLD.free_cancel_days
                OR NEW.partial_refund_days  IS DISTINCT FROM OLD.partial_refund_days
                OR NEW.partial_refund_pct   IS DISTINCT FROM OLD.partial_refund_pct
                OR NEW.child_free_under_age IS DISTINCT FROM OLD.child_free_under_age
                OR NEW.booking_policy_notes IS DISTINCT FROM OLD.booking_policy_notes;
        IF NOT changed THEN NEW.policy_updated_at := OLD.policy_updated_at; RETURN NEW; END IF;
      END IF;
      NEW.policy_updated_at := now(); RETURN NEW;
    END $$;
    CREATE TRIGGER trg_touch_house_policy BEFORE INSERT OR UPDATE ON public.houses
      FOR EACH ROW EXECUTE FUNCTION public.touch_house_policy();
  `);

  await db.query(
    `INSERT INTO public.houses (id, name, images, image_descriptions) VALUES
       ($1, 'Production shape', ARRAY['https://s/a.jpg','https://s/b.jpg'],
            jsonb_build_object($6::text, '🛌 غرف', $7::text, '⛪ مباني')),
       ($2, 'Correctly keyed',  ARRAY['https://s/c.jpg','https://s/d.jpg'],
            jsonb_build_object('https://s/c.jpg', '🛌 غرف', 'https://s/d.jpg', '⛪ مباني')),
       ($3, 'Mixed',            ARRAY['https://s/e.jpg'],
            jsonb_build_object('https://s/e.jpg', '🍽️ خدمات', $6::text, '🛌 غرف')),
       ($4, 'Empty map',        ARRAY['https://s/f.jpg'], '{}'::jsonb),
       ($5, 'Null map',         ARRAY['https://s/g.jpg'], NULL)`,
    ['orphaned', 'good', 'mixed', 'empty', 'nulled', b64('x'), b64('y')],
  );

  stampsBefore = Object.fromEntries((await db.query<{ id: string; p: string }>(
    `SELECT id, policy_updated_at::text p FROM public.houses`)).rows.map((r) => [r.id, r.p]));
  // xmin changes only if the row is physically written — the cheapest proof
  // that untouched rows really were untouched.
  versionsBefore = Object.fromEntries((await db.query<{ id: string; v: string }>(
    `SELECT id, xmin::text v FROM public.houses`)).rows.map((r) => [r.id, r.v]));

  firstRun = await runMigration();
});

describe('migration 0130 — orphaned image_descriptions', () => {
  it('writes only the rows that actually contain an orphan', () => {
    expect(firstRun).toBe(2); // orphaned + mixed; good/empty/nulled skipped
  });

  it('removes orphaned base64 keys', async () => {
    expect(await row('orphaned').then((r) => r.d)).toEqual({});
  });

  it('preserves descriptions keyed by a current Storage URL', async () => {
    expect((await row('good')).d).toEqual({
      'https://s/c.jpg': '🛌 غرف',
      'https://s/d.jpg': '⛪ مباني',
    });
  });

  it('keeps the valid key and drops the orphan when a row has both', async () => {
    expect((await row('mixed')).d).toEqual({ 'https://s/e.jpg': '🍽️ خدمات' });
  });

  it('leaves an empty map as an empty map', async () => {
    expect((await row('empty')).d).toEqual({});
  });

  it('leaves NULL as NULL rather than coercing it to {}', async () => {
    expect((await row('nulled')).d).toBeNull();
  });

  it('does not rewrite rows that needed no change', async () => {
    const after = Object.fromEntries((await db.query<{ id: string; v: string }>(
      `SELECT id, xmin::text v FROM public.houses`)).rows.map((r) => [r.id, r.v]));
    for (const id of ['good', 'empty', 'nulled']) expect(after[id]).toBe(versionsBefore[id]);
  });

  // The 0128 stamp records when the OWNER last changed their booking policy.
  // A maintenance migration must not make it look like they just did.
  it('leaves policy_updated_at untouched, with the 0128 trigger live', async () => {
    for (const id of ['orphaned', 'mixed']) {
      expect((await row(id)).p).toBe(stampsBefore[id]);
    }
  });

  it('changes no unrelated column', async () => {
    const r = (await db.query<{ n: string; s: string; i: string[]; p: string }>(
      `SELECT name n, status s, images i, price_per_night_per_person::text p
         FROM public.houses WHERE id = 'orphaned'`)).rows[0];
    expect(r).toEqual({ n: 'Production shape', s: 'approved', i: ['https://s/a.jpg', 'https://s/b.jpg'], p: '100' });
  });

  it('is idempotent — a second run touches nothing', async () => {
    expect(await runMigration()).toBe(0);
  });

  // A payload budget expressed as a shape invariant rather than a byte count:
  // keys are URLs, so none should be anywhere near this size. It catches base64
  // coming back without breaking every time production data changes.
  it('leaves no description key larger than 2 KB', async () => {
    const worst = (await db.query<{ n: number }>(
      `SELECT COALESCE(MAX(length(e.key)), 0)::int n
         FROM public.houses h, LATERAL jsonb_each(COALESCE(h.image_descriptions, '{}'::jsonb)) e`)).rows[0].n;
    expect(worst).toBeLessThan(2048);
  });
});
