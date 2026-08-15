-- ─────────────────────────────────────────────────────────────────────────────
-- 0128 — PROPERTY-SPECIFIC BOOKING POLICIES + CHILD PRICING
--
-- Until now a single cancellation policy governed every house on the platform:
-- three numbers in platform_settings, editable by an admin, read live by
-- everybody. That is fine while every property agrees, and wrong the moment one
-- of them does not — a house that wants a fourteen-day window has no way to say
-- so, and a guest booking it is shown a promise its owner never made.
--
-- This migration makes the policy a property OF THE PROPERTY without taking the
-- platform policy away:
--
--     houses.<policy column> IS NULL  →  inherit platform_settings
--     houses.<policy column> IS SET   →  that value governs this house
--
-- Nullable-means-inherit is the entire reason no data migration is needed. Every
-- house that exists today keeps exactly the policy it has today, because every
-- one of these columns starts NULL. Copying the current global numbers onto each
-- house instead would have frozen them at today's values and quietly turned the
-- admin control into a no-op for every property that already exists.
--
-- ── WHAT IS RECORDED VERSUS WHAT IS LOOKED UP ───────────────────────────────
-- The distinction migration 0116 drew for discounts applies here for the same
-- reason. A booking's refund terms are part of what the guest agreed to. Read
-- live, an owner who tightened their policy in March would retroactively rewrite
-- the terms of every booking taken in February — including ones already paid
-- for. So the effective policy is STAMPED onto the booking at INSERT and never
-- recomputed. bookings.policy_* is that snapshot, and it is written by a trigger
-- that ignores whatever the client sent, for every caller including the owner
-- and the admin. That is the same stance stamp_booking_commission takes.
--
-- ── CHILDREN ────────────────────────────────────────────────────────────────
-- Pricing here is strictly per person, so "children under N stay free" genuinely
-- reduces what a family pays. Three numbers describe a party and only one of
-- them is an input:
--
--     guests_count    the TOTAL party, unchanged in meaning. Capacity is checked
--                     against it and stays checked against it — a child who pays
--                     nothing still sleeps in a bed.
--     child_ages      the only new input. One age per child, because a rule
--                     written against an age cannot be evaluated against an
--                     average or a headcount.
--     children_count  DERIVED from child_ages.
--     adults_count    DERIVED as guests_count - children_count.
--
-- Deriving rather than accepting the last two is what makes it impossible for
-- the three to disagree, and impossible to inflate the party for capacity while
-- shrinking it for price.
--
-- The server must know the child rule or it would reject its own arithmetic:
-- validate_booking_price recomputes the expected price from the house's rates
-- and refuses anything below it. A free child the server did not know about does
-- not merely go undisplayed — the database throws PRICE_TOO_LOW. So the rule is
-- taught to that function below, applied to the SERVER's own expected figure.
-- The client's number is still never trusted.
--
-- Trigger order matters and is bought with the name: BEFORE-row triggers fire in
-- alphabetical order, so bk_stamp_policy runs after bk_protect_columns and
-- bk_reject_past but before bk_validate_price. By the time the price is checked
-- the snapshot exists, and the check therefore validates against the very policy
-- the booking will be held to — not against a second, independent read of the
-- house that could disagree with it.
--
-- No RLS policy changes. Reading a house is already public for approved houses,
-- owner UPDATE is already scoped by auth.uid() = owner_id, and which columns an
-- owner may actually write is decided by protect_house_owner_updates — extended
-- below rather than replaced.
-- ─────────────────────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. HOUSES — the per-property policy. NULL everywhere means "inherit".
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.houses
  ADD COLUMN IF NOT EXISTS free_cancel_days     INTEGER,
  ADD COLUMN IF NOT EXISTS partial_refund_days  INTEGER,
  ADD COLUMN IF NOT EXISTS partial_refund_pct   NUMERIC,
  ADD COLUMN IF NOT EXISTS child_free_under_age INTEGER,
  ADD COLUMN IF NOT EXISTS booking_policy_notes TEXT,
  ADD COLUMN IF NOT EXISTS policy_updated_at    TIMESTAMPTZ;

