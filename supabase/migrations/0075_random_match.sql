-- 075_random_match.sql
-- Backing store for the ported 1v1 "random match" game. The source ran this on
-- Firestore's free-form document model (private_rooms/{code} + message
-- subcollections). To keep the ported UI byte-faithful we emulate that document
-- model with one generic key/value table instead of reshaping the game logic.
--
-- Rooms are ephemeral and code-gated: two consenting players who share a room
-- code both read/write the same row. Rows carry no personal data beyond display
-- names and in-match state, so any signed-in user may read/write — the room code
-- is the capability. (Friend requests made from this screen go through the real
-- friend_requests table via socialService, NOT here.)

CREATE TABLE IF NOT EXISTS public.rm_docs (
  col        TEXT NOT NULL,               -- collection path, e.g. 'private_rooms' or 'private_rooms/ABC/messages'
  id         TEXT NOT NULL,               -- document id within the collection
  data       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (col, id)
);

CREATE INDEX IF NOT EXISTS rm_docs_col_idx ON public.rm_docs (col, created_at);

ALTER TABLE public.rm_docs ENABLE ROW LEVEL SECURITY;

-- Signed-in users may read/write match documents (the room code is the gate).
DROP POLICY IF EXISTS "rm_docs_all_authenticated" ON public.rm_docs;
CREATE POLICY "rm_docs_all_authenticated" ON public.rm_docs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Realtime so both players' clients see each other's writes.
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rm_docs;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
