-- ============================================================
-- Owner edits to an already-approved house (price, rooms, photos,
-- etc.) now wait for admin approval instead of applying immediately.
-- The proposed changes are staged in pending_edit and merged into the
-- real columns only when the admin approves.
-- ============================================================

ALTER TABLE public.houses
  ADD COLUMN IF NOT EXISTS pending_edit JSONB;

-- Admin previously had no SELECT/UPDATE policy on houses at all, so a
-- pending house owned by someone else (or a pending edit) would never
-- have been visible/approvable. Add the missing admin access, mirroring
-- the is_admin() pattern from migration 009.
CREATE POLICY "houses_select_admin" ON public.houses FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "houses_update_admin" ON public.houses FOR UPDATE USING (public.is_admin(auth.uid()));
