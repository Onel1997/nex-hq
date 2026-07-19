-- Persona Studio Phase 1.2 — Persona Creator & Brand Cast candidate workflow.
-- Additive after 20260719140000_persona_studio_phase_1_1.sql (do not rewrite).

-- ---------------------------------------------------------------------------
-- Identity lock + lineage columns on personas
-- ---------------------------------------------------------------------------

ALTER TABLE public.persona_personas
  ADD COLUMN IF NOT EXISTS source_creation_project_id UUID,
  ADD COLUMN IF NOT EXISTS source_candidate_id UUID,
  ADD COLUMN IF NOT EXISTS identity_lock_status TEXT NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS canonical_identity_description TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS immutable_features TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS flexible_features TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS approved_hair_variations TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS approved_expression_range TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS approved_body_proportions TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS approved_age_range TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS default_styling TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS image_identity_ready BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS video_identity_ready BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS intended_usage TEXT NOT NULL DEFAULT 'image_and_video';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'persona_personas_identity_lock_status_check'
  ) THEN
    ALTER TABLE public.persona_personas
      ADD CONSTRAINT persona_personas_identity_lock_status_check
      CHECK (identity_lock_status IN (
        'not_started', 'collecting_references', 'review', 'approved',
        'needs_revision', 'archived'
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'persona_personas_intended_usage_check'
  ) THEN
    ALTER TABLE public.persona_personas
      ADD CONSTRAINT persona_personas_intended_usage_check
      CHECK (intended_usage IN ('image', 'video', 'image_and_video'));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Creation projects
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.persona_creation_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.brain_workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  gender_presentation TEXT NOT NULL DEFAULT '',
  age_range TEXT NOT NULL DEFAULT '',
  height_range TEXT NOT NULL DEFAULT '',
  body_type TEXT NOT NULL DEFAULT '',
  skin_tone_direction TEXT NOT NULL DEFAULT '',
  face_shape_direction TEXT NOT NULL DEFAULT '',
  hair_direction TEXT NOT NULL DEFAULT '',
  facial_hair_direction TEXT NOT NULL DEFAULT '',
  eye_direction TEXT NOT NULL DEFAULT '',
  expression_direction TEXT NOT NULL DEFAULT '',
  personality TEXT NOT NULL DEFAULT '',
  fashion_style TEXT NOT NULL DEFAULT '',
  brand_role TEXT NOT NULL DEFAULT 'primary_male'
    CHECK (brand_role IN (
      'primary_male', 'secondary_male', 'primary_female',
      'secondary_female', 'unisex_editorial', 'campaign_specialist'
    )),
  visual_keywords TEXT NOT NULL DEFAULT '',
  excluded_features TEXT NOT NULL DEFAULT '',
  preferred_brand_looks TEXT NOT NULL DEFAULT '',
  preferred_outfits TEXT NOT NULL DEFAULT '',
  intended_usage TEXT NOT NULL DEFAULT 'image_and_video'
    CHECK (intended_usage IN ('image', 'video', 'image_and_video')),
  candidate_count INTEGER NOT NULL DEFAULT 4
    CHECK (candidate_count >= 1 AND candidate_count <= 8),
  provider_mode TEXT NOT NULL DEFAULT 'disabled'
    CHECK (provider_mode IN ('disabled', 'manual_upload', 'image_provider', 'hybrid')),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft', 'ready', 'generating', 'review', 'selected',
      'cancelled', 'failed', 'archived'
    )),
  generation_stage TEXT NOT NULL DEFAULT 'discovery'
    CHECK (generation_stage IN ('discovery', 'shortlist_validation', 'identity_lock')),
  estimated_cost_min NUMERIC(12, 4) NOT NULL DEFAULT 0,
  estimated_cost_max NUMERIC(12, 4) NOT NULL DEFAULT 0,
  actual_cost NUMERIC(12, 4) NOT NULL DEFAULT 0,
  cost_confirmed_at TIMESTAMPTZ,
  additional_description TEXT NOT NULL DEFAULT '',
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_persona_creation_projects_workspace
  ON public.persona_creation_projects (workspace_id);

CREATE INDEX IF NOT EXISTS idx_persona_creation_projects_status
  ON public.persona_creation_projects (workspace_id, status);

