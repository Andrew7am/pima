/**
 * The PIMA page-container architecture.
 *
 * Reads index.css for the same reason theme.test.tsx does: these are CSS-layer
 * facts that no component owns, and asserting them through a render would test
 * the fixture rather than the system.
 *
 * What this protects is the thing that made the audit necessary — the app had
 * 163 max-width declarations across 38 tokens with only 9 responsive. These
 * four tiers exist so screens stop inventing widths, and the Entertainment
 * alias exists so there is exactly one wide tier rather than two that drift.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const CSS = readFileSync(join(process.cwd(), 'src', 'index.css'), 'utf8');

/** The declaration block(s) whose selector list mentions `cls`, in source order. */
function blocks(cls: string): string[] {
  const out: string[] = [];
  // selector list (may span lines and include siblings) followed by its block
  const re = new RegExp('([^{}]*\\.' + cls + '\\b[^{}]*)\\{([^}]*)\\}', 'g');
  for (const m of CSS.matchAll(re)) out.push(m[2].replace(/\s+/g, ' ').trim());
  return out;
}

describe('page containers — the four semantic tiers exist', () => {
  for (const tier of ['pima-page-narrow', 'pima-page-content', 'pima-page-wide', 'pima-page-full']) {
    it(`.${tier} is defined and centres direction-agnostically`, () => {
      const b = blocks(tier);
      expect(b.length, `.${tier} has no rules`).toBeGreaterThan(0);
      // margin-inline, not margin-left/right — this is what makes RTL safe.
      expect(b[0]).toMatch(/margin-inline:\s*auto/);
      expect(b[0]).toMatch(/width:\s*100%/);
    });
  }

  it('narrow lands in its 520–640 semantic range', () => {
    expect(CSS).toMatch(/\.pima-page-narrow\s*\{\s*max-width:\s*34rem/);   // 544 @ 640
    expect(CSS).toMatch(/\.pima-page-narrow\s*\{\s*max-width:\s*40rem/);   // 640 @ 1024
  });

  it('content lands in its 720–860 semantic range', () => {
    expect(CSS).toMatch(/\.pima-page-content\s*\{\s*max-width:\s*45rem/);      // 720 @ 768
    expect(CSS).toMatch(/\.pima-page-content\s*\{\s*max-width:\s*53\.75rem/);  // 860 @ 1280
  });

  it('full imposes no max-width — that is the whole point of the tier', () => {
    for (const b of blocks('pima-page-full')) {
      expect(b, 'pima-page-full must not cap width').not.toMatch(/max-width/);
    }
  });
});

describe('page containers — Entertainment aliases rather than duplicates', () => {
  it('.pima-play-wide shares .pima-page-wide\'s selector list, so they cannot drift', () => {
    // A copy could be edited on one side only. A shared selector list cannot.
    const shared = CSS.match(/\.pima-page-wide,\s*\r?\n?\s*\.pima-play-wide/g) || [];
    expect(shared.length, 'the alias must be a shared selector, not a duplicated block').toBeGreaterThan(0);
    // Every selector-position .pima-play-wide must belong to that shared list.
    // If one ever appears on its own, a second wide system has been reintroduced.
    const asSelector = CSS.match(/\.pima-play-wide\s*[,{]/g) || [];
    expect(asSelector.length, '.pima-play-wide appears outside the shared list').toBe(shared.length);
  });

  it('preserves the measured Entertainment desktop widths exactly', () => {
    // 1160 @ 1280 and 1320 @ 1440 were browser-measured during the
    // Entertainment pass. The generalisation must not move them.
    expect(CSS).toMatch(/\.pima-page-wide,\s*\.pima-play-wide\s*\{\s*max-width:\s*1160px/);
    expect(CSS).toMatch(/\.pima-page-wide,\s*\.pima-play-wide\s*\{\s*max-width:\s*1320px/);
  });

  it('keeps .pima-play-mid as a documented local tier, not a fifth global one', () => {
    // It sits between content and wide; none of the four carries 1040/1160.
    expect(CSS).toMatch(/\.pima-play-mid\s*\{\s*max-width:\s*1040px/);
    expect(CSS).toMatch(/\.pima-play-mid\s*\{\s*max-width:\s*1160px/);
    expect(CSS).not.toMatch(/\.pima-page-mid\b/);
  });
});
