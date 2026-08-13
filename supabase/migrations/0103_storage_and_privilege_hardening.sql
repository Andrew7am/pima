-- Two holes that RLS does not cover.
--
-- ── 1. Every size limit in this app lives in the browser ────────────
--
-- DepositPayment refuses a file over 10 MB, attachments.ts over 3 MB, and
-- storage.ts downscales photos to 1600px before upload. None of that binds
-- anyone: the REST API takes whatever is sent. Verified against a local stack —
-- a signed-in guest PATCHed a 12 MB string into their own users.avatar_url and
-- got HTTP 204, and the row came back 12,582,934 bytes. RLS said yes, because
-- RLS decides *which rows* you may touch, never *how big* they may be.
--
-- Repeat that across accounts and the database fills up; worse, every client
-- that reads the row then downloads it, and an oversized row also blows past
-- Supabase Realtime's per-change payload limit, so the broadcast silently drops.
--
-- The caps below sit above what the app itself can produce, so nothing a real
-- user does is rejected:
--
--   payments.proof_image     20 MB   client allows a 10 MB file → ~13.7 MB base64
--   booking_messages         6 MB    client allows 3 MB → ~4.1 MB base64
--   users / participant_cards 3 MB   avatars are compressed thumbnails
--   houses / rooms images    3 MB per image, 40 images   normally a short
--                                    Storage URL; base64 only on the fallback path
--   banners / announcements  8 MB    2200px hero artwork at quality 0.88
--
-- Every constraint is NOT VALID: it binds every INSERT and UPDATE from now on,
-- but does not re-check rows that already exist. Production may well hold a row
-- from before Storage existed, and a migration that refuses to apply — or worse,
-- one that makes an existing booking un-editable — is not a security fix.
--
-- ── 2. anon and authenticated hold TRUNCATE, TRIGGER and REFERENCES ─
--
-- On all 32 public tables, from Supabase's default GRANT ALL. RLS does not
-- gate TRUNCATE — it is a table-level operation, so a single statement would
-- empty a table no matter what the policies say.
--
-- In practice this is not reachable today: both roles are NOLOGIN and are only
-- ever assumed by PostgREST, which never issues DDL or TRUNCATE, and neither
-- role has CREATE on the schema (checked). So this is defence in depth, not an
-- open door — but it costs one statement to close, and it removes the
-- possibility that some future RPC or SECURITY INVOKER function hands it out
-- by accident.
--
-- SELECT/INSERT/UPDATE/DELETE are deliberately left alone: RLS needs them
-- granted in order to have anything to filter.

-- ── Size caps ───────────────────────────────────────────────────────
-- Every ADD is preceded by a DROP IF EXISTS so the file can be re-run — a
-- half-applied migration is otherwise impossible to finish.

