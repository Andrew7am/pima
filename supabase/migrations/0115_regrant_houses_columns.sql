-- ============================================================
-- Re-grant SELECT on public.houses, including columns added since.
--
-- Migration 096 removed table-level SELECT so that the owner's
-- payment_methods column could not be read by every visitor, and 097
-- restored the rest as COLUMN-level grants:
--
--   REVOKE SELECT ON public.houses FROM anon, authenticated;
--   GRANT SELECT (<every column except payment_methods>) TO anon, authenticated;
--
-- That is correct, and it has one consequence nobody wrote down: the
-- column list is a SNAPSHOT taken when 097 ran. A column added to
-- houses afterwards is granted to nobody, so selecting it returns
-- 42501 «permission denied for table houses» — which reads like a
-- policy problem and is really a missing grant.
--
-- 107 added archived_at and archived_by and hit exactly this. They are
-- the first, not the last: every future column on this table lands the
-- same way, and the failure is invisible until something selects it.
--
-- Nothing is broken today — no client code selects those two, and the
-- public listing query is unaffected (verified against production: the
-- site's own house query still returns 200). This closes it before
-- something does select them, and re-running 097's own enumeration
-- fixes any column added between then and now in one go.
--
-- Safe to re-run. It is 097's logic verbatim, and the exclusion of
-- payment_methods is preserved, so it composes with 096 rather than
-- undoing it.
-- ============================================================

DO $$
DECLARE cols TEXT;
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

  EXECUTE 'REVOKE SELECT ON public.houses FROM anon, authenticated';
  EXECUTE format('GRANT SELECT (%s) ON public.houses TO anon, authenticated', cols);
END $$;

-- Belt and braces: 096's whole point, restated, so a future reader of
-- this file cannot mistake the block above for a blanket re-grant.
REVOKE SELECT (payment_methods) ON public.houses FROM anon, authenticated;
