/**
 * Phase 2.5B — Second Official Brand Face casting direction (Urban Community Hero).
 * Config / prompt only — no provider calls.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  URBAN_DISCOVERY_BLUEPRINTS,
  assertDiscoveryCastBlueprintsUnique,
  blueprintHairDescriptor,
  listDiscoveryBlueprintsForArchetype,
} from "@/lib/brand-archetypes/discovery-blueprints";
import { loadBrandArchetypeCatalog } from "@/lib/brand-archetypes";
import {
  URBAN_ARCHETYPE_ID,
  URBAN_SLOT_BLUEPRINTS,
  listSlotBlueprintsForArchetype,
  validateSlotBlueprint,
} from "@/lib/persona/identity-blueprints";
import {
  URBAN_CASTING_DIVERSITY_FACE_GEOMETRY,
  URBAN_CASTING_DIVERSITY_HAIR_SILHOUETTES,
  URBAN_HAIR_LANE_POOL,
  buildUrbanFreshRunRecipe,
  premiumArchetypeCastingBlock,
  slotCastingCameraBlock,
} from "@/lib/persona/creation/candidate-intelligence";
import {
  DEFAULT_DISCOVERY_PROVIDER,
  resolveConfiguredDiscoveryProviderId,
} from "@/lib/persona/creation/provider/discovery-provider-config";

const ROOT = process.cwd();
const ARCH_URBAN = "arch-urban-community-hero";
const ARCH_MED = "arch-mediterranean-premium-hero";

describe("Phase 2.5B — Second Brand Face casting direction", () => {
  it("1. second model direction is dark-skinned male", () => {
    const catalog = loadBrandArchetypeCatalog("ws-milaene");
    const urban = catalog.archetypes.find((a) => a.id === ARCH_URBAN);
    assert.ok(urban);
    assert.equal(urban!.genderPresentation, "Male");
    assert.match(urban!.ethnicityDirection, /Black|dark-skinned|Afro-European/i);
    assert.match(urban!.identityDnaId, /urban/);
    for (const bp of URBAN_DISCOVERY_BLUEPRINTS) {
      assert.equal(bp.gender, "male");
      assert.match(bp.skinTone, /brown|ebony|Black|deep/i);
    }
  });

  it("2. age remains 21–24 apparent", () => {
    const catalog = loadBrandArchetypeCatalog("ws-milaene");
    const urban = catalog.archetypes.find((a) => a.id === ARCH_URBAN)!;
    assert.equal(urban.ageRange, "21-24");
    for (const bp of URBAN_DISCOVERY_BLUEPRINTS) {
      assert.equal(bp.ageRange, "21-24");
    }
    for (const lane of URBAN_SLOT_BLUEPRINTS) {
      assert.equal(lane.ageRange, "21-24");
    }
  });

  it("3–5. fresh-run hair pool rotates; short and longer styles allowed", () => {
    assert.ok(URBAN_HAIR_LANE_POOL.some((h) => /braids|locs|twists/i.test(h.label)));
    assert.ok(URBAN_HAIR_LANE_POOL.some((h) => h.length === "short"));
    const recipe = buildUrbanFreshRunRecipe("proj-25b-direction-hair");
    assert.equal(new Set(Object.values(recipe.hairLanes)).size, 4);
    assert.equal(new Set(Object.values(URBAN_CASTING_DIVERSITY_HAIR_SILHOUETTES)).size, 4);
  });

  it("4–6. A/B/C/D face geometry differs + uniqueness holds", () => {
    assert.equal(new Set(Object.values(URBAN_CASTING_DIVERSITY_FACE_GEOMETRY)).size, 4);
    const faces = URBAN_DISCOVERY_BLUEPRINTS.map((bp) => bp.faceGeometry);
    assert.equal(new Set(faces).size, 4);
    assert.doesNotThrow(() =>
      assertDiscoveryCastBlueprintsUnique(listDiscoveryBlueprintsForArchetype(ARCH_URBAN)),
    );
    for (const lane of URBAN_SLOT_BLUEPRINTS) {
      const result = validateSlotBlueprint(lane);
      assert.equal(result.ok, true, result.issues.map((i) => i.message).join("; "));
    }
  });

  it("7. first completed Brand Model / Mediterranean direction unchanged by Urban retune", () => {
    const med = listDiscoveryBlueprintsForArchetype(ARCH_MED);
    assert.equal(med.length, 4);
    assert.ok(med.some((b) => /North African Street Premium/i.test(b.name)));
    const lock = readFileSync(
      join(ROOT, "lib/persona/creation/identity-lock/identity-lock-service.ts"),
      "utf8",
    );
    assert.ok(lock.includes("lockBrandIdentity"));
    // Urban file must not rewrite Mediterranean lanes.
    const urbanSrc = readFileSync(
      join(ROOT, "lib/persona/identity-blueprints/urban-slot-blueprints.ts"),
      "utf8",
    );
    assert.doesNotMatch(urbanSrc, /mediterranean|North African|Iberian|Levantine/i);
  });

  it("8. OpenAI remains default discovery provider", () => {
    assert.equal(DEFAULT_DISCOVERY_PROVIDER, "openai");
    const prev = process.env.PERSONA_DISCOVERY_PROVIDER;
    delete process.env.PERSONA_DISCOVERY_PROVIDER;
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-test-25b";
    assert.equal(resolveConfiguredDiscoveryProviderId(), "openai");
    if (prev === undefined) delete process.env.PERSONA_DISCOVERY_PROVIDER;
    else process.env.PERSONA_DISCOVERY_PROVIDER = prev;
  });

  it("9–10. no provider call before confirmation / during these tests", () => {
    const urbanSrc = readFileSync(
      join(ROOT, "lib/persona/identity-blueprints/urban-slot-blueprints.ts"),
      "utf8",
    );
    const archetypes = readFileSync(
      join(ROOT, "lib/brand-archetypes/archetypes.ts"),
      "utf8",
    );
    assert.doesNotMatch(urbanSrc, /generateOpenAi|fal\.ai|fetch\(|axios/i);
    assert.doesNotMatch(archetypes, /generateOpenAi|fal\.ai/i);
  });

  it("11. Reference Package / Identity Lock / Approval architecture unchanged", () => {
    assert.ok(
      readFileSync(
        join(ROOT, "lib/persona/creation/use-approvals/use-approval-service.ts"),
        "utf8",
      ).includes("approveImageUse"),
    );
    assert.ok(
      readFileSync(
        join(ROOT, "lib/persona/creation/identity-lock/identity-lock-service.ts"),
        "utf8",
      ).includes("lockBrandIdentity"),
    );
  });

  it("Urban L2 wired + premium casting uses fresh-run hair lanes", () => {
    const lanes = listSlotBlueprintsForArchetype(URBAN_ARCHETYPE_ID);
    assert.equal(lanes.length, 4);
    const catalog = loadBrandArchetypeCatalog("ws-milaene");
    const urban = catalog.archetypes.find((a) => a.id === ARCH_URBAN)!;
    const block = premiumArchetypeCastingBlock(urban, {
      urbanHairLanes: {
        A: "short buzz cut",
        B: "medium curls",
        C: "braids",
        D: "short locs",
      },
    });
    assert.match(block, /21–24|21-24/);
    assert.match(block, /braids/);
    assert.match(block, /short locs/);
    assert.match(block, /Create new people not based on previous discovery faces/i);
    assert.match(block, /Young fashion-model face with distinctive but believable features/i);
    const cam = slotCastingCameraBlock("B", "urban-community-hero", {
      urbanHairLabel: "medium twists",
      urbanFaceMood: "longer oval impression",
    });
    assert.match(cam, /medium twists/i);
    assert.doesNotMatch(cam, /medium-length relaxed waves/);
  });
});
