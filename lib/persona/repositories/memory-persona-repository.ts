/**
 * In-memory PersonaRepository — tests only. Production always uses Supabase.
 */

import { randomUUID } from "node:crypto";
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

const EMPTY_SNAPSHOT: PersonaStudioSnapshot = {
  personas: [],
  locations: [],
  camera_presets: [],
  poses: [],
  brand_looks: [],
  outfits: [],
  reference_assets: [],
};

function cloneSnapshot(seed: PersonaStudioSnapshot): PersonaStudioSnapshot {
  return structuredClone(seed);
}

function nowIso(): string {
  return new Date().toISOString();
}

function relationField(
  kind: PersonaRelationKind,
): keyof Pick<
  Persona,
  | "preferred_location_ids"
  | "preferred_camera_preset_ids"
  | "preferred_pose_ids"
  | "preferred_brand_look_ids"
  | "preferred_outfit_ids"
> {
  switch (kind) {
    case "locations":
      return "preferred_location_ids";
    case "camera_presets":
      return "preferred_camera_preset_ids";
    case "poses":
      return "preferred_pose_ids";
    case "brand_looks":
      return "preferred_brand_look_ids";
    case "outfits":
      return "preferred_outfit_ids";
  }
}

type WorkspaceEntity = { id: string; workspace_id: string };

export class MemoryPersonaRepository implements PersonaRepository {
  readonly kind = "memory" as const;

  private data: PersonaStudioSnapshot;

  constructor(seed?: PersonaStudioSnapshot) {
    this.data = cloneSnapshot(seed ?? EMPTY_SNAPSHOT);
  }

  /** Replace store contents — for tests. Defaults to empty (no demo seed). */
  reset(seed?: PersonaStudioSnapshot): void {
    this.data = cloneSnapshot(seed ?? EMPTY_SNAPSHOT);
  }

  async snapshot(scope: WorkspaceScope): Promise<PersonaStudioSnapshot> {
    const ws = scope.workspaceId;
    return cloneSnapshot({
      personas: this.data.personas.filter((p) => p.workspace_id === ws),
      locations: this.data.locations.filter((l) => l.workspace_id === ws),
      camera_presets: this.data.camera_presets.filter((c) => c.workspace_id === ws),
      poses: this.data.poses.filter((p) => p.workspace_id === ws),
      brand_looks: this.data.brand_looks.filter((b) => b.workspace_id === ws),
      outfits: this.data.outfits.filter((o) => o.workspace_id === ws),
      reference_assets: this.data.reference_assets.filter((a) => a.workspace_id === ws),
    });
  }

