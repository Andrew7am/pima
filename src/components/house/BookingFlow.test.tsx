import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BookingFlow from './BookingFlow';
import { INITIAL_HOUSES } from '../../mockData';

function flow(over: { isQuoteMode?: boolean; setIsQuoteMode?: (v: boolean) => void } = {}) {
  const setIsQuoteMode = over.setIsQuoteMode ?? vi.fn();
  render(
    <BookingFlow
      house={INITIAL_HOUSES[0]}
      currentUser={null}
      checkIn="2026-07-15"
      checkOut="2026-07-18"
      nights={3}
      guestsCount={40}
      setGuestsCount={vi.fn()}
      isQuoteMode={over.isQuoteMode ?? false}
      setIsQuoteMode={setIsQuoteMode}
      isMonthlyHousing={false}
      originalTotalPrice={30000}
      totalPrice={30000}
      depositAmount={5000}
      breakdown={[]}
      datePicker={<div />}
      onSubmit={vi.fn()}
      onExit={vi.fn()}
    />
  );
  return { setIsQuoteMode };
}

const openSheet = () => fireEvent.click(screen.getByText('نوع الحجز').closest('button')!);
const pick = (label: string) => fireEvent.click(screen.getByRole('radio', { name: new RegExp(label) }));

describe('the booking-type picker', () => {
  it('starts on «حجز عادي» and opens a list of kinds', () => {
    flow();
    expect(screen.getByText('حجز عادي')).toBeTruthy();
    openSheet();
    expect(screen.getAllByRole('radio').length).toBe(9);
    expect(screen.getByRole('radio', { name: /خدام وخدامات/ })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /خدمة ثانوي/ })).toBeTruthy();
  });

  it('names the chosen kind on the row and closes the list', () => {
    flow();
    openSheet();
    pick('خدمة ثانوي');
    expect(screen.queryByRole('radiogroup')).toBeNull();
    expect(screen.getByText('خدمة ثانوي')).toBeTruthy();
  });

  it('turns quote mode ON only for «مؤتمر كبير»', () => {
    const { setIsQuoteMode } = flow();
    openSheet();
    pick('مؤتمر كبير');
    expect(setIsQuoteMode).toHaveBeenCalledWith(true);
  });

  it('turns quote mode OFF again when another kind is chosen', () => {
    // The one way this could cost money: a guest who picks «مؤتمر كبير» and
    // then changes their mind must not submit a fixed-price request still
    // flagged as a quote — or the reverse, a quote priced as if it were fixed.
    const setIsQuoteMode = vi.fn();
    flow({ isQuoteMode: true, setIsQuoteMode });
    openSheet();
    pick('خدام وخدامات');
    expect(setIsQuoteMode).toHaveBeenCalledWith(false);
  });

  it('marks exactly one kind as checked', () => {
    flow();
    openSheet();
    pick('خدمة شباب');
    openSheet();
    const checked = screen.getAllByRole('radio').filter((r) => r.getAttribute('aria-checked') === 'true');
    expect(checked.length).toBe(1);
    expect(checked[0].textContent).toContain('خدمة شباب');
  });
});
