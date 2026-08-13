-- ============================================================
-- MEDIUM fix: notifications were broken AND would be forgeable.
--
-- The notifications table has SELECT/UPDATE policies but NO INSERT
-- policy, so every client-side createNotification() silently failed —
-- notifications never actually worked. Naively opening INSERT would let
-- any user forge notifications to anyone (phishing: "your payment is
-- confirmed"). So instead of a client INSERT policy, notifications are
-- created only through trusted server-side paths:
--
--   * emit_notification() — SECURITY DEFINER RPC the client calls for
--     event notifications, but which authorizes the sender: admins may
--     notify anyone; a house owner may notify the guest of a booking on
--     their house; a guest may notify admins about their own booking;
--     anyone may notify themselves. Anything else is rejected.
--
--   * a trigger on payments INSERT that notifies the guest ("proof
--     received") and every admin ("new payment to review") — this also
--     fixes the hardcoded, non-existent 'user_admin' recipient the
--     client used before.
--
-- No client INSERT policy is added, so forged notifications remain
-- impossible.
-- ============================================================

CREATE OR REPLACE FUNCTION public.emit_notification(
  p_target  UUID,
  p_booking TEXT,
  p_title   TEXT,
  p_message TEXT,
  p_type    TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  caller UUID := auth.uid();
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;

  IF NOT (
       public.is_admin(caller)                        -- admin may notify anyone
    OR p_target = caller                               -- self
    OR EXISTS (                                        -- owner -> guest of a booking on their house
         SELECT 1 FROM public.bookings b
         JOIN public.houses h ON h.id = b.house_id
         WHERE b.id = p_booking AND h.owner_id = caller AND b.user_id = p_target)
    OR EXISTS (                                        -- guest -> admin about their own booking
         SELECT 1 FROM public.bookings b
         WHERE b.id = p_booking AND b.user_id = caller AND public.is_admin(p_target))
  ) THEN
    RAISE EXCEPTION 'NOT_ALLOWED_TO_NOTIFY';
  END IF;

  INSERT INTO public.notifications (id, user_id, booking_id, title, message, type, is_read)
  VALUES (
    'notif_' || caller || '_' || extract(epoch FROM clock_timestamp())::bigint || '_' || floor(random() * 100000)::int,
    p_target, NULLIF(p_booking, ''), p_title, p_message,
    CASE WHEN p_type IN ('success','danger','info') THEN p_type ELSE 'info' END,
    FALSE
  );
END;
$$;

-- New payment proof -> notify the guest and every admin, server-side.
CREATE OR REPLACE FUNCTION public.notify_on_payment_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  b_house    TEXT;
  b_user     UUID;
  b_username TEXT;
  adm        UUID;
  amt        TEXT := to_char(NEW.amount, 'FM999999990');
BEGIN
  SELECT house_name, user_id, user_name INTO b_house, b_user, b_username
    FROM public.bookings WHERE id = NEW.booking_id;

  IF b_user IS NOT NULL THEN
    INSERT INTO public.notifications (id, user_id, booking_id, title, message, type, is_read)
    VALUES ('notif_payrcv_' || NEW.id, b_user, NEW.booking_id,
      'تم إرسال إثبات الدفع بنجاح ⏳',
      'تم استلام تفاصيل وإثبات الدفع الخاص بك بمبلغ ' || amt || ' ج.م وجاري المراجعة والتحقق من قبل الإدارة لتأكيد الحجز.',
      'info', FALSE);
  END IF;

  FOR adm IN SELECT id FROM public.users WHERE role = 'admin' LOOP
    INSERT INTO public.notifications (id, user_id, booking_id, title, message, type, is_read)
    VALUES ('notif_payadm_' || NEW.id || '_' || adm, adm, NEW.booking_id,
      'إثبات دفع جديد بانتظار المراجعة 💸',
      'قام المستخدم "' || COALESCE(b_username, '') || '" بتقديم إثبات دفع بمبلغ ' || amt || ' ج.م للحجز الخاص به في "' || COALESCE(b_house, '') || '".',
      'info', FALSE);
  END LOOP;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_payment_insert ON public.payments;
CREATE TRIGGER trg_notify_on_payment_insert
  AFTER INSERT ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_payment_insert();
