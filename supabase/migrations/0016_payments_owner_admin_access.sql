-- ============================================================
-- Payments had only a submitter-scoped SELECT/INSERT policy
-- (auth.uid() = user_id) — meaning a house owner could never see
-- payment proofs for bookings on their own house, and admin couldn't
-- see or verify (approve/reject) any payment at all. This left the
-- admin "payment review" tab non-functional against the live database.
-- Same gap already fixed for users (009), houses (014), bookings (015).
-- ============================================================

CREATE POLICY "payments_select_owner" ON public.payments FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.bookings b
    JOIN public.houses h ON h.id = b.house_id
    WHERE b.id = booking_id AND h.owner_id = auth.uid()
  )
);

CREATE POLICY "payments_select_admin" ON public.payments FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "payments_update_admin" ON public.payments FOR UPDATE USING (public.is_admin(auth.uid()));
