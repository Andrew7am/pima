import { arabicNumber } from './arabic';

/**
 * How long a password has to be, said once.
 *
 * This number lives in Supabase's Auth settings, and the client only ever
 * mirrors it. When the dashboard floor was raised from 6 to 8, three of the
 * four places that knew about it were not raised with it:
 *
 *   AuthScreen            8   ← the only one that was updated
 *   ResetPasswordScreen   6
 *   owner password change 6
 *   authErrors.ts         ٦   ← in the message shown when the SERVER refuses
 *
 * So a password reset with 7 characters passed the client, was refused by
 * Supabase, and came back as "حدث خطأ… حاول مرة أخرى" — which does not say
 * length, so the natural response is to retype the same 7 characters. The
 * server-error translation was the worst of the three: it confidently
 * reported the wrong number.
 *
 * If the dashboard floor changes again, change it HERE and nowhere else.
 */
export const MIN_PASSWORD_LENGTH = 8;

/** «٨ أحرف على الأقل» — the same phrase in the hint and in the error. */
export const minPasswordLabel = `${arabicNumber(MIN_PASSWORD_LENGTH)} أحرف على الأقل`;

/**
 * What is wrong with this password, or null if nothing is.
 *
 * Pass `confirm` on the screens that ask twice. Order matters: telling
 * somebody their passwords do not match is useless when the one they typed
 * was never going to be accepted anyway.
 */
export function passwordProblem(password: string, confirm?: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `كلمة المرور يجب أن تكون ${minPasswordLabel}.`;
  }
  if (confirm !== undefined && password !== confirm) {
    return 'كلمتا المرور غير متطابقتين.';
  }
  return null;
}
