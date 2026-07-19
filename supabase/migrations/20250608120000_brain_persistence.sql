-- NexHQ Brain — Phase 1 persistence layer
-- brain_workspaces, brain_records, brain_embeddings (placeholder), brain_events

-- ---------------------------------------------------------------------------
-- brain_workspaces
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.brain_workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  industry_id TEXT NOT NULL,
  active_modules JSONB NOT NULL DEFAULT '[]'::jsonb,
  enabled_domains JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- brain_records
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.brain_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.brain_workspaces(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  content JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  tags TEXT[] NOT NULL DEFAULT '{}',
  provenance JSONB NOT NULL,
  relations JSONB NOT NULL DEFAULT '[]'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  schema_version TEXT NOT NULL DEFAULT '1.1.0',
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT brain_records_workspace_domain_slug_unique UNIQUE (workspace_id, domain, slug),
  CONSTRAINT brain_records_status_check CHECK (
    status IN ('draft', 'pending_review', 'approved', 'archived', 'superseded')
  )
);

CREATE INDEX IF NOT EXISTS idx_brain_records_workspace_domain
  ON public.brain_records (workspace_id, domain);

CREATE INDEX IF NOT EXISTS idx_brain_records_workspace_status
  ON public.brain_records (workspace_id, status);

CREATE INDEX IF NOT EXISTS idx_brain_records_tags
  ON public.brain_records USING GIN (tags);

-- ---------------------------------------------------------------------------
-- brain_embeddings (structure only — vector search deferred)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.brain_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.brain_workspaces(id) ON DELETE CASCADE,
  record_id UUID NOT NULL REFERENCES public.brain_records(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  embedding JSONB,
  model TEXT NOT NULL,
  dimensions INTEGER NOT NULL,
  chunk_index INTEGER,
  chunk_text TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brain_embeddings_record_id
  ON public.brain_embeddings (record_id);

CREATE INDEX IF NOT EXISTS idx_brain_embeddings_workspace_domain
  ON public.brain_embeddings (workspace_id, domain);

-- ---------------------------------------------------------------------------
-- brain_events (audit trail)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.brain_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.brain_workspaces(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  domain TEXT,
  record_id UUID,
  actor_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brain_events_workspace_created
  ON public.brain_events (workspace_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS brain_workspaces_updated_at ON public.brain_workspaces;
CREATE TRIGGER brain_workspaces_updated_at
  BEFORE UPDATE ON public.brain_workspaces
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS brain_records_updated_at ON public.brain_records;
CREATE TRIGGER brain_records_updated_at
  BEFORE UPDATE ON public.brain_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE public.brain_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brain_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brain_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brain_events ENABLE ROW LEVEL SECURITY;

-- Development-friendly policies (service role bypasses RLS server-side)
DROP POLICY IF EXISTS "brain_workspaces_select" ON public.brain_workspaces;
CREATE POLICY "brain_workspaces_select" ON public.brain_workspaces
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "brain_workspaces_insert" ON public.brain_workspaces;
CREATE POLICY "brain_workspaces_insert" ON public.brain_workspaces
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "brain_workspaces_update" ON public.brain_workspaces;
CREATE POLICY "brain_workspaces_update" ON public.brain_workspaces
  FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "brain_records_select" ON public.brain_records;
CREATE POLICY "brain_records_select" ON public.brain_records
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "brain_records_insert" ON public.brain_records;
CREATE POLICY "brain_records_insert" ON public.brain_records
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "brain_records_update" ON public.brain_records;
CREATE POLICY "brain_records_update" ON public.brain_records
  FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "brain_embeddings_select" ON public.brain_embeddings;
CREATE POLICY "brain_embeddings_select" ON public.brain_embeddings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "brain_embeddings_insert" ON public.brain_embeddings;
CREATE POLICY "brain_embeddings_insert" ON public.brain_embeddings
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "brain_events_select" ON public.brain_events;
CREATE POLICY "brain_events_select" ON public.brain_events
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "brain_events_insert" ON public.brain_events;
CREATE POLICY "brain_events_insert" ON public.brain_events
  FOR INSERT WITH CHECK (true);
