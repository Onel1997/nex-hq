/**
 * Deterministic fingerprints for Identity Blueprint Engine.
 * FNV-1a style — no Math.random, no node:crypto required.
 */

import type { DiscoveryIdentityInstance, SlotBlueprint } from "./types";
import { CONTROLLED_POOL_KEYS } from "./types";

/** Deterministic short hash — safe in Node and browser bundles. */
export function identityShortHash(input: string, length = 16): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const hex = (h >>> 0).toString(16).padStart(8, "0");
  let h2 = 0x811c9dc5;
  for (let i = input.length - 1; i >= 0; i -= 1) {
    h2 ^= input.charCodeAt(i);
    h2 = Math.imul(h2, 0x01000193);
  }
  const hex2 = (h2 >>> 0).toString(16).padStart(8, "0");
  return `${hex}${hex2}`.slice(0, length);
}

/** Stable join of key=value pairs for fingerprint payloads. */
export function stableJoin(
  entries: ReadonlyArray<readonly [string, string | number]>,
): string {
  return entries.map(([k, v]) => `${k}=${String(v).trim()}`).join("|");
}

/**
 * Fingerprint of L2 lane constraints + pool option sets.
 * Changes when pools or fixed constraints change; ignores runtime state.
 */
export function blueprintFingerprint(blueprint: SlotBlueprint): string {
  const poolPayload = CONTROLLED_POOL_KEYS.map((key) => {
    const options = blueprint.controlledPools[key];
    return `${key}:[${options.join(";;")}]`;
  }).join("||");

  const payload = stableJoin([
    ["id", blueprint.id],
    ["version", blueprint.version],
    ["archetypeId", blueprint.archetypeId],
    ["slot", blueprint.slot],
    ["gender", blueprint.gender],
    ["ageRange", blueprint.ageRange],
    ["regionalCluster", blueprint.regionalCluster],
    ["skinToneRange", blueprint.skinToneRange],
    ["bodyDirection", blueprint.bodyDirection],
    ["facialProportionFamily", blueprint.facialProportionFamily],
    ["hairTextureFamily", blueprint.hairTextureFamily],
    ["facialHairFamily", blueprint.facialHairFamily],
    ["expressionFamily", blueprint.expressionFamily],
    ["qualityBar", blueprint.qualityBar],
    ["garmentCategories", blueprint.garmentCategories.join(",")],
    ["cameraRules", blueprint.cameraRules.join(",")],
    ["crossSlotExclusions", blueprint.crossSlotExclusions.join(",")],
    ["fashionDirection", blueprint.fashionDirection],
    ["brandRole", blueprint.brandRole],
    ["pools", poolPayload],
  ]);

  return identityShortHash(`bp:${payload}`, 16);
}

/** Full identity fingerprint — who this L3 person is (excl. sampledAt / DB ids). */
export function identityFingerprintFromAttributes(
  attrs: Omit<
    DiscoveryIdentityInstance,
    | "id"
    | "sampledAt"
    | "identityFingerprint"
    | "anatomyFingerprint"
    | "promptFingerprint"
  >,
): string {
  const payload = stableJoin([
    ["version", attrs.version],
    ["archetypeId", attrs.archetypeId],
    ["slotBlueprintId", attrs.slotBlueprintId],
    ["generationRunId", attrs.generationRunId],
    ["creationProjectId", attrs.creationProjectId],
    ["slot", attrs.slot],
    ["attemptNumber", attrs.attemptNumber],
    ["samplingSeed", attrs.samplingSeed],
    ["exactAge", attrs.exactAge],
    ["gender", attrs.gender],
    ["regionalCluster", attrs.regionalCluster],
    ["skinToneExact", attrs.skinToneExact],
    ["facialRatioVariant", attrs.facialRatioVariant],
    ["faceGeometry", attrs.faceGeometry],
    ["forehead", attrs.forehead],
    ["eyebrows", attrs.eyebrows],
    ["eyeShape", attrs.eyeShape],
    ["eyeSpacing", attrs.eyeSpacing],
    ["noseBridge", attrs.noseBridge],
    ["noseWidth", attrs.noseWidth],
    ["noseTip", attrs.noseTip],
    ["jaw", attrs.jaw],
    ["chin", attrs.chin],
    ["cheekbones", attrs.cheekbones],
    ["lips", attrs.lips],
    ["ears", attrs.ears],
    ["hairline", attrs.hairline],
    ["haircut", attrs.haircut],
    ["beardPattern", attrs.beardPattern],
    ["microExpression", attrs.microExpression],
    ["asymmetry", attrs.asymmetry],
    ["optionalMicroMarks", attrs.optionalMicroMarks],
    ["garmentColor", attrs.garmentColor],
    ["castingBackground", attrs.castingBackground],
    ["source", attrs.source],
  ]);
  return identityShortHash(`id:${payload}`, 16);
}

