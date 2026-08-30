import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import type { DeterministicRecovery } from "@/lib/image/deterministic-runtime/types";
import {
  formatPreviousRunLocalDateTime,
  previousRunMatchesFilter,
  sortPreviousRunsNewestFirst,
  toPreviousRunOwnerView,
} from "@/lib/image/deterministic-v2-panel/previous-runs";

const SAFE = {
  eligible: true,
  boundary: "DETERMINISTIC_STAGE_B_ONLY" as const,
  openAiRequired: false as const,
  samRequired: false as const,
  reason: "validated",
};

function recovery(input: {
  id: string;
  createdAt: string;
  state?: DeterministicRecovery["state"];
  reviewStatus?: "REVIEW_REQUIRED" | "APPROVED" | "REJECTED";
  failureCode?: string | null;
}): DeterministicRecovery {
  return {
    state: input.state ?? "COMPOSITE_FAILED",
    job: {
      id: input.id,
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
      status: input.reviewStatus ? "succeeded" : "failed",
      inputFingerprint: "a".repeat(64),
      failureCode: input.failureCode ?? null,
      inputSnapshot: {
        masterArtwork: { artworkId: "artwork-id", designId: "legacy-name" },
        product: { productName: "Vacancy T-Shirt", color: "Babyblau" },
        brandModel: { displayName: "North African Street Premium" },
        creativeDirection: { contentMode: "SOCIAL_CONTENT" },
        shot: { title: "Lifestyle" },
        semanticPlacement: {
          displayLabel: "Großer Frontprint",
          placementPreset: "FRONT_LARGE",
        },
        productFamilyPlacement: {
          placementTemplateId: "vacancy-front",
          placementTemplateVersion: 3,
          ownerPlacement: {
            contractVersion: "owner-artwork-placement-v1",
            templateId: "vacancy-front",
            templateVersion: 3,
            uniformScale: 0.9,
            offsetX: 0,
            offsetY: -0.4,
            aspectRatioPolicy: "LOCKED_UNIFORM_CONTAIN",
          },
        },
      },
    } as DeterministicRecovery["job"],
    stages: [
      {
        stageOutputId: "stage",
        jobId: input.id,
        stage: "BASE_GENERATION",
        stageAttempt: 1,
        status: "SUCCEEDED",
        assetId: "stage",
        storagePath: "private",
        checksumSha256: "b".repeat(64),
        providerRequestId: null,
        provenance: {},
        failureCode: null,
        failureMessage: null,
        createdAt: input.createdAt,
      },
    ],
    asset: input.reviewStatus
      ? ({ reviewStatus: input.reviewStatus } as DeterministicRecovery["asset"])
      : null,
  };
}

test("Previous Runs is newest first and formats exact owner-local date and time", () => {
  const oldRun = toPreviousRunOwnerView({
    recovery: recovery({
      id: "11111111-1111-4111-8111-111111111111",
      createdAt: "2026-08-22T17:24:00.000Z",
    }),
    artworkDisplayName: "Timeless",
    retryEligibility: SAFE,
  });
  const currentRun = toPreviousRunOwnerView({
    recovery: recovery({
      id: "16134a53-07c2-42c4-ae5d-47e209d42ccc",
      createdAt: "2026-08-23T17:24:00.000Z",
    }),
    artworkDisplayName: "Timeless Kopie",
    retryEligibility: SAFE,
    thumbnailUrl: "https://signed.example/base",
    thumbnailKind: "STAGE_A_BASE",
  });
  assert.deepEqual(
    sortPreviousRunsNewestFirst([oldRun, currentRun]).map((run) => run.jobId),
    ["16134a53-07c2-42c4-ae5d-47e209d42ccc", oldRun.jobId],
  );
  assert.equal(
    formatPreviousRunLocalDateTime(currentRun.createdAt, "Europe/Berlin"),
    "23.08.2026 · 19:24",
  );
  assert.equal(currentRun.thumbnailKind, "STAGE_A_BASE");
  assert.equal(currentRun.artworkDisplayName, "Timeless Kopie");
  assert.equal(currentRun.productName, "Vacancy T-Shirt");
  assert.equal(currentRun.color, "Babyblau");
  assert.equal(currentRun.brandModelName, "North African Street Premium");
  assert.equal(currentRun.outputGoal, "Social Content");
  assert.equal(currentRun.shotTitle, "Lifestyle");
  assert.equal(currentRun.placementLabel, "Großer Frontprint");
  assert.equal(currentRun.placementHeightLabel, "Höher");
  assert.deepEqual(currentRun.technical.ownerPlacement, {
    scale: 0.9,
    x: 0,
    y: -0.4,
  });
  assert.equal(currentRun.ownerStatus, "Artwork-Anwendung fehlgeschlagen");
  assert.equal(currentRun.retryEligibility.eligible, true);
});

test("review, success, failure and UNKNOWN_OUTCOME filters remain owner-safe", () => {
  const reviewRun = toPreviousRunOwnerView({
    recovery: recovery({
      id: "22222222-2222-4222-8222-222222222222",
      createdAt: "2026-08-23T18:00:00.000Z",
      state: "REVIEW_REQUIRED",
      reviewStatus: "REVIEW_REQUIRED",
    }),
    retryEligibility: { ...SAFE, eligible: false },
  });
  const unknown = toPreviousRunOwnerView({
    recovery: recovery({
      id: "33333333-3333-4333-8333-333333333333",
      createdAt: "2026-08-23T18:10:00.000Z",
      state: "UNKNOWN_PROVIDER_OUTCOME",
    }),
    retryEligibility: {
      ...SAFE,
      eligible: false,
      reason: "unknown outcome",
    },
  });
  assert.equal(reviewRun.ownerStatus, "Zur Prüfung bereit");
  assert.equal(previousRunMatchesFilter(reviewRun, "REVIEW"), true);
  assert.equal(previousRunMatchesFilter(reviewRun, "SUCCESS"), true);
  assert.equal(unknown.ownerStatus, "Unbekannter Ausgang");
  assert.equal(previousRunMatchesFilter(unknown, "FAILED"), true);
  assert.equal(unknown.retryEligibility.eligible, false);
});

test("surface-realism refusal remains recoverable and owner-readable", () => {
  const run = toPreviousRunOwnerView({
    recovery: recovery({
      id: "44444444-4444-4444-8444-444444444444",
      createdAt: "2026-08-25T18:00:00.000Z",
      failureCode: "SURFACE_REALISM_REFINEMENT_UNSAFE",
    }),
    retryEligibility: SAFE,
  });
  assert.equal(run.ownerStatus, "Shirt-Realismus fehlgeschlagen");
  assert.equal(run.retryEligibility.boundary, "DETERMINISTIC_STAGE_B_ONLY");
});

test("history is lazy, opening is read-only, and retry CTA is server-authority gated", async () => {
  const panel = await readFile(
    new URL("../../../components/image/deterministic-v2-panel.tsx", import.meta.url),
    "utf8",
  );
  assert.match(panel, /onToggle=[\s\S]*loadPreviousRuns/);
  assert.match(panel, /\/api\/image\/v2\/jobs\?view=history/);
  assert.match(panel, /await recover\(run\.jobId, "action"\)/);
  assert.match(panel, /run\.retryEligibility\.eligible \?/);
  assert.match(panel, /body\.recovery\.retryEligibility\?\.eligible/);
  assert.match(panel, /Artwork erneut anwenden/);
  assert.match(panel, /<TechnicalDetails>[\s\S]*Auftrag: \{run\.jobId\}/);
  assert.doesNotMatch(panel, /openPreviousRun[\s\S]{0,500}method: "POST"/);
});
