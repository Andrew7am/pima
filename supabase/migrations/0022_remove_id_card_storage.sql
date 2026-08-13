-- ============================================================
-- ID card verification moved out of the app entirely — servants now
-- send their ID (front/back) directly via WhatsApp to be reviewed
-- manually before account approval, instead of uploading it in-app as
-- a base64 image stored in this column.
--
-- This removes the most sensitive category of PII (government ID) from
-- the database altogether: no image bytes, no bucket, no exposure risk
-- for this data type at all. The approval workflow itself (pending ->
-- approved/rejected) is untouched — it was never actually tied to
-- these columns technically, only gated by role in the app UI.
--
-- No data migration needed: confirmed live that id_card_front/back were
-- both empty for every existing user before this was written.
-- ============================================================

ALTER TABLE public.users
  DROP COLUMN IF EXISTS id_card_front,
  DROP COLUMN IF EXISTS id_card_back;
