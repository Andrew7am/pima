import { describe, it, expect } from 'vitest';
import { authErrorMessage, retryInLabel } from './authErrors';

describe('authErrorMessage', () => {
  it('translates the timed lockout and hands back the seconds', () => {
    // The message that put English on an Arabic page.
    const r = authErrorMessage({ message: 'For security purposes, you can only request this after 42 seconds.' });
    expect(r.retryAfterSec).toBe(42);
    expect(r.message).toContain('٤٢');
    expect(r.message).not.toMatch(/[A-Za-z]/);
  });

  it('reads the seconds whatever the rest of the sentence says', () => {
    expect(authErrorMessage({ message: 'you can only request this after 7 seconds' }).retryAfterSec).toBe(7);
    expect(authErrorMessage({ message: 'try again after 1 second' }).retryAfterSec).toBe(1);
  });

  it('names the common failures in Arabic', () => {
    const cases: [string, RegExp][] = [
      ['User already registered', /مسجل بالفعل/],
      ['Invalid login credentials', /غير صحيحة/],
      ['Email not confirmed', /تفعيل/],
      ['Email rate limit exceeded', /رسائل كثيرة/],
      ['Unable to validate email address: invalid format', /صيغة البريد/],
      ['Password should be at least 6 characters', /كلمة المرور/],
      ['Failed to fetch', /الاتصال/],
    ];
    for (const [raw, expected] of cases) {
      const { message, retryAfterSec } = authErrorMessage({ message: raw });
      expect(message, raw).toMatch(expected);
      expect(retryAfterSec, raw).toBeUndefined();
    }
  });

  it('catches a 429 that did not say so in words', () => {
    expect(authErrorMessage({ message: 'Too many requests', status: 429 }).message).toMatch(/أكثر من اللازم/);
  });

  it('never lets English reach the screen', () => {
    // The whole point: an unrecognised message must not be passed through.
    for (const input of [
      { message: 'Database error saving new user' },
      { message: '' },
      {},
      null,
      undefined,
      'a bare string, not an error object',
    ]) {
      const { message } = authErrorMessage(input);
      expect(message, JSON.stringify(input)).not.toMatch(/[A-Za-z]/);
      expect(message.length).toBeGreaterThan(0);
    }
  });
});

describe('retryInLabel', () => {
  it('counts in Arabic numerals and agrees with the noun', () => {
    expect(retryInLabel(1)).toBe('حاول بعد ١ ثانية');
    expect(retryInLabel(2)).toBe('حاول بعد ٢ ثانيتين');
    expect(retryInLabel(5)).toBe('حاول بعد ٥ ثوانٍ');
    expect(retryInLabel(42)).toBe('حاول بعد ٤٢ ثانية');
  });
});
