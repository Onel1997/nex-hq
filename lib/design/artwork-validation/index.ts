import { isAcceptedArtworkFile, isPreviewableArtworkKind, resolveArtworkFileKind } from "./file-type";
import { validateDocumentFile } from "./validate-document";
import { validatePngFile } from "./validate-png";
import { validateSvgFile } from "./validate-svg";
import type { ArtworkValidationResult, ValidationStatus } from "./types";

export * from "./types";
export * from "./file-type";

function resolveValidationStatus(
  issues: Array<{ severity: "error" | "warning" }>,
  hasError: boolean,
): ValidationStatus {
  if (hasError) return "invalid";
  const hasWarning = issues.some((i) => i.severity === "warning");
  return hasWarning ? "warning" : "valid";
}

export async function validateArtworkFile(
  file: File,
  objectUrl: string,
  uploadedAt: string,
): Promise<ArtworkValidationResult & { svgMarkup?: string }> {
  if (!isAcceptedArtworkFile(file)) {
    return {
      status: "invalid",
      metadata: null,
      issues: [
        {
          code: "unsupported-type",
          message: "Unsupported file type. Use PNG, SVG, PDF, AI, or EPS.",
          severity: "error",
        },
      ],
      canApprove: false,
    };
  }

  const kind = resolveArtworkFileKind(file);

  try {
    if (kind === "png") {
      const { metadata, issues } = await validatePngFile(file, objectUrl, uploadedAt);
      const status = resolveValidationStatus(issues, false);
      return {
        status,
        metadata,
        issues,
        canApprove: status === "valid" || status === "warning",
      };
    }

    if (kind === "svg") {
      const { metadata, issues, svgMarkup } = await validateSvgFile(file, uploadedAt);
      const status = resolveValidationStatus(issues, false);
      return {
        status,
        metadata,
        issues,
        svgMarkup,
        canApprove: status === "valid" || status === "warning",
      };
    }

    if (kind === "pdf" || kind === "ai" || kind === "eps") {
      const { metadata, issues } = validateDocumentFile(file, kind, uploadedAt);
      const status = resolveValidationStatus(issues, false);
      return {
        status,
        metadata,
        issues,
        canApprove: status === "valid" || status === "warning",
      };
    }

    return {
      status: "invalid",
      metadata: null,
      issues: [
        {
          code: "unknown-type",
          message: "Could not determine artwork file type.",
          severity: "error",
        },
      ],
      canApprove: false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Validation failed.";
    return {
      status: "invalid",
      metadata: null,
      issues: [{ code: "validation-error", message, severity: "error" }],
      canApprove: false,
    };
  }
}

export function createNotUploadedValidation(): ArtworkValidationResult {
  return {
    status: "not-uploaded",
    metadata: null,
    issues: [],
    canApprove: false,
  };
}

export function createCheckingValidation(): ArtworkValidationResult {
  return {
    status: "checking",
    metadata: null,
    issues: [],
    canApprove: false,
  };
}

export function formatValidationStatusLabel(status: ValidationStatus): string {
  switch (status) {
    case "not-uploaded":
      return "Not Uploaded";
    case "checking":
      return "Checking";
    case "valid":
      return "Valid";
    case "warning":
      return "Warning";
    case "invalid":
      return "Invalid";
  }
}

export { isPreviewableArtworkKind };
