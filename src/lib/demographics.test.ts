import { describe, it, expect } from 'vitest';
import {
  AGE_BANDS, UNKNOWN, ageFrom, bandFor, byAgeBand, byGovernorate, coverage, medianAge,
} from './demographics';
import type { User } from '../types';

/**
 * These numbers get read as fact by whoever is deciding where to advertise or
 * which age group to build a retreat for. The failure worth guarding is not a
 * crash — it is a percentage that looks authoritative while quietly excluding
 * the people it could not classify.
 */
const NOW = new Date('2026-08-06T12:00:00Z');

const user = (over: Partial<User>): User => ({
  id: Math.random().toString(36).slice(2),
  email: 'a@b.c', name: 'n', role: 'individual', phone: '', createdAt: '2025-01-01',
  ...over,
} as User);

describe('ageFrom', () => {
  it('counts whole years', () => {
    expect(ageFrom('2000-08-06', NOW)).toBe(26);
  });

  it('does not count a birthday that has not arrived yet', () => {
    // Same year, one day later — still 25.
    expect(ageFrom('2000-08-07', NOW)).toBe(25);
    expect(ageFrom('2000-12-31', NOW)).toBe(25);
  });

  it('counts the birthday itself', () => {
    expect(ageFrom('2000-08-06', NOW)).toBe(26);
  });

  it('refuses what it cannot trust, instead of guessing', () => {
    // Each of these would otherwise land in a band and be read as a real
    // person of that age.
    expect(ageFrom(undefined, NOW)).toBeNull();
    expect(ageFrom('', NOW)).toBeNull();
    expect(ageFrom('not-a-date', NOW)).toBeNull();
    expect(ageFrom('2030-01-01', NOW)).toBeNull();  // future
    expect(ageFrom('1850-01-01', NOW)).toBeNull();  // beyond a lifetime
  });
});

describe('bandFor', () => {
  it('puts each age in exactly one band', () => {
    for (let age = 0; age <= 120; age++) {
      const hits = AGE_BANDS.filter((b) => age >= b.min && age <= b.max);
      expect(hits).toHaveLength(1);
    }
  });

  it('has no gap between bands', () => {
    for (let i = 1; i < AGE_BANDS.length; i++) {
      expect(AGE_BANDS[i].min).toBe(AGE_BANDS[i - 1].max + 1);
    }
  });

  it('places the boundaries where the labels say', () => {
    expect(bandFor(17)?.label).toBe('أقل من ١٨');
    expect(bandFor(18)?.label).toBe('١٨ – ٢٤');
    expect(bandFor(60)?.label).toBe('٦٠ فأكثر');
  });
});

describe('byGovernorate', () => {
  const users = [
    user({ governorate: 'القاهرة' }), user({ governorate: 'القاهرة' }),
    user({ governorate: 'الجيزة' }),
    user({ governorate: '' }), user({}),
  ];

  it('counts what people entered', () => {
    const g = byGovernorate(users);
    expect(g.find((s) => s.label === 'القاهرة')).toMatchObject({ count: 2, pct: 40 });
    expect(g.find((s) => s.label === 'الجيزة')).toMatchObject({ count: 1, pct: 20 });
  });

  it('counts the unrecorded rather than dropping them', () => {
    // Both the empty string and the missing field. Dropping them would make
    // القاهرة look like 67% of users instead of 40%.
    expect(byGovernorate(users).find((s) => s.label === UNKNOWN)).toMatchObject({ count: 2, pct: 40 });
  });

  it('adds up to the whole population', () => {
    expect(byGovernorate(users).reduce((s, x) => s + x.count, 0)).toBe(users.length);
  });

  it('puts «غير محدد» last even when it is the biggest', () => {
    // It is not a governorate; ranking it among them reads as though it were.
    const lopsided = [user({}), user({}), user({}), user({ governorate: 'أسيوط' })];
    expect(byGovernorate(lopsided)[byGovernorate(lopsided).length - 1].label).toBe(UNKNOWN);
  });

  it('survives having no users at all', () => {
    expect(byGovernorate([])).toEqual([]);
  });
});

describe('byAgeBand', () => {
  const users = [
    user({ dateOfBirth: '2010-01-01' }), // 16
    user({ dateOfBirth: '2004-01-01' }), // 22
    user({ dateOfBirth: '2000-01-01' }), // 26
    user({ dateOfBirth: 'nonsense' }),
    user({}),
  ];

  it('reports bands in age order, not by size', () => {
    // Age is ordinal — sorting by count would hide the shape of the audience.
    const labels = byAgeBand(users, NOW).map((s) => s.label);
    expect(labels).toEqual([...AGE_BANDS.map((b) => b.label), UNKNOWN]);
  });

  it('places each user in the right band', () => {
    const b = byAgeBand(users, NOW);
    expect(b.find((s) => s.label === 'أقل من ١٨')?.count).toBe(1);
    expect(b.find((s) => s.label === '١٨ – ٢٤')?.count).toBe(1);
    expect(b.find((s) => s.label === '٢٥ – ٣٤')?.count).toBe(1);
  });

  it('counts an unusable date of birth as unknown, not as an age', () => {
    expect(byAgeBand(users, NOW).find((s) => s.label === UNKNOWN)?.count).toBe(2);
  });

  it('shows empty bands rather than omitting them', () => {
    // A band with nobody in it is a real finding; a missing row is a mystery.
    expect(byAgeBand(users, NOW).filter((s) => s.count === 0).length).toBeGreaterThan(0);
  });

  it('adds up to the whole population', () => {
    expect(byAgeBand(users, NOW).reduce((s, x) => s + x.count, 0)).toBe(users.length);
  });
});

describe('medianAge', () => {
  it('takes the middle of an odd count', () => {
    const users = [
      user({ dateOfBirth: '2006-01-01' }), // 20
      user({ dateOfBirth: '1996-01-01' }), // 30
      user({ dateOfBirth: '1986-01-01' }), // 40
    ];
    expect(medianAge(users, NOW)).toBe(30);
  });

  it('averages the middle two of an even count', () => {
    const users = [user({ dateOfBirth: '2006-01-01' }), user({ dateOfBirth: '1996-01-01' })];
    expect(medianAge(users, NOW)).toBe(25);
  });

  it('ignores users it cannot age rather than treating them as zero', () => {
    const users = [user({ dateOfBirth: '1996-01-01' }), user({}), user({ dateOfBirth: 'bad' })];
    expect(medianAge(users, NOW)).toBe(30);
  });

  it('is null when nobody can be aged', () => {
    expect(medianAge([user({}), user({})], NOW)).toBeNull();
    expect(medianAge([], NOW)).toBeNull();
  });
});

describe('coverage', () => {
  it('says how many users each figure could speak for', () => {
    // Without this the reader cannot tell a 60% share of everyone from a 60%
    // share of the three people who filled the field in.
    const users = [
      user({ governorate: 'القاهرة', dateOfBirth: '1996-01-01' }),
      user({ governorate: 'الجيزة' }),
      user({}),
    ];
    expect(coverage(users, NOW)).toEqual({ total: 3, governorate: 2, age: 1 });
  });
});
