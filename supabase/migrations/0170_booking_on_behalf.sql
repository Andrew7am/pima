-- ===========================================================================
-- 0157 — OWNER MANUAL / WALK-IN BOOKING, ON THE FINANCIAL CORE
-- ===========================================================================
--
-- THE LAST BOOKING PATH THAT WAS NOT PRICED BY THE DATABASE.
--
-- An owner who takes a booking by telephone recorded it through a direct
-- INSERT into public.bookings, with a price he typed himself. That produced a
-- booking with no booking_financials row, which means:
--
--   * no agreement was resolved, so nothing checked whether the house is on
--     MARKUP, COMMISSION or NET_RATE;
--   * no owner_entitlement exists, so every owner and admin money screen falls
--     back to commission arithmetic — correct only for a COMMISSION house, and
--     silently wrong for the other two;
--   * no settlement hold exists, so the booking can never be settled;
--   * the price was whatever was typed, checked only against a floor.
--
-- create_booking_with_financials cannot be reused as-is: it derives the guest
-- from auth.uid(), which here is the OWNER. Booking through it would record
-- the owner as his own guest. Hence a second entry point — and only an entry
-- point. Everything downstream of fin_price_booking is shared, so the two
-- paths cannot diverge on a single financial figure.
--
--   normal guest booking ─┐
--                         ├─→ fin_price_booking ──→ booking_financials
--   owner manual booking ─┘
--
-- WHAT THIS FUNCTION DELIBERATELY DOES NOT ACCEPT
--
--   price · deposit · commission rate · markup pct · net rate ·
--   owner entitlement · hold amount
--
-- Not "validates and rejects" — there is no parameter to pass them in. The
-- agreement decides the model and the listed price decides the money; a
-- client cannot express an opinion about either. The one number the owner
-- used to type is gone from the form with it, and that is a product change,
-- recorded here so it is not mistaken for an oversight: an owner can no
-- longer record a privately negotiated price. Discounts have to travel
-- through a promotion, which is auditable, or through the agreement.
--
-- WHAT IT DOES NOT DO: mark anything paid. The owner recording a booking is
-- not evidence money moved. deposit_paid stays false and payment_status stays
-- 'unpaid'; cash the owner actually took is filed afterwards through
-- record_cash_deposit (migration 112), which is the only path that produces a
-- payment row with an actor and a timestamp behind it.

-- ---------------------------------------------------------------------------
-- 0. PRECONDITIONS
-- ---------------------------------------------------------------------------
--
-- This migration creates one function and two triggers. PL/pgSQL bodies are
-- not resolved at CREATE time, so without this block a database missing the
-- financial core would accept the whole migration and fail on the FIRST REAL
-- BOOKING instead — in production, at the worst possible moment. Fail here.
--
-- The list is what the RPC below actually touches, not everything it could.

DO $pre$
DECLARE v_missing TEXT := '';
BEGIN
  IF to_regprocedure('public.fin_price_booking(uuid,text,date,date,integer,integer[],uuid,integer)') IS NULL THEN
    v_missing := v_missing || E'\n  - fin_price_booking(uuid,text,date,date,integer,integer[],uuid,integer) is absent (apply 0153 first)';
  END IF;
  IF to_regclass('public.booking_idempotency') IS NULL THEN
    v_missing := v_missing || E'\n  - booking_idempotency is absent (apply 0153 first)';
  END IF;
  IF to_regclass('public.settlement_holds') IS NULL THEN
    v_missing := v_missing || E'\n  - settlement_holds is absent (apply 0143 first)';
  END IF;
  IF to_regclass('public.booking_financials') IS NULL THEN
    v_missing := v_missing || E'\n  - booking_financials is absent (apply 0142 first)';
  END IF;
  IF to_regprocedure('public.is_admin(uuid)') IS NULL THEN
    v_missing := v_missing || E'\n  - is_admin(uuid) is absent';
  END IF;
  IF to_regclass('public.houses') IS NULL OR to_regclass('public.users') IS NULL
     OR to_regclass('public.bookings') IS NULL THEN
    v_missing := v_missing || E'\n  - a core table (houses/users/bookings) is absent';
  END IF;

  -- Section 2 replaces bookings_backfill_identity. Replacing a function that
  -- was never created would silently install a DIFFERENT definition of it than
  -- 0156 intends, so require 0156 to have run.
  IF to_regprocedure('public.bookings_backfill_identity()') IS NULL THEN
    v_missing := v_missing || E'\n  - bookings_backfill_identity is absent (apply 0156 first)';
  END IF;

  IF v_missing <> '' THEN
    RAISE EXCEPTION 'PRECONDITIONS FAILED for 0157:%', v_missing;
  END IF;
  RAISE NOTICE '0157 preconditions: OK';
