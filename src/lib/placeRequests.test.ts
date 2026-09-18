import { describe, it, expect } from 'vitest';
import { mapPlaceRequest, demandByGovernorate, matchGovernorate } from './placeRequests';
import type { PlaceRequest } from './placeRequests';

/**
 * The demand list (0165).
 *
 * The mapper is guarded for the same reason every other mapper in this
 * codebase is: a column that is read under one name and written under
 * another silently becomes undefined, and a phone number that arrives as
 * undefined is a person nobody calls.
 */

const req = (over: Partial<PlaceRequest> = {}): PlaceRequest => ({
  id: 'r1',
  createdAt: '2026-09-01T10:00:00Z',
  userId: null,
  name: 'مينا',
  phone: '01001234567',
  governorate: 'المنيا',
  checkIn: null,
  checkOut: null,
  guests: null,
  note: null,
  status: 'new',
  ...over,
});

describe('mapPlaceRequest', () => {
  it('reads every column the table has', () => {
    const r = mapPlaceRequest({
      id: 'abc',
      created_at: '2026-09-18T08:00:00Z',
      user_id: 'u1',
      name: 'مريم',
      phone: '01112223334',
      governorate: 'أسيوط',
      check_in: '2026-10-01',
      check_out: '2026-10-04',
      guests: 40,
      note: 'بيت مؤتمرات',
      status: 'contacted',
    });
    expect(r).toEqual({
      id: 'abc',
      createdAt: '2026-09-18T08:00:00Z',
      userId: 'u1',
      name: 'مريم',
      phone: '01112223334',
      governorate: 'أسيوط',
      checkIn: '2026-10-01',
      checkOut: '2026-10-04',
      guests: 40,
      note: 'بيت مؤتمرات',
      status: 'contacted',
    });
  });

  it('turns the absent optional columns into null, not undefined', () => {
    const r = mapPlaceRequest({
      id: 'abc', created_at: 'x', name: 'م', phone: '0100', status: 'new',
    });
    expect(r.userId).toBeNull();
    expect(r.governorate).toBeNull();
    expect(r.checkIn).toBeNull();
    expect(r.guests).toBeNull();
    expect(r.note).toBeNull();
  });

  it('reads guests as a number even when postgres hands back a string', () => {
    expect(mapPlaceRequest({ id: 'a', created_at: 'x', name: 'م', phone: '1', guests: '40' }).guests).toBe(40);
  });

  it('defaults an unknown status to new rather than leaving it blank', () => {
    expect(mapPlaceRequest({ id: 'a', created_at: 'x', name: 'م', phone: '1' }).status).toBe('new');
  });
});

describe('demandByGovernorate', () => {
  it('ranks the places by how many people asked for them', () => {
    const d = demandByGovernorate([
      req({ id: '1', governorate: 'المنيا', phone: '1' }),
      req({ id: '2', governorate: 'أسيوط', phone: '2' }),
      req({ id: '3', governorate: 'المنيا', phone: '3' }),
      req({ id: '4', governorate: 'المنيا', phone: '4' }),
    ]);
    expect(d.map((x) => x.governorate)).toEqual(['المنيا', 'أسيوط']);
    expect(d[0].count).toBe(3);
  });

  it('counts one person asking twice as one person but two requests', () => {
    const d = demandByGovernorate([
      req({ id: '1', governorate: 'سوهاج', phone: '0100' }),
      req({ id: '2', governorate: 'سوهاج', phone: '0100' }),
    ]);
    expect(d[0].count).toBe(2);
    expect(d[0].people).toBe(1);
  });

  it('keeps the requests that named no place instead of dropping them', () => {
    // A free-text search with no governorate in it is still demand — the
    // note carries what they typed, and throwing the row away here would
    // make the panel disagree with the list under it.
    const d = demandByGovernorate([req({ governorate: null })]);
    expect(d).toEqual([{ governorate: 'من غير محافظة', count: 1, people: 1 }]);
  });

  it('still counts a request somebody already answered', () => {
    // A closed row is evidence that the place was wanted. Dropping it would
    // make the ranking forget every place Pima has already acted on.
    const d = demandByGovernorate([
      req({ id: '1', governorate: 'قنا', phone: '1', status: 'closed' }),
      req({ id: '2', governorate: 'قنا', phone: '2', status: 'contacted' }),
    ]);
    expect(d[0]).toEqual({ governorate: 'قنا', count: 2, people: 2 });
  });

  it('has nothing to say about an empty list', () => {
    expect(demandByGovernorate([])).toEqual([]);
  });
});

describe('matchGovernorate', () => {
  const KNOWN = ['القاهرة', 'الإسكندرية', 'المنيا', 'قنا', 'البحر الأحمر', 'أسيوط'];

  it('matches the name typed exactly', () => {
    expect(matchGovernorate('المنيا', KNOWN)).toBe('المنيا');
  });

  it('matches it without the hamza, which is how it gets typed', () => {
    // «الاسكندرية» is what a phone keyboard produces at speed. Missing this
    // files the request under «من غير محافظة» and the ranking never learns
    // the place was wanted — which is the one thing the table is for.
    expect(matchGovernorate('الاسكندرية', KNOWN)).toBe('الإسكندرية');
    expect(matchGovernorate('اسيوط', KNOWN)).toBe('أسيوط');
  });

  it('matches the bare name without «ال»', () => {
    expect(matchGovernorate('منيا', KNOWN)).toBe('المنيا');
  });

  it('matches a name buried in a longer phrase', () => {
    expect(matchGovernorate('محافظة المنيا', KNOWN)).toBe('المنيا');
  });

  it('ignores surrounding whitespace', () => {
    expect(matchGovernorate('  قنا  ', KNOWN)).toBe('قنا');
  });

  it('says nothing rather than guessing at a search that is not a place', () => {
    expect(matchGovernorate('واي فاي', KNOWN)).toBeNull();
    expect(matchGovernorate('حمام سباحة', KNOWN)).toBeNull();
  });

  it('refuses to guess from one or two letters', () => {
    // «ال» is inside almost every name on the list. Two letters matching
    // would put a request for nothing at all under القاهرة.
    expect(matchGovernorate('ال', KNOWN)).toBeNull();
    expect(matchGovernorate('ا', KNOWN)).toBeNull();
    expect(matchGovernorate('', KNOWN)).toBeNull();
  });

  it('works against the real list the filter offers', async () => {
    // The unit above states its own list; this one checks the assumption
    // that the real names are shaped the way the matcher expects.
    const { GOVERNORATES } = await import('../mockData');
    expect(matchGovernorate('الاسكندريه', GOVERNORATES)).toBe('الإسكندرية');
    expect(matchGovernorate('اسوان', GOVERNORATES)).toBe('أسوان');
  });
});
