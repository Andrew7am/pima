/**
 * Phase 9 safety gate — HouseNeighbours.
 *
 * This component carries a safeguarding contract, not just a visual one: it
 * shows a servant that another group shares the house, deliberately as an
 * aggregate, and deliberately with no way to contact them. The server enforces
 * that (get_house_neighbours, migration 111), but a careless edit here could
 * still surface a field the RPC did return. These tests pin the shape of what
 * reaches the screen.
 *
 * It is also the ONLY child of HouseDetail with a second consumer —
 * UserBookings.tsx, migrated in Phase 5 — so anything that changes here lands
 * on an already-migrated screen too.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const getHouseNeighbours = vi.fn();
vi.mock('../../lib/selfRegister', () => ({
  getHouseNeighbours: (id: string) => getHouseNeighbours(id),
}));

import HouseNeighbours from './HouseNeighbours';

const row = (o: Record<string, unknown> = {}) => ({
  bookingType: 'youth', sizeBand: '٤٠–٦٠', checkIn: '2026-09-01', checkOut: '2026-09-04', ...o,
});

beforeEach(() => { getHouseNeighbours.mockReset(); });

describe('HouseNeighbours — when it stays silent', () => {
  it('renders nothing at all while the request is in flight', () => {
    getHouseNeighbours.mockReturnValue(new Promise(() => {}));   // never settles
    const { container } = render(<HouseNeighbours bookingId="b1" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the house is theirs alone', async () => {
    getHouseNeighbours.mockResolvedValue([]);
    const { container } = render(<HouseNeighbours bookingId="b1" />);
    await waitFor(() => expect(getHouseNeighbours).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the call fails and the wrapper returns []', async () => {
    getHouseNeighbours.mockResolvedValue([]);
    const { container } = render(<HouseNeighbours bookingId="b1" />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});

describe('HouseNeighbours — what it shows', () => {
  it('names the group kind and the size band, and heads the card', async () => {
    getHouseNeighbours.mockResolvedValue([row()]);
    render(<HouseNeighbours bookingId="b1" />);
    expect(await screen.findByText('في البيت معاكم')).toBeInTheDocument();
    expect(screen.getByText(/٤٠–٦٠ فرد/)).toBeInTheDocument();
  });

  it('lists every neighbouring group', async () => {
    getHouseNeighbours.mockResolvedValue([row(), row({ sizeBand: '١٠–٢٠' })]);
    render(<HouseNeighbours bookingId="b1" />);
    await screen.findByText('في البيت معاكم');
    expect(screen.getByText(/٤٠–٦٠ فرد/)).toBeInTheDocument();
    expect(screen.getByText(/١٠–٢٠ فرد/)).toBeInTheDocument();
  });

  it('falls back to «مجموعة» for a booking type it does not recognise', async () => {
    getHouseNeighbours.mockResolvedValue([row({ bookingType: 'not-a-real-key' })]);
    render(<HouseNeighbours bookingId="b1" />);
    expect((await screen.findAllByText(/مجموعة/)).length).toBeGreaterThan(0);
  });
});

describe('HouseNeighbours — the safeguarding contract', () => {
  it('leaks no identifying field even when the payload carries them', async () => {
    // The RPC does not return these. If it ever did, the component must still
    // not paint them — this test is the tripwire.
    getHouseNeighbours.mockResolvedValue([row({
      churchName: 'كنيسة مار مرقس', servantName: 'أبونا بولس',
      phone: '01000000000', exactCount: 47, userId: 'u-secret',
    })]);
    const { container } = render(<HouseNeighbours bookingId="b1" />);
    await screen.findByText('في البيت معاكم');
    const painted = container.textContent || '';
    for (const secret of ['كنيسة مار مرقس', 'أبونا بولس', '01000000000', '47', 'u-secret'])
      expect(painted).not.toContain(secret);
  });

  it('offers no contact affordance — no link, no button', async () => {
    getHouseNeighbours.mockResolvedValue([row()]);
    const { container } = render(<HouseNeighbours bookingId="b1" />);
    await screen.findByText('في البيت معاكم');
    expect(container.querySelectorAll('a, button')).toHaveLength(0);
  });

  it('asks the server only for the booking it was given', async () => {
    getHouseNeighbours.mockResolvedValue([row()]);
    render(<HouseNeighbours bookingId="booking-42" />);
    await waitFor(() => expect(getHouseNeighbours).toHaveBeenCalledWith('booking-42'));
  });
});
