import React, { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useDialogFocus } from './useDialogFocus';

// A dialog shaped like the app's sheets: an opener on the page behind, a
// backdrop, and a panel with a few controls in it.
function Harness({ empty = false }: { empty?: boolean }) {
  const [open, setOpen] = useState(false);
  const panelRef = useDialogFocus<HTMLDivElement>(open, () => setOpen(false));
  return (
    <div>
      <button onClick={() => setOpen(true)}>افتح</button>
      <button>زر خلف النافذة</button>
      {open && (
        <div role="dialog" aria-modal="true" aria-label="نافذة">
          <div ref={panelRef}>
            {!empty && (
              <>
                <button>الأول</button>
                <input aria-label="حقل" />
                <button>الأخير</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const openDialog = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'افتح' }));
};

describe('useDialogFocus', () => {
  it('moves focus into the panel, not onto the first control', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await openDialog(user);

    // The panel itself holds focus so a reader announces the dialog's label
    // before jumping into its contents.
    const panel = screen.getByRole('dialog').firstElementChild;
    expect(document.activeElement).toBe(panel);
    expect(panel).toHaveAttribute('tabindex', '-1');
  });

  it('wraps Tab from the last control back to the first', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await openDialog(user);

    screen.getByRole('button', { name: 'الأخير' }).focus();
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'الأول' }));
  });

  it('wraps Shift+Tab from the first control back to the last', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await openDialog(user);

    screen.getByRole('button', { name: 'الأول' }).focus();
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'الأخير' }));
  });

  // THE bug this exists for: without a trap, Tab walked onto the page behind
  // the dimmed backdrop, where the user cannot see what has focus.
  it('never lands on a control outside the dialog', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await openDialog(user);

    const behind = screen.getByRole('button', { name: 'زر خلف النافذة' });
    for (let i = 0; i < 8; i++) {
      await user.tab();
      expect(document.activeElement).not.toBe(behind);
    }
  });

  it('keeps focus on the panel when the dialog has no controls at all', async () => {
    const user = userEvent.setup();
    render(<Harness empty />);
    await openDialog(user);

    const panel = screen.getByRole('dialog').firstElementChild;
    await user.tab();
    expect(document.activeElement).toBe(panel);
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await openDialog(user);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await act(async () => { fireEvent.keyDown(document, { key: 'Escape' }); });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  // Closing used to drop focus on <body>, losing a screen reader's place on
  // the page it came from.
  it('returns focus to whatever opened it', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'افتح' });
    await openDialog(user);

    await act(async () => { fireEvent.keyDown(document, { key: 'Escape' }); });
    expect(document.activeElement).toBe(opener);
  });
});
