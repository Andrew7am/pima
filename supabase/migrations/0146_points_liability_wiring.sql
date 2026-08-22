-- ─────────────────────────────────────────────────────────────────────────────
-- 0146 — POINTS LIABILITY WIRING (PD-17)
--
-- Loyalty points are a promise to give money away later. Until now that promise
-- was recorded only as an integer on users.points, so PIMA could mint points
-- through four separate paths and never see what it had committed to. This
-- migration makes the promise appear in the ledger the moment it is made.
--
--     At EARNING:   PIMA_LOYALTY_EXPENSE  + x        (programme cost)
--                   POINTS_LIABILITY      − x        (what we now owe members)
--
-- ── WHY A TRIGGER ON points_history, NOT ON THE EARNING FUNCTIONS ───────────
--
-- There are SEVENTEEN separate `INSERT INTO points_history` sites across ten
-- migrations — booking points, review points, milestones, referral bonuses,
-- daily ad claims, and their redefinitions. Rewiring each earning function would
-- mean redefining eight of them, and would silently miss any that was
-- overlooked or added later.
--
-- Every path, without exception, writes a points_history row. So that is the
-- integration point: one trigger, and no earning path can mint points without
-- the liability appearing beside it — including paths written after this
-- migration, which need to do nothing to participate.
--
-- ── THE EARNING BOOKING'S MARGIN IS NOT TOUCHED (PD-17) ─────────────────────
--
-- The accrual posts to PIMA_LOYALTY_EXPENSE, which is PROGRAMME-level and — by
-- the rule established in 0141 — is never included in any booking's margin.
-- That exclusion is precisely what lets a booking-attributed earning carry its
-- booking_id for traceability without the earning booking paying for it.
--
-- ── ATTRIBUTION IS RECORDED, NEVER PARSED ───────────────────────────────────
--
-- points_history has no booking column, and the booking id is currently buried
-- in the row's TEXT primary key (`pt_earn_<booking>_<epoch>`). Parsing it back
-- out would be exactly the string heuristic this rebuild has spent five
-- migrations removing. So this adds a real, nullable booking_id instead. Legacy
-- rows stay NULL, which is honest: we do not know, and guessing is worse than
-- admitting it.
--
-- ── SCOPE: EARNING ONLY ─────────────────────────────────────────────────────
--
-- The trigger fires for `type = 'earned'` and nothing else. Redemption cannot be
-- posted here, because the approved entry needs the booking that consumed the
-- points:
--
--     POINTS_LIABILITY +x · PIMA_POINTS_EXPENSE +x · PIMA_LOYALTY_EXPENSE −x · POINTS_APPLIED −x
--
-- and the legacy redeem_points() has no booking to offer. 0147's atomic booking
-- RPC owns that entry in full. The same applies to the `pt_revert_` claw-back
-- path, which shares type='redeemed' with genuine redemptions and would have to
-- be told apart by its id prefix — another heuristic, and another reason to wait
-- for the RPC that knows what it is doing.
--
-- CONSEQUENCE, STATED PLAINLY: between this migration and 0147 the invariant
--
--     SUM(users.points) / points_per_egp  =  −SUM(POINTS_LIABILITY)
--
-- holds for earning and drifts on any legacy redemption. fin_points_reconciliation()
-- below reports that difference rather than hiding it, and the 0150 reset clears
-- both sides before the new world begins.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── Honest attribution ───────────────────────────────────────────────────────
-- Nullable, and SET NULL on booking deletion: which booking earned a point is
-- traceability, not money. The money is in the ledger and must never be blocked
-- or lost by a booking going away.
ALTER TABLE public.points_history
  ADD COLUMN IF NOT EXISTS booking_id TEXT REFERENCES public.bookings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS points_history_booking_idx
  ON public.points_history (booking_id) WHERE booking_id IS NOT NULL;

COMMENT ON COLUMN public.points_history.booking_id IS
  'The booking that caused this points event, when one did. Nullable: programme-level earning (referral, review, daily ad) legitimately has none, and legacy rows predate this column. Never inferred from the id prefix — attribution is recorded or it is absent.';


-- ── The EGP value of a points amount ─────────────────────────────────────────
-- Reads the settings version in force. Points are denominated in the platform
-- currency; there is no FX anywhere in this system.
CREATE OR REPLACE FUNCTION public.fin_points_to_egp(p_points INTEGER)
RETURNS NUMERIC LANGUAGE sql STABLE
SET search_path = public, pg_temp AS $$
  SELECT ROUND(p_points::numeric / NULLIF(
           (SELECT points_per_egp FROM public.financial_settings
             WHERE effective_to IS NULL ORDER BY effective_from DESC LIMIT 1), 0), 2);
$$;


-- ── The accrual ──────────────────────────────────────────────────────────────
-- SECURITY DEFINER because the ledger has no INSERT policy at all: entries are
-- posted by trusted server-side code or not at all.
CREATE OR REPLACE FUNCTION public.fin_post_points_earning()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_value  NUMERIC;
  v_cur    CHAR(3);
  v_txn    UUID;
  v_house  TEXT;
  v_owner  UUID;
