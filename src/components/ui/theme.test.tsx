import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Phase 3's contract, enforced as tests rather than trusted as a convention.
//
// Two properties matter and neither is visible in a rendered DOM: that the
// components name no palette, and that every theme binds every role. Both are
// facts about the SOURCE, so these read the source. A component that quietly
// grows an `if (theme === 'owner')` still renders fine — it just moves the
// theme's knowledge into the wrong place, and nothing else here would catch it.

const UI = join(process.cwd(), 'src', 'components', 'ui');
const COMPONENTS = ['Button', 'Card', 'Input', 'Badge', 'EmptyState', 'Skeleton'];

// Line endings normalised to LF. The working copy is CRLF on Windows and every
// lookup below searches for a newline followed by a selector; without this the
// cascade-order test found nothing and failed against a file that was correct.
const CSS = readFileSync(join(process.cwd(), 'src', 'index.css'), 'utf8')
  .split('\r\n').join('\n');

// The same CSS with comments removed. Structural checks must run on this:
// the binding block's own prose mentions `.owner-dark` while explaining why
// that selector needs no bindings, and a regex looking for "`.owner-dark`
// followed by --ds-" happily matched the sentence and then ran on into the
// next rule. The test was wrong, not the stylesheet.
const CSS_CODE = CSS.replace(/\/\*[\s\S]*?\*\//g, '');

/** Component source with its doc comment stripped — prose may discuss a
 *  palette to explain a decision; only the CODE must stay theme-free. */
function code(name: string): string {
  return readFileSync(join(UI, `${name}.tsx`), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

/** The declarations inside one CSS rule block, by selector. */
function block(selector: string): string {
  const i = CSS.indexOf(`\n${selector} {`);
  if (i === -1) throw new Error(`no rule block for ${selector}`);
  return CSS.slice(i, CSS.indexOf('\n}', i));
}

const ROLES = [
  'bg', 'surface', 'raised', 'text', 'text-2', 'text-faint', 'border',
  'primary', 'on-primary', 'accent', 'on-accent',
  // Added by the first real-screen migration: the dark identity panel. A role
  // only one theme binds is not a role, so all four bind it.
  'brand', 'brand-2', 'on-brand',
  'success', 'on-success', 'success-ink',
  'warning', 'on-warning', 'warning-ink',
  'danger', 'on-danger', 'danger-ink',
];

const THEMES = [':root', '.owner-theme', '.admin-theme', '.play-theme'];

describe('components are theme-agnostic', () => {
  it.each(COMPONENTS)('%s names no palette and no literal colour', (name) => {
    const src = code(name);
    expect(src).not.toMatch(/--color-natural-/);
    expect(src).not.toMatch(/--color-owner-/);
    expect(src).not.toMatch(/--color-play-/);
    // A hex in the code would pin one theme's look into the component.
    expect(src).not.toMatch(/#[0-9A-Fa-f]{6}\b/);
  });

  it.each(COMPONENTS)('%s contains no theme branching', (name) => {
    const src = code(name);
    // The exact shape the spec forbids: if owner… / if admin… / if entertainment…
    expect(src).not.toMatch(/\b(owner|admin|entertainment|play)Theme\b/i);
    expect(src).not.toMatch(/theme\s*===/i);
    expect(src).not.toMatch(/isOwner|isAdmin|isPlay/i);
  });

  it('every component that uses colour goes through a --ds- role', () => {
    for (const name of COMPONENTS) {
      const src = code(name);
      if (/var\(--/.test(src)) expect(src, name).toMatch(/var\(--ds-/);
    }
  });
});

describe('every theme binds every role', () => {
  it.each(THEMES)('%s defines all 23 roles', (selector) => {
    const b = block(selector);
    const missing = ROLES.filter((r) => !b.includes(`--ds-${r}:`));
    expect(missing, `${selector} is missing: ${missing.join(', ')}`).toEqual([]);
  });

  it('owner night mode needs no block of its own', () => {
    // .owner-dark already redefines the --color-owner-* tokens, and the owner
    // bindings are aliases to those. A var() resolves where it is used, so the
    // dark palette flows through automatically. A second binding block would
    // be a copy to keep in sync — this pins the reasoning so nobody adds one
    // "for completeness" later.
    expect(CSS_CODE).not.toMatch(/\.owner-dark[^{]*\{[^}]*--ds-/);
    expect(block('.owner-theme')).toMatch(/--ds-primary:\s*var\(--color-owner-primary\)/);
  });

  it('keeps the theme blocks below the default so the cascade resolves', () => {
    // :root and .owner-theme both score (0,1,0) — order alone decides. If the
    // default ever moved below a theme, guest colours would win inside the
    // owner panel, and the bug would look like "the panel is the wrong colour"
    // rather than a specificity tie.
    const root = CSS.indexOf('\n:root {\n  --ds-bg:');
    expect(root).toBeGreaterThan(-1);
    for (const t of ['.owner-theme', '.admin-theme', '.play-theme']) {
      expect(CSS.indexOf(`\n${t} {`), t).toBeGreaterThan(root);
    }
  });
});

describe('entertainment leads with gold, not indigo', () => {
  // The approved direction changed: entertainment is a WARM dark room where
  // Pima's gold is the main action and the winning colour, and indigo is a
  // limited supporting accent. An earlier version of this suite asserted the
  // opposite — indigo as primary — and failing on that change is exactly what
  // it was for.

  it('binds primary to Pima gold', () => {
    const play = block('.play-theme');
    expect(play).toMatch(/--ds-primary:\s*var\(--color-play-gold\)/);
    // Indigo must not be the button colour in any form: making the most-used
    // control indigo is what made the games read as a separate product.
    expect(play).not.toMatch(/--ds-primary:\s*var\(--color-play-indigo/);
  });

  it('pairs gold with dark ink, never white', () => {
    // White on #C5A059 is 2.46:1. Dark ink is 7.45:1.
    expect(block('.play-theme')).toMatch(/--ds-on-primary:\s*var\(--color-play-on-gold\)/);
    expect(CSS).toMatch(/--color-play-on-gold:\s*#1A1408/i);
  });

  it('uses a warm base, not the original cool slate', () => {
    // #17130F is warm; the #151A26 it replaced was blue-tinted, and a
    // blue-grey room with an indigo button is a gaming product that happens
    // to be bundled here rather than Pima's own.
    expect(CSS).toMatch(/--color-play-surface:\s*#17130F/i);
  });

  it('lightens the supporting indigo so it clears AA as text', () => {
    // #6366F1 measures 3.77:1 on the warm surface — under AA even as text,
    // which is the only role it still has. #8B8CF7 measures 5.77:1.
    expect(CSS).toMatch(/--color-play-indigo:\s*#8B8CF7/i);
    // The original stays for decoration only, where contrast does not apply.
    expect(CSS).toMatch(/--color-play-indigo-glow:\s*#6366F1/i);
  });
});
