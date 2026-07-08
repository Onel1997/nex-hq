import type { IntelligenceDomain } from "../types";

/**
 * Runtime context passed to every provider normalizer.
 * Keeps normalization deterministic without coupling to any Studio.
 */
export interface NormalizationContext {
  workspaceId?: string;
  locale?: string;
  region?: string;
  requestedDomains?: IntelligenceDomain[];
  generatedAt: string;
}

export interface NormalizationDiagnostic {
  level: "info" | "warn" | "error";
  code: string;
  message: string;
}

export interface NormalizationResult {
  ok: boolean;
  diagnostics: NormalizationDiagnostic[];
}
