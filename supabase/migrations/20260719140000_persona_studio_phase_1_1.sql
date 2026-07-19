-- Persona Studio Phase 1.1 — persistence hardening, identity fields,
-- reference library, private storage, RLS, indexes.
-- Additive follow-up after 20250719120000_persona_studio.sql (do not rewrite).

-- ---------------------------------------------------------------------------
-- Identity + ownership columns on personas
-- ---------------------------------------------------------------------------

ALTER TABLE public.persona_personas
  ADD COLUMN IF NOT EXISTS created_by TEXT,
  ADD COLUMN IF NOT EXISTS identity_lock_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS image_use_approved BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS video_use_approved BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS primary_reference_asset_id UUID,
  ADD COLUMN IF NOT EXISTS visual_identity_notes TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS distinguishing_features TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS prohibited_changes TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS default_hair_style TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS default_facial_hair TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS default_expression TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS default_body_proportions TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS default_styling_notes TEXT NOT NULL DEFAULT '';

ALTER TABLE public.persona_locations
  ADD COLUMN IF NOT EXISTS created_by TEXT;

ALTER TABLE public.persona_camera_presets
  ADD COLUMN IF NOT EXISTS created_by TEXT;

ALTER TABLE public.persona_poses
  ADD COLUMN IF NOT EXISTS created_by TEXT;

ALTER TABLE public.persona_brand_looks
  ADD COLUMN IF NOT EXISTS created_by TEXT;

ALTER TABLE public.persona_outfits
  ADD COLUMN IF NOT EXISTS created_by TEXT;

