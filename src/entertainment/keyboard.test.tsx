/**
 * Interaction accessibility — the six clickable non-interactive elements.
 *
 * All six were `<div onClick>` / `<motion.div onClick>`: invisible to Tab, dead
 * to Enter and Space. Each became a NATIVE <button> rather than gaining
 * role + tabIndex + onKeyDown, which is why there is no key handler to test in
 * isolation and no possibility of double-firing — the browser's own activation
 * behaviour does the work.
 *
 * EntertainmentHome's category cards are exercised for real with user-event
 * (Tab, Enter, Space, click). The other five live inside components that need
 * substantial async fixtures to mount, so they are held by a source-level
 * contract instead — stated plainly rather than dressed up as interaction tests.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import EntertainmentHome from './EntertainmentHome';
import type { User } from '../types';

const user = { id: 'u1', name: 'أندرو', points: 120, xp: 40, streak: 3 } as unknown as User;

function mountHub(over: Record<string, unknown> = {}) {
  const props = {
    currentUser: user,
    onBack: vi.fn(), onOpenTrivia: vi.fn(), onOpenWhoAmI: vi.fn(), onOpenHymns: vi.fn(),
    onOpenFillVerse: vi.fn(), onOpenMultiplayer: vi.fn(), onOpenAchievements: vi.fn(),
    onOpenFriends: vi.fn(), onOpenLeaderboard: vi.fn(), onOpenRooms: vi.fn(),
    onOpenConference: vi.fn(), onOpenRandomMatch: vi.fn(), onOpenGamesCatalog: vi.fn(),
    onOpenRewards: vi.fn(), onUserUpdated: vi.fn(),
    section: 'menu' as const, onSectionChange: vi.fn(),
    ...over,
  };
  const view = render(<EntertainmentHome {...(props as unknown as React.ComponentProps<typeof EntertainmentHome>)} />);
  return { ...view, props };
}

/** The five hub category cards, by their Arabic labels. */
const CARD_LABEL = /مركز الألعاب التفاعلي/;

describe('Hub category cards — the primary navigation is now keyboard operable', () => {
  it('renders each category as a real button, not a div', () => {
    mountHub();
    const card = screen.getByText(CARD_LABEL).closest('button');
    expect(card).not.toBeNull();
    expect(card!.tagName).toBe('BUTTON');
    // type="button" matters: inside any future <form> a bare button submits.
    expect(card!.getAttribute('type')).toBe('button');
  });

  it('is reachable by Tab', async () => {
    const u = userEvent.setup();
    mountHub();
    const card = screen.getByText(CARD_LABEL).closest('button')!;
    // Walk the tab order until we land on it, rather than calling focus()
    // directly — focus() would pass even on an unreachable element.
    let found = false;
    for (let i = 0; i < 40 && !found; i++) {
      await u.tab();
      if (document.activeElement === card) found = true;
    }
    expect(found).toBe(true);
  });

  it('activates on Enter, exactly once', async () => {
    const u = userEvent.setup();
    const { props } = mountHub();
    const card = screen.getByText(CARD_LABEL).closest('button')!;
    card.focus();
    await u.keyboard('{Enter}');
    expect(props.onSectionChange).toHaveBeenCalledTimes(1);
    expect(props.onSectionChange).toHaveBeenCalledWith('games');
  });

  it('activates on Space, exactly once', async () => {
    const u = userEvent.setup();
    const { props } = mountHub();
    const card = screen.getByText(CARD_LABEL).closest('button')!;
    card.focus();
    await u.keyboard('{ }');
    expect(props.onSectionChange).toHaveBeenCalledTimes(1);
    expect(props.onSectionChange).toHaveBeenCalledWith('games');
  });

  it('still works on click, with no double invocation', async () => {
    const u = userEvent.setup();
    const { props } = mountHub();
    await u.click(screen.getByText(CARD_LABEL).closest('button')!);
    expect(props.onSectionChange).toHaveBeenCalledTimes(1);
  });

  it('navigates to the right section for each card', async () => {
    const u = userEvent.setup();
    const { props } = mountHub();
    await u.click(screen.getByText(/شركة الصلوات المباركة/).closest('button')!);
    expect(props.onSectionChange).toHaveBeenLastCalledWith('community');
  });
});

/**
 * The other five. A source contract, not an interaction test — and labelled as
 * such. What it protects is the thing that was actually wrong: these elements
 * being non-interactive tags carrying onClick.
 */
