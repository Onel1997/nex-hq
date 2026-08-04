-- Persona Studio Phase 2.0C — Historical face embedding backfill jobs.
-- Development-oriented batch processing of prior forbidden faces that lack embeddings.
-- Workspace-scoped; never stores image bytes or duplicate embedding vectors in results.

-- ---------------------------------------------------------------------------
-- persona_face_embedding_backfill_jobs
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.persona_face_embedding_backfill_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.brain_workspaces(id) ON DELETE CASCADE,
  archetype_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  total_records INTEGER NOT NULL DEFAULT 0,
  processed_records INTEGER NOT NULL DEFAULT 0,
  embedded_records INTEGER NOT NULL DEFAULT 0,
  skipped_records INTEGER NOT NULL DEFAULT 0,
  failed_records INTEGER NOT NULL DEFAULT 0,
  batch_size INTEGER NOT NULL DEFAULT 5,
  retry_failed_only BOOLEAN NOT NULL DEFAULT FALSE,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  evaluator_model TEXT,
  evaluator_version TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'persona_face_embedding_backfill_jobs_status_check'
  ) THEN
    ALTER TABLE public.persona_face_embedding_backfill_jobs
      ADD CONSTRAINT persona_face_embedding_backfill_jobs_status_check
      CHECK (status IN (
        'pending', 'running', 'completed', 'completed_with_errors', 'failed'
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_face_emb_backfill_jobs_workspace
  ON public.persona_face_embedding_backfill_jobs (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_face_emb_backfill_jobs_status
  ON public.persona_face_embedding_backfill_jobs (workspace_id, status);

-- ---------------------------------------------------------------------------
-- persona_face_embedding_backfill_results
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.persona_face_embedding_backfill_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.persona_face_embedding_backfill_jobs(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.brain_workspaces(id) ON DELETE CASCADE,
  novelty_record_id UUID NOT NULL,
  candidate_id UUID,
  asset_id UUID,
  result_status TEXT NOT NULL,
  safe_error_code TEXT,
  safe_error_message TEXT,
  duration_ms INTEGER,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'persona_face_embedding_backfill_results_status_check'
  ) THEN
    ALTER TABLE public.persona_face_embedding_backfill_results
      ADD CONSTRAINT persona_face_embedding_backfill_results_status_check
      CHECK (result_status IN (
        'embedded',
        'already_embedded',
        'no_face',
        'multiple_faces',
        'low_confidence',
        'too_small',
        'missing_asset',
        'asset_load_failed',
        'evaluator_error',
        'skipped'
      ));
  END IF;
END $$;

-- One result row per novelty record per job (resume / idempotent progress).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'persona_face_embedding_backfill_results_job_novelty_unique'
  ) THEN
    ALTER TABLE public.persona_face_embedding_backfill_results
      ADD CONSTRAINT persona_face_embedding_backfill_results_job_novelty_unique
      UNIQUE (job_id, novelty_record_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_face_emb_backfill_results_job
  ON public.persona_face_embedding_backfill_results (job_id, result_status);

CREATE INDEX IF NOT EXISTS idx_face_emb_backfill_results_workspace
  ON public.persona_face_embedding_backfill_results (workspace_id, processed_at DESC);

-- ---------------------------------------------------------------------------
-- RLS — workspace isolation (service-role writes; authenticated read own WS)
-- ---------------------------------------------------------------------------

ALTER TABLE public.persona_face_embedding_backfill_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persona_face_embedding_backfill_results ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'persona_face_embedding_backfill_jobs'
      AND policyname = 'face_emb_backfill_jobs_workspace_read'
  ) THEN
    CREATE POLICY face_emb_backfill_jobs_workspace_read
      ON public.persona_face_embedding_backfill_jobs
      FOR SELECT
      USING (
        workspace_id IN (
          SELECT id FROM public.brain_workspaces
          WHERE id = workspace_id
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'persona_face_embedding_backfill_results'
      AND policyname = 'face_emb_backfill_results_workspace_read'
  ) THEN
    CREATE POLICY face_emb_backfill_results_workspace_read
      ON public.persona_face_embedding_backfill_results
      FOR SELECT
      USING (
        workspace_id IN (
          SELECT id FROM public.brain_workspaces
          WHERE id = workspace_id
        )
      );
  END IF;
END $$;

COMMENT ON TABLE public.persona_face_embedding_backfill_jobs IS
  'Phase 2.0C — Historical face embedding backfill jobs. '
  'Workspace-scoped. Never stores image bytes or embedding vectors. '
  'Development-oriented; paid providers are never called.';

COMMENT ON TABLE public.persona_face_embedding_backfill_results IS
  'Phase 2.0C — Per-record backfill outcomes. '
  'Stores result status and safe error fields only — never embeddings or image bytes.';
