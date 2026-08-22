-- ─────────────────────────────────────────────────────────────────────────────
-- 0139 — FINANCIAL SETTINGS (versioned, effective-dated)
--
-- The first migration of the financial core rebuild. It introduces nothing that
-- anything reads yet: platform_settings keeps serving every existing screen and
-- every existing trigger, untouched. This table is the destination those readers
-- will move to, one migration at a time, and it exists first so the later ones
-- have something to resolve against.
--
-- WHY A NEW TABLE RATHER THAN MORE COLUMNS ON platform_settings.
--
-- platform_settings is a single row, pinned by CHECK (id = 1), edited in place.
-- That shape cannot answer the only question a financial system is ever really
-- asked about its own configuration: «what were the terms WHEN THIS BOOKING WAS
-- TAKEN?». Editing the row rewrites the past for every booking that has not
-- already frozen a snapshot of its own, which is precisely the class of silent
-- history-rewriting that migration 0128 fixed for cancellation policy and 0113
-- fixed for commission.
--
-- So this table is APPEND-ONLY AND EFFECTIVE-DATED. A version is never edited.
-- Superseding one means closing it (effective_to = now) and inserting the next.
-- The database enforces that; it is not a convention anyone can forget.
--
-- Exactly one version may be open at a time, which is what makes «the settings
-- in force» a deterministic lookup rather than a sort-and-hope.
--
-- WHAT IS NOT HERE.
--
-- No ledger, no agreements, no booking snapshot, no changes to bookings,
-- payments or points, and no data reset. Those are 0140 onward. Nothing in this
-- migration alters the behaviour of the running application.
--
-- SEEDED VALUES are the approved PD-01..PD-18 defaults. Note that the
-- cancellation tiers seeded here (21 / 7 days) deliberately DIFFER from the ones
-- live in platform_settings today (7 / 3). That is the approved new policy, and
-- it changes nothing until a reader is pointed at this table — which no reader
-- is, yet.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── The table ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.financial_settings (
  id                      BIGSERIAL     PRIMARY KEY,

  -- PD-01 — minimum PIMA margin. A WARNING threshold, never a hard block; the
  -- override lives on the booking snapshot, not here.
  min_margin_rate         NUMERIC(6,4)  NOT NULL DEFAULT 0.0200,

  -- PD-07 — default commission for NEW Model C agreements only. An agreement
  -- that exists carries its own rate; a booking that exists carries its own
  -- snapshot. This value never reaches backwards.
  default_commission_rate NUMERIC(6,4)  NOT NULL DEFAULT 0.0500,

  -- PD-03 / PD-14 — deposit as a share of the FINAL (post-discount) customer
  -- price. PD-16's margin floor is computed per booking, not stored here.
  deposit_rate            NUMERIC(6,4)  NOT NULL DEFAULT 0.3000,

  -- PD-09 — a CAP, not a fee. The actual transfer cost is recorded on the payout
  -- when it is known; only the projection at booking time uses this number.
  transfer_fee_cap        NUMERIC(12,2) NOT NULL DEFAULT 20.00,

  -- PD-13b — above this outstanding balance an owner receivable stops being
  -- quietly netted off future settlements and becomes an explicit demand.
  receivable_threshold    NUMERIC(12,2) NOT NULL DEFAULT 100.00,

  -- PD-17 / PD-18 — loyalty conversion and the redemption band.
  points_per_egp          INTEGER       NOT NULL DEFAULT 100,
  max_redemption_pct      NUMERIC(6,4)  NOT NULL DEFAULT 0.1000,

  -- PD-10 — cancellation tiers. Read as: at or beyond free_cancel_days the
  -- refund is whole; at or beyond partial_refund_days it is partial_refund_pct;
  -- inside that, nothing.
  free_cancel_days        INTEGER       NOT NULL DEFAULT 21,
  partial_refund_days     INTEGER       NOT NULL DEFAULT 7,
  partial_refund_pct      NUMERIC(6,4)  NOT NULL DEFAULT 0.5000,

  currency                CHAR(3)       NOT NULL DEFAULT 'EGP',

  -- ── Versioning ────────────────────────────────────────────────────────────
  -- effective_to IS NULL means «this is the version in force».
  effective_from          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  effective_to            TIMESTAMPTZ,
  updated_by              UUID          REFERENCES public.users(id) ON DELETE SET NULL,
  note                    TEXT,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  -- ── Constraints ───────────────────────────────────────────────────────────
  -- PD-01 fixes the configurable band itself, so the band is a constraint and
  -- not a piece of admin-screen validation that a direct API call can skip.
  CONSTRAINT fs_min_margin_range        CHECK (min_margin_rate >= 0.0200 AND min_margin_rate <= 0.0250),
  CONSTRAINT fs_commission_range        CHECK (default_commission_rate >= 0 AND default_commission_rate <= 1),
  CONSTRAINT fs_deposit_range           CHECK (deposit_rate > 0 AND deposit_rate <= 1),
  CONSTRAINT fs_transfer_cap_positive   CHECK (transfer_fee_cap >= 0),
  CONSTRAINT fs_receivable_positive     CHECK (receivable_threshold >= 0),
  CONSTRAINT fs_points_per_egp_positive CHECK (points_per_egp > 0),
  CONSTRAINT fs_max_redemption_range    CHECK (max_redemption_pct >= 0 AND max_redemption_pct <= 1),
  CONSTRAINT fs_free_cancel_positive    CHECK (free_cancel_days >= 0),
  CONSTRAINT fs_partial_days_positive   CHECK (partial_refund_days >= 0),
  CONSTRAINT fs_partial_pct_range       CHECK (partial_refund_pct >= 0 AND partial_refund_pct <= 1),

  -- A partial-refund window that opened later than the free window would make
  -- the middle tier unreachable and the policy a lie.
  CONSTRAINT fs_tier_order              CHECK (free_cancel_days >= partial_refund_days),

  CONSTRAINT fs_effective_window        CHECK (effective_to IS NULL OR effective_to > effective_from),
  CONSTRAINT fs_currency_format         CHECK (currency ~ '^[A-Z]{3}$')
);


