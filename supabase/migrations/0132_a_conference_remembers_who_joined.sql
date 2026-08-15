-- ============================================================
-- Two columns 121 left out
--
-- ConferenceRoom carries joinedUserIds and notificationsLog. I wrote 121 from
-- the fields I could see in one screen of the interface and missed both; the
-- type checker found them the moment the mapper was written.
--
-- joinedUserIds is the one that matters. It is the list of people actually in
-- the conference — without it the room could be created and shared, and then
-- forget everyone who walked in the moment the tab closed, which is the exact
-- failure 121 was written to end.
-- ============================================================

ALTER TABLE public.conferences
  ADD COLUMN IF NOT EXISTS joined_user_ids    JSONB NOT NULL DEFAULT '[]'::JSONB,
  ADD COLUMN IF NOT EXISTS notifications_log  JSONB NOT NULL DEFAULT '[]'::JSONB;

COMMENT ON COLUMN public.conferences.joined_user_ids IS
  'Who is in the room. JSONB rather than UUID[] to match the shape the hub '
  'already reads and writes, and because these are app user ids the hub owns, '
  'not a relation anything joins on.';
