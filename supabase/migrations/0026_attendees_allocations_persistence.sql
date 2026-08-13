-- ============================================================
-- attendees / room_allocations were never written to Supabase at all —
-- the client kept them in localStorage only, so a house owner could never
-- see the attendee list or room assignments a booker entered (found during
-- the full-schema RLS/logic audit). This migration closes the RLS gap so
-- both sides — and admin, read-only, for the platform dashboard stat — can
-- actually read/write this data once the client starts persisting it.
--
-- Only SELECT/INSERT existed before (booker-only, migration 001). Adding:
--   - UPDATE/DELETE for the booker (editing/removing attendees & moves)
--   - SELECT/INSERT/UPDATE/DELETE for the house owner (via bookings→houses)
--   - SELECT for admin (matches the read-only platform stat in AdminDashboard)
-- ============================================================

-- ── attendees ──────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "attendees_update" ON public.attendees;
CREATE POLICY "attendees_update" ON public.attendees FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.user_id = auth.uid())
);

DROP POLICY IF EXISTS "attendees_delete" ON public.attendees;
CREATE POLICY "attendees_delete" ON public.attendees FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.user_id = auth.uid())
);

DROP POLICY IF EXISTS "attendees_select_owner" ON public.attendees;
CREATE POLICY "attendees_select_owner" ON public.attendees FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.bookings b JOIN public.houses h ON h.id = b.house_id
    WHERE b.id = booking_id AND h.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "attendees_insert_owner" ON public.attendees;
CREATE POLICY "attendees_insert_owner" ON public.attendees FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.bookings b JOIN public.houses h ON h.id = b.house_id
    WHERE b.id = booking_id AND h.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "attendees_update_owner" ON public.attendees;
CREATE POLICY "attendees_update_owner" ON public.attendees FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.bookings b JOIN public.houses h ON h.id = b.house_id
    WHERE b.id = booking_id AND h.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "attendees_delete_owner" ON public.attendees;
CREATE POLICY "attendees_delete_owner" ON public.attendees FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.bookings b JOIN public.houses h ON h.id = b.house_id
    WHERE b.id = booking_id AND h.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "attendees_select_admin" ON public.attendees;
CREATE POLICY "attendees_select_admin" ON public.attendees FOR SELECT USING (public.is_admin(auth.uid()));

-- ── room_allocations ───────────────────────────────────────────────────

DROP POLICY IF EXISTS "allocations_update" ON public.room_allocations;
CREATE POLICY "allocations_update" ON public.room_allocations FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.user_id = auth.uid())
);

DROP POLICY IF EXISTS "allocations_delete" ON public.room_allocations;
CREATE POLICY "allocations_delete" ON public.room_allocations FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.user_id = auth.uid())
);

DROP POLICY IF EXISTS "allocations_select_owner" ON public.room_allocations;
CREATE POLICY "allocations_select_owner" ON public.room_allocations FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.bookings b JOIN public.houses h ON h.id = b.house_id
    WHERE b.id = booking_id AND h.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "allocations_insert_owner" ON public.room_allocations;
CREATE POLICY "allocations_insert_owner" ON public.room_allocations FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.bookings b JOIN public.houses h ON h.id = b.house_id
    WHERE b.id = booking_id AND h.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "allocations_update_owner" ON public.room_allocations;
CREATE POLICY "allocations_update_owner" ON public.room_allocations FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.bookings b JOIN public.houses h ON h.id = b.house_id
    WHERE b.id = booking_id AND h.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "allocations_delete_owner" ON public.room_allocations;
CREATE POLICY "allocations_delete_owner" ON public.room_allocations FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.bookings b JOIN public.houses h ON h.id = b.house_id
    WHERE b.id = booking_id AND h.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "allocations_select_admin" ON public.room_allocations;
CREATE POLICY "allocations_select_admin" ON public.room_allocations FOR SELECT USING (public.is_admin(auth.uid()));