BEGIN
  v_value := public.fin_points_to_egp(NEW.amount);

  -- A points award worth less than a piastre after rounding has no ledger entry
  -- to make: fin_transaction_legs refuses a zero amount, correctly. Reported by
  -- fin_points_reconciliation() as rounding residue rather than passed over in
  -- silence.
  IF v_value IS NULL OR v_value = 0 THEN
    RETURN NULL;
  END IF;

  SELECT currency INTO v_cur FROM public.financial_settings
   WHERE effective_to IS NULL ORDER BY effective_from DESC LIMIT 1;

  -- Identity is read, never assumed. A programme-level award has no booking and
  -- therefore no house or owner, which is the correct shape for it (BLOCKED-5).
  IF NEW.booking_id IS NOT NULL THEN
    SELECT b.house_id, h.owner_id INTO v_house, v_owner
      FROM public.bookings b JOIN public.houses h ON h.id = b.house_id
     WHERE b.id = NEW.booking_id;
  END IF;

  v_txn := gen_random_uuid();

  INSERT INTO public.fin_transactions
    (id, txn_type, booking_id, house_id, owner_id, currency,
     reference_type, reference_id, idempotency_key, memo)
  VALUES
    (v_txn, 'points_liability', NEW.booking_id, v_house, v_owner, COALESCE(v_cur, 'EGP'),
     'points_history', NEW.id,
     -- points_history.id is a TEXT primary key, so this is unique by construction
     -- and a replayed award cannot accrue the liability twice.
     'pts:earn:' || NEW.id,
     NEW.description);

  INSERT INTO public.fin_transaction_legs (txn_id, account, amount, party_id) VALUES
    (v_txn, 'PIMA_LOYALTY_EXPENSE',  v_value, NULL),
    (v_txn, 'POINTS_LIABILITY',     -v_value, NEW.user_id);

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS points_history_accrue_liability ON public.points_history;
CREATE TRIGGER points_history_accrue_liability
  AFTER INSERT ON public.points_history
  FOR EACH ROW WHEN (NEW.type = 'earned')
  EXECUTE FUNCTION public.fin_post_points_earning();


-- ── Reconciliation ───────────────────────────────────────────────────────────
-- The invariant, reported rather than assumed. `wired` names which halves of the
-- points lifecycle currently post to the ledger, so a difference can be read
-- correctly instead of alarming someone about a gap this migration documents.
CREATE OR REPLACE FUNCTION public.fin_points_reconciliation()
RETURNS TABLE (
  member_points_egp NUMERIC,
  ledger_liability  NUMERIC,
  difference        NUMERIC,
  wired             TEXT
) LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'NOT_ALLOWED';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(public.fin_points_to_egp(SUM(u.points)::int), 0),
    COALESCE((SELECT -SUM(l.amount) FROM public.fin_transaction_legs l
               WHERE l.account = 'POINTS_LIABILITY'), 0),
    COALESCE(public.fin_points_to_egp(SUM(u.points)::int), 0)
      - COALESCE((SELECT -SUM(l.amount) FROM public.fin_transaction_legs l
                   WHERE l.account = 'POINTS_LIABILITY'), 0),
    'earning'::TEXT
  FROM public.users u;
END;
$$;


-- ── Privileges ───────────────────────────────────────────────────────────────
-- Migration 0097 grants EXECUTE on ALL FUNCTIONS to anon and authenticated, with
-- default privileges repeating it for anything created afterwards. Every
-- function here therefore arrives publicly callable unless taken back.
REVOKE ALL ON FUNCTION public.fin_points_to_egp(INTEGER)      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fin_post_points_earning()       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fin_points_reconciliation()     FROM PUBLIC, anon, authenticated;

-- The reconciliation report is an admin tool and checks is_admin() internally;
-- authenticated may call it, and a non-admin is refused inside.
GRANT EXECUTE ON FUNCTION public.fin_points_reconciliation() TO authenticated;
-- fin_points_to_egp and the trigger function are internal: no GRANT at all.


COMMENT ON FUNCTION public.fin_post_points_earning() IS
  'PD-17: accrues the loyalty liability when points are earned, from any of the seventeen points_history insert sites. Posts PIMA_LOYALTY_EXPENSE (programme-level, excluded from every booking margin) against POINTS_LIABILITY. Idempotent on points_history.id. Redemption and claw-back are NOT posted here — 0147 owns those, because the approved entry needs the booking that consumed the points.';

COMMENT ON FUNCTION public.fin_points_reconciliation() IS
  'Reports SUM(users.points)/points_per_egp against -SUM(POINTS_LIABILITY). Exact once 0147 wires redemption; until then `wired` reads ''earning'' and any difference is legacy redemption, not corruption. Admin only.';
