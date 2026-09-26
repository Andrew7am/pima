/**
 * Phase 6 / migration 0173, executed — not read.
 *
 * A real Postgres (PGlite) is built from supabase/tests/phase6_production_fixture.sql,
 * which is the production schema as it stood before 0172, copied read-only.
 * The first test proves that copy is exact: the body of every production
 * function in it is hashed and compared with the hash production reported.
 * Then the real 0172 and 0173 migration files are executed against it, and
 * every rule is exercised through the same roles, RLS policies and triggers
 * production uses. Nothing here touches production.
 *
 * What PGlite cannot do: run two sessions at once. Concurrency is therefore
 * covered by the locking design (section notes below) and by replay tests, not
 * by interleaved transactions — the report says so.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const FIXTURE = join(ROOT, 'supabase', 'tests', 'phase6_production_fixture.sql');
const M0172 = join(ROOT, 'supabase', 'migrations', '0172_phase6_payout_prerequisites.sql');
const M0173 = join(ROOT, 'supabase', 'migrations', '0173_phase6_payment_payout_refund_ledger.sql');

/** md5(replace(prosrc, E'\r', '')) as production reported it on 2026-09-25. */
const PRODUCTION_MD5: Record<string, string> = {
  is_admin: 'cfdc2f8dcd4cf9e1120bf2f6047d6fce',
  is_active: 'd7cae4493fc1213a95aeb4f393c49d3b',
  fin_append_only: '1d5a3d08a76f73c1dd89c4b454fc38be',
  fin_assert_balanced: 'fe7987b8bb79149000fb6766423bec5e',
  fin_assert_reversal_scope: 'bcd3f60ccf276268f0a9fd56b8010fec',
  fin_transfer_fee: '3a1be5655a6ae8a2d5d835be47468ab5',
  booking_financials_immutable: '025d5fcea1943f6432b0223c4515f40e',
  settlement_holds_populate: '0a3c3863b5393665a44b8ab6388e576a',
  settlement_holds_guard: '9d5a9b2dfc50a466cd4ef22741bc992d',
  payout_bookings_append_only: '49c60d7a12b8f9e842098dd1a91350c6',
  payout_bookings_validate: '603171cfe623890bd9a2a83d98cca7ee',
  owner_receivables_validate: '636ae97935eae964ad7c128214d89c3d',
  owner_receivables_guard: '179104e643bad1bd647d0087fc77fa98',
  owner_receivable_recoveries_validate: 'bcfe412c8b0c55fa0997eea34f46e2ae',
  owner_receivable_recoveries_append_only: '61f4a96774e1017ac2a0e96bdc459608',
  owner_receivables_restate: '517ffd49ccf52151a1901d9008c45ea5',
  protect_payment_write: '5a38c995cb85a49ba36ac096f1b02aec',
  stamp_payment_review: '3711f8bd749fabfb1da3c41341e11405',
  record_refund: 'dc75fa11211f43af4ece1c189c80922d',
  protect_booking_privileged_columns: '4c0985c743896b1a86556edca6a7b5bd',
  audit_payout_status_change: '90f6f2828dfa2138e93edaaf802dda24',
  notify_owner_on_payout_update: 'c423623a27cfa283faa8173b73851925',
  record_cash_deposit: '8d1c88d8f9fe2033be38867dc388d36e',
};

const ADMIN = '00000000-0000-4000-8000-000000000001';
const OWNER = '00000000-0000-4000-8000-000000000002';
const OWNER2 = '00000000-0000-4000-8000-000000000003';
const GUEST = '00000000-0000-4000-8000-000000000004';
const GUEST2 = '00000000-0000-4000-8000-000000000005';
const AGREEMENT = '00000000-0000-4000-8000-0000000000a1';

let db: PGlite;
let fixtureMd5: Record<string, string> = {};

type Row = Record<string, unknown>;
const q = async (sql: string, params: unknown[] = []): Promise<Row[]> =>
  (await db.query<Row>(sql, params)).rows;
const one = async (sql: string, params: unknown[] = []): Promise<Row> => (await q(sql, params))[0];
const num = (v: unknown) => Number(v);

/** Run as a client role with a JWT subject, exactly as PostgREST would. */
async function as<T>(uid: string | null, fn: () => Promise<T>, role: 'authenticated' | 'anon' = 'authenticated'): Promise<T> {
  await db.exec(`SET ROLE ${role}`);
  await db.query(`SELECT set_config('request.jwt.claims', $1, false)`, [uid ? JSON.stringify({ sub: uid }) : '']);
  try {
    return await fn();
  } finally {
    await db.exec('RESET ROLE');
    await db.query(`SELECT set_config('request.jwt.claims', '', false)`);
  }
}
const asAdmin = <T>(fn: () => Promise<T>) => as(ADMIN, fn);
const rpc = async (call: string, params: unknown[] = []) =>
  (await one(`SELECT ${call} AS r`, params)).r as Record<string, unknown>;

// ── fixture builders (as the table owner, the way the booking RPC writes) ──
let seq = 0;
interface BookingOpts {
  retail?: number; rate?: number; promo?: number; points?: number;
  checkInDays?: number; releaseDays?: number; owner?: string; house?: string;
  guest?: string; currency?: string; status?: string;
  freeDays?: number; partialDays?: number; partialPct?: number;
  /** Count checkInDays from today's Cairo calendar date — the calendar the refund
   *  measures the cancellation on — instead of the session's CURRENT_DATE, which
   *  is a day behind Cairo for part of every evening. */
  checkInFromCairoDate?: boolean;
}
async function mkBooking(o: BookingOpts = {}): Promise<string> {
  const id = `bk_${++seq}`;
  const checkIn = o.checkInDays ?? 60;
  const release = o.releaseDays ?? checkIn - 7;
  const guest = o.guest ?? GUEST;
  const today = o.checkInFromCairoDate ? `(now() AT TIME ZONE 'Africa/Cairo')::date` : 'CURRENT_DATE';
  await q(
    `INSERT INTO bookings (id, house_id, user_id, status, check_in, check_out)
     VALUES ($1, $2, $3, $4, ${today} + $5::int, ${today} + $5::int + 2)`,
    [id, o.house ?? 'h1', guest, o.status ?? 'approved', checkIn],
  );
  await q(
    `INSERT INTO booking_financials
       (booking_id, house_id, owner_id, agreement_id, model_type, currency, pricing_basis, pricing_quantity,
        commission_rate, retail_price, promo_discount, points_discount, points_redeemed, owner_entitlement,
        deposit_rate, min_margin_rate, assumed_transfer_fee, policy_free_cancel_days, policy_partial_refund_days,
        policy_partial_refund_pct, policy_source, owner_cash_release_date, override_by, override_reason, override_at)
     VALUES ($1, $2, $3, $4, 'COMMISSION', $5, 'PER_NIGHT_PER_PERSON', 1,
             $6::numeric, $7::numeric, $8::numeric, $9::numeric, $10::int, round($7::numeric * (1 - $6::numeric), 2),
             0.3, 0.02, 9.40, $11::int, $12::int, $13::numeric, 'platform', CURRENT_DATE + $14::int, $15, 'fixture', now())`,
    [id, o.house ?? 'h1', o.owner ?? OWNER, AGREEMENT, o.currency ?? 'EGP', o.rate ?? 0.06, o.retail ?? 10000,
      o.promo ?? 0, o.points ?? 0, (o.points ?? 0) > 0 ? Math.round((o.points ?? 0) * 100) : 0,
      o.freeDays ?? 21, o.partialDays ?? 7, o.partialPct ?? 0.5, release, ADMIN],
  );
  await q(`INSERT INTO settlement_holds (booking_id) VALUES ($1)`, [id]);
  if ((o.points ?? 0) > 0) {
    // The booking RPC's own redemption entry (0166:688-705), verbatim legs.
    await db.transaction(async (tx) => {
      const t = (await tx.query<Row>(
        `INSERT INTO fin_transactions (txn_type, booking_id, house_id, owner_id, currency, reference_type,
           reference_id, idempotency_key, memo)
         VALUES ('points_redemption_cost', $1, $2, $3, $4, 'booking', $1, 'pts:redeem:' || $1, 'points redeemed')
         RETURNING id`, [id, o.house ?? 'h1', o.owner ?? OWNER, o.currency ?? 'EGP'])).rows[0].id;
      await tx.query(
        `INSERT INTO fin_transaction_legs (txn_id, account, amount, party_id) VALUES
           ($1, 'POINTS_LIABILITY', $2::numeric, $3), ($1, 'PIMA_POINTS_EXPENSE', $2::numeric, NULL),
           ($1, 'PIMA_LOYALTY_EXPENSE', -$2::numeric, NULL), ($1, 'POINTS_APPLIED', -$2::numeric, $3)`,
        [t, o.points, guest]);
    });
  }
  return id;
}

