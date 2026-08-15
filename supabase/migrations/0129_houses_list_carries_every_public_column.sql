-- ─────────────────────────────────────────────────────────────────────────────
-- 0129 — houses_list carries every column the browse query actually asks for
--
-- Migration 0110 created public.houses_list so that browsing the site would stop
-- downloading the full base64 photo set of every house. It worked, and then it
-- silently stopped working.
--
-- The view names its columns explicitly — deliberately, so that payment_methods
-- cannot leak into it by accident. But that also means a column added to
-- public.houses afterwards does NOT appear in the view, and loadHouses() selects
-- one fixed projection from both. Migration 0116 added discount_pct,
-- discount_starts_at, discount_ends_at and discount_note to the table and to
-- that projection, and did not add them to the view. From that moment on:
--
--     GET /rest/v1/houses_list?select=...,discount_pct,...
--     42703  column houses_list.discount_pct does not exist
--
-- PostgREST rejects the whole select when one column is missing, so the fast
-- path returned nothing but an error, every time. loadHouses() then did exactly
-- what it was written to do — fell back to public.houses — and that fallback
-- selects `images`, the base64 column the view exists to avoid. The optimisation
-- had become dead code: the error was caught, logged, and recovered from so
-- gracefully that nothing looked broken except the egress bill.
--
-- Verified against production before this migration was written: the view exists
-- and answers `select=id`, and returns 42703 for discount_pct. Migration 0128
-- adds six more columns to the same projection, which would have kept the fast
-- path broken for the same reason.
--
-- This recreates the view with every column that projection requests — nothing
-- more. What stays exactly as 0110 left it:
--
--   * images[1:1]        the cover photo ONLY. This is the whole point; the
--                        remaining photos still arrive from public.houses by id
--                        when somebody actually opens a house.
--   * images_count       so the detail screen can tell "one photo" from
--                        "we only fetched one".
--   * payment_methods    ABSENT. It is column-revoked from anon on the table and
--                        has its own admin-only path; a view is not a way around
--                        that and must not become one.
--   * security_invoker   true. Without it the view would run as its owner and
--                        hand anon every row including houses awaiting review.
--                        With it, RLS on public.houses applies to whoever asks,
--                        exactly as it does today. No policy is added or changed
--                        by this migration.
--
-- ORDER: this migration MUST run AFTER 0128, which creates the six policy
-- columns referenced below. The guard makes that explicit rather than letting it
-- fail with a bare "column does not exist".
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE missing TEXT;
BEGIN
  SELECT string_agg(c, ', ') INTO missing
  FROM unnest(ARRAY[
    'discount_pct', 'discount_starts_at', 'discount_ends_at', 'discount_note',
    'free_cancel_days', 'partial_refund_days', 'partial_refund_pct',
    'child_free_under_age', 'booking_policy_notes', 'policy_updated_at'
  ]) AS c
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'houses' AND column_name = c
  );

  IF missing IS NOT NULL THEN
    RAISE EXCEPTION
      'MIGRATION_ORDER: public.houses is missing %. Apply 0128_property_booking_policies.sql before this migration.',
      missing;
  END IF;
END $$;

DROP VIEW IF EXISTS public.houses_list;

CREATE VIEW public.houses_list
WITH (security_invoker = true) AS
SELECT
  id, name, description, owner_id, owner_name, governorate, address, lat, lng,
  rooms_count, beds_count, rooms_description, price_per_night_per_person,
  services, suitability, activities,
  -- The cover only. A slice, not images[1], so the shape stays TEXT[] and the
  -- client mapper needs no special case for a house with no photos yet.
  images[1:1] AS images,
  -- What the list is NOT sending, so the detail screen can tell "this house has
  -- one photo" from "we only fetched one".
  COALESCE(array_length(images, 1), 0) AS images_count,
  conference_halls, restaurants, seasonal_rates, status, rating, reviews_count,
  created_at, property_type, blocked_dates, sea_proximity, student_housing_gender,
  distance_from_university, nearby_landmark, monthly_rent, day_use_price_per_person,
  room_capacity, housing_rules, contract_terms, menu, image_descriptions, pending_edit,
  -- Migration 0116. The explore list badges a live offer («خصم ٢٠٪») from these,
  -- so the browse query genuinely needs them — they are not carried for symmetry.
  discount_pct, discount_starts_at, discount_ends_at, discount_note,
  -- Migration 0128. A guest is told a property's cancellation and child terms
  -- before booking, which means the browse payload has to carry them.
  free_cancel_days, partial_refund_days, partial_refund_pct,
  child_free_under_age, booking_policy_notes, policy_updated_at
FROM public.houses;

GRANT SELECT ON public.houses_list TO anon, authenticated;

COMMENT ON VIEW public.houses_list IS
  'Houses for list/browse screens: cover image only, plus images_count. '
  'Full images come from public.houses by id when a house is opened. '
  'security_invoker=true so RLS on public.houses still applies. '
  'Must carry every column in HOUSE_PUBLIC_COLUMNS (src/lib/db.ts) — PostgREST '
  'rejects the whole select if one is missing, which silently sends the browse '
  'query back to the full table and its base64 images. Guarded by '
  'housesListView.test.ts.';
