/**
 * Validation for L2 Slot Blueprints and L3 Discovery Identity Instances.
 */

import {
  anatomyFingerprintFromAttributes,
  hairBeardTriple,
  highLeverageCombinationKey,
  noseJawEyeTriple,
} from "./fingerprint";
import {
  assertPoolsShape,
  parseAgeRange,
} from "./identity-pools";
import {
  CONTROLLED_POOL_KEYS,
  HIGH_LEVERAGE_POOL_KEYS,
  type ControlledPoolKey,
  type CrossSlotDiversityResult,
  type DiscoveryIdentityInstance,
  type SlotBlueprint,
  type ValidationIssue,
  type ValidationResult,
} from "./types";

/** Phrases that define an absolute locked person — forbidden in L2 text fields. */
export const ABSOLUTE_PERSON_LANGUAGE_PATTERNS: readonly RegExp[] = [
  /\bthis exact person\b/i,
  /\block this identity\b/i,
  /\bsame face\b/i,
  /\bdo not invent a different person\b/i,
  /\bunique immutable facial ratios?\b/i,
  /\bpermanent unique human identity\b/i,
  /\bthis person only\b/i,
  /\bkeep identity requirements fixed\b/i,
  /\bdo not invent a different person or drift identity\b/i,
];

function issuesResult(issues: ValidationIssue[]): ValidationResult {
  return { ok: issues.length === 0, issues };
}

function collectAbsolutePersonLanguage(
  path: string,
  text: string,
  issues: ValidationIssue[],
): void {
  for (const pattern of ABSOLUTE_PERSON_LANGUAGE_PATTERNS) {
    if (pattern.test(text)) {
      issues.push({
        code: "ABSOLUTE_PERSON_LANGUAGE",
        message: `L2 field contains absolute-person language matching ${pattern}: "${text.slice(0, 80)}"`,
        path,
      });
    }
  }
}

function scanBlueprintTextFields(blueprint: SlotBlueprint): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const scalarFields: Array<[string, string]> = [
    ["name", blueprint.name],
    ["ageRange", blueprint.ageRange],
    ["regionalCluster", blueprint.regionalCluster],
    ["skinToneRange", blueprint.skinToneRange],
    ["bodyDirection", blueprint.bodyDirection],
    ["facialProportionFamily", blueprint.facialProportionFamily],
    ["hairTextureFamily", blueprint.hairTextureFamily],
    ["facialHairFamily", blueprint.facialHairFamily],
    ["expressionFamily", blueprint.expressionFamily],
    ["qualityBar", blueprint.qualityBar],
    ["fashionDirection", blueprint.fashionDirection],
    ["brandRole", blueprint.brandRole],
  ];
  for (const [path, value] of scalarFields) {
    collectAbsolutePersonLanguage(path, value, issues);
  }
  for (const [i, value] of blueprint.garmentCategories.entries()) {
    collectAbsolutePersonLanguage(`garmentCategories[${i}]`, value, issues);
  }
  for (const [i, value] of blueprint.cameraRules.entries()) {
    collectAbsolutePersonLanguage(`cameraRules[${i}]`, value, issues);
  }
  for (const [i, value] of blueprint.crossSlotExclusions.entries()) {
    collectAbsolutePersonLanguage(`crossSlotExclusions[${i}]`, value, issues);
  }
  for (const key of CONTROLLED_POOL_KEYS) {
    for (const [i, value] of blueprint.controlledPools[key].entries()) {
      collectAbsolutePersonLanguage(`controlledPools.${key}[${i}]`, value, issues);
    }
  }
  return issues;
}

