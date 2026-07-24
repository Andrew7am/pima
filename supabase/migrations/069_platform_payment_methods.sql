-- ============================================================
-- Central platform payment accounts. In the manual-collection model the guest
-- sends the 30% deposit to Pima's OWN InstaPay / wallet / bank numbers (not the
-- owner's), the admin verifies the proof, then forwards the owner's 25% via the
-- per-booking payout screen (migration 068). This stores those platform numbers
-- on the existing single-row platform_settings table — admin-editable only
-- (migration 024's UPDATE policy already covers it), same {id,type,label,value}
-- JSONB shape as houses.payment_methods (migration 042). Additive & back-compat:
-- a pre-069 row simply has no methods and the client falls back to today's
-- owner-direct display until the admin populates these.
-- ============================================================

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS payment_methods JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.platform_settings.payment_methods IS
  'Central platform payment accounts guests send deposits to. Array of {id,type,label,value} matching OwnerPaymentMethod. Admin-editable only.';
