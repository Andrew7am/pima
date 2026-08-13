-- ============================================================
-- Room types — a per-house catalog of room templates powering the
-- redesigned Rooms manager (type badge on each room card + a
-- dedicated "أنواع الغرف" management screen). A type carries a
-- name, a default price, a bed count, a facilities list, and an
-- optional description/icon. Every room MAY reference one type
-- (rooms.type_id); it stays optional so existing rooms — which
-- already keep their own beds_count/price_per_night — keep working.
-- ============================================================

CREATE TABLE public.room_types (
  id            TEXT PRIMARY KEY,
  house_id      TEXT NOT NULL REFERENCES public.houses(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  price         NUMERIC NOT NULL DEFAULT 0 CHECK (price >= 0),
  beds_count    INTEGER NOT NULL DEFAULT 1 CHECK (beds_count > 0),
  facilities    TEXT[] NOT NULL DEFAULT '{}',   -- ac / bathroom / tv / wifi / fridge / balcony
  description   TEXT,
  icon          TEXT,                            -- ac / standard / vip / family (badge style)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX room_types_house_idx ON public.room_types (house_id);

ALTER TABLE public.room_types ENABLE ROW LEVEL SECURITY;

-- Types are shown on the public rooms grid, so select is open (like rooms).
CREATE POLICY "room_types_select_all" ON public.room_types FOR SELECT USING (TRUE);
CREATE POLICY "room_types_insert_owner" ON public.room_types FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.houses h WHERE h.id = house_id AND h.owner_id = auth.uid())
);
CREATE POLICY "room_types_update_owner" ON public.room_types FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.houses h WHERE h.id = house_id AND h.owner_id = auth.uid())
);
CREATE POLICY "room_types_delete_owner" ON public.room_types FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.houses h WHERE h.id = house_id AND h.owner_id = auth.uid())
);

-- Link rooms to a type (nullable: clearing a type just drops the badge).
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS type_id TEXT
  REFERENCES public.room_types(id) ON DELETE SET NULL;
