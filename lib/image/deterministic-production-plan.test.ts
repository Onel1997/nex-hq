import assert from "node:assert/strict";
import test from "node:test";
import { createDeterministicImageProductionPlan } from "./deterministic-production-plan";
import { CONTENT_SHOTS } from "./content-packs";

test("deterministic production planning is complete and preserves authority wording", () => {
  const output = createDeterministicImageProductionPlan({
    brief: "Quiet concrete campaign with an evening editorial mood",
    workspaceName: "Milaene",
    productName: "Heavy Zip Hoodie",
    collectionName: "Autumn",
    color: "Black",
    material: "Heavy cotton",
  });
  assert.equal(output.productionAssets.length, 18 + CONTENT_SHOTS.length);
  assert.equal(output.lookbookShots.length, 4);
  assert.match(output.productionAssets[0].prompt.openai, /do not redesign/i);
  assert.match(output.fullProject, /not generated artwork/i);
  assert.equal(output.confidence, 1);
});

test("one-character legacy Product hints cannot invalidate optional moodboard context", () => {
  const output = createDeterministicImageProductionPlan({
    brief: "Approved Artwork handoff for deterministic Image Studio production.",
    workspaceName: "Milaene",
    productName: "—",
    collectionName: "—",
    color: "—",
    material: "—",
  });

  assert.equal(output.moodboard.colorSystem[0], "As selected in production context");
  assert.ok(
    output.moodboard.colorSystem.every((entry) => entry.trim().length >= 2),
  );
  assert.equal(output.projectName, "Current collection — Selected product");
});
