-- ============================================================
-- Bookings had only a booker-scoped SELECT/UPDATE policy
-- (auth.uid() = user_id) — meaning a house owner could never see or
-- approve/reject/check-in a booking made by someone else for their
-- own house, and admin couldn't see or manage any booking at all.
-- This is the same gap already fixed for users (009) and houses (014).
-- ============================================================

CREATE POLICY "bookings_select_owner" ON public.bookings FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.houses h WHERE h.id = house_id AND h.owner_id = auth.uid())
);
CREATE POLICY "bookings_update_owner" ON public.bookings FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.houses h WHERE h.id = house_id AND h.owner_id = auth.uid())
);

CREATE POLICY "bookings_select_admin" ON public.bookings FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "bookings_update_admin" ON public.bookings FOR UPDATE USING (public.is_admin(auth.uid()));
