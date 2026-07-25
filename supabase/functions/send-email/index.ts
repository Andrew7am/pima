// Supabase Edge Function: deliver a notification by email via Resend.
//
// Wiring (no SQL needed — done once from the dashboard):
//   1. supabase secrets set RESEND_API_KEY=re_xxx
//      supabase secrets set EMAIL_FROM="بيما <no-reply@pimastay.com>"
//      supabase secrets set APP_URL="https://pimastay.com"
//   2. supabase functions deploy send-email
//   3. Database → Webhooks → new webhook on public.notifications, event INSERT,
//      type "Supabase Edge Functions", select send-email.
//
// Design: public.notifications is the single source of truth for user-facing
// events (triggers in migrations 047/063 already write every one of them), so
// email is just a second delivery channel over the same rows. No parallel set
// of email triggers to drift out of sync.
//
// Safety: recipients who opted out are skipped, every attempt is written to
// email_log, and the unique index on email_log.notification_id makes a webhook
// retry a no-op rather than a duplicate send.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const EMAIL_FROM = Deno.env.get('EMAIL_FROM') ?? 'بيما <no-reply@pimastay.com>';
const APP_URL = (Deno.env.get('APP_URL') ?? 'https://pimastay.com').replace(/\/$/, '');

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

interface NotificationRow {
  id: string;
  user_id: string;
  booking_id: string | null;
  title: string;
  message: string;
  type: 'success' | 'danger' | 'info';
}

// Brand palette — kept in sync with the app's natural theme.
const ACCENT: Record<NotificationRow['type'], string> = {
  success: '#2E7D5B',
  danger: '#C0392B',
  info: '#4A4A3A',
};

// The call to action depends on what the event is about. Matching on the
// notification title keeps this in one place; anything unmatched still gets a
// sensible default rather than no button at all.
function callToAction(n: NotificationRow): { label: string; url: string } {
  const t = n.title;
  if (/رسالة/.test(t)) return { label: 'افتح المحادثة', url: `${APP_URL}/?screen=messages` };
  if (/تقييم|شكراً لإقامتك/.test(t)) return { label: 'اكتب تقييمك', url: `${APP_URL}/?screen=bookings` };
  if (/توفر مكان/.test(t)) return { label: 'احجز الآن', url: `${APP_URL}/` };
  if (/تحويل|مستحقات|دفع|عربون/.test(t)) return { label: 'عرض التفاصيل المالية', url: `${APP_URL}/?screen=bookings` };
  if (n.booking_id) return { label: 'عرض الحجز', url: `${APP_URL}/?screen=bookings` };
  return { label: 'افتح بيما', url: `${APP_URL}/` };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!
  ));
}

// Table-based, inline-styled layout: this is what actually survives Gmail,
// Outlook and the Arabic mail clients. No external CSS, no web fonts.
function renderEmail(n: NotificationRow, name: string, unsubToken: string): string {
  const accent = ACCENT[n.type];
  const cta = callToAction(n);
  const unsubUrl = `${APP_URL}/?unsubscribe=${unsubToken}`;
  const body = escapeHtml(n.message).replace(/\n/g, '<br/>');

  return `<!doctype html>
<html dir="rtl" lang="ar">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeHtml(n.title)}</title></head>
<body style="margin:0;padding:0;background:#F4F2ED;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F2ED;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E2DED4;">

        <tr><td style="background:${accent};padding:20px 24px;text-align:right;">
          <div style="color:#ffffff;font-size:20px;font-weight:bold;letter-spacing:1px;">بيما</div>
          <div style="color:rgba(255,255,255,.85);font-size:12px;margin-top:2px;">حجز بيوت المؤتمرات والخلوات</div>
        </td></tr>

        <tr><td style="padding:28px 24px 8px;text-align:right;">
          <div style="font-size:13px;color:#8A8A70;">أهلاً ${escapeHtml(name || 'بك')} 👋</div>
          <h1 style="margin:10px 0 14px;font-size:19px;line-height:1.5;color:#2B2B22;font-weight:bold;">${escapeHtml(n.title)}</h1>
          <div style="font-size:14px;line-height:1.9;color:#55554A;">${body}</div>
        </td></tr>

        <tr><td style="padding:22px 24px 28px;text-align:right;">
          <a href="${cta.url}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;padding:12px 26px;border-radius:10px;">${cta.label}</a>
        </td></tr>

        <tr><td style="background:#FAF8F5;border-top:1px solid #E2DED4;padding:18px 24px;text-align:right;">
          <div style="font-size:11px;color:#8A8A70;line-height:1.8;">
            وصلتك هذه الرسالة لأن لديك حساباً على بيما.<br/>
            <a href="${unsubUrl}" style="color:#8A8A70;text-decoration:underline;">إلغاء الاشتراك في رسائل البريد</a>
            &nbsp;·&nbsp;
            <a href="${APP_URL}/" style="color:#8A8A70;text-decoration:underline;">pimastay.com</a>
          </div>
        </td></tr>

      </table>
      <div style="max-width:560px;margin:14px auto 0;font-size:11px;color:#A5A594;text-align:center;">© بيما — كل الحقوق محفوظة</div>
    </td></tr>
  </table>
</body></html>`;
}

