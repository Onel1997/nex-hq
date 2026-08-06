/**
 * Phase 2.1B — Official Brand Face live L3 identity integration helpers.
 *
 * Resolves L2 SlotBlueprint + samples L3 DiscoveryIdentityInstance for OBF A1.
 * Does not call OpenAI. Does not touch face novelty thresholds.
 */

import { slotForCandidateNumber } from "@/lib/brand-archetypes/discovery-blueprints";
import type { BrandArchetype, IdentityDna } from "@/lib/brand-archetypes/types";
import {
  IDENTITY_BLUEPRINT_ENGINE_VERSION,
  IdentityBlueprintError,
  formatDiscoveryIdentityInstancePrompt,
  listSlotBlueprintsForArchetype,
  resolveSlotBlueprint,
  sampleDiscoveryIdentityInstance,
  validateCrossSlotIdentityDiversity,
  validateDiscoveryIdentityInstance,
  validateIdentityWithinBlueprint,
  validateSlotBlueprint,
  type ControlledPoolKey,
  type DiscoveryIdentityInstance,
  type DiscoverySlot,
  type SlotBlueprint,
} from "@/lib/persona/identity-blueprints";

/** Safe L3 metadata persisted on candidate generation_settings. */
export type DiscoveryIdentityL3Metadata = {
  identityBlueprintVersion: string;
  slotBlueprintId: string;
  discoveryIdentityInstanceId: string;
  generationRunId: string;
  attemptNumber: number;
  samplingSeed: string;
  identityFingerprint: string;
  anatomyFingerprint: string;
  promptFingerprint: string;
  source: "controlled_sampling";
  slot: DiscoverySlot;
};

/** Development-only debug surface — never includes full prompt or embeddings. */
export type DiscoveryIdentityL3Debug = {
  slotBlueprintId: string;
  discoveryIdentityInstanceId: string;
  attemptNumber: number;
  identityFingerprint: string;
  anatomyFingerprint: string;
  promptFingerprint: string;
  slot: DiscoverySlot;
  generationRunId: string;
};

export type ObfL3ResolveInput = {
  archetypeId: string;
  candidateNumber: number;
  creationProjectId: string;
  generationRunId: string;
  attemptNumber?: number;
  /** Injected instance for tests / replay. */
  discoveryIdentityInstance?: DiscoveryIdentityInstance;
  slotBlueprint?: SlotBlueprint;
  sampledAt?: string;
  /** Phase 2.1E — prior attempt anatomy for anti-repeat. */
  previousAttemptSample?: Partial<Record<ControlledPoolKey, string>> | null;
  /** Phase 2.1E — same-run matched slot anatomy to avoid. */
  avoidSameRunSample?: Partial<Record<ControlledPoolKey, string>> | null;
};

export type ObfL3ResolveResult = {
  slot: DiscoverySlot;
  slotBlueprint: SlotBlueprint;
  discoveryIdentityInstance: DiscoveryIdentityInstance;
  metadata: DiscoveryIdentityL3Metadata;
  debug: DiscoveryIdentityL3Debug;
  anatomyPromptBlock: string;
};

/** Phrases that must never appear in OBF discovery anatomy prompts. */
export const OBF_FORBIDDEN_LEGACY_BIOLOGY_PATTERNS: readonly RegExp[] = [
  /\block this identity\b/i,
  /\bLock this Identity DNA\b/i,
  /\bdo not invent a different person\b/i,
  /\bKeep identity requirements fixed\b/i,
  /\bCANDIDATE-SPECIFIC BIOLOGICAL IDENTITY\b/i,
  /\bDISCOVERY DIVERSITY BRIEF\b/i,
  /\bPermanent unique human identity\b/i,
  /\bTHIS PERSON ONLY —\b/i,
  /\bDo not invent a different person or drift identity between frames\b/i,
];

