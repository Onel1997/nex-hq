import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";

import {
  applyInputChangeToActiveRun,
  applyRecoveredRunToUi,
  decideRecoveredRunRole,
  emptyV2Checklist,
  initialActiveV2UiState,
  isActiveRunStaleForCurrentInputs,
  jobMatchesCurrentInputs,
  panelInputFingerprint,
  ownerArtworkPlacementFromRecovery,
  resetActivePrepareFlow,
  resetActiveUiForNewPrepare,
  toHistoricalV2Run,
  type CurrentV2Inputs,
  type V2Recovery,
} from "@/lib/image/deterministic-v2-panel/active-run";
import {
  handlePrepareClick,
  initialPrepareFlowState,
  isPrepareButtonEnabled,
  type PrepareAuthorityInputs,
  type V2PreparedJob,
} from "@/lib/image/deterministic-v2-panel/prepare-flow";
import {
  EMPTY_CORNER_FIELDS,
  type CornerFieldValues,
} from "@/lib/image/print-surface/validate-quad";
import {
  createCreativeDirection,
  creativeDirectionPlanningKey,
} from "@/lib/image/social-creative-direction";

const CREATIVE_DIRECTION = createCreativeDirection({
  shotId: "hero",
  contentMode: "SOCIAL_CONTENT",
  presetId: "MINIMAL_INTERIOR",
});

const QUAD_A: CornerFieldValues = {
  tlx: "0.30",
  tly: "0.35",
  trx: "0.70",
  try: "0.35",
  brx: "0.68",
  bry: "0.70",
  blx: "0.32",
  bly: "0.70",
};
const QUAD_B: CornerFieldValues = {
  tlx: "0.22",
  tly: "0.28",
  trx: "0.78",
  try: "0.28",
  brx: "0.76",
  bry: "0.74",
  blx: "0.24",
  bly: "0.74",
};

function pointsToQuad(points: CornerFieldValues) {
  return [
    { x: Number(points.tlx), y: Number(points.tly) },
    { x: Number(points.trx), y: Number(points.try) },
    { x: Number(points.brx), y: Number(points.bry) },
    { x: Number(points.blx), y: Number(points.bly) },
  ];
}

function currentInputs(
  overrides: Partial<CurrentV2Inputs> = {},
): CurrentV2Inputs {
  return {
    reportRecordId: "11111111-1111-4111-8111-111111111111",
    reportId: "22222222-2222-4222-8222-222222222222",
    assetId: "hero",
    brandModelId: "brand-model-test",
    identityLockVersion: 3,
    artworkId: "33333333-3333-4333-8333-333333333333",
    artworkVersion: "V1",
    artworkChecksum: "a".repeat(64),
    shopifyProductId: "gid://shopify/Product/1",
    shopifyVariantId: "gid://shopify/ProductVariant/1",
    printSide: "FRONT",
    placementPreset: "FRONT_LARGE",
    creativeDirectionSignature:
      creativeDirectionPlanningKey(CREATIVE_DIRECTION),
    points: QUAD_A,
    ...overrides,
  };
}

function job(
  overrides: Partial<V2PreparedJob> = {},
  snapshot: Partial<V2PreparedJob["inputSnapshot"]> = {},
): V2PreparedJob {
  const inputs = currentInputs();
  return {
    id: randomUUID(),
    inputFingerprint: "b".repeat(64),
    status: "succeeded",
    estimate: { maximum: 0.04, currency: "USD", basis: "Stage A only" },
    confirmationExpiresAt: "2026-08-17T16:00:00.000Z",
    inputSnapshot: {
      productionMode: "DETERMINISTIC_COMPOSITE",
      brandModel: {
        displayName: "North African Street Premium",
        identityLockVersion: 3,
        brandModelId: "brand-model-test",
      },
      masterArtwork: {
        designId: "design-runtime",
        version: "V1",
        artworkId: inputs.artworkId ?? undefined,
        checksum: inputs.artworkChecksum ?? undefined,
      },
      product: {
        productName: "Zip Hoodie",
        color: "Black",
        variantId: inputs.shopifyVariantId,
        shopifyProductId: inputs.shopifyProductId,
      },
      printSurface: {
        printSurfaceId: "front-center:gid://shopify/ProductVariant/1",
        version: 1,
        region: "front_center",
        quad: pointsToQuad(QUAD_A),
      },
      semanticPlacement: {
        printSide: "FRONT",
        placementPreset: "FRONT_LARGE",
        displayLabel: "Großer Frontprint",
        resolvedPrintSurfaceId: "front-center:gid://shopify/ProductVariant/1",
        resolvedPrintSurfaceVersion: 1,
        resolvedRegion: "front_center",
      },
      shot: { title: "Hero", assetId: "hero" },
      creativeDirection: CREATIVE_DIRECTION,
      production: {
        reportRecordId: inputs.reportRecordId ?? undefined,
        reportId: inputs.reportId ?? undefined,
      },
      baseGeneration: { provider: "synthetic", model: "none" },
      compositing: { compositorVersion: "nexhq-deterministic-compositor-v1" },
      ...snapshot,
    },
    ...overrides,
  };
}