/**
 * Anatomy-only fingerprint — biological identity axes.
 * Used for cross-slot uniqueness and anatomy change detection.
 */
export function anatomyFingerprintFromAttributes(attrs: {
  gender: string;
  regionalCluster: string;
  exactAge: number;
  skinToneExact: string;
  facialRatioVariant: string;
  faceGeometry: string;
  forehead: string;
  eyebrows: string;
  eyeShape: string;
  eyeSpacing: string;
  noseBridge: string;
  noseWidth: string;
  noseTip: string;
  jaw: string;
  chin: string;
  cheekbones: string;
  lips: string;
  ears: string;
  hairline: string;
  haircut: string;
  beardPattern: string;
  asymmetry: string;
  optionalMicroMarks: string;
}): string {
  const payload = stableJoin([
    ["gender", attrs.gender],
    ["regionalCluster", attrs.regionalCluster],
    ["exactAge", attrs.exactAge],
    ["skinToneExact", attrs.skinToneExact],
    ["facialRatioVariant", attrs.facialRatioVariant],
    ["faceGeometry", attrs.faceGeometry],
    ["forehead", attrs.forehead],
    ["eyebrows", attrs.eyebrows],
    ["eyeShape", attrs.eyeShape],
    ["eyeSpacing", attrs.eyeSpacing],
    ["noseBridge", attrs.noseBridge],
    ["noseWidth", attrs.noseWidth],
    ["noseTip", attrs.noseTip],
    ["jaw", attrs.jaw],
    ["chin", attrs.chin],
    ["cheekbones", attrs.cheekbones],
    ["lips", attrs.lips],
    ["ears", attrs.ears],
    ["hairline", attrs.hairline],
    ["haircut", attrs.haircut],
    ["beardPattern", attrs.beardPattern],
    ["asymmetry", attrs.asymmetry],
    ["optionalMicroMarks", attrs.optionalMicroMarks],
  ]);
  return identityShortHash(`anatomy:${payload}`, 16);
}

/** High-leverage combination key for diversity / anti-repeat. */
export function highLeverageCombinationKey(attrs: {
  noseBridge: string;
  noseWidth: string;
  noseTip: string;
  eyeSpacing: string;
  eyeShape: string;
  jaw: string;
  chin: string;
  hairline: string;
  haircut: string;
  beardPattern: string;
  asymmetry: string;
  optionalMicroMarks: string;
}): string {
  return [
    attrs.noseBridge,
    attrs.noseWidth,
    attrs.noseTip,
    attrs.eyeSpacing,
    attrs.eyeShape,
    attrs.jaw,
    attrs.chin,
    attrs.hairline,
    attrs.haircut,
    attrs.beardPattern,
    attrs.asymmetry,
    attrs.optionalMicroMarks,
  ].join("||");
}

export function noseJawEyeTriple(attrs: {
  noseBridge: string;
  noseWidth: string;
  noseTip: string;
  jaw: string;
  eyeSpacing: string;
}): string {
  return [
    attrs.noseBridge,
    attrs.noseWidth,
    attrs.noseTip,
    attrs.jaw,
    attrs.eyeSpacing,
  ].join("||");
}

export function hairBeardTriple(attrs: {
  hairline: string;
  haircut: string;
  beardPattern: string;
}): string {
  return [attrs.hairline, attrs.haircut, attrs.beardPattern].join("||");
}

export function promptFingerprintFromText(text: string): string {
  return identityShortHash(`prompt:${text}`, 16);
}
