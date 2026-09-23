import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The owner manual booking path, guarded at the source.
 *
 * Every other financial rule in this app is enforced by a database constraint
 * or a unit test over a pure function. This one cannot be: the defect was an
 * ABSENCE — a booking that reached `bookings` without ever reaching
 * `booking_financials` — and the fix is likewise structural. What keeps it
 * fixed is that there is no longer a way to express a price on this path: no
 * parameter on the RPC, no field on the intent type, no input on the form, and
 * no client-side insert helper left to call.
 *
 * Absences are exactly what a refactor reintroduces by accident, so they are
 * asserted here rather than left to code review.
 */

const root = process.cwd();
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');

const MIGRATION = read('supabase', 'migrations', '0170_booking_on_behalf.sql');
const TYPES = read('src', 'types.ts');
const DB = read('src', 'lib', 'db.ts');
const SHELL = read('src', 'components', 'owner', 'OwnerDashboardShell.tsx');
const APP = read('src', 'App.tsx');

/** Words that only ever appear on a financial input. */
const FINANCIAL = ['price', 'deposit', 'commission', 'markup', 'net_rate', 'netRate', 'entitlement', 'hold'];

describe('the on-behalf RPC accepts no financial input', () => {
  // The signature is the only surface a client can reach, so it is the only
  // place worth checking. A validated-and-rejected parameter would still be a
  // parameter somebody could later decide to trust.
  const signature = (() => {
    const start = MIGRATION.indexOf('CREATE OR REPLACE FUNCTION public.create_booking_on_behalf_with_financials(');
    expect(start).toBeGreaterThan(-1);
    return MIGRATION.slice(start, MIGRATION.indexOf(')', MIGRATION.indexOf('p_override_reason', start)));
  })();

  it.each(FINANCIAL)('has no parameter mentioning %s', (word) => {
    const params = signature.split('\n').filter((l) => /^\s*p_/.test(l));
    expect(params.length).toBeGreaterThan(10);
    expect(params.some((l) => l.toLowerCase().includes(word.toLowerCase()))).toBe(false);
  });

  it('takes the guest explicitly and the actor from nowhere', () => {
    expect(signature).toContain('p_guest_name');
    expect(signature).toContain('p_guest_user_id');
    // There must be no p_owner_id / p_actor / p_created_by: an identity that
    // arrives as a parameter is an identity a caller can claim.
    expect(signature).not.toMatch(/p_(owner_id|actor|created_by|acting)/);
  });

  it('derives the acting identity from auth.uid()', () => {
    expect(MIGRATION).toMatch(/v_actor\s+UUID\s*:=\s*auth\.uid\(\)/);
  });
});

