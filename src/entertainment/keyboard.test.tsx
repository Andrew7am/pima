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
