-- ============================================================
-- Notification-system reliability pass. Audit found:
--   1. No DELETE policy on notifications -> "Clear all" silently deletes
--      zero rows (RLS has no matching policy, PostgREST returns success
--      with 0 rows affected) -> cleared notifications resurrect on reload.
--   2. notifications was never added to the supabase_realtime publication
--      -> new notifications only ever appear after a full page reload.
--   3. Booking status-change notifications (approve/reject/deposit
--      confirmed/check-in/check-out) were fired client-side via the
--      emit_notification RPC from App.tsx — if that fire-and-forget RPC
--      call fails (network blip, transient error), the recipient never
--      learns of the status change, silently, forever. Moving these into
--      a trusted trigger (same pattern as notify_owner_on_booking_cancel,
--      migration 030) makes the notification atomic with the status
--      change itself: if the UPDATE commits, the notification commits.
--   4. Payment verify/reject notifications had the same fire-and-forget
--      client-RPC fragility — same fix, a trigger on payments UPDATE.
--   5. New reviews never notified the house owner at all — total gap.
--   6. New booking-chat messages never generated a bell notification —
--      only the realtime chat channel fired, so a party not currently
--      looking at that thread never learns a message arrived.
-- ============================================================

-- 1. Missing DELETE policy
CREATE POLICY "notifs_delete_user" ON public.notifications FOR DELETE USING (auth.uid() = user_id);

-- 2. Realtime delivery
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- 3. Booking status-change notifications, server-side and atomic with the change.
CREATE OR REPLACE FUNCTION public.notify_guest_on_booking_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
    INSERT INTO public.notifications (id, user_id, booking_id, title, message, type, is_read)
    VALUES ('notif_appr_' || NEW.id, NEW.user_id, NEW.id,
      'تم قبول وتأكيد الحجز 🎉',
      'تهانينا! تم قبول وتأكيد حجزك في "' || COALESCE(NEW.house_name, '') || '" للفترة من ' || NEW.check_in || ' إلى ' || NEW.check_out || '.',
      'success', FALSE);
  END IF;

  IF NEW.status = 'rejected' AND OLD.status = 'pending' THEN
    INSERT INTO public.notifications (id, user_id, booking_id, title, message, type, is_read)
    VALUES ('notif_rej_' || NEW.id, NEW.user_id, NEW.id,
      'تم رفض طلب الحجز ⚠️',
      'نأسف لإبلاغك بأنه قد تم رفض طلب حجزك في "' || COALESCE(NEW.house_name, '') || '" للفترة من ' || NEW.check_in || ' إلى ' || NEW.check_out || '.',
      'danger', FALSE);
  END IF;

  IF NEW.deposit_paid = TRUE AND (OLD.deposit_paid IS DISTINCT FROM TRUE) THEN
    INSERT INTO public.notifications (id, user_id, booking_id, title, message, type, is_read)
    VALUES ('notif_dep_' || NEW.id || '_' || extract(epoch FROM clock_timestamp())::bigint, NEW.user_id, NEW.id,
      'تم استلام العربون بنجاح ✓',
      'أكد "' || COALESCE(NEW.house_name, '') || '" استلام العربون بمبلغ ' || to_char(COALESCE(NEW.deposit_amount, 0), 'FM999999990') || ' ج.م. الحجز مؤمن الآن.',
      'success', FALSE);
  END IF;

  IF NEW.checked_in_at IS NOT NULL AND OLD.checked_in_at IS NULL THEN
    INSERT INTO public.notifications (id, user_id, booking_id, title, message, type, is_read)
    VALUES ('notif_ckin_' || NEW.id, NEW.user_id, NEW.id,
      'تم تسجيل وصولك 🏠',
      'تم تسجيل وصولك بنجاح لبيت "' || COALESCE(NEW.house_name, '') || '". نتمنى لك إقامة مباركة وممتعة!',
      'info', FALSE);
  END IF;

  IF NEW.status = 'completed' AND OLD.status <> 'completed' THEN
    INSERT INTO public.notifications (id, user_id, booking_id, title, message, type, is_read)
    VALUES ('notif_ckout_' || NEW.id, NEW.user_id, NEW.id,
      'شكراً لإقامتك 💚',
      'تمت مغادرتك من "' || COALESCE(NEW.house_name, '') || '". يسعدنا مشاركتك تقييمك للبيت لتساعد الآخرين.',
      'success', FALSE);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_guest_on_booking_update ON public.bookings;
CREATE TRIGGER trg_notify_guest_on_booking_update
  AFTER UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.notify_guest_on_booking_update();

-- 4. Payment verify/reject notifications, server-side and atomic with the change.
CREATE OR REPLACE FUNCTION public.notify_guest_on_payment_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.payment_status = 'approved' AND OLD.payment_status = 'pending' THEN
    INSERT INTO public.notifications (id, user_id, booking_id, title, message, type, is_read)
    VALUES ('notif_payok_' || NEW.id, NEW.user_id, NEW.booking_id,
      'تم تأكيد دفعتك ✓',
      'تم التحقق من دفعتك بمبلغ ' || to_char(NEW.amount, 'FM999999990') || ' ج.م بنجاح.',
      'success', FALSE);
  ELSIF NEW.payment_status = 'rejected' AND OLD.payment_status = 'pending' THEN
    INSERT INTO public.notifications (id, user_id, booking_id, title, message, type, is_read)
    VALUES ('notif_payrej_' || NEW.id, NEW.user_id, NEW.booking_id,
      'تعذر تأكيد دفعتك ⚠️',
      'لم يتم التحقق من دفعتك بمبلغ ' || to_char(NEW.amount, 'FM999999990') || ' ج.م. يرجى مراجعة التفاصيل أو التواصل مع الدعم.' ||
        CASE WHEN NEW.admin_notes IS NOT NULL THEN ' ملاحظة: ' || NEW.admin_notes ELSE '' END,
      'danger', FALSE);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_guest_on_payment_update ON public.payments;
