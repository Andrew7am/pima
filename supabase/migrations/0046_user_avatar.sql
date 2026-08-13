-- Adds a user-settable avatar (base64 data URL, same storage convention as
-- house/room images elsewhere in this app — no storage bucket involved).
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
