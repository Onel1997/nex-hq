type CreativeProviderDiagnosticEvent =
  | "submission_started"
  | "provider_accepted"
  | "acceptance_unconfirmed"
  | "job_persisted"
  | "reconciliation_started"
  | "reconciliation_result";

export type CreativeProviderDiagnostic = {
  stage: string;
  modelCode: string;
  financialMode: "OWNER" | "CUSTOMER" | "INTERNAL";
  providerAccepted: boolean;
  requestIdPresent: boolean;
  normalizedErrorCode: string | null;
  providerStatus: number | null;
  jobId: string;
};

/** Server-only, allowlisted diagnostics. Never accepts prompts, URLs or raw errors. */
export function logCreativeProviderDiagnostic(
  event: CreativeProviderDiagnosticEvent,
  diagnostic: CreativeProviderDiagnostic,
): void {
  console.info(`[xeriamo-creative] ${event}`, diagnostic);
}

export function safeProviderStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" && Number.isInteger(status) ? status : null;
}