CREATE INDEX IF NOT EXISTS idx_persona_creation_projects_created
  ON public.persona_creation_projects (workspace_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Candidates
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.persona_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.brain_workspaces(id) ON DELETE CASCADE,
  creation_project_id UUID NOT NULL
    REFERENCES public.persona_creation_projects(id) ON DELETE CASCADE,
  candidate_number INTEGER NOT NULL DEFAULT 1,
  candidate_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN (
      'queued', 'generating', 'ready', 'shortlisted', 'selected',
      'rejected', 'failed', 'archived'
    )),
  provider TEXT NOT NULL DEFAULT 'none',
  provider_job_id TEXT,
  generation_seed TEXT,
  generation_prompt TEXT NOT NULL DEFAULT '',
  negative_prompt TEXT NOT NULL DEFAULT '',
  generation_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  primary_preview_asset_id UUID,
  identity_summary TEXT NOT NULL DEFAULT '',
  distinguishing_features TEXT NOT NULL DEFAULT '',
  visual_strengths TEXT NOT NULL DEFAULT '',
  visual_risks TEXT NOT NULL DEFAULT '',
  brand_fit_score NUMERIC(5, 2),
  identity_consistency_score NUMERIC(5, 2),
  realism_score NUMERIC(5, 2),
  video_suitability_score NUMERIC(5, 2),
  user_rating INTEGER CHECK (user_rating IS NULL OR (user_rating >= 1 AND user_rating <= 5)),
  user_notes TEXT NOT NULL DEFAULT '',
  rejection_reason TEXT NOT NULL DEFAULT '',
  selected_at TIMESTAMPTZ,
  converted_persona_id UUID REFERENCES public.persona_personas(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (creation_project_id, candidate_number)
);

CREATE INDEX IF NOT EXISTS idx_persona_candidates_workspace
  ON public.persona_candidates (workspace_id);

CREATE INDEX IF NOT EXISTS idx_persona_candidates_project
  ON public.persona_candidates (creation_project_id);

CREATE INDEX IF NOT EXISTS idx_persona_candidates_status
  ON public.persona_candidates (workspace_id, status);

-- At most one selected candidate per creation project
CREATE UNIQUE INDEX IF NOT EXISTS idx_persona_candidates_one_selected_per_project
  ON public.persona_candidates (creation_project_id)
  WHERE status = 'selected';

