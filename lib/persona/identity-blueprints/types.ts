/**
 * Phase 2.1A — Identity Blueprint Engine foundation.
 *
 * L2 Slot Blueprint = permanent casting lane (constraints + controlled pools).
 * L3 Discovery Identity Instance = one concrete sampled person per run/attempt.
 *
 * Independent of OpenAI, React, face novelty, and L4 approval.
 */

export const IDENTITY_BLUEPRINT_ENGINE_VERSION = "2.1A.0" as const;

export type DiscoverySlot = "A" | "B" | "C" | "D";
export type BlueprintGender = "male" | "female";

/** High-leverage axes that must rotate across runs/attempts. */
export const HIGH_LEVERAGE_POOL_KEYS = [
  "noseBridge",
  "noseWidth",
  "noseTip",
  "eyeSpacing",
  "eyeShape",
  "jaw",
  "chin",
  "hairline",
  "haircut",
  "beardPattern",
  "asymmetry",
  "optionalMicroMarks",
] as const;

export type HighLeveragePoolKey = (typeof HIGH_LEVERAGE_POOL_KEYS)[number];

/** All controlled pool keys required on every SlotBlueprint. */
export const CONTROLLED_POOL_KEYS = [
  "skinToneExact",
  "facialRatioVariant",
  "faceGeometry",
  "forehead",
  "eyebrows",
  "eyeShape",
  "eyeSpacing",
  "noseBridge",
  "noseWidth",
  "noseTip",
  "jaw",
  "chin",
  "cheekbones",
  "lips",
  "ears",
  "hairline",
  "haircut",
  "beardPattern",
  "microExpression",
  "asymmetry",
  "optionalMicroMarks",
  "garmentColor",
  "castingBackground",
] as const;

export type ControlledPoolKey = (typeof CONTROLLED_POOL_KEYS)[number];

export type ControlledPools = {
  readonly [K in ControlledPoolKey]: readonly string[];
};

/**
 * L2 — permanent casting lane.
 * Describes constraints and pools. Never an exact person.
 */
export type SlotBlueprint = {
  readonly id: string;
  readonly version: string;
  readonly archetypeId: string;
  readonly slot: DiscoverySlot;
  readonly name: string;
  readonly gender: BlueprintGender;
  readonly ageRange: string;
  /** Fixed regional appearance cluster for this casting lane. */
  readonly regionalCluster: string;
  /** Allowed skin-tone band (constraint, not exact tone). */
  readonly skinToneRange: string;
  readonly bodyDirection: string;
  readonly facialProportionFamily: string;
  readonly hairTextureFamily: string;
  readonly facialHairFamily: string;
  readonly expressionFamily: string;
  readonly qualityBar: string;
  readonly garmentCategories: readonly string[];
  readonly cameraRules: readonly string[];
  readonly crossSlotExclusions: readonly string[];
  readonly controlledPools: ControlledPools;
  /** Brand / fashion casting direction for this lane (non-anatomy). */
  readonly fashionDirection: string;
  /** Commercial brand role label for this slot. */
  readonly brandRole: string;
};

/**
 * L3 — one concrete sampled person for one discovery run + attempt.
 * No provider output, embeddings, images, approval, or L4 lock.
 */
export type DiscoveryIdentityInstance = {
  readonly id: string;
  readonly version: string;
  readonly archetypeId: string;
  readonly slotBlueprintId: string;
  readonly generationRunId: string;
  readonly creationProjectId: string;
  readonly slot: DiscoverySlot;
  readonly attemptNumber: number;
  readonly samplingSeed: string;
  readonly sampledAt: string;
  readonly exactAge: number;
  readonly gender: BlueprintGender;
  readonly regionalCluster: string;
  readonly skinToneExact: string;
  readonly facialRatioVariant: string;
  readonly faceGeometry: string;
  readonly forehead: string;
  readonly eyebrows: string;
  readonly eyeShape: string;
  readonly eyeSpacing: string;
  readonly noseBridge: string;
  readonly noseWidth: string;
  readonly noseTip: string;
  readonly jaw: string;
  readonly chin: string;
  readonly cheekbones: string;
  readonly lips: string;
  readonly ears: string;
  readonly hairline: string;
  readonly haircut: string;
  readonly beardPattern: string;
  readonly microExpression: string;
  readonly asymmetry: string;
  readonly optionalMicroMarks: string;
  readonly garmentColor: string;
  readonly castingBackground: string;
  readonly identityFingerprint: string;
  readonly anatomyFingerprint: string;
  readonly promptFingerprint: string;
  readonly source: "controlled_sampling";
};

export type SampleDiscoveryIdentityInput = {
  readonly slotBlueprint: SlotBlueprint;
  readonly creationProjectId: string;
  readonly generationRunId: string;
  readonly attemptNumber: number;
  /** Optional fixed ISO timestamp for reproducible tests. */
  readonly sampledAt?: string;
};

export type ValidationIssue = {
  readonly code: string;
  readonly message: string;
  readonly path?: string;
};

export type ValidationResult = {
  readonly ok: boolean;
  readonly issues: readonly ValidationIssue[];
};

export type CrossSlotDiversityResult = {
  readonly ok: boolean;
  readonly issues: readonly ValidationIssue[];
};

export class IdentityBlueprintError extends Error {
  readonly code = "IDENTITY_BLUEPRINT";
  readonly details?: Record<string, unknown>;
  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "IdentityBlueprintError";
    this.details = details;
  }
}
