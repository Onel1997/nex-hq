-- Persona Studio — Phase 1 foundation schema
-- Official Milaene Brand Cast libraries + many-to-many preferred relations.
-- No generation / provider tables in this phase.

-- ---------------------------------------------------------------------------
-- Core libraries
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.persona_personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.brain_workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Draft'
    CHECK (status IN ('Draft', 'Review', 'Approved', 'Archived')),
  gender TEXT NOT NULL DEFAULT '',
  age_range TEXT NOT NULL DEFAULT '',
  height TEXT NOT NULL DEFAULT '',
  body_type TEXT NOT NULL DEFAULT '',
  skin_tone TEXT NOT NULL DEFAULT '',
  hair TEXT NOT NULL DEFAULT '',
  beard TEXT NOT NULL DEFAULT '',
  eye_color TEXT NOT NULL DEFAULT '',
  expression TEXT NOT NULL DEFAULT '',
  personality TEXT NOT NULL DEFAULT '',
  style TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  brand_fit_score NUMERIC(5,2) NOT NULL DEFAULT 0
    CHECK (brand_fit_score >= 0 AND brand_fit_score <= 100),
  approved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT persona_personas_approved_status_check CHECK (
    (approved = true AND status = 'Approved')
    OR (approved = false AND status <> 'Approved')
  )
);

CREATE INDEX IF NOT EXISTS idx_persona_personas_workspace_status
  ON public.persona_personas (workspace_id, status);

CREATE INDEX IF NOT EXISTS idx_persona_personas_approved
  ON public.persona_personas (workspace_id, approved)
  WHERE approved = true;

CREATE TABLE IF NOT EXISTS public.persona_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.brain_workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  setting TEXT NOT NULL CHECK (setting IN ('indoor', 'outdoor')),
  description TEXT NOT NULL DEFAULT '',
  tags TEXT[] NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_persona_locations_workspace_active
  ON public.persona_locations (workspace_id, active);

CREATE TABLE IF NOT EXISTS public.persona_camera_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.brain_workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  focal_length TEXT NOT NULL,
  framing TEXT NOT NULL,
  lighting_style TEXT NOT NULL,
  color_grade TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.persona_poses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.brain_workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  body_direction TEXT NOT NULL,
  suitable_products TEXT[] NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.persona_brand_looks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.brain_workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  mood TEXT NOT NULL,
  color_style TEXT NOT NULL,
  styling_notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.persona_outfits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.brain_workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  items TEXT[] NOT NULL DEFAULT '{}',
  tags TEXT[] NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Many-to-many preferred relations (Persona → libraries)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.persona_persona_locations (
  persona_id UUID NOT NULL REFERENCES public.persona_personas(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.persona_locations(id) ON DELETE CASCADE,
  PRIMARY KEY (persona_id, location_id)
);

CREATE TABLE IF NOT EXISTS public.persona_persona_camera_presets (
  persona_id UUID NOT NULL REFERENCES public.persona_personas(id) ON DELETE CASCADE,
  camera_preset_id UUID NOT NULL REFERENCES public.persona_camera_presets(id) ON DELETE CASCADE,
  PRIMARY KEY (persona_id, camera_preset_id)
);

CREATE TABLE IF NOT EXISTS public.persona_persona_poses (
  persona_id UUID NOT NULL REFERENCES public.persona_personas(id) ON DELETE CASCADE,
  pose_id UUID NOT NULL REFERENCES public.persona_poses(id) ON DELETE CASCADE,
  PRIMARY KEY (persona_id, pose_id)
);

CREATE TABLE IF NOT EXISTS public.persona_persona_brand_looks (
  persona_id UUID NOT NULL REFERENCES public.persona_personas(id) ON DELETE CASCADE,
  brand_look_id UUID NOT NULL REFERENCES public.persona_brand_looks(id) ON DELETE CASCADE,
  PRIMARY KEY (persona_id, brand_look_id)
);

CREATE TABLE IF NOT EXISTS public.persona_persona_outfits (
  persona_id UUID NOT NULL REFERENCES public.persona_personas(id) ON DELETE CASCADE,
  outfit_id UUID NOT NULL REFERENCES public.persona_outfits(id) ON DELETE CASCADE,
  PRIMARY KEY (persona_id, outfit_id)
);

-- ---------------------------------------------------------------------------
-- Future hooks (empty placeholders — Image Studio / Video Studio)
-- No generation tables in Phase 1.
-- ---------------------------------------------------------------------------

COMMENT ON TABLE public.persona_personas IS
  'Milaene Brand Cast personas. Only Approved rows may feed Image/Video Studio later.';

COMMENT ON TABLE public.persona_locations IS
  'Location library for Persona Studio (and future Image/Video Studio).';

COMMENT ON TABLE public.persona_camera_presets IS
  'Camera preset library — no generation providers in Phase 1.';

COMMENT ON TABLE public.persona_poses IS
  'Pose library for consistent Brand Cast framing.';

COMMENT ON TABLE public.persona_brand_looks IS
  'Brand look library (Quiet Luxury, Editorial, Campaign, …).';

COMMENT ON TABLE public.persona_outfits IS
  'Reusable outfit combinations for Brand Cast consistency.';
