-- ============================================================
-- Two of the three ideas from the third round. The third needs no
-- schema at all — silentHolds is the arithmetic the database already
-- performs for search, pointed at the owner instead.
-- ============================================================


-- ============================================================
-- 1. ساعة البوابة — the hour, which the system has never had.
--
-- Every booking system models check-in as a DATE, because that is what
-- a night costs. The real unit of cost to a retreat house is a person
-- kept awake: a cook, a guard, and a lit gate. That hour lives only in
-- the owner's head and surfaces exclusively when it is violated —
-- 1:40am, a broken-down bus on the Sohag road, a servant ringing a
-- number and hoping.
--
-- A search of src/ and supabase/ for arrival_time / arrivalTime found
-- nothing: the hour genuinely does not exist anywhere in the system.
--
-- latest_arrival_time is owner-direct, the same class as blocked_dates
-- — but protect_house_owner_updates (019) reverts EVERY column for a
-- non-admin, re-allowing only three by name, so it must be named there
-- too or an owner could never set his own gate hour.
-- ============================================================

ALTER TABLE public.houses   ADD COLUMN IF NOT EXISTS latest_arrival_time   TIME;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS expected_arrival_time TIME;

CREATE OR REPLACE FUNCTION public.protect_house_owner_updates()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  keep_pending  JSONB;
  keep_blocked  TEXT[];
  keep_menu     JSONB;
  keep_arrival  TIME;
BEGIN
  IF current_user = 'authenticated' AND NOT public.is_admin(auth.uid()) THEN
    keep_pending := NEW.pending_edit;
    keep_blocked := NEW.blocked_dates;
    keep_menu    := NEW.menu;
    keep_arrival := NEW.latest_arrival_time;
    NEW := OLD;                          -- revert every column to its old value
    NEW.pending_edit        := keep_pending;   -- then re-allow just these
    NEW.blocked_dates       := keep_blocked;
    NEW.menu                := keep_menu;
    -- His own gate hour. It carries no money and no personal data, and
    -- needing an admin to change it would mean it never gets changed.
    NEW.latest_arrival_time := keep_arrival;
  END IF;
  RETURN NEW;
END;
$$;

-- The guest's estimate is theirs to update from the road. It is pinned
-- against nothing because it decides nothing: it is a courtesy to the
-- person deciding whether to keep the kitchen open.
COMMENT ON COLUMN public.bookings.expected_arrival_time IS
  'What time the group thinks it will arrive. Advisory only — no price, capacity or status depends on it.';


