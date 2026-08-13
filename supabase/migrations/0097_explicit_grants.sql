-- ============================================================
-- The privilege layer this repo never had.
--
-- Not one migration in 001..096 grants SELECT / INSERT / UPDATE / DELETE on
-- any application table to anon or authenticated. The live project works
-- because IT supplies those grants out of band, through the default
-- privileges its own bootstrap installed — nothing in this repository asks
-- for them.
--
-- That only shows up when you rebuild the schema somewhere else. On the
-- Supabase CLI stack the two default-privilege sets differ:
--
--   FOR ROLE supabase_admin  →  anon/authenticated get arwdDxtm  (full DML)
--   FOR ROLE postgres        →  anon/authenticated get Dxtm      (no DML)
--
-- Migrations run as postgres, so every table this repo creates lands with
-- TRUNCATE/REFERENCES/TRIGGER and nothing else. A database built purely from
-- these files cannot serve a single read or write: no guest can list houses
-- or create a booking, no owner can add a house. Verified on a from-scratch
-- rebuild — public.notifications, which no migration mentions in a GRANT,
-- comes out as anon=Dxtm just like the rest.
--
-- So the repo has not been a complete description of the database. This makes
-- it one, which matters for exactly the cases where it counts: restoring from
-- backup, standing up a staging project, onboarding a second developer.
--
-- Applying this to the live project is a no-op where the grant already
-- exists — GRANT is idempotent.
--
-- RLS is unaffected and remains the real access control. These grants only
-- let a role reach the table at all; every policy still decides which rows.
-- Tables with RLS enabled and no policy stay closed, as before.
-- ============================================================


-- ── Reach the schema ────────────────────────────────────────────────────
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;


-- ── Existing objects ────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES    IN SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE, SELECT                  ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT EXECUTE                        ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;


-- ── Anything added later ────────────────────────────────────────────────
-- Without this, the next CREATE TABLE reintroduces the same hole.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;


-- ── Re-narrow what 096 deliberately narrowed ────────────────────────────
-- GRANT SELECT ON ALL TABLES above just handed back the blanket grant on
-- public.houses that migration 096 removed on purpose, which would re-expose
-- the owner's payment_methods column to every visitor. Repeat 096's surgery
-- so the two migrations compose instead of fighting: no table-level SELECT,
-- column-level SELECT on everything except payment_methods.
DO $$
DECLARE cols TEXT;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'houses'
    AND column_name <> 'payment_methods';

  IF cols IS NULL THEN
    RAISE EXCEPTION 'public.houses not found — refusing to change grants';
  END IF;

  EXECUTE 'REVOKE SELECT ON public.houses FROM anon, authenticated';
  EXECUTE format('GRANT SELECT (%s) ON public.houses TO anon, authenticated', cols);
END $$;

REVOKE SELECT (payment_methods) ON public.houses FROM anon, authenticated;

-- 095 hides this one from clients on purpose (email recipient lookup is for
-- the edge function, via service_role only). GRANT ON ALL FUNCTIONS above
-- undid that; put it back.
REVOKE ALL ON FUNCTION public.get_email_recipient(UUID) FROM PUBLIC, anon, authenticated;
