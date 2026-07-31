import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { useCountUp, useGrowOnMount } from './useCountUp';

// These hooks animate a BALANCE and its progress bars. The property worth
// locking down is not the easing — it is that the real number always arrives,
// including on the paths where the animation cannot run.

function Balance({ target }: { target: number }) {
  const v = useCountUp(target, 50);
  return <span data-testid="v">{v}</span>;
}

function Bar({ pct }: { pct: number }) {
  const w = useGrowOnMount(pct, 0);
  return <span data-testid="w">{w}</span>;
}

const setReducedMotion = (reduce: boolean) => {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: reduce && q.includes('prefers-reduced-motion'),
    media: q, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  }));
};

describe('rewards count-up is fail-visible', () => {
  beforeEach(() => setReducedMotion(false));
  afterEach(() => vi.unstubAllGlobals());

  it('reaches the true balance when it can animate', async () => {
    render(<Balance target={1613} />);
    await waitFor(() => expect(screen.getByTestId('v').textContent).toBe('1613'));
  });

  it('shows the balance immediately under prefers-reduced-motion — never counts', () => {
    setReducedMotion(true);
    render(<Balance target={1613} />);
    // First paint already carries the real number, not a 0 that ticks up.
    expect(screen.getByTestId('v').textContent).toBe('1613');
  });

  it('counts to a changed target rather than resetting to zero', async () => {
    const { rerender } = render(<Balance target={100} />);
    await waitFor(() => expect(screen.getByTestId('v').textContent).toBe('100'));
    rerender(<Balance target={125} />); // the daily-ad +25
    await waitFor(() => expect(screen.getByTestId('v').textContent).toBe('125'));
  });

  it('renders a zero balance as zero, with no animation to get stuck in', () => {
    render(<Balance target={0} />);
    expect(screen.getByTestId('v').textContent).toBe('0');
  });

  it('arrives at the real number even when animation frames never fire', async () => {
    // A background tab, an inactive pane or a renderer that is not compositing
    // all throttle rAF to nothing. Without the watchdog the tween freezes at
    // its start value — which on the booking screen renders a price of zero.
    vi.stubGlobal('requestAnimationFrame', () => 1);
    vi.stubGlobal('cancelAnimationFrame', () => {});
    render(<Balance target={7980} />);
    expect(screen.getByTestId('v').textContent).toBe('0'); // frozen at the start
    await waitFor(() => expect(screen.getByTestId('v').textContent).toBe('7980'), { timeout: 2000 });
  });

  it('grows a progress bar to its real width, and skips the growth when motion is reduced', async () => {
    const { unmount } = render(<Bar pct={71} />);
    await waitFor(() => expect(screen.getByTestId('w').textContent).toBe('71'));
    unmount();

    setReducedMotion(true);
    render(<Bar pct={71} />);
    expect(screen.getByTestId('w').textContent).toBe('71');
  });

  it('clamps an out-of-range percentage instead of overflowing the track', () => {
    setReducedMotion(true);
    const { unmount } = render(<Bar pct={180} />);
    expect(screen.getByTestId('w').textContent).toBe('100');
    unmount();
    render(<Bar pct={-20} />);
    expect(screen.getByTestId('w').textContent).toBe('0');
  });
});
