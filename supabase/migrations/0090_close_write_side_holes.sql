-- ============================================================
-- Close three write-side holes that the read-side audits never covered.
--
-- Every table in this schema has careful SELECT policies and, for
-- `bookings`, a careful UPDATE guard (017/019/027/028/054). What was
-- missing is the INSERT side: `houses` and `payments` each have exactly
-- one INSERT policy, both of the shape `WITH CHECK (auth.uid() = <owner
-- column>)`, and neither table has a BEFORE INSERT trigger. So every
-- other column on a new row — including the ones that decide whether a
-- listing is public and whether money is considered received — is
-- whatever the client sent.
--
-- Concretely, before this migration, any authenticated account could:
--
--   1. INSERT a house with status='approved', rating=5, reviews_count=180.
--      `houses_select_approved` then shows it to anon on the public browse
--      screen, with no admin ever seeing it. The whole moderation model is
--      enforced on UPDATE only (019), which a fresh INSERT never touches.
--
--   2. INSERT a payment with payment_status='approved' and any amount,
--      against ANY booking id (nothing tied booking_id to the caller).
--      "How much has this booking been paid" is computed everywhere as the
--      sum of approved payment rows — AdminDashboard revenue and commission,
--      bookingJourney's deposit stage, the guest's remaining balance. So a
--      booking reads as settled with no money moved, and pointing it at
--      someone else's booking also fires that victim a "we received your
--      payment" notification and email from Pima's own domain.
--
--   3. UPDATE only bookings.deposit_amount. The guest branch of the column
--      guard pins deposit_paid / checked_in_at / checked_out_at /
--      points_awarded_for_amount / status / payment_status, but not
--      deposit_amount — and validate_booking_price early-exits when
--      total_price, guests_count, check_in and check_out are all unchanged,
--      so nothing renormalises it. award_booking_points then credits the
--      difference as loyalty points. Same early-exit made house_id
--      swappable: book the cheapest house, then repoint the booking at an
--      expensive one and keep the cheap total.
--
-- Also here: `is_banned` and `approval_status` were enforced nowhere in the
-- database. Grep of all 89 prior migrations finds them in column
-- definitions, write guards and four read helpers — and in no RLS policy at
-- all. Banning was purely the React screen at App.tsx:1658; the banned
-- account kept full write access through PostgREST. Ban is the only lever
-- against a fraudulent owner, so it needs to be real.
--
-- Ordering note: BEFORE triggers fire alphabetically, so on `bookings`
-- bk_protect_columns runs before bk_validate_price. Pinning deposit_amount
-- here therefore does NOT break a legitimate edit — when the guest really
-- changes dates or guest count, validate_booking_price runs afterwards and
-- recomputes deposit_amount from the new total.
-- ============================================================


-- ── 0. Helpers ──────────────────────────────────────────────────────────

-- Whether an account is allowed to write at all. Kept separate from
-- is_admin so the two can be composed in policies.
CREATE OR REPLACE FUNCTION public.is_active(uid UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp AS $$
  SELECT COALESCE(NOT u.is_banned, FALSE) FROM public.users u WHERE u.id = uid;
$$;

-- is_admin is the single point of failure for every admin policy in the
-- schema and was running with the caller's search_path. Not exploitable
-- today (Supabase does not grant CREATE ON SCHEMA public to authenticated),
-- but it costs nothing to pin.
ALTER FUNCTION public.is_admin(UUID) SET search_path = public, pg_temp;


-- ── 1. houses: a new listing is always pending, unrated, unreviewed ──────

-- NOT SECURITY DEFINER, deliberately: inside a definer function
-- current_user is the function's owner, so the 'authenticated' test below
-- would never match and the guard would silently do nothing. This is why
-- the existing guards (019/027/054) are invoker-rights too.
CREATE OR REPLACE FUNCTION public.protect_house_insert()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public, pg_temp AS $$
BEGIN
  -- Service role and SQL-editor inserts are trusted; only clamp what comes
  -- in over PostgREST as an end user.
  IF current_user <> 'authenticated' THEN
    RETURN NEW;
  END IF;
  IF public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  NEW.status        := 'pending';
  NEW.rating        := 0;
  NEW.reviews_count := 0;
  NEW.pending_edit  := NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS h_protect_insert ON public.houses;
CREATE TRIGGER h_protect_insert
  BEFORE INSERT ON public.houses
  FOR EACH ROW EXECUTE FUNCTION public.protect_house_insert();


-- ── 2. payments: a new payment is always pending, and always yours ───────

-- Invoker rights, for the same reason as protect_house_insert above. The
-- ownership check below therefore runs under the caller's RLS — which is
-- correct, since bookings_select_user already lets them see exactly their
-- own bookings and nothing else.
CREATE OR REPLACE FUNCTION public.protect_payment_write()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public, pg_temp AS $$
BEGIN
  IF current_user <> 'authenticated' THEN
    RETURN NEW;
  END IF;
  IF public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Only a human reviewer moves a payment out of 'pending'.
    NEW.payment_status := 'pending';

    -- The RLS policy only checked user_id, so booking_id was free. Filing a
    -- payment against someone else's booking corrupted their balance and
    -- sent them a notification about money they never transferred.
    IF NOT EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = NEW.booking_id AND b.user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'PAYMENT_BOOKING_NOT_OWNED';
    END IF;

    RETURN NEW;
  END IF;

  -- UPDATE. Today no RLS policy lets a non-admin update payments at all
  -- (016 grants UPDATE to admins only), so this is defence in depth: if a
  -- policy is ever widened, the money columns still cannot move.
  NEW.amount         := OLD.amount;
  NEW.booking_id     := OLD.booking_id;
  NEW.user_id        := OLD.user_id;
  NEW.payment_status := OLD.payment_status;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pay_protect_write ON public.payments;
CREATE TRIGGER pay_protect_write
  BEFORE INSERT OR UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.protect_payment_write();


-- ── 3. bookings: pin deposit_amount and the house the booking is for ─────

-- Identical to migration 054 except for the three added pins at the end of
-- the guest UPDATE branch.
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

  -- Server-computed from total_price by validate_booking_price, which runs
  -- immediately after this trigger. Left unpinned it was an unbounded
  -- points mint: award_booking_points credits the delta.
  NEW.deposit_amount := OLD.deposit_amount;

  -- A booking never legitimately moves to another house. Left unpinned, and
  -- with validate_booking_price early-exiting when the four price inputs are
  -- unchanged, this let a guest keep a cheap house's total on an expensive
  -- house's booking.
  NEW.house_id   := OLD.house_id;
  NEW.house_name := OLD.house_name;

  RETURN NEW;
END;
$$;


-- ── 4. Make banning real ────────────────────────────────────────────────

-- Same policies as before, with an is_active() conjunct. Reads are left
-- alone deliberately: a banned user should still be able to see their own
-- history, they just cannot create anything new.
DROP POLICY IF EXISTS "houses_insert_owner" ON public.houses;
CREATE POLICY "houses_insert_owner" ON public.houses FOR INSERT
  WITH CHECK (auth.uid() = owner_id AND public.is_active(auth.uid()));

DROP POLICY IF EXISTS "bookings_insert_user" ON public.bookings;
CREATE POLICY "bookings_insert_user" ON public.bookings FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.is_active(auth.uid()));

DROP POLICY IF EXISTS "payments_insert_user" ON public.payments;
CREATE POLICY "payments_insert_user" ON public.payments FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.is_active(auth.uid()));

DROP POLICY IF EXISTS "reviews_insert_user" ON public.reviews;
CREATE POLICY "reviews_insert_user" ON public.reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.is_active(auth.uid()));
