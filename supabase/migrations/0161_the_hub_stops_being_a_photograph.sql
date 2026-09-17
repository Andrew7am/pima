-- ============================================================
-- The hub stops being a photograph
--
-- Two findings, and the second is the larger one.
--
-- 1. THE SLIDES WERE NEVER SAVED. presentationSlides and activeSlideId are in
--    the TypeScript type and used in 38 places in the hub — a whole
--    presentation the servant can build, advance and project. There has never
--    been a column for either, and the row mapper never carried them. The deck
--    lived in the tab it was typed into. Same shape as instantAlert (0160) and
--    notifications_log before it: a field the type knew about and the database
--    did not.
--
-- 2. NOTHING EVER REFRESHED. The hub reads the conference once, when the
--    screen opens, and never again — there is no subscription anywhere in the
--    client. So a servant publishes an announcement, adds a session to the
--    schedule, advances a slide, and a participant sitting on the screen sees
--    none of it, ever, until they leave and come back. That is the whole of
--    «حاجات كتير مش بتوصل عند المشتركين»: most of it did save, and none of it
--    arrived.
--
--    conferences was never added to the realtime publication. It is now.
--
-- REPLICA IDENTITY FULL, for the reason 0154 documents at length: schedule,
-- announcements and presentation_slides are large JSONB and get TOASTed, and
-- under the default identity Postgres omits unchanged TOASTed columns from an
-- UPDATE payload. A frame saying «the slide advanced» would arrive carrying no
-- slides — and a client that trusted it would blank the deck it was showing.
-- The client merges rather than replaces as well; both, deliberately.
-- ============================================================

ALTER TABLE public.conferences
  ADD COLUMN IF NOT EXISTS presentation_slides JSONB NOT NULL DEFAULT '[]'::JSONB,
  ADD COLUMN IF NOT EXISTS active_slide_id     TEXT;

COMMENT ON COLUMN public.conferences.presentation_slides IS
  'The servant''s deck. Used in 38 places in the hub and saved in none of them '
  'until now.';
COMMENT ON COLUMN public.conferences.active_slide_id IS
  'Which slide is up. Replicated so a participant follows the projector rather '
  'than scrolling their own copy.';

ALTER TABLE public.conferences REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND schemaname = 'public'
       AND tablename = 'conferences'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conferences;
  END IF;
END $$;
