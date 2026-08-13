-- ============================================================
-- Allow owners to delete their own house. Bookings, rooms,
-- per-house announcements, and waitlist entries all cascade via
-- ON DELETE CASCADE (migrations 001, 006); platform_announcements
-- referencing it fall back to NULL (migration 010).
-- ============================================================

CREATE POLICY "houses_delete_owner" ON public.houses FOR DELETE USING (auth.uid() = owner_id);