DO $$
BEGIN
  ALTER TABLE public.houses DROP CONSTRAINT IF EXISTS houses_free_cancel_days_range;
  ALTER TABLE public.houses DROP CONSTRAINT IF EXISTS houses_partial_refund_days_range;
  ALTER TABLE public.houses DROP CONSTRAINT IF EXISTS houses_partial_refund_pct_range;
  ALTER TABLE public.houses DROP CONSTRAINT IF EXISTS houses_child_free_under_age_range;
  ALTER TABLE public.houses DROP CONSTRAINT IF EXISTS houses_booking_policy_notes_len;

  ALTER TABLE public.houses ADD CONSTRAINT houses_free_cancel_days_range
    CHECK (free_cancel_days IS NULL OR (free_cancel_days >= 0 AND free_cancel_days <= 365));
  ALTER TABLE public.houses ADD CONSTRAINT houses_partial_refund_days_range
    CHECK (partial_refund_days IS NULL OR (partial_refund_days >= 0 AND partial_refund_days <= 365));
  ALTER TABLE public.houses ADD CONSTRAINT houses_partial_refund_pct_range
    CHECK (partial_refund_pct IS NULL OR (partial_refund_pct >= 0 AND partial_refund_pct <= 1));
  -- 18 is adulthood, so a "child" rule can never be written to cover adults.
  ALTER TABLE public.houses ADD CONSTRAINT houses_child_free_under_age_range
    CHECK (child_free_under_age IS NULL OR (child_free_under_age >= 0 AND child_free_under_age <= 17));
  ALTER TABLE public.houses ADD CONSTRAINT houses_booking_policy_notes_len
    CHECK (booking_policy_notes IS NULL OR length(booking_policy_notes) <= 2000);
END $$;

COMMENT ON COLUMN public.houses.free_cancel_days IS
  'Days before check-in up to which this house refunds in full. NULL = inherit platform_settings.free_cancel_days.';
COMMENT ON COLUMN public.houses.partial_refund_days IS
  'Days before check-in up to which this house refunds partially. NULL = inherit platform_settings.partial_refund_days.';
COMMENT ON COLUMN public.houses.partial_refund_pct IS
  'Fraction of the paid amount refunded inside the partial window. NULL = inherit platform_settings.partial_refund_pct.';
COMMENT ON COLUMN public.houses.child_free_under_age IS
  'Children strictly under this age are not charged. NULL = this house has no child rule and every guest is charged — which is what every house does today. There is deliberately no platform-level fallback: a non-NULL default here would silently change the price of every existing property.';
COMMENT ON COLUMN public.houses.booking_policy_notes IS
  'Free text the owner may add beside the numbers. Never parsed, never a substitute for them.';
COMMENT ON COLUMN public.houses.policy_updated_at IS
  'Server-set. Stamped whenever any policy column above actually changes; never writable by a client.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. BOOKINGS — the party breakdown, and the frozen policy snapshot.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS adults_count                INTEGER,
  ADD COLUMN IF NOT EXISTS children_count              INTEGER,
  ADD COLUMN IF NOT EXISTS child_ages                  INTEGER[],
  ADD COLUMN IF NOT EXISTS policy_free_cancel_days     INTEGER,
  ADD COLUMN IF NOT EXISTS policy_partial_refund_days  INTEGER,
  ADD COLUMN IF NOT EXISTS policy_partial_refund_pct   NUMERIC,
  ADD COLUMN IF NOT EXISTS policy_child_free_under_age INTEGER,
  ADD COLUMN IF NOT EXISTS policy_snapshot_at          TIMESTAMPTZ;

DO $$
BEGIN
  ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_adults_count_range;
  ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_children_count_range;
  ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_child_ages_len;

  -- Nullable throughout: a booking taken before this migration, and any booking
  -- whose party was never broken down, is left alone rather than reinterpreted.
  ALTER TABLE public.bookings ADD CONSTRAINT bookings_adults_count_range
    CHECK (adults_count IS NULL OR adults_count >= 1);
  ALTER TABLE public.bookings ADD CONSTRAINT bookings_children_count_range
    CHECK (children_count IS NULL OR children_count >= 0);
  ALTER TABLE public.bookings ADD CONSTRAINT bookings_child_ages_len
    CHECK (child_ages IS NULL OR COALESCE(array_length(child_ages, 1), 0) <= 50);
