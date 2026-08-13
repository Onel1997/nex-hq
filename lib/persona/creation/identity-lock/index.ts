export {
  IDENTITY_LOCK_POLICY_VERSION,
} from "./types";
export type {
  IdentityLockEligibilityView,
  IdentityLockPreview,
  IdentityLockProvenanceCounts,
  IdentityLockReferenceProvenance,
  LockedBrandIdentity,
  LockedCanonicalReferenceSnapshot,
  PersonaIdentityLockSnapshot,
} from "./types";

export { computeReferencePackageFingerprint } from "./fingerprint";
export { countProvenance, resolveLockReferenceProvenance } from "./provenance";
export { validateIdentityLockEligibility } from "./pre-lock-validation";

export {
  getIdentityLockRepository,
  setIdentityLockRepositoryForTests,
  MemoryIdentityLockRepository,
} from "./repository";
export type { IdentityLockRepository } from "./repository";

export {
  assertLockedIdentityAssetMutable,
  collectLockedIdentityAssetIds,
  coerceUuidOrNull,
  getIdentityLockEligibility,
  getIdentityLockSnapshot,
  isPersonaIdentityLocked,
  IdentityLockError,
  lockBrandIdentity,
  resolveLockedBrandIdentity,
} from "./identity-lock-service";
export type {
  HistoricalProtectionPromotionStatus,
  IdentityLockStage,
} from "./identity-lock-service";
