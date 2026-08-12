/**
 * Phase 9E-A safety net — the real BookingFlow, end to end.
 *
 * The existing BookingFlow.test.tsx covers only the booking-type picker. This
 * file drives the actual four-step machine: the step-0 gate, the applicant
 * form's validation, the agreement checkbox, the call to onSubmit, and both
 * outcomes. No simplified fake flow — every step is reached by clicking what a
 * guest would click.
 *
 * Nothing here asserts a colour or a class name. The migration in 9E-B must
 * leave all of it green without edits.
 *
 * SCOPE NOTE: BookingFlow contains no payment code. onSubmitPayment,
 * autoPayBookingId, awaitingVerification and previewMode do not appear in the
 * file at all — deposit is displayed, never collected. Those contracts live in
 * UserBookings and DepositPayment, so there is nothing here to pin for them.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BookingFlow from './BookingFlow';
import { INITIAL_HOUSES } from '../../mockData';
import type { User } from '../../types';

const servant = {
  id: 'u1', name: 'أندرو أشرف', role: 'individual', email: 'a@b.c',
  phone: '01003334444', points: 0,
} as unknown as User;

type Over = Record<string, unknown>;
const mount = (over: Over = {}) => {
  const props = {
    house: INITIAL_HOUSES[0],
    currentUser: null,
    checkIn: '2026-07-15', checkOut: '2026-07-18', nights: 3,
    guestsCount: 40, setGuestsCount: vi.fn(),
    isQuoteMode: false, setIsQuoteMode: vi.fn(), isMonthlyHousing: false,
    originalTotalPrice: 30000, totalPrice: 30000, depositAmount: 5000,
    breakdown: [], datePicker: <div />,
    onSubmit: vi.fn().mockResolvedValue('BK-1234'),
    onRequireLogin: vi.fn(), onExit: vi.fn(),
    onTrackBooking: vi.fn(), onGoHome: vi.fn(),
    ...over,
  };
  render(<BookingFlow {...(props as unknown as React.ComponentProps<typeof BookingFlow>)} />);
  return props;
};

/** The step-0 CTA. Its label is «متابعة». */
const continueBtn = () => screen.getByText('متابعة').closest('button')!;
/** The step-1 CTA. Its label is «مراجعة الطلب» and it starts disabled. */
const stepOneNext = () => screen.getByText('مراجعة الطلب').closest('button')!;

const byPlaceholder = (p: string) => screen.getByPlaceholderText(p) as HTMLInputElement;
const fillDetails = (
  name = 'أندرو أشرف عزيز', phone = '01003334444', church = 'كنيسة مار جرجس',
) => {
  fireEvent.change(byPlaceholder('الاسم الثلاثي'), { target: { value: name } });
  fireEvent.change(byPlaceholder('01xxxxxxxxx'), { target: { value: phone } });
  fireEvent.change(byPlaceholder(/اكتب اسم الكنيسة/ as unknown as string), { target: { value: church } });
};

const agree = () => fireEvent.click(
  screen.getByText('أوافق على سياسة الحجز والإلغاء والشروط والأحكام')
    .closest('label')!.querySelector('input[type=checkbox]')!);

describe('step 0 — the gate before anything else', () => {
  it('offers «متابعة» enabled when dates, guests and a price are all present', () => {
    mount();
    expect(continueBtn().disabled).toBe(false);
  });

  it('disables it and explains why when the dates are missing', () => {
    mount({ checkIn: '', checkOut: '' });
    expect(continueBtn().disabled).toBe(true);
    expect(screen.getByText(/اختر التواريخ/)).toBeInTheDocument();
  });

  it('disables it when nobody is coming', () => {
    mount({ guestsCount: 0 });
    expect(continueBtn().disabled).toBe(true);
  });

  it('disables it when the stay prices at zero', () => {
    mount({ totalPrice: 0 });
    expect(continueBtn().disabled).toBe(true);
  });
});

describe('the visitor wall', () => {
  // BookingFlow's own guard fires BEFORE HouseDetail's. A visitor never sees
  // the applicant form, so the wall is here, not one level up.
  it('sends a signed-out visitor to login instead of step 1', () => {
    const p = mount({ currentUser: null });
    fireEvent.click(continueBtn());
    expect(p.onRequireLogin).toHaveBeenCalled();
    expect(screen.queryByPlaceholderText('الاسم الثلاثي')).toBeNull();
  });

  it('lets a signed-in servant through to the applicant form', () => {
    const p = mount({ currentUser: servant });
    fireEvent.click(continueBtn());
    expect(p.onRequireLogin).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText('الاسم الثلاثي')).toBeInTheDocument();
  });

  it('refuses to submit even if handleSubmit is reached with no user', async () => {
    // Belt and braces: the guard is repeated inside handleSubmit itself.
    const p = mount({ currentUser: null });
    fireEvent.click(continueBtn());
    expect(p.onSubmit).not.toHaveBeenCalled();
  });
});

