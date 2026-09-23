-- 0167_agreement_requests.sql
--
-- The commercial agreement workflow: owner proposes, admin decides, and only
-- the admin's decision reaches the financial core.
--
-- WHY
-- ---
-- house_agreements is admin-write-only and append-only, and that is correct:
-- it is the table the pricing engine reads, and an owner who could write it
-- could set his own entitlement. But it left owners with no way to ask for a
-- commercial model at all — every one of the four live agreements was applied
-- by hand as raw SQL.
--
-- This migration adds the missing half: a REQUEST that an owner can make, and
-- a REVIEW that only an admin can perform. The request is a proposal and
-- nothing more. It is never read by fin_price_booking, never priced against,
-- and cannot become authoritative on its own.
--
--     owner  ──request──▶  house_agreement_requests (PENDING)
--                                      │
--                          admin review │ approve / reject / request changes
--                                      ▼
--                          house_agreements (the only thing the engine reads)
--
-- NET_RATE — WHERE THE RESTRICTION ACTUALLY LIVES
-- ----------------------------------------------
-- NET_RATE is an administrative negotiation instrument, not a menu option.
-- Three independent layers stop an owner reaching it, and none of them is the
-- user interface:
--
--   1. har_model_type_valid — a CHECK on the REQUEST table admitting only
--      'MARKUP' and 'COMMISSION'. A NET_RATE request cannot be stored at all,
--      whatever calls the insert.
--   2. request_house_agreement() raises AGREEMENT_MODEL_NOT_SELECTABLE before
--      it gets that far, so the owner receives a sentence rather than a
--      constraint violation.
--   3. house_agreements keeps its admin-only RLS untouched. Even a successful
--      request writes nothing there; only an admin review does.
--
-- Hiding NET_RATE in the owner UI is the fourth layer and the least important.
--
-- WHAT THIS MIGRATION DOES NOT TOUCH
-- ----------------------------------
-- Not 0152, not 0153, not fin_price_booking, fin_quote_booking or
-- create_booking_with_financials. No financial formula, no deposit rule, no
-- transfer fee, no margin logic, no RPC signature. The existing RLS on
-- house_agreements is left exactly as it is: admin INSERT, admin close,
-- owner/admin read. No owner is granted INSERT or UPDATE on it.
--
-- No live agreement is altered and no agreement is created. The house with no
-- agreement (house_1789564533273) is deliberately left without one — the admin
-- resolves it through the workflow, not through a migration.
--
-- THE SINGLE WRITER
-- -----------------
-- Closing an agreement and inserting its successor is one operation and must
-- never be half-done. fin_apply_house_agreement() is the only code that writes
-- house_agreements, and both the approval path and the admin's direct path
-- call it. Same reasoning as 0153's fin_price_booking: one writer, so the two
-- routes cannot drift.
--
-- APPLIES AFTER: 0166_fin_quote_booking.sql

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. PRECONDITIONS
-- ═══════════════════════════════════════════════════════════════════════════

DO $pre$
DECLARE v_missing TEXT := '';
BEGIN
  IF to_regclass('public.house_agreements') IS NULL THEN
    v_missing := v_missing || E'\n  - public.house_agreements is absent';
  END IF;
  IF to_regprocedure('public.is_admin(uuid)') IS NULL THEN
    v_missing := v_missing || E'\n  - public.is_admin(uuid) is absent';
  END IF;
  IF to_regclass('public.houses') IS NULL THEN
    v_missing := v_missing || E'\n  - public.houses is absent';
  END IF;

  -- The financial core must already be in place: this workflow feeds it.
  IF to_regprocedure('public.fin_price_booking(uuid,text,date,date,integer,integer[],uuid,integer)') IS NULL THEN
    v_missing := v_missing || E'\n  - fin_price_booking is absent (apply 0153 first)';
  END IF;

  -- The admin-only write posture on house_agreements is the thing this
  -- migration relies on and must not have been relaxed beforehand.
  IF EXISTS (
    SELECT 1 FROM pg_policy
     WHERE polrelid = 'public.house_agreements'::regclass
       AND polcmd IN ('a','w')
       AND pg_get_expr(COALESCE(polwithcheck, polqual), polrelid) NOT LIKE '%is_admin%'
  ) THEN
    v_missing := v_missing || E'\n  - house_agreements has a non-admin INSERT/UPDATE policy; refusing to build on that';
  END IF;

  IF v_missing <> '' THEN
    RAISE EXCEPTION 'PRECONDITIONS FAILED for 0154:%', v_missing;
  END IF;
  RAISE NOTICE '0154 preconditions: OK';
