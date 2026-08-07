-- Phase 2.2E — Attempt-level novelty evidence (additive).
-- Persists fresh-embedding status, Euclidean distance, and match context
-- for every discovery attempt regardless of DEBUG_MODE.

ALTER TABLE public.persona_discovery_attempts
  ADD COLUMN IF NOT EXISTS embedding_status TEXT,
  ADD COLUMN IF NOT EXISTS euclidean_distance DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS matched_project_id UUID,
  ADD COLUMN IF NOT EXISTS matched_same_run BOOLEAN;

COMMENT ON COLUMN public.persona_discovery_attempts.embedding_status IS
  'Phase 2.2E: created|reused|missing — whether this attempt got a fresh embedding evaluation';
COMMENT ON COLUMN public.persona_discovery_attempts.euclidean_distance IS
  'Phase 2.2E: closest prior Euclidean distance from biological evaluator';
COMMENT ON COLUMN public.persona_discovery_attempts.matched_project_id IS
  'Phase 2.2E: creation project of closest prior match (if any)';
COMMENT ON COLUMN public.persona_discovery_attempts.matched_same_run IS
  'Phase 2.2E: whether closest prior match belongs to the same creation project/run';
