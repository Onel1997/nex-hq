import {
  PRINT_SURFACE_MISSING_MESSAGE,
  validateHumanDefinedQuad,
  type CornerFieldValues,
  type QuadCorners,
} from "@/lib/image/print-surface/validate-quad";
import {
  SEMANTIC_PLACEMENT_DEFINITIONS,
  semanticSurfaceIdentity,
  type PrintSide,
  type SemanticPlacementPreset,
} from "@/lib/image/semantic-print-placement";
import {
  printSurfaceSchema,
  type PrintSurface,
} from "@/lib/image/print-surface/types";
import type { SocialCreativeDirectionV1 } from "@/lib/image/social-creative-direction";
import type { OwnerArtworkPlacement } from "@/lib/product-library/product-family";

export const CALIBRATE_PATH = "/api/image/v2/product-profiles/calibrate";
export const PREPARE_JOBS_PATH = "/api/image/v2/jobs";

export const PREPARE_STATUS_LABELS = {
  idle: null,
  validating: "Druckfläche wird geprüft…",
  freezing: "Produktreferenzen werden eingefroren…",
  preparing: "Deterministischer Auftrag wird vorbereitet…",
  ready: "Bereit zur Bestätigung",
  error: null,
} as const;

export type PrepareFlowStatus = keyof typeof PREPARE_STATUS_LABELS;

export type PrepareBlockerCode =
  | "MISSING_ARTWORK"
  | "MISSING_PRODUCT"
  | "MISSING_BRAND_MODEL"
  | "MISSING_SHOT"
  | "MISSING_CREATIVE_DIRECTION"
  | "MISSING_SEMANTIC_PLACEMENT"
  | "BOTH_REQUIRES_TWO_JOBS"
  | "MISSING_RESOLVED_PRINT_SURFACE"
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
  productProfile?: {
    profileKey: string;
    version: number;
    variantId: string;
    authority: "SHOPIFY_LIVE" | "MANUAL_PROFILE";
    printSurface: {
      printSurfaceId: string;
      version: number;
      quad?: ReadonlyArray<{ x: number; y: number }>;
      authority?: "PRODUCT_PROFILE" | "NEXHQ_PRODUCT_TEMPLATE";
      templateId?: string;
      templateVersion?: number;
      ownerProfileKey?: string;
      ownerProfileVersion?: number;
      inherited?: boolean;
    } | null;
    printSurfaces?: ReadonlyArray<PrintSurface>;
    calibrationTarget?: {
      printSurfaceId: string;
      region: PrintSurface["region"];
    } | null;
  } | null;
  productionOverride?: {
    basePrintSurfaceId: string;
    basePrintSurfaceVersion: number;
    quad: ReadonlyArray<{ x: number; y: number }>;
  } | null;
  ownerArtworkPlacement?: OwnerArtworkPlacement | null;
  semanticPlacement?: {
    printSide: PrintSide;
    placementPreset: SemanticPlacementPreset | null;
  } | null;
  creativeDirection?: SocialCreativeDirectionV1 | null;
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
    brandModel: {
      displayName: string;
      identityLockVersion: number;
      brandModelId?: string;
    };
    identityConditioning?: {
      authoritySource: "PERSONA_MASTER_IDENTITY_LOCK";
      identityLockActive: true;
      genericIdentityFallbackAllowed: false;
      supportingReferenceCount: 5;
    };
    printSurfaceOverride?: {
      contractVersion: "print-surface-production-override-v1";
      basePrintSurfaceId: string;
      basePrintSurfaceVersion: number;
      quad: ReadonlyArray<{ x: number; y: number }>;
      provenance:
        | "OWNER_JOB_FINE_TUNING"
        | "NEXHQ_FRONT_LARGE_TUNING_V1"
        | "NEXHQ_FRONT_LARGE_TUNING_V2"
        | "NEXHQ_FRONT_LARGE_TUNING_V3"
        | "NEXHQ_FRONT_LARGE_TUNING_V4";
    };
    masterArtwork: {
      designId: string;
      version: string;
      artworkId?: string;
      checksum?: string;
    };
    product: {
      productName: string;
      color: string | null;
      size?: string | null;
      variantId: string | null;
      shopifyProductId?: string | null;
      productProfileId?: string;
      profileVersion?: number;
      authority?: string;
    };
    printSurface: {
      printSurfaceId: string;
      version: number;
      region: string;
      quad?: ReadonlyArray<{ x: number; y: number }> | null;
    };
    semanticPlacement?: {
      printSide: "FRONT" | "BACK";
      placementPreset: SemanticPlacementPreset;
      displayLabel: string;
      resolvedPrintSurfaceId: string;
      resolvedPrintSurfaceVersion: number;
      resolvedRegion: string;
    };
    productFamilyPlacement?: {
      placementTemplateId: string;
      placementTemplateVersion: number;
      ownerPlacement: OwnerArtworkPlacement;
      ownerVerticalPlacement?: {
        contractVersion: "nexhq-owner-vertical-placement-v1";
        ownerOffsetY: number;
        previewCenterY: number;
      };
    };
    shot: { title: string; assetId?: string };
    creativeDirection?: SocialCreativeDirectionV1;
    production?: { reportRecordId?: string; reportId?: string };
    baseGeneration: { provider: string; model: string };
    depthEstimationPolicy?: {
      provider: "fal";
      model: string;
      requiredInProduction: boolean;
      maximumCostUsd: number;
    };
    compositing: {
      compositorVersion: string;
      fabricIntegration?: {
        maxDisplacementRatio: number;
        lightingStrength: number;
        textureStrength: number;
        inkOpacity: number;
        surfaceConforming?: {
          contractVersion: "nexhq-surface-conforming-integration-v1";
          gridColumns: number;
          gridRows: number;
          maximumWarpRatio: number;
        };
        depthAware?: {
          contractVersion:
            | "nexhq-depth-aware-surface-integration-v1"
            | "nexhq-depth-aware-surface-integration-v1.1-garment-plane"
            | "nexhq-depth-aware-surface-integration-v1.2-hybrid-low-depth";
          maximumLocalWarpRatio: number;
        };
        surfaceRealismRefinement?: {
          contractVersion: "nexhq-surface-realism-refinement-v1";
          shadingTransferStrength: number;
          textureTransferStrength: number;
        };
      };
    };
  };
  failureCode?: string | null;
  failureMessage?: string | null;
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