  async dashboardCounts(scope: WorkspaceScope): Promise<PersonaStudioDashboardCounts> {
    const snap = await this.snapshot(scope);
    let image_ready_personas = 0;
    let video_ready_personas = 0;

    for (const persona of snap.personas) {
      const assets = snap.reference_assets.filter((a) => a.persona_id === persona.id);
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
    return this.data.personas
      .filter((p) => p.workspace_id === scope.workspaceId)
      .map((p) => structuredClone(p));
  }

  async getPersona(scope: WorkspaceScope, id: string): Promise<Persona | null> {
    const persona = this.data.personas.find((p) => p.id === id);
    if (!persona) return null;
    this.assertWorkspace(persona, scope, "Persona");
    return structuredClone(persona);
  }

  async createPersona(scope: WorkspaceScope, input: CreatePersonaInput): Promise<Persona> {
    const created_at = nowIso();
    const status = input.status ?? "Draft";
    const persona: Persona = {
      id: randomUUID(),
      workspace_id: scope.workspaceId,
      name: input.name ?? "",
      role: input.role ?? "",
      status,
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
      approved: status === "Approved",
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
      preferred_location_ids: [...new Set(input.preferred_location_ids ?? [])],
      preferred_camera_preset_ids: [...new Set(input.preferred_camera_preset_ids ?? [])],
      preferred_pose_ids: [...new Set(input.preferred_pose_ids ?? [])],
      preferred_brand_look_ids: [...new Set(input.preferred_brand_look_ids ?? [])],
      preferred_outfit_ids: [...new Set(input.preferred_outfit_ids ?? [])],
      created_by: input.created_by ?? scope.actorId ?? null,
      created_at,
      updated_at: created_at,
    };

    if (!persona.name.trim()) {
      throw new PersonaDomainError("Persona name is required", "VALIDATION");
    }

    this.assertRelationIds(scope, persona);
    this.assertPrimaryReference(scope, persona);
    this.data.personas.push(persona);
    return structuredClone(persona);
  }

  async updatePersona(
    scope: WorkspaceScope,
    id: string,
    patch: UpdatePersonaInput,
  ): Promise<Persona> {
    const index = this.requireIndex(this.data.personas, id, scope, "Persona");
    const current = this.data.personas[index];
    const nextStatus = patch.status ?? current.status;

    const next: Persona = {
      ...current,
      ...patch,
      id: current.id,
      workspace_id: current.workspace_id,
      created_at: current.created_at,
      updated_at: nowIso(),
      status: nextStatus,
      approved: nextStatus === "Approved",
      preferred_location_ids: patch.preferred_location_ids
        ? [...new Set(patch.preferred_location_ids)]
        : current.preferred_location_ids,
      preferred_camera_preset_ids: patch.preferred_camera_preset_ids
        ? [...new Set(patch.preferred_camera_preset_ids)]
        : current.preferred_camera_preset_ids,
      preferred_pose_ids: patch.preferred_pose_ids
        ? [...new Set(patch.preferred_pose_ids)]
        : current.preferred_pose_ids,
      preferred_brand_look_ids: patch.preferred_brand_look_ids
        ? [...new Set(patch.preferred_brand_look_ids)]
        : current.preferred_brand_look_ids,
      preferred_outfit_ids: patch.preferred_outfit_ids
        ? [...new Set(patch.preferred_outfit_ids)]
        : current.preferred_outfit_ids,
    };

    this.assertRelationIds(scope, next);
    this.assertPrimaryReference(scope, next);
    this.data.personas[index] = next;
    return structuredClone(next);
  }

  async deletePersona(scope: WorkspaceScope, id: string): Promise<void> {
    this.requireIndex(this.data.personas, id, scope, "Persona");
    this.data.personas = this.data.personas.filter((p) => p.id !== id);
    this.data.reference_assets = this.data.reference_assets.filter(
      (a) => a.persona_id !== id,
    );
  }

  async setPersonaRelations(
    scope: WorkspaceScope,
    personaId: string,
    kind: PersonaRelationKind,
    ids: string[],
  ): Promise<Persona> {
    const field = relationField(kind);
    return this.updatePersona(scope, personaId, { [field]: [...new Set(ids)] });
  }

  // --- Locations ---

  async listLocations(scope: WorkspaceScope): Promise<Location[]> {
    return this.data.locations
      .filter((l) => l.workspace_id === scope.workspaceId)
      .map((l) => structuredClone(l));
  }

  async getLocation(scope: WorkspaceScope, id: string): Promise<Location | null> {
    const row = this.data.locations.find((l) => l.id === id);
    if (!row) return null;
    this.assertWorkspace(row, scope, "Location");
    return structuredClone(row);
  }

  async createLocation(
    scope: WorkspaceScope,
    input: CreateLocationInput,
  ): Promise<Location> {
    const created_at = nowIso();
    const location: Location = {
      id: randomUUID(),
      workspace_id: scope.workspaceId,
      name: input.name ?? "",
      category: input.category ?? "",
      setting: input.setting,
      description: input.description ?? "",
      tags: input.tags ?? [],
      active: input.active ?? true,
      created_by: input.created_by ?? scope.actorId ?? null,
      created_at,
      updated_at: created_at,
    };
    if (!location.name.trim()) {
      throw new PersonaDomainError("Location name is required", "VALIDATION");
    }
    this.data.locations.push(location);
    return structuredClone(location);
  }

  async updateLocation(
    scope: WorkspaceScope,
    id: string,
    patch: UpdateLocationInput,
  ): Promise<Location> {
    const index = this.requireIndex(this.data.locations, id, scope, "Location");
    const next = {
      ...this.data.locations[index],
      ...patch,
      id,
      workspace_id: this.data.locations[index].workspace_id,
      updated_at: nowIso(),
    };
    this.data.locations[index] = next;
    return structuredClone(next);
  }

  async deleteLocation(scope: WorkspaceScope, id: string): Promise<void> {
    this.requireIndex(this.data.locations, id, scope, "Location");
    this.data.locations = this.data.locations.filter((l) => l.id !== id);
    this.stripRelationId("preferred_location_ids", id);
  }

  async countPersonasReferencingLocation(
    scope: WorkspaceScope,
    locationId: string,
  ): Promise<LibraryDeleteImpact> {
    this.requireEntity(this.data.locations, locationId, scope, "Location");
    return this.countReferencing(scope, "preferred_location_ids", locationId);
  }

  // --- Camera presets ---

  async listCameraPresets(scope: WorkspaceScope): Promise<CameraPreset[]> {
    return this.data.camera_presets
      .filter((c) => c.workspace_id === scope.workspaceId)
      .map((c) => structuredClone(c));
  }

  async getCameraPreset(
    scope: WorkspaceScope,
    id: string,
  ): Promise<CameraPreset | null> {
    const row = this.data.camera_presets.find((c) => c.id === id);
    if (!row) return null;
    this.assertWorkspace(row, scope, "Camera preset");
    return structuredClone(row);
  }

  async createCameraPreset(
    scope: WorkspaceScope,
    input: CreateCameraPresetInput,
  ): Promise<CameraPreset> {
    const created_at = nowIso();
    const preset: CameraPreset = {
      id: randomUUID(),
      workspace_id: scope.workspaceId,
      name: input.name ?? "",
      focal_length: input.focal_length ?? "",
      framing: input.framing ?? "",
      lighting_style: input.lighting_style ?? "",
      color_grade: input.color_grade ?? "",
      notes: input.notes ?? "",
      created_by: input.created_by ?? scope.actorId ?? null,
      created_at,
      updated_at: created_at,
    };
    if (!preset.name.trim()) {
      throw new PersonaDomainError("Camera preset name is required", "VALIDATION");
    }
    this.data.camera_presets.push(preset);
    return structuredClone(preset);
  }

  async updateCameraPreset(
    scope: WorkspaceScope,
    id: string,
    patch: UpdateCameraPresetInput,
  ): Promise<CameraPreset> {
    const index = this.requireIndex(
      this.data.camera_presets,
      id,
      scope,
      "Camera preset",
    );
    const next = {
      ...this.data.camera_presets[index],
      ...patch,
      id,
      workspace_id: this.data.camera_presets[index].workspace_id,
      updated_at: nowIso(),
    };
    this.data.camera_presets[index] = next;
    return structuredClone(next);
  }

  async deleteCameraPreset(scope: WorkspaceScope, id: string): Promise<void> {
    this.requireIndex(this.data.camera_presets, id, scope, "Camera preset");
    this.data.camera_presets = this.data.camera_presets.filter((c) => c.id !== id);
    this.stripRelationId("preferred_camera_preset_ids", id);
  }

  async countPersonasReferencingCameraPreset(
    scope: WorkspaceScope,
    cameraPresetId: string,
  ): Promise<LibraryDeleteImpact> {
    this.requireEntity(
      this.data.camera_presets,
      cameraPresetId,
      scope,
      "Camera preset",
    );
    return this.countReferencing(
      scope,
      "preferred_camera_preset_ids",
      cameraPresetId,
    );
  }

  // --- Poses ---

  async listPoses(scope: WorkspaceScope): Promise<Pose[]> {
    return this.data.poses
      .filter((p) => p.workspace_id === scope.workspaceId)
      .map((p) => structuredClone(p));
  }

  async getPose(scope: WorkspaceScope, id: string): Promise<Pose | null> {
    const row = this.data.poses.find((p) => p.id === id);
    if (!row) return null;
    this.assertWorkspace(row, scope, "Pose");
    return structuredClone(row);
  }

  async createPose(scope: WorkspaceScope, input: CreatePoseInput): Promise<Pose> {
    const created_at = nowIso();
    const pose: Pose = {
      id: randomUUID(),
      workspace_id: scope.workspaceId,
      name: input.name ?? "",
      category: input.category ?? "",
      description: input.description ?? "",
      body_direction: input.body_direction ?? "",
      suitable_products: input.suitable_products ?? [],
      active: input.active ?? true,
      created_by: input.created_by ?? scope.actorId ?? null,
      created_at,
      updated_at: created_at,
    };
    if (!pose.name.trim()) {
      throw new PersonaDomainError("Pose name is required", "VALIDATION");
    }
    this.data.poses.push(pose);
    return structuredClone(pose);
  }

  async updatePose(
    scope: WorkspaceScope,
    id: string,
    patch: UpdatePoseInput,
  ): Promise<Pose> {
    const index = this.requireIndex(this.data.poses, id, scope, "Pose");
    const next = {
      ...this.data.poses[index],
      ...patch,
      id,
      workspace_id: this.data.poses[index].workspace_id,
      updated_at: nowIso(),
    };
    this.data.poses[index] = next;
    return structuredClone(next);
  }

  async deletePose(scope: WorkspaceScope, id: string): Promise<void> {
    this.requireIndex(this.data.poses, id, scope, "Pose");
    this.data.poses = this.data.poses.filter((p) => p.id !== id);
    this.stripRelationId("preferred_pose_ids", id);
  }

  async countPersonasReferencingPose(
    scope: WorkspaceScope,
    poseId: string,
  ): Promise<LibraryDeleteImpact> {
    this.requireEntity(this.data.poses, poseId, scope, "Pose");
    return this.countReferencing(scope, "preferred_pose_ids", poseId);
  }

  // --- Brand looks ---

  async listBrandLooks(scope: WorkspaceScope): Promise<BrandLook[]> {
    return this.data.brand_looks
      .filter((b) => b.workspace_id === scope.workspaceId)
      .map((b) => structuredClone(b));
  }

  async getBrandLook(scope: WorkspaceScope, id: string): Promise<BrandLook | null> {
    const row = this.data.brand_looks.find((b) => b.id === id);
    if (!row) return null;
    this.assertWorkspace(row, scope, "Brand look");
    return structuredClone(row);
  }

  async createBrandLook(
    scope: WorkspaceScope,
    input: CreateBrandLookInput,
  ): Promise<BrandLook> {
    const created_at = nowIso();
    const look: BrandLook = {
      id: randomUUID(),
      workspace_id: scope.workspaceId,
      name: input.name ?? "",
      description: input.description ?? "",
      mood: input.mood ?? "",
      color_style: input.color_style ?? "",
      styling_notes: input.styling_notes ?? "",
      created_by: input.created_by ?? scope.actorId ?? null,
      created_at,
      updated_at: created_at,
    };
    if (!look.name.trim()) {
      throw new PersonaDomainError("Brand look name is required", "VALIDATION");
    }
    this.data.brand_looks.push(look);
    return structuredClone(look);
  }

  async updateBrandLook(
    scope: WorkspaceScope,
    id: string,
    patch: UpdateBrandLookInput,
  ): Promise<BrandLook> {
    const index = this.requireIndex(this.data.brand_looks, id, scope, "Brand look");
    const next = {
      ...this.data.brand_looks[index],
      ...patch,
      id,
      workspace_id: this.data.brand_looks[index].workspace_id,
      updated_at: nowIso(),
    };
    this.data.brand_looks[index] = next;
    return structuredClone(next);
  }

  async deleteBrandLook(scope: WorkspaceScope, id: string): Promise<void> {
    this.requireIndex(this.data.brand_looks, id, scope, "Brand look");
    this.data.brand_looks = this.data.brand_looks.filter((b) => b.id !== id);
    this.stripRelationId("preferred_brand_look_ids", id);
  }

  async countPersonasReferencingBrandLook(
    scope: WorkspaceScope,
    brandLookId: string,
  ): Promise<LibraryDeleteImpact> {
    this.requireEntity(this.data.brand_looks, brandLookId, scope, "Brand look");
    return this.countReferencing(scope, "preferred_brand_look_ids", brandLookId);
  }

  // --- Outfits ---

  async listOutfits(scope: WorkspaceScope): Promise<Outfit[]> {
    return this.data.outfits
      .filter((o) => o.workspace_id === scope.workspaceId)
      .map((o) => structuredClone(o));
  }

  async getOutfit(scope: WorkspaceScope, id: string): Promise<Outfit | null> {
    const row = this.data.outfits.find((o) => o.id === id);
    if (!row) return null;
    this.assertWorkspace(row, scope, "Outfit");
    return structuredClone(row);
  }

  async createOutfit(
    scope: WorkspaceScope,
    input: CreateOutfitInput,
  ): Promise<Outfit> {
    const created_at = nowIso();
    const outfit: Outfit = {
      id: randomUUID(),
      workspace_id: scope.workspaceId,
      name: input.name ?? "",
      description: input.description ?? "",
      items: input.items ?? [],
      tags: input.tags ?? [],
      active: input.active ?? true,
      created_by: input.created_by ?? scope.actorId ?? null,
      created_at,
      updated_at: created_at,
    };
    if (!outfit.name.trim()) {
      throw new PersonaDomainError("Outfit name is required", "VALIDATION");
    }
    this.data.outfits.push(outfit);
    return structuredClone(outfit);
  }

  async updateOutfit(
    scope: WorkspaceScope,
    id: string,
    patch: UpdateOutfitInput,
  ): Promise<Outfit> {
    const index = this.requireIndex(this.data.outfits, id, scope, "Outfit");
    const next = {
      ...this.data.outfits[index],
      ...patch,
      id,
      workspace_id: this.data.outfits[index].workspace_id,
      updated_at: nowIso(),
    };
    this.data.outfits[index] = next;
    return structuredClone(next);
  }

  async deleteOutfit(scope: WorkspaceScope, id: string): Promise<void> {
    this.requireIndex(this.data.outfits, id, scope, "Outfit");
    this.data.outfits = this.data.outfits.filter((o) => o.id !== id);
    this.stripRelationId("preferred_outfit_ids", id);
  }

  async countPersonasReferencingOutfit(
    scope: WorkspaceScope,
    outfitId: string,
  ): Promise<LibraryDeleteImpact> {
    this.requireEntity(this.data.outfits, outfitId, scope, "Outfit");
    return this.countReferencing(scope, "preferred_outfit_ids", outfitId);
  }

  // --- Reference assets ---

  async listReferenceAssets(
    scope: WorkspaceScope,
    personaId: string,
  ): Promise<PersonaReferenceAsset[]> {
    this.requireEntity(this.data.personas, personaId, scope, "Persona");
    return this.data.reference_assets
      .filter(
        (a) => a.workspace_id === scope.workspaceId && a.persona_id === personaId,
      )
      .map((a) => structuredClone(a));
  }

  async getReferenceAsset(
    scope: WorkspaceScope,
    id: string,
  ): Promise<PersonaReferenceAsset | null> {
    const row = this.data.reference_assets.find((a) => a.id === id);
    if (!row) return null;
    this.assertWorkspace(row, scope, "Reference asset");
    return structuredClone(row);
  }

  async createReferenceAsset(
    scope: WorkspaceScope,
    input: CreateReferenceAssetInput,
  ): Promise<PersonaReferenceAsset> {
    this.requireEntity(this.data.personas, input.persona_id, scope, "Persona");
    const created_at = nowIso();
    const asset: PersonaReferenceAsset = {
      id: randomUUID(),
      workspace_id: scope.workspaceId,
      persona_id: input.persona_id,
      asset_type: input.asset_type,
      storage_path: input.storage_path ?? "",
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
      created_at,
      updated_at: created_at,
    };
    if (!asset.storage_path.trim()) {
      throw new PersonaDomainError("storage_path is required", "VALIDATION");
    }
    this.data.reference_assets.push(asset);
    return structuredClone(asset);
  }

  async updateReferenceAsset(
    scope: WorkspaceScope,
    id: string,
    patch: UpdateReferenceAssetInput,
  ): Promise<PersonaReferenceAsset> {
    const index = this.requireIndex(
      this.data.reference_assets,
      id,
      scope,
      "Reference asset",
    );
    const current = this.data.reference_assets[index];
    const next: PersonaReferenceAsset = {
      ...current,
      ...patch,
      id: current.id,
      workspace_id: current.workspace_id,
      persona_id: current.persona_id,
      storage_path: current.storage_path,
      created_at: current.created_at,
      updated_at: nowIso(),
    };
    this.data.reference_assets[index] = next;
    return structuredClone(next);
  }

  async deleteReferenceAsset(scope: WorkspaceScope, id: string): Promise<void> {
    this.requireIndex(this.data.reference_assets, id, scope, "Reference asset");
    this.data.reference_assets = this.data.reference_assets.filter((a) => a.id !== id);
    for (const persona of this.data.personas) {
      if (persona.primary_reference_asset_id === id) {
        persona.primary_reference_asset_id = null;
        persona.updated_at = nowIso();
      }
    }
  }

  async findReferenceByChecksum(
    scope: WorkspaceScope,
    personaId: string,
    checksum: string,
  ): Promise<PersonaReferenceAsset | null> {
    if (!checksum) return null;
    const row = this.data.reference_assets.find(
      (a) =>
        a.workspace_id === scope.workspaceId &&
        a.persona_id === personaId &&
        a.checksum === checksum,
    );
    return row ? structuredClone(row) : null;
  }

  // --- Helpers ---

  private assertWorkspace(
    entity: WorkspaceEntity,
    scope: WorkspaceScope,
    label: string,
  ): void {
    if (entity.workspace_id !== scope.workspaceId) {
      throw new PersonaDomainError(
        `${label} belongs to a different workspace`,
        "UNAUTHORIZED_WORKSPACE",
        { id: entity.id, workspaceId: scope.workspaceId },
      );
    }
  }

  private requireEntity<T extends WorkspaceEntity>(
    collection: T[],
    id: string,
    scope: WorkspaceScope,
    label: string,
  ): T {
    const entity = collection.find((e) => e.id === id);
    if (!entity) {
      throw new PersonaDomainError(`${label} not found: ${id}`, "NOT_FOUND");
    }
    this.assertWorkspace(entity, scope, label);
    return entity;
  }

  private requireIndex<T extends WorkspaceEntity>(
    collection: T[],
    id: string,
    scope: WorkspaceScope,
    label: string,
  ): number {
    this.requireEntity(collection, id, scope, label);
    return collection.findIndex((e) => e.id === id);
  }

  private countReferencing(
    scope: WorkspaceScope,
    field:
      | "preferred_location_ids"
      | "preferred_camera_preset_ids"
      | "preferred_pose_ids"
      | "preferred_brand_look_ids"
      | "preferred_outfit_ids",
    entityId: string,
  ): LibraryDeleteImpact {
    const referencing_persona_ids = this.data.personas
      .filter(
        (p) =>
          p.workspace_id === scope.workspaceId && p[field].includes(entityId),
      )
      .map((p) => p.id);
    return {
      referencing_persona_ids,
      referencing_persona_count: referencing_persona_ids.length,
    };
  }

  private stripRelationId(
    field:
      | "preferred_location_ids"
      | "preferred_camera_preset_ids"
      | "preferred_pose_ids"
      | "preferred_brand_look_ids"
      | "preferred_outfit_ids",
    id: string,
  ): void {
    for (const persona of this.data.personas) {
      persona[field] = persona[field].filter((ref) => ref !== id);
    }
  }

  private assertRelationIds(scope: WorkspaceScope, persona: Persona): void {
    const checks: Array<[string[], string, (id: string) => boolean]> = [
      [
        persona.preferred_location_ids,
        "location",
        (id) =>
          this.data.locations.some(
            (l) => l.id === id && l.workspace_id === scope.workspaceId,
          ),
      ],
      [
        persona.preferred_camera_preset_ids,
        "camera preset",
        (id) =>
          this.data.camera_presets.some(
            (c) => c.id === id && c.workspace_id === scope.workspaceId,
          ),
      ],
      [
        persona.preferred_pose_ids,
        "pose",
        (id) =>
          this.data.poses.some(
            (p) => p.id === id && p.workspace_id === scope.workspaceId,
          ),
      ],
      [
        persona.preferred_brand_look_ids,
        "brand look",
        (id) =>
          this.data.brand_looks.some(
            (b) => b.id === id && b.workspace_id === scope.workspaceId,
          ),
      ],
      [
        persona.preferred_outfit_ids,
        "outfit",
        (id) =>
          this.data.outfits.some(
            (o) => o.id === id && o.workspace_id === scope.workspaceId,
          ),
      ],
    ];

    for (const [ids, label, exists] of checks) {
      for (const id of ids) {
        if (!exists(id)) {
          throw new PersonaDomainError(
            `Unknown ${label} id: ${id}`,
            "RELATIONSHIP_INTEGRITY",
            { id, label },
          );
        }
      }
    }
  }

  private assertPrimaryReference(scope: WorkspaceScope, persona: Persona): void {
    const primaryId = persona.primary_reference_asset_id;
    if (!primaryId) return;
    const asset = this.data.reference_assets.find((a) => a.id === primaryId);
    if (!asset) {
      throw new PersonaDomainError(
        `Unknown primary reference asset: ${primaryId}`,
        "RELATIONSHIP_INTEGRITY",
      );
    }
    if (asset.workspace_id !== scope.workspaceId) {
      throw new PersonaDomainError(
        "Primary reference asset belongs to a different workspace",
        "UNAUTHORIZED_WORKSPACE",
      );
    }
    if (asset.persona_id !== persona.id) {
      throw new PersonaDomainError(
        "Primary reference asset must belong to this persona",
        "RELATIONSHIP_INTEGRITY",
      );
    }
  }
}