export function validateSlotBlueprint(blueprint: SlotBlueprint): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!blueprint.id.trim()) {
    issues.push({ code: "MISSING_ID", message: "SlotBlueprint.id is required", path: "id" });
  }
  if (!blueprint.version.trim()) {
    issues.push({
      code: "MISSING_VERSION",
      message: "SlotBlueprint.version is required",
      path: "version",
    });
  }
  if (!blueprint.archetypeId.trim()) {
    issues.push({
      code: "MISSING_ARCHETYPE",
      message: "SlotBlueprint.archetypeId is required",
      path: "archetypeId",
    });
  }
  if (!["A", "B", "C", "D"].includes(blueprint.slot)) {
    issues.push({
      code: "INVALID_SLOT",
      message: `Invalid slot: ${blueprint.slot}`,
      path: "slot",
    });
  }
  if (blueprint.gender !== "male" && blueprint.gender !== "female") {
    issues.push({
      code: "INVALID_GENDER",
      message: `Invalid gender: ${String(blueprint.gender)}`,
      path: "gender",
    });
  }
  if (!blueprint.regionalCluster.trim()) {
    issues.push({
      code: "MISSING_REGIONAL_CLUSTER",
      message: "regionalCluster is required",
      path: "regionalCluster",
    });
  }
  if (!parseAgeRange(blueprint.ageRange)) {
    issues.push({
      code: "INVALID_AGE_RANGE",
      message: `ageRange must be like "24-29", got "${blueprint.ageRange}"`,
      path: "ageRange",
    });
  }
  if (blueprint.garmentCategories.length === 0) {
    issues.push({
      code: "EMPTY_GARMENT_CATEGORIES",
      message: "garmentCategories must not be empty",
      path: "garmentCategories",
    });
  }
  if (blueprint.cameraRules.length === 0) {
    issues.push({
      code: "EMPTY_CAMERA_RULES",
      message: "cameraRules must not be empty",
      path: "cameraRules",
    });
  }

  const poolsCheck = assertPoolsShape(blueprint.controlledPools);
  if (!poolsCheck.ok) {
    issues.push({
      code: "INVALID_POOL",
      message: poolsCheck.message,
      path: poolsCheck.path,
    });
  }

  issues.push(...scanBlueprintTextFields(blueprint));
  return issuesResult(issues);
}

function poolValue(
  instance: DiscoveryIdentityInstance,
  key: ControlledPoolKey,
): string {
  return instance[key];
}

export function validateDiscoveryIdentityInstance(
  instance: DiscoveryIdentityInstance,
): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!instance.id.trim()) {
    issues.push({ code: "MISSING_ID", message: "Instance id is required", path: "id" });
  }
  if (instance.source !== "controlled_sampling") {
    issues.push({
      code: "INVALID_SOURCE",
      message: `source must be controlled_sampling, got ${instance.source}`,
      path: "source",
    });
  }
  if (!Number.isInteger(instance.attemptNumber) || instance.attemptNumber < 1) {
    issues.push({
      code: "INVALID_ATTEMPT",
      message: `attemptNumber must be integer >= 1, got ${instance.attemptNumber}`,
      path: "attemptNumber",
    });
  }
  if (!instance.generationRunId.trim()) {
    issues.push({
      code: "MISSING_GENERATION_RUN",
      message: "generationRunId is required",
      path: "generationRunId",
    });
  }
  if (!instance.creationProjectId.trim()) {
    issues.push({
      code: "MISSING_CREATION_PROJECT",
      message: "creationProjectId is required",
      path: "creationProjectId",
    });
  }
  if (!instance.samplingSeed.trim()) {
    issues.push({
      code: "MISSING_SEED",
      message: "samplingSeed is required",
      path: "samplingSeed",
    });
  }
  if (!instance.identityFingerprint.trim() || !instance.anatomyFingerprint.trim()) {
    issues.push({
      code: "MISSING_FINGERPRINT",
      message: "identityFingerprint and anatomyFingerprint are required",
    });
  }

  for (const key of HIGH_LEVERAGE_POOL_KEYS) {
    if (!poolValue(instance, key).trim()) {
      issues.push({
        code: "MISSING_HIGH_LEVERAGE",
        message: `Missing high-leverage attribute: ${key}`,
        path: key,
      });
    }
  }

  return issuesResult(issues);
}

