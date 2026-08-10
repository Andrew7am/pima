-- ============================================================
-- A church's third review was destroying its first two.
--
-- 028 created a UNIQUE index on reviews (user_id, house_id), and
-- db.ts upserts with onConflict: 'user_id,house_id'. So a church that
-- returns to the same house — which is the whole business, an annual
-- retreat at a place they liked — silently overwrites what it wrote
-- last year. A house that has hosted the same church for three summers
-- carries ONE review. The other two are gone, with no record that they
-- existed.
--
-- The intent behind 028 was right: stop one person spamming a house
-- with reviews. But the unit it chose was the person, and the correct
-- unit is the STAY. One review per booking says exactly what 028
-- wanted to say, and says it without destroying history — a guest
-- cannot review a house they never booked (020 already enforces that),
-- and they get one voice per visit.
--
-- This is the only thing on the platform where NOT acting makes the
-- asset smaller every year. Every other gap merely fails to grow.
--
-- The stay's shape is stamped alongside, because «١٤ نجمة» is worth
-- much less than «٩ مجموعات ثانوي ٤٠–٥٠ فرد، ٣ ليالي، ذروة أغسطس».
-- Group kind and a SIZE BAND, never an exact count and never a church
-- name — the same disclosure model 111 uses for neighbours, for the
-- same reason: these are stays carrying minors.
-- ============================================================

ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS booking_id   TEXT REFERENCES public.bookings(id) ON DELETE SET NULL;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS stay_group   TEXT;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS stay_band    TEXT;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS stay_nights  INTEGER;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS stay_month   SMALLINT;

-- Backfill what can be known: the reviewer's own stay at that house.
-- Where a guest stayed more than once we cannot tell which visit the
-- surviving review described, so the most recent completed stay is the
-- best available guess and the older ones stay unattributed rather
-- than being invented.
UPDATE public.reviews r
   SET booking_id = sub.id,
       stay_group = COALESCE(sub.conference_details->>'bookingType', 'standard'),
       stay_band  = CASE
                      WHEN sub.guests_count <= 10 THEN 'أقل من ١٠'
                      WHEN sub.guests_count <= 25 THEN 'حوالي ١٠–٢٥'
                      WHEN sub.guests_count <= 50 THEN 'حوالي ٢٥–٥٠'
                      ELSE 'أكتر من ٥٠'
                    END,
       stay_nights = GREATEST(0, sub.check_out - sub.check_in),
       stay_month  = EXTRACT(MONTH FROM sub.check_in)
  FROM (
    SELECT DISTINCT ON (b.user_id, b.house_id)
           b.id, b.user_id, b.house_id, b.guests_count, b.check_in, b.check_out, b.conference_details
      FROM public.bookings b
     WHERE b.status IN ('approved', 'completed')
     ORDER BY b.user_id, b.house_id, b.check_in DESC
  ) sub
 WHERE r.user_id = sub.user_id AND r.house_id = sub.house_id AND r.booking_id IS NULL;

-- The wrong constraint goes; the right one replaces it.
DROP INDEX IF EXISTS idx_reviews_user_house_unique;

-- One voice per visit. Rows predating this migration have no
-- booking_id, and a partial index leaves them alone rather than
-- refusing to build.
CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_one_per_booking
  ON public.reviews (booking_id) WHERE booking_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS reviews_house_shape_idx ON public.reviews (house_id, stay_group);

COMMENT ON COLUMN public.reviews.booking_id IS
  'The stay being reviewed. One review per booking — replaces the (user_id, house_id) unique index from 028, which silently overwrote a returning church''s earlier reviews.';
