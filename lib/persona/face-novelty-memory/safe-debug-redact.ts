/**
 * Client-safe debug redaction helpers — no TensorFlow / canvas / server deps.
 */

/** Reject signed storage URLs / token query params in any debug/copy payload. */
export function assertNoSignedUrlLeakage(json: string): void {
  if (json.includes("?token=")) {
    throw new Error("Debug payload must not contain ?token= query parameters");
  }
  if (json.includes("/object/sign/")) {
    throw new Error("Debug payload must not contain Supabase /object/sign/ URLs");
  }
  if (/https?:\/\/[^"\s]+supabase[^"\s]+\/storage\//i.test(json)) {
    throw new Error("Debug payload must not contain Supabase storage URLs");
  }
}

/** Redact asset preview paths for integrity debug panels. */
export function redactAssetPathForDebug(pathOrUrl: string | null | undefined): string {
  if (!pathOrUrl) return "—";
  if (
    pathOrUrl.includes("?token=") ||
    pathOrUrl.includes("/object/sign/") ||
    /^https?:\/\//i.test(pathOrUrl)
  ) {
    return "[redacted-signed-url]";
  }
  // Keep only a short object-key hint, never query strings.
  const cleaned = pathOrUrl.split("?")[0] ?? pathOrUrl;
  const parts = cleaned.split("/").filter(Boolean);
  if (parts.length <= 2) return cleaned;
  return `…/${parts.slice(-2).join("/")}`;
}
