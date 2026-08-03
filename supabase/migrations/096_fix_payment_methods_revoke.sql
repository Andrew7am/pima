-- 080_fix_payment_methods_revoke.sql
--
-- Migration 070 tried to hide houses.payment_methods with:
--     REVOKE SELECT (payment_methods) ON public.houses FROM anon, authenticated;
-- It ran without error and did nothing. In PostgreSQL a TABLE-level SELECT
-- grant already covers every column, and a column-level REVOKE cannot subtract
-- from it — column privileges only bite when the role has no table-level grant.
-- Supabase grants anon/authenticated table-level SELECT on public tables by
-- default, so owner InstaPay handles and wallet numbers stayed readable to
-- anyone holding the publishable anon key. Verified against production before
-- and after this migration.
--
-- Correct shape: drop the table-level grant, then grant back every column
-- EXCEPT payment_methods.
--
-- NOTE: this enumerates the columns that exist when it runs. A future ALTER
-- TABLE ... ADD COLUMN is NOT covered by a column-level grant, so new columns
-- must be granted explicitly (or this block re-run).

DO $$
DECLARE
  cols TEXT;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'houses'
    AND column_name <> 'payment_methods';

  IF cols IS NULL THEN
    RAISE EXCEPTION 'public.houses not found — refusing to change grants';
  END IF;

  -- Remove the blanket table grant that was masking the column revoke.
  EXECUTE 'REVOKE SELECT ON public.houses FROM anon, authenticated';
  -- Hand back everything a guest legitimately needs to browse and book.
  EXECUTE format('GRANT SELECT (%s) ON public.houses TO anon, authenticated', cols);
END $$;

-- Belt and braces: keep the column-level revoke too, so that if a later
-- migration re-grants the whole table this still narrows it.
REVOKE SELECT (payment_methods) ON public.houses FROM anon, authenticated;

-- Owners read their own houses' numbers (admins read all) through this
-- SECURITY DEFINER function, which runs as its owner and so is unaffected by
-- the grants above. Re-declared here so the fix is self-contained.
CREATE OR REPLACE FUNCTION public.get_owner_payment_methods()
RETURNS TABLE(house_id TEXT, payment_methods JSONB)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT h.id, h.payment_methods
  FROM public.houses h
  WHERE h.owner_id = auth.uid() OR public.is_admin(auth.uid());
$$;

GRANT EXECUTE ON FUNCTION public.get_owner_payment_methods() TO authenticated;
