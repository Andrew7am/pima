-- ============================================================
-- Stop deleting the financial record.
--
-- Three separate buttons in this app run a hard DELETE whose cascade
-- destroys money records that Pima is legally the custodian of. Pima
-- collects guests' deposits into its own accounts and remits them to
-- house owners, so these rows are not Pima's own bookkeeping — they
-- are the evidence of other people's money passing through its hands.
--
-- WHAT THE CASCADE ACTUALLY TAKES. houses → bookings (001:83) →
-- payments (001:122), plus reviews (001:143), rooms/announcements/
-- waitlist (006), owner_expenses (045), owner_payouts (059),
-- room_types (060) and house_views (106). A grep for ON DELETE
-- RESTRICT across all 106 migrations returns nothing, so there is no
-- brake anywhere.
--
-- And payments.proof_image holds a base64 data URI of the guest's own
-- transfer screenshot (see db.ts). It lives INSIDE the row. There is
-- no orphaned file left in storage afterwards — the evidence goes
-- with it.
--
-- WHY THERE IS NO RECORD IT HAPPENED. Every audit trigger in the
-- schema is AFTER UPDATE (032, 033). A grep for BEFORE/AFTER DELETE
-- across all migrations finds exactly one hit, on reviews, and it
-- only recomputes a rating. A deletion therefore writes nothing to
-- audit_log: no who, no when, no what.
--
-- Three fixes, one file, because they are one problem.
-- ============================================================


-- ============================================================
-- 1. Houses are archived, not deleted.
--
-- The owner can currently delete his own house behind a plain
-- confirm() with no admin involved (policy from migration 013). An
-- owner in a dispute over a payout can erase the record of the payout.
--
-- Migration 023 already widened this CHECK once to add 'suspended',
-- so this is the same shape of change.
-- ============================================================

DO $$
BEGIN
  ALTER TABLE public.houses DROP CONSTRAINT IF EXISTS houses_status_check;
  ALTER TABLE public.houses ADD CONSTRAINT houses_status_check
    CHECK (status IN ('pending', 'approved', 'rejected', 'suspended', 'archived'));
END $$;

ALTER TABLE public.houses ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE public.houses ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- Take the ability away entirely. With no DELETE policy, RLS refuses
-- the statement for every non-service caller — which is the point:
-- the client cannot destroy this data even if a future code path asks
-- it to.
DROP POLICY IF EXISTS "houses_delete_owner" ON public.houses;
DROP POLICY IF EXISTS "houses_delete_admin" ON public.houses;

-- A second brake behind the first, so that a future migration
-- re-adding a DELETE policy still cannot erase a house that has ever
-- taken money. Deliberately only on the money tables: photos and
-- room types are fine to lose with a house.
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_house_id_fkey;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_house_id_fkey
  FOREIGN KEY (house_id) REFERENCES public.houses(id) ON DELETE RESTRICT;

ALTER TABLE public.owner_payouts DROP CONSTRAINT IF EXISTS owner_payouts_house_id_fkey;
ALTER TABLE public.owner_payouts ADD CONSTRAINT owner_payouts_house_id_fkey
  FOREIGN KEY (house_id) REFERENCES public.houses(id) ON DELETE RESTRICT;

