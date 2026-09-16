-- ============================================================
-- The match opens on both sides
--
-- A player searches, an opponent is found, and the game opens for exactly one
-- of them. The other sits on «في انتظار الخصم» while their opponent plays.
--
-- The joiner is fine: their own call to find_or_create_random_room returns, and
-- they fetch the whole row themselves. It is the HOST who is told about the
-- join, over realtime — and what arrives is not the whole row.
--
-- game_rooms.questions is a JSONB column holding the full question set, which
-- is far past the TOAST threshold. Under the DEFAULT replica identity Postgres
-- omits unchanged TOASTed columns from a logical-replication UPDATE, so the
-- payload for «guest joined» carries guest_user_id, guest_name, guest_rating,
-- status and updated_at — and no questions. The host's client replaces its
-- room object with that payload and loses the questions it already had, so the
-- match cannot render. The guest, holding a complete row, plays on.
--
-- REPLICA IDENTITY FULL makes the payload complete. It costs more WAL per
-- update on this table, which is a table of short-lived two-player rooms — a
-- price worth paying for a match that starts.
--
-- The client is being fixed in the same change to merge the payload forward
-- instead of replacing wholesale, so a partial frame can never strip a field
-- again. Both, deliberately: the schema makes it correct, the merge makes it
-- safe the next time something arrives incomplete.
-- ============================================================

ALTER TABLE public.game_rooms REPLICA IDENTITY FULL;

-- Same shape, same reason: rm_docs carries a JSONB `data` blob that the random
-- match shim reads wholesale, and its listeners re-read the doc on every event
-- rather than trusting the payload — but a future caller that does trust it
-- would hit exactly the bug above.
ALTER TABLE public.rm_docs REPLICA IDENTITY FULL;

COMMENT ON TABLE public.game_rooms IS
  'Two-player match rooms. REPLICA IDENTITY FULL on purpose: `questions` is '
  'TOASTed, and under the default identity the host''s realtime payload for a '
  'join arrived without it — so the game opened for the guest only.';