-- ---------------------------------------------------------------------------
-- Reference asset library
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.persona_reference_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.brain_workspaces(id) ON DELETE CASCADE,
  persona_id UUID NOT NULL REFERENCES public.persona_personas(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL
    CHECK (asset_type IN (
      'portrait', 'profile', 'full_body', 'three_quarter', 'video_reference', 'other'
    )),
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  file_size_bytes BIGINT NOT NULL DEFAULT 0,
  checksum TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'uploaded'
    CHECK (status IN ('uploaded', 'review', 'approved', 'rejected', 'archived')),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  view_angle TEXT NOT NULL DEFAULT 'unknown'
    CHECK (view_angle IN (
      'front', 'left_profile', 'right_profile', 'back',
      'three_quarter_left', 'three_quarter_right', 'unknown'
    )),
  framing TEXT NOT NULL DEFAULT 'unknown'
    CHECK (framing IN ('face', 'head_shoulders', 'half_body', 'full_body', 'unknown')),
  expression TEXT NOT NULL DEFAULT '',
  body_visibility TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  source_type TEXT NOT NULL DEFAULT 'user_upload'
    CHECK (source_type IN (
      'user_upload', 'generated_external', 'photoshoot', 'licensed_asset', 'other'
    )),
  rights_confirmed BOOLEAN NOT NULL DEFAULT false,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_persona_reference_assets_checksum
  ON public.persona_reference_assets (workspace_id, persona_id, checksum)
  WHERE checksum <> '';

CREATE INDEX IF NOT EXISTS idx_persona_reference_assets_workspace
  ON public.persona_reference_assets (workspace_id);

CREATE INDEX IF NOT EXISTS idx_persona_reference_assets_persona
  ON public.persona_reference_assets (persona_id);

CREATE INDEX IF NOT EXISTS idx_persona_reference_assets_status
  ON public.persona_reference_assets (workspace_id, status);

CREATE INDEX IF NOT EXISTS idx_persona_reference_assets_created
  ON public.persona_reference_assets (workspace_id, created_at DESC);

-- FK for primary reference (added after table exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'persona_personas_primary_reference_fkey'
  ) THEN
    ALTER TABLE public.persona_personas
      ADD CONSTRAINT persona_personas_primary_reference_fkey
      FOREIGN KEY (primary_reference_asset_id)
      REFERENCES public.persona_reference_assets(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Indexes for libraries / readiness filters
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_persona_personas_workspace_created
  ON public.persona_personas (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_persona_personas_image_ready
  ON public.persona_personas (workspace_id, status, image_use_approved, approved);

CREATE INDEX IF NOT EXISTS idx_persona_personas_video_ready
  ON public.persona_personas (workspace_id, status, video_use_approved, approved);

CREATE INDEX IF NOT EXISTS idx_persona_locations_workspace_created
  ON public.persona_locations (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_persona_camera_presets_workspace
  ON public.persona_camera_presets (workspace_id);

CREATE INDEX IF NOT EXISTS idx_persona_poses_workspace_active
  ON public.persona_poses (workspace_id, active);

CREATE INDEX IF NOT EXISTS idx_persona_brand_looks_workspace
  ON public.persona_brand_looks (workspace_id);

CREATE INDEX IF NOT EXISTS idx_persona_outfits_workspace_active
  ON public.persona_outfits (workspace_id, active);

CREATE INDEX IF NOT EXISTS idx_persona_persona_locations_location
  ON public.persona_persona_locations (location_id);

CREATE INDEX IF NOT EXISTS idx_persona_persona_camera_presets_camera
  ON public.persona_persona_camera_presets (camera_preset_id);

CREATE INDEX IF NOT EXISTS idx_persona_persona_poses_pose
  ON public.persona_persona_poses (pose_id);

CREATE INDEX IF NOT EXISTS idx_persona_persona_brand_looks_look
  ON public.persona_persona_brand_looks (brand_look_id);

CREATE INDEX IF NOT EXISTS idx_persona_persona_outfits_outfit
  ON public.persona_persona_outfits (outfit_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers (reuse Brain helper when present)
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at'
  ) THEN
    DROP TRIGGER IF EXISTS persona_personas_set_updated_at ON public.persona_personas;
    CREATE TRIGGER persona_personas_set_updated_at
      BEFORE UPDATE ON public.persona_personas
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

    DROP TRIGGER IF EXISTS persona_locations_set_updated_at ON public.persona_locations;
    CREATE TRIGGER persona_locations_set_updated_at
      BEFORE UPDATE ON public.persona_locations
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

    DROP TRIGGER IF EXISTS persona_camera_presets_set_updated_at ON public.persona_camera_presets;
    CREATE TRIGGER persona_camera_presets_set_updated_at
      BEFORE UPDATE ON public.persona_camera_presets
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

    DROP TRIGGER IF EXISTS persona_poses_set_updated_at ON public.persona_poses;
    CREATE TRIGGER persona_poses_set_updated_at
      BEFORE UPDATE ON public.persona_poses
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

    DROP TRIGGER IF EXISTS persona_brand_looks_set_updated_at ON public.persona_brand_looks;
    CREATE TRIGGER persona_brand_looks_set_updated_at
      BEFORE UPDATE ON public.persona_brand_looks
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

    DROP TRIGGER IF EXISTS persona_outfits_set_updated_at ON public.persona_outfits;
    CREATE TRIGGER persona_outfits_set_updated_at
      BEFORE UPDATE ON public.persona_outfits
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

    DROP TRIGGER IF EXISTS persona_reference_assets_set_updated_at ON public.persona_reference_assets;
    CREATE TRIGGER persona_reference_assets_set_updated_at
      BEFORE UPDATE ON public.persona_reference_assets
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- RLS — match Brain development conventions (service role bypasses)
-- Workspace scoping is enforced in the application repository layer.
-- ---------------------------------------------------------------------------

ALTER TABLE public.persona_personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persona_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persona_camera_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persona_poses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persona_brand_looks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persona_outfits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persona_reference_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persona_persona_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persona_persona_camera_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persona_persona_poses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persona_persona_brand_looks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persona_persona_outfits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "persona_personas_select" ON public.persona_personas;
CREATE POLICY "persona_personas_select" ON public.persona_personas
  FOR SELECT USING (true);
DROP POLICY IF EXISTS "persona_personas_insert" ON public.persona_personas;
CREATE POLICY "persona_personas_insert" ON public.persona_personas
  FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "persona_personas_update" ON public.persona_personas;
CREATE POLICY "persona_personas_update" ON public.persona_personas
  FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "persona_personas_delete" ON public.persona_personas;
CREATE POLICY "persona_personas_delete" ON public.persona_personas
  FOR DELETE USING (true);

DROP POLICY IF EXISTS "persona_locations_all" ON public.persona_locations;
CREATE POLICY "persona_locations_all" ON public.persona_locations
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "persona_camera_presets_all" ON public.persona_camera_presets;
CREATE POLICY "persona_camera_presets_all" ON public.persona_camera_presets
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "persona_poses_all" ON public.persona_poses;
CREATE POLICY "persona_poses_all" ON public.persona_poses
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "persona_brand_looks_all" ON public.persona_brand_looks;
CREATE POLICY "persona_brand_looks_all" ON public.persona_brand_looks
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "persona_outfits_all" ON public.persona_outfits;
CREATE POLICY "persona_outfits_all" ON public.persona_outfits
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "persona_reference_assets_all" ON public.persona_reference_assets;
CREATE POLICY "persona_reference_assets_all" ON public.persona_reference_assets
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "persona_persona_locations_all" ON public.persona_persona_locations;
CREATE POLICY "persona_persona_locations_all" ON public.persona_persona_locations
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "persona_persona_camera_presets_all" ON public.persona_persona_camera_presets;
CREATE POLICY "persona_persona_camera_presets_all" ON public.persona_persona_camera_presets
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "persona_persona_poses_all" ON public.persona_persona_poses;
CREATE POLICY "persona_persona_poses_all" ON public.persona_persona_poses
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "persona_persona_brand_looks_all" ON public.persona_persona_brand_looks;
CREATE POLICY "persona_persona_brand_looks_all" ON public.persona_persona_brand_looks
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "persona_persona_outfits_all" ON public.persona_persona_outfits;
CREATE POLICY "persona_persona_outfits_all" ON public.persona_persona_outfits
  FOR ALL USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Private storage bucket for reference assets (signed URLs only — no public)
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'persona-references',
  'persona-references',
  false,
  20971520,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4']
)
ON CONFLICT (id) DO UPDATE
SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Service role manage persona references" ON storage.objects;
CREATE POLICY "Service role manage persona references"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'persona-references')
WITH CHECK (bucket_id = 'persona-references');

COMMENT ON TABLE public.persona_reference_assets IS
  'User-uploaded Brand Cast reference assets. No AI generation. Private storage + signed URLs.';
