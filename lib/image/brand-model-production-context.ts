/** Image Studio consumer seam for the Persona-owned Brand Model contract. */

import { z } from "zod";
import {
  BRAND_MODEL_CONTRACT_VERSION,
  brandModelHandoffSchema,
  brandModelSummarySchema,
  traceBrandModelContract,
  type BrandModelAssetAccess,
  type BrandModelContract,
  type BrandModelHandoff,
  type BrandModelSummary,
  type BrandModelTrace,
  type ExpectedBrandModelIdentity,
} from "@/lib/persona/domain/brand-model-contract";

export type ImageBrandModelProductionContext = {
  contract: BrandModelContract;
  trace: BrandModelTrace;
};

export type ImageBrandModelSelection = {
  productionContext: ImageBrandModelProductionContext;
  transientAssetAccess: BrandModelAssetAccess[];
};

export class ImageBrandModelConsumerError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly blockingReasons: string[] = [],
  ) {
    super(message);
    this.name = "ImageBrandModelConsumerError";
  }
}

/** Trust Persona's eligibility result; do not reimplement its formula here. */
export function createImageBrandModelProductionContext(
  input: BrandModelHandoff,
): ImageBrandModelProductionContext {
  const handoff = brandModelHandoffSchema.parse(input);
  if (handoff.consumer !== "image") {
    throw new ImageBrandModelConsumerError(
      "Video Brand Model handoff cannot be used for image production.",
      "WRONG_CONSUMER",
    );
  }
  if (!handoff.contract.eligibility.imageEligible) {
    throw new ImageBrandModelConsumerError(
      "Persona authority rejected this Brand Model for image production.",
      "BRAND_MODEL_INELIGIBLE",
      handoff.contract.eligibility.imageBlockingReasons,
    );
  }
  return {
    contract: handoff.contract,
    trace: traceBrandModelContract(handoff.contract),
  };
}

const listResponseSchema = z
  .object({
    kind: z.literal("eligible-brand-models"),
    consumer: z.literal("image"),
    contractVersion: z.literal(BRAND_MODEL_CONTRACT_VERSION),
    brandModels: z.array(brandModelSummarySchema),
  })
  .strict();

const handoffResponseSchema = z
  .object({
    kind: z.literal("brand-model-handoff"),
    consumer: z.literal("image"),
    handoff: brandModelHandoffSchema,
  })
  .strict();

async function readIntegrationResponse(response: Response): Promise<unknown> {
  const payload = (await response.json()) as unknown;
  if (response.ok) return payload;
  const safe = z
    .object({
      error: z.string().optional(),
      code: z.string().optional(),
      details: z
        .object({ blockingReasons: z.array(z.string()).optional() })
        .passthrough()
        .optional(),
    })
    .passthrough()
    .safeParse(payload);
  throw new ImageBrandModelConsumerError(
    safe.success
      ? safe.data.error ?? "Brand Model request failed."
      : "Brand Model request failed.",
    safe.success ? safe.data.code ?? "INTEGRATION_ERROR" : "INTEGRATION_ERROR",
    safe.success ? safe.data.details?.blockingReasons ?? [] : [],
  );
}

export async function fetchImageEligibleBrandModels(): Promise<
  BrandModelSummary[]
> {
  const response = await fetch("/api/persona/integrations?consumer=image", {
    method: "GET",
    cache: "no-store",
  });
  return listResponseSchema.parse(await readIntegrationResponse(response))
    .brandModels;
}

export async function fetchImageBrandModelSelection(
  personaId: string,
  expectedIdentity?: ExpectedBrandModelIdentity,
): Promise<ImageBrandModelSelection> {
  const query = new URLSearchParams({ consumer: "image", personaId });
  if (expectedIdentity) {
    query.set(
      "expectedIdentityLockSnapshotId",
      expectedIdentity.identityLockSnapshotId,
    );
    query.set(
      "expectedIdentityLockVersion",
      String(expectedIdentity.identityLockVersion),
    );
    query.set(
      "expectedIdentityFingerprint",
      expectedIdentity.identityFingerprint,
    );
  }
  const response = await fetch(`/api/persona/integrations?${query}`, {
    method: "GET",
    cache: "no-store",
  });
  const parsed = handoffResponseSchema.parse(
    await readIntegrationResponse(response),
  );
  return {
    productionContext: createImageBrandModelProductionContext(parsed.handoff),
    transientAssetAccess: parsed.handoff.assetAccess,
  };
}

export function expectedIdentityFromImageContext(
  context: ImageBrandModelProductionContext,
): ExpectedBrandModelIdentity {
  return {
    identityLockSnapshotId: context.trace.identityLockSnapshotId,
    identityLockVersion: context.trace.identityLockVersion,
    identityFingerprint: context.trace.identityFingerprint,
  };
}

/** Bind audit lineage without copying or recalculating Persona authority. */
export function bindImageAssetsToBrandModel<TAsset extends object>(
  assets: readonly TAsset[],
  context: ImageBrandModelProductionContext,
): Array<TAsset & { brandModelTrace: BrandModelTrace }> {
  return assets.map((asset) => ({
    ...asset,
    brandModelTrace: context.trace,
  }));
}
