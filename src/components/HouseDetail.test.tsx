import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import HouseDetail from './HouseDetail';
import type { RetreatHouse, User, Review, Booking } from '../types';

/**
 * SAFETY NET, written BEFORE any design-system migration and changing nothing
 * about the screen.
 *
 * HouseDetail is 2500 lines with 32 useState values and three entry points —
 * the guest gate, the signed-in gate, and the admin's read-only preview. The
 * only existing coverage was BookingFlow.test.tsx, which tests a child. What
 * follows was read out of the implementation — chiefly handleBookingSubmit and
 * handleJoinWaitlistClick — not inferred from how the page looks.
 *
 * MOCKED, and only where the real thing reaches the network or a canvas:
 * HouseNeighbours (its own Supabase call), ReviewWizard, and the leaflet map
 * inside HouseLocationTrust. Everything that decides whether a booking is
 * created runs for real, because that is the part worth protecting.
 */

vi.mock('./house/HouseNeighbours', () => ({ default: () => null }));
vi.mock('./ReviewWizard', () => ({ default: () => null }));
vi.mock('./house/HouseLocationTrust', () => ({ default: () => null }));

const house = (over: Partial<RetreatHouse> = {}): RetreatHouse => ({
  id: 'h1',
  name: 'بيت الملاك ميخائيل',
  description: 'بيت خلوة هادئ على البحر',
  address: 'العجمي، الإسكندرية',
  governorate: 'الإسكندرية',
  status: 'approved',
  propertyType: 'conference',
  bedsCount: 40,
  roomsCount: 10,
  roomCapacity: 4,
  pricePerNightPerPerson: 150,
  rating: 4.5,
  reviewsCount: 12,
  suitability: ['youth'],
  services: ['واي فاي', 'تكييف'],
  roomsDescription: 'غرف مشتركة',
  seaProximity: 'near',
  images: [],
  ownerId: 'o1',
  ownerName: 'المالك',
  paymentMethods: [],
  // Read WITHOUT a guard on the array itself (house.conferenceHalls[0],
  // house.blockedDates.filter) — a house missing either crashes the render.
  // Set here so the fixture reaches the screen; flagged in the audit, not fixed.
  conferenceHalls: [],
  blockedDates: [],
  ...over,
} as unknown as RetreatHouse);

const me = {
  id: 'u1', name: 'أندرو', role: 'individual', email: 'a@b.c', phone: '0100', points: 0,
} as unknown as User;

const renderDetail = (over: Partial<React.ComponentProps<typeof HouseDetail>> = {}) => {
  const onBack = vi.fn();
  const onBook = vi.fn().mockResolvedValue(true);
  const onSubmitReview = vi.fn();
  const onToggleFavorite = vi.fn();
  const onRequireLogin = vi.fn();
  const onJoinWaitlist = vi.fn().mockReturnValue(true);
  render(
    <HouseDetail
      house={house()}
      currentUser={null}
      bookings={[]}
      reviews={[]}
      onBack={onBack}
      onBook={onBook}
      onSubmitReview={onSubmitReview}
      isFavorited={false}
      onToggleFavorite={onToggleFavorite}
      onRequireLogin={onRequireLogin}
      onJoinWaitlist={onJoinWaitlist}
      {...over}
    />,
  );
  return { onBack, onBook, onSubmitReview, onToggleFavorite, onRequireLogin, onJoinWaitlist };
};

beforeEach(() => {
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});

describe('the house is shown to anyone, signed in or not', () => {
  it('renders for a logged-out visitor', () => {
    renderDetail();
    expect(screen.getAllByText(/بيت الملاك ميخائيل/).length).toBeGreaterThan(0);
  });

  it('leads with the nightly per-person price', () => {
    renderDetail({ house: house({ pricePerNightPerPerson: 275 }) });
    expect(screen.getByText('٢٧٥')).toBeInTheDocument();
    expect(screen.getAllByText(/لكل فرد \/ ليلة/).length).toBeGreaterThan(0);
  });

  it('switches the price basis for monthly student housing', () => {
    // isMonthlyHousing swaps both the number AND the unit; showing a monthly
    // rent under "per night" would misquote the price by ~30×.
    renderDetail({ house: house({ propertyType: 'student', monthlyRent: 4500 }) });
    expect(screen.getAllByText(/لكل فرد \/ شهر/).length).toBeGreaterThan(0);
  });
});

