-- ============================================================
-- (A) UNIQUE constraint on reviews: one review per (user, house).
--     Removes duplicates first (keeps the latest), then adds
--     a unique index. The client should upsert on conflict.
--
-- (B) Allow guests to cancel their own pending bookings.
--     The column guard trigger (027) currently reverts ALL status
--     changes by the guest. Amend it so a guest may set status to
--     'cancelled' when the current status is 'pending'.
-- ============================================================

-- ── (A) Deduplicate reviews, then add unique constraint ───────

-- Keep only the most recent review per (user_id, house_id)
DELETE FROM public.reviews r
WHERE r.id <> (
  SELECT r2.id FROM public.reviews r2
  WHERE r2.user_id = r.user_id AND r2.house_id = r.house_id
  ORDER BY r2.created_at DESC NULLS LAST
  LIMIT 1
);

DROP INDEX IF EXISTS idx_reviews_user_house_unique;
CREATE UNIQUE INDEX idx_reviews_user_house_unique
  ON public.reviews (user_id, house_id);

-- ── (B) Allow 'cancelled' in the bookings status check constraint ─
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'cancelled'));

-- ── (B) Amend booking column guard: allow guest self-cancel ───

CREATE OR REPLACE FUNCTION public.protect_booking_privileged_columns()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  is_house_owner BOOLEAN;
BEGIN
  IF current_user <> 'authenticated' THEN
    RETURN NEW;
  END IF;

  is_house_owner := EXISTS (
    SELECT 1 FROM public.houses h WHERE h.id = NEW.house_id AND h.owner_id = auth.uid()
  );
  IF public.is_admin(auth.uid()) OR is_house_owner THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.status                   := 'pending';
    NEW.payment_status           := 'unpaid';
    NEW.deposit_paid             := FALSE;
    NEW.checked_in_at            := NULL;
    NEW.checked_out_at           := NULL;
    NEW.points_awarded_for_amount := 0;
    RETURN NEW;
  END IF;

  -- UPDATE by the guest: revert privileged columns, EXCEPT allow
  -- self-cancel from 'pending' only.
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'cancelled' AND OLD.status = 'pending' THEN
      -- allowed: guest cancelling their own pending booking
      NULL;
    ELSE
      NEW.status := OLD.status;
    END IF;
  END IF;

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