export function buildDiscoveryIdentityL3Metadata(
  instance: DiscoveryIdentityInstance,
): DiscoveryIdentityL3Metadata {
  return {
    identityBlueprintVersion: IDENTITY_BLUEPRINT_ENGINE_VERSION,
    slotBlueprintId: instance.slotBlueprintId,
    discoveryIdentityInstanceId: instance.id,
    generationRunId: instance.generationRunId,
    attemptNumber: instance.attemptNumber,
    samplingSeed: instance.samplingSeed,
    identityFingerprint: instance.identityFingerprint,
    anatomyFingerprint: instance.anatomyFingerprint,
    promptFingerprint: instance.promptFingerprint,
    source: "controlled_sampling",
    slot: instance.slot,
  };
}

export function buildDiscoveryIdentityL3Debug(
  instance: DiscoveryIdentityInstance,
): DiscoveryIdentityL3Debug {
  return {
    slotBlueprintId: instance.slotBlueprintId,
    discoveryIdentityInstanceId: instance.id,
    attemptNumber: instance.attemptNumber,
    identityFingerprint: instance.identityFingerprint,
    anatomyFingerprint: instance.anatomyFingerprint,
    promptFingerprint: instance.promptFingerprint,
    slot: instance.slot,
    generationRunId: instance.generationRunId,
  };
}

/**
 * Resolve L2 + sample L3 for one OBF candidate attempt.
 * Throws if SlotBlueprint is missing (e.g. archetype not yet migrated to L2).
 */
export function resolveObfDiscoveryIdentity(
  input: ObfL3ResolveInput,
): ObfL3ResolveResult {
  const attemptNumber = input.attemptNumber ?? 1;
  if (!Number.isInteger(attemptNumber) || attemptNumber < 1) {
    throw new IdentityBlueprintError(
      `OBF identity attemptNumber must be >= 1, got ${attemptNumber}`,
    );
  }
  if (!input.generationRunId.trim()) {
    throw new IdentityBlueprintError(
      "OBF discovery requires generationRunId before L3 sampling",
    );
  }
  if (!input.creationProjectId.trim()) {
    throw new IdentityBlueprintError(
      "OBF discovery requires creationProjectId before L3 sampling",
    );
  }

  const slot = slotForCandidateNumber(input.candidateNumber);
  const available = listSlotBlueprintsForArchetype(input.archetypeId);
  if (available.length === 0) {
    throw new IdentityBlueprintError(
      `No L2 SlotBlueprints configured for archetype ${input.archetypeId}. Official Brand Face requires Identity Blueprint Engine lanes.`,
      { archetypeId: input.archetypeId },
    );
  }

  const slotBlueprint =
    input.slotBlueprint ??
    resolveSlotBlueprint({ archetypeId: input.archetypeId, slot });

  const bpCheck = validateSlotBlueprint(slotBlueprint);
  if (!bpCheck.ok) {
    throw new IdentityBlueprintError("Invalid L2 SlotBlueprint for OBF", {
      issues: bpCheck.issues,
    });
  }

  const instance =
    input.discoveryIdentityInstance ??
    sampleDiscoveryIdentityInstance({
      slotBlueprint,
      creationProjectId: input.creationProjectId,
      generationRunId: input.generationRunId,
      attemptNumber,
      sampledAt: input.sampledAt,
      previousAttemptSample: input.previousAttemptSample,
      avoidSameRunSample: input.avoidSameRunSample,
    });

  if (!instance) {
    throw new IdentityBlueprintError("Missing L3 DiscoveryIdentityInstance");
  }

  const instanceCheck = validateDiscoveryIdentityInstance(instance);
  if (!instanceCheck.ok) {
    throw new IdentityBlueprintError("Invalid L3 DiscoveryIdentityInstance", {
      issues: instanceCheck.issues,
    });
  }

  const within = validateIdentityWithinBlueprint(instance, slotBlueprint);
  if (!within.ok) {
    throw new IdentityBlueprintError("L3 instance escaped L2 SlotBlueprint", {
      issues: within.issues,
    });
  }

  const anatomyPromptBlock = formatDiscoveryIdentityInstancePrompt(instance);
  assertObfPromptHasNoLegacyBiology(anatomyPromptBlock, "L3 anatomy block");

  return {
    slot,
    slotBlueprint,
    discoveryIdentityInstance: instance,
    metadata: buildDiscoveryIdentityL3Metadata(instance),
    debug: buildDiscoveryIdentityL3Debug(instance),
    anatomyPromptBlock,
  };
}