async function mkPayment(bookingId: string, amount: number, method = 'instapay', payer = GUEST): Promise<string> {
  const id = `pay_${++seq}`;
  await q(
    `INSERT INTO payments (id, booking_id, user_id, amount, payment_method, payment_status)
     VALUES ($1, $2, $3, $4, $5, 'pending')`, [id, bookingId, payer, amount, method]);
  return id;
}
const approve = (paymentId: string) =>
  asAdmin(() => q(`UPDATE payments SET payment_status = 'approved' WHERE id = $1`, [paymentId]));
async function paid(bookingId: string, amount: number): Promise<string> {
  const p = await mkPayment(bookingId, amount);
  await approve(p);
  return p;
}
const cancelAsGuest = (bookingId: string, guest = GUEST) =>
  as(guest, () => q(`UPDATE bookings SET status = 'cancelled' WHERE id = $1`, [bookingId]));
const payout = (ids: string[], expected: number, key: string, deduct = false) =>
  asAdmin(() => rpc(`public.fin_create_owner_payout($1::text[], $2, 'REF-' || $3, 'CIB · 1234', $3, NULL, $4)`,
    [ids, expected, key, deduct]));
const refund = (paymentId: string, amount: number | null, key: string, paidNow = true) =>
  asAdmin(() => rpc(`public.fin_post_refund($1, $2, $3, $4)`, [paymentId, amount, key, paidNow]));

/** Legs of one keyed transaction, as { account: amount }. */
async function legs(key: string): Promise<Record<string, number>> {
  const rows = await q(
    `SELECT g.account, g.amount FROM fin_transactions t JOIN fin_transaction_legs g ON g.txn_id = t.id
      WHERE t.idempotency_key = $1`, [key]);
  return Object.fromEntries(rows.map((r) => [r.account as string, num(r.amount)]));
}
/** Balance of an account over every transaction scoped to a booking. */
async function bal(bookingId: string, account: string): Promise<number> {
  return num((await one(
    `SELECT COALESCE(SUM(g.amount), 0) AS s FROM fin_transactions t JOIN fin_transaction_legs g ON g.txn_id = t.id
      WHERE t.booking_id = $1 AND g.account = $2`, [bookingId, account])).s);
}
const position = (bookingId: string) => one(`SELECT * FROM fin_booking_position($1)`, [bookingId]);
const count = async (sql: string, params: unknown[] = []) => num((await one(sql, params)).n);

beforeAll(async () => {
  db = await PGlite.create();
  await db.exec(readFileSync(FIXTURE, 'utf8'));

  const rows = await q(
    `SELECT proname, md5(replace(prosrc, E'\\r', '')) AS m FROM pg_proc
      WHERE pronamespace = 'public'::regnamespace AND proname = ANY($1)`, [Object.keys(PRODUCTION_MD5)]);
  fixtureMd5 = Object.fromEntries(rows.map((r) => [r.proname as string, r.m as string]));

  await q(`INSERT INTO users (id, name, role) VALUES ($1,'admin','admin'), ($2,'owner','owner'),
           ($3,'owner2','owner'), ($4,'guest','user'), ($5,'guest2','user')`, [ADMIN, OWNER, OWNER2, GUEST, GUEST2]);
  await q(`INSERT INTO houses (id, owner_id, name) VALUES ('h1',$1,'house 1'), ('h1b',$1,'house 1b'), ('h2',$2,'house 2')`,
    [OWNER, OWNER2]);
  await q(`INSERT INTO house_agreements (id) VALUES ($1)`, [AGREEMENT]);

  await db.exec(readFileSync(M0172, 'utf8'));
  await db.exec(readFileSync(M0173, 'utf8'));
}, 60_000);

describe('the fixture is production', () => {
  it('every copied function body hashes to the production value', () => {
    expect(fixtureMd5).toEqual(PRODUCTION_MD5);
  });
});

