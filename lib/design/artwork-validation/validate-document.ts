import type { ArtworkFileKind, ArtworkFileMetadata, ArtworkValidationIssue } from "./types";
import { formatFileKindLabel } from "./file-type";

const MIN_FILE_BYTES = 5_000;

export function validateDocumentFile(
  file: File,
  fileKind: ArtworkFileKind,
  uploadedAt: string,
): { metadata: ArtworkFileMetadata; issues: ArtworkValidationIssue[] } {
  const issues: ArtworkValidationIssue[] = [];
  const label = formatFileKindLabel(fileKind);

  if (file.size === 0) {
    throw new Error(`${label} file is empty.`);
  }

  if (file.size < MIN_FILE_BYTES) {
    issues.push({
      code: "file-too-small",
      message: `${label} file is unusually small for production artwork.`,
      severity: "warning",
    });
  }

  const metadata: ArtworkFileMetadata = {
    fileName: file.name,
    fileKind,
    mimeType: file.type || "application/octet-stream",
    fileSize: file.size,
    uploadedAt,
    previewSupported: false,
    dimensionsLabel: "Pending analysis",
    aspectRatioLabel: "—",
    hasTransparency: undefined,
    estimatedDpi: undefined,
    printSizeAt300Dpi: "Pending analysis",
  };

  return { metadata, issues };
}