/** Assert a composed OBF prompt does not contain legacy absolute-person biology. */
export function assertObfPromptHasNoLegacyBiology(
  prompt: string,
  context = "OBF prompt",
): void {
  for (const pattern of OBF_FORBIDDEN_LEGACY_BIOLOGY_PATTERNS) {
    if (pattern.test(prompt)) {
      throw new IdentityBlueprintError(
        `${context} contains forbidden legacy biology wording matching ${pattern}`,
      );
    }
  }
}

/**
 * Archetype + gender constraints for discovery — no absolute appearance anatomy,
 * no identity-lock wording.
 */
export function formatObfArchetypeConstraintsPrompt(
  archetype: BrandArchetype,
  dna: IdentityDna,
  slotBlueprint: SlotBlueprint,
): string {
  return [
    `1. ARCHETYPE AND GENDER CONSTRAINTS — ${archetype.name} (${archetype.slug})`,
    `Official Brand Archetype casting lane. Identity Blueprint Engine v${IDENTITY_BLUEPRINT_ENGINE_VERSION}.`,
    `Commercial role: ${archetype.commercialRole}.`,
    `Gender presentation locked: ${archetype.genderPresentation} (adult ${slotBlueprint.gender} only).`,
    `Age band for this lane: ${slotBlueprint.ageRange}.`,
    `Regional casting cluster (lane constraint): ${slotBlueprint.regionalCluster}.`,
    `Skin tone range (lane constraint): ${slotBlueprint.skinToneRange}.`,
    `Facial proportion family (lane constraint): ${slotBlueprint.facialProportionFamily}.`,
    `Hair texture family (lane constraint): ${slotBlueprint.hairTextureFamily}.`,
    `Facial hair family (lane constraint): ${slotBlueprint.facialHairFamily}.`,
    `Expression family (lane constraint): ${slotBlueprint.expressionFamily}.`,
    `Quality bar: ${slotBlueprint.qualityBar}.`,
    "",
    "PRESENCE FAMILIES (not exact facial anatomy)",
    `Confidence: ${dna.presence.confidence}.`,
    `Approachability: ${dna.presence.approachability}.`,
    `Calmness: ${dna.presence.calmness}.`,
    `Authenticity: ${dna.presence.authenticity}.`,
    `Social energy: ${dna.presence.socialEnergy}.`,
    "",
    "Exact facial anatomy comes ONLY from the Discovery Identity Instance (L3) block below.",
    "Do not restate or invent a permanent face from archetype appearance families.",
  ].join("\n");
}

export function formatObfAgeBodyDirectionPrompt(
  slotBlueprint: SlotBlueprint,
  instance: DiscoveryIdentityInstance,
): string {
  return [
    "3. AGE AND BODY DIRECTION (lane constraints)",
    `Age band: ${slotBlueprint.ageRange} (this individual age feel: ${instance.exactAge}).`,
    `Body direction: ${slotBlueprint.bodyDirection}.`,
    "Photoreal adult fashion-model proportions only — never childlike, never bodybuilder, never ordinary desk-job frame.",
  ].join("\n");
}

export function formatObfPresenceFamilyPrompt(
  dna: IdentityDna,
  slotBlueprint: SlotBlueprint,
  instance: DiscoveryIdentityInstance,
): string {
  return [
    "4. PRESENCE / EXPRESSION FAMILY",
    `Lane expression family: ${slotBlueprint.expressionFamily}.`,
    `Instance micro-expression: ${instance.microExpression}.`,
    `Presence confidence: ${dna.presence.confidence}.`,
    `Approachability: ${dna.presence.approachability}.`,
    `Social energy: ${dna.presence.socialEnergy}.`,
    `Fashion direction: ${slotBlueprint.fashionDirection}.`,
    "Relaxed confidence. Approachable. Quiet self-assurance.",
    "No angry eyes, no tough-guy stare, no hostile energy, no gangster styling.",
  ].join("\n");
}

