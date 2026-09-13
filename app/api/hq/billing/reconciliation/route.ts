import { NextResponse } from "next/server";

import {
  listStripeReconciliationCandidates,
  loadStripeEventAuthorityForReplay,
} from "@/lib/xeriano/billing-event-authority";
import { createXerianoBillingSettlementRepository } from "@/lib/xeriano/billing-settlement-repository";
import { processVerifiedXerianoStripeEvent } from "@/lib/xeriano/billing";
import { requireXerianoOwner } from "@/lib/xeriano/owner-customer-center";
import { assessTrustedXeriamoApplicationOrigin } from "@/lib/xeriano/request-origin";
import { resolveXerianoStripeRuntime } from "@/lib/xeriano/stripe-runtime";
import { createXerianoStripeGateway } from "@/lib/xeriano/stripe-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_BODY_BYTES = 4_096;

function response(body: object, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/** GET is deliberately a dry run: it only lists private failed/pending authority. */
export async function GET() {
  try {
    await requireXerianoOwner();
    const billingRuntime = resolveXerianoStripeRuntime();
    const candidates = await listStripeReconciliationCandidates({ livemode: billingRuntime.livemode });
    return response({ success: true, dryRun: true, mode: billingRuntime.mode, candidates });
  } catch {
    return response({ success: false, code: "BILLING_RECONCILIATION_UNAVAILABLE" }, 503);
  }
}

export async function POST(request: Request) {
  try {
    await requireXerianoOwner();
    const origin = assessTrustedXeriamoApplicationOrigin({
      originHeader: request.headers.get("origin"),
      requestUrl: request.url,
      applicationUrl: process.env.NEXT_PUBLIC_APP_URL,
      hostHeader: request.headers.get("host"),
      forwardedHostHeader: request.headers.get("x-forwarded-host"),
      forwardedProtoHeader: request.headers.get("x-forwarded-proto"),
      environment: process.env.NODE_ENV,
    });
    if (!origin.allowed) return response({ success: false, code: "BILLING_RECONCILIATION_FORBIDDEN" }, 403);
    const declared = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return response({ success: false, code: "INVALID_REPLAY_REQUEST" }, 413);
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) return response({ success: false, code: "INVALID_REPLAY_REQUEST" }, 413);
    const body = JSON.parse(raw) as { recordId?: unknown; mutate?: unknown };
    if (body.mutate !== true || typeof body.recordId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.recordId)) {
      return response({ success: false, code: "EXPLICIT_REPLAY_REQUIRED" }, 400);
    }
    const billingRuntime = resolveXerianoStripeRuntime();
    const authority = await loadStripeEventAuthorityForReplay({ recordId: body.recordId, livemode: billingRuntime.livemode });
    if (!authority || authority.livemode !== billingRuntime.livemode) return response({ success: false, code: "REPLAY_AUTHORITY_NOT_FOUND" }, 404);
    const gateway = createXerianoStripeGateway();
    const result = await processVerifiedXerianoStripeEvent({
      event: authority.event,
      repository: createXerianoBillingSettlementRepository(),
      expectedLivemode: billingRuntime.livemode,
      authorityResolver: {
        retrieveSubscription: async (id) => {
          if (!gateway.retrieveSubscription) throw new Error("STRIPE_SUBSCRIPTION_AUTHORITY_UNAVAILABLE");
          const subscription = await gateway.retrieveSubscription(id);
          if (subscription.livemode !== billingRuntime.livemode) throw new Error("STRIPE_SUBSCRIPTION_MODE_MISMATCH");
          return subscription;
        },
      },
    });
    return response({ success: true, replayed: true, status: result.status });
  } catch {
    return response({ success: false, code: "BILLING_RECONCILIATION_FAILED" }, 503);
  }
}
