-- ============================================================
-- Room management, owner announcements, and booking waitlist
-- ============================================================

-- ─── ROOMS ──────────────────────────────────────────────────
CREATE TABLE public.rooms (
  id               TEXT PRIMARY KEY,
  house_id         TEXT NOT NULL REFERENCES public.houses(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  beds_count       INTEGER NOT NULL DEFAULT 1,
  price_per_night  NUMERIC,             -- NULL = inherit the house's price
  images           TEXT[] NOT NULL DEFAULT '{}',
  status           TEXT NOT NULL DEFAULT 'available'
                     CHECK (status IN ('available', 'booked', 'maintenance')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rooms_select_all" ON public.rooms FOR SELECT USING (TRUE);
CREATE POLICY "rooms_insert_owner" ON public.rooms FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.houses h WHERE h.id = house_id AND h.owner_id = auth.uid())
);
CREATE POLICY "rooms_update_owner" ON public.rooms FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.houses h WHERE h.id = house_id AND h.owner_id = auth.uid())
);
CREATE POLICY "rooms_delete_owner" ON public.rooms FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.houses h WHERE h.id = house_id AND h.owner_id = auth.uid())
);

-- ─── ANNOUNCEMENTS ──────────────────────────────────────────
CREATE TABLE public.announcements (
  id          TEXT PRIMARY KEY,
  house_id    TEXT NOT NULL REFERENCES public.houses(id) ON DELETE CASCADE,
  message     TEXT NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "announcements_select_all" ON public.announcements FOR SELECT USING (TRUE);
CREATE POLICY "announcements_insert_owner" ON public.announcements FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.houses h WHERE h.id = house_id AND h.owner_id = auth.uid())
);
CREATE POLICY "announcements_update_owner" ON public.announcements FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.houses h WHERE h.id = house_id AND h.owner_id = auth.uid())
);

-- ─── WAITLIST ───────────────────────────────────────────────
CREATE TABLE public.waitlist (
  id            TEXT PRIMARY KEY,
  house_id      TEXT NOT NULL REFERENCES public.houses(id) ON DELETE CASCADE,
  house_name    TEXT NOT NULL DEFAULT '',
  user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user_name     TEXT NOT NULL DEFAULT '',
  user_phone    TEXT NOT NULL DEFAULT '',
  check_in      DATE NOT NULL,
  check_out     DATE NOT NULL,
  guests_count  INTEGER NOT NULL,
  status        TEXT NOT NULL DEFAULT 'waiting'
                  CHECK (status IN ('waiting', 'notified', 'expired', 'cancelled')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- Client sees/creates/cancels their own entries; owner sees/updates entries for their house
CREATE POLICY "waitlist_select_own_or_owner" ON public.waitlist FOR SELECT USING (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.houses h WHERE h.id = house_id AND h.owner_id = auth.uid())
);
CREATE POLICY "waitlist_insert_own" ON public.waitlist FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "waitlist_update_own_or_owner" ON public.waitlist FOR UPDATE USING (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.houses h WHERE h.id = house_id AND h.owner_id = auth.uid())
);

-- When a booking is rejected (the only way capacity currently frees up),
-- notify the earliest still-waiting entry for that house whose dates
-- overlap and whose party fits in the newly available beds.
CREATE OR REPLACE FUNCTION public.notify_waitlist_on_rejection()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  house_beds  INTEGER;
  used_beds   INTEGER;
  free_beds   INTEGER;
  w           RECORD;
BEGIN
  IF NEW.status <> 'rejected' OR OLD.status = 'rejected' THEN
    RETURN NEW;
  END IF;

  SELECT beds_count INTO house_beds FROM public.houses WHERE id = NEW.house_id;

  SELECT COALESCE(SUM(guests_count), 0) INTO used_beds
  FROM public.bookings
  WHERE house_id = NEW.house_id
    AND status IN ('pending', 'approved')
    AND daterange(check_in, check_out, '[)') && daterange(NEW.check_in, NEW.check_out, '[)');

  free_beds := house_beds - used_beds;

  FOR w IN
    SELECT * FROM public.waitlist
    WHERE house_id = NEW.house_id
      AND status = 'waiting'
      AND daterange(check_in, check_out, '[)') && daterange(NEW.check_in, NEW.check_out, '[)')
      AND guests_count <= free_beds
    ORDER BY created_at ASC
    LIMIT 1
  LOOP
    UPDATE public.waitlist SET status = 'notified' WHERE id = w.id;
    INSERT INTO public.notifications (id, user_id, booking_id, title, message, type, is_read, created_at)
    VALUES (
      'notif_wl_' || w.id, w.user_id, NULL,
      'توفر مكان في قائمة الانتظار 🎉',
      'تم توفر مكان في "' || w.house_name || '" للفترة من ' || w.check_in || ' إلى ' || w.check_out || '. سارع بإكمال الحجز قبل أن يشغله غيرك.',
      'success', FALSE, NOW()
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_waitlist_on_rejection ON public.bookings;
CREATE TRIGGER trg_notify_waitlist_on_rejection
  AFTER UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.notify_waitlist_on_rejection();
