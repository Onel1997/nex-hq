/**
 * Phase 2.1A — Identity Blueprint Engine foundation tests.
 * No OpenAI / provider calls. Face novelty untouched.
 */

import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  HIGH_LEVERAGE_POOL_KEYS,
  MEDITERRANEAN_SLOT_BLUEPRINTS,
  anatomyFingerprintFromAttributes,
  blueprintFingerprint,
  discoveryIdentityPromptContainsIdentityLockWording,
  discoveryIdentityPromptContainsNewIndividualWording,
  formatDiscoveryIdentityInstancePrompt,
  getMediterraneanSlotBlueprint,
  highLeverageCombinationKey,
  identityFingerprintFromAttributes,
  listMediterraneanSlotBlueprints,
  parseAgeRange,
  promptFingerprintFromText,
  sampleDiscoveryCast,
  sampleDiscoveryIdentityInstance,
  validateCrossSlotIdentityDiversity,
  validateDiscoveryIdentityInstance,
  validateIdentityWithinBlueprint,
  validateSlotBlueprint,
  type DiscoveryIdentityInstance,
  type SlotBlueprint,
} from "./index";

const MODULE_DIR = join(process.cwd(), "lib/persona/identity-blueprints");
const SAMPLED_AT = "2026-08-05T12:00:00.000Z";

function sampleSlot(
  slot: "A" | "B" | "C" | "D",
  runId: string,
  attempt = 1,
  projectId = "proj-test-1",
): DiscoveryIdentityInstance {
  return sampleDiscoveryIdentityInstance({
    slotBlueprint: getMediterraneanSlotBlueprint(slot),
    creationProjectId: projectId,
    generationRunId: runId,
    attemptNumber: attempt,
    sampledAt: SAMPLED_AT,
  });
}

function cloneBlueprint(bp: SlotBlueprint): SlotBlueprint {
  return {
    ...bp,
    garmentCategories: [...bp.garmentCategories],
    cameraRules: [...bp.cameraRules],
    crossSlotExclusions: [...bp.crossSlotExclusions],
    controlledPools: {
      skinToneExact: [...bp.controlledPools.skinToneExact],
      facialRatioVariant: [...bp.controlledPools.facialRatioVariant],
      faceGeometry: [...bp.controlledPools.faceGeometry],
      forehead: [...bp.controlledPools.forehead],
      eyebrows: [...bp.controlledPools.eyebrows],
      eyeShape: [...bp.controlledPools.eyeShape],
      eyeSpacing: [...bp.controlledPools.eyeSpacing],
      noseBridge: [...bp.controlledPools.noseBridge],
      noseWidth: [...bp.controlledPools.noseWidth],
      noseTip: [...bp.controlledPools.noseTip],
      jaw: [...bp.controlledPools.jaw],
      chin: [...bp.controlledPools.chin],
      cheekbones: [...bp.controlledPools.cheekbones],
      lips: [...bp.controlledPools.lips],
      ears: [...bp.controlledPools.ears],
      hairline: [...bp.controlledPools.hairline],
      haircut: [...bp.controlledPools.haircut],
      beardPattern: [...bp.controlledPools.beardPattern],
      microExpression: [...bp.controlledPools.microExpression],
      asymmetry: [...bp.controlledPools.asymmetry],
      optionalMicroMarks: [...bp.controlledPools.optionalMicroMarks],
      garmentColor: [...bp.controlledPools.garmentColor],
      castingBackground: [...bp.controlledPools.castingBackground],
    },
  };
}

function listModuleSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) continue;
    if (name.endsWith(".ts")) out.push(full);
  }
  return out;
}

