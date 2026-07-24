// Supabase Edge Function: send a push notification to a user's devices via FCM.
//
// STATUS: template — wire up the secrets and TEST on a real device before relying
// on it. It is not (and cannot be) verified from the web repo.
//
// Setup:
//   supabase secrets set FCM_SERVICE_ACCOUNT="$(cat service-account.json)"
//   supabase functions deploy send-push
// Call it (from a DB trigger via pg_net, or the service role):
//   POST { userId, title, body, data? }  with the service-role key.
//
// It reads every device_tokens row for the user (service role bypasses RLS),
// mints a short-lived Google OAuth token from the Firebase service account, and
// posts to the FCM HTTP v1 endpoint per token. Dead tokens (404/410) are pruned.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { GoogleAuth } from 'npm:google-auth-library@9';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SERVICE_ACCOUNT = JSON.parse(Deno.env.get('FCM_SERVICE_ACCOUNT') ?? '{}');

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

async function fcmAccessToken(): Promise<string> {
  const auth = new GoogleAuth({
    credentials: SERVICE_ACCOUNT,
    scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
  });
  const client = await auth.getClient();
  const { token } = await client.getAccessToken();
  return token!;
}

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    // Accept both a direct call ({ userId, title, body, data }) and a Supabase
    // Database Webhook on notifications INSERT ({ type, record: {...row} }), so
    // it can be wired straight from the dashboard with no SQL/secrets.
    const rec = payload.record;
    const userId = payload.userId ?? rec?.user_id;
    const title = payload.title ?? rec?.title;
    const body = payload.body ?? rec?.message;
    const data = payload.data ?? (rec?.booking_id ? { bookingId: rec.booking_id } : undefined);
    if (!userId || !title) return new Response('missing userId/title', { status: 400 });

    const { data: tokens, error } = await admin
      .from('device_tokens').select('token, platform').eq('user_id', userId);
    if (error) return new Response(error.message, { status: 500 });
    if (!tokens?.length) return new Response(JSON.stringify({ sent: 0 }), { status: 200 });

    const accessToken = await fcmAccessToken();
    const projectId = SERVICE_ACCOUNT.project_id;
    const endpoint = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    let sent = 0;
    const dead: string[] = [];
    for (const { token } of tokens) {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            token,
            notification: { title, body: body ?? '' },
            data: data ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])) : undefined,
          },
        }),
      });
      if (res.ok) sent++;
      else if (res.status === 404 || res.status === 410) dead.push(token); // token expired/unregistered
    }
    if (dead.length) await admin.from('device_tokens').delete().in('token', dead);

    return new Response(JSON.stringify({ sent, pruned: dead.length }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(String(e), { status: 500 });
  }
});
