import { isResearchReportTitle } from "@/lib/design/artwork-display-name";
import type { ApprovedMasterArtworkView } from "@/lib/design/master-artwork-authority/types";
import type { ImageStudioHandoff } from "@/lib/image/image-handoff-store";
import {
  IMAGE_STUDIO_HANDOFF_KEY,
  IMAGE_STUDIO_HANDOFF_KEY_V2,
  normalizeImageStudioHandoff,
} from "@/lib/image/image-handoff-store";
import {
  enrichHandoffDesignAuthority,
  resolveDurableMasterArtworkReference,
} from "@/lib/image/image-studio-prepare-identity";

const HANDOFF_STORAGE_KEYS = [
  IMAGE_STUDIO_HANDOFF_KEY_V2,
  IMAGE_STUDIO_HANDOFF_KEY,
] as const;

const DURABLE_ARTWORK_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Exact durable Artwork-version pointer carried by the Design Studio URL.
 * Invalid or ambiguous values are rejected; callers must never fall back to
 * "latest Artwork" when an explicit pointer was supplied.
 */
export function resolveRequestedArtworkId(search: string): string | null {
  const value = new URLSearchParams(search).get("artworkId")?.trim() ?? "";
  return DURABLE_ARTWORK_ID_PATTERN.test(value) ? value : null;
}

export function hasRequestedArtworkPointer(search: string): boolean {
  return new URLSearchParams(search).has("artworkId");
}

/** Builds the canonical explicit handoff after server-side authority resolution. */
export function buildResolvedArtworkHandoff(input: {
  artwork: ApprovedMasterArtworkView;
  retainedContext?: ImageStudioHandoff | null;
  handoffAt?: string;
}): ImageStudioHandoff {
  const { artwork } = input;
  const retainedContext = input.retainedContext ?? null;
  const label =
    artwork.displayName?.trim() ||
    artwork.originalFileName?.trim() ||
    artwork.designId;

  return {
    ...(retainedContext ?? {}),
    brief:
      retainedContext?.brief?.trim() ||
      `Freigegebenes Artwork „${label}“ für eine neue Bildproduktion.`,
    sourceTitle: retainedContext?.sourceTitle ?? label,
    artworkFileName: artwork.originalFileName ?? undefined,
    designId: artwork.designId,
    handoffAt: input.handoffAt ?? new Date().toISOString(),
    durableMasterArtwork: artwork,
    explicitArtworkHandoff: true,
    masterArtworkApproved: true,
    masterArtworkVersion: artwork.version,
    masterArtworkSourceType: artwork.sourceType,
    masterArtworkPlacement: artwork.placement ?? undefined,
    masterArtworkPrintMethod: artwork.printMethod ?? undefined,
  };
}

export type ImageStudioHandoffBootstrapResult = {
  artworkHandoff: ImageStudioHandoff | null;
  projectContextHandoff: ImageStudioHandoff | null;
  artworkRejectReason?: string;
  shouldClearStorage: boolean;
  artworkSource: "sessionStorage" | "localStorage" | "window.name" | "none";
};

export function isResearchDerivedDesignId(
  designId: string | null | undefined,
): boolean {
  const id = designId?.trim();
  if (!id) return false;
  return id.endsWith("-from-report") || /^design-research-report/i.test(id);
}

function safeParseHandoff(raw: string | null): ImageStudioHandoff | null {
  if (!raw) return null;
  try {
    return normalizeImageStudioHandoff(JSON.parse(raw) as Partial<ImageStudioHandoff>);
  } catch {
    return null;
  }
}

function hasProjectContextPayload(
  handoff: ImageStudioHandoff | null | undefined,
): boolean {
  if (!handoff) return false;
  return Boolean(
    handoff.brief?.trim() ||
      handoff.mission ||
      handoff.concept ||
      handoff.reportId ||
      handoff.commercialBlueprint ||
      handoff.imagePromptPrimary ||
      handoff.mockupPromptPrimary ||
      handoff.sourceTitle,
  );
}

/** Non-authoritative provenance and design hints — never carries artwork authority. */
export function extractProjectContextHandoff(
  handoff: ImageStudioHandoff | null | undefined,
): ImageStudioHandoff | null {
  if (!hasProjectContextPayload(handoff)) return null;

  return {
    brief: handoff!.brief,
    sourceTitle: handoff!.sourceTitle,
    reportId: handoff!.reportId,
    handoffAt: handoff!.handoffAt,
    mission: handoff!.mission,
    commercialBlueprint: handoff!.commercialBlueprint,
    commercialScore: handoff!.commercialScore,
    commercialApproved: handoff!.commercialApproved,
    imagePromptPrimary: handoff!.imagePromptPrimary,
    mockupPromptPrimary: handoff!.mockupPromptPrimary,
    renderPlan: handoff!.renderPlan,
    concept: handoff!.concept,
    review: handoff!.review,
  };
}

export function resolveArtworkAuthorityRejectReason(
  handoff: ImageStudioHandoff | null | undefined,
): string | undefined {
  if (!handoff) return "No handoff payload";
  if (!handoff.explicitArtworkHandoff) {
    return "Missing explicit Design Studio artwork handoff flag";
  }
  if (!resolveDurableMasterArtworkReference(handoff)) {
    return "Missing approved durable master artwork reference";
  }
  return undefined;
}

