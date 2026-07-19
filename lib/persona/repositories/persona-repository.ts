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

/**
 * Repository abstraction — domain logic must not depend on Supabase directly.
 * Production: SupabasePersonaRepository
 * Tests only: MemoryPersonaRepository
 */
export interface PersonaRepository {
  readonly kind: "supabase" | "memory";

  snapshot(scope: WorkspaceScope): Promise<PersonaStudioSnapshot>;
  dashboardCounts(scope: WorkspaceScope): Promise<PersonaStudioDashboardCounts>;

  listPersonas(scope: WorkspaceScope): Promise<Persona[]>;
  getPersona(scope: WorkspaceScope, id: string): Promise<Persona | null>;
  createPersona(scope: WorkspaceScope, input: CreatePersonaInput): Promise<Persona>;
  updatePersona(
    scope: WorkspaceScope,
    id: string,
    patch: UpdatePersonaInput,
  ): Promise<Persona>;
  deletePersona(scope: WorkspaceScope, id: string): Promise<void>;
  setPersonaRelations(
    scope: WorkspaceScope,
    personaId: string,
    kind: PersonaRelationKind,
    ids: string[],
  ): Promise<Persona>;

  listLocations(scope: WorkspaceScope): Promise<Location[]>;
  getLocation(scope: WorkspaceScope, id: string): Promise<Location | null>;
  createLocation(scope: WorkspaceScope, input: CreateLocationInput): Promise<Location>;
  updateLocation(
    scope: WorkspaceScope,
    id: string,
    patch: UpdateLocationInput,
  ): Promise<Location>;
  deleteLocation(scope: WorkspaceScope, id: string): Promise<void>;
  countPersonasReferencingLocation(
    scope: WorkspaceScope,
    locationId: string,
  ): Promise<LibraryDeleteImpact>;

  listCameraPresets(scope: WorkspaceScope): Promise<CameraPreset[]>;
  getCameraPreset(scope: WorkspaceScope, id: string): Promise<CameraPreset | null>;
  createCameraPreset(
    scope: WorkspaceScope,
    input: CreateCameraPresetInput,
  ): Promise<CameraPreset>;
  updateCameraPreset(
    scope: WorkspaceScope,
    id: string,
    patch: UpdateCameraPresetInput,
  ): Promise<CameraPreset>;
  deleteCameraPreset(scope: WorkspaceScope, id: string): Promise<void>;
  countPersonasReferencingCameraPreset(
    scope: WorkspaceScope,
    cameraPresetId: string,
  ): Promise<LibraryDeleteImpact>;

  listPoses(scope: WorkspaceScope): Promise<Pose[]>;
  getPose(scope: WorkspaceScope, id: string): Promise<Pose | null>;
  createPose(scope: WorkspaceScope, input: CreatePoseInput): Promise<Pose>;
  updatePose(scope: WorkspaceScope, id: string, patch: UpdatePoseInput): Promise<Pose>;
  deletePose(scope: WorkspaceScope, id: string): Promise<void>;
  countPersonasReferencingPose(
    scope: WorkspaceScope,
    poseId: string,
  ): Promise<LibraryDeleteImpact>;

  listBrandLooks(scope: WorkspaceScope): Promise<BrandLook[]>;
  getBrandLook(scope: WorkspaceScope, id: string): Promise<BrandLook | null>;
  createBrandLook(
    scope: WorkspaceScope,
    input: CreateBrandLookInput,
  ): Promise<BrandLook>;
  updateBrandLook(
    scope: WorkspaceScope,
    id: string,
    patch: UpdateBrandLookInput,
  ): Promise<BrandLook>;
  deleteBrandLook(scope: WorkspaceScope, id: string): Promise<void>;
  countPersonasReferencingBrandLook(
    scope: WorkspaceScope,
    brandLookId: string,
  ): Promise<LibraryDeleteImpact>;

  listOutfits(scope: WorkspaceScope): Promise<Outfit[]>;
  getOutfit(scope: WorkspaceScope, id: string): Promise<Outfit | null>;
  createOutfit(scope: WorkspaceScope, input: CreateOutfitInput): Promise<Outfit>;
  updateOutfit(
    scope: WorkspaceScope,
    id: string,
    patch: UpdateOutfitInput,
  ): Promise<Outfit>;
  deleteOutfit(scope: WorkspaceScope, id: string): Promise<void>;
  countPersonasReferencingOutfit(
    scope: WorkspaceScope,
    outfitId: string,
  ): Promise<LibraryDeleteImpact>;

  listReferenceAssets(
    scope: WorkspaceScope,
    personaId: string,
  ): Promise<PersonaReferenceAsset[]>;
  getReferenceAsset(
    scope: WorkspaceScope,
    id: string,
  ): Promise<PersonaReferenceAsset | null>;
  createReferenceAsset(
    scope: WorkspaceScope,
    input: CreateReferenceAssetInput,
  ): Promise<PersonaReferenceAsset>;
  updateReferenceAsset(
    scope: WorkspaceScope,
    id: string,
    patch: UpdateReferenceAssetInput,
  ): Promise<PersonaReferenceAsset>;
  deleteReferenceAsset(scope: WorkspaceScope, id: string): Promise<void>;
  findReferenceByChecksum(
    scope: WorkspaceScope,
    personaId: string,
    checksum: string,
  ): Promise<PersonaReferenceAsset | null>;
}
