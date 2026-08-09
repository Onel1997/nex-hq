export {
  assertSlotMayBeRegenerated,
  resolveReferencePackageSlotCoverage,
  resolveSlotDisplayStatus,
  isCurrentlyAcceptedUsable,
  isIdentityDecisionEligibleForHumanApproval,
  slotsNeedingGenerationFromCoverage,
} from "./coverage";
export type { SlotCoverageResolution } from "./coverage";

export {
  CAMERA_DIRECTION_POLICY_VERSION,
  CANONICAL_CAMERA_DIRECTIONS,
  getCanonicalCameraDirection,
} from "./camera-direction";

export {
  validateAngleDirectionFromPrompt,
  validateAngleDirectionFromOrientation,
  isAngleDirectionUsable,
  ANGLE_DIRECTIONS,
  ANGLE_IMAGE_VALIDATION_VERSION,
} from "./angle-direction";
export type { AngleDirection, AngleDirectionValidation } from "./angle-direction";

export {
  estimateOrientationFromLandmarks,
  buildSyntheticLandmarks68,
  DETECTED_ORIENTATIONS,
} from "./orientation-from-landmarks";
export type {
  DetectedOrientation,
  LandmarkPoint,
  OrientationEstimate,
} from "./orientation-from-landmarks";

export {
  invertProviderDirection,
  oppositeOrientationsForSlot,
  isOppositeOrientationFailure,
  resolveProviderDirectionPlan,
  validatedAttemptsForCanonicalSlot,
  DIRECTION_FALLBACK_POLICY_VERSION,
  MAX_CANONICAL_DIRECTION_ATTEMPTS,
  MAX_INVERTED_FALLBACK_ATTEMPTS,
  DIRECTION_GENERATION_UNRELIABLE_MESSAGE,
  INVERTED_FALLBACK_REASON,
  PROVIDER_DIRECTION_STRATEGIES,
} from "./provider-direction-fallback";
export type {
  ProviderDirectionStrategy,
  ProviderRequestedDirection,
  ProviderDirectionPlan,
} from "./provider-direction-fallback";

export {
  REFERENCE_PACKAGE_SLOTS,
  REFERENCE_PACKAGE_SLOT_LABELS,
  REFERENCE_PACKAGE_ATTEMPT_STATUSES,
  isReferencePackageSlot,
  slotToReferenceMeta,
} from "./slots";
export type {
  ReferencePackageSlot,
  ReferencePackageAttemptStatus,
} from "./slots";

export {
  IDENTITY_CONSISTENCY_POLICY_VERSION,
  IDENTITY_CONSISTENCY_DECISIONS,
  IDENTITY_CONSISTENCY_MATCH_EUCLIDEAN,
  IDENTITY_CONSISTENCY_WARNING_EUCLIDEAN,
  evaluateIdentityConsistency,
  isIdentityAcceptedForPackage,
} from "./identity-consistency";
export type {
  IdentityConsistencyDecision,
  IdentityConsistencyEvaluation,
} from "./identity-consistency";

export {
  estimateReferencePackageCost,
  prepareReferencePackageConfirmation,
  confirmAndGenerateReferencePackage,
  getReferencePackageStatus,
  prepareReferencePackageAngleRegeneration,
  confirmAndRegenerateReferencePackageAngle,
  recomputeReferencePackageAngleValidation,
  isReferencePackageReadyFromAttempts,
  STAGE_B_REFERENCE_PACKAGE_CAPABILITY,
} from "./service";
export type { ReferencePackageCostEstimate, ReferencePackageDeps } from "./service";

export {
  reassignReferencePackageAngle,
  TARGET_SLOT_ACCEPTED_MESSAGE,
} from "./reassign";

export {
  MemoryReferencePackageRepository,
  getReferencePackageRepository,
  setReferencePackageRepositoryForTests,
} from "./repository";
export type { ReferencePackageRepository } from "./repository";

export type {
  ReferencePackageSession,
  ReferencePackageAttempt,
  ReferencePackageStatusView,
  ReferencePackageSlotView,
  ReferencePackageAssetNotesMeta,
} from "./types";
export {
  REF_PKG_NOTES_PREFIX,
  buildReferencePackageAssetNotes,
  parseReferencePackageAssetNotes,
  getAttemptEffectiveSlot,
} from "./types";

export { buildReferencePackageAnglePrompt, buildReferencePackageAnglePromptDetailed } from "./prompts";

export {
  PROFILE_IDENTITY_MODE,
  PROFILE_PROMPT_VERSION,
  isProfileIdentitySlot,
  resolveProfileIdentityMeta,
  PROFILE_IDENTITY_FIRST_OPENER,
  PROFILE_HARD_IDENTITY_ANCHORS,
  PROFILE_DRIFT_NEGATIVES,
  PROFILE_PHOTOGRAPHY_SIMPLE,
  PROFILE_FORBIDDEN_CASTING_MARKERS,
} from "./profile-identity-preservation";
export type { ProfileIdentityMode } from "./profile-identity-preservation";

export {
  IDENTITY_OVERRIDE_VERSION,
  HUMAN_IDENTITY_OVERRIDE_REASON_DEFAULT,
  canProposeHumanIdentityOverride,
  isMismatchOverrideUsable,
  resolveIdentitySourceConfidence,
} from "./human-identity-override";
export type {
  HumanIdentityReview,
  IdentitySourceConfidence,
} from "./human-identity-override";

export {
  approveHumanIdentityOverride,
  getAttemptIdentityProvenance,
} from "./approve-human-identity-override";
export type {
  ApproveHumanIdentityOverrideInput,
  ApproveHumanIdentityOverrideResult,
} from "./approve-human-identity-override";
