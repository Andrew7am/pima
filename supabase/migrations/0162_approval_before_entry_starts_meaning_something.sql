-- ============================================================
-- «موافقة قبل الدخول» starts meaning something
--
-- conferences.joining_requirements has had two values since it was created:
-- 'open' and 'approval_needed'. Nothing has ever enforced the second. 0134's
-- join_conference_by_code adds the caller to joined_user_ids either way and
-- returns a needsApproval flag for the hub to honour — and the hub honours it
-- through pendingUserRequests, which is in the TypeScript type, has an approve
-- and a reject button already built, and has never had a column.
--
-- So a host who set «موافقة قبل الدخول» got a setting that changed nothing:
-- everyone with the code was in, immediately, with full read access. The
-- screen said the setting was on. That is worse than not offering it.
--
-- The fix is where the fix has to be. Joining an approval_needed conference
-- now writes to pending_requests and NOT to joined_user_ids — which is what
-- the RLS policy reads, so a pending person cannot see inside. Nothing about
-- the policy changes; it was already right. What was wrong was that everyone
-- was being put on the list it checks.
--
-- The host is told someone asked. The asker is told when they are let in, or
-- when they are not — a request that vanishes silently is indistinguishable
-- from a broken app, and they will just type the code again.
-- ============================================================

ALTER TABLE public.conferences
  ADD COLUMN IF NOT EXISTS pending_requests JSONB NOT NULL DEFAULT '[]'::JSONB;

COMMENT ON COLUMN public.conferences.pending_requests IS
  'Who has asked to join an approval_needed conference and is not yet in. '
  'Deliberately separate from joined_user_ids, which is what RLS reads: being '
  'on this list grants nothing.';