END $$;

COMMENT ON COLUMN public.bookings.child_ages IS
  'One age per child in the party. The only party input the client supplies besides guests_count; children_count and adults_count are derived from it server-side. NULL = the party was never broken down, and every guest is chargeable — exactly the behaviour before this migration.';
COMMENT ON COLUMN public.bookings.adults_count IS
  'Derived server-side as guests_count - children_count. Never trusted from the client.';
COMMENT ON COLUMN public.bookings.policy_snapshot_at IS
  'When the policy_* columns were frozen onto this booking. NULL for bookings taken before migration 0128, which correctly fall back to the live platform policy — the policy they were actually made under.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. STAMP — party breakdown + immutable policy snapshot.
--
-- Runs for EVERY caller. The owner and the admin are not exempt, because the
-- terms a booking was taken under are not anybody's to revise afterwards — the
-- same reason stamp_booking_commission hands back OLD.commission_rate to all of
-- them. Hence the snapshot is immutable from the client by construction: there
-- is no code path that writes it other than this function.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.stamp_booking_policy()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public, pg_temp AS $$
DECLARE
  h_free    INTEGER;
  h_partial INTEGER;
  h_pct     NUMERIC;
  h_child   INTEGER;
  p_free    INTEGER;
  p_partial INTEGER;
  p_pct     NUMERIC;
  v_children INTEGER;
  v_age      INTEGER;
BEGIN
  -- ── Party breakdown ──────────────────────────────────────────────────────
  -- On an UPDATE that leaves the total alone there is nothing to recompute, and
  -- the previous breakdown is authoritative; taking the client's word here would
  -- let a guest re-declare two adults as two toddlers after the fact.
  IF TG_OP = 'UPDATE' AND NEW.guests_count = OLD.guests_count THEN
    NEW.adults_count   := OLD.adults_count;
    NEW.children_count := OLD.children_count;
    NEW.child_ages     := OLD.child_ages;
  ELSIF NEW.child_ages IS NULL THEN
    -- Party not broken down — a legacy client, or a booking the owner entered
    -- himself over the phone. Everyone is chargeable, exactly as before.
    NEW.adults_count   := NULL;
    NEW.children_count := NULL;
  ELSE
    FOREACH v_age IN ARRAY NEW.child_ages LOOP
      IF v_age IS NULL OR v_age < 0 OR v_age > 17 THEN
        RAISE EXCEPTION 'INVALID_CHILD_AGE: every child age must be between 0 and 17, got %', v_age;
      END IF;
    END LOOP;
    v_children := COALESCE(array_length(NEW.child_ages, 1), 0);
    NEW.children_count := v_children;
    NEW.adults_count   := NEW.guests_count - v_children;
    IF NEW.adults_count < 1 THEN
      RAISE EXCEPTION 'INVALID_PARTY: a party of % cannot contain % children — at least one adult is required, and guests_count is the total including children',
        NEW.guests_count, v_children;
    END IF;
  END IF;

  -- ── Policy snapshot ──────────────────────────────────────────────────────
  IF TG_OP = 'UPDATE' THEN
    NEW.policy_free_cancel_days     := OLD.policy_free_cancel_days;
    NEW.policy_partial_refund_days  := OLD.policy_partial_refund_days;
    NEW.policy_partial_refund_pct   := OLD.policy_partial_refund_pct;
    NEW.policy_child_free_under_age := OLD.policy_child_free_under_age;
    NEW.policy_snapshot_at          := OLD.policy_snapshot_at;
    RETURN NEW;
  END IF;

  SELECT h.free_cancel_days, h.partial_refund_days, h.partial_refund_pct, h.child_free_under_age
    INTO h_free, h_partial, h_pct, h_child
    FROM public.houses h WHERE h.id = NEW.house_id;

  SELECT s.free_cancel_days, s.partial_refund_days, s.partial_refund_pct
    INTO p_free, p_partial, p_pct
    FROM public.platform_settings s WHERE s.id = 1;

  -- Resolution, one field at a time: the property's own value when it has one,
  -- the platform's otherwise. The literals are a last resort for a database with
  -- no settings row at all, and match migration 0054's defaults.
  NEW.policy_free_cancel_days    := COALESCE(h_free,    p_free,    7);
  NEW.policy_partial_refund_days := COALESCE(h_partial, p_partial, 3);
  NEW.policy_partial_refund_pct  := COALESCE(h_pct,     p_pct,     0.5);
  -- Deliberately no platform fallback — see the column comment.
  NEW.policy_child_free_under_age := h_child;
  NEW.policy_snapshot_at          := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bk_stamp_policy ON public.bookings;
