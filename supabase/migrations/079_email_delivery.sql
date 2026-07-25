-- 079_email_delivery.sql
-- Email as a second delivery channel for notifications.
--
-- Every user-facing event already writes a row to public.notifications via the
-- triggers in 047/063. Rather than add a parallel set of email triggers (and a
-- second source of truth that will drift), a Database Webhook on
-- notifications INSERT calls the `send-email` Edge Function, which renders and
-- sends the mail. This file adds only what that needs: an opt-out, a
-- tokenised unsubscribe, and a delivery log.

-- ── Per-user email preference ────────────────────────────────────────────
-- Opt-out rather than opt-in: transactional booking mail is expected by the
-- guest, and CAN-SPAM/GDPR-style compliance needs a working unsubscribe, not
-- silence by default.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email_opt_out BOOLEAN NOT NULL DEFAULT FALSE;

-- Random per-user token so an unsubscribe link works from an inbox, with no
-- session and no way to guess another user's link.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email_unsub_token UUID NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS users_email_unsub_token_idx ON public.users (email_unsub_token);

-- ── Delivery log ─────────────────────────────────────────────────────────
-- Also the dedupe key: the unique index on notification_id makes a webhook
-- retry (or a double-fire) a no-op instead of a duplicate email.
CREATE TABLE IF NOT EXISTS public.email_log (
  id              BIGSERIAL PRIMARY KEY,
  notification_id TEXT,
  user_id         UUID REFERENCES public.users(id) ON DELETE SET NULL,
  to_email        TEXT NOT NULL DEFAULT '',
  subject         TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL CHECK (status IN ('sent', 'skipped', 'failed')),
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS email_log_notification_idx
  ON public.email_log (notification_id) WHERE notification_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS email_log_created_idx ON public.email_log (created_at DESC);

ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;

-- Only admins inspect the log from the client; the Edge Function writes with
-- the service role, which bypasses RLS.
DROP POLICY IF EXISTS "email_log_admin_read" ON public.email_log;
CREATE POLICY "email_log_admin_read" ON public.email_log
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- ── In-app toggle ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_email_opt_out(p_opt_out BOOLEAN)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  UPDATE public.users SET email_opt_out = p_opt_out WHERE id = uid;
  RETURN p_opt_out;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_email_opt_out(BOOLEAN) TO authenticated;

-- ── One-click unsubscribe from an email link ─────────────────────────────
-- Deliberately callable by anon: the recipient is not signed in when they click
-- the link in their inbox. The token is the only thing it accepts, it can only
-- ever set opt_out = TRUE, and it returns no user data — so a guessed or
-- replayed token reveals nothing and does nothing new.
CREATE OR REPLACE FUNCTION public.unsubscribe_email(p_token UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  hit INT;
BEGIN
  UPDATE public.users SET email_opt_out = TRUE WHERE email_unsub_token = p_token;
  GET DIAGNOSTICS hit = ROW_COUNT;
  RETURN hit > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.unsubscribe_email(UUID) TO anon, authenticated;

-- ── Lookup for the Edge Function ─────────────────────────────────────────
-- The function runs with the service role and could read public.users
-- directly; this wrapper keeps the columns it depends on explicit, so a later
-- schema change breaks here loudly instead of silently emailing nobody.
CREATE OR REPLACE FUNCTION public.get_email_recipient(p_user_id UUID)
RETURNS TABLE(email TEXT, name TEXT, opt_out BOOLEAN, unsub_token UUID)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.email, u.name, u.email_opt_out, u.email_unsub_token
  FROM public.users u
  WHERE u.id = p_user_id AND u.is_banned = FALSE;
$$;

REVOKE ALL ON FUNCTION public.get_email_recipient(UUID) FROM PUBLIC, anon, authenticated;
