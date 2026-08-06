-- ─────────────────────────────────────────────────────────────────────────────
-- 104 — Audit the money decisions
--
-- 032/033 gave the platform an audit log and wired it to three tables:
-- bookings, houses and users. It records who approved a booking, suspended a
-- house, approved an account or banned somebody.
--
-- It does not record a single money decision. Today an admin can:
--
--   • approve or reject a guest's payment receipt        (payments)
--   • mark an owner transfer as completed — i.e. declare  (owner_payouts)
--     that money left the company
--   • change the commission rate every owner is paid on   (platform_settings)
--
-- and nothing anywhere says who did it or when. The سجل التدقيق screen is
-- presented as THE accountability record, so these absences read as "nothing
-- happened" rather than "not covered".
--
-- This adds the three missing triggers. Same shape as 033: SECURITY DEFINER so
-- the insert can write a table the actor cannot write directly, actor read from
-- auth.uid(), and Arabic details written at insert time so the log is readable
-- without joins.
--
-- Unlike 033 these do NOT gate on role. A payout moving to 'completed' is worth
-- recording whoever caused it — gating on role is what makes an audit log
-- quietly incomplete.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Payments: a receipt verified or rejected ──────────────────────────────
CREATE OR REPLACE FUNCTION public.audit_payment_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  a_name TEXT;
  a_role TEXT;
  b_house TEXT;
  b_guest TEXT;
BEGIN
  IF NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
    SELECT name, role INTO a_name, a_role FROM public.users WHERE id = auth.uid();
    SELECT house_name, user_name INTO b_house, b_guest
      FROM public.bookings WHERE id = NEW.booking_id;
    INSERT INTO public.audit_log (actor_id, actor_name, actor_role, action, target_type, target_id, details)
    VALUES (
      auth.uid(), COALESCE(a_name, 'غير معروف'), a_role, 'payment_status_changed', 'payment', NEW.id,
      'حالة الدفعة: ' || COALESCE(OLD.payment_status, '') || ' ← ' || NEW.payment_status ||
        ' | المبلغ: ' || COALESCE(NEW.amount::TEXT, '0') || ' ج.م' ||
        ' | الحجز: "' || COALESCE(b_house, '') || '" — ' || COALESCE(b_guest, '') ||
        COALESCE(' | ملاحظة: ' || NULLIF(NEW.admin_notes, ''), '')
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_payment_status ON public.payments;
CREATE TRIGGER trg_audit_payment_status
  AFTER UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.audit_payment_status_change();

-- ── 2. Payouts: money leaving the company ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.audit_payout_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  a_name TEXT;
  a_role TEXT;
  o_name TEXT;
  h_name TEXT;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT name, role INTO a_name, a_role FROM public.users WHERE id = auth.uid();
    SELECT name INTO o_name FROM public.users  WHERE id = NEW.owner_id;
    SELECT name INTO h_name FROM public.houses WHERE id = NEW.house_id;
    INSERT INTO public.audit_log (actor_id, actor_name, actor_role, action, target_type, target_id, details)
    VALUES (
      auth.uid(), COALESCE(a_name, 'غير معروف'), a_role, 'payout_status_changed', 'payout', NEW.id,
      'حالة التحويل: ' || COALESCE(OLD.status, '') || ' ← ' || NEW.status ||
        ' | المبلغ: ' || COALESCE(NEW.amount::TEXT, '0') || ' ج.م' ||
        ' | المالك: ' || COALESCE(o_name, '') ||
        ' | البيت: "' || COALESCE(h_name, '') || '"'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_payout_status ON public.owner_payouts;
CREATE TRIGGER trg_audit_payout_status
  AFTER UPDATE ON public.owner_payouts
  FOR EACH ROW EXECUTE FUNCTION public.audit_payout_status_change();

-- ── 3. Platform settings: the rates everyone is paid on ──────────────────────
-- One row per CHANGED field rather than one row per save, so "who lowered the
-- commission" is answerable without diffing two blobs. Fields are listed
-- explicitly: a new column added later is not silently assumed unimportant,
-- it simply is not audited until someone adds it here.
CREATE OR REPLACE FUNCTION public.audit_platform_settings_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  a_name TEXT;
  a_role TEXT;
  f      RECORD;
BEGIN
  SELECT name, role INTO a_name, a_role FROM public.users WHERE id = auth.uid();
  FOR f IN
    SELECT * FROM (VALUES
      ('نسبة عمولة المنصة',       OLD.commission_rate::TEXT,       NEW.commission_rate::TEXT),
      ('نسبة العربون',            OLD.deposit_rate::TEXT,          NEW.deposit_rate::TEXT),
      ('نقاط مقابل الجنيه',       OLD.points_per_egp::TEXT,        NEW.points_per_egp::TEXT),
      ('أقصى نسبة دفع بالنقاط',   OLD.max_redemption_pct::TEXT,    NEW.max_redemption_pct::TEXT),
      ('نقاط مكافأة الدعوة',      OLD.referral_bonus_points::TEXT, NEW.referral_bonus_points::TEXT),
      -- Added by 054/103. A refund window and a booking cap are policy the
      -- platform is held to, and the support number is how guests reach it.
      ('أيام الإلغاء المجاني',    OLD.free_cancel_days::TEXT,      NEW.free_cancel_days::TEXT),
      ('أيام الاسترداد الجزئي',   OLD.partial_refund_days::TEXT,   NEW.partial_refund_days::TEXT),
      ('أقصى حجوزات في اليوم',    OLD.max_bookings_per_day::TEXT,  NEW.max_bookings_per_day::TEXT),
      ('رقم واتساب الدعم',        OLD.support_whatsapp::TEXT,      NEW.support_whatsapp::TEXT),
      -- The accounts Pima collects into. Changing one silently redirects every
      -- guest's deposit, so it is the single most sensitive row in the table.
      ('أرقام التحصيل',           OLD.payment_methods::TEXT,       NEW.payment_methods::TEXT)
    ) AS t(label, old_val, new_val)
    WHERE t.old_val IS DISTINCT FROM t.new_val
  LOOP
    INSERT INTO public.audit_log (actor_id, actor_name, actor_role, action, target_type, target_id, details)
    VALUES (
      auth.uid(), COALESCE(a_name, 'غير معروف'), a_role, 'settings_changed', 'settings', NEW.id::TEXT,
      f.label || ': ' || COALESCE(f.old_val, '—') || ' ← ' || COALESCE(f.new_val, '—')
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_platform_settings ON public.platform_settings;
CREATE TRIGGER trg_audit_platform_settings
  AFTER UPDATE ON public.platform_settings
  FOR EACH ROW EXECUTE FUNCTION public.audit_platform_settings_change();
