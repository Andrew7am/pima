-- ============================================================
-- 104: the Golden Round's triple score, scored where it counts
--
-- Rounds carry a score multiplier — Golden is 3x, the pressure
-- rounds are 2x. It has to be applied by the SERVER, not the
-- screen, because host_score and guest_score are what finalize_match
-- compares to pick the winner and what the rating change is derived
-- from. A multiplier applied only client-side would produce a
-- scoreboard that disagrees with the result it leads to: the player
-- reads «فزت» off one number and the rating moves on another.
--
-- It rides on the question, in the same JSONB the correct answer
-- already travels in. That gets agreement for free — the array is
-- written once at room creation, no RPC ever updates that column,
-- and both clients read the same row. It is the same guarantee
-- correctIdx has always relied on.
--
-- THE CLAMP IS THE POINT. The array is authored by the room
-- creator's client, so a modified client could seed multiplier: 99.
-- Unclamped this would be strictly worse than the existing
-- correctIdx exposure: a forged answer key is self-limiting, since
-- both players answer the same questions and the cheat feeds the
-- opponent too, whereas a forged multiplier is pure asymmetric gain
-- for whoever built the array. LEAST(…, 3) caps the worst case at
-- the value the design already grants.
-- ============================================================

CREATE OR REPLACE FUNCTION public.submit_answer(
  p_room_id TEXT,
  p_q_idx INT,
  p_opt_idx INT
) RETURNS TABLE(host_score INT, guest_score INT, both_answered BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER AS $$
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

  IF is_host THEN
    UPDATE public.game_rooms
       SET host_answers = host_answers || jsonb_build_object(p_q_idx::text, p_opt_idx),
           host_score = host_score + gained,
           updated_at = NOW()
     WHERE id = p_room_id;
  ELSE
    UPDATE public.game_rooms
       SET guest_answers = guest_answers || jsonb_build_object(p_q_idx::text, p_opt_idx),
           guest_score = guest_score + gained,
           updated_at = NOW()
     WHERE id = p_room_id;
  END IF;

  SELECT * INTO r FROM public.game_rooms WHERE id = p_room_id;
  IF r.host_answers ? p_q_idx::text AND r.guest_answers ? p_q_idx::text THEN
    UPDATE public.game_rooms
       SET current_question = GREATEST(current_question, p_q_idx + 1),
           updated_at = NOW()
     WHERE id = p_room_id;
    SELECT * INTO r FROM public.game_rooms WHERE id = p_room_id;
  END IF;

  RETURN QUERY SELECT r.host_score, r.guest_score,
    (r.host_answers ? p_q_idx::text AND r.guest_answers ? p_q_idx::text);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_answer(TEXT, INT, INT) TO authenticated;