END;
$pre$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. THE REQUEST TABLE
--
--    A proposal, not an agreement. Deliberately shaped like house_agreements
--    where the fields mean the same thing, so an approval is a copy rather
--    than a translation — but with NET_RATE's columns absent entirely, so the
--    model an owner may not choose has nowhere to live.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.house_agreement_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  house_id        TEXT NOT NULL REFERENCES public.houses(id) ON DELETE CASCADE,

  -- Requested commercial terms. A percentage only: under the corrected MARKUP
  -- semantics the base IS the house's own listed price, so there is nothing
  -- for an owner to quote separately. No net_rate column either, by design.
  model_type      TEXT NOT NULL,
  markup_pct      NUMERIC(6,4),
  commission_rate NUMERIC(6,4),
  currency        CHAR(3) NOT NULL DEFAULT 'EGP',
  owner_note      TEXT,

  status          TEXT NOT NULL DEFAULT 'PENDING',

  submitted_by    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_by     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at     TIMESTAMPTZ,
  admin_notes     TEXT,

  -- Set on approval: the authoritative agreement this request produced. The
  -- link is for audit only — nothing prices against it.
  agreement_id    UUID REFERENCES public.house_agreements(id) ON DELETE SET NULL,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- LAYER 1 of the NET_RATE restriction. Not a UI concern: a NET_RATE request
  -- is unstorable.
  CONSTRAINT har_model_type_valid
    CHECK (model_type = ANY (ARRAY['MARKUP'::text, 'COMMISSION'::text])),

  CONSTRAINT har_status_valid
    CHECK (status = ANY (ARRAY['PENDING'::text, 'APPROVED'::text, 'REJECTED'::text,
                               'CHANGES_REQUESTED'::text, 'CANCELLED'::text])),

  -- Mirrors ha_model_columns: the fields of the model you did not pick are NULL.
  CONSTRAINT har_model_columns CHECK (
    (model_type = 'MARKUP'     AND markup_pct IS NOT NULL AND commission_rate IS NULL)
 OR (model_type = 'COMMISSION' AND commission_rate IS NOT NULL AND markup_pct IS NULL)
  ),

  CONSTRAINT har_markup_non_negative  CHECK (markup_pct IS NULL OR markup_pct >= 0),
  CONSTRAINT har_commission_range     CHECK (commission_rate IS NULL
                                        OR (commission_rate >= 0 AND commission_rate <= 1)),
  CONSTRAINT har_currency_format      CHECK (currency ~ '^[A-Z]{3}$'),

  -- A decided request carries who decided it and when.
  CONSTRAINT har_reviewed_together CHECK (
    (status = 'PENDING' AND reviewed_by IS NULL AND reviewed_at IS NULL)
 OR (status = 'CANCELLED')
 OR (status <> 'PENDING' AND reviewed_at IS NOT NULL)
  ),

  -- Only an approval may name an agreement.
  CONSTRAINT har_agreement_only_on_approval CHECK (
    agreement_id IS NULL OR status = 'APPROVED'
  )
);

-- One open request per house. A decided request does not block a new one, so
-- CHANGES_REQUESTED is a real round trip rather than a dead end.
CREATE UNIQUE INDEX IF NOT EXISTS har_one_pending_per_house
  ON public.house_agreement_requests (house_id)
  WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS har_house_submitted_idx
  ON public.house_agreement_requests (house_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS har_status_idx
  ON public.house_agreement_requests (status) WHERE status = 'PENDING';

COMMENT ON TABLE public.house_agreement_requests IS
  'Owner proposals for a commercial model. A proposal, never an agreement: the financial core reads house_agreements only. MARKUP and COMMISSION only — NET_RATE is admin-negotiated and has no column here.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. RLS — the table is READ-ONLY to clients; every write goes through an RPC
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.house_agreement_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS har_owner_admin_read ON public.house_agreement_requests;
CREATE POLICY har_owner_admin_read ON public.house_agreement_requests
  FOR SELECT USING (
    public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.houses h
                WHERE h.id = house_agreement_requests.house_id
                  AND h.owner_id = auth.uid())
  );

