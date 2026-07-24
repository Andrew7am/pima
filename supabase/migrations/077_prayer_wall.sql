-- 077_prayer_wall.sql
-- Community prayer wall (entertainment > الشركة): members post prayer requests
-- and tap "أصلي" to pray for others. Everyone signed in can read the wall and
-- post their own; the pray toggle is one-per-user, enforced server-side.

CREATE TABLE IF NOT EXISTS public.prayer_requests (
  id            TEXT PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  author_name   TEXT NOT NULL,
  church        TEXT NOT NULL DEFAULT '',
  text          TEXT NOT NULL,
  prayers_count INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS prayer_requests_created_idx ON public.prayer_requests (created_at DESC);

ALTER TABLE public.prayer_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prayer_requests_select_all" ON public.prayer_requests;
CREATE POLICY "prayer_requests_select_all" ON public.prayer_requests
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "prayer_requests_insert_own" ON public.prayer_requests;
CREATE POLICY "prayer_requests_insert_own" ON public.prayer_requests
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "prayer_requests_delete_own_or_admin" ON public.prayer_requests;
CREATE POLICY "prayer_requests_delete_own_or_admin" ON public.prayer_requests
  FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- One "pray" per user per request.
CREATE TABLE IF NOT EXISTS public.prayer_reactions (
  prayer_id  TEXT NOT NULL REFERENCES public.prayer_requests(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (prayer_id, user_id)
);

ALTER TABLE public.prayer_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prayer_reactions_select_own" ON public.prayer_reactions;
CREATE POLICY "prayer_reactions_select_own" ON public.prayer_reactions
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Toggle "I'm praying" for a request: inserts/removes the reaction and adjusts
-- the counter atomically. Returns the new state so the client can reflect it.
CREATE OR REPLACE FUNCTION public.toggle_prayer(p_prayer_id TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid       UUID := auth.uid();
  existing  BOOLEAN;
  new_count INT;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED'); END IF;

  SELECT EXISTS(SELECT 1 FROM public.prayer_reactions WHERE prayer_id = p_prayer_id AND user_id = uid) INTO existing;

  IF existing THEN
    DELETE FROM public.prayer_reactions WHERE prayer_id = p_prayer_id AND user_id = uid;
    UPDATE public.prayer_requests SET prayers_count = GREATEST(0, prayers_count - 1) WHERE id = p_prayer_id
      RETURNING prayers_count INTO new_count;
    RETURN jsonb_build_object('ok', true, 'praying', false, 'count', COALESCE(new_count, 0));
  ELSE
    INSERT INTO public.prayer_reactions (prayer_id, user_id) VALUES (p_prayer_id, uid);
    UPDATE public.prayer_requests SET prayers_count = prayers_count + 1 WHERE id = p_prayer_id
      RETURNING prayers_count INTO new_count;
    RETURN jsonb_build_object('ok', true, 'praying', true, 'count', COALESCE(new_count, 0));
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_prayer(TEXT) TO authenticated;

-- Realtime so new requests / counts appear live.
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.prayer_requests;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
