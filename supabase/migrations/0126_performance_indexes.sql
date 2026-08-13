-- Performance indexes, moved into the migration path.
--
-- These lived only in supabase/indexes.sql, whose header said "paste the whole
-- file into the Supabase SQL editor and run once". That made them a MANUAL
-- step: production has them, but a freshly provisioned database created with
-- `supabase db reset` came up without any of them. Schema comparison after the
-- 0001-0125 renumbering found exactly 19 such indexes missing from a clean
-- database — on the hot paths (bookings by house/date-range, payments by
-- booking/user/status, notifications by user, users by role).
--
-- Every statement below is IF NOT EXISTS, so applying this to an environment
-- that already ran indexes.sql by hand is a no-op. No CONCURRENTLY, for the
-- reason the original file documents: it cannot run inside the transaction
-- block that both the SQL editor and the migration runner wrap around it.


-- ── houses ──────────────────────────────────────────────────────────────
-- owner_id backs eleven RLS policies (006, 015, 016, 026, 027, 045, 059,
-- 060) and get_owner_payment_methods, which runs on every owner and admin
-- login. status gates the public browse query and two RPCs (053, 086).
CREATE INDEX IF NOT EXISTS idx_houses_owner_id
  ON public.houses (owner_id);
CREATE INDEX IF NOT EXISTS idx_houses_status_created
  ON public.houses (status, created_at) WHERE status = 'approved';

-- ── payments ────────────────────────────────────────────────────────────
-- Neither foreign key was indexed. booking_id also carries the ON DELETE
-- CASCADE, so deleting a booking sequentially scanned the whole table.
CREATE INDEX IF NOT EXISTS idx_payments_booking_id
  ON public.payments (booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id
  ON public.payments (user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status_date
  ON public.payments (payment_status, payment_date DESC);

-- ── bookings ────────────────────────────────────────────────────────────
-- created_at is the sort key on every booking list and was unindexed.
CREATE INDEX IF NOT EXISTS idx_bookings_created_at
  ON public.bookings (created_at DESC);

-- The range index that migration 001 created and 003 dropped along with the
-- GIST exclusion constraint. check_booking_capacity has run without it ever
-- since, on every booking INSERT and UPDATE. btree_gist is already installed.
CREATE INDEX IF NOT EXISTS idx_bookings_house_range
  ON public.bookings USING GIST (house_id, daterange(check_in, check_out, '[)'))
  WHERE status IN ('pending', 'approved');

-- ── house-scoped tables ─────────────────────────────────────────────────
-- Opening any house detail page fires four queries against these, all
-- sequential scans today. reviews has only UNIQUE(user_id, house_id), so
-- house_id is not a leading column and cannot serve the lookup.
CREATE INDEX IF NOT EXISTS idx_reviews_house_created
  ON public.reviews (house_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rooms_house_id
  ON public.rooms (house_id);
CREATE INDEX IF NOT EXISTS idx_announcements_house_id
  ON public.announcements (house_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_house_id
  ON public.waitlist (house_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_user_id
  ON public.waitlist (user_id);
CREATE INDEX IF NOT EXISTS idx_owner_expenses_house_id
  ON public.owner_expenses (house_id);

-- ── notifications ───────────────────────────────────────────────────────
-- The existing index is on user_id alone, so Postgres fetched the user's
-- rows and then sorted all of them. Admins accumulate one notification per
-- payment per admin, so their list is the first to hurt.
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_booking_id
  ON public.notifications (booking_id);

-- ── users / points ──────────────────────────────────────────────────────
-- notify_on_payment_insert loops over admins by role on every payment;
-- handle_new_user looks up referral_code on every signup; the daily-ad claim
-- scans points_history per user per day. All three were sequential scans.
CREATE INDEX IF NOT EXISTS idx_users_role
  ON public.users (role) WHERE role = 'admin';
CREATE INDEX IF NOT EXISTS idx_points_history_user_created
  ON public.points_history (user_id, created_at DESC);

-- referral_code is substr(md5(...), 1, 8) — 8 hex characters, so two users
-- CAN collide. A plain index is all that is needed for the lookup speed,
-- which is the point here; a UNIQUE one would additionally enforce something
-- the generator does not guarantee, and would fail on existing duplicates.
CREATE INDEX IF NOT EXISTS idx_users_referral_code
  ON public.users (referral_code);

-- ── room allocations ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_room_allocations_attendee_id
  ON public.room_allocations (attendee_id);


-- ── Confirm ─────────────────────────────────────────────────────────────
-- Checks for exactly the 19 indexes this file creates, and names any that
-- did not land. A bare `LIKE 'idx_%'` listing is not the check: earlier
-- migrations already created their own idx_* indexes, so the total is larger
-- and tells you nothing about whether THIS file worked.
WITH wanted(n) AS (VALUES
  ('idx_houses_owner_id'), ('idx_houses_status_created'),
  ('idx_payments_booking_id'), ('idx_payments_user_id'), ('idx_payments_status_date'),
  ('idx_bookings_created_at'), ('idx_bookings_house_range'),
  ('idx_reviews_house_created'), ('idx_rooms_house_id'), ('idx_announcements_house_id'),
  ('idx_waitlist_house_id'), ('idx_waitlist_user_id'), ('idx_owner_expenses_house_id'),
  ('idx_notifications_user_created'), ('idx_notifications_booking_id'),
  ('idx_users_role'), ('idx_points_history_user_created'), ('idx_users_referral_code'),
  ('idx_room_allocations_attendee_id')
)
SELECT
  w.n AS index_name,
  CASE WHEN i.indexname IS NULL THEN '✗ MISSING' ELSE '✓' END AS status
FROM wanted w
LEFT JOIN pg_indexes i ON i.indexname = w.n AND i.schemaname = 'public'
ORDER BY (i.indexname IS NOT NULL), w.n;
