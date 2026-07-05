-- ============================================================
-- Platform-wide announcement carousel (admin-only), separate from
-- the per-house announcements added in migration 006. Shown on the
-- explore screen where the static welcome banner used to be.
-- ============================================================

CREATE TABLE public.platform_announcements (
  id               TEXT PRIMARY KEY,
  message          TEXT NOT NULL,
  image_url        TEXT,
  linked_house_id  TEXT REFERENCES public.houses(id) ON DELETE SET NULL,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.platform_announcements ENABLE ROW LEVEL SECURITY;

-- Everyone can read (the carousel is public); only admins can write.
-- Reuses is_admin() from migration 009, which is SECURITY DEFINER and
-- safely avoids the recursion bug that migration 008 introduced.
CREATE POLICY "platform_announcements_select_all" ON public.platform_announcements
  FOR SELECT USING (TRUE);
CREATE POLICY "platform_announcements_admin_write" ON public.platform_announcements
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
