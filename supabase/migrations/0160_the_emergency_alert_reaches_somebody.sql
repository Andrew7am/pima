-- ============================================================
-- The emergency alert reaches somebody
--
-- «تنبيه عاجل» in the conference hub wrote to React state and nowhere else.
-- ConferenceRoom.instantAlert exists in the TypeScript type; there has never
-- been a column for it and the row mapper never carried it. So the supervisor
-- typed «الأتوبيس هيتحرك بعد ربع ساعة», the screen answered «تم بث التنبيه
-- العاجل لجميع شاشات الحضور الآن», and the message existed only in the tab it
-- was typed into. It did not survive a reload on the sender's own phone.
--
-- Two halves, and both matter:
--
--   1. The column, so the alert is real and anyone opening the hub sees it.
--   2. A row in `notifications` for every person it concerns — which is what
--      makes it arrive rather than wait to be found. notifications is already
--      in the realtime publication, so an open app shows it immediately; and
--      an INSERT there is exactly the hook send-push is written to fire from,
--      so a closed phone is reached too the moment that webhook is wired.
--
-- WHO IT REACHES is wider than the conference on purpose. A group of forty
-- books a house; some of them joined the conference hub, most never will. An
-- emergency addressed only to the people who typed a code is not an emergency
-- broadcast. So: everyone in joined_user_ids, plus every attendee of the
-- underlying booking who has an account (0156). The sender is excluded — being
-- notified of your own alert reads as the app not knowing who you are.
-- ============================================================

ALTER TABLE public.conferences
  ADD COLUMN IF NOT EXISTS instant_alert JSONB;

COMMENT ON COLUMN public.conferences.instant_alert IS
  'The current urgent notice, or NULL when cleared. One at a time by design: a '
  'stack of urgent banners is a stack of ignored banners.';

CREATE OR REPLACE FUNCTION public.broadcast_conference_alert(
  p_conference_id TEXT,
  p_message       TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  me        UUID := auth.uid();
  c         public.conferences%ROWTYPE;
  msg       TEXT := TRIM(COALESCE(p_message, ''));
  my_name   TEXT;
  v_alert   JSONB;
  v_title   TEXT;
  n         INTEGER := 0;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'لازم تسجّل دخولك الأول.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF msg = '' THEN
    RAISE EXCEPTION 'اكتب نص التنبيه الأول.' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO c FROM public.conferences WHERE id = p_conference_id;
  IF c.id IS NULL THEN
    RAISE EXCEPTION 'المؤتمر غير موجود.' USING ERRCODE = 'no_data_found';
  END IF;

  -- Only the host. A button cannot enforce this: the RPC is reachable without
  -- one, and an alert carrying Pima's name on forty lock screens is not
  -- something any participant should be able to send.
  IF c.host_user_id <> me AND NOT public.is_admin(me) THEN
    RAISE EXCEPTION 'التنبيه العاجل لمسؤول المؤتمر بس.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT name INTO my_name FROM public.users WHERE id = me;

  v_alert := jsonb_build_object(
    'id', 'alert_' || substr(md5(random()::text || clock_timestamp()::text), 1, 12),
    'message', msg,
    'sentAt', (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
    'senderName', COALESCE(NULLIF(my_name, ''), 'مسؤول المؤتمر')
  );

  UPDATE public.conferences
     SET instant_alert = v_alert
   WHERE id = c.id;

  v_title := '🚨 تنبيه عاجل: ' || COALESCE(NULLIF(c.title, ''), 'المؤتمر');

  -- Everyone who joined the hub, and everyone on the booking with an account.
  -- UNION, not UNION ALL: a person who is both gets one notification.
  INSERT INTO public.notifications (id, user_id, booking_id, title, message, type, is_read)
  SELECT
    'ntf_' || substr(md5(random()::text || clock_timestamp()::text || r.uid::text), 1, 16),
    r.uid, c.booking_id, v_title, msg, 'danger', FALSE
  FROM (
    SELECT (jsonb_array_elements_text(COALESCE(c.joined_user_ids, '[]'::JSONB)))::UUID AS uid
    UNION
    SELECT a.user_id AS uid
      FROM public.attendees a
     WHERE a.booking_id = c.booking_id
       AND a.user_id IS NOT NULL
  ) r
  WHERE r.uid IS DISTINCT FROM me;

  GET DIAGNOSTICS n = ROW_COUNT;

  RETURN jsonb_build_object('ok', TRUE, 'alert', v_alert, 'notified', n);
END;
$$;

-- Clearing is the host's too, and takes the banner down everywhere at once.
-- The notifications already sent are left alone: they are a record of what was
-- said, and deleting them would rewrite it.
CREATE OR REPLACE FUNCTION public.clear_conference_alert(p_conference_id TEXT)
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
  IF c.host_user_id <> me AND NOT public.is_admin(me) THEN
    RAISE EXCEPTION 'التنبيه العاجل لمسؤول المؤتمر بس.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE public.conferences SET instant_alert = NULL WHERE id = c.id;
  RETURN jsonb_build_object('ok', TRUE);
END;
$$;

REVOKE ALL ON FUNCTION public.broadcast_conference_alert(TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.clear_conference_alert(TEXT)           FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.broadcast_conference_alert(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_conference_alert(TEXT)           TO authenticated;

COMMENT ON FUNCTION public.broadcast_conference_alert(TEXT, TEXT) IS
  'Stores the urgent notice on the conference and files a notification for '
  'everyone it concerns — hub joiners and the booking''s linked attendees, who '
  'are mostly not the same people. The notifications INSERT is what send-push '
  'fires from, so wiring that webhook is what reaches a closed phone.';