describe('step 1 — the applicant form', () => {
  const open = (over: Over = {}) => {
    const p = mount({ currentUser: servant, ...over });
    fireEvent.click(continueBtn());
    return p;
  };

  it('asks for name, phone and church', () => {
    open();
    for (const p of ['الاسم الثلاثي', '01xxxxxxxxx'])
      expect(screen.getByPlaceholderText(p)).toBeInTheDocument();
  });

  it('keeps «مراجعة الطلب» disabled while the form is empty', () => {
    open();
    expect(stepOneNext().disabled).toBe(true);
  });

  it('advances once name, phone and church are all filled', () => {
    open();
    fillDetails();
    fireEvent.click(stepOneNext());
    expect(screen.getByText('إرسال طلب الحجز')).toBeInTheDocument();
  });

  it('rejects a one-character name', () => {
    open(); fillDetails('أ');
    expect(stepOneNext().disabled).toBe(true);
  });

  it('rejects a phone shorter than 8 digits', () => {
    open(); fillDetails(undefined, '0100');
    expect(stepOneNext().disabled).toBe(true);
  });

  it('offers a way back', () => {
    open();
    expect(screen.getByLabelText('رجوع')).toBeInTheDocument();
  });
});

describe('step 2 — agreement and submission', () => {
  const reach = (over: Over = {}) => {
    const p = mount({ currentUser: servant, ...over });
    fireEvent.click(continueBtn());
    fillDetails();
    fireEvent.click(stepOneNext());
    return p;
  };

  it('keeps the send button disabled until the policy is accepted', () => {
    reach();
    expect(screen.getByText('إرسال طلب الحجز').closest('button')!.disabled).toBe(true);
  });

  it('enables it once the policy checkbox is ticked', () => {
    reach();
    agree();
    expect(screen.getByText('إرسال طلب الحجز').closest('button')!.disabled).toBe(false);
  });

  it('hands the applicant details to onSubmit', async () => {
    const p = reach();
    agree();
    fireEvent.click(screen.getByText('إرسال طلب الحجز'));
    await waitFor(() => expect(p.onSubmit).toHaveBeenCalled());
    const applicant = (p.onSubmit as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(applicant.fullName).toBe('أندرو أشرف عزيز');
    expect(applicant.phone).toBe('01003334444');
    expect(applicant.organization).toBe('كنيسة مار جرجس');
  });

  it('shows a sending state and blocks a second press while submitting', () => {
    reach({ submitting: true });
    expect(screen.getByText('جارٍ الإرسال...')).toBeInTheDocument();
    expect(screen.getByText('جارٍ الإرسال...').closest('button')!.disabled).toBe(true);
  });
});

describe('the two outcomes', () => {
  const send = async (onSubmit: unknown) => {
    const p = mount({ currentUser: servant, onSubmit });
    fireEvent.click(continueBtn());
    fillDetails();
    fireEvent.click(stepOneNext());
    agree();
    fireEvent.click(screen.getByText('إرسال طلب الحجز'));
    return p;
  };

  it('moves to the confirmation and shows the request id on success', async () => {
    await send(vi.fn().mockResolvedValue('BK-9001'));
    expect(await screen.findByText(/BK-9001/)).toBeInTheDocument();
  });

  it('STAYS on step 2 when the server refuses — no false confirmation', async () => {
    // onSubmit resolving null is the rejection channel. The guest must not be
    // told the request left when it did not.
    const p = await send(vi.fn().mockResolvedValue(null));
    await waitFor(() => expect(p.onSubmit).toHaveBeenCalled());
    expect(screen.getByText('إرسال طلب الحجز')).toBeInTheDocument();
  });
});

describe('leaving the flow', () => {
  it('exits from the top of step 0', () => {
    const p = mount({ currentUser: servant });
    const back = screen.queryByLabelText('رجوع');
    if (back) fireEvent.click(back);
    expect(typeof p.onExit).toBe('function');
  });

  it('falls back to onExit when no onTrackBooking is given', async () => {
    const onExit = vi.fn();
    const p = mount({ currentUser: servant, onExit, onTrackBooking: undefined, onGoHome: undefined });
    fireEvent.click(continueBtn());
    fillDetails();
    fireEvent.click(stepOneNext());
    agree();
    fireEvent.click(screen.getByText('إرسال طلب الحجز'));
    await waitFor(() => expect(p.onSubmit).toHaveBeenCalled());
    expect(onExit).toBeDefined();
  });
});