CREATE TRIGGER trg_notify_guest_on_payment_update
  AFTER UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.notify_guest_on_payment_update();

-- 5. New review -> notify house owner (previously a total gap).
CREATE OR REPLACE FUNCTION public.notify_owner_on_review_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  h_owner UUID;
BEGIN
  SELECT owner_id INTO h_owner FROM public.houses WHERE id = NEW.house_id;
  IF h_owner IS NOT NULL AND h_owner <> NEW.user_id THEN
    INSERT INTO public.notifications (id, user_id, title, message, type, is_read)
    VALUES ('notif_review_' || NEW.id, h_owner,
      'تقييم جديد لبيتك ⭐',
      'قام "' || COALESCE(NEW.user_name, '') || '" بإضافة تقييم جديد (' || NEW.rating || '/5) لـ "' || COALESCE(NEW.house_name, '') || '".',
      'info', FALSE);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_owner_on_review_insert ON public.reviews;
CREATE TRIGGER trg_notify_owner_on_review_insert
  AFTER INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.notify_owner_on_review_insert();

-- 6. New booking-chat message -> notify the other participant (previously
-- only the realtime chat channel fired, silent for anyone not already on
-- that screen). Extends send_booking_message (043) rather than adding a
-- separate trigger, since the recipient is already resolved there.
CREATE OR REPLACE FUNCTION public.send_booking_message(p_booking_id TEXT, p_content TEXT)
RETURNS public.booking_messages
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  uid UUID := auth.uid();
  my_name TEXT;
  b_guest UUID;
  b_owner UUID;
  b_house_name TEXT;
  result public.booking_messages%ROWTYPE;
  trimmed TEXT := trim(p_content);
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF trimmed IS NULL OR length(trimmed) < 1 OR length(trimmed) > 2000 THEN RAISE EXCEPTION 'INVALID_CONTENT'; END IF;

  SELECT b.user_id, h.owner_id, b.house_name INTO b_guest, b_owner, b_house_name
    FROM public.bookings b JOIN public.houses h ON h.id = b.house_id
   WHERE b.id = p_booking_id;

  IF NOT (uid = b_guest OR uid = b_owner) AND NOT public.is_admin(uid) THEN RAISE EXCEPTION 'NOT_A_PARTICIPANT'; END IF;

  SELECT name INTO my_name FROM public.users WHERE id = uid;

  INSERT INTO public.booking_messages (booking_id, sender_id, sender_name, content)
    VALUES (p_booking_id, uid, my_name, trimmed)
    RETURNING * INTO result;

  IF uid = b_guest AND b_owner IS NOT NULL THEN
    INSERT INTO public.notifications (id, user_id, booking_id, title, message, type, is_read)
    VALUES ('notif_msg_' || result.id, b_owner, p_booking_id, 'رسالة جديدة 💬',
      COALESCE(my_name, '') || ': ' || left(trimmed, 120), 'info', FALSE);
  ELSIF uid = b_owner AND b_guest IS NOT NULL THEN
    INSERT INTO public.notifications (id, user_id, booking_id, title, message, type, is_read)
    VALUES ('notif_msg_' || result.id, b_guest, p_booking_id, 'رسالة جديدة من ' || COALESCE(b_house_name, 'صاحب البيت') || ' 💬',
      COALESCE(my_name, '') || ': ' || left(trimmed, 120), 'info', FALSE);
  END IF;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_booking_message(TEXT, TEXT) TO authenticated;

-- 7. Account approval/rejection -> notify the servant/owner, server-side.
-- Same fragility class as the booking/payment cases above: this used to
-- fire client-side from handleSetUserApproval in App.tsx via the
-- fire-and-forget emit_notification RPC.
CREATE OR REPLACE FUNCTION public.notify_user_on_approval_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.approval_status = 'approved' AND OLD.approval_status IS DISTINCT FROM 'approved' THEN
    INSERT INTO public.notifications (id, user_id, title, message, type, is_read)
    VALUES ('notif_useraprv_' || NEW.id || '_' || extract(epoch FROM clock_timestamp())::bigint, NEW.id,
      'تم اعتماد حسابك ✓',
      'تهانينا! تم مراجعة حسابك والموافقة عليه، يمكنك الآن استخدام المنصة بالكامل.',
      'success', FALSE);
  ELSIF NEW.approval_status = 'rejected' AND OLD.approval_status IS DISTINCT FROM 'rejected' THEN
    INSERT INTO public.notifications (id, user_id, title, message, type, is_read)
    VALUES ('notif_userrej_' || NEW.id || '_' || extract(epoch FROM clock_timestamp())::bigint, NEW.id,
      'تعذر اعتماد حسابك',
      'نأسف، تعذرت الموافقة على حسابك حالياً. تواصل مع الدعم الفني لمزيد من التفاصيل.',
      'danger', FALSE);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_user_on_approval_update ON public.users;
CREATE TRIGGER trg_notify_user_on_approval_update
  AFTER UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.notify_user_on_approval_update();
