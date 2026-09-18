import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import NoResultsRequest from './NoResultsRequest';
import { requestPlace } from '../lib/placeRequests';
import type { User } from '../types';

/**
 * The form at the end of a search that found nothing (0165).
 *
 * MOCKED, and only this: ../lib/placeRequests, which is the component's one
 * network edge.
 *
 * What these guard is mostly that the search context travels. The reader
 * types two fields; the place, the dates and the group size come from the
 * search they already ran, and if those stop being sent the row that reaches
 * the admin is a name and a phone number with no reason attached — which is
 * the one thing the table exists to avoid.
 */

vi.mock('../lib/placeRequests', () => ({
  requestPlace: vi.fn().mockResolvedValue({ ok: true }),
}));

const mockedRequest = vi.mocked(requestPlace);

beforeEach(() => {
  mockedRequest.mockClear();
  mockedRequest.mockResolvedValue({ ok: true });
});

const fill = async (name: string, phone: string) => {
  await userEvent.type(document.getElementById('place-request-name')!, name);
  await userEvent.type(document.getElementById('place-request-phone')!, phone);
};

describe('NoResultsRequest', () => {
  it('names the place the reader was looking in', () => {
    render(<NoResultsRequest governorate="المنيا" />);
    expect(screen.getByText(/لسه مفيش بيوت في/)).toHaveTextContent('المنيا');
  });

  it('says something sensible when the search named no place', () => {
    // A free-text search — «واي فاي» — has no governorate to name, and
    // «لسه مفيش بيوت في» followed by nothing is not a sentence.
    render(<NoResultsRequest query="واي فاي" />);
    expect(screen.getByText('مفيش مكان مطابق لبحثك دلوقتي')).toBeInTheDocument();
  });

  it('sends the whole search, not just the two typed fields', async () => {
    render(
      <NoResultsRequest
        governorate="أسيوط"
        checkIn="2026-10-01"
        checkOut="2026-10-04"
        guests={40}
        query="بيت مؤتمرات"
      />,
    );
    await fill('مينا', '01001234567');
    await userEvent.click(document.getElementById('place-request-submit')!);

    expect(mockedRequest).toHaveBeenCalledWith({
      name: 'مينا',
      phone: '01001234567',
      governorate: 'أسيوط',
      checkIn: '2026-10-01',
      checkOut: '2026-10-04',
      guests: 40,
      note: 'بيت مؤتمرات',
    });
  });

  it('starts from the signed-in reader’s own name and number', async () => {
    // They are already known. Making them type it again at a dead end is
    // the friction this screen exists to remove.
    const user = { id: 'u1', name: 'مريم', phone: '01112223334' } as User;
    render(<NoResultsRequest currentUser={user} governorate="قنا" />);
    await userEvent.click(document.getElementById('place-request-submit')!);
    expect(mockedRequest).toHaveBeenCalledWith(expect.objectContaining({
      name: 'مريم', phone: '01112223334',
    }));
  });

  it('refuses an empty name before spending a round trip on it', async () => {
    render(<NoResultsRequest governorate="المنيا" />);
    await userEvent.type(document.getElementById('place-request-phone')!, '01001234567');
    await userEvent.click(document.getElementById('place-request-submit')!);
    expect(await screen.findByText('اكتب اسمك من فضلك.')).toBeInTheDocument();
    expect(mockedRequest).not.toHaveBeenCalled();
  });

  it('refuses a phone number that is too short to ring', async () => {
    render(<NoResultsRequest governorate="المنيا" />);
    await fill('مينا', '0100');
    await userEvent.click(document.getElementById('place-request-submit')!);
    expect(await screen.findByText('رقم الموبايل مش مظبوط.')).toBeInTheDocument();
    expect(mockedRequest).not.toHaveBeenCalled();
  });

  it('accepts a number typed with spaces in it', async () => {
    render(<NoResultsRequest governorate="المنيا" />);
    await fill('مينا', '0100 123 4567');
    await userEvent.click(document.getElementById('place-request-submit')!);
    expect(mockedRequest).toHaveBeenCalled();
  });

  it('confirms once the request is in', async () => {
    render(<NoResultsRequest governorate="سوهاج" />);
    await fill('مينا', '01001234567');
    await userEvent.click(document.getElementById('place-request-submit')!);
    expect(await screen.findByText('وصلنا طلبك')).toBeInTheDocument();
    expect(document.getElementById('place-request-submit')).toBeNull();
  });

  it('says so when the request did not go through, and keeps the form', async () => {
    // Swallowing this would be worse than the dead end it replaced: the
    // reader would believe somebody is going to call them.
    mockedRequest.mockResolvedValue({ ok: false, error: 'network' });
    render(<NoResultsRequest governorate="سوهاج" />);
    await fill('مينا', '01001234567');
    await userEvent.click(document.getElementById('place-request-submit')!);
    expect(await screen.findByText('معلش، الطلب ماوصلش. جرب تاني.')).toBeInTheDocument();
    expect(document.getElementById('place-request-submit')).toBeTruthy();
  });
});