/** Artwork production authority — only from an explicit current Design Studio handoff. */
export function resolveArtworkAuthorityHandoff(
  handoff: ImageStudioHandoff | null | undefined,
): ImageStudioHandoff | null {
  if (!handoff?.explicitArtworkHandoff) return null;
  if (!resolveDurableMasterArtworkReference(handoff)) return null;
  return enrichHandoffDesignAuthority(handoff);
}

function readNormalizedFromStorage(
  storage: Storage | undefined,
  source: ImageStudioHandoffBootstrapResult["artworkSource"],
): { handoff: ImageStudioHandoff | null; source: ImageStudioHandoffBootstrapResult["artworkSource"] } {
  if (!storage) {
    return { handoff: null, source: "none" };
  }
  for (const key of HANDOFF_STORAGE_KEYS) {
    try {
      const raw = storage.getItem(key);
      const handoff = safeParseHandoff(raw);
      if (handoff) return { handoff, source };
    } catch {
      /* try next key */
    }
  }
  return { handoff: null, source: "none" };
}

function readNormalizedFromWindowName(): ImageStudioHandoff | null {
  if (typeof window === "undefined") return null;
  const name = window.name ?? "";
  const prefix = "nexhq-image-handoff:";
  if (!name.startsWith(prefix)) return null;
  return safeParseHandoff(name.slice(prefix.length));
}

function readAnyStoredHandoff(): {
  handoff: ImageStudioHandoff | null;
  source: ImageStudioHandoffBootstrapResult["artworkSource"];
} {
  if (typeof window === "undefined") {
    return { handoff: null, source: "none" };
  }

  const fromSession = readNormalizedFromStorage(
    typeof window !== "undefined" ? window.sessionStorage : undefined,
    "sessionStorage",
  );
  if (fromSession.handoff) return fromSession;

  const fromLocal = readNormalizedFromStorage(
    typeof window !== "undefined" ? window.localStorage : undefined,
    "localStorage",
  );
  if (fromLocal.handoff) return fromLocal;

  const fromWindow = readNormalizedFromWindowName();
  if (fromWindow) return { handoff: fromWindow, source: "window.name" };

  return { handoff: null, source: "none" };
}

function readExplicitArtworkCandidate(): {
  handoff: ImageStudioHandoff | null;
  source: ImageStudioHandoffBootstrapResult["artworkSource"];
} {
  if (typeof window === "undefined") {
    return { handoff: null, source: "none" };
  }

  const candidates: Array<{
    handoff: ImageStudioHandoff | null;
    source: ImageStudioHandoffBootstrapResult["artworkSource"];
  }> = [
    readNormalizedFromStorage(
      typeof window !== "undefined" ? window.sessionStorage : undefined,
      "sessionStorage",
    ),
    readNormalizedFromStorage(
      typeof window !== "undefined" ? window.localStorage : undefined,
      "localStorage",
    ),
  ];

  const fromWindow = readNormalizedFromWindowName();
  if (fromWindow) {
    candidates.push({ handoff: fromWindow, source: "window.name" });
  }

  for (const candidate of candidates) {
    if (!candidate.handoff?.explicitArtworkHandoff) continue;
    if (!resolveDurableMasterArtworkReference(candidate.handoff)) continue;
    return candidate;
  }

  return { handoff: null, source: "none" };
}

export function isLegacyResearchArtworkHandoff(
  handoff: ImageStudioHandoff | null | undefined,
): boolean {
  if (!handoff) return false;
  const durable = handoff.durableMasterArtwork;
  const designId =
    durable?.designId ?? handoff.designId ?? handoff.mission?.title ?? handoff.sourceTitle;
  if (isResearchDerivedDesignId(designId)) return true;
  if (isResearchReportTitle(handoff.sourceTitle)) return true;
  if (isResearchReportTitle(handoff.mission?.title)) return true;
  return Boolean(durable && !handoff.explicitArtworkHandoff);
}

export function bootstrapImageStudioHandoff(
  normalized: ImageStudioHandoff | null | undefined,
): ImageStudioHandoffBootstrapResult {
  const explicitCandidate = readExplicitArtworkCandidate();
  const artworkHandoff =
    resolveArtworkAuthorityHandoff(explicitCandidate.handoff ?? normalized) ??
    resolveArtworkAuthorityHandoff(normalized);

  const contextSource = normalized ?? readAnyStoredHandoff().handoff;
  const projectContextHandoff = extractProjectContextHandoff(contextSource);

  const legacyResearchArtwork =
    !artworkHandoff &&
    isLegacyResearchArtworkHandoff(normalized ?? contextSource);

  const shouldClearStorage = Boolean(
    artworkHandoff ||
      legacyResearchArtwork ||
      (contextSource && !projectContextHandoff),
  );

  return {
    artworkHandoff,
    projectContextHandoff,
    artworkRejectReason: artworkHandoff
      ? undefined
      : resolveArtworkAuthorityRejectReason(normalized ?? contextSource) ??
        (legacyResearchArtwork
          ? "Legacy Research/Mission handoff ignored for artwork authority"
          : undefined),
    shouldClearStorage,
    artworkSource: artworkHandoff ? explicitCandidate.source : "none",
  };
}
