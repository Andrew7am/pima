import { describe, it, expect } from 'vitest';
import {
  arabicNumber, arabicPlural, arabicDate, arabicDateRange,
  BOOKING_FORMS, USER_FORMS, GUEST_FORMS, ROOM_FORMS, BED_FORMS,
  REVIEW_FORMS, HOUSE_FORMS, EXPENSE_FORMS, TASK_FORMS, AMENITY_FORMS, NIGHT_FORMS, DAY_FORMS, MEMBER_FORMS, POINT_FORMS,
} from './arabic';

const DAYS = { one: 'يوم', two: 'يومين', few: 'أيام', many: 'يوم' };

describe('arabicNumber', () => {
  it('renders Arabic-Indic digits, not Latin', () => {
    expect(arabicNumber(15)).toBe('١٥');
    expect(arabicNumber(0)).toBe('٠');
    // The whole point: no Latin digit may survive.
    expect(arabicNumber(7560)).not.toMatch(/[0-9]/);
  });
});

describe('arabicPlural', () => {
  // 1 and 2 carry the count in the noun — printing a numeral there reads wrong.
  it('omits the numeral for one and two', () => {
    expect(arabicPlural(1, DAYS)).toBe('يوم');
    expect(arabicPlural(2, DAYS)).toBe('يومين');
  });

  // THE bug this was written for: "بعد ٣ يوم" instead of "بعد ٣ أيام".
  it('uses the plural of paucity for 3 to 10', () => {
    expect(arabicPlural(3, DAYS)).toBe('٣ أيام');
    expect(arabicPlural(6, DAYS)).toBe('٦ أيام');
    expect(arabicPlural(10, DAYS)).toBe('١٠ أيام');
  });

  it('returns to the singular from 11 up', () => {
    expect(arabicPlural(11, DAYS)).toBe('١١ يوم');
    expect(arabicPlural(29, DAYS)).toBe('٢٩ يوم');
    expect(arabicPlural(99, DAYS)).toBe('٩٩ يوم');
  });

  // CLDR `ar` keys on n % 100, so agreement survives past a hundred.
  it('follows n % 100 above 100', () => {
    const years = { one: 'سنة', two: 'سنتين', few: 'سنوات', many: 'سنة' };
    expect(arabicPlural(103, years)).toBe('١٠٣ سنوات');
    expect(arabicPlural(111, years)).toBe('١١١ سنة');
    expect(arabicPlural(100, years)).toBe('١٠٠ سنة');
  });

  it('takes an explicit wording for none', () => {
    expect(arabicPlural(0, { ...DAYS, zero: 'مفيش أيام' })).toBe('مفيش أيام');
    expect(arabicPlural(0, DAYS)).toBe('٠ يوم');
  });

  it('never emits a Latin digit', () => {
    for (const n of [3, 11, 47, 103, 250]) {
      expect(arabicPlural(n, DAYS)).not.toMatch(/[0-9]/);
    }
  });
});

// The shared noun tables. A table is just data, so the only way it goes wrong
// is a typo — a `few` that is really a singular, or a dual that quietly
// duplicates the singular. Both read as broken Arabic on the dashboards, and
// both are invisible in a diff.
describe('the shared counted nouns', () => {
  const TABLES = {
    BOOKING_FORMS, USER_FORMS, GUEST_FORMS, ROOM_FORMS, BED_FORMS,
    REVIEW_FORMS, HOUSE_FORMS, EXPENSE_FORMS, TASK_FORMS, AMENITY_FORMS, NIGHT_FORMS, DAY_FORMS, MEMBER_FORMS, POINT_FORMS,
  };

  for (const [name, forms] of Object.entries(TABLES)) {
    it(`${name} agrees at 1, 2, 3 and 11`, () => {
      // One and two carry the count in the noun, so no numeral is printed.
      expect(arabicPlural(1, forms)).toBe(forms.one);
      expect(arabicPlural(2, forms)).toBe(forms.two);
      // Three takes the plural of paucity, eleven goes back to the singular.
      expect(arabicPlural(3, forms)).toBe(`٣ ${forms.few}`);
      expect(arabicPlural(11, forms)).toBe(`١١ ${forms.many}`);

      // A dual that equals the singular means the table was filled in by
      // copy-paste, and a `few` that equals `many` means the paucity plural
      // was never written.
      expect(forms.two).not.toBe(forms.one);
      expect(forms.few).not.toBe(forms.many);

      for (const n of [1, 2, 3, 11, 47]) {
        expect(arabicPlural(n, forms)).not.toMatch(/[0-9]/);
      }
    });
  }
});

describe('arabicDate', () => {
  it('names the month and uses Arabic-Indic digits', () => {
    const out = arabicDate('2026-07-18T08:00:00Z');
    expect(out).toContain('يوليو');
    expect(out).not.toMatch(/[0-9]/);
  });

  it('returns nothing for a missing or unparseable date', () => {
    expect(arabicDate(undefined)).toBe('');
    expect(arabicDate('not-a-date')).toBe('');
  });
});

describe('arabicDateRange', () => {
  // Replaces "2026-08-15 → 2026-08-18": raw ISO, Latin digits, and two runs
  // either side of an arrow that can swap visually inside an RTL container.
  it('names the month once when both ends share it', () => {
    const out = arabicDateRange('2026-08-15', '2026-08-18');
    expect(out).toBe('١٥ – ١٨ أغسطس ٢٠٢٦');
  });

  it('spells both days out across a month boundary', () => {
    const out = arabicDateRange('2026-08-30', '2026-09-02');
    expect(out).toContain('أغسطس');
    expect(out).toContain('سبتمبر');
    expect(out).not.toMatch(/[0-9]/);
  });

  // A stay over new year has to be unambiguous about which year is which.
  it('names both years when the stay crosses one', () => {
    const out = arabicDateRange('2026-12-30', '2027-01-02');
    expect(out).toContain('٢٠٢٦');
    expect(out).toContain('٢٠٢٧');
  });

  it('emits no ISO text and no Latin digits at all', () => {
    const out = arabicDateRange('2026-08-15', '2026-08-18');
    expect(out).not.toContain('2026');
    expect(out).not.toMatch(/[0-9]/);
    expect(out).not.toContain('→');
  });

  it('returns nothing when either end is unparseable', () => {
    expect(arabicDateRange('nope', '2026-08-18')).toBe('');
  });
});