CREATE TRIGGER bk_stamp_policy
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.stamp_booking_policy();

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. PRICE VALIDATION — now aware that some of the party may be free.
--
-- Reproduced from migration 0116 with one change: the per-person multiplier is
-- the CHARGEABLE head count rather than the whole party. Everything else — the
-- monthly branch, day-use, seasonal lookup, the discount stamp, the redemption
-- floor, the deposit — is unchanged.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.validate_booking_price()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  h_type     TEXT;
  h_night    NUMERIC;
  h_month    NUMERIC;
  h_day      NUMERIC;
  h_seasonal JSONB;
  h_disc     NUMERIC;
  h_disc_from DATE;
  h_disc_to   DATE;
  unit     NUMERIC;
  qty      INTEGER;
  expected NUMERIC;
  min_allowed NUMERIC;
  v_deposit    NUMERIC;
  v_max_redeem NUMERIC;
  v_applied    NUMERIC;
  v_free_kids  INTEGER;
  v_chargeable INTEGER;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.total_price  = OLD.total_price
     AND NEW.guests_count = OLD.guests_count
     AND NEW.check_in     = OLD.check_in
     AND NEW.check_out    = OLD.check_out THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(deposit_rate, 0.15), COALESCE(max_redemption_pct, 0.10)
    INTO v_deposit, v_max_redeem
    FROM public.platform_settings WHERE id = 1;
  v_deposit    := COALESCE(v_deposit, 0.15);
  v_max_redeem := COALESCE(v_max_redeem, 0.10);

  SELECT property_type, price_per_night_per_person, monthly_rent,
         day_use_price_per_person, COALESCE(seasonal_rates, '[]'::jsonb),
         COALESCE(discount_pct, 0), discount_starts_at, discount_ends_at
    INTO h_type, h_night, h_month, h_day, h_seasonal,
         h_disc, h_disc_from, h_disc_to
    FROM public.houses WHERE id = NEW.house_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- How many of the party actually pay. Read from the booking's OWN stamped
  -- rule, not from the house — bk_stamp_policy has already run, and going back
  -- to the house here would let an owner who changed the rule mid-flight
  -- invalidate a price that was correct when it was quoted. NULL rule, or a
  -- party that was never broken down, yields zero free children and therefore
  -- precisely the arithmetic this function did before migration 0128.
  v_free_kids := 0;
  IF NEW.policy_child_free_under_age IS NOT NULL AND NEW.child_ages IS NOT NULL THEN
    SELECT COUNT(*) INTO v_free_kids
      FROM unnest(NEW.child_ages) AS c(age)
     WHERE c.age < NEW.policy_child_free_under_age;
  END IF;
  -- Cannot fall below one: stamp_booking_policy has already rejected any party
  -- without an adult, and adults are never free.
  v_chargeable := NEW.guests_count - v_free_kids;

  IF h_type IN ('student', 'staff') THEN
    qty  := GREATEST(1, ROUND((NEW.check_out - NEW.check_in)::numeric / 30))::int;
    unit := COALESCE(h_month, 1500);
    expected := unit * v_chargeable * qty;

  ELSIF NEW.check_out = NEW.check_in THEN
    IF TG_OP = 'INSERT' AND h_day IS NULL THEN
      RAISE EXCEPTION 'DAY_USE_NOT_OFFERED: house % has no day rate', NEW.house_id;
    END IF;
    expected := COALESCE(h_day, 0) * v_chargeable;

  ELSE
    SELECT COALESCE(SUM(COALESCE(sr.rate, COALESCE(h_night, 0))), 0) * v_chargeable
      INTO expected
      FROM generate_series(NEW.check_in, NEW.check_out - 1, '1 day'::interval) AS g(day)
      LEFT JOIN LATERAL (
        SELECT (r.elem->>'pricePerNight')::numeric AS rate
        FROM jsonb_array_elements(h_seasonal) WITH ORDINALITY AS r(elem, ord)
        WHERE (r.elem->>'startDate') ~ '^\d{4}-\d{2}-\d{2}$'
          AND (r.elem->>'endDate')   ~ '^\d{4}-\d{2}-\d{2}$'
          AND (r.elem->>'pricePerNight') ~ '^\d+(\.\d+)?$'
          AND g.day::date >= (r.elem->>'startDate')::date
          AND g.day::date <= (r.elem->>'endDate')::date
        ORDER BY r.ord
        LIMIT 1
      ) sr ON TRUE;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF h_disc > 0
       AND (h_disc_from IS NULL OR NEW.check_in >= h_disc_from)
       AND (h_disc_to   IS NULL OR NEW.check_in <= h_disc_to) THEN
      NEW.discount_pct_applied := h_disc;
    ELSE
      NEW.discount_pct_applied := 0;
    END IF;
  ELSE
    NEW.discount_pct_applied := COALESCE(OLD.discount_pct_applied, 0);
  END IF;

  v_applied := COALESCE(NEW.discount_pct_applied, 0);
  IF v_applied > 0 THEN
    NEW.price_before_discount := expected;
    expected := ROUND(expected * (1 - v_applied));
  ELSE
    NEW.price_before_discount := NULL;
  END IF;

  min_allowed := FLOOR(expected * (1 - v_max_redeem)) - 1;

  IF NEW.total_price < min_allowed THEN
    RAISE EXCEPTION 'PRICE_TOO_LOW: expected at least %, got % (house rate math for % chargeable of % guests)',
      min_allowed, NEW.total_price, v_chargeable, NEW.guests_count;
  END IF;

  NEW.deposit_amount := ROUND(NEW.total_price * v_deposit);
  RETURN NEW;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. OWNER WRITE ACCESS — extend the allow-list, do not widen it further.