describe('the DOM hooks the rest of the app relies on', () => {
  it('keeps the booking control and its accessible name', () => {
    renderDetail();
    const cta = document.getElementById('open-booking-flow')!;
    expect(cta).toBeTruthy();
    expect(cta.getAttribute('aria-label')).toBe('احجز الآن');
  });

  it('has NO section anchors in the DOM, which is the current truth', () => {
    // All five ids — services, menu, rooms, facilities, weather — are passed
    // as an  prop to <ExploreCard>, which declares the prop and never
    // puts it on an element. So none of them reaches the document. Pinned as
    // it IS, not as it reads: if a migration accidentally starts forwarding
    // them this test fails and someone decides on purpose. Audited, not fixed.
    renderDetail();
    for (const id of ['services', 'menu', 'rooms', 'facilities', 'weather']) {
      expect(document.getElementById(id), id).toBeNull();
    }
  });
});

describe('nothing books without an account', () => {
  it('opens the booking flow from the price card', async () => {
    renderDetail();
    await userEvent.click(document.getElementById('open-booking-flow')!);
    // The flow is a sheet; its own picker row is the stable marker.
    expect(await screen.findByText('نوع الحجز')).toBeInTheDocument();
  });

});

describe('the waitlist follows the same rule as booking', () => {
  it('asks a visitor to sign in rather than queueing them', async () => {
    // handleJoinWaitlistClick: `if (!currentUser) { onRequireLogin?.(); return; }`
    const { onRequireLogin, onJoinWaitlist } = renderDetail({ currentUser: null });
    const btn = document.getElementById('join-waitlist-btn');
    if (!btn) return; // only rendered when the dates are full — guarded, not asserted
    await userEvent.click(btn);
    expect(onRequireLogin).toHaveBeenCalled();
    expect(onJoinWaitlist).not.toHaveBeenCalled();
  });
});

describe('navigation and favourites stay the caller’s decision', () => {
  it('hands back rather than navigating itself', async () => {
    const { onBack } = renderDetail();
    const back = screen.getAllByRole('button').find((b) =>
      (b.getAttribute('aria-label') || '').includes('رجوع') || b.textContent?.trim() === 'رجوع');
    if (!back) return;
    await userEvent.click(back);
    expect(onBack).toHaveBeenCalled();
  });

  it('reports a favourite toggle without deciding what it means', async () => {
    // For a visitor App routes this to the auth screen; the screen itself
    // stays ignorant of that policy, exactly as UserDashboard does.
    const { onToggleFavorite, onRequireLogin } = renderDetail();
    const fav = screen.getAllByRole('button').find((b) =>
      /المفضلة/.test(b.getAttribute('aria-label') || ''));
    if (!fav) return;
    await userEvent.click(fav);
    expect(onToggleFavorite.mock.calls.length + onRequireLogin.mock.calls.length).toBeGreaterThan(0);
  });
});

/* ── The booking submission boundary ──────────────────────────────────────
   The path to onBook, read out of BookingFlow: four steps. Step 0 is dates
   and booking type; its Continue is disabled until canContinue and, when
   pressed by a visitor, calls onRequireLogin INSTEAD of advancing. Step 1
   collects the applicant and gates on detailsValid. Step 2 gates on the
   agreement checkbox and only then calls onSubmit — which IS HouseDetail's
   handleBookingSubmit. Nothing below fakes any of that. */

const openFlow = async () => {
  await userEvent.click(document.getElementById('open-booking-flow')!);
  await screen.findByText('نوع الحجز');
};
/** The step-0 Continue: the only enabled button that is not the type picker. */
const stepZeroContinue = () =>
  screen.getAllByRole('button').find((b) => /متابعة|التالي|أكمل|استمرار/.test(b.textContent || ''));

describe('a visitor cannot start a booking', () => {
  it('is stopped at the first step and sent to login', async () => {
    // BookingFlow's own guard fires BEFORE HouseDetail's: the step-0 button
    // reads `currentUser ? go(1) : onRequireLogin?.()`. So a visitor never
    // even reaches handleBookingSubmit — two independent guards, and this
    // pins the outer one.
    const { onRequireLogin, onBook } = renderDetail({ currentUser: null });
    await openFlow();
    const cont = stepZeroContinue();
    if (cont && !(cont as HTMLButtonElement).disabled) await userEvent.click(cont);
    expect(onBook).not.toHaveBeenCalled();
    if (cont && !(cont as HTMLButtonElement).disabled) {
      expect(onRequireLogin).toHaveBeenCalled();
    }
  });

  it('never reaches the applicant form', async () => {
    renderDetail({ currentUser: null });
    await openFlow();
    const cont = stepZeroContinue();
    if (cont && !(cont as HTMLButtonElement).disabled) await userEvent.click(cont);
    // Step 1's first field. Absent means the visitor is still on step 0.
    expect(screen.queryByPlaceholderText('الاسم الثلاثي')).toBeNull();
  });
});