async function log(entry: {
  notification_id: string | null; user_id: string | null; to_email: string;
  subject: string; status: 'sent' | 'skipped' | 'failed'; error?: string;
}) {
  // Never let a logging failure mask the send result.
  await admin.from('email_log').insert(entry).then(undefined, () => undefined);
}

Deno.serve(async (req) => {
  try {
    // Only the database webhook may invoke this. Without the check, anyone
    // holding the publishable anon key (it ships in the web bundle by design)
    // could POST an arbitrary user_id/title/message and send branded mail from
    // our domain to any account — a spam and phishing vector that would burn
    // the sending domain's reputation. The webhook must therefore send the
    // service-role key in the Authorization header.
    const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
    if (!SERVICE_ROLE || bearer !== SERVICE_ROLE) {
      return new Response('forbidden', { status: 403 });
    }

    const payload = await req.json();
    // Accept both a Database Webhook ({ type, record }) and a direct call.
    const rec: NotificationRow | undefined = payload.record ?? payload.notification;
    if (!rec?.user_id || !rec?.title) {
      return new Response('missing notification payload', { status: 400 });
    }

    if (!RESEND_API_KEY) {
      await log({ notification_id: rec.id ?? null, user_id: rec.user_id, to_email: '', subject: rec.title, status: 'failed', error: 'RESEND_API_KEY not set' });
      return new Response('RESEND_API_KEY not configured', { status: 500 });
    }

    // Dedupe: a webhook retry must not send the mail twice.
    if (rec.id) {
      const { data: seen } = await admin
        .from('email_log').select('id').eq('notification_id', rec.id).maybeSingle();
      if (seen) return new Response(JSON.stringify({ skipped: 'duplicate' }), { status: 200 });
    }

    const { data: recipients, error: recErr } = await admin
      .rpc('get_email_recipient', { p_user_id: rec.user_id });
    if (recErr) {
      await log({ notification_id: rec.id ?? null, user_id: rec.user_id, to_email: '', subject: rec.title, status: 'failed', error: recErr.message });
      return new Response(recErr.message, { status: 500 });
    }

    const recipient = Array.isArray(recipients) ? recipients[0] : recipients;
    if (!recipient?.email) {
      await log({ notification_id: rec.id ?? null, user_id: rec.user_id, to_email: '', subject: rec.title, status: 'skipped', error: 'no email / banned' });
      return new Response(JSON.stringify({ skipped: 'no recipient' }), { status: 200 });
    }
    if (recipient.opt_out) {
      await log({ notification_id: rec.id ?? null, user_id: rec.user_id, to_email: recipient.email, subject: rec.title, status: 'skipped', error: 'opted out' });
      return new Response(JSON.stringify({ skipped: 'opted out' }), { status: 200 });
    }

    const html = renderEmail(rec, recipient.name ?? '', recipient.unsub_token);
    const unsubUrl = `${APP_URL}/?unsubscribe=${recipient.unsub_token}`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [recipient.email],
        subject: rec.title,
        html,
        // Gmail/Outlook surface a native unsubscribe control from these, which
        // keeps complaints (and therefore the sending domain's reputation) low.
        headers: {
          'List-Unsubscribe': `<${unsubUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      await log({ notification_id: rec.id ?? null, user_id: rec.user_id, to_email: recipient.email, subject: rec.title, status: 'failed', error: detail.slice(0, 500) });
      return new Response(detail, { status: 502 });
    }

    await log({ notification_id: rec.id ?? null, user_id: rec.user_id, to_email: recipient.email, subject: rec.title, status: 'sent' });
    return new Response(JSON.stringify({ sent: 1 }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(e instanceof Error ? e.message : 'unknown error', { status: 500 });
  }
});
