import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MIN_PASSWORD_LENGTH, minPasswordLabel, passwordProblem } from './password';

describe('passwordProblem', () => {
  it('accepts a password at the floor', () => {
    expect(passwordProblem('a'.repeat(MIN_PASSWORD_LENGTH))).toBeNull();
  });

  it('rejects one character short', () => {
    expect(passwordProblem('a'.repeat(MIN_PASSWORD_LENGTH - 1))).toContain('على الأقل');
  });

  // The whole point of the bug this replaces: the client accepted a length
  // the server would refuse, and the refusal did not mention length.
  it('rejects the seven characters that used to slip through', () => {
    expect(passwordProblem('abc1234')).not.toBeNull();
  });

  it('says the length in Arabic numerals', () => {
    expect(minPasswordLabel).toBe('٨ أحرف على الأقل');
    expect(passwordProblem('short')).toContain('٨');
  });

  it('reports length before mismatch — a too-short password is wrong either way', () => {
    expect(passwordProblem('abc', 'xyz')).toContain('على الأقل');
  });

  it('reports a mismatch once the length is fine', () => {
    expect(passwordProblem('abcd1234', 'abcd9999')).toBe('كلمتا المرور غير متطابقتين.');
  });

  it('ignores confirmation when the caller does not ask for one', () => {
    expect(passwordProblem('abcd1234')).toBeNull();
  });
});

/**
 * The floor is mirrored from Supabase's dashboard, so nothing in the build can
 * prove the two agree. What CAN be proved is that the app states one number
 * rather than four — which is how the previous drift went unnoticed.
 */
describe('the app states the password floor exactly once', () => {
  const files = [
    'src/components/AuthScreen.tsx',
    'src/components/ResetPasswordScreen.tsx',
    'src/components/owner/OwnerDashboardShell.tsx',
    'src/lib/authErrors.ts',
  ];

  for (const f of files) {
    it(`${f} does not hard-code a length of its own`, () => {
      const src = readFileSync(join(process.cwd(), f), 'utf8');
      // Any bare digit next to أحرف, or a minLength/length comparison against
      // a literal, means this file has an opinion it should not have.
      expect(src).not.toMatch(/[\d٠-٩]\s*أحرف/);
      expect(src).not.toMatch(/minLength=\{\s*\d+\s*\}/);
      expect(src).not.toMatch(/password[A-Za-z]*\.length\s*<\s*\d/);
    });
  }
});
