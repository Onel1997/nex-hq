import {
  PRINT_SURFACE_MISSING_MESSAGE,
  validateHumanDefinedQuad,
  type CornerFieldValues,
  type QuadCorners,
} from "@/lib/image/print-surface/validate-quad";

export const CALIBRATE_PATH = "/api/image/v2/product-profiles/calibrate";
export const PREPARE_JOBS_PATH = "/api/image/v2/jobs";

export const PREPARE_STATUS_LABELS = {
  idle: null,
  validating: "Validating print area…",
  freezing: "Freezing Shopify references…",
  preparing: "Preparing deterministic V2 job…",
  ready: "Ready for confirmation",
  error: null,
} as const;

export type PrepareFlowStatus = keyof typeof PREPARE_STATUS_LABELS;

export type PrepareBlockerCode =
  | "MISSING_ARTWORK"
  | "MISSING_PRODUCT"
  | "MISSING_BRAND_MODEL"
  | "MISSING_SHOT"
  | "MISSING_PRINT_SURFACE"
  | "INVALID_PRINT_SURFACE";

export type PrepareBlocker = {
  code: PrepareBlockerCode;
  message: string;
};

export type PrepareAuthorityInputs = {
  reportRecordId: string | null;
  reportId: string | null;
  assetId: string | null;
  hasBrandModel: boolean;
  hasMasterArtwork: boolean;
  shopifyProductId: string | null;
  shopifyVariantId: string | null;
  points: CornerFieldValues;
};

export type V2PreparedJob = {
  id: string;
  inputFingerprint: string;
  status: string;
  estimate: { maximum: number; currency: string; basis: string };
  confirmationExpiresAt: string;
  inputSnapshot: {
    productionMode: string;
    brandModel: { displayName: string; identityLockVersion: number };
    masterArtwork: { designId: string; version: string };
    product: { productName: string; color: string | null; variantId: string | null };
    printSurface: { printSurfaceId: string; version: number; region: string };
    shot: { title: string };
    baseGeneration: { provider: string; model: string };
    compositing: { compositorVersion: string };
  };
};

export type PrepareFlowState = {
  status: PrepareFlowStatus;
  statusLabel: string | null;
  error: string | null;
  job: V2PreparedJob | null;
  duplicateClickIgnored: boolean;
  requestSent: boolean;
};

export type PrepareClickResult = PrepareFlowState & {
  clickHandlerFired: true;
  quad: QuadCorners | null;
};

const IN_FLIGHT: ReadonlySet<PrepareFlowStatus> = new Set(["validating", "freezing", "preparing"]);

export function initialPrepareFlowState(): PrepareFlowState {
  return {
    status: "idle",
    statusLabel: null,
    error: null,
    job: null,
    duplicateClickIgnored: false,
    requestSent: false,
  };
}

export function isPrepareInFlight(state: PrepareFlowState): boolean {
  return IN_FLIGHT.has(state.status);
}

export function listPrepareBlockers(inputs: PrepareAuthorityInputs): PrepareBlocker[] {
  const blockers: PrepareBlocker[] = [];
  if (!inputs.hasMasterArtwork) {
    blockers.push({
      code: "MISSING_ARTWORK",
      message: "Approved durable Artwork is required before preparing V2.",
    });
  }
  if (!inputs.shopifyProductId || !inputs.shopifyVariantId) {
    blockers.push({
      code: "MISSING_PRODUCT",
      message: "Select an exact live Shopify Product and variant before preparing V2.",
    });
  }
  if (!inputs.hasBrandModel) {
    blockers.push({
      code: "MISSING_BRAND_MODEL",
      message: "Select a Brand Model before preparing V2.",
    });
  }
  if (!inputs.reportRecordId || !inputs.reportId || !inputs.assetId) {
    blockers.push({
      code: "MISSING_SHOT",
      message: "Select one shot before preparing V2.",
    });
  }
  const quad = validateHumanDefinedQuad(inputs.points);
  if (!quad.ok) {
    blockers.push({ code: quad.code, message: quad.message });
  }
  return blockers;
}

export function isPrepareButtonEnabled(inputs: PrepareAuthorityInputs, state: PrepareFlowState): boolean {
  return listPrepareBlockers(inputs).length === 0 && !isPrepareInFlight(state) && !state.job;
}

export function clearPrepareError(state: PrepareFlowState): PrepareFlowState {
  if (isPrepareInFlight(state)) return state;
  if (!state.error && state.status !== "error" && !state.duplicateClickIgnored) return state;
  return {
    ...state,
    status: state.status === "error" ? "idle" : state.status,
    statusLabel: state.status === "error" ? null : state.statusLabel,
    error: null,
    duplicateClickIgnored: false,
  };
}

function withStatus(state: PrepareFlowState, status: PrepareFlowStatus, extra: Partial<PrepareFlowState> = {}): PrepareFlowState {
  return {
    ...state,
    status,
    statusLabel: PREPARE_STATUS_LABELS[status],
    duplicateClickIgnored: false,
    ...extra,
  };
}

function humanError(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = (payload as { error?: unknown }).error;
    if (typeof error === "string" && error.trim()) return error;
  }
  return fallback;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("V2 prepare returned a non-JSON response.");
  }
}

