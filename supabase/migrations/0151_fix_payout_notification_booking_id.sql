-- ============================================================
-- 0151 — FIX FIN-030: payout notifications write an invalid booking_id
--
-- THE DEFECT
--   notify_owner_on_payout_update (live version: migration 0068) inserts
--   notifications with booking_id = '' for its three payout-status branches.
--   An empty string is not NULL, and notifications.booking_id carries
--   notifications_booking_id_fkey -> bookings(id) (migration 0001, never
--   altered or dropped). No migration creates a booking with that id, and the
--   database confirms none exists.
--
--   So every one of those inserts violates the foreign key. Because both
--   triggers are AFTER-row triggers on owner_payouts, the failure aborts the
--   parent statement: advancing a payout to processing, completed or rejected
--   fails outright and the payout row is never written.
--
-- WHY IT HAS NOT BEEN SEEN
--   Diagnostics on the live database: zero bookings with id = '', zero
--   notifications with booking_id = '', and a single owner_payouts row sitting
--   at 'pending' -- the one status that reaches no notification branch. The
--   defect has simply never been exercised, because no payout has ever been
--   advanced. The first admin settlement will hit it.
--
-- THE FIX
--   booking_id = ''  ->  booking_id = NULL, in all three branches.
--
--   This matches what the rest of the codebase already does. Three safe
--   conventions exist for a notification that belongs to no booking: omit the
--   column (0047), pass an explicit NULL (0006, 0093, 0101), or sanitise with
--   NULLIF(p_booking, '') as emit_notification does (0021). The empty string
--   appears in exactly one function -- this one. emit_notification's NULLIF
--   shows the convention was understood; the payout trigger simply missed it.
--
-- SCOPE
--   The function body below was extracted mechanically from 0068 lines 25-56.
--   The ONLY difference is the three booking_id expressions. Title, message,
--   type, id construction, recipient, status branching, the TG_OP = 'UPDATE'
--   short-circuit, LANGUAGE, SECURITY DEFINER and the absence of a search_path
--   setting are all byte-identical to the live definition.
--
--   CREATE OR REPLACE rebinds the body in place, so both existing triggers --
--   trg_notify_owner_on_payout_insert and trg_notify_owner_on_payout_update --
--   pick it up with no trigger changes. Neither is dropped, altered, or
--   re-created here.
--
--   Nothing else is touched: not the foreign key, not owner_payouts RLS or
--   grants, not any payout status, and no sentinel booking is introduced.
--
-- INDEPENDENCE
--   Purely additive and self-contained. It depends on nothing from 0139-0150
--   and nothing in 0139-0150 depends on it, so it can be applied before or
--   after that sequence, or on its own.
--
-- NOTE, DELIBERATELY NOT ACTED ON HERE
--   The live function is SECURITY DEFINER with no SET search_path. That is a
--   pre-existing hardening gap shared with other functions in this schema, not
--   part of FIN-030. Changing it would alter behaviour beyond the defect, so
--   it is left exactly as found and flagged for a separate decision.
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_owner_on_payout_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  amt TEXT := round(NEW.amount)::text;
  nid TEXT := 'notif_payout_' || NEW.id || '_' || NEW.status || '_' || extract(epoch FROM clock_timestamp())::bigint;
BEGIN
  -- On UPDATE, only fire when the status actually changed.
  IF TG_OP = 'UPDATE' AND NEW.status = OLD.status THEN RETURN NEW; END IF;

  IF NEW.status = 'completed' THEN
    INSERT INTO public.notifications (id, user_id, booking_id, title, message, type, is_read)
    VALUES (nid, NEW.owner_id, NULL,
      'تم تحويل مستحقاتك ✓',
      'تم تحويل ' || amt || ' ج.م من مستحقاتك بنجاح. يرجى التحقق من محفظتك.',
      'success', FALSE);
  ELSIF NEW.status = 'processing' THEN
    INSERT INTO public.notifications (id, user_id, booking_id, title, message, type, is_read)
    VALUES (nid, NEW.owner_id, NULL,
      'جارٍ تحويل مستحقاتك',
      'بدأت الإدارة في تحويل ' || amt || ' ج.م من مستحقاتك.',
      'info', FALSE);
  ELSIF NEW.status = 'rejected' THEN
    INSERT INTO public.notifications (id, user_id, booking_id, title, message, type, is_read)
    VALUES (nid, NEW.owner_id, NULL,
      'تعذّر تحويل مستحقاتك',
      'تم رفض طلب تحويل ' || amt || ' ج.م. يرجى مراجعة الإدارة.',
      'danger', FALSE);
  END IF;

  RETURN NEW;
END;
$$;
