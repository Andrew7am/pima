-- ============================================================
-- «column reference "host_score" is ambiguous» — the same bug, the third time
--
-- Every answer in a live match failed. The player saw «تعذر إرسال إجابتك» and
-- the match could not move, because current_question only advances when both
-- have answered and neither answer was ever recorded.
--
-- This is exactly the bug 0039 was written to fix, and its header explains it
-- better than I can: submit_answer is declared
--   RETURNS TABLE(host_score INT, guest_score INT, both_answered BOOLEAN)
-- so plpgsql creates OUT variables named host_score and guest_score alongside
-- the real game_rooms columns of the same name. A bare `host_score` on the
-- right of `SET host_score = host_score + gained` is then ambiguous, and
-- Postgres raises rather than guess.
--
-- 0039 fixed it by aliasing the table and qualifying every read through the
-- alias. 0106 then rewrote the whole function to add the round multiplier and
-- dropped the alias — reintroducing the bug in the one line the alias existed
-- to protect. Nothing caught it: the alias was the entire fix, and it lived
-- only as a habit inside one function body.
--
-- So this restores the alias AND adds the thing that makes the habit
-- unnecessary. `#variable_conflict use_column` tells plpgsql that when a name
-- could mean either, it means the column. With that line at the top of the
-- function, the next rewrite cannot reintroduce this no matter how it is
-- written. The alias stays anyway, because being explicit costs nothing and
-- says what is meant.
--
-- Everything else is 0106's body unchanged: the multiplier, the clamping, the
-- both-answered advance and the return shape are all exactly as they were.
-- ============================================================

CREATE OR REPLACE FUNCTION public.submit_answer(
  p_room_id TEXT,
  p_q_idx INT,
  p_opt_idx INT
) RETURNS TABLE(host_score INT, guest_score INT, both_answered BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER AS $$
#variable_conflict use_column
DECLARE
  uid UUID := auth.uid();
  r public.game_rooms%ROWTYPE;
  is_host BOOLEAN;
  correct_idx INT;
  mult INT;
  gained INT;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  SELECT * INTO r FROM public.game_rooms WHERE id = p_room_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ROOM_NOT_FOUND'; END IF;
  IF r.status <> 'active' THEN RAISE EXCEPTION 'ROOM_NOT_ACTIVE'; END IF;
  IF uid <> r.host_user_id AND uid IS DISTINCT FROM r.guest_user_id THEN
    RAISE EXCEPTION 'NOT_A_PARTICIPANT';
  END IF;
  IF p_q_idx < 0 OR p_q_idx >= jsonb_array_length(r.questions) THEN
    RAISE EXCEPTION 'INVALID_QUESTION_INDEX';
  END IF;
  IF p_q_idx > r.current_question THEN
    RAISE EXCEPTION 'QUESTION_NOT_ACTIVE';
  END IF;

  is_host := (uid = r.host_user_id);
  IF is_host AND r.host_answers ? p_q_idx::text THEN
    RAISE EXCEPTION 'ALREADY_ANSWERED';
  END IF;
  IF NOT is_host AND r.guest_answers ? p_q_idx::text THEN
    RAISE EXCEPTION 'ALREADY_ANSWERED';
  END IF;

  correct_idx := (r.questions -> p_q_idx ->> 'correctIdx')::INT;

  -- Absent, malformed or out of range all collapse to 1: a question with no
  -- multiplier is worth what every question was worth before this existed,
  -- so rooms created before 102 score exactly as they did.
  mult := LEAST(GREATEST(COALESCE((r.questions -> p_q_idx ->> 'multiplier')::INT, 1), 1), 3);
  gained := CASE WHEN p_opt_idx = correct_idx THEN mult ELSE 0 END;

  -- The alias, restored. `gr.host_score` cannot resolve to the OUT parameter.
  IF is_host THEN
    UPDATE public.game_rooms AS gr
       SET host_answers = gr.host_answers || jsonb_build_object(p_q_idx::text, p_opt_idx),
           host_score   = gr.host_score + gained,
           updated_at   = NOW()
     WHERE gr.id = p_room_id;
  ELSE
    UPDATE public.game_rooms AS gr
       SET guest_answers = gr.guest_answers || jsonb_build_object(p_q_idx::text, p_opt_idx),
           guest_score   = gr.guest_score + gained,
           updated_at    = NOW()
     WHERE gr.id = p_room_id;
  END IF;

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

REVOKE ALL ON FUNCTION public.submit_answer(TEXT, INT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_answer(TEXT, INT, INT) TO authenticated;

COMMENT ON FUNCTION public.submit_answer(TEXT, INT, INT) IS
  'Records one answer. The OUT names host_score/guest_score collide with the '
  'columns of the same name, which has broken every answer in a match twice '
  '(0039, and again when 0106 rewrote the body). #variable_conflict use_column '
  'at the top makes that collision resolve to the column permanently — keep it '
  'on any future rewrite.';