export function formatObfGarmentDirectionPrompt(
  slotBlueprint: SlotBlueprint,
  instance: DiscoveryIdentityInstance,
): string {
  return [
    "A1 GARMENT DIRECTION (Product Intelligence authority)",
    `Lane garment categories: ${slotBlueprint.garmentCategories.join(", ")}.`,
    `Assigned garment/color for this individual: ${instance.garmentColor}.`,
    "Only Oversized Heavyweight T-Shirt, Heavyweight Hoodie, or Zip Hoodie.",
    "No caps, jackets, jewelry, suits, cargo pants, footwear, or accessories.",
    "No visible third-party logos, no invented Milaene artwork, no random graphics, no text on clothing.",
    "Garment must visibly drape like heavyweight premium streetwear with oversized shoulder/sleeve proportions.",
    "Clothing supports model evaluation — does not dominate the portrait.",
  ].join("\n");
}

export function formatObfCastingSetPrompt(
  slotBlueprint: SlotBlueprint,
  instance: DiscoveryIdentityInstance,
): string {
  return [
    "A1 PREMIUM CASTING SET (instance-scoped)",
    `Background: ${instance.castingBackground}.`,
    `Camera rules: ${slotBlueprint.cameraRules.join(" · ")}.`,
    "Still controlled casting photography — premium agency test shoot energy.",
    "Do NOT generate full campaign locations, streets, cafés, parking garages, shops, or product sets.",
  ].join("\n");
}

/**
 * Novelty-block retry contract — increments attempt without changing thresholds.
 * Does not spend money; callers must confirm paid regeneration separately.
 */
export function nextDiscoveryIdentityAttempt(currentAttempt: number): number {
  if (!Number.isInteger(currentAttempt) || currentAttempt < 1) {
    throw new IdentityBlueprintError(
      `currentAttempt must be integer >= 1, got ${currentAttempt}`,
    );
  }
  return currentAttempt + 1;
}

export const MAX_DISCOVERY_IDENTITY_ATTEMPTS = 4 as const;

export type NoveltyBlockIdentityRetryContract = {
  previousAttemptNumber: number;
  nextAttemptNumber: number;
  keepSlotBlueprintId: string;
  keepArchetypeId: string;
  keepGenerationRunId: string;
  keepCreationProjectId: string;
  maxAttempts: typeof MAX_DISCOVERY_IDENTITY_ATTEMPTS;
  slotExhausted: boolean;
  /** Explicit: thresholds / evaluator / embedding model are unchanged. */
  noveltyThresholdsUnchanged: true;
  autoSpendMoney: false;
};

export function buildNoveltyBlockIdentityRetryContract(input: {
  previousAttemptNumber: number;
  slotBlueprint: SlotBlueprint;
  generationRunId: string;
  creationProjectId: string;
}): NoveltyBlockIdentityRetryContract {
  const slotExhausted =
    input.previousAttemptNumber >= MAX_DISCOVERY_IDENTITY_ATTEMPTS;
  const nextAttemptNumber = slotExhausted
    ? input.previousAttemptNumber
    : nextDiscoveryIdentityAttempt(input.previousAttemptNumber);
  return {
    previousAttemptNumber: input.previousAttemptNumber,
    nextAttemptNumber,
    keepSlotBlueprintId: input.slotBlueprint.id,
    keepArchetypeId: input.slotBlueprint.archetypeId,
    keepGenerationRunId: input.generationRunId,
    keepCreationProjectId: input.creationProjectId,
    maxAttempts: MAX_DISCOVERY_IDENTITY_ATTEMPTS,
    slotExhausted,
    noveltyThresholdsUnchanged: true,
    autoSpendMoney: false,
  };
}

/** Fail before provider call if cast anatomies collide. */
export function assertObfCastAnatomyDiversity(
  instances: readonly DiscoveryIdentityInstance[],
): void {
  const result = validateCrossSlotIdentityDiversity(instances);
  if (!result.ok) {
    throw new IdentityBlueprintError(
      "Duplicate L3 anatomy within the same generation run",
      { issues: result.issues },
    );
  }
}

export function isObfL3DebugEnabled(): boolean {
  return (
    process.env.NODE_ENV === "development" ||
    process.env.PERSONA_IDENTITY_BLUEPRINT_DEBUG === "1"
  );
}
