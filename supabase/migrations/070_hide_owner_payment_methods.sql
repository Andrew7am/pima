-- ============================================================
-- Stop leaking owner payment numbers to guests. houses.payment_methods (the
-- owner's InstaPay handle / mobile-wallet number == their phone / bank account)
-- was readable by every guest via the houses payload — undermining the
-- anti-disintermediation defense (056) and the platform-collection model (069).
--
-- Fix at the SERVER, not just the UI: revoke column-level SELECT so no guest
-- (anon or authenticated) can read payment_methods from the table at all — even
-- crafting their own query. Owners/admins get their own houses' numbers back
-- through a SECURITY DEFINER RPC (runs as the definer, bypassing the revoke).
--
-- NOTE: the client's loadHouses() must select explicit columns (not '*'), since
-- '*' would now error on the revoked column — done in the same commit.
-- ============================================================

REVOKE SELECT (payment_methods) ON public.houses FROM anon, authenticated;

-- Owner → their own houses' payout numbers; admin → all. Everyone else → none.
CREATE OR REPLACE FUNCTION public.get_owner_payment_methods()
RETURNS TABLE(house_id TEXT, payment_methods JSONB)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT h.id, h.payment_methods
  FROM public.houses h
  WHERE h.owner_id = auth.uid() OR public.is_admin(auth.uid());
$$;

GRANT EXECUTE ON FUNCTION public.get_owner_payment_methods() TO authenticated;
