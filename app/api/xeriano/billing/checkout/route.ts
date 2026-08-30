import { NextResponse } from "next/server";

import { requireXerianoAccount, XerianoAuthorizationError } from "@/lib/xeriano/server";
import { isXerianoStripeProductCode } from "@/lib/xeriano/stripe-config";
import type { XerianoStripeProductCode } from "@/lib/xeriano/stripe-config";
import {
  checkoutDiagnostic,
  logXerianoCheckoutDiagnostic,
} from "@/lib/xeriano/stripe-checkout-diagnostics";
import {
  assertXerianoBillingOrigin,
  createXerianoCheckout,
  XerianoBillingError,
} from "@/lib/xeriano/stripe-service";

export const runtime = "nodejs";
const MAX_BODY_BYTES = 4_096;

function customerMessage(code: string): string {
  if (code === "USE_BILLING_PORTAL_FOR_PLAN_CHANGE") return "Bitte verwalte deinen bestehenden Plan über das Kundenportal.";
  if (code === "STRIPE_PRICE_NOT_CONFIGURED" || code === "STRIPE_PRICE_CATALOG_MISMATCH") return "Dieses Produkt ist im Testmodus noch nicht verfügbar.";
  return "Checkout konnte nicht gestartet werden.";
}

export async function POST(request: Request) {
  let productCode: XerianoStripeProductCode | undefined;
  try {
    assertXerianoBillingOrigin(request);
    const declaredLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
      return NextResponse.json({ success: false, code: "BILLING_REQUEST_TOO_LARGE", error: "Ungültige Anfrage." }, { status: 413 });
    }
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
      return NextResponse.json({ success: false, code: "BILLING_REQUEST_TOO_LARGE", error: "Ungültige Anfrage." }, { status: 413 });
    }
    const body = JSON.parse(raw) as { productCode?: unknown; requestId?: unknown };
    if (typeof body.productCode !== "string" || !isXerianoStripeProductCode(body.productCode)) {
      return NextResponse.json({ success: false, code: "INVALID_BILLING_PRODUCT", error: "Dieses Produkt ist nicht verfügbar." }, { status: 400 });
    }
    productCode = body.productCode;
    const context = await requireXerianoAccount();
    const result = await createXerianoCheckout({
      context,
      productCode: body.productCode,
      requestId: typeof body.requestId === "string" ? body.requestId : undefined,
    });
    return NextResponse.json({ success: true, url: result.url });
  } catch (error) {
    if (error instanceof XerianoAuthorizationError) {
      if (error.status >= 500) {
        logXerianoCheckoutDiagnostic(checkoutDiagnostic({
          code: "CHECKOUT_ACCOUNT_RESOLUTION_FAILED",
          stage: "account_resolution",
          productCode,
        }));
      }
      return NextResponse.json({ success: false, code: error.code, error: "Kein Zugriff." }, { status: error.status });
    }
    if (error instanceof XerianoBillingError) {
      if (error.status >= 500) {
        logXerianoCheckoutDiagnostic(error.diagnostic ?? checkoutDiagnostic({
          code: "CHECKOUT_UNEXPECTED_FAILURE",
          stage: "unexpected",
          productCode,
        }));
        return NextResponse.json({
          success: false,
          code: "BILLING_UNAVAILABLE",
          error: "Checkout konnte nicht gestartet werden.",
        }, { status: error.status });
      }
      return NextResponse.json({ success: false, code: error.code, error: customerMessage(error.code) }, { status: error.status });
    }
    logXerianoCheckoutDiagnostic(checkoutDiagnostic({
      code: "CHECKOUT_UNEXPECTED_FAILURE",
      stage: "unexpected",
      productCode,
      error,
    }));
    return NextResponse.json({ success: false, code: "BILLING_UNAVAILABLE", error: "Checkout konnte nicht gestartet werden." }, { status: 503 });
  }
}
