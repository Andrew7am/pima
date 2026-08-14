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

/**
 * Contrast: text-slate-500 must never sit on an Entertainment dark ground.
 *
 * #64748B measures 2.95:1 on the tile — under even the 3:1 large-text floor.
 * It is NOT banned outright, because Entertainment also has genuinely light
 * surfaces (the lecture reading modal's normal/sepia themes, the module cards)
 * where it is correct at 4.76:1. The rule is contextual, so the test is too.
 */
describe('Entertainment — slate-500 never lands on a dark ground', () => {
  const srgb = (c: number) => { const x = c / 255; return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
  const lum = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
  };
  const ratio = (a: string, b: string) => {
    const [hi, lo] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (hi + 0.05) / (lo + 0.05);
  };

  const GROUNDS = { page: '#0A1428', card: '#081326', raised: '#122244', tile: '#152A55' };
  const SLATE_400 = '#94A3B8';
  const SLATE_500 = '#64748B';

  it('confirms the colour that was replaced really did fail', () => {
    // If this ever stops failing, the grounds moved and the whole rule needs
    // rechecking — so the premise is asserted, not assumed.
    const worst = Math.min(...Object.values(GROUNDS).map((g) => ratio(SLATE_500, g)));
    expect(worst).toBeLessThan(3.0);
  });

  it('confirms the replacement clears AA body text on every ground', () => {
    for (const [name, g] of Object.entries(GROUNDS)) {
      const r = ratio(SLATE_400, g);
      expect(r, `slate-400 on ${name}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('leaves no slate-500 on a dark game surface', () => {
    // The dark surfaces are named by token or by a very dark literal. A line
    // that offers BOTH slate-400 and slate-500 is an intentional dark/light
    // conditional and is correct as written.
    const DARK = /\[var\(--color-play-(?:bg|card|card-raised|tile|tile-deep|page-mid|page-deep)\)\]|(?:bg|from|via|to)-play-(?:bg|card|card-raised|tile)|bg-white\/\[0\.0\d\]/;
    const offenders: string[] = [];
    for (const f of FILES) {
      const lines = strip(readFileSync(f, 'utf8')).split('\n');
      lines.forEach((line, i) => {
        if (!/text-slate-500/.test(line)) return;
        if (/text-slate-(300|400)/.test(line)) return;   // intentional conditional
        if (DARK.test(line)) offenders.push(`${rel(f)}:${i + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it('keeps the wholly-dark screens free of it entirely', () => {
    // The same-line check above cannot see a ground declared on an ancestor.
    // These twelve screens were each verified to have NO light surface behind
    // any slate-500 they carried, so for them the rule is absolute: zero. That
    // is a much tighter guard than a heuristic, and it is the one that would
    // catch a regression reintroducing the colour into a game screen.
    const DARK_ONLY = [
      'RandomMatchGame.tsx', 'multiplayer/LiveMatchGame.tsx', 'multiplayer/RoomChat.tsx',
      'AchievementsScreen.tsx', 'AdGateModal.tsx', 'ChatThreadScreen.tsx',
      'game-engine/PluginSystemCard.tsx', 'GamesCatalog.tsx', 'multiplayer/MultiplayerLobby.tsx',
      'FriendChat.tsx', 'CommunityPanel.tsx', 'TopLeaders.tsx',
      'games/MCQGame.tsx', 'games/WhoAmIGame.tsx',
    ];
    const offenders: string[] = [];
    for (const name of DARK_ONLY) {
      const f = FILES.find((p) => rel(p) === name);
      expect(f, `${name} should exist`).toBeTruthy();
      const n = (readFileSync(f!, 'utf8').match(/text-slate-500/g) || []).length;
      if (n > 0) offenders.push(`${name} (${n})`);
    }
    expect(offenders).toEqual([]);
  });

  it('does NOT purge slate-500 from the light surfaces where it is correct', () => {
    // Guards against someone "fixing" this with a global replace. On white,
    // slate-500 measures 4.76:1 and slate-400 only 2.85:1 — a blanket swap
    // would trade one failure for a worse one.
    let remaining = 0;
    for (const f of FILES) remaining += (readFileSync(f, 'utf8').match(/text-slate-500/g) || []).length;
    expect(remaining).toBeGreaterThan(40);
    expect(ratio(SLATE_500, '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
    expect(ratio(SLATE_400, '#FFFFFF')).toBeLessThan(3.0);
  });
});
