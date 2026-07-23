// Resilience & security probe for the Pima backend (Supabase).
//
// SAFE BY DESIGN: every probe either (a) expects to be REJECTED — so nothing
// is written — or (b) hits a read-only RPC at LOW volume. It does NOT flood the
// site and must never be pointed at anything you don't own. Run against your own
// project only. Usage:  node scripts/resilience-probe.mjs
//
// It confirms, as an anonymous attacker/bot would experience it:
//   1. Anonymous writes to houses / bookings / reviews are blocked by RLS.
//   2. The private users table is not readable by anon.
//   3. Oversized / malformed payloads are rejected, not stored.
//   4. SQL-injection-style input is handled as data (parameterised), not run.
//   5. A small concurrency burst degrades gracefully (no 5xx / crash).
import fs from 'fs';
import path from 'path';

// --- load VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY from env or .env ---
function loadEnv() {
  const env = { ...process.env };
  for (const f of ['.env', '.env.local']) {
    try {
      const txt = fs.readFileSync(path.resolve(process.cwd(), f), 'utf8');
      for (const line of txt.split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
        if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
    } catch { /* file may not exist */ }
  }
  return env;
}
const env = loadEnv();
const URL = env.VITE_SUPABASE_URL;
const KEY = env.VITE_SUPABASE_ANON_KEY;
if (!URL || !KEY) { console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY'); process.exit(1); }

const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
let pass = 0, fail = 0;
const ok = (name, cond, detail) => { (cond ? pass++ : fail++); console.log(`${cond ? '✅ PASS' : '❌ FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`); };

async function rest(method, table, body) {
  const r = await fetch(`${URL}/rest/v1/${table}`, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, text: await r.text().catch(() => '') };
}
async function rpc(fn, body) {
  const r = await fetch(`${URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: H, body: JSON.stringify(body) });
  return { status: r.status, text: await r.text().catch(() => '') };
}

const BIG = 'ح'.repeat(200000); // ~200k-char garbage string

console.log('\n=== Pima resilience & security probe ===\n');

// 1–3: anonymous writes must be blocked by RLS (>=400, nothing stored)
{
  const a = await rest('POST', 'houses', { id: `probe_${Date.now()}`, name: 'HACK', owner_id: '00000000-0000-0000-0000-000000000000', status: 'approved' });
  ok('anon cannot INSERT houses', a.status >= 400, `HTTP ${a.status}`);
  const b = await rest('POST', 'bookings', { id: `probe_${Date.now()}`, user_id: '00000000-0000-0000-0000-000000000000', house_id: 'x' });
  ok('anon cannot INSERT bookings', b.status >= 400, `HTTP ${b.status}`);
  const c = await rest('POST', 'reviews', { id: `probe_${Date.now()}`, user_id: '00000000-0000-0000-0000-000000000000', house_id: 'x', rating: 5, comment: 'spam' });
  ok('anon cannot INSERT reviews', c.status >= 400, `HTTP ${c.status}`);
}

// 4: private tables not readable by anon
{
  const u = await rest('GET', 'users?select=id,phone,email&limit=5');
  const rows = (() => { try { return JSON.parse(u.text); } catch { return null; } })();
  ok('anon cannot read users PII', u.status >= 400 || (Array.isArray(rows) && rows.length === 0), `HTTP ${u.status}`);
  const p = await rest('GET', 'payments?select=id&limit=5');
  const prows = (() => { try { return JSON.parse(p.text); } catch { return null; } })();
  ok('anon cannot read payments', p.status >= 400 || (Array.isArray(prows) && prows.length === 0), `HTTP ${p.status}`);
}

// 5: oversized / malformed payloads rejected (also blocked by RLS as anon — double safety)
{
  const big = await rest('POST', 'reviews', { id: `probe_${Date.now()}`, user_id: '0', house_id: 'x', rating: 5, comment: BIG });
  ok('oversized review payload rejected', big.status >= 400, `HTTP ${big.status}`);
  const badType = await rest('POST', 'bookings', { id: 1234, user_id: 'not-a-uuid', guests_count: 'lots' });
  ok('malformed-type booking rejected', badType.status >= 400, `HTTP ${badType.status}`);
}

// 6: SQL-injection-style input is treated as data (parameterised), not executed
{
  const inj = await rpc('get_houses_availability', { p_check_in: "2026-01-01'; DROP TABLE public.houses;--", p_check_out: '2026-01-05' });
  ok('SQL-injection string is not executed', inj.status >= 400, `HTTP ${inj.status} (rejected as bad date, table intact)`);
  // confirm houses table still there & readable (public approved listing)
  const still = await rest('GET', 'houses?select=id&limit=1');
  ok('houses table survived injection attempt', still.status === 200, `HTTP ${still.status}`);
}

// 7: garbage args to the anon RPC are handled, not crashing
{
  const g = await rpc('get_houses_availability', { p_check_in: 'garbage', p_check_out: 42 });
  ok('RPC rejects garbage args cleanly', g.status >= 400 && g.status < 500, `HTTP ${g.status}`);
}

// 8: light concurrency burst — the read RPC should stay healthy (no 5xx)
{
  const N = 25;
  const results = await Promise.all(Array.from({ length: N }, () =>
    rpc('get_houses_availability', { p_check_in: '2026-08-01', p_check_out: '2026-08-05' }).then(r => r.status).catch(() => 599)));
  const okCount = results.filter(s => s === 200).length;
  const server5xx = results.filter(s => s >= 500).length;
  ok(`concurrency burst x${N} stays healthy`, server5xx === 0 && okCount >= N - 2, `${okCount}/${N} ok, ${server5xx} server errors`);
}

console.log(`\n=== ${pass} passed, ${fail} failed ===\n`);
process.exit(fail === 0 ? 0 : 1);
