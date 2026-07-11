-- ============================================================
-- Admin audit log — "who approved/rejected what, and when?" had no
-- answer today. Every admin/owner decision (approve/reject a booking,
-- approve/reject/suspend a house, approve/reject/ban a user) is a plain
-- UPDATE from the client with no record of who did it beyond whatever
-- the row's current state happens to be.
--
-- Populated ONLY by SECURITY DEFINER triggers reading auth.uid() at the
-- moment of the change (same trusted pattern as the notification
-- triggers) — no client INSERT policy, so it can't be forged or
-- tampered with from the browser. Guest self-service actions (a guest
-- cancelling their own pending booking) are deliberately excluded: this
-- log is about admin/owner decisions, not user self-service.
-- ============================================================

CREATE TABLE public.audit_log (
  id          BIGSERIAL PRIMARY KEY,
  actor_id    UUID,
  actor_name  TEXT,
  actor_role  TEXT,
  action      TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id   TEXT NOT NULL,
  details     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_created_at ON public.audit_log(created_at DESC);
CREATE INDEX idx_audit_log_target ON public.audit_log(target_type, target_id);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Admin-only read. No INSERT/UPDATE/DELETE policy at all — only the
-- SECURITY DEFINER triggers below (which bypass RLS) can write, so the
-- log can't be edited or erased from the client either.
CREATE POLICY "audit_log_select_admin" ON public.audit_log FOR SELECT USING (public.is_admin(auth.uid()));

-- ── Booking status changes by owner/admin ──────────────────────────────
CREATE OR REPLACE FUNCTION public.audit_booking_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  a_name TEXT;
  a_role TEXT;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND current_user = 'authenticated' THEN
    SELECT name, role INTO a_name, a_role FROM public.users WHERE id = auth.uid();
    IF a_role IN ('owner', 'admin') THEN
      INSERT INTO public.audit_log (actor_id, actor_name, actor_role, action, target_type, target_id, details)
      VALUES (
        auth.uid(), a_name, a_role, 'booking_status_changed', 'booking', NEW.id,
        'الحالة: ' || COALESCE(OLD.status, '') || ' ← ' || NEW.status ||
          ' | الحجز: "' || COALESCE(NEW.house_name, '') || '" — ' || COALESCE(NEW.user_name, '')
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_booking_status ON public.bookings;
CREATE TRIGGER trg_audit_booking_status
  AFTER UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.audit_booking_status_change();

-- ── House status changes (admin approve/reject/suspend) ────────────────
CREATE OR REPLACE FUNCTION public.audit_house_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  a_name TEXT;
  a_role TEXT;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND current_user = 'authenticated' THEN
    SELECT name, role INTO a_name, a_role FROM public.users WHERE id = auth.uid();
    IF a_role = 'admin' THEN
      INSERT INTO public.audit_log (actor_id, actor_name, actor_role, action, target_type, target_id, details)
      VALUES (
        auth.uid(), a_name, a_role, 'house_status_changed', 'house', NEW.id,
        'الحالة: ' || COALESCE(OLD.status, '') || ' ← ' || NEW.status || ' | البيت: "' || COALESCE(NEW.name, '') || '"'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_house_status ON public.houses;
CREATE TRIGGER trg_audit_house_status
  AFTER UPDATE ON public.houses
  FOR EACH ROW EXECUTE FUNCTION public.audit_house_status_change();

-- ── User approval / ban changes (admin only) ────────────────────────────
CREATE OR REPLACE FUNCTION public.audit_user_admin_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  a_name TEXT;
  a_role TEXT;
BEGIN
  IF current_user = 'authenticated' AND auth.uid() IS DISTINCT FROM NEW.id THEN
    SELECT name, role INTO a_name, a_role FROM public.users WHERE id = auth.uid();
    IF a_role = 'admin' THEN
      IF NEW.approval_status IS DISTINCT FROM OLD.approval_status THEN
        INSERT INTO public.audit_log (actor_id, actor_name, actor_role, action, target_type, target_id, details)
        VALUES (
          auth.uid(), a_name, a_role, 'user_approval_changed', 'user', NEW.id,
          'حالة الاعتماد: ' || COALESCE(OLD.approval_status, '') || ' ← ' || COALESCE(NEW.approval_status, '') ||
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

DROP TRIGGER IF EXISTS trg_audit_user_admin_change ON public.users;
CREATE TRIGGER trg_audit_user_admin_change
  AFTER UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.audit_user_admin_change();
