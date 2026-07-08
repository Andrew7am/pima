-- ============================================================
-- HIGH security fix: stop owners from self-approving their house or
-- bypassing the admin edit-approval flow.
--
-- houses_update_owner (migration 001) lets an owner update their OWN
-- house with no column restriction, so an owner could open the console
-- and run
--   supabase.from('houses').update({ status: 'approved' }).eq('id', myHouse)
-- to publish without admin review, or write name/price/images/etc.
-- directly — completely bypassing the pending_edit → admin-approval flow
-- added in migration 014 (which is otherwise only enforced in the UI).
--
-- Fix: a BEFORE UPDATE trigger that, for direct owner updates
-- (current_user = 'authenticated', non-admin), reverts the whole row to
-- its previous state EXCEPT the three fields an owner is legitimately
-- allowed to change directly:
--   * pending_edit  — the owner's proposed listing changes (await admin)
--   * blocked_dates — occupancy calendar block/unblock (operational)
--   * menu          — weekly meal plan (operational)
-- Everything else — status (no self-approval), all listing content
-- (name, price, rooms, images, ...), rating/reviews_count — is locked.
-- Admins (is_admin) and trusted definer paths pass through untouched, so
-- admin approval of houses and edits keeps working.
--
-- No client change needed: the app already routes owner listing edits
-- through pending_edit and only ever sends blocked_dates/menu changes
-- directly, so legitimate owner actions are unaffected.
-- ============================================================

CREATE OR REPLACE FUNCTION public.protect_house_owner_updates()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  keep_pending  JSONB;
  keep_blocked  TEXT[];
  keep_menu     JSONB;
BEGIN
  IF current_user = 'authenticated' AND NOT public.is_admin(auth.uid()) THEN
    keep_pending := NEW.pending_edit;
    keep_blocked := NEW.blocked_dates;
    keep_menu    := NEW.menu;
    NEW := OLD;                       -- revert every column to its old value
    NEW.pending_edit  := keep_pending; -- then re-allow just these three
    NEW.blocked_dates := keep_blocked;
    NEW.menu          := keep_menu;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_house_owner_updates ON public.houses;
CREATE TRIGGER trg_protect_house_owner_updates
  BEFORE UPDATE ON public.houses
  FOR EACH ROW EXECUTE FUNCTION public.protect_house_owner_updates();
