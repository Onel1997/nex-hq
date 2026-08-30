import { NextResponse } from "next/server";

import {
  grantXerianoOwnerManualCredits,
  XerianoOwnerCustomerError,
} from "@/lib/xeriano/owner-customer-center";
import { isTrustedXeriamoApplicationOrigin } from "@/lib/xeriano/request-origin";

export const runtime = "nodejs";
const MAX_BODY_BYTES = 2_048;

function isStagingRuntime(): boolean {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname
      .startsWith("wwfezmywxishfgwnijyd.");
  } catch {
    return false;
  }
}

function logStagingRejection(code: "OWNER_GRANT_ORIGIN_REJECTED" | "OWNER_GRANT_AUTHORITY_REJECTED") {
  if (!isStagingRuntime()) return;
  console.warn("[xeriamo-owner] Manual credit request rejected", {
    code,
    stage: code === "OWNER_GRANT_ORIGIN_REJECTED" ? "origin" : "owner_authority",
    httpStatus: 403,
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ accountId: string }> },
) {
  try {
    if (!isTrustedXeriamoApplicationOrigin({
      originHeader: request.headers.get("origin"),
      requestUrl: request.url,
      applicationUrl: process.env.NEXT_PUBLIC_APP_URL,
    })) {
      logStagingRejection("OWNER_GRANT_ORIGIN_REJECTED");
      return NextResponse.json({ success: false, error: "Kein Zugriff." }, { status: 403 });
    }
    const declaredLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
      return NextResponse.json({ success: false, error: "Ungültige Anfrage." }, { status: 413 });
    }
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
      return NextResponse.json({ success: false, error: "Ungültige Anfrage." }, { status: 413 });
    }
    const body = JSON.parse(raw) as { requestId?: unknown; amount?: unknown; reason?: unknown };
    const { accountId } = await params;
    const result = await grantXerianoOwnerManualCredits({
      accountId,
      grantId: typeof body.requestId === "string" ? body.requestId : "",
      amount: typeof body.amount === "number" ? body.amount : Number.NaN,
      reason: typeof body.reason === "string" ? body.reason : "",
    });
    return NextResponse.json({ success: true, replayed: result.status === "REPLAYED" });
  } catch (error) {
    if (error instanceof XerianoOwnerCustomerError) {
      if (error.code === "OWNER_REQUIRED") {
        logStagingRejection("OWNER_GRANT_AUTHORITY_REJECTED");
      }
      return NextResponse.json(
        { success: false, error: error.code === "INVALID_GRANT" ? "Bitte prüfe Credits und Grund." : "Die Gutschrift konnte nicht gespeichert werden." },
        { status: error.status },
      );
    }
    return NextResponse.json({ success: false, error: "Die Gutschrift konnte nicht gespeichert werden." }, { status: 503 });
  }
}
