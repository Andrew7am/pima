-- ─────────────────────────────────────────────────────────────────────────────
-- 105 — Say the audit log's status words in Arabic
--
-- Every audit row writes its details at insert time, and every one of them
-- pastes the raw database enum into an otherwise Arabic sentence:
--
--   الحالة: pending ← approved | الحجز: "بيت مارمرقس" — أسرة القديس مرقس
--
-- 104 added three more triggers and inherited the habit. Fixing only the new
-- ones would have left new rows reading differently from old ones in the same
-- list, so all five are rewritten together.
--
-- The Arabic is taken from what each screen ALREADY says, not invented here:
-- house «نشط / قيد المراجعة / موقوف» from the admin houses list, payout
-- «قيد المراجعة / جارٍ التحويل / تم التحويل» from PAYOUT_STATUS in the owner
-- finance centre, payment «معتمد / معلّق / مرفوض» from the admin payments
-- tab, booking «مؤكد / مكتمل» from lib/ownerBookingBadge. A log that invents
-- a third vocabulary is a log people have to translate back.
--
-- The same key means different words in different contexts — a house that is
-- `approved` is «نشط», a booking that is `approved` is «مؤكد» — so the helper
-- takes the kind as well as the value.
--
-- ALSO: the three functions from 033 are recreated here with
-- `SET search_path = public, pg_temp`. They are SECURITY DEFINER and had no
-- fixed search_path, which is the hole where a schema earlier in the caller's
-- path can shadow a referenced object. 104's functions already set it; this
-- brings the older three up to the same footing.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.ar_audit_status(kind TEXT, value TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(
    CASE kind
      WHEN 'booking' THEN CASE value
        WHEN 'pending'    THEN 'بانتظار الرد'
        WHEN 'approved'   THEN 'مؤكد'
        WHEN 'completed'  THEN 'مكتمل'
        WHEN 'rejected'   THEN 'مرفوض'
        WHEN 'cancelled'  THEN 'ملغي'
      END
      WHEN 'house' THEN CASE value
        WHEN 'pending'    THEN 'قيد المراجعة'
        WHEN 'approved'   THEN 'نشط'
        WHEN 'rejected'   THEN 'مرفوض'
        WHEN 'suspended'  THEN 'موقوف'
      END
      WHEN 'approval' THEN CASE value
        WHEN 'pending'    THEN 'بانتظار المراجعة'
        WHEN 'approved'   THEN 'معتمد'
        WHEN 'rejected'   THEN 'مرفوض'
      END
      WHEN 'payment' THEN CASE value
        WHEN 'pending'    THEN 'معلّق'
        WHEN 'approved'   THEN 'معتمد'
        WHEN 'rejected'   THEN 'مرفوض'
      END
      WHEN 'payout' THEN CASE value
        WHEN 'pending'    THEN 'قيد المراجعة'
        WHEN 'processing' THEN 'جارٍ التحويل'
        WHEN 'completed'  THEN 'تم التحويل'
        WHEN 'rejected'   THEN 'مرفوض'
      END
    END,
    -- An unrecognised value keeps its raw form rather than vanishing: a log
    -- that silently drops what it cannot name is worse than one that shows it.
    COALESCE(value, '—')
  );
$$;

-- ── 1. Bookings (from 033) ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.audit_booking_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  a_name TEXT;
  a_role TEXT;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT name, role INTO a_name, a_role FROM public.users WHERE id = auth.uid();
    IF a_role IN ('owner', 'admin') THEN
      INSERT INTO public.audit_log (actor_id, actor_name, actor_role, action, target_type, target_id, details)
      VALUES (
        auth.uid(), a_name, a_role, 'booking_status_changed', 'booking', NEW.id,
        'الحالة: ' || public.ar_audit_status('booking', OLD.status) ||
          ' ← ' || public.ar_audit_status('booking', NEW.status) ||
          ' | الحجز: "' || COALESCE(NEW.house_name, '') || '" — ' || COALESCE(NEW.user_name, '')
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ── 2. Houses (from 033) ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.audit_house_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  a_name TEXT;
  a_role TEXT;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT name, role INTO a_name, a_role FROM public.users WHERE id = auth.uid();
    IF a_role = 'admin' THEN
      INSERT INTO public.audit_log (actor_id, actor_name, actor_role, action, target_type, target_id, details)
      VALUES (
        auth.uid(), a_name, a_role, 'house_status_changed', 'house', NEW.id,
        'الحالة: ' || public.ar_audit_status('house', OLD.status) ||
          ' ← ' || public.ar_audit_status('house', NEW.status) ||
          ' | البيت: "' || COALESCE(NEW.name, '') || '"'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ── 3. Users: approval + ban (from 033) ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.audit_user_admin_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  a_name TEXT;
  a_role TEXT;
BEGIN
  IF auth.uid() IS DISTINCT FROM NEW.id THEN
    SELECT name, role INTO a_name, a_role FROM public.users WHERE id = auth.uid();
    IF a_role = 'admin' THEN
      IF NEW.approval_status IS DISTINCT FROM OLD.approval_status THEN
        INSERT INTO public.audit_log (actor_id, actor_name, actor_role, action, target_type, target_id, details)
        VALUES (
          auth.uid(), a_name, a_role, 'user_approval_changed', 'user', NEW.id,
          'حالة الاعتماد: ' || public.ar_audit_status('approval', OLD.approval_status) ||
            ' ← ' || public.ar_audit_status('approval', NEW.approval_status) ||
            ' | المستخدم: ' || COALESCE(NEW.name, '')
        );
      END IF;
      IF NEW.is_banned IS DISTINCT FROM OLD.is_banned THEN
        INSERT INTO public.audit_log (actor_id, actor_name, actor_role, action, target_type, target_id, details)
        VALUES (
          auth.uid(), a_name, a_role, 'user_ban_changed', 'user', NEW.id,
          (CASE WHEN NEW.is_banned THEN 'تم حظر: ' ELSE 'تم رفع الحظر عن: ' END) || COALESCE(NEW.name, '')
        );
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ── 4. Payments (from 104) ───────────────────────────────────────────────────
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
      'حالة الدفعة: ' || public.ar_audit_status('payment', OLD.payment_status) ||
        ' ← ' || public.ar_audit_status('payment', NEW.payment_status) ||
        ' | المبلغ: ' || COALESCE(NEW.amount::TEXT, '0') || ' ج.م' ||
        ' | الحجز: "' || COALESCE(b_house, '') || '" — ' || COALESCE(b_guest, '') ||
        COALESCE(' | ملاحظة: ' || NULLIF(NEW.admin_notes, ''), '')
    );
  END IF;
  RETURN NEW;
END;
$$;

-- ── 5. Payouts (from 104) ────────────────────────────────────────────────────
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
      'حالة التحويل: ' || public.ar_audit_status('payout', OLD.status) ||
        ' ← ' || public.ar_audit_status('payout', NEW.status) ||
        ' | المبلغ: ' || COALESCE(NEW.amount::TEXT, '0') || ' ج.م' ||
        ' | المالك: ' || COALESCE(o_name, '') ||
        ' | البيت: "' || COALESCE(h_name, '') || '"'
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Rows written before this migration keep the English they were written with.
-- They are a record of what happened and are not rewritten.