-- Deliberately no INSERT, UPDATE or DELETE policy. Combined with the grants
-- below, that makes the SECURITY DEFINER functions the only writers — there is
-- no direct path for an owner OR an admin to hand-edit a request.
REVOKE ALL ON TABLE public.house_agreement_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.house_agreement_requests TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. THE SINGLE WRITER OF house_agreements
--
--    Close the incumbent, insert the successor, in one statement pair that
--    either both happen or neither does. Not callable by any client role: the
--    two wrappers below are the only entry points, and they decide authority.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fin_apply_house_agreement(
  p_house_id       TEXT,
  p_model_type     TEXT,
  p_markup_pct     NUMERIC,
  p_commission_rate NUMERIC,
  p_net_rate       NUMERIC,
  p_currency       CHAR(3),
  p_effective_from DATE,
  p_actor          UUID,
  p_note           TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_prior RECORD;
  v_id    UUID;
BEGIN
  IF p_effective_from IS NULL THEN
    RAISE EXCEPTION 'EFFECTIVE_FROM_REQUIRED';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.houses WHERE id = p_house_id) THEN
    RAISE EXCEPTION 'HOUSE_NOT_FOUND: %', p_house_id;
  END IF;

  -- Supersession, not editing. The incumbent is closed at exactly the moment
  -- the successor begins, so daterange [from, to) leaves no gap and no overlap
  -- for ha_no_overlap to reject.
  SELECT * INTO v_prior FROM public.house_agreements
   WHERE house_id = p_house_id AND effective_to IS NULL;

  IF FOUND THEN
    -- ha_effective_window demands effective_to > effective_from, so an
    -- agreement cannot be closed on the day it opened. Say so plainly rather
    -- than letting a CHECK violation surface.
    IF v_prior.effective_from >= p_effective_from THEN
      RAISE EXCEPTION
        'AGREEMENT_SAME_DAY_SUPERSEDE: the agreement in force began on % and cannot be superseded before % — choose a later effective date',
        v_prior.effective_from, v_prior.effective_from + 1;
    END IF;

    UPDATE public.house_agreements
       SET effective_to = p_effective_from, closed_by = p_actor
     WHERE id = v_prior.id;
  END IF;

  INSERT INTO public.house_agreements
    (house_id, model_type, markup_pct, commission_rate, net_rate,
     currency, effective_from, created_by, note)
  VALUES
    (p_house_id, p_model_type, p_markup_pct, p_commission_rate, p_net_rate,
     COALESCE(p_currency, 'EGP'), p_effective_from, p_actor, p_note)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.fin_apply_house_agreement(TEXT,TEXT,NUMERIC,NUMERIC,NUMERIC,CHAR,DATE,UUID,TEXT) IS
  'The only writer of house_agreements. Closes the incumbent and inserts the successor atomically. Never grant to a client role: it performs no authority check of its own.';