function recovery(
  overrides: Partial<V2Recovery> = {},
  jobOverrides?: Partial<V2PreparedJob>,
  snapshot?: Partial<V2PreparedJob["inputSnapshot"]>,
): V2Recovery {
  const recoveredJob = job(jobOverrides, snapshot);
  return {
    state: "REJECTED",
    stages: [
      { stage: "BASE_GENERATION", stageAttempt: 1, status: "SUCCEEDED" },
      {
        stage: "DETERMINISTIC_COMPOSITE",
        stageAttempt: 1,
        status: "SUCCEEDED",
      },
    ],
    asset: {
      id: randomUUID(),
      reviewStatus: "REJECTED",
      accessUrl: "https://private.example/preview.png",
      mockupReview: { overallStatus: "REJECTED" },
    },
    ...overrides,
    job: overrides.job ?? recoveredJob,
  };
}

function completeAuthority(
  overrides: Partial<PrepareAuthorityInputs> = {},
): PrepareAuthorityInputs {
  return {
    reportRecordId: randomUUID(),
    reportId: randomUUID(),
    assetId: "hero",
    hasBrandModel: true,
    hasMasterArtwork: true,
    shopifyProductId: "gid://shopify/Product/1",
    shopifyVariantId: "gid://shopify/ProductVariant/1",
    productProfile: {
      profileKey: "shopify:gid://shopify/Product/1",
      version: 2,
      variantId: "gid://shopify/ProductVariant/1",
      authority: "SHOPIFY_LIVE",
      printSurface: {
        printSurfaceId: "front-center:gid://shopify/ProductVariant/1",
        version: 1,
        quad: pointsToQuad(QUAD_A),
      },
    },
    semanticPlacement: { printSide: "FRONT", placementPreset: "FRONT_LARGE" },
    creativeDirection: CREATIVE_DIRECTION,
    points: QUAD_A,
    ...overrides,
  };
}