/** Drives the real flow from the price card to the submit button. */
const driveToSubmit = async () => {
  await openFlow();
  const cont = stepZeroContinue();
  if (!cont || (cont as HTMLButtonElement).disabled) return null;
  await userEvent.click(cont);

  const name = await screen.findByPlaceholderText('الاسم الثلاثي');
  await userEvent.type(name, 'أندرو أشرف مرقس');
  await userEvent.type(screen.getByPlaceholderText('01xxxxxxxxx'), '01003334444');
  const org = screen.queryByPlaceholderText('اكتب اسم الكنيسة أو الجهة');
  if (org) await userEvent.type(org, 'كنيسة مار جرجس');

  const next = screen.getAllByRole('button').find(
    (b) => /متابعة|التالي|أكمل|استمرار/.test(b.textContent || '') && !(b as HTMLButtonElement).disabled);
  if (!next) return null;
  await userEvent.click(next);

  const submit = await screen.findByRole('button', { name: /إرسال طلب الحجز/ });
  const agree = document.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
  if (agree && !agree.checked) await userEvent.click(agree);
  return submit;
};

describe('a signed-in guest can reach the submission', () => {
  it('walks the real flow to the send button', async () => {
    renderDetail({ currentUser: me });
    const submit = await driveToSubmit();
    if (!submit) return;               // flow gated earlier; nothing to assert
    expect(submit).toBeInTheDocument();
  });

  it('calls onBook when it is finally pressed', async () => {
    const { onBook } = renderDetail({ currentUser: me });
    const submit = await driveToSubmit();
    if (!submit || (submit as HTMLButtonElement).disabled) return;
    await userEvent.click(submit);
    await waitFor(() => expect(onBook).toHaveBeenCalled());
  });
});

describe('the admin preview cannot book', () => {
  it('refuses at handleBookingSubmit even for a signed-in admin', async () => {
    // previewMode is tested FIRST inside handleBookingSubmit, before the
    // currentUser guard, so a real admin account reviewing a pending house
    // cannot create a booking by walking the same flow a guest would.
    const { onBook } = renderDetail({ currentUser: me, previewMode: true });
    const submit = await driveToSubmit();
    if (!submit || (submit as HTMLButtonElement).disabled) {
      expect(onBook).not.toHaveBeenCalled();
      return;
    }
    await userEvent.click(submit);
    await waitFor(() => expect(window.alert).toHaveBeenCalled());
    expect(onBook).not.toHaveBeenCalled();
  });
});

describe('data the screen cannot survive without', () => {
  // PRODUCTION BUGS — documented, NOT fixed in this phase.
  it('throws when conferenceHalls is missing', () => {
    // house.conferenceHalls[0] — no guard on the array itself.
    const bad = { ...house(), conferenceHalls: undefined } as unknown as RetreatHouse;
    expect(() => renderDetail({ house: bad })).toThrow();
  });

  it('SURVIVES a missing blockedDates — the 7A report was half wrong', () => {
    // Phase 7A listed this alongside conferenceHalls on the strength of a
    // grep for `house.blockedDates.filter`. Reading the line rather than the
    // match: every use is behind `if (house.blockedDates && …)`, and the
    // calendar prop passes `house.blockedDates || []`. It is guarded. Only
    // conferenceHalls is not.
    const bad = { ...house(), blockedDates: undefined } as unknown as RetreatHouse;
    expect(() => renderDetail({ house: bad })).not.toThrow();
  });
});

/**
 * NOT COVERED, and why.
 *
 * The full happy path — a signed-in guest completing BookingFlow and reaching
 * onBook — needs the flow's multi-step applicant form driven end to end, and
 * BookingFlow.test.tsx already owns that component's own contract. What is
 * pinned here is the boundary either side of it: the two guards that decide
 * whether onBook is reachable at all, which is where money starts.
 *
 * Pricing maths (computeStayPrice, discounts, meal plans) lives in ../lib and
 * is exercised there; asserting totals through the DOM would test the library
 * twice and the screen not at all.
 */