--
-- protect_house_owner_updates reverts every column a non-admin writes and then
-- hands back a named few. A new column that is not named there is not merely
-- unsaved — it appears to save and silently reverts, which is worse. The five
-- policy fields join the list; policy_updated_at deliberately does not, because
-- it is stamped by the trigger in section 6 and is not the client's to set.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.protect_house_owner_updates()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  keep_pending  JSONB;
  keep_blocked  TEXT[];
  keep_menu     JSONB;
  keep_arrival  TIME;
  keep_free     INTEGER;
  keep_partial  INTEGER;
  keep_pct      NUMERIC;
  keep_child    INTEGER;
  keep_notes    TEXT;
BEGIN
  IF current_user = 'authenticated' AND NOT public.is_admin(auth.uid()) THEN
    keep_pending := NEW.pending_edit;
    keep_blocked := NEW.blocked_dates;
    keep_menu    := NEW.menu;
    keep_arrival := NEW.latest_arrival_time;
    keep_free    := NEW.free_cancel_days;
    keep_partial := NEW.partial_refund_days;
    keep_pct     := NEW.partial_refund_pct;
    keep_child   := NEW.child_free_under_age;
    keep_notes   := NEW.booking_policy_notes;
    NEW := OLD;                          -- revert every column to its old value
    NEW.pending_edit        := keep_pending;   -- then re-allow just these
    NEW.blocked_dates       := keep_blocked;
    NEW.menu                := keep_menu;
    -- His own gate hour. It carries no money and no personal data, and
    -- needing an admin to change it would mean it never gets changed.
    NEW.latest_arrival_time := keep_arrival;
    -- His own booking policy. It carries no personal data either, and it is the
    -- terms HE offers — an owner who cannot state them has to let the platform
    -- state them for him, which is the thing this migration exists to end. It
    -- reaches no booking already taken: those hold their own snapshot.
    NEW.free_cancel_days     := keep_free;
    NEW.partial_refund_days  := keep_partial;
    NEW.partial_refund_pct   := keep_pct;
    NEW.child_free_under_age := keep_child;
    NEW.booking_policy_notes := keep_notes;
  END IF;
  RETURN NEW;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. POLICY COHERENCE + policy_updated_at.