-- ── Exactly one open version ─────────────────────────────────────────────────
-- Indexing the constant expression (effective_to IS NULL) over only the rows
-- where it is true permits at most one such row. Without this, «the current
-- settings» would be a guess.
CREATE UNIQUE INDEX IF NOT EXISTS financial_settings_one_open
  ON public.financial_settings ((effective_to IS NULL))
  WHERE effective_to IS NULL;

-- Historical lookup: which version was in force at a given moment.
CREATE INDEX IF NOT EXISTS financial_settings_effective_idx
  ON public.financial_settings (effective_from DESC, effective_to);


-- ── Append-only guard ────────────────────────────────────────────────────────
-- The versioning above is only real if a version cannot be edited after the
-- fact. The one legal UPDATE is closing an open version; everything else, and
-- every DELETE, is refused.
CREATE OR REPLACE FUNCTION public.financial_settings_guard()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION
      'FINANCIAL_SETTINGS_IMMUTABLE: a settings version is never deleted — close it with effective_to';
  END IF;

  IF OLD.effective_to IS NOT NULL THEN
    RAISE EXCEPTION
      'FINANCIAL_SETTINGS_CLOSED: version % is already closed and cannot be changed', OLD.id;
  END IF;

  IF NEW.effective_to IS NULL THEN
    RAISE EXCEPTION
      'FINANCIAL_SETTINGS_IMMUTABLE: the only permitted update is setting effective_to';
  END IF;

  -- Closing a version must not smuggle a rate change in alongside it.
  IF (to_jsonb(NEW) - 'effective_to') IS DISTINCT FROM (to_jsonb(OLD) - 'effective_to') THEN
    RAISE EXCEPTION
      'FINANCIAL_SETTINGS_IMMUTABLE: supersede by inserting a new version, never by editing one';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS financial_settings_append_only ON public.financial_settings;
CREATE TRIGGER financial_settings_append_only
  BEFORE UPDATE OR DELETE ON public.financial_settings
  FOR EACH ROW EXECUTE FUNCTION public.financial_settings_guard();


-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Admin-only in every direction. This table carries PIMA's own commercial
-- position — the margin floor, the default commission, the transfer budget —
-- and none of that is a visitor's business. The customer-facing subset
-- (deposit rate, cancellation tiers, points conversion) will be exposed through
-- the canonical read model in 0149, as a narrow projection rather than by
-- opening this table up.
--
-- Nothing reads this table yet, so admin-only breaks nothing today.
ALTER TABLE public.financial_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "financial_settings_admin_read" ON public.financial_settings;
CREATE POLICY "financial_settings_admin_read" ON public.financial_settings
  FOR SELECT USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "financial_settings_admin_insert" ON public.financial_settings;
