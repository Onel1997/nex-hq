export const RESEARCH_ARTWORK_PROVENANCE = "Herkunft: Research Studio";
export const FALLBACK_ARTWORK_DISPLAY_NAME = "Artwork";

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

function usableDisplayTitle(value: string | null | undefined, researchTitle?: string | null): string | null {
  const title = clean(value);
  if (!title) return null;
  if (isResearchReportTitle(title)) return null;
  if (researchTitle && title === researchTitle.trim()) return null;
  return title;
}

export function resolveArtworkDisplayName(input: ArtworkDisplayNameInput): ArtworkDisplayName {
  const researchTitle = clean(input.researchTitle);
  const provenanceLabel = researchTitle ? RESEARCH_ARTWORK_PROVENANCE : null;

  const userFacing = usableDisplayTitle(input.userFacingTitle, researchTitle);
  if (userFacing) return { displayName: userFacing, provenanceLabel };

  const fileName = clean(input.fileName);
  if (fileName) return { displayName: fileName, provenanceLabel };

  const durable = usableDisplayTitle(input.durableDisplayName, researchTitle);
  if (durable) return { displayName: durable, provenanceLabel };

  const designId = clean(input.designId);
  if (designId) return { displayName: designId, provenanceLabel };

  return { displayName: FALLBACK_ARTWORK_DISPLAY_NAME, provenanceLabel };
}
