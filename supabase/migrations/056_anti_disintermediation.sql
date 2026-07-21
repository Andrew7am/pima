-- ============================================================
-- Anti-disintermediation defense: hide owner contact everywhere and
-- reroute all communication through the in-app chat.
--
-- Once a guest has the owner's phone, next year's booking goes to
-- WhatsApp and the platform loses the commission. The mitigation:
--   (1) DROP the get_house_owner_contact RPC (migration 031) so the
--       phone/email are inaccessible to anyone but admins.
--   (2) Publish an aggregate owner "trust profile" via a new
--       SECURITY DEFINER RPC — first name + avatar + hosted-groups
--       count + response-time — so guests still see a real person
--       backing the listing, without any way to contact them outside.
--   (3) Booking-milestone loyalty bonuses (3rd/5th/10th completed
--       booking) — the retention lever that makes staying inside the
--       platform economically rational for the guest.
-- ============================================================

-- (1) Contact reveal — gone. Callers get "function does not exist" and
--     the client removes its own reveal UI in the same commit.
DROP FUNCTION IF EXISTS public.get_house_owner_contact(TEXT);

-- (2) Public owner profile: first name, avatar, verified badge,
--     lifetime completed-groups count, and average response time
--     (hours between the guest's first message and the owner's first
--     reply, across all bookings for that owner). Safe to expose to
--     anon — nothing here helps contact the owner off-platform.
CREATE OR REPLACE FUNCTION public.get_house_owner_profile(p_house_id TEXT)
RETURNS TABLE(
  first_name TEXT,
  avatar_url TEXT,
  hosted_groups INT,
  avg_response_hours NUMERIC,
  verified BOOLEAN
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH owner_row AS (
    SELECT u.id, u.name, u.avatar_url, h.status AS house_status
    FROM public.houses h
    JOIN public.users u ON u.id = h.owner_id
    WHERE h.id = p_house_id
  )
  SELECT
    split_part(o.name, ' ', 1) AS first_name,
    o.avatar_url,
    COALESCE((
      SELECT COUNT(*)::int FROM public.bookings b
      WHERE b.house_id IN (SELECT id FROM public.houses WHERE owner_id = o.id)
        AND b.status = 'completed'
    ), 0) AS hosted_groups,
    (
      SELECT ROUND(AVG(EXTRACT(EPOCH FROM (reply.first_reply - ask.first_msg))) / 3600.0, 1)::numeric
      FROM (
        SELECT bm.booking_id, MIN(bm.created_at) AS first_msg
        FROM public.booking_messages bm
        JOIN public.bookings b ON b.id = bm.booking_id
        WHERE b.house_id IN (SELECT id FROM public.houses WHERE owner_id = o.id)
          AND bm.sender_id = b.user_id
        GROUP BY bm.booking_id
      ) ask
      JOIN (
        SELECT bm.booking_id, MIN(bm.created_at) AS first_reply
        FROM public.booking_messages bm
        WHERE bm.sender_id = o.id
        GROUP BY bm.booking_id
      ) reply ON reply.booking_id = ask.booking_id
      WHERE reply.first_reply > ask.first_msg
    ) AS avg_response_hours,
    (o.house_status = 'approved') AS verified
  FROM owner_row o;
$$;

GRANT EXECUTE ON FUNCTION public.get_house_owner_profile(TEXT) TO anon, authenticated;

-- (3) Booking milestone bonuses — retention through loyalty. Bonuses
--     are keyed by a deterministic points_history id, so re-firing the
--     trigger (e.g. a re-completion after a manual status flip) is a
--     no-op instead of paying twice.
CREATE OR REPLACE FUNCTION public.award_booking_milestones()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  completed_count INT;
  bonus INT := 0;
  milestone_id TEXT;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    SELECT COUNT(*) INTO completed_count FROM public.bookings
      WHERE user_id = NEW.user_id AND status = 'completed';

    IF completed_count = 3 THEN bonus := 1000;
    ELSIF completed_count = 5 THEN bonus := 2000;
    ELSIF completed_count = 10 THEN bonus := 5000;
    END IF;

    IF bonus > 0 THEN
      milestone_id := 'pt_milestone_' || NEW.user_id || '_' || completed_count;
      -- Guard: only pay if we haven't already
      IF NOT EXISTS (SELECT 1 FROM public.points_history WHERE id = milestone_id) THEN
        INSERT INTO public.points_history (id, user_id, amount, description, type)
        VALUES (
          milestone_id, NEW.user_id, bonus,
          'مكافأة الوفاء: أكملت ' || completed_count || ' حجوزات معنا 🎉',
          'earned'
        );
        UPDATE public.users SET points = points + bonus WHERE id = NEW.user_id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_award_booking_milestones ON public.bookings;
CREATE TRIGGER trg_award_booking_milestones
  AFTER UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.award_booking_milestones();
