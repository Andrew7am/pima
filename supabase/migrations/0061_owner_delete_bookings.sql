-- ============================================================
-- Let owners hard-delete bookings — but only the safe ones. Guest
-- (platform) bookings that are still live keep the existing soft-cancel
-- flow (status='rejected') to preserve the audit/financial trail; this
-- policy only permits deleting the owner's OWN house rows that are either
-- owner-created (manual walk-in / temporary hold) OR already terminal
-- (cancelled / rejected). Admin delete (migration 025) is unchanged.
-- Related attendees / allocations / messages / payments cascade away.
-- ============================================================

DROP POLICY IF EXISTS "bookings_delete_owner" ON public.bookings;
CREATE POLICY "bookings_delete_owner" ON public.bookings
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.houses h WHERE h.id = house_id AND h.owner_id = auth.uid())
    AND (
      source IN ('manual', 'temporary')
      OR status IN ('cancelled', 'rejected')
    )
  );
