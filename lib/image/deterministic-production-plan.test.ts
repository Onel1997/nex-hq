import assert from "node:assert/strict";
import test from "node:test";
import { createDeterministicImageProductionPlan } from "./deterministic-production-plan";

test("deterministic production planning is complete and preserves authority wording", () => {
  const output = createDeterministicImageProductionPlan({
    brief: "Quiet concrete campaign with an evening editorial mood",
    workspaceName: "Milaene",
    productName: "Heavy Zip Hoodie",
    collectionName: "Autumn",
    color: "Black",
    material: "Heavy cotton",
  });
  assert.equal(output.productionAssets.length, 18);
  assert.equal(output.lookbookShots.length, 4);
  assert.match(output.productionAssets[0].prompt.openai, /do not redesign/i);
  assert.match(output.fullProject, /not generated artwork/i);
  assert.equal(output.confidence, 1);
});
