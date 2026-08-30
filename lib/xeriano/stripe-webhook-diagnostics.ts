import { XERIANO_STRIPE_TEST_STAGING_PROJECT_REF } from "./stripe-config";

export type XerianoWebhookDiagnosticCode =
  | "WEBHOOK_BLOCKED_BY_MIDDLEWARE"
  | "WEBHOOK_RUNTIME_NOT_READY"
  | "WEBHOOK_SECRET_MISSING"
  | "WEBHOOK_SIGNATURE_HEADER_MISSING"
  | "WEBHOOK_SIGNATURE_INVALID"
  | "WEBHOOK_LIVEMODE_REJECTED"
  | "WEBHOOK_BODY_TOO_LARGE"
  | "WEBHOOK_BODY_READ_FAILED"
  | "WEBHOOK_EVENT_ACCEPTED"
  | "WEBHOOK_SETTLEMENT_FAILED";

export type XerianoWebhookDiagnosticStage =
  | "middleware"
  | "runtime_guard"
  | "configuration"
  | "body_read"
  | "signature_verification"
  | "event_validation"
  | "settlement";

export type XerianoWebhookDiagnostic = Readonly<{
  code: XerianoWebhookDiagnosticCode;
  stage: XerianoWebhookDiagnosticStage;
  httpStatus: number;
}>;

function isExactStagingProject(env: Record<string, string | undefined>): boolean {
  try {
    return new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname
      === `${XERIANO_STRIPE_TEST_STAGING_PROJECT_REF}.supabase.co`;
  } catch {
    return false;
  }
}

/** Fixed-field staging logger: never accepts an Error, header, body, or Stripe identifier. */
export function logXerianoWebhookDiagnostic(
  diagnostic: XerianoWebhookDiagnostic,
  env: Record<string, string | undefined> = process.env,
  logger: (message: string, context: XerianoWebhookDiagnostic) => void = console.error,
): void {
  if (!isExactStagingProject(env)) return;
  logger(
    diagnostic.code === "WEBHOOK_EVENT_ACCEPTED"
      ? "[xeriano-billing] Webhook accepted"
      : "[xeriano-billing] Webhook rejected",
    Object.freeze({
      code: diagnostic.code,
      stage: diagnostic.stage,
      httpStatus: diagnostic.httpStatus,
    }),
  );
}
