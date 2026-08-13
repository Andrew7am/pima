/**
 * Regression net for the icon-only touch targets.
 *
 * Measured at 375px in a real browser, these controls painted 28–40px square:
 * the owner sheet's close, the deposit screen's back and close, the filter
 * sheet's close and back, the rewards back arrow, and the password reveal.
 * Their painted size is correct — a 44px filled circle would be a different
 * design — so the fix grows only the HIT AREA, via the .pima-tap pseudo-element
 * in index.css.
 *
 * jsdom computes no layout, so this cannot assert pixels; the browser
 * measurement did that (corners of a 44x44 box centred on the control now
 * resolve to the control: 4/4 on DepositPayment and FilterSheet). What this
 * file pins is that the class is still ON the controls that need it — the part
 * a refactor silently drops when className strings get rewritten.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

/** Pull the attribute block of every <button>, brace- and quote-aware. */
function buttons(src: string): string[] {
  const out: string[] = [];
  const open = /<button\b/g;
  let m: RegExpExecArray | null;
  while ((m = open.exec(src))) {
    let i = m.index + m[0].length, depth = 0, q: string | null = null;
    while (i < src.length) {
      const c = src[i];
      if (q) { if (c === q && src[i - 1] !== '\\') q = null; }
      else if (c === '"' || c === "'" || c === '`') q = c;
      else if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0) break;
      i++;
    }
    out.push(src.slice(m.index, i));
  }
  return out;
}

const withLabel = (src: string, label: string) =>
  buttons(src).filter((b) => b.includes(`aria-label="${label}"`));

describe('the .pima-tap hit-area utility exists', () => {
  const css = read('src/index.css');

  it('is defined', () => {
    expect(css).toContain('.pima-tap');
  });

  it('expands to at least 44px without resizing the painted control', () => {
    // max() keeps a control that is already larger than 44px at its own size.
    expect(css).toMatch(/\.pima-tap::after[\s\S]*?width:\s*max\(100%,\s*44px\)/);
    expect(css).toMatch(/\.pima-tap::after[\s\S]*?height:\s*max\(100%,\s*44px\)/);
  });

  it('positions the control so the pseudo-element can anchor to it', () => {
    expect(css).toMatch(/\.pima-tap\s*\{[^}]*position:\s*relative/);
  });
});

describe('the icon-only controls that measured under 44px carry it', () => {
  const cases: Array<[string, string, string]> = [
    ['DepositPayment back', 'src/components/booking/DepositPayment.tsx', 'رجوع'],
    ['DepositPayment close', 'src/components/booking/DepositPayment.tsx', 'إغلاق'],
    ['FilterSheet close', 'src/components/FilterSheet.tsx', 'إغلاق'],
    ['FilterSheet back', 'src/components/FilterSheet.tsx', 'رجوع'],
    ['RewardsDashboard back', 'src/components/RewardsDashboard.tsx', 'رجوع'],
    // The owner one spells out what it closes, so it is matched in full.
    ['Owner add-booking close', 'src/components/owner/OwnerDashboardShell.tsx', 'إغلاق نموذج الحجز اليدوي'],
  ];

  for (const [name, file, label] of cases) {
    it(`${name} keeps pima-tap`, () => {
      const found = withLabel(read(file), label);
      expect(found.length).toBeGreaterThan(0);
      for (const b of found) expect(b).toContain('pima-tap');
    });
  }

  it('the password reveal keeps it too, despite a computed aria-label', () => {
    // Its label is a ternary, so it cannot be matched by literal text.
    const src = read('src/components/AuthScreen.tsx');
    const toggle = buttons(src).filter((b) => b.includes('إظهار كلمة السر'));
    expect(toggle.length).toBeGreaterThan(0);
    for (const b of toggle) expect(b).toContain('pima-tap');
  });
});
