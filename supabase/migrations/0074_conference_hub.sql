-- 074_conference_hub.sql
-- Persistence for the entertainment Conference Hub:
--   * participant_cards  — one digital participant card per user; everyone in
--     the app can read all cards (the hub shows the participants list), a user
--     writes their own, and servants/owners/admins may edit any card (with an
--     append-only audit log kept in JSONB).
--   * spiritual_journals — private per-user journal entries (own rows only).
-- Both are added to the realtime publication so the ported listen* helpers get
-- live updates.

-- ---------------------------------------------------------------------------
-- participant_cards
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.participant_cards (
  user_id           UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  user_name         TEXT NOT NULL DEFAULT '',
  avatar_url        TEXT NOT NULL DEFAULT '',
  team_name         TEXT NOT NULL DEFAULT '',
  room_no           TEXT NOT NULL DEFAULT '',
  building          TEXT NOT NULL DEFAULT '',
  floor             TEXT NOT NULL DEFAULT '',
  points            INT  NOT NULL DEFAULT 0,
  level             INT  NOT NULL DEFAULT 1,
  attendance_status TEXT NOT NULL DEFAULT 'تم التسجيل',
  card_status       TEXT NOT NULL DEFAULT 'فعالة',
  qr_code_data      TEXT NOT NULL DEFAULT '',
  audit_log         JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.participant_cards ENABLE ROW LEVEL SECURITY;

-- Everyone signed in can see the participants list.
DROP POLICY IF EXISTS "participant_cards_select_all" ON public.participant_cards;
CREATE POLICY "participant_cards_select_all" ON public.participant_cards
  FOR SELECT TO authenticated USING (true);

-- A user creates their own card.
DROP POLICY IF EXISTS "participant_cards_insert_own" ON public.participant_cards;
CREATE POLICY "participant_cards_insert_own" ON public.participant_cards
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Own card, or a servant/owner/admin editing any card.
DROP POLICY IF EXISTS "participant_cards_update_own_or_staff" ON public.participant_cards;
CREATE POLICY "participant_cards_update_own_or_staff" ON public.participant_cards
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('servant','owner','admin'))
  )
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('servant','owner','admin'))
  );

-- ---------------------------------------------------------------------------
-- spiritual_journals
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.spiritual_journals (
  id              TEXT PRIMARY KEY,               -- client-generated id
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title           TEXT NOT NULL DEFAULT '',
  content         TEXT NOT NULL DEFAULT '',
  favorite_verses JSONB NOT NULL DEFAULT '[]'::jsonb,
  decisions       JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS spiritual_journals_user_idx
  ON public.spiritual_journals (user_id, created_at DESC);

ALTER TABLE public.spiritual_journals ENABLE ROW LEVEL SECURITY;

-- Private: a user only ever sees / writes their own entries.
DROP POLICY IF EXISTS "spiritual_journals_select_own" ON public.spiritual_journals;
CREATE POLICY "spiritual_journals_select_own" ON public.spiritual_journals
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "spiritual_journals_insert_own" ON public.spiritual_journals;
CREATE POLICY "spiritual_journals_insert_own" ON public.spiritual_journals
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "spiritual_journals_update_own" ON public.spiritual_journals;
CREATE POLICY "spiritual_journals_update_own" ON public.spiritual_journals
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "spiritual_journals_delete_own" ON public.spiritual_journals;
CREATE POLICY "spiritual_journals_delete_own" ON public.spiritual_journals
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Realtime (idempotent — ADD TABLE errors if already a member)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.participant_cards;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.spiritual_journals;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
