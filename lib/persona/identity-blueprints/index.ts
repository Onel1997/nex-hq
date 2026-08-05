/**
 * Phase 2.1A — Identity Blueprint Engine public API.
 *
 * L2 Slot Blueprint + L3 Discovery Identity Instance.
 * No OpenAI, no React, no face novelty, no L4 approval.
 */

export {
  IDENTITY_BLUEPRINT_ENGINE_VERSION,
  HIGH_LEVERAGE_POOL_KEYS,
  CONTROLLED_POOL_KEYS,
  IdentityBlueprintError,
  type DiscoverySlot,
  type BlueprintGender,
  type HighLeveragePoolKey,
  type ControlledPoolKey,
  type ControlledPools,
  type SlotBlueprint,
  type DiscoveryIdentityInstance,
  type SampleDiscoveryIdentityInput,
  type ValidationIssue,
  type ValidationResult,
  type CrossSlotDiversityResult,
} from "./types";

export {
  identityShortHash,
  stableJoin,
  blueprintFingerprint,
  identityFingerprintFromAttributes,
  anatomyFingerprintFromAttributes,
  highLeverageCombinationKey,
  noseJawEyeTriple,
  hairBeardTriple,
  promptFingerprintFromText,
} from "./fingerprint";

export {
  MIN_HIGH_LEVERAGE_POOL_SIZE,
  MIN_STANDARD_POOL_SIZE,
  isHighLeveragePoolKey,
  minPoolSizeForKey,
  assertPoolsShape,
  parseAgeRange,
} from "./identity-pools";

export {
  ABSOLUTE_PERSON_LANGUAGE_PATTERNS,
  validateSlotBlueprint,
  validateDiscoveryIdentityInstance,
  validateIdentityWithinBlueprint,
  validateCrossSlotIdentityDiversity,
} from "./validation";

export {
  MEDITERRANEAN_ARCHETYPE_ID,
  SLOT_BLUEPRINT_VERSION,
  MEDITERRANEAN_SLOT_BLUEPRINTS,
  listMediterraneanSlotBlueprints,
  getMediterraneanSlotBlueprint,
  listSlotBlueprintsForArchetype,
  resolveSlotBlueprint,
} from "./slot-blueprints";

export {
  buildSamplingSeed,
  createDeterministicRng,
  sampleDiscoveryIdentityInstance,
  sampleDiscoveryCast,
} from "./sampler";

export {
  formatDiscoveryIdentityInstancePrompt,
  discoveryIdentityPromptContainsNewIndividualWording,
  discoveryIdentityPromptContainsIdentityLockWording,
} from "./prompt-format";
