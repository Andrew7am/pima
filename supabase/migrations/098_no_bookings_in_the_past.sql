-- ============================================================
-- A booking cannot start in the past.
--
-- Nothing in this schema looks at the calendar. validate_booking_price checks
-- the money, check_booking_capacity checks the beds, the column guards check
-- who is writing — none of them asks whether the dates have already gone.
--
-- That was not theoretical: the booking form shipped with check-in hardcoded
-- to 2026-07-15, so from August onwards every visitor who did not change the
-- dates submitted a request for a month that was over, and the database took
-- it. Verified end to end against a local stack before this migration: the
-- row was created, dated three weeks in the past, with no complaint.
--
-- The client now defaults to a future window and greys out past days, but a
-- date rule that lives only in the client is not a rule. This is the backstop.
--
-- Deliberately INSERT-only, and deliberately check_in rather than check_out:
--
--   * On UPDATE the rule would make history uneditable — an owner could not
--     add a note to last month's booking, or mark a stay completed after the
--     fact, which are both normal things to do.
--   * check_out is not the constraint. A stay that started yesterday and ends
--     tomorrow is a booking in progress, not a booking in the past; blocking
--     on check_out would refuse it.
--
-- One day of slack: the guest's clock, the browser's timezone and the
-- server's are three different things, and Cairo runs UTC+2/+3. Refusing
-- anything before yesterday keeps a booking made at 00:30 Cairo time — where
-- the UTC date is still yesterday — from being rejected as historical.
-- ============================================================

CREATE OR REPLACE FUNCTION public.reject_past_bookings()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public, pg_temp AS $$
BEGIN
  -- Service role and SQL-editor writes are trusted: back-filling a real stay
  -- that already happened is a legitimate administrative act.
  IF current_user <> 'authenticated' THEN
    RETURN NEW;
  END IF;

  IF NEW.check_in < (CURRENT_DATE - INTERVAL '1 day') THEN
    RAISE EXCEPTION 'BOOKING_IN_THE_PAST: check_in % is before today (%)', NEW.check_in, CURRENT_DATE;
  END IF;

  RETURN NEW;
END;
$$;

-- Named to sort after bk_protect_columns and bk_validate_price so it sees the
-- dates those have settled on. BEFORE triggers fire in alphabetical order.
DROP TRIGGER IF EXISTS bk_reject_past ON public.bookings;
CREATE TRIGGER bk_reject_past
  BEFORE INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.reject_past_bookings();
