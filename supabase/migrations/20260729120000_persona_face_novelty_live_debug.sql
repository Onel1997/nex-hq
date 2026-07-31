-- Persona Studio Phase 2.0B.2 — Live novelty diagnostic evidence + candidate statuses.
-- Additive after 20260729110000_persona_face_novelty_embeddings.sql.
--
-- live_evaluation_evidence stores NON-SENSITIVE diagnostic fields only.
-- NEVER store face_embedding vectors, image bytes, or signed URLs in this column.

ALTER TABLE public.persona_face_novelty_records
  ADD COLUMN IF NOT EXISTS live_evaluation_evidence JSONB;

COMMENT ON COLUMN public.persona_face_novelty_records.live_evaluation_evidence IS
  'Development diagnostic evidence for controlled live novelty tests. '
  'SafeFaceNoveltyLiveDebug shape only — no embedding vectors, no signed URLs.';

-- Allow novelty_blocked / novelty_failed candidate statuses for fail-closed visibility.
ALTER TABLE public.persona_candidates
  DROP CONSTRAINT IF EXISTS persona_candidates_status_check;

ALTER TABLE public.persona_candidates
  ADD CONSTRAINT persona_candidates_status_check
  CHECK (status IN (
    'queued', 'generating', 'ready', 'shortlisted', 'selected', 'rejected',
    'failed', 'archived', 'needs_manual_references', 'identity_validation_failed',
    'novelty_blocked', 'novelty_failed'
  ));
