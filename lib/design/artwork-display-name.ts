export const RESEARCH_ARTWORK_PROVENANCE = "Herkunft: Research Studio";
export const FALLBACK_ARTWORK_DISPLAY_NAME = "Artwork";
export const ARTWORK_DISPLAY_NAME_MAX_LENGTH = 120;
export const ARTWORK_ORIGINAL_FILE_NAME_MAX_LENGTH = 255;

const RESEARCH_TITLE_PATTERN =
  /^(design\s+)?research\s+report\b|^forschungsbericht\b/i;

export type ArtworkDisplayNameInput = {
  userFacingTitle?: string | null;
  fileName?: string | null;
  durableDisplayName?: string | null;
  designId?: string | null;
  researchTitle?: string | null;
};

export type ArtworkDisplayName = {
  displayName: string;
  provenanceLabel: string | null;
};

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function isResearchReportTitle(value: string | null | undefined): boolean {
  const title = clean(value);
  if (!title) return false;
  return RESEARCH_TITLE_PATTERN.test(title);
}

function usableFallbackTitle(
  value: string | null | undefined,
  researchTitle?: string | null,
): string | null {
  const title = clean(value);
  if (!title) return null;
  if (isResearchReportTitle(title)) return null;
  if (researchTitle && title === researchTitle.trim()) return null;
  return title;
}

export function normalizeOwnerArtworkDisplayName(
  value: string | null | undefined,
): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof value !== "string") {
    return { ok: false, error: "Der Artwork-Name darf nicht leer sein." };
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: false, error: "Der Artwork-Name darf nicht leer sein." };
  }
  if (trimmed.length > ARTWORK_DISPLAY_NAME_MAX_LENGTH) {
    return {
      ok: false,
      error: `Der Artwork-Name darf höchstens ${ARTWORK_DISPLAY_NAME_MAX_LENGTH} Zeichen haben.`,
    };
  }
  return { ok: true, value: trimmed };
}

export function normalizeOriginalFileName(
  value: string | null | undefined,
): string | null {
  const trimmed = clean(value);
  if (!trimmed) return null;
  return trimmed.slice(0, ARTWORK_ORIGINAL_FILE_NAME_MAX_LENGTH);
}

export function formatArtworkSecondaryLine(input: {
  version?: string | null;
  originalFileName?: string | null;
  statusLabel?: string | null;
}): string {
  const parts: string[] = [];
  const version = clean(input.version);
  if (version) parts.push(version);
  const original = clean(input.originalFileName);
  if (original) parts.push(`Originaldatei: ${original}`);
  const status = clean(input.statusLabel);
  if (status) parts.push(status);
  return parts.join(" · ");
}

export function formatArtworkSelectorLabel(input: ArtworkDisplayNameInput & {
  version?: string | null;
}): string {
  const primary = resolveArtworkDisplayName(input).displayName;
  const secondary = formatArtworkSecondaryLine({
    version: input.version,
    originalFileName: input.fileName,
  });
  return secondary ? `${primary} · ${secondary}` : primary;
}

/**
 * Display priority:
 * 1. explicit owner Artwork name
 * 2. uploaded original filename
 * 3. durable fallback (never a Research title)
 * 4. Design ID (never a Research title)
 * 5. neutral "Artwork"
 */
export function resolveArtworkDisplayName(input: ArtworkDisplayNameInput): ArtworkDisplayName {
  const researchTitle = clean(input.researchTitle);
  const provenanceLabel = researchTitle ? RESEARCH_ARTWORK_PROVENANCE : null;

  const userFacing = clean(input.userFacingTitle);
  if (userFacing) return { displayName: userFacing, provenanceLabel };

  const fileName = clean(input.fileName);
  if (fileName) return { displayName: fileName, provenanceLabel };

  const durable = usableFallbackTitle(input.durableDisplayName, researchTitle);
  if (durable) return { displayName: durable, provenanceLabel };

  const designId = usableFallbackTitle(input.designId, researchTitle);
  if (designId) return { displayName: designId, provenanceLabel };

  return { displayName: FALLBACK_ARTWORK_DISPLAY_NAME, provenanceLabel };
}
