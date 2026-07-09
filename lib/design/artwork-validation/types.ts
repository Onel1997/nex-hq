export type ArtworkFileKind = "png" | "svg" | "pdf" | "ai" | "eps" | "unknown";

export type ValidationStatus =
  | "not-uploaded"
  | "checking"
  | "valid"
  | "warning"
  | "invalid";

export interface ArtworkValidationIssue {
  code: string;
  message: string;
  severity: "error" | "warning";
}

export interface ArtworkFileMetadata {
  fileName: string;
  fileKind: ArtworkFileKind;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
  previewSupported: boolean;
  width?: number;
  height?: number;
  dimensionsLabel?: string;
  aspectRatio?: number;
  aspectRatioLabel?: string;
  hasTransparency?: boolean;
  estimatedDpi?: number;
  printSizeAt300Dpi?: string;
}

export interface ArtworkValidationResult {
  status: ValidationStatus;
  metadata: ArtworkFileMetadata | null;
  issues: ArtworkValidationIssue[];
  canApprove: boolean;
}
