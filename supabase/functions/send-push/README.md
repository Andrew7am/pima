# send-push — activating native push (FCM)

The app already **registers** each device's FCM token on login
(`src/lib/push.ts` → `device_tokens`), and this function **sends** a push to
those tokens. What's left is infra you run once on your own project — it can't
be done or verified from the web repo.

## 1) Firebase (one-time)
- In the Firebase console for your Android app, create a **service account** and
  download its JSON key.
- Make sure the app's `google-services.json` is in the Android project.

## 2) Set the secret + deploy
```
supabase secrets set FCM_SERVICE_ACCOUNT="$(cat service-account.json)"
supabase functions deploy send-push
```

## 3) Fire it on every new notification (no SQL needed)
In the Supabase dashboard: **Database → Webhooks → Create a new hook**
- Table: `public.notifications`, Events: **Insert**
- Type: **Supabase Edge Function** → `send-push`

The function accepts the webhook's `{ record: {...} }` shape directly (it reads
`user_id`, `title`, `message`, `booking_id`), so nothing else is required.

## Test
Install the Android build on a device, log in (grants push permission + stores a
token), then trigger any notification (e.g. a new booking). The device should
receive it. Dead/expired tokens are pruned automatically.

> Web (browser) push is separate and not covered here — it needs a service
> worker + VAPID keys + its own sender.
