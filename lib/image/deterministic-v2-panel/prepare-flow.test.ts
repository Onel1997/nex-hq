import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";

import {
  CALIBRATE_PATH,
  PREPARE_JOBS_PATH,
  callBrowserFetch,
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
import { EMPTY_CORNER_FIELDS, type CornerFieldValues } from "@/lib/image/print-surface/validate-quad";

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

function completeAuthority(overrides: Partial<PrepareAuthorityInputs> = {}): PrepareAuthorityInputs {
  return {
    reportRecordId: randomUUID(),
    reportId: randomUUID(),
    assetId: "hero",
    hasBrandModel: true,
    hasMasterArtwork: true,
    shopifyProductId: "gid://shopify/Product/1",
    shopifyVariantId: "gid://shopify/ProductVariant/1",
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
      brandModel: { displayName: "North African Street Premium", identityLockVersion: 3 },
      masterArtwork: { designId: "design-runtime", version: "V1" },
      product: { productName: "Zip Hoodie", color: "Black", variantId: "gid://shopify/ProductVariant/1" },
      printSurface: { printSurfaceId: "front-center:gid://shopify/ProductVariant/1", version: 1, region: "front_center" },
      shot: { title: "Hero" },
      baseGeneration: { provider: "synthetic", model: "none" },
      compositing: { compositorVersion: "nexhq-deterministic-compositor-v1" },
    },
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

type FetchCall = { url: string; method: string; body: unknown };

function recordFetch(handler: (call: FetchCall) => Promise<Response> | Response) {
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
          throw new TypeError("Failed to execute 'fetch' on 'Window': Illegal invocation");
        }
        return Promise.resolve(new Response(JSON.stringify({ ok: true, method: init?.method ?? "GET", url: String(input) }), { status: 200 }));
      },
    };
    const detached = windowLike.fetch as unknown as typeof fetch;
    assert.throws(() => { void detached("/api/image/v2/jobs"); }, /Illegal invocation/);

    const wrapped: typeof fetch = (input, init) => windowLike.fetch(input, init);
    const response = await wrapped("/api/image/v2/product-profiles/calibrate", { method: "POST" });
    assert.equal(response.ok, true);
    assert.deepEqual(await response.json(), { ok: true, method: "POST", url: "/api/image/v2/product-profiles/calibrate" });

    assert.equal(resolveV2Fetch(), callBrowserFetch);
    assert.equal(resolveV2Fetch(fetch), callBrowserFetch);
    const fake: typeof fetch = async () => jsonResponse({ fake: true });
    assert.equal(resolveV2Fetch(fake), fake);
  });

  it("click handler fires and missing PrintSurface produces a persistent blocker without sending a request", async () => {
    const { calls, fetchFn } = recordFetch(() => jsonResponse({ error: "should not run" }, 500));
    const authority = completeAuthority({ points: EMPTY_CORNER_FIELDS });
    const blockers = listPrepareBlockers(authority);
    assert.equal(isPrepareButtonEnabled(authority, initialPrepareFlowState()), false);
    assert.equal(blockers.some((blocker) => blocker.code === "MISSING_PRINT_SURFACE"), true);
    assert.match(blockers.find((blocker) => blocker.code === "MISSING_PRINT_SURFACE")!.message, /Define the four front_center print-area corners/);

    const result = await handlePrepareClick({
      authority,
      payload: { brandModelTrace: { id: "trace" }, masterArtwork: { id: "art" } },
      flow: initialPrepareFlowState(),
      fetchFn,
    });
    assert.equal(result.clickHandlerFired, true);
    assert.equal(result.requestSent, false);
    assert.equal(result.status, "error");
    assert.match(result.error ?? "", /Define the four front_center print-area corners/);
    assert.equal(calls.length, 0);
    assert.equal(clearPrepareError(result).error, null);
    assert.equal(result.error, "Define the four front_center print-area corners before preparing V2.");
  });

  it("invalid coordinates are blocked and never reach the prepare API", async () => {
    const { calls, fetchFn } = recordFetch(() => jsonResponse({ error: "should not run" }, 500));
    const outOfRange = completeAuthority({
      points: { ...VALID_POINTS, trx: "1.4" },
    });
    assert.equal(listPrepareBlockers(outOfRange).some((blocker) => blocker.code === "INVALID_PRINT_SURFACE"), true);
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
        points: { tlx: "0.5", tly: "0.5", trx: "0.5", try: "0.5", brx: "0.5", bry: "0.5", blx: "0.5", bly: "0.5" },
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
        return jsonResponse({
          profile: { productProfileId: "shopify:gid://shopify/Product/1", version: 2 },
          printSurface: {
            printSurfaceId: "front-center:gid://shopify/ProductVariant/1",
            version: 2,
            region: "front_center",
            geometryStatus: "HUMAN_DEFINED",
            extraShouldBeStripped: true,
          },
        }, 201);
      }
      if (call.url === PREPARE_JOBS_PATH) {
        return jsonResponse({ job: prepared }, 201);
      }
      return jsonResponse({ error: `unexpected ${call.url}` }, 500);
    });

    const result = await handlePrepareClick({
      authority: completeAuthority(),
      payload: { brandModelTrace: { contractVersion: "brand-model-v1" }, masterArtwork: { id: randomUUID(), designId: "d", version: "V1", checksum: "b".repeat(64) } },
      flow: initialPrepareFlowState(),
      fetchFn,
      onState: (state) => states.push(state),
    });

    assert.equal(result.clickHandlerFired, true);
    assert.equal(result.requestSent, true);
    assert.equal(result.status, "ready");
    assert.equal(result.statusLabel, "Ready for confirmation");
    assert.equal(result.job?.id, prepared.id);
    assert.equal(result.job?.status, "awaiting_confirmation");
    assert.deepEqual(states.map((state) => state.statusLabel), [
      "Validating print area…",
      "Freezing Shopify references…",
      "Preparing deterministic V2 job…",
      "Ready for confirmation",
    ]);
    assert.equal(calls.length, 2);
    assert.equal(calls[0]?.url, CALIBRATE_PATH);
    assert.equal(calls[0]?.method, "POST");
    assert.equal(
      calls[0]?.body && typeof calls[0].body === "object"
        ? (calls[0].body as { surface?: { calibrationAttestation?: boolean; region?: string } }).surface?.calibrationAttestation
        : false,
      true,
    );
    assert.equal(
      calls[0]?.body && typeof calls[0].body === "object"
        ? (calls[0].body as { surface?: { region?: string } }).surface?.region
        : null,
      "front_center",
    );
    assert.equal(calls[1]?.url, PREPARE_JOBS_PATH);
    assert.equal(calls[1]?.method, "POST");
    assert.deepEqual(calls[1]?.body && typeof calls[1].body === "object" ? (calls[1].body as { printSurface: unknown }).printSurface : null, {
      printSurfaceId: "front-center:gid://shopify/ProductVariant/1",
      version: 2,
    });
    assert.equal(JSON.stringify(calls).includes("openai"), false);
    assert.equal(JSON.stringify(calls).includes("fal.ai"), false);
  });

  it("omitting fetchFn uses the browser wrapper so calibration, freeze, and prepare still fire", async () => {
    const prepared = job();
    const { calls, fetchFn } = recordFetch((call) => {
      if (call.url === CALIBRATE_PATH) {
        return jsonResponse({
          profile: { productProfileId: "shopify:gid://shopify/Product/1", version: 1 },
          printSurface: { printSurfaceId: "front-center:gid://shopify/ProductVariant/1", version: 1 },
        }, 201);
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
      assert.deepEqual(calls.map((call) => `${call.method} ${call.url}`), [
        `POST ${CALIBRATE_PATH}`,
        `POST ${PREPARE_JOBS_PATH}`,
        `POST ${CALIBRATE_PATH}`,
        `POST ${PREPARE_JOBS_PATH}`,
      ]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("API error persists until retry, input change, or dismiss", async () => {
    const { fetchFn } = recordFetch(() => jsonResponse({
      error: "Shopify Product detail changed or is unavailable.",
      details: { formErrors: ["zod-only"] },
    }, 409));
    const diagnostics: unknown[] = [];
    const result = await handlePrepareClick({
      authority: completeAuthority(),
      payload: { brandModelTrace: {}, masterArtwork: {} },
      flow: initialPrepareFlowState(),
      fetchFn,
      onDiagnostics: (details) => diagnostics.push(details),
    });
    assert.equal(result.status, "error");
    assert.equal(result.error, "Shopify Product detail changed or is unavailable.");
    assert.equal(result.requestSent, true);
    assert.ok(diagnostics.length > 0);
    const unchanged = { ...result };
    assert.equal(unchanged.error, result.error);
    assert.equal(clearPrepareError(result).error, null);
  });

  it("duplicate click is suppressed and does not send a second request", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const { calls, fetchFn } = recordFetch(async (call) => {
      await gate;
      if (call.url === CALIBRATE_PATH) {
        return jsonResponse({
          profile: { productProfileId: "shopify:gid://shopify/Product/1", version: 1 },
          printSurface: { printSurfaceId: "front-center:gid://shopify/ProductVariant/1", version: 1 },
        }, 201);
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
    assert.equal(["freezing", "validating", "preparing"].includes(inFlight!.status), true);
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
    assert.equal(calls.length, 2);
  });

  it("does not call a generation provider", async () => {
    const { calls, fetchFn } = recordFetch((call) => {
      if (call.url === CALIBRATE_PATH) {
        return jsonResponse({
          profile: { productProfileId: "shopify:gid://shopify/Product/1", version: 1 },
          printSurface: { printSurfaceId: "front-center:gid://shopify/ProductVariant/1", version: 1 },
        }, 201);
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
    assert.equal(calls.some((call) => /openai|fal\.ai|images\/generations|provider/i.test(call.url)), false);
  });

  it("strips full PrintSurface objects down to an exact version ref", () => {
    assert.deepEqual(printSurfaceRefFromCalibration({
      printSurfaceId: "front-center",
      version: 3,
      region: "front_center",
      quad: [{ x: 0.3, y: 0.3 }],
    }), { printSurfaceId: "front-center", version: 3 });
  });

  it("shows exact blockers for missing artwork, product, brand model, and shot", () => {
    const blockers = listPrepareBlockers(completeAuthority({
      hasMasterArtwork: false,
      hasBrandModel: false,
      shopifyProductId: null,
      shopifyVariantId: null,
      reportRecordId: null,
      reportId: null,
      assetId: null,
      points: EMPTY_CORNER_FIELDS,
    }));
    assert.deepEqual(blockers.map((blocker) => blocker.code), [
      "MISSING_ARTWORK",
      "MISSING_PRODUCT",
      "MISSING_BRAND_MODEL",
      "MISSING_SHOT",
      "MISSING_PRINT_SURFACE",
    ]);
    assert.equal(isPrepareButtonEnabled(completeAuthority(), initialPrepareFlowState()), true);
  });
});