-- ============================================================
-- 2. شهادة الأربعين — the report card written by the people who slept
--    in the house.
--
-- require_booking_for_review (020) restricts a review to the user who
-- holds the booking. That is right for a hotel and structurally wrong
-- here: a forty-person stay yields exactly one opinion, and it belongs
-- to the volunteer who paid and slept in the best room. An owner can
-- hold a 4.8 average for three summers without learning the
-- second-floor showers run cold.
--
-- SAFEGUARDING, and these are not negotiable:
--
--  * NO FREE TEXT. A comment box handed to forty children is an
--    unmonitored disclosure channel whose only reader may be the person
--    being disclosed about, and a vector for abuse aimed at house staff
--    or at each other. Structured taps only.
--  * NO NAME on the row, and no individual response ever exposed. The
--    owner sees per-axis aggregates or nothing.
--  * A MINIMUM OF 8 responses before he sees anything, so he cannot
--    deduce who said what in a small group.
--  * ONE-WAY. No reply, no acknowledgement, nothing that opens a route
--    from an adult owner back to a child.
--
-- And it never touches houses.rating: recompute_house_rating is not
-- called, so the public star count stays exactly what it is. This is a
-- private mirror for the owner, not a second scoreboard.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.stay_pulse (
  id           BIGSERIAL PRIMARY KEY,
  booking_id   TEXT NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  house_id     TEXT NOT NULL REFERENCES public.houses(id)   ON DELETE CASCADE,
  food         SMALLINT CHECK (food         BETWEEN 1 AND 5),
  service      SMALLINT CHECK (service      BETWEEN 1 AND 5),
  cleanliness  SMALLINT CHECK (cleanliness  BETWEEN 1 AND 5),
  organization SMALLINT CHECK (organization BETWEEN 1 AND 5),
  would_return BOOLEAN,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS stay_pulse_house_idx ON public.stay_pulse(house_id);

ALTER TABLE public.stay_pulse ENABLE ROW LEVEL SECURITY;
-- No direct read by anyone. The only way out is the aggregate function
-- below, which enforces the minimum-responses gate.
DROP POLICY IF EXISTS "stay_pulse_no_direct_read" ON public.stay_pulse;

CREATE OR REPLACE FUNCTION public.submit_stay_pulse(
  p_booking_id   TEXT,
  p_food         SMALLINT,
  p_service      SMALLINT,
  p_cleanliness  SMALLINT,
  p_organization SMALLINT,
  p_would_return BOOLEAN
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  b RECORD;
BEGIN
  SELECT id, house_id, check_out INTO b FROM public.bookings WHERE id = p_booking_id;
  IF b.id IS NULL THEN RAISE EXCEPTION 'BOOKING_NOT_FOUND'; END IF;

  -- Only in the week after the stay. Before it there is nothing to judge;
  -- long after, the link should stop accepting anything at all.
  IF NOT (CURRENT_DATE >= b.check_out AND CURRENT_DATE <= b.check_out + 7) THEN
    RAISE EXCEPTION 'PULSE_WINDOW_CLOSED';
  END IF;

  INSERT INTO public.stay_pulse (booking_id, house_id, food, service, cleanliness, organization, would_return)
  VALUES (b.id, b.house_id, p_food, p_service, p_cleanliness, p_organization, p_would_return);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_stay_pulse(TEXT, SMALLINT, SMALLINT, SMALLINT, SMALLINT, BOOLEAN) TO anon, authenticated;

/** Aggregates only, and only once enough people have answered. */
CREATE OR REPLACE FUNCTION public.house_stay_pulse(p_house_id TEXT)
RETURNS TABLE (
  responses      BIGINT,
  avg_food       NUMERIC,
  avg_service    NUMERIC,
  avg_clean      NUMERIC,
  avg_organization NUMERIC,
  would_return_pct NUMERIC
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner UUID;
  n BIGINT;
BEGIN
  SELECT owner_id INTO v_owner FROM public.houses WHERE id = p_house_id;
  IF v_owner IS NULL THEN RETURN; END IF;
  IF v_owner <> auth.uid() AND NOT public.is_admin(auth.uid()) THEN RETURN; END IF;

  SELECT COUNT(*) INTO n FROM public.stay_pulse WHERE house_id = p_house_id;
  -- Below this, an owner could work out who said what in a small group.
  IF n < 8 THEN
    RETURN QUERY SELECT n, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT n,
         ROUND(AVG(food)::NUMERIC, 1),
         ROUND(AVG(service)::NUMERIC, 1),
         ROUND(AVG(cleanliness)::NUMERIC, 1),
         ROUND(AVG(organization)::NUMERIC, 1),
         ROUND(100.0 * COUNT(*) FILTER (WHERE would_return) / NULLIF(COUNT(would_return), 0), 0)
    FROM public.stay_pulse WHERE house_id = p_house_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.house_stay_pulse(TEXT) TO authenticated;


-- ============================================================
-- 3. The cash deposit an owner confirms, which has been silently
--    failing to record.
--
-- handleConfirmDepositReceived files a cash Payment row so the payout
-- screen knows the money went into the OWNER's hand and Pima owes
-- nothing on it. The comment above that code says exactly that.
--
-- The row has never been written. It is inserted with
-- user_id = the GUEST's id, and payments_insert_user requires
-- auth.uid() = user_id (090:236-238); protect_payment_write refuses it
-- a second time unless the booking belongs to the caller (090:120-132).
-- The owner is neither. Both refusals are silent to him.
--
-- The booking flip beside it DOES persist, because owners
-- short-circuit protect_booking_privileged_columns. So the booking
-- reads «العربون اتدفع» with no payment behind it — and the payout
-- screen excludes a booking only when it FINDS an approved cash
-- payment. It finds none, so Pima transfers the owner a deposit he is
-- already holding. It pays out money it never received.
--
-- The audit screen shipped today catches this after the fact
-- (deposit_paid_but_nothing_received). This stops it happening.
--
-- SECURITY DEFINER because no RLS policy can express "the owner of the
-- house this booking is for" — the check belongs in the function, and
-- is done here explicitly rather than trusted from the client.
-- ============================================================

CREATE OR REPLACE FUNCTION public.record_cash_deposit(p_booking_id TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  b RECORD;
  v_owner UUID;
BEGIN
  SELECT id, house_id, user_id, user_name, deposit_amount, total_price, status
    INTO b FROM public.bookings WHERE id = p_booking_id;
  IF b.id IS NULL THEN RAISE EXCEPTION 'BOOKING_NOT_FOUND'; END IF;

  SELECT owner_id INTO v_owner FROM public.houses WHERE id = b.house_id;
  IF v_owner IS DISTINCT FROM auth.uid() AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'NOT_THE_OWNER';
  END IF;
  IF b.status IN ('cancelled', 'rejected') THEN
    RAISE EXCEPTION 'BOOKING_NOT_LIVE';
  END IF;

  -- Idempotent: confirming twice must not file the deposit twice, and the
  -- owner tapping again after a dropped connection is the normal case.
  IF EXISTS (
    SELECT 1 FROM public.payments
     WHERE booking_id = b.id AND payment_method = 'cash' AND payment_status = 'approved'
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.payments (
    id, booking_id, user_id, user_name, amount,
    payment_method, payment_status, payment_date, admin_notes
  ) VALUES (
    'pay_cash_' || b.id, b.id, b.user_id, COALESCE(b.user_name, 'ضيف'),
    COALESCE(b.deposit_amount, 0),
    'cash', 'approved', NOW(),
    'عربون استلمه صاحب البيت نقداً — سجّله بنفسه'
  );

  UPDATE public.bookings
     SET deposit_paid = TRUE, payment_status = 'paid_deposit'
   WHERE id = b.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_cash_deposit(TEXT) TO authenticated;
