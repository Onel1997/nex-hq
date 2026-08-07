-- Phase 2.2A — Provider-agnostic Brand Face Discovery attempts + cost ledger.
-- Additive only: preserves existing OpenAI projects and novelty history.

CREATE TABLE IF NOT EXISTS public.persona_discovery_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.brain_workspaces(id) ON DELETE CASCADE,
  creation_project_id UUID NOT NULL REFERENCES public.persona_creation_projects(id) ON DELETE CASCADE,
  generation_run_id UUID NOT NULL,
  slot TEXT NOT NULL CHECK (slot IN ('A', 'B', 'C', 'D')),
  attempt_number INTEGER NOT NULL CHECK (attempt_number >= 1),
  candidate_id UUID,
  replaced_candidate_id UUID,
  provider TEXT NOT NULL,
  provider_model TEXT NOT NULL DEFAULT '',
  provider_seed BIGINT NOT NULL,
  provider_request_id TEXT,
  provider_result_id TEXT,
  identity_fingerprint TEXT NOT NULL DEFAULT '',
  anatomy_fingerprint TEXT NOT NULL DEFAULT '',
  prompt_fingerprint TEXT NOT NULL DEFAULT '',
  sampling_seed TEXT NOT NULL DEFAULT '',
  diversity_region TEXT NOT NULL DEFAULT '',
  asset_id UUID,
  novelty_decision TEXT,
  highest_similarity DOUBLE PRECISION,
  matched_candidate_id UUID,
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN (
      'planned',
      'generating',
      'evaluating',
      'allowed',
      'blocked',
      'failed',
      'superseded',
      'timeout'
    )),
  provider_started_at TIMESTAMPTZ,
  provider_completed_at TIMESTAMPTZ,
  error_code TEXT,
  error_message TEXT,
  estimated_cost_eur DOUBLE PRECISION,
  actual_cost_eur DOUBLE PRECISION,
  cost_status TEXT NOT NULL DEFAULT 'estimated'
    CHECK (cost_status IN ('estimated', 'provider_confirmed', 'unknown', 'allocated_estimate')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (creation_project_id, generation_run_id, slot, attempt_number)
);

CREATE INDEX IF NOT EXISTS idx_pda_workspace_project
  ON public.persona_discovery_attempts (workspace_id, creation_project_id);

CREATE INDEX IF NOT EXISTS idx_pda_run_slot
  ON public.persona_discovery_attempts (generation_run_id, slot);

CREATE INDEX IF NOT EXISTS idx_pda_candidate
  ON public.persona_discovery_attempts (candidate_id)
  WHERE candidate_id IS NOT NULL;

ALTER TABLE public.persona_discovery_attempts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'persona_discovery_attempts'
      AND policyname = 'persona_discovery_attempts_workspace_isolation'
  ) THEN
    CREATE POLICY persona_discovery_attempts_workspace_isolation
      ON public.persona_discovery_attempts
      FOR ALL
      USING (
        workspace_id IN (
          SELECT id FROM public.brain_workspaces
          WHERE owner_user_id = auth.uid()
             OR id IN (
               SELECT workspace_id FROM public.brain_workspace_members
               WHERE user_id = auth.uid()
             )
        )
      )
      WITH CHECK (
        workspace_id IN (
          SELECT id FROM public.brain_workspaces
          WHERE owner_user_id = auth.uid()
             OR id IN (
               SELECT workspace_id FROM public.brain_workspace_members
               WHERE user_id = auth.uid()
             )
        )
      );
  END IF;
END $$;

COMMENT ON TABLE public.persona_discovery_attempts IS
  'Phase 2.2A discovery attempt audit trail — blocked attempts are retained, never deleted.';

-- Discovery run completion ledger (budget + run state), additive on generation jobs.
ALTER TABLE public.persona_generation_jobs
  ADD COLUMN IF NOT EXISTS discovery_run_state TEXT,
  ADD COLUMN IF NOT EXISTS discovery_provider TEXT,
  ADD COLUMN IF NOT EXISTS discovery_provider_model TEXT,
  ADD COLUMN IF NOT EXISTS estimated_initial_cost_eur DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS authorized_max_cost_eur DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS actual_provider_cost_eur DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS max_attempts_per_slot INTEGER,
  ADD COLUMN IF NOT EXISTS attempts_used INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS remaining_authorized_attempts INTEGER,
  ADD COLUMN IF NOT EXISTS discovery_cost_status TEXT DEFAULT 'estimated';

COMMENT ON COLUMN public.persona_generation_jobs.discovery_run_state IS
  'Phase 2.2A: preparing|generating|evaluating|resolving_duplicates|ready|ready_partial|failed';
