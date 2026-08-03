-- ============================================================
-- Indexes. Run this in the Supabase SQL editor, NOT as a migration.
--
-- CREATE INDEX CONCURRENTLY cannot run inside a transaction block, and the
-- migration runner wraps each file in one. CONCURRENTLY is what makes these
-- safe to run against the live database: it builds the index without taking
-- a write lock, so bookings keep working while it runs. Dropping it to fit
-- the migration runner would lock the table instead — the opposite trade.
--
-- Every statement is IF NOT EXISTS, so re-running is free.
--
-- WHY: six tables in this schema currently have no index at all beyond their
-- primary key — houses, payments, points_history, rooms, announcements,
-- waitlist, owner_expenses. Every foreign key on them is unindexed, and every
-- RLS policy that filters on them is a sequential scan. None of that fails
-- loudly; it just gets slower every month until someone notices the app feels
-- broken.
--
-- Zero code changes. Nothing below alters behaviour — only how fast Postgres
-- reaches the same rows.
--
-- If any statement fails, CONCURRENTLY leaves an INVALID index behind rather
-- than rolling back. Find and drop those before retrying:
--   SELECT c.relname FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
--   WHERE NOT i.indisvalid;
--   DROP INDEX CONCURRENTLY <name>;
--
-- Afterwards, confirm it took:
--   SELECT tablename, indexname FROM pg_indexes
--   WHERE schemaname='public' AND indexname LIKE 'idx_%' ORDER BY tablename;
-- and spot-check the plan on the query with the widest reach:
--   EXPLAIN ANALYZE SELECT * FROM bookings WHERE user_id = '<some-uuid>';
-- ============================================================


-- ── houses ──────────────────────────────────────────────────────────────
-- owner_id backs eleven RLS policies (006, 015, 016, 026, 027, 045, 059,
-- 060) and get_owner_payment_methods, which runs on every owner and admin
-- login. status gates the public browse query and two RPCs (053, 086).
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_houses_owner_id
  ON public.houses (owner_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_houses_status_created
  ON public.houses (status, created_at) WHERE status = 'approved';

-- ── payments ────────────────────────────────────────────────────────────
-- Neither foreign key was indexed. booking_id also carries the ON DELETE
-- CASCADE, so deleting a booking sequentially scanned the whole table.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_booking_id
  ON public.payments (booking_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_user_id
  ON public.payments (user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_status_date
  ON public.payments (payment_status, payment_date DESC);

-- ── bookings ────────────────────────────────────────────────────────────
-- created_at is the sort key on every booking list and was unindexed.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_created_at
  ON public.bookings (created_at DESC);

-- The range index that migration 001 created and 003 dropped along with the
-- GIST exclusion constraint. check_booking_capacity has run without it ever
-- since, on every booking INSERT and UPDATE. btree_gist is already installed.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_house_range
  ON public.bookings USING GIST (house_id, daterange(check_in, check_out, '[)'))
  WHERE status IN ('pending', 'approved');

-- ── house-scoped tables ─────────────────────────────────────────────────
-- Opening any house detail page fires four queries against these, all
-- sequential scans today. reviews has only UNIQUE(user_id, house_id), so
-- house_id is not a leading column and cannot serve the lookup.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reviews_house_created
  ON public.reviews (house_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rooms_house_id
  ON public.rooms (house_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_announcements_house_id
  ON public.announcements (house_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_waitlist_house_id
  ON public.waitlist (house_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_waitlist_user_id
  ON public.waitlist (user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_owner_expenses_house_id
  ON public.owner_expenses (house_id);

-- ── notifications ───────────────────────────────────────────────────────
-- The existing index is on user_id alone, so Postgres fetched the user's
-- rows and then sorted all of them. Admins accumulate one notification per
-- payment per admin, so their list is the first to hurt.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_booking_id
  ON public.notifications (booking_id);

-- ── users / points ──────────────────────────────────────────────────────
-- notify_on_payment_insert loops over admins by role on every payment;
-- handle_new_user looks up referral_code on every signup; the daily-ad claim
-- scans points_history per user per day. All three were sequential scans.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role
  ON public.users (role) WHERE role = 'admin';
-- CHECK THIS ONE FIRST. referral_code is substr(md5(...), 1, 8) — 8 hex
-- characters, so collisions are possible, and a UNIQUE build that hits one
-- FAILS and leaves an INVALID index behind that you then have to drop by
-- hand. Run this first; only create the index if it returns no rows:
--
--   SELECT referral_code, count(*) FROM public.users
--   WHERE referral_code IS NOT NULL
--   GROUP BY referral_code HAVING count(*) > 1;
--
-- If it does return rows, use the non-unique form instead — the lookup speed
-- is the point here, not the constraint:
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_referral_code
--     ON public.users (referral_code);
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_users_referral_code
  ON public.users (referral_code);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_points_history_user_created
  ON public.points_history (user_id, created_at DESC);

-- ── room allocations ────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_room_allocations_attendee_id
  ON public.room_allocations (attendee_id);
