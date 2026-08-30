import assert from "node:assert/strict";
import test from "node:test";

import {
  buildBothSideProductionPlan,
  type BothSidePlanAuthority,
  type BothSidePlanJob,
} from "@/lib/image/both-side-production-plan";

const authority: BothSidePlanAuthority = {
  artworkId: "artwork-1",
  artworkVersion: "V2",
  artworkChecksum: "a".repeat(64),
  productProfileId: "shopify:product-1",
  productProfileVersion: 4,
  variantId: "variant-1",
  brandModelId: "model-1",
  identityLockVersion: 3,
};

function job(input: {
  side: "FRONT" | "BACK";
  shotId: string;
  status?: string;
  reviewStatus?: string | null;
  artworkId?: string;
  placementPreset?: "FRONT_LARGE" | "FRONT_CENTER_CHEST" | "BACK_LARGE";
}): BothSidePlanJob {
  return {
    id: `job-${input.side.toLowerCase()}`,
    status: input.status ?? "succeeded",
    reviewStatus: input.reviewStatus ?? "REVIEW_REQUIRED",
    inputSnapshot: {
      masterArtwork: {
        artworkId: input.artworkId ?? authority.artworkId!,
        version: authority.artworkVersion!,
        checksum: authority.artworkChecksum!,
      },
      product: {
        productProfileId: authority.productProfileId!,
        profileVersion: authority.productProfileVersion!,
        variantId: authority.variantId,
      },
      brandModel: {
        brandModelId: authority.brandModelId!,
        identityLockVersion: authority.identityLockVersion!,
      },
      semanticPlacement: {
        printSide: input.side,
        placementPreset:
          input.placementPreset ??
          (input.side === "FRONT" ? "FRONT_LARGE" : "BACK_LARGE"),
      },
      shot: { assetId: input.shotId },
    },
  };
}

test("Beidseitig creates two planning entries and zero jobs automatically", () => {
  const plan = buildBothSideProductionPlan({
    preset: "FRONT_SMALL_BACK_LARGE",
    selectedShotId: "content:premium-flatlay",
    authority,
    jobs: [],
  });
  assert.equal(plan.entries.length, 2);
  assert.deepEqual(
    plan.entries.map((entry) => entry.side),
    ["FRONT", "BACK"],
  );
  assert.deepEqual(
    plan.entries.map((entry) => entry.status),
    ["NOT_CREATED", "NOT_CREATED"],
  );
  assert.equal(plan.createdCount, 0);
  assert.equal(
    plan.entries.every((entry) => entry.matchingJobId === null),
    true,
  );
});

test("front completion never marks the back plan entry complete", () => {
  const plan = buildBothSideProductionPlan({
    preset: "FRONT_CENTER_BACK_LARGE",
    selectedShotId: "content:premium-flatlay",
    authority,
    jobs: [
      job({
        side: "FRONT",
        shotId: "content:premium-flatlay",
        reviewStatus: "APPROVED",
        placementPreset: "FRONT_CENTER_CHEST",
      }),
    ],
  });
  assert.equal(plan.entries[0].status, "APPROVED");
  assert.equal(plan.entries[1].status, "NOT_CREATED");
  assert.equal(plan.createdCount, 1);
});

test("front-only shots resolve a distinct rear-facing shot for the back entry", () => {
  const plan = buildBothSideProductionPlan({
    preset: "FRONT_SMALL_BACK_LARGE",
    selectedShotId: "content:clean-front",
    authority,
    jobs: [],
  });
  assert.equal(plan.entries[0].shot?.id, "content:clean-front");
  assert.equal(plan.entries[1].shot?.id, "content:clean-back");
});

test("progress ignores jobs from another Artwork even with matching Product and side", () => {
  const plan = buildBothSideProductionPlan({
    preset: "FRONT_SMALL_BACK_LARGE",
    selectedShotId: "content:premium-flatlay",
    authority,
    jobs: [
      job({
        side: "FRONT",
        shotId: "content:premium-flatlay",
        artworkId: "artwork-other",
      }),
    ],
  });
  assert.equal(plan.createdCount, 0);
  assert.equal(plan.entries[0].status, "NOT_CREATED");
});