describe('0173 applies and verifies itself', () => {
  it('ran its own 46-check verification block (exec would have thrown otherwise) and is re-runnable', async () => {
    await db.exec(readFileSync(M0173, 'utf8'));   // second run: idempotent
    expect(await count(`SELECT count(*) AS n FROM pg_proc WHERE proname = 'fin_post_refund'`)).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('payment posting', () => {
  it('1. full 30% deposit: cash in, owner share payable, PIMA share revenue', async () => {
    const b = await mkBooking();
    const p = await paid(b, 3000);
    expect(await legs(`pay:recv:${p}`)).toEqual({ PIMA_CASH: 3000, OWNER_PAYABLE: -2400, PIMA_REVENUE: -600 });
    const party = await one(`SELECT g.party_id FROM fin_transactions t JOIN fin_transaction_legs g ON g.txn_id=t.id
      WHERE t.idempotency_key=$1 AND g.account='OWNER_PAYABLE'`, [`pay:recv:${p}`]);
    expect(party.party_id).toBe(OWNER);
    const h = await one(`SELECT hold_amount FROM settlement_holds WHERE booking_id=$1`, [b]);
    expect(num(h.hold_amount)).toBe(2400);
  });

  it('2. partial payment: owner allocation is proportional', async () => {
    const b = await mkBooking();
    const p = await paid(b, 1000);
    expect(await legs(`pay:recv:${p}`)).toEqual({ PIMA_CASH: 1000, OWNER_PAYABLE: -800, PIMA_REVENUE: -200 });
  });

  it('3. multiple partial payments land exactly on the owner share, rounding absorbed by PIMA_REVENUE', async () => {
    const b = await mkBooking({ promo: 300 });   // D 2910, H 2610: shares that do not divide evenly
    const p1 = await paid(b, 1000);
    expect(await legs(`pay:recv:${p1}`)).toEqual({ PIMA_CASH: 1000, PIMA_PROMO_EXPENSE: 103.09, OWNER_PAYABLE: -896.91, PIMA_REVENUE: -206.18 });
    await paid(b, 1000);
    await paid(b, 910);
    expect(await bal(b, 'OWNER_PAYABLE')).toBe(-2610);
    expect(await bal(b, 'PIMA_PROMO_EXPENSE')).toBe(300);
    expect(await bal(b, 'PIMA_CASH')).toBe(2910);
    expect(await bal(b, 'PIMA_REVENUE')).toBe(-600);   // = gross margin, exactly
  });

  it('4. duplicate posting returns the existing entry', async () => {
    const b = await mkBooking();
    const p = await paid(b, 3000);
    const before = await count(`SELECT count(*) AS n FROM fin_transactions`);
    const r = await asAdmin(() => rpc(`public.fin_post_payment_received($1)`, [p]));
    expect(r.status).toBe('ALREADY_POSTED');
    await approve(p);   // approved -> approved: no second posting
    expect(await count(`SELECT count(*) AS n FROM fin_transactions`)).toBe(before);
  });

  it('5. amount mismatch: more than the deposit, or a payer who is not the booking customer, is refused', async () => {
    const b = await mkBooking();
    await paid(b, 2000);
    const p2 = await mkPayment(b, 1500);
    await expect(approve(p2)).rejects.toThrow(/PAYMENT_EXCEEDS_DEPOSIT/);
    expect((await one(`SELECT payment_status FROM payments WHERE id=$1`, [p2])).payment_status).toBe('pending');
    const p3 = await mkPayment(b, 500, 'instapay', GUEST2);
    await expect(approve(p3)).rejects.toThrow(/PAYMENT_USER_MISMATCH/);
  });

  it('6. an unapproved payment cannot be posted', async () => {
    const b = await mkBooking();
    const p = await mkPayment(b, 3000);
    await expect(asAdmin(() => rpc(`public.fin_post_payment_received($1)`, [p]))).rejects.toThrow(/PAYMENT_NOT_APPROVED/);
  });

  it('7. a payment on a cancelled booking cannot be approved', async () => {
    const b = await mkBooking();
    const p = await mkPayment(b, 3000);
    await cancelAsGuest(b);
    await expect(approve(p)).rejects.toThrow(/PAYMENT_BOOKING_NOT_ACTIVE/);
  });

  it('8. promotion: PIMA_PROMO_EXPENSE is recognised with the payment', async () => {
    const b = await mkBooking({ promo: 300 });
    const p = await paid(b, 2910);
    expect(await legs(`pay:recv:${p}`)).toEqual({ PIMA_CASH: 2910, PIMA_PROMO_EXPENSE: 300, OWNER_PAYABLE: -2610, PIMA_REVENUE: -600 });
  });

  it('9. points: POINTS_APPLIED is debited against the redemption entry and nets to zero', async () => {
    const b = await mkBooking({ points: 200 });   // F 9800, D 2940, H 2540
    expect(await bal(b, 'POINTS_APPLIED')).toBe(-200);   // credited at booking
    await paid(b, 1470);
    expect(await bal(b, 'POINTS_APPLIED')).toBe(-100);
    const p2 = await paid(b, 1470);
    expect(await legs(`pay:recv:${p2}`)).toEqual({ PIMA_CASH: 1470, POINTS_APPLIED: 100, OWNER_PAYABLE: -1270, PIMA_REVENUE: -300 });
    expect(await bal(b, 'POINTS_APPLIED')).toBe(0);
    const party = await q(`SELECT DISTINCT g.party_id FROM fin_transactions t JOIN fin_transaction_legs g ON g.txn_id=t.id
      WHERE t.booking_id=$1 AND g.account='POINTS_APPLIED'`, [b]);
    expect(party.map((r) => r.party_id)).toEqual([GUEST]);
    expect(await bal(b, 'PIMA_REVENUE')).toBe(-600);
  });

  it('9b. points booking without the redemption entry is refused, not given a debit balance', async () => {
    const b = await mkBooking({ points: 200 });
    await db.exec(`ALTER TABLE fin_transactions DISABLE TRIGGER fin_transactions_append_only;
                   ALTER TABLE fin_transaction_legs DISABLE TRIGGER fin_legs_append_only;`);
    await q(`DELETE FROM fin_transaction_legs WHERE txn_id IN (SELECT id FROM fin_transactions WHERE idempotency_key = $1)`, [`pts:redeem:${b}`]);
    await q(`DELETE FROM fin_transactions WHERE idempotency_key = $1`, [`pts:redeem:${b}`]);
    await db.exec(`ALTER TABLE fin_transactions ENABLE TRIGGER fin_transactions_append_only;
                   ALTER TABLE fin_transaction_legs ENABLE TRIGGER fin_legs_append_only;`);
    const p = await mkPayment(b, 2940);
    await expect(approve(p)).rejects.toThrow(/POINTS_REDEMPTION_NOT_POSTED/);
  });

  it('cash-at-house deposits never enter PIMA_CASH', async () => {
    const b = await mkBooking();
    const p = await mkPayment(b, 3000, 'cash');
    await approve(p);
    expect(await count(`SELECT count(*) AS n FROM fin_transactions WHERE idempotency_key=$1`, [`pay:recv:${p}`])).toBe(0);
    const r = await asAdmin(() => rpc(`public.fin_post_payment_received($1)`, [p]));
    expect(r.status).toBe('NOT_PIMA_CASH');
  });

  it('a booking with no financial snapshot (pre-core) is approved but not posted', async () => {
    await q(`INSERT INTO bookings (id, house_id, user_id, status, check_in, check_out)
             VALUES ('legacy_1','h1',$1,'approved',CURRENT_DATE+5,CURRENT_DATE+7)`, [GUEST]);
    const p = await mkPayment('legacy_1', 500);
    await approve(p);
    const r = await asAdmin(() => rpc(`public.fin_post_payment_received($1)`, [p]));
    expect(r.status).toBe('NO_FINANCIAL_SNAPSHOT');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('owner payout', () => {
  it('11. the owner is paid immediately after payment, before hold_until', async () => {
    const b = await mkBooking({ checkInDays: 60 });
    await paid(b, 3000);
    const r = await payout([b], 2400, `k11-${b}`);
    expect(num(r.net)).toBe(2400);
    expect(num(r.gross)).toBe(2400);
    const po = await one(`SELECT * FROM owner_payouts WHERE id=$1`, [r.payout_id]);
    expect(po.status).toBe('completed');
    expect(po.transaction_reference).toBe(`REF-k11-${b}`);
    expect(po.paid_from_account).toBe('CIB · 1234');
    expect(po.completed_by).toBe(ADMIN);
    expect(po.booking_ids).toEqual([b]);
    expect(num((await one(`SELECT amount_applied FROM payout_bookings WHERE payout_id=$1`, [r.payout_id])).amount_applied)).toBe(2400);
    expect(await legs(`payout:${r.payout_id}:${b}`)).toEqual({ OWNER_PAYABLE: 2400, PIMA_CASH: -2400 });
    expect(await bal(b, 'OWNER_PAYABLE')).toBe(0);
  });

  it('12. a payout can never exceed the cash-backed owner share', async () => {
    const b = await mkBooking();
    await paid(b, 1000);   // backs 800 for the owner
    await expect(payout([b], 2400, `k12a-${b}`)).rejects.toThrow(/PAYOUT_AMOUNT_MISMATCH: the server computes 800/);
    // The trigger itself, bypassing the RPC: 900 > 800 backed.
    await q(`INSERT INTO owner_payouts (id, house_id, owner_id, amount, status, completed_at) VALUES ('po_raw12','h1',$1,900,'completed',now())`, [OWNER]);
    await expect(q(`INSERT INTO payout_bookings (payout_id, booking_id, amount_applied, owner_id, house_id, currency)
                    VALUES ('po_raw12',$1,900,$2,'h1','EGP')`, [b, OWNER])).rejects.toThrow(/PAYOUT_EXCEEDS_RECEIVED/);
    const r = await payout([b], 800, `k12b-${b}`);
    expect(num(r.net)).toBe(800);
    const unpaid = await mkBooking();
    await expect(payout([unpaid], 1, `k12c-${unpaid}`)).rejects.toThrow(/PAYOUT_NOTHING_PAYABLE/);
  });

  it('13. a duplicate payout request replays; a second payout finds nothing payable', async () => {
    const b = await mkBooking();
    await paid(b, 3000);
    const r1 = await payout([b], 2400, `k13-${b}`);
    const n = await count(`SELECT count(*) AS n FROM fin_transactions`);
    const r2 = await payout([b], 2400, `k13-${b}`);
    expect(r2.replayed).toBe(true);
    expect(r2.payout_id).toBe(r1.payout_id);
    expect(await count(`SELECT count(*) AS n FROM fin_transactions`)).toBe(n);
    await expect(payout([b], 2400, `k13x-${b}`)).rejects.toThrow(/PAYOUT_NOTHING_PAYABLE/);
  });

  it('15. wrong owner: refused by the RPC and by the linkage trigger', async () => {
    const b1 = await mkBooking();
    const b2 = await mkBooking({ owner: OWNER2, house: 'h2' });
    await paid(b1, 3000); await paid(b2, 3000);
    await expect(payout([b1, b2], 4800, `k15-${b1}`)).rejects.toThrow(/PAYOUT_MIXED_OWNERS/);
    await q(`INSERT INTO owner_payouts (id, house_id, owner_id, amount, status, completed_at) VALUES ('po_raw15','h2',$1,100,'completed',now())`, [OWNER2]);
    await expect(q(`INSERT INTO payout_bookings (payout_id, booking_id, amount_applied, owner_id, house_id, currency)
                    VALUES ('po_raw15',$1,100,$2,'h2','EGP')`, [b1, OWNER2])).rejects.toThrow(/PAYOUT_OWNER_MISMATCH/);
  });

  it('16. wrong house: refused by the RPC and by the linkage trigger', async () => {
    const b1 = await mkBooking();
    const b2 = await mkBooking({ house: 'h1b' });
    await paid(b1, 3000); await paid(b2, 3000);
    await expect(payout([b1, b2], 4800, `k16-${b1}`)).rejects.toThrow(/PAYOUT_MIXED_HOUSES/);
    await q(`INSERT INTO owner_payouts (id, house_id, owner_id, amount, status, completed_at) VALUES ('po_raw16','h1b',$1,100,'completed',now())`, [OWNER]);
    await expect(q(`INSERT INTO payout_bookings (payout_id, booking_id, amount_applied, owner_id, house_id, currency)
                    VALUES ('po_raw16',$1,100,$2,'h1b','EGP')`, [b1, OWNER])).rejects.toThrow(/PAYOUT_HOUSE_MISMATCH/);
  });

  it('17. wrong currency: EGP and USD are never combined', async () => {
    const b1 = await mkBooking();
    const b2 = await mkBooking({ currency: 'USD' });
    await paid(b1, 3000); await paid(b2, 3000);
    await expect(payout([b1, b2], 4800, `k17-${b1}`)).rejects.toThrow(/PAYOUT_MIXED_CURRENCIES/);
  });

  it('18. a cancelled hold cannot be paid', async () => {
    const b = await mkBooking();
    await paid(b, 3000);
    await q(`UPDATE settlement_holds SET status='CANCELLED', cancelled_at=now() WHERE booking_id=$1`, [b]);
    await expect(payout([b], 2400, `k18-${b}`)).rejects.toThrow(/PAYOUT_HOLD_CANCELLED/);
  });

  it('19. transfer fee is the actual fee on the amount sent; the cap is never applied', async () => {
    const b = await mkBooking();
    await paid(b, 3000);
    const r = await payout([b], 2400, `k19-${b}`);
    expect(await legs(`payout:${r.payout_id}:fee`)).toEqual({ PIMA_TRANSFER_FEE_EXPENSE: 2.4, PIMA_CASH: -2.4 });
    const small = await mkBooking(); await paid(small, 300);   // owner 240 -> 0.24 -> floor 0.50
    const rs = await payout([small], 240, `k19s-${small}`);
    expect(num(rs.fee)).toBe(0.5);
    const big = await mkBooking({ retail: 200000 }); await paid(big, 60000);   // owner 48000 -> 48.00 > cap 20
    const rb = await payout([big], 48000, `k19b-${big}`);
    expect(num(rb.fee)).toBe(48);
  });

  it('after hold_until the ledger payable still bounds the payout', async () => {
    const b = await mkBooking({ checkInDays: 6, releaseDays: -1 });
    await paid(b, 1000);
    await expect(payout([b], 2400, `kph-${b}`)).rejects.toThrow(/computes 800/);
    expect(num((await payout([b], 800, `kph2-${b}`)).net)).toBe(800);
  });

  it('cash-shortfall booking: only customer cash is advanced early; the PIMA-funded rest from hold_until', async () => {
    // retail 1000, 10% commission -> entitlement 900; promo 200 -> final 800 < 900: shortfall 100.
    const early = await mkBooking({ retail: 1000, rate: 0.1, promo: 200 });
    expect(num((await one(`SELECT hold_amount FROM settlement_holds WHERE booking_id=$1`, [early])).hold_amount)).toBe(340);
    await paid(early, 240);
    expect(num((await payout([early], 240, `ksf-${early}`)).net)).toBe(240);
    const late = await mkBooking({ retail: 1000, rate: 0.1, promo: 200, checkInDays: 6, releaseDays: -1 });
    await paid(late, 240);
    expect(num((await payout([late], 340, `ksf2-${late}`)).net)).toBe(340);
    expect(await count(`SELECT count(*) AS n FROM owner_receivables WHERE booking_id IN ($1,$2)`, [early, late])).toBe(0);
  });

  it('an owner request is completed server-side, oldest check-in first', async () => {
    await q(`INSERT INTO houses (id, owner_id, name) VALUES ('hr',$1,'house r')`, [OWNER]);   // its own house: FIFO sees only these
    const older = await mkBooking({ house: 'hr', checkInDays: 40 });
    const newer = await mkBooking({ house: 'hr', checkInDays: 80 });
    await paid(older, 3000); await paid(newer, 3000);
    await as(OWNER, () => q(`INSERT INTO owner_payouts (id, house_id, owner_id, amount, status) VALUES ('req_1','hr',$1,3000,'pending')`, [OWNER]));
    const r = await asAdmin(() => rpc(`public.fin_complete_payout_request('req_1', 'REF-REQ', 'Vodafone')`));
    expect(num(r.net)).toBe(3000);
    const applied = await q(`SELECT booking_id, amount_applied FROM payout_bookings WHERE payout_id='req_1' ORDER BY booking_id`);
    expect(Object.fromEntries(applied.map((x) => [x.booking_id, num(x.amount_applied)]))).toEqual({ [older]: 2400, [newer]: 600 });
    const again = await asAdmin(() => rpc(`public.fin_complete_payout_request('req_1', 'REF-REQ', 'Vodafone')`));
    expect(again.replayed).toBe(true);
    await as(OWNER, () => q(`INSERT INTO owner_payouts (id, house_id, owner_id, amount, status) VALUES ('req_2','hr',$1,5000,'pending')`, [OWNER]));
    await expect(asAdmin(() => rpc(`public.fin_complete_payout_request('req_2', 'REF', NULL)`))).rejects.toThrow(/PAYOUT_REQUEST_EXCEEDS_PAYABLE/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('refunds', () => {
  it('21 / TEST A. full refund 3000 splits 600 PIMA / 2400 owner', async () => {
    const b = await mkBooking({ checkInDays: 30 });
    const p = await paid(b, 3000);
    await cancelAsGuest(b);
    const r = await refund(p, null, `k21-${b}`);
    expect([num(r.amount), num(r.pima_share), num(r.owner_share)]).toEqual([3000, 600, 2400]);
    expect(await legs(`refund:rec:k21-${b}`)).toEqual({ PIMA_REVENUE: 600, OWNER_PAYABLE: 2400, CUSTOMER_REFUND_PAYABLE: -3000 });
    expect(await legs(`refund:pay:k21-${b}`)).toEqual({ CUSTOMER_REFUND_PAYABLE: 3000, PIMA_CASH: -3000 });
    expect(r.receivable_id).toBeNull();   // the owner had not been paid: nothing to recover
    expect(num((await one(`SELECT refunded_amount FROM payments WHERE id=$1`, [p])).refunded_amount)).toBe(3000);
    expect(await bal(b, 'OWNER_PAYABLE')).toBe(0);
    expect(await bal(b, 'PIMA_CASH')).toBe(0);
  });

  it('22 / TEST B. partial refund 1000 splits 200 PIMA / 800 owner', async () => {
    const b = await mkBooking({ checkInDays: 30 });
    const p = await paid(b, 3000);
    await cancelAsGuest(b);
    const r = await refund(p, 1000, `k22-${b}`);
    expect([num(r.pima_share), num(r.owner_share)]).toEqual([200, 800]);
    expect(num(r.pima_share) + num(r.owner_share)).toBe(1000);
  });

  it('23 / TEST C. two refunds of 500 accumulate to 200 / 800 and the second does not overwrite the first', async () => {
    const b = await mkBooking({ checkInDays: 30 });
    const p = await paid(b, 3000);
    await cancelAsGuest(b);
    await refund(p, 500, `k23a-${b}`);
    await refund(p, 500, `k23b-${b}`);
    const ev = await q(`SELECT amount, owner_share, pima_share, cumulative_refund FROM refund_events WHERE booking_id=$1 ORDER BY cumulative_refund`, [b]);
    expect(ev.map((e) => [num(e.amount), num(e.owner_share), num(e.pima_share), num(e.cumulative_refund)]))
      .toEqual([[500, 400, 100, 500], [500, 400, 100, 1000]]);
    expect(num((await one(`SELECT refunded_amount FROM payments WHERE id=$1`, [p])).refunded_amount)).toBe(1000);
  });

  it('24. cumulative rounding: uneven shares still sum exactly, per event and in total', async () => {
    const b = await mkBooking({ promo: 300, checkInDays: 30 });   // D 2910, H 2610
    const p = await paid(b, 2910);
    await cancelAsGuest(b);
    for (const [i, a] of [1000, 1000, 910].entries()) await refund(p, a, `k24-${i}-${b}`);
    const ev = await q(`SELECT amount, owner_share, pima_share FROM refund_events WHERE booking_id=$1`, [b]);
    for (const e of ev) expect(num(e.owner_share) + num(e.pima_share)).toBeCloseTo(num(e.amount), 10);
    const tot = await one(`SELECT SUM(owner_share) AS o, SUM(pima_share) AS pi FROM refund_events WHERE booking_id=$1`, [b]);
    expect([num(tot.o), num(tot.pi)]).toEqual([2610, 300]);
  });

  it('25. a refund above the policy amount is refused', async () => {
    const b = await mkBooking({ checkInDays: 10 });   // 10 days: partial tier, 50%
    const p = await paid(b, 3000);
    await cancelAsGuest(b);
    await expect(refund(p, 1600, `k25a-${b}`)).rejects.toThrow(/REFUND_EXCEEDS_REFUNDABLE/);
    await refund(p, 1500, `k25b-${b}`);
    await expect(refund(p, 0.01, `k25c-${b}`)).rejects.toThrow(/REFUND_EXCEEDS_REFUNDABLE/);
    const none = await mkBooking({ checkInDays: 3 });
    const pn = await paid(none, 3000);
    await cancelAsGuest(none);
    await expect(refund(pn, null, `k25d-${none}`)).rejects.toThrow(/REFUND_NOTHING_REFUNDABLE/);
  });

  it('26. a duplicate refund replays and records one event', async () => {
    const b = await mkBooking({ checkInDays: 30 });
    const p = await paid(b, 3000);
    await cancelAsGuest(b);
    const r1 = await refund(p, 1000, `k26-${b}`);
    const r2 = await refund(p, 1000, `k26-${b}`);
    expect(r2.replayed).toBe(true);
    expect(r2.refund_event_id).toBe(r1.refund_event_id);
    expect(await count(`SELECT count(*) AS n FROM refund_events WHERE booking_id=$1`, [b])).toBe(1);
  });

  it('27 / 28. refund after the owner was paid creates an OWNER_RECEIVABLE for the owner share only', async () => {
    const b = await mkBooking({ checkInDays: 30 });
    const p = await paid(b, 3000);
    await payout([b], 2400, `k27-${b}`);
    await cancelAsGuest(b);
    const r = await refund(p, 1000, `k27r-${b}`);
    expect(r.receivable_id).not.toBeNull();
    const rv = await one(`SELECT * FROM owner_receivables WHERE id=$1`, [r.receivable_id]);
    expect(num(rv.amount)).toBe(800);   // TEST B: owner returns 800, never PIMA's 200
    expect(rv.owner_id).toBe(OWNER);
    expect(rv.status).toBe('OUTSTANDING');
    expect(num(rv.threshold_at_creation)).toBe(100);
    expect(rv.created_txn_id).not.toBeNull();
    expect(await bal(b, 'OWNER_RECEIVABLE')).toBe(800);
    expect(await bal(b, 'OWNER_PAYABLE')).toBe(0);
    // A full refund after full payout: the whole owner share comes back.
    const b2 = await mkBooking({ checkInDays: 30 });
    const p2 = await paid(b2, 3000);
    await payout([b2], 2400, `k27b-${b2}`);
    await cancelAsGuest(b2);
    const r2 = await refund(p2, null, `k27c-${b2}`);
    expect(num((await one(`SELECT amount FROM owner_receivables WHERE id=$1`, [r2.receivable_id])).amount)).toBe(2400);
  });

  it('29 / 30. receivable recovery: partial, full, duplicate, and over-recovery', async () => {
    const b = await mkBooking({ checkInDays: 30 });
    const p = await paid(b, 3000);
    await payout([b], 2400, `k29-${b}`);
    await cancelAsGuest(b);
    const { receivable_id: rid } = await refund(p, 1000, `k29r-${b}`);
    const rec = (amt: number, key: string) => asAdmin(() =>
      rpc(`public.fin_recover_owner_receivable($1::uuid, $2, 'EXPLICIT_REPAYMENT', $3)`, [rid, amt, key]));
    const a = await rec(300, `k29a-${b}`);
    expect(a.status).toBe('PARTIALLY_RECOVERED');
    const dup = await rec(300, `k29a-${b}`);
    expect(dup.recovery_id).toBe(a.recovery_id);   // same key, same recovery
    await expect(rec(600, `k29o-${b}`)).rejects.toThrow(/RECOVERY_EXCEEDS_OUTSTANDING/);
    const c = await rec(500, `k29c-${b}`);
    expect(c.status).toBe('RECOVERED');
    expect(await bal(b, 'OWNER_RECEIVABLE')).toBe(0);
    await expect(asAdmin(() => rpc(`public.fin_recover_owner_receivable($1::uuid, 1, 'SETTLEMENT_DEDUCTION', 'x')`, [rid])))
      .rejects.toThrow(/RECOVERY_DEDUCTION_ONLY_WITHIN_PAYOUT/);
  });

  it('settlement deduction: an outstanding receivable is netted off the next payout', async () => {
    const o = '00000000-0000-4000-8000-0000000000d1';
    await q(`INSERT INTO users (id, name, role) VALUES ($1,'owner d','owner')`, [o]);
    await q(`INSERT INTO houses (id, owner_id, name) VALUES ('hd',$1,'house d')`, [o]);
    const b1 = await mkBooking({ owner: o, house: 'hd', checkInDays: 30 });
    const p1 = await paid(b1, 3000);
    await payout([b1], 2400, `kd1-${b1}`);
    await cancelAsGuest(b1);
    const { receivable_id: rid } = await refund(p1, 1000, `kdr-${b1}`);   // owner owes 800
    const b2 = await mkBooking({ owner: o, house: 'hd' });
    await paid(b2, 3000);                                               // owner owed 2400
    const r = await payout([b2], 1600, `kd2-${b2}`, true);
    expect([num(r.gross), num(r.deducted), num(r.net), num(r.fee)]).toEqual([2400, 800, 1600, 1.6]);
    const rv = await one(`SELECT status FROM owner_receivables WHERE id=$1`, [rid]);
    expect(rv.status).toBe('RECOVERED');
    const rr = await one(`SELECT method, payout_id FROM owner_receivable_recoveries WHERE receivable_id=$1`, [rid]);
    expect([rr.method, rr.payout_id]).toEqual(['SETTLEMENT_DEDUCTION', r.payout_id]);
  });

  it('32. refund on a points booking is cash only; points accounts are untouched', async () => {
    const b = await mkBooking({ points: 200, checkInDays: 30 });   // D 2940, H 2540
    const p = await paid(b, 2940);
    await cancelAsGuest(b);
    const before = [await bal(b, 'POINTS_APPLIED'), await bal(b, 'POINTS_LIABILITY')];
    const r = await refund(p, null, `k32-${b}`);
    expect([num(r.owner_share), num(r.pima_share)]).toEqual([2540, 400]);
    expect([await bal(b, 'POINTS_APPLIED'), await bal(b, 'POINTS_LIABILITY')]).toEqual(before);
  });

  it('refused cases: cash-at-house deposit, booking not cancelled', async () => {
    const cb = await mkBooking({ checkInDays: 30 });
    const pc = await mkPayment(cb, 3000, 'cash'); await approve(pc);
    await cancelAsGuest(cb);
    await expect(refund(pc, null, `kc-${cb}`)).rejects.toThrow(/REFUND_NOT_PIMA_CASH/);
    const live = await mkBooking({ checkInDays: 30 });
    const pl = await paid(live, 3000);
    await expect(refund(pl, 100, `kl-${live}`)).rejects.toThrow(/REFUND_REQUIRES_CUSTOMER_CANCELLATION/);
  });

  it('a refund can be decided before it is paid; the ledger never claims otherwise', async () => {
    const b = await mkBooking({ checkInDays: 30 });
    const p = await paid(b, 3000);
    await cancelAsGuest(b);
    const r = await refund(p, 1000, `kdp-${b}`, false);
    expect(await bal(b, 'CUSTOMER_REFUND_PAYABLE')).toBe(-1000);
    expect(await bal(b, 'PIMA_CASH')).toBe(3000);
    expect(num((await one(`SELECT refunded_amount FROM payments WHERE id=$1`, [p])).refunded_amount)).toBe(0);
    await asAdmin(() => rpc(`public.fin_pay_refund($1::uuid, $2)`, [r.refund_event_id, `kdp-pay-${b}`]));
    expect(await bal(b, 'CUSTOMER_REFUND_PAYABLE')).toBe(0);
    expect(await bal(b, 'PIMA_CASH')).toBe(2000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('security', () => {
  it('33. anonymous callers can write nothing financial', async () => {
    await expect(as(null, () => q(`INSERT INTO owner_payouts (id, house_id, owner_id, amount) VALUES ('a1','h1',$1,10)`, [OWNER]), 'anon'))
      .rejects.toThrow(/permission denied/);
    await expect(as(null, () => q(`INSERT INTO payments (id, booking_id, user_id, amount, payment_method) VALUES ('a2','legacy_1',$1,10,'bank')`, [GUEST]), 'anon'))
      .rejects.toThrow(/row-level security/);
    await expect(as(null, () => q(`SELECT public.fin_post_refund('x', 1, 'k')`), 'anon')).rejects.toThrow(/permission denied/);
    await expect(as(null, () => q(`SELECT * FROM refund_events`), 'anon')).rejects.toThrow(/permission denied/);
  });

  it('34. a signed-in client cannot complete a payout or set its evidence', async () => {
    await expect(asAdmin(() => q(`INSERT INTO owner_payouts (id, house_id, owner_id, amount, status) VALUES ('c1','h1',$1,10,'completed')`, [OWNER])))
      .rejects.toThrow(/PAYOUT_CLIENT_REQUEST_ONLY/);   // the guard fires before RLS WITH CHECK
    await expect(asAdmin(() => q(`INSERT INTO owner_payouts (id, house_id, owner_id, amount, status) VALUES ('c1b','h1',$1,10,'pending')`, [OWNER])))
      .rejects.toThrow(/row-level security/);             // 0172 dropped the admin INSERT policy
    await expect(as(OWNER, () => q(`INSERT INTO owner_payouts (id, house_id, owner_id, amount, status, transaction_reference) VALUES ('c2','h1',$1,10,'pending','X')`, [OWNER])))
      .rejects.toThrow(/PAYOUT_CLIENT_REQUEST_ONLY/);
    await as(OWNER, () => q(`INSERT INTO owner_payouts (id, house_id, owner_id, amount, status) VALUES ('c3','h1',$1,10,'pending')`, [OWNER]));
    await expect(asAdmin(() => q(`UPDATE owner_payouts SET status='completed', completed_at=now() WHERE id='c3'`)))
      .rejects.toThrow(/PAYOUT_COMPLETION_SERVER_ONLY/);
    await expect(asAdmin(() => q(`UPDATE owner_payouts SET transaction_reference='X' WHERE id='c3'`)))
      .rejects.toThrow(/PAYOUT_FIELDS_SERVER_ONLY/);
    await asAdmin(() => q(`UPDATE owner_payouts SET status='processing', completed_at=NULL WHERE id='c3'`));   // still allowed
    await asAdmin(() => q(`UPDATE owner_payouts SET status='rejected', completed_at=NULL WHERE id='c3'`));     // still allowed
    expect((await one(`SELECT status FROM owner_payouts WHERE id='c3'`)).status).toBe('rejected');
  });

  it('35-38. no client can write payout linkage, holds, the ledger or receivables', async () => {
    const attempts = [
      `INSERT INTO payout_bookings (payout_id, booking_id, amount_applied, owner_id, house_id, currency) VALUES ('x','x',1,'${OWNER}','h1','EGP')`,
      `UPDATE settlement_holds SET status='RELEASED'`,
      `INSERT INTO fin_transactions (txn_type) VALUES ('adjustment')`,
      `INSERT INTO fin_transaction_legs (txn_id, account, amount) VALUES (gen_random_uuid(),'PIMA_CASH',1)`,
      `INSERT INTO owner_receivables (booking_id, owner_id, house_id, currency, amount, reason, created_txn_id, threshold_at_creation) VALUES ('x','${OWNER}','h1','EGP',1,'r',gen_random_uuid(),0)`,
      `INSERT INTO owner_receivable_recoveries (receivable_id, amount, currency, method, txn_id) VALUES (gen_random_uuid(),1,'EGP','EXPLICIT_REPAYMENT',gen_random_uuid())`,
      `INSERT INTO refund_events (idempotency_key) VALUES ('x')`,
      `INSERT INTO booking_cancellations (booking_id, previous_status) VALUES ('x','approved')`,
    ];
    for (const sql of attempts) await expect(asAdmin(() => q(sql))).rejects.toThrow(/permission denied/);
    for (const fn of ['fin_post_payment_internal(\'x\')', 'fin_payout_post(\'x\',NULL,\'h1\',\'EGP\',\'[]\'::jsonb,1)',
      'fin_create_owner_receivable_internal(\'x\',\'r\',\'k\')', 'fin_booking_position(\'x\')']) {
      await expect(asAdmin(() => q(`SELECT public.${fn}`))).rejects.toThrow(/permission denied/);
    }
  });

  it('39. the legacy refund path is ledger-backed, and refunded_* cannot be written directly', async () => {
    const b = await mkBooking({ checkInDays: 30 });
    const p = await paid(b, 3000);
    await cancelAsGuest(b);
    await expect(asAdmin(() => q(`UPDATE payments SET refunded_amount=100 WHERE id=$1`, [p]))).rejects.toThrow(/REFUND_COLUMNS_SERVER_ONLY/);
    await expect(as(GUEST, () => q(`SELECT public.record_refund($1, 100)`, [p]))).rejects.toThrow(/NOT_ALLOWED/);
    await asAdmin(() => q(`SELECT public.record_refund($1, 1000)`, [p]));   // the live admin button
    await asAdmin(() => q(`SELECT public.record_refund($1, 1000)`, [p]));   // repeat of the same total: no-op
    expect(await count(`SELECT count(*) AS n FROM refund_events WHERE payment_id=$1`, [p])).toBe(1);
    await asAdmin(() => q(`SELECT public.record_refund($1, 1500)`, [p]));   // the total grows: +500 posted
    const ev = await q(`SELECT amount, owner_share FROM refund_events WHERE payment_id=$1 ORDER BY cumulative_refund`, [p]);
    expect(ev.map((e) => [num(e.amount), num(e.owner_share)])).toEqual([[1000, 800], [500, 400]]);
    expect(num((await one(`SELECT refunded_amount FROM payments WHERE id=$1`, [p])).refunded_amount)).toBe(1500);
    await expect(asAdmin(() => q(`SELECT public.record_refund($1, 900)`, [p]))).rejects.toThrow(/REFUND_CANNOT_DECREASE/);
  });

  it('a posted payment cannot be un-approved or edited; non-accounting fields still can', async () => {
    const b = await mkBooking();
    const p = await paid(b, 3000);
    await expect(asAdmin(() => q(`UPDATE payments SET payment_status='pending' WHERE id=$1`, [p]))).rejects.toThrow(/PAYMENT_POSTED_CANNOT_UNAPPROVE/);
    await expect(asAdmin(() => q(`UPDATE payments SET payment_status='rejected' WHERE id=$1`, [p]))).rejects.toThrow(/PAYMENT_POSTED_CANNOT_UNAPPROVE/);
    await expect(asAdmin(() => q(`UPDATE payments SET amount=2000 WHERE id=$1`, [p]))).rejects.toThrow(/PAYMENT_POSTED_IMMUTABLE/);
    await asAdmin(() => q(`UPDATE payments SET admin_notes='checked', received_account='CIB' WHERE id=$1`, [p]));
    const cash = await mkPayment(b, 0.01, 'cash'); await approve(cash);
    await asAdmin(() => q(`UPDATE payments SET payment_status='pending' WHERE id=$1`, [cash]));   // never posted: may move
  });

  it('every admin RPC refuses a non-admin', async () => {
    for (const call of [`public.fin_post_payment_received('x')`, `public.fin_create_owner_payout(ARRAY['x'],1,'r','a','k')`,
      `public.fin_complete_payout_request('x','r',NULL)`, `public.fin_post_refund('x',1,'k')`,
      `public.fin_pay_refund(gen_random_uuid(),'k')`, `public.fin_create_owner_receivable('x','k')`,
      `public.fin_recover_owner_receivable(gen_random_uuid(),1,'EXPLICIT_REPAYMENT','k')`]) {
      await expect(as(OWNER, () => q(`SELECT ${call}`))).rejects.toThrow(/NOT_ALLOWED/);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('cancellation', () => {
  it('40. the customer can cancel, and the moment is recorded', async () => {
    const b = await mkBooking();
    await cancelAsGuest(b);
    const c = await one(`SELECT * FROM booking_cancellations WHERE booking_id=$1`, [b]);
    expect([c.cancelled_by, c.previous_status]).toEqual([GUEST, 'approved']);
  });

  it('41 / 42. neither the owner nor PIMA can cancel', async () => {
    const b = await mkBooking();
    await expect(as(OWNER, () => q(`UPDATE bookings SET status='cancelled' WHERE id=$1`, [b]))).rejects.toThrow(/BOOKING_CANCEL_CUSTOMER_ONLY/);
    await expect(asAdmin(() => q(`UPDATE bookings SET status='cancelled' WHERE id=$1`, [b]))).rejects.toThrow(/BOOKING_CANCEL_CUSTOMER_ONLY/);
    // The admin screen's "cancel" wrote 'rejected': refused for an accepted booking.
    await expect(asAdmin(() => q(`UPDATE bookings SET status='rejected' WHERE id=$1`, [b]))).rejects.toThrow(/BOOKING_REJECT_ONLY_PENDING/);
    const pend = await mkBooking({ status: 'pending' });
    await mkPayment(pend, 1000);
    await expect(as(OWNER, () => q(`UPDATE bookings SET status='rejected' WHERE id=$1`, [pend]))).rejects.toThrow(/BOOKING_REJECT_AFTER_PAYMENT/);
    const unpaid = await mkBooking({ status: 'pending' });
    await as(OWNER, () => q(`UPDATE bookings SET status='rejected' WHERE id=$1`, [unpaid]));   // declining an unpaid request is not a cancellation
    await cancelAsGuest(b);
    await expect(asAdmin(() => q(`UPDATE bookings SET status='approved' WHERE id=$1`, [b]))).rejects.toThrow(/BOOKING_CANCELLATION_FINAL/);
  });

  it('43. the refund follows the booking\'s own snapshot, not the platform settings', async () => {
    const tier = async (days: number, opts: BookingOpts = {}) => {
      const b = await mkBooking({ checkInDays: days, checkInFromCairoDate: true, ...opts });
      const p = await paid(b, 3000);
      await cancelAsGuest(b);
      return refund(p, 1, `k43-${b}`);
    };
    expect(num((await tier(30)).refund_pct)).toBe(1);
    expect(num((await tier(10)).refund_pct)).toBe(0.5);
    await expect(tier(3)).rejects.toThrow(/REFUND_EXCEEDS_REFUNDABLE/);
    // A property policy of 14 / 5 / 25% frozen onto the booking.
    const r = await tier(10, { freeDays: 14, partialDays: 5, partialPct: 0.25 });
    expect([num(r.refund_pct), num(r.refundable), num(r.days_before_check_in)]).toEqual([0.25, 750, 10]);
  });

  it('44. an owner or PIMA attempt leaves no cancellation and nothing to refund', async () => {
    const b = await mkBooking({ checkInDays: 30 });
    const p = await paid(b, 3000);
    await expect(as(OWNER, () => q(`UPDATE bookings SET status='cancelled' WHERE id=$1`, [b]))).rejects.toThrow();
    expect(await count(`SELECT count(*) AS n FROM booking_cancellations WHERE booking_id=$1`, [b])).toBe(0);
    await expect(refund(p, 100, `k44-${b}`)).rejects.toThrow(/REFUND_REQUIRES_CUSTOMER_CANCELLATION/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// STEP 2C — refund basis across H < D, H = D, H > D, and refunds never reverse
// more than payments recognised.
describe('2C: refund basis when the owner share is below, equal to, or above the deposit', () => {
  // H < D: retail 10000, 6% -> E 9400, D 3000, H 2400.
  // H = D: retail 1000, 10%, promo 100 -> E 900 = F 900, D 270, H 270, no shortfall.
  // H > D: retail 1000, 10%, promo 200 -> E 900 > F 800, D 240, H 340, shortfall 100.
  const equal = () => mkBooking({ retail: 1000, rate: 0.1, promo: 100, checkInDays: 30 });
  const short = () => mkBooking({ retail: 1000, rate: 0.1, promo: 200, checkInDays: 30 });
  const shares = async (b: string) => (await q(
    `SELECT amount, owner_share, pima_share FROM refund_events WHERE booking_id=$1 ORDER BY cumulative_refund`, [b]))
    .map((e) => [num(e.amount), num(e.owner_share), num(e.pima_share)]);

  it('the fixtures are the three regimes', async () => {
    const e = await equal();
    const s = await short();
    const rows = await q(`SELECT bf.booking_id, bf.deposit_amount, h.hold_amount, bf.cash_shortfall
      FROM booking_financials bf JOIN settlement_holds h USING (booking_id) WHERE bf.booking_id IN ($1,$2) ORDER BY bf.booking_id`, [e, s]);
    expect(rows.map((r) => [num(r.deposit_amount), num(r.hold_amount), num(r.cash_shortfall)]))
      .toEqual([[270, 270, 0], [240, 340, 100]]);
  });

  it('A. H < D: full, partial and cumulative refunds keep the 600 / 2400 split', async () => {
    const b = await mkBooking({ checkInDays: 30 });
    const p = await paid(b, 3000);
    await cancelAsGuest(b);
    await refund(p, 700, `2cA1-${b}`);
    await refund(p, 1300, `2cA2-${b}`);
    await refund(p, null, `2cA3-${b}`);
    expect(await shares(b)).toEqual([[700, 560, 140], [1300, 1040, 260], [1000, 800, 200]]);
  });

  it('B. H = D: the whole deposit is the owner\'s, so the owner bears the whole refund and PIMA none', async () => {
    const b = await equal();
    const p = await paid(b, 270);
    expect(await legs(`pay:recv:${p}`)).toEqual({ PIMA_CASH: 270, PIMA_PROMO_EXPENSE: 100, OWNER_PAYABLE: -270, PIMA_REVENUE: -100 });
    await cancelAsGuest(b);
    await refund(p, 100, `2cB1-${b}`);                       // partial
    await refund(p, null, `2cB2-${b}`);                      // the rest: cumulative = full
    expect(await shares(b)).toEqual([[100, 100, 0], [170, 170, 0]]);
    expect(await bal(b, 'OWNER_PAYABLE')).toBe(0);
    expect(await bal(b, 'PIMA_REVENUE')).toBe(-100);         // PIMA's margin was all given away as promotion; nothing to reverse
  });

  it('C. H > D: refunds come only out of the customer\'s money; the PIMA-funded shortfall is never refunded or charged', async () => {
    const b = await short();
    const p = await paid(b, 240);
    expect(await legs(`pay:recv:${p}`)).toEqual({ PIMA_CASH: 240, PIMA_PROMO_EXPENSE: 200, OWNER_PAYABLE: -340, PIMA_REVENUE: -100 });
    await cancelAsGuest(b);
    await refund(p, 100, `2cC1-${b}`);
    await refund(p, 140, `2cC2-${b}`);
    expect(await shares(b)).toEqual([[100, 100, 0], [140, 140, 0]]);   // never a negative PIMA share
    expect(await bal(b, 'OWNER_PAYABLE')).toBe(-100);        // the 100 shortfall commitment is untouched
    expect(await bal(b, 'PIMA_REVENUE')).toBe(-100);         // no PIMA revenue reversed: PIMA's deposit share is 0
    expect(await count(`SELECT count(*) AS n FROM owner_receivables WHERE booking_id=$1`, [b])).toBe(0);
  });

  it('C. H > D after an early advance: the receivable is refund-driven and smaller than the refund, never the shortfall', async () => {
    const b = await short();
    const p = await paid(b, 240);
    await payout([b], 240, `2cC3-${b}`);                     // only customer cash is advanced before the hold date
    await cancelAsGuest(b);
    const r = await refund(p, null, `2cC4-${b}`);            // full refund: the owner's contribution is 240
    expect([num(r.owner_share), num(r.pima_share)]).toEqual([240, 0]);
    const rv = await one(`SELECT amount FROM owner_receivables WHERE id=$1`, [r.receivable_id]);
    // 340 recognised - 240 paid - 240 refunded = -140: the owner owes back the
    // 240 they were advanced, netted against the 100 PIMA still owes them.
    expect(num(rv.amount)).toBe(140);
    expect(num(rv.amount)).toBeLessThanOrEqual(num(r.owner_share));
    expect(await bal(b, 'OWNER_PAYABLE')).toBe(0);
    expect(await bal(b, 'OWNER_RECEIVABLE')).toBe(140);
  });
});

describe('2C: refunds never reverse more than payments recognised', () => {
  it('three equal payments then three equal refunds land exactly on 600 / 2400 and zero every balance', async () => {
    const b = await mkBooking({ checkInDays: 30 });
    const ps = [await paid(b, 1000), await paid(b, 1000), await paid(b, 1000)];
    await cancelAsGuest(b);
    for (const [i, p] of ps.entries()) await refund(p, 1000, `2cE-${i}-${b}`);
    const ev = await q(`SELECT owner_share, pima_share FROM refund_events WHERE booking_id=$1 ORDER BY cumulative_refund`, [b]);
    expect(ev.map((e) => [num(e.owner_share), num(e.pima_share)])).toEqual([[800, 200], [800, 200], [800, 200]]);
    for (const acct of ['OWNER_PAYABLE', 'PIMA_REVENUE', 'PIMA_CASH', 'CUSTOMER_REFUND_PAYABLE']) expect(await bal(b, acct)).toBe(0);
  });

  it('uneven payments 700 / 1100 / 1200 and four uneven refunds still sum to exactly 600 / 2400', async () => {
    const b = await mkBooking({ checkInDays: 30 });
    const [p1, p2, p3] = [await paid(b, 700), await paid(b, 1100), await paid(b, 1200)];
    expect(await legs(`pay:recv:${p1}`)).toEqual({ PIMA_CASH: 700, OWNER_PAYABLE: -560, PIMA_REVENUE: -140 });
    await cancelAsGuest(b);
    await refund(p1, 450, `2cU1-${b}`);
    await refund(p2, 1100, `2cU2-${b}`);
    await refund(p1, 250, `2cU3-${b}`);
    await refund(p3, 1200, `2cU4-${b}`);
    const ev = await q(`SELECT owner_share, pima_share FROM refund_events WHERE booking_id=$1 ORDER BY cumulative_refund`, [b]);
    expect(ev.map((e) => [num(e.owner_share), num(e.pima_share)])).toEqual([[360, 90], [880, 220], [200, 50], [960, 240]]);
    const tot = await one(`SELECT SUM(owner_share) AS o, SUM(pima_share) AS pi FROM refund_events WHERE booking_id=$1`, [b]);
    expect([num(tot.o), num(tot.pi)]).toEqual([2400, 600]);
    for (const acct of ['OWNER_PAYABLE', 'PIMA_REVENUE', 'PIMA_CASH']) expect(await bal(b, acct)).toBe(0);
  });

  it('a deposit only partly paid can be refunded only up to what was received, split as it was recognised', async () => {
    const b = await mkBooking({ checkInDays: 30 });
    const p = await paid(b, 1000);                           // recognised: owner 800, PIMA 200
    await cancelAsGuest(b);
    const r = await refund(p, null, `2cP-${b}`);
    expect([num(r.amount), num(r.owner_share), num(r.pima_share)]).toEqual([1000, 800, 200]);
    await expect(refund(p, 0.01, `2cP2-${b}`)).rejects.toThrow(/REFUND_EXCEEDS_REFUNDABLE/);
    for (const acct of ['OWNER_PAYABLE', 'PIMA_REVENUE', 'PIMA_CASH']) expect(await bal(b, acct)).toBe(0);
  });
});

describe('2C: points, receivable idempotency, immutability, decline', () => {
  it('payment posting applies the one existing redemption entry and never creates another', async () => {
    const b = await mkBooking({ points: 200, checkInDays: 30 });
    const p = await paid(b, 1000); await paid(b, 1940);
    await cancelAsGuest(b);
    await refund(p, 500, `2cPts-${b}`);
    expect(await count(`SELECT count(*) AS n FROM fin_transactions WHERE idempotency_key LIKE 'pts:%' AND booking_id=$1`, [b])).toBe(1);
    const credits = await q(`SELECT g.amount FROM fin_transactions t JOIN fin_transaction_legs g ON g.txn_id=t.id
      WHERE t.booking_id=$1 AND g.account='POINTS_APPLIED' AND g.amount < 0`, [b]);
    expect(credits.map((c) => num(c.amount))).toEqual([-200]);             // one credit: the redemption
    expect(await bal(b, 'POINTS_APPLIED')).toBe(0);                          // fully applied by the two payments
  });

  it('receivable creation replays: the refund\'s own key and the public RPC never create a second one', async () => {
    const b = await mkBooking({ checkInDays: 30 });
    const p = await paid(b, 3000);
    await payout([b], 2400, `2cR-${b}`);
    await cancelAsGuest(b);
    const r1 = await refund(p, 1000, `2cR1-${b}`);
    const r2 = await refund(p, 1000, `2cR1-${b}`);
    expect(r2.receivable_id).toBe(r1.receivable_id);
    const a = await asAdmin(() => rpc(`public.fin_create_owner_receivable($1, 'again')`, [b]));
    const c = await asAdmin(() => rpc(`public.fin_create_owner_receivable($1, 'again')`, [b]));
    expect([a.receivable_id, c.receivable_id]).toEqual([null, null]);   // nothing left to reclassify
    expect(await count(`SELECT count(*) AS n FROM owner_receivables WHERE booking_id=$1`, [b])).toBe(1);
  });

  it('a posted payment\'s payer and method are fixed too', async () => {
    const b = await mkBooking();
    const p = await paid(b, 1000);
    await expect(asAdmin(() => q(`UPDATE payments SET user_id=$2 WHERE id=$1`, [p, GUEST2]))).rejects.toThrow(/PAYMENT_POSTED_IMMUTABLE/);
    await expect(asAdmin(() => q(`UPDATE payments SET payment_method='cash' WHERE id=$1`, [p]))).rejects.toThrow(/PAYMENT_POSTED_IMMUTABLE/);
    await expect(asAdmin(() => q(`UPDATE payments SET booking_id='legacy_1' WHERE id=$1`, [p]))).rejects.toThrow(/PAYMENT_POSTED_IMMUTABLE/);
  });

  it('an administrative decline stays available for an unpaid pending request, and is refused once money exists', async () => {
    const free = await mkBooking({ status: 'pending' });
    await asAdmin(() => q(`UPDATE bookings SET status='rejected' WHERE id=$1`, [free]));
    const paidPending = await mkBooking({ status: 'pending' });
    await paid(paidPending, 500);
    await expect(asAdmin(() => q(`UPDATE bookings SET status='rejected' WHERE id=$1`, [paidPending]))).rejects.toThrow(/BOOKING_REJECT_AFTER_PAYMENT/);
    await expect(as(OWNER, () => q(`UPDATE bookings SET status='cancelled' WHERE id=$1`, [paidPending]))).rejects.toThrow(/BOOKING_CANCEL_CUSTOMER_ONLY/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('ledger invariants over everything above', () => {
  it('no booking has had more reversed by refunds than its payments recognised', async () => {
    expect(await count(`SELECT count(*) AS n FROM settlement_holds h, fin_booking_position(h.booking_id) p
      WHERE p.owner_refund_charged > p.owner_allocated`)).toBe(0);
    expect(await count(`SELECT count(*) AS n FROM settlement_holds h, fin_booking_position(h.booking_id) p
      WHERE (SELECT COALESCE(SUM(pima_share),0) FROM refund_events e WHERE e.booking_id=h.booking_id)
            > GREATEST(0, p.cash_received - p.owner_allocated)`)).toBe(0);
    expect(await count(`SELECT count(*) AS n FROM refund_events WHERE owner_share < 0 OR pima_share < 0`)).toBe(0);
  });

  it('45. every transaction has legs and balances to exactly zero', async () => {
    expect(await count(`SELECT count(*) AS n FROM fin_transactions t WHERE NOT EXISTS (SELECT 1 FROM fin_transaction_legs g WHERE g.txn_id=t.id)`)).toBe(0);
    expect(await count(`SELECT count(*) AS n FROM (SELECT txn_id FROM fin_transaction_legs GROUP BY txn_id HAVING SUM(amount) <> 0) x`)).toBe(0);
    expect(await count(`SELECT count(*) AS n FROM fin_transactions`)).toBeGreaterThan(50);
  });

  it('46. the ledger and the new records are append-only', async () => {
    await expect(q(`UPDATE fin_transactions SET memo='x'`)).rejects.toThrow(/FIN_LEDGER_APPEND_ONLY/);
    await expect(q(`DELETE FROM fin_transaction_legs`)).rejects.toThrow(/FIN_LEDGER_APPEND_ONLY/);
    await expect(q(`UPDATE refund_events SET note='x'`)).rejects.toThrow(/FIN_RECORD_APPEND_ONLY/);
    await expect(q(`DELETE FROM booking_cancellations`)).rejects.toThrow(/FIN_RECORD_APPEND_ONLY/);
    await expect(q(`DELETE FROM payout_bookings`)).rejects.toThrow(/PAYOUT_LINKAGE_APPEND_ONLY/);
  });

  it('47. idempotency keys are unique and every posting carries one', async () => {
    expect(await count(`SELECT count(*) AS n FROM fin_transactions WHERE idempotency_key IS NULL`)).toBe(0);
    expect(await count(`SELECT count(*) AS n FROM (SELECT idempotency_key FROM fin_transactions GROUP BY 1 HAVING count(*)>1) x`)).toBe(0);
  });

  it('48. reversal scope is still enforced, and a reversal counts against what it reverses', async () => {
    const b = await mkBooking();
    const p = await paid(b, 1000);
    const orig = (await one(`SELECT id FROM fin_transactions WHERE idempotency_key=$1`, [`pay:recv:${p}`])).id as string;
    await expect(q(`INSERT INTO fin_transactions (txn_type, booking_id, reverses_txn_id) VALUES ('reversal', 'other', $1)`, [orig]))
      .rejects.toThrow(/FIN_REVERSAL_SCOPE_MISMATCH/);
    await db.transaction(async (tx) => {
      const r = (await tx.query<Row>(`INSERT INTO fin_transactions (txn_type, booking_id, house_id, owner_id, reverses_txn_id, idempotency_key)
        SELECT 'reversal', booking_id, house_id, owner_id, id, 'rev:' || id FROM fin_transactions WHERE id=$1 RETURNING id`, [orig])).rows[0].id;
      await tx.query(`INSERT INTO fin_transaction_legs (txn_id, account, amount, party_id)
        SELECT $1, account, -amount, party_id FROM fin_transaction_legs WHERE txn_id=$2`, [r, orig]);
    });
    const pos = await position(b);
    expect([num(pos.cash_received), num(pos.owner_allocated)]).toEqual([0, 0]);
  });

  it('49. no receivable ever represents a cash shortfall: every one is covered by the owner\'s refund contributions', async () => {
    // A receivable may sit on a shortfall booking (the owner was advanced
    // customer cash that was then refunded), but its amount never exceeds what
    // refunds charged the owner — so no part of it is the PIMA-funded shortfall.
    expect(await count(`SELECT count(*) AS n FROM (
        SELECT r.booking_id, SUM(r.amount) AS owed,
               (SELECT COALESCE(SUM(e.owner_share), 0) FROM refund_events e WHERE e.booking_id = r.booking_id) AS charged
          FROM owner_receivables r GROUP BY r.booking_id) x
      WHERE x.owed > x.charged`)).toBe(0);
    expect(await count(`SELECT count(*) AS n FROM owner_receivables r
      WHERE NOT EXISTS (SELECT 1 FROM refund_events e WHERE e.booking_id = r.booking_id)`)).toBe(0);
    // And there is at least one receivable on a shortfall booking to hold this to.
    expect(await count(`SELECT count(*) AS n FROM owner_receivables r JOIN booking_financials bf USING (booking_id)
      WHERE bf.cash_shortfall > 0`)).toBeGreaterThan(0);
  });

  it('50. no booking was ever paid beyond its hold, and PIMA never owes an owner a negative amount', async () => {
    expect(await count(`SELECT count(*) AS n FROM settlement_holds h
      WHERE (SELECT COALESCE(SUM(amount_applied),0) FROM payout_bookings pb WHERE pb.booking_id=h.booking_id) > h.hold_amount`)).toBe(0);
    expect(await count(`SELECT count(*) AS n FROM settlement_holds h, fin_booking_position(h.booking_id) p WHERE p.owner_payable_balance < 0`)).toBe(0);
  });
});
