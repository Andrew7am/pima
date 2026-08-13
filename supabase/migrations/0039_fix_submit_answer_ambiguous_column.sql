-- ============================================================
-- Bug: every submit_answer call failed with
--   "column reference \"host_score\" is ambiguous"
-- (or guest_score for the guest side) — reported live the moment
-- anyone tried to answer a question in a multiplayer match.
--
-- Cause: submit_answer (036) is declared
--   RETURNS TABLE(host_score INT, guest_score INT, both_answered BOOLEAN)
-- which makes plpgsql create OUT-parameter variables named
-- host_score/guest_score, IN ADDITION to the real
-- public.game_rooms.host_score/guest_score columns. The bare
-- reference on the right-hand side of
--   UPDATE public.game_rooms SET host_score = host_score + ...
-- is then ambiguous between the OUT parameter and the table column
-- — Postgres can't tell which one you meant, and raises rather than
-- guessing. award_game_reward/finalize_match never hit this because
-- their RETURNS TABLE column names (new_xp, host_rating_change, ...)
-- don't collide with any real column name; submit_answer is the only
-- RPC in this project where the output names and a written-to
-- column name happen to be identical.
--
-- Fix: alias the target table in every UPDATE inside this function
-- and qualify the right-hand-side references through the alias, so
-- they can no longer resolve to the OUT parameter. Return shape is
-- unchanged — no client changes needed.
-- ============================================================

CREATE OR REPLACE FUNCTION public.submit_answer(
  p_room_id TEXT,
  p_q_idx   INT,
  p_opt_idx INT
) RETURNS TABLE(host_score INT, guest_score INT, both_answered BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  uid UUID := auth.uid();
  r public.game_rooms%ROWTYPE;
  correct_idx INT;
  is_host BOOLEAN;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  SELECT * INTO r FROM public.game_rooms WHERE id = p_room_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ROOM_NOT_FOUND'; END IF;
  IF r.status <> 'active' THEN RAISE EXCEPTION 'ROOM_NOT_ACTIVE'; END IF;
  IF uid <> r.host_user_id AND uid <> r.guest_user_id THEN
    RAISE EXCEPTION 'NOT_A_PARTICIPANT';
  END IF;
  IF p_q_idx < 0 OR p_q_idx >= jsonb_array_length(r.questions) THEN
    RAISE EXCEPTION 'INVALID_QUESTION_INDEX';
  END IF;

  is_host := uid = r.host_user_id;

  -- No overwriting an already-submitted answer
  IF is_host AND r.host_answers ? p_q_idx::text THEN
    RAISE EXCEPTION 'ALREADY_ANSWERED';
  END IF;
  IF NOT is_host AND r.guest_answers ? p_q_idx::text THEN
    RAISE EXCEPTION 'ALREADY_ANSWERED';
  END IF;

  correct_idx := (r.questions -> p_q_idx ->> 'correctIdx')::INT;

  IF is_host THEN
    UPDATE public.game_rooms AS gr
       SET host_answers = gr.host_answers || jsonb_build_object(p_q_idx::text, p_opt_idx),
           host_score = gr.host_score + CASE WHEN p_opt_idx = correct_idx THEN 1 ELSE 0 END,
           updated_at = NOW()
     WHERE gr.id = p_room_id;
  ELSE
    UPDATE public.game_rooms AS gr
       SET guest_answers = gr.guest_answers || jsonb_build_object(p_q_idx::text, p_opt_idx),
           guest_score = gr.guest_score + CASE WHEN p_opt_idx = correct_idx THEN 1 ELSE 0 END,
           updated_at = NOW()
     WHERE gr.id = p_room_id;
  END IF;

  -- Advance current_question when both have answered this one
  SELECT * INTO r FROM public.game_rooms WHERE id = p_room_id;
  IF r.host_answers ? p_q_idx::text AND r.guest_answers ? p_q_idx::text THEN
    UPDATE public.game_rooms AS gr
       SET current_question = GREATEST(gr.current_question, p_q_idx + 1),
           updated_at = NOW()
     WHERE gr.id = p_room_id;
    SELECT * INTO r FROM public.game_rooms WHERE id = p_room_id;
  END IF;

  RETURN QUERY SELECT r.host_score, r.guest_score,
    (r.host_answers ? p_q_idx::text AND r.guest_answers ? p_q_idx::text);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_answer(TEXT, INT, INT) TO authenticated;
