-- ─────────────────────────────────────────────────────────────────────────────
-- 106 — Stop shipping every photo of every house to every visitor
--
-- Images are stored as base64 TEXT inside houses.images, and loadHouses()
-- selected that column. So opening pimastay.com downloaded the full photo set
-- of every approved house — before the visitor clicked anything, whether or not
-- they were logged in, and for crawlers too since guest browsing landed.
--
-- The bill showed it in the right meter: the database is only 10% full, while
-- egress ran to 2.789 GB against a 5 GB allowance on sixteen monthly active
-- users. Roughly 174 MB per user, none of it cacheable, because it arrives as
-- an API response rather than as an asset a CDN could hold.
--
-- The explore screen needs ONE cover photo. This view gives it exactly that,
-- and reports how many more exist so the detail screen knows to fetch them.
--
-- security_invoker = true is the whole safety story: without it the view runs
-- as its owner and would hand anon every row including houses still awaiting
-- review. With it, the existing RLS on public.houses applies to whoever is
-- asking, exactly as it does today. payment_methods is deliberately absent —
-- it is column-granted away from anon and has its own admin-only path.
-- ─────────────────────────────────────────────────────────────────────────────

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
  room_capacity, housing_rules, contract_terms, menu, image_descriptions, pending_edit
FROM public.houses;

GRANT SELECT ON public.houses_list TO anon, authenticated;

COMMENT ON VIEW public.houses_list IS
  'Houses for list/browse screens: cover image only, plus images_count. '
  'Full images come from public.houses by id when a house is opened. '
  'security_invoker=true so RLS on public.houses still applies.';