describe('the on-behalf RPC reuses the shared pricing core', () => {
  it('calls fin_price_booking rather than restating a formula', () => {
    expect(MIGRATION).toContain('public.fin_price_booking(');
  });

  it('never computes retail, entitlement or a deposit itself', () => {
    // Stripped of comments, the function body must contain no model arithmetic.
    const body = MIGRATION
      .slice(MIGRATION.indexOf('CREATE OR REPLACE FUNCTION public.create_booking_on_behalf_with_financials'))
      .replace(/--[^\n]*/g, '');
    expect(body).not.toMatch(/1\s*\+\s*\w*markup/i);
    expect(body).not.toMatch(/1\s*-\s*\w*commission_rate/i);
    expect(body).not.toMatch(/GREATEST\s*\(\s*ROUND/i);
  });

  it('writes the snapshot and the settlement hold in the same transaction', () => {
    expect(MIGRATION).toContain('INSERT INTO public.booking_financials');
    expect(MIGRATION).toContain('INSERT INTO public.settlement_holds');
    // No exception handler wraps them: a failure must take the booking with it.
    expect(MIGRATION).not.toContain('WHEN OTHERS THEN');
  });

  it('lets NO_AGREEMENT out rather than falling back to a legacy commission', () => {
    expect(MIGRATION).not.toMatch(/EXCEPTION[\s\S]{0,200}NO_AGREEMENT/);
    expect(MIGRATION).not.toContain('platform_settings');
  });
});

describe('owner authorisation', () => {
  it('checks the HOUSE, not only the role', () => {
    expect(MIGRATION).toContain('h.owner_id = v_actor');
    expect(MIGRATION).toContain('NOT_AUTHORIZED_FOR_HOUSE');
  });

  it('does not let an admin flag alone stand in for house ownership', () => {
    // is_admin is an OR with the ownership check, never a replacement for it.
    expect(MIGRATION).toMatch(/NOT \(v_admin OR v_owns\)/);
  });

  it('keeps the margin-floor override an administrator decision', () => {
    expect(MIGRATION).toContain('OVERRIDE_REQUIRED');
    expect(MIGRATION).toContain('IF NOT v_admin THEN');
    expect(MIGRATION).toContain('OVERRIDE_REASON_REQUIRED');
  });

  it('is a definer function with a pinned search_path, granted to authenticated only', () => {
    expect(MIGRATION).toContain('SECURITY DEFINER');
    expect(MIGRATION).toContain('SET search_path = public, pg_temp');
    expect(MIGRATION).toMatch(/REVOKE ALL ON FUNCTION public\.create_booking_on_behalf_with_financials/);
    expect(MIGRATION).toMatch(/GRANT EXECUTE ON FUNCTION public\.create_booking_on_behalf_with_financials[\s\S]*?TO authenticated/);
  });
});

describe('identity is recorded twice, because it is two things', () => {
  it('adds created_by and stamps it on every insert path', () => {
    expect(MIGRATION).toContain('ADD COLUMN IF NOT EXISTS created_by');
    expect(MIGRATION).toContain('bookings_stamp_created_by');
    expect(MIGRATION).toContain('COALESCE(NEW.created_by, auth.uid())');
  });

  it('never marks an owner-recorded booking as paid', () => {
    expect(MIGRATION).toMatch(/'unpaid', FALSE/);
  });

  it('will not let a manual booking pose as a platform booking', () => {
    expect(MIGRATION).toContain('INVALID_SOURCE');
    expect(MIGRATION).toMatch(/NOT IN \('manual', 'temporary'\)/);
  });
});

describe('OwnerBookingIntent — what the owner UI is allowed to submit', () => {
  const block = (() => {
    const start = TYPES.indexOf('export interface OwnerBookingIntent {');
    expect(start).toBeGreaterThan(-1);
    return TYPES.slice(start, TYPES.indexOf('\n}', start));
  })();

  it.each(FINANCIAL)('carries no %s field', (word) => {
    const fields = block.split('\n').filter((l) => /^\s{2}\w+\??:/.test(l));
    expect(fields.length).toBeGreaterThan(5);
    expect(fields.some((l) => l.toLowerCase().includes(word.toLowerCase()))).toBe(false);
  });

  it('carries the guest identity and an idempotency key', () => {
    expect(block).toContain('guestName');
    expect(block).toContain('idempotencyKey');
    expect(block).toContain('bookingId');
  });
});

describe('no client-side booking insert survives', () => {
  it('has no direct insert into bookings anywhere in src', () => {
    expect(DB).not.toContain("from('bookings').insert");
    expect(DB).not.toContain('function bookingToRow');
  });

  it('routes the owner form through the on-behalf RPC', () => {
    expect(DB).toContain("supabase.rpc('create_booking_on_behalf_with_financials'");
    expect(APP).toContain('createBookingOnBehalf(intent)');
  });

  it('sends no price, deposit or commission in the RPC call', () => {
    const call = DB.slice(
      DB.indexOf("supabase.rpc('create_booking_on_behalf_with_financials'"),
      DB.indexOf('});', DB.indexOf("supabase.rpc('create_booking_on_behalf_with_financials'")),
    );
    for (const word of FINANCIAL) {
      expect(call.toLowerCase()).not.toContain(word.toLowerCase());
    }
  });
});

describe('the owner form', () => {
  it('no longer has a price input', () => {
    expect(SHELL).not.toContain('mbPrice');
    expect(SHELL).not.toContain('id="mb-price"');
  });

  it('shows the server quote instead, and reuses one key per attempt', () => {
    expect(SHELL).toContain('loadBookingQuote(');
    expect(SHELL).toContain('mbAttemptRef');
    expect(SHELL).toContain('newIdempotencyKey()');
    // The key is cleared only on success, so a failure retries rather than
    // creating a second booking.
    expect(SHELL).toMatch(/if \(ok\) \{[\s\S]{0,120}mbAttemptRef\.current = null;/);
  });
});
