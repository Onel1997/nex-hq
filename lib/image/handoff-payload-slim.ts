import {
  isLargeDataUrl,
  slimConceptForStorage,
  slimRenderPlanForStorage,
} from "@/lib/design/design-mission-storage";
import type { ImageStudioHandoff } from "@/lib/image/image-handoff-store";

/** Browser storage must never carry multi-MB artwork transport payloads. */
export const DESIGN_IMAGE_HANDOFF_MAX_SERIALIZED_BYTES = 512_000;

const HANDOFF_PREVIEW_URL_FIELDS = [
  "masterArtworkArtworkUrl",
  "masterArtworkTransparentPngUrl",
  "masterArtworkProductionPngUrl",
  "masterArtworkApprovedArtworkUrl",
  "masterArtworkApprovedProductionFileUrl",
  "masterArtworkSvgUrl",
] as const;

function isHandoffTransportUrl(value: unknown): boolean {
  if (typeof value !== "string" || !value.trim()) return false;
  if (value.startsWith("data:")) return true;
  if (value.startsWith("blob:")) return true;
  if (isLargeDataUrl(value)) return true;
  return false;
}

function sanitizeOptionalHandoffUrl(
  value: string | undefined,
  stripAllWhenDurable: boolean,
): string | undefined {
  if (!value?.trim()) return undefined;
  if (isHandoffTransportUrl(value)) return undefined;
  if (stripAllWhenDurable) return undefined;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  return undefined;
}

/** Remove raw/base64/blob artwork transport from browser handoff persistence. */
export function stripHandoffTransportPayload(handoff: ImageStudioHandoff): ImageStudioHandoff {
  const stripAllUrls = Boolean(handoff.durableMasterArtwork);
  const next: ImageStudioHandoff = {
    ...handoff,
    concept: handoff.concept ? slimConceptForStorage(handoff.concept) : undefined,
    renderPlan: handoff.renderPlan ? slimRenderPlanForStorage(handoff.renderPlan) : undefined,
    masterArtworkSvgMarkup:
      stripAllUrls ||
      !handoff.masterArtworkSvgMarkup ||
      handoff.masterArtworkSvgMarkup.length > 12_000
        ? undefined
        : handoff.masterArtworkSvgMarkup,
  };

  for (const field of HANDOFF_PREVIEW_URL_FIELDS) {
    next[field] = sanitizeOptionalHandoffUrl(handoff[field], stripAllUrls);
  }

  if (handoff.durableMasterArtwork) {
    next.masterArtworkApproved = true;
    next.masterArtworkVersion = handoff.durableMasterArtwork.version;
    next.masterArtworkSourceType = handoff.durableMasterArtwork.sourceType;
    next.masterArtworkPlacement =
      handoff.durableMasterArtwork.placement ?? handoff.masterArtworkPlacement;
    next.masterArtworkPrintMethod =
      handoff.durableMasterArtwork.printMethod ?? handoff.masterArtworkPrintMethod;
  }

  return next;
}

export function measureHandoffSerializedBytes(handoff: ImageStudioHandoff): number {
  return JSON.stringify(handoff).length;
}

export function assertHandoffSafeForBrowserPersistence(handoff: ImageStudioHandoff): void {
  const payload = JSON.stringify(handoff);
  if (payload.length > DESIGN_IMAGE_HANDOFF_MAX_SERIALIZED_BYTES) {
    throw new Error(
      `Browser handoff payload exceeds ${DESIGN_IMAGE_HANDOFF_MAX_SERIALIZED_BYTES} bytes.`,
    );
  }
  if (/data:image\/[a-zA-Z0-9.+-]+;base64,/i.test(payload)) {
    throw new Error("Browser handoff must not serialize raw artwork base64 data URLs.");
  }
  if (/contentBase64/i.test(payload)) {
    throw new Error("Browser handoff must not serialize raw artwork bytes.");
  }
}