CREATE POLICY "financial_settings_admin_insert" ON public.financial_settings
  FOR INSERT WITH CHECK (public.is_admin(auth.uid()));

-- UPDATE exists solely so an admin can close a version; the guard trigger
-- decides what a close may contain.
DROP POLICY IF EXISTS "financial_settings_admin_close" ON public.financial_settings;
CREATE POLICY "financial_settings_admin_close" ON public.financial_settings
  FOR UPDATE USING (public.is_admin(auth.uid()))
           WITH CHECK (public.is_admin(auth.uid()));

-- No DELETE policy, deliberately.


-- ── Privileges ───────────────────────────────────────────────────────────────
-- Migration 0097 grants SELECT/INSERT/UPDATE/DELETE on ALL TABLES and EXECUTE on
-- ALL FUNCTIONS to anon and authenticated, and installs default privileges that
-- do the same for everything created afterwards. Every object below therefore
-- arrives publicly reachable unless this migration takes that back explicitly.
REVOKE ALL ON TABLE public.financial_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.financial_settings TO authenticated;
-- DELETE is granted to nobody; RLS then narrows the rest to admins.

-- A trigger function is never invoked directly — a direct call fails on the
-- missing trigger context — but 0097's blanket EXECUTE would still list it as
-- callable. Take it back.
REVOKE ALL ON FUNCTION public.financial_settings_guard() FROM PUBLIC, anon, authenticated;


-- ── Documentation ────────────────────────────────────────────────────────────
COMMENT ON TABLE public.financial_settings IS
  'Versioned, effective-dated financial configuration. Append-only: a version is closed with effective_to and superseded by a new row, never edited. Exactly one row may have effective_to IS NULL. Bookings snapshot the values they were taken under, so changing settings here never reprices history.';

COMMENT ON COLUMN public.financial_settings.min_margin_rate IS
  'PD-01. Measured against the FINAL customer price. A warning threshold requiring an audited override, never an automatic rejection.';
COMMENT ON COLUMN public.financial_settings.default_commission_rate IS
  'PD-07. Default for NEW Model C agreements only. Existing agreements and bookings carry their own rate.';
COMMENT ON COLUMN public.financial_settings.deposit_rate IS
  'PD-03 / PD-14. Share of the final post-discount customer price. PD-16 may raise a given booking''s deposit to PIMA''s gross margin; that floor is computed per booking, not stored here.';
COMMENT ON COLUMN public.financial_settings.transfer_fee_cap IS
  'PD-09. A budget cap, NOT a fee. Booking-time margin projection assumes the cap; the payout records the actual cost, which may be anything from zero up to it.';
COMMENT ON COLUMN public.financial_settings.receivable_threshold IS
  'PD-13b. Above this outstanding balance an owner receivable escalates from automatic netting to an explicit repayment demand.';
COMMENT ON COLUMN public.financial_settings.effective_to IS
  'NULL means this is the version in force. Setting it is the only permitted update to a row.';


-- ── Seed: the approved PD-01..PD-18 defaults ─────────────────────────────────
-- Guarded so a re-run cannot open a second version. updated_by is left NULL: no
-- administrator performed this, the migration did, and recording a person who
-- did not act would be the first false entry in a system built to prevent them.
INSERT INTO public.financial_settings (
  min_margin_rate, default_commission_rate, deposit_rate,
  transfer_fee_cap, receivable_threshold,
  points_per_egp, max_redemption_pct,
  free_cancel_days, partial_refund_days, partial_refund_pct,
  currency, note
)
SELECT
  0.0200,   -- PD-01  minimum PIMA margin, 2%
  0.0500,   -- PD-07  default commission, 5%
  0.3000,   -- PD-03  deposit, 30% of final customer price
  20.00,    -- PD-09  transfer fee CAP
  100.00,   -- PD-13b owner receivable escalation threshold
  100,      -- PD-17  100 points = 1 EGP
  0.1000,   -- redemption band, 10% of a booking
  21,       -- PD-10  100% refund at 21+ days
  7,        -- PD-10  50% refund at 7-20 days; 0% inside 7
  0.5000,   -- PD-10  partial refund share
  'EGP',
  'Initial version. Approved PD-01..PD-18 defaults, seeded by migration 0139.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.financial_settings WHERE effective_to IS NULL
);
