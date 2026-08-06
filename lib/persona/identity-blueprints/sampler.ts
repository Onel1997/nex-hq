/**
 * Deterministic L3 Discovery Identity Instance sampler.
 *
 * No Math.random. Seed derives from archetype + slot + run + attempt + blueprint version.
 * High-leverage axes rotate preferentially across attempts.
 * Phase 2.1E adds attempt-aware and same-run collision diversity guards.
 */

import {
  assertAvoidsHistoricalSoftLuxuryCluster,
  assertRetryAxisDiversity,
  assertSameRunCollisionDiversity,
  countRetryAxisDiffs,
  countSameRunAxisDiffs,
  matchesHistoricalSoftLuxuryCluster,
  MIN_RETRY_AXIS_DIFFS,
  RETRY_DIVERSITY_AXES,
  SAME_RUN_AVOID_AXES,
  type RetryDiversityAxis,
} from "./attempt-diversity";
import {
  anatomyFingerprintFromAttributes,
  highLeverageCombinationKey,
  identityFingerprintFromAttributes,
  identityShortHash,
  promptFingerprintFromText,
} from "./fingerprint";
import { parseAgeRange } from "./identity-pools";
import { formatDiscoveryIdentityInstancePrompt } from "./prompt-format";
import {
  CONTROLLED_POOL_KEYS,
  HIGH_LEVERAGE_POOL_KEYS,
  IDENTITY_BLUEPRINT_ENGINE_VERSION,
  IdentityBlueprintError,
  type ControlledPoolKey,
  type DiscoveryIdentityInstance,
  type SampleDiscoveryIdentityInput,
  type SlotBlueprint,
} from "./types";
import {
  validateDiscoveryIdentityInstance,
  validateIdentityWithinBlueprint,
  validateSlotBlueprint,
} from "./validation";

/** Build deterministic sampling seed string (also stored on the instance). */
export function buildSamplingSeed(input: {
  archetypeId: string;
  slot: string;
  generationRunId: string;
  attemptNumber: number;
  blueprintVersion: string;
}): string {
  return identityShortHash(
    [
      "ib-sample",
      input.archetypeId,
      input.slot,
      input.generationRunId,
      `attempt:${input.attemptNumber}`,
      `bp:${input.blueprintVersion}`,
    ].join("|"),
    24,
  );
}

/**
 * Mulberry32 — deterministic PRNG from a 32-bit seed.
 * Used only for pool indexing; never Math.random.
 */