describe("deterministic v2 active vs previous run", () => {
  it("reload and Previous Runs recover the exact frozen owner scale, X and Y", () => {
    const placement = {
      contractVersion: "owner-artwork-placement-v1" as const,
      templateId: "vacancy-front",
      templateVersion: 3,
      uniformScale: 0.84,
      offsetX: 0.15,
      offsetY: -0.4,
      aspectRatioPolicy: "LOCKED_UNIFORM_CONTAIN" as const,
    };
    const previous = recovery({}, undefined, {
      productFamilyPlacement: {
        placementTemplateId: placement.templateId,
        placementTemplateVersion: placement.templateVersion,
        ownerPlacement: placement,
      },
    });
    assert.deepEqual(ownerArtworkPlacementFromRecovery(previous), placement);
  });

  it("rejected old job + new PrintSurface => old review is no longer active", () => {
    const previous = recovery();
    const nextInputs = currentInputs({ points: QUAD_B });
    assert.equal(jobMatchesCurrentInputs(previous.job, currentInputs()), true);
    assert.equal(jobMatchesCurrentInputs(previous.job, nextInputs), false);
    assert.equal(
      decideRecoveredRunRole({
        recoveryState: "REJECTED",
        job: previous.job,
        currentInputs: nextInputs,
      }),
      "historical",
    );

    const bound = panelInputFingerprint(currentInputs());
    assert.equal(
      isActiveRunStaleForCurrentInputs({
        boundInputFingerprint: bound,
        currentInputFingerprint: panelInputFingerprint(nextInputs),
        job: previous.job,
        currentInputs: nextInputs,
      }),
      true,
    );

    const applied = applyInputChangeToActiveRun({
      state: {
        recovery: previous,
        checklist: { ...emptyV2Checklist(), identity: true, placement: true },
        boundInputFingerprint: bound,
        historical: [],
      },
      job: previous.job,
      currentInputs: nextInputs,
    });
    assert.equal(applied.stale, true);
    assert.equal(applied.state.recovery, null);
    assert.deepEqual(applied.state.checklist, emptyV2Checklist());
    assert.equal(applied.state.historical[0]?.jobId, previous.job.id);
    assert.equal(applied.state.historical[0]?.state, "REJECTED");
    assert.equal(applied.state.historical[0]?.reviewStatus, "REJECTED");
    assert.match(
      applied.state.historical[0]?.lineage ?? "",
      /BASE_GENERATION #1 SUCCEEDED/,
    );
  });

  it("approved old job + new shot => old job is no longer active", () => {
    const previous = recovery({
      state: "APPROVED",
      asset: {
        id: randomUUID(),
        reviewStatus: "APPROVED",
        accessUrl: "https://private.example/approved.png",
        mockupReview: { overallStatus: "APPROVED" },
      },
    });
    const nextInputs = currentInputs({ assetId: "detail" });
    assert.equal(
      decideRecoveredRunRole({
        recoveryState: "APPROVED",
        job: previous.job,
        currentInputs: nextInputs,
      }),
      "historical",
    );
    const applied = applyInputChangeToActiveRun({
      state: {
        recovery: previous,
        checklist: { ...emptyV2Checklist(), identity: true },
        boundInputFingerprint: panelInputFingerprint(currentInputs()),
        historical: [],
      },
      job: previous.job,
      currentInputs: nextInputs,
    });
    assert.equal(applied.stale, true);
    assert.equal(applied.state.recovery, null);
    assert.equal(applied.state.historical[0]?.state, "APPROVED");
    assert.equal(applied.state.historical[0]?.jobId, previous.job.id);
  });

  it("new Prepare clears preview, checklist, and lineage UI while keeping history", () => {
    const previous = recovery();
    const before: ReturnType<typeof initialActiveV2UiState> = {
      recovery: previous,
      checklist: {
        identity: true,
        productFidelity: true,
        artworkFidelityExact: true,
        placement: true,
        perspective: true,
        lightingIntegration: true,
      },
      boundInputFingerprint: panelInputFingerprint(currentInputs()),
      historical: [],
    };
    const reset = resetActiveUiForNewPrepare(before);
    assert.equal(reset.recovery, null);
    assert.deepEqual(reset.checklist, emptyV2Checklist());
    assert.equal(reset.boundInputFingerprint, null);
    assert.equal(reset.historical.length, 1);
    assert.equal(
      reset.historical[0]?.lineage?.includes(
        "DETERMINISTIC_COMPOSITE #1 SUCCEEDED",
      ),
      true,
    );
    assert.equal(reset.historical[0]?.reviewStatus, "REJECTED");
    assert.equal(
      previous.asset?.accessUrl,
      "https://private.example/preview.png",
    );

    const flowWithOldJob = {
      ...initialPrepareFlowState(),
      status: "ready" as const,
      statusLabel: "Ready for confirmation",
      job: previous.job,
    };
    const clearedFlow = resetActivePrepareFlow(flowWithOldJob);
    assert.equal(clearedFlow.job, null);
    assert.equal(clearedFlow.status, "idle");
    assert.equal(clearedFlow.statusLabel, null);
  });

  it("reload recovers an unfinished active job even when the form PrintSurface is empty", () => {
    const unfinished = recovery(
      {
        state: "REVIEW_REQUIRED",
        asset: {
          id: randomUUID(),
          reviewStatus: "REVIEW_REQUIRED",
          accessUrl: "https://private.example/live.png",
          mockupReview: { overallStatus: "REVIEW_REQUIRED" },
        },
      },
      { status: "succeeded" },
    );
    const reloadInputs = currentInputs({ points: EMPTY_CORNER_FIELDS });
    assert.equal(
      decideRecoveredRunRole({
        recoveryState: "REVIEW_REQUIRED",
        job: unfinished.job,
        currentInputs: reloadInputs,
      }),
      "active",
    );
    const awaiting = job({ status: "awaiting_confirmation" });
    assert.equal(
      decideRecoveredRunRole({
        recoveryState: "AWAITING_CONFIRMATION",
        job: awaiting,
        currentInputs: reloadInputs,
      }),
      "active",
    );
    const applied = applyRecoveredRunToUi({
      state: initialActiveV2UiState(),
      recovery: unfinished,
      currentInputs: reloadInputs,
      source: "reload",
    });
    assert.equal(applied.role, "active");
    assert.equal(applied.state.recovery?.job.id, unfinished.job.id);
    assert.equal(
      applied.state.recovery?.asset?.reviewStatus,
      "REVIEW_REQUIRED",
    );
  });

  it("reload does not resurrect a terminal job against changed inputs", () => {
    const rejected = recovery();
    const changedOnReload = currentInputs({ points: EMPTY_CORNER_FIELDS });
    assert.equal(
      decideRecoveredRunRole({
        recoveryState: "REJECTED",
        job: rejected.job,
        currentInputs: changedOnReload,
      }),
      "historical",
    );
    const applied = applyRecoveredRunToUi({
      state: initialActiveV2UiState(),
      recovery: rejected,
      currentInputs: changedOnReload,
      source: "reload",
    });
    assert.equal(applied.role, "historical");
    assert.equal(applied.state.recovery, null);
    assert.deepEqual(applied.state.checklist, emptyV2Checklist());
    assert.equal(applied.state.historical[0]?.jobId, rejected.job.id);
    assert.equal(applied.state.historical[0]?.state, "REJECTED");

    const matching = applyRecoveredRunToUi({
      state: initialActiveV2UiState(),
      recovery: rejected,
      currentInputs: currentInputs(),
      source: "reload",
    });
    assert.equal(matching.role, "active");
    assert.equal(matching.state.recovery?.job.id, rejected.job.id);
  });

  it("does not call a generation provider while classifying or resetting active UI", () => {
    const previous = recovery();
    const calls: string[] = [];
    applyInputChangeToActiveRun({
      state: {
        recovery: previous,
        checklist: emptyV2Checklist(),
        boundInputFingerprint: panelInputFingerprint(currentInputs()),
        historical: [],
      },
      job: previous.job,
      currentInputs: currentInputs({ points: QUAD_B }),
    });
    resetActiveUiForNewPrepare({
      recovery: previous,
      checklist: emptyV2Checklist(),
      boundInputFingerprint: panelInputFingerprint(currentInputs()),
      historical: [],
    });
    decideRecoveredRunRole({
      recoveryState: "REJECTED",
      job: previous.job,
      currentInputs: currentInputs({ points: EMPTY_CORNER_FIELDS }),
    });
    assert.equal(calls.length, 0);
    assert.equal(JSON.stringify(previous).includes("openai"), false);
    assert.equal(
      JSON.stringify(toHistoricalV2Run(previous)).includes("fal.ai"),
      false,
    );
  });

  it("allows a new Prepare after REJECTED and walks the prepare sequence without the old job", async () => {
    const previous = recovery();
    const authority = completeAuthority();
    assert.equal(
      isPrepareButtonEnabled(
        authority,
        { ...initialPrepareFlowState(), job: previous.job },
        "REJECTED",
      ),
      true,
    );
    assert.equal(
      isPrepareButtonEnabled(
        authority,
        { ...initialPrepareFlowState(), job: previous.job },
        "REVIEW_REQUIRED",
      ),
      false,
    );

    const labels: Array<string | null> = [];
    const nextJob = job({ status: "awaiting_confirmation", id: randomUUID() });
    const result = await handlePrepareClick({
      authority,
      payload: { brandModelTrace: {}, masterArtwork: {} },
      flow: {
        ...initialPrepareFlowState(),
        job: previous.job,
        status: "ready",
        statusLabel: "Ready for confirmation",
      },
      fetchFn: async (input) => {
        const url = String(input);
        assert.equal(/openai|fal\.ai|images\/generations/i.test(url), false);
        if (url === "/api/image/v2/product-profiles/calibrate") {
          return new Response(
            JSON.stringify({
              profile: {
                productProfileId: "shopify:gid://shopify/Product/1",
                version: 1,
              },
              printSurface: {
                printSurfaceId: "front-center:gid://shopify/ProductVariant/1",
                version: 2,
              },
            }),
            { status: 201, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response(JSON.stringify({ job: nextJob }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      },
      onState: (state) => labels.push(state.statusLabel),
    });
    assert.deepEqual(labels, [
      "Druckfläche wird geprüft…",
      "Produktreferenzen werden eingefroren…",
      "Deterministischer Auftrag wird vorbereitet…",
      "Bereit zur Bestätigung",
    ]);
    assert.equal(result.job?.id, nextJob.id);
    assert.notEqual(result.job?.id, previous.job.id);
  });

  it("treats a changed structured creative direction as a different run", () => {
    const changed = createCreativeDirection({
      shotId: "hero",
      contentMode: "SOCIAL_CONTENT",
      presetId: "SPORTS_PROPS",
    });
    assert.equal(
      jobMatchesCurrentInputs(
        job(),
        currentInputs({
          creativeDirectionSignature: creativeDirectionPlanningKey(changed),
        }),
      ),
      false,
    );
  });
});
