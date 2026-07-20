-- Persona Studio Phase 1.5 — durable generation jobs, quality modes, paid confirmation.
-- Additive after 20260719220000_persona_studio_phase_1_2_candidate_workflow.sql.

-- ---------------------------------------------------------------------------
-- Quality mode + confirmation columns on creation projects
-- ---------------------------------------------------------------------------

ALTER TABLE public.persona_creation_projects
  ADD COLUMN IF NOT EXISTS quality_mode TEXT NOT NULL DEFAULT 'premium_editorial',
  ADD COLUMN IF NOT EXISTS last_estimate_hash TEXT,
  ADD COLUMN IF NOT EXISTS last_estimate_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_confirmation_token TEXT,
  ADD COLUMN IF NOT EXISTS last_confirmation_payload JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'persona_creation_projects_quality_mode_check'
  ) THEN
    ALTER TABLE public.persona_creation_projects
      ADD CONSTRAINT persona_creation_projects_quality_mode_check
      CHECK (quality_mode IN ('draft_discovery', 'premium_editorial', 'ultra_brand_cast'));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Candidate workflow statuses for identity validation / manual references
-- ---------------------------------------------------------------------------

ALTER TABLE public.persona_candidates
  DROP CONSTRAINT IF EXISTS persona_candidates_status_check;

ALTER TABLE public.persona_candidates
  ADD CONSTRAINT persona_candidates_status_check
  CHECK (status IN (
    'queued', 'generating', 'ready', 'shortlisted', 'selected', 'rejected',
    'failed', 'archived', 'needs_manual_references', 'identity_validation_failed'
  ));

ALTER TABLE public.persona_candidates
  ADD COLUMN IF NOT EXISTS fashion_fit_review TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS body_proportion_review TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS hand_anatomy_review TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS face_consistency_review TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS realism_review TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS image_suitability_label TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS video_suitability_label TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS parent_candidate_id UUID
    REFERENCES public.persona_candidates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS variation_of_asset_id UUID
    REFERENCES public.persona_candidate_assets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS actual_generation_cost NUMERIC(12, 4) NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------------------
-- Durable generation jobs (survive restart / refresh / new instances)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.persona_generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.brain_workspaces(id) ON DELETE CASCADE,
  creation_project_id UUID NOT NULL
    REFERENCES public.persona_creation_projects(id) ON DELETE CASCADE,
  candidate_id UUID REFERENCES public.persona_candidates(id) ON DELETE SET NULL,
  stage TEXT NOT NULL DEFAULT 'discovery'
    CHECK (stage IN ('discovery', 'shortlist_validation', 'identity_lock')),
  provider TEXT NOT NULL DEFAULT '',
  provider_job_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending_confirmation'
    CHECK (status IN (
      'pending_confirmation', 'queued', 'generating', 'partially_completed',
      'completed', 'failed', 'cancelled'
    )),
  requested_asset_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  quality_mode TEXT NOT NULL DEFAULT 'premium_editorial'
    CHECK (quality_mode IN ('draft_discovery', 'premium_editorial', 'ultra_brand_cast')),
  estimated_cost_min NUMERIC(12, 4) NOT NULL DEFAULT 0,
  estimated_cost_max NUMERIC(12, 4) NOT NULL DEFAULT 0,
  actual_cost NUMERIC(12, 4) NOT NULL DEFAULT 0,
  cost_is_estimated BOOLEAN NOT NULL DEFAULT true,
  confirmation_token TEXT,
  estimate_hash TEXT,
  confirmation_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  confirmed_at TIMESTAMPTZ,
  retry_count INTEGER NOT NULL DEFAULT 0,
  error_code TEXT,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_persona_generation_jobs_workspace
  ON public.persona_generation_jobs (workspace_id);

CREATE INDEX IF NOT EXISTS idx_persona_generation_jobs_project
  ON public.persona_generation_jobs (creation_project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_persona_generation_jobs_status
  ON public.persona_generation_jobs (workspace_id, status);

ALTER TABLE public.persona_generation_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS persona_generation_jobs_service_all ON public.persona_generation_jobs;
CREATE POLICY persona_generation_jobs_service_all
  ON public.persona_generation_jobs
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Paid confirmation ledger (stale estimate / changed params require new confirm)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.persona_generation_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.brain_workspaces(id) ON DELETE CASCADE,
  creation_project_id UUID NOT NULL
    REFERENCES public.persona_creation_projects(id) ON DELETE CASCADE,
  generation_job_id UUID REFERENCES public.persona_generation_jobs(id) ON DELETE SET NULL,
  confirmation_token TEXT NOT NULL UNIQUE,
  estimate_hash TEXT NOT NULL,
  stage TEXT NOT NULL,
  quality_mode TEXT NOT NULL,
  candidate_count INTEGER NOT NULL,
  asset_count INTEGER NOT NULL,
  estimated_cost_min NUMERIC(12, 4) NOT NULL,
  estimated_cost_max NUMERIC(12, 4) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  consumed_at TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_persona_generation_confirmations_project
  ON public.persona_generation_confirmations (creation_project_id, created_at DESC);

ALTER TABLE public.persona_generation_confirmations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS persona_generation_confirmations_service_all
  ON public.persona_generation_confirmations;
CREATE POLICY persona_generation_confirmations_service_all
  ON public.persona_generation_confirmations
  FOR ALL
  USING (true)
  WITH CHECK (true);
