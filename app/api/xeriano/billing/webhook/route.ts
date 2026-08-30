import { NextResponse } from "next/server";

import {
  isSupportedXerianoStripeEvent,
  processVerifiedXerianoStripeEvent,
  verifyXerianoStripeEvent,
  XERIANO_STRIPE_WEBHOOK_MAX_BYTES,
  XerianoWebhookProcessingError,
} from "@/lib/xeriano/billing";
import { createXerianoBillingSettlementRepository } from "@/lib/xeriano/billing-settlement-repository";
import { assertXerianoStripeTestRuntime } from "@/lib/xeriano/stripe-config";
import { logXerianoWebhookDiagnostic } from "@/lib/xeriano/stripe-webhook-diagnostics";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let event: ReturnType<typeof verifyXerianoStripeEvent> | null = null;
  try {
    try {
      assertXerianoStripeTestRuntime();
    } catch {
      logXerianoWebhookDiagnostic({
        code: "WEBHOOK_RUNTIME_NOT_READY",
        stage: "runtime_guard",
        httpStatus: 503,
      });
      return NextResponse.json({ received: false, code: "STRIPE_WEBHOOK_UNAVAILABLE" }, { status: 503 });
    }
    const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
    const signature = request.headers.get("stripe-signature");
    if (!secret?.startsWith("whsec_")) {
      logXerianoWebhookDiagnostic({
        code: "WEBHOOK_SECRET_MISSING",
        stage: "configuration",
        httpStatus: 503,
      });
      return NextResponse.json({ received: false, code: "STRIPE_WEBHOOK_NOT_CONFIGURED" }, { status: 503 });
    }
    if (!signature) {
      logXerianoWebhookDiagnostic({
        code: "WEBHOOK_SIGNATURE_HEADER_MISSING",
        stage: "signature_verification",
        httpStatus: 401,
      });
      return NextResponse.json({ received: false, code: "INVALID_STRIPE_SIGNATURE" }, { status: 401 });
    }
    const declaredLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(declaredLength) && declaredLength > XERIANO_STRIPE_WEBHOOK_MAX_BYTES) {
      logXerianoWebhookDiagnostic({
        code: "WEBHOOK_BODY_TOO_LARGE",
        stage: "body_read",
        httpStatus: 413,
      });
      return NextResponse.json({ received: false, code: "STRIPE_WEBHOOK_TOO_LARGE" }, { status: 413 });
    }
    let payload: string;
    try {
      payload = await request.text();
    } catch {
      logXerianoWebhookDiagnostic({
        code: "WEBHOOK_BODY_READ_FAILED",
        stage: "body_read",
        httpStatus: 400,
      });
      return NextResponse.json({ received: false, code: "INVALID_STRIPE_WEBHOOK_BODY" }, { status: 400 });
    }
    if (Buffer.byteLength(payload, "utf8") > XERIANO_STRIPE_WEBHOOK_MAX_BYTES) {
      logXerianoWebhookDiagnostic({
        code: "WEBHOOK_BODY_TOO_LARGE",
        stage: "body_read",
        httpStatus: 413,
      });
      return NextResponse.json({ received: false, code: "STRIPE_WEBHOOK_TOO_LARGE" }, { status: 413 });
    }
    try {
      event = verifyXerianoStripeEvent({ payload, signature, secret });
    } catch {
      logXerianoWebhookDiagnostic({
        code: "WEBHOOK_SIGNATURE_INVALID",
        stage: "signature_verification",
        httpStatus: 401,
      });
      return NextResponse.json({ received: false, code: "INVALID_STRIPE_SIGNATURE" }, { status: 401 });
    }
    if (event.livemode) {
      logXerianoWebhookDiagnostic({
        code: "WEBHOOK_LIVEMODE_REJECTED",
        stage: "event_validation",
        httpStatus: 400,
      });
      return NextResponse.json({ received: false, code: "LIVE_STRIPE_EVENT_FORBIDDEN" }, { status: 400 });
    }
    logXerianoWebhookDiagnostic({
      code: "WEBHOOK_EVENT_ACCEPTED",
      stage: "signature_verification",
      httpStatus: 200,
    });
    if (!isSupportedXerianoStripeEvent(event.type)) {
      return NextResponse.json({ received: true, ignored: true });
    }
    const repository = createXerianoBillingSettlementRepository();
    const result = await processVerifiedXerianoStripeEvent({ event, repository });
    return NextResponse.json({ received: true, status: result.status });
  } catch (error) {
    if (event && isSupportedXerianoStripeEvent(event.type)) {
      try {
        await createXerianoBillingSettlementRepository().recordOutcome({
          eventId: event.id,
          eventType: event.type,
          status: "FAILED",
          failureCode: error instanceof XerianoWebhookProcessingError ? error.code : "BILLING_PROCESSING_FAILED",
          metadata: { livemode: event.livemode, objectType: event.data.object.object },
        });
      } catch {
        // Stripe receives a retryable response; no secret or event body is logged.
      }
    }
    const retryable = !(error instanceof XerianoWebhookProcessingError) || error.retryable;
    logXerianoWebhookDiagnostic({
      code: "WEBHOOK_SETTLEMENT_FAILED",
      stage: "settlement",
      httpStatus: retryable ? 500 : 400,
    });
    return NextResponse.json(
      { received: false, code: "BILLING_PROCESSING_FAILED" },
      { status: retryable ? 500 : 400 },
    );
  }
}
