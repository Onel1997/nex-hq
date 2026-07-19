export type * from "./domain/types";
export {
  PERSONA_STATUSES,
  LOCATION_SETTINGS,
  REFERENCE_ASSET_TYPES,
  REFERENCE_STATUSES,
  VIEW_ANGLES,
  FRAMINGS,
  SOURCE_TYPES,
  PERSONA_READINESS_STATES,
} from "./domain/types";

export {
  PersonaDomainError,
  PersonaStoreError,
  PersonaWorkflowError,
} from "./domain/errors";

export {
  canApprovePersona,
  computePersonaReadiness,
  computeReferenceCompleteness,
  listApprovalPrerequisiteGaps,
  isProfileComplete,
} from "./domain/readiness";

export {
  PERSONA_STATUS_TRANSITIONS,
  applyPersonaStatus,
  approvePersona,
  archivePersona,
  canTransitionPersonaStatus,
  isApprovedForProduction,
  reopenPersonaAsDraft,
  submitPersonaForReview,
} from "./approval/workflow";

export {
  createProductionPersonaRepository,
  getPersonaRepository,
  getPersonaRepositoryKind,
  setPersonaRepositoryForTests,
} from "./repositories/factory";
export { MemoryPersonaRepository } from "./repositories/memory-persona-repository";
export { SupabasePersonaRepository } from "./repositories/supabase-persona-repository";
export type { PersonaRepository } from "./repositories/persona-repository";

export * from "./services/persona-service";
export { resolvePersonaWorkspaceScope } from "./services/workspace-scope";
export {
  checkPersonaStudioHealth,
  PERSONA_SCHEMA_VERSION,
  type PersonaHealthReport,
  type PersonaHealthStatus,
} from "./services/health";

export {
  PERSONA_REFERENCES_BUCKET,
  PERSONA_REFERENCE_ALLOWED_MIME,
  PERSONA_REFERENCE_MAX_BYTES,
  assertAllowedPersonaReferenceUpload,
  buildPersonaReferenceStoragePath,
  checksumBytes,
  createPersonaReferenceSignedUrl,
  extractImageDimensions,
  isPublicPermanentPersonaUrl,
} from "./storage/reference-storage";

export {
  buildImageStudioPersonaHandoff,
  listImageStudioIntegrationHooks,
  type ImageStudioPersonaHandoff,
} from "./future/image-studio-hooks";

export {
  buildVideoStudioPersonaHandoff,
  listVideoStudioIntegrationHooks,
  type VideoStudioPersonaHandoff,
} from "./future/video-studio-hooks";

/** @deprecated Demo seed is tests/dev only — never used in production repository. */
export { PERSONA_DEMO_SEED, PERSONA_TEST_WORKSPACE_ID } from "./demo-seed";
