-- ============================================================
-- URGENT FIX: migration 008's admin RLS policies caused infinite
-- recursion. A policy ON public.users that queries public.users in
-- its USING clause makes Postgres re-evaluate RLS on that same table
-- to answer the subquery, which re-evaluates the policy, forever —
-- breaking EVERY read of the users table for EVERYONE (error 42P17,
-- surfaced by PostgREST as a 500).
--
-- Fix: check the admin role through a SECURITY DEFINER function.
-- Such a function runs with the privileges of its owner (bypassing
-- RLS for its own internal query), so the recursion never starts.
-- ============================================================

DROP POLICY IF EXISTS "users_select_admin" ON public.users;
DROP POLICY IF EXISTS "users_update_admin" ON public.users;

CREATE OR REPLACE FUNCTION public.is_admin(uid UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = uid AND role = 'admin');
$$;

CREATE POLICY "users_select_admin" ON public.users FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "users_update_admin" ON public.users FOR UPDATE USING (public.is_admin(auth.uid()));
