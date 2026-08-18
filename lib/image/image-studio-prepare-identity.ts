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
    return "Ein freigegebenes Master Artwork ist erforderlich, bevor du die Generierung vorbereitest.";
  }

  const durableReference = resolveDurableMasterArtworkReference(input.handoff);
  if (!durableReference) {
    if (!input.handoff?.durableMasterArtwork) {
      return "Diese Übergabe enthält kein dauerhaftes Design-Artwork. Kehre ins Design Studio zurück und sende das freigegebene Artwork erneut.";
    }
    if (!input.handoff.durableMasterArtwork.id?.trim()) {
      return "Für die Vorbereitung ist eine dauerhafte Artwork-ID aus dem Design Studio erforderlich.";
    }
    if (!input.handoff.durableMasterArtwork.designId?.trim()) {
      return "Für die Vorbereitung ist eine Design-ID auf dem freigegebenen Artwork erforderlich.";
    }
    if (!input.handoff.durableMasterArtwork.version?.trim()) {
      return "Für die Vorbereitung ist eine Artwork-Version erforderlich.";
    }
    if (!/^[a-f0-9]{64}$/.test(input.handoff.durableMasterArtwork.checksum)) {
      return "Für die Vorbereitung ist eine gültige Artwork-Prüfsumme erforderlich.";
    }
    if (input.handoff.durableMasterArtwork.status !== "APPROVED") {
      return "Für die Vorbereitung ist ein freigegebenes dauerhaftes Artwork erforderlich.";
    }
    return "Das dauerhafte Artwork konnte nicht eindeutig erkannt werden.";
  }

  const { designId, reportId } = resolveDesignHandoffIdentity(input.handoff);
  if (!designId && !reportId) {
    return "Für die Vorbereitung ist eine erkennbare Design-Übergabe (Design-ID oder Report-ID) erforderlich.";
  }

  const selectedTrace = resolveBrandModelTraceForPrepare({
    brandModelSelection: input.brandModelSelection,
    projectBrandModelTrace: input.projectBrandModelTrace,
  });
  if (!selectedTrace) {
    return "Wähle ein für Bilder freigegebenes Markenmodel aus, bevor du die Generierung vorbereitest.";
  }

  if (
    input.brandModelSelection &&
    input.projectBrandModelTrace &&
    !productionProjectMatchesBrandModel({
      projectBrandModelTrace: input.projectBrandModelTrace,
      selectedTrace: input.brandModelSelection.productionContext.trace,
    })
  ) {
    return "Das Produktionspaket muss mit dem gewählten Markenmodel neu vorbereitet werden.";
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
    return "Das freigegebene Artwork hat sich nach dieser Vorbereitung geändert. Bereite den Auftrag erneut vor.";
  }

  if (
    input.selectedAssetId &&
    input.selectedAssetId !== snapshot.production.assetId
  ) {
    return "Die ausgewählte Aufnahme hat sich nach dieser Vorbereitung geändert. Bereite den Auftrag für die neue Aufnahme erneut vor.";
  }

  const selectedTrace = resolveBrandModelTraceForPrepare({
    brandModelSelection: input.brandModelSelection,
    projectBrandModelTrace: null,
  });
  if (
    selectedTrace &&
    !brandModelTracesEqual(selectedTrace, snapshot.brandModel)
  ) {
    return "Das gewählte Markenmodel hat sich nach dieser Vorbereitung geändert. Bereite den Auftrag erneut vor.";
  }

  if (
    input.productProductionContext &&
    !productContextsEqual(input.productProductionContext, snapshot.product)
  ) {
    return "Das gewählte Shopify-Produkt hat sich nach dieser Vorbereitung geändert. Bereite den Auftrag erneut vor.";
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