describe('The remaining five clickables are native buttons in source', () => {
  const read = (f: string) => readFileSync(join(process.cwd(), 'src', 'entertainment', f), 'utf8');

  const CASES: Array<{ file: string; marker: string; what: string }> = [
    { file: 'ConferenceHub.tsx', marker: 'onClick={() => setShowShareModal(true)}', what: 'conference QR tile' },
    { file: 'ConferenceHub.tsx', marker: 'onClick={() => handleSelectActiveSlide(s.id)}', what: 'slide selector' },
    { file: 'ConferenceHub.tsx', marker: 'onClick={() => handleToggleChecklist(item.id)}', what: 'checklist item' },
    { file: 'ParticipantCard.tsx', marker: 'onClick={() => setIsCollapsed(!isCollapsed)}', what: 'card header collapse' },
    { file: 'ParticipantCard.tsx', marker: 'setShowFullQR(true);', what: 'QR thumbnail' },
  ];

  for (const c of CASES) {
    it(`${c.what} sits on a <button>`, () => {
      const src = read(c.file);
      const at = src.indexOf(c.marker);
      expect(at, `${c.marker} not found in ${c.file}`).toBeGreaterThan(-1);
      // Walk back to the tag that owns this handler.
      const open = src.lastIndexOf('<', at);
      const tag = src.slice(open, at).match(/^<([A-Za-z][\w.]*)/);
      expect(tag, 'could not find the owning tag').not.toBeNull();
      expect(tag![1], `${c.what} in ${c.file} must be a button`).toMatch(/^(button|motion\.button)$/);
    });
  }

  it('adds no hand-rolled key handling — native activation is the whole point', () => {
    // If someone "helpfully" adds onKeyDown to these buttons later, Enter would
    // fire the handler AND the native click: the double-invocation this design
    // avoids by construction.
    for (const f of ['ConferenceHub.tsx', 'ParticipantCard.tsx', 'EntertainmentHome.tsx']) {
      const src = read(f);
      for (const m of src.matchAll(/<(button|motion\.button)\b([\s\S]{0,600}?)>/g)) {
        expect(m[2], `${f}: a converted button gained onKeyDown`).not.toMatch(/onKeyDown\s*=\s*\{[\s\S]*?(Enter|' ')/);
      }
    }
  });

  it('keeps the toggle and disclosure states announced', () => {
    const ch = read('ConferenceHub.tsx');
    const pc = read('ParticipantCard.tsx');
    expect(ch).toMatch(/aria-pressed=\{item\.checked\}/);
    expect(pc).toMatch(/aria-expanded=\{!isCollapsed\}/);
  });
});

/**
 * F4 — the back controls.
 *
 * They render 43x17 / 82x17: an 11px label with no padding, on five screens,
 * and they are the most-used control on every sub-screen. `.pima-tap` adds a
 * transparent centred pseudo-element sized max(100%, 44px) in both axes, so
 * the painted control is byte-identical and only the hit area grows.
 *
 * jsdom computes no layout, so the 44x44 claim CANNOT be measured here — it was
 * measured in a real browser and is recorded in the pass report. What these
 * tests hold is the contract that makes it true: the utility is applied at
 * every site, the CSS still expands to 44px, and behaviour is unchanged.
 */
describe('F4 — back controls carry the hit-area utility', () => {
  const read = (f: string) => readFileSync(join(process.cwd(), 'src', 'entertainment', f), 'utf8');

  const SITES = ['EntertainmentHome.tsx', 'GamesCatalog.tsx', 'AchievementsScreen.tsx', 'RewardsScreen.tsx'];

  for (const f of SITES) {
    it(`${f} — its back control is tagged`, () => {
      const src = read(f);
      // the shared back-control class string, which must now lead with pima-tap
      const m = src.match(/className="([^"]*text-\[11px\] font-bold text-slate-400[^"]*)"/);
      expect(m, `no back-control class found in ${f}`).not.toBeNull();
      expect(m![1], `${f} back control is missing pima-tap`).toMatch(/\bpima-tap\b/);
    });
  }

  it('the .pima-tap rule still expands to 44px in both axes', () => {
    // If someone edits the utility, the five controls silently shrink again.
    const css = readFileSync(join(process.cwd(), 'src', 'index.css'), 'utf8');
    const block = css.slice(css.indexOf('.pima-tap::after'), css.indexOf('.pima-tap::after') + 400);
    expect(block).toMatch(/width:\s*max\(100%,\s*44px\)/);
    expect(block).toMatch(/height:\s*max\(100%,\s*44px\)/);
    expect(css).toMatch(/\.pima-tap\s*\{[^}]*position:\s*relative/);
  });

  it('hub back control still navigates, on click and on Enter, exactly once', async () => {
    const u = userEvent.setup();
    // the back control only renders inside a sub-section
    const { props, unmount } = mountHub({ section: 'games' });
    const back = screen.getByText('رجوع للقائمة').closest('button')!;
    expect(back.className).toMatch(/\bpima-tap\b/);

    await u.click(back);
    expect(props.onSectionChange).toHaveBeenCalledTimes(1);
    expect(props.onSectionChange).toHaveBeenCalledWith('menu');
    unmount();

    const second = mountHub({ section: 'games' });
    const back2 = screen.getByText('رجوع للقائمة').closest('button')!;
    back2.focus();
    await u.keyboard('{Enter}');
    expect(second.props.onSectionChange).toHaveBeenCalledTimes(1);
    expect(second.props.onSectionChange).toHaveBeenCalledWith('menu');
  });
});

/**
 * F1/F2 — the hub menu no longer carries a duplicate dark-mode control.
 */
describe('F1/F2 — dark mode has one quick toggle and one home, not three', () => {
  const read = (f: string) => readFileSync(join(process.cwd(), 'src', 'entertainment', f), 'utf8');

  it('the duplicated night-mode bar is gone from the menu', () => {
    expect(read('EntertainmentHome.tsx')).not.toMatch(/Night-mode bar/);
  });

  it('but dark mode is still reachable — the settings row survives', () => {
    const src = read('EntertainmentHome.tsx');
    // the canonical home inside الإعدادات
    expect(src).toMatch(/الوضع الليلي/);
    // useState declaration + header quick toggle + settings row
    expect((src.match(/setIsDarkMode/g) || []).length).toBe(3);
  });

  it('the five category cards are still the menu content', () => {
    mountHub();
    for (const label of [/مركز الألعاب التفاعلي/, /المؤتمرات والمواسم/, /شركة الصلوات المباركة/, /إحصائياتي التفصيلية/, /إعدادات التجربة/]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
});
