// Supabase Edge Function: send a push notification to a user's devices via FCM.
//
// STATUS: template — wire up the secrets and TEST on a real device before relying
// on it. It is not (and cannot be) verified from the web repo.
//
// SECURITY: the caller is authenticated by a shared secret before anything is
// read from the body — see the guard at the top of the handler. Without it this
// endpoint took `userId` from the request and pushed to that user's devices,
// which let anyone who could reach it put a notification carrying Pima's name
// on any user's lock screen.
//
// Setup:
//   supabase secrets set FCM_SERVICE_ACCOUNT="$(cat service-account.json)"
//   supabase functions deploy send-push --no-verify-jwt
// A Database Webhook cannot present a user JWT, hence --no-verify-jwt; the
// shared secret below is what actually authenticates the caller, so the
// function must never be deployed without WEBHOOK_SECRET (or
// PUSH_WEBHOOK_SECRET) set — with neither, every request is refused.
//
// Call it from a Database Webhook on notifications INSERT, with the header
//   x-webhook-secret: <the secret>
// or directly:
//   POST { userId, title, body, data? }  with that same header.
//
// It reads every device_tokens row for the user (service role bypasses RLS),
// mints a short-lived Google OAuth token from the Firebase service account, and
// posts to the FCM HTTP v1 endpoint per token. Dead tokens (404/410) are pruned.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { GoogleAuth } from 'npm:google-auth-library@9';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SERVICE_ACCOUNT = JSON.parse(Deno.env.get('FCM_SERVICE_ACCOUNT') ?? '{}');

// Falls back to the secret send-email already uses, so push works the moment
// it is deployed with nothing new to configure. Set PUSH_WEBHOOK_SECRET to give
// the two channels separate credentials — then a leak of one does not open the
// other, and either can be rotated on its own.
const WEBHOOK_SECRET =
  (Deno.env.get('PUSH_WEBHOOK_SECRET') ?? Deno.env.get('WEBHOOK_SECRET') ?? '').trim();

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
    // Only the database webhook may invoke this. Without the check, anyone
    // holding the publishable anon key (it ships in the web bundle by design)
    // could POST an arbitrary userId/title/body and put a notification carrying
    // Pima's name on any user's lock screen — a ready-made phishing channel
    // ("your booking is about to be cancelled, pay here").
    //
    // Same shape as send-email: a dedicated shared secret is the primary
    // credential, because Supabase now issues secret keys in the `sb_secret_…`
    // format while SUPABASE_SERVICE_ROLE_KEY is still injected as the legacy
    // JWT, so comparing those two never matches. The service-role comparison
    // stays as a fallback for a legacy-key webhook.
    const provided = (req.headers.get('x-webhook-secret') ?? '').trim();
    const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
    const authorised =
      (WEBHOOK_SECRET !== '' && provided === WEBHOOK_SECRET) ||
      (SERVICE_ROLE !== '' && bearer === SERVICE_ROLE);
    if (!authorised) {
      return new Response('forbidden', { status: 403 });
    }

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