const IN_FLIGHT: ReadonlySet<PrepareFlowStatus> = new Set([
  "validating",
  "freezing",
  "preparing",
]);

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

export function listPrepareBlockers(
  inputs: PrepareAuthorityInputs,
): PrepareBlocker[] {
  const blockers: PrepareBlocker[] = [];
  if (!inputs.hasMasterArtwork) {
    blockers.push({
      code: "MISSING_ARTWORK",
      message: "Approved durable Artwork is required before preparing V2.",
    });
  }
  if (
    (!inputs.shopifyProductId || !inputs.shopifyVariantId) &&
    !inputs.productProfile
  ) {
    blockers.push({
      code: "MISSING_PRODUCT",
      message:
        "Wähle ein genaues Shopify-Produkt oder ein produktionsbereites manuelles Produkt.",
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
  if (
    !inputs.creativeDirection ||
    inputs.creativeDirection.shotType !== inputs.assetId
  ) {
    blockers.push({
      code: "MISSING_CREATIVE_DIRECTION",
      message: "Wähle eine kreative Richtung für diese Aufnahme.",
    });
  }
  if (inputs.semanticPlacement?.printSide === "BOTH") {
    blockers.push({
      code: "BOTH_REQUIRES_TWO_JOBS",
      message:
        "Beidseitig ist ein Plan aus zwei einzeln zu erstellenden Aufnahmen.",
    });
    return blockers;
  }
  if (!inputs.semanticPlacement?.placementPreset) {
    blockers.push({
      code: "MISSING_SEMANTIC_PLACEMENT",
      message: "Wähle Druckseite und Platzierung aus.",
    });
    return blockers;
  }
  if (
    inputs.productProfile?.authority === "MANUAL_PROFILE" &&
    !inputs.productProfile.printSurface
  ) {
    blockers.push({
      code: "MISSING_RESOLVED_PRINT_SURFACE",
      message:
        "Für dieses Produkt ist noch keine passende Druckfläche definiert.",
    });
    return blockers;
  }
  if (!inputs.productProfile?.printSurface) {
    blockers.push({
      code: "MISSING_RESOLVED_PRINT_SURFACE",
      message:
        "Für dieses Produkt ist noch keine passende Druckfläche definiert.",
    });
    return blockers;
  }
  if (inputs.productionOverride) {
    const override = validateHumanDefinedQuad(inputs.points);
    if (!override.ok) {
      blockers.push({ code: override.code, message: override.message });
    }
  }
  return blockers;
}

export function isPrepareButtonEnabled(
  inputs: PrepareAuthorityInputs,
  state: PrepareFlowState,
  recoveryState?: string | null,
): boolean {
  const replaceable =
    !state.job ||
    recoveryState === "APPROVED" ||
    recoveryState === "REJECTED" ||
    recoveryState === "CANCELLED" ||
    state.job.status === "cancelled";
  return (
    listPrepareBlockers(inputs).length === 0 &&
    !isPrepareInFlight(state) &&
    replaceable
  );
}

export function clearPrepareError(state: PrepareFlowState): PrepareFlowState {
  if (isPrepareInFlight(state)) return state;
  if (!state.error && state.status !== "error" && !state.duplicateClickIgnored)
    return state;
  return {
    ...state,
    status: state.status === "error" ? "idle" : state.status,
    statusLabel: state.status === "error" ? null : state.statusLabel,
    error: null,
    duplicateClickIgnored: false,
  };
}

function withStatus(
  state: PrepareFlowState,
  status: PrepareFlowStatus,
  extra: Partial<PrepareFlowState> = {},
): PrepareFlowState {
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
export const callBrowserFetch: typeof fetch = (input, init) =>
  fetch(input, init);

export function resolveV2Fetch(fetchFn?: typeof fetch): typeof fetch {
  if (!fetchFn || fetchFn === fetch) return callBrowserFetch;
  return fetchFn;
}

export function printSurfaceRefFromCalibration(printSurface: unknown): {
  printSurfaceId: string;
  version: number;
} {
  if (!printSurface || typeof printSurface !== "object") {
    throw new Error(
      "PrintSurface calibration did not return an exact surface version.",
    );
  }
  const record = printSurface as {
    printSurfaceId?: unknown;
    version?: unknown;
  };
  if (
    typeof record.printSurfaceId !== "string" ||
    record.printSurfaceId.trim() === ""
  ) {
    throw new Error(
      "PrintSurface calibration did not return an exact surface version.",
    );
  }
  if (
    typeof record.version !== "number" ||
    !Number.isInteger(record.version) ||
    record.version < 1
  ) {
    throw new Error(
      "PrintSurface calibration did not return an exact surface version.",
    );
  }
  return { printSurfaceId: record.printSurfaceId, version: record.version };
}

export type CalibratedSurfaceSetup = {
  profile: {
    productProfileId: string;
    version: number;
    printSurfaces?: PrintSurface[];
  };
  printSurface: PrintSurface;
};

/** Explicit one-time Product calibration. Prepare never performs this write. */
export async function calibrateProductSurfaceOnce(input: {
  shopifyProductId: string;
  shopifyVariantId: string;
  placementPreset: SemanticPlacementPreset;
  points: CornerFieldValues;
  physicalProductFamily: {
    key: string;
    label: string;
    memberShopifyProductIds: string[];
  };
  reuseAcrossVariants?: boolean;
  reuseAcrossFamily: boolean;
  ownerConfirmedNormalizedVariants: boolean;
  ownerConfirmedFamilyEquivalence: boolean;
  reuseFrom?: {
    ownerProfileKey: string;
    ownerProfileVersion: number;
    printSurfaceId: string;
    printSurfaceVersion: number;
  } | null;
  fetchFn?: typeof fetch;
}): Promise<CalibratedSurfaceSetup> {
  const quad = validateHumanDefinedQuad(input.points);
  if (!quad.ok) throw new Error(quad.message);
  if (
    (input.reuseAcrossVariants || input.reuseAcrossFamily) &&
    !input.ownerConfirmedNormalizedVariants
  ) {
    throw new Error(
      "Bestätige, dass die normalisierte Druckfläche für die kompatiblen Varianten dieses Produkts gilt.",
    );
  }
  if (input.reuseAcrossFamily && !input.ownerConfirmedFamilyEquivalence) {
    throw new Error(
      "Bestätige ausdrücklich, dass die ausgewählten Shopify-Listings denselben physischen Blank verwenden.",
    );
  }
  const request = resolveV2Fetch(input.fetchFn);
  const scopeKey = input.reuseAcrossFamily
    ? input.physicalProductFamily.key
    : `shopify-product:${input.shopifyProductId}`;
  const identity = semanticSurfaceIdentity({
    placementPreset: input.placementPreset,
    variantId: input.shopifyVariantId,
    physicalProductKey: scopeKey,
  });
  const response = await request(CALIBRATE_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      authority: "SHOPIFY_LIVE",
      productId: input.shopifyProductId,
      variantId: input.shopifyVariantId,
      reuse: {
        scope: input.reuseAcrossFamily ? "PRODUCT_FAMILY" : "PRODUCT_PROFILE",
        variantPolicy:
          input.reuseAcrossVariants || input.reuseAcrossFamily
            ? "ALL_COMPATIBLE_VARIANTS"
            : "EXACT_VARIANT",
        physicalProductKey: scopeKey,
        physicalProductLabel: input.reuseAcrossFamily
          ? input.physicalProductFamily.label
          : input.physicalProductFamily.label,
        compatibleShopifyProductIds: input.reuseAcrossFamily
          ? input.physicalProductFamily.memberShopifyProductIds
          : [input.shopifyProductId],
        normalizedVariantGeometryAttestation:
          input.reuseAcrossVariants || input.reuseAcrossFamily
            ? input.ownerConfirmedNormalizedVariants
            : false,
        familyEquivalenceAttestation:
          input.reuseAcrossFamily && input.ownerConfirmedFamilyEquivalence,
      },
      ...(input.reuseFrom ? { reuseFrom: input.reuseFrom } : {}),
      surface: {
        printSurfaceId: identity.printSurfaceId,
        region: identity.region,
        displayName:
          SEMANTIC_PLACEMENT_DEFINITIONS[input.placementPreset].label,
        quad: quad.quad,
        calibrationAttestation: true,
      },
    }),
  });
  const payload = (await readJson(response)) as {
    profile?: CalibratedSurfaceSetup["profile"];
    printSurface?: unknown;
    error?: string;
  };
  if (!response.ok || !payload.profile || !payload.printSurface) {
    throw new Error(
      humanError(
        payload,
        "Die Produkt-Druckfläche konnte nicht gespeichert werden.",
      ),
    );
  }
  return {
    profile: payload.profile,
    printSurface: printSurfaceSchema.parse(payload.printSurface),
  };
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
  const preparedQuad = printSurface.ok ? printSurface.quad : null;
  if (
    blockers.length > 0 ||
    (input.authority.productionOverride && !printSurface.ok)
  ) {
    const message = blockers[0]?.message ?? PRINT_SURFACE_MISSING_MESSAGE;
    const failed = emit(
      withStatus(input.flow, "error", {
        error: message,
        job: null,
        requestSent: false,
      }),
    );
    return { ...failed, clickHandlerFired: true, quad: null };
  }

  emit(
    withStatus(input.flow, "validating", {
      error: null,
      job: null,
      requestSent: false,
    }),
  );

  const {
    reportRecordId,
    reportId,
    assetId,
    productProfile,
    semanticPlacement,
  } = input.authority;
  if (
    !semanticPlacement?.placementPreset ||
    semanticPlacement.printSide === "BOTH"
  ) {
    const failed = emit(
      withStatus(input.flow, "error", {
        error: "Wähle eine einzelne Druckseite und Platzierung aus.",
        job: null,
        requestSent: false,
      }),
    );
    return { ...failed, clickHandlerFired: true, quad: null };
  }
  try {
    emit(
      withStatus(input.flow, "freezing", {
        error: null,
        job: null,
        requestSent: true,
      }),
    );
    const exactProfile = productProfile?.printSurface ? productProfile : null;
    if (!exactProfile)
      throw new Error(
        "Für diesen Produkttyp ist keine sichere automatische Platzierung verfügbar. Ergänze die technischen Produktdaten in der Produktbibliothek.",
      );
    if (!exactProfile.printSurface)
      throw new Error("Die exakte Druckflächenversion fehlt.");

    emit(
      withStatus(input.flow, "preparing", {
        error: null,
        job: null,
        requestSent: true,
      }),
    );
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
          profileKey: exactProfile.profileKey,
          version: exactProfile.version,
          variantId: exactProfile.variantId,
        },
        printSurface: {
          printSurfaceId: exactProfile.printSurface.printSurfaceId,
          version: exactProfile.printSurface.version,
          authority: exactProfile.printSurface.authority ?? "PRODUCT_PROFILE",
          ...(exactProfile.printSurface.templateId
            ? {
                templateId: exactProfile.printSurface.templateId,
                templateVersion: exactProfile.printSurface.templateVersion,
              }
            : {}),
          ownerProfileKey:
            exactProfile.printSurface.ownerProfileKey ??
            exactProfile.profileKey,
          ownerProfileVersion:
            exactProfile.printSurface.ownerProfileVersion ??
            exactProfile.version,
        },
        semanticPlacement: {
          printSide: semanticPlacement.printSide,
          placementPreset: semanticPlacement.placementPreset,
        },
        creativeDirection: input.authority.creativeDirection,
        ...(input.authority.productionOverride && printSurface.ok
          ? {
              productionOverride: {
                basePrintSurfaceId:
                  input.authority.productionOverride.basePrintSurfaceId,
                basePrintSurfaceVersion:
                  input.authority.productionOverride.basePrintSurfaceVersion,
                quad: printSurface.quad,
              },
            }
          : {}),
        ...(input.authority.ownerArtworkPlacement
          ? { ownerArtworkPlacement: input.authority.ownerArtworkPlacement }
          : {}),
      }),
    });
    const prepared = (await readJson(prepareResponse)) as {
      job?: V2PreparedJob;
      error?: string;
      details?: unknown;
    };
    if (!prepareResponse.ok || !prepared.job) {
      input.onDiagnostics?.(prepared.details ?? prepared);
      throw new Error(humanError(prepared, "V2 Prepare / Estimate failed."));
    }

    const ready = emit(
      withStatus(input.flow, "ready", {
        error: null,
        job: prepared.job,
        requestSent: true,
      }),
    );
    return { ...ready, clickHandlerFired: true, quad: preparedQuad };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "V2 preparation failed.";
    const failed = emit(
      withStatus(input.flow, "error", {
        error: message,
        job: null,
        requestSent: true,
      }),
    );
    return { ...failed, clickHandlerFired: true, quad: preparedQuad };
  }
}
