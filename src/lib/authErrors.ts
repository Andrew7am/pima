import { arabicNumber } from './arabic';

/**
 * Supabase Auth speaks English. Pima does not.
 *
 * The sign-up form used to hand `error.message` straight to the screen, so an
 * Arabic page told people «For security purposes, you can only request this
 * after 42 seconds.» — and the bidi algorithm moved the full stop to the front
 * of the line for good measure. Worse than the language: it reads as a fault,
 * when it is a timer.
 *
 * Anything not recognised here becomes one honest Arabic sentence rather than
 * whatever English the server happened to send.
 */
export interface AuthErrorInfo {
  message: string;
  /** Seconds the server says to wait, when it said so. Drives the countdown. */
  retryAfterSec?: number;
}

interface RawAuthError {
  message?: string;
  code?: string;
  status?: number;
}

/** «... after 42 seconds» — the number is the whole point of the message. */
const AFTER_SECONDS = /after (\d+) seconds?/i;

// Matched on a lowercased message, in order — first hit wins. Substrings
// rather than equality: Supabase has reworded several of these across
// versions, and a message that no longer matches exactly should still not
// fall through to English.
const RULES: { when: (m: string, e: RawAuthError) => boolean; say: string }[] = [
  {
    when: (m) => m.includes('user already registered') || m.includes('already been registered'),
    say: 'البريد الإلكتروني مسجل بالفعل. سجّل الدخول بدلاً من إنشاء حساب.',
  },
  {
    when: (m) => m.includes('invalid login credentials'),
    say: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
  },
  {
    when: (m) => m.includes('email not confirmed'),
    say: 'لم يتم تفعيل البريد الإلكتروني بعد. افتح رسالة التفعيل المرسلة إليك.',
  },
  {
    when: (m) => m.includes('email rate limit') || m.includes('over_email_send_rate_limit'),
    say: 'أرسلنا رسائل كثيرة لهذا البريد خلال وقت قصير. انتظر قليلاً ثم حاول مرة أخرى.',
  },
  {
    when: (m, e) => m.includes('rate limit') || e.status === 429,
    say: 'حاولت أكثر من اللازم خلال وقت قصير. انتظر قليلاً ثم حاول مرة أخرى.',
  },
  {
    when: (m) => m.includes('unable to validate email') || m.includes('invalid format'),
    say: 'صيغة البريد الإلكتروني غير صحيحة.',
  },
  {
    when: (m) => m.includes('password should be at least'),
    say: 'كلمة المرور يجب أن تكون ٦ أحرف على الأقل.',
  },
  {
    when: (m) => m.includes('weak password') || m.includes('password is too weak'),
    say: 'كلمة المرور ضعيفة. اختر كلمة أطول تجمع بين حروف وأرقام.',
  },
  {
    when: (m) => m.includes('signup') && m.includes('disabled'),
    say: 'التسجيل مغلق مؤقتاً. حاول لاحقاً أو تواصل مع الدعم.',
  },
  {
    when: (m) => m.includes('failed to fetch') || m.includes('network'),
    say: 'تعذر الاتصال بالخادم. تأكد من اتصالك بالإنترنت وحاول مرة أخرى.',
  },
];

export function authErrorMessage(error: unknown): AuthErrorInfo {
  const e = (error ?? {}) as RawAuthError;
  const raw = typeof e.message === 'string' ? e.message : '';
  const m = raw.toLowerCase();

  // The timed lockout comes first: it is the only message carrying a number
  // the person needs, and its wording is what put English on an Arabic page.
  const after = raw.match(AFTER_SECONDS);
  if (after) {
    const sec = parseInt(after[1], 10);
    return {
      message: `لأسباب أمنية، يمكنك المحاولة مرة أخرى بعد ${arabicNumber(sec)} ثانية.`,
      retryAfterSec: sec,
    };
  }

  for (const rule of RULES) {
    if (rule.when(m, e)) return { message: rule.say };
  }

  return { message: 'حدث خطأ غير متوقع. حاول مرة أخرى.' };
}

/** «... بعد ٤٢ ثانية» for the live countdown on a disabled button. */
export const retryInLabel = (sec: number) =>
  `حاول بعد ${arabicNumber(sec)} ${sec === 1 ? 'ثانية' : sec === 2 ? 'ثانيتين' : sec <= 10 ? 'ثوانٍ' : 'ثانية'}`;
