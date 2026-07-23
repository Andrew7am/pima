-- ============================================================
-- Owner payout requests — powers the Financial Center's
-- "طلب تحويل" button and "سجل التحويلات" history. Before this,
-- those were UI-only with no persistence. An owner requests a
-- transfer of the balance Pima actually holds (deposits collected
-- via the platform, minus commission); an admin later marks it
-- completed. The remaining booking value is cash the owner
-- collects directly and is never part of a payout.
-- ============================================================

CREATE TABLE public.owner_payouts (
  id            TEXT PRIMARY KEY,
  house_id      TEXT NOT NULL REFERENCES public.houses(id) ON DELETE CASCADE,
  owner_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount        NUMERIC NOT NULL CHECK (amount > 0),
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
  method        TEXT,           -- e.g. instapay / vodafone_cash (owner's chosen payout channel)
  note          TEXT,
  requested_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ
);

CREATE INDEX owner_payouts_house_idx ON public.owner_payouts (house_id);
CREATE INDEX owner_payouts_owner_idx ON public.owner_payouts (owner_id);

ALTER TABLE public.owner_payouts ENABLE ROW LEVEL SECURITY;

-- Owner sees their own requests; admin sees all.
CREATE POLICY "owner_payouts_select_owner_admin" ON public.owner_payouts FOR SELECT USING (
  owner_id = auth.uid()
  OR public.is_admin(auth.uid())
);

-- Owner may only request a payout for a house they own, in their own name,
-- and only in the initial 'pending' state (they can't self-approve).
CREATE POLICY "owner_payouts_insert_owner" ON public.owner_payouts FOR INSERT WITH CHECK (
  owner_id = auth.uid()
  AND status = 'pending'
  AND EXISTS (SELECT 1 FROM public.houses h WHERE h.id = house_id AND h.owner_id = auth.uid())
);

-- Only admins move a request forward (processing / completed / rejected).
CREATE POLICY "owner_payouts_update_admin" ON public.owner_payouts FOR UPDATE USING (
  public.is_admin(auth.uid())
) WITH CHECK (
  public.is_admin(auth.uid())
);