REVOKE ALL ON FUNCTION public.fin_apply_house_agreement(TEXT,TEXT,NUMERIC,NUMERIC,NUMERIC,CHAR,DATE,UUID,TEXT)
  FROM PUBLIC, anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. OWNER — submit a request
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.request_house_agreement(
  p_house_id        TEXT,
  p_model_type      TEXT,
  p_markup_pct      NUMERIC DEFAULT NULL,
  p_commission_rate NUMERIC DEFAULT NULL,
  p_owner_note      TEXT    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_id  UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  -- LAYER 2. Named explicitly so the caller learns the rule, not a constraint
  -- name. An owner may not select the negotiated model; an admin does not come
  -- through here at all — they create the agreement directly.
  IF p_model_type = 'NET_RATE' THEN
    RAISE EXCEPTION
      'AGREEMENT_MODEL_NOT_SELECTABLE: NET_RATE is agreed directly with PIMA and cannot be requested';
  END IF;
  IF p_model_type IS NULL OR p_model_type NOT IN ('MARKUP', 'COMMISSION') THEN
    RAISE EXCEPTION 'INVALID_AGREEMENT_MODEL: %', COALESCE(p_model_type, 'NULL');
  END IF;

  -- The house must be the caller's. An admin may also file one on a house's
  -- behalf, which is how a phone negotiation gets a paper trail.
  IF NOT EXISTS (
    SELECT 1 FROM public.houses h
     WHERE h.id = p_house_id AND (h.owner_id = v_uid OR public.is_admin(v_uid))
  ) THEN
    RAISE EXCEPTION 'NOT_YOUR_HOUSE: %', p_house_id;
  END IF;

  IF EXISTS (SELECT 1 FROM public.house_agreement_requests
              WHERE house_id = p_house_id AND status = 'PENDING') THEN
    RAISE EXCEPTION
      'AGREEMENT_REQUEST_PENDING: this house already has a request awaiting review';
  END IF;

  -- The check above loses a race against a simultaneous submission: both see
  -- no pending row and both proceed. har_one_pending_per_house then rejects
  -- the loser, and this handler turns that raw unique violation into the same
  -- sentence the check would have produced, so the owner is told the same
  -- thing either way.
  BEGIN
    INSERT INTO public.house_agreement_requests
      (house_id, model_type, markup_pct, commission_rate,
       owner_note, status, submitted_by)
    VALUES
      (p_house_id, p_model_type,
       CASE WHEN p_model_type = 'MARKUP' THEN p_markup_pct END,
       CASE WHEN p_model_type = 'COMMISSION' THEN p_commission_rate END,
       NULLIF(btrim(COALESCE(p_owner_note, '')), ''), 'PENDING', v_uid)
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION
      'AGREEMENT_REQUEST_PENDING: this house already has a request awaiting review';
  END;

  RETURN (SELECT to_jsonb(r) FROM public.house_agreement_requests r WHERE r.id = v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.request_house_agreement(TEXT,TEXT,NUMERIC,NUMERIC,TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_house_agreement(TEXT,TEXT,NUMERIC,NUMERIC,TEXT)
  TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. OWNER — withdraw one's own pending request
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.cancel_house_agreement_request(p_request_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_req RECORD;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;

  -- FOR UPDATE, not a plain read. Without the lock a withdrawal and an
  -- approval that both saw PENDING each proceed, and whichever writes last
  -- wins — which in one ordering silently resurrects a request the owner had
  -- already withdrawn. The lock makes the loser re-read and fail the status
  -- check below instead.
  SELECT * INTO v_req FROM public.house_agreement_requests
   WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'REQUEST_NOT_FOUND: %', p_request_id; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.houses h
     WHERE h.id = v_req.house_id AND (h.owner_id = v_uid OR public.is_admin(v_uid))
  ) THEN
    RAISE EXCEPTION 'NOT_YOUR_HOUSE: %', v_req.house_id;
  END IF;

  IF v_req.status <> 'PENDING' THEN
    RAISE EXCEPTION 'REQUEST_NOT_PENDING: request is % and can no longer be withdrawn', v_req.status;
  END IF;

  UPDATE public.house_agreement_requests
     SET status = 'CANCELLED', reviewed_at = NOW()
   WHERE id = p_request_id;

  RETURN (SELECT to_jsonb(r) FROM public.house_agreement_requests r WHERE r.id = p_request_id);
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_house_agreement_request(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_house_agreement_request(UUID) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. ADMIN — review a request
--
--    Approving is not the same as accepting. The admin may approve on terms
--    that differ from the request — including NET_RATE, which the owner could
--    not have asked for — because that is what a negotiation is. Any term left
--    NULL falls back to what was requested.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.review_house_agreement_request(
  p_request_id      UUID,
  p_decision        TEXT,
  p_admin_notes     TEXT    DEFAULT NULL,
  p_model_type      TEXT    DEFAULT NULL,
  p_markup_pct      NUMERIC DEFAULT NULL,
  p_commission_rate NUMERIC DEFAULT NULL,
  p_net_rate        NUMERIC DEFAULT NULL,
  p_effective_from  DATE    DEFAULT NULL,
  p_agreement_note  TEXT    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_req   RECORD;
  v_model TEXT;
  v_from  DATE;
  v_agr   UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF NOT public.is_admin(v_uid) THEN
    RAISE EXCEPTION 'ADMIN_ONLY: reviewing a commercial request requires an administrator';
  END IF;

  IF p_decision IS NULL OR p_decision NOT IN ('APPROVE', 'REJECT', 'REQUEST_CHANGES') THEN
    RAISE EXCEPTION 'INVALID_DECISION: %', COALESCE(p_decision, 'NULL');
  END IF;

  -- FOR UPDATE. Two administrators clicking approve at the same instant both
  -- read PENDING without it, and both go on to create an agreement; the lock
  -- serialises them so the second re-reads APPROVED and stops here, before any
  -- agreement is written.
  SELECT * INTO v_req FROM public.house_agreement_requests
   WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'REQUEST_NOT_FOUND: %', p_request_id; END IF;
  IF v_req.status <> 'PENDING' THEN
    RAISE EXCEPTION 'REQUEST_NOT_PENDING: request is already %', v_req.status;
  END IF;

  -- ── Reject / request changes: the request is decided, nothing is created ──
  IF p_decision IN ('REJECT', 'REQUEST_CHANGES') THEN
    IF p_decision = 'REQUEST_CHANGES'
       AND NULLIF(btrim(COALESCE(p_admin_notes, '')), '') IS NULL THEN
      RAISE EXCEPTION
        'ADMIN_NOTE_REQUIRED: asking for changes without saying what to change leaves the owner guessing';
    END IF;

    UPDATE public.house_agreement_requests
       SET status      = CASE p_decision WHEN 'REJECT' THEN 'REJECTED'
                                         ELSE 'CHANGES_REQUESTED' END,
           reviewed_by = v_uid,
           reviewed_at = NOW(),
           admin_notes = NULLIF(btrim(COALESCE(p_admin_notes, '')), '')
     WHERE id = p_request_id;

    RETURN (SELECT to_jsonb(r) FROM public.house_agreement_requests r WHERE r.id = p_request_id);
  END IF;

  -- ── Approve: the decided terms become the authoritative agreement ────────
  v_model := COALESCE(p_model_type, v_req.model_type);
  v_from  := COALESCE(p_effective_from, CURRENT_DATE);

  IF v_model NOT IN ('MARKUP', 'COMMISSION', 'NET_RATE') THEN
    RAISE EXCEPTION 'INVALID_AGREEMENT_MODEL: %', v_model;
  END IF;

  -- A negotiated outcome that departs from the request should say why. The
  -- owner reads this.
  IF v_model <> v_req.model_type
     AND NULLIF(btrim(COALESCE(p_admin_notes, '')), '') IS NULL THEN
    RAISE EXCEPTION
      'ADMIN_NOTE_REQUIRED: approving % when % was requested needs a reason the owner can read',
      v_model, v_req.model_type;
  END IF;

  v_agr := public.fin_apply_house_agreement(
    v_req.house_id,
    v_model,
    CASE WHEN v_model = 'MARKUP'     THEN COALESCE(p_markup_pct, v_req.markup_pct) END,
    CASE WHEN v_model = 'COMMISSION' THEN COALESCE(p_commission_rate, v_req.commission_rate) END,
    CASE WHEN v_model = 'NET_RATE'   THEN p_net_rate END,
    v_req.currency,
    v_from,
    v_uid,
    NULLIF(btrim(COALESCE(p_agreement_note, p_admin_notes, '')), '')
  );

  UPDATE public.house_agreement_requests
     SET status       = 'APPROVED',
         reviewed_by  = v_uid,
         reviewed_at  = NOW(),
         admin_notes  = NULLIF(btrim(COALESCE(p_admin_notes, '')), ''),
         agreement_id = v_agr
   WHERE id = p_request_id;

  RETURN (SELECT to_jsonb(r) || jsonb_build_object('agreement_id', v_agr)
            FROM public.house_agreement_requests r WHERE r.id = p_request_id);
END;
$$;

REVOKE ALL ON FUNCTION public.review_house_agreement_request(UUID,TEXT,TEXT,TEXT,NUMERIC,NUMERIC,NUMERIC,DATE,TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_house_agreement_request(UUID,TEXT,TEXT,TEXT,NUMERIC,NUMERIC,NUMERIC,DATE,TEXT)
  TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 8. ADMIN — create or supersede an agreement directly
--
--    No request needed. This is the route for a house that has never had an
--    agreement, and for a negotiated NET_RATE that began as a conversation
--    rather than a form.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.admin_set_house_agreement(
  p_house_id        TEXT,
  p_model_type      TEXT,
  p_markup_pct      NUMERIC DEFAULT NULL,
  p_commission_rate NUMERIC DEFAULT NULL,
  p_net_rate        NUMERIC DEFAULT NULL,
  p_effective_from  DATE    DEFAULT NULL,
  p_note            TEXT    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_id  UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF NOT public.is_admin(v_uid) THEN
    RAISE EXCEPTION 'ADMIN_ONLY: creating a commercial agreement requires an administrator';
  END IF;

  IF p_model_type IS NULL OR p_model_type NOT IN ('MARKUP', 'COMMISSION', 'NET_RATE') THEN
    RAISE EXCEPTION 'INVALID_AGREEMENT_MODEL: %', COALESCE(p_model_type, 'NULL');
  END IF;

  -- A negotiated rate is an exception to the standard models and is recorded
  -- as one.
  IF p_model_type = 'NET_RATE'
     AND NULLIF(btrim(COALESCE(p_note, '')), '') IS NULL THEN
    RAISE EXCEPTION
      'NEGOTIATION_NOTE_REQUIRED: a negotiated net rate must record why it was agreed';
  END IF;

  v_id := public.fin_apply_house_agreement(
    p_house_id, p_model_type,
    CASE WHEN p_model_type = 'MARKUP'     THEN p_markup_pct      END,
    CASE WHEN p_model_type = 'COMMISSION' THEN p_commission_rate END,
    CASE WHEN p_model_type = 'NET_RATE'   THEN p_net_rate        END,
    'EGP',
    COALESCE(p_effective_from, CURRENT_DATE),
    v_uid,
    NULLIF(btrim(COALESCE(p_note, '')), '')
  );

  RETURN (SELECT to_jsonb(a) FROM public.house_agreements a WHERE a.id = v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_house_agreement(TEXT,TEXT,NUMERIC,NUMERIC,NUMERIC,DATE,TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_house_agreement(TEXT,TEXT,NUMERIC,NUMERIC,NUMERIC,DATE,TEXT)
  TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 9. ADMIN — close an agreement without replacing it
--
--    Leaves the house with no agreement in force, which means it cannot be
--    booked on the new financial core. That is the point: it is how a house is
--    commercially suspended.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.admin_close_house_agreement(
  p_house_id     TEXT,
  p_effective_to DATE DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_a   RECORD;
  v_to  DATE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF NOT public.is_admin(v_uid) THEN
    RAISE EXCEPTION 'ADMIN_ONLY: closing a commercial agreement requires an administrator';
  END IF;

  SELECT * INTO v_a FROM public.house_agreements
   WHERE house_id = p_house_id AND effective_to IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NO_ACTIVE_AGREEMENT: house % has no agreement in force', p_house_id;
  END IF;

  v_to := COALESCE(p_effective_to, CURRENT_DATE);
  IF v_to <= v_a.effective_from THEN
    RAISE EXCEPTION
      'AGREEMENT_SAME_DAY_SUPERSEDE: the agreement in force began on % and cannot be closed before %',
      v_a.effective_from, v_a.effective_from + 1;
  END IF;

  UPDATE public.house_agreements
     SET effective_to = v_to, closed_by = v_uid
   WHERE id = v_a.id;

  RETURN (SELECT to_jsonb(a) FROM public.house_agreements a WHERE a.id = v_a.id);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_close_house_agreement(TEXT,DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_close_house_agreement(TEXT,DATE) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 10. VERIFICATION
-- ═══════════════════════════════════════════════════════════════════════════

DO $verify$
DECLARE
  v_fail TEXT := '';
  v_pass INTEGER := 0;
  v_t    TEXT;
  v_b    BOOLEAN;
  sig    TEXT;
  OWNER_FNS CONSTANT TEXT[] := ARRAY[
    'public.request_house_agreement(text,text,numeric,numeric,text)',
    'public.cancel_house_agreement_request(uuid)'];
  ADMIN_FNS CONSTANT TEXT[] := ARRAY[
    'public.review_house_agreement_request(uuid,text,text,text,numeric,numeric,numeric,date,text)',
    'public.admin_set_house_agreement(text,text,numeric,numeric,numeric,date,text)',
    'public.admin_close_house_agreement(text,date)'];
  WRITER    CONSTANT TEXT :=
    'public.fin_apply_house_agreement(text,text,numeric,numeric,numeric,bpchar,date,uuid,text)';
BEGIN
  -- table + RLS
  IF to_regclass('public.house_agreement_requests') IS NULL THEN
    v_fail := v_fail || E'\n  - house_agreement_requests was not created';
  ELSE v_pass := v_pass + 1; END IF;

  SELECT relrowsecurity INTO v_b FROM pg_class WHERE oid='public.house_agreement_requests'::regclass;
  IF NOT COALESCE(v_b,FALSE) THEN
    v_fail := v_fail || E'\n  - RLS is not enabled on house_agreement_requests';
  ELSE v_pass := v_pass + 1; END IF;

  -- the request table must be read-only to clients
  IF EXISTS (SELECT 1 FROM information_schema.role_table_grants
              WHERE table_schema='public' AND table_name='house_agreement_requests'
                AND grantee IN ('authenticated','anon')
                AND privilege_type IN ('INSERT','UPDATE','DELETE')) THEN
    v_fail := v_fail || E'\n  - authenticated/anon hold a write grant on house_agreement_requests';
  ELSE v_pass := v_pass + 1; END IF;

  IF EXISTS (SELECT 1 FROM pg_policy
              WHERE polrelid='public.house_agreement_requests'::regclass AND polcmd <> 'r') THEN
    v_fail := v_fail || E'\n  - house_agreement_requests has a non-SELECT policy; writes must go through the RPCs';
  ELSE v_pass := v_pass + 1; END IF;

  -- NET_RATE is unstorable as a request
  SELECT pg_get_constraintdef(oid) INTO v_t FROM pg_constraint
   WHERE conrelid='public.house_agreement_requests'::regclass AND conname='har_model_type_valid';
  IF v_t IS NULL OR v_t LIKE '%NET_RATE%' OR v_t NOT LIKE '%MARKUP%' OR v_t NOT LIKE '%COMMISSION%' THEN
    v_fail := v_fail || E'\n  - har_model_type_valid does not restrict requests to MARKUP/COMMISSION';
  ELSE v_pass := v_pass + 1; END IF;

  -- the owner RPC refuses NET_RATE in words, before the constraint fires
  SELECT (p.prosrc LIKE '%AGREEMENT_MODEL_NOT_SELECTABLE%') INTO v_b
    FROM pg_proc p WHERE p.oid = to_regprocedure(OWNER_FNS[1]);
  IF NOT COALESCE(v_b,FALSE) THEN
    v_fail := v_fail || E'\n  - request_house_agreement does not explicitly refuse NET_RATE';
  ELSE v_pass := v_pass + 1; END IF;

  -- every admin RPC checks is_admin
  FOREACH sig IN ARRAY ADMIN_FNS LOOP
    IF to_regprocedure(sig) IS NULL THEN
      v_fail := v_fail || E'\n  - missing function ' || sig;
    ELSE
      v_pass := v_pass + 1;
      SELECT (p.prosrc LIKE '%is_admin(v_uid)%') INTO v_b
        FROM pg_proc p WHERE p.oid = to_regprocedure(sig);
      IF NOT COALESCE(v_b,FALSE) THEN
        v_fail := v_fail || E'\n  - ' || sig || ' does not check is_admin';
      ELSE v_pass := v_pass + 1; END IF;
    END IF;
  END LOOP;

  -- security posture on every function this migration adds
  FOREACH sig IN ARRAY (OWNER_FNS || ADMIN_FNS || ARRAY[WRITER]) LOOP
    IF to_regprocedure(sig) IS NULL THEN
      v_fail := v_fail || E'\n  - missing function ' || sig;
      CONTINUE;
    END IF;
    SELECT p.prosecdef INTO v_b FROM pg_proc p WHERE p.oid = to_regprocedure(sig);
    IF NOT COALESCE(v_b,FALSE) THEN
      v_fail := v_fail || E'\n  - ' || sig || ' is not SECURITY DEFINER';
    ELSE v_pass := v_pass + 1; END IF;

    SELECT (p.proconfig::text LIKE '%search_path=public, pg_temp%') INTO v_b
      FROM pg_proc p WHERE p.oid = to_regprocedure(sig);
    IF NOT COALESCE(v_b,FALSE) THEN
      v_fail := v_fail || E'\n  - ' || sig || ' does not pin search_path';
    ELSE v_pass := v_pass + 1; END IF;

    IF has_function_privilege('anon', to_regprocedure(sig), 'EXECUTE') THEN
      v_fail := v_fail || E'\n  - anon can execute ' || sig;
    ELSE v_pass := v_pass + 1; END IF;
  END LOOP;

  -- the single writer stays private
  IF has_function_privilege('authenticated', to_regprocedure(WRITER), 'EXECUTE') THEN
    v_fail := v_fail || E'\n  - authenticated can execute fin_apply_house_agreement; it must not';
  ELSE v_pass := v_pass + 1; END IF;

  -- owner-callable RPCs are reachable
  FOREACH sig IN ARRAY OWNER_FNS LOOP
    IF NOT has_function_privilege('authenticated', to_regprocedure(sig), 'EXECUTE') THEN
      v_fail := v_fail || E'\n  - authenticated cannot execute ' || sig;
    ELSE v_pass := v_pass + 1; END IF;
  END LOOP;

  -- house_agreements RLS must be untouched: still admin-only for writes
  IF EXISTS (
    SELECT 1 FROM pg_policy
     WHERE polrelid='public.house_agreements'::regclass AND polcmd IN ('a','w')
       AND pg_get_expr(COALESCE(polwithcheck, polqual), polrelid) NOT LIKE '%is_admin%') THEN
    v_fail := v_fail || E'\n  - house_agreements gained a non-admin write policy';
  ELSE v_pass := v_pass + 1; END IF;

  SELECT count(*)::text INTO v_t FROM pg_policy
   WHERE polrelid='public.house_agreements'::regclass;
  IF v_t <> '3' THEN
    v_fail := v_fail || E'\n  - house_agreements has ' || v_t || ' policies, expected the original 3';
  ELSE v_pass := v_pass + 1; END IF;

  -- the financial core is untouched
  IF to_regprocedure('public.fin_price_booking(uuid,text,date,date,integer,integer[],uuid,integer)') IS NULL
     OR to_regprocedure('public.fin_quote_booking(text,date,date,integer,integer[],uuid,integer)') IS NULL
     OR to_regprocedure('public.create_booking_with_financials(text,text,date,date,integer,text,integer[],uuid,integer,text)') IS NULL THEN
    v_fail := v_fail || E'\n  - a financial-core function signature changed';
  ELSE v_pass := v_pass + 1; END IF;

  SELECT count(*)::text INTO v_t FROM pg_attribute
   WHERE attrelid='public.booking_financials'::regclass AND attgenerated='s';
  IF v_t <> '10' THEN
    v_fail := v_fail || E'\n  - booking_financials generated columns changed (' || v_t || ')';
  ELSE v_pass := v_pass + 1; END IF;

  IF v_fail <> '' THEN
    RAISE EXCEPTION '0154 VERIFICATION FAILED (% of 37 passed):%', v_pass, v_fail;
  END IF;
  IF v_pass <> 37 THEN
    RAISE EXCEPTION
      '0154 VERIFICATION INCOMPLETE: % assertions passed but 37 were expected — a check did not run',
      v_pass;
  END IF;
  RAISE NOTICE '0154 verification: 37 / 37 checks PASSED';
END;
$verify$;
