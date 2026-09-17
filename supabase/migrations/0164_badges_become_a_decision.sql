-- ============================================================
-- The badges on a card become somebody's decision
--
-- Two labels used to appear on a house card on their own:
--
--   «الأكثر حجزًا»        — any house with 3+ confirmed bookings in a year
--   «حجزتم هنا قبل كده»   — shown to a guest who had stayed there
--
-- Both are now the admin's to set, so the badge is a choice about what to put
-- forward rather than a threshold nobody picked. One column, holding the label
-- itself: a boolean per badge would need a migration for every new one, and
-- the set will grow.
--
-- Constrained to a known list rather than free text. A badge is Pima speaking
-- in its own voice on a card, and «آخر غرفتين!» typed into a box at two in the
-- morning is a claim the platform cannot stand behind.
--
-- «حجزتم هنا قبل كده» is deliberately NOT on the list. It is a statement about
-- the person reading it, not about the house, so an admin switching it on
-- would be telling every visitor they had stayed somewhere they have not. The
-- automatic version that knew this was true is removed with it; if it comes
-- back it has to come back knowing who it is talking to.
-- ============================================================

ALTER TABLE public.houses
  ADD COLUMN IF NOT EXISTS badge TEXT;

ALTER TABLE public.houses
  DROP CONSTRAINT IF EXISTS houses_badge_known;

ALTER TABLE public.houses
  ADD CONSTRAINT houses_badge_known CHECK (
    badge IS NULL OR badge IN ('most_booked', 'new', 'featured', 'family', 'quiet')
  );

COMMENT ON COLUMN public.houses.badge IS
  'An admin-chosen label for the card, from a fixed list. Was two automatic '
  'badges computed from booking counts and the viewer''s own history. Free '
  'text is deliberately not allowed: the badge is Pima speaking on the card.';

-- The badge rides with the discount, which is already admin-only, already
-- goes through its own RPC, and is edited in the same place.
CREATE OR REPLACE FUNCTION public.set_house_badge(
  p_house_id TEXT,
  p_badge    TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  me UUID := auth.uid();
BEGIN
  IF me IS NULL OR NOT public.is_admin(me) THEN
    RAISE EXCEPTION 'الشارات للأدمن بس.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_badge IS NOT NULL AND p_badge NOT IN ('most_booked', 'new', 'featured', 'family', 'quiet') THEN
    RAISE EXCEPTION 'شارة غير معروفة.' USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.houses SET badge = p_badge WHERE id = p_house_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'البيت غير موجود.' USING ERRCODE = 'no_data_found';
  END IF;

  RETURN jsonb_build_object('ok', TRUE, 'badge', p_badge);
END;
$$;

REVOKE ALL ON FUNCTION public.set_house_badge(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_house_badge(TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.set_house_badge(TEXT, TEXT) IS
  'Admin-only, checked here rather than in the panel that calls it: the RPC is '
  'reachable without the panel, and a badge is the platform vouching for a '
  'house.';