-- An array needs two limits: per image, and how many. Forty 3 MB images is
-- still 120 MB in one row. A CHECK cannot contain a subquery, so the unnest
-- lives in an IMMUTABLE function and the constraint just calls it.
CREATE OR REPLACE FUNCTION public.images_within_limits(imgs TEXT[], max_count INT, max_each INT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT imgs IS NULL
      OR (COALESCE(array_length(imgs, 1), 0) <= max_count
          AND COALESCE((SELECT max(char_length(i)) FROM unnest(imgs) AS i), 0) <= max_each)
$$;

COMMENT ON FUNCTION public.images_within_limits(TEXT[], INT, INT) IS
  'True when an image array is within its count and per-image byte limits.';

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_proof_image_len;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_proof_image_len
  CHECK (proof_image IS NULL OR char_length(proof_image) <= 20971520) NOT VALID;

ALTER TABLE public.booking_messages DROP CONSTRAINT IF EXISTS booking_messages_attachment_url_len;
ALTER TABLE public.booking_messages
  ADD CONSTRAINT booking_messages_attachment_url_len
  CHECK (attachment_url IS NULL OR char_length(attachment_url) <= 6291456) NOT VALID;

ALTER TABLE public.booking_messages DROP CONSTRAINT IF EXISTS booking_messages_attachment_name_len;
ALTER TABLE public.booking_messages
  ADD CONSTRAINT booking_messages_attachment_name_len
  CHECK (attachment_name IS NULL OR char_length(attachment_name) <= 300) NOT VALID;

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_avatar_url_len;
ALTER TABLE public.users
  ADD CONSTRAINT users_avatar_url_len
  CHECK (avatar_url IS NULL OR char_length(avatar_url) <= 3145728) NOT VALID;

ALTER TABLE public.participant_cards DROP CONSTRAINT IF EXISTS participant_cards_avatar_url_len;
ALTER TABLE public.participant_cards
  ADD CONSTRAINT participant_cards_avatar_url_len
  CHECK (avatar_url IS NULL OR char_length(avatar_url) <= 3145728) NOT VALID;

ALTER TABLE public.houses DROP CONSTRAINT IF EXISTS houses_images_size;
ALTER TABLE public.houses
  ADD CONSTRAINT houses_images_size
  CHECK (public.images_within_limits(images, 40, 3145728)) NOT VALID;

ALTER TABLE public.rooms DROP CONSTRAINT IF EXISTS rooms_images_size;
ALTER TABLE public.rooms
  ADD CONSTRAINT rooms_images_size
  CHECK (public.images_within_limits(images, 20, 3145728)) NOT VALID;

ALTER TABLE public.promo_banners DROP CONSTRAINT IF EXISTS promo_banners_image_url_len;
ALTER TABLE public.promo_banners
  ADD CONSTRAINT promo_banners_image_url_len
  CHECK (image_url IS NULL OR char_length(image_url) <= 8388608) NOT VALID;

ALTER TABLE public.platform_announcements DROP CONSTRAINT IF EXISTS platform_announcements_image_url_len;
ALTER TABLE public.platform_announcements
  ADD CONSTRAINT platform_announcements_image_url_len
  CHECK (image_url IS NULL OR char_length(image_url) <= 8388608) NOT VALID;

-- ── Privileges nobody uses ──────────────────────────────────────────

DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
  LOOP
    EXECUTE format(
      'REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.%I FROM anon, authenticated',
      t.relname);
  END LOOP;
END $$;

-- And for anything created from here on, so this does not have to be
-- remembered with every new table.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLES FROM anon, authenticated;

-- ── Verification ────────────────────────────────────────────────────
-- Proves the caps actually bite, rather than reporting a green run over a
-- constraint that was written wrong.

DO $$
DECLARE
  leftover INT;
  blocked  BOOLEAN := FALSE;
BEGIN
  SELECT count(*) INTO leftover
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND grantee IN ('anon', 'authenticated')
    AND privilege_type IN ('TRUNCATE', 'TRIGGER', 'REFERENCES');

  IF leftover > 0 THEN
    RAISE EXCEPTION '% TRUNCATE/TRIGGER/REFERENCES grant(s) still in place', leftover;
  END IF;

  -- An oversized avatar must now be refused. Done inside a savepoint so the
  -- probe never leaves a row behind.
  BEGIN
    UPDATE public.users
       SET avatar_url = repeat('A', 4000000)
     WHERE id = (SELECT id FROM public.users LIMIT 1);
    RAISE EXCEPTION 'size cap did not fire';
  EXCEPTION
    WHEN check_violation THEN blocked := TRUE;
    WHEN no_data_found THEN blocked := TRUE;   -- empty table: nothing to probe
  END;

  IF NOT blocked AND EXISTS (SELECT 1 FROM public.users) THEN
    RAISE EXCEPTION 'users.avatar_url accepted 4 MB — the cap is not working';
  END IF;

  RAISE NOTICE 'OK — size caps enforced, TRUNCATE/TRIGGER/REFERENCES revoked';
END $$;
