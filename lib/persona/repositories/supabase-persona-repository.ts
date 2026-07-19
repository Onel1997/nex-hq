/**
 * Supabase-backed PersonaRepository — production persistence.
 */

import { createAdminClient, type BrainSupabaseClient } from "@/lib/supabase/admin";
import { PersonaDomainError } from "../domain/errors";
import { computePersonaReadiness } from "../domain/readiness";
import type {
  BrandLook,
  CameraPreset,
  CreateBrandLookInput,
  CreateCameraPresetInput,
  CreateLocationInput,
  CreateOutfitInput,
  CreatePersonaInput,
  CreatePoseInput,
  CreateReferenceAssetInput,
  LibraryDeleteImpact,
  Location,
  Outfit,
  Persona,
  PersonaReferenceAsset,
  PersonaRelationKind,
  PersonaStatus,
  PersonaStudioDashboardCounts,
  PersonaStudioSnapshot,
  Pose,
  UpdateBrandLookInput,
  UpdateCameraPresetInput,
  UpdateLocationInput,
  UpdateOutfitInput,
  UpdatePersonaInput,
  UpdatePoseInput,
  UpdateReferenceAssetInput,
  WorkspaceScope,
} from "../domain/types";
import type { PersonaRepository } from "./persona-repository";

type PreferredIds = {
  preferred_location_ids: string[];
  preferred_camera_preset_ids: string[];
  preferred_pose_ids: string[];
  preferred_brand_look_ids: string[];
  preferred_outfit_ids: string[];
};

const EMPTY_PREFERRED: PreferredIds = {
  preferred_location_ids: [],
  preferred_camera_preset_ids: [],
  preferred_pose_ids: [],
  preferred_brand_look_ids: [],
  preferred_outfit_ids: [],
};

type RelationConfig = {
  junctionTable: string;
  foreignKey: string;
  preferredField: keyof PreferredIds;
};

const RELATION_CONFIG: Record<PersonaRelationKind, RelationConfig> = {
  locations: {
    junctionTable: "persona_persona_locations",
    foreignKey: "location_id",
    preferredField: "preferred_location_ids",
  },
  camera_presets: {
    junctionTable: "persona_persona_camera_presets",
    foreignKey: "camera_preset_id",
    preferredField: "preferred_camera_preset_ids",
  },
  poses: {
    junctionTable: "persona_persona_poses",
    foreignKey: "pose_id",
    preferredField: "preferred_pose_ids",
  },
  brand_looks: {
    junctionTable: "persona_persona_brand_looks",
    foreignKey: "brand_look_id",
    preferredField: "preferred_brand_look_ids",
  },
  outfits: {
    junctionTable: "persona_persona_outfits",
    foreignKey: "outfit_id",
    preferredField: "preferred_outfit_ids",
  },
};

