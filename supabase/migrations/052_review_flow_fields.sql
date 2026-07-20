-- ============================================================
-- New 3-step guest review flow: adds structured fields the old
-- single-screen review form never captured (visit purpose, what the
-- guest liked, what problems they hit, and whether to display their
-- real name or "زائر موثق"). All additive/nullable — existing rows are
-- unaffected and still render fine with these left blank.
-- ============================================================

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS visit_purpose TEXT
    CHECK (visit_purpose IN ('conference', 'business_meeting', 'training_course', 'exhibition', 'other')),
  ADD COLUMN IF NOT EXISTS liked_tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS problem_tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS problem_other TEXT,
  ADD COLUMN IF NOT EXISTS display_anonymous BOOLEAN NOT NULL DEFAULT FALSE;
