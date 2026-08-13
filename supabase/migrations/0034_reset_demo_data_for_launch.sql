-- ============================================================
-- ONE-TIME DATA RESET — NOT a schema migration, run once manually.
-- Wipes all demo/seed accounts and their data ahead of real launch
-- testing. Irreversible — do not re-run.
--
-- Kept:
--   admin@church.eg          (admin, unchanged)
--   andrewashrafff@gmail.com (promoted to admin below)
--   cycyxyxtd@gmail.com      (unchanged — real account for live testing)
--
-- Deleted (and everything that cascades from them — houses they own,
-- and every booking/review/payment/notification on those houses):
--   fady@gmail.com, mina@servant.org, church_admin@outlook.com,
--   owner@church.eg, shenouda@retreat.eg, referral.test.pima@gmail.com,
--   test.new.fields@gmail.com, boshkasaid2021@gmail.com,
--   beshoydieb@gmail.com, rkrym9533@gmail.com,
--   rls_test_booker_37686@gmail.com
--
-- After this runs: zero houses exist (all were owned by deleted demo
-- accounts) — a real owner account needs to add real houses next.
-- ============================================================

-- Promote the second admin
UPDATE public.users SET role = 'admin', approval_status = 'approved'
WHERE email = 'andrewashrafff@gmail.com';

-- Delete every other account. Cascades (ON DELETE CASCADE) clear:
--   public.users -> bookings, payments, reviews, notifications,
--   points_history, houses (if owner) -> that house's own
--   bookings/reviews/payments/rooms/announcements/waitlist too.
DELETE FROM auth.users WHERE email IN (
  'fady@gmail.com',
  'mina@servant.org',
  'church_admin@outlook.com',
  'owner@church.eg',
  'shenouda@retreat.eg',
  'referral.test.pima@gmail.com',
  'test.new.fields@gmail.com',
  'boshkasaid2021@gmail.com',
  'beshoydieb@gmail.com',
  'rkrym9533@gmail.com',
  'rls_test_booker_37686@gmail.com'
);

-- Historical noise from testing — irrelevant once the accounts/bookings
-- they refer to are gone.
TRUNCATE public.audit_log RESTART IDENTITY;

-- Demo promotional banner (was linked to a now-deleted demo house).
DELETE FROM public.platform_announcements;

-- Sanity check — run this after and confirm the numbers make sense.
SELECT
  (SELECT COUNT(*) FROM public.users)    AS remaining_users,
  (SELECT COUNT(*) FROM public.houses)   AS remaining_houses,
  (SELECT COUNT(*) FROM public.bookings) AS remaining_bookings,
  (SELECT COUNT(*) FROM public.reviews)  AS remaining_reviews,
  (SELECT COUNT(*) FROM public.payments) AS remaining_payments;
