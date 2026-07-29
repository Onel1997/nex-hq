-- Persona Studio Phase 2.0A — Face Novelty Memory.
-- Workspace-scoped, archetype-aware discovery identity lifecycle.
-- Prevents shown/rejected/exhausted faces from re-entering new discovery runs.

-- ---------------------------------------------------------------------------
-- persona_face_novelty_records
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.persona_face_novelty_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.brain_workspaces(id) ON DELETE CASCADE,
  archetype_id TEXT NOT NULL DEFAULT '',
  creation_project_id UUID NOT NULL REFERENCES public.persona_creation_projects(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL,
  asset_id UUID NOT NULL,
  state TEXT NOT NULL DEFAULT 'generated',
  identity_fingerprint TEXT NOT NULL DEFAULT '',
  visual_fingerprint TEXT,
  perceptual_hash TEXT,
  storage_object_key TEXT,
  image_checksum TEXT,
  embedding_version TEXT,
  source_provider TEXT NOT NULL DEFAULT '',
  source_model TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  first_shown_at TIMESTAMPTZ,
  exhausted_at TIMESTAMPTZ,
  saved_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  shortlisted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ
);

-- State constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'persona_face_novelty_records_state_check'
  ) THEN
    ALTER TABLE public.persona_face_novelty_records
      ADD CONSTRAINT persona_face_novelty_records_state_check
      CHECK (state IN (
        'generated', 'shown', 'shortlisted', 'saved',
        'rejected', 'exhausted', 'approved'
      ));
  END IF;
END $$;

-- Unique candidate per workspace (one record per candidate_id+workspace_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'persona_face_novelty_records_workspace_candidate_unique'
  ) THEN
    ALTER TABLE public.persona_face_novelty_records
      ADD CONSTRAINT persona_face_novelty_records_workspace_candidate_unique
      UNIQUE (workspace_id, candidate_id);
  END IF;
END $$;

-- Indexes for forbidden-set lookups
CREATE INDEX IF NOT EXISTS idx_fnr_workspace_archetype
  ON public.persona_face_novelty_records (workspace_id, archetype_id);

CREATE INDEX IF NOT EXISTS idx_fnr_workspace_state
  ON public.persona_face_novelty_records (workspace_id, state);

CREATE INDEX IF NOT EXISTS idx_fnr_image_checksum
  ON public.persona_face_novelty_records (workspace_id, image_checksum)
  WHERE image_checksum IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fnr_storage_object_key
  ON public.persona_face_novelty_records (workspace_id, storage_object_key)
  WHERE storage_object_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fnr_identity_fingerprint
  ON public.persona_face_novelty_records (workspace_id, identity_fingerprint);

-- ---------------------------------------------------------------------------
-- RLS — workspace isolation
-- ---------------------------------------------------------------------------

ALTER TABLE public.persona_face_novelty_records ENABLE ROW LEVEL SECURITY;

-- Users can only read their own workspace's records.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'persona_face_novelty_records'
      AND policyname = 'novelty_records_workspace_read'
  ) THEN
    CREATE POLICY novelty_records_workspace_read
      ON public.persona_face_novelty_records
      FOR SELECT
      USING (
        workspace_id IN (
          SELECT id FROM public.brain_workspaces
          WHERE id = workspace_id
        )
      );
  END IF;
END $$;

-- Service role (admin client) may write; direct client writes are blocked.
-- Application layer must always pass workspace_id from a server-side resolved scope,
-- never from client input.
COMMENT ON TABLE public.persona_face_novelty_records IS
  'Phase 2.0A — Face Novelty Memory. '
  'Records the lifecycle state of every generated discovery candidate. '
  'Workspace-scoped; exhausted identities are permanently excluded from new discovery runs. '
  'Exact/near-identical image reuse is detected via checksum + perceptual hash. '
  'Biologically similar newly generated faces require a real face-similarity evaluator.';
