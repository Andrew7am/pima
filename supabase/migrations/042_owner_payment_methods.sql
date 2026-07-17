-- ============================================================
-- Direct owner payment payout info, replacing the old centralized
-- platform InstaPay address that used to show on every booking
-- regardless of which house it was for (UserBookings.tsx). Each
-- house now carries its own list of ways to pay the owner directly
-- (InstaPay handle, mobile wallet number, bank transfer details...).
--
-- Also grants admin INSERT/DELETE on houses — admin already had free
-- UPDATE (014_house_edit_approval.sql, bypasses the owner-only
-- protect-trigger from 019) and full CRUD on rooms
-- (027_security_hardening.sql), but insert was owner-only and no
-- admin-delete policy existed, so admin couldn't add a house on an
-- owner's behalf or remove one outright.
-- ============================================================

ALTER TABLE public.houses
  ADD COLUMN IF NOT EXISTS payment_methods JSONB NOT NULL DEFAULT '[]';

DROP POLICY IF EXISTS "houses_insert_admin" ON public.houses;
CREATE POLICY "houses_insert_admin" ON public.houses FOR INSERT WITH CHECK (
  public.is_admin(auth.uid())
);

DROP POLICY IF EXISTS "houses_delete_admin" ON public.houses;
CREATE POLICY "houses_delete_admin" ON public.houses FOR DELETE USING (
  public.is_admin(auth.uid())
);

-- ============================================================
-- payment_methods joins the small set of columns an owner may update
-- directly (019_protect_house_owner_updates.sql), alongside
-- pending_edit/blocked_dates/menu — it's operational/financial info
-- the owner controls, not moderated listing content, so it shouldn't
-- need an admin re-approval cycle every time an owner updates their
-- InstaPay handle or adds a wallet number. Everything else an owner
-- sends in a direct UPDATE (name, price, images, services, ...) is
-- still reverted by the trigger and must go through pending_edit.
-- ============================================================
CREATE OR REPLACE FUNCTION public.protect_house_owner_updates()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  keep_pending  JSONB;
  keep_blocked  TEXT[];
  keep_menu     JSONB;
  keep_payment  JSONB;
BEGIN
  IF current_user = 'authenticated' AND NOT public.is_admin(auth.uid()) THEN
    keep_pending := NEW.pending_edit;
    keep_blocked := NEW.blocked_dates;
    keep_menu    := NEW.menu;
    keep_payment := NEW.payment_methods;
    NEW := OLD;                          -- revert every column to its old value
    NEW.pending_edit    := keep_pending; -- then re-allow just these four
    NEW.blocked_dates   := keep_blocked;
    NEW.menu            := keep_menu;
    NEW.payment_methods := keep_payment;
  END IF;
  RETURN NEW;
END;
$$;
