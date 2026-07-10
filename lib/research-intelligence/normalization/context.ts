import type { Locale } from "@/lib/i18n/config";
import type { IntelligenceDomain } from "../types";

/**
 * Runtime context passed to every provider normalizer.
 * Keeps normalization deterministic without coupling to any Studio.
 */
export interface NormalizationContext {
  workspaceId?: string;
  locale?: Locale;
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