-- ── Joining, with the setting honoured ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.join_conference_by_code(code TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  me       UUID := auth.uid();
  c        public.conferences%ROWTYPE;
  already  BOOLEAN;
  waiting  BOOLEAN;
  my_name  TEXT;
  my_email TEXT;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'لازم تسجّل دخولك الأول.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO c FROM public.conferences
   WHERE UPPER(conference_code) = UPPER(TRIM(code));
  IF c.id IS NULL THEN
    RAISE EXCEPTION 'الكود ده مش موجود. اتأكد منه مع مسؤول المؤتمر.' USING ERRCODE = 'no_data_found';
  END IF;
  IF c.is_disabled THEN
    RAISE EXCEPTION 'المؤتمر ده مقفول حالياً.' USING ERRCODE = 'check_violation';
  END IF;

  already := c.joined_user_ids @> to_jsonb(ARRAY[me::TEXT]);

  -- Already in, by either route. Idempotent: scanning the QR twice, or
  -- rejoining after a reinstall, must not read as a failure.
  IF already OR c.host_user_id = me THEN
    RETURN jsonb_build_object('ok', TRUE, 'conferenceId', c.id, 'title', c.title,
                              'alreadyJoined', TRUE, 'needsApproval', FALSE, 'pending', FALSE);
  END IF;

  IF c.joining_requirements <> 'approval_needed' THEN
    UPDATE public.conferences
       SET joined_user_ids = joined_user_ids || to_jsonb(ARRAY[me::TEXT])
     WHERE id = c.id;
    RETURN jsonb_build_object('ok', TRUE, 'conferenceId', c.id, 'title', c.title,
                              'alreadyJoined', FALSE, 'needsApproval', FALSE, 'pending', FALSE);
  END IF;

  -- Approval needed. The request is recorded; the door stays shut.
  waiting := EXISTS (
    SELECT 1 FROM jsonb_array_elements(c.pending_requests) r
     WHERE r->>'userId' = me::TEXT
  );

  IF NOT waiting THEN
    SELECT name, email INTO my_name, my_email FROM public.users WHERE id = me;

    UPDATE public.conferences
       SET pending_requests = pending_requests || jsonb_build_array(jsonb_build_object(
             'userId', me::TEXT,
             'userName', COALESCE(NULLIF(my_name, ''), 'مشارك'),
             'userEmail', COALESCE(my_email, ''),
             'askedAt', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
           ))
     WHERE id = c.id;

    -- The host has to know, or the request waits until they happen to look.
    INSERT INTO public.notifications (id, user_id, booking_id, title, message, type, is_read)
    VALUES ('ntf_' || substr(md5(random()::text || clock_timestamp()::text), 1, 16),
            c.host_user_id, c.booking_id,
            'طلب انضمام جديد',
            COALESCE(NULLIF(my_name, ''), 'حد') || ' طلب ينضم لـ' || COALESCE(NULLIF(c.title, ''), 'مؤتمرك') || '.',
            'info', FALSE);
  END IF;

  RETURN jsonb_build_object('ok', TRUE, 'conferenceId', c.id, 'title', c.title,
                            'alreadyJoined', FALSE, 'needsApproval', TRUE, 'pending', TRUE);
END;
$$;

-- ── The host decides ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.decide_join_request(
  p_conference_id TEXT,
  p_user_id       UUID,
  p_approve       BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  me UUID := auth.uid();
  c  public.conferences%ROWTYPE;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'لازم تسجّل دخولك الأول.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO c FROM public.conferences WHERE id = p_conference_id;
  IF c.id IS NULL THEN
    RAISE EXCEPTION 'المؤتمر غير موجود.' USING ERRCODE = 'no_data_found';
  END IF;

  -- Only the host. A button cannot enforce this; the RPC is reachable without
  -- one, and letting yourself in is exactly what the setting exists to stop.
  IF c.host_user_id <> me AND NOT public.is_admin(me) THEN
    RAISE EXCEPTION 'قبول الطلبات لمسؤول المؤتمر بس.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE public.conferences
     SET pending_requests = COALESCE((
           SELECT jsonb_agg(r) FROM jsonb_array_elements(pending_requests) r
            WHERE r->>'userId' <> p_user_id::TEXT
         ), '[]'::JSONB),
         joined_user_ids = CASE
           WHEN p_approve AND NOT (joined_user_ids @> to_jsonb(ARRAY[p_user_id::TEXT]))
             THEN joined_user_ids || to_jsonb(ARRAY[p_user_id::TEXT])
           ELSE joined_user_ids
         END
   WHERE id = c.id;

  -- Told either way. A request that vanishes silently is indistinguishable
  -- from a broken app, and they will just type the code again.
  INSERT INTO public.notifications (id, user_id, booking_id, title, message, type, is_read)
  VALUES ('ntf_' || substr(md5(random()::text || clock_timestamp()::text), 1, 16),
          p_user_id, c.booking_id,
          CASE WHEN p_approve THEN 'اتقبلت في ' || COALESCE(NULLIF(c.title, ''), 'المؤتمر')
               ELSE 'طلبك ما اتقبلش' END,
          CASE WHEN p_approve THEN 'تقدر تدخل على المؤتمر دلوقتي.'
               ELSE 'مسؤول ' || COALESCE(NULLIF(c.title, ''), 'المؤتمر') || ' ما قبلش طلب انضمامك. كلّمه لو ده مش متوقع.' END,
          CASE WHEN p_approve THEN 'success' ELSE 'info' END, FALSE);

  RETURN jsonb_build_object('ok', TRUE, 'approved', p_approve);
END;
$$;

-- ── The asker can see they are waiting ──────────────────────────────────────
-- Without this a pending person reloads and the app has nothing to tell them:
-- RLS correctly refuses them the conference, so the screen would be blank and
-- they would type the code again. Title only — being on the list grants
-- nothing else.
CREATE OR REPLACE FUNCTION public.my_pending_conference_requests()
RETURNS TABLE (conference_id TEXT, title TEXT, asked_at TEXT)
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp AS $$
  SELECT c.id, c.title, r->>'askedAt'
    FROM public.conferences c,
         LATERAL jsonb_array_elements(c.pending_requests) r
   WHERE r->>'userId' = auth.uid()::TEXT
     AND NOT c.is_disabled;
$$;

REVOKE ALL ON FUNCTION public.decide_join_request(TEXT, UUID, BOOLEAN)  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_pending_conference_requests()          FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.join_conference_by_code(TEXT)             FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decide_join_request(TEXT, UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_pending_conference_requests()         TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_conference_by_code(TEXT)            TO authenticated;

COMMENT ON FUNCTION public.join_conference_by_code(TEXT) IS
  'Open conferences admit on the code. approval_needed ones record the request '
  'and leave joined_user_ids alone — which is the list RLS reads, so the door '
  'really is shut until the host opens it.';
