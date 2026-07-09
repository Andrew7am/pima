-- ============================================================
-- bookings had no DELETE policy at all (not even for admin) — found
-- while cleaning up a test row during the phase-3 settings review.
-- Admin "cancel booking" (migration 023) intentionally soft-cancels via
-- status='rejected' to preserve the audit trail; this adds true delete
-- as an admin-only escape hatch for mistaken/test/spam rows.
-- ============================================================

DROP POLICY IF EXISTS "bookings_delete_admin" ON public.bookings;
CREATE POLICY "bookings_delete_admin" ON public.bookings
  FOR DELETE USING (public.is_admin(auth.uid()));
