/**
 * Phase 11B — the deposit's release-safety contract.
 *
 * The 11A audit proved duplicate submission is already prevented, but the
 * protection is INCIDENTAL: submit() is synchronous, so setStep(3) unmounts the
 * whole step-2 subtree — including the submit button — before the browser can
 * dispatch a second click. Nothing in the source declares that intent, and a
 * later edit that awaits onSubmit before advancing would reopen the hole
 * silently. These tests turn that accident into a contract.
 *
 * Deliberately NOT added here: a submitting flag, a ref lock, an idempotency
 * key. This phase locks current behaviour; an explicit lock is separate work.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DepositPayment from './DepositPayment';
import type { Booking, User } from '../../types';

const booking = {
  id: 'bk-1', houseId: 'h1', houseName: 'بيت الملاك ميخائيل', userId: 'u1',
  userName: 'أندرو أشرف', checkIn: '2026-09-01', checkOut: '2026-09-04',
  guestsCount: 40, totalPrice: 30000, status: 'approved',
} as unknown as Booking;

const me = { id: 'u1', name: 'أندرو أشرف', role: 'individual', points: 0 } as unknown as User;

// What the parent hands down. UserBookings builds this from the PLATFORM's
// settings.paymentMethods, never from the owner — see UserBookings.test.
const PLATFORM_PAYEES = { instapay: { label: 'منصة بيما', value: '01096126259' } };

const mount = (over: Record<string, unknown> = {}) => {
  const props = {
    open: true, booking, currentUser: me, amount: 4500,
    payees: PLATFORM_PAYEES,
    onClose: vi.fn(), onSubmit: vi.fn(), onGoHome: vi.fn(),
    ...over,
  };
  const view = render(<DepositPayment {...(props as unknown as React.ComponentProps<typeof DepositPayment>)} />);
  return { ...view, props };
};

/** Step 1 -> 2. One method is preselected, so «متابعة» is already live. */
const goToProofStep = () => fireEvent.click(screen.getByText('متابعة').closest('button')!);

/** Attach a receipt through the real hidden file input, then wait for
 *  FileReader to resolve — proof is set in reader.onload, not synchronously. */
const attachProof = async (container: HTMLElement) => {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File(['receipt-bytes'], 'receipt.png', { type: 'image/png' });
  fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() => expect(screen.getByText('receipt.png')).toBeInTheDocument());
};

const submitBtn = () => screen.getByText('تأكيد إرسال إثبات الدفع').closest('button') as HTMLButtonElement;

beforeEach(() => vi.clearAllMocks());

describe('DepositPayment — duplicate submission', () => {
  it('files the receipt exactly once when the button is hit twice in a row', async () => {
    const { container, props } = mount();
    goToProofStep();
    await attachProof(container);

    // Capture the node first, exactly as a real double-tap does: both events
    // are aimed at the element that was under the finger on the first press.
    const btn = submitBtn();
    fireEvent.click(btn);
    fireEvent.click(btn);

    expect(props.onSubmit).toHaveBeenCalledTimes(1);
  });

  it('removes the submit control the instant the first press lands', async () => {
    // This is the mechanism the whole protection rests on. If it ever stops
    // being true, the test above stops meaning anything — so assert it directly.
    const { container } = mount();
    goToProofStep();
    await attachProof(container);
    fireEvent.click(submitBtn());
    expect(screen.queryByText('تأكيد إرسال إثبات الدفع')).toBeNull();
  });

  it('lands on the confirmation instead of the form', async () => {
    const { container } = mount();
    goToProofStep();
    await attachProof(container);
    fireEvent.click(submitBtn());
    expect(screen.getByText('تم إرسال إثبات الدفع بنجاح')).toBeInTheDocument();
  });

  it('passes the method and the receipt through to the parent', async () => {
    const { container, props } = mount();
    goToProofStep();
    await attachProof(container);
    fireEvent.click(submitBtn());
    const sent = (props.onSubmit as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(sent.method).toBe('instapay');
    expect(sent.proofImage).toMatch(/^data:/);
  });
});

describe('DepositPayment — nothing sent without a receipt', () => {
  it('keeps the submit control disabled until a proof is attached', () => {
    mount();
    goToProofStep();
    expect(submitBtn().disabled).toBe(true);
  });

  it('never calls onSubmit while the receipt is missing', () => {
    const { props } = mount();
    goToProofStep();
    fireEvent.click(submitBtn());
    expect(props.onSubmit).not.toHaveBeenCalled();
  });
});

describe('DepositPayment — the beneficiary comes from the parent only', () => {
  it('shows the destination it was handed', () => {
    mount();
    goToProofStep();
    expect(screen.getByText('01096126259')).toBeInTheDocument();
  });

  it('renders whatever destination the parent passes, and nothing else', () => {
    mount({ payees: { instapay: { label: 'منصة بيما', value: '01555000111' } } });
    goToProofStep();
    expect(screen.getByText('01555000111')).toBeInTheDocument();
    expect(screen.queryByText('01096126259')).toBeNull();
  });

  it('offers no input that could redirect the money', () => {
    // The only writable field on this step is the optional reference number.
    // If a second text input ever appears here, this fails and someone looks.
    const { container } = mount();
    goToProofStep();
    const writable = [...container.querySelectorAll('input')]
      .filter((i) => i.type !== 'file');
    expect(writable).toHaveLength(1);
    expect(writable[0].placeholder).toBe('أدخل رقم المرجع إن وجد');
  });

  it('says so plainly when the platform has configured no destination', () => {
    mount({ payees: {} });
    expect(screen.getByText(/لم يحدّد المكان وسيلة استلام بعد/)).toBeInTheDocument();
  });
});
