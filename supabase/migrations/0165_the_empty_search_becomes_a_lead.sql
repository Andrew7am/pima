-- ============================================================
-- The empty search stops being a dead end
--
-- Pima has houses in one governorate. The filter offers twenty-seven, so
-- twenty-six of them end on «عذراً، لم نجد بيوت تطابق معايير بحثك» and the
-- visit ends there. The reader leaves, and Pima never learns they came.
--
-- What they were looking for is the most useful thing anybody can tell the
-- platform right now. It says which governorate to go and find a house in,
-- with dates and a group size attached, instead of a guess. So the empty
-- result asks for a way to call them back, and keeps it.
--
-- The table holds phone numbers, so nothing but the admin can read it.
--
-- It is written through an RPC rather than an INSERT policy. An open policy
-- on a table anon can write is a table anon can also shape — any column, any
-- value, as many rows as they like. The RPC is the one door, and the
-- validation, the trimming and the duplicate check all live behind it.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.place_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Null for a visitor who never signed in. They are who this is most for:
  -- no account, no booking, nothing else anywhere that records they existed.
  user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name         TEXT NOT NULL,
  phone        TEXT NOT NULL,
  -- Where they were looking. Null when the search was free text with no place
  -- in it — still worth keeping, and `note` carries what they typed.
  governorate  TEXT,
  check_in     DATE,
  check_out    DATE,
  guests       INT,
  note         TEXT,
  status       TEXT NOT NULL DEFAULT 'new'
);

ALTER TABLE public.place_requests
  DROP CONSTRAINT IF EXISTS place_requests_status_known;

ALTER TABLE public.place_requests
  ADD CONSTRAINT place_requests_status_known
    CHECK (status IN ('new', 'contacted', 'closed'));

-- The panel's main question is "how many people asked for each place", and
-- its second is "who, most recent first".
CREATE INDEX IF NOT EXISTS place_requests_gov_idx
  ON public.place_requests (governorate, created_at DESC);

COMMENT ON TABLE public.place_requests IS
  'Somebody searched for a place Pima has no house in and left a number. The '
  'demand list: which governorate to go and get a house in, and who is '
  'waiting there. Admin-read only, it holds phone numbers.';

-- == Who may see it =======================================================
ALTER TABLE public.place_requests ENABLE ROW LEVEL SECURITY;

-- Deliberately no INSERT policy. Rows arrive through request_place(), which
-- runs as the definer and therefore does not need one; without a policy, a
-- direct INSERT from the client is refused.
DROP POLICY IF EXISTS place_requests_admin_read ON public.place_requests;
CREATE POLICY place_requests_admin_read ON public.place_requests
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- Marking one «اتصلنا بيه». The same gate, because it is the same row.
DROP POLICY IF EXISTS place_requests_admin_update ON public.place_requests;
CREATE POLICY place_requests_admin_update ON public.place_requests
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

REVOKE ALL ON TABLE public.place_requests FROM PUBLIC, anon;
GRANT SELECT, UPDATE ON TABLE public.place_requests TO authenticated;

-- == The one door in ======================================================
CREATE OR REPLACE FUNCTION public.request_place(
  p_name        TEXT,
  p_phone       TEXT,
  p_governorate TEXT DEFAULT NULL,
  p_check_in    DATE DEFAULT NULL,
  p_check_out   DATE DEFAULT NULL,
  p_guests      INT  DEFAULT NULL,
  p_note        TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_name  TEXT := NULLIF(BTRIM(COALESCE(p_name, '')), '');
  v_gov   TEXT := NULLIF(BTRIM(COALESCE(p_governorate, '')), '');
  -- Kept as digits so that 0100 123 4567 and 01001234567 are one person when
  -- the duplicate check runs, and so the admin can paste it into a dialler.
  v_phone TEXT := regexp_replace(COALESCE(p_phone, ''), '[^0-9+]', '', 'g');
  v_dupe  UUID;
  v_id    UUID;
BEGIN
  IF v_name IS NULL OR char_length(v_name) < 2 THEN
    RAISE EXCEPTION 'اكتب اسمك من فضلك.' USING ERRCODE = 'check_violation';
  END IF;
  IF char_length(v_phone) < 8 OR char_length(v_phone) > 15 THEN
    RAISE EXCEPTION 'رقم الموبايل مش مظبوط.' USING ERRCODE = 'check_violation';
  END IF;
  IF p_check_in IS NOT NULL AND p_check_out IS NOT NULL AND p_check_out <= p_check_in THEN
    RAISE EXCEPTION 'تاريخ الخروج لازم يكون بعد تاريخ الدخول.' USING ERRCODE = 'check_violation';
  END IF;

  -- One person asking twice for the same place in a day is one request. This
  -- is the whole rate limit, and it is enough for what the table is: a call
  -- list, and a call list with the same number forty times is not a list.
  SELECT id INTO v_dupe
    FROM public.place_requests
   WHERE phone = v_phone
     AND COALESCE(governorate, '') = COALESCE(v_gov, '')
     AND created_at > now() - INTERVAL '24 hours'
   LIMIT 1;

  -- The answer is the same either way, on purpose. Telling the caller «we
  -- already have this number» would turn the form into a way of asking
  -- whether a given phone is on the list.
  IF v_dupe IS NULL THEN
    INSERT INTO public.place_requests (
      user_id, name, phone, governorate, check_in, check_out, guests, note
    ) VALUES (
      auth.uid(), v_name, v_phone, v_gov, p_check_in, p_check_out,
      CASE WHEN p_guests BETWEEN 1 AND 10000 THEN p_guests END,
      NULLIF(BTRIM(COALESCE(p_note, '')), '')
    )
    RETURNING id INTO v_id;
  END IF;

  RETURN jsonb_build_object('ok', TRUE);
END;
$$;

REVOKE ALL ON FUNCTION public.request_place(TEXT, TEXT, TEXT, DATE, DATE, INT, TEXT) FROM PUBLIC;
-- anon too: the visitor this is for has not signed in, and asking them to
-- make an account before they can say «كلموني» is the dead end again.
GRANT EXECUTE ON FUNCTION public.request_place(TEXT, TEXT, TEXT, DATE, DATE, INT, TEXT)
  TO anon, authenticated;

COMMENT ON FUNCTION public.request_place(TEXT, TEXT, TEXT, DATE, DATE, INT, TEXT) IS
  'The only way a row gets into place_requests. Validates, trims, collapses a '
  'repeat from the same number within a day, and returns the same answer '
  'whether it wrote a row or not.';
