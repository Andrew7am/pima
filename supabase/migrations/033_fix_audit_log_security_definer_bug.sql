-- ============================================================
-- Bug fix: the audit triggers (032) never fired. Each trigger function
-- is SECURITY DEFINER, and inside a SECURITY DEFINER function
-- current_user is the FUNCTION OWNER (postgres), not the original
-- caller's role — so `current_user = 'authenticated'` is always false
-- there, unlike in a plain (non-DEFINER) trigger such as
-- protect_booking_privileged_columns, where that check correctly
-- reflects who actually issued the statement.
--
-- auth.uid() is unaffected by this (it reads the request's JWT claim,
-- not the executing role), so dropping the current_user check and
-- relying on "does auth.uid() resolve to a user with the right role"
-- is sufficient — it's already effectively false for any non-browser
-- caller (auth.uid() is NULL outside a real user session).
-- ============================================================

CREATE OR REPLACE FUNCTION public.audit_booking_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
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
        'الحالة: ' || COALESCE(OLD.status, '') || ' ← ' || NEW.status ||
          ' | الحجز: "' || COALESCE(NEW.house_name, '') || '" — ' || COALESCE(NEW.user_name, '')
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_house_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
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
        'الحالة: ' || COALESCE(OLD.status, '') || ' ← ' || NEW.status || ' | البيت: "' || COALESCE(NEW.name, '') || '"'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_user_admin_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
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
