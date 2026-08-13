-- ============================================================
-- MEDIUM fixes: (1) fake reviews, (2) broken house rating.
--
-- (1) reviews_insert_user only checks auth.uid() = user_id, so any
--     logged-in user could review any house without ever booking it —
--     review spam / fake ratings. Add a BEFORE INSERT trigger requiring
--     the reviewer to have an approved or completed booking for that
--     house.
--
-- (2) The client tried to update houses.rating after a review, but
--     houses_update_owner only lets the OWNER update the house, so a
--     reviewer's rating write always failed silently and ratings never
--     refreshed. Recompute rating + reviews_count in a SECURITY DEFINER
--     trigger from the actual review rows, so it always works and can't
--     be forged. (Runs as the table owner, so the house-protection
--     trigger from migration 019 lets it through.)
-- ============================================================

-- (1) Require a real booking before a review is accepted
CREATE OR REPLACE FUNCTION public.require_booking_for_review()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF current_user = 'authenticated' AND NOT public.is_admin(auth.uid()) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.bookings
      WHERE user_id = NEW.user_id
        AND house_id = NEW.house_id
        AND status IN ('approved', 'completed')
    ) THEN
      RAISE EXCEPTION 'REVIEW_REQUIRES_BOOKING: a confirmed booking is required to review this house';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_require_booking_for_review ON public.reviews;
CREATE TRIGGER trg_require_booking_for_review
  BEFORE INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.require_booking_for_review();

-- (2) Recompute the house's rating + review count from the real rows
CREATE OR REPLACE FUNCTION public.recompute_house_rating()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  hid TEXT := COALESCE(NEW.house_id, OLD.house_id);
BEGIN
  UPDATE public.houses SET
    rating = COALESCE(
      (SELECT ROUND(AVG(COALESCE(overall_rating, rating))::numeric, 2)
         FROM public.reviews WHERE house_id = hid), 0),
    reviews_count = (SELECT COUNT(*) FROM public.reviews WHERE house_id = hid)
  WHERE id = hid;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_recompute_house_rating ON public.reviews;
CREATE TRIGGER trg_recompute_house_rating
  AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.recompute_house_rating();
