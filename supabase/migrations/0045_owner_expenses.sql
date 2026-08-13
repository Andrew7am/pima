-- ============================================================
-- Owner expense tracking — feeds the Finance tab's "Net Profit"
-- (Revenue - Commission - Expenses), which had no expense data
-- source before this.
-- ============================================================

CREATE TABLE public.owner_expenses (
  id            TEXT PRIMARY KEY,
  house_id      TEXT NOT NULL REFERENCES public.houses(id) ON DELETE CASCADE,
  description   TEXT NOT NULL,
  amount        NUMERIC NOT NULL CHECK (amount > 0),
  expense_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.owner_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_expenses_select_owner_admin" ON public.owner_expenses FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.houses h WHERE h.id = house_id AND h.owner_id = auth.uid())
  OR public.is_admin(auth.uid())
);
CREATE POLICY "owner_expenses_insert_owner" ON public.owner_expenses FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.houses h WHERE h.id = house_id AND h.owner_id = auth.uid())
);
CREATE POLICY "owner_expenses_delete_owner" ON public.owner_expenses FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.houses h WHERE h.id = house_id AND h.owner_id = auth.uid())
);
