import type { ImageBrandModelSelection } from "@/lib/image/brand-model-production-context";
import { brandModelTracesEqual } from "@/lib/image/image-generation-identity-contract";
import type { ImageStudioHandoff } from "@/lib/image/image-handoff-store";
import type { ImageGenerationInputSnapshot } from "@/lib/image/paid-generation/types";
import {
  productContextsEqual,
  type ProductProductionContext,
} from "@/lib/image/product-production-context";
import type { BrandModelTrace } from "@/lib/persona/domain/brand-model-contract";

const INVALIDATABLE_PAID_JOB_STATUSES = new Set([
  "awaiting_confirmation",
  "confirmed",
  "failed",
]);

export type DurableMasterArtworkReference = {
  id: string;
  designId: string;
  version: string;
  checksum: string;
};

export function resolveDesignHandoffIdentity(
  handoff: ImageStudioHandoff | null | undefined,
): {
  designId: string | null;
  reportId: string | null;
} {
  if (!handoff) {
    return { designId: null, reportId: null };
  }
  return {
    designId:
      handoff.designId ??
      handoff.durableMasterArtwork?.designId ??
      null,
    reportId: handoff.reportId ?? null,
  };
}

export function resolveDurableMasterArtworkReference(
  handoff: ImageStudioHandoff | null | undefined,
): DurableMasterArtworkReference | null {
  const artwork = handoff?.durableMasterArtwork;
  if (!artwork) return null;
  if (!artwork.id?.trim()) return null;
  if (!artwork.designId?.trim()) return null;
  if (!artwork.version?.trim()) return null;
  if (!/^[a-f0-9]{64}$/.test(artwork.checksum)) return null;
  if (artwork.status !== "APPROVED") return null;
  return {
    id: artwork.id,
    designId: artwork.designId,
    version: artwork.version,
    checksum: artwork.checksum,
  };
}

export function resolveBrandModelTraceForPrepare(input: {
  brandModelSelection: ImageBrandModelSelection | null | undefined;
  projectBrandModelTrace?: BrandModelTrace | null;
}): BrandModelTrace | null {
  return (
    input.brandModelSelection?.productionContext.trace ??
    input.projectBrandModelTrace ??
    null
  );
}

export function productionProjectMatchesBrandModel(input: {
  projectBrandModelTrace?: BrandModelTrace | null;
  selectedTrace?: BrandModelTrace | null;
}): boolean {
  if (!input.selectedTrace) return !input.projectBrandModelTrace;
  if (!input.projectBrandModelTrace) return false;
  return brandModelTracesEqual(input.projectBrandModelTrace, input.selectedTrace);
}

export function resolvePaidPrepareIdentityBlocker(input: {
  handoff: ImageStudioHandoff | null | undefined;
  brandModelSelection: ImageBrandModelSelection | null | undefined;
  projectBrandModelTrace?: BrandModelTrace | null;
}): string | null {
  if (!input.handoff?.masterArtworkApproved && !input.handoff?.durableMasterArtwork) {
    return "Approved Master Artwork is required before paid Image preparation.";
  }

  const durableReference = resolveDurableMasterArtworkReference(input.handoff);
  if (!durableReference) {
    if (!input.handoff?.durableMasterArtwork) {
      return "This browser handoff has no durable Design-owned Master Artwork. Return to Design Studio and send the approved artwork again.";
    }
    if (!input.handoff.durableMasterArtwork.id?.trim()) {
      return "Paid Image preparation requires a durable Master Artwork ID from Design authority.";
    }
    if (!input.handoff.durableMasterArtwork.designId?.trim()) {
      return "Paid Image preparation requires a durable Design ID on the approved Master Artwork.";
    }
    if (!input.handoff.durableMasterArtwork.version?.trim()) {
      return "Paid Image preparation requires an approved Master Artwork version.";
    }
    if (!/^[a-f0-9]{64}$/.test(input.handoff.durableMasterArtwork.checksum)) {
      return "Paid Image preparation requires a valid durable Master Artwork checksum.";
    }
    if (input.handoff.durableMasterArtwork.status !== "APPROVED") {
      return "Paid Image preparation requires an approved durable Master Artwork record.";
    }
    return "Paid Image preparation could not identify the durable Master Artwork reference.";
  }

  const { designId, reportId } = resolveDesignHandoffIdentity(input.handoff);
  if (!designId && !reportId) {
    return "Paid Image preparation requires an identifiable approved Design handoff (design ID or report ID).";
  }

  const selectedTrace = resolveBrandModelTraceForPrepare({
    brandModelSelection: input.brandModelSelection,
    projectBrandModelTrace: input.projectBrandModelTrace,
  });
  if (!selectedTrace) {
    return "Select an eligible Brand Model before paid Image preparation.";
  }

  if (
    input.brandModelSelection &&
    input.projectBrandModelTrace &&
    !productionProjectMatchesBrandModel({
      projectBrandModelTrace: input.projectBrandModelTrace,
      selectedTrace: input.brandModelSelection.productionContext.trace,
    })
  ) {
    return "Production package must be re-staged with the selected Brand Model before paid Image preparation.";
  }

  return null;
}

export function resolvePaidJobStaleReason(input: {
  paidJob: { status: string; inputSnapshot: ImageGenerationInputSnapshot };
  selectedAssetId: string | null;
  handoff: ImageStudioHandoff | null;
  brandModelSelection: ImageBrandModelSelection | null;
  productProductionContext: ProductProductionContext | null;
}): string | null {
  if (!INVALIDATABLE_PAID_JOB_STATUSES.has(input.paidJob.status)) {
    return null;
  }

  const snapshot = input.paidJob.inputSnapshot;
  const durable = resolveDurableMasterArtworkReference(input.handoff);
  if (
    durable &&
    (durable.id !== snapshot.masterArtwork.artworkId ||
      durable.checksum !== snapshot.masterArtwork.checksum ||
      durable.version !== snapshot.masterArtwork.version)
  ) {
    return "The approved Master Artwork changed after this paid job was prepared. Prepare / Estimate again before execution.";
  }

  if (
    input.selectedAssetId &&
    input.selectedAssetId !== snapshot.production.assetId
  ) {
    return "The selected production shot changed after this paid job was prepared. Prepare / Estimate for the selected shot before execution.";
  }

  const selectedTrace = resolveBrandModelTraceForPrepare({
    brandModelSelection: input.brandModelSelection,
    projectBrandModelTrace: null,
  });
  if (
    selectedTrace &&
    !brandModelTracesEqual(selectedTrace, snapshot.brandModel)
  ) {
    return "The selected Brand Model changed after this paid job was prepared. Prepare / Estimate again before execution.";
  }

  if (
    input.productProductionContext &&
    !productContextsEqual(input.productProductionContext, snapshot.product)
  ) {
    return "The selected Shopify product changed after this paid job was prepared. Prepare / Estimate again before execution.";
  }

  return null;
}

export function enrichHandoffDesignAuthority(
  handoff: ImageStudioHandoff,
): ImageStudioHandoff {
  const durable = handoff.durableMasterArtwork;
  if (!durable) return handoff;
  return {
    ...handoff,
    designId: handoff.designId ?? durable.designId,
    masterArtworkApproved: handoff.masterArtworkApproved ?? true,
    masterArtworkVersion: handoff.masterArtworkVersion ?? durable.version,
    masterArtworkSourceType: handoff.masterArtworkSourceType ?? durable.sourceType,
  };
}
