import { describe, it, expect } from 'vitest';
import { BOOKING_GROUPS, bookingTypeLabel, isStoredGroup } from './bookingGroups';

describe('isStoredGroup', () => {
  it('does not store the two kinds the booking already records', () => {
    // «حجز عادي» is the absence of a type; «مؤتمر كبير» is
    // isLargeConferenceQuote. Writing either into the jsonb as well would
    // create a second copy free to disagree with the first.
    expect(isStoredGroup('standard')).toBe(false);
    expect(isStoredGroup('conference')).toBe(false);
  });

  it('stores every other kind', () => {
    for (const g of BOOKING_GROUPS) {
      if (g.key === 'standard' || g.key === 'conference') continue;
      expect(isStoredGroup(g.key)).toBe(true);
    }
  });
});

describe('bookingTypeLabel', () => {
  it('reads a quote request as «مؤتمر كبير» whatever the jsonb says', () => {
    expect(bookingTypeLabel({ isLargeConferenceQuote: true })).toBe('مؤتمر كبير');
    // Even a contradictory record resolves one way, not two.
    expect(bookingTypeLabel({ isLargeConferenceQuote: true, conferenceDetails: { extraRequests: '', bookingType:'youth' } }))
      .toBe('مؤتمر كبير');
  });

  it('reads a stored key as its Arabic label', () => {
    expect(bookingTypeLabel({ conferenceDetails: { extraRequests: '', bookingType:'secondary' } })).toBe('خدمة ثانوي');
    expect(bookingTypeLabel({ conferenceDetails: { extraRequests: '', bookingType:'servants' } })).toBe('خدام وخدامات');
  });

  it('falls back to «حجز عادي» when nothing was chosen', () => {
    expect(bookingTypeLabel({})).toBe('حجز عادي');
    expect(bookingTypeLabel({ isLargeConferenceQuote: false, conferenceDetails: { extraRequests: 'ملاحظة' } }))
      .toBe('حجز عادي');
  });

  it('shows an unrecognised stored value rather than dropping it', () => {
    // A record written by a build that knew a key this one does not must still
    // read as something: silently showing «حجز عادي» would misreport what the
    // guest asked for on the owner's screen.
    expect(bookingTypeLabel({ conferenceDetails: { extraRequests: '', bookingType:'deacons' } })).toBe('deacons');
  });

  it('every offered kind resolves to its own label', () => {
    for (const g of BOOKING_GROUPS) {
      const label = g.key === 'conference'
        ? bookingTypeLabel({ isLargeConferenceQuote: true })
        : g.key === 'standard'
          ? bookingTypeLabel({})
          : bookingTypeLabel({ conferenceDetails: { extraRequests: '', bookingType:g.key } });
      expect(label).toBe(g.label);
    }
  });

  it('offers no duplicate keys or labels', () => {
    expect(new Set(BOOKING_GROUPS.map((g) => g.key)).size).toBe(BOOKING_GROUPS.length);
    expect(new Set(BOOKING_GROUPS.map((g) => g.label)).size).toBe(BOOKING_GROUPS.length);
  });
});
