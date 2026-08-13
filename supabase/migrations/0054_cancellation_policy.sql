-- ============================================================
-- Declared cancellation & refund policy. Until now the platform had no
-- stated policy at all — the first real money dispute would have been
-- settled by phone calls and goodwill. Two parts:
--
-- (1) Admin-configurable policy knobs on platform_settings:
--     - free cancel  : full refund when cancelling >= free_cancel_days
--                      before check-in (default 7)
--     - partial      : partial_refund_pct of what was paid when
--                      cancelling >= partial_refund_days (default 3 → 50%)
--     - otherwise    : no refund
--     (Refund execution stays manual — payments are direct owner
--     transfers — the platform's job is declaring and computing.)
--
-- (2) Guests can now also self-cancel an APPROVED booking, not just a
--     pending one (the column-guard trigger from 027/028 reverted the
--     status change). A declared refund policy is meaningless if the
--     guest can't actually cancel once the owner has approved. The
--     migration-047 status-change trigger already notifies the owner.
-- ============================================================

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS free_cancel_days    INTEGER NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS partial_refund_days INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS partial_refund_pct  NUMERIC NOT NULL DEFAULT 0.5;

-- Same function as migration 028, with ONE change: self-cancel is now
-- allowed from 'approved' as well as 'pending'.
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
  -- self-cancel from 'pending' or 'approved' (cancellation policy).
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'cancelled' AND OLD.status IN ('pending', 'approved') THEN
      -- allowed: guest cancelling their own booking
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
