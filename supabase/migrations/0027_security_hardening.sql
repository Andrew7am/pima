-- ============================================================
-- Security hardening pass (full-system logic audit).
--
-- (A) CRITICAL — bookings had NO column-level protection. RLS
--     "bookings_update_user" (migration 001) lets a guest UPDATE their own
--     booking row with no column restriction and there was no BEFORE-UPDATE
--     guard, so from the browser console a guest could:
--        supabase.from('bookings').update({ payment_status: 'paid_full' })
--     which fires trg_award_booking_points (005) and credits loyalty points
--     for money never paid — and flips the booking to a confirmed-looking
--     state the owner never approved. They could likewise self-set
--     status='approved'/'completed' or checked_in/out. Fix mirrors the
--     house/user column guards (017/019): a BEFORE INSERT/UPDATE trigger that
--     lets only the house owner, an admin, or a SECURITY DEFINER function
--     (current_user <> 'authenticated') touch privileged columns. The guest
--     may only push payment_status to 'pending_verification' (submitting
--     proof); the owner/admin confirmation path is unchanged.
--
-- (B) MEDIUM — review points farming. award_review_points (005) grants 500
--     points per review row and reviews has no uniqueness, so a guest with a
--     single approved booking could INSERT unlimited reviews for that house
--     and farm points. Guard the award to once per (user, house).
--
-- (C) LOW — points_history had a client INSERT policy ("points_insert_own"),
--     letting a user fabricate their own history rows. Nothing in the client
--     inserts here (all point rows come from SECURITY DEFINER triggers/RPCs),
--     so the policy is pure attack surface — drop it.
--
-- (D) LOW — admin moderation gaps: rooms / announcements / waitlist had no
--     admin override, and announcements/waitlist had no DELETE at all. Add
--     admin ALL + the missing owner DELETE so the admin can genuinely act on
--     anything and owners can remove their own rows.
-- ============================================================

-- ── (A) Booking privileged-column guard ────────────────────────────────
CREATE OR REPLACE FUNCTION public.protect_booking_privileged_columns()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  is_house_owner BOOLEAN;
BEGIN
  -- SECURITY DEFINER functions (triggers/RPCs) and the service role run as a
  -- role other than 'authenticated' — trust them.
  IF current_user <> 'authenticated' THEN
    RETURN NEW;
  END IF;

  -- The house owner and platform admins may set any status/payment field.
  is_house_owner := EXISTS (
    SELECT 1 FROM public.houses h WHERE h.id = NEW.house_id AND h.owner_id = auth.uid()
  );
  IF public.is_admin(auth.uid()) OR is_house_owner THEN
    RETURN NEW;
  END IF;

  -- Otherwise the actor is the booking's own guest (RLS already pins
  -- auth.uid() = user_id for guest insert/update).
  IF TG_OP = 'INSERT' THEN
    -- A newly created booking always starts pending & unpaid, no matter what
    -- the client sent.
    NEW.status                   := 'pending';
    NEW.payment_status           := 'unpaid';
    NEW.deposit_paid             := FALSE;
    NEW.checked_in_at            := NULL;
    NEW.checked_out_at           := NULL;
    NEW.points_awarded_for_amount := 0;
    RETURN NEW;
  END IF;

  -- UPDATE by the guest: revert every privileged column, but allow pushing
  -- payment_status to 'pending_verification' (uploading proof of a transfer).
  NEW.status                    := OLD.status;
  NEW.deposit_paid              := OLD.deposit_paid;
  NEW.checked_in_at             := OLD.checked_in_at;
  NEW.checked_out_at            := OLD.checked_out_at;
  NEW.points_awarded_for_amount := OLD.points_awarded_for_amount;

  IF NEW.payment_status IS DISTINCT FROM OLD.payment_status
     AND NEW.payment_status <> 'pending_verification' THEN
    NEW.payment_status := OLD.payment_status;
  END IF;

  RETURN NEW;
END;
$$;

-- Name sorts before bk_validate_price, enforce_booking_capacity and
-- trg_award_booking_points, so payment_status is corrected before points are
-- computed from it.
DROP TRIGGER IF EXISTS bk_protect_columns ON public.bookings;
CREATE TRIGGER bk_protect_columns
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.protect_booking_privileged_columns();

-- ── (B) One review-points award per (user, house) ──────────────────────
CREATE OR REPLACE FUNCTION public.award_review_points()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT COALESCE(NEW.points_awarded, FALSE)
     AND NOT EXISTS (
       SELECT 1 FROM public.reviews r
       WHERE r.user_id = NEW.user_id
         AND r.house_id = NEW.house_id
         AND r.points_awarded = TRUE
     ) THEN
    UPDATE public.users SET points = points + 500 WHERE id = NEW.user_id;
    INSERT INTO public.points_history (id, user_id, amount, description, type)
    VALUES (
      'pt_review_' || NEW.id, NEW.user_id, 500,
      'نقاط مكتسبة من تقييم بيت "' || COALESCE(NEW.house_name, '') || '"',
      'earned'
    );
    NEW.points_awarded := TRUE;
  END IF;
  RETURN NEW;
END;
$$;
-- trigger from migration 005 already points at this function; no re-create needed.

-- ── (C) Remove the client points_history INSERT policy ─────────────────
DROP POLICY IF EXISTS "points_insert_own" ON public.points_history;

-- ── (D) Admin moderation + missing owner DELETE ────────────────────────
-- rooms
DROP POLICY IF EXISTS "rooms_all_admin" ON public.rooms;
CREATE POLICY "rooms_all_admin" ON public.rooms
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- announcements (per-house) — add admin ALL and owner DELETE
DROP POLICY IF EXISTS "announcements_all_admin" ON public.announcements;
CREATE POLICY "announcements_all_admin" ON public.announcements
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "announcements_delete_owner" ON public.announcements;
CREATE POLICY "announcements_delete_owner" ON public.announcements FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.houses h WHERE h.id = house_id AND h.owner_id = auth.uid())
);

-- waitlist — add admin ALL
DROP POLICY IF EXISTS "waitlist_all_admin" ON public.waitlist;
CREATE POLICY "waitlist_all_admin" ON public.waitlist
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