function str(value: unknown, fallback = ""): string {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function bool(value: unknown, fallback = false): boolean {
  if (value === null || value === undefined) return fallback;
  return Boolean(value);
}

function num(value: unknown, fallback = 0): number {
  if (value === null || value === undefined) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function nullableStr(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

function throwDb(
  error: { message: string; code?: string } | null,
  message: string,
  code: "NOT_FOUND" | "VALIDATION" | "RELATIONSHIP_INTEGRITY" = "VALIDATION",
): void {
  if (!error) return;
  throw new PersonaDomainError(message, code, {
    supabase_message: error.message,
    supabase_code: error.code,
  });
}

function mapPersona(
  row: Record<string, unknown>,
  preferred: PreferredIds = EMPTY_PREFERRED,
): Persona {
  const status = (str(row.status, "Draft") || "Draft") as PersonaStatus;
  return {
    id: str(row.id),
    workspace_id: str(row.workspace_id),
    name: str(row.name),
    role: str(row.role),
    status,
    gender: str(row.gender),
    age_range: str(row.age_range),
    height: str(row.height),
    body_type: str(row.body_type),
    skin_tone: str(row.skin_tone),
    hair: str(row.hair),
    beard: str(row.beard),
    eye_color: str(row.eye_color),
    expression: str(row.expression),
    personality: str(row.personality),
    style: str(row.style),
    notes: str(row.notes),
    brand_fit_score: num(row.brand_fit_score, 0),
    approved: bool(row.approved, status === "Approved"),
    identity_lock_version: num(row.identity_lock_version, 1) || 1,
    image_use_approved: bool(row.image_use_approved, false),
    video_use_approved: bool(row.video_use_approved, false),
    primary_reference_asset_id: nullableStr(row.primary_reference_asset_id),
    visual_identity_notes: str(row.visual_identity_notes),
    distinguishing_features: str(row.distinguishing_features),
    prohibited_changes: str(row.prohibited_changes),
    default_hair_style: str(row.default_hair_style),
    default_facial_hair: str(row.default_facial_hair),
    default_expression: str(row.default_expression),
    default_body_proportions: str(row.default_body_proportions),
    default_styling_notes: str(row.default_styling_notes),
    source_creation_project_id: nullableStr(row.source_creation_project_id),
    source_candidate_id: nullableStr(row.source_candidate_id),
    identity_lock_status: (str(row.identity_lock_status, "not_started") ||
      "not_started") as Persona["identity_lock_status"],
    canonical_identity_description: str(row.canonical_identity_description),
    immutable_features: str(row.immutable_features),
    flexible_features: str(row.flexible_features),
    approved_hair_variations: str(row.approved_hair_variations),
    approved_expression_range: str(row.approved_expression_range),
    approved_body_proportions: str(row.approved_body_proportions),
    approved_age_range: str(row.approved_age_range),
    default_styling: str(row.default_styling),
    image_identity_ready: bool(row.image_identity_ready, false),
    video_identity_ready: bool(row.video_identity_ready, false),
    intended_usage: (str(row.intended_usage, "image_and_video") ||
      "image_and_video") as Persona["intended_usage"],
    preferred_location_ids: preferred.preferred_location_ids,
    preferred_camera_preset_ids: preferred.preferred_camera_preset_ids,
    preferred_pose_ids: preferred.preferred_pose_ids,
    preferred_brand_look_ids: preferred.preferred_brand_look_ids,
    preferred_outfit_ids: preferred.preferred_outfit_ids,
    created_by: nullableStr(row.created_by),
    created_at: str(row.created_at),
    updated_at: str(row.updated_at),
  };
}

function mapLocation(row: Record<string, unknown>): Location {
  return {
    id: str(row.id),
    workspace_id: str(row.workspace_id),
    name: str(row.name),
    category: str(row.category),
    setting: (str(row.setting, "indoor") as Location["setting"]) || "indoor",
    description: str(row.description),
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    active: bool(row.active, true),
    created_by: nullableStr(row.created_by),
    created_at: str(row.created_at),
    updated_at: str(row.updated_at),
  };
}

function mapCameraPreset(row: Record<string, unknown>): CameraPreset {
  return {
    id: str(row.id),
    workspace_id: str(row.workspace_id),
    name: str(row.name),
    focal_length: str(row.focal_length),
    framing: str(row.framing),
    lighting_style: str(row.lighting_style),
    color_grade: str(row.color_grade),
    notes: str(row.notes),
    created_by: nullableStr(row.created_by),
    created_at: str(row.created_at),
    updated_at: str(row.updated_at),
  };
}

function mapPose(row: Record<string, unknown>): Pose {
  return {
    id: str(row.id),
    workspace_id: str(row.workspace_id),
    name: str(row.name),
    category: str(row.category),
    description: str(row.description),
    body_direction: str(row.body_direction),
    suitable_products: Array.isArray(row.suitable_products)
      ? (row.suitable_products as string[])
      : [],
    active: bool(row.active, true),
    created_by: nullableStr(row.created_by),
    created_at: str(row.created_at),
    updated_at: str(row.updated_at),
  };
}

function mapBrandLook(row: Record<string, unknown>): BrandLook {
  return {
    id: str(row.id),
    workspace_id: str(row.workspace_id),
    name: str(row.name),
    description: str(row.description),
    mood: str(row.mood),
    color_style: str(row.color_style),
    styling_notes: str(row.styling_notes),
    created_by: nullableStr(row.created_by),
    created_at: str(row.created_at),
    updated_at: str(row.updated_at),
  };
}

function mapOutfit(row: Record<string, unknown>): Outfit {
  return {
    id: str(row.id),
    workspace_id: str(row.workspace_id),
    name: str(row.name),
    description: str(row.description),
    items: Array.isArray(row.items) ? (row.items as string[]) : [],
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    active: bool(row.active, true),
    created_by: nullableStr(row.created_by),
    created_at: str(row.created_at),
    updated_at: str(row.updated_at),
  };
}

function mapReferenceAsset(row: Record<string, unknown>): PersonaReferenceAsset {
  return {
    id: str(row.id),
    workspace_id: str(row.workspace_id),
    persona_id: str(row.persona_id),
    asset_type: row.asset_type as PersonaReferenceAsset["asset_type"],
    storage_path: str(row.storage_path),
    mime_type: str(row.mime_type),
    width: row.width === null || row.width === undefined ? null : num(row.width),
    height:
      row.height === null || row.height === undefined ? null : num(row.height),
    file_size_bytes: num(row.file_size_bytes, 0),
    checksum: str(row.checksum),
    status: (str(row.status, "uploaded") ||
      "uploaded") as PersonaReferenceAsset["status"],
    is_primary: bool(row.is_primary, false),
    view_angle: (str(row.view_angle, "unknown") ||
      "unknown") as PersonaReferenceAsset["view_angle"],
    framing: (str(row.framing, "unknown") ||
      "unknown") as PersonaReferenceAsset["framing"],
    expression: str(row.expression),
    body_visibility: str(row.body_visibility),
    notes: str(row.notes),
    source_type: (str(row.source_type, "user_upload") ||
      "user_upload") as PersonaReferenceAsset["source_type"],
    rights_confirmed: bool(row.rights_confirmed, false),
    created_by: nullableStr(row.created_by),
    created_at: str(row.created_at),
    updated_at: str(row.updated_at),
  };
}

function personaRowPayload(
  scope: WorkspaceScope,
  input: CreatePersonaInput | UpdatePersonaInput,
  opts: { includeWorkspace: boolean; status?: PersonaStatus },
): Record<string, unknown> {
  const status = opts.status ?? ("status" in input ? input.status : undefined);
  const approved =
    status !== undefined ? status === "Approved" : undefined;

  const row: Record<string, unknown> = {};
  if (opts.includeWorkspace) row.workspace_id = scope.workspaceId;

  const keys = [
    "name",
    "role",
    "gender",
    "age_range",
    "height",
    "body_type",
    "skin_tone",
    "hair",
    "beard",
    "eye_color",
    "expression",
    "personality",
    "style",
    "notes",
    "brand_fit_score",
    "identity_lock_version",
    "image_use_approved",
    "video_use_approved",
    "primary_reference_asset_id",
    "visual_identity_notes",
    "distinguishing_features",
    "prohibited_changes",
    "default_hair_style",
    "default_facial_hair",
    "default_expression",
    "default_body_proportions",
    "default_styling_notes",
    "source_creation_project_id",
    "source_candidate_id",
    "identity_lock_status",
    "canonical_identity_description",
    "immutable_features",
    "flexible_features",
    "approved_hair_variations",
    "approved_expression_range",
    "approved_body_proportions",
    "approved_age_range",
    "default_styling",
    "image_identity_ready",
    "video_identity_ready",
    "intended_usage",
    "created_by",
  ] as const;

  for (const key of keys) {
    if (key in input && (input as Record<string, unknown>)[key] !== undefined) {
      row[key] = (input as Record<string, unknown>)[key];
    }
  }

  if (status !== undefined) row.status = status;
  if (approved !== undefined) row.approved = approved;

  return row;
}

export class SupabasePersonaRepository implements PersonaRepository {
  readonly kind = "supabase" as const;

  private readonly db: BrainSupabaseClient;

  constructor(db: BrainSupabaseClient = createAdminClient()) {
    this.db = db;
  }

  async snapshot(scope: WorkspaceScope): Promise<PersonaStudioSnapshot> {
    const ws = scope.workspaceId;
    const [
      personasRes,
      locationsRes,
      camerasRes,
      posesRes,
      looksRes,
      outfitsRes,
      refsRes,
    ] = await Promise.all([
      this.db.from("persona_personas").select("*").eq("workspace_id", ws),
      this.db.from("persona_locations").select("*").eq("workspace_id", ws),
      this.db.from("persona_camera_presets").select("*").eq("workspace_id", ws),
      this.db.from("persona_poses").select("*").eq("workspace_id", ws),
      this.db.from("persona_brand_looks").select("*").eq("workspace_id", ws),
      this.db.from("persona_outfits").select("*").eq("workspace_id", ws),
      this.db
        .from("persona_reference_assets")
        .select("*")
        .eq("workspace_id", ws),
    ]);

    for (const res of [
      personasRes,
      locationsRes,
      camerasRes,
      posesRes,
      looksRes,
      outfitsRes,
      refsRes,
    ]) {
      throwDb(res.error, `Failed to load Persona Studio snapshot: ${res.error?.message}`);
    }

    const personaRows = (personasRes.data ?? []) as Record<string, unknown>[];
    const preferredMap = await this.loadPreferredIdsForPersonas(
      personaRows.map((r) => str(r.id)),
    );

    return {
      personas: personaRows.map((r) =>
        mapPersona(r, preferredMap.get(str(r.id)) ?? EMPTY_PREFERRED),
      ),
      locations: ((locationsRes.data ?? []) as Record<string, unknown>[]).map(
        mapLocation,
      ),
      camera_presets: ((camerasRes.data ?? []) as Record<string, unknown>[]).map(
        mapCameraPreset,
      ),
      poses: ((posesRes.data ?? []) as Record<string, unknown>[]).map(mapPose),
      brand_looks: ((looksRes.data ?? []) as Record<string, unknown>[]).map(
        mapBrandLook,
      ),
      outfits: ((outfitsRes.data ?? []) as Record<string, unknown>[]).map(
        mapOutfit,
      ),
      reference_assets: ((refsRes.data ?? []) as Record<string, unknown>[]).map(
        mapReferenceAsset,
      ),
    };
  }

  async dashboardCounts(
    scope: WorkspaceScope,
  ): Promise<PersonaStudioDashboardCounts> {
    const snap = await this.snapshot(scope);
    let image_ready_personas = 0;
    let video_ready_personas = 0;

    for (const persona of snap.personas) {
      const assets = snap.reference_assets.filter(
        (a) => a.persona_id === persona.id,
      );
      const readiness = computePersonaReadiness(persona, assets);
      if (readiness.image_ready) image_ready_personas += 1;
      if (readiness.video_ready) video_ready_personas += 1;
    }

    return {
      approved_personas: snap.personas.filter(
        (p) => p.status === "Approved" && p.approved,
      ).length,
      locations: snap.locations.filter((l) => l.active).length,
      camera_presets: snap.camera_presets.length,
      pose_packs: snap.poses.filter((p) => p.active).length,
      brand_looks: snap.brand_looks.length,
      outfits: snap.outfits.filter((o) => o.active).length,
      draft_personas: snap.personas.filter((p) => p.status === "Draft").length,
      review_personas: snap.personas.filter((p) => p.status === "Review").length,
      image_ready_personas,
      video_ready_personas,
    };
  }

  // --- Personas ---

  async listPersonas(scope: WorkspaceScope): Promise<Persona[]> {
    const { data, error } = await this.db
      .from("persona_personas")
      .select("*")
      .eq("workspace_id", scope.workspaceId)
      .order("created_at", { ascending: false });
    throwDb(error, `Failed to list personas: ${error?.message}`);
    const rows = (data ?? []) as Record<string, unknown>[];
    const preferredMap = await this.loadPreferredIdsForPersonas(
      rows.map((r) => str(r.id)),
    );
    return rows.map((r) =>
      mapPersona(r, preferredMap.get(str(r.id)) ?? EMPTY_PREFERRED),
    );
  }

  async getPersona(scope: WorkspaceScope, id: string): Promise<Persona | null> {
    const row = await this.fetchRowById("persona_personas", id);
    if (!row) return null;
    this.assertWorkspace(row, scope, "Persona");
    const preferred = await this.loadPreferredIdsForPersona(id);
    return mapPersona(row, preferred);
  }

  async createPersona(
    scope: WorkspaceScope,
    input: CreatePersonaInput,
  ): Promise<Persona> {
    if (!str(input.name).trim()) {
      throw new PersonaDomainError("Persona name is required", "VALIDATION");
    }

    const preferred: PreferredIds = {
      preferred_location_ids: [...new Set(input.preferred_location_ids ?? [])],
      preferred_camera_preset_ids: [
        ...new Set(input.preferred_camera_preset_ids ?? []),
      ],
      preferred_pose_ids: [...new Set(input.preferred_pose_ids ?? [])],
      preferred_brand_look_ids: [...new Set(input.preferred_brand_look_ids ?? [])],
      preferred_outfit_ids: [...new Set(input.preferred_outfit_ids ?? [])],
    };

    await this.assertRelationIdsExist(scope, preferred);

    const status = input.status ?? "Draft";
    const payload = {
      ...personaRowPayload(scope, input, {
        includeWorkspace: true,
        status,
      }),
      identity_lock_version: input.identity_lock_version ?? 1,
      image_use_approved: input.image_use_approved ?? false,
      video_use_approved: input.video_use_approved ?? false,
      primary_reference_asset_id: input.primary_reference_asset_id ?? null,
      visual_identity_notes: input.visual_identity_notes ?? "",
      distinguishing_features: input.distinguishing_features ?? "",
      prohibited_changes: input.prohibited_changes ?? "",
      default_hair_style: input.default_hair_style ?? "",
      default_facial_hair: input.default_facial_hair ?? "",
      default_expression: input.default_expression ?? "",
      default_body_proportions: input.default_body_proportions ?? "",
      default_styling_notes: input.default_styling_notes ?? "",
      source_creation_project_id: input.source_creation_project_id ?? null,
      source_candidate_id: input.source_candidate_id ?? null,
      identity_lock_status: input.identity_lock_status ?? "not_started",
      canonical_identity_description: input.canonical_identity_description ?? "",
      immutable_features: input.immutable_features ?? "",
      flexible_features: input.flexible_features ?? "",
      approved_hair_variations: input.approved_hair_variations ?? "",
      approved_expression_range: input.approved_expression_range ?? "",
      approved_body_proportions: input.approved_body_proportions ?? "",
      approved_age_range: input.approved_age_range ?? "",
      default_styling: input.default_styling ?? "",
      image_identity_ready: input.image_identity_ready ?? false,
      video_identity_ready: input.video_identity_ready ?? false,
      intended_usage: input.intended_usage ?? "image_and_video",
      created_by: input.created_by ?? scope.actorId ?? null,
      gender: input.gender ?? "",
      age_range: input.age_range ?? "",
      height: input.height ?? "",
      body_type: input.body_type ?? "",
      skin_tone: input.skin_tone ?? "",
      hair: input.hair ?? "",
      beard: input.beard ?? "",
      eye_color: input.eye_color ?? "",
      expression: input.expression ?? "",
      personality: input.personality ?? "",
      style: input.style ?? "",
      notes: input.notes ?? "",
      brand_fit_score: input.brand_fit_score ?? 0,
    };

    // primary_reference cannot point at a non-existent asset on create
    if (payload.primary_reference_asset_id) {
      throw new PersonaDomainError(
        "primary_reference_asset_id cannot be set before the persona exists",
        "RELATIONSHIP_INTEGRITY",
      );
    }

    const { data, error } = await this.db
      .from("persona_personas")
      .insert(payload)
      .select("*")
      .single();
    throwDb(error, `Failed to create persona: ${error?.message}`);

    const personaId = str((data as Record<string, unknown>).id);
    await this.replaceAllJunctions(personaId, preferred);
    return mapPersona(data as Record<string, unknown>, preferred);
  }

  async updatePersona(
    scope: WorkspaceScope,
    id: string,
    patch: UpdatePersonaInput,
  ): Promise<Persona> {
    const existing = await this.requireRow("persona_personas", id, scope, "Persona");
    const nextStatus = (patch.status ?? str(existing.status, "Draft")) as PersonaStatus;

    if (patch.primary_reference_asset_id) {
      await this.assertPrimaryReference(
        scope,
        id,
        patch.primary_reference_asset_id,
      );
    }

    const currentPreferred = await this.loadPreferredIdsForPersona(id);
    const nextPreferred: PreferredIds = {
      preferred_location_ids:
        patch.preferred_location_ids !== undefined
          ? [...new Set(patch.preferred_location_ids)]
          : currentPreferred.preferred_location_ids,
      preferred_camera_preset_ids:
        patch.preferred_camera_preset_ids !== undefined
          ? [...new Set(patch.preferred_camera_preset_ids)]
          : currentPreferred.preferred_camera_preset_ids,
      preferred_pose_ids:
        patch.preferred_pose_ids !== undefined
          ? [...new Set(patch.preferred_pose_ids)]
          : currentPreferred.preferred_pose_ids,
      preferred_brand_look_ids:
        patch.preferred_brand_look_ids !== undefined
          ? [...new Set(patch.preferred_brand_look_ids)]
          : currentPreferred.preferred_brand_look_ids,
      preferred_outfit_ids:
        patch.preferred_outfit_ids !== undefined
          ? [...new Set(patch.preferred_outfit_ids)]
          : currentPreferred.preferred_outfit_ids,
    };

    const relationsTouched =
      patch.preferred_location_ids !== undefined ||
      patch.preferred_camera_preset_ids !== undefined ||
      patch.preferred_pose_ids !== undefined ||
      patch.preferred_brand_look_ids !== undefined ||
      patch.preferred_outfit_ids !== undefined;

    if (relationsTouched) {
      await this.assertRelationIdsExist(scope, nextPreferred);
    }

    const payload = personaRowPayload(scope, patch, {
      includeWorkspace: false,
      status: patch.status !== undefined ? nextStatus : undefined,
    });
    payload.updated_at = new Date().toISOString();

    const { data, error } = await this.db
      .from("persona_personas")
      .update(payload)
      .eq("id", id)
      .eq("workspace_id", scope.workspaceId)
      .select("*")
      .single();
    throwDb(error, `Failed to update persona: ${error?.message}`);

    if (relationsTouched) {
      await this.replaceAllJunctions(id, nextPreferred);
    }

    return mapPersona(
      data as Record<string, unknown>,
      relationsTouched ? nextPreferred : currentPreferred,
    );
  }

  async deletePersona(scope: WorkspaceScope, id: string): Promise<void> {
    await this.requireRow("persona_personas", id, scope, "Persona");
    const { error } = await this.db
      .from("persona_personas")
      .delete()
      .eq("id", id)
      .eq("workspace_id", scope.workspaceId);
    throwDb(error, `Failed to delete persona: ${error?.message}`);
  }

  async setPersonaRelations(
    scope: WorkspaceScope,
    personaId: string,
    kind: PersonaRelationKind,
    ids: string[],
  ): Promise<Persona> {
    await this.requireRow("persona_personas", personaId, scope, "Persona");
    const unique = [...new Set(ids)];
    const config = RELATION_CONFIG[kind];
    const current = await this.loadPreferredIdsForPersona(personaId);
    const next: PreferredIds = { ...current, [config.preferredField]: unique };
    await this.assertRelationIdsExist(scope, {
      ...EMPTY_PREFERRED,
      [config.preferredField]: unique,
    });
    await this.replaceJunction(personaId, kind, unique);
    const row = await this.requireRow("persona_personas", personaId, scope, "Persona");
    return mapPersona(row, next);
  }

  // --- Locations ---

  async listLocations(scope: WorkspaceScope): Promise<Location[]> {
    const { data, error } = await this.db
      .from("persona_locations")
      .select("*")
      .eq("workspace_id", scope.workspaceId)
      .order("created_at", { ascending: false });
    throwDb(error, `Failed to list locations: ${error?.message}`);
    return ((data ?? []) as Record<string, unknown>[]).map(mapLocation);
  }

  async getLocation(scope: WorkspaceScope, id: string): Promise<Location | null> {
    const row = await this.fetchRowById("persona_locations", id);
    if (!row) return null;
    this.assertWorkspace(row, scope, "Location");
    return mapLocation(row);
  }

  async createLocation(
    scope: WorkspaceScope,
    input: CreateLocationInput,
  ): Promise<Location> {
    if (!str(input.name).trim()) {
      throw new PersonaDomainError("Location name is required", "VALIDATION");
    }
    const { data, error } = await this.db
      .from("persona_locations")
      .insert({
        workspace_id: scope.workspaceId,
        name: input.name,
        category: input.category ?? "",
        setting: input.setting,
        description: input.description ?? "",
        tags: input.tags ?? [],
        active: input.active ?? true,
        created_by: input.created_by ?? scope.actorId ?? null,
      })
      .select("*")
      .single();
    throwDb(error, `Failed to create location: ${error?.message}`);
    return mapLocation(data as Record<string, unknown>);
  }

  async updateLocation(
    scope: WorkspaceScope,
    id: string,
    patch: UpdateLocationInput,
  ): Promise<Location> {
    await this.requireRow("persona_locations", id, scope, "Location");
    const { data, error } = await this.db
      .from("persona_locations")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("workspace_id", scope.workspaceId)
      .select("*")
      .single();
    throwDb(error, `Failed to update location: ${error?.message}`);
    return mapLocation(data as Record<string, unknown>);
  }

  async deleteLocation(scope: WorkspaceScope, id: string): Promise<void> {
    await this.requireRow("persona_locations", id, scope, "Location");
    await this.deleteJunctionByForeignKey("persona_persona_locations", "location_id", id);
    const { error } = await this.db
      .from("persona_locations")
      .delete()
      .eq("id", id)
      .eq("workspace_id", scope.workspaceId);
    throwDb(error, `Failed to delete location: ${error?.message}`);
  }

  async countPersonasReferencingLocation(
    scope: WorkspaceScope,
    locationId: string,
  ): Promise<LibraryDeleteImpact> {
    await this.requireRow("persona_locations", locationId, scope, "Location");
    return this.countReferencingJunction(
      scope,
      "persona_persona_locations",
      "location_id",
      locationId,
    );
  }

  // --- Camera presets ---

  async listCameraPresets(scope: WorkspaceScope): Promise<CameraPreset[]> {
    const { data, error } = await this.db
      .from("persona_camera_presets")
      .select("*")
      .eq("workspace_id", scope.workspaceId)
      .order("created_at", { ascending: false });
    throwDb(error, `Failed to list camera presets: ${error?.message}`);
    return ((data ?? []) as Record<string, unknown>[]).map(mapCameraPreset);
  }

  async getCameraPreset(
    scope: WorkspaceScope,
    id: string,
  ): Promise<CameraPreset | null> {
    const row = await this.fetchRowById("persona_camera_presets", id);
    if (!row) return null;
    this.assertWorkspace(row, scope, "Camera preset");
    return mapCameraPreset(row);
  }

  async createCameraPreset(
    scope: WorkspaceScope,
    input: CreateCameraPresetInput,
  ): Promise<CameraPreset> {
    if (!str(input.name).trim()) {
      throw new PersonaDomainError("Camera preset name is required", "VALIDATION");
    }
    const { data, error } = await this.db
      .from("persona_camera_presets")
      .insert({
        workspace_id: scope.workspaceId,
        name: input.name,
        focal_length: input.focal_length ?? "",
        framing: input.framing ?? "",
        lighting_style: input.lighting_style ?? "",
        color_grade: input.color_grade ?? "",
        notes: input.notes ?? "",
        created_by: input.created_by ?? scope.actorId ?? null,
      })
      .select("*")
      .single();
    throwDb(error, `Failed to create camera preset: ${error?.message}`);
    return mapCameraPreset(data as Record<string, unknown>);
  }

  async updateCameraPreset(
    scope: WorkspaceScope,
    id: string,
    patch: UpdateCameraPresetInput,
  ): Promise<CameraPreset> {
    await this.requireRow("persona_camera_presets", id, scope, "Camera preset");
    const { data, error } = await this.db
      .from("persona_camera_presets")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("workspace_id", scope.workspaceId)
      .select("*")
      .single();
    throwDb(error, `Failed to update camera preset: ${error?.message}`);
    return mapCameraPreset(data as Record<string, unknown>);
  }

  async deleteCameraPreset(scope: WorkspaceScope, id: string): Promise<void> {
    await this.requireRow("persona_camera_presets", id, scope, "Camera preset");
    await this.deleteJunctionByForeignKey(
      "persona_persona_camera_presets",
      "camera_preset_id",
      id,
    );
    const { error } = await this.db
      .from("persona_camera_presets")
      .delete()
      .eq("id", id)
      .eq("workspace_id", scope.workspaceId);
    throwDb(error, `Failed to delete camera preset: ${error?.message}`);
  }

  async countPersonasReferencingCameraPreset(
    scope: WorkspaceScope,
    cameraPresetId: string,
  ): Promise<LibraryDeleteImpact> {
    await this.requireRow(
      "persona_camera_presets",
      cameraPresetId,
      scope,
      "Camera preset",
    );
    return this.countReferencingJunction(
      scope,
      "persona_persona_camera_presets",
      "camera_preset_id",
      cameraPresetId,
    );
  }

  // --- Poses ---

  async listPoses(scope: WorkspaceScope): Promise<Pose[]> {
    const { data, error } = await this.db
      .from("persona_poses")
      .select("*")
      .eq("workspace_id", scope.workspaceId)
      .order("created_at", { ascending: false });
    throwDb(error, `Failed to list poses: ${error?.message}`);
    return ((data ?? []) as Record<string, unknown>[]).map(mapPose);
  }

  async getPose(scope: WorkspaceScope, id: string): Promise<Pose | null> {
    const row = await this.fetchRowById("persona_poses", id);
    if (!row) return null;
    this.assertWorkspace(row, scope, "Pose");
    return mapPose(row);
  }

  async createPose(scope: WorkspaceScope, input: CreatePoseInput): Promise<Pose> {
    if (!str(input.name).trim()) {
      throw new PersonaDomainError("Pose name is required", "VALIDATION");
    }
    const { data, error } = await this.db
      .from("persona_poses")
      .insert({
        workspace_id: scope.workspaceId,
        name: input.name,
        category: input.category ?? "",
        description: input.description ?? "",
        body_direction: input.body_direction ?? "",
        suitable_products: input.suitable_products ?? [],
        active: input.active ?? true,
        created_by: input.created_by ?? scope.actorId ?? null,
      })
      .select("*")
      .single();
    throwDb(error, `Failed to create pose: ${error?.message}`);
    return mapPose(data as Record<string, unknown>);
  }

  async updatePose(
    scope: WorkspaceScope,
    id: string,
    patch: UpdatePoseInput,
  ): Promise<Pose> {
    await this.requireRow("persona_poses", id, scope, "Pose");
    const { data, error } = await this.db
      .from("persona_poses")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("workspace_id", scope.workspaceId)
      .select("*")
      .single();
    throwDb(error, `Failed to update pose: ${error?.message}`);
    return mapPose(data as Record<string, unknown>);
  }

  async deletePose(scope: WorkspaceScope, id: string): Promise<void> {
    await this.requireRow("persona_poses", id, scope, "Pose");
    await this.deleteJunctionByForeignKey("persona_persona_poses", "pose_id", id);
    const { error } = await this.db
      .from("persona_poses")
      .delete()
      .eq("id", id)
      .eq("workspace_id", scope.workspaceId);
    throwDb(error, `Failed to delete pose: ${error?.message}`);
  }

  async countPersonasReferencingPose(
    scope: WorkspaceScope,
    poseId: string,
  ): Promise<LibraryDeleteImpact> {
    await this.requireRow("persona_poses", poseId, scope, "Pose");
    return this.countReferencingJunction(
      scope,
      "persona_persona_poses",
      "pose_id",
      poseId,
    );
  }

  // --- Brand looks ---

  async listBrandLooks(scope: WorkspaceScope): Promise<BrandLook[]> {
    const { data, error } = await this.db
      .from("persona_brand_looks")
      .select("*")
      .eq("workspace_id", scope.workspaceId)
      .order("created_at", { ascending: false });
    throwDb(error, `Failed to list brand looks: ${error?.message}`);
    return ((data ?? []) as Record<string, unknown>[]).map(mapBrandLook);
  }

  async getBrandLook(
    scope: WorkspaceScope,
    id: string,
  ): Promise<BrandLook | null> {
    const row = await this.fetchRowById("persona_brand_looks", id);
    if (!row) return null;
    this.assertWorkspace(row, scope, "Brand look");
    return mapBrandLook(row);
  }

  async createBrandLook(
    scope: WorkspaceScope,
    input: CreateBrandLookInput,
  ): Promise<BrandLook> {
    if (!str(input.name).trim()) {
      throw new PersonaDomainError("Brand look name is required", "VALIDATION");
    }
    const { data, error } = await this.db
      .from("persona_brand_looks")
      .insert({
        workspace_id: scope.workspaceId,
        name: input.name,
        description: input.description ?? "",
        mood: input.mood ?? "",
        color_style: input.color_style ?? "",
        styling_notes: input.styling_notes ?? "",
        created_by: input.created_by ?? scope.actorId ?? null,
      })
      .select("*")
      .single();
    throwDb(error, `Failed to create brand look: ${error?.message}`);
    return mapBrandLook(data as Record<string, unknown>);
  }

  async updateBrandLook(
    scope: WorkspaceScope,
    id: string,
    patch: UpdateBrandLookInput,
  ): Promise<BrandLook> {
    await this.requireRow("persona_brand_looks", id, scope, "Brand look");
    const { data, error } = await this.db
      .from("persona_brand_looks")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("workspace_id", scope.workspaceId)
      .select("*")
      .single();
    throwDb(error, `Failed to update brand look: ${error?.message}`);
    return mapBrandLook(data as Record<string, unknown>);
  }

  async deleteBrandLook(scope: WorkspaceScope, id: string): Promise<void> {
    await this.requireRow("persona_brand_looks", id, scope, "Brand look");
    await this.deleteJunctionByForeignKey(
      "persona_persona_brand_looks",
      "brand_look_id",
      id,
    );
    const { error } = await this.db
      .from("persona_brand_looks")
      .delete()
      .eq("id", id)
      .eq("workspace_id", scope.workspaceId);
    throwDb(error, `Failed to delete brand look: ${error?.message}`);
  }

  async countPersonasReferencingBrandLook(
    scope: WorkspaceScope,
    brandLookId: string,
  ): Promise<LibraryDeleteImpact> {
    await this.requireRow("persona_brand_looks", brandLookId, scope, "Brand look");
    return this.countReferencingJunction(
      scope,
      "persona_persona_brand_looks",
      "brand_look_id",
      brandLookId,
    );
  }

  // --- Outfits ---

  async listOutfits(scope: WorkspaceScope): Promise<Outfit[]> {
    const { data, error } = await this.db
      .from("persona_outfits")
      .select("*")
      .eq("workspace_id", scope.workspaceId)
      .order("created_at", { ascending: false });
    throwDb(error, `Failed to list outfits: ${error?.message}`);
    return ((data ?? []) as Record<string, unknown>[]).map(mapOutfit);
  }

  async getOutfit(scope: WorkspaceScope, id: string): Promise<Outfit | null> {
    const row = await this.fetchRowById("persona_outfits", id);
    if (!row) return null;
    this.assertWorkspace(row, scope, "Outfit");
    return mapOutfit(row);
  }

  async createOutfit(
    scope: WorkspaceScope,
    input: CreateOutfitInput,
  ): Promise<Outfit> {
    if (!str(input.name).trim()) {
      throw new PersonaDomainError("Outfit name is required", "VALIDATION");
    }
    const { data, error } = await this.db
      .from("persona_outfits")
      .insert({
        workspace_id: scope.workspaceId,
        name: input.name,
        description: input.description ?? "",
        items: input.items ?? [],
        tags: input.tags ?? [],
        active: input.active ?? true,
        created_by: input.created_by ?? scope.actorId ?? null,
      })
      .select("*")
      .single();
    throwDb(error, `Failed to create outfit: ${error?.message}`);
    return mapOutfit(data as Record<string, unknown>);
  }

  async updateOutfit(
    scope: WorkspaceScope,
    id: string,
    patch: UpdateOutfitInput,
  ): Promise<Outfit> {
    await this.requireRow("persona_outfits", id, scope, "Outfit");
    const { data, error } = await this.db
      .from("persona_outfits")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("workspace_id", scope.workspaceId)
      .select("*")
      .single();
    throwDb(error, `Failed to update outfit: ${error?.message}`);
    return mapOutfit(data as Record<string, unknown>);
  }

  async deleteOutfit(scope: WorkspaceScope, id: string): Promise<void> {
    await this.requireRow("persona_outfits", id, scope, "Outfit");
    await this.deleteJunctionByForeignKey(
      "persona_persona_outfits",
      "outfit_id",
      id,
    );
    const { error } = await this.db
      .from("persona_outfits")
      .delete()
      .eq("id", id)
      .eq("workspace_id", scope.workspaceId);
    throwDb(error, `Failed to delete outfit: ${error?.message}`);
  }

  async countPersonasReferencingOutfit(
    scope: WorkspaceScope,
    outfitId: string,
  ): Promise<LibraryDeleteImpact> {
    await this.requireRow("persona_outfits", outfitId, scope, "Outfit");
    return this.countReferencingJunction(
      scope,
      "persona_persona_outfits",
      "outfit_id",
      outfitId,
    );
  }

  // --- Reference assets ---

  async listReferenceAssets(
    scope: WorkspaceScope,
    personaId: string,
  ): Promise<PersonaReferenceAsset[]> {
    await this.requireRow("persona_personas", personaId, scope, "Persona");
    const { data, error } = await this.db
      .from("persona_reference_assets")
      .select("*")
      .eq("workspace_id", scope.workspaceId)
      .eq("persona_id", personaId)
      .order("created_at", { ascending: false });
    throwDb(error, `Failed to list reference assets: ${error?.message}`);
    return ((data ?? []) as Record<string, unknown>[]).map(mapReferenceAsset);
  }

  async getReferenceAsset(
    scope: WorkspaceScope,
    id: string,
  ): Promise<PersonaReferenceAsset | null> {
    const row = await this.fetchRowById("persona_reference_assets", id);
    if (!row) return null;
    this.assertWorkspace(row, scope, "Reference asset");
    return mapReferenceAsset(row);
  }

  async createReferenceAsset(
    scope: WorkspaceScope,
    input: CreateReferenceAssetInput,
  ): Promise<PersonaReferenceAsset> {
    await this.requireRow("persona_personas", input.persona_id, scope, "Persona");
    if (!str(input.storage_path).trim()) {
      throw new PersonaDomainError("storage_path is required", "VALIDATION");
    }
    const { data, error } = await this.db
      .from("persona_reference_assets")
      .insert({
        workspace_id: scope.workspaceId,
        persona_id: input.persona_id,
        asset_type: input.asset_type,
        storage_path: input.storage_path,
        mime_type: input.mime_type ?? "",
        width: input.width ?? null,
        height: input.height ?? null,
        file_size_bytes: input.file_size_bytes ?? 0,
        checksum: input.checksum ?? "",
        status: input.status ?? "uploaded",
        is_primary: input.is_primary ?? false,
        view_angle: input.view_angle ?? "unknown",
        framing: input.framing ?? "unknown",
        expression: input.expression ?? "",
        body_visibility: input.body_visibility ?? "",
        notes: input.notes ?? "",
        source_type: input.source_type ?? "user_upload",
        rights_confirmed: input.rights_confirmed ?? false,
        created_by: input.created_by ?? scope.actorId ?? null,
      })
      .select("*")
      .single();
    throwDb(error, `Failed to create reference asset: ${error?.message}`);
    return mapReferenceAsset(data as Record<string, unknown>);
  }

  async updateReferenceAsset(
    scope: WorkspaceScope,
    id: string,
    patch: UpdateReferenceAssetInput,
  ): Promise<PersonaReferenceAsset> {
    await this.requireRow("persona_reference_assets", id, scope, "Reference asset");
    const { data, error } = await this.db
      .from("persona_reference_assets")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("workspace_id", scope.workspaceId)
      .select("*")
      .single();
    throwDb(error, `Failed to update reference asset: ${error?.message}`);
    return mapReferenceAsset(data as Record<string, unknown>);
  }

  async deleteReferenceAsset(scope: WorkspaceScope, id: string): Promise<void> {
    await this.requireRow("persona_reference_assets", id, scope, "Reference asset");
    // Clear primary refs first (FK is ON DELETE SET NULL, but be explicit)
    const { error: clearError } = await this.db
      .from("persona_personas")
      .update({ primary_reference_asset_id: null })
      .eq("workspace_id", scope.workspaceId)
      .eq("primary_reference_asset_id", id);
    throwDb(clearError, `Failed to clear primary reference: ${clearError?.message}`);

    const { error } = await this.db
      .from("persona_reference_assets")
      .delete()
      .eq("id", id)
      .eq("workspace_id", scope.workspaceId);
    throwDb(error, `Failed to delete reference asset: ${error?.message}`);
  }

  async findReferenceByChecksum(
    scope: WorkspaceScope,
    personaId: string,
    checksum: string,
  ): Promise<PersonaReferenceAsset | null> {
    if (!checksum) return null;
    const { data, error } = await this.db
      .from("persona_reference_assets")
      .select("*")
      .eq("workspace_id", scope.workspaceId)
      .eq("persona_id", personaId)
      .eq("checksum", checksum)
      .maybeSingle();
    throwDb(error, `Failed to find reference by checksum: ${error?.message}`);
    if (!data) return null;
    return mapReferenceAsset(data as Record<string, unknown>);
  }

  // --- Private helpers ---

  private assertWorkspace(
    row: Record<string, unknown>,
    scope: WorkspaceScope,
    label: string,
  ): void {
    if (str(row.workspace_id) !== scope.workspaceId) {
      throw new PersonaDomainError(
        `${label} belongs to a different workspace`,
        "UNAUTHORIZED_WORKSPACE",
        { id: str(row.id), workspaceId: scope.workspaceId },
      );
    }
  }

  private async fetchRowById(
    table: string,
    id: string,
  ): Promise<Record<string, unknown> | null> {
    const { data, error } = await this.db
      .from(table)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    throwDb(error, `Failed to fetch ${table}: ${error?.message}`);
    return (data as Record<string, unknown> | null) ?? null;
  }

  private async requireRow(
    table: string,
    id: string,
    scope: WorkspaceScope,
    label: string,
  ): Promise<Record<string, unknown>> {
    const row = await this.fetchRowById(table, id);
    if (!row) {
      throw new PersonaDomainError(`${label} not found: ${id}`, "NOT_FOUND");
    }
    this.assertWorkspace(row, scope, label);
    return row;
  }

  private async loadPreferredIdsForPersona(personaId: string): Promise<PreferredIds> {
    const map = await this.loadPreferredIdsForPersonas([personaId]);
    return map.get(personaId) ?? { ...EMPTY_PREFERRED };
  }

  private async loadPreferredIdsForPersonas(
    personaIds: string[],
  ): Promise<Map<string, PreferredIds>> {
    const result = new Map<string, PreferredIds>();
    for (const id of personaIds) {
      result.set(id, {
        preferred_location_ids: [],
        preferred_camera_preset_ids: [],
        preferred_pose_ids: [],
        preferred_brand_look_ids: [],
        preferred_outfit_ids: [],
      });
    }
    if (personaIds.length === 0) return result;

    const kinds = Object.keys(RELATION_CONFIG) as PersonaRelationKind[];
    await Promise.all(
      kinds.map(async (kind) => {
        const config = RELATION_CONFIG[kind];
        const { data, error } = await this.db
          .from(config.junctionTable)
          .select("*")
          .in("persona_id", personaIds);
        throwDb(
          error,
          `Failed to load ${config.junctionTable}: ${error?.message}`,
        );
        for (const row of (data ?? []) as unknown as Record<string, unknown>[]) {
          const personaId = str(row.persona_id);
          const entry = result.get(personaId);
          if (!entry) continue;
          entry[config.preferredField].push(str(row[config.foreignKey]));
        }
      }),
    );

    return result;
  }

  private async replaceAllJunctions(
    personaId: string,
    preferred: PreferredIds,
  ): Promise<void> {
    await Promise.all([
      this.replaceJunction(personaId, "locations", preferred.preferred_location_ids),
      this.replaceJunction(
        personaId,
        "camera_presets",
        preferred.preferred_camera_preset_ids,
      ),
      this.replaceJunction(personaId, "poses", preferred.preferred_pose_ids),
      this.replaceJunction(
        personaId,
        "brand_looks",
        preferred.preferred_brand_look_ids,
      ),
      this.replaceJunction(personaId, "outfits", preferred.preferred_outfit_ids),
    ]);
  }

  private async replaceJunction(
    personaId: string,
    kind: PersonaRelationKind,
    ids: string[],
  ): Promise<void> {
    const config = RELATION_CONFIG[kind];
    const { error: deleteError } = await this.db
      .from(config.junctionTable)
      .delete()
      .eq("persona_id", personaId);
    throwDb(
      deleteError,
      `Failed to clear ${config.junctionTable}: ${deleteError?.message}`,
      "RELATIONSHIP_INTEGRITY",
    );

    if (ids.length === 0) return;

    const rows = ids.map((fid) => ({
      persona_id: personaId,
      [config.foreignKey]: fid,
    }));
    const { error: insertError } = await this.db
      .from(config.junctionTable)
      .insert(rows);
    throwDb(
      insertError,
      `Failed to insert ${config.junctionTable}: ${insertError?.message}`,
      "RELATIONSHIP_INTEGRITY",
    );
  }

  private async deleteJunctionByForeignKey(
    table: string,
    foreignKey: string,
    id: string,
  ): Promise<void> {
    const { error } = await this.db.from(table).delete().eq(foreignKey, id);
    throwDb(error, `Failed to remove junction rows from ${table}: ${error?.message}`);
  }

  private async countReferencingJunction(
    scope: WorkspaceScope,
    table: string,
    foreignKey: string,
    entityId: string,
  ): Promise<LibraryDeleteImpact> {
    const { data, error } = await this.db
      .from(table)
      .select("persona_id")
      .eq(foreignKey, entityId);
    throwDb(error, `Failed to count references in ${table}: ${error?.message}`);

    const personaIds = [
      ...new Set(
        ((data ?? []) as Record<string, unknown>[]).map((r) => str(r.persona_id)),
      ),
    ];
    if (personaIds.length === 0) {
      return { referencing_persona_ids: [], referencing_persona_count: 0 };
    }

    const { data: personas, error: personasError } = await this.db
      .from("persona_personas")
      .select("id")
      .eq("workspace_id", scope.workspaceId)
      .in("id", personaIds);
    throwDb(
      personasError,
      `Failed to filter referencing personas: ${personasError?.message}`,
    );

    const referencing_persona_ids = ((personas ?? []) as Record<string, unknown>[]).map(
      (r) => str(r.id),
    );
    return {
      referencing_persona_ids,
      referencing_persona_count: referencing_persona_ids.length,
    };
  }

  private async assertRelationIdsExist(
    scope: WorkspaceScope,
    preferred: PreferredIds,
  ): Promise<void> {
    const checks: Array<[string[], string, string]> = [
      [preferred.preferred_location_ids, "persona_locations", "location"],
      [
        preferred.preferred_camera_preset_ids,
        "persona_camera_presets",
        "camera preset",
      ],
      [preferred.preferred_pose_ids, "persona_poses", "pose"],
      [preferred.preferred_brand_look_ids, "persona_brand_looks", "brand look"],
      [preferred.preferred_outfit_ids, "persona_outfits", "outfit"],
    ];

    for (const [ids, table, label] of checks) {
      if (ids.length === 0) continue;
      const { data, error } = await this.db
        .from(table)
        .select("id")
        .eq("workspace_id", scope.workspaceId)
        .in("id", ids);
      throwDb(error, `Failed to validate ${label} ids: ${error?.message}`);
      const found = new Set(
        ((data ?? []) as Record<string, unknown>[]).map((r) => str(r.id)),
      );
      for (const id of ids) {
        if (!found.has(id)) {
          throw new PersonaDomainError(
            `Unknown ${label} id: ${id}`,
            "RELATIONSHIP_INTEGRITY",
            { id, label },
          );
        }
      }
    }
  }

  private async assertPrimaryReference(
    scope: WorkspaceScope,
    personaId: string,
    primaryId: string,
  ): Promise<void> {
    const row = await this.fetchRowById("persona_reference_assets", primaryId);
    if (!row) {
      throw new PersonaDomainError(
        `Unknown primary reference asset: ${primaryId}`,
        "RELATIONSHIP_INTEGRITY",
      );
    }
    this.assertWorkspace(row, scope, "Reference asset");
    if (str(row.persona_id) !== personaId) {
      throw new PersonaDomainError(
        "Primary reference asset must belong to this persona",
        "RELATIONSHIP_INTEGRITY",
      );
    }
  }
}
