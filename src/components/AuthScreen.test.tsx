/**
 * Priority 8 — AuthScreen safety net.
 *
 * AuthScreen is the only door into the product. It is 975 lines but takes a
 * single optional prop, and it talks to exactly five Supabase methods:
 *   auth.signInWithPassword, auth.signUp, auth.resetPasswordForEmail,
 *   auth.resend, auth.signInWithOAuth
 * — so the mock below is those five and nothing more. There is no logout here:
 * signing out is owned by App/WebLayout, not this component, and a test for it
 * would be testing behaviour that does not exist.
 *
 * The contracts pinned here are the component's own, not the library's:
 *   - account-enumeration resistance on a bad credential (AuthScreen.tsx:283)
 *   - the empty-field short circuit that must not reach the network
 *   - the in-flight lock that stops a double submission
 *   - the rate-limit cooldown
 *   - email normalisation before it reaches Supabase
 *
 * NOT retested here: authErrorMessage/retryInLabel (src/lib/authErrors.test.ts)
 * and passwordProblem/MIN_PASSWORD_LENGTH (src/lib/password.test.ts) already
 * have their own suites.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AuthScreen from './AuthScreen';

const signInWithPassword = vi.fn();
const signUp = vi.fn();
const resetPasswordForEmail = vi.fn();
const resend = vi.fn();
const signInWithOAuth = vi.fn();

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: (...a: unknown[]) => signInWithPassword(...a),
      signUp: (...a: unknown[]) => signUp(...a),
      resetPasswordForEmail: (...a: unknown[]) => resetPasswordForEmail(...a),
      resend: (...a: unknown[]) => resend(...a),
      signInWithOAuth: (...a: unknown[]) => signInWithOAuth(...a),
    },
  },
}));

// Native-only paths; the web branch is what jsdom exercises.
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false } }));
vi.mock('@capacitor/browser', () => ({ Browser: { open: vi.fn() } }));

const EMAIL = 'البريد الإلكتروني';
const PASSWORD = 'كلمة المرور';

const emailField = () => screen.getByPlaceholderText(EMAIL);
const passwordField = () => screen.getByPlaceholderText(PASSWORD);
const submit = () => emailField().closest('form')!;

const fillAndSubmit = (email = 'Owner@Pima.EG ', password = 'correct-horse') => {
  fireEvent.change(emailField(), { target: { value: email } });
  fireEvent.change(passwordField(), { target: { value: password } });
  fireEvent.submit(submit());
};

beforeEach(() => {
  signInWithPassword.mockReset().mockResolvedValue({ error: null });
  signUp.mockReset().mockResolvedValue({ data: {}, error: null });
  resetPasswordForEmail.mockReset().mockResolvedValue({ error: null });
  resend.mockReset().mockResolvedValue({ error: null });
  signInWithOAuth.mockReset().mockResolvedValue({ data: {}, error: null });
});

describe('AuthScreen — signing in', () => {
  it('opens on the sign-in form', () => {
    render(<AuthScreen />);
    expect(emailField()).toBeInTheDocument();
    expect(passwordField()).toBeInTheDocument();
  });

  it('signs in through Supabase with the typed credentials', async () => {
    render(<AuthScreen />);
    fillAndSubmit('owner@pima.eg', 'correct-horse');
    await waitFor(() => expect(signInWithPassword).toHaveBeenCalledTimes(1));
    expect(signInWithPassword.mock.calls[0][0].password).toBe('correct-horse');
  });

  it('normalises the address before it reaches Supabase', async () => {
    // Trailing space + capitals would otherwise create a second account that
    // looks identical to the person typing it.
    render(<AuthScreen />);
    fillAndSubmit('  Owner@Pima.EG  ', 'correct-horse');
    await waitFor(() => expect(signInWithPassword).toHaveBeenCalled());
    expect(signInWithPassword.mock.calls[0][0].email).toBe('owner@pima.eg');
  });

  it('does not reach the network when either field is empty', async () => {
    render(<AuthScreen />);
    fireEvent.change(emailField(), { target: { value: 'owner@pima.eg' } });
    fireEvent.submit(submit());
    expect(signInWithPassword).not.toHaveBeenCalled();

    fireEvent.change(emailField(), { target: { value: '' } });
    fireEvent.change(passwordField(), { target: { value: 'correct-horse' } });
    fireEvent.submit(submit());
    expect(signInWithPassword).not.toHaveBeenCalled();
  });
});

describe('AuthScreen — a failed sign-in must not enumerate accounts', () => {
  // AuthScreen.tsx:283 — anything matching /credential|password|email/i is
  // collapsed into one message. Saying "no account with that address" tells
  // someone working through a list which addresses are real.
  const badCredential = { message: 'Invalid login credentials', status: 400 };

  it('gives one vague message for a wrong password', async () => {
    render(<AuthScreen />);
    signInWithPassword.mockResolvedValue({ error: badCredential });
    fillAndSubmit();
    expect(await screen.findByText('البريد الإلكتروني أو كلمة المرور غير صحيحة.')).toBeInTheDocument();
  });

  it('gives the SAME message for an address that does not exist', async () => {
    render(<AuthScreen />);
    signInWithPassword.mockResolvedValue({ error: { message: 'Email not confirmed or user not found', status: 400 } });
    fillAndSubmit();
    expect(await screen.findByText('البريد الإلكتروني أو كلمة المرور غير صحيحة.')).toBeInTheDocument();
  });

  it('never tells the visitor which half was wrong', async () => {
    const { container } = render(<AuthScreen />);
    signInWithPassword.mockResolvedValue({ error: badCredential });
    fillAndSubmit();
    await screen.findByText('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
    // No "this account does not exist" / "wrong password" phrasing anywhere.
    expect(container.textContent).not.toMatch(/غير مسجل|غير موجود|لا يوجد حساب|كلمة المرور خاطئة/);
  });

  it('does not swallow a non-credential failure into the vague message', async () => {
    // A network or server fault must say what it is — collapsing everything
    // into "wrong password" would send people to reset a password that works.
    const { container } = render(<AuthScreen />);
    signInWithPassword.mockResolvedValue({ error: { message: 'Network request failed', status: 500 } });
    fillAndSubmit();
    await waitFor(() => expect(signInWithPassword).toHaveBeenCalled());
    await waitFor(() =>
      expect(container.textContent).not.toContain('البريد الإلكتروني أو كلمة المرور غير صحيحة.'));
  });
});

describe('AuthScreen — one submission at a time', () => {
  // How this screen actually prevents a double submission: the submit button
  // carries disabled={loading || cooldown > 0}. That is the whole guard —
  // handleSignInSubmit has no `if (loading) return` of its own.
  //
  // It is sufficient for a real visitor. A disabled default button blocks the
  // click AND blocks Enter-key implicit submission, because the HTML spec stops
  // implicit submission when the form's default button is disabled. So the
  // probe below is a click on the live button, not fireEvent.submit(form) —
  // submitting the form object directly is a synthetic event no browser
  // produces from a disabled control, and asserting against it would be
  // reporting a defect that cannot happen.
  it('locks the submit control while the request is in flight', async () => {
    let release!: (v: unknown) => void;
    signInWithPassword.mockReturnValue(new Promise((r) => { release = r; }));
    render(<AuthScreen />);
    fillAndSubmit();

    await waitFor(() => expect(signInWithPassword).toHaveBeenCalledTimes(1));
    const button = submit().querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    // A second attempt while the first is open must not reach Supabase.
    fireEvent.click(button);
    expect(signInWithPassword).toHaveBeenCalledTimes(1);

    release({ error: null });
    await waitFor(() => expect(button.disabled).toBe(false));
  });

  it('releases the lock after a failure so the visitor can try again', async () => {
    render(<AuthScreen />);
    signInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials', status: 400 } });
    fillAndSubmit();
    await screen.findByText('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
    const button = submit().querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(button.disabled).toBe(false);
  });
});

describe('AuthScreen — rate limiting', () => {
  it('holds the visitor off when Supabase asks for a wait', async () => {
    render(<AuthScreen />);
    signInWithPassword.mockResolvedValue({
      error: { message: 'For security purposes, you can only request this after 46 seconds.', status: 429 },
    });
    fillAndSubmit();
    await waitFor(() => {
      const button = submit().querySelector('button[type="submit"]') as HTMLButtonElement;
      expect(button.disabled).toBe(true);
    });
  });
});

describe('AuthScreen — the guest escape hatch', () => {
  it('offers a way back to browsing when the parent supplied one', () => {
    const onBackToBrowse = vi.fn();
    render(<AuthScreen onBackToBrowse={onBackToBrowse} />);
    const back = screen.getByText(/تصفح|زائر/);
    fireEvent.click(back.closest('button') ?? back);
    expect(onBackToBrowse).toHaveBeenCalled();
  });

  it('does not offer it when there is nowhere to go back to', () => {
    const { container } = render(<AuthScreen />);
    expect(container.textContent).not.toMatch(/تصفح البيوت كزائر/);
  });
});
