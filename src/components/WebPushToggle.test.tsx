import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import React from 'react';
import WebPushToggle, { WebPushRenderArgs } from './WebPushToggle';
import * as push from '../lib/push';

// The switch that lets a guest, an owner or an admin turn browser
// notifications on. Its whole reason to exist as a shared component is that
// the owner and admin had no way to enable push before — so the properties
// worth pinning are: it hides itself where it cannot work, «on» actually
// registers, and «off» removes the token rather than pretending to revoke a
// permission a page cannot revoke.

vi.mock('../lib/push', () => ({
  webPushAvailable: vi.fn(),
  webPushState: vi.fn(),
  enableWebPush: vi.fn(),
  disableWebPush: vi.fn(),
}));

const m = vi.mocked(push);

// A minimal render prop so the test does not depend on any one screen's chrome.
const renderRow = (p: WebPushRenderArgs) => (
  <button data-testid="row" data-checked={p.checked} data-disabled={p.disabled} data-busy={p.busy}
    onClick={() => p.onChange(!p.checked)}>{p.sublabel}</button>
);

beforeEach(() => {
  m.webPushAvailable.mockReset();
  m.webPushState.mockReset();
  m.enableWebPush.mockReset();
  m.disableWebPush.mockReset();
});

describe('WebPushToggle', () => {
  it('renders nothing where push cannot work — no dead switch', () => {
    m.webPushAvailable.mockReturnValue(false);
    const { container } = render(<WebPushToggle userId="u1" render={renderRow} />);
    expect(container.innerHTML).toBe('');
  });

  it('registers this browser when switched on', async () => {
    m.webPushAvailable.mockReturnValue(true);
    m.webPushState.mockReturnValue('default');
    m.enableWebPush.mockResolvedValue('granted');
    render(<WebPushToggle userId="u1" render={renderRow} />);

    act(() => screen.getByTestId('row').click());

    await waitFor(() => expect(m.enableWebPush).toHaveBeenCalledWith('u1'));
    await waitFor(() => expect(screen.getByTestId('row').dataset.checked).toBe('true'));
  });

  it('removes this browser\'s token when switched off', async () => {
    m.webPushAvailable.mockReturnValue(true);
    m.webPushState.mockReturnValue('granted');
    m.disableWebPush.mockResolvedValue(undefined);
    render(<WebPushToggle userId="u1" render={renderRow} />);
    expect(screen.getByTestId('row').dataset.checked).toBe('true');

    act(() => screen.getByTestId('row').click());

    await waitFor(() => expect(m.disableWebPush).toHaveBeenCalled());
    // Reads our own flag, not Notification.permission, so it lands on 'default'.
    await waitFor(() => expect(screen.getByTestId('row').dataset.checked).toBe('false'));
  });

  it('is disabled when the browser itself has blocked notifications', () => {
    m.webPushAvailable.mockReturnValue(true);
    m.webPushState.mockReturnValue('denied');
    render(<WebPushToggle userId="u1" render={renderRow} />);
    expect(screen.getByTestId('row').dataset.disabled).toBe('true');
    expect(screen.getByTestId('row').dataset.checked).toBe('false');
  });
});
