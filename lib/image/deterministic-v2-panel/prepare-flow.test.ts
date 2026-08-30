import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";

import {
  CALIBRATE_PATH,
  PREPARE_JOBS_PATH,
  callBrowserFetch,
  calibrateProductSurfaceOnce,
  clearPrepareError,
  handlePrepareClick,
  initialPrepareFlowState,
  isPrepareButtonEnabled,
  listPrepareBlockers,
  printSurfaceRefFromCalibration,
  resolveV2Fetch,
  type PrepareAuthorityInputs,
  type PrepareFlowState,
  type V2PreparedJob,
} from "@/lib/image/deterministic-v2-panel/prepare-flow";
import {
  EMPTY_CORNER_FIELDS,
  type CornerFieldValues,
} from "@/lib/image/print-surface/validate-quad";
import { createCreativeDirection } from "@/lib/image/social-creative-direction";

const VALID_POINTS: CornerFieldValues = {
  tlx: "0.30",
  tly: "0.35",
  trx: "0.70",
  try: "0.35",
  brx: "0.68",
  bry: "0.70",
  blx: "0.32",
  bly: "0.70",
};

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
        printSurfaceId: "front-center:family:heavy-tee",
        version: 3,
      },
    },
    semanticPlacement: { printSide: "FRONT", placementPreset: "FRONT_LARGE" },
    creativeDirection: createCreativeDirection({
      shotId: "hero",
      contentMode: "SOCIAL_CONTENT",
    }),
    points: VALID_POINTS,
    ...overrides,
  };
}