-- Archiving is an admin act, recorded. An owner who wants his house
-- gone asks; the row survives either way.
CREATE OR REPLACE FUNCTION public.archive_house(p_house_id TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner UUID;
BEGIN
  SELECT owner_id INTO v_owner FROM public.houses WHERE id = p_house_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'HOUSE_NOT_FOUND';
  END IF;
  IF NOT public.is_admin(auth.uid()) AND v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'NOT_ALLOWED';
  END IF;

  UPDATE public.houses
     SET status = 'archived', archived_at = NOW(), archived_by = auth.uid()
   WHERE id = p_house_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.archive_house(TEXT) TO authenticated;


-- ============================================================
-- 2. A guest deleting their account must not delete Pima's payment
--    records.
--
-- delete_own_account() runs DELETE FROM auth.users, and
-- public.users.id REFERENCES auth.users(id) ON DELETE CASCADE
-- (001:12), so one guest tapping «احذف حسابي» takes their bookings
-- (001:85), their payments (001:123) and their reviews with them —
-- including deposits Pima received and has not yet remitted.
--
-- Scrub the person, keep the transaction. This is also the shape a
-- deletion request actually requires: the personal data goes, the
-- financial record stays, because the money record is not the
-- requester's alone — the house owner is a party to it too.
-- ============================================================

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Sever the cascade ONCE, here, as schema. It must not live inside the
-- function: DDL in a function body would run on every call, and the
-- first caller would silently reshape the schema for everyone.
--
-- public.users.id stops being a foreign key into auth.users. The
-- profile row then outlives the sign-in identity, which is exactly
-- what anonymising requires — the bookings and payments pointing at it
-- keep resolving. New rows are still created with the auth id by the
-- signup path, so nothing else changes.
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_fkey;

CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  my_role TEXT;
  uid     UUID := auth.uid();
BEGIN
  SELECT role INTO my_role FROM public.users WHERE id = uid;
  IF my_role IS NULL THEN
    RAISE EXCEPTION 'USER_NOT_FOUND';
  END IF;
  IF my_role NOT IN ('individual', 'servant') THEN
    RAISE EXCEPTION 'ACCOUNT_TYPE_NOT_SELF_DELETABLE';
  END IF;

  -- Overwrite the identifying fields in place. The row keeps its id,
  -- so every booking and payment that points at it still resolves —
  -- to a person who can no longer be identified from it.
  UPDATE public.users
     SET name          = 'حساب محذوف',
         email         = 'deleted+' || uid::TEXT || '@pima.invalid',
         phone         = '',
         avatar_url    = NULL,
         date_of_birth = NULL,
         address       = NULL,
         governorate   = NULL,
         organization_name = NULL,
         deleted_at    = NOW()
   WHERE id = uid;

  -- Then remove only the sign-in identity. The cascade from auth.users
  -- into public.users was severed by this migration, above, so the
  -- scrubbed row and everything pointing at it now survives this.
  DELETE FROM auth.users WHERE id = uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;


-- ============================================================
-- 3. Platform settings keep a history.
--
-- platform_settings is a single row updated in place (024, CHECK
-- (id = 1)). No trigger watches it — the audit log's triggers cover
-- bookings, houses and users only. So a commission-rate change leaves
-- no who, no when and no from-what.
--
-- updated_at does not rescue it: the settings form saves all eleven
-- fields under one button, so the next unrelated save — adding an
-- InstaPay number — overwrites the date the rate changed.
--
-- This needs no backfill. The current row IS the truth for everything
-- that came before the trigger existed, because the commission rate
-- has never been changed: it appears in exactly one place in all 107
-- migrations, as DEFAULT 0.05.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.platform_settings_history (
  id          BIGSERIAL PRIMARY KEY,
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  changed_by  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  old_values  JSONB NOT NULL,
  new_values  JSONB NOT NULL
);

ALTER TABLE public.platform_settings_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings_history_admin_read" ON public.platform_settings_history;
CREATE POLICY "settings_history_admin_read" ON public.platform_settings_history
  FOR SELECT USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.log_platform_settings_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Only the fields that actually moved, so a save that changed one
  -- number does not record eleven.
  IF to_jsonb(OLD) - 'updated_at' = to_jsonb(NEW) - 'updated_at' THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.platform_settings_history (changed_by, old_values, new_values)
  VALUES (auth.uid(), to_jsonb(OLD) - 'updated_at', to_jsonb(NEW) - 'updated_at');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_platform_settings_change ON public.platform_settings;
CREATE TRIGGER trg_log_platform_settings_change
  AFTER UPDATE ON public.platform_settings
  FOR EACH ROW EXECUTE FUNCTION public.log_platform_settings_change();
