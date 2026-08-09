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

export { buildReferencePackageAnglePrompt } from "./prompts";