function job(): V2PreparedJob {
  return {
    id: randomUUID(),
    inputFingerprint: "a".repeat(64),
    status: "awaiting_confirmation",
    estimate: { maximum: 0.04, currency: "USD", basis: "Stage A only" },
    confirmationExpiresAt: "2026-08-17T16:00:00.000Z",
    inputSnapshot: {
      productionMode: "DETERMINISTIC_COMPOSITE",
      brandModel: {
        displayName: "North African Street Premium",
        identityLockVersion: 3,
      },
      masterArtwork: { designId: "design-runtime", version: "V1" },
      product: {
        productName: "Zip Hoodie",
        color: "Black",
        variantId: "gid://shopify/ProductVariant/1",
      },
      printSurface: {
        printSurfaceId: "front-center:gid://shopify/ProductVariant/1",
        version: 1,
        region: "front_center",
      },
      shot: { title: "Hero" },
      baseGeneration: { provider: "synthetic", model: "none" },
      compositing: { compositorVersion: "nexhq-deterministic-compositor-v1" },
    },
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

type FetchCall = { url: string; method: string; body: unknown };

function recordFetch(
  handler: (call: FetchCall) => Promise<Response> | Response,
) {
  const calls: FetchCall[] = [];
  const fetchFn: typeof fetch = async (input, init) => {
    const call: FetchCall = {
      url: String(input),
      method: init?.method ?? "GET",
      body: init?.body ? JSON.parse(String(init.body)) : null,
    };
    calls.push(call);
    return handler(call);
  };
  return { calls, fetchFn };
}

describe("deterministic v2 panel prepare click", () => {
  it("default browser fetch wrapper keeps correct invocation context", async () => {
    const windowLike = {
      fetch(this: unknown, input: RequestInfo | URL, init?: RequestInit) {
        if (this !== windowLike) {
          throw new TypeError(
            "Failed to execute 'fetch' on 'Window': Illegal invocation",
          );
        }
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ok: true,
              method: init?.method ?? "GET",
              url: String(input),
            }),
            { status: 200 },
          ),
        );
      },
    };
    const detached = windowLike.fetch as unknown as typeof fetch;
    assert.throws(() => {
      void detached("/api/image/v2/jobs");
    }, /Illegal invocation/);

    const wrapped: typeof fetch = (input, init) =>
      windowLike.fetch(input, init);
    const response = await wrapped("/api/image/v2/product-profiles/calibrate", {
      method: "POST",
    });
    assert.equal(response.ok, true);
    assert.deepEqual(await response.json(), {
      ok: true,
      method: "POST",
      url: "/api/image/v2/product-profiles/calibrate",
    });

    assert.equal(resolveV2Fetch(), callBrowserFetch);
    assert.equal(resolveV2Fetch(fetch), callBrowserFetch);
    const fake: typeof fetch = async () => jsonResponse({ fake: true });
    assert.equal(resolveV2Fetch(fake), fake);
  });

  it("click handler fires and missing PrintSurface produces a persistent blocker without sending a request", async () => {
    const { calls, fetchFn } = recordFetch(() =>
      jsonResponse({ error: "should not run" }, 500),
    );
    const authority = completeAuthority({
      productProfile: {
        ...completeAuthority().productProfile!,
        printSurface: null,
      },
      points: EMPTY_CORNER_FIELDS,
    });
    const blockers = listPrepareBlockers(authority);
    assert.equal(
      isPrepareButtonEnabled(authority, initialPrepareFlowState()),
      false,
    );
    assert.equal(
      blockers.some(
        (blocker) => blocker.code === "MISSING_RESOLVED_PRINT_SURFACE",
      ),
      true,
    );
    assert.match(
      blockers.find(
        (blocker) => blocker.code === "MISSING_RESOLVED_PRINT_SURFACE",
      )!.message,
      /keine passende Druckfläche definiert/,
    );

    const result = await handlePrepareClick({
      authority,
      payload: {
        brandModelTrace: { id: "trace" },
        masterArtwork: { id: "art" },
      },
      flow: initialPrepareFlowState(),
      fetchFn,
    });
    assert.equal(result.clickHandlerFired, true);
    assert.equal(result.requestSent, false);
    assert.equal(result.status, "error");
    assert.match(result.error ?? "", /keine passende Druckfläche definiert/);
    assert.equal(calls.length, 0);
    assert.equal(clearPrepareError(result).error, null);
    assert.equal(
      result.error,
      "Für dieses Produkt ist noch keine passende Druckfläche definiert.",
    );
  });

  it("invalid coordinates are blocked and never reach the prepare API", async () => {
    const { calls, fetchFn } = recordFetch(() =>
      jsonResponse({ error: "should not run" }, 500),
    );
    const outOfRange = completeAuthority({
      points: { ...VALID_POINTS, trx: "1.4" },
      productionOverride: {
        basePrintSurfaceId: "front-center:family:heavy-tee",
        basePrintSurfaceVersion: 3,
        quad: [],
      },
    });
    assert.equal(
      listPrepareBlockers(outOfRange).some(
        (blocker) => blocker.code === "INVALID_PRINT_SURFACE",
      ),
      true,
    );
    const invalid = await handlePrepareClick({
      authority: outOfRange,
      payload: { brandModelTrace: {}, masterArtwork: {} },
      flow: initialPrepareFlowState(),
      fetchFn,
    });
    assert.equal(invalid.clickHandlerFired, true);
    assert.equal(invalid.requestSent, false);
    assert.match(invalid.error ?? "", /between 0 and 1/);
    assert.equal(calls.length, 0);

    const degenerate = await handlePrepareClick({
      authority: completeAuthority({
        productionOverride: {
          basePrintSurfaceId: "front-center:family:heavy-tee",
          basePrintSurfaceVersion: 3,
          quad: [],
        },
        points: {
          tlx: "0.5",
          tly: "0.5",
          trx: "0.5",
          try: "0.5",
          brx: "0.5",
          bry: "0.5",
          blx: "0.5",
          bly: "0.5",
        },
      }),
      payload: { brandModelTrace: {}, masterArtwork: {} },
      flow: initialPrepareFlowState(),
      fetchFn,
    });
    assert.match(degenerate.error ?? "", /degenerate|distinct/i);
    assert.equal(calls.length, 0);
  });

  it("valid coordinates reach prepare API, expose loading states, and open confirmation", async () => {
    const prepared = job();
    const states: PrepareFlowState[] = [];
    const { calls, fetchFn } = recordFetch((call) => {
      if (call.url === CALIBRATE_PATH) {
        return jsonResponse(
          {
            profile: {
              productProfileId: "shopify:gid://shopify/Product/1",
              version: 2,
            },
            printSurface: {
              printSurfaceId: "front-center:gid://shopify/ProductVariant/1",
              version: 2,
              region: "front_center",
              geometryStatus: "HUMAN_DEFINED",
              extraShouldBeStripped: true,
            },
          },
          201,
        );
      }
      if (call.url === PREPARE_JOBS_PATH) {
        return jsonResponse({ job: prepared }, 201);
      }
      return jsonResponse({ error: `unexpected ${call.url}` }, 500);
    });

    const result = await handlePrepareClick({
      authority: completeAuthority(),
      payload: {
        brandModelTrace: { contractVersion: "brand-model-v1" },
        masterArtwork: {
          id: randomUUID(),
          designId: "d",
          version: "V1",
          checksum: "b".repeat(64),
        },
      },
      flow: initialPrepareFlowState(),
      fetchFn,
      onState: (state) => states.push(state),
    });

    assert.equal(result.clickHandlerFired, true);
    assert.equal(result.requestSent, true);
    assert.equal(result.status, "ready");
    assert.equal(result.statusLabel, "Bereit zur Bestätigung");
    assert.equal(result.job?.id, prepared.id);
    assert.equal(result.job?.status, "awaiting_confirmation");
    assert.deepEqual(
      states.map((state) => state.statusLabel),
      [
        "Druckfläche wird geprüft…",
        "Produktreferenzen werden eingefroren…",
        "Deterministischer Auftrag wird vorbereitet…",
        "Bereit zur Bestätigung",
      ],
    );
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.url, PREPARE_JOBS_PATH);
    assert.equal(calls[0]?.method, "POST");
    assert.deepEqual(
      calls[0]?.body && typeof calls[0].body === "object"
        ? (calls[0].body as { printSurface: unknown }).printSurface
        : null,
      {
        printSurfaceId: "front-center:family:heavy-tee",
        version: 3,
        authority: "PRODUCT_PROFILE",
        ownerProfileKey: "shopify:gid://shopify/Product/1",
        ownerProfileVersion: 2,
      },
    );
    assert.deepEqual(
      (calls[0]!.body as { semanticPlacement: unknown }).semanticPlacement,
      { printSide: "FRONT", placementPreset: "FRONT_LARGE" },
    );
    assert.equal(
      (
        calls[0]!.body as {
          creativeDirection: { contractVersion: string; shotType: string };
        }
      ).creativeDirection.contractVersion,
      "social-creative-direction-v1",
    );
    assert.equal(
      (
        calls[0]!.body as {
          creativeDirection: { contractVersion: string; shotType: string };
        }
      ).creativeDirection.shotType,
      "hero",
    );
    assert.equal(JSON.stringify(calls).includes("openai"), false);
    assert.equal(JSON.stringify(calls).includes("fal.ai"), false);
  });

  it("a calibrated Product surface prepares without mandatory four-point interaction", async () => {
    let requests = 0;
    const expectedJob = job();
    const result = await handlePrepareClick({
      authority: completeAuthority({ points: EMPTY_CORNER_FIELDS }),
      payload: { brandModelTrace: {}, masterArtwork: {} },
      flow: initialPrepareFlowState(),
      fetchFn: async (input) => {
        requests += 1;
        assert.equal(String(input), PREPARE_JOBS_PATH);
        return new Response(JSON.stringify({ job: expectedJob }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      },
    });
    assert.equal(requests, 1);
    assert.equal(result.status, "ready");
    assert.equal(result.quad, null);
  });

  it("an automatic Product template prepares without calibration interaction", async () => {
    const expectedJob = job();
    const { calls, fetchFn } = recordFetch(() =>
      jsonResponse({ job: expectedJob }, 201),
    );
    const authority = completeAuthority({
      points: EMPTY_CORNER_FIELDS,
      productProfile: {
        ...completeAuthority().productProfile!,
        printSurface: {
          printSurfaceId: "nexhq:tshirt:front_large",
          version: 1,
          authority: "NEXHQ_PRODUCT_TEMPLATE",
          templateId: "nexhq:tshirt:front_large",
          templateVersion: 1,
        },
      },
    });
    const result = await handlePrepareClick({
      authority,
      payload: { brandModelTrace: {}, masterArtwork: {} },
      flow: initialPrepareFlowState(),
      fetchFn,
    });
    assert.equal(result.status, "ready");
    assert.equal(calls.length, 1);
    assert.deepEqual(
      (calls[0]!.body as { printSurface: unknown }).printSurface,
      {
        printSurfaceId: "nexhq:tshirt:front_large",
        version: 1,
        authority: "NEXHQ_PRODUCT_TEMPLATE",
        templateId: "nexhq:tshirt:front_large",
        templateVersion: 1,
        ownerProfileKey: "shopify:gid://shopify/Product/1",
        ownerProfileVersion: 2,
      },
    );
  });

  it("one-time setup defaults to the exact selected variant without technical reuse attestations", async () => {
    const { calls, fetchFn } = recordFetch(() =>
      jsonResponse(
        {
          profile: {
            productProfileId: "shopify:gid://shopify/Product/1",
            version: 1,
          },
          printSurface: {
            contractVersion: "print-surface-v1",
            printSurfaceId: "surface:front-large",
            version: 1,
            productProfileId: "shopify:gid://shopify/Product/1",
            variantId: "gid://shopify/ProductVariant/1",
            region: "front_center",
            displayName: "Großer Frontprint",
            geometryStatus: "HUMAN_DEFINED",
            quad: [
              { x: 0.3, y: 0.35 },
              { x: 0.7, y: 0.35 },
              { x: 0.68, y: 0.7 },
              { x: 0.32, y: 0.7 },
            ],
            boundingBox: null,
            orientationDegrees: 0,
            perspectiveAnchors: [],
            clippingMaskReference: null,
            safeMargin: { top: 0, right: 0, bottom: 0, left: 0 },
            artworkScale: 1,
            rotationDegrees: 0,
            warpMode: "PERSPECTIVE",
            provenance: {
              source: "OWNER_CALIBRATION",
              calibratedBy: "owner",
              calibratedAt: "2026-08-17T12:00:00.000Z",
            },
            reuse: {
              scope: "PRODUCT_PROFILE",
              physicalProductKey: "shopify-product:gid://shopify/Product/1",
              physicalProductLabel: "Heavy Tee",
              sourceProductProfileId: "shopify:gid://shopify/Product/1",
              sourceProductProfileVersion: 1,
              variantPolicy: "EXACT_VARIANT",
              compatibleShopifyProductIds: ["gid://shopify/Product/1"],
              equivalenceAuthority: "OWNER_CONFIRMED",
              confirmedBy: "owner",
              confirmedAt: "2026-08-17T12:00:00.000Z",
            },
          },
        },
        201,
      ),
    );
    await calibrateProductSurfaceOnce({
      shopifyProductId: "gid://shopify/Product/1",
      shopifyVariantId: "gid://shopify/ProductVariant/1",
      placementPreset: "FRONT_LARGE",
      points: VALID_POINTS,
      physicalProductFamily: {
        key: "family:heavy-tee",
        label: "Heavy Tee",
        memberShopifyProductIds: ["gid://shopify/Product/1"],
      },
      reuseAcrossVariants: false,
      reuseAcrossFamily: false,
      ownerConfirmedNormalizedVariants: false,
      ownerConfirmedFamilyEquivalence: false,
      fetchFn,
    });
    const reuse = (calls[0]!.body as { reuse: Record<string, unknown> }).reuse;
    assert.equal(reuse.variantPolicy, "EXACT_VARIANT");
    assert.equal(reuse.normalizedVariantGeometryAttestation, false);
    assert.equal(calls.length, 1);
  });

  it("manual Product Profile uses the exact frozen profile and skips Shopify calibration", async () => {
    const prepared = job();
    const { calls, fetchFn } = recordFetch((call) => {
      assert.equal(call.url, PREPARE_JOBS_PATH);
      return jsonResponse({ job: prepared }, 201);
    });
    const result = await handlePrepareClick({
      authority: completeAuthority({
        shopifyProductId: null,
        shopifyVariantId: null,
        productProfile: {
          profileKey: "manual:profile-1",
          version: 4,
          variantId: "manual:variant-1",
          authority: "MANUAL_PROFILE",
          printSurface: { printSurfaceId: "left-leg", version: 2 },
        },
        semanticPlacement: { printSide: "FRONT", placementPreset: "LEFT_LEG" },
      }),
      payload: { brandModelTrace: {}, masterArtwork: {} },
      flow: initialPrepareFlowState(),
      fetchFn,
    });
    assert.equal(result.status, "ready");
    assert.equal(calls.length, 1);
    assert.deepEqual(
      (calls[0]!.body as { productProfile: unknown }).productProfile,
      {
        profileKey: "manual:profile-1",
        version: 4,
        variantId: "manual:variant-1",
      },
    );
    assert.deepEqual(
      (calls[0]!.body as { printSurface: unknown }).printSurface,
      {
        printSurfaceId: "left-leg",
        version: 2,
        authority: "PRODUCT_PROFILE",
        ownerProfileKey: "manual:profile-1",
        ownerProfileVersion: 4,
      },
    );
  });

  it("Beidseitig remains a plan and never sends a prepare request", async () => {
    const { calls, fetchFn } = recordFetch(() =>
      jsonResponse({ error: "should not run" }, 500),
    );
    const authority = completeAuthority({
      semanticPlacement: { printSide: "BOTH", placementPreset: null },
    });
    const blockers = listPrepareBlockers(authority);
    assert.equal(
      blockers.some((blocker) => blocker.code === "BOTH_REQUIRES_TWO_JOBS"),
      true,
    );
    const result = await handlePrepareClick({
      authority,
      payload: { brandModelTrace: {}, masterArtwork: {} },
      flow: initialPrepareFlowState(),
      fetchFn,
    });
    assert.equal(result.requestSent, false);
    assert.equal(calls.length, 0);
  });

  it("omitting fetchFn uses the browser wrapper and Prepare never calibrates implicitly", async () => {
    const prepared = job();
    const { calls, fetchFn } = recordFetch((call) => {
      if (call.url === CALIBRATE_PATH) {
        return jsonResponse(
          {
            profile: {
              productProfileId: "shopify:gid://shopify/Product/1",
              version: 1,
            },
            printSurface: {
              printSurfaceId: "front-center:gid://shopify/ProductVariant/1",
              version: 1,
            },
          },
          201,
        );
      }
      return jsonResponse({ job: prepared }, 201);
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchFn;
    try {
      const omitted = await handlePrepareClick({
        authority: completeAuthority(),
        payload: { brandModelTrace: {}, masterArtwork: {} },
        flow: initialPrepareFlowState(),
      });
      const remapped = await handlePrepareClick({
        authority: completeAuthority(),
        payload: { brandModelTrace: {}, masterArtwork: {} },
        flow: initialPrepareFlowState(),
        fetchFn: fetch,
      });
      assert.equal(omitted.status, "ready");
      assert.equal(remapped.status, "ready");
      assert.deepEqual(
        calls.map((call) => `${call.method} ${call.url}`),
        [`POST ${PREPARE_JOBS_PATH}`, `POST ${PREPARE_JOBS_PATH}`],
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("API error persists until retry, input change, or dismiss", async () => {
    const { fetchFn } = recordFetch(() =>
      jsonResponse(
        {
          error: "Shopify Product detail changed or is unavailable.",
          details: { formErrors: ["zod-only"] },
        },
        409,
      ),
    );
    const diagnostics: unknown[] = [];
    const result = await handlePrepareClick({
      authority: completeAuthority(),
      payload: { brandModelTrace: {}, masterArtwork: {} },
      flow: initialPrepareFlowState(),
      fetchFn,
      onDiagnostics: (details) => diagnostics.push(details),
    });
    assert.equal(result.status, "error");
    assert.equal(
      result.error,
      "Shopify Product detail changed or is unavailable.",
    );
    assert.equal(result.requestSent, true);
    assert.ok(diagnostics.length > 0);
    const unchanged = { ...result };
    assert.equal(unchanged.error, result.error);
    assert.equal(clearPrepareError(result).error, null);
  });

  it("duplicate click is suppressed and does not send a second request", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { calls, fetchFn } = recordFetch(async (call) => {
      await gate;
      if (call.url === CALIBRATE_PATH) {
        return jsonResponse(
          {
            profile: {
              productProfileId: "shopify:gid://shopify/Product/1",
              version: 1,
            },
            printSurface: {
              printSurfaceId: "front-center:gid://shopify/ProductVariant/1",
              version: 1,
            },
          },
          201,
        );
      }
      return jsonResponse({ job: job() }, 201);
    });
    const states: PrepareFlowState[] = [];
    const first = handlePrepareClick({
      authority: completeAuthority(),
      payload: { brandModelTrace: {}, masterArtwork: {} },
      flow: initialPrepareFlowState(),
      fetchFn,
      onState: (state) => states.push(state),
    });
    await Promise.resolve();
    const inFlight = states.at(-1);
    assert.ok(inFlight);
    assert.equal(
      ["freezing", "validating", "preparing"].includes(inFlight!.status),
      true,
    );
    const duplicate = await handlePrepareClick({
      authority: completeAuthority(),
      payload: { brandModelTrace: {}, masterArtwork: {} },
      flow: inFlight!,
      fetchFn,
    });
    assert.equal(duplicate.clickHandlerFired, true);
    assert.equal(duplicate.duplicateClickIgnored, true);
    assert.equal(calls.length, 1);
    release();
    const completed = await first;
    assert.equal(completed.status, "ready");
    assert.equal(calls.length, 1);
  });

  it("does not call a generation provider", async () => {
    const { calls, fetchFn } = recordFetch((call) => {
      if (call.url === CALIBRATE_PATH) {
        return jsonResponse(
          {
            profile: {
              productProfileId: "shopify:gid://shopify/Product/1",
              version: 1,
            },
            printSurface: {
              printSurfaceId: "front-center:gid://shopify/ProductVariant/1",
              version: 1,
            },
          },
          201,
        );
      }
      return jsonResponse({ job: job() }, 201);
    });
    await handlePrepareClick({
      authority: completeAuthority(),
      payload: { brandModelTrace: {}, masterArtwork: {} },
      flow: initialPrepareFlowState(),
      fetchFn,
    });
    assert.ok(calls.every((call) => call.url.startsWith("/api/image/v2/")));
    assert.equal(
      calls.some((call) =>
        /openai|fal\.ai|images\/generations|provider/i.test(call.url),
      ),
      false,
    );
  });

  it("strips full PrintSurface objects down to an exact version ref", () => {
    assert.deepEqual(
      printSurfaceRefFromCalibration({
        printSurfaceId: "front-center",
        version: 3,
        region: "front_center",
        quad: [{ x: 0.3, y: 0.3 }],
      }),
      { printSurfaceId: "front-center", version: 3 },
    );
  });

  it("shows exact blockers for missing artwork, product, brand model, and shot", () => {
    const blockers = listPrepareBlockers(
      completeAuthority({
        hasMasterArtwork: false,
        hasBrandModel: false,
        shopifyProductId: null,
        shopifyVariantId: null,
        productProfile: null,
        reportRecordId: null,
        reportId: null,
        assetId: null,
        points: EMPTY_CORNER_FIELDS,
      }),
    );
    assert.deepEqual(
      blockers.map((blocker) => blocker.code),
      [
        "MISSING_ARTWORK",
        "MISSING_PRODUCT",
      "MISSING_BRAND_MODEL",
      "MISSING_SHOT",
      "MISSING_CREATIVE_DIRECTION",
      "MISSING_RESOLVED_PRINT_SURFACE",
      ],
    );
    assert.equal(
      isPrepareButtonEnabled(completeAuthority(), initialPrepareFlowState()),
      true,
    );
  });
});
