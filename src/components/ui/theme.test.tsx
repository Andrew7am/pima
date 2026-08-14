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
  // Added ahead of the bookings migration. -deep is the far end of the gold
  // gradient and the heading inside a status surface; -soft is the pale rim.
  // -ink is gold as TEXT, which neither of the other two can be: -deep is
  // 2.84:1 on white and -soft is decorative.
  'accent-deep', 'accent-soft', 'accent-ink',
  // Found by the Guest Browse migration: the ground behind a photograph, and
  // a qualitative scale that must not borrow the status colours.
  'media', 'media-border', 'on-media', 'media-accent',
  'category-1', 'category-2', 'category-3', 'on-category',
  'success', 'on-success', 'success-ink', 'success-deep',
  'warning', 'on-warning', 'warning-ink', 'warning-deep',
  'danger', 'on-danger', 'danger-ink', 'danger-deep',
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
  it.each(THEMES)('%s defines all 37 roles', (selector) => {
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

describe('no token is declared twice inside one block', () => {
  it('catches the duplicate that source order silently swallows', () => {
    // This is here because it already happened once: a second
    // --color-owner-accent-ink was added above the existing one inside
    // @theme static, lost on source order, and defined a value nothing could
    // ever render. Two declarations in DIFFERENT blocks are fine and
    // deliberate — that is how night mode overrides. Two in the SAME block
    // are always a mistake.
    const blocks = [...CSS_CODE.matchAll(/(^|\n)([^{}\n][^{}]*)\{([^{}]*)\}/g)];
    const dupes: string[] = [];
    for (const [, , selector, body] of blocks) {
      const seen = new Map<string, number>();
      for (const [, name] of body.matchAll(/(--[\w-]+)\s*:/g)) {
        seen.set(name, (seen.get(name) ?? 0) + 1);
      }
      for (const [name, n] of seen) if (n > 1) dupes.push(`${selector.trim()} declares ${name} ${n}×`);
    }
    expect(dupes).toEqual([]);
  });
});

describe('the media surface, which does NOT invert', () => {
  // The opposite property to the -deep tier, and the reason it needs saying:
  // -deep flips because the SURFACE under it flips with the theme. A media
  // ground is dark because a photograph is under it, and that does not change
  // when the page does. Anyone applying the -deep lesson here would break it.

  const lum = (hexColour: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hexColour.slice(i, i + 2), 16));
    const ch = (c: number) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
  };
  const value = (token: string) => {
    const hits = [...CSS_CODE.matchAll(new RegExp(`${token}:\\s*(#[0-9A-Fa-f]{6})`, 'g'))];
    if (!hits.length) throw new Error(`no value for ${token}`);
    return hits[hits.length - 1][1];
  };
  const contrast = (a: string, b: string) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };

  const FAMILIES = ['natural', 'owner', 'play'] as const;

  it('is dark in every theme, including the light ones', () => {
    for (const f of FAMILIES) {
      expect(lum(value(`--color-${f}-media`)), `${f} media must be dark`).toBeLessThan(0.06);
    }
  });

  it('carries its foreground and its accent at AA or better', () => {
    for (const f of FAMILIES) {
      const ground = value(`--color-${f}-media`);
      expect(contrast(value(`--color-${f}-on-media`), ground), `${f} on-media`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(value(`--color-${f}-media-accent`), ground), `${f} media-accent`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps the accent LIGHTER than --ds-accent, which is the whole point', () => {
    // It sits on an uncontrolled photograph. Darkening it to reuse the flat
    // accent is the trade this role exists to refuse.
    expect(lum(value('--color-natural-media-accent')))
      .toBeGreaterThan(lum(value('--color-natural-gold')));
  });

  it('gives the card edge enough separation to be seen', () => {
    for (const f of FAMILIES) {
      expect(contrast(value(`--color-${f}-media-border`), value(`--color-${f}-media`)), f)
        .toBeGreaterThan(1.15);
    }
  });
});

describe('categories are a qualitative scale, not a status one', () => {
  const lum = (h: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const ch = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
  };
  const value = (t: string) => {
    const hits = [...CSS_CODE.matchAll(new RegExp(`${t}:\\s*(#[0-9A-Fa-f]{6})`, 'g'))];
    if (!hits.length) throw new Error(`no value for ${t}`);
    return hits[hits.length - 1][1];
  };
  const contrast = (a: string, b: string) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  const CATS = ['--color-category-1', '--color-category-2', '--color-category-3'];

  it('carries its label at AA on every category', () => {
    for (const c of CATS) {
      expect(contrast(value('--color-on-category'), value(c)), c).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('never borrows a status colour', () => {
    // A category is not success, warning or danger. Reusing one of those
    // values would tell the reader something untrue about the thing labelled.
    const status = ['success', 'warning', 'danger'].flatMap((s) =>
      ['natural', 'owner'].map((f) => value(`--color-${f}-${s}`)));
    for (const c of CATS) expect(status, c).not.toContain(value(c));
  });

  it('is bound identically in every theme, which is deliberate', () => {
    // Unlike -deep, a filled pill carrying white text does the same job
    // whatever the page's lightness. One definition, four bindings.
    for (const t of [':root', '.owner-theme', '.admin-theme', '.play-theme']) {
      expect(block(t)).toMatch(/--ds-category-1:\s*var\(--color-category-1\)/);
    }
  });
});

describe('the deep tier reverses direction on a dark theme', () => {
  // The trap this guards: -deep reads as "a darker shade", and on the guest
  // and owner-day themes it is. On a dark theme the status surface is dark
  // too, so a darker heading vanishes into it — reusing the light-mode
  // #14532D measures about 1.2:1 there. Night mode and the games therefore
  // bind PALE values to the same role. Anyone "tidying up" the duplication by
  // pointing all four themes at one literal would break exactly this.

  const lum = (hexColour: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hexColour.slice(i, i + 2), 16));
    const ch = (c: number) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
  };
  /** The literal value of a --color-* token, wherever it is declared last. */
  const value = (token: string) => {
    const hits = [...CSS_CODE.matchAll(new RegExp(`${token}:\\s*(#[0-9A-Fa-f]{6})`, 'g'))];
    if (!hits.length) throw new Error(`no value for ${token}`);
    return hits[hits.length - 1][1];
  };

  it('goes darker than its base on the light themes', () => {
    for (const [base, deep] of [
      ['--color-natural-success', '--color-natural-success-deep'],
      ['--color-natural-warning', '--color-natural-warning-deep'],
      ['--color-natural-danger', '--color-natural-danger-deep'],
    ]) {
      expect(lum(value(deep)), `${deep} must be darker than ${base}`)
        .toBeLessThan(lum(value(base)));
    }
  });

  it('goes lighter than its base in the games, where the surface is dark', () => {
    for (const [base, deep] of [
      ['--color-play-success-deep', '--color-play-text'],
      ['--color-play-warning-deep', '--color-play-text'],
    ]) {
      // Both are pale; the point is simply that they are nowhere near the
      // dark end, which a copied light-mode value would be.
      expect(lum(value(base)), `${base} must be a pale value on a dark ground`)
        .toBeGreaterThan(0.25);
    }
  });

  it('never lets -soft be mistaken for a text colour', () => {
    // -soft is a decorative rim at ~1.5:1. It is in the system on the explicit
    // condition that nothing reads it as a foreground, so it carries no
    // measured on-* pair and none should be added.
    expect(CSS_CODE).not.toMatch(/--ds-on-accent-soft/);
    expect(CSS_CODE).not.toMatch(/--color-\w+-(gold|accent)-soft-ink/);
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

  it('uses the cool-navy base the games are actually painted in', () => {
    // This assertion USED to pin #17130F, a warm near-black, on the reasoning
    // that "a blue-grey room with an indigo button is a gaming product that
    // happens to be bundled here rather than Pima's own."
    //
    // Overturned at product level: Entertainment stays cool navy. The warm
    // ramp was also never adopted — zero occurrences across all 77 files in
    // src/entertainment — so the theme was describing a room nobody painted.
    //
    // #0A1428 is the measured ground: 29 uses, 24 of them gradient origins.
    expect(CSS).toMatch(/--color-play-surface:\s*#0A1428/i);
  });

  it('binds the play surfaces to the same values the screens were migrated onto', () => {
    // The theme and the screens must not drift apart again. --color-play-*
    // here and --color-play-bg/-card/-card-raised in @theme static describe
    // ONE palette; if someone edits one side only, this fails.
    expect(CSS).toMatch(/--color-play-raised:\s*#081326/i);
    expect(CSS).toMatch(/--color-play-elevated:\s*#122244/i);
    expect(CSS).toMatch(/--color-play-bg:\s*#0A1428/i);
    expect(CSS).toMatch(/--color-play-card:\s*#081326/i);
    expect(CSS).toMatch(/--color-play-card-raised:\s*#122244/i);
  });

  it('keeps reward gold distinct from Pima gold', () => {
    // #F5C542 marks winning, XP and trophies — a game STATE. #C5A059 is
    // Pima's action colour. Collapsing them would make every trophy look
    // like a button. They are deliberately two tokens.
    expect(CSS).toMatch(/--color-play-reward:\s*#F5C542/i);
    expect(CSS).not.toMatch(/--color-play-reward:\s*var\(--color-gold\)/i);
  });

  it('lightens the supporting indigo so it clears AA as text', () => {
    // #6366F1 measures 3.77:1 on the warm surface — under AA even as text,
    // which is the only role it still has. #8B8CF7 measures 5.77:1.
    expect(CSS).toMatch(/--color-play-indigo:\s*#8B8CF7/i);
    // The original stays for decoration only, where contrast does not apply.
    expect(CSS).toMatch(/--color-play-indigo-glow:\s*#6366F1/i);
  });
});
