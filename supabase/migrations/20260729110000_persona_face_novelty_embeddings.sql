-- Persona Studio Phase 2.0B — Face Embedding columns on novelty records.
-- Additive after 20260729100000_persona_face_novelty_memory.sql.
--
-- Storage decision: we do NOT assume pgvector is enabled.
-- Embeddings are stored as JSONB numeric arrays.
-- If pgvector is later enabled, a separate migration can add a vector column
-- and populate it from face_embedding for ANN index support.
--
-- Workspace isolation is inherited from the parent table's RLS policy.

ALTER TABLE public.persona_face_novelty_records
  -- 128-dim float array stored as JSONB (e.g. [0.12, -0.34, ...])
  ADD COLUMN IF NOT EXISTS face_embedding JSONB,
  ADD COLUMN IF NOT EXISTS face_embedding_dimension INTEGER,
  ADD COLUMN IF NOT EXISTS face_embedding_model TEXT,
  ADD COLUMN IF NOT EXISTS face_embedding_version TEXT,
  ADD COLUMN IF NOT EXISTS face_embedding_created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS face_detection_confidence DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS face_count INTEGER,
  ADD COLUMN IF NOT EXISTS face_detection_status TEXT,
  ADD COLUMN IF NOT EXISTS similarity_threshold_version TEXT;

-- Allow querying records that have an embedding vs those that do not.
CREATE INDEX IF NOT EXISTS idx_fnr_has_embedding
  ON public.persona_face_novelty_records (workspace_id)
  WHERE face_embedding IS NOT NULL;

-- Detection status index for monitoring
CREATE INDEX IF NOT EXISTS idx_fnr_detection_status
  ON public.persona_face_novelty_records (workspace_id, face_detection_status)
  WHERE face_detection_status IS NOT NULL;

COMMENT ON COLUMN public.persona_face_novelty_records.face_embedding IS
  'Server-computed 128-dim face descriptor (ResNet-34 via @vladmandic/face-api). '
  'NEVER expose this column to client. Access only through service-role admin client.';

COMMENT ON COLUMN public.persona_face_novelty_records.face_detection_status IS
  'performed | no_face | multiple_faces | low_confidence | too_small | unavailable | error';