/**
 * Call global `fetch` as a free function so it keeps the Window/Worker
 * invocation context. Passing `window.fetch` into a helper and invoking it as
 * `fetchFn(...)` throws: Failed to execute 'fetch' on 'Window': Illegal invocation.
 */
export const callBrowserFetch: typeof fetch = (input, init) => fetch(input, init);

export function resolveV2Fetch(fetchFn?: typeof fetch): typeof fetch {
  if (!fetchFn || fetchFn === fetch) return callBrowserFetch;
  return fetchFn;
}

export function printSurfaceRefFromCalibration(printSurface: unknown): { printSurfaceId: string; version: number } {
  if (!printSurface || typeof printSurface !== "object") {
    throw new Error("PrintSurface calibration did not return an exact surface version.");
  }
  const record = printSurface as { printSurfaceId?: unknown; version?: unknown };
  if (typeof record.printSurfaceId !== "string" || record.printSurfaceId.trim() === "") {
    throw new Error("PrintSurface calibration did not return an exact surface version.");
  }
  if (typeof record.version !== "number" || !Number.isInteger(record.version) || record.version < 1) {
    throw new Error("PrintSurface calibration did not return an exact surface version.");
  }
  return { printSurfaceId: record.printSurfaceId, version: record.version };
}

export async function handlePrepareClick(input: {
  authority: PrepareAuthorityInputs;
  payload: {
    brandModelTrace: unknown;
    masterArtwork: unknown;
  };
  flow: PrepareFlowState;
  fetchFn?: typeof fetch;
  onState?: (state: PrepareFlowState) => void;
  onDiagnostics?: (details: unknown) => void;
}): Promise<PrepareClickResult> {
  const request = resolveV2Fetch(input.fetchFn);
  const emit = (state: PrepareFlowState): PrepareFlowState => {
    input.onState?.(state);
    return state;
  };

  if (isPrepareInFlight(input.flow)) {
    const ignored = emit({ ...input.flow, duplicateClickIgnored: true });
    return { ...ignored, clickHandlerFired: true, quad: null };
  }

  const blockers = listPrepareBlockers(input.authority);
  const printSurface = validateHumanDefinedQuad(input.authority.points);
  if (blockers.length > 0 || !printSurface.ok) {
    const message = blockers[0]?.message ?? PRINT_SURFACE_MISSING_MESSAGE;
    const failed = emit(withStatus(input.flow, "error", { error: message, job: null, requestSent: false }));
    return { ...failed, clickHandlerFired: true, quad: null };
  }

  emit(withStatus(input.flow, "validating", { error: null, job: null, requestSent: false }));

  const { reportRecordId, reportId, assetId, shopifyProductId, shopifyVariantId } = input.authority;
  const surfaceId = `front-center:${shopifyVariantId}`;

  try {
    emit(withStatus(input.flow, "freezing", { error: null, job: null, requestSent: true }));
    const calibrationResponse = await request(CALIBRATE_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        authority: "SHOPIFY_LIVE",
        productId: shopifyProductId,
        variantId: shopifyVariantId,
        surface: {
          printSurfaceId: surfaceId,
          region: "front_center",
          quad: printSurface.quad,
          calibrationAttestation: true,
        },
      }),
    });
    const calibration = await readJson(calibrationResponse) as {
      profile?: { productProfileId?: string; version?: number };
      printSurface?: unknown;
      error?: string;
      details?: unknown;
    };
    if (!calibrationResponse.ok || !calibration.profile?.productProfileId || !calibration.profile.version || !calibration.printSurface) {
      input.onDiagnostics?.(calibration.details ?? calibration);
      throw new Error(humanError(calibration, "Product reference freeze / PrintSurface calibration failed."));
    }

    emit(withStatus(input.flow, "preparing", { error: null, job: null, requestSent: true }));
    const prepareResponse = await request(PREPARE_JOBS_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reportRecordId,
        reportId,
        assetId,
        brandModelTrace: input.payload.brandModelTrace,
        masterArtwork: { reference: input.payload.masterArtwork },
        productProfile: {
          profileKey: calibration.profile.productProfileId,
          version: calibration.profile.version,
          variantId: shopifyVariantId,
        },
        printSurface: printSurfaceRefFromCalibration(calibration.printSurface),
      }),
    });
    const prepared = await readJson(prepareResponse) as { job?: V2PreparedJob; error?: string; details?: unknown };
    if (!prepareResponse.ok || !prepared.job) {
      input.onDiagnostics?.(prepared.details ?? prepared);
      throw new Error(humanError(prepared, "V2 Prepare / Estimate failed."));
    }

    const ready = emit(withStatus(input.flow, "ready", { error: null, job: prepared.job, requestSent: true }));
    return { ...ready, clickHandlerFired: true, quad: printSurface.quad };
  } catch (error) {
    const message = error instanceof Error ? error.message : "V2 preparation failed.";
    const failed = emit(withStatus(input.flow, "error", { error: message, job: null, requestSent: true }));
    return { ...failed, clickHandlerFired: true, quad: printSurface.quad };
  }
}
