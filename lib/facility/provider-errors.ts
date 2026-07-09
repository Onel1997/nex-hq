const PROVIDER_QUOTA_PATTERNS = [
  /exceed_egress_quota/i,
  /egress.?quota/i,
  /quota exceeded/i,
  /insufficient_quota/i,
  /exceeded your current quota/i,
  /billing/i,
  /spend cap/i,
  /\b429\b/,
  /rate limit/i,
  /too many requests/i,
  /service for this project is restricted/i,
  /resource exhausted/i,
] as const;

function collectErrorText(error: unknown): string {
  if (error instanceof Error) {
    return [error.message, error.name, error.cause ? collectErrorText(error.cause) : ""]
      .filter(Boolean)
      .join(" ");
  }
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    return [
      record.message,
      record.error,
      record.details,
      record.hint,
      record.code,
    ]
      .filter((value) => typeof value === "string")
      .join(" ");
  }
  return String(error ?? "");
}

/** Provider / infrastructure quota errors that should not take down Facility UI. */
export function isProviderQuotaError(error: unknown): boolean {
  const text = collectErrorText(error);
  if (!text) return false;
  return PROVIDER_QUOTA_PATTERNS.some((pattern) => pattern.test(text));
}

/** Workspace bootstrap failures that can run in local fallback mode. */
export function isRecoverableFacilityError(error: unknown): boolean {
  if (isProviderQuotaError(error)) return true;
  const text = collectErrorText(error);
  return (
    /failed to create workspace/i.test(text) ||
    /supabase not configured/i.test(text) ||
    /connection refused/i.test(text) ||
    /fetch failed/i.test(text)
  );
}

export const FACILITY_DEGRADED_BANNER_MESSAGE =
  "AI provider quota reached. Facility is running in local fallback mode.";
