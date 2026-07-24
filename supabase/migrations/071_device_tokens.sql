-- ============================================================
-- Device push tokens for native notifications (FCM/APNs). The app registers a
-- token per install and stores it here; a server function (send-push) reads
-- these to deliver push even when the app is closed. Each user manages only
-- their own tokens (RLS). tokens are unique so a re-register upserts.
-- Needs the client push plugin + a Firebase (FCM) project to actually deliver —
-- this table + RLS are the safe DB groundwork.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.device_tokens (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token       TEXT NOT NULL UNIQUE CHECK (char_length(token) BETWEEN 1 AND 4096),
  platform    TEXT NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS device_tokens_user_idx ON public.device_tokens (user_id);

ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "device_tokens_select_own" ON public.device_tokens;
CREATE POLICY "device_tokens_select_own" ON public.device_tokens
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "device_tokens_insert_own" ON public.device_tokens;
CREATE POLICY "device_tokens_insert_own" ON public.device_tokens
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "device_tokens_update_own" ON public.device_tokens;
CREATE POLICY "device_tokens_update_own" ON public.device_tokens
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "device_tokens_delete_own" ON public.device_tokens;
CREATE POLICY "device_tokens_delete_own" ON public.device_tokens
  FOR DELETE USING (user_id = auth.uid());
