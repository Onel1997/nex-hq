import { NextResponse } from "next/server";

import {
  isSupportedXerianoStripeEvent,
  processVerifiedXerianoStripeEvent,
  verifyXerianoStripeEvent,
  XERIANO_STRIPE_WEBHOOK_MAX_BYTES,
  XerianoWebhookProcessingError,
} from "@/lib/xeriano/billing";
import { createXerianoBillingSettlementRepository } from "@/lib/xeriano/billing-settlement-repository";
import { persistVerifiedStripeEventAuthority } from "@/lib/xeriano/billing-event-authority";
import { resolveXerianoStripeRuntime, type XerianoStripeRuntime } from "@/lib/xeriano/stripe-runtime";
import { createXerianoStripeGateway } from "@/lib/xeriano/stripe-service";
import { logXerianoWebhookDiagnostic } from "@/lib/xeriano/stripe-webhook-diagnostics";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let event: ReturnType<typeof verifyXerianoStripeEvent> | null = null;
  let billingRuntime: XerianoStripeRuntime | null = null;
  try {
    try {
      billingRuntime = resolveXerianoStripeRuntime();
    } catch {
      logXerianoWebhookDiagnostic({
        code: "WEBHOOK_RUNTIME_NOT_READY",
        stage: "runtime_guard",
        httpStatus: 503,
      });
      return NextResponse.json({ received: false, code: "STRIPE_WEBHOOK_UNAVAILABLE" }, { status: 503 });
    }
    const secret = billingRuntime.webhookSecret;
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
    if (event.livemode !== billingRuntime.livemode) {
      logXerianoWebhookDiagnostic({
        code: "WEBHOOK_LIVEMODE_REJECTED",
        stage: "event_validation",
        httpStatus: 400,
      });
      return NextResponse.json({ received: false, code: "STRIPE_EVENT_MODE_MISMATCH" }, { status: 400 });
    }
    logXerianoWebhookDiagnostic({
      code: "WEBHOOK_EVENT_ACCEPTED",
      stage: "signature_verification",
      httpStatus: 200,
    });
    if (!isSupportedXerianoStripeEvent(event.type)) {
      return NextResponse.json({ received: true, ignored: true });
    }
    await persistVerifiedStripeEventAuthority({ event, rawPayload: payload });
    const repository = createXerianoBillingSettlementRepository();
    const gateway = createXerianoStripeGateway();
    const result = await processVerifiedXerianoStripeEvent({
      event,
      repository,
      expectedLivemode: billingRuntime.livemode,
      authorityResolver: {
        retrieveSubscription: async (id) => {
          if (!gateway.retrieveSubscription) throw new Error("STRIPE_SUBSCRIPTION_AUTHORITY_UNAVAILABLE");
          const subscription = await gateway.retrieveSubscription(id);
          if (subscription.livemode !== billingRuntime!.livemode) throw new Error("STRIPE_SUBSCRIPTION_MODE_MISMATCH");
          return subscription;
        },
      },
    });
    return NextResponse.json({ received: true, status: result.status });
  } catch (error) {
    if (event && isSupportedXerianoStripeEvent(event.type)) {
      try {
        await createXerianoBillingSettlementRepository().recordOutcome({
          eventId: event.id,
          eventType: event.type,
          eventCreated: event.created,
          livemode: event.livemode,
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