export function validateIdentityWithinBlueprint(
  instance: DiscoveryIdentityInstance,
  blueprint: SlotBlueprint,
): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (instance.slotBlueprintId !== blueprint.id) {
    issues.push({
      code: "BLUEPRINT_ID_MISMATCH",
      message: `Instance slotBlueprintId ${instance.slotBlueprintId} != blueprint ${blueprint.id}`,
      path: "slotBlueprintId",
    });
  }
  if (instance.archetypeId !== blueprint.archetypeId) {
    issues.push({
      code: "ARCHETYPE_MISMATCH",
      message: "Instance archetypeId does not match blueprint",
      path: "archetypeId",
    });
  }
  if (instance.slot !== blueprint.slot) {
    issues.push({
      code: "SLOT_MISMATCH",
      message: `Instance slot ${instance.slot} != blueprint slot ${blueprint.slot}`,
      path: "slot",
    });
  }
  if (instance.gender !== blueprint.gender) {
    issues.push({
      code: "GENDER_MISMATCH",
      message: `Gender mismatch: instance=${instance.gender} blueprint=${blueprint.gender}`,
      path: "gender",
    });
  }
  if (instance.regionalCluster !== blueprint.regionalCluster) {
    issues.push({
      code: "REGIONAL_CLUSTER_MISMATCH",
      message: `Regional cluster mismatch: instance=${instance.regionalCluster} blueprint=${blueprint.regionalCluster}`,
      path: "regionalCluster",
    });
  }

  const band = parseAgeRange(blueprint.ageRange);
  if (!band) {
    issues.push({
      code: "INVALID_AGE_RANGE",
      message: `Blueprint ageRange invalid: ${blueprint.ageRange}`,
      path: "ageRange",
    });
  } else if (instance.exactAge < band.min || instance.exactAge > band.max) {
    issues.push({
      code: "AGE_OUTSIDE_BAND",
      message: `exactAge ${instance.exactAge} outside band ${blueprint.ageRange}`,
      path: "exactAge",
    });
  }

  for (const key of CONTROLLED_POOL_KEYS) {
    const value = poolValue(instance, key);
    const pool = blueprint.controlledPools[key];
    if (!pool.includes(value)) {
      issues.push({
        code: "VALUE_NOT_IN_POOL",
        message: `Sampled ${key}="${value}" is not in blueprint pool`,
        path: key,
      });
    }
  }

  const expectedAnatomy = anatomyFingerprintFromAttributes(instance);
  if (expectedAnatomy !== instance.anatomyFingerprint) {
    issues.push({
      code: "ANATOMY_FINGERPRINT_MISMATCH",
      message: "anatomyFingerprint does not match sampled attributes",
      path: "anatomyFingerprint",
    });
  }

  return issuesResult(issues);
}

/**
 * Validate A–D instances from the same generation run for biological diversity.
 */
export function validateCrossSlotIdentityDiversity(
  instances: readonly DiscoveryIdentityInstance[],
): CrossSlotDiversityResult {
  const issues: ValidationIssue[] = [];

  if (instances.length < 2) {
    return { ok: true, issues: [] };
  }

  const runIds = new Set(instances.map((i) => i.generationRunId));
  if (runIds.size !== 1) {
    issues.push({
      code: "MIXED_GENERATION_RUNS",
      message: "Cross-slot diversity requires instances from a single generationRunId",
    });
  }

  const anatomySeen = new Map<string, string>();
  const highLeverageSeen = new Map<string, string>();
  const noseJawEyeSeen = new Map<string, string>();
  const hairBeardSeen = new Map<string, string>();

  for (const instance of instances) {
    const slotLabel = `slot ${instance.slot}`;

    const anatomy = instance.anatomyFingerprint;
    const priorAnatomy = anatomySeen.get(anatomy);
    if (priorAnatomy) {
      issues.push({
        code: "DUPLICATE_ANATOMY_FINGERPRINT",
        message: `Identical anatomy fingerprint between ${priorAnatomy} and ${slotLabel}`,
        path: "anatomyFingerprint",
      });
    } else {
      anatomySeen.set(anatomy, slotLabel);
    }

    const hl = highLeverageCombinationKey(instance);
    const priorHl = highLeverageSeen.get(hl);
    if (priorHl) {
      issues.push({
        code: "DUPLICATE_HIGH_LEVERAGE_COMBINATION",
        message: `Identical high-leverage combination between ${priorHl} and ${slotLabel}`,
      });
    } else {
      highLeverageSeen.set(hl, slotLabel);
    }

    const nje = noseJawEyeTriple(instance);
    const priorNje = noseJawEyeSeen.get(nje);
    if (priorNje) {
      issues.push({
        code: "DUPLICATE_NOSE_JAW_EYE_TRIPLE",
        message: `Identical nose+jaw+eye-spacing triple between ${priorNje} and ${slotLabel}`,
      });
    } else {
      noseJawEyeSeen.set(nje, slotLabel);
    }

    const hb = hairBeardTriple(instance);
    const priorHb = hairBeardSeen.get(hb);
    if (priorHb) {
      issues.push({
        code: "DUPLICATE_HAIR_BEARD_TRIPLE",
        message: `Identical hairline+haircut+beard-pattern triple between ${priorHb} and ${slotLabel}`,
      });
    } else {
      hairBeardSeen.set(hb, slotLabel);
    }
  }

  return { ok: issues.length === 0, issues };
}