--
-- Named to sort after trg_protect_house_owner_updates so it sees the values that
-- actually survived that gate rather than the ones a client hoped for.
--
-- The window check runs ONLY when a policy column actually changed in this
-- statement. Validating unconditionally would mean an admin editing the platform
-- fallback into an odd shape starts failing every unrelated house update on the
-- platform — a footgun bought for nothing.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.touch_house_policy()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public, pg_temp AS $$
DECLARE
  p_free      INTEGER;
  p_partial   INTEGER;
  eff_free    INTEGER;
  eff_partial INTEGER;
  changed     BOOLEAN;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    changed := NEW.free_cancel_days     IS DISTINCT FROM OLD.free_cancel_days
            OR NEW.partial_refund_days  IS DISTINCT FROM OLD.partial_refund_days
            OR NEW.partial_refund_pct   IS DISTINCT FROM OLD.partial_refund_pct
            OR NEW.child_free_under_age IS DISTINCT FROM OLD.child_free_under_age
            OR NEW.booking_policy_notes IS DISTINCT FROM OLD.booking_policy_notes;
    IF NOT changed THEN
      NEW.policy_updated_at := OLD.policy_updated_at;   -- not the client's to set
      RETURN NEW;
    END IF;
  ELSE
    changed := NEW.free_cancel_days     IS NOT NULL
            OR NEW.partial_refund_days  IS NOT NULL
            OR NEW.partial_refund_pct   IS NOT NULL
            OR NEW.child_free_under_age IS NOT NULL
            OR NEW.booking_policy_notes IS NOT NULL;
    IF NOT changed THEN
      NEW.policy_updated_at := NULL;
      RETURN NEW;
    END IF;
  END IF;

  SELECT s.free_cancel_days, s.partial_refund_days
    INTO p_free, p_partial
    FROM public.platform_settings s WHERE s.id = 1;

  eff_free    := COALESCE(NEW.free_cancel_days,    p_free,    7);
  eff_partial := COALESCE(NEW.partial_refund_days, p_partial, 3);

  -- A partial window longer than the full one makes the partial tier
  -- unreachable: getRefundTier tests the full threshold first, so every guest
  -- would land on 100% or 0% and the middle number would quietly mean nothing.
  IF eff_partial > eff_free THEN
    RAISE EXCEPTION 'INVALID_POLICY_WINDOW: the partial-refund window (% days) cannot be longer than the full-refund window (% days)',
      eff_partial, eff_free;
  END IF;

  NEW.policy_updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_house_policy ON public.houses;
CREATE TRIGGER trg_touch_house_policy
  BEFORE INSERT OR UPDATE ON public.houses
  FOR EACH ROW EXECUTE FUNCTION public.touch_house_policy();

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. COLUMN GRANTS — without this the whole migration is invisible.
--
-- public.houses does not carry a table-level SELECT grant. Migration 0090
-- revoked it and granted every column individually so that payment_methods
-- could be held back, and every migration adding a house column since has had
-- to re-run this block. A column added without it is readable by nobody: the
-- owner's policy would save correctly and never appear to a guest.
--
-- Verbatim from migration 0119, including the payment_methods exclusion.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE cols TEXT;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'houses'
    AND column_name <> 'payment_methods';

  IF cols IS NULL THEN
    RAISE EXCEPTION 'public.houses not found — refusing to change grants';
  END IF;

  EXECUTE 'REVOKE SELECT ON public.houses FROM anon, authenticated';
  EXECUTE format('GRANT SELECT (%s) ON public.houses TO anon, authenticated', cols);
END $$;