-- A candidate may convert to at most one persona
CREATE UNIQUE INDEX IF NOT EXISTS idx_persona_candidates_converted_once
  ON public.persona_candidates (id)
  WHERE converted_persona_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_persona_personas_source_candidate_unique
  ON public.persona_personas (source_candidate_id)
  WHERE source_candidate_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Candidate assets
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.persona_candidate_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.brain_workspaces(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL
    REFERENCES public.persona_candidates(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL
    CHECK (asset_type IN (
      'portrait_front', 'portrait_three_quarter', 'portrait_profile',
      'half_body', 'full_body', 'expression_variant', 'outfit_variant',
      'test_contact_sheet'
    )),
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  file_size_bytes BIGINT NOT NULL DEFAULT 0,
  checksum TEXT NOT NULL DEFAULT '',
  provider_output_id TEXT,
  generation_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'uploaded'
    CHECK (status IN ('uploaded', 'ready', 'rejected', 'archived', 'pending_cleanup')),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  retention_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_persona_candidate_assets_workspace
  ON public.persona_candidate_assets (workspace_id);

CREATE INDEX IF NOT EXISTS idx_persona_candidate_assets_candidate
  ON public.persona_candidate_assets (candidate_id);

CREATE INDEX IF NOT EXISTS idx_persona_candidate_assets_status
  ON public.persona_candidate_assets (workspace_id, status);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'persona_candidates_primary_preview_fkey'
  ) THEN
    ALTER TABLE public.persona_candidates
      ADD CONSTRAINT persona_candidates_primary_preview_fkey
      FOREIGN KEY (primary_preview_asset_id)
      REFERENCES public.persona_candidate_assets(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'persona_personas_source_project_fkey'
  ) THEN
    ALTER TABLE public.persona_personas
      ADD CONSTRAINT persona_personas_source_project_fkey
      FOREIGN KEY (source_creation_project_id)
      REFERENCES public.persona_creation_projects(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'persona_personas_source_candidate_fkey'
  ) THEN
    ALTER TABLE public.persona_personas
      ADD CONSTRAINT persona_personas_source_candidate_fkey
      FOREIGN KEY (source_candidate_id)
      REFERENCES public.persona_candidates(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Identity consistency reviews (manual checklist V1)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.persona_identity_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.brain_workspaces(id) ON DELETE CASCADE,
  persona_id UUID NOT NULL REFERENCES public.persona_personas(id) ON DELETE CASCADE,
  checklist JSONB NOT NULL DEFAULT '{}'::jsonb,
  all_passed BOOLEAN NOT NULL DEFAULT false,
  reviewer_notes TEXT NOT NULL DEFAULT '',
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_persona_identity_reviews_persona
  ON public.persona_identity_reviews (persona_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_persona_identity_reviews_workspace
  ON public.persona_identity_reviews (workspace_id);

-- ---------------------------------------------------------------------------
-- Brand Cast milestone requirements (configurable per workspace)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.persona_brand_cast_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.brain_workspaces(id) ON DELETE CASCADE,
  required_male_approved INTEGER NOT NULL DEFAULT 2 CHECK (required_male_approved >= 0),
  required_female_approved INTEGER NOT NULL DEFAULT 1 CHECK (required_female_approved >= 0),
  milestone_label TEXT NOT NULL DEFAULT 'BRAND CAST APPROVED',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id)
);

CREATE INDEX IF NOT EXISTS idx_persona_brand_cast_requirements_workspace
  ON public.persona_brand_cast_requirements (workspace_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
    DROP TRIGGER IF EXISTS persona_creation_projects_set_updated_at
      ON public.persona_creation_projects;
    CREATE TRIGGER persona_creation_projects_set_updated_at
      BEFORE UPDATE ON public.persona_creation_projects
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

    DROP TRIGGER IF EXISTS persona_candidates_set_updated_at
      ON public.persona_candidates;
    CREATE TRIGGER persona_candidates_set_updated_at
      BEFORE UPDATE ON public.persona_candidates
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

    DROP TRIGGER IF EXISTS persona_candidate_assets_set_updated_at
      ON public.persona_candidate_assets;
    CREATE TRIGGER persona_candidate_assets_set_updated_at
      BEFORE UPDATE ON public.persona_candidate_assets
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

    DROP TRIGGER IF EXISTS persona_identity_reviews_set_updated_at
      ON public.persona_identity_reviews;
    CREATE TRIGGER persona_identity_reviews_set_updated_at
      BEFORE UPDATE ON public.persona_identity_reviews
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

    DROP TRIGGER IF EXISTS persona_brand_cast_requirements_set_updated_at
      ON public.persona_brand_cast_requirements;
    CREATE TRIGGER persona_brand_cast_requirements_set_updated_at
      BEFORE UPDATE ON public.persona_brand_cast_requirements
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- RLS — same app-layer workspace scoping pattern as Phase 1.1
-- ---------------------------------------------------------------------------

ALTER TABLE public.persona_creation_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persona_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persona_candidate_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persona_identity_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persona_brand_cast_requirements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "persona_creation_projects_all" ON public.persona_creation_projects;
CREATE POLICY "persona_creation_projects_all" ON public.persona_creation_projects
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "persona_candidates_all" ON public.persona_candidates;
CREATE POLICY "persona_candidates_all" ON public.persona_candidates
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "persona_candidate_assets_all" ON public.persona_candidate_assets;
CREATE POLICY "persona_candidate_assets_all" ON public.persona_candidate_assets
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "persona_identity_reviews_all" ON public.persona_identity_reviews;
CREATE POLICY "persona_identity_reviews_all" ON public.persona_identity_reviews
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "persona_brand_cast_requirements_all"
  ON public.persona_brand_cast_requirements;
CREATE POLICY "persona_brand_cast_requirements_all"
  ON public.persona_brand_cast_requirements
  FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE public.persona_creation_projects IS
  'Persona Creator sessions for discovering Brand Cast candidates. Not Image Studio.';
COMMENT ON TABLE public.persona_candidates IS
  'Candidate model identities under review. Selection creates draft Persona only.';
COMMENT ON TABLE public.persona_candidate_assets IS
  'Private candidate preview assets in persona-references bucket. Signed URLs only.';
COMMENT ON TABLE public.persona_identity_reviews IS
  'Manual identity consistency checklist before Brand Cast approval.';
COMMENT ON TABLE public.persona_brand_cast_requirements IS
  'Configurable Brand Cast milestone requirements per workspace.';
