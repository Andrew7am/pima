/**
 * Entertainment accessibility contract.
 *
 * This reads source rather than rendering, for the same reason theme.test.tsx
 * reads index.css: the properties being protected are structural, they span 86
 * files, and mounting every screen to assert them would test the fixtures more
 * than the code.
 *
 * Two earlier scanners produced false positives here, so the checks below are
 * written to be sound in the direction that matters — they only fail when a
 * name is absent by EVERY route, never merely because it is hard to see. In
 * particular text inside {...} expressions counts as text, which is the mistake
 * that made the first scanner report fourteen phantom defects.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(process.cwd(), 'src', 'entertainment');

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...tsxFiles(p));
    else if (e.name.endsWith('.tsx') && !e.name.endsWith('.test.tsx')) out.push(p);
  }
  return out;
}

const FILES = tsxFiles(ROOT);
const rel = (f: string) => relative(ROOT, f).replace(/\\/g, '/');

/** Drop comments so commented-out markup is never counted as real. */
const strip = (s: string) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1'))
    .join('\n');

/** Attributes of a tag: everything up to the first `>` not inside braces. */
function attrsOf(src: string, tagStart: number, tagLen: number): string {
  let depth = 0;
  for (let i = tagStart + tagLen; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    else if (ch === '>' && depth === 0) return src.slice(tagStart, i);
  }
  return '';
}

const lineOf = (s: string, i: number) => s.slice(0, i).split('\n').length;

describe('Entertainment — every modal overlay is announced as one', () => {
  it('gives each full-screen overlay a role, or marks it as decoration', () => {
    // A `fixed inset-0` layer is one of three things, and must say which:
    //   a dialog       — announced with a boundary the user can escape
    //   a live status  — a transient announcement (the room-created celebration)
    //   decoration     — confetti and explosions, hidden from AT entirely
    // A dialog with no role is an anonymous group; an effect layer given a
    // dialog role would be worse than none. The third category was found by
    // this test rather than by the scanner that preceded it.
    const offenders: string[] = [];
    for (const f of FILES) {
      const s = strip(readFileSync(f, 'utf8'));
      for (const m of s.matchAll(/<(?:div|motion\.div)\b/g)) {
        const attrs = attrsOf(s, m.index!, m[0].length);
        if (!/fixed inset-0/.test(attrs)) continue;
        const isDialog = /role\s*=\s*["']?(alert)?dialog/.test(attrs) || /aria-modal/.test(attrs);
        const isLive = /role\s*=\s*["']?(status|alert)["']/.test(attrs) || /aria-live\s*=/.test(attrs);
        const isDecoration = /aria-hidden\s*=\s*["{]?true/.test(attrs);
        if (!isDialog && !isLive && !isDecoration) offenders.push(`${rel(f)}:${lineOf(s, m.index!)}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('names every dialog it declares', () => {
    // role="dialog" with no accessible name is barely better than no role.
    const unnamed: string[] = [];
    for (const f of FILES) {
      const s = strip(readFileSync(f, 'utf8'));
      for (const m of s.matchAll(/<(?:div|motion\.div)\b/g)) {
        const attrs = attrsOf(s, m.index!, m[0].length);
        if (!/role\s*=\s*["']?(alert)?dialog/.test(attrs)) continue;
        if (!/aria-label(ledby)?\s*=/.test(attrs)) unnamed.push(`${rel(f)}:${lineOf(s, m.index!)}`);
      }
    }
    expect(unnamed).toEqual([]);
  });
});

describe('Entertainment — placeholder is never the only label', () => {
  it('pairs every literal placeholder with a real accessible name', () => {
    // placeholder disappears the moment the user types, and is mapped to the
    // accessible name inconsistently across assistive tech. Anything carrying a
    // literal placeholder must also carry a name that survives input.
    const offenders: string[] = [];
    for (const f of FILES) {
      const s = strip(readFileSync(f, 'utf8'));
      for (const m of s.matchAll(/<(input|textarea)\b/g)) {
        const attrs = attrsOf(s, m.index!, m[0].length);
        if (!/placeholder\s*=\s*"/.test(attrs)) continue;
        const named = /aria-label\s*=/.test(attrs) || /aria-labelledby\s*=/.test(attrs) || /\bid\s*=/.test(attrs);
        if (!named) offenders.push(`${rel(f)}:${lineOf(s, m.index!)}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('keeps the great majority of form controls named, and records the rest', () => {
    // A floor rather than zero: eight controls have no adjacent literal label to
    // borrow from, and inventing names for them from a script would be guessing.
    // They are listed in the pass report. This guards against regression while
    // being honest that the work is not finished.
    let total = 0, named = 0;
    for (const f of FILES) {
      const s = strip(readFileSync(f, 'utf8'));
      for (const m of s.matchAll(/<(input|textarea|select)\b/g)) {
        total++;
        const attrs = attrsOf(s, m.index!, m[0].length);
        if (/aria-label\s*=/.test(attrs) || /aria-labelledby\s*=/.test(attrs) || /\bid\s*=/.test(attrs)) named++;
      }
    }
    expect(total).toBeGreaterThan(60);
    // 68/75 at the time of writing. Never let it fall back toward the 3 it was.
    expect(named / total).toBeGreaterThan(0.85);
  });
});

describe('Entertainment — buttons carry a name', () => {
  it('has no button that is unnamed by every route', () => {
    // Counts aria-label, title, a nested aria-label, any quoted string in the
    // body, and any bare text node. {cond ? 'a' : 'b'} and {emoji} both count —
    // missing that is what made the first scan report false defects.
    const offenders: string[] = [];
    for (const f of FILES) {
      const s = strip(readFileSync(f, 'utf8'));
      for (const m of s.matchAll(/<button\b/g)) {
        const attrs = attrsOf(s, m.index!, m[0].length);
        if (attrs.trimEnd().endsWith('/')) continue;
        if (/aria-label\s*=/.test(attrs) || /aria-labelledby\s*=/.test(attrs) || /title\s*=/.test(attrs)) continue;
        const close = s.indexOf('</button>', m.index! + attrs.length);
        const body = close < 0 ? '' : s.slice(m.index! + attrs.length, close);
        const hasExpression = /\{[^}]+\}/.test(body);          // {emoji}, {t.label}
        const hasString = /(['"`])[^'"`\n]*\S[^'"`\n]*\1/.test(body);
        const hasBareText = body.replace(/<[^>]*>/g, '\x00').split('\x00')
          .some((t) => t.replace(/\{[\s\S]*?\}/g, ' ').trim().length > 0);
        const nestedAria = /aria-label\s*=/.test(body);
        if (!hasExpression && !hasString && !hasBareText && !nestedAria) {
          offenders.push(`${rel(f)}:${lineOf(s, m.index!)}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