export function createDeterministicRng(seedHex: string): () => number {
  let state = 0;
  for (let i = 0; i < seedHex.length; i += 1) {
    state = Math.imul(state ^ seedHex.charCodeAt(i), 0x9e3779b9) >>> 0;
  }
  if (state === 0) state = 0x1a2b3c4d;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickFromPool(
  pool: readonly string[],
  rng: () => number,
  attemptOffset: number,
): string {
  if (pool.length === 0) {
    throw new IdentityBlueprintError("Cannot sample from empty pool");
  }
  const base = Math.floor(rng() * pool.length);
  const index = (base + attemptOffset) % pool.length;
  return pool[index]!;
}

/**
 * High-leverage axes use a stronger attempt stride so attempt N+1
 * is unlikely to reuse the same high-leverage combination.
 */
function attemptStrideForKey(
  key: ControlledPoolKey,
  attemptNumber: number,
  poolSize: number,
): number {
  if ((HIGH_LEVERAGE_POOL_KEYS as readonly string[]).includes(key)) {
    const axisIndex = HIGH_LEVERAGE_POOL_KEYS.indexOf(
      key as (typeof HIGH_LEVERAGE_POOL_KEYS)[number],
    );
    const stride = 1 + ((axisIndex + 1) % Math.max(1, poolSize - 1));
    return (attemptNumber - 1) * stride;
  }
  return Math.floor((attemptNumber - 1) / 2);
}

function sampleExactAge(ageRange: string, rng: () => number): number {
  const band = parseAgeRange(ageRange);
  if (!band) {
    throw new IdentityBlueprintError(`Invalid ageRange for sampling: ${ageRange}`);
  }
  const span = band.max - band.min + 1;
  return band.min + Math.floor(rng() * span);
}

type RawSample = {
  samplingSeed: string;
  exactAge: number;
  sampled: Record<ControlledPoolKey, string>;
};

function sampleBaseAttributes(
  slotBlueprint: SlotBlueprint,
  generationRunId: string,
  attemptNumber: number,
): RawSample {
  const samplingSeed = buildSamplingSeed({
    archetypeId: slotBlueprint.archetypeId,
    slot: slotBlueprint.slot,
    generationRunId,
    attemptNumber,
    blueprintVersion: slotBlueprint.version,
  });
  const rng = createDeterministicRng(samplingSeed);
  const sampled: Record<ControlledPoolKey, string> = {} as Record<
    ControlledPoolKey,
    string
  >;
  for (const key of CONTROLLED_POOL_KEYS) {
    const pool = slotBlueprint.controlledPools[key];
    const stride = attemptStrideForKey(key, attemptNumber, pool.length);
    sampled[key] = pickFromPool(pool, rng, stride);
  }
  const exactAge = sampleExactAge(slotBlueprint.ageRange, rng);
  return { samplingSeed, exactAge, sampled };
}

function applyHighLeverageAntiRepeat(
  slotBlueprint: SlotBlueprint,
  attemptNumber: number,
  current: RawSample,
  previousHighLeverageKey: string,
): RawSample {
  const sampled = { ...current.sampled };
  let guard = 0;
  while (
    highLeverageCombinationKey(sampled) === previousHighLeverageKey &&
    guard < 16
  ) {
    guard += 1;
    const rerollSeed = identityShortHash(
      `${current.samplingSeed}|hl-reroll|${guard}`,
      24,
    );
    const rerollRng = createDeterministicRng(rerollSeed);
    for (const key of HIGH_LEVERAGE_POOL_KEYS) {
      const pool = slotBlueprint.controlledPools[key];
      const stride =
        attemptStrideForKey(key, attemptNumber, pool.length) + guard;
      sampled[key] = pickFromPool(pool, rerollRng, stride);
    }
  }
  return {
    samplingSeed: current.samplingSeed,
    exactAge: current.exactAge,
    sampled,
  };
}

function pickAvoiding(
  pool: readonly string[],
  rng: () => number,
  offset: number,
  forbidden: ReadonlySet<string>,
): string {
  if (pool.length === 0) {
    throw new IdentityBlueprintError("Cannot sample from empty pool");
  }
  for (let i = 0; i < pool.length; i += 1) {
    const candidate =
      pool[(Math.floor(rng() * pool.length) + offset + i) % pool.length]!;
    if (!forbidden.has(candidate)) return candidate;
  }
  return pickFromPool(pool, rng, offset);
}

/**
 * Reroll retry-diversity / historical-cluster / same-run axes until constraints hold.
 */
function applyAttemptDiversityGuards(input: {
  slotBlueprint: SlotBlueprint;
  attemptNumber: number;
  current: RawSample;
  previousAttemptSample?: Partial<Record<ControlledPoolKey, string>> | null;
  avoidSameRunSample?: Partial<Record<ControlledPoolKey, string>> | null;
}): RawSample {
  const {
    slotBlueprint,
    attemptNumber,
    current,
    previousAttemptSample,
    avoidSameRunSample,
  } = input;
  const sampled = { ...current.sampled };
  let guard = 0;

  const needsPrev =
    attemptNumber > 1 &&
    previousAttemptSample != null &&
    Object.keys(previousAttemptSample).length > 0;
  const needsHistorical = slotBlueprint.slot === "A" && attemptNumber >= 3;
  const needsSameRun =
    avoidSameRunSample != null && Object.keys(avoidSameRunSample).length > 0;

  while (guard < 24) {
    const prevOk =
      !needsPrev ||
      countRetryAxisDiffs(
        sampled as Partial<Record<RetryDiversityAxis, string>>,
        previousAttemptSample as Partial<Record<RetryDiversityAxis, string>>,
      ) >= MIN_RETRY_AXIS_DIFFS;
    const histOk =
      !needsHistorical || !matchesHistoricalSoftLuxuryCluster(sampled);
    const sameOk =
      !needsSameRun ||
      countSameRunAxisDiffs(sampled, avoidSameRunSample!) >= MIN_RETRY_AXIS_DIFFS;

    if (prevOk && histOk && sameOk) break;

    guard += 1;
    const rerollSeed = identityShortHash(
      `${current.samplingSeed}|attempt-div|${guard}`,
      24,
    );
    const rng = createDeterministicRng(rerollSeed);

    const axesToReroll = new Set<ControlledPoolKey>([
      ...RETRY_DIVERSITY_AXES,
      ...SAME_RUN_AVOID_AXES,
      "eyeShape",
      "forehead",
      "facialRatioVariant",
    ]);

    for (const key of axesToReroll) {
      const pool = slotBlueprint.controlledPools[key];
      const forbidden = new Set<string>();
      if (needsPrev && previousAttemptSample?.[key]) {
        forbidden.add(previousAttemptSample[key]!);
      }
      if (needsSameRun && avoidSameRunSample?.[key]) {
        forbidden.add(avoidSameRunSample[key]!);
      }
      sampled[key] = pickAvoiding(
        pool,
        rng,
        attemptStrideForKey(key, attemptNumber, pool.length) + guard,
        forbidden,
      );
    }
  }

  const result: RawSample = {
    samplingSeed: current.samplingSeed,
    exactAge: current.exactAge,
    sampled,
  };

  assertRetryAxisDiversity({
    attemptNumber,
    current: sampled as Partial<Record<RetryDiversityAxis, string>>,
    previous: previousAttemptSample as
      | Partial<Record<RetryDiversityAxis, string>>
      | null
      | undefined,
  });
  assertAvoidsHistoricalSoftLuxuryCluster({
    attemptNumber,
    slot: slotBlueprint.slot,
    sample: sampled,
  });
  assertSameRunCollisionDiversity({
    current: sampled,
    matchedSameRun: avoidSameRunSample,
  });

  return result;
}

/**
 * Final attribute sample for attempt N, applying anti-repeat vs prior attempts.
 * Iterates 1..N so previous high-leverage keys include their own anti-repeat.
 */
function sampleRawAttributes(input: {
  slotBlueprint: SlotBlueprint;
  generationRunId: string;
  attemptNumber: number;
  previousAttemptSample?: Partial<Record<ControlledPoolKey, string>> | null;
  avoidSameRunSample?: Partial<Record<ControlledPoolKey, string>> | null;
}): RawSample {
  const { slotBlueprint, generationRunId, attemptNumber } = input;
  let previousHl: string | null = null;
  let current: RawSample | null = null;

  for (let attempt = 1; attempt <= attemptNumber; attempt += 1) {
    current = sampleBaseAttributes(slotBlueprint, generationRunId, attempt);
    if (previousHl !== null) {
      current = applyHighLeverageAntiRepeat(
        slotBlueprint,
        attempt,
        current,
        previousHl,
      );
    }
    previousHl = highLeverageCombinationKey(current.sampled);
  }

  if (!current) {
    throw new IdentityBlueprintError("Failed to sample attributes");
  }

  return applyAttemptDiversityGuards({
    slotBlueprint,
    attemptNumber,
    current,
    previousAttemptSample: input.previousAttemptSample,
    avoidSameRunSample: input.avoidSameRunSample,
  });
}

/**
 * Sample a concrete L3 person inside an L2 casting lane.
 * Same inputs → same instance (except sampledAt unless provided).
 */
export function sampleDiscoveryIdentityInstance(
  input: SampleDiscoveryIdentityInput,
): DiscoveryIdentityInstance {
  const { slotBlueprint, creationProjectId, generationRunId, attemptNumber } =
    input;

  if (!Number.isInteger(attemptNumber) || attemptNumber < 1) {
    throw new IdentityBlueprintError(
      `attemptNumber must be integer >= 1, got ${attemptNumber}`,
    );
  }

  const bpValidation = validateSlotBlueprint(slotBlueprint);
  if (!bpValidation.ok) {
    throw new IdentityBlueprintError("Invalid SlotBlueprint", {
      issues: bpValidation.issues,
    });
  }

  const { samplingSeed, exactAge, sampled } = sampleRawAttributes({
    slotBlueprint,
    generationRunId,
    attemptNumber,
    previousAttemptSample: input.previousAttemptSample,
    avoidSameRunSample: input.avoidSameRunSample,
  });

  const sampledAt = input.sampledAt ?? new Date().toISOString();

  const core = {
    version: IDENTITY_BLUEPRINT_ENGINE_VERSION,
    archetypeId: slotBlueprint.archetypeId,
    slotBlueprintId: slotBlueprint.id,
    generationRunId,
    creationProjectId,
    slot: slotBlueprint.slot,
    attemptNumber,
    samplingSeed,
    exactAge,
    gender: slotBlueprint.gender,
    regionalCluster: slotBlueprint.regionalCluster,
    skinToneExact: sampled.skinToneExact,
    facialRatioVariant: sampled.facialRatioVariant,
    faceGeometry: sampled.faceGeometry,
    forehead: sampled.forehead,
    eyebrows: sampled.eyebrows,
    eyeShape: sampled.eyeShape,
    eyeSpacing: sampled.eyeSpacing,
    noseBridge: sampled.noseBridge,
    noseWidth: sampled.noseWidth,
    noseTip: sampled.noseTip,
    jaw: sampled.jaw,
    chin: sampled.chin,
    cheekbones: sampled.cheekbones,
    lips: sampled.lips,
    ears: sampled.ears,
    hairline: sampled.hairline,
    haircut: sampled.haircut,
    beardPattern: sampled.beardPattern,
    microExpression: sampled.microExpression,
    asymmetry: sampled.asymmetry,
    optionalMicroMarks: sampled.optionalMicroMarks,
    garmentColor: sampled.garmentColor,
    castingBackground: sampled.castingBackground,
    source: "controlled_sampling" as const,
  };

  const anatomyFingerprint = anatomyFingerprintFromAttributes(core);
  const identityFingerprint = identityFingerprintFromAttributes(core);
  const id = identityShortHash(
    `instance|${identityFingerprint}|${samplingSeed}`,
    20,
  );

  const draft: DiscoveryIdentityInstance = {
    id,
    ...core,
    sampledAt,
    identityFingerprint,
    anatomyFingerprint,
    promptFingerprint: "",
  };

  const prompt = formatDiscoveryIdentityInstancePrompt(draft);
  const instance: DiscoveryIdentityInstance = {
    ...draft,
    promptFingerprint: promptFingerprintFromText(prompt),
  };

  const instanceValidation = validateDiscoveryIdentityInstance(instance);
  if (!instanceValidation.ok) {
    throw new IdentityBlueprintError("Sampled instance failed validation", {
      issues: instanceValidation.issues,
    });
  }

  const within = validateIdentityWithinBlueprint(instance, slotBlueprint);
  if (!within.ok) {
    throw new IdentityBlueprintError(
      "Sampled instance escaped SlotBlueprint constraints",
      { issues: within.issues },
    );
  }

  return instance;
}

/**
 * Sample all four Mediterranean (or archetype) slots for one generation run.
 * Does not call OpenAI.
 */
export function sampleDiscoveryCast(input: {
  blueprints: readonly SlotBlueprint[];
  creationProjectId: string;
  generationRunId: string;
  attemptNumber?: number;
  sampledAt?: string;
}): DiscoveryIdentityInstance[] {
  const attemptNumber = input.attemptNumber ?? 1;
  return input.blueprints.map((slotBlueprint) =>
    sampleDiscoveryIdentityInstance({
      slotBlueprint,
      creationProjectId: input.creationProjectId,
      generationRunId: input.generationRunId,
      attemptNumber,
      sampledAt: input.sampledAt,
    }),
  );
}