describe("Phase 2.1A Identity Blueprint Engine", () => {
  it("1. same inputs reproduce the same L3 instance", () => {
    const a = sampleSlot("A", "run-identical-1", 1);
    const b = sampleSlot("A", "run-identical-1", 1);
    assert.equal(a.identityFingerprint, b.identityFingerprint);
    assert.equal(a.anatomyFingerprint, b.anatomyFingerprint);
    assert.equal(a.samplingSeed, b.samplingSeed);
    assert.equal(a.noseBridge, b.noseBridge);
    assert.equal(a.jaw, b.jaw);
    assert.equal(a.exactAge, b.exactAge);
  });

  it("2. different generation run produces a different instance", () => {
    const a = sampleSlot("A", "run-aaa", 1);
    const b = sampleSlot("A", "run-bbb", 1);
    assert.notEqual(a.anatomyFingerprint, b.anatomyFingerprint);
    assert.notEqual(a.samplingSeed, b.samplingSeed);
  });

  it("3. different attempt produces a different instance", () => {
    const a = sampleSlot("B", "run-attempt", 1);
    const b = sampleSlot("B", "run-attempt", 2);
    assert.notEqual(a.anatomyFingerprint, b.anatomyFingerprint);
    assert.notEqual(
      highLeverageCombinationKey(a),
      highLeverageCombinationKey(b),
    );
  });

  it("4. slots A–D produce distinct anatomy", () => {
    const cast = sampleDiscoveryCast({
      blueprints: listMediterraneanSlotBlueprints(),
      creationProjectId: "proj-cast",
      generationRunId: "run-cast-1",
      attemptNumber: 1,
      sampledAt: SAMPLED_AT,
    });
    assert.equal(cast.length, 4);
    const anatomies = cast.map((c) => c.anatomyFingerprint);
    assert.equal(new Set(anatomies).size, 4);
    const diversity = validateCrossSlotIdentityDiversity(cast);
    assert.equal(diversity.ok, true, JSON.stringify(diversity.issues));
  });

  it("5. high-leverage axes rotate across attempts", () => {
    const attempts = [1, 2, 3, 4].map((n) =>
      sampleSlot("A", "run-hl-rotate", n),
    );
    const combos = attempts.map((i) => highLeverageCombinationKey(i));
    assert.equal(new Set(combos).size, combos.length);
    const noseTips = new Set(attempts.map((i) => i.noseTip));
    const jaws = new Set(attempts.map((i) => i.jaw));
    assert.ok(noseTips.size + jaws.size >= 3);
  });

  it("6. blueprint fixed constraints remain stable across samples", () => {
    const bp = getMediterraneanSlotBlueprint("A");
    const a = sampleSlot("A", "run-fixed-1", 1);
    const b = sampleSlot("A", "run-fixed-2", 3);
    assert.equal(a.gender, bp.gender);
    assert.equal(b.gender, bp.gender);
    assert.equal(a.regionalCluster, bp.regionalCluster);
    assert.equal(b.regionalCluster, bp.regionalCluster);
    assert.equal(a.slotBlueprintId, bp.id);
    assert.equal(b.slotBlueprintId, bp.id);
  });

  it("7. every sample stays inside its controlled pools", () => {
    for (const bp of MEDITERRANEAN_SLOT_BLUEPRINTS) {
      const instance = sampleDiscoveryIdentityInstance({
        slotBlueprint: bp,
        creationProjectId: "proj-pool",
        generationRunId: `run-pool-${bp.slot}`,
        attemptNumber: 2,
        sampledAt: SAMPLED_AT,
      });
      const within = validateIdentityWithinBlueprint(instance, bp);
      assert.equal(within.ok, true, JSON.stringify(within.issues));
    }
  });

  it("8. age stays inside range", () => {
    for (const bp of MEDITERRANEAN_SLOT_BLUEPRINTS) {
      const band = parseAgeRange(bp.ageRange);
      assert.ok(band);
      for (let attempt = 1; attempt <= 5; attempt += 1) {
        const instance = sampleDiscoveryIdentityInstance({
          slotBlueprint: bp,
          creationProjectId: "proj-age",
          generationRunId: `run-age-${bp.slot}`,
          attemptNumber: attempt,
          sampledAt: SAMPLED_AT,
        });
        assert.ok(instance.exactAge >= band!.min);
        assert.ok(instance.exactAge <= band!.max);
      }
    }
  });

  it("9. gender remains fixed", () => {
    for (const bp of MEDITERRANEAN_SLOT_BLUEPRINTS) {
      const instance = sampleSlot(bp.slot, `run-gender-${bp.slot}`, 1);
      assert.equal(instance.gender, "male");
      assert.equal(instance.gender, bp.gender);
    }
  });

  it("10. regional cluster remains fixed", () => {
    const a = sampleSlot("A", "run-region", 1);
    const b = sampleSlot("B", "run-region", 1);
    assert.equal(
      a.regionalCluster,
      "Spanish Mediterranean / Iberian soft luxury",
    );
    assert.equal(b.regionalCluster, "North African / Maghrebi street premium");
    assert.notEqual(a.regionalCluster, b.regionalCluster);
  });

  it("11. no Math.random is used in the module", () => {
    const files = listModuleSourceFiles(MODULE_DIR).filter(
      (f) => !f.endsWith(".test.ts"),
    );
    assert.ok(files.length >= 8);
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      // Ban runtime Math.random() — comments mentioning the ban are allowed.
      assert.equal(
        /Math\.random\s*\(/.test(src),
        false,
        `Math.random() found in ${file}`,
      );
    }
  });

  it("12. cross-slot duplicate anatomy is rejected", () => {
    const cast = sampleDiscoveryCast({
      blueprints: listMediterraneanSlotBlueprints(),
      creationProjectId: "proj-dup",
      generationRunId: "run-dup",
      sampledAt: SAMPLED_AT,
    });
    const clone: DiscoveryIdentityInstance = {
      ...cast[0]!,
      slot: "B",
      id: "forced-dup",
    };
    const result = validateCrossSlotIdentityDiversity([cast[0]!, clone]);
    assert.equal(result.ok, false);
    assert.ok(
      result.issues.some((i) => i.code === "DUPLICATE_ANATOMY_FINGERPRINT"),
    );
  });

  it("13. invalid pool value is rejected", () => {
    const bp = getMediterraneanSlotBlueprint("A");
    const instance = sampleSlot("A", "run-invalid-pool", 1);
    const bad: DiscoveryIdentityInstance = {
      ...instance,
      noseBridge: "NOT_IN_POOL_VALUE",
      anatomyFingerprint: anatomyFingerprintFromAttributes({
        ...instance,
        noseBridge: "NOT_IN_POOL_VALUE",
      }),
    };
    const result = validateIdentityWithinBlueprint(bad, bp);
    assert.equal(result.ok, false);
    assert.ok(result.issues.some((i) => i.code === "VALUE_NOT_IN_POOL"));
  });

  it("14. empty pool is rejected", () => {
    const bp = cloneBlueprint(getMediterraneanSlotBlueprint("A"));
    const mutated: SlotBlueprint = {
      ...bp,
      controlledPools: {
        ...bp.controlledPools,
        jaw: [],
      },
    };
    const result = validateSlotBlueprint(mutated);
    assert.equal(result.ok, false);
    assert.ok(result.issues.some((i) => i.code === "INVALID_POOL"));
  });

  it("15. absolute-person language in L2 is rejected", () => {
    const bp = cloneBlueprint(getMediterraneanSlotBlueprint("A"));
    const mutated: SlotBlueprint = {
      ...bp,
      qualityBar: "Do not invent a different person — lock this identity",
    };
    const result = validateSlotBlueprint(mutated);
    assert.equal(result.ok, false);
    assert.ok(
      result.issues.some((i) => i.code === "ABSOLUTE_PERSON_LANGUAGE"),
    );
  });

  it("16. prompt formatter says new individual", () => {
    const instance = sampleSlot("C", "run-prompt", 1);
    const prompt = formatDiscoveryIdentityInstancePrompt(instance);
    assert.equal(
      discoveryIdentityPromptContainsNewIndividualWording(prompt),
      true,
    );
  });

  it("17. prompt formatter contains no identity-lock wording", () => {
    const instance = sampleSlot("D", "run-prompt-lock", 1);
    const prompt = formatDiscoveryIdentityInstancePrompt(instance);
    assert.equal(
      discoveryIdentityPromptContainsIdentityLockWording(prompt),
      false,
    );
    assert.equal(/brand memory/i.test(prompt), false);
    assert.equal(/product intelligence/i.test(prompt), false);
    assert.equal(/^Avoid:/m.test(prompt), false);
  });

  it("18. fingerprints are deterministic", () => {
    const a = sampleSlot("A", "run-fp", 1);
    const b = sampleSlot("A", "run-fp", 1);
    assert.equal(a.identityFingerprint, b.identityFingerprint);
    assert.equal(a.anatomyFingerprint, b.anatomyFingerprint);
    assert.equal(a.promptFingerprint, b.promptFingerprint);
    const bpFp1 = blueprintFingerprint(getMediterraneanSlotBlueprint("A"));
    const bpFp2 = blueprintFingerprint(getMediterraneanSlotBlueprint("A"));
    assert.equal(bpFp1, bpFp2);
  });

  it("19. fingerprint changes when anatomy changes", () => {
    const a = sampleSlot("A", "run-fp-change", 1);
    const b = sampleSlot("A", "run-fp-change", 2);
    assert.notEqual(a.anatomyFingerprint, b.anatomyFingerprint);
    assert.notEqual(a.identityFingerprint, b.identityFingerprint);
    const mutated = {
      ...a,
      jaw: a.jaw === getMediterraneanSlotBlueprint("A").controlledPools.jaw[0]
        ? getMediterraneanSlotBlueprint("A").controlledPools.jaw[1]!
        : getMediterraneanSlotBlueprint("A").controlledPools.jaw[0]!,
    };
    assert.notEqual(
      anatomyFingerprintFromAttributes(a),
      anatomyFingerprintFromAttributes(mutated),
    );
    assert.notEqual(
      identityFingerprintFromAttributes({
        ...a,
        jaw: mutated.jaw,
      }),
      a.identityFingerprint,
    );
    assert.notEqual(
      promptFingerprintFromText(formatDiscoveryIdentityInstancePrompt(a)),
      promptFingerprintFromText(
        formatDiscoveryIdentityInstancePrompt({ ...a, jaw: mutated.jaw }),
      ),
    );
  });

  it("20. no OpenAI/provider call occurs", () => {
    const files = listModuleSourceFiles(MODULE_DIR).filter(
      (f) => !f.endsWith(".test.ts"),
    );
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      assert.equal(src.includes("generateOpenAiImage"), false, file);
      assert.equal(src.includes("openai.images"), false, file);
      assert.equal(src.includes("@/agents/image"), false, file);
      assert.equal(src.includes("from \"openai\""), false, file);
    }
    // Sampling itself must succeed without network.
    sampleSlot("A", "run-no-openai", 1);
  });

  it("21. face novelty code remains untouched (module isolation)", () => {
    const files = listModuleSourceFiles(MODULE_DIR).filter(
      (f) => !f.endsWith(".test.ts"),
    );
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      assert.equal(src.includes("face-novelty-memory"), false, file);
      assert.equal(src.includes("faceRecognitionNet"), false, file);
      assert.equal(src.includes("FACE_SIMILARITY"), false, file);
    }
  });

  it("22. Mediterranean L2 blueprints validate and pools meet minimums", () => {
    for (const bp of MEDITERRANEAN_SLOT_BLUEPRINTS) {
      const result = validateSlotBlueprint(bp);
      assert.equal(result.ok, true, `${bp.slot}: ${JSON.stringify(result.issues)}`);
      for (const key of HIGH_LEVERAGE_POOL_KEYS) {
        assert.ok(
          bp.controlledPools[key].length >= 4,
          `${bp.slot}.${key} needs >= 4`,
        );
      }
      assert.ok(bp.controlledPools.optionalMicroMarks.includes("none"));
    }
    assert.equal(MEDITERRANEAN_SLOT_BLUEPRINTS.length, 4);
  });

  it("validateDiscoveryIdentityInstance rejects attemptNumber < 1", () => {
    const good = sampleSlot("A", "run-attempt-val", 1);
    const bad = { ...good, attemptNumber: 0 };
    const result = validateDiscoveryIdentityInstance(bad);
    assert.equal(result.ok, false);
    assert.ok(result.issues.some((i) => i.code === "INVALID_ATTEMPT"));
  });

  it("sampledAt does not affect anatomy fingerprint", () => {
    const a = sampleDiscoveryIdentityInstance({
      slotBlueprint: getMediterraneanSlotBlueprint("A"),
      creationProjectId: "proj-ts",
      generationRunId: "run-ts",
      attemptNumber: 1,
      sampledAt: "2020-01-01T00:00:00.000Z",
    });
    const b = sampleDiscoveryIdentityInstance({
      slotBlueprint: getMediterraneanSlotBlueprint("A"),
      creationProjectId: "proj-ts",
      generationRunId: "run-ts",
      attemptNumber: 1,
      sampledAt: "2026-08-05T12:00:00.000Z",
    });
    assert.equal(a.anatomyFingerprint, b.anatomyFingerprint);
    assert.equal(a.identityFingerprint, b.identityFingerprint);
    assert.notEqual(a.sampledAt, b.sampledAt);
  });
});
