import assert from "node:assert/strict";
import test from "node:test";
import {
  CONTENT_PACKS,
  contentPackProgress,
  contentPackShots,
  contentShotById,
  isShotCompatible,
  normalizeProductShotKind,
  resolveContentShotForSide,
  shotSupportsPrintSide,
  type ContentPackLineage,
} from "./content-packs";
import { createDeterministicImageProductionPlan } from "./deterministic-production-plan";

const authority = {
  artworkId: "artwork-1",
  artworkVersion: "V3",
  artworkChecksum: "a".repeat(64),
  productProfileId: "shopify:product-1",
  productProfileVersion: 4,
  variantId: "variant-1",
  brandModelId: "model-1",
};

test("Basis-Pack contains exactly the five approved planning shots", () => {
  assert.deepEqual(CONTENT_PACKS.BASE.shotIds, [
    "content:shopify-product-image",
    "content:lifestyle-with-model",
    "content:premium-flatlay",
    "content:hanger-or-rack",
    "content:social-hero-story",
  ]);
  assert.equal(contentPackShots("BASE", "Oversized Tee").length, 5);
});

test("Winning Design Expansion is manual planning with fifteen selectable shots", () => {
  assert.equal(CONTENT_PACKS.WINNING_EXPANSION.shotIds.length, 15);
  assert.ok(
    CONTENT_PACKS.WINNING_EXPANSION.shotIds.includes("content:clean-front"),
  );
  assert.ok(
    CONTENT_PACKS.WINNING_EXPANSION.shotIds.includes("content:story-vertical"),
  );
});

test("canonical Content Pack shots carry non-executing side recommendations", () => {
  assert.equal(contentShotById("content:clean-front")?.sideIntent, "FRONT");
  assert.equal(contentShotById("content:clean-back")?.sideIntent, "BACK");
  assert.equal(contentShotById("content:premium-flatlay")?.sideIntent, "FRONT");
  assert.equal(
    contentShotById("content:styled-flatlay")?.sideIntent,
    "OWNER_SELECTABLE",
  );
});

test("side-specific shot resolution never pretends a front-only view shows a back print", () => {
  assert.equal(shotSupportsPrintSide("content:clean-front", "FRONT"), true);
  assert.equal(
    resolveContentShotForSide("content:clean-front", "BACK")?.id,
    "content:clean-back",
  );
  assert.equal(
    resolveContentShotForSide("content:shopify-product-image", "BACK")?.id,
    "content:clean-back",
  );
  assert.equal(resolveContentShotForSide("missing-shot", "BACK"), null);
});

test("product compatibility is deterministic and unknown products get generic safe shots only", () => {
  assert.equal(normalizeProductShotKind("Heavy Zip Hoodie"), "ZIP_HOODIE");
  assert.equal(normalizeProductShotKind("Heavy Jogger"), "JOGGER");
  assert.equal(normalizeProductShotKind("Unmapped Future Object"), "GENERIC");
  assert.equal(
    isShotCompatible("content:zipper-detail", "Heavy Zip Hoodie"),
    true,
  );
  assert.equal(
    isShotCompatible("content:zipper-detail", "Oversized Tee"),
    false,
  );
  assert.equal(
    isShotCompatible("content:hanger-or-rack", "Unmapped Future Object"),
    false,
  );
  assert.equal(
    isShotCompatible("content:shopify-product-image", "Unmapped Future Object"),
    true,
  );
});

test("pack progress counts only exact Artwork, Product version, variant, Model, and shot lineage", () => {
  const exact: ContentPackLineage = {
    shotId: "content:lifestyle-with-model",
    ...authority,
    reviewStatus: "APPROVED",
  };
  const wrongProductVersion = {
    ...exact,
    shotId: "content:premium-flatlay",
    productProfileVersion: 3,
  };
  const wrongModel = {
    ...exact,
    shotId: "content:social-hero-story",
    brandModelId: "model-2",
  };
  const reviewRequired = {
    ...exact,
    shotId: "content:shopify-product-image",
    reviewStatus: "REVIEW_REQUIRED" as const,
  };
  const rejected = {
    ...exact,
    shotId: "content:hanger-or-rack",
    reviewStatus: "REJECTED" as const,
  };
  const progress = contentPackProgress("BASE", authority, [
    exact,
    wrongProductVersion,
    wrongModel,
    reviewRequired,
    rejected,
  ]);
  assert.deepEqual(
    Object.fromEntries(progress.map((entry) => [entry.shot.id, entry.status])),
    {
      "content:shopify-product-image": "IN_REVIEW",
      "content:lifestyle-with-model": "APPROVED",
      "content:premium-flatlay": "NOT_CREATED",
      "content:hanger-or-rack": "REJECTED",
      "content:social-hero-story": "NOT_CREATED",
    },
  );
});

test("deterministic plan exposes packs as individual assets without batch execution semantics", () => {
  const plan = createDeterministicImageProductionPlan({
    brief: "Create a calm production plan for one approved design.",
    workspaceName: "Milaene",
    productName: "Heavy Tee",
    color: "Black",
    material: "Cotton",
  });
  assert.ok(plan.productionAssets.length <= 48);
  assert.equal(
    new Set(plan.productionAssets.map((asset) => asset.id)).size,
    plan.productionAssets.length,
  );
  for (const id of [
    ...CONTENT_PACKS.BASE.shotIds,
    ...CONTENT_PACKS.WINNING_EXPANSION.shotIds,
  ]) {
    assert.equal(
      plan.productionAssets.filter((asset) => asset.id === id).length,
      1,
    );
  }
  assert.equal(
    plan.productionAssets.every((asset) => asset.status === "pending"),
    true,
  );
});