END;
$pre$;

-- ---------------------------------------------------------------------------
-- 1. WHO CREATED THE BOOKING, AS DISTINCT FROM WHOSE BOOKING IT IS
-- ---------------------------------------------------------------------------
--
-- bookings.user_id answers "whose booking is this" and drives RLS, loyalty
-- points and the guest's own list. It has never answered "who typed it in",
-- and on the manual path those are different people: the row was stamped with
-- the OWNER's user_id and the GUEST's name, so the booking looked, to every
-- query, like an owner booking for himself.
--
-- created_by is the acting account. It is nullable because every booking made
-- before this migration has no answer, and inventing one would be worse than
-- admitting we do not know.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS bookings_created_by_idx
  ON public.bookings (created_by) WHERE created_by IS NOT NULL;

COMMENT ON COLUMN public.bookings.created_by IS
  'The account that CREATED this booking. Equals user_id for a guest booking; on an owner manual booking it is the owner while user_id is the guest. NULL for rows written before migration 0157.';

-- Every insert path stamps it, not just the one below: a guest booking made
-- through create_booking_with_financials gets created_by = the guest, so the
-- column means the same thing everywhere and "created_by IS NULL" keeps
-- meaning "pre-0157" rather than "some path forgot".
CREATE OR REPLACE FUNCTION public.bookings_stamp_created_by()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- COALESCE, not an overwrite: a definer function that has already worked out
  -- the acting identity is a better authority than this trigger.
  NEW.created_by := COALESCE(NEW.created_by, auth.uid());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bookings_stamp_created_by_trg ON public.bookings;
CREATE TRIGGER bookings_stamp_created_by_trg
  BEFORE INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.bookings_stamp_created_by();

-- ---------------------------------------------------------------------------
-- 2. TEACH 0156's BACKFILL WHOSE IDENTITY IT IS LOOKING AT
-- ---------------------------------------------------------------------------
--
-- 0156's bookings_backfill_identity fills blank name/phone/email/role/org on a
-- booking from public.users, keyed on NEW.user_id. That is right for every
-- path that existed when it was written, because user_id was always the person
-- who made the booking.
--
-- This migration breaks that assumption. A walk-in guest has no Pima account,
-- so the booking hangs off the OWNER's user_id while the guest's details sit
-- in the identity columns. The backfill then reads the owner's row and fills
-- the guest's blank fields from it. Executed against the real schema, an owner
-- recording a booking for «ماريو مرقس» with no email produced:
--
--     user_phone = the owner's phone
--     user_email = the owner's email
--     user_role  = 'owner'
--     organization_name = the owner's organization
--
-- which is not a cosmetic mismatch: guest notifications are addressed from
-- these columns, so the guest's confirmation would go to the owner.
--
-- The rule that fixes it is one sentence: only fill a person's details in from
-- an account when that account belongs to the person the booking names.
--
-- The obvious test — created_by <> user_id — is WRONG, and was caught by
-- executing it rather than reading it. On a walk-in those two are the SAME
-- account: the owner typed it AND the booking hangs off him, because the guest
-- has no account. The guard never fired and the owner's details were still
-- copied in.
--
-- What actually distinguishes the case is the pair:
--
--   source is manual/temporary   → the identity columns name a third party
--   AND created_by = user_id     → ...who is NOT the account holder
--
-- Both are set in the RPC's own INSERT, so both are visible here. BEFORE ROW
-- triggers fire in alphabetical order, so bookings_backfill_identity_trg runs
-- before bookings_stamp_created_by_trg — which is why the RPC sets created_by
-- in the INSERT itself instead of leaving it to that trigger.
--
-- The two paths that SHOULD still backfill both do:
--
--   * a guest booking has source 'platform', so the first clause is false;
--   * an on-behalf booking for a REGISTERED guest has user_id = the guest and
--     created_by = the owner, so the second clause is false and the blanks are
--     filled from the guest's own account, which is exactly right.
--
-- This lives in 0157 rather than in 0156 because it depends on a column 0157
-- adds. 0156 must keep working on its own, applied by itself, in order.

CREATE OR REPLACE FUNCTION public.bookings_backfill_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE u RECORD;
BEGIN
  -- ── ADDED BY 0157 ──────────────────────────────────────────────────────
  -- An off-platform booking recorded by the account that holds it: the person
  -- named is a walk-in with no account of their own, so there is no account
  -- here whose details are theirs to borrow.
  IF NEW.source IN ('manual', 'temporary')
     AND NEW.created_by IS NOT NULL
     AND NEW.created_by IS NOT DISTINCT FROM NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- Only ever fills a gap. A caller that supplied a value keeps it, so the
  -- legacy insert path behaves exactly as it always has.
  IF COALESCE(NULLIF(btrim(NEW.user_name),  ''), NULL) IS NOT NULL
 AND COALESCE(NULLIF(btrim(NEW.user_phone), ''), NULL) IS NOT NULL
 AND COALESCE(NULLIF(btrim(NEW.user_email), ''), NULL) IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT name, phone, email, role, organization_name
    INTO u FROM public.users WHERE id = NEW.user_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  NEW.user_name  := COALESCE(NULLIF(btrim(NEW.user_name),  ''), COALESCE(u.name,  ''));
  NEW.user_phone := COALESCE(NULLIF(btrim(NEW.user_phone), ''), COALESCE(u.phone, ''));
  NEW.user_email := COALESCE(NULLIF(btrim(NEW.user_email), ''), COALESCE(u.email, ''));

  -- user_role is NOT NULL DEFAULT 'individual', so "blank" here means the
  -- default rather than a deliberate choice.
  IF NEW.user_role IS NULL OR NEW.user_role = 'individual' THEN
    NEW.user_role := COALESCE(u.role, NEW.user_role);
  END IF;

  IF NEW.organization_name IS NULL THEN
    NEW.organization_name := u.organization_name;
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. THE RPC
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_booking_on_behalf_with_financials(
  p_booking_id      TEXT,
  p_house_id        TEXT,
  p_check_in        DATE,
  p_check_out       DATE,
  p_guests_count    INTEGER,
  p_idempotency_key TEXT,
  p_guest_name      TEXT,
  p_guest_phone     TEXT      DEFAULT NULL,
  p_guest_email     TEXT      DEFAULT NULL,
  p_organization    TEXT      DEFAULT NULL,
  -- Only when the guest already has a Pima account. A walk-in has none, and
  -- inventing a shadow account for him would be a new identity system.
  p_guest_user_id   UUID      DEFAULT NULL,
  p_source          TEXT      DEFAULT 'manual',
  p_owner_notes     TEXT      DEFAULT NULL,
  p_child_ages      INTEGER[] DEFAULT NULL,
  p_promotion_id    UUID      DEFAULT NULL,
  p_points          INTEGER   DEFAULT 0,
  p_override_reason TEXT      DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor    UUID := auth.uid();   -- who is typing. Never a parameter.
  v_admin    BOOLEAN;
  v_owns     BOOLEAN;
  v_guest    UUID;                 -- whose booking it is
  v_price_uid UUID;                -- whose points and promotion eligibility
  v_name     TEXT;
  v_status   TEXT;
  v_fp       TEXT;
  v_prior    RECORD;
  q          RECORD;
  v_txn      UUID;
  v_rows     INTEGER;
  v_override UUID := NULL;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;
  IF p_idempotency_key IS NULL OR length(btrim(p_idempotency_key)) = 0 THEN
    RAISE EXCEPTION 'IDEMPOTENCY_KEY_REQUIRED';
  END IF;
  IF p_points IS NULL OR p_points < 0 THEN
    RAISE EXCEPTION 'INVALID_POINTS: %', p_points;
  END IF;

  v_name := btrim(COALESCE(p_guest_name, ''));
  IF v_name = '' THEN
    RAISE EXCEPTION 'GUEST_NAME_REQUIRED';
  END IF;

  -- 'platform' is not offerable here. A booking a guest never made must not be
  -- able to disguise itself as one: the distinction is what tells an admin
  -- reading the funnel which bookings the product actually produced.
  IF p_source IS NULL OR p_source NOT IN ('manual', 'temporary') THEN
    RAISE EXCEPTION 'INVALID_SOURCE: % — expected manual or temporary', p_source;
  END IF;

  -- ── Authorisation ───────────────────────────────────────────────────────
  -- The house, not the role. is_admin alone would let any owner book against
  -- any house in the country by passing a different p_house_id, which is the
  -- whole reason this check is here rather than in an RLS policy: the function
  -- is SECURITY DEFINER, so no policy is going to run on its behalf.
  v_admin := public.is_admin(v_actor);
  v_owns  := EXISTS (
    SELECT 1 FROM public.houses h
     WHERE h.id = p_house_id AND h.owner_id = v_actor);

  IF NOT (v_admin OR v_owns) THEN
    RAISE EXCEPTION
      'NOT_AUTHORIZED_FOR_HOUSE: % may not create bookings for house %',
      v_actor, p_house_id;
  END IF;

  -- ── Guest identity ──────────────────────────────────────────────────────
  IF p_guest_user_id IS NOT NULL THEN
    PERFORM 1 FROM public.users WHERE id = p_guest_user_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'GUEST_NOT_FOUND: %', p_guest_user_id;
    END IF;
  END IF;

  -- An unregistered walk-in has no account to hold the booking, so it hangs
  -- off the acting owner's — which is what the manual path has always done.
  -- created_by keeps the two apart.
  v_guest     := COALESCE(p_guest_user_id, v_actor);
  v_price_uid := v_guest;

  -- Points belong to a person. Without a named account there is nobody to
  -- take them from, and falling back to the OWNER's balance would quietly
  -- spend his loyalty points on a stranger's booking.
  IF p_points > 0 AND p_guest_user_id IS NULL THEN
    RAISE EXCEPTION
      'POINTS_REQUIRE_REGISTERED_GUEST: points can only be redeemed for a guest with a Pima account';
  END IF;

  -- ── Idempotency ─────────────────────────────────────────────────────────
  -- The actor and the guest are both in the fingerprint. Two owners cannot
  -- share a key, and the same key cannot be re-aimed at a different guest.
  v_fp := md5(concat_ws('|', 'on_behalf', v_actor::text, p_house_id,
                        p_check_in::text, p_check_out::text, p_guests_count::text,
                        COALESCE(array_to_string(p_child_ages, ','), ''),
                        COALESCE(p_promotion_id::text, ''), p_points::text,
                        COALESCE(p_guest_user_id::text, ''), v_name,
                        COALESCE(btrim(p_guest_phone), ''), p_source));

  SELECT * INTO v_prior FROM public.booking_idempotency
   WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_prior.fingerprint <> v_fp THEN
      RAISE EXCEPTION
        'IDEMPOTENCY_CONFLICT: key % was used for a booking with different inputs',
        p_idempotency_key;
    END IF;
    RETURN (SELECT to_jsonb(bf) || jsonb_build_object('booking_id', v_prior.booking_id, 'replayed', true)
              FROM public.booking_financials bf WHERE bf.booking_id = v_prior.booking_id);
  END IF;

  -- The guest's balance, locked before it is read, exactly as on the guest
  -- path: two bookings must not both see the same points and both spend them.
  IF p_points > 0 THEN
    PERFORM 1 FROM public.users WHERE id = v_guest FOR UPDATE;
  END IF;

  -- ── The shared pricing core ─────────────────────────────────────────────
  -- The same function fin_quote_booking and create_booking_with_financials
  -- call. Agreement resolution, MARKUP/COMMISSION/NET_RATE, the PD-16 deposit,
  -- the margin floor and the transfer-fee projection all live inside it and
  -- are not restated here. A house with no active agreement raises
  -- NO_AGREEMENT from in there, and it is not caught: a manual booking must
  -- not be a way around the commercial agreement workflow.
  SELECT * INTO q FROM public.fin_price_booking(
    v_price_uid, p_house_id, p_check_in, p_check_out, p_guests_count,
    p_child_ages, p_promotion_id, p_points);

  -- ── Override gate ───────────────────────────────────────────────────────
  -- Unchanged from the guest path, and deliberately not relaxed for owners.
  -- An owner is not an administrator: he cannot approve a booking that breaks
  -- Pima's own margin floor, least of all on his own house.
  IF q.margin_warning OR q.cash_shortfall > 0 THEN
    IF NOT v_admin THEN
      RAISE EXCEPTION
        'OVERRIDE_REQUIRED: projected net margin % against a required minimum of %, cash shortfall % — an authorised administrator must approve this booking',
        q.projected_net_margin, q.required_min_margin, q.cash_shortfall;
    END IF;
    IF p_override_reason IS NULL OR length(btrim(p_override_reason)) = 0 THEN
      RAISE EXCEPTION 'OVERRIDE_REASON_REQUIRED';
    END IF;
    v_override := v_actor;
  END IF;

  -- ── Booking ─────────────────────────────────────────────────────────────
  -- 'temporary' is a capacity hold awaiting confirmation, so it stays pending;
  -- 'manual' is a booking the owner has already agreed, so it is approved.
  -- Neither is paid. See the header on why nothing here marks money received.
  v_status := CASE WHEN p_source = 'temporary' THEN 'pending' ELSE 'approved' END;

  BEGIN
    INSERT INTO public.bookings
      (id, house_id, house_name, user_id, user_name, user_phone, user_email, user_role,
       organization_name, check_in, check_out, guests_count, child_ages,
       total_price, deposit_amount, status, payment_status, deposit_paid,
       source, owner_notes, created_by)
    SELECT p_booking_id, p_house_id, h.name, v_guest, v_name,
           COALESCE(btrim(p_guest_phone), ''), COALESCE(btrim(p_guest_email), ''),
           'individual', NULLIF(btrim(COALESCE(p_organization, '')), ''),
           p_check_in, p_check_out, p_guests_count, p_child_ages,
           -- The server's price and the server's deposit. deposit_amount is 0
           -- because the financial core owns it; booking_financials carries it.
           q.final_price, 0, v_status, 'unpaid', FALSE,
           p_source, NULLIF(btrim(COALESCE(p_owner_notes, '')), ''), v_actor
      FROM public.houses h
     WHERE h.id = p_house_id;
  EXCEPTION WHEN unique_violation THEN
    -- The client picks the booking id, so a collision is reachable. It can
    -- only ever be a collision: this function never updates a booking, so an
    -- id someone else owns cannot be mutated through it.
    RAISE EXCEPTION 'BOOKING_ID_TAKEN: %', p_booking_id;
  END;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN RAISE EXCEPTION 'BOOKING_INSERT_FAILED: % rows', v_rows; END IF;

  -- ── Snapshot. Generated columns compute themselves; none is written here. ──
  INSERT INTO public.booking_financials
    (booking_id, house_id, owner_id, agreement_id, model_type, currency,
     pricing_basis, pricing_quantity, resolved_rate, base_rate, markup_pct, commission_rate,
     retail_price, promo_discount, points_discount, points_redeemed, owner_entitlement,
     deposit_rate, min_margin_rate, assumed_transfer_fee,
     policy_free_cancel_days, policy_partial_refund_days, policy_partial_refund_pct,
     policy_source, owner_cash_release_date,
     override_by, override_reason, override_at)
  VALUES
    (p_booking_id, p_house_id, q.owner_id, q.agreement_id, q.model_type, q.currency,
     q.pricing_basis, q.pricing_quantity,
     q.resolved_rate, q.base_rate, q.markup_pct, q.commission_rate,
     q.retail_price, q.promo_discount, q.points_discount, q.points_redeemed, q.owner_entitlement,
     q.deposit_rate, q.min_margin_rate, q.assumed_transfer_fee,
     q.policy_free_cancel_days, q.policy_partial_refund_days, q.policy_partial_refund_pct,
     q.policy_source, q.owner_cash_release_date,
     v_override, CASE WHEN v_override IS NOT NULL THEN p_override_reason END,
     CASE WHEN v_override IS NOT NULL THEN NOW() END);
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN RAISE EXCEPTION 'SNAPSHOT_INSERT_FAILED: % rows', v_rows; END IF;

  -- ── Promotion linkage ───────────────────────────────────────────────────
  -- applied_by is the OWNER: he is the one who chose to apply it.
  IF p_promotion_id IS NOT NULL THEN
    INSERT INTO public.booking_promotions
      (booking_id, promotion_id, discount_amount, currency, applied_by)
    VALUES (p_booking_id, p_promotion_id, q.promo_discount, q.currency, v_actor);
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN RAISE EXCEPTION 'PROMOTION_LINK_FAILED: % rows', v_rows; END IF;
  END IF;

  -- ── Points: the GUEST's, spent by the OWNER, and said so ────────────────
  IF p_points > 0 THEN
    UPDATE public.users SET points = points - p_points
     WHERE id = v_guest AND points >= p_points;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN
      RAISE EXCEPTION 'POINTS_DEDUCTION_FAILED: % rows affected — balance moved underneath us', v_rows;
    END IF;

    -- The id is derived from the booking, so a replay cannot write a second
    -- row even if everything above it were to be re-entered.
    INSERT INTO public.points_history (id, user_id, amount, description, type, booking_id)
    VALUES ('pt_red_' || p_booking_id, v_guest, p_points,
            'خصم نقاط لحجز ' || p_booking_id || ' (سجّله صاحب البيت)', 'redeemed', p_booking_id);
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN RAISE EXCEPTION 'POINTS_HISTORY_FAILED: % rows', v_rows; END IF;

    -- actor_id is the owner and party_id is the guest, so the ledger records
    -- who spent whose points.
    v_txn := gen_random_uuid();
    INSERT INTO public.fin_transactions
      (id, txn_type, booking_id, house_id, owner_id, actor_id, currency,
       reference_type, reference_id, idempotency_key, memo)
    VALUES (v_txn, 'points_redemption_cost', p_booking_id, p_house_id, q.owner_id, v_actor,
            q.currency, 'booking', p_booking_id,
            'pts:redeem:' || p_booking_id, 'points redeemed against owner-recorded booking');
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN RAISE EXCEPTION 'LEDGER_HEADER_FAILED: % rows', v_rows; END IF;

    INSERT INTO public.fin_transaction_legs (txn_id, account, amount, party_id) VALUES
      (v_txn, 'POINTS_LIABILITY',      q.points_discount, v_guest),
      (v_txn, 'PIMA_POINTS_EXPENSE',   q.points_discount, NULL),
      (v_txn, 'PIMA_LOYALTY_EXPENSE', -q.points_discount, NULL),
      (v_txn, 'POINTS_APPLIED',       -q.points_discount, v_guest);
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 4 THEN RAISE EXCEPTION 'LEDGER_LEGS_FAILED: % rows', v_rows; END IF;
  END IF;

  -- ── Settlement hold. Amount and date come from the snapshot, not from here. ─
  INSERT INTO public.settlement_holds (booking_id) VALUES (p_booking_id);
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN RAISE EXCEPTION 'HOLD_INSERT_FAILED: % rows', v_rows; END IF;

  INSERT INTO public.booking_idempotency (idempotency_key, booking_id, fingerprint, created_by)
  VALUES (p_idempotency_key, p_booking_id, v_fp, v_actor);

  RETURN (SELECT to_jsonb(bf) || jsonb_build_object('booking_id', p_booking_id, 'replayed', false)
            FROM public.booking_financials bf WHERE bf.booking_id = p_booking_id);
END;
$$;

COMMENT ON FUNCTION public.create_booking_on_behalf_with_financials IS
  'Owner/admin records a booking taken off-platform. The acting identity is auth.uid(); the guest is supplied explicitly. Prices through fin_price_booking, the same path as create_booking_with_financials and fin_quote_booking — it accepts no price, deposit, commission, markup or net rate.';

REVOKE ALL ON FUNCTION public.create_booking_on_behalf_with_financials(
  TEXT, TEXT, DATE, DATE, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT,
  INTEGER[], UUID, INTEGER, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_booking_on_behalf_with_financials(
  TEXT, TEXT, DATE, DATE, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT,
  INTEGER[], UUID, INTEGER, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. VERIFICATION
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_pass INTEGER := 0;
  v_fail TEXT := '';
  v_src  TEXT;
  n      INTEGER;
BEGIN
  -- created_by exists, is nullable, and references users
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='bookings'
                AND column_name='created_by' AND is_nullable='YES')
  THEN v_pass := v_pass + 1;
  ELSE v_fail := v_fail || E'\n  - bookings.created_by missing or not nullable';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint c
              WHERE c.conrelid='public.bookings'::regclass AND c.contype='f'
                AND pg_get_constraintdef(c.oid) LIKE '%created_by%REFERENCES users(id)%')
  THEN v_pass := v_pass + 1;
  ELSE v_fail := v_fail || E'\n  - bookings.created_by does not reference users(id)';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid
              WHERE t.tgrelid='public.bookings'::regclass AND NOT t.tgisinternal
                AND p.proname='bookings_stamp_created_by')
  THEN v_pass := v_pass + 1;
  ELSE v_fail := v_fail || E'\n  - bookings_stamp_created_by trigger not installed';
  END IF;

  -- The function exists, is a definer, and has a pinned search_path
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
              WHERE n.nspname='public' AND p.proname='create_booking_on_behalf_with_financials'
                AND p.prosecdef)
  THEN v_pass := v_pass + 1;
  ELSE v_fail := v_fail || E'\n  - create_booking_on_behalf_with_financials missing or not SECURITY DEFINER';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
              WHERE n.nspname='public' AND p.proname='create_booking_on_behalf_with_financials'
                AND array_to_string(p.proconfig, ',') LIKE '%search_path=public, pg_temp%')
  THEN v_pass := v_pass + 1;
  ELSE v_fail := v_fail || E'\n  - create_booking_on_behalf_with_financials has no pinned search_path';
  END IF;

  -- Grants: authenticated only, never anon or PUBLIC
  IF has_function_privilege('authenticated',
       'public.create_booking_on_behalf_with_financials(TEXT,TEXT,DATE,DATE,INTEGER,TEXT,TEXT,TEXT,TEXT,TEXT,UUID,TEXT,TEXT,INTEGER[],UUID,INTEGER,TEXT)', 'EXECUTE')
  THEN v_pass := v_pass + 1;
  ELSE v_fail := v_fail || E'\n  - authenticated cannot execute the on-behalf RPC';
  END IF;

  IF NOT has_function_privilege('anon',
       'public.create_booking_on_behalf_with_financials(TEXT,TEXT,DATE,DATE,INTEGER,TEXT,TEXT,TEXT,TEXT,TEXT,UUID,TEXT,TEXT,INTEGER[],UUID,INTEGER,TEXT)', 'EXECUTE')
  THEN v_pass := v_pass + 1;
  ELSE v_fail := v_fail || E'\n  - anon can execute the on-behalf RPC';
  END IF;

  -- ── Source checks. Comments are stripped first: this file's own header
  -- names every forbidden parameter, and would otherwise trip its own guard.
  SELECT regexp_replace(p.prosrc, '--[^\n]*', '', 'g') INTO v_src
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='create_booking_on_behalf_with_financials';

  -- It must price through the shared core, not restate any formula.
  IF v_src LIKE '%fin_price_booking(%'
  THEN v_pass := v_pass + 1;
  ELSE v_fail := v_fail || E'\n  - the RPC does not call fin_price_booking';
  END IF;

  IF v_src NOT LIKE '%markup_pct *%' AND v_src NOT LIKE '%1 + %markup%'
     AND v_src NOT LIKE '%1 - %commission_rate%' AND v_src NOT LIKE '%GREATEST(%deposit%'
  THEN v_pass := v_pass + 1;
  ELSE v_fail := v_fail || E'\n  - the RPC restates a pricing formula instead of reading fin_price_booking';
  END IF;

  -- Identity must come from auth.uid(), never a parameter.
  IF v_src LIKE '%auth.uid()%'
  THEN v_pass := v_pass + 1;
  ELSE v_fail := v_fail || E'\n  - the RPC does not derive the actor from auth.uid()';
  END IF;

  -- No parameter may offer a price, deposit or agreement term. Checked on the
  -- signature, which is the only place a client can reach.
  SELECT count(*) INTO n
    FROM pg_proc p JOIN pg_namespace nsp ON nsp.oid=p.pronamespace,
         unnest(p.proargnames) AS a(nm)
   WHERE nsp.nspname='public' AND p.proname='create_booking_on_behalf_with_financials'
     AND (nm ILIKE '%price%' OR nm ILIKE '%deposit%' OR nm ILIKE '%commission%'
       OR nm ILIKE '%markup%' OR nm ILIKE '%net_rate%' OR nm ILIKE '%entitlement%'
       OR nm ILIKE '%total%' OR nm ILIKE '%amount%' OR nm ILIKE '%hold%');
  IF n = 0
  THEN v_pass := v_pass + 1;
  ELSE v_fail := v_fail || E'\n  - the RPC signature accepts ' || n || ' financial parameter(s)';
  END IF;

  -- The authorisation check must be against the HOUSE, not the role alone.
  IF v_src LIKE '%h.owner_id = v_actor%' AND v_src LIKE '%NOT_AUTHORIZED_FOR_HOUSE%'
  THEN v_pass := v_pass + 1;
  ELSE v_fail := v_fail || E'\n  - the RPC does not verify the actor owns the house';
  END IF;

  -- Idempotency, and a fingerprint that includes the guest.
  IF v_src LIKE '%booking_idempotency%' AND v_src LIKE '%IDEMPOTENCY_CONFLICT%'
     AND v_src LIKE '%p_guest_user_id::text%'
  THEN v_pass := v_pass + 1;
  ELSE v_fail := v_fail || E'\n  - idempotency missing, or the guest is not in the fingerprint';
  END IF;

  -- Nothing may be marked paid on creation.
  IF v_src LIKE '%''unpaid''%' AND v_src LIKE '%FALSE,%'
  THEN v_pass := v_pass + 1;
  ELSE v_fail := v_fail || E'\n  - the RPC does not force an unpaid booking';
  END IF;

  -- The snapshot and the hold are written in the same transaction.
  IF v_src LIKE '%INSERT INTO public.booking_financials%'
     AND v_src LIKE '%INSERT INTO public.settlement_holds%'
  THEN v_pass := v_pass + 1;
  ELSE v_fail := v_fail || E'\n  - the RPC does not create the snapshot and hold atomically';
  END IF;

  -- The override gate is not relaxed for owners.
  IF v_src LIKE '%OVERRIDE_REQUIRED%' AND v_src LIKE '%NOT v_admin%'
  THEN v_pass := v_pass + 1;
  ELSE v_fail := v_fail || E'\n  - the margin-floor override gate is missing or does not require an admin';
  END IF;

  -- NO_AGREEMENT must not be swallowed.
  IF v_src NOT LIKE '%NO_AGREEMENT%EXCEPTION%' AND v_src NOT LIKE '%WHEN OTHERS%'
  THEN v_pass := v_pass + 1;
  ELSE v_fail := v_fail || E'\n  - the RPC catches errors that must reach the caller';
  END IF;

  -- ── The 0156 x 0157 interaction ─────────────────────────────────────────
  -- Section 2 must actually be in force. Without the guard, a walk-in booking
  -- silently inherits the OWNER's phone, email, role and organisation.
  SELECT regexp_replace(p.prosrc, '--[^\n]*', '', 'g') INTO v_src
    FROM pg_proc p JOIN pg_namespace n2 ON n2.oid=p.pronamespace
   WHERE n2.nspname='public' AND p.proname='bookings_backfill_identity';

  IF v_src LIKE '%NEW.source IN (''manual'', ''temporary'')%'
     AND v_src LIKE '%NEW.created_by IS NOT DISTINCT FROM NEW.user_id%'
  THEN v_pass := v_pass + 1;
  ELSE v_fail := v_fail || E'\n  - bookings_backfill_identity has no on-behalf guard: a walk-in would inherit the owner''s contact details';
  END IF;

  -- The guard is worthless if it runs after created_by has been stamped, so
  -- the ordering the whole thing rests on is asserted rather than assumed.
  IF (SELECT t1.tgname < t2.tgname
        FROM pg_trigger t1, pg_trigger t2
       WHERE t1.tgrelid='public.bookings'::regclass AND t1.tgname='bookings_backfill_identity_trg'
         AND t2.tgrelid='public.bookings'::regclass AND t2.tgname='bookings_stamp_created_by_trg')
  THEN v_pass := v_pass + 1;
  ELSE v_fail := v_fail || E'\n  - trigger firing order changed: the backfill no longer runs before created_by is stamped';
  END IF;

  -- And the backfill must still work for an ordinary guest booking, where
  -- created_by is NULL at the time it runs.
  IF v_src LIKE '%NEW.created_by IS NOT NULL%' AND v_src LIKE '%NEW.source IN%'
  THEN v_pass := v_pass + 1;
  ELSE v_fail := v_fail || E'\n  - the guard is unconditional and would disable the backfill for guest bookings';
  END IF;

  IF v_fail <> '' THEN
    RAISE EXCEPTION '0157 VERIFICATION FAILED (% passed):%', v_pass, v_fail;
  END IF;
  IF v_pass <> 20 THEN
    RAISE EXCEPTION '0157 VERIFICATION INCOMPLETE: % of 20 assertions ran', v_pass;
  END IF;
  RAISE NOTICE '0157 verification: % / 20 assertions passed', v_pass;
END $$;
